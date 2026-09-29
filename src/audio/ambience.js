// Ambience: audio.ambience(kind) crossfades to a preset mix of layered beds.
// Each bed = baked seamless loop and/or a live noise graph and/or a spawner of short events (birds, drips...).
// Beds start lazily when their level rises above 0 and shut down (freeing CPU) ~7 s after returning to 0.
import { Kit } from './kit.js';
import { EVENTS, ENV, makeBird, birdSong } from './sfx/env.js';
import { RNG, clamp } from './util.js';

// kind → bed levels (0..1). ambience(kind, { mix: { gulls: 0.8 } }) overrides single beds (e.g. near the harbour).
export const KINDS = {
  city: { crowd: 0.55, gulls: 0.3, bells: 0.5, birds: 0.15, wind: 0.08 },
  city_quiet: { crowd: 0.36, birds: 0.45, gulls: 0.15, wind: 0.12 },
  city_night: { crowd: 0.18, crickets: 0.7, nightbirds: 0.4, bells: 0.35, wind: 0.14 },
  meadow: { birds: 0.8, wind: 0.3, insects: 0.5 },
  forest: { darkbirds: 0.75, creaks: 0.8, wind: 0.35, birds: 0.15 },
  night: { crickets: 0.8, nightbirds: 0.45, wind: 0.15 },
  sea: { waves: 0.72, wind: 0.4, hull: 0.6, gulls: 0.2 },
  cave: { cave: 0.9, wind: 0.05 },
  lava: { lava: 0.75, cave: 0.35 },
  snow: { howl: 0.75, wind: 0.3 },
  desert: { sand: 0.8, wind: 0.5 },
  void: { drones: 0.8, whispers: 0.55, cave: 0.2 },
  stronghold: { birds: 0.55, water: 0.4, waves: 0.18, gulls: 0.12, wind: 0.12 },
};
export const AMBIENCE_ALIAS = { none: null, silence: null, solhaven: 'city', town: 'city', harbor: 'city', harbour: 'city', dungeon: 'cave', rift: 'void', field: 'meadow', ocean: 'sea' };
export const AMBIENCE_NAMES = Object.keys(KINDS);

// trim: calibrated (lab __lab.ambCal) so each bed alone at level 1 sits at its design loudness (integrated LUFS,
// ambience bus at volume 1): wind -31 · birds -30 · water -30 · crickets -33 · cave -32 · lava -27 · crowd -28 · gulls -30 ·
// bells -28 · waves -26 · hull -31 · insects -34 · darkbirds -31 · nightbirds -32 · creaks -31 · howl -28 · sand -31 ·
// drones -29 · whispers -32.
const BEDS = {
  birds: { trim: 1.446, rev: 0.12, hall: 0.12, birds: true, live: 'forest' },
  wind: { trim: 0.363, live: 'wind' },
  water: { trim: 0.849, loop: 'water', rev: 0.05 },
  crickets: { trim: 0.609, loop: 'crickets', rev: 0.08, events: [['frog', 2.5, 8, 0.6]] },
  fire: { trim: 0.63, loop: 'fireCrackle', events: [['firePop', 2, 7, 0.5]] },
  tavern: { trim: 0.52, loop: 'tavern', rev: 0.15, events: [['laugh', 7, 18, 0.5], ['clink', 3, 10, 0.6]] },
  cave: { trim: 0.415, live: 'cave', hall: 0.6, events: [['drip', 0.6, 3, 0.8], ['stoneKnock', 8, 25, 0.5], ['rumble', 25, 60, 0.6]] },
  lava: { trim: 0.602, loop: 'lava', rev: 0.1, events: [['lavaBurst', 2, 6, 0.7], ['rumble', 18, 40, 0.5]] },
  waterfall: { trim: 0.75, live: 'waterfall', rev: 0.1 },
  crowd: { trim: 1.423, loop: 'crowd', rev: 0.08, events: [['call', 6, 16, 0.55], ['cart', 14, 35, 0.6], ['hammer', 10, 25, 0.4], ['laugh', 12, 30, 0.3]] },
  gulls: { trim: 2.042, hall: 0.15, events: [['gull', 4, 12, 0.7]] },
  bells: { trim: 1.603, hall: 0.4, events: [['bell_far', 35, 80, 0.8]] },
  waves: { trim: 0.447, loop: 'waves', rev: 0.04 },
  hull: { trim: 2.399, rev: 0.1, events: [['hull_creak', 2.5, 7, 0.7], ['slosh', 1.5, 4, 0.6], ['rope', 6, 14, 0.5]] },
  insects: { trim: 4.416, live: 'insects', events: [['bee', 8, 20, 0.6]] },
  darkbirds: { trim: 1.995, hall: 0.2, events: [['crow', 6, 16, 0.6], ['owl', 14, 32, 0.45]] },
  nightbirds: { trim: 1.175, hall: 0.25, events: [['owl', 8, 20, 0.6]] },
  creaks: { trim: 2.065, rev: 0.1, events: [['tree_creak', 5, 14, 0.7], ['snap', 8, 20, 0.5], ['leaves', 6, 15, 0.5]] },
  howl: { trim: 1.365, live: 'howl', events: [['ice_crack', 20, 50, 0.4]] },
  sand: { trim: 3.981, live: 'sand', events: [['sand_gust', 6, 14, 0.6]] },
  drones: { trim: 0.462, live: 'drones', hall: 0.4, events: [['void_pulse', 10, 22, 0.6]] },
  whispers: { trim: 6.31, hall: 0.5, events: [['whisper', 3, 9, 0.6]] },
};

const LIVE = {
  wind(k) {
    const D = 1e5;
    // two decorrelated airflow channels sharing the same gust modulators: coherent gusts, wide image
    const ch = [-0.7, 0.7].map((p) => { const air = k.gain(0.5, k.pan(p)); const lp = k.filter('lowpass', 650, 0.5, air); k.noiseSrc(0, D, lp, 'pink'); return { air, lp }; });
    k.wobble(0, D, 0.22, 0.28, ch[0].air.gain).connect(ch[1].air.gain);
    k.wobble(0, D, 0.9, 0.1, ch[0].air.gain).connect(ch[1].air.gain);
    k.wobble(0, D, 0.18, 350, ch[0].lp.frequency).connect(ch[1].lp.frequency);
    for (const p of [-0.6, 0.6]) {
      const lv = k.gain(0.07, k.pan(p)); k.wobble(0, D, 0.35, 0.06, lv.gain);
      k.noiseSrc(0, D, k.filter('bandpass', 4200, 0.7, lv), 'white');
      k.noiseSrc(0, D, k.filter('lowpass', 140, 0.7, k.gain(0.18, k.pan(p * 0.7))), 'brown');
    }
  },
  forest(k) {
    // very soft leaf/air bed under the birds so the forest never sounds like digital silence
    const D = 1e5;
    for (const p of [-0.6, 0.6]) {
      const g = k.gain(0.05, k.pan(p)); k.wobble(0, D, 0.25, 0.03, g.gain);
      k.noiseSrc(0, D, k.filter('bandpass', 3000, 0.5, g), 'pink');
      k.noiseSrc(0, D, k.filter('lowpass', 300, 0.7, k.gain(0.06, k.pan(p))), 'brown');
    }
  },
  waterfall(k) {
    // a steady roar: broadband rush over a low thunder, with a faint spray hiss on top, breathing slowly
    const D = 1e5;
    for (const p of [-0.5, 0.5]) {
      const rush = k.gain(0.16, k.pan(p)); k.wobble(0, D, 0.13, 0.03, rush.gain);
      k.noiseSrc(0, D, k.filter('bandpass', 1100, 0.45, rush), 'pink');
      k.noiseSrc(0, D, k.filter('lowpass', 220, 0.6, k.gain(0.22, k.pan(p * 0.6))), 'brown');
      k.noiseSrc(0, D, k.filter('highpass', 5200, 0.5, k.gain(0.035, k.pan(p))), 'white');
    }
  },
  cave(k) {
    const D = 1e5;
    for (const p of [-0.6, 0.6]) k.noiseSrc(0, D, k.filter('lowpass', 170, 0.7, k.gain(0.26, k.pan(p))), 'brown');
    const hum = k.gain(0.03); k.wobble(0, D, 0.1, 0.02, hum.gain);
    k.noiseSrc(0, D, k.filter('bandpass', 380, 6, hum), 'pink');
  },
  // meadow grasshoppers: gated high chirr in two drifting groups
  insects(k) {
    const D = 1e5;
    for (const [p, f, r] of [[-0.6, 5200, 43], [0.6, 6300, 51]]) {
      const g = k.gain(0.04, k.pan(p)); k.wobble(0, D, 0.15, 0.03, g.gain);
      const am = k.gain(0.5, g); k.lfo(0, D, r, 0.5, am.gain, 'square');
      k.noiseSrc(0, D, k.filter('bandpass', f, 4, am), 'white');
    }
  },
  // snow storm: resonant whistling wind, two bands wandering in pitch, strong gusts
  howl(k) {
    const D = 1e5;
    for (const [p, f] of [[-0.5, 520], [0.5, 780]]) {
      const g = k.gain(0.1, k.pan(p)); k.wobble(0, D, 0.12, 0.09, g.gain);
      const bp = k.filter('bandpass', f, 9, g); k.wobble(0, D, 0.08, f * 0.45, bp.frequency);
      k.noiseSrc(0, D, bp, 'pink');
    }
    const body = k.gain(0.2); k.wobble(0, D, 0.2, 0.15, body.gain); k.noiseSrc(0, D, k.filter('lowpass', 500, 0.6, body), 'pink');
  },
  // desert: hissing sand grains riding the gusts, a dry low wind
  sand(k) {
    const D = 1e5;
    for (const p of [-0.7, 0.7]) {
      const g = k.gain(0.05, k.pan(p)); k.wobble(0, D, 0.3, 0.045, g.gain);
      const am = k.gain(0.6, g); k.wobble(0, D, 30, 0.4, am.gain); // grains
      k.noiseSrc(0, D, k.filter('bandpass', 5500, 0.9, am), 'white');
    }
  },
  // void: slowly beating low sines + a moving noise wash
  drones(k) {
    const D = 1e5;
    for (const [f, v, p] of [[55, 0.1, -0.3], [55.4, 0.08, 0.3], [82.5, 0.06, -0.5], [110.7, 0.04, 0.5], [164.3, 0.02, 0]]) { const g = k.gain(v, k.pan(p)); k.wobble(0, D, 0.07, v * 0.6, g.gain); k.osc('sine', f, 0, D, g); }
    const w = k.gain(0.05); k.wobble(0, D, 0.1, 0.035, w.gain);
    const bp = k.filter('bandpass', 320, 3, w); k.wobble(0, D, 0.06, 180, bp.frequency);
    k.noiseSrc(0, D, bp, 'pink');
  },
};

class Bed {
  constructor(amb, name, def) {
    this.amb = amb; this.a = amb.a; this.name = name; this.def = def;
    const ctx = this.a.ctx, bus = this.a.bus.ambience;
    this.g = ctx.createGain(); this.g.gain.value = 0; this.g.connect(bus.in);
    if (def.rev) { const s = ctx.createGain(); s.gain.value = def.rev; this.g.connect(s); s.connect(bus.rev); }
    if (def.hall) { const s = ctx.createGain(); s.gain.value = def.hall; this.g.connect(s); s.connect(bus.hall); }
    this.level = 0; this.running = false; this.offAt = 0;
    this.rng = new RNG((this.a.seed ^ (name.length * 7919)) >>> 0);
  }
  set(v) {
    v = clamp(+v || 0);
    if (Math.abs(v - this.level) < 0.004 && (v > 0) === this.running) return; // called every frame with same value
    const now = this.a.ctx.currentTime, up = v > this.level;
    this.level = v;
    if (v > 0.001 && !this.running) this._start();
    this.g.gain.setTargetAtTime(Math.pow(v, 1.3) * this.def.trim, now, up ? 1.0 : 1.2);
    this.offAt = v <= 0.001 ? now + 7 : 0;
  }
  _start() {
    const a = this.a, ctx = a.ctx, def = this.def, now = ctx.currentTime;
    this.running = true;
    this.kits = [];
    if (def.loop) {
      a.bake('amb:' + def.loop, ENV[def.loop]).then((buf) => {
        if (!this.running) return;
        // two copies of the loop half a cycle apart, panned L/R: decorrelated stereo bed from a mono loop
        const rg = ctx.createGain(); rg.gain.value = (ENV[def.loop].gain ?? 1) * 0.72; rg.connect(this.g);
        const off = this.rng.next() * buf.duration;
        this.src = [-0.85, 0.85].map((p, i) => {
          const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
          const pn = ctx.createStereoPanner(); pn.pan.value = p; s.connect(pn); pn.connect(rg);
          s.start(ctx.currentTime + 0.02, (off + i * (buf.duration * 0.5 + 0.77)) % buf.duration); // offset not a multiple of the 2.5 s noise period
          return s;
        });
      });
    }
    if (def.live) {
      const k = new Kit(a, ctx, this.g, now + 0.02, { seed: this.rng.next() * 1e9 | 0 });
      LIVE[def.live](k); this.kits.push(k);
    }
    this.next = (def.events || []).map(([, lo, hi]) => now + 0.5 + this._iv(lo, hi) * this.rng.next() * 0.5); // first within half an interval
    if (def.birds) this.birds = [];
  }
  _stop() {
    this.running = false;
    for (const x of [].concat(this.src || [])) { try { x.stop(); } catch (e) { /* noop */ } }
    this.src = null;
    const t = this.a.ctx.currentTime + 0.05;
    for (const k of this.kits || []) for (const s of k.st.srcs) { try { s.stop(t); } catch (e) { /* noop */ } }
    this.kits = []; this.birds = null;
  }
  _iv(lo, hi) { return (lo + (hi - lo) * this.rng.next()) / (0.35 + 0.65 * this.level); }
  _spawn(fn, t, pan, vol, lp) {
    const ctx = this.a.ctx;
    const out = ctx.createGain(); out.gain.value = vol;
    let node = out;
    if (lp < 18000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; out.connect(f); node = f; }
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(this.g);
    const k = new Kit(this.a, ctx, out, t, { seed: this.rng.next() * 1e9 | 0 });
    const dur = fn(k) || 0.5;
    this.a.retire(p, Math.max(k.st.end, t + dur) + 0.5); // leave the bed's graph once finished
    return dur;
  }
  tick(now) {
    if (!this.running) return;
    if (this.offAt && now > this.offAt) { this._stop(); return; }
    const ahead = now + 0.4, def = this.def, lv = this.level;
    if (def.events) {
      def.events.forEach(([ev, lo, hi, vol], i) => {
        while (this.next[i] < ahead) {
          const t = Math.max(now + 0.02, this.next[i]);
          const d = 0.35 + 0.65 * this.rng.next();
          this._spawn(EVENTS[ev], t, this.rng.range(-0.9, 0.9), vol * (0.5 + 0.5 * d), 3000 + 15000 * d);
          this.next[i] += this._iv(lo, hi);
        }
      });
    }
    if (def.birds) {
      const want = Math.round(2 + 4 * lv);
      while (this.birds.length < want) {
        const b = makeBird(this.rng);
        b.next = now + 0.3 + this.rng.range(0, b.every[1] * 0.7); b.leave = now + this.rng.range(40, 120);
        this.birds.push(b);
      }
      for (let i = this.birds.length - 1; i >= 0; i--) {
        const b = this.birds[i];
        if (b.leave < now || i >= want) { this.birds.splice(i, 1); continue; }
        while (b.next < ahead) {
          const t = Math.max(now + 0.02, b.next);
          const vol = 0.9 * Math.pow(b.dist, 1.2);
          const dur = this._spawn((k) => birdSong(k, b), t, b.pan, vol, 3500 + 14000 * b.dist);
          b.next = t + dur + this.rng.range(b.every[0], b.every[1]) / (0.4 + 0.6 * lv);
        }
      }
    }
  }
}

export { BEDS };
export class Ambience {
  constructor(a) { this.a = a; this.beds = {}; this.kind = null; }
  // kind: a KINDS name (null/'' = silence); o.vol scales the whole preset; o.mix overrides single beds (0..1)
  set(kind, o = {}) {
    if (kind in AMBIENCE_ALIAS) kind = AMBIENCE_ALIAS[kind];
    if (kind && !KINDS[kind]) { console.warn('[audio] unknown ambience', kind); return; }
    this.kind = kind || null;
    const want = { ...(kind ? KINDS[kind] : {}), ...(o.mix || {}) }, vol = o.vol ?? 1;
    for (const name of new Set([...Object.keys(want), ...Object.keys(this.beds)])) this.level(name, (want[name] || 0) * vol);
  }
  level(name, v) {
    const def = BEDS[name];
    if (!def) return;
    if (!this.beds[name]) { if (!(v > 0)) return; this.beds[name] = new Bed(this, name, def); }
    this.beds[name].set(v);
  }
  tick() { const now = this.a.ctx.currentTime; for (const b of Object.values(this.beds)) b.tick(now); }
  levels() { const o = {}; for (const [k, b] of Object.entries(this.beds)) o[k] = b.level; return o; }
}

// Pre-bake the loop buffers a kind needs (offline renders / loading screens).
export function prepareAmbience(a, kind, mix = null) {
  if (kind in AMBIENCE_ALIAS) kind = AMBIENCE_ALIAS[kind];
  const lv = { ...(KINDS[kind] || {}), ...(mix || {}) };
  return Promise.all(Object.keys(lv).filter((b) => BEDS[b] && BEDS[b].loop).map((b) => a.bake('amb:' + BEDS[b].loop, ENV[BEDS[b].loop])));
}
