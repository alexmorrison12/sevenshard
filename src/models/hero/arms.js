// SEVENSHARD class weapons (rigid meshes, oversized, readable from the iso camera).
// Local space: primary grip at the origin, business end along +Y, cutting edge along ±X, blade flats face ±Z.
// info: { len, grip2 (off-hand grip along Y), tip: [x,y,z], muzzle?, orb?, kind }
// Tiers: 0 story (iron & leather) · 1 Vanguard (polished steel, gold, class gem) · 2 Horned Tyrant (blackened
// metal, horn motifs, red runes). aMat.w (rune mask) glows with the weapon's rune uniform (tier 2 / hone +15).
import * as THREE from 'three';
import { PB, tubeGeo, topLit } from './pieces.js';
import { assemble } from './assemble.js';
import { SLOT, NSLOT, DET } from './palette.js';
import { linColor } from '../../engine/geom.js';
import { Simplex } from '../../core/noise.js';

const NZ = new Simplex(17);
const CACHE = new Map();
const NOBASE = { master: null };

// class accent (gems / tier-1 hone glow)
export const CLASS_ACCENT = {
  reaver: 0xff3a24, oathkeeper: 0xffd878, stormfist: 0x5ad8ff, pistoleer: 0xffb040, starcaller: 0x6ae0ff,
  songweaver: 0xff9ad8, bladedancer: 0x40ffd8, demonbound: 0xc040ff, npc: 0x9ab8ff,
};

function palette(tier, cls, over = {}) {
  const pal = [];
  const m = (hex, spec, det, emis = 0, rune = 0) => ({ c: linColor(hex), spec, det, emis, cast: 0, rune });
  for (let i = 0; i < NSLOT; i++) pal.push(m(0x808080, 0, DET.none));
  const acc = CLASS_ACCENT[cls] ?? 0x9ab8ff;
  const T = [
    { blade: 0x8c9096, metal: 0x5e5a56, trim: 0x8a6a44, hilt: 0x5a3a22, dark: 0x2a2624 },
    { blade: 0x8e98a4, metal: 0x4c525c, trim: 0xd0a048, hilt: 0x3a2418, dark: 0x22262c },
    { blade: 0x3a3a42, metal: 0x2a2a30, trim: 0x8a2a24, hilt: 0x1e1414, dark: 0x141216 },
  ][tier] || {};
  pal[SLOT.BLADE] = m(over.blade ?? T.blade, tier === 2 ? 0.9 : 0.75, DET.plate);
  pal[SLOT.METAL] = m(over.metal ?? T.metal, 0.9, DET.plate);
  pal[SLOT.TRIM] = m(over.trim ?? T.trim, 1.0, DET.plate);
  pal[SLOT.HILT] = m(over.hilt ?? T.hilt, 0.12, DET.leather);
  pal[SLOT.WOOD] = m(over.wood ?? 0x5a3a24, 0.06, DET.wood);
  pal[SLOT.LEATHER] = m(over.leather ?? 0x4a3020, 0.12, DET.leather);
  pal[SLOT.GEM] = m(over.gem ?? (tier === 2 ? 0xff3020 : acc), 1, DET.none, 0.9);
  pal[SLOT.GLOW] = m(over.glow ?? acc, 0, DET.none, 1);
  pal[SLOT.RUNE] = m(tier === 2 ? 0x3a0a08 : 0x2a2c34, 0.6, DET.none, 0, 1);
  pal[SLOT.HORN] = m(over.horn ?? (tier === 2 ? 0x3a302a : 0xd8ccb0), 0.3, DET.none);
  pal[SLOT.DARK] = m(T.dark, 0.2, DET.none);
  pal[SLOT.CLOTH1] = m(over.cloth ?? 0x8a1c1c, 0, DET.cloth);
  pal[SLOT.CLOTH2] = m(over.cloth2 ?? 0xe0d0a0, 0, DET.cloth);
  pal[SLOT.LINEN] = m(0xe8dcc0, 0, DET.cloth);
  pal[SLOT.BONE] = m(0xe0d4b8, 0.25, DET.none);
  pal[SLOT.CHAIN] = m(0x9aa0a8, 0.9, DET.plate);
  pal[SLOT.EMBLEM] = m(over.emblem ?? T.trim, 0.8, DET.none);
  for (let i = 0; i < NSLOT; i++) { if (i === SLOT.GEM || i === SLOT.GLOW) continue; const c = pal[i].c; for (let k = 0; k < 3; k++) { const x = c[k]; c[k] = x < 0.45 ? x : 0.45 + (x - 0.45) * 0.45; } }
  return pal;
}

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const R = (x, y, z) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z));
const edgeLit = (p, n) => { const f = 0.78 + 0.4 * Math.abs(n.x) + 0.2 * Math.max(0, n.y); return [f, f, f * 1.02]; };
const bladeLit = (p, n) => { const f = 0.72 + 0.35 * Math.abs(n.x) + 0.15 * Math.max(0, n.y) + 0.06 * NZ.noise2(p.y * 9, p.x * 25); return [f, f, f * 1.03]; };

/** extruded flat shape in the XY plane, thickness th along Z (bevelled), with outline pts [[x,y],...] */
function slab(pts, th, bevel = 0.35) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th * (1 - bevel), bevelEnabled: true, bevelThickness: th * bevel * 0.5, bevelSize: Math.min(0.012, th * 0.6), bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -th * (1 - bevel) * 0.5);
  g.computeVertexNormals();
  return g;
}
/** blade outline with a diamond cross-section feel: two slabs (core + thin edge) */
function bladeShape(pb, pts, th, opts = {}) {
  pb.add(slab(pts, th, 0.55), { m: opts.m, slot: SLOT.BLADE, bw: 0, mulFn: bladeLit, cast: opts.cast ?? 0.35 });
}
function runeStrip(pb, y0, y1, w, z, opts = {}) { // glowing channel inlaid on both flats
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(w, y1 - y0, 0.004);
    pb.add(g, { m: (opts.m ? opts.m.clone() : new THREE.Matrix4()).multiply(T(opts.x ?? 0, (y0 + y1) / 2, s * z)), slot: SLOT.RUNE, bw: 0, rune: 1, cast: 1 });
  }
}
function wrapGrip(pb, y0, y1, r, slot = SLOT.HILT) {
  const g = new THREE.CylinderGeometry(r, r * 1.04, y1 - y0, 8, Math.max(2, Math.round((y1 - y0) / 0.025)));
  pb.add(g, { m: T(0, (y0 + y1) / 2, 0), slot, bw: 0, mulFn: (p) => { const f = 0.75 + 0.35 * Math.abs(Math.sin(p.y * 110)); return [f, f, f]; } });
}
function hornCurve(pb, base, dir, curl, len, r0, slot, m = null, seg = 7) {
  const pts = [], rads = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pts.push(new THREE.Vector3(base[0] + dir[0] * len * t + curl[0] * t * t * len, base[1] + dir[1] * len * t + curl[1] * t * t * len, base[2] + dir[2] * len * t + curl[2] * t * t * len));
    rads.push(r0 * Math.pow(1 - t, 0.9) + 0.002);
  }
  pb.add(tubeGeo(pts, rads, 6), { m, slot, bw: 0, mulFn: (p, n) => { const f = 0.75 + 0.35 * Math.max(0, n.y); return [f, f * 0.97, f * 0.92]; } });
}

// ------------------------------------------------------------------------------------------------
const BUILDERS = {
  // Reaver: a slab of a sword, ~1.9 m. Right hand under the guard, left hand at grip2.
  greatsword(pb, t) {
    const L = 1.44, W = t === 2 ? 0.2 : t === 1 ? 0.18 : 0.16, th = 0.03, y0 = 0.11;
    const tipCut = t === 0 ? 0.1 : 0.16;
    const outline = [[-W * 0.5, y0], [-W * 0.52, y0 + 0.16], [-W * 0.44, y0 + 0.2], [-W * 0.47, y0 + L * 0.82], [-W * 0.2, y0 + L - tipCut * 0.2], [0, y0 + L],
      [W * 0.5, y0 + L - tipCut], [W * 0.47, y0 + L * 0.7], [W * 0.44, y0 + 0.2], [W * 0.52, y0 + 0.16], [W * 0.5, y0]];
    if (t === 2) { // serrated back edge + hooked horn notches
      outline.splice(3, 1, [-W * 0.47, y0 + L * 0.3], [-W * 0.58, y0 + L * 0.36], [-W * 0.47, y0 + L * 0.42], [-W * 0.47, y0 + L * 0.55], [-W * 0.58, y0 + L * 0.61], [-W * 0.47, y0 + L * 0.67], [-W * 0.47, y0 + L * 0.82]);
    }
    bladeShape(pb, outline, th);
    // central ridge / fuller
    const ful = new THREE.BoxGeometry(W * 0.2, L * 0.72, th * 1.25);
    pb.add(ful, { m: T(0, y0 + 0.14 + L * 0.36, 0), slot: t === 2 ? SLOT.RUNE : SLOT.METAL, bw: 0, mul: [0.6, 0.6, 0.66], rune: t === 2 ? 1 : 0, cast: 1 });
    runeStrip(pb, y0 + 0.24, y0 + L * 0.8, W * 0.07, th * 0.64);
    // ricasso plates
    const ric = new THREE.BoxGeometry(W * 1.08, 0.13, th * 1.6);
    pb.add(ric, { m: T(0, y0 + 0.07, 0), slot: SLOT.METAL, bw: 0, mulFn: topLit(0.25, 0.85) });
    // crossguard: heavy bar with swept, spiked ends
    const gw = t === 0 ? 0.36 : 0.46;
    const bar = new THREE.BoxGeometry(gw, 0.05, 0.07);
    pb.add(bar, { m: T(0, 0.04, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    for (const s of [-1, 1]) {
      if (t === 2) hornCurve(pb, [s * gw * 0.45, 0.04, 0], [s * 0.5, 0.35, 0], [0, 0.6, 0.1], 0.18, 0.03, SLOT.HORN);
      else if (t === 1) { const sp = new THREE.ConeGeometry(0.03, 0.12, 5); sp.rotateZ(-s * (Math.PI / 2 + 0.5)); pb.add(sp, { m: T(s * (gw * 0.5 + 0.04), 0.0, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) }); }
      else { const kn = new THREE.SphereGeometry(0.032, 6, 5); pb.add(kn, { m: T(s * gw * 0.5, 0.04, 0), slot: SLOT.METAL, bw: 0 }); }
    }
    if (t >= 1) { const gm = new THREE.OctahedronGeometry(0.035, 0); gm.scale(1, 1.3, 0.6); pb.add(gm, { m: T(0, 0.06, 0.04), slot: SLOT.GEM, bw: 0, emis: 1 }); pb.add(gm, { m: T(0, 0.06, -0.04), slot: SLOT.GEM, bw: 0, emis: 1 }); }
    wrapGrip(pb, -0.27, 0.02, 0.022);
    const pom = t === 2 ? new THREE.OctahedronGeometry(0.05, 0) : new THREE.SphereGeometry(0.042, 8, 6);
    pb.add(pom, { m: T(0, -0.31, 0), slot: t === 2 ? SLOT.HORN : SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    return { len: y0 + L, grip2: -0.18, tip: [0, y0 + L, 0] };
  },

  // Oathkeeper: holy longsword (blade along +Y), winged gilded guard
  longsword(pb, t) {
    const L = 0.96, W = t === 0 ? 0.07 : 0.085, th = 0.018, y0 = 0.09;
    bladeShape(pb, [[-W / 2, y0], [-W * 0.46, y0 + L * 0.8], [-W * 0.18, y0 + L * 0.95], [0, y0 + L], [W * 0.18, y0 + L * 0.95], [W * 0.46, y0 + L * 0.8], [W / 2, y0]], th);
    const ful = new THREE.BoxGeometry(W * 0.2, L * 0.7, th * 1.25);
    pb.add(ful, { m: T(0, y0 + L * 0.38, 0), slot: t === 2 ? SLOT.RUNE : t === 1 ? SLOT.TRIM : SLOT.METAL, bw: 0, mul: [0.85, 0.85, 0.85], rune: t === 2 ? 1 : 0, cast: 1 });
    runeStrip(pb, y0 + 0.08, y0 + L * 0.72, W * 0.06, th * 0.64);
    const gw = 0.26;
    pb.add(new THREE.BoxGeometry(gw, 0.035, 0.05), { m: T(0, 0.055, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    for (const s2 of [-1, 1]) {
      if (t >= 1) { // swept wings
        const wing = slab([[0, 0], [0.05, 0.02], [0.12, 0.09], [0.1, 0.1], [0.04, 0.05], [0, 0.03]], 0.02);
        const m = T(s2 * gw * 0.36, 0.05, 0); if (s2 < 0) m.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        pb.add(wing, { m, slot: t === 2 ? SLOT.HORN : SLOT.TRIM, bw: 0, flip: s2 < 0, mulFn: topLit(0.3, 0.9) });
      } else pb.add(new THREE.SphereGeometry(0.022, 6, 5), { m: T(s2 * gw * 0.5, 0.055, 0), slot: SLOT.TRIM, bw: 0 });
    }
    if (t >= 1) { const gm = new THREE.OctahedronGeometry(0.024, 0); pb.add(gm, { m: T(0, 0.06, 0.028), slot: SLOT.GEM, bw: 0, emis: 1 }); pb.add(gm, { m: T(0, 0.06, -0.028), slot: SLOT.GEM, bw: 0, emis: 1 }); }
    wrapGrip(pb, -0.14, 0.04, 0.017);
    pb.add(new THREE.OctahedronGeometry(0.03, 0), { m: T(0, -0.17, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    return { len: y0 + L, grip2: -0.1, tip: [0, y0 + L, 0] };
  },
  // Oathkeeper: holy tome (hangs from the hip on a chain; held open in the off hand for some casts)
  tome(pb, t) {
    const W = 0.2, H = 0.27, D = 0.07;
    pb.add(new THREE.BoxGeometry(W, H, D), { m: T(0, -H / 2, 0), slot: SLOT.CLOTH2, bw: 0, mulFn: topLit(0.2, 0.9) });
    pb.add(new THREE.BoxGeometry(W * 0.93, H * 0.94, D * 0.78), { m: T(0.008, -H / 2, 0), slot: SLOT.LINEN, bw: 0, mulFn: (p) => { const f = 0.82 + 0.1 * Math.sin(p.x * 500); return [f, f, f * 0.94]; } });
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pb.add(new THREE.BoxGeometry(0.045, 0.045, D * 1.1), { m: T(x * (W / 2 - 0.02), -H / 2 + y * (H / 2 - 0.02), 0), slot: SLOT.TRIM, bw: 0 });
    const sun = new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12); sun.rotateX(Math.PI / 2);
    for (const z of [-1, 1]) {
      pb.add(sun, { m: T(0, -H / 2, z * D * 0.52), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 1) });
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const ray = new THREE.BoxGeometry(0.012, 0.05, 0.008); pb.add(ray, { m: T(Math.sin(a) * 0.07, -H / 2 + Math.cos(a) * 0.07, z * D * 0.52).multiply(R(0, 0, -a)), slot: SLOT.TRIM, bw: 0 }); }
      pb.add(new THREE.OctahedronGeometry(0.018, 0), { m: T(0, -H / 2, z * D * 0.58), slot: SLOT.GEM, bw: 0, emis: 1 });
    }
    pb.add(new THREE.TorusGeometry(0.02, 0.006, 4, 10), { m: T(0, 0.012, 0).multiply(R(0, Math.PI / 2, 0)), slot: SLOT.CHAIN, bw: 0 });
    return { len: H, tip: [0, -H / 2, 0] };
  },
  // Pistoleer: long-barrelled revolver pistol. Barrel along +X (aim), handle through the fist along Y.
  pistol(pb, t) {
    const bl = 0.3;
    const barrel = new THREE.CylinderGeometry(0.017, 0.019, bl, 10); barrel.rotateZ(-Math.PI / 2);
    pb.add(barrel, { m: T(0.1, 0.075, 0), slot: SLOT.METAL, bw: 0, mulFn: edgeLit });
    pb.add(new THREE.BoxGeometry(bl * 0.9, 0.012, 0.012), { m: T(0.1, 0.098, 0), slot: SLOT.TRIM, bw: 0 });
    const cyl = new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8); cyl.rotateZ(-Math.PI / 2);
    pb.add(cyl, { m: T(-0.02, 0.07, 0), slot: SLOT.TRIM, bw: 0, mulFn: (p, n) => { const f = 0.75 + 0.3 * Math.abs(Math.sin(Math.atan2(p.z, p.y - 0.07) * 4)); return [f, f, f]; } });
    pb.add(new THREE.BoxGeometry(0.1, 0.05, 0.03), { m: T(-0.035, 0.07, 0), slot: SLOT.METAL, bw: 0, mulFn: topLit(0.3, 0.85) });
    const grip = slab([[-0.02, 0.05], [0.02, 0.05], [0.0, -0.06], [-0.035, -0.075], [-0.05, -0.06]], 0.032);
    pb.add(grip, { m: R(0, 0, 0.18), slot: SLOT.WOOD, bw: 0, mulFn: (p) => { const f = 0.75 + 0.2 * Math.sin(p.y * 90); return [f, f * 0.9, f * 0.8]; } });
    pb.add(new THREE.TorusGeometry(0.018, 0.004, 4, 8, Math.PI), { m: T(0.03, 0.035, 0).multiply(R(0, 0, Math.PI)), slot: SLOT.TRIM, bw: 0 });
    const muz = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10); muz.rotateZ(-Math.PI / 2);
    pb.add(muz, { m: T(0.25, 0.075, 0), slot: t === 2 ? SLOT.HORN : SLOT.TRIM, bw: 0 });
    if (t >= 1) runeStrip(pb, 0, 0.18, 0.006, 0.0195, { m: T(0.04, 0.075, 0).multiply(R(0, 0, -Math.PI / 2)) });
    return { len: 0.27, tip: [0.27, 0.075, 0], muzzle: [0.27, 0.075, 0], barrel: 'x' };
  },
  // Pistoleer: double-barrel shotgun (barrels along +X, stock toward −X; off hand under the fore-end)
  shotgun(pb, t) {
    for (const z of [-0.018, 0.018]) { const b = new THREE.CylinderGeometry(0.019, 0.02, 0.55, 10); b.rotateZ(-Math.PI / 2); pb.add(b, { m: T(0.28, 0.07, z), slot: SLOT.METAL, bw: 0, mulFn: edgeLit }); }
    pb.add(new THREE.BoxGeometry(0.3, 0.035, 0.05), { m: T(0.2, 0.045, 0), slot: SLOT.WOOD, bw: 0, mulFn: topLit(0.2, 0.85) });
    pb.add(new THREE.BoxGeometry(0.12, 0.07, 0.055), { m: T(-0.01, 0.06, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.85) });
    const stock = slab([[-0.05, 0.09], [-0.36, 0.06], [-0.4, -0.05], [-0.34, -0.06], [-0.1, 0.0], [-0.03, -0.03], [0.0, 0.03]], 0.05);
    pb.add(stock, { slot: SLOT.WOOD, bw: 0, mulFn: (p) => { const f = 0.72 + 0.2 * Math.sin(p.x * 60 + p.y * 30); return [f, f * 0.88, f * 0.78]; } });
    for (const x of [0.12, 0.45]) pb.add(new THREE.TorusGeometry(0.03, 0.006, 4, 10), { m: T(x, 0.06, 0).multiply(R(0, Math.PI / 2, 0)), slot: SLOT.TRIM, bw: 0 });
    if (t >= 1) runeStrip(pb, 0, 0.3, 0.008, 0.029, { m: T(0.08, 0.06, 0).multiply(R(0, 0, -Math.PI / 2)) });
    return { len: 0.56, tip: [0.56, 0.07, 0], muzzle: [0.56, 0.07, 0], barrel: 'x', grip2: [0.3, 0.035, 0], grip2rot: [0, 0, -Math.PI / 2] };
  },
  // Pistoleer: long rifle with a scope
  rifle(pb, t) {
    const b = new THREE.CylinderGeometry(0.016, 0.019, 0.9, 10); b.rotateZ(-Math.PI / 2);
    pb.add(b, { m: T(0.47, 0.075, 0), slot: SLOT.METAL, bw: 0, mulFn: edgeLit });
    pb.add(new THREE.BoxGeometry(0.55, 0.04, 0.045), { m: T(0.24, 0.05, 0), slot: SLOT.WOOD, bw: 0, mulFn: topLit(0.2, 0.85) });
    pb.add(new THREE.BoxGeometry(0.16, 0.065, 0.05), { m: T(0.0, 0.065, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.85) });
    const sc = new THREE.CylinderGeometry(0.022, 0.026, 0.3, 10); sc.rotateZ(-Math.PI / 2);
    pb.add(sc, { m: T(0.08, 0.125, 0), slot: SLOT.DARK, bw: 0, mulFn: edgeLit });
    for (const x of [-0.07, 0.23]) { const lens = new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10); lens.rotateZ(-Math.PI / 2); pb.add(lens, { m: T(x, 0.125, 0), slot: SLOT.TRIM, bw: 0 }); }
    pb.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10).rotateZ(-Math.PI / 2), { m: T(0.24, 0.125, 0), slot: SLOT.GEM, bw: 0, emis: 1 });
    const stock = slab([[-0.06, 0.09], [-0.4, 0.07], [-0.44, -0.07], [-0.38, -0.08], [-0.12, -0.0], [-0.04, -0.04], [0.02, 0.04]], 0.05);
    pb.add(stock, { slot: SLOT.WOOD, bw: 0, mulFn: (p) => { const f = 0.72 + 0.2 * Math.sin(p.x * 60 + p.y * 30); return [f, f * 0.88, f * 0.78]; } });
    if (t >= 1) runeStrip(pb, 0, 0.5, 0.008, 0.024, { m: T(0.2, 0.05, 0).multiply(R(0, 0, -Math.PI / 2)) });
    return { len: 0.92, tip: [0.92, 0.075, 0], muzzle: [0.92, 0.075, 0], barrel: 'x', grip2: [0.36, 0.035, 0], grip2rot: [0, 0, -Math.PI / 2] };
  },
  // Starcaller: tall staff; the star orb floats above the crescent head (separate child mesh 'orb')
  starstaff(pb, t) {
    const H = 1.78, y0 = -0.62;
    const pts = [], rads = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new THREE.Vector3(0, y0 + u * H, 0)); rads.push(0.018 + 0.004 * Math.sin(u * 30) * (t >= 1 ? 1 : 0.3) + (u > 0.9 ? (u - 0.9) * 0.2 : 0)); }
    pb.add(tubeGeo(pts, rads, 8), { slot: t === 0 ? SLOT.WOOD : SLOT.METAL, bw: 0, mulFn: (p, n) => { const f = 0.78 + 0.25 * Math.abs(n.x); return [f, f, f * 1.03]; } });
    for (const y of [y0 + 0.04, 0.12, -0.12, y0 + H * 0.82]) pb.add(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 8), { m: T(0, y, 0), slot: SLOT.TRIM, bw: 0 });
    const top = y0 + H;
    // crescent head cradling the orb
    const cres = new THREE.TorusGeometry(0.13, 0.016, 6, 20, Math.PI * 1.35);
    pb.add(cres, { m: T(0, top + 0.1, 0).multiply(R(0, 0, -Math.PI * 0.18 - Math.PI / 2 + Math.PI * 0.5)), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    for (const s2 of [-1, 1]) pb.add(new THREE.ConeGeometry(0.018, 0.09, 5), { m: T(s2 * 0.1, top + 0.2, 0).multiply(R(0, 0, -s2 * 0.5)), slot: SLOT.TRIM, bw: 0 });
    runeStrip(pb, y0 + H * 0.55, y0 + H * 0.95, 0.008, 0.02);
    pb.add(new THREE.ConeGeometry(0.02, 0.08, 6).rotateX(Math.PI), { m: T(0, y0 - 0.03, 0), slot: SLOT.TRIM, bw: 0 });
    return { len: top + 0.12, tip: [0, top + 0.12, 0], orb: [0, top + 0.12, 0], grip2: -0.35 };
  },
  // floating star orb (rendered with the glow material; spins in update)
  staforb(pb, t) {
    pb.add(new THREE.IcosahedronGeometry(0.075, 2), { slot: SLOT.GLOW, bw: 0, emis: 1, mulFn: (p, n) => { const f = 0.8 + 0.4 * Math.max(0, n.y); return [f, f, f]; } });
    for (let i = 0; i < 6; i++) { const sp = new THREE.ConeGeometry(0.022, 0.1, 4); sp.translate(0, 0.1, 0); const q = new THREE.Euler(i < 2 ? 0 : Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0); pb.add(sp, { m: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(i * 1.05, i * 0.7, 0)), slot: SLOT.GLOW, bw: 0, emis: 1 }); void q; }
    for (const a of [0, 1.1]) pb.add(new THREE.TorusGeometry(0.13, 0.005, 3, 28), { m: R(Math.PI / 2 + a, a * 0.8, 0), slot: SLOT.TRIM, bw: 0, emis: 0.5 });
    return { len: 0.2 };
  },
  // Songweaver: golden hand harp (held against the left forearm; strings glow when played)
  harp(pb, t) {
    const H = 0.62;
    const pts = [], rads = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector3(0, u * H, 0.24 * Math.sin(u * Math.PI) * (1 - u * 0.3))); rads.push(0.022 - u * 0.006); }
    pb.add(tubeGeo(pts, rads, 7), { slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    const neck = [], nr = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; neck.push(new THREE.Vector3(0, H - u * 0.05 + Math.sin(u * Math.PI) * 0.05, u * 0.34)); nr.push(0.02); }
    pb.add(tubeGeo(neck, nr, 6), { slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    const col = [new THREE.Vector3(0, 0.02, 0.34), new THREE.Vector3(0, H - 0.04, 0.34)];
    pb.add(tubeGeo(col, [0.024, 0.02], 7), { slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.85) });
    pb.add(new THREE.BoxGeometry(0.05, 0.05, 0.4), { m: T(0, 0.02, 0.17), slot: SLOT.WOOD, bw: 0, mulFn: topLit(0.2, 0.85) });
    for (let i = 0; i < 9; i++) { const z = 0.03 + i * 0.034; const top2 = H * (0.55 + 0.4 * Math.sin((z / 0.34) * Math.PI) * 0.5) + 0.1; const st = new THREE.CylinderGeometry(0.0022, 0.0022, top2 - 0.04, 3); pb.add(st, { m: T(0, (top2 + 0.04) / 2, z), slot: SLOT.RUNE, bw: 0, rune: 1, mul: [1.4, 1.4, 1.4] }); }
    pb.add(new THREE.OctahedronGeometry(0.035, 0), { m: T(0, H + 0.02, 0.02), slot: SLOT.GEM, bw: 0, emis: 1 });
    if (t >= 1) for (const s2 of [-1, 1]) { const w = slab([[0, 0], [0.08, 0.05], [0.14, 0.14], [0.06, 0.09]], 0.012); pb.add(w, { m: T(0, H - 0.02, -0.01).multiply(R(0, Math.PI / 2, 0)).multiply(new THREE.Matrix4().makeScale(s2, 1, 1)), slot: SLOT.TRIM, bw: 0, flip: s2 < 0 }); }
    return { len: H, tip: [0, H, 0.1] };
  },
  // Bladedancer: curved short blade (×2)
  shortblade(pb, t) {
    const L = 0.62, y0 = 0.07;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([-0.03 + 0.05 * u * u, y0 + u * L]); }
    const back = []; for (let i = 8; i >= 0; i--) { const u = i / 8; back.push([0.035 - 0.02 * u + 0.05 * u * u + (u > 0.85 ? -(u - 0.85) * 0.3 : 0), y0 + u * L * (u > 0.95 ? 0.98 : 1)]); }
    bladeShape(pb, [...pts, ...back], 0.014, { cast: 0.5 });
    runeStrip(pb, y0 + 0.05, y0 + L * 0.8, 0.008, 0.0095, { x: 0.012 });
    pb.add(new THREE.BoxGeometry(0.1, 0.022, 0.035), { m: T(0, 0.045, 0), slot: SLOT.TRIM, bw: 0, mulFn: topLit(0.3, 0.9) });
    wrapGrip(pb, -0.1, 0.035, 0.015);
    pb.add(new THREE.ConeGeometry(0.018, 0.05, 5).rotateX(Math.PI), { m: T(0, -0.12, 0), slot: SLOT.TRIM, bw: 0 });
    return { len: y0 + L, tip: [0.05, y0 + L, 0] };
  },
  // Bladedancer: the greatblade worn across the back
  greatblade(pb, t) {
    const L = 1.18, y0 = 0.09, W = 0.12;
    const pts = [[-W * 0.45, y0], [-W * 0.5, y0 + L * 0.6], [-W * 0.3, y0 + L * 0.9], [0.02, y0 + L], [W * 0.55, y0 + L * 0.82], [W * 0.5, y0 + L * 0.3], [W * 0.45, y0]];
    bladeShape(pb, pts, 0.02, { cast: 0.5 });
    runeStrip(pb, y0 + 0.08, y0 + L * 0.8, 0.012, 0.0115);
    pb.add(new THREE.BoxGeometry(0.2, 0.03, 0.05), { m: T(0, 0.05, 0), slot: SLOT.TRIM, bw: 0 });
    wrapGrip(pb, -0.22, 0.03, 0.018);
    return { len: y0 + L, tip: [0, y0 + L, 0], grip2: -0.16 };
  },
  // Demonbound: demonic glaive — a long haft with a great crescent blade and a spiked counter-blade
  glaive(pb, t) {
    const top = 0.95, bot = -0.62;
    pb.add(tubeGeo([new THREE.Vector3(0, bot, 0), new THREE.Vector3(0, top, 0)], [0.02, 0.019], 8), { slot: SLOT.METAL, bw: 0, mulFn: edgeLit });
    for (let i = 0; i < 5; i++) pb.add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8), { m: T(0, -0.25 + i * 0.12, 0), slot: SLOT.HILT, bw: 0 });
    const crescent = [];
    for (let i = 0; i <= 10; i++) { const a = -0.2 + i / 10 * 2.2; crescent.push([Math.sin(a) * 0.3 - 0.02, top - 0.12 + Math.cos(a) * 0.3 * 0.9 + 0.1]); }
    for (let i = 10; i >= 0; i--) { const a = -0.2 + i / 10 * 2.2; crescent.push([Math.sin(a) * 0.19 + 0.02, top - 0.1 + Math.cos(a) * 0.19 * 0.9 + 0.06]); }
    bladeShape(pb, crescent, 0.02, { m: T(0, 0, 0) });
    runeStrip(pb, top - 0.05, top + 0.2, 0.01, 0.0115, { x: 0.12 });
    const spike = slab([[-0.035, 0], [0.035, 0], [0, 0.26]], 0.02);
    pb.add(spike, { m: T(0, top + 0.08, 0), slot: SLOT.BLADE, bw: 0, mulFn: bladeLit, cast: 0.5 });
    const cb = slab([[-0.03, 0], [0.03, 0], [0.06, -0.12], [0, -0.2]], 0.02);
    pb.add(cb, { m: T(0, bot, 0), slot: SLOT.BLADE, bw: 0, mulFn: bladeLit });
    hornCurve(pb, [0, top - 0.02, 0], [-0.4, 0.3, 0], [0, 0.5, 0], 0.16, 0.022, SLOT.HORN);
    pb.add(new THREE.OctahedronGeometry(0.03, 0), { m: T(0, top - 0.04, 0.02), slot: SLOT.GEM, bw: 0, emis: 1 });
    return { len: top + 0.34, tip: [0.2, top + 0.2, 0], grip2: -0.34 };
  },
  // Demon form claws (rigid, on each hand)
  claw(pb, t) {
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 0.028; hornCurve(pb, [0.02, 0.02, z], [0.2, 0.9, 0], [0.4, -0.2, 0], 0.18, 0.012, SLOT.HORN, null, 5); }
    pb.add(new THREE.BoxGeometry(0.06, 0.07, 0.09), { m: T(0, -0.01, 0), slot: SLOT.DARK, bw: 0 });
    return { len: 0.2, tip: [0.06, 0.2, 0] };
  },

  // ---- props for life skills / items (held in the fist grip; handle along +Y) ----
  axe(pb, t) {
    pb.add(tubeGeo([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.5, 0)], [0.018, 0.016], 7), { slot: SLOT.WOOD, bw: 0 });
    const head = slab([[0, -0.05], [0.13, -0.09], [0.16, 0.0], [0.13, 0.09], [0, 0.05]], 0.03);
    pb.add(head, { m: T(0.01, 0.44, 0), slot: SLOT.BLADE, bw: 0, mulFn: edgeLit });
    pb.add(new THREE.BoxGeometry(0.05, 0.08, 0.04), { m: T(0, 0.44, 0), slot: SLOT.METAL, bw: 0 });
    return { len: 0.5, tip: [0.15, 0.44, 0], grip2: -0.26 };
  },
  pickaxe(pb, t) {
    pb.add(tubeGeo([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.5, 0)], [0.018, 0.016], 7), { slot: SLOT.WOOD, bw: 0 });
    const pts = [], rads = []; for (let i = 0; i <= 8; i++) { const u = i / 8 * 2 - 1; pts.push(new THREE.Vector3(u * 0.22, 0.46 + 0.05 * (1 - u * u), 0)); rads.push(0.022 * (1 - Math.abs(u) * 0.75) + 0.004); }
    pb.add(tubeGeo(pts, rads, 6), { slot: SLOT.METAL, bw: 0, mulFn: edgeLit });
    return { len: 0.5, tip: [0.22, 0.46, 0], grip2: -0.26 };
  },
  shovel(pb, t) {
    pb.add(tubeGeo([new THREE.Vector3(0, -0.45, 0), new THREE.Vector3(0, 0.55, 0)], [0.017, 0.016], 7), { slot: SLOT.WOOD, bw: 0 });
    pb.add(slab([[-0.09, 0], [0.09, 0], [0.08, 0.2], [0, 0.26], [-0.08, 0.2]], 0.012), { m: T(0, 0.52, 0), slot: SLOT.METAL, bw: 0, mulFn: edgeLit });
    pb.add(new THREE.BoxGeometry(0.1, 0.02, 0.03), { m: T(0, -0.46, 0), slot: SLOT.WOOD, bw: 0 });
    return { len: 0.78, tip: [0, 0.78, 0], grip2: -0.3 };
  },
  rod(pb, t) {
    const pts = [], rads = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector3(0, -0.25 + u * 1.75, 0)); rads.push(0.016 * (1 - u * 0.8) + 0.002); }
    pb.add(tubeGeo(pts, rads, 6), { slot: SLOT.WOOD, bw: 0 });
    const reel = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8); reel.rotateZ(Math.PI / 2);
    pb.add(reel, { m: T(0.03, 0.02, 0), slot: SLOT.METAL, bw: 0 });
    pb.add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.7, 3), { m: T(0, 1.5 - 0.35, 0.02), slot: SLOT.LINEN, bw: 0 });
    return { len: 1.5, tip: [0, 1.5, 0] };
  },
  lute(pb, t) {
    pb.add(new THREE.BoxGeometry(0.05, 0.36, 0.022), { m: T(0, 0.0, 0), slot: SLOT.WOOD, bw: 0, mulFn: topLit(0.2, 0.8) });
    const body = new THREE.SphereGeometry(0.14, 12, 8); body.scale(1, 1.25, 0.45);
    pb.add(body, { m: T(0, -0.3, -0.02), slot: SLOT.WOOD, bw: 0, mulFn: (p, n) => { const f = 0.75 + 0.3 * Math.max(0, -n.z) + 0.05 * Math.sin(p.y * 90); return [f, f * 0.85, f * 0.7]; } });
    pb.add(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 12).rotateX(Math.PI / 2), { m: T(0, -0.26, -0.085), slot: SLOT.DARK, bw: 0 });
    pb.add(new THREE.BoxGeometry(0.06, 0.08, 0.03), { m: T(0, 0.2, 0.01).multiply(R(0.5, 0, 0)), slot: SLOT.WOOD, bw: 0 });
    for (let i = 0; i < 4; i++) pb.add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.56, 3), { m: T(-0.012 + i * 0.008, -0.1, -0.014), slot: SLOT.LINEN, bw: 0 });
    return { len: 0.4, tip: [0, 0.2, 0] };
  },
  potion(pb, t) {
    const b = new THREE.SphereGeometry(0.035, 10, 8); b.scale(1, 1.1, 1);
    pb.add(b, { m: T(0, 0.02, 0), slot: SLOT.GEM, bw: 0, emis: 0.6 });
    pb.add(new THREE.CylinderGeometry(0.012, 0.014, 0.05, 8), { m: T(0, 0.07, 0), slot: SLOT.GEM, bw: 0, emis: 0.3 });
    pb.add(new THREE.CylinderGeometry(0.014, 0.013, 0.02, 8), { m: T(0, 0.1, 0), slot: SLOT.WOOD, bw: 0 });
    return { len: 0.12, tip: [0, 0.1, 0] };
  },
  bomb(pb, t) {
    pb.add(new THREE.IcosahedronGeometry(0.05, 1), { m: T(0, 0.04, 0), slot: SLOT.DARK, bw: 0, mulFn: topLit(0.4, 0.8) });
    pb.add(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), { m: T(0, 0.095, 0), slot: SLOT.METAL, bw: 0 });
    pb.add(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4), { m: T(0.01, 0.12, 0).multiply(R(0, 0, -0.4)), slot: SLOT.LINEN, bw: 0 });
    pb.add(new THREE.OctahedronGeometry(0.008, 0), { m: T(0.02, 0.145, 0), slot: SLOT.GLOW, bw: 0, emis: 1 });
    return { len: 0.1, tip: [0, 0.1, 0] };
  },
};

/** armGeometry(type, { tier, cls, lod }) → { geo, info } (cached) */
export function armGeometry(type, o = {}) {
  const tier = Math.max(0, Math.min(2, o.tier ?? 1)), cls = o.cls || 'npc';
  const key = `${type}|${tier}|${cls}|${o.lod || 'full'}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const fn = BUILDERS[type];
  if (!fn) return null;
  const pb = new PB(NOBASE);
  const info = fn(pb, tier, o) || {};
  info.kind = type;
  const piece = pb.build();
  const geo = assemble([{ p: piece }], palette(tier, cls, o.colors), { skinned: false });
  geo.computeBoundingSphere();
  const out = { geo, info, tris: geo.index.count / 3 };
  CACHE.set(key, out);
  return out;
}
export const ARM_TYPES = () => Object.keys(BUILDERS);
