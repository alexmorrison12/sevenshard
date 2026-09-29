// Orchestra for the music engine. Two families:
//  • baked (patches.js): Ens (string ensemble / choirs / pads / brass & horn sections), Mallet (bells, timpani),
//    Perc (drums, cymbals, booms, risers) — ≈2 nodes per note, the richness was paid once at bake time;
//  • live synth for expressive monophonic leads: Horn, Wind, Solo (violin/cello/fiddle), Strings (spiccato,
//    tremolo, pizzicato), Harp/Lute (Karplus-Strong buffers), Organ, Synth.
// Every instrument owns a tiny bus (in → EQ → pan → track out + reverb send) that is connected only while it has
// sounding notes (idle buses cost nothing). Per-note filters/LFOs run at k-rate (per 128-frame block).
import { mtof, clamp, RNG } from '../util.js';
import { getZones, getHits } from './patches.js';

// k-rate: automation evaluated once per render block instead of per sample (≈10× cheaper, inaudible for envelopes).
export const kr = (p) => { try { p.automationRate = 'k-rate'; } catch (e) { /* unsupported */ } return p; };
function biq(ctx, type, f, q = 0.707, g = 0) { const n = ctx.createBiquadFilter(); n.type = type; kr(n.frequency); kr(n.Q); kr(n.gain); kr(n.detune); n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; }
function link(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function eqChain(ctx, input, bands) { let h = input; for (const [ty, f, q, g] of bands) { const n = biq(ctx, ty, f, q, g); h.connect(n); h = n; } return h; }

function hashName(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

class Inst {
  constructor(tr, o = {}) {
    // own RNG: instrument-internal randomness never shifts the track's arrangement choices (solo renders match)
    this.tr = tr; this.ctx = tr.ctx; this.o = o; this.a = tr.a; this.rng = new RNG(((tr.seed >>> 0) ^ hashName(o.name || '')) >>> 0);
    const ctx = this.ctx;
    this.in = ctx.createGain(); this.in.gain.value = o.vol ?? 1;
    const last = this.build(this.in, o);
    this.panner = ctx.createStereoPanner(); this.panner.pan.value = o.pan ?? 0;
    last.connect(this.panner);
    if (o.rev) { this.rs = ctx.createGain(); this.rs.gain.value = o.rev; this.panner.connect(this.rs); }
    this.on = false; this.until = 0; this.tail = o.tail ?? this.defTail ?? 2.5;
    tr.insts.push(this);
  }
  get defTail() { return 2.5; }
  build(n, o) { return o.eq ? eqChain(this.ctx, n, o.eq) : n; }
  // wait for a baked resource: sync when cached, else registers a pending promise on the track
  need(res, apply) { if (res.value) apply(res.value); else this.tr.pending.push(res.promise.then(apply)); }
  // schedulable? (not skipped/late/solo-muted); records the note for the lab's piano roll; wakes the bus
  live(t, m = 0, d = 0, v = 0) {
    const tr = this.tr, so = tr.eng.solo;
    if (tr.silent || t < this.ctx.currentTime - 0.01 || (so && !so.includes(this.o.name))) return false;
    if (tr.log) tr.log.push([this.o.name, +t.toFixed(3), m, +d.toFixed(3), +v.toFixed(2)]);
    this.wake(t + d + this.tail);
    return true;
  }
  wake(until) {
    if (!this.on) { this.panner.connect(this.tr.out); if (this.rs) this.rs.connect(this.tr.rev); this.on = true; }
    if (until > this.until) this.until = until;
  }
  sweep(now) {
    if (this.on && now > this.until) {
      try { this.panner.disconnect(this.tr.out); if (this.rs) this.rs.disconnect(this.tr.rev); } catch (e) { /* noop */ }
      this.on = false;
    }
  }
  src(buf, t, end, dest, rate = 1, detune = 0) {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; if (detune) s.detune.value = detune;
    s.connect(dest); s.start(t); s.stop(end); this.tr.reg(s, end); return s;
  }
  gainNode(v = 0, dest = this.in) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  osc(type, f, t, end, dest, detune = 0) {
    const o = this.ctx.createOscillator(); kr(o.detune); kr(o.frequency);
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); this.tr.reg(o, end);
    return o;
  }
  vib(t, end, rate, depth, delay = 0, type = 'sine') {
    const ctx = this.ctx, l = ctx.createOscillator(), g = ctx.createGain();
    l.type = type; l.frequency.value = rate * (0.93 + 0.14 * this.rng.next());
    if (delay > 0) { g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(depth, t + delay + 0.45); } else g.gain.value = depth;
    l.connect(g); l.start(Math.max(ctx.currentTime, t - this.rng.next() * 0.2)); l.stop(end); this.tr.reg(l, end);
    return g;
  }
  noise(t, end, dest, color = 'white', rate = 1) {
    const s = this.ctx.createBufferSource(), b = this.a.noise[color];
    s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.connect(dest);
    s.start(t, this.rng.next() * (b.duration - 0.2)); s.stop(end); this.tr.reg(s, end);
    return s;
  }
}

// ---------------------------------------------------------------- baked sustained ensembles
// Stereo "ensemble" widener for a bus: dry + two slowly modulated short delays panned L/R (k-rate modulation).
function widen(tr, input, { mix = 0.5, depth = 0.0018, rates = [0.23, 0.31], times = [0.012, 0.019] } = {}) {
  const ctx = tr.ctx, out = ctx.createGain();
  input.connect(out);
  for (let i = 0; i < 2; i++) {
    const d = ctx.createDelay(0.05); kr(d.delayTime); d.delayTime.value = times[i];
    const l = ctx.createOscillator(); kr(l.frequency); l.frequency.value = rates[i];
    const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(d.delayTime);
    l.start(); tr.keep(l);
    const w = ctx.createGain(); w.gain.value = mix;
    const p = ctx.createStereoPanner(); p.pan.value = i ? 0.8 : -0.8;
    link(input, d, w, p, out);
  }
  return out;
}
// Ens: string section, choirs, pads, brass/horn sections (mono zones every few semitones, looped sustain).
// patch: strings | choir_ah | choir_oo | pad | darkpad | brass | horns.
// note(t, m, dur, vel, { art, a, r, gain }) with art:
//   legato (default: attack from velocity) | swell (cresc–decresc) | marc (accent then settle) | stab (short, punchy)
//   | stacc (choir/strings staccato) | pad (starts inside the loop: no attack colour)
// Section brightness is a bus low-pass: o.bright (0.3 dark … 1.5 bright) and ens.brighten(v, t, glide).
export class Ens extends Inst {
  constructor(tr, o = {}) {
    super(tr, { pan: 0, rev: 0.4, ...o });
    this.patch = o.patch || 'strings'; this.scale = o.scale ?? 0.32;
    this.baked = /brass|horns/.test(this.patch); // patches whose baked attack is meaningful
    this.z = null;
    this.need(getZones(this.a, this.patch), (v) => { this.z = v.zones; this.step = v.spec.step; this.lo = v.spec.lo; });
  }
  build(n, o) {
    let h = n;
    if (o.hp) { const f = biq(this.ctx, 'highpass', o.hp, 0.7); h.connect(f); h = f; }
    this.lpf = biq(this.ctx, 'lowpass', 20000 * clamp(o.bright ?? 1, 0.1, 1) ** 2, 0.5); h.connect(this.lpf); h = this.lpf;
    if (o.eq) h = eqChain(this.ctx, h, o.eq);
    return o.wide === false || this.a.lite ? h : widen(this.tr, h, { mix: o.wideMix ?? 0.5 }); // quality 'low': no widener
  }
  brighten(v, t, glide = 1) { this.lpf.frequency.setTargetAtTime(20000 * clamp(v, 0.1, 1) ** 2, t, glide / 3); }
  zone(m) { const i = clamp(Math.round((m - this.lo) / this.step), 0, this.z.length - 1); return this.z[i]; }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.z || !this.live(t, m, dur, vel)) return;
    const ctx = this.ctx, z = this.zone(m), art = o.art || this.o.art || 'legato';
    const s = ctx.createBufferSource(); s.buffer = z.buf; s.loop = true; s.loopStart = z.ls; s.loopEnd = z.le;
    s.playbackRate.value = Math.pow(2, (m - z.root) / 12);
    const g = ctx.createGain(); g.gain.value = 0; g.connect(this.in); s.connect(g);
    const pk = vel * this.scale * (o.gain ?? 1), P = g.gain;
    let end, off = 0;
    if (art === 'stab' || art === 'marc') {
      const hold = art === 'stab' ? Math.min(dur, 0.22) : Math.max(0.1, dur), r = o.r ?? (art === 'stab' ? 0.14 : 0.35);
      P.setValueAtTime(0, t); P.linearRampToValueAtTime(pk * 1.25, t + 0.006); P.setTargetAtTime(pk * (art === 'stab' ? 0.45 : 0.7), t + 0.01, 0.07);
      P.setTargetAtTime(0, t + hold, r / 3.5); end = t + hold + r * 1.8;
    } else if (art === 'stacc' || art === 'spicc') {
      const d = o.d ?? (art === 'stacc' ? 0.12 : 0.1);
      P.setValueAtTime(0, t); P.linearRampToValueAtTime(pk * 1.2, t + 0.012); P.setTargetAtTime(0, t + 0.03, d / 2.5); end = t + 0.05 + d * 2.2;
      off = z.ls * this.rng.range(0.2, 0.6);
    } else {
      const a = o.a ?? clamp(0.1 + (1 - vel) * 0.45, 0.03, 2.5), r = o.r ?? 0.6, hold = Math.max(a, dur);
      P.setValueAtTime(0, t);
      if (art === 'swell') { P.linearRampToValueAtTime(pk * 0.35, t + a); P.linearRampToValueAtTime(pk, t + hold * 0.65); P.linearRampToValueAtTime(pk * 0.7, t + hold); }
      else { P.linearRampToValueAtTime(pk, t + a); P.linearRampToValueAtTime(pk * 0.9, t + Math.max(a + 0.01, hold)); }
      P.setTargetAtTime(0, t + hold, r / 3.5); end = t + hold + r * 1.7;
      // start inside the loop at a random point (decorrelates chord notes; the attack is shaped by the envelope),
      // except brass/horn legato where the baked attack "blat" is part of the sound
      if (!this.baked || art === 'swell' || art === 'pad' || o.soft) off = z.ls + this.rng.next() * (z.le - z.ls) * 0.9;
    }
    s.start(t, off); s.stop(end); this.tr.reg(s, end);
    return end;
  }
}

// ---------------------------------------------------------------- baked tuned percussion
// Mallet: celesta | glock | tubular | musicbox | marimba | xylo | vibes | timpani (one-shot zones)
export class Mallet extends Inst {
  constructor(tr, o = {}) {
    super(tr, { pan: 0.25, rev: 0.45, ...o });
    this.kind = o.kind || 'celesta'; this.scale = o.scale ?? 0.3; this.z = null;
    this.need(getZones(this.a, this.kind), (v) => { this.z = v.zones; this.step = v.spec.step; this.lo = v.spec.lo; });
  }
  get defTail() { return 5; }
  zone(m) { const i = clamp(Math.round((m - this.lo) / this.step), 0, this.z.length - 1); return this.z[i]; }
  note(t, m, dur, vel = 0.5, o = {}) {
    if (!this.z || !this.live(t, m, dur, vel)) return;
    const z = this.zone(m), rate = Math.pow(2, (m - z.root) / 12), g = this.gainNode(vel * this.scale * (o.gain ?? 1));
    let end = t + z.buf.duration / rate;
    if (o.damp) { const e = t + dur; g.gain.setValueAtTime(vel * this.scale, e); g.gain.linearRampToValueAtTime(0, e + 0.08); end = Math.min(end, e + 0.1); }
    this.src(z.buf, t, end, g, rate);
    return end;
  }
  hit(t, m, vel = 0.7, o = {}) { return this.note(t, m, 0.5, vel, o); }
  // timpani-style roll: rapid soft strokes swelling from v0 to v1, optional closing stroke
  roll(t, m, dur, v0 = 0.1, v1 = 0.8, o = {}) {
    if (!this.z) return;
    const rate = o.rate ?? 17; let k = 0;
    for (let x = 0; x < dur; x += 1 / rate, k++) {
      const u = x / dur, v = v0 + (v1 - v0) * u * u;
      this.note(t + x + this.rng.range(-0.006, 0.006), m, 0.3, v * (k % 2 ? 0.8 : 1) * 0.55, { gain: o.gain });
    }
    if (o.hit !== false) this.note(t + dur, m, 0.5, Math.min(1, v1 * 1.1));
  }
}

// ---------------------------------------------------------------- baked drums / cymbals / fx
// Perc: sets = { name: hitBankName } (e.g. { big: 'taiko_big' }). hit(t, vel, { set, pitch }) — soft/hard variants
// alternate in the bank (even = soft, odd = hard); never the same variant twice in a row.
export class Perc extends Inst {
  constructor(tr, o = {}) {
    super(tr, { pan: 0, rev: 0.3, ...o });
    this.sets = o.sets || { hit: o.bank || 'taiko_big' }; this.def = Object.keys(this.sets)[0];
    this.scale = o.scale ?? 0.5; this.banks = {}; this.last = {};
    for (const [k, bank] of Object.entries(this.sets)) this.need(getHits(this.a, bank), (v) => { this.banks[k] = v.bufs; });
  }
  get defTail() { return 4; }
  hit(t, vel = 0.7, o = {}) {
    const set = o.set || this.def, bufs = this.banks[set];
    if (!bufs || !this.live(t, 30, 0.1, vel)) return;
    const hard = vel > 0.62, cand = [];
    for (let i = 0; i < bufs.length; i++) if (bufs.length < 3 || (i % 2 === 1) === hard) cand.push(i);
    let i = cand[Math.floor(this.rng.next() * cand.length)];
    if (i === this.last[set] && cand.length > 1) i = cand[(cand.indexOf(i) + 1) % cand.length];
    this.last[set] = i;
    const b = bufs[i], rate = o.pitch ?? 1; // rate exactly 1 = no resampling (≈16× cheaper); variety = variants
    const g = this.gainNode(vel * this.scale * (o.gain ?? 1));
    this.src(b, t, t + b.duration / rate, g, rate);
  }
  // play a peak-at-end buffer (swell / riser) so its peak lands at t + dur
  rise(t, dur, vel = 0.6, set = 'swell') {
    const bufs = this.banks[set]; if (!bufs || !this.live(t, 99, dur, vel)) return;
    const b = bufs[0], off = Math.max(0, b.duration - dur);
    const g = this.gainNode(vel * this.scale);
    const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(g); s.start(t, off); s.stop(t + b.duration - off + 0.02); this.tr.reg(s, t + b.duration - off);
  }
  roll(t, dur, v0 = 0.2, v1 = 0.8, o = {}) {
    const rate = o.rate ?? 16;
    for (let x = 0; x < dur; x += 1 / rate) { const u = x / dur; this.hit(t + x + this.rng.range(-0.004, 0.004), v0 + (v1 - v0) * u, o); }
  }
}
// Convenience wrappers keeping the classic names used by the tracks
export class Taiko extends Perc {
  constructor(tr, o = {}) { const sz = o.size || 'big'; super(tr, { sets: { hit: 'taiko_' + sz }, scale: sz === 'small' ? 0.42 : sz === 'mid' ? 0.45 : 0.5, rev: 0.32, ...o }); }
  hit(t, vel = 0.8, o = {}) { super.hit(t, vel, { ...o, gain: (o.gain ?? 1) * (o.rim ? 1.15 : 1) }); }
}
export class Cymbal extends Perc {
  constructor(tr, o = {}) { super(tr, { sets: { crash: 'crash', swell: 'swell' }, scale: 0.28, pan: -0.15, rev: 0.4, ...o }); }
  crash(t, vel = 0.7) { this.hit(t, vel, { set: 'crash' }); }
  swell(t, dur = 2, vel = 0.6) { this.rise(t, dur, vel, 'swell'); }
}
export class HandDrum extends Perc {
  // frame drum (hit), tambourine, shaker, clap, stomp, woodblock, triangle
  constructor(tr, o = {}) { super(tr, { sets: { open: 'frame_open', mute: 'frame_mute', tamb: 'tamb', shaker: 'shaker', clap: 'clap', stomp: 'stomp', block: 'woodblock', tri: 'triangle', ...(o.extra || {}) }, scale: 0.45, pan: 0.1, rev: 0.2, ...o }); }
  hit(t, vel = 0.7, o = {}) { super.hit(t, vel, { ...o, set: o.set || (o.open === false ? 'mute' : 'open') }); }
  tamb(t, vel = 0.5) { super.hit(t, vel, { set: 'tamb', gain: 0.6 }); }
  shake(t, vel = 0.4) { super.hit(t, vel, { set: 'shaker', gain: 0.45 }); }
  clap(t, vel = 0.6) { super.hit(t, vel, { set: 'clap', gain: 0.7 }); }
  stomp(t, vel = 0.7) { super.hit(t, vel, { set: 'stomp' }); }
  block(t, vel = 0.6, hi = false) { super.hit(t, vel, { set: 'block', gain: 0.5, pitch: hi ? 1.5 : 1 }); }
  tri(t, vel = 0.5) { super.hit(t, vel, { set: 'tri', gain: 0.35 }); }
}
export class Snare extends Perc {
  constructor(tr, o = {}) { super(tr, { sets: { hit: 'snare' }, scale: 0.38, pan: -0.1, rev: 0.3, ...o }); }
}
// cinematic hits: boom (low impact), riser, anvil
export class Fx extends Perc {
  constructor(tr, o = {}) { super(tr, { sets: { boom: 'boom', riser: 'riser', swell: 'swell', anvil: 'anvil' }, scale: 0.5, rev: 0.35, ...o }); }
  boom(t, vel = 0.8) { this.hit(t, vel, { set: 'boom' }); }
  riser(t, dur, vel = 0.5) { this.rise(t, dur, vel, 'riser'); }
  anvil(t, vel = 0.6) { this.hit(t, vel, { set: 'anvil', gain: 0.5 }); }
}
export class Timpani extends Mallet {
  constructor(tr, o = {}) { super(tr, { kind: 'timpani', pan: 0.15, rev: 0.4, scale: 0.55, ...o }); }
  hit(t, m, vel = 0.7) { return this.note(t, m, 0.5, vel); }
}
export class Bells extends Mallet {}

// ---------------------------------------------------------------- live: strings (spiccato / tremolo / pizzicato)
export class Strings extends Inst {
  constructor(tr, o = {}) { super(tr, { pan: -0.2, rev: 0.35, ...o }); this.bright = o.bright ?? 1; this.scale = o.scale ?? 0.075; }
  build(n, o) { return eqChain(this.ctx, n, [['highpass', o.hp ?? 55, 0.7, 0], ['peaking', o.body ?? 260, 1.1, 2], ['peaking', 3200, 1.0, -1.5], ['highshelf', 8000, 0.7, -3.5]]); }
  note(t, m, dur, vel = 0.6, o = {}) {
    const art = o.art || this.o.art || 'spicc';
    if (art === 'pizz') return this.pizz(t, m, vel, o);
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1), bright = this.bright * (o.bright ?? 1);
    const lp = biq(this.ctx, 'lowpass', clamp(f * (3.2 + 9 * vel * bright), 900, 14000), 0.6); lp.connect(out);
    let end;
    if (art === 'trem') {
      const a = o.a ?? 0.3, r = o.r ?? 0.5, hold = Math.max(a, dur);
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a); out.gain.setValueAtTime(pk, t + hold); out.gain.setTargetAtTime(0, t + hold, r / 3.5);
      end = t + hold + r * 1.6;
      const am = this.gainNode(0.55, out); lp.disconnect(); lp.connect(am);
      this.vib(t, end, o.tremRate ?? 13, 0.45, 0, 'triangle').connect(am.gain);
      for (const d of [-7, 7]) this.osc('sawtooth', f, t, end, lp, d + this.rng.range(-3, 3));
    } else { // spiccato / short
      const a = 0.006, d = Math.max(0.1, o.d ?? 0.16), pS = pk * 1.5;
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pS * 2.6, t + a); out.gain.setTargetAtTime(pS * 1.1, t + a, 0.03); out.gain.setTargetAtTime(0, t + a + 0.04, d / 3.2);
      end = t + a + d * 1.8;
      this.osc('sawtooth', f, t, end, lp, this.rng.range(-8, 8));
      if (o.double !== false && vel > 0.5) this.osc('sawtooth', f, t, end, lp, this.rng.range(6, 12));
    }
    return end;
  }
  pizz(t, m, vel, o = {}) {
    if (!this.live(t, m, 0.3, vel)) return;
    const f = mtof(m), buf = this.a.ks(f, { t60: clamp(1.4 - (m - 36) * 0.02, 0.35, 1.2), bright: 0.25, pos: 0.25, shape: 0.35 });
    const g = this.gainNode(vel * this.scale * 3.2 * (o.gain ?? 1));
    this.src(buf, t, t + buf.duration, g);
  }
}

// ---------------------------------------------------------------- live: solo strings (violin / cello / fiddle)
export class Solo extends Inst {
  constructor(tr, o = {}) { super(tr, { pan: -0.1, rev: 0.45, ...o }); this.kind = o.kind || 'violin'; this.scale = o.scale ?? 0.12; this.prevF = 0; this.prevEnd = 0; }
  build(n, o) {
    const cello = (o.kind || 'violin') === 'cello';
    return eqChain(this.ctx, n, cello ? [['highpass', 55, 0.7, 0], ['peaking', 220, 1.2, 4], ['peaking', 1200, 1.2, -2], ['peaking', 2400, 1.4, 1.5], ['highshelf', 5000, 0.7, -6]]
      : [['highpass', 180, 0.7, 0], ['peaking', 450, 1.1, 2.5], ['peaking', 1400, 1.2, -2.5], ['peaking', 2800, 1.3, 3], ['highshelf', 7000, 0.7, -5]]);
  }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const ctx = this.ctx, f = mtof(m), out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1);
    const fiddle = this.kind === 'fiddle', a = o.a ?? (fiddle ? 0.02 : clamp(0.06 + (1 - vel) * 0.2, 0.04, 0.4)), r = o.r ?? (fiddle ? 0.1 : 0.25);
    const hold = Math.max(a, dur - 0.02);
    const lp = biq(ctx, 'lowpass', f * 2, 0.8); lp.connect(out);
    lp.frequency.setValueAtTime(f * 2.5, t); lp.frequency.linearRampToValueAtTime(clamp(f * (4 + 8 * vel), 1200, 12000), t + a + 0.05);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a);
    if (hold > 0.6) { out.gain.linearRampToValueAtTime(pk * 1.1, t + hold * 0.55); out.gain.linearRampToValueAtTime(pk * 0.85, t + hold); } else out.gain.setValueAtTime(pk * 0.95, t + hold);
    out.gain.setTargetAtTime(0, t + hold, r / 3.5);
    const end = t + hold + r * 1.8;
    const vg = this.vib(t, end, fiddle ? 6 : 5.5, fiddle ? 9 : (this.kind === 'cello' ? 16 : 20), hold > 0.35 ? 0.18 : 10);
    const slur = o.slur && this.prevF && Math.abs(t - this.prevEnd) < 0.08;
    for (const d of [-4, 4]) {
      const osc = this.osc('sawtooth', f, t, end, lp, d);
      if (slur) { osc.frequency.setValueAtTime(this.prevF, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
      vg.connect(osc.detune);
    }
    this.prevF = f; this.prevEnd = t + dur;
    return end;
  }
}

// ---------------------------------------------------------------- live: horns & brass (melodic lines)
export class Horn extends Inst {
  // kind: horn (mellow) | trumpet (bright) | trombone | tuba
  constructor(tr, o = {}) { super(tr, { pan: 0.25, rev: 0.45, ...o }); this.kind = o.kind || 'horn'; this.scale = o.scale ?? ({ horn: 0.16, trumpet: 0.1, trombone: 0.12, tuba: 0.18 })[this.kind] ?? 0.14; }
  build(n, o) {
    const k = o.kind || 'horn';
    if (k === 'trumpet') return eqChain(this.ctx, n, [['highpass', 150, 0.7, 0], ['peaking', 1300, 1, 3], ['lowpass', 9000, 0.6, 0]]);
    if (k === 'tuba') return eqChain(this.ctx, n, [['highpass', 30, 0.7, 0], ['peaking', 200, 1, 3], ['lowpass', 2200, 0.6, 0]]);
    if (k === 'trombone') return eqChain(this.ctx, n, [['highpass', 60, 0.7, 0], ['peaking', 600, 1, 2.5], ['lowpass', 6000, 0.6, 0]]);
    return eqChain(this.ctx, n, [['highpass', 70, 0.7, 0], ['peaking', 380, 1, 3], ['lowpass', 3600, 0.6, 0]]);
  }
  note(t, m, dur, vel = 0.7, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), k = this.kind, brassy = k !== 'horn', art = o.art || 'sus';
    const out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1);
    const lp = biq(this.ctx, 'lowpass', f, brassy ? 1.4 : 1.1); lp.connect(out);
    const a = o.a ?? (art === 'swell' ? dur * 0.7 : brassy ? 0.022 : clamp(0.09 - vel * 0.05, 0.03, 0.12));
    const r = o.r ?? (brassy ? 0.16 : 0.3);
    const hold = art === 'stab' ? Math.min(dur, 0.2) : Math.max(a, dur);
    const peakMul = brassy ? 3 + 10 * vel : 2.2 + 5 * vel, susMul = brassy ? 2.4 + 6 * vel : 1.8 + 3.4 * vel;
    lp.frequency.setValueAtTime(f * 1.1, t);
    lp.frequency.linearRampToValueAtTime(clamp(f * peakMul, 300, 14000), t + Math.max(0.02, a * (art === 'swell' ? 1 : 1.4)));
    lp.frequency.setTargetAtTime(clamp(f * susMul, 250, 12000), t + a * 1.4, 0.2);
    lp.frequency.setTargetAtTime(f * 1.1, t + hold, r / 2);
    out.gain.setValueAtTime(0, t);
    if (art === 'swell') { out.gain.linearRampToValueAtTime(pk, t + a); out.gain.setValueAtTime(pk, t + hold); }
    else if (art === 'stab') { out.gain.linearRampToValueAtTime(pk * 1.25, t + a); out.gain.setTargetAtTime(pk * 0.35, t + a, 0.06); }
    else { out.gain.linearRampToValueAtTime(pk, t + a); out.gain.linearRampToValueAtTime(pk * 0.85, t + a + 0.15); out.gain.setValueAtTime(pk * 0.85, t + hold); }
    out.gain.setTargetAtTime(0, t + hold, r / 3.5);
    const end = t + hold + r * 1.7;
    const vg = art === 'stab' || dur < 0.3 || this.a.lite ? null : this.vib(t, end, 5, brassy ? 3 : 4.5, 0.3);
    for (const d of [-5, 5]) {
      const osc = this.osc('sawtooth', f, t, end, lp, d);
      osc.detune.setValueAtTime(d - (brassy ? 18 : 28), t); osc.detune.linearRampToValueAtTime(d, t + 0.06);
      if (vg) vg.connect(osc.detune);
    }
    return end;
  }
}

// ---------------------------------------------------------------- live: woodwinds & folk winds
const WAVES = {
  flute: [1, 0.32, 0.1, 0.05, 0.025, 0.012],
  piccolo: [1, 0.2, 0.05, 0.02],
  oboe: [0.7, 1, 0.9, 0.62, 0.42, 0.3, 0.22, 0.15, 0.1, 0.07, 0.05, 0.03],
  clarinet: [1, 0.04, 0.55, 0.03, 0.32, 0.02, 0.18, 0.02, 0.1, 0.01, 0.05],
  bassoon: [0.55, 1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.22, 0.15, 0.1, 0.07, 0.05],
  recorder: [1, 0.13, 0.26, 0.05, 0.09, 0.02, 0.04],
  whistle: [1, 0.22, 0.1, 0.035, 0.015],
  ocarina: [1, 0.07, 0.025],
  accordion: [1, 0.85, 0.7, 0.58, 0.48, 0.4, 0.33, 0.27, 0.22, 0.18, 0.14, 0.11, 0.09, 0.07],
};
const WIND = {
  //           scale  breath vibHz vibCents attack
  flute: [0.22, 1, 5.1, 12, 0.05], piccolo: [0.13, 0.8, 5.4, 10, 0.04], oboe: [0.11, 0.25, 5.6, 12, 0.04],
  clarinet: [0.16, 0.35, 5, 3, 0.05], bassoon: [0.15, 0.2, 5, 6, 0.04], recorder: [0.2, 0.7, 5, 5, 0.035],
  whistle: [0.16, 0.9, 5.8, 8, 0.02], ocarina: [0.22, 0.8, 5, 7, 0.04], accordion: [0.07, 0, 0, 0, 0.03],
};
export class Wind extends Inst {
  constructor(tr, o = {}) {
    super(tr, { pan: -0.1, rev: 0.4, ...o });
    this.kind = o.kind || 'flute';
    this.wave = tr.a.wave(this.kind, WAVES[this.kind]);
    const W = WIND[this.kind];
    this.scale = o.scale ?? W[0]; this.breath = W[1]; this.vibHz = W[2]; this.vibC = o.vibrato ?? W[3]; this.att = W[4];
  }
  build(n, o) {
    const k = o.kind || 'flute', c = this.ctx;
    if (k === 'oboe') return eqChain(c, n, [['highpass', 230, 0.7, 0], ['peaking', 1150, 1.3, 5], ['peaking', 2900, 2, 2], ['lowpass', 6500, 0.7, 0]]);
    if (k === 'clarinet') return eqChain(c, n, [['highpass', 140, 0.7, 0], ['peaking', 1500, 1, 2], ['lowpass', 5000, 0.7, 0]]);
    if (k === 'bassoon') return eqChain(c, n, [['highpass', 50, 0.7, 0], ['peaking', 480, 1.4, 5], ['peaking', 1200, 1.6, 2], ['lowpass', 3800, 0.7, 0]]);
    if (k === 'accordion') return eqChain(c, n, [['highpass', 110, 0.7, 0], ['peaking', 1900, 1.2, 3], ['lowpass', 5500, 0.7, 0]]);
    if (k === 'ocarina') return eqChain(c, n, [['highpass', 300, 0.7, 0], ['lowpass', 5000, 0.7, 0]]);
    return eqChain(c, n, [['highpass', 220, 0.7, 0], ['peaking', 2600, 1, 1.5], ['lowpass', 9500, 0.7, 0]]);
  }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1), acc = this.kind === 'accordion';
    const a = o.a ?? this.att, r = o.r ?? (acc ? 0.08 : 0.12), hold = Math.max(a, dur - 0.02);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a);
    if (hold > 0.5 && !acc) { out.gain.linearRampToValueAtTime(pk * 1.08, t + hold * 0.6); out.gain.linearRampToValueAtTime(pk * 0.9, t + hold); }
    else out.gain.setValueAtTime(pk, t + hold);
    out.gain.setTargetAtTime(0, t + hold, r / 3);
    const end = t + hold + r * 2;
    // grace note (folk ornament): a quick upper-neighbour flick before the note
    const grace = o.grace ? mtof(m + o.grace) : 0;
    const vg = this.vibC && hold > 0.25 ? this.vib(t, end, this.vibHz, this.vibC, hold > 0.45 ? 0.22 : 0.1) : null;
    const oscs = acc ? [[-7, 1], [7, 0.9]] : [[0, 1]];
    for (const [d, v] of oscs) {
      const osc = this.osc(this.wave, f, t, end, v === 1 ? out : this.gainNode(v, out), d);
      if (grace) { osc.frequency.setValueAtTime(grace, t); osc.frequency.setValueAtTime(f, t + 0.045); }
      if (vg) vg.connect(osc.detune);
    }
    if (this.breath > 0 && !this.a.lite) {
      const bg = this.gainNode(pk * 0.32 * this.breath, out), bp = biq(this.ctx, 'bandpass', clamp(f * 2, 400, 9000), 2.5); bp.connect(bg);
      this.noise(t, end, bp);
      if (dur > 0.18) {
        const cg = this.gainNode(0, out), hp = biq(this.ctx, 'highpass', 2200, 0.7); hp.connect(cg);
        cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(pk * 0.55 * this.breath, t + 0.006); cg.gain.setTargetAtTime(0, t + 0.006, 0.02);
        this.noise(t, t + 0.1, hp);
      }
    }
    return end;
  }
  // accordion left-hand chord / any wind chord
  chord(t, ms, dur, vel = 0.5, o = {}) { for (const m of ms) this.note(t, m, dur, vel / Math.sqrt(ms.length), o); }
}

// ---------------------------------------------------------------- live: plucked (Karplus-Strong buffers)
export class Harp extends Inst {
  constructor(tr, o = {}) { super(tr, { pan: -0.4, rev: 0.45, ...o }); this.scale = o.scale ?? 0.34; }
  get defTail() { return 5; }
  build(n) { return eqChain(this.ctx, n, [['peaking', 220, 1, 2], ['lowpass', 7000, 0.7, 0]]); }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), buf = this.a.ks(f, { t60: clamp(5.2 - (m - 40) * 0.075, 1.3, 4.5), bright: 0.55, pos: 0.13, shape: 0.25 });
    const g = this.gainNode(vel * this.scale * (o.gain ?? 1));
    const end = o.damp ? t + dur + 0.1 : t + buf.duration;
    if (o.damp) { g.gain.setValueAtTime(vel * this.scale, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.1); }
    this.src(buf, t, end, g);
    return end;
  }
  gliss(t, notes, span = 0.6, vel = 0.4) { notes.forEach((m, i) => this.note(t + (i / notes.length) * span, m, 1, vel * (0.7 + 0.3 * i / notes.length))); }
}
export class Lute extends Inst {
  constructor(tr, o = {}) { super(tr, { pan: 0.15, rev: 0.25, ...o }); this.scale = o.scale ?? 0.28; this.kind = o.kind || 'lute'; }
  get defTail() { return 3; }
  build(n, o) {
    if (o.kind === 'guitar') return eqChain(this.ctx, n, [['highpass', 75, 0.7, 0], ['peaking', 180, 1.4, 3], ['peaking', 2600, 1.4, 1.5], ['lowpass', 7000, 0.7, 0]]);
    return eqChain(this.ctx, n, [['highpass', 85, 0.7, 0], ['peaking', 210, 1.8, 4], ['peaking', 480, 1.5, 2], ['peaking', 2400, 1.5, -2], ['lowpass', 6000, 0.7, 0]]);
  }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), buf = this.a.ks(f, { t60: clamp(2.4 - (m - 45) * 0.04, 0.8, 2.4), bright: 0.6, pos: 0.12, shape: 0.7 });
    const g = this.gainNode(vel * this.scale * (o.gain ?? 1));
    const end = t + Math.min(buf.duration, (o.let ?? 3));
    this.src(buf, t, end, g, 1, -4);
    if (this.kind === 'lute') this.src(buf, t + 0.004, end, g, 1, 4); // doubled courses
    return end;
  }
  strum(t, notes, vel = 0.5, { dir = 1, spread = 0.022 } = {}) {
    const ns = dir > 0 ? notes : notes.slice().reverse();
    ns.forEach((m, i) => this.note(t + i * spread, m, 1, vel * (i === 0 ? 1 : 0.85)));
  }
}

// ---------------------------------------------------------------- live: organ (drawbars) and synths
export class Organ extends Inst {
  constructor(tr, o = {}) { super(tr, { pan: 0, rev: 0.55, ...o }); this.scale = o.scale ?? 0.07; this.wave = tr.a.wave('organ' + (o.reg || 0), o.reg === 1 ? [1, 0.5, 0.2, 0.35, 0.1, 0.15, 0.05, 0.1] : [1, 0.9, 0.55, 0.45, 0.25, 0.3, 0.12, 0.2, 0.08, 0.1]); }
  build(n) { return eqChain(this.ctx, n, [['highpass', 45, 0.7, 0], ['lowpass', 5200, 0.6, 0]]); }
  note(t, m, dur, vel = 0.5, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1), a = o.a ?? 0.04, r = o.r ?? 0.35, hold = Math.max(a, dur);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a); out.gain.setValueAtTime(pk, t + hold); out.gain.setTargetAtTime(0, t + hold, r / 3.5);
    const end = t + hold + r * 1.8;
    this.osc(this.wave, f, t, end, out, -3); this.osc(this.wave, f, t, end, out, 3);
    return end;
  }
}
export class Synth extends Inst {
  // kind: bass (pulsing saw bass) | pluck (arp) | lead | sub (sine) — for the rift, PvP and inferno cues
  constructor(tr, o = {}) { super(tr, { pan: 0, rev: 0.25, ...o }); this.kind = o.kind || 'bass'; this.scale = o.scale ?? ({ bass: 0.16, pluck: 0.1, lead: 0.08, sub: 0.35 })[this.kind]; }
  build(n, o) { return eqChain(this.ctx, n, o.kind === 'sub' ? [['lowpass', 180, 0.7, 0]] : [['highpass', 35, 0.7, 0]]); }
  note(t, m, dur, vel = 0.6, o = {}) {
    if (!this.live(t, m, dur, vel)) return;
    const f = mtof(m), k = this.kind, out = this.gainNode(0), pk = vel * this.scale * (o.gain ?? 1);
    if (k === 'sub') {
      const a = 0.01, hold = Math.max(a, dur), end = t + hold + 0.15;
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a); out.gain.setValueAtTime(pk, t + hold); out.gain.linearRampToValueAtTime(0, t + hold + 0.12);
      this.osc('sine', f, t, end, out); return end;
    }
    const lp = biq(this.ctx, 'lowpass', f * 2, k === 'lead' ? 0.9 : 3); lp.connect(out);
    const open = o.open ?? (k === 'pluck' ? 10 : k === 'lead' ? 6 : 7);
    const dec = k === 'pluck' ? 0.18 : 0.12;
    const hold = Math.max(0.02, dur), r = k === 'lead' ? 0.2 : 0.06, end = t + hold + r * 2;
    lp.frequency.setValueAtTime(clamp(f * open * (0.5 + vel), 200, 16000), t); lp.frequency.setTargetAtTime(clamp(f * 1.5, 80, 8000), t + 0.005, dec);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + 0.004);
    if (k === 'pluck') out.gain.setTargetAtTime(0, t + 0.01, 0.12); else { out.gain.setValueAtTime(pk * 0.8, t + hold); out.gain.setTargetAtTime(0, t + hold, r / 3); }
    const ws = k === 'lead' ? [[-9, 'sawtooth'], [9, 'sawtooth']] : k === 'bass' ? [[0, 'sawtooth'], [-1200, 'square']] : [[0, 'sawtooth']];
    for (const [d, w] of ws) this.osc(w, f, t, end, lp, d);
    return end;
  }
}
