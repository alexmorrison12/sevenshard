// Cards: collection, card packs (incl. the Legendary selector), awakening 0–5 with duplicates, the 6-card deck and
// set bonuses by count and total awakening. State: roster.cards[id] = { n: duplicates, awaken }, roster.deck,
// roster.cardChoice (pending selector). cardMods()/mods() export the stat mods for stats (see mods.js).
import { CARDS, CARD_LIST, CARD_SETS, CARD_PACKS, AWAKEN_DUPES, DECK_SIZE } from '../../data/cards.js';
import { ok, fail, rngOf, addCardRaw, pay, emit } from './common.js';

export { CARDS, CARD_LIST, CARD_SETS, CARD_PACKS };
export const MAX_AWAKEN = 5;

function st(account) {
  const r = account.roster;
  if (!r.cards || typeof r.cards !== 'object') r.cards = {};
  if (!Array.isArray(r.deck)) r.deck = [];
  r.deck = r.deck.slice(0, DECK_SIZE).map(id => (id && r.cards[id] ? id : null));
  while (r.deck.length < DECK_SIZE) r.deck.push(null);
  return r;
}
/** { dupes, silver } to go from `level` to level + 1, or null at max */
export function awakenCost(id, level) {
  const c = CARDS[id]; if (!c || level >= MAX_AWAKEN) return null;
  return { dupes: AWAKEN_DUPES[level], silver: c.grade * 800 * (level + 1) };
}
const cardRow = (account, id) => { const c = CARDS[id], s = account.roster.cards[id]; return { id, name: c.name, grade: c.grade, isNew: false, dupes: s?.n || 0, awaken: s?.awaken || 0 }; };

function rollCard(r, P) {
  const grade = +r.weighted(Object.entries(P.grades).map(([g, w]) => ({ g, w }))).g;
  let pool = CARD_LIST.filter(c => c.grade === grade && (!P.kind || c.kind === P.kind));
  if (!pool.length) pool = CARD_LIST.filter(c => c.grade === grade);
  // Vorrathis is a very rare pull: re-roll it away 3 times out of 4
  let c = r.pick(pool);
  if (c.id === 'vorrathis' && r.next() < 0.75) c = r.pick(pool);
  return c.id;
}
/** Open a card pack item. Selector packs return `choose` (resolve with choose()). */
export function openPack(account, packId = 'card_pack', { rng } = {}) {
  const P = CARD_PACKS[packId]; if (!P) return fail('unknown', 'That is not a card pack.');
  const r0 = st(account);
  if (r0.cardChoice) return fail('pending', 'Pick a card from your Legendary Card Selector first.');
  if (!account.take(packId, 1)) return fail('none', `You have no ${P.name}.`);
  const r = rngOf(rng);
  if (P.choose) {
    const opts = [];
    for (let i = 0; i < 20 && opts.length < P.choose; i++) { const id = rollCard(r, P); if (!opts.includes(id)) opts.push(id); }
    r0.cardChoice = { pack: packId, options: opts };
    account.save();
    return ok({ pack: packId, cards: [], choose: opts });
  }
  const id = rollCard(r, P);
  const res = addCardRaw(account, id, 1);
  account.save();
  const notes = emit(account, null, 'card', { id, isNew: res.isNew, pack: packId });
  return ok({ pack: packId, cards: [{ ...cardRow(account, id), isNew: res.isNew }], choose: null, notes });
}
/** Resolve a pending Legendary Card Selector. */
export function choose(account, index) {
  const r = st(account), ch = r.cardChoice;
  if (!ch) return fail('none', 'There is no card to choose.');
  const id = ch.options[index]; if (!id) return fail('index', 'Pick one of the offered cards.');
  r.cardChoice = null;
  const res = addCardRaw(account, id, 1);
  account.save();
  emit(account, null, 'card', { id, isNew: res.isNew, pack: ch.pack });
  return ok({ card: { ...cardRow(account, id), isNew: res.isNew } });
}
/** Add cards directly (rewards). */
export function addCard(account, id, n = 1) { if (!CARDS[id]) return fail('unknown', 'Unknown card.'); const res = addCardRaw(account, id, n); account.save(); return ok(res); }

export function awaken(account, cardId) {
  const r = st(account), s = r.cards[cardId];
  if (!CARDS[cardId]) return fail('unknown', 'Unknown card.');
  if (!s) return fail('owned', 'You do not own this card yet.');
  const cost = awakenCost(cardId, s.awaken);
  if (!cost) return fail('max', 'This card is fully awakened.');
  if (s.n < cost.dupes) return fail('dupes', `Awakening needs ${cost.dupes} duplicate${cost.dupes > 1 ? 's' : ''}.`, { cost });
  if (!pay(account, { silver: cost.silver })) return fail('materials', 'Not enough silver.', { cost });
  s.n -= cost.dupes; s.awaken++;
  account.save();
  const notes = emit(account, null, 'awaken', { id: cardId, awaken: s.awaken });
  return ok({ id: cardId, awaken: s.awaken, cost, notes });
}
export function setDeck(account, slot, cardId) {
  const r = st(account);
  if (slot < 0 || slot >= DECK_SIZE) return fail('slot', 'No such deck slot.');
  if (cardId != null) {
    if (!CARDS[cardId]) return fail('unknown', 'Unknown card.');
    if (!r.cards[cardId]) return fail('owned', 'You do not own this card.');
    const at = r.deck.indexOf(cardId); if (at >= 0) r.deck[at] = null;
  }
  r.deck[slot] = cardId ?? null;
  account.save();
  return ok({ deck: r.deck.slice() });
}

// ------------------------------------------------------------------------------------------------ set bonuses
function setState(deck, cards) {
  return Object.values(CARD_SETS).map(S => {
    const inDeck = S.cards.filter(id => deck.includes(id));
    const awk = inDeck.reduce((a, id) => a + (cards[id]?.awaken || 0), 0);
    const reached = S.bonuses.map(b => inDeck.length >= b.n && awk >= b.awk);
    // within a chain only the last reached bonus is active
    const active = S.bonuses.map((b, i) => reached[i] && !S.bonuses.some((b2, j) => j > i && b2.chain === b.chain && reached[j]));
    return { S, inDeck, awk, reached, active };
  });
}
function sumMods(list) {
  const m = { dmgAdd: 0, crit: 0, critDmg: 0, dmgTaken: 0, hpMaxMul: 0, healMul: 0, shieldMul: 0, silverGain: 0, xpGain: 0, elemRes: 0, dotMul: 0, seedSense: 0 };
  for (const mods of list) for (const [k, v] of Object.entries(mods)) m[k] = k === 'seedSense' ? Math.max(m[k], v) : (m[k] || 0) + v;
  return m;
}
/** Active set bonuses of the current deck → { mods, active: [{ set, name, desc }] } */
export function mods(account) {
  const r = st(account), active = [], list = [];
  for (const s of setState(r.deck, r.cards)) s.S.bonuses.forEach((b, i) => { if (s.active[i]) { active.push({ set: s.S.id, name: s.S.name, desc: b.desc }); list.push(b.mods); } });
  return { mods: sumMods(list), active };
}
export const cardMods = mods;
const VALUE = { dmgAdd: 100, crit: 80, critDmg: 30, dmgTaken: -50, hpMaxMul: 30, healMul: 15, shieldMul: 15, elemRes: 15, dotMul: 8, silverGain: 25, xpGain: 15, seedSense: 1 };
const score = m => Object.entries(m).reduce((a, [k, v]) => a + (VALUE[k] || 0) * v, 0);
/** Fill the deck with the owned set that gives the most value (ties → more awakening). */
export function autoDeck(account) {
  const r = st(account); let best = null;
  for (const S of Object.values(CARD_SETS)) {
    const own = S.cards.filter(id => r.cards[id]).sort((a, b) => (r.cards[b].awaken - r.cards[a].awaken) || CARDS[b].grade - CARDS[a].grade).slice(0, DECK_SIZE);
    const rest = Object.keys(r.cards).filter(id => !own.includes(id)).sort((a, b) => (r.cards[b].awaken - r.cards[a].awaken) || CARDS[b].grade - CARDS[a].grade);
    const deck = [...own, ...rest].slice(0, DECK_SIZE); while (deck.length < DECK_SIZE) deck.push(null);
    const act = []; for (const s of setState(deck, r.cards)) s.S.bonuses.forEach((b, i) => s.active[i] && act.push(b.mods));
    const v = score(sumMods(act)) + deck.reduce((a, id) => a + (id ? r.cards[id].awaken * 0.01 : 0), 0);
    if (!best || v > best.v) best = { v, deck, set: S.id };
  }
  if (!best) return fail('empty', 'You have no cards yet.');
  r.deck = best.deck; account.save();
  return ok({ deck: r.deck.slice(), set: best.set });
}

/** Everything the Cards window needs. */
export function view(account) {
  const r = st(account), deck = r.deck;
  const collection = CARD_LIST.map(c => {
    const s = r.cards[c.id], cost = s ? awakenCost(c.id, s.awaken) : null;
    return { id: c.id, name: c.name, grade: c.grade, kind: c.kind, sets: c.sets, owned: !!s, dupes: s?.n || 0, awaken: s?.awaken || 0, maxAwaken: MAX_AWAKEN,
      canAwaken: !!(s && cost && s.n >= cost.dupes && account.has('silver', cost.silver)), awakenCost: cost, inDeck: deck.includes(c.id), source: c.source, flavor: c.flavor, icon: `card:${c.id}` };
  });
  const sets = setState(deck, r.cards).map(s => ({ id: s.S.id, name: s.S.name, cards: s.S.cards.map(id => ({ id, name: CARDS[id].name, owned: !!r.cards[id], inDeck: deck.includes(id), awaken: r.cards[id]?.awaken || 0 })),
    inDeck: s.inDeck.length, awk: s.awk, bonuses: s.S.bonuses.map((b, i) => ({ n: b.n, awk: b.awk, desc: b.desc, active: s.active[i], reached: s.reached[i] })) }));
  const m = mods(account);
  return { deck: deck.slice(), deckAwaken: deck.reduce((a, id) => a + (id ? r.cards[id]?.awaken || 0 : 0), 0), collection, sets, mods: m.mods, active: m.active,
    packs: Object.keys(CARD_PACKS).map(id => ({ id, name: CARD_PACKS[id].name, count: account.count(id) })),
    choice: r.cardChoice ? { pack: r.cardChoice.pack, options: r.cardChoice.options.map(id => ({ id, name: CARDS[id].name, grade: CARDS[id].grade })) } : null,
    owned: collection.filter(c => c.owned).length, total: collection.length };
}
