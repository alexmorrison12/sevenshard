// PIRATE BRIG — low, dark and fast: tar-black hull with blood-red wales, a spiked iron ram, a horned-skull
// figurehead, black square sails patched in red and torn at the foot, the "Horned Grin" emblem (a horned skull over
// crossed jagged sabres in a sawtooth ring), red lanterns, iron guns behind red port lids (5 a side).
import * as THREE from 'three';
import { linColor as lc } from '../../../engine/geom.js';
import { WoodBuilder, V3, M, MY, cyl, box, sphere, cone, lathe, torus, lerp } from './build.js';
import { makeHull, buildHull, buildFoam, sweep, sidePath } from './hull.js';
import { SailBuilder, squareSail, foreAft, flag } from './sails.js';
import { mast, spar, platform, shrouds } from './rig.js';
import { cannon, gunport, lantern, lamp, wheel, windowAt, balustrade, ladder, hatch, barrel, crate, coil, IRON } from './props.js';
import { shroudLines, yard, anchor, pinRail, rudder, chain, spikes, shotPile, skull } from './common.js';
import { Atlas, cloth, tatter, patch, rgb, hh } from './tex.js';

const C = {
  bottom: lc(0x2a1412), boot: lc(0x0e0b0a), hull: lc(0x2a2320), hullD: lc(0x1a1614), red: lc(0x7a1812), redD: lc(0x4a0e0a),
  deck: lc(0x7a6246), inner: lc(0x5a120e), cap: lc(0x14100e), bone: lc(0xd8ccb0), brass: lc(0x8a6a3a),
  mast: lc(0x4a3a2a), spar: lc(0x2e241c), rope: lc(0x2a2018), shroud: lc(0x161210), iron: lc(0x1a1818), glow: lc(0xff4a1a),
};
const OPEN3 = (h, o) => [[0, -h], [o, -h * 0.9], [o, h * 0.9], [0, h]];

/** Canvas: the Horned Grin — horned skull over crossed jagged sabres inside a sawtooth ring. */
export function paintHornedGrin(g, cx, cy, r, o = {}) {
  const bone = o.bone ?? 0xe6dcc2, red = o.red ?? 0xb3161a, dark = o.dark ?? 0x121012;
  g.save(); g.translate(cx, cy);
  // sawtooth ring
  g.fillStyle = rgb(red);
  g.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = i % 2 ? r * 1.02 : r * 1.16; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.fillStyle = rgb(dark); g.beginPath(); g.arc(0, 0, r * 0.94, 0, Math.PI * 2); g.fill();
  // crossed jagged sabres
  for (const s of [-1, 1]) {
    g.save(); g.rotate(s * 0.72);
    g.fillStyle = rgb(bone, 0.95);
    g.beginPath(); g.moveTo(-r * 0.05, r * 0.85); g.quadraticCurveTo(r * 0.22, 0, r * 0.02, -r * 0.92); g.lineTo(-r * 0.1, -r * 0.6);
    for (let k = 0; k < 6; k++) { const y = -r * 0.6 + k * r * 0.24; g.lineTo(-r * (0.1 + (k % 2) * 0.06), y); }
    g.closePath(); g.fill();
    g.fillStyle = rgb(red); g.fillRect(-r * 0.2, r * 0.62, r * 0.4, r * 0.07);        // guard
    g.fillStyle = rgb(0x3a2a20); g.fillRect(-r * 0.05, r * 0.69, r * 0.1, r * 0.22);  // grip
    g.restore();
  }
  // horns
  g.strokeStyle = rgb(bone); g.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let k = 0; k < 10; k++) {
      const t = k / 9;
      g.lineWidth = r * (0.2 - t * 0.16);
      const a0 = t * Math.PI * 1.1, a1 = (t + 0.1) * Math.PI * 1.1;
      g.beginPath();
      g.moveTo(s * (r * 0.3 + Math.sin(a0) * r * 0.42), -r * 0.3 - Math.cos(a0) * r * 0.32);
      g.lineTo(s * (r * 0.3 + Math.sin(a1) * r * 0.42), -r * 0.3 - Math.cos(a1) * r * 0.32);
      g.stroke();
    }
  }
  // skull
  g.fillStyle = rgb(bone);
  g.beginPath(); g.ellipse(0, -r * 0.12, r * 0.42, r * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.roundRect(-r * 0.27, r * 0.08, r * 0.54, r * 0.34, r * 0.08); g.fill();
  g.fillStyle = rgb(dark);
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.16, -r * 0.08, r * 0.12, r * 0.1, s * 0.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = rgb(red); g.beginPath(); g.arc(r * 0.16, -r * 0.07, r * 0.045, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgb(dark); g.beginPath(); g.moveTo(0, r * 0.03); g.lineTo(-r * 0.05, r * 0.14); g.lineTo(r * 0.05, r * 0.14); g.closePath(); g.fill();
  for (let i = -2; i <= 2; i++) g.fillRect(i * r * 0.09 - r * 0.012, r * 0.24, r * 0.024, r * 0.14);
  g.strokeStyle = rgb(dark); g.lineWidth = r * 0.02; g.beginPath(); g.moveTo(-r * 0.05, -r * 0.5); g.lineTo(-r * 0.1, -r * 0.35); g.lineTo(-r * 0.04, -r * 0.28); g.stroke();
  g.restore();
}

export function buildPirate() {
  const wb = new WoodBuilder(), sb = new SailBuilder(), atlas = new Atlas(1024);
  // ---------------------------------------------------------------------------------------------- sail atlas
  const black = (seed, o = {}) => (g, w, h) => {
    cloth(g, w, h, { base: 0x1d1a1c, seam: 0x000000, seamA: 0.5, panels: o.panels ?? 9, reefs: o.reefs ?? [0.22], point: 0x6a5a4a, seed, dirt: 0.25, borderCol: 0x3a0a08 });
    // faded streaks + red patches
    for (let i = 0; i < (o.patches ?? 4); i++) patch(g, (0.15 + hh(i, seed, 1) * 0.7) * w, (0.2 + hh(i, seed, 2) * 0.55) * h, (0.08 + hh(i, seed, 3) * 0.08) * w, (0.1 + hh(i, seed, 4) * 0.1) * h, i % 3 ? 0x5a1210 : 0x3a3230, 0x0a0806, hh(i, seed, 5) - 0.5);
    if (o.stripe) { g.fillStyle = rgb(0x8a1612, 0.9); g.fillRect(0, h * 0.8, w, h * 0.07); }
    if (o.emblem) paintHornedGrin(g, w / 2, h * 0.45, h * o.emblem);
    tatter(g, w, h, { foot: o.foot ?? 0.1, teeth: o.teeth ?? 13, holes: o.holes ?? 2, holeR: 0.05, seed: seed + 7, sides: o.sides });
  };
  const R = atlas.pack({
    mc: [512, 256, black(11, { emblem: 0.3, stripe: true, patches: 3, holes: 2 })], fc: [448, 224, black(12, { stripe: true, holes: 1 })],
    mt: [384, 176, black(13, { patches: 3, holes: 2, foot: 0.12 })], ft: [352, 160, black(14, { patches: 2, holes: 1 })],
    sp: [384, 320, black(15, { patches: 3, holes: 2, foot: 0.08, reefs: [0.8], stripe: true })],
    jib: [256, 240, black(16, { patches: 2, holes: 1, foot: 0.06 })], st: [224, 192, black(17, { patches: 1, holes: 0, foot: 0.05 })],
    flag: [224, 160, (g, w, h) => { g.fillStyle = rgb(0x121012); g.fillRect(-2, -2, w + 4, h + 4); paintHornedGrin(g, w * 0.45, h * 0.5, h * 0.3); tatter(g, w, h, { sides: 0.12, holes: 1, holeR: 0.05, seed: 3 }); }],
    pen: [448, 40, (g, w, h) => { g.fillStyle = rgb(0x9a1612); g.fillRect(-2, -2, w + 4, h + 4); g.fillStyle = rgb(0x121012); g.fillRect(0, h * 0.42, w, h * 0.16); g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(w + 2, -2); g.lineTo(w * 0.8, h / 2); g.lineTo(w + 2, h + 2); g.fill(); g.restore(); }],
    rope: [12, 12, (g) => { g.fillStyle = rgb(0x2a2018); g.fillRect(-2, -2, 16, 16); }],
  });
  const ropeUV = R.rope.uv(0.5, 0.5);
  // ---------------------------------------------------------------------------------------------- hull
  const mainY = u => 1.35 + 0.22 * Math.pow(Math.max(0, (0.5 - u) / 0.5), 2) + 0.42 * Math.pow(Math.max(0, (u - 0.5) / 0.5), 2);
  const H = makeHull({
    L: 16.6, B: 5.0, keel: -1.7, yw: 0.7, bilge: 2.1, tumble: 0.1, maxU: 0.42,
    bowFull: [1.3, 2.1], bowRake: 2.6, bowCurve: 1.8, sternFull: 2.0, transom: 0.6, knuckle: 0.9, transomDrop: 0.8,
    sternRake: 1.3, transomRake: 0.1,
    decks: [{ u0: 0, u1: 0.23, y: 2.45 }, { u0: 0.23, u1: 0.86, y: mainY }, { u0: 0.86, u1: 1, y: 2.05 }],
    bulwark: 0.9, railBlend: 0.06, thick: 0.13, camber: 0.06,
  });
  const sheer = u => mainY(Math.min(1, Math.max(0, u)));
  const hullPaint = (x, y, z, u) => {
    if (y < -0.03) return C.bottom;
    if (y < 0.12) return C.boot;
    const top = H.railY(u);
    if (y > top - 0.5 && y < top - 0.08) return C.redD;
    return (Math.floor((y + 3) / 0.2) % 5 === 0) ? C.hullD : C.hull;
  };
  buildHull(wb, H, { hull: hullPaint, deck: C.deck, inner: C.inner, cap: C.cap, bulkhead: C.hullD, transom: (x, y) => (y < -0.03 ? C.bottom : y < 0.12 ? C.boot : C.hull) });
  for (const side of [-1, 1]) {
    sweep(wb, sidePath(H, 0.004, 0.99, u => sheer(u) - 0.55, side, 44), OPEN3(0.1, 0.07), { color: C.red, d: 0.7, closed: false });
    sweep(wb, sidePath(H, 0.006, 0.98, u => sheer(u) - 1.05, side, 44), OPEN3(0.08, 0.06), { color: C.red, d: 0.7, closed: false });
    sweep(wb, sidePath(H, 0.02, 0.92, () => 0.12, side, 30), OPEN3(0.03, 0.03), { color: C.redD, d: 0.3, closed: false });
    // iron straps on the bow
    for (let k = 0; k < 4; k++) {
      const u = 0.9 + k * 0.022;
      sweep(wb, [0, 1, 2, 3, 4].map(i => { const y = lerp(0.2, H.railY(u) - 0.1, i / 4), f = H.frame(u, y, side); return { o: f.o, A: f.N, B: f.X }; }), OPEN3(0.05, 0.03), { color: C.iron, metal: 0.4, d: 0, closed: false });
    }
  }
  stemAndRam(wb, H);
  wb.mark('hull');
  // ---------------------------------------------------------------------------------------------- stern
  const yQ = 2.45, yRT = H.railY(0), zT = y => H.zStern(y);
  {
    const wy = 1.7, span = H.hb(wy, 0) * 1.4;
    for (let i = 0; i < 4; i++) windowAt(wb, M(lerp(-span / 2, span / 2, i / 3), wy, zT(wy) + 0.05, -0.1), 0.34, 0.46, { frame: C.cap, glass: lc(0xff5a24), glow: 0.9, mullion: C.cap, metal: 0 });
    skull(wb, M(0, 2.75, zT(2.75) + 0.15, 0, Math.PI, 0), 0.62, { bone: C.bone, horns: true, horn: lc(0x3a2e24), eyes: C.glow, eyeGlow: 2.2, piv: [0, 2.75, 8] });
    for (const s of [-1, 1]) lantern(wb, V3(s * (H.hb(yRT, 0) - 0.08), yRT + 0.08, zT(yRT) - 0.05), { s: 0.95, glow: 2.4, frame: C.iron, glass: lc(0xff3a14), metal: 0.3 });
    const zb = H.zAt(0.23, yQ), w = H.hb(yQ, 0.23) - 0.15;
    balustrade(wb, V3(-w, yQ, zb + 0.05), V3(w, yQ, zb + 0.05), { h: 0.75, wood: C.hullD, cap: C.cap, skip: p => Math.abs(p.x) < 0.42, posts: 4 });
    ladder(wb, V3(0, mainY(0.25), zb - 0.95), V3(0, yQ, zb - 0.02), 0.7, { wood: C.hullD, step: C.deck });
    wheel(wb, V3(0, yQ + 1.0, 5.95), yQ, { wood: C.spar, gold: C.brass });
    lamp(wb, V3(0, yQ + 0.7, 5.25), { s: 0.7, glow: 1.8, glass: lc(0xff4a1a) });
    wb.add(box(0.36, 0.66, 0.36), M(0, yQ + 0.33, 5.25), { color: C.hullD, d: 1 });
    // treasure chest
    const ch = M(-1.35, yQ, 7.0, 0, 0.3);
    wb.add(box(0.8, 0.42, 0.5), ch.clone().multiply(M(0, 0.21, 0)), { color: lc(0x5a2e18), d: 1 });
    wb.add(cyl(0.25, 0.25, 0.8, 8).rotateZ(Math.PI / 2).translate(0.4, 0, 0).scale(1, 0.6, 1), ch.clone().multiply(M(0, 0.42, 0)), { uv: 'box', color: lc(0x5a2e18), d: 1 });
    for (const xx of [-0.3, 0, 0.3]) wb.add(box(0.06, 0.5, 0.54), ch.clone().multiply(M(xx, 0.3, 0)), { color: C.brass, metal: 0.8, d: 0 });
    shotPile(wb, 1.4, yQ, 7.1, { color: C.iron });
  }
  rudder(wb, H, { wood: C.hullD, bottom: C.bottom, iron: C.iron, w0: 0.7, w1: 0.34 });
  wb.mark('stern');
  // ---------------------------------------------------------------------------------------------- bow: forecastle, spikes, skull
  {
    const ub = 0.86, yF = 2.05, zb = H.zAt(ub, yF), w = H.hb(yF, ub) - 0.15;
    balustrade(wb, V3(-w, yF, zb - 0.05), V3(w, yF, zb - 0.05), { h: 0.7, wood: C.hullD, cap: C.cap, skip: p => Math.abs(Math.abs(p.x) - (w - 0.45)) < 0.36, posts: 4 });
    for (const s of [-1, 1]) ladder(wb, V3(s * (w - 0.45), mainY(0.85), zb + 0.8), V3(s * (w - 0.45), yF, zb + 0.02), 0.5, { wood: C.hullD, step: C.deck });
    for (const side of [-1, 1]) {
      const pts = [0.87, 0.9, 0.93, 0.96, 0.985].map(u => { const f = H.frame(u, H.railY(u) + 0.06, side); return { p: f.o.clone().addScaledVector(f.N, 0.02), N: f.N }; });
      for (const { p, N } of pts) spikes(wb, p, p, 1, V3().copy(N).multiplyScalar(0.55).add(V3(0, 0.84, 0)).normalize(), { len: 0.45, r: 0.05, color: C.iron });
    }
    lantern(wb, V3(0, H.railY(1) + 0.05, H.zBow(H.railY(1)) + 0.5), { s: 0.8, glow: 2.4, frame: C.iron, glass: lc(0xff3a14), metal: 0.3 });
    for (const s of [-1, 1]) {
      const f = H.frame(0.9, H.railY(0.9) - 0.1, s);
      const b = f.o.clone().addScaledVector(f.N, 0.6).add(V3(0, 0.1, -0.1));
      wb.add(box(0.18, 0.18, 0.6), MY(f.o, b).multiply(M(0, 0.3, 0, Math.PI / 2)), { color: C.hullD, d: 0.8 });
      anchor(wb, b.x, b.y - 0.05, b.z, 0.66, { ry: s > 0 ? -0.4 : 0.4, rz: s * 0.15, color: C.iron, stock: C.hullD });
    }
    skull(wb, M(0, 2.2, H.zBow(2.2) - 0.42, 0.25, 0, 0), 0.62, { bone: C.bone, horns: true, horn: lc(0x2a221c), eyes: C.glow, eyeGlow: 2.6, piv: [0, 2.2, -8.4] });
  }
  wb.mark('bow');
  // ---------------------------------------------------------------------------------------------- guns (red lids)
  const guns = { L: [], R: [] };
  let slot = 0;
  for (const side of [-1, 1]) for (const z of [-4.8, -2.5, -1.1, 0.3, 3.1]) {
    const u = H.uAtZ(z, 1.8), y = mainY(u) + 0.45, xo = H.hb(y, u);
    gunport(wb, H, { z, y: y - 0.02, side, frame: C.cap, lidColor: C.red, lidInner: lc(0xa01a14), lid: 1.1 });
    const muzzle = cannon(wb, { x: side * (xo - 0.7), y, z, slot, barrel: C.iron, metal: 0.35, wood: C.hullD, scale: 0.95 });
    (side < 0 ? guns.L : guns.R).push({ pos: muzzle, slot: slot++ });
  }
  wb.mark('guns');
  // ---------------------------------------------------------------------------------------------- masts & yards
  const FORE = -3.6, MAIN = 1.5;
  const yFore = mainY(H.uAtZ(FORE, 1.5)), yMain = mainY(H.uAtZ(MAIN, 1.5));
  mast(wb, { z: FORE, y0: yFore - 0.3, y1: 9.0, r0: 0.24, r1: 0.18, color: C.mast, hoopColor: C.iron });
  mast(wb, { z: FORE, y0: 8.2, y1: 12.2, r0: 0.15, r1: 0.08, color: C.mast, hoops: 1, hoopColor: C.iron });
  mast(wb, { z: MAIN, y0: yMain - 0.3, y1: 9.8, r0: 0.27, r1: 0.2, color: C.mast, hoopColor: C.iron });
  mast(wb, { z: MAIN, y0: 9.0, y1: 13.4, r0: 0.16, r1: 0.08, color: C.mast, hoops: 1, hoopColor: C.iron });
  for (const [z, y] of [[FORE, 9.0], [MAIN, 9.8]]) wb.add(box(0.44, 0.16, 0.7), M(0, y, z + 0.13), { color: C.spar, d: 0.8 });
  for (const [z, y] of [[FORE, 12.2], [MAIN, 13.4]]) wb.add(cone(0.1, 0.35, 6), M(0, y, z), { uv: 'box', color: C.iron, metal: 0.4, d: 0 });
  platform(wb, { z: FORE + 0.14, y: 8.5, r: 0.8, color: C.hullD, dark: C.cap });
  platform(wb, { z: MAIN + 0.16, y: 9.25, r: 0.72, nest: true, h: 0.7, color: C.hullD, wallColor: C.hullD, dark: C.cap, rim: C.iron, rimMetal: 0.3 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, p = V3(Math.cos(a) * 0.74, 9.95, MAIN + 0.16 + Math.sin(a) * 0.74); spikes(wb, p, p, 1, V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(), { len: 0.28, r: 0.035, color: C.iron }); }
  pinRail(wb, 0, yFore, FORE + 0.1, 1.0, 0.85, C.hullD, C.rope);
  pinRail(wb, 0, yMain, MAIN + 0.1, 1.1, 0.95, C.hullD, C.rope);
  spar(wb, V3(0, 2.3, -6.6), V3(0, 4.25, -11.6), 0.2, 0.09, C.mast);
  chain(wb, V3(0, 3.7, -10.0), 1.6, { color: C.iron });
  chain(wb, V3(0.2, 3.2, -9.0), 1.1, { color: C.iron, end: 'hook' });
  wb.mark('masts');
  const BR = 0.26;
  const yf = [
    yard(wb, { z: FORE, y: 7.95, w: 7.8, brace: BR, r: 0.13, color: C.spar, rope: C.rope, liftTo: V3(0, 8.9, FORE) }),
    yard(wb, { z: FORE, y: 10.95, w: 6.0, brace: BR, r: 0.1, color: C.spar, rope: C.rope, liftTo: V3(0, 12.0, FORE) }),
  ];
  const ym = [
    yard(wb, { z: MAIN, y: 8.65, w: 8.4, brace: BR, r: 0.14, color: C.spar, rope: C.rope, liftTo: V3(0, 9.7, MAIN) }),
    yard(wb, { z: MAIN, y: 11.95, w: 6.4, brace: BR, r: 0.1, color: C.spar, rope: C.rope, liftTo: V3(0, 13.2, MAIN) }),
  ];
  const sq = [
    squareSail(sb, { z: FORE, y: 7.9, Wt: 7.2, Wb: 7.6, H: 3.4, brace: BR, fwd: 0.36, depth: 1.25, region: R.fc }),
    squareSail(sb, { z: FORE, y: 10.9, Wt: 5.4, Wb: 7.0, H: 2.75, brace: BR, fwd: 0.32, tilt: 0.3, depth: 0.95, region: R.ft }),
    squareSail(sb, { z: MAIN, y: 8.6, Wt: 7.8, Wb: 8.2, H: 3.7, brace: BR, fwd: 0.38, depth: 1.4, region: R.mc }),
    squareSail(sb, { z: MAIN, y: 11.9, Wt: 5.8, Wb: 7.6, H: 2.95, brace: BR, fwd: 0.34, tilt: 0.5, depth: 1.0, region: R.mt }),
  ];
  const railPt = (z, side) => { const u = H.uAtZ(z, 2.0); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05, H.zAt(u, H.railY(u))); };
  sb.sheet(sq[0].corners.clewL, railPt(-1.8, -1), 0.03, ropeUV); sb.sheet(sq[0].corners.clewR, railPt(-2.2, 1), 0.03, ropeUV);
  sb.sheet(sq[2].corners.clewL, railPt(3.7, -1), 0.03, ropeUV); sb.sheet(sq[2].corners.clewR, railPt(3.3, 1), 0.03, ropeUV);
  sb.sheet(sq[1].corners.clewL, yf[0].a, 0.022, ropeUV); sb.sheet(sq[1].corners.clewR, yf[0].b, 0.022, ropeUV);
  sb.sheet(sq[3].corners.clewL, ym[0].a, 0.022, ropeUV); sb.sheet(sq[3].corners.clewR, ym[0].b, 0.022, ropeUV);
  // spanker (gaff) — clew ahead of the helm
  const gaff1 = V3(0, 10.4, 6.05), boom1 = V3(0, 5.12, 6.45);
  spar(wb, V3(0, 8.3, MAIN + 0.3), gaff1, 0.09, 0.06, C.spar);
  spar(wb, V3(0, 4.7, MAIN + 0.3), boom1, 0.12, 0.08, C.spar);
  foreAft(sb, { throat: V3(0, 8.2, MAIN + 0.42), peak: V3(0, 10.25, 5.8), tack: V3(0, 4.82, MAIN + 0.42), clew: V3(0, 5.2, 5.9), lee: -1, depth: 1.05, region: R.sp, na: 11, nb: 10 });
  wb.rope(boom1, V3(0, yRT + 0.1, zT(yRT) - 0.3), 0.024, C.rope, 0);
  const j = foreAft(sb, { head: V3(0, 10.9, FORE - 0.22), tack: V3(0, 4.1, -11.1), clew: V3(-0.4, 3.55, -6.9), lee: -1, depth: 0.7, region: R.jib });
  const st = foreAft(sb, { head: V3(0, 8.4, FORE - 0.3), tack: V3(0, 3.1, -8.8), clew: V3(-0.35, 3.2, -5.6), lee: -1, depth: 0.5, region: R.st });
  const fcRail = (z, side) => { const u = H.uAtZ(z, 2.8); return V3(side * (H.hb(H.railY(u), u) - 0.05), H.railY(u) + 0.05, H.zAt(u, H.railY(u))); };
  sb.sheet(j.corners.clew, fcRail(-5.4, -1), 0.02, ropeUV);
  sb.sheet(st.corners.clew, fcRail(-5.0, -1), 0.02, ropeUV);
  flag(sb, { at: V3(0, 13.35, MAIN + 0.03), h: 1.0, len: 1.5, region: R.flag, phase: 0.2, n: 12 });
  flag(sb, { at: V3(0, 12.15, FORE + 0.03), h: 0.42, len: 4.2, taper: 0.55, region: R.pen, phase: 0.6, n: 16 });
  flag(sb, { at: V3(0, 10.35, 6.08), h: 0.36, len: 2.8, taper: 0.5, region: R.pen, phase: 0.9, n: 12 });
  wb.mark('sails+yards');
  // ---------------------------------------------------------------------------------------------- rigging
  const chanY = u => H.railY(u) - 0.16;
  for (const side of [-1, 1]) {
    shrouds(wb, H, { side, z0: FORE - 0.6, z1: FORE + 0.3, zm: FORE, chan: chanY(H.uAtZ(FORE, 2.2)), mastTop: V3(0, 8.45, FORE), n: 3, rope: C.shroud, wood: C.hullD, r: 0.034, dark: C.iron });
    shrouds(wb, H, { side, z0: MAIN + 0.3, z1: MAIN + 1.2, zm: MAIN, chan: chanY(H.uAtZ(MAIN, 2.2)), mastTop: V3(0, 9.2, MAIN), n: 3, rope: C.shroud, wood: C.hullD, r: 0.036, dark: C.iron });
    shroudLines(wb, [V3(side * 0.76, 8.54, FORE + 0.05), V3(side * 0.74, 8.54, FORE + 0.42)], V3(0, 12.0, FORE), C.shroud, { r: 0.022 });
    shroudLines(wb, [V3(side * 0.7, 9.35, MAIN + 0.2), V3(side * 0.68, 9.35, MAIN + 0.5)], V3(0, 13.1, MAIN), C.shroud, { r: 0.024 });
    wb.rope(V3(0, 12.0, FORE), railPt(-1.3, side), 0.022, C.shroud, 0.05);
    wb.rope(V3(0, 13.2, MAIN), V3(side * (H.hb(3.35, 0.2) - 0.05), 3.4, 4.9), 0.024, C.shroud, 0.05);
  }
  wb.rope(V3(0, 8.5, FORE), V3(0, 3.45, -9.6), 0.042, C.shroud, 0.04);
  wb.rope(V3(0, 10.95, FORE), V3(0, 4.12, -11.2), 0.032, C.shroud, 0.02);
  wb.rope(V3(0, 9.25, MAIN), V3(0, 2.9, FORE + 0.35), 0.04, C.shroud, 0.04);
  wb.rope(V3(0, 13.0, MAIN), V3(0, 8.6, FORE + 0.15), 0.028, C.shroud, 0.05);
  wb.rope(V3(0, 4.1, -11.3), V3(0, 0.6, H.zBow(0.6) - 0.05), 0.03, C.iron, 0, { metal: 0.3 });
  for (const [yd, to, sag] of [[yf[0], [MAIN - 0.3, 5.8], 0.35], [yf[1], [MAIN - 0.3, 9.0], 0.3], [ym[0], null, 0.35], [ym[1], null, 0.3]]) {
    for (const [p, s] of [[yd.a, -1], [yd.b, 1]]) wb.rope(p, to ? V3(s * 0.25, to[1], to[0]) : railPt(yd === ym[0] ? 4.2 : 4.0, s), 0.018, C.rope, sag, { radial: 3 });
  }
  wb.mark('rigging');
  // ---------------------------------------------------------------------------------------------- deck
  const yM = u => mainY(u);
  hatch(wb, 0, yM(0.5), -1.7, 1.2, 1.0, { wood: C.hullD, dark: lc(0x0a0706) });
  barrel(wb, -1.3, yM(0.8), -5.3, { wood: lc(0x3a2a1c), hoop: C.red, r: 0.26, h: 0.66 });
  barrel(wb, -0.8, yM(0.8), -5.45, { wood: lc(0x3a2a1c), hoop: C.red, r: 0.24, h: 0.6 });
  barrel(wb, -1.05, yM(0.8) + 0.02, -5.0, { wood: lc(0x3a2a1c), hoop: C.red, r: 0.25, lie: true, ry: 0.4 });
  crate(wb, 1.25, yM(0.8), -5.3, 0.6, { ry: 0.3, wood: lc(0x5a4230), dark: C.hullD });
  shotPile(wb, 0.95, yM(0.62), -3.3, { color: C.iron });
  shotPile(wb, -0.95, yM(0.52), 0.9, { color: C.iron });
  coil(wb, 0.75, yM(0.47), 0.2, 0.27, { color: lc(0x6a5438) });
  coil(wb, -0.7, yM(0.62), -2.9, 0.25, { color: lc(0x6a5438) });
  barrel(wb, 1.6, yM(0.25), 3.9, { wood: lc(0x3a2a1c), hoop: C.iron, r: 0.24, h: 0.6 });
  crate(wb, -1.55, yM(0.25), 3.9, 0.55, { ry: -0.2, wood: lc(0x5a4230), dark: C.hullD });
  wb.mark('deck');
  return {
    wood: wb.build(), sails: sb.build(), foam: buildFoam(H), tex: atlas.texture(), report: wb.report(),
    sockets: {
      helm: [0, yQ, 6.55], wake: [0, 0, H.zStern(0) + 0.4],
      cannonsL: guns.L.map(g => g.pos.toArray()), cannonsR: guns.R.map(g => g.pos.toArray()),
      slotsL: guns.L.map(g => g.slot), slotsR: guns.R.map(g => g.slot),
    },
    look: { wood: { rim: 0.1, rimColor: 0xffd8c0 }, sail: { trans: 0.25, wrap: 0.5 } },
    motion: { bob: 0.08, roll: 0.026, pitch: 0.014, period: 1.05 },
  };
}

/** Stem + keel + the spiked iron ram at the waterline, iron beak with rings of spikes. */
function stemAndRam(wb, H) {
  const path = [];
  for (let i = 0; i <= 12; i++) {
    const y = lerp(-1.7, H.railY(1) + 0.15, i / 12), z = H.zBow(y), z2 = H.zBow(y + 0.05);
    const T = V3(0, 0.05, z2 - z).normalize(), A = V3(0, T.z, -T.y);
    if (A.z > 0) A.negate();
    path.push({ o: V3(0, y, z), A, B: V3(1, 0, 0) });
  }
  sweep(wb, path, [[-0.05, -0.1], [0.16, -0.07], [0.16, 0.07], [-0.05, 0.1]], { color: (p) => (p.y < 1.6 ? C.iron : C.cap), metal: 0.2, d: 0.4, closed: false });
  const kz0 = H.zStern(-1.7), kz1 = H.zBow(-1.7);
  wb.add(box(0.2, 0.28, kz0 - kz1), M(0, -1.7, (kz0 + kz1) / 2), { color: C.bottom, d: 0.6 });
  // ram: diamond-section iron beak from the stem forward
  const y0 = 0.55, z0 = H.zBow(y0) + 0.25, zt = z0 - 3.0;
  const prof = [[0.001, 0], [0.42, 0], [0.38, 0.5], [0.26, 1.6], [0.14, 2.6], [0.001, 3.25]];
  wb.add(lathe(prof, 4), MY(V3(0, y0, z0), V3(0, y0 + 0.12, zt)).multiply(M(0, 0, 0, 0, 0, 0, [1, 1, 0.72])), { uv: 'keep', color: C.iron, metal: 0.55, d: 0 });
  // collar + rings of spikes along the beak
  for (let k = 0; k < 3; k++) {
    const t = 0.15 + k * 0.27, p = V3(0, y0 + 0.12 * t, lerp(z0, zt, t)), rr = lerp(0.42, 0.14, t);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + k * 0.5, d = V3(Math.cos(a), Math.sin(a) * 0.75, 0.25);
      const b = p.clone().add(V3(Math.cos(a) * rr * 0.8, Math.sin(a) * rr * 0.6, 0));
      spikes(wb, b, b, 1, d.normalize(), { len: 0.34 - k * 0.06, r: 0.05, color: C.iron });
    }
  }
  wb.add(torus(0.44, 0.06, 5, 12).rotateY(0), M(0, y0, z0 - 0.05), { uv: 'box', color: C.iron, metal: 0.5, d: 0 });
  // iron straps binding the ram to the stem
  for (const yy of [1.2, 1.9]) wb.rope(V3(0, y0 + 0.2, z0 - 0.4), V3(0, yy, H.zBow(yy) - 0.05), 0.05, C.iron, 0, { metal: 0.4, radial: 4 });
}
