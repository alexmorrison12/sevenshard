// City NPC dialog portraits (`npc:<id>`, ids from src/data/npcs.js), card art (`card:<id>`, src/data/cards.js) and the
// two extra boss medallions they need (`boss:vorrathis`, `boss:ghost_captain`).
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metalLG, gem, ribbon, bez,
  embers, fire, fireLayers, glowPath, smoke, bolt, crystal, backdrop, add, norm, clouds,
} from './core.js';
import { bust, pip, noticeBoard, mailbox, cardFrame } from './people.js';
import { demonHead, skull } from './motifs.js';
import { PORTRAIT_PAINT } from './portraits.js';

const forge = (x, R) => { glow(x, 20, 90, 40, '#ff7a1a', 0.6); embers(x, R, 12, 30, 70, 40, ['#ffb040', '#ff7a1a']); };
const sea = (x, R) => { for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); xx.moveTo(0, 88 - i * 6); xx.quadraticCurveTo(25, 82 - i * 6, 50, 88 - i * 6); xx.quadraticCurveTo(75, 94 - i * 6, 100, 88 - i * 6); }, '#a0e0ff', 0.6); };
const motes = col => (x, R) => { for (let i = 0; i < 12; i++) glow(x, R() * 100, R() * 70, 1 + R() * 2, col, 0.7); };

/** Character configs (bust()). */
export const PEOPLE = {
  blacksmith: { fem: true, skin: '#d8a07a', hair: 'short', hairCol: '#b0502a', hat: 'bandana', hatCol: '#8a2a1a', clothes: 'apron', cloth: '#5a4a3a', prop: 'hammer', soot: true, freckles: true, mood: 'smirk', age: 1, eyes: '#6a8a4a', bg: ['#d0702a', '#3a1608', '#080201'], backFx: forge },
  market: { skin: '#c8906a', hair: 'short', hairCol: '#3a2410', beard: 'goatee', hat: 'wide_hat', hatCol: '#2a5a3a', feather: '#ffd060', monocle: true, clothes: 'coat', cloth: '#3a6a4a', prop: 'coins', mood: 'smile', eyes: '#3a2a1a', bg: ['#c8a05a', '#3a2a10', '#080603'] },
  bank: { fem: true, skin: '#f0d0b8', hair: 'bun', hairCol: '#2a1a14', glasses: true, earrings: '#4ab0ff', clothes: 'noble', cloth: '#2a3a7a', jewel: '#4ab0ff', prop: 'coins', eyes: '#4a5a8a', bg: ['#8a8aa8', '#22223a', '#06060c'] },
  guild: { skin: '#d8a882', hair: 'short', hairCol: '#5a3a1a', beard: 'short', clothes: 'armor', tabard: '#2a7a4a', trim: 'gold', prop: 'book', propCol: '#2a6a3a', eyes: '#4a6a3a', bg: ['#6a8a6a', '#1a2a1a', '#040804'] },
  cards: { fem: true, skin: '#e8c8b0', hair: 'long', hairCol: '#1a1024', hat: 'veil', hatCol: '#b060ff', makeup: '#8a3ab0', earrings: '#c060ff', clothes: 'noble', cloth: '#4a1a6a', jewel: '#c060ff', prop: 'cards', eyes: '#a060ff', mood: 'smirk', lip: '#8a2a5a', bg: ['#8a5ab0', '#2a1040', '#07030c'], backFx: motes('#e0b0ff') },
  general: { skin: '#d8a078', hair: 'receding', hairCol: '#6a5040', beard: 'handlebar', beardCol: '#5a3a20', clothes: 'coat', cloth: '#6a4a2a', trim: 'bronze', prop: 'coins', mood: 'grin', age: 1, eyes: '#4a3a2a', bg: ['#b08a5a', '#3a2a14', '#080603'] },
  songs: { fem: true, skin: '#f0d4bc', hair: 'long_wavy', hairCol: '#e8c070', hat: 'wide_hat', hatCol: '#2a7a70', feather: '#e0fff8', clothes: 'cloak', cloth: '#2a6a64', trim: 'gold', prop: 'lute', mood: 'smile', eyes: '#3a8a7a', bg: ['#4ab0a0', '#123a36', '#030a09'], backFx: (x) => { for (const [px, py] of [[16, 30], [84, 22], [22, 60]]) glow(x, px, py, 5, '#a0fff0', 0.8); } },
  pvp: { skin: '#c8906a', hat: 'helm', plume: '#c02a2a', hatTrim: 'gold', beard: 'short', hairCol: '#1a1410', clothes: 'armor', tabard: '#a02020', scar: 'l', prop: 'spear', mood: 'frown', frown: true, eyes: '#3a2a1a', bg: ['#a04a3a', '#301008', '#080202'] },
  harbor: { fem: true, skin: '#e0b494', hair: 'ponytail', hairCol: '#8a3a1a', hat: 'tricorn', hatCol: '#1a2a4a', hatTrim: 'gold', feather: '#ffffff', clothes: 'coat', cloth: '#1e3050', trim: 'gold', freckles: true, mood: 'smirk', eyes: '#3a6a8a', bg: ['#4a8ac0', '#10284a', '#02060e'], backFx: sea },
  stronghold: { skin: '#c89070', hat: 'cap', hatCol: '#3a4a6a', beard: 'full', beardCol: '#d8d8d4', hairCol: '#c8c8c4', clothes: 'coat', cloth: '#5a3a24', trim: 'bronze', prop: 'oar', age: 2, mood: 'smile', eyes: '#4a6a8a', bg: ['#5a8ab0', '#142838', '#03070a'], backFx: sea },
  gemcutter: { skin: '#e0b898', hair: 'short', hairCol: '#1a1414', beard: 'goatee', monocle: true, clothes: 'robe', cloth: '#4a2a6a', prop: 'gem', propCol: '#40d0ff', mood: 'smile', eyes: '#2a2a3a', bg: ['#6a5aa0', '#1c1638', '#05040c'] },
  tailor: { fem: true, skin: '#f0d0bc', hair: 'bun', hairCol: '#8a8894', glasses: true, clothes: 'noble', cloth: '#a04a6a', jewel: '#ff6aa0', prop: 'needle', propCol: '#ff4a8a', age: 1, mood: 'smile', eyes: '#6a4a5a', bg: ['#c07a9a', '#3a1a2a', '#0a0408'] },
  stable: { skin: '#d49a70', hat: 'straw', beard: 'short', beardCol: '#b0602a', hairCol: '#b0602a', clothes: 'robe', cloth: '#4a6a2a', trim: 'bronze', prop: 'pitchfork', freckles: true, mood: 'grin', eyes: '#5a7a3a', bg: ['#9ab05a', '#2a3a14', '#070a03'] },
  rapport1: { skin: '#d8a882', hair: 'wild', hairCol: '#6a3a1a', hat: 'wide_hat', hatCol: '#8a1a2a', feather: '#ffd060', clothes: 'cloak', cloth: '#7a1a2a', trim: 'gold', prop: 'lute', mood: 'grin', eyes: '#5a3a1a', bg: ['#c06a4a', '#3a1a10', '#0a0403'] },
  rapport2: { fem: true, skin: '#d8b098', hair: 'braid', hairCol: '#e0e0dc', scar: 'r', clothes: 'cloak', cloth: '#5a4030', trim: 'iron', pauldron: 'iron', prop: 'spear', age: 2, mood: 'smirk', eyes: '#6a8aa8', bg: ['#8ab0c8', '#1e3040', '#05080c'], backFx: motes('#ffffff') },
  nexus: { skin: '#c8a88a', hat: 'hood', hatCol: '#3a2a6a', hatTrim: 'gold', beard: 'short', beardCol: '#e0e0e8', eyes: '#60ffe0', eyeGlow: true, clothes: 'robe', cloth: '#2a1a4a', prop: 'staff', propCol: '#a070ff', aura: '#a070ff', age: 2, bg: ['#5a3a9a', '#1a0c3a', '#04020c'] },
  // card-only characters
  morwenna: { fem: true, skin: '#c8d8c8', hair: 'long', hairCol: '#e8f0ec', hat: 'hood', hatCol: '#1e4a44', hatTrim: 'silver', eyes: '#60ffd0', eyeGlow: true, earrings: '#60ffd0', clothes: 'robe', cloth: '#143a34', prop: 'staff', propCol: '#40e0c0', age: 2, mood: 'smirk', bg: ['#3a8a7a', '#0e2a24', '#020806'], backFx: sea },
  ithra: { fem: true, skin: '#d8ecf0', hair: 'long_wavy', hairCol: '#40a8c8', hat: 'circlet', hatTrim: 'silver', hatGem: '#e0ffff', eyes: '#80ffff', eyeGlow: true, clothes: 'robe', cloth: '#1a6a8a', trim: 'silver', prop: 'trident', aura: '#60e0ff', mood: 'smile', bg: ['#3aa0c8', '#0a2a40', '#02060c'], backFx: sea },
  aurelion: { skin: '#f0d0a8', hair: 'short', hairCol: '#f0c040', beard: 'short', beardCol: '#e0b030', hat: 'circlet', hatTrim: 'gold', hatGem: '#fff0a0', eyes: '#ffe080', eyeGlow: true, clothes: 'armor', tabard: '#f0c040', trim: 'gold', pauldron: 'gold', prop: 'lantern', aura: '#ffe080', mood: 'smile', bg: ['#f0c060', '#5a3a0a', '#0a0602'] },
  solenne: { fem: true, skin: '#f4d8c4', hair: 'long', hairCol: '#f0a080', hat: 'circlet', hatTrim: 'rose', hatGem: '#ffb080', eyes: '#ff9a60', eyeGlow: true, clothes: 'robe', cloth: '#c0506a', trim: 'rose', aura: '#ffb080', mood: 'smile', bg: ['#ff9a70', '#5a1a2a', '#0a0306'] },
  maelis: { fem: true, skin: '#ecd4c4', hair: 'bun', hairCol: '#c8c0d8', glasses: true, clothes: 'robe', cloth: '#4a2a7a', trim: 'silver', prop: 'book', propCol: '#6a3a9a', aura: '#c0a0ff', age: 1, mood: 'smile', eyes: '#8a6ab0', bg: ['#8a6ac0', '#20103a', '#05030c'], backFx: motes('#e0d0ff') },
  vaelor: { skin: '#d0a07a', hat: 'helm', hatTrim: 'silver', beard: 'short', hairCol: '#2a2020', scar: 'l', clothes: 'armor', tabard: '#c8d0e0', trim: 'silver', prop: 'shield', aura: '#e0e8ff', mood: 'frown', eyes: '#c0d8ff', eyeGlow: true, bg: ['#8a90a8', '#262a3a', '#06070c'] },
  kest: { skin: '#c89a72', hat: 'hood', hatCol: '#2a4a2a', hatTrim: 'silver', beard: 'short', beardCol: '#5a3a20', eyes: '#9aff9a', eyeGlow: true, clothes: 'cloak', cloth: '#3a2a1a', trim: 'bronze', prop: 'staff', propCol: '#80e080', aura: '#9aff9a', mood: 'smirk', bg: ['#5a8a4a', '#18280e', '#040803'] },
  corvan: { skin: '#d8b090', hair: 'wild', hairCol: '#c8d8f0', beard: 'short', beardCol: '#a8b8d0', eyes: '#aee8ff', eyeGlow: true, clothes: 'coat', cloth: '#1a2a4a', trim: 'silver', prop: 'jar', aura: '#8ad0ff', mood: 'grin', bg: ['#4a6aa0', '#101c38', '#03050c'], backFx: (x, R) => { for (let i = 0; i < 3; i++) bolt(x, R, 10 + i * 40, 4, 16 + i * 36, 40, { col: '#8ad0ff', w: 1, gens: 4 }); } },
};
export const PIPS = {
  rapport3: { body: '#e0c070', leaf: '#6ac850', backpack: true, prop: 'seed' },
  puddlebutton: { body: '#e8c878', leaf: '#5ab848', hat: 'top_hat', mustache: '#6a4a20', sash: '#c02a3a' },
  sprig: { body: '#f0d890', leaf: '#8ae060', small: true, prop: 'seed' },
  captain_acorn: { body: '#d8b068', leaf: '#6ac850', hat: 'pirate', sash: '#2a4a8a', bg: ['#6ab0d0', '#1a3a50', '#030a10'] },
  mossy_gran: { body: '#d8c088', leaf: '#4a9a38', glasses: true, shawl: '#5a8a3a', mood: 'sleepy', prop: 'mug' },
};

// ------------------------------------------------------------------ extra bosses
function vorrathis(x, R) { // Emperor of the Abyss
  backdrop(x, R, ['#4a0e40', '#14020e', '#020001'], { shaft: false });
  glow(x, 50, 50, 50, '#b030ff', 0.5);
  fire(x, R, 50, 100, 70, 110, 0, { n: 9, layers: fireLayers('#12001a', '#5a0a8a', '#d060ff', '#ffe0ff') });
  // crown of many horns
  for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.32, len = 30 - Math.abs(i - 3) * 4; x.save(); x.translate(50 + Math.cos(a) * 16, 34 + Math.sin(a) * 12); x.rotate(a + PI / 2); ribbon(x, bez([0, 0], [-3, -len * 0.4], [2, -len * 0.8], [0, -len]), t => 5 * (1 - t) + 0.4, 16); x.fillStyle = lg(x, 0, 0, 0, -len, [[0, '#1a0a1a'], [0.5, '#8a6a7a'], [1, '#f0e0e8']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 0.8); x.restore(); }
  x.save(); x.translate(50, 60); x.scale(1.15, 1.15); demonHead(x, { skin: '#1a0a1e', eye: '#ff2a2a', horn: '#d8c8d0' }); x.restore();
  x.strokeStyle = metalLG(x, 30, 30, 70, 40, 'gold'); x.lineWidth = 2.4; x.beginPath(); x.moveTo(30, 40); x.quadraticCurveTo(50, 32, 70, 40); x.stroke();
  gem(x, 50, 36, 3.6, '#ff2a4a', { n: 6, glowA: 0.9, lw: 0.5 });
  embers(x, R, 14, 50, 40, 46, ['#e060ff', '#ff4a6a']);
}
function ghostCaptain(x, R) { // Captain Hollowgale
  backdrop(x, R, ['#2a6a70', '#0a1e24', '#020607'], { shaft: false });
  smoke(x, R, 8, 50, 60, 40, '#3a8a8a', 0.3, 16);
  glow(x, 50, 50, 46, '#40e0c0', 0.45);
  // ragged coat
  x.beginPath(); x.moveTo(4, 100); x.bezierCurveTo(8, 80, 20, 72, 32, 70); x.lineTo(68, 70); x.bezierCurveTo(80, 72, 92, 80, 96, 100); x.closePath(); x.fillStyle = lg(x, 0, 70, 0, 100, [[0, 'rgba(40,90,90,.9)'], [1, 'rgba(10,30,30,.6)']]); x.fill(); outline(x, 'rgba(0,0,0,.8)', 1);
  for (const px of [16, 30, 70, 84]) { poly(x, [[px - 5, 100], [px, 88], [px + 5, 100]]); x.fillStyle = '#041010'; x.fill(); }
  x.save(); x.translate(50, 52); skull(x, 1.05, { bone: ['#e8fff8', '#a8e0d0', '#4a8a80', '#123a34'], eyes: '#60ffd8' }); x.restore();
  // tricorn
  x.beginPath(); x.moveTo(14, 34); x.quadraticCurveTo(50, 16, 86, 34); x.quadraticCurveTo(72, 28, 66, 12); x.quadraticCurveTo(50, 6, 34, 12); x.quadraticCurveTo(28, 28, 14, 34); x.closePath();
  x.fillStyle = lg(x, 14, 6, 86, 34, [[0, 'rgba(30,70,70,.95)'], [1, 'rgba(8,24,24,.95)']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1);
  x.strokeStyle = rgba('#80ffe0', 0.6); x.lineWidth = 1.1; x.beginPath(); x.moveTo(15, 33.5); x.quadraticCurveTo(50, 16, 85, 33.5); x.stroke();
  for (let i = 0; i < 10; i++) glow(x, R() * 100, 40 + R() * 60, 1 + R() * 2, '#a0fff0', 0.6);
}

// ------------------------------------------------------------------ registry
const NPC_KIND = { rapport3: 'pip' };
export const NPC_CARD_PAINT = {};
for (const k in PEOPLE) NPC_CARD_PAINT[`npc:${k}`] = (x, R) => bust(x, R, PEOPLE[k]);
for (const k in PIPS) NPC_CARD_PAINT[`npc:${k}`] = (x, R) => pip(x, R, PIPS[k]);
NPC_CARD_PAINT['npc:tasks'] = (x, R) => noticeBoard(x, R);
NPC_CARD_PAINT['npc:board'] = (x, R) => noticeBoard(x, R, { bg: ['#6a7aa0', '#1a2034', '#05060a'], flags: true, marks: ['#c83a3a', '#3a8ac8', '#3ac87a', '#c8a03a'], papers: [[18, 28, -0.06], [42, 26, 0.04], [64, 30, 0.08], [24, 52, 0.05], [50, 50, -0.05]] });
NPC_CARD_PAINT['npc:mail'] = (x, R) => mailbox(x, R);
NPC_CARD_PAINT['boss:vorrathis'] = vorrathis;
NPC_CARD_PAINT['boss:ghost_captain'] = ghostCaptain;

/** card id → [painter source id, kind colour] */
const KIND_COL = { boss: '#ff4a3a', legend: '#ffd060', pip: '#7ae060', npc: '#8ab8ff' };
const CARD_SRC = {
  seraphine: ['npc:seraphine', 'npc'], brannoc: ['npc:brannoc', 'npc'], bramblebeard: ['npc:bramblebeard', 'pip'],
  hilda: ['npc:blacksmith', 'npc'], iolanthe: ['npc:cards', 'npc'], tully: ['npc:general', 'npc'], mirelle: ['npc:harbor', 'npc'],
  wren: ['npc:rapport1', 'npc'], maren: ['npc:rapport2', 'npc'], tumbleroot: ['npc:rapport3', 'pip'], morwenna: ['npc:morwenna', 'npc'],
  ithra: ['npc:ithra', 'legend'], aurelion: ['npc:aurelion', 'legend'], solenne: ['npc:solenne', 'legend'], maelis: ['npc:maelis', 'legend'],
  vaelor: ['npc:vaelor', 'legend'], kest: ['npc:kest', 'legend'], corvan: ['npc:corvan', 'legend'],
  puddlebutton: ['npc:puddlebutton', 'pip'], sprig: ['npc:sprig', 'pip'], captain_acorn: ['npc:captain_acorn', 'pip'], mossy_gran: ['npc:mossy_gran', 'pip'],
  vorrathis: ['boss:vorrathis', 'boss'], ghost_captain: ['boss:ghost_captain', 'boss'],
};
for (const b of ['gorrath', 'varkhul', 'skarn', 'vesk', 'ashmaw', 'rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'thunderhoof', 'nerissa', 'deep_oracle', 'gatekeeper']) CARD_SRC[b] = [`boss:${b}`, 'boss'];
export const CARD_IDS = Object.keys(CARD_SRC);
for (const [id, [src, kind]] of Object.entries(CARD_SRC)) {
  NPC_CARD_PAINT[`card:${id}`] = (x, R, o) => { const fn = NPC_CARD_PAINT[src] || PORTRAIT_PAINT[src]; fn(x, R, o); cardFrame(x, KIND_COL[kind]); };
}
/** Unknown card ids: a generic card back with a Shard emblem. */
export function genericCard(x, R, o) {
  backdrop(x, R, ['#5a4a8a', '#1a1030', '#05030a'], { shaft: false });
  glow(x, 50, 50, 40, '#c090ff', 0.5);
  star(x, 50, 50, 4, 8, 28); x.fillStyle = lg(x, 30, 22, 70, 78, [[0, '#ffffff'], [0.5, '#d8c0ff'], [1, '#6a3ab0']]); x.fill(); outline(x, 'rgba(0,0,0,.7)', 1);
  sparkle(x, 50, 50, 10);
  cardFrame(x, '#c090ff');
  void o; void NPC_KIND;
}
