from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
import subprocess
import renderer
ROOT=Path(__file__).resolve().parent

def job(task):
 n,t=task;im=renderer.render(t,540,960);im.save(ROOT/f'renders/style-preview-frames/{n:04d}.jpg',quality=94,subsampling=0)
if __name__=='__main__':
 (ROOT/'renders/style-preview-frames').mkdir(exist_ok=True)
 times=[1+n/24 for n in range(72)]+[15+n/24 for n in range(72)]+[44+n/24 for n in range(72)]
 with ProcessPoolExecutor(max_workers=3) as p:list(p.map(job,enumerate(times),chunksize=12))
 subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-i',str(ROOT/'renders/style-preview-frames/%04d.jpg'),'-i',str(ROOT/'assets/music.wav'),'-t','9','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(ROOT/'renders/style-preview-v2.mp4')],check=True)
 print('Style preview ready')
