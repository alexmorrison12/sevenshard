// 'pipsprout' — Pipsprout Hollow, the Pips' home, authored at Pip scale (~160×160 m; the hero is shrunk ×0.35 by the
// game while inside: zone.scale = 0.35). Bright storybook morning: giant flowers, mushrooms, clover and dew.
//   Arrival at the Petal Pier on the dewdrop pond (south, 0, 66) · the village green (0, 20) with Bramblebeard's hollow-log
//   town hall (0, 6) and porch, acorn houses, the thimble well, the berry market (22, 24) · the Moss Library (−40, 4)
//   · the Acorn Tower (34, −18) · the Petal Theatre (46, 16) · the Giant Red Mushroom (−38, −30) · the snail stables
//   (−48, 42) · the ladybug bridge over the brook (−18, 36) · the sleepy caterpillar (44, 46) · the dandelion clocks
//   (30, 58) · the root tunnels and the Seed Vault door under the great roots (north, 0, −58) · the Clover Meadow
//   (field boss, −20, −2... east meadow 50, −44) · walls of giant grass, pebbles and roots all round.
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { tick } from '../zone.js';
import { NavGrid } from '../nav.js';
import { M, box, cyl, kitMaterial } from '../kit.js';
import { blob } from '../../engine/geom.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { buildWater } from '../water.js';
import { FieldGround, DistGrid, FieldKit, Anchors, snapAnchors, aliasNumbered, seedSpots, spline, along, paintPath, scatter, bump, faceTo, waterEnv, S, RNG, smoothstep, lerp, clamp } from '../fields/common.js';
import { FieldGrass, FieldFlora, giantFlowerGeo, mushroomGeo, bladeClumpGeo, fernGeo, thingMaterial } from '../fields/flora.js';
import { buildDrifters, buildButterflies } from '../fields/fx.js';
import * as F from '../fields/props.js';
import * as W from '../fields/forest.js';
import * as K from '../fields/pips.js';

export const DEF = { name: 'Pipsprout Hollow', kind: 'field', size: 160 };
const SCALE = 0.35;
const WL = -0.45;
const BOUND = [[-74, -60], [-50, -70], [-20, -66], [0, -74], [24, -68], [52, -72], [74, -58], [78, -30], [74, 0], [80, 30], [72, 58], [50, 74], [20, 76], [6, 82], [-8, 82], [-24, 76], [-52, 74], [-74, 56], [-80, 24], [-74, -8], [-80, -36]];
const POND = { x: 0, z: 58, r: 13 };
const BROOK = spline([[-80, 18], [-60, 22], [-40, 30], [-22, 38], [-12, 48], [-6, 52]], 1.5);
const GREEN = [0, 20], HALL = [0, 5], LIB = [-40, 4], TOWER = [34, -18], THEATRE = [46, 16], REDSHROOM = [-38, -30], STABLES = [-50, 44], CATER = [46, 48], DANDY = [28, 60], VAULT = [0, -58], MEADOW = [42, -44], MARKET = [22, 24], CHAOS = [-50, -52];

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 61);
  zone.scale = SCALE;
  zone.bounds = { x0: -80, z0: -74, x1: 80, z1: 82 };
  const g = zone.ground = new FieldGround({
    x0: -120, z0: -120, w: 240, d: 240, res: 1, seed: 63, base: 'grass',
    layers: ['grass', 'moss', 'dirt', 'sand', 'gravel', 'mud', 'flagstone', 'cobble', 'rock'],
    ltint: { grass: [1.0, 1.12, 0.78], moss: [1.0, 1.1, 0.8], dirt: [1.1, 0.98, 0.84], sand: [1.12, 1.04, 0.86], gravel: [1.1, 1.06, 1.0] },
    ltile: { grass: 2.6, moss: 2.6, dirt: 2.4, sand: 3, gravel: 1.8, mud: 2.6, flagstone: 2.4, cobble: 1.8, rock: 4 },
  });
  const N = g.noise;
  const bound = S.poly(BOUND);
  // ---------------------------------------------------------------- paths
  const PATHS = {
    main: spline([[0, 70], [0, 50], [2, 36], [0, 26], [0, 12]], 1.5),
    lib: spline([[-6, 20], [-20, 14], [-32, 8], [-36, 5]], 1.5),
    tower: spline([[6, 16], [18, 4], [28, -10], [32, -14]], 1.5),
    theatre: spline([[8, 22], [24, 20], [38, 18]], 1.5),
    vault: spline([[-2, 0], [-6, -18], [-4, -36], [0, -50]], 1.5),
    shroom: spline([[-6, -18], [-20, -24], [-32, -28]], 1.5),
    stables: spline([[-8, 28], [-24, 36], [-36, 42], [-44, 44]], 1.5),
    cater: spline([[6, 30], [24, 38], [38, 44]], 1.5),
    dandy: spline([[6, 44], [20, 54], [26, 58]], 1.5),
    meadow: spline([[26, -10], [36, -28], [40, -38]], 1.5),
  };
  const pathD = new DistGrid(-120, -120, 240, 240, 1, 10);
  for (const p of Object.values(PATHS)) pathD.add(p);
  const brookD = new DistGrid(-120, -120, 240, 240, 1, 16).add(BROOK);
  const NW = new (N.constructor)(71);
  const wob = (x, z) => NW.noise2(x / 6, z / 6) * 0.7 + NW.noise2(x / 2.5, z / 2.5 + 3) * 0.25;
  const pondD = (x, z) => Math.hypot(x - POND.x, (z - POND.z) * 1.15) - POND.r + wob(x, z);
  const waterD = (x, z) => Math.min(pondD(x, z), brookD.at(x, z) - 2.2 + wob(x, z) * 0.6);
  // ---------------------------------------------------------------- terrain: a soft bowl with rolling hummocks
  g.sculpt((x, z) => {
    let h = 0.8 + N.fbm2(x / 30, z / 30, 3) * 1.4 + N.fbm2(x / 9, z / 9, 2) * 0.25;
    h = Math.max(h, 0.3 + (h - 0.3) * 0.4);
    h += 3.0 * bump(x, z, REDSHROOM[0], REDSHROOM[1], 14) + 1.4 * bump(x, z, TOWER[0], TOWER[1], 12) + 1.2 * bump(x, z, LIB[0], LIB[1], 10);
    const sd = bound.sd(x, z);
    if (sd > 0) h += 5 * smoothstep(0, 12, sd) + N.fbm2(x / 8, z / 8, 2) * smoothstep(0, 6, sd) * 1.2;
    const dw = waterD(x, z);
    if (dw < 4) h = Math.min(h, lerp(-1.4, 0.4, smoothstep(-1.5, 4, dw)));
    h -= 0.08 * smoothstep(1.6, 0.4, pathD.at(x, z));
    return h;
  });
  const H = (x, z) => g.heightAt(x, z);
  const pad = (x, z, r, soft = 4, dy = 0) => g.flatten(S.circle(x, z, r), H(x, z) + dy, soft);
  pad(GREEN[0], GREEN[1], 12, 5); pad(HALL[0], HALL[1] + 1, 9, 4); pad(THEATRE[0], THEATRE[1], 11, 4); pad(MARKET[0], MARKET[1], 6, 3); pad(STABLES[0], STABLES[1], 8, 4);
  pad(MEADOW[0], MEADOW[1], 16, 6); pad(VAULT[0], VAULT[1] + 4, 7, 4); pad(CHAOS[0], CHAOS[1], 9, 4); pad(CATER[0], CATER[1], 6, 3); pad(TOWER[0], TOWER[1], 5, 3);
  await tick();

  // ---------------------------------------------------------------- paint
  for (let i = 0; i < 70; i++) { const x = rng.range(-78, 78), z = rng.range(-70, 80); g.paint('moss', S.circle(x, z, rng.range(2, 6)), { soft: 3, noise: 2, nscale: 3, amount: rng.range(0.3, 0.7) }); }
  g.paint('sand', { sd: (x, z) => waterD(x, z) - 2.6, box: [-120, -120, 120, 120] }, { soft: 1.2, noise: 1, nscale: 1.5 });
  g.paint('mud', { sd: (x, z) => waterD(x, z) - 0.9, box: [-120, -120, 120, 120] }, { soft: 1, noise: 0.8, nscale: 1.2 });
  g.info('wet', { sd: (x, z) => waterD(x, z) - 1.8, box: [-120, -120, 120, 120] }, { soft: 1.2, amount: 0.8 });
  g.paint('rock', { sd: (x, z) => 2 - bound.sd(x, z), box: [-120, -120, 120, 120] }, { soft: 3, noise: 3, nscale: 3, amount: 0.5 });
  for (const p of Object.values(PATHS)) paintPath(g, p, 'dirt', 2.6, { wear: 0.35, noise: 0.6, nscale: 1.5, piece: 8 });
  for (const p of Object.values(PATHS)) { let L = 0; for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); for (let s2 = 0.6; s2 < L; s2 += 1.25) { const q = along(p, s2); g.paint('gravel', S.circle(q.x + NW.noise2(s2, 1) * 0.45, q.z + NW.noise2(1, s2) * 0.45, 0.4), { soft: 0.2 }); } }
  g.paint('flagstone', S.circle(GREEN[0], GREEN[1], 4.2), { soft: 0.5, noise: 0.3, nscale: 1 });
  g.paint('cobble', S.ring(GREEN[0], GREEN[1], 9.5, 1.6), { soft: 0.4, noise: 0.4, nscale: 1 });
  g.paint('dirt', S.rect(HALL[0], HALL[1] + 5, 12, 5), { soft: 1.2, noise: 1, nscale: 1.5 });
  g.paint('sand', S.circle(THEATRE[0], THEATRE[1] + 2, 9.5), { soft: 2, noise: 1, nscale: 2, amount: 0.6 });
  g.paint('dirt', S.circle(STABLES[0], STABLES[1], 7), { soft: 2, noise: 1.5, nscale: 2 });
  g.paint('gravel', S.circle(VAULT[0], VAULT[1] + 4, 5), { soft: 2, noise: 1.2, nscale: 1.5 });
  g.paint('dirt', S.circle(CHAOS[0], CHAOS[1], 7), { soft: 2.5, noise: 2, nscale: 2 });
  g.paint('moss', S.circle(MEADOW[0], MEADOW[1], 15), { soft: 4, noise: 3, nscale: 3, amount: 0.5 });
  g.paint('dirt', S.circle(MARKET[0], MARKET[1], 5), { soft: 1.5, noise: 1, nscale: 1.5 });
  await tick();

  // ---------------------------------------------------------------- structures
  const kit = new FieldKit({ seed: 67, chunk: 32, fade: 'near', near: [4.6, 2.5] });
  const flags = new Flags();
  // --- the hollow-log town hall & Bramblebeard's porch
  K.logHall(kit, HALL[0], H(...HALL), HALL[1], 0, { len: 14, r: 2.6, seed: 2 });
  const porch = [HALL[0] + 2.6, HALL[1] + 4.6];
  for (let i = 0; i < 2; i++) kit.add('timber', cyl(0.28, 0.3, 0.45, 10, 1), M(porch[0] + 0.8 + i * 0.9, H(...porch) + 0.22, porch[1] + 0.4), { tint: 0x9a7048 });   // stool stumps
  kit.add('planks', cyl(0.55, 0.55, 0.08, 12, 1), M(porch[0] + 1.3, H(...porch) + 0.72, porch[1] - 0.4), { tint: 0xb08050 });
  kit.add('timber', cyl(0.08, 0.1, 0.7, 6, 1), M(porch[0] + 1.3, H(...porch) + 0.35, porch[1] - 0.4), { tint: 0x6a4428 });
  kit.add('paint', cyl(0.12, 0.1, 0.18, 8, 1), M(porch[0] + 1.2, H(...porch) + 0.85, porch[1] - 0.4), { tint: 0xf0f0e8, ao: false });           // teacup
  // --- the village green: thimble well, acorn houses round the ring, lanterns, bunting of petals
  K.thimbleWell(kit, GREEN[0], H(...GREEN), GREEN[1]);
  const houses = [[-11, 12, 0.8], [-14, 22, 1.3], [-10, 31, 2.2], [11, 12, -0.8], [14, 25, -1.4], [9, 33, -2.3], [-24, 22, 1.4], [-20, 2, 0.6], [22, 6, -0.5], [-28, 30, 1.8], [-26, -14, 0.9], [24, 14, -1.9]];
  houses.forEach(([dx, dz, rot], i) => { const x = GREEN[0] + dx, z = GREEN[1] + dz - 20 + 20; K.acornHouse(kit, x, H(x, z), z, rot + Math.PI, { s: rng.range(0.9, 1.15), body: rng.pick([0xc08040, 0xb87838, 0xc89050]), cap: rng.pick([0x7a5230, 0x6a4a2a, 0x8a5a34]), seed: 10 + i }); });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.2, x = GREEN[0] + Math.cos(a) * 7.6, z = GREEN[1] + Math.sin(a) * 7.6; K.firefly(kit, x, H(x, z) + 1.6, z, 0.14); }
  for (let i = 0; i < 3; i++) P.bunting(kit, [GREEN[0] - 7 + i * 5, H(...GREEN) + 3.2, GREEN[1] - 6], [GREEN[0] - 4 + i * 5, H(...GREEN) + 2.6, GREEN[1] + 7], { sag: 0.6, size: 0.3, colors: [0xff8ab0, 0xfff080, 0x8ad0ff, 0xb0f080, 0xffffff] });
  // --- the berry market
  const [mx, mz] = MARKET;
  K.berryStall(kit, mx - 2.6, H(mx - 2.6, mz), mz, 0.3, { seed: 1 }); K.berryStall(kit, mx + 2.4, H(mx + 2.4, mz + 0.5), mz + 0.5, -0.4, { seed: 2 }); K.berryStall(kit, mx, H(mx, mz - 3), mz - 3, 0, { seed: 3 });
  for (let i = 0; i < 5; i++) kit.add('paint', new THREE.SphereGeometry(0.34, 10, 8), M(mx - 4 + i * 0.7, H(mx, mz + 3) + 0.34, mz + 3.2 + (i % 2) * 0.5), { tint: [0xd82040, 0x3a4ab8, 0xd82040, 0x8a2a8a, 0xe8b020][i], ao: false });
  // --- the Moss Library: a huge mossy stump with shelves of seed-books and a reading lamp
  const [lx0, lz0] = LIB, LY = H(lx0, lz0);
  F.stump(kit, lx0, LY, lz0, { r: 3.4, h: 3.6, seed: 5, tint: 0x8a6a48, moss: false });
  kit.add('paint', blob(3.2, 1, d => 1 + Math.sin(d.x * 7 + d.z * 5) * 0.08, [1.12, 0.32, 1.12]), M(lx0, LY + 3.7, lz0), { tint: 0x5a9a2a, ao: false });
  kit.add('planks', cyl(0.8, 0.8, 0.1, 14, 0.6), M(lx0, LY + 1.1, lz0 + 3.5, 0, 1, 1.4, 1, Math.PI / 2), { tint: 0x5a3a24, ao: false });
  for (const sd of [-1, 1]) for (let row = 0; row < 3; row++) {
    kit.add('planks', box(1.4, 0.08, 0.4, 1), M(lx0 + sd * 2.3, LY + 0.5 + row * 0.62, lz0 + 3.0, sd * -0.5), { tint: 0x9a7048 });
    for (let b = 0; b < 6; b++) kit.add('paint', box(0.14, 0.42, 0.32, 1), M(lx0 + sd * 2.3 - 0.5 + b * 0.19, LY + 0.76 + row * 0.62, lz0 + 3.0, sd * -0.5, 1, 1, 1, 0, rng.range(-0.1, 0.1)), { tint: rng.pick([0x3a6ac0, 0xc04040, 0x40a060, 0xe0a030, 0x8a4ab0]), ao: false, cast: false });
  }
  kit.block(S.circle(lx0, lz0, 3.9), 0.12);
  K.firefly(kit, lx0 + 1.4, LY + 2.4, lz0 + 3.8, 0.16);
  // --- the Acorn Tower
  K.acornTower(kit, flags, TOWER[0], H(...TOWER), TOWER[1], { s: 1.3 });
  kit.block(S.circle(TOWER[0], TOWER[1], 1.8), 0.12);
  // --- the Petal Theatre
  K.petalTheatre(kit, THEATRE[0], H(...THEATRE), THEATRE[1] - 2, { r: 6.5, rows: 2 });
  // --- the snail stables: a twig fence pen, a hay-leaf trough, two snails
  const [st0, sj0] = STABLES;
  F.railFence(kit, [[st0 - 6, sj0 - 4], [st0 + 5, sj0 - 4], [st0 + 6, sj0 + 5], [st0 - 6, sj0 + 5], [st0 - 6, sj0 - 4]], H, { post: 1.4, tint: 0x8a6a48, gaps: [[st0 + 5.5, sj0, 1.4]] });
  K.snail(kit, st0 - 2.5, H(st0 - 2.5, sj0 + 1), sj0 + 1, 0.6, { s: 1.4 }); K.snail(kit, st0 + 1.5, H(st0 + 1.5, sj0 - 1), sj0 - 1, -1.2, { s: 1.2, shell: 0xd8a870 });
  F.trough(kit, st0 - 3, H(st0 - 3, sj0 - 3), sj0 - 3, 0);
  // --- the ladybug bridge over the brook
  let bs = 0, bd = 1e9; { let acc = 0; for (let i = 0; i < BROOK.length - 1; i++) { const d = Math.hypot(BROOK[i][0] + 18, BROOK[i][1] - 38); if (d < bd) { bd = d; bs = acc; } acc += Math.hypot(BROOK[i + 1][0] - BROOK[i][0], BROOK[i + 1][1] - BROOK[i][1]); } }
  const bp = along(BROOK, bs), brot = Math.atan2(bp.dx, bp.dz) + Math.PI / 2;
  const br = K.leafBridge(kit, bp.x, bp.z, Math.atan2(-bp.dx, -bp.dz) + Math.PI / 2 - Math.PI / 2, { len: 8.5, w: 2.2, deckY: 0.55 });
  zone.deck(br.deck, br.y);
  K.ladybug(kit, bp.x + bp.dz * 5.2, H(bp.x + bp.dz * 5.2, bp.z - bp.dx * 5.2), bp.z - bp.dx * 5.2, 0.8, { s: 1.3 });
  void brot;
  // --- the sleepy caterpillar on a big leaf
  K.leafPad(kit, CATER[0], H(...CATER), CATER[1], 0.4, { s: 4.2, tint: 0x8ab838 });
  K.caterpillar(kit, CATER[0] + 0.5, H(...CATER) + 0.1, CATER[1], 0.3, { s: 1.1 });
  // --- the Seed Vault under the great roots, the root tunnels
  K.seedVaultDoor(kit, VAULT[0], H(VAULT[0], VAULT[1]), VAULT[1], 0);
  const rootAt = [[-22, -60, -8, -66, 6], [8, -66, 24, -58, 5.5], [-40, -56, -30, -64, 4.5], [30, -60, 44, -58, 4], [-60, -40, -54, -52, 4]];
  for (const [ax, az, bx, bz, h] of rootAt) W.rootArch(kit, ax, az, bx, bz, H, { h, r: 1.1, tint: 0x7a5a3a, moss: 0x6a9a3a });
  for (const [x, z] of [[-14, -62], [16, -61]]) W.hollowMouth(kit, x, H(x, z), z, 0, { w: 2.4, h: 2.6 });
  // --- the Giant Red Mushroom (vista) and other giant mushrooms are instanced below; a spiral of shelf steps up the stem
  const RS = REDSHROOM;
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 1.6 + 0.6, y0 = H(...RS) + 0.6 + i * 0.95, x = RS[0] + Math.cos(a) * 2.1, z = RS[1] + Math.sin(a) * 2.1; kit.add('paint', cyl(0.9, 0.8, 0.14, 12, 1, false), M(x, y0, z, 0, 1, 1, 0.7), { tint: 0xe8c890, ao: false }); }
  // --- the dandelion clocks, a meadow of clover, pebbles, dew
  // --- chaos gate clearing: a cracked seed pod with violet light
  kit.glow(new THREE.OctahedronGeometry(0.5, 0), M(CHAOS[0], H(...CHAOS) + 2.2, CHAOS[1], 0, 1, 1.6, 1), 0xc060ff, 2.8);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, x = CHAOS[0] + Math.cos(a) * 1.6, z = CHAOS[1] + Math.sin(a) * 1.6; kit.add('paint', new THREE.SphereGeometry(1.0, 10, 8, 0, Math.PI, 0, Math.PI / 2), M(x, H(x, z), z, -a, 0.6, 1.6, 0.9), { tint: 0x6a4a3a }); }
  kit.light(CHAOS[0], H(...CHAOS) + 2.4, CHAOS[1], 0xa060ff, 3, 8, 0.1);
  kit.block(S.circle(CHAOS[0], CHAOS[1], 2.4), 0.1);
  // --- the Petal Pier (arrival) on the pond
  const pier = { x: 0, z: 66.5, len: 8, w: 3 };
  for (let i = 0; i < 24; i++) { const z = pier.z - pier.len / 2 + (i + 0.5) * pier.len / 24; kit.add('timber', cyl(0.17, 0.17, pier.w + (i % 3) * 0.12, 7, 1), M(pier.x + (i % 2) * 0.06, WL + 0.9, z, 0, 1, 1, 1, 0, Math.PI / 2), { tint: [0xa87850, 0x9a6a44, 0xb08058][i % 3], ao: false }); }
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) kit.add('timber', cyl(0.12, 0.14, 2.2, 6, 1), M(pier.x + sd * (pier.w / 2 - 0.1), WL + 0.1, pier.z - pier.len / 2 + i * pier.len / 2), { tint: 0x6a4428 });
  zone.deck(S.rect(pier.x, pier.z, pier.w - 0.3, pier.len), WL + 1.07);
  const petalBoat = new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5); petalBoat.scale(0.7, 0.5, 1.4);
  kit.add('paint', petalBoat, M(3.4, WL + 0.6, 69, 0.2), { tint: 0xffa0c0, ao: false });
  kit.add('timber', cyl(0.06, 0.06, 2.4, 5, 1), M(3.4, WL + 1.6, 69), { tint: 0x6a4428, ao: false });
  flags.add(M(3.45, WL + 2.7, 69), 1.2, 0.9, 0xfff0f8, { hang: 'left' });
  // --- boundary: pebble boulders and root knuckles along the rim (grass-blade walls are instanced below)
  for (let i = 0; i < BOUND.length; i++) {
    const [ax, az] = BOUND[i], [bx, bz] = BOUND[(i + 1) % BOUND.length];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 5));
    for (let k = 0; k < n; k++) { const t = (k + rng.next()) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (Math.hypot(x - pier.x, z - 80) < 10) continue; if (rng.chance(0.55)) K.pebble(kit, x, H(x, z) - 0.3, z, { s: rng.range(1.2, 2.6), seed: i * 13 + k, tint: rng.pick([0xc0b8ac, 0xb0a898, 0xd0c8b8]) }); }
  }
  // --- scatter: pebbles, clovers, leaves, dew, stumps (twig-scale)
  const EXC = [[...GREEN, 13], [...HALL, 9], [...LIB, 6], [...TOWER, 5], [...THEATRE, 11], [...STABLES, 8], [...CATER, 5], [...VAULT, 7], [...MARKET, 6], [...CHAOS, 7], [...REDSHROOM, 5], [POND.x, POND.z + 8, 7]];
  const free = (x, z, rr = 1, road = 1.8) => bound.sd(x, z) < -rr - 2 && pathD.at(x, z) > road && waterD(x, z) > 1.2 && !EXC.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er + rr);
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 7, 500, (x, z) => free(x, z, 1.2) && rng.chance(0.55))) K.pebble(kit, x, H(x, z) - 0.2, z, { s: rng.range(0.4, 1.1), seed: Math.round(x * 7 + z), tint: rng.pick([0xc0b8ac, 0xd0c8b8, 0xb8b4a8, 0xc8b8a0]) });
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 3.2, 2500, (x, z) => free(x, z, 0.4, 1.4) && rng.chance(0.6))) K.clover(kit, x, H(x, z), z, { s: rng.range(0.7, 1.4), seed: Math.round(x * 13 + z), four: rng.chance(0.03) });
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 4, 900, (x, z) => free(x, z, 0.6, 1.2) && rng.chance(0.5))) K.leafPad(kit, x, H(x, z), z, rng.range(0, 6.28), { s: rng.range(1.0, 2.2), tint: rng.pick([0x9ab040, 0xc8a040, 0x8aa838, 0xd08a30]) });
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 5, 700, (x, z) => free(x, z, 0.3, 1.0) && rng.chance(0.55))) K.dewdrop(kit, x, H(x, z), z, rng.range(0.14, 0.4));
  for (let i = 0; i < 40; i++) { const a = rng.range(0, 6.28), d = POND.r + rng.range(0.5, 3), x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d / 1.15; if (Math.abs(x) > 3 || z < POND.z) K.dewdrop(kit, x, H(x, z), z, rng.range(0.2, 0.5)); }
  // lily pads on the pond (non-blocking decoration on the water)
  for (let i = 0; i < 18; i++) { const a = rng.range(0, 6.28), d = rng.range(2, POND.r - 2), x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d / 1.15; if (Math.abs(x) < 3 && z > POND.z) continue; const pad2 = new THREE.CircleGeometry(rng.range(0.9, 1.6), 14, 0.3, Math.PI * 2 - 0.3); pad2.rotateX(-Math.PI / 2); kit.add('paint', pad2, M(x, WL + 0.03, z, rng.range(0, 6)), { tint: rng.pick([0x5aa830, 0x6ab838, 0x4a9a2a]), ao: false, cast: false }); if (rng.chance(0.35)) kit.add('paint', new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(x + 0.3, WL + 0.05, z, 0, 1, 0.8, 1), { tint: 0xffc0e0, ao: false, cast: false }); }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.15), { soft: 1.2, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  await tick();

  // ---------------------------------------------------------------- water
  const pond = buildWater(g, { x: -20, z: 44, w: 120, d: 60, level: WL, shallow: 0x6ad0c8, deep: 0x2a8aa0, sky: 0xd8ecff, swell: 0.01, foam: 0.6 });
  zone.root.add(pond);

  // ---------------------------------------------------------------- flora: giant flowers, mushrooms, grass walls, ferns
  const flora = new FieldFlora({ cell: 40 });
  const FM = thingMaterial({ near: [4.8, 2.6], amp: 0.06 });
  const flowerKinds = [
    { kind: 'daisy', color: 0xffffff, center: 0xf0c020 }, { kind: 'daisy', color: 0xffe060, center: 0xd08a20 }, { kind: 'daisy', color: 0xff9ac8, center: 0xf0d040 },
    { kind: 'tulip', color: 0xff5a6a }, { kind: 'tulip', color: 0xffb040 }, { kind: 'bell', color: 0x9a8aff }, { kind: 'bell', color: 0x6ab0ff }, { kind: 'dandelion' },
  ];
  const giantFlower = (x, z, k, h) => { const key = `gf${k}:${h}`; flora.thing(key, () => giantFlowerGeo({ ...flowerKinds[k], h, seed: k * 7 + h }), FM, x, H(x, z) - 0.1, z, { s: rng.range(0.85, 1.15), rot: rng.range(-0.5, 0.5), cast: true }); flora.colliders.push({ shape: S.circle(x, z, 0.25), inflate: 0.1 }); };
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 5.5, 900, (x, z) => free(x, z, 0.8, 2.0) && rng.chance(0.75))) giantFlower(x, z, rng.int(0, 6), rng.pick([3, 4, 5]));
  for (const [x, z] of scatter(rng, [DANDY[0] - 9, DANDY[1] - 7, DANDY[0] + 9, DANDY[1] + 7], 2.6, 200, (x, z) => bound.sd(x, z) < -3 && pathD.at(x, z) > 1.6 && waterD(x, z) > 1.5)) giantFlower(x, z, 7, rng.pick([4, 5]));
  // giant mushrooms (the Giant Red Mushroom is the biggest)
  const shroom = (x, z, o, s = 1, block = true) => { const key = 'ms' + JSON.stringify(o); flora.thing(key, () => mushroomGeo({ ...o, sway: 0 }), FM, x, H(x, z) - 0.1, z, { s, rot: rng.range(0, 6.28), cast: true }); if (block) flora.colliders.push({ shape: S.circle(x, z, o.r * 0.34 * s + 0.05), inflate: 0.12 }); };
  shroom(REDSHROOM[0], REDSHROOM[1], { h: 11, r: 5.2, cap: 0xd02818, spots: 0xfff6e8, stem: 0xf4ecd8, gills: 0xe8d8c0, spotN: 14, seed: 11, flat: 0.5, lean: 0.03 }, 1);
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 9, 260, (x, z) => free(x, z, 1.4, 2.4) && rng.chance(0.6))) {
    const k = rng.int(0, 3), o = [{ h: 3.2, r: 1.8, cap: 0xd83020, spots: 0xfff4e0, spotN: 10, seed: 1 }, { h: 4.5, r: 2.2, cap: 0xc08a50, spots: 0xf0e0c0, spotN: 0, seed: 2, flat: 0.45 }, { h: 2.2, r: 1.3, cap: 0x8a6ad0, spots: 0xf0e8ff, spotN: 7, seed: 3 }, { h: 5.5, r: 2.8, cap: 0xe8a040, spots: 0xfff0d0, spotN: 12, seed: 4 }][k];
    shroom(x, z, o, rng.range(0.8, 1.2));
    for (let i = 0; i < 3; i++) { const a = rng.range(0, 6.28), d = rng.range(1.5, 2.8); shroom(x + Math.cos(a) * d, z + Math.sin(a) * d, { ...o, h: o.h * 0.35, r: o.r * 0.35, seed: o.seed + 10 }, rng.range(0.7, 1.2), false); }
  }
  // Pip-scale ground clutter: tiny toadstool clusters, fallen acorns & seeds, twigs, small pebbles
  const tiny = [{ h: 0.5, r: 0.3, cap: 0xd83020, spots: 0xfff4e0, spotN: 7, seed: 21 }, { h: 0.7, r: 0.36, cap: 0xc89050, spots: 0xf0e0c0, spotN: 0, seed: 22, flat: 0.45 }, { h: 0.45, r: 0.26, cap: 0x9a7ad8, spots: 0xf0e8ff, spotN: 5, seed: 23 }];
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 2.6, 3200, (x, z) => free(x, z, 0.3, 1.1) && rng.chance(0.45))) { const k = Math.abs(Math.round(x * 3 + z)) % 3; for (let i = 0; i < 3; i++) { const a = rng.range(0, 6.28), d = i ? rng.range(0.3, 0.7) : 0; flora.thing('tiny' + k, () => mushroomGeo({ ...tiny[k], sway: 0.02 }), FM, x + Math.cos(a) * d, H(x, z) - 0.02, z + Math.sin(a) * d, { s: rng.range(0.6, 1.3), rot: rng.range(0, 6.28), cast: false }); } }
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 2.2, 3000, (x, z) => free(x, z, 0.2, 0.9) && rng.chance(0.4))) flora.thing('acorn', K.acornGeo, FM, x, H(x, z) - 0.02, z, { s: rng.range(0.7, 1.3), rot: rng.range(0, 6.28), cast: false });
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 2.4, 3000, (x, z) => free(x, z, 0.2, 0.8) && rng.chance(0.45))) flora.thing('twig', K.twigGeo, FM, x, H(x, z) - 0.02, z, { s: rng.range(0.6, 1.4), rot: rng.range(0, 6.28), cast: false });
  // walls of giant grass blades round the rim, clumps in the meadows
  for (let i = 0; i < BOUND.length; i++) {
    const [ax, az] = BOUND[i], [bx, bz] = BOUND[(i + 1) % BOUND.length], L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 1.7);
    for (let k = 0; k < n; k++) { const t = (k + rng.next()) / n, off = rng.range(0.5, 4.5); const x = ax + (bx - ax) * t, z = az + (bz - az) * t; const nx = -(bz - az) / L, nz = (bx - ax) / L; const px = x - nx * off, pz = z - nz * off; if (Math.hypot(px - pier.x, pz - 82) < 8) continue; const v = (k + i) % 3; flora.thing('blade' + v, () => bladeClumpGeo(v + 5, { h: 7 + v, n: 8, width: 0.55 }), FM, px, H(px, pz) - 0.2, pz, { s: rng.range(0.8, 1.3), rot: rng.range(0, 6.28), cast: true }); flora.colliders.push({ shape: S.circle(px, pz, 0.7), inflate: 0.1 }); }
  }
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 6, 500, (x, z) => free(x, z, 0.6, 1.8) && rng.chance(0.5))) { const v = Math.abs(Math.round(x + z)) % 3; flora.thing('bladeS' + v, () => bladeClumpGeo(v + 1, { h: 2.4 + v * 0.6, n: 7, width: 0.28 }), FM, x, H(x, z) - 0.1, z, { s: rng.range(0.8, 1.3), rot: rng.range(0, 6.28), cast: true }); }
  for (const [x, z] of scatter(rng, [-78, -72, 78, 80], 4, 500, (x, z) => free(x, z, 0.4, 1.5) && rng.chance(0.4))) flora.thing('fernP', () => fernGeo(3, { h: 1.8, color: 0x4a8a2a, tip: 0x9ad050, n: 7 }), FM, x, H(x, z) - 0.05, z, { s: rng.range(0.8, 1.3), rot: rng.range(0, 6.28), cast: true });
  // the Treefoot: the great tree's trunk rising behind the northern roots (scenery beyond the edge)
  flora.tree('ancient', 0, H(0, -96) - 1, -96, { s: 3.2, variant: 1, block: false, opts: { dark: 0x2a4a1a, light: 0x8ab848, core: 0x142a0c } });
  flora.tree('ancient', -60, H(-60, -92), -92, { s: 2.4, variant: 0, block: false, opts: { dark: 0x2a4a1a, light: 0x8ab848, core: 0x142a0c } });
  flora.tree('ancient', 64, H(64, -90), -90, { s: 2.6, variant: 0, block: false, opts: { dark: 0x2a4a1a, light: 0x8ab848, core: 0x142a0c } });
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new FieldGrass(g, { layer: 'grass', shape: 'giant', w: 22, d: 19, spacing: 0.2, north: 1.6, density: quality, height: 0.62, width: 1.0, tint: [1.0, 1.08, 0.85], push: 0.5 });
  const moss = new FieldGrass(g, { layer: 'moss', shape: 'grass', w: 22, d: 19, spacing: 0.16, north: 1.6, density: quality * 0.8, height: 0.9, threshold: [0.45, 0.85], push: 0.4 });
  zone.root.add(grass.mesh, moss.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  for (let i = 0; i < 220; i++) { const x = rng.range(-78, 78), z = rng.range(-72, 80); if (free(x, z, 0, 1)) dec.add(rng.chance(0.5) ? 'petals' : rng.chance(0.5) ? 'pebbles' : 'leaves', x, z, { size: rng.range(0.8, 1.8), alpha: 0.8, tint: 0xffffff }); }
  dec.add('runes', CHAOS[0], CHAOS[1], { size: 5, tint: 0xa060ff, emit: 0x8040ff, emitI: 0.9, alpha: 0.6 });
  dec.add('sunmark', GREEN[0], GREEN[1], { size: 3.4, alpha: 0.7, rot: 0 });
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const sparkle = buildParticles('dust', { quality, count: 220, color: [1.8, 1.7, 1.2] });
  sparkle.userData.u.uBox.value.set(14, 4, 12); sparkle.userData.u.uSize.value = 0.03;
  const fluff = buildDrifters('fluff', { quality, scale: 0.4, count: 80 });
  const petals = buildDrifters('petals', { quality, scale: 0.45, count: 60, colors: [0xffc0d8, 0xffffff, 0xfff0a0] });
  const bflies = buildButterflies([[0, H(0, 20), 20], [DANDY[0], H(...DANDY), DANDY[1]], [THEATRE[0], H(...THEATRE), THEATRE[1]], [-40, H(-40, 20), 20], [30, H(30, -40), -40], [-20, H(-20, -40), -40], [MARKET[0], H(...MARKET), MARKET[1]]], { perSpot: 4, scale: 2.6 });
  for (const m of [sparkle, fluff, petals, bflies]) if (m) zone.root.add(m);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); sparkle.userData.update(focus); fluff.userData.update(focus); petals.userData.update(focus); grass.update(focus); moss.update(focus); });
  zone.onEnv(env => { pool.scale = 0.6 + env.night * 1.4; kitMaterial('window').emissiveIntensity = 0.3 + env.night * 1.6; waterEnv(pond, env, { sky: 1.0 }); });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-82, -76, 164, 160, 0.5);
  nav.walk(S.inflate(bound, -2.5));
  nav.blockWhere((x, z) => waterD(x, z) < 0.2);
  nav.walk(br.deck); nav.walk(S.rect(pier.x, pier.z, pier.w - 0.4, pier.len));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 66]]);
  zone._nav = nav; zone.nav = nav.toContract();
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = new Anchors(zone);
  A.add('spawn', 0, 66, 0);
  A.add('dock:ship', 0, 70, Math.PI);
  A.add('gate:glass_sea', 0, 70, Math.PI);
  A.add('triport:pipsprout', GREEN[0] + 5.5, GREEN[1] + 7.5, faceTo(GREEN[0] + 5.5, GREEN[1] + 7.5, GREEN[0], GREEN[1]));
  A.npc('bramblebeard', porch[0] - 0.6, porch[1] + 0.6, 0.2);
  A.npc('pip_merchant', MARKET[0], MARKET[1] - 1.6, Math.PI);
  A.npc('pip_librarian', LIB[0] + 1.6, LIB[1] + 4.6, 0.3);
  A.npc('pip_stablekeeper', STABLES[0] + 7, STABLES[1] + 1, faceTo(STABLES[0] + 7, STABLES[1] + 1, STABLES[0], STABLES[1]));
  A.npc('pip_guard', 2.2, 60.5, 0.2);
  A.npc('pip_farmer', DANDY[0] - 4, DANDY[1] - 5, faceTo(DANDY[0] - 4, DANDY[1] - 5, DANDY[0], DANDY[1]));
  A.npc('pip_child', GREEN[0] - 3, GREEN[1] + 5, faceTo(GREEN[0] - 3, GREEN[1] + 5, GREEN[0], GREEN[1]));
  A.npc('pip_bard', THEATRE[0], THEATRE[1] - 3, 0);
  A.pack(-24, -44, 5, 'beetles'); A.pack(24, -40, 5, 'beetles'); A.pack(MEADOW[0], MEADOW[1], 6, 'rabbits'); A.pack(-58, 12, 5, 'slimes'); A.pack(-50, -18, 5, 'slimes');
  A.pack(56, 30, 5, 'spiders'); A.pack(-12, -56, 5, 'wisps'); A.pack(-26, 60, 5, 'crabs'); A.pack(60, -8, 5, 'beetles');
  A.elite(MEADOW[0] + 4, MEADOW[1] - 4, 'rabbits'); A.elite(-56, -26, 'slimes'); A.elite(58, 36, 'spiders');
  A.add('fieldboss', MEADOW[0], MEADOW[1], Math.PI, { r: 14 });
  A.add('chaosgate', CHAOS[0], CHAOS[1] + 3, Math.PI, { r: 6 });
  A.node('forage', -30, 16); A.node('forage', 36, 34); A.node('forage', -14, -30); A.node('forage', DANDY[0] + 5, DANDY[1] + 4);
  A.node('fish', POND.x + 8, POND.z - 10, Math.PI - 0.6); A.node('fish', -30, 29.5, 0.6);
  A.node('dig', -52, -40); A.node('dig', 58, -24); A.node('log', -64, 30); A.node('mine', 60, 12);
  A.add('vista:mushroom', REDSHROOM[0] + 2.2, REDSHROOM[1] + 3.2, 0.6);
  A.add('vista:petal', THEATRE[0], THEATRE[1] + 7, Math.PI);
  A.add('lore:1', LIB[0] - 1.6, LIB[1] + 4.6, 0); A.add('lore:2', VAULT[0] + 2.4, VAULT[1] + 3.2, 0); A.add('lore:3', HALL[0] - 4, HALL[1] + 3.6, 0);
  A.poi('village_green', GREEN[0], GREEN[1] + 6, 0); A.poi('town_hall', HALL[0], HALL[1] + 4.8, 0); A.poi('bramblebeard_porch', porch[0], porch[1] + 1.6, 0);
  A.poi('moss_library', LIB[0], LIB[1] + 5, 0); A.poi('acorn_tower', TOWER[0], TOWER[1] + 4, 0); A.poi('petal_theatre', THEATRE[0], THEATRE[1] + 6, Math.PI);
  A.poi('giant_red_mushroom', REDSHROOM[0], REDSHROOM[1] + 6, 0); A.poi('snail_stables', STABLES[0] + 7, STABLES[1], -Math.PI / 2); A.poi('ladybug_bridge', bp.x, bp.z, 0);
  A.poi('sleepy_caterpillar', CATER[0], CATER[1] + 5, 0); A.poi('dandelion_clock', DANDY[0], DANDY[1] - 7, 0); A.poi('thimble_well', GREEN[0] + 2, GREEN[1] + 2, 0);
  A.poi('berry_market', MARKET[0], MARKET[1] + 3, 0); A.poi('root_tunnels', -14, -58, 0); A.poi('seed_vault', VAULT[0], VAULT[1] + 3.4, 0); A.poi('dewdrop_pond', POND.x + 10, POND.z - 12, Math.PI);
  A.poi('petal_pier', pier.x, pier.z, 0); A.poi('clover_meadow', MEADOW[0], MEADOW[1] + 12, 0);
  const SPOTS = [
    { name: 'the giant red mushroom', at: [[REDSHROOM[0] - 2.5, REDSHROOM[1] + 2.5], [REDSHROOM[0] + 3, REDSHROOM[1] - 2]] },
    { name: 'the dewdrop pond', at: [[POND.x - 12, POND.z - 4], [POND.x + 13, POND.z + 2]] },
    { name: 'Bramblebeard’s porch', at: [[porch[0] + 2.4, porch[1] + 0.2], [HALL[0] - 5, HALL[1] + 3.4]] },
    { name: 'the acorn tower', at: [[TOWER[0] - 1.8, TOWER[1] + 1.6], [TOWER[0] + 2.4, TOWER[1] + 1.4]] },
    { name: 'the snail stables', at: [[STABLES[0] - 4, STABLES[1] + 3], [STABLES[0] + 3, STABLES[1] + 3.6]] },
    { name: 'the dandelion clock', at: [[DANDY[0] + 3, DANDY[1] + 2], [DANDY[0] - 5, DANDY[1] + 3]] },
    { name: 'the ladybug bridge', at: [[bp.x, bp.z], [bp.x - bp.dz * 3, bp.z + bp.dx * 3]] },
    { name: 'the thimble well', at: [[GREEN[0] + 1.6, GREEN[1] - 1.4], [GREEN[0] - 1.8, GREEN[1] + 1.2]] },
    { name: 'the moss library', at: [[LIB[0] + 3, LIB[1] + 3], [LIB[0] - 4, LIB[1] + 1]] },
    { name: 'the berry market', at: [[MARKET[0] - 4, MARKET[1] + 2], [MARKET[0] + 4, MARKET[1] - 1.5]] },
    { name: 'the sleepy caterpillar', at: [[CATER[0] + 3.2, CATER[1] + 1.4], [CATER[0] - 2.5, CATER[1] + 2.5]] },
    { name: 'the root tunnels', at: [[-14, -60], [16, -59.5]] },
    { name: 'the petal theatre', at: [[THEATRE[0] - 3.8, THEATRE[1] - 3], [THEATRE[0] + 3.8, THEATRE[1] - 3]] },
    { name: 'the seed vault door', at: [[VAULT[0] - 2.4, VAULT[1] + 2.4], [VAULT[0] + 3.4, VAULT[1] + 1.4]] },
  ];
  for (const s of seedSpots('pipsprout', SPOTS, 28)) A.add(`seed:${s.i}`, s.x, s.z, 0, { hint: `${s.where} ${s.name}` });
  aliasNumbered(zone, 'vista');
  snapAnchors(zone, nav, 4, 'pipsprout');

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('The Village Green', GREEN[0], GREEN[1], 12); zone.region('Hollow-Log Hall', HALL[0], HALL[1], 8); zone.region('Moss Library', LIB[0], LIB[1], 6);
  zone.region('Acorn Tower', TOWER[0], TOWER[1], 5); zone.region('Petal Theatre', THEATRE[0], THEATRE[1], 9); zone.region('Giant Red Mushroom', REDSHROOM[0], REDSHROOM[1], 7);
  zone.region('Snail Stables', STABLES[0], STABLES[1], 7); zone.region('Dewdrop Pond', POND.x, POND.z, 14); zone.region('Clover Meadow', MEADOW[0], MEADOW[1], 15);
  zone.region('Dandelion Clocks', DANDY[0], DANDY[1], 8); zone.region('The Root Tunnels', 0, -60, 12); zone.region('Berry Market', MARKET[0], MARKET[1], 5);
  const morning = makeEnv('day', {
    music: 'pipsprout', ambience: 'pip_morning', preset: 'storybook',
    sunColor: 0xfff0d0, sunIntensity: 3.4, sunDir: [-0.45, 0.7, 0.56],
    hemiSky: 0xcfe6ff, hemiGround: 0xa8b870, hemiIntensity: 1.5,
    fogColor: 0xf6e8e0, fogSunColor: 0xfff0c8, fogDensity: 0.012, fogHeight: 0.08, fogBase: 0,
    background: 0xd8e8f8,
    grade: { exposure: 1.02, saturation: 1.2, contrast: 1.06, vignette: 0.26, warm: 0.05, cool: 0.02, lift: [0.02, 0.02, 0.03], gain: [1.02, 1.0, 0.97], bloom: 0.5, bloomRadius: 0.55, bloomThreshold: 0.93 },
    weather: 'clear', night: 0,
  });
  zone.envs = { day: morning, dusk: makeEnv('dusk', { music: 'pipsprout', ambience: 'pip_evening' }), night: makeEnv('night', { music: 'pipsprout', ambience: 'pip_night' }) };
  zone.env = morning;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: r.color }));
  zone.minimap = paintMinimap(zone, {
    px: 512, area: { x0: -82, z0: -76, size: 160 }, roofs,
    marks: Object.values(PATHS).map(p => ({ shape: { line: p }, color: '#c8a870', alpha: 0.7, width: 2.2 })),
    water: [{ shape: { circle: [POND.x, POND.z, POND.r] } }],
  });
  { const ctx = zone.minimap.canvas.getContext('2d'), s = 512 / 160; ctx.save(); ctx.strokeStyle = '#3f7fa8'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round'; ctx.beginPath(); BROOK.forEach(([x, z], i) => { const u = (x + 82) * s, v = (z + 76) * s; i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.restore(); }
  zone.spots = kit.spots;
}

try { registerZone('pipsprout', DEF, build); } catch { queueMicrotask(() => registerZone('pipsprout', DEF, build)); }
