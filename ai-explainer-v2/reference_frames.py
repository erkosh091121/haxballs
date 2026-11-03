"""Square code-generated artwork matching the three requested visual motifs."""
from pathlib import Path
from PIL import Image
import renderer as r
ROOT=Path(__file__).resolve().parent
if __name__=='__main__':
 jobs=[('neurons',2.6,r.neurons),('processor',46,r.chip),('particles',17.5,r.particles)];sheet=Image.new('RGB',(1536,512))
 for n,(name,t,fn) in enumerate(jobs):
  f=r.Frame(1080,1080,'chip' if name=='processor' else 'neurons');fn(f,t);f.bloom(.85);f.im.save(ROOT/f'renders/reference-{name}.png');sheet.paste(f.im.resize((512,512)),(n*512,0));print(name,flush=True)
 sheet.save(ROOT/'renders/reference-frames.jpg',quality=95)
