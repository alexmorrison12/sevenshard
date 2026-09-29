// 'foxfire_shrine' — Kurai's moonlit mountain shrine (~60 m). A stone-paved courtyard ringed by stone lanterns and
// autumn maples on a mountain shoulder; an avenue of vermilion gate arches climbs in from the south; a wooden stage
// and the two-tier shrine hall rise to the north against the crags; a moon-viewing pond to the east holds the moon's
// reflection; blue foxfire wisps drift through the courtyard while maple leaves fall.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, faceTo, hipRoof, kitMaterial } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { cliffRing, boulder } from '../cliffs.js';
import { Flora, Grass } from '../foliage.js';
import { buildMoon, buildMoonPond } from '../arenas.js';
import { gateArch, stoneLantern, foxGuardian, shrineHall, stage, paperLanterns } from '../shrine.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, catmull, smoothstep, lerp } from '../../core/noise.js';

const R = 28;
const POND = { x: 19.5, z: 7, r: 5.2 };

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 9);
  const N = new Simplex(29);
  zone.bounds = { x0: -R, z0: -R, x1: R, z1: R };
  const g = zone.ground = new Ground({ x0: -90, z0: -100, w: 180, d: 200, res: 1, layers: ['flagstone', 'gravel', 'moss', 'grass', 'dirt', 'rock', 'cobble'], base: 'grass', seed: 13 });
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z);
    let h = N.noise2(x / 16, z / 16) * 0.25;
    // crags rising behind the shrine (north, east, west); the south falls away down the mountain
    const back = smoothstep(0.35, -0.6, z / (r + 1e-3));
    if (r > R + 1) h += smoothstep(R + 1, R + 6, r) * (2 + back * 6 + N.noise2(x / 10, z / 10) * 1.5);
    if (z > R) h = lerp(h, -(z - R) * 0.75 + N.noise2(x / 8, z / 8) * 0.8, smoothstep(R, R + 4, z) * smoothstep(12, 26, Math.abs(x) + 12));
    // the pond basin
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < POND.r + 1.5) h = lerp(h, -0.9, smoothstep(POND.r + 1.5, POND.r - 0.5, dp));
    return h;
  });

  // ---------------------------------------------------------------- paint
  g.paint('gravel', S.circle(0, 0, R - 2), { soft: 3, noise: 3, nscale: 5 });
  g.paint('flagstone', S.circle(0, -1, 15.5), { soft: 0.4 });
  g.plaza(0, -1, 15.2, { layer: 'flagstone', tile: 2.4, rings: [4.8, 10.2, 15.0], spokes: 9, border: 0.45 });
  g.paint('cobble', S.rect(0, 22, 6.5, 18), { soft: 0.4 });                  // the gate avenue
  g.paint('cobble', S.rect(0, -13.5, 10, 6), { soft: 0.4 });                  // before the stage
  for (let i = 0; i < 16; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(17, R + 1); g.paint(rng.chance(0.5) ? 'moss' : 'grass', S.circle(Math.cos(a) * rr, Math.sin(a) * rr, rng.range(2, 4.5)), { soft: 2.5, noise: 2, nscale: 2.5, amount: 0.9 }); }
  g.paint('grass', S.subtract(S.circle(0, 0, 90), S.circle(0, 0, R - 1)), { soft: 4, noise: 4, nscale: 5 });
  g.paint('rock', S.subtract(S.circle(0, -6, 90), S.circle(0, 0, R + 4)), { soft: 5, noise: 4, nscale: 6, amount: 0.8 });
  g.paint('moss', S.ring(POND.x, POND.z, POND.r + 1.2, 2.4), { soft: 1.2, noise: 1, nscale: 1.5 });
  g.paint('dirt', S.circle(POND.x, POND.z, POND.r + 0.2), { soft: 1 });
  g.info('wear', S.line([[0, 30], [0, -12]], 3), { soft: 2, amount: 0.6 });
  g.info('wet', S.ring(POND.x, POND.z, POND.r + 0.3, 1.2), { soft: 1, amount: 0.8 });

  // ---------------------------------------------------------------- architecture
  const kit = new Kit({ seed: 71 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const hall = shrineHall(kit, flags, 0, 0, -31, { w: 22, d: 11 });
  stage(kit, zone, 0, 0, -13.2, 15, 6, 0.42);
  for (const sx of [-1, 1]) foxGuardian(kit, sx * 5.4, 0, -18.4, sx * 0.35, { s: 1.05 });
  // gate avenue climbing in from the south (the last gates stand below the rim on the mountain stair)
  const gz = [18.0, 21.1, 24.2, 27.3, 30.4, 33.5, 36.6];
  gz.forEach((z, i) => gateArch(kit, 0, H(0, z) - 0.05, z, 0, { w: 4.4, h: 5.1 + (i === 0 ? 0.6 : 0), s: i === 0 ? 1.12 : 1 }));
  for (let i = 0; i < 9; i++) { const z = R + 1 + i * 0.9; kit.add('stone', box(6, 0.5, 1.0, 1), M(0, H(0, z) - 0.2, z), { tint: 0x9a968e, ao: false }); }
  // stone lanterns: along the avenue and around the courtyard
  for (const z of [15.6, 22.6, 28.8]) for (const sx of [-1, 1]) stoneLantern(kit, sx * 4.2, H(sx * 4.2, z), z, { s: 0.85 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 10; const x = Math.cos(a) * 18.2, z = Math.sin(a) * 18.2 - 1; if (z > 12 && Math.abs(x) < 6) continue; if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) continue; stoneLantern(kit, x, H(x, z), z, { s: 1.05 }); }
  // west: a bell pavilion
  { const bx = -19, bz = 6, y = H(bx, bz);
    kit.add('stone', box(4.6, 0.5, 4.6, 1), M(bx, y + 0.25, bz), { tint: 0xa8a49c, yGround: y });
    for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) kit.add('lacquer', cyl(0.16, 0.18, 3.6, 10, 1), M(bx + dx, y + 2.3, bz + dz), { tint: 0xd8452a });
    kit.add('slate', hipRoof(4.4, 4.4, 1.6, 0.9, 2), M(bx, y + 4.1, bz), { tint: 0x3a3e48, ao: false });
    kit.add('metal', new THREE.LatheGeometry([[0.0, 0], [0.55, 0.02], [0.72, 0.4], [0.62, 1.1], [0.42, 1.55], [0.1, 1.7]].map(([r, h]) => new THREE.Vector2(r, h)), 16), M(bx, y + 1.9, bz), { tint: 0x6a5a3a });
    kit.add('timber', box(0.2, 0.2, 2.2, 1), M(bx - 1.2, y + 2.6, bz, 0, 1, 1, 1, 0, 0.05), { ao: false });
    for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) kit.block(S.circle(bx + dx, bz + dz, 0.2), 0.25);
    kit.block(S.circle(bx, bz, 0.8), 0.25);
  }
  // east: the moon-viewing pond with its rocks and a stone lantern at the water's edge
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + rng.range(-0.15, 0.15), rr = POND.r + rng.range(0.3, 0.9); boulder(kit, POND.x + Math.cos(a) * rr, H(POND.x + Math.cos(a) * rr, POND.z + Math.sin(a) * rr), POND.z + Math.sin(a) * rr, { s: rng.range(0.45, 0.9), seed: i + 40, tint: 0xb8b8c4, moss: 0x5a7a34, flat: 0.6 }); }
  stoneLantern(kit, POND.x - 3.6, H(POND.x - 3.6, POND.z - 4.6), POND.z - 4.6, { s: 1.2 });
  kit.block(S.circle(POND.x, POND.z, POND.r + 0.2), 0.25);
  // paper lanterns strung across the stage front and the avenue head
  paperLanterns(kit, [-7.5, 3.6, -10.2], [7.5, 3.6, -10.2], { sag: 0.6, n: 8 });
  kit.light(0, 2.6, -11, 0xffb070, 5, 10, 0.15);
  for (const sx of [-1, 1]) { kit.add('lacquer', cyl(0.1, 0.12, 4.2, 8, 1), M(sx * 7.6, 2.1, -10.2), { tint: 0xd8452a }); kit.block(S.circle(sx * 7.6, -10.2, 0.15), 0.25); }
  // a quiet camp for the hunters by the avenue (south-west): mats, a tea set, a lantern
  { const cx = -8.5, cz = 19.5, y = H(cx, cz);
    kit.add('cloth', box(3.2, 0.05, 2.2, 1), M(cx, y + 0.03, cz, 0.2), { tint: 0xc8342a, ao: false, cast: false });
    kit.add('planks', box(1.2, 0.35, 0.8, 1), M(cx + 0.2, y + 0.2, cz, 0.2), { tint: 0x5a3420 });
    for (let k = 0; k < 3; k++) kit.add('paint', cyl(0.06, 0.05, 0.08, 8, 1), M(cx - 0.1 + k * 0.25, y + 0.42, cz + 0.05, 0), { tint: 0xe8e0d0, ao: false, cast: false });
    stoneLantern(kit, cx - 2.2, y, cz - 1.4, { s: 0.7 });
    kit.block(S.rect(cx + 0.2, cz, 1.2, 0.8, 0.2), 0.25);
  }
  // the crags behind the shrine and around the sides
  const crag = catmull([[-20, 30], [-31, 18], [-34, 0], [-36, -18], [-30, -40], [-12, -46], [12, -46], [30, -40], [36, -18], [34, 0], [31, 18], [20, 30]], 5);
  cliffRing(kit, crag, (x, z) => Math.min(H(x, z), 2), { heightFn: (x, z) => z < -25 ? 16 : 7 + smoothstep(20, -25, z) * 8, thick: 8, seed: 21, tint: 0x6a6c74, strata: 0x4a4c56, top: 0x4a5a2a, inside: [0, -4], closed: false, lean: 0.3, jag: 2.6, step: 1.7 });
  for (let i = 0; i < 20; i++) { const a = rng.range(0, Math.PI * 2), rr = R + rng.range(-0.5, 3); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (z > R - 8 && Math.abs(x) < 9) continue; boulder(kit, x, H(x, z), z, { s: rng.range(0.6, 1.5), seed: rng.int(0, 999), tint: 0xa8aab4, moss: 0x5a6a2a, flat: 0.6 }); }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  await tick();

  // ---------------------------------------------------------------- maples, grass, moon & pond
  const flora = new Flora();
  const treeSpots = [];
  for (let i = 0; i < 22; i++) {
    const a = rng.range(0, Math.PI * 2), rr = rng.range(20.5, R + 5);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr - 1;
    if (z > 10 && Math.abs(x) < 8) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5 || Math.hypot(x + 19, z - 6) < 4.5 || z < -20 && Math.abs(x) < 16) continue;
    if (treeSpots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.5)) continue;
    treeSpots.push([x, z]);
    flora.tree('maple', x, H(x, z) - 0.1, z, { s: rng.range(0.8, 1.1), variant: i % 3, opts: { palette: i % 4 === 3 ? 2 : i % 3 } });
  }
  for (const [x, z] of [[-11, 15.5], [11, 15.5], [-13, -14], [13, -14]]) { flora.tree('maple', x, H(x, z) - 0.1, z, { s: 0.85, variant: 1, opts: { palette: 0 } }); treeSpots.push([x, z]); }
  for (let i = 0; i < 16; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(19, R); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (z > 12 && Math.abs(x) < 7) continue; if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) continue; flora.tree('bush', x, H(x, z), z, { s: rng.range(0.7, 1.0), variant: i % 3, opts: { dark: 0x3a3010, light: 0xc88a30 } }); }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  const grass = new Grass(g, { layer: 'grass', density: quality, tint: [1.2, 0.95, 0.62] });
  zone.root.add(grass.mesh);
  zone.root.add(buildMoon({ x: -40, y: 70, z: -170, r: 24 }));
  zone.root.add(buildMoonPond({ x: POND.x, z: POND.z, r: POND.r, level: -0.35, moon: [-0.12, -0.34], moonR: 0.15 }));

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  for (let i = 0; i < 46; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(2, R); dec.add('leaves', Math.cos(a) * rr, Math.sin(a) * rr - 1, { size: rng.range(1.2, 2.8), alpha: 0.85, tint: 0xff9a70 }); }
  for (const [x, z] of treeSpots) dec.add('leaves', x + rng.range(-1, 1), z + rng.range(-1, 1), { size: rng.range(3, 4.5), alpha: 0.95, tint: 0xffa070 });
  for (let i = 0; i < 12; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(3, 15); dec.add(rng.pick(['cracks', 'stain', 'moss']), Math.cos(a) * rr, Math.sin(a) * rr - 1, { size: rng.range(1.2, 2.5), alpha: 0.6 }); }
  dec.add('runes', 0, -1, { size: 9, rot: 0.3, tint: 0x8a96a8, emit: 0x4a9aff, emitI: 0.22, alpha: 0.32 });   // faint inlay: never reads as a telegraph
  const dm = dec.build(); if (dm) zone.root.add(dm);

  // ---------------------------------------------------------------- foxfire, leaves, light pool
  const wisps = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + rng.range(-0.2, 0.2), rr = rng.range(7, 19);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr - 1, y = H(x, z) + rng.range(1.2, 2.8);
    wisps.push({ x, y, z, size: rng.range(0.34, 0.5), color: rng.chance(0.3) ? 0x9ae8ff : 0x4a9aff, intensity: 2.2, bob: rng.range(0.25, 0.5), orbit: rng.range(0.4, 1.2) });
    if (i % 2 === 0) kit.lights.push({ x, y, z, color: 0x5aa8ff, intensity: 3.5, radius: 7, flicker: 0.15 });
  }
  const flames = buildFlames([...kit.flames, ...wisps]); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const leaves = buildParticles('leaves', { quality, count: 150 });
  const foxfire = buildParticles('foxfire', { quality, count: 110 });
  zone.root.add(leaves, foxfire);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); leaves.userData.update(focus); foxfire.userData.update(focus); grass.update(focus); });
  zone.onEnv(env => { pool.scale = 0.6 + env.night * 0.8; kitMaterial('window').emissiveIntensity = 1.6; });

  // ---------------------------------------------------------------- nav & anchors
  const nav = new NavGrid(-R - 2, -R - 2, 2 * R + 4, 2 * R + 10, 0.5);
  nav.walk(S.circle(0, 0, R - 1.3));
  nav.walk(S.rect(0, R + 1.5, 4.6, 6));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 14]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 12.4, 0);
  zone.anchor('boss', 0, -5, Math.PI);
  zone.anchor('camp', -8.4, 17.4, faceTo(-8.4, 17.4, 0, 0));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Foxfire Shrine', 0, 0, R);
  zone.env = makeEnv('moonlit', { music: 'guardian_fox', ambience: 'shrine_night' });
  zone.envs = { moonlit: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 5, z0: -R - 5, size: 2 * R + 10 }, water: [{ shape: { circle: [POND.x, POND.z, POND.r] }, color: '#1a2a4a' }] });
}
