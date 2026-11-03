import subprocess,numpy as np,json
from pathlib import Path
source='renders/inside-ai-v2.mp4';p=subprocess.Popen(['ffmpeg','-v','error','-i',source,'-vf','scale=180:320,format=gray','-f','rawvideo','-'],stdout=subprocess.PIPE)
prev=None;changes=[];frames=0
while True:
 b=p.stdout.read(180*320)
 if len(b)!=180*320:break
 im=np.frombuffer(b,np.uint8).astype(np.float32)
 if prev is not None:changes.append(float(np.mean(abs(im-prev))))
 prev=im;frames+=1
p.wait();run=longest=0
for d in changes:
 run=run+1 if d<.02 else 0;longest=max(longest,run)
x={'frames':frames,'fps':60,'mean_absolute_difference':float(np.mean(changes)),'longest_near_static_seconds':longest/60,'decode_exit_code':p.returncode,'limitation':'Numerical frame changes are not a perceptual smoothness or sound review.'};Path('renders/motion-check.json').write_text(json.dumps(x,indent=2));print(x)
