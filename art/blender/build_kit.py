"""Build the city kit: every piece -> one .glb (+ preview renders). Run by `npm run art:build`, not by hand:
Blender --background --factory-startup --python-exit-code 1 --python art/blender/build_kit.py -- --out <file.glb> [--previews <dir>]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kitlib  # noqa: E402
import pieces  # noqa: E402

PREVIEW_PAINT = kitlib.mix_hex('#3178C6', kitlib.PAPER, 0.35)  # a language accent as wall paint (TypeScript)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    parser.add_argument('--previews')
    args = parser.parse_args(argv)

    kitlib.clear_scene()
    pairs = pieces.build_all(kitlib.kit_material())
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    kitlib.export_glb(args.out)
    print(f'[art] exported {len(pairs)} piece(s) to {args.out}')

    if args.previews:
        os.makedirs(args.previews, exist_ok=True)
        for path in kitlib.render_previews(pairs, args.previews, PREVIEW_PAINT, pieces.PREVIEW_STACKS):
            print(f'[art] preview {path}')


main()
