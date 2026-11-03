from PIL import Image,ImageDraw
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parent
shots=[0,.65,4.98,5.02,12.98,13.02,20.98,21.02,31.98,32.02,40.5,41.98,42.02,51.98,52.02,59.98]
if __name__=='__main__':
 sheet=Image.new('RGB',(1080,1920));d=ImageDraw.Draw(sheet)
 for n,t in enumerate(shots):
  p=ROOT/f'renders/decoded-final-{n}.jpg';subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(ROOT/'renders/inside-ai-v2.mp4'),'-frames:v','1','-vf','scale=270:480',str(p)],check=True);sheet.paste(Image.open(p),((n%4)*270,(n//4)*480));d.text(((n%4)*270+10,(n//4)*480+455),str(t),fill='#70dddd')
 sheet.save(ROOT/'renders/final-boundaries.jpg')
