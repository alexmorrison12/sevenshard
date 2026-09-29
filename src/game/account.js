// The account: roster-wide progress (wallet, materials, collectibles, stronghold, rapport, guild, dailies…) plus up to
// six characters. Everything persists through save.js. Systems mutate through these helpers and call save().
import { loadRaw, saveRaw, flush } from './save.js';
import { uid, dayId, weekId } from '../core/util.js';
import { CLASSES } from '../data/classes/index.js';
import { ITEMS, GEAR_SLOTS } from '../data/items.js';
import { makeGear, storyGear, makeAccessory, makeStone, makeBracelet, makeBook } from './systems/gear.js';
import { itemLevel } from './systems/stats.js';

export const MAX_CHARS = 6;
export const MAX_LEVEL = 60;
const CURRENCIES = ['silver', 'gold', 'crystals', 'royal', 'shards', 'pirate', 'bloodstone', 'pvp', 'tokens'];
export const xpForLevel = lv => Math.round(600 * Math.pow(lv, 1.55) + 400);

function freshRoster() {
  return {
    name: '', level: 1, xp: 0,
    wallet: { silver: 25000, gold: 0, crystals: 0, royal: 0, shards: 0, pirate: 0, bloodstone: 0, pvp: 0, tokens: 0 },
    mats: {},                         // stackable items (roster storage): id → count
    bank: [],                         // non-stackable roster storage
    collect: { seeds: [], souls: [], hearts: [], masterpieces: [], stars: [], bounties: [], leaves: [], vistas: [] },
    claimed: {},                      // collectible reward tiers claimed
    tome: {},                         // region → { bosses:[], npcs:[], lore:[], food:[] }
    cards: {}, deck: [],              // cardId → { n, awaken }
    rapport: {},                      // npcId → { pts, day, songs, emotes, claimed: [] }
    stronghold: { level: 1, xp: 0, buildings: { manor: 1 }, research: {}, dispatch: [], craft: [], energy: 5000, energyT: Date.now(), crew: [] },
    life: { energy: 10000, t: Date.now(), skills: { forage: 1, log: 1, mine: 1, hunt: 1, fish: 1, dig: 1 }, xp: {} },
    guild: null,
    pvp: { rating: 1000, wins: 0, losses: 0 },
    mail: [], songs: ['homeward'], emotes: ['wave', 'bow', 'cheer', 'dance', 'sit', 'clap'], mounts: [], pets: [], titles: [], activeTitle: null,
    daily: { day: dayId(), rest: { chaos: 0, guardian: 0 } },
    weekly: { week: weekId() },
    records: {}, unlocked: {}, flags: {}, market: { listings: [], sold: [] },
    stats: { kills: 0, deaths: 0, honeTaps: 0, honeWins: 0, bestStone: null, playSecs: 0 },
  };
}

export class Account {
  constructor(data) {
    this.data = data || { v: 1, created: Date.now(), settings: {}, roster: freshRoster(), chars: [], lastChar: null };
    this.migrate();
    this.resets();
  }
  static load() { return new Account(loadRaw()); }
  migrate() {
    const d = this.data, r = d.roster = { ...freshRoster(), ...(d.roster || {}) };
    r.wallet = { ...freshRoster().wallet, ...(r.wallet || {}) };
    r.collect = { ...freshRoster().collect, ...(r.collect || {}) };
    d.settings = { quality: 'high', master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.6, moveButton: 'right', numbers: true, shake: 1, ...(d.settings || {}) };
    for (const c of d.chars) { c.inv ||= []; c.skills ||= {}; c.quests ||= { active: [], done: [] }; c.equip ||= {}; c.items ||= defaultBattleItems(); }
  }
  save(immediate = false) { saveRaw(this.data, immediate); }
  flush() { flush(); }
  get roster() { return this.data.roster; }
  get chars() { return this.data.chars; }
  get settings() { return this.data.settings; }
  char(id) { return this.data.chars.find(c => c.id === id) || null; }

  // ---------------------------------------------------------------- wallet & materials
  count(id) { if (CURRENCIES.includes(id)) return this.roster.wallet[id] || 0; return this.roster.mats[id] || 0; }
  has(id, n = 1) { return this.count(id) >= n; }
  take(id, n = 1) {
    if (!this.has(id, n)) return false;
    if (CURRENCIES.includes(id)) this.roster.wallet[id] -= n; else { this.roster.mats[id] -= n; if (this.roster.mats[id] <= 0) delete this.roster.mats[id]; }
    this.save(); return true;
  }
  give(id, n = 1) {
    if (!n) return;
    if (CURRENCIES.includes(id)) this.roster.wallet[id] = (this.roster.wallet[id] || 0) + n;
    else this.roster.mats[id] = (this.roster.mats[id] || 0) + n;
    this.save();
  }
  /** give a reward bundle { silver: 1000, leapstone: 3, items: [Item] } to a character */
  grant(char, bundle) {
    for (const [k, v] of Object.entries(bundle || {})) {
      if (k === 'items') for (const it of v) this.addItem(char, it);
      else if (k === 'xp') this.addXp(char, v);
      else if (k === 'rosterXp') this.addRosterXp(v);
      else this.give(k, v);
    }
  }
  // ---------------------------------------------------------------- items (per character bag)
  addItem(char, it) {
    if (ITEMS[it.id] && !it.uid) { this.give(it.id, it.count || 1); return; }
    char.inv.push(it); this.save();
  }
  removeItem(char, uidv) { const i = char.inv.findIndex(x => x.uid === uidv); if (i < 0) return null; const [it] = char.inv.splice(i, 1); this.save(); return it; }
  equip(char, it, slotOverride) {
    let slot = slotOverride || it.slot;
    if (slot === 'earring' || slot === 'ring') { const a = slot + '1', b = slot + '2'; slot = !char.equip[a] ? a : !char.equip[b] ? b : a; }
    if (it.kind === 'weapon' && it.cls && it.cls !== char.cls) return { ok: false, why: 'class' };
    const old = char.equip[slot];
    this.removeItem(char, it.uid);
    char.equip[slot] = it;
    if (old) char.inv.push(old);
    char.ilvl = itemLevel(char);
    this.save(); return { ok: true, old };
  }
  unequip(char, slot) { const it = char.equip[slot]; if (!it) return; delete char.equip[slot]; char.inv.push(it); char.ilvl = itemLevel(char); this.save(); }

  // ---------------------------------------------------------------- characters
  createChar({ name, cls, sex = 'm', look = {}, mode = 'story' }) {
    if (this.chars.length >= MAX_CHARS) throw new Error('Your roster is full.');
    const K = CLASSES[cls]; if (!K) throw new Error('Unknown class');
    const c = { id: uid('c'), name, cls, sex, look, created: Date.now(), played: 0, level: 1, xp: 0, skillPts: 0, bonusPts: 0,
      skills: {}, bar: K.defaultBar.slice(), equip: {}, inv: [], books: [], gems: [], items: defaultBattleItems(),
      quests: { active: [], done: [] }, zone: 'prologue', pos: null, powerpass: mode !== 'story', title: null, mount: null, pet: null, engr: [], classEngr: [K.engravings?.[0]?.id].filter(Boolean) };
    for (const s of K.skills) c.skills[s.id] = { lv: 1, tri: [-1, -1, -1] };
    if (mode === 'story') {
      for (const sl of GEAR_SLOTS) c.equip[sl] = storyGear(1, sl, cls, 1);
    } else {
      // Powerpass (level 60, Vanguard +10) or Raid Ready (Horned Tyrant +8, iLvl 1420, engravings, accessories)
      const raid = mode === 'raid';
      c.level = MAX_LEVEL; c.zone = 'solhaven';
      for (const sl of GEAR_SLOTS) c.equip[sl] = raid ? makeGear('horned', sl, cls, { hone: 8, quality: 80 }) : makeGear('vanguard', sl, cls, { hone: 10, quality: 60 });
      for (const s of K.skills) c.skills[s.id] = { lv: raid ? 10 : 7, tri: raid ? [0, 0, 0] : [0, 0, -1] };
      if (raid) {
        const eng = K.role === 'support' ? ['expert', 'awakening', 'heavy_armor'] : ['vendetta', 'hexed_idol', 'keen_edge'];
        c.equip.necklace = makeAccessory('necklace', 5, { engr: [eng[0], eng[1]], quality: 75 });
        c.equip.earring1 = makeAccessory('earring', 5, { engr: [eng[1], eng[2]], quality: 70 });
        c.equip.earring2 = makeAccessory('earring', 5, { engr: [eng[0], eng[2]], quality: 70 });
        c.equip.ring1 = makeAccessory('ring', 5, { engr: [eng[2], eng[0]], quality: 70 });
        c.equip.ring2 = makeAccessory('ring', 5, { engr: [eng[1], eng[2]], quality: 70 });
        const st = makeStone(5, { lines: [eng[0], eng[1], 'neg_move'] }); st.facets = [[1, 1, 1, 1, 1, 1, 1, 0, 0].map(v => v || -1), [1, 1, 1, 1, 1, 1, 0, 0, 0].map(v => v || -1), [1, 1, 0, 0, 0, 0, 0, 0, 0].map(v => v || -1)]; c.equip.stone = st;
        c.equip.bracelet = makeBracelet(5);
        c.books = [{ id: eng[0], nodes: 12 }, { id: eng[1], nodes: 9 }];
        c.premade = true;
      }
      this.roster.unlocked.endgame = true;
    }
    c.skillPts = this.skillPointsFor(c) - this.usedPoints(c);
    c.ilvl = itemLevel(c);
    this.chars.push(c);
    this.data.lastChar = c.id;
    if (!this.roster.name) this.roster.name = name;
    this.save(true);
    return c;
  }
  deleteChar(id) { const i = this.chars.findIndex(c => c.id === id); if (i >= 0) this.chars.splice(i, 1); if (this.data.lastChar === id) this.data.lastChar = this.chars[0]?.id || null; this.save(true); }
  skillPointsFor(c) { return Math.max(0, (c.level - 1) * 6 + 40 + (c.bonusPts || 0) * 1); }
  usedPoints(c) { let n = 0; for (const s of Object.values(c.skills)) n += skillCost(s.lv); return n; }
  addXp(c, n) {
    if (c.level >= MAX_LEVEL) return [];
    c.xp += n; const ups = [];
    while (c.level < MAX_LEVEL && c.xp >= xpForLevel(c.level)) { c.xp -= xpForLevel(c.level); c.level++; ups.push(c.level); }
    if (ups.length) { c.skillPts = this.skillPointsFor(c) - this.usedPoints(c); this.addRosterXp(ups.length * 60); }
    this.save(); return ups;
  }
  addRosterXp(n) { const r = this.roster; r.xp += n; while (r.xp >= 400 + r.level * 120) { r.xp -= 400 + r.level * 120; r.level++; } this.save(); }
  /** raise a skill level (costs points) */
  levelSkill(c, id, delta = 1) {
    const s = c.skills[id]; if (!s) return false;
    const nl = Math.max(1, Math.min(12, s.lv + delta));
    const cost = skillCost(nl) - skillCost(s.lv);
    if (cost > 0 && (c.skillPts || 0) < cost) return false;
    s.lv = nl; c.skillPts -= cost;
    const unlock = [4, 7, 10];
    s.tri = s.tri.map((t, i) => nl >= unlock[i] ? t : -1);
    this.save(); return true;
  }
  setTripod(c, id, tier, pick) { const s = c.skills[id]; if (!s || s.lv < [4, 7, 10][tier]) return false; s.tri[tier] = pick; this.save(); return true; }

  // ---------------------------------------------------------------- resets & rest bonus
  resets() {
    const r = this.roster, today = dayId(), week = weekId();
    if (r.daily.day !== today) {
      const missed = Math.max(0, today - r.daily.day);
      // rest bonus: every skipped daily run banks rest (max 100)
      for (const c of this.chars) {
        c.daily ||= { chaos: 0, guardian: 0 };
        const rest = c.rest ||= { chaos: 0, guardian: 0 };
        rest.chaos = Math.min(100, rest.chaos + Math.max(0, 2 - (c.daily.chaos || 0)) * 10 + Math.max(0, missed - 1) * 20);
        rest.guardian = Math.min(100, rest.guardian + Math.max(0, 2 - (c.daily.guardian || 0)) * 10 + Math.max(0, missed - 1) * 20);
        c.daily = { chaos: 0, guardian: 0, tasks: 0 };
      }
      r.daily = { day: today, rest: r.daily.rest };
      r.flags.dailyTasks = null;
    }
    if (r.weekly.week !== week) {
      r.weekly = { week };
      for (const c of this.chars) c.weekly = {};
    }
  }
  exportData() { return this.data; }
}
export function defaultBattleItems() { return [{ id: 'hp_potion', count: 20 }, { id: 'destruction_bomb', count: 5 }, { id: 'flame_grenade', count: 5 }, { id: 'time_stop', count: 3 }]; }
/** cumulative skill point cost to reach a level (Lost Ark style: cheap early, expensive late) */
export function skillCost(lv) { let n = 0; for (let l = 2; l <= lv; l++) n += l <= 4 ? 1 : l <= 7 ? 2 : l <= 10 ? 4 : 6; return n; }
export { makeBook };
