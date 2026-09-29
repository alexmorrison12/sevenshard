// Vendors. Entry: { key, id?, qty, price: [currency, amount], limit?: ['daily'|'weekly'|'total', n], req?: { guildLevel, ilvl },
//   kind?: 'item' (default: stackable ITEMS id) | 'unlock' (unlock: 'mounts:<id>' …) | 'card' (card: id) |
//   'collect' (collect: [type, id]) | 'transfer' (slot) | 'tool' (tool: [skill, tier]), name?, grade?, icon?, desc? }
const S = (key, id, qty, cur, amount, limit, extra = {}) => ({ key, id, qty, price: [cur, amount], ...(limit ? { limit } : {}), ...extra });
const U = (key, unlock, name, grade, cur, amount, extra = {}) => ({ key, kind: 'unlock', unlock, name, grade, qty: 1, price: [cur, amount], limit: ['total', 1], ...extra });
const TOOL_PRICE = [0, 2000, 12000, 60000, 250000];
const tools = ['forage', 'log', 'mine', 'hunt', 'fish', 'dig'].flatMap(sk => [1, 2, 3, 4].map(t => ({ key: `tool_${sk}_${t}`, kind: 'tool', tool: [sk, t], qty: 1, price: ['silver', TOOL_PRICE[t]] })));
const GEAR = ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'];

export const SHOPS = {
  general: { name: 'General Goods', npc: 'general', desc: 'Potions, bombs, feathers, gifts and trade tools.', currency: 'silver', items: [
    S('hp_potion', 'hp_potion', 1, 'silver', 40), S('elixir', 'elixir', 1, 'silver', 250), S('destruction_bomb', 'destruction_bomb', 1, 'silver', 180),
    S('flame_grenade', 'flame_grenade', 1, 'silver', 160), S('frost_grenade', 'frost_grenade', 1, 'silver', 160), S('whirlwind_grenade', 'whirlwind_grenade', 1, 'silver', 170),
    S('clay_grenade', 'clay_grenade', 1, 'silver', 170), S('dark_grenade', 'dark_grenade', 1, 'silver', 170), S('sleep_bomb', 'sleep_bomb', 1, 'silver', 140), S('panacea', 'panacea', 1, 'silver', 140),
    S('time_stop', 'time_stop', 1, 'silver', 600, ['daily', 5]), S('feather', 'feather', 1, 'silver', 2000, ['weekly', 3]),
    S('gift1', 'gift1', 1, 'silver', 3000, ['daily', 3]), S('gift2', 'gift2', 1, 'silver', 9000, ['weekly', 5]), S('gift3', 'gift3', 1, 'silver', 9000, ['weekly', 5]), S('gift4', 'gift4', 1, 'silver', 30000, ['weekly', 1]),
    S('map', 'map', 1, 'silver', 5000, ['daily', 2]), S('crew_contract', 'crew_contract', 1, 'silver', 30000, ['weekly', 2]),
    ...tools,
  ] },
  raid: { name: 'Horned Tyrant Quartermaster', npc: 'blacksmith', desc: 'Reforge Vanguard gear (+12 or higher) into Horned Tyrant gear, and trade Horns of the Tyrant for relics.', currency: 'horn_shard', items: [
    ...GEAR.map(slot => ({ key: `transfer_${slot}`, kind: 'transfer', slot, qty: 1, price: ['horn_shard', slot === 'weapon' ? 10 : 6] })),
    S('accessory_chest', 'accessory_chest', 1, 'horn_shard', 60, ['weekly', 2]),
    S('solar_protection', 'solar_protection', 1, 'horn_shard', 10, ['weekly', 3]), S('solar_blessing', 'solar_blessing', 3, 'horn_shard', 6, ['weekly', 5]),
    S('card_pack_epic', 'card_pack_epic', 1, 'horn_shard', 30, ['weekly', 1]),
    { key: 'card_gorrath', kind: 'card', card: 'gorrath', qty: 1, price: ['horn_shard', 200], limit: ['total', 1] },
  ] },
  pvp: { name: 'Proving Grounds Quartermaster', npc: 'pvp', desc: 'Rewards for the Crucible’s regulars.', currency: 'pvp', items: [
    S('card_pack', 'card_pack', 1, 'pvp', 100, ['weekly', 5]), S('card_pack_epic', 'card_pack_epic', 1, 'pvp', 400, ['weekly', 2]),
    S('solar_blessing', 'solar_blessing', 2, 'pvp', 60, ['weekly', 10]), S('gem_pouch', 'gem_pouch', 1, 'pvp', 150, ['weekly', 3]),
    U('emote_victory', 'emotes:victory_pose', 'Emote: Victory Pose', 4, 'pvp', 2000),
    { key: 'art_8', kind: 'collect', collect: ['masterpieces', 'art:8'], name: 'Masterpiece VIII: Old Thunderhoof', grade: 4, qty: 1, price: ['pvp', 3000], limit: ['total', 1] },
    { key: 'star_7', kind: 'collect', collect: ['stars', 'star:7'], name: 'Omnium Star: Crucible Flame', grade: 4, qty: 1, price: ['pvp', 3000], limit: ['total', 1] },
  ] },
  guild: { name: 'Guild Quartermaster', npc: 'guild', desc: 'Bloodstones for honing supplies.', currency: 'bloodstone', guild: true, items: [
    S('leapstone', 'leapstone', 5, 'bloodstone', 60, ['weekly', 20]), S('fusion', 'fusion', 5, 'bloodstone', 80, ['weekly', 10]),
    S('solar_grace', 'solar_grace', 5, 'bloodstone', 40, ['weekly', 10]), S('solar_blessing', 'solar_blessing', 2, 'bloodstone', 60, ['weekly', 10]), S('solar_protection', 'solar_protection', 1, 'bloodstone', 150, ['weekly', 3]),
    S('card_pack', 'card_pack', 1, 'bloodstone', 100, ['weekly', 3]), S('gem_pouch', 'gem_pouch', 1, 'bloodstone', 200, ['weekly', 2]),
    U('guild_warhorse', 'mounts:guild_warhorse', 'Mount: Guild Warhorse', 4, 'bloodstone', 5000, { req: { guildLevel: 10 } }),
  ] },
  harbor: { name: 'Harbor Exchange', npc: 'harbor', desc: 'Pirate coins for ships, crew and maps.', currency: 'pirate', items: [
    U('skin_crimson', 'unlocks:ship:skin:crimson', 'Ship Skin: Crimson Corsair', 3, 'pirate', 800),
    U('skin_pipsail', 'unlocks:ship:skin:pipsail', 'Ship Skin: Pipsail', 4, 'pirate', 1200),
    U('skin_gilded', 'unlocks:ship:skin:gilded', 'Ship Skin: Gilded Dawnrunner', 5, 'pirate', 3000),
    S('crew_contract', 'crew_contract', 1, 'pirate', 300, ['weekly', 2]), S('map', 'map', 1, 'pirate', 50, ['daily', 3]),
    { key: 'art_1', kind: 'collect', collect: ['masterpieces', 'art:1'], name: 'Masterpiece I: Sunrise over Solhaven', grade: 4, qty: 1, price: ['pirate', 2500], limit: ['total', 1] },
    { key: 'card_hollowgale', kind: 'card', card: 'ghost_captain', qty: 1, price: ['pirate', 1500], limit: ['total', 1] },
  ] },
  island: { name: 'Glass Sea Token Exchange', npc: 'harbor', desc: 'Island tokens from Adventure Islands and the Ghost Ship.', currency: 'tokens', items: [
    S('skill_potion', 'skill_potion', 1, 'tokens', 30, ['total', 3]), S('gift4', 'gift4', 1, 'tokens', 8, ['weekly', 2]),
    S('card_pack_legend', 'card_pack_legend', 1, 'tokens', 40, ['total', 2]), S('life_tonic', 'life_tonic', 2, 'tokens', 6, ['weekly', 5]),
    U('reef_runner', 'mounts:reef_runner', 'Mount: Reef Runner', 5, 'tokens', 60),
  ] },
  card: { name: 'Card Exchange', npc: 'cards', desc: 'Madame Iolanthe’s card packs.', currency: 'gold', items: [
    S('card_pack', 'card_pack', 1, 'gold', 25, ['weekly', 10]), S('card_pack_pip', 'card_pack_pip', 1, 'gold', 40, ['weekly', 5]),
    S('card_pack_epic', 'card_pack_epic', 1, 'gold', 150, ['weekly', 3]), S('card_pack_legend', 'card_pack_legend', 1, 'gold', 900, ['weekly', 1]),
  ] },
  crystal: { name: 'Crystal Shop', npc: null, desc: 'Cosmetics, bound honing bundles, pets and mounts.', currency: 'crystals', items: [
    U('outfit_dawn', 'unlocks:outfit:dawn_regalia', 'Outfit: Dawn Regalia', 5, 'crystals', 1200),
    U('outfit_pip', 'unlocks:outfit:pip_onesie', 'Outfit: Pip Onesie', 4, 'crystals', 800),
    U('outfit_corsair', 'unlocks:outfit:corsair', 'Outfit: Glass Sea Corsair', 4, 'crystals', 1000),
    U('pet_foxling', 'pets:foxling', 'Pet: Foxling', 3, 'crystals', 600), U('pet_slimelet', 'pets:slimelet', 'Pet: Slimelet', 3, 'crystals', 400),
    U('mount_direwolf', 'mounts:crystal_direwolf', 'Mount: Crystal Direwolf', 5, 'crystals', 2400),
    S('leapstone', 'leapstone', 50, 'crystals', 90, ['weekly', 3], { bound: true }), S('fusion', 'fusion', 30, 'crystals', 60, ['weekly', 3], { bound: true }),
    S('guardian_stone', 'guardian_stone', 1000, 'crystals', 50, ['weekly', 3], { bound: true }), S('solar_protection', 'solar_protection', 2, 'crystals', 70, ['weekly', 2], { bound: true }),
    S('life_tonic', 'life_tonic', 3, 'crystals', 50, ['weekly', 5]), S('crew_contract', 'crew_contract', 1, 'crystals', 100, ['weekly', 2]), S('rename_ticket', 'rename_ticket', 1, 'crystals', 500),
  ] },
};
/** display names for unlocks sold here (merged into the bundle-row catalog) */
export const SHOP_UNLOCKS = {
  mounts: { reef_runner: { name: 'Reef Runner', grade: 5 } },
  emotes: { victory_pose: { name: 'Victory Pose', grade: 4 } },
  unlocks: { 'ship:skin:crimson': { name: 'Crimson Corsair (ship skin)', grade: 3 }, 'ship:skin:pipsail': { name: 'Pipsail (ship skin)', grade: 4 }, 'ship:skin:gilded': { name: 'Gilded Dawnrunner (ship skin)', grade: 5 },
    'outfit:dawn_regalia': { name: 'Dawn Regalia (outfit)', grade: 5 }, 'outfit:pip_onesie': { name: 'Pip Onesie (outfit)', grade: 4 }, 'outfit:corsair': { name: 'Glass Sea Corsair (outfit)', grade: 4 } },
};
