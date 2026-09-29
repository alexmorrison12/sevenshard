// Titles & achievements. track() turns events into counters (roster.records), completes achievements (roster.achieved),
// unlocks titles (roster.titles) and grants achievement rewards. Called by tasks.track (never import tasks.js here).
import { TITLES, TITLE_LIST, ACHIEVEMENTS } from '../../data/titles.js';
import { STAGES } from '../../data/rapport.js';
import { ok, fail, grantBundle, bundleRows, unlock } from './common.js';

export { TITLES, ACHIEVEMENTS };
function st(account) {
  const r = account.roster;
  r.records ||= {}; r.achieved ||= {};
  if (!Array.isArray(r.titles)) r.titles = [];
  if (!r.titles.includes('shardbearer')) r.titles.unshift('shardbearer');
  return r;
}
const inc = (rec, k, n = 1) => { rec[k] = (rec[k] || 0) + n; };
const max = (rec, k, v) => { if (v > (rec[k] || 0)) rec[k] = v; };

/** Update counters from an event → changed stat keys */
function count(account, event, d) {
  const r = account.roster, rec = r.records, ch = [];
  const I = (k, n = 1) => { inc(rec, k, n); ch.push(k); }, M = (k, v) => { max(rec, k, v); ch.push(k); };
  switch (event) {
    case 'kill': I('kills', d.count || 1); if (d.elite) I('elites', d.count || 1); if (d.family === 'demon') I('demons', d.count || 1); break;
    case 'clear': {
      const c = d.content;
      if (c === 'chaos') I('chaos');
      else if (c === 'guardian') { I('guardians'); if (d.id) I(`guardian_${d.id}`); }
      else if (c === 'abyss') I('abyss');
      else if (c === 'raid') { I('raids'); if (d.gate == null || d.gate >= 1) I(d.mode === 'hard' ? 'raid_hard' : 'raid_normal'); }
      else if (c === 'inferno') { I('inferno_floors'); if (d.floor || d.tier) M('inferno_best', d.floor || d.tier); }
      else if (c === 'pvp') I('pvp_matches');
      else if (c) I(`events_${c}`);
      break;
    }
    case 'pvp': I('pvp_matches'); if (d.win) I('pvp_wins'); break;
    case 'boss_part': if (/horn/.test(d.part || '')) I('horns'); break;
    case 'hone': I('hone_taps'); if (d.success) { M('max_hone', d.to); if (d.guaranteed) I('artisan'); else if (d.chance <= 0.1 && d.taps === 1) I('lucky_hone'); } break;
    case 'transfer': I('transfers'); break;
    case 'facet': I('facets'); if (d.is97) I('stone97'); break;
    case 'awaken': if (d.awaken >= 5) I('awaken5'); break;
    case 'card': rec.cards = Object.keys(r.cards || {}).length; ch.push('cards'); break;
    case 'collect': if (d.type) { rec[`collect_${d.type}`] = d.have; ch.push(`collect_${d.type}`); } if (d.zoneDone) I('seed_zones'); break;
    case 'tome': if (d.pct >= 1) I('tomes'); break;
    case 'rapport': rec.devoted = Object.values(r.rapport || {}).filter(x => (x.pts || 0) >= STAGES[STAGES.length - 1].min).length; ch.push('devoted'); break;
    case 'sold': if (d.gold) I('market_gold', d.gold); break;
    case 'donate': I('donations'); break;
    case 'sail': if (d.dist) I('sailed', Math.round(d.dist)); if (d.arrive) I('islands_visited'); break;
    case 'gather': if (d.skill === 'fish') I('fish', d.count || 1); else I(`gather_${d.skill}`, d.count || 1); break;
    case 'craft': I('crafts', d.qty || 1); break;
    case 'song': I('songs'); break;
    case 'emote': I('emotes'); break;
    case 'death': I('deaths'); break;
    case 'login': I('logins'); break;
    default: break;
  }
  return ch;
}
/** Record an event; completes achievements → notifications [{ kind: 'achievement'|'title', text, id }] */
export function track(account, char, event, data = {}) {
  const r = st(account), changed = count(account, event, data), out = [];
  if (!changed.length) return out;
  for (const a of ACHIEVEMENTS) {
    if (r.achieved[a.id] || !changed.includes(a.stat)) continue;
    if ((r.records[a.stat] || 0) < a.need) continue;
    r.achieved[a.id] = Date.now();
    out.push({ kind: 'achievement', id: a.id, text: `Achievement: ${a.name}` });
    if (a.bundle) grantBundle(account, char, a.bundle);
    if (a.title && unlock(account, 'titles', a.title)) out.push({ kind: 'title', id: a.title, text: `New title: ${TITLES[a.title]?.name || a.title}` });
  }
  account.save();
  return out;
}
export function grantTitle(account, id) { st(account); if (!TITLES[id]) return fail('unknown', 'Unknown title.'); return ok({ isNew: unlock(account, 'titles', id) }); }
export function setActive(account, id) {
  const r = st(account);
  if (id != null && !r.titles.includes(id)) return fail('owned', 'You have not earned that title.');
  r.activeTitle = id ?? null; account.save();
  return ok({ active: r.activeTitle });
}
/** Stat mods of the active title (most titles are cosmetic). */
export function mods(account) { const id = account.roster.activeTitle; return { ...(TITLES[id]?.mods || {}) }; }
export function view(account) {
  const r = st(account);
  return {
    active: r.activeTitle || null,
    titles: TITLE_LIST.map(x => ({ id: x.id, name: x.name, desc: x.desc, color: x.color, owned: r.titles.includes(x.id), active: r.activeTitle === x.id, mods: x.mods || null })),
    achievements: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc, cat: a.cat, progress: Math.min(a.need, r.records[a.stat] || 0), need: a.need, done: !!r.achieved[a.id], title: a.title ? TITLES[a.title]?.name : null, rows: bundleRows(a.bundle || {}) })),
  };
}
