import subprocess, json
R='ffmpeg -v error -y'.split()
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
def clip(src,start,length,out):
    subprocess.run(R+['-ss',str(start),'-t',str(length),'-i',src,'-an','-vf','scale=1280:720,fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','18',out],check=True)
def film(parts,vo,out,lead=0.5,tail=1.0):
    tmp=[]
    for i,(s,a,l) in enumerate(parts):
        o=f'out/_p{i}.mp4'; clip(s,a,l,o); tmp.append(o)
    open('out/_list.txt','w').write(''.join(f"file '{p.split('/')[-1]}'\n" for p in tmp))
    subprocess.run(R+['-f','concat','-safe','0','-i','out/_list.txt','-c','copy','out/_cat.mp4'],check=True)
    vd=dur('out/_cat.mp4'); ad=dur(vo)+lead+tail; pad=max(0,ad-vd)
    subprocess.run(R+['-i','out/_cat.mp4','-i',vo,'-filter_complex',
        f"[0:v]tpad=stop_mode=clone:stop_duration={pad:.2f},fade=t=in:st=0:d=0.4,fade=t=out:st={max(vd,ad)-0.6:.2f}:d=0.6[v];[1:a]adelay={int(lead*1000)}|{int(lead*1000)},apad,afade=t=out:st={max(vd,ad)-0.6:.2f}:d=0.6[a]",
        '-map','[v]','-map','[a]','-t',f'{max(vd,ad):.2f}','-c:v','libx264','-preset','veryfast','-crf','26','-c:a','aac','-b:a','96k','-movflags','+faststart',out],check=True)
for lang in ['nl','fr']:
    film([('clips/201.mp4',0,2.8),('clips/202.mp4',0,5),('clips/203.mp4',0,5),('clips/204.mp4',0,5)],f'vo/v01-{lang}.wav',f'out/0.1-V1-{lang}.mp4')
    film([('clips/205.mp4',0,5),('clips/206.mp4',0,5),('clips/207.mp4',0,5)],f'vo/v31-{lang}.wav',f'out/3.1-V1-{lang}.mp4')
    film([('clips/208.mp4',0,5),('clips/209.mp4',0,2.6),('clips/210.mp4',0,5),('clips/211.mp4',0,5)],f'vo/vm31-{lang}.wav',f'out/M3.1-V1-{lang}.mp4')
