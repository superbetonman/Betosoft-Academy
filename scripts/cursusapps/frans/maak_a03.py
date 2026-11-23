import subprocess
R='ffmpeg -v error -y'.split()
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
imgs=['13','14b','10','15','16','17','18c','19']
T={'nl':[0.0, 7.22, 10.79, 16.25, 22.48, 28.92, 34.09, 40.93],'fr':[0.0, 7.39, 11.44, 16.86, 23.49, 29.6, 35.72, 41.53]}
lead=0.5
for lang,ts in T.items():
    vo=f'vo/a03-{lang}.wav'; total=dur(vo)+lead+1.2
    starts=[0]+[t+lead for t in ts[1:]]; ends=starts[1:]+[total]
    parts=[]
    for i,(im,s,e) in enumerate(zip(imgs,starts,ends)):
        d=e-s; n=int(round(d*30)); o=f'out/_k{i}.mp4'
        z="1+0.06*on/%d"%n if i%2==0 else "1.06-0.06*on/%d"%n
        subprocess.run(R+['-loop','1','-i',f'img{im}.png','-vf',
          f"scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1280x720:fps=30,format=yuv420p",
          '-frames:v',str(n),'-c:v','libx264','-preset','veryfast','-crf','18',o],check=True)
        parts.append(o)
    open('out/_kl.txt','w').write(''.join(f"file '{p.split('/')[-1]}'\n" for p in parts))
    subprocess.run(R+['-f','concat','-safe','0','-i','out/_kl.txt','-c','copy','out/_kcat.mp4'],check=True)
    vd=dur('out/_kcat.mp4')
    subprocess.run(R+['-i','out/_kcat.mp4','-i',vo,'-filter_complex',
      f"[0:v]fade=t=in:st=0:d=0.4,fade=t=out:st={vd-0.6:.2f}:d=0.6[v];[1:a]adelay={int(lead*1000)}|{int(lead*1000)},apad[a]",
      '-map','[v]','-map','[a]','-t',f'{vd:.2f}','-c:v','libx264','-preset','veryfast','-crf','26','-c:a','aac','-b:a','96k','-movflags','+faststart',f'out/0.3-A1-{lang}.mp4'],check=True)
    print(lang,vd)
