// The Deep Oracle — Abyssal Dungeon boss (gate 2). An eldritch horror rising from black water: a ribbed, leathery
// mantle-dome crowned with a single colossal eye (lids, glowing iris, slit pupil), a fringe of feelers around a
// beaked maw below it, rows of bioluminescent spots, and eight independent tentacles that break the surface around it.
// Everything below y = 0 is under the water (the arena's surface hides it).
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { col } from '../../kit/sdf.js';
import { K, rigid, skinMap } from './core/acc.js';
import { norm, cross, add, sub, addS, lerp3, dist, bezier, spline, hornPath, taper, loft, crystal, eyeball, grid } from './core/geo.js';
import { oracleSpec } from './deep_oracle_anim.js';

const C = {
  skin: 0x2a1838, skinDk: 0x120a1c, belly: 0x5a3a5a, sucker: 0xb07a9a, spot: 0x38ffe0, spot2: 0xb050ff,
  sclera: 0xd8dca0, iris: 0xffb020, lid: 0x1c1026, beak: 0x0c0a0e, feeler: 0x3a2048,
};
export const NTEN = 8, TSEG = 8;
export const J = { core: [0, 2.0, 0.6], body: [0, 3.4, 0.6], mantle: [0, 5.4, 1.0], eye: [0, 4.2, -1.05], lidU: [0, 4.2, -0.75], lidD: [0, 4.2, -0.75], jaw: [0, 2.2, -0.9] };
// tentacle roots: a ring around the body under the water, each rising in its own arc
export function tentacle(i) {
  const a = (i / NTEN) * Math.PI * 2 + Math.PI / NTEN;                 // around the body; 0 = front-right
  const R = 3.2 + (i % 2) * 0.9;
  const dir = [Math.sin(a), 0, -Math.cos(a)];
  const root = [dir[0] * R * 0.55, -2.2, dir[2] * R * 0.55 + 0.6];
  const rise = [dir[0] * R, 1.8 + (i % 3) * 0.6, dir[2] * R + 0.6];
  const tip = [dir[0] * (R + 2.2), 6.0 + (i % 2) * 1.2, dir[2] * (R + 2.2) + 0.6];
  const curl = add(tip, [dir[0] * -1.2, 0.8, dir[2] * -1.2]);
  return { pts: spline([root, rise, tip, curl], 8), a, dir };
}
const TEN = Array.from({ length: NTEN }, (_, i) => tentacle(i));
const polyAt = (P, s) => { const x = s * (P.length - 1), k = Math.min(P.length - 2, Math.floor(x)); return lerp3(P[k], P[k + 1], x - k); };
export const TSJ = Array.from({ length: TSEG }, (_, j) => j / TSEG);

function rig(R) {
  R.add('core', null, J.core); R.add('body', 'core', J.body); R.add('mantle', 'body', J.mantle);
  R.add('eye', 'body', J.eye); R.add('lidU', 'eye', J.lidU); R.add('lidD', 'eye', J.lidD); R.add('jaw', 'body', J.jaw);
  for (let i = 0; i < NTEN; i++) for (let j = 0; j < TSEG; j++) R.add(`t${i}_${j}`, j ? `t${i}_${j - 1}` : 'core', polyAt(TEN[i].pts, TSJ[j]));
}

const leather = [0, 0.18, 0.35, 0], soft = [0, 0.1, 0.3, 0];
function sculpt(S) {
  // body column rising out of the water, the great dome above, the eye socket carved into its face
  S.ell('core', [0, 1.4, 0.7], [2.3, 2.4, 2.1], { k: 0.5, col: C.skin, tag: 'body', dtl: leather });
  S.ell('body', [0, 3.6, 0.6], [2.2, 2.0, 2.0], { k: 0.6, col: C.skin, tag: 'body', dtl: leather });
  S.ell('mantle', [0, 5.6, 1.2], [1.9, 1.7, 2.2], { k: 0.6, col: C.skin, tag: 'dome', rot: [0.3, 0, 0], dtl: leather });
  // ribs down the dome
  for (let k = -3; k <= 3; k++) S.ell('mantle', [k * 0.55, 6.2 - Math.abs(k) * 0.35, 1.3], [0.16, 1.2, 1.7], { k: 0.25, col: C.skinDk, tag: 'rib', rot: [0.35, k * 0.18, k * 0.28], dtl: leather });
  // brow ridge over the eye
  S.ell('body', [0, 5.0, -0.8], [1.6, 0.45, 0.7], { k: 0.35, col: C.skinDk, tag: 'brow', rot: [-0.2, 0, 0], dtl: leather });
  for (const s of [-1, 1]) S.ell('body', [1.35 * s, 4.1, -0.7], [0.55, 0.9, 0.6], { k: 0.35, col: C.skin, tag: 'cheek', dtl: leather });
  S.ell('body', [0, 4.2, -1.3], [1.18, 1.05, 0.9], { k: 0.15, sub: true, col: C.skinDk, tag: 'socket' });
  // maw below: a beaked mouth ringed by lips
  S.ell('body', [0, 2.35, -1.5], [0.9, 0.6, 0.55], { k: 0.3, col: C.belly, tag: 'lips', dtl: soft });
  S.ell('body', [0, 2.3, -1.9], [0.55, 0.32, 0.5], { k: 0.12, sub: true, col: 0x1a0610, tag: 'mouth' });
}

function paint(v) {
  const [x, y, z] = v.p, [nx, ny, nz] = v.n;
  // mottled leathery hide with a violet sheen, darker in folds
  v.mul(1 + Math.sin(x * 3.1 + y * 2.3) * Math.sin(z * 2.7 - y * 1.9) * 0.15);
  v.mix(C.belly, sstep(-0.2, -0.8, nz) * sstep(3.2, 1.5, y) * 0.4);
  // bioluminescent spots in rows following the ribs + scattered freckles
  const cell = [Math.floor(x * 1.6), Math.floor(y * 1.6), Math.floor(z * 1.6)];
  const h = Math.sin(cell[0] * 127.1 + cell[1] * 311.7 + cell[2] * 74.7) * 43758.5453, r = h - Math.floor(h);
  const cx = (cell[0] + 0.5) / 1.6, cy = (cell[1] + 0.5) / 1.6, cz = (cell[2] + 0.5) / 1.6;
  const d = Math.hypot(x - cx, y - cy, z - cz);
  const spot = r > 0.72 ? 1 - sstep(0.08, 0.16 + r * 0.06, d) : 0;
  if (spot > 0.05 && y > 0.5) { v.kind = K.eye; v.emis = spot * 1.3; v.gm = r > 0.86 ? -1 : 1; v.mix(r > 0.86 ? C.spot2 : C.spot, spot * 0.8); }
  if (v.t('mouth') > 0.4) { v.mix(0x1a0610, 0.9); v.kind = K.mouth; v.emis = 0.8; v.gm = -0.8; }
  if (v.t('socket') > 0.4) v.mix(0x06030a, 0.7);
}

function dress({ acc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  // ---- the great eye: sclera, glowing iris ring, black slit pupil (eyeball uv: planar facing forward)
  const eyeC = [0, 4.2, -1.02], ER = 1.0;
  const e = eyeball(eyeC, ER, [0, 0, -1], [0, 1, 0], 20);
  acc.addRaw(e, {
    skin: rigid(b('eye')), kind: K.eye, dtl: [0, 0, 0.1, 0], gm: 0,
    color: (t, p, n, uv) => { const dx = uv[0] - 0.5, dy = uv[1] - 0.5, r = Math.hypot(dx, dy); if (t < 0.3) return C.sclera; if (Math.abs(dx) < 0.045 * (1 - Math.abs(dy) * 1.2) && r < 0.3) return 0x020104; return r < 0.3 ? lc(C.iris, 0xff5a10, sstep(0.1, 0.3, r)) : lc(C.sclera, 0x8a3a3a, sstep(0.3, 0.5, r) * 0.6); },
    emis: (t, p, uv) => { const dx = uv[0] - 0.5, dy = uv[1] - 0.5, r = Math.hypot(dx, dy); if (t < 0.3) return 0; if (Math.abs(dx) < 0.045 * (1 - Math.abs(dy) * 1.2) && r < 0.3) return 0; return r < 0.3 ? 1.6 * (1.1 - r * 2) : 0.03; },
  });
  // heavy eyelids (upper / lower) — shells slightly larger than the eye, rotating to blink / narrow
  for (const [bone, sgn] of [['lidU', 1], ['lidD', -1]]) {
    const lid = grid(16, 8, (u, vv) => {
      const ph = (u - 0.5) * Math.PI * 1.05, th = vv * Math.PI * 0.5;       // half-shell over the top (or bottom)
      const rr = ER * 1.1;
      return add(eyeC, [Math.sin(ph) * Math.cos(th) * rr, sgn * Math.sin(th) * rr * 0.98, -Math.cos(ph) * Math.cos(th) * rr]);
    }, { flip: sgn < 0 });
    acc.addRaw(lid, { skin: rigid(b(bone)), kind: K.skin, color: (t, p, n, uv) => lc(C.lid, C.skinDk, uv[1]), dtl: leather });
  }
  // ---- beak inside the maw and a fringe of feelers around it
  for (const s of [-1, 1]) acc.addRaw(loft(hornPath([0.25 * s, 2.3, -1.7], [-0.4 * s, -0.2, -1], 0.7, [0, 1, 0], s * 0.8, 5), 7, taper(0.22, { flat: 0.7 }), [0, 1, 0]), { skin: rigid(b('jaw')), kind: K.hard, color: C.beak, dtl: [0, 0, 0.1, 0] });
  for (let k = 0; k < 12; k++) {
    const a = (k / 11 - 0.5) * 2.4, base = [Math.sin(a) * 1.0, 2.1 - Math.cos(a) * 0.35, -1.45 - Math.cos(a) * 0.2];
    const path = hornPath(base, [Math.sin(a) * 0.5, -1, -0.3], 1.3 + 0.4 * Math.sin(k * 1.9) ** 2, [Math.cos(a), 0, 0], 0.9 * (k % 2 ? 1 : -1), 6);
    acc.addRaw(loft(path, 5, taper(0.1, { pow: 0.7 }), [0, 0, -1]), { skin: rigid(b('jaw')), kind: K.hair, color: (t) => lc(C.feeler, C.spot, Math.pow(t, 4)), emis: (t) => 1.2 * Math.pow(t, 6), gm: 1, dtl: soft, uv: (uv, t) => [uv[0], t] });
  }
  // ---- dome crest of barbs
  for (let k = 0; k < 7; k++) {
    const base = [0, 7.1 - k * 0.12 - Math.abs(k - 3) * 0.05, 0.2 + k * 0.45];
    acc.addRaw(crystal(base, norm([0, 1, 0.5 + k * 0.08]), 0.9 - Math.abs(k - 3) * 0.12, 0.18, 5, k), { skin: rigid(b('mantle')), kind: K.hard, color: (t) => lc(C.skinDk, C.spot2, Math.pow(t, 3)), emis: (t) => 0.8 * Math.pow(t, 4), gm: -1, dtl: [0, 0.1, 0.1, 0] });
  }
  // ---- eight tentacles: tapered lofts with a pale sucker underside and glowing tips, skinned along their chains
  for (let i = 0; i < NTEN; i++) {
    const P = TEN[i].pts;
    const bones = TSJ.map((_, j) => b(`t${i}_${j}`));
    const wAt = (s) => { let j = 0; while (j < TSEG - 1 && s > TSJ[j + 1]) j++; const s1 = j < TSEG - 1 ? TSJ[j + 1] : 1; const f = sstep(0.45, 1, (s - TSJ[j]) / (s1 - TSJ[j])); const m = {}; m[bones[j]] = 1 - (j < TSEG - 1 ? f : 0); if (j < TSEG - 1) m[bones[j + 1]] = f; return skinMap(m); };
    const r0 = 0.72 - (i % 2) * 0.1;
    const up0 = norm([-TEN[i].dir[0], 0.3, -TEN[i].dir[2]]);    // "inner" side faces the body → suckers
    const m = loft(P, 10, (t) => { const r = r0 * Math.pow(1 - t, 0.9) + 0.03; return [r, r]; }, up0);
    acc.addRaw(m, {
      skin: (p, t) => wAt(t), kind: K.skin, dtl: leather,
      color: (t, p, n, uv) => { const inner = Math.cos(uv[0] * Math.PI * 2 - Math.PI / 2); const suck = inner > 0.55 ? (0.5 + 0.5 * Math.sin(t * 90)) : 0; return lc(lc(C.skin, C.skinDk, Math.pow(t, 2) * 0.5), C.sucker, suck * 0.8); },
    });
    // glowing spots along the outer side + a bioluminescent tip lure
    for (let k = 0; k < 8; k++) {
      const s = 0.2 + k * 0.09, p = polyAt(P, s), q = polyAt(P, s + 0.01);
      const T = norm(sub(q, p)), out = norm(cross(T, cross(up0, T))).map(v => -v);
      const r = r0 * Math.pow(1 - s, 0.9) + 0.03;
      if (k % 2 === 0) acc.addRaw(eyeball(addS(p, out, r * 0.95), 0.045 + 0.035 * (1 - s), out, [0, 1, 0], 5), { skin: wAt(s), kind: K.eye, color: C.spot, emis: 1.2, gm: 1, dtl: [0, 0, 0, 0] });
    }
    acc.addRaw(eyeball(polyAt(P, 0.985), 0.16, norm(sub(polyAt(P, 1), polyAt(P, 0.95))), [0, 1, 0], 6), { skin: wAt(0.99), kind: K.eye, color: C.spot2, emis: 2.4, gm: -1, dtl: [0, 0, 0, 0] });
  }
}

export const deep_oracle = {
  info: {
    name: 'The Deep Oracle', title: 'Eye of the Sunken Abyss', height: 7.4, radius: 3.6, burrowDepth: 11,
    parts: ['eye'],
    actions: {
      idle: { dur: 5, hits: [], loop: true },
      intro: { dur: 6.5, hits: [4.6] },
      tentacle_slam: { dur: 2.4, hits: [1.35] },
      tentacle_sweep: { dur: 2.6, hits: [1.3] },
      gaze: { dur: 3.6, hits: [1.2, 1.6, 2.0, 2.4, 2.8] },
      summon: { dur: 3.0, hits: [1.6] },
      roar: { dur: 2.4, hits: [1.0] },
      channel: { dur: 2.4, hits: [1.2], loop: true },
      submerge: { dur: 2.4, hits: [] },
      emerge: { dur: 2.2, hits: [0.6] },
      groggy: { dur: 3.5, hits: [], loop: true },
      death: { dur: 4.5, hits: [], hold: true },
    },
  },
  config() { return { h: 0.1, ao: { dist: 0.15, str: 0.85 }, grad: { top: 0.15, bottom: 0.35, y0: 0, y1: 4, low: 0.3 }, dtl: [0, 0.2, 0.3, 0], boundsMul: 2.0 }; },
  rig, sculpt, paint, dress,
  look: { glow: 0x38ffe0, glowI: 1.6, glow2: 0xb050ff, glow2I: 1.8, pulse: 1.3, dfreq: 0.9, enrage: 0xff2050, flash: 0xb050ff, ghost: 0x9a7aff },
  mat: { body: { rim: 0.35, rimColor: 0xc0a0ff, spec: 0.5, shine: 24 } },
  sockets: {
    head: ['mantle', [0, 7.2, 0.8]], eye: ['eye', [0, 4.2, -2.05]], mouth: ['jaw', [0, 2.3, -2.0]], chest: ['body', [0, 3.2, -1.3]], back: ['mantle', [0, 6.5, 2.0]],
    handL: ['t6_7', polyAt(TEN[6].pts, 1)], handR: ['t1_7', polyAt(TEN[1].pts, 1)], weapon: ['t0_7', polyAt(TEN[0].pts, 0.9)], weaponTip: ['t0_7', polyAt(TEN[0].pts, 1)],
    ...Object.fromEntries(Array.from({ length: NTEN }, (_, i) => ['tentacle' + i, [`t${i}_7`, polyAt(TEN[i].pts, 1)]])),
  },
};
deep_oracle.breakable = { eye: { socket: 'eye' } };
deep_oracle.spec = oracleSpec(J, { NTEN, TSEG, TEN });
