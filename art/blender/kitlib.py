"""Shared helpers for the city kit (ART-02). Runs inside Blender 4.5 LTS (bpy), started by scripts/art-build.mjs.

Conventions (docs/architecture.md "Art pipeline"):
- Blender is Z-up and the front of a piece faces -Y; the glTF exporter turns that into Y-up, facing +z.
- One mesh object per piece, plus a "<name>_LOD1" sibling.
- Corner colour attribute "Color" (linear) -> COLOR_0; point attributes "_TINT" (1 = takes the instance paint)
  and "_AO" (baked ambient occlusion, 0..1) -> _TINT / _AO.
- Nothing random: the same script makes the same file.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# Palette tokens (docs/design_system.md). Wall paint is white here: the instance colour paints it where _TINT = 1.
PAINT = '#FFFFFF'
PAPER = '#F4F1EA'
ASH = '#2A2C33'
MIST = '#C9D3DA'
GLASS = '#1B1F2A'

AO_RAYS = 64
AO_DISTANCE = 0.6
GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hex_code):
    h = hex_code.lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def mix_hex(a, b, t):
    """sRGB mix of two hex colours, t = share of b."""
    ca = [int(a.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02X}' for x, y in zip(ca, cb))


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for block in list(coll):
            coll.remove(block)


def side_matrix(side):
    """Rotation that turns the front side (-Y) into side 0..3 (front, right, back, left)."""
    return Matrix.Rotation(side * math.pi / 2, 4, 'Z')


def _ordered(bm, edges):
    """Edges in index order: a Python set's order follows memory addresses, so bmesh ops fed from a set could
    number the new geometry differently from run to run."""
    bm.edges.index_update()
    return sorted(edges, key=lambda e: e.index)


class Piece:
    """Collects boxes into one bmesh, each with its colour and paint mask, then makes the object."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.color = self.bm.loops.layers.float_color.new('Color')
        self.tint = self.bm.verts.layers.float.new('_TINT')
        self.skip_ao = self.bm.verts.layers.float.new('_SKIP_AO')  # build only: removed before export

    def box(self, center, size, color, tint=False, bevel=0.0, segments=2, only_vertical=False, frame=None, grid=0,
            ao=True):
        """Add a box. `bevel` rounds its edges (all, or only the vertical ones, which is cheaper). `grid` cuts its
        top and bottom into a grid, so a big flat face gets enough vertices for the baked AO (no bevel then).
        `ao=False` leaves it unshaded (AO 1), for big faces too coarse to shade smoothly (LOD1)."""
        before = set(self.bm.faces)
        matrix = (frame or Matrix()) @ Matrix.Translation(Vector(center)) @ Matrix.Diagonal((*size, 1.0))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=matrix)
        faces = [f for f in self.bm.faces if f not in before]
        if grid > 0:
            flat = [e for e in {e for f in faces for e in f.edges}
                    if abs((e.verts[0].co - e.verts[1].co).normalized().z) < 0.01]
            bmesh.ops.subdivide_edges(self.bm, edges=_ordered(self.bm, flat), cuts=grid, use_grid_fill=True)
            faces = [f for f in self.bm.faces if f not in before]
        if bevel > 0:
            edges = {e for f in faces for e in f.edges}
            if only_vertical:
                edges = {e for e in edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.99}
            bmesh.ops.bevel(
                self.bm, geom=_ordered(self.bm, edges), offset=min(bevel, 0.45 * min(size)), offset_type='OFFSET',
                segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True,
            )
            faces = [f for f in self.bm.faces if f not in before]
        self._paint(faces, color, tint)
        if not ao:
            for f in faces:
                for v in f.verts:
                    v[self.skip_ao] = 1.0
        return self

    def cylinder(self, center, radius, height, color, tint=False, segments=10, bevel=0.0, frame=None):
        """Add an upright cylinder standing on `center` (its base). `bevel` rounds the two cap rims."""
        before = set(self.bm.faces)
        matrix = ((frame or Matrix()) @ Matrix.Translation(Vector(center))
                  @ Matrix.Translation((0, 0, height / 2)) @ Matrix.Diagonal((radius, radius, height, 1.0)))
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments,
                              radius1=1.0, radius2=1.0, depth=1.0, matrix=matrix)
        faces = [f for f in self.bm.faces if f not in before]
        if bevel > 0:
            rims = [e for e in {e for f in faces for e in f.edges}
                    if any(len(f.verts) > 4 for f in e.link_faces)]
            bmesh.ops.bevel(self.bm, geom=_ordered(self.bm, rims), offset=min(bevel, 0.45 * min(radius, height)),
                            offset_type='OFFSET', segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
            faces = [f for f in self.bm.faces if f not in before]
        self._paint(faces, color, tint)
        return self

    def _paint(self, faces, color, tint):
        col = rgba(color)
        for f in faces:
            for loop in f.loops:
                loop[self.color] = col
                loop.vert[self.tint] = 1.0 if tint else 0.0

    def _canonical_order(self):
        """Vertices by position, faces by their vertices. Bevel can number what it makes differently from run to
        run (same shape, other order); this keeps the exported file byte-identical. Ties keep insertion order."""
        def pos(v):
            return tuple(round(c, 6) for c in v.co)

        def key(v):  # position, then its neighbours' positions (bevel can leave vertices on the same spot)
            return pos(v), tuple(sorted(pos(e.other_vert(v)) for e in v.link_edges))

        rank = {v: i for i, v in enumerate(sorted(self.bm.verts, key=key))}
        self.bm.verts.sort(key=lambda v: rank[v])  # bmesh sorts by numbers only
        self.bm.verts.index_update()
        # Every face starts at its lowest vertex, so triangulation doesn't depend on where bevel started it.
        # Rebuilt faces keep their colour (one per face, see _paint).
        for face in list(self.bm.faces):
            verts = [loop.vert for loop in face.loops]
            first = min(range(len(verts)), key=lambda k: verts[k].index)
            if first == 0:
                continue
            color = face.loops[0][self.color]
            self.bm.faces.remove(face)
            new = self.bm.faces.new(verts[first:] + verts[:first])
            for loop in new.loops:
                loop[self.color] = color
        rank = {f: i for i, f in enumerate(sorted(self.bm.faces, key=lambda f: tuple(sorted(v.index for v in f.verts))))}
        self.bm.faces.sort(key=lambda f: rank[f])
        self.bm.faces.index_update()

    def finish(self, material, smooth=True, ground=False):
        self._canonical_order()
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.color_attributes.active_color_name = 'Color'
        mesh.color_attributes.render_color_index = mesh.color_attributes.active_color_index
        for poly in mesh.polygons:
            poly.use_smooth = smooth
        if smooth:
            mod = obj.modifiers.new('weighted', 'WEIGHTED_NORMAL')
            mod.mode = 'FACE_AREA'
            mod.keep_sharp = True
        mesh.materials.append(material)
        bake_vertex_ao(obj, ground)
        skip = mesh.attributes['_SKIP_AO']
        ao = mesh.attributes['_AO']
        for i, item in enumerate(skip.data):
            if item.value > 0.5:
                ao.data[i].value = 1.0
        mesh.attributes.remove(skip)
        return obj


def hemisphere(count):
    """Fixed cosine-weighted directions around +Z (Fibonacci spiral), so the AO is deterministic."""
    dirs = []
    for i in range(count):
        u = (i + 0.5) / count
        r = math.sqrt(u)
        phi = i * GOLDEN_ANGLE
        dirs.append(Vector((r * math.cos(phi), r * math.sin(phi), math.sqrt(1 - u))))
    return dirs


def bake_vertex_ao(obj, ground):
    """Ambient occlusion per vertex by ray casting against the piece itself (and the ground plane z = 0).

    A vertex is tested along each of its faces' normals and keeps the least occluded result, so a roof's edge
    stays bright instead of smearing the wall's shadow across the whole roof.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, depsgraph)
    mesh = obj.data
    normals = [[] for _ in mesh.vertices]
    for poly in mesh.polygons:
        for vi in poly.vertices:
            key = tuple(round(c, 3) for c in poly.normal)
            if key not in (tuple(round(c, 3) for c in n) for n in normals[vi]):
                normals[vi].append(poly.normal.copy())
    attr = mesh.attributes.new('_AO', 'FLOAT', 'POINT')
    dirs = hemisphere(AO_RAYS)
    for v in mesh.vertices:
        best = 0.0
        for n in normals[v.index] or [v.normal]:
            best = max(best, _open_sky(bvh, v.co, n.normalized(), dirs, ground))
            if best == 1.0:
                break
        attr.data[v.index].value = round(best, 4)


def _open_sky(bvh, co, n, dirs, ground):
    t = n.orthogonal().normalized()
    b = n.cross(t)
    origin = co + n * 0.003
    hits = 0
    for d in dirs:
        w = t * d.x + b * d.y + n * d.z
        if ground and w.z < -1e-6 and origin.z / -w.z <= AO_DISTANCE:
            hits += 1
        elif bvh.ray_cast(origin, w, AO_DISTANCE)[0] is not None:
            hits += 1
    return 1.0 - hits / len(dirs)


def kit_material():
    """The one material the kit exports with; the browser replaces it."""
    mat = bpy.data.materials.new('kit')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    return mat


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False, export_apply=True, export_yup=True,
        export_attributes=True, export_vertex_color='ACTIVE', export_normals=True, export_texcoords=False,
        export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False,
        export_extras=False,
    )


# ---- Preview renders (review loop: docs/design_system.md "City art") ----

def _socket(sockets, name, kind):
    return next(s for s in sockets if s.name == name and s.type == kind)


def preview_material(paint_hex):
    """Shows what the browser will: COLOR_0, painted where _TINT = 1, darkened by _AO."""
    mat = bpy.data.materials.new('preview')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.8

    def attribute(name):
        node = nodes.new('ShaderNodeAttribute')
        node.attribute_type = 'GEOMETRY'
        node.attribute_name = name
        return node

    def mix(blend):
        node = nodes.new('ShaderNodeMix')
        node.data_type = 'RGBA'
        node.blend_type = blend
        return node

    color, tint, ao = attribute('Color'), attribute('_TINT'), attribute('_AO')
    paint = mix('MIX')
    links.new(tint.outputs['Fac'], _socket(paint.inputs, 'Factor', 'VALUE'))
    _socket(paint.inputs, 'A', 'RGBA').default_value = (1, 1, 1, 1)
    _socket(paint.inputs, 'B', 'RGBA').default_value = rgba(paint_hex)
    painted = mix('MULTIPLY')
    _socket(painted.inputs, 'Factor', 'VALUE').default_value = 1.0
    links.new(color.outputs['Color'], _socket(painted.inputs, 'A', 'RGBA'))
    links.new(_socket(paint.outputs, 'Result', 'RGBA'), _socket(painted.inputs, 'B', 'RGBA'))
    shaded = mix('MULTIPLY')
    _socket(shaded.inputs, 'Factor', 'VALUE').default_value = 1.0
    links.new(_socket(painted.outputs, 'Result', 'RGBA'), _socket(shaded.inputs, 'A', 'RGBA'))
    links.new(ao.outputs['Color'], _socket(shaded.inputs, 'B', 'RGBA'))
    links.new(_socket(shaded.outputs, 'Result', 'RGBA'), bsdf.inputs['Base Color'])
    return mat


def flat_material(name, hex_code):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = rgba(hex_code)
    bsdf.inputs['Roughness'].default_value = 0.95
    return mat


LIGHTING = {
    # elevation / azimuth in degrees (azimuth 0 = from the front, positive = from the right)
    'day': {'sun_elevation': 50, 'sun_azimuth': 35, 'sun_color': '#FFF6E8', 'sun_strength': 3.2,
            'sky': '#4C9BE8', 'sky_strength': 0.9},
    'dusk': {'sun_elevation': 6, 'sun_azimuth': -60, 'sun_color': '#FF9F5A', 'sun_strength': 2.2,
             'sky': '#3A3A78', 'sky_strength': 0.45},
}


def render_previews(pairs, out_dir, paint_hex, stacks=()):
    """Each piece and its LOD1 side by side, then each stack (a whole building: [(piece name, z), ...]),
    from the city camera's angle (south-west, 0.45 rad up, 45° fov)."""
    scene = bpy.context.scene
    mat = preview_material(paint_hex)
    by_name = {obj.name: obj for pair in pairs for obj in pair}
    columns = [[(obj, 0.0)] for pair in pairs for obj in pair]
    for stack in stacks:
        column = []
        for name, z in stack:
            copy = by_name[name].copy()
            scene.collection.objects.link(copy)
            column.append((copy, z))
        columns.append(column)
    spacing = 0.0
    views = {'kit': [], 'building': []}
    for i, column in enumerate(columns):
        width = max(obj.dimensions.x for obj, _ in column)
        for obj, z in column:
            obj.data.materials.clear()
            obj.data.materials.append(mat)
            obj.location = (spacing + width / 2, 0, z)
            views['kit' if i < len(columns) - len(stacks) else 'building'].append(obj)
        spacing += width + 0.8

    bpy.ops.mesh.primitive_plane_add(size=1)
    ground = bpy.context.active_object
    ground.scale = (spacing + 20, 40, 1)
    ground.location = (spacing / 2, 0, -0.001)
    ground.data.materials.append(flat_material('ground', '#B9C1B5'))

    cam_data = bpy.data.cameras.new('preview')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle_y = math.radians(45)
    cam = bpy.data.objects.new('preview', cam_data)
    scene.collection.objects.link(cam)
    elevation, azimuth = 0.45, math.radians(-45)
    direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    scene.camera = cam

    def frame(objs):
        lo = Vector((min(o.location.x - o.dimensions.x / 2 for o in objs), -1.5, 0))
        hi = Vector((max(o.location.x + o.dimensions.x / 2 for o in objs), 1.5,
                     max(o.location.z + o.dimensions.z for o in objs)))
        radius = (hi - lo).length / 2
        cam.location = (lo + hi) / 2 + direction * (radius / math.sin(math.radians(22.5)) * 1.05)
        cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()

    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.angle = math.radians(3)
    sun = bpy.data.objects.new('sun', sun_data)
    scene.collection.objects.link(sun)

    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    scene.world = world
    background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')

    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 32
    scene.render.resolution_x, scene.render.resolution_y = 960, 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'

    written = []
    for name, light in LIGHTING.items():
        el, az = math.radians(light['sun_elevation']), math.radians(light['sun_azimuth'])
        to_sun = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
        sun.rotation_euler = (-to_sun).to_track_quat('-Z', 'Y').to_euler()
        sun_data.color = rgba(light['sun_color'])[:3]
        sun_data.energy = light['sun_strength']
        background.inputs['Color'].default_value = rgba(light['sky'])
        background.inputs['Strength'].default_value = light['sky_strength']
        for view, objs in views.items():
            if not objs:
                continue
            frame(objs)
            path = f'{out_dir}/{view}_{name}.png'
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            written.append(path)
    return written
