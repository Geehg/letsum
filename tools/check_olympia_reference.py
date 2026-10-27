"""Check exported reference model integrity and part hierarchy and keyboard topology."""
import json,math,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'html/img/typewriters/reference/olympiasm3-reference.glb'
b=p.read_bytes();magic,version,size=struct.unpack_from('<III',b)
assert magic==0x46546c67 and version==2 and size==len(b)
jlen,jtype=struct.unpack_from('<II',b,12);assert jtype==0x4e4f534a
g=json.loads(b[20:20+jlen]);offset=20+jlen;blen,btype=struct.unpack_from('<II',b,offset);assert btype==0x004e4942
binary=b[offset+8:offset+8+blen]
keys=[n for n in g['nodes'] if n.get('extras',{}).get('key_code')]
assert len(keys)==51,len(keys)
char=[n for n in keys if any(n['name'].startswith('Key_R'+str(i)+'_') for i in range(4))];assert len(char)==44
assert all(n['extras']['key_code'] not in ['ControlLeft','MetaLeft','AltLeft','Digit1'] for n in keys)
rows=[[n for n in char if n['name'].startswith('Key_R'+str(i)+'_')] for i in range(4)]
assert [len(r) for r in rows]==[11,12,11,10]
assert len([n for n in g['nodes'] if n['name']=='Carriage'])==1
names={n['name'] for n in g['nodes']}
for name in ['Ribbon_Hood','Hood_outer_return','Opening_folded_lip','Cast_shell_continuous','Platen','Paper_bail','Return_lever','Return_mount_foot','Return_mount_fold','Return_visible_fastener','Lower_chrome_band','Hood_chrome_band','Underframe_crossmember','Reference_emblem']:assert name in names,name
assert all('uri' not in i for i in g['images']),'model textures must be self-contained'
normal_mats=[m for m in g['materials'] if 'normalTexture' in m];assert len(normal_mats)>=2
# The exported GLB must preserve the finish, not rely on Blender-only nodes.
for prefix in ['Green crinkle enamel','Deep green moulded keys','Nickel plated steel']:
 material=next(m for m in g['materials'] if m['name'].startswith(prefix))
 assert 'metallicRoughnessTexture' in material['pbrMetallicRoughness'],prefix
 texture=material['pbrMetallicRoughness']['metallicRoughnessTexture']
 assert 'KHR_texture_transform' in texture.get('extensions',{}),prefix
for material in normal_mats:
 assert material['normalTexture'].get('extensions',{}).get('KHR_texture_transform',{}).get('scale')==[5,5]

for a in g['accessors']:
 if a['componentType']!=5126:continue
 v=g['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',components*4)
 for i in range(a['count']):assert all(math.isfinite(x) for x in struct.unpack_from('<'+'f'*components,binary,start+i*stride))
assert 'Key_RightRed' not in names
assert 'Bottom_pan' not in names and 'Key_well_metal' not in names,'photographed open lower frame must remain open'
assert len([n for n in names if n.startswith('Key_linkage_')])==44
print(json.dumps({'passed':True,'character_keys':len(char),'total_keys':len(keys),'embedded_images':len(g['images']),'meshes':len(g['meshes']),'bytes':len(b)}))
