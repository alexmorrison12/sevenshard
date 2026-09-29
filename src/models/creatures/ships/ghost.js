// GHOST SHIP — a drowned galleon that sails anyway: grey-green rotting planks furred with algae and barnacles, breached
// sides with splintered planks and bare ribs, a snapped mizzen and a fore topmast broken off, askew yards, torn spectral
// sails that glow teal (pulsing) with the "Hollow Eye", ghost-green lanterns, hanging chains and weed, a skeletal
// siren figurehead with burning eyes, teal rim light so the silhouette reads as haunted from the game camera.
import * as THREE from 'three';
import { linColor as lc } from '../../../engine/geom.js';
import { WoodBuilder, V3, M, MY, cyl, box, cone, lerp } from './build.js';
import { makeHull, buildHull, buildFoam, sweep, sidePath } from './hull.js';
import { SailBuilder, squareSail, foreAft, flag } from './sails.js';
import { mast, spar, platform, shrouds } from './rig.js';
import { cannon, gunport, lantern, wheel, windowAt, balustrade, ladder, barrel, crate } from './props.js';
import { shroudLines, yard, anchor, rudder, chain, skull, breach, barnacles, seaweed } from './common.js';
import { Atlas, rgb, tatter, hh } from './tex.js';

const C = {
  bottom: lc(0x28302a), algae: lc(0x1c2c20), wood: lc(0x5e6a62), woodD: lc(0x424c46), woodL: lc(0x7a887e), deck: lc(0x6a7068),
  inner: lc(0x2e3632), cap: lc(0x2a302c), bone: lc(0xc9c6b2), rust: lc(0x3c4238), glass: lc(0x46ffc0), glassW: lc(0x7affe0),
  mast: lc(0x4a524c), spar: lc(0x353c38), rope: lc(0x28302a), shroud: lc(0x1e2420), weed: lc(0x10261a), chain: lc(0x2a2a26), barn: lc(0x8a8e80),
};
const OPEN3 = (h, o) => [[0, -h], [o, -h * 0.9], [o, h * 0.9], [0, h]];

/** Spectral cloth: dark teal with glowing seams, wisps and a luminous border, then torn. */
function spectral(seed, o = {}) {
  return (g, w, h) => {
    g.fillStyle = rgb(0x0f4a44); g.fillRect(-2, -2, w + 4, h + 4);
    // wisps
    for (let i = 0; i < 26; i++) {
      const x = hh(i, seed, 1) * w, y = hh(i, seed, 2) * h, r = (0.05 + hh(i, seed, 3) * 0.14) * w;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(90,255,215,${0.12 + hh(i, seed, 4) * 0.18})`); gr.addColorStop(1, 'rgba(90,255,215,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // vertical panel seams glowing
    const panels = o.panels ?? 8;
    g.strokeStyle = 'rgba(120,255,225,0.55)'; g.lineWidth = Math.max(1.5, w / 260);
    for (let i = 1; i < panels; i++) { const x = i / panels * w + (hh(i, seed, 5) - 0.5) * 6; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += h / 8) g.lineTo(x + Math.sin(y * 0.05 + i) * 3, y); g.stroke(); }
    // luminous border
    g.strokeStyle = 'rgba(160,255,235,0.8)'; g.lineWidth = Math.max(3, w / 90); g.strokeRect(2, 2, w - 4, h - 4);
    if (o.eye) hollowEye(g, w / 2, h * 0.45, h * o.eye);
    tatter(g, w, h, { foot: o.foot ?? 0.25, teeth: o.teeth ?? 10, holes: o.holes ?? 4, holeR: o.holeR ?? 0.08, sides: o.sides ?? 0.08, seed: seed + 3 });
  };
}
/** The Hollow Eye: a luminous almond eye with a slit pupil inside a ring of rune ticks. */
function hollowEye(g, cx, cy, r) {
  g.save(); g.translate(cx, cy);
  g.strokeStyle = 'rgba(190,255,240,0.95)'; g.lineWidth = r * 0.07;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, l = i % 3 ? 0.1 : 0.2; g.lineWidth = r * 0.045; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); g.lineTo(Math.cos(a) * r * (0.86 - l), Math.sin(a) * r * (0.86 - l)); g.stroke(); }
  g.fillStyle = 'rgba(150,255,230,0.35)';
  g.beginPath(); g.moveTo(-r * 0.62, 0); g.quadraticCurveTo(0, -r * 0.5, r * 0.62, 0); g.quadraticCurveTo(0, r * 0.5, -r * 0.62, 0); g.fill();
  g.lineWidth = r * 0.06; g.stroke();
  g.fillStyle = 'rgba(220,255,250,1)'; g.beginPath(); g.ellipse(0, 0, r * 0.07, r * 0.24, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function buildGhost() {
  const wb = new WoodBuilder(), sb = new SailBuilder(), atlas = new Atlas(1024);
  const R = atlas.pack({
    mc: [512, 256, spectral(31, { eye: 0.3, foot: 0.22, holes: 3 })], fc: [448, 224, spectral(32, { foot: 0.4, holes: 5, teeth: 8 })],
    mt: [384, 192, spectral(33, { foot: 0.3, holes: 4 })], cj: [320, 144, spectral(34, { foot: 0.5, holes: 3, teeth: 7 })],
    jib: [256, 224, spectral(35, { foot: 0.35, holes: 2, panels: 5 })],
    flag: [192, 128, (g, w, h) => { g.fillStyle = rgb(0x0c1612); g.fillRect(-2, -2, w + 4, h + 4); hollowEye(g, w * 0.45, h / 2, h * 0.32); tatter(g, w, h, { sides: 0.2, foot: 0.25, holes: 2, seed: 9 }); }],
    rope: [12, 12, (g) => { g.fillStyle = rgb(0x28302a); g.fillRect(-2, -2, 16, 16); }],
  });
  const ropeUV = R.rope.uv(0.5, 0.5);
  // ---------------------------------------------------------------------------------------------- hull
  const mainY = u => 1.7 + 0.35 * Math.pow(Math.max(0, (0.55 - u) / 0.55), 2) + 0.55 * Math.pow(Math.max(0, (u - 0.55) / 0.45), 2);
  const H = makeHull({
    L: 18.6, B: 5.9, keel: -2.0, yw: 0.9, bilge: 2.4, tumble: 0.2, maxU: 0.44,
    bowFull: [1.5, 2.6], bowRake: 2.4, bowCurve: 2.0, sternFull: 2.2, transom: 0.7, knuckle: 1.1, transomDrop: 1.0,
    sternRake: 1.6, transomRake: 0.16,
    decks: [{ u0: 0, u1: 0.12, y: 4.45 }, { u0: 0.12, u1: 0.3, y: 3.35 }, { u0: 0.3, u1: 0.81, y: mainY }, { u0: 0.81, u1: 1, y: 2.85 }],
    bulwark: 0.95, railBlend: 0.06, thick: 0.15, camber: 0.07,
  });
  const sheer = u => mainY(Math.min(1, Math.max(0, u)));
  const rot = (x, y, z) => { const n = hh(Math.floor(z / 1.3) + 50, Math.floor((y + 3) / 0.2), 3); return n > 0.8 ? C.woodD : n < 0.12 ? C.woodL : C.wood; };
  const hullPaint = (x, y, z, u) => (y < -0.05 ? C.bottom : y < 0.5 + 0.25 * Math.sin(z * 1.3) ? C.algae : rot(x, y, z));
  buildHull(wb, H, { hull: hullPaint, deck: C.deck, inner: C.inner, cap: C.cap, bulkhead: C.woodD, transom: (x, y, z) => (y < 0.45 ? C.algae : rot(x, y, x * 3)) });
  for (const side of [-1, 1]) {
    sweep(wb, sidePath(H, 0.004, 0.99, u => sheer(u) - 0.6, side, 44), OPEN3(0.09, 0.07), { color: C.woodD, d: 0.8, closed: false });
    sweep(wb, sidePath(H, 0.006, 0.98, u => sheer(u) - 1.15, side, 44), OPEN3(0.07, 0.06), { color: C.woodD, d: 0.8, closed: false });
    sweep(wb, sidePath(H, 0.005, 0.99, u => H.railY(u) - 0.1, side, 50), OPEN3(0.03, 0.03), { color: C.bone, d: 0.3, closed: false });
  }
  // breaches, barnacles, weed
  for (const [u, y, side, w, h] of [[0.62, 0.95, -1, 1.0, 0.7], [0.36, 1.45, -1, 0.8, 0.55], [0.55, 1.05, 1, 1.1, 0.75], [0.2, 0.8, 1, 0.7, 0.5], [0.83, 2.25, 1, 0.7, 0.45]]) breach(wb, H, u, y, side, { w, h, wood: C.woodL, rib: C.woodD, dark: lc(0x0a3a30), glow: 0.9 });
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) barnacles(wb, H, 0.08 + k * 0.105, 0.2 + hh(k, side, 1) * 0.35, side, 7, { color: C.barn, dark: C.algae });
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
    const u = 0.1 + k * 0.095 + hh(k, side, 3) * 0.03, f = H.frame(u, H.railY(u) - 0.05, side);
    seaweed(wb, f.o.clone().addScaledVector(f.N, 0.06), 0.8 + hh(k, side, 4) * 1.2, { color: C.weed });
  }
  stem(wb, H);
  wb.mark('hull');
  // ---------------------------------------------------------------------------------------------- stern castle (two decks), windows, lantern
  const yP = 4.45, yQ = 3.35, yRT = H.railY(0), zT = y => H.zStern(y);
  {
    for (const [wy, n, ww, hh2] of [[2.4, 5, 0.38, 0.55], [3.7, 4, 0.34, 0.45]]) {
      const span = H.hb(wy, 0) * 1.5;
      for (let i = 0; i < n; i++) {
        const broken = (i + n) % 3 === 0;
        windowAt(wb, M(lerp(-span / 2, span / 2, i / (n - 1)), wy, zT(wy) + 0.07, -0.16), ww, hh2, { frame: C.woodD, glass: broken ? lc(0x061210) : C.glassW, glow: broken ? 0 : 1.1, mullion: C.cap, metal: 0 });
      }
    }
    for (const side of [-1, 1]) for (const [u, y] of [[0.06, 2.5], [0.16, 2.5], [0.06, 3.7]]) windowAt(wb, H.mat(u, y, side, 0.03), 0.34, 0.46, { frame: C.woodD, glass: C.glassW, glow: 0.9, mullion: C.cap, metal: 0 });
    // poop & quarterdeck balustrades (some balusters missing), ladders
    const zb1 = H.zAt(0.12, yP), w1 = H.hb(yP, 0.12) - 0.16;
    balustrade(wb, V3(-w1, yP, zb1 + 0.05), V3(w1, yP, zb1 + 0.05), { h: 0.8, wood: C.woodD, cap: C.cap, skip: p => Math.abs(p.x) < 0.4 || hh(Math.round(p.x * 10), 1, 2) > 0.7 });
    ladder(wb, V3(0, yQ, zb1 - 0.95), V3(0, yP, zb1 - 0.02), 0.66, { wood: C.woodD });
    const zb2 = H.zAt(0.3, yQ), w2 = H.hb(yQ, 0.3) - 0.16;
    balustrade(wb, V3(-w2, yQ, zb2 + 0.05), V3(w2, yQ, zb2 + 0.05), { h: 0.8, wood: C.woodD, cap: C.cap, skip: p => Math.abs(Math.abs(p.x) - (w2 - 0.55)) < 0.4 || hh(Math.round(p.x * 10), 2, 2) > 0.72 });
    for (const s of [-1, 1]) ladder(wb, V3(s * (w2 - 0.55), mainY(0.31), zb2 - 1.05), V3(s * (w2 - 0.55), yQ, zb2 - 0.02), 0.6, { wood: C.woodD });
    wheel(wb, V3(0, yP + 1.0, 7.75), yP, { wood: C.woodD, gold: C.rust });
    lantern(wb, V3(0, yRT + 0.1, zT(yRT) + 0.1), { s: 1.3, glow: 3.2, frame: C.rust, glass: C.glass, metal: 0.2 });
    for (const s of [-1, 1]) lantern(wb, V3(s * (H.hb(yRT, 0) - 0.08), yRT + 0.08, zT(yRT) - 0.05), { s: 0.9, glow: 3, frame: C.rust, glass: C.glass, metal: 0.2 });
    // stern gallery skull between the window rows
    skull(wb, M(0, 3.05, zT(3.05) + 0.12, 0, Math.PI, 0), 0.5, { bone: C.bone, eyes: C.glass, eyeGlow: 2.5, piv: [0, 3, 9] });
  }
  rudder(wb, H, { wood: C.woodD, bottom: C.algae, iron: C.rust });
  barnacles(wb, H, 0.02, 0.2, 1, 6, { color: C.barn, dark: C.algae }); barnacles(wb, H, 0.02, 0.3, -1, 6, { color: C.barn, dark: C.algae });
  wb.mark('stern');
  // ---------------------------------------------------------------------------------------------- forecastle + figurehead
  {
    const ub = 0.81, yF = 2.85, zb = H.zAt(ub, yF), w = H.hb(yF, ub) - 0.16;
    balustrade(wb, V3(-w, yF, zb - 0.05), V3(w, yF, zb - 0.05), { h: 0.78, wood: C.woodD, cap: C.cap, skip: p => Math.abs(Math.abs(p.x) - (w - 0.5)) < 0.4 || hh(Math.round(p.x * 10), 3, 2) > 0.7 });
    for (const s of [-1, 1]) ladder(wb, V3(s * (w - 0.5), mainY(0.8), zb + 0.95), V3(s * (w - 0.5), yF, zb + 0.02), 0.55, { wood: C.woodD });
    for (const s of [-1, 1]) {
      const f = H.frame(0.9, H.railY(0.9) - 0.1, s), b = f.o.clone().addScaledVector(f.N, 0.7).add(V3(0, 0.1, -0.15));
      wb.add(box(0.2, 0.2, 0.7), MY(f.o, b).multiply(M(0, 0.35, 0, Math.PI / 2)), { color: C.woodD, d: 0.8 });
      anchor(wb, b.x, b.y - 0.05, b.z, 0.74, { ry: s > 0 ? -0.4 : 0.4, rz: s * 0.2, color: C.rust, stock: C.woodD });
      seaweed(wb, V3(b.x, b.y - 1.2, b.z), 1.0, { color: C.weed });
    }
    lantern(wb, V3(0, H.railY(1) + 0.05, H.zBow(H.railY(1)) + 0.55), { s: 0.85, glow: 3, frame: C.rust, glass: C.glass, metal: 0.2 });
    siren(wb, H);
  }
  wb.mark('bow');
  // ---------------------------------------------------------------------------------------------- guns (rusted, no lids)
  const guns = { L: [], R: [] };
  let slot = 0;
  for (const side of [-1, 1]) for (const z of [-3.6, -2.0, -0.4, 2.8]) {
    const u = H.uAtZ(z, 2.2), y = mainY(u) + 0.47, xo = H.hb(y, u);
    gunport(wb, H, { z, y: y - 0.02, side, frame: C.woodD, lid: false });
    const muzzle = cannon(wb, { x: side * (xo - 0.72), y, z, slot, barrel: C.rust, metal: 0.12, wood: C.woodD });
    (side < 0 ? guns.L : guns.R).push({ pos: muzzle, slot: slot++ });
  }
  wb.mark('guns');
  // ---------------------------------------------------------------------------------------------- masts (fore topmast snapped, mizzen broken)
  const FORE = -4.6, MAIN = 0.8, MIZ = 5.2;
  const yFore = mainY(H.uAtZ(FORE, 1.8)), yMain = mainY(H.uAtZ(MAIN, 1.8));
  mast(wb, { z: FORE, y0: yFore - 0.3, y1: 10.0, r0: 0.27, r1: 0.21, color: C.mast, hoopColor: C.rust });
  brokenTop(wb, V3(0, 9.3, FORE), V3(0.35, 11.6, FORE + 0.5), 0.15, C.mast);
  mast(wb, { z: MAIN, y0: yMain - 0.3, y1: 11.2, r0: 0.31, r1: 0.23, color: C.mast, hoopColor: C.rust });
  mast(wb, { z: MAIN, y0: 10.5, y1: 15.0, r0: 0.19, r1: 0.1, color: C.mast, hoops: 1, hoopColor: C.rust });
  brokenTop(wb, V3(0, yQ - 0.2, MIZ), V3(-0.12, 7.4, MIZ + 0.1), 0.22, C.mast);
  // the snapped mizzen top lies across the quarterdeck and over the rail
  spar(wb, V3(-0.4, yQ + 0.35, MIZ + 0.5), V3(2.9, yQ + 1.3, MIZ + 2.9), 0.16, 0.1, C.mast);
  spar(wb, V3(1.5, yQ + 0.2, 4.7), V3(-2.4, yQ + 0.9, 3.9), 0.08, 0.06, C.spar);
  for (const [z, y] of [[FORE, 10.0], [MAIN, 11.2]]) wb.add(box(0.5, 0.18, 0.78), M(0, y, z + 0.14), { color: C.spar, d: 0.8 });
  platform(wb, { z: FORE + 0.15, y: 9.4, r: 0.85, color: C.woodD, dark: C.cap });
  platform(wb, { z: MAIN + 0.18, y: 10.5, r: 0.74, nest: true, h: 0.7, color: C.woodD, wallColor: C.wood, dark: C.cap, rim: C.rust, rimMetal: 0.2 });
  spar(wb, V3(0, 3.1, -7.4), V3(0, 5.2, -12.4), 0.22, 0.1, C.mast);
  chain(wb, V3(0, 4.7, -11.4), 1.9, { color: C.chain, end: 'hook' });
  chain(wb, V3(0.1, 4.2, -10.2), 1.3, { color: C.chain });
  seaweed(wb, V3(0, 4.5, -11.0), 1.6, { color: C.weed });
  wb.mark('masts');
  // ---------------------------------------------------------------------------------------------- yards (askew) + spectral sails
  const BR = 0.18;
  const yf = yard(wb, { z: FORE, y: 8.85, w: 8.6, brace: BR, roll: 0.14, r: 0.14, color: C.spar, rope: C.rope, liftTo: V3(0, 9.9, FORE) });
  const ym = [
    yard(wb, { z: MAIN, y: 9.9, w: 9.2, brace: BR, r: 0.15, color: C.spar, rope: C.rope, liftTo: V3(0, 11.1, MAIN) }),
    yard(wb, { z: MAIN, y: 13.4, w: 7.0, brace: BR, roll: -0.12, r: 0.11, color: C.spar, rope: C.rope, liftTo: V3(0, 14.8, MAIN) }),
  ];
  const yz = yard(wb, { z: MIZ, y: 6.7, w: 5.4, brace: BR, roll: 0.32, r: 0.09, color: C.spar, rope: C.rope });
  const sq = [
    squareSail(sb, { z: FORE, y: 8.8, Wt: 8.1, Wb: 8.4, H: 3.9, brace: BR, roll: 0.14, fwd: 0.38, depth: 1.1, region: R.fc }),
    squareSail(sb, { z: MAIN, y: 9.85, Wt: 8.8, Wb: 9.1, H: 4.3, brace: BR, fwd: 0.4, depth: 1.35, region: R.mc }),
    squareSail(sb, { z: MAIN, y: 13.35, Wt: 6.4, Wb: 8.4, H: 3.1, brace: BR, roll: -0.12, fwd: 0.36, tilt: 0.55, depth: 0.95, region: R.mt }),
    squareSail(sb, { z: MIZ, y: 6.65, Wt: 5.0, Wb: 4.4, H: 2.0, brace: BR, roll: 0.32, fwd: 0.3, depth: 0.5, region: R.cj }),
  ];
  const railPt = (z, side) => { const u = H.uAtZ(z, 2.6); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05, H.zAt(u, H.railY(u))); };
  sb.sheet(sq[0].corners.clewR, railPt(-2.6, 1), 0.03, ropeUV);                   // one fore sheet parted
  sb.sheet(sq[1].corners.clewL, railPt(2.9, -1), 0.03, ropeUV); sb.sheet(sq[1].corners.clewR, railPt(2.5, 1), 0.03, ropeUV);
  sb.sheet(sq[2].corners.clewL, ym[0].a, 0.022, ropeUV); sb.sheet(sq[2].corners.clewR, ym[0].b, 0.022, ropeUV);
  foreAft(sb, { head: V3(0, 9.9, FORE - 0.25), tack: V3(0, 4.7, -11.2), clew: V3(-0.45, 5.4, -7.8), lee: -1, depth: 0.55, region: R.jib });
  flag(sb, { at: V3(0, 14.95, MAIN + 0.03), h: 1.0, len: 1.5, region: R.flag, phase: 0.4, n: 12 });
  wb.mark('sails+yards');
  // ---------------------------------------------------------------------------------------------- rigging (slack, some parted), hanging lanterns & chains
  const chanY = u => H.railY(u) - 0.18;
  for (const side of [-1, 1]) {
    shrouds(wb, H, { side, z0: FORE - 0.5, z1: FORE + 0.4, zm: FORE, chan: chanY(H.uAtZ(FORE, 2.6)), mastTop: V3(0, 9.35, FORE), n: 3, rope: C.shroud, wood: C.woodD, r: 0.034, dark: C.rust, ratStep: 0.5 });
    shrouds(wb, H, { side, z0: MAIN + 0.35, z1: MAIN + 1.45, zm: MAIN, chan: chanY(H.uAtZ(MAIN, 2.6)), mastTop: V3(0, 10.45, MAIN), n: 3, rope: C.shroud, wood: C.woodD, r: 0.036, dark: C.rust, ratStep: 0.5 });
    shroudLines(wb, [V3(side * 0.72, 10.6, MAIN + 0.2), V3(side * 0.7, 10.6, MAIN + 0.55)], V3(0, 14.6, MAIN), C.shroud, { r: 0.024, ratStep: 0.55 });
    wb.rope(V3(0, 14.8, MAIN), V3(side * (H.hb(4.2, 0.24) - 0.05), 4.25, 5.0), 0.024, C.shroud, 0.2);
  }
  wb.rope(V3(0, 9.4, FORE), V3(0, 4.35, -10.3), 0.042, C.shroud, 0.25);
  wb.rope(V3(0, 10.5, MAIN), V3(0, 3.4, FORE + 0.35), 0.04, C.shroud, 0.3);
  wb.rope(V3(0, 14.6, MAIN), V3(0, 9.5, FORE + 0.1), 0.028, C.shroud, 0.35);
  wb.rope(V3(0, 5.0, -11.9), V3(0, 0.6, H.zBow(0.6) - 0.05), 0.035, C.chain, 0.1);
  for (const [yd, to] of [[yf, [MAIN - 0.3, 6.4]], [ym[0], null], [ym[1], [MIZ, 6.4]]]) {
    for (const [p, s] of [[yd.a, -1], [yd.b, 1]]) wb.rope(p, to ? V3(s * 0.25, to[1], to[0]) : railPt(5.5, s), 0.018, C.rope, 0.6, { radial: 3 });
  }
  // parted ropes dangling from the yardarms, lanterns and chains hanging
  for (const p of [yf.a, ym[1].b, yz.b]) wb.rope(p, p.clone().add(V3(0.1, -2.6, 0.15)), 0.018, C.rope, 0, { radial: 3, anim: -3, piv: [p.x, p.y, p.z] });
  for (const [p, len] of [[ym[0].a, 1.2], [ym[0].b, 1.0], [yf.b, 1.4]]) {
    const hang = p.clone().add(V3(0, -0.05, 0));
    lantern(wb, hang.clone().add(V3(0, -len - 0.8 * 0.75, 0)), { s: 0.75, glow: 3, frame: C.rust, glass: C.glass, metal: 0.2, hang });
  }
  chain(wb, ym[0].a.clone().lerp(ym[0].c, 0.5), 2.2, { color: C.chain });
  chain(wb, ym[0].b.clone().lerp(ym[0].c, 0.4), 1.6, { color: C.chain, end: 'hook' });
  wb.mark('rigging');
  // ---------------------------------------------------------------------------------------------- deck: holes, bones, debris, ghost-fire braziers
  const yM = u => mainY(u);
  for (const [x, z, w, d] of [[0.6, -1.3, 1.1, 0.7], [-1.0, 1.9, 0.8, 0.9], [0.3, -4.1, 0.7, 0.5]]) {
    const y = yM(H.uAtZ(z, 1.8)) + 0.075;
    wb.add(box(w, 0.02, d), M(x, y, z, 0, hh(Math.round(z * 10), 1, 1) * 0.6), { color: [0.003, 0.006, 0.005], d: 0 });
    for (let i = 0; i < 5; i++) wb.add(box(0.14, 0.04, 0.4 + hh(i, Math.round(z), 2) * 0.4), M(x + (i - 2) * w * 0.22, y + 0.03, z + (hh(i, Math.round(z), 3) - 0.5) * d * 0.4, 0.3 * (hh(i, 4, Math.round(z)) - 0.5), 0.2, 0), { color: C.deck, d: 1 });
  }
  for (const [x, z] of [[-1.3, -0.4], [1.4, 3.1]]) skull(wb, M(x, yM(H.uAtZ(z, 1.8)) + 0.16, z, -0.3, 0.8, 0.2), 0.3, { bone: C.bone });
  for (const [x, z] of [[1.3, -5.0], [-1.25, -5.1]]) {
    const y = yM(0.79);
    wb.add(cyl(0.3, 0.22, 0.5, 8), M(x, y, z), { uv: 'keep', color: C.rust, metal: 0.2, d: 0 });
    wb.add(cone(0.24, 0.55, 6), M(x, y + 0.48, z), { uv: 'box', color: C.glass, e: 3.4, d: 0, piv: [x, y + 0.6, z] });
  }
  barrel(wb, -1.5, yM(0.5), 0.3, { wood: C.woodD, hoop: C.rust, r: 0.25, lie: true, ry: 0.7 });
  barrel(wb, 1.45, yM(0.34), 3.3, { wood: C.woodD, hoop: C.rust, r: 0.24, h: 0.6 });
  crate(wb, -1.5, yM(0.34), 3.2, 0.58, { ry: 0.5, wood: C.wood, dark: C.woodD });
  wb.mark('deck');
  return {
    wood: wb.build(), sails: sb.build(), foam: buildFoam(H, { strength: u => 0.7 + 0.3 * Math.sin(u * 17) ** 2 }), tex: atlas.texture(), report: wb.report(),
    sockets: {
      helm: [0, yP, 8.35], wake: [0, 0, H.zStern(0) + 0.4],
      cannonsL: guns.L.map(g => g.pos.toArray()), cannonsR: guns.R.map(g => g.pos.toArray()),
      slotsL: guns.L.map(g => g.slot), slotsR: guns.R.map(g => g.slot),
    },
    look: { wood: { rim: 0.42, rimColor: 0x4affc8, flick: 1.7, wrap: 0.55 }, sail: { trans: 0.9, glow: 1.25, glowCol: 0xffffff, pulse: 1.0, wrap: 0.7 }, foam: { color: 0x7affd8 } },
    motion: { bob: 0.11, roll: 0.034, pitch: 0.016, period: 0.72 },
  };
}

function stem(wb, H) {
  const path = [];
  for (let i = 0; i <= 12; i++) {
    const y = lerp(-2.0, H.railY(1) + 0.2, i / 12), z = H.zBow(y), z2 = H.zBow(y + 0.05);
    const T = V3(0, 0.05, z2 - z).normalize(), A = V3(0, T.z, -T.y);
    if (A.z > 0) A.negate();
    path.push({ o: V3(0, y, z), A, B: V3(1, 0, 0) });
  }
  sweep(wb, path, [[-0.05, -0.1], [0.16, -0.07], [0.16, 0.07], [-0.05, 0.1]], { color: (p) => (p.y < 0.5 ? C.algae : C.woodD), d: 0.6, closed: false });
  const kz0 = H.zStern(-2.0), kz1 = H.zBow(-2.0);
  wb.add(box(0.22, 0.3, kz0 - kz1), M(0, -2.0, (kz0 + kz1) / 2), { color: C.bottom, d: 0.6 });
}

/** Mast stump from a (base) to b (break) with jagged splinters at the break. */
function brokenTop(wb, a, b, r, col) {
  wb.add(cyl(r, r * 0.9, a.distanceTo(b), 8), MY(a, b), { uv: 'keep', color: col, d: 0.7 });
  const dir = V3().subVectors(b, a).normalize();
  for (let i = 0; i < 6; i++) {
    const ang = i / 6 * Math.PI * 2, off = V3(Math.cos(ang) * r * 0.6, 0, Math.sin(ang) * r * 0.6);
    const p = b.clone().add(off), tip = p.clone().addScaledVector(dir, 0.2 + hh(i, 5, 1) * 0.45).add(V3(Math.cos(ang) * 0.06, 0, Math.sin(ang) * 0.06));
    wb.add(cone(r * 0.45, p.distanceTo(tip), 3), MY(p, tip), { uv: 'box', color: C.woodL, d: 0.5 });
  }
}

/** Skeletal siren: skull with burning eyes, ribcage, arms flung back along the bow, weed-hair. */
function siren(wb, H) {
  const zs = H.zBow(2.7), bone = C.bone;
  skull(wb, M(0, 3.5, zs - 1.05, 0.35, 0, 0), 0.42, { bone, eyes: C.glass, eyeGlow: 3, piv: [0, 3.5, zs - 1] });
  wb.tube([V3(0, 3.25, zs - 0.95), V3(0, 2.8, zs - 0.65), V3(0, 2.2, zs - 0.35), V3(0, 1.7, zs - 0.05)], [0.06, 0.07, 0.06, 0.05], bone, { radial: 5, d: 0.2 });
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    const y = 3.0 - k * 0.2, z = zs - 0.8 + k * 0.1, pts = [];
    for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI * 0.95; pts.push(V3(s * Math.sin(a) * (0.26 - k * 0.02), y - Math.sin(a) * 0.05, z - 0.02 + (1 - Math.cos(a)) * 0.2)); }
    wb.tube(pts, 0.025, bone, { radial: 3, d: 0.2 });
  }
  for (const s of [-1, 1]) {
    const sh = V3(s * 0.22, 3.1, zs - 0.8), el = V3(s * 0.62, 3.35, zs - 0.35), hand = V3(s * (H.hb(3.3, 0.95) + 0.1), 3.45, zs + 0.3);
    wb.tube([sh, el, hand], [0.05, 0.045, 0.035], bone, { radial: 4, d: 0.2 });
    for (let f = 0; f < 3; f++) wb.tube([hand, hand.clone().add(V3(s * 0.05, 0.12 - f * 0.06, 0.22))], 0.012, bone, { radial: 3, d: 0.2 });
    for (let h = 0; h < 3; h++) seaweed(wb, V3(s * 0.12, 3.62, zs - 0.95 + h * 0.08), 1.4 + h * 0.3, { color: C.weed, w: 0.05 });
  }
}
