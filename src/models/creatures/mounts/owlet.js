// Owlet: a round fluffy baby owl pet (~0.42 m with ear tufts). One big fluffy egg of a body, a heart-shaped facial
// disc with huge eyes, a tiny hooked beak, ear tufts, stubby feathered legs with little talons, feathered wings folded
// along the sides. Hops on the ground (two-footed), and FLIES (wings spread & flap, hovering at shoulder height) when
// state.fly is set or when it has to keep up with a running player (auto-fly above ~2.6 m/s, lands below ~1.6 m/s).
// Variants: tawny (default), snowy, moonlit.
import * as THREE from 'three';
import { BipedCtl } from '../ctl.js';
import { leafGeo, sweep, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn } from '../../kit/parts.js';
import { addG, rigidSkin, mixSkin, lerp3, sstep, clamp01, mix, TAU, legTo } from './common.js';
import { cuteEye, petPost, popIn } from './petkit.js';

const PAL = {
  tawny: { body: 0xa8784c, body2: 0x7a5232, belly: 0xefd9b4, bar: 0x8a6440, disc: 0xf4e4c8, discRim: 0x6a4428, iris: 0xff9a1e, beak: 0xe8c070, feet: 0xe8a848, wing: 0x8e6842, wingTip: 0x5a3e24, tuft: 0x6e4a2c, speck: 0, glow: 0.5 },
  snowy: { body: 0xdcdcd8, body2: 0xbcc0c4, belly: 0xeaeae6, bar: 0x3a3a40, disc: 0xf0f0ec, discRim: 0xa8aeb6, iris: 0xffd228, beak: 0x3a3a44, feet: 0x9a9aa4, wing: 0xd8d8d4, wingTip: 0x8a8c94, tuft: 0xe0e0dc, speck: 0x2a2a30, glow: 0.5 },
  moonlit: { body: 0x44548a, body2: 0x2c3866, belly: 0x8c9ccc, bar: 0x2a3462, disc: 0xc8d4f4, discRim: 0x2a3462, iris: 0x7ae8ff, beak: 0xe0d8a8, feet: 0xb8b0d0, wing: 0x3a4a80, wingTip: 0x1e2850, tuft: 0x2c3866, speck: 0xcfe8ff, glow: 2.2 },
};

export const owlet = {
  name: 'Owlet',
  variants: ['tawny', 'snowy', 'moonlit'],
  pet: true, canFly: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'tawny';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.026, hg: { 1: 0.0195 }, ao: { dist: 0.014, str: 0.6 },
      grad: { top: 0.12, bottom: 0.25, y0: 0.0, y1: 0.2, low: 0.15 }, mat: { dfreq: 10, furAxis: 1, rim: 0.45, rimColor: 0xfff4e0 } };
  },
  rig(R) {
    R.add('hips', null, [0, 0.13, 0.01]);
    R.add('spine', 'hips', [0, 0.18, 0.0]);
    R.add('chest', 'spine', [0, 0.22, -0.005]);
    R.add('head', 'chest', [0, 0.27, -0.01]);
    R.add('jaw', 'head', [0, 0.268, -0.12]);
    R.add('earL', 'head', [-0.07, 0.37, -0.04]); R.add('earR', 'head', [0.07, 0.37, -0.04]);
    R.add('eyeL', 'head', [-0.046, 0.305, -0.105]); R.add('eyeR', 'head', [0.046, 0.305, -0.105]);
    R.add('tail', 'hips', [0, 0.1, 0.1]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('wing1' + n, 'chest', [s * 0.105, 0.225, 0.0]); R.add('wing2' + n, 'wing1' + n, [s * 0.125, 0.13, 0.03]);
      R.add('thigh' + n, 'hips', [s * 0.04, 0.085, 0.0]); R.add('shin' + n, 'thigh' + n, [s * 0.044, 0.05, -0.012]); R.add('foot' + n, 'shin' + n, [s * 0.044, 0.016, -0.004]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, fl = [0.35, 0, 0.12, 0], flS = [0.2, 0, 0.1, 0];
    // ---- round fluffy egg body, a pale belly
    S.ell('spine', [0, 0.165, 0.0], [0.115, 0.115, 0.108], { k: 0.04, col: c.body, tag: 'body', dtl: fl });
    S.ell('hips', [0, 0.11, 0.01], [0.1, 0.075, 0.095], { k: 0.04, col: c.body, tag: 'body', dtl: fl });
    S.ell('spine', [0, 0.15, -0.055], [0.085, 0.09, 0.065], { k: 0.04, col: c.belly, tag: 'belly', dtl: fl });
    for (let i = 0; i < 6; i++) { // fluffy tufts breaking the outline
      const a = (i / 6) * TAU + 0.4, x = Math.sin(a) * 0.1, z = Math.cos(a) * 0.09;
      S.cone(i % 2 ? 'hips' : 'spine', [x * 0.8, 0.12 + 0.02 * (i % 3), z * 0.8], [x * 1.25, 0.1 + 0.015 * (i % 2), z * 1.25], 0.03, 0.006, { k: 0.02, col: c.body, tag: 'fluff', dtl: fl });
    }
    // ---- big round head (group 1): heart-shaped facial disc, brow ridge
    const g1 = { group: 1 };
    S.ell('head', [0, 0.3, -0.005], [0.115, 0.1, 0.1], { ...g1, k: 0.035, col: c.body, tag: 'head', dtl: flS });
    for (const s of [-1, 1]) S.ell('head', [s * 0.046, 0.3, -0.07], [0.052, 0.058, 0.035], { ...g1, k: 0.025, col: c.disc, tag: 'disc', dtl: flS });
    S.ell('head', [0, 0.338, -0.075], [0.05, 0.016, 0.02], { ...g1, k: 0.015, col: c.body2, tag: 'brow', rot: [-0.2, 0, 0], dtl: flS });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    if (v.group === 0) {
      v.mix(c.body2, sstep(0.4, 0.9, ny) * 0.3);
      // belly chevrons / bars
      const bar = sstep(0.55, 0.8, Math.sin(y * 150 + Math.abs(x) * 60)) * v.t('belly') * sstep(-0.3, -0.7, nz);
      v.mix(c.bar, bar * 0.6);
      if (c.speck) { const sp = sstep(0.8, 0.95, Math.sin(x * 190) * Math.sin(y * 170 + z * 90) * Math.sin(z * 150)); v.mix(c.speck, sp * 0.8); if (cfg.variant === 'moonlit') v.emis = Math.max(v.emis, sp * 1.6); }
    } else {
      // disc rim (darker ring around the face)
      const dz = sstep(-0.035, -0.07, z);
      v.mix(c.discRim, (1 - sstep(0.0, 0.2, Math.abs(v.t('disc') - 0.35))) * dz * 0.6);
      if (c.speck && v.t('disc') < 0.3) { const sp = sstep(0.8, 0.95, Math.sin(x * 190) * Math.sin(y * 170 + z * 90) * Math.sin(z * 150)); v.mix(c.speck, sp * 0.8); if (cfg.variant === 'moonlit') v.emis = Math.max(v.emis, sp * 1.6); }
    }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    // huge eyes in the facial disc
    for (const s of [-1, 1]) cuteEye(acc, S, b(s < 0 ? 'eyeL' : 'eyeR'), [s * 0.046, 0.305, -0.105], [s * 0.18, 0.05, -1], 0.033, { iris: c.iris, rim: 0x1a1008, group: 1, sink: 0.45, glow: c.glow, pupilA: 0.55, irisA: 0.97, seg: 10 });
    // tiny hooked beak
    addHorn(acc, b('head'), [0, 0.292, -0.105], [0, 0.28, -0.128], [0, 0.262, -0.122], 0.014, 0.002, { base: c.beak, tip: c.beak, radial: 5, n: 4 });
    // ear tufts
    for (const s of [-1, 1]) {
      const g = leafGeo(0.022, 0.07, 0.01, 0.4, 0.1, { nu: 4, nv: 4, pw: 0.7, tipW: 0.002 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.15, -s * 0.2, -s * 0.5, 'YXZ')); m.setPosition(s * 0.065, 0.36, -0.035);
      const ct = col(c.tuft), cb = col(c.body2);
      addG(acc, g, { matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.3, 0, 0.1, 0], color: (p, n, uv) => lerp3(cb, ct, uv[1]) });
    }
    // wings: layered feather plates hanging along the flanks (w1 coverts, w2 primaries); leafGeo grows +Y with its
    // concave face toward −Z, so build each plate's basis explicitly: Y = feather direction, −Z = outward (±X)
    const cw = col(c.wing), cwt = col(c.wingTip), cb2 = col(c.bar);
    const plateM = (s, dir, pos) => {
      const Y = new THREE.Vector3(...dir).normalize(), Z = new THREE.Vector3(-s, 0, 0);
      Z.addScaledVector(Y, -Z.dot(Y)).normalize();
      const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
      return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(pos[0], pos[1], pos[2]);
    };
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', w1 = b('wing1' + n), w2 = b('wing2' + n);
      for (let f = 0; f < 3; f++) { // primaries fanning down-back from the wrist
        const g = leafGeo(0.034, 0.165 - f * 0.018, 0.008, 0.3, 0.06, { nu: 4, nv: 4, pw: 0.6, tipW: 0.006 });
        const m = plateM(s, [s * 0.1, -1, 0.35 + f * 0.5], [s * (0.117 + f * 0.003), 0.2 - f * 0.012, -0.01 + f * 0.024]);
        addG(acc, g, { matrix: m, skin: rigidSkin(w2), dtl: [0.25, 0, 0.1, 0], color: (p, nn, uv) => lerp3(lerp3(cw, cb2, sstep(0.45, 0.55, (uv[1] * 3) % 1) * 0.35), cwt, sstep(0.5, 1, uv[1])) });
      }
      const g = leafGeo(0.055, 0.1, 0.012, 0.25, 0.04, { nu: 4, nv: 4, pw: 0.5, tipW: 0.02 }); // coverts over the shoulder
      const m = plateM(s, [s * 0.15, -1, 0.15], [s * 0.106, 0.25, 0.0]);
      addG(acc, g, { matrix: m, skin: (p) => mixSkin(rigidSkin(w1), rigidSkin(w2), sstep(0.21, 0.15, p.y)), dtl: [0.3, 0, 0.1, 0], color: (p, nn, uv) => lerp3(cw, lerp3(cw, cwt, 0.4), uv[1]) });
    }
    // short tail fan
    { const g = leafGeo(0.035, 0.06, 0.008, 0.1, 0.05, { nu: 4, nv: 3, pw: 0.3, tipW: 0.025 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + 0.5, 0, 0)); m.setPosition(0, 0.1, 0.09);
      addG(acc, g, { matrix: m, skin: rigidSkin(b('tail')), color: c.wingTip, dtl: [0.3, 0, 0.1, 0] }); }
    // feathered legs & little talons
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      addG(acc, sweep([[s * 0.044, 0.07, -0.01], [s * 0.044, 0.02, -0.006]], [0.018, 0.013], { radial: 5, capStart: true }), { skin: rigidSkin(b('shin' + n)), color: c.belly, dtl: [0.3, 0, 0.1, 0] });
      for (const [dx, dz] of [[-0.012, -0.022], [0.012, -0.022], [0, 0.012]]) {
        addHorn(acc, b('foot' + n), [s * 0.044, 0.012, -0.004], [s * 0.044 + dx * 0.6, 0.006, -0.004 + dz * 0.7], [s * 0.044 + dx, 0.0, -0.004 + dz], 0.006, 0.002, { base: c.feet, tip: 0x2a2020, radial: 4, n: 3, gpow: 3 });
      }
    }
  },
  sockets: { head: ['head', [0, 0.4, -0.01]], mouth: ['jaw', [0, 0.265, -0.13]], center: ['spine', [0, 0.17, 0]], back: ['chest', [0, 0.24, 0.08]], chest: ['chest', [0, 0.18, -0.08]] },
  height: 0.42, radius: 0.15,
  controller(inst) { return new OwletCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ controller
/** BipedCtl + auto-flight: flies when told to (state.fly) or when it must keep up with a running player */
class OwletCtl extends BipedCtl {
  constructor(inst, spec) { super(inst, spec); this.st = { speed: 0, turn: 0, strafe: 0, combat: false, dead: false, down: false, stunned: false, fly: false }; this.autoFly = false; }
  update(dt, state = {}) {
    const st = this.st, sp = Math.abs(state.speed ?? 0);
    if (sp > 2.6) this.autoFly = true; else if (sp < 1.6) this.autoFly = false;
    st.speed = state.speed ?? 0; st.turn = state.turn ?? 0; st.strafe = state.strafe ?? 0; st.combat = !!state.combat; st.dead = !!state.dead; st.down = !!state.down; st.stunned = !!state.stunned;
    st.fly = !!state.fly || this.autoFly;
    super.update(dt, st);
  }
}

const hopArc = (k, a0, a1) => (k > a0 && k < a1 ? Math.sin((k - a0) / (a1 - a0) * Math.PI) : 0);
/** both feet to a body-local target (plain loop, no per-frame closure) */
function feetTo(ctl, dy, dz, w, local = true, paw = -0.6, sx = 1) { const G = ctl.gait.legs; for (let i = 0; i < G.length; i++) { const L = G[i]; legTo(L, L.toe.x * sx, L.toe.y + dy, L.toe.z + dz, w, local, paw); } }
const ACTIONS = {
  hop: { dur: 0.5, a: 0.02, d: 0.95, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, h = hopArc(k, 0.2, 0.8);
    const sq = sstep(0, 0.18, k) * (1 - sstep(0.18, 0.26, k)) + sstep(0.78, 0.86, k) * (1 - sstep(0.86, 1, k));
    P.move(b.hips, 0, (0.11 * h - 0.02 * sq) * w, 0);
    P.sc[b.spine].set(1 + 0.08 * sq * w, 1 - 0.1 * sq * w + 0.06 * h * w, 1 + 0.08 * sq * w);
    ctl.flap = Math.max(ctl.flap, 0.5 * h * w);
    if (h > 0) feetTo(ctl, 0.025, 0, h * w);
  } },
  happy: { dur: 1.4, a: 0.03, d: 0.94, fn(ctl, a, w) { // flutter up, twirl, eyes ^ ^
    const P = ctl.pose, b = ctl.b, k = a.k, h = hopArc(k, 0.1, 0.8);
    P.move(b.hips, 0, 0.2 * h * w, 0);
    P.rot(b.hips, 0, sstep(0.15, 0.7, k) * TAU * w, 0);
    ctl.flap = Math.max(ctl.flap, h * w); ctl.wingSpread = Math.max(ctl.wingSpread, 0.8 * h * w);
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.05, 0.2, k) * w);
    if (h > 0) feetTo(ctl, 0.02, 0, h * w);
  } },
  sit: { dur: 1, hold: true, rest: true, fadeIn: 0.4, fadeOut: 0.3, fn(ctl, a, w) { // settle down, fluffed up
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.move(b.hips, 0, -0.045 * w, 0);
    P.sc[b.spine].set(1 + 0.08 * w, 1 - 0.04 * w + Math.sin(t * 2) * 0.01 * w, 1 + 0.08 * w);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.35 * w);
    feetTo(ctl, 0, 0.01, w, true, 0);
  } },
  sleep: { dur: 1, hold: true, rest: true, fadeIn: 0.8, fadeOut: 0.5, fn(ctl, a, w) { // puffed, head tucked, eyes shut, slow breath
    const P = ctl.pose, b = ctl.b, t = a.t, br = Math.sin(t * 1.6);
    P.move(b.hips, 0, -0.05 * w, 0);
    P.sc[b.spine].set(1 + (0.1 + 0.015 * br) * w, 1 - 0.05 * w, 1 + (0.1 + 0.015 * br) * w);
    P.rot(b.head, 0.28 * w, 0.2 * w, 0.18 * w);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, w);
    feetTo(ctl, 0, 0.01, w, true, 0);
  } },
  pickup: { dur: 0.8, a: 0.05, d: 0.85, hit: 0.45, fn(ctl, a, w) { // bob down & grab with the beak, flick up
    const P = ctl.pose, b = ctl.b, k = a.k;
    const dip = sstep(0.05, 0.35, k) * (1 - sstep(0.5, 0.8, k)), flick = sstep(0.42, 0.5, k) * (1 - sstep(0.6, 0.85, k));
    P.rx(b.spine, -0.55 * dip * w); P.rx(b.head, (-0.35 * dip + 0.3 * flick) * w);
    ctl.flap = Math.max(ctl.flap, 0.35 * flick * w);
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.55, 0.7, k) * w);
  } },
  hoot: { dur: 1.1, a: 0.1, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, j = Math.sin(clamp01(k) * Math.PI);
    P.sc[b.spine].set(1 + 0.08 * j * Math.max(0, Math.sin(t * 9)) * w, 1, 1 + 0.08 * j * Math.max(0, Math.sin(t * 9)) * w);
    P.rx(b.head, -0.12 * j * w);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.4 * j * w);
  } },
  idle_alt: { dur: 2.4, a: 0.12, d: 0.85, start(ctl, a) { a.u.s = Math.random() < 0.5 ? -1 : 1; }, fn(ctl, a, w) { // the owl head swivel
    const P = ctl.pose, b = ctl.b, k = a.k, s = a.u.s;
    const turn = sstep(0.05, 0.3, k) * (1 - sstep(0.6, 0.85, k));
    P.rot(b.head, 0, s * 2.2 * turn * w, s * 0.25 * Math.sin(k * Math.PI * 3) * turn * w);
    if (k > 0.35 && k < 0.45) ctl.eyeClose = Math.max(ctl.eyeClose || 0, Math.sin((k - 0.35) / 0.1 * Math.PI) * w);
  } },
  wave: { dur: 1.4, a: 0.08, d: 0.85, fn(ctl, a, w) { // lift one wing and wave it
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.2, k) * (1 - sstep(0.8, 1, k)), wv = Math.sin(t * 14);
    P.rot(b.wing1R, -0.3 * up * w, 0.2 * up * w, (1.9 + 0.35 * wv) * up * w);
    P.rot(b.wing2R, 0, 0, 0.3 * wv * up * w);
    P.rot(b.hips, 0, 0, -0.12 * up * w); P.rot(b.head, 0, -0.2 * up * w, 0.15 * up * w);
    ctl.happy = Math.max(ctl.happy || 0, 0.8 * up * w);
  } },
  hit: { dur: 0.45, a: 0.04, d: 0.5, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, j = Math.sin(clamp01(a.k * 1.6) * Math.PI) * w;
    P.move(b.hips, 0, 0.03 * j, 0.03 * j); P.rx(b.spine, 0.25 * j);
    P.sc[b.spine].set(1 + 0.12 * j, 1 + 0.08 * j, 1 + 0.12 * j); // feathers puff
    ctl.flap = Math.max(ctl.flap, 0.7 * j); ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.8 * j);
  } },
  death: { dur: 1.2, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // faint: topple backward, wings flopped out
    const P = ctl.pose, b = ctl.b, k = a.k;
    const f = sstep(0.1, 0.5, k), bounce = Math.sin(clamp01((k - 0.45) / 0.2) * Math.PI) * 0.02;
    P.move(b.hips, 0, (-0.07 * f + bounce + 0.05 * Math.sin(clamp01(k / 0.45) * Math.PI)) * w, 0.04 * f * w);
    P.rx(b.hips, -1.35 * f * w);
    ctl.wingSpread = Math.max(ctl.wingSpread, 0.7 * f * w);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, sstep(0.25, 0.4, k) * w);
    feetTo(ctl, 0.03, 0, f * w, true, -0.8, 1.4);
  } },
  spawn: popIn(0.75, { fn(ctl, a, w) { ctl.flap = Math.max(ctl.flap, (1 - sstep(0.3, 0.8, a.k)) * w); ctl.wingSpread = Math.max(ctl.wingSpread, 0.6 * (1 - sstep(0.3, 0.8, a.k)) * w); } }),
};

const SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', jaw: 'jaw', tail: ['tail'], ears: ['earL', 'earR'], eyes: ['eyeL', 'eyeR'],
    wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'], wing1R: 'wing1R', wing2R: 'wing2R' },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.044, 0, -0.02], body: 'hips', scap: 0.2, lift: 0.03, flex: 0.6, heel: 0.2 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.044, 0, -0.02], body: 'hips', scap: 0.2, lift: 0.03, flex: 0.6, heel: 0.2 },
    ],
    maxStride: 0.14, fMin: 0.8, actV: 0.12,
    gaits: [ // two-footed hops
      { v: 0.5, f: 2.6, duty: 0.38, lift: 1.6, off: { L: 0, R: 0.02 }, bob: 0.025, bobF: 1, bobPh: 0.7, pitch: 0.1, pitchF: 1, roll: 0.03, rollF: 1 },
      { v: 1.8, f: 3.6, duty: 0.32, lift: 1.8, off: { L: 0, R: 0.03 }, bob: 0.035, bobF: 1, bobPh: 0.7, pitch: 0.12, pitchF: 1 },
    ],
  },
  arm: {}, lean: { walk: 0.1, run: 0.25, combat: 0 }, twist: 0.02, waddle: 0.06, crouch: 0, breathe: 0.03, tailLift: 0.3, tailFly: 0.5,
  // wings hang folded along the flanks; lift (roll up) to spread, flapping around ~horizontal in flight
  wings: { idleF: 0.4, flapF: 6.5, amp: 0.85, idleAmp: 0.03, fold: 0.05, fold2: 0.4, lift: 1.25, flySpread: 1.1, tilt: 0 },
  flyH: 1.05, flyBob: 0.06, flyLean: 0.35, airPaw: -0.8,
  fidgets: [{ name: 'idle_alt', w: 3 }, { name: 'hoot', w: 1 }, { name: 'hop', w: 1 }],
  fidgetGap: 3.5,
  pose(ctl, dt) {
    // round body bobs & tilts its head curiously; flying: body tips forward a little, legs tucked
    const P = ctl.pose, b = ctl.b, idle = 1 - clamp01(ctl.gait.act * 1.5);
    P.rz(b.head, Math.sin(ctl.t * 0.8) * 0.2 * idle * (1 - ctl.fly));
  },
  post(ctl, dt) { petPost(ctl, dt, { happyLift: 0.003 }); },
  actions: ACTIONS,
};
