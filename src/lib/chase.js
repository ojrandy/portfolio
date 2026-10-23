// Police chase (P3B-11, design_system.md → "Interactive city"): in drive mode, running a red brings a police car
// after you; lose it or pull over. Pure and deterministic, no three.js; src/city/Drive.jsx runs it and Traffic.jsx
// draws the police car.
// The police car drives with the same handling code as you (drive.js stepCar), so it can't go through anything
// either. It finds its way on a coarse grid of the drive world (roads cheap, grass dear), replanned twice a second,
// and goes straight for you once you're close and the way is clear.
import { collision, HANDLING, onRoad, stepCar, touches } from './drive.js';
import { VEHICLE_TYPES } from './vehicles.js';

export const CHASE_RULES = {
    takeOver: 40, // a police car in the traffic this close to you turns and comes after you
    spawn: { min: 20, max: 30 }, // otherwise one appears on a road this far away, behind you if it can
    // Stay further than `distance` for `seconds` and you've lost it; until it has been that close once (it starts
    // further away), further than `far`.
    lose: { distance: 16, far: 32, seconds: 4 },
    pullOver: { distance: 3, speed: 0.1, seconds: 2 }, // stopped this close for this long: you pulled over
    stopped: 3, // s it waits behind you after you pulled over, then drives off
    leave: 8, // s it drives off for before it's gone
    fade: 1, // s of fading out at the end of that
};
const CELL = 1;
const PROBE = 0.8; // a cell is open when a square this size at its centre touches nothing
const GRASS_COST = 3; // the police keep to the roads when they can
const REPLAN = 0.5;
const LOOK = 2.5; // aim this far along the path
const DIRECT = 8; // straight for you when this close and the line to you is clear
const KEEP = 2; // stop this far from you, centre to centre (inside pullOver.distance)
const STUCK = { speed: 0.15, seconds: 1.2, reverse: 0.9 };
const SQRT2 = Math.SQRT2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// --- The grid the police find their way on (built once per drive world, on the first chase) ---

const navs = new WeakMap();

/**
 * Open cells (cost 1 on a road, GRASS_COST off it, 0 = blocked) over the drive bounds. Each solid shape blocks the
 * cells round it where a PROBE square at the centre would touch it (the same test as drive.js collision, but only
 * near each shape: building it cell by cell took ~270 ms).
 */
export const navGrid = (world) => {
    let nav = navs.get(world);
    if (nav) return nav;
    const { minX, maxX, minZ, maxZ } = world.bounds;
    const cols = Math.floor((maxX - minX) / CELL);
    const rows = Math.floor((maxZ - minZ) / CELL);
    const cost = new Float32Array(cols * rows).fill(GRASS_COST);
    const cells = (x0, x1, z0, z1, each) => {
        for (let j = Math.max(0, Math.floor((z0 - minZ) / CELL)); j <= Math.min(rows - 1, Math.floor((z1 - minZ) / CELL)); j++) {
            for (let i = Math.max(0, Math.floor((x0 - minX) / CELL)); i <= Math.min(cols - 1, Math.floor((x1 - minX) / CELL)); i++) {
                each(j * cols + i, minX + (i + 0.5) * CELL, minZ + (j + 0.5) * CELL);
            }
        }
    };
    for (const r of world.roads) {
        cells(r.x - r.width / 2, r.x + r.width / 2, r.z - r.depth / 2, r.z + r.depth / 2, (k, x, z) => {
            if (onRoad(world, { x, z })) cost[k] = 1;
        });
    }
    const half = PROBE / 2;
    const probe = (x, z) => ({ x, z, ax: { x: 0, z: 1 }, hl: half, hw: half });
    for (const s of world.shapes) {
        const r = (s.r ?? Math.hypot(s.hl, s.hw)) + half * Math.SQRT2;
        cells(s.x - r, s.x + r, s.z - r, s.z + r, (k, x, z) => {
            if (cost[k] && touches(probe(x, z), s)) cost[k] = 0;
        });
    }
    // Search buffers, reused from search to search.
    nav = { minX, minZ, cols, rows, cost, g: new Float32Array(cols * rows), via: new Int32Array(cols * rows), done: new Uint8Array(cols * rows), open: heap() };
    navs.set(world, nav);
    return nav;
};

const cellAt = (nav, p) => {
    const i = Math.floor((p.x - nav.minX) / CELL);
    const j = Math.floor((p.z - nav.minZ) / CELL);
    return i < 0 || j < 0 || i >= nav.cols || j >= nav.rows ? -1 : j * nav.cols + i;
};
const centre = (nav, k) => ({ x: nav.minX + ((k % nav.cols) + 0.5) * CELL, z: nav.minZ + (Math.floor(k / nav.cols) + 0.5) * CELL });

/** The open cell nearest to p (within 4 cells), or −1. */
const nearestOpen = (nav, p) => {
    const k = cellAt(nav, p);
    if (k >= 0 && nav.cost[k] > 0) return k;
    let best = -1;
    let bestD = Infinity;
    const i0 = Math.floor((p.x - nav.minX) / CELL);
    const j0 = Math.floor((p.z - nav.minZ) / CELL);
    for (let j = j0 - 4; j <= j0 + 4; j++) {
        for (let i = i0 - 4; i <= i0 + 4; i++) {
            if (i < 0 || j < 0 || i >= nav.cols || j >= nav.rows || nav.cost[j * nav.cols + i] === 0) continue;
            const d = dist(centre(nav, j * nav.cols + i), p);
            if (d < bestD) [best, bestD] = [j * nav.cols + i, d];
        }
    }
    return best;
};

// A binary heap of cells by priority, in two parallel number arrays (no allocation per push), reused per search.
const heap = () => {
    const pri = [];
    const cell = [];
    const swap = (a, b) => {
        [pri[a], pri[b]] = [pri[b], pri[a]];
        [cell[a], cell[b]] = [cell[b], cell[a]];
    };
    return {
        get size() { return cell.length; },
        clear() { pri.length = 0; cell.length = 0; },
        push(p, k) {
            pri.push(p);
            cell.push(k);
            for (let i = cell.length - 1; i > 0;) {
                const up = (i - 1) >> 1;
                if (pri[up] <= pri[i]) break;
                swap(i, up);
                i = up;
            }
        },
        pop() {
            const top = cell[0];
            const [lastP, lastK] = [pri.pop(), cell.pop()];
            if (cell.length) {
                pri[0] = lastP;
                cell[0] = lastK;
                for (let i = 0; ;) {
                    const l = 2 * i + 1;
                    const r = l + 1;
                    let m = i;
                    if (l < cell.length && pri[l] < pri[m]) m = l;
                    if (r < cell.length && pri[r] < pri[m]) m = r;
                    if (m === i) break;
                    swap(i, m);
                    i = m;
                }
            }
            return top;
        },
    };
};

/** Cheapest way from `from` to `to` ({ x, z }) over open cells (A*), as cell centres; null if there is none. */
export const findPath = (nav, from, to) => {
    const start = nearestOpen(nav, from);
    const goal = nearestOpen(nav, to);
    if (start < 0 || goal < 0) return null;
    const { cols, rows, cost, g, via, done } = nav;
    g.fill(Infinity);
    via.fill(-1);
    done.fill(0);
    const [gi, gj] = [goal % cols, Math.floor(goal / cols)];
    const h = (k) => {
        const dx = Math.abs((k % cols) - gi);
        const dz = Math.abs(Math.floor(k / cols) - gj);
        return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };
    const { open } = nav;
    open.clear();
    g[start] = 0;
    open.push(h(start), start);
    while (open.size) {
        const k = open.pop();
        if (done[k]) continue;
        done[k] = 1;
        if (k === goal) break;
        const [i, j] = [k % cols, Math.floor(k / cols)];
        for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
                if (!di && !dj) continue;
                const [ni, nj] = [i + di, j + dj];
                if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
                const n = nj * cols + ni;
                if (!cost[n] || done[n]) continue;
                // Diagonals only where both sides are open (no cutting corners).
                if (di && dj && (!cost[j * cols + ni] || !cost[nj * cols + i])) continue;
                const step = (di && dj ? SQRT2 : 1) * (cost[k] + cost[n]) / 2;
                if (g[k] + step < g[n]) {
                    g[n] = g[k] + step;
                    via[n] = k;
                    open.push(g[n] + h(n), n);
                }
            }
        }
    }
    if (!done[goal]) return null;
    const path = [];
    for (let k = goal; k >= 0; k = via[k]) path.unshift(centre(nav, k));
    return path;
};

/** Is the straight line from a to b over open cells only? */
const clearLine = (nav, a, b) => {
    const n = Math.ceil(dist(a, b) / (CELL / 2));
    for (let s = 1; s < n; s++) {
        const k = cellAt(nav, { x: a.x + ((b.x - a.x) * s) / n, z: a.z + ((b.z - a.z) * s) / n });
        if (k < 0 || !nav.cost[k]) return false;
    }
    return true;
};

/** The point to aim at: LOOK along the path from the point on it nearest to the car. */
const aimAlong = (path, car) => {
    let nearest = 0;
    for (let i = 1; i < path.length; i++) if (dist(path[i], car) < dist(path[nearest], car)) nearest = i;
    for (let i = nearest; i < path.length; i++) if (dist(path[i], car) > LOOK) return path[i];
    return path.at(-1);
};

/** Throttle, steer and brake for heading to `aim`, stopping `stopShort` from it. */
const driveTo = (car, aim, stopShort = 0) => {
    const dx = aim.x - car.x;
    const dz = aim.z - car.z;
    const diff = wrap(Math.atan2(dx, dz) - car.rotationY);
    // Slower into turns; never faster than it can stop in.
    let desired = HANDLING.police.max * clamp(1 - Math.abs(diff) / 1.4, 0.3, 1);
    if (stopShort > 0) desired = Math.min(desired, Math.sqrt(2 * 4 * Math.max(0, Math.hypot(dx, dz) - stopShort)));
    return { throttle: car.v < desired - 0.1 ? 1 : 0, steer: clamp(diff * 2.5, -1, 1), brake: car.v > desired + 0.3 };
};

// --- Where the police car comes from and goes to ---

/**
 * The road cell CHASE_RULES.spawn away from `from` that scores lowest (`score(cell, distance)`) and passes `ok`,
 * or null. Searches only the square round `from`.
 */
const roadNear = (nav, from, score, ok = () => true) => {
    const { min, max } = CHASE_RULES.spawn;
    let best = null;
    const [i0, j0] = [Math.floor((from.x - nav.minX) / CELL), Math.floor((from.z - nav.minZ) / CELL)];
    const reach = Math.ceil(max / CELL);
    for (let j = Math.max(0, j0 - reach); j <= Math.min(nav.rows - 1, j0 + reach); j++) {
        for (let i = Math.max(0, i0 - reach); i <= Math.min(nav.cols - 1, i0 + reach); i++) {
            const k = j * nav.cols + i;
            if (nav.cost[k] !== 1) continue;
            const c = centre(nav, k);
            const d = dist(c, from);
            if (d < min || d > max) continue;
            const s = score(c, d);
            if (best && s >= best.s) continue;
            if (ok(c)) best = { c, s };
        }
    }
    return best?.c ?? null;
};

/** Where a new police car appears: on a road behind you if it can be, clear of everything; facing you. */
const spawnSpot = (world, player, car, others) => {
    const heading = { x: Math.sin(player.rotationY), z: Math.cos(player.rotationY) };
    const facing = (c) => ({ ...c, rotationY: Math.atan2(player.x - c.x, player.z - c.z) });
    const c = roadNear(
        navGrid(world),
        player,
        (p, d) => ((p.x - player.x) * heading.x + (p.z - player.z) * heading.z) / d, // −1 straight behind … 1 ahead
        (p) => !collision(world, car, facing(p), others),
    );
    return c && facing(c);
};

/** Where it drives off to: a road a little way from where it is, as far from you as it can (short to plan). */
const leaveSpot = (world, car, player) => roadNear(navGrid(world), car, (p) => -dist(p, player)) ?? { x: car.x, z: car.z };

/**
 * A chase after `player` ({ x, z, rotationY, v, foot }: your car). `police` = a police car taken out of the traffic
 * ({ x, z, rotationY, v }), or null for a new one on a road behind you. `others` = { vehicles, people } as in
 * drive.js collision. Returns null when there's nowhere to put the police car.
 */
export const createChase = (world, player, { police = null, others = {} } = {}) => {
    const kit = VEHICLE_TYPES.police;
    const car = { type: 'police', length: kit.length, width: kit.width, v: 0, steer: 0, braking: false, scale: 1 };
    const withYou = { ...others, vehicles: [...(others.vehicles ?? []), { id: 'you', foot: player.foot }] };
    if (police) Object.assign(car, { x: police.x, z: police.z, rotationY: police.rotationY, v: police.v ?? 0 });
    else {
        const spot = spawnSpot(world, player, car, withYou);
        if (!spot) return null;
        Object.assign(car, spot);
    }
    return { phase: 'chasing', car, t: 0, since: 0, seen: false, farFor: 0, closeFor: 0, stuckFor: 0, reverseFor: 0, path: null, replanAt: 0, exit: null };
};

/**
 * Advance the chase by `dt` s. `player` as in createChase (null once you've stopped driving: it drives off).
 * Phases: chasing → (lost | pulled over → stopped) → leaving → gone.
 * @returns {'lost' | 'caught' | 'gone' | null} what happened this step
 */
export const stepChase = (world, chase, player, dt, others = {}) => {
    if (!(dt > 0) || chase.phase === 'gone') return null;
    chase.t += dt;
    const car = chase.car;
    const d = player ? dist(player, car) : Infinity;
    let event = null;
    const leave = () => {
        chase.phase = 'leaving';
        chase.since = chase.t;
        chase.path = null;
        chase.exit = leaveSpot(world, car, player ?? car);
    };
    if (chase.phase === 'chasing') {
        if (d <= CHASE_RULES.lose.distance) chase.seen = true;
        chase.farFor = d > (chase.seen ? CHASE_RULES.lose.distance : CHASE_RULES.lose.far) ? chase.farFor + dt : 0;
        chase.closeFor = player && d < CHASE_RULES.pullOver.distance && Math.abs(player.v) < CHASE_RULES.pullOver.speed ? chase.closeFor + dt : 0;
        if (!player || chase.farFor >= CHASE_RULES.lose.seconds) {
            leave();
            if (player) event = 'lost';
        } else if (chase.closeFor >= CHASE_RULES.pullOver.seconds) {
            chase.phase = 'stopped';
            chase.since = chase.t;
            event = 'caught';
        }
    } else if (chase.phase === 'stopped' && (!player || chase.t - chase.since >= CHASE_RULES.stopped)) {
        leave();
    } else if (chase.phase === 'leaving' && chase.t - chase.since >= CHASE_RULES.leave) {
        chase.phase = 'gone';
        car.scale = 0;
        return 'gone';
    }
    car.scale = chase.phase === 'leaving' ? clamp((CHASE_RULES.leave - (chase.t - chase.since)) / CHASE_RULES.fade, 0, 1) : 1;

    const nav = navGrid(world);
    let input;
    if (chase.phase === 'stopped') {
        input = { throttle: 0, steer: 0, brake: true };
    } else if (chase.phase === 'chasing' && d < DIRECT && clearLine(nav, car, player)) {
        input = driveTo(car, player, KEEP);
    } else {
        const goal = chase.phase === 'chasing' ? player : chase.exit;
        // You move, so chasing replans twice a second; the way out doesn't, so it's planned once (again if stuck).
        if (!chase.path || chase.t >= chase.replanAt) {
            chase.path = findPath(nav, car, goal);
            chase.replanAt = chase.phase === 'chasing' ? chase.t + REPLAN : Infinity;
        }
        input = driveTo(car, chase.path ? aimAlong(chase.path, car) : goal);
    }

    // Stuck against something: back up, turning the nose towards where it wants to go, then think again.
    if (chase.reverseFor > 0) {
        chase.reverseFor -= dt;
        input = { throttle: -1, steer: -input.steer, brake: false };
    } else if (input.throttle > 0 && Math.abs(car.v) < STUCK.speed) {
        chase.stuckFor += dt;
        if (chase.stuckFor >= STUCK.seconds) {
            chase.stuckFor = 0;
            chase.reverseFor = STUCK.reverse;
            chase.replanAt = 0;
        }
    } else {
        chase.stuckFor = 0;
    }

    const vehicles = [...(others.vehicles ?? []), ...(player ? [{ id: 'you', foot: player.foot }] : [])];
    stepCar(world, car, input, dt, { vehicles, people: others.people ?? [] });
    return event;
};
