// MERCHANT CARRACK — a broad-beamed, round-sided trader: natural oak with a green and gold strake, heraldic shields
// along tall castles, a huge red-and-cream striped main course, a striped foresail and a spritsail under the bowsprit,
// deck heaped with crates, barrels, sacks and a tarpaulin stack, a cargo derrick swinging a netted load, two small guns
// a side, warm lanterns and a green guild flag with a gold coin.
import * as THREE from 'three';
import { linColor as lc } from '../../../engine/geom.js';
import { WoodBuilder, V3, M, MY, cyl, box, sphere, torus, lerp } from './build.js';
import { makeHull, buildHull, buildFoam, sweep, sidePath } from './hull.js';
import { SailBuilder, squareSail, flag } from './sails.js';
import { mast, spar, platform, shrouds } from './rig.js';
import { cannon, gunport, lantern, lamp, wheel, windowAt, balustrade, ladder, hatch, barrel, crate, sack, coil, bell, IRON } from './props.js';
import { shroudLines, yard, anchor, pinRail, rudder } from './common.js';
import { Atlas, cloth, rgb, hh } from './tex.js';

const C = {
  bottom: lc(0x6a5a44), boot: lc(0x2a2018), oak: lc(0x9a6a3c), oakD: lc(0x6a4424), oakL: lc(0xb88450), green: lc(0x2e6a48), gold: lc(0xd8b040),
  red: lc(0xa83020), cream: lc(0xefe2c4), deck: lc(0xc8a070), inner: lc(0x7a5230), cap: lc(0x4a2e18), mast: lc(0x9a6e40), spar: lc(0x6a4828),
  rope: lc(0x5a4228), shroud: lc(0x32261a), canvas: lc(0xb8a47a), tarpRope: lc(0x6a5030),
};
const OPEN3 = (h, o) => [[0, -h], [o, -h * 0.9], [o, h * 0.9], [0, h]];

export function buildMerchant() {
  const wb = new WoodBuilder(), sb = new SailBuilder(), atlas = new Atlas(1024);
  const striped = (n, seed, o = {}) => (g, w, h) => {
    cloth(g, w, h, { base: 0xefe2c4, panels: n, reefs: o.reefs ?? [0.18], seed });
    for (let i = 0; i < n; i++) if (i % 2 === (o.odd ? 1 : 0)) { g.fillStyle = rgb(o.col ?? 0xa83020, 0.92); g.fillRect(i / n * w, 0, w / n, h); }
    g.strokeStyle = rgb(0x3a2a18, 0.35); g.lineWidth = 2; for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i / n * w, 0); g.lineTo(i / n * w, h); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.08)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,30,10,0.18)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = rgb(0x6a5a40, 0.6); g.lineWidth = Math.max(2, w / 110); g.strokeRect(1, 1, w - 2, h - 2);
    if (o.coin) coin(g, w / 2, h * 0.48, h * o.coin);
  };
  const R = atlas.pack({
    mc: [512, 288, striped(9, 41, { coin: 0.2 })], fc: [352, 192, striped(7, 42)], mt: [320, 160, striped(7, 43, { odd: true })],
    sp: [288, 128, (g, w, h) => { cloth(g, w, h, { base: 0xefe2c4, panels: 6, seed: 44 }); g.fillStyle = rgb(0xa83020, 0.9); g.fillRect(0, h * 0.72, w, h * 0.12); }],
    flag: [192, 128, (g, w, h) => { g.fillStyle = rgb(0x2e6a48); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0xd8b040); g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7); coin(g, w * 0.45, h / 2, h * 0.28); }],
    pen: [384, 36, (g, w, h) => { g.fillStyle = rgb(0xd8b040); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0x2e6a48); g.fillRect(0, h * 0.34, w, h * 0.32); }],
    pen2: [320, 32, (g, w, h) => { g.fillStyle = rgb(0xa83020); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0xefe2c4); g.fillRect(0, h * 0.36, w, h * 0.28); }],
    rope: [12, 12, (g) => { g.fillStyle = rgb(0x5a4228); g.fillRect(-2, -2, 16, 16); }],
  });
  const ropeUV = R.rope.uv(0.5, 0.5);
  // ---------------------------------------------------------------------------------------------- hull
  const mainY = u => 1.75 + 0.3 * Math.pow(Math.max(0, (0.5 - u) / 0.5), 2) + 0.45 * Math.pow(Math.max(0, (u - 0.5) / 0.5), 2);
  const H = makeHull({
    L: 15.6, B: 6.3, keel: -1.6, yw: 1.0, bilge: 2.9, tumble: 0.12, maxU: 0.5,
    bowFull: [2.2, 3.4], bowRake: 1.5, bowCurve: 2.4, sternFull: 2.6, transom: 0.72, knuckle: 1.3, transomDrop: 1.1,
    sternRake: 0.9, transomRake: 0.08,
    decks: [{ u0: 0, u1: 0.25, y: 3.25 }, { u0: 0.25, u1: 0.8, y: mainY }, { u0: 0.8, u1: 1, y: 3.05 }],
    bulwark: 1.0, railBlend: 0.05, thick: 0.15, camber: 0.08,
  });
  const sheer = u => mainY(Math.min(1, Math.max(0, u)));
  const hullPaint = (x, y, z, u) => {
    if (y < -0.03) return C.bottom;
    if (y < 0.12) return C.boot;
    const top = H.railY(u);
    if (y > top - 0.55 && y < top - 0.12) return C.green;
    return Math.floor((y + 3) / 0.21) % 2 ? C.oak : C.oakL;     // lapped strakes
  };
  buildHull(wb, H, { hull: hullPaint, deck: C.deck, inner: C.inner, cap: C.cap, bulkhead: C.oakD, transom: (x, y) => (y < -0.03 ? C.bottom : y < 0.12 ? C.boot : y > 3.35 ? C.green : C.oak) });
  for (const side of [-1, 1]) {
    sweep(wb, sidePath(H, 0.004, 0.99, u => H.railY(u) - 0.1, side, 56), OPEN3(0.035, 0.035), { color: C.gold, metal: 0.6, d: 0, closed: false });
    sweep(wb, sidePath(H, 0.006, 0.985, u => H.railY(u) - 0.58, side, 56), OPEN3(0.035, 0.035), { color: C.gold, metal: 0.6, d: 0, closed: false });
    sweep(wb, sidePath(H, 0.004, 0.99, u => sheer(u) - 0.75, side, 44), OPEN3(0.1, 0.075), { color: C.oakD, d: 0.8, closed: false });
    sweep(wb, sidePath(H, 0.008, 0.98, u => sheer(u) - 1.35, side, 44), OPEN3(0.08, 0.06), { color: C.oakD, d: 0.8, closed: false });
    // heraldic shields along the castles
    for (const [u0, u1, n] of [[0.03, 0.23, 4], [0.83, 0.95, 3]]) for (let i = 0; i < n; i++) {
      const u = lerp(u0, u1, n === 1 ? 0.5 : i / (n - 1)), y = H.railY(u) - 0.33, f = H.frame(u, y, side);
      const m = new THREE.Matrix4().makeBasis(f.X, f.N, f.U.clone().negate()).setPosition(f.o);
      const a = (i + (side > 0 ? 1 : 0)) % 2;
      wb.add(cyl(0.22, 0.22, 0.05, 12), m, { uv: 'box', color: a ? C.red : C.cream, d: 0.2 });
      wb.add(box(0.07, 0.06, 0.4), m.clone().multiply(M(0, 0.05, 0)), { color: a ? C.cream : C.green, d: 0 });
      wb.add(torus(0.22, 0.025, 4, 12), m.clone().multiply(M(0, 0.04, 0, Math.PI / 2)), { uv: 'box', color: C.gold, metal: 0.8, d: 0 });
    }
  }
  stem(wb, H);
  wb.mark('hull');
  // ---------------------------------------------------------------------------------------------- aftcastle
  const yA = 3.25, yRT = H.railY(0), zT = y => H.zStern(y);
  {
    const span = H.hb(2.55, 0) * 1.2;
    for (let i = 0; i < 3; i++) windowAt(wb, M(lerp(-span / 2, span / 2, i / 2), 2.55, zT(2.55) + 0.05, -0.08), 0.44, 0.55, { frame: C.gold, glass: lc(0xc07a38), glow: 1.6, mullion: C.cap, metal: 0.6 });
    for (const side of [-1, 1]) for (const u of [0.08, 0.17]) windowAt(wb, H.mat(u, 2.55, side, 0.03), 0.36, 0.46, { frame: C.gold, glass: lc(0xc07a38), glow: 1.4, mullion: C.cap, metal: 0.6 });
    wb.add(box(H.hb(3.0, 0) * 1.9, 0.1, 0.08), M(0, 3.05, zT(3.05) + 0.05, -0.08), { color: C.gold, metal: 0.6, d: 0 });
    const zb = H.zAt(0.25, yA), w = H.hb(yA, 0.25) - 0.17;
    balustrade(wb, V3(-w, yA, zb + 0.05), V3(w, yA, zb + 0.05), { h: 0.85, wood: C.oakD, cap: C.cap, skip: p => Math.abs(p.x) < 0.42, posts: 4 });
    ladder(wb, V3(0, mainY(0.27), zb - 1.1), V3(0, yA, zb - 0.02), 0.72, { wood: C.oakD });
    const y0 = mainY(0.26), zf = H.zAt(0.25, 2.4) - 0.03;
    for (const x of [-1.5, 1.5]) { wb.add(box(0.74, 1.2, 0.05), M(x, y0 + 0.6, zf), { color: C.oakD, d: 1 }); wb.add(box(0.86, 0.08, 0.08), M(x, y0 + 1.24, zf - 0.01), { color: C.gold, metal: 0.6, d: 0 }); }
    for (const x of [-2.3, 2.3]) lamp(wb, V3(x, y0 + 1.1, zf - 0.3), { s: 0.9, glow: 2.4, frame: C.cap, hang: V3(x, y0 + 1.55, zf - 0.3) });
    wheel(wb, V3(0, yA + 1.0, 5.75), yA, { wood: C.oakD, gold: C.gold });
    for (const s of [-1, 1]) lantern(wb, V3(s * (H.hb(yRT, 0) - 0.08), yRT + 0.08, zT(yRT) - 0.05), { s: 1.0, glow: 2.4, frame: C.cap, metal: 0.2 });
    // chests & cargo on the aftcastle
    for (const [x, z, ry] of [[-1.7, 6.6, 0.2], [1.75, 6.4, -0.3]]) {
      const m = M(x, yA, z, 0, ry);
      wb.add(box(0.8, 0.45, 0.5), m.clone().multiply(M(0, 0.225, 0)), { color: lc(0x6a3a1c), d: 1 });
      wb.add(box(0.82, 0.08, 0.52), m.clone().multiply(M(0, 0.46, 0)), { color: C.oakD, d: 1 });
      for (const xx of [-0.3, 0.3]) wb.add(box(0.05, 0.5, 0.54), m.clone().multiply(M(xx, 0.25, 0)), { color: IRON, metal: 0.3, d: 0 });
    }
    barrel(wb, -1.9, yA, 4.4, { wood: C.oakD, r: 0.24, h: 0.6 }); barrel(wb, 1.95, yA, 4.5, { wood: C.oakD, r: 0.24, h: 0.6 });
  }
  rudder(wb, H, { wood: C.oakD, bottom: C.bottom, iron: IRON, w0: 0.85, w1: 0.45 });
  wb.mark('aftcastle');
  // ---------------------------------------------------------------------------------------------- forecastle
  {
    const ub = 0.8, yF = 3.05, zb = H.zAt(ub, yF), w = H.hb(yF, ub) - 0.17;
    balustrade(wb, V3(-w, yF, zb - 0.05), V3(w, yF, zb - 0.05), { h: 0.85, wood: C.oakD, cap: C.cap, skip: p => Math.abs(Math.abs(p.x) - (w - 0.55)) < 0.42, posts: 4 });
    for (const s of [-1, 1]) ladder(wb, V3(s * (w - 0.55), mainY(0.79), zb + 1.05), V3(s * (w - 0.55), yF, zb + 0.02), 0.6, { wood: C.oakD });
    const zf = H.zAt(ub, 2.3) + 0.03, y0 = mainY(0.79);
    wb.add(box(0.74, 1.05, 0.05), M(0, y0 + 0.53, zf), { color: C.oakD, d: 1 });
    bell(wb, 0.9, yF, zb - 0.5, { gold: C.gold, wood: C.oakD });
    lantern(wb, V3(0, H.railY(1) + 0.06, H.zBow(H.railY(1)) + 0.5), { s: 0.9, glow: 2.4, frame: C.cap, metal: 0.2 });
    for (const s of [-1, 1]) {
      const f = H.frame(0.88, H.railY(0.88) - 0.1, s), b = f.o.clone().addScaledVector(f.N, 0.7).add(V3(0, 0.1, -0.15));
      wb.add(box(0.2, 0.2, 0.7), MY(f.o, b).multiply(M(0, 0.35, 0, Math.PI / 2)), { color: C.oakD, d: 0.8 });
      anchor(wb, b.x, b.y - 0.05, b.z, 0.7, { ry: s > 0 ? -0.4 : 0.4, rz: s * 0.15, stock: C.oakD });
    }
    coil(wb, -0.9, yF, -5.6, 0.3, { color: lc(0xa8844e) });
    // gilded fiddlehead scroll at the stem head
    const zs = H.zBow(2.9), pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, a = t * Math.PI * 1.8; pts.push(V3(0, 2.9 + Math.sin(a) * 0.35 * (1 - t * 0.6) + t * 0.3, zs - 0.15 - Math.cos(a) * 0.35 * (1 - t * 0.6) - t * 0.6)); }
    wb.tube(pts, pts.map((_, i) => 0.13 * (1 - i / 14)), C.gold, { metal: 1, d: 0, radial: 6 });
  }
  wb.mark('forecastle');
  // ---------------------------------------------------------------------------------------------- guns (two a side)
  const guns = { L: [], R: [] };
  let slot = 0;
  for (const side of [-1, 1]) for (const z of [-2.6, 2.0]) {
    const u = H.uAtZ(z, 2.2), y = mainY(u) + 0.45, xo = H.hb(y, u);
    gunport(wb, H, { z, y: y - 0.02, side, frame: C.gold, frameMetal: 0.6, lidColor: C.green, lidInner: C.red, w: 0.44, h: 0.4 });
    const muzzle = cannon(wb, { x: side * (xo - 0.62), y, z, slot, barrel: lc(0x2a2622), metal: 0.3, wood: C.oakD, scale: 0.82 });
    (side < 0 ? guns.L : guns.R).push({ pos: muzzle, slot: slot++ });
  }
  wb.mark('guns');
  // ---------------------------------------------------------------------------------------------- masts
  const FORE = -4.95, MAIN = 0.2, MIZ = 4.3;
  const yMain = mainY(H.uAtZ(MAIN, 1.8));
  mast(wb, { z: FORE, y0: 2.8, y1: 9.6, r0: 0.22, r1: 0.16, color: C.mast, hoopColor: C.oakD });
  mast(wb, { z: MAIN, y0: yMain - 0.3, y1: 12.4, r0: 0.34, r1: 0.25, color: C.mast, hoopColor: C.oakD });
  mast(wb, { z: MAIN, y0: 11.6, y1: 15.4, r0: 0.17, r1: 0.1, color: C.mast, hoops: 1, hoopColor: C.oakD });
  mast(wb, { z: MIZ, y0: yA - 0.2, y1: 8.4, r0: 0.17, r1: 0.11, color: C.mast, hoopColor: C.oakD });
  for (const [z, y, r] of [[FORE, 9.6, 0.12], [MAIN, 15.4, 0.1], [MIZ, 8.4, 0.1]]) wb.add(sphere(r, 8, 6), M(0, y + 0.02, z), { uv: 'box', color: C.gold, metal: 1, d: 0 });
  // round "castle" top on the main (carrack style) + small fore top
  platform(wb, { z: MAIN + 0.16, y: 11.55, r: 0.95, nest: true, h: 0.7, color: C.oakD, wallColor: C.green, dark: C.cap, rim: C.gold, rimMetal: 0.7 });
  platform(wb, { z: FORE + 0.1, y: 8.9, r: 0.6, color: C.oakD, dark: C.cap });
  pinRail(wb, 0, yMain, MAIN + 0.2, 1.4, 1.1, C.oakD, C.rope);
  // furled lateen on the mizzen (yard + bundled cloth)
  const l0 = V3(0.2, 5.3, 2.5), l1 = V3(0.2, 9.4, 7.6);
  spar(wb, l0, l1, 0.08, 0.05, C.spar, true);
  wb.tube([l0.clone().add(V3(0, -0.12, 0.2)), V3().lerpVectors(l0, l1, 0.5).add(V3(0, -0.2, 0)), l1.clone().add(V3(0, -0.12, -0.3))], [0.08, 0.17, 0.06], C.cream, { radial: 6, d: 0.2 });
  // bowsprit
  spar(wb, V3(0, 3.4, -6.8), V3(0, 5.5, -11.8), 0.2, 0.1, C.mast);
  wb.mark('masts');
  // ---------------------------------------------------------------------------------------------- sails
  const BR = 0.42;
  const ym = [
    yard(wb, { z: MAIN, y: 10.7, w: 10.8, brace: BR, r: 0.16, color: C.spar, rope: C.rope, liftTo: V3(0, 12.2, MAIN) }),
    yard(wb, { z: MAIN, y: 14.2, w: 6.4, brace: BR, r: 0.1, color: C.spar, rope: C.rope, liftTo: V3(0, 15.2, MAIN) }),
  ];
  const yf = yard(wb, { z: FORE, y: 8.55, w: 7.0, brace: BR, r: 0.12, color: C.spar, rope: C.rope, liftTo: V3(0, 9.5, FORE) });
  yard(wb, { z: -10.3, y: 4.72, w: 5.4, brace: 0, r: 0.09, color: C.spar, fwd: -0.15 });
  const sq = [
    squareSail(sb, { z: MAIN, y: 10.65, Wt: 10.2, Wb: 10.6, H: 5.5, brace: BR, fwd: 0.44, depth: 1.8, region: R.mc, na: 14, nb: 11 }),
    squareSail(sb, { z: MAIN, y: 14.15, Wt: 5.6, Wb: 7.2, H: 2.5, brace: BR, fwd: 0.34, tilt: 0.6, depth: 0.9, region: R.mt }),
    squareSail(sb, { z: FORE, y: 8.5, Wt: 6.4, Wb: 6.8, H: 3.3, brace: BR, fwd: 0.34, depth: 1.1, region: R.fc }),
    squareSail(sb, { z: -10.3, y: 4.6, Wt: 5.0, Wb: 5.2, H: 2.1, brace: 0, fwd: -0.1, depth: 0.7, region: R.sp }),
  ];
  const railPt = (z, side) => { const u = H.uAtZ(z, 2.6); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05, H.zAt(u, H.railY(u))); };
  sb.sheet(sq[0].corners.clewL, railPt(3.2, -1), 0.035, ropeUV); sb.sheet(sq[0].corners.clewR, railPt(2.8, 1), 0.035, ropeUV);
  sb.sheet(sq[1].corners.clewL, V3(-0.9, 12.2, MAIN + 0.1), 0.022, ropeUV); sb.sheet(sq[1].corners.clewR, V3(0.9, 12.2, MAIN + 0.1), 0.022, ropeUV);
  sb.sheet(sq[2].corners.clewL, railPt(-3.4, -1), 0.028, ropeUV); sb.sheet(sq[2].corners.clewR, railPt(-3.8, 1), 0.028, ropeUV);
  flag(sb, { at: V3(0, 8.35, MIZ + 0.03), h: 0.95, len: 1.45, region: R.flag, phase: 0.3, n: 12 });
  flag(sb, { at: V3(0, 15.35, MAIN + 0.03), h: 0.45, len: 4.6, taper: 0.9, region: R.pen, phase: 0.1, n: 16 });
  flag(sb, { at: V3(0, 9.55, FORE + 0.03), h: 0.38, len: 3.2, taper: 0.9, region: R.pen2, phase: 0.6, n: 12 });
  wb.mark('sails+yards');
  // ---------------------------------------------------------------------------------------------- rigging
  const chanY = u => H.railY(u) - 0.2;
  for (const side of [-1, 1]) {
    shrouds(wb, H, { side, z0: MAIN + 0.3, z1: MAIN + 1.7, zm: MAIN, chan: chanY(H.uAtZ(MAIN, 2.8)), mastTop: V3(0, 11.45, MAIN), n: 4, rope: C.shroud, wood: C.oakD, r: 0.04 });
    shrouds(wb, H, { side, z0: FORE + 0.1, z1: FORE + 0.8, zm: FORE, chan: chanY(H.uAtZ(FORE, 3.6)), mastTop: V3(0, 8.8, FORE), n: 2, rope: C.shroud, wood: C.oakD, r: 0.032, out: 0.24 });
    shrouds(wb, H, { side, z0: MIZ + 0.1, z1: MIZ + 0.8, zm: MIZ, chan: chanY(H.uAtZ(MIZ, 4.0)), mastTop: V3(0, 7.9, MIZ), n: 2, rope: C.shroud, wood: C.oakD, r: 0.03, out: 0.24 });
    shroudLines(wb, [V3(side * 0.92, 11.6, MAIN + 0.2), V3(side * 0.9, 11.6, MAIN + 0.6)], V3(0, 15.0, MAIN), C.shroud, { r: 0.026 });
    wb.rope(V3(0, 15.1, MAIN), V3(side * (H.hb(4.2, 0.2) - 0.05), 4.25, 4.9), 0.026, C.shroud, 0.06);
  }
  wb.rope(V3(0, 11.5, MAIN), V3(0, 3.6, FORE + 0.3), 0.05, C.shroud, 0.06);
  wb.rope(V3(0, 15.0, MAIN), V3(0, 9.2, FORE), 0.03, C.shroud, 0.06);
  wb.rope(V3(0, 9.0, FORE), V3(0, 5.2, -11.4), 0.04, C.shroud, 0.05);
  wb.rope(V3(0, 8.0, MIZ), V3(0, 6.0, MAIN + 0.3), 0.03, C.shroud, 0.06);
  wb.rope(V3(0, 5.3, -11.6), V3(0, 0.7, H.zBow(0.7) - 0.05), 0.035, IRON, 0, { metal: 0.3 });
  for (const [yd, to, sag] of [[ym[0], null, 0.4], [ym[1], [MIZ, 7.6], 0.3], [yf, [MAIN - 0.35, 7.2], 0.35]]) {
    for (const [p, s] of [[yd.a, -1], [yd.b, 1]]) wb.rope(p, to ? V3(s * 0.22, to[1], to[0]) : railPt(5.8, s), 0.02, C.rope, sag, { radial: 3 });
  }
  wb.mark('rigging');
  // ---------------------------------------------------------------------------------------------- cargo derrick with a swinging netted load
  {
    const yd = mainY(H.uAtZ(2.9, 1.8)), base = V3(0.45, yd, 2.95), top = V3(0.45, yd + 3.4, 2.95), tip = V3(4.1, yd + 5.2, 2.6);
    wb.add(cyl(0.17, 0.14, 3.5, 10), M(base.x, base.y, base.z), { uv: 'keep', color: C.oakD, d: 0.8 });
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) wb.add(box(0.1, 0.4, 0.5), M(base.x + Math.cos(a) * 0.2, base.y + 0.2, base.z + Math.sin(a) * 0.2, 0, -a), { color: C.oakD, d: 0.8 });
    spar(wb, V3(base.x, base.y + 1.2, base.z), tip, 0.13, 0.08, C.spar);
    wb.rope(top, tip, 0.028, C.rope, 0);
    wb.add(sphere(0.14, 8, 6), M(tip.x, tip.y - 0.1, tip.z), { uv: 'box', color: C.oakD, d: 0.4 });
    const loadTop = V3(tip.x, tip.y - 2.0, tip.z), piv = [tip.x, tip.y - 0.1, tip.z], an = { anim: -3, piv };
    wb.rope(V3(tip.x, tip.y - 0.2, tip.z), loadTop, 0.022, C.rope, 0, { ...an, radial: 3 });
    for (const [dx, dz, s] of [[-0.25, -0.2, 0.55], [0.27, 0.15, 0.5], [0.0, 0.0, 0.45]]) {
      const cy = loadTop.y - 1.25 + (s === 0.45 ? 0.52 : 0);
      wb.add(box(s, s, s), M(loadTop.x + dx, cy + s / 2, loadTop.z + dz, 0, dx * 2), { color: C.oakL, d: 1, ...an });
    }
    // net: ropes from the hook fanned over the bundle
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, r = 0.55;
      const p0 = loadTop.clone(), p1 = V3(loadTop.x + Math.cos(a) * r, loadTop.y - 0.75, loadTop.z + Math.sin(a) * r), p2 = V3(loadTop.x + Math.cos(a) * r * 0.7, loadTop.y - 1.3, loadTop.z + Math.sin(a) * r * 0.7);
      wb.tube([p0, p1, p2], 0.018, C.rope, { radial: 3, d: 0.3, ...an });
    }
    for (const yy of [-0.8, -1.1]) wb.add(torus(0.58, 0.018, 3, 12), M(loadTop.x, loadTop.y + yy, loadTop.z, Math.PI / 2), { uv: 'box', color: C.rope, d: 0.3, ...an });
    wb.add(torus(0.06, 0.015, 3, 8, Math.PI * 1.4), M(loadTop.x, loadTop.y - 0.02, loadTop.z), { uv: 'box', color: IRON, metal: 0.3, d: 0, ...an });
  }
  wb.mark('crane');
  // ---------------------------------------------------------------------------------------------- deck cargo
  const yM = u => mainY(u), yAt = z => yM(H.uAtZ(z, 1.8));
  // tarpaulin heap amidships
  {
    const g = sphere(1, 12, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.12 * Math.sin(x * 7) * Math.cos(z * 6) + (Math.abs(x) > 0.6 ? -0.08 : 0);
      p.setXYZ(i, x * 1.0 * k, Math.max(y, -0.2) * 0.75 * k, z * 1.3 * k);
    }
    g.computeVertexNormals();
    const z = -2.3, y = yAt(z);
    wb.add(g, M(0, y + 0.15, z), { uv: 'box', color: C.canvas, d: 0.6 });
    for (const t of [-0.8, 0, 0.8]) wb.add(torus(1.0, 0.025, 3, 16, Math.PI), M(0, y + 0.1, z + t, 0, Math.PI / 2, 0).multiply(M(0, 0, 0, 0, 0, 0, [1.02, 0.78, 1])), { uv: 'box', color: C.tarpRope, d: 0.2 });
  }
  const stacks = [[-1.9, -3.9, 2], [1.85, -3.7, 3], [-1.95, 0.9, 2], [1.95, -0.6, 1], [-1.6, 3.2, 1]];
  for (const [x, z, n] of stacks) {
    let y = yAt(z);
    for (let k = 0; k < n; k++) {
      const s = 0.62 - k * 0.07;
      crate(wb, x + (hh(k, Math.round(z * 10), 1) - 0.5) * 0.12, y, z, s, { ry: (hh(k, Math.round(z * 10), 2) - 0.5) * 0.5, wood: k % 2 ? C.oakL : lc(0xa87a44), dark: C.oakD, mark: k === 0 ? (x > 0 ? C.red : C.green) : null });
      y += s;
    }
  }
  for (const [x, z] of [[-1.35, -4.3], [-1.25, -3.45], [1.4, 1.3], [1.8, 1.9], [-0.9, 1.6]]) barrel(wb, x, yAt(z), z, { wood: lc(0x8a5a30), r: 0.26, h: 0.68 });
  for (let i = 0; i < 3; i++) barrel(wb, 1.25 + i * 0.02, yAt(3.3), 2.7 + i * 0.55 - 0.55, { wood: lc(0x8a5a30), r: 0.25, lie: true, ry: Math.PI / 2 });
  for (const [x, z, ry] of [[0.95, -4.5, 0.3], [1.3, -4.25, -0.4], [1.05, -4.1, 1.2], [-0.4, 2.3, 0.2], [-0.1, 2.5, -0.7]]) sack(wb, x, yAt(z), z, { ry, color: lc(0xc8b088) });
  hatch(wb, 0, yAt(1.35), 1.35, 1.2, 0.9, { wood: C.oakD });
  coil(wb, 0.95, yAt(-1.0), -1.0, 0.28, { color: lc(0xa8844e) });
  wb.mark('cargo');
  return {
    wood: wb.build(), sails: sb.build(), foam: buildFoam(H, { width: u => 0.7 + 1.2 * (u > 0.75 ? (u - 0.75) * 4 : 0) + 0.5 * (u < 0.2 ? (0.2 - u) * 5 : 0) }), tex: atlas.texture(), report: wb.report(),
    sockets: {
      helm: [0, yA, 6.35], wake: [0, 0, H.zStern(0) + 0.4],
      cannonsL: guns.L.map(g => g.pos.toArray()), cannonsR: guns.R.map(g => g.pos.toArray()),
      slotsL: guns.L.map(g => g.slot), slotsR: guns.R.map(g => g.slot),
    },
    look: { wood: { rim: 0.12 }, sail: { trans: 0.6 } },
    motion: { bob: 0.06, roll: 0.03, pitch: 0.01, period: 0.85 },
  };
}

function stem(wb, H) {
  const path = [];
  for (let i = 0; i <= 12; i++) {
    const y = lerp(-1.6, H.railY(1) + 0.15, i / 12), z = H.zBow(y), z2 = H.zBow(y + 0.05);
    const T = V3(0, 0.05, z2 - z).normalize(), A = V3(0, T.z, -T.y);
    if (A.z > 0) A.negate();
    path.push({ o: V3(0, y, z), A, B: V3(1, 0, 0) });
  }
  sweep(wb, path, [[-0.05, -0.11], [0.15, -0.08], [0.15, 0.08], [-0.05, 0.11]], { color: (p) => (p.y < -0.03 ? C.bottom : p.y < 0.12 ? C.boot : C.oakD), d: 0.6, closed: false });
  const kz0 = H.zStern(-1.6), kz1 = H.zBow(-1.6);
  wb.add(box(0.22, 0.3, kz0 - kz1), M(0, -1.6, (kz0 + kz1) / 2), { color: C.bottom, d: 0.6 });
}

/** Canvas: guild coin — gold disc with a square hole and a balance-scale mark. */
function coin(g, cx, cy, r) {
  g.save(); g.translate(cx, cy);
  g.fillStyle = rgb(0xd8b040); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgb(0x8a6a1c); g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, 0, r * 0.86, 0, Math.PI * 2); g.stroke();
  g.fillStyle = rgb(0x2e6a48); g.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4);
  g.strokeStyle = rgb(0x8a6a1c); g.lineWidth = r * 0.07;
  g.beginPath(); g.moveTo(-r * 0.58, -r * 0.42); g.lineTo(r * 0.58, -r * 0.42); g.moveTo(0, -r * 0.62); g.lineTo(0, -r * 0.24); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.58, -r * 0.42); g.lineTo(s * r * 0.44, -r * 0.08); g.lineTo(s * r * 0.72, -r * 0.08); g.closePath(); g.stroke(); }
  g.restore();
}
