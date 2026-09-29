// 'solhaven' — the capital hub (~160×160 m playable). White stone, blue & red roofs, banners and lanterns.
//   Central Plaza (0, 0): Seven Lights fountain, triport, party board, mailbox — the spawn
//   Market Row (east, z ∈ [−6, 6]): stalls, awnings, lantern strings, the Market Broker's kiosk
//   Harbour (x > 46, 1.5 m lower): stone quay, four piers, moored ships, cranes, lighthouse on the breakwater
//   Artisan Quarter & West Gate (west road): forge with glowing anvils, gemcutter, tailor, stable, gate to Goldmeadow
//   North Terrace (+3 m, grand stairs): Rift Nexus (5 portal pads) west, Guild Hall east, the keep gate
//   Royal Keep (backdrop on the hill to the north), Garden Park (south-west), residential south, city walls
import * as THREE from 'three';
import { Zone, tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, sphere, faceTo, kitMaterial } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags, buildShafts } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { Grass, Flora } from '../foliage.js';
import { buildWater, buildPool, buildJets } from '../water.js';
import { RNG, clamp, smoothstep, lerp } from '../../core/noise.js';

const TER = 3, HAR = -1.5, SEA = -3.0, QX = 62, HX = 46;

export async function build(zone, { quality = 1, props = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 11);
  zone.bounds = { x0: -80, z0: -84, x1: 84, z1: 80 };
  const g = zone.ground = new Ground({ x0: -150, z0: -175, w: 300, d: 300, res: 1, layers: ['cobble', 'flagstone', 'grass', 'dirt', 'marble', 'moss', 'sand', 'gravel', 'fan'], base: 'grass', seed: 5 });
  const N = g.noise;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  // ---------------------------------------------------------------- terrain
  g.sculpt((x, z) => {
    let h = 0;
    const inCity = x > -82 && x < 64 && z > -34 && z < 82;
    if (z < -32) h = TER;
    const stair = (cx, hw) => Math.abs(x - cx) < hw && z <= -32 && z > -38;
    if (stair(0, 7) || stair(-46, 3) || stair(46, 3)) h = TER * ramp(-z, 32, 38);
    // harbour level east of the quay wall, ramps at the market street and the south lane
    if (x >= HX && z > -32) {
      h = HAR;
      if (Math.abs(z) < 6) h = lerp(0, HAR, ramp(x, HX - 6, HX + 3));
      if (Math.abs(z - 44) < 3.5) h = lerp(0, HAR, ramp(x, HX - 6, HX + 3));
    } else if (x > HX - 6 && x < HX && z > -32) {
      if (Math.abs(z) < 6 || Math.abs(z - 44) < 3.5) h = lerp(0, HAR, ramp(x, HX - 6, HX + 3));
    }
    if (x > QX && z > -40) h = -8 + N.noise2(x / 20, z / 20) * 1.2;
    // the keep hill
    if (z < -86) h = TER + smoothstep(-86, -104, z) * 7 + smoothstep(-100, -160, z) * 6 + N.noise2(x / 30, z / 30) * 1.5 * ramp(-z, 100, 120);
    // outside the walls: rolling fields; a beach in the south-east running into the sea
    if (!inCity && z > -34) {
      const out = Math.max(ramp(-x, 82, 90), ramp(z, 82, 90));
      h = lerp(h, -0.4 + N.fbm2(x / 60, z / 60, 3) * 2.2, out);
      if (x > 10 && z > 82) h = lerp(h, -9, ramp(x + (z - 82) * 0.8, 58, 90));
    }
    if (x > QX + 6 && z < -40) h = lerp(TER, -8, ramp(x, QX + 6, QX + 16)); // north-east bluff into the sea
    return h;
  });
  const pond = { x: -54, z: 62, r: 7.5 };
  g.flatten(S.circle(pond.x, pond.z, pond.r), -1.6, 0.5);
  // breakwater + lighthouse islet
  g.raise(S.line([[70, 70], [100, 58]], 7), (x, z) => 7 + N.noise2(x / 5, z / 5) * 0.6, 3);
  g.raise(S.circle(104, 56, 8), 7.5, 3);

  // ---------------------------------------------------------------- paint
  const city = S.rect(-9, -1, 146, 162);
  g.paint('dirt', S.rect(-9, -1, 152, 168), { soft: 3, noise: 4, nscale: 8 });
  g.paint('cobble', city, { soft: 0.5 });
  g.paint('cobble', S.rect(0, -60, 132, 52), { soft: 0.5 });
  // plaza
  g.paint('flagstone', S.circle(0, 0, 19.5), { soft: 0.4 });
  g.plaza(0, 0, 19.2, { layer: 'flagstone', tile: 2.6, rings: [7.6, 13.2, 18.8], spokes: 21, border: 0.55 });
  // rift nexus (marble, polar)
  g.paint('marble', S.circle(-44, -58, 16.5), { soft: 0.4 });
  g.plaza(-44, -58, 16.2, { layer: 'marble', tile: 2.4, rings: [4.2, 10.4, 15.8], spokes: 14, border: 0.5 });
  // guild court + terrace avenue + keep forecourt
  g.paint('flagstone', S.rect(44, -48, 30, 12), { soft: 0.4 });
  g.paint('flagstone', S.rect(0, -58, 14, 44), { soft: 0.4 });
  g.paint('flagstone', S.rect(0, -80, 30, 10), { soft: 0.4 });
  // harbour quay
  g.paint('flagstone', S.rect((HX + QX) / 2, 24, QX - HX, 112), { soft: 0.4 });
  // main roads: fan-patterned setts
  for (const r of [S.rect(-50, 0, 62, 10), S.rect(32, 0, 26, 11), S.rect(0, 50, 10, 62), S.rect(0, -26, 13, 13)]) g.paint('fan', r, { soft: 0.3 });
  // artisan quarter: gravel yards
  g.paint('gravel', S.rect(-50, 14, 36, 14), { soft: 1.5, noise: 1.2, nscale: 2 });
  g.paint('dirt', S.rect(-74.3, -10.1, 10.6, 5.8), { soft: 1.2, noise: 1.2, nscale: 2 });
  g.paint('moss', S.rect(-74.3, -10.1, 8, 4), { soft: 1.2, noise: 1.2, nscale: 2, amount: 0.5 });
  g.paint('gravel', S.rect(-38.5, -12, 11, 7), { soft: 0.8, noise: 0.6, nscale: 1.5 });
  // garden park: lawn, gravel paths, flower beds
  const park = S.rect(-46.5, 58, 63, 44);
  g.paint('grass', park, { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('gravel', S.line([[-78, 44], [-30, 50], [-8, 44]], 3.2), { soft: 0.8 });
  g.paint('gravel', S.line([[-30, 34], [-30, 78]], 3), { soft: 0.8 });
  g.paint('gravel', S.ring(-30, 52, 6.5, 2.4), { soft: 0.6 });
  g.paint('gravel', S.ring(-54, 60, 10, 2.4), { soft: 0.6 });
  for (const [x, z, r] of [[-66, 40, 3.5], [-44, 38, 3], [-14, 62, 3.5], [-62, 72, 3], [-40, 70, 2.8]]) g.paint('moss', S.circle(x, z, r), { soft: 0.8, noise: 0.5, nscale: 1.5 });
  // grass strips/verges inside the city (under trees), outside fields
  for (const [x, z] of [[-9, -21], [9, -21]]) g.paint('moss', S.circle(x, z, 2.2), { soft: 0.6, noise: 0.4, nscale: 1 });
  g.paint('dirt', S.line([[-150, 2], [-110, 0], [-84, 0]], 7), { soft: 2, noise: 1.5, nscale: 3 });
  g.paint('sand', S.poly([[20, 82], [70, 60], [120, 60], [120, 140], [10, 140]]), { soft: 4, noise: 4, nscale: 6 });
  g.paint('sand', S.circle(104, 56, 9), { soft: 2, noise: 1.5, nscale: 3 });
  g.paint('gravel', S.line([[70, 70], [100, 58]], 5), { soft: 1, noise: 1, nscale: 2 });
  g.paint('grass', S.rect(0, -120, 280, 70), { soft: 6, noise: 5, nscale: 10 });
  g.paint('flagstone', S.rect(0, -120, 64, 44), { soft: 1 });
  // worn paths & wet quay
  for (const l of [[[0, 22], [0, -30]], [[0, 0], [50, 0]], [[0, 0], [-80, 0]], [[0, 22], [0, 80]], [[0, -38], [0, -80]], [[-12, -40], [-44, -52]], [[12, -40], [44, -48]]]) g.info('wear', S.line(l, 3.5), { soft: 2.5, amount: 0.7, noise: 1, nscale: 3 });
  g.info('wear', S.ring(0, 0, 10.5, 4), { soft: 2, amount: 0.6 });
  g.info('wet', S.rect(QX - 1.5, 24, 3, 112), { soft: 1.5, noise: 1.2, nscale: 2, amount: 0.8 });
  for (let i = 0; i < 14; i++) g.info('wet', S.circle(rng.range(-60, 44), rng.range(-28, 76), rng.range(0.8, 1.8)), { soft: 1.2, noise: 0.8, nscale: 1.2 });
  await tick();

  // ---------------------------------------------------------------- architecture
  const kit = new Kit({ seed: 21 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const roofsBR = [B.ROOF.blue, B.ROOF.blue, B.ROOF.red, B.ROOF.deepblue, B.ROOF.terracotta];

  // --- terrace edge: retaining walls with balustrades, stairs
  const tw = [[-80, -49], [-43, -7], [7, 43], [49, HX - 0.5]];
  for (const [a, b] of tw) P.retaining(kit, a, -32.6, b, -32.6, 0, TER);
  P.stairs(kit, 0, 0, -32, 0, { w: 14, n: 15, rise: 0.2, run: 0.4 });
  for (const s of [-1, 1]) P.stairs(kit, s * 46, 0, -32, 0, { w: 6, n: 15, rise: 0.2, run: 0.4 });
  for (const s of [-1, 1]) { P.brazier(kit, s * 8.2, TER, -38.8, { s: 0.9 }); P.lampPost(kit, s * 8.2, 0, -30, 0, { double: true }); }
  // harbour quay wall (city level → promenade) with gaps for the two ramps
  for (const [a, b] of [[-32.6, -6.2], [6.2, 40.3], [47.7, 81]]) P.retaining(kit, HX - 0.6, b, HX - 0.6, a, HAR, 0);
  for (const [a, b] of [[-6.2, 6.2], [40.3, 47.7]]) for (const zz of [a, b]) kit.add('stone', box(8.5, 1.2, 0.8, 1), M(HX - 1.2, -0.15, zz), { tint: 0xe8e2d6 });
  // quay edge: bollards, low stones, ladders
  for (let z = -28; z < 80; z += 6) if (![-20, 6, 32, 58].some(pz => Math.abs(z - pz) < 4)) kit.add('stone', box(0.5, 0.6, 0.5, 1), M(QX - 0.4, HAR + 0.3, z), { tint: 0xd8d0c4 });
  kit.add('stone', box(1.4, 12, 112, 2), M(QX + 0.7, HAR - 5.8, 24), { tint: 0xd0c8bc });
  { const cuts = [-32, -22.4, -17.6, 3.6, 8.4, 29.6, 34.4, 55.6, 60.4, 80]; for (let i = 0; i < cuts.length; i += 2) kit.block(S.rect(QX + 0.7, (cuts[i] + cuts[i + 1]) / 2, 1.6, cuts[i + 1] - cuts[i]), 0.25); }
  // north-east sea wall & tower
  P.wall(kit, HX - 0.5, -33, QX + 4, -33, (x, z) => (x > HX ? HAR : 0), { h: 4, t: 1.4 });
  P.tower(kit, QX + 4, HAR, -33, { r: 3.4, h: 11, roofH: 7, roof: B.ROOF.blue, flags, flag: 0x2a5aa8 });

  // --- city walls & gate
  const W = (ax, az, bx, bz, o = {}) => P.wall(kit, ax, az, bx, bz, H, { h: 7, t: 2.2, buttress: 3, ...o });
  W(-82, -84, -82, -6); W(-82, 6, -82, 82); W(-82, 82, 58, 82); W(58, 82, QX, 82);
  W(-82, -84, -11.6, -84, { h: 7 }); W(11.6, -84, QX + 3, -84, { h: 7 });
  for (const [x, z] of [[-82, -84], [-82, 82], [58, 82], [QX + 3, -84], [-82, -32]]) P.tower(kit, x, H(x, z), z, { r: 3.6, h: 12, roofH: 8, roof: B.ROOF.blue, flags, flag: 0xb02a2a });
  P.tower(kit, -30, H(-30, 82), 82, { r: 3, h: 10, roofH: 6, roof: B.ROOF.red, flags, flag: 0x2a5aa8 });
  P.tower(kit, 20, H(20, 82), 82, { r: 3, h: 10, roofH: 6, roof: B.ROOF.red, flags, flag: 0x2a5aa8 });
  B.gatehouse(kit, flags, -82, 0, 0, Math.PI / 2, { w: 9 });
  // keep gate (closed) + the royal keep on its hill
  B.gatehouse(kit, flags, 0, TER, -85, 0, { w: 10, open: false });
  for (let i = 0; i < 9; i++) kit.add('metal', box(0.14, 4.6, 0.14, 1), M(-2.1 + i * 0.52, TER + 2.3, -84.2), { tint: 0x2a2a2e, ao: false });
  for (let i = 0; i < 5; i++) kit.add('metal', box(4.6, 0.14, 0.14, 1), M(0, TER + 0.5 + i * 1.0, -84.1), { tint: 0x2a2a2e, ao: false });
  kit.block(S.rect(0, -85, 10, 3.4), 0.3);
  B.keep(kit, flags, 0, H(0, -128), -128);

  // --- central plaza (r = 19): tall facades on the north half, low arcades on the south half
  const PR = 19;
  const fw = P.fountain(kit, 0, 0, 0, { r: 6.5, tiers: 1 });
  B.sevenLights(kit, 0, 0.2, 0, { r: 1.5 });
  const jets = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.45; jets.push({ from: [Math.cos(a) * 2.75, 1.45, Math.sin(a) * 2.75], to: [Math.cos(a) * 5.3, 0.5, Math.sin(a) * 5.3], h: 1.0, w: 0.09 }); }
  B.triport(kit, 11, 0, 9);
  P.noticeBoard(kit, -11.5, 0, 11.5, -0.7);
  P.mailbox(kit, -6.8, 0, 14.2, 0.2);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2 + (i < 2 ? 0.25 : 0); P.bench(kit, Math.cos(a) * 15.2, 0, Math.sin(a) * 15.2, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; P.lampPost(kit, Math.cos(a) * 17.6, 0, Math.sin(a) * 17.6, 0); }
  for (const s of [-1, 1]) { P.statue(kit, s * 10.5, 0, -13.5, s * 0.5, { s: 1.0, pose: s > 0 ? 'sword' : 'shield' }); P.planter(kit, s * 15.5, 0, -6.5, { w: 1.2, d: 2.6, ry: s * 0.3, seed: 7 + s }); }
  for (const [x, z] of [[-5.5, 8.4], [5.5, 8.4]]) P.flowerPot(kit, x, 0, z, { s: 1.3, color: x > 0 ? 0xf4d040 : 0xe04060 });
  const plazaTrees = [];
  for (const a of [-2.35, -0.79, 0.79, 2.35]) plazaTrees.push(P.roundPlanter(kit, Math.cos(a) * 12.2, 0, Math.sin(a) * 12.2, { r: 1.45, seed: Math.round(a * 10) }));
  for (const a of [-2.1, -1.04, 1.04, 2.1]) P.flagPole(kit, flags, Math.cos(a) * 17.2, 0, Math.sin(a) * 17.2, { h: 8.5, color: a < 0 ? 0x2a5aa8 : 0xb02a2a });
  // card collector's table (north-west of the fountain)
  kit.add('planks', box(1.8, 0.1, 1.0, 1), M(-14.5, 0.9, -3.5, 0.9), { tint: 0x7a4a2a }); kit.add('cloth', box(1.9, 0.02, 1.1, 1), M(-14.5, 0.96, -3.5, 0.9), { tint: 0x6a2a6a, ao: false });
  for (const [dx, dz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) kit.add('timber', box(0.08, 0.9, 0.08, 1), M(-14.5 + dx * Math.cos(0.9) + dz * Math.sin(0.9), 0.45, -3.5 - dx * Math.sin(0.9) + dz * Math.cos(0.9)), { ao: false });
  for (let i = 0; i < 6; i++) kit.add('paint', box(0.16, 0.01, 0.24, 1), M(-14.9 + i * 0.16, 0.98, -3.5 + i * 0.12, 0.9 + i * 0.1), { tint: [0xd8b060, 0x4a6ac0, 0xc04040, 0xe8e0d0][i % 4], ao: false, cast: false });
  kit.block(S.rect(-14.5, -3.5, 2, 1.2, 0.9), 0.3);
  // ring buildings, fronts toward the centre
  const arcRow = (a0, a1, r, seed, opt = {}) => {
    const rr = new RNG(seed);
    let a = a0;
    while (a < a1 - 0.05) {
      const w = rr.range(7.5, 9.5);
      const da = w / (r + 4);
      if (a + da > a1 + 0.02) break;
      const am = a + da / 2, d = rr.range(8, 9.5);
      const cx = Math.cos(am) * (r + d / 2), cz = Math.sin(am) * (r + d / 2);
      B.townhouse(kit, cx, 0, cz, Math.atan2(-Math.cos(am), -Math.sin(am)), { w: w - 0.3, d, floors: rr.int(2, 3), seed: rr.int(0, 1e6), shop: rr.chance(0.5), balcony: rr.chance(0.6), roof: rr.pick(roofsBR), ...opt });
      a += da;
    }
  };
  arcRow(-2.84, -1.9, PR + 2, 1);
  arcRow(-0.62, -0.33, PR + 2, 2);
  const BA = -1.02, BR = PR + 2 + 8.9, bankX = Math.cos(BA) * BR, bankZ = Math.sin(BA) * BR;
  B.bank(kit, flags, bankX, 0, bankZ, Math.atan2(-Math.cos(BA), -Math.sin(BA)));
  const chord = (a0, a1, r) => [[Math.cos(a0) * r, Math.sin(a0) * r], [Math.cos(a1) * r, Math.sin(a1) * r]];
  { const [p0, p1] = chord(0.34, 1.26, PR + 2.5); B.arcade(kit, p0, p1, H, { street: [0, 0], depth: 5, seed: 5 }); }
  { const [p0, p1] = chord(1.88, 2.8, PR + 2.5); B.arcade(kit, p0, p1, H, { street: [0, 0], depth: 5, seed: 6 }); }

  // --- market row (east): tall shops on the north side, stalls in front of them, a low arcade on the south side
  B.row(kit, [27, -6.3], [HX - 1.5, -6.3], H, { street: [36, 0], depth: [8, 10], floors: [2, 3], seed: 31, shopChance: 0.95, roofs: roofsBR, balcony: 0.6 });
  B.row(kit, [HX - 1.5, 7.2], [26, 7.2], H, { street: [36, 0], depth: [6.5, 7.5], widths: [5.5, 7.5], floors: [1, 1], seed: 33, shopChance: 0.9, roofs: roofsBR, balcony: 0 });
  const stallCols = [0xb03030, 0x2f5fa8, 0x2f8a5a, 0xd09a30, 0x8a3aa0, 0xc05a20];
  const goods = ['fruit', 'cloth', 'fish', 'pots', 'potions', 'fruit'];
  for (let i = 0; i < 4; i++) P.stall(kit, 25 + i * 5.3, 0, -3.1, 0, { color: stallCols[i], goods: goods[i], seed: 40 + i });
  for (let i = 0; i < 3; i++) P.stall(kit, 26.5 + i * 6.2 + (i > 0 ? 3.4 : 0), 0, 3.6, Math.PI, { color: stallCols[(i + 3) % 6], goods: goods[(i + 2) % 6], seed: 60 + i });
  P.kiosk(kit, 32.2, 0, 0.3, 0, { color: 0x2f5fa8 });
  for (let i = 0; i < 4; i++) P.lanternString(kit, [24 + i * 6, 6.2, -6.2], [24 + i * 6 + 3, 4.9, 6.2], { sag: 1.0 });
  for (let i = 0; i < 3; i++) P.bunting(kit, [27 + i * 6, 6.6, -6.4], [27 + i * 6 - 2, 4.4, 7.4], { sag: 0.7 });
  P.crateStack(kit, 45.2, 0, -3.6, 0.3, 7); P.cart(kit, 43.5, 0, 3.0, 1.45);

  // --- harbour: piers, ships, cranes, cargo, lighthouse
  const piers = [-20, 6, 32, 58];
  for (const pz of piers) { B.pier(kit, QX - 1, pz, -Math.PI / 2, 24, 4.2, HAR + 0.1); zone.deck(S.rect(QX + 11.4, pz, 24.8, 4.2), HAR + 0.21); }
  for (const pz of piers) kit.block(S.subtract(S.rect(QX + 11, pz, 24, 4.2 + 0.7), S.rect(QX + 11, pz, 24.2, 4.2 - 0.8)), 0);
  B.ship(kit, flags, 76.5, SEA - 0.4, 19, -Math.PI / 2, { len: 22, beam: 6.2, masts: 2, stripe: 0x2a4a8a, seed: 1 });
  B.ship(kit, flags, 75.5, SEA - 0.4, 45, -Math.PI / 2 + 0.05, { len: 17, beam: 5.2, masts: 2, hull: 0x7a4a2a, stripe: 0x8a2a2a, sail: 0xf0e0c0, seed: 2 });
  B.ship(kit, flags, 78.5, SEA - 0.4, -7, -Math.PI / 2 - 0.04, { len: 26, beam: 7, masts: 3, hull: 0x5a3822, stripe: 0xc8a040, seed: 3 });
  for (const z of [-12, 22, 50]) B.crane(kit, QX - 2.4, HAR, z, Math.PI / 2);
  // cargo yard along the quay wall; nets, rope, fish baskets, anchors at the pier heads
  for (let i = 0; i < 8; i++) { const z = -27 + i * 13.5; if (piers.some(p => Math.abs(z - p) < 4.5)) continue; P.crateStack(kit, HX + 2.8 + rng.range(0, 1.5), HAR, z, rng.range(-0.3, 0.3), 70 + i); }
  for (const pz of piers) {
    P.ropeCoil(kit, QX - 1.4, HAR, pz - 3.2, 1); P.fishBasket(kit, QX - 3.2, HAR, pz + 3.4, rng.range(0, 3)); P.fishBasket(kit, QX - 2.4, HAR, pz + 4.1, rng.range(0, 3));
    P.net(kit, QX - 5, HAR + 0.02, pz - 4.2, rng.range(-0.3, 0.3));
    P.bollard(kit, QX - 0.7, HAR, pz - 2.6); P.bollard(kit, QX - 0.7, HAR, pz + 2.6);
    P.lampPost(kit, QX - 1.0, HAR, pz + 6.5, Math.PI / 2);
    P.ropeCoil(kit, QX + 20, HAR + 0.21, pz + 1.2, 0.8);
  }
  P.anchorProp(kit, HX + 3, HAR, 38, 0.4); P.anchorProp(kit, HX + 3.4, HAR, -2, -0.6);
  for (let i = 0; i < 6; i++) P.barrel(kit, HX + 2.2, HAR, 12 + i * 0.8, 1, rng.range(0, 6));
  P.cart(kit, HX + 7, HAR, -26, 0.2);
  B.lighthouse(kit, flags, 104, H(104, 56), 56);

  // --- west road: forge, gemcutter, tailor, stable on the NORTH side (open to the camera); yard to the south
  const WR = -9;                                           // north building line of the west road
  B.forge(kit, -38.5, 0, WR - 4, 0);
  B.townhouse(kit, -50, 0, WR - 4, 0, { w: 8, d: 8, floors: 2, shop: true, awning: 0x8a3aa0, sign: 0x9a70e0, seed: 61, roof: B.ROOF.red, balcony: true });
  B.townhouse(kit, -61, 0, WR - 4, 0, { w: 8.5, d: 8, floors: 2, shop: true, awning: 0xc05a90, sign: 0xe0a0c0, seed: 62, roof: B.ROOF.blue, timber: true });
  B.townhouse(kit, -30.5, 0, WR - 5, 0, { w: 6, d: 10, floors: 3, seed: 63, roof: B.ROOF.blue, balcony: true });
  // stable and paddock
  B.townhouse(kit, -74.5, 0, -18, 0, { w: 10, d: 8, floors: 1, seed: 81, roof: B.ROOF.red, noDoor: true, chimney: false, pitch: 0.42 });
  kit.add('planks', box(3.4, 2.8, 0.2, 1), M(-74.5, 1.7, -13.9), { tint: 0x7a4a2a });
  P.fenceLine(kit, [[-79.6, -13], [-79.6, -7.2], [-69, -7.2], [-69, -13]], H);
  P.hay(kit, -77.5, 0, -10.5, 1, 0.3); P.hay(kit, -76.6, 0.6, -10.7, 0.9, 0.1); P.hay(kit, -71, 0, -11.5, 1, -0.4);
  P.barrel(kit, -70.2, 0, -8.6, 1);
  // back rows (roofs rising behind the front buildings)
  B.row(kit, [-66, -23], [-46, -23], H, { street: [-56, -10], depth: [7, 8], floors: [2, 3], seed: 71, shopChance: 0, roofs: roofsBR });
  B.row(kit, [-44, -24], [-32, -24], H, { street: [-38, -10], depth: [6, 7], floors: [3, 3], seed: 72, shopChance: 0, roofs: roofsBR });
  // south side: one-storey workshops (their roofs fill the lower screen without hiding the hero), a yard behind
  B.row(kit, [-24, 5.4], [-44, 5.4], H, { street: [-35, 0], depth: [6.5, 7.5], widths: [6, 8], floors: [1, 1], seed: 75, shopChance: 0.5, roofs: roofsBR, balcony: 0 });
  B.row(kit, [-49, 5.4], [-72, 5.4], H, { street: [-60, 0], depth: [6.5, 7.5], widths: [6, 8], floors: [1, 1], seed: 76, shopChance: 0.5, roofs: roofsBR, balcony: 0 });
  P.logPile(kit, -46.5, 0, 16, 0, { n: 4, len: 3 }); P.logPile(kit, -51, 0, 18.5, 0.1, { n: 3 });
  for (let i = 0; i < 5; i++) P.barrel(kit, -62 + (i % 3) * 0.8, 0, 16 + Math.floor(i / 3) * 0.8, 1, rng.range(0, 6));
  P.cart(kit, -40, 0, 19, Math.PI / 2 - 0.2); P.crateStack(kit, -33, 0, 18, 0.2, 9); P.coalPile(kit, -36.5, 0, -8.2, 0.9);
  P.well(kit, -56, 0, 20); P.hay(kit, -68, 0, 18, 1, 0.5);
  for (const x of [-27, -43.5, -57.5, -71]) P.bunting(kit, [x - 1.5, 6.4, -9.1], [x + 1.5, 4.6, 5.3], { sag: 0.9 });
  const streetTrees = [[-35.5, -5.2], [-56, -5.2], [-44, 4.0], [-66, 4.0]].map(([x, z], i) => P.roundPlanter(kit, x, 0, z, { r: 1.2, seed: 30 + i }));
  // road furniture: carts, a water trough, crates by the forge
  P.cart(kit, -52.5, 0, -1.8, Math.PI / 2 + 0.08); P.crateStack(kit, -45.5, 0, -6.6, 0.1, 12); P.barrel(kit, -33.2, 0, -6.8, 1); P.barrel(kit, -32.4, 0, -6.5, 0.9);
  kit.add('stone', box(2.2, 0.6, 0.8, 1), M(-66.5, 0.3, -3.2), { tint: 0xd8d0c4 }); kit.add('stone', box(2.0, 0.05, 0.6, 1), M(-66.5, 0.58, -3.2), { tint: 0x2a4a5a, ao: false }); kit.block(S.rect(-66.5, -3.2, 2.2, 0.8), 0.3);
  for (const x of [-30, -49.5, -61]) P.lampPost(kit, x, 0, 4.4, 0);
  for (const x of [-46, -67]) P.lampPost(kit, x, 0, -6.4, 0);

  // --- north terrace: rift nexus, guild hall, pvp banners
  const NX = -44, NZ = -58;
  const pads = [['portal:chaos', 0xc040ff], ['portal:guardian', 0x40b0ff], ['portal:abyss', 0x40e0c0], ['portal:legion', 0xff4040], ['portal:inferno', 0xff8a20]];
  const padPos = pads.map((p, i) => { const a = (-162 + i * 36) * Math.PI / 180; return [NX + Math.cos(a) * 10.5, NZ + Math.sin(a) * 10.5, a]; });
  padPos.forEach(([x, z, a], i) => B.portalPad(kit, x, TER, z, Math.atan2(-Math.cos(a), -Math.sin(a)), { color: pads[i][1], r: 2.6 }));
  kit.add('stone', cyl(2.2, 2.6, 0.6, 8, 1), M(NX, TER + 0.3, NZ), { tint: 0xd8d2c8 });
  kit.add('marble', cyl(0.6, 1.1, 5.2, 4, 1), M(NX, TER + 3.2, NZ, Math.PI / 4), { tint: 0x3a3450 });
  kit.glow(new THREE.OctahedronGeometry(0.7, 0), M(NX, TER + 7.2, NZ, 0, 1, 1.6, 1), 0xb080ff, 3.5);
  for (let i = 0; i < 3; i++) { const tor = new THREE.TorusGeometry(1.5 + i * 0.5, 0.04, 4, 40); kit.glow(tor, M(NX, TER + 6.6 + i * 0.4, NZ, i * 1.1, 1, 1, 1, Math.PI / 2 + 0.3 * (i - 1)), 0xa070ff, 2.4); }
  kit.light(NX, TER + 6.8, NZ, 0xa070ff, 7, 14, 0.08);
  kit.block(S.circle(NX, NZ, 2.5), 0.3);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.25; P.brazier(kit, NX + Math.cos(a) * 15.3, TER, NZ + Math.sin(a) * 15.3, { s: 0.8, color: 0xc070ff, glow: 0xa060ff }); }
  B.guildHall(kit, flags, 44, TER, -64, 0, { banner: 0x2a5aa8 });
  for (const s of [-1, 1]) { P.planter(kit, 44 + s * 11, TER, -47, { w: 3, d: 1.2, seed: 90 + s }); P.lampPost(kit, 44 + s * 6, TER, -43, 0); P.statue(kit, 44 + s * 15, TER, -52, 0, { pose: s > 0 ? 'sword' : 'shield' }); }
  for (let z = -44; z > -80; z -= 9) for (const s of [-1, 1]) P.lampPost(kit, s * 7.6, TER, z, 0);
  for (const s of [-1, 1]) { kit.add('metal', cyl(0.07, 0.09, 6, 6, 1), M(-22 + s * 1.6, TER + 3, -45), { tint: 0x2a2a2e, ao: false }); flags.add(M(-22 + s * 1.6 + 0.05, TER + 5.9, -45), 1.3, 2.6, s > 0 ? 0xb02a2a : 0x2a5aa8, { hang: 'left' }); kit.block(S.circle(-22 + s * 1.6, -45, 0.2), 0.3); }
  P.weaponRack(kit, -22, TER, -47.5, 0); P.dummy(kit, -18.5, TER, -47, 0); P.dummy(kit, -25.5, TER, -47, 0);
  B.row(kit, [-79, -76], [-60, -76], H, { street: [-70, -60], depth: [7, 7.5], floors: [2, 3], seed: 101, shopChance: 0, roofs: roofsBR });
  B.row(kit, [-12, -76], [-27, -76], H, { street: [-20, -60], depth: [7, 7.5], floors: [2, 3], seed: 102, shopChance: 0, roofs: roofsBR });
  B.row(kit, [14, -44], [14, -80], H, { street: [0, -60], depth: [8, 9], floors: [2, 3], seed: 103, shopChance: 0.3, roofs: roofsBR });
  B.row(kit, [-72, -37], [-72, -74], H, { street: [-60, -55], depth: [7.5, 8.5], floors: [2, 3], seed: 104, shopChance: 0.2, roofs: roofsBR });

  // --- south: avenue (tall both sides), the well square (tall north, arcade south), low lanes
  B.row(kit, [5.6, 26], [5.6, 79], H, { street: [0, 50], depth: [8, 9.5], floors: [2, 3], seed: 111, shopChance: 0.4, roofs: roofsBR });
  B.row(kit, [-5.6, 79], [-5.6, 26], H, { street: [0, 50], depth: [7, 8], floors: [2, 3], seed: 115, shopChance: 0.4, roofs: roofsBR });
  B.row(kit, [16, 35.5], [44, 35.5], H, { street: [25, 44], depth: [7.5, 8.5], floors: [2, 3], seed: 112, shopChance: 0.4, roofs: roofsBR, balcony: 0.5 });
  B.arcade(kit, [44, 52], [16, 52], H, { street: [25, 44], depth: 5, seed: 113 });
  B.row(kit, [16, 72], [44, 72], H, { street: [30, 64], depth: [7.5, 8.5], floors: [1, 1], seed: 114, shopChance: 0, roofs: roofsBR });
  B.row(kit, [16, 17.5], [44, 17.5], H, { street: [30, 25], depth: [5.5, 6.5], floors: [1, 1], seed: 118, shopChance: 0.3, roofs: roofsBR });
  B.row(kit, [HX - 1.5, 27], [16, 27], H, { street: [30, 20], depth: [6, 7], floors: [2, 2], seed: 119, shopChance: 0.2, roofs: roofsBR });
  B.row(kit, [-14, 27], [-38, 27], H, { street: [-26, 20], depth: [6.5, 7], floors: [1, 1], seed: 116, shopChance: 0.2, roofs: roofsBR });
  B.row(kit, [-64, 27], [-80, 27], H, { street: [-70, 20], depth: [6.5, 7], floors: [1, 1], seed: 117, shopChance: 0.2, roofs: roofsBR });
  B.dressStreets(kit, { paint: sh => g.paint('flagstone', sh, { soft: 0.3 }), skip: h => h.y > 1 && h.z < -60 });
  // street centre gutters (a line of flat stones with a little water) and worn cart tracks
  for (const l of [[[-80, 0], [-19, 0]], [[19, 0], [HX - 3, 0]], [[0, 19], [0, 80]]]) { g.paint('flagstone', S.line(l, 0.9), { soft: 0.2 }); g.info('wet', S.line(l, 0.8), { soft: 0.6, amount: 0.55, noise: 0.5, nscale: 2 }); }
  P.well(kit, 25, 0, 44);
  for (const [x, z] of [[18, 40], [32, 48]]) P.lampPost(kit, x, 0, z, 0);
  P.bench(kit, 25, 0, 50, 0);
  P.gazebo(kit, -30, 0, 52, { roof: B.ROOF.blue });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; P.bench(kit, -30 + Math.cos(a) * 8.8, 0, 52 + Math.sin(a) * 8.8, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI); }
  for (const [x, z] of [[-44, 44], [-16, 44], [-66, 44], [-30, 38], [-30, 64]]) P.lampPost(kit, x, 0, z, 0);
  kit.add('stone', cyl(pond.r + 0.4, pond.r + 0.5, 0.5, 28, 2, true), M(pond.x, 0.05, pond.z), { tint: 0xe6e0d4 });
  const pondRim = new THREE.TorusGeometry(pond.r + 0.25, 0.3, 5, 36); pondRim.rotateX(Math.PI / 2);
  kit.add('stone', pondRim, M(pond.x, 0.32, pond.z, 0, 1, 0.5, 1), { tint: 0xf0ebe2, ao: false });
  kit.block(S.circle(pond.x, pond.z, pond.r + 0.5), 0.3);
  // contact shadows at the foot of everything that blocks, then build the ground
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.2, amount: 0.32 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  await tick();

  // ---------------------------------------------------------------- water
  const sea = buildWater(g, { x: 140, z: 0, w: 160, d: 360, level: SEA, swell: 0.06 });
  const sea2 = buildWater(g, { x: 30, z: 140, w: 60, d: 120, level: SEA, swell: 0.06 });
  const pondW = buildWater(g, { x: pond.x, z: pond.z, w: pond.r * 2 + 1, d: pond.r * 2 + 1, level: -0.25, shallow: 0x4aa890, deep: 0x1c5a60, swell: 0, foam: 0.4 });
  const waters = [sea, sea2, pondW, ...fw.map(w => buildPool({ x: w.x, z: w.z, r: w.r, y: w.y - 0.1, shallow: 0x3a9aa0, deep: 0x1a5a78 }))];
  zone.root.add(buildJets(jets));
  pondW.material.depthWrite = false;
  for (const w of waters) zone.root.add(w);
  // clip the square pond plane to its round basin
  pondW.geometry.dispose(); pondW.geometry = new THREE.CircleGeometry(pond.r, 40).rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- foliage
  const flora = new Flora();
  const tree = (sp, x, z, o = {}) => flora.tree(sp, x, H(x, z) - 0.1, z, o);
  // park
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-78, -12), z = rng.range(34, 78);
    if (Math.hypot(x + 30, z - 52) < 11 || Math.hypot(x - pond.x, z - pond.z) < pond.r + 3) continue;
    if (Math.abs(z - 44 - (x + 78) * 0.05) < 3 || Math.abs(x + 30) < 3) continue;
    tree(rng.chance(0.35) ? 'blossom' : rng.chance(0.3) ? 'cypress' : 'broadleaf', x, z, { s: rng.range(0.85, 1.15), variant: i % 3 });
  }
  for (let i = 0; i < 30; i++) { const x = rng.range(-78, -10), z = rng.range(33, 79); if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 1.5 || Math.hypot(x + 30, z - 52) < 9) continue; tree('bush', x, z, { s: rng.range(0.7, 1.2), variant: i % 3 }); }
  for (let i = 0; i < 160; i++) { const x = rng.range(-78, -10), z = rng.range(33, 79); if (g.weight('moss', x, z) > 0.3 || rng.chance(0.25)) flora.flower(x, H(x, z), z, rng.pick([0xffffff, 0xf4d040, 0xe04060, 0xff8ab0, 0xa070e0])); }
  // plaza and avenue trees (in planters), terrace cypresses
  for (const [x, z] of [[-9, -21], [9, -21]]) tree('broadleaf', x, z, { s: 0.75, variant: 1 });
  for (const [x, y, z] of plazaTrees) flora.tree('blossom', x, y - 0.05, z, { s: 0.62, variant: 2, block: false });
  for (const [x, y, z] of streetTrees) flora.tree('broadleaf', x, y - 0.05, z, { s: 0.6, variant: 0, block: false });
  for (let z = -44; z > -80; z -= 9) for (const s of [-1, 1]) tree('cypress', s * 10.5, z + 4.5, { s: 0.9, variant: (z & 3) % 3 });
  for (let i = 0; i < 6; i++) tree('cypress', 28 + i * 3.2, -40, { s: 0.85, variant: i % 3 });
  // outside the walls: fields and groves to the west, pines on the keep hill
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-148, -88), z = rng.range(-120, 120);
    if (Math.abs(z) < 7) continue;
    tree(rng.chance(0.6) ? 'broadleaf' : rng.chance(0.5) ? 'cypress' : 'bush', x, z, { s: rng.range(0.9, 1.3), variant: i % 3 });
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-140, 140), z = rng.range(-172, -100);
    if (Math.abs(x) < 36 && z > -152) continue;
    tree(rng.chance(0.7) ? 'pine' : 'cypress', x, z, { s: rng.range(0.9, 1.3), variant: i % 3 });
  }
  for (let i = 0; i < 40; i++) { const x = rng.range(-80, 20), z = rng.range(86, 140); tree(rng.chance(0.7) ? 'broadleaf' : 'bush', x, z, { s: rng.range(0.9, 1.3), variant: i % 3 }); }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new Grass(g, { layer: 'grass', density: quality });
  zone.root.add(grass.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 - Math.PI / 2; dec.add('sunmark', Math.cos(a) * 16.1, Math.sin(a) * 16.1, { size: 1.5, rot: -a, alpha: 0.75 }); }
  padPos.forEach(([x, z], i) => dec.add('runes', x, z, { size: 5.4, rot: 0, tint: pads[i][1], emit: pads[i][1], emitI: 2.2, lift: 0.64 }));
  dec.add('runes', NX, NZ, { size: 12, rot: 0.3, tint: 0xc0a0ff, emit: 0x8060ff, emitI: 1.2, alpha: 0.9, lift: 0.04 });
  const scatter = (kind, n, area, o = {}) => { for (let i = 0; i < n; i++) { const x = rng.range(area[0], area[2]), z = rng.range(area[1], area[3]); dec.add(kind, x, z, { size: rng.range(o.s0 ?? 1, o.s1 ?? 2.4), alpha: o.a ?? 0.8, tint: o.tint ?? 0xffffff }); } };
  scatter('cracks', 40, [-78, -30, 44, 78]); scatter('stain', 40, [-78, -30, 44, 78], { s0: 1.5, s1: 3.5, a: 0.6 });
  scatter('leaves', 30, [-78, 30, -8, 78]); scatter('petals', 26, [-78, 30, -8, 78], { s0: 1.2, s1: 2.2 });
  scatter('pebbles', 20, [-78, -30, 44, 78], { a: 0.7 }); scatter('rubble', 12, [-78, -30, 44, 78], { s0: 0.8, s1: 1.6 });
  scatter('straw', 16, [-80, -13, -68, -6], { s0: 1.0, s1: 2.0 }); scatter('straw', 10, [-72, 6, -40, 22], { s0: 1.0, s1: 2.0 });
  scatter('stain', 18, [HX, -30, QX, 80], { s0: 1.5, s1: 3, a: 0.6 }); scatter('puddle', 12, [HX + 2, -28, QX - 1, 78], { s0: 1.5, s1: 3.2 });
  scatter('moss', 30, [-80, -84, 62, 82], { s0: 1, s1: 2.5, a: 0.8 });
  for (let i = 0; i < 8; i++) dec.add('scorch', -38.5 + rng.range(-4, 4), -10 + rng.range(-2, 3), { size: rng.range(0.8, 1.6), alpha: 0.45 });
  for (const [x, z] of [[0, 26], [-26, 0], [30, -6.8], [0, -60]]) dec.add('grate', x, z, { size: 1.3, rot: 0 });
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const dust = buildParticles('dust', { quality });
  zone.root.add(dust);
  const shafts = buildShafts([
    { x: -6, y: 0, z: 2, w: 5, h: 16, rot: 0.6, tilt: -0.55, alpha: 0.22 },
    { x: 8, y: 0, z: -6, w: 4, h: 14, rot: 0.6, tilt: -0.55, alpha: 0.18 },
    { x: -30, y: 0, z: 46, w: 5, h: 14, rot: 0.6, tilt: -0.55, alpha: 0.2 },
    { x: 34, y: 0, z: -2, w: 4, h: 12, rot: 0.6, tilt: -0.55, alpha: 0.16 },
  ]);
  if (shafts) zone.root.add(shafts);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); dust.userData.update(focus); grass.update(focus); });
  zone.onEnv(env => {
    pool.scale = 0.45 + env.night * 1.6;
    kitMaterial('window').emissiveIntensity = env.night * 1.8;
    for (const w of waters) w.userData.setEnv?.(env);
    if (shafts) shafts.visible = env.night < 0.5;
  });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-82, -86, 170, 168, 0.5);
  nav.walk(S.rect(-9, -1, 160, 162));                       // city floor x∈[−89, 71] (clipped below)
  nav.walk(S.rect(0, -58, 150, 52));
  for (const pz of piers) nav.walk(S.rect(QX + 11, pz, 24, 3.4));
  nav.blockWhere((x, z) => x < -80.5 || z > 80.5 || z < -83.2 || (x > QX - 0.3 && !piers.some(p => Math.abs(z - p) < 1.7 && x < QX + 22.5)));
  nav.blockWhere((x, z) => z < -32.4 && z > -32.9 && !(Math.abs(x) < 6.6 || Math.abs(Math.abs(x) - 46) < 2.6));
  nav.blockWhere((x, z) => x > HX - 1.1 && x < HX - 0.1 && z > -32 && !(Math.abs(z) < 5.8 || Math.abs(z - 44) < 3.3));
  nav.blockWhere((x, z) => z < -32 && x > HX - 0.6);        // no terrace east of the quay
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.block(S.circle(pond.x, pond.z, pond.r + 0.3), 0.2);
  nav.keepConnected([[0, 14]]);
  zone._nav = nav; zone.nav = nav.toContract();
  // contact shadows at the foot of everything that blocks (painted after build: update the info texture)
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = (name, x, z, f) => zone.anchor(name, x, z, f);
  const toward = (x, z, tx, tz) => faceTo(x, z, tx, tz);
  A('spawn', 0, 9.2, 0);
  A('triport:solhaven', 11, 11.4, toward(11, 11.4, 11, 9));
  A('mailbox', -6.8, 15.4, toward(-6.8, 15.4, -6.8, 14.2));
  A('board:party', -10.4, 13, toward(-10.4, 13, -11.5, 11.5));
  A('npc:tasks', -14.2, 12.8, toward(-14.2, 12.8, 0, 8));
  A('npc:cards', -13.7, -2.4, toward(-13.7, -2.4, 0, 4));
  A('npc:bank', Math.cos(BA) * (BR - 9.6), Math.sin(BA) * (BR - 9.6), toward(Math.cos(BA) * (BR - 9.6), Math.sin(BA) * (BR - 9.6), 0, 0));
  A('npc:market', 29.7, 0.3, Math.PI / 2);
  A('npc:general', 41.4, -5.3, Math.PI);
  A('npc:blacksmith', -38.5, WR - 1.3, Math.PI);
  A('npc:gemcutter', -50, WR + 1.4, Math.PI);
  A('npc:tailor', -61, WR + 1.4, Math.PI);
  A('npc:stable', -67.6, -6.4, toward(-67.6, -6.4, -60, 0));
  A('npc:guild', 44, -53.2, Math.PI);
  A('npc:pvp', -22, -43.4, Math.PI);
  A('npc:songs', -30, 46.4, Math.PI);
  A('npc:harbor', 51.5, 2.2, Math.PI / 2);
  A('npc:stronghold', 60.2, 29.4, toward(60.2, 29.4, 52, 29.4));
  A('npc:brannoc', 9.2, -40.5, toward(9.2, -40.5, 0, -30));
  A('npc:seraphine', NX, NZ + 7.2, Math.PI);
  A('npc:rapport1', -18.5, 58.5, toward(-18.5, 58.5, -30, 52));
  A('npc:rapport2', 55.5, 44.5, toward(55.5, 44.5, 62, 50));
  A('npc:rapport3', 23.2, 1.2, toward(23.2, 1.2, 16, 0));
  pads.forEach(([name], i) => { const [x, z] = padPos[i]; A(name, x, z, toward(x, z, NX, NZ) + Math.PI); });
  A('dock:ship', QX + 21.5, 6, -Math.PI / 2);
  A('gate:goldmeadow', -78.5, 0, Math.PI / 2);
  A('fish:1', QX + 21.8, -20, -Math.PI / 2);
  A('vista:1', 38, -34.4, Math.PI);
  A('seed:1', 46.2, -2.2, 0); A('seed:2', -42.5, 76.5, 0); A('seed:3', QX + 18.5, -18.6, 0); A('seed:4', -53.2, 10.2, 0); A('seed:5', 42.5, -37.2, 0);
  // idle spots: fountain rim, benches, market, docks, garden, nexus, guild court, forge
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; const r = 7.6; A(`idle:fountain${i + 1}`, Math.cos(a) * r, Math.sin(a) * r, toward(Math.cos(a) * r, Math.sin(a) * r, 0, 0) + Math.PI); }
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2 + (i < 2 ? 0.25 : 0); const r = 14.4; A(`idle:bench${i + 1}`, Math.cos(a) * r, Math.sin(a) * r, toward(Math.cos(a) * r, Math.sin(a) * r, 0, 0)); }
  [[25.5, -0.6], [37, -0.4], [41.5, 0.6], [35.5, 1.2]].forEach(([x, z], i) => A(`idle:market${i + 1}`, x, z, rng.range(-3, 3)));
  [[QX + 6, -20], [QX + 14, 6.8], [QX + 9, 32], [QX + 16, 58]].forEach(([x, z], i) => A(`idle:dock${i + 1}`, x, z, -Math.PI / 2 + rng.range(-1, 1)));
  [[-24, 52], [-36, 46], [-47, 52], [-58, 51]].forEach(([x, z], i) => A(`idle:garden${i + 1}`, x, z, toward(x, z, -30, 52)));
  [[NX - 4, NZ + 6], [NX + 5, NZ + 5], [NX, NZ + 9.5]].forEach(([x, z], i) => A(`idle:nexus${i + 1}`, x, z, toward(x, z, NX, NZ)));
  [[39, -46], [49, -46]].forEach(([x, z], i) => A(`idle:guild${i + 1}`, x, z, Math.PI));
  A('idle:forge1', -34.2, -7.4, toward(-34.2, -7.4, -38.5, -12));
  A('idle:triport1', 13.5, 7.2, toward(13.5, 7.2, 11, 9));
  A('idle:well1', 22.5, 47, toward(22.5, 47, 25, 44));
  A('idle:stairs1', -4, -29.5, 0); A('idle:stairs2', 5, -29.5, 0);
  A('idle:arcade1', 13, 15.5, toward(13, 15.5, 0, 0)); A('idle:arcade2', -13, 15.5, toward(-13, 15.5, 0, 0));
  // snap every anchor onto walkable ground (a prop may sit on a nominal spot)
  for (const [name, a] of Object.entries(zone.anchors)) {
    if (nav.walkable(a.x, a.z)) continue;
    const p = nav.nearest(a.x, a.z, 4);
    if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } else console.warn('[solhaven] anchor off-nav', name);
  }

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('Central Plaza', 0, 0, 22);
  zone.region('Market Row', 36, 0, 14);
  zone.region('Harbour', 64, 20, 26);
  zone.region('Artisan Quarter', -44, 10, 16);
  zone.region('West Gate', -72, 0, 10);
  zone.region('Rift Nexus', NX, NZ, 16);
  zone.region('Guild Hall', 44, -56, 14);
  zone.region('Royal Keep', 0, -110, 30);
  zone.region('Garden of Dawn', -40, 56, 22);
  zone.region('Lantern Row', 24, 52, 20);
  const base = { music: 'solhaven', ambience: 'city' };
  zone.envs = { day: makeEnv('day', base), dusk: makeEnv('dusk', base), night: makeEnv('night', { ...base, music: 'solhaven_night', ambience: 'city_night' }) };
  zone.env = zone.envs.day;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: '#' + new THREE.Color(r.color).getHexString() }));
  zone.minimap = paintMinimap(zone, {
    px: 512, area: { x0: -90, z0: -92, size: 182 }, roofs,
    water: [{ shape: { rect: [QX + 60, 0, 120, 400] } }, { shape: { circle: [pond.x, pond.z, pond.r] } }, { shape: { circle: [0, 0, 6.5] } }],
  });
  zone.spots = kit.spots;
}
