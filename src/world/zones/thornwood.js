// 'thornwood' — the dark ancient forest north of Goldmeadow (~220×220 m, levels 25–40). Misty blue-green, shafts of light.
//   The Old Pilgrim Road runs from the Goldmeadow gate (south, −20, 106) to the Ashen Ridge gate (north-east, 72, −106)
//   Wardens' Camp (8, 42): rangers' lodge, tents, campfire, triport — the hub · Thorn Arch over the road (−4, 20)
//   West: the misty creek (from the Moonlit Pool, −60, −84, south to the Abandoned Logging Camp, −62, 70), the Fallen
//   Giant bridging it on the way to the ruined Abbey (−66, −40) held by cultists; the Witch Lights marsh (−86, 8)
//   East: the Cultist Circle (40, 6), the Spider Hollow (64, 48), the Owl Roost (88, −6), the Hollow Glade (field boss, 72, −44)
//   North: the Treant Grove (−6, −70) · South: the Toadstool Ring (−4, 84), a chaos-gate clearing (46, 86), the Hollow Oak
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { tick } from '../zone.js';
import { NavGrid } from '../nav.js';
import { M, box, cyl, kitMaterial } from '../kit.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags, buildShafts } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { buildWater } from '../water.js';
import { blob } from '../../engine/geom.js';
import { FieldGround, DistGrid, FieldKit, Anchors, snapAnchors, aliasNumbered, seedSpots, spline, along, paintPath, scatter, bump, faceTo, waterEnv, S, RNG, smoothstep, lerp } from '../fields/common.js';
import { FieldGrass, FieldFlora, fernGeo, mushroomGeo, tallGrassGeo, reedGeo } from '../fields/flora.js';
import { Mist, buildSmoke, buildDrifters } from '../fields/fx.js';
import * as F from '../fields/props.js';
import * as W from '../fields/forest.js';

export const DEF = { name: 'Thornwood', kind: 'field', size: 220 };
const WL = -0.7;

const BOUND = [[-102, -96], [-80, -104], [-50, -100], [-20, -104], [10, -98], [40, -102], [62, -104], [66, -112], [80, -112], [84, -100], [100, -92], [106, -64], [100, -36], [106, -8], [102, 22], [106, 50], [100, 78], [90, 100], [60, 104], [30, 100], [0, 104], [-14, 104], [-16, 112], [-26, 112], [-28, 104], [-54, 102], [-82, 104], [-100, 90], [-106, 60], [-100, 30], [-106, 0], [-102, -32], [-106, -64]];
const CREEK = spline([[-60, -86], [-54, -70], [-46, -54], [-42, -32], [-44, -8], [-38, 16], [-44, 38], [-52, 58], [-60, 78], [-66, 98], [-70, 130]], 2);
const POOL = { x: -62, z: -88, r: 7 };
const CAMP = [8, 42], ABBEY = [-66, -40], CIRCLE = [40, 6], HOLLOW = [64, 48], OWLS = [88, -6], GLADE = [72, -44], GROVE = [-6, -70], LOGCAMP = [-66, 68], MARSH = [-86, 8], TOADS = [-4, 84], CHAOS = [46, 86], HOAK = [-26, 30], ARCH = [-4, 20];

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 37);
  zone.bounds = { x0: -106, z0: -112, x1: 106, z1: 112 };
  const g = zone.ground = new FieldGround({
    x0: -150, z0: -150, w: 300, d: 300, res: 1, seed: 33, base: 'moss',
    layers: ['moss', 'grass', 'dirt', 'mud', 'gravel', 'rock', 'cobble', 'flagstone', 'sand'],
    ltint: { moss: [0.82, 0.9, 0.78], grass: [0.72, 0.9, 0.82], dirt: [0.8, 0.78, 0.74], mud: [0.8, 0.82, 0.78], rock: [0.82, 0.88, 0.84], cobble: [0.8, 0.86, 0.82], flagstone: [0.82, 0.86, 0.82], gravel: [0.85, 0.88, 0.86] },
  });
  const N = g.noise;
  const bound = S.poly(BOUND);
  // ---------------------------------------------------------------- roads
  const ROAD = spline([[-20, 130], [-20, 104], [-14, 84], [-4, 62], [6, 42], [2, 24], [-6, 4], [-4, -18], [8, -38], [28, -56], [50, -74], [66, -94], [72, -130]], 2);
  const PATHS = {
    abbey: spline([[-5, -8], [-20, -18], [-34, -26], [-40, -30]], 2),
    abbey2: spline([[-49, -34], [-56, -38], [ABBEY[0] + 8, ABBEY[1] + 2]], 2),
    circle: spline([[2, 14], [18, 12], [32, 8]], 2),
    hollow: spline([[8, 46], [30, 52], [50, 50]], 2),
    grove: spline([[-4, -24], [-10, -44], [-8, -60]], 2),
    glade: spline([[30, -56], [50, -52], [62, -48]], 2),
    owls: spline([[48, 4], [66, 0], [80, -4]], 2),
    logs: spline([[-12, 82], [-30, 78], [-48, 72], [LOGCAMP[0] + 8, LOGCAMP[1] + 2]], 2),
    marsh: spline([[-38, 14], [-58, 12], [-76, 10]], 2),
    pool: spline([[-10, -46], [-30, -60], [-46, -78], [POOL.x + 8, POOL.z + 4]], 2),
    toads: spline([[-12, 82], [-6, 84]], 2),
    chaos: spline([[-6, 60], [20, 74], [38, 82]], 2),
  };
  const roadD = new DistGrid(-150, -150, 300, 300, 1, 16).add(ROAD);
  for (const p of Object.values(PATHS)) roadD.add(p);
  const creekD = new DistGrid(-150, -150, 300, 300, 1, 30).add(CREEK);
  const poolD = (x, z) => Math.hypot(x - POOL.x, z - POOL.z) - POOL.r;
  const NW = new (g.noise.constructor)(91);
  const wob = (x, z) => NW.noise2(x / 9, z / 9) * 1.1 + NW.noise2(x / 3.5 + 7, z / 3.5) * 0.35;   // bank wobble (m)
  const chanD = (x, z) => Math.min(creekD.at(x, z) + wob(x, z), Math.max(0.01, poolD(x, z) + 2.8 + wob(x, z) * 0.6));
  const MPOOLS = [[-90, 4, 4.2], [-80, 12, 3.4], [-84, 20, 2.8], [-94, 14, 2.6], [-78, 0, 2.4], [-88, -4, 2.2]];
  const marshD = (x, z) => { let d = 1e9; for (const [px, pz, pr] of MPOOLS) d = Math.min(d, Math.hypot(x - px, z - pz) - pr + wob(x, z) * 0.5); return d; };
  // ---------------------------------------------------------------- the fallen giant bridging the creek on the way to the abbey
  const FG = { ax: -34, az: -27, bx: -52, bz: -35 };
  const FGtop = 3.2;
  // ---------------------------------------------------------------- terrain
  g.sculpt((x, z) => {
    let h = 1.4 + N.fbm2(x / 70, z / 70, 3) * 3.0 + N.fbm2(x / 18 + 3, z / 18, 2) * 0.7;
    h += 2.6 * bump(x, z, ABBEY[0], ABBEY[1], 26) - 3.2 * bump(x, z, HOLLOW[0], HOLLOW[1], 17) + 1.2 * bump(x, z, GROVE[0], GROVE[1], 24) - 1.0 * bump(x, z, MARSH[0], MARSH[1], 18);
    h = Math.max(h, 0.4 + (h - 0.4) * 0.3);
    const sd = bound.sd(x, z);
    if (sd > 0) h += 9 * smoothstep(0, 16, sd) + N.fbm2(x / 14, z / 14, 3) * smoothstep(0, 8, sd) * 2.5;
    const dc = chanD(x, z);
    h = lerp(h, Math.min(h, 0.6), smoothstep(14, 4, dc));
    const hc = dc < 4.4 ? lerp(-1.9, 0.3, smoothstep(0.8, 4.4, dc)) : 0.3 + (dc - 4.4) * 0.45;
    h = Math.min(h, hc);
    // marsh: shallow pools in a low bowl
    const dm = marshD(x, z);
    if (dm < 3) h = Math.min(h, lerp(-0.9, 0.35, smoothstep(-1.5, 3, dm)));
    h -= 0.1 * smoothstep(2.5, 0.6, roadD.at(x, z));
    return h;
  });
  const H = (x, z) => g.heightAt(x, z);
  const pad = (x, z, r, soft = 6, dy = 0) => g.flatten(S.circle(x, z, r), H(x, z) + dy, soft);
  pad(CAMP[0], CAMP[1], 14, 6); pad(ABBEY[0], ABBEY[1], 20, 7); pad(CIRCLE[0], CIRCLE[1], 12, 6); pad(GLADE[0], GLADE[1], 20, 7); pad(GROVE[0], GROVE[1], 16, 7);
  pad(LOGCAMP[0], LOGCAMP[1], 12, 5); pad(CHAOS[0], CHAOS[1], 12, 5); pad(TOADS[0], TOADS[1], 8, 4); pad(OWLS[0], OWLS[1], 7, 4); pad(HOLLOW[0], HOLLOW[1], 12, 6);
  // fallen giant: root mound and landing ledge rise to the trunk top
  for (const [x, z] of [[FG.ax, FG.az], [FG.bx, FG.bz]]) g.flatten(S.circle(x + (x - (FG.ax + FG.bx) / 2) * 0.28, z + (z - (FG.az + FG.bz) / 2) * 0.28, 3.4), FGtop, 7);
  await tick();

  // ---------------------------------------------------------------- paint
  for (let i = 0; i < 90; i++) { const x = rng.range(-104, 104), z = rng.range(-104, 104); g.paint(rng.chance(0.4) ? 'dirt' : rng.chance(0.5) ? 'rock' : 'mud', S.circle(x, z, rng.range(2, 6)), { soft: 3, noise: 2.5, nscale: 3, amount: rng.range(0.25, 0.5) }); }
  g.paint('rock', { sd: (x, z) => 3 - bound.sd(x, z), box: [-150, -150, 150, 150] }, { soft: 5, noise: 5, nscale: 6, amount: 0.7 });
  // clearings get grass, the road old cobbles
  for (const [x, z, r] of [[...CAMP, 12], [...GLADE, 18], [...GROVE, 14], [...CIRCLE, 9], [...CHAOS, 10], [...TOADS, 7], [...OWLS, 6], [...LOGCAMP, 9], [-20, 96, 8], [20, -20, 9], [-24, -60, 8]]) g.paint('grass', S.circle(x, z, r), { soft: 4, noise: 3, nscale: 3, amount: 0.9 });
  g.paint('gravel', { sd: (x, z) => chanD(x, z) - 5.2, box: [-110, -110, -20, 150] }, { soft: 1.5, noise: 1.4, nscale: 2.5 });
  g.paint('mud', { sd: (x, z) => chanD(x, z) - 3.4, box: [-110, -110, -20, 150] }, { soft: 1.2, noise: 1.2, nscale: 2 });
  g.info('wet', { sd: (x, z) => chanD(x, z) - 4.2, box: [-110, -110, -20, 150] }, { soft: 1.5, amount: 0.9 });
  paintPath(g, ROAD, 'dirt', 5.4, { wear: 0.45, noise: 1.2 });
  paintPath(g, ROAD, 'cobble', 3.2, { wear: 0, noise: 1.6, nscale: 2, amount: 0.75 });
  for (const p of Object.values(PATHS)) paintPath(g, p, 'dirt', 2.8, { wear: 0.3, amount: 0.85, noise: 1.2 });
  // marsh pools, abbey floor, spider hollow gloom
  g.paint('mud', { sd: (x, z) => marshD(x, z) - 2.5, box: [-110, -20, -60, 40] }, { soft: 2, noise: 1.5, nscale: 2 });
  g.info('wet', { sd: (x, z) => marshD(x, z) - 1.5, box: [-110, -20, -60, 40] }, { soft: 1.5, amount: 0.9 });
  g.paint('flagstone', S.rect(ABBEY[0], ABBEY[1], 30, 11, 0), { soft: 1, noise: 1.5, nscale: 2, amount: 0.85 });
  g.paint('flagstone', S.circle(ABBEY[0] + 15, ABBEY[1], 5.5), { soft: 1, noise: 1.2, nscale: 2, amount: 0.8 });
  g.paint('moss', S.rect(ABBEY[0], ABBEY[1], 30, 11, 0), { soft: 2, noise: 2.5, nscale: 1.5, amount: 0.35 });
  g.paint('dirt', S.circle(HOLLOW[0], HOLLOW[1], 13), { soft: 3, noise: 2, nscale: 2.5 });
  g.paint('rock', S.circle(HOLLOW[0], HOLLOW[1], 14), { soft: 2, noise: 3, nscale: 2, amount: 0.4 });
  g.paint('gravel', S.circle(CIRCLE[0], CIRCLE[1], 7), { soft: 2, noise: 1.5, nscale: 2, amount: 0.7 });
  g.paint('dirt', S.circle(CAMP[0], CAMP[1], 8), { soft: 3, noise: 2, nscale: 2 });
  g.paint('dirt', S.circle(LOGCAMP[0], LOGCAMP[1], 10), { soft: 3, noise: 2, nscale: 2 });
  g.paint('sand', S.circle(LOGCAMP[0] + 2, LOGCAMP[1] - 2, 4), { soft: 2, noise: 1, nscale: 2, amount: 0.6 });
  g.paint('gravel', S.circle(CHAOS[0], CHAOS[1], 8), { soft: 3, noise: 2.5, nscale: 2.5, amount: 0.7 });
  await tick();

  // ---------------------------------------------------------------- structures & props
  const kit = new FieldKit({ seed: 41 });
  const flags = new Flags();
  const smoke = [];
  const R = (x, z, o) => F.rock(kit, x, H(x, z), z, { tint: 0x8e948a, moss: 0x4a6a3a, mossAmt: 0.55, ...o });
  // --- Wardens' Camp
  const [cx0, cz0] = CAMP;
  const lodge = F.cottage(kit, cx0 - 2, H(cx0 - 2, cz0 - 9), cz0 - 9, 0.05, { w: 8, d: 5.5, h: 2.9, seed: 8, roof: 'slate', roofTint: 0x4a5a54, plaster: 0x9a8a70, beam: 0x3a2a1c, shutter: 0x3a5a4a, chimney: true, porch: true });
  if (lodge.chimney) smoke.push({ x: lodge.chimney[0], y: lodge.chimney[1], z: lodge.chimney[2], size: 0.5, h: 8, rate: 0.6, color: 0x7a8a88 });
  F.tent(kit, cx0 + 8, H(cx0 + 8, cz0 - 3), cz0 - 3, -0.5, { color: 0x4a6a4a, patch: 0x3a4a3a });
  F.tent(kit, cx0 - 9, H(cx0 - 9, cz0 + 2), cz0 + 2, 0.7, { color: 0x5a6a4a, patch: 0x3a4a3a });
  const cf = F.campfire(kit, cx0 + 1, H(cx0 + 1, cz0 + 1), cz0 + 1, { seed: 4 }); smoke.push({ x: cf.x, y: cf.y, z: cf.z, size: 0.5, h: 7, rate: 1, color: 0x6a7472, glow: 0x8a3a10 });
  B.triport(kit, cx0 + 10, H(cx0 + 10, cz0 + 7), cz0 + 7);
  P.noticeBoard(kit, cx0 - 6.5, H(cx0 - 6.5, cz0 - 3.5), cz0 - 3.5, 0.3);
  P.weaponRack(kit, cx0 + 4, H(cx0 + 4, cz0 - 5.5), cz0 - 5.5, 0);
  F.woodpile(kit, cx0 + 3.5, H(cx0 + 3.5, cz0 - 10), cz0 - 10, 0.1, { n: 5 });
  for (let i = 0; i < 4; i++) F.lanternPost(kit, cx0 + [-11, 11, -8, 12][i], H(cx0, cz0), cz0 + [-6, -8, 9, 2][i], i);
  flags.add(M(cx0 + 5.1, H(cx0 + 5, cz0 + 6) + 5.6, cz0 + 6), 1.3, 0.7, 0x2e6a4a, { hang: 'left' });
  kit.add('timber', cyl(0.06, 0.07, 5.8, 5, 1), M(cx0 + 5.05, H(cx0 + 5, cz0 + 6) + 2.8, cz0 + 6), { tint: 0x5a4028, ao: false }); kit.block(S.circle(cx0 + 5.05, cz0 + 6, 0.15), 0.2);
  // --- the Thorn Arch over the road
  W.thornArch(kit, ARCH[0] - 5, ARCH[1] + 1, ARCH[0] + 5, ARCH[1] - 1, H, { h: 5.2, seed: 3 });
  const shrine = [ARCH[0] + 7, ARCH[1] + 4]; W.runeStone(kit, shrine[0], H(...shrine), shrine[1], -0.3, { glyph: 0x70e0b0 });
  // --- the Hollow Oak
  const hollowOak = { x: HOAK[0], z: HOAK[1] };
  // --- the ruined Abbey: nave, aisles of broken columns, apse, bell-tower stump, cloister ruins, graveyard
  const [ax0, az0] = ABBEY, AH = H(ax0, az0);
  const Hc = () => AH;
  F.ruinWall(kit, ax0 - 15, az0 - 5.5, ax0 + 11, az0 - 5.5, Hc, { h: 6.5, t: 1.1, seed: 2, tint: 0x9a9c8e, moss: 0x4a6a3a, window: true });
  F.ruinWall(kit, ax0 - 15, az0 + 5.5, ax0 - 6, az0 + 5.5, Hc, { h: 3.2, t: 1.0, seed: 3, tint: 0x9a9c8e, moss: 0x4a6a3a });
  F.ruinWall(kit, ax0 + 3, az0 + 5.5, ax0 + 11, az0 + 5.5, Hc, { h: 2.4, t: 1.0, seed: 4, tint: 0x9a9c8e, moss: 0x4a6a3a });
  F.ruinWall(kit, ax0 - 15, az0 - 5.5, ax0 - 15, az0 + 1.5, Hc, { h: 5, t: 1.1, seed: 5, tint: 0x9a9c8e, moss: 0x4a6a3a });
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI, x = ax0 + 11 + Math.cos(a) * 5.5, z = az0 + Math.sin(a) * 5.5; if (i === 4 || i === 5) continue; F.ruinWall(kit, x, z, ax0 + 11 + Math.cos(a + Math.PI / 8) * 5.5, az0 + Math.sin(a + Math.PI / 8) * 5.5, Hc, { h: 4 + Math.sin(i) * 1.5, t: 0.9, seed: 10 + i, tint: 0x9a9c8e, moss: 0x4a6a3a }); }
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const x = ax0 - 11 + i * 4.5, z = az0 + s * 2.6; if (i === 3 && s > 0) continue; P.column(kit, x, AH, z, rng.range(1.2, 4.6), 0.38, { mat: 'stone', tint: 0xa4a698, capital: false }); }
  F.archRuin(kit, ax0 - 15, AH, az0 + 3.5, Math.PI / 2, { w: 3.4, h: 4.8, tint: 0x9a9c8e });
  F.ruinTower(kit, ax0 - 19, AH, az0 - 7, { r: 2.6, h: 9, seed: 7, tint: 0x9a9c8e, moss: 0x4a6a3a });
  for (let i = 0; i < 6; i++) { const x = ax0 - 8 + rng.range(-4, 12), z = az0 + rng.range(-3, 3); kit.add('stone', box(rng.range(0.8, 1.6), 0.5, rng.range(0.6, 1), 1), M(x, AH + 0.2, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.2, 0.2)), { tint: 0x8a8c80 }); }
  const alt = [ax0 + 10.5, az0]; W.altar(kit, alt[0], AH, alt[1], -Math.PI / 2, { cloth: 0x4a1a4a, glow: 0xb040ff });
  P.brazier(kit, ax0 + 7.5, AH, az0 - 3.4, { s: 0.8, color: 0xc070ff, glow: 0xa050ff }); P.brazier(kit, ax0 + 7.5, AH, az0 + 3.4, { s: 0.8, color: 0xc070ff, glow: 0xa050ff });
  for (let i = 0; i < 4; i++) W.candles(kit, ax0 - 4 + i * 4, AH, az0 + (i % 2 ? 2 : -2), { n: 4, seed: i, color: 0xffb060 });
  for (let i = 0; i < 3; i++) { flags.add(M(ax0 - 8 + i * 6, AH + 5.2, az0 - 4.9), 1.0, 2.6, 0x3a1040, { hang: 'top', trim: 0x8a40a0 }); kit.add('metal', box(1.3, 0.06, 0.06, 1), M(ax0 - 8 + i * 6, AH + 5.2, az0 - 4.95), { tint: 0x2a2a2a, ao: false }); }
  const graves = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const x = ax0 - 12 + c * 3.2 + rng.range(-0.3, 0.3), z = az0 + 10 + r * 2.8; F.gravestone(kit, x, H(x, z), z, rng.range(-0.15, 0.15), { kind: (r + c) % 3 === 0 ? 1 : 0, lean: rng.range(-0.15, 0.15), tint: 0x8a8c80 }); graves.push([x, z]); }
  F.ruinWall(kit, ax0 - 15, az0 + 8, ax0 + 4, az0 + 8, (x, z) => H(x, z), { h: 1.1, t: 0.6, seed: 12, tint: 0x8a8c80 });
  const lore1 = [ax0 - 4, az0 + 7]; W.runeStone(kit, lore1[0], H(...lore1), lore1[1], 0, { glyph: 0xffd070, tint: 0x9a9a90 });
  // --- the Fallen Giant across the misty creek
  const fg = W.fallenGiant(kit, FG.ax, FG.az, FG.bx, FG.bz, FGtop, { r: 1.5, seed: 5 });
  zone.deck(fg.deck, fg.y);
  // --- the Moonlit Pool
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = POOL.r + rng.range(0.8, 2.6), x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d; W.moonflowers(kit, x, H(x, z), z, { n: 4, seed: i }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, d = POOL.r + 3.2, x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d; R(x, z, { s: rng.range(0.5, 0.9), seed: 70 + i }); }
  kit.light(POOL.x, H(POOL.x, POOL.z) + 2, POOL.z, 0xa0d0ff, 4, 12, 0.05);
  // --- the Cultist Circle
  const [ci0, cj0] = CIRCLE;
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.2, x = ci0 + Math.cos(a) * 7.5, z = cj0 + Math.sin(a) * 7.5; F.standingStone(kit, x, H(x, z), z, { h: rng.range(2.6, 3.6), w: 1.1, rot: -a + Math.PI / 2, tint: 0x6a6a64, glyph: 0xb040ff }); }
  W.altar(kit, ci0, H(ci0, cj0), cj0 - 1.2, 0, { cloth: 0x2a0a2a, glow: 0xc050ff });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.8; P.brazier(kit, ci0 + Math.cos(a) * 4.6, H(ci0, cj0), cj0 + Math.sin(a) * 4.6, { s: 0.7, color: 0xc070ff, glow: 0xa050ff }); }
  W.bonePile(kit, ci0 + 3, H(ci0 + 3, cj0 + 3), cj0 + 3, { seed: 3 });
  const lore2 = [ci0 - 3.4, cj0 + 3.2];
  // second, smaller circle to the north-east
  const C2 = [58, -24];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, x = C2[0] + Math.cos(a) * 4.5, z = C2[1] + Math.sin(a) * 4.5; F.standingStone(kit, x, H(x, z), z, { h: rng.range(1.8, 2.6), w: 0.9, rot: -a + Math.PI / 2, tint: 0x6a6a64, glyph: 0xb040ff }); }
  W.candles(kit, C2[0], H(...C2), C2[1], { n: 7, r: 1.2, seed: 9, color: 0xc070ff });
  // --- the Spider Hollow: webs between trees, cocoons, egg sacs, bones
  const [sh0, sj0] = HOLLOW;
  const webTrees = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rng.range(-0.2, 0.2), d = rng.range(9, 13); webTrees.push([sh0 + Math.cos(a) * d, sj0 + Math.sin(a) * d]); }
  for (let i = 0; i < webTrees.length; i++) { const [x0, z0] = webTrees[i], [x1, z1] = webTrees[(i + 1) % webTrees.length]; if (i % 3 === 2) continue; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; W.web(kit, mx, H(mx, mz) + 3.0, mz, Math.atan2(-(z1 - z0), x1 - x0), { r: Math.hypot(x1 - x0, z1 - z0) * 0.42, seed: i, tilt: rng.range(-0.4, 0.2) }); }
  W.web(kit, sh0 - 2, H(sh0, sj0) + 0.25, sj0 - 3, 0.4, { r: 3.2, seed: 21, tilt: -Math.PI / 2 + 0.2 });
  for (let i = 0; i < 6; i++) { const [x, z] = webTrees[i]; W.cocoon(kit, x + 1.2, H(x, z) + 5.2, z + 0.4, { s: rng.range(0.8, 1.2), hang: rng.range(1.0, 2.2) }); }
  for (const [x, z] of [[sh0 + 3, sj0 + 2], [sh0 - 5, sj0 + 4], [sh0 + 6, sj0 - 5]]) W.eggSacs(kit, x, H(x, z), z, { seed: Math.round(x) });
  for (let i = 0; i < 4; i++) W.bonePile(kit, sh0 + rng.range(-8, 8), H(sh0, sj0), sj0 + rng.range(-8, 8), { seed: 30 + i });
  // --- the Owl Roost: a great dead tree with owls in its crown and on stumps
  const [ow0, oj0] = OWLS;
  for (const [x, z, s, rot] of [[ow0 - 2.2, oj0 + 1.2, 1.2, 0.2], [ow0 + 2.6, oj0 - 0.4, 1.0, -0.3], [ow0 + 0.2, oj0 + 3.4, 0.9, 0.1]]) { F.stump(kit, x, H(x, z), z, { r: 0.45, h: 1.1 * s, seed: Math.round(x) }); W.owl(kit, x, H(x, z) + 1.08 * s, z, rot); }
  // --- the Treant Grove (the great tree is placed with the flora), a ring of stones and moss
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = GROVE[0] + Math.cos(a) * 11, z = GROVE[1] + Math.sin(a) * 11; R(x, z, { s: rng.range(0.6, 1.0), seed: 90 + i, mossAmt: 0.9 }); }
  for (let i = 0; i < 6; i++) { const a = rng.range(0, 6.28), d = rng.range(5, 9), x = GROVE[0] + Math.cos(a) * d, z = GROVE[1] + Math.sin(a) * d; W.glowShrooms(kit, x, H(x, z), z, { color: 0x60e0ff, seed: 40 + i, light: i % 2 === 0 }); }
  // --- the Hollow Glade (field boss): a ring of roots and old stumps
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.1, x = GLADE[0] + Math.cos(a) * 18.5, z = GLADE[1] + Math.sin(a) * 18.5; if (i % 3 === 0) F.stump(kit, x, H(x, z), z, { r: 0.8, h: 1.2, seed: i }); else R(x, z, { s: rng.range(0.8, 1.3), seed: 110 + i }); }
  // --- the Witch Lights: a marsh with a hut on stilts, a cauldron, hovering lights
  const [mw0, mj0] = MARSH;
  const hut = W.stiltHut(kit, mw0 - 4, H(mw0 - 4, mj0 - 6), mj0 - 6, 0.25, { seed: 6 });
  if (hut.chimney) smoke.push({ x: hut.chimney[0], y: hut.chimney[1], z: hut.chimney[2], size: 0.45, h: 5, rate: 0.5, color: 0x6a8a70 });
  W.cauldron(kit, mw0 + 1, H(mw0 + 1, mj0 - 2), mj0 - 2, { liquid: 0x60ff90 });
  const wisps = []; for (let i = 0; i < 9; i++) { const x = mw0 + rng.range(-12, 12), z = mj0 + rng.range(-10, 12), y = H(x, z) + rng.range(1.0, 2.2); kit.glow(new THREE.SphereGeometry(0.14, 8, 6), M(x, y, z), 0x80ffd0, 3.2); wisps.push([x, y, z]); if (i % 3 === 0) kit.light(x, y, z, 0x60ffc0, 2.5, 6, 0.3); }
  // --- the Abandoned Logging Camp
  const [lg0, lj0] = LOGCAMP;
  F.cottage(kit, lg0 - 5, H(lg0 - 5, lj0 - 6), lj0 - 6, 0.3, { w: 5, d: 4.2, h: 2.5, seed: 17, roof: 'slate', roofTint: 0x5a5a50, plaster: 0x7a6a58, beam: 0x3a2a1c, chimney: false, burnt: 0.25 });
  W.sawpit(kit, lg0 + 4, H(lg0 + 4, lj0 - 3), lj0 - 3, 0.2);
  P.logPile(kit, lg0 - 4, H(lg0 - 4, lj0 + 5), lj0 + 5, 0.4, { n: 4, len: 4 }); P.logPile(kit, lg0 + 6, H(lg0 + 6, lj0 + 5), lj0 + 5, -0.2, { n: 3, len: 3.5 });
  for (let i = 0; i < 7; i++) { const a = rng.range(0, 6.28), d = rng.range(6, 11), x = lg0 + Math.cos(a) * d, z = lj0 + Math.sin(a) * d; F.stump(kit, x, H(x, z), z, { r: rng.range(0.4, 0.7), h: rng.range(0.4, 0.8), seed: 50 + i }); }
  kit.add('planks', box(1.6, 0.4, 2.6, 1), M(lg0 + 1, H(lg0 + 1, lj0 + 1) + 0.5, lj0 + 1, 0.9, 1, 1, 1, 0, 0.35), { tint: 0x6a5038 }); kit.block(S.rect(lg0 + 1, lj0 + 1, 1.8, 2.8, 0.9), 0.3);
  kit.add('metal', box(0.08, 1.2, 0.5, 1), M(lg0 + 2.4, H(lg0 + 2.4, lj0 - 7) + 0.6, lj0 - 7, 0.4, 1, 1, 1, 0.3), { tint: 0x5a5a5a });
  // --- the Toadstool Ring
  const TR = []; for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, x = TOADS[0] + Math.cos(a) * 5.2, z = TOADS[1] + Math.sin(a) * 5.2; TR.push([x, z]); }
  // --- chaos clearing: a split, scorched stone
  F.standingStone(kit, CHAOS[0] + 2, H(CHAOS[0] + 2, CHAOS[1] - 6), CHAOS[1] - 6, { h: 3.4, w: 1.4, tint: 0x4a4644, glyph: 0xc050ff });
  // --- gates: the south road from Goldmeadow and the north-east road to Ashen Ridge
  for (const s of [-1, 1]) F.standingStone(kit, -20 + s * 4.4, H(-20 + s * 4.4, 100), 100, { h: 2.4, w: 1.0, tint: 0x6a6a64, glyph: 0x60e0a0 });
  F.signpost(kit, -14, H(-14, 94), 94, 0, { arms: [0.4, -2.6] });
  for (const s of [-1, 1]) F.standingStone(kit, 70 + s * 4.6, H(70 + s * 4.6, -98), -98, { h: 2.6, w: 1.0, tint: 0x5a5452, glyph: 0xff7040 });
  F.signpost(kit, 62, H(62, -90), -90, 0, { arms: [1.0, -2.4] });
  // --- roadside: old milestones, root arches over side paths, rocks
  for (let s = 12; s < 240; s += 31) { const p = along(ROAD, s), x = p.x - p.dz * 3.8, z = p.z + p.dx * 3.8; if (bound.sd(x, z) < -3) F.standingStone(kit, x, H(x, z), z, { h: 1.1, w: 0.55, rot: Math.atan2(p.dx, p.dz), tint: 0x8a8a80 }); }
  const rootSpots = [[PATHS.hollow, 18], [PATHS.grove, 10], [PATHS.logs, 22], [PATHS.pool, 16], [PATHS.glade, 12], [PATHS.marsh, 14]];
  for (const [path, s] of rootSpots) { const p = along(path, s); W.rootArch(kit, p.x - p.dz * 3.4, p.z + p.dx * 3.4, p.x + p.dz * 3.4, p.z - p.dx * 3.4, H, { h: 2.6, r: 0.5 }); }
  for (let s2 = 6; s2 < 230; s2 += 5.5) { const p = along(CREEK, s2 + rng.range(-2, 2)), side = rng.sign(), d = rng.range(3.6, 4.6), x = p.x - p.dz * d * side, z = p.z + p.dx * d * side; if (bound.sd(x, z) > 2 || roadD.at(x, z) < 3 || Math.hypot(x - (FG.ax + FG.bx) / 2, z - (FG.az + FG.bz) / 2) < 10) continue; if (rng.chance(0.7)) R(x, z, { s: rng.range(0.35, 0.8), seed: Math.round(s2 * 3), mossAmt: 0.7, block: false }); else F.log(kit, x, H(x, z) - 0.2, z, Math.atan2(-p.dz, p.dx) + rng.range(-0.5, 0.5), { len: rng.range(2, 3.5), r: 0.22, tint: 0x5a4a38, moss: 0x3e6a2a, block: false }); }
  for (const [px, pz, pr] of MPOOLS) for (let i = 0; i < 3; i++) { const a = rng.range(0, 6.28), x = px + Math.cos(a) * (pr + 1), z = pz + Math.sin(a) * (pr + 1); R(x, z, { s: rng.range(0.3, 0.55), seed: Math.round(px * i), mossAmt: 0.8, block: false }); }
  const free = (x, z, rr = 3, road = 4) => bound.sd(x, z) < -rr && roadD.at(x, z) > road && chanD(x, z) > 5 && ![[...CAMP, 14], [...ABBEY, 20], [...CIRCLE, 11], [...GLADE, 19], [...GROVE, 14], [...LOGCAMP, 11], [...MARSH, 13], [...HOLLOW, 13], [...CHAOS, 11], [...TOADS, 7], [...OWLS, 6], [POOL.x, POOL.z, 10]].some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er + rr);
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 13, 400, (x, z) => free(x, z, 1.5, 3.2) && rng.chance(0.6))) {
    const k = rng.next();
    if (k < 0.4) F.rockCluster(kit, x, z, H, { n: rng.int(1, 3), s: rng.range(0.6, 1.3), seed: Math.round(x * 31 + z), tint: 0x8e948a, moss: 0x4a6a3a });
    else if (k < 0.65) F.log(kit, x, H(x, z), z, rng.range(0, 3), { len: rng.range(3.5, 6), r: rng.range(0.35, 0.55), tint: 0x5a4a38, moss: 0x3e6a2a });
    else if (k < 0.8) F.stump(kit, x, H(x, z), z, { r: rng.range(0.5, 0.9), h: rng.range(0.5, 1.0), seed: Math.round(x + z * 7) });
    else W.glowShrooms(kit, x, H(x, z), z, { color: rng.chance(0.5) ? 0x60e0ff : 0x9a70ff, seed: Math.round(x * 3 + z), light: rng.chance(0.3), s: rng.range(0.8, 1.2) });
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.35 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  await tick();

  // ---------------------------------------------------------------- water
  const creek = buildWater(g, { x: -54, z: 16, w: 60, d: 240, level: WL, shallow: 0x2e5a4e, deep: 0x0a1c1e, sky: 0x2a4442, swell: 0.01, foam: 0.35 });
  const marshW = buildWater(g, { x: -86, z: 8, w: 24, d: 30, level: -0.3, shallow: 0x2a3a22, deep: 0x0e160a, sky: 0x2a3a2a, swell: 0, foam: 0.08 });
  zone.root.add(creek, marshW);

  // ---------------------------------------------------------------- foliage
  const flora = new FieldFlora({ cell: 80 });
  const T = (sp, x, z, o = {}) => flora.tree(sp, x, H(x, z) - 0.15, z, { rot: rng.range(0, 6.28), ...o });
  const DK = { dark: 0x0e2a1a, light: 0x4a7a4a, core: 0x08160e };
  // ancients: huge trees well away from paths; the Hollow Oak and the Treant Grove's heart-tree
  T('ancient', HOAK[0], HOAK[1], { s: 1.25, variant: 0 });
  T('ancient', GROVE[0], GROVE[1] - 2, { s: 1.6, variant: 1 });
  const ancients = scatter(rng, [-104, -104, 104, 104], 26, 260, (x, z) => free(x, z, 5, 9));
  for (const [x, z] of ancients) T('ancient', x, z, { s: rng.range(0.85, 1.15), variant: rng.int(0, 1) });
  // the forest body: firs, dark oaks, pines, snags — dense but clear of paths & clearings
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 6.2, 2600, (x, z) => free(x, z, 2, 5.5), ancients)) {
    const k = rng.next(), edge = bound.sd(x, z) > -14;
    if (k < (edge ? 0.45 : 0.14)) T('fir', x, z, { s: rng.range(0.85, 1.1), variant: 0 });
    else if (k < 0.9) T('oak', x, z, { s: rng.range(0.95, 1.3), variant: rng.int(0, 1), opts: DK });
    else T('dead', x, z, { s: rng.range(0.8, 1.2), variant: 0, opts: { tint: 0x5a5048 } });
  }
  // the web trees around the Spider Hollow, the owls' great snag
  for (const [x, z] of webTrees) T('dead', x, z, { s: rng.range(1.0, 1.3), variant: 0, opts: { tint: 0x5a5048 } });
  T('dead', OWLS[0], OWLS[1] - 3, { s: 1.6, variant: 0, opts: { tint: 0x5a5048 } });
  // beyond the outline: a wall of trees
  for (const [x, z] of scatter(rng, [-150, -150, 150, 150], 5.5, 2600, (x, z) => { const sd = bound.sd(x, z); return sd > 2 && sd < 30 && roadD.at(x, z) > 5; })) { if (rng.chance(0.55)) T('fir', x, z, { s: rng.range(1.0, 1.4), variant: 0, block: false }); else T('oak', x, z, { s: rng.range(1.1, 1.4), variant: rng.int(0, 1), opts: DK, block: false }); }
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 5, 1400, (x, z) => free(x, z, 0.8, 3.5))) T('bush', x, z, { s: rng.range(0.7, 1.2), variant: 0, opts: { dark: 0x12301a, light: 0x4a7a3a } });
  // ferns, forest-floor mushrooms, toadstool ring, reeds on the creek, marsh grass
  const fm = flora.mats.core;
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 2.2, 9000, (x, z) => free(x, z, 0.3, 2.8) && N.noise2(x / 16, z / 16 + 4) > -0.2)) flora.thing('fern' + (Math.round(x + z) & 1), () => fernGeo(Math.round(x + z) & 1, { h: 1.0, color: 0x2a5a2a, tip: 0x6a9a48 }), fm, x, H(x, z) - 0.05, z, { s: rng.range(0.7, 1.35), rot: rng.range(0, 6.28), cast: false });
  const shroomM = flora.mats.flower;
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 4, 1600, (x, z) => free(x, z, 0.3, 2.5) && rng.chance(0.5))) flora.thing('shroom' + (Math.round(x * 3) % 3 + 3) % 3, () => { const k = Math.abs(Math.round(x * 3)) % 3; return mushroomGeo({ h: 0.3 + k * 0.08, r: 0.2 + k * 0.05, cap: [0xb03020, 0xa07040, 0x7a5a8a][k], spots: 0xf0e8d8, spotN: k === 0 ? 9 : 0, seed: k }); }, shroomM, x, H(x, z) - 0.02, z, { s: rng.range(0.7, 1.4), rot: rng.range(0, 6.28), cast: false });
  for (const [x, z] of TR) flora.thing('toadstool', () => mushroomGeo({ h: 0.95, r: 0.6, cap: 0xc02818, spots: 0xfff4e0, spotN: 11, seed: 7, sway: 0.01 }), shroomM, x, H(x, z) - 0.05, z, { s: rng.range(0.8, 1.2), rot: rng.range(0, 6.28), cast: true });
  for (let s2 = 0; s2 < 230; s2 += 1.1) { const p = along(CREEK, s2); for (const side of [-1, 1]) { if (rng.chance(0.5)) continue; const d = rng.range(2.8, 4.2), x = p.x - p.dz * d * side, z = p.z + p.dx * d * side; if (bound.sd(x, z) > 3 || Math.hypot(x - (FG.ax + FG.bx) / 2, z - (FG.az + FG.bz) / 2) < 12) continue; flora.thing('reed' + (Math.round(s2) % 2), () => reedGeo(Math.round(s2) % 2, { color: 0x2a4a22, tip: 0x7a8a50, h: 1.4 }), shroomM, x, H(x, z) - 0.05, z, { s: rng.range(0.7, 1.1), rot: rng.range(0, 6.28), cast: false }); } }
  for (let i = 0; i < 90; i++) { const x = MARSH[0] + rng.range(-14, 14), z = MARSH[1] + rng.range(-13, 14); flora.thing('reed' + (i % 2), () => reedGeo(i % 2, { color: 0x2a4a22, tip: 0x7a8a50, h: 1.4 }), shroomM, x, H(x, z) - 0.05, z, { s: rng.range(0.6, 1.0), rot: rng.range(0, 6.28), cast: false }); }
  for (const [x, z] of scatter(rng, [-104, -104, 104, 104], 3, 2400, (x, z) => free(x, z, 0.3, 2.4) && g.weight('grass', x, z) > 0.5)) flora.thing('tgrass' + (Math.round(x) & 1), () => tallGrassGeo(Math.round(x) & 1, { h: 0.8, color: 0x2a4a22, tip: 0x8a9a60 }), shroomM, x, H(x, z) - 0.03, z, { s: rng.range(0.8, 1.2), rot: rng.range(0, 6.28), cast: false });
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new FieldGrass(g, { layer: 'grass', shape: 'grass', density: quality, height: 1.3 });
  zone.root.add(grass.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  const sprinkle = (kind, n, cx, cz, r, o = {}) => { for (let i = 0; i < n; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; dec.add(kind, x, z, { size: rng.range(o.s0 ?? 1, o.s1 ?? 2.2), alpha: o.a ?? 0.8, tint: o.tint ?? 0xffffff, emit: o.emit ?? 0, emitI: o.emitI ?? 0 }); } };
  for (let i = 0; i < 260; i++) { const x = rng.range(-104, 104), z = rng.range(-104, 104); if (free(x, z, 0, 2)) dec.add('leaves', x, z, { size: rng.range(1.5, 3), alpha: 0.75, tint: rng.pick([0x8a7a50, 0x6a7a40, 0x9a6a3a]) }); }
  sprinkle('rubble', 26, ABBEY[0], ABBEY[1], 14, { s0: 1, s1: 2.2 }); sprinkle('cracks', 14, ABBEY[0], ABBEY[1], 12, { s0: 1.5, s1: 3 });
  dec.add('runes', ABBEY[0] + 7, ABBEY[1], { size: 5, tint: 0xc070ff, emit: 0x9040ff, emitI: 1.1, alpha: 0.8 });
  dec.add('runes', CIRCLE[0], CIRCLE[1], { size: 11, tint: 0xc070ff, emit: 0x9040ff, emitI: 1.3, alpha: 0.85 });
  dec.add('runes', C2[0], C2[1], { size: 6, tint: 0xc070ff, emit: 0x9040ff, emitI: 1.0, alpha: 0.7 });
  sprinkle('blood', 6, CIRCLE[0], CIRCLE[1], 5, { a: 0.5 });
  sprinkle('stain', 16, HOLLOW[0], HOLLOW[1], 12, { s0: 2, s1: 4, a: 0.7, tint: 0x6a6a5a });
  sprinkle('scorch', 8, CHAOS[0], CHAOS[1], 7, { s0: 2, s1: 4 }); dec.add('runes', CHAOS[0], CHAOS[1], { size: 8, tint: 0xa060ff, emit: 0x8040ff, emitI: 0.9, alpha: 0.5 });
  sprinkle('puddle', 12, MARSH[0], MARSH[1], 12, { s0: 1.5, s1: 3 });
  sprinkle('pebbles', 20, CAMP[0], CAMP[1], 9); sprinkle('straw', 8, LOGCAMP[0] + 4, LOGCAMP[1] - 3, 3);
  for (let s2 = 4; s2 < 250; s2 += 7) { const p = along(ROAD, s2); dec.add(rng.chance(0.5) ? 'cracks' : 'moss', p.x + rng.range(-1.2, 1.2), p.z + rng.range(-1.2, 1.2), { size: rng.range(1.2, 2.2), alpha: 0.6 }); }
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx: light shafts, mist, fireflies, leaves, smoke
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const shafts = [];
  for (const [x, z, n] of [[...CAMP, 3], [...GLADE, 4], [...GROVE, 4], [...CIRCLE, 2], [...TOADS, 2], [POOL.x, POOL.z, 3], [...ABBEY, 3], [-20, 96, 2], [20, -20, 2], [...LOGCAMP, 2], [...CHAOS, 2], [...OWLS, 1]]) for (let i = 0; i < n; i++) shafts.push({ x: x + rng.range(-6, 6), y: H(x, z) - 0.5, z: z + rng.range(-5, 5), w: rng.range(2.2, 4.2), h: rng.range(12, 17), rot: 0.62 + rng.range(-0.1, 0.1), tilt: -0.5, alpha: rng.range(0.12, 0.2), color: 0xe0f4c8 });
  const shaftMesh = buildShafts(shafts); if (shaftMesh) zone.root.add(shaftMesh);
  const mist = new Mist(g, [{ y: 0.5, alpha: 0.2, scale: 20, speed: [0.35, 0.12], color: 0xa8c8c0 }, { y: 1.6, alpha: 0.1, scale: 36, speed: [-0.2, 0.25], color: 0xb8d0cc }]);
  const flies = buildParticles('fireflies', { quality, color: [1.6, 2.6, 1.2] });
  const leaves = buildDrifters('leaves', { quality, count: 45, scale: 0.7, colors: [0x6a7a30, 0x8a6a2a, 0x4a6a2a, 0x9a8040] });
  const motes = buildParticles('dust', { quality, color: [0.9, 1.2, 1.0] });
  const smokeMesh = buildSmoke(smoke);
  for (const m of [mist.group, flies, leaves, motes, smokeMesh]) if (m) zone.root.add(m);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); flies.userData.update(focus); leaves.userData.update(focus); motes.userData.update(focus); mist.update(focus, H); grass.update(focus); });
  zone.onEnv(env => { pool.scale = 0.9 + env.night * 1.2; kitMaterial('window').emissiveIntensity = 0.5 + env.night * 1.4; waterEnv(creek, env, { sky: 0.32, sun: 0.7 }); waterEnv(marshW, env, { sky: 0.25, sun: 0.5 }); });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-108, -114, 216, 228, 0.5);
  nav.walk(S.inflate(bound, -0.6));
  nav.blockWhere((x, z) => chanD(x, z) < 2.6 || marshD(x, z) < -0.4);
  nav.walk(fg.deck);
  // a shallow ford by the logging camp
  const ford = along(CREEK, 196), fordShape = S.rect(ford.x, ford.z, 4, 7, Math.atan2(-ford.dz, ford.dx) + Math.PI / 2);
  nav.walk(fordShape);
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[-20, 98]]);
  zone._nav = nav; zone.nav = nav.toContract();
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = new Anchors(zone);
  A.add('spawn', -20, 97, 0);
  A.add('gate:goldmeadow', -20, 107.5, Math.PI);
  A.add('gate:ashen_ridge', 72, -106, 0);
  A.add('triport:thornwood', CAMP[0] + 10, CAMP[1] + 9.6, faceTo(CAMP[0] + 10, CAMP[1] + 9.6, CAMP[0], CAMP[1]));
  A.npc('warden', CAMP[0] - 1.5, CAMP[1] - 4.8, Math.PI + 0.1);
  A.npc('herbalist', CAMP[0] + 6, CAMP[1] + 1.5, faceTo(CAMP[0] + 6, CAMP[1] + 1.5, CAMP[0], CAMP[1] + 4));
  A.npc('scholar', ABBEY[0] - 2, ABBEY[1] + 7.5, Math.PI);
  A.npc('woodcutter', LOGCAMP[0] + 1.5, LOGCAMP[1] - 1, faceTo(LOGCAMP[0] + 1.5, LOGCAMP[1] - 1, LOGCAMP[0] + 8, LOGCAMP[1] + 2));
  A.npc('pilgrim', shrine[0] - 1.5, shrine[1] + 1.4, faceTo(shrine[0] - 1.5, shrine[1] + 1.4, ARCH[0], ARCH[1] + 2));
  A.npc('trapper', HOLLOW[0] - 16, HOLLOW[1] + 4, faceTo(HOLLOW[0] - 16, HOLLOW[1] + 4, HOLLOW[0], HOLLOW[1]));
  A.npc('witch', MARSH[0] + 3, MARSH[1] - 0.5, Math.PI - 0.3);
  // packs
  A.pack(HOLLOW[0], HOLLOW[1], 9, 'spiders'); A.pack(HOLLOW[0] + 12, HOLLOW[1] - 14, 7, 'spiders'); A.pack(84, 36, 7, 'spiders');
  A.pack(ABBEY[0] - 2, ABBEY[1], 8, 'cultists'); A.pack(CIRCLE[0], CIRCLE[1] + 2, 7, 'cultists'); A.pack(C2[0], C2[1], 6, 'cultists');
  A.pack(GROVE[0] + 2, GROVE[1] + 6, 9, 'treant'); A.pack(-30, -84, 7, 'treant');
  A.pack(28, -8, 7, 'wolves'); A.pack(-70, -8, 7, 'wolves'); A.pack(84, 70, 7, 'wolves');
  A.pack(MARSH[0], MARSH[1] + 4, 8, 'wisps'); A.pack(ABBEY[0] - 6, ABBEY[1] + 12, 6, 'skeletons'); A.pack(24, 96, 7, 'spiders');
  A.elite(HOLLOW[0] + 1, HOLLOW[1] - 2, 'spiders'); A.elite(CIRCLE[0], CIRCLE[1] + 3.5, 'cultists'); A.elite(GROVE[0], GROVE[1] + 9, 'treant'); A.elite(ABBEY[0] + 6, ABBEY[1], 'cultists');
  A.add('fieldboss', GLADE[0], GLADE[1], Math.PI, { r: 16 });
  A.add('chaosgate', CHAOS[0], CHAOS[1], Math.PI, { r: 9 });
  A.node('forage', CAMP[0] - 12, CAMP[1] + 10); A.node('forage', TOADS[0] + 7, TOADS[1] - 3); A.node('forage', POOL.x + 10, POOL.z + 8);
  A.node('log', -30, 52); A.node('log', 36, -76); A.node('log', LOGCAMP[0] - 9, LOGCAMP[1] + 1);
  A.node('mine', 88, 18); A.node('hunt', 22, 64); A.node('hunt', -84, -60);
  A.node('fish', ford.x + 3, ford.z - 5, faceTo(ford.x + 3, ford.z - 5, ford.x, ford.z - 5)); A.node('fish', POOL.x + 1, POOL.z + 9.5, Math.PI);
  A.node('dig', ABBEY[0] - 12, ABBEY[1] + 16);
  A.add('vista:moonpool', POOL.x + 2, POOL.z + 9.5, Math.PI);
  A.add('vista:giant_tree', FG.bx + (FG.bx - FG.ax) * 0.02, FG.bz + (FG.bz - FG.az) * 0.02, faceTo(FG.ax, FG.az, FG.bx, FG.bz));
  A.add('lore:1', lore1[0], lore1[1] + 1.4, Math.PI);
  A.add('lore:2', lore2[0], lore2[1], faceTo(lore2[0], lore2[1], CIRCLE[0], CIRCLE[1]));
  A.add('lore:3', shrine[0], shrine[1] + 1.5, Math.PI);
  A.poi('wardens_camp', CAMP[0], CAMP[1] + 5, Math.PI); A.poi('thorn_arch', ARCH[0], ARCH[1] + 4, 0); A.poi('abbey', ABBEY[0] + 2, ABBEY[1] + 8, 0);
  A.poi('cultist_altar', ABBEY[0] + 8, ABBEY[1], -Math.PI / 2); A.poi('cultist_circle', CIRCLE[0], CIRCLE[1] + 9, 0); A.poi('spider_hollow', HOLLOW[0] - 12, HOLLOW[1] + 2, -Math.PI / 2);
  A.poi('treant_grove', GROVE[0], GROVE[1] + 12, 0); A.poi('moonlit_pool', POOL.x + 3, POOL.z + 10, 0); A.poi('fallen_giant', FG.ax + 3, FG.az + 2, faceTo(FG.ax, FG.az, FG.bx, FG.bz));
  A.poi('hollow_oak', HOAK[0], HOAK[1] + 5, 0); A.poi('toadstool_ring', TOADS[0], TOADS[1] + 6, 0); A.poi('witch_lights', MARSH[0] + 6, MARSH[1] + 6, 0);
  A.poi('logging_camp', LOGCAMP[0] + 6, LOGCAMP[1] + 4, 0); A.poi('owl_roost', OWLS[0], OWLS[1] + 6, 0); A.poi('misty_creek', ford.x + 4, ford.z, -Math.PI / 2);
  A.poi('hollow_glade', GLADE[0], GLADE[1] + 16, 0); A.poi('ashen_road', 64, -88, 0);
  const SPOTS = [
    { name: 'the hollow oak', at: [[HOAK[0], HOAK[1] + 2.4], [HOAK[0] + 3.2, HOAK[1] - 2.8]] },
    { name: 'the spider nests', at: [[HOLLOW[0] + 3, HOLLOW[1] + 4], [HOLLOW[0] - 6, HOLLOW[1] + 2]] },
    { name: 'the cultist altar', at: [[ABBEY[0] + 8.6, ABBEY[1] + 1.8], [ABBEY[0] + 8.4, ABBEY[1] - 1.8]] },
    { name: 'the moonlit pool', at: [[POOL.x + 7.5, POOL.z - 3], [POOL.x - 8, POOL.z + 3]] },
    { name: 'the toadstool ring', at: [[TOADS[0], TOADS[1]], [TOADS[0] + 6.2, TOADS[1] + 1]] },
    { name: 'the fallen giant tree', at: [[FG.ax + 2, FG.az + 3], [(FG.ax + FG.bx) / 2, (FG.az + FG.bz) / 2]] },
    { name: 'the witch lights', at: [[MARSH[0] - 8, MARSH[1] + 8], [MARSH[0] + 6, MARSH[1] + 9]] },
    { name: 'the thorn arch', at: [[ARCH[0] - 4, ARCH[1] + 2.5], [ARCH[0] + 4, ARCH[1] - 2.5]] },
    { name: 'the treant grove', at: [[GROVE[0] + 5, GROVE[1] + 2], [GROVE[0] - 6, GROVE[1] + 5]] },
    { name: 'the abandoned logging camp', at: [[LOGCAMP[0] + 4, LOGCAMP[1] - 5], [LOGCAMP[0] - 7, LOGCAMP[1] + 3]] },
    { name: 'the owl roost', at: [[OWLS[0] - 1, OWLS[1] + 1], [OWLS[0] + 3, OWLS[1] + 2.6]] },
    { name: 'the misty creek', at: [[ford.x + 3, ford.z + 3], [ford.x - 3.5, ford.z - 4]] },
  ];
  for (const s of seedSpots('thornwood', SPOTS, 22)) A.add(`seed:${s.i}`, s.x, s.z, 0, { hint: `${s.where} ${s.name}` });
  aliasNumbered(zone, 'vista');
  snapAnchors(zone, nav, 6, 'thornwood');

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('Wardens’ Camp', CAMP[0], CAMP[1], 14); zone.region('The Thorn Arch', ARCH[0], ARCH[1], 8); zone.region('Ruined Abbey', ABBEY[0], ABBEY[1], 20);
  zone.region('The Fallen Giant', (FG.ax + FG.bx) / 2, (FG.az + FG.bz) / 2, 10); zone.region('Moonlit Pool', POOL.x, POOL.z, 12); zone.region('Cultist Circle', CIRCLE[0], CIRCLE[1], 12);
  zone.region('Spider Hollow', HOLLOW[0], HOLLOW[1], 15); zone.region('Owl Roost', OWLS[0], OWLS[1], 8); zone.region('The Hollow Glade', GLADE[0], GLADE[1], 18);
  zone.region('Treant Grove', GROVE[0], GROVE[1], 15); zone.region('Witch Lights', MARSH[0], MARSH[1], 13); zone.region('Logging Camp', LOGCAMP[0], LOGCAMP[1], 11);
  zone.region('Toadstool Ring', TOADS[0], TOADS[1], 7); zone.region('The Hollow Oak', HOAK[0], HOAK[1], 7); zone.region('Old Pilgrim Road', -10, 70, 10);
  const base = { music: 'thornwood', ambience: 'forest' };
  const day = makeEnv('day', {
    ...base, preset: 'forest', sunColor: 0xe8f4d0, sunIntensity: 2.9, sunDir: [-0.42, 0.74, 0.52],
    hemiSky: 0x9cc0b8, hemiGround: 0x2e3e2c, hemiIntensity: 1.3,
    fogColor: 0x4e7470, fogSunColor: 0xc8e0b0, fogDensity: 0.011, fogHeight: 0.09, fogBase: -1,
    background: 0x2e4a48,
    grade: { exposure: 1.12, saturation: 1.1, contrast: 1.1, vignette: 0.42, warm: 0.02, cool: 0.08, lift: [0.0, 0.012, 0.02], gain: [0.98, 1.03, 1.0], bloom: 0.7, bloomRadius: 0.6, bloomThreshold: 0.82 },
    weather: 'mist', night: 0.25,
  });
  zone.envs = { day, dusk: makeEnv('dusk', { ...base, fogColor: 0x6a5a6a, fogDensity: 0.016, night: 0.5 }), night: makeEnv('night', { ...base, ambience: 'forest_night', fogDensity: 0.014 }) };
  zone.env = day;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: { rect: r.rect }, color: r.color }));
  zone.minimap = paintMinimap(zone, {
    px: 512, area: { x0: -110, z0: -114, size: 224 }, roofs,
    marks: [{ shape: { line: ROAD }, color: '#8a7a5a', alpha: 0.8, width: 4 }, ...Object.values(PATHS).map(p => ({ shape: { line: p }, color: '#7a6a4a', alpha: 0.6, width: 2.4 })), { shape: { circle: [POOL.x, POOL.z, POOL.r] }, color: '#3a6a7a', alpha: 1 }],
  });
  { const ctx = zone.minimap.canvas.getContext('2d'), s = 512 / 224; ctx.save(); ctx.strokeStyle = '#3a6a7a'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); CREEK.forEach(([x, z], i) => { const u = (x + 110) * s, v = (z + 114) * s; i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.restore(); }
  zone.spots = kit.spots;
}

try { registerZone('thornwood', DEF, build); } catch { queueMicrotask(() => registerZone('thornwood', DEF, build)); }
