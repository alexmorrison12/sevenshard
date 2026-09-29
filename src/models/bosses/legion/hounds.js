// Skarn & Vesk — the twin demon hounds of Legion Gate 1. Original designs, one shared anatomy:
//   Skarn (fire): charcoal hide split by molten cracks, flame mane licking along neck and spine, curled ram horns,
//                 ember belly, blazing eyes and a furnace maw, tail ending in a burning tuft.
//   Vesk (void):  leaner, void-black hide with a violet sheen and violet fissures, obsidian dorsal spines wreathed in
//                 violet flame, long swept-back blade horns, violet eyes, tail ending in a scythe blade.
// Sculpted in units (head ≈ 2.05 tall), scale 2.0 → ~4 m at the head.
import * as THREE from 'three';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { clamp01, mix, sstep, TAU } from '../../kit/rig.js';
import { quadCarriage } from './boss.js';

const HP = [0, 1.9, -1.1], HS = 1.32;          // head pivot + head sculpt scale (big heavy skulls)
const H = (x, y, z) => [HP[0] + x * HS, HP[1] + y * HS, HP[2] + z * HS];
const HR = (r) => r.map(v => v * HS);

const PAL = {
  skarn: {
    hide: 0x1f1512, hideL: 0x3c2a22, belly: 0x5a2312, horn: 0x2b221e, hornT: 0xb8a482, claw: 0x120e0c, spine: 0x2a1c16, spineT: 0xff8a2a,
    glow: 0xff8a22, eye: 0xffd24a, maw: 0xff7a1c, mane: [5, 2.2, 0.5], tooth: 0xe8dcc0, crack: 0.85, girth: 1, name: 'Skarn', title: 'the Cinder Hound',
  },
  vesk: {
    hide: 0x0f0c14, hideL: 0x2a2038, belly: 0x1a1224, horn: 0x100c16, hornT: 0x5a3a8a, claw: 0x0a080e, spine: 0x120e1a, spineT: 0xc070ff,
    glow: 0xa040ff, eye: 0xe28aff, maw: 0x9a3aff, mane: [1.9, 0.6, 4.4], tooth: 0xd8d0e8, crack: 0.55, girth: 0.9, name: 'Vesk', title: 'the Void Hound',
  },
};
const DT = { hide: [0.25, 0.3, 0.25, 0], fur: [0.6, 0, 0.12, 0], horn: [0.3, 0, 0.2, 0.25], claw: [0, 0, 0.2, 0.2] };

function makeHound(kind) {
  const c = PAL[kind], G = c.girth, fire = kind === 'skarn';
  const def = {
    meta: { name: c.name, title: c.title, height: 4.1, radius: 2.2, walkSpeed: 2.4, runSpeed: 11 },
    scale: 2.0,
    h: 0.034, hg: { 1: 0.024, 2: 0.024 },
    ao: { dist: 0.05, str: 0.85 },
    grad: { top: 0.14, bottom: 0.4, y0: 0.2, y1: 1.4, low: 0.3 },
    mat: { sil: 0.34, silCol: fire ? 0x9ab0ff : 0xd0b0ff, glow: c.glow, glowK: fire ? 3.4 : 3.0, crackFreq: 9.5, crackK: 1.0, dfreq: 3.2, rim: 0.3, rimColor: fire ? 0xffb080 : 0xc8a0ff, spec: 0.4, shine: 20, ghostCol: 0x6f63ff, enrageCol: fire ? 0xff2a08 : 0xff30c0 },
    stepFx: { n: 3, scale: 1.1 },
    particles: { add: 900, alpha: 260 },

    rig(R) {
      R.add('body', null, [0, 1.5, 0.05]);
      R.add('chest', 'body', [0, 1.55, -0.45]);
      R.add('pelvis', 'body', [0, 1.5, 0.62]);
      R.add('neck', 'chest', [0, 1.72, -0.82]);
      R.add('head', 'neck', HP);
      R.add('jaw', 'head', H(0, -0.12, -0.1));
      R.add('earL', 'head', H(-0.14, 0.12, 0.0)); R.add('earR', 'head', H(0.14, 0.12, 0.0));
      R.add('tail1', 'pelvis', [0, 1.58, 0.92]); R.add('tail2', 'tail1', [0, 1.5, 1.28]); R.add('tail3', 'tail2', [0, 1.32, 1.62]); R.add('tail4', 'tail3', [0, 1.08, 1.9]);
      for (const s of [-1, 1]) {
        const n = s < 0 ? 'L' : 'R';
        R.add('fU' + n, 'chest', [s * 0.27, 1.38, -0.58]); R.add('fL' + n, 'fU' + n, [s * 0.3, 0.82, -0.44]); R.add('fP' + n, 'fL' + n, [s * 0.3, 0.22, -0.6]);
        R.add('rT' + n, 'pelvis', [s * 0.25, 1.38, 0.68]); R.add('rS' + n, 'rT' + n, [s * 0.3, 0.86, 0.46]); R.add('rM' + n, 'rS' + n, [s * 0.3, 0.44, 0.92]); R.add('rP' + n, 'rM' + n, [s * 0.3, 0.12, 0.86]);
      }
    },

    sculpt(S) {
      const hd = { col: c.hide, tag: 'hide', dtl: DT.hide };
      const E = (b, p, r, o) => S.ell(b, p, r, o), K = (b, a, b2, ra, rb, o) => S.cone(b, a, b2, ra, rb, o), Q = (b, a, b2, rx, ry, o) => S.seg(b, a, b2, rx, ry, o);
      const g = (r) => r.map((v, i) => (i === 0 ? v * G : v));
      // ---------------- torso: deep chest, humped withers, tucked waist, powerful haunches
      E('chest', [0, 1.52, -0.45], g([0.42, 0.46, 0.48]), { k: 0.16, ...hd });
      E('chest', [0, 1.86, -0.44], g([0.34, 0.24, 0.38]), { k: 0.13, ...hd, tag: 'back' });
      E('chest', [0, 1.16, -0.64], g([0.23, 0.2, 0.2]), { k: 0.12, col: c.belly, tag: 'belly', dtl: DT.hide });
      E('body', [0, 1.52, 0.08], g([0.27, 0.3, 0.42]), { k: 0.14, ...hd });
      E('body', [0, 1.55, 0.36], g([0.21, 0.23, 0.28]), { k: 0.12, ...hd });
      E('body', [0, 1.3, 0.12], g([0.18, 0.12, 0.3]), { k: 0.1, col: c.belly, tag: 'belly', dtl: DT.hide });
      E('pelvis', [0, 1.52, 0.72], g([0.29, 0.29, 0.3]), { k: 0.13, ...hd });
      // neck: thick, rising into the head
      K('neck', [0, 1.62, -0.7], [0, 1.86, -1.02], 0.36 * G, 0.27 * G, { k: 0.12, ...hd, b2: 'head', t0: 0.6, t1: 1 });
      E('neck', [0, 1.95, -0.8], g([0.26, 0.22, 0.32]), { k: 0.12, ...hd, tag: 'back' });
      E('neck', [0, 1.55, -0.92], g([0.18, 0.17, 0.16]), { k: 0.1, col: c.belly, tag: 'belly', dtl: DT.hide });
      // ---------------- head (group 1): long heavy skull, brow ridges, deep muzzle
      const hh = { group: 1, ...hd, tag: 'head' };
      E('head', H(0, 0.015, -0.07), HR([0.19 * G, 0.125, 0.2]), { k: 0.07, ...hh });                               // flat skull
      E('head', H(0, 0.09, -0.12), HR([0.13, 0.06, 0.16]), { k: 0.05, ...hh });                                     // sagittal crest
      for (const s of [-1, 1]) {
        S.box('head', H(s * 0.1, 0.066, -0.255), HR([0.088, 0.026, 0.058]), 0.022, { k: 0.03, ...hh, rot: [0.3, s * 0.3, s * 0.55] });  // brow shelf (angry V)
        E('head', H(s * 0.155, -0.05, -0.1), HR([0.088, 0.108, 0.14]), { k: 0.05, ...hh });                          // masseter
        E('head', H(s * 0.12, -0.01, -0.26), HR([0.07, 0.06, 0.1]), { k: 0.05, ...hh });                             // cheekbone
      }
      S.seg('head', H(0, 0.0, -0.2), H(0, -0.055, -0.64), 0.118 * HS, 0.085 * HS, { k: 0.06, ...hh });              // wedge muzzle (flat top)
      E('head', H(0, 0.035, -0.4), HR([0.075, 0.03, 0.18]), { k: 0.04, ...hh });                                     // nasal ridge
      E('head', H(0, -0.03, -0.642), HR([0.062, 0.04, 0.042]), { k: 0.028, ...hh, col: 0x0c0808, tag: 'nose', rot: [-0.35, 0, 0] });   // canine nose leather
      E('head', H(0, -0.11, -0.44), HR([0.112, 0.05, 0.19]), { k: 0.04, ...hh });                                    // upper lip / fang sheath
      for (const s of [-1, 1]) {
        E('head', H(s * 0.05, -0.045, -0.668), HR([0.022, 0.009, 0.018]), { group: 1, k: 0.008, sub: true, col: 0x050303, tag: 'nostril', rot: [0, s * 1.1, -s * 0.5] });   // side-facing comma slits
        E('head', H(s * 0.11, 0.035, -0.28), HR([0.045, 0.024, 0.035]), { group: 1, k: 0.015, sub: true, col: 0x0a0404, tag: 'socket', rot: [0, 0, s * 0.3] });
      }
      E('head', H(0, -0.16, -0.36), HR([0.1, 0.04, 0.24]), { group: 1, k: 0.02, sub: true, col: c.maw, tag: 'mouth' });
      // jaw (group 2)
      K('jaw', H(0, -0.16, -0.12), H(0, -0.18, -0.55), 0.12 * HS, 0.075 * HS, { group: 2, k: 0.04, ...hd, tag: 'jaw' });
      E('jaw', H(0, -0.2, -0.2), HR([0.13 * G, 0.07, 0.16]), { group: 2, k: 0.05, ...hd, tag: 'jaw' });
      E('jaw', H(0, -0.13, -0.34), HR([0.08, 0.025, 0.2]), { group: 2, k: 0.02, sub: true, col: c.maw, tag: 'mouth' });
      // ---------------- legs
      for (const s of [-1, 1]) {
        const n = s < 0 ? 'L' : 'R';
        E('fU' + n, [s * 0.25, 1.55, -0.52], [0.13 * G, 0.28, 0.2], { k: 0.1, ...hd, rot: [-0.2, 0, 0] });             // scapula
        K('fU' + n, [s * 0.27, 1.38, -0.58], [s * 0.3, 0.82, -0.44], 0.2 * G, 0.14, { k: 0.08, ...hd, b2: 'fL' + n, t0: 0.8, t1: 1 });
        Q('fU' + n, [s * 0.29, 1.3, -0.64], [s * 0.3, 0.95, -0.55], 0.17 * G, 0.16, { k: 0.07, ...hd });              // triceps bulk
        K('fL' + n, [s * 0.3, 0.82, -0.44], [s * 0.3, 0.22, -0.6], 0.13, 0.085, { k: 0.05, ...hd, b2: 'fP' + n, t0: 0.85, t1: 1 });
        Q('fL' + n, [s * 0.3, 0.76, -0.47], [s * 0.3, 0.45, -0.54], 0.125, 0.11, { k: 0.05, ...hd });
        E('fP' + n, [s * 0.3, 0.11, -0.72], [0.15, 0.095, 0.19], { k: 0.05, ...hd, tag: 'paw' });
        for (const d of [-1, 0, 1]) E('fP' + n, [s * 0.3 + d * 0.07, 0.07, -0.86], [0.045, 0.05, 0.07], { k: 0.03, ...hd, tag: 'paw' });
        E('rT' + n, [s * 0.23, 1.28, 0.74], [0.2 * G, 0.34, 0.27], { k: 0.1, ...hd, rot: [0.3, 0, 0] });              // haunch
        K('rT' + n, [s * 0.25, 1.38, 0.68], [s * 0.3, 0.86, 0.46], 0.2 * G, 0.14, { k: 0.08, ...hd, b2: 'rS' + n, t0: 0.8, t1: 1 });
        K('rS' + n, [s * 0.3, 0.86, 0.46], [s * 0.3, 0.44, 0.92], 0.13, 0.085, { k: 0.05, ...hd, b2: 'rM' + n, t0: 0.85, t1: 1 });
        Q('rS' + n, [s * 0.3, 0.84, 0.52], [s * 0.3, 0.6, 0.75], 0.12, 0.12, { k: 0.05, ...hd });
        K('rM' + n, [s * 0.3, 0.44, 0.92], [s * 0.3, 0.12, 0.86], 0.085, 0.07, { k: 0.04, ...hd, b2: 'rP' + n, t0: 0.8, t1: 1 });
        E('rP' + n, [s * 0.3, 0.09, 0.76], [0.14, 0.09, 0.18], { k: 0.05, ...hd, tag: 'paw' });
        for (const d of [-1, 0, 1]) E('rP' + n, [s * 0.3 + d * 0.065, 0.06, 0.62], [0.042, 0.045, 0.065], { k: 0.03, ...hd, tag: 'paw' });
      }
      // ---------------- tail
      K('tail1', [0, 1.58, 0.9], [0, 1.5, 1.28], 0.13 * G, 0.1, { k: 0.07, ...hd, b2: 'tail2', t0: 0.6, t1: 1 });
      K('tail2', [0, 1.5, 1.28], [0, 1.32, 1.62], 0.1, 0.075, { k: 0.05, ...hd, b2: 'tail3', t0: 0.6, t1: 1 });
      K('tail3', [0, 1.32, 1.62], [0, 1.08, 1.9], 0.075, 0.05, { k: 0.04, ...hd, b2: 'tail4', t0: 0.6, t1: 1 });
      K('tail4', [0, 1.08, 1.9], [0, 0.88, 2.08], 0.05, 0.025, { k: 0.03, ...hd });
    },

    paint(v, X) {
      const [x, y, z] = v.p, ny = v.n[1];
      const hide = v.t('hide') + v.t('back') + v.t('head') + v.t('jaw') + v.t('paw');
      // darker back, warmer belly glow; extremities darker
      v.mix(c.hideL, sstep(0.3, 0.9, ny) * 0.25 * (1 - v.t('belly')));
      v.mix(0x050304, sstep(0.45, 0.1, y) * 0.5);
      X[0] = 0.04;
      let cr = c.crack * (0.5 + 0.5 * sstep(0.2, 0.9, -ny + 0.4)); // stronger on flanks/belly
      if (v.group === 1) cr *= 0.35 * sstep(HP[2] - 0.62 * HS, HP[2] - 0.4 * HS, z); if (v.group === 2) cr *= 0.4;   // none on the muzzle tip
      if (y < 0.3) cr *= 0.3;
      X[2] = cr * Math.min(1, hide + v.t('belly'));
      if (v.t('belly') > 0.3 && fire) { v.emis = 0.18 * v.t('belly'); }
      if (v.t('nose') > 0.4) { X[2] = 0; X[0] = 0.2; }
      if (v.t('mouth') > 0.3) { v.mix(c.maw, 0.9); v.emis = 1.4; X[3] = 1; X[2] = 0; }
      if (v.t('socket') > 0.3) { v.mix(c.maw, 0.8); v.emis = 1.2; X[3] = 1; X[2] = 0; }
      if (v.t('paw') > 0.3) X[2] *= 0.3;
    },

    parts(acc, S, R, out) {
      const b = (n) => R.index(n);
      const skinAt = (p) => { const s = S.sampleAt(p[0], p[1], p[2]); return { si: s.si, sw: s.sw }; };
      const hb = rigid(b('head')), jb = rigid(b('jaw'));
      // eyes: burning slits
      for (const s of [-1, 1]) {
        const cc = H(s * 0.115, 0.04, -0.29);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(...cc), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.45, s * 0.3, 'YXZ')), new THREE.Vector3(1.3, 0.5, 0.7));
        const hot = col(fire ? 0xfff0a0 : 0xffd0ff), rim = col(c.eye);
        acc.add(new THREE.SphereGeometry(0.03, 12, 8), { matrix: m, skin: hb, dtl: [0, 0, 0, 0], color: (p, n) => lerp3(rim, hot, sstep(0.3, 0.95, -n.z * 0.8 + 0.2)), emis: 3.4, ext: [0, 0, 0, 1] });
      }
      // horns
      const cH = col(c.horn), cHT = col(c.hornT), cS = col(c.spineT);
      for (const s of [-1, 1]) {
        let pts;
        if (fire) { // ram curl: back, out, down, forward
          const a = new THREE.Vector3(...H(s * 0.12, 0.13, -0.08));
          pts = [];
          for (let i = 0; i < 26; i++) {   // up and back, down behind the jaw hinge, then forward past the cheek
            const u = i / 25, ang = u * 5.0;
            const r = 0.29 * (1 - u * 0.5);
            pts.push(new THREE.Vector3(a.x + s * (0.05 + u * 0.2 + Math.max(0, u - 0.7) * 0.3), a.y + Math.sin(ang) * r * 0.9 - u * 0.06, a.z + 0.05 + (1 - Math.cos(ang)) * r * 0.75 - 0.08 * u));
          }
        } else pts = bez(H(s * 0.1, 0.13, -0.12), H(s * 0.2, 0.3, 0.2), H(s * 0.24, 0.32, 0.72), 14);
        const N = pts.length;
        const ridge = (i) => Math.max(0, Math.sin(i * 1.9));                                     // ram horn growth ridges
        const hr = taper(N, fire ? 0.105 : 0.07, 0.008, 1.1).map((r, i) => (fire ? r * (1 + 0.14 * ridge(i) * (1 - i / N)) : r));
        acc.add(sweep(pts, hr, { radial: 9, capStart: true }), {
          skin: hb, dtl: DT.horn,
          color: (p, n, uv) => (!fire && uv[1] > 0.3 && Math.abs(Math.sin(uv[0] * TAU)) < 0.2 ? cS
            : fire ? lerp3(lerp3(cH, cHT, Math.pow(uv[1], 0.7)), cH, (1 - ridge(uv[1] * (N - 1))) * 0.35 * (1 - uv[1])) : lerp3(cH, cHT, Math.pow(uv[1], 1.3))),
          emis: (p, uv) => (!fire && uv[1] > 0.3 && Math.abs(Math.sin(uv[0] * TAU)) < 0.2 ? 1.8 : 0),
          ext: (p, uv) => [0.25, 0, 0, !fire && uv[1] > 0.3 && Math.abs(Math.sin(uv[0] * TAU)) < 0.2 ? 4 : 0],
        });
      }
      // brow horns (Skarn) and bone spikes: neck collar + elbows
      const spk = (sk2, a, d, L, r, glowTip) => {
        const D = new THREE.Vector3(...d).normalize(), A0 = new THREE.Vector3(...a);
        const pts2 = [A0, A0.clone().addScaledVector(D, L * 0.5).add(new THREE.Vector3(0, L * 0.05, 0)), A0.clone().addScaledVector(D, L)];
        const s0 = col(c.spine), sT = col(glowTip ? (fire ? 0xff7a20 : c.spineT) : c.hornT);
        acc.add(sweep(pts2, [r, r * 0.55, r * 0.04], { radial: 6, capStart: true }), { skin: sk2, dtl: DT.horn, color: (pp, n, uv) => lerp3(s0, sT, sstep(0.5, 1, uv[1])), emis: (pp, uv) => (glowTip ? sstep(0.65, 1, uv[1]) * 2.2 : 0), ext: (pp, uv) => [0.3, 0, 0, glowTip && uv[1] > 0.65 ? 4 : 0] });
      };
      if (fire) for (const s of [-1, 1]) spk(hb, H(s * 0.09, 0.09, -0.24), [s * 0.4, 0.8, -0.5], 0.2, 0.035, false);
      for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 3.4;
        const p0 = [Math.sin(a) * 0.3, 1.75 + Math.cos(a) * 0.26, -0.72];
        const { p: q } = S.project(p0.slice(), 0, 3);
        spk(skinAt(q), [q[0] * 0.95, q[1] * 0.98, q[2] + 0.02], [Math.sin(a) * 0.7, Math.cos(a) * 0.5 + 0.3, 0.9], 0.2 + 0.08 * Math.cos(a), 0.04, true);
      }
      for (const s of [-1, 1]) spk(rigid(b(s < 0 ? 'fLL' : 'fLR')), [s * 0.33, 0.82, -0.36], [s * 0.3, 0.3, 1], 0.2, 0.04, false);
      // ears (short, swept back)
      for (const s of [-1, 1]) {
        const g2 = leafGeo(0.055, 0.2, 0.02, 0.8, 0.35, { nu: 6, nv: 6, pw: 1.35 });
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-1.0, s * 0.3, -s * 0.5, 'YXZ')); m.setPosition(...H(s * 0.15, 0.1, 0.02));
        acc.add(g2, { matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: DT.hide, color: (p, n, uv) => (uv[0] >= 1 ? col(c.hide) : col(c.belly)) });
      }
      // fangs: long upper canines, lower tusks, rows of teeth
      const cT = col(c.tooth), cTB = col(0x8a7a60);
      const tcol = (p, n, uv) => lerp3(cTB, cT, uv[1]);
      for (const s of [-1, 1]) {
        acc.add(sweep(bez(H(s * 0.09, -0.12, -0.5), H(s * 0.095, -0.2, -0.52), H(s * 0.085, -0.27, -0.49), 5), taper(5, 0.024, 0.002), { radial: 7 }), { skin: hb, color: tcol, dtl: [0, 0, 0.1, 0] });
        acc.add(sweep(bez(H(s * 0.08, -0.17, -0.44), H(s * 0.09, -0.1, -0.46), H(s * 0.1, -0.04, -0.43), 5), taper(5, 0.02, 0.002), { radial: 7 }), { skin: jb, color: tcol, dtl: [0, 0, 0.1, 0] });
        for (let i = 0; i < 4; i++) {
          const z = -0.44 + i * 0.07;
          acc.add(sweep([H(s * 0.1, -0.12, z), H(s * 0.1, -0.165, z - 0.005)], [0.013, 0.002], { radial: 5 }), { skin: hb, color: tcol, dtl: [0, 0, 0.1, 0] });
          acc.add(sweep([H(s * 0.09, -0.17, z + 0.02), H(s * 0.09, -0.125, z + 0.02)], [0.012, 0.002], { radial: 5 }), { skin: jb, color: tcol, dtl: [0, 0, 0.1, 0] });
        }
      }
      // claws
      const cC = col(c.claw);
      for (const [paw, z0, dz] of [['fP', -0.9, -1], ['rP', 0.56, -1]]) for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
        const x = s * 0.3 + i * (paw === 'fP' ? 0.07 : 0.065);
        acc.add(sweep(bez([x, 0.09, z0], [x, 0.07, z0 + dz * 0.07], [x, 0.0, z0 + dz * 0.1], 4), taper(4, 0.022, 0.002), { radial: 6 }), { skin: rigid(b(paw + (s < 0 ? 'L' : 'R'))), color: cC, dtl: DT.claw, ext: [0.3, 0, 0, 0] });
      }
      // dorsal spines / flame tongues along the neck and back
      const spineAt = (i, n) => {
        const u = i / (n - 1);
        const z = -0.95 + u * 1.95, y = (u < 0.35 ? 2.02 - (0.35 - u) * 0.5 : 2.0 - (u - 0.35) * 0.55) - (u > 0.8 ? (u - 0.8) * 0.4 : 0);
        return [0, y, z];
      };
      const NS = fire ? 18 : 14;
      for (let i = 0; i < NS; i++) {
        const p = spineAt(i, NS);
        const { p: q } = S.project(p.slice(), 0, 3);
        const u = i / (NS - 1);
        const L = (fire ? 0.2 : 0.3) * (1 - Math.abs(u - 0.3) * 0.9) + 0.06;
        const a = new THREE.Vector3(q[0], q[1] - 0.03, q[2]);
        const dir = new THREE.Vector3(0, 1, 0.55 + u * 0.4).normalize();
        const tip = a.clone().addScaledVector(dir, L);
        const mid = a.clone().addScaledVector(dir, L * 0.55);
        const sk = skinAt(q);
        const s0 = col(c.spine), sT = col(fire ? 0xff7a20 : c.spineT);
        const LL = L * (fire ? 0.75 + 0.5 * ((i * 7) % 5) / 4 : 1);
        const tip2 = a.clone().addScaledVector(dir, LL), mid2 = a.clone().addScaledVector(dir, LL * 0.55);
        acc.add(sweep([a, mid2, tip2], [fire ? 0.06 : 0.05, fire ? 0.035 : 0.03, 0.003], { radial: 5, flat: fire ? 0.7 : 0.45 }), {
          skin: sk, dtl: DT.horn, color: (pp, n, uv) => lerp3(s0, sT, sstep(0.55, 1, uv[1])), emis: (pp, uv) => sstep(0.6, 1, uv[1]) * (fire ? 2.6 : 2.2),
          ext: (pp, uv) => [0.3, 0, 0, uv[1] > 0.6 ? 4 : 0],
        });
      }
      // tail tip: burning tuft (Skarn) / scythe blade (Vesk)
      const t4 = rigid(b('tail4'));
      if (fire) {
        const f1 = col(0xff5a10), f2 = col(0xffe0a0);
        for (let i = 0; i < 5; i++) {
          const a0 = new THREE.Vector3(0, 0.9, 2.06), d = new THREE.Vector3((i - 2) * 0.25, 0.8, 0.6).normalize();
          acc.add(sweep([a0, a0.clone().addScaledVector(d, 0.12), a0.clone().addScaledVector(d, 0.26)], [0.05, 0.03, 0.003], { radial: 5 }), { skin: t4, dtl: [0, 0, 0, 0], color: (pp, n, uv) => lerp3(f1, f2, uv[1]), emis: (pp, uv) => 1.5 + uv[1] * 2, ext: [0, 0, 0, 3], fx: (pp, uv) => uv[1] * 1.5 });
        }
      } else {
        const bl = new THREE.Shape();
        bl.moveTo(0, 0); bl.quadraticCurveTo(0.25, 0.12, 0.42, -0.12); bl.quadraticCurveTo(0.2, 0.0, 0, -0.08); bl.lineTo(0, 0);
        const eg = new THREE.ExtrudeGeometry(bl, { depth: 0.02, bevelEnabled: false, curveSegments: 8 });
        eg.translate(0, 0, -0.01);
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI / 2, -0.6, 'YXZ')); m.setPosition(0, 0.9, 2.06);
        acc.add(eg, { matrix: m, skin: t4, dtl: DT.horn, color: (pp) => cS, emis: 1.6, ext: [0.5, 0, 0, 4] });
      }
    },

    bones: { hips: 'body', pelvis: 'pelvis', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3', 'tail4'] },
    sockets: {
      head: ['head', H(0, 0.25, -0.1)], mouth: ['jaw', H(0, -0.12, -0.58)], chest: ['chest', [0, 1.3, -0.8]], back: ['body', [0, 2.0, 0.0]],
      handR: ['fPR', [0.3, 0.1, -0.85]], handL: ['fPL', [-0.3, 0.1, -0.85]], weapon: ['fPR', [0.3, 0.1, -0.85]], weaponTip: ['fPR', [0.3, 0.05, -0.95]],
      tail: ['tail4', [0, 0.9, 2.1]], feetFL: ['fPL', [-0.3, 0, -0.78]], feetFR: ['fPR', [0.3, 0, -0.78]], feetRL: ['rPL', [-0.3, 0, 0.7]], feetRR: ['rPR', [0.3, 0, 0.7]],
    },
    gait: {
      legs: [
        { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.3, 0, -0.8], body: 'chest', scap: 0.3, lift: 0.22, flex: 1.3, out: 0.05, heel: 0.45 },
        { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.3, 0, -0.8], body: 'chest', scap: 0.3, lift: 0.22, flex: 1.3, out: 0.05, heel: 0.45 },
        { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.3, 0, 0.68], body: 'pelvis', scap: 0.25, lift: 0.2, flex: 0.9, out: 0.08, metaK: 1.0, heel: 0.35 },
        { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.3, 0, 0.68], body: 'pelvis', scap: 0.25, lift: 0.2, flex: 0.9, out: 0.08, metaK: 1.0, heel: 0.35 },
      ],
      maxStride: 1.7, settleDist: 0.08,
      gaits: [
        { v: 1.2, f: 1.05, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.02, bobF: 2, bobPh: 0.1, roll: 0.03, rollF: 1, sway: 0.02, swayF: 1, nod: 0.04, nodF: 2, nodPh: 0.3 },
        { v: 2.8, f: 1.55, duty: 0.45, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.035, bobF: 2, bobPh: 0.35, roll: 0.02, rollF: 1, nod: 0.035, nodF: 2, nodPh: 0.5, pitch: 0.015, pitchF: 2 },
        { v: 5.5, f: 2.05, duty: 0.28, lift: 1.3, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.08, bobF: 1, bobPh: 0.62, pitch: 0.12, pitchF: 1, pitchPh: 0.05, flex: 0.16, flexF: 1, flexPh: 0.2, nod: 0.06, nodF: 1, nodPh: 0.8, lean: 0.05 },
      ],
    },
    airPaw: -0.6,
    springs: [
      { bones: ['tail1', 'tail2', 'tail3', 'tail4'], tip: [0, 0.86, 2.12], k: 28, d: 4.5, g: 0.35 },
      { bones: ['earL'], tip: H(-0.2, 0.2, 0.2), k: 110, d: 8, g: 0.3 },
      { bones: ['earR'], tip: H(0.2, 0.2, 0.2), k: 110, d: 8, g: 0.3 },
    ],
    trails: [
      { bone: 'fPR', a: [0.3, 0.12, -0.8], b: [0.3, 0.02, -0.98], vMin: 8, vMax: 16, core: fire ? [6, 3, 1] : [3.5, 1.5, 6], edge: fire ? [2.2, 0.35, 0.05] : [0.9, 0.2, 2.4], life: 0.18 },
      { bone: 'fPL', a: [-0.3, 0.12, -0.8], b: [-0.3, 0.02, -0.98], vMin: 8, vMax: 16, core: fire ? [6, 3, 1] : [3.5, 1.5, 6], edge: fire ? [2.2, 0.35, 0.05] : [0.9, 0.2, 2.4], life: 0.18 },
      { bone: 'tail4', a: [0, 1.0, 1.95], b: [0, 0.86, 2.14], vMin: 10, vMax: 20, core: fire ? [6, 3, 1] : [3.5, 1.5, 6], edge: fire ? [2.2, 0.35, 0.05] : [0.9, 0.2, 2.4], life: 0.2 },
    ],
    emitters: [
      // mane: flames (Skarn) / violet void fire (Vesk) along the spine
      { bone: 'neck', p: [0, 2.1, -0.82], span: [0.03, 0.05, 0.3], kind: fire ? 'flame' : 'void', rate: fire ? 70 : 45, opts: { scale: fire ? 1.25 : 0.9 }, when: h => (h.dead ? 0.1 : 1) * (1 + h.glow.enrage) },
      { bone: 'chest', p: [0, 2.08, -0.36], span: [0.03, 0.03, 0.32], kind: fire ? 'flame' : 'void', rate: fire ? 60 : 40, opts: { scale: fire ? 1.15 : 0.85 }, when: h => (h.dead ? 0.1 : 1) * (1 + h.glow.enrage) },
      { bone: 'body', p: [0, 1.98, 0.25], span: [0.03, 0.03, 0.34], kind: fire ? 'flame' : 'void', rate: fire ? 40 : 26, opts: { scale: fire ? 0.9 : 0.7 }, when: h => (h.dead ? 0.05 : 1) * (1 + h.glow.enrage) },
      { bone: 'tail4', p: [0, 0.95, 2.1], kind: fire ? 'flame' : 'void', rate: 16, opts: { scale: 0.9 }, when: h => (h.dead ? 0 : 1) },
      { bone: 'chest', p: [0, 1.6, -0.4], span: [0.3, 0.3, 0.3], kind: 'ember', rate: fire ? 10 : 0, opts: { scale: 1.3 }, when: h => 1 + h.glow.enrage * 2 },
      { bone: 'chest', p: [0, 1.6, -0.4], span: [0.3, 0.3, 0.3], kind: 'ghost', rate: fire ? 0 : 6, opts: { scale: 1.2, col: [1.6, 0.5, 3.4] }, when: h => 1 + h.glow.enrage * 2 },
      // eyes
      { bone: 'head', p: H(-0.115, 0.05, -0.3), kind: 'ember', rate: 5, opts: { scale: 0.4, col: fire ? [5, 2.4, 0.6] : [3, 1, 5] }, when: h => h.glow.eyes },
      { bone: 'head', p: H(0.115, 0.05, -0.3), kind: 'ember', rate: 5, opts: { scale: 0.4, col: fire ? [5, 2.4, 0.6] : [3, 1, 5] }, when: h => h.glow.eyes },
      // maw glow spill + breath stream
      { bone: 'jaw', p: H(0, -0.12, -0.5), kind: fire ? 'ember' : 'void', rate: 4, opts: { scale: 0.6 }, when: h => 1 },
      { bone: 'jaw', p: H(0, -0.13, -0.6), dir: [0, 0.1, -1], kind: 'breath', rate: 110, opts: { scale: 1.0, col: fire ? [5.5, 2.3, 0.6] : [2.2, 0.7, 5.2] }, when: h => h.special.num.$breath || 0 },
      // ghost form
      { bone: 'body', p: [0, 1.5, 0], span: [0.3, 0.3, 0.6], kind: 'ghost', rate: 30, opts: { scale: 2.2 }, when: h => h.glow.ghost },
    ],

    carriage(ctl, dt) {
      const r = quadCarriage(ctl, dt, { crouch: 0.05, runDrop: 0.06, combatPitch: -0.05, breathe: 0.015, look: 1.1, neck: { pitch: -0.05, run: -0.3, combat: -0.2, headCombat: 0.18, comp: 0.55 }, tail: { wag: 0.1, wagF: 0.35, run: 0.25 } });
      // snarling maw: jaw slightly open in combat, panting when running
      const P = ctl.pose, B = ctl.B;
      P.rx(B.jaw, -(0.08 + 0.04 * Math.sin(ctl.t * 3.1)) * ctl.combat - (0.1 + 0.05 * Math.sin(ctl.t * 12)) * ctl.run);
      for (const L of ctl.gait.legs) L.homeOff.set(L.side * 0.04 * ctl.combat, 0, (L.id[0] === 'F' ? -0.06 : 0.03) * ctl.combat);
    },
    events: {
      hit(ctl, a, pos) {
        if (!pos || ctl.opts.impactFx === false) return;
        const gy = ctl.root.position.y;
        if (pos.y - gy < 1.2) { const g2 = pos.clone(); g2.y = gy + 0.05; ctl.fx('dust', g2, 10, { scale: 1.6 }); }
        ctl.fx('spark', pos, 16, { scale: 1.0, col: fire ? [6, 3, 1] : [3, 1.2, 6] });
      },
      land(ctl, a, pos) { if (pos) { const g2 = pos.clone(); g2.y = ctl.root.position.y + 0.05; ctl.fx('dust', g2, 24, { scale: 2.6 }); } },
      howl(ctl, a, pos) { if (pos) for (let i = 0; i < 20; i++) ctl.fx(fire ? 'flame' : 'void', pos, 1, { scale: 2, up: 2.5 }); },
    },
    actions: {},
  };
  const A = def.actions;
  // quick helpers (feet ids FL FR RL RR; toe rest positions)
  const FT = { FL: [-0.3, 0, -0.8], FR: [0.3, 0, -0.8], RL: [-0.3, 0, 0.68], RR: [0.3, 0, 0.68] };
  const F = (id, dx = 0, dy = 0, dz = 0, paw) => { const t = FT[id]; const v = [t[0] + dx, t[1] + dy, t[2] + dz]; if (paw !== undefined) v.push(paw); return v; };
  A.idle = { dur: 3, keys: [[0, {}]] };
  A.walk = { dur: 1 / 1.05, hits: [0, 0.25 / 1.05, 0.5 / 1.05, 0.75 / 1.05], keys: [[0, {}]] };
  A.run = { dur: 1 / 2.05, hits: [0, 0.5 / 2.05], keys: [[0, {}]] };

  A.bite = {
    dur: 1.3, hits: [0.62], hitAt: ['mouth'], lock: 1,
    keys: [
      [0, {}],
      [0.38, { $hips: [0, -0.06, 0.14], body: [0.08, 0, 0], neck: [0.3, 0, 0], head: [0.2, 0, 0], jaw: [-0.25, 0, 0] }, 'o'],
      [0.52, { $hips: [0, -0.09, -0.3], body: [-0.1, 0, 0], neck: [-0.25, 0, 0], head: [-0.05, 0, 0], jaw: [-0.75, 0, 0], $footFL: F('FL', 0, 0, -0.35), $footFR: F('FR', 0, 0, -0.3) }, 'i'],
      [0.62, { $hips: [0, -0.1, -0.38], body: [-0.12, 0, 0], neck: [-0.3, 0, 0], head: [-0.1, 0, 0.12], jaw: [0.02, 0, 0], $footFL: F('FL', 0, 0, -0.35), $footFR: F('FR', 0, 0, -0.3) }, 'i'],
      [0.8, { $hips: [0, -0.08, -0.3], body: [-0.08, 0, 0], neck: [-0.2, 0.1, 0], head: [0.05, 0.2, -0.15], jaw: [-0.05, 0, 0] }, 'o'],
      [1.3, { body: null, neck: null, head: null, jaw: null }],
    ],
  };
  A.claw_swipe = {
    dur: 1.4, hits: [0.72], hitAt: ['handR'], lock: 1,
    keys: [
      [0, {}],
      [0.45, { $hips: [0, 0.12, 0.1], body: [0.22, -0.2, 0], neck: [0.1, 0.15, 0], head: [0.05, 0.1, 0], jaw: [-0.3, 0, 0], $footFR: [0.55, 1.2, -0.95, -0.9], $footFL: F('FL', 0.05, 0, 0.05) }, 'o'],
      [0.6, { $hips: [0, 0.14, 0.08], body: [0.25, -0.25, 0], $footFR: [0.6, 1.25, -1.0, -0.9] }, 'o'],
      [0.72, { $hips: [0, -0.02, -0.12], body: [0.02, 0.25, 0], neck: [-0.1, -0.2, 0], head: [0, -0.15, 0], jaw: [-0.5, 0, 0], $footFR: [-0.25, 0.25, -1.25, 0.2], $footFL: F('FL', 0.05, 0, 0.05) }, 'i'],
      [0.95, { $hips: [0, -0.04, -0.08], body: [0, 0.2, 0], $footFR: [-0.1, 0, -1.15, 0] }, 'o'],
      [1.4, { body: null, neck: null, head: null, jaw: null }],
    ],
  };
  // leap onto a target: the encounter moves the root along its arc (B.leap); the model poses the crouch, the
  // stretched airborne body (forepaws reaching, jaws open) and the landing
  A.pounce = {
    dur: 2.2, hits: [1.25], hitAt: ['feetFR'], lock: 1, move: [{ t: [0.45, 1.25], dist: 'target', height: 4 }],
    keys: [
      [0, {}],
      [0.4, { $hips: [0, -0.28, 0.12], body: [0.1, 0, 0], neck: [-0.2, 0, 0], head: [0.15, 0, 0], jaw: [-0.2, 0, 0] }, 'o'],
      [0.55, { $hips: [0, 0.12, -0.1], body: [0.22, 0, 0], $air: 0.9, neck: [0.1, 0, 0], jaw: [-0.6, 0, 0] }, 'o'],
      [0.95, { $hips: [0, 0.15, -0.05], body: [-0.05, 0, 0], $air: 1, neck: [-0.1, 0, 0], head: [-0.1, 0, 0], jaw: [-0.75, 0, 0] }, 'io'],
      [1.25, { $hips: [0, -0.14, -0.15], body: [-0.18, 0, 0], $air: 0, neck: [-0.35, 0, 0], head: [-0.1, 0, 0], jaw: [0, 0, 0], $footFL: F('FL', 0, 0, -0.3), $footFR: F('FR', 0, 0, -0.3) }, 'i'],
      [1.6, { $hips: [0, -0.08, -0.1], body: [-0.1, 0, 0], neck: [-0.1, 0, 0], jaw: [-0.2, 0, 0], $footFL: F('FL', 0, 0, -0.3), $footFR: F('FR', 0, 0, -0.3) }, 'o'],
      [2.2, { body: null, neck: null, head: null, jaw: null }],
    ],
    ev: [[0.5, 'jump', 'feetRL'], [1.25, 'land', 'feetFR']],
  };
  A.breath = {
    dur: 3.4, hits: [1.1, 1.6, 2.1, 2.6], hitAt: ['mouth'], lock: 1, active: [[1.0, 2.8]],
    keys: [
      [0, {}],
      [0.75, { $hips: [0, 0.06, 0.12], body: [0.18, 0, 0], neck: [0.35, 0, 0], head: [0.3, 0, 0], jaw: [-0.2, 0, 0], $body: 0.6 }, 'o'],
      [1.0, { $hips: [0, -0.1, -0.05], body: [-0.1, 0, 0], neck: [-0.18, -0.25, 0], head: [0.05, -0.12, 0], jaw: [-0.8, 0, 0], $breath: 1, $body: 0.6 }, 'i'],
      [1.9, { neck: [-0.18, 0.25, 0], head: [0.05, 0.12, 0], jaw: [-0.85, 0, 0], $breath: 1, $body: 0.6 }, 'io'],
      [2.8, { neck: [-0.16, -0.2, 0], head: [0.05, -0.1, 0], jaw: [-0.8, 0, 0], $breath: 1, $body: 0.5 }, 'io'],
      [3.1, { jaw: [-0.2, 0, 0], $breath: 0, $body: 0.2 }],
      [3.4, { body: null, neck: null, head: null, jaw: null, $body: 0 }],
    ],
  };
  A.howl = {
    dur: 2.6, hits: [1.0], hitAt: ['mouth'], lock: 1,
    keys: [
      [0, {}],
      [0.6, { $hips: [0, -0.14, 0.1], body: [0.32, 0, 0], neck: [0.55, 0, 0], head: [0.4, 0, 0], jaw: [-0.2, 0, 0], $footFL: F('FL', 0, 0, 0.1), $footFR: F('FR', 0, 0, 0.1) }, 'o'],
      [1.0, { $hips: [0, -0.14, 0.1], body: [0.35, 0, 0], neck: [0.65, 0, 0], head: [0.5, 0, 0], jaw: [-0.7, 0, 0], $shake: 0.8, $body: 0.35 }, 'io'],
      [2.1, { $hips: [0, -0.14, 0.1], body: [0.35, 0, 0], neck: [0.65, 0, 0], head: [0.5, 0, 0], jaw: [-0.65, 0, 0], $shake: 0.8, $body: 0.35 }],
      [2.6, { body: null, neck: null, head: null, jaw: null, $body: 0 }],
    ],
    ev: [[1.0, 'howl', 'mouth']],
  };
  A.tail_whip = {
    dur: 1.5, hits: [0.78], hitAt: ['tail'], lock: 1,
    keys: [
      [0, {}],
      [0.45, { body: [0, 0.45, 0.05], tail1: [0.1, 0.55, 0], tail2: [0.05, 0.4, 0], tail3: [0, 0.3, 0], neck: [0, -0.3, 0], head: [0, -0.3, 0], $hips: [0, -0.06, 0] }, 'o'],
      [0.78, { body: [0, -0.55, -0.05], tail1: [0.05, -0.7, 0], tail2: [0, -0.6, 0], tail3: [0, -0.5, 0], tail4: [0, -0.3, 0], neck: [0, 0.35, 0], head: [0, 0.3, 0], $hips: [0, -0.04, 0] }, 'i'],
      [1.05, { body: [0, -0.3, 0], tail1: [0, -0.4, 0], tail2: [0, -0.3, 0], tail3: [0, -0.2, 0], neck: [0, 0.2, 0] }, 'o'],
      [1.5, { body: null, tail1: null, tail2: null, tail3: null, tail4: null, neck: null, head: null }],
    ],
  };
  A.spin_attack = {
    dur: 2.0, hits: [0.85, 1.2], hitAt: ['tail', 'handR'], lock: 1, active: [[0.7, 1.35]],
    keys: [
      [0, {}],
      [0.4, { $hips: [0, -0.2, 0], body: [0, 0.4, 0], neck: [-0.2, -0.3, 0], jaw: [-0.4, 0, 0] }, 'o'],
      [0.55, { $hips: [0, 0.25, 0], $air: 1, body: [0, 0, 0] }, 'o'],
      [0.75, { $hips: [0, 0.4, 0], $air: 1, body: [0, -1.6, 0], tail1: [0, -0.5, 0], tail2: [0, -0.4, 0] }, 'l'],
      [0.95, { $hips: [0, 0.42, 0], $air: 1, body: [0, -3.14, 0] }, 'l'],
      [1.15, { $hips: [0, 0.3, 0], $air: 1, body: [0, -4.7, 0] }, 'l'],
      [1.35, { $hips: [0, -0.12, 0], $air: 0, body: [0, -6.28, 0], tail1: [0, 0, 0], tail2: [0, 0, 0], jaw: [-0.3, 0, 0] }, 'o'],
      [2.0, { body: null, neck: null, jaw: null, tail1: null, tail2: null }],
    ],
    ev: [[1.35, 'land', 'feetFR']],
  };
  A.charge = {
    dur: 3.0, hits: [1.1], hitAt: ['head'], lock: 0, active: [[0.9, 2.3]], move: [{ t: [0.9, 2.3], dist: 16 }], gait: [[0.88, 2.3, 11]],
    keys: [
      [0, {}],
      [0.4, { $hips: [0, -0.16, 0.12], body: [-0.05, 0, 0], neck: [-0.35, 0, 0], head: [-0.05, 0, 0], jaw: [-0.3, 0, 0], $footRR: F('RR', 0, 0.05, 0.15) }, 'o'],
      [0.6, { $footRR: F('RR', 0, 0, -0.05) }, 'i'],
      [0.8, { $footRR: F('RR', 0, 0.05, 0.15) }, 'o'],
      [0.9, { $footRR: null, $hips: [0, -0.08, 0], neck: [-0.4, 0, 0], head: [0.05, 0, 0], jaw: [-0.45, 0, 0] }, 'i'],
      [2.3, { $hips: [0, -0.08, 0], neck: [-0.4, 0, 0], head: [0.05, 0, 0], jaw: [-0.45, 0, 0] }],
      [2.55, { $hips: [0, -0.12, 0.15], body: [0.12, 0, 0], neck: [0.1, 0, 0], jaw: [-0.2, 0, 0], $footFL: F('FL', 0, 0, -0.35), $footFR: F('FR', 0, 0, -0.3) }, 'o'],
      [3.0, { body: null, neck: null, head: null, jaw: null }],
    ],
    ev: [[2.4, 'land', 'feetFL']],
  };
  A.intro = {
    dur: 3.2, hits: [0.72, 2.0], hitAt: ['feetFR', 'mouth'], lock: 1, fadeIn: 0.01, stretch: [0.9, 1.4],
    keys: [
      [0, { $hips: [0, 3.5, -0.8], $air: 1, body: [-0.35, 0, 0], neck: [0.2, 0, 0], jaw: [-0.6, 0, 0] }],
      [0.63, { $hips: [0, 0.4, -0.1], $air: 1, body: [-0.2, 0, 0], neck: [0, 0, 0], jaw: [-0.5, 0, 0] }, 'i'],
      [0.72, { $hips: [0, -0.3, 0.05], $air: 0, body: [-0.1, 0, 0], neck: [-0.4, 0, 0], head: [0.2, 0, 0], jaw: [-0.2, 0, 0], $shake: 0.4 }, 'i'],
      [1.36, { $hips: [0, -0.18, 0.05], body: [-0.05, 0, 0], neck: [-0.45, 0.25, 0], head: [0.25, 0.2, 0], jaw: [-0.55, 0, 0] }, 'o'],
      [1.716, { $hips: [0, -0.14, 0.1], body: [0.3, 0, 0], neck: [0.5, 0, 0], head: [0.4, 0, 0], jaw: [-0.3, 0, 0] }, 'io'],
      [2, { $hips: [0, -0.14, 0.1], body: [0.35, 0, 0], neck: [0.65, 0, 0], head: [0.5, 0, 0], jaw: [-0.75, 0, 0], $shake: 0.8, $body: 0.4 }, 'io'],
      [2.72, { $hips: [0, -0.14, 0.1], body: [0.35, 0, 0], neck: [0.62, 0, 0], head: [0.5, 0, 0], jaw: [-0.7, 0, 0], $shake: 0.7, $body: 0.4 }],
      [3.2, { body: null, neck: null, head: null, jaw: null, $body: 0 }],
    ],
    ev: [[0.72, 'land', 'feetFR'], [2.0, 'howl', 'mouth']],
  };
  A.groggy = {
    dur: 5.0, hits: [], lock: 1, stretch: [1.0, 4.0], sustain: [1.2, 3.8],
    keys: [
      [0, {}],
      [0.3, { body: [0.1, 0, 0.2], neck: [0.2, 0.3, 0], $hips: [0, 0.02, 0.1], $eyes: 0.7 }, 'o'],
      [0.9, { $hips: [0, -0.72, 0], body: [0, 0, 0.12], neck: [-0.35, 0.3, 0], head: [-0.15, 0.3, 0.4], jaw: [-0.35, 0, 0], $footFL: F('FL', -0.25, 0, -0.1), $footFR: F('FR', 0.2, 0, -0.2), $footRL: F('RL', -0.3, 0, 0.1, 0), $footRR: F('RR', 0.3, 0, 0.1, 0), $eyes: 0.35 }, 'i'],
      [4.0, { $hips: [0, -0.72, 0], body: [0, 0, 0.12], neck: [-0.35, 0.3, 0], head: [-0.15, 0.3, 0.4], jaw: [-0.35, 0, 0], $footFL: F('FL', -0.25, 0, -0.1), $footFR: F('FR', 0.2, 0, -0.2), $footRL: F('RL', -0.3, 0, 0.1, 0), $footRR: F('RR', 0.3, 0, 0.1, 0), $eyes: 0.35 }],
      [4.5, { $hips: [0, -0.2, 0], body: [0, 0, 0], neck: [0, -0.3, 0], head: [0, -0.3, 0.3], jaw: [-0.1, 0, 0], $footFL: null, $footFR: null, $footRL: null, $footRR: null, $eyes: 0.8 }, 'o'],
      [5.0, { body: null, neck: null, head: null, jaw: null, $eyes: 1 }],
    ],
  };
  A.death = {
    dur: 3.6, hits: [1.8], hitAt: ['chest'], hold: true, fadeIn: 0.1,
    keys: [
      [0, {}],
      [0.45, { $hips: [0, 0.05, 0.1], body: [0.25, 0, 0], neck: [0.5, 0, 0], head: [0.4, 0, 0], jaw: [-0.7, 0, 0], $shake: 1 }, 'o'],
      [1.2, { $hips: [0, -0.35, 0.05], body: [0.05, 0, 0.3], neck: [-0.2, 0.2, 0], head: [-0.1, 0.2, 0.2], jaw: [-0.5, 0, 0], $footFL: F('FL', 0.1, 0, 0.05), $eyes: 0.6 }, 'i'],
      [1.8, { $hips: [0, -0.95, 0.0], body: [0, 0.1, 1.35], neck: [-0.15, 0.3, 0.1], head: [0.1, 0.4, 0.2], jaw: [-0.35, 0, 0], $air: 1, $eyes: 0.3 }, 'i'],
      [2.2, { $hips: [0, -0.9, 0.0], body: [0, 0.1, 1.3], neck: [-0.18, 0.32, 0.1], head: [0.12, 0.42, 0.2], jaw: [-0.3, 0, 0], $air: 1 }, 'o'],
      [3.6, { $hips: [0, -0.92, 0.0], body: [0, 0.1, 1.32], neck: [-0.2, 0.35, 0.1], head: [0.15, 0.45, 0.2], jaw: [-0.3, 0, 0], $air: 1, $eyes: 0 }],
    ],
    ev: [[1.8, 'land', 'chest']],
  };
  A.hit = { dur: 0.5, hits: [], fadeIn: 0.04, keys: [[0, {}], [0.12, { 'body+': [0.08, 0.05, 0.06], 'neck+': [0.2, 0.1, 0], $hips: [0, 0.02, 0.05] }, 'o'], [0.5, {}]] };
  return def;
}

export const skarn = makeHound('skarn');
export const vesk = makeHound('vesk');
