// Island terrain toolkit. An island is a pure height function in its own local frame (metres, sea level 0), built from
// a coast shape (2D signed distance, negative on land) plus bumps, carves and custom sculpting — so the Glass Sea
// silhouette (low res, chart coordinates) and the walkable island zone (1 m heightfield) are the same island.
//
//   const T = terrain({ coast, beach, land, shelf, depth, wobble, bumps: [{ x, z, r, h, p }], carve: [{ shape, h, soft }], fn })
//   T.height(x, z)      local ground height (land > 0, seabed < 0)
//   T.radius            beyond this (from the origin) the island does not touch the seabed
import { Simplex, clamp, smoothstep, lerp } from '../../core/noise.js';

const NZ = new Simplex(7331);
export const noise2 = (x, z) => NZ.noise2(x, z);
export const fbm2 = (x, z, o = 3) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += NZ.noise2(x * f + i * 17.3, z * f - i * 9.1) * a; n += a; a *= 0.5; f *= 2; } return s / n; };
const sst = (a, b, v) => smoothstep(a, b, v);

/**
 * spec: {
 *   coast: shape (sd < 0 on land),  wobble: coast noise amplitude (m) [2.5],  wobbleScale [22]
 *   beach: beach width (m) [7], beachTop: height where the beach meets the land [0.9], land: inland height [2.4]
 *   landRamp: metres from the beach edge to full land height [9]
 *   shelf: shallow shelf width offshore (m) [26], shelfDepth [-2.6], depth: open-water depth [-24], drop: shelf→deep distance [40]
 *   bumps: [{ x, z, r, h, p (profile exponent, default 2), plateau (0..1 flat top fraction) }]  hills (added on land)
 *   carve: [{ shape, h (target height), soft (m) }]   flatten / dig to a height (lagoons, plazas, coves)
 *   fn(x, z, h, d) → h   final custom sculpt (d = coast signed distance)
 *   radius: influence radius (auto from the coast box + shelf + drop)
 * }
 */
export function terrain(spec) {
  const S = {
    wobble: 2.5, wobbleScale: 22, beach: 7, beachTop: 0.9, land: 2.4, landRamp: 9,
    shelf: 26, shelfDepth: -2.6, depth: -24, drop: 40, bumps: [], carve: [], fn: null, ...spec,
  };
  const box = S.coast.box;
  const R = S.radius ?? Math.max(Math.abs(box[0]), Math.abs(box[1]), Math.abs(box[2]), Math.abs(box[3])) + S.shelf + S.drop + 6;
  const W = S.wobble, WS = S.wobbleScale;
  function coastD(x, z) { return S.coast.sd(x, z) + (W ? (NZ.noise2(x / WS, z / WS) * W + NZ.noise2(x / (WS * 0.37) + 5, z / (WS * 0.37)) * W * 0.35) : 0); }
  function height(x, z) {
    const d = coastD(x, z);
    let h;
    if (d >= 0) {
      // offshore: a short wet slope, a shallow shelf (turquoise), then the drop to the deep
      const a = sst(0, 6, d), b = sst(S.shelf * 0.5, S.shelf + S.drop, d);
      h = lerp(0, S.shelfDepth, a) + (S.depth - S.shelfDepth) * b - 0.4 * sst(0, 2, d);
      h += NZ.noise2(x / 9, z / 9) * 0.35 * a * (1 - b);
    } else {
      const u = -d;
      const beach = Math.min(S.beachTop, u / S.beach * S.beachTop);
      h = beach + (S.land - S.beachTop) * sst(S.beach, S.beach + S.landRamp, u);
      h += fbm2(x / 30, z / 30, 3) * 0.9 * sst(S.beach, S.beach + S.landRamp * 1.5, u);
    }
    for (const B of S.bumps) {
      const r = Math.hypot(x - B.x, z - B.z) / B.r; if (r >= 1) continue;
      const pl = B.plateau || 0, t = r <= pl ? 1 : 1 - (r - pl) / (1 - pl);   // 1 on the plateau → 0 at the rim
      h += B.h * Math.pow(sst(0, 1, t), B.p ?? 1);
    }
    for (const C of S.carve) {
      const sd = C.shape.sd(x, z), soft = C.soft ?? 3;
      if (sd >= soft) continue;
      const t = sst(soft, 0, sd);
      const target = typeof C.h === 'function' ? C.h(x, z, h) : C.h;
      h = C.mode === 'max' ? Math.max(h, lerp(h, target, t)) : C.mode === 'min' ? Math.min(h, lerp(h, target, t)) : lerp(h, target, t);
    }
    if (S.fn) h = S.fn(x, z, h, d);
    return h;
  }
  return { height, coastD, radius: R, spec: S };
}

/** ellipse shape (rx, rz, rot) as an approximate signed distance (good enough for coasts & paint) */
export function ellipse(x, z, rx, rz, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), r = Math.max(rx, rz);
  return {
    sd: (px, pz) => { const dx = px - x, dz = pz - z, lx = c * dx - s * dz, lz = s * dx + c * dz; const k = Math.hypot(lx / rx, lz / rz); return (k - 1) * Math.min(rx, rz) * (k > 1 ? 1 : 1); },
    box: [x - r, z - r, x + r, z + r],
  };
}
/** smooth union of shapes (k = blend radius) */
export function smoothUnion(k, ...shapes) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) { b[0] = Math.min(b[0], s.box[0]); b[1] = Math.min(b[1], s.box[1]); b[2] = Math.max(b[2], s.box[2]); b[3] = Math.max(b[3], s.box[3]); }
  return {
    sd: (x, z) => {
      let d = shapes[0].sd(x, z);
      for (let i = 1; i < shapes.length; i++) { const e = shapes[i].sd(x, z); const hh = clamp(0.5 + 0.5 * (e - d) / k, 0, 1); d = lerp(e, d, hh) - k * hh * (1 - hh); }
      return d;
    },
    box: b,
  };
}
/** shape with its signed distance shifted by an offset (grow > 0) */
export function grow(s, r) { return { sd: (x, z) => s.sd(x, z) - r, box: [s.box[0] - r, s.box[1] - r, s.box[2] + r, s.box[3] + r] }; }
/** translate a shape */
export function moved(s, ox, oz) { return { sd: (x, z) => s.sd(x - ox, z - oz), box: [s.box[0] + ox, s.box[1] + oz, s.box[2] + ox, s.box[3] + oz] }; }
