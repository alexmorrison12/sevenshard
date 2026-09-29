// Butterfly — ambient flyer (~0.2 m wingspan, a touch larger than life so it reads at the game camera). Always flying:
// fast flapping with clap-together upstrokes, erratic fluttery wander (smooth noise within ~0.25 m of the root, which the
// game moves), bobbing with each downstroke and brief glides. The root is the ground / flower reference: the body hovers
// ~0.9 m above it and `perch` lands it ON the root (put the root on a flower top) with the wings sunning open and shut.
// Painted fan-sheet wings (veins, borders, spots, eyespots) per variant: monarch, azure, sulphur, rose, glow (luminous,
// for night / Pipsprout Hollow). Actions: perch (hold), flee (hold), flutter, hit, death (tumbles down, lies flat).
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { sweep, rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { loftZ, chainSkin, fanSheet, vnoise, V3 } from './common.js';

const PAL = {
  monarch: { base: 0xf07818, base2: 0xf8a030, vein: 0x140c08, border: 0x120a08, dot: 0xf4f0e0, body: 0x1a1210, em: 0 },
  azure: { base: 0x1a78f0, base2: 0x6ad0ff, vein: 0x0a1a3a, border: 0x080c18, dot: 0xe8f4ff, body: 0x121620, em: 0.35 },
  sulphur: { base: 0xf2d830, base2: 0xfff07a, vein: 0x8a6a10, border: 0x3a2a08, dot: 0xf08a20, body: 0x2a2410, em: 0 },
  rose: { base: 0xf07aa8, base2: 0xffd0e0, vein: 0x8a2a50, border: 0x5a1a38, dot: 0xfff0f6, body: 0x2a1418, em: 0, eyes: true },
  glow: { base: 0x6af0ff, base2: 0xd0a0ff, vein: 0x2a4a8a, border: 0x9a6aff, dot: 0xffffff, body: 0x20264a, em: 1.25 },
};
const S = 1.1; // wing scale
// wing outlines (u outward, v backward), from the root
const FW = [[0.012, -0.012], [0.035, -0.03], [0.062, -0.041], [0.086, -0.043], [0.1, -0.034], [0.103, -0.02], [0.098, -0.004], [0.088, 0.01], [0.075, 0.02], [0.056, 0.022], [0.034, 0.018], [0.016, 0.01]].map(([u, v]) => [u * S, v * S]);
const HW = [[0.012, 0.002], [0.038, -0.003], [0.062, 0.006], [0.076, 0.024], [0.076, 0.042], [0.064, 0.058], [0.046, 0.068], [0.028, 0.066], [0.014, 0.052], [0.006, 0.03]].map(([u, v]) => [u * S, v * S]);
const Y0 = 0.012; // body height when perched

export const butterfly = {
  name: 'Butterfly',
  variants: ['monarch', 'azure', 'sulphur', 'rose', 'glow'],
  flying: true, canFly: true,
  config(variant) { const v = PAL[variant] ? variant : 'monarch'; return { variant: v, pal: PAL[v], scale: 1, mat: { dfreq: 30, rim: 0.2, wrap: 0.6 }, castShadow: true }; },
  rig(R) {
    R.add('body', null, [0, Y0, 0]); R.add('head', 'body', [0, Y0 + 0.001, -0.009]); R.add('abdomen', 'body', [0, Y0, 0.005]);
    for (const s of [-1, 1]) { const n = s < 0 ? 'L' : 'R'; R.add('fw' + n, 'body', [s * 0.004, Y0 + 0.003, -0.003]); R.add('hw' + n, 'body', [s * 0.004, Y0 + 0.002, 0.003]); }
  },
  parts(acc, Sc, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    const cb = col(c.body);
    // body: head · thorax · tapering abdomen (loft), fuzzy dark with a lighter underside
    const rings = [[-0.016, 0], [-0.0145, 0.0032], [-0.0115, 0.0042], [-0.0085, 0.0034], [-0.006, 0.0048], [-0.002, 0.0058], [0.003, 0.0048], [0.007, 0.0042], [0.014, 0.0038], [0.022, 0.003], [0.029, 0.0018], [0.032, 0]].map(([z, r]) => ({ z, y: Y0, rx: r, ry: r }));
    acc.add(loftZ(rings, 8), { skin: (p) => chainSkin([-0.009, 0, 0.005, 0.03], [b('head'), b('body'), b('abdomen'), b('abdomen')], p.z), dtl: [0.5, 0, 0.2, 0], color: (p, n) => lerp3(cb, col(c.base), sstep(-0.2, -0.9, n.y) * 0.25 + (c.em ? 0.2 : 0)), emis: () => c.em * 0.15 });
    // eyes + antennae with clubbed tips
    for (const s of [-1, 1]) {
      acc.add(new THREE.SphereGeometry(0.0022, 6, 4), { matrix: new THREE.Matrix4().makeTranslation(s * 0.0028, Y0 + 0.001, -0.0128), skin: rigid(b('head')), color: 0x0a0808, dtl: [0, 0, 0, 0] });
      const a0 = [s * 0.0012, Y0 + 0.003, -0.014], a1 = [s * 0.009, Y0 + 0.017, -0.03], a2 = [s * 0.013, Y0 + 0.024, -0.041];
      acc.add(sweep([a0, a1, a2], [0.0006, 0.0005, 0.0005], { radial: 3 }), { skin: rigid(b('head')), color: cb, dtl: [0, 0, 0, 0] });
      acc.add(new THREE.SphereGeometry(0.0013, 5, 3), { matrix: new THREE.Matrix4().makeTranslation(...a2), skin: rigid(b('head')), color: c.em ? c.base : cb, emis: c.em * 1.5, dtl: [0, 0, 0, 0] });
      // six thin legs folded under the thorax
      for (let i = -1; i <= 1; i++) {
        const z = -0.004 + i * 0.004, k = [s * 0.007, Y0 - 0.002, z - 0.002], f = [s * 0.009, 0.001, z + 0.002 * i];
        acc.add(sweep([[s * 0.002, Y0 - 0.003, z], k, f], [0.0005, 0.0004, 0.0003], { radial: 3 }), { skin: rigid(b('body')), color: cb, dtl: [0, 0, 0, 0] });
      }
    }
    // wings: fan sheets painted per variant (single-sided; the controller sets a double-sided material)
    const cBase = col(c.base), cBase2 = col(c.base2), cVein = col(c.vein), cBorder = col(c.border), cDot = col(c.dot);
    const paintW = (hind, f, t, m) => {
      const j = Math.round(t * (m - 1)), vein = Math.abs(t * (m - 1) - j) < 0.02 && j % 2 === 0 && f > 0.12 ? 1 : 0;
      let cc = lerp3(cBase, cBase2, sstep(0.2, 0.7, f) * 0.6 + (hind ? 0.1 : 0));
      const bw = hind ? 0.84 : 0.8, border = sstep(bw, bw + 0.04, f);
      cc = lerp3(cc, cVein, vein * 0.85);
      cc = lerp3(cc, cBorder, border);
      const dot = border > 0.5 && j % 2 === 1 && f > 0.88 && f < 0.99 ? 1 : 0;       // pearl dots in the border
      cc = lerp3(cc, cDot, dot * 0.9);
      if (!hind && t < 0.45 && f > 0.62) cc = lerp3(cc, cBorder, sstep(0.62, 0.7, f) * 0.85); // dark apex
      if (!hind && t < 0.4 && f > 0.66 && f < 0.8 && j % 2 === 1) cc = lerp3(cc, cDot, 0.85);  // apex spots
      if (c.eyes && hind && Math.abs(t - 0.5) < 0.15 && f > 0.5 && f < 0.75) cc = lerp3(cc, cBorder, 0.8); // eyespot
      return cc;
    };
    const wEm = (hind, f, t) => c.em * (0.35 + 0.65 * sstep(0.7, 1, f));
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      for (const hind of [false, true]) {
        const O = hind ? HW : FW, bone = b((hind ? 'hw' : 'fw') + n), root = hind ? [s * 0.004, Y0 + 0.002, 0.003] : [s * 0.004, Y0 + 0.003, -0.003];
        const g = fanSheet(O, [0, 0], (u, v) => [root[0] + s * u, root[1] + 0.004 * u * u / 0.01, root[2] + v], 4);
        acc.add(g, { skin: rigid(bone), dtl: [0, 0, 0.15, 0], color: (p, nn, uv) => paintW(hind, uv[0], uv[1], O.length), emis: (p, uv) => wEm(hind, uv[0], uv[1]) });
      }
    }
  },
  sockets: { head: ['head', [0, Y0 + 0.02, -0.01]], mouth: ['head', [0, Y0, -0.016]], center: ['body', [0, Y0, 0]], back: ['body', [0, Y0 + 0.008, 0]] },
  height: 0.9, radius: 0.1,
  controller(inst) { return new ButterflyCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
export class ButterflyCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    inst.material.side = THREE.DoubleSide;
    this.gait = null;
    const b = this.pose.b;
    this.bb = { body: b.body, head: b.head, abd: b.abdomen, fwL: b.fwL, fwR: b.fwR, hwL: b.hwL, hwR: b.hwR };
    this.seed = Math.random() * 100; this.fph = Math.random() * 10; this.gl = 0; this.glT = 1 + Math.random() * 3;
    this.perch = 0; this.fleeK = 0; this.fall = 0; this.lie = 0; this.wingOpen = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, B = this.bb, t = this.t += dt;
    this._state(state, dt);
    this.speedSm += (this._speed - this.speedSm) * (1 - Math.exp(-4 * dt));
    this.turnSm += (this._turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    P.reset();
    this.perch = 0; this.fleeK = 0; this.fall = 0; this.lie = 0; this.glow = 1;
    this.acts.apply();
    const perch = this.perch, flee = this.fleeK, air = (1 - perch) * (1 - this.fall);
    // glides: every few seconds hold the wings open for a moment
    this.glT -= dt; if (this.glT <= 0) { this.gl = 0.35; this.glT = 2 + Math.random() * 4; }
    this.gl = Math.max(0, this.gl - dt);
    const glide = sstep(0, 0.1, this.gl) * (1 - flee) * air;
    const f = mix(9, 15, flee) * (1 - glide * 0.9);
    this.fph += dt * TAU * f;
    const flap = Math.sin(this.fph);
    // erratic wander (smooth value noise) + bob on each downstroke
    const sd = this.seed, wk = 1 + flee * 1.5;
    const wx = vnoise(t * 0.9 * wk, sd) * 0.18 * wk + vnoise(t * 2.3 * wk, sd + 3) * 0.05;
    const wy = vnoise(t * 0.7 * wk, sd + 7) * 0.14 + vnoise(t * 2.9, sd + 9) * 0.04 + flee * 0.3;
    const wz = vnoise(t * 0.8 * wk, sd + 11) * 0.15 * wk;
    const bob = -Math.cos(this.fph) * 0.012 * (1 - glide);
    const hov = (0.9 + wy + bob - glide * 0.03) * air;
    const sp = clamp01(this.speedSm / 1.5);
    P.move(B.body, wx * air, hov, wz * air);
    P.rot(B.body, (0.35 * (1 - sp) - 0.15 * sp + 0.25 * Math.sin(this.fph + 0.6) * (1 - glide)) * air - 0.1 * perch, vnoise(t * 1.3, sd + 15) * 0.5 * air + this.turnSm * 0.2, (vnoise(t * 1.7, sd + 19) * 0.35 - this.turnSm * 0.3) * air);
    P.rx(B.abd, (-0.2 * Math.sin(this.fph - 0.8) * (1 - glide) * air + 0.1 * perch));
    P.rot(B.head, 0.1 * Math.sin(t * 3) * perch, 0.2 * vnoise(t * 0.8, sd + 21) * perch, 0);
    // wings: flight flap (clap together at the top) → perch (closed upright, slowly sunning open)
    const sun = perch * (0.5 - 0.5 * Math.cos(t * 1.1 + sd));
    let a = mix(0.35 + 1.05 * flap, 0.08, glide);
    a = mix(a, mix(1.5, 0.12, sun), perch);
    a = mix(a, -0.05, this.lie);
    const ah = mix(mix(0.3 + 0.95 * Math.sin(this.fph - 0.35), 0.05, glide), mix(1.45, 0.1, sun), perch);
    const sweepF = 0.25 * Math.cos(this.fph) * air * (1 - glide);
    P.rot(B.fwR, 0, -sweepF, a); P.rot(B.fwL, 0, sweepF, -a);
    P.rot(B.hwR, 0, -sweepF * 0.5 + 0.1, mix(ah, -0.05, this.lie)); P.rot(B.hwL, 0, sweepF * 0.5 - 0.1, -mix(ah, -0.05, this.lie));
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

const ACTIONS = {
  perch: { dur: 1, hold: true, rest: true, fadeIn: 0.6, fadeOut: 0.4, fn(ctl, a, w) { ctl.perch = Math.max(ctl.perch, w); } },
  flee: { dur: 1, hold: true, fadeIn: 0.1, fadeOut: 0.8, fn(ctl, a, w) { ctl.fleeK = Math.max(ctl.fleeK, w); } },
  flutter: { dur: 1.6, a: 0.1, d: 0.8, fn(ctl, a, w) { // a playful loop-de-loop
    const P = ctl.pose, B = ctl.bb, k = a.k, e = Math.sin(Math.PI * k);
    P.move(B.body, Math.sin(k * TAU) * 0.15 * w, Math.sin(k * TAU * 2) * 0.08 * w + 0.12 * e * w, (1 - Math.cos(k * TAU)) * 0.08 * w);
    P.rz(B.body, Math.sin(k * TAU) * 0.8 * w); ctl.fleeK = Math.max(ctl.fleeK, 0.6 * e * w);
  } },
  hit: { dur: 0.45, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) { const P = ctl.pose, B = ctl.bb, j = Math.sin(Math.PI * a.k) * w; P.move(B.body, 0.05 * j, -0.06 * j, 0.04 * j); P.rot(B.body, 0.6 * j, 0, 0.9 * j); ctl.fleeK = Math.max(ctl.fleeK, j); } },
  death: { dur: 1.4, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // wings fold, it tumbles down and lies flat
    const P = ctl.pose, B = ctl.bb, k = a.k, t = a.t, drop = sstep(0.0, 0.7, k), land = sstep(0.65, 0.8, k);
    ctl.fall = Math.max(ctl.fall, drop * drop * w); ctl.lie = Math.max(ctl.lie, land * w);
    P.rot(B.body, (t * 9 * (1 - land) + 0.1 * land) * w, 0, (Math.sin(t * 7) * (1 - land) + 1.2 * land) * w);
    ctl.glow = mix(ctl.glow, 0.2, land * w);
  } },
};
const SPEC = { bones: {}, alwaysFly: true, actions: ACTIONS };
