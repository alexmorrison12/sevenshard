// 'inferno' — Inferno Descent floor (roguelite): an obsidian platform in a lava sea. The layout is randomised by
// opts.seed — platform outline, basalt column clusters, inner lava pools, rubble and mob points all change per floor
// (buildZone('inferno', { seed: floorNumber })). Anchors: spawn (south), exit (fire gate, north), boss, boon (centre),
// spawn:m1…m10.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, buildRiftPortal } from '../fx.js';
import { boulder, spike, cliffRing } from '../cliffs.js';
import { buildLava } from '../water.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, smoothstep } from '../../core/noise.js';

export async function build(zone, { quality = 1 } = {}) {
  const seed = zone.opts.seed ?? 1;
  const rng = new RNG(seed * 7919 + 17), nz = new Simplex(seed * 31 + 5);
  const RX = rng.range(24, 28), RZ = rng.range(22, 26);
  const poly = [];
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; const k = 1 + nz.noise2(Math.cos(a) * 1.4, Math.sin(a) * 1.4) * 0.14 + nz.noise2(Math.cos(a) * 4, Math.sin(a) * 4) * 0.05; poly.push([Math.cos(a) * RX * k, Math.sin(a) * RZ * k]); }
  const plat = S.poly(poly);
  zone.bounds = { x0: -RX, z0: -RZ, x1: RX, z1: RZ };
  const g = zone.ground = new Ground({ x0: -85, z0: -90, w: 170, d: 175, res: 1, layers: ['obsidian', 'rock', 'gravel', 'dirt', 'bloodstone'], base: 'rock', seed: seed + 3 });
  g.tint.setRGB(0.82, 0.76, 0.74);
  g.emitColor.setRGB(1.9, 0.5, 0.1);
  // inner lava pools (random), kept away from spawn / exit / centre
  const pools = [];
  for (let i = 0; i < rng.int(1, 3); i++) {
    for (let t = 0; t < 20; t++) {
      const x = rng.range(-RX + 8, RX - 8), z = rng.range(-RZ + 8, RZ - 8), r = rng.range(2.5, 4.5);
      if (Math.hypot(x, z - (RZ - 5)) < 10 || Math.hypot(x, z + RZ - 5) < 9 || Math.hypot(x, z) < 7 || pools.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 4)) continue;
      pools.push({ x, z, r }); break;
    }
  }
  g.sculpt((x, z) => {
    const d = plat.sd(x, z);
    let h = 0.1 + nz.noise2(x / 8, z / 8) * 0.15;
    if (d > -2) h -= smoothstep(-2, 1.5, d) * 3.2;
    for (const p of pools) { const dp = Math.hypot(x - p.x, z - p.z) - p.r; if (dp < 1.5) h = Math.min(h, -1.8 + smoothstep(-1, 1.5, dp) * 1.9); }
    if (d > 6) h = -3 + nz.noise2(x / 20, z / 20) * 0.5;
    return h;
  });
  g.paint('obsidian', plat, { soft: 1.2, noise: 1.2, nscale: 2 });
  for (let i = 0; i < 8; i++) g.paint(rng.pick(['gravel', 'dirt', 'bloodstone']), S.circle(rng.range(-RX + 4, RX - 4), rng.range(-RZ + 4, RZ - 4), rng.range(2, 4.5)), { soft: 2, noise: 1.8, nscale: 2, amount: 0.7 });
  g.info('glow', S.subtract(S.inflate(plat, 1.5), S.inflate(plat, -1.2)), { soft: 1.5, noise: 1, nscale: 2, amount: 0.6 });
  for (const p of pools) g.info('glow', S.ring(p.x, p.z, p.r + 0.5, 2), { soft: 1, amount: 0.7 });

  const kit = new Kit({ seed: seed + 9 });
  const H = (x, z) => g.heightAt(x, z);
  // basalt column clusters (hexagonal prisms)
  const clusters = [];
  for (let i = 0; i < rng.int(3, 6); i++) {
    for (let t = 0; t < 30; t++) {
      const x = rng.range(-RX + 6, RX - 6), z = rng.range(-RZ + 6, RZ - 6);
      if (Math.hypot(x, z - (RZ - 5)) < 8 || Math.hypot(x, z + RZ - 5) < 8 || Math.hypot(x, z) < 6 || pools.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 3) || clusters.some(c => Math.hypot(c[0] - x, c[1] - z) < 8)) continue;
      clusters.push([x, z]); break;
    }
  }
  for (const [cx, cz] of clusters) {
    const n = rng.int(4, 8);
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2), d = k ? rng.range(0.9, 2.2) : 0, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const h = rng.range(1.5, 6.5), r = rng.range(0.55, 0.85);
      kit.add('darkrock', cyl(r, r * 1.05, h, 6, 1), M(x, H(x, z) + h / 2 - 0.3, z, rng.range(0, 1)), { tint: 0x3a3232, yGround: H(x, z), aoH: 2 });
      kit.add('dark', cyl(r * 0.96, r * 0.96, 0.08, 6, 1), M(x, H(x, z) + h - 0.28, z, rng.range(0, 1)), { tint: 0x6a5050, ao: false });
      kit.block(S.circle(x, z, r + 0.05), 0.3);
    }
  }
  // lava pools' crusted rims, vents with spikes, braziers, rubble
  for (const p of pools) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + rng.range(-0.2, 0.2); boulder(kit, p.x + Math.cos(a) * (p.r + 0.8), H(p.x + Math.cos(a) * (p.r + 0.8), p.z + Math.sin(a) * (p.r + 0.8)), p.z + Math.sin(a) * (p.r + 0.8), { s: rng.range(0.4, 0.8), seed: k + seed, tint: 0x3a3030, mat: 'darkrock' }); }
  for (let i = 0; i < 5; i++) { const x = rng.range(-RX + 5, RX - 5), z = rng.range(-RZ + 5, RZ - 5); if (Math.hypot(x, z - (RZ - 5)) < 7 || Math.hypot(x, z + RZ - 5) < 7) continue; spike(kit, x, H(x, z), z, { h: rng.range(2, 3.8), r: 0.4, bend: 0.8, dir: rng.range(0, 6), mat: 'dark' }); }
  for (const [x, z] of [[-6, RZ - 7], [6, RZ - 7], [-7, -RZ + 8], [7, -RZ + 8]]) P.brazier(kit, x, H(x, z), z, { s: 0.9, base: 'dark' });
  for (let k = 0; k < poly.length; k++) { if (rng.chance(0.5)) continue; const [px, pz] = poly[k]; const L = Math.hypot(px, pz); const bx = px * (1 - 0.8 / L), bz = pz * (1 - 0.8 / L); boulder(kit, bx, H(bx, bz), bz, { s: rng.range(0.7, 1.5), seed: k * 3 + seed, tint: 0x3a3030, mat: 'darkrock', flat: 0.55 }); }
  // the fire gate (exit) in the north
  const ez = -RZ + 4.5;
  for (const s of [-1, 1]) { kit.add('dark', cyl(0.9, 1.2, 7, 6, 1), M(s * 3.4, H(s * 3.4, ez) + 3.3, ez), { tint: 0x6a5050 }); spike(kit, s * 3.4, H(s * 3.4, ez) + 6.8, ez, { h: 2.4, r: 0.5, bend: 1.2, dir: s > 0 ? 0 : Math.PI, mat: 'dark', block: false }); kit.block(S.circle(s * 3.4, ez, 1.2), 0.3); }
  kit.light(0, 3, ez + 1, 0xff7a20, 8, 14, 0.2);
  // distant volcanic crags ringing the lava sea (north half only; the camera's backdrop)
  cliffRing(kit, Array.from({ length: 20 }, (_, i) => { const a = -Math.PI * 1.1 + i / 19 * Math.PI * 1.2; return [Math.cos(a) * 66, Math.sin(a) * 62]; }), H, { height: 24, thick: 10, seed: seed + 2, tint: 0x3a2e2c, strata: 0x241c1a, inside: [0, 0], closed: false, lean: 0.25, jag: 4, mat: 'darkrock' });
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.6, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  zone.root.add(buildLava({ x: 0, z: 0, w: 170, d: 175, level: -0.75 }));
  zone.root.add(buildRiftPortal({ x: 0, y: H(0, ez) + 0.2, z: ez, r: 2.5, c1: 0x8a1a00, c2: 0xff8a20, c3: 0xfff0c0 }));
  const dec = new Decals(H);
  for (let i = 0; i < 26; i++) { const x = rng.range(-RX, RX), z = rng.range(-RZ, RZ); if (plat.sd(x, z) > -2) continue; dec.add(rng.pick(['cracks', 'scorch', 'rubble', 'fissure', 'stain']), x, z, { size: rng.range(1.5, 3.5), alpha: 0.8, tint: 0xff9a60, emit: 0xff5a10, emitI: 0.9 }); }
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const emb = buildParticles('embers', { quality, count: 300 });
  const ash = buildParticles('ash', { quality, count: 200, color: [0.22, 0.2, 0.2] });
  zone.root.add(emb, ash);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); emb.userData.update(focus); ash.userData.update(focus); if (g.uniforms) g.uniforms.uEmitPulse.value = 0.8 + 0.2 * Math.sin(t * 1.4); });
  const nav = new NavGrid(-RX - 6, -RZ - 6, 2 * RX + 12, 2 * RZ + 12, 0.5).walk(S.inflate(plat, -1.6));
  for (const p of pools) nav.block(S.circle(p.x, p.z, p.r + 0.4), 0.3);
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, RZ - 5]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, RZ - 5, 0);
  zone.anchor('exit', 0, ez + 2.2, 0);
  zone.anchor('boss', 0, -4, Math.PI);
  zone.anchor('boon', 0, 3, 0);
  let n = 0, guard = 0;
  while (n < 10 && guard++ < 600) {
    const x = rng.range(-RX + 4, RX - 4), z = rng.range(-RZ + 5, RZ - 9);
    if (!nav.walkable(x, z) || Math.hypot(x, z - (RZ - 5)) < 9) continue;
    if (Object.keys(zone.anchors).some(k => k.startsWith('spawn:m') && Math.hypot(zone.anchors[k].x - x, zone.anchors[k].z - z) < 5)) continue;
    zone.anchor(`spawn:m${++n}`, x, z, faceTo(x, z, 0, RZ - 5));
  }
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 6); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Inferno Descent', 0, 0, Math.max(RX, RZ));
  zone.env = makeEnv('volcanic', { music: 'inferno', ambience: 'lava' });
  zone.envs = { volcanic: zone.env };
  zone.minimap = paintMinimap(zone, { px: 320, area: { x0: -RX - 6, z0: -RZ - 6, size: 2 * Math.max(RX, RZ) + 12 } });
}
