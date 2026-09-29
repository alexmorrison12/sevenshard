// Engravings: reading books (learned points), equipping 2 engraving slots (+3…+12 nodes each), ability stone faceting
// with costs and "97 stone" detection, and the build summary with 5×3 detection.
// char.learned[engr] = learned points (Rare book 5, Epic 10, Legendary 20; max 80 → +12).
// char.books = [{ id, nodes, slot: 0|1 }] (the list data/engravings.js engravingNodes() reads).
import { ENGRAVINGS, COMBAT_ENGRAVINGS, engravingNodes, engravingLevels } from '../../data/engravings.js';
import { CLASSES } from '../../data/classes/index.js';
import { facet as gearFacet, stoneScore } from './gear.js';
import { ok, fail, pay, rngOf, emit } from './common.js';

export const LEARN_MAX = 80, LEARN_STEP = 20, MAX_EQUIP = 12;
export const FACET_COST = { 2: 600, 3: 900, 4: 1200, 5: 1680, 6: 2200, 7: 2800 };

const classEngr = (id) => { for (const K of Object.values(CLASSES)) { const e = K.engravings?.find(x => x.id === id); if (e) return e; } return null; };
export const engrName = id => ENGRAVINGS[id]?.name || classEngr(id)?.name || String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const engrDesc = id => ENGRAVINGS[id]?.desc || classEngr(id)?.desc || '';

/** learned points map (migrates equipped books of premade characters) */
export function learned(char) {
  if (!char.learned || typeof char.learned !== 'object') char.learned = {};
  const books = normBooks(char);
  for (const b of books) char.learned[b.id] = Math.max(char.learned[b.id] || 0, Math.ceil(b.nodes / 3) * LEARN_STEP);
  return char.learned;
}
function normBooks(char) {
  if (!Array.isArray(char.books)) char.books = [];
  char.books = char.books.filter(b => b && b.id).slice(0, 2);
  char.books.forEach((b, i) => { if (b.slot !== 0 && b.slot !== 1) b.slot = char.books.some(x => x !== b && x.slot === i) ? 1 - i : i; });
  return char.books;
}
export const equipMax = (char, id) => Math.min(MAX_EQUIP, Math.floor((learned(char)[id] || 0) / LEARN_STEP) * 3);

export function readBook(account, char, uid) {
  const i = (char.inv || []).findIndex(it => it.uid === uid && it.kind === 'book');
  if (i < 0) return fail('unknown', 'That book is not in your bag.');
  const it = char.inv[i], id = it.engr || it.id?.replace(/^book:/, '');
  const L = learned(char);
  if ((L[id] || 0) >= LEARN_MAX) return fail('max', `You have mastered ${engrName(id)}.`);
  char.inv.splice(i, 1);
  const points = it.nodes || 5;
  L[id] = Math.min(LEARN_MAX, (L[id] || 0) + points);
  account.save();
  const notes = emit(account, char, 'read', { engr: id, points });
  return ok({ engr: id, points, total: L[id], equipMax: equipMax(char, id), notes });
}
export function equip(account, char, slot, engr, nodes) {
  if (slot !== 0 && slot !== 1) return fail('slot', 'There are two engraving slots.');
  if (!COMBAT_ENGRAVINGS.includes(engr)) return fail('unknown', 'That is not a combat engraving.');
  const max = equipMax(char, engr);
  if (max <= 0) return fail('learn', `Read ${engrName(engr)} recipes first (20 points per +3).`);
  const n = nodes == null ? max : nodes;
  if (n <= 0 || n % 3 || n > max) return fail('nodes', `You can equip ${engrName(engr)} at +3 … +${max}.`);
  const books = normBooks(char);
  if (books.some(b => b.slot !== slot && b.id === engr)) return fail('duplicate', 'That engraving is already in the other slot.');
  char.books = books.filter(b => b.slot !== slot);
  char.books.push({ id: engr, nodes: n, slot });
  char.books.sort((a, b) => a.slot - b.slot);
  account.save();
  return ok({ slot, id: engr, nodes: n });
}
export function unequip(account, char, slot) {
  const books = normBooks(char); const had = books.some(b => b.slot === slot);
  char.books = books.filter(b => b.slot !== slot); account.save();
  return had ? ok({}) : fail('empty', 'That slot is empty.');
}

// ------------------------------------------------------------------------------------------------ build summary
export function summary(char) {
  normBooks(char);
  const nodes = engravingNodes(char), levels = engravingLevels(char);
  const src = {};
  const add = (id, kind, name, v) => { if (!id || !v) return; (src[id] ||= []).push({ kind, name, v }); };
  for (const b of char.books) add(b.id, 'book', `Engraving slot ${b.slot + 1}`, b.nodes);
  for (const it of Object.values(char.equip || {})) {
    if (!it) continue;
    for (const e of it.engr || []) add(e.id, 'accessory', it.name, e.v);
    if (it.neg) add(it.neg.id, 'accessory', it.name, it.neg.v);
    if (it.facets) (it.lines || []).forEach((id, i) => add(id, 'stone', it.name, it.facets[i].filter(x => x === 1).length));
  }
  for (const id of char.classEngr || []) (src[id] ||= []).push({ kind: 'class', name: 'Class engraving', v: 15 });
  const ids = new Set([...Object.keys(nodes).filter(k => nodes[k] > 0), ...(char.classEngr || [])]);
  const list = [...ids].map(id => ({ id, name: engrName(id), desc: engrDesc(id), nodes: (char.classEngr || []).includes(id) ? Math.max(15, nodes[id] || 0) : nodes[id] || 0,
    level: levels[id] || 0, negative: !!ENGRAVINGS[id]?.negative, cls: !!classEngr(id), sources: src[id] || [] }));
  list.sort((a, b) => a.negative - b.negative || b.level - a.level || b.nodes - a.nodes || a.name.localeCompare(b.name));
  const pos = list.filter(e => !e.negative), threes = pos.filter(e => e.level >= 3).length, fiveByThree = threes >= 5;
  const label = fiveByThree ? (threes > 5 ? `${threes}x3` : '5x3') : pos.filter(e => e.level >= 1).map(e => e.level).join(' ') || '—';
  return { list, threes, fiveByThree, label, negatives: list.filter(e => e.negative && e.level > 0).map(e => ({ id: e.id, name: e.name, level: e.level })) };
}

// ------------------------------------------------------------------------------------------------ ability stones
const findStone = (char, uid) => { const eq = char.equip?.stone; if (eq && (eq.uid === uid || uid == null)) return { stone: eq, equipped: true }; const it = (char.inv || []).find(x => x.uid === uid && x.kind === 'stone'); return it ? { stone: it, equipped: false } : null; };
export function stoneView(stone, equipped = false) {
  const sc = stoneScore(stone), [a, b] = [sc[0], sc[1]].sort((x, y) => y - x);
  const lines = stone.facets.map((l, i) => {
    const id = stone.lines[i], nodes = l.filter(x => x === 1).length;
    return { id, name: engrName(id), negative: i === 2 || !!ENGRAVINGS[id]?.negative, slots: l.slice(), success: nodes, fail: l.filter(x => x === -1).length, left: l.filter(x => x === 0).length, nodes, level: Math.min(3, Math.floor(nodes / 5)) };
  });
  return { uid: stone.uid, name: stone.name, grade: stone.grade, facets: stone.facets[0].length, chance: stone.chance, done: stone.facets.every(l => !l.includes(0)), equipped,
    lines, score: sc, label: a >= 10 || b >= 10 ? `${a}/${b}` : `${a}${b}`, is97: a >= 9 && b >= 7, cost: { silver: FACET_COST[stone.grade] || 800 } };
}
const shareOf = (stone, char) => { const v = stoneView(stone); return { kind: 'stone', label: v.label, score: v.score, lines: v.lines.map(l => l.name), grade: stone.grade, is97: v.is97, t: Date.now(), char: char ? { name: char.name, cls: char.cls } : null }; };
const betterStone = (a, b) => { if (!b) return true; const pa = a.score[0] + a.score[1], pb = b.score[0] + b.score[1]; return pa > pb || (pa === pb && a.score[2] < b.score[2]); };
export function bestStone(account) { return account.roster.stats?.bestStone || null; }

export function facet(account, char, stoneUid, line, { rng } = {}) {
  const f = findStone(char, stoneUid); if (!f) return fail('unknown', 'That ability stone is not in your bag.');
  const { stone } = f;
  if (!(line >= 0 && line <= 2)) return fail('line', 'Pick a line to facet.');
  if (stone.facets.every(l => !l.includes(0))) return fail('done', 'This stone is fully faceted.');
  if (!stone.facets[line].includes(0)) return fail('full', 'That line is fully faceted.');
  const cost = { silver: FACET_COST[stone.grade] || 800 };
  if (!pay(account, cost)) return fail('materials', 'Not enough silver.', { cost });
  const r = rngOf(rng);
  const res = gearFacet(stone, line, () => r.next());
  const v = stoneView(stone, f.equipped);
  let share = null;
  if (res.done) {
    share = shareOf(stone, char);
    const st = account.roster.stats ||= {};
    if (betterStone(share, st.bestStone)) st.bestStone = share;
  }
  account.save();
  const notes = emit(account, char, 'facet', { success: res.success, line, done: !!res.done, is97: !!(res.done && v.is97), score: v.score });
  return ok({ success: res.success, chance: res.chance, next: res.next, done: !!res.done, cost, stone: v, share, notes });
}

export function view(account, char) {
  const books = normBooks(char), L = learned(char);
  const slots = [0, 1].map(s => { const b = books.find(x => x.slot === s); return b ? { slot: s, id: b.id, name: engrName(b.id), nodes: b.nodes, max: equipMax(char, b.id) } : null; });
  const stones = [];
  if (char.equip?.stone) stones.push(stoneView(char.equip.stone, true));
  for (const it of char.inv || []) if (it.kind === 'stone') stones.push(stoneView(it, false));
  return {
    slots,
    learned: Object.entries(L).filter(([, p]) => p > 0).map(([id, points]) => ({ id, name: engrName(id), points, max: LEARN_MAX, equipMax: equipMax(char, id) })).sort((a, b) => b.points - a.points),
    books: (char.inv || []).filter(it => it.kind === 'book').map(it => ({ uid: it.uid, engr: it.engr, name: it.name, grade: it.grade, points: it.nodes || 5 })),
    summary: summary(char),
    stones,
  };
}
