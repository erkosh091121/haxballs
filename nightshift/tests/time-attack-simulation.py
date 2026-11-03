import asyncio, os, shutil
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page();await page.goto(os.environ.get('NIGHTSHIFT_URL','http://127.0.0.1:5173/'));await page.wait_for_function('window.__nightshift');await page.click('[data-action=start]')
  r=await page.evaluate('''()=>{let g=window.__nightshift.game,pts=[{x:0,z:-70},{x:70,z:-70},{x:70,z:0},{x:70,z:70},{x:0,z:70},{x:-70,z:70},{x:-70,z:0},{x:-70,z:-70}];g.start('time');g.countdown=0;let collisions=0;for(let i=0;i<3750&&g.state==='playing';i++){let p=g.player,t=pts[p.next],dx=t.x-p.x,dz=t.z-p.z,dist=Math.hypot(dx,dz),d=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(d-p.angle),Math.cos(d-p.angle));let limit=dist<26?16:38;g.input={w:p.speed<limit,s:p.speed>limit+2,a:diff>.035,d:diff<-.035};g.update(.02);if(p.hit)collisions++}return {state:g.state,win:window.__nightshift.ui.result?.win,passed:g.player.passed,time:g.elapsed,collisions,x:g.player.x,z:g.player.z}}''');print(r);await b.close()
asyncio.run(main())
