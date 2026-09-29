// Baked instrument patches (see bake.js). Zones: sustained/looped (ensembles, choirs, pads, brass) or one-shot
// (tuned percussion). Hits: unpitched one-shot variants (drums, cymbals, booms).
// Every voice here is rendered ONCE per session; richness costs nothing at play time.
import { bakeZones, bakeHits, peek } from './bake.js';
import { VOWEL } from '../sfx/common.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- sustained ensembles
function supersaw(k, out, f, t0, T, o) {
  const t1 = t0 + T, N = o.voices ?? 7;
  const sum = k.gain(1 / Math.sqrt(N), null);
  let head = sum;
  for (const [ty, ff, q, g] of o.eq) { const n = k.biq(ty, ff, q, g); head.connect(n); head = n; }
  const lp = k.biq('lowpass', clamp(f * o.lpMul, o.lpMin, o.lpMax), 0.5); head.connect(lp); lp.connect(out);
  for (let i = 0; i < N; i++) {
    const det = (i - (N - 1) / 2) * o.spread + k.rng.range(-1.5, 1.5);
    const osc = k.osc(o.wave || 'sawtooth', f, t0 + k.rng.next() / f, t1, sum, det); // random start phase
    if (o.vib) k.lfo(k.rng.range(o.vib[0] * 0.88, o.vib[0] * 1.12), k.rng.range(o.vib[1] * 0.6, o.vib[1]), osc.detune, t0, t1);
    if (o.drift) k.drift(k.rng.range(0.15, 0.45), o.drift, osc.detune, t0, t1);
  }
  if (o.sub) { const g = k.gain(o.sub, sum); k.osc('triangle', f / 2, t0, t1, g); }
  if (o.hiss) { const bh = k.gain(o.hiss, out); k.noiseSrc('pink', t0, t1, k.biq('bandpass', clamp(f * 5, 2500, 7000), 0.7, 0, bh)); }
}

const ZONES = {
  // 7-voice string section: detuned saws, independent vibrato + drift, spread across the stereo field, body EQ,
  // rosin hiss. One patch covers basses → violins (the lowpass tracks pitch).
  strings: {
    lo: 28, hi: 100, step: 4, att: 0.28, loop: 1.0, xf: 0.26, rms: 0.2, stereo: false,
    voice: (k, out, f, t0, T) => supersaw(k, out, f, t0, T, {
      spread: 4.2, vib: [5.4, 8], drift: 3, lpMul: 12, lpMin: 3200, lpMax: 12500, hiss: 0.014,
      eq: [['highpass', 38, 0.7, 0], ['peaking', 290, 1.0, 2.5], ['peaking', 2800, 1.0, 1.5], ['highshelf', 7500, 0.7, -4]],
    }),
  },
  // warm synth pad (night / stronghold / cutscenes): saws + sub triangle, dark, slowly breathing filter
  pad: {
    lo: 36, hi: 88, step: 5, att: 0.3, loop: 2.0, xf: 0.28, rms: 0.2, stereo: false, rate: 24000,
    voice: (k, out, f, t0, T) => {
      const g = k.gain(1, out), lp = k.biq('lowpass', clamp(f * 3, 700, 3200), 0.7, 0, g);
      k.lfo(0.5, clamp(f * 0.8, 150, 900), lp.frequency, t0, t0 + T);
      for (const d of [-7, 0, 7]) k.osc('sawtooth', f, t0 + k.rng.next() / f, t0 + T, k.gain(0.3, lp), d);
      k.osc('triangle', f / 2, t0, t0 + T, k.gain(0.35, lp));
      k.osc('sine', f, t0, t0 + T, k.gain(0.25, g));
    },
  },
  // dark synth pad for the rift / void: detuned saws through a resonant low-pass, slow beating
  darkpad: {
    lo: 28, hi: 76, step: 5, att: 0.3, loop: 2.0, xf: 0.28, rms: 0.2, stereo: false, rate: 24000,
    voice: (k, out, f, t0, T) => {
      const lp = k.biq('lowpass', clamp(f * 4, 400, 2400), 2.2, 0, out);
      k.lfo(0.5, clamp(f * 1.2, 150, 800), lp.frequency, t0, t0 + T);
      for (const d of [-11, -4, 4, 11]) k.osc('sawtooth', f, t0 + k.rng.next() / f, t0 + T, k.gain(0.25, lp), d);
      k.osc('square', f / 2, t0, t0 + T, k.gain(0.12, lp));
    },
  },
  // brass section (trombones/trumpets): baked "blat" attack (filter opens), bright sustain; play from `ls` for swells
  brass: {
    lo: 34, hi: 82, step: 4, att: 0.36, loop: 0.9, xf: 0.26, rms: 0.2, stereo: false,
    voice: (k, out, f, t0, T) => {
      const ws = k.ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } ws.curve = c; ws.connect(out);
      const pre = k.gain(1.1, ws);
      const lp = k.biq('lowpass', f, 1.4, 0, k.biq('peaking', 1100, 1, 2.5, k.biq('highpass', 60, 0.7, 0, pre)));
      lp.frequency.setValueAtTime(f * 1.2, t0); lp.frequency.linearRampToValueAtTime(clamp(f * 11, 900, 13000), t0 + 0.045);
      lp.frequency.setTargetAtTime(clamp(f * 6.5, 700, 10000), t0 + 0.05, 0.12);
      for (const d of [-9, -2, 6]) {
        const o = k.osc('sawtooth', f, t0 + k.rng.next() / f, t0 + T, k.gain(0.33, lp), d);
        o.detune.setValueAtTime(d - 35, t0); o.detune.linearRampToValueAtTime(d, t0 + 0.07);
        k.lfo(k.rng.range(4.6, 5.4), 3, o.detune, t0, t0 + T);
      }
    },
  },
  // horn section (French horns): mellow, round; slower filter bloom
  horns: {
    lo: 36, hi: 79, step: 4, att: 0.36, loop: 1.0, xf: 0.26, rms: 0.2, stereo: false, rate: 24000,
    voice: (k, out, f, t0, T) => {
      const lp = k.biq('lowpass', f, 1.1, 0, k.biq('lowpass', 3400, 0.6, 0, k.biq('peaking', 420, 1, 3, out)));
      lp.frequency.setValueAtTime(f * 1.1, t0); lp.frequency.linearRampToValueAtTime(clamp(f * 5, 500, 5000), t0 + 0.09);
      lp.frequency.setTargetAtTime(clamp(f * 3.4, 400, 3800), t0 + 0.1, 0.2);
      for (const d of [-6, 5]) {
        const o = k.osc('sawtooth', f, t0 + k.rng.next() / f, t0 + T, k.gain(0.4, lp), d);
        o.detune.setValueAtTime(d - 25, t0); o.detune.linearRampToValueAtTime(d, t0 + 0.08);
        k.lfo(k.rng.range(4.7, 5.3), 4, o.detune, t0, t0 + T);
      }
      k.osc('triangle', f, t0, t0 + T, k.gain(0.25, out));
    },
  },
};

// Formant choir: 5 singers per zone (detuned saws, own vibrato + drift) + breath, through a vowel formant bank.
// Formants rise slightly toward the top of the range (female voices).
function choirVoice(vowel) {
  return (k, out, f, t0, T, m) => {
    const t1 = t0 + T, fs = 1 + 0.13 * clamp((m - 52) / 24, 0, 1);
    const F = [...VOWEL[vowel].map((x) => x * fs), 3300 * fs];
    const sum = k.gain(1, null); sum.connect(k.biq('highpass', 100, 0.7, 0, k.biq('lowpass', 7500, 0.6, 0, out)));
    const src = k.gain(1, null);
    F.forEach((ff, i) => { const bp = k.biq('bandpass', ff, [5.5, 7.5, 10, 11][i]); src.connect(bp); bp.connect(k.gain([1, 0.5, 0.26, 0.13][i], sum)); });
    src.connect(k.biq('lowpass', 420, 0.7, 0, k.gain(0.22, sum)));
    const N = 5;
    for (let i = 0; i < N; i++) {
      const det = (i - 2) * 4.5 + k.rng.range(-2, 2);
      const o = k.osc('sawtooth', f, t0 + k.rng.next() / f, t1, k.gain(0.45, src), det);
      k.lfo(k.rng.range(4.5, 5.6), k.rng.range(12, 20), o.detune, t0, t1);
      k.drift(k.rng.range(0.2, 0.5), 5, o.detune, t0, t1);
    }
    k.noiseSrc('white', t0, t1, k.gain(0.035, src));
  };
}
ZONES.choir_ah = { lo: 40, hi: 88, step: 4, att: 0.28, loop: 1.1, xf: 0.26, rms: 0.2, stereo: false, rate: 24000, voice: choirVoice('ah') };
ZONES.choir_oo = { lo: 40, hi: 88, step: 4, att: 0.28, loop: 1.1, xf: 0.26, rms: 0.2, stereo: false, rate: 24000, voice: choirVoice('oo') };

// ---------------------------------------------------------------- tuned percussion (one-shot zones)
function additive(k, out, f, t0, P, { a = 0.001, d = 2, click = 0, clickF = 3000, trem = 0 } = {}) {
  const dest = trem ? k.gain(1 - trem, out) : out;
  if (trem) k.lfo(5.2, trem, dest.gain, t0, t0 + d * 1.2);
  for (const [r, amp, dm] of P) {
    const ff = f * r; if (ff > Math.min(17000, k.ctx.sampleRate * 0.45)) continue;
    const g = k.gain(0, dest), dd = d * dm;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(amp, t0 + a); g.gain.setTargetAtTime(0, t0 + a, dd / 6.9);
    k.osc('sine', ff, t0, t0 + dd + 0.1, g);
  }
  if (click) { const g = k.gain(0, out); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(click, t0 + 0.0008); g.gain.setTargetAtTime(0, t0 + 0.001, 0.006); k.noiseSrc('white', t0, t0 + 0.06, k.biq('bandpass', clickF, 1.5, 0, g)); }
}
const BELLS = {
  celesta: { lo: 60, hi: 108, step: 5, T: 1.4, P: [[1, 1, 1], [2, 0.28, 0.45], [3, 0.08, 0.3], [4.2, 0.05, 0.2]], d: 1.8, click: 0.05 },
  glock: { lo: 72, hi: 108, step: 5, T: 1.7, P: [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.18, 0.3], [8.93, 0.08, 0.2]], d: 2.4, click: 0.08, clickF: 6000 },
  tubular: { lo: 48, hi: 84, step: 4, T: 3.2, rate: 24000, P: [[1, 1, 1], [2.02, 0.55, 0.75], [2.99, 0.4, 0.55], [4.16, 0.3, 0.4], [5.43, 0.12, 0.3]], d: 5, click: 0.05, clickF: 2000 },
  musicbox: { lo: 72, hi: 108, step: 5, T: 1.4, P: [[1, 1, 1], [3.0, 0.3, 0.3], [5.2, 0.14, 0.2], [8.1, 0.06, 0.15]], d: 1.5, click: 0.12, clickF: 7000 },
  marimba: { lo: 45, hi: 96, step: 5, T: 1.0, rate: 24000, P: [[1, 1, 1], [4.0, 0.3, 0.22], [9.9, 0.06, 0.1]], d: 0.8, click: 0.18, clickF: 1500 },
  xylo: { lo: 65, hi: 108, step: 5, T: 0.7, P: [[1, 1, 1], [3.0, 0.35, 0.25], [6.0, 0.12, 0.12]], d: 0.5, click: 0.25, clickF: 4000 },
  vibes: { lo: 53, hi: 89, step: 5, T: 2.2, rate: 24000, P: [[1, 1, 1], [4.0, 0.22, 0.35], [10, 0.04, 0.15]], d: 3, click: 0.04, trem: 0.35 },
};
for (const [name, b] of Object.entries(BELLS)) {
  ZONES[name] = { lo: b.lo, hi: b.hi, step: b.step, oneShot: true, T: b.T, rate: b.rate, stereo: false, rms: 0, voice: (k, out, f, t0) => additive(k, out, f, t0, b.P, { ...b, d: Math.min(b.d, b.T * 1.3) }) };
}
// timpani: 5 modal partials with a small pitch drop at the strike, felt-mallet thud
ZONES.timpani = {
  lo: 36, hi: 55, step: 3, oneShot: true, T: 2.5, stereo: false, rate: 24000,
  voice: (k, out, f, t0) => {
    for (const [ratio, amp, dm] of [[1, 1, 1], [1.504, 0.42, 0.65], [1.742, 0.22, 0.5], [2.0, 0.28, 0.55], [2.245, 0.1, 0.4]]) {
      const g = k.gain(0, out), d = 2.6 * dm;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(amp, t0 + 0.004); g.gain.setTargetAtTime(0, t0 + 0.004, d / 6.9);
      const o = k.osc('sine', f * ratio, t0, t0 + d + 0.1, g);
      o.frequency.setValueAtTime(f * ratio * 1.018, t0); o.frequency.exponentialRampToValueAtTime(f * ratio, t0 + 0.12);
    }
    const ng = k.gain(0, out); ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(0.8, t0 + 0.002); ng.gain.setTargetAtTime(0, t0 + 0.002, 0.02);
    k.noiseSrc('white', t0, t0 + 0.15, k.biq('lowpass', 900, 0.7, 0, ng));
  },
};

// ---------------------------------------------------------------- unpitched hits
const env = (g, t0, pk, a, dec) => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(pk, t0 + a); g.gain.setTargetAtTime(0, t0 + a, dec / 6.9); };
function drive(k, out, amt = 1.3) { const ws = k.ctx.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(amt * x) / Math.tanh(amt); } ws.curve = c; ws.connect(out); return ws; }
function taiko(k, out, i, t0, sz) {
  const hard = i % 2 === 1, p = 1 + k.rng.range(-0.03, 0.03) - (hard ? 0 : 0.02);
  const [F0, F1, DEC, BP] = { big: [160, 62, 1.2, 330], mid: [240, 100, 0.65, 560], small: [390, 190, 0.3, 950] }[sz];
  const d = drive(k, out, 1.35), dec = DEC * (hard ? 1 : 0.8);
  const g = k.gain(0, d); env(g, t0, 1, 0.002, dec);
  const o = k.osc('sine', F0 * p, t0, t0 + dec + 0.1, g);
  o.frequency.setValueAtTime(F0 * p, t0); o.frequency.exponentialRampToValueAtTime(F1 * p * 1.06, t0 + 0.035); o.frequency.exponentialRampToValueAtTime(F1 * p, t0 + 0.3);
  if (sz !== 'small') { const g2 = k.gain(0, d); env(g2, t0, 0.22, 0.002, dec * 0.35); k.osc('triangle', F1 * p * 1.58, t0, t0 + dec * 0.4 + 0.05, g2); }
  const sg = k.gain(0, d); env(sg, t0, hard ? 1.7 : 1.1, 0.001, 0.035); k.noiseSrc('white', t0, t0 + 0.2, k.biq('bandpass', BP * p, 1, 0, sg));
  const hg = k.gain(0, d); env(hg, t0, hard ? 0.7 : 0.3, 0.0008, 0.008); k.noiseSrc('white', t0, t0 + 0.05, k.biq('highpass', 1800, 0.7, 0, hg));
  if (sz === 'big') { const lg = k.gain(0, out); env(lg, t0, 0.35, 0.004, dec * 1.3); k.osc('sine', 48 * p, t0, t0 + dec * 1.3 + 0.1, lg); }
}
const HITS = {
  taiko_big: { n: 6, len: 1.8, voice: (k, out, i, t0) => taiko(k, out, i, t0, 'big') },
  taiko_mid: { n: 6, len: 1.0, voice: (k, out, i, t0) => taiko(k, out, i, t0, 'mid') },
  taiko_small: { n: 6, len: 0.5, voice: (k, out, i, t0) => taiko(k, out, i, t0, 'small') },
  // field snare: body + wire rattle
  snare: {
    n: 6, len: 0.6,
    voice: (k, out, i, t0) => {
      const hard = i % 2 === 1, p = 1 + k.rng.range(-0.03, 0.03);
      const g = k.gain(0, out); env(g, t0, 0.8, 0.001, 0.12); const o = k.osc('triangle', 210 * p, t0, t0 + 0.2, g); o.frequency.exponentialRampToValueAtTime(160 * p, t0 + 0.05);
      const w = k.gain(0, out); env(w, t0, hard ? 0.9 : 0.55, 0.001, hard ? 0.28 : 0.2); k.noiseSrc('white', t0, t0 + 0.5, k.biq('bandpass', 4200 * p, 0.8, 0, k.biq('highpass', 1500, 0.7, 0, w)));
      const c = k.gain(0, out); env(c, t0, 0.5, 0.0005, 0.01); k.noiseSrc('white', t0, t0 + 0.04, k.biq('bandpass', 2400, 1.2, 0, c));
    },
  },
  frame_open: { n: 4, len: 0.6, voice: (k, out, i, t0) => { const p = 1 + k.rng.range(-0.04, 0.04); const g = k.gain(0, out); env(g, t0, 1, 0.002, 0.38); const o = k.osc('sine', 125 * p, t0, t0 + 0.45, g); o.frequency.exponentialRampToValueAtTime(84 * p, t0 + 0.12); const s = k.gain(0, out); env(s, t0, 0.7, 0.001, 0.02); k.noiseSrc('white', t0, t0 + 0.15, k.biq('bandpass', 650 * p, 0.9, 0, s)); } },
  frame_mute: { n: 4, len: 0.3, voice: (k, out, i, t0) => { const p = 1 + k.rng.range(-0.04, 0.04); const g = k.gain(0, out); env(g, t0, 0.8, 0.002, 0.12); const o = k.osc('sine', 150 * p, t0, t0 + 0.2, g); o.frequency.exponentialRampToValueAtTime(100 * p, t0 + 0.06); const s = k.gain(0, out); env(s, t0, 0.8, 0.001, 0.02); k.noiseSrc('white', t0, t0 + 0.1, k.biq('bandpass', 1100 * p, 0.9, 0, s)); } },
  tamb: { n: 4, len: 0.4, voice: (k, out, i, t0) => { for (const [f, q, d, v] of [[7400, 2.5, 0.16, 1], [10500, 3, 0.1, 0.8], [5200, 3, 0.08, 0.4]]) { const g = k.gain(0, out); env(g, t0 + k.rng.range(0, 0.006), v, 0.002, d * k.rng.range(0.8, 1.2)); k.noiseSrc('white', t0, t0 + d + 0.05, k.biq('bandpass', f * k.rng.range(0.95, 1.05), q, 0, g)); } } },
  shaker: { n: 4, len: 0.2, voice: (k, out, i, t0) => { const g = k.gain(0, out); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 0.02 + k.rng.range(0, 0.01)); g.gain.setTargetAtTime(0, t0 + 0.03, 0.02); k.noiseSrc('white', t0, t0 + 0.15, k.biq('bandpass', 6500 * k.rng.range(0.9, 1.1), 1.2, 0, g)); } },
  clap: { n: 4, len: 0.4, voice: (k, out, i, t0) => { const bp = k.biq('bandpass', 1300 * k.rng.range(0.9, 1.1), 1.1, 0, out); for (let j = 0; j < 4; j++) { const g = k.gain(0, bp); const tt = t0 + j * 0.009 + k.rng.range(0, 0.003); env(g, tt, j === 3 ? 1 : 0.6, 0.0008, j === 3 ? 0.12 : 0.012); k.noiseSrc('white', tt, tt + 0.2, g); } } },
  stomp: { n: 4, len: 0.5, voice: (k, out, i, t0) => { const p = 1 + k.rng.range(-0.05, 0.05); const g = k.gain(0, out); env(g, t0, 1, 0.002, 0.2); const o = k.osc('sine', 110 * p, t0, t0 + 0.3, g); o.frequency.exponentialRampToValueAtTime(55 * p, t0 + 0.06); const s = k.gain(0, out); env(s, t0, 0.6, 0.001, 0.05); k.noiseSrc('pink', t0, t0 + 0.12, k.biq('bandpass', 420 * p, 1, 0, s)); const b = k.gain(0, out); env(b, t0 + 0.004, 0.25, 0.001, 0.03); k.noiseSrc('white', t0, t0 + 0.08, k.biq('bandpass', 2600, 2, 0, b)); } },
  woodblock: { n: 4, len: 0.25, voice: (k, out, i, t0) => { const p = [1, 1.02, 1.5, 1.52][i]; const g = k.gain(0, out); env(g, t0, 1, 0.0008, 0.06); k.osc('sine', 1150 * p, t0, t0 + 0.1, g); const g2 = k.gain(0, out); env(g2, t0, 0.3, 0.0008, 0.03); k.osc('sine', 2700 * p, t0, t0 + 0.06, g2); const c = k.gain(0, out); env(c, t0, 0.3, 0.0005, 0.005); k.noiseSrc('white', t0, t0 + 0.02, k.biq('bandpass', 3000, 1, 0, c)); } },
  triangle: { n: 2, len: 2.2, voice: (k, out, i, t0) => { for (const [r, a, d] of [[1, 0.5, 1.6], [2.71, 0.4, 1.3], [4.98, 0.3, 1.0], [7.4, 0.2, 0.8]]) { const g = k.gain(0, out); env(g, t0, a, 0.001, d); k.osc('sine', 1850 * r * (1 + i * 0.01), t0, t0 + d + 0.1, g); } } },
  // crash cymbal: three noise bands + inharmonic shimmer, stereo
  crash: {
    n: 2, len: 3.2, stereo: true,
    voice: (k, out, i, t0) => {
      for (const [p, type, f, q, d, v] of [[-0.4, 'highpass', 3800, 0.7, 2.8, 1], [0.4, 'bandpass', 5200, 1.4, 1.1, 0.8], [0, 'bandpass', 9000, 1.2, 1.8, 0.6], [0.2, 'bandpass', 2600, 2, 0.6, 0.3]]) {
        const g = k.gain(0, k.pan(p, out)); env(g, t0, v, 0.003, d * k.rng.range(0.85, 1.15));
        k.noiseSrc('white', t0, t0 + d + 0.1, k.biq(type, f * k.rng.range(0.93, 1.07), q, 0, g));
      }
      for (let j = 0; j < 6; j++) { const g = k.gain(0, k.pan(k.rng.range(-0.6, 0.6), out)); env(g, t0, 0.012, 0.002, k.rng.range(1, 2.2)); k.osc('sine', k.rng.range(3000, 8000), t0, t0 + 2.4, g); }
    },
  },
  // suspended-cymbal swell (reverse crash): peaks at the very end — play with offset (len − dur) to fit any length
  swell: {
    n: 1, len: 5, stereo: true, norm: true,
    voice: (k, out, i, t0) => {
      const T = 5, g = k.gain(0, out);
      g.gain.setValueAtTime(0.0005, t0); g.gain.exponentialRampToValueAtTime(1, t0 + T - 0.03); g.gain.linearRampToValueAtTime(0, t0 + T);
      for (const p of [-0.5, 0.5]) { const hp = k.biq('highpass', 1600, 0.7, 0, k.pan(p, g)); hp.frequency.setValueAtTime(1500, t0); hp.frequency.exponentialRampToValueAtTime(5200, t0 + T); k.noiseSrc('white', t0, t0 + T, hp); }
      const r = k.gain(0.35, g); const bp = k.biq('bandpass', 700, 0.8, 0, r); bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(3000, t0 + T); k.noiseSrc('pink', t0, t0 + T, bp);
    },
  },
  // cinematic low boom: sub drop + chest thud + short dark tail
  boom: {
    n: 2, len: 2.8, stereo: true,
    voice: (k, out, i, t0) => {
      const g = k.gain(0, out); env(g, t0, 1, 0.004, 2.4); const o = k.osc('sine', 62, t0, t0 + 3.2, g); o.frequency.setValueAtTime(64 - i * 4, t0); o.frequency.exponentialRampToValueAtTime(31, t0 + 1.2);
      const t = k.gain(0, out); env(t, t0, 0.8, 0.002, 0.35); k.noiseSrc('brown', t0, t0 + 0.5, k.biq('lowpass', 260, 0.8, 0, t));
      const s = k.gain(0, out); env(s, t0, 0.35, 0.001, 0.08); k.noiseSrc('pink', t0, t0 + 0.2, k.biq('bandpass', 900, 0.8, 0, s));
      for (const p of [-0.6, 0.6]) { const r = k.gain(0, k.pan(p, out)); env(r, t0 + 0.02, 0.18, 0.05, 2.2); k.noiseSrc('brown', t0, t0 + 3, k.biq('lowpass', 140, 0.7, 0, r)); }
    },
  },
  // riser: noise + detuned saw sweep, peaks at the end (play with offset like `swell`)
  riser: {
    n: 1, len: 4, stereo: true,
    voice: (k, out, i, t0) => {
      const T = 4, g = k.gain(0, out);
      g.gain.setValueAtTime(0.001, t0); g.gain.exponentialRampToValueAtTime(1, t0 + T - 0.02); g.gain.linearRampToValueAtTime(0, t0 + T);
      const bp = k.biq('bandpass', 400, 1.5, 0, g); bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(7000, t0 + T);
      for (const p of [-0.6, 0.6]) k.noiseSrc('white', t0, t0 + T, k.pan(p, bp));
      const sg = k.gain(0.12, g); for (const d of [-15, 15]) { const o = k.osc('sawtooth', 110, t0, t0 + T, k.biq('lowpass', 3000, 0.7, 0, sg), d); o.frequency.exponentialRampToValueAtTime(880, t0 + T); }
    },
  },
  anvil: { n: 3, len: 1.6, voice: (k, out, i, t0) => { for (const [r, a, d] of [[1, 0.6, 1.2], [2.41, 0.5, 0.9], [3.93, 0.35, 0.7], [5.37, 0.2, 0.5]]) { const g = k.gain(0, out); env(g, t0, a, 0.0008, d); k.osc('sine', 1150 * r * (1 + i * 0.03), t0, t0 + d + 0.1, g); } const c = k.gain(0, out); env(c, t0, 0.5, 0.0005, 0.02); k.noiseSrc('white', t0, t0 + 0.05, k.biq('highpass', 2500, 0.7, 0, c)); } },
};

// ---------------------------------------------------------------- access
const _ = (e) => ({ noise: e.noise, sr: e.ctx.sampleRate });
export function zoneSpec(name) {
  const z = ZONES[name]; if (!z) throw new Error('unknown patch ' + name);
  if (z.oneShot) return { key: 'z:' + name, lo: z.lo, hi: z.hi, step: z.step, stereo: z.stereo ?? false, rate: z.rate, att: z.T, loop: 0, xf: 0, oneShot: true, voice: (k, out, f, t0, T, m) => z.voice(k, out, f, t0, T, m) };
  return { key: 'z:' + name, ...z };
}
// → { value } when already baked, else { promise }
export function getZones(e, name) {
  const { noise, sr } = _(e), spec = zoneSpec(name), v = peek(spec.key, sr);
  return v ? { value: v } : { promise: bakeZones(noise, sr, spec) };
}
export function getHits(e, name) {
  const def = HITS[name]; if (!def) throw new Error('unknown hit ' + name);
  const { noise, sr } = _(e), spec = { key: 'h:' + name, ...def }, v = peek(spec.key, sr);
  return v ? { value: v } : { promise: bakeHits(noise, sr, spec) };
}
export const ZONE_NAMES = Object.keys(ZONES);
export const HIT_NAMES = Object.keys(HITS);
