// Party Finder: SimPlayer-led listings for every instanced activity (refreshed every 2 minutes, deterministic), with
// joinable parties. The lead spawns the other members with party.addSim(makeSim(seed), …).
import { makeSim } from '../social/names.js';
import { RNG, hashStr } from '../../core/noise.js';
import { CLASSES } from '../../data/classes/index.js';
import { CHAOS_LOOT, GUARDIAN_LOOT } from '../../data/loot.js';
import { itemLevel } from './stats.js';
import { ok, fail, MIN } from './common.js';

const REFRESH = 2 * MIN;
export function contents() {
  const out = [];
  for (const L of Object.values(CHAOS_LOOT)) out.push({ id: L.id, name: `Chaos Dungeon — ${L.name}`, ilvl: L.ilvl, max: 4 });
  for (const L of Object.values(GUARDIAN_LOOT)) out.push({ id: `guardian:${L.id}`, name: `Guardian Hunt — ${L.name}`, ilvl: L.ilvl, max: 4 });
  out.push({ id: 'abyss:oratory', name: 'Abyssal Dungeon — The Sunken Oratory', ilvl: 1325, max: 4 });
  out.push({ id: 'raid:gorrath:normal', name: 'Legion Raid — Gorrath (Normal)', ilvl: 1415, max: 8 });
  out.push({ id: 'raid:gorrath:hard', name: 'Legion Raid — Gorrath (Hard)', ilvl: 1445, max: 8 });
  return out;
}
const SHORT = { 'raid:gorrath:normal': 'Gorrath NM', 'raid:gorrath:hard': 'Gorrath HM', 'abyss:oratory': 'Oratory' };
const TEMPLATES = [
  (n, il) => `LF1 support ${n} ${il}+ know mechs`, (n, il) => `LF DPS ${n} ${il}+, chill run`, n => `${n} speedrun, exp only, no wipes pls`,
  n => `Learning party: ${n} first clear, be nice`, n => `${n} — need 1 more, leaving in 2 min`, n => `${n} carry available, 300g`,
  n => `${n} bus, bring snacks`, (n, il) => `${n} ${il}+ read the guide first`, n => `${n} — supports get free shields (probably)`,
];
const isSupport = cls => CLASSES[cls]?.role === 'support';
export function listings(account, char, { content, now = Date.now() } = {}) {
  const b = Math.floor(now / REFRESH), all = contents().filter(c => !content || c.id === content);
  const out = [];
  for (const C of all) {
    const r = new RNG(hashStr(`${C.id}:${b}`)), n = content ? r.int(6, 12) : r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const seed = hashStr(`${C.id}:${b}:${i}`), leader = makeSim(seed, { ilvl: Math.round(C.ilvl + r.next() * 60) });
      const size = r.int(1, C.max - 1), minIlvl = C.ilvl + (r.next() < 0.4 ? Math.round(r.next() * 20) : 0);
      const members = [{ name: leader.name, cls: leader.cls, ilvl: leader.ilvl, support: isSupport(leader.cls), seed }];
      for (let k = 1; k < size; k++) { const s2 = seed + k * 101, m = makeSim(s2, { ilvl: Math.round(minIlvl + r.next() * 50) }); members.push({ name: m.name, cls: m.cls, ilvl: m.ilvl, support: isSupport(m.cls), seed: s2 }); }
      const label = SHORT[C.id] || C.name.split(' — ')[1] || C.name;
      out.push({ id: `${C.id}#${b}#${i}`, content: C.id, title: C.name, desc: r.pick(TEMPLATES)(label, minIlvl), leader: { name: leader.name, cls: leader.cls, ilvl: leader.ilvl, title: leader.title, guild: leader.guild, persona: leader.persona },
        members, size, max: C.max, minIlvl, created: b * REFRESH - Math.round(r.next() * 10 * MIN) });
    }
  }
  const joined = account?.roster?.partyJoined;
  return out.filter(l => !(joined && joined.id === l.id && joined.full));
}
export function join(account, char, listingId, now = Date.now()) {
  const content = String(listingId).split('#')[0];
  const L = listings(account, char, { content, now }).find(x => x.id === listingId);
  if (!L) return fail('gone', 'That party has already left.');
  if (L.size >= L.max) return fail('full', 'That party is full.');
  const il = char ? itemLevel(char) : 0;
  if (il < L.minIlvl) return fail('ilvl', `This party wants item level ${L.minIlvl}+.`);
  account.roster.partyJoined = { id: L.id, t: now, full: L.size + 1 >= L.max };
  return ok({ content: L.content, sims: L.members.map(m => m.seed), members: L.members, max: L.max });
}
