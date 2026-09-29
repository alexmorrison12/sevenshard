// Island zone builder shared by the eight islands (src/world/zones/isle_*.js): the island's terrain (the same height
// function the Glass Sea uses, here at 1 m), splat paint, its landmarks at full detail (landmarks.js, lod 'full'),
// palms/foliage/grass/decals, the animated ocean around it (depth from the ground), the Dawnrunner moored at the pier,
// the pier as a walkable deck, nav, anchors (spawn, dock:ship, npc:*, seed:1…, vista, gimmick spots), day/dusk/night
// envs and the minimap.
//
//   buildIsle(zone, 'coinflip', { decorate(ctx), paint(g, ctx), nav(nav, ctx), env(envs), heightFn, water, grass })
//   ctx = { zone, kit, flags, flora, palms, dec, g, T, H, spots, rng, anchor(name, x, z, facing), lights }
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, kitMaterial } from '../kit.js';
import * as S from '../shapes.js';
import { Flags, buildFlames, LightPool, buildParticles } from '../fx.js';
import { Flora, Grass } from '../foliage.js';
import { Decals } from '../decals.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG } from '../../core/noise.js';
import { Waves } from './waves.js';
import { Ocean } from './ocean.js';
import { ShipRig } from './shiprig.js';
import { ISLE_TERRAIN, paintIsle } from './isles.js';
import { buildLandmarks, Palms } from './landmarks.js';
import { ISLAND_BY_ID } from '../../data/islands.js';

export const ISLE_LAYERS = ['sand', 'grass', 'rock', 'dirt', 'moss', 'gravel', 'flagstone', 'cobble', 'marble'];
const n3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

/** island day / dusk / night envs (sun behind the camera, sea music & ambience from the island data) */
export function isleEnvs(I, over = {}) {
  const base = { music: I.music || 'sea', ambience: I.ambience || 'sea' };
  const day = makeEnv('day', { ...base, sunDir: n3(-0.5, 0.72, 0.48), fogColor: 0xc4dcee, fogDensity: 0.0032, fogHeight: 0.03, background: 0x9cc2e0, hemiSky: 0xbcd8f4, hemiIntensity: 1.1,
    grade: { exposure: 1.03, saturation: 1.12, contrast: 1.07, vignette: 0.3, bloom: 0.5, bloomThreshold: 0.9 }, ...over.day });
  const dusk = makeEnv('dusk', { ...base, fogDensity: 0.005, ...over.dusk });
  const night = makeEnv('night', { ...base, sunColor: 0x9ab4e0, sunIntensity: 1.3, hemiIntensity: 0.9, fogColor: 0x16223a, fogDensity: 0.0055, music: I.musicNight || 'city_night', ambience: 'night',
    grade: { exposure: 1.2, saturation: 0.96, vignette: 0.42, bloom: 0.9, bloomThreshold: 0.78 }, ...over.night });
  return { day, dusk, night };
}

export async function buildIsle(zone, id, spec = {}, opts = {}) {
  const I = ISLAND_BY_ID[id], T = ISLE_TERRAIN[id];
  const quality = opts.quality ?? 1;
  const rng = new RNG(id.length * 977 + 13);
  const R = spec.half ?? Math.min(110, Math.ceil(T.radius));
  const Hfn = spec.heightFn ? (x, z) => spec.heightFn(x, z, zone) : (x, z) => T.height(x, z);
  zone.bounds = { x0: -R + 6, z0: -R + 6, x1: R - 6, z1: R - 6 };
  // ---------------------------------------------------------------- ground
  const g = zone.ground = new Ground({ x0: -R, z0: -R, w: R * 2, d: R * 2, res: 1, paintRes: 0.5, layers: spec.layers || ISLE_LAYERS, base: 'sand', seed: id.length * 3 + 1 });
  g.sculpt((x, z) => T.height(x, z));
  g.tint.setRGB(...(spec.groundTint || [1.1, 1.07, 1.02]));        // sun-bleached tropical ground (the splat sand reads muddy otherwise)
  paintIsle(g, T, 0, 0, spec.paintOpts || {});
  const ctx = { zone, I, T, g, R, rng, spots: {}, extra: {} };
  spec.paint?.(g, ctx);
  await tick();
  // ---------------------------------------------------------------- architecture & foliage
  const kit = ctx.kit = new Kit({ seed: id.length * 31 });
  const flags = ctx.flags = new Flags(), flora = ctx.flora = new Flora(), palms = ctx.palms = new Palms();
  const dec = ctx.dec = new Decals((x, z) => zone.heightAt(x, z));
  const H = ctx.H = (x, z) => T.height(x, z);
  const spots = ctx.spots = buildLandmarks(id, { kit, flags, flora, palms, ox: 0, oz: 0, H, lod: 'full', night: false });
  ctx.anchors = {};
  ctx.anchor = (name, x, z, facing = 0, extra = null) => { ctx.anchors[name] = { x, z, facing, extra }; };
  spec.decorate?.(ctx);
  // pier deck (walkable) from the landmark spot
  const pier = spots.pier;
  if (pier) {
    const len = pier[3] ?? 14, w = pier[4] ?? 4;
    zone.deck(S.rect(pier[0], pier[2] - len / 2, w, len + 0.2), pier[1] + 0.11);
    ctx.pierX = pier[0]; ctx.pierZ = pier[2]; ctx.pierLen = len; ctx.pierY = pier[1] + 0.11; ctx.pierW = w;
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.25), { soft: 2, amount: 0.3 });
  await tick();
  await g.build(zone.root, { clip: (x, z) => T.height(x, z) > -6 });
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  flora.build(zone.root);
  palms.build(zone.root);
  const dm = dec.build(); if (dm) zone.root.add(dm);
  let grass = null;
  if (spec.grass !== false) { grass = new Grass(g, { layer: 'grass', density: quality * (spec.grassDensity ?? 0.8) }); zone.root.add(grass.mesh); }
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const motes = spec.particles ? buildParticles(spec.particles, { quality }) : null; if (motes) zone.root.add(motes);
  await tick();
  // ---------------------------------------------------------------- water & the moored Dawnrunner
  const waves = new Waves({ base: spec.storm ?? 0, wind: [0.8, 0.6], scale: spec.swell ?? 0.8 });
  const ocean = new Ocean({ waves, size: Math.max(420, R * 4), step: 1.6, depth: { ground: g }, ...(spec.water || {}) });
  zone.root.add(ocean.mesh);
  zone.sea = { waves, ocean };
  if (pier) {
    const rig = new ShipRig('dawnrunner', { waves, wake: false });
    const sx = pier[0] + 6.2, sz = pier[2] - 3;
    rig.place(sx, sz, 0.04); zone.root.add(rig.root);
    rig.ship.update?.(0.016, { speed: 0, turn: 0, sail: 0.05 });
    zone.moored = rig;
    ctx.shipX = sx; ctx.shipZ = sz;
  }
  // ---------------------------------------------------------------- nav
  const nav = new NavGrid(-R, -R, R * 2, R * 2, 0.5);
  const slopeOk = (x, z) => { const e = 0.6, dx = Hfn(x + e, z) - Hfn(x - e, z), dz = Hfn(x, z + e) - Hfn(x, z - e); return Math.hypot(dx, dz) / (2 * e) < (spec.maxSlope ?? 0.95); };
  nav.walk({ sd: (x, z) => (Hfn(x, z) > (spec.wade ?? -0.45) && slopeOk(x, z)) ? -1 : 1, box: [-R, -R, R, R] });
  if (pier) nav.walk(S.rect(ctx.pierX, ctx.pierZ - ctx.pierLen / 2 + 0.3, ctx.pierW - 0.8, ctx.pierLen + 1.2));
  spec.nav?.(nav, ctx);
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  for (const c of flora.colliders) nav.block(c.shape, c.inflate);
  // anchors
  const spawn = pier ? { x: ctx.pierX, z: ctx.pierZ - 2.2, facing: 0 } : ctx.anchors.spawn || { x: 0, z: 30, facing: 0 };
  nav.keepConnected([[spawn.x, spawn.z], ...(spec.seeds || [])]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', spawn.x, spawn.z, spawn.facing);
  if (pier) zone.anchor('dock:ship', ctx.pierX, ctx.pierZ - 0.8, 0);
  for (const [name, a] of Object.entries(ctx.anchors)) zone.anchor(name, a.x, a.z, a.facing ?? 0, a.extra);
  for (const [name, a] of Object.entries(zone.anchors)) {
    if (a.free || nav.walkable(a.x, a.z)) continue;
    const p = nav.nearest(a.x, a.z, 6);
    if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } else console.warn(`[isle ${id}] anchor off-nav`, name);
  }
  if (spec.heightFn) zone.heightAt = (x, z) => spec.heightFn(x, z, zone);
  zone.region(I.name, 0, 0, R);
  // ---------------------------------------------------------------- env, minimap, update
  zone.envs = isleEnvs(I, spec.envOver || {});
  zone.env = zone.envs.day;
  spec.env?.(zone.envs, ctx);
  zone.onEnv(env => { ocean.setEnv(env); pool.scale = 0.45 + (env.night || 0) * 1.6; kitMaterial('window').emissiveIntensity = (env.night || 0) * 1.8; });
  const roofs = (kit.spots.roofs || []).map(r => ({ shape: r.rect ? { rect: r.rect } : { circle: r.circle }, color: '#' + new THREE.Color(r.color).getHexString() }));
  zone.minimap = paintMinimap(zone, { px: 512, area: { x0: -R, z0: -R, size: R * 2 }, roofs, water: [], clip: (x, z) => T.height(x, z) > 0 || nav.walkable(x, z) });
  zone.spots = spots; zone.isle = ctx;
  zone.onUpdate((dt, t, focus) => {
    ocean.update(focus); pool.update(dt, t, focus); grass?.update(focus); motes?.userData.update(focus);
    zone.moored?.update(dt, t, { x: ctx.shipX, z: ctx.shipZ, heading: 0.04, speed: 0, turn: 0, sail: 0.05 });
    spec.update?.(dt, t, focus, ctx);
  });
  return ctx;
}
