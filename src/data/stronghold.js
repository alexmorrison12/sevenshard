// Brightwater Isle — the stronghold: buildings, research projects, workshop recipes, crew dispatch missions.
// Times are real minutes. Costs are bundles (wallet currencies / ITEMS ids).
import { E } from './loot.js';

export const STRONGHOLD_MAX = 30;
/** stronghold xp needed to go from lv to lv+1 */
export const strongholdXpFor = lv => Math.round(600 + lv * 420 + lv * lv * 30);
export const ACTION_ENERGY = { max: 5000, perHour: 180 };

/** Buildings. Level 0 = not built (the Manor starts at 1). Every level above 1 needs stronghold level (lv − 1) × 3. */
export const BUILDINGS = {
  manor: { name: 'Brightwater Manor', max: 10, desc: 'Your home on the isle. Its level caps every other building.',
    effect: lv => ({ text: `Other buildings up to Lv.${lv}. ${4 + lv * 2} decoration slots.`, cap: lv, decor: 4 + lv * 2 }),
    cost: lv => ({ silver: 25000 * lv * lv, gold: lv >= 4 ? 40 * (lv - 3) : 0, timber: 40 * lv, ore: 30 * lv }) },
  workshop: { name: 'Workshop', max: 10, desc: 'Crafts battle items, fusion materials and food.',
    effect: lv => ({ text: `${1 + Math.floor((lv + 1) / 3)} crafting slots, crafting ${Math.round(4 * Math.max(0, lv - 1))}% faster.`, slots: lv ? 1 + Math.floor((lv + 1) / 3) : 0, speed: 0.04 * Math.max(0, lv - 1) }),
    cost: lv => ({ silver: 18000 * lv * lv, gold: lv >= 5 ? 30 * (lv - 4) : 0, timber: 60 * lv, ore: 40 * lv }) },
  research_hall: { name: 'Research Hall', max: 10, desc: 'Researches permanent perks for your whole roster.',
    effect: lv => ({ text: `Research tier ${lv >= 6 ? 3 : lv >= 3 ? 2 : lv >= 1 ? 1 : 0}, research ${Math.round(5 * Math.max(0, lv - 1))}% faster.`, tier: lv >= 6 ? 3 : lv >= 3 ? 2 : lv >= 1 ? 1 : 0, speed: 0.05 * Math.max(0, lv - 1) }),
    cost: lv => ({ silver: 22000 * lv * lv, gold: lv >= 4 ? 40 * (lv - 3) : 0, timber: 50 * lv, relic_shard: 20 * lv }) },
  barracks: { name: 'Crew Barracks', max: 10, desc: 'Houses your crew and sends them on dispatch missions.',
    effect: lv => ({ text: `${3 + lv} crew berths, ${lv ? 1 + Math.floor(lv / 4) : 0} dispatch slots.`, crew: 3 + lv, slots: lv ? 1 + Math.floor(lv / 4) : 0 }),
    cost: lv => ({ silver: 16000 * lv * lv, gold: lv >= 5 ? 30 * (lv - 4) : 0, timber: 50 * lv, meat: 20 * lv }) },
  garden: { name: 'Garden', max: 10, desc: 'Grows herbs and Sunpetals while you are away (up to 24 h of harvest).',
    effect: lv => ({ text: `Grows ${8 * lv} herbs, ${3 * lv} Sunpetals and the odd Sunbloom per hour.`, herb: 8 * lv, flower: 3 * lv, sunbloom: 0.04 * lv }),
    cost: lv => ({ silver: 12000 * lv * lv, timber: 30 * lv, herb: 30 * lv }) },
  ranch: { name: 'Pet Ranch', max: 10, desc: 'Pets stationed here forage small gifts every few hours.',
    effect: lv => ({ text: `${lv ? 1 + Math.floor(lv / 3) : 0} pet berths; each forages every ${Math.max(2, 6 - Math.floor(lv / 2))} h.`, slots: lv ? 1 + Math.floor(lv / 3) : 0, every: Math.max(2, 6 - Math.floor(lv / 2)) }),
    cost: lv => ({ silver: 14000 * lv * lv, timber: 40 * lv, meat: 20 * lv }) },
};
export const buildingReq = lv => Math.max(1, (lv - 1) * 3);

/** Research projects: one at a time; tier needs Research Hall level 1 / 3 / 6. */
export const RESEARCH = [
  { id: 'rift_cartography', name: 'Rift Cartography', tier: 1, desc: 'Chaos Dungeon honing materials +10%.', perk: { chaosLoot: 0.1 }, cost: { silver: 60000, timber: 100, ore: 60 }, mins: 30, energy: 300 },
  { id: 'efficient_forging', name: 'Efficient Forging', tier: 1, desc: 'Honing silver cost −10%.', perk: { honeSilver: 0.1 }, cost: { silver: 80000, ore: 120, gem_ore: 20 }, mins: 45, energy: 300 },
  { id: 'alchemy_lab', name: 'Alchemy Lab', tier: 1, desc: 'Battle item crafting 30% faster.', perk: { craftSpeedBattle: 0.3 }, cost: { silver: 40000, herb: 120, flower: 40 }, mins: 20, energy: 200 },
  { id: 'restful_breeze', name: 'Restful Breeze', tier: 1, desc: 'Life Energy maximum and regeneration +5%.', perk: { lifeEnergy: 0.05 }, cost: { silver: 50000, herb: 80, fish: 40 }, mins: 30, energy: 200 },
  { id: 'expanded_docks', name: 'Expanded Docks', tier: 2, req: ['restful_breeze'], desc: '+1 dispatch slot.', perk: { dispatchSlots: 1 }, cost: { silver: 120000, gold: 50, timber: 200, ore: 100 }, mins: 60, energy: 500 },
  { id: 'weapon_drills', name: 'Weapon Drills', tier: 2, req: ['efficient_forging'], desc: 'Attack Power +1% for the whole roster.', perk: { atk: 0.01 }, cost: { silver: 150000, gold: 80, ore: 200, starsteel: 2 }, mins: 90, energy: 600 },
  { id: 'guardian_studies', name: 'Guardian Studies', tier: 2, req: ['rift_cartography'], desc: 'Guardian Hunt leapstones +10%.', perk: { guardianLoot: 0.1 }, cost: { silver: 120000, gold: 50, hide: 60, meat: 60 }, mins: 60, energy: 500 },
  { id: 'market_contacts', name: 'Market Contacts', tier: 2, desc: 'Market sales fee −1% (5% → 4%).', perk: { marketFee: 0.01 }, cost: { silver: 100000, gold: 100, buried_coin: 20 }, mins: 60, energy: 400 },
  { id: 'tireless_crew', name: 'Tireless Crew', tier: 2, req: ['expanded_docks'], desc: 'Dispatch success chance +8%.', perk: { dispatchChance: 0.08 }, cost: { silver: 100000, meat: 80, fish: 80 }, mins: 60, energy: 400 },
  { id: 'master_chef', name: 'Master Chef', tier: 3, desc: 'Cooking yields +50%.', perk: { foodYield: 0.5 }, cost: { silver: 150000, fish: 120, meat: 120, sunbloom: 3 }, mins: 90, energy: 600 },
  { id: 'fusion_theory', name: 'Fusion Theory', tier: 3, req: ['alchemy_lab'], desc: 'Fusion material recipes use 20% fewer trade goods.', perk: { fusionCost: 0.2 }, cost: { silver: 200000, gold: 120, timber: 200, relic_shard: 100 }, mins: 120, energy: 800 },
  { id: 'workshop_expansion', name: 'Workshop Expansion', tier: 3, desc: '+1 crafting slot.', perk: { craftSlots: 1 }, cost: { silver: 180000, gold: 100, timber: 300, heartwood: 2 }, mins: 120, energy: 800 },
  { id: 'vital_training', name: 'Vital Training', tier: 3, req: ['weapon_drills'], desc: 'Max HP +2% and Attack Power +1% for the whole roster.', perk: { hp: 0.02, atk: 0.01 }, cost: { silver: 250000, gold: 200, starsteel: 4, pelt: 4 }, mins: 180, energy: 1000 },
];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));

/** Workshop recipes. ws = Workshop level required. energy = action energy. */
const R = (id, name, cat, out, cost, mins, energy, ws = 1) => ({ id, name, cat, out, cost, mins, energy, ws });
export const RECIPES = [
  R('hp_potion', 'Healing Potion ×10', 'battle', { hp_potion: 10 }, { herb: 20, silver: 400 }, 5, 20),
  R('elixir', 'Major Elixir ×5', 'battle', { elixir: 5 }, { herb: 30, flower: 10, silver: 1500 }, 20, 40, 2),
  R('destruction_bomb', 'Destruction Bomb ×5', 'battle', { destruction_bomb: 5 }, { ore: 30, silver: 800 }, 15, 30),
  R('flame_grenade', 'Flame Grenade ×5', 'battle', { flame_grenade: 5 }, { ore: 20, resin: 10, silver: 700 }, 15, 30),
  R('frost_grenade', 'Frost Grenade ×5', 'battle', { frost_grenade: 5 }, { ore: 20, clam: 10, silver: 700 }, 15, 30, 2),
  R('whirlwind_grenade', 'Whirlwind Grenade ×5', 'battle', { whirlwind_grenade: 5 }, { ore: 20, flower: 10, silver: 800 }, 20, 30, 2),
  R('clay_grenade', 'Clay Grenade ×5', 'battle', { clay_grenade: 5 }, { ore: 25, relic_shard: 5, silver: 800 }, 20, 30, 3),
  R('dark_grenade', 'Dark Grenade ×5', 'battle', { dark_grenade: 5 }, { gem_ore: 10, hide: 10, silver: 900 }, 20, 30, 3),
  R('sleep_bomb', 'Sleep Bomb ×5', 'battle', { sleep_bomb: 5 }, { herb: 20, flower: 10, silver: 600 }, 15, 25, 2),
  R('panacea', 'Panacea ×5', 'battle', { panacea: 5 }, { herb: 25, meat: 5, silver: 600 }, 15, 25),
  R('time_stop', 'Time Stop Potion ×3', 'battle', { time_stop: 3 }, { gem_ore: 15, relic_shard: 10, silver: 2000 }, 45, 60, 4),
  R('fusion_timber', 'Luminous Fusion (Timberline) ×30', 'fusion', { fusion: 30 }, { timber: 60, resin: 20, ore: 20, silver: 3000 }, 60, 120),
  R('fusion_meadow', 'Luminous Fusion (Meadow) ×30', 'fusion', { fusion: 30 }, { herb: 60, flower: 20, fish: 20, silver: 3000 }, 60, 120),
  R('fusion_relic', 'Luminous Fusion (Relic) ×30', 'fusion', { fusion: 30 }, { relic_shard: 40, buried_coin: 10, ore: 30, silver: 3000 }, 60, 120, 2),
  R('food1', 'Hearty Stew ×3', 'food', { food1: 3 }, { meat: 10, herb: 10, silver: 500 }, 10, 20),
  R('food2', 'Fisher’s Pie ×3', 'food', { food2: 3 }, { fish: 10, flower: 5, silver: 500 }, 10, 20),
  R('food3', 'Pipberry Tart ×2', 'food', { food3: 2 }, { flower: 10, herb: 10, sunbloom: 1, silver: 800 }, 20, 30, 3),
  R('food4', 'Seafarer’s Platter ×2', 'food', { food4: 2 }, { fish: 10, clam: 6, pearl: 1, silver: 1200 }, 25, 40, 4),
  R('gift1', 'Bouquet of Sunpetals', 'gift', { gift1: 1 }, { flower: 20, sunbloom: 1, silver: 1000 }, 15, 30, 2),
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

/** Dispatch missions. tag matches crew roles for a +25% power bonus. */
export const MISSIONS = [
  { id: 'scout_shore', name: 'Scout the Shoreline', tag: 'sea', mins: 10, crew: 1, power: 40, xp: 40, reward: [E('silver', 8000, 12000), E('clam', 3, 6), E('fish', 5, 10)] },
  { id: 'lumber_run', name: 'Lumber Run to Thornwood', tag: 'land', mins: 30, crew: 2, power: 90, xp: 80, reward: [E('timber', 40, 60), E('resin', 8, 14), E('heartwood', 1, 1, 0.1)] },
  { id: 'ore_convoy', name: 'Ore Convoy from Ashen Ridge', tag: 'land', mins: 45, crew: 2, power: 110, xp: 100, reward: [E('ore', 40, 60), E('gem_ore', 6, 10), E('starsteel', 1, 1, 0.1)] },
  { id: 'pip_diplomacy', name: 'Diplomacy in Pipsprout Hollow', tag: 'trade', mins: 60, crew: 2, power: 120, xp: 120, reward: [E('card_pack_pip', 1), E('gift3', 1, 1, 0.3), E('silver', 15000, 20000)] },
  { id: 'sea_patrol', name: 'Glass Sea Patrol', tag: 'sea', mins: 90, crew: 3, power: 180, xp: 160, reward: [E('pirate', 80, 140), E('tokens', 1, 2), E('map', 1, 1, 0.3)] },
  { id: 'relic_dig', name: 'Excavate the Old Lighthouse', tag: 'lore', mins: 120, crew: 3, power: 200, xp: 200, reward: [E('relic_shard', 30, 50), E('buried_coin', 5, 10), E('relic_idol', 1, 1, 0.15), E('gem_pouch', 1, 1, 0.2)] },
  { id: 'demon_hunt', name: 'Hunt Legion Stragglers', tag: 'fight', mins: 180, crew: 4, power: 300, xp: 280, reward: [E('guardian_stone', 600, 900), E('destruction_stone', 200, 300), E('leapstone', 10, 16), E('horn_shard', 2, 4, 0.5)] },
  { id: 'treasure_fleet', name: 'Chase the Sunken Treasure Fleet', tag: 'sea', mins: 240, crew: 4, power: 360, xp: 360, reward: [E('gold', 40, 80), E('pearl', 1, 3), E('card_pack', 1, 2), E('gem_pouch', 1)] },
];
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
/** crew roles and the mission tag each one is good at */
export const CREW_ROLES = { Sailor: 'sea', Scout: 'land', Scholar: 'lore', Brawler: 'fight', Trader: 'trade', Cook: null };
/** pet forage table (Pet Ranch) */
export const RANCH_FORAGE = [E('herb', 4, 8), E('flower', 1, 3, 0.6), E('fish', 2, 4, 0.4), E('gift1', 1, 1, 0.08), E('gift3', 1, 1, 0.03)];
