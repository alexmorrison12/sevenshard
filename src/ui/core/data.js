// Static tables the UI agrees on: grades, quality, classes, stats, slots, engravings, identity styles.
// Game data may override any of it (names/descriptions passed in data objects always win over these defaults).
import { pretty } from './util.js';

// ------------------------------------------------------------------------------------------------ grades (DESIGN §6)
// c: text/frame colour · a,b,d: slot gradient (dark corner → mid → lit corner) · glow: tooltip header glow
export const GRADES = [
  { id: 'common', name: 'Common', c: '#e8e8e8', a: '#23252b', b: '#3b3e46', d: '#6c707a' },
  { id: 'uncommon', name: 'Uncommon', c: '#8bd96b', a: '#132212', b: '#24411d', d: '#4f8a38' },
  { id: 'rare', name: 'Rare', c: '#4fa3ff', a: '#0c1a33', b: '#153465', d: '#2f6fc4' },
  { id: 'epic', name: 'Epic', c: '#b86bff', a: '#1c0f33', b: '#39205f', d: '#7440b8' },
  { id: 'legendary', name: 'Legendary', c: '#ffae3a', a: '#2c1a07', b: '#5e3a10', d: '#b8741e' },
  { id: 'relic', name: 'Relic', c: '#ff6a2a', a: '#2c0c06', b: '#5e1d0c', d: '#c2461b' },
  { id: 'ancient', name: 'Ancient', c: '#e9d2a6', a: '#2a2317', b: '#5c4c31', d: '#b8a079' },
  { id: 'primal', name: 'Primal', c: '#39e6d8', a: '#062624', b: '#0f4d49', d: '#1f9e94' },
];
export function grade(g) { return GRADES[Math.max(0, Math.min(7, g | 0))]; }

/** Gear quality 0–100 → bar colour (red → yellow → green → blue → purple → orange at 100). */
export function qualityColor(q) {
  if (q >= 100) return '#ffae3a';
  if (q >= 90) return '#c46bff';
  if (q >= 70) return '#4fa3ff';
  if (q >= 30) return '#8bd96b';
  if (q >= 10) return '#e8d34a';
  return '#e0564a';
}

// ------------------------------------------------------------------------------------------------ stats & slots
export const STATS = {
  atk: 'Attack Power', hp: 'Max HP', might: 'Might', vit: 'Vitality',
  crit: 'Crit', spec: 'Specialization', swift: 'Swiftness', dom: 'Domination', endur: 'Endurance', expert: 'Expertise',
  def: 'Defense',
};
export const COMBAT_STATS = ['crit', 'spec', 'swift', 'dom', 'endur', 'expert'];
export const STAT_DESC = {
  crit: 'Raises critical hit rate.',
  spec: 'Strengthens identity skills and awakening damage (supports: healing and shields).',
  swift: 'Raises attack speed, movement speed and cooldown recovery.',
  dom: 'Raises damage against staggered, knocked-down and stunned foes.',
  endur: 'Raises defense and shield / healing received.',
  expert: 'Raises status effect duration and reduces stagger taken.',
  atk: 'Base damage of every skill. Comes from Might and your weapon.',
  hp: 'Maximum health. Comes from Vitality.',
};
export const SLOTS = {
  weapon: 'Weapon', head: 'Head', shoulder: 'Shoulders', chest: 'Chest', pants: 'Pants', gloves: 'Gloves',
  necklace: 'Necklace', earring: 'Earring', ring: 'Ring', stone: 'Ability Stone', bracelet: 'Bracelet',
  earring1: 'Earring', earring2: 'Earring', ring1: 'Ring', ring2: 'Ring',
};
export const KINDS = {
  weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory', stone: 'Ability Stone', bracelet: 'Bracelet', gem: 'Gem',
  card: 'Card', material: 'Material', consumable: 'Consumable', battle: 'Battle Item', book: 'Engraving Recipe',
  mount: 'Mount', pet: 'Pet', cosmetic: 'Cosmetic', currency: 'Currency', gift: 'Rapport Gift', food: 'Cooking',
  quest: 'Quest Item', collectible: 'Collectible',
};
export const BOUND = { char: 'Bound to Character', roster: 'Bound to Roster', account: 'Bound to Roster' };

// ------------------------------------------------------------------------------------------------ engravings (DESIGN §6)
export const ENGRAVINGS = {
  vendetta: { name: 'Vendetta', desc: 'Damage rises as your HP falls.' },
  hexed_idol: { name: 'Hexed Idol', desc: 'More damage to foes suffering from your status effects.' },
  keen_edge: { name: 'Keen Edge', desc: 'Critical damage +, crit rate slightly reduced.' },
  adrenaline: { name: 'Adrenaline', desc: 'Casting skills stacks attack power, then crit rate at max stacks.' },
  backstabber: { name: 'Backstabber', desc: 'Back attacks deal more damage and crit more often.' },
  frontliner: { name: 'Frontliner', desc: 'Head attacks deal more damage.' },
  wind_captain: { name: 'Wind Captain', desc: 'Move and attack speed up, doubled under moving buffs.' },
  spirit_absorption: { name: 'Spirit Absorption', desc: 'Attack and movement speed up.' },
  precise_blade: { name: 'Precise Blade', desc: 'Critical hits restore mana and cut cooldowns.' },
  super_charge: { name: 'Super Charge', desc: 'Charge skills charge faster and hit harder.' },
  barricade: { name: 'Barricade', desc: 'More damage while shielded.' },
  expert: { name: 'Expert', desc: 'Healing and shields you give are stronger.' },
  awakening: { name: 'Awakening', desc: 'Awakening cooldown reduced, extra uses.' },
  master_brawler: { name: 'Master Brawler', desc: 'Frontal attacks deal more damage.' },
  ether_predator: { name: 'Ether Predator', desc: 'Enemies drop ether that raises attack power and defense.' },
  crisis_evasion: { name: 'Crisis Evasion', desc: 'Survive a lethal hit once, briefly invulnerable.' },
  stabilized_status: { name: 'Stabilized Status', desc: 'More damage while HP is above 80%.' },
  all_out_attack: { name: 'All-Out Attack', desc: 'Holding and casting skills hit harder and faster.' },
  mana_flow: { name: 'Mana Flow', desc: 'Mana regeneration up.' },
  heavy_armor: { name: 'Heavy Armor', desc: 'Defense up.' },
  sight_focus: { name: 'Sight Focus', desc: 'Stagger damage up.' },
  drops_of_ether: { name: 'Drops of Ether', desc: 'Periodically spawns ether orbs with random boons.' },
  propulsion: { name: 'Propulsion', desc: 'After a dash, damage up briefly.' },
  increase_mass: { name: 'Increase Mass', desc: 'Attack power up, attack speed down.' },
  cursed_doll: { name: 'Cursed Doll', desc: 'Attack power up, healing received down.' },
  grudge: { name: 'Grudge', desc: 'More damage to bosses, more damage taken.' },
  // negatives (the game uses neg_* ids; *_reduction kept as aliases)
  neg_atk: { name: 'Atk. Power Reduction', neg: true, desc: 'Attack power down.' },
  neg_speed: { name: 'Atk. Speed Reduction', neg: true, desc: 'Attack speed down.' },
  neg_def: { name: 'Defense Reduction', neg: true, desc: 'Defense down.' },
  neg_move: { name: 'Move Speed Reduction', neg: true, desc: 'Movement speed down.' },
  atk_reduction: { name: 'Atk. Power Reduction', neg: true, desc: 'Attack power down.' },
  atk_speed_reduction: { name: 'Atk. Speed Reduction', neg: true, desc: 'Attack speed down.' },
  def_reduction: { name: 'Defense Reduction', neg: true, desc: 'Defense down.' },
  move_speed_reduction: { name: 'Move Speed Reduction', neg: true, desc: 'Movement speed down.' },
  // class engravings (DESIGN §4)
  bloodfrenzy: { name: 'Bloodfrenzy', cls: 'reaver', desc: 'Max HP lowered, huge damage, less healing.' },
  tempered_fury: { name: 'Tempered Fury', cls: 'reaver', desc: 'Burst Mode crit damage up.' },
  blessed_aura: { name: 'Blessed Aura', cls: 'oathkeeper', desc: 'Aegis of Dawn also heals and shields the party.' },
  judgment: { name: 'Judgment', cls: 'oathkeeper', desc: 'Sacred Punishment fills faster, more damage.' },
  storm_conduit: { name: 'Storm Conduit', cls: 'stormfist', desc: 'Chi skills call lightning.' },
  chi_master: { name: 'Chi Master', cls: 'stormfist', desc: 'Chi orbs refill faster.' },
  quickdraw: { name: 'Quickdraw', cls: 'pistoleer', desc: 'Stance swaps grant bonus damage.' },
  longshot: { name: 'Longshot', cls: 'pistoleer', desc: 'Rifle stance only; rifle damage greatly up.' },
  ignition: { name: 'Ignition', cls: 'starcaller', desc: 'Crits during Overload reset cooldowns.' },
  wellspring: { name: 'Wellspring', cls: 'starcaller', desc: 'Arcane Surge builds faster.' },
  last_refrain: { name: 'Last Refrain', cls: 'songweaver', desc: 'Damage focus: notes explode.' },
  heart_of_courage: { name: 'Heart of Courage', cls: 'songweaver', desc: 'Anthem of Courage empowers allies more.' },
  afterglow: { name: 'Afterglow', cls: 'bladedancer', desc: 'Surge strikes leave lingering blades.' },
  stormsurge: { name: 'Stormsurge', cls: 'bladedancer', desc: 'Surge orbs charge faster.' },
  unleashed: { name: 'Unleashed', cls: 'demonbound', desc: 'Demonform lasts longer and hits harder.' },
  restraint: { name: 'Restraint', cls: 'demonbound', desc: 'Never transform; normal skills deal much more damage.' },
};
export function engr(id) {
  if (id && typeof id === 'object') return { name: id.name || engr(id.id).name, neg: id.neg ?? engr(id.id).neg, desc: id.desc || engr(id.id).desc };
  return ENGRAVINGS[id] || { name: pretty(id), desc: '' };
}
/** Engraving id → icon id (the icon set names negatives neg_*). */
export function engrIcon(id) { return 'engr:' + ({ atk_reduction: 'neg_atk', atk_speed_reduction: 'neg_speed', def_reduction: 'neg_def', move_speed_reduction: 'neg_move' }[id] || id); }
/** 0–15+ nodes → level 0–3 (5 / 10 / 15). */
export const engrLevel = nodes => Math.min(3, Math.floor((nodes || 0) / 5));

// ------------------------------------------------------------------------------------------------ classes (DESIGN §4)
// tags: c = counter ★, s = very high stagger ◆, b = back attack ↺, hd = head attack ↑
const S = (name, type = 'Normal', tags = '') => ({ name, type, tags });
export const CLASSES = {
  reaver: {
    name: 'Reaver', archetype: 'Warrior', weapon: 'Greatsword', role: 'DPS', difficulty: 2, color: '#e0443a', color2: '#ff9a6a',
    identity: { kind: 'gauge', name: 'Bloodlust', z: 'Burst Mode', x: 'Crimson Finale', desc: 'Deal damage to fill Bloodlust. Z unleashes Burst Mode for 25 s: faster attacks, faster steps, sharper crits and a crimson glow. Press Z again to end it with Crimson Finale.' },
    awakening: 'Worldsplitter',
    blurb: 'A towering warrior who swings a greatsword taller than most men. Every swing feeds the blood-rage, and when it boils over the Reaver becomes a red storm.',
    skills: [S('Whirlwind Edge', 'Holding'), S('Tempest Slash', 'Combo'), S('Diving Slash', 'Point', 'hd'), S('Sword Storm'), S('Mountain Cleave', 'Normal', 'c hd'), S('Hell Blade', 'Charge', 's'), S('Red Dust'), S('Chain Sword'), S('Strike Wave'), S('Shoulder Charge'), S('Finish Strike', 'Charge', 'b'), S('Wind Blade')],
    engravings: ['bloodfrenzy', 'tempered_fury'],
  },
  oathkeeper: {
    name: 'Oathkeeper', archetype: 'Warrior', weapon: 'Longsword & Holy Tome', role: 'Support', difficulty: 3, color: '#f0cf6a', color2: '#fff4c8',
    identity: { kind: 'gauge', name: 'Sanctity', z: 'Aegis of Dawn', x: 'Sacred Punishment', desc: 'Sanctity fills as you fight beside allies. Z raises the Aegis of Dawn: the party takes 20% less damage and is healed. X calls down Sacred Punishment.' },
    awakening: 'Radiant Judgment',
    blurb: 'A sworn knight of the Dawn whose blade guards and whose tome mends. Oathkeepers brand foes for the party and wrap allies in holy light.',
    skills: [S('Holy Bulwark'), S('Heavenly Blessing'), S('Light Shock'), S('Sword of Justice', 'Combo'), S('Godsent Law', 'Casting', 's'), S('Holy Explosion'), S('Flash Slash'), S('Execution of Justice', 'Holding'), S('Wrath of Heaven', 'Point'), S('Charging Blade'), S('Sacred Chain', 'Normal', 'c'), S('Rite of Mending')],
    engravings: ['blessed_aura', 'judgment'],
  },
  stormfist: {
    name: 'Stormfist', archetype: 'Fighter', weapon: 'Gauntlets', role: 'DPS', difficulty: 3, color: '#46b8ff', color2: '#b8ecff',
    identity: { kind: 'orbs', name: 'Chi', z: 'Dragon Ascent', x: 'Thunder Tiger', desc: 'Strikes charge up to three Chi orbs. Z spends one on Dragon Ascent; X spends two on Thunder Tiger.' },
    awakening: "Heaven's Fury",
    blurb: 'A martial artist who channels the storm through fist and heel. Chains of lightning kicks build Chi for devastating finishers.',
    skills: [S('Lightning Kick'), S('Blazing Fist', 'Combo'), S('Tempest Barrage', 'Holding'), S('Sweeping Kick'), S('Storm Dragon Upper'), S('Swiftwind Dash', 'Chain'), S('Ground Quake', 'Normal', 's'), S('Thunder Palm', 'Charge', 'c'), S('Moonflash Kick', 'Normal', 'hd'), S('Heavenly Strike', 'Point'), S('Lightning Whisper', 'Normal', 'b'), S('Soaring Tiger')],
    engravings: ['storm_conduit', 'chi_master'],
  },
  pistoleer: {
    name: 'Pistoleer', archetype: 'Gunner', weapon: 'Pistols · Shotgun · Rifle', role: 'DPS', difficulty: 5, color: '#ff9a3a', color2: '#ffd9a0',
    identity: { kind: 'stance', name: 'Stances', z: 'Swap Stance', x: 'Deadeye Focus', desc: 'Every skill belongs to a weapon: casting it swaps to that weapon instantly with a Quickdraw bonus. Z cycles stances; X fires Deadeye Focus when the gauge is full.' },
    awakening: 'Last Rites',
    blurb: 'A duelist who juggles three weapons mid-fight. Master the swap rhythm and the Pistoleer never stops firing.',
    skills: [S('Quick Shot'), S('Spiral Tracker'), S('Equilibrium', 'Holding'), S('Dexterous Shot', 'Combo'), S('Dual Buckshot', 'Combo', 'b'), S('Shotgun Rapid Fire', 'Holding'), S('Last Request', 'Normal', 'c'), S('Dragon Shot'), S('Focused Shot', 'Casting'), S('Perfect Shot', 'Charge', 's'), S('Target Down', 'Point'), S('Catastrophe', 'Point')],
    engravings: ['quickdraw', 'longshot'],
  },
  starcaller: {
    name: 'Starcaller', archetype: 'Mystic', weapon: 'Star-orb Staff', role: 'DPS', difficulty: 3, color: '#a77bff', color2: '#e3d4ff',
    identity: { kind: 'gauge', name: 'Arcane Surge', z: 'Overload', desc: 'Spells fill Arcane Surge. Z triggers Overload for 6 s: every cast is instant and cooldowns tick three times as fast.' },
    awakening: 'Stellar Collapse',
    blurb: 'A scholar of the night sky who calls meteors, lightning and frost. Few classes can match a Starcaller mid-Overload.',
    skills: [S('Doomfall', 'Point'), S('Blaze Nova'), S('Frost Lance'), S('Starfire Explosion', 'Point'), S('Punishing Bolt', 'Casting', 's'), S('Seraphic Hail', 'Point'), S('Esoteric Rune', 'Point'), S('Lightning Vortex', 'Holding'), S('Inferno Wave', 'Charge'), S('Blink'), S('Void Rift', 'Point'), S('Frost Nova', 'Normal', 'c')],
    engravings: ['ignition', 'wellspring'],
  },
  songweaver: {
    name: 'Songweaver', archetype: 'Mystic', weapon: 'Harp', role: 'Support', difficulty: 3, color: '#5fe0c8', color2: '#ffc8ec',
    identity: { kind: 'bubbles', name: 'Serenade', z: 'Anthem of Courage', x: 'Hymn of Mending', desc: 'Music fills up to three Serenade bubbles. Z plays the Anthem of Courage for party attack power; X plays the Hymn of Mending, a healing zone.' },
    awakening: 'Grand Finale',
    blurb: 'A bard whose harp shields friends and shatters foes. The Songweaver keeps a raid alive and makes it hit harder.',
    skills: [S('Sound Shock'), S('Harp of Rhythm'), S('Stigma'), S('Guardian Tune'), S('Heavenly Tune'), S('Rhapsody of Light', 'Casting'), S('Wind of Music'), S('Sonic Vibration', 'Point', 's'), S('Prelude of Storm', 'Holding'), S('Rhythm Buckshot', 'Combo'), S('Soundholic', 'Point'), S('Tempest Chord', 'Charge', 'c')],
    engravings: ['last_refrain', 'heart_of_courage'],
  },
  bladedancer: {
    name: 'Bladedancer', archetype: 'Shade', weapon: 'Twin Blades & Greatblade', role: 'DPS', difficulty: 4, color: '#c77dff', color2: '#f2dcff',
    identity: { kind: 'orbs', name: 'Surge', z: 'Surge', desc: 'Hits charge up to three Surge orbs. Z dashes through the target with Surge; the more orbs, the harder it lands.' },
    awakening: 'Thousand Cuts',
    blurb: 'A shadow that fights up close, flickering behind foes. Bladedancers build orbs for one blinding, orb-fuelled strike.',
    skills: [S('Blitz Rush', 'Charge', 'b'), S('Spincutter'), S('Maelstrom'), S('Void Strike', 'Normal', 's'), S('Death Trance'), S('Moonlight Sonic'), S('Soul Absorber', 'Normal', 'b'), S('Wind Cut', 'Chain'), S('Dark Order'), S('Upper Slash', 'Normal', 'c'), S('Blade Dance', 'Holding'), S('Shadow Step', 'Normal', 'b')],
    engravings: ['afterglow', 'stormsurge'],
  },
  demonbound: {
    name: 'Demonbound', archetype: 'Shade', weapon: 'Demonic Glaive', role: 'DPS', difficulty: 3, color: '#e0305a', color2: '#b066ff',
    identity: { kind: 'demon', name: 'Demon Gauge', z: 'Demonform', desc: 'Violence fills the Demon gauge. Z transforms you for 20 s: horns, wings and claws, and the skill bar swaps to four demon skills.' },
    awakening: 'Abyssal Rupture',
    blurb: 'A warrior who made a pact with the thing inside. When the gauge is full, the demon comes out to play.',
    skills: [S('Demonic Slash'), S('Ruining Rush'), S('Cruel Cutter'), S('Blood Massacre'), S('Grind Chain'), S('Thrust of Destruction', 'Normal', 'hd'), S('Demolition', 'Normal', 's'), S('Soul Chain', 'Holding'), S('Blood Pillars', 'Point'), S('Howl', 'Normal', 'c'), S('Leaping Blow', 'Point'), S('Demon Vision')],
    engravings: ['unleashed', 'restraint'],
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export function cls(id) { return CLASSES[id] || { name: pretty(id || 'Adventurer'), color: '#9fb0d0', color2: '#dfe6f5', role: 'DPS', identity: { kind: 'gauge', name: 'Identity' }, skills: [] }; }

export const SKILL_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
export const ITEM_KEYS = ['1', '2', '3', '4'];

export const STAGGER = { low: 'Low', mid: 'Mid', midhigh: 'Mid-High', high: 'High', veryhigh: 'Very High', 'very high': 'Very High' };
export const SKILL_TYPES = {
  Normal: 'Normal Skill', Combo: 'Combo Skill', Chain: 'Chain Skill', Holding: 'Holding Skill', Charge: 'Charge Skill',
  Casting: 'Casting Skill', Point: 'Point Skill', Toggle: 'Toggle Skill', Awakening: 'Awakening Skill',
};

// Appearance palettes for the create screen (the hero model owns the real look; these are swatch colours).
export const LOOK = {
  hairColors: ['#1c1714', '#3b2619', '#6a4126', '#9a6334', '#c89a5a', '#e8d2a0', '#f2efe8', '#8c8f99', '#9e2a22', '#c2562a', '#3a4f8a', '#6b3f8f'],
  skins: ['#f6dcc6', '#ecc4a4', '#dcaa84', '#c68f68', '#a8704c', '#8a5638', '#643c26', '#d9c2b8'],
  eyes: ['#4a7ec2', '#3f8f6a', '#7a5a34', '#2c2420', '#8c9aa8', '#b8862e', '#a03a3a', '#8e5ad2', '#39c2c8', '#d8c24a'],
  markColors: ['#1c1c24', '#6a1a1a', '#1a3c6a', '#c9a45a', '#e8e8f0', '#4a1a6a'],
  faces: ['Resolute', 'Gentle', 'Fierce', 'Noble', 'Weathered', 'Youthful'],
  hairs: ['Cropped', 'Swept', 'Long Loose', 'Braided', 'Topknot', 'Mohawk', 'Twin Tails', 'Wild Mane'],
  marks: ['None', 'War Paint', 'Scar', 'Runes'],
};

// ------------------------------------------------------------------------------------------------ helpers
/** 'Heaven's Fury' → 'heavens_fury' (icon ids use these keys). */
export const slug = s => String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
/** Canonical skill icon id for a class skill name: skill:<cls>:<slug>. */
export const skillIconId = (clsId, name) => `skill:${clsId}:${slug(name)}`;

const NA = ['Ash', 'Bran', 'Cael', 'Dra', 'El', 'Fen', 'Gar', 'Hal', 'Is', 'Ka', 'Lor', 'Mor', 'Nyx', 'Or', 'Ren', 'Sar', 'Tha', 'Vel', 'Wyn', 'Zer', 'Ae', 'Bel', 'Cor', 'Syl', 'Tor', 'Vex', 'Rhae', 'Kes', 'Mir', 'Lys', 'Ser', 'Dav', 'Quil', 'Ul', 'Yor'];
const NM = ['ric', 'dor', 'mund', 'thas', 'orn', 'ius', 'ald', 'gar', 'wick', 'mar', 'ion', 'eth', 'hald', 'rin', 'os', 'var', 'den', 'kan'];
const NF = ['wen', 'ra', 'ys', 'ith', 'ara', 'ika', 'ette', 'lin', 'ia', 'elle', 'wyn', 'a', 'ine', 'isa', 'eth', 'ora', 'yn'];
/** Fantasy name, 4–12 letters. sex: 'm' | 'f' | undefined */
export function randomName(sex, rnd = Math.random) {
  for (let k = 0; k < 20; k++) {
    const a = NA[Math.floor(rnd() * NA.length)];
    const pool = sex === 'f' ? NF : sex === 'm' ? NM : rnd() < 0.5 ? NF : NM;
    let n = a + pool[Math.floor(rnd() * pool.length)];
    if (rnd() < 0.25) n = a + (sex === 'f' ? 'e' : 'o') + pool[Math.floor(rnd() * pool.length)];
    n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    if (n.length >= 4 && n.length <= 12 && !/(.)\1\1/.test(n)) return n;
  }
  return 'Shardbearer';
}
/** null when valid, else a short reason. Letters only, 2–16, one word. */
export function validateName(n, taken = []) {
  n = String(n || '').trim();
  if (n.length < 2) return 'At least 2 letters';
  if (n.length > 16) return 'At most 16 letters';
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+$/.test(n)) return 'Letters only, no spaces';
  if (taken.some(t => String(t).toLowerCase() === n.toLowerCase())) return 'That name is taken';
  return null;
}
