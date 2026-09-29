// 'chaos_rift' — Chaos Dungeon "Demon Rift": three floating islands of corrupted ruins in a violet-crimson void.
//   Stage 1 (x = −110) Fallen Sanctum: shattered temple court, broken colonnades, spikes erupting through the paving
//   Stage 2 (x =    0) Altar of Chains: blood-stone altars, a titan's ribcage arching over the floor, giant chains
//   Stage 3 (x = +110) Heart of the Rift: a black ritual disc, six obelisks and the horned rift-heart altar (boss)
// Each stage: stageN:spawn (south), stageN:exit (the rift portal, north) / stage3:boss, and sN:m1…m12 mob points.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, cone, sphere, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags, buildRiftPortal } from '../fx.js';
import { islandSkirt, boulder, spike, crystal, buildFloaters, buildVoidFloor, buildAbyssMist, buildRimGlow } from '../cliffs.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, clamp, smoothstep } from '../../core/noise.js';
import { tube } from '../../engine/geom.js';

export const STAGES = [{ x: -110, z: 0, name: 'Fallen Sanctum' }, { x: 0, z: 0, name: 'Altar of Chains' }, { x: 110, z: 0, name: 'Heart of the Rift' }];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function islandPoly(cx, cz, rx, rz, seed, n = 30) {
  const nz = new Simplex(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const k = 1 + nz.noise2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3) * 0.13 + nz.noise2(Math.cos(a) * 4, Math.sin(a) * 4 + seed) * 0.05;
    pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return pts;
}

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 66);
  const isl = STAGES.map((st, i) => ({ ...st, poly: islandPoly(st.x, st.z, 29, 26.5, 11 + i * 7) }));
  for (const I of isl) { I.shape = S.poly(I.poly); }
  const inIsland = (x, z, pad = 0) => isl.some(I => I.shape.sd(x, z) < pad);
  zone.bounds = { x0: -140, z0: -30, x1: 140, z1: 30 };
  const g = zone.ground = new Ground({ x0: -150, z0: -40, w: 300, d: 80, res: 1, layers: ['void', 'obsidian', 'flagstone', 'bloodstone', 'marble', 'gravel', 'rock', 'dirt'], base: 'void', seed: 9 });
  g.tint.setRGB(0.66, 0.63, 0.72);
  g.emitColor.setRGB(1.6, 0.32, 1.25);
  const N = g.noise;
  g.sculpt((x, z) => {
    let best = 1e9; for (const I of isl) best = Math.min(best, I.shape.sd(x, z));
    const base = N.noise2(x / 9, z / 9) * 0.25 + N.noise2(x / 3, z / 3) * 0.06;
    if (best > 0.35) return -3.2;
    return base - smoothstep(-2.5, 0.35, best) * 0.9;
  });

  // ---------------------------------------------------------------- paint
  const [A, B2, C] = isl;
  // stage 1: ancient paving, corruption spreading through it
  g.paint('flagstone', S.circle(A.x, 0, 22), { soft: 3, noise: 4, nscale: 5 });
  g.paint('gravel', S.circle(A.x - 14, 12, 5), { soft: 2, noise: 2, nscale: 2 });
  for (let i = 0; i < 7; i++) g.paint('void', S.circle(A.x + rng.range(-20, 20), rng.range(-18, 18), rng.range(2.5, 5)), { soft: 2, noise: 2.5, nscale: 2.5 });
  // stage 2: blood-stone floor, obsidian rim
  g.paint('bloodstone', S.circle(B2.x, 0, 20), { soft: 3, noise: 3.5, nscale: 5 });
  g.paint('obsidian', S.ring(B2.x, 0, 24, 6), { soft: 2, noise: 3, nscale: 4 });
  for (let i = 0; i < 5; i++) g.paint('void', S.circle(B2.x + rng.range(-18, 18), rng.range(-16, 16), rng.range(2, 4)), { soft: 2, noise: 2, nscale: 2 });
  // stage 3: black ritual disc
  g.paint('obsidian', S.circle(C.x, 0, 25), { soft: 2, noise: 3, nscale: 5 });
  g.paint('obsidian', S.circle(C.x, -2, 17.5), { soft: 0.4 });
  g.plaza(C.x, -2, 17.2, { layer: 'obsidian', tile: 3.2, rings: [5.5, 11.2, 16.9], spokes: 12, border: 0.5 });
  g.paint('flagstone', S.circle(A.x, -3, 8.5), { soft: 0.3 });
  g.plaza(A.x, -3, 8.2, { layer: 'flagstone', tile: 2.0, rings: [3.4, 8.0], spokes: 7, border: 0.4 });
  // island rims: crumbling rock
  for (const I of isl) g.paint('rock', S.subtract(I.shape, S.inflate(I.shape, -3.2)), { soft: 2, noise: 1.5, nscale: 2 });
  for (const I of isl) g.info('ao', S.subtract(S.inflate(I.shape, 1), S.inflate(I.shape, -1.5)), { soft: 2, amount: 0.35 });

  // ---------------------------------------------------------------- architecture & dressing
  const kit = new Kit({ seed: 31 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const skirtTint = [0x5a4a62, 0x5e3c46, 0x3e3448], strataT = [0x3a2e44, 0x40262c, 0x281e34];
  isl.forEach((I, i) => islandSkirt(kit, I.poly, H, { depth: 24 + i * 4, seed: 40 + i, tint: skirtTint[i], strata: strataT[i], glow: i === 2 ? 0xb040ff : 0xff3aa0, lip: 0.9 }));
  // rim boulders & broken slabs along every edge
  for (const I of isl) for (let k = 0; k < I.poly.length; k++) {
    if (rng.chance(0.45)) continue;
    const [px, pz] = I.poly[k], dx = px - I.x, dz = pz - I.z, L = Math.hypot(dx, dz);
    const bx = I.x + dx * (1 - 1.6 / L), bz = I.z + dz * (1 - 1.6 / L);
    if (bz > 14 && Math.abs(bx - I.x) < 8) continue;        // keep the spawn edge open
    boulder(kit, bx, H(bx, bz), bz, { s: rng.range(0.6, 1.4), seed: rng.int(0, 999), tint: 0x4a4050, flat: 0.55 });
  }
  const colT = 0x9a90a4;
  const brokenColumn = (x, z, h, fallen = false, rot = 0) => {
    const y = H(x, z);
    if (fallen) {
      kit.add('stone', cyl(0.5, 0.5, h, 12, 1.5), M(x, y + 0.45, z, rot, 1, 1, 1, Math.PI / 2), { tint: colT, yGround: y });
      kit.add('stone', box(1.4, 0.4, 1.4, 1), M(x - Math.cos(rot) * h * 0.55, y + 0.2, z + Math.sin(rot) * h * 0.55, rot), { tint: colT });
      kit.block(S.line([[x - Math.cos(rot) * h / 2, z + Math.sin(rot) * h / 2], [x + Math.cos(rot) * h / 2, z - Math.sin(rot) * h / 2]], 1.0), 0.3);
    } else {
      P.column(kit, x, y, z, h, 0.5, { mat: 'stone', tint: colT, capital: h > 5 });
      if (h < 5) for (let i = 0; i < 3; i++) kit.add('stone', box(rng.range(0.3, 0.6), rng.range(0.2, 0.4), rng.range(0.3, 0.6), 1), M(x + rng.range(-1.2, 1.2), y + 0.12, z + rng.range(-1.2, 1.2), rng.range(0, 3)), { tint: colT, ao: false });
    }
  };
  const spikeCluster = (x, z, n, s = 1, mat = 'dark') => {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), d = i === 0 ? 0 : rng.range(0.8, 2.2) * s;
      const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
      spike(kit, sx, H(sx, sz), sz, { h: (i === 0 ? 5.5 : rng.range(2.2, 4.2)) * s, r: (i === 0 ? 0.65 : rng.range(0.3, 0.5)) * s, bend: rng.range(0.6, 1.8) * s, dir: a, mat, tint: 0xb0a0b8 });
    }
    kit.add('rock', tube([V(x - 1.6 * s, H(x, z) + 0.05, z), V(x, H(x, z) + 0.35 * s, z), V(x + 1.6 * s, H(x, z) + 0.05, z)], [0.1, 1.3 * s, 0.1], 8, false), null, { tint: 0x2e2632, cast: false });
  };
  const portalArch = (x, z, color) => {
    const y = H(x, z);
    const archG = new THREE.TorusGeometry(3.5, 0.55, 8, 24, Math.PI);
    kit.add('dark', archG, M(x, y + 0.9, z), { tint: 0x8a7a92, ao: false });
    for (const s of [-1, 1]) {
      kit.add('dark', box(1.4, 1.8, 1.4, 1), M(x + s * 3.5, y + 0.9, z), { tint: 0x7a6a80 });
      spike(kit, x + s * 3.9, y + 3.6, z, { h: 3.6, r: 0.35, bend: 1.6, dir: s > 0 ? 0 : Math.PI, mat: 'dark', block: false });
      kit.block(S.circle(x + s * 3.5, z, 0.9), 0.3);
    }
    kit.add('dark', box(9.4, 0.5, 3.4, 1), M(x, y + 0.2, z + 0.4), { tint: 0x6a5a70, ao: false });
    kit.light(x, y + 3.6, z + 0.8, color, 8, 14, 0.12);
  };
  const portals = [];

  // ----- stage 1: Fallen Sanctum
  {
    const X = A.x;
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const x = X + s * 11, z = -16 + i * 7;
      const r = rng.next();
      if (r < 0.3) brokenColumn(x + rng.range(-1, 1), z, 6, true, rng.range(-0.6, 0.6) + (s > 0 ? 0 : Math.PI));
      else brokenColumn(x, z, r < 0.65 ? rng.range(2, 4.2) : 7.2);
    }
    // ruined back wall with a gap for the portal
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = X + s * (7 + i * 4.2), z = -20.5 + rng.range(-0.4, 0.4), h = rng.range(2.5, 6);
      kit.add('stone', box(4.1, h, 1.4, 2), M(x, H(x, z) + h / 2 - 0.3, z, rng.range(-0.05, 0.05), 1, 1, 1, 0, rng.range(-0.04, 0.04)), { tint: 0x8a8094, yGround: H(x, z), aoH: 3 });
      kit.block(S.rect(x, z, 4.1, 1.4), 0.3);
    }
    spikeCluster(X - 15, 6, 5, 1.1); spikeCluster(X + 16, -4, 4, 1); spikeCluster(X + 5, 14, 3, 0.8);
    for (const [x, z] of [[X - 19, -9], [X + 20, 9], [X - 8, 18]]) crystal(kit, x, H(x, z), z, { s: rng.range(0.9, 1.3), color: 0xc050ff, seed: rng.int(0, 99) });
    for (const [x, z] of [[X - 6, 6], [X + 6, 6]]) P.brazier(kit, x, H(x, z), z, { s: 0.9, color: 0xd070ff, glow: 0xb050ff, base: 'dark' });
    // sunken altar in the ritual circle
    kit.add('dark', cyl(2.2, 2.6, 0.8, 8, 1), M(X, H(X, -3) + 0.2, -3), { tint: 0x6a5a72 });
    crystal(kit, X, H(X, -3) + 0.6, -3, { s: 1.2, color: 0xff50e0, seed: 5, block: false });
    kit.block(S.circle(X, -3, 2.6), 0.3);
    portalArch(X, -21.5, 0xc050ff); portals.push({ x: X, z: -21.3, c1: 0x5a1080, c2: 0xe050ff });
  }
  // ----- stage 2: Altar of Chains
  {
    const X = B2.x;
    // a titan's skeleton half-buried along the western rim: spine, curling ribs, horned skull
    const SX = X - 18;
    for (let i = 0; i < 6; i++) {
      const z = -13 + i * 4.8, sz = 1 - Math.abs(i - 2.5) * 0.1;
      const pts = [V(SX, H(SX, z) - 0.4, z), V(SX + 2.6 * sz, 4.4 * sz, z + 0.3), V(SX + 5.2 * sz, 5.6 * sz, z + 0.6), V(SX + 7.4 * sz, 3.6 * sz, z + 0.9), V(SX + 8 * sz, H(SX + 8 * sz, z) - 0.3, z + 1.1)];
      kit.add('bone', tube(pts, [0.5, 0.42, 0.36, 0.3, 0.22], 8, true), null, { tint: 0xd8ccb8, chunkAt: [SX + 3, z] });
      kit.block(S.circle(pts[4].x, pts[4].z, 0.45), 0.3);
    }
    kit.add('bone', tube([V(SX, 0.2, -17), V(SX - 0.4, 0.6, -6), V(SX, 0.5, 6), V(SX + 0.6, 0.3, 15)], [0.9, 0.8, 0.7, 0.4], 10, true), null, { tint: 0xd0c4b0, chunkAt: [SX, 0] });
    kit.block(S.line([[SX, -17], [SX + 0.5, 15]], 1.6), 0.3);
    kit.add('bone', sphere(2.2, 14, 10), M(SX + 0.5, 1.1, -19.5, 0.3, 1.2, 0.8, 1.4), { tint: 0xd8ccb8 });
    for (const s2 of [-1, 1]) spike(kit, SX + 0.5 + s2 * 1.6, 2.1, -20, { h: 4, r: 0.5, bend: 2.2, dir: s2 > 0 ? 0 : Math.PI, mat: 'bone', tint: 0xe0d4c0, block: false });
    kit.block(S.circle(SX + 0.5, -19.5, 2.6), 0.3);
    // blood altars with candles
    for (const [x, z, r] of [[X + 8, -6, 0.3], [X + 12, 8, -0.5], [X - 2, 12, 0.1]]) {
      kit.add('dark', box(3.2, 1.0, 1.8, 1), M(x, H(x, z) + 0.5, z, r), { tint: 0x5a4450 });
      kit.add('dark', box(3.5, 0.18, 2.1, 1), M(x, H(x, z) + 1.05, z, r), { tint: 0x6a5460, ao: false });
      for (let i = 0; i < 5; i++) { const cx = x + Math.cos(r) * (i - 2) * 0.6, cz = z - Math.sin(r) * (i - 2) * 0.6 + (i % 2 ? 0.5 : -0.5); kit.add('bone', cyl(0.06, 0.07, 0.3 + (i % 3) * 0.1, 6, 1), M(cx, H(x, z) + 1.25, cz), { tint: 0xf0e0c8, ao: false }); kit.flame(cx, H(x, z) + 1.45 + (i % 3) * 0.1, cz, 0.08, 0xff7040); }
      kit.light(x, H(x, z) + 2, z, 0xff5040, 3, 6, 0.3);
      kit.block(S.rect(x, z, 3.4, 2.0, r), 0.3);
    }
    // chain pylons at the island edge with giant chains soaring off into the void
    const chainTo = (ax, az, ay, bx, bz, by, sag) => {
      const n = Math.max(6, Math.round(Math.hypot(bx - ax, bz - az, by - ay) / 1.1));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * sag;
        const yaw = Math.atan2(-(bz - az), bx - ax);
        const link = new THREE.TorusGeometry(0.45, 0.14, 5, 10);
        kit.add('metal', link, M(x, y, z, yaw, 1.4, 1, 1, 0, i % 2 ? Math.PI / 2 : 0), { tint: 0x3a3438, ao: false, chunkAt: [ax, az] });
      }
    };
    for (const [px, pz, bx, bz, by] of [[X + 22, -12, X + 60, -40, 22], [X - 22, 10, X - 55, 30, 10], [X + 18, 16, X + 45, 38, -6]]) {
      const y = H(px, pz);
      kit.add('dark', box(2.2, 6, 2.2, 1), M(px, y + 3, pz, 0.4), { tint: 0x6a5460 });
      spike(kit, px, y + 6, pz, { h: 3, r: 0.8, bend: 0.8, dir: rng.range(0, 6), mat: 'dark', block: false });
      kit.block(S.circle(px, pz, 1.7), 0.3);
      chainTo(px, pz, y + 5.2, bx, bz, by, 3.5);
    }
    spikeCluster(X + 18, -2, 4, 1); spikeCluster(X + 3, -15, 3, 0.9);
    for (const [x, z] of [[X + 21, 6], [X - 6, -17], [X + 14, -17]]) crystal(kit, x, H(x, z), z, { s: rng.range(0.9, 1.3), color: 0xff3a6a, seed: rng.int(0, 99) });
    portalArch(X + 6, -21.5, 0xff4a90); portals.push({ x: X + 6, z: -21.3, c1: 0x7a0a30, c2: 0xff4a9a });
  }
  // ----- stage 3: Heart of the Rift
  {
    const X = C.x;
    // horned rift-heart altar (north)
    const ay = H(X, -19);
    kit.add('dark', cyl(5, 6.2, 1.6, 8, 2), M(X, ay + 0.4, -19), { tint: 0x5a4a62 });
    kit.add('dark', cyl(3.4, 4.2, 2.6, 8, 2), M(X, ay + 2.2, -19.5), { tint: 0x6a5872 });
    for (const s of [-1, 1]) {
      kit.add('dark', tube([V(X + s * 3, ay + 3, -20), V(X + s * 6, ay + 7, -21), V(X + s * 6.5, ay + 12, -20), V(X + s * 4.5, ay + 15.5, -18.5)], [1.4, 1.0, 0.6, 0.08], 10, true), null, { tint: 0x9a8a9e, chunkAt: [X, -19] });
      kit.add('dark', tube([V(X + s * 4.2, ay + 2, -17), V(X + s * 8.5, ay + 3.5, -15.5), V(X + s * 10.5, ay + 6.5, -16)], [0.8, 0.5, 0.05], 8, true), null, { tint: 0x9a8a9e, chunkAt: [X, -19] });
    }
    crystal(kit, X, ay + 3.3, -19.5, { s: 2.4, color: 0xff3ae0, intensity: 3.2, seed: 9, block: false });
    kit.block(S.circle(X, -19, 6.3), 0.3);
    kit.light(X, ay + 6, -18, 0xff40e0, 12, 22, 0.1);
    // six obelisks with glowing runes around the ritual disc
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.62 + (i >= 3 ? Math.PI * 0 : 0);
      const ang = i / 6 * Math.PI * 2 + Math.PI / 6;
      const x = X + Math.cos(ang) * 19.5, z = -2 + Math.sin(ang) * 17.5;
      if (z > 11 && Math.abs(x - X) < 6) continue;
      const y = H(x, z);
      kit.add('dark', cyl(0.5, 1.1, 7, 4, 1), M(x, y + 3.5, z, ang), { tint: 0x5a4a62 });
      kit.add('dark', cone(0.55, 1.4, 4, 1), M(x, y + 7.7, z, ang), { tint: 0x6a5872 });
      for (let k = 0; k < 3; k++) kit.glow(box(0.1, 0.55, 0.62, 1), M(x + Math.cos(ang + Math.PI) * 0.72, y + 2 + k * 1.3, z + Math.sin(ang + Math.PI) * 0.72, -ang), 0xd060ff, 3);
      kit.block(S.circle(x, z, 1.2), 0.3);
      void a;
    }
    for (const [x, z] of [[X - 22, 8], [X + 23, -8], [X + 18, 14], [X - 17, -14]]) crystal(kit, x, H(x, z), z, { s: rng.range(1, 1.4), color: 0xb040ff, seed: rng.int(0, 99) });
    spikeCluster(X - 21, -2, 4, 1.1); spikeCluster(X + 22, 3, 4, 1.1);
    for (const [x, z] of [[X - 8, 10], [X + 8, 10]]) P.brazier(kit, x, H(x, z), z, { s: 1, color: 0xd070ff, glow: 0xb050ff, base: 'dark' });
  }
  // contact shadows, then the ground itself (clipped to the islands)
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 2, amount: 0.3 });
  await tick();
  await g.build(zone.root, { clip: (x, z) => inIsland(x, z, 0.25) });
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  await tick();

  // ---------------------------------------------------------------- the void
  zone.root.add(buildVoidFloor({ x: 0, z: -40, y: -70, size: 900, c1: 0x0c0414, c2: 0x2a0a2a, c3: 0xa02a80, bg: 0x0c0412 }));
  zone.root.add(buildAbyssMist({ x: 0, z: 0, size: 520, layers: [-12, -24, -38], color: 0x160820, glow: 0x4a1244, alpha: 0.35 }));
  zone.root.add(buildRimGlow(isl.map(I => I.poly), H, { color: 0xc040ff, intensity: 1.3 }));
  const floaters = [];
  for (let i = 0; i < 90; i++) {
    const I = rng.pick(isl), a = rng.range(0, Math.PI * 2), d = rng.range(34, 70);
    const x = I.x + Math.cos(a) * d * 1.2, z = I.z + Math.sin(a) * d * 0.8 - 8;
    const y = z < -20 ? rng.range(-8, 18) : rng.range(-26, -6);
    floaters.push({ x, y, z, s: rng.range(0.8, 3.2) * (z < -30 ? 1.8 : 1), seed: i });
  }
  for (let i = 0; i < 12; i++) floaters.push({ x: rng.range(-150, 150), y: rng.range(4, 28), z: rng.range(-110, -70), s: rng.range(5, 11), seed: 200 + i });
  for (const I of isl) for (let k = 0; k < I.poly.length; k += 2) { if (rng.chance(0.4)) continue; const [px, pz] = I.poly[k], dx = px - I.x, dz = pz - I.z, L = Math.hypot(dx, dz); const d = rng.range(2.5, 7); floaters.push({ x: px + dx / L * d, y: rng.range(-9, -1.5), z: pz + dz / L * d, s: rng.range(0.6, 1.6), seed: 400 + k }); }
  zone.root.add(buildFloaters(floaters, { tint: 0x4a3c50, glow: 0xa040c0 }));
  for (const p of portals) zone.root.add(buildRiftPortal({ x: p.x, y: H(p.x, p.z) + 0.45, z: p.z, r: 2.6, c1: p.c1, c2: p.c2 }));

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  for (const I of isl) {
    for (let i = 0; i < 14; i++) { const x = I.x + rng.range(-22, 22), z = rng.range(-20, 20); if (!inIsland(x, z, -3)) continue; dec.add('fissure', x, z, { size: rng.range(3, 6), sz: 0.45, rot: rng.range(0, 6), tint: 0xffffff, emit: I === isl[1] ? 0xff3a6a : 0xd050ff, emitI: 2.2, alpha: 0.95 }); }
    for (let i = 0; i < 24; i++) { const x = I.x + rng.range(-24, 24), z = rng.range(-21, 21); if (!inIsland(x, z, -2)) continue; dec.add(rng.pick(['cracks', 'cracks', 'rubble', 'stain', 'scorch', 'pebbles']), x, z, { size: rng.range(1.4, 3.2), alpha: 0.8 }); }
  }
  for (let i = 0; i < 12; i++) dec.add('blood', B2.x + rng.range(-16, 18), rng.range(-16, 16), { size: rng.range(1.2, 2.6), alpha: 0.75 });
  dec.add('runes', A.x, -3, { size: 15, rot: 0.2, tint: 0x9a70c0, emit: 0x9040e0, emitI: 0.9, alpha: 0.7 });
  dec.add('runes', C.x, -2, { size: 13, rot: 0, tint: 0x9a70c0, emit: 0xb040ff, emitI: 1.2, alpha: 0.8 });
  dec.add('runes', B2.x + 6, 2, { size: 11, rot: 0.5, tint: 0xc07080, emit: 0xff3050, emitI: 1.0, alpha: 0.65 });
  const dm = dec.build(); if (dm) zone.root.add(dm);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const motes = buildParticles('motes', { quality });
  const embers = buildParticles('embers', { quality, count: 140, color: [3.2, 0.6, 1.8] });
  zone.root.add(motes, embers);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); motes.userData.update(focus); embers.userData.update(focus); g.uniforms && (g.uniforms.uEmitPulse.value = 0.85 + 0.15 * Math.sin(t * 1.3)); });

  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-142, -32, 284, 64, 0.5);
  for (const I of isl) nav.walk(S.inflate(I.shape, -2.2));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  zone._nav = nav; zone.nav = nav.toContract();

  // ---------------------------------------------------------------- anchors
  const A_ = (n, x, z, f) => zone.anchor(n, x, z, f);
  A_('stage1:spawn', A.x, 17.5, 0); A_('stage1:exit', A.x, -18.2, 0);
  A_('stage2:spawn', B2.x, 17.5, 0); A_('stage2:exit', B2.x + 6, -18.2, 0);
  A_('stage3:spawn', C.x, 17.5, 0); A_('stage3:boss', C.x, -6, Math.PI);
  isl.forEach((I, si) => {
    const pts = [];
    let guard = 0;
    while (pts.length < 12 && guard++ < 800) {
      const x = I.x + rng.range(-20, 20), z = rng.range(-16, 11);
      if (!nav.walkable(x, z) || nav.walkable(x, z) && !inIsland(x, z, -3.5)) continue;
      if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6.5)) continue;
      if (Math.hypot(x - I.x, z - 17.5) < 10) continue;
      pts.push([x, z]);
    }
    pts.forEach(([x, z], i) => A_(`s${si + 1}:m${i + 1}`, x, z, faceTo(x, z, I.x, 17.5)));
    const ex = I.x + (si === 1 ? -4 : 0), ez = si === 2 ? -10 : -7;
    A_(`s${si + 1}:elite`, ex, ez, Math.PI);
  });
  for (const [name, a] of Object.entries(zone.anchors)) {
    if (nav.walkable(a.x, a.z)) continue;
    const p = nav.nearest(a.x, a.z, 5);
    if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } else console.warn('[chaos_rift] anchor off-nav', name);
  }
  isl.forEach(I => zone.region(I.name, I.x, I.z, 26));
  zone.env = makeEnv('void', { music: 'chaos', ambience: 'void', weather: 'embers' });
  zone.envs = { void: zone.env };
  zone.minimap = paintMinimap(zone, { px: 512, area: { x0: -145, z0: -145, size: 290 }, clip: (x, z) => inIsland(x, z, 0.5) });
  zone.stages = isl.map(I => ({ name: I.name, x: I.x, z: I.z, r: 26 }));
}
