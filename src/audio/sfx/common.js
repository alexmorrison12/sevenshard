// Shared recipe helpers (built on Kit).
import { mtof } from '../util.js';
export { mtof };

// Brass-like tone: detuned saws through an opening low-pass (the "blat"), small pitch scoop.
export function brass(k, { t = 0, f = 220, dur = 0.4, vol = 0.2, bright = 3, a = 0.02, r = 0.15, dest = k.out, q = 1.3, scoop = 30 }) {
  const T = k.at(t), R = k.r, ny = k.nyq;
  const g = k.gain(0, dest);
  const lp = k.filter('lowpass', f, q, g);
  lp.frequency.setValueAtTime(Math.min(ny, f * 1.1 * R), T);
  lp.frequency.linearRampToValueAtTime(Math.min(ny, f * (1 + bright * 1.5) * R), T + a * 1.6);
  lp.frequency.setTargetAtTime(Math.min(ny, f * (1 + bright) * R), T + a * 1.6, 0.12);
  lp.frequency.setTargetAtTime(Math.min(ny, f * 1.2 * R), T + dur, r * 0.4);
  for (const dt of [-6, 6]) {
    const o = k.osc('sawtooth', f, t, dur + r + 0.05, lp, dt);
    o.detune.setValueAtTime(dt - scoop, T); o.detune.linearRampToValueAtTime(dt, T + 0.05);
  }
  g.gain.setValueAtTime(0, T);
  g.gain.linearRampToValueAtTime(vol, T + a);
  g.gain.linearRampToValueAtTime(vol * 0.8, T + a + 0.1);
  g.gain.setValueAtTime(vol * 0.8, T + Math.max(a + 0.1, dur));
  g.gain.linearRampToValueAtTime(0, T + Math.max(a + 0.1, dur) + r);
  return g;
}

// Swept band-pass noise "whoosh" (weapon swings, wings, spells).
export function whoosh(k, { t = 0, dur = 0.25, f0 = 600, fPeak = 2200, f1 = 800, q = 1.2, vol = 0.35, color = 'white', dest = k.out, peakAt = 0.4 }) {
  return k.nz({
    t, color, type: 'bandpass', q, dest, vol,
    fc: [[0, f0], [dur * peakAt, fPeak], [dur, f1]],
    env: [[0, 0], [dur * peakAt, 1], [dur, 0]],
  });
}

// Vowel formant tables (F1, F2, F3)
export const VOWEL = {
  ah: [780, 1150, 2700], oh: [480, 820, 2650], oo: [330, 760, 2450], eh: [540, 1800, 2550], ee: [300, 2250, 3000],
  uh: [620, 1180, 2500], aw: [620, 900, 2600],
};

// Choir-ish sustained chord of formant voices.
export function choir(k, { t = 0, notes = [60, 64, 67], dur = 1.5, a = 0.3, r = 0.8, vol = 0.06, vowel = 'ah', vowel2 = null, dest = k.out, vib = [5.2, 9] }) {
  const f1 = VOWEL[vowel], f2 = vowel2 ? VOWEL[vowel2] : f1;
  for (const m of notes) {
    const f = mtof(m);
    k.voice({
      t, dest, vol, pitch: [[0, f], [dur + r, f]],
      amp: [[0, 0], [a, 1], [dur, 0.85], [dur + r, 0]],
      formants: [[0, f1], [dur + r, f2]], q: [5, 7, 9], fg: [1, 0.45, 0.18],
      vib: [vib[0] * k.vary(1, 0.08), vib[1]], breath: 0.015, body: 0.35, detune: k.rnd(-6, 6),
    });
  }
}

// ---- shared layers ----
// Glass/ice shards: many tiny high pings + a hiss, thinning out over `dur`.
export function shatter(k, { t = 0, n = 24, dur = 0.5, lo = 2500, hi = 9500, vol = 0.05, dest = k.out, hiss = 1 }) {
  for (let i = 0; i < n; i++) {
    const u = Math.pow(k.rnd(), 1.8), tt = t + u * dur;
    k.tone({ t: tt, f: k.rnd(lo, hi), a: 0.0005, d: k.rnd(0.04, 0.28), vol: vol * k.rnd(0.4, 1) * (1 - 0.7 * u), dest });
  }
  if (hiss) k.nz({ t, type: 'highpass', f: 3800, a: 0.001, d: dur * 0.6, vol: vol * 3 * hiss, dest });
}
// Rock / wood debris: short band-passed clicks scattered over `dur`.
export function debris(k, { t = 0, n = 10, dur = 0.8, lo = 700, hi = 3200, vol = 0.18, dest = k.out }) {
  for (let i = 0; i < n; i++) {
    const u = Math.pow(k.rnd(), 1.4), tt = t + u * dur;
    k.nz({ t: tt, type: 'bandpass', f: k.rnd(lo, hi), q: 3, a: 0.0005, d: k.rnd(0.015, 0.05), vol: vol * k.rnd(0.3, 1) * (1 - 0.6 * u), dest });
  }
}
// Fire crackle pops.
export function crackles(k, n, t0, t1, vol = 0.2, dest = k.out) {
  for (let i = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * k.rnd();
    k.nz({ t, type: 'bandpass', f: k.rnd(1800, 6000), q: 2.2, a: 0.0004, d: k.rnd(0.006, 0.022), vol: vol * k.rnd(0.4, 1), dest });
  }
}
// Struck metal: inharmonic partials + stick noise.
export const CLANG = [[1, 1, 1], [2.41, 0.8, 0.8], [3.93, 0.6, 0.62], [5.37, 0.45, 0.45], [7.1, 0.3, 0.32], [9.2, 0.18, 0.2]];
export function clang(k, { t = 0, f = 600, vol = 0.15, d = 1.2, dest = k.out, bright = 1, partials = CLANG }) {
  k.bell({ t, f, vol, d, partials, dest, spread: 0.012 });
  k.nz({ t, type: 'highpass', f: 2500, a: 0.0008, d: 0.05, vol: vol * 2 * bright, dest });
  k.nz({ t, type: 'bandpass', f: f * 2.2, q: 2, a: 0.001, d: 0.12, vol: vol * 1.4, dest });
}
// Low boom: sub sweep + brown rumble + chest.
export function boom(k, { t = 0, vol = 0.5, d = 1.2, f0 = 90, f1 = 38, dest = k.out }) {
  k.thump({ t, f0, f1, sweep: 0.15, d, vol, dest });
  k.nz({ t, color: 'brown', type: 'lowpass', f: 220, a: 0.003, d: d * 0.8, vol: vol * 0.9, dest });
  k.nz({ t, color: 'pink', type: 'bandpass', f: 180, q: 0.8, a: 0.002, d: d * 0.4, vol: vol * 0.7, dest });
}
// Electric crackle: stepped-pitch square buzz through a band-pass + fast gated noise.
export function zap(k, { t = 0, dur = 0.3, vol = 0.12, f = 900, dest = k.out }) {
  const steps = [[0, f * k.rnd(0.7, 1.4)]]; for (let x = 0.02; x < dur; x += k.rnd(0.012, 0.03)) steps.push([x, f * k.rnd(0.5, 2)]);
  const g = k.gain(0, dest); k.envPts(g.gain, [[0, 0], [0.004, vol], [dur * 0.6, vol * 0.7], [dur, 0]], t);
  const bp = k.filter('bandpass', 2600, 0.9, g);
  const o = k.osc('square', f, t, dur + 0.02, bp); for (const [x, ff] of steps) o.frequency.setValueAtTime(Math.min(k.nyq, ff * k.r), k.at(t + x));
  const am = k.gain(0.5, dest); k.lfo(t, dur + 0.02, k.rnd(55, 90), 0.5, am.gain, 'square');
  k.nz({ t, type: 'highpass', f: 3000, env: [[0, 0], [0.003, 1], [dur, 0]], vol: vol * 1.6, dest: am });
}
