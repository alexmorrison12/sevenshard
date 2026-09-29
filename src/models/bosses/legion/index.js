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
import { PLACEHOLDER_META, metaOf } from './meta.js';

const DEFS = { gorrath, skarn, vesk, varkhul, ashmaw, gatekeeper };

/** BOSSES[id] = { name, title, height, radius, walkSpeed, runSpeed, actions: { name: { dur, hits, counter?, active?, move? } } } */
export const BOSSES = {};
for (const id of ['gorrath', 'skarn', 'vesk', 'varkhul', 'ashmaw', 'gatekeeper']) BOSSES[id] = DEFS[id] ? metaOf(id, DEFS[id]) : PLACEHOLDER_META[id];

/** Register / replace a boss definition (used internally as bosses come online). */
export function registerBoss(id, def) { DEFS[id] = def; BOSSES[id] = metaOf(id, def); }

/**
 * createBoss(id, opts) → boss instance (see README).
 * opts: { impactFx: true (built-in dust/sparks on hits), autoGlow: true (actions drive counter/charge glows) }
 */
export function createBoss(id, opts = {}) {
  let def = DEFS[id];
  if (!def) {
    // not implemented yet: stand-in with the right metadata so integration can proceed
    const meta = PLACEHOLDER_META[id];
    if (!meta) throw new Error('unknown legion boss: ' + id);
    const e = buildEntry('gorrath', gorrath);
    const b = new Boss('gorrath', e, opts);
    const k = meta.height / gorrath.meta.height;
    b.pivot.scale.multiplyScalar(k);
    b.id = id; b.height = meta.height; b.radius = meta.radius; b.placeholder = true;
    const play = b.play.bind(b);
    b.play = (name, o = {}) => { const m = meta.actions[name]; if (!m) return { dur: 0, hits: [] }; const r = play(e.actions[name] ? name : 'stomp', { dur: o.dur ?? m.dur }); const sc = (o.dur ?? m.dur) / m.dur; return { dur: o.dur ?? m.dur, hits: m.hits.map(h => h * sc), ...(r.dur ? {} : {}) }; };
    return b;
  }
  const entry = buildEntry(id, def);
  return new Boss(id, entry, opts);
}

/** Build (and cache) geometry ahead of time (loading screen). Returns build stats per id. */
export function preloadBosses(ids = Object.keys(DEFS)) {
  return ids.filter(id => DEFS[id]).map(id => ({ id, ...buildEntry(id, DEFS[id]).stats }));
}
export { clearCache as disposeBossCache, cacheStats as bossStats };
export const BOSS_IDS = Object.keys(BOSSES);
