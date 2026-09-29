// Abyss Caster: floating robed demon priest (~2 m). Deep hood with horns breaking through and a void face lit by three
// eyes, spiked mantle, long bell sleeves with clawed hands, a tattered robe skirt that streams behind it (4 trailing
// bone chains), glowing runes on the stole, and a floating orb that orbits the right hand (bone `orb`, socket `orb`).
// Variants: void (default, violet), ember (orange), blood (crimson & gold); elite: archon (×1.2, gold, twin orbs).
import * as THREE from 'three';
import { HoverCtl, armRot } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bDeath, bStun, bSpawn } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn, lerp3 } from '../../kit/parts.js';
import { orb } from '../parts2.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const PAL = {
  void: { robe: 0x2c1a40, robe2: 0x0e0818, trim: 0x8a2250, skin: 0x3e2a48, glow: 0xd048ff, orb: 0xe8a0ff, eye: 0xff70ff, horn: 0x181220, hornTip: 0xd8c8e0, gold: 0x9a6ab0 },
  ember: { robe: 0x201a1a, robe2: 0x0a0707, trim: 0x9a3a14, skin: 0x4a2420, glow: 0xff6a1a, orb: 0xffb050, eye: 0xffb040, horn: 0x140e0c, hornTip: 0xe0c8a0, gold: 0xb07030 },
  blood: { robe: 0x4a0c14, robe2: 0x1a0408, trim: 0xc8a060, skin: 0x3a1a1c, glow: 0xff3030, orb: 0xff6060, eye: 0xff5040, horn: 0x1a0c0c, hornTip: 0xe8d0b0, gold: 0xc8a060 },
  archon: { robe: 0x1a1030, robe2: 0x080418, trim: 0xe0b040, skin: 0x342646, glow: 0x9a80ff, orb: 0xd0c0ff, eye: 0xf0f0ff, horn: 0x100c18, hornTip: 0xfff0d0, gold: 0xe0b040 },
};

const HOVER = 0.32; // hem clearance above the ground
export const abyss_caster = {
  name: 'Abyss Caster',
  variants: ['void', 'ember', 'blood', 'archon'],
  flying: true,
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'archon' : 'void');
    const elite = v === 'archon' || !!opts.elite;
    return { variant: v, pal: PAL[v === 'void' && elite ? 'archon' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.2 : 1, h: 0.04, hg: { 1: 0.03, 2: 0.022 }, mat: { dfreq: 3, furAxis: 1, rim: 0.4, rimColor: 0xd8b0ff }, aoScale: 1.2, grad: { top: 0.2, bottom: 0.35, y0: 0.2, y1: 1.3, low: 0.3 } };
  },
  rig(R) {
    R.add('root', null, [0, 1.0, 0]);
    R.add('spine', 'root', [0, 1.22, 0.0]);
    R.add('chest', 'spine', [0, 1.48, -0.02]);
    R.add('neck', 'chest', [0, 1.68, -0.04]);
    R.add('head', 'neck', [0, 1.78, -0.05]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', [s * 0.24, 1.6, 0.0]); R.add('armL' + n, 'armU' + n, [s * 0.34, 1.33, 0.03]); R.add('hand' + n, 'armL' + n, [s * 0.38, 1.07, -0.05]);
    }
    R.add('orb', 'handR', [0.42, 1.0, -0.2]);
    R.add('orb2', 'handL', [-0.42, 1.0, -0.2]);
    for (const [n, x, z] of [['F', 0, -1], ['B', 0, 1], ['L', -1, 0], ['R', 1, 0]]) {
      R.add('robe' + n + '1', 'root', [x * 0.2, 0.86, z * 0.2]);
      R.add('robe' + n + '2', 'robe' + n + '1', [x * 0.3, 0.55, z * 0.3]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const cloth = [0, 0, 0.25, 0.55], sk = [0.03, 0.15, 0.2, 0];
    // torso under the robe: narrow waist, broad shoulders
    S.ell('chest', [0, 1.46, -0.01], [0.24, 0.2, 0.16], { k: 0.06, col: c.robe, tag: 'robe', dtl: cloth });
    S.ell('spine', [0, 1.18, 0.0], [0.18, 0.2, 0.15], { k: 0.06, col: c.robe, tag: 'robe', dtl: cloth });
    S.ell('root', [0, 0.98, 0.0], [0.2, 0.14, 0.18], { k: 0.06, col: c.robe, tag: 'robe', dtl: cloth });
    // mantle: layered shoulder cape with a high back collar
    S.ell('chest', [0, 1.6, 0.0], [0.32, 0.1, 0.22], { k: 0.05, col: c.robe2, tag: 'mantle', dtl: cloth });
    S.ell('chest', [0, 1.7, 0.1], [0.2, 0.16, 0.08], { k: 0.05, col: c.robe2, tag: 'collar', rot: [0.35, 0, 0], dtl: cloth });
    // hood (own group, face carved out → void)
    S.ell('head', [0, 1.82, -0.03], [0.15, 0.17, 0.17], { group: 1, k: 0.04, col: c.robe, tag: 'hood', dtl: cloth });
    S.cone('head', [0, 1.93, 0.05], [0, 1.9, 0.22], 0.09, 0.02, { group: 1, k: 0.04, col: c.robe, tag: 'hood', dtl: cloth });
    S.ell('head', [0, 1.8, -0.19], [0.1, 0.12, 0.1], { group: 1, k: 0.02, sub: true, col: 0x050208, tag: 'void' });
    // bell sleeves + clawed hands (hands: fine group)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('armU' + n, [s * 0.24, 1.6, 0.0], [s * 0.34, 1.33, 0.03], 0.075, 0.07, { k: 0.04, col: c.robe, tag: 'sleeve', b2: 'armL' + n, t0: 0.85, t1: 1, dtl: cloth });
      S.cone('armL' + n, [s * 0.34, 1.33, 0.03], [s * 0.385, 1.1, -0.045], 0.07, 0.105, { k: 0.03, col: c.robe, tag: 'sleeve', tip: { col: c.trim, from: 0.82 }, dtl: cloth });
      S.cone('armL' + n, [s * 0.375, 1.17, -0.02], [s * 0.392, 1.06, -0.06], 0.05, 0.09, { k: 0.015, sub: true, col: c.robe2, tag: 'sleeveIn' });
      S.ell('hand' + n, [s * 0.385, 1.03, -0.07], [0.035, 0.05, 0.03], { group: 2, k: 0.015, col: c.skin, tag: 'hand', dtl: sk });
      for (let f = -1; f <= 1; f++) S.cone('hand' + n, [s * 0.385 + f * 0.018, 1.0, -0.08], [s * 0.39 + f * 0.03, 0.93, -0.11], 0.011, 0.006, { group: 2, k: 0.012, col: c.skin, tag: 'finger', dtl: sk });
    }
    if (E) S.ell('chest', [0, 1.62, -0.02], [0.35, 0.06, 0.24], { k: 0.03, col: c.gold, tag: 'mantleGold', dtl: [0, 0.05, 0.2, 0] });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    if (v.group === 0 || v.group === 1) {
      // folds: vertical dark streaks on the robe, darker inside/underside
      v.mul(1 - 0.18 * sstep(0.6, 0.95, Math.abs(Math.sin(Math.atan2(x, z) * 7 + y * 2))) * (v.t('robe') + v.t('hood')));
      v.mix(c.robe2, sstep(0.0, -0.8, ny) * 0.5);
      // stole: a vertical band down the front with glowing runes
      const band = (1 - sstep(0.05, 0.07, Math.abs(x))) * sstep(0.2, 0.6, -nz) * (y < 1.62 ? 1 : 0) * v.t('robe');
      v.mix(c.trim, band);
      const rune = band * sstep(0.55, 0.8, Math.abs(Math.sin(y * 45))) * (1 - sstep(0.02, 0.035, Math.abs(x)));
      if (rune > 0.1) { v.mix(c.glow, rune); v.emis = Math.max(v.emis, 2.2 * rune); }
      v.mix(c.trim, sstep(0.93, 1.0, Math.abs(Math.sin(y * 3.1 + 0.4))) * v.t('mantle') * 0.7);
    }
    if (v.t('void') > 0.2) { v.mix(0x030104, 1); v.dtl[0] = v.dtl[1] = v.dtl[2] = v.dtl[3] = 0; v.aoMul = 0; }
    if (v.group === 2) v.mix(0x100810, sstep(0.94, 0.9, y) * 0.6);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    // three eyes in the void (third eye above)
    for (const [x, y, r] of [[-0.045, 1.8, 0.018], [0.045, 1.8, 0.018], [0, 1.855, 0.014]]) orb(acc, [x, y, -0.16], r, rigid(b('head')), c.eye, E ? 6 : 4.5, 1);
    // horns breaking through the hood, curling back
    const hk = E ? 1.25 : 1;
    for (const s of [-1, 1]) addHorn(acc, b('head'), [s * 0.09, 1.93, -0.06], [s * 0.26 * hk, 2.1 * (E ? 1.02 : 1), 0.0], [s * 0.26 * hk, 2.1, 0.22], 0.045, 0.003, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.5 });
    // fan of tall spines rising behind the hood (reads from the iso camera)
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.32, L = (0.42 - Math.abs(i) * 0.07) * (E ? 1.25 : 1);
      addHorn(acc, b('chest'), [Math.sin(a) * 0.12, 1.72, 0.14], [Math.sin(a) * 0.2, 1.72 + L * 0.55, 0.2], [Math.sin(a) * (0.12 + L * 0.5), 1.72 + L, 0.24], 0.03, 0.002, { base: c.robe2, tip: c.glow, radial: 4, n: 5, gpow: 2.5 });
    }
    // mantle spikes
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      const x = s * (0.24 + i * 0.07);
      addHorn(acc, b('chest'), [x, 1.64, 0.02], [x + s * 0.04, 1.74, 0.05], [x + s * 0.08, 1.78 - i * 0.02, 0.1], 0.022, 0.002, { base: c.robe2, tip: c.hornTip, radial: 4, n: 4 });
    }
    // claws
    for (const s of [-1, 1]) for (let f = -1; f <= 1; f++) {
      const x = s * 0.39 + f * 0.03;
      addHorn(acc, b('hand' + (s < 0 ? 'L' : 'R')), [x, 0.935, -0.11], [x, 0.905, -0.13], [x, 0.89, -0.115], 0.007, 0.001, { base: c.skin, tip: 0x0a0608, radial: 3, n: 3 });
    }
    // ---- robe skirt: tattered lathe from the waist to the hem, two-sided, skinned to 4 trailing chains
    const NA = 20, NR = 7, y0 = 1.02, y1 = HOVER;
    const rOf = (t) => mix(0.2, 0.44, Math.pow(t, 0.8)) + 0.03 * Math.sin(t * Math.PI);
    const hs = (i) => { const q = Math.sin(i * 91.7 + 3.1) * 43758.5; return q - Math.floor(q); };
    const cut = []; for (let j = 0; j <= NA; j++) cut.push(j === NA ? cut[0] : 0.1 * hs(j) + (j % 3 === 0 ? 0.14 * hs(j + 7) : 0));
    const chainIdx = [['F', -Math.PI / 2], ['R', 0], ['B', Math.PI / 2], ['L', Math.PI]];
    const skinAt = (ang, t) => {
      // angle measured from +X toward +Z; chains at F(-Z) R(+X) B(+Z) L(-X)
      let best = [], a = ((ang % TAU) + TAU) % TAU;
      const ws = chainIdx.map(([n, ca]) => { let d = Math.abs(((a - ca) % TAU + TAU + Math.PI) % TAU - Math.PI); return [n, Math.max(0, 1 - d / (Math.PI / 2))]; });
      const tu = sstep(0.05, 0.4, t), tl = sstep(0.45, 0.9, t);
      const si = [], sw = [];
      for (const [n, w] of ws) { if (w <= 0) continue; si.push(b('robe' + n + '1'), b('robe' + n + '2')); sw.push(w * tu * (1 - tl), w * tu * tl); }
      si.push(b('root')); sw.push(1 - tu);
      // top 4 weights
      const ord = sw.map((w2, i) => i).sort((i1, i2) => sw[i2] - sw[i1]).slice(0, 4);
      const s4 = ord.map(i => si[i]), w4 = ord.map(i => sw[i]); const tot = w4.reduce((p, q) => p + q, 0) || 1;
      while (s4.length < 4) { s4.push(0); w4.push(0); }
      return { si: s4, sw: w4.map(w2 => w2 / tot) };
    };
    const cr = col(c.robe), cd = col(c.robe2), ct = col(c.trim), cg = col(c.glow);
    for (const face of [1, -1]) {
      const pos = [], uv = [], idx = [], skins = [];
      for (let i = 0; i <= NR; i++) {
        const t = i / NR;
        for (let j = 0; j <= NA; j++) {
          const ang = j / NA * TAU;
          const tt = i === NR ? 1 - cut[j] * 1.4 : t;
          const r = rOf(Math.min(1, tt)) - (face < 0 ? 0.012 : 0);
          const y = mix(y0, y1 + (i === NR ? cut[j] * 0.9 : 0), t);
          pos.push(Math.cos(ang) * r, y, Math.sin(ang) * r); uv.push(j / NA, t);
          skins.push(skinAt(ang, t));
        }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
        const a = i * (NA + 1) + j, bb = a + 1, cI = a + NA + 1, d = cI + 1;
        if (face > 0) idx.push(a, bb, cI, bb, d, cI); else idx.push(a, cI, bb, bb, cI, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      let vi = 0;
      acc.add(g, {
        skin: () => skins[vi++], dtl: [0, 0, 0.25, 0.55],
        color: (p, n, uvv) => {
          if (face < 0) return lerp3(cd, cr, 0.2);
          const hem = sstep(0.82, 0.96, uvv[1]), fold = sstep(0.55, 0.95, Math.abs(Math.sin(uvv[0] * TAU * 5)));
          const front = Math.abs(((uvv[0] - 0.75 + 1.5) % 1) - 0.5) < 0.035 ? 1 : 0; // stole continues down the front
          return lerp3(lerp3(lerp3(cr, cd, fold * 0.35 + uvv[1] * 0.25), ct, hem * 0.85), ct, front * 0.9);
        },
        emis: (p, uvv) => face > 0 ? 1.4 * sstep(0.93, 0.99, uvv[1]) : 0,
      });
    }
    // ---- the orb (and a second one for the archon): bright core, faint shell, rune ring
    const orbs = E ? [['orb', [0.42, 1.0, -0.2]], ['orb2', [-0.42, 1.0, -0.2]]] : [['orb', [0.42, 1.0, -0.2]]];
    for (const [bn, p] of orbs) {
      orb(acc, p, 0.09, rigid(b(bn)), c.orb, 5.5, 2);
      const ring = new THREE.TorusGeometry(0.12, 0.007, 3, 22);
      acc.add(ring, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.2, 0.3, 0)).setPosition(...p), skin: rigid(b(bn)), color: c.glow, emis: 2.5, dtl: [0, 0, 0, 0] });
    }
  },
  sockets: {
    head: ['head', [0, 2.02, -0.04]], mouth: ['head', [0, 1.78, -0.18]], center: ['chest', [0, 1.35, -0.05]], chest: ['chest', [0, 1.42, -0.2]],
    back: ['chest', [0, 1.55, 0.2]], handR: ['handR', [0.39, 0.98, -0.1]], handL: ['handL', [-0.39, 0.98, -0.1]], orb: ['orb', [0.42, 1.0, -0.2]],
  },
  height: 2.05, radius: 0.45,
  controller(inst) { return new HoverCtl(inst, CASTER_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const ACTIONS = {
  attack: { dur: 0.9, a: 0.08, d: 0.85, hit: 0.5, fn(ctl, a, w) { // orb blast: draw back, thrust the orb hand forward
    const P = ctl.pose, b = ctl.b, k = a.k;
    const draw = sstep(0, 0.4, k) * (1 - sstep(0.42, 0.52, k)), push = sstep(0.42, 0.54, k) * (1 - sstep(0.7, 1, k));
    P.rot(b.chest, (0.1 * draw - 0.15 * push) * w, (0.4 * draw - 0.3 * push) * w, 0);
    armRot(ctl, 1, 0.6 * draw + 1.45 * push, 1.3 * draw + 0.1 * push, w, 0.5 * draw, 0);
    armRot(ctl, -1, 0.3 * draw + 0.3 * push, 0.8, w, 0.3);
    ctl.glow = mix(ctl.glow, 1 + 1.8 * draw + 2.5 * push, w);
    ctl.orbPush = Math.max(ctl.orbPush, push * w);
  } },
  attack2: { dur: 1.0, a: 0.08, d: 0.85, hit: 0.55, fn(ctl, a, w) { // sweep: fling a wave of abyssal fire in an arc
    const P = ctl.pose, b = ctl.b, k = a.k;
    const tw = k < 0.45 ? sstep(0, 0.45, k) : 1 - 2 * sstep(0.45, 0.65, k) + sstep(0.75, 1, k);
    const up = sstep(0, 0.3, k) * (1 - sstep(0.8, 1, k));
    P.rot(b.chest, 0, 0.5 * tw * w, 0); P.rot(b.spine, 0, 0.25 * tw * w, 0);
    armRot(ctl, -1, 1.3 * up, 0.2, w, 0.9 * up, 0);
    armRot(ctl, 1, 1.1 * up, 0.3, w, 0.7 * up, 0);
    ctl.glow = mix(ctl.glow, 1 + 2 * up, w);
  } },
  attack_big: { dur: 2.4, a: 0.05, d: 0.9, hit: 0.66, fn(ctl, a, w) { // ascend with arms raised, the orb swells overhead (telegraph) → slam it down
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rise = sstep(0, 0.35, k) * (1 - sstep(0.62, 0.68, k)), slam = sstep(0.6, 0.67, k) * (1 - sstep(0.82, 1, k));
    const trem = sstep(0.35, 0.6, k) * (1 - sstep(0.6, 0.64, k)) * Math.sin(t * 40) * 0.02;
    P.move(b.root, 0, (0.45 * rise - 0.2 * slam) * w, 0);
    P.rot(b.root, (-0.1 * rise + 0.25 * slam + trem) * w, 0, 0);
    P.rot(b.chest, (0.25 * rise - 0.35 * slam) * w, 0, 0); P.rot(b.head, (0.35 * rise - 0.2 * slam) * w, 0, 0);
    armRot(ctl, -1, 2.8 * rise + 1.0 * slam, 0.25 * rise, w, 0.4 * rise, 0);
    armRot(ctl, 1, 2.8 * rise + 1.0 * slam, 0.25 * rise, w, 0.4 * rise, 0);
    ctl.glow = mix(ctl.glow, 1 + 3 * sstep(0.05, 0.62, k) * (1 - sstep(0.7, 0.9, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.6, k) * (1 - sstep(0.64, 0.72, k)) * w);
    ctl.orbGrow = Math.max(ctl.orbGrow, sstep(0.05, 0.6, k) * (1 - sstep(0.64, 0.7, k)) * w);
    ctl.flare = Math.max(ctl.flare, rise * w);
  } },
  cast: { dur: 1.4, a: 0.1, d: 0.85, hit: 0.6, fn(ctl, a, w) { // chant: both hands forward, weaving
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const up = sstep(0, 0.3, k) * (1 - sstep(0.85, 1, k));
    const wv = Math.sin(t * 9) * 0.15 * up;
    P.rot(b.chest, 0.1 * up * w, 0, 0); P.rot(b.head, 0.15 * up * w, 0, 0);
    armRot(ctl, -1, 1.2 * up + wv, 0.7 * up, w, 0.2, 0);
    armRot(ctl, 1, 1.2 * up - wv, 0.7 * up, w, 0.2, 0);
    ctl.glow = mix(ctl.glow, 1 + 2 * up, w);
    ctl.orbPush = Math.max(ctl.orbPush, 0.4 * up * w);
  } },
  roar: { dur: 1.5, a: 0.1, d: 0.85, fn(ctl, a, w) { // shriek: recoil, arms flung wide
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.2, k) * (1 - sstep(0.8, 1, k));
    P.rot(b.chest, 0.25 * up * w, 0, 0); P.rot(b.head, (0.4 * up + Math.sin(t * 40) * 0.03 * up) * w, 0, 0);
    armRot(ctl, -1, 1.0 * up, 0.3, w, 1.1 * up); armRot(ctl, 1, 1.0 * up, 0.3, w, 1.1 * up);
    ctl.glow = mix(ctl.glow, 1 + 2 * up, w);
  } },
  idle_alt: { dur: 3.0, a: 0.15, d: 0.85, fn(ctl, a, w) { // the orb drifts around the caster; head tracks it
    const P = ctl.pose, b = ctl.b, t = a.t;
    ctl.orbOrbit = Math.max(ctl.orbOrbit, w);
    P.rot(b.head, 0.1 * w, Math.sin(t * TAU / 3) * 0.5 * w, 0);
    armRot(ctl, 1, 0.9, 0.9, w, 0.3);
  } },
  hit: bHit({ dur: 0.45 }),
  knockback: bKnockback({ dur: 0.9 }),
  knockdown: bKnockdown({ lieY: 0.22, pitch: 1.35 }),
  getup: bGetup({ lieY: 0.22, pitch: 1.35 }),
  death: bDeath({ dist: 1.0, peak: 0.25, spin: 0.15, lieY: 0.2, pitch: 1.4 }),
  stun: bStun({ dur: 1.8 }),
  spawn: bSpawn({ depth: 1.3, dur: 1.8 }),
};

const CASTER_SPEC = {
  bones: {
    root: 'root', hips: 'root', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'],
    trail: [['robeF1', 'robeF2'], ['robeB1', 'robeB2'], ['robeL1', 'robeL2'], ['robeR1', 'robeR2']],
  },
  hoverH: 0, bob: 0.07, bobF: 0.35, lean: 0.22, bank: 0.15, trailK: 0.1, flutter: 0.06, runV: 4, headLean: 0.1,
  arm: { up: 0.35, out: 0.22, elbow: 0.75, combatUp: 0.35, combatElbow: 0.35, trail: 0.35 },
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 5,
  pose(ctl, dt) {
    ctl.orbPush = 0; ctl.orbGrow = 0; ctl.orbOrbit = 0; ctl.flare = 0;
  },
  post(ctl) { // after actions: animate the orb bones (float above the palm, orbit, push, swell)
    const P = ctl.pose, B = P.b, t = ctl.t;
    const bob = Math.sin(t * 2.3) * 0.03, orbit = ctl.orbOrbit;
    const ox = Math.cos(t * 2.1) * 0.25 * orbit, oz = Math.sin(t * 2.1) * 0.25 * orbit;
    P.move(B.orb, ox - 0.02 * ctl.orbPush, bob + 0.06 + 0.25 * orbit, oz - 0.18 * ctl.orbPush);
    P.sc[B.orb].setScalar(1 + 0.08 * Math.sin(t * 5) + 1.4 * ctl.orbGrow + 0.3 * ctl.orbPush);
    P.move(B.orb2, 0, Math.sin(t * 2.3 + 1.5) * 0.03 + 0.06, 0);
    P.sc[B.orb2].setScalar(1 + 0.08 * Math.sin(t * 5 + 2) + 1.0 * ctl.orbGrow);
  },
  actions: ACTIONS,
};
