// 'brighthold' — the Siege of Brighthold, the prologue (~140×180 m, linear, levels 1–5). Night; the town burns.
//   The player lands at the burning harbour (south, 0, 82) and fights north up the main street through the lower town
//   (barricade, town square), up the ramp to the castle's outer gatehouse (0, 22) into the bailey. On the east side the
//   rampart terraces carry four cannons (cannon:1..4) that fire through the breach (48, −14), where the siege behemoth
//   Ashmaw batters the wall from outside. The inner gate (0, −40) leads to the courtyard before the burning keep: the
//   duel arena (0, −60) where Varkhul the Ravager waits.
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { tick } from '../zone.js';
import { NavGrid } from '../nav.js';
import { M, box, cyl, kitMaterial } from '../kit.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { buildWater } from '../water.js';
import { FieldGround, FieldKit, Anchors, snapAnchors, seedSpots, spline, along, paintPath, scatter, faceTo, waterEnv, S, RNG, smoothstep, lerp, clamp } from '../fields/common.js';
import { FieldGrass, FieldFlora } from '../fields/flora.js';
import { buildSmoke, buildDrifters } from '../fields/fx.js';
import * as F from '../fields/props.js';
import * as X from '../fields/ashen.js';

export const DEF = { name: 'Siege of Brighthold', kind: 'field', size: 180 };
const TOWN = 0, CASTLE = 4, TERR = 7.6, KEEP = 8, SEA = -2.2;
const ROOFS = [B.ROOF.blue, B.ROOF.deepblue, B.ROOF.red, B.ROOF.slate];

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 53);
  zone.bounds = { x0: -64, z0: -96, x1: 72, z1: 92 };
  const g = zone.ground = new FieldGround({
    x0: -130, z0: -150, w: 260, d: 300, res: 1, seed: 57, base: 'grass',
    layers: ['grass', 'cobble', 'flagstone', 'dirt', 'gravel', 'fan', 'rock', 'mud', 'sand'],
    ltint: { grass: [0.8, 0.86, 0.8] },
  });
  const N = g.noise;
  // ---------------------------------------------------------------- terrain: town slope, castle plateau, rampart terraces, keep hill, sea
  const TERRS = [S.rect(40.5, 4, 13, 18), S.rect(40.5, -30, 13, 12)];
  g.sculpt((x, z) => {
    let h = TOWN + smoothstep(40, 26, z) * CASTLE;                                  // town → castle
    if (z > 80) h = lerp(0, SEA - 3, smoothstep(88, 94, z));                       // quay edge → sea floor
    if (z < -76) h = KEEP + smoothstep(-80, -110, z) * 6 + N.fbm2(x / 20, z / 20, 2) * 1.2;
    // outside the castle: the cliffs west, the ditch east (Ashmaw's field)
    if (x < -52 && z < 30) h = CASTLE + 3 + smoothstep(-52, -62, x) * 8 + N.fbm2(x / 10, z / 10, 2) * 1.5;
    if (x > 47 && z < 24 && z > -44) h = lerp(h, CASTLE - 3.2 + N.fbm2(x / 14, z / 14, 2) * 0.6, smoothstep(47, 50, x));
    if (x > 62 && z < 24) h = lerp(h, CASTLE + 2, smoothstep(66, 76, x));
    // town edges: cliff west, sea east of the town
    if (x < -48 && z >= 30) h = TOWN + 2 + smoothstep(-48, -58, x) * 7 + N.fbm2(x / 10, z / 10, 2);
    if (x > 44 && z >= 24) h = lerp(h, SEA - 3, smoothstep(44, 52, x));
    return h;
  });
  const H = (x, z) => g.heightAt(x, z);
  // rampart terraces (walkable ramps on their west sides) and the breach slope
  for (const t of TERRS) g.flatten(t, TERR, 0.8);
  g.flatten(S.rect(31, 8, 7, 5), (x, z) => lerp(CASTLE, TERR, smoothstep(27.6, 34.2, x)), 0.6);        // ramp up to the south terrace
  g.flatten(S.rect(31, -30, 7, 5), (x, z) => lerp(CASTLE, TERR, smoothstep(27.6, 34.2, x)), 0.6);       // ramp up to the north terrace
  g.flatten(S.rect(47.5, -14, 6, 12), (x, z) => lerp(CASTLE, CASTLE - 3, smoothstep(45, 50.5, x)), 1);  // breach rubble slope
  g.flatten(S.rect(0, 29, 12, 12), (x, z) => lerp(TOWN + 0.4, CASTLE, smoothstep(35, 24, z)), 2);        // gate ramp
  await tick();

  // ---------------------------------------------------------------- paint
  g.paint('cobble', S.rect(0, 55, 94, 56), { soft: 1, noise: 1.5, nscale: 3 });
  g.paint('fan', S.rect(0, 52, 9, 52), { soft: 0.4 });
  g.paint('flagstone', S.circle(0, 52, 11), { soft: 0.5 });
  g.plaza(0, 52, 10.6, { layer: 'flagstone', tile: 2.6, rings: [3.4, 7.2, 10.2], spokes: 14, border: 0.5 });
  g.paint('fan', S.rect(-22, 70, 36, 6), { soft: 0.4 }); g.paint('fan', S.rect(22, 38, 36, 6), { soft: 0.4 });
  g.paint('flagstone', S.rect(0, 85, 90, 10), { soft: 0.5 });
  g.info('wet', S.rect(0, 88.5, 90, 3), { soft: 1.2, noise: 1, nscale: 2, amount: 0.8 });
  g.paint('dirt', S.rect(0, -8, 98, 58), { soft: 2, noise: 2.5, nscale: 3 });
  g.paint('gravel', S.rect(0, -8, 60, 30), { soft: 3, noise: 3, nscale: 3, amount: 0.6 });
  g.paint('fan', S.rect(0, -8, 9, 58), { soft: 0.4 });
  for (const t of TERRS) g.paint('flagstone', t, { soft: 0.4 });
  g.paint('mud', S.rect(52, -14, 14, 14), { soft: 3, noise: 3, nscale: 2 }); g.paint('dirt', S.rect(60, -12, 22, 60), { soft: 4, noise: 4, nscale: 4 });
  g.paint('flagstone', S.circle(0, -60, 15.5), { soft: 0.5 });
  g.plaza(0, -60, 15.2, { layer: 'flagstone', tile: 2.8, rings: [4.4, 9.6, 14.8], spokes: 16, border: 0.5 });
  g.paint('cobble', S.rect(0, -60, 96, 36), { soft: 1, noise: 2, nscale: 3, amount: 0.7 });
  g.paint('rock', { sd: (x, z) => Math.max(-(x + 52), z - 30), box: [-130, -150, -50, 32] }, { soft: 3, noise: 3, nscale: 4 });
  g.paint('rock', { sd: (x, z) => -(x + 48), box: [-130, 28, -46, 150] }, { soft: 3, noise: 3, nscale: 4 });
  g.paint('grass', { sd: (x, z) => -(z + 80), box: [-130, -150, 130, -76] }, { soft: 4, noise: 4, nscale: 5 });
  g.paint('sand', S.rect(0, 94, 200, 10), { soft: 3, noise: 3, nscale: 4 });
  // scorch & wear on the streets
  for (const l of [[[0, 82], [0, 24]], [[0, 20], [0, -40]], [[0, -40], [0, -60]], [[4, -10], [44, -14]]]) g.info('wear', S.line(l, 4), { soft: 2, amount: 0.6, noise: 1, nscale: 3 });
  for (let i = 0; i < 26; i++) g.info('wet', S.circle(rng.range(-40, 40), rng.range(30, 86), rng.range(0.8, 1.6)), { soft: 1, noise: 0.8, nscale: 1.2, amount: 0.7 });
  await tick();

  // ---------------------------------------------------------------- the lower town (burning)
  const kit = new FieldKit({ seed: 57, chunk: 60 });
  const ck = new FieldKit({ seed: 58, chunk: 60, fade: true });          // the castle: dissolves between camera and hero
  const flags = new Flags();
  const smoke = [];
  const fires = [];
  const fire = (x, y, z, s = 1, light = true, spread = 1.2) => {
    kit.flame(x, y, z, 1.25 * s, 0xff7a20);
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + x, d = spread * s * (0.6 + (i % 2) * 0.5); kit.flame(x + Math.cos(a) * d, y - 0.3 - (i % 2) * 0.3, z + Math.sin(a) * d * 0.6, (0.7 + (i % 3) * 0.2) * s, i % 2 ? 0xffa040 : 0xff5a18); }
    if (light) kit.light(x, y + 1.2, z, 0xff7a30, 14 * s, 16 * s, 0.45);
    smoke.push({ x, y: y + 1.6 * s, z, size: 1.4 * s, h: 16, rate: 0.8, color: 0x3a3230, glow: 0xc85a14 });
    fires.push([x, z, s]);
  };
  const HT = (x, z) => H(x, z);
  // west side of the main street (fronts east) and east side (fronts west); north of the square both sides tall
  B.row(kit, [-4.6, 78], [-4.6, 64], HT, { street: [0, 70], depth: [7, 8], floors: [2, 3], seed: 201, shopChance: 0.5, roofs: ROOFS });
  B.row(kit, [4.6, 64], [4.6, 78], HT, { street: [0, 70], depth: [7, 8], floors: [1, 2], seed: 202, shopChance: 0.5, roofs: ROOFS });
  B.row(kit, [-4.6, 40], [-4.6, 30], HT, { street: [0, 34], depth: [7, 8], floors: [2, 3], seed: 203, shopChance: 0.3, roofs: ROOFS });
  B.row(kit, [4.6, 30], [4.6, 36], HT, { street: [0, 34], depth: [7, 8], floors: [2, 2], seed: 204, shopChance: 0.3, roofs: ROOFS });
  // the side lanes: tall on their north side, one storey on the south side
  B.row(kit, [-40, 66.6], [-8, 66.6], HT, { street: [-22, 70], depth: [7, 8], floors: [2, 3], seed: 205, shopChance: 0.3, roofs: ROOFS });
  B.row(kit, [-8, 73.4], [-40, 73.4], HT, { street: [-22, 70], depth: [6, 7], floors: [1, 1], seed: 206, shopChance: 0.3, roofs: ROOFS });
  B.row(kit, [8, 34.6], [40, 34.6], HT, { street: [22, 38], depth: [6.5, 7.5], floors: [2, 3], seed: 207, shopChance: 0.2, roofs: ROOFS });
  B.row(kit, [40, 41.4], [8, 41.4], HT, { street: [22, 38], depth: [6, 7], floors: [1, 1], seed: 208, shopChance: 0.2, roofs: ROOFS });
  // around the square: tall to the north, low arcade south
  B.row(kit, [-24, 40.4], [-12, 40.4], HT, { street: [-18, 50], depth: [7, 8], floors: [2, 3], seed: 209, shopChance: 0.4, roofs: ROOFS });
  B.row(kit, [12, 40.4], [24, 40.4], HT, { street: [18, 50], depth: [7, 8], floors: [2, 3], seed: 210, shopChance: 0.4, roofs: ROOFS });
  B.arcade(kit, [-12.5, 63.6], [-24, 63.6], HT, { street: [-18, 56], depth: 4.5, seed: 211 });
  B.arcade(kit, [24, 63.6], [12.5, 63.6], HT, { street: [18, 56], depth: 4.5, seed: 212 });
  // collapsed, gutted cottages (still burning) at the town's edges
  const ruins = [[-30, 48, 0.3], [30, 54, -0.2], [-36, 84, 0.1], [34, 76, -0.4], [-28, 30, 0.2]];
  ruins.forEach(([x, z, r], i) => { F.cottage(kit, x, H(x, z), z, r, { w: 6.5, d: 5, seed: 300 + i, burnt: 0.95, roof: 'slate', chimney: true, plaster: 0xe8e0d0 }); X.rubble(kit, x, 0, z + 4, { r: 2.5, n: 9, seed: 310 + i, H }); fire(x + rng.range(-1.5, 1.5), H(x, z) + 2.4, z, 1.6, true, 1.8); });
  // fire on the roofs of most standing houses
  let hi = 0;
  for (const h of kit.spots.houses || []) { if (hi++ % 3 === 2) continue; const top = 3.8 + (h.floors - 1) * 3.1 + Math.min(h.w, h.d) * 0.25; fire(h.x + rng.range(-1.5, 1.5), h.y + top, h.z + rng.range(-1, 1), rng.range(1.3, 1.9), hi % 2 === 0, 2.2); }
  // harbour: quay edge, bollards, a burning ship, crates
  for (let x = -40; x <= 40; x += 6) P.bollard(kit, x, H(x, 89), 89);
  kit.add('stone', box(96, 3.4, 1.2, 2), M(0, TOWN - 1.6, 90.4), { tint: 0xd8d0c4 });
  B.ship(kit, flags, 16, SEA - 0.2, 100, Math.PI / 2 - 0.1, { len: 22, beam: 6.2, masts: 2, hull: 0x4a3020, stripe: 0x2a4a8a, sail: 0x4a3e34, seed: 5 });
  fire(10, SEA + 3.5, 100, 1.6); fire(20, SEA + 3.2, 99, 1.3);
  for (const [x, z] of [[-18, 84], [-12, 86], [24, 84], [30, 86]]) P.crateStack(kit, x, H(x, z), z, rng.range(-0.4, 0.4), Math.round(x));
  for (let i = 0; i < 5; i++) P.barrel(kit, -26 + i * 0.8, H(-26, 86), 86 + (i % 2) * 0.6, 0.95, i);
  // the square: well, a toppled statue, barricades
  P.well(kit, 5.5, H(5.5, 48), 48);
  P.statue(kit, -5, H(-5, 55), 55, 0.4, { s: 0.9, pose: 'sword' });
  F.barricade(kit, -9.5, 44, 9.5, 44, H, { seed: 3, gaps: [[1.5, 44, 1.8]] });
  F.barricade(kit, -3, 76, 3.2, 76.5, H, { seed: 4, gaps: [[0.5, 76, 1.2]] });
  for (let i = 0; i < 6; i++) { const a = rng.range(0, 6.28), d = rng.range(3, 9); P.barrel(kit, Math.cos(a) * d, H(Math.cos(a) * d, 52 + Math.sin(a) * d), 52 + Math.sin(a) * d, 0.9, a); }
  P.cart(kit, -8, H(-8, 58), 58, 1.3, { load: 0x8a7a5a });
  for (const [x, z] of [[-7, 62], [7, 62], [-7, 42], [7, 42], [-7, 80], [7, 80]]) P.lampPost(kit, x, H(x, z), z, 0);
  // ---------------------------------------------------------------- the castle (fading kit)
  { const kit = ck, HC = () => CASTLE;
    B.gatehouse(kit, flags, 0, CASTLE, 22, 0, { w: 9, h: 10, banner: 0x2a5aa8 });
    P.wall(kit, -50, 22, -12, 22, HC, { h: 7, t: 2.2, buttress: 3 }); P.wall(kit, 12, 22, 44, 22, HC, { h: 7, t: 2.2, buttress: 3 });
    P.wall(kit, -50, 22, -50, -40, HC, { h: 8, t: 2.2, buttress: 3 });
    P.wall(kit, -50, -40, -8, -40, HC, { h: 8, t: 2.2 }); P.wall(kit, 8, -40, 47, -40, HC, { h: 8, t: 2.2 });
    B.gatehouse(kit, flags, 0, CASTLE, -40, 0, { w: 8, h: 11, banner: 0xb02a2a });
    for (const [x, z] of [[-50, 22], [-50, -40], [47, -40]]) P.tower(kit, x, CASTLE, z, { r: 3.6, h: 12, roofH: 7, roof: B.ROOF.blue, flags, flag: 0x2a5aa8 });
    P.tower(kit, 46, CASTLE, 20, { r: 3.4, h: 11, roofH: 0, flags });
    // rampart terraces on the east: retaining faces (gaps where the stairs arrive), parapets toward the field
    const RT = (ax, az, bx, bz, rail = true) => P.retaining(kit, ax, az, bx, bz, CASTLE, TERR, { rail });
    RT(34, 13, 34, 10.6); RT(34, 5.4, 34, -5); RT(34.6, 13, 46.4, 13); RT(46.4, -5, 34.6, -5);
    RT(34, -24, 34, -27.6); RT(34, -32.4, 34, -36); RT(34.6, -24, 46.4, -24); RT(46.4, -36, 34.6, -36);
    for (const [z0, z1] of [[-5, 17], [-40, -24]]) P.wall(kit, 47, z0, 47, z1, () => CASTLE, { h: TERR - CASTLE + 1.3, t: 1.2, crenel: true });
    // the breach: broken wall stumps, rubble spilling in, fire
    for (const [z0, z1] of [[-24, -21.5], [-5, -6.5]]) F.ruinWall(kit, 47, z0, 47, z1, () => CASTLE, { h: 4.5, t: 1.6, seed: Math.round(z0), tint: 0xd8d0c4, moss: 0x3a3a38 });
    X.rubble(kit, 48, 0, -14, { r: 5, n: 26, seed: 71, stone: 0xd0c8bc, H });
    X.rubble(kit, 42, 0, -13, { r: 3, n: 12, seed: 72, stone: 0xd0c8bc, H });
    // bailey: barracks and stables along the west wall, the chapel, tents of the defenders, carts, a forge
    B.townhouse(kit, -42, CASTLE, -2, Math.PI / 2, { w: 14, d: 8, floors: 2, seed: 401, roof: B.ROOF.slate, noDoor: false, balcony: false });
    B.townhouse(kit, -42, CASTLE, -26, Math.PI / 2, { w: 12, d: 8, floors: 1, seed: 402, roof: B.ROOF.red, pitch: 0.42, chimney: false });
    B.townhouse(kit, -22, CASTLE, -34, 0, { w: 10, d: 7, floors: 2, seed: 403, roof: B.ROOF.blue });
    for (const [x, z, r, c] of [[-26, 10, 0.3, 0x3a5a8a], [-18, 12, -0.2, 0xd8d0c0], [16, 12, 0.2, 0xd8d0c0], [22, -30, 0.1, 0x3a5a8a]]) F.tent(kit, x, CASTLE, z, r, { color: c, patch: 0x8a8070 });
    for (const [x, z, r] of [[-12, -18, 0.5], [12, -24, -0.3]]) P.cart(kit, x, CASTLE, z, r);
    for (const [x, z] of [[18, -8], [20, -6], [-16, -10]]) P.crateStack(kit, x, CASTLE, z, rng.range(-0.3, 0.3), Math.round(x * 3));
    P.weaponRack(kit, -30, CASTLE, -12, Math.PI / 2); P.weaponRack(kit, 14, CASTLE, 2, 0);
    P.anvil(kit, -32, CASTLE, 14, 0.4); P.brazier(kit, -34, CASTLE, 12, { s: 0.8 });
    for (const [x, z] of [[-8, 16], [8, 16], [-8, -36], [8, -36]]) P.brazier(kit, x, CASTLE, z, { s: 0.9 });
    for (const [x, z] of [[-26, 10], [16, 12], [-42, -2]]) fire(x, CASTLE + 3, z, 1.2);
    // the inner courtyard: braziers, fallen banners, the keep burning behind
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; if (Math.sin(a) > 0.8) continue; P.brazier(kit, Math.cos(a) * 16.8, CASTLE, -60 + Math.sin(a) * 16.8, { s: 1.0 }); }
    for (const s of [-1, 1]) { P.statue(kit, s * 20, CASTLE, -72, s * -0.3, { pose: s > 0 ? 'sword' : 'shield' }); P.flagPole(kit, flags, s * 12, CASTLE, -76, { h: 9, color: 0x2a5aa8 }); }
    P.stairs(kit, 0, CASTLE, -76, 0, { w: 14, n: 20, rise: 0.2, run: 0.4 });
    P.retaining(kit, -44, -76.6, -7.2, -76.6, CASTLE, KEEP); P.retaining(kit, 7.2, -76.6, 44, -76.6, CASTLE, KEEP);
    P.wall(kit, -50, -40, -50, -80, HC, { h: 8, t: 2.2 }); P.wall(kit, 47, -40, 47, -80, HC, { h: 8, t: 2.2 });
    B.keep(kit, flags, 0, KEEP, -114);
    X.rubble(kit, -8, CASTLE, -52, { r: 3, n: 8, seed: 81, stone: 0xd8d0c4 }); X.rubble(kit, 10, CASTLE, -66, { r: 2.5, n: 7, seed: 82, stone: 0xd8d0c4 });
  }
  for (const [x, y, z, s] of [[0, KEEP + 32, -126, 3], [-18, KEEP + 16, -110, 2], [18, KEEP + 16, -112, 2.2], [-30, KEEP + 12, -100, 1.6], [30, KEEP + 10, -96, 1.6]]) { fire(x, y, z, s); smoke.push({ x, y: y + 2, z, size: 3 * s, h: 26, rate: 0.5, color: 0x1a1616, glow: 0x7a2a08 }); }
  // the cannons on the terraces, aimed east through the embrasures at Ashmaw
  const cannons = [[43.5, 0.5], [43.5, 8.5], [43.5, -33], [43.5, -27]].map(([x, z]) => ({ x, z, m: F.cannon(ck, x, TERR, z, -Math.PI / 2) }));
  for (const c of cannons) { P.barrel(ck, c.x - 2.2, TERR, c.z + 1.2, 0.9, 1); }
  // Ashmaw's field outside the breach: churned mud, broken siege ladders, burning debris
  for (let i = 0; i < 5; i++) { const x = rng.range(52, 66), z = rng.range(-36, 10); kit.add('timber', box(0.3, 0.2, 6, 1), M(x, H(x, z) + 0.2, z, rng.range(0, 3)), { tint: 0x3a2a1c }); }
  fire(58, H(58, -2) + 0.4, -2, 1.0); fire(60, H(60, -28) + 0.4, -28, 1.1);
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.35 });
  for (const c of ck.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.35 });
  for (const [x, z, s2] of fires) g.info('glow', S.circle(x, z, 3.5 * s2), { soft: 5 * s2, amount: 0.55, noise: 1.5, nscale: 2 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root); ck.build(zone.root);
  kit.colliders.push(...ck.colliders); kit.lights.push(...ck.lights); kit.flames.push(...ck.flames); kit.spots.roofs = [...(kit.spots.roofs || []), ...(ck.spots.roofs || [])];
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  await tick();

  // ---------------------------------------------------------------- sea
  const sea = buildWater(g, { x: 0, z: 130, w: 280, d: 80, level: SEA, shallow: 0x1a3a4a, deep: 0x06141e, sky: 0x1a2030, swell: 0.05, foam: 0.5 });
  const seaE = buildWater(g, { x: 90, z: 60, w: 80, d: 80, level: SEA, shallow: 0x1a3a4a, deep: 0x06141e, sky: 0x1a2030, swell: 0.05, foam: 0.5 });
  zone.root.add(sea, seaE);

  // ---------------------------------------------------------------- flora (a few scorched trees, bushes in the keep gardens)
  const flora = new FieldFlora({ cell: 64 });
  const T = (sp, x, z, o = {}) => flora.tree(sp, x, H(x, z) - 0.1, z, { rot: rng.range(0, 6.28), ...o });
  for (const [x, z] of [[-14, 52], [14, 52], [-22, -52], [22, -52], [-30, -64], [30, -64]]) T('charred', x, z, { s: rng.range(0.9, 1.2), variant: 0 });
  for (const [x, z] of scatter(rng, [-130, -150, 130, 150], 7, 1200, (x, z) => (x < -54 && z < 28) || (x < -50 && z >= 28) || z < -84)) T(rng.chance(0.7) ? 'pine' : 'charred', x, z, { s: rng.range(0.9, 1.3), variant: 0, block: false });
  for (const [x, z] of scatter(rng, [-48, -78, 46, -44], 5, 60, (x, z) => Math.hypot(x, z + 60) > 18)) T('bush', x, z, { s: rng.range(0.8, 1.1), variant: 0, opts: { dark: 0x1a2a14, light: 0x4a5a2a } });
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new FieldGrass(g, { layer: 'grass', shape: 'grass', density: quality * 0.8, height: 1.0, tint: [0.8, 0.85, 0.8] });
  zone.root.add(grass.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  const sprinkle = (kind, n, box0, o = {}) => { for (let i = 0; i < n; i++) { const x = rng.range(box0[0], box0[2]), z = rng.range(box0[1], box0[3]); dec.add(kind, x, z, { size: rng.range(o.s0 ?? 1.2, o.s1 ?? 3), alpha: o.a ?? 0.8, tint: o.tint ?? 0xffffff, emit: o.emit ?? 0, emitI: o.emitI ?? 0 }); } };
  sprinkle('scorch', 70, [-44, 26, 44, 88], { s0: 1.5, s1: 4 }); sprinkle('rubble', 40, [-44, 26, 44, 88]); sprinkle('blood', 12, [-10, 30, 10, 86], { a: 0.5 });
  sprinkle('scorch', 40, [-48, -38, 46, 20], { s0: 1.5, s1: 4 }); sprinkle('rubble', 26, [-48, -38, 46, 20]); sprinkle('cracks', 20, [-48, -38, 46, 20], { s0: 1.5, s1: 3 });
  sprinkle('fissure', 10, [40, -24, 62, -4], { emit: 0xff5a10, emitI: 1.8, s0: 2, s1: 4 }); sprinkle('scorch', 20, [48, -40, 68, 14], { s0: 2, s1: 5 });
  sprinkle('scorch', 16, [-14, -74, 14, -46], { s0: 2, s1: 4 }); sprinkle('blood', 6, [-10, -70, 10, -50], { a: 0.5 }); sprinkle('cracks', 12, [-14, -74, 14, -46], { s0: 1.5, s1: 3 });
  sprinkle('puddle', 14, [-40, 80, 40, 88], { s0: 1.5, s1: 3 });
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 6);
  const embers = buildParticles('embers', { quality, count: 420 });
  const ash = buildDrifters('ash', { quality, count: 120 });
  const smokeMesh = buildSmoke(smoke, { puffs: 8 });
  for (const m of [embers, ash, smokeMesh]) if (m) zone.root.add(m);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); embers.userData.update(focus); ash.userData.update(focus); grass.update(focus); });
  zone.onEnv(env => { pool.scale = 1.2; kitMaterial('window').emissiveIntensity = 1.8; waterEnv(sea, env, { sky: 0.4, sun: 0.6 }); waterEnv(seaE, env, { sky: 0.4, sun: 0.6 }); });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-64, -98, 138, 192, 0.5);
  nav.walk(S.rect(0, 57, 92, 64));                                   // lower town + quay
  nav.walk(S.rect(-1.5, -9, 93, 58));                                // bailey
  nav.walk(S.rect(0, 29, 12, 12));                                   // gate ramp
  nav.walk(S.rect(0, 22, 6, 9)); nav.walk(S.rect(0, -40, 6, 9));     // the two gate passages
  nav.walk(S.rect(-1.5, -58, 93, 34));                               // inner courtyard
  nav.walk(S.rect(58, -14, 22, 44));                                 // Ashmaw's field outside the breach
  nav.blockWhere((x, z) => z > 88.6 || (x > 46 && z > 24) || (x < -48 && z > 24));
  nav.blockWhere((x, z) => z < -75.5);                               // keep terrace (backdrop)
  // castle walls & terrace edges: the only ways in are the gates, the ramps and the breach
  for (const zr of [8, -30]) nav.walk(S.rect(31, zr, 8, 4.2));      // ramps
  nav.walk(S.rect(40.5, 4, 11.2, 16.6)); nav.walk(S.rect(40.5, -30, 11.2, 10.6));
  nav.walk(S.rect(48, -14, 12, 11));                                 // breach slope
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 82]]);
  zone._nav = nav; zone.nav = nav.toContract();
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = new Anchors(zone);
  A.add('spawn', 0, 83, 0);
  A.add('gate:solhaven', 0, 87.5, Math.PI);                         // the evacuation ship (the prologue ends at sea)
  A.add('triport:brighthold', 11, 50, faceTo(11, 50, 0, 52));
  A.npc('brannoc', 3.5, 25.5, Math.PI);
  A.npc('seraphine', -4, -46, Math.PI);
  A.npc('sergeant', 3.5, 40, Math.PI);
  A.npc('gunner', 38.5, 6, faceTo(38.5, 6, 43.5, 4));
  A.npc('medic', -24, 6, faceTo(-24, 6, -26, 10));
  A.npc('refugee', -6, 80.5, 0.3);
  A.npc('dockmaster', 14, 84.5, faceTo(14, 84.5, 16, 92));
  A.npc('child', -12.5, 60.6, faceTo(-12.5, 60.6, -8, 56));
  A.pack(0, 66, 6, 'imps'); A.pack(-20, 70, 6, 'imps'); A.pack(0, 50, 8, 'demons'); A.pack(22, 38, 6, 'imps');
  A.pack(0, 4, 9, 'demons'); A.pack(-24, -20, 7, 'demons'); A.pack(26, -18, 7, 'imps'); A.pack(56, -14, 9, 'demons'); A.pack(0, -52, 8, 'demons');
  A.elite(0, 36, 'demons'); A.elite(38, -14, 'brutes'); A.elite(0, -46, 'demons');
  A.add('fieldboss', 58, -14, -Math.PI / 2, { r: 12 });              // Ashmaw's ground outside the breach
  A.add('breach', 47.5, -14, -Math.PI / 2, { r: 6 });
  A.add('boss:ashmaw', 64, -14, Math.PI / 2);
  A.add('duel', 0, -60, Math.PI, { r: 14 });
  A.add('chaosgate', -20, -8, Math.PI, { r: 10 });                   // the bailey (open ground inside the walls)
  A.add('boss:varkhul', 0, -70, 0);
  cannons.forEach((c, i) => { A.add(`cannon:${i + 1}`, c.x - 1.6, c.z, -Math.PI / 2, { muzzle: [+c.m.x.toFixed(2), +c.m.y.toFixed(2), +c.m.z.toFixed(2)] }); });
  A.node('forage', -26, 56); A.node('dig', 30, 54); A.node('dig', -34, -30); A.node('log', -44, 16); A.node('mine', -46, -34); A.node('fish', 28, 88, Math.PI);
  A.add('vista:1', 40.5, -30, -Math.PI / 2);                        // the north rampart, over Ashmaw's field
  A.add('vista:2', 0, 27.5, Math.PI);                                 // the gate ramp, looking back over the burning town
  A.add('lore:1', -5, 58.5, Math.PI); A.add('lore:2', -20, -70, 0);
  const beats = { harbor: [0, 83], barricade: [0, 72], town_square: [0, 52], gate_ramp: [0, 32], outer_gate: [0, 24], bailey: [0, 4], ramparts: [31, 8], breach: [44, -14], inner_gate: [0, -36], courtyard: [0, -50], keep: [0, -74] };
  for (const [k, [x, z]] of Object.entries(beats)) A.poi(k, x, z, 0);
  const SPOTS = [{ name: 'the harbour barrels', at: [[-25, 84]] }, { name: 'the fallen statue', at: [[-2.5, 57]] }, { name: 'the gatehouse', at: [[-6.5, 26]] }, { name: 'the cannon terrace', at: [[36, 12]] }, { name: 'the breach', at: [[52, -24]] }, { name: 'the chapel steps', at: [[-22, -29]] }, { name: 'the keep stairs', at: [[8.5, -73]] }, { name: 'the town well', at: [[7.8, 50]] }];
  for (const s of seedSpots('brighthold', SPOTS, 8)) A.add(`seed:${s.i}`, s.x, s.z, 0, { hint: `${s.where} ${s.name}` });
  snapAnchors(zone, nav, 5, 'brighthold');

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('The Burning Harbour', 0, 84, 12); zone.region('Lower Town', 0, 64, 20); zone.region('Town Square', 0, 52, 11);
  zone.region('Outer Gate', 0, 24, 8); zone.region('The Bailey', 0, -8, 26); zone.region('East Ramparts', 40, -12, 14);
  zone.region('The Breach', 50, -14, 10); zone.region('Inner Courtyard', 0, -60, 16); zone.region('Brighthold Keep', 0, -100, 24);
  const night = makeEnv('night', {
    music: 'prologue', ambience: 'siege', preset: 'siege',
    sunColor: 0x9ab0e0, sunIntensity: 1.2, sunDir: [0.32, 0.8, 0.5],
    hemiSky: 0x4a5a80, hemiGround: 0x3a2018, hemiIntensity: 1.0,
    fogColor: 0x2a1e24, fogSunColor: 0xff7a3a, fogDensity: 0.009, fogHeight: 0.05, fogBase: -2,
    background: 0x0e0a10,
    grade: { exposure: 1.18, saturation: 1.08, contrast: 1.12, vignette: 0.46, warm: 0.08, cool: 0.06, lift: [0.01, 0.008, 0.03], gain: [1.05, 0.98, 0.96], bloom: 0.95, bloomRadius: 0.62, bloomThreshold: 0.78 },
    weather: 'embers', night: 1,
  });
  zone.envs = { night, day: night, dusk: night };
  zone.env = night;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: typeof r.color === 'number' ? '#' + new THREE.Color(r.color).getHexString() : r.color }));
  zone.minimap = paintMinimap(zone, { px: 512, area: { x0: -70, z0: -100, size: 196 }, roofs, water: [{ shape: { rect: [0, 130, 300, 80] } }, { shape: { rect: [90, 60, 80, 80] } }] });
  zone.spots = kit.spots;
}

try { registerZone('brighthold', DEF, build); } catch { queueMicrotask(() => registerZone('brighthold', DEF, build)); }
