// Loot rolling: reward tables (src/data/loot.js entry format) → bundles, including generated items (accessories,
// ability stones, bracelets, engraving books, gems) and cards. Deterministic when given an RNG.
import { makeAccessory, makeStone, makeBracelet, makeBook, makeGem } from './gear.js';
import { COMBAT_ENGRAVINGS } from '../../data/engravings.js';
import { ENGRAVING_DEMAND } from '../../data/loot.js';
import { CARD_LIST, CARDS } from '../../data/cards.js';
import { rngOf, seeded, addTo } from './common.js';

const ACC_SLOTS = [{ s: 'necklace', w: 1 }, { s: 'earring', w: 2 }, { s: 'ring', w: 2 }];
/** engraving id weighted by market demand */
export function randomEngraving(rng) {
  const r = rngOf(rng);
  return r.weighted(COMBAT_ENGRAVINGS.map(id => ({ id, w: ENGRAVING_DEMAND[id] || 1 }))).id;
}
/** gem level in [lo, hi], each level half as likely as the one below */
export function randomGemLevel(rng, lo, hi) {
  const r = rngOf(rng);
  const opts = []; for (let l = lo; l <= hi; l++) opts.push({ l, w: Math.pow(0.5, l - lo) });
  return r.weighted(opts).l;
}
export function randomCard(rng, grade, kind) {
  const r = rngOf(rng);
  const pool = CARD_LIST.filter(c => (grade == null || c.grade === grade) && (!kind || c.kind === kind));
  return pool.length ? r.pick(pool).id : null;
}

/** Generate one reward from a generator id. → { items: [Item] } | { cards: { id: 1 } } | null */
export function generate(id, rng) {
  const r = rngOf(rng);
  let m;
  if ((m = /^acc:(\d)$/.exec(id))) { const slot = r.weighted(ACC_SLOTS).s; return { items: [seeded(r, () => makeAccessory(slot, +m[1]))] }; }
  if ((m = /^stone:(\d)$/.exec(id))) return { items: [seeded(r, () => makeStone(+m[1]))] };
  if ((m = /^bracelet:(\d)$/.exec(id))) return { items: [seeded(r, () => makeBracelet(+m[1]))] };
  if ((m = /^book:(\d)$/.exec(id))) return { items: [makeBook(randomEngraving(r), +m[1])] };
  if ((m = /^gem:(\d+)-(\d+)$/.exec(id))) return { items: [makeGem(r.chance(0.5) ? 'ruin' : 'swift', randomGemLevel(r, +m[1], +m[2]))] };
  if ((m = /^card:(.+)$/.exec(id))) return CARDS[m[1]] ? { cards: { [m[1]]: 1 } } : null;
  if ((m = /^card@(\d)$/.exec(id))) { const c = randomCard(r, +m[1]); return c ? { cards: { [c]: 1 } } : null; }
  return null;
}
export const isGenerator = id => /[:@]/.test(id);

/**
 * Roll a table into a bundle. opts: { mul (numeric multiplier, default 1), mulBy: { id: extraMul } (per-id
 * multipliers, e.g. { silver: 1.1 }), into (bundle to add to), times (roll generators this many times) }.
 */
export function rollTable(table, rng, opts = {}) {
  const r = rngOf(rng), out = opts.into || {};
  const mul = opts.mul ?? 1, per = opts.mulBy || {};
  for (const e of table || []) {
    const p = e.p ?? 1;
    if (isGenerator(e.id)) {
      for (let t = 0; t < (opts.times || 1); t++) {
        if (p < 1 && !r.chance(p)) continue;
        const n = r.int(e.n[0], e.n[1]);
        for (let i = 0; i < n; i++) {
          const g = generate(e.id, r); if (!g) continue;
          if (g.items) (out.items ||= []).push(...g.items);
          if (g.cards) { out.cards ||= {}; for (const [c, k] of Object.entries(g.cards)) out.cards[c] = (out.cards[c] || 0) + k; }
        }
      }
      continue;
    }
    if (p < 1 && !r.chance(p)) continue;
    const n = r.int(e.n[0], e.n[1]);
    addTo(out, e.id, Math.round(n * mul * (per[e.id] ?? per['*'] ?? 1)));
  }
  return out;
}
/** Expected value of a table's numeric parts (for previews and the economy model). */
export function expectTable(table, mul = 1) {
  const o = {};
  for (const e of table || []) { if (isGenerator(e.id)) continue; o[e.id] = (o[e.id] || 0) + (e.p ?? 1) * (e.n[0] + e.n[1]) / 2 * mul; }
  return o;
}
/** Human preview rows for a table: [{ id, min, max, chance }] */
export function previewTable(table) { return (table || []).map(e => ({ id: e.id, min: e.n[0], max: e.n[1], chance: e.p ?? 1 })); }
