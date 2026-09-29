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
import { placeholder } from './zones/placeholder.js';
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
};

const ring = (n, r, prefix, cz = 0) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}`, [Math.cos(i / n * 6.283) * r, cz + Math.sin(i / n * 6.283) * r, 0]]));
const BUILDERS = {
  test: test.build,
  solhaven: solhaven.build,
  chaos_rift: chaosRift.build,
  frostmere: frostmere.build,
  throne_of_horns: placeholder({ half: 28, layer: 'bloodstone', preset: 'blood', region: 'Throne of Horns', anchors: { spawn: [0, 22], boss: [0, -8, Math.PI], ...ring(8, 20, 'pillar:') } }),
  kennels: placeholder({ half: 24, layer: 'bloodstone', preset: 'blood', region: 'The Kennels', anchors: { spawn: [0, 18], boss: [0, -8, Math.PI], 'boss:skarn': [-6, -8, Math.PI], 'boss:vesk': [6, -8, Math.PI] } }),
  crucible: placeholder({ half: 22, layer: 'flagstone', preset: 'dusk', region: 'The Crucible', anchors: { spawn: [0, 16], 'team:a1': [-4, 16], 'team:a2': [0, 16], 'team:a3': [4, 16], 'team:b1': [-4, -16, Math.PI], 'team:b2': [0, -16, Math.PI], 'team:b3': [4, -16, Math.PI] } }),
  inferno: placeholder({ half: 25, layer: 'obsidian', preset: 'volcanic', region: 'Inferno Descent', anchors: { spawn: [0, 18], exit: [0, -20], boss: [0, -8, Math.PI], ...ring(10, 12, 'spawn:m') } }),
  stronghold: placeholder({ half: 50, layer: 'grass', region: 'Brightwater Isle', anchors: { spawn: [0, 20], 'dock:ship': [0, 45] } }),
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
