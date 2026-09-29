// Skill & magic sounds: elements, holy/dark, songweaver notes, buffs, portals, awakenings, identity. Bus 'sfx'.
import { CHIME, TUBE, METAL } from '../kit.js';
import { whoosh, choir, mtof, brass, shatter, crackles, zap, boom } from './common.js';

const PENTA = [0, 2, 4, 7, 9];

export const MAGIC = {
  magic_cast: {
    max: 4, range: 45, rev: 0.12, hall: 0.1,
    fn: (k) => {
      const d = k.vary(0.4, 0.1);
      k.nz({ type: 'bandpass', fc: [[0, 700], [d, 4200]], q: 1.4, env: [[0, 0], [d * 0.8, 1], [d, 0]], vol: 0.3 });
      k.tone({ fc: [[0, 420], [d, 1250]], env: [[0, 0], [d * 0.7, 1], [d, 0]], vol: 0.06, vib: [7, 15] });
      k.tone({ type: 'triangle', fc: [[0, 840], [d, 2500]], env: [[0, 0], [d * 0.7, 1], [d, 0]], vol: 0.02 });
      k.sparkle({ t: d * 0.6, dur: 0.35, n: 7, lo: 3500, hi: 9000, vol: 0.03 });
      return d + 0.4;
    },
  },
  fire: {
    clip: 1.4, max: 4, range: 55, rev: 0.12,
    fn: (k) => {
      const p = k.vary(1, 0.08);
      k.nz({ color: 'brown', type: 'lowpass', fc: [[0, 1600 * p], [0.5, 380 * p]], q: 0.8, a: 0.008, d: 0.6, vol: 0.7 });
      whoosh(k, { dur: 0.42, f0: 2400 * p, fPeak: 1700 * p, f1: 500 * p, q: 1, vol: 0.3, peakAt: 0.12 });
      k.thump({ f0: 130 * p, f1: 62 * p, sweep: 0.08, d: 0.22, vol: 0.34 });
      crackles(k, 10, 0.02, 0.6, 0.2);
      return 0.8;
    },
  },
  fire_big: {
    clip: 1.4, max: 3, range: 80, rev: 0.16, pri: 2, duck: [0.25, 1], labDur: 3,
    fn: (k) => {
      k.thump({ f0: 115, f1: 44, sweep: 0.12, d: 0.7, vol: 0.55 });
      k.nz({ color: 'pink', type: 'bandpass', f: 320, q: 0.8, a: 0.002, d: 0.4, vol: 0.42 });
      k.nz({ color: 'pink', type: 'lowpass', fc: [[0, 3800], [0.9, 220]], q: 0.7, a: 0.003, d: 1.1, vol: 0.6 });
      k.nz({ type: 'highpass', f: 2500, a: 0.0015, d: 0.07, vol: 0.24 });
      const rg = k.gain(0.7); k.wobble(0, 1.8, 7, 0.3, rg.gain);
      k.nz({ color: 'brown', type: 'lowpass', fc: [[0, 900], [1.6, 300]], a: 0.05, d: 1.6, vol: 0.45, dest: rg });
      crackles(k, 22, 0.05, 1.5, 0.18);
      return 2;
    },
  },
  ice: {
    max: 4, range: 50, rev: 0.16, hall: 0.12,
    fn: (k) => {
      const set = [2217, 2637, 2960, 3520, 3951, 4699, 5274];
      for (let i = 0; i < 7; i++) k.bell({ t: 0.03 + i * 0.07 + k.rnd(0, 0.03), f: k.pick(set) * k.vary(1, 0.01), vol: 0.05, d: 0.7, a: 0.008, partials: [[1, 1, 1], [2.4, 0.4, 0.5], [3.9, 0.2, 0.3]] });
      k.nz({ type: 'highpass', f: 5000, env: [[0, 0], [0.35, 1], [0.8, 0]], vol: 0.12 });
      k.nz({ type: 'bandpass', fc: [[0, 1800], [0.6, 4200]], q: 4, env: [[0, 0], [0.4, 1], [0.8, 0]], vol: 0.12 });
      k.nz({ color: 'pink', type: 'bandpass', f: 900, q: 1, a: 0.002, d: 0.1, vol: 0.3 });
      k.tone({ fc: [[0, 700], [0.7, 1500]], env: [[0, 0], [0.35, 1], [0.8, 0]], vol: 0.04 });
      return 1.2;
    },
  },
  ice_shatter: {
    clip: 1.6, max: 3, range: 60, rev: 0.18, pri: 2,
    fn: (k) => {
      k.thump({ f0: 160, f1: 70, sweep: 0.05, d: 0.14, vol: 0.28 });
      k.nz({ type: 'bandpass', f: 4000, q: 0.7, a: 0.0012, d: 0.16, vol: 0.36 });
      k.nz({ type: 'highpass', f: 1500, a: 0.0012, d: 0.035, vol: 0.24 });
      shatter(k, { n: 30, dur: 0.55, vol: 0.05, lo: 2500, hi: 9800 });
      k.nz({ color: 'pink', type: 'bandpass', f: 1200, q: 1.5, a: 0.001, d: 0.08, vol: 0.3 }); // crunch
      return 1.1;
    },
  },
  lightning: {
    clip: 1.6, max: 4, range: 70, rev: 0.14, pri: 2,
    fn: (k) => {
      zap(k, { dur: k.vary(0.34, 0.15), vol: 0.14, f: k.rnd(700, 1100) });
      k.nz({ type: 'highpass', f: 3000, a: 0.0004, d: 0.045, vol: 0.55 });
      k.nz({ type: 'bandpass', f: 1800, q: 0.8, a: 0.0006, d: 0.08, vol: 0.4 });
      k.thump({ f0: 170, f1: 70, sweep: 0.04, d: 0.16, vol: 0.34 });
      k.nz({ t: 0.05, type: 'bandpass', f: 6000, q: 1.5, env: [[0, 0], [0.01, 1], [0.4, 0]], vol: 0.12 }); // sizzle
      return 0.6;
    },
  },
  thunder: {
    clip: 1.5, max: 2, range: 150, ref: 10, rev: 0.18, hall: 0.2, pri: 2, duck: [0.3, 1.8], labDur: 4,
    fn: (k) => {
      k.nz({ type: 'highpass', f: 1500, a: 0.0012, d: 0.08, vol: 0.34 });
      k.thump({ f0: 100, f1: 44, sweep: 0.15, d: 1.0, vol: 0.55 });
      k.nz({ color: 'pink', type: 'bandpass', f: 180, q: 0.8, a: 0.002, d: 0.6, vol: 0.5 });
      const rg = k.gain(0.7); k.wobble(0, 2.8, 12, 0.35, rg.gain);
      k.nz({ color: 'brown', type: 'bandpass', f: 130, q: 0.7, a: 0.03, d: 2.6, vol: 0.6, dest: rg });
      k.nz({ type: 'bandpass', f: 320, q: 1, a: 0.001, d: 0.35, vol: 0.4 });
      k.nz({ color: 'pink', type: 'bandpass', f: 1200, q: 0.6, a: 0.002, d: 0.3, vol: 0.2 });
      return 3;
    },
  },
  holy: {
    max: 3, range: 50, rev: 0.1, hall: 0.25,
    fn: (k) => {
      choir(k, { notes: [57, 61, 64, 69], dur: 0.5, a: 0.25, r: 0.45, vol: 0.06, vowel: 'ah' });
      k.bell({ t: 0.18, f: mtof(88), vol: 0.06, d: 1.0, partials: CHIME });
      k.bell({ t: 0.28, f: mtof(93), vol: 0.05, d: 0.9, partials: CHIME });
      k.nz({ type: 'highpass', f: 6000, env: [[0, 0], [0.45, 1], [0.95, 0]], vol: 0.08 });
      k.sparkle({ t: 0.15, dur: 0.6, n: 7, notes: [81, 85, 88, 93].map(mtof), vol: 0.03 });
      return 1.2;
    },
  },
  holy_big: {
    clip: 1.3, max: 2, range: 80, rev: 0.12, hall: 0.4, pri: 2, duck: [0.35, 1.5], labDur: 3.5,
    fn: (k) => {
      whoosh(k, { dur: 0.12, f0: 5000, fPeak: 3500, f1: 1200, q: 1, vol: 0.22, peakAt: 0.7 });
      const T = 0.1;
      k.bell({ t: T, f: mtof(81), vol: 0.14, d: 2.0, partials: TUBE });
      k.bell({ t: T, f: mtof(88), vol: 0.08, d: 1.6, partials: CHIME });
      choir(k.sub(T), { notes: [57, 64, 69, 73, 76], dur: 0.6, a: 0.03, r: 1.2, vol: 0.055, vowel: 'ah', vowel2: 'oh' });
      boom(k, { t: T, vol: 0.45, d: 0.9, f0: 140, f1: 50 });
      k.nz({ t: T, type: 'highpass', f: 5000, a: 0.002, d: 1.2, vol: 0.12 });
      k.sparkle({ t: T + 0.1, dur: 1.4, n: 16, notes: [81, 85, 88, 93, 97].map(mtof), vol: 0.035 });
      return 2.4;
    },
  },
  dark: {
    max: 3, range: 50, rev: 0.15,
    fn: (k) => {
      const g = k.gain(0), lp = k.filter('lowpass', 200, 1.5, g);
      lp.frequency.setValueAtTime(200 * k.r, k.at(0)); lp.frequency.exponentialRampToValueAtTime(900 * k.r, k.at(0.5));
      for (const f of [55, 58.3, 82.4]) k.osc('sawtooth', f, 0, 0.9, lp);
      k.envPts(g.gain, [[0, 0], [0.4, 0.3], [0.85, 0]]);
      const fl = k.gain(0.6); k.lfo(0, 0.9, 7, 0.4, fl.gain);
      k.nz({ type: 'bandpass', fc: [[0, 1500], [0.8, 450]], q: 3, env: [[0, 0], [0.45, 1], [0.8, 0]], vol: 0.3, dest: fl });
      k.tone({ f: 311, env: [[0, 0], [0.45, 1], [0.9, 0]], vol: 0.03 }); k.tone({ f: 330, env: [[0, 0], [0.45, 1], [0.9, 0]], vol: 0.03 });
      k.nz({ color: 'brown', type: 'lowpass', f: 220, env: [[0, 0], [0.45, 1], [0.9, 0]], vol: 0.3 });
      k.nz({ t: 0.42, type: 'bandpass', f: 700, q: 1, a: 0.002, d: 0.12, vol: 0.25 }); // release thump
      return 1.0;
    },
  },
  demon: {
    clip: 1.6, max: 3, range: 60, rev: 0.14, pri: 2,
    fn: (k) => {
      const s = k.vary(1, 0.08);
      k.voice({ pitch: [[0, 70 * s], [0.25, 88 * s], [0.7, 58 * s]], amp: [[0, 0], [0.06, 1], [0.45, 0.8], [0.75, 0]],
        formants: [[0, [480, 950, 2300]], [0.75, [380, 800, 2100]]], q: [4, 5, 6], fg: [1, 0.7, 0.35], fry: 0.6, fryRate: 27, jitter: 30, breath: 0.25, body: 0.6, drive: 2.4, vol: 0.4 });
      k.nz({ color: 'brown', type: 'lowpass', fc: [[0, 1400], [0.6, 300]], a: 0.01, d: 0.6, vol: 0.5 });
      k.thump({ f0: 110, f1: 40, sweep: 0.1, d: 0.5, vol: 0.4 });
      crackles(k, 8, 0.05, 0.6, 0.14);
      return 0.9;
    },
  },
  // Songweaver: plucked harp phrase (pentatonic), each cast a different figure
  harp: {
    max: 5, range: 50, rev: 0.1, hall: 0.2, jitter: 0,
    fn: (k) => {
      const root = k.pick([62, 64, 67, 69]), n = 3 + (k.chance(0.4) ? 1 : 0), up = k.chance(0.7);
      for (let i = 0; i < n; i++) { const deg = up ? i : n - 1 - i; k.pluck({ t: i * 0.055, f: mtof(root + 12 + PENTA[(deg * 2) % 5] + 12 * Math.floor(deg * 2 / 5)), vol: 0.3, t60: 1.2, bright: 0.5, pos: 0.14, shape: 0.25 }); }
      k.sparkle({ t: 0.1, dur: 0.4, n: 5, lo: 4000, hi: 9000, vol: 0.022 });
      return 1.2;
    },
  },
  harp_big: {
    max: 2, range: 70, rev: 0.1, hall: 0.35, pri: 2, jitter: 0, labDur: 3,
    fn: (k) => {
      const root = k.pick([62, 67]);
      for (let i = 0; i < 12; i++) k.pluck({ t: i * 0.035, f: mtof(root + PENTA[i % 5] + 12 * Math.floor(i / 5)), vol: 0.26 * (0.7 + 0.3 * i / 12), t60: 1.6, bright: 0.5, pos: 0.13, shape: 0.25 });
      for (const m of [0, 4, 7, 12]) k.pluck({ t: 0.45, f: mtof(root + m), vol: 0.28, t60: 2.2, bright: 0.45, pos: 0.15, shape: 0.3 });
      k.tone({ t: 0.45, type: 'triangle', f: mtof(root + 24), env: [[0, 0], [0.1, 1], [1.2, 0]], vol: 0.03, vib: [5, 8] });
      k.sparkle({ t: 0.4, dur: 1.2, n: 14, notes: [root + 24, root + 28, root + 31, root + 36].map(mtof), vol: 0.035 });
      k.nz({ t: 0.4, type: 'highpass', f: 6000, env: [[0, 0], [0.2, 1], [1.2, 0]], vol: 0.06 });
      return 2.4;
    },
  },
  // a single sung/played note (Songweaver projectile): random pentatonic pitch, bell-ish onset, vibrato, sparkle
  note: {
    max: 6, burst: 3, range: 45, rev: 0.1, hall: 0.2, jitter: 0,
    fn: (k) => {
      const m = 74 + k.pick(PENTA) + (k.chance(0.3) ? 12 : 0), f = mtof(m);
      k.tone({ f, env: [[0, 0], [0.01, 1], [0.25, 0.6], [0.6, 0]], vol: 0.1, vib: [6, 12] });
      k.tone({ type: 'triangle', f: f * 2, env: [[0, 0], [0.005, 1], [0.2, 0]], vol: 0.03 });
      k.bell({ f: f * 2, vol: 0.03, d: 0.4, partials: CHIME });
      k.sparkle({ t: 0.03, dur: 0.3, n: 3, lo: 5000, hi: 9500, vol: 0.02 });
      return 0.7;
    },
  },
  shield: {
    max: 3, range: 45, rev: 0.12,
    fn: (k) => {
      const g = k.gain(0), lp = k.filter('lowpass', 200, 7, g);
      lp.frequency.setValueAtTime(200 * k.r, k.at(0)); lp.frequency.exponentialRampToValueAtTime(2600 * k.r, k.at(0.35)); lp.frequency.exponentialRampToValueAtTime(900 * k.r, k.at(0.8));
      k.osc('sawtooth', 110, 0, 0.9, lp); k.osc('sawtooth', 165, 0, 0.9, lp, 5);
      k.envPts(g.gain, [[0, 0], [0.03, 0.18], [0.5, 0.12], [0.85, 0]]);
      k.tone({ f: 1320, a: 0.08, d: 0.7, vol: 0.05 }); k.tone({ f: 1980, a: 0.1, d: 0.6, vol: 0.035 });
      k.thump({ f0: 90, f1: 170, sweep: 0.15, d: 0.25, vol: 0.3 });
      k.sparkle({ t: 0.2, dur: 0.5, n: 6, lo: 3000, hi: 8000, vol: 0.02 });
      return 0.95;
    },
  },
  heal: {
    max: 3, range: 45, rev: 0.1, hall: 0.2,
    fn: (k) => {
      [72, 76, 79, 84, 88].forEach((m, i) => k.pluck({ t: i * 0.07, f: mtof(m), vol: 0.22, t60: 1.4, bright: 0.35, shape: 0.25 }));
      for (const m of [60, 64, 67]) k.tone({ type: 'triangle', f: mtof(m), env: [[0, 0], [0.25, 1], [0.8, 0.5], [1.3, 0]], vol: 0.04, vib: [5, 5] });
      k.sparkle({ t: 0.25, dur: 0.9, n: 10, notes: [84, 88, 91, 96].map(mtof), vol: 0.03 });
      k.nz({ type: 'highpass', f: 5000, env: [[0, 0], [0.3, 1], [1.2, 0]], vol: 0.05 });
      return 1.5;
    },
  },
  buff: {
    max: 3, range: 45, rev: 0.1, hall: 0.2,
    fn: (k) => {
      [[0, 67], [0.08, 71], [0.16, 74]].forEach(([t, m]) => brass(k, { t, f: mtof(m), dur: 0.09, vol: 0.08, bright: 3.5, a: 0.01, r: 0.06 }));
      brass(k, { t: 0.24, f: mtof(79), dur: 0.5, vol: 0.1, bright: 3, a: 0.02, r: 0.35 });
      k.nz({ type: 'bandpass', fc: [[0, 800], [0.3, 5000]], q: 1.2, env: [[0, 0], [0.26, 1], [0.8, 0]], vol: 0.12 });
      k.sparkle({ t: 0.25, dur: 0.6, n: 8, notes: [86, 91, 95, 98].map(mtof), vol: 0.03 });
      return 1.1;
    },
  },
  debuff: {
    max: 3, range: 45, rev: 0.12,
    fn: (k) => {
      k.tone({ type: 'triangle', fc: [[0, 620], [0.6, 380]], env: [[0, 0], [0.04, 1], [0.6, 0]], vol: 0.07, vib: [9, 40] });
      k.tone({ type: 'triangle', fc: [[0, 656], [0.6, 400]], env: [[0, 0], [0.04, 1], [0.6, 0]], vol: 0.05, vib: [8, 40] });
      whoosh(k, { dur: 0.5, f0: 1600, fPeak: 900, f1: 300, q: 1, vol: 0.22, color: 'pink', peakAt: 0.2 });
      k.nz({ color: 'brown', type: 'lowpass', f: 300, env: [[0, 0], [0.1, 1], [0.6, 0]], vol: 0.2 });
      return 0.8;
    },
  },
  portal_open: {
    max: 2, range: 60, rev: 0.15, hall: 0.2, labDur: 3,
    fn: (k) => {
      const D = 1.6;
      const sw = k.filter('bandpass', 800, 3, k.gain(1)); k.lfo(0, D, 3.2, 600, sw.frequency); k.freqPts(sw.frequency, [[0, 400], [D, 2400]]);
      k.nz({ type: null, env: [[0, 0], [0.6, 1], [D, 0.6], [D + 0.4, 0]], vol: 0.3, dest: sw });
      const p = k.pan(0); k.lfo(0, D + 0.4, 1.6, 0.6, p.pan);
      k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 300], [D, 1800]], q: 1.4, env: [[0, 0], [0.5, 1], [D + 0.4, 0]], vol: 0.25, dest: p });
      k.tone({ f: 55, env: [[0, 0], [0.8, 1], [D + 0.3, 0]], vol: 0.1 }); k.tone({ f: 110, env: [[0, 0], [0.8, 1], [D + 0.3, 0]], vol: 0.06 }); k.tone({ f: 165, env: [[0, 0], [0.8, 1], [D + 0.3, 0]], vol: 0.04 });
      k.sparkle({ t: 0.6, dur: 1.2, n: 12, lo: 2500, hi: 8000, vol: 0.025 });
      return D + 0.6;
    },
  },
  portal_enter: {
    max: 2, range: 50, rev: 0.12, hall: 0.25,
    fn: (k) => {
      k.nz({ type: 'bandpass', fc: [[0, 500], [0.45, 5000]], q: 1.1, env: [[0, 0], [0.42, 1], [0.46, 0]], vol: 0.4 });
      k.tone({ fc: [[0, 200], [0.45, 1800]], env: [[0, 0], [0.4, 1], [0.46, 0]], vol: 0.07 });
      k.thump({ t: 0.45, f0: 90, f1: 40, sweep: 0.1, d: 0.5, vol: 0.45 });
      k.nz({ t: 0.45, type: 'highpass', f: 4000, a: 0.002, d: 0.6, vol: 0.1 });
      k.sparkle({ t: 0.45, dur: 0.6, n: 8, lo: 3000, hi: 9000, vol: 0.03 });
      return 1.2;
    },
  },
  teleport: {
    max: 3, range: 45, rev: 0.12,
    fn: (k) => {
      k.tone({ fc: [[0, 300], [0.12, 2600]], a: 0.004, d: 0.22, vol: 0.18 });
      k.tone({ type: 'triangle', fc: [[0, 600], [0.12, 5200]], a: 0.004, d: 0.2, vol: 0.06 });
      k.nz({ type: 'bandpass', fc: [[0, 1000], [0.13, 6500]], q: 1.2, env: [[0, 0], [0.12, 1], [0.16, 0]], vol: 0.3 });
      k.sparkle({ t: 0.12, dur: 0.3, n: 6, lo: 3000, hi: 9000, vol: 0.04 });
      k.thump({ t: 0.13, f0: 160, f1: 80, d: 0.12, vol: 0.2 });
      return 0.55;
    },
  },
  // AWAKENING: 1.4 s of rising power (noise + detuned saw riser + choir swell), then a massive boom and shimmer
  awaken: {
    clip: 1.3, max: 1, range: 120, ref: 10, rev: 0.12, hall: 0.4, pri: 3, duck: [0.6, 3.2], jitter: 0.01, labDur: 5,
    fn: (k) => {
      const T = 1.4;
      k.nz({ type: 'bandpass', fc: [[0, 250], [T, 6500]], q: 1.2, env: [[0, 0], [T * 0.95, 1], [T, 0]], vol: 0.4 });
      k.nz({ color: 'brown', type: 'lowpass', fc: [[0, 150], [T, 900]], env: [[0, 0], [T, 1]], vol: 0.45 });
      const rg = k.gain(0), rl = k.filter('lowpass', 800, 1, rg); k.envPts(rg.gain, [[0, 0], [T, 0.12], [T + 0.02, 0]]);
      for (const d of [-14, 0, 14]) { const o = k.osc('sawtooth', 110, 0, T + 0.05, rl, d); o.frequency.exponentialRampToValueAtTime(880 * k.r, k.at(T)); }
      k.freqPts(rl.frequency, [[0, 500], [T, 6000]]);
      choir(k, { notes: [50, 57, 62, 66, 69], dur: T, a: T * 0.9, r: 0.2, vol: 0.04, vowel: 'oh', vowel2: 'ah' });
      boom(k, { t: T, vol: 0.75, d: 2.4, f0: 95, f1: 30 });
      k.nz({ t: T, color: 'pink', type: 'lowpass', fc: [[0, 6000], [1.2, 400]], a: 0.002, d: 1.4, vol: 0.55 });
      k.nz({ t: T, type: 'highpass', f: 2200, a: 0.0005, d: 0.08, vol: 0.4 });
      for (const m of [50, 57, 62, 66, 69, 74]) brass(k, { t: T, f: mtof(m), dur: 1.4, vol: 0.05, bright: 3.4, a: 0.012, r: 1.1 });
      k.sparkle({ t: T + 0.05, dur: 2.2, n: 26, notes: [86, 90, 93, 98, 102].map(mtof), vol: 0.04 });
      k.nz({ t: T, type: 'highpass', f: 6000, env: [[0, 0], [0.2, 1], [2.4, 0]], vol: 0.07 });
      return T + 3;
    },
  },
  identity_ready: {
    bus: 'ui', max: 1, burst: 1, gap: 0.3, hall: 0.3, jitter: 0,
    fn: (k) => {
      k.bell({ f: mtof(81), vol: 0.1, d: 1.0, partials: CHIME });
      k.bell({ t: 0.09, f: mtof(88), vol: 0.1, d: 1.2, partials: CHIME });
      k.tone({ t: 0.09, type: 'triangle', f: mtof(76), env: [[0, 0], [0.05, 1], [0.9, 0]], vol: 0.04 });
      k.sparkle({ t: 0.1, dur: 0.5, n: 6, notes: [93, 96, 100].map(mtof), vol: 0.025 });
      return 1.3;
    },
  },
  identity_burst: {
    clip: 1.4, max: 2, range: 80, rev: 0.12, hall: 0.3, pri: 3, duck: [0.3, 1.2], labDur: 3,
    fn: (k) => {
      const T = 0.24;
      k.nz({ type: 'bandpass', fc: [[0, 600], [T, 5000]], q: 1.2, env: [[0, 0], [T * 0.9, 1], [T, 0]], vol: 0.35 });
      k.tone({ fc: [[0, 220], [T, 880]], env: [[0, 0], [T, 1], [T + 0.01, 0]], vol: 0.06 });
      k.thump({ t: T, f0: 150, f1: 48, sweep: 0.08, d: 0.5, vol: 0.55 });
      k.nz({ t: T, color: 'pink', type: 'lowpass', fc: [[0, 4000], [0.5, 500]], a: 0.002, d: 0.6, vol: 0.4 });
      for (const m of [55, 62, 67, 71]) brass(k, { t: T, f: mtof(m), dur: 0.6, vol: 0.055, bright: 3.5, a: 0.01, r: 0.5 });
      k.sparkle({ t: T + 0.05, dur: 0.9, n: 12, lo: 3500, hi: 9500, vol: 0.035 });
      return 1.8;
    },
  },
  revive: {
    max: 1, rev: 0.1, hall: 0.35, pri: 3, labDur: 4,
    fn: (k) => {
      k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 300], [1.0, 4000]], q: 1, env: [[0, 0], [0.9, 1], [1.2, 0]], vol: 0.18 });
      choir(k.sub(0.1), { notes: [62, 66, 69, 74], dur: 1.4, a: 0.8, r: 1.0, vol: 0.06, vowel: 'oh', vowel2: 'ah' });
      [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86].forEach((m, i) => k.pluck({ t: 0.1 + i * 0.07, f: mtof(m), vol: 0.18, t60: 1.6, bright: 0.35, shape: 0.25 }));
      k.bell({ t: 0.95, f: mtof(86), vol: 0.1, d: 1.6, partials: CHIME });
      k.sparkle({ t: 0.9, dur: 1.2, n: 12, notes: [86, 90, 93, 98].map(mtof), vol: 0.035 });
      return 2.7;
    },
  },
  death_player: {
    max: 1, rev: 0.1, hall: 0.35, pri: 3, duck: [0.4, 3], labDur: 5,
    fn: (k) => {
      k.thump({ f0: 70, f1: 50, sweep: 0.1, d: 0.5, vol: 0.4 });
      k.thump({ t: 0.32, f0: 65, f1: 45, sweep: 0.1, d: 0.5, vol: 0.3 });
      k.tone({ t: 0.1, type: 'triangle', f: mtof(38), env: [[0, 0], [0.5, 1], [2.5, 0.5], [3.1, 0]], vol: 0.2 });
      choir(k.sub(0.2), { notes: [50, 53, 57, 62], dur: 1.6, a: 0.6, r: 1.2, vol: 0.05, vowel: 'oo' });
      k.tone({ t: 0.3, type: 'triangle', fc: [[0, mtof(69)], [1.6, mtof(62)]], env: [[0, 0], [0.2, 1], [1.4, 0.6], [2.2, 0]], vol: 0.05, vib: [4.5, 8] });
      k.nz({ t: 0.2, color: 'pink', type: 'lowpass', f: 800, env: [[0, 0], [0.5, 1], [2.5, 0]], vol: 0.06 });
      return 3.3;
    },
  },
  // boss enrage: a low distorted brass cluster swelling over heartbeat thumps, a rising sub and a metal scrape
  enrage: {
    clip: 1.4, max: 1, range: 200, ref: 20, rev: 0.12, hall: 0.3, pri: 3, duck: [0.35, 2.5], jitter: 0.01, labDur: 4,
    fn: (k) => {
      const D = 2.2;
      const g = k.gain(0, k.drive(2)), lp = k.filter('lowpass', 300, 1.2, g);
      k.freqPts(lp.frequency, [[0, 250], [D, 1400]]);
      for (const [f, d] of [[55, -10], [55, 10], [58.27, 0], [82.4, 6]]) k.osc('sawtooth', f, 0, D + 0.3, lp, d);
      k.envPts(g.gain, [[0, 0], [D * 0.8, 0.22], [D, 0.25], [D + 0.3, 0]]);
      for (const t of [0, 0.25, 0.75, 1.0, 1.45, 1.65, 2.0]) k.thump({ t, f0: 80, f1: 42, sweep: 0.06, d: 0.25, vol: 0.4 });
      k.tone({ fc: [[0, 30], [D, 60]], env: [[0, 0], [D, 1], [D + 0.3, 0]], vol: 0.3 });
      k.nz({ type: 'bandpass', fc: [[0, 2500], [D, 4500]], q: 6, env: [[0, 0], [D, 1], [D + 0.2, 0]], vol: 0.05 });
      return D + 0.6;
    },
  },
};
