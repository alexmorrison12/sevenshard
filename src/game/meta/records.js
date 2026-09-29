// Personal records (roster-wide, saved with the account in roster.records.pb) and the "Weekly Legion Race" news entry
// for the title screen. roster.records is shared with systems/titles.js (flat counters) and modes/inferno.js
// (records.inferno): this module only ever touches records.pb.
import { boardView, BOARD, periodEnd, fmtValue } from './boards.js';
import { clock, dur, short, int } from './fmt.js';

/** roster.records.pb — { [key]: { v, t, name, cls, sub, prev } } */
export function pbStore(account) {
  const r = account?.roster; if (!r) return {};
  r.records ||= {};
  if (!r.records.pb || typeof r.records.pb !== 'object') r.records.pb = {};
  return r.records.pb;
}
/**
 * Offer a value for a personal record. better: 'lower' | 'higher'.
 * → { improved, first, prev, rec } (the account is saved when it improves)
 */
export function recordPB(account, key, value, better, meta = {}) {
  if (!account || !(typeof value === 'number' && isFinite(value))) return { improved: false };
  const S = pbStore(account), cur = S[key];
  const improved = !cur || (better === 'lower' ? value < cur.v : value > cur.v);
  if (improved) {
    S[key] = { v: value, t: Date.now(), name: meta.name || null, cls: meta.cls || null, sub: meta.sub || '', label: meta.label || key, unit: meta.unit || 'time', prev: cur ? cur.v : null };
    account.save?.();
  }
  return { improved, first: !cur, prev: cur ? cur.v : null, rec: S[key] };
}
/** Personal records as rows for the records tab: [{ key, label, display, sub, name, cls, t }] (newest first). */
export function recordRows(account) {
  const S = pbStore(account);
  return Object.entries(S).map(([key, r]) => ({ key, label: r.label || key, display: fmtValue(r.unit || 'time', r.v), sub: r.sub || '', name: r.name, cls: r.cls, t: r.t, prev: r.prev != null ? fmtValue(r.unit || 'time', r.prev) : null }))
    .sort((a, b) => (b.t || 0) - (a.t || 0));
}

/**
 * News entry for the title screen's news carousel (ui.screen('title', { news: [...] })), e.g.
 *   news: [legionRaceNews(session.account), ...NEWS]
 * → { tag: 'Race', title, date, body, art }
 */
export function legionRaceNews(account = null, now = Date.now()) {
  const first = boardView('legion_first', '', { now, limit: 3 });
  const nm = boardView('legion_nm', 'full', { now, limit: 1 });
  const hm = boardView('legion_hm', 'full', { now, limit: 1 });
  const left = periodEnd(BOARD.legion_nm, now) - now;
  const parts = [];
  const f = first?.rows?.[0];
  if (f) parts.push(`World First: ${f.name}${f.guild ? ` of ${f.guild}` : ''}, ${dur(f.value)} after the reset.`);
  else parts.push('Nobody has felled Gorrath yet this week — World First is still open.');
  if (nm?.rows?.[0]) parts.push(`Fastest Normal: ${clock(nm.rows[0].value)} (${nm.rows[0].name}).`);
  if (hm?.rows?.[0]) parts.push(`Hard: ${clock(hm.rows[0].value)}.`);
  const yours = [first?.you, nm?.you].find(Boolean);
  if (yours) parts.push(`Your best: #${int(yours.rank)}.`);
  else if (account) parts.push('Eight Shardbearers. Two gates. Your name belongs up there.');
  return { tag: 'Race', title: 'Weekly Legion Race', date: `${int((first?.total || 0))} clears so far · resets in ${dur(left)}`, body: parts.join(' '), art: 2 };
}

/** One-line summary of a personal-best improvement for toasts: "Rimewing 1:38.8 (−12.4 s)". */
export function pbLine(label, unit, value, prev) {
  const v = fmtValue(unit, value);
  if (prev == null) return `${label} ${v}`;
  if (unit === 'time') return `${label} ${v} (−${(prev - value).toFixed(1)} s)`;
  if (unit === 'dps') return `${label} ${v} (+${short(value - prev)})`;
  if (unit === 'floor') return `${label} ${v} (+${Math.round(value - prev)})`;
  return `${label} ${v}`;
}
