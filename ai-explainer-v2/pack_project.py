from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent
include={'style-preview-v2.mp4','style-board.jpg','reference-frames.jpg','reference-neurons.png','reference-processor.png','reference-particles.png','verification.json','ffprobe.json','motion-check.json'}
with ZipFile(root.parent/'inside-ai-v2-source.zip','w',ZIP_DEFLATED,compresslevel=5) as z:
 for p in root.rglob('*'):
  if not p.is_file():continue
  rel=p.relative_to(root)
  if '__pycache__' in rel.parts or '.git' in rel.parts:continue
  if rel.parts[0]=='renders' and p.name not in include and not (p.name.startswith('style-') and p.suffix=='.png'):continue
  z.write(p,Path('ai-explainer-v2')/rel)
print(root.parent/'inside-ai-v2-source.zip')
