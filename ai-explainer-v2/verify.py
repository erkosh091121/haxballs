import json,subprocess
from pathlib import Path
p=Path('renders/inside-ai-v2.mp4')
x=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
v=next(s for s in x['streams'] if s['codec_type']=='video');a=next(s for s in x['streams'] if s['codec_type']=='audio')
checks={'container_duration':abs(float(x['format']['duration'])-60)<.001,'width':v['width']==1080,'height':v['height']==1920,'fps':v['r_frame_rate']=='60/1','frames':int(v.get('nb_frames',0))==3600,'video_codec':v['codec_name']=='h264','pixel_format':v['pix_fmt'] in ('yuv420p','yuvj420p'),'video_duration':abs(float(v['duration'])-60)<.0001,'audio_codec':a['codec_name']=='aac','audio_duration':abs(float(a['duration'])-60)<.05}
Path('renders/ffprobe.json').write_text(json.dumps(x,indent=2));Path('renders/verification.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks,indent=2));assert all(checks.values()),'Export does not satisfy brief'
subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True)
print('Full decode passed')
