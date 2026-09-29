// SEVENSHARD guardian bosses — procedural SDF-sculpted, skinned and procedurally animated giant monsters.
// Contract: ARCHITECTURE.md "Bosses". Full API notes: README.md in this folder.
//
//   import { createBoss, BOSSES } from './models/bosses/guardians/index.js';
//   const b = createBoss('rimewing');             // opts: { scale, clone (kurai only) }
//   scene.add(b.root);                             // the game drives root.position (x, z, ground y) / root.rotation.y
//   b.update(dt, { speed, turn, dead, groggy, enraged, fly, burrowed, ghost });
//   const { dur, hits } = b.play('breath', { dur: 3.5 });   // hits: impact moments in seconds (scaled with dur)
//   b.setGlow('counter', 1); b.breakPart('crest'); b.setTint(0xffffff, 0.6); b.dispose();
import { getEntry, disposeCache, cacheStats } from './core/build.js';
import { Boss } from './core/boss.js';
import { rimewing } from './rimewing.js';
import { kurai } from './kurai.js';
import { cinderhorn } from './cinderhorn.js';
import { sandmaw } from './sandmaw.js';
import { nerissa } from './nerissa.js';
import { deep_oracle } from './deep_oracle.js';
import { thunderhoof } from './thunderhoof.js';

const DEFS = { rimewing, kurai, cinderhorn, sandmaw, nerissa, deep_oracle, thunderhoof };

function infoOf(id, def) {
  const i = def.info;
  const actions = {};
  const all = { ...i.actions };
  for (const [al, target] of Object.entries(def.spec.aliases || {})) if (!all[al] && i.actions[target]) all[al] = { ...i.actions[target], alias: target };
  for (const [k, a] of Object.entries(all)) {
    const o = { dur: a.dur, hits: a.hits.slice() };
    for (const key of ['loop', 'hold', 'counter', 'move', 'speed', 'turn', 'air', 'alias']) if (a[key] !== undefined) o[key] = a[key];
    actions[k] = o;
  }
  const out = { name: i.name, title: i.title, height: i.height, radius: i.radius, actions, parts: i.parts || [] };
  for (const key of ['flyHeight', 'wingspan', 'length', 'burrowDepth']) if (i[key] !== undefined) out[key] = i[key];
  return out;
}

// The metadata (info.actions) is the single source of truth for timing: copy dur / hits / loop / hold into the
// animation specs so combat sync and animation can never drift apart.
for (const [id, def] of Object.entries(DEFS)) {
  for (const [k, a] of Object.entries(def.info.actions)) {
    const s = def.spec.actions[k];
    if (!s) { console.warn(`[guardians] ${id}: action '${k}' has no animation`); continue; }
    s.dur = a.dur; s.hits = a.hits; s.loop = !!a.loop; s.hold = !!a.hold;
  }
}

/** Metadata for every guardian: { name, title, height, radius, actions: { name: { dur, hits, loop?, hold?, counter?, move? } }, parts } */
export const BOSSES = {};
for (const [id, def] of Object.entries(DEFS)) BOSSES[id] = infoOf(id, def);

export function createBoss(id, opts = {}) {
  const def = DEFS[id];
  if (!def) throw new Error('unknown guardian: ' + id);
  const entry = getEntry(id, def, opts);
  return new Boss(id, entry, BOSSES[id], opts);
}

/** Build geometry ahead of time (loading screen). Returns build stats. */
export function preloadBosses(ids = Object.keys(DEFS)) { return ids.map(id => getEntry(id, DEFS[id], {}).stats); }
export function disposeBossCache() { disposeCache(); }
export function bossStats() { return cacheStats(); }
export const GUARDIAN_IDS = Object.keys(DEFS);
