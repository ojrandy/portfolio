"""Kit pieces. Each builder returns (lod0, lod1) objects named "<piece>" and "<piece>_LOD1".

ART-03: the medium width (w3) only: a ground floor, two middle floors and a flat roof with clutter.
Sizes match src/lib/buildings.js: FLOOR_HEIGHT 0.6, footprints 1.6 / 2.2 / 3.0 with 2 / 3 / 4 window columns.
Window openings must match KIT in src/lib/buildings.js (the lit panes are drawn there, on the glass plane).
"""
from mathutils import Matrix

from kitlib import ASH, GLASS, MIST, PAINT, PAPER, Piece, mix_hex, side_matrix

FLOOR_HEIGHT = 0.6
WINDOW_WIDTH = 0.42
CORNER = 0.25  # corner column width
SILL_TOP = 0.16  # top of the band below the windows
LINTEL = 0.44  # bottom of the band above the windows
INSET = 0.03  # glass set back from the wall face
TRIM = 0.05  # paper band between floors, on top of each floor
WALL_TOP = FLOOR_HEIGHT - TRIM / 2  # walls stop inside the trim, so the trim's top is the only top face
ROOF_DECK = 0.03  # the roof's walkable surface above the roof piece's base (crane, beacon and flag stand on it)

CONCRETE = mix_hex(PAPER, ASH, 0.3)
ZINC = mix_hex(MIST, ASH, 0.3)
DOOR = mix_hex(ASH, '#15161A', 0.4)
POLYTANK = '#1E2024'


def window_centres(size, columns):
    gap = (size - 2 * CORNER - columns * WINDOW_WIDTH) / (columns - 1)
    first = -size / 2 + CORNER + WINDOW_WIDTH / 2
    return [first + i * (WINDOW_WIDTH + gap) for i in range(columns)], gap


def _trim(p, size, bevel=0.02):
    p.box((0, 0, FLOOR_HEIGHT - TRIM / 2), (size + 0.04, size + 0.04, TRIM), PAPER, bevel=bevel)


def _window_floor(p, size, columns):
    """Walls, glass, corner columns, piers and sills of a floor of windows (all four sides)."""
    half = size / 2
    zone = LINTEL - SILL_TOP
    zone_mid = (SILL_TOP + LINTEL) / 2
    xs, gap = window_centres(size, columns)
    p.box((0, 0, SILL_TOP / 2), (size, size, SILL_TOP), PAINT, tint=True, bevel=0.04)
    p.box((0, 0, (LINTEL + WALL_TOP) / 2), (size, size, WALL_TOP - LINTEL), PAINT, tint=True, bevel=0.04)
    p.box((0, 0, zone_mid), (size - 2 * INSET, size - 2 * INSET, zone), GLASS)
    _trim(p, size)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * (half - CORNER / 2), sy * (half - CORNER / 2), zone_mid), (CORNER, CORNER, zone),
                  PAINT, tint=True, bevel=0.04, only_vertical=True)
    for side in range(4):
        frame = side_matrix(side)
        for a, b in zip(xs, xs[1:]):
            p.box(((a + b) / 2, -half + 0.05, zone_mid), (gap, 0.1, zone), PAINT, tint=True,
                  bevel=0.04, only_vertical=True, frame=frame)
        for x in xs:
            p.box((x, -half - 0.005, SILL_TOP + 0.0025), (WINDOW_WIDTH + 0.06, 0.07, 0.035), PAPER, frame=frame)


def _window_floor_lod1(q, size, columns):
    half = size / 2
    xs, _ = window_centres(size, columns)
    q.box((0, 0, WALL_TOP / 2), (size, size, WALL_TOP), PAINT, tint=True)
    _trim(q, size, bevel=0)
    for side in range(4):
        for x in xs:
            q.box((x, -half - 0.001, (SILL_TOP + LINTEL) / 2), (WINDOW_WIDTH, 0.004, LINTEL - SILL_TOP), GLASS,
                  frame=side_matrix(side))


def floor_mid_plain(name, size, columns, material):
    p = Piece(name)
    _window_floor(p, size, columns)
    q = Piece(f'{name}_LOD1')
    _window_floor_lod1(q, size, columns)
    return p.finish(material, smooth=True, ground=True), q.finish(material, smooth=False, ground=True)


def floor_mid_balcony(name, size, columns, material):
    """Plain windows plus a balcony along the front: a concrete slab and a dark steel railing."""
    half = size / 2
    length = size - 2 * CORNER + 0.1
    depth = 0.22
    rail = 0.24
    p = Piece(name)
    _window_floor(p, size, columns)
    p.box((0, -half - depth / 2, 0.02), (length, depth, 0.04), CONCRETE, bevel=0.015)
    p.box((0, -half - depth + 0.015, rail), (length, 0.025, 0.025), ASH)
    for sx in (-1, 1):
        p.box((sx * (length / 2 - 0.0125), -half - depth / 2, rail), (0.025, depth - 0.02, 0.025), ASH)
    posts = 11
    for i in range(posts):
        x = -length / 2 + 0.0125 + i * (length - 0.025) / (posts - 1)
        p.box((x, -half - depth + 0.015, (0.04 + rail) / 2), (0.018, 0.018, rail - 0.04), ASH)

    q = Piece(f'{name}_LOD1')
    _window_floor_lod1(q, size, columns)
    q.box((0, -half - depth / 2, 0.02), (length, depth, 0.04), CONCRETE)
    q.box((0, -half - depth + 0.015, rail), (length, 0.025, 0.025), ASH)
    for sx in (-1, 1):
        q.box((sx * (length / 2 - 0.0125), -half - depth + 0.015, (0.04 + rail) / 2), (0.018, 0.018, rail - 0.04), ASH)
    return p.finish(material, smooth=True, ground=True), q.finish(material, smooth=False, ground=True)


def floor_ground(name, size, material):
    """Ground floor: a concrete plinth, painted block walls and a door with two steps on the front. The other sides
    stay plain: shops are drawn over the street-facing ones in the browser (src/city/Shopfronts.jsx)."""
    half = size / 2
    door_w, door_h, recess = 0.34, 0.42, 0.05
    p = Piece(name)
    p.box((0, 0, 0.04), (size + 0.03, size + 0.03, 0.08), CONCRETE, bevel=0.015)
    # Wall with its front pushed back around the door: a back block, and the front skin left / right / above.
    p.box((0, recess / 2, (0.08 + WALL_TOP) / 2), (size, size - recess, WALL_TOP - 0.08), PAINT, tint=True,
          bevel=0.04)
    side_w = (size - door_w) / 2
    for sx in (-1, 1):
        p.box((sx * (door_w / 2 + side_w / 2), -half + recess / 2, (0.08 + WALL_TOP) / 2),
              (side_w, recess, WALL_TOP - 0.08), PAINT, tint=True, bevel=0.04, only_vertical=True)
    p.box((0, -half + recess / 2, (0.08 + door_h + WALL_TOP) / 2), (door_w + 0.02, recess, WALL_TOP - 0.08 - door_h),
          PAINT, tint=True)
    p.box((0, -half + recess + 0.005, 0.08 + door_h / 2), (door_w, 0.01, door_h), DOOR)
    p.box((0, -half - 0.004, 0.08 + door_h + 0.02), (door_w + 0.1, 0.03, 0.04), PAPER)  # lintel
    p.box((0, -half - 0.05, 0.03), (door_w + 0.26, 0.1, 0.06), CONCRETE, bevel=0.01)  # steps
    p.box((0, -half - 0.11, 0.015), (door_w + 0.36, 0.12, 0.03), CONCRETE, bevel=0.01)
    _trim(p, size)

    q = Piece(f'{name}_LOD1')
    q.box((0, 0, WALL_TOP / 2), (size, size, WALL_TOP), PAINT, tint=True)
    q.box((0, -half - 0.002, 0.08 + door_h / 2), (door_w, 0.004, door_h), DOOR)
    q.box((0, -half - 0.08, 0.03), (door_w + 0.3, 0.16, 0.06), CONCRETE)
    _trim(q, size, bevel=0)
    return p.finish(material, smooth=True, ground=True), q.finish(material, smooth=False, ground=True)


def roof_flat(name, size, material):
    """Flat roof on top of the last floor: a paper parapet around a concrete deck, a stair head, a black
    polytank on its stand, a satellite dish and an AC box. The back-right corner and the centre stay clear for
    the crane and the beacon, the front-left corner for the flag (src/city/Buildings.jsx)."""
    outer = size + 0.04
    wall, height = 0.08, 0.14
    p = Piece(name)
    p.box((0, 0, ROOF_DECK / 2), (outer - 2 * wall + 0.01, outer - 2 * wall + 0.01, ROOF_DECK), CONCRETE, grid=5)
    for sy in (-1, 1):
        p.box((0, sy * (outer / 2 - wall / 2), height / 2), (outer, wall, height), PAPER, bevel=0.02)
    for sx in (-1, 1):
        p.box((sx * (outer / 2 - wall / 2), 0, height / 2), (wall, outer - 2 * wall, height), PAPER, bevel=0.02)

    # Stair head (back left), painted like the walls.
    sx, sy = -0.5, 0.48
    p.box((sx, sy, ROOF_DECK + 0.17), (0.56, 0.5, 0.34), PAINT, tint=True, bevel=0.03)
    p.box((sx, sy, ROOF_DECK + 0.36), (0.64, 0.58, 0.04), PAPER, bevel=0.015)
    p.box((sx + 0.08, sy - 0.252, ROOF_DECK + 0.13), (0.15, 0.01, 0.24), DOOR)

    # Polytank on a stand (front right).
    tx, ty = 0.55, -0.48
    for lx in (-1, 1):
        for ly in (-1, 1):
            p.box((tx + lx * 0.12, ty + ly * 0.12, ROOF_DECK + 0.06), (0.025, 0.025, 0.12), ASH)
    p.box((tx, ty, ROOF_DECK + 0.135), (0.32, 0.32, 0.03), CONCRETE)
    p.cylinder((tx, ty, ROOF_DECK + 0.15), 0.13, 0.26, POLYTANK, segments=12, bevel=0.03)
    p.cylinder((tx, ty, ROOF_DECK + 0.41), 0.055, 0.025, POLYTANK, segments=8)

    # AC box (right) and satellite dish (left).
    p.box((0.74, 0.05, ROOF_DECK + 0.075), (0.16, 0.22, 0.15), PAPER, bevel=0.015)
    p.box((0.655, 0.05, ROOF_DECK + 0.075), (0.01, 0.15, 0.1), ASH)
    p.cylinder((-0.72, 0.0, ROOF_DECK), 0.012, 0.16, ASH, segments=6)
    dish = Matrix.Translation((-0.72, 0.0, ROOF_DECK + 0.2)) @ Matrix.Rotation(0.8, 4, 'Y')
    p.cylinder((0, 0, -0.012), 0.1, 0.024, PAPER, segments=12, bevel=0.008, frame=dish)

    q = Piece(f'{name}_LOD1')
    q.box((0, 0, ROOF_DECK / 2), (outer - 2 * wall + 0.01, outer - 2 * wall + 0.01, ROOF_DECK), CONCRETE, ao=False)
    for sy in (-1, 1):
        q.box((0, sy * (outer / 2 - wall / 2), height / 2), (outer, wall, height), PAPER)
    for sx in (-1, 1):
        q.box((sx * (outer / 2 - wall / 2), 0, height / 2), (wall, outer - 2 * wall, height), PAPER)
    q.box((sx, sy, ROOF_DECK + 0.18), (0.6, 0.54, 0.36), PAINT, tint=True)
    q.box((tx, ty, ROOF_DECK + 0.25), (0.26, 0.26, 0.4), POLYTANK)
    return p.finish(material, smooth=True, ground=False), q.finish(material, smooth=False, ground=False)


def build_all(material):
    return [
        floor_ground('floor_ground_w3', size=2.2, material=material),
        floor_mid_plain('floor_mid_plain_w3', size=2.2, columns=3, material=material),
        floor_mid_balcony('floor_mid_balcony_w3', size=2.2, columns=3, material=material),
        roof_flat('roof_flat_w3', size=2.2, material=material),
    ]


# Preview only: a whole medium building (ground, three middle floors, roof).
PREVIEW_STACKS = [
    [('floor_ground_w3', 0.0), ('floor_mid_plain_w3', 0.6), ('floor_mid_balcony_w3', 1.2),
     ('floor_mid_balcony_w3', 1.8), ('roof_flat_w3', 2.4)],
]
