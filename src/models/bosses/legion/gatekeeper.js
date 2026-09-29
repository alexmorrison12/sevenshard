// The Gatekeeper, Warden of the Chaos Gate — original design. ~4 m hunched demon warden in blackened iron:
// a horned bucket-helm with glowing chaos-green eye slits, spiked pauldrons, chains wrapped around the torso,
// a tall curved tower shield bearing a burning chaos eye (left hand, aimed with $handL/$aimL), and a spiked flail
// whose chain is a spring-driven bone chain (the ball swings, trails and flies out wide in `spin`).
// Sculpted in units (≈2 tall), scale 2 → metres.
import * as THREE from 'three';
import { sweep, rigid, bez, taper, blend2 } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { clamp01, mix, sstep, TAU } from '../../kit/rig.js';
import { bipedCarriage } from './boss.js';

const C = {
  hide: 0x221c20, iron: 0x2c2b30, ironL: 0x5c5a64, ironD: 0x141316, bronze: 0x7a6a3a, leather: 0x2e2018,
  glow: 0x58ff6e, glowD: 0x1c6a2a, bone: 0x9a8c74, boneT: 0xd8ccb0, chain: 0x3a383e,
};
const DT = { hide: [0.1, 0.3, 0.3, 0], metal: [0, 0.02, 0.32, 0.06], leather: [0, 0.08, 0.3, 0.3], bone: [0.2, 0.05, 0.3, 0.3] };

// flail haft frame at the rest pose of the right fist; shield frame at the rest pose of the left fist
const GRIP = [0.72, 0.93, -0.04], H0 = [0, 0, -1], B0 = [0, 1, 0];
const HAFT = 0.5;                                       // haft length (grip → chain ring)
const RING = [GRIP[0], GRIP[1], GRIP[2] - HAFT];
const SGRIP = [-0.72, 0.95, -0.04], SH0 = [0, 1, 0], SB0 = [0, 0, -1];   // shield: up axis, face normal (outward)
const SC = [-0.72, 0.98, -0.17];                         // shield centre at rest (in front of the left fist)
const SH_ = 0.66;                                         // shield half height
const n3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const aim = (h, b) => { const H = n3(...h); let B = b; const d = B[0] * H[0] + B[1] * H[1] + B[2] * H[2]; B = n3(B[0] - H[0] * d, B[1] - H[1] * d, B[2] - H[2] * d); return [...H, ...B]; };
const K2 = (...o) => Object.assign({}, ...o);
const TW = (a, b = a * 1.3) => ({ 'spine+': [0, a, 0], 'chest+': [0, b, 0] });
const KNEEL_R = { $footR: [0.16, 0.03, 0.36, 0.5, 0], $footL: [-0.15, 0, -0.22] };
const GUARD = { $handL: [-0.42, 1.08, -0.44], $aimL: aim([0.06, 1, 0.12], [-0.35, 0, -0.94]) };           // shield up in front-left

export const gatekeeper = {
  meta: { name: 'Gatekeeper', title: 'Warden of the Chaos Gate', height: 4.0, radius: 1.6, walkSpeed: 2.2, runSpeed: 6 },
  scale: 2.0,
  h: 0.03, hg: { 1: 0.024, 2: 0.0125, 3: 0.016 },
  ao: { dist: 0.03, str: 0.85 },
  grad: { top: 0.14, bottom: 0.3, y0: 0.0, y1: 0.7, low: 0.22 },
  mat: { glow: C.glow, glowK: 3.2, crackFreq: 10, crackK: 0.9, dfreq: 5, rim: 0.22, rimColor: 0xd0ffd8, spec: 0.5, shine: 30, ghostCol: 0x6f63ff, enrageCol: 0xa8ff20, sil: 0.32, silCol: 0x9ab0ff },
  stepFx: { n: 3, scale: 1.1 },
  particles: { add: 700, alpha: 240 },

  rig(R) {
    R.add('hips', null, [0, 0.95, 0.04]);
    R.add('spine', 'hips', [0, 1.12, 0.05]);
    R.add('chest', 'spine', [0, 1.36, 0.03]);
    R.add('neck', 'chest', [0, 1.58, -0.04]);
    R.add('head', 'neck', [0, 1.68, -0.09]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('clav' + n, 'chest', [s * 0.12, 1.55, 0.0]);
      R.add('armU' + n, 'clav' + n, [s * 0.36, 1.55, 0.0]);
      R.add('armL' + n, 'armU' + n, [s * 0.57, 1.24, 0.03]);
      R.add('hand' + n, 'armL' + n, [s * 0.7, 0.99, -0.01]);
      R.add('fing' + n, 'hand' + n, [s * 0.74, 0.91, -0.04]);
      R.add('thigh' + n, 'hips', [s * 0.15, 0.93, 0.04]);
      R.add('shin' + n, 'thigh' + n, [s * 0.16, 0.52, 0.0]);
      R.add('foot' + n, 'shin' + n, [s * 0.17, 0.09, 0.04]);
    }
    R.add('flail1', 'handR', [RING[0], RING[1], RING[2] - 0.02]);
    R.add('flail2', 'flail1', [RING[0], RING[1] - 0.13, RING[2] - 0.02]);
    R.add('flail3', 'flail2', [RING[0], RING[1] - 0.26, RING[2] - 0.02]);
    R.add('flail4', 'flail3', [RING[0], RING[1] - 0.39, RING[2] - 0.02]);
    R.add('loinF1', 'hips', [0, 0.88, -0.2]); R.add('loinF2', 'loinF1', [0, 0.6, -0.22]);
  },

  sculpt(S) {
    const hd = { col: C.hide, tag: 'hide', dtl: DT.hide };
    const ar = { group: 1, col: C.iron, tag: 'metal', dtl: DT.metal };
    const E = (b, c, r, o) => S.ell(b, c, r, o), K = (b, a, c2, ra, rb, o) => S.cone(b, a, c2, ra, rb, o), Q = (b, a, c2, rx, ry, o) => S.seg(b, a, c2, rx, ry, o);
    const cut = (y0) => (x, y, z, d) => Math.max(d, y0 - y);
    // ---------------- hunched brute body (dark hide, visible at the arms/neck)
    E('hips', [0, 0.95, 0.05], [0.22, 0.14, 0.17], { k: 0.07, ...hd });
    E('spine', [0, 1.13, 0.06], [0.22, 0.17, 0.17], { k: 0.08, ...hd });
    E('chest', [0, 1.37, 0.04], [0.3, 0.22, 0.21], { k: 0.09, ...hd });
    E('chest', [0, 1.52, 0.13], [0.24, 0.13, 0.15], { k: 0.08, ...hd });                                          // hunched upper back
    K('neck', [0, 1.52, -0.02], [0, 1.66, -0.09], 0.1, 0.085, { k: 0.05, ...hd, b2: 'head', t0: 0.6, t1: 1 });
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      E('armU' + n, [s * 0.37, 1.56, 0.0], [0.12, 0.12, 0.12], { k: 0.06, ...hd });
      K('armU' + n, [s * 0.36, 1.55, 0.0], [s * 0.57, 1.24, 0.03], 0.11, 0.085, { k: 0.05, ...hd, b2: 'armL' + n, t0: 0.82, t1: 1 });
      Q('armU' + n, [s * 0.43, 1.46, -0.04], [s * 0.53, 1.31, -0.02], 0.08, 0.075, { k: 0.04, ...hd, zs: 1.15 });
      K('armL' + n, [s * 0.57, 1.24, 0.03], [s * 0.7, 0.99, -0.01], 0.085, 0.065, { k: 0.04, ...hd, b2: 'hand' + n, t0: 0.85, t1: 1 });
      K('thigh' + n, [s * 0.15, 0.93, 0.04], [s * 0.16, 0.52, 0.0], 0.12, 0.085, { k: 0.05, ...hd, b2: 'shin' + n, t0: 0.8, t1: 1 });
      K('shin' + n, [s * 0.16, 0.52, 0.0], [s * 0.17, 0.12, 0.04], 0.08, 0.06, { k: 0.04, ...hd, b2: 'foot' + n, t0: 0.85, t1: 1 });
      // armour: pauldrons (spiked separately), vambraces, cuisses, knee cops, greaves, iron boots
      E('clav' + n, [s * 0.36, 1.6, 0.0], [0.19, 0.13, 0.19], { ...ar, k: 0.008, rot: [0, 0, s * 0.35], mod: cut(1.6), tag: 'pauldron' });
      E('armU' + n, [s * 0.42, 1.53, 0.0], [0.17, 0.11, 0.17], { ...ar, k: 0.008, rot: [0, 0, s * 0.55], mod: cut(1.51), tag: 'pauldron' });
      K('armL' + n, [s * 0.585, 1.21, 0.03], [s * 0.69, 1.01, -0.005], 0.092, 0.075, { ...ar, k: 0.01, tag: 'plate' });
      E('thigh' + n, [s * 0.155, 0.72, -0.03], [0.12, 0.2, 0.11], { ...ar, k: 0.02, tag: 'plate' });
      E('shin' + n, [s * 0.16, 0.52, -0.07], [0.085, 0.085, 0.065], { ...ar, k: 0.02, tag: 'plate' });
      K('shin' + n, [s * 0.162, 0.46, -0.02], [s * 0.17, 0.16, 0.03], 0.095, 0.075, { ...ar, k: 0.012, tag: 'plate' });
      E('foot' + n, [s * 0.17, 0.06, -0.04], [0.085, 0.06, 0.15], { ...ar, group: 3, k: 0.02, tag: 'plate' });
    }
    // breastplate (hunched, heavy), faulds, belt
    E('chest', [0, 1.38, -0.02], [0.32, 0.24, 0.23], { ...ar, k: 0.03, tag: 'plate', mod: cut(1.14) });
    for (let i = 0; i < 2; i++) E('spine', [0, 1.14 - i * 0.07, 0.03], [0.24 - i * 0.01, 0.05, 0.19], { ...ar, k: 0.008, tag: 'lame' });
    E('hips', [0, 1.0, 0.05], [0.235, 0.05, 0.19], { group: 1, k: 0.01, col: C.leather, tag: 'leather', dtl: DT.leather });
    for (const s of [-1, 1]) S.box('hips', [s * 0.14, 0.86, -0.17], [0.09, 0.1, 0.014], 0.014, { ...ar, k: 0.006, rot: [0.18, s * 0.25, 0], tag: 'plate' });
    // hands (group 3): right fist around the haft, left fist around the shield grip
    {
      const [gx, gy, gz] = GRIP;
      E('handR', [gx, gy + 0.03, gz + 0.01], [0.06, 0.07, 0.075], { ...ar, group: 3, k: 0.02, tag: 'plate' });
      K('fingR', [gx + 0.045, gy - 0.02, gz - 0.06], [gx + 0.045, gy - 0.02, gz + 0.05], 0.032, 0.03, { ...ar, group: 3, k: 0.02, tag: 'plate' });
      const [lx, ly, lz] = SGRIP;
      E('handL', [lx, ly + 0.03, lz + 0.01], [0.06, 0.07, 0.075], { ...ar, group: 3, k: 0.02, tag: 'plate' });
      K('fingL', [lx - 0.045, ly - 0.02, lz - 0.06], [lx - 0.045, ly - 0.02, lz + 0.05], 0.032, 0.03, { ...ar, group: 3, k: 0.02, tag: 'plate' });
    }
    // ---------------- bucket helm (group 2): horned, eye slits, rivets
    const hm = { group: 2, col: C.iron, tag: 'helm', dtl: DT.metal };
    E('head', [0, 1.74, -0.1], [0.12, 0.13, 0.125], { ...hm, k: 0.02 });
    K('head', [0, 1.6, -0.1], [0, 1.86, -0.1], 0.13, 0.115, { ...hm, k: 0.03 });                                    // bucket
    E('head', [0, 1.73, -0.2], [0.1, 0.1, 0.05], { ...hm, k: 0.02 });                                                  // face plate
    K('head', [0, 1.88, -0.22], [0, 1.88, 0.05], 0.02, 0.02, { ...hm, k: 0.015 });                                    // crest ridge
    for (const s of [-1, 1]) S.box('head', [s * 0.045, 1.76, -0.245], [0.035, 0.008, 0.04], 0.004, { group: 2, k: 0.005, sub: true, col: 0x041004, tag: 'slit', rot: [0, 0, s * 0.25] });
    for (const s of [-1, 1]) S.box('head', [s * 0.052, 1.786, -0.238], [0.05, 0.011, 0.022], 0.005, { ...hm, k: 0.008, rot: [0.2, 0, s * 0.32] });   // angry brow bars over the slits
    K('head', [0, 1.815, -0.232], [0, 1.625, -0.246], 0.013, 0.015, { ...hm, k: 0.01 });                                                       // nasal bar
    for (const yy of [1.672, 1.64]) for (const s of [-1, 1]) for (const xx of [0.036, 0.066]) E('head', [s * xx, yy, -0.25], [0.0105, 0.0105, 0.03], { group: 2, k: 0.004, sub: true, col: 0x050505, tag: 'hole' });  // breath holes
  },

  paint(v, X) {
    const [x, y, z] = v.p, ny = v.n[1];
    const metal = v.t('metal') + v.t('plate') + v.t('lame') + v.t('pauldron') + v.t('helm');
    if (v.t('hide') > 0.3) { X[0] = 0.03; X[2] = 0.45 * v.t('hide'); }
    if (metal > 0.3) {
      X[0] = 0.34;
      v.mix(C.ironL, sstep(0.3, 0.95, ny) * 0.22);
      const rimK = (v.t('pauldron') > 0.3 || v.t('lame') > 0.3) ? sstep(-0.4, -0.8, ny) : sstep(-0.8, -0.95, ny);
      v.mix(C.bronze, rimK * 0.85 * (v.group === 2 ? 0.4 : 1)); if (rimK > 0.5) X[0] = 0.55;
      X[2] = (y > 1.15 && y < 1.55 && Math.abs(x) < 0.26 ? 0.3 : 0.08) * (v.group === 2 ? 0.2 : 1);
    }
    if (v.t('leather') > 0.3) X[0] = 0.08;
    if (v.t('slit') > 0.3) { v.mix(C.glowD, 0.9); v.emis = 1.8; X[3] = 1; X[2] = 0; }
    if (v.t('hole') > 0.3) { v.mix(0x060806, 0.85); X[0] = 0.05; X[2] = 0; }
  },

  parts(acc, S, R, out) {
    const b = (n) => R.index(n);
    const hb = rigid(b('head'));
    const cG = col(C.glow), cI = col(C.iron), cIL = col(C.ironL), cB = col(C.bone), cBT = col(C.boneT), cCh = col(C.chain);
    // eyes behind the slits
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.045, 1.762, -0.225), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.25)), new THREE.Vector3(1.8, 0.45, 0.6));
      acc.add(new THREE.SphereGeometry(0.018, 10, 6), { matrix: m, skin: hb, color: 0xb0ffb8, emis: 4.5, ext: [0, 0, 0, 1] });
    }
    // helm horns: thick, curving out and forward (bone)
    for (const s of [-1, 1]) {
      const pts = bez([s * 0.12, 1.82, -0.08], [s * 0.34, 1.9, -0.06], [s * 0.36, 2.1, -0.24], 12);
      acc.add(sweep(pts, taper(12, 0.045, 0.004, 1.1), { radial: 8, capStart: true }), { skin: hb, dtl: DT.bone, color: (p, n, uv) => lerp3(cB, cBT, uv[1]), ext: [0.2, 0, 0, 0] });
    }
    // rivets around the helm
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; acc.add(new THREE.SphereGeometry(0.009, 5, 4), { matrix: new THREE.Matrix4().setPosition(Math.sin(a) * 0.13, 1.62, -0.1 - Math.cos(a) * 0.13), skin: hb, color: C.bronze, ext: [0.6, 0, 0, 0] }); }
    // pauldron spikes
    const spike = (bone, p, d, L, r, glowTip = true) => {
      const D = new THREE.Vector3(...d).normalize(), a = new THREE.Vector3(...p);
      acc.add(sweep([a, a.clone().addScaledVector(D, L * 0.5), a.clone().addScaledVector(D, L)], [r, r * 0.55, r * 0.04], { radial: 7, capStart: true }), {
        skin: typeof bone === 'string' ? rigid(b(bone)) : bone, dtl: DT.metal, color: (pp, n, uv) => (glowTip && uv[1] > 0.8 ? cG : lerp3(cI, cIL, uv[1] * 0.6)),
        emis: (pp, uv) => (glowTip && uv[1] > 0.8 ? 2.2 : 0), ext: (pp, uv) => [0.4, 0, 0, glowTip && uv[1] > 0.8 ? 4 : 0],
      });
    };
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      for (let i = 0; i < 3; i++) spike('clav' + n, [s * (0.3 + i * 0.07), 1.72 - i * 0.03, -0.04 + i * 0.05], [s * (0.3 + i * 0.3), 1, 0.1], 0.16 - i * 0.02, 0.028);
      spike('shin' + n, [s * 0.16, 0.53, -0.12], [0, 0.3, -1], 0.07, 0.018, false);
    }
    // chains wrapped around the torso (diagonal bandolier of links)
    const link = (p, rot, sk) => acc.add(new THREE.TorusGeometry(0.03, 0.009, 4, 8), { matrix: new THREE.Matrix4().makeRotationFromEuler(rot).setPosition(p[0], p[1], p[2]), skin: sk, color: cCh, dtl: DT.metal, ext: [0.4, 0, 0, 0] });
    for (let i = 0; i < 26; i++) {
      const u = i / 25, a = -1.25 + u * 2.5;
      const y = 1.48 - u * 0.4;
      const p = S.project([Math.sin(a) * 0.3, y, -Math.cos(a) * 0.26].slice(), 1, 3).p;
      const s2 = S.sampleAt(p[0], p[1], p[2]);
      link([p[0] * 1.04, p[1], p[2] * 1.04], new THREE.Euler(0.4, a, i % 2 ? Math.PI / 2 : 0, 'YXZ'), { si: s2.si, sw: s2.sw });
    }
    // loin panel (dark leather with a chaos rune)
    {
      const nu = 5, nv = 6, P = [], I = [], UV = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const u = i / (nu - 1), v = j / (nv - 1); P.push((u - 0.5) * 2 * (0.11 + v * 0.02), 0.97 - v * 0.46, -0.215 - v * 0.02); UV.push(u, v); }
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; I.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const bk = g.clone(); { const ix = bk.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } const pa = bk.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + 0.01); bk.computeVertexNormals(); }
      const cl = col(C.leather), cg2 = col(C.glow);
      for (const gg of [g, bk]) acc.add(gg, {
        skin: (p) => { const v = clamp01((0.97 - p.y) / 0.46); return v < 0.5 ? blend2(b('hips'), b('loinF1'), v * 2) : blend2(b('loinF1'), b('loinF2'), (v - 0.5) * 2); },
        dtl: DT.leather, color: (p, n, uv) => { const d = Math.hypot(uv[0] - 0.5, (uv[1] - 0.35) * 1.4); return Math.abs(d - 0.18) < 0.035 ? cg2 : cl; },
        emis: (p, uv) => { const d = Math.hypot(uv[0] - 0.5, (uv[1] - 0.35) * 1.4); return Math.abs(d - 0.18) < 0.035 ? 2 : 0; }, ext: [0.05, 0, 0, 0],
      });
    }
    // ---------------- tower shield (rigid on the left hand): curved slab, iron rim, rim spikes, chaos eye sigil
    {
      const sh = rigid(b('handL'));
      const W = 0.37, Hh = SH_, T = 0.035;
      const c = new THREE.Vector3(...SC), up = new THREE.Vector3(...SH0), face = new THREE.Vector3(...SB0), side = new THREE.Vector3().crossVectors(up, face);
      const shapeW = (v) => W * (v > 0.55 ? Math.sqrt(Math.max(0, 1 - ((v - 0.55) / 0.45) ** 2)) * 0.3 + 0.7 : v < -0.6 ? 1 - ((-v - 0.6) / 0.4) * 0.55 : 1);
      const pt = (u, v, off) => { const w = shapeW(v); const x = u * w, bend = -(u * u) * 0.08; return c.clone().addScaledVector(side, x).addScaledVector(up, v * Hh).addScaledVector(face, bend + off); };
      const NU = 11, NV = 15, P = [], UV = [], I = [];
      for (const [off, flip] of [[T * 0.5, false], [-T * 0.5, true]]) {
        const base = P.length / 3;
        for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const u = i / (NU - 1) * 2 - 1, v = j / (NV - 1) * 2 - 1; const p = pt(u, v, off); P.push(p.x, p.y, p.z); UV.push(u, v); }
        for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) { const a = base + j * NU + i; if (!flip) I.push(a, a + 1, a + NU, a + 1, a + NU + 1, a + NU); else I.push(a, a + NU, a + 1, a + 1, a + NU, a + NU + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      acc.add(g, {
        skin: sh, dtl: DT.metal,
        color: (p, n, uv) => { const rim = Math.abs(uv[0]) > 0.86 || Math.abs(uv[1]) > 0.92; return rim ? col(C.bronze) : lerp3(cI, col(C.ironD), Math.abs(uv[0]) * 0.6); },
        ext: (p, uv) => [Math.abs(uv[0]) > 0.86 || Math.abs(uv[1]) > 0.92 ? 0.6 : 0.3, 0, 0, 0],
      });
      // chaos eye sigil: crisp glowing geometry just proud of the face (ring, lens outline, slit pupil, rays)
      const fc = (u, v, off = 0.022) => pt(u, v, T * 0.5 + off);
      const glowLine = (pts, r) => acc.add(sweep(pts, pts.map(() => r), { radial: 5 }), { skin: sh, color: cG, emis: 2.8, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
      const ring = []; for (let k = 0; k <= 32; k++) { const a = k / 32 * TAU; ring.push(fc(Math.cos(a) * 0.46, Math.sin(a) * 0.26 + 0.05)); }
      glowLine(ring, 0.014);
      for (const sgn of [1, -1]) { const arc = []; for (let k = 0; k <= 16; k++) { const u = -0.36 + k / 16 * 0.72; arc.push(fc(u, 0.05 + sgn * 0.16 * Math.cos(u / 0.36 * Math.PI / 2))); } glowLine(arc, 0.012); }
      glowLine([fc(0, -0.09, 0.03), fc(0, 0.05, 0.034), fc(0, 0.19, 0.03)], 0.024);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; glowLine([fc(Math.cos(a) * 0.54, Math.sin(a) * 0.32 + 0.05), fc(Math.cos(a) * 0.66, Math.sin(a) * 0.4 + 0.05)], 0.01); }
      // rim band + spikes along the top and sides
      const rim = []; for (let k = 0; k <= 24; k++) { const t = k / 24; const u = t < 0.5 ? -1 : 1, v = t < 0.5 ? -1 + t * 4 : 1 - (t - 0.5) * 4; rim.push(pt(u, Math.max(-1, Math.min(1, v)), 0)); }
      for (let k = 0; k < 7; k++) {
        const v = -0.6 + k * 0.25; for (const u of [-1, 1]) {
          const a = pt(u, v, 0), d = side.clone().multiplyScalar(u).addScaledVector(face, 0.3).normalize();
          acc.add(sweep([a, a.clone().addScaledVector(d, 0.05), a.clone().addScaledVector(d, 0.1)], [0.018, 0.01, 0.001], { radial: 5, capStart: true }), { skin: sh, color: cIL, dtl: DT.metal, ext: [0.5, 0, 0, 0] });
        }
      }
      const top = pt(0, 1, 0), d = up.clone().addScaledVector(face, 0.2).normalize();
      acc.add(sweep([top, top.clone().addScaledVector(d, 0.1), top.clone().addScaledVector(d, 0.2)], [0.03, 0.017, 0.002], { radial: 6, capStart: true }), { skin: sh, color: (p, n, uv) => (uv[1] > 0.8 ? cG : cIL), emis: (p, uv) => (uv[1] > 0.8 ? 2 : 0), dtl: DT.metal, ext: (p, uv) => [0.5, 0, 0, uv[1] > 0.8 ? 4 : 0] });
    }
    // ---------------- flail: haft (right hand), chain links on the spring chain, spiked glowing ball
    {
      const hr = rigid(b('handR'));
      const G = new THREE.Vector3(...GRIP), h = new THREE.Vector3(...H0);
      acc.add(sweep([G.clone().addScaledVector(h, -0.16), G.clone().addScaledVector(h, HAFT)], [0.03, 0.028], { radial: 8, capStart: true }), { skin: hr, color: (p, n, uv) => (Math.sin(uv[1] * 50) > 0 ? col(C.leather) : col(0x1a120c)), dtl: DT.leather, ext: [0.1, 0, 0, 0] });
      acc.add(new THREE.TorusGeometry(0.035, 0.01, 5, 10), { matrix: new THREE.Matrix4().setPosition(...RING), skin: hr, color: cCh, dtl: DT.metal, ext: [0.5, 0, 0, 0] });
      for (let k = 0; k < 8; k++) {
        const y = RING[1] - 0.03 - k * 0.05, bi = b('flail' + Math.min(4, 1 + Math.floor(k / 2)));
        acc.add(new THREE.TorusGeometry(0.028, 0.009, 4, 10), { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2)).setPosition(RING[0], y, RING[2] - 0.02), skin: rigid(bi), color: cCh, dtl: DT.metal, ext: [0.4, 0, 0, 0] });
      }
      const bc = new THREE.Vector3(RING[0], RING[1] - 0.52, RING[2] - 0.02), bb = rigid(b('flail4'));
      acc.add(new THREE.IcosahedronGeometry(0.14, 2), { matrix: new THREE.Matrix4().setPosition(bc), skin: bb, color: (p) => lerp3(cI, cG, 0.25), emis: 0.6, dtl: DT.metal, ext: [0.4, 0, 0.9, 0] });
      const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position;
      const seen = new Set();
      for (let k = 0; k < dirs.count; k++) {
        const d = new THREE.Vector3().fromBufferAttribute(dirs, k).normalize(), key = d.toArray().map(x => x.toFixed(2)).join(); if (seen.has(key)) continue; seen.add(key);
        const a = bc.clone().addScaledVector(d, 0.12);
        acc.add(sweep([a, a.clone().addScaledVector(d, 0.08), a.clone().addScaledVector(d, 0.15)], [0.03, 0.016, 0.001], { radial: 5, capStart: true }), { skin: bb, color: (p, n, uv) => (uv[1] > 0.7 ? cG : cIL), emis: (p, uv) => (uv[1] > 0.7 ? 2.2 : 0), dtl: DT.metal, ext: (p, uv) => [0.45, 0, 0, uv[1] > 0.7 ? 4 : 0] });
      }
    }
  },

  weapon: { grip: GRIP, h0: H0, b0: B0 },
  weaponL: { grip: SGRIP, h0: SH0, b0: SB0 },
  arms: { R: ['armUR', 'armLR', 'handR'], L: ['armUL', 'armLL', 'handL'] },
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], clavL: 'clavL', clavR: 'clavR', fingL: 'fingL', fingR: 'fingR' },
  sockets: {
    head: ['head', [0, 1.95, -0.1]], mouth: ['head', [0, 1.66, -0.26]], chest: ['chest', [0, 1.38, -0.26]], back: ['chest', [0, 1.55, 0.25]],
    handR: ['handR', GRIP], handL: ['handL', SGRIP], weapon: ['flail4', [RING[0], RING[1] - 0.52, RING[2] - 0.02]], weaponTip: ['flail4', [RING[0], RING[1] - 0.52, RING[2] - 0.02]],
    shield: ['handL', [SC[0], SC[1], SC[2] - 0.05]], feetL: ['footL', [-0.17, 0, -0.08]], feetR: ['footR', [0.17, 0, -0.08]],
  },
  breakable: {},

  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.17, 0, -0.14], body: 'hips', scap: 0.1, lift: 0.09, flex: 0.8, heel: 0.3, out: 0.07 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.17, 0, -0.14], body: 'hips', scap: 0.1, lift: 0.09, flex: 0.8, heel: 0.3, out: 0.07 },
    ],
    maxStride: 0.8, fMin: 0.6, settleDist: 0.04, actV: 0.2,
    gaits: [
      { v: 0.65, f: 0.9, duty: 0.62, lift: 1, off: { L: 0, R: 0.5 }, bob: 0.02, bobF: 2, bobPh: 0.12, roll: 0.045, rollF: 1, rollPh: 0.25, sway: 0.03, swayF: 1, swayPh: 0.25, nod: 0.02, nodF: 2 },
      { v: 1.8, f: 1.35, duty: 0.42, lift: 1.4, off: { L: 0, R: 0.5 }, bob: 0.04, bobF: 2, bobPh: 0.3, roll: 0.035, rollF: 1, rollPh: 0.25, nod: 0.03, nodF: 2, pitch: 0.03, pitchF: 2 },
    ],
  },
  airPaw: -0.4,
  springs: [
    { bones: ['flail1', 'flail2', 'flail3', 'flail4'], tip: [RING[0], RING[1] - 0.66, RING[2] - 0.02], k: 18, d: 2.2, g: 1.3 },
    { bones: ['loinF1', 'loinF2'], tip: [0, 0.42, -0.24], k: 40, d: 7, g: 1, coll: [{ bone: 'thighL', c: [-0.15, 0.72, -0.06], r: 0.12 }, { bone: 'thighR', c: [0.15, 0.72, -0.06], r: 0.12 }] },
  ],
  trails: [
    { bone: 'flail4', a: [RING[0], RING[1] - 0.4, RING[2] - 0.02], b: [RING[0], RING[1] - 0.62, RING[2] - 0.02], vMin: 6, vMax: 14, core: [2.6, 6, 2.8], edge: [0.3, 2.2, 0.5], life: 0.22 },
  ],
  emitters: [
    { bone: 'flail4', p: [RING[0], RING[1] - 0.52, RING[2] - 0.02], span: [0.08, 0.08, 0.08], kind: 'ember', rate: 12, opts: { scale: 0.9, col: [2.4, 5.5, 2.6] }, when: b => (b.dead ? 0.2 : 1) * (1 + b.glow.charge * 3 + b.glow.enrage) },
    { bone: 'handL', p: [SC[0], SC[1], SC[2] - 0.05], span: [0.1, 0.12, 0.02], kind: 'ghost', rate: 5, opts: { scale: 0.8, col: [1.2, 3.8, 1.4] }, when: b => (b.dead ? 0 : 1) * (1 + b.glow.body * 4) },
    { bone: 'head', p: [0, 1.762, -0.24], span: [0.05, 0, 0], kind: 'ember', rate: 5, opts: { scale: 0.35, col: [2.4, 5.5, 2.6] }, when: b => b.glow.eyes },
    { bone: 'chest', p: [0, 1.3, 0], span: [0.25, 0.3, 0.2], kind: 'ghost', rate: 24, opts: { scale: 1.3 }, when: b => b.glow.ghost },
  ],

  carriage(ctl, dt) {
    const P = ctl.pose, B = ctl.B;
    const r = bipedCarriage(ctl, dt, { lean: { walk: 0.1, run: 0.35 }, twist: 0.08, crouch: 0.03, breathe: 0.016, look: 0.6, arm: { swing: 0.2, runSwing: 0.5, out: -0.05, elbow: 0.35, runElbow: 0.9, weaponSwing: 0.4 }, neckPitch: -0.08, headPitch: 0.05 });
    P.rot(B.chest, 0.08, 0, 0);
    // shield held up front-left (guard); flail hangs from the right fist, swaying with the springs
    const L = ctl.ik.L; L.w = 1; L.hasAim = true; L.hasPole = true;
    L.p.set(-0.42, 1.06 + 0.01 * r.breath, -0.44); L.h.set(0.06, 1, 0.12).normalize(); L.b.set(-0.35, 0, -0.94).normalize(); L.pole.set(-1, -0.4, 0.6);
    const R = ctl.ik.R; R.w = 1; R.hasAim = true; R.hasPole = true;
    const wk = Math.max(clamp01(Math.abs(ctl.speedSm) / 0.65), ctl.run);
    R.p.set(0.5, 1.02 + Math.sin(r.ph * 2) * 0.01 * wk, -0.22);
    R.h.set(0.25, 0.35 + 0.1 * wk, -0.9).normalize(); R.b.set(0, 1, 0.3).normalize(); R.pole.set(1, -0.3, 0.8);
  },
  post(ctl) {
    const a = ctl.acts.find(x => x.name === 'groggy' && !x.out);
    if (a && a.td > 0.8 && a.td < 4.0) {
      const P = ctl.pose, t = ctl.t, k = a.w;
      _q0.setFromEuler(_e0.set(Math.sin(t * 1.3) * 0.1 * k, Math.sin(t * 0.9) * 0.2 * k, Math.sin(t * 1.1 + 1) * 0.12 * k, 'YXZ'));
      P.wq[ctl.B.head].multiply(_q0); P.fkChildren(ctl.B.head);
    }
  },
  events: {
    hit(ctl, a, pos) {
      if (!pos || ctl.opts.impactFx === false) return;
      const gy = ctl.root.position.y;
      if (pos.y - gy < 1.2) { const g = pos.clone(); g.y = gy + 0.05; ctl.fx('dust', g, 10, { scale: 1.4 }); }
      ctl.fx('spark', pos, 18, { scale: 1.0, col: [2.6, 6, 2.8] });
    },
    slam(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 18, { scale: 2 }); ctl.fx('spark', g, 20, { scale: 1.2, col: [2.6, 6, 2.8] }); } },
    summon(ctl, a, pos) { if (pos) { for (let i = 0; i < 30; i++) ctl.fx('ghost', pos, 1, { scale: 1.6, col: [1.2, 4.5, 1.6] }); ctl.fx('spark', pos, 26, { scale: 1.2, col: [2.6, 6, 2.8] }); } },
    kneel(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 10, { scale: 1.5 }); } },
    fall(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 22, { scale: 2.2 }); } },
  },
  actions: {},
};

const _q0 = new THREE.Quaternion(), _e0 = new THREE.Euler();

// ------------------------------------------------------------------------------------------------ actions
const A = gatekeeper.actions;
const SWING = (deg, y = 1.2, rad = 0.5, up = 0.15) => { // haft pointing out at `deg` around the body (0 = front), chain flies out with it
  const t = deg * Math.PI / 180, r = [-Math.sin(t), 0, -Math.cos(t)];
  return { $handR: [0.05 + r[0] * rad, y, -0.02 + r[2] * rad], $aimR: aim([r[0], up, r[2]], [0, 1, 0]) };
};
const CH_OUT = { flail1: [1.35, 0, 0], flail2: [0.1, 0, 0], flail3: [0.05, 0, 0], flail4: [0.05, 0, 0] };   // chain swung straight out along the haft
const rotY = (v, th) => [v[0] * Math.cos(th) + v[2] * Math.sin(th), v[1], -v[0] * Math.sin(th) + v[2] * Math.cos(th)];
const TOE = { L: [-0.17, 0, -0.14], R: [0.17, 0, -0.14] };
const SPIN = (th) => { const k = SWING(-30, 1.3, 0.55, 0.05); const a = k.$aimR; return { hips: [0, th, 0], $handR: rotY(k.$handR, th), $aimR: [...rotY(a.slice(0, 3), th), ...rotY(a.slice(3, 6), th)], $footL: rotY(TOE.L, th), $footR: rotY(TOE.R, th), ...CH_OUT, $charge: 1, $hips: [0, -0.08, 0] }; };

A.idle = { dur: 3, keys: [[0, {}]] };
A.walk = { dur: 1 / 0.9, hits: [0, 0.5 / 0.9], keys: [[0, {}]] };
A.spawn = { dur: 1.0, hits: [], lock: 1, fadeIn: 0.02, keys: [[0, { $hips: [0, -0.12, 0], 'chest+': [-0.15, 0, 0] }], [1.0, {}]] };

A.bash = {
  dur: 1.8, hits: [0.9], hitAt: ['shield'], lock: 1,
  keys: [
    [0, {}],
    [0.55, K2(TW(0.25), { $handL: [-0.4, 1.12, -0.28], $aimL: aim([0.05, 1, 0.1], [-0.55, 0, -0.84]), $hips: [0, -0.1, 0.08], 'spine+': [-0.1, 0.25, 0], 'head+': [0, -0.2, 0] }), 'o'],
    [0.9, K2(TW(-0.15), { $handL: [-0.12, 1.15, -0.78], $aimL: aim([0, 1, 0.15], [0, 0, -1]), $hips: [0, -0.14, -0.2], 'spine+': [-0.25, -0.1, 0], 'chest+': [-0.15, 0, 0], $footL: [-0.17, 0, -0.52], $shake: 0.5, $body: 0.6 }), 'i'],
    [1.25, K2(TW(-0.1), { $handL: [-0.18, 1.12, -0.66], $aimL: aim([0, 1, 0.12], [-0.1, 0, -1]), $hips: [0, -0.1, -0.16], 'spine+': [-0.15, 0, 0], $footL: [-0.17, 0, -0.52], $body: 0.2 }), 'o'],
    [1.8, { $footL: null, $body: 0 }],
  ],
};

A.spin = {
  dur: 2.8, hits: [0.9, 1.4, 1.9], hitAt: ['weapon', 'weapon', 'weapon'], lock: 1, active: [[0.8, 2.1]],
  keys: [
    [0, {}],
    [0.5, K2(SWING(-120, 1.35, 0.45, 0.2), TW(-0.3), { $hips: [0, -0.1, 0.05], 'head+': [0, -0.25, 0], $charge: 0.5, flail1: [0.6, 0, 0] }), 'o'],
    [0.7, SPIN(0.4), 'i'],
    [0.9, SPIN(1.9), 'l'],
    [1.1, SPIN(3.3), 'l'],
    [1.3, SPIN(4.7), 'l'],
    [1.5, SPIN(6.2832), 'l'],
    [1.7, SPIN(6.2832 + 1.4), 'l'],
    [1.9, SPIN(6.2832 + 2.8), 'l'],
    [2.1, SPIN(6.2832 + 4.2), 'l'],
    [2.3, SPIN(6.2832 * 2), 'o'],
    [2.8, { hips: null, $footL: null, $footR: null, flail1: null, flail2: null, flail3: null, flail4: null, $charge: 0 }],
  ],
};

A.summon = {
  dur: 2.8, hits: [1.6], hitAt: ['shield'], lock: 1,
  keys: [
    [0, {}],
    [0.8, { $handL: [-0.3, 1.5, -0.4], $aimL: aim([0, 1, 0.3], [-0.1, 0.3, -0.95]), $handR: [0.55, 1.95, -0.1], $aimR: aim([0.1, 1, 0.1], [0, 0.1, -1]), 'chest+': [0.15, 0, 0], 'head+': [0.35, 0, 0], $body: 0.6, $charge: 0.6, flail1: [-0.3, 0, 0] }, 'o'],
    [1.6, { $handL: [-0.22, 1.58, -0.46], $aimL: aim([0, 1, 0.35], [0, 0.35, -0.94]), $handR: [0.55, 2.02, -0.1], $aimR: aim([0.1, 1, 0.1], [0, 0.1, -1]), 'chest+': [0.2, 0, 0], 'head+': [0.45, 0, 0], $body: 1, $charge: 1, $shake: 0.8 }, 'i'],
    [2.2, { $body: 0.4, $charge: 0.3 }, 'o'],
    [2.8, { flail1: null, $body: 0, $charge: 0 }],
  ],
  ev: [[1.6, 'summon', 'shield']],
};

A.intro = {
  dur: 3.0, hits: [0.85, 2.05], hitAt: ['shield', 'weapon'], lock: 1, fadeIn: 0.01,
  keys: [
    [0, { $hips: [0, -0.1, 0.1], 'chest+': [-0.2, 0, 0], 'head+': [-0.3, 0, 0] }],
    [0.567, { $handL: [-0.35, 1.45, -0.45], $aimL: aim([0, 1, 0.1], [-0.2, 0, -0.98]), $hips: [0, 0.02, 0], 'chest+': [0.1, 0, 0], 'head+': [0.1, 0, 0] }, 'o'],
    [0.85, { $handL: [-0.3, 0.75, -0.62], $aimL: aim([0, 1, 0.05], [-0.1, 0, -1]), $hips: [0, -0.18, -0.06], 'chest+': [-0.25, 0, 0], 'spine+': [-0.1, 0, 0], $shake: 0.6, $body: 0.8 }, 'i'],
    [1.3, { $handL: [-0.35, 0.8, -0.58], $aimL: aim([0, 1, 0.05], [-0.1, 0, -1]), $hips: [0, -0.14, -0.05], $body: 0.3 }, 'o'],
    [1.825, K2(SWING(-100, 1.9, 0.35, 0.8), { $hips: [0, 0, 0], 'chest+': [0.1, -0.2, 0], 'head+': [0.2, 0, 0], $charge: 1, flail1: [0.9, 0, 0] }), 'io'],
    [2.05, K2(SWING(20, 1.35, 0.6, 0.1), { 'chest+': [0, 0.2, 0], 'head+': [0.05, 0, 0], $charge: 1, ...CH_OUT, $shake: 0.4 }), 'i'],
    [2.525, K2(SWING(40, 1.15, 0.5, 0.2), { $charge: 0.4 }), 'o'],
    [3, { flail1: null, flail2: null, flail3: null, flail4: null, $charge: 0, $body: 0 }],
  ],
  ev: [[0.85, 'slam', 'shield']],
};

A.groggy = {
  dur: 5.0, hits: [], lock: 1, stretch: [1.0, 4.0], sustain: [1.2, 3.8],
  keys: [
    [0, {}],
    [0.25, { 'chest+': [0.2, 0, 0.1], 'head+': [0.3, 0.2, 0], $hips: [0, 0, 0.06], $eyes: 0.6 }, 'o'],
    [0.8, K2(KNEEL_R, { $hips: [0, -0.36, 0.05], $handL: [-0.4, 0.72, -0.5], $aimL: aim([0, 1, 0.2], [-0.2, 0, -0.98]), $handR: [0.45, 0.62, -0.1], $aimR: aim([0.3, -0.6, -0.7], [0, 1, 0]), 'head+': [-0.5, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], $eyes: 0.3 }), 'i'],
    [4.0, K2(KNEEL_R, { $hips: [0, -0.36, 0.05], $handL: [-0.4, 0.72, -0.5], $aimL: aim([0, 1, 0.2], [-0.2, 0, -0.98]), $handR: [0.45, 0.62, -0.1], $aimR: aim([0.3, -0.6, -0.7], [0, 1, 0]), 'head+': [-0.5, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], $eyes: 0.3 })],
    [4.4, K2(KNEEL_R, { $hips: [0, -0.32, 0.05], 'head+': [0.1, -0.3, 0], $eyes: 0.8 }), 'io'],
    [5.0, { $footR: null, $footL: null, $eyes: 1 }],
  ],
};

A.death = {
  dur: 3.8, hits: [1.6, 2.6], hitAt: ['feetR', 'shield'], hold: true, fadeIn: 0.1,
  keys: [
    [0, {}],
    [0.45, { 'spine+': [0.22, 0, 0], 'chest+': [0.28, 0, 0], 'head+': [0.45, 0, 0], $hips: [0, 0.02, 0.06], $shake: 0.9 }, 'o'],
    [1.6, { 'spine+': [-0.25, 0, 0.05], 'chest+': [-0.22, 0, 0], 'head+': [-0.45, 0.2, 0], $hips: [0, -0.44, 0.08], $handL: [-0.45, 0.62, -0.55], $aimL: aim([0.1, 1, 0.3], [-0.3, 0.2, -0.93]), $footL: [-0.16, 0.03, 0.34, 0.6, 0], $footR: [0.16, 0.03, 0.32, 0.6, 0], $eyes: 0.6 }, 'i'],
    [2.1, { 'spine+': [-0.3, 0.05, 0.08], 'head+': [-0.5, 0.25, 0], $hips: [0, -0.46, 0.08], $eyes: 0.5 }, 'o'],
    [2.6, { hips: [-1.35, -0.2, 0.15], 'spine+': [-0.1, 0, 0], head: [0.35, -0.8, -0.2], $hips: [0, -0.78, -0.38], $handL: [-0.6, 0.12, -0.9], $aimL: aim([0.2, 0.1, -1], [0, 1, 0]), $handR: [0.7, 0.1, -0.7], $aimR: aim([0.6, 0, -0.8], [0, 1, 0]), $footL: [-0.16, 0.04, 0.6, 0.9, 0], $footR: [0.16, 0.04, 0.58, 0.9, 0], $eyes: 0.25 }, 'i'],
    [3.8, { hips: [-1.38, -0.2, 0.15], 'spine+': [-0.08, 0, 0], head: [0.38, -0.8, -0.2], $hips: [0, -0.8, -0.38], $handL: [-0.6, 0.1, -0.9], $aimL: aim([0.2, 0.1, -1], [0, 1, 0]), $handR: [0.7, 0.1, -0.7], $aimR: aim([0.6, 0, -0.8], [0, 1, 0]), $footL: [-0.16, 0.04, 0.6, 0.9, 0], $footR: [0.16, 0.04, 0.58, 0.9, 0], $eyes: 0 }],
  ],
  ev: [[1.6, 'kneel', 'feetR'], [2.6, 'fall', 'chest']],
};

A.hit = { dur: 0.5, hits: [], fadeIn: 0.04, keys: [[0, {}], [0.12, { 'chest+': [0.12, 0.08, 0.05], 'head+': [0.2, 0.1, 0], $hips: [0, -0.02, 0.03] }, 'o'], [0.5, {}]] };
