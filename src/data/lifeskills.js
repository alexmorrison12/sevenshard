// Trade skills: Foraging, Logging, Mining, Hunting, Fishing, Archaeology. Drops unlock by skill level; rare drops
// (Sunbloom, Heartwood, Starsteel, Pristine Pelt, Sea Pearl, Relic Idol) scale with level and tool.
export const LIFE = { maxEnergy: 10000, perHour: 300, maxLevel: 30 };
export const xpToNext = lv => Math.round(80 * Math.pow(lv, 1.55) + 120);
const d = (id, w, n, level = 1, rare = false) => ({ id, w, n, level, rare });
export const LIFE_SKILLS = {
  forage: { name: 'Foraging', verb: 'Gather', energy: 30, anim: 'gather', xp: 12, drops: [d('herb', 70, [3, 6]), d('flower', 25, [1, 3], 5), d('sunbloom', 1.2, [1, 1], 10, true)] },
  log: { name: 'Logging', verb: 'Chop', energy: 40, anim: 'chop', xp: 14, drops: [d('timber', 70, [3, 6]), d('resin', 25, [1, 3], 5), d('heartwood', 1, [1, 1], 10, true)] },
  mine: { name: 'Mining', verb: 'Mine', energy: 40, anim: 'mine', xp: 14, drops: [d('ore', 70, [3, 6]), d('gem_ore', 25, [1, 3], 5), d('starsteel', 1, [1, 1], 10, true)] },
  hunt: { name: 'Hunting', verb: 'Hunt', energy: 35, anim: 'throw', xp: 13, drops: [d('meat', 70, [3, 6]), d('hide', 25, [1, 3], 5), d('pelt', 1, [1, 1], 10, true)] },
  fish: { name: 'Fishing', verb: 'Fish', energy: 30, anim: 'fish_cast', xp: 12, drops: [d('fish', 70, [2, 5]), d('clam', 25, [1, 3], 5), d('pearl', 1.2, [1, 1], 10, true)] },
  dig: { name: 'Archaeology', verb: 'Excavate', energy: 60, anim: 'dig', xp: 18, drops: [d('relic_shard', 70, [2, 5]), d('buried_coin', 25, [1, 2], 5), d('relic_idol', 1.2, [1, 1], 10, true)] },
};
export const SKILL_IDS = Object.keys(LIFE_SKILLS);
export const TOOLS = {
  1: { name: 'Worn', yield: 0, rare: 1, energy: 1, dur: 500 },
  2: { name: 'Sturdy', yield: 0.1, rare: 1.25, energy: 0.95, dur: 500 },
  3: { name: 'Masterwork', yield: 0.2, rare: 1.5, energy: 0.9, dur: 500 },
  4: { name: 'Legendary', yield: 0.35, rare: 2, energy: 0.85, dur: 500 },
};
export const TOOL_NAMES = { forage: 'Sickle', log: 'Axe', mine: 'Pickaxe', hunt: 'Hunting Knife', fish: 'Fishing Rod', dig: 'Trowel' };
export const TOOL_PRICES = { 1: 2000, 2: 12000, 3: 60000, 4: 250000 };
export const FOOD_ENERGY = { food1: 500, food2: 700, food3: 1000, food4: 1500, life_tonic: 1000 };
