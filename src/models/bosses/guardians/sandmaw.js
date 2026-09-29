// Sandmaw — colossal sand wurm guardian (~16 m long, rears ~9 m out of the sand). Mostly submerged: the root sits on
// the sand where it breaches and everything below y = 0 is hidden by the ground. Overlapping sandstone armour rings,
// a dorsal ridge of chitin spikes, a ring-toothed maw that blooms open on four armoured mandible petals, a glowing
// amber gullet, and sandfall pouring from its plates while it moves.
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { col } from '../../kit/sdf.js';
import { K, rigid, skinMap } from './core/acc.js';
import { norm, cross, add, sub, addS, lerp3, dist, bezier, hornPath, taper, loft, crystal, grid } from './core/geo.js';
import { sandmawSpec } from './sandmaw_anim.js';

const C = {
  plate: 0xc8a068, plateDk: 0x6a4a2c, groove: 0x3a2616, flesh: 0xa86a52, fleshDk: 0x5a2a20, spike: 0x4a3420, spikeTip: 0xe8d6b0,
  tooth: 0xf0e6d0, toothBase: 0x8a6a4a, gullet: 0x6a1a08, sand: 0xd8b67a,
  back: 0x7a4424, band: 0x2e1a0e, belly: 0xe2cc98,
};
export const NS = 14;
// spine: an S-curve rising out of the sand, the maw facing forward and a little down
const SPINE = bezier([[0, -4.6, 0.35], [0, 3.4, 0.2], [0, 8.4, -2.0], [0, 8.3, -5.4]], 80);
const ACC = [0]; for (let i = 1; i < SPINE.length; i++) ACC.push(ACC[i - 1] + dist(SPINE[i], SPINE[i - 1]));
export const LEN = ACC[ACC.length - 1];
export function spineAt(s) { // s: 0..1 arc fraction → point
  const d = s * LEN; let i = 1; while (i < ACC.length - 1 && ACC[i] < d) i++;
  return lerp3(SPINE[i - 1], SPINE[i], (d - ACC[i - 1]) / (ACC[i] - ACC[i - 1] || 1));
}
export const SEGS = Array.from({ length: NS + 1 }, (_, i) => spineAt(i / NS * 0.94)); // seg0..seg13 + head joint
const HEAD = SEGS[NS];
const TIP = spineAt(1);
const FWD = norm(sub(TIP, HEAD));
export const dorsal = (T) => norm([0, -T[2], T[1]]);   // back side of the body for a spine tangent T (x = 0 plane)
const radius = (s) => 1.5 - 0.28 * sstep(0.3, 0.8, s) + 0.2 * sstep(0.85, 1.0, s);

function rig(R) {
  for (let i = 0; i < NS; i++) R.add('seg' + i, i ? 'seg' + (i - 1) : null, SEGS[i]);
  R.add('head', 'seg' + (NS - 1), HEAD);
  const Rt = norm(cross([0, 1, 0], FWD)), Up = cross(FWD, Rt);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; R.add('petal' + k, 'head', addS(addS(TIP, FWD, -0.05), add(Rt.map(v => v * Math.cos(a)), Up.map(v => v * Math.sin(a))), 1.3)); }
}

const armor = [0, 0.3, 0.3, 0], fleshD = [0, 0.05, 0.3, 0];
function sculpt(S) {
  // body: tapering tube along the spine + one armour ring per segment (overlapping bands with deep grooves)
  const N = 30;
  for (let i = 0; i < N; i++) {
    const s0 = i / N, s1 = (i + 1) / N;
    const a = spineAt(s0), b = spineAt(s1);
    const si = Math.min(NS - 1, Math.floor(s0 / 0.94 * NS));
    const bone = s0 >= 0.94 ? 'head' : 'seg' + si;
    S.cone(bone, a, b, radius(s0), radius(s1), { k: 0.25, col: C.flesh, tag: 'body', dtl: fleshD });
  }
  for (let i = 1; i < NS; i++) {
    // armour shingles overlapping towards the tail: each flares into a lip on its lower edge
    const s = i / NS * 0.94;
    const a = spineAt(s + 0.026), c = spineAt(Math.max(0, s - 0.03));
    S.cone('seg' + i, a, c, radius(s) * 1.02, radius(s) * 1.17, { k: 0.06, col: C.plate, tag: 'ring', dtl: armor });
    const T = norm(sub(spineAt(s + 0.01), spineAt(s - 0.01)));
    const back = dorsal(T);
    S.ell('seg' + i, addS(spineAt(s), back, radius(s) * 0.85), [radius(s) * 0.5, 0.42, radius(s) * 0.35], { k: 0.12, col: C.plateDk, tag: 'ridge', dir: T, dtl: armor });
  }
  // head collar: a heavy armoured ring the beak petals hinge on
  const cp = spineAt(0.975);
  S.cone('head', spineAt(0.955), addS(TIP, FWD, -0.05), radius(0.95) * 1.1, 1.42, { k: 0.1, col: C.plate, tag: 'collar', dtl: armor });
  S.cone('head', addS(TIP, FWD, -1.9), addS(TIP, FWD, 0.4), 0.55, 1.18, { k: 0.1, sub: true, col: C.gullet, tag: 'maw' });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) S.ell('head', add(addS(cp, FWD, 0.2 - k * 0.35), [s * 1.38, 0.35 + k * 0.1, 0]), [0.11, 0.09, 0.11], { k: 0.03, sub: true, col: 0x201008, tag: 'pit' });
}

// spine samples for paint: nearest point → arc fraction + dorsal direction (two-tone back/belly and banding)
const SAMP = SPINE.map((p, i) => ({ p, s: ACC[i] / LEN, d: dorsal(norm(sub(SPINE[Math.min(SPINE.length - 1, i + 1)], SPINE[Math.max(0, i - 1)]))) }));
function nearest(p) {
  let bi = 0, bd = 1e9;
  for (let i = 0; i < SAMP.length; i++) { const q = SAMP[i].p, d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
  return SAMP[bi];
}
function paint(v) {
  const [x, y, z] = v.p, [nx, ny, nz] = v.n;
  // armour rings: sandstone with darker bands near the grooves; soft flesh in between shows as dark folds
  const ring = v.t('ring') + v.t('ridge') + v.t('collar');
  v.mix(C.groove, (1 - Math.min(1, ring * 1.6)) * 0.9);
  // two-tone hide: dark rust-umber saddle down the back with chevron bands per ring, pale scuted belly
  const sp = nearest(v.p), dor = nx * sp.d[0] + ny * sp.d[1] + nz * sp.d[2];
  const back = sstep(-0.15, 0.55, dor) * Math.min(1, ring + 0.3), belly = sstep(0.05, -0.6, dor);
  v.mix(C.back, back * 0.7);
  const ph = sp.s / 0.94 * NS + 0.22 * Math.abs(x), f = ph - Math.floor(ph);
  v.mix(C.band, back * sstep(0.42, 0.6, f) * (1 - sstep(0.76, 0.94, f)) * 0.7 * sstep(0.12, 0.3, sp.s));
  v.mix(C.belly, belly * 0.55 * Math.min(1, ring + 0.2));
  // lighter wind-scoured crests on top, darker underside
  v.mix(C.sand, sstep(0.3, 0.9, ny) * Math.min(1, ring) * 0.3);
  v.mix(C.plateDk, sstep(0.0, -0.8, ny) * 0.3);
  // mottled weathering streaks
  const st = Math.sin(y * 3.7 + Math.sin(x * 2.1) * 1.5) * Math.sin(z * 2.9 + x);
  v.mul(1 + st * 0.08);
  if (v.t('maw') > 0.4) { v.mix(C.gullet, 0.9); v.kind = K.mouth; v.emis = 0.4 + 1.4 * sstep(0.2, 0.9, v.t('maw')); v.gm = 0.8; }
  if (v.t('pit') > 0.4) { v.mix(0x3a1a08, 0.9); v.kind = K.eye; v.emis = 1.2; v.gm = 0.6; }
}

function dress({ acc, facc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  const head = b('head');
  // local frame of the maw
  const Fw = FWD, Rt = norm(cross([0, 1, 0], Fw)), Up = cross(Fw, Rt);
  const mawC = addS(TIP, Fw, -0.2);
  // ---- four armoured beak petals: closed they form a pointed drill, open they bloom back into a toothed flower
  const RIM = 1.34, PL = 2.3;
  for (let k = 0; k < 4; k++) {
    const a0 = k / 4 * Math.PI * 2, a1 = a0 + Math.PI / 2 * 0.97;
    const petal = (inner) => grid(8, 10, (u, vv) => {
      const a = a0 + (a1 - a0) * u + (inner ? 0 : 0);
      const radial = add(Rt.map(q => q * Math.cos(a)), Up.map(q => q * Math.sin(a)));
      const R = RIM * Math.pow(1 - vv, 0.85) * (1 + 0.08 * Math.sin(vv * Math.PI)) - (inner ? 0.16 * (1 - vv * 0.8) : 0);
      const edge = Math.pow(Math.abs(u - 0.5) * 2, 6) * 0.06;
      return addS(addS(TIP, Fw, vv * PL - 0.05), radial, Math.max(0.02, R - edge));
    }, { flip: inner });
    const pk = rigid(b('petal' + k));
    acc.addRaw(petal(false), { skin: pk, kind: K.hard, dtl: armor, color: (t, p, n, uv) => lc(lc(C.plate, C.sand, 0.3 * Math.sin(uv[1] * 9) ** 2), C.plateDk, sstep(0.55, 1, uv[1]) * 0.7 + Math.pow(Math.abs(uv[0] - 0.5) * 2, 5) * 0.5) });
    acc.addRaw(petal(true), { skin: pk, kind: K.mouth, dtl: fleshD, color: (t, p, n, uv) => lc(C.flesh, C.fleshDk, uv[1]), emis: (t, p, uv) => 0.15 * (1 - uv[1]), gm: 0.6 });
    // hooked teeth rows on the inner face
    for (let row = 0; row < 3; row++) for (let j = 0; j < 3; j++) {
      const vv = 0.12 + row * 0.24, a = a0 + (a1 - a0) * (0.2 + j * 0.3);
      const radial = add(Rt.map(q => q * Math.cos(a)), Up.map(q => q * Math.sin(a)));
      const R = RIM * Math.pow(1 - vv, 0.85) - 0.2;
      const fb = addS(addS(TIP, Fw, vv * PL), radial, R);
      const dir = add(radial.map(q => -q), Fw.map(q => -q * 0.35));
      acc.addRaw(loft(hornPath(fb, dir, 0.5 - row * 0.1, cross(dir, Fw), -0.6, 4), 5, taper(0.085 - row * 0.015), Fw), { skin: pk, kind: K.hard, color: (t) => lc(C.toothBase, C.tooth, t), dtl: [0, 0, 0, 0] });
    }
  }
  // ---- concentric rings of teeth inside the maw
  for (let ring = 0; ring < 3; ring++) {
    const depth = 0.25 + ring * 0.5, rr = 0.95 - ring * 0.2, n = 16 - ring * 3;
    for (let k = 0; k < n; k++) {
      const a = (k + ring * 0.5) / n * Math.PI * 2;
      const radial = norm(add(Rt.map(v => v * Math.cos(a)), Up.map(v => v * Math.sin(a))));
      const base = addS(addS(TIP, Fw, -depth), radial, rr);
      const dir = add(radial.map(v => -v * 0.8), Fw.map(v => -v * 0.45));
      acc.addRaw(loft(hornPath(base, dir, 0.42 - ring * 0.08, cross(dir, Fw), -0.3, 3), 5, taper(0.075 - ring * 0.012), Fw), { skin: rigid(head), kind: K.hard, color: (t) => lc(C.toothBase, C.tooth, t), dtl: [0, 0, 0, 0] });
    }
  }
  // glowing gullet disc deep inside
  acc.addRaw(grid(10, 3, (u, vv) => { const a = u * Math.PI * 2, r = 0.6 * (1 - vv); return add(addS(TIP, Fw, -1.75 + vv * 0.1), add(Rt.map(q => q * Math.cos(a) * r), Up.map(q => q * Math.sin(a) * r))); }, { flip: true }), { skin: rigid(head), kind: K.mouth, color: 0xff8a30, emis: 2.2, gm: 0.9, dtl: [0, 0, 0, 0] });
  // ---- dorsal chitin spikes (one or two per segment) and flank barbs
  let sd = 1;
  for (let i = 2; i < NS; i++) {
    const s = i / NS * 0.94 + 0.03;
    const p = spineAt(s), T = norm(sub(spineAt(s + 0.01), spineAt(s - 0.01)));
    const back = dorsal(T);
    const r = radius(s) * 1.1;
    const base = addS(p, back, r * 0.95);
    const L = 1.5 + 0.5 * Math.sin(i * 0.7);
    acc.addRaw(crystal(base, norm(add(back, T.map(v => -v * 0.5))), L, 0.3, 5, sd++), { skin: rigid(b('seg' + i)), kind: K.hard, color: (t) => lc(C.spike, C.spikeTip, Math.pow(t, 1.5)), dtl: [0, 0.2, 0.2, 0] });
    for (const s2 of [-1, 1]) {
      const side = norm(cross(T, back)).map(v => v * s2);
      const bb = addS(addS(p, side, r * 0.95), back, r * 0.3);
      acc.addRaw(crystal(bb, norm(add(add(side, back.map(v => v * 0.4)), T.map(v => -v * 0.3))), 0.55, 0.13, 4, sd++), { skin: rigid(b('seg' + i)), kind: K.hard, color: (t) => lc(C.spike, C.spikeTip, t), dtl: [0, 0.2, 0.2, 0] });
    }
  }
  // collar spines: a ring of chitin hooks raking back from the collar
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2 + 0.3;
    const radial = add(Rt.map(q => q * Math.cos(a)), Up.map(q => q * Math.sin(a)));
    const base = addS(addS(TIP, Fw, -0.55), radial, 1.36);
    acc.addRaw(crystal(base, norm(add(radial, Fw.map(q => -q * 0.9))), 0.85 + 0.25 * (k % 2), 0.16, 5, k), { skin: rigid(head), kind: K.hard, color: (t) => lc(C.spike, C.spikeTip, t), dtl: [0, 0.2, 0.2, 0] });
  }
  // ---- sandfall: translucent streams pouring off the upper rings (additive-free dust layer lives in the flame mesh
  // with a sand colour and very low emission so it reads as bright falling sand in the sun)
  for (let i = 6; i < NS; i += 2) for (const s2 of [-1, 1]) {
    const s = i / NS * 0.94;
    const p = spineAt(s), T = norm(sub(spineAt(s + 0.01), spineAt(s - 0.01)));
    const back = dorsal(T), side = norm(cross(T, back)).map(v => v * s2);
    const top = addS(addS(p, side, radius(s) * 1.02), back, 0.3);
    const m = grid(3, 10, (u, vv) => add(addS(top, back, (u - 0.5) * 0.8), [s2 * vv * 0.35, -vv * 6, vv * 0.25]));
    facc.addRaw(m, { skin: rigid(b('seg' + i)), kind: K.flame, color: C.sand, emis: 0.18, gm: 1, dtl: [0, 0, 0, 0], uv: (uv) => [uv[0], uv[1]] });
  }
}

export const sandmaw = {
  info: {
    name: 'Sandmaw', title: 'the Dune Devourer', height: 9.8, radius: 3.2, length: 16, burrowDepth: 17,
    parts: ['mandible'],
    actions: {
      idle: { dur: 5, hits: [], loop: true },
      intro: { dur: 6.0, hits: [1.0, 4.4] },
      burrow: { dur: 2.6, hits: [1.3] },
      emerge: { dur: 2.4, hits: [0.5] },
      bite: { dur: 1.9, hits: [1.02] },
      tail_sweep: { dur: 2.6, hits: [1.35] },
      sand_spit: { dur: 2.3, hits: [0.95, 1.3, 1.65] },
      sandstorm: { dur: 4.2, hits: [1.4, 2.0, 2.6, 3.2] },
      roar: { dur: 2.4, hits: [1.0] },
      channel: { dur: 2.4, hits: [1.2], loop: true },
      groggy: { dur: 3.5, hits: [], loop: true },
      death: { dur: 4.0, hits: [], hold: true },
    },
  },
  config() { return { h: 0.105, ao: { dist: 0.14, str: 0.8 }, grad: { top: 0.14, bottom: 0.3, y0: 0, y1: 4, low: 0.2 }, dtl: [0, 0.25, 0.3, 0], boundsMul: 2.0 }; },
  rig, sculpt, paint, dress,
  look: { glow: 0xff9a3a, glowI: 1.8, glow2: 0xffd08a, glow2I: 1.2, pulse: 1.4, dfreq: 0.8, enrage: 0xff3a10, flash: 0xffc070 },
  mat: { body: { rim: 0.25, rimColor: 0xffe0b0, spec: 0.2, shine: 20 }, flame: {} },
  sockets: {
    head: ['head', add(HEAD, [0, 1.6, 0])], mouth: ['head', addS(TIP, FWD, -0.4)], chest: ['seg6', SEGS[6]], back: ['seg9', add(SEGS[9], [0, 0, 1.5])],
    handL: ['head', add(HEAD, [-1.4, 0, 0])], handR: ['head', add(HEAD, [1.4, 0, 0])], weapon: ['head', TIP], weaponTip: ['head', addS(TIP, FWD, 1.2)],
    base: ['seg4', [0, 0, 0.3]],
  },
};
sandmaw.breakable = { mandible: { bone: 'petal0', socket: 'mouth' } };
sandmaw.spec = sandmawSpec({ NS, SEGS, HEAD, TIP, FWD, spineAt });
