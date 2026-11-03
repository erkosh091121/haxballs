"""Original deterministic cinematic graphics. Geometry is projected from 3D;
Pillow rasterizes faces/filaments and composites depth and optical glow passes.
No reference image is used as an asset. Python 3.12+, NumPy, Pillow.
"""
from __future__ import annotations
import math,os,argparse,subprocess,time,json
from pathlib import Path
from functools import lru_cache
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageChops
ROOT=Path(__file__).resolve().parent
FONT=ROOT/'assets/fonts'
PI=math.pi
CYAN=(102,237,244);WHITE=(222,245,251);BLUE=(44,146,189);ORANGE=(255,153,112)
STARTS=[0,5,13,21,32,42,52,60]
def clamp(x,a=0,b=1):return max(a,min(b,x))
def smooth(a,b,t):
 q=clamp((t-a)/(b-a));return q*q*(3-2*q)
def lerp(a,b,t):return a+(b-a)*t
def color(c,k=1):return tuple(int(clamp(x*k,0,255)) for x in c)
def unit(v):
 v=np.array(v,dtype=float);return v/(np.linalg.norm(v)+1e-12)
@lru_cache(48)
def font(size,bold=False):
 p=FONT/('Bold.ttf' if bold else 'Regular.ttf')
 if not p.exists():p=ROOT/'assets/fonts'/p.name
 return ImageFont.truetype(str(p),max(8,int(size)))
class Camera:
 def __init__(self,w,h,eye,target=(0,0,0),fov=43,center=.55):
  self.w=w;self.h=h;self.eye=np.array(eye,float);back=unit(self.eye-np.array(target));right=unit(np.cross((0,1,0),back));up=np.cross(back,right);self.basis=np.array([right,up,-back]);self.f=h/(2*math.tan(math.radians(fov/2)));self.center=center
 def all(self,points):
  p=(np.asarray(points)-self.eye)@self.basis.T;z=np.maximum(p[:,2],.1);return np.column_stack([self.w/2+p[:,0]*self.f/z,self.h*self.center-p[:,1]*self.f/z,z])
 def p(self,p):return self.all([p])[0]
class Frame:
 def __init__(self,w,h,kind):
  self.w=w;self.h=h;self.s=w/1080;self.im=background(w,h,kind).copy();self.d=ImageDraw.Draw(self.im);self.light=Image.new('RGB',(w,h));self.ld=ImageDraw.Draw(self.light)
 def xy(self,x,y):return (x*self.s,y*self.s)
 def text(self,xy,txt,size=32,fill=WHITE,bold=False,anchor='la',spacing=10,stroke=0):
  p=self.xy(*xy);self.d.multiline_text(p,txt,font=font(size*self.s,bold),fill=fill,anchor=anchor,spacing=spacing*self.s,stroke_width=round(stroke*self.s))
 def line(self,pts,c=CYAN,width=1,glow=True):
  pts=[(float(p[0]),float(p[1])) for p in pts]
  if len(pts)<2:return
  width=max(1,round(width*self.s));self.d.line(pts,fill=c,width=width,joint='curve')
  if glow:self.ld.line(pts,fill=color(c,.7),width=width+max(1,round(self.s)))
 def bloom(self,power=.58):
  small=self.light.resize((max(1,self.w//3),max(1,self.h//3)),Image.Resampling.BILINEAR)
  soft=small.filter(ImageFilter.GaussianBlur(3.2*self.s)).resize((self.w,self.h),Image.Resampling.BILINEAR)
  haze=small.filter(ImageFilter.GaussianBlur(13*self.s)).resize((self.w,self.h),Image.Resampling.BILINEAR)
  self.im=ImageChops.add(self.im,Image.blend(Image.new('RGB',self.im.size),soft,power));self.im=ImageChops.add(self.im,Image.blend(Image.new('RGB',self.im.size),haze,.30));self.d=ImageDraw.Draw(self.im)
@lru_cache(12)
def background(w,h,kind):
 y,x=np.mgrid[0:h,0:w];nx=x/w;ny=y/h
 r=np.exp(-((nx-.53)**2/0.23+(ny-.53)**2/.12))
 if kind=='chip':
  r2=np.exp(-((nx-.10)**2/.22+(ny-.25)**2/.09));a=np.stack([7+12*r+18*r2,13+23*r+31*r2,22+35*r+37*r2],axis=2)
 else:a=np.stack([4+3*r,10+12*r,18+21*r],axis=2)
 noise=np.random.default_rng(31).uniform(-.65,.65,(h,w,1));a=np.clip(a+noise,0,255).astype('uint8');return Image.fromarray(a)
def sphere(f,xy,r,col=CYAN,brightness=1,detail=True):
 x,y=xy[:2];r=max(1,float(r));d=f.d;rr=int(r)
 if x+r<0 or y+r<0 or x-r>f.w or y-r>f.h:return
 # Fresnel shell, dark translucent interior and an offset lit surface.
 d.ellipse((x-r,y-r,x+r,y+r),fill=color(col,.11*brightness),outline=color(col,.72*brightness),width=max(1,round(1.4*f.s)))
 for k in [ .91,.77,.54]:
  rc=r*k;d.arc((x-rc,y-rc,x+rc,y+rc),198,308,fill=color(col,(.16+.32*k)*brightness),width=max(1,round(f.s)))
 f.ld.ellipse((x-r,y-r,x+r,y+r),outline=color(col,.7*brightness),width=max(1,round(2*f.s)))
 if detail and r>10*f.s:
  rng=np.random.default_rng(int(r*113)+81);pts=[]
  for _ in range(35):
   a=rng.uniform(0,2*PI);q=math.sqrt(rng.uniform(0,1))*.9;pts.append((x+math.cos(a)*r*q,y+math.sin(a)*r*q))
  for n,p in enumerate(pts):
   p2=pts[(n*7+3)%len(pts)];d.line([p,p2],fill=color(col,.12*brightness),width=max(1,round(f.s)))
def bezier(a,b,c,d,steps=18):
 t=np.linspace(0,1,steps)[:,None];return (1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
RNG=np.random.default_rng(98)
# Fixed 3D neurons; a foreground cell, offset neighbours and distant cells.
NEURON_POS=np.array([(0,-.2,.8),(-3.8,1.6,-1.4),(3.4,-2.3,-.8),(3.2,3.8,-3),(-2.8,-4.0,-2),(0,5,-6),(-5,4,-6),(5,0,-5),(2,-5,-5),(-5,-1,-6)])
NEURON_DIR=[]
for n in range(12):
 a=[];rng=np.random.default_rng(400+n)
 for j in range(18 if n==0 else 11):
  ang=2*PI*j/(18 if n==0 else 11)+rng.uniform(-.12,.12);z=rng.uniform(-.55,.55);a.append(unit((math.cos(ang),math.sin(ang),z)))
 NEURON_DIR.append(a)
@lru_cache(24)
def core_material(index):
 y,x=np.mgrid[-1.12:1.12:256j,-1.12:1.12:256j];a=np.arctan2(y,x);shape=1+.055*np.sin(a*7+index)+.025*np.cos(a*13);r=np.sqrt(x*x+y*y)/shape;z=np.sqrt(np.clip(1-r*r,0,1));light=.12+.37*np.maximum(0,-.45*x-.55*y+.6*z)+.68*(1-z)**2
 noise=.84+.13*np.sin(x*48+np.sin(y*37))*.6+.1*np.sin(y*87+x*18);grain=np.random.default_rng(888+index).random((256,256))*.12;light=(light*noise+grain)*1.15
 rgb=np.stack([light*65,light*215,light*229],axis=2);alpha=np.clip((1-r)*90,0,1)*255;rgba=np.dstack([np.clip(rgb,0,255),alpha]).astype('uint8');return Image.fromarray(rgba)

@lru_cache(64)
def metal_material(col):
 y,x=np.mgrid[0:1:128j,0:1:128j];light=.68+.32*(1-x)+.15*np.exp(-((y-.26-x*.18)/.10)**2)+.14*np.exp(-((y-.7+x*.22)/.035)**2);light+=.02*np.sin(y*3000);rgb=np.stack([np.clip(light*c,0,255) for c in col],axis=2);return Image.fromarray(rgb.astype('uint8'))
def shaded_face(f,poly,col):
 x0=max(0,int(np.min(poly[:,0])));x1=min(f.w,int(np.max(poly[:,0]))+1);y0=max(0,int(np.min(poly[:,1])));y1=min(f.h,int(np.max(poly[:,1]))+1)
 if x1<=x0 or y1<=y0:return
 mask=Image.new('L',(x1-x0,y1-y0));md=ImageDraw.Draw(mask);md.polygon([(p[0]-x0,p[1]-y0) for p in poly],fill=255);tile=metal_material(col).resize(mask.size,Image.Resampling.BILINEAR);f.im.paste(tile,(x0,y0),mask)

def draw_neuron(f,cam,center,radius,index,t,boost=1):
 center=np.array(center,float);proj=cam.p(center);scale=cam.f/proj[2];rr=radius*scale;col=color(CYAN,boost)
 if rr<2:return
 rng=np.random.default_rng(600+index);dirs=NEURON_DIR[index%len(NEURON_DIR)]
 # Tubular tapered branches with longitudinal filaments and curved silhouettes.
 for j,v in enumerate(dirs):
  length=radius*(3.8+rng.uniform(0,2.3));start=center+v*radius*.58;end=center+v*length
  bend=np.cross(v,unit((.4,.8,1)));bend=unit(bend)*radius*.36*math.sin(j*2.7)
  path=bezier(start,start+v*length*.35+bend,end-v*length*.2+bend,end,19);screen=cam.all(path);sides=[]
  for k,p in enumerate(screen):
   a=screen[min(k+1,len(screen)-1),:2]-screen[max(0,k-1),:2];a=unit(a);norm=np.array([-a[1],a[0]]);q=k/(len(screen)-1);width=radius*scale*(.31*(1-q)**2+.013)
   sides.append((p[:2]+norm*width,p[:2]-norm*width))
  poly=[tuple(p[0]) for p in sides]+[tuple(p[1]) for p in reversed(sides)]
  f.d.polygon(poly,fill=color(col,.19));
  for band in [.78,.48,.21]:
   pa=[tuple(lerp(p[0],p[1],(1-band)/2)) for p in sides]+[tuple(lerp(p[0],p[1],(1+band)/2)) for p in reversed(sides)];f.d.polygon(pa,fill=color(col,.20+.13*(1-band)))
  f.line([p[0] for p in sides],color(col,.95),1.9);f.line([p[1] for p in sides],color(col,.67),1.2)
  for q in [-.65,-.22,.25,.65]:
   pts=[lerp(p[0],p[1],(q+1)/2) for p in sides];f.line(pts,color(col,.37+.18*math.sin(j)**2),1.1,False)
  for k in [2,5,9,13]:f.line([sides[k][0],sides[min(18,k+2)][1]],color(col,.22),.6,False)
  sphere(f,screen[-1],max(2*f.s,rr*(.08+.08*(j%3)/2)),col,.9,False)
  q=(t*.40+j*.17)%1;p=screen[int(q*(len(screen)-1))];r=max(1.4*f.s,rr*.035);f.d.ellipse((p[0]-r,p[1]-r,p[0]+r,p[1]+r),fill=WHITE);f.ld.ellipse((p[0]-r*2,p[1]-r*2,p[0]+r*2,p[1]+r*2),fill=color(CYAN,.8))
 # Irregular organic central membrane.
 p=[]
 for j in range(80):
  a=j/80*2*PI;noise=1+.055*math.sin(a*7+index)+.025*math.cos(a*13);p.append((proj[0]+math.cos(a)*rr*noise,proj[1]+math.sin(a)*rr*.91*noise))
 f.d.polygon(p,fill=(7,48,63));patch=core_material(index).resize((max(2,round(rr*2.24)),max(2,round(rr*2.24))),Image.Resampling.BILINEAR);f.im.paste(patch,(round(proj[0]-rr*1.12),round(proj[1]-rr*1.12)),patch);f.line(p+[p[0]],col,2.3)
 # Surface mesh is projected from a sphere, rather than drawn as flat chords.
 rings=[]
 for lat in np.linspace(-1.32,1.32,12):
  ring=[]
  for lon in np.linspace(0,2*PI,27):
   r=radius*(1+.055*math.sin(lon*7+lat*4));v=center+r*np.array([math.cos(lat)*math.cos(lon),math.sin(lat),math.cos(lat)*math.sin(lon)])
   ring.append(cam.p(v))
  rings.append(ring)
 for k,ring in enumerate(rings):
  f.line(ring,color(col,.58),.8,False)
  if k:
   for j in range(len(ring)-1):
    f.line([rings[k-1][j],ring[j+1]],color(col,.37),.7,False)
 # Irregular membrane threads, projected through the front hemisphere.
 rng2=np.random.default_rng(981+index);web=[]
 for k in range(95):
  aa=rng2.uniform(0,2*PI);q=math.sqrt(rng2.random())*.97
  v=center+radius*np.array([math.cos(aa)*q,math.sin(aa)*q,math.sqrt(1-q*q)*.83]);web.append(cam.p(v))
 web=np.array(web)
 for k,pw in enumerate(web):
  near=np.argsort(np.sum((web[:,:2]-pw[:2])**2,axis=1))[1:5]
  for j in near:
   if j>k:f.line([pw,web[j]],color(col,.35+.18*math.sin(k*2.3)**2),.7,False)
 # Edge-lit core and fine membrane fibres.
 f.ld.line(p+[p[0]],fill=color(col,.9),width=max(1,round(2*f.s)))
 for j in range(26):
  a=j*2.39996;u=(.3+.7*math.sin(j*7)**2);x=proj[0]+math.cos(a)*rr*u;y=proj[1]+math.sin(a)*rr*.84*u
  f.d.ellipse((x-f.s,y-f.s,x+f.s,y+f.s),fill=color(col,.45))
def neurons(f,t,training=False):
 u=t-21 if training else t;orbit=-.20+.30*smooth(0,11 if training else 5,u)
 eye=(math.sin(orbit)*11,.5+math.sin(u*.2)*.4,math.cos(orbit)*11);cam=Camera(f.w,f.h,eye,(0,0,0),45,.55)
 pos=NEURON_POS.copy()
 if training:
  pos=np.array([(x,y,z) for x,z in [(-3.0,-.5),(0,.4),(3.0,-.3)] for y in [-2.5,-.8,.9,2.6]])
 # Defocused background neurons form an independent spatial layer.
 far=Frame(f.w,f.h,'neurons');far.im=Image.new('RGB',(f.w,f.h));far.d=ImageDraw.Draw(far.im)
 for n in reversed(range(len(pos))):
  if training:
   draw_neuron(f,cam,pos[n],.31 if n==5 else .23,n,u,.85)
  elif n>0:draw_neuron(far,cam,pos[n],.25 if n>4 else .34,n,u,.53 if n>4 else .72)
 if not training:
  far.bloom(.5);far.im=far.im.filter(ImageFilter.GaussianBlur(2.4*f.s));f.im=ImageChops.add(f.im,far.im);f.d=ImageDraw.Draw(f.im)
 # Actual 3D connections, with a bright travelling signal.
 pairs=[]
 if training:
  for layer in range(2):
   for a in range(4):
    for b in range(4):pairs.append((layer*4+a,(layer+1)*4+b))
 else:pairs=[(0,n) for n in range(1,len(pos))]+[(n,n+1) for n in range(1,len(pos)-1)]
 for n,(a,b) in enumerate(pairs):
  p1,p2=pos[a],pos[b];bend=np.array([0,0,.2*math.sin(n)]);curve=bezier(p1,p1+(p2-p1)*.32+bend,p2-(p2-p1)*.25+bend,p2,22);sp=cam.all(curve)
  strength=.32+.22*math.sin(n*3.1+u*.8)**2;col=ORANGE if training and 5.5<u<8 else CYAN
  f.line(sp,color(col,strength),1.35)
  q=(u*.5+n*.137)%1
  if training and 5.5<u<8:q=1-q
  ip=min(len(sp)-1,int(q*(len(sp)-1)));r=2.4*f.s;px,py=sp[ip][:2];f.d.ellipse((px-r,py-r,px+r,py+r),fill=WHITE);f.ld.ellipse((px-5*f.s,py-5*f.s,px+5*f.s,py+5*f.s),fill=color(col,.8))
 if not training:draw_neuron(f,cam,pos[0],.80,0,u,1.1)
 if training:
  # Loss appears at the correct phase, and its descending path extends over time.
  x0,y0=150*f.s,1390*f.s;ww,hh=780*f.s,120*f.s;f.line([(x0,y0-hh),(x0,y0),(x0+ww,y0)],(51,82,100),1,False)
  q=smooth(2,10,u);points=[]
  for x in np.linspace(0,q,max(2,int(q*70))):points.append((x0+x*ww,y0-hh*(.06+.88*math.exp(-x*4))))
  f.line(points,ORANGE,2.5);f.text((150,1415),'ОШИБКА УМЕНЬШАЕТСЯ',24,(157,188,203))
 return cam
# Layered processor geometry and circuit routing.
TRACE=[];rng=np.random.default_rng(127)
for side in range(4):
 for j in range(30):
  start=(j-14.5)*.175;reach=rng.uniform(4.2,8);jog=rng.uniform(-1,1);end=start+jog
  path=np.array([(start,-.34,2.55),(start,-.34,3.05),(start+jog*.35,-.34,3.6),(end,-.34,3.6),(end,-.34,reach)])
  a=side*PI/2;c,s=math.cos(a),math.sin(a);path[:,[0,2]]=path[:,[0,2]]@np.array([[c,-s],[s,c]])
  TRACE.append(path)
def cuboid_faces(center,size,colors):
 x,y,z=center;w,h,d=np.array(size)/2
 v=np.array([[x+sx*w,y+sy*h,z+sz*d] for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]])
 return [(v[ix],colors[k]) for k,ix in enumerate([[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]])]
def chip(f,t,transformer=False):
 u=t-(32 if transformer else 42);p=u/10;angle=-.22+.48*smooth(0,10,u);eye=(8.7*math.cos(angle)-8.6*math.sin(angle),8.5,8.7*math.sin(angle)+8.6*math.cos(angle));cam=Camera(f.w,f.h,eye,(0,.7,0),56,.54)
 # Technical ground plane, with perspective spacing and traces on its surface.
 for a in np.arange(-10,10.1,.8):
  f.line(cam.all([(a,-.38,-10),(a,-.38,10)]),(20,45,65),.6,False);f.line(cam.all([(-10,-.38,a),(10,-.38,a)]),(20,45,65),.6,False)
 for n,path in enumerate(TRACE):
  sp=cam.all(path);cc=CYAN if n%4 else ORANGE;f.line(sp,color(cc,.46 if n%4 else .48),1)
  for k in range(2):
   q=(u*.5+n*.121+k*.45)%1;ind=min(3,int(q*4));frac=q*4-ind;v=path[ind]*(1-frac)+path[ind+1]*frac;px,py,_=cam.p(v);r=(1.4+(n%3)*.4)*f.s;f.d.ellipse((px-r,py-r,px+r,py+r),fill=color(cc,.95));f.ld.ellipse((px-r*2,py-r*2,px+r*2,py+r*2),fill=color(cc,.45))
 faces=[];dark=[(8,18,34),(13,30,48),(9,23,39),(10,27,43),(15,37,55),(28,52,75)];silver=[(58,82,100),(88,118,139),(47,74,98),(67,96,117),(93,119,138),(177,200,213)]
 def box(c,size,metal=False,top=None):
  cols=(silver if metal else dark).copy()
  if top:cols[5]=top
  faces.extend(cuboid_faces(c,size,cols))
 box((0,-.05,0),(6.6,.42,6.6));box((0,.25,0),(5.8,.17,5.8),True);box((0,.44,0),(5.3,.20,5.3));box((0,.68,0),(4.8,.24,4.8),True)
 lift=.5+1.4*smooth(.3,3.5,u)
 if transformer:lift=.8+.3*math.sin(u*.4)
 box((0,1.05,0),(3.3,.40,3.3),False,(13,62,82))
 # Dense parallel compute blocks on the exposed die.
 for i in range(6):
  for j in range(6):
   h=.08+.06*math.sin((i+j)*2+u*.8)**2;box(((i-2.5)*.44,1.31+h/2,(j-2.5)*.44),(.33,h,.33),False,(43,151,169) if (i+j)%5 else (108,201,209))
 # Four separate silver heat spreader corners and a floating lid.
 for x,z in [(-1.9,-1.9),(-1.9,1.9),(1.9,-1.9),(1.9,1.9)]:box((x,.97,z),(1.1,.35,1.1),True)
 box((0,1.4+lift,0),(3.8,.27,3.8),True,(70,89,139) if not transformer else (32,77,102))
 # Satellite packages, at different depths and heights.
 for n,(x,z,sz) in enumerate([(-4.1,-1.2,1.1),(3.8,2.0,1.15),(-2.8,4,.9),(2.5,-3.4,1.0)]):box((x,1.5+.18*math.sin(u*.6+n),z),(sz,.3,sz),n%2==0,(62,79,116) if n%2 else (155,187,204))
 # Package pins have an honest three-dimensional cross section.
 for side in range(4):
  a=side*PI/2;c,s=math.cos(a),math.sin(a)
  for j in range(15):
   x,z=(j-7)*.35,3.35;xx,zz=x*c+z*s,-x*s+z*c
   box((xx,-.02,zz),(.15,.48,.22) if side%2==0 else (.22,.48,.15),True)
 projected=[]
 for verts,col in faces:
  sp=cam.all(verts);projected.append((float(sp[:,2].mean()),sp[:,:2],col))
 for _,poly,col in sorted(projected,reverse=True):
  f.d.polygon([tuple(v) for v in poly],fill=col);
  if abs((poly[1,0]-poly[0,0])*(poly[2,1]-poly[0,1])-(poly[1,1]-poly[0,1])*(poly[2,0]-poly[0,0]))>12000*f.s*f.s:shaded_face(f,poly,col)
  f.d.line([tuple(v) for v in poly]+[tuple(poly[0])],fill=color(col,1.12),width=max(1,round(.65*f.s)))
 # Cyan emissive package seams plus a transparent wire cage between lid and die.
 for y,w in [(0.15,6.65),(.53,5.32),(1.28,3.35)]:
  pts=[(-w/2,y,-w/2),(w/2,y,-w/2),(w/2,y,w/2),(-w/2,y,w/2),(-w/2,y,-w/2)];f.line(cam.all(pts),CYAN,2.2)
 for k in range(14):
  y=1.45+k/14*lift;sz=2.05*(1-.13*k/14);pts=[(-sz/2,y,-sz/2),(sz/2,y,-sz/2),(sz/2,y,sz/2),(-sz/2,y,sz/2),(-sz/2,y,-sz/2)];f.line(cam.all(pts),color(CYAN,.12+.15*(k%3==0)),.55,False)
 for n in range(45):
  q=(n*.132+u*.3)%1;v=((n%5-2)*.36,1.4+q*lift,(n//5%5-2)*.36);px,py,z=cam.p(v);r=1.6*f.s;f.d.ellipse((px-r,py-r,px+r,py+r),fill=color(CYAN,.8))
 # Fine circuit etching on the suspended cover catches the top light.
 for n in range(22):
  a=(n-10.5)*.137;yy=1.4+lift+.142;pts=[(-1.6,yy,a),(-.8,yy,a),(-.6,yy,a+.13),(.8,yy,a+.13),(1.6,yy,a-.10)];f.line(cam.all(pts),color((142,185,214),.25),.65,False)
 return cam
# Thousands of particles have depth, finite trajectories and depth-dependent bokeh.
PRNG=np.random.default_rng(2027);PN=7800
PART=np.column_stack([PRNG.random(PN),PRNG.random(PN),PRNG.random(PN),PRNG.random(PN)])
def particles(f,t,final=False):
 u=t-(52 if final else 13);eye=(math.sin(u*.035)*2.5,3.7,14.8);cam=Camera(f.w,f.h,eye,(0,3.1,0),43,.49)
 phase=PART[:,0]*8+u*.75;yy=(phase%8)+.8;theta=PART[:,1]*2*PI+yy*.29+u*.24
 radius=(.12+.125*yy**1.6)*np.sqrt(PART[:,2]);xyz=np.column_stack([np.cos(theta)*radius,yy,np.sin(theta)*radius]);xyz[:,0]+=np.sin(yy*.42+u*.2)*(.1+yy*.035)
 points=cam.all(xyz);keep=(points[:,0]>-10)&(points[:,0]<f.w+10)&(points[:,1]>(-10 if f.w==f.h else f.h*.19))&(points[:,1]<f.h*.79);ix=np.where(keep)[0]
 far=Image.new('RGB',(f.w,f.h));fd=ImageDraw.Draw(far)
 for i in ix:
  x,y,z=points[i];height=yy[i];bright=(.55+.45*PART[i,3])*smooth(.8,1.4,height)*(1-smooth(7.6,8.8,height));r=(1.3+PART[i,3]*1.9)*f.s*(15/z);col=CYAN if PART[i,1]<.78 else (169,143,239);col=color(col,bright)
  d=fd if xyz[i,2]<-.45 else f.d
  d.ellipse((x-r,y-r,x+r,y+r),fill=col)
  if i%5==0:f.ld.ellipse((x-r,y-r,x+r,y+r),fill=color(col,.75))
  if i%17==0:d.line([(x,y),(x+.6*f.s,y+6*f.s)],fill=color(col,.4),width=max(1,round(f.s)))
 far=far.filter(ImageFilter.GaussianBlur(1.7*f.s));f.im=ImageChops.add(f.im,far);f.d=ImageDraw.Draw(f.im)
 # Semiconductor dome and etched circuit paths around the generator.
 for y,rr,col in [(0,2.3,CYAN),(-.08,2.9,(75,125,164)),(-.15,3.25,(77,71,128))]:
  pts=[]
  for a in np.linspace(0,2*PI,120):pts.append((rr*math.cos(a),y,rr*math.sin(a)))
  f.line(cam.all(pts),color(col,.6),1.4)
 for lat in np.linspace(0,PI/2,9):
  pts=[]
  for lon in np.linspace(0,2*PI,100):pts.append((2*math.cos(lat)*math.cos(lon),1.6*math.sin(lat),2*math.cos(lat)*math.sin(lon)))
  f.line(cam.all(pts),color(CYAN,.35),.8)
 for a in np.linspace(0,2*PI,28):
  pts=[(2*math.cos(lat)*math.cos(a),1.6*math.sin(lat),2*math.cos(lat)*math.sin(a)) for lat in np.linspace(0,PI/2,28)];f.line(cam.all(pts),color(CYAN,.25),.7,False)
 for n in range(65):
  a=n*2.39996;y=(n%9)/9*1.4;rr=2*math.sqrt(max(0,1-(y/1.6)**2));p1=(rr*math.cos(a),y,rr*math.sin(a));p2=(rr*math.cos(a+.11),y,rr*math.sin(a+.11));p3=(rr*.97*math.cos(a+.11),y+.15,rr*.97*math.sin(a+.11));f.line(cam.all([p1,p2,p3]),color(CYAN,.45),1,False)
 center=cam.p((0,.45,1.5));f.text((center[0]/f.s,center[1]/f.s),'ИИ',48,WHITE,True,anchor='mm')
 # A core light source and three orbital trajectories tie the stream to the dome.
 p=cam.p((0,1.52,0));r=36*f.s;f.d.ellipse((p[0]-r,p[1]-r*.3,p[0]+r,p[1]+r*.3),fill=WHITE);f.ld.ellipse((p[0]-r*2,p[1]-r,p[0]+r*2,p[1]+r),fill=CYAN)
 for n in range(3):
  pts=[]
  for a in np.linspace(0,2*PI,100):pts.append((math.cos(a)*2.6,1.7+math.sin(a)*2.4,math.sin(a+n)*.7))
  f.line(cam.all(pts),color((82,126,175),.25),.6,False)
 return cam

def nesting(f,t):
 u=t-5;angle=-.16+.30*u/8;cam=Camera(f.w,f.h,(math.sin(angle)*14,2.8,math.cos(angle)*14),(0,-.35,0),52,.54)
 dims=[(7.6,7.9,3.5),(5.65,5.65,2.65),(3.65,3.45,1.85)]
 for n,(w,h,d) in enumerate(dims):
  y=(h-7.9)/2;v=np.array([[sx*w/2,y+sy*h/2,sz*d/2] for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]])
  # Bottom faces are shaded translucent solid material; edges remain layered.
  sp=cam.all(v);poly=[tuple(sp[k,:2]) for k in [0,1,2,3]];f.d.polygon(poly,fill=(9,26+10*n,42+12*n));active=int(clamp(u/2.4,0,2));cc=WHITE if n==active else CYAN
  for a,b in [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]:f.line([sp[a],sp[b]],color(cc,.95 if n==active else .62),1.9)
  title=['ИСКУССТВЕННЫЙ\nИНТЕЛЛЕКТ','МАШИННОЕ\nОБУЧЕНИЕ','ГЛУБОКОЕ\nОБУЧЕНИЕ'][n];yy=[625,850,1110][n]
  f.text((540,yy),title,32,WHITE if n==active else (115,182,198),True,anchor='mm',spacing=8)
 # Nested model at the centre: signals stay inside the innermost domain.
 rng=np.random.default_rng(88)
 for n in range(90):
  p=(rng.uniform(-1.2,1.2),rng.uniform(-3.2,-1.4),rng.uniform(-.7,.7));px,py,z=cam.p(p);r=(1.1+n%3*.4)*f.s;f.d.ellipse((px-r,py-r,px+r,py+r),fill=color(CYAN,.4+.5*math.sin(u+n)**2))

def label_box(f,x,y,text,width=230,size=30,col=CYAN):
 x*=f.s;y*=f.s;w=width*f.s;hh=62*f.s
 f.d.rounded_rectangle((x-w/2,y-hh/2,x+w/2,y+hh/2),radius=6*f.s,fill=(7,19,30),outline=color(col,.5),width=max(1,round(f.s)))
 f.d.text((x,y),text,font=font(size*f.s,True),fill=col,anchor='mm')

@lru_cache(8)
def scrim(w,h):
 y=np.arange(h)/h;top=np.clip((.30-y)/.12,0,1)*.94;bottom=np.clip((y-.77)/.12,0,1)*.88;a=np.maximum(top,bottom);rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[:,:,:3]=(4,10,18);rgba[:,:,3]=(a[:,None]*255).astype(np.uint8);return Image.fromarray(rgba)

def overlay(f,i,u,t):
 f.im=Image.alpha_composite(f.im.convert('RGBA'),scrim(f.w,f.h)).convert('RGB');f.d=ImageDraw.Draw(f.im)
 titles=[('ВНУТРИ','ИНТЕЛЛЕКТА'),('ИИ, ОБУЧЕНИЕ','И НЕЙРОСЕТИ'),('ВСЁ НАЧИНАЕТСЯ','С ДАННЫХ'),('КАК СЕТЬ','УЧИТСЯ'),('ОТ ВОПРОСА','К ОТВЕТУ'),('СИЛА','ВЫЧИСЛЕНИЙ'),('НЕ МАГИЯ.','МАТЕМАТИКА.')]
 # Stable mobile safe areas, a soft local header scrim, no text over hero objects.
 f.text((108,145),f'{i+1:02d} / 07    ВНУТРИ ИИ',27,(127,168,187))
 appear=smooth(.05,.65,u);offset=(1-appear)*22
 for n,line in enumerate(titles[i]):
  maxw=864*f.s;sz=80
  while ImageDraw.Draw(f.im).textlength(line,font=font(sz*f.s,True))>maxw:sz-=1
  f.text((104,220+n*94+offset),line,sz,color(WHITE if n==0 else CYAN,appear),True)
 cap=''
 if i==0:cap='Связанные вычисления.\nНейроны здесь — визуальная метафора.'
 elif i==1:cap='Машинное обучение — часть ИИ.\nГлубокое обучение — часть машинного.'
 elif i==2:
  cap='Текст, изображения, звук и числа.' if u<3 else 'Подготовка данных\nи цифровые представления для модели.'
  tags=['ТЕКСТ','ИЗОБРАЖЕНИЯ','ЗВУК','ЧИСЛА']
  if u<3.5:
   for n,(x,y) in enumerate([(235,710),(810,760),(245,1080),(825,1160)]):label_box(f,x,y,tags[n],220,27)
  else:label_box(f,540,1400,'ДАННЫЕ → ПОДГОТОВКА → МОДЕЛЬ',820,29)
 elif i==3:
  cap=['1. Предсказание','2. Вычисление ошибки','3. Корректировка весов','4. Повторение процесса'][min(3,int(u/2.75))]+'\nУпрощённая схема обучения.'
  for x,s in [(210,'ВХОД'),(540,'СЛОИ'),(860,'ВЫХОД')]:f.text((x,610),s,27,(143,191,209),anchor='mm')
 elif i==4:
  words=['Как','работает','ИИ','?'];xs=[205,430,655,880]
  for n,(x,word) in enumerate(zip(xs,words)):
   label_box(f,x,610+12*math.sin(u*.6+n),word,190,33,WHITE if int(u*.8)%4==n else CYAN)
   pts=[]
   for q in np.linspace(0,1,28):pts.append(((x*(1-q)+(270+n*160)*q)*f.s,(665+180*q+38*math.sin(q*PI))*f.s))
   f.line(pts,color(CYAN,.15+.22*math.sin(u+n)**2),1.0)
  f.text((540,1270),'ATTENTION · КОНТЕКСТ',27,(151,210,223),anchor='mm')
  answer='ИИ находит закономерности.';count=int(len(answer)*smooth(6.4,8.7,u))
  if count:
   f.d.rounded_rectangle((110*f.s,1350*f.s,970*f.s,1455*f.s),radius=12*f.s,fill=(8,25,38),outline=(53,122,142),width=max(1,round(f.s)))
   f.text((145,1381),answer[:count]+('▌' if u<9.1 else ''),36,WHITE,True)
  cap='Токены → контекст → предсказание.' if u<6.4 else 'Ответ строится последовательно,\nтокен за токеном.'
 elif i==5:
  cap='Процессоры ускоряют вычисления.\nИнтеллект не возникает в чипе сам по себе.'
  app='ПАРАЛЛЕЛЬНЫЕ ВЫЧИСЛЕНИЯ' if u<4 else ['ТЕКСТ','ИЗОБРАЖЕНИЯ','ГОЛОС','КОД'][min(3,int((u-4)/1.5))]
  label_box(f,540,1435,app,780,30,WHITE)
 elif i==6:
  if u<4.5:
   for a,b in [((230,790),(810,790)),((810,790),(540,1160)),((230,1320),(540,1160)),((540,1160),(850,1320))]:
    f.line([f.xy(*a),f.xy(*b)],color(CYAN,.5),1.8)
   for x,y,txt,ww in [(230,790,'ДАННЫЕ',220),(810,790,'ОБУЧЕНИЕ',250),(540,1160,'МОДЕЛЬ',260),(230,1320,'ЗАПРОС',230),(850,1320,'ОТВЕТ',210)]:label_box(f,x,y,txt,ww,29)
  cap='Обучение и использование модели —\nдва разных этапа.' if u<4.5 else 'Данные. Математика.\nОбучение и вычисления.'
 f.text((540,1575),cap,32,(194,217,227),anchor='mm',spacing=14)
 f.text((108,1720),'ПУТЕШЕСТВИЕ ВНУТРИ ИИ',22,(91,133,153))
 f.text((972,1720),f'00:{int(t):02d}',25,(140,177,195),anchor='ra')
 f.d.line([(108*f.s,1770*f.s),((108+864*t/60)*f.s,1770*f.s)],fill=CYAN,width=max(1,round(2*f.s)))

def render(t,w=1080,h=1920):
 i=next((n for n in range(7) if STARTS[n]<=t<STARTS[n+1]),6);u=t-STARTS[i]
 f=Frame(w,h,'chip' if i in [4,5] else 'neurons')
 if i in [0,3]:neurons(f,t,i==3)
 elif i==1:nesting(f,t)
 elif i in [2,6]:particles(f,t,i==6)
 elif i in [4,5]:chip(f,t,i==4)
 f.bloom(.52 if i in [4,5] else .66)
 overlay(f,i,u,t)
 # Purposeful short continuity dips alternate with direct cuts; final resolves to black.
 fade=1-smooth(59.3,60,t)
 if i in [1,3,5]:fade*=.52+.48*smooth(0,.18,u)
 if fade<.999:f.im=Image.blend(Image.new('RGB',(w,h)),f.im,fade)
 return f.im

def frame_job(args):
 a,b,fps,w,h,directory=args
 for n in range(a,b):
  im=render(n/fps,w,h);im.save(Path(directory)/f'{n:05d}.jpg',quality=95,subsampling=0)
  if n%120==0:print(f'frame {n}',flush=True)
 return (a,b)
def render_movie(output,fps=60,w=1080,h=1920,workers=3,start=0,end=60):
 directory=ROOT/'renders'/('frames-'+Path(output).stem);directory.mkdir(parents=True,exist_ok=True)
 first,last=round(start*fps),round(end*fps);chunks=[];stride=120
 for a in range(first,last,stride):chunks.append((a,min(a+stride,last),fps,w,h,str(directory)))
 with ProcessPoolExecutor(max_workers=workers) as pool:
  for a,b in pool.map(frame_job,chunks):print('finished',a,b,flush=True)
 cmd=['ffmpeg','-v','error','-y','-framerate',str(fps),'-start_number',str(first),'-i',str(directory/'%05d.jpg'),'-ss',str(start),'-i',str(ROOT/'assets/master.wav'),'-map','0:v','-map','1:a','-t',str(end-start),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-threads','3','-c:a','aac','-b:a','192k','-r',str(fps),'-movflags','+faststart',str(output)]
 subprocess.run(cmd,check=True);print('READY',output,flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--preview',action='store_true');p.add_argument('--full',action='store_true');p.add_argument('--start',type=float,default=0);p.add_argument('--end',type=float,default=60);p.add_argument('--workers',type=int,default=3);args=p.parse_args()
 if args.stills:
  times=[2.6,9,17.5,26,37.5,46,55];sheet=Image.new('RGB',(280*len(times),498))
  for n,t in enumerate(times):
   im=render(t);im.save(ROOT/f'renders/style-{n+1}.png');sheet.paste(im.resize((280,498)),(n*280,0));print('still',t,flush=True)
  sheet.save(ROOT/'renders/style-board.jpg')
 if args.preview:render_movie(ROOT/'renders/preview-v2.mp4',24,540,960,args.workers,args.start,args.end)
 if args.full:render_movie(ROOT/'renders/inside-ai-v2.mp4',60,1080,1920,args.workers,args.start,args.end)
