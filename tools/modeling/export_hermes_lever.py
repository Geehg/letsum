import bpy,sys,argparse
p=argparse.ArgumentParser();p.add_argument('--blend',required=True);p.add_argument('--output',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=args.blend)
assembly=bpy.data.objects['Carriage_return_assembly'];bpy.ops.object.select_all(action='DESELECT')
assembly.select_set(True)
for o in assembly.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=assembly.children[0]
bpy.ops.export_scene.gltf(filepath=args.output,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_materials='NONE')
print('LEVER_EXPORT_COMPLETE')
