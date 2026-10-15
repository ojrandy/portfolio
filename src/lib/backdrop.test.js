import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAKO, FOG, GROUND_SIZE, SKY_RADIUS, fakoMesh, fakoPlacement, mistBand, toWorld } from './backdrop.js';
import { layoutCity, chooseTier, TIERS } from './layout.js';

const vertex = (mesh, i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
const vertices = (mesh) => Array.from({ length: mesh.positions.length / 3 }, (_, i) => vertex(mesh, i));

// Smallest building count that lands on each downtown size step.
const layoutForTier = (tier) => {
    let n = 0;
    while (chooseTier(n) !== tier) n++;
    return layoutCity(Array.from({ length: n }, (_, i) => ({ slug: `p-${i}`, flag: false })));
};

test('mesh is deterministic and well-formed', () => {
    const a = fakoMesh();
    const b = fakoMesh();
    assert.deepEqual(a, b);
    assert.ok(a.positions.every(Number.isFinite));
    assert.ok(a.colors.every((c) => c >= 0 && c <= 1));
    const count = a.positions.length / 3;
    assert.ok(a.indices.every((i) => i < count));
    assert.equal(a.indices.length % 3, 0);
    assert.ok(a.indices.length / 3 <= 3200, `${a.indices.length / 3} triangles`);
    assert.notDeepEqual(fakoMesh({ ...FAKO, seed: 'other' }).positions, a.positions);
});

test('every triangle faces up (front side towards the sky)', () => {
    const mesh = fakoMesh();
    for (let t = 0; t < mesh.indices.length; t += 3) {
        const [p, q, r] = [...mesh.indices.slice(t, t + 3)].map((i) => vertex(mesh, i));
        const u = q.map((v, k) => v - p[k]);
        const w = r.map((v, k) => v - p[k]);
        const ny = u[2] * w[0] - u[0] * w[2];
        assert.ok(ny > 0, `triangle ${t / 3} faces down`);
    }
});

test('summit near the set height, rim below the ground', () => {
    const mesh = fakoMesh();
    const ys = vertices(mesh).map((v) => v[1]);
    const top = Math.max(...ys);
    assert.ok(top >= FAKO.height * 0.95 && top <= FAKO.height * 1.15, `summit ${top}`);
    const rim = vertices(mesh).slice(-FAKO.segments);
    assert.ok(rim.every(([, y]) => y < 0));
});

test('Fako stands clear of the city at every downtown size, inside the ground and sky', () => {
    const mesh = fakoMesh();
    for (const tier of TIERS) {
        const layout = layoutForTier(tier);
        const placement = fakoPlacement(layout.bounds);
        for (const v of vertices(mesh)) {
            const [x, , z] = toWorld(v, placement);
            assert.ok(z < layout.bounds.minZ, `tier ${tier}: vertex at z ${z} reaches the city`);
            assert.ok(Math.abs(x) < GROUND_SIZE / 2 && Math.abs(z) < GROUND_SIZE / 2, `tier ${tier}: off the ground`);
            // The camera stays within ~120 of the city (P1-05), so keep the far side inside the dome.
            assert.ok(Math.hypot(x, z) + 120 < SKY_RADIUS, `tier ${tier}: outside the sky`);
        }
        // Close enough not to vanish in the fog.
        assert.ok(Math.abs(placement.z) < FOG.far * 0.6, `tier ${tier}: lost in fog`);
    }
});

test('mist band hugs the slope: wider at the bottom, above the foot', () => {
    const band = mistBand();
    assert.ok(band.radiusBottom > band.radiusTop);
    assert.ok(band.radiusTop > 0 && band.radiusBottom < 1);
    assert.ok(band.y - band.bandHeight / 2 > 0);
    assert.ok(band.y + band.bandHeight / 2 < FAKO.height);
});
