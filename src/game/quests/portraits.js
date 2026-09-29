// Dialog portraits for the story's own cast (Brighthold, Solhaven's court, the field residents): painted busts in the
// UI's portrait style (src/ui/icons/people.js), cached as data URLs. NPCs the icon set already paints (Brannoc,
// Seraphine, the city services, the named Pips) keep the UI's art.
import { mk, downscale, setK, rng, hashStr, finishSquare, norm, noBlur, glow, embers } from '../../ui/icons/core.js';
import { bust, pip } from '../../ui/icons/people.js';
import { hasIcon } from '../../ui/icons/index.js';

const forge = (x, R) => { glow(x, 20, 90, 40, '#ff7a1a', 0.6); embers(x, R, 12, 30, 70, 40, ['#ffb040', '#ff7a1a']); };
const ash = (x, R) => { glow(x, 50, 100, 60, '#ff4a1a', 0.35); embers(x, R, 10, 20, 80, 50, ['#ff8a40', '#ff4a1a']); };
const motes = col => (x, R) => { for (let i = 0; i < 12; i++) glow(x, R() * 100, R() * 70, 1 + R() * 2, col, 0.7); };
const BG = {
  fire: ['#c0602a', '#3a1206', '#080201'], court: ['#c8a05a', '#4a1a14', '#0a0302'], sea: ['#4a8ac0', '#10284a', '#02060e'],
  meadow: ['#b8b060', '#3a3a14', '#080803'], wood: ['#5a7a4a', '#16220e', '#030602'], ashen: ['#a05a3a', '#2a1008', '#070201'],
  violet: ['#8a6aa0', '#24143a', '#06030c'], steel: ['#7a90b0', '#1a2436', '#04060a'],
};

/** bust() configs (see src/ui/icons/people.js); `pip: true` paints a Pip instead */
export const STORY_PORTRAITS = {
  // --- Brighthold
  guard_ren: { skin: '#d4a07a', hat: 'helm', hatTrim: 'iron', beard: 'short', beardCol: '#4a3020', hairCol: '#3a2418', clothes: 'armor', tabard: '#a0302a', trim: 'iron', prop: 'spear', frown: true, mood: 'frown', eyes: '#3a2a1a', bg: BG.fire, backFx: ash },
  gunner_bess: { fem: true, skin: '#d8a888', hair: 'ponytail', hairCol: '#2a1a10', hat: 'bandana', hatCol: '#6a2a1a', clothes: 'apron', cloth: '#4a3a2a', soot: true, freckles: true, prop: 'lantern', mood: 'grin', eyes: '#6a4a2a', bg: BG.fire, backFx: forge },
  tam: { skin: '#e0b090', hair: 'short', hairCol: '#6a4a2a', freckles: true, clothes: 'armor', tabard: '#2a4a8a', trim: 'iron', prop: 'spear', mood: 'smile', eyes: '#5a7a4a', bg: BG.steel },
  refugee_wenna: { fem: true, skin: '#e0b898', hair: 'long', hairCol: '#6a4a2a', hat: 'hood', hatCol: '#5a4a3a', clothes: 'cloak', cloth: '#5a4a3a', soot: true, mood: 'frown', eyes: '#6a6a5a', bg: ['#8a7a6a', '#2a2218', '#070504'] },
  // --- Solhaven's court and harbour
  king: { skin: '#e0b890', hair: 'short', hairCol: '#8a7a6a', beard: 'full', beardCol: '#b0a090', hat: 'crown', hatTrim: 'gold', hatGem: '#ff4a4a', clothes: 'noble', cloth: '#8a1a2a', trim: 'gold', jewel: '#ffd060', age: 2, mood: 'smile', eyes: '#4a6a8a', bg: BG.court },
  chancellor: { fem: true, skin: '#f0d8c4', hair: 'bun', hairCol: '#3a2a2a', glasses: true, clothes: 'noble', cloth: '#3a1a4a', jewel: '#b080ff', earrings: '#b080ff', prop: 'quill', age: 1, mood: 'frown', eyes: '#5a4a6a', bg: BG.violet },
  magister: { skin: '#e8c8a8', hair: 'wild', hairCol: '#e0e0e8', beard: 'full', beardCol: '#e8e8f0', monocle: true, clothes: 'robe', cloth: '#2a3a8a', trim: 'silver', prop: 'book', propCol: '#4a5aa0', age: 2, mood: 'grin', eyes: '#6a8aff', aura: '#8ab0ff', bg: ['#5a6ac0', '#141a40', '#03040c'], backFx: motes('#c0d8ff') },
  marshal: { fem: true, skin: '#e0b894', hair: 'braid', hairCol: '#c8a060', clothes: 'armor', tabard: '#2a4a8a', trim: 'silver', pauldron: 'steel', prop: 'shield', scar: 'r', mood: 'smirk', eyes: '#4a7aa8', bg: BG.steel },
  apprentice: { skin: '#e8c0a0', hair: 'wild', hairCol: '#c86a2a', freckles: true, clothes: 'apron', cloth: '#5a4a3a', soot: true, prop: 'hammer', mood: 'grin', eyes: '#5a8a4a', bg: BG.fire, backFx: forge },
  fisher_barty: { skin: '#c89070', hat: 'cap', hatCol: '#2a4a6a', beard: 'full', beardCol: '#8a6a4a', hairCol: '#8a6a4a', clothes: 'coat', cloth: '#3a5a6a', prop: 'oar', age: 1, mood: 'grin', eyes: '#4a6a8a', bg: BG.sea },
  fisher_nessa: { fem: true, skin: '#d8a888', hair: 'braid', hairCol: '#d8d0c0', hat: 'wide_hat', hatCol: '#6a5a3a', clothes: 'coat', cloth: '#2a5a5a', prop: 'oar', age: 2, mood: 'smirk', eyes: '#3a7a8a', bg: BG.sea },
  // --- Goldmeadow
  rusk: { skin: '#d8a882', hair: 'swept', hairCol: '#2a1a14', beard: 'handlebar', beardCol: '#2a1a14', hat: 'wide_hat', hatCol: '#6a1a1a', feather: '#ffd060', monocle: true, clothes: 'coat', cloth: '#8a1a1a', trim: 'gold', prop: 'coins', mood: 'smirk', eyes: '#3a2a1a', bg: ['#b04a3a', '#3a1010', '#0a0303'] },
  farmer_hale: { skin: '#d49a70', hat: 'straw', beard: 'short', beardCol: '#8a5a2a', hairCol: '#8a5a2a', clothes: 'apron', cloth: '#6a5a2a', prop: 'pitchfork', age: 1, mood: 'smile', eyes: '#5a6a3a', bg: BG.meadow },
  miller: { fem: true, skin: '#f0d0b8', hair: 'bun', hairCol: '#d8c8b0', hat: 'bandana', hatCol: '#e8e0d0', clothes: 'apron', cloth: '#8a7a5a', freckles: true, mood: 'smile', eyes: '#6a5a3a', bg: BG.meadow },
  captain: { skin: '#d0a07a', hat: 'helm', hatTrim: 'iron', beard: 'goatee', beardCol: '#3a2418', hairCol: '#3a2418', clothes: 'armor', tabard: '#3a6a2a', trim: 'iron', prop: 'spear', mood: 'frown', eyes: '#4a3a2a', bg: BG.meadow },
  innkeeper: { fem: true, skin: '#e8b898', hair: 'bun', hairCol: '#8a3a1a', clothes: 'apron', cloth: '#7a4a2a', prop: 'jar', age: 1, mood: 'grin', eyes: '#6a4a2a', bg: ['#c8904a', '#3a2010', '#080402'] },
  hunter: { skin: '#c8966e', hair: 'short', hairCol: '#4a3018', hat: 'hood', hatCol: '#3a5a2a', clothes: 'cloak', cloth: '#4a5a2a', scar: 'l', prop: 'spear', mood: 'smirk', eyes: '#5a7a3a', bg: BG.wood },
  child: { fem: true, skin: '#f0c8a8', hair: 'ponytail', hairCol: '#c8903a', freckles: true, clothes: 'robe', cloth: '#c05a4a', mood: 'grin', eyes: '#4a7aa0', bg: BG.meadow },
  hermit: { skin: '#d0a888', hair: 'wild', hairCol: '#d0d0c8', beard: 'full', beardCol: '#d8d8d0', clothes: 'cloak', cloth: '#5a4a3a', prop: 'staff', propCol: '#e0d080', age: 2, mood: 'grin', eyes: '#6a6a5a', bg: BG.meadow },
  merchant: { skin: '#d8a882', hair: 'short', hairCol: '#5a3a1a', beard: 'goatee', hat: 'wide_hat', hatCol: '#4a3a6a', feather: '#e0c0ff', clothes: 'coat', cloth: '#4a3a6a', trim: 'bronze', prop: 'coins', mood: 'smile', eyes: '#4a3a2a', bg: BG.meadow },
  beekeeper: { fem: true, skin: '#f0d0b0', hair: 'long_wavy', hairCol: '#e8c070', hat: 'veil', hatCol: '#f0e8c0', clothes: 'apron', cloth: '#c8a040', prop: 'jar', mood: 'smile', eyes: '#8a6a2a', bg: ['#e0b040', '#4a3208', '#0a0602'], backFx: motes('#ffe080') },
  guard: { skin: '#d8a882', hat: 'helm', hatTrim: 'iron', beard: 'short', beardCol: '#6a4a2a', hairCol: '#6a4a2a', clothes: 'armor', tabard: '#3a6a2a', trim: 'iron', prop: 'spear', mood: 'smile', eyes: '#5a4a3a', bg: BG.meadow },
  shrinekeeper: { fem: true, skin: '#f0d8c4', hat: 'hood', hatCol: '#e8d8a0', hatTrim: 'gold', clothes: 'robe', cloth: '#e8d8b0', trim: 'gold', prop: 'lantern', aura: '#ffe8a0', mood: 'smile', eyes: '#8a7a4a', bg: ['#f0d080', '#5a4010', '#0a0802'] },
  // --- Thornwood
  warden: { fem: true, skin: '#d8b090', hat: 'hood', hatCol: '#2a4a2a', hatTrim: 'bronze', hair: 'long', hairCol: '#3a2a1a', clothes: 'cloak', cloth: '#2a3a1a', trim: 'bronze', prop: 'spear', scar: 'l', mood: 'frown', eyes: '#6aa04a', bg: BG.wood },
  monk: { skin: '#e0b898', hair: 'bald', beard: 'full', beardCol: '#a0a098', clothes: 'robe', cloth: '#5a4a3a', prop: 'book', propCol: '#6a3a1a', age: 2, mood: 'smile', eyes: '#6a6a5a', bg: ['#8a8060', '#24200e', '#060502'], backFx: motes('#fff0c0') },
  herbalist: { fem: true, skin: '#e0c0a0', hair: 'wild', hairCol: '#b0b0a8', hat: 'wide_hat', hatCol: '#3a2a4a', clothes: 'cloak', cloth: '#3a4a2a', prop: 'jar', age: 2, mood: 'grin', eyes: '#6a8a4a', bg: BG.wood, backFx: motes('#b0ff80') },
  cult_defector: { skin: '#e0c0a8', hat: 'hood_up', hatCol: '#3a1a2a', clothes: 'robe', cloth: '#4a1a2a', prop: 'letters', mood: 'frown', eyes: '#8a6a5a', bg: ['#6a3a4a', '#1a0a10', '#050203'] },
  woodcutter: { fem: true, skin: '#d8a882', hair: 'short', hairCol: '#6a4a2a', hat: 'bandana', hatCol: '#4a6a2a', clothes: 'apron', cloth: '#5a4a2a', prop: 'hammer', age: 1, mood: 'smirk', eyes: '#5a4a2a', bg: BG.wood },
  owl_sage: { skin: '#c8a878', hair: 'wild', hairCol: '#8a7050', beard: 'full', beardCol: '#c0a878', glasses: true, clothes: 'robe', cloth: '#6a5030', prop: 'book', propCol: '#3a4a6a', age: 2, mood: 'smile', eyes: '#ffb020', eyeGlow: true, bg: BG.wood },
  thornking: { skin: '#7a6a44', hair: 'wild', hairCol: '#3a6a2a', beard: 'full', beardCol: '#4a7a2a', hat: 'crown', hatTrim: 'bronze', hatGem: '#a0ff60', clothes: 'robe', cloth: '#4a3a24', age: 2, eyes: '#c0ff60', eyeGlow: true, aura: '#a0ff60', mood: 'smile', bg: ['#4a6a2a', '#14200a', '#030602'], backFx: motes('#c0ff80') },
  // --- Ashen Ridge
  captain_flint: { fem: true, skin: '#e0b894', hair: 'ponytail', hairCol: '#c83a1a', clothes: 'armor', tabard: '#2a4a8a', trim: 'silver', pauldron: 'steel', scar: 'r', prop: 'shield', mood: 'smirk', eyes: '#4a6a8a', bg: BG.ashen, backFx: ash },
  quartermaster: { skin: '#d8b090', hair: 'receding', hairCol: '#6a5a4a', glasses: true, clothes: 'coat', cloth: '#4a4a3a', trim: 'bronze', prop: 'quill', age: 1, mood: 'frown', eyes: '#4a4a3a', bg: BG.ashen },
  scout_ivy: { fem: true, skin: '#e8c0a0', hat: 'hood', hatCol: '#4a5a3a', hair: 'long', hairCol: '#2a1a10', clothes: 'cloak', cloth: '#4a4a3a', freckles: true, prop: 'spear', mood: 'smirk', eyes: '#5a8a4a', bg: BG.ashen },
  refugee: { skin: '#d0a080', hair: 'short', hairCol: '#3a2a1a', clothes: 'cloak', cloth: '#4a3a2a', soot: true, mood: 'frown', eyes: '#5a4a3a', bg: BG.ashen, backFx: ash },
  smith_ghost: { skin: '#a8d0e0', hair: 'short', hairCol: '#c0e0f0', beard: 'full', beardCol: '#c0e0f0', clothes: 'apron', cloth: '#4a6a7a', prop: 'hammer', eyes: '#a0f0ff', eyeGlow: true, aura: '#80e0ff', mood: 'smile', age: 1, bg: ['#4a7a9a', '#0e1e2a', '#02050a'], backFx: motes('#a0f0ff') },
  medic: { fem: true, skin: '#f0d0b8', hat: 'hood', hatCol: '#e8e0d8', hatTrim: 'rose', clothes: 'robe', cloth: '#e8e0d8', trim: 'rose', prop: 'jar', mood: 'smile', eyes: '#6a5a4a', bg: BG.ashen },
  // --- field locals that show up in quests
  witch: { fem: true, skin: '#c8c0a0', hair: 'wild', hairCol: '#e0e0d8', hat: 'wide_hat', hatCol: '#2a1a3a', clothes: 'cloak', cloth: '#2a1a3a', prop: 'staff', propCol: '#80ffb0', age: 2, mood: 'grin', eyes: '#80ffb0', eyeGlow: true, bg: BG.wood, backFx: motes('#80ffb0') },
  scholar: { skin: '#e0c0a0', hair: 'receding', hairCol: '#8a7a6a', glasses: true, clothes: 'robe', cloth: '#5a4a6a', prop: 'book', age: 1, mood: 'smile', eyes: '#5a5a6a', bg: BG.wood },
  trapper: { skin: '#c8966e', hat: 'cap', hatCol: '#5a3a1a', beard: 'full', beardCol: '#5a3a1a', hairCol: '#5a3a1a', clothes: 'cloak', cloth: '#6a4a2a', prop: 'spear', mood: 'smirk', eyes: '#4a3a1a', bg: BG.wood },
  pilgrim: { fem: true, skin: '#e0c0a8', hat: 'hood', hatCol: '#8a7a5a', hair: 'long', hairCol: '#c8c8c0', clothes: 'cloak', cloth: '#8a7a5a', prop: 'staff', propCol: '#fff0c0', age: 2, mood: 'smile', eyes: '#6a6a5a', bg: BG.wood },
  commander: { skin: '#d0a07a', hair: 'short', hairCol: '#2a2020', beard: 'short', beardCol: '#2a2020', clothes: 'armor', tabard: '#2a4a8a', trim: 'silver', pauldron: 'steel', scar: 'l', prop: 'shield', mood: 'frown', eyes: '#3a4a6a', bg: BG.ashen },
  smith: { fem: true, skin: '#d8a07a', hair: 'short', hairCol: '#3a2418', hat: 'bandana', hatCol: '#2a4a8a', clothes: 'apron', cloth: '#5a4a3a', soot: true, prop: 'hammer', mood: 'smirk', eyes: '#5a4a3a', bg: BG.fire, backFx: forge },
  priest: { fem: true, skin: '#f0d8c4', hair: 'bun', hairCol: '#5a3a2a', clothes: 'robe', cloth: '#6a2a2a', trim: 'gold', prop: 'book', propCol: '#8a2a2a', age: 1, mood: 'smile', eyes: '#6a4a3a', bg: BG.ashen },
  miner: { skin: '#c8906a', hat: 'cap', hatCol: '#4a4a4a', beard: 'full', beardCol: '#8a8a88', hairCol: '#8a8a88', clothes: 'apron', cloth: '#4a3a2a', soot: true, prop: 'hammer', age: 2, mood: 'grin', eyes: '#4a3a2a', bg: BG.ashen },
  dockmaster: { skin: '#c89070', hat: 'tricorn', hatCol: '#1a2a4a', hatTrim: 'gold', beard: 'short', beardCol: '#4a3a2a', hairCol: '#4a3a2a', clothes: 'coat', cloth: '#1e3050', trim: 'gold', prop: 'letters', mood: 'frown', eyes: '#3a5a7a', bg: BG.sea },
  // --- Pips the icon set doesn't paint
  tadpole: { pip: true, body: '#f0d890', leaf: '#8ae060', small: true, prop: 'seed', bg: ['#b8e080', '#3a6a28', '#0a1604'] },
  nib: { pip: true, body: '#e0c070', leaf: '#6ac850', backpack: true, prop: 'seed' },
  pip_librarian: { pip: true, body: '#e8d0a0', leaf: '#5ab848', glasses: true, prop: 'twig' },
  pip_stablekeeper: { pip: true, body: '#d8b870', leaf: '#6ac850', mood: 'sleepy' },
  pip_bard: { pip: true, body: '#f0d890', leaf: '#8ae060', scarf: '#c060ff' },
  pip_guard: { pip: true, body: '#d8b068', leaf: '#6ac850', hat: 'acorn', prop: 'twig' },
};
/** ids whose residents share a portrait (a zone-local id → the portrait above) */
const SAME = { captain_ashen: 'captain_flint', healer: 'medic', scout: 'scout_ivy', survivor: 'refugee', sergeant: 'guard_ren', gunner: 'gunner_bess' };

const cache = new Map();
/** a painted portrait (data URL) for a story/field NPC id, or null when the UI's icon set already has one */
export function storyPortrait(id, { zone } = {}) {
  if (!id || typeof document === 'undefined') return null;
  const key = (zone === 'ashen_ridge' && id === 'captain') ? 'captain_flint' : SAME[id] || id;
  const cfg = STORY_PORTRAITS[key];
  if (!cfg) return null;
  if (!STORY_PORTRAITS[id] && hasIcon('npc:' + id)) return null;
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try { url = paint(key, cfg).toDataURL('image/png'); } catch (e) { console.warn('[story] portrait', key, e); }
  cache.set(key, url);
  return url;
}
/** the icon system's square NPC frame around a bust() / pip() painting */
function paint(id, cfg, size = 150) {
  const M = size;
  const [c, x] = mk(M);
  setK(M / 100);
  const R = rng(hashStr('npc:' + id) ^ 0x5eed);
  x.save();
  try { (cfg.pip ? pip : bust)(x, R, cfg); } finally { x.restore(); }
  x.setTransform(M / 100, 0, 0, M / 100, 0, 0);
  norm(x); noBlur(x); x.lineJoin = 'round'; x.lineCap = 'round';
  finishSquare(x, { vignette: 0.5 });
  return downscale(c, size);
}
