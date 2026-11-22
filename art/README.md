# City kit (Phase 3-C)

The city's buildings are made from a kit of pieces modelled in Blender **by scripts** and stacked in the browser by the building rules. Look and budgets: `docs/design_system.md` "City art". Pipeline: `docs/architecture.md` "Art pipeline".

```bash
npm run art:build                   # Blender → art/build/city-kit.raw.glb → public/models/city-kit.glb, budget check, previews
npm run art:build -- --no-previews  # same, without the renders
npm run art:check                   # check the committed kit only (no Blender needed)
```

- Needs **Blender 4.5 LTS** at `/Applications/Blender.app` or `BLENDER_PATH`. Hostinger and `npm run build` never run Blender: `public/models/city-kit.glb` is committed.
- `blender/build_kit.py` is the entry point, `blender/pieces.py` defines the pieces, `blender/kitlib.py` holds the shared helpers (boxes with bevels, paint mask, vertex AO, export, previews).
- Builds are deterministic: the same scripts give a byte-identical `.glb`. If the hash changes, a piece changed.
- `previews/` holds day and dusk renders from the city camera's angle (git-ignored). The owner approves the look there before a piece goes into the city.
- Anything not made by our scripts goes in `SOURCES.md` first.

## Notes for the browser side (ART-03)
- Meshopt quantization stores each piece's position as integers with the scale/offset **on the node** (e.g. `position.y = 0.3`, `scale = 1.14`). Use the node's matrix (or `geometry.applyMatrix4(node.matrixWorld)`) when taking a piece's geometry for instancing.
- Attributes arrive in three.js as `color` (vec4), `_tint` and `_ao` (normalized, 0..1).
- Use three's local decoder `three/addons/libs/meshopt_decoder.module.js` (never a CDN).
