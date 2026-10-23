// Ground-floor shopfronts downtown (P3B-08): an awning, a display window and a door on each street-facing face, with
// the project's own name on the fascia above (3 draw calls: awnings and doors, the display windows, the fascias on a
// canvas atlas). Not pickable themselves: a click goes through to the building, which opens the project. The
// display windows light up with the city's windows; the fascias glow a little at night.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS, mixHex } from '../lib/palette.js';
import { box, mergeParts, panel, panelGeometry } from './propGeometry.js';

const DOOR = mixHex(COLORS.basalt, COLORS.ash, 0.4);
const GLASS_OFF = new THREE.Color(mixHex(COLORS.basalt, COLORS.sky, 0.25));
const GLASS_ON = new THREE.Color(mixHex(COLORS.window, COLORS.paper, 0.25));
const noRaycast = () => null;

// Atlas: one 512 × 64 fascia per building, 4 to a row.
const TILE = { w: 512, h: 64, columns: 4 };

const fitText = (g, text, x, y, maxWidth, size) => {
    let px = size;
    do g.font = `700 ${px}px system-ui, sans-serif`; while (g.measureText(text).width > maxWidth && (px -= 2) > 14);
    g.fillText(text, x, y);
};

const createAtlas = (signs) => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE.w * TILE.columns;
    canvas.height = TILE.h * Math.max(1, Math.ceil(signs.length / TILE.columns));
    const g = canvas.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    signs.forEach(({ name, awning }, i) => {
        const x = (i % TILE.columns) * TILE.w;
        const y = Math.floor(i / TILE.columns) * TILE.h;
        g.fillStyle = mixHex(awning, COLORS.basalt, 0.45);
        g.fillRect(x, y, TILE.w, TILE.h);
        g.fillStyle = COLORS.paper;
        fitText(g, name, x + TILE.w / 2, y + TILE.h / 2 + 2, TILE.w - 40, 44);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, rows: canvas.height / TILE.h };
};

// A shop in its local frame (front +z on the building's face, the ground at y = 0), sized to the ground floor (0.6)
// and to people (0.47 tall, walking 0.2 in front of the widest buildings): the awning stays above their heads.
const shopKit = ({ width: w, awning }, tile) => ({
    solid: [
        box([0.2, 0.42, 0.03], [w * 0.3, 0.21, 0.015], DOOR),
        box([w * 0.94, 0.025, 0.16], [0, 0.51, 0.075], awning, [0.35, 0, 0]),
    ],
    lights: [box([w * 0.52, 0.34, 0.02], [-w * 0.12, 0.23, 0.01], COLORS.window)],
    panels: [panel(tile, w * 0.9, 0.11, [0, 0.6, 0.016])],
});

const buildGeometry = (shops, tileOf, rows) => {
    const solid = [];
    const lights = [];
    const panels = [];
    for (const shop of shops) {
        const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(shop.x, 0, shop.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), shop.rotationY),
            new THREE.Vector3(1, 1, 1),
        );
        const kit = shopKit(shop, tileOf.get(shop.slug));
        for (const part of kit.solid) solid.push({ part, matrix });
        for (const part of kit.lights) lights.push({ part, matrix });
        for (const p of kit.panels) panels.push({ panel: p, matrix });
    }
    const uvs = (i) => {
        const [u0, u1] = [(i % TILE.columns) / TILE.columns, ((i % TILE.columns) + 1) / TILE.columns];
        const row = Math.floor(i / TILE.columns);
        const [v0, v1] = [1 - (row + 1) / rows, 1 - row / rows];
        return [u0, v0, u1, v0, u1, v1, u0, v1];
    };
    return {
        solid: mergeParts(solid),
        lights: mergeParts(lights),
        panels: panels.length ? panelGeometry(panels, uvs) : null,
    };
};

/**
 * @param {{ shops: ReturnType<import('../lib/shopfronts.js').shopfronts>, names: Map<string, string>, lighting: object,
 *   hidden?: string | null }} props  names: slug → project name (the fascia); hidden: the building in X-Ray
 */
const Shopfronts = ({ shops, names, lighting, hidden = null }) => {
    // One fascia tile per building, in a fixed order, so hiding one building doesn't repaint the atlas.
    const signs = useMemo(() => {
        const seen = new Map();
        for (const s of shops) if (!seen.has(s.slug)) seen.set(s.slug, { name: names.get(s.slug) ?? s.slug, awning: s.awning });
        return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    }, [shops, names]);
    const atlas = useMemo(() => createAtlas(signs.map(([, sign]) => sign)), [signs]);
    const tileOf = useMemo(() => new Map(signs.map(([slug], i) => [slug, i])), [signs]);
    const geometry = useMemo(
        () => buildGeometry(hidden ? shops.filter((s) => s.slug !== hidden) : shops, tileOf, atlas.rows),
        [shops, hidden, tileOf, atlas],
    );
    const glass = useMemo(() => new THREE.MeshBasicMaterial({ color: GLASS_OFF.clone(), toneMapped: false }), []);
    const fascia = useRef(null);

    useEffect(() => () => {
        geometry.solid?.dispose();
        geometry.lights?.dispose();
        geometry.panels?.dispose();
    }, [geometry]);
    useEffect(() => () => atlas.texture.dispose(), [atlas]);
    useEffect(() => () => glass.dispose(), [glass]);

    useFrame(() => {
        glass.color.lerpColors(GLASS_OFF, GLASS_ON, lighting.windows);
        if (fascia.current) fascia.current.emissiveIntensity = 0.2 + 0.5 * lighting.windows;
    });

    return (
        <group>
            {geometry.solid && (
                <mesh geometry={geometry.solid} raycast={noRaycast}>
                    <meshStandardMaterial vertexColors flatShading roughness={0.8} />
                </mesh>
            )}
            {geometry.lights && <mesh geometry={geometry.lights} material={glass} raycast={noRaycast} />}
            {geometry.panels && (
                <mesh geometry={geometry.panels} raycast={noRaycast}>
                    <meshStandardMaterial ref={fascia} map={atlas.texture} emissiveMap={atlas.texture} emissive="#ffffff" emissiveIntensity={0.2} roughness={0.8} />
                </mesh>
            )}
        </group>
    );
};

export default Shopfronts;
