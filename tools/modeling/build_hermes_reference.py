"""Hermes 3000 first-series visual reconstruction, not a measured CAD model.
Run Blender -b --factory-startup -P this_file -- --output DIR
Primary observation: Stephen Hanafin's serial 3138796; Paillard manual 3003 B.
Coordinates, microfinish and hidden structure are authored, not factory dimensions.
"""
import bpy, math, json, sys, argparse
from pathlib import Path
from mathutils import Vector
P=argparse.ArgumentParser(); P.add_argument('--output',required=True)
args=P.parse_args(sys.argv[sys.argv.index('--')+1:]); out=Path(args.output); out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'
model=bpy.data.collections.new('Hermes_3000_Reference');scene.collection.children.link(model)
def put(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 model.objects.link(o);return o
def rgb(h):
 vals=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)
def mat(name,h,rough=.3,metal=0,coat=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(h),1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=.18;return m
paint=mat('Sage enamel • photographic appearance','879681',.23,0,.46)
keymat=mat('Mint moulded resin','a8c49a',.19,0,.34)
chrome=mat('Nickel plated steel','828b90',.16,1)
steel=mat('Satin mechanism steel','626969',.34,1)
dark=mat('Blackened mechanism','232a24',.44,.45)
rubber=mat('Platen rubber','171a17',.71)
ink=mat('Dark key legends','26342c',.51)
red=mat('Red ribbon lower band','6b1615',.85)
blackcloth=mat('Black ribbon upper band','161918',.89)
felt=mat('Keyboard felt','1b231c',.95)
# Bake a repeatable micro-normal texture in data space. It encodes surface height,
# not light or dirt; amplitude is an authored appearance setting.
import numpy as np
rng=np.random.default_rng(3138796); n=256;h=rng.normal(0,1,(n,n))
for _ in range(3):h=(h+np.roll(h,1,0)+np.roll(h,-1,0)+np.roll(h,1,1)+np.roll(h,-1,1))/5
h/=max(h.std(),1e-6);dx=(np.roll(h,-1,1)-np.roll(h,1,1))*.055;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*.055
norm=np.stack([-dx,-dy,np.ones_like(h)],axis=-1);norm/=np.linalg.norm(norm,axis=-1)[...,None]
pixels=np.ones((n,n,4),dtype=np.float32);pixels[:,:,:3]=norm*.5+.5
im=bpy.data.images.new('Enamel_micro_normal',n,n,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(out/'hermes-enamel-normal.png');im.file_format='PNG';im.save();im.pack()
for m,strength in [(paint,.36),(keymat,.09)]:
 nodes=m.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.extension='REPEAT';uv=nodes.new('ShaderNodeTexCoord');mp=nodes.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(5,5,5)
 nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength
 links=m.node_tree.links;links.new(uv.outputs['UV'],mp.inputs['Vector']);links.new(mp.outputs['Vector'],tex.inputs['Vector']);links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
# Roughness is data, not a painted highlight: the same finish responds to new light.
# Low-amplitude variations preserve enamel rather than adding invented wear/dirt.
for material,base,variation,scale in [(paint,.235,.027,5),(keymat,.19,.012,5),(chrome,.16,.018,3)]:
 pixels=np.ones((n,n,4),dtype=np.float32);values=np.clip(base+np.tanh(h)*variation,0,1);pixels[:,:,:3]=values[:,:,None]
 rough=bpy.data.images.new(material.name+' micro roughness',n,n,alpha=True);rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(pixels.ravel());rough.filepath_raw=str(out/(material.name.split()[0]+'-roughness.png'));rough.file_format='PNG';rough.save();rough.pack()
 nodes=material.node_tree.nodes;links=material.node_tree.links
 tex=nodes.new('ShaderNodeTexImage');tex.image=rough;tex.extension='REPEAT'
 uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(scale,scale,scale)
 links.new(uv.outputs['UV'],mapping.inputs['Vector']);links.new(mapping.outputs['Vector'],tex.inputs['Vector']);links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Roughness'])
def mesh(name,v,f,m,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);model.objects.link(o);me.materials.append(m)
 for p in me.polygons:p.use_smooth=smooth
 uv=me.uv_layers.new(name='SurfaceUV')
 for p in me.polygons:
  axis=max(range(3),key=lambda a:abs(p.normal[a]));axes=[i for i in range(3) if i!=axis]
  for li in p.loop_indices:
   co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]*3,co[axes[1]]*3)
 return o
def bevel(o,w=.001,segments=4):
 mod=o.modifiers.new('Edge radii','BEVEL');mod.width=w;mod.segments=segments
 mod=o.modifiers.new('Corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 return o
def cube(name,loc,size,m,r=.001):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=put(bpy.context.object);o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if r:bevel(o,r,5)
 return o
def cylinder(name,loc,r,depth,m,axis='Z',verts=64):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=put(bpy.context.object);o.name=name
 if axis=='X':o.rotation_euler.y=math.pi/2
 if axis=='Y':o.rotation_euler.x=math.pi/2
 o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 bevel(o,min(.00045,depth*.12),3);return o
def tube(name,points,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=16;c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,co in zip(s.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(name,c);model.objects.link(o);o.data.materials.append(m);return o
def rounded(w,d,r,cy=0,N=16):
 pts=[]
 for cx,yy,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(N):
   t=math.radians(a+i*90/N);pts.append((cx+r*math.cos(t),yy+cy+r*math.sin(t)))
 dense=[]
 for i,a in enumerate(pts):
  b=pts[(i+1)%len(pts)];steps=max(1,math.ceil(math.dist(a,b)/.003))
  for j in range(steps):dense.append((a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps))
 return dense
def loft(name,rings,m,cap=False):
 N=len(rings[0]);v=[p for r in rings for p in r];f=[]
 for j in range(len(rings)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 if cap:f.extend([tuple(reversed(range(N))),tuple((len(rings)-1)*N+i for i in range(N))])
 return mesh(name,v,f,m)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def profile(y):
 knots=[(-.155,.038),(-.12,.044),(-.075,.061),(-.025,.086),(.025,.116),(.060,.124),(.095,.125),(.118,.081),(.141,.058)]
 for (a,h),(b,k) in zip(knots,knots[1:]):
  if y<=b:return h+(k-h)*smooth((y-a)/(b-a))
 return knots[-1][1]
# Hollow perimeter: rising rounded shoulders, rolled lower skirt and inset key well.
outer=rounded(.348,.302,.027,cy=-.006)
inner=rounded(.300,.103,.017,cy=-.0865)
rings=[]
for scale,zoff,kind in [(1,.014,'flat'),(1.005,.019,'flat'),(1.005,.030,'flat'),(1,.036,'flat'),(.994,-.010,'top'),(.98,-.003,'top'),(.955,0,'top')]:
 rings.append([(x*scale,(y+.006)*scale-.006,zoff if kind=='flat' else max(.036,profile((y+.006)*scale-.006)+zoff)) for x,y in outer])

body=loft('Cast_shell_continuous',rings,paint);body['evidence']='3138796 overview and left profile: arching shoulder, lowered carriage saddle, rounded lower skirt'

# Uniformly tessellated top shoulder follows the side profile everywhere; a
# single long quad from rear saddle to keyboard would make an artificial ramp.
from mathutils.geometry import delaunay_2d_cdt
outertop=[(x*.955,(y+.006)*.955-.006) for x,y in outer]
hoodseat=rounded(.306,.120,.016,cy=.059,N=24)
coords=[Vector(p) for p in outertop+inner+hoodseat];N=len(outertop);M=len(inner);H=len(hoodseat)
edges=[(i,(i+1)%N) for i in range(N)]+[(N+i,N+(i+1)%M) for i in range(M)]+[(N+M+i,N+M+(i+1)%H) for i in range(H)]
for i in range(1,70):
 for j in range(1,66):coords.append(Vector((-.174+i*.348/70,-.157+j*.302/66)))
def inside(p,poly):
 x,y=p;hit=False
 for i,(a,b) in enumerate(poly):
  c,d=poly[i-1]
  if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
 return hit
cv,ce,cf,_,_,_=delaunay_2d_cdt(coords,edges,[],0,1e-8)
f=[tuple(face) for face in cf if inside(tuple(sum(cv[i][a] for i in face)/len(face) for a in range(2)),outertop) and not inside(tuple(sum(cv[i][a] for i in face)/len(face) for a in range(2)),inner)]
f=[face for face in f if not inside(tuple(sum(cv[i][a] for i in face)/len(face) for a in range(2)),hoodseat)]
mesh('Continuous_shoulder_deck',[(p.x,p.y,profile(p.y)) for p in cv],f,paint)
loft('Keyboard_inner_wall',[[(x,y,profile(y)) for x,y in inner],[(x*.99,y,.025) for x,y in inner]],paint)

# Weld sidewall and deck at their shared boundary for continuous reflections.
bpy.ops.object.select_all(action='DESELECT')
for name in ['Cast_shell_continuous','Continuous_shoulder_deck','Keyboard_inner_wall']:bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
# Underside and actual perimeter seam, no painted white stroke.
base=loft('Bottom_pan', [[(x*.998,y,.012) for x,y in outer],[(x*.998,y,.014) for x,y in outer]],steel,True)
tube('Lower_case_separation',[(x*1.002,y,.0155) for x,y in outer]+[(outer[0][0]*1.002,outer[0][1],.0155)],.00048,dark)
for x in [-.135,.135]:
 for y in [-.115,.104]:cylinder('Rubber_foot', (x,y,.008),.013,.011,rubber)
cube('Key_well_felt',(0,-.077,.030),(.300,.134,.004),felt,.009)
# Ribbon hood: continuous moulded surface with a real inner opening. A mesh
# constrained triangulation keeps the opening before the surface bends.
def bez(a,b,c,d,N=20):
 return [tuple((1-t)**3*a[j]+3*(1-t)**2*t*b[j]+3*(1-t)*t*t*c[j]+t**3*d[j] for j in range(2)) for t in [i/N for i in range(N)]]
outline=[]
for seg in [((-.019,.116),(-.020,.101),(-.021,.087),(-.029,.084)),((-.029,.084),(-.047,.078),(-.073,.080),(-.094,.069)),((-.094,.069),(-.107,.066),(-.107,.055),(-.094,.057)),((-.094,.057),(-.060,.040),(.060,.040),(.094,.057)),((.094,.057),(.107,.055),(.107,.066),(.094,.069)),((.094,.069),(.073,.080),(.047,.078),(.029,.084)),((.029,.084),(.021,.087),(.020,.101),(.019,.116)),((.019,.116),(.012,.118),(-.012,.118),(-.019,.116))]:outline+=bez(*seg)
# Use a 2-D filled curve with a hole, then remesh planar faces to a regular
# triangulation. Boundary is sampled densely; normal derives from surface slope.
from mathutils.geometry import tessellate_polygon
outerhood=rounded(.316,.126,.018,cy=.059,N=24)
# Constrained planar triangulation: Blender's CDT retains boundary curves and holes.
from mathutils.geometry import delaunay_2d_cdt
coords=[Vector(p) for p in outerhood+outline]
N=len(outerhood);M=len(outline);edges=[(i,(i+1)%N) for i in range(N)]+[(N+i,N+(i+1)%M) for i in range(M)]
# Add interior samples to avoid long warped triangles.
for i in range(1,64):
 for j in range(1,34):coords.append(Vector((-.158+i*.316/64,-.004+j*.126/34)))
cv,ce,cf,_,_,_=delaunay_2d_cdt(coords,edges,[],0,1e-8)
def inside(p,poly):
 x,y=p;hit=False
 for i,(a,b) in enumerate(poly):
  c,d=poly[i-1]
  if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
 return hit
def coverz(x,y):
 # Broad front apron easing into the horizontal spool wings.
 t=(y+.004)/.060
 return .105+.024*smooth(t)+.007*(1-(abs(x)/.161)**6)-.004*smooth((y-.096)/.023)
v=[(p.x,p.y,coverz(p.x,p.y)) for p in cv]
f=[tuple(face) for face in cf if inside(tuple(sum(cv[i][a] for i in face)/len(face) for a in range(2)),outerhood) and not inside(tuple(sum(cv[i][a] for i in face)/len(face) for a in range(2)),outline)]
hood=mesh('Ribbon_Hood',v,f,paint);sol=hood.modifiers.new('Pressed metal thickness','SOLIDIFY');sol.thickness=.0014;sol.offset=-1;bevel(hood,.0008,4)
hood['evidence']='Paillard components 6,8,38; Hanafin 3138796 overview: separated inward wings and broad crescent'
# Rolled outer apron seats the removable cover above the case, with a lower
# front return rather than a paper-thin floating edge.
rings=[]
for step in [0,.16,.65,1]:
 ring=[]
 for x,y in outerhood:
  drop=max(.0015,coverz(x,y)-profile(y)+.0012)
  ring.append((x*(1-.002*step),y+.0008*step,coverz(x,y)-drop*step))
 rings.append(ring)
loft('Hood_outer_return',rings,paint)
# Inner lip has rounded top edge and a short dark underside, not a raised rim.
loft('Opening_folded_lip', [[(x,y,coverz(x,y)-d) for x,y in outline] for d in [.0005,.003,.0045]],paint)
# Separate edge joint around removable hood.
tube('Hood_separation',[(x,y,coverz(x,y)-.0019) for x,y in outerhood]+[(outerhood[0][0],outerhood[0][1],coverz(*outerhood[0])-.0019)],.00045,dark)
# Visible inclined segment and individually spaced typebars. Count is a visual
# sampling of the basket, not a claim about the internal mechanism.
for i in range(45):
 a=-1.30+i*2.60/44
 pts=[]
 for j in range(12):
  t=j/11;r=.030+.078*t;pts.append((math.sin(a)*r,.100-math.cos(a)*r*.70,.124-.013*t+.004*t*t))
 tube('Typebar_%02d'%i,pts,.00052,steel)
 cube('Type_slug_%02d'%i,pts[0],(.0017,.004,.0034),steel,.0003)
for r in [.106,.110]:tube('Segment_arc',[(math.sin(a)*r,.100-math.cos(a)*r*.70,.114) for a in np.linspace(-1.35,1.35,96)],.0011,dark)
# Two real ribbon spools, largely hidden by the closed hood wings.
for s in [-1,1]:
 for z in [.116,.123]:cylinder('Ribbon_spool_flange',(s*.073,.087,z),.029,.0015,dark)
 cylinder('Ribbon_spool_fabric',(s*.073,.087,.1195),.026,.006,blackcloth)
 cylinder('Ribbon_spool_hub',(s*.073,.087,.125),.005,.003,steel)
for z,m in [(.129,red),(.135,blackcloth)]:
 points=[(-.075,.111,z),(-.031,.101,z),(-.012,.102,z),(.012,.102,z),(.031,.101,z),(.075,.111,z)]
 vv=[]
 for x,y,zz in points:vv.extend([(x,y,zz-.003),(x,y,zz+.003)])
 mesh('Ribbon_'+m.name,vv,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(points)-1)],m)
# Shaped type guide, side fingers and central fork.
shield=[]
for a in np.linspace(math.pi,2*math.pi,48):shield.append((math.cos(a)*.023,.095+math.sin(a)*.020,.128))
shield +=[(.017,.101,.132),(-.017,.101,.132)]
sh=mesh('Type_guide_shield',shield,[tuple(range(len(shield)))],steel);mod=sh.modifiers.new('Plate thickness','SOLIDIFY');mod.thickness=.0008;bevel(sh,.0005,3)
for x in [-.006,.006]:cube('Type_guide_fork',(x,.101,.141),(.003,.002,.017),chrome,.0008)
# Carriage assembly.
car=bpy.data.objects.new('Carriage',None);model.objects.link(car)
def incar(o):o.parent=car;return o
incar(cylinder('Platen',(0,.127,.149),.014,.323,rubber,'X',96))
incar(cube('Paper_table',(0,.147,.152),(.324,.007,.040),paint,.004))
for z in [.127,.130]:incar(cylinder('Carriage_rail',(0,.133,z),.0022,.340,chrome,'X'))
for s in [-1,1]:
 # Each end has a separate saddle, outer cheek and protruding platen knob.
 cheek_profile=[(.080,.142),(.093,.169),(.151,.174),(.160,.164),(.157,.101),(.146,.094),(.135,.095),(.133,.086),(.120,.086),(.114,.104),(.092,.107),(.084,.116)]
 rings=[[(s*.164+dx,y,z) for y,z in cheek_profile] for dx in [-.003,.003]]
 cheek=loft('Carriage_cheek',rings,paint,True);bevel(cheek,.003,6);incar(cheek)
 incar(cylinder('Knob_collar',(s*.174,.127,.149),.014,.005,steel,'X'))
 knob=incar(cylinder('Platen_knob',(s*.181,.127,.149),.018,.012,keymat,'X',96))
 for i in range(72):
  a=i*math.tau/72;incar(tube('Knob_fluting',[(s*.177,.127+math.sin(a)*.018,.149+math.cos(a)*.018),(s*.186,.127+math.sin(a)*.018,.149+math.cos(a)*.018)],.00025,keymat))
 incar(cube('Bail_end_arm',(s*.164,.105,.155),(.003,.032,.004),chrome,.001))
incar(cube('Carriage_bearing_crossmember',(0,.134,.090),(.317,.023,.008),dark,.002))
for x in [-.150,.150]:incar(cube('Carriage_bearing_upright',(x,.129,.120),(.007,.015,.052),steel,.002))
incar(cylinder('Paper_bail',(0,.102,.159),.0021,.330,chrome,'X'))
incar(cube('Margin_scale_back',(0,.100,.157),(.317,.003,.006),chrome,.0008))
for s in [-1,1]:incar(cube('Visible_margin_band',(s*.117,.098,.157),(.073,.0005,.0035),red,.0001))
for i in range(91):
 x=-.153+i*.306/90;incar(cube('Scale_tick',(x,.09755,.157),(.0003,.0003,.0028 if i%10==0 else .0014),ink,.00005))
for x in [-.082,.082]:incar(cylinder('Paper_bail_roller',(x,.102,.159),.0043,.015,rubber,'X'))
for x in [-.078,.078]:incar(cube('Paper_support',(x,.155,.190),(.005,.002,.074),steel,.0008))
# Clear card holders are separate from the moving carriage.
clear=mat('Transparent card holders','d6e2da',.16);p=clear.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.85;p.inputs['Alpha'].default_value=.23;clear.surface_render_method='DITHERED';p.inputs['IOR'].default_value=1.48
for s in [-1,1]:
 o=cube('Card_holder',(s*.035,.099,.145),(.044,.001,.017),clear,.002);o.rotation_euler.x=math.radians(-16)
 for i in range(9):cube('Card_graduation',(s*.020+s*i*.0035,.098,.146),(.00025,.0003,.002 if i%2 else .0032),steel,.00008)
# Return lever, observed from serial 3138796 front and left-side photographs.
# One continuous metal surface: rising shank -> rounded crest -> downward paddle.
# Coordinates are visual authoring values, not measurements or hidden kinematics.
assembly=bpy.data.objects.new('Carriage_return_assembly',None);model.objects.link(assembly);incar(assembly)
def inlever(o):o.parent=assembly;return o
segments=[
 [(-.168,.130,.174),(-.185,.121,.180),(-.216,.081,.198),(-.229,.061,.201)],
 [(-.229,.061,.201),(-.2342,.053,.2022),(-.238,.047,.199),(-.241,.039,.193)],
 [(-.241,.039,.193),(-.247,.023,.181),(-.252,.004,.162),(-.252,-.003,.158)]]
def lever_point(segment,t):
 a,b,c,d=[Vector(v) for v in segment]
 p=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
 tangent=(3*(1-t)**2*(b-a)+6*(1-t)*t*(c-b)+3*t*t*(d-c)).normalized()
 return p,tangent
rings=[];longitudinal=[]
for si,segment in enumerate(segments):
 count=[72,40,72][si]
 for j in range(count+1):
  if si and j==0:continue
  t=j/count;p,tangent=lever_point(segment,t)
  # Stable broad face across the handle, with a rounded, thin metal edge.
  side=Vector((1,0,0));side=(side-tangent*side.dot(tangent)).normalized();normal=tangent.cross(side).normalized()
  # Photo side view shows the broad grip, not its edge: progressively turn the
  # flattened face outward through the neck, retaining a smooth untwisted root.
  twist=math.radians(35)*smooth((si+t-.65)/1.0)
  side,normal=side*math.cos(twist)+normal*math.sin(twist),normal*math.cos(twist)-side*math.sin(twist)
  if si==0:width=.0027+.0006*smooth(t);thickness=.0018-.0003*smooth(t)
  elif si==1:width=.0033+.0042*smooth(t);thickness=.0015-.00045*smooth(t)
  else:
   width=.0075+.0045*smooth(min(1,t/.65))
   if t>.82:width*=math.sqrt(max(.000001,1-((t-.82)/.18)**2))
   thickness=.00105
   if t>.94:thickness*=math.sqrt(max(.000001,1-((t-.94)/.06)**2))
  ring=[]
  for k in range(48):
   angle=k*math.tau/48;u=math.cos(angle)*width
   # Very shallow finger dish, no separately overlapping spoon or seam.
   dish=(si+t)/3*.00028*(u/max(width,1e-8))**2
   ring.append(tuple(p+side*u+normal*(math.sin(angle)*thickness+dish)))
  rings.append(ring);longitudinal.append(si+t)
lever=loft('Return_lever',rings,chrome,True);inlever(lever)
lever['evidence']='3138796 overview and left profile: rising shaft, rounded elbow, broadened downward grip; visible mounting bracket only'
lever['construction']='Single continuous closed sweep; no overlapping paddle. Hidden return/line-space mechanism not reconstructed.'
# Use continuous surface UVs along the metal instead of face-axis projection.
uv=lever.data.uv_layers.active
for polygon in lever.data.polygons:
 for li in polygon.loop_indices:
  vi=lever.data.loops[li].vertex_index;ri,ki=divmod(vi,48);uv.data[li].uv=(ki/48,longitudinal[ri]/3)
# Visible mounting envelope: folded support, dark joint gap and domed fastener.
# No invented teeth, springs, screw slots, or exact pivot mechanism.
mount=inlever(cube('Return_mount_foot',(-.164,.130,.171),(.014,.018,.003),steel,.001))
mount=inlever(cube('Return_mount_fold',(-.169,.135,.175),(.004,.012,.009),chrome,.001))
inlever(cylinder('Return_joint_washer',(-.167,.130,.176),.0043,.0012,dark))
inlever(cylinder('Return_visible_fastener',(-.167,.130,.177),.0034,.0018,chrome))
# Keycaps: rounded-square footprint, curved sides, shallow concave finger dish.
# Labels and row positions follow the photographed US keyboard, including the
# absent numeric 1 and separated function keys (manual allows TAB/backspace swap).
def label(name,text,x,y,z,size=.008,m=ink):
 c=bpy.data.curves.new(name,'FONT');c.body=text;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.000025;c.resolution_u=6
 o=bpy.data.objects.new(name,c);model.objects.link(o);o.location=(x,y,z);o.data.materials.append(m);return o
def cap(name,x,y,z,w=.0185,d=.019,text='',code=None):
 pts=rounded(w,d,min(w,d)*.30,N=10);rings=[]
 for scale,dz in [(.91,-.012),(1,-.009),(1,.001),(.96,.003),(.88,.004)]:rings.append([(u*scale,v*scale,dz) for u,v in pts])
 for scale in [.72,.5,.25,.02]:rings.append([(u*scale,v*scale,.0021+.0019*scale*scale) for u,v in pts])
 o=loft('Key_'+name,rings,keymat,True);o.location=(x,y,z);o['key_code']=code or name;o['evidence']='3138796 keyboard photo'
 stem=cube('Stem_'+name,(0,0,-.018),(.003,.003,.014),steel,.0005);stem.parent=o
 if text:
  txt=label('Legend_'+name,text,0,0,.0027,.0068 if len(text)<3 else .0048);txt.parent=o
 return o
rows=[(['2','3','4','5','6','7','8','9','0','-','='],-.044,.090,-.114),(['Q','W','E','R','T','Y','U','I','O','P','¼','¾'],-.068,.077,-.125),(['A','S','D','F','G','H','J','K','L',';','@'],-.091,.064,-.114),(['Z','X','C','V','B','N','M',',','.','/'],-.115,.051,-.103)]
# Eleven keys in the number row; there is no numeric 1 on this photographed keyboard.
for row,(labels,y,z,x0) in enumerate(rows):
 for i,t in enumerate(labels):cap('R%d_%02d'%(row,i),x0+i*.0227,y,z,text=t,code=('Key'+t if t.isalpha() else 'Digit'+t if t.isdigit() else t))
cap('ShiftLeft',-.145,-.115,.051,.024,.023,code='ShiftLeft');cap('ShiftRight',.145,-.115,.051,.024,.023,code='ShiftRight');cap('ShiftLock',-.145,-.091,.064,.018,.020,'↓','CapsLock')
for name,x,t in [('Backspace',-.137,'↶'),('TabSet',-.061,'+'),('TabClear',-.022,'−'),('TabClearAll',.017,'···'),('MarginRelease',.056,'↔'),('Tab',.137,'TAB')]:cap(name,x,-.023,.100,.024,.020,t,name)
space=cap('Space',0,-.142,.049,.255,.018,'','Space')
# Switch slots, metal sliders and enamel-colour marks photographed on the apron.
for s in [-1,1]:
 y=.013;x=s*.146;z=coverz(x,y)
 slot=cube('Selector_slot',(x,y-.0005,z+.0005),(.0025,.026,.0015),dark,.0012);slot.rotation_euler.x=math.radians(27)
 slider=cube('Selector_slider',(x,y-.003,z+.003),(.0018,.012,.003),chrome,.0007);slider.rotation_euler.x=math.radians(27)
for i,color in enumerate(['d3d6ca','347fa3','d4ae30','a41e1b']):
 mm=mat('Selector_mark_'+str(i),color,.32)
 cylinder('Ribbon_colour_dot',(.139,.029-i*.006,coverz(.139,.029-i*.006)+.002),.0013,.0007,mm)
# The generated logo is a visual asset, not claimed to be an original scan.
badge_z=coverz(0,.021)+.0018
badge=cube('Badge_backing',(0,.021,badge_z),(.091,.012,.0012),mat('Badge inset','687567',.32,.35),.0006)
badge.rotation_euler.x=math.radians(30)
framepts=rounded(.091,.012,.0015)
frame=tube('Badge_nickel_border',[(x,y,0) for x,y in framepts]+[(framepts[0][0],framepts[0][1],0)],.00045,chrome);frame.location=(0,.021,badge_z+.0007);frame.rotation_euler.x=math.radians(30)
badge_im=bpy.data.images.load(str(repo/'html/img/typewriters/badges/hermes3000-v1.png'));badge_im.pack()
badge_mat=mat('Reference emblem image','ffffff',.38,.15);bs=badge_mat.node_tree.nodes.get('Principled BSDF');tex=badge_mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=badge_im;badge_mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);badge_mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha']);badge_mat.surface_render_method='DITHERED'
logo=mesh('Reference_emblem',[(-.044,-.0067,0),(.044,-.0067,0),(.044,.0067,0),(-.044,.0067,0)],[(0,1,2,3)],badge_mat,False)
logo.location=(0,.021,badge_z+.0015);logo.rotation_euler.x=math.radians(30)
uv=logo.data.uv_layers.active
for i,co in enumerate([(32/2172,1-515/724),(2141/2172,1-515/724),(2141/2172,1-193/724),(32/2172,1-193/724)]):uv.data[i].uv=co
# Small inset rectangular front latches, visible in the original photograph.
for x in [-.134,.134]:cube('Front_case_latch',(x,-.145,.036),(.013,.006,.002),chrome,.001)
# Ensure all generated parts have explicit source/method metadata.
for o in model.objects:o['reconstruction']='Photographic visual reconstruction; dimensions are authored, not measured'
# Preserve material micro-normal in GLB (procedural normal was written to PNG).
# Convert curves and apply modifiers for interoperable glTF, while saving editable
# source first. Hide floor and studio from the exported selection.
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.world.color=(.15,.15,.15);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.28,.28,.28,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.35
scene.view_settings.view_transform='AgX'
def area(name,loc,power,size,target=(0,0,.07),size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size_y or size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Window',(-.4,-.35,.65),15,.30,size_y=.65);area('Soft fill',(.45,-.12,.35),1.5,.28,size_y=.5);area('Rear strip',(0,.4,.45),8,.42,size_y=.08)
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio_floor';floor.data.materials.append(mat('Warm studio','c3baab',.87));floor.location.z=0
bpy.ops.object.camera_add(location=(.37,-.56,.34));cam=bpy.context.object;cam.name='Review_camera';cam.rotation_euler=(Vector((0,0,.080))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.55;scene.camera=cam
scene.render.resolution_x=1500;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(out/'hermes3000-reference.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in model.objects:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.convert(target='MESH')
# Conversion deselects empties; include the carriage parent in the GLB hierarchy.
for o in model.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'hermes3000-reference.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
scene.render.filepath=str(out/'hermes3000-reference.png');bpy.ops.render.render(write_still=True)
manifest={'model':'Hermes 3000, first-series visual reconstruction','reference_serial':'3138796','reference_url':'https://typewriterdatabase.com/1962-hermes-3000.17953.typewriter','manual':'https://site.xavier.edu/polt/typewriters/Hermes3000.pdf','accuracy':'Photo-derived appearance, not measured CAD. No hidden mechanism accuracy claimed. Generated badge is not original artwork.','objects':len(model.objects),'keys':sum(o.name.startswith('Key_') and o.get('key_code') is not None for o in model.objects),'blender':bpy.app.version_string}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('REFERENCE_BUILD_COMPLETE',json.dumps(manifest))
