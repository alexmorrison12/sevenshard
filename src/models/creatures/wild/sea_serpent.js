// Sea serpent — sea-bounty / sailing encounter. ~24 m long; at rest the head is ~4.5 m above the water and the body
// surfaces in 2–3 coiling arches behind the neck. The root sits ON the waterline (y = 0) where the neck enters the water;
// everything below y = 0 is hidden by the opaque open sea.
// Look: dragon-like finned head (spiny crest, side frills, backswept horns, glowing eyes, barbels), big jaws full of
// fangs, a scaly tube body (dtl scale channel) with a pale scute belly, a scalloped dorsal fin ridge along the arches
// and a paddle tail. Variants: abyssal (default: deep teal, bioluminescent spots), coral (red-gold); elite: leviathan
// (×1.3, storm-black with glowing cyan spots and fin edges, extra horns, taller crest).
// Rig: head (+ jaw, frills) and a 31-bone spine placed every frame along a procedural PATH: a cubic neck curve from the
// head down to the water entry, then a travelling helical wave that rises out of and dips under the surface. Bones sit
// at fixed arc lengths along the path (the body slides along it when the head reaches out — no stretching); frames are
// parallel-transported (no twist). Actions steer the path parameters (head pose, entry point, wave, sink offsets).
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { sweep, rigid, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU, frameRot } from '../../kit/rig.js';
import { loftZ, chainSkin, fanSheet, twoSided, fkBones, topAt, V3 } from './common.js';

const PAL = {
  abyssal: { back: 0x123844, side: 0x2a6c72, belly: 0xd6e0bc, band: 0x0a2430, spot: 0x6ff6ff, spotEm: 1.15, fin: 0x1f7a80, finEdge: 0x7ae8d8, finEm: 0.32, spine: 0x0a2228, horn: 0x16222a, hornTip: 0xd8e8d8, mouth: 0x4a1020, gum: 0x7a2034, tongue: 0x9a3448, tooth: 0xf2ecd8, eye: 0x7affe8, eyeGlow: 3.2 },
  coral: { back: 0x7e1a1a, side: 0xc8562a, belly: 0xf4dcb0, band: 0x4a0a0e, spot: 0xffd070, spotEm: 0, fin: 0xd8782a, finEdge: 0xffe0a0, finEm: 0, spine: 0x4a0c0e, horn: 0x34120e, hornTip: 0xf4e0b8, mouth: 0x3e0a12, gum: 0x8a2230, tongue: 0xa83a44, tooth: 0xfff4dc, eye: 0xffc040, eyeGlow: 3.0 },
  leviathan: { back: 0x0c121c, side: 0x1c2a3c, belly: 0x98a4b0, band: 0x04060a, spot: 0x60e8ff, spotEm: 1.8, fin: 0x16324c, finEdge: 0x60e0ff, finEm: 0.8, spine: 0x04060a, horn: 0x080a10, hornTip: 0xb0e8ff, mouth: 0x300820, gum: 0x5a1432, tongue: 0x7a2448, tooth: 0xe8f0f4, eye: 0xa0faff, eyeGlow: 4.5 },
};

// ------------------------------------------------------------------------------------------------ proportions (rest pose)
// Rest pose: the serpent lies straight along +Z at y = 0 (head base = bone 'head' at the origin, snout toward −Z).
const BODY_L = 22;
const SPINE_S = [0];
for (let s = 0.6; s <= 6.01; s += 0.6) SPINE_S.push(+s.toFixed(3));
for (let s = 6.72; s <= 21.2; s += 0.72) SPINE_S.push(+s.toFixed(3));
const SPN = SPINE_S.map((s, i) => i === 0 ? 'head' : 'sp' + i);
const RXK = [[-0.45, 0.26], [-0.1, 0.29], [0.8, 0.34], [2, 0.4], [4, 0.48], [7, 0.53], [10.5, 0.52], [14, 0.46], [17, 0.37], [19.5, 0.24], [21.2, 0.11], [22, 0.015]];
function rxAt(s) {
  if (s <= RXK[0][0]) return RXK[0][1];
  for (let i = 1; i < RXK.length; i++) if (s <= RXK[i][0]) { const u = (s - RXK[i - 1][0]) / (RXK[i][0] - RXK[i - 1][0]); return mix(RXK[i - 1][1], RXK[i][1], u * u * (3 - 2 * u)); }
  return RXK[RXK.length - 1][1];
}
const ryAt = (s) => rxAt(s) * (1 + 0.24 * sstep(11, 20, s));
const finH = (s) => (s < 1.4 ? mix(0.3, 0.42, s / 1.4) : mix(0.42, 0.3, sstep(1.4, 14, s))) + 0.34 * sstep(15.5, 19, s) * (1 - sstep(20.6, 22, s)) - 0.3 * sstep(21.2, 22, s);
const SPINE_GAP = 0.42;
// the head is authored at unit size and scaled by HS around the head bone (sculpt, parts, bones, sockets)
const HS = 1.18;
const hp = (p) => [p[0] * HS, p[1] * HS, p[2] * HS];
function headSculpt(S) {
  const o2 = (o) => ({ ...o, k: (o.k ?? 0.03) * HS });
  return {
    ell: (b, c, r, o = {}) => S.ell(b, hp(c), r.map(v => v * HS), o2(o)),
    sph: (b, c, r, o = {}) => S.sph(b, hp(c), r * HS, o2(o)),
  };
}

export const sea_serpent = {
  name: 'Sea Serpent',
  variants: ['abyssal', 'coral', 'leviathan'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'leviathan' : 'abyssal');
    const elite = v === 'leviathan' || !!opts.elite;
    return {
      variant: v, pal: PAL[v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.3 : 1,
      h: 0.068, hg: { 1: 0.06 }, ao: { dist: 0.07, str: 0.75 }, grad: { top: 0.15, bottom: 0.3 }, castShadow: true,
      mat: { dfreq: 0.95, rim: 0.3, rimColor: 0xbfe8ff, spec: 0.26, shine: 40, wrap: 0.45 }, sphereMul: 2.2,
    };
  },
  rig(R) {
    R.add('head', null, [0, 0, 0]);
    for (let i = 1; i < SPINE_S.length; i++) R.add(SPN[i], null, [0, 0, SPINE_S[i]]);
    R.add('jaw', 'head', hp([0, -0.13, -0.3]));
    R.add('frillL', 'head', hp([-0.34, 0.04, -0.14])); R.add('frillR', 'head', hp([0.34, 0.04, -0.14]));
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const sc = [0, 0.5, 0.2, 0], scS = [0, 0.3, 0.2, 0];
    const H = headSculpt(S);
    // ---- skull (group 0): braincase, occiput blending into the neck tube, long flat snout, brows, cheekbones
    H.ell('head', [0, 0.1, -0.5], [0.37, 0.27, 0.52], { k: 0.12, col: c.back, tag: 'skull', dtl: sc });
    H.ell('head', [0, 0.03, -0.1], [0.36, 0.34, 0.34], { k: 0.12, col: c.side, tag: 'occ', dtl: sc });
    H.ell('head', [0, 0.04, -1.2], [0.27, 0.17, 0.56], { k: 0.12, col: c.back, tag: 'snout', dtl: sc });
    H.ell('head', [0, 0.01, -1.72], [0.18, 0.13, 0.2], { k: 0.08, col: c.back, tag: 'snout', dtl: scS });
    for (const s of [-1, 1]) {
      H.ell('head', [s * 0.21, 0.27, -0.84], [0.12, 0.08, 0.33], { k: 0.07, col: c.back, tag: 'brow', rot: [-0.12, s * 0.22, s * 0.25], dtl: sc });
      H.ell('head', [s * 0.29, -0.02, -0.46], [0.14, 0.17, 0.36], { k: 0.09, col: c.side, tag: 'cheek', dtl: sc });
      H.sph('head', [s * 0.1, 0.14, -1.6], 0.07, { k: 0.05, col: c.back, tag: 'nosebump', dtl: scS });
      H.sph('head', [s * 0.1, 0.18, -1.67], 0.032, { k: 0.02, sub: true, col: 0x0a0a0a, tag: 'nostril' });
      H.ell('head', [s * 0.27, 0.2, -0.92], [0.1, 0.09, 0.1], { k: 0.04, sub: true, col: 0x0a0a0a, tag: 'socket' }); // eye sockets
    }
    // palate: carve the underside so the open mouth reads hollow
    H.ell('head', [0, -0.2, -1.02], [0.23, 0.13, 0.78], { k: 0.05, sub: true, col: c.mouth, tag: 'mouth' });
    // ---- lower jaw (group 1)
    H.ell('jaw', [0, -0.2, -0.5], [0.29, 0.14, 0.36], { group: 1, k: 0.1, col: c.side, tag: 'jaw', dtl: sc });
    H.ell('jaw', [0, -0.22, -1.05], [0.23, 0.1, 0.52], { group: 1, k: 0.1, col: c.side, tag: 'jaw', dtl: sc });
    H.ell('jaw', [0, -0.2, -1.6], [0.15, 0.085, 0.17], { group: 1, k: 0.07, col: c.side, tag: 'chin', dtl: scS });
    H.ell('jaw', [0, -0.08, -1.0], [0.18, 0.08, 0.7], { group: 1, k: 0.04, sub: true, col: c.mouth, tag: 'mouthL' });
    H.ell('jaw', [0, -0.13, -0.85], [0.11, 0.045, 0.42], { group: 1, k: 0.05, col: c.tongue, tag: 'tongue', cw: 3 });
    if (E) for (const s of [-1, 1]) H.ell('head', [s * 0.3, 0.1, -0.25], [0.12, 0.14, 0.2], { k: 0.08, col: c.back, tag: 'boss', dtl: sc });
  },
  paint(v, cfg) {
    const c = cfg.pal, x = v.p[0] / HS, y = v.p[1] / HS, z = v.p[2] / HS, [nx, ny, nz] = v.n;
    if (v.group === 0) {
      v.mix(c.side, sstep(0.2, -0.5, ny) * 0.6);
      v.mix(c.belly, sstep(-0.3, -0.85, ny) * sstep(-0.05, -0.16, y) * 0.7);
      // mouth interior (palate) + gums along the lip line
      const m = v.t('mouth');
      if (m > 0.2) { v.mix(c.mouth, clamp01(m * 1.4)); v.aoMul = 0.3; }
      v.mix(c.gum, sstep(0.25, 0.1, Math.abs(y + 0.12)) * sstep(-0.3, -0.7, ny) * (1 - sstep(-0.25, -0.1, z)) * 0.5);
      v.mix(0x060606, v.t('nostril') * 0.9);
      v.mix(0x05080a, v.t('socket') * 0.8);
      // dark brow stripe running back from the eye
      const st = Math.abs(y - 0.23 - (z + 0.9) * -0.12) < 0.05 && z > -0.95 && z < -0.25 && Math.abs(x) > 0.2 ? 1 : 0;
      v.mix(c.band, st * 0.55);
    } else {
      v.mix(c.belly, sstep(-0.2, -0.75, ny) * 0.9);
      if (v.t('mouthL') > 0.2 || v.t('tongue') > 0.4) { v.mix(v.t('tongue') > 0.4 ? c.tongue : c.mouth, 0.9); v.aoMul = 0.4; }
    }
    // spotted scales on the head for the glowing variants
    if (c.spotEm && v.group === 0 && ny > -0.2) {
      const sp = Math.sin(x * 21 + 1.3) * Math.sin(z * 17 + y * 9);
      if (sp > 0.93 && Math.abs(x) > 0.12) { v.mix(c.spot, 0.9); v.emis = c.spotEm * 0.7; }
    }
    v.mul(1 + Math.sin(x * 13 + z * 7) * Math.sin(y * 11) * 0.05);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, E = cfg.elite, b = (n) => R.index(n), hd = b('head'), jw = b('jaw');
    const idx = SPN.map(n => b(n));
    const skin = (s) => chainSkin(SPINE_S, idx, s);
    const cBack = col(c.back), cSide = col(c.side), cBelly = col(c.belly), cBand = col(c.band), cSpot = col(c.spot);
    // ================================================================= body tube (lofted, analytic chain skinning)
    const rings = [];
    for (let s = -0.45; s < BODY_L; s += s < 7 ? 0.18 : 0.25) rings.push({ z: s, rx: rxAt(s), ry: ryAt(s), ryB: ryAt(s) * 0.9 });
    rings.push({ z: BODY_L, rx: 0, ry: 0 });
    const radial = 16;
    const tube = loftZ(rings, radial);
    const ringOf = (zz) => { let i = 0; while (i < rings.length - 1 && rings[i + 1].z <= zz + 1e-4) i++; return i; };
    acc.add(tube, {
      skin: (p) => skin(p.z),
      dtl: [0, 0.55, 0.22, 0],
      color: (p, n, uv) => {
        const s = p.z, ry = ryAt(s), rx = rxAt(s);
        const up = clamp01(Math.abs(p.y) / Math.max(1e-3, ry)) * Math.sign(p.y), lat = p.x / Math.max(1e-3, rx);
        const dors = sstep(0.05, 0.8, up), belly = sstep(-0.35, -0.72, up);
        let cc = lerp3(cSide, cBack, dors);
        // wavy saddle bands across the back and flanks
        const band = sstep(0.45, 0.85, Math.sin(s * 3.6 + Math.sin(s * 1.1) * 1.4 + lat * 0.7)) * sstep(-0.3, 0.4, up) * (1 - sstep(19, 21.5, s));
        cc = lerp3(cc, cBand, band * 0.55);
        // flank mottle
        cc = lerp3(cc, cBack, (0.5 + 0.5 * Math.sin(s * 7.3 + lat * 5) * Math.sin(s * 2.1 - up * 4)) * 0.22 * (1 - belly));
        // pale belly with scute bands (alternate rings)
        const ri = ringOf(s);
        const scute = ri % 2 ? 0.86 : 1.0;
        cc = lerp3(cc, cBelly.map(q => q * scute), belly);
        // throat: lighter under the head
        cc = lerp3(cc, cBelly, sstep(-0.1, -0.5, up) * (1 - sstep(0.4, 1.8, s)) * 0.6);
        // spots: two zig-zag rows along the flanks (glowing for abyssal / leviathan)
        const k = Math.round((s - 0.9) / 0.5), sc0 = 0.9 + k * 0.5, row = (k % 2 ? -0.2 : 0.02) + (c.spotEm ? 0 : 0.25);
        const d = Math.hypot((s - sc0) / 0.1, (Math.asin(clamp01(Math.abs(up)) * Math.sign(up)) - Math.asin(row)) / 0.24);
        const spot = (1 - sstep(0.35, 0.95, d)) * sstep(0.5, 1.2, s) * (1 - sstep(19.5, 21, s));
        return lerp3(cc, cSpot, spot * (c.spotEm ? 0.95 : 0.55));
      },
      emis: (p) => {
        if (!c.spotEm) return 0;
        const s = p.z, ry = ryAt(s), up = clamp01(Math.abs(p.y) / Math.max(1e-3, ry)) * Math.sign(p.y);
        const k = Math.round((s - 0.9) / 0.5), sc0 = 0.9 + k * 0.5, row = k % 2 ? -0.2 : 0.02;
        const d = Math.hypot((s - sc0) / 0.1, (Math.asin(clamp01(Math.abs(up)) * Math.sign(up)) - Math.asin(row)) / 0.24);
        return (1 - sstep(0.35, 0.95, d)) * sstep(0.5, 1.2, s) * (1 - sstep(19.5, 21, s)) * c.spotEm;
      },
    });
    // ================================================================= dorsal fin ridge (+ ventral tail fin): scalloped spiny membrane
    const cFin = col(c.fin), cEdge = col(c.finEdge), cSp = col(c.spine);
    const spinePeak = (s) => { const f = ((s - 0.2) / SPINE_GAP) % 1; const d = Math.min(f, 1 - f); return Math.pow(1 - clamp01(d / 0.5), 2.2); };
    const strip = (s0, s1, ds, base, edge, lean, wb, we, side) => {
      const pos = [], uv = [], ix = [];
      let n = 0;
      for (let s = s0; s <= s1 + 1e-6; s += ds) {
        const b0 = base(s), e0 = edge(s);
        pos.push(side * wb, b0, s, side * we, e0, s + lean(s));
        uv.push(0, s, 1, s);
        if (n) { const a = (n - 1) * 2, bb = a + 1, cc2 = a + 2, dd = a + 3; if (side > 0) ix.push(a, bb, cc2, cc2, bb, dd); else ix.push(a, cc2, bb, cc2, dd, bb); }
        n++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(ix); g.computeVertexNormals();
      return g;
    };
    const finCol = (p, n, uv) => { const f = uv[0], s = uv[1], pk = spinePeak(s); return lerp3(lerp3(cFin, cEdge, sstep(0.35, 1, f)), cSp, sstep(0.55, 0.95, pk) * (0.5 + 0.5 * f) * 0.85); };
    const finEm = (p, uv) => c.finEm * sstep(0.6, 1, uv[0]) * (0.6 + 0.4 * spinePeak(uv[1]));
    for (const side of [-1, 1]) {
      const g = strip(0.12, BODY_L - 0.05, 0.1, (s) => ryAt(s) - 0.05, (s) => ryAt(s) + finH(s) * (E ? 1.25 : 1) * (0.6 + 0.4 * spinePeak(s)), (s) => 0.1 * finH(s) + 0.05 * spinePeak(s), 0.04, 0.007, side);
      acc.add(g, { skin: (p) => skin(p.z), color: finCol, emis: finEm, dtl: [0, 0.1, 0.25, 0] });
      const gv = strip(15.6, BODY_L - 0.05, 0.1, (s) => -ryAt(s) * 0.85 + 0.03, (s) => -ryAt(s) - 0.36 * sstep(15.6, 18.5, s) * (1 - sstep(20.8, 22, s)) * (0.65 + 0.35 * spinePeak(s)), () => 0.06, 0.035, 0.006, side);
      acc.add(gv, { skin: (p) => skin(p.z), color: finCol, emis: finEm, dtl: [0, 0.1, 0.25, 0] });
    }
    // ================================================================= head crest: a tall spiny sail along the skull midline
    const crestH = (z) => ((0.2 + 0.4 * sstep(-1.05, -0.2, z / HS)) * (1 - 0.3 * sstep(-0.1, 0.12, z / HS)) * (E ? 1.35 : 1)) * HS;
    const topY = (z) => topAt(S, 0, z, 0);
    for (const side of [-1, 1]) {
      const cp = (z) => Math.pow(Math.abs(Math.cos((z / HS + 1.08) / 0.24 * Math.PI)), 3);
      const g = strip(-1.08 * HS, 0.12 * HS, 0.07, (z) => topY(z) - 0.05, (z) => topY(z) + crestH(z) * (0.62 + 0.38 * cp(z)), (z) => 0.18 * crestH(z), 0.05, 0.009, side);
      acc.add(g, { skin: (p) => p.z < 0 ? rigid(hd) : skin(p.z), color: (p, n, uv) => lerp3(lerp3(cFin, cEdge, sstep(0.35, 1, uv[0])), cSp, 0.6 * sstep(0.7, 1, cp(uv[1])) * uv[0]), emis: (p, uv) => c.finEm * sstep(0.6, 1, uv[0]), dtl: [0, 0.1, 0.2, 0] });
    }
    // ================================================================= side frills (fan fins behind the jaw hinge)
    for (const s of [-1, 1]) {
      const fb = b(s < 0 ? 'frillL' : 'frillR');
      const root = hp([s * 0.34, 0.04, -0.14]);
      const L = (E ? 0.95 : 0.78) * HS;
      // fan in a plane swept back & out: u = back, v = up
      const ax = new V3(s * 0.55, 0, 1).normalize(), ay = new V3(-s * 0.12, 1, 0.05).normalize();
      const map = (u, v) => [root[0] + ax.x * u + ay.x * v, root[1] + ax.y * u + ay.y * v, root[2] + ax.z * u + ay.z * v];
      const outline = [];
      const rays = [[0.25, 0.46], [0.62, 0.38], [0.86, 0.12], [0.8, -0.16], [0.52, -0.34]];
      for (let r = 0; r < rays.length; r++) {
        outline.push([rays[r][0] * L, rays[r][1] * L]);
        if (r < rays.length - 1) { const m0 = rays[r], m1 = rays[r + 1]; outline.push([(m0[0] + m1[0]) * 0.5 * L * 0.8, (m0[1] + m1[1]) * 0.5 * L * 0.8]); }
      }
      const g = twoSided(fanSheet(outline, [0, 0], (u, v) => map(u, v), 4), 0.012);
      acc.add(g, {
        skin: rigid(fb), dtl: [0, 0.1, 0.2, 0],
        color: (p, n, uv) => { const f = uv[0], t = uv[1] * (outline.length - 1); const ray = Math.abs(t - Math.round(t)) < 0.01 && Math.round(t) % 2 === 0 ? 1 : 0; return lerp3(lerp3(cFin, cEdge, sstep(0.3, 1, f)), cSp, ray * 0.75); },
        emis: (p, uv) => c.finEm * sstep(0.55, 1, uv[0]),
      });
      // spines along the rays (rigid)
      for (const r of rays) {
        const tip = map(r[0] * L * 1.06, r[1] * L * 1.06), mid = map(r[0] * L * 0.5, r[1] * L * 0.5 + 0.02);
        acc.add(sweep(bez(root, mid, tip, 4), taper(4, 0.028 * HS, 0.004), { radial: 4 }), { skin: rigid(fb), color: (p, n, uv) => lerp3(cSp, col(c.hornTip), sstep(0.6, 1, uv[1])), dtl: [0, 0, 0.1, 0] });
      }
    }
    // ================================================================= eyes, horns, teeth, barbels
    for (const s of [-1, 1]) addEye(acc, S, hd, hp([s * 0.27, 0.2, -0.92]), [s * 0.8, 0.12, -0.55], 0.085 * HS, { iris: c.eye, pupil: 0x020608, rim: 0x050a0c, pupilA: 0.22, irisA: 1.15, glow: c.eyeGlow, sink: 0.4, seg: 12 });
    for (const s of [-1, 1]) {
      const hs2 = E ? 1.3 : 1;
      addHorn(acc, hd, hp([s * 0.19, 0.3, -0.62]), hp([s * 0.3 * hs2, 0.46 * hs2, -0.2]), hp([s * 0.36 * hs2, 0.5 * hs2, 0.32 * hs2]), 0.075 * hs2 * HS, 0.008, { base: c.horn, tip: c.hornTip, radial: 7, n: 7, gpow: 1.6 });
      addHorn(acc, hd, hp([s * 0.33, 0.02, -0.36]), hp([s * 0.46, 0.0, -0.22]), hp([s * 0.54, -0.02, -0.02]), 0.05 * HS, 0.005, { base: c.horn, tip: c.hornTip, radial: 5, n: 5, gpow: 1.5 }); // cheek spike
      if (E) addHorn(acc, hd, hp([s * 0.25, 0.22, -0.3]), hp([s * 0.42, 0.3, -0.05]), hp([s * 0.5, 0.32, 0.3]), 0.06 * HS, 0.006, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.6 });
      // barbels: whiskers from the upper lip, trailing back & down
      const bb = bez(hp([s * 0.2, -0.06, -1.52]), hp([s * 0.42, -0.34, -1.3]), hp([s * 0.5, -0.62, -0.72]), 7);
      acc.add(sweep(bb, taper(7, 0.035 * HS, 0.006), { radial: 5 }), { skin: rigid(hd), color: (p, n, uv) => lerp3(cSide, col(c.finEdge), sstep(0.5, 1, uv[1])), emis: (p, uv) => c.finEm * sstep(0.6, 1, uv[1]), dtl: [0, 0.1, 0.2, 0] });
    }
    const tc = col(c.tooth), tb = col(c.gum), tcol = (p, n, uv) => lerp3(tb, tc, sstep(0, 0.35, uv[1]));
    for (const s of [-1, 1]) {
      // upper: big curved canines + a row of smaller teeth
      acc.add(sweep(bez(hp([s * 0.19, -0.1, -1.46]), hp([s * 0.2, -0.26, -1.47]), hp([s * 0.18, -0.4, -1.4]), 5), taper(5, 0.05 * HS, 0.004), { radial: 6 }), { skin: rigid(hd), color: tcol, dtl: [0, 0, 0, 0] });
      for (let i = 0; i < 5; i++) {
        const z = -1.3 + i * 0.16, x = s * (0.21 + i * 0.012), L = 0.13 - i * 0.012;
        acc.add(sweep([hp([x, -0.1, z]), hp([x * 0.98, -0.1 - L, z + 0.02])], [0.028 * HS, 0.003], { radial: 4 }), { skin: rigid(hd), color: tcol, dtl: [0, 0, 0, 0] });
      }
      // lower: canines + row
      acc.add(sweep(bez(hp([s * 0.14, -0.14, -1.56]), hp([s * 0.15, -0.02, -1.57]), hp([s * 0.13, 0.08, -1.52]), 4), taper(4, 0.04 * HS, 0.004), { radial: 5 }), { skin: rigid(jw), color: tcol, dtl: [0, 0, 0, 0] });
      for (let i = 0; i < 4; i++) {
        const z = -1.38 + i * 0.17, x = s * (0.16 + i * 0.012), L = 0.1 - i * 0.012;
        acc.add(sweep([hp([x, -0.14, z]), hp([x * 0.98, -0.14 + L, z + 0.02])], [0.024 * HS, 0.003], { radial: 4 }), { skin: rigid(jw), color: tcol, dtl: [0, 0, 0, 0] });
      }
    }
  },
  sockets: {
    head: ['head', hp([0, 0.62, -0.5])], mouth: ['head', hp([0, -0.16, -1.62])], jaw: ['jaw', hp([0, -0.18, -1.6])],
    center: ['sp5', [0, 0, 3.0]], chest: ['sp3', [0, -0.3, 1.8]], back: ['sp3', [0, 0.5, 1.8]], neck: ['sp8', [0, 0, 4.8]],
    body: ['sp16', [0, 0.5, 10.32]], tail: ['sp31', [0, 0.3, 21.12]],
  },
  height: 5.0, radius: 1.8,
  controller(inst) { return new SerpentCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
const NN = 26, NB = 150, DU = 0.2;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _T = new V3(), _Tp = new V3(), _N = new V3(), _p = new V3(), _a = new V3(), _b = new V3(), _fw = new V3(), _up = new V3();
const REST_T = new V3(0, 0, 1), REST_UP = new V3(0, 1, 0);

export class SerpentCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    const P = this.pose;
    this.chain = SPN.map(n => P.b[n]);
    this.kids = ['jaw', 'frillL', 'frillR'].map(n => P.b[n]);
    const M = NN + NB + 2;
    this.px = new Float32Array(M); this.py = new Float32Array(M); this.pz = new Float32Array(M); this.ps = new Float32Array(M); this.np = 0;
    this.ph = Math.random() * TAU; this.swim = 0;
    this.hb = new V3(); this.bk = new V3();
    this._idle(0);
  }
  play(name, dur, loop) {
    if (name === 'emerge') name = 'spawn';
    return super.play(name, dur, loop);
  }
  /** base pose parameters (actions then blend on top) */
  _idle(dt) {
    const t = this.t, c = this.combat, sw = this.swim, L = this.look;
    this.hx = Math.sin(t * 0.37) * 0.4 + L.y * 0.7;
    this.hy = 4.25 + Math.sin(t * 0.61 + 1) * 0.16 - 0.45 * c - 0.7 * sw;
    this.hz = -0.95 + Math.sin(t * 0.74) * 0.18 - 0.45 * c - 1.0 * sw;
    this.hpitch = -0.24 + Math.sin(t * 0.83 + 2) * 0.05 - 0.14 * c + L.p * 0.5 - 0.1 * sw;
    this.hyaw = Math.sin(t * 0.37 - 0.6) * 0.16 + L.y * 0.75 + this.turnSm * 0.3;
    this.hroll = Math.sin(t * 0.37 + 0.4) * 0.07 - this.turnSm * 0.2;
    this.ex = Math.sin(t * 0.37 - 1.2) * 0.18; this.ey = -0.25; this.ez = 1.0 + 0.3 * sw;
    this.tx = 0; this.ty = -1; this.tz = 0.3 + 0.5 * sw;
    this.a1 = 1.35; this.a2 = 2.3; this.bulge = 0.5 + 0.1 * Math.sin(t * 0.5);
    this.wA = 1.4 - 0.25 * sw; this.wMid = 0.22; this.wL = 5.0; this.coil = 0.75; this.wSpd = Math.max(0.9, Math.abs(this.speedSm)) * Math.sign(this.speedSm || 1);
    this.sinkH = 0; this.sinkB = 0; this.bend = this.turnSm * 0.018; this.tailUp = 0;
    this.jaw = 0.05 + 0.04 * Math.sin(t * 0.9) + 0.18 * c; this.frill = 0.12 + 0.55 * c + 0.1 * Math.sin(t * 0.7); this.glow = 1; this.throat = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose;
    this.t += dt;
    this._state(state, dt);
    const k4 = 1 - Math.exp(-2 * dt);
    this.speedSm += (this._speed * this.locoW - this.speedSm) * k4;
    this.turnSm += (this._turn * this.locoW - this.turnSm) * (1 - Math.exp(-1.5 * dt));
    this.swim = clamp01(Math.abs(this.speedSm) / 5);
    P.reset();
    const idle = 1 - this.swim;
    this._look(dt, idle * (1 - this.restW), 0.6);
    this._idle(dt);
    this._fidget(dt, idle);
    this.acts.apply();
    this.ph += dt * this.wSpd * TAU / this.wL;
    if (this.ph > 1000) this.ph -= 200 * TAU;
    this._pose();
    P.apply(this.inst.bones);
    this._uniforms();
  }
  _pose() {
    const P = this.pose;
    // ---- head frame
    _e.set(this.hpitch, this.hyaw, this.hroll, 'YXZ');
    _q.setFromEuler(_e);
    _fw.set(0, 0, -1).applyQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    this.hb.set(this.hx, this.hy - this.sinkH, this.hz);
    this.bk.copy(_fw).negate();
    const h = this.chain[0];
    P.wq[h].copy(_q); P.wp[h].copy(this.hb);
    // ---- path
    this._path();
    // ---- spine: fixed arc lengths along the path, parallel-transported frames
    _Tp.copy(this.bk); _N.copy(_up).addScaledVector(_Tp, -_up.dot(_Tp)).normalize();
    for (let i = 1; i < this.chain.length; i++) {
      const s = SPINE_S[i], bi = this.chain[i];
      this._at(s, P.wp[bi]);
      this._at(s + 0.3, _a); this._at(Math.max(0, s - 0.3), _b);
      _T.subVectors(_a, _b).normalize();
      _q2.setFromUnitVectors(_Tp, _T); _N.applyQuaternion(_q2); _N.addScaledVector(_T, -_N.dot(_T)).normalize();
      frameRot(P.wq[bi], REST_T, REST_UP, _T, _N);
      _Tp.copy(_T);
    }
    // throat swell (inhale before a water jet)
    if (this.throat > 0.001) for (let i = 1; i <= 4; i++) P.sc[this.chain[i]].setScalar(1 + this.throat * (i === 1 || i === 4 ? 0.14 : 0.26));
    // ---- jaw & frills (FK from the head)
    const [jw, fl, fr] = this.kids;
    P.rx(jw, -this.jaw);
    const f = this.frill;
    P.rot(fl, 0.1 * f, 0.55 * f, 0.25 * f); P.rot(fr, 0.1 * f, -0.55 * f, -0.25 * f);
    fkBones(P, this.kids);
  }
  /** sample the neck bezier + body wave into px/py/pz with cumulative arc length ps */
  _path() {
    const { px, py, pz, ps } = this, hb = this.hb, bk = this.bk;
    const p0x = hb.x, p0y = hb.y, p0z = hb.z;
    const p1x = p0x + bk.x * this.a1, p1y = p0y + bk.y * this.a1, p1z = p0z + bk.z * this.a1;
    const tl = Math.hypot(this.tx, this.ty, this.tz) || 1, tx = this.tx / tl, ty = this.ty / tl, tz = this.tz / tl;
    const ex = this.ex, ey = this.ey - this.sinkH, ez = this.ez;
    const p2x = ex - tx * this.a2, p2y = ey - ty * this.a2, p2z = ez - tz * this.a2 - this.bulge;
    let n = 0;
    for (let i = 0; i < NN; i++) {
      const t = i / (NN - 1), u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
      px[n] = b0 * p0x + b1 * p1x + b2 * p2x + b3 * ex;
      py[n] = b0 * p0y + b1 * p1y + b2 * p2y + b3 * ey;
      pz[n] = b0 * p0z + b1 * p1z + b2 * p2z + b3 * ez;
      n++;
    }
    // body: helical travelling wave behind the water entry; a decaying correction term keeps position & tangent
    // continuous with the neck curve at the entry point
    const k = TAU / this.wL, ph = this.ph, tau = 0.8, tzs = Math.max(0.08, tz);
    const c0 = ey - this.wMid, c1 = ty / tzs + c0 / tau, d1 = tx / tzs;
    const sinkD = this.sinkB - this.sinkH;
    for (let j = 1; j <= NB; j++) {
      const u = j * DU;
      const env = sstep(0.3, 2.6, u) * (1 - 0.3 * sstep(9, 15, u));
      const ang = k * u - ph;
      const dec = Math.exp(-u / tau);
      const y = this.wMid + this.wA * env * Math.sin(ang) + (c0 + c1 * u) * dec - sinkD * sstep(0.5, 5, u) + this.tailUp * sstep(8, 12, u);
      const x = ex + this.coil * env * Math.cos(ang) + d1 * u * dec + this.bend * u * u;
      px[n] = x; py[n] = y; pz[n] = ez + u;
      n++;
    }
    this.np = n;
    ps[0] = 0;
    for (let i = 1; i < n; i++) ps[i] = ps[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1]);
  }
  /** point at arc length s (linear extrapolation past the ends) */
  _at(s, out) {
    const { px, py, pz, ps } = this, n = this.np;
    if (s <= 0) return out.set(px[0], py[0], pz[0]);
    if (s >= ps[n - 1]) { const i = n - 1, l = ps[i] - ps[i - 1] || 1, f = (s - ps[i]) / l; return out.set(px[i] + (px[i] - px[i - 1]) * f, py[i] + (py[i] - py[i - 1]) * f, pz[i] + (pz[i] - pz[i - 1]) * f); }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ps[m] <= s) lo = m; else hi = m; }
    const f = (s - ps[lo]) / ((ps[hi] - ps[lo]) || 1);
    return out.set(px[lo] + (px[hi] - px[lo]) * f, py[lo] + (py[hi] - py[lo]) * f, pz[lo] + (pz[hi] - pz[lo]) * f);
  }
}

// ================================================================================================ actions
// Every action blends the path parameters: absolute targets via mix(current, target, f·w), offsets via += d·w.
const side = (a) => (a.u.side ?? (a.u.side = Math.sin(a.seed * 7.13) > 0 ? 1 : -1));
const env2 = (k, a, b, c, d) => sstep(a, b, k) * (1 - sstep(c, d, k));
const ACTIONS = {
  attack: { dur: 1.45, a: 0.08, d: 0.86, hit: 0.5, fn(ctl, a, w) { // rear back → lunging bite at deck height ~5 m ahead
    const k = a.k, t = a.t;
    const wind = env2(k, 0, 0.34, 0.36, 0.46), strike = env2(k, 0.36, 0.49, 0.64, 0.95), shake = env2(k, 0.5, 0.54, 0.6, 0.66);
    ctl.hz += 1.1 * wind * w; ctl.hy += 0.75 * wind * w; ctl.hpitch += 0.4 * wind * w;
    ctl.hx = mix(ctl.hx, 0, strike * w); ctl.hz = mix(ctl.hz, -5.2, strike * w); ctl.hy = mix(ctl.hy, 1.7, strike * w);
    ctl.hpitch = mix(ctl.hpitch, -0.5, strike * w); ctl.hyaw = mix(ctl.hyaw, 0, strike * w);
    ctl.hroll += Math.sin(t * 38) * 0.22 * shake * w;
    ctl.ez = mix(ctl.ez, 0.4, strike * w); ctl.bulge += 0.8 * strike * w; ctl.a1 += 0.6 * strike * w;
    ctl.jaw = Math.max(ctl.jaw, (0.4 * wind + 0.95 * env2(k, 0.36, 0.44, 0.47, 0.51) + 0.2 * shake) * w);
    ctl.frill = mix(ctl.frill, 1, (wind + strike) * w);
  } },
  attack2: { dur: 2.4, a: 0.06, d: 0.88, hit: 0.32, hits: [0.32, 0.8], fn(ctl, a, w) { // inhale (throat swells) → sustained water jet at the deck
    const k = a.k, t = a.t;
    const draw = env2(k, 0, 0.26, 0.28, 0.36), jet = env2(k, 0.28, 0.34, 0.8, 0.9);
    ctl.hz += (0.9 * draw) * w; ctl.hy += (0.9 * draw + 0.3 * jet) * w; ctl.hpitch += 0.35 * draw * w;
    ctl.hpitch = mix(ctl.hpitch, -0.42, jet * w); ctl.hz = mix(ctl.hz, -1.6, jet * w);
    ctl.hyaw = mix(ctl.hyaw, Math.sin(t * 2.6) * 0.28, jet * w); ctl.hx = mix(ctl.hx, Math.sin(t * 2.6 - 0.4) * 0.5, jet * w);
    ctl.hroll += Math.sin(t * 31) * 0.03 * jet * w;
    ctl.throat = Math.max(ctl.throat, (draw * sstep(0.05, 0.26, k) + 0.35 * jet * (0.8 + 0.2 * Math.sin(t * 18))) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.25 * draw + 1.05 * jet) * w);
    ctl.frill = mix(ctl.frill, 1, (draw + jet) * w); ctl.glow = mix(ctl.glow, 1.6, jet * w);
  } },
  spit: { dur: 1.1, a: 0.08, d: 0.85, hit: 0.5, fn(ctl, a, w) { // rear back, lob a glob of water
    const k = a.k;
    const back = env2(k, 0, 0.38, 0.4, 0.5), fwd = env2(k, 0.42, 0.5, 0.6, 0.95);
    ctl.hz += (0.8 * back - 1.0 * fwd) * w; ctl.hy += (0.5 * back + 0.2 * fwd) * w;
    ctl.hpitch += (0.45 * back - 0.25 * fwd) * w;
    ctl.throat = Math.max(ctl.throat, back * 0.8 * w);
    ctl.jaw = Math.max(ctl.jaw, (0.2 * back + 0.95 * env2(k, 0.44, 0.5, 0.56, 0.75)) * w);
    ctl.frill = mix(ctl.frill, 1, back * w);
  } },
  attack_big: { dur: 3.4, a: 0.04, d: 0.9, hit: 0.7, fn(ctl, a, w) { // rear up very high (telegraph) → crash down onto the deck
    const k = a.k, t = a.t;
    const rise = env2(k, 0.0, 0.28, 0.62, 0.66), hold = env2(k, 0.28, 0.34, 0.6, 0.64), crash = env2(k, 0.62, 0.7, 0.82, 0.98);
    const trem = hold * Math.sin(t * 43) * 0.07;
    ctl.hy = mix(ctl.hy, 7.4, rise * w); ctl.hz = mix(ctl.hz, 0.7, rise * w); ctl.hx = mix(ctl.hx, trem, rise * w);
    ctl.hpitch = mix(ctl.hpitch, mix(0.55, -0.45, sstep(0.3, 0.55, k)), rise * w); ctl.hyaw = mix(ctl.hyaw, 0, rise * w); ctl.hroll += trem * w;
    ctl.ey += 0.7 * rise * w; ctl.ez = mix(ctl.ez, 1.7, rise * w); ctl.a1 += 0.4 * rise * w; ctl.a2 += 1.2 * rise * w; ctl.bulge += 0.4 * rise * w;
    ctl.wA = mix(ctl.wA, 0.7, rise * w);
    ctl.hx = mix(ctl.hx, 0, crash * w); ctl.hy = mix(ctl.hy, 0.45 + 0.25 * env2(k, 0.7, 0.74, 0.76, 0.82), crash * w); ctl.hz = mix(ctl.hz, -6.8, crash * w);
    ctl.hpitch = mix(ctl.hpitch, -0.3, crash * w); ctl.ez = mix(ctl.ez, 0.2, crash * w); ctl.a2 += 0.8 * crash * w; ctl.bulge += 1.2 * crash * w;
    ctl.jaw = Math.max(ctl.jaw, (0.95 * env2(k, 0.05, 0.25, 0.45, 0.6) + 0.5 * env2(k, 0.6, 0.64, 0.68, 0.72)) * w);
    ctl.frill = mix(ctl.frill, 1.2, (rise + crash * 0.5) * w);
    ctl.glow = mix(ctl.glow, 1 + 2.2 * sstep(0.1, 0.6, k) * (1 - sstep(0.64, 0.74, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.2, 0.6, k) * (1 - sstep(0.62, 0.7, k)) * w);
  } },
  roar: { dur: 2.2, a: 0.1, d: 0.85, fn(ctl, a, w) {
    const k = a.k, t = a.t, up = env2(k, 0, 0.25, 0.8, 1);
    ctl.hy += 1.1 * up * w; ctl.hz += 0.35 * up * w;
    ctl.hpitch = mix(ctl.hpitch, 0.55, up * w); ctl.hyaw += Math.sin(t * 29) * 0.05 * up * w; ctl.hroll += Math.sin(t * 23) * 0.06 * up * w;
    ctl.jaw = Math.max(ctl.jaw, (1.05 + 0.08 * Math.sin(t * 27)) * up * w);
    ctl.frill = mix(ctl.frill, 1.3, up * w); ctl.glow = mix(ctl.glow, 2.0, up * w); ctl.throat = Math.max(ctl.throat, 0.3 * up * w);
  } },
  hit: { dur: 0.55, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) {
    const k = a.k, s = side(a), j = sstep(0, 0.12, k) * (1 - sstep(0.25, 1, k)) * w;
    ctl.hz += 0.6 * j; ctl.hy += 0.3 * j; ctl.hpitch += 0.45 * j; ctl.hroll += 0.3 * s * j; ctl.hyaw += 0.3 * s * j; ctl.hx -= 0.3 * s * j;
    ctl.jaw = Math.max(ctl.jaw, 0.5 * j); ctl.frill = mix(ctl.frill, 1.2, j);
  } },
  stun: { dur: 2.4, loop: true, state: true, fadeIn: 0.35, fadeOut: 0.4, fn(ctl, a, w) {
    const ph = a.t / 2.4 * TAU;
    ctl.hy -= 1.1 * w; ctl.hz -= 0.3 * w; ctl.hpitch = mix(ctl.hpitch, -0.55, w);
    ctl.hyaw += 0.35 * Math.cos(ph) * w; ctl.hroll += 0.35 * Math.sin(ph) * w; ctl.hx += 0.5 * Math.sin(ph) * w;
    ctl.jaw = Math.max(ctl.jaw, 0.35 * w); ctl.frill = mix(ctl.frill, -0.2, w); ctl.glow = mix(ctl.glow, 0.55, w);
    ctl.wSpd *= 1 - 0.7 * w; ctl.wA = mix(ctl.wA, 0.8, w);
  } },
  knockdown: { dur: 1.0, hold: true, excl: true, state: true, fadeIn: 0.05, fadeOut: 0.1, hit: 0, fn(ctl, a, w) { // slams onto the water, dazed
    const k = a.k, t = a.t, s = side(a), fall = sstep(0.05, 0.45, k), bounce = env2(k, 0.45, 0.52, 0.56, 0.7);
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.4 + a.seed)), 12) * sstep(1.2, 1.6, t);
    ctl.hx = mix(ctl.hx, 1.2 * s, fall * w); ctl.hy = mix(ctl.hy, 0.35 + 0.35 * bounce + 0.4 * tw, fall * w); ctl.hz = mix(ctl.hz, -3.6, fall * w);
    ctl.hpitch = mix(ctl.hpitch, -0.12 + 0.2 * tw, fall * w); ctl.hroll = mix(ctl.hroll, 0.55 * s, fall * w); ctl.hyaw = mix(ctl.hyaw, 0.3 * s, fall * w);
    ctl.bulge += 1.0 * fall * w; ctl.ez = mix(ctl.ez, 0.6, fall * w);
    ctl.wA = mix(ctl.wA, 0.55, fall * w); ctl.wSpd *= 1 - 0.6 * w;
    ctl.jaw = Math.max(ctl.jaw, (0.3 + 0.3 * sstep(0.1, 0.3, k) * (1 - sstep(0.4, 0.6, k))) * w); ctl.frill = mix(ctl.frill, -0.2, fall * w); ctl.glow = mix(ctl.glow, 0.6, fall * w);
  } },
  getup: { dur: 1.4, a: 0.001, d: 0.9, state: true, fn(ctl, a, w) {
    const k = a.k, s = side(a), f = 1 - sstep(0.05, 0.9, k);
    ctl.hx = mix(ctl.hx, 1.2 * s, f * w); ctl.hy = mix(ctl.hy, 0.35, f * w); ctl.hz = mix(ctl.hz, -3.6, f * w);
    ctl.hpitch = mix(ctl.hpitch, -0.12 + 0.4 * sstep(0.1, 0.5, k), f * w); ctl.hroll = mix(ctl.hroll, 0.55 * s, f * w);
    ctl.bulge += 1.0 * f * w; ctl.ez = mix(ctl.ez, 0.6, f * w); ctl.wA = mix(ctl.wA, 0.55, f * w);
    ctl.jaw = Math.max(ctl.jaw, 0.4 * env2(k, 0.3, 0.5, 0.6, 0.9) * w);
  } },
  death: { dur: 4.5, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // throes → topples onto the water → sinks
    const k = a.k, t = a.t, s = side(a);
    const throes = env2(k, 0, 0.06, 0.14, 0.22), fall = sstep(0.16, 0.4, k), sink = sstep(0.45, 0.98, k);
    ctl.hy += 0.9 * throes * w; ctl.hpitch += 0.7 * throes * w; ctl.hroll += Math.sin(t * 20) * 0.25 * throes * w;
    ctl.hx = mix(ctl.hx, 2.8 * s, fall * w); ctl.hy = mix(ctl.hy, 0.2 + 0.35 * env2(k, 0.38, 0.42, 0.44, 0.52), fall * w); ctl.hz = mix(ctl.hz, -3.4, fall * w);
    ctl.hroll = mix(ctl.hroll, 1.45 * s, fall * w); ctl.hpitch = mix(ctl.hpitch, -0.1, fall * w); ctl.hyaw = mix(ctl.hyaw, 0.5 * s, fall * w);
    ctl.bulge += 1.2 * fall * w; ctl.ez = mix(ctl.ez, 0.5, fall * w); ctl.ex = mix(ctl.ex, 0.6 * s, fall * w);
    ctl.wA = mix(ctl.wA, 0.35, fall * w); ctl.wSpd *= 1 - 0.85 * fall * w;
    ctl.sinkH = mix(ctl.sinkH, 3.6, sink * w); ctl.sinkB = mix(ctl.sinkB, 3.6, sink * w);
    ctl.jaw = Math.max(ctl.jaw, (1.0 * throes + 0.45 * fall) * w); ctl.frill = mix(ctl.frill, -0.3, fall * w);
    ctl.glow = mix(ctl.glow, 0.05, sstep(0.2, 0.7, k) * w);
  } },
  spawn: { dur: 2.6, a: 0.001, d: 0.92, state: true, excl: true, fn(ctl, a, w) { // bursts out of the sea neck-first, roars, the arches surface behind
    const k = a.k, t = a.t;
    const outH = sstep(0.04, 0.34, k), outB = sstep(0.25, 0.85, k), roar = env2(k, 0.34, 0.46, 0.78, 0.92);
    ctl.sinkH = mix(ctl.sinkH, mix(7.2, -0.6 * env2(k, 0.2, 0.36, 0.42, 0.6), outH), w);
    ctl.sinkB = mix(ctl.sinkB, mix(4.2, 0, outB), w);
    ctl.hpitch = mix(ctl.hpitch, mix(1.0, 0.5, sstep(0.2, 0.45, k)), (1 - sstep(0.5, 0.95, k)) * w);
    ctl.hroll += Math.sin(t * 9) * 0.25 * (1 - outH) * w;
    ctl.hz += 0.6 * (1 - outH) * w;
    ctl.jaw = Math.max(ctl.jaw, (1.0 * roar + 0.3 * (1 - outH)) * w); ctl.frill = mix(ctl.frill, 1.2, roar * w);
    ctl.glow = mix(ctl.glow, 2.2, roar * w);
  } },
  submerge: { dur: 2.0, hold: true, excl: true, state: true, fadeIn: 0.05, fadeOut: 0.05, fn(ctl, a, w) { // rears, then dives nose-first; stays under
    const k = a.k, rear = env2(k, 0, 0.22, 0.25, 0.4), dive = sstep(0.25, 0.7, k), gone = sstep(0.4, 1.0, k);
    ctl.hy += 0.6 * rear * w; ctl.hpitch += 0.4 * rear * w;
    ctl.hz = mix(ctl.hz, -3.8, dive * w); ctl.hy = mix(ctl.hy, -3.4, dive * w); ctl.hpitch = mix(ctl.hpitch, -1.3, dive * w);
    ctl.ez = mix(ctl.ez, -1.0, dive * w); ctl.bulge += 1.4 * dive * w;
    ctl.sinkB = mix(ctl.sinkB, 3.8, gone * w); ctl.sinkH = mix(ctl.sinkH, 3.0, sstep(0.7, 1, k) * w);
    ctl.jaw = Math.min(ctl.jaw, mix(ctl.jaw, 0, dive));
  } },
  idle_alt: { dur: 3.2, a: 0.12, d: 0.82, fn(ctl, a, w) { // dips the snout into the sea, then shakes the water off
    const k = a.k, t = a.t, dip = env2(k, 0.05, 0.3, 0.42, 0.6), sh = env2(k, 0.55, 0.62, 0.8, 0.95);
    ctl.hy -= 2.6 * dip * w; ctl.hz -= 1.2 * dip * w; ctl.hpitch = mix(ctl.hpitch, -0.9, dip * w);
    ctl.hyaw += Math.sin(t * 17) * 0.3 * sh * w; ctl.hroll += Math.sin(t * 17 + 1) * 0.25 * sh * w; ctl.hy += 0.3 * sh * w;
    ctl.jaw = Math.max(ctl.jaw, 0.25 * sh * w); ctl.frill = mix(ctl.frill, 1, sh * w);
  } },
  look: { dur: 3.6, a: 0.15, d: 0.8, fn(ctl, a, w) { // turns to stare at something off to the side, tail flicks up behind
    const k = a.k, s = side(a), f = env2(k, 0.05, 0.3, 0.7, 0.95);
    ctl.hyaw += 0.9 * s * f * w; ctl.hx += 0.6 * s * f * w; ctl.hpitch -= 0.1 * f * w; ctl.tailUp += 1.2 * env2(k, 0.2, 0.45, 0.55, 0.85) * w;
    ctl.frill = mix(ctl.frill, 0.9, f * w);
  } },
};

ACTIONS.emerge = ACTIONS.spawn; // alias (the controller maps play('emerge') → spawn semantics)
const SPEC = {
  bones: { head: 'head', jaw: 'jaw' },
  fidgets: [{ name: 'idle_alt', w: 2 }, { name: 'look', w: 2 }], fidgetGap: 5,
  chargeK: 0.25,
  actions: ACTIONS,
};
