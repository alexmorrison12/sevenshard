// Inferno Descent (roguelite, floors 1–100), Rift Cube (10-room gauntlet) and Trial Guardian (weekly guardian with
// affixes): floor kinds, enemy bands by depth, boss floors, boons, floor modifiers, extra mob templates, themes.
// Pure data — the runtime lives in src/game/modes/{inferno,cube,trial}.js.
import { FIELD_MOBS } from './field.js';

const cone = (r, deg) => ({ shape: 'cone', r, angle: deg * Math.PI / 180 });
const circle = r => ({ shape: 'circle', r });
const rect = (len, width) => ({ shape: 'rect', len, width });

export const INFERNO = {
  floors: 100,
  boonEvery: 5,          // a boon choice after clearing every 5th floor
  bossEvery: 10,         // a real boss on every 10th floor
  segment: 5,            // the zone is rebuilt (new seeded layout) every 5 floors; floors in between re-shuffle props
  floorTime: { normal: 80, hunter: 110, boss: 180 },
  burnTick: 2, burnPct: 0.04,          // after the floor timer: the Inferno rises (true damage every 2 s)
  clearHeal: 0.2,                      // heal on floor clear
  checkpoints: 10,                     // start from floor 1, 11, 21 … up to your best
  items: [{ id: 'hp_potion', count: 3 }, { id: 'destruction_bomb', count: 2 }, { id: 'flame_grenade', count: 3 }, { id: 'time_stop', count: 1 }],
  ilvl: 1415,                          // normalised hero item level
  skillLv: 10,                         // normalised skill level (tripods keep your picks)
};

/** enemy HP / damage multipliers by floor (× the normalised reference at iLvl 1415) */
export const floorHp = f => 2 + (f - 1) * 0.05 + Math.pow(f / 100, 2) * 2;
export const floorAtk = f => 0.75 + (f - 1) * 0.014;
/** boss HP budget in "attack-power seconds" (a solo hero with 0 boons deals ≈ 18–22 ap/s over a fight) */
export const bossHpAp = f => 1250 + f * 42;
/** party scaling for enemy HP */
export const partyHp = n => 1 + 0.7 * Math.max(0, n - 1);

/** Floor objectives. from = first floor it can appear on. */
export const FLOOR_KINDS = {
  purge: { name: 'Purge', desc: 'Destroy every demon on the floor.', weight: 5, from: 1 },
  elites: { name: 'Elite Hunt', desc: 'Slay the champions of the pit.', weight: 3, from: 3 },
  pylons: { name: 'Rift Pylons', desc: 'Shatter the rift pylons before the horde overwhelms you.', weight: 2.2, from: 4 },
  survive: { name: 'Endure', desc: 'Survive the onslaught until the fire gate opens.', weight: 2, from: 6, secs: 40 },
  hunter: { name: 'Named Foe', desc: 'A champion of the Inferno blocks the way.', weight: 1.8, from: 7 },
  treasure: { name: 'Gilded Imp', desc: 'A Gilded Imp is loose with the loot — catch it before it escapes!', weight: 0.7, from: 2 },
};

/** Real bosses (src/data/bosses) guarding every 10th floor. */
export const BOSS_FLOORS = { 10: 'gatekeeper', 20: 'rimewing', 30: 'cinderhorn', 40: 'thunderhoof', 50: 'sandmaw', 60: 'varkhul', 70: 'kurai', 80: 'nerissa', 90: 'deep_oracle', 100: 'gorrath' };

/** What lives at each depth: weighted mob pools (MOBS ids or ids from INFERNO_MOBS) and elite candidates. */
export const BANDS = [
  { to: 10, pool: [['imp', 8], ['hellhound', 3], ['skeleton', 3], ['wolf', 2], ['legionnaire', 1]], elites: ['legionnaire', 'hellhound', 'skeleton'] },
  { to: 20, pool: [['imp', 6], ['hellhound', 3], ['skeleton', 3], ['spider', 3], ['abyss_caster', 2], ['legionnaire', 2], ['wraith', 1]], elites: ['legionnaire', 'spider', 'abyss_caster', 'gargoyle'] },
  { to: 35, pool: [['imp', 5], ['hellhound', 3], ['gargoyle', 2], ['abyss_caster', 2], ['legionnaire', 3], ['wraith', 2], ['crab', 1], ['wisp', 2]], elites: ['brute', 'crystal_golem', 'legionnaire', 'direwolf'] },
  { to: 55, pool: [['imp', 4], ['hellhound', 3], ['gargoyle', 3], ['abyss_caster', 3], ['legionnaire', 3], ['wraith', 3], ['crab', 2], ['skeleton', 2]], elites: ['brute', 'crystal_golem', 'direwolf', 'treant'] },
  { to: 80, pool: [['hellhound', 3], ['gargoyle', 3], ['abyss_caster', 3], ['legionnaire', 4], ['wraith', 3], ['crab', 2], ['brute', 0.6]], elites: ['brute', 'crystal_golem', 'direwolf', 'treant', 'hellknight'] },
  { to: 100, pool: [['hellhound', 3], ['gargoyle', 3], ['abyss_caster', 3], ['legionnaire', 4], ['wraith', 4], ['brute', 1], ['crystal_golem', 0.6]], elites: ['brute', 'crystal_golem', 'treant', 'hellknight', 'direwolf'] },
];
export const bandOf = f => BANDS.find(b => f <= b.to) || BANDS[BANDS.length - 1];

/** Named champions for 'hunter' floors (FIELD_MOBS templates with creature models, plus Inferno originals). */
export const HUNTERS = [
  { type: 'grizzlefang', from: 7 }, { type: 'broodmother', from: 7 }, { type: 'hollow_knight', from: 11 },
  { type: 'big_beetle', from: 11 }, { type: 'blightroot', from: 21 }, { type: 'pit_lord', from: 15 }, { type: 'cinder_matron', from: 31 },
  { type: 'hellknight', from: 41, name: 'Vorgrim the Unbroken' },
];

/** Extra templates (src/data/mobs.js shape) for creatures that have models but no mob template. */
export const INFERNO_MOBS = {
  wraith: { name: 'Cinder Wraith', model: 'wraith', radius: 0.45, height: 2.0, hp: 26, atk: 0.026, speed: 4.4, aggro: 18, mass: 0.7, xp: 7, ranged: 8,
    attacks: [{ id: 'soul_bolt', range: 10, cd: 2.4, windup: 0.55, dur: 1.0, anim: 'cast', proj: { speed: 13, range: 12, radius: 0.45, kind: 'dark', color: 'void', hit: { coef: 1.1 } } },
      { id: 'wail', range: 3.2, cd: 7, windup: 0.8, dur: 1.2, anim: 'cast', hit: { ...circle(3.4), coef: 1.2, status: [{ id: 'fear', dur: 1 }] }, tele: true }] },
  crab: { name: 'Magma Crab', model: 'crab', radius: 0.7, height: 1.0, hp: 34, atk: 0.024, speed: 3.8, aggro: 14, mass: 1.6, xp: 7, poise: 30,
    attacks: [{ id: 'pinch', range: 1.9, cd: 1.8, windup: 0.45, dur: 0.9, anim: 'attack', hit: { ...cone(2.2, 90), coef: 1.2 } }] },
  direwolf: { name: 'Ashen Direwolf', model: 'direwolf', radius: 0.75, height: 1.4, hp: 120, atk: 0.036, speed: 6.8, aggro: 20, mass: 2.4, xp: 30, elite: true, poise: 60, superArmor: 1,
    attacks: [{ id: 'maul', range: 2.2, cd: 1.6, windup: 0.4, dur: 0.85, anim: 'attack', hit: { ...cone(2.8, 100), coef: 1.3 } },
      { id: 'pounce', range: 9, minRange: 3, cd: 5.5, windup: 0.55, dur: 1.0, anim: 'attack_big', lunge: 6, hit: { ...circle(2.4), coef: 1.8, knock: 'down' }, tele: true }] },
  treant: { name: 'Charred Treant', model: 'treant', radius: 1.2, height: 4.0, hp: 240, atk: 0.05, speed: 2.8, aggro: 18, mass: 8, xp: 60, elite: true, poise: 120, superArmor: 1,
    attacks: [{ id: 'slam', range: 3.4, cd: 3.2, windup: 1.0, dur: 1.8, anim: 'attack_big', hit: { ...circle(3.6), coef: 1.6, knock: 'down', off: 2 }, tele: true },
      { id: 'sweep', range: 3.2, cd: 2.4, windup: 0.6, dur: 1.2, anim: 'attack', hit: { ...cone(4, 150), coef: 1.1, knock: 'push', kb: 2.5 } },
      { id: 'roots', range: 14, cd: 7, windup: 1.2, dur: 1.6, anim: 'cast', atTarget: true, hit: { ...circle(2.6), coef: 1.8, status: [{ id: 'slow', dur: 3 }] }, tele: true }] },
  hellknight: { name: 'Hellforged Knight', model: 'legionnaire', radius: 0.8, height: 2.6, hp: 220, atk: 0.05, speed: 4.4, aggro: 20, mass: 6, xp: 70, elite: true, poise: 120, superArmor: 1, scale: 1.25,
    attacks: [{ id: 'cleave', range: 2.8, cd: 2, windup: 0.55, dur: 1.1, anim: 'attack', hit: { ...cone(3.4, 130), coef: 1.4 } },
      { id: 'lunge', range: 9, minRange: 3, cd: 6, windup: 0.7, dur: 1.2, anim: 'attack_big', lunge: 6.5, hit: { ...rect(3.2, 2), coef: 1.9, knock: 'down' }, tele: true },
      { id: 'hellfire', range: 3.6, cd: 9, windup: 1.1, dur: 1.6, anim: 'attack_big', hit: { ...circle(4.2), coef: 2.2, knock: 'up', status: [{ id: 'burn', dur: 4, power: 0.3 }] }, tele: true }] },
  pit_lord: { name: 'Gorehide, Lord of the Pit', model: 'brute', radius: 1.2, height: 3.4, hp: 300, atk: 0.06, speed: 3.8, aggro: 22, mass: 8, xp: 90, elite: true, poise: 160, superArmor: 1, scale: 1.3,
    attacks: [{ id: 'smash', range: 3.4, cd: 3, windup: 0.9, dur: 1.7, anim: 'attack_big', hit: { ...circle(3.6), coef: 1.6, knock: 'down', off: 2 }, tele: true },
      { id: 'swing', range: 3.2, cd: 1.8, windup: 0.55, dur: 1.1, anim: 'attack', hit: { ...cone(3.8, 150), coef: 1.1, knock: 'push', kb: 2.5 } },
      { id: 'quake', range: 6, cd: 9, windup: 1.3, dur: 1.9, anim: 'attack_big', hit: { shape: 'donut', r: 8, inner: 3, coef: 1.8, knock: 'up' }, tele: true }] },
  cinder_matron: { name: 'The Cinder Matron', model: 'abyss_caster', radius: 0.8, height: 2.6, hp: 200, atk: 0.05, speed: 3.6, aggro: 22, mass: 5, xp: 80, elite: true, poise: 100, superArmor: 1, scale: 1.35, ranged: 9,
    attacks: [{ id: 'volley', range: 12, cd: 2.2, windup: 0.6, dur: 1.1, anim: 'cast', proj: { speed: 14, range: 14, radius: 0.55, kind: 'fire', color: 'fire', hit: { coef: 1.3 } } },
      { id: 'pyre', range: 13, cd: 6, windup: 1.2, dur: 1.6, anim: 'cast', atTarget: true, hit: { ...circle(3.2), coef: 2, status: [{ id: 'burn', dur: 5, power: 0.35 }] }, tele: true },
      { id: 'nova', range: 4, cd: 8, windup: 1.0, dur: 1.5, anim: 'cast', hit: { ...circle(5), coef: 1.6, knock: 'push', kb: 4 }, tele: true }] },
  gilded_imp: { name: 'Gilded Imp', model: 'imp', radius: 0.5, height: 1.2, hp: 60, atk: 0, speed: 5.2, aggro: 30, mass: 0.6, xp: 20, attacks: [], scale: 1.3, flee: true },
  // Named foes from the fields (creature-model templates only)
  ...Object.fromEntries(['grizzlefang', 'broodmother', 'hollow_knight', 'big_beetle', 'blightroot'].filter(k => FIELD_MOBS[k]).map(k => [k, FIELD_MOBS[k]])),
};

/**
 * Boons: one of three is offered after every 5th floor. mods are status mods (keys ending in Mul multiply, others
 * add); hpMul scales max HP; fx names a behaviour the Inferno runtime implements. max = stack cap. rarity 1–3.
 */
export const BOONS = [
  { id: 'fury', name: 'Ember Fury', desc: '+12% damage.', rarity: 1, max: 5, icon: 'status:atk_up', mods: { dmgMul: 0.12 } },
  { id: 'keen', name: 'Keen Cinders', desc: '+8% crit rate and +20% crit damage.', rarity: 1, max: 4, icon: 'status:crit_up', mods: { crit: 0.08, critDmg: 0.2 } },
  { id: 'quicken', name: 'Quickening Flame', desc: 'Skill cooldowns −8%.', rarity: 1, max: 4, icon: 'status:speed_up', mods: { cdr: 0.08 } },
  { id: 'titan', name: 'Titan Blood', desc: '+18% max HP.', rarity: 1, max: 4, icon: 'status:regen', hpMul: 0.18 },
  { id: 'iron', name: 'Obsidian Skin', desc: 'Take 10% less damage.', rarity: 1, max: 3, icon: 'status:def_up', mods: { dmgTaken: -0.1 } },
  { id: 'fleet', name: 'Fleetfoot', desc: '+12% movement speed; dash cooldown −30%.', rarity: 1, max: 2, icon: 'status:speed_up', mods: { moveSpd: 0.12 }, fx: 'fleet', v: 0.3 },
  { id: 'spirit', name: 'Surging Spirit', desc: 'Identity gauge fills 35% faster.', rarity: 1, max: 2, icon: 'status:identity_mode', mods: { identityGain: 0.35 } },
  { id: 'phoenix', name: 'Phoenix Feathers', desc: 'Heal 4% max HP on every kill.', rarity: 1, max: 3, icon: 'status:regen', fx: 'healOnKill', v: 0.04 },
  { id: 'greed', name: 'Cinder Greed', desc: 'More keys and chests; +30% silver from floors.', rarity: 1, max: 2, icon: 'status:buff_gold', fx: 'greed', v: 0.3 },
  { id: 'leech', name: 'Bloodthirst', desc: 'Heal for 2.5% of the damage you deal.', rarity: 2, max: 3, icon: 'status:bleed', fx: 'lifesteal', v: 0.025 },
  { id: 'chain', name: 'Chain Lightning', desc: 'Hits have an 18% chance to arc lightning to 3 nearby foes.', rarity: 2, max: 3, icon: 'status:shock', fx: 'chain', v: 0.18 },
  { id: 'aura', name: 'Molten Aura', desc: 'Scorch every enemy within 5 m each second.', rarity: 2, max: 3, icon: 'status:burn', fx: 'aura', v: 1.6 },
  { id: 'execute', name: 'Executioner', desc: '+35% damage to enemies below 30% HP.', rarity: 2, max: 2, icon: 'status:armor_break', fx: 'execute', v: 0.35 },
  { id: 'storm', name: 'Stormcaller', desc: 'Every 5 s lightning strikes the nearest enemy.', rarity: 2, max: 3, icon: 'status:shock', fx: 'storm', v: 5 },
  { id: 'thorns', name: 'Brimstone Thorns', desc: 'Reflect 40% of the damage enemies deal to you.', rarity: 2, max: 2, icon: 'status:def_up', fx: 'thorns', v: 0.4 },
  { id: 'awaken', name: 'Awakened Soul', desc: '+1 awakening use every floor; awakening damage +25%.', rarity: 2, max: 2, icon: 'status:identity_mode', mods: { awakenMul: 0.25 }, fx: 'awaken' },
  { id: 'wind', name: 'Second Wind', desc: 'Heal 30% more when a floor is cleared; +1 potion every 5 floors.', rarity: 2, max: 2, icon: 'status:regen', fx: 'wind', v: 0.3 },
  { id: 'glass', name: 'Glass Cannon', desc: '+35% damage, −20% max HP.', rarity: 3, max: 1, icon: 'status:atk_up', mods: { dmgMul: 0.35 }, hpMul: -0.2 },
  { id: 'second', name: 'Second Life', desc: 'Once: survive a lethal blow and rise again at 50% HP.', rarity: 3, max: 1, icon: 'status:invuln', fx: 'secondLife' },
  { id: 'meteor', name: 'Falling Star', desc: 'Dashing calls a meteor down where you land (once every 4 s).', rarity: 3, max: 1, icon: 'status:burn', fx: 'meteor' },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));
export const RARITY = { 1: { name: 'Common', grade: 2, weight: 10 }, 2: { name: 'Rare', grade: 3, weight: 5 }, 3: { name: 'Legendary', grade: 4, weight: 1.6 } };

/** Floor modifiers (one per floor from 11 with 50%, always from 31, two from 61). good = a blessing. */
export const MODIFIERS = {
  molten: { name: 'Molten Floor', desc: 'Lava erupts beneath your feet.', from: 11 },
  frenzied: { name: 'Frenzy', desc: 'Enemies move and attack 25% faster.', from: 11 },
  swarm: { name: 'Swarm', desc: 'Half again as many enemies, but frailer.', from: 11 },
  volatile: { name: 'Volatile', desc: 'Enemies burst into flame when they die.', from: 21 },
  haunted: { name: 'Haunted', desc: 'Cinder Wraiths join every wave.', from: 21 },
  bulwark: { name: 'Bulwark', desc: 'Champions are shielded.', from: 31 },
  blessed: { name: 'Ember Blessing', desc: 'The Inferno favours you: +25% damage this floor.', from: 11, good: true },
  ashfall: { name: 'Ashfall', desc: 'Ash blots out the sky; enemies hit 10% harder, chests are likelier.', from: 41 },
};

/** Visual themes per depth band (renderer grade tweaks + a name for the banner). */
export const THEMES = [
  { to: 20, name: 'The Ember Halls', grade: {} },
  { to: 40, name: 'The Ashen Deep', grade: { saturation: 0.82, gain: [0.95, 0.98, 1.06], vignette: 0.42 }, hemi: 0x8a90b0 },
  { to: 60, name: 'The Blood Forges', grade: { saturation: 1.12, gain: [1.12, 0.9, 0.88] }, hemi: 0xd06050 },
  { to: 80, name: 'The Abyssal Maw', grade: { saturation: 1.05, gain: [1.0, 0.86, 1.16], vignette: 0.46 }, hemi: 0x9a60d0 },
  { to: 100, name: 'The White Flame', grade: { exposure: 1.08, gain: [1.08, 1.05, 0.96], bloom: 0.7 }, hemi: 0xfff0d0 },
];
export const themeOf = f => THEMES.find(t => f <= t.to) || THEMES[THEMES.length - 1];

// ------------------------------------------------------------------------------------------------ Rift Cube
/** 10 rooms of escalating waves; a ticket per run (3 free per week, more from Inferno bosses and Chaos Gates). */
export const CUBE = {
  rooms: 10, ticket: 'rift_cube_ticket', weekly: 3, roomTime: 45, ilvl: 1415,
  // reward per room cleared (cumulative; the chest at the end pays everything you earned)
  reward: r => ({ silver: 4000 + r * 2500, shards: 300 + r * 220, leapstone: r >= 3 ? Math.floor(r / 2) : 0, guardian_stone: 60 * r, destruction_stone: r >= 5 ? 25 * r : 0, gold: r >= 7 ? 10 * (r - 6) : 0, ...(r >= 10 ? { card_pack: 1, gem_pouch: 1 } : {}) }),
  rooms_def: [
    { waves: [['imp', 8], ['hellhound', 2]] },
    { waves: [['skeleton', 8], ['imp', 4]] },
    { waves: [['hellhound', 6], ['legionnaire', 2]], elite: 'legionnaire' },
    { waves: [['spider', 6], ['abyss_caster', 3]] },
    { waves: [['gargoyle', 5], ['wraith', 3], ['imp', 4]], elite: 'crystal_golem' },
    { waves: [['legionnaire', 4], ['abyss_caster', 3], ['hellhound', 4]] },
    { waves: [['wraith', 5], ['skeleton', 6]], elite: 'direwolf' },
    { waves: [['crab', 4], ['gargoyle', 4], ['abyss_caster', 3]], elite: 'brute' },
    { waves: [['legionnaire', 5], ['hellhound', 5], ['wraith', 3]], elite: 'hellknight' },
    { boss: 'pit_lord', waves: [['imp', 6], ['legionnaire', 2]] },
  ],
};

// ------------------------------------------------------------------------------------------------ Trial Guardian
/** Weekly rotation: the guardian and two affixes are seeded by weekId (src/core/util.js). */
export const TRIAL = {
  guardians: ['rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'thunderhoof'],
  ilvl: 1415, partySize: 4, hpMul: 1.15,
  firstClear: { gold: 150, leapstone: 24, solar_blessing: 2, card_pack: 1, gem_pouch: 1 },
  repeat: { silver: 20000, shards: 1500 },
};
export const AFFIXES = {
  volcanic: { name: 'Volcanic', desc: 'The ground erupts under the party every few seconds, leaving lava behind.' },
  frenzied: { name: 'Frenzied', desc: 'The guardian attacks faster and grows stronger as it bleeds.' },
  mirror: { name: 'Mirror Guard', desc: 'The guardian raises a mirror stance — counter it, or it reflects damage for 4 s.' },
  storm: { name: 'Storm-Warded', desc: 'Lightning hunts whoever deals the most damage.' },
  haunted: { name: 'Haunted', desc: 'Cinder Wraiths rise at 75%, 50% and 25% health.' },
  glass: { name: 'Glass Guardian', desc: 'The guardian takes 40% more damage — and deals 60% more.' },
  bulwark: { name: 'Bulwark', desc: 'Every 35 s the guardian raises a shield worth 8% of its health.' },
};
