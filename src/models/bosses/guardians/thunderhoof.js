// Old Thunderhoof — hourly field boss: an ancient stag-bull (~3.7 m at the hump, antler crowns to ~6 m). A bison's
// mountain of a shoulder hump under a shaggy, grizzled mane, a broad bull head with a silver beard, cloven hooves, and
// two vast branching antlers whose tines crackle with living lightning (strobing arcs between the tines, blue-white
// veins). Breakable antlers: 'antlerL' / 'antlerR' (a splintered stump remains).
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { col } from '../../kit/sdf.js';
import { K, rigid } from './core/acc.js';
import { norm, cross, add, sub, addS, lerp3, bezier, hornPath, taper, loft, crystal, eyeball, grid } from './core/geo.js';
import { thunderhoofSpec } from './thunderhoof_anim.js';

const C = {
  fur: 0x4a3222, furDk: 0x24170f, mane: 0x2a1c12, maneTip: 0x9a8a78, belly: 0x6a5038, muzzle: 0x3a3632, beard: 0xb0a898,
  hoof: 0x141110, antler: 0xd8ccb4, antlerDk: 0x6a5a48, bolt: 0x9ad8ff, eye: 0x9ae0ff, horn: 0x2a241e,
};
export const J = {
  body: [0, 2.7, 0.3], chest: [0, 2.95, -0.95], hips: [0, 2.6, 1.6], neck: [0, 2.9, -2.0], head: [0, 2.55, -2.75], jaw: [0, 2.2, -2.95],
  antlerL: [-0.42, 3.05, -2.62], antlerR: [0.42, 3.05, -2.62],
  fU: [0.78, 2.35, -1.3], fL: [0.84, 1.4, -1.12], fP: [0.86, 0.45, -1.25], fToe: [0.86, 0, -1.5],
  rT: [0.7, 2.4, 1.7], rS: [0.8, 1.55, 1.25], rM: [0.8, 0.8, 1.85], rP: [0.8, 0.22, 1.72], rToe: [0.8, 0, 1.45],
  tail: [[0, 2.55, 2.55], [0, 2.1, 2.85]], tailEnd: [0, 1.5, 3.0],
};
const X = (p, s) => [p[0] * s, p[1], p[2]];
const SIDES = [[-1, 'L'], [1, 'R']];

function rig(R) {
  R.add('body', null, J.body); R.add('chest', 'body', J.chest); R.add('hips', 'body', J.hips);
  R.add('neck', 'chest', J.neck); R.add('head', 'neck', J.head); R.add('jaw', 'head', J.jaw);
  R.add('antlerL', 'head', J.antlerL); R.add('antlerR', 'head', J.antlerR);
  R.add('stumpL', 'head', J.antlerL); R.add('stumpR', 'head', J.antlerR);
  for (const [s, n] of SIDES) {
    R.add('fU' + n, 'chest', X(J.fU, s)); R.add('fL' + n, 'fU' + n, X(J.fL, s)); R.add('fP' + n, 'fL' + n, X(J.fP, s));
    R.add('rT' + n, 'hips', X(J.rT, s)); R.add('rS' + n, 'rT' + n, X(J.rS, s)); R.add('rM' + n, 'rS' + n, X(J.rM, s)); R.add('rP' + n, 'rM' + n, X(J.rP, s));
  }
  R.add('tail1', 'hips', J.tail[0]); R.add('tail2', 'tail1', J.tail[1]);
}

const fur = [0.45, 0, 0.12, 0], furS = [0.3, 0, 0.1, 0], skinD = [0, 0, 0.15, 0];
const hs = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function sculpt(S) {
  // bison silhouette: towering hump over the shoulders, deep chest, lean hindquarters
  S.ell('chest', [0, 2.9, -0.95], [0.95, 1.1, 1.05], { k: 0.4, col: C.fur, tag: 'body', dtl: fur });
  S.ell('chest', [0, 3.55, -0.75], [0.8, 0.75, 0.95], { k: 0.4, col: C.mane, tag: 'hump', dtl: fur });
  S.ell('body', [0, 2.7, 0.35], [0.85, 0.9, 1.2], { k: 0.4, col: C.fur, tag: 'body', dtl: fur });
  S.ell('hips', [0, 2.62, 1.6], [0.72, 0.78, 0.8], { k: 0.35, col: C.fur, tag: 'body', dtl: fur });
  S.ell('chest', [0, 2.2, -1.35], [0.65, 0.6, 0.55], { k: 0.35, col: C.mane, tag: 'brisket', dtl: fur });
  // shaggy mane: clumps over the hump, neck and forelegs (bases on the surface, tips hanging / flaring)
  let hi = 0;
  const clump = (bone, base, dir, L, r0) => { const d = norm(dir); S.cone(bone, base, addS(base, d, L), r0, 0.03, { k: 0.12, col: C.mane, tip: { col: C.maneTip, from: 0.55 }, tag: 'mane', dtl: fur }); };
  for (let i = 0; i < 26; i++) {
    const a = -2.2 + (i % 13) / 12 * 4.4, row = Math.floor(i / 13);
    const z = -1.55 + row * 0.75, y = 3.1 + Math.cos(a) * 0.95 - row * 0.1;
    const base = [Math.sin(a) * 0.95, y, z];
    clump(row ? 'chest' : 'neck', base, [Math.sin(a) * 0.8, -0.6 - 0.3 * hs(hi), 0.25 + 0.3 * hs(hi + 1)], 0.55 + 0.35 * hs(hi++), 0.26);
  }
  for (const [s, n] of SIDES) for (let k = 0; k < 4; k++) clump('fU' + n, [0.78 * s + 0.1 * s, 2.2 - k * 0.3, -1.2 - k * 0.04], [0.5 * s, -1, -0.1], 0.5, 0.2);
  // neck + head: low-slung, massive brow, broad muzzle, silver beard
  S.cone('neck', [0, 3.0, -1.6], J.head, 0.75, 0.55, { k: 0.3, col: C.mane, tag: 'neck', b2: 'head', t0: 0.6, t1: 1, dtl: fur });
  S.ell('head', [0, 2.6, -2.85], [0.52, 0.5, 0.62], { k: 0.2, col: C.fur, tag: 'head', dtl: furS });
  S.ell('head', [0, 2.95, -2.7], [0.55, 0.28, 0.4], { k: 0.2, col: C.mane, tag: 'brow', dtl: fur });
  S.cone('head', [0, 2.45, -3.1], [0, 2.3, -3.62], 0.42, 0.34, { k: 0.18, col: C.muzzle, tag: 'muzzle', dtl: skinD });
  for (const s of [-1, 1]) {
    S.ell('head', [0.18 * s, 2.28, -3.7], [0.07, 0.06, 0.05], { k: 0.03, sub: true, col: 0x0a0806, tag: 'nostril' });
    S.ell('head', [0.4 * s, 2.72, -3.05], [0.08, 0.07, 0.08], { k: 0.03, sub: true, col: 0x050608, tag: 'socket' });
    // short horn bosses where the antlers root
    S.cone('head', [0.35 * s, 3.0, -2.62], [0.5 * s, 3.12, -2.58], 0.18, 0.15, { k: 0.08, col: C.horn, tag: 'boss', dtl: skinD });
  }
  S.cone('jaw', [0, 2.2, -2.95], [0, 2.1, -3.52], 0.3, 0.24, { group: 1, k: 0.12, col: C.muzzle, tag: 'jaw', dtl: skinD });
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.1; S.cone('jaw', [x, 2.02, -3.1 - Math.abs(x) * 0.2], [x * 1.4, 1.35 - 0.2 * hs(i + 40), -3.0], 0.12, 0.02, { group: 1, k: 0.06, col: C.beard, tag: 'beard', dtl: fur }); }
  // legs: long upper legs lost in fur, slim cannons, cloven hooves
  for (const [s, n] of SIDES) {
    const u = X(J.fU, s), l = X(J.fL, s), p = X(J.fP, s), toe = X(J.fToe, s);
    S.ell('fU' + n, add(u, [0.04 * s, -0.25, 0]), [0.42, 0.75, 0.55], { k: 0.25, col: C.fur, tag: 'shoulder', dtl: fur });
    S.cone('fU' + n, u, l, 0.34, 0.2, { k: 0.15, col: C.fur, tag: 'leg', b2: 'fL' + n, t0: 0.8, t1: 1, dtl: fur });
    S.cone('fL' + n, l, p, 0.18, 0.12, { k: 0.1, col: C.furDk, tag: 'cannon', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: furS });
    S.cone('fP' + n, p, add(toe, [0, 0.12, 0.02]), 0.13, 0.16, { k: 0.06, col: C.hoof, tag: 'hoof', dtl: skinD });
    const t = X(J.rT, s), sh = X(J.rS, s), m = X(J.rM, s), rp = X(J.rP, s), rt = X(J.rToe, s);
    S.ell('rT' + n, add(lerp3(t, sh, 0.4), [0.04 * s, 0.1, 0.05]), [0.42, 0.72, 0.62], { k: 0.25, col: C.fur, tag: 'haunch', rot: [0.3, 0, 0], dtl: fur });
    S.cone('rS' + n, sh, m, 0.24, 0.14, { k: 0.12, col: C.fur, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: fur });
    S.cone('rM' + n, m, rp, 0.13, 0.12, { k: 0.08, col: C.furDk, tag: 'cannon', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: furS });
    S.cone('rP' + n, rp, add(rt, [0, 0.12, 0.05]), 0.12, 0.15, { k: 0.06, col: C.hoof, tag: 'hoof', dtl: skinD });
  }
  // tufted tail
  S.cone('tail1', J.tail[0], J.tail[1], 0.14, 0.1, { k: 0.1, col: C.fur, tag: 'tail', b2: 'tail2', t0: 0.6, t1: 1, dtl: fur });
  S.cone('tail2', J.tail[1], J.tailEnd, 0.1, 0.06, { k: 0.08, col: C.fur, tag: 'tail', dtl: fur });
  S.ell('tail2', add(J.tailEnd, [0, 0.1, 0.02]), [0.16, 0.32, 0.14], { k: 0.08, col: C.mane, tag: 'tuft', dtl: fur });
}

function paint(v) {
  const [x, y, z] = v.p, [, ny] = v.n;
  v.mix(C.furDk, sstep(1.9, 0.9, y) * (v.t('leg') + v.t('cannon')) * 0.8);
  v.mix(C.belly, sstep(-0.2, -0.8, ny) * (v.t('body')) * 0.5);
  // grizzled: silver frosting on the muzzle, brow and hump top (old age)
  v.mix(C.beard, (v.t('muzzle') * sstep(0.2, 0.8, ny) * 0.45 + v.t('brow') * 0.25 + v.t('hump') * sstep(0.5, 0.95, ny) * 0.3) * (0.6 + 0.4 * Math.sin(x * 23 + z * 17) ** 2));
  // lightning scars: jagged glowing lines raked across the flanks
  const scar = Math.abs(((y * 2.2 + Math.sin(z * 5.1) * 0.35 + Math.sin(z * 13) * 0.08) % 1 + 1) % 1 - 0.5);
  const flank = (v.t('body') + v.t('haunch')) * sstep(0.35, 0.7, Math.abs(x)) * (z > -0.5 && z < 2.0 ? 1 : 0) * (Math.sin(z * 2.3 + x) > 0.35 ? 1 : 0);
  if (flank > 0.3 && scar < 0.03) { v.mix(0x9ad8ff, 0.8); v.emis = 1.2; v.kind = K.eye; v.gm = 1; }
  v.mix(0x050608, v.t('socket') + v.t('nostril') * 0.9);
  if (v.group === 1 && ny > 0.5 && z < -3.0) { v.mix(0x3a1414, 0.8); v.kind = K.mouth; v.emis = 0.2; }
}

function dress({ acc, facc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  // ---- antlers: a main beam sweeping up/out/back with tines; blue-white lightning veins, glowing tips
  let arcId = 1;
  for (const [s, n] of SIDES) {
    const bone = b('antler' + n), root = X([0.48, 3.12, -2.6], s);
    const beam = bezier([root, X([1.35, 3.6, -2.25], s), X([1.75, 5.1, -1.3], s), X([1.25, 6.0, -0.55], s)], 18);
    const tipsPts = [];
    const vein = (t, uv) => { const v = Math.abs(Math.sin(uv[0] * Math.PI * 2 * 3 + t * 20)); return v < 0.12 ? 1 : 0; };
    acc.addRaw(loft(beam, 8, (t) => { const r = 0.2 * (1 - t * 0.72) + 0.02; return [r, r * 0.85]; }, [0, 1, 0]), {
      skin: rigid(bone), kind: K.crystal, gm: 1, dtl: [0, 0.1, 0.25, 0.3],
      color: (t, p, nn, uv) => vein(t, uv) ? lc(C.bolt, 0xffffff, t) : lc(C.antlerDk, C.antler, sstep(0.0, 0.3, t)),
      emis: (t, p, uv) => vein(t, uv) ? 0.6 + 1.2 * t : 0.02 + 0.7 * Math.pow(t, 6),
    });
    tipsPts.push(beam[18]);
    // tines branching off the beam, pointing up / forward
    const tines = [[0.18, X([0.45, 0.35, -1], s), 1.0], [0.35, X([0.6, 0.8, -0.5], s), 1.25], [0.52, X([0.3, 1, -0.35], s), 1.2], [0.66, X([0.85, 0.7, 0.1], s), 1.1], [0.8, X([0.2, 1, 0.3], s), 0.9], [0.9, X([-0.5, 0.8, 0.2], s), 0.75]];
    for (const [f, d, L] of tines) {
      const bp = beam[Math.round(f * 18)];
      const path = hornPath(bp, d, L, norm(cross(norm(d), [0, 1, 0.3])), 0.35 * s, 7);
      acc.addRaw(loft(path, 6, taper(0.11 * (1 - f * 0.4), { pow: 0.8 }), [0, 1, 0]), {
        skin: rigid(bone), kind: K.crystal, gm: 1, dtl: [0, 0.1, 0.25, 0.3],
        color: (t, p, nn, uv) => vein(t, uv) ? C.bolt : lc(C.antler, 0xe8f4ff, Math.pow(t, 3)),
        emis: (t, p, uv) => vein(t, uv) ? 0.5 + t : 0.02 + 1.4 * Math.pow(t, 5),
      });
      tipsPts.push(path[7]);
    }
    // crackling arcs between neighbouring tine tips (strobing, re-zagging bolt kind in the additive mesh)
    for (let k = 0; k < tipsPts.length - 1; k += 1) {
      const A = tipsPts[k], B = tipsPts[(k + 2) % tipsPts.length];
      const pts = []; for (let i = 0; i <= 8; i++) pts.push(lerp3(A, B, i / 8));
      const m = loft(pts, 4, () => [0.03, 0.03], [0, 1, 0]);
      const id = arcId++;
      facc.addRaw(m, { skin: rigid(bone), kind: K.bolt, color: C.bolt, emis: 1.3, gm: 1, part: id, dtl: [0, 0, 0, 0], uv: (uv, t) => [uv[0], t] });
      // glow sheath around the arc
      facc.addRaw(loft(pts, 5, () => [0.1, 0.1], [0, 1, 0]), { skin: rigid(bone), kind: K.bolt, color: C.bolt, emis: 0.1, gm: 1, part: id, dtl: [0, 0, 0, 0], uv: (uv, t) => [uv[0], t] });
    }
    // stump: splintered base left when the antler breaks (hidden until then)
    const st = bezier([root, X([0.85, 3.35, -2.45], s), X([1.1, 3.55, -2.35], s)], 4);
    acc.addRaw(loft(st, 8, (t) => { const r = 0.21 * (1 - t * 0.2); return [r, r * 0.85]; }, [0, 1, 0]), { skin: rigid(b('stump' + n)), kind: K.hard, color: C.antlerDk, dtl: [0, 0.1, 0.25, 0.3] });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; acc.addRaw(crystal(add(st[4], [Math.cos(a) * 0.12, Math.sin(a) * 0.1, 0]), norm(X([0.8, 0.5 + 0.3 * Math.sin(a), 0.1], s)), 0.2 + 0.1 * (k % 2), 0.05, 4, k), { skin: rigid(b('stump' + n)), kind: K.crystal, color: C.antler, emis: (t) => 1.2 * t, gm: 1, dtl: [0, 0, 0, 0] }); }
  }
  // ---- eyes: electric blue
  for (const s of [-1, 1]) acc.addRaw(eyeball([0.4 * s, 2.72, -3.05], 0.075, [0.8 * s, 0.1, -0.6], [0, 1, 0], 8), { skin: rigid(b('head')), kind: K.eye, color: C.eye, emis: (t) => t > 0.25 ? 2.8 : 0.3, gm: 0.4, dtl: [0, 0, 0, 0] });
  // ---- cloven hooves: two toes per foot
  for (const [s, n] of SIDES) for (const [paw, toe] of [['fP', J.fToe], ['rP', J.rToe]]) for (const dx of [-0.07, 0.07]) {
    const base = add(X(toe, s), [dx, 0.1, -0.02]);
    acc.addRaw(loft(hornPath(base, [dx * 2, -0.5, -1], 0.26, [1, 0, 0], -0.5, 4), 6, taper(0.08, { flat: 0.7, pow: 0.6 }), [0, 1, 0]), { skin: rigid(b(paw + n)), kind: K.hard, color: C.hoof, dtl: [0, 0, 0.1, 0] });
  }
}

export const thunderhoof = {
  info: {
    name: 'Old Thunderhoof', title: 'the Storm That Walks', height: 5.9, radius: 2.6,
    parts: ['antlerL', 'antlerR'],
    actions: {
      idle: { dur: 4, hits: [], loop: true },
      walk: { dur: 1.8, hits: [], loop: true, speed: 2.8 },
      run: { dur: 0.95, hits: [], loop: true, speed: 8.5 },
      intro: { dur: 6.0, hits: [3.9] },
      charge: { dur: 3.4, hits: [1.45, 2.0, 2.55], move: { dist: 20, t0: 1.2, t1: 2.65 }, counter: [0.45, 1.1] },
      stomp: { dur: 2.0, hits: [1.05] },
      lightning_call: { dur: 3.2, hits: [1.3, 1.8, 2.3] },
      gore: { dur: 1.6, hits: [0.75] },
      roar: { dur: 2.2, hits: [0.95] },
      channel: { dur: 2.0, hits: [1.0], loop: true },
      groggy: { dur: 3.0, hits: [], loop: true },
      death: { dur: 3.5, hits: [], hold: true },
    },
  },
  config() { return { h: 0.068, ao: { dist: 0.1, str: 0.8 }, grad: { top: 0.15, bottom: 0.3, y0: 0, y1: 2.5, low: 0.22 }, dtl: [0.4, 0, 0.12, 0] }; },
  rig, sculpt, paint, dress,
  look: { glow: 0x7ad0ff, glowI: 1.8, glow2: 0xe0f4ff, glow2I: 2.0, pulse: 2.6, dfreq: 1.2, enrage: 0xffd040, flash: 0x9ad8ff },
  mat: { body: { rim: 0.3, rimColor: 0xd8e8ff, spec: 0.25, shine: 20 }, flame: {} },
  sockets: {
    head: ['head', [0, 3.2, -2.9]], mouth: ['head', [0, 2.2, -3.65]], chest: ['chest', [0, 2.3, -1.6]], back: ['chest', [0, 4.2, -0.8]],
    handL: ['fPL', [-0.86, 0.1, -1.55]], handR: ['fPR', [0.86, 0.1, -1.55]], weapon: ['antlerR', [1.35, 3.6, -2.25]], weaponTip: ['antlerR', [1.25, 6.0, -0.55]],
    antlerL: ['antlerL', [-1.6, 4.8, -1.4]], antlerR: ['antlerR', [1.6, 4.8, -1.4]], crown: ['head', [0, 5.4, -1.2]],
  },
};
thunderhoof.breakable = {
  antlerL: { bone: 'antlerL', stump: 'stumpL', socket: 'antlerL' },
  antlerR: { bone: 'antlerR', stump: 'stumpR', socket: 'antlerR' },
};
thunderhoof.spec = thunderhoofSpec(J);
