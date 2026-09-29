// Terrain specs for every island on the Glass Sea (the eight islands, Brightwater Isle and Pipsprout Hollow). Each is
// a pure height function in the island's local frame (see isle.js) — used by the sea chart (depth, nav, silhouettes)
// and by the island zones (src/world/zones/isle_*.js) for their walkable 1 m ground. Docks are always on the south
// (+Z) side, so you arrive with the island ahead of the iso camera.
import * as S from '../shapes.js';
import { terrain, ellipse, smoothUnion, fbm2, noise2 } from './isle.js';
import { smoothstep, clamp, lerp } from '../../core/noise.js';

const sst = smoothstep;

// ------------------------------------------------------------------------------------------------ Coinflip Cay
// A crescent cay hugging a turquoise lagoon (east), the Gilded Gull casino on the western rise, a boardwalk from the
// south pier, the Golden Gull statue on the northern horn.
const coinflip = terrain({
  coast: S.subtract(smoothUnion(8, ellipse(-6, 0, 44, 46), ellipse(18, -30, 22, 14, 0.4), ellipse(20, 30, 20, 13, -0.4)), ellipse(20, 0, 17, 20)),
  beach: 8, land: 2.2, landRamp: 10, shelf: 30,
  bumps: [{ x: -18, z: -8, r: 30, h: 3.2, plateau: 0.5 }, { x: 16, z: -34, r: 10, h: 2.2 }],
  carve: [
    { shape: ellipse(20, 0, 15, 18), h: -1.4, soft: 4 },                 // the lagoon (shallow, turquoise)
    { shape: S.rect(36, 0, 22, 8), h: -1.6, soft: 3 },                   // its mouth to the sea (east)
    { shape: S.circle(-18, -7, 16.5), h: 5.4, soft: 5 },                  // casino plaza (flat)
  ],
});

// ------------------------------------------------------------------------------------------------ Songstone Isle
// A round green isle: a sunken amphitheatre in the middle, five Cantor statues on terraces around it, a ruined hill
// to the north, rocky knuckles on the east shore.
const songstone = terrain({
  coast: smoothUnion(10, ellipse(0, -4, 46, 44), ellipse(-26, -30, 18, 14, 0.5), ellipse(30, 6, 14, 20)),
  beach: 6, land: 2.8, landRamp: 12,
  bumps: [{ x: 0, z: -38, r: 22, h: 7, plateau: 0.3 }, { x: 34, z: 8, r: 12, h: 3, p: 1.4 }, { x: -30, z: -30, r: 14, h: 3.5 }],
  carve: [
    { shape: S.circle(0, -6, 12.5), h: 1.1, soft: 5 },                    // amphitheatre floor
    { shape: S.ring(0, -6, 22.5, 6), h: 4.2, soft: 3 },                    // statue terrace ring
  ],
});

// ------------------------------------------------------------------------------------------------ Powderkeg Cove
// A horseshoe around a sheltered cove opening south; the bastion on the northern headland faces the open sea (north).
export const BASTION = [[-19, -23], [-21, -35], [-10, -42], [0, -46], [10, -42], [21, -35], [19, -23]];
const powderkeg = terrain({
  coast: S.subtract(smoothUnion(10, ellipse(0, -6, 50, 44), ellipse(-34, 22, 16, 22, 0.3), ellipse(34, 22, 16, 22, -0.3)), smoothUnion(6, S.circle(0, 16, 18), S.rect(0, 40, 22, 30))),
  beach: 6, land: 2.4, landRamp: 9, shelf: 24,
  bumps: [{ x: 0, z: -32, r: 26, h: 5.2, plateau: 0.6 }, { x: -30, z: 4, r: 16, h: 2.4 }, { x: 30, z: 4, r: 16, h: 2.4 }],
  carve: [
    { shape: S.circle(0, 16, 15), h: -3.2, soft: 5 },                     // the cove (deep enough to moor)
    { shape: S.poly(BASTION), h: 7.4, soft: 4 },                          // bastion yard (flat)
    { shape: S.rect(0, -16, 8, 14), h: (x, z) => 7.4 - Math.max(0, z + 23) * 0.24, soft: 2.5 },   // ramp down to the village
  ],
});

// ------------------------------------------------------------------------------------------------ Moonveil Atoll
// A ring of pale sand around a still lagoon; a shrine islet in the middle (bridge from the south), five lantern posts.
const moonveil = terrain({
  coast: smoothUnion(4, S.ring(0, -2, 38, 17), S.circle(0, -4, 9), S.rect(0, 17, 5, 25)),
  beach: 9, land: 1.6, landRamp: 8, shelf: 22, beachTop: 0.8,
  bumps: [{ x: 0, z: -4, r: 10, h: 1.6, plateau: 0.5 }, { x: -30, z: -20, r: 10, h: 1.2 }, { x: 28, z: -24, r: 10, h: 1.4 }],
  carve: [{ shape: S.subtract(S.circle(0, -2, 27), S.union(S.circle(0, -4, 10.5), S.rect(0, 16, 6.5, 26))), h: -1.8, soft: 2.5 }],
});

// ------------------------------------------------------------------------------------------------ Stormcrown Spire
// A small black-rock island; the spire (Kit rock, 40 m) rises from its centre, a ledge path spirals around it.
const stormcrown = terrain({
  coast: smoothUnion(8, ellipse(0, -2, 36, 34), ellipse(0, 26, 14, 16)),
  beach: 4, land: 3.2, landRamp: 6, shelf: 18, beachTop: 0.9,
  bumps: [{ x: 0, z: -6, r: 26, h: 4, p: 1.5 }],
  fn: (x, z, h, d) => h + (d < -3 ? Math.abs(noise2(x / 7, z / 7)) * 1.4 : 0),
});

// ------------------------------------------------------------------------------------------------ Hushwater Lagoon
// A high rocky ring (cliffs, a waterfall) enclosing a glowing lagoon; the mermaid's rock in the middle, a jetty to it.
const hushwater = terrain({
  coast: smoothUnion(6, S.ring(0, -4, 36, 22), ellipse(0, 30, 16, 12)),
  beach: 3, land: 4, landRamp: 6, shelf: 20,
  bumps: [{ x: -26, z: -26, r: 20, h: 9, p: 1.3 }, { x: 22, z: -30, r: 18, h: 8, p: 1.3 }, { x: 34, z: 4, r: 14, h: 5 }, { x: -34, z: 6, r: 14, h: 5 }],
  carve: [
    { shape: S.circle(0, -4, 24), h: -1.6, soft: 4 },                     // the lagoon
    { shape: ellipse(0, 7, 17, 7.5), h: -0.25, soft: 4 },                 // wading shallows (pearl beds)
    { shape: S.circle(0, -8, 4), h: 1.4, soft: 2 },                        // mermaid rock islet
    { shape: S.rect(0, 20, 12, 16), h: 1.2, soft: 3 },                    // south beach into the lagoon
  ],
});

/** distance (m) to the nearest seam of a hexagonal tiling (Grandmother Shellback's scutes, radius q) */
export function hexSeam(x, z, q = 10.5) {
  const w = q * Math.sqrt(3), hh = q * 1.5;
  const j0 = Math.round(z / hh);
  let d1 = 1e9, d2 = 1e9;
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    const off = (j & 1) ? w / 2 : 0, i0 = Math.round((x - off) / w);
    for (let i = i0 - 1; i <= i0 + 1; i++) { const cx = i * w + off, cz = j * hh, d = Math.hypot(x - cx, z - cz); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  }
  return (d2 - d1) * 0.5;
}
// ------------------------------------------------------------------------------------------------ Shellback Isle
// Grandmother Shellback: the "island" is her domed shell (plates), head resting on the water to the north.
const shellback = terrain({
  coast: smoothUnion(6, ellipse(0, 0, 40, 46), ellipse(0, 40, 14, 12)),
  beach: 5, land: 2.6, landRamp: 6, shelf: 20, wobble: 0.8,
  bumps: [{ x: 0, z: -2, r: 40, h: 9.5, p: 0.8, plateau: 0.3 }],
  carve: [{ shape: S.circle(0, -2, 13), h: 12.3, soft: 5 }],             // the market ridge on top of the shell
  fn: (x, z, h, d) => {
    if (d > -2) return h;
    // scute seams: hexagonal plates pressed a little into the dome
    return h - sst(0.9, 0.0, hexSeam(x, z)) * 0.35 * sst(-2, -8, d);
  },
});

// ------------------------------------------------------------------------------------------------ Drownbell Shoal
// Low sandbars and wading shallows among the drowned chapel's ruins; the Bellwarden rises from the pool in the middle.
const drownbell = terrain({
  coast: smoothUnion(8, ellipse(0, -4, 34, 22), ellipse(-26, 20, 16, 9, 0.5), ellipse(28, 18, 14, 8, -0.4), ellipse(0, 30, 9, 16)),
  beach: 10, land: 0.9, landRamp: 10, shelf: 22, shelfDepth: -1.4, beachTop: 0.6,
  bumps: [{ x: -20, z: -14, r: 10, h: 0.8 }, { x: 18, z: -16, r: 9, h: 0.7 }],
  carve: [
    { shape: S.circle(0, -6, 14), h: 0.5, soft: 4 },                       // arena sand (flat)
    { shape: S.ring(0, -6, 20, 7), h: -0.35, soft: 2.5 },                  // a moat of ankle-deep water around it
  ],
});

// ------------------------------------------------------------------------------------------------ Brightwater Isle
const brightwater = terrain({
  coast: smoothUnion(10, ellipse(0, 0, 40, 32), ellipse(-24, -18, 16, 14)),
  beach: 6, land: 3, landRamp: 10,
  bumps: [{ x: -6, z: -8, r: 22, h: 4, plateau: 0.4 }],
});

// ------------------------------------------------------------------------------------------------ Pipsprout Hollow
const pipsprout = terrain({
  coast: smoothUnion(12, ellipse(0, 0, 52, 40), ellipse(-30, -26, 22, 18), ellipse(30, 22, 18, 12)),
  beach: 6, land: 2.6, landRamp: 10,
  bumps: [{ x: -10, z: -10, r: 30, h: 5, p: 1.2 }, { x: 24, z: -14, r: 14, h: 3 }],
});

/** id → { T: terrain, layers, paint? } — chart placement comes from src/data/islands.js (ISLANDS / LANDMARKS) */
export const ISLE_TERRAIN = { coinflip, songstone, powderkeg, moonveil, stormcrown, hushwater, shellback, drownbell, brightwater, pipsprout };

/**
 * Generic ground painting for an island (works in any frame: ox, oz = where the island origin sits).
 * layers must include 'sand', 'grass', 'rock' (and optionally 'dirt', 'moss').
 */
export function paintIsle(g, T, ox, oz, { grassAt = 1.25, rockSlope = 0.62, moss = true, dirt = true } = {}) {
  const r = T.radius;
  const box = [ox - r, oz - r, ox + r, oz + r];
  const hh = (x, z) => T.height(x - ox, z - oz);
  // grass above the beach line (noisy edge)
  g.paint('grass', { sd: (x, z) => grassAt + noise2(x / 6, z / 6) * 0.35 - hh(x, z), box }, { soft: 0.6 });
  // rock where it is steep
  g.paint('rock', { sd: (x, z) => { const e = 1.2, dx = hh(x + e, z) - hh(x - e, z), dz = hh(x, z + e) - hh(x, z - e); return rockSlope - Math.hypot(dx, dz) / (2 * e); }, box }, { soft: 0.3 });
  if (moss && g.layers.includes('moss')) g.paint('moss', { sd: (x, z) => 0.35 - noise2(x / 14 + 3, z / 14) - (hh(x, z) > grassAt + 0.6 ? 0 : 9), box }, { soft: 0.8, amount: 0.6 });
  if (dirt && g.layers.includes('dirt')) g.paint('dirt', { sd: (x, z) => 0.45 - noise2(x / 9 - 7, z / 9) - (hh(x, z) > grassAt + 0.3 ? 0 : 9), box }, { soft: 0.8, amount: 0.5 });
}
export { terrain, ellipse, smoothUnion, fbm2, noise2, clamp, lerp, sst };
