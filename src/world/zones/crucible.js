// 'crucible' — the Proving Grounds PvP arena (3v3): a white-marble colosseum at golden hour. Sand floor inside a
// marble ring, four broken columns for line-of-sight play, team daises (south = A / blue, north = B / red),
// spectator stands and banners on the north half, low balustrade and the entry arch to the south.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, cyl, faceTo } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, Flags } from '../fx.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { Flora } from '../foliage.js';
import { RNG, smoothstep } from '../../core/noise.js';

const TAU = Math.PI * 2;
function annulus(r0, r1, a0, a1, seg = 48, tile = 2) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg, c = Math.cos(a), s = Math.sin(a); pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1); uv.push(a * r0 / tile, 0, a * r1 / tile, (r1 - r0) / tile); }
  for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function riser(r, h, a0, a1, seg = 48, tile = 2) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true, Math.PI / 2 - a1, a1 - a0); g.scale(-1, 1, 1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * (a1 - a0) / tile, uv.getY(i) * h / tile);
  g.computeVertexNormals(); return g;
}

export async function build(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 5);
  const R = 21;
  zone.bounds = { x0: -R, z0: -R, x1: R, z1: R };
  const g = zone.ground = new Ground({ x0: -80, z0: -90, w: 160, d: 170, res: 1, layers: ['sand', 'marble', 'flagstone', 'grass', 'gravel', 'cobble'], base: 'grass', seed: 23 });
  g.sculpt((x, z) => { const r = Math.hypot(x, z); return r > R + 2 ? 0.4 + (z < 0 ? smoothstep(R + 2, R + 18, r) * 8 : 0) + g.noise.noise2(x / 14, z / 14) * 0.4 : 0; });
  g.paint('flagstone', S.circle(0, 0, R + 8), { soft: 2, noise: 2, nscale: 4 });
  g.paint('sand', S.circle(0, 0, R + 0.3), { soft: 0.8 });
  g.paint('marble', S.circle(0, 0, 7), { soft: 0.3 });
  g.plaza(0, 0, 6.8, { layer: 'marble', tile: 2.2, rings: [2.6, 6.6], spokes: 6, border: 0.3 });
  for (const z of [R - 5, -R + 5]) { g.paint('marble', S.circle(0, z, 4.2), { soft: 0.3 }); }
  g.info('ao', S.ring(0, 0, R + 0.5, 2.4), { soft: 2, amount: 0.3 });
  g.paint('cobble', S.line([[0, R + 1], [0, R + 40]], 6), { soft: 1 });

  const kit = new Kit({ seed: 13 }), flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  const WR = R + 0.8;
  // marble ring wall: tall north (stands), balustrade south
  kit.add('marble', riser(WR, 3.6, -Math.PI, 0, 64), M(0, 1.8, 0), { tint: 0xf2eee6, yGround: 0, aoH: 2 });
  kit.add('marble', annulus(WR, WR + 1.4, -Math.PI, 0, 64), M(0, 3.62, 0), { tint: 0xfaf7f0, ao: false });
  for (let k = 0; k < 5; k++) {
    const r0 = WR + 1.4 + k * 2.4, hh = 3.6 + k * 1.4;
    kit.add('marble', riser(r0, 1.4, -Math.PI + 0.02, -0.02, 64), M(0, hh + 0.7, 0), { tint: 0xe8e2d6, ao: false });
    kit.add('stone', annulus(r0, r0 + 2.4, -Math.PI + 0.02, -0.02, 64), M(0, hh + 1.4, 0), { tint: 0xd8d0c4, ao: false });
  }
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI + 0.07, x0 = Math.cos(a) * WR, z0 = Math.sin(a) * WR, a2 = a + Math.PI / 22 * 0.86, x1 = Math.cos(a2) * WR, z1 = Math.sin(a2) * WR;
    if (Math.abs((x0 + x1) / 2) < 4) continue;
    P.balustrade(kit, x0, z0, x1, z1, 0, { h: 1.1, block: false });
  }
  kit.block(S.subtract(S.ring(0, 0, WR + 0.3, 1.2), S.rect(0, WR, 7, 4)), 0.3);
  // entry arch (south)
  for (const s of [-1, 1]) { kit.add('marble', box(1.6, 7, 1.6, 2), M(s * 3.4, 3.5, WR + 0.4), { tint: 0xf2eee6, yGround: 0 }); kit.block(S.rect(s * 3.4, WR + 0.4, 1.7, 1.7), 0.3); }
  const archG = new THREE.TorusGeometry(3.4, 0.55, 8, 20, Math.PI); kit.add('marble', archG, M(0, 7, WR + 0.4), { tint: 0xf8f4ec, ao: false });
  kit.add('gold', box(1.6, 1.0, 0.2, 1), M(0, 9.6, WR + 0.9), { ao: false });
  // four broken columns (line of sight) + braziers
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 11, z = Math.sin(a) * 11;
    P.column(kit, x, 0, z, i % 2 ? 6.5 : 4.2, 0.85, { capital: i % 2 === 1 });
    if (i % 2 === 0) for (let k = 0; k < 3; k++) kit.add('marble', box(0.7, 0.4, 0.7, 1), M(x + rng.range(-1.8, 1.8), 0.2, z + rng.range(-1.8, 1.8), rng.range(0, 3)), { tint: 0xf2eee6 });
  }
  for (const [x, z] of [[-8, 0], [8, 0]]) P.brazier(kit, x, 0, z, { s: 1 });
  // team daises + banners
  for (const [z, col, face] of [[R - 5, 0x2a5aa8, 0], [-R + 5, 0xb02a2a, Math.PI]]) {
    kit.add('marble', cyl(4.4, 4.6, 0.3, 24, 2), M(0, 0.05, z), { tint: 0xf4f0e8, ao: false, cast: false });
    const ring = new THREE.TorusGeometry(3.9, 0.06, 4, 48); ring.rotateX(Math.PI / 2);
    kit.glow(ring, M(0, 0.22, z), col, 2.2);
    for (const s of [-1, 1]) P.flagPole(kit, flags, s * 5.6, 0, z, { h: 6, color: col, len: 2.4, w: 1.1 });
    void face;
  }
  // stand banners, trees beyond the south
  for (let i = 0; i < 7; i++) { const a = -Math.PI + (i + 0.5) / 7 * Math.PI, r = WR + 12.6, y = 3.6 + 4 * 1.4 + 1.4; flags.add(M(Math.cos(a) * r, y + 6, Math.sin(a) * r, -a - Math.PI / 2), 1.8, 5, i % 2 ? 0x2a5aa8 : 0xb02a2a, { hang: 'top', trim: 0xd8b060 }); kit.add('metal', cyl(0.1, 0.14, 6.5, 6, 1), M(Math.cos(a) * (r + 0.1), y + 3, Math.sin(a) * (r + 0.1)), { tint: 0x2a2a2e, ao: false }); }
  const flora = new Flora();
  for (let i = 0; i < 40; i++) { const x = rng.range(-70, 70), z = rng.range(R + 6, 75); if (Math.abs(x) < 6) continue; flora.tree(rng.chance(0.4) ? 'cypress' : 'broadleaf', x, H(x, z) - 0.1, z, { s: rng.range(0.9, 1.2), variant: i % 3 }); }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.28 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  flora.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  const dec = new Decals(H);
  for (let i = 0; i < 18; i++) { const a = rng.range(0, TAU), r = rng.range(3, R - 1); dec.add(rng.pick(['cracks', 'stain', 'pebbles', 'scorch']), Math.cos(a) * r, Math.sin(a) * r, { size: rng.range(1.2, 2.6), alpha: 0.6 }); }
  dec.add('sunmark', 0, 0, { size: 4.8, rot: 0 });
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 3);
  const dust = buildParticles('dust', { quality });
  zone.root.add(dust);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); dust.userData.update(focus); });
  const nav = new NavGrid(-R - 3, -R - 3, 2 * R + 6, 2 * R + 6, 0.5).walk(S.circle(0, 0, R - 0.3));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, R - 5]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, R - 5, 0);
  [-3, 0, 3].forEach((x, i) => { zone.anchor(`team:a${i + 1}`, x, R - 5, 0); zone.anchor(`team:b${i + 1}`, x, -R + 5, Math.PI); });
  zone.anchor('center', 0, 0, 0);
  zone.region('The Crucible', 0, 0, R);
  zone.env = makeEnv('dusk', { music: 'pvp', ambience: 'crowd' });
  zone.envs = { dusk: zone.env, day: makeEnv('day', { music: 'pvp', ambience: 'crowd' }) };
  zone.minimap = paintMinimap(zone, { px: 320, area: { x0: -R - 4, z0: -R - 4, size: 2 * R + 8 } });
}
