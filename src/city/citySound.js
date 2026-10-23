// City sounds (P3B-06): horns, a goat, a hen, the crossing button, the engine of the taxi you ride in and the police
// siren (P3B-11), made with Web Audio (no files to download).
// Silent unless the visitor turned sound on (useSoundStore); the audio context starts on the first sound, which
// always follows a click, so browsers allow it.
import useSoundStore from '../store/useSoundStore.js';

const VOLUME = 0.35;
let context = null;
let master = null;

const audio = () => {
    if (!useSoundStore.getState().on) return null;
    try {
        if (!context) {
            const Context = window.AudioContext ?? window.webkitAudioContext;
            if (!Context) return null;
            context = new Context();
            master = context.createGain();
            master.gain.value = VOLUME;
            master.connect(context.destination);
        }
        if (context.state === 'suspended') context.resume();
        return context;
    } catch {
        return null;
    }
};

// One note: oscillator(s) → optional filter → envelope → master.
const note = (ctx, { at = 0, length, freqs, type = 'square', gain = 0.2, filter, bend = 1, vibrato }) => {
    const t0 = ctx.currentTime + at;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    env.gain.setValueAtTime(gain, t0 + length * 0.7);
    env.gain.linearRampToValueAtTime(0, t0 + length);
    let out = env;
    if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = filter.type;
        f.frequency.value = filter.freq;
        f.Q.value = filter.q ?? 1;
        f.connect(env);
        out = f;
    }
    env.connect(master);
    for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.linearRampToValueAtTime(freq * bend, t0 + length);
        if (vibrato) {
            const lfo = ctx.createOscillator();
            const depth = ctx.createGain();
            lfo.frequency.value = vibrato.rate;
            depth.gain.value = vibrato.depth;
            lfo.connect(depth).connect(osc.frequency);
            lfo.start(t0);
            lfo.stop(t0 + length);
        }
        osc.connect(out);
        osc.start(t0);
        osc.stop(t0 + length + 0.02);
    }
};

const HORNS = {
    moto: { freqs: [620, 780], length: 0.09, gap: 0.13, times: 2 },
    heavy: { freqs: [220, 277], length: 0.45, gap: 0, times: 1 }, // bus and trucks
    car: { freqs: [392, 494], length: 0.16, gap: 0.22, times: 2 },
};
const HEAVY = new Set(['bus', 'timberTruck', 'bananaTruck']);

/** Beep beep (a moto pips, buses and trucks blare). */
export const playHorn = (type) => {
    const ctx = audio();
    if (!ctx) return;
    const horn = type === 'moto' ? HORNS.moto : HEAVY.has(type) ? HORNS.heavy : HORNS.car;
    for (let i = 0; i < horn.times; i++) {
        note(ctx, { at: i * horn.gap, length: horn.length, freqs: horn.freqs, gain: 0.12, filter: { type: 'lowpass', freq: 2000 } });
    }
};

/** Mèèè. */
export const playBleat = () => {
    const ctx = audio();
    if (!ctx) return;
    note(ctx, {
        length: 0.65, freqs: [430], type: 'sawtooth', gain: 0.25, bend: 0.85,
        filter: { type: 'bandpass', freq: 1100, q: 2.5 }, vibrato: { rate: 9, depth: 35 },
    });
};

/** Bwok bwok bwok. */
export const playCluck = () => {
    const ctx = audio();
    if (!ctx) return;
    for (let i = 0; i < 3; i++) {
        note(ctx, { at: i * 0.11, length: 0.07, freqs: [950], type: 'triangle', gain: 0.22, bend: 0.6, filter: { type: 'bandpass', freq: 1300, q: 2 } });
    }
};

/** The crossing button's beep. */
export const playButton = () => {
    const ctx = audio();
    if (!ctx) return;
    note(ctx, { length: 0.08, freqs: [1046], type: 'sine', gain: 0.15 });
};

/**
 * The police siren (P3B-11): two tones in turn, quieter the further away the police car is. Returns
 * { set(distance), stop() }, or null when sound is off.
 */
export const startSiren = () => {
    const ctx = audio();
    if (!ctx) return null;
    const tone = ctx.createOscillator();
    tone.type = 'square';
    // Hi–lo every 0.45 s, scheduled 20 s ahead and topped up as the chase goes on.
    let next = ctx.currentTime;
    let high = true;
    const schedule = () => {
        for (; next < ctx.currentTime + 20; next += 0.45, high = !high) tone.frequency.setValueAtTime(high ? 870 : 650, next);
    };
    schedule();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const level = ctx.createGain();
    level.gain.value = 0;
    tone.connect(filter).connect(level).connect(master);
    tone.start();
    return {
        set: (distance) => {
            if (next < ctx.currentTime + 10) schedule();
            level.gain.setTargetAtTime(0.09 * Math.max(0.15, 1 - distance / 30), ctx.currentTime, 0.2);
        },
        stop: () => {
            level.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            tone.stop(ctx.currentTime + 0.5);
        },
    };
};

/**
 * A taxi engine for the ride you're on: a low hum whose pitch and level follow the speed (units/s). Returns
 * { set(speed), stop() }, or null when sound is off.
 */
export const startEngine = () => {
    const ctx = audio();
    if (!ctx) return null;
    const idle = 38;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = idle;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = idle / 2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const level = ctx.createGain();
    level.gain.value = 0;
    hum.connect(filter);
    sub.connect(filter);
    filter.connect(level);
    level.connect(master);
    hum.start();
    sub.start();
    level.gain.setTargetAtTime(0.08, ctx.currentTime, 0.3);
    return {
        set: (speed) => {
            const t = ctx.currentTime;
            const f = idle + Math.min(speed, 3.5) * 20;
            hum.frequency.setTargetAtTime(f, t, 0.2);
            sub.frequency.setTargetAtTime(f / 2, t, 0.2);
            level.gain.setTargetAtTime(0.07 + Math.min(speed, 3.5) * 0.025, t, 0.25);
        },
        stop: () => {
            const t = ctx.currentTime;
            level.gain.setTargetAtTime(0, t, 0.12);
            hum.stop(t + 0.6);
            sub.stop(t + 0.6);
        },
    };
};
