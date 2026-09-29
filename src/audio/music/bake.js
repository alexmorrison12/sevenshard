// Offline-baked instrument samples. Rich synth patches (supersaw ensembles, formant choirs, drum hits) are rendered
// ONCE per session into AudioBuffers with an OfflineAudioContext, then notes are played as buffer sources
// (≈2 nodes per note instead of ≈10). Results are cached per sample rate and shared by every engine/context.
//
//   bakeZones(noise, sr, spec) → Promise<{ zones: [{ root, buf, ls, le }], spec }>
//     spec: { key, lo, hi, step, stereo, att, loop, xf, rms, voice(ctx, out, f, t0, T, rng, m) }
//     one zone every `step` semitones; each zone = attack part [0, att) + seamless loop [att, att+loop)
//   bakeHits(noise, sr, spec) → Promise<{ bufs: [AudioBuffer...], spec }>  (one-shots: drum/bell variants)
//     spec: { key, n, len, stereo, voice(ctx, out, i, t0, rng) }
// A baked result is also stored synchronously (`peek(key, sr)`) so already-baked instruments start instantly.
import { RNG } from '../util.js';

const CACHE = new Map(); // `${sr}|${key}` → { promise, value }

export function peek(key, sr) { const c = CACHE.get(sr + '|' + key); return c ? c.value : null; }
function cached(key, sr, make) {
  const k = sr + '|' + key;
  let c = CACHE.get(k);
  if (!c) {
    c = { value: null };
    c.promise = make().then((v) => { c.value = v; return v; }).catch((e) => { console.error('[audio] bake failed', key, e); CACHE.delete(k); throw e; });
    CACHE.set(k, c);
  }
  return c.promise;
}
export function bakeStats() {
  let bytes = 0, n = 0;
  for (const c of CACHE.values()) {
    const v = c.value; if (!v) continue;
    for (const b of (v.zones ? v.zones.map((z) => z.buf) : v.bufs || [])) { bytes += b.length * b.numberOfChannels * 4; n++; }
  }
  return { entries: CACHE.size, buffers: n, mb: +(bytes / 1048576).toFixed(1) };
}

// Kit-lite for patch voices inside the bake context.
export class BakeKit {
  constructor(ctx, noise, rng) { this.ctx = ctx; this.noise = noise; this.rng = rng; }
  gain(v, dest) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  biq(type, f, q = 0.707, g = 0, dest = null) { const n = this.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; if (dest) n.connect(dest); return n; }
  pan(p, dest) { const n = this.ctx.createStereoPanner(); n.pan.value = p; if (dest) n.connect(dest); return n; }
  osc(type, f, t0, t1, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.value = f; o.detune.value = detune; if (dest) o.connect(dest); o.start(t0); o.stop(t1); return o;
  }
  lfo(rate, depth, param, t0, t1, type = 'sine') { const g = this.gain(depth, null); g.connect(param); this.osc(type, rate, t0, t1, g); return g; }
  // smooth random drift (noise buffer read extremely slowly) ± depth
  drift(rate, depth, param, t0, t1) {
    const g = this.gain(depth / 0.52, null); g.connect(param);
    const s = this.ctx.createBufferSource(); s.buffer = this.noise.white; s.loop = true; s.playbackRate.value = rate / this.ctx.sampleRate;
    s.connect(g); s.start(t0, this.rng.next() * (s.buffer.duration - 0.1)); s.stop(t1); return g;
  }
  noiseSrc(color, t0, t1, dest, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise[color]; s.loop = true; s.playbackRate.value = rate;
    s.connect(dest); s.start(t0, this.rng.next() * (s.buffer.duration - 0.1)); s.stop(t1); return s;
  }
  wave(amps) { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return this.ctx.createPeriodicWave(re, im); }
}

// Seamless loop: the last `xf` seconds of the loop region are equal-power crossfaded into the audio that precedes
// the loop start, so playback that jumps loopEnd → loopStart continues smoothly (first pass stays untouched).
function loopRegion(d, a0, L, X) {
  for (let i = 0; i < X; i++) {
    const u = (i + 0.5) / X, wOut = Math.cos(u * Math.PI / 2), wIn = Math.sin(u * Math.PI / 2);
    const j = a0 + L - X + i;
    d[j] = d[j] * wOut + d[a0 - X + i] * wIn;
  }
}

export function bakeZones(noise, sr, spec) {
  return cached(spec.key, sr, async () => {
    const { lo, hi, step, stereo = true, att = 0.35, loop = 1.2, xf = 0.3, rms = 0.2, seed = 7, oneShot = false } = spec;
    const roots = []; for (let m = lo; m <= hi; m += step) roots.push(m);
    const T = att + loop + 0.05, gapT = 0.1, slot = T + gapT;
    const nch = stereo ? 2 : 1;
    const ctx = new OfflineAudioContext(nch, Math.ceil(sr * slot * roots.length), sr);
    const bus = ctx.createGain(); bus.connect(ctx.destination);
    const rng = new RNG(seed);
    const k = new BakeKit(ctx, noise, rng);
    roots.forEach((m, i) => {
      const t0 = i * slot, out = ctx.createGain(); out.connect(bus);
      if (!oneShot) { out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + 0.012); }
      spec.voice(k, out, 440 * Math.pow(2, (m - 69) / 12), t0, T, m);
    });
    const all = await ctx.startRendering();
    const A = Math.round(att * sr), Lp = Math.round(loop * sr), X = Math.round(Math.min(xf, att * 0.95, loop * 0.5) * sr);
    const zones = roots.map((m, i) => {
      const s0 = Math.round(i * slot * sr), n = A + Lp;
      const buf = new AudioBuffer({ numberOfChannels: nch, length: n, sampleRate: sr });
      let e = 0, pk = 0;
      for (let c = 0; c < nch; c++) {
        const src = all.getChannelData(c), d = buf.getChannelData(c);
        for (let j = 0; j < n; j++) { d[j] = src[s0 + j]; const a = d[j] < 0 ? -d[j] : d[j]; if (a > pk) pk = a; }
        if (!oneShot) { loopRegion(d, A, Lp, X); for (let j = A; j < n; j++) e += d[j] * d[j]; }
        else { const f = Math.min(n, Math.round(0.03 * sr)); for (let j = 0; j < f; j++) d[n - 1 - j] *= j / f; }
      }
      // loops: equal RMS per zone; one-shots: equal peak
      const g = oneShot ? 0.8 / (pk || 1) : rms / Math.sqrt(e / (Lp * nch) || 1e-12);
      for (let c = 0; c < nch; c++) { const d = buf.getChannelData(c); for (let j = 0; j < n; j++) d[j] *= g; }
      return { root: m, buf, ls: oneShot ? null : A / sr, le: oneShot ? null : n / sr };
    });
    return { zones, spec };
  });
}

// One-shot hits (drums, bells, stabs): `n` variants rendered back to back, trimmed and peak-normalised.
export function bakeHits(noise, sr, spec) {
  return cached(spec.key, sr, async () => {
    const { n = 4, len = 2, stereo = false, seed = 11, peak = 0.9, norm = true } = spec;
    const slot = len + 0.05, nch = stereo ? 2 : 1;
    const ctx = new OfflineAudioContext(nch, Math.ceil(sr * slot * n), sr);
    const rng = new RNG(seed);
    const k = new BakeKit(ctx, noise, rng);
    for (let i = 0; i < n; i++) { const out = ctx.createGain(); out.connect(ctx.destination); spec.voice(k, out, i, i * slot); }
    const all = await ctx.startRendering();
    const N = Math.round(len * sr), fade = Math.round(0.03 * sr);
    const bufs = [];
    let gmax = 0;
    for (let i = 0; i < n; i++) {
      const s0 = Math.round(i * slot * sr);
      const buf = new AudioBuffer({ numberOfChannels: nch, length: N, sampleRate: sr });
      let pk = 0;
      for (let c = 0; c < nch; c++) {
        const src = all.getChannelData(c), d = buf.getChannelData(c);
        for (let j = 0; j < N; j++) { d[j] = src[s0 + j]; const a = Math.abs(d[j]); if (a > pk) pk = a; }
        for (let j = 0; j < fade; j++) d[N - 1 - j] *= j / fade;
      }
      if (pk > gmax) gmax = pk;
      bufs.push(buf);
    }
    // one gain for all variants (keeps their relative levels, e.g. velocity layers)
    if (norm && gmax > 0) { const g = peak / gmax; for (const b of bufs) for (let c = 0; c < nch; c++) { const d = b.getChannelData(c); for (let j = 0; j < d.length; j++) d[j] *= g; } }
    return { bufs, spec };
  });
}
