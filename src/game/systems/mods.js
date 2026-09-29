// Aggregates every stat & economy modifier the systems produce (card sets, gems, stronghold research, guild research,
// titles) into the `ctx` heroStats(char, ctx) understands, plus `extra` mods applied with applyMods().
import { mods as cardMods } from './cards.js';
import { mods as gemMods } from './gems.js';
import { perks as strongholdPerks } from './stronghold.js';
import { perks as guildPerks } from './guild.js';
import { mods as titleMods } from './titles.js';

/** Economy-side modifiers: { silverGain, xpGain, chaosLoot, guardianLoot, marketFee, lifeEnergy, lifeXp, shopDiscount, restGain, seedSense } */
export function econMods(account) {
  const c = cardMods(account).mods, s = strongholdPerks(account), g = guildPerks(account);
  return { silverGain: (c.silverGain || 0) + (g.silverGain || 0), xpGain: (c.xpGain || 0) + (g.xpGain || 0), chaosLoot: s.chaosLoot || 0, guardianLoot: s.guardianLoot || 0,
    marketFee: s.marketFee || 0, lifeEnergy: s.lifeEnergy || 0, lifeXp: g.lifeXp || 0, shopDiscount: g.shopDiscount || 0, restGain: g.restGain || 0, seedSense: c.seedSense || 0 };
}
/**
 * Context for heroStats(char, ctx): stats.js consumes rosterLevel, research.atk (multiplier) and cardBonus.dmgAdd.
 * `extra` (apply with applyMods after heroStats) carries the rest; `skills` = per-skill gem mods.
 */
export function statContext(account, char) {
  const c = cardMods(account).mods, s = strongholdPerks(account), t = titleMods(account);
  const extra = {};
  const add = (k, v) => { if (v) extra[k] = (extra[k] || 0) + v; };
  add('crit', c.crit); add('critDmg', c.critDmg); add('dmgTaken', c.dmgTaken); add('hpMaxMul', (c.hpMaxMul || 0) + (s.hp || 0) + (t.hpMaxMul || 0));
  add('healMul', c.healMul); add('shieldMul', c.shieldMul); add('elemRes', c.elemRes); add('dotMul', c.dotMul);
  for (const [k, v] of Object.entries(t)) if (k !== 'dmgAdd' && k !== 'hpMaxMul') add(k, v);
  return {
    rosterLevel: account.roster.level || 1,
    research: { atk: 1 + (s.atk || 0) },
    cardBonus: { dmgAdd: (c.dmgAdd || 0) + (t.dmgAdd || 0) },
    extra,
    skills: char ? gemMods(char) : {},
    econ: econMods(account),
  };
}
/** Apply mods to a stats object (stats.js conventions): hpMaxMul scales hpMax, *Mul multiplies (1 + v), else adds. */
export function applyMods(st, mods = {}) {
  for (const [k, v] of Object.entries(mods || {})) {
    if (!v) continue;
    if (k === 'hpMaxMul') st.hpMax = Math.round(st.hpMax * (1 + v));
    else if (k.endsWith('Mul')) st[k] = (st[k] ?? 1) * (1 + v);
    else st[k] = (st[k] ?? 0) + v;
  }
  if (st.power != null && st.atk) st.power = Math.round(st.atk * (1 + st.crit * (st.critDmg - 1)) * (st.dmgMul ?? 1) * (1 + (st.dmgAdd || 0)) / 100);
  return st;
}
