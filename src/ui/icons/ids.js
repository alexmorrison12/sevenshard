// The complete SEVENSHARD icon id catalogue (data only).
export const CLASSES = ['reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound'];

/** DESIGN.md §4 skill names in lower_snake_case, in design order. */
export const SKILLS = {
  reaver: ['whirlwind_edge', 'tempest_slash', 'diving_slash', 'sword_storm', 'mountain_cleave', 'hell_blade', 'red_dust', 'chain_sword', 'strike_wave', 'shoulder_charge', 'finish_strike', 'wind_blade'],
  oathkeeper: ['holy_bulwark', 'heavenly_blessing', 'light_shock', 'sword_of_justice', 'godsent_law', 'holy_explosion', 'flash_slash', 'execution_of_justice', 'wrath_of_heaven', 'charging_blade', 'sacred_chain', 'rite_of_mending'],
  stormfist: ['lightning_kick', 'blazing_fist', 'tempest_barrage', 'sweeping_kick', 'storm_dragon_upper', 'swiftwind_dash', 'ground_quake', 'thunder_palm', 'moonflash_kick', 'heavenly_strike', 'lightning_whisper', 'soaring_tiger'],
  pistoleer: ['quick_shot', 'spiral_tracker', 'equilibrium', 'dexterous_shot', 'dual_buckshot', 'shotgun_rapid_fire', 'last_request', 'dragon_shot', 'focused_shot', 'perfect_shot', 'target_down', 'catastrophe'],
  starcaller: ['doomfall', 'blaze_nova', 'frost_lance', 'starfire_explosion', 'punishing_bolt', 'seraphic_hail', 'esoteric_rune', 'lightning_vortex', 'inferno_wave', 'blink', 'void_rift', 'frost_nova'],
  songweaver: ['sound_shock', 'harp_of_rhythm', 'stigma', 'guardian_tune', 'heavenly_tune', 'rhapsody_of_light', 'wind_of_music', 'sonic_vibration', 'prelude_of_storm', 'rhythm_buckshot', 'soundholic', 'tempest_chord'],
  bladedancer: ['blitz_rush', 'spincutter', 'maelstrom', 'void_strike', 'death_trance', 'moonlight_sonic', 'soul_absorber', 'wind_cut', 'dark_order', 'upper_slash', 'blade_dance', 'shadow_step'],
  demonbound: ['demonic_slash', 'ruining_rush', 'cruel_cutter', 'blood_massacre', 'grind_chain', 'thrust_of_destruction', 'demolition', 'soul_chain', 'blood_pillars', 'howl', 'leaping_blow', 'demon_vision'],
};
export const CLASS_SPECIAL = ['identity_z', 'identity_x', 'awakening'];
export const DEMON_SKILLS = ['abyss_claw', 'rending_talons', 'hellfire_wings', 'demonic_slam'];

export const TRIPODS = ['quick_prep', 'mobility', 'weak_point', 'enhanced', 'wide', 'super_armor', 'bleed', 'burn', 'freeze', 'shock', 'pull', 'pierce', 'extra_hit', 'charge', 'zone', 'element',
  // the game's generic tripod catalogue (src/game/skills/tripods.js)
  'stance', 'unstoppable', 'swift', 'mana_saver', 'keen', 'crushing', 'aftershock', 'back', 'head', 'scorched', 'vital'];

export const ENGR_COMBAT = ['vendetta', 'hexed_idol', 'keen_edge', 'adrenaline', 'backstabber', 'frontliner', 'wind_captain', 'spirit_absorption', 'precise_blade', 'super_charge', 'barricade', 'expert', 'awakening', 'master_brawler', 'ether_predator', 'crisis_evasion', 'stabilized_status', 'all_out_attack', 'mana_flow', 'heavy_armor', 'sight_focus', 'drops_of_ether', 'propulsion', 'increase_mass'];
/** Class engravings by class (2 each). */
export const ENGR_CLASS = {
  reaver: ['bloodfrenzy', 'tempered_fury'], oathkeeper: ['blessed_aura', 'judgment'], stormfist: ['storm_conduit', 'chi_master'],
  pistoleer: ['quickdraw', 'longshot'], starcaller: ['ignition', 'wellspring'], songweaver: ['last_refrain', 'heart_of_courage'],
  bladedancer: ['afterglow', 'stormsurge'], demonbound: ['unleashed', 'restraint'],
};
export const ENGR_NEG = ['neg_atk', 'neg_speed', 'neg_def', 'neg_move'];

export const STATUSES = ['burn', 'bleed', 'poison', 'freeze', 'shock', 'stun', 'fear', 'sleep', 'silence', 'slow', 'knockdown', 'shield', 'heal', 'atk_up', 'crit_up', 'speed_up', 'def_down', 'brand', 'counter', 'stagger', 'invuln', 'super_armor', 'rest',
  'armor_break', 'weaken', 'def_up', 'regen', 'enrage'];
/** Statuses drawn with the harmful (red) frame. */
export const DEBUFFS = new Set(['burn', 'bleed', 'poison', 'freeze', 'shock', 'stun', 'fear', 'sleep', 'silence', 'slow', 'knockdown', 'def_down', 'brand', 'stagger', 'armor_break', 'weaken', 'enrage']);

export const UI_IDS = ['character', 'inventory', 'skills', 'engravings', 'cards', 'gems', 'map', 'guild', 'market', 'mail', 'stronghold', 'tome', 'collectibles', 'party', 'settings', 'songs', 'emotes', 'pvp', 'leaderboard', 'compass', 'quests', 'friends', 'honing', 'mounts', 'pets', 'wardrobe', 'chat', 'photo', 'help', 'logout'];

export const BOSSES = ['gorrath', 'skarn', 'vesk', 'varkhul', 'ashmaw', 'gatekeeper', 'rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'nerissa', 'deep_oracle', 'thunderhoof', 'vorrathis', 'ghost_captain'];
/** npc ids: the four story busts, every city NPC of src/data/npcs.js (dialog portraits), and card characters. */
export const NPCS = ['brannoc', 'seraphine', 'bramblebeard', 'merchant',
  'blacksmith', 'market', 'bank', 'guild', 'cards', 'general', 'songs', 'pvp', 'harbor', 'stronghold', 'tasks', 'gemcutter', 'tailor', 'stable', 'rapport1', 'rapport2', 'rapport3', 'nexus', 'mail', 'board',
  'morwenna', 'ithra', 'aurelion', 'solenne', 'maelis', 'vaelor', 'kest', 'corvan', 'puddlebutton', 'sprig', 'captain_acorn', 'mossy_gran'];
/** card ids (src/data/cards.js). */
export const CARDS = ['seraphine', 'ithra', 'aurelion', 'solenne', 'brannoc', 'maelis', 'bramblebeard', 'puddlebutton', 'sprig', 'tumbleroot', 'captain_acorn', 'mossy_gran', 'gorrath', 'varkhul', 'skarn', 'vesk', 'ashmaw', 'rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'thunderhoof', 'nerissa', 'maren', 'hilda', 'mirelle', 'wren', 'morwenna', 'deep_oracle', 'ghost_captain', 'gatekeeper', 'vorrathis', 'vaelor', 'kest', 'corvan', 'tully', 'iolanthe'];
export const CURRENCIES = ['silver', 'gold', 'crystal', 'royal', 'shards', 'bloodstone', 'pirate', 'token', 'pvp'];

export const ARMOR_SLOTS = ['head', 'shoulder', 'chest', 'pants', 'gloves'];
export const TIERS = ['t0', 't1', 't2'];
export const ACCESSORIES = ['necklace', 'earring', 'ring', 'stone', 'bracelet'];
export const MATERIALS = ['destruction_stone', 'guardian_stone', 'leapstone', 'fusion', 'shards', 'solar_grace', 'solar_blessing', 'solar_protection'];
export const BATTLE_ITEMS = ['hp_potion', 'elixir', 'destruction_bomb', 'flame_grenade', 'frost_grenade', 'whirlwind_grenade', 'clay_grenade', 'dark_grenade', 'sleep_bomb', 'panacea', 'time_stop', 'feather'];
export const TRADE = ['herb', 'flower', 'timber', 'ore', 'gem_ore', 'fish', 'meat', 'relic_shard'];
export const COLLECTIBLES = ['island_soul', 'giants_heart', 'masterpiece', 'omnium_star', 'sea_bounty', 'world_leaf', 'pip_seed'];
export const MISC_ITEMS = ['card_pack', 'mount_whistle', 'pet_charm', 'chest', 'key', 'map', 'coin_pirate', 'skill_potion', 'scroll', 'quest'];
/** extra ITEMS ids of src/data/items.js with dedicated art. */
export const EXTRA_ITEMS = ['horn_shard', 'resin', 'heartwood', 'starsteel', 'hide', 'pelt', 'clam', 'pearl', 'sunbloom', 'buried_coin', 'relic_idol', 'card_pack_epic', 'card_pack_legend', 'card_pack_pip', 'gem_pouch', 'gem_pouch_hi', 'accessory_chest', 'life_tonic', 'crew_contract', 'rename_ticket'];

/** Grades: name + colour (DESIGN.md §6). */
export const GRADES = [
  { id: 0, name: 'Common', color: '#e8e8e8' },
  { id: 1, name: 'Uncommon', color: '#8bd96b' },
  { id: 2, name: 'Rare', color: '#4fa3ff' },
  { id: 3, name: 'Epic', color: '#b86bff' },
  { id: 4, name: 'Legendary', color: '#ffae3a' },
  { id: 5, name: 'Relic', color: '#ff6a2a' },
  { id: 6, name: 'Ancient', color: '#e9d2a6' },
  { id: 7, name: 'Primal', color: '#39e6d8' },
];

/** Class signature colours (UI accents, party frames). */
export const CLASS_COLORS = {
  reaver: '#e8313f', oathkeeper: '#f2c14e', stormfist: '#46b4ff', pistoleer: '#e0913a',
  starcaller: '#9d6bff', songweaver: '#f09a8a', bladedancer: '#b58cff', demonbound: '#a0283a',
};

/** Every canonical id, grouped by family (order = gallery order). */
export function buildIds() {
  const out = [];
  for (const c of CLASSES) {
    for (const k of SKILLS[c]) out.push(`skill:${c}:${k}`);
    for (const k of CLASS_SPECIAL) out.push(`skill:${c}:${k}`);
  }
  for (const k of DEMON_SKILLS) out.push(`skill:demonbound:${k}`);
  out.push('skill:any:dash', 'skill:any:basic');
  for (const t of TRIPODS) out.push(`tripod:${t}`);
  for (const c of CLASSES) out.push(`class:${c}`);
  for (const c of CLASSES) { out.push(`item:weapon:${c}`); for (const t of TIERS) out.push(`item:weapon:${c}:${t}`); }
  for (const s of ARMOR_SLOTS) for (const t of TIERS) out.push(`item:${s}:${t}`);
  for (const a of ACCESSORIES) out.push(`item:${a}`);
  for (const k of ['ruin', 'swift']) for (let i = 1; i <= 10; i++) out.push(`item:gem:${k}:${i}`);
  for (const e of [...ENGR_COMBAT, ...Object.values(ENGR_CLASS).flat(), ...ENGR_NEG]) out.push(`item:book:${e}`);
  for (const m of MATERIALS) out.push(`item:${m}`);
  for (const b of BATTLE_ITEMS) out.push(`item:${b}`);
  for (const t of TRADE) out.push(`item:${t}`);
  for (let i = 1; i <= 4; i++) out.push(`item:food:${i}`);
  for (let i = 1; i <= 4; i++) out.push(`item:gift:${i}`);
  for (const c of COLLECTIBLES) out.push(`item:${c}`);
  for (const m of MISC_ITEMS) out.push(`item:${m}`);
  for (const m of EXTRA_ITEMS) out.push(`item:${m}`);
  for (const c of CURRENCIES) out.push(`currency:${c}`);
  for (const e of ENGR_COMBAT) out.push(`engr:${e}`);
  for (const e of Object.values(ENGR_CLASS).flat()) out.push(`engr:${e}`);
  for (const e of ENGR_NEG) out.push(`engr:${e}`);
  for (const s of STATUSES) out.push(`status:${s}`);
  for (const u of UI_IDS) out.push(`ui:${u}`);
  for (const b of BOSSES) out.push(`boss:${b}`);
  for (const n of NPCS) out.push(`npc:${n}`);
  for (const c of CARDS) out.push(`card:${c}`);
  for (let i = 0; i <= 7; i++) out.push(`grade:${i}`);
  return out;
}
