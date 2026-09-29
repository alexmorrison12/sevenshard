// Small mammals: `rabbit` (brown / grey / white / snow) and `cat` (ginger / grey / black / calico / siamese).
// Adapted from Everdawn's proven critters (cheap coarse SDF bodies + thin rigid parts) to the SEVENSHARD creature format:
// QuadCtl locomotion (bounding hops for the rabbit, walk → trot → gallop for the cat), acts.js hit / death / stun, plus
// species actions. Readability at the game camera: oversized ears + white scut (rabbit), upright tail + ear points (cat).
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { qHit, qDeath, qStun, qKnockback } from '../acts.js';
import { sweep, rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, bell, TAU } from '../../kit/rig.js';
import { ear, ov, V3, L2 } from './common.js';

/** squashed low-poly blob (paws, feet) rigid to a bone */
function paw(acc, bone, pos, r, color) {
  const g = new THREE.SphereGeometry(1, 5, 3);
  acc.add(g, { matrix: new THREE.Matrix4().makeScale(r[0], r[1], r[2]).setPosition(pos[0], pos[1], pos[2]), skin: rigid(bone), color, dtl: [0.3, 0, 0.1, 0] });
}
/**
 * Smooth tube through pts (Catmull-Rom; radii per control point), skinned along a bone chain by arc length.
 * bones: bone indices; rests: their rest joint positions ([x,y,z]); each bone owns the tube from its joint to the next,
 * blended over ±zone of a segment around each joint (limbs bend at the joints, not along their length).
 * colorFn(u along 0..1, y) → [r,g,b].
 */
function tube(acc, pts, radii, bones, rests, colorFn, o = {}) {
  const radial = o.radial ?? 6, seg = o.seg ?? 10, zone = o.zone ?? 0.3;
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const P = curve.getSpacedPoints(seg), n = P.length;
  const acl = [0]; for (let i = 1; i < n; i++) acl.push(acl[i - 1] + P[i].distanceTo(P[i - 1]));
  const L = acl[n - 1];
  const rr = P.map((_, i) => { const t = i / (n - 1) * (radii.length - 1), j = Math.min(radii.length - 2, Math.floor(t)); return mix(radii[j], radii[j + 1], t - j); });
  const near = (q) => { let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = q.distanceToSquared(P[i]); if (d < bd) { bd = d; best = i; } } return best; };
  const bs = rests.map(r => acl[near(new THREE.Vector3(...r))]);
  const skinAt = (sa) => {
    let j = 0; while (j < bs.length - 1 && sa >= bs[j + 1]) j++;
    const s0 = bs[j], s1 = j < bs.length - 1 ? bs[j + 1] : Infinity, len = Math.min(s1 - s0, (bs[1] - bs[0]) || 1);
    const f = (sa - s0) / Math.max(1e-6, len);
    if (j > 0 && f < zone) { const t = 0.5 + 0.5 * sstep(0, zone, f); return { si: [bones[j - 1], bones[j], 0, 0], sw: [1 - t, t, 0, 0] }; }
    if (j < bs.length - 1 && f > 1 - zone) { const t = 0.5 * sstep(1 - zone, 1, f); return { si: [bones[j], bones[j + 1], 0, 0], sw: [1 - t, t, 0, 0] }; }
    return { si: [bones[j], 0, 0, 0], sw: [1, 0, 0, 0] };
  };
  const g = sweep(P, rr, { radial, capStart: !!o.capStart });
  acc.add(g, { skin: (p) => skinAt(acl[near(p)]), color: (p, nn, uv) => colorFn(uv[1], p.y), dtl: o.dtl ?? [0.3, 0, 0.1, 0] });
}
const graze = (neck = -0.9, head = -0.5) => ({ dur: 1, hold: true, rest: true, fadeIn: 0.6, fadeOut: 0.4, fn(ctl, a, w) {
  const P = ctl.pose, b = ctl.b, t = a.t;
  P.rx(b.neck, neck * w); P.rot(b.head, (head + Math.sin(t * 7) * 0.04) * w, Math.sin(t * 0.7) * 0.15 * w, 0);
  P.rx(b.chest, -0.05 * w);
  ctl.jaw = Math.max(ctl.jaw, (0.08 + 0.06 * Math.sin(t * 9)) * w);
} });

// ================================================================================================ rabbit
const RB_PAL = { brown: [0x8a7458, 0xf0e8dc, 0x5a4a38], grey: [0x8a8680, 0xece8e2, 0x55524e], white: [0xdcd8d0, 0xe8e6e0, 0xb8b0a8], snow: [0xe8e8ea, 0xf2f2f2, 0xc8c8cc] };
export const rabbit = {
  name: 'Rabbit',
  variants: ['brown', 'grey', 'white', 'snow'],
  config(variant) {
    const v = RB_PAL[variant] ? variant : 'brown', p = RB_PAL[v];
    return { variant: v, pal: { fur: p[0], belly: p[1], dark: p[2], eye: v === 'white' || v === 'snow' ? 0x8a2030 : 0x1a1210 }, shapeKey: 'base', h: 0.022, scale: 1.1, mat: { dfreq: 7 }, ao: { dist: 0.016, str: 0.7 } };
  },
  rig(R) {
    R.add('body', null, [0, 0.13, 0.02]); R.add('hips', 'body', [0, 0.12, 0.07]); R.add('chest', 'body', [0, 0.13, -0.05]);
    R.add('neck', 'chest', [0, 0.16, -0.08]); R.add('head', 'neck', [0, 0.2, -0.1]); R.add('jaw', 'head', [0, 0.18, -0.13]);
    R.add('earL', 'head', [-0.02, 0.235, -0.09]); R.add('earR', 'head', [0.02, 0.235, -0.09]); R.add('tail', 'hips', [0, 0.14, 0.13]);
    for (const s of [-1, 1]) {
      R.add(L2(s, 'fU'), 'chest', [s * 0.04, 0.1, -0.07]); R.add(L2(s, 'fL'), L2(s, 'fU'), [s * 0.04, 0.06, -0.06]); R.add(L2(s, 'fP'), L2(s, 'fL'), [s * 0.04, 0.018, -0.075]);
      R.add(L2(s, 'rT'), 'hips', [s * 0.05, 0.11, 0.07]); R.add(L2(s, 'rS'), L2(s, 'rT'), [s * 0.055, 0.065, 0.02]); R.add(L2(s, 'rM'), L2(s, 'rS'), [s * 0.055, 0.03, 0.1]); R.add(L2(s, 'rP'), L2(s, 'rM'), [s * 0.055, 0.014, 0.035]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, f = [0.35, 0, 0.1, 0];
    S.ell('body', [0, 0.125, 0.03], [0.065, 0.07, 0.095], { k: 0.03, col: c.fur, tag: 'body', dtl: f });
    S.ell('chest', [0, 0.125, -0.045], [0.055, 0.065, 0.06], { k: 0.03, col: c.fur, tag: 'body', dtl: f });
    S.ell('head', [0, 0.195, -0.105], [0.042, 0.042, 0.052], { k: 0.025, col: c.fur, tag: 'head', dtl: f });
    for (const s of [-1, 1]) S.ell('head', [s * 0.02, 0.183, -0.14], [0.022, 0.022, 0.022], { k: 0.015, col: c.belly, tag: 'muzzle', dtl: f });
    S.sph('head', [0, 0.194, -0.158], 0.009, { k: 0.006, col: 0xd08a88, tag: 'nose' });
    for (const s of [-1, 1]) {
      S.ell(L2(s, 'rT'), [s * 0.05, 0.085, 0.065], [0.036, 0.06, 0.058], { k: 0.025, col: c.fur, tag: 'haunch', dtl: f });
      S.cone(L2(s, 'rS'), [s * 0.055, 0.062, 0.04], [s * 0.055, 0.032, 0.09], 0.024, 0.017, { k: 0.018, col: c.fur, b2: L2(s, 'rM'), dtl: f });
    }
    S.sph('tail', [0, 0.145, 0.135], 0.027, { k: 0.015, col: 0xe2ded6, tag: 'tail', dtl: f, cw: 3 });
  },
  paint(v, cfg) { v.mix(cfg.pal.belly, sstep(-0.2, -0.7, v.n[1]) * 0.8); v.mix(cfg.pal.dark, sstep(0.5, 0.9, v.n[1]) * 0.25 * (1 - v.t('tail'))); v.mix(0xe2ded6, v.t('tail')); },
  parts(acc, S, R, cfg) {
    const b = (n) => R.index(n), c = cfg.pal;
    for (const s of [-1, 1]) {
      // thin legs as rigid sweeps (cheap; the SDF stays coarse): forelegs, long hind feet
      const fur = col(c.fur), bel = col(c.belly);
      tube(acc, [[s * 0.04, 0.115, -0.066], [s * 0.04, 0.06, -0.06], [s * 0.04, 0.02, -0.074], [s * 0.04, 0.009, -0.088]], [0.015, 0.012, 0.01, 0.009],
        [b(L2(s, 'fU')), b(L2(s, 'fL')), b(L2(s, 'fP'))], [[s * 0.04, 0.1, -0.07], [s * 0.04, 0.06, -0.06], [s * 0.04, 0.018, -0.075]], (u) => lerp3(fur, bel, sstep(0.3, 0.7, u)), { seg: 8, radial: 5 });
      tube(acc, [[s * 0.055, 0.036, 0.1], [s * 0.055, 0.016, 0.05], [s * 0.055, 0.011, 0.0]], [0.014, 0.012, 0.009], [b(L2(s, 'rM')), b(L2(s, 'rP'))], [[s * 0.055, 0.03, 0.1], [s * 0.055, 0.014, 0.035]], (u) => lerp3(fur, bel, sstep(0.1, 0.5, u)), { seg: 6, radial: 5 });
      addEye(acc, S, b('head'), [s * 0.03, 0.205, -0.125], [s * 1, 0.1, -0.5], 0.0105, { iris: c.eye, pupil: 0x080606, pupilA: 0.55, irisA: 1.1, seg: 7, glint: false });
      // long ears (oversized a touch so the silhouette reads at the game camera)
      ear(acc, b(s < 0 ? 'earL' : 'earR'), [s * 0.018, 0.225, -0.09], [0.3, s * 0.25, -s * 0.18], 0.022, 0.105, 0.008, c.fur, 0xe0a8a0, 0.6, { pw: 0.5, tip: c.dark, tipFrom: 0.8 });
      for (let i = 0; i < 2; i++) acc.add(sweep([[s * 0.014, 0.185 - i * 0.004, -0.15], [s * 0.05, 0.19 - i * 0.012, -0.14 + i * 0.006]], [0.0009, 0.0005], { radial: 3 }), { skin: rigid(b('head')), color: 0xf0ece4, dtl: [0, 0, 0, 0] });
    }
  },
  sockets: { head: ['head', [0, 0.25, -0.1]], mouth: ['jaw', [0, 0.18, -0.15]], center: ['body', [0, 0.13, 0.0]], back: ['body', [0, 0.19, 0.02]], chest: ['chest', [0, 0.12, -0.08]] },
  height: 0.32, radius: 0.12,
  controller(inst) { return new QuadCtl(inst, RABBIT_SPEC); },
  get actionList() { return RB_ACTIONS; },
};
const RB_ACTIONS = {
  hop: { dur: 0.5, a: 0.05, d: 0.9, fn(ctl, a, w) { const P = ctl.pose, b = ctl.b, h = Math.sin(a.k * Math.PI); P.move(b.body, 0, 0.08 * h * w, -0.03 * h * w); P.rx(b.body, 0.25 * Math.sin(a.k * TAU) * w); for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; ov(L, L.toe.x, L.toe.y + 0.02, L.toe.z + (L.id[0] === 'F' ? -0.02 : 0.03), h * w, true, -0.5); } } },
  graze: graze(-0.6, -0.4),
  nibble: { dur: 2.0, a: 0.2, d: 0.8, fn(ctl, a, w) { const P = ctl.pose, b = ctl.b; P.rx(b.neck, -0.6 * w); P.rx(b.head, (-0.3 + Math.sin(a.t * 14) * 0.05) * w); ctl.jaw = Math.max(ctl.jaw, (0.1 + 0.1 * Math.sin(a.t * 14)) * w); } },
  situp: { dur: 2.4, a: 0.2, d: 0.8, fn(ctl, a, w) { // rear up on the haunches, look around
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.move(b.body, 0, 0.03 * w, 0.02 * w); P.rx(b.body, 0.7 * w); P.rx(b.neck, -0.4 * w); P.rot(b.head, -0.25 * w, Math.sin(t * 2) * 0.5 * w, 0);
    for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; if (L.id[0] === 'F') ov(L, L.toe.x, 0.05, L.toe.z + 0.02, w, true, -0.8); }
    ctl.ear = mix(ctl.ear, -0.3, w);
  } },
  groom: { dur: 2.6, a: 0.15, d: 0.85, fn(ctl, a, w) { // sits back and washes its face with both forepaws
    const P = ctl.pose, b = ctl.b, t = a.t, rub = Math.sin(t * 11);
    P.move(b.body, 0, 0.02 * w, 0.015 * w); P.rx(b.body, 0.55 * w); P.rx(b.neck, -0.25 * w); P.rx(b.head, (-0.35 + rub * 0.08) * w);
    for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; if (L.id[0] === 'F') ov(L, L.toe.x * 0.6, 0.1 + 0.015 * rub * L.side, L.toe.z - 0.035, w, true, -1.4); }
    ctl.ear = mix(ctl.ear, 0.4 + 0.3 * rub, w);
  } },
  thump: { dur: 0.9, a: 0.05, d: 0.85, fn(ctl, a, w) { // alarm: stamps a hind foot
    const P = ctl.pose, b = ctl.b, k = a.k, st = Math.max(bell(clamp01(k / 0.25)), bell(clamp01((k - 0.35) / 0.25)));
    P.rx(b.body, -0.12 * w); P.rx(b.head, 0.2 * w); ctl.ear = mix(ctl.ear, -0.5, w);
    const L = ctl.gait.legs[3]; ov(L, L.toe.x, 0.035 * st, L.toe.z + 0.01, st * w, true, -0.2);
  } },
  flee: { dur: 1, hold: true, fadeIn: 0.1, fadeOut: 0.5, fn(ctl, a, w) { ctl.ear = mix(ctl.ear, 1.4, w); ctl.pose.rx(ctl.b.tail[0], -0.6 * w); } },
  hit: qHit({ dur: 0.35 }),
  knockback: qKnockback({ dur: 0.6 }),
  stun: qStun(),
  death: qDeath({ lieY: 0.075, roll: 1.4, dist: 1.2, peak: 0.5 }),
};
const RABBIT_SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail'], ears: ['earL', 'earR'] },
  gait: {
    legs: [
      { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.04, 0, -0.09], body: 'chest', scap: 0.5, dutyMul: 0.45, lift: 0.04, flex: 0.6 },
      { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.04, 0, -0.09], body: 'chest', scap: 0.5, dutyMul: 0.45, lift: 0.04, flex: 0.6 },
      { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.055, 0, 0.0], body: 'hips', scap: 0.5, dutyMul: 0.7, lift: 0.04, flex: 0.8, metaK: 2, heel: 0.8 },
      { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.055, 0, 0.0], body: 'hips', scap: 0.5, dutyMul: 0.7, lift: 0.04, flex: 0.8, metaK: 2, heel: 0.8 },
    ],
    maxStride: 0.3, fMin: 0.8, actV: 0.15,
    gaits: [ // bounding hop: hind pair then fore pair, big hop arc
      { v: 0.8, f: 2.6, duty: 0.35, lift: 1, off: { RL: 0, RR: 0.02, FL: 0.4, FR: 0.43 }, bob: 0.035, bobF: 1, bobPh: 0.75, pitch: 0.25, pitchF: 1, pitchPh: 0.1, flex: 0.15, flexF: 1, flexPh: 0.3 },
      { v: 6, f: 5.2, duty: 0.25, lift: 1.3, off: { RL: 0, RR: 0.04, FL: 0.45, FR: 0.5 }, bob: 0.06, bobF: 1, bobPh: 0.75, pitch: 0.2, pitchF: 1, pitchPh: 0.1, flex: 0.25, flexF: 1, flexPh: 0.3 },
    ],
  },
  neck: { pitch: 0, run: 0.1, combat: 0, walk: 0 }, tail: { wag: 0.1, wagF: 3, run: 0.5 }, breathe: 0.03,
  fidgets: [{ name: 'situp', w: 2 }, { name: 'nibble', w: 3 }, { name: 'groom', w: 1 }, { name: 'hop', w: 1 }], fidgetGap: 2.5,
  pose(ctl) { // nose twitch; ears lie back when running
    const P = ctl.pose, b = ctl.b, tw = Math.sin(ctl.t * 30) * 0.02 * (Math.sin(ctl.t * 1.1) > 0 ? 1 : 0);
    P.rx(b.head, tw); ctl.ear = ctl.run * 1.0;
  },
  actions: RB_ACTIONS,
};

// ================================================================================================ cat
const CAT_PAL = {
  ginger: [0xd8843a, 0x9a4a1a, 0xf4e0c8], grey: [0x8a8c90, 0x4a4c52, 0xe8e6e2], black: [0x26262a, 0x121214, 0x3a3a3e],
  calico: [0xdad6ce, 0x2a2624, 0xd8843a], siamese: [0xe8dcc4, 0x4a3226, 0xf2eadc],
};
export const cat = {
  name: 'Cat',
  variants: ['ginger', 'grey', 'black', 'calico', 'siamese'],
  config(variant) {
    const v = CAT_PAL[variant] ? variant : 'ginger', p = CAT_PAL[v];
    return { variant: v, pal: { fur: p[0], stripe: p[1], belly: p[2] }, shapeKey: 'base', h: 0.027, scale: 1.1, mat: { dfreq: 7 }, ao: { dist: 0.02, str: 0.7 } };
  },
  rig(R) {
    R.add('body', null, [0, 0.25, 0.0]); R.add('hips', 'body', [0, 0.25, 0.12]); R.add('chest', 'body', [0, 0.26, -0.1]);
    R.add('neck', 'chest', [0, 0.3, -0.16]); R.add('head', 'neck', [0, 0.34, -0.21]); R.add('jaw', 'head', [0, 0.31, -0.25]);
    R.add('earL', 'head', [-0.033, 0.38, -0.21]); R.add('earR', 'head', [0.033, 0.38, -0.21]);
    R.add('tail1', 'hips', [0, 0.28, 0.17]); R.add('tail2', 'tail1', [0, 0.35, 0.24]); R.add('tail3', 'tail2', [0, 0.45, 0.27]); R.add('tail4', 'tail3', [0, 0.54, 0.26]);
    for (const s of [-1, 1]) {
      R.add(L2(s, 'fU'), 'chest', [s * 0.045, 0.2, -0.11]); R.add(L2(s, 'fL'), L2(s, 'fU'), [s * 0.045, 0.125, -0.085]); R.add(L2(s, 'fP'), L2(s, 'fL'), [s * 0.045, 0.03, -0.1]);
      R.add(L2(s, 'rT'), 'hips', [s * 0.045, 0.23, 0.12]); R.add(L2(s, 'rS'), L2(s, 'rT'), [s * 0.05, 0.145, 0.075]); R.add(L2(s, 'rM'), L2(s, 'rS'), [s * 0.05, 0.08, 0.15]); R.add(L2(s, 'rP'), L2(s, 'rM'), [s * 0.05, 0.022, 0.14]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, f = [0.3, 0, 0.1, 0];
    S.ell('body', [0, 0.245, 0.01], [0.055, 0.06, 0.13], { k: 0.035, col: c.fur, tag: 'body', dtl: f });
    S.ell('chest', [0, 0.24, -0.1], [0.05, 0.065, 0.055], { k: 0.03, col: c.fur, tag: 'body', dtl: f });
    S.ell('hips', [0, 0.25, 0.12], [0.05, 0.055, 0.055], { k: 0.03, col: c.fur, tag: 'body', dtl: f });
    S.cone('neck', [0, 0.26, -0.13], [0, 0.33, -0.2], 0.04, 0.032, { k: 0.02, col: c.fur, b2: 'head', dtl: f });
    S.ell('head', [0, 0.34, -0.215], [0.05, 0.043, 0.045], { k: 0.02, col: c.fur, tag: 'head', dtl: f });
    for (const s of [-1, 1]) S.ell('head', [s * 0.018, 0.322, -0.25], [0.018, 0.015, 0.016], { k: 0.012, col: c.belly, tag: 'muzzle', dtl: f });
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('rT' + n, [s * 0.045, 0.2, 0.11], [0.032, 0.056, 0.046], { k: 0.02, col: c.fur, rot: [0.3, 0, 0], dtl: f });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny] = v.n;
    v.mix(c.belly, sstep(-0.2, -0.7, ny) * 0.9 + v.t('muzzle') * 0.9);
    if (cfg.variant === 'calico') {
      const blob = Math.sin(x * 40 + 1) * Math.sin(z * 30) * Math.sin(y * 35 + 2);
      v.mix(c.stripe, sstep(0.2, 0.3, blob) * 0.9); v.mix(c.belly, sstep(0.2, 0.3, -blob) * 0.9 * sstep(0, 0.5, ny));
    } else if (cfg.variant === 'siamese') { // colour points: dark face mask, ears, paws, tail
      const mask = v.t('head') * sstep(-0.19, -0.25, z) * (1 - sstep(0.36, 0.38, y));
      v.mix(c.stripe, Math.max(mask * 0.85, v.t('tail') * sstep(0.3, 0.5, y), v.t('paw') * 0.8, v.t('leg') * sstep(0.12, 0.04, y) * 0.8));
    } else if (cfg.variant !== 'black') { // tabby stripes
      const st = Math.sin(z * 70 + Math.sin(y * 30) * 1.5 + (v.t('tail') > 0.5 ? y * 60 : 0));
      v.mix(c.stripe, sstep(0.55, 0.8, st) * sstep(-0.2, 0.4, ny + Math.abs(nx) * 0.3) * 0.75);
    }
    v.mix(0xc07078, (1 - sstep(0.008, 0.016, Math.hypot(x, y - 0.333, z + 0.262))) * 0.9); // nose
  },
  parts(acc, S, R, cfg) {
    const b = (n) => R.index(n), c = cfg.pal, v = cfg.variant;
    const legC = v === 'siamese' ? c.stripe : c.fur, pawC = v === 'siamese' ? c.stripe : c.belly;
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      // lower legs & paws as rigid sweeps
      const fur = col(c.fur), lc = col(legC);
      tube(acc, [[s * 0.045, 0.23, -0.112], [s * 0.045, 0.125, -0.085], [s * 0.045, 0.03, -0.1], [s * 0.045, 0.02, -0.104]], [0.026, 0.016, 0.012, 0.012],
        [b('fU' + n), b('fL' + n), b('fP' + n)], [[s * 0.045, 0.2, -0.11], [s * 0.045, 0.125, -0.085], [s * 0.045, 0.03, -0.1]], (u) => lerp3(fur, lc, sstep(0.55, 0.9, u)), { seg: 7, radial: 5 });
      paw(acc, b('fP' + n), [s * 0.045, 0.013, -0.108], [0.016, 0.012, 0.02], pawC);
      tube(acc, [[s * 0.045, 0.2, 0.105], [s * 0.05, 0.145, 0.075], [s * 0.05, 0.08, 0.15], [s * 0.05, 0.022, 0.14]], [0.022, 0.017, 0.013, 0.012],
        [b('rS' + n), b('rM' + n), b('rP' + n)], [[s * 0.05, 0.145, 0.075], [s * 0.05, 0.08, 0.15], [s * 0.05, 0.022, 0.14]], (u) => lerp3(fur, lc, sstep(0.6, 0.95, u)), { seg: 7, radial: 5 });
      paw(acc, b('rP' + n), [s * 0.05, 0.013, 0.128], [0.016, 0.012, 0.022], pawC);
      addEye(acc, S, b('head'), [s * 0.021, 0.35, -0.245], [s * 0.45, 0.05, -1], 0.0135, { iris: v === 'black' ? 0xf0d020 : v === 'siamese' ? 0x4aa0f0 : 0x9ad040, pupilA: 0.28, irisA: 0.95, seg: 8, irisEmis: 0.3, sink: 0.35, glint: false });
      ear(acc, b('ear' + n), [s * 0.03, 0.37, -0.21], [0.1, s * 0.3, -s * 0.3], 0.026, 0.05, 0.01, v === 'siamese' ? c.stripe : c.fur, 0xe0a8a0, 0.6, { nu: 4, nv: 4, tip: v === 'calico' || v === 'ginger' ? c.stripe : undefined, tipFrom: 0.7 });
      for (let i = 0; i < 3; i++) acc.add(sweep([[s * 0.02, 0.325 - i * 0.005, -0.255], [s * 0.08, 0.33 - i * 0.012, -0.24 + i * 0.01]], [0.0015, 0.0008], { radial: 3 }), { skin: rigid(b('head')), color: 0xf4f0e8, dtl: [0, 0, 0, 0] });
    }
    // tail: one smooth tube skinned along the 4-bone tail chain (tabby rings / dark tip / siamese point)
    const TP = [[0, 0.265, 0.13], [0, 0.27, 0.15], [0, 0.35, 0.24], [0, 0.45, 0.27], [0, 0.54, 0.26], [0, 0.6, 0.23]];
    tube(acc, TP, [0.018, 0.017, 0.015, 0.014, 0.013, 0.007], ['tail1', 'tail2', 'tail3', 'tail4'].map(b), [[0, 0.28, 0.17], [0, 0.35, 0.24], [0, 0.45, 0.27], [0, 0.54, 0.26]], (u, y) => {
      if (v === 'siamese') return lerp3(col(c.fur), col(c.stripe), sstep(0.15, 0.4, u));
      if (v === 'black') return col(c.fur);
      if (v === 'calico') return col(u > 0.5 ? c.stripe : c.fur);
      return lerp3(col(c.fur), col(c.stripe), Math.max(sstep(0.55, 0.8, Math.sin(u * 38)) * 0.8, sstep(0.88, 0.95, u)));
    }, { radial: 5, seg: 12, zone: 0.5 });
  },
  sockets: { head: ['head', [0, 0.4, -0.21]], mouth: ['jaw', [0, 0.31, -0.27]], center: ['body', [0, 0.25, 0.0]], back: ['body', [0, 0.31, 0.0]], chest: ['chest', [0, 0.23, -0.14]] },
  height: 0.42, radius: 0.15,
  controller(inst) { return new QuadCtl(inst, CAT_SPEC); },
  get actionList() { return CAT_ACTIONS; },
};
const catSit = (ctl, w) => {
  const P = ctl.pose, b = ctl.b;
  P.move(b.body, 0, -0.06 * w, 0.03 * w); P.rx(b.body, 0.75 * w); P.rx(b.neck, -0.35 * w); P.rx(b.head, -0.35 * w);
  for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], (i ? -0.3 : 0.9) * w, (i ? 0.5 : 0.3) * w, 0);
  for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; if (L.id[0] === 'R') ov(L, L.toe.x * 1.1, 0, 0.03, w, false, 0); else ov(L, L.toe.x * 0.8, 0, -0.1, w, false, 0); }
};
const CAT_ACTIONS = {
  sit: { dur: 1, hold: true, rest: true, fadeIn: 0.5, fadeOut: 0.3, fn(ctl, a, w) { catSit(ctl, w); } },
  lie: { dur: 1, hold: true, rest: true, fadeIn: 0.7, fadeOut: 0.4, fn(ctl, a, w) { // loaf: paws tucked, tail curled round
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.move(b.body, 0, -0.17 * w, 0); P.rx(b.neck, 0.1 * w); P.rot(b.head, -0.05 * w, Math.sin(t * 0.4) * 0.2 * w, 0);
    for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], (i ? -0.1 : 1.2) * w, (0.55 + 0.05 * Math.sin(t * 0.8 + i)) * w, 0);
    for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; ov(L, L.toe.x * 0.7, 0.03, L.toe.z * 0.7, w, true, -0.9); }
  } },
  groom: { dur: 3, a: 0.15, d: 0.85, fn(ctl, a, w) { // sit back a little, lift a paw to the mouth and lick it
    const P = ctl.pose, b = ctl.b, t = a.t, L = ctl.gait.legs[0];
    P.move(b.body, 0, -0.03 * w, 0.02 * w); P.rx(b.body, 0.3 * w);
    ov(L, L.toe.x * 0.3, 0.2, L.toe.z + 0.03, w, true, -1.6);
    P.rot(b.neck, -0.55 * w, 0.25 * w, 0); P.rot(b.head, (-0.45 + Math.sin(t * 12) * 0.1) * w, 0.35 * w, 0.25 * w);
    ctl.jaw = Math.max(ctl.jaw, (0.1 + 0.1 * Math.sin(t * 12)) * w);
  } },
  stretch: { dur: 2.4, a: 0.25, d: 0.7, fn(ctl, a, w) { const P = ctl.pose, b = ctl.b; P.move(b.body, 0, -0.03 * w, 0); P.rx(b.body, -0.35 * w); P.rx(b.chest, -0.1 * w); P.rx(b.head, 0.4 * w); ctl.jaw = Math.max(ctl.jaw, 0.4 * w * bell(a.k)); } },
  pounce: { dur: 1.3, a: 0.05, d: 0.9, fn(ctl, a, w) { // crouch, butt wiggle, spring forward & land
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const crouch = sstep(0, 0.2, k) * (1 - sstep(0.5, 0.58, k)), wig = crouch * sstep(0.2, 0.3, k) * Math.sin(t * 24) * 0.06;
    const leap = Math.sin(clamp01((k - 0.52) / 0.3) * Math.PI), fwd = sstep(0.52, 0.82, k) * (1 - sstep(0.85, 1, k));
    P.move(b.body, 0, (-0.07 * crouch + 0.16 * leap) * w, (0.02 * crouch - 0.28 * fwd) * w); P.rot(b.hips, 0, 0, wig * w);
    P.rx(b.body, (-0.1 * crouch + 0.25 * leap * (1 - k)) * w); P.rx(b.neck, -0.25 * crouch * w);
    for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; const fr = L.id[0] === 'F'; if (leap > 0.01) ov(L, L.toe.x, 0.05 * leap, L.toe.z + (fr ? -0.08 : 0.06) * leap, leap * w, true, -0.5); }
    ctl.ear = mix(ctl.ear, 0.8, crouch * w);
  } },
  hiss: { dur: 1.6, a: 0.08, d: 0.85, fn(ctl, a, w) { // Halloween-cat arch: back humped high, legs straight, fur puffed, ears flat
    const P = ctl.pose, b = ctl.b, e = sstep(0, 0.2, a.k) * (1 - sstep(0.8, 1, a.k)), ew = e * w;
    P.move(b.body, 0, 0.05 * ew, 0.01 * ew); P.rx(b.chest, 0.5 * ew); P.rx(b.hips, -0.5 * ew); P.rx(b.neck, -0.55 * ew); P.rot(b.head, 0.35 * ew, 0.25 * ew, 0);
    for (let i = 0; i < b.tail.length; i++) P.rx(b.tail[i], (i ? 0.05 : -0.9) * ew);
    P.sc[b.body].set(1 + 0.12 * ew, 1 + 0.22 * ew, 1); P.sc[b.chest].set(1 + 0.1 * ew, 1 + 0.12 * ew, 1);
    for (let li = 0, LL = ctl.gait.legs; li < LL.length; li++) { const L = LL[li]; ov(L, L.toe.x * 1.1, 0, L.toe.z * 0.85, ew, false, 0.1); }
    ctl.jaw = Math.max(ctl.jaw, 0.6 * ew); ctl.ear = mix(ctl.ear, -1.2, ew); ctl.hackle = Math.max(ctl.hackle, ew);
  } },
  meow: { dur: 1.1, a: 0.1, d: 0.8, fn(ctl, a, w) { const P = ctl.pose, b = ctl.b, j = bell(a.k); P.rx(b.neck, 0.2 * j * w); P.rx(b.head, 0.3 * j * w); ctl.jaw = Math.max(ctl.jaw, 0.4 * j * w); } },
  flee: { dur: 1, hold: true, fadeIn: 0.1, fadeOut: 0.5, fn(ctl, a, w) { ctl.ear = mix(ctl.ear, -1.0, w); ctl.hackle = w; } },
  hit: qHit({ dur: 0.35 }),
  knockback: qKnockback({ dur: 0.6 }),
  stun: qStun(),
  death: qDeath({ lieY: 0.13, roll: 1.4, dist: 1.2, peak: 0.45 }),
};
const CAT_SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3', 'tail4'], ears: ['earL', 'earR'] },
  gait: {
    legs: [
      { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.045, 0, -0.125], body: 'chest', scap: 0.5, lift: 0.04, flex: 1.2, heel: 0.4 },
      { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.045, 0, -0.125], body: 'chest', scap: 0.5, lift: 0.04, flex: 1.2, heel: 0.4 },
      { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.05, 0, 0.105], body: 'hips', scap: 0.45, lift: 0.04, flex: 0.9 },
      { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.05, 0, 0.105], body: 'hips', scap: 0.45, lift: 0.04, flex: 0.9 },
    ],
    maxStride: 0.25,
    gaits: [
      { v: 0.6, f: 2.0, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.004, bobF: 2, roll: 0.02, rollF: 1 },
      { v: 1.8, f: 3.2, duty: 0.45, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.008, bobF: 2 },
      { v: 5, f: 5.2, duty: 0.24, lift: 1.3, off: { RL: 0, RR: 0.08, FL: 0.45, FR: 0.55 }, bob: 0.03, bobF: 1, bobPh: 0.6, pitch: 0.12, pitchF: 1, flex: 0.2, flexF: 1, flexPh: 0.2 },
    ],
  },
  neck: { pitch: 0, run: -0.2, combat: -0.1 }, tail: { wag: 0.25, wagF: 0.7, run: -0.6, combat: -0.4 }, breathe: 0.02,
  fidgets: [{ name: 'groom', w: 2 }, { name: 'stretch', w: 1 }, { name: 'meow', w: 1 }], fidgetGap: 4,
  actions: CAT_ACTIONS,
};
