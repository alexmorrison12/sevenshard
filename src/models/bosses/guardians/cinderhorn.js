// Cinderhorn — lava-crusted rhino-beetle guardian (~7 m long, 3.2 m at the shoulder, horn tip ~4.6 m).
// A barrel-bodied, column-legged brute armoured in obsidian plates with molten seams (per-pixel voronoi in the shader),
// a beetle carapace over the back, obsidian shard spines, a pronotum horn arching over the head and one huge
// breakable nasal horn (breakPart('horn') leaves a glowing jagged stump). Burrows into lava and erupts back out.
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { col } from '../../kit/sdf.js';
import { K, rigid } from './core/acc.js';
import { norm, add, sub, addS, lerp3, bezier, hornPath, taper, loft, crystal, eyeball } from './core/geo.js';
import { cinderhornSpec } from './cinderhorn_anim.js';

const C = {
  obs: 0x110d0c, obsHi: 0x2a201d, hide: 0x3a2a24, belly: 0x4a3830, horn: 0x121010, hornTip: 0x5a4034,
  eye: 0xffc040, mouth: 0x5a1406, claw: 0x0e0b0a, clawTip: 0x4a3a30,
};
// the head (skull, jaw, horn, eyes, tusks) is modelled at rhino proportions and scaled up 1.25× around its pivot
const HP = [0, 2.2, -3.1], HS = 1.25;
const hx = (p) => [HP[0] + (p[0] - HP[0]) * HS, HP[1] + (p[1] - HP[1]) * HS, HP[2] + (p[2] - HP[2]) * HS];
const hr = (r) => r * HS;
export const J = {
  body: [0, 2.45, 0.2], chest: [0, 2.55, -1.2], hips: [0, 2.5, 1.5], neck: [0, 2.45, -2.45], head: [0, 2.2, -3.1],
  jaw: hx([0, 1.82, -3.2]), horn: hx([0, 2.28, -3.95]), stump: hx([0, 2.28, -3.95]), crest: [0, 2.95, -2.7],
  fU: [1.02, 2.15, -1.65], fL: [1.1, 1.2, -1.5], fP: [1.12, 0.36, -1.62], fToe: [1.12, 0, -1.85],
  rT: [0.98, 2.25, 1.6], rS: [1.08, 1.35, 1.12], rM: [1.08, 0.62, 1.66], rP: [1.08, 0.2, 1.55], rToe: [1.08, 0, 1.3],
  tail: [[0, 2.4, 2.85], [0, 2.1, 3.5], [0, 1.8, 4.05]], club: [0, 1.55, 4.5],
};
const X = (p, s) => [p[0] * s, p[1], p[2]];
const SIDES = [[-1, 'L'], [1, 'R']];

function rig(R) {
  R.add('body', null, J.body); R.add('chest', 'body', J.chest); R.add('hips', 'body', J.hips);
  R.add('neck', 'chest', J.neck); R.add('head', 'neck', J.head); R.add('jaw', 'head', J.jaw);
  R.add('horn', 'head', J.horn); R.add('stump', 'head', J.stump); R.add('crest', 'neck', J.crest);
  for (const [s, n] of SIDES) {
    R.add('fU' + n, 'chest', X(J.fU, s)); R.add('fL' + n, 'fU' + n, X(J.fL, s)); R.add('fP' + n, 'fL' + n, X(J.fP, s));
    R.add('rT' + n, 'hips', X(J.rT, s)); R.add('rS' + n, 'rT' + n, X(J.rS, s)); R.add('rM' + n, 'rS' + n, X(J.rM, s)); R.add('rP' + n, 'rM' + n, X(J.rP, s));
  }
  R.add('tail1', 'hips', J.tail[0]); R.add('tail2', 'tail1', J.tail[1]); R.add('tail3', 'tail2', J.tail[2]); R.add('club', 'tail3', J.club);
}

const rock = [0, 0.22, 0.3, 0], rockS = [0, 0.15, 0.25, 0];
function sculpt(S) {
  // barrel body, shoulder hump, beetle carapace (elytra) over the back
  S.ell('body', [0, 2.35, 0.1], [1.32, 1.18, 2.1], { k: 0.4, col: C.obs, tag: 'body', dtl: rock });
  S.ell('chest', [0, 2.55, -1.25], [1.3, 1.25, 1.2], { k: 0.4, col: C.obs, tag: 'body', dtl: rock });
  S.ell('chest', [0, 3.12, -1.05], [0.95, 0.62, 0.95], { k: 0.35, col: C.obs, tag: 'hump', dtl: rock });
  S.ell('hips', [0, 2.45, 1.55], [1.2, 1.08, 1.15], { k: 0.4, col: C.obs, tag: 'body', dtl: rock });
  S.ell('body', [0, 1.72, 0.1], [0.95, 0.55, 1.7], { k: 0.4, col: C.belly, tag: 'belly', dtl: rock });
  for (const s of [-1, 1]) S.ell('body', [0.48 * s, 3.05, 0.55], [0.82, 0.55, 1.9], { k: 0.25, col: C.obs, tag: 'shell', rot: [0.08, s * 0.08, s * 0.28], dtl: rockS });
  // neck: short, thick, collar of plates
  S.cone('neck', [0, 2.6, -1.9], J.head, 0.95, 0.7, { k: 0.35, col: C.obs, tag: 'neck', b2: 'head', t0: 0.6, t1: 1, dtl: rock });
  S.ell('neck', [0, 2.95, -2.3], [1.05, 0.6, 0.55], { k: 0.3, col: C.obs, tag: 'collar', rot: [-0.3, 0, 0], dtl: rock });
  // head: massive wedge, flat armoured brow, blunt snout (horn socket), heavy jaw below
  S.ell('head', hx([0, 2.25, -3.2]), [hr(0.78), hr(0.66), hr(0.82)], { k: 0.25, col: C.obs, tag: 'head', dtl: rock });
  S.cone('head', hx([0, 2.2, -3.4]), hx([0, 2.1, -4.1]), hr(0.62), hr(0.42), { k: 0.25, col: C.obs, tag: 'snout', dtl: rock });
  for (const s of [-1, 1]) {
    S.ell('head', hx([0.58 * s, 2.4, -3.2]), [hr(0.3), hr(0.26), hr(0.45)], { k: 0.15, col: C.obsHi, tag: 'brow', rot: [0.1, s * 0.3, s * 0.3], dtl: rockS });
    S.ell('head', hx([0.5 * s, 2.3, -3.55]), [hr(0.09), hr(0.08), hr(0.1)], { k: 0.04, sub: true, col: 0x050302, tag: 'socket' });
  }
  S.cone('head', hx([0, 1.9, -3.4]), hx([0, 1.88, -4.1]), hr(0.32), hr(0.2), { k: 0.08, sub: true, col: C.mouth, tag: 'mouthroof' });
  S.cone('jaw', hx([0, 1.8, -3.2]), hx([0, 1.72, -4.05]), hr(0.5), hr(0.32), { group: 1, k: 0.18, col: C.obs, tag: 'jaw', dtl: rock });
  S.cone('jaw', hx([0, 1.95, -3.35]), hx([0, 1.9, -4.0]), hr(0.28), hr(0.18), { group: 1, k: 0.08, sub: true, col: C.mouth, tag: 'mouth' });
  // legs: columnar, plated, elephantine feet
  for (const [s, n] of SIDES) {
    const u = X(J.fU, s), l = X(J.fL, s), p = X(J.fP, s), toe = X(J.fToe, s);
    S.ell('fU' + n, add(u, [0.05 * s, -0.25, 0]), [0.6, 0.85, 0.7], { k: 0.3, col: C.obs, tag: 'shoulder', dtl: rock });
    S.cone('fU' + n, u, l, 0.55, 0.42, { k: 0.2, col: C.obs, tag: 'leg', b2: 'fL' + n, t0: 0.8, t1: 1, dtl: rock });
    S.cone('fL' + n, l, p, 0.42, 0.36, { k: 0.15, col: C.obs, tag: 'leg', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: rock });
    S.cone('fP' + n, p, add(toe, [0, 0.14, 0]), 0.36, 0.46, { k: 0.12, col: C.obs, tag: 'foot', dtl: rock });
    const t = X(J.rT, s), sh = X(J.rS, s), m = X(J.rM, s), rp = X(J.rP, s), rt = X(J.rToe, s);
    S.ell('rT' + n, add(lerp3(t, sh, 0.4), [0.05 * s, 0.12, 0.05]), [0.62, 0.95, 0.8], { k: 0.3, col: C.obs, tag: 'haunch', dtl: rock });
    S.cone('rS' + n, sh, m, 0.45, 0.36, { k: 0.15, col: C.obs, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: rock });
    S.cone('rM' + n, m, rp, 0.36, 0.34, { k: 0.12, col: C.obs, tag: 'leg', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: rock });
    S.cone('rP' + n, rp, add(rt, [0, 0.13, 0.05]), 0.34, 0.44, { k: 0.12, col: C.obs, tag: 'foot', dtl: rock });
  }
  // tail with a molten club
  S.cone('hips', [0, 2.45, 2.1], J.tail[1], 0.72, 0.5, { k: 0.3, col: C.obs, tag: 'tail', b2: 'tail1', t0: 0.3, t1: 0.9, dtl: rock });
  S.cone('tail2', J.tail[1], J.tail[2], 0.5, 0.38, { k: 0.2, col: C.obs, tag: 'tail', b2: 'tail3', t0: 0.7, t1: 1, dtl: rock });
  S.cone('tail3', J.tail[2], J.club, 0.38, 0.3, { k: 0.18, col: C.obs, tag: 'tail', b2: 'club', t0: 0.6, t1: 1, dtl: rock });
  S.ell('club', add(J.club, [0, 0, 0.3]), [0.62, 0.5, 0.7], { k: 0.2, col: C.obs, tag: 'club', dtl: rock });
}

function paint(v) {
  const [x, y, z] = v.p, [, ny] = v.n;
  // everything is obsidian plate (lava kind); seams glow where the crust is thin (back, flanks), not on the feet
  v.kind = K.lava; v.gm = 1;
  const top = sstep(-0.3, 0.6, ny);
  let seam = 0.35 + 0.8 * top;
  seam *= 1 - 0.85 * (v.t('foot')) - 0.5 * sstep(1.0, 0.3, y);
  v.emis = Math.max(0, seam) * 1.0 + v.t('club') * 0.9;
  // molten underbelly glow + hot mouth
  v.mix(C.belly, v.t('belly') * sstep(-0.2, -0.7, ny) * 0.8);
  if ((v.group === 1 && ny > 0.3 && z < -3.45) || v.t('mouth') > 0.3 || v.t('mouthroof') > 0.3) { v.mix(C.mouth, 0.9); v.kind = K.mouth; v.emis = 1.4; v.gm = 0.75; }
  v.mix(0x050302, v.t('socket'));
  v.mul(1 + Math.sin(x * 5 + z * 3) * Math.sin(y * 4) * 0.06);
}

function dress({ acc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  const skinAt = (p) => { const s = S.sampleAt(p[0], p[1], p[2]); return { si: s.si, sw: s.sw }; };
  const head = b('head');
  // ---- the great horn (breakable): obsidian, molten core vein up the front, glowing tip
  const hb = hx([0, 2.3, -3.95]);
  const path = bezier([hb, add(hb, [0, 0.35, -1.25]), add(hb, [0, 2.1, -1.45]), add(hb, [0, 2.75, -0.85])], 18);
  acc.addRaw(loft(path, 12, (t) => { const r = 0.62 * Math.pow(1 - t, 0.85) + 0.02; return [r * 0.85, r]; }, [0, 0, -1]), {
    skin: rigid(b('horn')), kind: K.lava, color: (t) => lc(C.horn, C.hornTip, Math.pow(t, 2)),
    emis: (t, p, uv) => { const front = Math.max(0, Math.cos((uv[0] - 0.75) * Math.PI * 2)); return 0.25 + 0.9 * Math.pow(front, 6) + 1.6 * Math.pow(t, 5); }, gm: 1, dtl: [0, 0.1, 0.2, 0],
  });
  // ridges spiralling up the horn
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2;
    const rp = path.map((p, i) => { const t = i / (path.length - 1), r = (0.62 * Math.pow(1 - t, 0.85)) * 0.92; return [p[0] + Math.cos(a + t * 1.4) * r, p[1] + Math.sin(a + t * 1.4) * r * 0.3, p[2] + Math.sin(a + t * 1.4) * r * 0.8]; });
    acc.addRaw(loft(rp.slice(0, 12), 5, taper(0.07), [0, 1, 0]), { skin: rigid(b('horn')), kind: K.hard, color: C.horn, dtl: [0, 0.1, 0.2, 0] });
  }
  // stump (appears when the horn is broken): jagged glowing break
  const sp = bezier([hb, add(hb, [0, 0.12, -0.45]), add(hb, [0, 0.3, -0.62])], 4);
  acc.addRaw(loft(sp, 12, (t) => { const r = 0.62 * (1 - t * 0.15); return [r * 0.85, r]; }, [0, 0, -1]), { skin: rigid(b('stump')), kind: K.lava, color: C.horn, emis: (t) => 0.3 + 2.2 * Math.pow(t, 3), gm: 1, dtl: [0, 0.1, 0.2, 0] });
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, base = add(sp[4], [Math.cos(a) * 0.3, Math.sin(a) * 0.1, Math.sin(a) * 0.25]);
    acc.addRaw(crystal(base, norm([Math.cos(a) * 0.3, 0.9, -0.5]), 0.18 + 0.12 * ((k * 7) % 3), 0.07, 4, k), { skin: rigid(b('stump')), kind: K.lava, color: C.horn, emis: (t) => 1.5 * t, gm: 1, dtl: [0, 0, 0, 0] });
  }
  // ---- pronotum horn arching forward over the head
  const cb = [0, 3.05, -2.5];
  acc.addRaw(loft(bezier([cb, [0, 3.95, -3.0], [0, 3.55, -3.85]], 12), 9, (t) => { const r = 0.3 * Math.pow(1 - t, 0.7) + 0.02; return [r, r * 0.8]; }, [0, 0, 1]), {
    skin: rigid(b('crest')), kind: K.lava, color: (t) => lc(C.horn, C.hornTip, t), emis: (t) => 0.2 + 1.3 * Math.pow(t, 4), gm: 1, dtl: [0, 0.1, 0.2, 0],
  });
  // ---- obsidian shard spines: shoulders, carapace ridge, tail
  const shards = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) shards.push({ p: [s * (0.85 + k * 0.05), 3.25 - k * 0.1, -1.5 + k * 0.45], d: [s * 0.6, 0.9, 0.45], L: 0.95 - k * 0.1, r: 0.14 });
    for (let k = 0; k < 4; k++) shards.push({ p: [s * 1.2, 2.75 - k * 0.05, 0.3 + k * 0.5], d: [s * 1, 0.5, 0.35], L: 0.55, r: 0.1 });
  }
  for (let k = 0; k < 6; k++) shards.push({ p: [0, 3.6 - k * 0.12, -0.9 + k * 0.55], d: [0, 1, 0.35], L: 0.75 - k * 0.07, r: 0.13 });
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) shards.push({ p: [s * 0.4, 2.3 - k * 0.3, 3.1 + k * 0.5], d: [s * 0.7, 0.8, 0.4], L: 0.45, r: 0.08 });
  let sd = 1;
  for (const sh of shards) {
    const pr = S.project(sh.p.slice(), 0, 3).p;
    const base = addS(pr, norm(sh.d), -0.08);
    acc.addRaw(crystal(base, norm(sh.d), sh.L, sh.r, 5, sd++), { skin: skinAt(pr), kind: K.crystal, color: (t) => lc(C.horn, C.hornTip, t * 0.6), emis: (t) => 0.02 + 0.6 * Math.pow(t, 4), gm: 1, dtl: [0, 0, 0, 0] });
  }
  // club spikes
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, d = [Math.cos(a), Math.sin(a) * 0.9 + 0.2, 0.35];
    const base = add(J.club, [Math.cos(a) * 0.45, Math.sin(a) * 0.35, 0.35]);
    acc.addRaw(crystal(base, norm(d), 0.5, 0.1, 5, k), { skin: rigid(b('club')), kind: K.crystal, color: C.horn, emis: (t) => 0.05 + 0.8 * Math.pow(t, 3), gm: 1, dtl: [0, 0, 0, 0] });
  }
  // ---- eyes: small, sunken, molten
  for (const s of [-1, 1]) {
    const e = eyeball(hx([0.5 * s, 2.3, -3.55]), hr(0.085), [0.85 * s, 0.1, -0.5], [0, 1, 0], 8);
    acc.addRaw(e, { skin: rigid(head), kind: K.eye, color: C.eye, emis: (t) => t > 0.2 ? 2.4 : 0.3, gm: 0.4, dtl: [0, 0, 0, 0] });
  }
  // ---- tusks / mandible prongs and teeth
  for (const s of [-1, 1]) {
    acc.addRaw(loft(hornPath(hx([0.42 * s, 1.72, -3.75]), [0.35 * s, 0.4, -1], 0.95, [1, 0, 0], 0.9, 6), 7, taper(0.15, { flat: 0.8 }), [0, 1, 0]), { skin: rigid(b('jaw')), kind: K.hard, color: (t) => lc(C.horn, C.hornTip, t), dtl: [0, 0.1, 0.1, 0] });
    for (let k = 0; k < 4; k++) acc.addRaw(crystal(hx([0.22 * s, 1.93, -3.55 - k * 0.14]), [0, -1, 0], 0.2, 0.05, 4, k), { skin: rigid(head), kind: K.hard, color: 0x2a201c, dtl: [0, 0, 0, 0] });
  }
  // ---- feet: blunt obsidian nails
  for (const [s, n] of SIDES) for (const [paw, toe] of [['fP', J.fToe], ['rP', J.rToe]]) for (let k = -1; k <= 1; k++) {
    const base = add(X(toe, s), [k * 0.26, 0.1, -0.28 + Math.abs(k) * 0.08]);
    acc.addRaw(crystal(base, norm([k * 0.3, -0.35, -1]), 0.26, 0.1, 4, 0.8), { skin: rigid(b(paw + n)), kind: K.hard, color: C.claw, dtl: [0, 0, 0, 0] });
  }
  // ---- lava drips from the jaw and belly plates
  const drips = [hx([0.3, 1.5, -3.7]), hx([-0.25, 1.55, -3.5]), hx([0.1, 1.5, -3.95])];
  for (let i = 0; i < drips.length; i++) {
    const p = drips[i], bone = i < 2 ? b('jaw') : b('body');
    acc.addRaw(loft([add(p, [0, 0.1, 0]), p, add(p, [0, -0.28, 0])], 5, (t) => { const r = 0.045 * (1 - t * 0.6) + 0.03 * Math.sin(t * Math.PI); return [r, r]; }, [0, 0, 1]), { skin: rigid(bone), kind: K.lava, color: 0x5a2008, emis: 2.2, gm: 1, dtl: [0, 0, 0, 0] });
  }
}

export const cinderhorn = {
  info: {
    name: 'Cinderhorn', title: 'the Molten Juggernaut', height: 5.2, radius: 3.0, burrowDepth: 5,
    parts: ['horn'],
    actions: {
      idle: { dur: 4, hits: [], loop: true },
      walk: { dur: 1.8, hits: [], loop: true, speed: 2.6 },
      run: { dur: 1.0, hits: [], loop: true, speed: 7.5 },
      intro: { dur: 6.0, hits: [1.2, 4.2] },
      gore: { dur: 1.6, hits: [0.78] },
      charge: { dur: 3.6, hits: [1.5, 2.1, 2.7], move: { dist: 20, t0: 1.25, t1: 2.75 }, counter: [0.55, 1.15] },
      stomp: { dur: 2.0, hits: [1.05] },
      lava_spit: { dur: 2.2, hits: [0.85, 1.15, 1.45] },
      burrow: { dur: 2.4, hits: [] },
      erupt: { dur: 2.0, hits: [0.45] },
      tail_slam: { dur: 2.2, hits: [1.2] },
      roar: { dur: 2.6, hits: [1.0] },
      channel: { dur: 2.0, hits: [1.0], loop: true },
      groggy: { dur: 3.0, hits: [], loop: true },
      death: { dur: 3.4, hits: [], hold: true },
    },
  },
  config() { return { h: 0.075, ao: { dist: 0.12, str: 0.85 }, grad: { top: 0.18, bottom: 0.35, y0: 0, y1: 2.2, low: 0.25 }, dtl: [0, 0.2, 0.3, 0] }; },
  rig, sculpt, paint, dress,
  look: { glow: 0xff5a10, glowI: 1.7, glow2: 0xffb040, glow2I: 1.8, pulse: 1.6, dfreq: 0.9, crackF: 1.35, enrage: 0xff2a08, flash: 0xff6a18 },
  mat: { body: { rim: 0.22, rimColor: 0xffa070, spec: 0.3, shine: 60 } },
  sockets: {
    head: ['head', hx([0, 2.8, -3.3])], mouth: ['head', hx([0, 1.85, -4.05])], chest: ['chest', [0, 2.2, -2.1]], back: ['body', [0, 3.4, 0]],
    handL: ['fPL', [-1.12, 0.1, -1.8]], handR: ['fPR', [1.12, 0.1, -1.8]], weapon: ['horn', hx([0, 2.9, -4.8])], weaponTip: ['horn', add(hx([0, 2.3, -3.95]), [0, 2.75, -0.85])],
    horn: ['horn', hx([0, 3.0, -4.7])], tail: ['club', [0, 1.55, 4.8]], footL: ['fPL', [-1.12, 0.05, -1.7]], footR: ['fPR', [1.12, 0.05, -1.7]],
  },
};
cinderhorn.breakable = { horn: { bone: 'horn', stump: 'stump', socket: 'horn' } };
cinderhorn.spec = cinderhornSpec(J);
