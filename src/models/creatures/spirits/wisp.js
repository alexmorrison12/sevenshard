// Wisp: small floating light spirit (~0.9 m tall at its crown). A white-hot core orb (emissive, colour at the rim), a
// crown of flickering flame tongues streaming up and back, a skinned comet tail that lags behind every dart, two tiny
// dark eyes, three motes orbiting. Bobs, drifts and darts in quick hops; squashes & stretches with motion.
// Variants: blue, green, gold, violet (elite flag: ×1.35, brighter, more motes). Cheap: < 1k triangles, no SDF.
// Death: gutters, flickers and pops out of existence (scale → 0). Spawn: flares into being with a flash.
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { retime } from '../acts.js';
import { sweep } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { flame } from '../parts2.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { lerp3, hash, knob, easeOut } from './common.js';

const V3 = THREE.Vector3;
const PAL = {
  blue: { core: 0xeaf8ff, main: 0x4ab0ff, deep: 0x1438e0, eye: 0x0a1030 },
  green: { core: 0xf2ffe4, main: 0x6aff4a, deep: 0x128a2a, eye: 0x08200a },
  gold: { core: 0xfffbe6, main: 0xffc238, deep: 0xd0500a, eye: 0x2a1204 },
  violet: { core: 0xfaeaff, main: 0xc266ff, deep: 0x5212c0, eye: 0x1a0830 },
};
const C = [0, 0.62, 0], R = 0.15;                  // core centre & radius (model space)
const TAIL = [[0, 0.6, 0.12], [0, 0.55, 0.26], [0, 0.49, 0.39], [0, 0.44, 0.5]];

export const wisp = {
  name: 'Wisp',
  variants: ['blue', 'green', 'gold', 'violet'],
  canFly: true,
  config(variant, opts) {
    const v = PAL[variant] ? variant : 'blue', elite = !!opts.elite;
    return { variant: v, pal: PAL[v], elite, scale: elite ? 1.35 : 1, castShadow: true, sphereMul: 3.5, mat: { dfreq: 2, furAxis: 1, rim: 0.5, rimColor: PAL[v].main, dissolveCol: PAL[v].main, flameAmp: 1.4 } };
  },
  rig(R0) {
    R0.add('root', null, C); R0.add('core', 'root', C);
    R0.add('tail1', 'core', TAIL[0]); R0.add('tail2', 'tail1', TAIL[1]); R0.add('tail3', 'tail2', TAIL[2]); R0.add('tail4', 'tail3', TAIL[3]);
    for (let i = 0; i < 4; i++) R0.add('mote' + i, 'root', C);
  },
  parts(acc, S, Rg, cfg) {
    const c = cfg.pal, b = (n) => Rg.index(n), E = cfg.elite;
    const cC = col(c.core), cM = col(c.main), cD = col(c.deep);
    // ---- core orb: white-hot centre facing up/forward, saturated rim
    const g = new THREE.IcosahedronGeometry(R, 2);
    acc.add(g, {
      matrix: new THREE.Matrix4().makeTranslation(...C), skin: { si: [b('core'), 0, 0, 0], sw: [1, 0, 0, 0] }, dtl: [0, 0, 0, 0],
      color: (p, n) => { const f = clamp01(0.5 + 0.5 * (n.y * 0.55 - n.z * 0.7)); return lerp3(lerp3(cD, cM, sstep(0, 0.5, f)), cC, sstep(0.55, 1, f) * 0.85); },
      emis: (p) => { const n = new V3(p.x - C[0], p.y - C[1], p.z - C[2]).normalize(); const f = clamp01(0.5 + 0.5 * (n.y * 0.55 - n.z * 0.7)); return 0.7 + 1.5 * f * f; },
    });
    // ---- eyes: two tiny dark ovals on the front
    for (const s of [-1, 1]) knob(acc, { si: [b('core'), 0, 0, 0], sw: [1, 0, 0, 0] }, [s * 0.048, 0.655, -0.137], 0.022, c.eye, { sx: 0.75, sy: 1.25, sz: 0.5, ws: 6, hs: 4, dtl: [0, 0, 0, 0] });
    // ---- flame crown streaming up and back
    const fc = { core: c.core, mid: c.main, tip: c.deep };
    const NF = E ? 7 : 5;
    for (let i = 0; i < NF; i++) {
      const a = (i / (NF - 1) - 0.5) * 2.2, x = Math.sin(a) * R * 0.75, z = 0.02 + Math.abs(Math.sin(a)) * 0.03;
      const len = (0.3 - Math.abs(a) * 0.07) * (E ? 1.2 : 1);
      flame(acc, [x, 0.66 + Math.cos(a) * 0.07, z], [Math.sin(a) * 0.55, 1, 0.55], len, 0.07 - Math.abs(a) * 0.012, { si: [b('core'), 0, 0, 0], sw: [1, 0, 0, 0] }, fc, { emis: 1.9, n: 5, radial: 5, bend: [Math.sin(a) * 0.15, 0.1, 0.7], flick: 1.3 });
    }
    // ---- comet tail: tapered sweep skinned along the tail chain, plus two thin side tendrils
    const tailSkin = (p) => {
      const z = p.z; const f = clamp01((z - 0.05) / 0.45) * 3;
      const i0 = Math.min(3, Math.floor(f)), t = f - i0, i1 = Math.min(3, i0 + 1);
      const names = ['tail1', 'tail2', 'tail3', 'tail4'];
      return { si: [b(names[i0]), b(names[i1]), 0, 0], sw: [1 - t, t, 0, 0] };
    };
    const tp = [new V3(0, 0.62, 0.05), ...TAIL.map(q => new V3(...q)), new V3(0, 0.4, 0.6)];
    acc.add(sweep(tp, [0.11, 0.09, 0.07, 0.048, 0.028, 0.004], { radial: 6, capStart: false }), {
      skin: tailSkin, dtl: [0, 0, 0, 0],
      color: (p, n, uv) => lerp3(lerp3(cC, cM, sstep(0, 0.4, uv[1])), cD, sstep(0.5, 1, uv[1])),
      emis: (p, uv) => 1.8 - uv[1] * 1.3, fx: (p, uv) => -(0.1 + uv[1] * 0.9),
    });
    for (const s of [-1, 1]) {
      const sp = [new V3(s * 0.06, 0.6, 0.08), new V3(s * 0.12, 0.58, 0.2), new V3(s * 0.15, 0.52, 0.32), new V3(s * 0.13, 0.46, 0.44)];
      acc.add(sweep(sp, [0.03, 0.025, 0.014, 0.002], { radial: 4 }), { skin: tailSkin, dtl: [0, 0, 0, 0], color: (p, n, uv) => lerp3(cM, cD, uv[1]), emis: (p, uv) => 1.6 - uv[1] * 1.1, fx: (p, uv) => -(0.2 + uv[1]) });
    }
    // ---- orbiting motes (bones placed every frame by the controller)
    for (let i = 0; i < (E ? 4 : 3); i++) {
      const m = new THREE.IcosahedronGeometry(0.026 - i * 0.003, 0);
      acc.add(m, { matrix: new THREE.Matrix4().makeTranslation(...C), skin: { si: [b('mote' + i), 0, 0, 0], sw: [1, 0, 0, 0] }, color: cC, emis: 2.6, dtl: [0, 0, 0, 0] });
    }
  },
  sockets: { head: ['core', [0, 0.92, 0]], mouth: ['core', [0, 0.6, -0.16]], center: ['core', C], chest: ['core', [0, 0.62, -0.1]], back: ['core', [0, 0.66, 0.12]], tail: ['tail4', [0, 0.42, 0.58]] },
  height: 0.92, radius: 0.28,
  controller(inst) { return new WispCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
/** hovering light: bob + lissajous drift + random darts, squash/stretch along motion, tail lags on a spring, motes orbit */
class WispCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    const P = this.pose;
    this.tail = [P.b.tail1, P.b.tail2, P.b.tail3, P.b.tail4]; this.core = P.b.core;
    this.motes = [0, 1, 2, 3].map(i => P.b['mote' + i]);
    this.dart = new V3(); this.dartT = new V3(); this.dartTimer = 1 + Math.random() * 2;
    this.tx = 0; this.ty = 0; this.tvx = 0; this.tvy = 0; this.pdx = 0; this.pdy = 0;
    this.stretch = 0; this.scale = 1; this.spin = 0; this.ph = Math.random() * 10; this.push = 0; this.offY = 0; this.offZ = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed * this.locoW, turn = this._turn * this.locoW, t = this.t + this.ph;
    const k4 = 1 - Math.exp(-5 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k4;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k4;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    this.run = clamp01(Math.abs(this.speedSm) / 5);
    P.reset();
    // ---- idle darting: hop to a nearby offset every 1–3 s (quick ease), otherwise drift
    this.dartTimer -= dt;
    if (this.dartTimer <= 0 && !this.dead) { this.dartTimer = 0.9 + Math.random() * 2.2; this.dartT.set((Math.random() - 0.5) * 0.36, (Math.random() - 0.4) * 0.16, (Math.random() - 0.5) * 0.24).multiplyScalar(1 - this.run); }
    const pdx = this.dart.x, pdy = this.dart.y;
    this.dart.lerp(this.dartT, 1 - Math.exp(-7 * dt));
    const dvx = (this.dart.x - pdx) / Math.max(dt, 1e-4), dvy = (this.dart.y - pdy) / Math.max(dt, 1e-4);
    this.glow = 1 + 0.18 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.08 * Math.sin(t * 17); this.jaw = 0; this.flame = 1;
    this.stretch = 0; this.scale = 1; this.spin = 0; this.push = 0; this.offY = 0; this.offZ = 0;
    this._fidget(dt, 1 - clamp01(Math.abs(this.speedSm)));
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    // ---- body: bob + drift + dart + action offsets; lean into motion
    const bob = Math.sin(t * TAU * 0.7) * 0.06 + Math.sin(t * 1.9) * 0.02;
    const dx = this.dart.x + Math.sin(t * 1.3) * 0.03, dy = this.dart.y + bob * this.locoW + this.offY + this.fly * 0.8, dz = this.dart.z + this.offZ;
    P.move(b.root, dx, dy, dz);
    P.rot(b.root, -0.35 * this.run - 0.02 * dvy, this.spin, -this.turnSm * 0.25 - dvx * 0.05);
    // squash & stretch along the travel direction (z) with speed, darts and action bursts
    const st = clamp01(this.run * 0.5 + Math.hypot(dvx, dvy) * 0.08 + this.stretch);
    const s = this.scale;
    P.sc[this.core].set(s * (1 - 0.18 * st), s * (1 - 0.12 * st + 0.04 * Math.sin(t * 9)), s * (1 + 0.35 * st));
    // ---- tail: spring-lagged pitch / yaw from speed, darts and turning + a lazy wiggle
    const ty = -this.turnSm * 0.5 - dvx * 0.6 + Math.sin(t * 2.3) * 0.18;
    const tx = -0.25 * this.run + dvy * 0.5 + this.push * 0.6 + Math.sin(t * 1.7) * 0.1;
    this.tvx += ((tx - this.tx) * 50 - this.tvx * 8) * dt; this.tx += this.tvx * dt;
    this.tvy += ((ty - this.ty) * 50 - this.tvy * 8) * dt; this.ty += this.tvy * dt;
    for (let i = 0; i < 4; i++) P.rot(this.tail[i], this.tx * (0.3 + i * 0.12) + Math.sin(t * 5 - i * 1.3) * 0.06, this.ty * (0.3 + i * 0.12) + Math.sin(t * 3.7 - i) * 0.12, 0);
    if (s < 0.999) for (let i = 0; i < 4; i++) { // shrink the tail with the core (FK does not propagate scale)
      const tb = this.tail[i], o = P.off[tb], sh = 1 - s;
      P.move(tb, -o.x * sh, -o.y * sh, -o.z * sh); P.sc[tb].setScalar(Math.max(1e-4, s));
    }
    // ---- motes orbit on tilted rings (local translation from the core centre)
    for (let i = 0; i < 4; i++) {
      const a = t * (1.6 + i * 0.35) + i * 2.1, rr = (0.26 + 0.05 * Math.sin(t * 1.3 + i)) * s, tilt = 0.6 + i * 0.5;
      P.move(this.motes[i], Math.cos(a) * rr, Math.sin(a) * rr * Math.sin(tilt) * 0.6 + 0.02 * i, Math.sin(a) * rr * Math.cos(tilt));
      P.sc[this.motes[i]].setScalar(s * (0.7 + 0.3 * Math.sin(t * 5 + i)));
    }
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ actions
const ACTIONS = {
  attack: { dur: 0.72, a: 0.04, d: 0.8, hit: 0.46, fn(ctl, a, w) { // dart zap: draw back glowing → streak forward → zap → drift back
    const k = a.k;
    const back = sstep(0, 0.34, k) * (1 - sstep(0.36, 0.42, k)), dart = sstep(0.36, 0.46, k) * (1 - sstep(0.56, 1, k)), zap = sstep(0.44, 0.47, k) * (1 - sstep(0.5, 0.62, k));
    ctl.offZ += (0.22 * back - 0.95 * dart) * w; ctl.offY += (0.05 * back - 0.06 * dart) * w;
    ctl.stretch += (0.9 * sstep(0.36, 0.42, k) * (1 - sstep(0.46, 0.55, k))) * w; ctl.push += (0.4 * back - 0.8 * dart) * w;
    ctl.scale = mix(ctl.scale, 1 - 0.12 * back + 0.35 * zap, w);
    ctl.glow = mix(ctl.glow, 1 + 1.5 * back + 3 * zap, w); ctl.charge = Math.max(ctl.charge, back * w);
  } },
  attack2: { dur: 1.0, a: 0.05, d: 0.85, hit: 0.6, fn(ctl, a, w) { // nova: swells, trembling, then bursts in a flash
    const k = a.k, t = a.t;
    const swell = sstep(0, 0.55, k) * (1 - sstep(0.58, 0.64, k)), burst = sstep(0.58, 0.62, k) * (1 - sstep(0.66, 0.95, k));
    ctl.offY += 0.1 * swell * w;
    ctl.scale = mix(ctl.scale, 1 + 0.35 * swell + Math.sin(t * 45) * 0.04 * swell - 0.25 * burst, w);
    ctl.glow = mix(ctl.glow, 1 + 2 * swell + 4 * burst, w); ctl.charge = Math.max(ctl.charge, swell * w);
    ctl.spin += 6 * swell * k * w;
  } },
  attack_big: { dur: 1.9, a: 0.04, d: 0.9, hit: 0.72, fn(ctl, a, w) { // overcharge: rises, swells & spins white-hot (telegraph) → dives forward in a streak
    const k = a.k, t = a.t;
    const rise = sstep(0, 0.4, k) * (1 - sstep(0.66, 0.72, k)), charge = sstep(0.1, 0.66, k) * (1 - sstep(0.68, 0.74, k));
    const dive = sstep(0.66, 0.74, k) * (1 - sstep(0.82, 1, k)), trem = sstep(0.45, 0.66, k) * (1 - sstep(0.66, 0.68, k)) * Math.sin(t * 60) * 0.03;
    ctl.offY += (0.55 * rise - 0.45 * dive) * w; ctl.offZ += (0.15 * rise - 1.6 * dive + trem) * w;
    ctl.stretch += 1.2 * dive * w; ctl.push -= 1.0 * dive * w;
    ctl.scale = mix(ctl.scale, 1 + 0.4 * charge, w);
    ctl.spin += (8 * charge * k) * w;
    ctl.glow = mix(ctl.glow, 1 + 3.5 * charge + 2 * dive, w); ctl.charge = Math.max(ctl.charge, charge * w);
  } },
  cast: { dur: 1.0, a: 0.06, d: 0.85, hit: 0.56, fn(ctl, a, w) { // rise & spin up, flash-release (game zap: dur 0.9, windup 0.5)
    const k = retime(a.k, 0.62, 0.56);
    const up = sstep(0, 0.55, k) * (1 - sstep(0.7, 1, k)), rel = sstep(0.58, 0.64, k) * (1 - sstep(0.68, 0.9, k));
    ctl.offY += 0.28 * up * w; ctl.spin += 10 * sstep(0, 0.62, k) * w;
    ctl.scale = mix(ctl.scale, 1 + 0.15 * up + 0.3 * rel, w);
    ctl.glow = mix(ctl.glow, 1 + 1.8 * up + 3 * rel, w); ctl.charge = Math.max(ctl.charge, up * w * 0.8);
  } },
  roar: { dur: 1.0, a: 0.08, d: 0.85, fn(ctl, a, w) { // flare: swells bright, crown roaring
    const u = Math.sin(a.k * Math.PI);
    ctl.offY += 0.12 * u * w; ctl.scale = mix(ctl.scale, 1 + 0.3 * u, w); ctl.glow = mix(ctl.glow, 1 + 2.5 * u, w); ctl.charge = Math.max(ctl.charge, 0.5 * u * w);
  } },
  idle_alt: { dur: 1.6, a: 0.1, d: 0.85, fn(ctl, a, w) { // playful spin + loop-de-loop
    const k = a.k;
    ctl.spin += TAU * 2 * (k * k * (3 - 2 * k)) * w;
    ctl.offY += Math.sin(k * TAU) * 0.18 * w; ctl.offZ += (1 - Math.cos(k * TAU)) * 0.1 * w;
    ctl.glow = mix(ctl.glow, 1.4, Math.sin(k * Math.PI) * w);
  } },
  hit: { dur: 0.36, a: 0.03, d: 0.4, hit: 0, fn(ctl, a, w) {
    const j = sstep(0, 0.1, a.k) * (1 - sstep(0.25, 1, a.k)) * w;
    ctl.offZ += 0.18 * j; ctl.offY += 0.05 * j; ctl.push += 0.8 * j;
    ctl.scale = mix(ctl.scale, 0.8, j); ctl.glow = mix(ctl.glow, 0.25 + 0.75 * Math.abs(Math.sin(a.t * 70)), j);
  } },
  knockback: { dur: 0.75, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) {
    const k = a.k, j = sstep(0, 0.08, k) * (1 - sstep(0.45, 1, k)) * w;
    ctl.offZ += 0.5 * j; ctl.spin -= 3 * j; ctl.push += 1.2 * j; ctl.scale = mix(ctl.scale, 0.85, j);
    ctl.glow = mix(ctl.glow, 0.5, j);
  } },
  knockdown: { dur: 0.7, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0, fn(ctl, a, w) { // drops to the ground, dim, sputtering
    const k = a.k, t = a.t, f = sstep(0.05, 0.5, k), bounce = Math.sin(clamp01((k - 0.5) / 0.25) * Math.PI) * 0.08;
    ctl.offY += (-0.45 * f + bounce) * w; ctl.offZ += 0.2 * f * w; ctl.scale = mix(ctl.scale, 0.8, f * w);
    ctl.glow = mix(ctl.glow, 0.35 + 0.25 * Math.abs(Math.sin(t * 9)), f * w); ctl.push += 0.5 * f * w;
  } },
  getup: { dur: 0.7, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) {
    const f = 1 - easeOut(a.k);
    ctl.offY += -0.45 * f * w; ctl.offZ += 0.2 * f * w; ctl.glow = mix(ctl.glow, 1 + Math.sin(a.k * Math.PI), w);
  } },
  stun: { dur: 1.4, loop: true, state: true, fadeIn: 0.2, fadeOut: 0.3, fn(ctl, a, w) { // wobbling in a slow circle, guttering
    const ph = a.t / 1.4 * TAU;
    ctl.offY += (-0.12 + Math.sin(ph * 2) * 0.03) * w; ctl.offZ += Math.cos(ph) * 0.08 * w;
    ctl.spin += Math.sin(ph) * 0.8 * w; ctl.glow = mix(ctl.glow, 0.45 + 0.3 * Math.abs(Math.sin(a.t * 11)), w);
  } },
  death: { dur: 1.2, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, fn(ctl, a, w) { // gutters, flickers, pops out
    const t = a.t, fl = Math.abs(Math.sin(t * 38)) * Math.abs(Math.sin(t * 11 + 1));
    const fade = sstep(0.15, 0.9, t), pop = sstep(0.85, 1.0, t);
    ctl.offY += (-0.25 * fade) * w; ctl.push += 0.6 * fade * w;
    ctl.glow = mix(ctl.glow, (1 - fade) * (0.3 + 1.5 * fl) + 2.5 * sstep(0.8, 0.88, t) * (1 - pop), w);
    ctl.scale = mix(ctl.scale, (1 - 0.45 * fade) * (1 + 0.4 * sstep(0.8, 0.88, t)) * (1 - pop) + 0.0001, w);
    ctl.flame = 1 - sstep(0.3, 0.8, t);
  } },
  spawn: { dur: 1.0, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // flares into being: pinpoint → flash → settle
    const k = a.k, grow = easeOut(sstep(0.05, 0.45, k)), over = Math.sin(clamp01((k - 0.3) / 0.4) * Math.PI) * 0.35;
    ctl.scale = mix(ctl.scale, grow * (1 + over) + 0.0001, w);
    ctl.glow = mix(ctl.glow, 1 + 4 * (1 - sstep(0.2, 0.8, k)), w); ctl.spin += 4 * (1 - grow) * w;
    ctl.offY += 0.2 * (1 - grow) * w;
  } },
};
const SPEC = { bones: { root: 'root', head: 'core' }, fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 3.5, chargeK: 0.25, actions: ACTIONS };
