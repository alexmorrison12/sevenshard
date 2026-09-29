// Wraith: ~2.1 m floating hooded ghost. SDF hood with a pointed cowl, shoulder mantle and a black void face with two
// burning eyes; a flared, deeply tattered robe (custom mesh skinned across 8 cloth chains that swing back with speed,
// lag behind turns, flare outward and billow at idle), bell sleeves with ragged cuffs, long skeletal claws, spectral
// glow rising up the hem with flickering wisps at the tatter tips, strong spectral rim light.
// Variants: shade (slate / teal), banshee (pale shroud / sickly green, long spectral hair), elite dreadwraith (×1.3,
// violet-black with magenta soul-fire, iron crown, shoulder spikes, chains).
// Death: shudders, the robe collapses and it sinks while burning away (uDissolve). Spawn: rises out of the ground.
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { sweep, rigid, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn } from '../../kit/parts.js';
import { flame, orb } from '../parts2.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { lerp3, hash, knob, easeOut } from './common.js';

const V3 = THREE.Vector3;
const PAL = {
  shade: { cloak: 0x2c3a4c, cloak2: 0x10161f, inner: 0x05080c, trim: 0x46607a, glow: 0x3cf2dc, glow2: 0x1a8a9a, eye: 0xb8fff4, hand: 0x94a2a8, claw: 0x1a2026, rim: 0x5affe8 },
  banshee: { cloak: 0x8a988a, cloak2: 0x4a564c, inner: 0x0a100c, trim: 0xb8c4b0, glow: 0x9cff6a, glow2: 0x4a9a3a, eye: 0xeaffd0, hand: 0xb4bcae, claw: 0x28301e, rim: 0xc8ff9a, hair: 0xe4f0dc },
  dreadwraith: { cloak: 0x261a36, cloak2: 0x0e0816, inner: 0x040208, trim: 0x5a4a6a, glow: 0xd04cff, glow2: 0x6a1aa0, eye: 0xffd0ff, hand: 0x8a8298, claw: 0x120c18, rim: 0xe070ff, iron: 0x2a2830, iron2: 0x5a5660 },
};
const NCH = 8, LV = [1.3, 0.92, 0.54];              // cloth chains around the body, pivot heights of their 3 bones
const TOP = 1.63;                                    // robe top (under the mantle)
const SHO = [0.215, 1.655, 0.03], ELB = [0.335, 1.4, -0.02], WRI = [0.385, 1.16, -0.1];
const mx = (p, s) => [p[0] * s, p[1], p[2]];
const robeR = (y) => { const v = clamp01((TOP - y) / (TOP - 0.1)); return 0.165 + 0.34 * Math.pow(v, 0.85); };
const chainAng = (c) => (c + 0.5) / NCH * TAU;      // θ: x = sin θ, z = cos θ (θ = 0 → back, π → front)

export const wraith = {
  name: 'Wraith',
  variants: ['shade', 'banshee', 'dreadwraith'],
  canFly: true,
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'dreadwraith' : 'shade');
    const elite = v === 'dreadwraith' || !!opts.elite;
    const pal = PAL[v];
    return {
      variant: v, pal, elite, dread: v === 'dreadwraith', banshee: v === 'banshee', shapeKey: 'base', scale: elite ? 1.3 : 1,
      h: 0.034, hg: { 1: 0.032 }, aoScale: 1.2, castShadow: true,
      mat: { dfreq: 3.5, furAxis: 1, rim: 0.55, rimColor: pal.rim, dissolveCol: pal.glow, wrap: 0.6 },
    };
  },
  rig(R) {
    R.add('root', null, [0, 1.25, 0.02]);
    R.add('spine', 'root', [0, 1.45, 0.03]); R.add('chest', 'spine', [0, 1.6, 0.03]); R.add('head', 'chest', [0, 1.74, 0.0]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', mx(SHO, s)); R.add('armL' + n, 'armU' + n, mx(ELB, s)); R.add('hand' + n, 'armL' + n, mx(WRI, s));
    }
    for (let c = 0; c < NCH; c++) {
      const th = chainAng(c);
      let par = 'root';
      for (let l = 0; l < 3; l++) { const r = robeR(LV[l]) * 0.97; const n = 'rb' + c + '_' + l; R.add(n, par, [Math.sin(th) * r, LV[l], Math.cos(th) * r]); par = n; }
    }
    R.add('hood', 'head', [0, 1.92, 0.12]);                            // cowl tip
    for (const s of [-1, 1]) { const n = s < 0 ? 'L' : 'R'; R.add('hair1' + n, 'head', [s * 0.08, 1.74, -0.06]); R.add('hair2' + n, 'hair1' + n, [s * 0.12, 1.45, -0.1]); }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, cl = [0, 0, 0.35, 0.35];
    // mantle over the shoulders (the robe hangs from under it)
    S.ell('chest', [0, 1.6, 0.035], [0.25, 0.1, 0.17], { k: 0.06, col: c.cloak, tag: 'mantle', dtl: cl });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.17, 1.62, 0.03], [0.1, 0.075, 0.12], { k: 0.05, col: c.cloak, tag: 'mantle', dtl: cl });
    // hood: thick shell with a deep front opening and a pointed cowl sweeping back
    S.ell('head', [0, 1.8, 0.02], [0.155, 0.165, 0.175], { k: 0.04, col: c.cloak, tag: 'hood', dtl: cl });
    S.cone('head', [0, 1.86, 0.06], [0, 1.95, 0.2], 0.1, 0.02, { k: 0.06, col: c.cloak, tag: 'hood', dtl: cl });
    S.ell('head', [0, 1.79, -0.02], [0.118, 0.13, 0.14], { sub: true, k: 0.02, col: c.inner, tag: 'void' });
    S.ell('head', [0, 1.77, -0.18], [0.105, 0.125, 0.12], { sub: true, k: 0.03, col: c.inner, tag: 'void' });
    // brow of the hood (overhang), neck drape
    S.ell('head', [0, 1.9, -0.1], [0.13, 0.05, 0.08], { k: 0.035, col: c.cloak, tag: 'brim', dtl: cl });
    S.ell('chest', [0, 1.66, -0.06], [0.13, 0.07, 0.1], { k: 0.05, col: c.cloak, tag: 'mantle', dtl: cl });
    // void face (separate surface inside the hood): near-black, faintly lit from within
    S.ell('head', [0, 1.77, -0.01], [0.1, 0.12, 0.1], { group: 1, k: 0.03, col: c.inner, tag: 'face' });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    if (v.group === 1) { v.c[0] = v.c[1] = v.c[2] = 0.004; v.mix(c.glow2, 0.12 * sstep(1.72, 1.82, y)); v.emis = 0.12; v.aoMul = 0; return; }
    const vd = v.t('void');
    v.mix(c.inner, sstep(0.3, 0.75, vd));
    if (vd > 0.3) { v.mix(c.glow2, 0.2 * vd * sstep(1.7, 1.85, y)); v.emis = 0.25 * vd; }
    // hood trim along the opening, darker creases
    const rimLine = sstep(0.12, 0.3, vd) * (1 - sstep(0.3, 0.5, vd));
    v.mix(c.trim, rimLine * 0.7);
    v.mix(c.cloak2, sstep(0.2, -0.6, ny) * 0.4);
    v.mul(0.92 + 0.08 * Math.sin(x * 40 + y * 13) * Math.sin(z * 31));
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    const cC = col(c.cloak), cC2 = col(c.cloak2), cI = col(c.inner), cG = col(c.glow), cG2 = col(c.glow2);
    // ---------------- robe: flared bell, deep ragged hem, folds; skinned across the cloth chains
    const NC = 24, NR = 8, hem = [];
    for (let j = 0; j < NC; j++) {
      const th = j / NC * TAU, front = Math.max(0, -Math.cos(th)), back = Math.max(0, Math.cos(th));
      hem.push(j % 2 === 0 ? 0.07 + hash(j, 1) * 0.06 - back * 0.03 + front * 0.05 : 0.3 + hash(j, 2) * 0.16 + front * 0.06);
    }
    const chainIdx = (c0, l) => b('rb' + c0 + '_' + l);
    const skinRobe = (th, y) => {
      let f = th / (TAU / NCH) - 0.5; f = ((f % NCH) + NCH) % NCH;
      const c0 = Math.floor(f) % NCH, c1 = (c0 + 1) % NCH, t = f - Math.floor(f);
      if (y >= LV[0]) { // upper robe: chest ↔ top chain bones
        const u = sstep(LV[0], LV[0] + 0.18, y);
        return { si: [chainIdx(c0, 0), chainIdx(c1, 0), b('spine'), 0], sw: [(1 - t) * (1 - u), t * (1 - u), u, 0] };
      }
      const l = y >= LV[1] ? 0 : y >= LV[2] ? 1 : 2;
      const tv = l === 2 ? 0 : clamp01((LV[l] - y) / (LV[l] - LV[l + 1]));
      const l1 = Math.min(2, l + 1);
      return { si: [chainIdx(c0, l), chainIdx(c0, l1), chainIdx(c1, l), chainIdx(c1, l1)], sw: [(1 - t) * (1 - tv), (1 - t) * tv, t * (1 - tv), t * tv] };
    };
    for (const side of [1, -1]) { // outer cloth, then the dark inner lining
      const pos = [], uv = [], idx = [], skinI = [], skinW = [];
      for (let i = 0; i <= NR; i++) for (let j = 0; j <= NC; j++) {
        const jj = j % NC, th = j / NC * TAU, v = i / NR;
        const yb = hem[jj];
        const y = mix(TOP, yb, Math.pow(v, 0.92));
        let r = robeR(y) * (1 + 0.07 * Math.sin(th * 8 + 0.6) * sstep(TOP, 0.9, y) + 0.04 * Math.sin(th * 13 + y * 5) * sstep(1.1, 0.3, y));
        if (side < 0) r -= 0.012;
        const bz = sstep(0.9, 0.1, y) * 0.06 * Math.max(0, Math.cos(th)); // trailing back
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r * 0.92 + bz);
        uv.push(j / NC, v);
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) {
        const a = i * (NC + 1) + j, bb = a + 1, cI2 = a + NC + 1, d = cI2 + 1;
        if (side > 0) idx.push(a, bb, cI2, bb, d, cI2); else idx.push(a, cI2, bb, bb, cI2, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      acc.add(g, {
        skin: (p) => skinRobe(Math.atan2(p.x, p.z + 1e-9) < 0 ? Math.atan2(p.x, p.z) + TAU : Math.atan2(p.x, p.z), p.y),
        color: (p, n, u) => {
          const hemK = sstep(0.75, 0.12, p.y), fold = 0.5 + 0.5 * Math.sin(u[0] * TAU * 8 + 0.6);
          if (side < 0) return lerp3(cI, cG2, hemK * 0.35);
          return lerp3(lerp3(cC, cC2, (1 - fold) * 0.45 + sstep(1.5, 1.62, p.y) * 0.2), cG, hemK * hemK * 0.65);
        },
        emis: (p) => { const hemK = sstep(0.62, 0.1, p.y); return side < 0 ? 0.15 + 0.9 * hemK : hemK * hemK * 1.5; },
        dtl: [0, 0, 0.35, 0.3],
      });
    }
    // wisps licking down from the long tatter points
    const fcol = { core: c.eye, mid: c.glow, tip: c.glow2 };
    for (let j = 0; j < NC; j += E ? 2 : 4) {
      const th = j / NC * TAU, y = hem[j] + 0.03, r = robeR(y);
      const base = [Math.sin(th) * r, y, Math.cos(th) * r * 0.92 + 0.06 * Math.max(0, Math.cos(th))];
      const sk = skinRobe(th, y);
      flame(acc, base, [Math.sin(th) * 0.3, -1, Math.cos(th) * 0.3 + 0.15], 0.17 + hash(j, 5) * 0.08, 0.035, sk, fcol, { emis: 2.4, n: 4, radial: 4, bend: [0, 0.6, 0.35], flick: 1.6 });
    }
    // ---------------- sleeves: bell shaped, ragged cuffs, double sided; arms: skeletal claws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      const sh = new V3(...mx(SHO, s)), el = new V3(...mx(ELB, s)), wr = new V3(...mx(WRI, s));
      const cuff = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.07));
      const pts = [sh.clone().add(new V3(-s * 0.03, 0.03, 0)), sh.clone().lerp(el, 0.5), el, el.clone().lerp(cuff, 0.5), cuff];
      const rads = [0.075, 0.075, 0.08, 0.11, 0.14];
      for (const face of [1, -1]) {
        const g = sweep(pts, rads.map(r => face > 0 ? r : r - 0.01), { radial: 9, capEnd: false });
        const pa = g.attributes.position, ua = g.attributes.uv;
        for (let i = 0; i < pa.count; i++) if (ua.getY(i) > 0.99) { // ragged cuff
          const k = Math.round(ua.getX(i) * 9) % 9, d = (k % 2 ? 0.07 : 0) + hash(k + s * 10, 3) * 0.05;
          const dir = cuff.clone().sub(el).normalize();
          pa.setXYZ(i, pa.getX(i) + dir.x * d, pa.getY(i) + dir.y * d, pa.getZ(i) + dir.z * d);
        }
        if (face < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
        g.computeVertexNormals();
        const L1 = sh.distanceTo(el);
        acc.add(g, {
          skin: (p) => { const d = p.clone().sub(sh).dot(el.clone().sub(sh).normalize()); const t = sstep(L1 * 0.8, L1 * 1.1, d); return { si: [b('armU' + n), b('armL' + n), 0, 0], sw: [1 - t, t, 0, 0] }; },
          color: (p, nn, u) => face > 0 ? lerp3(lerp3(cC, cC2, 0.3 + 0.3 * Math.sin(u[0] * TAU * 3)), cG, sstep(0.75, 1, u[1]) * 0.45) : lerp3(cI, cG2, sstep(0.6, 1, u[1]) * 0.4),
          emis: (p, u) => sstep(0.7, 1, u[1]) * (face > 0 ? 0.9 : 0.6),
          dtl: [0, 0, 0.35, 0.3],
        });
      }
      claw(acc, b('hand' + n), s, wr, cuff, c);
    }
    // ---------------- eyes: burning points deep in the void, soul-flames rising
    for (const s of [-1, 1]) {
      orb(acc, [s * 0.045, 1.785, -0.098], 0.021, rigid(b('head')), c.eye, 6, 1);
      knob(acc, rigid(b('head')), [s * 0.045, 1.785, -0.088], 0.032, c.glow, { emis: 1.6, ws: 6, hs: 3, sy: 0.7, dtl: [0, 0, 0, 0] });
      flame(acc, [s * 0.046, 1.8, -0.1], [s * 0.3, 1, -0.2], 0.1, 0.016, rigid(b('head')), { core: c.eye, mid: c.glow, tip: c.glow2 }, { emis: 2.6, n: 4, radial: 4, bend: [s * 0.2, 0, 0.5] });
    }
    // ---------------- banshee: long spectral hair streaming from the hood
    if (cfg.banshee) {
      const cH = col(c.hair);
      for (const s of [-1, 1]) {
        const n = s < 0 ? 'L' : 'R';
        for (let k = 0; k < 3; k++) {
          const x0 = s * (0.095 + k * 0.018), z0 = -0.05 + k * 0.035;
          const p = [new V3(x0, 1.86, z0), ...bez([s * (0.115 + k * 0.02), 1.74, z0 - 0.07], [s * (0.15 + k * 0.03), 1.5, z0 - 0.1], [s * (0.14 + k * 0.045), 1.2 - k * 0.07, z0 - 0.06], 6)];
          acc.add(sweep(p, [0.02, 0.03, 0.032, 0.028, 0.022, 0.014, 0.004], { radial: 4, flat: 0.35, up: [0, 0, 1] }), {
            skin: (q) => { const t = sstep(1.72, 1.42, q.y); return { si: [b('hair1' + n), b('hair2' + n), 0, 0], sw: [1 - t, t, 0, 0] }; },
            color: (q, nn, u) => lerp3(cH, cG, sstep(0.5, 1, u[1]) * 0.6), emis: (q, u) => 0.1 + sstep(0.4, 1, u[1]) * 1.0, dtl: [0.35, 0, 0.2, 0],
          });
        }
      }
    }
    // ---------------- dreadwraith: iron crown, shoulder spikes, hanging chain links
    if (cfg.dread) {
      const cI1 = col(c.iron), cI3 = col(c.iron2);
      acc.add(new THREE.TorusGeometry(0.145, 0.016, 5, 16), { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.12).setPosition(0, 1.9, 0.0), skin: rigid(b('head')), color: cI3, dtl: [0, 0, 0.3, 0] });
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k - 3) * 0.42, x = Math.sin(a) * 0.145, z = Math.cos(a) * 0.145;
        addHorn(acc, b('head'), [x, 1.9, z], [x * 1.08, 1.98 + (k === 3 ? 0.06 : 0), z * 1.08], [x * 1.12, 2.02 + (k === 3 ? 0.12 : 0.04), z * 1.12], 0.018, 0.002, { base: c.iron, tip: c.iron2, radial: 4, n: 3 });
      }
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) addHorn(acc, b('chest'), [s * (0.18 + k * 0.06), 1.66, 0.05 - k * 0.04], [s * (0.24 + k * 0.08), 1.78, 0.08], [s * (0.26 + k * 0.1), 1.86 - k * 0.04, 0.14], 0.03, 0.003, { base: c.iron, tip: c.iron2, radial: 5, n: 4 });
      for (let k = 0; k < 9; k++) { // chain across the chest
        const t = k / 8, p = [mix(-0.2, 0.2, t), 1.5 - Math.sin(t * Math.PI) * 0.12, -0.19 + Math.sin(t * Math.PI) * 0.0];
        acc.add(new THREE.TorusGeometry(0.022, 0.006, 3, 6), { matrix: new THREE.Matrix4().makeRotationY(k % 2 ? Math.PI / 2 : 0).setPosition(...p), skin: rigid(b('chest')), color: cI1, dtl: [0, 0, 0.3, 0] });
      }
    }
  },
  sockets: {
    head: ['head', [0, 2.02, 0.02]], mouth: ['head', [0, 1.74, -0.12]], center: ['chest', [0, 1.35, 0.0]], chest: ['chest', [0, 1.45, -0.15]],
    back: ['chest', [0, 1.55, 0.2]], handR: ['handR', [0.4, 1.06, -0.15]], handL: ['handL', [-0.4, 1.06, -0.15]], eyes: ['head', [0, 1.785, -0.11]],
    hem: ['root', [0, 0.25, 0]],
  },
  height: 2.05, radius: 0.5,
  controller(inst) { return new WraithCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

/** skeletal claw: palm, four long knuckled fingers with hooked black claws, thumb */
function claw(acc, bone, s, wr, cuff, c) {
  const cH = col(c.hand), cK = col(c.claw), sk = rigid(bone);
  const dir = cuff.clone().sub(wr).normalize(), side = new V3(s, 0, 0), fw = new V3(0, 0, -1);
  const palm = wr.clone().addScaledVector(dir, 0.05);
  acc.add(new THREE.BoxGeometry(0.05, 0.07, 0.03), { matrix: new THREE.Matrix4().lookAt(new V3(), dir, new V3(0, 0, 1)).setPosition(palm.x, palm.y, palm.z), skin: sk, color: cH, dtl: [0, 0.1, 0.3, 0] });
  for (let f = 0; f < 4; f++) {
    const o = (f - 1.5) * 0.02;
    const k0 = palm.clone().addScaledVector(dir, 0.035).addScaledVector(fw, o * 0.6).addScaledVector(side, o * 0.8);
    const L = 0.13 - Math.abs(f - 1.5) * 0.015;
    const k1 = k0.clone().addScaledVector(dir, L * 0.5).addScaledVector(fw, -0.01);
    const k2 = k0.clone().addScaledVector(dir, L * 0.85).addScaledVector(fw, -0.04).addScaledVector(side, o * 0.3);
    const k3 = k2.clone().addScaledVector(dir, 0.02).addScaledVector(fw, -0.035);
    acc.add(sweep([k0, k1, k2], [0.0085, 0.007, 0.006], { radial: 4 }), { skin: sk, color: cH, dtl: [0, 0.1, 0.3, 0] });
    knob(acc, sk, k1.toArray(), 0.009, c.hand, { ws: 4, hs: 3 });
    acc.add(sweep(bez(k2.toArray(), k2.clone().addScaledVector(dir, 0.03).toArray(), k3.clone().addScaledVector(fw, -0.012).toArray(), 4), [0.0065, 0.005, 0.003, 0.0005], { radial: 4 }), { skin: sk, color: cK, dtl: [0, 0, 0.2, 0] });
  }
  const t0 = palm.clone().addScaledVector(side, -s * 0.0).addScaledVector(fw, 0.0).addScaledVector(new V3(-s, 0, 0), 0.025);
  acc.add(sweep(bez(t0.toArray(), t0.clone().addScaledVector(dir, 0.04).addScaledVector(fw, 0.02).toArray(), t0.clone().addScaledVector(dir, 0.07).addScaledVector(fw, 0.045).toArray(), 4), [0.008, 0.007, 0.005, 0.002], { radial: 4 }), { skin: sk, color: cH, dtl: [0, 0.1, 0.3, 0] });
}

// ================================================================================================ controller
/**
 * Hovering body + cloth chains. Each chain is a damped 2D spring (lower-end offset dx, dz per unit length) driven by
 * forward speed (swing back), acceleration, turning (tangential lag + centrifugal flare) and an idle billow wave;
 * actions add flare (ctl.flare), lift (ctl.lift), collapse (ctl.fold) and a forward/back push (ctl.robeZ).
 */
class WraithCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    const P = this.pose;
    this.chains = []; for (let c = 0; c < NCH; c++) this.chains.push([0, 1, 2].map(l => P.b['rb' + c + '_' + l]));
    this.th = new Float32Array(NCH); for (let c = 0; c < NCH; c++) this.th[c] = chainAng(c);
    this.dx = new Float32Array(NCH); this.dz = new Float32Array(NCH); this.vx = new Float32Array(NCH); this.vz = new Float32Array(NCH);
    this.hair = P.b.hair1L !== undefined ? [P.b.hair1L, P.b.hair2L, P.b.hair1R, P.b.hair2R] : null;
    this.hood = P.b.hood;
    this.flare = 0; this.lift = 0; this.fold = 0; this.robeZ = 0; this.hover = 0; this.dis = 0; this._disSet = false;
    this.hairV = 0; this.hairA = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed * this.locoW, turn = this._turn * this.locoW, t = this.t;
    const k4 = 1 - Math.exp(-4 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k4;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k4;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-3 * dt));
    this.run = clamp01(Math.abs(this.speedSm) / 4.5);
    const moveK = clamp01(Math.abs(this.speedSm) / 1.5), idle = 1 - moveK;
    P.reset();
    this.jaw = 0; this.glow = 1 + 0.12 * Math.sin(t * 3.1) * Math.sin(t * 1.7); this.flare = 0; this.lift = 0; this.fold = 0; this.robeZ = 0;
    this.flame = 1;
    // ---- hover body: slow bob, drift, lean into motion, bank into turns
    const bob = Math.sin(t * TAU * 0.35) * 0.06 + Math.sin(t * 1.3) * 0.02;
    P.move(b.root, Math.sin(t * 0.8) * 0.02, bob * this.locoW, 0);
    P.rot(b.root, -0.22 * moveK * Math.sign(this.speedSm) - clamp01(this.accel * 0.08) * 0.1 + 0.08 * this.combat, Math.sin(t * 0.5) * 0.04, this.turnSm * 0.14);
    P.rot(b.spine, 0.03 * Math.sin(t * 1.3) + 0.06 * this.combat, 0, 0.02 * Math.sin(t * 0.9));
    P.rot(b.chest, 0.02 * Math.sin(t * 1.3 + 1) + 0.12 * this.combat, 0, 0);
    // ---- head: menacing slow looks, head low in combat
    this._look(dt, idle, 0.5);
    const L = this.look;
    P.rot(b.head, L.p * 0.6 - 0.1 * this.combat + 0.04 * Math.sin(t * 0.7), L.y * 0.7 + this.turnSm * 0.2, 0.05 * Math.sin(t * 0.6));
    // ---- arms: claws dangle forward, rise & spread in combat, trail when moving fast
    for (let s = -1; s <= 1; s += 2) {
      const arm = s < 0 ? b.armL : b.armR;
      const sw = Math.sin(t * 1.1 + (s > 0 ? 0 : 2)) * 0.07;
      P.rot(arm[0], 0.35 + sw + 0.55 * this.combat - 0.55 * this.run, s * 0.12 * this.combat, s * (0.18 + 0.2 * this.combat + 0.15 * this.run));
      P.rot(arm[1], 0.45 + 0.35 * this.combat + 0.1 * Math.sin(t * 1.4 + s), 0, 0);
      P.rot(arm[2], 0.25 * this.combat + 0.12 * Math.sin(t * 2.1 + s), 0, s * 0.1);
    }
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    // ---- cloth chains (after actions: they add flare / lift / fold / push)
    const v = this.speedSm, w = this.turnSm;
    const kS = 40, kD = 7.5;
    for (let c = 0; c < NCH; c++) {
      const th = this.th[c], sx = Math.sin(th), cz = Math.cos(th);
      const billow = (0.05 + 0.03 * idle) * Math.sin(t * 1.6 + th * 2) + 0.03 * Math.sin(t * 2.7 - th * 3);
      const out = billow + this.flare * (0.8 + 0.2 * Math.sin(t * 9 + th * 3)) - this.fold * 0.35;
      let tx = sx * out - 0.28 * w * cz + clamp01(Math.abs(v) / 5) * w * 0.35;
      let tz = cz * out + 0.1 * v + 0.012 * this.accel + 0.28 * w * sx + this.robeZ;
      tx = Math.max(-1.2, Math.min(1.2, tx)); tz = Math.max(-1.2, Math.min(1.2, tz));
      this.vx[c] += ((tx - this.dx[c]) * kS - this.vx[c] * kD) * dt; this.dx[c] += this.vx[c] * dt;
      this.vz[c] += ((tz - this.dz[c]) * kS - this.vz[c] * kD) * dt; this.dz[c] += this.vz[c] * dt;
      const ch = this.chains[c];
      for (let i = 0; i < 3; i++) {
        const g = [0.35, 0.4, 0.45][i], ripple = Math.sin(t * 2.4 - i * 1.1 + th) * 0.04;
        P.rot(ch[i], (-this.dz[c] + ripple * cz - this.fold * 0.25 * cz) * g, 0, (this.dx[c] + ripple * sx + this.fold * 0.25 * sx) * g);
      }
    }
    if (this.hood !== undefined) P.rx(this.hood, -0.2 * this.run - 0.05 * Math.sin(t * 1.5));
    if (this.hair) {
      const ht = -(0.25 * this.run + 0.1 * clamp01(Math.abs(v))) + this.flare * 0.3;
      this.hairV += ((ht - this.hairA) * 30 - this.hairV * 5) * dt; this.hairA += this.hairV * dt;
      for (let s = 0; s < 2; s++) { P.rot(this.hair[s * 2], this.hairA * 0.6 + 0.04 * Math.sin(t * 2 + s), 0, (s ? 1 : -1) * 0.05 * Math.sin(t * 1.3 + s)); P.rot(this.hair[s * 2 + 1], this.hairA * 0.8 + 0.05 * Math.sin(t * 2.6 + s), 0, 0); }
    }
    P.fk();
    P.apply(this.inst.bones);
    // ---- burn-away while dying (never fights the game's own setDissolve; reset on revive)
    if (this.dis > 0.001) { const u = this.u; u.uDissolve.value = Math.max(u.uDissolve.value, this.dis); this._disSet = true; this.inst.mesh.castShadow = u.uDissolve.value < 0.35; }
    else if (this._disSet && !this.dead) { this.u.uDissolve.value = 0; this._disSet = false; this.inst.mesh.castShadow = true; }
    this.dis = 0;
    this._uniforms();
  }
}

// ================================================================================================ actions
const arm = (ctl, s, up, out, el, wr = 0, tw = 0, w = 1) => { const A = s < 0 ? ctl.b.armL : ctl.b.armR, P = ctl.pose; P.rot(A[0], up * w, tw * w, s * out * w); P.rx(A[1], el * w); if (wr) P.rx(A[2], wr * w); };
const ACTIONS = {
  attack: { dur: 0.72, a: 0.06, d: 0.85, hit: 0.46, fn(ctl, a, w) { // claw rake: right claw rears up and rakes down across
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.36, k) * (1 - sstep(0.38, 0.5, k)), rake = sstep(0.38, 0.52, k) * (1 - sstep(0.62, 1, k));
    P.move(b.root, 0, 0.05 * wind * w, (0.06 * wind - 0.22 * rake) * w);
    P.rot(b.root, (0.12 * wind - 0.22 * rake) * w, (0.35 * wind - 0.45 * rake) * w, 0);
    P.rot(b.chest, 0, (0.2 * wind - 0.3 * rake) * w, 0);
    P.rot(b.head, (0.15 * wind - 0.15 * rake) * w, (-0.25 * wind + 0.2 * rake) * w, 0);
    arm(ctl, 1, 2.6 * wind + 0.5 * rake, 0.6 * wind - 0.4 * rake, 0.9 * wind + 0.1 * rake, -0.5 * wind + 0.4 * rake, -0.6 * rake, w);
    arm(ctl, -1, 0.5 * wind, 0.3 * wind, 0.3, 0, 0, w);
    ctl.robeZ += (0.1 * wind + 0.35 * rake) * w; ctl.flare += 0.15 * rake * w;
    ctl.glow = mix(ctl.glow, 1.6, rake * w);
  } },
  attack2: { dur: 0.95, a: 0.05, d: 0.85, hit: 0.5, fn(ctl, a, w) { // lunge: coil back, shoot forward ~1.4 m claws first, drift back
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const coil = sstep(0, 0.3, k) * (1 - sstep(0.34, 0.44, k)), dash = sstep(0.36, 0.48, k), back = sstep(0.62, 1, k);
    const z = 0.18 * coil - 1.4 * dash * (1 - back);
    P.move(b.root, 0, (0.08 * coil - 0.12 * dash * (1 - back)) * w, z * w);
    P.rot(b.root, (0.2 * coil - 0.45 * dash * (1 - back)) * w, 0, 0);
    P.rot(b.head, (0.2 * coil - 0.25 * dash * (1 - back)) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) arm(ctl, s, 0.8 * coil + 1.75 * dash * (1 - back), 0.5 * coil + 0.1 * dash, 1.1 * coil + 0.15 * dash * (1 - back), -0.3 * dash, 0, w);
    ctl.robeZ += (-0.2 * coil + 1.1 * sstep(0.36, 0.44, k) * (1 - sstep(0.5, 0.8, k))) * w;
    ctl.glow = mix(ctl.glow, 2.0, dash * (1 - back) * w);
  } },
  attack_big: { dur: 2.1, a: 0.04, d: 0.9, hit: 0.72, fn(ctl, a, w) { // rise up & wail (long telegraph, robe flares, soul-fire swells) → soul burst
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rise = sstep(0, 0.45, k) * (1 - sstep(0.8, 1, k)), wail = sstep(0.2, 0.5, k) * (1 - sstep(0.7, 0.74, k));
    const burst = sstep(0.7, 0.74, k) * (1 - sstep(0.82, 1, k)), trem = sstep(0.4, 0.7, k) * (1 - sstep(0.7, 0.72, k)) * Math.sin(t * 50) * 0.04;
    P.move(b.root, trem, (0.6 * rise - 0.25 * burst) * w, 0.1 * rise * w);
    P.rot(b.root, (0.18 * wail - 0.3 * burst + trem) * w, 0, trem * w);
    P.rot(b.chest, (0.2 * wail - 0.25 * burst) * w, 0, 0);
    P.rot(b.head, (0.65 * wail - 0.4 * burst + trem * 2) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) arm(ctl, s, 1.9 * wail + 0.7 * burst, 1.1 * wail + 0.9 * burst, 0.35 * wail + 0.1 * burst, -0.3 * wail, s * 0.2 * wail, w);
    ctl.flare += (0.35 * wail + 1.3 * burst) * w; ctl.lift += rise * w;
    const g = sstep(0.1, 0.7, k) * (1 - sstep(0.76, 0.9, k));
    ctl.glow = mix(ctl.glow, 1 + 3 * g + 2 * burst, w); ctl.charge = Math.max(ctl.charge, g * w);
  } },
  cast: { dur: 1.25, a: 0.08, d: 0.86, hit: 0.62, fn(ctl, a, w) { // claws gather a ball of soul-fire, then thrust it forward
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const gather = sstep(0, 0.45, k) * (1 - sstep(0.58, 0.66, k)), push = sstep(0.58, 0.66, k) * (1 - sstep(0.8, 1, k));
    const jit = Math.sin(t * 40) * 0.03 * gather;
    P.move(b.root, 0, 0.12 * gather * w, (0.06 * gather - 0.2 * push) * w);
    P.rot(b.root, (0.1 * gather - 0.2 * push) * w, 0, 0);
    P.rot(b.head, (0.1 * gather - 0.15 * push) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) arm(ctl, s, 1.2 * gather + 1.5 * push + jit, -0.25 * gather - 0.1 * push, 1.3 * gather + 0.2 * push, 0.3 * gather - 0.4 * push, 0, w);
    ctl.flare += 0.2 * gather * w; ctl.robeZ += 0.4 * push * w;
    ctl.glow = mix(ctl.glow, 1 + 2 * gather + 1.5 * push, w); ctl.charge = Math.max(ctl.charge, 0.6 * gather * w);
  } },
  roar: { dur: 1.5, a: 0.1, d: 0.85, fn(ctl, a, w) { // wail: head thrown back, arms wide, robe flaring
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const u = sstep(0, 0.25, k) * (1 - sstep(0.8, 1, k)), sh = Math.sin(t * 45) * 0.03 * u;
    P.move(b.root, 0, 0.18 * u * w, 0);
    P.rot(b.root, (0.12 * u + sh) * w, 0, sh * w); P.rot(b.head, (0.6 * u + sh * 2) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) arm(ctl, s, 1.4 * u, 1.2 * u, 0.4 * u, -0.3 * u, 0, w);
    ctl.flare += 0.6 * u * w;
    ctl.glow = mix(ctl.glow, 2.4, u * w); ctl.charge = Math.max(ctl.charge, 0.4 * u * w);
  } },
  idle_alt: { dur: 2.6, a: 0.12, d: 0.85, fn(ctl, a, w) { // slow turn of the head, claws flexing, robe swirling
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const u = Math.sin(k * Math.PI);
    P.rot(b.head, 0.15 * u * w, Math.sin(k * TAU) * 0.6 * w, 0.2 * u * w);
    arm(ctl, 1, 0.5 * u, 0.2 * u, 0.9 * u, 0.4 * Math.sin(t * 8) * u, 0, w);
    arm(ctl, -1, 0.4 * u, 0.15 * u, 0.8 * u, 0.4 * Math.sin(t * 8 + 1) * u, 0, w);
    P.ry(b.root, 0.25 * Math.sin(k * TAU) * w);
    ctl.flare += 0.25 * u * w;
  } },
  hit: { dur: 0.42, a: 0.04, d: 0.4, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, s = Math.sin(a.seed * 7.1) > 0 ? 1 : -1;
    const j = sstep(0, 0.1, k) * (1 - sstep(0.25, 1, k)) * w;
    P.move(b.root, 0, 0.03 * j, 0.12 * j); P.rot(b.root, 0.25 * j, 0.15 * s * j, 0.12 * s * j); P.rot(b.head, 0.3 * j, 0, 0.2 * s * j);
    arm(ctl, 1, 0.6 * j, 0.4 * j, 0.5 * j, 0, 0, 1); arm(ctl, -1, 0.6 * j, 0.4 * j, 0.5 * j, 0, 0, 1);
    ctl.robeZ -= 0.35 * j; ctl.glow = mix(ctl.glow, 0.3 + 0.7 * Math.abs(Math.sin(a.t * 60)), j);
  } },
  knockback: { dur: 0.85, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const j = sstep(0, 0.08, k) * (1 - sstep(0.45, 1, k)) * w;
    P.move(b.root, 0, 0.08 * j, 0.25 * j); P.rot(b.root, 0.45 * j, 0, 0); P.rot(b.head, 0.4 * j, 0, 0);
    arm(ctl, 1, 1.3 * j, 0.7 * j, 0.3 * j, 0, 0, 1); arm(ctl, -1, 1.2 * j, 0.7 * j, 0.3 * j, 0, 0, 1);
    ctl.robeZ -= 0.9 * j; ctl.flare += 0.2 * j;
  } },
  knockdown: { dur: 0.8, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0, fn(ctl, a, w) { // topples back, sinks low, robe spread
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const fall = sstep(0.05, 0.6, k), tw = Math.pow(Math.max(0, Math.sin(t * 1.4 + a.seed)), 10) * sstep(1.2, 1.6, t);
    P.move(b.root, 0, -0.95 * fall * w, 0.35 * fall * w);
    P.rot(b.root, 1.2 * fall * w, 0, 0.15 * fall * w);
    P.rot(b.head, (-0.3 * fall - 0.2 * tw) * w, 0.4 * fall * w, 0);
    arm(ctl, 1, -0.2, 1.2, 0.3, 0, 0, fall * w); arm(ctl, -1, -0.1, 1.1, 0.4, 0, 0, fall * w);
    ctl.fold += 0.2 * fall * w; ctl.robeZ -= 0.4 * fall * w;
    ctl.glow = mix(ctl.glow, 0.5, fall * w);
  } },
  getup: { dur: 1.0, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const down = 1 - sstep(0.1, 0.8, k);
    P.move(b.root, 0, -0.95 * down * w, 0.35 * down * w);
    P.rot(b.root, 1.2 * down * w - 0.15 * Math.sin(k * Math.PI) * w, 0, 0);
    arm(ctl, 1, 0.8 * Math.sin(k * Math.PI), 0.6, 0.4, 0, 0, w); arm(ctl, -1, 0.8 * Math.sin(k * Math.PI), 0.6, 0.4, 0, 0, w);
    ctl.flare += 0.3 * Math.sin(k * Math.PI) * w;
  } },
  stun: { dur: 1.8, loop: true, state: true, fadeIn: 0.25, fadeOut: 0.3, fn(ctl, a, w) { // drifting, head lolling, glow guttering
    const P = ctl.pose, b = ctl.b, ph = a.t / 1.8 * TAU;
    P.move(b.root, Math.sin(ph) * 0.06 * w, -0.12 * w, 0);
    P.rot(b.root, 0.1 * w, 0, Math.sin(ph) * 0.12 * w);
    P.rot(b.head, (0.35 + 0.15 * Math.sin(ph)) * w, 0.4 * Math.cos(ph) * w, 0.3 * Math.sin(ph) * w);
    arm(ctl, 1, -0.2, 0.1, 0.1, 0, 0, w); arm(ctl, -1, -0.2, 0.1, 0.1, 0, 0, w);
    ctl.glow = mix(ctl.glow, 0.45 + 0.35 * Math.abs(Math.sin(a.t * 13)) * Math.abs(Math.sin(a.t * 3.1)), w);
  } },
  death: { dur: 2.2, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, fn(ctl, a, w) { // shudder → eyes flare → sink, robe collapses, burns away
    const P = ctl.pose, b = ctl.b, t = a.t;
    const jolt = sstep(0, 0.06, t) * (1 - sstep(0.12, 0.4, t)), sink = sstep(0.25, 1.9, t), shud = (1 - sstep(0.2, 1.2, t)) * Math.sin(t * 55) * 0.05;
    const low = a.u.fromDown ? 0.6 : 0;
    P.move(b.root, shud * w, (-1.25 * easeOut(sink) - low) * w, (0.1 * jolt) * w);
    P.rot(b.root, (0.35 * jolt + 0.25 * sink + shud) * w, 0, shud * w);
    P.rot(b.head, (0.5 * jolt - 0.6 * sink) * w, 0, 0.3 * sink * w);
    arm(ctl, 1, 1.4 * jolt - 0.2 * sink, 0.9 * jolt + 0.5 * sink, 0.2, 0, 0, w); arm(ctl, -1, 1.3 * jolt - 0.2 * sink, 0.9 * jolt + 0.5 * sink, 0.2, 0, 0, w);
    ctl.flare += (0.6 * jolt) * w; ctl.fold += 1.1 * sink * w; ctl.robeZ -= 0.2 * jolt * w;
    ctl.glow = mix(ctl.glow, t < 0.3 ? 3 : Math.max(0, 1.2 - (t - 0.3) * 1.2), w);
    ctl.flame = 1 - sstep(0.4, 1.4, t);
    ctl.dis = Math.max(ctl.dis, sstep(0.5, 2.1, t) * 1.02 * w);
  } },
  spawn: { dur: 1.7, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // rises out of the ground, robe streaming down, eyes ignite
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rise = easeOut(sstep(0.0, 0.7, k)), flare = sstep(0.62, 0.72, k) * (1 - sstep(0.8, 1, k));
    P.move(b.root, 0, (-2.3 * (1 - rise) + 0.15 * flare) * w, 0);
    P.rot(b.root, 0.15 * (1 - rise) * w, (1 - rise) * 1.2 * w, 0);
    P.rot(b.head, (0.5 * flare - 0.3 * (1 - rise)) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) arm(ctl, s, 2.4 * (1 - rise) + 1.2 * flare, 0.2 + 0.9 * flare, 0.2, 0, 0, w);
    ctl.robeZ += 0.8 * (1 - rise) * w; ctl.fold -= 0.3 * (1 - rise) * w; ctl.flare += 0.9 * flare * w;
    ctl.glow = mix(ctl.glow, 0.3 + 2.5 * flare + 0.7 * rise, w);
  } },
};
const SPEC = {
  bones: { root: 'root', spine: 'spine', chest: 'chest', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 4.5, chargeK: 0.35,
  actions: ACTIONS,
};
