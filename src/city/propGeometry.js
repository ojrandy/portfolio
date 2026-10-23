// Street prop meshes (P3B-05): each prop type is a list of simple flat-shaded parts in the city style. Every prop is
// merged into one geometry with vertex colours (one draw call); its lamps go into a second one (lit at night) and its
// text panels (billboards, stop, call-box and fuel signs) into a third, mapped onto one canvas atlas (see TILES).
// Local frames: y up, front +z, the ground at y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { TAXI_YELLOW } from '../lib/vehicles.js';

const BARK = '#5E4128';
const WOOD = '#7A5434';
const GREENS = [mixHex(COLORS.fakoGreen, COLORS.basalt, 0.1), mixHex(COLORS.fakoGreen, COLORS.mist, 0.15), mixHex(COLORS.fakoGreen, COLORS.window, 0.2)];
const PALM_LEAF = mixHex(COLORS.fakoGreen, COLORS.window, 0.3);
const METAL = mixHex(COLORS.ash, COLORS.mist, 0.25);
const DARK = mixHex(COLORS.basalt, COLORS.ash, 0.5);
const GLASS = mixHex(COLORS.sky, COLORS.basalt, 0.6);
const CONCRETE = mixHex(COLORS.ash, COLORS.mist, 0.3);
const WALL = mixHex(COLORS.paper, COLORS.window, 0.15);
const KIOSK_COLORS = [COLORS.indigo, COLORS.fakoGreen, COLORS.ember];

// Canvas atlas (2048 × 1704): a face per featured project (max 3, the board turns over by switching its UVs, so
// nothing is re-uploaded), the GitHub and weather faces, then the small signs.
export const ATLAS = { width: 2048, height: 1704 };
export const FEATURED_TILES = ['featured0', 'featured1', 'featured2'];
export const TILES = {
    featured0: { x: 0, y: 0, w: 1024, h: 568 },
    featured1: { x: 1024, y: 0, w: 1024, h: 568 },
    featured2: { x: 0, y: 568, w: 1024, h: 568 },
    github: { x: 1024, y: 568, w: 1024, h: 568 },
    weather: { x: 0, y: 1136, w: 1024, h: 568 },
    stop: { x: 1024, y: 1136, w: 512, h: 512 },
    callbox: { x: 1536, y: 1136, w: 512, h: 140 },
    fuel: { x: 1536, y: 1276, w: 512, h: 300 },
};
export const BILLBOARD = { width: 3.6, height: 2, bottom: 2.2 };

export const box = (size, at, color, rot) => ({ shape: 'box', size, at, color, rot });
export const cyl = (top, bottom, height, at, color, rot, segments = 7) => ({ shape: 'cyl', top, bottom, height, at, color, rot, segments });
export const blob = (size, at, color) => ({ shape: 'blob', size, at, color });
export const roof = (size, at, color, rot) => ({ shape: 'roof', size, at, color, rot });
// Text panel: a quad of `tile` facing local +z (or −z with back), centred at `at`.
export const panel = (tile, width, height, at, back = false) => ({ tile, width, height, at, back });

const tree = (variant) => ({
    solid: [
        cyl(0.08, 0.11, 1, [0, 0.5, 0], BARK),
        blob([1.2, 1, 1.2], [0, 1.45, 0], GREENS[variant]),
        blob([0.85, 0.75, 0.85], [0.15, 1.95, -0.1], GREENS[(variant + 1) % GREENS.length]),
    ],
});

const PALM_TOP = [0.17, 2.42, 0];
const palm = () => ({
    solid: [
        cyl(0.075, 0.095, 0.9, [0, 0.45, 0], BARK),
        cyl(0.065, 0.075, 0.9, [0.05, 1.3, 0], BARK, [0, 0, -0.08]),
        cyl(0.055, 0.065, 0.7, [0.12, 2.05, 0], BARK, [0, 0, -0.15]),
        ...Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            const tilt = 0.35 + (i % 2) * 0.15;
            const out = 0.5;
            return box([0.16, 0.03, 1.1], [
                PALM_TOP[0] + Math.sin(a) * out * Math.cos(tilt), PALM_TOP[1] - out * Math.sin(tilt), PALM_TOP[2] + Math.cos(a) * out * Math.cos(tilt),
            ], PALM_LEAF, [tilt, a, 0]);
        }),
        blob([0.22, 0.2, 0.22], [PALM_TOP[0], PALM_TOP[1] - 0.12, 0], BARK),
    ],
});

const bench = () => ({
    solid: [
        box([1, 0.06, 0.34], [0, 0.42, 0], WOOD),
        box([1, 0.24, 0.05], [0, 0.63, -0.16], WOOD),
        ...[-0.42, 0.42].map((x) => box([0.06, 0.42, 0.3], [x, 0.21, 0], DARK)),
    ],
});

// Shelter 1.8 × 0.9, open side (+z) to the road, with a TAXI · BUS sign on a pole.
const stop = () => ({
    solid: [
        box([1.95, 0.07, 1], [0, 2.02, 0], COLORS.indigo),
        box([1.8, 1.3, 0.04], [0, 1.15, -0.42], GLASS),
        ...[-0.9, 0.9].map((x) => box([0.04, 1.3, 0.75], [x, 1.15, -0.05], GLASS)),
        ...[-0.9, 0.9].map((x) => box([0.07, 2, 0.07], [x, 1, 0.42], METAL)),
        box([1.4, 0.05, 0.3], [0, 0.45, -0.22], WOOD),
        box([0.06, 2.5, 0.06], [1.3, 1.25, 0.45], METAL),
        box([0.66, 0.66, 0.05], [1.3, 2.25, 0.45], TAXI_YELLOW),
    ],
    lights: [box([1.6, 0.03, 0.1], [0, 1.97, 0.1], COLORS.window)],
    panels: [panel('stop', 0.6, 0.6, [1.3, 2.25, 0.48]), panel('stop', 0.6, 0.6, [1.3, 2.25, 0.42], true)],
});

// Call box: a small stand with a parasol, in one of the kiosk colours (no network brands).
const kiosk = (variant) => {
    const accent = KIOSK_COLORS[variant % KIOSK_COLORS.length];
    return {
        solid: [
            box([0.9, 0.9, 0.6], [0, 0.45, 0], COLORS.paper),
            box([0.92, 0.18, 0.62], [0, 0.78, 0], accent),
            box([1, 0.05, 0.7], [0, 0.92, 0.05], WOOD),
            cyl(0.025, 0.025, 1.15, [0, 1.5, 0], METAL),
            cyl(0.02, 0.75, 0.3, [0, 2.1, 0], accent, undefined, 8),
        ],
        lights: [blob([0.1, 0.1, 0.1], [0, 1.88, 0], COLORS.window)],
        panels: [panel('callbox', 0.8, 0.22, [0, 0.5, 0.305])],
    };
};

// Fuel station 8 × 6: canopy and two pumps on the road side (+z), shop behind, FUEL sign by the road (both faces).
const fuel = () => ({
    solid: [
        box([8, 0.04, 6], [0, 0.02, 0], CONCRETE),
        box([5, 0.22, 3.2], [0, 2.75, 1], COLORS.paper),
        box([5.06, 0.14, 3.26], [0, 2.6, 1], COLORS.ember),
        ...[[-2, 0], [2, 0], [-2, 2], [2, 2]].map(([x, z]) => box([0.18, 2.55, 0.18], [x, 1.28, z - 0.2], METAL)),
        ...[-1, 1].flatMap((x) => [
            box([0.5, 0.12, 1.6], [x, 0.1, 1], CONCRETE),
            box([0.35, 1, 0.3], [x, 0.66, 1], COLORS.paper),
            box([0.37, 0.12, 0.32], [x, 1.2, 1], COLORS.ember),
        ]),
        box([3.2, 1.9, 2], [-1.6, 0.95, -1.8], WALL),
        box([3.4, 0.12, 2.2], [-1.6, 1.96, -1.8], COLORS.ash),
        box([0.6, 1.2, 0.02], [-0.6, 0.6, -0.79], COLORS.indigo),
        box([0.15, 3, 0.15], [3.4, 1.5, 2.6], METAL),
        box([1.1, 0.7, 0.1], [3.4, 3.1, 2.6], COLORS.ember),
    ],
    lights: [box([4.6, 0.02, 2.8], [0, 2.48, 1], COLORS.window), box([1.3, 0.7, 0.02], [-2.4, 1.1, -0.785], COLORS.window)],
    panels: [panel('fuel', 1, 0.6, [3.4, 3.1, 2.656]), panel('fuel', 1, 0.6, [3.4, 3.1, 2.544], true)],
});

const billboard = (id) => ({
    solid: [
        ...[-1.2, 1.2].map((x) => box([0.16, BILLBOARD.bottom + BILLBOARD.height - 0.2, 0.16], [x, (BILLBOARD.bottom + BILLBOARD.height - 0.2) / 2, -0.12], METAL)),
        box([BILLBOARD.width + 0.2, BILLBOARD.height + 0.2, 0.12], [0, BILLBOARD.bottom + BILLBOARD.height / 2, -0.02], DARK),
    ],
    panels: [panel(id === 'featured' ? FEATURED_TILES[0] : id, BILLBOARD.width, BILLBOARD.height, [0, BILLBOARD.bottom + BILLBOARD.height / 2, 0.045])],
});

// Gable roof [width, height, depth]: ridge along x at the top, eaves at y = 0 (its `at` is the middle of the eaves).
const roofGeometry = ([w, h, d]) => {
    const [x0, x1, z0, z1] = [-w / 2, w / 2, -d / 2, d / 2];
    const positions = [
        x0, 0, z1, x0, h, 0, x0, 0, z0, // west gable
        x1, 0, z0, x1, h, 0, x1, 0, z1, // east gable
        x0, 0, z1, x1, 0, z1, x1, h, 0, x0, 0, z1, x1, h, 0, x0, h, 0, // south slope
        x1, 0, z0, x0, 0, z0, x0, h, 0, x1, 0, z0, x0, h, 0, x1, h, 0, // north slope
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
};

const shapeGeometry = (part) => {
    if (part.shape === 'box') return new THREE.BoxGeometry(...part.size);
    if (part.shape === 'blob') return new THREE.IcosahedronGeometry(0.5, 0).scale(...part.size);
    if (part.shape === 'roof') return roofGeometry(part.size);
    return new THREE.CylinderGeometry(part.top, part.bottom, part.height, part.segments);
};

const euler = new THREE.Euler();
const color = new THREE.Color();

// One part, placed in the world by `matrix`: non-indexed, position + normal + colour. Other kits (the Market) reuse
// the part helpers, mergeParts and panelGeometry.
const partGeometry = (part, matrix) => {
    const source = shapeGeometry(part);
    const g = source.index ? source.toNonIndexed() : source;
    if (part.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler.set(...part.rot, 'YXZ')));
    g.translate(...part.at);
    g.applyMatrix4(matrix);
    g.deleteAttribute('uv');
    color.set(part.color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (g !== source) source.dispose();
    return g;
};

export const mergeParts = (parts) => {
    if (parts.length === 0) return null;
    const geometries = parts.map(({ part, matrix }) => partGeometry(part, matrix));
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    return merged;
};

// The quad's corners in order (bottom left, bottom right, top right, top left) → its tile's corners.
const tileUvs = (name) => {
    const tile = TILES[name];
    const [u0, u1] = [tile.x / ATLAS.width, (tile.x + tile.w) / ATLAS.width];
    const [v0, v1] = [1 - (tile.y + tile.h) / ATLAS.height, 1 - tile.y / ATLAS.height];
    return [u0, v0, u1, v0, u1, v1, u0, v1];
};

/** Point quad `quad` of a panel geometry at another tile (the featured board turning over). */
export const setQuadTile = (geometry, quad, name) => {
    const uv = geometry.attributes.uv;
    uv.array.set(tileUvs(name), quad * 8);
    uv.needsUpdate = true;
};

// Text quads → one geometry; quad i is faces 2i and 2i + 1. UVs point at the quad's tile (uvsOf(tile), 8 numbers).
export const panelGeometry = (panels, uvsOf = tileUvs) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    const index = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    panels.forEach(({ panel: p, matrix }, i) => {
        const dir = p.back ? -1 : 1;
        n.set(0, 0, dir).transformDirection(matrix);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            v.set(p.at[0] + (sx * dir * p.width) / 2, p.at[1] + (sy * p.height) / 2, p.at[2]).applyMatrix4(matrix);
            positions.push(v.x, v.y, v.z);
            normals.push(n.x, n.y, n.z);
        }
        uvs.push(...uvsOf(p.tile));
        const k = i * 4;
        index.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    return geometry;
};

/**
 * streetProps() → { solid, lights, panels: { geometry, tiles } } (tiles[i] = the tile of quad i, for clicks).
 * @param {ReturnType<import('../lib/streetProps.js').streetProps>} props
 */
export const buildPropGeometry = (props) => {
    const placed = [
        ...props.trees.map((p) => [p, tree(p.variant)]),
        ...props.palms.map((p) => [p, palm()]),
        ...props.benches.map((p) => [p, bench()]),
        ...props.stops.map((p) => [p, stop()]),
        ...props.kiosks.map((p, i) => [p, kiosk(i)]),
        ...(props.fuel ? [[props.fuel, fuel()]] : []),
        ...props.billboards.map((p) => [p, billboard(p.id)]),
    ];
    const solid = [];
    const lights = [];
    const panels = [];
    for (const [p, kit] of placed) {
        const s = p.scale ?? 1;
        const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(p.x, 0, p.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY ?? 0),
            new THREE.Vector3(s, s, s),
        );
        for (const part of kit.solid) solid.push({ part, matrix });
        for (const part of kit.lights ?? []) lights.push({ part, matrix });
        for (const item of kit.panels ?? []) panels.push({ panel: item, matrix });
    }
    return {
        solid: mergeParts(solid),
        lights: mergeParts(lights),
        panels: panels.length ? { geometry: panelGeometry(panels), tiles: panels.map(({ panel: p }) => p.tile) } : null,
    };
};
