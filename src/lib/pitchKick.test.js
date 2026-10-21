import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIM, GOAL, KEEPER, createPitch, kick, scoringOffset, settled, simulate, step } from './pitchKick.js';

const shoot = (offset, time = 0) => {
    const state = createPitch(time);
    kick(state, offset);
    return simulate(state);
};

test('a hit near the edge of the ball goes wide or off the post', () => {
    assert.equal(shoot(1), 'wide');
    assert.equal(shoot(-1), 'wide');
    assert.equal(shoot(0.75), 'post');
});

test('a dead-centre hit is always saved, whatever the keeper was doing', () => {
    for (let t = 0; t < 10; t += 0.37) assert.equal(shoot(0, t), 'save', `t=${t}`);
});

test('a corner beats the keeper when he is on the other side', () => {
    const time = Math.PI / 2 / KEEPER.idleRate; // keeper at +idleRange
    assert.ok(createPitch(time).keeper.z > 1);
    assert.equal(shoot(0.55, time), 'goal'); // aimed at −z
    assert.equal(shoot(-0.55, time), 'save'); // aimed at him
});

test('the keyboard kick scores from any moment', () => {
    for (let t = 0; t < 20; t += 0.11) {
        const state = createPitch(t);
        const offset = scoringOffset(state);
        kick(state, offset);
        assert.equal(simulate(state), 'goal', `t=${t}`);
    }
});

test('aim follows the hit: +z side of the ball sends it towards −z', () => {
    const state = createPitch();
    kick(state, 0.5);
    assert.ok(state.ball.vz < 0);
    assert.ok(state.ball.vx > 0);
    assert.equal(-0.5 * AIM < 0, true);
});

test('only one kick at a time, and a goal stops in the net', () => {
    const state = createPitch(Math.PI / 2 / KEEPER.idleRate);
    assert.equal(kick(state, 0.55), true);
    assert.equal(kick(state, 0.55), false);
    assert.equal(simulate(state), 'goal');
    for (let i = 0; i < 300; i++) step(state, 1 / 60);
    assert.ok(state.ball.x <= GOAL.line + GOAL.depth);
    assert.ok(settled(state));
});

test('step reports the result once and clamps long frames', () => {
    const state = createPitch();
    kick(state, 1);
    const results = [];
    for (let i = 0; i < 200; i++) {
        const r = step(state, 1);
        if (r) results.push(r);
    }
    assert.deepEqual(results, ['wide']);
});

test('the keeper idles on the line before the kick and never leaves the goal', () => {
    const state = createPitch();
    for (let i = 0; i < 600; i++) {
        step(state, 1 / 60);
        assert.ok(Math.abs(state.keeper.z) <= KEEPER.idleRange + 1e-9);
    }
    kick(state, 1);
    simulate(state);
    assert.ok(Math.abs(state.keeper.z) <= KEEPER.maxZ + 1e-9);
});
