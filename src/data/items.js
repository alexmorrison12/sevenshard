// Item templates: materials, battle items, trade goods, consumables, collectibles, currencies; gear sets and grades.
export const GRADES = [
  { id: 0, name: 'Common', color: '#e8e8e8' }, { id: 1, name: 'Uncommon', color: '#8bd96b' }, { id: 2, name: 'Rare', color: '#4fa3ff' },
  { id: 3, name: 'Epic', color: '#b86bff' }, { id: 4, name: 'Legendary', color: '#ffae3a' }, { id: 5, name: 'Relic', color: '#ff6a2a' },
  { id: 6, name: 'Ancient', color: '#e9d2a6' }, { id: 7, name: 'Primal', color: '#39e6d8' },
];

// stackable items: id → { name, kind, grade, desc, value (silver), stack, bound }
export const ITEMS = {
  // honing
  destruction_stone: { name: 'Destruction Stone', kind: 'material', grade: 2, desc: 'Honing material for weapons.', value: 30, tradable: true },
  guardian_stone: { name: 'Guardian Stone', kind: 'material', grade: 2, desc: 'Honing material for armor.', value: 12, tradable: true },
  leapstone: { name: 'Radiant Leapstone', kind: 'material', grade: 3, desc: 'Required to hone gear beyond its limits.', value: 180, tradable: true },
  fusion: { name: 'Luminous Fusion Material', kind: 'material', grade: 3, desc: 'Fused from trade goods. Used in honing.', value: 90, tradable: true },
  shards: { name: 'Sunshard Pouch', kind: 'material', grade: 2, desc: 'Open to gain Sunshards (honing currency).', value: 0, bound: 'roster' },
  solar_grace: { name: 'Solar Grace', kind: 'material', grade: 2, desc: 'Increases honing success chance slightly.', value: 40, tradable: true },
  solar_blessing: { name: 'Solar Blessing', kind: 'material', grade: 3, desc: 'Increases honing success chance.', value: 110, tradable: true },
  solar_protection: { name: 'Solar Protection', kind: 'material', grade: 4, desc: 'Greatly increases honing success chance.', value: 260, tradable: true },
  horn_shard: { name: 'Horn of the Tyrant', kind: 'material', grade: 5, desc: 'Legion raid material. Crafts and hones Horned Tyrant gear.', value: 0, bound: 'roster' },
  // battle items
  hp_potion: { name: 'Healing Potion', kind: 'battle', grade: 1, desc: 'Restores 30% HP.', value: 8, stack: 999, tradable: true },
  elixir: { name: 'Major Elixir', kind: 'battle', grade: 3, desc: 'Restores 50% HP.', value: 40, stack: 999, tradable: true },
  destruction_bomb: { name: 'Destruction Bomb', kind: 'battle', grade: 2, desc: 'Damages boss parts (destruction).', value: 25, stack: 999, tradable: true },
  flame_grenade: { name: 'Flame Grenade', kind: 'battle', grade: 2, desc: 'Deals fire damage and inflicts Burn.', value: 20, stack: 999, tradable: true },
  frost_grenade: { name: 'Frost Grenade', kind: 'battle', grade: 2, desc: 'Freezes enemies in place.', value: 20, stack: 999, tradable: true },
  whirlwind_grenade: { name: 'Whirlwind Grenade', kind: 'battle', grade: 2, desc: 'Pulls enemies in; strong stagger.', value: 22, stack: 999, tradable: true },
  clay_grenade: { name: 'Clay Grenade', kind: 'battle', grade: 2, desc: 'Stuns; strong stagger.', value: 22, stack: 999, tradable: true },
  dark_grenade: { name: 'Dark Grenade', kind: 'battle', grade: 2, desc: 'Reduces the target’s defense.', value: 22, stack: 999, tradable: true },
  sleep_bomb: { name: 'Sleep Bomb', kind: 'battle', grade: 2, desc: 'Puts enemies to sleep.', value: 18, stack: 999, tradable: true },
  panacea: { name: 'Panacea', kind: 'battle', grade: 2, desc: 'Removes debuffs.', value: 18, stack: 999, tradable: true },
  time_stop: { name: 'Time Stop Potion', kind: 'battle', grade: 3, desc: 'Become invulnerable (and unable to move) for 3 s.', value: 60, stack: 999, tradable: true },
  feather: { name: 'Resurrection Feather', kind: 'battle', grade: 3, desc: 'Revive where you fell.', value: 90, stack: 99, bound: 'roster' },
  // trade skills
  herb: { name: 'Wild Herb', kind: 'material', grade: 1, desc: 'Foraged. Used in potions.', value: 3, tradable: true },
  flower: { name: 'Sunpetal', kind: 'material', grade: 2, desc: 'Foraged. Used in fusion materials.', value: 6, tradable: true },
  timber: { name: 'Timber', kind: 'material', grade: 1, desc: 'Logged. Used in fusion materials.', value: 3, tradable: true },
  ore: { name: 'Iron Ore', kind: 'material', grade: 1, desc: 'Mined. Used in bombs and fusion.', value: 3, tradable: true },
  gem_ore: { name: 'Glimmer Ore', kind: 'material', grade: 2, desc: 'Mined. Used in gems and fusion.', value: 8, tradable: true },
  fish: { name: 'Fresh Fish', kind: 'material', grade: 1, desc: 'Fished. Used in food.', value: 3, tradable: true },
  meat: { name: 'Thick Meat', kind: 'material', grade: 1, desc: 'Hunted. Used in food.', value: 3, tradable: true },
  relic_shard: { name: 'Ancient Relic', kind: 'material', grade: 2, desc: 'Excavated. Used in fusion materials.', value: 8, tradable: true },
  // consumables & misc
  skill_potion: { name: 'Skill Point Potion', kind: 'consumable', grade: 4, desc: 'Permanently grants 1 skill point.', value: 0, bound: 'char' },
  card_pack: { name: 'Card Pack', kind: 'consumable', grade: 3, desc: 'Contains a random card.', value: 0, bound: 'roster' },
  gem_pouch: { name: 'Gem Pouch', kind: 'consumable', grade: 3, desc: 'Contains a random Lv.1–3 gem.', value: 0, bound: 'roster' },
  chest: { name: 'Adventurer’s Chest', kind: 'consumable', grade: 3, desc: 'Contains honing materials.', value: 0, bound: 'roster' },
  map: { name: 'Treasure Map', kind: 'consumable', grade: 3, desc: 'Marks a buried treasure in the field.', value: 60, tradable: true },
  coin_pirate: { name: 'Pirate Coin', kind: 'currency', grade: 2, desc: 'Spent at harbour vendors.', value: 0, bound: 'roster' },
  food1: { name: 'Hearty Stew', kind: 'food', grade: 2, desc: 'Restores Life Energy.', value: 20 }, food2: { name: 'Fisher’s Pie', kind: 'food', grade: 2, desc: 'A Solhaven favourite.', value: 20 },
  gift1: { name: 'Bouquet of Sunpetals', kind: 'gift', grade: 2, desc: 'A rapport gift.', value: 40 }, gift2: { name: 'Music Box', kind: 'gift', grade: 3, desc: 'A rapport gift.', value: 120 },
  gift3: { name: 'Carved Pip Figurine', kind: 'gift', grade: 3, desc: 'A rapport gift. Pips love it.', value: 120 }, gift4: { name: 'Starlit Perfume', kind: 'gift', grade: 4, desc: 'A treasured rapport gift.', value: 400 },
  // collectibles (unique, roster)
  island_soul: { name: 'Island Soul', kind: 'collectible', grade: 4 }, giants_heart: { name: 'Giant’s Heart', kind: 'collectible', grade: 4 },
  masterpiece: { name: 'Masterpiece', kind: 'collectible', grade: 4 }, omnium_star: { name: 'Omnium Star', kind: 'collectible', grade: 4 },
  sea_bounty: { name: 'Sea Bounty', kind: 'collectible', grade: 4 }, world_leaf: { name: 'World Tree Leaf', kind: 'collectible', grade: 4 },
};

export const GEAR_SLOTS = ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'];
export const ACC_SLOTS = ['necklace', 'earring1', 'earring2', 'ring1', 'ring2'];
export const SLOT_NAMES = { weapon: 'Weapon', head: 'Head', shoulder: 'Shoulders', chest: 'Chest', pants: 'Pants', gloves: 'Gloves', necklace: 'Necklace', earring1: 'Earring', earring2: 'Earring', ring1: 'Ring', ring2: 'Ring', stone: 'Ability Stone', bracelet: 'Bracelet' };

// gear sets: base item level, per-hone increment, max hone, grade, honing tier
export const SETS = {
  story: { name: 'Adventurer’s', grade: 2, base: 0, per: 0, max: 0, tier: 0 },
  vanguard: { name: 'Vanguard', grade: 4, base: 1100, per: 10, max: 25, tier: 1 },
  horned: { name: 'Horned Tyrant', grade: 5, base: 1340, per: 10, max: 25, tier: 2,
    bonus: [{ n: 2, desc: 'Damage +4%.', mods: { dmgMul: 0.04 } }, { n: 4, desc: 'Crit Rate +8%.', mods: { crit: 0.08 } }, { n: 6, desc: 'Tyrant’s Wrath: damage against bosses +10%; hits have a chance to Brand them.', mods: { dmgMul: 0.06 }, special: 'tyrant' }] },
};
const WEAPON_NAMES = { reaver: 'Greatsword', oathkeeper: 'Oathblade', stormfist: 'Gauntlets', pistoleer: 'Pistols', starcaller: 'Starstaff', songweaver: 'Harp', bladedancer: 'Twin Blades', demonbound: 'Hellglaive' };
const ARMOR_NAMES = { head: 'Helm', shoulder: 'Pauldrons', chest: 'Chestguard', pants: 'Legguards', gloves: 'Gauntlets' };
export const gearName = (set, slot, cls) => `${SETS[set].name} ${slot === 'weapon' ? (WEAPON_NAMES[cls] || 'Weapon') : ARMOR_NAMES[slot]}`;

// ------------------------------------------------------------------------------------------------ systems additions
// Added by the progression & economy layer (src/game/systems/). Additive only: new stackable ids, plus optional
// `icon` (canonical icon id when the id itself has no dedicated art) and `gold` (market base price per unit, gold;
// otherwise derived from `value` silver ÷ SILVER_PER_GOLD).
export const SILVER_PER_GOLD = 60;
Object.assign(ITEMS, {
  // life-skill uncommon & rare drops
  resin: { name: 'Amber Resin', kind: 'material', grade: 2, desc: 'Logged. Used in fusion materials and grenades.', value: 6, tradable: true, icon: 'item:timber' },
  heartwood: { name: 'Elder Heartwood', kind: 'material', grade: 3, desc: 'Rare logging find: wood from a tree older than Solhaven.', value: 42, tradable: true, icon: 'item:timber' },
  starsteel: { name: 'Starsteel Ore', kind: 'material', grade: 3, desc: 'Rare mining find: ore that fell with the Shards.', value: 45, tradable: true, icon: 'item:gem_ore' },
  hide: { name: 'Tough Hide', kind: 'material', grade: 2, desc: 'Hunted. Used in crafting.', value: 6, tradable: true, icon: 'item:meat' },
  pelt: { name: 'Pristine Pelt', kind: 'material', grade: 3, desc: 'Rare hunting find: a flawless pelt.', value: 40, tradable: true, icon: 'item:meat' },
  clam: { name: 'Glass Sea Clam', kind: 'material', grade: 2, desc: 'Fished. Used in food.', value: 6, tradable: true, icon: 'item:fish' },
  pearl: { name: 'Sea Pearl', kind: 'material', grade: 3, desc: 'Rare fishing find from the Glass Sea.', value: 50, tradable: true, icon: 'item:fish' },
  sunbloom: { name: 'Sunbloom Blossom', kind: 'material', grade: 3, desc: 'Rare foraging find: a flower that turns to follow the sun.', value: 40, tradable: true, icon: 'item:flower' },
  buried_coin: { name: 'Buried Coin', kind: 'material', grade: 2, desc: 'Excavated. Collectors pay well.', value: 8, tradable: true, icon: 'item:coin_pirate' },
  relic_idol: { name: 'Relic Idol', kind: 'material', grade: 3, desc: 'Rare excavation find: an idol of the Seven Lights.', value: 60, tradable: true, icon: 'item:relic_shard' },
  // cooking
  food3: { name: 'Pipberry Tart', kind: 'food', grade: 3, desc: 'Pips trade their best secrets for one slice. Restores 1,000 Life Energy.', value: 40 },
  food4: { name: 'Seafarer’s Platter', kind: 'food', grade: 3, desc: 'Grilled clams and pearl-rice. Restores 1,500 Life Energy.', value: 60 },
  // packs, pouches & tickets
  card_pack_epic: { name: 'Epic Card Pack', kind: 'consumable', grade: 3, desc: 'Contains a random Epic or better card.', value: 0, bound: 'roster', icon: 'item:card_pack' },
  card_pack_legend: { name: 'Legendary Card Selector', kind: 'consumable', grade: 4, desc: 'Choose one of three random Legendary cards.', value: 0, bound: 'roster', icon: 'item:card_pack' },
  card_pack_pip: { name: 'Pip Card Pack', kind: 'consumable', grade: 3, desc: 'Contains a random Pip card. Squeak!', value: 0, bound: 'roster', icon: 'item:card_pack' },
  gem_pouch_hi: { name: 'Radiant Gem Pouch', kind: 'consumable', grade: 4, desc: 'Contains a random Lv.3–5 gem.', value: 0, bound: 'roster', icon: 'item:chest' },
  accessory_chest: { name: 'Relic Accessory Chest', kind: 'consumable', grade: 5, desc: 'Contains a random Relic accessory.', value: 0, bound: 'roster', icon: 'item:chest' },
  life_tonic: { name: 'Life Energy Tonic', kind: 'consumable', grade: 3, desc: 'Restores 1,000 Life Energy.', value: 0, bound: 'roster', icon: 'item:elixir' },
  crew_contract: { name: 'Crew Contract', kind: 'consumable', grade: 3, desc: 'Recruits a new crew member for your stronghold.', value: 0, bound: 'roster', icon: 'item:scroll' },
  rename_ticket: { name: 'Name Change Ticket', kind: 'consumable', grade: 4, desc: 'Change a character’s name.', value: 0, bound: 'roster', icon: 'item:scroll' },
});
