// Gear, accessories, ability stones, bracelets, engraving books and gems: creation, item level, stats and quality.
// Honing (the slot-machine at the blacksmith) with falling success rates, failure bonus, boosters and Artisan's Energy.
import { SETS, GEAR_SLOTS, gearName } from '../../data/items.js';
import { COMBAT_ENGRAVINGS, ENGRAVINGS } from '../../data/engravings.js';
import { uid } from '../../core/util.js';

const R = () => Math.random();
const pick = a => a[Math.floor(R() * a.length)];

/** Lost Ark-like quality roll: most pieces land 30–80, 100 is rare. */
export function rollQuality() { const r = (R() + R() + R()) / 3; return Math.max(0, Math.min(100, Math.round(r * 105 - 2))); }
export const qualityColor = q => q >= 100 ? '#ff9a2a' : q >= 90 ? '#c86bff' : q >= 70 ? '#4fa3ff' : q >= 30 ? '#8bd96b' : q >= 10 ? '#e8d84a' : '#e84a4a';

export function makeGear(set, slot, cls, o = {}) {
  const S = SETS[set];
  const it = { uid: uid('g'), id: `gear:${set}:${slot}`, kind: slot === 'weapon' ? 'weapon' : 'armor', slot, set, cls: slot === 'weapon' ? cls : null,
    name: gearName(set, slot, cls), grade: o.grade ?? S.grade, hone: o.hone ?? 0, quality: o.quality ?? rollQuality(), bound: 'char', count: 1,
    icon: slot === 'weapon' ? `item:weapon:${cls}:t${Math.max(0, S.tier)}` : `item:${slot}:t${Math.max(0, S.tier)}` };
  it.iLvl = gearIlvl(it, o.level);
  it.stats = gearStats(it);
  return it;
}
export function gearIlvl(it, level) {
  const S = SETS[it.set];
  if (it.set === 'story') return it.iLvl ?? Math.round((level || 1) * 20);
  return S.base + it.hone * S.per;
}
export function gearStats(it) {
  const f = it.iLvl / 1000;
  if (it.slot === 'weapon') return { might: Math.round(20000 * f * f), wpn: Math.round(34000 * f * f * (1 + it.quality / 1000)) };
  return { might: Math.round(9000 * f * f), hp: Math.round(9000 * f * (1 + it.quality / 800)) };
}
/** story drop for levels 1–50 */
export function storyGear(level, slot, cls, grade = 1) {
  const it = makeGear('story', slot, cls, { grade, quality: rollQuality() });
  it.iLvl = Math.round(level * 20 + grade * 8);
  it.name = `${['Worn', 'Sturdy', 'Fine', 'Heroic', 'Ancestral'][Math.min(4, grade)]} ${it.name.replace('Adventurer’s ', '')}`;
  it.stats = gearStats(it);
  return it;
}

// ---------------------------------------------------------------- honing
export const HONE_RATES = {
  1: [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.2, 0.15, 0.15, 0.1, 0.1, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03],
  2: [1, 1, 1, 0.8, 0.6, 0.45, 0.35, 0.3, 0.3, 0.25, 0.2, 0.15, 0.1, 0.1, 0.1, 0.08, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.02, 0.015, 0.01],
};
export function honeCost(it) {
  const S = SETS[it.set]; const n = it.hone + 1, t = S.tier;
  const k = 1 + n * 0.12;
  const stone = it.slot === 'weapon' ? 'destruction_stone' : 'guardian_stone';
  const c = { [stone]: Math.round((it.slot === 'weapon' ? 220 : 130) * k * (t === 2 ? 1.6 : 1)), leapstone: Math.round((4 + n * 0.6) * (t === 2 ? 1.5 : 1)), fusion: n >= 6 ? Math.round(2 + n * 0.4) : 0, shards: Math.round((it.slot === 'weapon' ? 420 : 250) * k), silver: Math.round(12000 * k * (t === 2 ? 1.5 : 1)), gold: n >= 8 ? Math.round((n - 6) * (it.slot === 'weapon' ? 30 : 18) * (t === 2 ? 1.6 : 1)) : 0 };
  if (t === 2) c.horn_shard = Math.round(2 + n * 0.8);
  for (const k2 of Object.keys(c)) if (!c[k2]) delete c[k2];
  return c;
}
/** chance breakdown for the next attempt. boosters: { solar_grace, solar_blessing, solar_protection } counts */
export function honeChance(it, boosters = {}) {
  const S = SETS[it.set]; const base = HONE_RATES[S.tier]?.[it.hone] ?? 0;
  const st = it.honeState || { fails: 0, energy: 0 };
  const failBonus = Math.min(base, base * 0.1 * st.fails);
  const boost = Math.min(base, (boosters.solar_grace || 0) * base * 0.0835 + (boosters.solar_blessing || 0) * base * 0.167 + (boosters.solar_protection || 0) * base * 0.5);
  const total = Math.min(1, base + failBonus + boost);
  return { base, failBonus, boost, total, energy: st.energy, guaranteed: st.energy >= 1 };
}
export const BOOSTER_CAP = { solar_grace: 12, solar_blessing: 6, solar_protection: 2 };
/**
 * Attempt to hone. has(id, n) / take(id, n) check/spend materials & currencies (account helpers).
 * Returns { ok: false, why } or { ok: true, success, chance, energy, hone }.
 */
export function hone(it, boosters, has, take, rng = Math.random) {
  const S = SETS[it.set];
  if (!S || it.hone >= S.max) return { ok: false, why: 'max' };
  const cost = honeCost(it);
  for (const [k, v] of Object.entries(cost)) if (!has(k, v)) return { ok: false, why: 'materials', need: k };
  for (const [k, v] of Object.entries(boosters || {})) if (v && !has(k, v)) return { ok: false, why: 'materials', need: k };
  for (const [k, v] of Object.entries(cost)) take(k, v);
  for (const [k, v] of Object.entries(boosters || {})) if (v) take(k, v);
  const ch = honeChance(it, boosters);
  const st = it.honeState || (it.honeState = { fails: 0, energy: 0 });
  const success = ch.guaranteed || rng() < ch.total;
  if (success) { it.hone++; it.honeState = { fails: 0, energy: 0 }; it.iLvl = gearIlvl(it); it.stats = gearStats(it); }
  else { st.fails++; st.energy = Math.min(1, st.energy + ch.total * 0.465); }
  return { ok: true, success, chance: ch.total, energy: it.honeState.energy, hone: it.hone, guaranteed: ch.guaranteed };
}
/** Quality upgrade at the blacksmith: rolls again, never goes down. */
export function upgradeQuality(it) { const q = rollQuality(); const old = it.quality; it.quality = Math.max(it.quality, q); it.stats = gearStats(it); return { old, rolled: q, now: it.quality }; }
export const qualityCost = it => ({ silver: 20000, gold: it.slot === 'weapon' ? 30 : 12 });
/** Move the honing level of one set onto the next (successor transfer, Lost Ark style: +20 Vanguard → +10 Horned). */
export function transfer(it, toSet, cls) { const nh = Math.max(0, Math.round(it.hone / 2)); const n = makeGear(toSet, it.slot, cls || it.cls, { hone: nh, quality: it.quality }); return n; }

// ---------------------------------------------------------------- accessories, stones, bracelets, books, gems
const CSTATS = ['crit', 'spec', 'swift', 'dom', 'endur', 'expert'];
export function makeAccessory(slot, grade = 5, o = {}) {
  const base = slot === 'necklace' ? 'necklace' : slot.replace(/\d/, '');
  const q = o.quality ?? rollQuality();
  const mult = [0, 0, 0.5, 0.65, 0.8, 1, 1.15, 1.3][grade];
  const stats = {};
  if (base === 'necklace') { const a = o.stats?.[0] || pick(['crit', 'spec', 'swift']); let b = o.stats?.[1] || pick(['crit', 'spec', 'swift']); if (b === a) b = a === 'crit' ? 'swift' : 'crit'; stats[a] = Math.round((380 + q * 1.2) * mult); stats[b] = Math.round((380 + q * 1.2) * mult); }
  else { stats[o.stats?.[0] || pick(CSTATS.slice(0, 3))] = Math.round((220 + q * 0.7) * mult); }
  const e1 = o.engr?.[0] || pick(COMBAT_ENGRAVINGS), e2 = o.engr?.[1] || pick(COMBAT_ENGRAVINGS.filter(x => x !== e1));
  const hi = grade >= 6 ? 6 : grade >= 5 ? 5 : 3;
  const engr = [{ id: e1, v: 3 + Math.floor(R() * (hi - 2)) }, { id: e2, v: 3 + Math.floor(R() * (hi - 4)) }];
  const neg = { id: pick(['neg_atk', 'neg_speed', 'neg_def', 'neg_move']), v: 1 + Math.floor(R() * 3) };
  const names = { necklace: 'Necklace', earring: 'Earring', ring: 'Ring' };
  return { uid: uid('a'), id: `acc:${base}`, kind: 'accessory', slot: base, name: `${['', '', 'Polished', 'Radiant', 'Sunforged', 'Tyrant’s', 'Ancient', 'Primal'][grade]} ${names[base]}`, grade, quality: q, stats, engr, neg, bound: o.bound || null, count: 1, icon: `item:${base}`, iLvl: 0 };
}
export function makeStone(grade = 5, o = {}) {
  const facets = grade >= 6 ? 10 : grade >= 5 ? 9 : grade >= 4 ? 8 : 6;
  const e1 = o.lines?.[0] || pick(COMBAT_ENGRAVINGS), e2 = o.lines?.[1] || pick(COMBAT_ENGRAVINGS.filter(x => x !== e1));
  const n = o.lines?.[2] || pick(['neg_atk', 'neg_speed', 'neg_def', 'neg_move']);
  return { uid: uid('s'), id: 'stone', kind: 'stone', slot: 'stone', name: `${['', '', 'Rare', 'Epic', 'Legendary', 'Relic', 'Ancient', 'Primal'][grade]} Ability Stone`, grade, lines: [e1, e2, n], facets: [Array(facets).fill(0), Array(facets).fill(0), Array(facets).fill(0)], chance: 0.75, count: 1, icon: 'item:stone', bound: null, iLvl: 0 };
}
/** Facet one slot of a line (0/1 positive, 2 negative). Returns { ok, success, chance }. */
export function facet(stone, line, rng = Math.random) {
  const l = stone.facets[line]; const i = l.indexOf(0); if (i < 0) return { ok: false };
  const chance = stone.chance;
  const success = rng() < chance;
  l[i] = success ? 1 : -1;
  stone.chance = Math.min(0.75, Math.max(0.25, chance + (success ? -0.1 : 0.1)));
  return { ok: true, success, chance, next: stone.chance, done: stone.facets.every(x => !x.includes(0)) };
}
export const stoneScore = s => s.facets.map(l => l.filter(x => x === 1).length);   // e.g. [9, 7, 2] → "97 stone"
export function makeBracelet(grade = 5) {
  const lines = [];
  const n = grade >= 6 ? 4 : grade >= 5 ? 3 : 2;
  const pool = [
    () => ({ stat: pick(CSTATS.slice(0, 3)), v: 40 + Math.floor(R() * 80) }),
    () => ({ special: 'precision', desc: 'Crit Rate +3.4%.', mods: { crit: 0.034 } }),
    () => ({ special: 'strike', desc: 'Damage +2.5% vs. bosses.', mods: { dmgMul: 0.025 } }),
    () => ({ special: 'celerity', desc: 'Move Speed +4%.', mods: { moveSpd: 0.04 } }),
    () => ({ special: 'vigor', desc: 'Max HP +3%.', mods: {} }),
  ];
  for (let i = 0; i < n; i++) lines.push(pick(pool)());
  const stats = {}; for (const l of lines) if (l.stat) stats[l.stat] = (stats[l.stat] || 0) + l.v;
  return { uid: uid('b'), id: 'bracelet', kind: 'bracelet', slot: 'bracelet', name: `${['', '', '', '', 'Legendary', 'Relic', 'Ancient', 'Primal'][grade]} Bracelet`, grade, lines, stats, count: 1, icon: 'item:bracelet', iLvl: 0 };
}
export function makeBook(engr, grade = 4) { const e = ENGRAVINGS[engr]; return { uid: uid('k'), id: `book:${engr}`, kind: 'book', engr, name: `${e?.name || engr} Engraving Recipe`, grade, nodes: grade >= 4 ? 20 : grade >= 3 ? 10 : 5, count: 1, icon: `item:book:${engr}`, tradable: true }; }
export function makeGem(type, level = 1) { return { uid: uid('m'), id: `gem:${type}`, kind: 'gem', gem: type, level, name: `Lv.${level} ${type === 'ruin' ? 'Ruinstone' : 'Swiftstone'}`, grade: Math.min(7, 2 + Math.floor(level / 2)), count: 1, icon: `item:gem:${type}:${level}`, tradable: true, desc: type === 'ruin' ? `Damage of the socketed skill +${gemValue(type, level)}%.` : `Cooldown of the socketed skill −${gemValue(type, level)}%.` }; }
export const gemValue = (type, lv) => type === 'ruin' ? [0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 40][lv] : [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20][lv];
export const GEAR = { GEAR_SLOTS };
