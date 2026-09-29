// Nerissa of the Drowned Choir — Abyssal Dungeon boss (gate 1). A ~5.5 m siren floating above the flooded oratory:
// a slender, mask-faced upper body in nacre shell armour, a long serpentine tail with dorsal fins and a fluke, drifting
// hair fronds with bioluminescent tips, a branching coral crown (breakable 'crown') and glowing song-runes that pulse
// with her voice.
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { col } from '../../kit/sdf.js';
import { K, rigid, skinMap } from './core/acc.js';
import { norm, cross, add, sub, addS, lerp3, dist, bezier, spline, hornPath, taper, loft, crystal, eyeball, grid } from './core/geo.js';
import { nerissaSpec } from './nerissa_anim.js';

const C = {
  skin: 0x9fd6cc, skinDk: 0x4a8a8a, tail: 0x1d6670, tailDk: 0x0e3440, belly: 0xc8ece0, nacre: 0xece4f4, nacreDk: 0x9a8cb8,
  hair: 0x1a3450, hairTip: 0x3af0e0, coral: 0xe0406a, coralTip: 0xffb0d0, fin: 0x2a8a90, finEdge: 0x9af0e8, rune: 0x40fff0, eye: 0xd0fff8,
  lips: 0x2a5a66, nail: 0xe0f0f0,
};
export const J = {
  hips: [0, 3.25, 0], spine: [0, 3.75, 0.02], chest: [0, 4.3, 0.02], neck: [0, 4.82, -0.02], head: [0, 5.05, -0.05], jaw: [0, 4.98, -0.2],
  crown: [0, 5.52, 0.0],
  sh: [0.42, 4.58, 0.02], el: [0.72, 3.98, 0.12], wr: [0.8, 3.38, -0.05], hand: [0.8, 3.1, -0.12],
  tail: [[0, 2.72, 0.05], [0, 2.15, 0.28], [0, 1.6, 0.66], [0, 1.15, 1.2], [0.05, 0.82, 1.85], [0.2, 0.62, 2.55], [0.55, 0.5, 3.2], [1.05, 0.4, 3.72], [1.65, 0.3, 4.05], [2.3, 0.24, 4.2]],
  fluke: [2.95, 0.2, 4.25],
};
export const NT = 10, NH = 9, HB = 4;
const X = (p, s) => [p[0] * s, p[1], p[2]];
const SIDES = [[-1, 'L'], [1, 'R']];
// hair fronds: from the back of the skull, flowing back and down over the shoulders
function hairPts(i) {
  const a = (i - (NH - 1) / 2) / ((NH - 1) / 2);         // -1..1 across the back of the head
  const root = [a * 0.19, 5.26 - Math.abs(a) * 0.1, 0.06 + (1 - Math.abs(a)) * 0.06];
  const L = 2.9 - Math.abs(a) * 0.6;
  return bezier([root, [a * 0.38, 5.2, 0.5], [a * 0.55, 4.7 - L * 0.15, 0.7], [a * 0.62 + Math.sin(i * 1.7) * 0.12, 5.05 - L, 0.62 + (1 - Math.abs(a)) * 0.35]], 16);
}
const HAIR = Array.from({ length: NH }, (_, i) => hairPts(i));
const polyAt = (P, s) => { const x = s * (P.length - 1), k = Math.min(P.length - 2, Math.floor(x)); return lerp3(P[k], P[k + 1], x - k); };
const HS = [0, 0.3, 0.55, 0.78];
const TAILPTS = spline([...J.tail, J.fluke], 6);

function rig(R) {
  R.add('hips', null, J.hips); R.add('spine', 'hips', J.spine); R.add('chest', 'spine', J.chest);
  R.add('neck', 'chest', J.neck); R.add('head', 'neck', J.head); R.add('jaw', 'head', J.jaw); R.add('crown', 'head', J.crown);
  for (const [s, n] of SIDES) { R.add('arm' + n, 'chest', X(J.sh, s)); R.add('fore' + n, 'arm' + n, X(J.el, s)); R.add('hand' + n, 'fore' + n, X(J.wr, s)); }
  for (let i = 0; i < NT; i++) R.add('tail' + i, i ? 'tail' + (i - 1) : 'hips', J.tail[i]);
  for (let i = 0; i < NH; i++) for (let j = 0; j < HB; j++) R.add(`h${i}_${j}`, j ? `h${i}_${j - 1}` : 'head', polyAt(HAIR[i], HS[j]));
}

const skinD = [0, 0.05, 0.15, 0], scale = [0, 0.4, 0.15, 0], shellD = [0, 0.1, 0.2, 0.3];
function sculpt(S) {
  // tail: serpentine, flattening a little towards the fluke; hips flare into it
  const tr = (f) => 0.4 - f * 0.031 + 0.05 * Math.exp(-f * 0.7);
  S.ell('hips', [0, 3.1, 0.02], [0.44, 0.5, 0.36], { k: 0.2, col: C.tail, tag: 'hips', dtl: scale });
  // sculpted along the smooth spline through the joints (no knuckles where segments meet)
  const per = (TAILPTS.length - 1) / NT;
  for (let k = 0; k < TAILPTS.length - 1; k++) {
    const f0 = k / per, f1 = (k + 1) / per, bi = Math.min(NT - 1, Math.floor(f0));
    S.cone('tail' + bi, TAILPTS[k], TAILPTS[k + 1], tr(f0), tr(f1), { k: 0.06, col: C.tail, tag: 'tail', dtl: scale });
  }
  // torso: narrow waist, ribcage, nacre bodice sculpted as raised shells
  S.ell('spine', [0, 3.72, 0.02], [0.3, 0.42, 0.24], { k: 0.16, col: C.skin, tag: 'waist', dtl: skinD });
  S.ell('chest', [0, 4.3, 0.02], [0.4, 0.36, 0.27], { k: 0.16, col: C.skin, tag: 'ribs', dtl: skinD });
  for (const s of [-1, 1]) S.ell('chest', [0.16 * s, 4.3, -0.16], [0.17, 0.16, 0.13], { k: 0.08, col: C.nacre, tag: 'shell', rot: [0.2, s * 0.35, 0], dtl: shellD });
  S.ell('chest', [0, 4.08, -0.14], [0.22, 0.16, 0.1], { k: 0.08, col: C.nacre, tag: 'shell', dtl: shellD });
  S.ell('hips', [0, 3.35, -0.22], [0.3, 0.2, 0.1], { k: 0.1, col: C.nacre, tag: 'belt', dtl: shellD });
  // shoulders with shell pauldrons
  for (const [s, n] of SIDES) {
    const sh = X(J.sh, s), el = X(J.el, s), wr = X(J.wr, s), hd = X(J.hand, s);
    S.ell('chest', add(sh, [-0.05 * s, 0.04, 0]), [0.2, 0.18, 0.18], { k: 0.1, col: C.skin, tag: 'shoulder', dtl: skinD });
    S.ell('arm' + n, add(sh, [0.06 * s, 0.1, 0]), [0.22, 0.14, 0.22], { k: 0.06, col: C.nacre, tag: 'pauldron', rot: [0, 0, -0.35 * s], dtl: shellD });
    S.cone('arm' + n, sh, el, 0.12, 0.09, { k: 0.06, col: C.skin, tag: 'arm', b2: 'fore' + n, t0: 0.85, t1: 1, dtl: skinD });
    S.cone('fore' + n, el, wr, 0.09, 0.065, { k: 0.05, col: C.skin, tag: 'fore', b2: 'hand' + n, t0: 0.85, t1: 1, dtl: skinD });
    S.ell('hand' + n, lerp3(wr, hd, 0.4), [0.07, 0.13, 0.05], { k: 0.04, col: C.skin, tag: 'hand', dtl: skinD });
  }
  // neck + head: long neck, porcelain mask face
  S.cone('neck', [0, 4.6, 0.0], J.head, 0.1, 0.085, { k: 0.08, col: C.skin, tag: 'neck', b2: 'head', t0: 0.6, t1: 1, dtl: skinD });
  S.ell('head', [0, 5.14, -0.05], [0.18, 0.23, 0.2], { k: 0.08, col: C.skin, tag: 'head', dtl: skinD });
  S.ell('head', [0, 5.04, -0.16], [0.13, 0.13, 0.12], { k: 0.07, col: C.skin, tag: 'face', dtl: skinD });
  S.cone('head', [0, 5.12, -0.22], [0, 5.02, -0.27], 0.03, 0.022, { k: 0.03, col: C.skin, tag: 'nose', dtl: skinD });
  for (const s of [-1, 1]) {
    S.ell('head', [0.075 * s, 5.14, -0.2], [0.05, 0.03, 0.03], { k: 0.02, sub: true, col: 0x0a2020, tag: 'socket' });
    S.cone('head', [0.14 * s, 5.13, -0.05], [0.3 * s, 5.2, 0.12], 0.05, 0.01, { k: 0.04, col: C.fin, tag: 'earfin', dtl: skinD });
  }
  S.ell('head', [0, 4.995, -0.2], [0.05, 0.022, 0.05], { k: 0.015, sub: true, col: 0x0a1418, tag: 'mouth' });
  S.ell('jaw', [0, 4.96, -0.19], [0.075, 0.04, 0.06], { group: 1, k: 0.02, col: C.skin, tag: 'chin', dtl: skinD });
}

function paint(v) {
  const [x, y, z] = v.p, [, ny, nz] = v.n;
  const tail = v.t('tail') + v.t('hips');
  // tail: dark dorsal teal, pale belly, iridescent scale rows
  if (tail > 0.2) {
    v.mix(C.tailDk, sstep(0.0, 0.8, ny + nz * 0.3) * 0.6);
    v.mix(C.belly, sstep(-0.1, -0.8, nz - ny * 0.3) * 0.5);
    v.mul(1 + 0.08 * Math.sin((x + z) * 14) * Math.sin(y * 12));
  }
  // skin: slightly darker extremities
  v.mix(C.skinDk, (v.t('hand') + v.t('fore')) * sstep(3.9, 3.2, y) * 0.5);
  // song-runes: glowing glyph bands along the tail and the forearms
  const runeZone = v.t('tail') * sstep(0.35, 0.75, ny + 0.15) + v.t('fore') * sstep(-0.2, 0.4, -nz) + v.t('waist') * 0.6;
  if (runeZone > 0.15) {
    const along = v.t('fore') > 0.3 ? y * 9 : (Math.hypot(x, z) + y) * 2.3;
    const cell = Math.floor(along), fr = along - cell;
    const h = Math.sin(cell * 91.7 + 7.1) * 43758.5453, on = (h - Math.floor(h)) > 0.35;        // some glyphs missing
    const glyph = on ? (1 - sstep(0.05, 0.12, Math.abs(fr - 0.5) * 2 - 0.55)) * (1 - sstep(0.02, 0.07, Math.abs(Math.sin(fr * 9 + cell * 2.3) * 0.5 + x * 0.8 - 0.1))) : 0;
    const r = Math.min(1, glyph + (1 - sstep(0.015, 0.05, Math.abs(Math.sin(along * 3.14159)))) * 0.35 * (on ? 1 : 0)) * runeZone;
    if (r > 0.1) { v.emis = r * 1.6; v.kind = K.mouth; v.gm = 1; v.mix(C.rune, r * 0.5); }
  }
  v.mix(0x0a1a1c, v.t('socket'));
  if (v.t('mouth') > 0.4) { v.mix(0x061014, 0.9); v.kind = K.mouth; v.emis = 0.6; v.gm = 1; }
}

function dress({ acc, macc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  const head = b('head');
  // ---- eyes: large, dark, glowing cyan
  for (const s of [-1, 1]) {
    const e = eyeball([0.075 * s, 5.14, -0.195], 0.036, [0.35 * s, 0.05, -1], [0, 1, 0], 8, 0.7);
    acc.addRaw(e, { skin: rigid(head), kind: K.eye, color: (t) => t > 0.3 ? C.eye : 0x04100f, emis: (t) => t > 0.3 ? 3.0 : 0.6, gm: 0.55, dtl: [0, 0, 0, 0] });
  }
  // ---- coral crown (breakable): branching coral antlers with glowing tips
  const crown = b('crown');
  const branch = (base, dir, L, r, depth, seed) => {
    const bend = [Math.sin(seed * 3.1), 0, Math.cos(seed * 2.3)];
    const path = hornPath(base, dir, L, norm(cross(dir, [0.3, 1, 0.2])), 0.5 * Math.sin(seed), 5);
    acc.addRaw(loft(path, 6, taper(r, { pow: 0.7, end: r * 0.3 }), [0, 0, 1]), { skin: rigid(crown), kind: K.crystal, color: (t) => lc(C.coral, C.coralTip, Math.pow(t, 2)), emis: (t) => 0.05 + (depth === 0 ? 1.4 : 0.6) * Math.pow(t, 4), gm: -1, dtl: [0, 0.15, 0.2, 0] });
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const p = path[3 + k], d2 = norm(add(dir, [(k ? 1 : -1) * 0.6 + bend[0] * 0.2, 0.3, bend[2] * 0.3]));
      branch(p, d2, L * 0.55, r * 0.6, depth - 1, seed + k * 1.7 + 0.5);
    }
  };
  const tines = [[0, [0, 1, 0.1], 0.75], [0.14, [0.45, 1, 0.1], 0.62], [-0.14, [-0.45, 1, 0.1], 0.62], [0.24, [0.9, 0.7, 0.1], 0.5], [-0.24, [-0.9, 0.7, 0.1], 0.5]];
  tines.forEach(([x, d, L], i) => branch([x, 5.33 - Math.abs(x) * 0.25, -0.02], norm(d), L, 0.05, i < 3 ? 2 : 1, i * 1.3 + 0.2));
  acc.addRaw(loft([[-0.22, 5.25, 0.02], [0, 5.36, -0.08], [0.22, 5.25, 0.02]], 6, () => [0.05, 0.035], [0, 1, 0]), { skin: rigid(crown), kind: K.hard, color: C.nacre, dtl: shellD });
  // ---- hair fronds: lofted strands skinned along their bone chains, glowing tips
  for (let i = 0; i < NH; i++) {
    const bones = HS.map((_, j) => b(`h${i}_${j}`));
    const wAt = (s) => { let j = 0; while (j < HB - 1 && s > HS[j + 1]) j++; const s1 = j < HB - 1 ? HS[j + 1] : 1; const f = sstep(0.5, 1, (s - HS[j]) / (s1 - HS[j])); const m = {}; m[bones[j]] = 1 - (j < HB - 1 ? f : 0); if (j < HB - 1) m[bones[j + 1]] = f; return skinMap(m); };
    const r0 = 0.1 - Math.abs(i - (NH - 1) / 2) * 0.006;
    acc.addRaw(loft(HAIR[i], 7, (t) => { const r = r0 * (1 - t * 0.55) * (1 + 0.35 * Math.sin(t * 8 + i)); return [r * 1.9, r * 0.45]; }, [0, 0, 1]), {
      skin: (p, t) => wAt(t), kind: K.hair, color: (t) => lc(C.hair, C.hairTip, Math.pow(t, 3)), emis: (t) => 1.6 * Math.pow(t, 5), gm: 1, dtl: [0.3, 0, 0.1, 0], uv: (uv, t) => [uv[0], t],
    });
  }
  // ---- fingers and webbed forearm fins
  for (const [s, n] of SIDES) {
    const wr = X(J.wr, s), hd = X(J.hand, s);
    for (let k = 0; k < 4; k++) {
      const base = add(lerp3(wr, hd, 0.9), [(k - 1.5) * 0.035 * s, 0, -0.02]);
      acc.addRaw(loft(hornPath(base, [(k - 1.5) * 0.12 * s, -1, -0.15], 0.22 - Math.abs(k - 1.5) * 0.03, [1, 0, 0], 0.4, 4), 5, taper(0.022, { pow: 0.6 }), [0, 0, -1]), { skin: rigid(b('hand' + n)), kind: K.skin, color: (t) => lc(C.skin, C.nail, sstep(0.8, 1, t)), dtl: skinD });
    }
    const el = X(J.el, s), wr2 = X(J.wr, s);
    const finBase = [], finTip = [];
    for (let k = 0; k <= 5; k++) { const p = lerp3(el, wr2, k / 5); finBase.push(add(p, [0.05 * s, 0, 0.06])); finTip.push(add(p, [0.3 * s * Math.sin((k / 5) * Math.PI) + 0.08 * s, -0.08, 0.2 + 0.25 * Math.sin((k / 5) * Math.PI)])); }
    const fm = grid(5, 4, (u, vv) => lerp3(lerp3(finBase[Math.round(u * 5)], finBase[Math.round(u * 5)], 0), finTip[Math.round(u * 5)], vv));
    macc.addRaw(fm, { skin: rigid(b('fore' + n)), kind: K.membrane, color: (t, p, nn, uv) => lc(C.fin, C.finEdge, uv[1]), emis: (t, p, uv) => 0.5 * Math.pow(uv[1], 3), gm: 1, dtl: [0, 0, 0, 0] });
  }
  // ---- dorsal fin along the tail + fluke
  const finB = [], finT = [];
  for (let k = 0; k <= 16; k++) {
    const s = 0.1 + k / 16 * 0.85, p = polyAt(TAILPTS, s), q = polyAt(TAILPTS, Math.min(1, s + 0.02));
    const T = norm(sub(q, p)), up = norm(cross(T, cross([0, 1, 0], T)));
    const r = 0.42 - s * 0.3;
    finB.push(addS(p, up, r * 0.75)); finT.push(addS(addS(p, up, r * 0.75 + 0.35 + 0.25 * Math.sin(k * 0.9) ** 2), T, 0.2));
  }
  const tailW = (p) => { let best = 0, bd = 1e9; for (let i = 0; i < NT; i++) { const d = dist(p, J.tail[i]); if (d < bd) { bd = d; best = i; } } return rigid(b('tail' + best)); };
  macc.addRaw(grid(16, 3, (u, vv) => lerp3(finB[Math.round(u * 16)], finT[Math.round(u * 16)], vv)), { skin: (p) => tailW(p), kind: K.membrane, color: (t, p, nn, uv) => lc(C.fin, C.finEdge, uv[1] * 0.8), emis: (t, p, uv) => 0.6 * Math.pow(uv[1], 4), gm: 1, dtl: [0, 0, 0, 0] });
  const fk = J.fluke, T = norm(sub(fk, J.tail[NT - 1]));
  const flukeM = grid(8, 6, (u, vv) => { const a = (u - 0.5) * 2.4; const side = norm(cross(T, [0, 1, 0])); return add(addS(addS(fk, T, vv * 1.1 * (1 - 0.3 * Math.abs(a))), [0, 1, 0], Math.sin(a) * vv * 0.9), side.map(q => q * Math.cos(a) * vv * 0.25)); });
  macc.addRaw(flukeM, { skin: rigid(b('tail' + (NT - 1))), kind: K.membrane, color: (t, p, nn, uv) => lc(C.fin, C.finEdge, uv[1]), emis: (t, p, uv) => 0.8 * Math.pow(uv[1], 3), gm: 1, dtl: [0, 0, 0, 0] });
  // ---- pearl strands on the bodice
  for (let k = 0; k < 11; k++) {
    const a = (k / 10 - 0.5) * 2.2, p = [Math.sin(a) * 0.3, 4.52 - Math.cos(a) * 0.1, -0.2 - Math.cos(a) * 0.02];
    acc.addRaw(eyeball(p, 0.028, [0, 0, -1], [0, 1, 0], 5), { skin: rigid(b('chest')), kind: K.hard, color: 0xf4f0ff, dtl: [0, 0, 0, 0] });
  }
}

export const nerissa = {
  info: {
    name: 'Nerissa', title: 'of the Drowned Choir', height: 5.6, radius: 2.0,
    parts: ['crown'],
    actions: {
      idle: { dur: 5, hits: [], loop: true },
      intro: { dur: 6.0, hits: [4.6] },
      sing: { dur: 2.4, hits: [1.2], loop: true },
      tail_slap: { dur: 2.0, hits: [1.05] },
      water_orb: { dur: 2.2, hits: [1.25] },
      dive: { dur: 3.4, hits: [2.45], move: { dist: 10, t0: 1.1, t1: 2.2 } },
      scream: { dur: 2.6, hits: [0.95, 1.35, 1.75] },
      groggy: { dur: 3.0, hits: [], loop: true },
      death: { dur: 4.0, hits: [], hold: true },
    },
  },
  config() { return { h: 0.042, ao: { dist: 0.06, str: 0.75 }, grad: { top: 0.1, bottom: 0.25, y0: 0, y1: 4, low: 0.1 }, dtl: [0, 0.2, 0.15, 0], boundsMul: 1.8 }; },
  rig, sculpt, paint, dress,
  look: { glow: 0x3af8ea, glowI: 1.7, glow2: 0xff5a9a, glow2I: 1.8, pulse: 2.4, dfreq: 3.0, memGlow: 0.2, enrage: 0xff2a5a, flash: 0x60fff0, ghost: 0x7afff0 },
  mat: { body: { rim: 0.4, rimColor: 0xb0fff4, spec: 0.5, shine: 34 }, membrane: { trans: 0.8, rim: 0.3 } },
  sockets: {
    head: ['head', [0, 5.35, -0.05]], mouth: ['jaw', [0, 4.97, -0.26]], chest: ['chest', [0, 4.3, -0.3]], back: ['chest', [0, 4.35, 0.3]],
    handL: ['handL', X(J.hand, -1)], handR: ['handR', X(J.hand, 1)], orb: ['chest', [0, 4.2, -0.9]], weapon: ['tail9', J.tail[9]], weaponTip: ['tail9', J.fluke],
    tail: ['tail7', J.tail[7]], crown: ['crown', [0, 5.8, 0]],
  },
};
nerissa.breakable = { crown: { bone: 'crown', socket: 'crown' } };
nerissa.spec = nerissaSpec(J, { NT, NH, HB });
