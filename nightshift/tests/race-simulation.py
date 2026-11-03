import asyncio, os, shutil
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page();await page.goto(os.environ.get('NIGHTSHIFT_URL','http://127.0.0.1:5173/'));await page.wait_for_function('window.__nightshift');await page.click('[data-action=start]')
  for mode in ['street','time','drag','elimination']:
   r=await page.evaluate('''(mode)=>{let g=window.__nightshift.game,pts=[{x:0,z:-70},{x:70,z:-70},{x:70,z:0},{x:70,z:70},{x:0,z:70},{x:-70,z:70},{x:-70,z:0},{x:-70,z:-70}];g.start(mode);g.countdown=0;let collisions=0;for(let i=0;i<6500&&g.state==='playing';i++){let p=g.player;if(mode==='drag'){g.input={w:true,nitro:true}}else{let t=pts[p.next],dx=t.x-p.x,dz=t.z-p.z,dist=Math.hypot(dx,dz),d=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(d-p.angle),Math.cos(d-p.angle)),limit=dist<26?16:38;g.input={w:p.speed<limit,s:p.speed>limit+2,a:diff>.035,d:diff<-.035}}g.update(.02);if(p.hit)collisions++}return {state:g.state,win:window.__nightshift.ui.result?.win,passed:g.player.passed,time:g.elapsed,distance:g.distance,collisions}}''',mode);print(mode,r);assert r['state']=='result' and r['win'],r
  await b.close()
asyncio.run(main())
