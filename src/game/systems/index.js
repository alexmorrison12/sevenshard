// SEVENSHARD progression & economy layer — every system as a namespace, plus the few top-level entry points the game
// loop needs (tick, track, statContext). See README.md in this folder for every function and the data it returns.
import * as market from './market.js';
import * as stronghold from './stronghold.js';
import * as lifeskills from './lifeskills.js';
import * as tasks from './tasks.js';

export * as common from './common.js';
export * as rolls from './rolls.js';
export * as gear from './gear.js';
export * as stats from './stats.js';
export * as loot from './loot.js';
export * as economy from './economy.js';
export * as honing from './honing.js';
export * as cards from './cards.js';
export * as gems from './gems.js';
export * as engravings from './engravings.js';
export * as collectibles from './collectibles.js';
export * as rapport from './rapport.js';
export * as guild from './guild.js';
export * as shops from './shops.js';
export * as mail from './mail.js';
export * as titles from './titles.js';
export * as boards from './boards.js';
export * as partyfinder from './partyfinder.js';
export * as mods from './mods.js';
export { market, stronghold, lifeskills, tasks };
export { track } from './tasks.js';
export { statContext, applyMods } from './mods.js';
export { simulateEconomy } from './economy.js';

/**
 * Bring every real-time system up to `now` and collect notifications to toast: market sales/expiries (mailed),
 * finished stronghold research, life energy regen, the daily task board, and world events going live.
 * → [{ kind, text, id? }]
 */
export function tick(account, char = null, now = Date.now()) {
  const out = [];
  out.push(...market.tick(account, now));
  out.push(...stronghold.tick(account, now));
  lifeskills.energy(account, now);
  tasks.state(account, now);
  const flags = account.roster.flags ||= {};
  const seen = Array.isArray(flags.eventNotes) ? flags.eventNotes : (flags.eventNotes = []);
  for (const e of tasks.live(now)) if (!seen.includes(e.id)) { seen.push(e.id); out.push({ kind: 'event', id: e.id, text: `${e.name} is live${e.where ? ` — ${e.where}` : ''}!` }); }
  if (seen.length > 12) seen.splice(0, seen.length - 12);
  return out;
}
