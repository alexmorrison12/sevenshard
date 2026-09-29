// Creature voices: deaths, demons, hounds, bosses, Pips. Formant synthesis (Kit.voice). Bus 'sfx'.
import { VOWEL, crackles, boom } from './common.js';

// Big roar: inhale → three distorted fry-throats with moving formants, rasp, ring-mod edge, sub swell.
function roar(k, { T0 = 0.3, len = 3.6, s = 1, big = false }) {
  k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 450], [T0, 1500]], q: 0.9, env: [[0, 0], [T0 * 0.9, 0.5], [T0 + 0.04, 0]], vol: 0.2 });
  const L = len / 3.6, T = T0;
  const pitch = [[0, 128], [0.12, 104], [0.5, 96], [1.3, 100], [2.2, 90], [3.0, 70], [3.6, 52]].map(([t, f]) => [t * L, f * s]);
  const form = [[0, [520, 1000, 2400]], [0.5 * L, [700, 1150, 2550]], [1.6 * L, [760, 1250, 2650]], [2.6 * L, [560, 900, 2300]], [3.6 * L, [420, 780, 2100]]];
  const amp = [[0, 0], [0.08, 1], [0.35 * L, 0.85], [1.0 * L, 1], [2.2 * L, 0.92], [3.0 * L, 0.6], [3.6 * L, 0]];
  for (const [det, v, fr] of [[-14, 0.42, 29], [11, 0.38, 33], [3, 0.3, 37]]) {
    k.voice({ t: T, pitch, detune: det, amp, formants: form, q: [4, 5, 6], fg: [1, 0.75, 0.4], fry: 0.45, fryRate: fr, jitter: 22, jitterHz: 9, breath: 0.12, body: 0.5, drive: 2.2, vol: v, hp: 55 });
  }
  k.voice({ t: T, pitch: pitch.map(([t, f]) => [t, f * 3.02]), amp: [[0, 0], [0.3 * L, 0.5], [1.2 * L, 1], [2.3 * L, 0.6], [3.3 * L, 0]], formants: [[0, [1300, 2400, 3300]], [3.3 * L, [1100, 2100, 3000]]], q: [5, 6, 7], fg: [1, 0.6, 0.3], fry: 0.35, fryRate: 41, jitter: 30, jitterHz: 11, drive: 1.6, vol: big ? 0.18 : 0.12, hp: 400 });
  const rat = k.gain(0.65); k.lfo(T, len + 0.1, 31, 0.35, rat.gain, 'sawtooth');
  k.nz({ t: T, color: 'pink', type: 'bandpass', fc: [[0, 800], [0.6 * L, 1300], [2.0 * L, 1100], [3.4 * L, 650]], q: 0.9, env: [[0, 0], [0.12, 1], [2.4 * L, 0.8], [3.5 * L, 0]], vol: 0.22, dest: rat });
  const rm = k.gain(0, k.filter('bandpass', 2100, 1.5)); k.lfo(T, len + 0.1, 67, 1, rm.gain, 'sine');
  k.tone({ t: T, type: 'sawtooth', fc: pitch.map(([t, f]) => [t, f * 5.1]), env: [[0, 0], [0.4 * L, 0.5], [1.5 * L, 1], [2.5 * L, 0.4], [3.4 * L, 0]], vol: 0.06, dest: rm });
  k.nz({ t: T, type: 'lowpass', f: 2200, a: 0.004, d: 0.18, vol: 0.28 });
  k.tone({ t: T, fc: [[0, 55], [1.5 * L, 48], [3.5 * L, 40]], env: [[0, 0], [0.4 * L, 1], [2.5 * L, 0.7], [3.6 * L, 0]], vol: big ? 0.36 : 0.28 });
  k.nz({ t: T, color: 'brown', type: 'bandpass', f: 110, q: 0.8, env: [[0, 0], [0.3 * L, 1], [3.0 * L, 0.6], [3.8 * L, 0]], vol: big ? 0.38 : 0.3 });
  return T + len + 0.5;
}
// tiny formant squeak (Pips): pitch contour + bright vowel formants scaled up (small vocal tract)
function squeak(k, t, { f0, f1, d, v1 = 'ee', v2 = 'ee', vol = 0.35, fs = 1.55, dest = k.out }) {
  k.voice({ t, pitch: [[0, f0], [d * 0.6, (f0 + f1) / 2 * 1.08], [d, f1]], amp: [[0, 0], [0.012, 1], [d * 0.7, 0.8], [d, 0]],
    formants: [[0, VOWEL[v1].map((x) => x * fs)], [d, VOWEL[v2].map((x) => x * fs)]], q: [4, 5, 6], fg: [1, 0.7, 0.35], breath: 0.1, vol, jitter: 18, vib: [9, 25], dest });
}

export const CREATURES = {
  monster_die: {
    max: 4, range: 55, rev: 0.12,
    fn: (k) => {
      const s = k.vary(1, 0.15);
      k.voice({ pitch: [[0, 180 * s], [0.12, 210 * s], [0.6, 95 * s]], amp: [[0, 0], [0.04, 1], [0.35, 0.7], [0.62, 0]],
        formants: [[0, VOWEL.ah], [0.6, VOWEL.oh]], q: [4, 6, 7], fg: [1, 0.55, 0.25], fry: 0.4, fryRate: 32, jitter: 30, breath: 0.3, body: 0.5, drive: 1.3, vol: 0.4 });
      k.thump({ t: 0.35, f0: 120, f1: 55, sweep: 0.05, d: 0.22, vol: 0.45 });
      k.nz({ t: 0.35, color: 'pink', type: 'lowpass', f: 700, a: 0.002, d: 0.12, vol: 0.3 });
      k.nz({ t: 0.36, color: 'pink', type: 'bandpass', f: 500, q: 0.8, a: 0.02, d: 0.3, vol: 0.1 });
      return 0.9;
    },
  },
  demon_die: {
    max: 4, range: 60, rev: 0.14,
    fn: (k) => {
      const s = k.vary(1, 0.12);
      k.voice({ pitch: [[0, 420 * s], [0.1, 520 * s], [0.7, 160 * s]], amp: [[0, 0], [0.03, 1], [0.4, 0.7], [0.75, 0]],
        formants: [[0, [800, 1700, 2900]], [0.75, [500, 1000, 2400]]], q: [3, 4, 5], fg: [1, 0.7, 0.4], fry: 0.5, fryRate: 43, jitter: 55, jitterHz: 17, breath: 0.25, drive: 2.2, vol: 0.34 });
      k.nz({ t: 0.2, type: 'highpass', fc: [[0, 2500], [0.9, 7000]], env: [[0, 0], [0.1, 1], [0.9, 0]], vol: 0.14 }); // dissolving sizzle
      k.nz({ t: 0.25, color: 'brown', type: 'lowpass', f: 400, env: [[0, 0], [0.05, 1], [0.6, 0]], vol: 0.3 });
      k.thump({ t: 0.3, f0: 110, f1: 45, sweep: 0.08, d: 0.3, vol: 0.4 });
      crackles(k, 6, 0.25, 0.9, 0.1);
      return 1.2;
    },
  },
  imp_screech: {
    max: 4, burst: 2, range: 55, rev: 0.12,
    fn: (k) => {
      const s = k.vary(1, 0.12), d = k.vary(0.42, 0.2);
      k.voice({ pitch: [[0, 620 * s], [0.08, 980 * s], [d * 0.7, 820 * s], [d, 480 * s]], amp: [[0, 0], [0.02, 1], [d * 0.6, 0.85], [d, 0]],
        formants: [[0, [950, 2300, 3300]], [d, [750, 1900, 3000]]], q: [3, 4, 5], fg: [1, 0.75, 0.4], fry: 0.45, fryRate: 51, jitter: 70, jitterHz: 22, breath: 0.35, drive: 2, vol: 0.34 });
      return d + 0.1;
    },
  },
  hound_growl: {
    max: 3, range: 55, rev: 0.1,
    fn: (k) => {
      const s = k.vary(1, 0.08), d = k.vary(1.15, 0.15);
      k.voice({ pitch: [[0, 72 * s], [0.3 * d, 88 * s], [0.8 * d, 76 * s], [d, 62 * s]], amp: [[0, 0], [0.15, 0.9], [0.4 * d, 1], [0.8 * d, 0.85], [d, 0]],
        formants: [[0, [360, 900, 2300]], [0.5 * d, [430, 1000, 2400]], [d, [370, 860, 2200]]], q: [4, 6, 8], fg: [1, 0.55, 0.25], fry: 0.75, fryRate: 31, jitter: 38, jitterHz: 18, breath: 0.4, body: 0.6, vol: 0.5, drive: 1.8 });
      k.nz({ color: 'brown', type: 'lowpass', f: 170, env: [[0, 0], [0.2, 1], [d, 0]], vol: 0.24 });
      crackles(k, 4, 0.1, d, 0.06); // ember crackle: it's a hellhound
      return d + 0.1;
    },
  },
  boss_roar: {
    clip: 1.3, max: 1, range: 250, ref: 18, rev: 0.18, hall: 0.3, pri: 3, duck: [0.45, 2.8], labDur: 4,
    fn: (k) => roar(k, { T0: 0.22, len: 2.4, s: k.vary(1.08, 0.05) }),
  },
  boss_roar_big: {
    clip: 1.3, max: 1, range: 400, ref: 25, rev: 0.2, hall: 0.35, pri: 3, duck: [0.6, 4.5], jitter: 0.015, labDur: 6,
    fn: (k) => {
      const e = roar(k, { T0: 0.3, len: 3.8, s: k.vary(0.94, 0.04), big: true });
      boom(k, { t: 0.3, vol: 0.35, d: 2.5, f0: 70, f1: 30 });
      return e;
    },
  },
  pip_squeak: {
    max: 4, burst: 2, range: 35, rev: 0.06, jitter: 0.06,
    fn: (k) => {
      const f = k.rnd(820, 1150), up = k.chance(0.65), d = k.rnd(0.1, 0.2);
      squeak(k, 0, { f0: f, f1: f * (up ? k.rnd(1.35, 1.7) : k.rnd(0.65, 0.8)), d, v1: k.pick(['ee', 'eh']), v2: k.pick(['ee', 'ah']) });
      if (k.chance(0.35)) squeak(k, d + 0.04, { f0: f * 1.1, f1: f * 1.5, d: d * 0.7, vol: 0.28 });
      return d * 2 + 0.1;
    },
  },
  pip_cheer: {
    max: 2, range: 40, rev: 0.08, hall: 0.1,
    fn: (k) => {
      for (let v = 0; v < 3; v++) {
        const t = v * k.rnd(0.02, 0.06), f = k.rnd(760, 1050), d = k.rnd(0.35, 0.5);
        squeak(k, t, { f0: f, f1: f * k.rnd(1.3, 1.55), d, v1: 'ah', v2: 'ee', vol: 0.26, dest: k.pan(k.rnd(-0.6, 0.6)) });
      }
      squeak(k, 0.5, { f0: 1100, f1: 1500, d: 0.12, vol: 0.2 }); // a last happy "hee"
      k.sparkle({ t: 0.1, dur: 0.5, n: 5, lo: 4000, hi: 8000, vol: 0.02 });
      return 0.8;
    },
  },
};
