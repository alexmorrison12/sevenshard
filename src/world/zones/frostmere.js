// 'frostmere' — Guardian arena of Rimewing, the ice wyvern: a frozen lake bowl ~70 m across. Glossy cracked ice in
// the middle, wind-carved snow banks, towering ice cliffs with frozen waterfalls to the north (the camera's
// backdrop), low snowy slopes and the approach path to the south, snow-laden pines, ice shards, aurora light.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, cone, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles } from '../fx.js';
import { cliffRing, boulder } from '../cliffs.js';
import { Flora, Grass } from '../foliage.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, clamp, smoothstep, lerp } from '../../core/noise.js';
import { tube, blob, linColor } from '../../engine/geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LAKE = 30;           // ice radius
const RIM = 40;            // where the bowl wall starts

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 21);
  zone.bounds = { x0: -36, z0: -34, x1: 36, z1: 36 };
  const g = zone.ground = new Ground({ x0: -110, z0: -120, w: 220, d: 230, res: 1, layers: ['snow', 'ice', 'rock', 'gravel', 'dirt', 'moss'], base: 'snow', seed: 17 });
  g.tint.setRGB(0.93, 0.97, 1.04);
  const N = new Simplex(41);
  // bowl: flat lake, snow banks rising to the rim; the north rim is a high cliff shelf, the south opens to the approach
  const rimR = (x, z) => RIM + N.noise2(Math.atan2(z, x) * 1.3, 3.1) * 3.5;
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z * 1.05);
    const R = rimR(x, z);
    let h = -0.35 + N.noise2(x / 9, z / 9) * 0.05;
    if (r > LAKE) h = lerp(h, 0.35 + N.noise2(x / 6, z / 6) * 0.35 + N.noise2(x / 17, z / 17) * 0.6, smoothstep(LAKE, LAKE + 3, r));
    // drifts along the shore
    h += smoothstep(LAKE + 1, LAKE + 7, r) * (1.2 + N.noise2(x / 5, z / 5) * 0.9) * smoothstep(R + 4, R - 2, r);
    // north: cliff shelf (the cliff mesh covers the step); south: a gentle open slope toward the approach path
    const north = smoothstep(-0.2, -0.6, z / (r + 1e-3));
    if (r > R) h = lerp(h, 3 + (r - R) * (0.25 + north * 0.9) + north * 14, smoothstep(R, R + 5, r));
    // approach path (south): a snowy trough
    const path = smoothstep(7, 3, Math.abs(x + Math.sin(z * 0.08) * 3)) * smoothstep(LAKE + 2, LAKE + 10, z);
    h = lerp(h, 0.6 + (z - LAKE) * 0.05, path * 0.85);
    return h;
  });

  // ---------------------------------------------------------------- paint
  g.paint('ice', S.circle(0, 0, LAKE + 0.8), { soft: 2.2, noise: 1.6, nscale: 3 });
  for (let i = 0; i < 12; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(LAKE - 3, LAKE + 1); g.paint('snow', S.circle(Math.cos(a) * r, Math.sin(a) * r, rng.range(2, 4.5)), { soft: 2.5, noise: 1.5, nscale: 2 }); }
  for (let i = 0; i < 9; i++) g.paint('snow', S.circle(rng.range(-22, 22), rng.range(-20, 22), rng.range(1.2, 3.2)), { soft: 2, noise: 1.2, nscale: 1.6, amount: 0.8 });
  g.paint('rock', S.subtract(S.circle(0, -6, 80), S.circle(0, 0, RIM + 1)), { soft: 6, noise: 5, nscale: 6, amount: 0.55 });
  g.paint('gravel', S.line([[0, 30], [3, 45], [-2, 62], [2, 90]], 4), { soft: 2, noise: 1.2, nscale: 2, amount: 0.55 });
  for (let i = 0; i < 16; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(LAKE + 4, RIM + 6); g.paint('dirt', S.circle(Math.cos(a) * r, Math.sin(a) * r, rng.range(0.8, 2)), { soft: 1.5, noise: 1, nscale: 1.2, amount: 0.6 }); }
  // glossy ice (spec) and aurora reflections streaking across it (glow channel)
  g.info('wet', S.circle(0, 0, LAKE - 1), { soft: 4, noise: 2, nscale: 5, amount: 0.8 });
  for (let i = 0; i < 5; i++) { const z = -18 + i * 8 + rng.range(-2, 2); g.info('glow', S.line([[-LAKE, z + rng.range(-6, 6)], [0, z], [LAKE, z + rng.range(-6, 6)]], rng.range(2.5, 5)), { soft: 4, noise: 2.5, nscale: 5, amount: rng.range(0.25, 0.5) }); }
  g.info('wear', S.line([[0, 36], [0, 22]], 3), { soft: 2, amount: 0.4 });
  for (let i = 0; i < 10; i++) { const x = rng.range(-26, 26), z = rng.range(33, 52); g.paint('gravel', S.circle(x, z, rng.range(1.2, 2.6)), { soft: 2, noise: 1.5, nscale: 2, amount: 0.5 }); }

  // ---------------------------------------------------------------- cliffs, frozen falls, ice shards
  const kit = new Kit({ seed: 51 });
  const H = (x, z) => g.heightAt(x, z);
  // the bowl wall: tall ice cliffs to the north, stepping down around the sides, open to the south
  const wallPts = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI * (0.62 + i / 28 * 1.76);            // from south-west, round the north, to south-east
    const R = rimR(Math.cos(a), Math.sin(a)) + 1.5;
    wallPts.push([Math.cos(a) * R, Math.sin(a) * R * 0.97]);
  }
  const hAtWall = (x, z) => Math.min(H(x, z), 2.5);
  cliffRing(kit, wallPts, hAtWall, { height: 16, thick: 9, seed: 7, tint: 0xe8f4ff, strata: 0xa8c8ec, top: 0xffffff, inside: [0, 0], closed: false, lean: 0.28, jag: 2.4, step: 1.6 });
  // an inner, lower tier of ice ledges in front of the wall (depth)
  const ledge = wallPts.filter((_, i) => i > 5 && i < 23).map(([x, z]) => { const L = Math.hypot(x, z); return [x / L * (L - 4.5), z / L * (L - 4.5)]; });
  cliffRing(kit, ledge, hAtWall, { height: 5, thick: 4, seed: 9, tint: 0xf0f8ff, strata: 0xb4d4f4, top: 0xffffff, inside: [0, 0], closed: false, lean: 0.3, jag: 1.2, step: 1.4 });
  // frozen waterfalls pouring down the north cliff face
  const falls = [];
  for (const a of [-2.05, -1.62, -1.12]) {
    const R = rimR(Math.cos(a), Math.sin(a)) - 2.2;
    const fx = Math.cos(a) * R, fz = Math.sin(a) * R * 0.97;
    falls.push([fx, fz, a]);
    const w = rng.range(4, 6.5), top = 19 + rng.range(-2, 2);
    for (let k = 0; k < 9; k++) {
      const u = (k / 8 - 0.5) * w, ox = -Math.sin(a) * u, oz = Math.cos(a) * u;
      const pts = [], radii = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8, y = top * (1 - t) + 0.2;
        const out = 1.2 + Math.sin(t * Math.PI) * 1.8 + (t > 0.8 ? (t - 0.8) * 10 : 0);
        pts.push(V(fx + ox + Math.cos(a) * -out + rng.range(-0.15, 0.15), y, fz + oz + Math.sin(a) * -out + rng.range(-0.15, 0.15)));
        radii.push((0.45 + rng.range(0, 0.35)) * (1 + (t > 0.85 ? (t - 0.85) * 4 : 0)));
      }
      kit.add('ice', tube(pts, radii, 7, true), null, { tint: (p) => { const t = clamp(p.y / top, 0, 1); return [lerp(0.55, 0.85, t), lerp(0.8, 0.95, t), 1.0]; }, chunkAt: [fx, fz] });
    }
    // glow at the foot of the fall + icicle spray
    kit.glow(blob(1.6, 1, null, [1.6, 0.35, 1.2]), M(fx - Math.cos(a) * 3.4, 0.35, fz - Math.sin(a) * 3.4), 0x9ad8ff, 0.9);
    kit.light(fx - Math.cos(a) * 4, 3, fz - Math.sin(a) * 4, 0x9ad8ff, 5, 12, 0.03);
  }
  // ice shards / crystal spires around the lake
  const shard = (x, z, s, lean = 0.2, dir = 0) => {
    const y = H(x, z);
    for (let i = 0; i < 4; i++) {
      const gg = new THREE.OctahedronGeometry(0.5, 0); gg.scale(0.6, 3.2, 0.6);
      const a = rng.range(0, Math.PI * 2), d = i ? rng.range(0.5, 1.3) * s : 0, sc = (i ? rng.range(0.45, 0.8) : 1.1) * s;
      kit.add('ice', gg, M(x + Math.cos(a) * d, y + 1.2 * sc, z + Math.sin(a) * d, rng.range(0, 6), sc, sc, sc, lean * Math.cos(dir + i), lean * Math.sin(dir + i)), { tint: [0.7, 0.9, 1.15] });
    }
    kit.block(S.circle(x, z, 1.1 * s), 0.3);
  };
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(LAKE + 1.5, RIM - 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 24 && Math.abs(x) < 10) continue;
    shard(x, z, rng.range(0.8, 1.6), rng.range(0.1, 0.35), a);
  }
  for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.9; shard(Math.cos(a) * (LAKE - 5), Math.sin(a) * (LAKE - 5), rng.range(1.4, 2.0), 0.15, a); }
  // snow-capped boulders on the banks
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(LAKE + 1, RIM + 8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 26 && Math.abs(x) < 7) continue;
    boulder(kit, x, H(x, z), z, { s: rng.range(0.6, 1.8), seed: rng.int(0, 999), tint: 0x8a93a4, snow: 0xf4f8ff, flat: 0.6 });
  }
  // broken ice floes piled at the lake edge
  for (let i = 0; i < 22; i++) {
    const a = rng.range(0, Math.PI * 2), r = LAKE + rng.range(-1.5, 0.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 24 && Math.abs(x) < 9) continue;
    kit.add('ice', box(rng.range(1, 2.4), rng.range(0.15, 0.3), rng.range(0.8, 1.8), 1), M(x, H(x, z) + 0.1, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3)), { tint: [0.75, 0.92, 1.1], ao: false });
  }
  // an old warding circle of standing stones by the approach (where the hunters gather)
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.18 + i * 0.16), x = Math.cos(a) * 8 + (i - 2) * 1.2, z = 33 + Math.sin(i * 1.7) * 1.5;
    const y = H(x, z), h = rng.range(1.6, 2.6);
    kit.add('rock', box(0.8, h, 0.5, 1), M(x, y + h / 2 - 0.2, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.08, 0.08)), { tint: 0x8a93a4, yGround: y });
    kit.add('rock', box(0.85, 0.2, 0.55, 1), M(x, y + h - 0.1, z, 0), { tint: 0xf4f8ff, ao: false });
    kit.block(S.circle(x, z, 0.5), 0.25);
  }
  // hunters' camp: tents, a campfire, sled
  { const cx = -9, cz = 34, y = H(cx, cz);
    kit.add('rock', blob(0.3, 0), M(cx, y + 0.05, cz), { tint: 0x6a6a70, cast: false });
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; kit.add('rock', blob(0.22, 0), M(cx + Math.cos(a) * 0.7, y + 0.08, cz + Math.sin(a) * 0.7), { tint: 0x7a7a80, ao: false }); }
    for (let i = 0; i < 4; i++) kit.add('timber', cyl(0.06, 0.06, 1.1, 5, 1), M(cx, y + 0.25, cz, i * 0.8, 1, 1, 1, Math.PI / 2 - 0.3), { ao: false });
    kit.flame(cx, y + 0.35, cz, 0.35); kit.light(cx, y + 1.2, cz, 0xff9a40, 6, 10, 0.3);
    kit.block(S.circle(cx, cz, 0.9), 0.25);
    for (const [tx, tz, r] of [[-13.5, 36.5, 0.4], [-5, 38.5, -0.3]]) {
      const tg = new THREE.ConeGeometry(1.7, 2.6, 6, 1, true); const ty = H(tx, tz);
      kit.add('cloth', tg, M(tx, ty + 1.25, tz, r), { tint: 0x9a3a2a });
      kit.add('cloth', new THREE.ConeGeometry(1.2, 0.5, 6, 1, true), M(tx, ty + 2.35, tz, r), { tint: 0xf4f8ff, ao: false });
      kit.block(S.circle(tx, tz, 1.6), 0.3);
    }
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.22 });
  await tick();
  await g.build(zone.root);
  // aurora reflections on the ice (the glow channel) in teal-green
  g.uniforms.uGlowCol.value.setRGB(0.25, 1.1, 0.8);
  kit.build(zone.root);
  await tick();

  // ---------------------------------------------------------------- pines & frost
  const flora = new Flora();
  for (let i = 0; i < 70; i++) {
    const a = rng.range(Math.PI * 0.55, Math.PI * 2.45), r = rng.range(RIM + 8, RIM + 34);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.05;
    flora.tree('pine', x, H(x, z) - 0.2, z, { s: rng.range(0.9, 1.4), variant: i % 3, opts: { snow: 1, dark: 0x1a3428, light: 0x4a6a5a } });
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-50, 50), z = rng.range(38, 80);
    if (Math.abs(x - Math.sin(z * 0.08) * -3) < 7) continue;
    flora.tree(rng.chance(0.8) ? 'pine' : 'dead', x, H(x, z) - 0.2, z, { s: rng.range(0.8, 1.2), variant: i % 3, opts: { snow: 1, dark: 0x1a3428, light: 0x4a6a5a, tint: 0x9aa0b0 } });
  }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);

  // ---------------------------------------------------------------- decals, fx
  const dec = new Decals(H);
  for (let i = 0; i < 30; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(3, LAKE - 2); dec.add('cracks', Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(2, 5), tint: 0xd8f0ff, alpha: 0.55 }); }
  for (let i = 0; i < 26; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(LAKE - 4, RIM); dec.add('frost', Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(2, 4.5), alpha: 0.8 }); }
  dec.add('runes', 0, -6, { size: 11, rot: 0.4, tint: 0xa8e8ff, emit: 0x5ad0ff, emitI: 0.7, alpha: 0.5 });
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 3);
  const snow = buildParticles('snow', { quality });
  zone.root.add(snow);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); snow.userData.update(focus); });

  // ---------------------------------------------------------------- nav & anchors
  const nav = new NavGrid(-44, -44, 88, 90, 0.5);
  nav.walk(S.circle(0, 0, RIM - 1.5));
  nav.walk(S.rect(0, 40, 14, 12));
  nav.blockWhere((x, z) => { const r = Math.hypot(x, z * 1.05); return r > rimR(x, z) - 1.2 && !(z > 26 && Math.abs(x) < 7); });
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 26]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 27, 0);
  zone.anchor('boss', 0, -6, Math.PI);
  zone.anchor('boss:perch', 0, -RIM - 2, Math.PI, { y: 17 });
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; zone.anchor(`dive:${i + 1}`, Math.cos(a) * 18, Math.sin(a) * 18 - 2, faceTo(Math.cos(a) * 18, Math.sin(a) * 18 - 2, 0, -2)); }
  zone.anchor('camp', -9, 32.2, 0);
  for (const [name, a] of Object.entries(zone.anchors)) {
    if (name === 'boss:perch' || nav.walkable(a.x, a.z)) continue;
    const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); }
  }
  zone.region('Frostmere', 0, 0, LAKE);
  zone.env = makeEnv('frost', { music: 'guardian_frost', ambience: 'blizzard' });
  zone.envs = { frost: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -46, z0: -46, size: 92 } });
}
