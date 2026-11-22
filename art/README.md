# City kit (Phase 3-C)

The city's buildings are made from a kit of pieces modelled in Blender **by scripts** and stacked in the browser by the building rules. Look and budgets: `docs/design_system.md` "City art". Pipeline: `docs/architecture.md` "Art pipeline".

```bash
npm run art:build                   # Blender → art/build/city-kit.raw.glb → public/models/city-kit.glb, budget check, previews
npm run art:build -- --no-previews  # same, without the renders
npm run art:check                   # check the committed kit only (no Blender needed)
```

- Needs **Blender 4.5 LTS** at `/Applications/Blender.app` or `BLENDER_PATH`. Hostinger and `npm run build` never run Blender: `public/models/city-kit.glb` is committed.
- `blender/build_kit.py` is the entry point, `blender/pieces.py` defines the pieces, `blender/kitlib.py` holds the shared helpers (boxes with bevels, paint mask, vertex AO, export, previews).
- Builds are deterministic: the same scripts give a byte-identical `.glb`. If the hash changes, a piece changed. Bevel numbers what it makes differently from run to run, so `Piece.finish` puts vertices, faces and each face's first corner in a canonical order; pass bmesh ops edges in index order (`_ordered`), never straight from a Python set.
- `previews/` holds day and dusk renders from the city camera's angle (git-ignored). The owner approves the look there before a piece goes into the city.
- Anything not made by our scripts goes in `SOURCES.md` first.

## Pieces (ART-03: medium width only)
| Piece | What | Triangles (LOD0 / LOD1) |
|---|---|---|
| `floor_ground_w3` | concrete plinth, painted walls, door with two steps on the front; other sides plain (shops go there) | 700 / 48 |
| `floor_mid_plain_w3` | 3 windows a side, piers, corner columns, sills, paper trim | 1,008 / 168 |
| `floor_mid_balcony_w3` | the same plus a balcony with a steel railing on the front | 1,284 / 216 |
| `roof_flat_w3` | paper parapet, concrete deck, stair head, polytank on a stand, dish, AC box | 1,404 / 84 |

Window openings must match `KIT` in `src/lib/buildings.js` (the lit panes are drawn there). The roof's clutter keeps the
back-right corner, centre and front-left corner clear for the crane, beacon and flag.

## Browser side
- `src/city/cityKit.js`: turns every attribute back into floats and applies the node matrix (meshopt quantization keeps each piece's scale/offset **on the node**), renames `_tint` / `_ao` to `aTint` / `aAO`, and makes the shared material (paint where `aTint` = 1, times `aAO`).
- Loaded with drei's `useGLTF(url, false, true)`: three-stdlib's meshopt decoder is bundled, no Draco, no CDN.
