from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
m=json.loads((root/'archive-manifest.json').read_text())
target=root/'inside-ai-project.zip'
with target.open('wb') as output:
    for part in m['parts']:
        data=(root/part['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==part['sha256'], 'Checksum failed: '+part['file']
        output.write(data)
assert hashlib.sha256(target.read_bytes()).hexdigest()==m['archive_sha256'], 'Archive checksum failed'
print('Ready:',target)
