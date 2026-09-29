// Slimelet: a glossy jelly-drop pet (~0.34 m, ~0.42 with its topper). Candy-bright gumdrop body with a painted gloss
// highlight, rim light and a deeper-toned core, big shiny eyes, a tiny smile with blush; a topper per colour (mint leaf
// sprout, rose flower, azure droplet curl, gold crown). Locomotion is a hop-slide with spring-driven squash & stretch
// (volume preserving) and jelly lag in turns — a custom controller on BaseCtl. Variants: mint, rose, azure, gold.
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { leafGeo, sweep, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addG, rigidSkin, lerp3, sstep, clamp01, mix, TAU } from './common.js';
import { cuteEye, petPost, popIn } from './petkit.js';

const PAL = {
  mint: { body: 0x5ed6a0, deep: 0x1f9a70, top: 0xb0f8d8, blush: 0xff8aa0, iris: 0x14402e, glow: 0.05, acc: 'leaf', accA: 0x4cc860, accB: 0x2a8a3c },
  rose: { body: 0xff86aa, deep: 0xd8406e, top: 0xffd6e2, blush: 0xff4a78, iris: 0x4a1024, glow: 0.05, acc: 'flower', accA: 0xfff4f8, accB: 0xffd040 },
  azure: { body: 0x5cb0ff, deep: 0x2a5ed8, top: 0xcfeaff, blush: 0xff9ac0, iris: 0x0e2450, glow: 0.06, acc: 'drop', accA: 0xa8e4ff, accB: 0x6ac8ff },
  gold: { body: 0xf8c030, deep: 0xd8761a, top: 0xffeaa0, blush: 0xff8a6a, iris: 0x4a2a08, glow: 0.05, acc: 'crown', accA: 0xffe070, accB: 0xff4a6a },
};

export const slimelet = {
  name: 'Slimelet',
  variants: ['mint', 'rose', 'azure', 'gold'],
  pet: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'mint';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.0245, ao: { dist: 0.02, str: 0.35 },
      grad: { top: 0.1, bottom: 0.1, y0: 0, y1: 0.1, low: 0.2 }, mat: { dfreq: 4, rim: 0.5, rimColor: 0xffffff, spec: 0.9, shine: 46, wrap: 0.7 } };
  },
  rig(R) {
    R.add('base', null, [0, 0, 0]);
    R.add('top', 'base', [0, 0.2, 0]);
    R.add('eyeL', 'top', [-0.06, 0.162, -0.15]); R.add('eyeR', 'top', [0.06, 0.162, -0.15]);
    R.add('acc', 'top', [0, 0.33, -0.01]);
  },
  sculpt(S, cfg) {
    const c = cfg.pal, sm = [0, 0, 0.04, 0];
    // gumdrop: a wide soft base blended into a rounded dome (vertical blend base → top for the jelly lag)
    S.ell('base', [0, 0.155, 0], [0.175, 0.16, 0.162], { k: 0.06, col: c.body, tag: 'body', dir: [0, 1, 0], b2: 'top', t0: 0.3, t1: 0.9, dtl: sm });
    S.ell('base', [0, 0.06, 0], [0.19, 0.18, 0.065], { k: 0.07, col: c.body, tag: 'foot', dir: [0, 1, 0], dtl: sm });
    S.box('base', [0, -0.05, 0], [0.4, 0.05, 0.4], 0, { sub: true, k: 0.03, wmul: 0, col: c.deep, cw: 0.1 });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    // deep core toward the bottom, pale candy top, soft translucency band near the rim
    v.mix(c.deep, sstep(0.14, 0.0, y) * 0.55);
    v.mix(c.top, sstep(0.2, 0.33, y) * 0.55);
    v.mix(c.deep, (1 - Math.abs(nx * 0.7 + nz * 0.7)) * 0 );
    // painted gloss highlight (upper front-left) + a small secondary, emissive so it reads at iso distance
    const hl = Math.hypot(x + 0.07, (y - 0.27) * 1.2, (z + 0.07) * 1.1), hl2 = Math.hypot(x - 0.1, (y - 0.12) * 1.3, z + 0.12);
    const g1 = 1 - sstep(0.02, 0.05, hl), g2 = 1 - sstep(0.012, 0.028, hl2);
    if (g1 + g2 > 0.01) { v.mix(0xffffff, Math.max(g1, g2 * 0.8)); v.emis = Math.max(v.emis, Math.max(g1, g2 * 0.7) * 0.32); }
    // blush on the cheeks
    for (const s of [-1, 1]) { const d = Math.hypot(x - s * 0.1, (y - 0.135) * 1.6, z + 0.13); v.mix(c.blush, (1 - sstep(0.012, 0.03, d)) * 0.7); }
    // little smile
    const mx = x, my = y - (0.115 - 0.02 * Math.cos(mx * 38)), md = Math.abs(my);
    if (md < 0.006 && Math.abs(mx) < 0.03 && z < -0.12 && nz < -0.5) v.mix(0x2a1418, 0.9);
    v.emis = Math.max(v.emis, cfg.pal.glow * sstep(0.1, 0.3, y));
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    for (const s of [-1, 1]) cuteEye(acc, S, b(s < 0 ? 'eyeL' : 'eyeR'), [s * 0.06, 0.162, -0.15], [s * 0.28, 0.08, -1], 0.035, { iris: c.iris, rim: 0x0a0608, group: 0, sink: 0.35, glow: 0.1, pupilA: 0.66, irisA: 0.98, seg: 10, squash: 1.12 });
    const ab = rigidSkin(b('acc')), A = col(c.accA), B = col(c.accB);
    if (c.acc === 'leaf') { // sprout: stem + two leaves
      addG(acc, sweep(bez([0, 0.31, -0.01], [0.0, 0.35, 0.0], [0.012, 0.37, 0.01], 4), taper(4, 0.008, 0.005), { radial: 5 }), { skin: ab, color: B, dtl: [0, 0, 0.1, 0] });
      for (const s of [-1, 1]) {
        const g = leafGeo(0.03, 0.07, 0.006, 0.6, 0.18, { nu: 5, nv: 4, pw: 0.7, tipW: 0.002 });
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.25, s * 0.3 + (s > 0 ? 0 : Math.PI), -s * 1.0, 'YXZ')); m.setPosition(0.012, 0.365, 0.01);
        addG(acc, g, { matrix: m, skin: ab, color: (p, n, uv) => lerp3(A, B, sstep(0, 1, Math.abs((uv[0] % 1) - 0.25) * 2) * 0.5 + 0.2 * uv[1]), dtl: [0, 0, 0.1, 0] });
      }
    } else if (c.acc === 'flower') { // five petals + a golden centre
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU, g = new THREE.SphereGeometry(0.022, 6, 4);
        const m = new THREE.Matrix4().makeTranslation(0.045 + Math.cos(a) * 0.026, 0.335, -0.01 + Math.sin(a) * 0.026).multiply(new THREE.Matrix4().makeScale(1, 0.45, 1));
        addG(acc, g, { matrix: m, skin: ab, color: A, dtl: [0, 0, 0.1, 0] });
      }
      addG(acc, new THREE.SphereGeometry(0.014, 6, 4), { matrix: new THREE.Matrix4().makeTranslation(0.045, 0.342, -0.01), skin: ab, color: B, emis: 0.3, dtl: [0, 0, 0.1, 0] });
    } else if (c.acc === 'drop') { // a curl of water topped by a floating droplet
      addG(acc, sweep(bez([0, 0.31, 0], [0.03, 0.37, 0.02], [0.0, 0.39, -0.02], 5), taper(5, 0.012, 0.004), { radial: 5 }), { skin: ab, color: B, emis: 0.2, dtl: [0, 0, 0.05, 0] });
      const g = new THREE.SphereGeometry(0.02, 8, 6);
      const m = new THREE.Matrix4().makeTranslation(0, 0.43, -0.02).multiply(new THREE.Matrix4().makeScale(0.85, 1.25, 0.85));
      addG(acc, g, { matrix: m, skin: ab, color: A, emis: 0.45, dtl: [0, 0, 0, 0] });
    } else { // crown: band + 5 points with gem tips
      const band = new THREE.CylinderGeometry(0.05, 0.055, 0.03, 12, 1, true);
      addG(acc, band, { matrix: new THREE.Matrix4().makeTranslation(0, 0.325, -0.01), skin: ab, color: A, emis: 0.25, dtl: [0, 0, 0.1, 0] });
      addG(acc, new THREE.CylinderGeometry(0.05, 0.055, 0.03, 12, 1, true), { matrix: new THREE.Matrix4().makeTranslation(0, 0.325, -0.01).multiply(new THREE.Matrix4().makeScale(-0.97, 1, 0.97)), skin: ab, color: A, dtl: [0, 0, 0.1, 0] });
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + 0.3, x = Math.cos(a) * 0.05, z = -0.01 + Math.sin(a) * 0.05;
        const cone = new THREE.ConeGeometry(0.014, 0.035, 4);
        addG(acc, cone, { matrix: new THREE.Matrix4().makeTranslation(x, 0.355, z), skin: ab, color: A, emis: 0.25, dtl: [0, 0, 0.1, 0] });
        addG(acc, new THREE.OctahedronGeometry(0.008, 0), { matrix: new THREE.Matrix4().makeTranslation(x, 0.377, z), skin: ab, color: i % 2 ? B : 0x60c8ff, emis: 1.2, dtl: [0, 0, 0, 0] });
      }
    }
  },
  sockets: { head: ['top', [0, 0.36, 0]], mouth: ['top', [0, 0.11, -0.16]], center: ['base', [0, 0.15, 0]], back: ['top', [0, 0.3, 0.05]], chest: ['base', [0, 0.12, -0.14]] },
  height: 0.36, radius: 0.19,
  controller(inst) { return new SlimeCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ controller
/**
 * Jelly locomotion: hop cycle (frequency & height scale with speed) → a squash target (anticipation squash, launch
 * stretch, landing squash) driven through a stiff under-damped spring so the jelly overshoots and wobbles; volume is
 * preserved (sy · sxz² = 1). The dome lags behind acceleration and leans out of turns. Actions add to the targets via
 * ctl.sqAdd / lift / spin / tilt / sway / eyeClose / happy / pop.
 */
class SlimeCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    this.hp = 0; this.sq = 0; this.sqV = 0; this.lx = 0; this.lz = 0; this.lvx = 0; this.lvz = 0;
    this.sqAdd = 0; this.lift = 0; this.spin = 0; this.tilt = 0; this.sway = 0;
    const P = this.pose, b = this.b;
    this.topY = P.rest[b.top].y - P.rest[b.base].y;
    this.kids = [b.eyes[0], b.eyes[1], b.acc].map(i => ({ i, off: P.rest[i].clone().sub(P.rest[b.top]) }));
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed * this.locoW, turn = this._turn * this.locoW;
    const prevS = this.speedSm, k5 = 1 - Math.exp(-5 * dt);
    this.speedSm += (speed - this.speedSm) * k5;
    if (dt > 0) this.accel += ((this.speedSm - prevS) / dt - this.accel) * k5;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    const as = Math.abs(this.speedSm), moving = as > 0.12 && !this.dead;
    this.run = clamp01(as / 4);
    P.reset();
    this.sqAdd = 0; this.lift = 0; this.spin = 0; this.tilt = 0; this.sway = 0; this.glow = 1;
    this._fidget(dt, moving ? 0 : 1);
    this.acts.apply();
    // ---- hop cycle
    const f = mix(1.7, 3.3, clamp01(as / 5));
    if (moving || this.hp > 0) { this.hp += dt * f; if (this.hp >= 1) this.hp = moving ? this.hp - 1 : 0; }
    const hp = this.hp, hopping = moving || hp > 0 ? 1 : 0;
    const H = mix(0.05, 0.13, clamp01(as / 4)) * hopping;
    const air = hp > 0.22 && hp < 0.8 ? Math.sin((hp - 0.22) / 0.58 * Math.PI) : 0;
    let sqT = hopping ? 0.2 * sstep(0.0, 0.14, hp) * (1 - sstep(0.14, 0.22, hp)) - 0.2 * sstep(0.18, 0.26, hp) * (1 - sstep(0.3, 0.55, hp)) + 0.26 * sstep(0.78, 0.84, hp) * (1 - sstep(0.86, 1, hp)) : 0;
    sqT += (1 - this.run) * 0.035 * Math.sin(this.t * 2.3) + this.sqAdd;
    this.sqV += (230 * (sqT - this.sq) - 8 * this.sqV) * dt; this.sq += this.sqV * dt;
    const sq = Math.max(-0.45, Math.min(0.6, this.sq)), sy = 1 - sq, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    // ---- jelly lag: dome leans back on acceleration, forward while hopping along, out of turns
    const tz = -this.accel * 0.012 + Math.sign(this.speedSm) * this.run * 0.12 * (0.4 + 0.6 * air), tx = -this.turnSm * as * 0.04;
    this.lvx += (140 * (tx - this.lx) - 7 * this.lvx) * dt; this.lx += this.lvx * dt;
    this.lvz += (140 * (tz - this.lz) - 7 * this.lvz) * dt; this.lz += this.lvz * dt;
    // ---- apply: base hops & scales around the ground point; the dome & its children follow the squash
    P.move(b.base, 0, H * air + this.lift, 0);
    P.rot(b.base, this.tilt * 0.5, this.spin, this.sway * 0.5);
    P.sc[b.base].set(sxz, sy, sxz);
    P.move(b.top, 0, (sy - 1) * this.topY, 0);
    P.rot(b.top, -this.lz + this.tilt * 0.5, 0, this.lx + this.sway * 0.5);
    P.sc[b.top].set(sxz, sy, sxz);
    const K = this.kids; for (let q = 0; q < K.length; q++) { const kd = K[q]; P.move(kd.i, (sxz - 1) * kd.off.x, (sy - 1) * kd.off.y, (sxz - 1) * kd.off.z); P.sc[kd.i].set(sxz, sy, sxz); }
    // topper boings a little on landings
    P.rot(b.acc, -this.sqV * 0.02, 0, Math.sin(this.t * 3) * 0.08);
    this.jaw = 0;
    petPost(this, dt);
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

const hopArc = (k, a0, a1) => (k > a0 && k < a1 ? Math.sin((k - a0) / (a1 - a0) * Math.PI) : 0);
const ACTIONS = {
  hop: { dur: 0.6, a: 0.02, d: 0.96, fn(ctl, a, w) {
    const k = a.k, h = hopArc(k, 0.25, 0.8);
    ctl.sqAdd += (0.25 * sstep(0, 0.18, k) * (1 - sstep(0.2, 0.28, k)) - 0.25 * sstep(0.24, 0.3, k) * (1 - sstep(0.35, 0.55, k)) + 0.3 * sstep(0.78, 0.84, k) * (1 - sstep(0.86, 1, k))) * w;
    ctl.lift += 0.16 * h * w;
  } },
  happy: { dur: 1.3, a: 0.02, d: 0.96, fn(ctl, a, w) { // big boing with a spin, eyes ^ ^
    const k = a.k, h = hopArc(k, 0.18, 0.7);
    ctl.sqAdd += (0.3 * sstep(0, 0.14, k) * (1 - sstep(0.16, 0.22, k)) - 0.3 * sstep(0.18, 0.26, k) * (1 - sstep(0.3, 0.5, k)) + 0.35 * sstep(0.68, 0.74, k) * (1 - sstep(0.76, 0.95, k))) * w;
    ctl.lift += 0.26 * h * w; ctl.spin += sstep(0.2, 0.66, k) * TAU * w;
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.05, 0.18, k) * w);
  } },
  sit: { dur: 1, hold: true, rest: true, fadeIn: 0.4, fadeOut: 0.3, fn(ctl, a, w) { ctl.sqAdd += (0.16 + 0.02 * Math.sin(a.t * 2)) * w; ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.25 * w); } },
  sleep: { dur: 1, hold: true, rest: true, fadeIn: 0.8, fadeOut: 0.5, fn(ctl, a, w) { // flattened puddle-nap, slow breathing
    ctl.sqAdd += (0.3 + 0.05 * Math.sin(a.t * 1.6)) * w; ctl.eyeClose = Math.max(ctl.eyeClose || 0, w); ctl.sway += 0.05 * w;
  } },
  pickup: { dur: 0.8, a: 0.04, d: 0.9, hit: 0.45, fn(ctl, a, w) { // lean & stretch down over the loot, gulp (squash), happy wobble
    const k = a.k;
    const reach = sstep(0.05, 0.35, k) * (1 - sstep(0.42, 0.55, k)), gulp = sstep(0.42, 0.5, k) * (1 - sstep(0.55, 0.8, k));
    ctl.tilt += -0.55 * reach * w; ctl.sqAdd += (-0.12 * reach + 0.28 * gulp) * w;
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.55, 0.7, k) * w);
  } },
  idle_alt: { dur: 2.0, a: 0.1, d: 0.9, start(ctl, a) { a.u.v = Math.random() < 0.5 ? 0 : 1; }, fn(ctl, a, w) {
    const t = a.t, k = a.k;
    if (a.u.v === 0) { ctl.sway += Math.sin(t * 7) * 0.25 * Math.sin(k * Math.PI) * w; ctl.sqAdd += Math.sin(t * 14) * 0.05 * w; } // jiggle dance
    else { ctl.spin += Math.sin(t * 2.4) * 0.6 * Math.sin(k * Math.PI) * w; ctl.lift += 0.03 * Math.abs(Math.sin(t * 5)) * w; } // look around with little bounces
  } },
  wave: { dur: 1.4, a: 0.08, d: 0.88, fn(ctl, a, w) { // sway side to side with a cheerful bounce
    const t = a.t, up = Math.sin(clamp01(a.k) * Math.PI);
    ctl.sway += Math.sin(t * 9) * 0.35 * up * w; ctl.sqAdd += -0.08 * up * w; ctl.lift += 0.02 * Math.abs(Math.sin(t * 9)) * up * w;
    ctl.happy = Math.max(ctl.happy || 0, 0.8 * up * w);
  } },
  hit: { dur: 0.5, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) {
    const j = Math.sin(clamp01(a.k * 1.5) * Math.PI) * w;
    ctl.sqAdd += 0.35 * j; ctl.tilt += 0.35 * j; ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.9 * j);
  } },
  death: { dur: 1.3, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // faint: melt into a puddle, eyes shut
    const k = a.k, f = sstep(0.05, 0.6, k);
    ctl.sqAdd += (0.5 * f + 0.05 * Math.sin(a.t * 10) * (1 - f)) * w; ctl.eyeClose = Math.max(ctl.eyeClose || 0, sstep(0.1, 0.3, k) * w); ctl.sway += 0.1 * f * w;
  } },
  spawn: popIn(0.8, { fn(ctl, a, w) { ctl.sqAdd += 0.3 * Math.sin(clamp01((a.k - 0.3) / 0.4) * Math.PI * 2) * (1 - sstep(0.6, 1, a.k)) * w; } }),
};

const SPEC = {
  bones: { base: 'base', top: 'top', acc: 'acc', head: 'top', eyes: ['eyeL', 'eyeR'] },
  fidgets: [{ name: 'idle_alt', w: 2 }, { name: 'hop', w: 1 }],
  fidgetGap: 4,
  actions: ACTIONS,
};
