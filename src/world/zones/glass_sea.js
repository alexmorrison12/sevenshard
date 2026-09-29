// 'glass_sea' — the Glass Sea (1520 × 1200 m of open water). The animated ocean (depth colour from the chart's seabed,
// swell, whitecaps, glints, cloud shadows), the continent of Valemont with Solhaven's white city and harbour on the
// west, the eight islands + Brightwater Isle + Pipsprout Hollow as real terrain (the same height functions as their
// zones), sea stacks & reefs (they block the ship), weather cells (the Maelstrom, a wandering squall, the Moonveil
// mist) and the painted sea chart. Anchors: port:<id> (solhaven, stronghold, pipsprout, every island), spawn,
// treasure:<id>, storm:<id>.
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { tick } from '../zone.js';
import { makeEnv } from '../env.js';
import { Ground } from '../ground.js';
import { Kit, kitMaterial } from '../kit.js';
import { Flags, buildFlames, LightPool } from '../fx.js';
import { boulder, spike } from '../cliffs.js';
import { Flora } from '../foliage.js';
import { Waves } from '../sea/waves.js';
import { Ocean } from '../sea/ocean.js';
import { chart } from '../sea/chart.js';
import { paintIsle, ISLE_TERRAIN } from '../sea/isles.js';
import { buildLandmarks, buildSolhaven, Palms, StormClouds } from '../sea/landmarks.js';
import { RNG } from '../../core/noise.js';
import { SEA_BOUNDS, ISLANDS, LANDMARKS, PORTS, STORMS, TREASURE_SPOTS, SEA_NAME } from '../../data/islands.js';

const LAYERS = ['sand', 'grass', 'rock', 'dirt', 'moss', 'gravel', 'cobble', 'flagstone'];

/** sea lighting: key light behind the camera (ships read well), glitter mirrored ahead (see ocean.js) */
export function seaEnvs() {
  const base = { music: 'sea', ambience: 'sea', clouds: 1 };
  const day = makeEnv('day', { ...base, sunDir: n3(-0.42, 0.78, 0.46), fogColor: 0xbcd6ea, fogSunColor: 0xfff0d0, fogDensity: 0.0021, fogHeight: 0.02, background: 0x8fb8d8,
    hemiSky: 0xb4d4f4, hemiGround: 0x5a6a74, hemiIntensity: 1.15, sunIntensity: 3.1, grade: { exposure: 1.02, saturation: 1.1, contrast: 1.06, vignette: 0.32, bloom: 0.45, bloomThreshold: 0.92 } });
  const dusk = makeEnv('dusk', { ...base, sunDir: n3(-0.8, 0.38, 0.3), fogDensity: 0.0028, fogHeight: 0.02 });
  const night = makeEnv('night', { ...base, sunDir: n3(0.3, 0.8, 0.5), fogColor: 0x16223a, fogDensity: 0.0032, fogHeight: 0.02, hemiIntensity: 0.95, sunIntensity: 1.35, sunColor: 0x9ab4e0, clouds: 0.5,
    grade: { exposure: 1.18, saturation: 0.96, vignette: 0.44, bloom: 0.9, bloomThreshold: 0.78 } });
  const storm = makeEnv('day', { ...base, sunDir: n3(-0.3, 0.85, 0.4), sunColor: 0xb8c4d4, sunIntensity: 1.5, hemiSky: 0x6a7a8e, hemiGround: 0x2a3036, hemiIntensity: 0.95,
    fogColor: 0x4a5664, fogSunColor: 0x6a7686, fogDensity: 0.0065, fogHeight: 0.025, background: 0x3a4450, weather: 'rain', clouds: 1.3,
    grade: { exposure: 0.98, saturation: 0.8, contrast: 1.12, vignette: 0.45, cool: 0.08, bloom: 0.55, bloomThreshold: 0.86 } });
  const mist = makeEnv('night', { ...base, sunDir: n3(0.2, 0.85, 0.45), sunColor: 0xa8c8ff, sunIntensity: 1.2, fogColor: 0x6a88a8, fogSunColor: 0x9ab8e0, fogDensity: 0.011, fogHeight: 0.03,
    hemiSky: 0x5a7aa0, hemiIntensity: 1.0, clouds: 0.3, grade: { exposure: 1.12, saturation: 0.9, vignette: 0.45, bloom: 0.9, bloomThreshold: 0.8 } });
  return { day, dusk, night, storm, mist };
}
function n3(x, y, z) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }

export async function build(zone, { quality = 1, onProgress = () => {} } = {}) {
  const B = SEA_BOUNDS;
  zone.bounds = { ...B };
  const t0 = performance.now();
  const C = chart();
  zone.stats.phases.chart = Math.round(performance.now() - t0);
  onProgress(0.25, 'chart');
  await tick();

  // ---------------------------------------------------------------- water
  const waves = new Waves({ wind: [0.8, 0.6] });
  const stormCells = STORMS.filter(s => s.kind === 'storm').map(s => ({ ...s, strength: s.id === 'maelstrom' ? 1 : 0.75 }));
  waves.setStorms(stormCells);
  const ocean = new Ocean({ waves, size: 400, step: 1.6, depth: { tex: C.tex, xf: C.xf } });
  zone.root.add(ocean.mesh);
  zone.sea = { waves, ocean, chart: C, storms: stormCells };

  // ---------------------------------------------------------------- land: Valemont's coast and every island
  const kit = new Kit({ seed: 77 }), flags = new Flags(), flora = new Flora(), palms = new Palms();
  const grounds = [];
  const clipDeep = h => (x, z) => h(x, z) > -5.5;
  {
    const g = new Ground({ x0: B.x0, z0: B.z0, w: 280, d: B.z1 - B.z0, res: 2, paintRes: 2, layers: LAYERS, base: 'sand', seed: 3 });
    g.sculpt((x, z) => C.height(x, z));
    paintContinent(g, C);
    await g.build(zone.root, { clip: clipDeep((x, z) => C.height(x, z)) });
    grounds.push(g);
    onProgress(0.35, 'coast');
  }
  for (const I of C.islands) {
    const R = Math.min(I.T.radius, 110);
    const g = new Ground({ x0: I.x - R, z0: I.z - R, w: R * 2, d: R * 2, res: 2, paintRes: 1, layers: LAYERS, base: 'sand', seed: 11 });
    g.sculpt((x, z) => C.height(x, z));
    paintIsle(g, I.T, I.x, I.z);
    await g.build(zone.root, { clip: clipDeep((x, z) => C.height(x, z)) });
    grounds.push(g);
    await tick();
  }
  onProgress(0.55, 'islands');
  const H = (x, z) => C.height(x, z);
  buildSolhaven(kit, flags, H, { flora });
  for (const I of C.islands) buildLandmarks(I.id, { kit, flags, flora, palms, ox: I.x, oz: I.z, H: (x, z) => C.height(x + I.x, z + I.z), lod: 'sea', night: I.night });
  // sea stacks & rocks
  const rng = new RNG(5);
  for (const r of C.rocks) {
    if (r.h > 6 && rng.chance(0.55)) spike(kit, r.x, -3, r.z, { h: r.h + 3, r: r.s * 0.75, bend: rng.range(0.2, 1.4), dir: rng.range(0, 6.28), mat: 'rock', tint: 0x6e6860, block: false, seg: 7 });
    else boulder(kit, r.x, -2.2 + r.h * 0.25, r.z, { s: r.s * 1.1, seed: r.seed, tint: rng.chance(0.5) ? 0x6e6860 : 0x7a7064, moss: rng.chance(0.4) ? 0x4a6a3a : null, flat: 0.6, block: false });
  }
  await tick();
  kit.build(zone.root);
  const fm = flags.build(); if (fm) zone.root.add(fm);
  flora.build(zone.root);
  palms.build(zone.root);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  onProgress(0.8, 'props');
  await tick();

  // ---------------------------------------------------------------- weather: storm clouds & the Moonveil mist
  const clouds = new StormClouds(STORMS, { quality });
  zone.root.add(clouds.mesh);

  // ---------------------------------------------------------------- nav, anchors, regions
  zone._nav = C.nav; zone.nav = C.nav.toContract();
  zone.heightAt = (x, z) => Math.max(0, C.height(x, z));
  zone.walkable = (x, z) => C.nav.walkable(x, z);
  for (const p of Object.values(PORTS)) zone.anchor('port:' + p.id, p.x, p.z, p.facing, { name: p.name });
  zone.anchor('spawn', PORTS.solhaven.x, PORTS.solhaven.z, PORTS.solhaven.facing);
  for (const t of TREASURE_SPOTS) zone.anchor('treasure:' + t.id, t.x, t.z, 0);
  for (const s of STORMS) zone.anchor('storm:' + s.id, s.x, s.z, 0, { r: s.r });
  for (const I of ISLANDS) zone.region(I.name, I.x, I.z, (I.r || 60) + 40);
  for (const L of LANDMARKS) zone.region(L.name, L.x, L.z, (L.r || 50) + 40);
  zone.region('Solhaven Harbour', PORTS.solhaven.x - 30, PORTS.solhaven.z, 90);
  for (const s of STORMS) zone.region(s.name, s.x, s.z, s.r);
  zone.region(SEA_NAME, 0, 0, 2000);

  // ---------------------------------------------------------------- env, minimap, update
  zone.envs = seaEnvs();
  zone.env = zone.envs.day;
  zone.minimap = { canvas: C.canvas, ...C.mapArea };
  zone.onEnv(env => { ocean.setEnv(env); pool.scale = 0.4 + (env.night || 0) * 1.6; kitMaterial('window').emissiveIntensity = (env.night || 0) * 1.8; clouds.setEnv(env); });
  const stormT = { t: 0 };
  zone.onUpdate((dt, t, focus) => {
    ocean.update(focus);
    pool.update(dt, t, focus);
    // the wandering squall drifts on its circle
    stormT.t += dt;
    for (const s of stormCells) if (s.drift) { const a = stormT.t / s.drift.period * Math.PI * 2 + 0.7; s.x = s.drift.cx + Math.cos(a) * s.drift.R; s.z = s.drift.cz + Math.sin(a) * s.drift.R; }
    waves.setStorms(stormCells);
    clouds.update(dt, t, focus, stormCells);
    palms.update?.(t);
  });
  zone.stats.phases.total = Math.round(performance.now() - t0);
}

function paintContinent(g, C) {
  const B = SEA_BOUNDS;
  const box = [B.x0, B.z0, B.x0 + 280, B.z1];
  g.paint('grass', { sd: (x, z) => 1.5 - C.height(x, z), box }, { soft: 1.5, noise: 1.2, nscale: 5 });
  g.paint('rock', { sd: (x, z) => { const e = 2, s = Math.hypot(C.height(x + e, z) - C.height(x - e, z), C.height(x, z + e) - C.height(x, z - e)) / (2 * e); return 0.7 - s; }, box }, { soft: 0.3 });
  g.paint('dirt', { sd: (x, z) => 0.4 - Math.abs(Math.sin(x * 0.02 + z * 0.013)) - (C.height(x, z) > 2 ? 0 : 9), box }, { soft: 2, noise: 2, nscale: 6, amount: 0.6 });
}

registerZone('glass_sea', { name: SEA_NAME, kind: 'sea', size: 1520 }, build);
