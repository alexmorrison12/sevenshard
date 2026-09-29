// Challenge links: `?challenge=<base64url JSON>` — "Beat my Rimewing time 3:42".
// The title screen shows the challenge (a card beside the menu); after entering the world the player is offered the
// same content (session.launch); the next matching clear records whether they beat it (store.js challenges history).
//   challengeLink(ch) → URL · challengeText(ch) → brag line · encode/decode · readChallengeFromUrl()
// ch = { kind: 'guardian'|'raid'|'chaos'|'inferno', boss?, raid?, gate?, hard?, tier?, start?, name, cls, time?, floor?, deaths?, t }
import { PUBLIC_URL } from './remote.js';
import { RAIDS, GUARDIANS } from '../../data/raids.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { CLASSES } from '../../data/classes/index.js';
import { clock } from './fmt.js';
import { db, saveDb } from './store.js';
import { challengeWhat } from './ui.js';
import { itemLevel } from '../systems/stats.js';

const KINDS = ['guardian', 'raid', 'chaos', 'inferno'];
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

export function encodeChallenge(ch) {
  const o = { v: 1, k: ch.kind, n: String(ch.name || '').slice(0, 16), c: ch.cls };
  if (ch.boss) o.b = ch.boss; if (ch.raid) o.r = ch.raid; if (ch.gate != null) o.g = ch.gate; if (ch.hard) o.h = 1; if (ch.tier) o.tr = ch.tier; if (ch.start > 1) o.s = ch.start;
  if (ch.time) o.t = Math.round(ch.time * 10) / 10; if (ch.floor) o.f = ch.floor; if (ch.deaths != null) o.d = ch.deaths; o.w = Math.round((ch.t || Date.now()) / 1000);
  return b64u(JSON.stringify(o));
}
/** Parse + validate an untrusted code. → challenge or null */
export function decodeChallenge(code) {
  if (!code || typeof code !== 'string' || code.length > 600) return null;
  let o; try { o = JSON.parse(unb64u(code)); } catch { return null; }
  if (!o || typeof o !== 'object' || !KINDS.includes(o.k)) return null;
  const num = (v, a, b) => (typeof v === 'number' && isFinite(v) && v >= a && v <= b ? v : null);
  const ch = { kind: o.k, name: String(o.n || '').replace(/[^A-Za-zÀ-ÿ0-9 _'-]/g, '').slice(0, 16) || 'A Shardbearer', cls: CLASSES[o.c] ? o.c : 'reaver',
    time: num(o.t, 1, 86400), floor: num(o.f, 1, 100), deaths: num(o.d, 0, 99), t: (num(o.w, 1.5e9, 4e9) || 0) * 1000 || Date.now() };
  if (ch.kind === 'guardian') { if (!BOSS_DEFS[o.b] || !GUARDIANS.some(g => g.id === o.b)) return null; ch.boss = o.b; }
  if (ch.kind === 'raid') { const R = RAIDS[o.r]; const g = num(o.g, 0, 9); if (!R || g == null || !R.gates[g]) return null; ch.raid = o.r; ch.gate = g; ch.hard = !!o.h && !!R.ilvl.hard; ch.boss = R.gates[g].bosses[R.gates[g].bosses.length - 1]?.boss; }
  if (ch.kind === 'chaos') { ch.tier = num(o.tr, 1, 4) || 1; }
  if (ch.kind === 'inferno') { ch.start = num(o.s, 1, 100) || 1; if (!ch.floor) return null; }
  if (ch.kind !== 'inferno' && !ch.time) return null;
  return ch;
}
/** Where a friend should open the link: this page when it has a public address, else PUBLIC_URL. */
export function shareBase() {
  if (typeof location === 'undefined') return PUBLIC_URL;
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  const local = !/^https?:$/.test(location.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  return PUBLIC_URL && (framed || local) ? PUBLIC_URL : location.origin + location.pathname;
}
export const challengeLink = ch => `${shareBase()}?challenge=${encodeChallenge(ch)}`;
export function challengeText(ch) {
  const w = challengeWhat(ch);
  if (ch.kind === 'inferno') return `I reached floor ${ch.floor} of the Inferno${ch.time ? ` in ${clock(ch.time).replace(/\.\d$/, '')}` : ''} on SEVENSHARD. Go deeper.`;
  return `I cleared ${w.title} in ${clock(ch.time || 0)} on SEVENSHARD. Beat my time.`;
}
export function readChallengeFromUrl() {
  if (typeof location === 'undefined') return null;
  const code = new URLSearchParams(location.search).get('challenge');
  return code ? decodeChallenge(code) : null;
}
/** Remove ?challenge= from the address bar (it lives in the store once read). */
export function clearChallengeFromUrl() {
  try { const u = new URL(location.href); if (!u.searchParams.has('challenge')) return; u.searchParams.delete('challenge'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); } catch { /* */ }
}
/** Build a challenge from a clear (content + result + character). */
export function challengeFromClear(c, r, ch) {
  if (!c || !r?.cleared) return null;
  const base = { name: ch?.name, cls: ch?.cls, time: r.time, deaths: r.deaths ?? null, t: Date.now() };
  if (c.kind === 'guardian') return { ...base, kind: 'guardian', boss: c.boss };
  if (c.kind === 'raid' && RAIDS[c.raid]) return { ...base, kind: 'raid', raid: c.raid, gate: c.gate ?? 0, hard: !!c.hard, boss: RAIDS[c.raid].gates[c.gate ?? 0]?.bosses?.slice(-1)[0]?.boss };
  if (c.kind === 'chaos') return { ...base, kind: 'chaos', tier: c.tier || 1 };
  if (c.kind === 'inferno') return { ...base, kind: 'inferno', floor: r.floor, start: c.start || 1 };
  return null;
}
/** The content descriptor to launch for a challenge + whether the character may enter it. → { c, ok, why } */
export function contentFor(ch, char) {
  const il = char ? Math.floor(itemLevel(char)) : 0;
  if (ch.kind === 'guardian') { const g = GUARDIANS.find(x => x.id === ch.boss); return { c: { kind: 'guardian', boss: ch.boss }, ok: il >= (g?.ilvl || 0), need: g?.ilvl }; }
  if (ch.kind === 'raid') { const R = RAIDS[ch.raid], need = ch.hard ? R.ilvl.hard : R.ilvl.normal; return { c: { kind: 'raid', raid: ch.raid, gate: ch.gate, hard: !!ch.hard, trial: il < need }, ok: true, need, trial: il < need }; }
  if (ch.kind === 'chaos') { const need = [1100, 1250, 1400, 1500][(ch.tier || 1) - 1]; return { c: { kind: 'chaos', tier: ch.tier || 1 }, ok: il >= need, need }; }
  if (ch.kind === 'inferno') return { c: { kind: 'inferno', start: 1, party: 1 }, ok: true };
  return { c: null, ok: false };
}
/** Does a clear match the challenge's content? */
export function matches(ch, c) {
  if (!ch || !c || ch.kind !== c.kind) return false;
  if (ch.kind === 'guardian') return ch.boss === c.boss;
  if (ch.kind === 'raid') return ch.raid === c.raid && ch.gate === (c.gate ?? 0) && !!ch.hard === !!c.hard;
  if (ch.kind === 'chaos') return (ch.tier || 1) === (c.tier || 1);
  return ch.kind === 'inferno';
}
/** Record the outcome of an attempt. → { beaten, mine, theirs } */
export function recordAttempt(ch, c, r) {
  const inferno = ch.kind === 'inferno';
  const beaten = inferno
    ? (r.floor || 0) > (ch.floor || 0) || ((r.floor || 0) === ch.floor && !!ch.time && r.time < ch.time)
    : !!r?.cleared && r.time > 0 && r.time < ch.time;
  const D0 = db();
  D0.challenges.unshift({ ...ch, at: Date.now(), beaten: !!beaten, mine: inferno ? r.floor : r.time, cleared: !!r?.cleared });
  D0.challenges = D0.challenges.slice(0, 30);
  if (D0.challenge && matches(D0.challenge, c)) { D0.challenge.tries = (D0.challenge.tries || 0) + 1; if (beaten) { D0.challenge.state = 'beaten'; D0.challenge.beatenAt = Date.now(); } }
  saveDb();
  return { beaten: !!beaten, mine: inferno ? r.floor : r.time, theirs: inferno ? ch.floor : ch.time };
}
