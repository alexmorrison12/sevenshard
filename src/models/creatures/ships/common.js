// Shared ship-building helpers used by every ship definition (rig sets, sun emblems, anchors, catheads, figurehead bits).
import * as THREE from 'three';
import { V3, M, MY, cyl, lathe, box, sphere, cone, torus, lerp, slab } from './build.js';
import { rgb, hh } from './tex.js';
import { IRON } from './props.js';

/** Shroud lines + ratlines from explicit feet to a top point (e.g. topmast shrouds from the top's rim). */
export function shroudLines(wb, feet, top, rope, o = {}) {
  const ends = feet.map(f => [f, top.clone().add(V3(Math.sign(f.x) * (o.spread ?? 0.12), 0, (f.z - top.z) * 0.15))]);
  for (const [a, b] of ends) wb.rope(a, b, o.r ?? 0.028, rope, 0, { radial: 4 });
  const step = o.ratStep ?? 0.42;
  for (let i = 0; i < ends.length - 1; i++) {
    const [a0, a1] = ends[i], [b0, b1] = ends[i + 1];
    const y0 = Math.max(a0.y, b0.y) + 0.35, y1 = Math.min(a1.y, b1.y) - 0.4;
    for (let y = y0; y < y1; y += step) {
      const pa = V3().lerpVectors(a0, a1, (y - a0.y) / (a1.y - a0.y)), pb = V3().lerpVectors(b0, b1, (y - b0.y) / (b1.y - b0.y));
      wb.rope(pa, pb, 0.015, rope, 0, { radial: 3 });
    }
  }
}

/** Yard with footrope + lifts to the mast; returns the yardarm points. */
export function yard(wb, o) {
  // o: { x=0, z, y, w, brace, r, color, rope, fwd (ahead of mast), liftTo (V3 mast point) }
  const cr = Math.cos(o.roll || 0), yd = V3(Math.cos(o.brace || 0) * cr, Math.sin(o.roll || 0), -Math.sin(o.brace || 0) * cr), fwd = V3().crossVectors(V3(0, 1, 0), yd).normalize();
  const c = V3(o.x || 0, o.y, o.z).addScaledVector(fwd, o.fwd ?? 0.22);
  const a = c.clone().addScaledVector(yd, -o.w / 2), b = c.clone().addScaledVector(yd, o.w / 2);
  const r = o.r ?? 0.11;
  // yard spar (thick middle)
  const len = o.w, prof = [[0.001, 0], [r * 0.45, 0], [r * 0.5, len * 0.04], [r * 0.8, len * 0.22], [r, len * 0.5], [r * 0.8, len * 0.78], [r * 0.5, len * 0.96], [r * 0.45, len], [0.001, len]];
  wb.add(lathe(prof, 8), MY(a, b), { uv: 'keep', color: o.color, d: 0.7 });
  // sling / parrel at the mast
  wb.add(box(0.26, 0.26, 0.26), M(c.x, c.y, c.z, 0, o.brace || 0, o.roll || 0), { color: o.dark || o.color, d: 0.6 });
  if (o.rope) {
    // footrope sagging under the yard, with stirrups
    const fa = a.clone().add(V3(0, -0.05, 0)), fb = b.clone().add(V3(0, -0.05, 0));
    for (const [p, q] of [[fa, c.clone().add(V3(0, -0.08, 0))], [c.clone().add(V3(0, -0.08, 0)), fb]]) wb.rope(p, q, 0.016, o.rope, 0.32, { radial: 3, segs: 5 });
    // lifts
    if (o.liftTo) for (const p of [a, b]) wb.rope(p, o.liftTo, 0.02, o.rope, 0, { radial: 3 });
  }
  return { a, b, c, yd, fwd };
}

/** Classic admiralty anchor hanging at (x, y, z) (ring at the top), flukes pointing aft-down. */
export function anchor(wb, x, y, z, s = 1, o = {}) {
  const ir = o.color || IRON;
  const m = M(x, y, z, 0, o.ry || 0, o.rz || 0, s);
  wb.add(cyl(0.06, 0.07, 1.5, 6), m.clone().multiply(M(0, -1.55, 0)), { uv: 'keep', color: ir, metal: 0.4, d: 0 });
  wb.add(torus(0.12, 0.028, 4, 10), m.clone().multiply(M(0, -0.02, 0)), { uv: 'box', color: ir, metal: 0.4, d: 0 });
  wb.add(cyl(0.04, 0.04, 1.3, 6), m.clone().multiply(M(-0.65, -0.3, 0, 0, 0, -Math.PI / 2)), { uv: 'keep', color: o.stock || ir, metal: 0.3, d: 0 });
  // curved arms
  const arm = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, a = Math.PI * (1.05 + t * 0.9); arm.push(V3(Math.cos(a) * 0.55, -1.2 + Math.sin(a) * 0.4 + 0.02, 0)); }
  wb.tube(arm.map(p => p.applyMatrix4(m)), 0.055 * s, ir, { metal: 0.4, d: 0, radial: 5 });
  for (const sx of [-1, 1]) wb.add(cone(0.14, 0.26, 4), m.clone().multiply(M(sx * 0.52, -1.5, 0, 0, Math.PI / 4, sx * 0.9)), { uv: 'box', color: ir, metal: 0.4, d: 0 });
}

/** Radiant sun disc (gold): disc + ring + rays, in the XY plane facing +Z, radius R. */
export function sunDisc(wb, m, R, gold, o = {}) {
  const n = o.rays ?? 12;
  wb.add(cyl(R * 0.55, R * 0.55, 0.06, 18).rotateX(Math.PI / 2), m, { uv: 'box', color: gold, metal: 1, d: 0 });
  wb.add(torus(R * 0.62, R * 0.05, 5, 24), m.clone().multiply(M(0, 0, 0.02)), { uv: 'box', color: gold, metal: 1, d: 0 });
  if (o.face !== false) wb.add(sphere(R * 0.33, 10, 6).scale(1, 1, 0.35), m.clone().multiply(M(0, 0, 0.04)), { uv: 'box', color: o.center || gold, metal: 1, d: 0 });
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, long = i % 2 === 0, len = long ? R * 0.55 : R * 0.35;
    const pts = [[-R * 0.1, 0], [R * 0.1, 0], [0, len]];
    wb.add(slab(pts, 0.05), m.clone().multiply(M(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, 0, 0, 0, a - Math.PI / 2)), { uv: 'box', color: gold, metal: 1, d: 0 });
  }
}

/** Canvas: stylised radiant sun (gold) centred at (cx, cy), radius r. */
export function paintSun(g, cx, cy, r, o = {}) {
  const gold = o.gold ?? 0xe8ae3a, deep = o.deep ?? 0xc0701e, n = o.rays ?? 16;
  g.save(); g.translate(cx, cy);
  if (o.halo !== false) { const gr = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.5); gr.addColorStop(0, rgb(gold, 0.35)); gr.addColorStop(1, rgb(gold, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 1.5, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, long = i % 2 === 0, L = long ? r * 1.32 : r * 1.08, wdt = long ? 0.17 : 0.12;
    g.fillStyle = rgb(long ? gold : deep);
    g.beginPath(); g.moveTo(Math.cos(a - wdt) * r * 0.62, Math.sin(a - wdt) * r * 0.62);
    if (long) g.quadraticCurveTo(Math.cos(a + 0.08) * r * 1.0, Math.sin(a + 0.08) * r * 1.0, Math.cos(a) * L, Math.sin(a) * L);
    else g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
    g.lineTo(Math.cos(a + wdt) * r * 0.62, Math.sin(a + wdt) * r * 0.62); g.closePath(); g.fill();
  }
  const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.7);
  gr.addColorStop(0, rgb(0xffe08a)); gr.addColorStop(1, rgb(gold));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.66, 0, Math.PI * 2); g.fill();
  g.lineWidth = r * 0.07; g.strokeStyle = rgb(deep); g.beginPath(); g.arc(0, 0, r * 0.66, 0, Math.PI * 2); g.stroke();
  g.lineWidth = r * 0.035; g.beginPath(); g.arc(0, 0, r * 0.48, 0, Math.PI * 2); g.stroke();
  // eight-point star in the centre
  g.fillStyle = rgb(deep);
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.14 : r * 0.36; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.restore();
}

/** Pin rail around a mast foot (box frame with belaying pins) + rope coils hanging. */
export function pinRail(wb, x, y, z, w, d, wood, rope) {
  const h = 0.62;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wb.add(box(0.1, h, 0.1), M(x + sx * w / 2, y + h / 2, z + sz * d / 2), { color: wood, d: 0.8 });
  wb.add(box(w + 0.12, 0.08, 0.12), M(x, y + h, z - d / 2), { color: wood, d: 0.8 });
  wb.add(box(w + 0.12, 0.08, 0.12), M(x, y + h, z + d / 2), { color: wood, d: 0.8 });
  for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) {
    const px = x - w / 2 + 0.15 + i * (w - 0.3) / 2;
    wb.add(cyl(0.02, 0.02, 0.22, 4, true), M(px, y + h - 0.06, z + sz * d / 2), { uv: 'keep', color: wood, d: 0.4 });
  }
  if (rope) for (const sz of [-1, 1]) wb.add(torus(0.12, 0.03, 4, 10).scale(1, 1.6, 1), M(x + 0.15 * sz, y + h - 0.2, z + sz * (d / 2 + 0.05)), { uv: 'box', color: rope, d: 0.2 });
}

export { hh };

/** Rudder hung on the sternpost (swings about Y: anim −2). o: { wood, bottom, iron, w0, w1 } */
export function rudder(wb, H, o) {
  const yb = H.c.keel + 0.12, yt = H.c.knuckle + 0.3;
  const pb = V3(0, yb, H.zStern(yb) + 0.05), pt = V3(0, yt, H.zStern(yt) + 0.05);
  const n = 5, fwd = [], aft = [];
  for (let i = 0; i <= n; i++) { const p = V3().lerpVectors(pb, pt, i / n); fwd.push([p.z, p.y]); }
  for (let i = n; i >= 0; i--) { const t = i / n, p = V3().lerpVectors(pb, pt, t); aft.push([p.z + lerp(o.w0 ?? 0.8, o.w1 ?? 0.36, t), p.y + (i === 0 ? 0.06 : 0)]); }
  const shape = new THREE.Shape([...fwd, ...aft].map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  const m = new THREE.Matrix4().makeBasis(V3(0, 0, 1), V3(0, 1, 0), V3(-1, 0, 0)).setPosition(0.08, 0, 0);
  const piv = [0, (yb + yt) / 2, (pb.z + pt.z) / 2];
  wb.add(g, m, { uv: 'box', color: (p) => (p.y < -0.03 ? o.bottom : o.wood), anim: -2, piv, d: 0.8 });
  for (let i = 1; i <= 3; i++) {
    const p = V3().lerpVectors(pb, pt, i / 4);
    wb.add(box(0.2, 0.05, 0.42), M(0, p.y, p.z + 0.14), { color: o.iron, metal: 0.3, d: 0, anim: -2, piv });
  }
}

/** Hanging chain from `top` down `len` metres (pendulum sway, anim −3), alternating flat links. */
export function chain(wb, top, len, o = {}) {
  const n = Math.max(2, Math.round(len / (o.link ?? 0.16))), c = o.color || IRON, piv = [top.x, top.y, top.z];
  for (let i = 0; i < n; i++) {
    const y = top.y - (i + 0.5) * len / n;
    wb.add(box(o.w ?? 0.07, len / n * 1.25, 0.02), M(top.x, y, top.z, 0, i % 2 ? Math.PI / 2 : 0, 0), { color: c, metal: 0.35, d: 0, anim: -3, piv });
  }
  if (o.end === 'hook') wb.add(torus(0.1, 0.025, 4, 8, Math.PI * 1.3), M(top.x, top.y - len - 0.08, top.z, 0, 0, 0.8), { uv: 'box', color: c, metal: 0.35, d: 0, anim: -3, piv });
}

/** Row of iron spikes along a->b (pointing `dir`), count n. */
export function spikes(wb, a, b, n, dir, o = {}) {
  const c = o.color || IRON, len = o.len ?? 0.32, r = o.r ?? 0.05;
  for (let i = 0; i < n; i++) {
    const p = V3().lerpVectors(a, b, n === 1 ? 0.5 : i / (n - 1));
    const tip = p.clone().addScaledVector(dir, len * (0.8 + 0.4 * hh(i, n, 7)));
    wb.add(cone(r, p.distanceTo(tip), 5), MY(p, tip), { uv: 'box', color: c, metal: 0.4, d: 0 });
  }
}

/** Pyramid of cannonballs on the deck. */
export function shotPile(wb, x, y, z, o = {}) {
  const r = o.r ?? 0.09, c = o.color || IRON;
  const lay = [[3, 0], [2, 1], [1, 2]];
  for (const [n, k] of lay) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    wb.add(sphere(r, 6, 4), M(x + (i - (n - 1) / 2) * r * 2, y + r + k * r * 1.55, z + (j - (n - 1) / 2) * r * 2), { uv: 'box', color: c, metal: 0.3, d: 0 });
  }
}

/** Stylised skull (bone) facing −Z at m (local): cranium, cheekbones, jaw, dark sockets; optional horns and glowing eyes. */
export function skull(wb, m, s, o = {}) {
  const bone = o.bone, dark = o.dark || [0.02, 0.015, 0.012];
  const at = (x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) => m.clone().multiply(M(x * s, y * s, z * s, rx, ry, rz, typeof sc === 'number' ? sc * s : sc.map(v => v * s)));
  wb.add(sphere(0.5, 12, 9), at(0, 0.12, 0.02, 0, 0, 0, [1, 0.92, 1.05]), { uv: 'box', color: bone, d: 0.2 });
  wb.add(box(0.62, 0.3, 0.5), at(0, -0.28, -0.12, 0.12), { color: bone, d: 0.2 });                    // cheeks / maxilla
  wb.add(box(0.5, 0.16, 0.42), at(0, -0.5, -0.1, -0.1), { color: bone, d: 0.2 });                     // jaw
  for (const sx of [-1, 1]) {
    wb.add(sphere(0.14, 8, 6), at(sx * 0.19, 0.0, -0.42, 0, 0, 0, [1, 0.9, 0.5]), { uv: 'box', color: dark, d: 0 });
    if (o.eyes) wb.add(sphere(0.055, 6, 4), at(sx * 0.19, 0.0, -0.47), { uv: 'box', color: o.eyes, e: o.eyeGlow ?? 3, d: 0, piv: o.piv });
  }
  wb.add(cone(0.07, 0.14, 3), at(0, -0.2, -0.43, Math.PI, 0, 0), { uv: 'box', color: dark, d: 0 });  // nose
  for (let i = -2; i <= 2; i++) wb.add(box(0.06, 0.12, 0.04), at(i * 0.085, -0.43, -0.33), { color: o.teeth || bone, d: 0 });
  if (o.horns) for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 7; i++) { const t = i / 7, a = t * Math.PI * 1.25; pts.push(V3(sx * (0.36 + Math.sin(a) * 0.42 + t * 0.2), 0.3 + Math.cos(a) * 0.36 - t * 0.2, 0.05 - t * 0.1).multiplyScalar(s).applyMatrix4(m)); }
    const rr = []; for (let i = 0; i <= 7; i++) rr.push(s * 0.13 * (1 - i / 7 * 0.85));
    wb.tube(pts, rr, o.horn || bone, { radial: 6, d: 0.3, metal: o.hornMetal || 0 });
  }
}

/** Hull breach at (u, y) on `side`: dark ragged recess + splintered plank ends + exposed ribs. */
export function breach(wb, H, u, y, side, o = {}) {
  const f = H.frame(u, y, side), w = o.w ?? 0.9, h = o.h ?? 0.6, dark = o.dark || [0.004, 0.006, 0.005], wood = o.wood;
  const base = new THREE.Matrix4().makeBasis(f.X, f.U, f.N).setPosition(f.o);
  const at = (x, yy, z, rz = 0, ry = 0, rx = 0) => base.clone().multiply(M(x, yy, z, rx, ry, rz));
  const seed = Math.round(u * 1000 + y * 77 + side * 13);
  // ragged dark recess: overlapping rotated slabs
  for (let i = 0; i < 4; i++) {
    const rw = w * (0.55 + hh(i, seed, 1) * 0.45), rh = h * (0.5 + hh(i, seed, 2) * 0.5);
    wb.add(box(rw, rh, 0.03), at((hh(i, seed, 3) - 0.5) * w * 0.35, (hh(i, seed, 4) - 0.5) * h * 0.35, 0.02, (hh(i, seed, 5) - 0.5) * 0.9), { color: dark, d: 0 });
  }
  // exposed ribs across the hole
  for (let k = -1; k <= 1; k += 2) wb.add(box(0.1, h * 1.05, 0.08), at(k * w * 0.18, 0, 0.005), { color: o.rib || wood, d: 0.8 });
  // splinters: plank ends bent outward around the rim
  const n = o.splinters ?? 9;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + hh(i, seed, 6), rx = Math.cos(a) * w * 0.48, ry = Math.sin(a) * h * 0.46;
    const len = 0.18 + hh(i, seed, 7) * 0.3;
    wb.add(cone(0.05 + hh(i, seed, 8) * 0.03, len, 3), at(rx, ry, 0.03, a - Math.PI / 2 + (hh(i, seed, 9) - 0.5) * 0.6, 0, 0.55 + hh(i, seed, 10) * 0.5).multiply(M(0, 0, 0, 0, 0, 0, [1, 1, 0.35])), { uv: 'box', color: wood, d: 0.6 });
  }
}

/** Cluster of barnacles around hull point (u, y). */
export function barnacles(wb, H, u, y, side, n, o = {}) {
  const c = o.color || [0.55, 0.56, 0.5], seed = Math.round(u * 997 + y * 31 + side * 7);
  for (let i = 0; i < n; i++) {
    const uu = u + (hh(i, seed, 1) - 0.5) * (o.du ?? 0.06), yy = y + (hh(i, seed, 2) - 0.5) * (o.dy ?? 0.5);
    const f = H.frame(Math.min(0.995, Math.max(0.005, uu)), yy, side), s = 0.05 + hh(i, seed, 3) * 0.07;
    const m = new THREE.Matrix4().makeBasis(f.X, f.N, f.U.clone().negate()).setPosition(f.o);   // local +Y = outward
    wb.add(cone(s, s * 1.1, 5), m.multiply(M(0, -0.01, 0, 0, hh(i, seed, 4) * 3, 0)), { uv: 'box', color: hh(i, seed, 5) > 0.3 ? c : (o.dark || [0.2, 0.24, 0.2]), d: 0.2 });
  }
}

/** Hanging strand of seaweed (flat ribbon) from `top` (pendulum sway). */
export function seaweed(wb, top, len, o = {}) {
  const c = o.color || [0.05, 0.12, 0.05], piv = [top.x, top.y, top.z], n = 5, pts = [], rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(V3(top.x + Math.sin(t * 5 + top.z) * 0.08, top.y - t * len, top.z + Math.cos(t * 4 + top.x) * 0.06));
    rr.push((o.w ?? 0.06) * (1 - t * 0.7));
  }
  wb.tube(pts, rr, c, { radial: 3, anim: -3, piv, d: 0.2, twist: 0.5 });
}
