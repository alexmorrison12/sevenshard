// Thornwood forest spider (adapted from Everdawn's webwood spider): 8 jointed legs (rigid exoskeleton segments on IK,
// alternating-tetrapod gait), a big patterned abdomen that reads from the iso camera, fangs, pedipalps, 8 glowing eyes.
// Variants thornweaver (default) / blightfang / pale; elite "broodmother" (×1.6): spiked legs, egg sacs, spiderlings
// riding her abdomen, burning orange markings. Custom SpiderCtl (BaseCtl state machine, allocation-free update).
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { Gait } from '../gait2.js';
import { kf } from '../acts.js';
import { sweep, rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, addSpikes, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, bell, TAU } from '../../kit/rig.js';
import { prepLegs } from './util.js';

const PAL = {
  thornweaver: { body: 0x2e2a22, dark: 0x16130f, abd: 0x2a2620, mark: 0xb8d83c, mark2: 0xf0d848, leg: 0x2c261e, band: 0xa88a52, eye: 0xff2a10, fang: 0x1a1210, glow: 0xb8ff40, venom: 0x9cff3a },
  blightfang: { body: 0x2c1f36, dark: 0x140d1a, abd: 0x2a1c34, mark: 0x60e040, mark2: 0xb0ff60, leg: 0x281c30, band: 0x7a5a90, eye: 0x7cff40, fang: 0x14101a, glow: 0x80ff40, venom: 0x80ff30 },
  pale: { body: 0x6a6258, dark: 0x3a3430, abd: 0x5e564c, mark: 0xd8ccb4, mark2: 0xf0e8d0, leg: 0x5a5248, band: 0xc0b49c, eye: 0x7ad8ff, fang: 0x2a2420, glow: 0x9ae0ff, venom: 0xb0f0ff },
  broodmother: { body: 0x241a14, dark: 0x0e0a08, abd: 0x2a1c14, mark: 0xff9a20, mark2: 0xffd050, leg: 0x2a1e16, band: 0xd09040, eye: 0xff4010, fang: 0x100a08, glow: 0xff8a20, venom: 0xffb030 },
};
const LEGS = [ // coxa angle, toe angle, toe reach, knee height, knee reach
  { a: 0.5, t: 0.36, R: 1.08, kh: 0.8, kr: 0.6 },
  { a: 1.0, t: 0.98, R: 1.0, kh: 0.78, kr: 0.58 },
  { a: 1.6, t: 1.75, R: 0.98, kh: 0.76, kr: 0.56 },
  { a: 2.25, t: 2.55, R: 1.1, kh: 0.8, kr: 0.6 },
];
const legName = (i, s) => 'l' + i + (s < 0 ? 'L' : 'R');
const C0 = [0, 0.46, -0.02]; // cephalothorax centre
function legPts(i, s) {
  const L = LEGS[i];
  const cx = C0[0] + s * Math.sin(L.a) * 0.13, cz = C0[2] - Math.cos(L.a) * 0.15;
  const ka = (L.a * 0.35 + L.t * 0.65), kr = L.kr;
  const knee = [s * Math.sin(ka) * kr, L.kh, -Math.cos(ka) * kr + C0[2]];
  const ank = [s * Math.sin(L.t) * L.R * 0.88, 0.2, -Math.cos(L.t) * L.R * 0.88 + C0[2]];
  const toe = [s * Math.sin(L.t) * L.R, 0, -Math.cos(L.t) * L.R + C0[2]];
  return { coxa: [cx, C0[1] - 0.02, cz], knee, ank, toe };
}
const SPIN = [0, 0.5, 0.9]; // spinnerets (rest)

export const spider = {
  name: 'Spider',
  variants: ['thornweaver', 'blightfang', 'pale', 'broodmother'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'broodmother' : 'thornweaver');
    const elite = v === 'broodmother' || !!opts.elite;
    return { variant: elite ? 'broodmother' : v, pal: PAL[elite ? 'broodmother' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.6 : 1, h: 0.042, hg: { 1: 0.026 }, mat: { dfreq: 2.8, rim: 0.35, rimColor: 0xe8f0ff, spec: 0.35, shine: 30 } };
  },
  rig(R) {
    R.add('body', null, C0);
    R.add('abdomen', 'body', [0, 0.52, 0.16]);
    R.add('silk', 'abdomen', SPIN);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('chel' + n, 'body', [s * 0.045, 0.42, -0.24]);
      R.add('palp' + n, 'body', [s * 0.085, 0.42, -0.22]); R.add('palp2' + n, 'palp' + n, [s * 0.13, 0.46, -0.36]);
      for (let i = 0; i < 4; i++) {
        const P = legPts(i, s), nm = legName(i, s);
        R.add(nm + 'F', 'body', P.coxa); R.add(nm + 'T', nm + 'F', P.knee); R.add(nm + 'A', nm + 'T', P.ank);
      }
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const chit = [0.12, 0.1, 0.25, 0], hairy = [0.35, 0, 0.15, 0];
    // cephalothorax (carapace) + head bump
    S.ell('body', [0, 0.47, -0.04], [0.21, 0.13, 0.25], { k: 0.06, col: c.body, tag: 'carapace', dtl: chit });
    S.ell('body', [0, 0.51, -0.2], [0.14, 0.11, 0.11], { k: 0.05, col: c.body, tag: 'head', dtl: chit });
    S.ell('body', [0, 0.41, -0.02], [0.15, 0.07, 0.18], { k: 0.05, col: c.dark, tag: 'sternum', dtl: chit });
    // pedicel + big abdomen tilted up
    S.cone('abdomen', [0, 0.49, 0.14], [0, 0.53, 0.24], 0.06, 0.08, { k: 0.04, col: c.dark, tag: 'pedicel', dtl: chit });
    S.ell('abdomen', [0, 0.66, 0.52], [0.34, 0.3, 0.42], { k: 0.06, col: c.abd, tag: 'abdomen', rot: [-0.35, 0, 0], dtl: hairy });
    S.cone('abdomen', [0, 0.56, 0.82], [0, 0.5, 0.9], 0.07, 0.03, { k: 0.04, col: c.dark, tag: 'spinner', dtl: chit });
    if (E) { // egg sacs slung under the abdomen
      S.sph('abdomen', [-0.16, 0.42, 0.5], 0.1, { k: 0.04, col: 0xd8d0bc, tag: 'egg', dtl: [0.3, 0, 0.3, 0.2] });
      S.sph('abdomen', [0.14, 0.44, 0.62], 0.085, { k: 0.04, col: 0xd8d0bc, tag: 'egg', dtl: [0.3, 0, 0.3, 0.2] });
    }
    // chelicerae (fang bases)
    for (const s of [-1, 1]) S.ell('chel' + (s < 0 ? 'L' : 'R'), [s * 0.048, 0.39, -0.27], [0.042, 0.06, 0.045], { group: 1, k: 0.025, col: c.body, tag: 'chel', rot: [0.3, 0, 0], dtl: chit });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const ab = v.t('abdomen');
    if (ab > 0.3) {
      // chevrons marching down the back + central stripe + side spots (glow faintly on the elite)
      const top = sstep(-0.1, 0.4, ny);
      const u = (z - 0.25) * 7 - Math.abs(x) * 5.5;
      const chev = sstep(0.62, 0.78, Math.abs(Math.sin(u * Math.PI))) * top * sstep(0.2, 0.3, z) * (1 - sstep(0.8, 0.86, z)) * (1 - sstep(0.17, 0.21, Math.abs(x)));
      v.mix(c.mark, chev * 0.95);
      const stripe = (1 - sstep(0.018, 0.03, Math.abs(x))) * top * sstep(0.18, 0.25, z) * (1 - sstep(0.78, 0.85, z));
      v.mix(c.mark2, stripe * 0.8);
      let spot = 0;
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
        const d = Math.hypot(x - s * 0.24, y - (0.66 - i * 0.03), z - (0.35 + i * 0.15));
        spot = Math.max(spot, 1 - sstep(0.03, 0.045, d));
      }
      v.mix(c.mark2, spot * 0.9);
      v.mix(c.dark, sstep(-0.2, -0.7, ny) * 0.7);
      v.emis = Math.max(v.emis, (chev * 0.6 + stripe * 0.4 + spot * 0.5) * (cfg.elite ? 1.4 : 0.12));
    }
    if (v.t('egg') > 0.3) { const w = Math.sin(x * 60 + y * 40) * Math.sin(z * 55 - y * 30); v.mul(0.9 + 0.12 * w); }
    // carapace: radial grooves + lighter rim
    if (v.t('carapace') + v.t('head') > 0.4) {
      const a = Math.atan2(x, z + 0.04);
      v.mul(1 - sstep(0.85, 0.97, Math.abs(Math.sin(a * 4))) * 0.35 * sstep(0.3, 0.8, ny));
      v.mix(c.band, sstep(0.3, 0.0, ny) * sstep(-0.3, 0.1, ny) * 0.25);
    }
    v.mul(1 + Math.sin(x * 14 + z * 9) * Math.sin(y * 11) * 0.06);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    const cl = col(c.leg), cb = col(c.band), cd = col(c.dark);
    const hs = (i) => { const q = Math.sin(i * 51.7 + 7.1) * 43758.5; return q - Math.floor(q); };
    let hi = 0;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const P = legPts(i, s), nm = legName(i, s);
      const seg = (bone, a, bb, r0, r1, bulge, bandAt) => {
        const A = new THREE.Vector3(...a), B = new THREE.Vector3(...bb);
        const pts = [], rad = [];
        for (let k = 0; k <= 3; k++) { const t = k / 3; pts.push(A.clone().lerp(B, t)); rad.push(mix(r0, r1, t) * (1 + bulge * Math.sin(t * Math.PI))); }
        const g = sweep(pts, rad, { radial: 5, capEnd: true });
        // dark segment with a pale hairy band mid-way and darker joint ends
        acc.add(g, { skin: rigid(b(bone)), dtl: [0.35, 0, 0.15, 0], color: (p, n, uv) => { const t = uv[1]; const band = sstep(bandAt - 0.12, bandAt - 0.04, t) * (1 - sstep(bandAt + 0.02, bandAt + 0.1, t)); return lerp3(lerp3(cl, cd, sstep(0.85, 1, t) + sstep(0.12, 0, t)), cb, band * 0.8); } });
        // joint knob at the start
        const kg = new THREE.IcosahedronGeometry(r0 * 1.12, 0);
        acc.add(kg, { matrix: new THREE.Matrix4().makeTranslation(A.x, A.y, A.z), skin: rigid(b(bone)), color: cd, dtl: [0.1, 0, 0.2, 0] });
      };
      seg(nm + 'F', P.coxa, P.knee, 0.05, 0.03, 0.3, 0.62);
      seg(nm + 'T', P.knee, P.ank, 0.03, 0.017, 0.15, 0.55);
      // tarsus: thin, pointed, dark tip
      const A = new THREE.Vector3(...P.ank), T = new THREE.Vector3(...P.toe);
      acc.add(sweep([A, A.clone().lerp(T, 0.6), T], [0.018, 0.012, 0.003], { radial: 5 }), { skin: rigid(b(nm + 'A')), dtl: [0.2, 0, 0.1, 0], color: (p, n, uv) => lerp3(cb, cd, sstep(0.2, 0.7, uv[1])) });
      // bristles along femur/tibia (the broodmother's are thorny spikes)
      for (const [bone, a, bb] of [[nm + 'F', P.coxa, P.knee], [nm + 'T', P.knee, P.ank]]) {
        for (let k = 0; k < 2; k++) {
          const t = 0.3 + k * 0.35, p = [mix(a[0], bb[0], t), mix(a[1], bb[1], t), mix(a[2], bb[2], t)];
          const dir = [s * (0.5 + hs(hi++)), 0.6 + hs(hi++) * 0.6, (hs(hi++) - 0.5) * 0.8];
          const L = E ? 0.1 : 0.07, r = E ? 0.012 : 0.007;
          const H = sweep([p, [p[0] + dir[0] * L, p[1] + dir[1] * L, p[2] + dir[2] * L]], [r, 0.001], { radial: 3 });
          acc.add(H, { skin: rigid(b(bone)), color: E ? (pp, nn, uv) => lerp3(cd, col(c.band), uv[1]) : cd, dtl: [0, 0, 0, 0] });
        }
      }
    }
    // fangs (curved, pointing down/back) on chelicerae; venom-tipped
    const fk = E ? 1.35 : 1;
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      addHorn(acc, b('chel' + n), [s * 0.05, 0.36, -0.29], [s * 0.05, 0.36 - 0.06 * fk, -0.29 - 0.03 * fk], [s * 0.03, 0.36 - 0.09 * fk, -0.27], 0.018 * fk, 0.003, { base: c.fang, tip: 0xd8d0c0, radial: 6, gpow: 2, n: 5 });
      // pedipalps: two short segments with a club tip
      const p0 = [s * 0.085, 0.42, -0.22], p1 = [s * 0.13, 0.46, -0.36], p2 = [s * 0.12, 0.38, -0.44];
      acc.add(sweep([p0, p1], [0.02, 0.017], { radial: 5 }), { skin: rigid(b('palp' + n)), color: c.leg, dtl: [0.3, 0, 0.1, 0] });
      acc.add(sweep([p1, p2], [0.017, 0.022], { radial: 5 }), { skin: rigid(b('palp2' + n)), color: (p, nn, uv) => lerp3(cl, cb, uv[1]), dtl: [0.3, 0, 0.1, 0] });
    }
    // eyes: 2 big front, 2 medium, 4 small on top — all glowing
    const eo = { iris: c.eye, pupil: c.eye, rim: 0x100404, irisA: 0, pupilA: 0.9, glow: E ? 3.2 : 2.2, glint: true, sink: 0.45, seg: 8 };
    for (const s of [-1, 1]) {
      addEye(acc, S, b('body'), [s * 0.035, 0.53, -0.31], [s * 0.2, 0.15, -1], 0.026, { ...eo, seg: 10 });
      addEye(acc, S, b('body'), [s * 0.088, 0.53, -0.29], [s * 0.7, 0.2, -1], 0.017, eo);
      addEye(acc, S, b('body'), [s * 0.05, 0.6, -0.26], [s * 0.3, 1, -0.7], 0.014, { ...eo, glint: false });
      addEye(acc, S, b('body'), [s * 0.1, 0.58, -0.23], [s * 0.8, 0.8, -0.4], 0.012, { ...eo, glint: false });
    }
    // bristly hairs on the abdomen (elite: spikes)
    const list = [];
    for (let i = 0; i < (E ? 20 : 12); i++) {
      const a = hs(hi++) * TAU, e = 0.2 + hs(hi++) * 0.9;
      const d = [Math.cos(a) * Math.cos(e) * 0.3, Math.sin(e) * 0.27, Math.sin(a) * Math.cos(e) * 0.38];
      list.push({ p: [d[0], 0.64 + d[1], 0.5 + d[2]], dir: [d[0], d[1] + 0.1, d[2] + 0.15], len: E ? 0.14 : 0.07, r: E ? 0.016 : 0.008 });
    }
    addSpikes(acc, S, list, { base: c.dark, tip: E ? c.mark : c.band, radial: 3 });
    if (E) { // spiderlings riding the broodmother's abdomen
      const sp = [[-0.12, 0.93, 0.42, 0.6], [0.16, 0.9, 0.5, -0.4], [0.02, 0.86, 0.7, 2.6], [-0.22, 0.8, 0.64, 1.5]];
      for (const [x, y, z, yaw] of sp) {
        const bone = rigid(b('abdomen')), r = 0.028;
        acc.add(new THREE.IcosahedronGeometry(r, 0), { matrix: new THREE.Matrix4().makeTranslation(x, y, z), skin: bone, color: c.body, dtl: [0.1, 0.1, 0.2, 0] });
        acc.add(new THREE.IcosahedronGeometry(r * 1.2, 0), { matrix: new THREE.Matrix4().makeTranslation(x + Math.sin(yaw) * r * 1.8, y + 0.005, z + Math.cos(yaw) * r * 1.8), skin: bone, color: c.abd, dtl: [0.1, 0.1, 0.2, 0], emis: 0.3 });
        for (let j = 0; j < 4; j++) for (const s2 of [-1, 1]) {
          const a = yaw + s2 * (0.5 + j * 0.55), L = 0.06;
          const p0 = [x, y, z], p1 = [x + Math.sin(a + s2 * 1.3) * L * 0.6, y + 0.03, z + Math.cos(a + s2 * 1.3) * L * 0.6], p2 = [x + Math.sin(a + s2 * 1.5) * L, y - 0.03, z + Math.cos(a + s2 * 1.5) * L];
          acc.add(sweep([p0, p1, p2], [0.005, 0.004, 0.002], { radial: 3 }), { skin: bone, color: c.leg, dtl: [0, 0, 0, 0] });
        }
      }
    }
    // silk drop-line (hidden: scaled to 0 unless spawn_drop pays it out). Unit length upward from the spinnerets.
    const th = new THREE.CylinderGeometry(0.006, 0.006, 1, 4, 1, true); th.translate(SPIN[0], SPIN[1] + 0.5, SPIN[2]);
    acc.add(th, { skin: rigid(b('silk')), color: 0xf0f0ff, emis: 0.5, dtl: [0, 0, 0, 0] });
  },
  sockets: { mouth: ['body', [0, 0.36, -0.34]], head: ['body', [0, 0.62, -0.2]], center: ['body', [0, 0.5, 0.05]], chest: ['body', [0, 0.45, -0.1]], back: ['abdomen', [0, 0.95, 0.45]], spinner: ['abdomen', [0, 0.5, 0.92]] },
  height: 0.95, radius: 0.8,
  controller(inst) { return new SpiderCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ controller
function spiderLegs() {
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const P = legPts(i, s), nm = legName(i, s);
    legs.push({ id: nm, chain: [nm + 'F', nm + 'T', nm + 'A'], toe: P.toe, body: 'body', lift: 0.16, flex: 0, heel: 0, out: 0 });
  }
  return legs;
}
// tetrapod: L0 R1 L2 R3 together, R0 L1 R2 L3 together (with a slight metachronal ripple); walk = back-to-front wave
const off = {}; for (let i = 0; i < 4; i++) { off[legName(i, -1)] = (i % 2 ? 0.5 : 0) + i * 0.04; off[legName(i, 1)] = (i % 2 ? 0 : 0.5) + i * 0.04; }
const offWave = {}; for (let i = 0; i < 4; i++) { offWave[legName(i, -1)] = (3 - i) * 0.125; offWave[legName(i, 1)] = 0.5 + (3 - i) * 0.125; }
const SPIDER_GAIT = {
  legs: spiderLegs(), maxStride: 0.9, fMin: 0.7, actV: 0.2, actTurn: 1.2, settleDist: 0.1,
  gaits: [
    { v: 1.2, f: 1.5, duty: 0.66, lift: 0.9, off: offWave, bob: 0.01, bobF: 4, sway: 0.01, swayF: 2, roll: 0.02, rollF: 2 },
    { v: 3.0, f: 2.6, duty: 0.52, lift: 1, off, bob: 0.015, bobF: 2, sway: 0.012, swayF: 2, roll: 0.02, rollF: 2 },
    { v: 7.0, f: 3.8, duty: 0.42, lift: 1.1, off, bob: 0.02, bobF: 2, pitch: 0.02, pitchF: 2, lean: 0.05 },
  ],
};

/**
 * Spider controller: tetrapod gait on 8 IK legs, lagging abdomen spring, twitching palps/fangs (ctl.jaw = fang spread),
 * combat stance (front raised, stance wider). Actions set ctl.jaw / glow / charge / silk (drop-line length, m).
 */
class SpiderCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = new Gait(this.pose, SPIDER_GAIT);
    prepLegs(this.gait);
    this.abdLag = 0; this.abdV = 0; this.silk = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, G = this.gait;
    this.t += dt;
    this._state(state, dt);
    const lw = this.locoW;
    const speed = this._speed * lw, turn = this._turn * lw, strafe = this._strafe * lw;
    this.speedSm += (speed - this.speedSm) * (1 - Math.exp(-6 * dt));
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    this.run = clamp01((Math.abs(this.speedSm) - 2) / 4);
    P.reset();
    G.update(dt, speed, turn, strafe);
    const idle = 1 - clamp01(G.act * 1.5);
    // body: low slung, sways; combat raises the front and spreads the stance
    const breath = Math.sin(this.t * 2.2);
    G.adaptBody(dt);
    const cb = this.combat;
    P.move(b.body, G.sway, G.bob - 0.04 * cb - 0.03 * this.run + 0.01 * breath * idle + G.gOff, 0);
    P.rot(b.body, G.pitch + 0.1 * cb - G.lean * clamp01(Math.abs(this.speedSm) / 6) + G.gPitch, 0, G.roll + this.turnSm * 0.05 + G.gRoll);
    const legs = G.legs;
    for (let i = 0; i < legs.length; i++) { const L = legs[i]; L.homeOff.set(L.side * 0.06 * cb, 0, L.toe.z < 0 ? -0.04 * cb : 0.02 * cb); }
    // abdomen: lagging spring + breathing pulse
    const target = -G.bob * 6 + G.pitch;
    this.abdV += ((target - this.abdLag) * 60 - this.abdV * 9) * dt; this.abdLag += this.abdV * dt;
    P.rot(b.abd, this.abdLag * 0.6 + 0.04 * Math.sin(this.t * 1.3) - 0.05 * cb, -this.turnSm * 0.12 + Math.sin(this.t * 0.7) * 0.03 * idle, -G.sway * 2);
    P.sc[b.abd].setScalar(1 + 0.02 * breath);
    // pedipalps & fangs twitch
    const t = this.t;
    const tw0 = Math.pow(Math.max(0, Math.sin(t * 2.3)), 8), tw1 = Math.pow(Math.max(0, Math.sin(t * 2.3 + 1)), 8), tw2 = Math.pow(Math.max(0, Math.sin(t * 2.3 + 2)), 8), tw3 = Math.pow(Math.max(0, Math.sin(t * 2.3 + 3)), 8);
    P.rot(b.palpL, -0.2 * tw0 + Math.sin(t * 7) * 0.08 * cb, 0.15 * tw1, 0);
    P.rot(b.palpR, -0.2 * tw2 + Math.sin(t * 7 + 1) * 0.08 * cb, -0.15 * tw3, 0);
    P.rx(b.palp2L, 0.3 * Math.pow(Math.max(0, Math.sin(t * 2.3 + 0.4)), 8)); P.rx(b.palp2R, 0.3 * Math.pow(Math.max(0, Math.sin(t * 2.3 + 2.4)), 8));
    this.jaw = 0.15 * cb * (0.5 + 0.5 * Math.sin(t * 5)) + 0.1 * Math.pow(Math.max(0, Math.sin(t * 2.3 + 5)), 8);
    this.glow = 1 + 0.25 * cb; this.silk = 0;
    this._fidget(dt, idle);
    this.acts.apply();
    const f = this.jaw;
    P.rot(b.chelL, f, 0, 0.35 * f); P.rot(b.chelR, f, 0, -0.35 * f);
    P.fk();
    // silk drop-line: world-vertical, length = this.silk
    const si = b.silk;
    if (this.silk > 0.01) { P.wq[si].identity(); P.sc[si].set(1, this.silk, 1); }
    else P.sc[si].set(0.0001, 0.0001, 0.0001);
    G.solve(P, { air: 0, airPaw: 0 });
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ------------------------------------------------------------------------------------------------ actions
const _v = new THREE.Vector3();
/** leg override in body-local space (carried by the body) */
function lo(L, x, y, z, w) { L.override.set(x, y, z); L.overrideLocal = true; L.overridePaw = 0; if (w > L.overrideW) L.overrideW = w; }
/** leg override in model space (planted) */
function lp(L, x, y, z, w) { L.override.set(x, y, z); L.overrideLocal = false; L.overridePaw = 0; if (w > L.overrideW) L.overrideW = w; }
const pair = (L) => L.id.charCodeAt(1) - 48; // 0 front … 3 back

/** flipped onto the back: roll about Z by up to π, body resting on the abdomen; legs in the air */
function flip(ctl, w, f, side, lift, curl, flail, t) {
  const P = ctl.pose, b = ctl.b;
  P.move(b.body, 0, (lift + 0.02 * f) * w, 0.05 * f * w);
  P.rot(b.body, -0.2 * f * w, 0, side * Math.PI * f * w);
  P.rx(b.abd, 0.25 * f * w);
  const G = ctl.gait.legs;
  for (let i = 0; i < G.length; i++) {
    const L = G[i], k = pair(L);
    const fl = Math.sin(t * (13 + k * 2.3) + i * 1.7) * flail;
    const c = curl;
    // body-local: legs drawn in toward the body and "up" (which is toward the sky once flipped)
    lo(L, L.toe.x * mix(0.85, 0.3, c) + L.side * 0.05 * fl, mix(0.05, 0.3, c) + 0.1 * fl, L.toe.z * mix(0.85, 0.35, c) + 0.06 * fl, f * w);
  }
}
const DE_T = [0, 0.12, 0.3, 0.42, 0.5, 1], DE_Y = [0, 0.3, 0.45, 0.08, 0.14, 0.08];

const ACTIONS = {
  attack: { dur: 0.75, a: 0.1, d: 0.8, hit: 0.5, fn(ctl, a, w) { // rear a little, lunge down and bite
    const P = ctl.pose, b = ctl.b, k = a.k;
    const up = sstep(0, 0.35, k) * (1 - sstep(0.4, 0.52, k));
    const strike = sstep(0.4, 0.52, k) * (1 - sstep(0.68, 1, k));
    P.move(b.body, 0, (0.1 * up - 0.07 * strike) * w, (0.07 * up - 0.24 * strike) * w);
    P.rx(b.body, (0.35 * up - 0.18 * strike) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.8 * up + 0.1 * strike) * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (pair(L) === 0) lo(L, L.toe.x * 0.6, 0.6 * up + 0.15 * strike, L.toe.z * 0.65 - 0.15 * strike, (up + strike * 0.5) * w); }
  } },
  attack2: { dur: 0.95, a: 0.08, d: 0.82, hit: 0.42, hits: [0.42, 0.62], fn(ctl, a, w) { // front legs raise and stab down, left then right
    const P = ctl.pose, b = ctl.b, k = a.k;
    const up = sstep(0, 0.3, k) * (1 - sstep(0.75, 1, k));
    P.move(b.body, 0, 0.08 * up * w, 0.03 * up * w); P.rx(b.body, 0.28 * up * w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * up * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i]; if (pair(L) !== 0) continue;
      const t0 = L.side < 0 ? 0.3 : 0.5; // stab window
      const raise = sstep(0.05, 0.3, k) * (1 - sstep(t0, t0 + 0.1, k)) + sstep(t0 + 0.14, t0 + 0.3, k) * 0.6 * (1 - sstep(0.8, 1, k));
      const stab = sstep(t0, t0 + 0.1, k) * (1 - sstep(t0 + 0.14, t0 + 0.3, k));
      lo(L, L.toe.x * 0.55, 0.7 * raise + 0.05 * stab, L.toe.z * 0.55 - 0.05 * raise - 0.3 * stab, up * w);
    }
  } },
  attack_big: { dur: 1.7, a: 0.05, d: 0.88, hit: 0.64, fn(ctl, a, w) { // REAR UP: front pairs high, fangs wide (telegraph) → crash down & strike
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rear = sstep(0, 0.4, k) * (1 - sstep(0.56, 0.64, k));
    const trem = rear * sstep(0.3, 0.5, k) * Math.sin(t * 60) * 0.015;
    const slam = sstep(0.56, 0.64, k) * (1 - sstep(0.72, 1, k));
    P.move(b.body, trem, (0.34 * rear - 0.12 * slam) * w, (0.12 * rear - 0.3 * slam) * w);
    P.rot(b.body, (0.95 * rear - 0.22 * slam) * w, 0, trem * 2 * w);
    P.rx(b.abd, (-0.45 * rear + 0.1 * slam) * w);
    ctl.jaw = Math.max(ctl.jaw, (1.0 * rear + 0.3 * slam) * w);
    ctl.glow = mix(ctl.glow, 1 + 2.2 * rear, w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.45, k) * (1 - sstep(0.56, 0.62, k)) * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i], p = pair(L);
      if (p <= 1) {
        const f = p === 0 ? 1 : 0.75;
        const wave = Math.sin(t * 9 + i) * 0.06 * rear;
        lo(L, L.toe.x * mix(0.8, 0.9, slam) + wave * L.side, (0.75 * f + wave) * rear + 0.05 * slam, L.toe.z * 0.7 - 0.35 * slam * f, Math.max(rear, slam) * w);
      } else lp(L, L.home.x * 1.08, 0, L.home.z + 0.1 * rear, rear * w * 0.8);
    }
  } },
  spit: { dur: 0.85, a: 0.08, d: 0.8, hit: 0.5, fn(ctl, a, w) { // venom spit: rear back, fangs flare, head jerks forward
    const P = ctl.pose, b = ctl.b, k = a.k;
    const back = sstep(0, 0.4, k) * (1 - sstep(0.44, 0.52, k)), jerk = sstep(0.44, 0.52, k) * (1 - sstep(0.66, 1, k));
    P.move(b.body, 0, (0.06 * back - 0.02 * jerk) * w, (0.08 * back - 0.1 * jerk) * w);
    P.rx(b.body, (0.3 * back - 0.1 * jerk) * w);
    P.rx(b.abd, -0.15 * back * w);
    ctl.jaw = Math.max(ctl.jaw, (0.9 * back + 0.5 * jerk) * w);
    ctl.glow = mix(ctl.glow, 1 + 1.8 * back + 1.5 * jerk, w);
    ctl.charge = Math.max(ctl.charge, back * 0.6 * w);
  } },
  web: { dur: 1.2, a: 0.1, d: 0.85, hit: 0.55, fn(ctl, a, w) { // curl the abdomen forward between the legs and spray silk (socket: spinner)
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const curl = sstep(0, 0.45, k) * (1 - sstep(0.75, 1, k)), spray = sstep(0.5, 0.58, k) * (1 - sstep(0.7, 0.85, k));
    P.move(b.body, 0, 0.12 * curl * w, 0.05 * curl * w);
    P.rx(b.body, -0.25 * curl * w);
    P.rot(b.abd, (1.1 * curl + Math.sin(t * 40) * 0.04 * spray) * w, 0, 0);
    ctl.glow = mix(ctl.glow, 1 + spray, w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (pair(L) === 3) lp(L, L.home.x * 1.2, 0, L.home.z - 0.05, curl * w); }
  } },
  cast: { dur: 1.6, a: 0.12, d: 0.85, hit: 0.6, fn(ctl, a, w) { // brood call: abdomen throbs, markings flare, legs drum the ground
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const on = sstep(0, 0.25, k) * (1 - sstep(0.8, 1, k));
    const beat = Math.pow(Math.max(0, Math.sin(t * 9)), 4);
    P.sc[b.abd].setScalar(1 + 0.08 * beat * on * w);
    P.move(b.body, 0, -0.04 * on * w, 0); P.rx(b.abd, (0.15 + 0.06 * beat) * on * w);
    ctl.glow = mix(ctl.glow, 1 + 2.5 * on * (0.5 + beat), w); ctl.charge = Math.max(ctl.charge, 0.5 * on * beat * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (pair(L) === 1) lp(L, L.home.x, 0.06 * Math.max(0, Math.sin(t * 18 + i * 3)), L.home.z, on * w); }
  } },
  roar: { dur: 1.4, a: 0.12, d: 0.85, fn(ctl, a, w) { // threat display: rear, front legs spread wide & waving, hiss-shudder
    const P = ctl.pose, b = ctl.b, t = a.t;
    const up = bell(clamp01(a.k * 1.1)) * w, sh = Math.sin(t * 50) * 0.012 * up;
    P.move(b.body, sh, 0.12 * up, 0.06 * up); P.rot(b.body, 0.45 * up, 0, sh * 3);
    P.rx(b.abd, -0.3 * up);
    ctl.jaw = Math.max(ctl.jaw, 0.9 * up); ctl.glow = mix(ctl.glow, 2, up);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i], p = pair(L); if (p > 1) continue;
      const f = p === 0 ? 1 : 0.6;
      lo(L, L.toe.x * (0.9 + 0.15 * f), (0.6 + 0.12 * Math.sin(t * 8 + (L.side > 0 ? 1 : 0))) * f, L.toe.z * 0.6, up * f);
    }
  } },
  idle_alt: { dur: 2.2, a: 0.15, d: 0.8, fn(ctl, a, w) { // groom: pull a front leg through the fangs
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    P.rx(b.body, 0.12 * w); P.move(b.body, 0, 0.03 * w, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.3 + 0.2 * Math.sin(t * 12)) * w);
    const L = ctl.gait.legs[a.seed % 2 < 1 ? 0 : 4];
    const pull = Math.sin(t * 5) * 0.5 + 0.5;
    lo(L, L.side * 0.12, 0.42 + 0.06 * pull, -0.42 - 0.12 * pull, w);
  } },
  tap: { dur: 0.8, a: 0.15, d: 0.7, fn(ctl, a, w) { // one front leg taps the ground
    const L = ctl.gait.legs[a.seed % 2 < 1 ? 0 : 4];
    const h = Math.abs(Math.sin(a.k * Math.PI * 2)) * 0.12;
    lp(L, L.home.x * 1.05, h, L.home.z - 0.05, w);
  } },
  leap: { dur: 1.25, a: 0.05, d: 0.9, hit: 0.72, fn(ctl, a, w) { // crouch, spring up & forward (legs splayed), land
    const P = ctl.pose, b = ctl.b, k = a.k;
    const crouch = sstep(0, 0.25, k) * (1 - sstep(0.28, 0.36, k)) + sstep(0.78, 0.86, k) * (1 - sstep(0.9, 1, k)) * 0.7;
    const airT = clamp01((k - 0.3) / 0.5), inAir = k > 0.3 && k < 0.8 ? 1 : 0;
    const h = Math.sin(airT * Math.PI) * 0.7 * inAir;
    P.move(b.body, 0, (-0.16 * crouch + h) * w, (-0.9 * sstep(0.3, 0.8, k) * (1 - sstep(0.85, 1, k))) * w);
    P.rx(b.body, (0.25 * Math.sin(airT * Math.PI) * inAir - 0.1 * crouch) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.8 * inAir * w);
    const G = ctl.gait.legs;
    const spread = inAir * sstep(0.3, 0.45, k);
    for (let i = 0; i < G.length; i++) { const L = G[i], fr = L.toe.z < 0 ? 1 : 0; lo(L, L.toe.x * (1 + 0.2 * spread), 0.3 * spread + (fr ? 0.2 : 0) * spread, L.toe.z * (1 + 0.25 * spread), spread * w); }
  } },
  hit: { dur: 0.4, a: 0.06, d: 0.5, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, j = sstep(0, 0.12, a.k) * (1 - sstep(0.25, 1, a.k)) * w, s = Math.sin(a.seed * 7.13) > 0 ? 1 : -1;
    P.move(b.body, 0, 0.04 * j, 0.08 * j); P.rot(b.body, 0.18 * j, 0, 0.1 * j * s);
    P.rx(b.abd, -0.2 * j); ctl.jaw = Math.max(ctl.jaw, 0.6 * j);
  } },
  knockback: { dur: 0.85, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) { // shoved back, legs skid wide
    const P = ctl.pose, b = ctl.b, k = a.k;
    const j = sstep(0, 0.08, k) * (1 - sstep(0.4, 1, k)) * w, skid = sstep(0.05, 0.2, k) * (1 - sstep(0.55, 0.95, k)) * w;
    P.move(b.body, 0, 0.06 * j - 0.08 * skid, 0.1 * j); P.rot(b.body, 0.3 * j, 0, 0.08 * j * Math.sin(a.seed));
    P.rx(b.abd, -0.3 * j); ctl.jaw = Math.max(ctl.jaw, 0.7 * j);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lp(L, L.home.x * 1.2, 0, L.home.z + 0.08, skid); }
  } },
  knockdown: { dur: 0.8, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0, start(ctl, a) { ctl.flipSide = Math.sin(a.seed * 7.13) > 0 ? 1 : -1; }, fn(ctl, a, w) { // flipped onto its back, legs flailing
    const k = a.k, t = a.t;
    const f = sstep(0.05, 0.55, k), hop = Math.sin(clamp01(k / 0.55) * Math.PI) * 0.25;
    flip(ctl, w, f, ctl.flipSide, hop, 0.25, 1 - 0.6 * sstep(1.5, 3, t) + 0.4 * Math.pow(Math.max(0, Math.sin(t * 0.9)), 6), t);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * w);
  } },
  getup: { dur: 0.9, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) { // kick over onto its feet
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const side = ctl.flipSide ?? 1;
    const f = 1 - sstep(0.15, 0.7, k), hop = Math.sin(clamp01((k - 0.1) / 0.55) * Math.PI) * 0.2;
    flip(ctl, w * (1 - sstep(0.7, 1, k)), f, side, hop, 0.25 * f, 0.8 * f, t);
    P.rx(b.body, 0.1 * sstep(0.6, 0.8, k) * (1 - sstep(0.85, 1, k)) * w);
  } },
  death: { dur: 1.6, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, start(ctl, a) { a.u.side = ctl.acts.weight('knockdown') > 0.3 && ctl.flipSide ? ctl.flipSide : (Math.sin(a.seed * 7.13) > 0 ? 1 : -1); }, fn(ctl, a, w) { // flung back, flips over, legs curl up and twitch
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    if (a.u.fromDown) {
      flip(ctl, w, 1, a.u.side, 0.08, sstep(0, 1.0, t), Math.sin(t * 30) * 0.3 * (1 - sstep(0.1, 0.8, t)), t);
    } else {
      const f = sstep(0.05, 0.42, k), back = sstep(0, 0.45, k);
      flip(ctl, w, f, a.u.side, kf(k, DE_T, DE_Y), sstep(0.35, 0.9, k), (1 - sstep(0.4, 0.9, k)) * 1.2, t);
      P.move(b.body, 0, 0, 0.7 * back * w);
    }
    const tw = Math.pow(Math.max(0, Math.sin(t * 7)), 20) * (1 - sstep(1.2, 2.2, t));
    P.rx(b.abd, 0.1 * tw * w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * w);
    ctl.glow = mix(ctl.glow, 0.1, sstep(0.3, 1.4, t) * w);
  } },
  stun: { dur: 1.8, loop: true, state: true, fadeIn: 0.25, fadeOut: 0.3, fn(ctl, a, w) { // dazed: sagging, legs splayed, reeling
    const P = ctl.pose, b = ctl.b, ph = a.t / 1.8 * TAU;
    P.move(b.body, Math.sin(ph) * 0.03 * w, -0.12 * w, 0);
    P.rot(b.body, -0.05 * w, Math.sin(ph) * 0.1 * w, Math.cos(ph) * 0.08 * w);
    P.rot(b.abd, -0.15 * w, 0, Math.sin(ph) * 0.1 * w);
    ctl.jaw = Math.max(ctl.jaw, 0.3 * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lp(L, L.home.x * 1.18, 0, L.home.z * 1.1, 0.8 * w); }
  } },
  spawn: { dur: 1.6, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // claws out of a burrow: legs first, then the body hauls up
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rise = sstep(0.25, 0.75, k), legs = sstep(0.02, 0.25, k);
    P.move(b.body, 0, -0.75 * (1 - rise) * w, 0);
    P.rot(b.body, (0.5 * (1 - rise) * legs + 0.3 * sstep(0.75, 0.85, k) * (1 - sstep(0.88, 1, k))) * w, 0, Math.sin(t * 13) * 0.08 * (1 - rise) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.9 * sstep(0.75, 0.85, k) * (1 - sstep(0.92, 1, k)) + 0.3 * (1 - rise)) * w);
    ctl.glow = mix(ctl.glow, 2.4, sstep(0.75, 0.85, k) * (1 - sstep(0.92, 1, k)) * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i], p = pair(L), cl = Math.sin(t * 15 + i * 1.3) * 0.08 * (1 - rise);
      // front legs reach out over the rim and haul; back legs follow
      const reach = p < 2 ? legs : sstep(0.3, 0.6, k);
      lp(L, L.home.x * (0.5 + 0.6 * reach), 0.12 * (1 - rise) + cl, L.home.z * (0.5 + 0.55 * reach), (1 - sstep(0.7, 0.85, k)) * w);
    }
  } },
  spawn_drop: { dur: 1.5, a: 0.001, d: 0.85, state: true, excl: true, fn(ctl, a, w) { // descends on a silk line from the canopy, then drops the last bit
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const H = 3.2, d = sstep(0, 0.62, k), fallK = sstep(0.62, 0.72, k), land = sstep(0.7, 0.76, k) * (1 - sstep(0.8, 1, k));
    const y = H * (1 - d) * 0.92 + 0.25 * (1 - fallK) * (1 - d * 0) * (1 - fallK);
    const spin = (1 - d) * 1.8;
    P.move(b.body, 0, (Math.max(0, y) - 0.1 * land) * w, 0);
    P.rot(b.body, (0.35 * (1 - fallK) - 0.1 * land) * w, spin * w, Math.sin(t * 3) * 0.1 * (1 - fallK) * w);
    ctl.silk = Math.max(ctl.silk, (3.5 - Math.max(0, y)) * (1 - fallK) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * land * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lo(L, L.toe.x * 0.75, 0.3 + 0.05 * Math.sin(t * 6 + i), L.toe.z * 0.75, (1 - fallK) * w); }
  } },
};

const SPEC = {
  bones: { body: 'body', abd: 'abdomen', silk: 'silk', chelL: 'chelL', chelR: 'chelR', palpL: 'palpL', palpR: 'palpR', palp2L: 'palp2L', palp2R: 'palp2R' },
  fidgets: [{ name: 'tap', w: 3 }, { name: 'idle_alt', w: 2 }, { name: 'roar', w: 0.5 }],
  fidgetGap: 3.5, chargeK: 0.35,
  actions: ACTIONS,
};
