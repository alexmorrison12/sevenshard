// Legion bosses — public entry (contract: ARCHITECTURE.md "Bosses"; API docs: ./README.md).
//
//   import { createBoss, BOSSES, preloadBosses } from './models/bosses/legion/index.js';
//   const b = createBoss('gorrath');            // cached geometry; each call returns a new instance
//   scene.add(b.root);                          // game sets root.position / root.rotation.y (model faces −Z)
//   b.update(dt, { speed, turn, dead, groggy, enraged, ghost });   // every frame; dt = 0 holds the pose (hit-stop)
//   const { dur, hits } = b.play('axe_cleave', { dur: 2.2 });      // hits = impact moments (s), scaled with dur
//   b.setGlow('counter', 1); b.breakPart('hornL'); b.setTint(0xffffff, 0.6); b.dispose();
import { Boss, buildEntry, clearCache, cacheStats } from './boss.js';
import { gorrath } from './gorrath.js';
import { skarn, vesk } from './hounds.js';
import { varkhul } from './varkhul.js';
import { ashmaw } from './ashmaw.js';
import { gatekeeper } from './gatekeeper.js';
import { metaOf } from './meta.js';

const DEFS = { gorrath, skarn, vesk, varkhul, ashmaw, gatekeeper };

/** BOSSES[id] = { name, title, height, radius, walkSpeed, runSpeed, actions: { name: { dur, hits, counter?, active?, move? } } } */
export const BOSSES = {};
for (const id of Object.keys(DEFS)) BOSSES[id] = metaOf(id, DEFS[id]);

/** Register / replace a boss definition (used internally as bosses come online). */
export function registerBoss(id, def) { DEFS[id] = def; BOSSES[id] = metaOf(id, def); }

/**
 * createBoss(id, opts) → boss instance (see README).
 * opts: { impactFx: true (built-in dust/sparks on hits), autoGlow: true (actions like triple_sweep drive their own counter shimmer; false = only setGlow) }
 */
export function createBoss(id, opts = {}) {
  const def = DEFS[id];
  if (!def) throw new Error('unknown legion boss: ' + id);
  const entry = buildEntry(id, def);
  return new Boss(id, entry, opts);
}

/** Build (and cache) geometry ahead of time (loading screen). Returns build stats per id. */
export function preloadBosses(ids = Object.keys(DEFS)) {
  return ids.filter(id => DEFS[id]).map(id => ({ id, ...buildEntry(id, DEFS[id]).stats }));
}
export { clearCache as disposeBossCache, cacheStats as bossStats };
export const BOSS_IDS = Object.keys(BOSSES);
