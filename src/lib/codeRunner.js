// Code runner (P3-09b): the Arcade mini-game's rules, pure and deterministic for a seed.
// World units: 800 × 300, x to the right, heights measured up from the street. The component only draws and
// feeds input; `step` mutates the state in place (it runs every frame) and lists what happened in `events`.
import { createRandom } from './random.js';

export const WORLD = { width: 800, height: 300, ground: 250 };
export const RUNNER = { x: 80, width: 28, height: 40 };
export const PHYSICS = { gravity: 2400, jump: 820 }; // airtime ≈ 0.68 s, peak ≈ 140
export const SPEED = { start: 320, gain: 12, max: 720 }; // units/s, units/s²
export const BUG = { width: 30, height: 22, tallHeight: 38, tallChance: 0.3 };
export const CUP = { width: 18, height: 22, chance: 0.35, minLift: 50, maxLift: 110, points: 3 };
export const MAX_DT = 0.05; // a long frame (tab switch, GC) can't teleport through a bug
export const RUNNER_EGG_SCORE = 10;
export const BEST_KEY = 'oj-city:runner-best';

const AIRTIME = (2 * PHYSICS.jump) / PHYSICS.gravity;
const HITBOX_INSET = 4; // a little forgiveness on every side

/** Shortest safe gap at `speed`: land, take a step, jump again. */
export const minGap = (speed) => speed * (AIRTIME + 0.1) + RUNNER.width;

export const createGame = (seed = Date.now()) => ({
    random: createRandom(seed),
    time: 0,
    distance: 0, // for the scrolling street
    speed: SPEED.start,
    runner: { y: 0, vy: 0 },
    things: [], // { kind: 'bug' | 'cup', x, w, h, lift, passed? }
    untilSpawn: WORLD.width * 0.6, // the first bug comes after a short run-up
    score: 0,
    over: false,
    events: [],
});

const onGround = (game) => game.runner.y <= 0 && game.runner.vy <= 0; // vy: a jump pressed this frame counts

/** Jumps if the runner is on the ground; returns whether it jumped. */
export const jump = (game) => {
    if (game.over || !onGround(game)) return false;
    game.runner.vy = PHYSICS.jump;
    return true;
};

const spawn = (game) => {
    const { random } = game;
    const tall = random() < BUG.tallChance;
    const x = WORLD.width + 10;
    game.things.push({ kind: 'bug', x, w: BUG.width, h: tall ? BUG.tallHeight : BUG.height, lift: 0 });
    const gap = minGap(game.speed) + random() * game.speed * 0.9;
    if (random() < CUP.chance) {
        const lift = CUP.minLift + random() * (CUP.maxLift - CUP.minLift);
        game.things.push({ kind: 'cup', x: x + gap / 2, w: CUP.width, h: CUP.height, lift });
    }
    game.untilSpawn = gap;
};

const hits = (game, thing) => {
    const left = RUNNER.x + HITBOX_INSET;
    const right = RUNNER.x + RUNNER.width - HITBOX_INSET;
    const bottom = game.runner.y + HITBOX_INSET;
    const top = game.runner.y + RUNNER.height - HITBOX_INSET;
    return right > thing.x && left < thing.x + thing.w && top > thing.lift && bottom < thing.lift + thing.h;
};

/** Advances the game by `dt` seconds (clamped to MAX_DT). Events: 'bug' (jumped one), 'cup', 'over'. */
export const step = (game, dt) => {
    game.events = [];
    if (game.over) return game;
    const t = Math.min(Math.max(dt, 0), MAX_DT);
    game.time += t;
    game.speed = Math.min(SPEED.max, game.speed + SPEED.gain * t);
    const dx = game.speed * t;
    game.distance += dx;

    const { runner } = game;
    runner.vy -= PHYSICS.gravity * t;
    runner.y += runner.vy * t;
    if (runner.y <= 0) { runner.y = 0; runner.vy = 0; }

    for (const thing of game.things) thing.x -= dx;
    game.untilSpawn -= dx;
    if (game.untilSpawn <= 0) spawn(game);

    for (const thing of game.things) {
        if (thing.taken || !hits(game, thing)) continue;
        if (thing.kind === 'cup') {
            thing.taken = true;
            game.score += CUP.points;
            game.events.push('cup');
        } else {
            game.over = true;
            game.events.push('over');
            return game;
        }
    }
    for (const thing of game.things) {
        if (thing.kind === 'bug' && !thing.passed && thing.x + thing.w < RUNNER.x) {
            thing.passed = true;
            game.score += 1;
            game.events.push('bug');
        }
    }
    game.things = game.things.filter((thing) => thing.x + thing.w > -20 && !thing.taken);
    return game;
};

/** Saved best score → a whole number ≥ 0; anything else reads as 0. */
export const parseBest = (raw) => {
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
};
