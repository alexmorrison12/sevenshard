// Legion raid arenas of Gorrath, the Horned Tyrant.
//   throne_of_horns — a demonic colosseum ~56 m across: blood-stone floor carved into eight wedges, eight horned
//                     pillars with braziers, tiered stands and the Horned Throne to the north, a spiked low wall, the
//                     entrance gate and a lava moat to the south (the camera's side), chains, banners, embers.
//   kennels        — Gate 1 (the twin hounds Skarn & Vesk): a 48 m walled pit with iron cages, kennel gates, bone
//                     heaps, straw, chain stakes and blood.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, cone, sphere, faceTo, walls } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { spike, boulder, cliffRing } from '../cliffs.js';
import { buildLava } from '../water.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, smoothstep, lerp } from '../../core/noise.js';
import { tube, blob } from '../../engine/geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** flat ring sector (XZ plane, facing up) with metre UVs */
function annulus(r0, r1, a0, a1, seg = 48, tile = 2) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * i / seg, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1);
    uv.push(a * r0 / tile, 0, a * r1 / tile, (r1 - r0) / tile);
  }
  for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** inward-facing curved wall (riser) of radius r, height h, between angles a0..a1 */
function riser(r, h, a0, a1, seg = 48, tile = 2) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true, Math.PI / 2 - a1, a1 - a0);
  // CylinderGeometry measures theta from +Z toward +X; our angle a is atan2(z, x). Flip to face inward.
  g.scale(-1, 1, 1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * (a1 - a0) / tile, uv.getY(i) * h / tile);
  g.computeVertexNormals();
  return g;
}

function hornedPillar(kit, flags, x, y, z, { h = 9, banner = 0x8a1a1a } = {}) {
  kit.add('dark', box(2.8, 1.2, 2.8, 1), M(x, y + 0.6, z), { tint: 0x7a6060, yGround: y });
  kit.add('dark', cyl(0.95, 1.3, h, 8, 2), M(x, y + 1.2 + h / 2, z, Math.PI / 8), { tint: 0x8a7070, yGround: y + 1, aoH: 4 });
  kit.add('dark', box(2.4, 0.7, 2.4, 1), M(x, y + h + 1.4, z), { tint: 0x6a5050 });
  for (const s of [-1, 1]) {
    const ang = Math.atan2(z, x) + Math.PI / 2;
    const dx = Math.cos(ang) * s, dz = Math.sin(ang) * s;
    kit.add('bone', tube([V(x + dx * 0.9, y + h + 1.5, z + dz * 0.9), V(x + dx * 2.4, y + h + 2.6, z + dz * 2.4), V(x + dx * 3.0, y + h + 4.6, z + dz * 3.0), V(x + dx * 2.3, y + h + 6.2, z + dz * 2.3)], [0.55, 0.45, 0.28, 0.04], 8, true), null, { tint: 0xe0d4c0, chunkAt: [x, z] });
  }
  P.brazier(kit, x, y + h + 1.75, z, { s: 1.1, base: 'dark', color: 0xff7a20, glow: 0xff5a18 });
  kit.colliders.pop();                                     // the brazier sits on top: only the pillar blocks
  kit.block(S.rect(x, z, 2.9, 2.9), 0.3);
  // runes glowing down the shaft
  for (let k = 0; k < 3; k++) { const ang = Math.atan2(-z, -x); kit.glow(box(0.16, 0.9, 0.1, 1), M(x + Math.cos(ang) * 1.05, y + 3 + k * 2.2, z + Math.sin(ang) * 1.05, -ang + Math.PI / 2), 0xff4a20, 3); }
  if (flags) { const ang = Math.atan2(-z, -x); flags.add(M(x + Math.cos(ang) * 1.45, y + h + 0.6, z + Math.sin(ang) * 1.45, -ang + Math.PI / 2), 1.6, 5.2, banner, { hang: 'top', trim: 0xc8a040 }); }
}

function arena(zone, o) {
  const rng = new RNG(o.seed ?? 13);
  const R = o.r;                                          // walkable radius
  zone.bounds = { x0: -R - 2, z0: -R - 2, x1: R + 2, z1: R + 2 };
  const g = zone.ground = new Ground({ x0: -95, z0: -110, w: 190, d: 200, res: 1, layers: ['bloodstone', 'sand', 'obsidian', 'gravel', 'dirt', 'rock'], base: 'obsidian', seed: o.seed ?? 13 });
  g.tint.setRGB(0.9, 0.84, 0.82);
  g.emitColor.setRGB(1.8, 0.45, 0.12);
  const N = g.noise;
  const moatR0 = R + 6, moatR1 = R + 13;
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z);
    let h = N.noise2(x / 10, z / 10) * 0.12;
    if (r > R + 1) h = 0.6;                                // the wall ring / stands base
    if (z > 0 && r > moatR0 && r < moatR1) h = -3.2;      // lava moat on the south
    if (z > 0 && r >= moatR1) h = 0.2 + N.noise2(x / 12, z / 12) * 0.8;
    if (z <= 0 && r > R + 1) h = 0.6 + smoothstep(R + 2, R + 20, r) * 10;  // stands rise to the north
    // gate causeway across the moat
    if (z > R && Math.abs(x) < 4.5) h = Math.max(h, 0.2);
    return h;
  });
  return { g, rng, R, moatR0, moatR1 };
}

async function finish(zone, g, kit, flags, dec, { R, quality, particles = 'embers', extraNav = null, spawn = [0, R - 5] }) {
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 2, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const emb = buildParticles(particles, { quality, count: 220 });
  const ash = buildParticles('ash', { quality, count: 180, color: [0.22, 0.18, 0.18] });
  zone.root.add(emb, ash);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); emb.userData.update(focus); ash.userData.update(focus); if (g.uniforms) g.uniforms.uEmitPulse.value = 0.8 + 0.2 * Math.sin(t * 1.1); });
  const nav = new NavGrid(-R - 8, -R - 8, 2 * R + 16, 2 * R + 20, 0.5);
  nav.walk(S.circle(0, 0, R - 0.4));
  if (extraNav) extraNav(nav);
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([spawn]);
  zone._nav = nav; zone.nav = nav.toContract();
  return nav;
}

// ------------------------------------------------------------------ Throne of Horns
export async function buildThrone(zone, { quality = 1 } = {}) {
  const { g, rng, R, moatR0, moatR1 } = arena(zone, { r: 28, seed: 13 });
  // floor: sand ring, blood-stone wedges carved for the eight-way rift, obsidian at the wall foot
  g.paint('sand', S.circle(0, 0, R + 0.5), { soft: 1 });
  g.paint('bloodstone', S.circle(0, 0, 19.5), { soft: 0.5 });
  g.plaza(0, 0, 19.2, { layer: 'bloodstone', tile: 3.4, rings: [5.2, 12.4, 19.0], spokes: 8, border: 0.6 });
  for (let i = 0; i < 10; i++) g.paint('dirt', S.circle(rng.range(-24, 24), rng.range(-24, 24), rng.range(1.5, 3.5)), { soft: 2, noise: 1.5, nscale: 2, amount: 0.6 });
  g.paint('obsidian', S.ring(0, 0, R + 1.2, 3), { soft: 1.2, noise: 1, nscale: 2 });
  g.paint('rock', S.subtract(S.circle(0, 0, 90), S.circle(0, 0, R + 3)), { soft: 3, noise: 3, nscale: 5, amount: 0.8 });
  g.info('ao', S.ring(0, 0, R + 0.6, 3), { soft: 2, amount: 0.35 });
  g.info('wet', S.circle(0, 0, 19), { soft: 3, noise: 2, nscale: 4, amount: 0.25 });

  const kit = new Kit({ seed: 71 }), flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  // --- the arena wall: tall on the north half, a low spiked parapet on the south
  const WR = R + 1.1;
  kit.add('dark', riser(WR, 4.2, -Math.PI, 0, 64), M(0, 0.6 + 2.1 - 0.6, 0), { tint: 0x6a5454, yGround: 0, aoH: 2 });
  kit.add('dark', annulus(WR, WR + 1.6, -Math.PI, 0, 64), M(0, 4.2 + 0.05, 0), { tint: 0x5a4444, ao: false });
  kit.add('dark', riser(WR, 1.6, 0, Math.PI, 64), M(0, 0.2, 0), { tint: 0x6a5454, yGround: 0, aoH: 1 });
  kit.add('dark', annulus(WR, WR + 1.2, 0, Math.PI, 64), M(0, 1.02, 0), { tint: 0x5a4444, ao: false });
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI + 0.06, x = Math.cos(a) * (WR + 0.5), z = Math.sin(a) * (WR + 0.5);
    if (Math.abs(x) < 5.5) continue;
    spike(kit, x, 1.0, z, { h: rng.range(1.4, 2.4), r: 0.18, bend: 0.5, dir: a, mat: 'dark', block: false });
  }
  kit.block(S.subtract(S.ring(0, 0, WR + 0.6, 1.6), S.rect(0, WR, 8.5, 4)), 0.3);
  // --- tiered stands behind the north wall
  for (let k = 0; k < 6; k++) {
    const r0 = WR + 1.6 + k * 2.6, hh = 4.2 + k * 1.6;
    kit.add('stone', riser(r0, 1.6, -Math.PI + 0.02, -0.02, 64), M(0, hh + 0.8 - 0.05, 0), { tint: 0x7a5c54, ao: false });
    kit.add('stone', annulus(r0, r0 + 2.6, -Math.PI + 0.02, -0.02, 64), M(0, hh + 1.6, 0), { tint: 0x6a4e48, ao: false });
  }
  kit.add('dark', riser(WR + 1.6 + 6 * 2.6, 8, -Math.PI + 0.02, -0.02, 64), M(0, 4.2 + 6 * 1.6 + 5.5, 0), { tint: 0x5a4444 });
  // stand braziers, banners along the top
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i + 0.5) / 9 * Math.PI, r = WR + 1.6 + 6 * 2.6 - 1.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 4.2 + 5 * 1.6 + 1.6;
    if (i === 4) continue;
    P.brazier(kit, x, y, z, { s: 1.2, base: 'dark', color: 0xff7a20, glow: 0xff5a18 }); kit.colliders.pop();
    flags.add(M(x + Math.cos(a) * 1.4, y + 9.5, z + Math.sin(a) * 1.4, -a - Math.PI / 2), 2.2, 7, i % 2 ? 0x8a1414 : 0x2a1010, { hang: 'top', trim: 0xc8a040 });
    kit.add('dark', cyl(0.12, 0.16, 10, 6, 1), M(x + Math.cos(a) * 1.6, y + 5, z + Math.sin(a) * 1.6), { tint: 0x3a2a2a, ao: false });
  }
  // --- the Horned Throne (north, above the stands' centre)
  const TZ = -(WR + 5);
  const ty = 4.2;
  for (let k = 0; k < 4; k++) kit.add('dark', box(16 - k * 2.6, 1.2, 9 - k * 1.2, 2), M(0, ty + 0.6 + k * 1.2, TZ - k * 0.4), { tint: 0x6a4e4e });
  kit.add('dark', box(9, 16, 3, 2), M(0, ty + 12.8, TZ - 4.2), { tint: 0x5a4040 });
  kit.add('dark', box(4.4, 1.8, 4.2, 1), M(0, ty + 6.3, TZ - 1.6), { tint: 0x6a5050 });
  for (const s of [-1, 1]) {
    kit.add('dark', box(1.4, 3.2, 4.4, 1), M(s * 3, ty + 6.8, TZ - 1.4), { tint: 0x6a5050 });
    kit.add('bone', tube([V(s * 4.2, ty + 18, TZ - 4.2), V(s * 9, ty + 21, TZ - 4.6), V(s * 12, ty + 26, TZ - 4.4), V(s * 10.5, ty + 31, TZ - 3.4), V(s * 7.5, ty + 33, TZ - 2.2)], [1.4, 1.2, 0.9, 0.5, 0.05], 10, true), null, { tint: 0xe4d8c4, chunkAt: [0, TZ] });
    kit.add('bone', tube([V(s * 4.5, ty + 12, TZ - 3.2), V(s * 8.5, ty + 12.5, TZ - 2.2), V(s * 10.5, ty + 15.5, TZ - 1.6)], [0.8, 0.6, 0.05], 8, true), null, { tint: 0xe4d8c4, chunkAt: [0, TZ] });
    P.brazier(kit, s * 9.5, ty + 1.2, TZ + 2, { s: 1.6, base: 'dark', color: 0xff7a20, glow: 0xff5a18 }); kit.colliders.pop();
  }
  // horned skull emblem on the throne back
  kit.add('bone', sphere(2.1, 14, 10), M(0, ty + 17.5, TZ - 2.6, 0, 1, 1.15, 0.6), { tint: 0xe8dcc8 });
  for (const s of [-1, 1]) kit.glow(sphere(0.35, 8, 6), M(s * 0.75, ty + 17.8, TZ - 1.4), 0xff3010, 5);
  kit.light(0, ty + 16, TZ, 0xff4a20, 12, 26, 0.1);
  // --- eight horned pillars (pillar:1..8), chains between neighbours
  const PR = 21.5, pillars = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i / 8 * TAU + TAU / 16;
    const x = Math.cos(a) * PR, z = Math.sin(a) * PR;
    pillars.push([x, z]);
    hornedPillar(kit, flags, x, H(x, z), z, { h: 8.5, banner: i % 2 ? 0x8a1414 : 0x2a1010 });
  }
  for (let i = 0; i < 8; i++) {
    const [ax, az] = pillars[i], [bx, bz] = pillars[(i + 1) % 8];
    const n = 24;
    for (let k = 1; k < n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = 9.6 - Math.sin(t * Math.PI) * 3.2;
      kit.add('metal', new THREE.TorusGeometry(0.22, 0.07, 4, 8), M(x, y, z, Math.atan2(-(bz - az), bx - ax), 1.3, 1, 1, 0, k % 2 ? Math.PI / 2 : 0), { tint: 0x2e2626, ao: false, cast: false, chunkAt: [x, z] });
    }
  }
  // --- entrance gate (south) with a raised spiked portcullis, causeway over the lava moat
  const GZ = WR + 0.6;
  for (const s of [-1, 1]) {
    kit.add('dark', box(3.2, 9, 3.2, 2), M(s * 5.6, 4.5, GZ), { tint: 0x6a5050, yGround: 0 });
    spike(kit, s * 5.6, 9, GZ, { h: 4.5, r: 0.7, bend: 1.4, dir: s > 0 ? 0 : Math.PI, mat: 'bone', tint: 0xe0d4c0, block: false });
    kit.block(S.rect(s * 5.6, GZ, 3.3, 3.3), 0.3);
    P.brazier(kit, s * 7.8, 0.6, GZ + 4, { s: 1, base: 'dark' });
  }
  kit.add('dark', box(14.4, 2.2, 3.4, 2), M(0, 9.8, GZ), { tint: 0x5a4444 });
  for (let i = 0; i < 9; i++) { kit.add('metal', box(0.14, 1.6, 0.14, 1), M(-3.2 + i * 0.8, 8.2, GZ + 0.4), { tint: 0x2a2424, ao: false }); kit.add('metal', cone(0.12, 0.4, 4, 1), M(-3.2 + i * 0.8, 7.2, GZ + 0.4, 0, 1, 1, 1, Math.PI), { tint: 0x2a2424, ao: false }); }
  kit.add('dark', box(8, 0.5, moatR1 - moatR0 + 6, 2), M(0, 0.0, (moatR0 + moatR1) / 2 + 1), { tint: 0x5a4848 });
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) kit.add('dark', box(0.5, 1.0, 0.5, 1), M(s * 3.8, 0.7, moatR0 - 1 + k * 2.2), { tint: 0x5a4848, ao: false });
  // lava moat (south) + scattered bones & weapons in the sand
  zone.root.add(buildLava({ x: 0, z: moatR0 + 18, w: 150, d: 50, level: -0.9 }));
  for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), r = rng.range(6, R - 2); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (pillars.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue; kit.add('bone', blob(rng.range(0.15, 0.3), 0, null, [2.2, 0.5, 0.6]), M(x, H(x, z) + 0.08, z, rng.range(0, 6)), { tint: 0xd8ccb8, ao: false, cast: false }); }
  for (let i = 0; i < 7; i++) { const a = rng.range(0, TAU), r = rng.range(8, R - 3); const x = Math.cos(a) * r, z = Math.sin(a) * r; kit.add('metal', box(0.09, 1.5, 0.03, 1), M(x, H(x, z) + 0.5, z, rng.range(0, 6), 1, 1, 1, rng.range(-0.5, 0.5), rng.range(0.3, 0.8)), { tint: 0x8a8a94, ao: false }); }
  // outer crags beyond the stands
  cliffRing(kit, Array.from({ length: 24 }, (_, i) => { const a = -Math.PI * 1.08 + i / 23 * Math.PI * 1.16; return [Math.cos(a) * 64, Math.sin(a) * 60]; }), H, { height: 26, thick: 12, seed: 3, tint: 0x4a3434, strata: 0x2e2020, inside: [0, 0], closed: false, lean: 0.25, jag: 4 });

  const dec = new Decals(H);
  for (let i = 0; i < 20; i++) { const a = rng.range(0, TAU), r = rng.range(2, R - 1.5); dec.add('blood', Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(1.4, 3.4), alpha: 0.8 }); }
  for (let i = 0; i < 14; i++) { const a = rng.range(0, TAU), r = rng.range(2, R - 1.5); dec.add(rng.pick(['scorch', 'cracks', 'rubble']), Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(1.5, 3.5), alpha: 0.8 }); }
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i / 8 * TAU; dec.add('fissure', Math.cos(a) * 11, Math.sin(a) * 11, { size: 8, sz: 0.35, rot: -a, tint: 0xff7a30, emit: 0xff4a10, emitI: 0.9, alpha: 0.8 }); }
  dec.add('runes', 0, 0, { size: 9.5, rot: 0.2, tint: 0xc07060, emit: 0xff3a10, emitI: 0.6, alpha: 0.7 });
  const nav = await finish(zone, g, kit, flags, dec, { R, quality, extraNav: nv => nv.walk(S.rect(0, R + 1, 6.5, 4)), spawn: [0, R - 5] });

  zone.anchor('spawn', 0, R - 4.5, 0);
  zone.anchor('boss', 0, -8, Math.PI);
  zone.anchor('throne', 0, TZ + 1, Math.PI, { y: ty + 6 });
  pillars.forEach(([x, z], i) => { const L = Math.hypot(x, z); const ax = x - x / L * 2.4, az = z - z / L * 2.4; const p = nav.walkable(ax, az) ? [ax, az] : nav.nearest(ax, az, 4) || [ax, az]; zone.anchor(`pillar:${i + 1}`, p[0], p[1], faceTo(p[0], p[1], 0, 0)); });
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i / 8 * TAU; zone.anchor(`wedge:${i + 1}`, Math.cos(a) * 11, Math.sin(a) * 11, faceTo(Math.cos(a) * 11, Math.sin(a) * 11, 0, 0)); }
  zone.region('Throne of Horns', 0, 0, R);
  zone.env = makeEnv('blood', { music: 'legion_gorrath', ambience: 'arena' });
  zone.envs = { blood: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 6, z0: -R - 6, size: 2 * R + 12 } });
}

// ------------------------------------------------------------------ The Kennels (Gate 1)
export async function buildKennels(zone, { quality = 1 } = {}) {
  const { g, rng, R, moatR0, moatR1 } = arena(zone, { r: 23, seed: 29 });
  g.paint('dirt', S.circle(0, 0, R + 0.5), { soft: 1 });
  g.paint('sand', S.circle(0, 0, R - 4), { soft: 3, noise: 3, nscale: 3, amount: 0.7 });
  g.paint('bloodstone', S.circle(0, -2, 8.5), { soft: 0.5 });
  g.plaza(0, -2, 8.2, { layer: 'bloodstone', tile: 3, rings: [3.2, 8.0], spokes: 6, border: 0.4 });
  for (let i = 0; i < 16; i++) g.paint('gravel', S.circle(rng.range(-20, 20), rng.range(-20, 20), rng.range(1.2, 3)), { soft: 2, noise: 1.2, nscale: 1.6, amount: 0.7 });
  g.paint('obsidian', S.ring(0, 0, R + 1.2, 3), { soft: 1.2, noise: 1, nscale: 2 });
  g.paint('rock', S.subtract(S.circle(0, 0, 90), S.circle(0, 0, R + 3)), { soft: 3, noise: 3, nscale: 5, amount: 0.8 });
  g.info('ao', S.ring(0, 0, R + 0.6, 3), { soft: 2, amount: 0.4 });
  const kit = new Kit({ seed: 91 }), flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const WR = R + 1.1;
  // high pit wall on the north half with kennel gates, low wall south
  kit.add('dark', riser(WR, 6.5, -Math.PI, 0, 56), M(0, 0.6 + 3.25 - 0.6, 0), { tint: 0x6a5454, yGround: 0, aoH: 2.5 });
  kit.add('dark', annulus(WR, WR + 2.2, -Math.PI, 0, 56), M(0, 6.5 + 0.05, 0), { tint: 0x5a4444, ao: false });
  kit.add('dark', riser(WR, 1.6, 0, Math.PI, 56), M(0, 0.2, 0), { tint: 0x6a5454, yGround: 0, aoH: 1 });
  kit.add('dark', annulus(WR, WR + 1.2, 0, Math.PI, 56), M(0, 1.02, 0), { tint: 0x5a4444, ao: false });
  kit.block(S.subtract(S.ring(0, 0, WR + 0.6, 1.6), S.rect(0, WR, 7, 4)), 0.3);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI + (i + 0.5) / 5 * Math.PI, x = Math.cos(a) * (WR - 0.05), z = Math.sin(a) * (WR - 0.05);
    const rot = Math.atan2(-Math.cos(a), -Math.sin(a));
    // arched kennel gate: dark opening, iron bars, skull keystone, torches either side
    kit.add('dark', box(3.2, 3.6, 0.3, 1), M(x, 1.8, z, rot), { tint: 0x100a0a, ao: false });
    for (let k = 0; k < 6; k++) kit.add('metal', box(0.1, 3.4, 0.1, 1), M(x + Math.cos(rot) * (-1.25 + k * 0.5), 1.8, z - Math.sin(rot) * (-1.25 + k * 0.5), rot), { tint: 0x2a2424, ao: false });
    kit.add('bone', sphere(0.45, 10, 8), M(x - Math.sin(rot) * -0.1, 4.2, z - Math.cos(rot) * -0.1, rot, 1, 1.1, 0.7), { tint: 0xe0d4c0 });
    for (const s of [-1, 1]) P.wallTorch(kit, x + Math.cos(rot) * s * 2.3, 2.8, z - Math.sin(rot) * s * 2.3, rot);
  }
  // iron cages, bone heaps, chain stakes, straw
  const cage = (x, z, rot, s = 1) => {
    const y = H(x, z);
    kit.add('dark', box(2.2 * s, 0.25, 2.2 * s, 1), M(x, y + 0.12, z, rot), { tint: 0x4a3a3a });
    kit.add('dark', box(2.2 * s, 0.2, 2.2 * s, 1), M(x, y + 2.3 * s, z, rot), { tint: 0x4a3a3a });
    for (let k = 0; k < 16; k++) { const side = Math.floor(k / 4), u = (k % 4) / 4 * 2.2 * s - 1.1 * s; const lx = side === 0 ? u : side === 1 ? 1.1 * s : side === 2 ? -u : -1.1 * s, lz = side === 0 ? -1.1 * s : side === 1 ? u : side === 2 ? 1.1 * s : -u; kit.add('metal', box(0.07, 2.2 * s, 0.07, 1), M(x + lx * Math.cos(rot) + lz * Math.sin(rot), y + 1.2 * s, z - lx * Math.sin(rot) + lz * Math.cos(rot)), { tint: 0x2e2828, ao: false }); }
    kit.block(S.rect(x, z, 2.3 * s, 2.3 * s, rot), 0.3);
  };
  for (const [x, z, r] of [[-16, -9, 0.3], [15, -11, -0.4], [-18, 7, 0.9], [17.5, 6, -0.2]]) cage(x, z, r, rng.range(0.9, 1.15));
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, TAU), r = rng.range(9, R - 3), x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let k = 0; k < 9; k++) kit.add('bone', blob(rng.range(0.12, 0.28), 0, null, [2.4, 0.5, 0.6]), M(x + rng.range(-0.9, 0.9), H(x, z) + 0.1 + k * 0.03, z + rng.range(-0.9, 0.9), rng.range(0, 6), 1, 1, 1, rng.range(-0.3, 0.3)), { tint: 0xd8ccb8, ao: false, cast: false });
    kit.add('bone', sphere(0.3, 8, 6), M(x, H(x, z) + 0.3, z, rng.range(0, 6), 1, 0.9, 1.2), { tint: 0xe0d4c0 });
  }
  for (const [x, z] of [[-6, -2], [6, -2]]) {
    const y = H(x, z);
    kit.add('metal', cyl(0.18, 0.3, 1.2, 6, 1), M(x, y + 0.4, z), { tint: 0x3a3232 });
    kit.add('metal', new THREE.TorusGeometry(0.3, 0.07, 5, 10), M(x, y + 1.0, z, 0, 1, 1, 1, Math.PI / 2), { tint: 0x3a3232, ao: false });
    for (let k = 0; k < 10; k++) { const t = k / 10, a = x < 0 ? Math.PI * 0.8 : Math.PI * 0.2; kit.add('metal', new THREE.TorusGeometry(0.2, 0.06, 4, 8), M(x + Math.cos(a) * t * 5, y + 0.08, z + Math.sin(a) * t * 5 - t * 2, a, 1.3, 1, 1, Math.PI / 2 * (k % 2), 0), { tint: 0x3a3232, ao: false, cast: false }); }
    kit.block(S.circle(x, z, 0.4), 0.3);
  }
  for (let i = 0; i < 6; i++) { const a = rng.range(Math.PI * 1.05, Math.PI * 1.95), x = Math.cos(a) * (R - 1.8), z = Math.sin(a) * (R - 1.8); P.hay(kit, x, H(x, z), z, rng.range(0.8, 1.1), rng.range(0, 3)); }
  // gate + causeway south, lava beyond
  const GZ = WR + 0.6;
  for (const s of [-1, 1]) { kit.add('dark', box(2.6, 7, 2.6, 2), M(s * 4.8, 3.5, GZ), { tint: 0x6a5050, yGround: 0 }); spike(kit, s * 4.8, 7, GZ, { h: 3.2, r: 0.55, bend: 1.2, dir: s > 0 ? 0 : Math.PI, mat: 'bone', tint: 0xe0d4c0, block: false }); kit.block(S.rect(s * 4.8, GZ, 2.7, 2.7), 0.3); }
  kit.add('dark', box(12, 1.6, 2.8, 2), M(0, 7.6, GZ), { tint: 0x5a4444 });
  kit.add('dark', box(7, 0.5, moatR1 - moatR0 + 6, 2), M(0, 0.0, (moatR0 + moatR1) / 2 + 1), { tint: 0x5a4848 });
  zone.root.add(buildLava({ x: 0, z: moatR0 + 18, w: 140, d: 50, level: -0.9 }));
  // stands (three tiers) and crags to the north
  for (let k = 0; k < 3; k++) {
    const r0 = WR + 2.2 + k * 2.6, hh = 6.5 + k * 1.6;
    kit.add('stone', riser(r0, 1.6, -Math.PI + 0.02, -0.02, 56), M(0, hh + 0.75, 0), { tint: 0x7a5c54, ao: false });
    kit.add('stone', annulus(r0, r0 + 2.6, -Math.PI + 0.02, -0.02, 56), M(0, hh + 1.6, 0), { tint: 0x6a4e48, ao: false });
  }
  for (let i = 0; i < 6; i++) { const a = -Math.PI + (i + 0.5) / 6 * Math.PI, r = WR + 8.6, y = 6.5 + 3.2 + 1.6; P.brazier(kit, Math.cos(a) * r, y, Math.sin(a) * r, { s: 1.1, base: 'dark' }); kit.colliders.pop(); flags.add(M(Math.cos(a) * (r + 1.4), y + 7.5, Math.sin(a) * (r + 1.4), -a - Math.PI / 2), 1.8, 5.5, i % 2 ? 0x8a1414 : 0x2a1010, { hang: 'top', trim: 0xc8a040 }); kit.add('dark', cyl(0.1, 0.14, 8, 6, 1), M(Math.cos(a) * (r + 1.55), y + 4, Math.sin(a) * (r + 1.55)), { tint: 0x3a2a2a, ao: false }); }
  cliffRing(kit, Array.from({ length: 22 }, (_, i) => { const a = -Math.PI * 1.08 + i / 21 * Math.PI * 1.16; return [Math.cos(a) * 52, Math.sin(a) * 48]; }), H, { height: 22, thick: 10, seed: 5, tint: 0x4a3434, strata: 0x2e2020, inside: [0, 0], closed: false, lean: 0.25, jag: 3 });
  const dec = new Decals(H);
  for (let i = 0; i < 26; i++) { const a = rng.range(0, TAU), r = rng.range(2, R - 1.5); dec.add(rng.pick(['blood', 'blood', 'straw', 'scorch', 'cracks']), Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(1.3, 3.2), alpha: 0.8 }); }
  dec.add('runes', 0, -2, { size: 8, rot: 0.3, tint: 0xff9070, emit: 0xff3a10, emitI: 0.9, alpha: 0.7 });
  const nav = await finish(zone, g, kit, flags, dec, { R, quality, extraNav: nv => nv.walk(S.rect(0, R + 1, 5.5, 4)), spawn: [0, R - 4] });
  zone.anchor('spawn', 0, R - 4, 0);
  zone.anchor('boss', 0, -6, Math.PI);
  zone.anchor('boss:skarn', -6, -8, Math.PI + 0.3);
  zone.anchor('boss:vesk', 6, -8, Math.PI - 0.3);
  for (let i = 0; i < 5; i++) { const a = -Math.PI + (i + 0.5) / 5 * Math.PI, r = R - 2.2; const x = Math.cos(a) * r, z = Math.sin(a) * r; const p = nav.walkable(x, z) ? [x, z] : nav.nearest(x, z, 4) || [x, z]; zone.anchor(`kennel:${i + 1}`, p[0], p[1], faceTo(p[0], p[1], 0, 0)); }
  zone.region('The Kennels', 0, 0, R);
  zone.env = makeEnv('blood', { music: 'legion_hounds', ambience: 'arena' });
  zone.envs = { blood: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 6, z0: -R - 6, size: 2 * R + 12 } });
}
