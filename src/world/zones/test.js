// 'test' — the Proving Plaza: a 60×60 m walled stone plaza for combat playtesting. Polar-paved centre ring,
// cobbled ring road, columns to fight around, braziers, training dummies, crates, a closed south gate.
import { Zone, tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { Grass, Flora } from '../foliage.js';
import { RNG } from '../../core/noise.js';

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 7);
  const HALF = 30;
  zone.bounds = { x0: -HALF, z0: -HALF, x1: HALF, z1: HALF };
  // ---------- ground
  const g = zone.ground = new Ground({ x0: -60, z0: -60, w: 120, d: 120, res: 1, layers: ['flagstone', 'cobble', 'grass', 'dirt', 'marble', 'moss'], base: 'grass', seed: 3 });
  g.sculpt((x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z));
    return r > HALF + 3 ? (r - HALF - 3) * 0.35 + g.noise.noise2(x / 14, z / 14) * 1.2 : 0;
  });
  g.paint('dirt', S.rect(0, 0, 2 * HALF + 10, 2 * HALF + 10), { soft: 2, noise: 2.5, nscale: 6 });
  g.paint('flagstone', S.rect(0, 0, 2 * HALF, 2 * HALF), { soft: 0.4 });
  g.paint('cobble', S.ring(0, 0, 17, 5), { soft: 0.3 });
  g.paint('cobble', S.line([[0, 17], [0, HALF]], 4), { soft: 0.3 });
  g.plaza(0, 0, 14.5, { layer: 'flagstone', tile: 3.0, rings: [4, 9.5, 14.2], spokes: 14, border: 0.5 });
  // grass creeping in along the walls and corners, moss patches
  for (const [cx, cz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) g.paint('grass', S.circle(cx, cz, 9), { soft: 3, noise: 3, nscale: 3 });
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(20, 29);
    g.paint(rng.chance(0.5) ? 'moss' : 'grass', S.circle(Math.cos(a) * r, Math.sin(a) * r, rng.range(1.2, 3)), { soft: 1.5, noise: 1.2, nscale: 1.5, amount: 0.9 });
  }
  g.info('wear', S.ring(0, 0, 17, 3), { soft: 2, amount: 0.8 });
  g.info('wear', S.line([[0, 14], [0, 28]], 3), { soft: 2, amount: 0.7 });
  g.info('wet', S.circle(-18, 12, 2.2), { soft: 1.5, noise: 1, nscale: 1.5 });
  g.info('wet', S.circle(21, -6, 1.6), { soft: 1.5, noise: 1, nscale: 1.5 });
  // contact darkening along the wall feet
  g.info('ao', S.subtract(S.rect(0, 0, 2 * HALF + 2, 2 * HALF + 2), S.rect(0, 0, 2 * HALF - 2.5, 2 * HALF - 2.5)), { soft: 2, amount: 0.35 });
  await g.build(zone.root);
  await tick();

  // ---------- architecture & props
  const kit = new Kit({ seed: 11 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const W = HALF + 0.7;
  P.wall(kit, -W, -W, W, -W, H, { h: 5, t: 1.4, buttress: 2 });
  P.wall(kit, W, -W, W, W, H, { h: 5, t: 1.4, buttress: 2 });
  P.wall(kit, -W, W, -W, -W, H, { h: 5, t: 1.4, buttress: 2 });
  P.wall(kit, -W, W, -4.5, W, H, { h: 5, t: 1.4 });
  P.wall(kit, 4.5, W, W, W, H, { h: 5, t: 1.4 });
  for (const [x, z] of [[-W, -W], [W, -W], [-W, W], [W, W]]) P.tower(kit, x, 0, z, { r: 3.2, h: 9, roofH: 6, roof: 0x3a5a9a, flags, flag: 0xb02a2a });
  // south gate: two towers and a portcullis
  for (const s of [-1, 1]) P.tower(kit, s * 6.2, 0, W, { r: 2.4, h: 8, roofH: 5, roof: 0x9a3a2a, flags, flag: 0x2a5aa8 });
  kit.add('stone', box(8.4, 2.2, 1.8, 2), M(0, 6.1, W), { tint: 0xe8e2d6 });
  for (let i = 0; i < 9; i++) kit.add('metal', box(0.1, 5.2, 0.1, 1), M(-3.6 + i * 0.9, 2.6, W + 0.2), { tint: 0x2a2a2e, ao: false });
  for (let i = 0; i < 5; i++) kit.add('metal', box(8, 0.1, 0.1, 1), M(0, 0.6 + i * 1.1, W + 0.2), { tint: 0x2a2a2e, ao: false });
  kit.block(S.rect(0, W, 9, 1.8));
  // banners on the north wall facing the plaza
  for (let i = -2; i <= 2; i++) P.banner(kit, flags, i * 9, 4.6, -W + 0.75, 0, { color: i % 2 ? 0xb02a2a : 0x2a5aa8 });
  // column ring (cover to fight around)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, r = 21;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 4 && z > 0) continue;
    P.column(kit, x, 0, z, 5.2, 0.45);
  }
  // braziers
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) P.brazier(kit, x, 0, z);
  // central medallion
  // training dummies (north)
  for (let i = -2; i <= 2; i++) P.dummy(kit, i * 3, 0, -24.5, 0);
  P.weaponRack(kit, -14, 0, -27.5, 0);
  P.weaponRack(kit, 14, 0, -27.5, 0);
  // crates & barrels along the walls
  P.crateStack(kit, -26, 0, -20, 0.3, 1); P.crateStack(kit, 26, 0, 18, -0.4, 2); P.crateStack(kit, 25, 0, -24, 1.2, 3);
  for (let i = 0; i < 4; i++) P.barrel(kit, -27 + (i % 2) * 0.8, 0, 22 + i * 0.75, 1, rng.range(0, 6));
  P.hay(kit, 26.5, 0, 4, 1, 0.2); P.hay(kit, 26.5, 0.6, 4.2, 0.9, -0.1);
  P.planter(kit, -6, 0, 26.5, { w: 3, d: 1, seed: 4 }); P.planter(kit, 6, 0, 26.5, { w: 3, d: 1, seed: 5 });
  P.bench(kit, -14, 0, 27.5, Math.PI); P.bench(kit, 14, 0, 27.5, Math.PI);
  P.lampPost(kit, -4.5, 0, 22, 0); P.lampPost(kit, 4.5, 0, 22, 0);
  P.noticeBoard(kit, -9, 0, 27.8, Math.PI);
  for (const s of [-1, 1]) for (const z of [-15, 5]) P.wallTorch(kit, s * (W - 0.72), 2.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  kit.build(zone.root);
  const fl = flags.build(); if (fl) zone.root.add(fl);
  await tick();

  // ---------- foliage
  const flora = new Flora();
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-55, 55), z = rng.range(-58, -38);
    flora.tree(rng.chance(0.3) ? 'cypress' : 'broadleaf', x, H(x, z) - 0.1, z, { s: rng.range(0.9, 1.2), variant: i % 3 });
  }
  for (let i = 0; i < 16; i++) {
    const x = rng.pick([-1, 1]) * rng.range(38, 56), z = rng.range(-40, 50);
    flora.tree(rng.chance(0.5) ? 'blossom' : 'broadleaf', x, H(x, z) - 0.1, z, { s: rng.range(0.9, 1.15), variant: i % 3 });
  }
  for (const [cx, cz] of [[-26, -26], [26, -26], [-26, 26], [26, 25]]) {
    for (let i = 0; i < 3; i++) flora.tree('bush', cx + rng.range(-2, 2), 0, cz + rng.range(-2, 2), { s: rng.range(0.8, 1.2), variant: i });
    for (let i = 0; i < 12; i++) flora.flower(cx + rng.range(-4, 4), 0, cz + rng.range(-4, 4), rng.pick([0xffffff, 0xf4d040, 0xe04060, 0xa070e0]));
  }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new Grass(g, { layer: 'grass' });
  zone.root.add(grass.mesh);
  zone.onUpdate((dt, t, focus) => grass.update(focus));

  // ---------- decals
  const dec = new Decals(H);
  dec.add('sunmark', 0, 0, { size: 6.5, rot: 0, alpha: 0.9 });
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-27, 27), z = rng.range(-27, 27);
    if (Math.hypot(x, z) < 4) continue;
    dec.add(rng.pick(['cracks', 'cracks', 'stain', 'rubble', 'pebbles', 'leaves']), x, z, { size: rng.range(1.2, 2.8), alpha: 0.85 });
  }
  dec.add('scorch', 7, -5, { size: 3 }); dec.add('blood', -8, 3, { size: 1.8, alpha: 0.8 });
  dec.add('puddle', -18, 12, { size: 4 }); dec.add('puddle', 21, -6, { size: 3 });
  dec.add('grate', 0, 24.5, { size: 1.4, rot: 0 });
  for (let i = 0; i < 10; i++) dec.add('moss', rng.pick([-1, 1]) * rng.range(26, 29), rng.range(-28, 28), { size: rng.range(1.5, 3) });
  const dm = dec.build(); if (dm) zone.root.add(dm);

  // ---------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const dust = buildParticles('dust', { quality });
  zone.root.add(dust);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); dust.userData.update(focus); });
  zone.onEnv(env => { pool.scale = 0.5 + env.night * 1.2; });

  // ---------- nav
  const nav = new NavGrid(-HALF, -HALF, 2 * HALF, 2 * HALF, 0.5);
  nav.walk(S.rect(0, 0, 2 * HALF - 0.8, 2 * HALF - 0.8));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 18]]);
  zone._nav = nav; zone.nav = nav.toContract();

  // ---------- anchors, regions, env, minimap
  zone.anchor('spawn', 0, 18, 0);
  zone.anchor('boss', 0, -8, Math.PI);
  zone.anchor('npc:trainer', -9, 22, faceTo(-9, 22, 0, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; zone.anchor(`spawn:m${i + 1}`, Math.cos(a) * 12, Math.sin(a) * 12 - 2, faceTo(Math.cos(a) * 12, Math.sin(a) * 12 - 2, 0, 18)); }
  zone.region('Proving Plaza', 0, 0, 30);
  zone.envs = { day: makeEnv('day', { music: 'training', ambience: 'city_quiet' }), dusk: makeEnv('dusk', { music: 'training', ambience: 'city_quiet' }), night: makeEnv('night', { music: 'training', ambience: 'night' }) };
  zone.env = zone.envs.day;
  zone.minimap = paintMinimap(zone, { px: 256, area: { x0: -34, z0: -34, size: 68 }, roofs: [] });
}
