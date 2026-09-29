// Combat sounds: weapons, impacts, guns, counters, breaks, explosions. Bus 'sfx' (spatial when pos given).
// Every recipe varies itself (k.vary / k.rnd) and the engine adds ±3.5 % pitch jitter, so repeats never match.
import { METAL } from '../kit.js';
import { whoosh, shatter, debris, crackles, clang, boom } from './common.js';

function shot(k, t = 0, s = 1, dest = k.out) {
  k.nz({ t, type: 'highpass', f: 1500 * s, a: 0.0005, d: 0.03, vol: 0.6, dest });
  k.thump({ t, f0: 230 * s, f1: 90 * s, sweep: 0.03, d: 0.09, vol: 0.42, dest });
  k.nz({ t, color: 'pink', type: 'bandpass', f: 1200 * s, q: 0.8, a: 0.0008, d: 0.07, vol: 0.45, dest });
  k.nz({ t: t + 0.004, color: 'pink', type: 'lowpass', f: 2600, a: 0.004, d: 0.32, vol: 0.14, dest });
  k.nz({ t: t + 0.05, type: 'bandpass', f: 3600, q: 3, a: 0.0005, d: 0.012, vol: 0.1, dest });
}
function slice(k, t, f, vol = 0.42, dest = k.out) {
  whoosh(k, { t, dur: k.vary(0.1, 0.15), f0: 2000 * f, fPeak: 5200 * f, f1: 2600 * f, q: 2, vol, peakAt: 0.3, dest });
  k.bell({ t: t + 0.02, f: 4200 * f, vol: 0.022, d: 0.18, partials: METAL, spread: 0.02, dest });
}

export const COMBAT = {
  whoosh: {
    max: 6, range: 40, rev: 0.1,
    fn: (k) => {
      const d = k.vary(0.22, 0.15), f = k.vary(1, 0.15);
      whoosh(k, { dur: d, f0: 700 * f, fPeak: 2600 * f, f1: 900 * f, q: 1.2, vol: 0.45, peakAt: 0.45 });
      whoosh(k, { dur: d * 1.1, f0: 300 * f, fPeak: 800 * f, f1: 300 * f, q: 0.9, vol: 0.18, color: 'pink' });
    },
  },
  whoosh_big: {
    max: 3, range: 55, rev: 0.14, labDur: 2,
    fn: (k) => {
      const d = k.vary(0.62, 0.1), f = k.vary(1, 0.1), p = k.pan(0);
      k.lfo(0, d + 0.1, 1 / d, 0.6, p.pan, 'triangle');
      whoosh(k, { dur: d, f0: 250 * f, fPeak: 1400 * f, f1: 300 * f, q: 0.9, vol: 0.55, peakAt: 0.5, dest: p });
      whoosh(k, { dur: d * 1.1, f0: 90 * f, fPeak: 260 * f, f1: 80 * f, q: 0.8, vol: 0.5, color: 'brown', peakAt: 0.5 });
      whoosh(k, { t: d * 0.25, dur: d * 0.6, f0: 1800 * f, fPeak: 4200 * f, f1: 1500 * f, q: 1.4, vol: 0.14, peakAt: 0.4, dest: p });
      return d + 0.3;
    },
  },
  slash: {
    max: 6, range: 45, rev: 0.12,
    fn: (k) => {
      const d = k.vary(0.2, 0.12), f = k.vary(1, 0.12);
      whoosh(k, { dur: d, f0: 900 * f, fPeak: 3200 * f, f1: 1100 * f, q: 1.4, vol: 0.5, peakAt: 0.35 });
      whoosh(k, { dur: d * 1.1, f0: 300 * f, fPeak: 900 * f, f1: 300 * f, q: 0.9, vol: 0.2, color: 'pink' });
      k.bell({ t: d * 0.3, f: 3400 * f, vol: 0.025, d: 0.25, partials: METAL, spread: 0.02 });
    },
  },
  slash_heavy: {
    max: 4, range: 50, rev: 0.12,
    fn: (k) => {
      const d = k.vary(0.36, 0.1), f = k.vary(1, 0.1);
      whoosh(k, { dur: d, f0: 380 * f, fPeak: 1700 * f, f1: 480 * f, q: 1.1, vol: 0.55, peakAt: 0.42 });
      whoosh(k, { dur: d * 1.1, f0: 130 * f, fPeak: 380 * f, f1: 130 * f, q: 0.8, vol: 0.42, color: 'brown' });
      whoosh(k, { t: d * 0.2, dur: d * 0.5, f0: 2400 * f, fPeak: 4800 * f, f1: 2000 * f, q: 1.8, vol: 0.12, peakAt: 0.4 });
      k.bell({ t: d * 0.35, f: 2300 * f, vol: 0.02, d: 0.4, partials: METAL, spread: 0.02 });
    },
  },
  // Reaver's greatsword: a massive, slow air-cut with a pitched "vwoom" and a ringing edge
  greatsword: {
    max: 3, range: 55, rev: 0.14, labDur: 2,
    fn: (k) => {
      const d = k.vary(0.55, 0.08), f = k.vary(1, 0.08);
      whoosh(k, { dur: d, f0: 200 * f, fPeak: 950 * f, f1: 260 * f, q: 1, vol: 0.6, color: 'pink', peakAt: 0.5 });
      whoosh(k, { dur: d * 1.1, f0: 70 * f, fPeak: 210 * f, f1: 60 * f, q: 0.8, vol: 0.55, color: 'brown', peakAt: 0.5 });
      k.tone({ fc: [[0, 70 * f], [d * 0.5, 110 * f], [d, 55 * f]], env: [[0, 0], [d * 0.5, 1], [d, 0]], vol: 0.2 });
      whoosh(k, { t: d * 0.3, dur: d * 0.45, f0: 2200 * f, fPeak: 4500 * f, f1: 1800 * f, q: 1.6, vol: 0.13, peakAt: 0.4 });
      k.bell({ t: d * 0.45, f: 1250 * f, vol: 0.022, d: 0.7, partials: METAL, spread: 0.02 });
      return d + 0.5;
    },
  },
  blade: {
    max: 5, range: 45, rev: 0.12,
    fn: (k) => { const f = k.vary(1, 0.08); slice(k, 0, f); slice(k, k.vary(0.075, 0.15), f * k.vary(1.12, 0.04), 0.36); },
  },
  impact: {
    clip: 1.5, max: 6, range: 50, rev: 0.1,
    fn: (k) => {
      const p = k.vary(1, 0.12);
      k.thump({ f0: 190 * p, f1: 80 * p, sweep: 0.05, d: 0.17, vol: 0.34 });
      k.nz({ color: 'pink', type: 'bandpass', f: 1400 * p, q: 0.9, a: 0.0008, d: 0.05, vol: 0.5 });
      k.nz({ type: 'lowpass', f: 2400 * p, q: 0.7, a: 0.002, d: 0.08, vol: 0.4 });
      k.nz({ color: 'pink', type: 'bandpass', f: 650 * p, q: 1.6, a: 0.002, d: 0.14, vol: 0.45 });
      k.nz({ t: 0.004, type: 'bandpass', f: 2800 * p, q: 1.5, a: 0.0008, d: 0.03, vol: 0.28 });
    },
  },
  impact_heavy: {
    clip: 1.6, max: 4, range: 60, rev: 0.14, pri: 2,
    fn: (k) => {
      const p = k.vary(1, 0.1);
      k.thump({ f0: 150 * p, f1: 46 * p, sweep: 0.08, d: 0.4, vol: 0.6 });
      k.nz({ color: 'pink', type: 'bandpass', f: 900 * p, q: 1, a: 0.001, d: 0.1, vol: 0.42 });
      k.nz({ type: 'highpass', f: 2500, a: 0.0008, d: 0.04, vol: 0.3 });
      k.nz({ color: 'pink', type: 'bandpass', f: 280 * p, q: 0.9, a: 0.002, d: 0.3, vol: 0.5 });
      debris(k, { t: 0.02, n: 7, dur: 0.35, vol: 0.09 });
      return 0.6;
    },
  },
  crit: {
    clip: 2, clipIn: 1.6, max: 3, range: 55, rev: 0.14, pri: 2,
    fn: (k) => {
      COMBAT.impact.fn(k.sub(0, k.gain(0.9)));
      k.nz({ type: 'highpass', f: 2200, a: 0.0015, d: 0.045, vol: 0.32 });
      k.thump({ f0: 130, f1: 56, sweep: 0.08, d: 0.34, vol: 0.32 });
      k.nz({ color: 'pink', type: 'bandpass', f: 260, q: 0.9, a: 0.001, d: 0.2, vol: 0.4 });
      k.bell({ t: 0.005, f: 3200, vol: 0.05, d: 0.35, partials: METAL, spread: 0.02 });
      k.tone({ t: 0.01, fc: [[0, 4200], [0.12, 7600]], a: 0.002, d: 0.16, vol: 0.035 }); // bright "zing"
      k.nz({ t: 0.02, type: 'bandpass', f: 1400, q: 3, d: 0.05, vol: 0.25 });
    },
  },
  punch: {
    clip: 1.6, max: 6, range: 45, rev: 0.1,
    fn: (k) => {
      const p = k.vary(1, 0.1);
      k.thump({ f0: 175 * p, f1: 68 * p, sweep: 0.035, d: 0.13, vol: 0.45 });
      k.nz({ type: 'bandpass', f: 1800 * p, q: 1.2, a: 0.0006, d: 0.035, vol: 0.62 });
      k.nz({ type: 'highpass', f: 3200, a: 0.0005, d: 0.012, vol: 0.26 });
      k.nz({ color: 'pink', type: 'lowpass', f: 1200 * p, a: 0.001, d: 0.07, vol: 0.34 });
    },
  },
  kick: {
    clip: 1.6, max: 5, range: 45, rev: 0.1,
    fn: (k) => {
      const p = k.vary(1, 0.1), T = k.vary(0.06, 0.2);
      whoosh(k, { dur: T + 0.02, f0: 600 * p, fPeak: 1900 * p, f1: 900 * p, q: 1.1, vol: 0.28, peakAt: 0.8 });
      k.thump({ t: T, f0: 145 * p, f1: 58 * p, sweep: 0.05, d: 0.18, vol: 0.5 });
      k.nz({ t: T, type: 'bandpass', f: 1400 * p, q: 1.1, a: 0.0006, d: 0.04, vol: 0.6 });
      k.nz({ t: T, color: 'pink', type: 'lowpass', f: 900 * p, a: 0.001, d: 0.09, vol: 0.36 });
    },
  },
  monster_hit: {
    clip: 1.5, max: 6, range: 50, rev: 0.1,
    fn: (k) => {
      const p = k.vary(1, 0.14);
      k.thump({ f0: 155 * p, f1: 62 * p, sweep: 0.05, d: 0.2, vol: 0.4 });
      k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 620 * p], [0.12, 330 * p]], q: 3, a: 0.001, d: 0.13, vol: 0.55 }); // wet squelch
      k.nz({ type: 'bandpass', f: 1600 * p, q: 1, a: 0.0006, d: 0.04, vol: 0.4 });
      k.nz({ type: 'highpass', f: 2200, a: 0.0006, d: 0.02, vol: 0.26 });
      k.nz({ type: 'lowpass', f: 1500 * p, a: 0.002, d: 0.07, vol: 0.28 });
    },
  },
  block: {
    clip: 1.6, max: 4, range: 45, rev: 0.12,
    fn: (k) => {
      const p = k.vary(1, 0.06);
      k.thump({ f0: 230 * p, f1: 110 * p, sweep: 0.03, d: 0.14, vol: 0.36 });
      k.nz({ type: 'bandpass', f: 900 * p, q: 1.8, a: 0.0015, d: 0.1, vol: 0.34 });
      clang(k, { f: 640 * p, vol: 0.05, d: 0.35 });
      k.nz({ type: 'highpass', f: 2500, d: 0.02, vol: 0.2 });
    },
  },
  // The COUNTER!: two stacked metal clangs a fifth apart, a heavy thud, a bright zing and a shimmering tail
  counter: {
    clip: 1.4, max: 2, range: 70, rev: 0.12, hall: 0.35, pri: 3, duck: [0.35, 0.9], jitter: 0.015, labDur: 3,
    fn: (k) => {
      clang(k, { f: 520, vol: 0.2, d: 1.8 });
      clang(k, { t: 0.008, f: 780, vol: 0.14, d: 1.4, bright: 0.6 });
      k.thump({ f0: 190, f1: 62, sweep: 0.06, d: 0.35, vol: 0.55 });
      k.nz({ color: 'pink', type: 'bandpass', f: 420, q: 1, a: 0.001, d: 0.18, vol: 0.4 });
      k.tone({ t: 0.005, fc: [[0, 2400], [0.18, 7200]], a: 0.002, d: 0.25, vol: 0.05 });
      k.sparkle({ t: 0.05, dur: 0.7, n: 10, lo: 4000, hi: 9000, vol: 0.03 });
      return 2.2;
    },
  },
  // Stagger break: a glass-shatter boom — deep impact, crystal shards, a ringing crystalline chord
  stagger_break: {
    clip: 1.4, max: 1, range: 80, rev: 0.12, hall: 0.4, pri: 3, duck: [0.5, 1.6], jitter: 0.015, labDur: 4,
    fn: (k) => {
      boom(k, { vol: 0.45, d: 1.8, f0: 105, f1: 34 });
      k.nz({ type: 'bandpass', f: 3200, q: 0.7, a: 0.001, d: 0.4, vol: 0.6 });
      k.nz({ type: 'highpass', f: 2000, a: 0.0006, d: 0.07, vol: 0.55 });
      shatter(k, { t: 0.01, n: 50, dur: 1.2, vol: 0.09 });
      for (const [m, v] of [[1, 0.08], [1.26, 0.06], [1.5, 0.05], [2, 0.04]]) k.bell({ t: 0.02, f: 1480 * m, vol: v, d: 2.2, partials: [[1, 1, 1], [2.76, 0.3, 0.5], [5.4, 0.1, 0.3]] });
      debris(k, { t: 0.05, n: 10, dur: 0.9, lo: 1500, hi: 5000, vol: 0.08 });
      return 3;
    },
  },
  part_break: {
    clip: 1.5, max: 2, range: 70, rev: 0.12, hall: 0.2, pri: 2, duck: [0.25, 0.8], labDur: 3,
    fn: (k) => {
      k.nz({ type: 'highpass', f: 2500, a: 0.0005, d: 0.03, vol: 0.5 });
      k.nz({ color: 'pink', type: 'bandpass', f: 700, q: 1, a: 0.001, d: 0.16, vol: 0.5 });
      k.thump({ f0: 160, f1: 55, sweep: 0.06, d: 0.35, vol: 0.5 });
      clang(k, { t: 0.02, f: 880, vol: 0.09, d: 0.7 });
      debris(k, { t: 0.03, n: 12, dur: 0.7, vol: 0.15 });
      k.nz({ t: 0.25, type: 'bandpass', f: 1300, q: 2, a: 0.001, d: 0.05, vol: 0.2 }); // the piece lands
      k.thump({ t: 0.25, f0: 200, f1: 110, sweep: 0.03, d: 0.08, vol: 0.2 });
      return 1.4;
    },
  },
  knockdown: {
    clip: 1.5, max: 3, range: 45, rev: 0.1,
    fn: (k) => {
      k.thump({ f0: 115, f1: 52, sweep: 0.06, d: 0.26, vol: 0.55 });
      k.nz({ color: 'pink', type: 'lowpass', f: 800, a: 0.002, d: 0.12, vol: 0.42 });
      k.thump({ t: 0.13, f0: 140, f1: 70, sweep: 0.04, d: 0.12, vol: 0.25 });
      k.nz({ t: 0.02, color: 'pink', type: 'bandpass', f: 520, q: 0.8, a: 0.02, d: 0.35, vol: 0.14 }); // dust
      for (let i = 0; i < 3; i++) k.bell({ t: 0.02 + i * k.rnd(0.03, 0.06), f: k.rnd(2400, 3600), vol: 0.02, d: 0.1, partials: METAL });
      return 0.7;
    },
  },
  getup: {
    max: 3, range: 40, rev: 0.08,
    fn: (k) => {
      whoosh(k, { dur: 0.26, f0: 380, fPeak: 1100, f1: 420, q: 0.9, vol: 0.3, color: 'pink', peakAt: 0.4 });
      for (let i = 0; i < 2; i++) k.bell({ t: 0.08 + i * 0.09, f: k.rnd(2600, 3800), vol: 0.022, d: 0.1, partials: METAL });
      k.nz({ t: 0.22, type: 'bandpass', f: 1300, q: 1.2, a: 0.002, d: 0.06, vol: 0.18 });
      k.thump({ t: 0.22, f0: 130, f1: 80, sweep: 0.03, d: 0.07, vol: 0.2 });
    },
  },
  dash: {
    max: 4, range: 40, rev: 0.08,
    fn: (k) => {
      const f = k.vary(1, 0.1);
      whoosh(k, { dur: 0.17, f0: 800 * f, fPeak: 2500 * f, f1: 700 * f, q: 1.1, vol: 0.45, peakAt: 0.35 });
      k.nz({ color: 'pink', type: 'bandpass', f: 600, q: 0.9, a: 0.004, d: 0.12, vol: 0.2 });
      k.nz({ t: 0.1, type: 'bandpass', f: 1400 * f, q: 1.3, a: 0.002, d: 0.06, vol: 0.18 });
    },
  },
  // ---- guns (Pistoleer) ----
  gun: { clip: 1.8, clipIn: 1.3, max: 6, range: 70, rev: 0.16, fn: (k) => { shot(k, 0, k.vary(1, 0.06)); return 0.5; } },
  gun_dual: {
    clip: 1.8, clipIn: 1.3, max: 4, range: 70, rev: 0.16,
    fn: (k) => { shot(k, 0, k.vary(1, 0.05), k.pan(-0.35)); shot(k, k.vary(0.085, 0.15), k.vary(1.04, 0.04), k.pan(0.35)); return 0.6; },
  },
  shotgun: {
    clip: 1.8, clipIn: 1.2, max: 3, range: 80, rev: 0.16, pri: 2, labDur: 2,
    fn: (k) => {
      const p = k.vary(1, 0.05);
      k.thump({ f0: 125 * p, f1: 44 * p, sweep: 0.06, d: 0.32, vol: 0.62 });
      k.nz({ type: 'lowpass', fc: [[0, 5000], [0.2, 900]], a: 0.0005, d: 0.22, vol: 0.62 });
      k.nz({ type: 'highpass', f: 1800, a: 0.0005, d: 0.04, vol: 0.5 });
      crackles(k, 9, 0.004, 0.06, 0.2);
      k.nz({ t: 0.01, color: 'brown', type: 'lowpass', f: 650, a: 0.01, d: 0.9, vol: 0.28 });
      k.nz({ t: 0.42, type: 'bandpass', f: 2100, q: 2.5, a: 0.001, d: 0.03, vol: 0.12 }); // pump
      k.nz({ t: 0.53, type: 'bandpass', f: 1300, q: 2.5, a: 0.001, d: 0.04, vol: 0.14 });
      return 1.1;
    },
  },
  rifle: {
    clip: 1.8, clipIn: 1.3, max: 3, range: 100, rev: 0.2, hall: 0.12, pri: 2, labDur: 2.5,
    fn: (k) => {
      const p = k.vary(1, 0.04);
      k.nz({ type: 'highpass', f: 2000, a: 0.0004, d: 0.025, vol: 0.7 });
      k.nz({ type: 'bandpass', f: 3500 * p, q: 1, a: 0.0006, d: 0.05, vol: 0.4 });
      k.thump({ f0: 190 * p, f1: 58 * p, sweep: 0.05, d: 0.18, vol: 0.55 });
      k.nz({ color: 'pink', type: 'bandpass', f: 900, q: 0.7, a: 0.001, d: 0.12, vol: 0.4 });
      k.tone({ t: 0.004, fc: [[0, 5200], [0.12, 2600]], a: 0.001, d: 0.13, vol: 0.03 }); // bullet whine
      // valley echo: two delayed, darker repeats
      const echo = k.filter('lowpass', 1800, 0.7, k.gain(1));
      k.nz({ t: 0.16, color: 'pink', type: 'bandpass', f: 800, q: 0.7, a: 0.004, d: 0.5, vol: 0.2, dest: echo });
      k.nz({ t: 0.38, color: 'pink', type: 'bandpass', f: 650, q: 0.7, a: 0.01, d: 0.7, vol: 0.1, dest: echo });
      return 1.4;
    },
  },
  reload: {
    max: 3, range: 30, rev: 0.06, jitter: 0.02,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2500, q: 2, a: 0.002, d: 0.05, vol: 0.3 });
      k.nz({ t: 0.12, type: 'bandpass', f: 3600, q: 3, a: 0.0005, d: 0.015, vol: 0.35 }); k.tone({ t: 0.12, f: 1800, a: 0.0005, d: 0.03, vol: 0.05 });
      k.nz({ t: 0.26, type: 'bandpass', f: 1500, q: 2, a: 0.0006, d: 0.03, vol: 0.4 }); k.thump({ t: 0.26, f0: 420, f1: 250, sweep: 0.02, d: 0.035, vol: 0.18 });
      k.bell({ t: 0.27, f: 2900, vol: 0.02, d: 0.12, partials: METAL });
    },
  },
  gunshot_heavy: {
    clip: 1.8, clipIn: 1.3, max: 4, range: 80, rev: 0.18, pri: 2,
    fn: (k) => {
      const p = k.vary(1, 0.05);
      shot(k, 0, 0.85 * p);
      k.thump({ f0: 170 * p, f1: 52 * p, sweep: 0.05, d: 0.2, vol: 0.5 });
      k.nz({ type: 'highpass', f: 1800, a: 0.0004, d: 0.035, vol: 0.4 });
      k.nz({ t: 0.01, color: 'pink', type: 'lowpass', f: 1800, a: 0.006, d: 0.55, vol: 0.18 });
      k.nz({ t: 0.09, type: 'bandpass', f: 2600, q: 3, a: 0.0005, d: 0.02, vol: 0.12 }); // action cycles
      return 0.8;
    },
  },
  // links whipping through the air, rattling, and snapping taut
  chain: {
    clip: 1.5, max: 3, range: 55, rev: 0.12,
    fn: (k) => {
      whoosh(k, { dur: 0.26, f0: 700, fPeak: 2400, f1: 900, q: 1.1, vol: 0.38, peakAt: 0.5 });
      for (let i = 0; i < 12; i++) k.bell({ t: 0.04 + i * k.rnd(0.018, 0.03), f: k.rnd(1900, 3600), vol: k.rnd(0.02, 0.045), d: k.rnd(0.05, 0.12), partials: METAL, spread: 0.03 });
      clang(k, { t: 0.3, f: 1250, vol: 0.06, d: 0.35, bright: 0.6 });
      k.nz({ t: 0.3, type: 'bandpass', f: 1600, q: 2, a: 0.0005, d: 0.04, vol: 0.35 });
      return 0.8;
    },
  },
  // stone / bone spikes bursting from the ground (three stabs)
  spike: {
    clip: 1.5, max: 3, range: 60, rev: 0.12, pri: 2,
    fn: (k) => {
      for (const [t, v] of [[0, 1], [0.06, 0.8], [0.13, 0.9]]) {
        k.nz({ t, type: 'bandpass', fc: [[0, 500], [0.1, 2600]], q: 1.6, a: 0.002, d: 0.12, vol: 0.4 * v });
        k.nz({ t: t + 0.08, type: 'highpass', f: 2000, a: 0.0004, d: 0.02, vol: 0.4 * v });
        k.thump({ t: t + 0.08, f0: 170, f1: 70, sweep: 0.04, d: 0.16, vol: 0.4 * v });
      }
      debris(k, { t: 0.1, n: 12, dur: 0.6, vol: 0.13 });
      k.nz({ t: 0.1, color: 'brown', type: 'lowpass', f: 300, a: 0.01, d: 0.5, vol: 0.3 });
      return 0.9;
    },
  },
  punch_heavy: {
    clip: 1.6, max: 4, range: 55, rev: 0.12, pri: 2,
    fn: (k) => {
      const p = k.vary(1, 0.08);
      k.thump({ f0: 165 * p, f1: 48 * p, sweep: 0.06, d: 0.32, vol: 0.55 });
      k.nz({ type: 'bandpass', f: 1600 * p, q: 1.1, a: 0.0006, d: 0.045, vol: 0.6 });
      k.nz({ type: 'highpass', f: 2800, a: 0.0005, d: 0.018, vol: 0.3 });
      k.nz({ color: 'pink', type: 'bandpass', f: 380 * p, q: 0.9, a: 0.002, d: 0.22, vol: 0.45 });
      whoosh(k, { t: 0.01, dur: 0.3, f0: 1500, fPeak: 700, f1: 250, q: 0.9, vol: 0.18, color: 'pink', peakAt: 0.1 }); // air blast
      return 0.6;
    },
  },
  // demonic claws: a fast swipe with a tearing "rrrip"
  claw: {
    max: 4, range: 50, rev: 0.1,
    fn: (k) => {
      const f = k.vary(1, 0.1);
      whoosh(k, { dur: 0.16, f0: 900 * f, fPeak: 3000 * f, f1: 1200 * f, q: 1.3, vol: 0.4, peakAt: 0.4 });
      const rip = k.gain(0.5); k.lfo(0.05, 0.25, k.rnd(55, 75), 0.5, rip.gain, 'square');
      k.nz({ t: 0.05, type: 'bandpass', fc: [[0, 3500 * f], [0.18, 1500 * f]], q: 1.2, env: [[0, 0], [0.01, 1], [0.18, 0]], vol: 0.45, dest: rip });
      for (const t of [0.06, 0.1]) k.nz({ t, type: 'highpass', f: 2500, a: 0.0004, d: 0.012, vol: 0.3 });
      k.thump({ t: 0.06, f0: 150, f1: 70, sweep: 0.04, d: 0.1, vol: 0.25 });
      return 0.4;
    },
  },
  // a giant's stomp: ground-shaking boom with a short crack and dust
  stomp: {
    clip: 1.4, max: 2, range: 120, ref: 10, rev: 0.14, hall: 0.12, pri: 2, duck: [0.25, 1], labDur: 3,
    fn: (k) => {
      boom(k, { vol: 0.62, d: 1.3, f0: 82, f1: 30 });
      k.nz({ type: 'bandpass', f: 900, q: 1.2, a: 0.0008, d: 0.08, vol: 0.4 });
      k.nz({ type: 'highpass', f: 2200, a: 0.0005, d: 0.03, vol: 0.3 });
      debris(k, { t: 0.03, n: 14, dur: 0.9, vol: 0.12 });
      k.nz({ t: 0.03, color: 'pink', type: 'bandpass', f: 500, q: 0.7, a: 0.03, d: 0.7, vol: 0.18 }); // dust
      return 1.6;
    },
  },
  // ---- ground / blasts ----
  ground_crack: {
    clip: 1.5, max: 2, range: 80, rev: 0.12, pri: 2, duck: [0.2, 0.8], labDur: 3,
    fn: (k) => {
      k.nz({ color: 'brown', type: 'lowpass', f: 160, env: [[0, 0], [0.05, 1], [1.3, 0]], vol: 0.6 });
      k.thump({ f0: 95, f1: 38, sweep: 0.12, d: 0.7, vol: 0.5 });
      for (const [t, v] of [[0, 1], [0.06, 0.7], [0.11, 0.8], [0.21, 0.5]]) { k.nz({ t, type: 'highpass', f: 1800, a: 0.0005, d: 0.025, vol: 0.4 * v }); k.nz({ t, type: 'bandpass', f: k.rnd(700, 1100), q: 1.5, a: 0.001, d: 0.06, vol: 0.35 * v }); }
      debris(k, { t: 0.05, n: 16, dur: 1.1, vol: 0.14 });
      return 1.5;
    },
  },
  shockwave: {
    clip: 1.4, max: 3, range: 70, rev: 0.14, pri: 2, labDur: 2,
    fn: (k) => {
      k.thump({ f0: 135, f1: 44, sweep: 0.1, d: 0.45, vol: 0.55 });
      k.nz({ type: 'bandpass', fc: [[0, 380], [0.3, 4200]], q: 0.8, a: 0.004, d: 0.55, vol: 0.4 });
      k.nz({ type: 'highpass', f: 5000, a: 0.02, d: 0.7, vol: 0.1 });
      k.nz({ color: 'brown', type: 'lowpass', f: 380, a: 0.004, d: 0.6, vol: 0.34 });
      return 1;
    },
  },
  explosion: {
    clip: 1.4, max: 3, range: 90, rev: 0.16, hall: 0.12, pri: 2, duck: [0.3, 1.0], labDur: 3,
    fn: (k) => {
      boom(k, { vol: 0.6, d: 1.3, f0: 115, f1: 40 });
      k.nz({ color: 'pink', type: 'lowpass', fc: [[0, 4200], [0.8, 260]], q: 0.7, a: 0.003, d: 1.0, vol: 0.6 });
      k.nz({ type: 'highpass', f: 2500, a: 0.0005, d: 0.06, vol: 0.38 });
      debris(k, { t: 0.04, n: 16, dur: 1.2, vol: 0.14 });
      crackles(k, 10, 0.1, 1.1, 0.12);
      return 1.8;
    },
  },
  explosion_big: {
    clip: 1.3, max: 2, range: 130, ref: 8, rev: 0.16, hall: 0.2, pri: 3, duck: [0.5, 2.2], labDur: 5,
    fn: (k) => {
      boom(k, { vol: 0.7, d: 2.6, f0: 88, f1: 29 });
      k.nz({ color: 'pink', type: 'lowpass', fc: [[0, 5000], [1.4, 220]], q: 0.7, a: 0.003, d: 1.7, vol: 0.65 });
      k.nz({ type: 'highpass', f: 2200, a: 0.0005, d: 0.08, vol: 0.42 });
      const rg = k.gain(0.7); k.wobble(0.05, 2.4, 9, 0.3, rg.gain);
      k.nz({ t: 0.05, color: 'brown', type: 'bandpass', f: 120, q: 0.7, a: 0.05, d: 2.2, vol: 0.5, dest: rg });
      debris(k, { t: 0.05, n: 26, dur: 2.0, vol: 0.14 });
      crackles(k, 18, 0.15, 2.0, 0.12);
      return 3;
    },
  },
  // incoming roar + whistle descending onto a huge impact at ~0.85 s
  meteor: {
    clip: 1.3, max: 2, range: 130, ref: 8, rev: 0.16, hall: 0.2, pri: 3, duck: [0.5, 3], labDur: 5,
    fn: (k) => {
      const T = k.vary(0.85, 0.05);
      k.nz({ type: 'bandpass', fc: [[0, 3600], [T, 520]], q: 1.2, env: [[0, 0], [T * 0.9, 1], [T, 0.3]], vol: 0.4 });
      k.nz({ color: 'brown', type: 'lowpass', fc: [[0, 200], [T, 700]], env: [[0, 0], [T, 1]], vol: 0.55 });
      k.tone({ fc: [[0, 2100], [T, 380]], env: [[0, 0], [T * 0.8, 1], [T, 0]], vol: 0.03 });
      crackles(k, 10, T * 0.3, T, 0.1);
      COMBAT.explosion_big.fn(k.sub(T));
      return T + 3;
    },
  },
};
