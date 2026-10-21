// Pitch district (P3-11): a penalty against a simple keeper. Pure; PitchPlot draws it and steps it each frame.
// Pitch-local units: the ball starts on the spot at the origin and is kicked towards +x, where the goal line is.
// Aim comes from where the ball is hit: hitting its +z side sends it towards −z (offset −1..1 across the ball).

export const PITCH = { length: 15, width: 10 };
export const GOAL = { line: 6.5, halfWidth: 2.8, height: 2.4, depth: 1.6, post: 0.1 };
export const BALL = { radius: 0.5, speed: 13, hop: 2.4 };
export const KEEPER = { idleRange: 1.2, idleRate: 1.3, reaction: 0.25, speed: 2, reach: 0.9, maxZ: 2.4 };
export const AIM = 3.6; // goal-line z for a hit on the very edge of the ball

const FRICTION = 0.6; // per second, exponential
const GRAVITY = 14;
const BOUNCE = 0.35;
const STOP_SPEED = 0.3;
const MAX_DT = 1 / 20;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const keeperIdleZ = (time) => Math.sin(time * KEEPER.idleRate) * KEEPER.idleRange;

/** phase: ready (on the spot) → flying → done (result: goal | save | post | wide). */
export const createPitch = (time = 0) => ({
    time,
    phase: 'ready',
    result: null,
    flight: 0,
    ball: { x: 0, y: BALL.radius, z: 0, vx: 0, vy: 0, vz: 0 },
    keeper: { z: keeperIdleZ(time) },
    crossed: false,
});

/** Goal-line z the ball is aimed at for a hit `offset` (−1..1) across the ball. */
export const aimFor = (offset) => -clamp(offset, -1, 1) * AIM;

export const kick = (state, offset) => {
    if (state.phase !== 'ready') return false;
    const targetZ = aimFor(offset);
    const length = Math.hypot(GOAL.line, targetZ);
    state.ball.vx = (GOAL.line / length) * BALL.speed;
    state.ball.vz = (targetZ / length) * BALL.speed;
    state.ball.vy = BALL.hop;
    state.phase = 'flying';
    state.flight = 0;
    return true;
};

const finish = (state, result) => {
    state.phase = 'done';
    state.result = result;
    return result;
};

// The ball travels in a straight line on the ground plane, so the crossing point is known from the kick.
const crossingZ = ({ ball }) => (ball.vx > 0 ? ball.z + (ball.vz / ball.vx) * (GOAL.line - ball.x) : ball.z);

/** Advances by dt seconds. Returns the result on the step it's decided ('goal' | 'save' | 'post' | 'wide'), else null. */
export const step = (state, dt) => {
    dt = Math.min(dt, MAX_DT);
    state.time += dt;
    const { ball, keeper } = state;

    if (state.phase === 'ready') {
        keeper.z = keeperIdleZ(state.time);
        return null;
    }

    // The keeper reacts after a moment, then slides towards where the ball will cross (until it's past him).
    state.flight += dt;
    if (state.phase === 'flying' && state.flight > KEEPER.reaction) {
        const target = clamp(crossingZ(state), -KEEPER.maxZ, KEEPER.maxZ);
        const move = clamp(target - keeper.z, -KEEPER.speed * dt, KEEPER.speed * dt);
        keeper.z += move;
    }

    const prevX = ball.x;
    const decay = Math.exp(-FRICTION * dt);
    ball.vx *= decay;
    ball.vz *= decay;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    ball.vy -= GRAVITY * dt;
    ball.y += ball.vy * dt;
    if (ball.y < BALL.radius) {
        ball.y = BALL.radius;
        ball.vy = Math.abs(ball.vy) * BOUNCE < 0.5 ? 0 : Math.abs(ball.vy) * BOUNCE;
    }

    if (state.phase === 'done') {
        // Settling after the result: the net stops a goal; anything else rolls out.
        if (state.result === 'goal' && ball.x > GOAL.line + GOAL.depth - BALL.radius) {
            ball.x = GOAL.line + GOAL.depth - BALL.radius;
            ball.vx = 0;
            ball.vz *= 0.5;
        }
        return null;
    }

    // The keeper stands just in front of the line.
    const keeperX = GOAL.line - 0.4;
    if (prevX + BALL.radius < keeperX && ball.x + BALL.radius >= keeperX && Math.abs(ball.z - keeper.z) < KEEPER.reach) {
        ball.vx = -Math.abs(ball.vx) * 0.4;
        ball.vz += (ball.z - keeper.z) * 2;
        return finish(state, 'save');
    }

    if (prevX < GOAL.line && ball.x >= GOAL.line) {
        const side = Math.abs(ball.z);
        if (side < GOAL.halfWidth - BALL.radius) return finish(state, 'goal');
        if (side < GOAL.halfWidth + GOAL.post + BALL.radius) {
            ball.vx = -Math.abs(ball.vx) * 0.5;
            ball.vz *= 0.6;
            return finish(state, 'post');
        }
        return finish(state, 'wide');
    }

    // Too weak to reach the line (never with today's speed and friction, but safe).
    if (Math.hypot(ball.vx, ball.vz) < STOP_SPEED) return finish(state, 'wide');
    return null;
};

/** True once a finished kick has stopped or left the pitch, so the ball can go back to the spot. */
export const settled = ({ phase, ball }) =>
    phase === 'done' &&
    (Math.hypot(ball.vx, ball.vz) < STOP_SPEED || Math.abs(ball.x) > PITCH.length / 2 + 1 || Math.abs(ball.z) > PITCH.width / 2 + 1);

/** Runs a kick to its result in fixed steps (reduced motion, keyboard kick planning, tests). */
export const simulate = (state, dt = 1 / 60, maxSteps = 600) => {
    for (let i = 0; i < maxSteps && state.phase === 'flying'; i++) step(state, dt);
    return state.result;
};

const copy = (state) => ({ ...state, ball: { ...state.ball }, keeper: { ...state.keeper } });

// Corner-ish aims first, on the side away from the keeper.
const CANDIDATES = [0.55, 0.6, 0.5, 0.45, 0.4];

/** A hit offset that scores from this exact moment (the keyboard "Kick" button). Falls back to the far corner. */
export const scoringOffset = (state) => {
    const away = state.keeper.z >= 0 ? 1 : -1; // keeper on +z → aim −z → hit the +z side (positive offset)
    for (const magnitude of CANDIDATES) {
        const trial = copy(state);
        kick(trial, away * magnitude);
        if (simulate(trial) === 'goal') return away * magnitude;
    }
    return away * CANDIDATES[0];
};
