import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUG, CUP, PHYSICS, RUNNER, SPEED, createGame, jump, minGap, parseBest, step } from './codeRunner.js';

const DT = 1 / 60;
const run = (game, seconds, onFrame = () => {}) => {
    const events = [];
    for (let i = 0; i < seconds / DT && !game.over; i++) {
        onFrame(game);
        events.push(...step(game, DT).events);
    }
    return events;
};

// Jumps when the next bug is about to reach the runner: a perfect player.
const autopilot = (game) => {
    const next = game.things.find((t) => t.kind === 'bug' && t.x + t.w > RUNNER.x);
    if (next && next.x - (RUNNER.x + RUNNER.width) < game.speed * 0.12) jump(game);
};

test('runner: a jump goes up and lands back on the street; no double jump', () => {
    const game = createGame('jump');
    assert.equal(jump(game), true);
    assert.equal(jump(game), false, 'already in the air');
    let peak = 0;
    let frames = 0;
    do { step(game, DT); peak = Math.max(peak, game.runner.y); frames++; } while (game.runner.y > 0 && frames < 120);
    assert.ok(peak > BUG.tallHeight * 2, `peak ${peak}`);
    assert.equal(game.runner.y, 0);
    assert.ok(frames * DT > 0.6 && frames * DT < 0.75, `airtime ${frames * DT}`);
    assert.equal(jump(game), true, 'can jump again after landing');
});

test('runner: standing still, the first bug ends the game', () => {
    const game = createGame('idle');
    const events = run(game, 10);
    assert.equal(game.over, true);
    assert.deepEqual(events.filter((e) => e !== 'cup'), ['over']);
    assert.equal(step(game, DT).events.length, 0, 'nothing happens after game over');
});

test('runner: every gap can be cleared, up to top speed (seeded runs)', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        const game = createGame(seed);
        const events = run(game, 60, autopilot);
        assert.equal(game.over, false, `seed ${seed} died at ${game.time.toFixed(1)} s, speed ${game.speed}`);
        assert.equal(game.speed, SPEED.max);
        const bugs = events.filter((e) => e === 'bug').length;
        const cups = events.filter((e) => e === 'cup').length;
        assert.equal(game.score, bugs + cups * CUP.points);
        assert.ok(bugs > 30, `${bugs} bugs`);
    }
});

test('runner: same seed, same game', () => {
    const a = createGame('same');
    const b = createGame('same');
    run(a, 20, autopilot);
    run(b, 20, autopilot);
    assert.equal(a.score, b.score);
    assert.deepEqual(a.things.map((t) => [t.kind, Math.round(t.x)]), b.things.map((t) => [t.kind, Math.round(t.x)]));
});

test('runner: a long frame is clamped, so nothing is skipped', () => {
    const game = createGame('lag');
    step(game, 10);
    assert.ok(game.time <= 0.05 + 1e-9);
    step(game, -1);
    assert.ok(game.time <= 0.05 + 1e-9);
});

test('runner: the safe gap grows with speed and fits a full jump', () => {
    const airtime = (2 * PHYSICS.jump) / PHYSICS.gravity;
    for (const speed of [SPEED.start, SPEED.max]) assert.ok(minGap(speed) > speed * airtime + RUNNER.width);
});

test('runner: saved best score is a whole number ≥ 0', () => {
    assert.equal(parseBest('42'), 42);
    for (const bad of [null, '', 'abc', '-3', '1.5', '1e400']) assert.equal(parseBest(bad), 0);
});
