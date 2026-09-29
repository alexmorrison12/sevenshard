// 'goldmeadow' — golden farmland west of Solhaven (~220×220 m, levels 5–25). Warm afternoon, drifting pollen.
//   Sheafton (48, 20): village green, the Golden Sheaf inn, well, market stall, triport — the arrival from Solhaven (east)
//   Hale Farm (44, 60): farmhouse, red barn, yard, pasture; wheat fields (scarecrow field, wheat maze) to the south
//   Windmill Hill (86, 86) · Sunflower Hill (−6, 88) · the river (NE → SW) with the Stone Bridge (−4, 7) and the Millpond
//   Beehive Orchard (62, −44) · Old Watchtower (18, −80) · Ember Clearing (chaos gate, 82, −62)
//   West bank: Standing Stones (field boss, −56, −36), Wolf Dens under the western cliffs (−80, −72), Hunter's Camp,
//   Boar Wallows (−80, −10), Hermit's Hollow (−90, 36), Bandit Camp (−64, 74); the Thornwood road leaves north (−42, −106)
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { tick } from '../zone.js';
import { NavGrid } from '../nav.js';
import { M, box, cyl, sphere, kitMaterial } from '../kit.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { buildWater } from '../water.js';
import { boulder } from '../cliffs.js';
import { blob } from '../../engine/geom.js';
import { FieldGround, DistGrid, FieldKit, Anchors, snapAnchors, aliasNumbered, seedSpots, spline, along, paintPath, pieces, scatter, bump, ramp, faceTo, waterEnv, S, RNG, clamp, smoothstep, lerp } from '../fields/common.js';
import { FieldGrass, FieldFlora, sunflowerGeo, reedGeo, tallGrassGeo, mushroomGeo } from '../fields/flora.js';
import { Mist, buildSmoke, buildDrifters, buildButterflies } from '../fields/fx.js';
import * as F from '../fields/props.js';

export const DEF = { name: 'Goldmeadow', kind: 'field', size: 220 };
const WL = -0.9;              // river / millpond water level

// ------------------------------------------------------------------------------------------------ layout
const BOUND = [[-100, -92], [-78, -100], [-58, -98], [-48, -104], [-36, -104], [-24, -97], [0, -96], [22, -100], [44, -98], [58, -103], [74, -96], [90, -86], [100, -66], [98, -40], [102, -10], [100, 12], [108, 24], [108, 36], [100, 44], [104, 70], [100, 92], [80, 100], [56, 102], [30, 104], [8, 106], [-14, 102], [-34, 104], [-44, 106], [-56, 98], [-78, 100], [-96, 90], [-104, 66], [-100, 40], [-106, 14], [-102, -14], [-106, -40], [-104, -70]];
const RIVER = spline([[64, -130], [54, -96], [40, -68], [22, -42], [6, -18], [-4, 6], [-8, 28], [-15, 48], [-24, 72], [-32, 96], [-38, 130]], 2);
const POND = { x: -12, z: 50, r: 8 };
const HAMLET = [48, 20], FARM = [44, 62], MILL = [86, 84], SUNHILL = [-6, 88], ORCHARD = [62, -44], TOWER = [18, -80];
const STONES = [-56, -36], DENS = [-80, -72], HUNTER = [-50, -62], WALLOW = [-80, -10], HERMIT = [-90, 36], BANDIT = [-64, 74], CHAOS = [82, -62], WATERMILL = [-1, 44];
const FIELDS = [
  { x: 28, z: 86, w: 26, d: 18, rot: 0.08, kind: 'wheat', name: 'scarecrow' },
  { x: 60, z: 88, w: 24, d: 18, rot: -0.06, kind: 'wheat' },
  { x: 16, z: 60, w: 24, d: 24, rot: 0.05, kind: 'maze' },
  { x: 76, z: 50, w: 20, d: 16, rot: 0.12, kind: 'wheat' },
  { x: 82, z: 6, w: 24, d: 16, rot: -0.05, kind: 'stubble' },
  { x: 34, z: -24, w: 22, d: 16, rot: 0.3, kind: 'stubble' },
];
const fieldRect = f => S.rect(f.x, f.z, f.w, f.d, f.rot);

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 23);
  zone.bounds = { x0: -108, z0: -108, x1: 110, z1: 108 };
  const g = zone.ground = new FieldGround({
    x0: -150, z0: -150, w: 300, d: 300, res: 1, seed: 21, base: 'grass',
    layers: ['grass', 'moss', 'dirt', 'gravel', 'sand', 'mud', 'rock', 'cobble', 'flagstone'],
    ltint: { grass: [1.12, 1.1, 0.8], moss: [1.05, 1.0, 0.75], sand: [1.08, 0.9, 0.5], dirt: [0.98, 0.93, 0.86], rock: [1.02, 0.98, 0.9] },
  });
  const N = g.noise;
  const bound = S.poly(BOUND);
  // ---------------------------------------------------------------- the bridge (placed on the river, perpendicular to it)
  let bs = 0, bd = 1e9; { let acc = 0; for (let i = 0; i < RIVER.length - 1; i++) { const d = Math.hypot(RIVER[i][0] + 4.5, RIVER[i][1] - 7); if (d < bd) { bd = d; bs = acc; } acc += Math.hypot(RIVER[i + 1][0] - RIVER[i][0], RIVER[i + 1][1] - RIVER[i][1]); } }
  const bp = along(RIVER, bs), AX = [-bp.dz, bp.dx];                  // bridge axis (perpendicular to the flow)
  if (AX[0] < 0) { AX[0] = -AX[0]; AX[1] = -AX[1]; }                  // pointing east
  const BR = { x: bp.x, z: bp.z, rot: Math.atan2(-AX[1], AX[0]), half: 9.2, deckY: 1.0 };
  const bE = [BR.x + AX[0] * BR.half, BR.z + AX[1] * BR.half], bW = [BR.x - AX[0] * BR.half, BR.z - AX[1] * BR.half];
  const bE2 = [bE[0] + AX[0] * 5, bE[1] + AX[1] * 5], bW2 = [bW[0] - AX[0] * 5, bW[1] - AX[1] * 5];
  // ---------------------------------------------------------------- roads
  const ROADS = {
    main: spline([[126, 30], [104, 30], [88, 29], [72, 26], [60, 22], [48, 20], [34, 16], [22, 10], bE2, bE, bW, bW2, [-26, 0], [-30, -12], [-25, -30], [-23, -54], [-32, -76], [-41, -94], [-42, -126]], 2),
    farm: spline([[48, 22], [47, 36], [46, 50], [45, 62], [58, 70], [74, 76], [84, 80]], 2),
    orchard: spline([[52, 18], [55, 0], [58, -20], [62, -36], [62, -52], [44, -64], [28, -74], [20, -78]], 2),
    west: spline([bW2, [-34, 14], [-48, 28], [-56, 46], [-62, 62]], 2),
    mill: spline([[bE2[0] - 1, bE2[1] + 2], [8, 26], [4, 38], [WATERMILL[0] + 2, WATERMILL[1] - 2]], 2),
  };
  const TRAILS = {
    hermit: spline([[-48, 28], [-66, 32], [-82, 36]], 2),
    wallow: spline([[-30, -12], [-50, -12], [-72, -12]], 2),
    dens: spline([[-24, -52], [-40, -60], [-56, -64], [-70, -70]], 2),
    stones: spline([[-26, -32], [-40, -36]], 2),
    sun: spline([[45, 64], [30, 72], [14, 78], [2, 84]], 2),
    chaos: spline([[62, -50], [74, -58]], 2),
    tower: spline([[20, -78], [18, -80]], 2),
  };
  const roadD = new DistGrid(-150, -150, 300, 300, 1, 14);
  for (const r of Object.values(ROADS)) roadD.add(r);
  for (const r of Object.values(TRAILS)) roadD.add(r);
  const riverD = new DistGrid(-150, -150, 300, 300, 1, 34).add(RIVER);
  const pondD = (x, z) => Math.hypot(x - POND.x, z - POND.z) - POND.r;
  const chanD = (x, z) => Math.min(riverD.at(x, z), Math.max(0.01, pondD(x, z) + 4.3));
  // ---------------------------------------------------------------- terrain
  const outAmp = (x, z) => {
    const L = Math.hypot(x, z) + 1e-3, wN = smoothstep(0.2, 0.9, -z / L), wW = smoothstep(0.2, 0.9, -x / L), wE = smoothstep(0.2, 0.9, x / L), wS = smoothstep(0.2, 0.9, z / L);
    return (7 * wN + 11 * wW + 4.5 * wE - 4 * wS) / (wN + wW + wE + wS + 1e-3);
  };
  g.sculpt((x, z) => {
    let h = 1.3 + N.fbm2(x / 90, z / 90, 3) * 2.6 + N.fbm2(x / 30 + 7, z / 30, 2) * 0.6;
    h = Math.max(h, 0.2 + (h - 0.2) * 0.3);
    h += 5.2 * bump(x, z, MILL[0], MILL[1], 26) + 4.2 * bump(x, z, SUNHILL[0], SUNHILL[1], 20) + 3.4 * bump(x, z, TOWER[0], TOWER[1], 17);
    h += 1.6 * bump(x, z, ORCHARD[0], ORCHARD[1], 32) - 1.2 * bump(x, z, WALLOW[0], WALLOW[1], 22) + 1.2 * bump(x, z, DENS[0], DENS[1], 20);
    // outside the playable outline: hills (east), forest rise (north), cliffs (west), a drop (south)
    const sd = bound.sd(x, z);
    if (sd > 0) { const a = outAmp(x, z); h += a * smoothstep(0, a > 8 ? 7 : 14, sd) + (a > 0 ? smoothstep(10, 50, sd) * a * 0.6 : 0) + N.fbm2(x / 16, z / 16, 3) * smoothstep(0, 10, sd) * 1.6; }
    // river valley and channel
    const dr = riverD.at(x, z);
    h = lerp(h, 0.3 + (h - 0.3) * 0.25, smoothstep(24, 7, dr));
    const dc = Math.min(dr, Math.max(0.01, pondD(x, z) + 4.3));
    const hc = dc < 6.2 ? lerp(-3.0, 0.15, smoothstep(1.6, 6.2, dc)) : 0.15 + (dc - 6.2) * 0.4;
    h = Math.min(h, hc);
    // worn roads sit a hand lower
    h -= 0.12 * smoothstep(2.5, 0.5, roadD.at(x, z));
    return h;
  });
  const H = (x, z) => g.heightAt(x, z);
  const H0 = (x, z) => H(x, z);
  // flat pads for settlements and arenas
  const pad = (x, z, r, soft = 6, dy = 0) => g.flatten(S.circle(x, z, r), H0(x, z) + dy, soft);
  pad(HAMLET[0], HAMLET[1], 20, 8); pad(FARM[0], FARM[1] - 2, 16, 7); pad(STONES[0], STONES[1], 22, 8); pad(CHAOS[0], CHAOS[1], 13, 6);
  pad(BANDIT[0], BANDIT[1], 14, 6); pad(HERMIT[0], HERMIT[1], 7, 4); pad(HUNTER[0], HUNTER[1], 8, 4); pad(MILL[0], MILL[1], 7, 5, 0.4);
  pad(ORCHARD[0] + 8, ORCHARD[1] + 14, 6, 4); pad(WATERMILL[0] + 3, WATERMILL[1], 5, 3);
  for (const f of FIELDS) g.flatten(fieldRect(f), (x, z) => H0(f.x, f.z) * 0.6 + H0(x, z) * 0.4, 3);
  // bridge approaches rise to the deck
  for (const [ex, ez] of [bE, bW]) g.flatten(S.rect(ex + (ex - BR.x) * 0.25, ez + (ez - BR.z) * 0.25, 5.5, 5.5, BR.rot), BR.deckY + 0.08, 5);
  await tick();

  // ---------------------------------------------------------------- paint
  // meadow variation: lush moss-green hollows, drier patches, flowering clover
  for (let i = 0; i < 70; i++) { const x = rng.range(-100, 100), z = rng.range(-100, 100); g.paint(rng.chance(0.6) ? 'moss' : 'dirt', S.circle(x, z, rng.range(3, 9)), { soft: 4, noise: 3, nscale: 5, amount: rng.range(0.25, 0.55) }); }
  // outside: rock on the western cliffs, forest floor north
  g.paint('rock', { sd: (x, z) => Math.max(1 - bound.sd(x, z), x + 88), box: [-150, -150, -80, 150] }, { soft: 4, noise: 4, nscale: 6 });
  g.paint('moss', { sd: (x, z) => Math.max(2 - bound.sd(x, z), z + 85), box: [-150, -150, 150, -80] }, { soft: 5, noise: 5, nscale: 8, amount: 0.8 });
  // river: mud bed, gravel shores, reedy mud at the water's edge
  g.paint('gravel', { sd: (x, z) => chanD(x, z) - 7.2, box: [-60, -150, 80, 150] }, { soft: 1.5, noise: 1.6, nscale: 3 });
  g.paint('mud', { sd: (x, z) => chanD(x, z) - 4.6, box: [-60, -150, 80, 150] }, { soft: 1.2, noise: 1.2, nscale: 2 });
  for (let i = 0; i < 26; i++) { const p = along(RIVER, rng.range(10, 250)), side = rng.sign(); g.paint('mud', S.circle(p.x - p.dz * side * 5.2, p.z + p.dx * side * 5.2, rng.range(1.2, 2.4)), { soft: 1.2, noise: 1, nscale: 1.5, amount: 0.9 }); }
  g.info('wet', { sd: (x, z) => chanD(x, z) - 5.2, box: [-60, -150, 80, 150] }, { soft: 1.5, amount: 0.8 });
  // fields
  for (const f of FIELDS) {
    if (f.kind === 'stubble') { g.paint('dirt', fieldRect(f), { soft: 0.8, noise: 0.5, nscale: 2 }); g.paint('sand', S.rect(f.x, f.z, f.w - 1, f.d - 1, f.rot), { soft: 0.6, amount: 0.55 }); }
    else g.paint('sand', fieldRect(f), { soft: 0.7, noise: 0.4, nscale: 1.5 });
    // a dirt headland around every field
    g.paint('dirt', S.subtract(S.rect(f.x, f.z, f.w + 3, f.d + 3, f.rot), fieldRect(f)), { soft: 0.8, noise: 0.6, nscale: 2, amount: 0.7 });
  }
  // the wheat maze: corridors cut through the middle field
  const maze = FIELDS[2];
  const mazeLines = [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -4]], [[-6, -10], [-6, -2], [4, -2], [4, 6]], [[-10, 4], [-2, 4], [-2, 10]], [[4, -6], [10, -6]], [[0, -10], [0, -6]], [[-10, 0], [-6, 0]], [[-12, 0], [-10, 0]], [[10, 2], [13, 2]]];
  const mzw = (lx, lz) => { const c = Math.cos(maze.rot), s = Math.sin(maze.rot); return [maze.x + lx * c + lz * s, maze.z - lx * s + lz * c]; };
  for (const l of mazeLines) g.paint('dirt', S.line(l.map(([a, b]) => mzw(a, b)), 2.4), { soft: 0.5, noise: 0.3, nscale: 1 });
  // roads & trails
  paintPath(g, ROADS.main, 'dirt', 5.2, { wear: 0.6, noise: 1.1 });
  for (const k of ['farm', 'orchard', 'west', 'mill']) paintPath(g, ROADS[k], 'dirt', 4.0, { wear: 0.5 });
  for (const r of Object.values(TRAILS)) paintPath(g, r, 'dirt', 2.4, { wear: 0.35, amount: 0.8, noise: 1.2 });
  // settlements
  g.paint('dirt', S.circle(HAMLET[0], HAMLET[1], 17), { soft: 3, noise: 2, nscale: 3, amount: 0.5 });
  g.paint('grass', S.circle(HAMLET[0], HAMLET[1] + 1, 9.5), { soft: 1.5, noise: 1, nscale: 2 });
  g.paint('cobble', S.ring(HAMLET[0], HAMLET[1] + 1, 11.5, 3.2), { soft: 0.6, noise: 0.4, nscale: 1.5 });
  g.paint('cobble', S.circle(HAMLET[0], HAMLET[1] + 1, 2.8), { soft: 0.5 });
  g.paint('flagstone', S.rect(HAMLET[0], HAMLET[1] - 10.5, 11, 4), { soft: 0.5 });
  g.info('wear', S.ring(HAMLET[0], HAMLET[1] + 1, 11.5, 2.2), { soft: 2, amount: 0.6 });
  g.paint('dirt', S.rect(FARM[0] + 2, FARM[1] + 2, 22, 12), { soft: 2, noise: 1.5, nscale: 2 });
  g.paint('mud', S.circle(FARM[0] + 10, FARM[1] + 4, 2.5), { soft: 1.2, noise: 1, nscale: 1.5 });
  g.info('wet', S.circle(FARM[0] + 10, FARM[1] + 4, 2.5), { soft: 1, amount: 0.8, noise: 0.8, nscale: 1.2 });
  g.paint('dirt', S.circle(BANDIT[0], BANDIT[1], 13), { soft: 3, noise: 2.5, nscale: 3 });
  g.paint('mud', S.circle(BANDIT[0] + 3, BANDIT[1] + 4, 4), { soft: 2, noise: 1.5, nscale: 2, amount: 0.7 });
  for (let i = 0; i < 7; i++) { const x = WALLOW[0] + rng.range(-14, 14), z = WALLOW[1] + rng.range(-12, 12); g.paint('mud', S.circle(x, z, rng.range(1.8, 3.6)), { soft: 1.5, noise: 1.2, nscale: 1.5 }); g.info('wet', S.circle(x, z, rng.range(1.2, 2.6)), { soft: 1.2, amount: 0.9, noise: 1, nscale: 1.2 }); }
  g.paint('dirt', S.circle(WALLOW[0], WALLOW[1], 16), { soft: 5, noise: 4, nscale: 4, amount: 0.45 });
  g.paint('dirt', S.ring(STONES[0], STONES[1], 16.5, 3), { soft: 2, noise: 1.5, nscale: 2, amount: 0.55 });
  g.paint('gravel', S.circle(STONES[0], STONES[1], 3.6), { soft: 1.5, noise: 1, nscale: 1.2, amount: 0.8 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = STONES[0] + Math.cos(a) * 9, z = STONES[1] + Math.sin(a) * 9; g.paint('moss', S.circle(x, z, 2.2), { soft: 1.5, noise: 1.2, nscale: 1.5, amount: 0.6 }); }
  g.paint('gravel', S.circle(CHAOS[0], CHAOS[1], 9), { soft: 3, noise: 2.5, nscale: 2.5, amount: 0.8 });
  g.paint('dirt', S.circle(DENS[0], DENS[1], 15), { soft: 4, noise: 4, nscale: 3, amount: 0.7 });
  g.paint('gravel', S.circle(DENS[0] + 2, DENS[1] - 4, 10), { soft: 3, noise: 3, nscale: 2, amount: 0.8 });
  g.paint('dirt', S.circle(HUNTER[0], HUNTER[1], 7), { soft: 2, noise: 1.5, nscale: 2, amount: 0.8 });
  g.paint('dirt', S.circle(HERMIT[0], HERMIT[1], 6), { soft: 2, noise: 1.5, nscale: 2, amount: 0.8 });
  g.paint('gravel', S.circle(TOWER[0], TOWER[1], 7), { soft: 2.5, noise: 2, nscale: 2, amount: 0.7 });
  g.paint('dirt', S.circle(MILL[0], MILL[1], 6), { soft: 2, noise: 1.5, nscale: 2 });
  g.paint('moss', S.rect(ORCHARD[0], ORCHARD[1], 34, 26), { soft: 4, noise: 3, nscale: 4, amount: 0.6 });
  g.paint('flagstone', S.circle(WATERMILL[0] + 3, WATERMILL[1] + 1, 4), { soft: 1, noise: 0.6, nscale: 1.5, amount: 0.8 });
  // the southern drop: grassy slope with rocky breaks
  g.paint('rock', { sd: (x, z) => Math.max(6 - bound.sd(x, z), 70 - z), box: [-150, 60, 150, 150] }, { soft: 3, noise: 4, nscale: 5, amount: 0.55 });
  await tick();

  // ---------------------------------------------------------------- structures & props
  const kit = new FieldKit({ seed: 31 });
  const flags = new Flags();
  const smoke = [];
  // --- Sheafton
  const [hx, hz] = HAMLET;
  const inn = F.cottage(kit, hx, H(hx, hz - 16), hz - 16, 0, { w: 10, d: 7, h: 3.4, roof: 'tiles', roofTint: 0xa8583a, plaster: 0xf4e8d0, seed: 5, sign: 0xd8a830, porch: true, chimney: true });
  if (inn.chimney) smoke.push({ x: inn.chimney[0], y: inn.chimney[1], z: inn.chimney[2], size: 0.5, h: 7, rate: 0.7, color: 0x8a8480 });
  const homes = [[hx - 17, hz - 12, 0.25, 6.5, 5], [hx + 17, hz - 11, -0.3, 7, 5.5], [hx - 20, hz + 6, Math.PI / 2 - 0.1, 6, 5], [hx + 21, hz + 4, -Math.PI / 2 + 0.15, 6.5, 5], [hx - 12, hz + 22, 0.1, 6, 5], [hx + 14, hz + 23, -0.12, 7, 5.5], [hx + 32, hz - 8, 0.1, 6, 5]];
  homes.forEach(([x, z, rot, w, d], i) => {
    const c = F.cottage(kit, x, H(x, z), z, rot, { w, d, seed: 40 + i, roof: i % 3 === 2 ? 'tiles' : 'thatch', porch: i === 4 });
    if (c.chimney && i % 2 === 0) smoke.push({ x: c.chimney[0], y: c.chimney[1], z: c.chimney[2], size: 0.45, h: 6, rate: 0.6, color: 0x8a8480 });
  });
  P.well(kit, hx, H(hx, hz + 1), hz + 1);
  P.noticeBoard(kit, hx - 7.5, H(hx - 7.5, hz - 6), hz - 6, 0.5);
  P.stall(kit, hx + 8.5, H(hx + 8.5, hz - 4), hz - 4, -0.4, { color: 0xc06a20, goods: 'fruit', seed: 3 });
  P.stall(kit, hx + 10.5, H(hx + 10.5, hz + 5), hz + 5, -1.3, { color: 0x3a7a4a, goods: 'pots', seed: 4 });
  B.triport(kit, hx - 12, H(hx - 12, hz + 8), hz + 8);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; F.lanternPost(kit, hx + Math.cos(a) * 14, H(hx + Math.cos(a) * 14, hz + 1 + Math.sin(a) * 14), hz + 1 + Math.sin(a) * 14, -a); }
  P.bench(kit, hx - 4, H(hx - 4, hz + 7), hz + 7, Math.PI + 0.3); P.bench(kit, hx + 4.5, H(hx + 4.5, hz + 7), hz + 7, Math.PI - 0.3);
  F.woodpile(kit, hx - 22, H(hx - 22, hz - 6), hz - 6, 0.3); F.trough(kit, hx + 15, H(hx + 15, hz - 2), hz - 2, 0.4);
  for (const [x, z] of [[hx + 4, hz - 12], [hx - 5, hz - 12], [hx + 6.5, hz - 11]]) P.barrel(kit, x, H(x, z), z, 0.9, rng.range(0, 6));
  P.crateStack(kit, hx + 11, H(hx + 11, hz - 12), hz - 12, 0.2, 7);
  P.cart(kit, hx + 26, H(hx + 26, hz + 12), hz + 12, 1.2);
  for (let i = 0; i < 3; i++) P.bunting(kit, [hx - 9 + i * 7, H(hx, hz) + 4.2, hz - 12], [hx - 5 + i * 7, H(hx, hz) + 3.6, hz + 12], { sag: 0.8 });
  F.signpost(kit, hx + 16, H(hx + 16, hz + 18), hz + 18, 0, { arms: [0.2, Math.PI - 0.3] });
  // the east gate: a timber arch over the Solhaven road
  F.gatePosts(kit, flags, 103, H(103, 30), 30, { w: 8, axis: 'x', H });
  // east road: the watch post by the gate
  F.lookout(kit, 90, H(90, 38), 38, 0.2, { h: 4.5 });
  F.tent(kit, 84, H(84, 38), 38, 0.3, { color: 0x3a5a8a });
  flags.add(M(92.5, H(92, 34) + 5.8, 34), 1.2, 0.6, 0x2a5aa8, { hang: 'left' });
  kit.add('metal', cyl(0.05, 0.06, 6, 5, 1), M(92.45, H(92, 34) + 3, 34), { tint: 0x2a2a30, ao: false }); kit.block(S.circle(92.45, 34, 0.15), 0.2);
  F.dryWall(kit, [[100, 18], [100, 10], [92, 4]], H); F.dryWall(kit, [[100, 42], [99, 52], [96, 62]], H);
  // --- the stone bridge, the bridge post and the Shrine of Dawn
  const br = F.stoneBridge(kit, BR.x, BR.z, BR.rot, { len: 14, w: 4.6, deckY: BR.deckY, bedY: -2.3, arches: 2, seed: 3 });
  zone.deck(br.deck, br.y);
  const bpx = bE2[0] + 4, bpz = bE2[1] + 8;
  F.tent(kit, bpx + 2, H(bpx + 2, bpz + 2), bpz + 2, -0.4, { color: 0x3a5a8a });
  P.weaponRack(kit, bpx - 2.5, H(bpx - 2.5, bpz + 3.5), bpz + 3.5, 0.2);
  for (let i = 0; i < 3; i++) P.barrel(kit, bpx + 4.5 + i * 0.8, H(bpx + 4.5, bpz - 1), bpz - 1 + (i % 2) * 0.6, 0.9, i);
  flags.add(M(bpx - 0.2, H(bpx, bpz) + 4.6, bpz - 1.5), 1.1, 0.55, 0x2a5aa8, { hang: 'left' });
  kit.add('metal', cyl(0.05, 0.06, 5, 5, 1), M(bpx - 0.25, H(bpx, bpz) + 2.4, bpz - 1.5), { tint: 0x2a2a30, ao: false }); kit.block(S.circle(bpx - 0.25, bpz - 1.5, 0.15), 0.2);
  const shr = [bE2[0] + 6, bE2[1] - 6];
  F.shrine(kit, shr[0], H(shr[0], shr[1]), shr[1], -0.2);
  F.signpost(kit, bE2[0] + 3, H(bE2[0] + 3, bE2[1] - 3.5), bE2[1] - 3.5, 0, { arms: [0.3, Math.PI - 0.4, -1.4] });
  // --- the millpond and watermill
  const [wmx, wmz] = WATERMILL;
  const wm = F.cottage(kit, wmx + 5, H(wmx + 5, wmz), wmz, -Math.PI / 2 + 0.3, { w: 6.5, d: 5.5, seed: 77, roof: 'tiles', roofTint: 0x8a5a44, chimney: true });
  if (wm.chimney) smoke.push({ x: wm.chimney[0], y: wm.chimney[1], z: wm.chimney[2], size: 0.45, h: 6, rate: 0.6, color: 0x8a8480 });
  const wheel = kit.part('planks'), wheelC = new THREE.Vector3(wmx + 1.2, WL + 1.6, wmz + 1.4);
  { const R = 2.0; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; wheel.add(box(0.08, 0.9, 1.3, 1), M(Math.cos(a) * R, Math.sin(a) * R, 0, 0, 1, 1, 1, 0, a), 0x7a5634); wheel.add(box(0.07, R * 2, 0.08, 1), M(0, 0, 0.55, 0, 1, 1, 1, 0, a / 2), 0x6a4a30); wheel.add(box(0.07, R * 2, 0.08, 1), M(0, 0, -0.55, 0, 1, 1, 1, 0, a / 2), 0x6a4a30); } for (const s of [-1, 1]) { const tor = new THREE.TorusGeometry(R, 0.08, 5, 24); wheel.add(tor, M(0, 0, s * 0.6), 0x5a3c26); } wheel.add(cyl(0.2, 0.2, 1.6, 8, 1), M(0, 0, 0, 0, 1, 1, 1, Math.PI / 2), 0x3a2a1a); }
  const wheelMesh = wheel.build(); const wheelG = new THREE.Group(); wheelG.add(wheelMesh); wheelG.position.copy(wheelC); wheelG.rotation.y = -Math.PI / 2 + 0.3;
  kit.add('planks', box(4, 0.2, 3.4, 1.5), M(wmx + 0.4, WL + 1.0, wmz - 2.8, 0.3), { tint: 0x9a7a54, ao: false }); zone.deck(S.rect(wmx + 0.4, wmz - 2.8, 4, 3.4, 0.3), WL + 1.1);
  for (const [dx, dz] of [[-1.8, -1.5], [1.8, -1.5], [-1.8, 1.5], [1.8, 1.5]]) kit.add('timber', cyl(0.12, 0.12, 2.6, 6, 1), M(wmx + 0.4 + dx, WL - 0.2, wmz - 2.8 + dz), { tint: 0x5a4028, ao: false });
  // --- Hale Farm
  const [fx, fz] = FARM;
  const fh = F.cottage(kit, fx - 7, H(fx - 7, fz - 6), fz - 6, 0.05, { w: 9, d: 6.5, h: 3.3, seed: 12, roof: 'thatch', porch: true, chimney: true, shutter: 0x3a5a8a });
  if (fh.chimney) smoke.push({ x: fh.chimney[0], y: fh.chimney[1], z: fh.chimney[2], size: 0.5, h: 7, rate: 0.7, color: 0x8a8480 });
  F.barn(kit, fx + 12, H(fx + 12, fz - 6), fz - 6, -0.08, { seed: 2 });
  F.cottage(kit, fx - 18, H(fx - 18, fz + 4), fz + 4, Math.PI / 2, { w: 4, d: 3.4, h: 2.4, seed: 91, noDoor: false, chimney: false, roof: 'thatch' }); // coop
  P.well(kit, fx + 2, H(fx + 2, fz + 5), fz + 5);
  for (const [x, z, r] of [[fx + 20, fz + 2, 0.4], [fx + 22, fz + 5, 1.2], [fx + 6, fz + 10, 0.1]]) F.hayBale(kit, x, H(x, z), z, r);
  F.haystack(kit, fx + 24, H(fx + 24, fz - 12), fz - 12, 1);
  F.woodpile(kit, fx - 13, H(fx - 13, fz - 7), fz - 7, Math.PI / 2);
  F.trough(kit, fx + 14, H(fx + 14, fz + 3), fz + 3, 0.1);
  for (let i = 0; i < 9; i++) { const x = fx - 12 + (i % 3) * 1.3, z = fz + 3 + Math.floor(i / 3) * 1.2; F.pumpkin(kit, x, H(x, z), z, rng.range(0.8, 1.3)); }
  F.railFence(kit, [[fx - 15, fz + 1], [fx - 9, fz + 1], [fx - 9, fz + 7.5], [fx - 15, fz + 7.5], [fx - 15, fz + 1]], H, { gaps: [[fx - 9, fz + 4, 1.2]] });
  F.railFence(kit, [[fx + 18, fz + 8], [fx + 34, fz + 8], [fx + 36, fz - 8], [fx + 22, fz - 12]], H, { gaps: [[fx + 25, fz + 8, 1.5]] });
  const wagon = [fx - 2, fz + 18];
  F.hayWagon(kit, wagon[0], H(wagon[0], wagon[1]), wagon[1], 0.9);
  F.signpost(kit, fx + 3, H(fx + 3, fz - 16), fz - 16, 0, { arms: [0.2, -1.2] });
  // fields: scarecrows, stubble bales & stacks, hedges of stone around the wheat
  const sc = FIELDS[0];
  const scPts = [[-6, -2], [7, 3]].map(([a, b]) => { const c = Math.cos(sc.rot), s = Math.sin(sc.rot); return [sc.x + a * c + b * s, sc.z - a * s + b * c]; });
  scPts.forEach(([x, z], i) => F.scarecrow(kit, x, H(x, z), z, 0.2 - i * 0.5, { seed: i, shirt: i ? 0x3a5a7a : 0x8a4a3a }));
  F.scarecrow(kit, mzw(0, 0)[0], H(...mzw(0, 0)), mzw(0, 0)[1], 0, { seed: 5, hat: 0x3a2a1a, shirt: 0x6a3a6a });
  for (const f of FIELDS.filter(f => f.kind === 'stubble')) {
    for (let i = 0; i < 5; i++) { const c = Math.cos(f.rot), s = Math.sin(f.rot), a = rng.range(-f.w / 2 + 2, f.w / 2 - 2), b = rng.range(-f.d / 2 + 2, f.d / 2 - 2), x = f.x + a * c + b * s, z = f.z - a * s + b * c; F.hayBale(kit, x, H(x, z), z, rng.range(0, 3)); }
    F.haystack(kit, f.x + 4, H(f.x + 4, f.z - 3), f.z - 3, 0.9);
  }
  for (const f of FIELDS.filter(f => f.kind !== 'stubble')) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot), W2 = f.w / 2 + 1.2, D2 = f.d / 2 + 1.2;
    const cr = [[-W2, -D2], [W2, -D2], [W2, D2], [-W2, D2], [-W2, -D2]].map(([a, b]) => [f.x + a * c + b * s, f.z - a * s + b * c]);
    const gaps = [[f.x + 0 * c + D2 * s, f.z + D2 * c, 2.4], [f.x + (-W2) * c, f.z + W2 * s, 2.2], [f.x + W2 * c, f.z - W2 * s, 2.2], [f.x - D2 * s, f.z - D2 * c, 2.4]];
    F.dryWall(kit, cr, H, { gaps, seed: Math.round(f.x) });
  }
  // --- Windmill Hill
  const wmill = F.windmill(kit, MILL[0], H(MILL[0], MILL[1]), MILL[1], 0, { h: 9 });
  F.hayBale(kit, MILL[0] - 5, H(MILL[0] - 5, MILL[1] + 3), MILL[1] + 3, 0.6, { round: false });
  for (let i = 0; i < 4; i++) P.sack(kit, MILL[0] + 3.4 + (i % 2) * 0.6, H(MILL[0] + 3.4, MILL[1] + 3), MILL[1] + 3 + Math.floor(i / 2) * 0.6, 1, i, 0xe8dcc0);
  P.cart(kit, MILL[0] + 6, H(MILL[0] + 6, MILL[1] + 1), MILL[1] + 1, -0.6, { load: 0xe8dcc0 });
  // --- Beehive Orchard
  const [ox, oz] = ORCHARD, orchardTrees = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = ox - 15 + c * 6 + (r % 2) * 1.5, z = oz - 10 + r * 6.5; if (Math.hypot(x - ox - 8, z - oz - 14) < 5) continue; orchardTrees.push([x, z]); }
  for (let i = 0; i < 9; i++) { const [x, z] = orchardTrees[(i * 5 + 2) % orchardTrees.length]; F.beehive(kit, x + 2.2, H(x + 2.2, z + 1.8), z + 1.8); }
  F.cottage(kit, ox + 8, H(ox + 8, oz + 14), oz + 14, -0.2, { w: 4.5, d: 3.6, h: 2.6, seed: 55, chimney: false, roof: 'tiles', roofTint: 0x8a5a3a }); // beekeeper's shed
  for (let i = 0; i < 5; i++) { const x = ox + 3 + i * 0.7, z = oz + 17.5; F.pumpkin(kit, x, H(x, z), z, 0.6); }
  kit.add('timber', box(0.12, 3.2, 0.5, 1), M(ox - 3, H(ox - 3, oz + 3) + 1.4, oz + 3, 0.3, 1, 1, 1, 0.25), { tint: 0x8a6a48 }); // ladder
  // --- Old Watchtower
  F.ruinTower(kit, TOWER[0], H(TOWER[0], TOWER[1]), TOWER[1], { r: 2.8, h: 8, seed: 4 });
  const plaque = [TOWER[0] + 4.5, TOWER[1] + 3.5]; F.standingStone(kit, plaque[0], H(...plaque), plaque[1], { h: 1.4, w: 0.9, rot: 0.3, tint: 0x9a9284 });
  // --- Ember Clearing (chaos gate): scorched earth, a cracked monolith
  F.standingStone(kit, CHAOS[0] + 1, H(CHAOS[0] + 1, CHAOS[1] - 7), CHAOS[1] - 7, { h: 3.6, w: 1.4, tint: 0x4a4440, glyph: 0xc050ff });
  F.rockCluster(kit, CHAOS[0] - 9, CHAOS[1] - 4, H, { n: 3, s: 0.8, seed: 9, tint: 0x6a6460 });
  // --- Standing Stones (field boss arena)
  const [sx0, sz0] = STONES;
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + 0.2, x = sx0 + Math.cos(a) * 19.5, z = sz0 + Math.sin(a) * 19.5; if (i === 3) { F.rockCluster(kit, x, z, H, { n: 2, s: 0.7, seed: 30 + i }); continue; } F.standingStone(kit, x, H(x, z), z, { h: rng.range(2.8, 4.2), w: rng.range(1.1, 1.5), rot: -a + Math.PI / 2, lean: i === 7 ? 0.25 : 0 }); }
  F.dolmen(kit, sx0, H(sx0, sz0), sz0, 0.0, { s: 1.1, glyph: 0xffd070 });
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4, d = rng.range(7, 13), x = sx0 + Math.cos(a) * d, z = sz0 + Math.sin(a) * d; F.rock(kit, x, H(x, z), z, { s: rng.range(0.35, 0.55), seed: 60 + i, tint: 0xa8a092, block: false }); }
  // --- Wolf Dens: rock outcrops with cave mouths under the western cliffs, bones
  const [dx0, dz0] = DENS;
  const denFace = [[dx0 - 18, dz0 + 8], [dx0 - 16, dz0 - 6], [dx0 - 8, dz0 - 14], [dx0 + 4, dz0 - 16], [dx0 + 16, dz0 - 13], [dx0 + 26, dz0 - 16]];
  F.cliffEdge(kit, denFace, H, { height: 6.5, thick: 5, seed: 14, inside: [dx0 + 2, dz0 + 6], tint: 0xa09684, strata: 0x857a6a, top: 0x6a7a3a, lean: 0.25 });
  for (const [x, z, rot, s] of [[dx0 - 7.5, dz0 - 10.4, 0.25, 1.3], [dx0 + 5, dz0 - 12.8, -0.1, 1.1]]) { kit.add('paint', blob(1.0, 1, null, [1.3 * s, 1.1 * s, 0.5]), M(x, H(x, z) + 0.9 * s, z, rot), { tint: 0x0e0b0a, ao: false, cast: false }); kit.add('rock', blob(0.5, 0, null, [1.6 * s, 0.35, 0.8]), M(x, H(x, z) + 2.0 * s, z + 0.45, rot), { tint: 0x9a9080, ao: false }); }
  for (const [x, z, s] of [[dx0 - 9, dz0 - 5, 1.8], [dx0 + 9, dz0 - 7, 1.6], [dx0 - 13, dz0 + 5, 1.5], [dx0 + 13, dz0 + 1, 1.2], [dx0 - 3, dz0 + 11, 1.0], [dx0 + 3, dz0 - 9, 0.9]]) F.rockCluster(kit, x, z, H, { n: 3, s, seed: Math.round(x * z), tint: 0x9e9686, moss: 0x7a8a4a, spread: 1.2 });
  for (let i = 0; i < 6; i++) { const x = dx0 + rng.range(-8, 10), z = dz0 + rng.range(-2, 10); kit.add('bone', blob(0.12, 0, null, [3.2, 0.6, 0.8]), M(x, H(x, z) + 0.05, z, rng.range(0, 6)), { tint: 0xe8dcc0, ao: false, cast: false }); }
  // hunter's camp
  const [hux, huz] = HUNTER;
  F.tent(kit, hux - 2, H(hux - 2, huz - 2), huz - 2, 0.4, { color: 0x7a6a4a });
  const hf = F.campfire(kit, hux + 2, H(hux + 2, huz + 1.5), huz + 1.5, { seed: 3 }); smoke.push({ x: hf.x, y: hf.y, z: hf.z, size: 0.4, h: 5, rate: 1, color: 0x6a6460, glow: 0x8a3a10 });
  for (let i = 0; i < 2; i++) { const x = hux + 5 + i * 1.6, z = huz - 3; kit.add('timber', box(0.08, 1.8, 0.08, 1), M(x - 0.6, H(x, z) + 0.9, z), { tint: 0x6a4a30 }); kit.add('timber', box(0.08, 1.8, 0.08, 1), M(x + 0.6, H(x, z) + 0.9, z), { tint: 0x6a4a30 }); kit.add('timber', box(1.4, 0.06, 0.06, 1), M(x, H(x, z) + 1.75, z), { tint: 0x6a4a30, ao: false }); kit.add('cloth', box(1.0, 1.0, 0.03, 1), M(x, H(x, z) + 1.2, z, 0, 1, 1, 1, 0.1), { tint: 0x8a5a3a, ao: false }); kit.block(S.rect(x, z, 1.4, 0.3), 0.2); }
  // --- Boar Wallows: broken pasture fences, a tipped cart
  F.railFence(kit, [[WALLOW[0] - 14, WALLOW[1] - 12], [WALLOW[0] - 2, WALLOW[1] - 14], [WALLOW[0] + 10, WALLOW[1] - 10]], H, { gaps: [[WALLOW[0] - 6, WALLOW[1] - 13, 2.5]] });
  F.railFence(kit, [[WALLOW[0] + 12, WALLOW[1] + 4], [WALLOW[0] + 8, WALLOW[1] + 14]], H);
  kit.add('planks', box(1.6, 0.4, 2.6, 1), M(WALLOW[0] + 7, H(WALLOW[0] + 7, WALLOW[1] + 2) + 0.8, WALLOW[1] + 2, 0.6, 1, 1, 1, 0, 1.2), { tint: 0x8a6440 }); kit.block(S.rect(WALLOW[0] + 7, WALLOW[1] + 2, 1.6, 2.6, 0.6), 0.3);
  // --- Hermit's Hollow
  const hh = F.cottage(kit, HERMIT[0], H(HERMIT[0], HERMIT[1]), HERMIT[1], 0.35, { w: 4.8, d: 4.2, h: 2.6, seed: 66, roof: 'thatch', roofTint: 0x9a8a58, chimney: true, plaster: 0xd8ccb0 });
  if (hh.chimney) smoke.push({ x: hh.chimney[0], y: hh.chimney[1], z: hh.chimney[2], size: 0.4, h: 5, rate: 0.5, color: 0x8a8480 });
  F.woodpile(kit, HERMIT[0] + 4, H(HERMIT[0] + 4, HERMIT[1] + 1), HERMIT[1] + 1, 0.4, { n: 3 });
  for (let i = 0; i < 4; i++) P.pot(kit, HERMIT[0] - 3 + i * 0.5, H(HERMIT[0] - 3, HERMIT[1] + 3), HERMIT[1] + 3, 0.8, [0xb8683a, 0x8a5a3a][i % 2]);
  // --- Bandit Camp: palisade ring with two gaps, tents, lookout, campfire, stolen goods
  const [bx0, bz0] = BANDIT;
  const ring = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; ring.push([bx0 + Math.cos(a) * 12.5, bz0 + Math.sin(a) * 11]); }
  F.palisade(kit, ring, H, { h: 3.2, gaps: [[bx0 + 5, bz0 - 10, 3.2], [bx0 + 12.5, bz0 + 1, 2.8]], seed: 2 });
  const bf = F.campfire(kit, bx0, H(bx0, bz0), bz0, { seed: 7 }); smoke.push({ x: bf.x, y: bf.y, z: bf.z, size: 0.5, h: 6, rate: 1, color: 0x5a5450, glow: 0x8a3a10 });
  for (const [x, z, r, c] of [[bx0 - 6, bz0 - 5, 0.4, 0x8a6a4a], [bx0 - 7, bz0 + 4, 1.2, 0x7a3a2a], [bx0 + 4, bz0 + 6, -0.3, 0x6a5a3a]]) F.tent(kit, x, H(x, z), z, r, { color: c, patch: 0x4a3a2a });
  F.lookout(kit, bx0 + 7, H(bx0 + 7, bz0 - 5), bz0 - 5, 0.3, { h: 4.2, roof: false });
  for (let i = 0; i < 4; i++) P.crateStack(kit, bx0 - 2 + i * 1.8, H(bx0, bz0 + 7), bz0 + 7.5 + (i % 2) * 0.5, rng.range(-0.3, 0.3), 90 + i);
  P.weaponRack(kit, bx0 - 9, H(bx0 - 9, bz0 - 1), bz0 - 1, Math.PI / 2);
  flags.add(M(bx0 + 7.1, H(bx0 + 7, bz0 - 5) + 7.2, bz0 - 5), 1.4, 0.8, 0x2a2a2a, { hang: 'left' });
  kit.add('timber', cyl(0.05, 0.06, 3.4, 5, 1), M(bx0 + 7.05, H(bx0 + 7, bz0 - 5) + 5.8, bz0 - 5), { tint: 0x5a4028, ao: false });
  // --- roadside dressing: signposts, lantern posts along the main road, milestones, carts
  F.signpost(kit, -27, H(-27, -4), -4, 0, { arms: [0.8, -0.4, Math.PI] });
  F.signpost(kit, -37.5, H(-37.5, -100), -100, 0, { arms: [1.2, -0.3] });
  F.signpost(kit, -46, H(-46, 24), 24, 0, { arms: [2.2, -0.9] });
  const gateN = [-42, -106];
  for (const s of [-1, 1]) { F.standingStone(kit, gateN[0] + s * 4.2, H(gateN[0] + s * 4.2, gateN[1] + 3), gateN[1] + 3, { h: 2.4, w: 1.0, tint: 0x7a7468, glyph: 0x60e0a0 }); }
  for (let s = 20; s < 300; s += 34) { const p = along(ROADS.main, s), side = (Math.round(s / 34) % 2) ? 1 : -1, x = p.x - p.dz * 3.6 * side, z = p.z + p.dx * 3.6 * side; if (bound.sd(x, z) > -3 || Math.hypot(x - hx, z - hz) < 20 || riverD.at(x, z) < 9) continue; F.lanternPost(kit, x, H(x, z), z, Math.atan2(p.dz, -p.dx) * 0); }
  // --- scatter: boulders, stumps, logs in the meadows
  const exclude = [[hx, hz, 26], [FARM[0], FARM[1], 22], [STONES[0], STONES[1], 24], [CHAOS[0], CHAOS[1], 13], [BANDIT[0], BANDIT[1], 15], [HERMIT[0], HERMIT[1], 7], [HUNTER[0], HUNTER[1], 8], [MILL[0], MILL[1], 8], [TOWER[0], TOWER[1], 6], [WATERMILL[0], WATERMILL[1], 8], [BR.x, BR.z, 14], [shr[0], shr[1], 4]];
  const inField = (x, z, pad = 1.5) => FIELDS.some(f => fieldRect(f).sd(x, z) < pad);
  const free = (x, z, rr = 3, road = 4) => bound.sd(x, z) < -rr && roadD.at(x, z) > road && chanD(x, z) > 7 && !exclude.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er + rr) && !inField(x, z, rr);
  for (const [x, z] of scatter(rng, [-100, -100, 104, 104], 16, 260, (x, z) => free(x, z, 2, 3.5) && rng.chance(0.55))) {
    if (rng.chance(0.55)) F.rockCluster(kit, x, z, H, { n: rng.int(1, 3), s: rng.range(0.5, 1.1), seed: Math.round(x * 31 + z) });
    else if (rng.chance(0.5)) F.stump(kit, x, H(x, z), z, { r: rng.range(0.35, 0.55), seed: Math.round(x + z * 7) });
    else F.log(kit, x, H(x, z), z, rng.range(0, 3), { len: rng.range(3, 5), r: rng.range(0.28, 0.4) });
  }
  // western cliff face + boulders along the north & south rims
  const westCliff = BOUND.slice(31).concat(BOUND.slice(0, 3)).map(([x, z]) => [x - 3, z]);
  F.cliffEdge(kit, westCliff, H, { height: 9, thick: 6, seed: 5, inside: [0, 0], tint: 0x9a8e7c, strata: 0x7a6e60, top: 0x6a7a34 });
  for (let i = 3; i < 13; i++) { const [x, z] = BOUND[i]; F.rockCluster(kit, x, z - 2, H, { n: 3, s: rng.range(1.0, 1.8), seed: 100 + i, tint: 0x8a8272 }); }
  for (let i = 21; i < 30; i++) { const [x, z] = BOUND[i]; F.rockCluster(kit, x, z + 3, H, { n: 2, s: rng.range(0.9, 1.5), seed: 200 + i, tint: 0x9a9080, block: false }); }
  // contact shadows at the foot of everything that blocks
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  zone.root.add(wmill.sails, wheelG);
  await tick();

  // ---------------------------------------------------------------- water
  const river = buildWater(g, { x: 13, z: 0, w: 110, d: 262, level: WL, shallow: 0x4a8c70, deep: 0x163e44, sky: 0x9ab8c8, swell: 0.02, foam: 0.35 });
  zone.root.add(river);

  // ---------------------------------------------------------------- foliage
  const flora = new FieldFlora();
  const T = (sp, x, z, o = {}) => flora.tree(sp, x, H(x, z) - 0.1, z, { rot: rng.range(0, 6.28), ...o });
  // meadow oaks and groves
  for (const [x, z] of scatter(rng, [-98, -98, 102, 102], 22, 300, (x, z) => free(x, z, 4, 6) && rng.chance(0.45))) T(rng.chance(0.8) ? 'oak' : 'autumn', x, z, { s: rng.range(0.9, 1.25), variant: rng.int(0, 1) });
  for (const [gx, gz, n] of [[-70, 10, 6], [-40, 60, 5], [30, -50, 5], [80, -20, 4], [-78, -44, 5], [-20, -76, 5]]) for (let i = 0; i < n; i++) { const x = gx + rng.range(-9, 9), z = gz + rng.range(-9, 9); if (free(x, z, 2.5, 4)) T(rng.chance(0.7) ? 'oak' : 'poplar', x, z, { s: rng.range(0.85, 1.15), variant: rng.int(0, 1) }); }
  // poplars along the main road near Sheafton and the farm lane
  for (let s = 30; s < 110; s += 7) { const p = along(ROADS.main, s); for (const side of [-1, 1]) { const x = p.x - p.dz * 5.2 * side, z = p.z + p.dx * 5.2 * side; if (Math.hypot(x - hx, z - hz) > 21 && bound.sd(x, z) < -4 && !inField(x, z, 1)) T('poplar', x, z, { s: rng.range(0.8, 0.95), variant: side > 0 ? 0 : 1, br: 0.4 }); } }
  // orchard
  for (const [x, z] of orchardTrees) T('apple', x, z, { s: rng.range(0.9, 1.1), variant: rng.int(0, 1) });
  // willows along the river
  for (let s = 12; s < 250; s += 13) { const p = along(RIVER, s + rng.range(-3, 3)), side = rng.sign(), x = p.x - p.dz * 7.5 * side, z = p.z + p.dx * 7.5 * side; if (bound.sd(x, z) < -3 && roadD.at(x, z) > 5 && Math.hypot(x - BR.x, z - BR.z) > 13 && Math.hypot(x - WATERMILL[0], z - WATERMILL[1]) > 9 && rng.chance(0.6)) T('willow', x, z, { s: rng.range(0.9, 1.15), variant: rng.int(0, 1) }); }
  // hamlet green oak + garden trees
  T('oak', hx - 6, hz - 3.5, { s: 0.8, variant: 0 });
  T('apple', FARM[0] - 22, FARM[1] - 4, { s: 1.0 }); T('apple', FARM[0] - 23, FARM[1] + 10, { s: 0.9, variant: 1 });
  // outside the outline: dense firs north (Thornwood's edge), pines on the western cliffs, oaks east & south
  for (const [x, z] of scatter(rng, [-150, -150, 150, 150], 5.5, 3200, (x, z) => { const sd = bound.sd(x, z); return sd > 2.5 && sd < 34 && riverD.at(x, z) > 9 && roadD.at(x, z) > 5; })) {
    const north = z < -70, west = x < -90;
    if (north) T(rng.chance(0.75) ? 'fir' : 'pine', x, z, { s: rng.range(0.95, 1.35), variant: rng.int(0, 1), block: false });
    else if (west) T(rng.chance(0.8) ? 'pine' : 'fir', x, z, { s: rng.range(0.9, 1.25), variant: rng.int(0, 1), block: false });
    else if (rng.chance(0.55)) T(rng.chance(0.75) ? 'oak' : 'autumn', x, z, { s: rng.range(0.9, 1.3), variant: rng.int(0, 1), block: false });
  }
  // hedgerow bushes along field walls and the southern rim
  for (const f of FIELDS) { const c = Math.cos(f.rot), s = Math.sin(f.rot); for (let i = 0; i < 6; i++) { const a = rng.range(-f.w / 2, f.w / 2), b = (rng.chance(0.5) ? -1 : 1) * (f.d / 2 + 2.6), x = f.x + a * c + b * s, z = f.z - a * s + b * c; if (roadD.at(x, z) > 3) T('bush', x, z, { s: rng.range(0.8, 1.2), variant: rng.int(0, 2) }); } }
  for (const [x, z] of scatter(rng, [-100, -100, 104, 104], 9, 500, (x, z) => free(x, z, 1.2, 3) && rng.chance(0.4))) T('bush', x, z, { s: rng.range(0.7, 1.2), variant: rng.int(0, 2) });
  // wildflowers: drifts of colour in the meadows
  const FL = [0xffffff, 0xf4d040, 0xe04040, 0xa070e0, 0xffa0c0, 0xf8f0a0];
  for (const [x, z] of scatter(rng, [-100, -100, 104, 104], 2.6, 3400, (x, z) => free(x, z, 0.5, 2.8) && N.noise2(x / 18, z / 18) > 0.1)) flora.flower(x, H(x, z), z, FL[(Math.floor(N.noise2(x / 9 + 3, z / 9) * 3 + 3) + (rng.chance(0.2) ? 1 : 0)) % FL.length], { s: rng.range(0.8, 1.3) });
  // tall grass clumps with seed heads, thicker in the lush hollows
  const tgM = flora.mats.flower;
  for (const [x, z] of scatter(rng, [-100, -100, 104, 104], 2.2, 8000, (x, z) => free(x, z, 0.4, 2.6) && (N.noise2(x / 14 + 5, z / 14) > -0.05 || rng.chance(0.25)))) flora.thing('tallgrass' + (Math.round(x * 7 + z) & 3), () => tallGrassGeo(Math.round(x * 7 + z) & 3, { h: 0.75 + (Math.round(x * 7 + z) & 3) * 0.08 }), tgM, x, H(x, z) - 0.03, z, { s: rng.range(0.8, 1.25), rot: rng.range(0, 6.28), cast: false });
  // a dark wall of firs where the Thornwood road leaves
  for (let i = 0; i < 26; i++) { const x = -42 + rng.range(-22, 22), z = -108 - rng.range(0, 16); if (Math.abs(x + 42) > 3.4 + (z + 108) * -0.1) T(rng.chance(0.7) ? 'fir' : 'pine', x, z, { s: rng.range(1.0, 1.4), variant: rng.int(0, 1), block: false }); }
  // the Standing Stones: a fairy ring of toadstools and a drift of white flowers inside the circle
  { const mg = () => mushroomGeo({ h: 0.26, r: 0.16, cap: 0xd8c8a0, spots: 0xfff8e8, seed: 3, spotN: 0, sway: 0.02 }); for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rng.range(-0.05, 0.05), d = 13 + rng.range(-0.4, 0.4), x = STONES[0] + Math.cos(a) * d, z = STONES[1] + Math.sin(a) * d; flora.thing('fairy', mg, flora.mats.flower, x, H(x, z) - 0.02, z, { s: rng.range(0.7, 1.3), rot: rng.range(0, 6), cast: false }); } }
  for (let i = 0; i < 70; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * 11 + 3, x = STONES[0] + Math.cos(a) * d, z = STONES[1] + Math.sin(a) * d; flora.flower(x, H(x, z), z, rng.chance(0.7) ? 0xffffff : 0xf8f0a0, { s: rng.range(0.9, 1.4) }); }
  // Sunflower Hill: every head faces the camera (south)
  const sunMat = flora.mats.flower;
  for (const [x, z] of scatter(rng, [SUNHILL[0] - 20, SUNHILL[1] - 18, SUNHILL[0] + 20, SUNHILL[1] + 16], 1.3, 2400, (x, z) => Math.hypot(x - SUNHILL[0], (z - SUNHILL[1]) * 1.1) < 17 && bound.sd(x, z) < -2 && roadD.at(x, z) > 1.8 && Math.hypot(x - SUNHILL[0], z - SUNHILL[1]) > 2.6)) flora.thing('sunflower' + (Math.round(x * 3) & 1), () => sunflowerGeo(Math.round(x * 3) & 1), sunMat, x, H(x, z) - 0.05, z, { s: rng.range(0.85, 1.12), rot: rng.range(-0.25, 0.25), cast: true });
  // reeds along the waterline and in the wallows
  const reedM = flora.mats.flower;
  for (let s2 = 0; s2 < 262; s2 += 0.9) { const p = along(RIVER, s2); for (const side of [-1, 1]) { if (rng.chance(0.45)) continue; const d = rng.range(3.6, 5.4), x = p.x - p.dz * d * side, z = p.z + p.dx * d * side; if (bound.sd(x, z) > 4 || Math.hypot(x - BR.x, z - BR.z) < 9 || roadD.at(x, z) < 2.5) continue; flora.thing('reed' + (Math.round(s2) % 3), () => reedGeo(Math.round(s2) % 3), reedM, x, H(x, z) - 0.05, z, { s: rng.range(0.7, 1.15), rot: rng.range(0, 6.28), cast: false }); } }
  for (let i = 0; i < 70; i++) { const a = rng.range(0, 6.28), d = POND.r + rng.range(-0.6, 1.4), x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d; if (Math.hypot(x - WATERMILL[0], z - WATERMILL[1]) > 6) flora.thing('reed' + (i % 3), () => reedGeo(i % 3), reedM, x, H(x, z) - 0.05, z, { s: rng.range(0.7, 1.1), rot: rng.range(0, 6.28), cast: false }); }
  for (let i = 0; i < 40; i++) { const x = WALLOW[0] + rng.range(-15, 15), z = WALLOW[1] + rng.range(-13, 13); if (g.weight('mud', x, z) > 0.4 && rng.chance(0.6)) flora.thing('reed' + (i % 3), () => reedGeo(i % 3), reedM, x, H(x, z) - 0.05, z, { s: rng.range(0.6, 0.9), rot: rng.range(0, 6.28), cast: false }); }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new FieldGrass(g, { layer: 'grass', shape: 'grass', density: quality, height: 1.15 });
  const wheat = new FieldGrass(g, { layer: 'sand', shape: 'wheat', w: 42, d: 36, density: Math.min(1, quality * 1.1), height: 1.12, spacing: 0.36, colors: [0x7a6a28, 0xc8a444, 0xffd66a], layerMix: 0.15, threshold: [0.55, 0.85], push: 0.8, sway: 0.25, scaleVar: [0.85, 1.15] });
  for (const gr of [grass, wheat]) zone.root.add(gr.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  const sprinkle = (kind, n, cx, cz, r, o = {}) => { for (let i = 0; i < n; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; dec.add(kind, x, z, { size: rng.range(o.s0 ?? 1, o.s1 ?? 2.2), alpha: o.a ?? 0.8, tint: o.tint ?? 0xffffff }); } };
  sprinkle('straw', 26, FARM[0] + 2, FARM[1] + 2, 12, { s0: 1.2, s1: 2.4 }); sprinkle('straw', 10, MILL[0], MILL[1] + 2, 5);
  for (const f of FIELDS.filter(f => f.kind === 'stubble')) sprinkle('straw', 20, f.x, f.z, Math.min(f.w, f.d) / 2, { s0: 1.4, s1: 2.8, a: 0.9 });
  sprinkle('pebbles', 30, hx, hz, 16, { a: 0.6 }); sprinkle('leaves', 12, hx - 6, hz - 3.5, 4, { tint: 0x9a8a60 });
  sprinkle('leaves', 40, ORCHARD[0], ORCHARD[1], 16, { tint: 0xa89a60 }); sprinkle('petals', 20, ORCHARD[0], ORCHARD[1], 16, { s0: 0.8, s1: 1.6 });
  sprinkle('scorch', 10, BANDIT[0], BANDIT[1], 9, { s0: 1.2, s1: 2.6, a: 0.6 }); sprinkle('stain', 10, BANDIT[0], BANDIT[1], 10, { s0: 1.5, s1: 3 });
  sprinkle('puddle', 14, WALLOW[0], WALLOW[1], 13, { s0: 1.5, s1: 3.2 }); sprinkle('stain', 12, WALLOW[0], WALLOW[1], 14, { s0: 2, s1: 3.5, a: 0.6 });
  sprinkle('rubble', 12, TOWER[0], TOWER[1], 6, { s0: 1, s1: 2 });
  sprinkle('scorch', 8, CHAOS[0], CHAOS[1], 8, { s0: 2, s1: 4, a: 0.7 }); sprinkle('cracks', 6, CHAOS[0], CHAOS[1], 6, { s0: 1.5, s1: 3 });
  dec.add('runes', CHAOS[0], CHAOS[1], { size: 8, tint: 0xa060ff, emit: 0x8040ff, emitI: 0.9, alpha: 0.55 });
  dec.add('runes', STONES[0], STONES[1], { size: 6.5, tint: 0xe0d0a0, alpha: 0.5 });
  sprinkle('pebbles', 16, DENS[0], DENS[1], 12); sprinkle('blood', 4, DENS[0] + 2, DENS[1] + 2, 6, { a: 0.5 });
  for (let s = 5; s < 330; s += 9) { const p = along(ROADS.main, s); dec.add(rng.chance(0.6) ? 'pebbles' : 'stain', p.x + rng.range(-1.5, 1.5), p.z + rng.range(-1.5, 1.5), { size: rng.range(1.2, 2.2), alpha: 0.55 }); }
  for (let i = 0; i < 40; i++) { const p = along(RIVER, rng.range(0, 260)), side = rng.sign(); dec.add('pebbles', p.x - p.dz * 5.4 * side, p.z + p.dx * 5.4 * side, { size: rng.range(1, 2), alpha: 0.7 }); }
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const pollen = buildParticles('dust', { quality, color: [1.5, 1.3, 0.7] });
  const fluff = buildDrifters('fluff', { quality });
  const smokeMesh = buildSmoke(smoke);
  const bflies = buildButterflies([[SUNHILL[0], H(...SUNHILL), SUNHILL[1]], [SUNHILL[0] + 8, H(SUNHILL[0] + 8, SUNHILL[1] - 6), SUNHILL[1] - 6], [ORCHARD[0], H(...ORCHARD), ORCHARD[1]], [hx, H(hx, hz), hz + 1], [FARM[0] - 12, H(FARM[0] - 12, FARM[1] + 4), FARM[1] + 4], [-40, H(-40, 60), 60], [30, H(30, -50), -50]]);
  for (const m of [pollen, fluff, smokeMesh, bflies]) if (m) zone.root.add(m);
  zone.onUpdate((dt, t, focus) => {
    pool.update(dt, t, focus); pollen.userData.update(focus); fluff.userData.update(focus);
    grass.update(focus); wheat.update(focus);
    if (focus) wheat.mesh.visible = FIELDS.some(f => f.kind !== 'stubble' && fieldRect(f).sd(focus.x, focus.z) < 30);
    wmill.spin.rotation.z = -t * 0.45; wheelMesh.rotation.z = t * 0.6;
  });
  zone.onEnv(env => { pool.scale = 0.45 + env.night * 1.6; kitMaterial('window').emissiveIntensity = env.night * 1.8; waterEnv(river, env, { sky: 0.75 }); });
  zone.objects = { windmillSails: wmill.sails, waterwheel: wheelG };

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-110, -110, 222, 220, 0.5);
  nav.walk(S.inflate(bound, -0.6));
  nav.blockWhere((x, z) => chanD(x, z) < 3.4);
  nav.walk(br.deck); nav.walk(S.rect(WATERMILL[0] + 0.4, WATERMILL[1] - 2.8, 3.6, 3.0, 0.3));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[98, 30]]);
  zone._nav = nav; zone.nav = nav.toContract();
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = new Anchors(zone);
  A.add('spawn', 98, 30.5, Math.PI / 2);
  A.add('gate:solhaven', 107, 30, -Math.PI / 2);
  A.add('gate:thornwood', -42, -104.5, 0);
  A.add('triport:goldmeadow', hx - 12, hz + 10.6, faceTo(hx - 12, hz + 10.6, hx, hz));
  A.npc('farmer_hale', FARM[0] - 6, FARM[1] + 1.6, faceTo(FARM[0] - 6, FARM[1] + 1.6, FARM[0], FARM[1] + 8));
  A.npc('miller', MILL[0] + 0.3, MILL[1] + 4.4, 0.2);
  A.npc('captain', bpx - 1, bpz + 1.5, faceTo(bpx - 1, bpz + 1.5, bE2[0], bE2[1]));
  A.npc('innkeeper', hx + 1.2, hz - 10.8, Math.PI + 0.2);
  A.npc('hunter', HUNTER[0] + 0.5, HUNTER[1] + 4.5, faceTo(HUNTER[0] + 0.5, HUNTER[1] + 4.5, -24, -52));
  A.npc('child', hx + 2.6, hz + 3.6, faceTo(hx + 2.6, hz + 3.6, hx, hz + 12));
  A.npc('merchant', hx + 8.2, hz - 2.4, faceTo(hx + 8.2, hz - 2.4, hx, hz + 2));
  A.npc('beekeeper', ORCHARD[0] + 7.5, ORCHARD[1] + 17.5, Math.PI + 0.3);
  A.npc('hermit', HERMIT[0] + 1.6, HERMIT[1] + 3.8, 0.4 + Math.PI);
  A.npc('guard', 88.5, 34, faceTo(88.5, 34, 100, 30));
  A.npc('shrinekeeper', shr[0] - 1.6, shr[1] + 2.4, faceTo(shr[0] - 1.6, shr[1] + 2.4, bE2[0], bE2[1]));
  // mob packs (r, tag)
  A.pack(DENS[0] + 8, DENS[1] + 8, 8, 'wolves'); A.pack(DENS[0] + 16, DENS[1] - 10, 7, 'wolves'); A.pack(-58, -84, 7, 'wolves'); A.pack(40, -86, 7, 'wolves');
  A.pack(WALLOW[0] + 2, WALLOW[1] + 2, 9, 'boars'); A.pack(WALLOW[0] + 8, WALLOW[1] - 20, 7, 'boars'); A.pack(-66, 2, 7, 'boars'); A.pack(78, 30 + 26, 6, 'boars'); A.pack(34, -40, 7, 'boars');
  A.pack(BANDIT[0] + 1, BANDIT[1] - 2, 8, 'bandits'); A.pack(-44, 44, 7, 'bandits'); A.pack(-32, 22, 6, 'bandits'); A.pack(-12, -60, 7, 'bandits');
  A.elite(DENS[0] + 1, DENS[1] + 3, 'wolves'); A.elite(WALLOW[0] - 4, WALLOW[1] + 6, 'boars'); A.elite(BANDIT[0] - 3, BANDIT[1] + 1, 'bandits'); A.elite(TOWER[0] + 1, TOWER[1] + 6, 'wolves');
  A.add('fieldboss', STONES[0], STONES[1] + 4, Math.PI, { r: 17 });
  A.add('chaosgate', CHAOS[0], CHAOS[1], Math.PI, { r: 10 });
  // trade-skill nodes
  A.node('forage', 30, 44); A.node('forage', ORCHARD[0] - 10, ORCHARD[1] - 6); A.node('forage', -50, 8);
  A.node('log', -86, -24); A.node('log', 70, -84); A.node('log', -74, 52);
  A.node('mine', DENS[0] + 12, DENS[1] + 2); A.node('mine', -96, 20);
  A.node('hunt', HUNTER[0] - 8, HUNTER[1] - 6);
  A.node('fish', POND.x - 3, POND.z + 9.5, Math.PI - 0.4); A.node('fish', 20, -38, faceTo(20, -38, 16, -34));
  A.node('dig', TOWER[0] - 5, TOWER[1] + 2);
  // vistas & lore (vista ids match data/collectibles.js)
  A.add('vista:windmill', MILL[0] - 3.8, MILL[1] + 3.8, 0.6);
  A.add('vista:sunflower', SUNHILL[0], SUNHILL[1] - 0.5, 0);
  A.add('lore:1', shr[0] + 0.2, shr[1] + 1.8, Math.PI - 0.2);
  A.add('lore:2', STONES[0], STONES[1] + 2.4, Math.PI);
  A.add('lore:3', plaque[0] - 0.4, plaque[1] + 1.6, Math.PI + 0.3);
  // story locations
  A.poi('sheafton', hx, hz + 5, Math.PI); A.poi('inn', hx, hz - 11, Math.PI); A.poi('hale_farm', FARM[0], FARM[1] + 2, Math.PI);
  A.poi('windmill', MILL[0], MILL[1] + 5, 0); A.poi('sunflower_hill', SUNHILL[0], SUNHILL[1] + 8, 0); A.poi('stone_bridge', BR.x, BR.z, BR.rot);
  A.poi('millpond', POND.x + 9, POND.z - 6, -Math.PI / 2); A.poi('beehive_orchard', ORCHARD[0], ORCHARD[1] + 12, 0); A.poi('watchtower', TOWER[0], TOWER[1] + 5, 0);
  A.poi('ember_clearing', CHAOS[0], CHAOS[1] + 4, 0); A.poi('standing_stones', STONES[0], STONES[1] + 12, 0); A.poi('wolf_den', DENS[0] + 6, DENS[1] + 8, 0);
  A.poi('hunter_camp', HUNTER[0], HUNTER[1] + 4, 0); A.poi('boar_wallow', WALLOW[0], WALLOW[1] + 4, 0); A.poi('hermit_hut', HERMIT[0] + 1, HERMIT[1] + 5, Math.PI);
  A.poi('bandit_camp', BANDIT[0] + 5, BANDIT[1] - 13, Math.PI); A.poi('shrine_of_dawn', shr[0], shr[1] + 3, Math.PI); A.poi('wheat_maze', maze.x, maze.z + 13, 0);
  A.poi('scarecrow_field', FIELDS[0].x, FIELDS[0].z - 11, Math.PI); A.poi('hay_wagon', wagon[0] + 2, wagon[1] + 2, 0); A.poi('watermill', WATERMILL[0] + 3, WATERMILL[1] + 4, 0);
  A.poi('thornwood_road', -40, -92, 0); A.poi('bridge_post', bpx, bpz + 4, 0);
  // Pip Seeds — positions follow the collectible hints ("Under the old windmill", …)
  const at = (x, z) => [x, z];
  const SPOTS = [
    { name: 'the old windmill', at: [at(MILL[0] + 1.2, MILL[1] + 3.6), at(MILL[0] - 1, MILL[1] - 3.8)] },
    { name: 'the scarecrow field', at: [at(scPts[0][0] + 1.6, scPts[0][1] + 0.4), at(scPts[1][0] + 0.2, scPts[1][1] + 0.9)] },
    { name: 'the bandit camp', at: [at(bx0 + 6, bz0 - 3.2), at(bx0 + 2.4, bz0 + 8.6)] },
    { name: 'the beehive orchard', at: [at(ORCHARD[0] - 6, ORCHARD[1] - 2), at(orchardTrees[3][0] + 0.8, orchardTrees[3][1] + 1.2)] },
    { name: 'the stone bridge', at: [at(BR.x, BR.z), at(bE[0] + AX[1] * 3.2, bE[1] - AX[0] * 3.2)] },
    { name: 'the wheat maze', at: [mzw(0, -12.5), mzw(0.5, 1.5)] },
    { name: 'the hermit’s hut', at: [at(HERMIT[0] - 1, HERMIT[1] + 3.6), at(HERMIT[0] - 1.5, HERMIT[1] - 3.6)] },
    { name: 'the wolf den', at: [at(DENS[0] - 6, DENS[1] + 0.6), at(DENS[0] + 8, DENS[1] - 12)] },
    { name: 'the sunflower hill', at: [at(SUNHILL[0] + 2, SUNHILL[1] + 15), at(SUNHILL[0] - 3, SUNHILL[1] - 15)] },
    { name: 'the ruined watchtower', at: [at(TOWER[0] + 3.8, TOWER[1] - 1.4), at(TOWER[0] - 1.2, TOWER[1] + 3.4)] },
    { name: 'the millpond', at: [at(WATERMILL[0] + 0.4, WATERMILL[1] - 2.8)] },
    { name: 'the hay wagon', at: [at(wagon[0] + 1.6, wagon[1] - 1.2)] },
    { name: 'the shrine of dawn', at: [at(shr[0] + 1.4, shr[1] - 1.2)] },
    { name: 'the boar wallow', at: [at(WALLOW[0] - 5, WALLOW[1] - 9)] },
  ];
  for (const s of seedSpots('goldmeadow', SPOTS, 24)) A.add(`seed:${s.i}`, s.x, s.z, 0, { hint: `${s.where} ${s.name}` });
  aliasNumbered(zone, 'vista');
  snapAnchors(zone, nav, 6, 'goldmeadow');

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('Sheafton', hx, hz, 22); zone.region('Hale Farm', FARM[0], FARM[1], 20); zone.region('Windmill Hill', MILL[0], MILL[1], 16);
  zone.region('Sunflower Hill', SUNHILL[0], SUNHILL[1], 16); zone.region('Stone Bridge', BR.x, BR.z, 10); zone.region('The Millpond', POND.x, POND.z, 12);
  zone.region('Beehive Orchard', ORCHARD[0], ORCHARD[1], 18); zone.region('Old Watchtower', TOWER[0], TOWER[1], 12); zone.region('Ember Clearing', CHAOS[0], CHAOS[1], 12);
  zone.region('Standing Stones', STONES[0], STONES[1], 20); zone.region('Wolf Dens', DENS[0], DENS[1], 16); zone.region('Boar Wallows', WALLOW[0], WALLOW[1], 16);
  zone.region('Hermit’s Hollow', HERMIT[0], HERMIT[1], 9); zone.region('Bandit Camp', BANDIT[0], BANDIT[1], 14); zone.region('Thornwood Road', -38, -88, 12);
  const base = { music: 'goldmeadow', ambience: 'meadow' };
  const day = makeEnv('day', {
    ...base, sunColor: 0xffdfa6, sunIntensity: 3.8, sunDir: [-0.5, 0.68, 0.54],
    hemiSky: 0xd4e2f4, hemiGround: 0xa89060, hemiIntensity: 1.5,
    fogColor: 0xeadcc0, fogSunColor: 0xffd48a, fogDensity: 0.0042, fogHeight: 0.04,
    background: 0xd8dce0,
    grade: { exposure: 1.1, saturation: 1.1, contrast: 1.05, vignette: 0.28, warm: 0.08, cool: 0.02, lift: [0.03, 0.022, 0.0], gain: [1.04, 1.0, 0.92], bloom: 0.5, bloomThreshold: 0.88 },
  });
  const dusk = makeEnv('dusk', { ...base, fogColor: 0xe0a080, background: 0x8a6a70 });
  zone.envs = { day, dusk, night: makeEnv('night', { ...base, ambience: 'meadow_night' }) };
  zone.env = day;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: { rect: r.rect }, color: r.color }));
  zone.minimap = paintMinimap(zone, {
    px: 512, area: { x0: -110, z0: -110, size: 220 }, roofs,
    marks: [...Object.values(ROADS).map(r => ({ shape: { line: r }, color: '#b89a6a', alpha: 0.7, width: 3.5 })), ...FIELDS.map(f => ({ shape: { rect: [f.x, f.z, f.w, f.d, f.rot] }, color: f.kind === 'stubble' ? '#c8a860' : '#e0b840', alpha: 0.75 })), { shape: { circle: [POND.x, POND.z, POND.r] }, color: '#3f7fa8', alpha: 1 }],
  });
  // minimap water line needs a stroke width: repaint the river as a thick stroke
  { const ctx = zone.minimap.canvas.getContext('2d'), s = 512 / 220; ctx.save(); ctx.strokeStyle = '#3f7fa8'; ctx.lineWidth = 8.6 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); RIVER.forEach(([x, z], i) => { const u = (x + 110) * s, v = (z + 110) * s; i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.restore(); }
  zone.spots = kit.spots;
}

// src/world/index.js imports this module before its own body has run (import cycle): register once it has.
try { registerZone('goldmeadow', DEF, build); } catch { queueMicrotask(() => registerZone('goldmeadow', DEF, build)); }
