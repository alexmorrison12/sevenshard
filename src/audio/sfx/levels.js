// Loudness calibration. TARGETS: design loudness per sound (momentary-max LUFS, BS.1770 K-weighted, 400 ms, full
// graph with the limiter bypassed, bus volumes 1, listener at the source). LEVELS: the linear gain trims that hit
// those targets — regenerated with __lab.calibrate(TARGETS) in the audio lab (averaged over 3 random seeds).
export const TARGETS = {
  // ui
  ui_hover: -34, ui_click: -27, ui_tab: -27, ui_open: -25, ui_close: -25, ui_error: -23, notification: -22,
  quest_accept: -20, quest_complete: -17, level_up: -13, identity_ready: -21, telegraph_warn: -25, raid_warning: -14,
  pvp_countdown: -20, victory_horn: -14,
  // crafting
  honing_hammer: -18, honing_success: -13, honing_fail: -17, stone_facet_success: -19, stone_facet_fail: -20,
  // movement
  footstep_stone: -30, footstep_grass: -30, footstep_snow: -30, dash: -22, getup: -24, knockdown: -19,
  // melee & guns
  whoosh: -22, slash: -20, slash_heavy: -18, greatsword: -16, whoosh_big: -17, blade: -20,
  impact: -17, monster_hit: -18, impact_heavy: -14, crit: -13.5, punch: -17, kick: -17, block: -17,
  counter: -11.5, stagger_break: -10.5, part_break: -13,
  gun: -16, gun_dual: -16, shotgun: -13, rifle: -13, reload: -24,
  // skills
  magic_cast: -20, fire: -17, fire_big: -13, ice: -18, ice_shatter: -16, lightning: -15, thunder: -12,
  holy: -18, holy_big: -13, dark: -18, demon: -15, harp: -18, harp_big: -15, note: -21, shield: -19, heal: -19,
  buff: -18, debuff: -19, portal_open: -18, portal_enter: -17, teleport: -19, awaken: -9.5, identity_burst: -13,
  revive: -16, death_player: -15, enrage: -12,
  // blasts
  ground_crack: -13, shockwave: -14, explosion: -12, explosion_big: -10, meteor: -10,
  // creatures
  monster_die: -18, demon_die: -17, imp_screech: -19, hound_growl: -18, boss_roar: -11, boss_roar_big: -9.5,
  pip_squeak: -22, pip_cheer: -20,
  // loot & world
  coin: -22, loot_drop: -21, loot_rare: -17, loot_legendary: -11.5, chest_open: -19, door_open: -20,
  mount_summon: -18, horse_gallop: -21, ship_bell: -18, cannon: -12, wave_splash: -19, sail_flap: -21,
  fishing_cast: -21, fishing_bite: -18, fishing_reel: -23, chop: -18, mine: -18, dig: -20, gather: -22, bell: -16,
};
export const LEVELS = {
  ui_hover: 2.58, ui_click: 1.622, ui_tab: 3.658, ui_open: 3.02, ui_close: 2.371, ui_error: 0.684,
  notification: 1.318, quest_accept: 0.776, quest_complete: 0.733, level_up: 0.692, identity_ready: 1.24, telegraph_warn: 0.933,
  raid_warning: 0.462, pvp_countdown: 1.641, victory_horn: 1.08, honing_hammer: 0.891, honing_success: 0.73, honing_fail: 1.869,
  stone_facet_success: 1.44, stone_facet_fail: 1.957, footstep_stone: 1.566, footstep_grass: 1.252, footstep_snow: 0.963, dash: 2.883,
  getup: 1.994, knockdown: 0.65, whoosh: 2.471, slash: 2.718, slash_heavy: 2, greatsword: 0.99,
  whoosh_big: 1.667, blade: 3.162, impact: 1.525, monster_hit: 1.105, impact_heavy: 0.884, crit: 0.852,
  punch: 1.303, kick: 1.059, block: 1.429, counter: 0.681, stagger_break: 0.797, part_break: 1.101,
  gun: 1.226, gun_dual: 1.202, shotgun: 0.838, rifle: 1.101, reload: 3.534, magic_cast: 2.112,
  fire: 0.83, fire_big: 0.785, ice: 1.402, ice_shatter: 1.527, lightning: 1.036, thunder: 0.779,
  holy: 2.173, holy_big: 0.739, dark: 0.497, demon: 0.569, harp: 0.841, harp_big: 0.764,
  note: 1.098, shield: 0.638, heal: 0.816, buff: 1.268, debuff: 1.717, portal_open: 1.197,
  portal_enter: 1.051, teleport: 2.011, awaken: 0.656, identity_burst: 0.841, revive: 1.108, death_player: 1.202,
  enrage: 0.314, ground_crack: 0.667, shockwave: 0.95, explosion: 0.665, explosion_big: 0.724, meteor: 0.71,
  monster_die: 1.007, demon_die: 0.933, imp_screech: 0.765, hound_growl: 0.759, boss_roar: 0.524, boss_roar_big: 0.588,
  pip_squeak: 1.914, pip_cheer: 1.019, coin: 1.586, loot_drop: 2.018, loot_rare: 1.462, loot_legendary: 0.686,
  chest_open: 2.239, door_open: 4.712, mount_summon: 2.003, horse_gallop: 1.508, ship_bell: 1.025, cannon: 0.655,
  wave_splash: 0.767, sail_flap: 2.545, fishing_cast: 2.56, fishing_bite: 2.67, fishing_reel: 6.213, chop: 1.451,
  mine: 1.666, dig: 1.71, gather: 2.821, bell: 0.987,
};
