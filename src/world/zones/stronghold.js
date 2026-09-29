// 'stronghold' — Brightwater Isle, the player's manor island in the Glass Sea. The manor on its rise to the north
// (facing the camera), a flagstone courtyard with a fountain, the Workshop, Research Hall, Crew Barracks, Garden plots
// and Pet Ranch around meadow paths, beaches, the dock where the Dawnrunner moors, a lighthouse on the point.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import * as B from '../buildings.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { Flora, Grass } from '../foliage.js';
import { buildWater, buildPool, buildJets } from '../water.js';
import { boulder } from '../cliffs.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, smoothstep, lerp } from '../../core/noise.js';

const SEA = -1.2;

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 3);
  const nz = new Simplex(77);
  const shoreR = (x, z) => 50 + nz.noise2(Math.atan2(z, x) * 1.2, 1.7) * 7 + nz.noise2(Math.atan2(z, x) * 3.1, 4.2) * 3;
  zone.bounds = { x0: -50, z0: -48, x1: 50, z1: 58 };
  const g = zone.ground = new Ground({ x0: -110, z0: -110, w: 220, d: 230, res: 1, layers: ['grass', 'sand', 'dirt', 'flagstone', 'cobble', 'moss', 'gravel', 'rock'], base: 'grass', seed: 31 });
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z), R = shoreR(x, z);
    let h = 1.2 + nz.noise2(x / 30, z / 30) * 1.2 + nz.noise2(x / 9, z / 9) * 0.25;
    h += smoothstep(0, -40, z) * 3.5;                                  // the manor rise to the north
    h = lerp(h, 4.6, smoothstep(16, 8, Math.hypot(x, (z + 30) * 0.8))); // flat manor terrace
    h = lerp(h, 1.4, smoothstep(12, 6, Math.hypot(x, z - 2)));         // green in the middle
    const beach = smoothstep(R - 10, R, r);
    h = lerp(h, 0.2, beach);
    if (r > R) h = lerp(0.2, -6, smoothstep(R, R + 14, r));
    // the point with the lighthouse (south-east)
    const dp = Math.hypot(x - 38, z - 44);
    h = Math.max(h, lerp(-6, 2.4, smoothstep(12, 4, dp)));
    return h;
  });
  // paint
  g.paint('sand', S.subtract(S.circle(0, 0, 90), S.circle(0, 0, 44)), { soft: 5, noise: 4, nscale: 6 });
  g.paint('dirt', S.line([[0, 52], [0, 30], [0, 6], [0, -20]], 3.5), { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('dirt', S.line([[0, 6], [-28, -2], [-34, -8]], 3), { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('dirt', S.line([[0, 6], [28, -2], [32, -8]], 3), { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('dirt', S.line([[0, 22], [-24, 20], [-30, 24]], 2.8), { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('dirt', S.line([[0, 22], [22, 22], [26, 18]], 2.8), { soft: 1.2, noise: 0.8, nscale: 2 });
  g.paint('flagstone', S.rect(0, -24, 26, 16), { soft: 0.5 });
  g.paint('cobble', S.circle(0, 4, 7.5), { soft: 0.6 });
  g.plaza(0, 4, 7.2, { layer: 'cobble', tile: 2.2, rings: [2.6, 7.0], spokes: 8, border: 0.3 });
  for (const [x, z, w, d] of [[20, 10, 5, 7], [27, 10, 5, 7], [34, 10, 5, 7], [20, 20, 5, 6], [27, 20, 5, 6]]) g.paint('dirt', S.rect(x, z, w, d), { soft: 0.4 });
  g.paint('dirt', S.rect(-30, 30, 20, 13), { soft: 2, noise: 1.5, nscale: 2, amount: 0.55 });
  g.paint('moss', S.rect(-30, 30, 16, 9), { soft: 2, noise: 1.5, nscale: 2, amount: 0.4 });
  g.paint('rock', S.circle(38, 44, 8), { soft: 3, noise: 2, nscale: 2, amount: 0.7 });
  g.paint('gravel', S.circle(0, 50, 5), { soft: 2, noise: 1, nscale: 2 });

  const kit = new Kit({ seed: 17 }), flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const roofs = [B.ROOF.blue, B.ROOF.red, B.ROOF.deepblue];
  // manor: a grand townhouse flanked by two towers, fronting the courtyard
  B.townhouse(kit, 0, H(0, -35), -35, 0, { w: 16, d: 10, floors: 3, roof: B.ROOF.blue, balcony: true, seed: 5, ridge: 'x' });
  for (const s of [-1, 1]) P.tower(kit, s * 10.5, H(s * 10.5, -35), -35, { r: 3, h: 14, roofH: 7, roof: B.ROOF.blue, flags, flag: 0x2a5aa8 });
  for (const s of [-1, 1]) { P.planter(kit, s * 5, H(s * 5, -28), -28, { w: 3, d: 1.2, seed: 40 + s }); P.lampPost(kit, s * 8, H(s * 8, -22), -22, 0); P.statue(kit, s * 11, H(s * 11, -24), -24, 0, { pose: s > 0 ? 'sword' : 'shield' }); }
  const fw = P.fountain(kit, 0, H(0, -21), -21, { r: 3.4, tiers: 2 });
  // workshop (west), research hall (east), barracks (south-west), garden (south-east), pet ranch (west-south)
  B.forge(kit, -32, H(-32, -14), -14, 0);
  B.bank(kit, flags, 32, H(32, -16), -16, 0);
  B.townhouse(kit, -30, H(-30, 12), 12, 0, { w: 14, d: 7, floors: 2, roof: B.ROOF.red, seed: 7, timber: true, ridge: 'x' });
  P.weaponRack(kit, -34, H(-34, 17.6), 17.6, 0); P.dummy(kit, -26, H(-26, 18.5), 18.5, 0); P.dummy(kit, -23, H(-23, 18.5), 18.5, 0);
  P.fenceLine(kit, [[17, 5.5], [37.5, 5.5], [37.5, 24], [17, 24], [17, 16]], H);
  for (let i = 0; i < 5; i++) P.hay(kit, 35 - i * 0.3, H(35, 25.5), 25.5 + (i % 2) * 0.2, 0.7, 0.1);
  P.fenceLine(kit, [[-40, 24], [-40, 36.5], [-20, 36.5], [-20, 24], [-26, 24]], H);
  P.hay(kit, -37, H(-37, 34), 34, 1, 0.2); P.barrel(kit, -22, H(-22, 34.5), 34.5, 1);
  B.townhouse(kit, -32, H(-32, 30), 30, 0, { w: 6, d: 4.5, floors: 1, roof: B.ROOF.red, seed: 9, noDoor: true, chimney: false, pitch: 0.4 });
  // dock + the Dawnrunner, lighthouse
  const dockZ = shoreR(0, 1) - 6;
  B.pier(kit, 0, dockZ, Math.PI, 22, 4.4, SEA + 1.35);
  zone.deck(S.rect(0, dockZ + 11, 4.4, 22.4), SEA + 1.46);
  B.ship(kit, flags, 6.6, SEA - 0.5, dockZ + 13, Math.PI, { len: 22, beam: 6.2, masts: 2, stripe: 0x2a5aa8, seed: 11 });
  B.lighthouse(kit, flags, 38, H(38, 44), 44);
  P.crateStack(kit, -3.4, H(-3.4, dockZ - 3), dockZ - 3, 0.2, 4); P.ropeCoil(kit, 2.6, H(2.6, dockZ - 2), dockZ - 2, 1); P.lampPost(kit, 3.2, H(3.2, dockZ - 4.5), dockZ - 4.5, 0);
  // benches around the green, crates/barrels by the workshop, rocks on the shore
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; P.bench(kit, Math.cos(a) * 9.4, H(Math.cos(a) * 9.4, 4 + Math.sin(a) * 9.4), 4 + Math.sin(a) * 9.4, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI); }
  P.crateStack(kit, -24, H(-24, -9), -9, 0.3, 5); P.logPile(kit, -40, H(-40, -8), -8, Math.PI / 2, { n: 3 });
  for (let i = 0; i < 26; i++) { const a = rng.range(0, Math.PI * 2), R = shoreR(Math.cos(a), Math.sin(a)) + rng.range(-3, 3); const x = Math.cos(a) * R, z = Math.sin(a) * R; if (Math.abs(x) < 8 && z > 30) continue; boulder(kit, x, H(x, z), z, { s: rng.range(0.6, 1.8), seed: i, tint: 0x8a8278, moss: 0x5a7a34 }); }
  kit.block(S.rect(-32, 30, 6, 4.5), 0.2);
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  // foliage
  const flora = new Flora();
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(14, 44), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z - 4) < 11 || Math.abs(x) < 4 || (x > 15 && x < 39 && z > 4 && z < 26) || (x < -18 && x > -42 && z > 22 && z < 38) || Math.hypot(x, z + 30) < 16) continue;
    if (Math.hypot(x - 32, z + 16) < 11 || Math.hypot(x + 32, z + 14) < 10 || Math.hypot(x + 30, z - 12) < 10 || r > shoreR(x, z) - 8) continue;
    flora.tree(rng.chance(0.25) ? 'blossom' : rng.chance(0.25) ? 'cypress' : 'broadleaf', x, H(x, z) - 0.1, z, { s: rng.range(0.85, 1.2), variant: i % 3 });
  }
  for (let i = 0; i < 40; i++) { const x = rng.range(-40, 40), z = rng.range(-40, 40); if (Math.hypot(x, z - 4) < 9 || Math.abs(x) < 3) continue; flora.tree('bush', x, H(x, z), z, { s: rng.range(0.7, 1.1), variant: i % 3 }); }
  for (let i = 0; i < 200; i++) { const x = rng.range(-40, 40), z = rng.range(-30, 40); if (g.weight('grass', x, z) > 0.8) flora.flower(x, H(x, z), z, rng.pick([0xffffff, 0xf4d040, 0xe04060, 0xa070e0, 0xff8ab0])); }
  for (const [x, z] of [[20, 10], [27, 10], [34, 10], [20, 20], [27, 20]]) for (let i = 0; i < 14; i++) flora.flower(x + rng.range(-2, 2), H(x, z), z + rng.range(-3, 3), rng.pick([0x60b030, 0xe06030, 0xf0c030]), { s: 1.3 });
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new Grass(g, { layer: 'grass', density: quality });
  zone.root.add(grass.mesh);
  // water: the sea + fountain
  const sea = buildWater(g, { x: 0, z: 0, w: 340, d: 340, level: SEA, swell: 0.06 });
  zone.root.add(sea);
  const pools = fw.map(w => buildPool({ x: w.x, z: w.z, r: w.r, y: w.y - 0.1 }));
  for (const p of pools) zone.root.add(p);
  zone.root.add(buildJets(Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return { from: [Math.cos(a) * 1.2, H(0, -21) + 2.4, -21 + Math.sin(a) * 1.2], to: [Math.cos(a) * 2.6, H(0, -21) + 0.6, -21 + Math.sin(a) * 2.6], h: 0.6, w: 0.07 }; })));
  const dec = new Decals(H);
  for (let i = 0; i < 20; i++) dec.add(rng.pick(['leaves', 'petals', 'pebbles']), rng.range(-36, 36), rng.range(-26, 40), { size: rng.range(1.2, 2.4), alpha: 0.7 });
  dec.add('sunmark', 0, 4, { size: 3.2, rot: 0 });
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const motes = buildParticles('fireflies', { quality });
  zone.root.add(motes);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); grass.update(focus); motes.userData.update(focus); });
  zone.onEnv(env => { pool.scale = 0.5 + env.night * 1.5; motes.visible = env.night > 0.3; sea.userData.setEnv(env); for (const p of pools) p.userData.setEnv(env); });
  // nav
  const nav = new NavGrid(-56, -56, 112, 124, 0.5);
  nav.walk(S.poly(Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2, R = shoreR(Math.cos(a), Math.sin(a)) - 2.5; return [Math.cos(a) * R, Math.sin(a) * R]; })));
  nav.walk(S.rect(0, dockZ + 11, 3.4, 22));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 20]]);
  zone._nav = nav; zone.nav = nav.toContract();
  const A = (n, x, z, f) => zone.anchor(n, x, z, f);
  A('spawn', 0, 16, 0);
  A('dock:ship', 0, dockZ + 19, Math.PI);
  A('building:manor', 0, -27.5, Math.PI); A('building:workshop', -32, -8.6, Math.PI); A('building:research', 32, -6.2, Math.PI);
  A('building:barracks', -30, 17.2, Math.PI); A('building:garden', 27, 4, 0); A('building:ranch', -30, 22.4, 0);
  A('npc:steward', 3, -25, faceTo(3, -25, 0, 0)); A('npc:shipwright', -2.5, dockZ + 1, Math.PI);
  [[6, 8], [-6, 8], [9, 1], [-9, 1], [0, -12], [14, -20], [-14, -20]].forEach(([x, z], i) => A(`idle:isle${i + 1}`, x, z, faceTo(x, z, 0, 4)));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 6); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Brightwater Isle', 0, 0, 44);
  zone.region('Manor', 0, -28, 12);
  zone.envs = { day: makeEnv('day', { music: 'stronghold', ambience: 'seaside' }), dusk: makeEnv('dusk', { music: 'stronghold', ambience: 'seaside' }), night: makeEnv('night', { music: 'stronghold_night', ambience: 'seaside_night' }) };
  zone.env = zone.envs.day;
  const roofsM = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: '#' + new THREE.Color(r.color).getHexString() }));
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -60, z0: -60, size: 124 }, roofs: roofsM });
}
