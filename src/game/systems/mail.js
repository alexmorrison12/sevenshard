// Mailbox: welcome letters, the Powerpass Starter Crate, (tongue-in-cheek) compensation gifts, market sales and
// expired listings, event rewards. Attachments are bundles claimed onto the roster/character.
// State: roster.mail = [{ id, from, subject, body, kind, t, read, claimed, bundle, expires }].
import { ok, fail, grantBundle, bundleRows, isEmpty, DAY } from './common.js';
import { uid } from '../../core/util.js';
import { CARDS } from '../../data/cards.js';
import { TITLES } from '../../data/titles.js';
import { UNLOCK_NAMES } from '../../data/collectibles.js';

const MAX = 100;
const CATALOG = { cards: CARDS, titles: TITLES, ...UNLOCK_NAMES };
function box(account) { const r = account.roster; if (!Array.isArray(r.mail)) r.mail = []; return r.mail; }
function viewOf(m, now) {
  return { id: m.id, from: m.from, subject: m.subject, body: m.body, kind: m.kind, t: m.t, read: !!m.read, claimed: !!m.claimed, expires: m.expires, left: Math.max(0, m.expires - now),
    attachments: bundleRows(m.bundle || {}, CATALOG), hasItems: !m.claimed && !isEmpty(m.bundle) };
}
/** Put a letter in the mailbox. → Mail */
export function send(account, { from = 'Solmara Post', subject = '', body = '', kind = 'system', bundle = null, days = 30, t = Date.now() } = {}) {
  const b = bundle && !isEmpty(bundle) ? bundle : null;
  const m = { id: uid('mail'), from, subject, body, kind, t, read: false, claimed: !b, bundle: b, expires: t + days * DAY };
  const list = box(account); list.unshift(m);
  if (list.length > MAX) { const i = list.map(x => x.claimed).lastIndexOf(true); list.splice(i >= 0 ? i : list.length - 1, 1); }
  account.save();
  return viewOf(m, t);
}
export function inbox(account, now = Date.now()) {
  const list = box(account);
  const keep = list.filter(m => m.expires > now);
  if (keep.length !== list.length) { account.roster.mail = keep; account.save(); }
  const views = keep.slice().sort((a, b) => b.t - a.t).map(m => viewOf(m, now));
  return { unread: views.filter(m => !m.read).length, list: views };
}
export function read(account, id) {
  const m = box(account).find(x => x.id === id); if (!m) return fail('unknown', 'No such letter.');
  m.read = true; account.save();
  return ok({ mail: viewOf(m, Date.now()) });
}
export function claim(account, char, id) {
  const m = box(account).find(x => x.id === id); if (!m) return fail('unknown', 'No such letter.');
  if (m.claimed) return fail('claimed', 'Nothing left to claim.');
  m.claimed = true; m.read = true;
  const rows = grantBundle(account, char, m.bundle || {});
  return ok({ rows: rows.map(r => { const [list, key] = String(r.id).split(':'); const c = CATALOG[list]?.[key]; return c ? { ...r, name: c.name } : r; }) });
}
export function claimAll(account, char) {
  const out = [];
  for (const m of box(account).slice()) if (!m.claimed) { const r = claim(account, char, m.id); if (r.ok) out.push(...r.rows); }
  return ok({ rows: out });
}
export function remove(account, id) {
  const list = box(account), i = list.findIndex(x => x.id === id); if (i < 0) return fail('unknown', 'No such letter.');
  if (!list[i].claimed && !isEmpty(list[i].bundle)) return fail('attachments', 'Claim the attachments first.');
  list.splice(i, 1); account.save();
  return ok({});
}

// ------------------------------------------------------------------------------------------------ letters
export const POWERPASS_CRATE = {
  silver: 1050000, gold: 4500, shards: 40000, guardian_stone: 6000, destruction_stone: 2000, leapstone: 260, fusion: 150, horn_shard: 40,
  solar_grace: 24, solar_blessing: 16, solar_protection: 6, card_pack: 5, gem_pouch: 3, hp_potion: 30, feather: 3,
};
const APOLOGIES = [
  'Please accept our sincere apologies for the unscheduled maintenance of the Glass Sea. A seagull flew into the server rack and refused to leave until it was given a title.',
  'We have received reports that Old Thunderhoof arrived eleven seconds late to his hourly appearance. This is unacceptable, and he has been spoken to.',
  'Due to an issue with Artisan’s Energy, several anvils apologised in the wrong order. The anvils have been re-educated.',
  'A Pip hid the patch notes. It took the entire team, three lanterns and a ladder to find them. Thank you for your patience.',
  'The market briefly listed a leapstone for 0.1 gold. It sold in 0.02 seconds. We are looking into who bought it (it was Bid Wars).',
  'Gorrath’s horns clipped through the ceiling of the Throne of Horns. He was very embarrassed. So were we.',
];
export function compensation(account, { reason, bundle = { crystals: 100, card_pack: 2 }, t = Date.now() } = {}) {
  const i = Math.floor((t / 3600e3) % APOLOGIES.length);
  return send(account, { from: 'The Solmara-1 Team', subject: 'Compensation: our sincere apologies', kind: 'compensation', bundle, t,
    body: `Dear Shardbearer,\n\n${reason || APOLOGIES[i]}\n\nAs a token of our regret, please accept the attached gift.\n\nWarmly (and slightly embarrassed),\nThe Solmara-1 Team` });
}
/** Welcome letters: once per roster, and the Powerpass Starter Crate once per powerpass character. → [Mail] sent */
export function welcome(account, char, t = Date.now()) {
  const r = account.roster, out = [];
  r.flags ||= {};
  if (!r.flags.mailWelcome) {
    r.flags.mailWelcome = t;
    out.push(send(account, { from: 'Commander Brannoc Hale', subject: 'Welcome to Solhaven', kind: 'system', t, bundle: { silver: 50000, hp_potion: 20, card_pack: 1 },
      body: 'Shardbearer,\n\nBrighthold burned, but you walked out of the fire. Solhaven’s gates are open to you. Visit Hilda at the forge, the Rift Nexus when you are ready, and — Seraphine insists — the Pips.\n\nStand fast.\n— Brannoc' }));
    out.push(compensation(account, { t, bundle: { crystals: 100 } }));
  }
  if (char && char.powerpass && !char.premade && !char.mailWelcome) {
    char.mailWelcome = t;
    out.push(send(account, { from: 'Hilda Ironbrand', subject: 'Powerpass Starter Crate', kind: 'gift', t, days: 60, bundle: { ...POWERPASS_CRATE },
      body: `${char.name},\n\nThe Council sent your Vanguard set with a crate of honing materials. Hone to +12, bring me Horns of the Tyrant from the rifts and guardians, and I’ll reforge the lot into Horned Tyrant gear. Legion raid by the weekend.\n\n— Hilda, Master Blacksmith` }));
  }
  if (out.length) account.save();
  return out;
}
