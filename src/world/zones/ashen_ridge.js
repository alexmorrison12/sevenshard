// 'ashen_ridge' — demon-scorched highlands (~220×240 m, levels 40–50). Volcanic dusk, embers, lava glow.
//   The Cinder Road climbs north from the Thornwood gate (south-west) through Cinderfall, the scorched village (−50, 60)
//   and its burned chapel, to Emberwatch (−8, 26), the Solmara forward camp (hub, triport), then up to the Legion
//   Fortress (0, −92): a spiked gate (0, −68) and, inside, the courtyard arena where Varkhul waits with the first Shard.
//   West: ash dunes (−72, −4), the obsidian spires (−66, −52), the old mine in the western cliffs (−96, −28).
//   East: the lava river pouring off the high ledge (the Lava Falls, 74, −78) down past the broken siege engine (26, −22),
//   the Ashen Plain (field boss, 50, 30), sulphur vents (40, 78) and the eastern drop into the burning caldera.
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
import { buildLava } from '../water.js';
import { spike } from '../cliffs.js';
import { FieldGround, DistGrid, FieldKit, Anchors, snapAnchors, aliasNumbered, seedSpots, spline, along, paintPath, scatter, bump, faceTo, S, RNG, smoothstep, lerp, clamp } from '../fields/common.js';
import { FieldGrass, FieldFlora, tallGrassGeo } from '../fields/flora.js';
import { buildSmoke, buildDrifters, buildLavaFall } from '../fields/fx.js';
import * as F from '../fields/props.js';
import * as X from '../fields/ashen.js';

export const DEF = { name: 'Ashen Ridge', kind: 'field', size: 240 };
const LAVA = -1.3;
const BOUND = [[-104, -104], [-60, -110], [-44, -122], [44, -122], [60, -110], [100, -100], [104, -60], [98, -30], [104, 0], [100, 40], [104, 80], [96, 110], [60, 118], [20, 112], [-40, 116], [-56, 112], [-62, 124], [-78, 124], [-84, 112], [-104, 100], [-100, 60], [-106, 20], [-100, -20], [-106, -60]];
const LAVAR = spline([[74, -81], [72, -70], [62, -54], [56, -36], [48, -16], [58, 4], [74, 14], [90, 20], [106, 26], [130, 30]], 2);
const CINDER = [-50, 62], CHAPEL = [-76, 44], CAMP = [-8, 26], FORT = [0, -94], GATE = [0, -68], PLAIN = [48, 34], VENTS = [40, 80], SPIRES = [-66, -52], MINE = [-96, -28], DUNES = [-72, -2], SIEGE = [26, -24], FALLS = [74, -80], CHAOS = [-30, -46];
const TOWERS = [[-30, -18], [30, 74], [-86, 84]];

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 43);
  zone.bounds = { x0: -106, z0: -122, x1: 106, z1: 124 };
  const g = zone.ground = new FieldGround({
    x0: -150, z0: -160, w: 300, d: 320, res: 1, seed: 47, base: 'sand',
    layers: ['sand', 'obsidian', 'rock', 'gravel', 'dirt', 'mud', 'bloodstone', 'cobble', 'flagstone', 'grass'],
    ltint: { sand: [0.42, 0.46, 0.62], dirt: [0.46, 0.5, 0.62], grass: [0.95, 0.78, 0.46], rock: [0.66, 0.6, 0.58], gravel: [0.62, 0.58, 0.56], cobble: [0.7, 0.66, 0.64], flagstone: [0.7, 0.66, 0.62], mud: [0.6, 0.55, 0.52] },
  });
  g.emitColor.setRGB(1.3, 0.38, 0.08);
  const N = g.noise;
  const bound = S.poly(BOUND);
  // ---------------------------------------------------------------- roads
  const ROAD = spline([[-70, 140], [-70, 118], [-64, 96], [-54, 76], [-48, 60], [-40, 46], [-24, 36], [-10, 26], [-2, 10], [2, -10], [0, -30], [0, -50], [0, -64], [0, -80]], 2);
  const PATHS = {
    chapel: spline([[-44, 50], [-60, 46], [-70, 44]], 2),
    mine: spline([[-4, 4], [-30, -8], [-54, -20], [-74, -26], [-90, -28]], 2),
    spires: spline([[-40, -12], [-52, -34], [-60, -46]], 2),
    plain: spline([[-2, 20], [18, 26], [36, 30]], 2),
    vents: spline([[-30, 40], [0, 60], [22, 74], [34, 78]], 2),
    siege: spline([[2, -18], [16, -22], [22, -24]], 2),
    falls: spline([[0, -44], [26, -56], [46, -62], [62, -66]], 2),
    chaos: spline([[0, -34], [-18, -42], [-26, -46]], 2),
    west: spline([[-48, 60], [-66, 72], [-80, 80]], 2),
  };
  const roadD = new DistGrid(-150, -160, 300, 320, 1, 14).add(ROAD);
  for (const p of Object.values(PATHS)) roadD.add(p);
  const lavaD = new DistGrid(-150, -160, 300, 320, 1, 30).add(LAVAR);
  const NW = new (N.constructor)(19);
  const wob = (x, z) => NW.noise2(x / 8, z / 8) * 1.0 + NW.noise2(x / 3, z / 3 + 5) * 0.3;
  const chan = (x, z) => lavaD.at(x, z) + wob(x, z);
  // ---------------------------------------------------------------- terrain
  const fortPad = S.rect(0, -94, 86, 56);
  g.sculpt((x, z) => {
    let h = 1.6 + N.fbm2(x / 60, z / 60, 3) * 2.6 + N.fbm2(x / 17, z / 17 + 9, 2) * 0.8;
    h = Math.max(h, 0.4 + (h - 0.4) * 0.3);
    h += smoothstep(-20, -80, z) * 3.0;                                             // the land rises toward the fortress
    // ash dunes: long wind-rippled ridges in the west
    const dw = smoothstep(46, 16, Math.hypot((x - DUNES[0]) * 0.8, z - DUNES[1]));
    h += dw * (Math.sin(x * 0.19 + z * 0.08 + N.noise2(x / 20, z / 20) * 2.2) * 1.4 + 1.1);
    h += 4.5 * bump(x, z, TOWERS[0][0], TOWERS[0][1], 14) + 3.5 * bump(x, z, TOWERS[1][0], TOWERS[1][1], 12);
    h -= 1.2 * bump(x, z, PLAIN[0], PLAIN[1], 30);
    // the high ledge the lava pours from (north-east)
    h += 9 * smoothstep(-66, -80, z) * smoothstep(44, 60, x);
    const sd = bound.sd(x, z);
    if (sd > 0) {
      const east = smoothstep(40, 90, x) * smoothstep(-40, 0, z) * smoothstep(120, 60, z);
      h += (1 - east) * (12 * smoothstep(0, 10, sd) + N.fbm2(x / 12, z / 12, 3) * 3 * smoothstep(0, 6, sd));
      h -= east * 14 * smoothstep(0, 12, sd);                                     // the eastern drop into the caldera
    }
    // lava channel
    const dc = chan(x, z);
    if (dc < 7) h = Math.min(h, lerp(-2.6, h, smoothstep(2.2, 7, dc)));
    h -= 0.1 * smoothstep(2.5, 0.6, roadD.at(x, z));
    return h;
  });
  const H = (x, z) => g.heightAt(x, z);
  const pad = (x, z, r, soft = 6, dy = 0) => g.flatten(S.circle(x, z, r), H(x, z) + dy, soft);
  g.flatten(fortPad, 5.2, 8);
  pad(CAMP[0], CAMP[1], 16, 6); pad(CINDER[0], CINDER[1], 18, 6); pad(CHAPEL[0], CHAPEL[1], 9, 4); pad(PLAIN[0], PLAIN[1], 20, 8); pad(VENTS[0], VENTS[1], 12, 5);
  pad(SPIRES[0], SPIRES[1], 10, 5); pad(CHAOS[0], CHAOS[1], 11, 5); pad(SIEGE[0], SIEGE[1], 7, 4); pad(MINE[0] + 8, MINE[1], 7, 4);
  // road ramp up to the gate
  g.flatten(S.rect(0, -58, 12, 22), (x, z) => lerp(H(0, -46), 5.2, smoothstep(-47, -66, z)), 3);
  await tick();

  // ---------------------------------------------------------------- paint
  for (let i = 0; i < 80; i++) { const x = rng.range(-104, 104), z = rng.range(-110, 116); g.paint(rng.pick(['gravel', 'dirt', 'rock', 'obsidian']), S.circle(x, z, rng.range(2, 7)), { soft: 3, noise: 3, nscale: 3, amount: rng.range(0.25, 0.6) }); }
  g.paint('rock', { sd: (x, z) => 2 - bound.sd(x, z), box: [-150, -160, 150, 160] }, { soft: 4, noise: 4, nscale: 5 });
  // lava banks: black glass with glowing fissures, heat glow on the ground
  g.paint('obsidian', { sd: (x, z) => chan(x, z) - 7.5, box: [30, -130, 150, 60] }, { soft: 2, noise: 2.2, nscale: 3 });
  g.info('glow', { sd: (x, z) => chan(x, z) - 6.5, box: [30, -130, 150, 60] }, { soft: 5, amount: 0.9 });
  for (let i = 0; i < 26; i++) { const x = rng.range(-100, 100), z = rng.range(-100, 110); if (bound.sd(x, z) < -6 && roadD.at(x, z) > 5) g.paint('obsidian', S.line([[x, z], [x + rng.range(-9, 9), z + rng.range(-9, 9)]], rng.range(1.2, 2.2)), { soft: 1.2, noise: 1.2, nscale: 2 }); }
  paintPath(g, ROAD, 'gravel', 5.4, { wear: 0.4, noise: 1.2 });
  paintPath(g, ROAD, 'cobble', 3.2, { wear: 0, noise: 1.6, nscale: 2, amount: 0.6 });
  for (const p of Object.values(PATHS)) paintPath(g, p, 'dirt', 2.8, { wear: 0.3, amount: 0.85, noise: 1.2 });
  g.paint('flagstone', S.rect(0, -82, 16, 30), { soft: 0.6 });
  g.paint('bloodstone', S.circle(FORT[0], FORT[1], 20), { soft: 0.6 });
  g.plaza(FORT[0], FORT[1], 19.6, { layer: 'bloodstone', tile: 3.2, rings: [6, 12, 19], spokes: 12, border: 0.5 });
  g.paint('bloodstone', S.rect(0, -111, 20, 8), { soft: 0.5 });
  g.paint('flagstone', { sd: (x, z) => Math.max(fortPad.sd(x, z) + 3, -(Math.hypot(x - FORT[0], z - FORT[1]) - 20.5)), box: [-44, -124, 44, -64] }, { soft: 0.8, amount: 0.8 });
  g.paint('dirt', S.circle(CAMP[0], CAMP[1], 14), { soft: 3, noise: 2, nscale: 2.5 });
  g.paint('grass', S.circle(CAMP[0] - 12, CAMP[1] + 10, 8), { soft: 4, noise: 3, nscale: 3, amount: 0.8 });
  g.paint('dirt', S.circle(CINDER[0], CINDER[1], 17), { soft: 4, noise: 3, nscale: 3 });
  g.paint('cobble', S.circle(CINDER[0] + 2, CINDER[1], 7), { soft: 1, noise: 1.5, nscale: 2, amount: 0.8 });
  g.paint('grass', S.circle(CINDER[0] - 16, CINDER[1] + 16, 10), { soft: 4, noise: 4, nscale: 3, amount: 0.7 });
  g.paint('flagstone', S.rect(CHAPEL[0], CHAPEL[1], 8, 14), { soft: 0.8, noise: 1, nscale: 2, amount: 0.9 });
  g.paint('gravel', S.circle(PLAIN[0], PLAIN[1], 18), { soft: 5, noise: 5, nscale: 4, amount: 0.7 });
  g.paint('mud', S.circle(VENTS[0], VENTS[1], 11), { soft: 3, noise: 2, nscale: 2 });
  g.paint('obsidian', S.circle(SPIRES[0], SPIRES[1], 13), { soft: 3, noise: 3, nscale: 2 });
  g.paint('obsidian', S.circle(CHAOS[0], CHAOS[1], 9), { soft: 3, noise: 2.5, nscale: 2.5, amount: 0.8 });
  g.paint('gravel', S.circle(MINE[0] + 10, MINE[1], 8), { soft: 3, noise: 2, nscale: 2 });
  for (const [x, z] of TOWERS) g.paint('gravel', S.circle(x, z, 6), { soft: 2, noise: 2, nscale: 2, amount: 0.7 });
  await tick();

  // ---------------------------------------------------------------- structures & props
  const kit = new FieldKit({ seed: 47, chunk: 60 });
  const flags = new Flags();
  const smoke = [];
  const R = (x, z, o) => F.rock(kit, x, H(x, z), z, { tint: 0x6a605c, moss: null, ...o });
  // --- the Legion Fortress (its own kit: walls between the camera and the hero dissolve)
  const outer = kit;
  const fk = new FieldKit({ seed: 48, chunk: 60, fade: true });
  const FY = 5.2, FH = () => FY, SH = [0, -109.2];
  { const kit = fk;
  X.fortressGate(kit, flags, GATE[0], FY, GATE[1], 0, { w: 10, h: 10 });
  X.spikeWall(kit, -40, -68, -13.6, -68, FH, { h: 6.5, seed: 1 }); X.spikeWall(kit, 13.6, -68, 40, -68, FH, { h: 6.5, seed: 2 });
  X.spikeWall(kit, -40, -68, -40, -118, FH, { h: 10, seed: 3 }); X.spikeWall(kit, 40, -68, 40, -118, FH, { h: 10, seed: 4 });
  X.spikeWall(kit, -40, -118, 40, -118, FH, { h: 11, seed: 5 });
  for (const [x, z] of [[-40, -68], [40, -68], [-40, -118], [40, -118]]) X.fortressTower(kit, flags, x, FY, z, { r: 4.6, h: z > -80 ? 11 : 17, seed: Math.round(x + z) });
  // the courtyard arena: a ring of obsidian pillars with fire bowls, a dais with the throne and the Shard
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 10; if (Math.abs(Math.sin(a) - 1) < 0.1) continue; const x = FORT[0] + Math.cos(a) * 21.5, z = FORT[1] + Math.sin(a) * 21.5; X.obsidianSpire(kit, x, FY, z, { h: 5.5, r: 0.9, lean: 0.1, dir: a, seed: 10 + i }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.52; P.brazier(kit, FORT[0] + Math.cos(a) * 17.2, FY, FORT[1] + Math.sin(a) * 17.2, { s: 1.0, color: 0xff5a20, glow: 0xff4a10, base: 'metal' }); }
  kit.add('darkrock', box(18, 1.2, 7, 2), M(0, FY + 0.6, -112), { tint: 0x4a4240 });
  for (let i = 0; i < 4; i++) kit.add('darkrock', box(10 - i * 1.2, 0.3, 0.8, 1), M(0, FY + 0.15 + i * 0.3, -107.8 - i * 0.5), { tint: 0x5a5250 });
  zone.deck(S.rect(0, -112, 17.6, 6.6), FY + 1.2);
  // throne
  kit.add('darkrock', box(3.2, 1.2, 2.4, 1), M(0, FY + 1.8, -114), { tint: 0x3a3232 });
  kit.add('darkrock', box(3.4, 5.5, 0.8, 1), M(0, FY + 4.3, -115.2), { tint: 0x3a3232 });
  for (const s of [-1, 1]) spike(kit, s * 1.6, FY + 6.6, -115.2, { h: 3.2, r: 0.35, bend: 1.4, dir: s > 0 ? 0 : Math.PI, mat: 'bone', tint: 0x2a2424, block: false });
  kit.glow(box(2.4, 0.1, 0.1, 1), M(0, FY + 6.0, -114.75), 0xff3010, 2.6);
  // the Shard: a floating golden crystal over a pedestal, held by chains
  kit.add('darkrock', cyl(0.8, 1.0, 1.4, 8, 1), M(SH[0], FY + 1.9, SH[1]), { tint: 0x4a4240 });
  kit.glow(new THREE.OctahedronGeometry(0.55, 0).scale(0.8, 1.6, 0.8), M(SH[0], FY + 4.0, SH[1]), 0xffd070, 4.2);
  kit.light(SH[0], FY + 4.0, SH[1], 0xffd070, 8, 14, 0.05);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; kit.add('metal', box(0.06, 3.2, 0.06, 1), M(SH[0] + Math.cos(a) * 1.0, FY + 3.4, SH[1] + Math.sin(a) * 1.0, 0, 1, 1, 1, Math.sin(a) * 0.3, -Math.cos(a) * 0.3), { tint: 0x2a2624, ao: false }); }
  // barracks along the side walls, cages, racks, banners, bones
  for (const s of [-1, 1]) {
    kit.add('darkrock', box(9, 6, 24, 2), M(s * 33, FY + 3, -96), { tint: 0x4a4240, yGround: FY }); kit.block(S.rect(s * 33, -96, 9, 24), 0.3);
    kit.add('darkrock', box(10, 0.5, 25, 1), M(s * 33, FY + 6.1, -96), { tint: 0x5a5250, ao: false });
    for (let i = 0; i < 3; i++) { kit.add('paint', box(0.1, 2.2, 1.6, 1), M(s * (33 - 4.52), FY + 1.1, -104 + i * 8), { tint: 0x0a0808, ao: false }); kit.glow(box(0.1, 0.3, 1.0, 1), M(s * (33 - 4.55), FY + 3.2, -104 + i * 8), 0xff4a1a, 1.8); }
    X.legionBanner(kit, flags, s * 24, FY, -72, 0, { h: 8 }); X.legionBanner(kit, flags, s * 24, FY, -84, 0, { h: 7 });
    X.cage(kit, s * 26, FY, -108, s > 0 ? Math.PI : 0);
    P.weaponRack(kit, s * 27.5, FY, -80, s * Math.PI / 2);
    X.skullPike(kit, s * 8, FY, -74); X.skullPike(kit, s * 12, FY, -76, { lean: 0.1 });
  }
  X.firePit(kit, -14, FY, -78, { color: 0x60ff60, glow: 0x40ff50 }); X.firePit(kit, 14, FY, -78, { color: 0x60ff60, glow: 0x40ff50 });
  smoke.push({ x: -14, y: FY + 1.2, z: -78, size: 0.8, h: 10, rate: 0.9, color: 0x2a3a2a, glow: 0x106a10 }, { x: 14, y: FY + 1.2, z: -78, size: 0.8, h: 10, rate: 0.9, color: 0x2a3a2a, glow: 0x106a10 });
  for (const [x, z] of [[-40, -68], [40, -68], [-40, -118], [40, -118]]) smoke.push({ x, y: FY + (z > -80 ? 11 : 17), z, size: 1.4, h: 14, rate: 0.6, color: 0x2a2220, glow: 0x6a1a08 });
  }
  void outer;
  // outside the gate: banners lining the ramp, spikes, bodies of the siege
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) X.legionBanner(kit, flags, s * 7.2, H(s * 7.2, -52 + i * 5), -52 + i * 5, 0, { h: 6 + i * 0.5 });
  for (let i = 0; i < 12; i++) { const x = rng.range(-36, 36), z = -60 + rng.range(-4, 3); if (Math.abs(x) < 8) continue; spike(kit, x, H(x, z), z, { h: rng.range(1.8, 3), r: 0.25, bend: 0.8, dir: Math.PI / 2 + rng.range(-0.4, 0.4), mat: 'timber', tint: 0x3a2a1c, block: true }); }
  // --- Emberwatch: the forward camp
  const [cx0, cz0] = CAMP;
  const tents = [[cx0 - 8, cz0 - 6, 0.3, 0x3a5a8a], [cx0 + 8, cz0 - 7, -0.4, 0xd8d0c0], [cx0 - 11, cz0 + 4, 0.9, 0xd8d0c0], [cx0 + 11, cz0 + 3, -0.9, 0x3a5a8a]];
  for (const [x, z, r, c] of tents) F.tent(kit, x, H(x, z), z, r, { color: c, patch: 0x8a8070 });
  F.tent(kit, cx0, H(cx0, cz0 - 10), cz0 - 10, 0, { w: 4.4, d: 5, h: 3.2, color: 0x2a4a8a, patch: 0xc8a040 });   // command tent
  const cf = F.campfire(kit, cx0, H(cx0, cz0 + 1), cz0 + 1, { seed: 5 }); smoke.push({ x: cf.x, y: cf.y, z: cf.z, size: 0.5, h: 7, rate: 1, color: 0x6a6460, glow: 0x8a3a10 });
  B.triport(kit, cx0 + 12, H(cx0 + 12, cz0 + 12), cz0 + 12);
  P.weaponRack(kit, cx0 + 5, H(cx0 + 5, cz0 - 3), cz0 - 3, 0.2); P.anvil(kit, cx0 - 6, H(cx0 - 6, cz0 + 8), cz0 + 8, 0.3);
  for (let i = 0; i < 3; i++) P.crateStack(kit, cx0 + 13 + i * 1.8, H(cx0 + 13, cz0 - 2), cz0 - 2 + (i % 2) * 0.6, 0.2, 20 + i);
  for (const s of [-1, 1]) { flags.add(M(cx0 + s * 5 + 0.05, H(cx0 + s * 5, cz0 - 12) + 6.8, cz0 - 12), 1.4, 0.7, 0x2a5aa8, { hang: 'left' }); kit.add('metal', cyl(0.06, 0.07, 7, 5, 1), M(cx0 + s * 5, H(cx0 + s * 5, cz0 - 12) + 3.5, cz0 - 12), { tint: 0x2a2a30, ao: false }); kit.block(S.circle(cx0 + s * 5, cz0 - 12, 0.15), 0.2); }
  // spiked barricades facing north, sandbags, a memorial stone
  for (let i = 0; i < 7; i++) { const x = cx0 - 15 + i * 5, z = cz0 - 17 + Math.abs(i - 3) * 0.6; if (Math.abs(x - 0) < 4) continue; for (let k = 0; k < 3; k++) kit.add('timber', cyl(0.12, 0.14, 2.6, 6, 1), M(x - 1 + k, H(x, z) + 0.7, z, 0, 1, 1, 1, -0.7 + (k % 2) * 1.4, 0), { tint: 0x5a4028 }); kit.add('timber', cyl(0.14, 0.14, 3.2, 6, 1), M(x, H(x, z) + 0.9, z, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x5a4028 }); kit.block(S.rect(x, z, 3.2, 1.2), 0.25); }
  const memorial = [cx0 - 14, cz0 + 12]; F.standingStone(kit, memorial[0], H(...memorial), memorial[1], { h: 2.2, w: 1.2, tint: 0x8a8480, glyph: 0x6ac8ff });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.sack(kit, memorial[0] + Math.cos(a) * 1.6, H(...memorial), memorial[1] + Math.sin(a) * 1.6 + 1.5, 0.8, a, 0x8a8070); }
  for (let i = 0; i < 4; i++) F.lanternPost(kit, cx0 + [-16, 16, -4, 6][i], H(cx0, cz0), cz0 + [-2, 8, 14, -14][i], i);
  // --- Cinderfall: the scorched village and its burned chapel
  const [vx, vz] = CINDER;
  const homes = [[vx - 12, vz - 9, 0.2], [vx + 1, vz - 12, -0.1], [vx + 13, vz - 8, -0.35], [vx - 14, vz + 6, Math.PI / 2 - 0.2], [vx + 14, vz + 7, -Math.PI / 2 + 0.2], [vx - 4, vz + 14, 0.1], [vx + 8, vz + 16, -0.2]];
  homes.forEach(([x, z, r], i) => { const c = F.cottage(kit, x, H(x, z), z, r, { w: rng.range(5.5, 7), d: rng.range(4.5, 5.5), seed: 70 + i, burnt: i % 3 === 1 ? 0.7 : 0.95, roof: 'thatch', chimney: true }); if (c.chimney && i % 2 === 0) smoke.push({ x: c.chimney[0], y: c.chimney[1] - 1, z: c.chimney[2], size: 0.9, h: 11, rate: 0.7, color: 0x2e2826, glow: 0x5a1a08 }); X.rubble(kit, x + rng.range(-2, 2), 0, z + rng.range(2.5, 4), { r: 2.2, n: 8, seed: 80 + i, H }); });
  P.well(kit, vx + 2, H(vx + 2, vz), vz);
  for (let i = 0; i < 8; i++) { const a = rng.range(0, 6.28), d = rng.range(4, 16); X.charredPost(kit, vx + Math.cos(a) * d, H(vx + Math.cos(a) * d, vz + Math.sin(a) * d), vz + Math.sin(a) * d, { seed: i }); }
  for (let i = 0; i < 3; i++) { const x = vx - 6 + i * 6, z = vz + 3; F.hayBale(kit, x, H(x, z), z, i, { round: false }); }
  P.cart(kit, vx - 8, H(vx - 8, vz + 3), vz + 3, 0.9, { load: 0x3a3230 });
  const [chx, chz] = CHAPEL, CY = H(chx, chz), CH = () => CY;
  F.ruinWall(kit, chx - 4, chz - 7, chx - 4, chz + 5, CH, { h: 5, t: 0.9, seed: 21, tint: 0x8a8078, moss: 0x2a2220, window: true });
  F.ruinWall(kit, chx + 4, chz - 7, chx + 4, chz + 1, CH, { h: 4, t: 0.9, seed: 22, tint: 0x8a8078, moss: 0x2a2220 });
  F.ruinWall(kit, chx - 4, chz - 7, chx + 4, chz - 7, CH, { h: 6.5, t: 0.9, seed: 23, tint: 0x8a8078, moss: 0x2a2220 });
  F.archRuin(kit, chx, CY, chz + 5.5, 0, { w: 3, h: 4.4, tint: 0x8a8078, broken: true });
  kit.add('metal', cyl(0.5, 0.75, 1.1, 12, 1, true), M(chx + 1.8, CY + 0.5, chz - 2, 0, 1, 1, 1, 1.2), { tint: 0x6a5030 }); kit.block(S.circle(chx + 1.8, chz - 2, 0.8), 0.2);
  X.rubble(kit, chx, CY, chz - 2, { r: 3.5, n: 14, seed: 24, stone: 0x8a8078 });
  const lore1 = [chx - 1.8, chz - 5.2]; P.pot(kit, lore1[0], CY, lore1[1], 0.7, 0x5a4a3a);
  // --- watchtowers (broken, scorched)
  for (const [i, [tx, tz]] of TOWERS.entries()) F.ruinTower(kit, tx, H(tx, tz), tz, { r: 2.8, h: 9, seed: 40 + i, tint: 0x8a8078, moss: 0x2a2220, scorch: 0.6 });
  // --- the obsidian spires
  for (let i = 0; i < 16; i++) { const a = rng.range(0, 6.28), d = rng.range(4, 16), x = SPIRES[0] + Math.cos(a) * d, z = SPIRES[1] + Math.sin(a) * d; if (roadD.at(x, z) < 3) continue; X.obsidianSpire(kit, x, H(x, z), z, { h: rng.range(3.5, 8.5), r: rng.range(0.6, 1.3), lean: rng.range(0.1, 0.5), dir: rng.range(0, 6.28), seed: 60 + i }); }
  // --- the old mine: a rock face with the tunnel mouth, rails, carts
  const mineFace = [[MINE[0] - 2, MINE[1] - 16], [MINE[0] + 1, MINE[1] - 6], [MINE[0] + 1, MINE[1] + 6], [MINE[0] - 2, MINE[1] + 16]];
  F.cliffEdge(kit, mineFace, H, { height: 9, thick: 6, seed: 33, inside: [0, MINE[1]], tint: 0x7a6e66, strata: 0x5a5048, top: 0x4a4038, mat: 'darkrock' });
  X.mineEntrance(kit, MINE[0] + 2.4, H(MINE[0] + 2.4, MINE[1]), MINE[1], Math.PI / 2);
  X.rails(kit, [[MINE[0] + 3, MINE[1]], [MINE[0] + 12, MINE[1] + 0.5], [MINE[0] + 20, MINE[1] + 3], [MINE[0] + 26, MINE[1] + 8]], H);
  X.mineCart(kit, MINE[0] + 9, H(MINE[0] + 9, MINE[1] + 0.3), MINE[1] + 0.3, Math.PI / 2 + 0.05, { load: 0x3a3036 });
  X.mineCart(kit, MINE[0] + 24, H(MINE[0] + 24, MINE[1] + 9.5), MINE[1] + 9.5, 0.5, { tipped: true });
  F.woodpile(kit, MINE[0] + 7, H(MINE[0] + 7, MINE[1] - 4), MINE[1] - 4, 0.2);
  // --- the broken siege engine and the remains of the Solmara assault
  X.siegeEngine(kit, SIEGE[0], H(...SIEGE), SIEGE[1], 0.5, { seed: 3 });
  const lore3 = [SIEGE[0] - 4.5, SIEGE[1] + 3];
  for (let i = 0; i < 5; i++) { const x = SIEGE[0] + rng.range(-9, 9), z = SIEGE[1] + rng.range(-7, 7); if (Math.hypot(x - SIEGE[0], z - SIEGE[1]) < 4) continue; kit.add('metal', box(0.6, 0.5, 0.2, 1), M(x, H(x, z) + 0.25, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.8, 0.8)), { tint: 0x7a7a80 }); }
  // --- sulphur vents
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rng.range(-0.3, 0.3), d = i === 0 ? 0 : rng.range(5, 9), x = VENTS[0] + Math.cos(a) * d, z = VENTS[1] + Math.sin(a) * d; smoke.push(X.sulphurVent(kit, x, H(x, z), z, { s: i === 0 ? 1.4 : rng.range(0.7, 1.1), seed: i })); }
  // --- the chaos rift site
  F.standingStone(kit, CHAOS[0], H(CHAOS[0], CHAOS[1] - 7), CHAOS[1] - 7, { h: 3.6, w: 1.4, tint: 0x3a3434, glyph: 0xc050ff });
  // --- the lava falls: the lava pours from the high ledge into the river head
  const fallTop = H(FALLS[0], FALLS[1] - 8) + 0.2, fallBot = LAVA;
  for (const [x, z, s] of [[FALLS[0] - 7, FALLS[1] + 2, 1.4], [FALLS[0] + 7, FALLS[1] + 1, 1.2], [FALLS[0] - 10, FALLS[1] - 6, 1.8], [FALLS[0] + 10, FALLS[1] - 7, 1.6]]) R(x, z, { s, seed: Math.round(x), tint: 0x3a3232 });
  kit.light(FALLS[0], LAVA + 3, FALLS[1] + 2, 0xff5a10, 12, 22, 0.2);
  // --- scatter: boulders, spires, charred stumps, bones, craters
  const EXC = [[...CAMP, 18], [...CINDER, 20], [...CHAPEL, 10], [...PLAIN, 20], [...VENTS, 12], [...SPIRES, 17], [...CHAOS, 11], [...SIEGE, 9], [MINE[0] + 10, MINE[1], 12], [...DUNES, 6], ...TOWERS.map(([x, z]) => [x, z, 7])];
  const free = (x, z, rr = 3, road = 4) => bound.sd(x, z) < -rr && roadD.at(x, z) > road && chan(x, z) > 8 && fortPad.sd(x, z) > rr + 2 && !EXC.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er + rr);
  for (const [x, z] of scatter(rng, [-104, -104, 104, 116], 13, 420, (x, z) => free(x, z, 1.5, 3.5) && rng.chance(0.65))) {
    const k = rng.next();
    if (k < 0.45) F.rockCluster(kit, x, z, H, { n: rng.int(1, 3), s: rng.range(0.6, 1.4), seed: Math.round(x * 31 + z), tint: 0x5e5652, moss: null });
    else if (k < 0.62) X.obsidianSpire(kit, x, H(x, z), z, { h: rng.range(2.5, 5), r: rng.range(0.5, 0.9), lean: rng.range(0.1, 0.5), dir: rng.range(0, 6.28), seed: Math.round(x + z) });
    else if (k < 0.8) F.stump(kit, x, H(x, z), z, { r: rng.range(0.4, 0.7), h: rng.range(0.5, 1.1), seed: Math.round(x + z * 7), tint: 0x2a2220, moss: false });
    else R(x, z, { s: rng.range(0.4, 0.8), seed: Math.round(x * 13 + z), tint: 0x4a4440, block: false });
  }
  for (let s2 = 10; s2 < 250; s2 += 9) { const p = along(LAVAR, s2), side = rng.sign(), d = rng.range(6.5, 8), x = p.x - p.dz * d * side, z = p.z + p.dx * d * side; if (bound.sd(x, z) < -2 && roadD.at(x, z) > 3) R(x, z, { s: rng.range(0.5, 1.1), seed: Math.round(s2 * 7), tint: 0x2e2a2c, block: rng.chance(0.5) }); }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.35 });
  await tick();
  for (const c of fk.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2.0, amount: 0.35 });
  await g.build(zone.root);
  kit.build(zone.root); fk.build(zone.root);
  kit.colliders.push(...fk.colliders); kit.lights.push(...fk.lights); kit.flames.push(...fk.flames);
  const flagMesh = flags.build(); if (flagMesh) zone.root.add(flagMesh);
  await tick();

  // ---------------------------------------------------------------- lava
  const lava = buildLava({ x: 64, z: -30, w: 96, d: 130, level: LAVA, hot: 0xff5a10, cool: 0xff2a00 });
  const caldera = buildLava({ x: 150, z: 20, w: 90, d: 200, level: -10.5, hot: 0xff4a10, cool: 0xc02000 });
  const fall = buildLavaFall({ x: FALLS[0], z: FALLS[1] - 5.2, y0: LAVA - 0.2, y1: fallTop, w: 6.5, rot: 0, curve: 2.2 });
  zone.root.add(lava, caldera, fall);

  // ---------------------------------------------------------------- flora: charred trees, dead grass
  const flora = new FieldFlora({ cell: 64 });
  const T = (sp, x, z, o = {}) => flora.tree(sp, x, H(x, z) - 0.15, z, { rot: rng.range(0, 6.28), ...o });
  for (const [x, z] of scatter(rng, [-104, -104, 104, 116], 11, 700, (x, z) => free(x, z, 2, 4.5) && rng.chance(0.55))) T('charred', x, z, { s: rng.range(0.8, 1.3), variant: 0 });
  for (const [gx, gz] of [CINDER, CHAPEL, [-80, 100], [-90, 60]]) for (let i = 0; i < 7; i++) { const x = gx + rng.range(-18, 18), z = gz + rng.range(-16, 16); if (free(x, z, 1.5, 3.5) || (Math.hypot(x - gx, z - gz) > 14 && bound.sd(x, z) < -2 && roadD.at(x, z) > 4)) T('charred', x, z, { s: rng.range(0.9, 1.3), variant: 0 }); }
  for (const [x, z] of scatter(rng, [-150, -160, 150, 160], 9, 1500, (x, z) => { const sd = bound.sd(x, z); return sd > 2 && sd < 26 && x < 70; })) T('charred', x, z, { s: rng.range(1.0, 1.5), variant: 0, block: false });
  const dg = flora.mats.flower;
  for (const [x, z] of scatter(rng, [-104, -104, 104, 116], 3.2, 3000, (x, z) => free(x, z, 0.3, 2.5) && g.weight('grass', x, z) > 0.3)) flora.thing('deadgrass', () => tallGrassGeo(5, { h: 0.7, color: 0x5a4a2a, tip: 0xa88a50 }), dg, x, H(x, z) - 0.03, z, { s: rng.range(0.7, 1.2), rot: rng.range(0, 6.28), cast: false });
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new FieldGrass(g, { layer: 'grass', shape: 'grass', density: quality * 0.8, height: 0.9, tint: [0.95, 0.8, 0.5] });
  zone.root.add(grass.mesh);
  await tick();

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  const sprinkle = (kind, n, cx, cz, r, o = {}) => { for (let i = 0; i < n; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; dec.add(kind, x, z, { size: rng.range(o.s0 ?? 1, o.s1 ?? 2.2), alpha: o.a ?? 0.8, tint: o.tint ?? 0xffffff, emit: o.emit ?? 0, emitI: o.emitI ?? 0 }); } };
  for (let i = 0; i < 160; i++) { const x = rng.range(-104, 104), z = rng.range(-110, 116); if (free(x, z, 0, 2)) dec.add(rng.chance(0.5) ? 'scorch' : rng.chance(0.5) ? 'cracks' : 'rubble', x, z, { size: rng.range(1.5, 3.5), alpha: 0.75 }); }
  for (let i = 0; i < 40; i++) { const x = rng.range(-100, 100), z = rng.range(-100, 110); if (free(x, z, 0, 3)) dec.add('fissure', x, z, { size: rng.range(2, 4), emit: 0xff5a10, emitI: 2.2, alpha: 0.9 }); }
  sprinkle('scorch', 24, CINDER[0], CINDER[1], 16, { s0: 2, s1: 4 }); sprinkle('rubble', 16, CINDER[0], CINDER[1], 15);
  sprinkle('blood', 8, FORT[0], FORT[1], 16, { a: 0.6, s0: 1.5, s1: 3 }); sprinkle('cracks', 16, FORT[0], FORT[1], 18, { s0: 2, s1: 3.5 });
  dec.add('runes', FORT[0], FORT[1], { size: 14, tint: 0xff5a20, emit: 0xff3a10, emitI: 0.7, alpha: 0.65 });
  dec.add('runes', CHAOS[0], CHAOS[1], { size: 8, tint: 0xa060ff, emit: 0x8040ff, emitI: 1.0, alpha: 0.6 }); sprinkle('fissure', 6, CHAOS[0], CHAOS[1], 7, { emit: 0xa040ff, emitI: 1.8 });
  sprinkle('stain', 14, VENTS[0], VENTS[1], 10, { s0: 2, s1: 4, tint: 0xd8c860, a: 0.6 });
  sprinkle('scorch', 12, PLAIN[0], PLAIN[1], 18, { s0: 3, s1: 5, a: 0.6 }); sprinkle('fissure', 10, PLAIN[0], PLAIN[1], 16, { emit: 0xff5a10, emitI: 2.2, s0: 2, s1: 4 });
  sprinkle('pebbles', 20, CAMP[0], CAMP[1], 12); sprinkle('straw', 8, CAMP[0], CAMP[1], 8);
  for (let s2 = 4; s2 < 300; s2 += 8) { const p = along(ROAD, s2); dec.add(rng.chance(0.5) ? 'cracks' : 'scorch', p.x + rng.range(-1.2, 1.2), p.z + rng.range(-1.2, 1.2), { size: rng.range(1.2, 2.2), alpha: 0.6 }); }
  const decMesh = dec.build(); if (decMesh) zone.root.add(decMesh);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const embers = buildParticles('embers', { quality });
  const ash = buildDrifters('ash', { quality });
  const smokeMesh = buildSmoke(smoke);
  for (const m of [embers, ash, smokeMesh]) if (m) zone.root.add(m);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); embers.userData.update(focus); ash.userData.update(focus); grass.update(focus); g.uniforms && (g.uniforms.uEmitPulse.value = 0.85 + 0.15 * Math.sin(t * 1.3)); });
  zone.onEnv(env => { pool.scale = 0.9 + env.night * 0.8; kitMaterial('window').emissiveIntensity = 0.3 + env.night * 1.2; });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-108, -124, 216, 250, 0.5);
  nav.walk(S.inflate(bound, -0.6));
  nav.blockWhere((x, z) => chan(x, z) < 5.2);
  nav.blockWhere((x, z) => x > 56 && z < -68 && H(x, z) > 7.5);           // the high ledge above the falls
  // a basalt ford across the lava river toward the plain (cooled crust)
  const ford = along(LAVAR, 100); const fordShape = S.rect(ford.x, ford.z, 4.4, 14, Math.atan2(-ford.dz, ford.dx) + Math.PI / 2);
  nav.walk(fordShape);
  nav.walk(S.rect(0, -112, 17, 6));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[-70, 106]]);
  zone._nav = nav; zone.nav = nav.toContract();
  // raise the ford as a crust bridge (walkable deck over the lava)
  zone.deck(fordShape, LAVA + 0.35);
  { const Fg = new THREE.Group(); const fk = new FieldKit({ seed: 3 }); for (let i = 0; i < 16; i++) { const t = (i + 0.5) / 16 - 0.5; const lx = ford.x - ford.dz * 0 + ford.dx * 0, cx = ford.x + (-ford.dz) * t * 14, cz = ford.z + ford.dx * t * 14; fk.add('darkrock', new THREE.CylinderGeometry(1.4 + (i % 3) * 0.3, 1.7, 1.6, 7), M(cx + rng.range(-0.6, 0.6), LAVA - 0.45, cz, rng.range(0, 3)), { tint: 0x3a3234, ao: false }); void lx; } fk.build(Fg); zone.root.add(Fg); }
  await tick();

  // ---------------------------------------------------------------- anchors
  const A = new Anchors(zone);
  A.add('spawn', -70, 106, 0);
  A.add('gate:thornwood', -70, 121, Math.PI);
  A.add('triport:ashen_ridge', CAMP[0] + 12, CAMP[1] + 14.6, faceTo(CAMP[0] + 12, CAMP[1] + 14.6, CAMP[0], CAMP[1]));
  A.npc('commander', CAMP[0], CAMP[1] - 6.5, Math.PI);
  A.npc('quartermaster', CAMP[0] + 12.5, CAMP[1] - 0.4, faceTo(CAMP[0] + 12.5, CAMP[1] - 0.4, CAMP[0], CAMP[1]));
  A.npc('healer', CAMP[0] - 8, CAMP[1] - 2.6, faceTo(CAMP[0] - 8, CAMP[1] - 2.6, CAMP[0], CAMP[1] + 2));
  A.npc('scout', TOWERS[0][0] + 1, TOWERS[0][1] + 4.6, faceTo(TOWERS[0][0] + 1, TOWERS[0][1] + 4.6, 0, -60));
  A.npc('smith', CAMP[0] - 6, CAMP[1] + 10, Math.PI + 0.3);
  A.npc('survivor', CINDER[0] + 4, CINDER[1] + 2.2, faceTo(CINDER[0] + 4, CINDER[1] + 2.2, CINDER[0], CINDER[1] + 8));
  A.npc('priest', CHAPEL[0], CHAPEL[1] + 7.5, Math.PI);
  A.npc('miner', MINE[0] + 10, MINE[1] - 3, faceTo(MINE[0] + 10, MINE[1] - 3, MINE[0], MINE[1]));
  A.pack(-12, -40, 8, 'demons'); A.pack(16, -46, 7, 'demons'); A.pack(0, -84, 9, 'demons'); A.pack(-24, -96, 7, 'demons');
  A.pack(SPIRES[0] + 3, SPIRES[1] + 2, 8, 'imps'); A.pack(DUNES[0], DUNES[1], 8, 'imps'); A.pack(-40, 84, 7, 'imps');
  A.pack(TOWERS[1][0] - 2, TOWERS[1][1] - 6, 7, 'gargoyles'); A.pack(26, -100, 7, 'gargoyles'); A.pack(-80, 20, 7, 'gargoyles');
  A.pack(64, 58, 8, 'hounds'); A.pack(CINDER[0] + 2, CINDER[1] - 4, 8, 'hounds'); A.pack(VENTS[0] - 12, VENTS[1] - 4, 7, 'casters'); A.pack(SIEGE[0] + 6, SIEGE[1] + 8, 7, 'brutes');
  A.elite(0, -80, 'demons'); A.elite(SPIRES[0], SPIRES[1] + 4, 'imps'); A.elite(CINDER[0] - 2, CINDER[1] + 8, 'hounds'); A.elite(TOWERS[1][0], TOWERS[1][1] - 9, 'gargoyles');
  A.add('fieldboss', PLAIN[0], PLAIN[1], Math.PI, { r: 18 });
  A.add('chaosgate', CHAOS[0], CHAOS[1], Math.PI, { r: 9 });
  A.add('arena:varkhul', FORT[0], FORT[1], Math.PI, { r: 18 });
  A.add('boss:varkhul', FORT[0], FORT[1] - 10, 0);
  A.add('duel', FORT[0], FORT[1] + 6, 0);
  A.node('mine', SPIRES[0] - 6, SPIRES[1] + 8); A.node('mine', MINE[0] + 6, MINE[1] + 5); A.node('mine', 44, -40);
  A.node('dig', CHAPEL[0] + 2, CHAPEL[1] + 7.6); A.node('dig', TOWERS[2][0] + 4, TOWERS[2][1] + 3); A.node('dig', SIEGE[0] + 6, SIEGE[1] - 4);
  A.node('forage', VENTS[0] + 8, VENTS[1] + 8); A.node('forage', -84, 64);
  A.node('log', CINDER[0] - 18, CINDER[1] + 16); A.node('log', -92, 100);
  A.node('hunt', 76, 86);
  A.add('vista:lava_falls', 54, -64, faceTo(54, -64, FALLS[0], FALLS[1] - 5));
  A.add('vista:fortress', 0, -44, 0);
  A.add('lore:1', lore1[0], lore1[1] + 1.4, Math.PI);
  A.add('lore:2', memorial[0], memorial[1] + 1.4, Math.PI);
  A.add('lore:3', lore3[0], lore3[1], faceTo(lore3[0], lore3[1], SIEGE[0], SIEGE[1]));
  A.poi('fortress_gate', GATE[0], GATE[1] + 8, 0); A.poi('courtyard', FORT[0], FORT[1] + 12, 0); A.poi('shard', SH[0], SH[1] + 2.4, 0); A.poi('throne', 0, -110.6, 0);
  A.poi('emberwatch', CAMP[0], CAMP[1] + 6, Math.PI); A.poi('cinderfall', CINDER[0], CINDER[1] + 4, Math.PI); A.poi('chapel', CHAPEL[0], CHAPEL[1] + 8, 0);
  A.poi('lava_falls', 52, -60, faceTo(52, -60, FALLS[0], FALLS[1] - 5)); A.poi('obsidian_spires', SPIRES[0], SPIRES[1] + 14, 0); A.poi('old_mine', MINE[0] + 10, MINE[1] + 2, -Math.PI / 2);
  A.poi('sulphur_vents', VENTS[0], VENTS[1] - 12, Math.PI); A.poi('siege_engine', SIEGE[0], SIEGE[1] + 6, 0); A.poi('ash_dunes', DUNES[0] + 6, DUNES[1], -Math.PI / 2);
  A.poi('ashen_plain', PLAIN[0], PLAIN[1] + 16, 0); A.poi('watchtower', TOWERS[0][0], TOWERS[0][1] + 5, 0); A.poi('lava_ford', ford.x, ford.z, 0);
  const SPOTS = [
    { name: 'the demon fortress gate', at: [[GATE[0] - 8.5, GATE[1] + 6], [GATE[0] + 8.5, GATE[1] + 6.5]] },
    { name: 'the lava falls', at: [[56, -67], [50, -58]] },
    { name: 'the scorched village', at: [[CINDER[0] - 12, CINDER[1] - 5], [CINDER[0] + 8, CINDER[1] + 19.5]] },
    { name: 'the obsidian spires', at: [[SPIRES[0] - 4, SPIRES[1] - 2], [SPIRES[0] + 8, SPIRES[1] - 6]] },
    { name: 'the old mine cart track', at: [[MINE[0] + 16, MINE[1] + 4], [MINE[0] + 24, MINE[1] + 11]] },
    { name: 'the burned chapel', at: [[CHAPEL[0] + 1.8, CHAPEL[1] - 4], [CHAPEL[0] - 2.6, CHAPEL[1] + 3]] },
    { name: 'the sulphur vents', at: [[VENTS[0] + 3, VENTS[1] - 3], [VENTS[0] - 6, VENTS[1] + 6]] },
    { name: 'the broken siege engine', at: [[SIEGE[0] + 2.5, SIEGE[1] + 4.5], [SIEGE[0] - 3, SIEGE[1] - 5]] },
    { name: 'the ash dunes', at: [[DUNES[0] - 8, DUNES[1] + 10], [DUNES[0] + 10, DUNES[1] - 12]] },
    { name: 'the Legion banners', at: [[-7.2, -46.5], [23, -83]] },
  ];
  for (const s of seedSpots('ashen_ridge', SPOTS, 18)) A.add(`seed:${s.i}`, s.x, s.z, 0, { hint: `${s.where} ${s.name}` });
  aliasNumbered(zone, 'vista');
  snapAnchors(zone, nav, 6, 'ashen_ridge');

  // ---------------------------------------------------------------- regions, env, minimap
  zone.region('Legion Fortress', FORT[0], FORT[1], 30); zone.region('The Fortress Gate', GATE[0], GATE[1] + 4, 10); zone.region('Emberwatch', CAMP[0], CAMP[1], 16);
  zone.region('Cinderfall', CINDER[0], CINDER[1], 18); zone.region('Burned Chapel', CHAPEL[0], CHAPEL[1], 9); zone.region('The Lava Falls', FALLS[0], FALLS[1] + 6, 12);
  zone.region('Obsidian Spires', SPIRES[0], SPIRES[1], 16); zone.region('The Old Mine', MINE[0] + 8, MINE[1], 12); zone.region('Ash Dunes', DUNES[0], DUNES[1], 22);
  zone.region('The Ashen Plain', PLAIN[0], PLAIN[1], 20); zone.region('Sulphur Vents', VENTS[0], VENTS[1], 12); zone.region('The Broken Siege', SIEGE[0], SIEGE[1], 9);
  const base = { music: 'ashen_ridge', ambience: 'volcanic' };
  const dusk = makeEnv('volcanic', {
    ...base, sunColor: 0xffc0a0, sunIntensity: 2.5, sunDir: [-0.68, 0.46, 0.42],
    hemiSky: 0x8a7078, hemiGround: 0x3a2418, hemiIntensity: 1.35,
    fogColor: 0x4a302c, fogSunColor: 0xff8a4a, fogDensity: 0.0075, fogHeight: 0.05, fogBase: -3,
    background: 0x2a1614,
    grade: { exposure: 1.12, saturation: 1.03, contrast: 1.1, vignette: 0.44, warm: 0.05, cool: 0.03, lift: [0.02, 0.01, 0.01], gain: [1.03, 0.98, 0.94], bloom: 0.85, bloomRadius: 0.62, bloomThreshold: 0.8 },
    weather: 'ash', night: 0.55,
  });
  zone.envs = { day: dusk, dusk, night: makeEnv('night', { ...base, fogColor: 0x2a1410, background: 0x120806 }) };
  zone.env = dusk;
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: typeof r.color === 'number' ? '#' + new THREE.Color(r.color).getHexString() : r.color }));
  zone.minimap = paintMinimap(zone, {
    px: 512, area: { x0: -110, z0: -124, size: 248 }, roofs,
    marks: [{ shape: { line: ROAD }, color: '#7a6a5a', alpha: 0.8, width: 4 }, ...Object.values(PATHS).map(p => ({ shape: { line: p }, color: '#6a5a4a', alpha: 0.6, width: 2.4 })), { shape: { rect: [0, -93, 80, 50] }, color: '#3a2a28', alpha: 0.5 }],
  });
  { const ctx = zone.minimap.canvas.getContext('2d'), s = 512 / 248; ctx.save(); ctx.strokeStyle = '#ff5a18'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); LAVAR.forEach(([x, z], i) => { const u = (x + 110) * s, v = (z + 124) * s; i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.restore(); }
  zone.spots = kit.spots;
}

try { registerZone('ashen_ridge', DEF, build); } catch { queueMicrotask(() => registerZone('ashen_ridge', DEF, build)); }
