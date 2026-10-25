"""Refine the v11 cover without changing articulated nodes. Photo-proportioned, not measured CAD.
Usage: python3 refine_hermes_hood.py original-v11.glb output.glb
"""
import json, math, struct, sys
from pathlib import Path
src,dest=map(Path,sys.argv[1:]);raw=src.read_bytes();jslen=struct.unpack_from('<I',raw,12)[0]
g=json.loads(raw[20:20+jslen]);start=20+jslen;blen=struct.unpack_from('<I',raw,start)[0];data=bytearray(raw[start+8:start+8+blen])
root=next(n for n in g['nodes'] if n.get('name')=='TYPEWRITER_ROOT')
assert not root.get('extras',{}).get('hood_revision'), 'Use an unmodified v11 source, not a repeated deformation.'
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def shape(p):
 x,y,z=p;side=max(0,1-(abs(x)/.214)**2)
 # Inward swept shoulders narrow the opening while preserving the outer width.
 xx=x*(1-.20*side*smooth(.025,.065,-z))
 # Taller domed cover; the mounting skirt and front lower edge stay seated.
 yy=y+.030*smooth(.103,.144,y)
 # Extend the front apron over the basket, retaining the rear strike throat.
 zz=z-.019*side*smooth(.025,.047,-z)*math.exp(-((z+.058)/.037)**2)
 return (xx,yy,zz)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def normal(p,n):
 h=1e-6;cols=[]
 for axis in range(3):
  a=list(p);b=list(p);a[axis]+=h;b[axis]-=h
  a=shape(a);b=shape(b);cols.append(tuple((x-y)/(2*h) for x,y in zip(a,b)))
 c=[cross(cols[1],cols[2]),cross(cols[2],cols[0]),cross(cols[0],cols[1])]
 out=[sum(c[j][i]*n[j] for j in range(3)) for i in range(3)];l=math.sqrt(sum(x*x for x in out));return tuple(x/l for x in out)
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];assert a['componentType']==5126
 return a,v.get('byteOffset',0)+a.get('byteOffset',0),v.get('byteStride',12)
hood=next(n for n in g['nodes'] if n.get('name')=='Ribbon_Hood')
for pr in g['meshes'][hood['mesh']]['primitives']:
 a,offset,stride=accessor(pr['attributes']['POSITION']);na,no,ns=accessor(pr['attributes']['NORMAL']);points=[]
 for i in range(a['count']):
  p=struct.unpack_from('<3f',data,offset+i*stride);n=struct.unpack_from('<3f',data,no+i*ns);q=shape(p);points.append(q)
  struct.pack_into('<3f',data,offset+i*stride,*q);struct.pack_into('<3f',data,no+i*ns,*normal(p,n))
 a['min']=[min(p[i] for p in points) for i in range(3)];a['max']=[max(p[i] for p in points) for i in range(3)]
for n in g['nodes']:
 if n.get('name','').startswith(('Badge_','Hermes_Badge','Selector_','Ribbon_Dot')) and 'translation'in n:
  # Keep rigid metal labels and controls on the raised front face.
  p=n['translation'];q=shape(p);n['translation']=[p[0],q[1],p[2]]
hood.setdefault('extras',{})['construction']='Raised convex crown, inward shoulders, extended front apron; topology and strike throat retained. Photo-derived authoring values.'
root.setdefault('extras',{})['hood_revision']=12
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);data+=b'\0'*((-len(data))%4)
out=struct.pack('<III',0x46546c67,2,28+len(j)+len(data))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(data),0x004e4942)+data
dest.write_bytes(out);print('Refined hood:',a['min'],a['max'],'bytes',len(out))
