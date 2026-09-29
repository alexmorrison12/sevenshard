// DAWNRUNNER — the player's ship: a handsome brigantine (square-rigged fore, gaff main with square topsails, staysail,
// two jibs), warm honey planking, deep-blue upper works with gold mouldings, cream sails with a gold sun, a golden
// sunbird figurehead, stern castle with glowing windows and three great lanterns, dark-bronze guns (4 a side).
// All sail area stands forward of the helm, so the game camera (behind, 54° down) always sees whoever steers.
import * as THREE from 'three';
import { linColor as lc } from '../../../engine/geom.js';
import { WoodBuilder, V3, M, MY, cyl, box, sphere, cone, lerp } from './build.js';
import { makeHull, buildHull, buildFoam, sweep, sidePath } from './hull.js';
import { SailBuilder, squareSail, foreAft, flag } from './sails.js';
import { mast, spar, platform, shrouds } from './rig.js';
import { cannon, gunport, lantern, lamp, wheel, windowAt, balustrade, ladder, hatch, barrel, crate, coil, capstan, bell, boat, IRON } from './props.js';
import { shroudLines, yard, anchor, sunDisc, paintSun, pinRail, rudder } from './common.js';
import { Atlas, cloth, rgb } from './tex.js';

const C = {
  bottom: lc(0x7a3322), boot: lc(0x241810), honey: lc(0xc48a48), honeyD: lc(0x9a6232), walnut: lc(0x3e2414),
  blue: lc(0x1d4a86), gold: lc(0xd8a032), deck: lc(0xd9ae70), inner: lc(0x8e3e26),
  mast: lc(0xa8743e), spar: lc(0x6e4424), rope: lc(0x3a2818), shroud: lc(0x2a1c12), bronze: lc(0x5a4424), coil: lc(0xa8844e),
};
const OPEN3 = (h, o) => [[0, -h], [o, -h * 0.9], [o, h * 0.9], [0, h]];   // open moulding profile (against the hull)

export function buildDawnrunner() {
  const wb = new WoodBuilder(), sb = new SailBuilder(), atlas = new Atlas(1024);
  // ---------------------------------------------------------------------------------------------- sail atlas
  const course = (emblem, reefs = [0.2, 0.38]) => (g, w, h) => {
    cloth(g, w, h, { base: 0xf1e2c0, panels: 10, reefs, seed: w });
    g.fillStyle = rgb(0x1f4f96, 0.92); g.fillRect(0, h * 0.86, w, h * 0.055); g.fillStyle = rgb(0xe0a838, 0.9); g.fillRect(0, h * 0.84, w, h * 0.014);
    if (emblem) paintSun(g, w / 2, h * 0.5, h * emblem);
  };
  const plain = (stripe) => (g, w, h) => { cloth(g, w, h, { base: 0xf1e2c0, panels: 8, reefs: [0.25], seed: w + 3 }); if (stripe) { g.fillStyle = rgb(0x1f4f96, 0.9); g.fillRect(0, h * 0.84, w, h * 0.06); } };
  const R = atlas.pack({
    fc: [512, 240, course(0.28)], gaff: [448, 384, (g, w, h) => {
      cloth(g, w, h, { base: 0xf1e2c0, panels: 9, reefs: [0.78, 0.9], seed: 5 });
      g.fillStyle = rgb(0x1f4f96, 0.92); g.fillRect(0, h * 0.9, w, h * 0.05); g.fillStyle = rgb(0xe0a838, 0.9); g.fillRect(0, h * 0.885, w, h * 0.012);
      paintSun(g, w * 0.46, h * 0.47, h * 0.2);
    }],
    ft: [384, 176, plain(true)], mt: [384, 160, plain(true)], ftg: [256, 112, plain(false)], mtg: [256, 112, plain(false)],
    stay: [256, 224, (g, w, h) => cloth(g, w, h, { base: 0xf1e2c0, panels: 7, seed: 19 })],
    j1: [256, 240, (g, w, h) => cloth(g, w, h, { base: 0xf1e2c0, panels: 7, seed: 21 })],
    j2: [224, 208, (g, w, h) => cloth(g, w, h, { base: 0xf1e2c0, panels: 6, seed: 23 })],
    ens: [192, 128, (g, w, h) => {
      g.fillStyle = rgb(0x1f4f96); g.fillRect(-2, -2, w + 4, h + 4);
      g.fillStyle = rgb(0xe0a838); g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
      paintSun(g, w * 0.42, h / 2, h * 0.26, { halo: false, rays: 12 });
    }],
    pen: [512, 40, (g, w, h) => { g.fillStyle = rgb(0x1f4f96); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0xe0a838); g.fillRect(0, h * 0.4, w, h * 0.2); g.fillRect(w * 0.82, 0, w * 0.2, h); }],
    pen2: [384, 36, (g, w, h) => { g.fillStyle = rgb(0xe0a838); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0x1f4f96); g.fillRect(0, h * 0.35, w, h * 0.3); }],
    rope: [12, 12, (g) => { g.fillStyle = rgb(0x3a2818); g.fillRect(-2, -2, 16, 16); }],
  });
  const ropeUV = R.rope.uv(0.5, 0.5);
  // ---------------------------------------------------------------------------------------------- hull
  const mainY = u => 1.55 + 0.34 * Math.pow(Math.max(0, (0.55 - u) / 0.55), 2) + 0.5 * Math.pow(Math.max(0, (u - 0.55) / 0.45), 2);
  const H = makeHull({
    L: 17.4, B: 5.5, keel: -1.9, yw: 0.8, bilge: 2.3, tumble: 0.17, maxU: 0.44,
    bowFull: [1.5, 2.5], bowRake: 2.3, bowCurve: 2.1, sternFull: 2.1, transom: 0.66, knuckle: 1.0, transomDrop: 0.9,
    sternRake: 1.5, transomRake: 0.14,
    decks: [{ u0: 0, u1: 0.29, y: 3.1 }, { u0: 0.29, u1: 0.8, y: mainY }, { u0: 0.8, u1: 1, y: 2.62 }],
    bulwark: 0.95, railBlend: 0.075, thick: 0.14, camber: 0.07,
  });
  const sheer = u => mainY(Math.min(1, Math.max(0, u)));
  const blueBand = (y, u) => { const s = sheer(u), top = H.railY(u); return (y > top - 0.62 && y < top - 0.08) || (u < 0.3 && y > s + 0.25) || (u > 0.82 && y > s + 0.15); };
  const hullPaint = (x, y, z, u) => (y < -0.03 ? C.bottom : y < 0.13 ? C.boot : blueBand(y, u) ? C.blue : C.honey);
  buildHull(wb, H, {
    hull: hullPaint, deck: C.deck, inner: C.inner, cap: C.walnut, bulkhead: C.honeyD,
    transom: (x, y) => (y < -0.03 ? C.bottom : y < 0.13 ? C.boot : y > 3.3 ? C.blue : y > 1.75 ? C.honeyD : C.blue),
  });
  for (const side of [-1, 1]) {
    sweep(wb, sidePath(H, 0.004, 0.985, u => sheer(u) - 0.62, side, 44), OPEN3(0.09, 0.07), { color: C.walnut, d: 0.8, closed: false });
    sweep(wb, sidePath(H, 0.006, 0.975, u => sheer(u) - 1.12, side, 44), OPEN3(0.07, 0.06), { color: C.walnut, d: 0.8, closed: false });
    sweep(wb, sidePath(H, 0.005, 0.99, u => H.railY(u) - 0.1, side, 60), OPEN3(0.035, 0.035), { color: C.gold, metal: 1, d: 0, closed: false });
    sweep(wb, sidePath(H, 0.008, 0.98, u => H.railY(u) - 0.63, side, 60), OPEN3(0.03, 0.03), { color: C.gold, metal: 1, d: 0, closed: false });
    sweep(wb, sidePath(H, 0.02, 0.9, () => 0.13, side, 30), OPEN3(0.02, 0.02), { color: C.gold, metal: 0.6, d: 0, closed: false });
  }
  stem(wb, H, C);
  wb.mark('hull');
  // ---------------------------------------------------------------------------------------------- stern castle
  const yQ = 3.1, yRT = H.railY(0), zT = y => H.zStern(y);
  {
    const nW = 5, wy = 2.45, span = H.hb(wy, 0) * 1.55;
    for (let i = 0; i < nW; i++) windowAt(wb, M(lerp(-span / 2, span / 2, i / (nW - 1)), wy, zT(wy) + 0.06, -0.14), 0.4, 0.62, { frame: C.gold, glow: 0.8, mullion: C.walnut });
    sunDisc(wb, M(0, 1.45, zT(1.45) + 0.08, -0.12), 0.5, C.gold, { rays: 14 });
    wb.add(box(H.hb(1.95, 0) * 1.9, 0.08, 0.08), M(0, 1.95, zT(1.95) + 0.05, -0.14), { color: C.gold, metal: 1, d: 0 });
    wb.add(box(H.hb(3.15, 0) * 1.95, 0.1, 0.1), M(0, 3.15, zT(3.15) + 0.05, -0.14), { color: C.gold, metal: 1, d: 0 });
    // upper transom cartouche: gold arch + scrolls
    const zc = zT(3.6) + 0.07;
    wb.add(box(1.5, 0.08, 0.06), M(0, 3.62, zc, -0.14), { color: C.gold, metal: 1, d: 0 });
    for (const s of [-1, 1]) {
      wb.tube([V3(s * 0.75, 3.62, zc), V3(s * 1.05, 3.72, zc - 0.01), V3(s * 1.25, 3.55, zc - 0.02), V3(s * 1.15, 3.42, zc - 0.02), V3(s * 1.02, 3.5, zc - 0.02)], 0.035, C.gold, { metal: 1, d: 0, radial: 5 });
    }
    for (const s of [-1, 1]) {
      const a = V3(s * H.hb(1.2, 0) * 0.97, 1.2, zT(1.2) + 0.03), b = V3(s * H.hb(yRT, 0) * 0.97, yRT, zT(yRT) + 0.03);
      wb.add(box(0.12, a.distanceTo(b), 0.1), MY(a, b).multiply(M(0, a.distanceTo(b) / 2, 0)), { color: C.gold, metal: 1, d: 0 });
    }
  }
  for (const side of [-1, 1]) for (const [u, y] of [[0.07, 2.45], [0.16, 2.45], [0.24, 2.4]]) windowAt(wb, H.mat(u, y, side, 0.03), 0.36, 0.5, { frame: C.gold, glow: 0.7, mullion: C.walnut });
  {
    const zb = H.zAt(0.29, 2.3) - 0.03, y0 = mainY(0.3);
    for (const x of [-1.3, 1.3]) {
      wb.add(box(0.72, 1.18, 0.05), M(x, y0 + 0.6, zb), { color: C.walnut, d: 1 });
      wb.add(box(0.86, 0.08, 0.08), M(x, y0 + 1.24, zb - 0.01), { color: C.gold, metal: 1, d: 0 });
      for (const s of [-1, 1]) wb.add(box(0.07, 1.2, 0.08), M(x + s * 0.4, y0 + 0.6, zb - 0.01), { color: C.gold, metal: 1, d: 0 });
    }
    for (const x of [-2.0, 2.0]) lamp(wb, V3(x, y0 + 1.05, zb - 0.28), { s: 0.9, glow: 2.6, frame: C.gold, hang: V3(x, y0 + 1.5, zb - 0.28) });
  }
  {
    const zb = H.zAt(0.29, yQ), w = H.hb(yQ, 0.29) - 0.16;
    balustrade(wb, V3(-w, yQ, zb + 0.06), V3(w, yQ, zb + 0.06), { h: 0.82, wood: C.walnut, cap: C.gold, capMetal: 1, skip: p => Math.abs(p.x) < 0.45, posts: 4 });
    ladder(wb, V3(0, mainY(0.31), zb - 1.05), V3(0, yQ, zb - 0.02), 0.72, { wood: C.walnut, step: C.honeyD });
    wheel(wb, V3(0, yQ + 1.0, 6.25), yQ, { wood: C.walnut, gold: C.gold });
    wb.add(box(0.36, 0.7, 0.36), M(0, yQ + 0.35, 5.5), { color: C.walnut, d: 1 });
    lamp(wb, V3(0, yQ + 0.74, 5.5), { s: 0.7, glow: 1.8, frame: C.gold });
    wb.add(box(1.1, 0.34, 0.9), M(0, yQ + 0.17, 4.35), { color: C.honeyD, d: 1 });
    for (const s of [-1, 1]) wb.add(box(0.5, 0.05, 0.84), M(s * 0.28, yQ + 0.44, 4.35, 0, 0, s * 0.5), { color: lc(0x5a3c1c), e: 0.5, d: 0 });
    wb.add(box(0.06, 0.14, 0.9), M(0, yQ + 0.58, 4.35), { color: C.gold, metal: 1, d: 0 });
    for (const s of [-1, 1]) { const c = V3(s * 1.55, yQ, 7.4); barrel(wb, c.x, c.y, c.z, { wood: C.honeyD, r: 0.22, h: 0.55 }); }
    lantern(wb, V3(0, yRT + 0.12, zT(yRT) + 0.12), { s: 1.35, glow: 2.6, frame: C.gold });
    for (const s of [-1, 1]) lantern(wb, V3(s * (H.hb(yRT, 0) - 0.05), yRT + 0.1, zT(yRT) - 0.02), { s: 1.0, glow: 2.4, frame: C.gold });
  }
  rudder(wb, H, { wood: C.honeyD, bottom: C.bottom, iron: IRON });
  wb.mark('stern castle');
  // ---------------------------------------------------------------------------------------------- forecastle
  {
    const ub = 0.8, yF = 2.62, zb = H.zAt(ub, yF), w = H.hb(yF, ub) - 0.16;
    const gap = x => Math.abs(Math.abs(x) - (w - 0.5)) < 0.4;
    balustrade(wb, V3(-w, yF, zb - 0.06), V3(w, yF, zb - 0.06), { h: 0.78, wood: C.walnut, cap: C.gold, capMetal: 1, skip: p => gap(p.x), posts: 4 });
    for (const s of [-1, 1]) ladder(wb, V3(s * (w - 0.5), mainY(0.79), zb + 0.95), V3(s * (w - 0.5), yF, zb + 0.02), 0.56, { wood: C.walnut, step: C.honeyD });
    const zf = H.zAt(ub, 2.0) + 0.03, y0 = mainY(0.79);
    wb.add(box(0.7, 0.95, 0.05), M(0, y0 + 0.48, zf), { color: C.walnut, d: 1 });
    wb.add(box(0.84, 0.07, 0.08), M(0, y0 + 0.99, zf + 0.01), { color: C.gold, metal: 1, d: 0 });
    bell(wb, 0, yF + 0.0, zb - 0.35, { gold: C.gold, wood: C.walnut });
    capstan(wb, 0, yF, -6.25, { wood: C.walnut, bar: C.honeyD, bars: 1.05 });
    lantern(wb, V3(0, H.railY(1) + 0.08, H.zBow(H.railY(1)) + 0.55), { s: 0.9, glow: 2.4, frame: C.gold });
    for (const s of [-1, 1]) {
      const u = 0.9, f = H.frame(u, H.railY(u) - 0.1, s);
      const a = f.o.clone(), b = f.o.clone().addScaledVector(f.N, 0.7).add(V3(0, 0.1, -0.15));
      wb.add(box(0.2, 0.2, a.distanceTo(b)), MY(a, b).multiply(M(0, a.distanceTo(b) / 2, 0, Math.PI / 2)), { color: C.walnut, d: 0.8 });
      anchor(wb, b.x, b.y - 0.05, b.z, 0.72, { ry: s > 0 ? -0.4 : 0.4, rz: s * 0.15, stock: C.walnut });
    }
  }
  wb.mark('forecastle');
  // ---------------------------------------------------------------------------------------------- guns (lidless ports)
  const guns = { L: [], R: [] };
  let slot = 0;
  for (const side of [-1, 1]) for (const z of [-3.2, -1.8, -0.4, 1.0]) {
    const u = H.uAtZ(z, 2.0), y = mainY(u) + 0.47, xo = H.hb(y, u);
    gunport(wb, H, { z, y: y - 0.02, side, frame: C.gold, frameMetal: 1, lid: false });
    const muzzle = cannon(wb, { x: side * (xo - 0.72), y, z, slot, barrel: C.bronze, metal: 0.45, wood: C.walnut });
    (side < 0 ? guns.L : guns.R).push({ pos: muzzle, slot: slot++ });
  }
  wb.mark('guns');
  // ---------------------------------------------------------------------------------------------- masts
  const FORE = -4.0, MAIN = 1.1;
  const yFore = mainY(H.uAtZ(FORE, 1.6)), yMain = mainY(H.uAtZ(MAIN, 1.6));
  mast(wb, { z: FORE, y0: yFore - 0.3, y1: 10.0, r0: 0.26, r1: 0.2, color: C.mast, hoopColor: C.walnut });
  mast(wb, { z: FORE, y0: 9.1, y1: 13.1, r0: 0.16, r1: 0.1, color: C.mast, hoops: 1, hoopColor: C.walnut });
  mast(wb, { z: FORE, y0: 12.7, y1: 15.4, r0: 0.1, r1: 0.06, color: C.mast, hoops: 0 });
  mast(wb, { z: MAIN, y0: yMain - 0.3, y1: 11.0, r0: 0.3, r1: 0.22, color: C.mast, hoopColor: C.walnut });
  mast(wb, { z: MAIN, y0: 10.5, y1: 14.6, r0: 0.18, r1: 0.11, color: C.mast, hoops: 1, hoopColor: C.walnut });
  mast(wb, { z: MAIN, y0: 14.1, y1: 17.0, r0: 0.1, r1: 0.055, color: C.mast, hoops: 0 });
  for (const [z, y, r] of [[FORE, 15.4, 0.1], [MAIN, 17.0, 0.1]]) wb.add(sphere(r, 8, 6), M(0, y + 0.02, z), { uv: 'box', color: C.gold, metal: 1, d: 0 });
  for (const [z, y] of [[FORE, 10.0], [FORE, 13.1], [MAIN, 11.0], [MAIN, 14.6]]) wb.add(box(0.46, 0.17, 0.74), M(0, y, z + 0.14), { color: C.spar, d: 0.8 });
  platform(wb, { z: FORE + 0.15, y: 9.45, r: 0.85, color: C.honeyD, dark: C.walnut });
  platform(wb, { z: MAIN + 0.18, y: 10.3, r: 0.74, nest: true, h: 0.78, color: C.honeyD, wallColor: C.honey, dark: C.walnut, rim: C.gold, rimMetal: 1 });
  lamp(wb, V3(0, 10.9, MAIN - 0.68), { s: 0.8, glow: 2.2, frame: C.gold });
  pinRail(wb, 0, yFore, FORE + 0.1, 1.1, 0.9, C.walnut, C.rope);
  pinRail(wb, 0, yMain, MAIN + 0.1, 1.2, 1.0, C.walnut, C.rope);
  spar(wb, V3(0, 2.95, -7.2), V3(0, 5.35, -12.6), 0.22, 0.1, C.mast);
  wb.add(box(0.36, 0.3, 0.36), M(0, 4.93, -11.6, 0.38), { color: C.walnut, d: 0.8 });
  wb.mark('masts');
  // ---------------------------------------------------------------------------------------------- square sails
  const BR = 0.22;
  const yf = [
    yard(wb, { z: FORE, y: 8.75, w: 8.4, brace: BR, r: 0.14, color: C.spar, rope: C.rope, liftTo: V3(0, 9.9, FORE) }),
    yard(wb, { z: FORE, y: 11.95, w: 6.4, brace: BR, r: 0.1, color: C.spar, rope: C.rope, liftTo: V3(0, 13.0, FORE) }),
    yard(wb, { z: FORE, y: 14.3, w: 4.6, brace: BR, r: 0.075, color: C.spar, rope: C.rope, liftTo: V3(0, 15.3, FORE) }),
  ];
  const ym = [
    yard(wb, { z: MAIN, y: 13.9, w: 6.6, brace: BR, r: 0.1, color: C.spar, rope: C.rope, liftTo: V3(0, 14.5, MAIN) }),
    yard(wb, { z: MAIN, y: 16.2, w: 4.6, brace: BR, r: 0.075, color: C.spar, rope: C.rope, liftTo: V3(0, 16.9, MAIN) }),
  ];
  const sq = [
    squareSail(sb, { z: FORE, y: 8.7, Wt: 7.9, Wb: 8.3, H: 3.7, brace: BR, fwd: 0.38, depth: 1.35, region: R.fc }),
    squareSail(sb, { z: FORE, y: 11.9, Wt: 5.8, Wb: 7.6, H: 2.95, brace: BR, fwd: 0.34, tilt: 0.3, depth: 1.0, region: R.ft }),
    squareSail(sb, { z: FORE, y: 14.25, Wt: 4.2, Wb: 5.6, H: 2.15, brace: BR, fwd: 0.28, depth: 0.7, region: R.ftg }),
    squareSail(sb, { z: MAIN, y: 13.85, Wt: 5.8, Wb: 7.0, H: 2.7, brace: BR, fwd: 0.36, tilt: 0.5, depth: 0.95, region: R.mt }),
    squareSail(sb, { z: MAIN, y: 16.15, Wt: 4.0, Wb: 5.2, H: 1.95, brace: BR, fwd: 0.28, depth: 0.65, region: R.mtg }),
  ];
  const railPt = (z, side, dy = 0) => { const u = H.uAtZ(z, 2.4); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05 + dy, H.zAt(u, H.railY(u))); };
  sb.sheet(sq[0].corners.clewL, railPt(-1.3, -1), 0.03, ropeUV); sb.sheet(sq[0].corners.clewR, railPt(-1.7, 1), 0.03, ropeUV);
  sb.sheet(sq[1].corners.clewL, yf[0].a, 0.022, ropeUV); sb.sheet(sq[1].corners.clewR, yf[0].b, 0.022, ropeUV);
  sb.sheet(sq[2].corners.clewL, yf[1].a, 0.018, ropeUV); sb.sheet(sq[2].corners.clewR, yf[1].b, 0.018, ropeUV);
  sb.sheet(sq[3].corners.clewL, V3(-0.72, 11.05, MAIN + 0.1), 0.022, ropeUV); sb.sheet(sq[3].corners.clewR, V3(0.72, 11.05, MAIN + 0.1), 0.022, ropeUV);
  sb.sheet(sq[4].corners.clewL, ym[0].a, 0.018, ropeUV); sb.sheet(sq[4].corners.clewR, ym[0].b, 0.018, ropeUV);
  // ---------------------------------------------------------------------------------------------- gaff mainsail, staysail, jibs
  const gaff0 = V3(0, 9.8, MAIN + 0.3), gaff1 = V3(0, 11.9, 6.75), boom0 = V3(0, 5.2, MAIN + 0.3), boom1 = V3(0, 5.72, 7.05);
  spar(wb, gaff0, gaff1, 0.1, 0.065, C.spar);
  spar(wb, boom0, boom1, 0.13, 0.09, C.spar);
  wb.add(box(0.3, 0.3, 0.3), M(0, 9.8, MAIN + 0.3), { color: C.walnut, d: 0.8 });
  wb.add(box(0.3, 0.3, 0.3), M(0, 5.2, MAIN + 0.3), { color: C.walnut, d: 0.8 });
  const gs = foreAft(sb, { throat: V3(0, 9.7, MAIN + 0.45), peak: V3(0, 11.72, 6.5), tack: V3(0, 5.32, MAIN + 0.45), clew: V3(0, 5.84, 6.6), lee: -1, depth: 1.2, region: R.gaff, na: 12, nb: 11 });
  const tr = V3(0, yRT + 0.1, zT(yRT) - 0.35);
  wb.rope(boom1, tr, 0.025, C.rope, 0);
  for (const s of [-1, 1]) wb.rope(gaff1, V3(s * (H.hb(yRT, 0.04) - 0.1), yRT + 0.08, 7.6), 0.016, C.rope, 0.25, { radial: 3 });   // vangs
  wb.rope(gaff1, V3(0, 14.4, MAIN), 0.02, C.rope, 0.1, { radial: 3 });                                                           // peak halyard
  void gs;
  const st = foreAft(sb, { head: V3(0, 9.7, MAIN - 0.55), tack: V3(0, 4.0, FORE + 1.3), clew: V3(-0.3, 4.35, MAIN - 0.45), lee: -1, depth: 0.55, region: R.stay });
  sb.sheet(st.corners.clew, V3(-0.62, yMain + 0.65, MAIN - 0.35), 0.018, ropeUV);
  const j1 = foreAft(sb, { head: V3(0, 11.85, FORE - 0.25), tack: V3(0, 4.95, -11.75), clew: V3(-0.45, 4.4, -6.9), lee: -1, depth: 0.75, region: R.j1 });
  const j2 = foreAft(sb, { head: V3(0, 13.9, FORE - 0.2), tack: V3(0, 5.3, -12.55), clew: V3(-0.5, 6.3, -9.0), lee: -1, depth: 0.6, region: R.j2 });
  const fcRail = (z, side) => { const u = H.uAtZ(z, 3.4); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05, H.zAt(u, H.railY(u))); };
  sb.sheet(j1.corners.clew, fcRail(-5.7, -1), 0.02, ropeUV);
  sb.sheet(j2.corners.clew, fcRail(-6.5, -1), 0.02, ropeUV);
  // flags: truck pennants + ensign at the gaff peak
  flag(sb, { at: V3(0, 16.95, MAIN + 0.05), h: 0.55, len: 6.0, taper: 0.92, region: R.pen, phase: 0.1, n: 18 });
  flag(sb, { at: V3(0, 15.35, FORE + 0.05), h: 0.45, len: 4.4, taper: 0.9, region: R.pen2, phase: 0.55, n: 16 });
  flag(sb, { at: V3(0, 11.87, 6.77), h: 1.0, len: 1.6, region: R.ens, phase: 0.3, n: 12 });
  wb.mark('sails+yards');
  // ---------------------------------------------------------------------------------------------- rigging
  const chanY = u => H.railY(u) - 0.18;
  for (const side of [-1, 1]) {
    shrouds(wb, H, { side, z0: FORE - 0.55, z1: FORE + 0.35, zm: FORE, chan: chanY(H.uAtZ(FORE, 2.4)), mastTop: V3(0, 9.4, FORE), n: 3, rope: C.shroud, wood: C.walnut, r: 0.036 });
    shrouds(wb, H, { side, z0: MAIN + 0.35, z1: MAIN + 1.5, zm: MAIN, chan: chanY(H.uAtZ(MAIN, 2.4)), mastTop: V3(0, 10.25, MAIN), n: 3, rope: C.shroud, wood: C.walnut, r: 0.038 });
    shroudLines(wb, [V3(side * 0.8, 9.49, FORE + 0.05), V3(side * 0.78, 9.49, FORE + 0.45)], V3(0, 12.9, FORE), C.shroud, { r: 0.024 });
    shroudLines(wb, [V3(side * 0.72, 10.4, MAIN + 0.2), V3(side * 0.7, 10.4, MAIN + 0.55)], V3(0, 14.3, MAIN), C.shroud, { r: 0.026 });
    wb.rope(V3(0, 13.0, FORE), railPt(-2.4, side), 0.024, C.shroud, 0.05);
    wb.rope(V3(0, 15.2, FORE), railPt(-1.1, side), 0.02, C.shroud, 0.05);
    wb.rope(V3(0, 14.5, MAIN), V3(side * (H.hb(4.0, 0.22) - 0.05), 4.05, 4.7), 0.026, C.shroud, 0.05);
    wb.rope(V3(0, 16.8, MAIN), V3(side * (H.hb(4.0, 0.18) - 0.05), 4.05, 5.5), 0.02, C.shroud, 0.05);
  }
  wb.rope(V3(0, 9.45, FORE), V3(0, 4.35, -10.3), 0.045, C.shroud, 0.05);
  wb.rope(V3(0, 12.0, FORE), V3(0, 4.97, -11.8), 0.035, C.shroud, 0.02);
  wb.rope(V3(0, 14.05, FORE), V3(0, 5.32, -12.6), 0.028, C.shroud, 0.02);
  wb.rope(V3(0, 10.2, MAIN), V3(0, 3.15, FORE + 0.35), 0.042, C.shroud, 0.03);
  wb.rope(V3(0, 14.0, MAIN), V3(0, 9.5, FORE + 0.15), 0.03, C.shroud, 0.05);
  wb.rope(V3(0, 16.3, MAIN), V3(0, 13.1, FORE), 0.024, C.shroud, 0.04);
  wb.rope(V3(0, 5.1, -11.9), V3(0, 0.6, H.zBow(0.6) - 0.05), 0.035, IRON, 0, { metal: 0.3 });
  for (const [yd, to, sag] of [[yf[0], [MAIN - 0.3, 6.2], 0.35], [yf[1], [MAIN - 0.3, 10.0], 0.3], [yf[2], [MAIN - 0.2, 12.6], 0.25], [ym[0], null, 0.35], [ym[1], null, 0.3]]) {
    for (const [p, s] of [[yd.a, -1], [yd.b, 1]]) wb.rope(p, to ? V3(s * 0.25, to[1], to[0]) : railPt(yd === ym[0] ? 3.2 : 2.9, s, 0.9), 0.018, C.rope, sag, { radial: 3 });
  }
  wb.mark('rigging');
  // ---------------------------------------------------------------------------------------------- deck dressing
  const yM = u => mainY(u);
  boat(wb, 0, yM(0.64) + 0.05, -2.05, { L: 2.8, B: 1.12, wood: C.honey, inner: C.walnut });
  for (const s of [-1, 1]) for (const z of [-3.05, -1.05]) wb.add(box(0.12, 0.25, 0.12), M(s * 0.4, yM(H.uAtZ(z, 1.6)) + 0.12, z), { color: C.walnut });
  hatch(wb, 0, yM(0.5), -0.05, 1.0, 0.8, { wood: C.walnut });
  barrel(wb, -1.4, yM(0.72), -4.75, { wood: C.honeyD, r: 0.26, h: 0.66 });
  barrel(wb, -0.9, yM(0.72), -4.9, { wood: C.honeyD, r: 0.24, h: 0.6 });
  crate(wb, 1.3, yM(0.72), -4.75, 0.62, { ry: 0.2, wood: C.honey, dark: C.walnut });
  crate(wb, 1.32, yM(0.72) + 0.62, -4.72, 0.5, { ry: -0.15, wood: C.honey, dark: C.walnut });
  barrel(wb, 1.75, yM(0.32), 2.75, { wood: C.honeyD, r: 0.25, h: 0.64 });
  barrel(wb, 1.6, yM(0.32), 2.2, { wood: C.honeyD, r: 0.22, h: 0.58 });
  crate(wb, -1.7, yM(0.32), 2.6, 0.58, { ry: 0.3, wood: C.honey, dark: C.walnut });
  coil(wb, -0.75, yM(0.47), 0.4, 0.28, { color: C.coil });
  coil(wb, 0.7, yM(0.74), -3.55, 0.25, { color: C.coil });
  coil(wb, 0.95, yQ, 7.65, 0.3, { color: C.coil });
  coil(wb, -0.7, 2.62, -7.3, 0.28, { color: C.coil });
  wb.mark('deck');
  sunbird(wb, H);
  wb.mark('figurehead');
  // ---------------------------------------------------------------------------------------------- output
  return {
    wood: wb.build(), sails: sb.build(), foam: buildFoam(H), tex: atlas.texture(), report: wb.report(),
    sockets: {
      helm: [0, yQ, 6.85], wake: [0, 0, H.zStern(0) + 0.4],
      cannonsL: guns.L.map(g => g.pos.toArray()), cannonsR: guns.R.map(g => g.pos.toArray()),
      slotsL: guns.L.map(g => g.slot), slotsR: guns.R.map(g => g.slot),
    },
    look: { wood: { rim: 0.12 }, sail: { trans: 0.6 } },
    motion: { bob: 0.07, roll: 0.022, pitch: 0.012, period: 1 },
  };
}

/** Stem / cutwater along the bow profile + keel. */
function stem(wb, H, C) {
  const path = [];
  for (let i = 0; i <= 12; i++) {
    const y = lerp(-1.9, H.railY(1) + 0.2, i / 12), z = H.zBow(y), z2 = H.zBow(y + 0.05);
    const T = V3(0, 0.05, z2 - z).normalize(), A = V3(0, T.z, -T.y);
    if (A.z > 0) A.negate();
    path.push({ o: V3(0, y, z), A, B: V3(1, 0, 0) });
  }
  sweep(wb, path, [[-0.05, -0.1], [0.16, -0.07], [0.16, 0.07], [-0.05, 0.1]], { color: (p) => (p.y < -0.03 ? C.bottom : p.y < 0.13 ? C.boot : C.walnut), d: 0.6, closed: false });
  const kz0 = H.zStern(-1.9), kz1 = H.zBow(-1.9);
  wb.add(box(0.22, 0.3, kz0 - kz1), M(0, -1.9, (kz0 + kz1) / 2), { color: C.bottom, d: 0.6 });
}

// -------------------------------------------------------------------------------------------------- sunbird figurehead
function sunbird(wb, H) {
  const gold = C.gold, o = { metal: 1, d: 0 };
  const zs = H.zBow(2.6);
  // body + neck + head
  wb.tube([V3(0, 1.75, zs + 0.3), V3(0, 2.2, zs - 0.25), V3(0, 2.7, zs - 0.75), V3(0, 3.05, zs - 1.1)], [0.12, 0.3, 0.28, 0.17], gold, { ...o, radial: 10, caps: true });
  wb.tube([V3(0, 3.0, zs - 1.05), V3(0, 3.35, zs - 1.25), V3(0, 3.62, zs - 1.28), V3(0, 3.78, zs - 1.2)], [0.16, 0.12, 0.11, 0.1], gold, { ...o, radial: 8 });
  wb.add(sphere(0.17, 10, 8).scale(0.85, 0.85, 1.15), M(0, 3.84, zs - 1.3), { uv: 'box', color: gold, ...o });
  wb.add(cone(0.075, 0.42, 8), M(0, 3.8, zs - 1.43, -Math.PI / 2 - 0.25), { uv: 'box', color: gold, ...o });
  for (const s of [-1, 1]) wb.add(sphere(0.03, 5, 4), M(s * 0.11, 3.9, zs - 1.37), { uv: 'box', color: lc(0xff4020), e: 1.6, d: 0 });
  // crest of sun rays
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + i / 6 * 1.8, dir = V3(0, Math.cos(a) * 0.9, Math.sin(a) * 0.5 + 0.45).normalize();
    const p0 = V3(0, 3.92, zs - 1.2), p1 = p0.clone().addScaledVector(dir, 0.38 + (i % 2 ? 0 : 0.14));
    wb.add(cone(0.045, p0.distanceTo(p1), 5), MY(p0, p1), { uv: 'box', color: gold, ...o });
  }
  // wings: tapered feather blades lying on the bow planking, fanned from the shoulder
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    const t = k / 5, path = [];
    for (let i = 0; i <= 7; i++) {
      const q = i / 7;
      const u = lerp(0.985, lerp(0.915, 0.86, t), q), y = lerp(2.85 - t * 0.35, lerp(3.55, 1.85, t), q) + Math.sin(q * Math.PI) * 0.12;
      const f = H.frame(Math.min(0.995, u), y, s);
      path.push({ o: f.o.addScaledVector(f.N, 0.04 + 0.1 * (1 - q)), A: f.N, B: f.U });
    }
    sweep(wb, path, [[0, -0.1], [0.05, -0.07], [0.05, 0.07], [0, 0.1]], { color: gold, ...o, closed: false, scale: q => 1.15 - q * 0.95 });
  }
  // tail feathers down the stem
  for (let k = -1; k <= 1; k++) {
    wb.tube([V3(k * 0.08, 1.85, zs + 0.2), V3(k * 0.2, 1.2, H.zBow(1.2) - 0.08), V3(k * 0.28, 0.55, H.zBow(0.55) - 0.02)], [0.09, 0.06, 0.012], gold, { ...o, radial: 5 });
  }
  sunDisc(wb, M(0, 2.45, zs - 0.62, 0.35, Math.PI, 0), 0.34, gold, { rays: 12 });
}
