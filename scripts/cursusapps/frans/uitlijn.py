import json,sys,re,difflib,subprocess,os,unicodedata
sys.path.insert(0,'.')
from tts_tekst import uitspraak
from faster_whisper import WhisperModel
M=None
def norm(w):
    w=unicodedata.normalize('NFD',w.lower()); w=''.join(c for c in w if unicodedata.category(c)!='Mn')
    return re.sub(r"[^a-z0-9]","",w)
def woorden(t): return [x for x in (norm(w) for w in re.split(r"[\s'’\-]+",t)) if x]
def lijn(les,wav,uit):
    global M
    if M is None: M=WhisperModel('small',device='cpu',compute_type='int8')
    o=json.load(open('voix-orde.json'))[les]
    txt=[uitspraak(t) for _,t in o]
    import numpy as np
    raw=subprocess.run(['ffmpeg','-v','error','-i',wav,'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True,check=True).stdout
    aud=np.frombuffer(raw,dtype=np.float32)
    segs,_=M.transcribe(aud,language='fr',word_timestamps=True,beam_size=1,vad_filter=False)
    W=[(norm(w.word),w.start,w.end) for s in segs for w in s.words]; W=[x for x in W if x[0]]
    script=[]; owner=[]
    for i,t in enumerate(txt):
        ws=woorden(t); script+=ws; owner+=[i]*len(ws)
    sm=difflib.SequenceMatcher(a=script,b=[w for w,_,_ in W],autojunk=False)
    amap={}
    for a,b,n in sm.get_matching_blocks():
        for k in range(n): amap[a+k]=b+k
    T=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',wav]))
    # begin van paragraaf i = start van eerste gematchte woord in de eerste 3 woorden van i
    starts=[]
    for i in range(len(txt)):
        idx=[k for k in range(len(script)) if owner[k]==i]
        st=None
        for k in idx[:4]:
            if k in amap: st=W[amap[k]][1]-sum(1 for _ in [])*0; break
        ends=None
        for k in reversed(idx[-4:]):
            if k in amap: ends=W[amap[k]][2]; break
        starts.append((st,ends))
    # grenzen: midden tussen einde vorige en begin volgende
    cuts=[0.0]
    for i in range(1,len(txt)):
        a=starts[i-1][1]; b=starts[i][0]
        if a is None: a=cuts[-1]+0.5
        if b is None: b=a+0.6
        cuts.append(max(cuts[-1]+0.2,(a+b)/2))
    cuts.append(T)
    os.makedirs(uit,exist_ok=True)
    res=[]
    for i,(k,_) in enumerate(o):
        a,b=cuts[i],cuts[i+1]
        f=f"{uit}/{k}.mp3"
        subprocess.run(['ffmpeg','-v','error','-y','-ss',f"{a:.3f}",'-to',f"{b:.3f}",'-i',wav,'-af','silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.25','-ac','1','-b:a','48k',f],check=True)
        res.append((k,round(b-a,2),len(txt[i]),round((b-a)/len(txt[i])*1000,1)))
    return res,starts
if __name__=="__main__":
    res,st=lijn(sys.argv[1],sys.argv[2],sys.argv[3])
    if res is None: print("MISLUKT",st)
    else:
        for r in res: print(*r)
