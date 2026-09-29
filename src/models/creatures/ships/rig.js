// Masts, spars, platforms and standing rigging (all rigid → the wood mesh).
import * as THREE from 'three';
import { V3, M, MY, cyl, lathe, box, torus, lerp } from './build.js';

const IRON = [0.05, 0.045, 0.04];

/** Mast from (x, y0, z) up to y1, tapering r0 → r1, with iron hoops. Optional rake (lean aft, rad). */
export function mast(wb, o) {
  const a = V3(o.x || 0, o.y0, o.z), b = V3(o.x || 0, o.y1, o.z + (o.y1 - o.y0) * Math.tan(o.rake || 0));
  const len = a.distanceTo(b);
  wb.add(cyl(o.r0, o.r1, len, o.seg ?? 10), MY(a, b), { uv: 'keep', color: o.color, d: 0.7 });
  const hoops = o.hoops ?? Math.floor(len / 1.3);
  for (let i = 1; i <= hoops; i++) {
    const t = i / (hoops + 1), p = V3().lerpVectors(a, b, t), r = lerp(o.r0, o.r1, t) + 0.018;
    wb.add(cyl(r, r, 0.07, o.seg ?? 10, true), MY(p, b), { uv: 'keep', color: o.hoopColor || IRON, metal: o.hoopMetal ?? 0.4, d: 0 });
  }
  return { a, b, at: (y) => V3().lerpVectors(a, b, (y - o.y0) / (o.y1 - o.y0)) };
}

/** Spar (yard / boom / gaff / bowsprit) from a to b: thicker in the middle when `yard`, else tapered a → b. */
export function spar(wb, a, b, r0, r1, color, yard = false, seg = 8) {
  const len = a.distanceTo(b);
  const prof = yard
    ? [[0.001, 0], [r1 * 0.9, 0], [r1, len * 0.03], [(r0 + r1) / 2, len * 0.2], [r0, len * 0.5], [(r0 + r1) / 2, len * 0.8], [r1, len * 0.97], [r1 * 0.9, len], [0.001, len]]
    : [[0.001, 0], [r0, 0], [lerp(r0, r1, 0.5), len * 0.5], [r1, len], [0.001, len]];
  wb.add(lathe(prof, seg), MY(a, b), { uv: 'keep', color, d: 0.7 });
}

/** Round top platform / crow's nest at (x, y, z). nest: basket walls + rail. */
export function platform(wb, o) {
  const { x = 0, y, z, r } = o;
  const seg = 14;
  // floor (cylinder slab)
  wb.add(cyl(r, r, 0.12, seg), M(x, y - 0.06, z), { uv: 'box', color: o.color, d: 1 });
  // cross trees under it
  wb.add(box(r * 2.1, 0.12, 0.16), M(x, y - 0.14, z), { color: o.dark || o.color, d: 0.8 });
  wb.add(box(0.16, 0.12, r * 2.1), M(x, y - 0.14, z), { color: o.dark || o.color, d: 0.8 });
  if (o.nest) {
    // basket (thick lathe wall with staves) + two iron/gold hoops
    const hgt = o.h ?? 0.8;
    wb.add(lathe([[r * 0.96, -0.02], [r, hgt], [r - 0.07, hgt], [r * 0.9, 0.08]], seg * 2, 18), M(x, y, z), { uv: 'keep', color: o.wallColor || o.color, d: 1 });
    wb.add(torus(r + 0.01, 0.045, 5, seg * 2), M(x, y + hgt - 0.03, z, Math.PI / 2), { uv: 'box', color: o.rim || o.color, metal: o.rimMetal || 0, d: 0.2 });
    wb.add(torus(r * 0.985, 0.035, 5, seg * 2), M(x, y + hgt * 0.3, z, Math.PI / 2), { uv: 'box', color: o.rim || o.color, metal: o.rimMetal || 0, d: 0.2 });
  } else {
    // rail posts + rope rail around the aft half
    for (let i = 0; i <= 6; i++) {
      const t = Math.PI * (0.05 + i / 6 * 0.9), px = x + Math.cos(t) * r * 0.92, pz = z + Math.sin(t) * r * 0.92;
      wb.add(cyl(0.025, 0.025, 0.55, 5), M(px, y, pz), { uv: 'keep', color: o.dark || o.color, d: 0.4 });
    }
    wb.add(torus(r * 0.92, 0.03, 4, 12, Math.PI * 0.9), M(x, y + 0.55, z, Math.PI / 2, 0, Math.PI * 0.05), { uv: 'box', color: o.dark || o.color, d: 0.4 });
  }
}

/**
 * Shrouds for one side: channel (ledge) on the hull at the rail, deadeyes, n shrouds up to the masthead, ratlines.
 * o: { H, side, z0, z1 (channel extent), mastTop (V3 where they meet), n, rope, wood, ratStep, chan (channel y), out }
 */
export function shrouds(wb, H, o) {
  const side = o.side, n = o.n ?? 3, rope = o.rope, rr = o.r ?? 0.035;
  const uc = H.uAtZ((o.z0 + o.z1) / 2, o.chan);
  const f = H.frame(uc, o.chan, side);
  // channel ledge
  const len = Math.abs(o.z1 - o.z0) + 0.6, out = o.out ?? 0.34;
  const m = new THREE.Matrix4().makeBasis(f.X, f.U, f.N).setPosition(f.o.clone().addScaledVector(f.N, out / 2));
  wb.add(box(len, 0.09, out), m, { color: o.wood, d: 1 });
  const ends = [];
  for (let i = 0; i < n; i++) {
    const z = lerp(o.z0, o.z1, n === 1 ? 0.5 : i / (n - 1));
    const u = H.uAtZ(z, o.chan), fr = H.frame(u, o.chan, side);
    const foot = fr.o.clone().addScaledVector(fr.N, out - 0.04).add(V3(0, 0.05, 0));
    // deadeye pair
    const de = foot.clone().add(V3(0, 0.2, 0));
    wb.add(cyl(0.075, 0.075, 0.07, 8), MY(de, de.clone().add(fr.N)), { uv: 'box', color: o.dark || IRON, d: 0.3 });
    // chainplate down the side
    const low = H.frame(u, o.chan - 0.9, side);
    wb.rope(foot, low.o.clone().addScaledVector(low.N, 0.05), 0.02, IRON, 0, { metal: 0.3, radial: 3 });
    const top = o.mastTop.clone().add(V3(side * (o.spread ?? 0.22), 0, (z - o.zm) * 0.12));
    ends.push([foot.clone().add(V3(0, 0.3, 0)), top]);
    wb.rope(foot.clone().add(V3(0, 0.26, 0)), top, rr, rope, 0, { radial: 4 });
  }
  // ratlines between consecutive shrouds
  const step = o.ratStep ?? 0.42;
  for (let i = 0; i < n - 1; i++) {
    const [a0, a1] = ends[i], [b0, b1] = ends[i + 1];
    const h = Math.min(a1.y, b1.y) - Math.max(a0.y, b0.y);
    for (let yy = 0.5; yy < h - 0.6; yy += step) {
      const ta = (yy + (Math.max(a0.y, b0.y) - a0.y)) / (a1.y - a0.y), tb = (yy + (Math.max(a0.y, b0.y) - b0.y)) / (b1.y - b0.y);
      const pa = V3().lerpVectors(a0, a1, ta), pb = V3().lerpVectors(b0, b1, tb);
      wb.rope(pa, pb, 0.017, rope, 0, { radial: 3 });
    }
  }
  return ends;
}
