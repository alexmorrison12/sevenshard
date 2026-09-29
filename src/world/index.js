// World entry: await buildZone(id, { quality, seed }) → zone, and the ZONES table. See README.md.
import { Zone, tick } from './zone.js';
import { QUALITY } from '../engine/renderer.js';
import { groundLayers, noiseTex, decalAtlas } from './textures.js';
import { bakeStats } from './bake.js';
export { bakeStats };
import * as test from './zones/test.js';
import * as solhaven from './zones/solhaven.js';
import * as chaosRift from './zones/chaos_rift.js';
import * as frostmere from './zones/frostmere.js';
import { buildThrone, buildKennels } from './zones/throne.js';
import * as crucible from './zones/crucible.js';
import * as inferno from './zones/inferno.js';
import * as stronghold from './zones/stronghold.js';
import * as cinderforge from './zones/cinderforge.js';
import * as sunscar from './zones/sunscar.js';
import './zones/brighthold.js';
import './zones/goldmeadow.js';
import './zones/thornwood.js';
import './zones/ashen_ridge.js';
import './zones/pipsprout.js';
export { applyEnv, makeEnv, PRESETS } from './env.js';

export const ZONES = {
  test: { name: 'Proving Plaza', kind: 'arena', size: 60 },
  solhaven: { name: 'Solhaven', kind: 'city', size: 160 },
  chaos_rift: { name: 'Demon Rift', kind: 'dungeon', size: 150 },
  frostmere: { name: 'Frostmere', kind: 'arena', size: 70 },
  throne_of_horns: { name: 'Throne of Horns', kind: 'arena', size: 56 },
  kennels: { name: 'The Kennels', kind: 'arena', size: 48 },
  crucible: { name: 'The Crucible', kind: 'arena', size: 44 },
  inferno: { name: 'Inferno Descent', kind: 'dungeon', size: 50 },
  stronghold: { name: 'Brightwater Isle', kind: 'stronghold', size: 120 },
  cinderforge: { name: 'Cinderforge', kind: 'arena', size: 64 },
  sunscar: { name: 'Sunscar Basin', kind: 'arena', size: 76 },
};

const BUILDERS = {
  test: test.build,
  solhaven: solhaven.build,
  chaos_rift: chaosRift.build,
  frostmere: frostmere.build,
  throne_of_horns: buildThrone,
  kennels: buildKennels,
  crucible: crucible.build,
  inferno: inferno.build,
  stronghold: stronghold.build,
  cinderforge: cinderforge.build,
  sunscar: sunscar.build,
};
/** Register / replace a zone builder at runtime (used as real builders land). */
export function registerZone(id, def, build) { if (def) ZONES[id] = def; BUILDERS[id] = build; }

/**
 * Build a zone. opts: { quality: 'low'|'medium'|'high'|'ultra' (default 'high'), seed, onProgress(f, label) }.
 * Resolves to the zone object described in ARCHITECTURE.md (root, env, heightAt, nav, walkable, anchors, regions,
 * minimap, update, dispose) plus extras documented in src/world/README.md.
 */
export async function buildZone(id, opts = {}) {
  const def = ZONES[id];
  if (!def) throw new Error(`buildZone: unknown zone "${id}"`);
  const t0 = performance.now();
  const Q = QUALITY[opts.quality] || QUALITY.high;
  const zone = new Zone(id, def, opts);
  const bake0 = bakeStats.ms;
  // shared texture sets (baked once per session, ~0.2 s the first time)
  groundLayers(); noiseTex(); decalAtlas();
  await tick();
  await BUILDERS[id](zone, { quality: Q.grass, props: Q.props, particles: Q.particles, Q, onProgress: opts.onProgress || (() => {}) });
  zone.root.updateMatrixWorld(true);
  zone.stats.build = Math.round(performance.now() - t0);
  zone.stats.bake = Math.round(bakeStats.ms - bake0);
  let meshes = 0, tris = 0;
  zone.root.traverse(o => { if (o.isMesh || o.isPoints) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
  zone.stats.meshes = meshes; zone.stats.tris = Math.round(tris);
  return zone;
}
