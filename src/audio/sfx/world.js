// World & life sounds: footsteps, loot, containers, mounts, sailing, fishing, gathering, honing, stone faceting.
import { CHIME, TUBE, METAL } from '../kit.js';
import { whoosh, mtof, brass, choir, debris, clang, boom, shatter } from './common.js';

const COIN = [[1, 1, 1], [1.51, 0.6, 0.8], [2.37, 0.45, 0.6], [3.2, 0.25, 0.4]];
const ANVIL = [[1, 1, 1], [2.41, 0.7, 0.8], [3.93, 0.5, 0.6], [5.37, 0.3, 0.45], [7.8, 0.15, 0.3]];

function creak(k, t, dur, f = 520, vol = 0.12) {
  // wood friction: a stick-slip buzz (saw with jittery pitch) through a wooden resonance
  const g = k.gain(0, k.filter('bandpass', f * 1.4, 2.5)); k.envPts(g.gain, [[0, 0], [dur * 0.15, vol], [dur * 0.8, vol * 0.8], [dur, 0]], t);
  const o = k.osc('sawtooth', f * 0.25, t, dur + 0.02, g); k.wobble(t, dur, 18, 180, o.detune);
  o.frequency.setValueAtTime(f * 0.22 * k.r, k.at(t)); o.frequency.linearRampToValueAtTime(f * 0.3 * k.r, k.at(t + dur));
  const am = k.gain(0.6); k.lfo(t, dur, k.rnd(22, 35), 0.4, am.gain, 'square');
  k.nz({ t, type: 'bandpass', f: f * 3, q: 3, env: [[0, 0], [dur * 0.2, 1], [dur, 0]], vol: vol * 0.5, dest: am });
}
function drop(k, t, f = 700, vol = 0.14, dest = k.out) { k.tone({ t, fc: [[0, f], [0.03, f * 2]], a: 0.001, d: 0.07, vol, dest }); k.nz({ t, type: 'lowpass', f: 1500, a: 0.001, d: 0.04, vol: vol * 1.2, dest }); }
function hoof(k, t, v = 1) {
  k.thump({ t, f0: 180, f1: 90, sweep: 0.025, d: 0.07, vol: 0.34 * v });
  k.nz({ t, type: 'bandpass', f: k.rnd(1600, 2400), q: 2.5, a: 0.0005, d: 0.02, vol: 0.28 * v });
  k.nz({ t, color: 'pink', type: 'lowpass', f: 700, a: 0.001, d: 0.05, vol: 0.2 * v });
}

export const MOVE = {
  footstep_stone: {
    max: 4, range: 28, ref: 3, rev: 0.06, burst: 2, gap: 0.05, jitter: 0.06,
    fn: (k) => {
      const p = k.vary(1, 0.12), v = k.vary(1, 0.15);
      k.nz({ type: 'bandpass', f: 2600 * p, q: 2.2, a: 0.0005, d: 0.025, vol: 0.4 * v });
      k.tone({ f: 950 * p, a: 0.0005, d: 0.035, vol: 0.05 * v });
      k.thump({ f0: 160 * p, f1: 105 * p, sweep: 0.02, d: 0.05, vol: 0.2 * v });
      k.nz({ t: 0.004, type: 'highpass', f: 5000, a: 0.001, d: 0.02, vol: 0.08 * v });
    },
  },
  footstep_grass: {
    max: 4, range: 28, ref: 3, rev: 0.03, burst: 2, gap: 0.05, jitter: 0.06,
    fn: (k) => {
      const p = k.vary(1, 0.12), v = k.vary(1, 0.15);
      for (let i = 0; i < 3; i++) k.nz({ t: i * k.rnd(0.012, 0.025), type: 'bandpass', f: k.rnd(1800, 3200) * p, q: 0.9, a: 0.002, d: k.rnd(0.04, 0.08), vol: 0.3 * v * (1 - i * 0.25) });
      k.thump({ f0: 95 * p, f1: 60 * p, sweep: 0.04, d: 0.07, vol: 0.22 * v });
      k.nz({ color: 'pink', type: 'lowpass', f: 450 * p, a: 0.002, d: 0.05, vol: 0.14 * v });
    },
  },
  footstep_snow: {
    max: 4, range: 28, ref: 3, rev: 0.03, burst: 2, gap: 0.05, jitter: 0.06,
    fn: (k) => {
      const p = k.vary(1, 0.1), v = k.vary(1, 0.15), d = k.rnd(0.09, 0.14);
      k.nz({ color: 'pink', type: 'lowpass', f: 2200 * p, env: [[0, 0], [0.01, 1], [d, 0.3], [d + 0.05, 0]], vol: 0.3 * v });
      for (let i = 0; i < 9; i++) k.nz({ t: k.rnd(0, d), type: 'bandpass', f: k.rnd(1200, 4200), q: 3, a: 0.0004, d: k.rnd(0.004, 0.012), vol: 0.22 * v }); // crystal crunch
      k.thump({ f0: 110 * p, f1: 70 * p, sweep: 0.04, d: 0.08, vol: 0.14 * v });
    },
  },
  dig: {
    max: 3, range: 30, rev: 0.05,
    fn: (k) => {
      k.nz({ color: 'pink', type: 'bandpass', f: 1400, q: 0.8, a: 0.004, d: 0.12, vol: 0.4 }); // blade in
      k.thump({ f0: 140, f1: 80, sweep: 0.03, d: 0.1, vol: 0.3 });
      k.nz({ t: 0.08, type: 'bandpass', fc: [[0, 1800], [0.2, 900]], q: 1.4, env: [[0, 0], [0.03, 1], [0.22, 0]], vol: 0.2 }); // scrape
      k.nz({ t: 0.3, color: 'brown', type: 'lowpass', f: 900, env: [[0, 0], [0.03, 1], [0.35, 0]], vol: 0.3 }); // dirt falls
      debris(k, { t: 0.3, n: 8, dur: 0.35, lo: 500, hi: 1800, vol: 0.1 });
      return 0.8;
    },
  },
  chop: {
    clip: 1.4, max: 3, range: 40, rev: 0.08,
    fn: (k) => {
      const p = k.vary(1, 0.08);
      k.thump({ f0: 240 * p, f1: 150 * p, sweep: 0.02, d: 0.09, vol: 0.45 });
      k.nz({ type: 'bandpass', f: 420 * p, q: 3, a: 0.0006, d: 0.1, vol: 0.5 }); // woody knock
      k.tone({ f: 510 * p, a: 0.0006, d: 0.12, vol: 0.06 });
      k.nz({ type: 'highpass', f: 2500, a: 0.0005, d: 0.02, vol: 0.3 });
      debris(k, { t: 0.01, n: 5, dur: 0.25, lo: 1500, hi: 4000, vol: 0.08 });
    },
  },
  mine: {
    clip: 1.4, max: 3, range: 40, rev: 0.1,
    fn: (k) => {
      const p = k.vary(1, 0.08);
      k.bell({ f: 2150 * p, vol: 0.08, d: 0.35, partials: METAL, spread: 0.02 });
      k.nz({ type: 'highpass', f: 3000, a: 0.0004, d: 0.02, vol: 0.4 });
      k.nz({ type: 'bandpass', f: 1100 * p, q: 1.5, a: 0.0006, d: 0.06, vol: 0.4 });
      k.thump({ f0: 200, f1: 120, sweep: 0.02, d: 0.06, vol: 0.25 });
      debris(k, { t: 0.03, n: 9, dur: 0.5, vol: 0.12 });
      return 0.7;
    },
  },
  gather: {
    max: 3, range: 30, rev: 0.05,
    fn: (k) => {
      const fl = k.gain(0.6); k.lfo(0, 0.4, k.rnd(14, 20), 0.4, fl.gain);
      k.nz({ type: 'bandpass', f: k.rnd(3000, 4500), q: 0.9, env: [[0, 0], [0.05, 1], [0.3, 0.6], [0.4, 0]], vol: 0.25, dest: fl }); // rustle
      k.nz({ t: 0.32, type: 'bandpass', f: 2200, q: 3, a: 0.0005, d: 0.02, vol: 0.3 }); // snap
      k.tone({ t: 0.33, fc: [[0, 500], [0.03, 900]], a: 0.001, d: 0.05, vol: 0.06 }); // pop
      return 0.6;
    },
  },
};

export const LOOT = {
  coin: {
    max: 3, range: 30, rev: 0.05,
    fn: (k) => {
      const n = 3 + Math.floor(k.rnd(0, 3.99));
      for (let i = 0; i < n; i++) {
        const t = Math.pow(k.rnd(), 1.3) * 0.25;
        k.bell({ t, f: k.rnd(2400, 4200), vol: k.rnd(0.05, 0.1), d: k.rnd(0.12, 0.3), partials: COIN, spread: 0.02 });
        k.nz({ t, type: 'highpass', f: 6000, a: 0.0005, d: 0.012, vol: 0.12 });
      }
    },
  },
  loot_drop: {
    max: 4, range: 40, rev: 0.06,
    fn: (k) => {
      k.thump({ f0: 190, f1: 110, sweep: 0.025, d: 0.08, vol: 0.34 });
      k.nz({ type: 'bandpass', f: 1200, q: 1.2, a: 0.001, d: 0.04, vol: 0.25 });
      k.thump({ t: 0.11, f0: 220, f1: 140, sweep: 0.02, d: 0.05, vol: 0.14 }); // bounce
      k.bell({ t: 0.01, f: k.rnd(2600, 3400), vol: 0.035, d: 0.2, partials: COIN });
    },
  },
  loot_rare: {
    max: 2, range: 80, ref: 10, rev: 0.06, hall: 0.25, pri: 2, jitter: 0.01,
    fn: (k) => {
      [76, 81, 83, 88].forEach((m, i) => k.bell({ t: i * 0.06, f: mtof(m), vol: 0.09, d: 1.2, partials: CHIME }));
      k.tone({ t: 0.18, type: 'triangle', f: mtof(64), env: [[0, 0], [0.08, 1], [1.1, 0]], vol: 0.04, vib: [5, 5] });
      k.nz({ type: 'highpass', f: 6500, env: [[0, 0], [0.2, 1], [1.2, 0]], vol: 0.06 });
      k.sparkle({ t: 0.2, dur: 0.9, n: 10, notes: [88, 93, 95, 100].map(mtof), vol: 0.03 });
      return 1.6;
    },
  },
  // THE dopamine one: riser → golden orchestral hit (brass + choir + sub) → Lydian bell cascade → long glitter
  loot_legendary: {
    clip: 1.3, max: 1, range: 150, ref: 20, rev: 0.06, hall: 0.5, pri: 3, duck: [0.5, 3], jitter: 0, labDur: 6,
    fn: (k) => {
      const T = 0.36;
      k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 300], [T, 6500]], q: 1, env: [[0, 0], [T * 0.9, 1], [T, 0]], vol: 0.32 });
      k.tone({ type: 'triangle', fc: [[0, 147], [T, 587]], env: [[0, 0], [T * 0.9, 1], [T, 0]], vol: 0.06 });
      boom(k, { t: T, vol: 0.5, d: 2.2, f0: 90, f1: 36 });
      k.nz({ t: T, type: 'highpass', f: 3500, a: 0.002, d: 2.6, vol: 0.12 }); // cymbal-ish air
      for (const m of [50, 57, 62, 66, 69, 76]) brass(k, { t: T, f: mtof(m), dur: 1.5, vol: m < 55 ? 0.065 : 0.05, bright: 3.4, a: 0.015, r: 1.2 });
      choir(k, { t: T, notes: [62, 66, 69, 74, 76], dur: 1.9, a: 0.1, r: 1.5, vol: 0.05, vowel: 'ah', vowel2: 'oh' });
      [74, 76, 78, 80, 81, 86, 88, 90, 93, 98].forEach((m, i) => k.bell({ t: T + 0.04 + i * 0.065, f: mtof(m), vol: 0.085 - i * 0.004, d: 2.2 - i * 0.1 }));
      k.sparkle({ t: T + 0.4, dur: 3.4, n: 38, notes: [86, 88, 90, 92, 93, 98, 100, 102].map(mtof), vol: 0.04, d: 0.7 });
      k.nz({ t: T, type: 'highpass', f: 7000, env: [[0, 0], [0.4, 1], [3.8, 0]], vol: 0.06 });
      return T + 4.4;
    },
  },
  chest_open: {
    max: 2, range: 40, rev: 0.1, hall: 0.1,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2600, q: 3, a: 0.0005, d: 0.02, vol: 0.3 }); k.thump({ f0: 400, f1: 250, sweep: 0.02, d: 0.04, vol: 0.2 }); // latch
      creak(k, 0.08, 0.55, 480, 0.1);
      k.thump({ t: 0.66, f0: 150, f1: 90, sweep: 0.03, d: 0.12, vol: 0.34 }); k.nz({ t: 0.66, type: 'bandpass', f: 700, q: 1.4, a: 0.001, d: 0.06, vol: 0.28 }); // lid lands
      k.sparkle({ t: 0.5, dur: 0.7, n: 9, notes: [84, 88, 91, 96].map(mtof), vol: 0.03 });
      return 1.4;
    },
  },
  door_open: {
    max: 2, range: 40, rev: 0.12,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2200, q: 3, a: 0.0005, d: 0.025, vol: 0.3 }); k.thump({ f0: 300, f1: 200, sweep: 0.02, d: 0.04, vol: 0.16 });
      creak(k, 0.06, 0.9, 360, 0.11);
      k.nz({ t: 0.1, color: 'pink', type: 'lowpass', f: 500, env: [[0, 0], [0.3, 1], [0.95, 0]], vol: 0.08 }); // air movement
      return 1.2;
    },
  },
};

export const TRAVEL = {
  mount_summon: {
    max: 1, range: 50, rev: 0.1, hall: 0.2,
    fn: (k) => {
      whoosh(k, { dur: 0.35, f0: 600, fPeak: 3000, f1: 1500, q: 1, vol: 0.3, peakAt: 0.7 });
      k.sparkle({ t: 0.2, dur: 0.5, n: 9, lo: 3000, hi: 8000, vol: 0.03 });
      k.nz({ t: 0.32, color: 'pink', type: 'lowpass', f: 1500, a: 0.004, d: 0.3, vol: 0.3 }); // poof
      hoof(k, 0.4, 1); hoof(k, 0.52, 0.8);
      k.voice({ t: 0.7, src: 'sawtooth', pitch: [[0, 180], [0.15, 150], [0.35, 120]], amp: [[0, 0], [0.03, 0.6], [0.3, 0.4], [0.4, 0]], formants: [[0, [500, 1100, 2400]]], q: [3, 4, 5], fg: [1, 0.5, 0.2], breath: 0.8, fry: 0.5, fryRate: 40, vol: 0.18 }); // snort
      return 1.3;
    },
  },
  // one gallop stride (play repeatedly), or loop('horse_gallop') for a continuous canter
  horse_gallop: {
    loop: { dur: 2.4, xf: 0.02 }, max: 3, range: 45, rev: 0.05, jitter: 0.04,
    fn: (k, o) => {
      const stride = 0.6, n = o.loop ? Math.round((o.dur - 0.02) / stride) : 1;
      for (let i = 0; i < n; i++) { const t = i * stride; hoof(k, t, 0.8); hoof(k, t + 0.1, 0.7); hoof(k, t + 0.19, 1); hoof(k, t + 0.3, 0.55); }
      return n * stride;
    },
  },
  ship_bell: {
    max: 1, range: 90, ref: 10, rev: 0.1, hall: 0.3, jitter: 0.01,
    fn: (k) => { for (const t of [0, 0.42]) { k.bell({ t, f: 880, vol: 0.14, d: 2.6, partials: TUBE, spread: 0.004 }); k.nz({ t, type: 'bandpass', f: 2800, q: 2, a: 0.0006, d: 0.03, vol: 0.2 }); } return 3.2; },
  },
  cannon: {
    clip: 1.4, max: 4, range: 150, ref: 12, rev: 0.2, hall: 0.2, pri: 2, duck: [0.3, 1.2], labDur: 3,
    fn: (k) => {
      boom(k, { vol: 0.62, d: 1.6, f0: 100, f1: 34 });
      k.nz({ type: 'lowpass', fc: [[0, 5000], [0.3, 700]], a: 0.0006, d: 0.35, vol: 0.6 });
      k.nz({ type: 'highpass', f: 1800, a: 0.0005, d: 0.05, vol: 0.45 });
      k.tone({ t: 0.08, fc: [[0, 2600], [1.0, 900]], env: [[0, 0], [0.05, 1], [1.0, 0]], vol: 0.025 }); // ball whistle
      k.nz({ t: 0.25, color: 'pink', type: 'bandpass', f: 500, q: 0.7, a: 0.02, d: 1.2, vol: 0.14 }); // sea echo
      return 2;
    },
  },
  wave_splash: {
    max: 3, range: 60, ref: 6, rev: 0.06,
    fn: (k) => {
      const d = k.vary(1.1, 0.2);
      k.nz({ color: 'pink', type: 'lowpass', fc: [[0, 500], [d * 0.3, 2400], [d, 600]], env: [[0, 0], [d * 0.25, 1], [d, 0]], vol: 0.5 });
      k.nz({ type: 'highpass', f: 3500, env: [[0, 0], [d * 0.3, 1], [d * 1.1, 0]], vol: 0.12 }); // spray
      k.nz({ color: 'brown', type: 'lowpass', f: 250, env: [[0, 0], [d * 0.2, 1], [d * 0.8, 0]], vol: 0.35 });
      for (let i = 0; i < 8; i++) drop(k, d * 0.3 + k.rnd(0, d * 0.6), k.rnd(500, 1300), 0.04);
      return d + 0.3;
    },
  },
  sail_flap: {
    max: 2, range: 50, rev: 0.05,
    fn: (k) => {
      const d = k.vary(0.7, 0.2), fl = k.gain(0.5); k.lfo(0, d, k.rnd(11, 17), 0.5, fl.gain, 'triangle');
      k.nz({ color: 'pink', type: 'bandpass', f: k.rnd(700, 1100), q: 0.8, env: [[0, 0], [0.04, 1], [d * 0.6, 0.6], [d, 0]], vol: 0.5, dest: fl });
      k.nz({ type: 'bandpass', f: 400, q: 0.8, a: 0.002, d: 0.06, vol: 0.3 }); // the snap
      return d + 0.1;
    },
  },
  fishing_cast: {
    max: 2, range: 35, rev: 0.05,
    fn: (k) => {
      whoosh(k, { dur: 0.22, f0: 1200, fPeak: 4200, f1: 1800, q: 1.4, vol: 0.4, peakAt: 0.4 });
      const am = k.gain(0.5); k.lfo(0.15, 0.55, 42, 0.5, am.gain, 'square');
      k.nz({ t: 0.15, type: 'bandpass', fc: [[0, 5200], [0.55, 3000]], q: 3, env: [[0, 0], [0.03, 1], [0.55, 0]], vol: 0.12, dest: am }); // line zips off the reel
      drop(k, 0.85, 620, 0.16); k.nz({ t: 0.85, color: 'pink', type: 'lowpass', f: 1200, env: [[0, 0], [0.02, 1], [0.25, 0]], vol: 0.18 });
      return 1.2;
    },
  },
  fishing_bite: {
    bus: 'sfx', max: 1, range: 40, rev: 0.05, pri: 2,
    fn: (k) => {
      drop(k, 0, 480, 0.2); drop(k, 0.16, 520, 0.14);
      k.nz({ color: 'pink', type: 'lowpass', f: 1500, env: [[0, 0], [0.02, 1], [0.3, 0]], vol: 0.25 });
      k.bell({ t: 0.02, f: mtof(88), vol: 0.06, d: 0.5, partials: CHIME }); // "!" ting
      return 0.7;
    },
  },
  fishing_reel: {
    max: 2, range: 30, rev: 0.03,
    fn: (k) => {
      const d = 0.8, rate = k.rnd(18, 24);
      for (let t = 0; t < d; t += 1 / rate) k.nz({ t, type: 'bandpass', f: 3200, q: 4, a: 0.0004, d: 0.008, vol: 0.18 });
      k.tone({ fc: [[0, 900], [d, 1300]], env: [[0, 0], [0.1, 1], [d, 0]], vol: 0.015 });
      return d + 0.1;
    },
  },
  bell: {
    max: 2, range: 200, ref: 20, rev: 0.1, hall: 0.4, jitter: 0.01, labDur: 5,
    fn: (k) => { k.bell({ f: 330, vol: 0.18, d: 4.5, partials: TUBE, spread: 0.003 }); k.bell({ f: 330 * 2.01, vol: 0.05, d: 3, partials: TUBE }); k.nz({ type: 'bandpass', f: 1800, q: 1.5, a: 0.001, d: 0.04, vol: 0.18 }); return 5; },
  },
};

export const CRAFT = {
  honing_hammer: {
    clip: 1.4, bus: 'ui', max: 3, burst: 2, gap: 0.08, hall: 0.25,
    fn: (k) => {
      const p = k.vary(1, 0.03);
      k.bell({ f: 1150 * p, vol: 0.12, d: 1.2, partials: ANVIL, spread: 0.01 });
      k.nz({ type: 'highpass', f: 2500, a: 0.0004, d: 0.03, vol: 0.45 });
      k.thump({ f0: 220, f1: 120, sweep: 0.02, d: 0.08, vol: 0.34 });
      k.sparkle({ t: 0.01, dur: 0.25, n: 8, lo: 4000, hi: 10000, vol: 0.03, d: 0.15 }); // sparks
      return 1.3;
    },
  },
  // success: the hammer rings, a golden arpeggio climbs, brass + choir bloom, sparks burst
  honing_success: {
    clip: 1.3, bus: 'ui', max: 1, hall: 0.5, pri: 3, duck: [0.45, 2.6], jitter: 0, labDur: 5,
    fn: (k) => {
      CRAFT.honing_hammer.fn(k);
      const T = 0.3;
      [67, 71, 74, 79, 83, 86].forEach((m, i) => k.bell({ t: T + i * 0.06, f: mtof(m + 12), vol: 0.08, d: 1.8, partials: CHIME }));
      for (const m of [55, 62, 67, 71, 74]) brass(k, { t: T + 0.36, f: mtof(m), dur: 1.3, vol: m < 60 ? 0.06 : 0.05, bright: 3.3, a: 0.015, r: 1.1 });
      choir(k, { t: T + 0.36, notes: [67, 71, 74, 79], dur: 1.6, a: 0.08, r: 1.2, vol: 0.05, vowel: 'ah' });
      boom(k, { t: T + 0.36, vol: 0.4, d: 1.8, f0: 98, f1: 49 });
      k.sparkle({ t: T + 0.4, dur: 2.4, n: 30, notes: [86, 91, 95, 98, 103].map(mtof), vol: 0.04, d: 0.6 });
      k.nz({ t: T + 0.36, type: 'highpass', f: 6500, env: [[0, 0], [0.3, 1], [2.6, 0]], vol: 0.07 });
      return T + 3.4;
    },
  },
  // failure: the strike, then a muted, sagging brass figure and a fizzle — sympathetic, not a joke
  honing_fail: {
    bus: 'ui', max: 1, hall: 0.3, pri: 2, jitter: 0, labDur: 4,
    fn: (k) => {
      CRAFT.honing_hammer.fn(k.sub(0, k.gain(0.8)));
      const T = 0.45, mute = k.filter('lowpass', 900, 1.2, k.gain(1));
      k.lfo(T, 1.6, 2.2, 250, mute.frequency); // plunger "wah"
      [[0, 58, 0.22], [0.26, 57, 0.22], [0.52, 56, 0.85]].forEach(([dt, m, d]) => brass(k, { t: T + dt, f: mtof(m), dur: d, vol: 0.075, bright: 1.6, a: 0.03, r: 0.3, dest: mute, scoop: 50 }));
      k.tone({ t: T + 0.52, type: 'triangle', fc: [[0, mtof(56)], [0.9, mtof(55) * 0.97]], env: [[0, 0], [0.1, 1], [0.9, 0]], vol: 0.03 });
      k.nz({ t: 0.1, type: 'highpass', fc: [[0, 6000], [0.8, 1500]], env: [[0, 0], [0.05, 1], [0.8, 0]], vol: 0.07 }); // sparks fizzle out
      k.thump({ t: T + 0.52, f0: 90, f1: 60, sweep: 0.1, d: 0.4, vol: 0.2 });
      return T + 1.8;
    },
  },
  stone_facet_success: {
    bus: 'ui', max: 2, hall: 0.3, jitter: 0.01,
    fn: (k) => {
      k.bell({ f: mtof(86), vol: 0.1, d: 1.1, partials: [[1, 1, 1], [2.76, 0.3, 0.5], [5.4, 0.12, 0.3]] });
      k.bell({ t: 0.08, f: mtof(93), vol: 0.1, d: 1.3, partials: [[1, 1, 1], [2.76, 0.3, 0.5], [5.4, 0.12, 0.3]] });
      k.nz({ type: 'highpass', f: 4000, a: 0.001, d: 0.05, vol: 0.18 });
      k.sparkle({ t: 0.1, dur: 0.5, n: 7, notes: [98, 100, 105].map(mtof), vol: 0.025 });
      return 1.5;
    },
  },
  stone_facet_fail: {
    bus: 'ui', max: 2, hall: 0.12, jitter: 0.02,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 900, q: 2, a: 0.0006, d: 0.05, vol: 0.4 });
      k.thump({ f0: 170, f1: 95, sweep: 0.04, d: 0.12, vol: 0.34 });
      k.tone({ type: 'triangle', f: mtof(50), env: [[0, 0], [0.01, 1], [0.35, 0]], vol: 0.06 });
      debris(k, { t: 0.02, n: 5, dur: 0.25, lo: 1500, hi: 3500, vol: 0.06 });
      return 0.6;
    },
  },
};
