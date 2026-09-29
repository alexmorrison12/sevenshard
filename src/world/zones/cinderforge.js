// 'cinderforge' — Cinderhorn's volcanic caldera (~64 m). A shelf of cracked columnar basalt with glowing lava seams,
// ending in the north at a broken lip over a molten lake; lava falls pour from the caldera wall just beyond it (the
// camera looks down into the glowing gorge whenever the fight drifts north). Obsidian spires and basalt organ-pipe
// columns ring the rim, ash falls, embers rise, smoke plumes climb into a dark sky. The hunters' camp sits by the
// southern entrance.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { cliffRing, boulder, spike } from '../cliffs.js';
import { buildLava } from '../water.js';
import { buildLavaFalls, buildPlumes, buildHaze } from '../arenas.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, catmull, smoothstep, lerp } from '../../core/noise.js';
import { blob, tube } from '../../engine/geom.js';

const R = 30;                       // floor radius (walkable ≈ 28.5)
const LAVA = -6.2;                  // molten lake level
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 44);
  const N = new Simplex(91);
  // the north lip of the shelf (z of the edge for a given x), curving back at the sides
  const lipZ = x => -19.5 - Math.pow(Math.abs(x) / 17, 2) * 4.5 + N.noise2(x / 6, 3.3) * 1.2;
  zone.bounds = { x0: -R, z0: -24, x1: R, z1: R };
  const g = zone.ground = new Ground({ x0: -90, z0: -100, w: 180, d: 190, res: 1, layers: ['basalt', 'cinder', 'obsidian', 'rock', 'gravel', 'dirt'], base: 'cinder', seed: 7 });
  g.emitColor.setRGB(2.4, 0.78, 0.16);
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z * 1.02);
    let h = N.noise2(x / 13, z / 13) * 0.45 + N.noise2(x / 5, z / 5) * 0.12 + N.noise2(x / 2.2, z / 2.2) * 0.04;
    // caldera wall rising beyond the floor (east / west / south-side shoulders)
    if (r > R + 1) h = lerp(h, 1.2 + (r - R - 1) * 0.9 + N.noise2(x / 11, z / 11) * 1.5, smoothstep(R + 1, R + 5, r));
    // south entrance: a gentle ramp out through the gap in the rim
    const gate = smoothstep(9, 4, Math.abs(x)) * smoothstep(R - 4, R + 2, z);
    h = lerp(h, 0.4 + Math.max(0, z - R) * 0.06, gate);
    // the molten gorge in the north: the shelf breaks off at the lip
    const lz = lipZ(x);
    if (z < lz + 1) h = lerp(h, LAVA - 2.2, smoothstep(lz + 1, lz - 2.4, z));
    // far north: the caldera wall behind the lake
    if (z < -31) h = lerp(h, 4 + (-31 - z) * 1.1, smoothstep(-31, -36, z));
    return h;
  });

  // ---------------------------------------------------------------- paint
  const floor = S.circle(0, 0, R + 0.5);
  g.paint('basalt', floor, { soft: 3, noise: 3, nscale: 6 });
  for (let i = 0; i < 12; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(8, R - 2); g.paint('cinder', S.circle(Math.cos(a) * r, Math.sin(a) * r, rng.range(2.5, 5)), { soft: 2.5, noise: 2, nscale: 3, amount: 0.8 }); }
  for (let i = 0; i < 7; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(4, R - 4); g.paint('obsidian', S.circle(Math.cos(a) * r, Math.sin(a) * r, rng.range(1.8, 3.4)), { soft: 1.5, noise: 1.4, nscale: 2, amount: 0.9 }); }
  g.paint('cinder', S.line([[0, R + 16], [0, R - 4]], 7), { soft: 2, noise: 1.5, nscale: 2, amount: 0.7 });
  for (let i = 0; i < 5; i++) { const x0 = rng.range(-24, 24); g.paint('obsidian', S.line([[x0, lipZ(x0) + 1], [x0 + rng.range(-6, 6), lipZ(x0) + rng.range(8, 16)], [x0 + rng.range(-8, 8), lipZ(x0) + rng.range(16, 26)]], rng.range(1.6, 2.8)), { soft: 1.2, noise: 1, nscale: 2, amount: 0.8 }); }
  g.paint('rock', S.subtract(S.circle(0, -10, 95), S.circle(0, 0, R + 2)), { soft: 4, noise: 3, nscale: 5, amount: 0.9 });
  // hot glow pooled along the lip and around the seams
  g.info('glow', S.line(Array.from({ length: 13 }, (_, i) => { const x = -30 + i * 5; return [x, lipZ(x) + 1.2]; }), 3.2), { soft: 3, noise: 1.5, nscale: 2, amount: 0.55 });
  g.info('ao', S.ring(0, 0, R + 1, 4), { soft: 3, amount: 0.3 });

  // ---------------------------------------------------------------- the caldera wall, lip face, falls
  const kit = new Kit({ seed: 61 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const wall = catmull([[-19, 29], [-31, 15], [-35, -2], [-36, -18], [-40, -30], [-24, -37], [0, -39], [24, -37], [40, -30], [36, -18], [35, -2], [31, 15], [19, 29]], 5);
  cliffRing(kit, wall, (x, z) => Math.min(H(x, z), 2), {
    heightFn: (x, z) => z < -28 ? 22 : 9 + smoothstep(20, -20, z) * 9, thick: 9, seed: 5,
    tint: 0x3a2e2c, strata: 0x6a2a18, top: 0x1c1616, inside: [0, -6], closed: false, lean: 0.22, jag: 3.2, step: 1.7, mat: 'darkrock',
  });
  // the shelf's broken lip: chunks of basalt tumbling into the lava, glowing drips
  for (let i = 0; i < 40; i++) {
    const x = -32 + i * 64 / 39 + rng.range(-0.8, 0.8), lz = lipZ(x);
    boulder(kit, x, rng.range(-1.6, -0.5), lz - rng.range(0.3, 1.6), { s: rng.range(0.45, 1.05), seed: i + 100, tint: 0x4a4040, mat: 'darkrock', flat: 0.8, block: false });
    if (i % 3 === 0) kit.glow(new THREE.ConeGeometry(0.1, rng.range(0.9, 1.8), 5), M(x + 0.3, -1.3, lz - 1.0, 0, 1, 1, 1, Math.PI), 0xff8a24, 2.2);
  }
  const falls = [];
  for (const [fx, w] of [[-21, 2.2], [-4, 3.0], [15, 2.4], [29, 1.8]]) {
    const fz = -35.5 + Math.abs(fx) * 0.08;
    falls.push({ x: fx, z: fz, top: 19 + rng.range(-2, 2), bottom: LAVA - 0.2, w, dir: Math.PI });
    kit.light(fx, LAVA + 1.5, fz + 3, 0xff6a20, 14, 18, 0.2);
  }
  // obsidian spires and basalt organ columns around the rim
  const spireCluster = (x, z, s) => {
    const y = H(x, z);
    for (let i = 0; i < 5; i++) {
      const gg = new THREE.OctahedronGeometry(0.6, 0); gg.scale(0.55, 4.2, 0.5);
      const a = rng.range(0, Math.PI * 2), d = i ? rng.range(0.6, 1.6) * s : 0, sc = (i ? rng.range(0.45, 0.8) : 1.15) * s;
      kit.add('obsidian', gg, M(x + Math.cos(a) * d, y + 1.9 * sc, z + Math.sin(a) * d, rng.range(0, 6), sc, sc, sc, rng.range(-0.25, 0.25), rng.range(-0.25, 0.25)), { tint: 0x3a2e44 });
    }
    kit.block(S.circle(x, z, 1.4 * s), 0.3);
  };
  const organ = (x, z, s, n = 7) => {
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2), d = k ? rng.range(0.8, 2.1) * s : 0, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const hh = rng.range(1.4, 5.5) * s, r = rng.range(0.5, 0.8) * s, y = H(px, pz);
      kit.add('darkrock', cyl(r, r * 1.04, hh, 6, 1), M(px, y + hh / 2 - 0.3, pz, rng.range(0, 1)), { tint: 0x6a5a56, yGround: y, aoH: 2 });
      kit.add('dark', cyl(r * 0.96, r * 0.96, 0.1, 6, 1), M(px, y + hh - 0.25, pz, rng.range(0, 1)), { tint: 0x7a6a66, ao: false });
      kit.block(S.circle(px, pz, r + 0.05), 0.3);
    }
  };
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.64 + i / 15 * 1.72) + rng.range(-0.05, 0.05);
    const rr = R + rng.range(0.5, 3.5), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (z < lipZ(x) + 2) continue;
    if (i % 2) spireCluster(x, z, rng.range(0.9, 1.5)); else organ(x, z, rng.range(0.8, 1.2));
  }
  for (const [x, z] of [[-9.5, R - 2], [9.5, R - 2]]) spireCluster(x, z, 1.5);       // entrance sentinels
  for (const [x, z] of [[-22, -12], [23, -9], [-25, 10], [24, 14]]) organ(x, z, 1.0, 5);
  // rim boulders
  for (let i = 0; i < 26; i++) { const a = rng.range(0, Math.PI * 2), rr = R + rng.range(-1, 2.5), x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (z < lipZ(x) + 1.5 || (z > R - 6 && Math.abs(x) < 7)) continue; boulder(kit, x, H(x, z), z, { s: rng.range(0.6, 1.5), seed: rng.int(0, 999), tint: 0x2e2626, mat: 'darkrock', flat: 0.6 }); }
  organ(-19, 3, 1.25, 8); spireCluster(-15.5, -2, 1.1);
  // hunters' camp by the southern entrance
  { const cx = -11, cz = R - 6.5;
    P.crateStack(kit, cx - 1.5, H(cx - 1.5, cz + 1), cz + 1, 0.4, 3);
    P.weaponRack(kit, cx + 2, H(cx + 2, cz + 2.4), cz + 2.4, -0.3);
    P.barrel(kit, cx - 3, H(cx - 3, cz - 1), cz - 1, 1);
    kit.add('metal', cyl(0.07, 0.09, 5, 6, 1), M(cx + 3.5, H(cx + 3.5, cz - 0.5) + 2.5, cz - 0.5), { tint: 0x2a2a2e, ao: false });
    flags.add(M(cx + 3.56, H(cx + 3.5, cz - 0.5) + 4.8, cz - 0.5), 1.8, 1.1, 0x2a5aa8, { hang: 'left', segs: 8 });
    kit.block(S.circle(cx + 3.5, cz - 0.5, 0.2), 0.25);
    P.brazier(kit, cx + 0.5, H(cx + 0.5, cz - 2), cz - 2, { s: 0.8 });
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  await tick();

  // ---------------------------------------------------------------- lava, falls, smoke, haze
  zone.root.add(buildLava({ x: 0, z: -34, w: 110, d: 40, level: LAVA, hot: 0xff6a18, cool: 0xff2a00 }));
  zone.root.add(buildLavaFalls(falls));
  for (let i = 0; i < 9; i++) { const x = -32 + i * 8, z = lipZ(x) - 3; kit.lights.push({ x, y: LAVA + 1.2, z, color: 0xff5a18, intensity: 10, radius: 13, flicker: 0.25 }); }
  const plumes = [];
  for (let i = 0; i < 7; i++) plumes.push({ x: -36 + i * 12 + rng.range(-3, 3), y: LAVA + 1, z: -30 + rng.range(-3, 2), h: rng.range(22, 34), r: rng.range(4, 7) });
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.7 + i * 0.4), rr = R + 12; plumes.push({ x: Math.cos(a) * rr, y: 8, z: Math.sin(a) * rr, h: 28, r: 6 }); }
  zone.root.add(buildPlumes(plumes, { color: 0x1c1616, alpha: 0.5 }));
  zone.root.add(buildHaze(Array.from({ length: 10 }, (_, i) => ({ x: -30 + i * 6.5 + rng.range(-1, 1), y: LAVA + 0.3, z: lipZ(-30 + i * 6.5) - 4.5 + rng.range(-1.5, 1.5), w: rng.range(5, 8), h: rng.range(5, 8) })), { alpha: 0.16 }));

  // ---------------------------------------------------------------- decals
  const dec = new Decals(H);
  for (let i = 0; i < 16; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(3, R - 3); dec.add('fissure', Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(3.5, 7), sz: 0.4, rot: rng.range(0, 6), tint: 0xffb070, emit: 0xff7a18, emitI: 2.0, alpha: 0.95 }); }
  for (let i = 0; i < 30; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(2, R - 1); dec.add(rng.pick(['scorch', 'scorch', 'cracks', 'rubble', 'stain']), Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(1.5, 3.8), alpha: 0.85 }); }
  for (let i = 0; i < 8; i++) { const x = rng.range(-6, 6), z = rng.range(-12, 4); dec.add('blood', x, z, { size: rng.range(1, 2), alpha: 0.5, tint: 0x6a4030 }); }
  const dm = dec.build(); if (dm) zone.root.add(dm);
  // fallen hunters' weapons stuck in the floor
  const kit2 = new Kit({ seed: 62 });
  for (let i = 0; i < 9; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(10, R - 3), x = Math.cos(a) * r, z = Math.sin(a) * r; kit2.add('metal', box(0.1, 1.6, 0.03, 1), M(x, H(x, z) + 0.55, z, rng.range(0, 6), 1, 1, 1, rng.range(-0.4, 0.4), rng.range(0.2, 0.6)), { tint: 0x6a6a74, ao: false }); }
  kit2.build(zone.root);

  // ---------------------------------------------------------------- fx
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const embers = buildParticles('embers', { quality, count: 340 });
  const ash = buildParticles('ash', { quality, count: 380, color: [0.2, 0.18, 0.17] });
  zone.root.add(embers, ash);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); embers.userData.update(focus); ash.userData.update(focus); if (g.uniforms) g.uniforms.uEmitPulse.value = 0.82 + 0.18 * Math.sin(t * 1.2); });

  // ---------------------------------------------------------------- nav & anchors
  const nav = new NavGrid(-R - 2, -30, 2 * R + 4, 2 * R + 14, 0.5);
  nav.walk(S.circle(0, 0, R - 1.4));
  nav.walk(S.rect(0, R + 2, 9, 10));
  nav.blockWhere((x, z) => z < lipZ(x) + 1.6);
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 20]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 21, 0);
  zone.anchor('boss', 0, -5, Math.PI);
  zone.anchor('camp', -8.5, 24.5, faceTo(-8.5, 24.5, 0, 0));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Cinderforge', 0, 0, R);
  zone.env = makeEnv('caldera', { music: 'guardian_fire', ambience: 'lava' });
  zone.envs = { caldera: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 6, z0: -R - 6, size: 2 * R + 12 }, water: [{ shape: { poly: [[-40, -24], [40, -24], [40, -40], [-40, -40]] }, color: '#c8401a' }] });
}
