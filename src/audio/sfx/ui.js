// UI & alert sounds. Bus 'ui' (flat, not ducked, follows the sfx volume).
import { CHIME, METAL } from '../kit.js';
import { brass, choir, mtof, boom } from './common.js';

function horn(k, t, f, dur, vol = 0.3) {
  const T = k.at(t), R = k.r;
  const g = k.gain(0, k.drive(1.6));
  const lp = k.filter('lowpass', f * 2, 2.2, g);
  lp.frequency.setValueAtTime(f * 1.5 * R, T); lp.frequency.linearRampToValueAtTime(f * 7 * R, T + 0.08);
  lp.frequency.setTargetAtTime(f * 4.5 * R, T + 0.08, 0.2); lp.frequency.setTargetAtTime(f * 1.5 * R, T + dur - 0.05, 0.06);
  for (const [dt, v, mul] of [[-8, 1, 1], [7, 1, 1], [3, 0.45, 1.5], [-4, 0.3, 2]]) {
    const og = k.gain(v, lp); const o = k.osc('sawtooth', f * mul, t, dur + 0.1, og, dt);
    o.detune.setValueAtTime(dt - 90, T); o.detune.linearRampToValueAtTime(dt, T + 0.1);
  }
  k.envPts(g.gain, [[0, 0], [0.05, vol], [dur - 0.12, vol * 0.9], [dur, 0]], t);
}

export const UI = {
  ui_click: {
    bus: 'ui', max: 3, burst: 1, gap: 0.02, jitter: 0.02,
    fn: (k) => {
      k.tone({ f: k.vary(1850, 0.03), f1: 1250, sweep: 0.025, a: 0.0008, d: 0.035, vol: 0.3 });
      k.nz({ type: 'bandpass', f: 3800, q: 1.8, a: 0.0005, d: 0.012, vol: 0.35 });
      k.tone({ type: 'triangle', f: 620, a: 0.001, d: 0.03, vol: 0.12 });
    },
  },
  ui_hover: {
    bus: 'ui', max: 2, burst: 1, gap: 0.04, jitter: 0.03,
    fn: (k) => { k.tone({ f: 2900, a: 0.0006, d: 0.018, vol: 0.12 }); k.nz({ type: 'bandpass', f: 5200, q: 2, a: 0.0004, d: 0.008, vol: 0.12 }); },
  },
  ui_tab: {
    bus: 'ui', max: 2, burst: 1, gap: 0.03, jitter: 0.02,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2500, q: 1.4, a: 0.0006, d: 0.02, vol: 0.32 });
      k.tone({ f: 1400, f1: 1100, sweep: 0.03, a: 0.0008, d: 0.04, vol: 0.14 });
      k.nz({ t: 0.03, type: 'bandpass', f: 1600, q: 2, a: 0.0006, d: 0.015, vol: 0.18 });
    },
  },
  ui_open: {
    bus: 'ui', max: 2, burst: 1, jitter: 0.02,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 450, f1: 2600, sweep: 0.16, q: 1.4, a: 0.05, d: 0.16, vol: 0.4 });
      k.tone({ type: 'triangle', f: 420, f1: 760, sweep: 0.1, a: 0.01, d: 0.12, vol: 0.12 });
      k.nz({ type: 'lowpass', f: 900, a: 0.001, d: 0.05, vol: 0.35 });
      k.tone({ t: 0.09, f: 1320, a: 0.002, d: 0.18, vol: 0.05 });
    },
  },
  ui_close: {
    bus: 'ui', max: 2, burst: 1, jitter: 0.02,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2400, f1: 420, sweep: 0.15, q: 1.4, a: 0.02, d: 0.14, vol: 0.38 });
      k.tone({ type: 'triangle', f: 640, f1: 330, sweep: 0.1, a: 0.005, d: 0.1, vol: 0.1 });
      k.nz({ t: 0.1, type: 'lowpass', f: 650, a: 0.002, d: 0.07, vol: 0.45 });
      k.thump({ t: 0.1, f0: 190, f1: 110, sweep: 0.04, d: 0.08, vol: 0.18 });
    },
  },
  ui_error: {
    bus: 'ui', max: 1, burst: 1, gap: 0.15, jitter: 0,
    fn: (k) => {
      const g = k.gain(0), lp = k.filter('lowpass', 900, 0.9, g);
      k.osc('sawtooth', 110, 0, 0.3, lp); k.osc('sawtooth', 116.5, 0, 0.3, lp);
      const sq = k.gain(0.3, lp); k.osc('square', 55, 0, 0.3, sq);
      k.envPts(g.gain, [[0, 0], [0.012, 0.2], [0.16, 0.18], [0.24, 0]]);
      return 0.26;
    },
  },
  notification: {
    bus: 'ui', max: 1, burst: 1, gap: 0.2, hall: 0.2, jitter: 0,
    fn: (k) => {
      k.bell({ f: mtof(88), vol: 0.1, d: 0.7, partials: CHIME });
      k.bell({ t: 0.11, f: mtof(93), vol: 0.09, d: 0.9, partials: CHIME });
      k.tone({ t: 0.11, type: 'triangle', f: mtof(81), env: [[0, 0], [0.02, 1], [0.6, 0]], vol: 0.03 });
      return 1.1;
    },
  },
  quest_accept: {
    bus: 'ui', max: 1, hall: 0.25, jitter: 0,
    fn: (k) => {
      k.nz({ type: 'bandpass', f: 2600, q: 0.9, a: 0.01, d: 0.12, vol: 0.18 });
      k.nz({ t: 0.05, type: 'highpass', f: 3500, q: 0.7, a: 0.005, d: 0.08, vol: 0.12 });
      k.bell({ t: 0.04, f: mtof(79), vol: 0.2, d: 1.0, partials: CHIME });
      k.bell({ t: 0.16, f: mtof(86), vol: 0.22, d: 1.3, partials: CHIME });
      k.tone({ t: 0.04, type: 'triangle', f: mtof(55), a: 0.01, d: 0.8, vol: 0.12 });
      return 1.5;
    },
  },
  quest_complete: {
    bus: 'ui', max: 1, hall: 0.35, pri: 2, jitter: 0,
    fn: (k) => {
      [[0, 74], [0.11, 78], [0.22, 81]].forEach(([t, m]) => brass(k, { t, f: mtof(m), dur: 0.1, vol: 0.13, bright: 3.5, a: 0.012, r: 0.08 }));
      brass(k, { t: 0.33, f: mtof(86), dur: 0.75, vol: 0.16, bright: 3, a: 0.015, r: 0.5 });
      for (const m of [62, 66, 69]) brass(k, { t: 0.33, f: mtof(m), dur: 0.7, vol: 0.07, bright: 2, a: 0.03, r: 0.6 });
      k.bell({ t: 0.33, f: mtof(98), vol: 0.07, d: 1.2 });
      k.bell({ t: 0.4, f: mtof(102), vol: 0.05, d: 1.1 });
      k.thump({ t: 0.33, f0: 110, f1: 65, sweep: 0.1, d: 0.6, vol: 0.28 });
      k.sparkle({ t: 0.4, dur: 1.0, n: 8, lo: 3500, hi: 8000, vol: 0.03 });
      return 2.0;
    },
  },
  // THE ding: riser → warm impact + major-add9 brass/choir chord → bell cascade → sparkling tail.
  level_up: {
    bus: 'ui', max: 1, hall: 0.55, pri: 3, duck: [0.45, 2.5], jitter: 0, labDur: 5,
    fn: (k) => {
      k.nz({ color: 'pink', type: 'bandpass', fc: [[0, 300], [0.32, 5200]], q: 1.2, env: [[0, 0], [0.28, 1], [0.33, 0]], vol: 0.28 });
      k.tone({ type: 'triangle', fc: [[0, 220], [0.3, 880]], env: [[0, 0], [0.27, 1], [0.32, 0]], vol: 0.07 });
      const T = 0.3;
      k.thump({ t: T, f0: 110, f1: 73.4, sweep: 0.12, d: 1.8, vol: 0.42 });
      k.tone({ t: T, f: 146.8, a: 0.004, d: 1.6, vol: 0.12 });
      k.nz({ t: T, type: 'highpass', f: 5000, q: 0.5, a: 0.002, d: 1.4, vol: 0.12 });
      k.nz({ t: T, type: 'bandpass', f: 8000, q: 1.5, a: 0.001, d: 0.6, vol: 0.1 });
      for (const m of [50, 57, 62, 66, 69, 76]) brass(k, { t: T, f: mtof(m), dur: 1.25, vol: m < 57 ? 0.06 : 0.045, bright: 2.4, a: 0.03, r: 1.1 });
      choir(k, { t: T, notes: [62, 66, 69, 74, 78], dur: 1.6, a: 0.22, r: 1.0, vol: 0.05, vowel: 'ah', vowel2: 'oh' });
      [74, 78, 81, 86, 88, 90, 93, 98, 102].forEach((m, i) => {
        k.bell({ t: T + 0.02 + i * 0.07, f: mtof(m), vol: 0.17 - i * 0.008, d: 2.1 - i * 0.1 });
        k.tone({ t: T + 0.02 + i * 0.07, f: mtof(m), a: 0.002, d: 1.4, vol: 0.05, type: 'triangle' });
      });
      k.sparkle({ t: T + 0.35, dur: 2.4, n: 30, notes: [86, 90, 93, 95, 98, 102, 105].map(mtof), vol: 0.07, d: 0.7 });
      k.nz({ t: T, type: 'highpass', f: 7000, env: [[0, 0], [0.3, 1], [2.8, 0]], vol: 0.05 });
      return 3.7;
    },
  },
  // subtle telegraph cue (fires often): a soft low double pulse with a faint glassy tick
  telegraph_warn: {
    bus: 'ui', max: 2, burst: 1, gap: 0.12, jitter: 0.02,
    fn: (k) => {
      for (const t of [0, 0.13]) { k.tone({ t, f: 196, env: [[0, 0], [0.008, 1], [0.1, 0]], vol: 0.18 }); k.tone({ t, type: 'triangle', f: 392, env: [[0, 0], [0.006, 1], [0.07, 0]], vol: 0.04 }); }
      k.bell({ f: 2350, vol: 0.02, d: 0.25, partials: METAL });
      return 0.4;
    },
  },
  raid_warning: {
    bus: 'ui', max: 1, hall: 0.3, pri: 3, duck: [0.3, 1.8], jitter: 0, labDur: 3,
    fn: (k) => {
      horn(k, 0, mtof(45), 0.62); horn(k, 0.68, mtof(50), 0.9);
      k.bell({ t: 0, f: 880, vol: 0.06, d: 0.8, partials: METAL });
      k.thump({ t: 0, f0: 120, f1: 60, sweep: 0.08, d: 0.4, vol: 0.25 });
      return 1.7;
    },
  },
  // countdown tick; sfx('pvp_countdown', { final: true }) for the "GO" tone
  pvp_countdown: {
    bus: 'ui', max: 2, burst: 1, gap: 0.3, hall: 0.15, jitter: 0,
    fn: (k, o) => {
      const fin = !!o.final, f = fin ? 1760 : 880, d = fin ? 0.6 : 0.16;
      k.tone({ type: 'square', f, env: [[0, 0], [0.004, 1], [d * 0.6, 0.7], [d, 0]], vol: 0.05, dest: k.filter('lowpass', 4000, 0.7) });
      k.tone({ f, env: [[0, 0], [0.004, 1], [d, 0]], vol: 0.12 });
      if (fin) { k.tone({ f: f * 1.5, env: [[0, 0], [0.004, 1], [d, 0]], vol: 0.06 }); k.thump({ f0: 140, f1: 70, sweep: 0.06, d: 0.4, vol: 0.3 }); }
      return d + 0.2;
    },
  },
  // triumphant horn call: the HERO call in D major with trumpets and a drum hit
  victory_horn: {
    bus: 'ui', max: 1, hall: 0.45, pri: 3, duck: [0.5, 2.5], jitter: 0, labDur: 4,
    fn: (k) => {
      const notes = [[0, 62, 0.28], [0.3, 62, 0.1], [0.42, 69, 0.4], [0.86, 74, 1.3]];
      for (const [t, m, d] of notes) { brass(k, { t, f: mtof(m), dur: d, vol: 0.13, bright: 3.4, a: 0.015, r: 0.3 }); brass(k, { t, f: mtof(m - 12), dur: d, vol: 0.09, bright: 2.2, a: 0.02, r: 0.3 }); }
      for (const m of [50, 57, 62, 66]) brass(k, { t: 0.86, f: mtof(m), dur: 1.2, vol: 0.05, bright: 2.6, a: 0.02, r: 0.8 });
      boom(k, { t: 0.86, vol: 0.35, d: 1.2, f0: 110, f1: 55 });
      k.nz({ t: 0.86, type: 'highpass', f: 4000, env: [[0, 0], [0.01, 1], [1.4, 0]], vol: 0.1 });
      return 2.8;
    },
  },
};
