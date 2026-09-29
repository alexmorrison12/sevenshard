// Reward tables for every source of loot. An entry is { id, n: [min, max], p } — `p` (default 1) is the chance to
// drop; the count is uniform in [min, max]. `id` is a wallet currency or ITEMS id, or a generator:
//   'acc:<grade>'        random accessory (necklace / earring / ring) of that grade (gear.js makeAccessory)
//   'stone:<grade>'      ability stone          'bracelet:<grade>'   bracelet
//   'book:<grade>'       engraving recipe (combat engraving weighted by demand)
//   'gem:<lo>-<hi>'      Ruinstone/Swiftstone of a level in [lo, hi]
//   'card:<id>'          a specific card       'card@<grade>'        a random card of that grade
// Economy tuning (see systems/economy.js simulateEconomy): Powerpass (Vanguard +10, iLvl 1200) → Horned Tyrant +8
// (iLvl 1420, legion-raid ready) in roughly 2–4 hours of focused play.
export const E = (id, lo, hi = lo, p = 1) => ({ id, n: [lo, hi], p });
const mulTable = (list, m, skip = []) => list.map(e => (skip.includes(e.id) || !/^[a-z_]+$/.test(e.id)) ? e : { ...e, n: [Math.round(e.n[0] * m), Math.round(e.n[1] * m)] });

// ------------------------------------------------------------------------------------------------ chaos dungeons
// base: every clear. resonance: the first two clears each day (×2 with 20 rest bonus). extras: rolled with the
// resonance chest (rest bonus rolls them twice).
const CHAOS_BASE = [E('silver', 25000, 31000), E('shards', 1100, 1500), E('guardian_stone', 380, 480), E('destruction_stone', 120, 160), E('leapstone', 8, 11), E('fusion', 4, 6)];
const CHAOS_RES = [E('silver', 25000, 31000), E('shards', 1400, 1800), E('guardian_stone', 650, 800), E('destruction_stone', 200, 250), E('leapstone', 12, 16), E('fusion', 9, 12), E('solar_grace', 2, 4, 0.5), E('solar_blessing', 1, 1, 0.15)];
const TIER_MUL = { 1: 1, 2: 1.3, 3: 1.7, 4: 2.2 };
const CHAOS_HORN = { 1: [E('horn_shard', 1, 2, 0.6)], 2: [E('horn_shard', 2, 3)], 3: [E('horn_shard', 13, 18)], 4: [E('horn_shard', 18, 24)] };
const CHAOS_HORN_RES = { 1: [E('horn_shard', 2, 3, 0.7), E('gold', 10, 20)], 2: [E('horn_shard', 3, 5), E('gold', 20, 30)], 3: [E('horn_shard', 14, 18), E('gold', 30, 50)], 4: [E('horn_shard', 20, 26), E('gold', 50, 70)] };
const CHAOS_EXTRAS = {
  1: [E('acc:4', 1, 1, 0.45), E('acc:5', 1, 1, 0.05), E('gem:1-3', 1, 1, 0.35), E('card_pack', 1, 1, 0.35), E('card_pack_epic', 1, 1, 0.04), E('stone:4', 1, 1, 0.08), E('stone:5', 1, 1, 0.02), E('bracelet:4', 1, 1, 0.04), E('book:4', 1, 1, 0.06)],
  2: [E('acc:4', 1, 1, 0.45), E('acc:5', 1, 1, 0.1), E('gem:1-4', 1, 1, 0.38), E('card_pack', 1, 1, 0.4), E('card_pack_epic', 1, 1, 0.06), E('stone:4', 1, 1, 0.08), E('stone:5', 1, 1, 0.04), E('bracelet:4', 1, 1, 0.04), E('bracelet:5', 1, 1, 0.01), E('book:4', 1, 1, 0.08)],
  3: [E('acc:4', 1, 1, 0.3), E('acc:5', 1, 1, 0.25), E('gem:2-5', 1, 1, 0.4), E('card_pack', 1, 1, 0.45), E('card_pack_epic', 1, 1, 0.08), E('stone:5', 1, 1, 0.08), E('stone:6', 1, 1, 0.01), E('bracelet:5', 1, 1, 0.04), E('book:4', 1, 1, 0.1)],
  4: [E('acc:5', 1, 1, 0.45), E('acc:6', 1, 1, 0.04), E('gem:3-6', 1, 1, 0.45), E('card_pack', 1, 1, 0.5), E('card_pack_epic', 1, 1, 0.1), E('stone:5', 1, 1, 0.1), E('stone:6', 1, 1, 0.03), E('bracelet:5', 1, 1, 0.06), E('book:4', 1, 1, 0.12)],
};
export const CHAOS_LOOT = Object.fromEntries([1, 2, 3, 4].map(t => [t, {
  id: `chaos:${t}`, name: ['', 'Demon Rift I', 'Demon Rift II', 'Demon Rift III', 'Demon Rift IV'][t], ilvl: [0, 1100, 1250, 1400, 1500][t], mins: t <= 2 ? 7 : 8,
  base: [...mulTable(CHAOS_BASE, TIER_MUL[t]), ...CHAOS_HORN[t]],
  resonance: [...mulTable(CHAOS_RES, TIER_MUL[t]), ...CHAOS_HORN_RES[t]],
  extras: CHAOS_EXTRAS[t],
}]));
export const CHAOS_RESONANCE_RUNS = 2;   // resonance clears per character per day
export const REST_COST = 20;             // rest bonus consumed by one doubled resonance clear

// ------------------------------------------------------------------------------------------------ guardian hunts
const GUARD_BASE = [E('silver', 16000, 21000), E('leapstone', 18, 24), E('guardian_stone', 220, 300), E('destruction_stone', 80, 110), E('shards', 700, 950)];
const GUARD_RES = [E('silver', 15000, 19000), E('leapstone', 26, 34), E('fusion', 7, 10), E('shards', 900, 1200), E('solar_grace', 2, 3, 0.5), E('solar_blessing', 1, 1, 0.25)];
const G = (id, name, ilvl, m, horn, hornRes, extras, mins) => ({ id, name, ilvl, mins, base: [...mulTable(GUARD_BASE, m), ...horn], resonance: [...mulTable(GUARD_RES, m), ...hornRes], extras });
export const GUARDIAN_LOOT = {
  rimewing: G('rimewing', 'Rimewing', 1100, 1, [E('horn_shard', 1, 3, 0.7)], [E('horn_shard', 2, 3)], [E('gem:1-3', 1, 1, 0.25), E('card_pack', 1, 1, 0.3), E('book:4', 1, 1, 0.05), E('card:rimewing', 1, 1, 0.03)], 6),
  cinderhorn: G('cinderhorn', 'Cinderhorn', 1250, 1.3, [E('horn_shard', 3, 5)], [E('horn_shard', 4, 6), E('gold', 10, 20)], [E('gem:1-4', 1, 1, 0.28), E('card_pack', 1, 1, 0.35), E('book:4', 1, 1, 0.06), E('card:cinderhorn', 1, 1, 0.03)], 7),
  sandmaw: G('sandmaw', 'Sandmaw', 1370, 1.7, [E('horn_shard', 14, 18)], [E('horn_shard', 16, 22), E('gold', 30, 50)], [E('gem:2-5', 1, 1, 0.3), E('card_pack', 1, 1, 0.4), E('book:4', 1, 1, 0.08), E('card:sandmaw', 1, 1, 0.03)], 8),
  kurai: G('kurai', 'Kurai the Pyrefox', 1460, 2.2, [E('horn_shard', 18, 24)], [E('horn_shard', 22, 28), E('gold', 50, 70)], [E('gem:3-6', 1, 1, 0.32), E('card_pack', 1, 1, 0.45), E('card_pack_epic', 1, 1, 0.08), E('book:4', 1, 1, 0.1), E('card:kurai', 1, 1, 0.03)], 9),
};
export const GUARDIAN_RESONANCE_RUNS = 2;

// ------------------------------------------------------------------------------------------------ abyssal dungeon
// first: the first clear of each gate per character per week (gold + chest). repeat: later clears that week.
export const ABYSS_LOOT = {
  oratory: {
    id: 'oratory', name: 'The Sunken Oratory', ilvl: 1325,
    gates: [
      { name: 'The Drowned Choir', boss: 'nerissa', mins: 9,
        first: [E('gold', 250), E('silver', 40000, 50000), E('leapstone', 34, 44), E('fusion', 10, 14), E('guardian_stone', 1300, 1600), E('destruction_stone', 420, 520), E('shards', 3200, 4000), E('horn_shard', 24, 30)],
        extras: [E('acc:5', 1, 1, 0.5), E('gem:2-4', 1, 1, 0.5), E('book:4', 1, 1, 0.2), E('card_pack_epic', 1, 1, 0.2), E('stone:5', 1, 1, 0.15), E('card:nerissa', 1, 1, 0.05)],
        repeat: [E('silver', 18000, 24000), E('shards', 1400, 1800), E('guardian_stone', 420, 520), E('leapstone', 9, 13), E('horn_shard', 3, 5)] },
      { name: 'Oracle of the Deep', boss: 'deep_oracle', mins: 10,
        first: [E('gold', 400), E('silver', 50000, 60000), E('leapstone', 44, 54), E('fusion', 14, 18), E('guardian_stone', 1600, 1900), E('destruction_stone', 520, 620), E('shards', 4000, 5000), E('horn_shard', 30, 36)],
        extras: [E('acc:5', 1, 1, 1), E('gem:2-5', 1, 1, 0.6), E('book:4', 1, 1, 0.3), E('stone:5', 1, 1, 0.25), E('bracelet:5', 1, 1, 0.15), E('card:deep_oracle', 1, 1, 0.05)],
        repeat: [E('silver', 22000, 28000), E('shards', 1700, 2100), E('guardian_stone', 500, 620), E('leapstone', 11, 15), E('horn_shard', 4, 6)] },
    ],
  },
};

// ------------------------------------------------------------------------------------------------ legion raid
// gold: paid once per gate per character per week (either difficulty). chest: always on a weekly first clear.
// more: the optional "More Rewards" chest (costs gold, same week only, once per gate).
export const RAID_LOOT = {
  gorrath: {
    id: 'gorrath', name: 'Gorrath, the Horned Tyrant',
    normal: { ilvl: 1415, gates: [
      { name: 'Hounds of the Horn', bosses: ['skarn', 'vesk'], mins: 10, gold: 500, moreCost: 250,
        chest: [E('horn_shard', 10, 12), E('silver', 60000), E('leapstone', 40, 46), E('fusion', 16, 20), E('shards', 5000, 6000)],
        extras: [E('acc:5', 1, 1, 0.35), E('book:4', 1, 1, 0.25), E('gem:3-5', 1, 1, 0.3), E('card:skarn', 1, 1, 0.04), E('card:vesk', 1, 1, 0.04)],
        more: [E('horn_shard', 10, 12), E('leapstone', 20, 24), E('fusion', 10, 12), E('shards', 3000, 3500), E('acc:5', 1, 1, 0.2), E('book:4', 1, 1, 0.15)] },
      { name: 'The Horned Tyrant', bosses: ['gorrath'], mins: 15, gold: 800, moreCost: 400,
        chest: [E('horn_shard', 16, 18), E('silver', 80000), E('leapstone', 60, 70), E('fusion', 24, 28), E('shards', 7000, 8000)],
        extras: [E('acc:5', 1, 1, 0.6), E('book:4', 1, 1, 0.35), E('bracelet:5', 1, 1, 0.2), E('stone:5', 1, 1, 0.25), E('card:gorrath', 1, 1, 0.03)],
        more: [E('horn_shard', 16, 18), E('leapstone', 30, 36), E('fusion', 14, 16), E('shards', 4000, 4600), E('acc:5', 1, 1, 0.3), E('book:4', 1, 1, 0.2)] },
    ] },
    hard: { ilvl: 1445, gates: [
      { name: 'Hounds of the Horn', bosses: ['skarn', 'vesk'], mins: 11, gold: 750, moreCost: 400,
        chest: [E('horn_shard', 15, 18), E('silver', 80000), E('leapstone', 55, 62), E('fusion', 22, 26), E('shards', 7000, 8000)],
        extras: [E('acc:5', 1, 1, 0.45), E('acc:6', 1, 1, 0.05), E('book:4', 1, 1, 0.3), E('gem:4-6', 1, 1, 0.35), E('card:skarn', 1, 1, 0.06), E('card:vesk', 1, 1, 0.06)],
        more: [E('horn_shard', 15, 18), E('leapstone', 28, 32), E('fusion', 14, 16), E('shards', 4000, 4600), E('acc:5', 1, 1, 0.25), E('book:4', 1, 1, 0.18)] },
      { name: 'The Horned Tyrant', bosses: ['gorrath'], mins: 17, gold: 1200, moreCost: 600,
        chest: [E('horn_shard', 24, 27), E('silver', 110000), E('leapstone', 80, 90), E('fusion', 32, 36), E('shards', 9500, 11000)],
        extras: [E('acc:5', 1, 1, 0.7), E('acc:6', 1, 1, 0.08), E('book:4', 1, 1, 0.4), E('bracelet:5', 1, 1, 0.25), E('bracelet:6', 1, 1, 0.03), E('stone:6', 1, 1, 0.1), E('card:gorrath', 1, 1, 0.05)],
        more: [E('horn_shard', 24, 27), E('leapstone', 40, 46), E('fusion', 18, 22), E('shards', 5500, 6200), E('acc:5', 1, 1, 0.35), E('book:4', 1, 1, 0.25)] },
    ] },
  },
};

// ------------------------------------------------------------------------------------------------ open world & events
export const FIELD_LOOT = {
  mob: { name: 'Monster', table: [E('silver', 30, 90, 0.35), E('hp_potion', 1, 1, 0.01), E('herb', 1, 2, 0.015), E('ore', 1, 2, 0.015)] },
  elite: { name: 'Elite', table: [E('silver', 500, 1100), E('guardian_stone', 20, 50, 0.6), E('destruction_stone', 8, 20, 0.4), E('leapstone', 1, 2, 0.25), E('card_pack', 1, 1, 0.01), E('acc:4', 1, 1, 0.005)] },
  named: { name: 'Named Foe', table: [E('silver', 3000, 5000), E('guardian_stone', 80, 140), E('leapstone', 2, 4), E('card_pack', 1, 1, 0.08), E('gem:1-2', 1, 1, 0.05)] },
  fieldboss: { name: 'Old Thunderhoof', mins: 6, table: [E('silver', 50000, 70000), E('gold', 120, 180), E('shards', 2500, 3500), E('guardian_stone', 600, 900), E('leapstone', 15, 22), E('fusion', 6, 10), E('horn_shard', 5, 9), E('card_pack', 1, 2), E('gem:2-4', 1, 1, 0.35), E('acc:4', 1, 1, 0.6), E('acc:5', 1, 1, 0.1), E('book:4', 1, 1, 0.08), E('card:thunderhoof', 1, 1, 0.06)] },
  chaosgate: { name: 'Chaos Gate', mins: 8, table: [E('silver', 40000, 55000), E('gold', 90, 140), E('shards', 2000, 3000), E('guardian_stone', 800, 1100), E('destruction_stone', 250, 350), E('leapstone', 10, 16), E('fusion', 5, 8), E('horn_shard', 4, 7), E('acc:4', 1, 1, 1), E('acc:5', 1, 1, 0.15), E('gem:2-4', 1, 1, 0.3), E('stone:5', 1, 1, 0.06), E('map', 1, 1, 0.2), E('card_pack', 1, 1, 0.5)] },
  ghostship: { name: 'Ghost Ship', mins: 8, table: [E('pirate', 300, 450), E('gold', 80, 120), E('leapstone', 8, 12), E('tokens', 2, 4), E('card_pack', 1, 2), E('card:ghost_captain', 1, 1, 0.08), E('gem:2-4', 1, 1, 0.25)] },
  treasure: { name: 'Buried Treasure', mins: 3, table: [E('silver', 20000, 40000), E('pirate', 50, 100), E('gem:1-3', 1, 1, 0.3), E('card_pack', 1, 1, 0.3), E('relic_shard', 5, 12)] },
};
/** Adventure Island reward focus (rotates with the island, see tasks.js calendar). */
export const ISLAND_LOOT = {
  gold: { name: 'Gold Island', mins: 10, table: [E('gold', 250, 350), E('tokens', 3, 5), E('silver', 20000, 30000)] },
  silver: { name: 'Silver Island', mins: 10, table: [E('silver', 150000, 200000), E('tokens', 3, 5)] },
  cards: { name: 'Card Island', mins: 10, table: [E('card_pack', 3, 3), E('card_pack_epic', 1, 1), E('card_pack_legend', 1, 1, 0.08), E('tokens', 3, 5)] },
  shards: { name: 'Sunshard Island', mins: 10, table: [E('shards', 8000, 10000), E('leapstone', 12, 18), E('tokens', 3, 5)] },
  pips: { name: 'Pip Island', mins: 10, table: [E('card_pack_pip', 2, 2), E('gift3', 1, 1, 0.5), E('skill_potion', 1, 1, 0.02), E('tokens', 3, 5)] },
};

// ------------------------------------------------------------------------------------------------ inferno descent
/** Rewards for clearing floor f (1–100). milestone (every 10th floor) pays once per character per week. */
export function infernoFloorLoot(f) {
  const base = [E('silver', 1500 + 120 * f, 1800 + 140 * f), E('shards', 150 + 12 * f, 180 + 14 * f)];
  const boon = f % 5 === 0 ? [E('leapstone', 3 + Math.floor(f / 10), 4 + Math.floor(f / 8)), E('fusion', 2 + Math.floor(f / 25), 3 + Math.floor(f / 20)), E('guardian_stone', 200 + 8 * f, 240 + 10 * f), E('destruction_stone', 60 + 3 * f, 80 + 3 * f)] : [];
  const milestone = f % 10 === 0 ? [E('gold', 30 + 3 * f), E(f >= 50 ? 'gem_pouch_hi' : 'gem_pouch', 1), E('card_pack', 1), ...(f >= 20 ? [E('horn_shard', 2 + Math.floor(f / 10), 3 + Math.floor(f / 8))] : []), ...(f === 50 ? [E('card_pack_epic', 1)] : []), ...(f === 100 ? [E('card_pack_legend', 1), E('skill_potion', 1)] : [])] : [];
  return { base, boon, milestone, mins: 1.2 + f * 0.012 };
}
export const INFERNO_FLOORS = 100;

// ------------------------------------------------------------------------------------------------ engraving demand
/** Relative demand of combat engravings (book drop weights & market prices). */
export const ENGRAVING_DEMAND = {
  vendetta: 10, keen_edge: 9, hexed_idol: 8, adrenaline: 8, backstabber: 6, master_brawler: 5, precise_blade: 6, super_charge: 5,
  barricade: 4, expert: 6, awakening: 5, heavy_armor: 3, all_out_attack: 4, ether_predator: 3, spirit_absorption: 3, wind_captain: 2,
  frontliner: 3, stabilized_status: 3, crisis_evasion: 2, mana_flow: 3, sight_focus: 2, drops_of_ether: 1.5, propulsion: 2, increase_mass: 2,
};
