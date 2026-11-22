"""Kit pieces. Each builder returns (lod0, lod1) objects named "<piece>" and "<piece>_LOD1".

ART-02 has one test piece that exercises the whole pipeline (bevels, inset windows, paint mask, AO, LOD1);
the real kit (ground / middle / top floors in three widths) comes in ART-03 and ART-04.
Sizes match src/lib/buildings.js: FLOOR_HEIGHT 0.6, footprints 1.6 / 2.2 / 3.0 with 2 / 3 / 4 window columns.
"""
from kitlib import ASH, GLASS, PAINT, PAPER, Piece, side_matrix  # noqa: F401 (ASH used by later pieces)

FLOOR_HEIGHT = 0.6
WINDOW_WIDTH = 0.42
CORNER = 0.25  # corner column width
SILL_TOP = 0.16  # top of the band below the windows
LINTEL = 0.44  # bottom of the band above the windows
INSET = 0.03  # glass set back from the wall face
TRIM = 0.05  # paper band between floors, on top of each floor
WALL_TOP = FLOOR_HEIGHT - TRIM / 2  # walls stop inside the trim, so the trim's top is the only top face


def window_centres(size, columns):
    gap = (size - 2 * CORNER - columns * WINDOW_WIDTH) / (columns - 1)
    first = -size / 2 + CORNER + WINDOW_WIDTH / 2
    return [first + i * (WINDOW_WIDTH + gap) for i in range(columns)], gap


def test_floor(name, size, columns, material):
    half = size / 2
    zone = LINTEL - SILL_TOP
    zone_mid = (SILL_TOP + LINTEL) / 2
    xs, gap = window_centres(size, columns)

    p = Piece(name)
    p.box((0, 0, SILL_TOP / 2), (size, size, SILL_TOP), PAINT, tint=True, bevel=0.04)
    p.box((0, 0, (LINTEL + WALL_TOP) / 2), (size, size, WALL_TOP - LINTEL), PAINT, tint=True, bevel=0.04)
    p.box((0, 0, zone_mid), (size - 2 * INSET, size - 2 * INSET, zone), GLASS)
    p.box((0, 0, FLOOR_HEIGHT - TRIM / 2), (size + 0.04, size + 0.04, TRIM), PAPER, bevel=0.02)
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
    lod0 = p.finish(material, smooth=True, ground=True)

    q = Piece(f'{name}_LOD1')
    q.box((0, 0, WALL_TOP / 2), (size, size, WALL_TOP), PAINT, tint=True)
    q.box((0, 0, FLOOR_HEIGHT - TRIM / 2), (size + 0.04, size + 0.04, TRIM), PAPER)
    for side in range(4):
        for x in xs:
            q.box((x, -half - 0.001, zone_mid), (WINDOW_WIDTH, 0.004, zone), GLASS, frame=side_matrix(side))
    lod1 = q.finish(material, smooth=False, ground=True)
    return lod0, lod1


def build_all(material):
    return [
        test_floor('test_floor_w3', size=2.2, columns=3, material=material),
    ]
