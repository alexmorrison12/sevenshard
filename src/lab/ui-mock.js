// Rich mock data for the UI lab: an animated HudState, items, characters, skills, windows. Also a handy
// reference for the lead: every shape here is exactly what the UI consumes.
import { CLASSES } from '../ui/core/data.js';
import { SKILL_KEYS } from '../ui/icons/index.js';
const skillIcon = (cls, i) => `skill:${cls}:${(SKILL_KEYS[cls] || SKILL_KEYS.reaver)[i]}`;

const R = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------------------------------------ skills
const TRIPODS = [
  [{ id: 'quick_prep', name: 'Quick Prep', desc: 'Cooldown −4 s.' }, { id: 'excellent_mobility', name: 'Excellent Mobility', desc: 'Move speed +12% while casting.' }, { id: 'weak_point', name: 'Weak Point Detection', desc: 'Weak point +1.' }],
  [{ id: 'blazing', name: 'Blazing Edge', desc: 'Converts to Fire. Burns for 6 s.' }, { id: 'extra_hit', name: 'Extra Slash', desc: 'Adds a final slash dealing 120% damage.' }],
  [{ id: 'crimson', name: 'Crimson Tempest', desc: 'The last hit leaves a crimson zone that pulses 5 times.' }, { id: 'earthsplit', name: 'Earth Splitter', desc: 'Final hit shatters the ground: +60% damage, very high stagger.' }],
];
function tripods(level, pick = [0, 1, 0]) {
  return TRIPODS.map((tier, i) => tier.map((t, j) => ({ ...t, icon: 'tripod:' + ({ quick_prep: 'quick_prep', excellent_mobility: 'mobility', weak_point: 'weak_point', blazing: 'burn', extra_hit: 'extra_hit', crimson: 'zone', earthsplit: 'element' }[t.id] || 'enhanced'), unlock: [4, 7, 10][i], picked: level >= [4, 7, 10][i] && j === pick[i] })));
}
export function mockSkills(clsId = 'reaver') {
  const c = CLASSES[clsId] || CLASSES.reaver;
  const keys = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
  const cds = [6, 9, 12, 16, 24, 30, 20, 14];
  return c.skills.slice(0, 8).map((s, i) => ({
    id: clsId + '_' + i, name: s.name, icon: skillIcon(clsId, i), type: s.type, key: keys[i],
    cd: cds[i], cdLeft: 0, mana: [40, 60, 80, 120, 150, 220, 90, 70][i], level: [10, 10, 7, 10, 4, 12, 10, 7][i], maxLevel: 12,
    desc: `${s.name}: a ${s.type.toLowerCase()} skill. ${['Sweeps the area in front of you.', 'Unleashes a flurry of strikes.', 'Leaps to the target area and slams down.', 'Hurls a crescent of force forward.'][i % 4]} Deals ${[412, 780, 1260, 2310, 3980, 5120, 1840, 960][i].toLocaleString()} damage.`,
    stagger: ['Mid', 'Mid-High', 'High', 'Low', 'Very High', 'High', 'Mid', 'Low'][i],
    weakPoint: [1, 0, 2, 0, 1, 3, 0, 0][i], counter: s.tags.includes('c'), attack: s.tags.includes('b') ? 'Back' : s.tags.includes('hd') ? 'Head' : null,
    superArmor: i % 3 === 0 ? 'Push Immunity' : i === 5 ? 'Paralysis Immunity' : null,
    tripods: tripods([10, 10, 7, 10, 4, 12, 10, 7][i]),
  }));
}
export function mockAllSkills(clsId = 'reaver') {
  const c = CLASSES[clsId] || CLASSES.reaver;
  const bar = mockSkills(clsId);
  return c.skills.map((s, i) => i < 8 ? { ...bar[i], learned: true } : {
    id: clsId + '_' + i, name: s.name, icon: skillIcon(clsId, i), type: s.type, cd: 10 + i, mana: 50 + i * 7, level: i === 11 ? 0 : 1, maxLevel: 12,
    desc: `${s.name}.`, stagger: 'Low', weakPoint: 0, counter: s.tags.includes('c'), attack: null, tripods: tripods(1), learned: i !== 11, lvlReq: 40 + i,
  });
}

// ------------------------------------------------------------------------------------------------ items
let UID = 1;
export function item(o) { return { uid: 'u' + (UID++), count: 1, ...o }; }
export const GEAR = {
  weapon: item({ id: 'ht_weapon', name: 'Horned Tyrant Greatsword', kind: 'weapon', slot: 'weapon', grade: 5, icon: 'item:weapon:reaver:t2', iLvl: 1415, hone: 17, quality: 96, tier: 3, stats: { atk: 48210 }, set: { name: 'Horned Tyrant', have: 6, pieces: 6, bonuses: [{ n: 2, text: 'Damage +8% to Legion commanders.' }, { n: 4, text: 'Crit damage +12% after a counter.' }, { n: 6, text: 'Awakening skills deal +20% damage.' }] }, bound: 'roster', value: 12400, desc: 'A blade forged from the Tyrant\'s broken horn. It still smoulders.' }),
  head: item({ id: 'ht_head', name: 'Horned Tyrant Helm', kind: 'armor', slot: 'head', grade: 5, icon: 'item:head:t2', iLvl: 1405, hone: 16, quality: 84, tier: 3, stats: { might: 41320, vit: 3110 }, set: { name: 'Horned Tyrant', have: 6 }, bound: 'roster' }),
  shoulder: item({ id: 'ht_shoulder', name: 'Horned Tyrant Pauldrons', kind: 'armor', slot: 'shoulder', grade: 5, icon: 'item:shoulder:t2', iLvl: 1415, hone: 17, quality: 71, tier: 3, stats: { might: 44350, vit: 3380 }, bound: 'roster' }),
  chest: item({ id: 'ht_chest', name: 'Horned Tyrant Cuirass', kind: 'armor', slot: 'chest', grade: 5, icon: 'item:chest:t2', iLvl: 1415, hone: 17, quality: 100, tier: 3, stats: { might: 44350, vit: 3380 }, bound: 'roster' }),
  pants: item({ id: 'ht_pants', name: 'Horned Tyrant Greaves', kind: 'armor', slot: 'pants', grade: 5, icon: 'item:pants:t2', iLvl: 1395, hone: 15, quality: 58, tier: 3, stats: { might: 39800, vit: 2990 }, bound: 'roster' }),
  gloves: item({ id: 'ht_gloves', name: 'Horned Tyrant Gauntlets', kind: 'armor', slot: 'gloves', grade: 5, icon: 'item:gloves:t2', iLvl: 1405, hone: 16, quality: 92, tier: 3, stats: { might: 41320, vit: 3110 }, bound: 'roster' }),
  necklace: item({ id: 'neck1', name: 'Necklace of Burning Resolve', kind: 'accessory', slot: 'necklace', grade: 5, icon: 'item:necklace', iLvl: 1340, quality: 88, stats: { might: 12400, crit: 498, swift: 489 }, engr: [{ id: 'grudge', v: 5 }, { id: 'keen_edge', v: 3 }], neg: { id: 'atk_speed_reduction', v: 2 }, bound: 'roster', trades: 2 }),
  earring1: item({ id: 'ear1', name: 'Earring of the Wounded Moon', kind: 'accessory', slot: 'earring', grade: 5, icon: 'item:earring', iLvl: 1340, quality: 74, stats: { might: 9600, crit: 298 }, engr: [{ id: 'adrenaline', v: 5 }, { id: 'bloodfrenzy', v: 3 }], neg: { id: 'def_reduction', v: 1 } }),
  earring2: item({ id: 'ear2', name: 'Earring of Ashen Tides', kind: 'accessory', slot: 'earring', grade: 4, icon: 'item:earring', iLvl: 1325, quality: 66, stats: { might: 9100, crit: 280 }, engr: [{ id: 'cursed_doll', v: 4 }, { id: 'keen_edge', v: 3 }], neg: { id: 'move_speed_reduction', v: 2 } }),
  ring1: item({ id: 'ring1', name: 'Ring of Seven Lights', kind: 'accessory', slot: 'ring', grade: 5, icon: 'item:ring', iLvl: 1340, quality: 95, stats: { might: 7200, crit: 199 }, engr: [{ id: 'grudge', v: 5 }, { id: 'adrenaline', v: 3 }], neg: { id: 'atk_reduction', v: 1 } }),
  ring2: item({ id: 'ring2', name: 'Ring of the Glass Sea', kind: 'accessory', slot: 'ring', grade: 4, icon: 'item:ring', iLvl: 1325, quality: 45, stats: { might: 6700, crit: 186 }, engr: [{ id: 'cursed_doll', v: 3 }, { id: 'bloodfrenzy', v: 4 }], neg: { id: 'def_reduction', v: 2 } }),
  stone: item({ id: 'stone1', name: 'Ability Stone of Radiance', kind: 'stone', slot: 'stone', grade: 5, icon: 'item:stone', iLvl: 1340, stats: { hp: 22400 }, engr: [{ id: 'grudge', v: 7 }, { id: 'keen_edge', v: 6 }], neg: { id: 'atk_reduction', v: 3 }, facets: [[1, 1, 0, 1, 1, 1, 1, 0, 1, 1], [1, 0, 1, 1, 0, 1, 1, 1, 0, 1], [0, 1, 0, 0, 1, 0, 1, 0, 0, 0]], bound: 'char', desc: 'A faceted stone that remembers every strike.' }),
  bracelet: item({ id: 'brace1', name: 'Bracelet of Reckoning', kind: 'bracelet', slot: 'bracelet', grade: 5, icon: 'item:bracelet', iLvl: 1340, stats: { crit: 108, swift: 96 }, effects: ['Precision: crit rate +4%.', 'Wrath: damage +3% against staggered foes.', 'Might +3,200'], bound: 'roster' }),
};
export function inventory() {
  const L = [];
  const add = o => L.push(item(o));
  add({ id: 'dstone', name: 'Destruction Stone Crystal', kind: 'material', grade: 3, icon: 'item:destruction_stone', count: 4812, desc: 'Honing material for weapons (Tier 3).', value: 4 });
  add({ id: 'gstone', name: 'Guardian Stone Crystal', kind: 'material', grade: 3, icon: 'item:guardian_stone', count: 12650, desc: 'Honing material for armor (Tier 3).', value: 1 });
  add({ id: 'leap', name: 'Great Honor Leapstone', kind: 'material', grade: 4, icon: 'item:leapstone', count: 318, desc: 'Needed for every honing attempt at Tier 3.', value: 30 });
  add({ id: 'fusion', name: 'Superior Oreha Fusion', kind: 'material', grade: 5, icon: 'item:fusion', count: 96, value: 12 });
  add({ id: 'shards', name: 'Honor Shard Pouch (L)', kind: 'consumable', grade: 3, icon: 'item:shards', count: 22, use: 'Gain 1,500 Honor Shards.' });
  add({ id: 'solar_grace', name: "Solar Grace", kind: 'material', grade: 2, icon: 'item:solar_grace', count: 41, desc: 'Raises honing success by 0.83% per piece.' });
  add({ id: 'solar_blessing', name: "Solar Blessing", kind: 'material', grade: 3, icon: 'item:solar_blessing', count: 17, desc: 'Raises honing success by 1.67% per piece.' });
  add({ id: 'solar_prot', name: "Solar Protection", kind: 'material', grade: 4, icon: 'item:solar_protection', count: 5, desc: 'Raises honing success by 5% per piece.' });
  add({ id: 'hp_pot', name: 'Major HP Potion', kind: 'battle', grade: 2, icon: 'item:hp_potion', count: 18, use: 'Restore 30% HP.', cd: 30 });
  add({ id: 'dbomb', name: 'Destruction Bomb', kind: 'battle', grade: 2, icon: 'item:destruction_bomb', count: 7, use: 'Deals heavy destruction to boss parts.', cd: 30 });
  add({ id: 'flame', name: 'Flame Grenade', kind: 'battle', grade: 2, icon: 'item:flame_grenade', count: 12, use: 'Burns enemies in an area.', cd: 30 });
  add({ id: 'feather', name: 'Resurrection Feather', kind: 'consumable', grade: 3, icon: 'item:feather', count: 2, use: 'Revive where you fell.' });
  add({ id: 'gem7', name: 'Lv 7 Ruinstone', kind: 'gem', grade: 4, icon: 'item:gem:ruin:7', gem: { skill: 'Hell Blade', effect: 'Damage +21%' }, desc: 'Socket into a gem slot.' });
  add({ id: 'gem5', name: 'Lv 5 Swiftstone', kind: 'gem', grade: 3, icon: 'item:gem:swift:5', gem: { skill: 'Wind Blade', effect: 'Cooldown −10%' } });
  add({ id: 'book_grudge', name: 'Engraving Recipe: Grudge', kind: 'book', grade: 5, icon: 'item:book:grudge', count: 3, desc: 'Learn 5 nodes of Grudge.' });
  add({ id: 'card_brannoc', name: 'Card: Brannoc Hale', kind: 'card', grade: 4, icon: 'item:card_pack', awaken: 3, desc: 'Part of the "Oath of Brighthold" set.' });
  add({ id: 'seed', name: 'Pip Seed', kind: 'collectible', grade: 6, icon: 'item:pip_seed', desc: 'Squeaks when shaken. Bramblebeard will want this.' });
  add({ id: 'chest_l', name: 'Legion Reward Chest', kind: 'consumable', grade: 4, icon: 'item:chest', count: 2, use: 'Open for Tyrant materials.' });
  add({ id: 'food', name: 'Glass Sea Chowder', kind: 'food', grade: 1, icon: 'item:food:2', count: 5, use: 'Max HP +5% for 30 min.' });
  add({ id: 'gift', name: 'Songbird Music Box', kind: 'gift', grade: 3, icon: 'item:gift:1', desc: 'A rapport gift. Seraphine adores these.' });
  add({ ...GEAR.earring2, uid: undefined, iLvl: 1310, quality: 22, grade: 4, name: 'Earring of Quiet Rain', engr: [{ id: 'spirit_absorption', v: 3 }, { id: 'expert', v: 3 }] });
  add({ id: 'relic_ring', name: 'Ring of the Deep Oracle', kind: 'accessory', slot: 'ring', grade: 6, icon: 'item:ring', iLvl: 1540, quality: 100, stats: { might: 9800, crit: 520 }, engr: [{ id: 'grudge', v: 6 }, { id: 'keen_edge', v: 5 }], neg: { id: 'atk_reduction', v: 1 }, desc: 'Ancient. Still humming with the Oracle\'s song.' });
  add({ id: 'primal_neck', name: 'Primal Choker of Solmara', kind: 'accessory', slot: 'necklace', grade: 7, icon: 'item:necklace', iLvl: 1600, quality: 100, stats: { might: 15400, crit: 612, swift: 580 }, engr: [{ id: 'adrenaline', v: 6 }, { id: 'grudge', v: 6 }] });
  add({ id: 'uncommon_sword', name: 'Worn Recruit Blade', kind: 'weapon', slot: 'weapon', grade: 1, icon: 'item:weapon:reaver:t0', iLvl: 302, quality: 40, stats: { atk: 1210 }, value: 84 });
  add({ id: 'common_cloth', name: 'Tattered Cloth', kind: 'material', grade: 0, icon: 'item:herb', count: 64, value: 1 });
  add({ id: 'mount', name: 'Sunstag Whistle', kind: 'mount', grade: 5, icon: 'item:mount_whistle', desc: 'Summons a radiant stag.' });
  return L;
}

// ------------------------------------------------------------------------------------------------ minimap painting
export function paintMinimap(size = 512) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#4d6a3a'); g.addColorStop(0.5, '#5b7a41'); g.addColorStop(1, '#3f5a33');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${R(20, 60) | 0},${R(50, 90) | 0},${R(20, 40) | 0},${R(0.1, 0.35)})`; x.beginPath(); x.arc(R(0, size), R(0, size), R(2, 14), 0, 7); x.fill(); }
  // river
  x.strokeStyle = '#3d6f8f'; x.lineWidth = size * 0.05; x.lineCap = 'round'; x.beginPath(); x.moveTo(-10, size * 0.2); x.bezierCurveTo(size * 0.3, size * 0.35, size * 0.5, size * 0.1, size + 10, size * 0.3); x.stroke();
  x.strokeStyle = 'rgba(160,210,240,.35)'; x.lineWidth = size * 0.012; x.stroke();
  // roads
  x.strokeStyle = '#b09a6a'; x.lineWidth = size * 0.022; x.beginPath(); x.moveTo(size * 0.5, size); x.lineTo(size * 0.52, size * 0.6); x.lineTo(size * 0.3, size * 0.45); x.lineTo(size * 0.2, 0); x.stroke();
  x.beginPath(); x.moveTo(size * 0.52, size * 0.6); x.lineTo(size, size * 0.72); x.stroke();
  // town
  x.fillStyle = '#8a7a64'; x.fillRect(size * 0.42, size * 0.52, size * 0.2, size * 0.16);
  x.fillStyle = '#6a4a3a'; for (let i = 0; i < 14; i++) x.fillRect(size * 0.43 + (i % 5) * size * 0.037, size * 0.53 + Math.floor(i / 5) * size * 0.05, size * 0.026, size * 0.03);
  // forest blobs
  x.fillStyle = 'rgba(28,52,26,.85)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(R(size * 0.65, size), R(0, size * 0.5), R(6, 18), 0, 7); x.fill(); }
  return cv;
}

// ------------------------------------------------------------------------------------------------ HUD state + simulation
export function createMockHud(o = {}) {
  const cls = o.cls || 'reaver';
  const skills = mockSkills(cls);
  const mm = paintMinimap(512);
  const idKind = CLASSES[cls]?.identity.kind || 'gauge';
  const state = {
    cls,
    hp: 41250, hpMax: 52300, shield: 0, mp: 1840, mpMax: 2400, level: 52, xp: 1840320, xpMax: 3120000, iLvl: 1415.83,
    identity: { kind: idKind, value: 62, max: 100, orbs: 2, maxOrbs: 3, stance: 'shotgun', active: false, activeLeft: 0, label: CLASSES[cls]?.identity.name },
    skills,
    awaken: { id: 'awk', name: CLASSES[cls]?.awakening || 'Awakening', icon: `skill:${cls}:awakening`, type: 'Awakening', cd: 300, cdLeft: 0, mana: 0, level: 1, uses: 3, desc: 'Your awakening skill. Deals catastrophic damage in a wide area.', stagger: 'Very High', superArmor: 'Immune to all' },
    dash: { cd: 8, cdLeft: 0, charges: 1 },
    items: [
      { id: 'hp_pot', icon: 'item:hp_potion', name: 'Major HP Potion', count: 18, cd: 30, cdLeft: 0 },
      { id: 'dbomb', icon: 'item:destruction_bomb', name: 'Destruction Bomb', count: 7, cd: 30, cdLeft: 0 },
      { id: 'flame', icon: 'item:flame_grenade', name: 'Flame Grenade', count: 12, cd: 30, cdLeft: 12 },
      { id: 'whirl', icon: 'item:whirlwind_grenade', name: 'Whirlwind Grenade', count: 0, cd: 30, cdLeft: 0 },
    ],
    buffs: [
      { id: 'burst_speed', icon: 'status:speed_up', name: 'Battle Rhythm', left: 22, dur: 30, desc: 'Attack speed +12%.' },
      { id: 'anthem', icon: 'status:atk_up', name: 'Anthem of Courage', left: 8.5, dur: 10, desc: 'Attack power +15%.' },
      { id: 'food', icon: 'status:rest', name: 'Glass Sea Chowder', left: 1540, desc: 'Max HP +5%.' },
      { id: 'guild', icon: 'status:crit_up', name: 'Guild Blessing', left: Infinity, desc: 'Experience +10%.' },
      { id: 'shield', icon: 'status:shield', name: 'Holy Bulwark', left: 3.2, dur: 6, desc: 'Absorbs damage.' },
      { id: 'grace', icon: 'status:heal', name: 'Blessed Aura', left: 12, dur: 12, stacks: 3 },
      { id: 'bleed', icon: 'status:bleed', name: 'Bleeding', left: 4.4, dur: 8, stacks: 2, debuff: true, desc: 'Losing HP over time.' },
      { id: 'slow', icon: 'status:slow', name: 'Crippled', left: 2.1, dur: 3, debuff: true, desc: 'Movement speed −30%.' },
    ],
    party: [
      { name: 'Ashveil', cls, hp: 41250, hpMax: 52300, shield: 0, you: true },
      { name: 'Brightwen', cls: 'oathkeeper', hp: 38800, hpMax: 44800, shield: 6200, support: true },
      { name: 'Kestrel', cls: 'pistoleer', hp: 20400, hpMax: 46100 },
      { name: 'Moonpetal', cls: 'starcaller', hp: 0, hpMax: 39800, dead: true },
    ],
    boss: {
      name: 'Gorrath', title: 'the Horned Tyrant', hp: 145 * 1e6 * 0.664, hpMax: 145 * 1e6, barHp: 1e6,
      stagger: { v: 62, max: 100 }, destruction: { v: 35, max: 100 }, enrageLeft: 9 * 60 + 42, counter: false,
      buffs: [{ id: 'brand', icon: 'status:brand', name: 'Light Shock', left: 6, dur: 10, debuff: true, desc: 'Takes 10% more damage.' }, { id: 'weak', icon: 'status:def_down', name: 'Armor Break', left: 14, dur: 20, debuff: true, stacks: 4 }],
    },
    target: null,
    quests: [
      { id: 'msq1', title: "The Tyrant's Shadow", kind: 'msq', steps: [{ text: 'Defeat Legion scouts', n: 7, need: 10 }, { text: 'Report to Commander Brannoc', n: 0, need: 1 }] },
      { id: 'side1', title: 'Seeds in the Wheat', kind: 'side', steps: [{ text: 'Find hidden Pip Seeds', n: 2, need: 5 }] },
      { id: 'daily1', title: 'Wayfarer: Wolf Pelts', kind: 'daily', steps: [{ text: 'Collect wolf pelts', n: 12, need: 12, done: true }, { text: 'Deliver to Hilde', n: 0, need: 1 }] },
      { id: 'ev1', title: 'Chaos Gate opens at :30', kind: 'event', steps: [{ text: 'Travel to the Ashen Ridge gate' }] },
    ],
    zone: { name: 'Goldmeadow', sub: 'Harrowfield Farms' },
    minimap: {
      canvas: mm, x0: -200, z0: -200, size: 400, you: { x: 12, z: 40, facing: 0.6 },
      markers: [
        { x: 30, z: 20, kind: 'party', label: 'Brightwen' }, { x: 5, z: 58, kind: 'party', label: 'Kestrel' },
        { x: -20, z: 10, kind: 'quest', label: 'Commander Brannoc' }, { x: 45, z: 70, kind: 'npc', label: 'Hilde' },
        { x: 50, z: 30, kind: 'vendor', label: 'Merchant' }, { x: -40, z: 60, kind: 'portal', label: 'Chaos Gate' },
        { x: 20, z: -30, kind: 'boss', label: 'Old Thunderhoof' }, { x: 0, z: 25, kind: 'objective', label: 'Legion scouts' },
        { x: 60, z: 50, kind: 'mob' }, { x: 63, z: 55, kind: 'mob' }, { x: 58, z: 58, kind: 'elite', label: 'Legion Captain' },
        { x: -10, z: 80, kind: 'seed', label: 'Pip Seed' }, { x: 80, z: 90, kind: 'triport', label: 'Triport' },
      ],
    },
    progress: null,
    timer: null,
    cast: null,
    interact: null,
    currencies: { silver: 8425310, gold: 41280, crystals: 1250 },
  };
  if (o.raid) {
    const names = ['Ashveil', 'Brightwen', 'Kestrel', 'Moonpetal', 'Thornlight', 'Vexa', 'Grimholt', 'Lyra'];
    const classes = [cls, 'oathkeeper', 'pistoleer', 'starcaller', 'stormfist', 'songweaver', 'demonbound', 'bladedancer'];
    state.party = names.map((n, i) => ({ name: n, cls: classes[i], hp: R(0.3, 1) * 45000, hpMax: 45000, shield: i % 3 === 0 ? 5000 : 0, you: i === 0, support: i === 1 || i === 5, dead: i === 6 }));
  }
  if (o.solo) state.party = [state.party[0]];
  if (o.noboss) { state.boss = null; state.target = { name: 'Legion Captain', level: 50, hp: 62000, hpMax: 90000, kind: 'elite' }; }
  if (o.chaos) { state.boss = null; state.target = null; state.progress = { label: 'Demon Rift · Stage 2', pct: 64.2 }; state.timer = { label: 'Time Left', left: 312 }; }

  // ---------------------------------------------------------------- simulation step
  let t = 0, cdTimer = 0;
  function step(dt) {
    t += dt; cdTimer += dt;
    const s = state;
    // cast skills in a loop
    if (cdTimer > 0.9) {
      cdTimer = 0;
      const ready = s.skills.filter(k => k && k.cdLeft <= 0);
      if (ready.length && Math.random() < 0.8) { const k = ready[Math.floor(Math.random() * ready.length)]; k.cdLeft = k.cd; s.mp = Math.max(0, s.mp - k.mana); s.__pressed = k.key; }
    }
    for (const k of s.skills) if (k && k.cdLeft > 0) k.cdLeft = Math.max(0, k.cdLeft - dt * (s.identity.active && cls === 'starcaller' ? 3 : 1));
    for (const it of s.items) if (it.cdLeft > 0) it.cdLeft = Math.max(0, it.cdLeft - dt);
    if (s.dash.cdLeft > 0) s.dash.cdLeft = Math.max(0, s.dash.cdLeft - dt); else if (Math.random() < 0.01) s.dash.cdLeft = s.dash.cd;
    if (s.awaken.cdLeft > 0) s.awaken.cdLeft = Math.max(0, s.awaken.cdLeft - dt); else if (Math.random() < 0.002) s.awaken.cdLeft = s.awaken.cd;
    s.mp = Math.min(s.mpMax, s.mp + dt * 60);
    // hp wobble
    s.hp = s.__dead ? 0 : Math.max(1, Math.min(s.hpMax, s.hp + (Math.random() < 0.08 ? -R(1500, 7000) : dt * 900)));
    s.shield = Math.max(0, s.shield - dt * 400); if (Math.random() < 0.005) s.shield = 9000;
    // identity
    const id = s.identity;
    if (id.active) { id.activeLeft -= dt; id.value = Math.max(0, id.value - dt * 4); if (id.activeLeft <= 0) { id.active = false; id.value = 0; } }
    else { id.value = Math.min(id.max, id.value + dt * 5); if (id.value >= id.max && Math.random() < 0.01) { id.active = true; id.activeLeft = 25; } }
    if (idKind === 'orbs' || idKind === 'bubbles') { if (id.value >= id.max && id.orbs < id.maxOrbs) { id.orbs++; id.value = 0; } if (id.orbs === id.maxOrbs) id.value = id.max; if (Math.random() < 0.004 && id.orbs > 0) { id.orbs--; id.value = 0; } }
    if (idKind === 'stance' && Math.random() < 0.01) id.stance = ['pistol', 'shotgun', 'rifle'][Math.floor(Math.random() * 3)];
    // buffs
    for (const b of s.buffs) if (b.left !== Infinity) { b.left -= dt; if (b.left <= 0) b.left = b.dur || 30; }
    // party
    for (const p of s.party) { if (p.you) { p.hp = s.hp; p.shield = s.shield; continue; } if (p.dead) continue; if (Math.random() < 0.05) p.hp = Math.max(p.hpMax * 0.05, p.hp - R(2000, 8000)); p.hp = Math.min(p.hpMax, p.hp + dt * 1200); p.shield = Math.max(0, (p.shield || 0) - dt * 300); }
    // boss
    const b = s.boss;
    if (b) {
      b.hp = Math.max(b.barHp * 0.4, b.hp - dt * R(0.2, 1.2) * 1e6 * 0.9);
      if (b.hp <= b.barHp * 0.4) b.hp = b.hpMax * 0.9;
      if (b.stagger) { b.stagger.v -= dt * 3; if (b.stagger.v <= 0) b.stagger.v = 100; }
      if (b.destruction) { b.destruction.v -= dt * 1.2; if (b.destruction.v <= 0) b.destruction.v = 100; }
      b.enrageLeft = Math.max(0, b.enrageLeft - dt);
      b.counter = (t % 9) > 7.2;
      for (const x of b.buffs) { x.left -= dt; if (x.left <= 0) x.left = x.dur; }
    }
    if (s.target) { s.target.hp -= dt * 3000; if (s.target.hp <= 0) s.target.hp = s.target.hpMax; }
    if (s.progress) { s.progress.pct = Math.min(100, s.progress.pct + dt * 0.8); if (s.progress.pct >= 100) s.progress.pct = 0; }
    if (s.timer) s.timer.left = Math.max(0, s.timer.left - dt);
    // minimap drift
    const y = s.minimap.you; y.facing += dt * 0.3; y.x += Math.sin(t * 0.3) * dt * 2; y.z += Math.cos(t * 0.2) * dt * 2;
    return s;
  }
  return { state, step };
}

// ------------------------------------------------------------------------------------------------ chat lines
export const CHAT = [
  { channel: 'system', text: 'Welcome to Solmara-1. Daily reset in 6h 12m.' },
  { channel: 'area', from: 'Grimholt', text: 'LF1 support Gorrath NM 1415+ know mechs' },
  { channel: 'shout', from: 'Vexa', text: 'WTS Grudge book x3, 1,200g each, whisper me' },
  { channel: 'party', from: 'Brightwen', text: 'shield on pull, counter at 30%' },
  { channel: 'guild', from: 'Thornlight', text: '+19 weapon failed 11 times. i am fine. everything is fine' },
  { channel: 'whisper', from: 'Lyra', text: 'did you find the last pip seed in Thornwood?' },
  { channel: 'loot', text: 'You obtained', item: { name: 'Destruction Stone Crystal', grade: 3, count: 42, kind: 'material' } },
  { channel: 'party', from: 'Ashveil', you: true, text: 'ready' },
  { channel: 'npc', from: 'Commander Brannoc', text: 'The Legion moves at dusk. Be ready, Shardbearer.' },
];

// ------------------------------------------------------------------------------------------------ screens & windows (lab)
export const mockScreens = {
  title: () => ({
    server: 'Solmara-1', status: 'Busy', version: 'v0.1.0 · 2026.09.29',
    news: [
      { tag: 'Legion Raid', title: 'The Horned Tyrant Awakens', date: 'Now open · Normal & Hard', body: 'Gorrath gathers the Abyssal Legion at the Ashen Ridge. Form a raid of eight, break his horns, and claim the Tyrant set.', art: 0 },
      { tag: 'Event', title: 'Festival of the Glass Sea', date: 'Until Oct 12', body: 'Sail to the Lantern Isles, race the tides, and earn a Sunstag mount skin.', art: 1 },
      { tag: 'Update', title: 'Pipsprout Hollow Opens', date: 'Patch 0.1', body: 'Bramblebeard has lost his seeds again. 120 Pip Seeds are hidden across Solmara.', art: 2 },
    ],
  }),
  charselect: () => ({
    server: 'Solmara-1', roster: { level: 124, xp: 0.42 }, max: 6, selected: 'c1',
    chars: [
      { id: 'c1', name: 'Ashveil', cls: 'reaver', level: 60, iLvl: 1415.83, title: 'Horn Breaker', location: 'Solhaven', rested: true },
      { id: 'c2', name: 'Brightwen', cls: 'oathkeeper', level: 60, iLvl: 1390.0, location: 'Ashen Ridge' },
      { id: 'c3', name: 'Kestrel', cls: 'pistoleer', level: 55, iLvl: 1340.0, location: 'Glass Sea' },
      { id: 'c4', name: 'Moonpetal', cls: 'songweaver', level: 38, iLvl: 612.5, location: 'Thornwood' },
    ],
  }),
  loading: () => ({ zone: 'Goldmeadow', region: 'Valemont', kind: new URLSearchParams(location.search).get('kind') || 'field', pct: 64 }),
  results: () => ({
    kind: 'clear', over: 'Chaos Dungeon', title: 'Demon Rift', sub: 'Stage 3 · Item Level 1,415 · Normal', rank: 'S', time: 312.4, best: 318.9,
    stats: [{ label: 'Party DPS', value: '2.41M' }, { label: 'Deaths', value: '1' }, { label: 'Counters', value: '6' }],
    loot: [
      { uid: 'l1', name: 'Destruction Stone Crystal', grade: 3, count: 186, kind: 'material', icon: 'item:destruction_stone' },
      { uid: 'l2', name: 'Guardian Stone Crystal', grade: 3, count: 540, kind: 'material', icon: 'item:guardian_stone' },
      { uid: 'l3', name: 'Great Honor Leapstone', grade: 4, count: 12, kind: 'material', icon: 'item:leapstone' },
      { uid: 'l4', name: 'Honor Shard Pouch (L)', grade: 3, count: 3, kind: 'consumable', icon: 'item:shards' },
      { uid: 'l5', name: 'Lv 5 Ruinstone', grade: 3, count: 1, kind: 'gem', icon: 'item:gem:ruin:5', gem: { skill: 'Hell Blade', effect: 'Damage +15%' } },
      { uid: 'l6', name: 'Necklace of Burning Resolve', grade: 5, count: 1, kind: 'accessory', slot: 'necklace', icon: 'item:necklace', iLvl: 1340, quality: 71, stats: { might: 12400, crit: 498 }, engr: [{ id: 'grudge', v: 5 }, { id: 'keen_edge', v: 3 }], neg: { id: 'atk_speed_reduction', v: 2 } },
      { uid: 'l7', name: 'Engraving Recipe: Grudge', grade: 5, count: 1, kind: 'book', icon: 'item:book:grudge' },
      { uid: 'l8', name: 'Primal Choker of Solmara', grade: 7, count: 1, kind: 'accessory', slot: 'necklace', icon: 'item:necklace', iLvl: 1600, quality: 100 },
      { uid: 'l9', name: 'Pip Seed', grade: 6, count: 1, kind: 'collectible', icon: 'item:pip_seed' },
    ],
    currencies: { xp: 128400, silver: 42500, gold: 120 },
    dps: [
      { name: 'Ashveil', cls: 'reaver', dmg: 812e6, dps: 2.6e6, crit: 0.62, back: 0.08, counters: 3, you: true },
      { name: 'Kestrel', cls: 'pistoleer', dmg: 745e6, dps: 2.39e6, crit: 0.55, back: 0.41, counters: 1, deaths: 1 },
      { name: 'Vexa', cls: 'bladedancer', dmg: 690e6, dps: 2.21e6, crit: 0.71, back: 0.83, counters: 2 },
      { name: 'Brightwen', cls: 'oathkeeper', dmg: 88e6, dps: 0.28e6, crit: 0.22, back: 0, counters: 0, support: true },
    ],
    retry: true, continueLabel: 'Leave Dungeon',
  }),
  death: () => ({ reason: 'Slain by Gorrath', by: 'Rift Carve', revives: [{ id: 'gate', label: 'Revive at Gate Entrance', sub: 'Return to the start of Gate 2', wait: 6, key: 'R' }, { id: 'feather', label: 'Resurrection Feather', sub: 'Revive where you fell', count: 2 }, { id: 'wait', label: 'Wait for a party member', sub: 'An ally can revive you' }], auto: { label: 'Returning to the entrance in', left: 58 } }),
  create: () => ({ cls: 'reaver', sex: 'f', step: new URLSearchParams(location.search).get('step') || 'class', taken: ['Ashveil'] }),
};
export const mockWindows = {
  character: () => ({
    name: 'Ashveil', cls: 'reaver', level: 60, iLvl: 1415.83, title: 'Horn Breaker', guild: 'Glassborn', roster: 124,
    gear: { weapon: GEAR.weapon, head: GEAR.head, shoulder: GEAR.shoulder, chest: GEAR.chest, pants: GEAR.pants, gloves: GEAR.gloves, necklace: GEAR.necklace, earring1: GEAR.earring1, earring2: GEAR.earring2, ring1: GEAR.ring1, ring2: GEAR.ring2, stone: GEAR.stone, bracelet: GEAR.bracelet },
    stats: { atk: 58420, hp: 312800, crit: 1812, spec: 612, swift: 88, dom: 72, endur: 64, expert: 70 },
    engravings: [{ id: 'grudge', nodes: 15 }, { id: 'keen_edge', nodes: 15 }, { id: 'adrenaline', nodes: 15 }, { id: 'bloodfrenzy', nodes: 12 }, { id: 'cursed_doll', nodes: 10 }, { id: 'atk_reduction', nodes: 5, neg: true }],
    cards: { set: 'Oath of Brighthold', count: 6, awaken: 18, bonuses: [{ text: '2-set: Holy resistance +8%', active: true }, { text: '6-set (18 awakenings): Damage +7%', active: true }, { text: '6-set (30 awakenings): Damage +15%', active: false }] },
  }),
  skills: () => ({ cls: 'reaver', points: 14, pointsTotal: 420, skills: mockAllSkills('reaver'), bar: mockSkills('reaver').map(s => s.id), selected: 'reaver_5' }),
  engravings: () => ({
    active: [{ id: 'grudge', nodes: 15, sources: [{ name: 'Book', v: 12 }, { name: 'Necklace', v: 3 }] }, { id: 'keen_edge', nodes: 15 }, { id: 'adrenaline', nodes: 13 }, { id: 'bloodfrenzy', nodes: 10 }, { id: 'cursed_doll', nodes: 7 }, { id: 'atk_reduction', nodes: 6, neg: true }, { id: 'move_speed_reduction', nodes: 2, neg: true }],
    equipped: [{ id: 'grudge', nodes: 12 }, { id: 'keen_edge', nodes: 12 }],
    books: [{ id: 'grudge', nodes: 20 }, { id: 'keen_edge', nodes: 20 }, { id: 'adrenaline', nodes: 15 }, { id: 'cursed_doll', nodes: 12 }, { id: 'bloodfrenzy', nodes: 9 }, { id: 'spirit_absorption', nodes: 5 }, { id: 'hexed_idol', nodes: 0 }],
  }),
  settings: () => ({ values: { quality: 'high', master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.4, moveButton: 'right', damageNumbers: true, cameraShake: 0.7 } }),
  vendor: () => ({
    name: 'Hilde', title: 'General Goods', greeting: 'Potions, bombs, and honest prices. Mostly honest.',
    tabs: [{ id: 'battle', label: 'Battle Items' }, { id: 'mats', label: 'Materials' }],
    items: [
      { id: 'v1', tab: 'battle', item: { name: 'Major HP Potion', kind: 'battle', grade: 2, icon: 'item:hp_potion', use: 'Restore 30% HP.' }, price: { cur: 'silver', amount: 1200 } },
      { id: 'v2', tab: 'battle', item: { name: 'Destruction Bomb', kind: 'battle', grade: 2, icon: 'item:destruction_bomb' }, price: { cur: 'silver', amount: 2400 }, stock: 20, limit: 20 },
      { id: 'v3', tab: 'battle', item: { name: 'Flame Grenade', kind: 'battle', grade: 1, icon: 'item:flame_grenade' }, price: { cur: 'silver', amount: 800 } },
      { id: 'v4', tab: 'battle', item: { name: 'Time Stop Potion', kind: 'battle', grade: 3, icon: 'item:time_stop' }, price: { cur: 'gold', amount: 45 }, stock: 3, limit: 3 },
      { id: 'v5', tab: 'battle', item: { name: 'Panacea', kind: 'battle', grade: 2, icon: 'item:panacea' }, price: { cur: 'silver', amount: 950 } },
      { id: 'v6', tab: 'battle', item: { name: 'Resurrection Feather', kind: 'consumable', grade: 3, icon: 'item:feather' }, price: { cur: 'crystals', amount: 25000 }, stock: 0, limit: 1 },
      { id: 'v7', tab: 'mats', item: { name: 'Solar Grace', kind: 'material', grade: 2, icon: 'item:solar_grace', count: 10 }, price: { cur: 'gold', amount: 90 } },
      { id: 'v8', tab: 'mats', item: { name: 'Great Honor Leapstone', kind: 'material', grade: 4, icon: 'item:leapstone', count: 5 }, price: { cur: 'gold', amount: 120 } },
    ],
    buyback: [{ uid: 'bb1', name: 'Worn Recruit Blade', kind: 'weapon', grade: 1, icon: 'item:weapon:reaver:t0', price: { cur: 'silver', amount: 84 } }],
    currencies: { silver: 8425310, gold: 41280, crystals: 1250 },
  }),
  gamemenu: () => ({}),
  map: () => ({}),
  inventory: () => ({ items: inventory(), slots: 60, currencies: { silver: 8425310, gold: 41280, crystals: 1250 } }),
  lootDrops: () => [
    { name: 'Destruction Stone Crystal', grade: 3, count: 42, kind: 'material', icon: 'item:destruction_stone' },
    { name: 'Great Honor Leapstone', grade: 4, count: 6, kind: 'material', icon: 'item:leapstone' },
    { name: 'Horned Tyrant Horn', grade: 5, count: 1, kind: 'material', icon: 'item:relic_shard' },
    { name: 'Silver', grade: 0, count: 12500, kind: 'currency', icon: 'currency:silver' },
    { name: 'Engraving Recipe: Grudge', grade: 5, count: 1, kind: 'book', icon: 'item:book:grudge' },
    { name: 'Pip Seed', grade: 6, count: 1, kind: 'collectible', icon: 'item:pip_seed' },
    { name: 'Primal Choker of Solmara', grade: 7, count: 1, kind: 'accessory', icon: 'item:necklace' },
  ],
  npc: () => ({ id: 'brannoc', name: 'Commander Brannoc Hale', title: 'Knight-Commander of Brighthold', cls: 'oathkeeper' }),
  script: () => [
    'You made it out of Brighthold alive. Few did.',
    { text: 'The Legion is regrouping in the Ashen Ridge. Gorrath himself leads them, and he is hunting the Shard you carry.', choices: [{ id: 'accept', text: 'I will stop him.', kind: 'quest' }, { id: 'ask', text: 'Who is Gorrath?' }, { id: 'leave', text: 'Not yet.', kind: 'leave' }] },
  ],
};
