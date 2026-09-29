// Gems: 11 sockets bound to skills (Ruinstone = +damage%, Swiftstone = −cooldown%), 3 → 1 fusion up to Lv.10,
// socket / unsocket / re-target, gem pouches, and per-skill mods for the skill runner.
// Loose gems are char.inv items (kind 'gem'); sockets are char.gems = [Gem|null ×11] with gem.skill = skill id.
import { makeGem, gemValue } from './gear.js';
import { CLASSES } from '../../data/classes/index.js';
import { randomGemLevel } from './rolls.js';
import { ok, fail, rngOf, pay, emit } from './common.js';

export const SOCKETS = 11;
export const MAX_LEVEL = 10;
export const fuseCost = level => ({ silver: level * 2000 });
export const POUCHES = { gem_pouch: [1, 3], gem_pouch_hi: [3, 5] };

export function sockets(char) {
  if (!Array.isArray(char.gems)) char.gems = [];
  while (char.gems.length < SOCKETS) char.gems.push(null);
  if (char.gems.length > SOCKETS) char.gems.length = SOCKETS;
  return char.gems;
}
/** the character's skills [{ id, name }] */
export function skillList(char) {
  const K = CLASSES[char.cls];
  if (K?.skills?.length) return K.skills.map(s => ({ id: s.id, name: s.name }));
  return Object.keys(char.skills || {}).map(id => ({ id, name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
}
const isGem = it => it && it.kind === 'gem' && (it.gem === 'ruin' || it.gem === 'swift');
const bag = char => (char.inv || []).filter(isGem);
const gemDesc = (type, lv) => type === 'ruin' ? `Damage of the socketed skill +${gemValue(type, lv)}%.` : `Cooldown of the socketed skill −${gemValue(type, lv)}%.`;

export function socket(account, char, gemUid, idx, skillId) {
  const S = sockets(char);
  if (!(idx >= 0 && idx < SOCKETS)) return fail('socket', 'No such gem socket.');
  const gi = (char.inv || []).findIndex(it => it.uid === gemUid && isGem(it));
  if (gi < 0) return fail('unknown', 'That gem is not in your bag.');
  if (!skillList(char).some(s => s.id === skillId)) return fail('skill', 'Pick one of your skills.');
  const gem = char.inv[gi];
  if (S.some((g, i) => i !== idx && g && g.skill === skillId && g.gem === gem.gem)) return fail('duplicate', `That skill already has a ${gem.gem === 'ruin' ? 'Ruinstone' : 'Swiftstone'}.`);
  char.inv.splice(gi, 1);
  const replaced = S[idx]; if (replaced) { delete replaced.skill; char.inv.push(replaced); }
  S[idx] = { ...gem, skill: skillId };
  account.save();
  return ok({ replaced: replaced || null });
}
export function unsocket(account, char, idx) {
  const S = sockets(char), g = S[idx];
  if (!g) return fail('empty', 'That socket is empty.');
  S[idx] = null; delete g.skill; (char.inv ||= []).push(g);
  account.save();
  return ok({ gem: g });
}
export function assign(account, char, idx, skillId) {
  const S = sockets(char), g = S[idx];
  if (!g) return fail('empty', 'That socket is empty.');
  if (!skillList(char).some(s => s.id === skillId)) return fail('skill', 'Pick one of your skills.');
  if (S.some((x, i) => i !== idx && x && x.skill === skillId && x.gem === g.gem)) return fail('duplicate', `That skill already has a ${g.gem === 'ruin' ? 'Ruinstone' : 'Swiftstone'}.`);
  g.skill = skillId; account.save();
  return ok({});
}
/** Fuse 3 loose gems of (type, level) into 1 of level + 1, `count` times. Always succeeds. */
export function fuse(account, char, type, level, { count = 1 } = {}) {
  if (type !== 'ruin' && type !== 'swift') return fail('type', 'Unknown gem type.');
  if (!(level >= 1 && level < MAX_LEVEL)) return fail('level', 'Gems fuse up to Lv.10.');
  const made = [], spent = { silver: 0 };
  for (let k = 0; k < Math.max(1, count | 0); k++) {
    const pool = bag(char).filter(g => g.gem === type && g.level === level).slice(0, 3);
    if (pool.length < 3) break;
    if (!pay(account, fuseCost(level))) { if (!made.length) return fail('materials', 'Not enough silver.', { cost: fuseCost(level) }); break; }
    spent.silver += fuseCost(level).silver;
    for (const g of pool) char.inv.splice(char.inv.indexOf(g), 1);
    const n = makeGem(type, level + 1); char.inv.push(n); made.push(n);
  }
  if (!made.length) return fail('count', 'Fusion needs three gems of the same type and level.');
  account.save();
  const notes = emit(account, char, 'fuse', { type, level: level + 1, count: made.length });
  return ok({ made, cost: spent, notes });
}
export function openPouch(account, char, pouchId = 'gem_pouch', { rng } = {}) {
  const range = POUCHES[pouchId]; if (!range) return fail('unknown', 'That is not a gem pouch.');
  if (!account.take(pouchId, 1)) return fail('none', 'You have no gem pouch.');
  const r = rngOf(rng);
  const gem = makeGem(r.chance(0.5) ? 'ruin' : 'swift', randomGemLevel(r, range[0], range[1]));
  (char.inv ||= []).push(gem); account.save();
  return ok({ gem });
}
/** Per-skill mods → { [skillId]: { dmg, cdr, ruin, swift } } */
export function mods(char) {
  const out = {};
  for (const g of sockets(char)) {
    if (!g || !g.skill) continue;
    const m = out[g.skill] ||= { dmg: 0, cdr: 0, ruin: 0, swift: 0 };
    if (g.gem === 'ruin') { m.dmg = Math.max(m.dmg, gemValue('ruin', g.level) / 100); m.ruin = Math.max(m.ruin, g.level); }
    else { m.cdr = Math.max(m.cdr, gemValue('swift', g.level) / 100); m.swift = Math.max(m.swift, g.level); }
  }
  return out;
}
export const gemMods = mods;
export function view(account, char) {
  const S = sockets(char), skills = skillList(char), names = Object.fromEntries(skills.map(s => [s.id, s.name])), m = mods(char);
  const groups = {};
  for (const g of bag(char)) { const k = `${g.gem}:${g.level}`; (groups[k] ||= { type: g.gem, level: g.level, count: 0 }).count++; }
  const fusable = Object.values(groups).filter(x => x.level < MAX_LEVEL).map(x => ({ ...x, cost: fuseCost(x.level), can: x.count >= 3 && account.has('silver', fuseCost(x.level).silver) }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.level - b.level);
  return {
    sockets: S.map((g, idx) => ({ idx, gem: g, skill: g?.skill || null, skillName: g?.skill ? names[g.skill] || g.skill : null, type: g?.gem || null, level: g?.level || 0, value: g ? gemValue(g.gem, g.level) : 0, desc: g ? gemDesc(g.gem, g.level) : '' })),
    bag: bag(char).sort((a, b) => b.level - a.level || a.gem.localeCompare(b.gem)),
    fusable,
    skills: skills.map(s => ({ id: s.id, name: s.name, ruin: m[s.id]?.ruin || 0, swift: m[s.id]?.swift || 0 })),
    mods: m,
  };
}
