// 'sunscar' — Sandmaw's desert basin (~76 m, a wide open floor for a 16 m worm). Wind-rippled sand that reads as
// burrowable over the ghost of an ancient sun-plaza, a ring of half-buried sandstone ruins on the rim: colonnades,
// a sunken gateway, the legs of a colossus on its plinth, its fallen crowned head, a stone hand reaching out of the
// dunes, the bleached ribs of something enormous. Sand streamers race across the floor under a hot, hazy noon.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, cone, sphere, faceTo, extrude, archPanel } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { LightPool, buildParticles, Flags } from '../fx.js';
import { cliffRing, boulder } from '../cliffs.js';
import { buildStreamers, buildHaze } from '../arenas.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, catmull, smoothstep, lerp } from '../../core/noise.js';
import { blob, tube } from '../../engine/geom.js';

const R = 36;                     // basin floor radius (walkable ≈ 34.5)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SANDSTONE = 0xe0b682, SANDSTONE_D = 0xc89464;

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 12);
  const N = new Simplex(51);
  zone.bounds = { x0: -R, z0: -R, x1: R, z1: R };
  const g = zone.ground = new Ground({ x0: -100, z0: -100, w: 200, d: 200, res: 1, layers: ['dunes', 'sand', 'sandstone', 'gravel', 'rock', 'dirt'], base: 'dunes', seed: 19 });
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z);
    // a shallow bowl with long low swells (wind-shaped), dunes piling up around the rim
    let h = -0.6 + (r / R) ** 2 * 0.9 + N.noise2(x / 22, z / 22) * 0.45 + N.noise2(x / 8, z / 8 + 3) * 0.12;
    const dune = (1 - Math.abs(N.noise2(x / 26 + 5, z / 15))) ** 2;          // crest lines
    h += smoothstep(R - 4, R + 8, r) * (2.5 + dune * 7 + (r - R) * 0.35);
    // sandstone mesas behind the north / east / west rim, open dunes to the south (the approach)
    const north = smoothstep(0.1, -0.5, z / (r + 1e-3));
    h += smoothstep(R + 6, R + 16, r) * north * 10;
    const gate = smoothstep(10, 4, Math.abs(x)) * smoothstep(R - 6, R + 4, z);
    h = lerp(h, 0.8 + Math.max(0, z - R) * 0.12, gate * 0.9);
    return h;
  });

  // ---------------------------------------------------------------- paint
  // the ghost of an ancient sun-plaza: patchy sandstone pavers, a ring road, radial avenues, mostly sanded over
  const plaza = S.circle(0, -2, 15);
  g.paint('sandstone', plaza, { soft: 3, noise: 6, nscale: 3, amount: 0.9 });
  g.plaza(0, -2, 14.6, { layer: 'sandstone', tile: 3.2, rings: [5.2, 10.4, 14.3], spokes: 12, border: 0.5, keep: true });
  for (let i = 0; i < 34; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(1, 16); g.paint('dunes', S.circle(Math.cos(a) * rr, -2 + Math.sin(a) * rr, rng.range(2.2, 5.5)), { soft: 3.5, noise: 2.5, nscale: 2.5, amount: rng.range(0.7, 1) }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g.paint('sandstone', S.line([[Math.cos(a) * 19, Math.sin(a) * 19], [Math.cos(a) * 31, Math.sin(a) * 31]], 3.2), { soft: 2, noise: 3.5, nscale: 3, amount: 0.7 }); }
  for (let i = 0; i < 18; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(20, R); g.paint('gravel', S.circle(Math.cos(a) * rr, Math.sin(a) * rr, rng.range(1.2, 3.2)), { soft: 2, noise: 1.5, nscale: 2, amount: 0.55 }); }
  g.paint('sand', S.subtract(S.circle(0, 0, 95), S.circle(0, 0, R - 2)), { soft: 5, noise: 5, nscale: 8, amount: 0.7 });
  g.paint('rock', S.subtract(S.circle(0, 0, 95), S.circle(0, 0, R + 10)), { soft: 5, noise: 4, nscale: 6, amount: 0.5 });
  g.info('ao', S.ring(0, 0, R + 1, 5), { soft: 4, amount: 0.18 });

  // ---------------------------------------------------------------- mesas & ruins
  const kit = new Kit({ seed: 23 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const mesa = catmull([[-30, 33], [-44, 18], [-47, -4], [-45, -26], [-30, -44], [-8, -49], [14, -48], [34, -40], [46, -22], [47, 0], [44, 18], [30, 33]], 5);
  cliffRing(kit, mesa, (x, z) => Math.min(H(x, z), 4), {
    heightFn: (x, z) => z < -10 ? 15 : 8 + smoothstep(25, -10, z) * 7, thick: 8, seed: 17,
    tint: 0xd49a64, strata: 0xa8643c, top: 0xe8c290, inside: [0, 0], closed: false, lean: 0.3, jag: 2.2, step: 1.8,
  });
  const col = (x, z, h, fallen = false, rot = 0) => {
    const y = H(x, z);
    if (fallen) {
      for (let k = 0; k < 3; k++) {       // drums rolled apart
        const t = k * 1.9 + rng.range(-0.2, 0.2);
        kit.add('stone', cyl(0.62, 0.62, 1.7, 12, 1.5), M(x + Math.cos(rot) * t, y + 0.35, z - Math.sin(rot) * t, rot + rng.range(-0.15, 0.15), 1, 1, 1, Math.PI / 2 + rng.range(-0.1, 0.1)), { tint: SANDSTONE, yGround: y });
      }
      kit.block(S.line([[x, z], [x + Math.cos(rot) * 4, z - Math.sin(rot) * 4]], 1.4), 0.3);
    } else {
      P.column(kit, x, y - 0.6, z, h, 0.62, { mat: 'stone', tint: SANDSTONE, capital: h > 6 });
      kit.add('stone', box(1.9, 0.8, 1.9, 1), M(x, y - 0.1, z, rng.range(-0.2, 0.2), 1, 1, 1, rng.range(-0.08, 0.08)), { tint: SANDSTONE_D });
    }
  };
  // colonnade arcs on the west and east rims
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const a = (side > 0 ? 0 : Math.PI) + (i - 3) * 0.13 * side;
    const rr = R + 1.2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const roll = rng.next();
    if (roll < 0.25) col(x, z, 0, true, a + Math.PI / 2 * side);
    else col(x, z, roll < 0.55 ? rng.range(2.5, 4.5) : rng.range(6.5, 8));
    if (i < 6 && roll > 0.55 && rng.chance(0.6)) { const a2 = a + 0.13 * side, x2 = Math.cos(a2) * rr, z2 = Math.sin(a2) * rr; kit.add('stone', box(Math.hypot(x2 - x, z2 - z) + 1.4, 0.9, 1.3, 2), M((x + x2) / 2, H(x, z) + 7.3, (z + z2) / 2, Math.atan2(-(z2 - z), x2 - x)), { tint: SANDSTONE }); }
  }
  // the sunken gateway (north-west): a great arch drowned to its shoulders in sand
  { const gx = -21, gz = -27, y = H(gx, gz), rot = faceTo(gx, gz, 0, 0) + Math.PI;
    kit.add('stone', extrude(archPanel(9, 7.5, 4.6, 2.4, 12), 2.2, 2), M(gx, y - 2.6, gz, rot), { tint: SANDSTONE, yGround: y - 2.6 });
    kit.add('stone', box(10.2, 1.1, 2.6, 2), M(gx, y + 5.2, gz, rot), { tint: SANDSTONE_D });
    kit.add('gold', sphere(0.7, 12, 8), M(gx - Math.sin(rot) * 1.2, y + 4.4, gz - Math.cos(rot) * 1.2, rot, 1, 1, 0.3), { ao: false });
    kit.block(S.rect(gx, gz, 9.5, 2.4, rot), 0.3);
  }
  // the colossus: legs from the knees down on a stepped plinth (north)
  { const cx = 4, cz = -34, y = H(cx, cz);
    for (let k = 0; k < 3; k++) kit.add('stone', box(13 - k * 2.2, 1.2, 8 - k * 1.2, 2), M(cx, y + 0.3 + k * 1.2, cz, 0.08), { tint: k % 2 ? SANDSTONE : SANDSTONE_D, yGround: y });
    const top = y + 3.9;
    for (const s of [-1, 1]) {
      kit.add('stone', box(2.6, 1.2, 4.2, 1), M(cx + s * 2.1, top + 0.6, cz + 0.8, 0.08), { tint: SANDSTONE });                 // feet
      const shin = new THREE.LatheGeometry([[0.95, 0], [0.85, 0.8], [1.15, 3.0], [1.25, 4.6], [1.1, 6.3], [1.25, 6.8]].map(([r, h]) => new THREE.Vector2(r, h)), 14);
      kit.add('stone', shin, M(cx + s * 2.1, top + 0.9, cz - 0.1, 0.08, 1, 1, 1, 0.04 * s), { tint: SANDSTONE });   // shins
      kit.add('stone', cyl(1.2, 1.05, 1.0, 12, 1), M(cx + s * 2.1, top + 7.9, cz - 0.1, 0.08, 1, 1, 1, 0.3, 0.2 * s), { tint: SANDSTONE_D });  // broken knee
      for (let t = 0; t < 4; t++) kit.add('stone', box(0.35, 0.3, 0.6, 1), M(cx + s * 2.1 + (t - 1.5) * 0.5, top + 0.75, cz + 2.9, 0.08), { tint: SANDSTONE });  // toes
    }
    kit.add('stone', box(8, 0.6, 2, 1), M(cx, top + 0.3, cz + 3.4, 0.08), { tint: SANDSTONE_D });
    kit.block(S.rect(cx, cz, 13.2, 8.2, 0.08), 0.3);
  }
  // the fallen crowned head (east), lying on its cheek, gazing across the arena
  { const hx = 27.5, hz = -14, y = H(hx, hz);
    const base = M(hx, y + 1.9, hz, faceTo(hx, hz, 0, 0) + 0.4).multiply(M(0, 0, 0, 0, 1.25, 1.25, 1.25, 0, 1.2));   // tip ~70° onto the right cheek
    const at = (x, yy, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => base.clone().multiply(M(x, yy, z, ry, sx, sy, sz, rx, rz));
    kit.add('stone', blob(1.7, 2, d => 1 + Math.max(0, d.y) * 0.1, [0.95, 1.25, 1.0]), at(0, 0, 0), { tint: SANDSTONE, ao: false });            // skull
    kit.add('stone', box(2.4, 0.4, 0.6, 1), at(0, 0.55, -1.5, 0, 1, 1, 1, -0.2), { tint: SANDSTONE_D, ao: false });                          // brow
    kit.add('stone', box(0.55, 1.2, 0.7, 1), at(0, -0.15, -1.75, 0, 1, 1, 1, 0.12), { tint: SANDSTONE, ao: false });                         // nose
    kit.add('stone', box(1.1, 0.22, 0.4, 1), at(0, -0.95, -1.62), { tint: SANDSTONE_D, ao: false });                                       // lips
    for (const s of [-1, 1]) kit.add('stone', box(0.7, 0.18, 0.25, 1), at(s * 0.62, 0.22, -1.62), { tint: 0x9a6a44, ao: false });            // closed eyes
    kit.add('stone', cyl(1.05, 1.3, 1.0, 14, 1), at(0, -1.7, 0.1), { tint: SANDSTONE, ao: false });                                          // neck stump
    const crown = new THREE.TorusGeometry(1.5, 0.22, 6, 20); crown.rotateX(Math.PI / 2);
    kit.add('gold', crown, at(0, 1.35, 0.05), { ao: false });
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; kit.add('gold', cone(0.3, 1.3, 6, 1), at(Math.cos(a) * 1.5, 2.0, Math.sin(a) * 1.5 + 0.05, 0, 1, 1, 1, Math.sin(a) * 0.25, -Math.cos(a) * 0.25), { ao: false }); }
    kit.block(S.circle(hx, hz, 3.6), 0.3);
  }
  // a stone hand reaching out of the dunes (west-south-west)
  { const bx = -29, bz = 12, y = H(bx, bz), yaw = 0.9;
    const F = (lx, ly, lz, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => M(bx + lx * Math.cos(yaw) + lz * Math.sin(yaw), y + ly, bz - lx * Math.sin(yaw) + lz * Math.cos(yaw), yaw, sx, sy, sz, rx, rz);
    kit.add('stone', cyl(1.4, 1.7, 3.2, 10, 1), F(0, 0.6, 0, 1, 1, 1, 0.35), { tint: SANDSTONE });              // wrist
    kit.add('stone', box(3.0, 1.2, 3.2, 1), F(0, 2.7, -0.6, 1, 1, 1, 0.5), { tint: SANDSTONE });                // palm
    for (let k = 0; k < 4; k++) kit.add('stone', tube([V(-1.1 + k * 0.72, 0, 0), V(-1.2 + k * 0.75, 1.6, -0.6), V(-1.25 + k * 0.78, 2.6, -0.1)], [0.36, 0.3, 0.24], 7, true), F(0, 3.1, -1.4, 1, 1, 1, 0.5), { tint: SANDSTONE, chunkAt: [bx, bz] });
    kit.add('stone', tube([V(1.4, 0, 0.2), V(2.3, 0.8, -0.3), V(2.6, 1.8, -0.2)], [0.4, 0.33, 0.26], 7, true), F(0, 2.4, -0.6, 1, 1, 1, 0.5), { tint: SANDSTONE, chunkAt: [bx, bz] });   // thumb
    kit.block(S.circle(bx, bz, 2.4), 0.3);
  }
  // the bleached ribcage of a long-dead giant (south-east): a buried spine ridge and five pairs of huge ribs
  { const rx = 20, rz = 23, y = H(rx, rz), ax = Math.cos(-0.35), az = Math.sin(-0.35);   // spine direction
    kit.add('bone', tube([V(rx - ax * 9, y - 0.9, rz - az * 9), V(rx - ax * 3, y - 0.2, rz - az * 3), V(rx + ax * 3, y - 0.25, rz + az * 3), V(rx + ax * 9, y - 1.0, rz + az * 9)], [0.8, 1.0, 0.9, 0.5], 10, true), null, { tint: [1.3, 1.24, 1.08], chunkAt: [rx, rz] });
    g.paint('sand', S.line([[rx - ax * 9, rz - az * 9], [rx + ax * 9, rz + az * 9]], 3.5), { soft: 1.5, noise: 1, nscale: 1.5 });
    for (let k = 0; k < 5; k++) {
      const t = (k + 0.5) / 5 - 0.5, sx = rx + ax * t * 14, sz = rz + az * t * 14, sc = 1 - Math.abs(t) * 0.6;
      for (const s of [-1, 1]) {
        const px = -az * s, pz = ax * s;              // outward (perpendicular to the spine)
        const ctrl = [V(sx, y - 0.2, sz), V(sx + px * 1.6 * sc, y + 3.2 * sc, sz + pz * 1.6 * sc), V(sx + px * 3.4 * sc - ax * 0.4, y + 4.6 * sc, sz + pz * 3.4 * sc - az * 0.4), V(sx + px * 5.2 * sc - ax * 0.8, y + 3.6 * sc, sz + pz * 5.2 * sc - az * 0.8), V(sx + px * 6.2 * sc - ax * 1.0, y - 0.6, sz + pz * 6.2 * sc - az * 1.0)];
        const curve = new THREE.CatmullRomCurve3(ctrl), pts = curve.getPoints(16);
        kit.add('bone', tube(pts, pts.map((_, j) => (0.62 - 0.36 * j / 16) * (0.7 + sc * 0.3)), 9, false), null, { tint: [1.35, 1.28, 1.12], chunkAt: [rx, rz] });
        kit.block(S.circle(ctrl[4].x, ctrl[4].z, 0.55), 0.3);
        g.paint('sand', S.circle(ctrl[4].x, ctrl[4].z, 1.6), { soft: 1.2, noise: 0.6, nscale: 1 });
      }
    }
    kit.block(S.line([[rx - ax * 9, rz - az * 9], [rx + ax * 9, rz + az * 9]], 2.2), 0.3);
  }
  // scattered ruin blocks, a buried stair, boulders
  for (let i = 0; i < 36; i++) {
    const a = rng.range(0, Math.PI * 2), rr = R + rng.range(-1.5, 5), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (z > R - 10 && Math.abs(x) < 9) continue;
    if (rng.chance(0.6)) { const s = rng.range(0.7, 1.6); kit.add('stone', box(1.6 * s, 0.9 * s, 1.1 * s, 1), M(x, H(x, z) + 0.2 * s, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3)), { tint: rng.chance(0.5) ? SANDSTONE : SANDSTONE_D }); if (s > 1.1) kit.block(S.circle(x, z, 1.1 * s), 0.3); }
    else boulder(kit, x, H(x, z), z, { s: rng.range(0.6, 1.6), seed: rng.int(0, 999), tint: 0xb8845a, flat: 0.55 });
  }
  for (let k = 0; k < 6; k++) kit.add('stone', box(8 - k * 0.2, 0.5, 1.2, 2), M(-8, H(-8, -33) - 0.3 + k * 0.28 - 1.1, -33 - k * 0.9, 0.05), { tint: SANDSTONE, ao: false });
  // expedition camp by the southern approach: a shade awning, crates, water barrels
  { const cx = -10, cz = R - 3.5, y = H(cx, cz);
    for (const [dx, dz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) kit.add('timber', cyl(0.07, 0.08, 2.8, 6, 1), M(cx + dx, y + 1.4, cz + dz), { ao: false });
    const aw = new THREE.PlaneGeometry(4.6, 3.8, 6, 4); aw.rotateX(-Math.PI / 2);
    const p = aw.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, -Math.abs(p.getX(k)) * 0.12 + Math.sin(p.getZ(k) * 1.4) * 0.08);
    aw.computeVertexNormals();
    kit.add('cloth', aw, M(cx, y + 2.85, cz), { tint: 0xd8c4a0, ao: false });
    for (let i = 0; i < 6; i++) kit.add('cloth', box(4.6 / 6, 0.02, 0.35, 1), M(cx - 2.3 + (i + 0.5) * 4.6 / 6, y + 2.72, cz + 1.95), { tint: i % 2 ? 0xb04a2a : 0xe8d8b8, ao: false, cast: false });
    P.crateStack(kit, cx + 3.6, y, cz - 0.5, 0.2, 5); P.barrel(kit, cx - 3.4, y, cz - 0.8, 1); P.barrel(kit, cx - 3.2, y, cz + 0.2, 0.9); P.sack(kit, cx - 1, y, cz + 1.2, 1, 0.5);
    for (const [dx, dz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) kit.block(S.circle(cx + dx, cz + dz, 0.15), 0.25);
    kit.add('metal', cyl(0.06, 0.08, 4.4, 6, 1), M(cx + 5.2, y + 2.2, cz + 1.5), { tint: 0x2a2a2e, ao: false });
    flags.add(M(cx + 5.26, y + 4.2, cz + 1.5), 1.6, 1.0, 0x2a5aa8, { hang: 'left', segs: 8 });
    kit.block(S.circle(cx + 5.2, cz + 1.5, 0.2), 0.25);
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.3), { soft: 2.2, amount: 0.22 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  await tick();

  // ---------------------------------------------------------------- wind, sand, decals
  const streams = [];
  for (let i = 0; i < 14; i++) { const z0 = rng.range(-30, 30), x0 = -R - 4 + rng.range(-4, 4); streams.push({ a: [x0, z0], b: [x0 + rng.range(34, 60), z0 + rng.range(4, 14)], w: rng.range(2.2, 4.5) }); }
  zone.root.add(buildStreamers(streams, H, { color: 0xf4dcae, alpha: 0.42, speed: 1.1 }));
  zone.root.add(buildHaze(Array.from({ length: 12 }, (_, i) => { const a = Math.PI * (1.1 + i / 11 * 0.8); return { x: Math.cos(a) * (R + 3), y: H(Math.cos(a) * (R + 3), Math.sin(a) * (R + 3)), z: Math.sin(a) * (R + 3), w: 9, h: 4 }; }), { color: 0xfff0d0, alpha: 0.05 }));
  const dec = new Decals(H);
  for (let i = 0; i < 22; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(4, R - 2); dec.add(rng.pick(['pebbles', 'cracks', 'stain', 'rubble']), Math.cos(a) * rr, Math.sin(a) * rr, { size: rng.range(1.5, 3.2), alpha: 0.55, tint: 0xf0d8b0 }); }
  for (let i = 0; i < 10; i++) { const a = rng.range(0, Math.PI * 2), rr = rng.range(8, R - 3); dec.add('rubble', Math.cos(a) * rr, Math.sin(a) * rr, { size: rng.range(1, 2), alpha: 0.7, tint: 0xf4e6cc }); }
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const pool = new LightPool(zone.root, kit.lights, 2);
  const sand = buildParticles('sand', { quality, count: 700 });
  const dust = buildParticles('dust', { quality, count: 160, color: [1.3, 1.15, 0.9] });
  zone.root.add(sand, dust);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); sand.userData.update(focus); dust.userData.update(focus); });

  // ---------------------------------------------------------------- nav & anchors
  const nav = new NavGrid(-R - 2, -R - 2, 2 * R + 4, 2 * R + 12, 0.5);
  nav.walk(S.circle(0, 0, R - 1.3));
  nav.walk(S.rect(0, R + 2, 12, 8));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 28]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 28.5, 0);
  zone.anchor('boss', 0, -6, Math.PI);
  zone.anchor('camp', -8.5, 30.5, faceTo(-8.5, 30.5, 0, 0));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Sunscar Basin', 0, 0, R);
  zone.env = makeEnv('desert', { music: 'guardian_sand', ambience: 'desert_wind' });
  zone.envs = { desert: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 6, z0: -R - 6, size: 2 * R + 12 } });
}
