// Gear specification, presets, palette and body "painting" (garments displaced + coloured on the body mesh).
import { linColor } from '../../engine/geom.js';
import { SLOT, NSLOT, DET } from './palette.js';
import { CH_TORSO, CH_ARM_L, CH_ARM_R, CH_LEG_L, CH_LEG_R, CH_HEAD, CH_HAND_L, CH_HAND_R } from './rig.js';
import { clamp, lerp, smoothstep, Simplex } from '../../core/noise.js';

const NZ = new Simplex(99);

// ---------------------------------------------------------------------------------------------
// Gear spec (all fields optional):
// {
//   armor: 'plate'|'mail'|'leather'|'cloth', tier: 0..3,
//   colors: { primary, secondary, trim, metal, leather, cloth, pants, boots, gloves, belt, gem, cape, capeInner, emblem, tabard, hood },
//   head:      null | { type: 'helm'|'greathelm'|'horned'|'winged'|'hood'|'wizard'|'straw'|'bandana'|'cap'|'circlet'|'crown', mask?, gem?, glowTrim? },
//   shoulders: null | { type: 'plate'|'mail'|'leather'|'cloth'|'fur', size, layers, spikes, gem, wing, glowTrim },
//   chest:     { type: 'shirt'|'tunic'|'vest'|'robe'|'plate'|'mail'|'leather'|'rags', sleeves: 0..2 (arm coord), sleeveType?, neck: 'crew'|'v'|'high', straps? },
//   belt:      null | { type: 'leather'|'plate'|'sash'|'rope', buckle: 'square'|'gem'|'plate'|'skull'|'none', pouches },
//   legs:      { type: 'pants'|'leather'|'mail'|'plate'|'rags', kneepads? },
//   feet:      { type: 'boots'|'shoes'|'plate'|'wraps', height: 0..1, cuff? },
//   hands:     null | { type: 'gloves'|'gauntlets'|'wraps'|'bracers', cuff },
//   cloak:     null | { len, trim, emblem, glowTrim },
//   tabard:    null | { emblem, back }, apron: bool,
//   skirt:     null | { len, type, flare, panel, hemTrim },
//   mainHand:  null | { type: 'sword1h'|'sword2h'|'axe'|'axe2h'|'mace'|'staff'|'dagger'|'bow'|'wand', ... },
//   offHand:   null | { type: 'shield'|'book'|'orb'|'dagger'|'sword1h'|'axe'|'mace', emblem },
//   quiver: bool, glow: hex (epic glow colour)
// }

const C = {
  steel: 0xa8b2bc, darkSteel: 0x4c535c, iron: 0x7a7f86, gold: 0xe8b848, bronze: 0xb8803e, silver: 0xdfe6ee, blackIron: 0x2e3036,
  leather: 0x7a5232, darkLeather: 0x3e2a1c, tan: 0xa8784c, blackLeather: 0x24201e, fur: 0xb89c78, darkFur: 0x6a5642,
  linen: 0xe8dcc0, brown: 0x6a4a30, wood: 0x7a5534, crimson: 0x9a1c1c, blood: 0x6a0e0e,
};
function preset(o) { return { tier: 0, armor: 'cloth', ...o, colors: { ...o.colors } }; }

// ---------------------------------------------------------------------------------------------
// Class outfits: CLASS_OUTFITS[cls](tier, sex) → gear spec. Tier 0 story (plain leather / cloth), 1 Vanguard (proper
// armour), 2 Horned Tyrant legion set (dark metal, horn motifs, glowing red runes: runes: true).
export const CLASS_OUTFITS = {
  reaver: (t, sex) => {
    const f = sex === 'f';
    if (t === 0) return preset({ armor: 'leather', tier: 0, colors: { primary: 0x5a4636, secondary: C.crimson, trim: 0x8a7050, pants: 0x3a302a, boots: 0x3a2a20, tabard: 0x8a1e1a, belt: 0x2e2018 },
      chest: { type: 'leather', sleeves: 0.55, neck: 'crew', straps: true }, shoulders: { type: 'leather', size: 1.15, layers: 1, spikes: 1, side: 'R' }, belt: { type: 'leather', buckle: 'square', pouches: 1 },
      legs: { type: 'leather', kneepads: true }, feet: { type: 'boots', height: 0.6, cuff: true }, hands: { type: 'bracers', cuff: 0.4 },
      tabard: { back: true, short: true }, mainHand: { arm: 'greatsword' } });
    if (t === 1) return preset({ armor: 'plate', tier: 1, colors: { primary: 0x46423e, secondary: 0x8e1414, trim: 0xb08440, pants: 0x2a2624, boots: 0x3c3834, tabard: 0x8a1212, capeInner: 0x2a0a0a, belt: 0x2a1e18, emblem: 0xc8a050 },
      chest: { type: 'plate', sleeves: f ? 1.2 : 1.3, neck: 'high' }, shoulders: { type: 'plate', size: f ? 1.2 : 1.35, layers: 2, spikes: 3 },
      belt: { type: 'plate', buckle: 'skull' }, legs: { type: 'plate', kneepads: true }, feet: { type: 'plate', height: 0.75, cuff: true },
      hands: { type: 'gauntlets', cuff: 0.45 }, tabard: { back: true, short: true, hw: 0.09 },
      cuirass: { style: 'plate', neck: 'round', lames: 3, rivets: true }, tassets: { rows: 3, spikes: true }, greaves: { from: 1.1, to: 1.95 }, vambraces: { from: 1.3, to: 1.92 },
      mainHand: { arm: 'greatsword' } });
    return preset({ armor: 'plate', tier: 2, runes: true, colors: { primary: 0x26262c, secondary: C.blood, trim: 0x6a1e1a, pants: 0x1e1e22, boots: 0x26262c, tabard: 0x5a0c0c, belt: 0x1a1414, emblem: 0xb02a1a, horn: 0x3c3028 },
      chest: { type: 'plate', sleeves: f ? 1.25 : 1.35, neck: 'high' }, shoulders: { type: 'plate', size: f ? 1.3 : 1.5, layers: 3, spikes: 2, horns: true, glowTrim: true },
      belt: { type: 'plate', buckle: 'skull' }, legs: { type: 'plate', kneepads: true }, feet: { type: 'plate', height: 0.8, cuff: true },
      hands: { type: 'gauntlets', cuff: 0.5, glowTrim: true }, tabard: { back: true, tatter: true, short: true, hw: 0.095 },
      cuirass: { style: 'plate', neck: 'high', lames: 4, rivets: true }, tassets: { rows: 3, spikes: true }, greaves: { from: 1.08, to: 1.95 }, vambraces: { from: 1.25, to: 1.92 },
      head: f ? null : { type: 'hornband' }, mainHand: { arm: 'greatsword' } });
  },
};
// Legion (tier 2) palette shared by every class: blackened metal, dried-blood cloth, bone-dark horns, red runes.
const LEGION = { primary: 0x2a2624, secondary: 0x5a0e0e, trim: 0x6a1e1a, pants: 0x1e1a1a, boots: 0x2a2624, belt: 0x1a1414, emblem: 0xb02a1a, horn: 0x3c3028, rune: 0x2a0604 };

Object.assign(CLASS_OUTFITS, {
  oathkeeper: (t, sex) => {
    const f = sex === 'f';
    if (t === 0) return preset({ armor: 'mail', tier: 0, colors: { primary: 0x8a9098, secondary: 0x2a4a8a, trim: 0xa88a58, pants: 0x4a4038, boots: 0x4a3424, tabard: 0xded8c6, emblem: 0x2a4a8a, belt: 0x4a3020 },
      chest: { type: 'mail', sleeves: 1.2, neck: 'crew' }, shoulders: { type: 'leather', size: 0.95, layers: 1 }, belt: { type: 'leather', buckle: 'square' },
      legs: { type: 'mail', kneepads: true }, feet: { type: 'boots', height: 0.6, cuff: true }, hands: { type: 'gloves', cuff: 0.3 },
      tabard: { emblem: 'cross', back: true, top: 'chest' }, extras: [{ type: 'hipchain' }] });
    if (t === 1) return preset({ armor: 'plate', tier: 1, colors: { primary: 0x9aa2ae, secondary: 0x2a4a9a, trim: 0xd0a040, pants: 0x8a909a, boots: 0x9aa2ae, tabard: 0xe2dccb, cape: 0xe0dacb, capeInner: 0x24428a, emblem: 0xd8a838, gem: 0x80c8ff, belt: 0x5a4028 },
      chest: { type: 'plate', sleeves: 1.3, neck: 'high' }, shoulders: { type: 'round', size: f ? 1.12 : 1.28, layers: 2, gem: true },
      belt: { type: 'plate', buckle: 'gem' }, legs: { type: 'plate', kneepads: true }, feet: { type: 'plate', height: 0.75, cuff: true },
      hands: { type: 'gauntlets', cuff: 0.45 }, tabard: { emblem: 'sun', back: true, short: true, hw: 0.1, hem: 'v' }, cloak: { len: f ? 0.88 : 0.92, trim: true, emblem: 'sun' },
      cuirass: { style: 'plate', neck: 'high', lames: 2, ridge: true }, tassets: { rows: 2 }, greaves: { from: 1.1, to: 1.95 }, vambraces: { from: 1.3, to: 1.92 },
      head: f ? { type: 'circlet', gem: true } : null, extras: [{ type: 'hipchain' }] });
    return preset({ armor: 'plate', tier: 2, runes: true, colors: { ...LEGION, primary: 0x2e2c30, tabard: 0x4a0c0c, cape: 0x1e1a1e, capeInner: 0x5a0e0e, gem: 0xff3020 },
      chest: { type: 'plate', sleeves: 1.35, neck: 'high' }, shoulders: { type: 'round', size: f ? 1.2 : 1.36, layers: 3, horns: true, gem: true, glowTrim: true },
      belt: { type: 'plate', buckle: 'skull' }, legs: { type: 'plate', kneepads: true }, feet: { type: 'plate', height: 0.8, cuff: true },
      hands: { type: 'gauntlets', cuff: 0.5, glowTrim: true }, tabard: { back: true, short: true, hw: 0.1, tatter: true }, cloak: { len: 0.92, trim: true, emblem: 'skull', glowTrim: true, hem: 'v' },
      cuirass: { style: 'plate', neck: 'high', lames: 3, rivets: true }, tassets: { rows: 3, spikes: true }, greaves: { from: 1.08, to: 1.95 }, vambraces: { from: 1.25, to: 1.92 },
      head: f ? { type: 'circlet', gem: true } : null, extras: [{ type: 'hipchain' }] });
  },
  stormfist: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0xcab89a, secondary: 0x7a5a3a, trim: 0x8a6a44, pants: 0x5a4a3a, boots: 0x4a3424, sash: 0x7a3a24, gloves: 0x6a6258, belt: 0x5a3a24 }
      : t === 1 ? { primary: 0xe6e2d8, secondary: 0x2a64b0, trim: 0xc89a40, pants: 0x223250, boots: 0x2a2a30, sash: 0xc0201c, gloves: 0x7c848e, belt: 0x223250, linen: 0x3a3a44 }
        : { ...LEGION, primary: 0x2a2428, secondary: 0x5a0e0e, sash: 0x8a0e0e, gloves: 0x2e2e36, pants: 0x1c1a1e };
    return preset({ armor: 'cloth', tier: t, runes: t === 2, colors,
      chest: { type: 'gi', sleeves: 0.3, neck: 'v', open: !f }, belt: { type: 'sash', buckle: t >= 1 ? 'plate' : 'none' },
      cuirass: { style: 'gi', neck: f ? 'v' : 'deepv', low: -0.04, rimSlot: SLOT.CLOTH2, armhole: 0.1 }, pants: { full: 0.034, to: 0.55 },
      legs: { type: 'pants' }, feet: { type: 'wraps', height: 0.45 }, hands: { type: 'gauntlets', cuff: 0.62 },
      shoulders: t >= 1 ? { type: 'leather', size: 0.85, layers: 1, side: 'L', spikes: t === 2 ? 2 : 0 } : null,
      extras: [{ type: 'headband', plate: t >= 1, len: 0.6 }, { type: 'tails', list: [{ a: 2.3, len: 0.62, w: 0.085, knot: true }, { a: 2.55, len: 0.5, w: 0.07 }] }, { type: 'gauntlets', size: t === 0 ? 0.8 : 1.1, runes: t === 2 }] });
  },
  pistoleer: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0x6a4a30, secondary: 0x8a7050, trim: 0x8a7050, coat: 0x6a4a30, coat2: 0x3a2a1c, pants: 0x4a3a2a, boots: 0x3a2a1c, shirt: 0xd8ccb0, sash: 0x5a3a24, belt: 0x3a2618, feather: 0xd8ccb0 }
      : t === 1 ? { primary: 0x1e3a48, secondary: 0x8a1c24, trim: 0xd0a050, coat: 0x1e3a48, coat2: 0x2c1e18, pants: 0x3a2c22, boots: 0x2a1e18, shirt: 0xeae2cc, sash: 0x8a1c24, belt: 0x3a2618, feather: 0xf2eee4 }
        : { ...LEGION, coat: 0x1e1c20, coat2: 0x1a1414, shirt: 0x4a1010, sash: 0x8a0e0e, feather: 0x1a1a1a, pants: 0x1e1a1a };
    return preset({ armor: 'leather', tier: t, coatLeather: true, runes: t === 2, colors,
      chest: { type: 'leather', sleeves: 1.85, neck: 'high', straps: false, coat: true }, belt: { type: 'leather', buckle: t >= 1 ? 'plate' : 'square', pouches: 2 },
      cuirass: { style: 'leather', neck: 'v', slot: SLOT.COAT, rimSlot: t >= 1 ? SLOT.TRIM : SLOT.COAT2, rimW: 0.03, armhole: 0.1 },
      legs: { type: 'leather' }, feet: { type: 'boots', height: 0.8, cuff: true }, hands: { type: 'gloves', cuff: 0.35 },
      extras: [{ type: 'coat', len: f ? 0.62 : 0.72, open: 0.42, slit: 0.25, trim: t >= 1, slot: SLOT.COAT }, { type: 'collar', h: 0.12, flare: 0.06, open: 0.9, trim: t >= 1 },
        { type: 'hat', brim: f ? 0.14 : 0.16, feather: true }, { type: 'bandolier' }] });
  },
  starcaller: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0x3a4a7a, secondary: 0x6a7aa0, trim: 0xb8b0a0, pants: 0x2a3050, boots: 0x3a2a2a, cape: 0x3a4a7a, capeInner: 0x2a3050, belt: 0x4a3a2a, gem: 0x80c0ff }
      : t === 1 ? { primary: 0x2a2660, secondary: 0x6a3aa8, trim: 0xd8dcee, pants: 0x221e48, boots: 0x221e48, cape: 0x2a2660, capeInner: 0x6a3aa8, coat: 0x2a2660, belt: 0x6a3aa8, gem: 0x70e8ff, emblem: 0xd8dcee }
        : { ...LEGION, primary: 0x221c2a, secondary: 0x4a0e18, coat: 0x221c2a, cape: 0x1a141e, capeInner: 0x4a0e18, gem: 0xff3020 };
    return preset({ armor: 'cloth', tier: t, runes: t === 2, colors,
      chest: { type: 'robe', sleeves: f ? 1.0 : 1.95, neck: 'high' }, belt: { type: 'sash', buckle: t >= 1 ? 'gem' : 'none' },
      cuirass: { style: f ? 'corset' : 'cloth', neck: f ? 'v' : 'high', slot: SLOT.CLOTH1, rimSlot: t >= 1 ? SLOT.TRIM : SLOT.CLOTH2, armhole: 0.095 },
      skirt: f ? null : { len: 1.0, flare: 0.16, panel: true, hemTrim: t >= 1 }, legs: { type: 'pants' }, feet: { type: 'boots', height: f ? 0.95 : 0.6, cuff: t >= 1 },
      hands: f ? { type: 'gloves', cuff: 0.9 } : null,
      shoulders: t >= 1 ? { type: 'round', size: 0.8, layers: 1, gem: true, horns: t === 2 } : null,
      cloak: t >= 1 ? { len: f ? 0.5 : 0.62, trim: true, emblem: 'star' } : null,
      head: f && t >= 1 ? { type: 'circlet', gem: true } : null,
      accent: t < 2 ? 0x6ae0ff : null,
      extras: [{ type: 'collar', h: 0.17, flare: 0.08, open: 0.62, trim: t >= 1, slot: SLOT.CLOTH2 }, f ? { type: 'coat', len: 0.98, open: 0.3, trim: t >= 1, slot: SLOT.CLOTH1, flare: 0.2 } : { type: 'coat', len: 0.92, open: 0.42, trim: t >= 1, slot: SLOT.CLOTH2, flare: 0.18, top: -0.12 }] });
  },
  songweaver: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0x5a7a4a, secondary: 0xc8b890, trim: 0xb89a60, pants: 0x4a4a3a, boots: 0x5a4028, ribbon: 0xc88a3a, cape: 0x6a4a30, belt: 0x5a4028 }
      : t === 1 ? { primary: 0xf2ece0, secondary: 0xd8688c, trim: 0xe8c068, pants: 0xe8e2d4, boots: 0xe8e0d0, ribbon: 0xe0708e, cape: 0xf4eee2, capeInner: 0xd8688c, belt: 0xd8688c, gem: 0xff9ad8 }
        : { ...LEGION, primary: 0x2a2226, secondary: 0x5a0e1e, ribbon: 0x8a0e1e, cape: 0x1e181c, capeInner: 0x5a0e1e, gem: 0xff3020 };
    return preset({ armor: 'cloth', tier: t, runes: t === 2, colors,
      chest: { type: f ? 'robe' : 'leather', sleeves: f ? 0.55 : 1.9, neck: f ? 'v' : 'high', coat: !f }, belt: { type: 'sash', buckle: t >= 1 ? 'gem' : 'none' },
      cuirass: { style: f ? 'corset' : 'leather', neck: f ? 'v' : 'v', slot: f ? SLOT.CLOTH1 : SLOT.COAT, rimSlot: t >= 1 ? SLOT.TRIM : SLOT.CLOTH2, armhole: 0.095, rimW: f ? 0.022 : 0.03 },
      skirt: f ? { len: 1.0, flare: 0.28, hemTrim: t >= 1 } : null, legs: { type: f ? 'pants' : 'leather' }, feet: { type: f ? 'shoes' : 'boots', height: f ? 0.3 : 0.7, cuff: !f },
      shoulders: t >= 1 ? { type: 'round', size: 0.7, layers: 0, gem: true, horns: t === 2 } : null,
      cloak: t >= 1 ? { len: 0.34, trim: true } : null,
      head: f && t >= 1 ? { type: 'circlet', gem: true } : null,
      accent: t < 2 ? 0xff9ad8 : null,
      extras: [{ type: 'tails', slot: SLOT.RIBBON, list: [{ a: 3.0, len: f ? 0.9 : 0.8, w: 0.06, knot: true, out: 0.14 }, { a: 3.3, len: f ? 0.78 : 0.7, w: 0.05, out: 0.12 }, { a: -0.5, len: 0.5, w: 0.045 }] },
        ...(f ? [] : [{ type: 'coat', len: 0.8, open: 0.45, trim: t >= 1, slot: SLOT.CLOTH2, flare: 0.14, top: -0.12 }, { type: 'collar', h: 0.12, flare: 0.05, open: 0.8, trim: t >= 1, slot: SLOT.CLOTH2 }])] });
  },
  bladedancer: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0x4a3a30, secondary: 0x5a5a5a, trim: 0x8a8a8a, pants: 0x3a302a, boots: 0x2a221e, hood: 0x3a3632, sash: 0x6a6a6a, belt: 0x2a221e }
      : t === 1 ? { primary: 0x1c1c22, secondary: 0x14706e, trim: 0xb8c4cc, pants: 0x18181e, boots: 0x18181c, hood: 0x1c1c22, sash: 0x1a8a88, belt: 0x2a2a30, gem: 0x40ffd8 }
        : { ...LEGION, primary: 0x1a181c, hood: 0x1a181c, sash: 0x6a0c0c, gem: 0xff3020 };
    return preset({ armor: 'leather', tier: t, runes: t === 2, colors,
      chest: { type: 'leather', sleeves: 1.9, neck: 'high', straps: true }, belt: { type: 'leather', buckle: 'plate', pouches: 2 },
      cuirass: { style: 'leather', neck: 'high', rimSlot: t < 2 ? SLOT.RUNE : SLOT.TRIM, rimW: 0.016, armhole: 0.105 }, vambraces: { from: 1.3, to: 1.9 }, greaves: { from: 1.15, to: 1.9, front: true },
      accent: t < 2 ? 0x30ffd8 : null,
      legs: { type: 'leather', kneepads: t >= 1 }, feet: { type: 'boots', height: 0.85, cuff: true }, hands: { type: 'gloves', cuff: 0.4 },
      shoulders: { type: 'leather', size: 0.9, layers: 2, side: 'L', spikes: t === 2 ? 2 : 1 },
      head: f ? { type: 'none', mask: true } : { type: 'hood', mask: true },
      extras: [{ type: 'scarf', len: 0.62, tw: 0.08 }, { type: 'tails', list: [{ a: 2.0, len: 0.45, w: 0.06 }, { a: -2.0, len: 0.42, w: 0.06 }] }, { type: 'bandolier' }] });
  },
  demonbound: (t, sex) => {
    const f = sex === 'f';
    const colors = t === 0 ? { primary: 0x3a3028, secondary: 0x4a2a3a, trim: 0x6a6a6a, pants: 0x2a2420, boots: 0x2a221e, sash: 0x3a2a30, chain: 0x8a8a90, belt: 0x2a2020 }
      : t === 1 ? { primary: 0x2a2430, secondary: 0x4e1a50, trim: 0x9aa0b0, pants: 0x1e1a22, boots: 0x1e1a22, sash: 0x3a1440, chain: 0xa8aebc, belt: 0x241e28, gem: 0xc040ff }
        : { ...LEGION, primary: 0x1e1a20, sash: 0x3a0c0c, chain: 0x6a6a70 };
    return preset({ armor: 'leather', tier: t, runes: t === 2, colors,
      chest: { type: 'leather', sleeves: f ? 0.6 : 0.4, neck: 'v', straps: true }, belt: { type: 'leather', buckle: 'skull', pouches: 1 },
      cuirass: { style: 'leather', neck: f ? 'v' : 'deepv', rimSlot: SLOT.CHAIN, rimW: 0.016, armhole: 0.11 },
      legs: { type: 'leather', kneepads: true }, feet: { type: 'boots', height: 0.8, cuff: true }, hands: { type: 'bracers', cuff: 0.4 },
      shoulders: { type: 'plate', size: 1.05, layers: 2, side: 'L', spikes: 3, horns: t === 2 },
      extras: [{ type: 'chains', chest: true, hang: true }, { type: 'coat', len: 0.8, open: 0.55, tatter: true, slot: SLOT.SASH, flare: 0.1 }, { type: 'collar', h: 0.15, flare: 0.07, open: 0.9, slot: SLOT.SASH }] });
  },
});

// ---------------------------------------------------------------------------------------------
// NPC outfits: NPC_OUTFITS[npc](sex, v) → gear spec; v (a small integer) varies colours between townsfolk.
const pick = (arr, v, k = 0) => arr[((v | 0) * 7 + k * 3) % arr.length];
export const NPC_OUTFITS = {
  guard: (sex, v) => preset({ armor: 'mail', tier: 1, colors: { primary: 0x767c86, secondary: 0x24407a, trim: 0xc8a048, pants: 0x3a3a44, boots: 0x3a2a1e, tabard: 0x24407a, emblem: 0xd8b050, belt: 0x4a3020, gloves: 0x4a3424 },
    chest: { type: 'mail', sleeves: 1.25, neck: 'crew' }, shoulders: { type: 'round', size: 0.92, layers: 1 }, belt: { type: 'leather', buckle: 'square' },
    legs: { type: 'pants' }, feet: { type: 'boots', height: 0.7, cuff: true }, hands: { type: 'gloves', cuff: 0.3 },
    tabard: { emblem: 'sun', back: true, top: 'chest', hw: 0.1 }, head: { type: 'helm' } }),
  knight: (sex, v) => preset({ armor: 'plate', tier: 1, colors: { primary: 0x6e7682, secondary: 0x1e3c7a, trim: 0xc8a048, pants: 0x3a3e46, boots: 0x6e7682, tabard: 0x1e3c7a, cape: 0x1e3c7a, capeInner: 0xd8d0bc, emblem: 0xe0b850, belt: 0x3a2a1c },
    chest: { type: 'plate', sleeves: 1.3, neck: 'high' }, shoulders: { type: 'round', size: sex === 'f' ? 1.05 : 1.15, layers: 2 },
    belt: { type: 'plate', buckle: 'plate' }, legs: { type: 'plate', kneepads: true }, feet: { type: 'plate', height: 0.75, cuff: true },
    hands: { type: 'gauntlets', cuff: 0.45 }, tabard: { emblem: 'shield', back: true, short: true, hw: 0.1 }, cloak: { len: 0.85, trim: true },
    cuirass: { style: 'plate', neck: 'round', lames: 2, ridge: true }, tassets: { rows: 2 }, greaves: { from: 1.1, to: 1.95 }, vambraces: { from: 1.3, to: 1.92 } }),
  noble: (sex, v) => {
    const f = sex === 'f', c = pick([[0x5a1a2a, 0xd8b050], [0x1a3a5a, 0xc8ccd6], [0x24482a, 0xd8b050], [0x3a1a4a, 0xd8b050]], v);
    return preset({ armor: 'cloth', tier: 1, colors: { primary: c[0], secondary: 0xe8e0d0, trim: c[1], pants: 0x2a2226, boots: 0x2a1e18, coat: c[0], coat2: 0x1e1a1c, shirt: 0xeee6d6, sash: c[0], belt: 0x2a1e18, gem: 0xd04050 },
      chest: f ? { type: 'robe', sleeves: 1.6, neck: 'v' } : { type: 'leather', sleeves: 1.85, neck: 'high', coat: true },
      skirt: f ? { len: 1.0, flare: 0.3, hemTrim: true } : null,
      belt: { type: 'leather', buckle: 'gem' }, legs: { type: 'pants' }, feet: { type: f ? 'shoes' : 'boots', height: f ? 0.3 : 0.7, cuff: !f },
      cuirass: { style: f ? 'corset' : 'leather', neck: f ? 'v' : 'high', slot: f ? SLOT.CLOTH1 : SLOT.COAT, rimSlot: SLOT.TRIM, armhole: 0.095, rimW: 0.02 },
      head: f ? { type: 'circlet', gem: true } : null,
      extras: [{ type: 'collar', h: 0.1, flare: 0.045, open: 0.7, trim: true, slot: SLOT.CLOTH2 }, ...(f ? [] : [{ type: 'coat', len: 0.72, open: 0.4, trim: true, slot: SLOT.COAT }])] });
  },
  king: (sex, v) => preset({ armor: 'cloth', tier: 1, colors: { primary: 0x7a1420, secondary: 0xe8d8b0, trim: 0xe0b040, pants: 0x3a1a1e, boots: 0x3a2418, cape: 0x8a1420, capeInner: 0xece4d4, emblem: 0xe0b040, belt: 0xe0b040, gem: 0x3a8aff, sash: 0x7a1420, fur: 0xeee6da },
    chest: { type: 'robe', sleeves: 1.8, neck: 'high' }, skirt: { len: 1.0, flare: 0.2, hemTrim: true, panel: true }, belt: { type: 'sash', buckle: 'gem' },
    cuirass: { style: 'cloth', neck: 'high', slot: SLOT.CLOTH1, rimSlot: SLOT.TRIM, armhole: 0.095 },
    legs: { type: 'pants' }, feet: { type: 'boots', height: 0.6, cuff: true }, cloak: { len: 0.96, trim: true, emblem: 'sun' },
    shoulders: { type: 'fur', size: 1.05, layers: 1 }, head: { type: 'crown', gem: true } }),
  oracle: (sex, v) => preset({ armor: 'cloth', tier: 1, colors: { primary: 0xeef0f4, secondary: 0x3a6ac0, trim: 0xc8d8f0, pants: 0xe0e4ec, boots: 0xe8ecf2, cape: 0x3a6ac0, capeInner: 0xeef0f4, sash: 0x3a6ac0, belt: 0x3a6ac0, gem: 0x80d0ff, emblem: 0x9ac8ff, hood: 0xeef0f4 },
    chest: { type: 'robe', sleeves: sex === 'f' ? 1.2 : 1.9, neck: 'high' }, skirt: { len: 1.0, flare: 0.22, hemTrim: true },
    cuirass: { style: sex === 'f' ? 'corset' : 'cloth', neck: 'v', slot: SLOT.CLOTH1, rimSlot: SLOT.TRIM, armhole: 0.095 },
    belt: { type: 'sash', buckle: 'gem' }, legs: { type: 'pants' }, feet: { type: 'shoes', height: 0.3 }, hands: sex === 'f' ? { type: 'gloves', cuff: 0.8 } : null,
    cloak: { len: 0.6, trim: true, emblem: 'star' }, head: { type: 'circlet', gem: true }, accent: 0x80d0ff,
    extras: [{ type: 'collar', h: 0.11, flare: 0.045, open: 0.6, trim: true, slot: SLOT.CLOTH2 }] }),
  merchant: (sex, v) => {
    const c = pick([0x2a6a4a, 0x8a4a1a, 0x6a2a5a, 0x2a4a7a], v);
    return preset({ armor: 'cloth', tier: 0, colors: { primary: c, secondary: 0xd8c8a0, trim: 0xc89a48, pants: 0x4a3a2a, boots: 0x3a2a1c, shirt: 0xe8dcc0, sash: 0xb08a3a, belt: 0x4a3020, feather: 0xc83a3a },
      chest: { type: 'tunic', sleeves: 1.8, neck: 'v', vdepth: 0.08 }, belt: { type: 'leather', buckle: 'square', pouches: 3 }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.5, cuff: true },
      skirt: sex === 'f' ? { len: 0.95, flare: 0.25 } : null,
      extras: [{ type: 'hat', brim: 0.11, feather: true }] });
  },
  blacksmith: (sex, v) => preset({ armor: 'leather', tier: 0, colors: { primary: 0x6a625a, secondary: 0x5a3a24, trim: 0x8a8a8a, pants: 0x3a3230, boots: 0x2a2220, tabard: 0x5a3a22, gloves: 0x4a3022, belt: 0x3a2618, shirt: 0x6a625a },
    chest: { type: 'shirt', sleeves: 0.5, neck: 'v' }, belt: { type: 'leather', buckle: 'square', pouches: 1 }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.6, cuff: true },
    hands: { type: 'gloves', cuff: 0.5 }, apron: true }),
  sailor: (sex, v) => preset({ armor: 'cloth', tier: 0, colors: { primary: pick([0xe8e4dc, 0xc8d4e0, 0xe0d8c0], v), secondary: 0x2a4a7a, trim: 0x2a4a7a, pants: 0x2a3a5a, boots: 0x2a2220, sash: pick([0xb02a2a, 0x2a4a8a, 0xd8a030], v, 1), shirt: 0xe8e4dc, belt: 0x3a2618, hood: pick([0xb02a2a, 0x2a4a8a], v, 2) },
    chest: { type: 'shirt', sleeves: 1.15, neck: 'v' }, belt: { type: 'sash', buckle: 'none' }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.45 },
    head: { type: 'bandana' }, extras: [{ type: 'scarf', len: 0.22, tw: 0.05, w: 0.03 }] }),
  pirate: (sex, v) => preset({ armor: 'leather', tier: 1, coatLeather: true, colors: { primary: 0x6a1616, secondary: 0x1a1a1a, trim: 0xc89a40, coat: 0x6a1616, coat2: 0x1e1614, pants: 0x2a2220, boots: 0x1e1614, shirt: 0xe8dcc8, sash: 0x2a2a2a, belt: 0x2a1e16, hood: 0x2a2a2a, gloves: 0x2a1e16 },
    chest: { type: 'leather', sleeves: 1.85, neck: 'v', coat: true }, belt: { type: 'sash', buckle: 'none' },
    cuirass: { style: 'leather', neck: 'deepv', slot: SLOT.COAT, rimSlot: SLOT.TRIM, rimW: 0.024, armhole: 0.1 },
    legs: { type: 'leather' }, feet: { type: 'boots', height: 0.85, cuff: true }, hands: { type: 'gloves', cuff: 0.3 }, head: { type: 'bandana' },
    extras: [{ type: 'coat', len: 0.58, open: 0.5, slit: 0.25, trim: true, slot: SLOT.COAT, tatter: true }, { type: 'bandolier' }] }),
  bandit: (sex, v) => preset({ armor: 'leather', tier: 0, colors: { primary: 0x4a3a2c, secondary: 0xa01c1c, trim: 0x6a5a48, pants: 0x3a3028, boots: 0x2a221c, hood: pick([0x3a322a, 0x4a2a22, 0x2e2a26], v), sash: 0xa81c1c, belt: 0x2a1e16 },
    chest: { type: 'leather', sleeves: 0.6, neck: 'crew', straps: true }, belt: { type: 'leather', buckle: 'square', pouches: 2 },
    legs: { type: 'leather' }, feet: { type: 'boots', height: 0.7, cuff: true }, hands: { type: 'bracers', cuff: 0.4 },
    shoulders: { type: 'leather', size: 0.9, layers: 1, side: 'L' }, head: { type: 'hood', mask: true },
    extras: [{ type: 'scarf', len: 0.5, tw: 0.075, w: 0.042 }] }),
  cultist: (sex, v) => preset({ armor: 'cloth', tier: 1, colors: { primary: 0x1e1a1e, secondary: 0x6a0e14, trim: 0x8a7a5a, pants: 0x1a1618, boots: 0x1a1618, hood: 0x2a2226, sash: 0x6a0e14, belt: 0x3a2a1a, tabard: 0x5a0c12, emblem: 0xb02020 },
    chest: { type: 'robe', sleeves: 1.9, neck: 'high' }, skirt: { len: 1.0, flare: 0.16 }, belt: { type: 'rope' },
    legs: { type: 'pants' }, feet: { type: 'boots', height: 0.5 }, head: { type: 'hood', mask: true }, accent: 0xff3020,
    tabard: { emblem: 'skull', hw: 0.075, tatter: true, top: 'chest', trim: false } }),
  priest: (sex, v) => preset({ armor: 'cloth', tier: 1, colors: { primary: 0xece6d8, secondary: 0xc89a3a, trim: 0xd8b050, pants: 0xd8d0c0, boots: 0x6a5a48, tabard: 0xc8a040, emblem: 0xf0e0b0, sash: 0xc8a040, belt: 0xc8a040 },
    chest: { type: 'robe', sleeves: 1.9, neck: 'high' }, skirt: { len: 1.0, flare: 0.14, hemTrim: true }, belt: { type: 'sash', buckle: 'none' },
    legs: { type: 'pants' }, feet: { type: 'shoes', height: 0.3 }, tabard: { emblem: 'sun', hw: 0.06, top: 'chest', trim: true } }),
  bard: (sex, v) => {
    const c = pick([[0x2a7a7a, 0xe08a2a], [0x7a2a6a, 0xe0c040], [0x3a5aa0, 0xe05a3a]], v);
    return preset({ armor: 'cloth', tier: 1, colors: { primary: c[0], secondary: c[1], trim: 0xe0c060, pants: 0x3a2a3a, boots: 0x5a3a24, cape: c[1], capeInner: c[0], shirt: 0xeee6d4, sash: c[1], belt: 0x5a3a24, feather: c[1] },
      chest: { type: 'tunic', sleeves: 1.9, neck: 'v', vdepth: 0.09 }, belt: { type: 'leather', buckle: 'square', pouches: 1 }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.75, cuff: true },
      skirt: sex === 'f' ? { len: 0.8, flare: 0.3, hemTrim: true } : null,
      cloak: { len: 0.36, trim: true }, extras: [{ type: 'hat', brim: 0.07, feather: true }] });
  },
  farmer: (sex, v) => preset({ armor: 'cloth', tier: 0, colors: { primary: pick([0xd8cca8, 0xa8b890, 0xc8a078], v), secondary: 0x6a5238, trim: 0x8a6a48, pants: pick([0x5a4a38, 0x4a5a6a], v, 1), boots: 0x4a3424, shirt: 0xd8cca8, belt: 0x5a4028, tabard: 0xd8d0b8 },
    chest: { type: 'shirt', sleeves: 0.9, neck: 'crew' }, belt: { type: 'rope' }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.45 }, head: { type: 'straw' },
    ...(sex === 'f' ? { apron: true, skirt: { len: 0.9, flare: 0.25 } } : {}) }),
  fisher: (sex, v) => preset({ armor: 'cloth', tier: 0, colors: { primary: 0x5a6a5a, secondary: 0x3a4a5a, trim: 0x8a7a5a, pants: 0x3a4250, boots: 0x2a2a2a, shirt: 0xc8c0a8, belt: 0x4a3a2a, hood: pick([0x6a7a5a, 0x8a6a3a, 0x3a4a6a], v), sash: 0x5a6a7a },
    chest: { type: 'vest', sleeves: 1.0, neck: 'v' }, belt: { type: 'leather', buckle: 'square', pouches: 1 }, legs: { type: 'pants' }, feet: { type: 'boots', height: 0.85 },
    head: { type: 'cap' } }),
  villager: (sex, v) => preset({ armor: 'cloth', colors: { primary: pick([0xd8cca8, 0x8aa0b8, 0xb89a78, 0x9ab08a, 0xc88a7a, 0xa89ac0], v), secondary: 0x8a6a48, trim: 0x8a6a48, pants: pick([0x6a5238, 0x4a4a58, 0x5a4a3a], v, 1), boots: 0x4a3424, belt: 0x5a4028 },
    chest: { type: sex === 'f' ? 'tunic' : 'shirt', sleeves: 1.2, neck: v % 2 ? 'crew' : 'v', vdepth: 0.07 }, belt: { type: 'leather', buckle: 'square' }, legs: { type: 'pants' }, feet: { type: 'shoes', height: 0.3 },
    skirt: sex === 'f' ? { len: 0.92, flare: 0.22 } : null, apron: sex === 'f' && (v % 2 === 0) }),
  child: (sex, v) => preset({ armor: 'cloth', colors: { primary: pick([0xc85a4a, 0x4a8ac8, 0x6aa84a, 0xe0b040], v), secondary: 0x8a6a48, trim: 0x8a6a48, pants: 0x5a4a3a, boots: 0x4a3424, shirt: 0xe8dcc0, belt: 0x6a4a30 },
    chest: { type: 'tunic', sleeves: 1.0, neck: 'crew' }, belt: { type: 'rope' }, legs: { type: 'pants' }, feet: { type: 'shoes', height: 0.3 },
    skirt: sex === 'f' ? { len: 0.7, flare: 0.3 } : null }),
};

// Named characters (story NPCs): an NPC outfit + a fixed look (+ optional colour overrides)
export const NPC_PRESETS = {
  brannoc: { npc: 'knight', sex: 'm', look: { face: 4, hair: 1, hairColor: 0x8c8882, skin: 2, eyes: 0x5a7a9a, height: 1.05, build: 0.9, beard: 2 },
    colors: { primary: 0x646c78, boots: 0x646c78, secondary: 0x1a3470, tabard: 0x1a3470, cape: 0x1a3470, capeInner: 0x2a2420, trim: 0xb89040, emblem: 0xe0b850 }, emblem: 'sun' },
  seraphine: { npc: 'oracle', sex: 'f', look: { face: 5, hair: 0, hairColor: 0xeee8f2, skin: 0, eyes: 0x4ab0f0, height: 0.97, build: 0.15 },
    colors: { primary: 0xf4f4f8, secondary: 0x2a64c8, cape: 0x2a64c8, capeInner: 0xf4f4f8, sash: 0x2a64c8, trim: 0xcadcf6, gem: 0x6ad0ff } },
};

/** Resolve { cls, npc, tier, sex, dye } → a fresh gear spec. A spec object may also be passed directly. */
export function resolveGear(o = {}) {
  let g;
  if (o.spec) g = o.spec;
  else if (o.npc) {
    const pr = NPC_PRESETS[o.npc];
    g = (NPC_OUTFITS[pr ? pr.npc : o.npc] || NPC_OUTFITS.villager)(o.sex || 'm', o.variant | 0);
    if (pr) { g.colors = { ...g.colors, ...(pr.colors || {}) }; if (pr.emblem) { if (g.tabard) g.tabard.emblem = pr.emblem; if (g.cloak) g.cloak.emblem = pr.emblem; } }
  }
  else g = (CLASS_OUTFITS[o.cls] || CLASS_OUTFITS.reaver)(clamp(o.tier ?? 1, 0, 2) | 0, o.sex || 'm');
  g = JSON.parse(JSON.stringify(g));
  if (o.dye) { // [primary, secondary, trim]
    const [a, b, c] = o.dye;
    const col = g.colors;
    if (a != null) { col.primary = a; if (col.boots != null && g.feet?.type === 'plate') col.boots = a; if (col.coat != null) col.coat = a; }
    if (b != null) { col.secondary = b; if (col.tabard != null) col.tabard = b; if (col.cape != null) col.cape = b; if (col.sash != null) col.sash = b; }
    if (c != null) { col.trim = c; col.emblem = c; }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Palette
const mat = (hex, spec, det, emis = 0) => ({ c: linColor(hex), spec, det, emis, cast: 0 });
export function buildPalette(g, app) {
  const col = g.colors || {};
  const pal = new Array(NSLOT);
  const armorDet = { plate: DET.plate, mail: DET.mail, leather: DET.leather, cloth: DET.cloth }[g.armor] || DET.cloth;
  const armorSpec = { plate: 0.85, mail: 0.55, leather: 0.1, cloth: 0.0 }[g.armor] ?? 0;
  const prim = col.primary ?? 0x888888;
  for (let i = 0; i < NSLOT; i++) pal[i] = mat(0x808080, 0, DET.none);
  pal[SLOT.SKIN] = mat(app.skin, 0.05, DET.skin);
  pal[SLOT.HAIR] = mat(app.hairColor, 0.18, DET.hair);
  pal[SLOT.LEATHER] = mat(col.leather ?? C.leather, 0.12, DET.leather);
  pal[SLOT.CLOTH1] = mat(col.primary ?? 0x8a8a8a, 0.0, DET.cloth);
  pal[SLOT.CLOTH2] = mat(col.secondary ?? 0x5a5a5a, 0.0, DET.cloth);
  pal[SLOT.ARMOR1] = mat(prim, armorSpec, armorDet);
  pal[SLOT.ARMOR2] = mat(col.secondary ?? C.leather, g.armor === 'plate' ? 0.5 : 0.1, g.armor === 'plate' ? DET.plate : DET.leather);
  pal[SLOT.TRIM] = mat(col.trim ?? C.gold, 1.0, DET.plate, 0);
  pal[SLOT.METAL] = mat(col.metal ?? C.iron, 0.9, DET.plate);
  pal[SLOT.GEM] = mat(col.gem ?? g.glow ?? 0x60a0ff, 1.0, DET.none, 0.9);
  pal[SLOT.WOOD] = mat(C.wood, 0.05, DET.wood);
  pal[SLOT.DARK] = mat(0x1a1614, 0.1, DET.none);
  pal[SLOT.FUR] = mat(col.fur ?? C.fur, 0.0, DET.fur);
  pal[SLOT.BONE] = mat(0xe8dcc0, 0.25, DET.none);
  pal[SLOT.GLOW] = mat(g.glow ?? 0xffc060, 0, DET.none, 1);
  pal[SLOT.CAPE1] = mat(col.cape ?? col.secondary ?? prim, 0.0, DET.cloth);
  pal[SLOT.CAPE2] = mat(col.capeInner ?? 0x2a2a2a, 0.0, DET.cloth);
  pal[SLOT.EMBLEM] = mat(col.emblem ?? col.trim ?? C.gold, 0.8, DET.none, g.tier >= 3 ? 0.25 : 0);
  pal[SLOT.BELT] = mat(col.belt ?? (g.armor === 'plate' ? C.darkLeather : C.darkLeather), 0.15, DET.leather);
  pal[SLOT.BOOT] = mat(col.boots ?? C.darkLeather, g.feet?.type === 'plate' ? 0.8 : 0.12, g.feet?.type === 'plate' ? DET.plate : DET.leather);
  pal[SLOT.GLOVE] = mat(col.gloves ?? (g.hands?.type === 'gauntlets' ? prim : C.leather), g.hands?.type === 'gauntlets' ? armorSpec : 0.12, g.hands?.type === 'gauntlets' ? armorDet : DET.leather);
  pal[SLOT.PANTS] = mat(col.pants ?? 0x5a4a3a, g.legs?.type === 'plate' ? 0.8 : g.legs?.type === 'mail' ? 0.5 : g.legs?.type === 'leather' ? 0.12 : 0,
    g.legs?.type === 'plate' ? DET.plate : g.legs?.type === 'mail' ? DET.mail : g.legs?.type === 'leather' ? DET.leather : DET.cloth);
  pal[SLOT.SHIRT] = mat(col.shirt ?? C.linen, 0, DET.cloth);
  pal[SLOT.TABARD] = mat(col.tabard ?? col.secondary ?? 0x2a4a8a, 0, DET.cloth);
  pal[SLOT.HOOD] = mat(col.hood ?? col.primary ?? 0x5a5a5a, 0, DET.cloth);
  pal[SLOT.STRAW] = mat(0xd8b860, 0.05, DET.wood);
  pal[SLOT.LINEN] = mat(col.linen ?? 0xb8a484, 0, DET.cloth);
  pal[SLOT.BLADE] = mat(0xc8d0d8, 1.0, DET.plate);
  pal[SLOT.HILT] = mat(C.darkLeather, 0.1, DET.leather);
  pal[SLOT.SKIN2] = mat(app.skin, 0.05, DET.skin);
  pal[SLOT.RUNE] = { ...mat(col.rune ?? 0x2a0806, 0.5, DET.none), rune: 1, cast: 0.5 };
  pal[SLOT.HORN] = mat(col.horn ?? 0xd0c4a8, 0.3, DET.none);
  pal[SLOT.CHAIN] = mat(col.chain ?? 0x9aa0a8, 0.9, DET.plate);
  pal[SLOT.RIBBON] = mat(col.ribbon ?? col.secondary ?? 0xd04a6a, 0.05, DET.cloth);
  pal[SLOT.FEATHER] = mat(col.feather ?? 0xe8e0d0, 0, DET.cloth);
  pal[SLOT.COAT] = mat(col.coat ?? col.primary ?? 0x4a3a2a, g.coatLeather ? 0.12 : 0, g.coatLeather ? DET.leather : DET.cloth);
  pal[SLOT.COAT2] = mat(col.coat2 ?? col.secondary ?? 0x2a2a2a, 0, DET.cloth);
  pal[SLOT.SASH] = mat(col.sash ?? col.secondary ?? 0xa02020, 0, DET.cloth);
  pal[SLOT.SCLERA] = mat(0xf4efe9, 0.9, DET.none);
  pal[SLOT.IRIS] = mat(app.eyes ?? 0x3a6ab0, 0.9, DET.none);
  pal[SLOT.LASH] = mat(0x140e0c, 0.1, DET.none);
  pal[SLOT.LIPS] = mat(app.skin, 0.2, DET.skin);
  // keep lit albedo below the bloom threshold under the strong sun (HDR pipeline): soft-cap bright colours
  for (let i = 0; i < NSLOT; i++) {
    if (i === SLOT.GEM || i === SLOT.GLOW || i === SLOT.RUNE || i === SLOT.SCLERA) continue;
    if (i === SLOT.SKIN || i === SLOT.SKIN2) { const c = pal[i].c; for (let k = 0; k < 3; k++) { const v = c[k]; c[k] = v < 0.55 ? v : 0.55 + (v - 0.55) * 0.5; } continue; }
    const c = pal[i].c;
    for (let k = 0; k < 3; k++) { const v = c[k]; c[k] = v < 0.34 ? v : 0.34 + (v - 0.34) * 0.32; }
  }
  return pal;
}

// ---------------------------------------------------------------------------------------------
// Body painting
const GARMENT_OFF = { cloth: 0.0045, shirt: 0.004, tunic: 0.006, robe: 0.006, rags: 0.004, vest: 0.007, leather: 0.008, mail: 0.01, plate: 0.015, pants: 0.004 };

/** returns per-piece overrides { body:{slot,mul,off}, head:{..., keepTri}, handL, handR } */
export function paintBody(base, g, pieces = base.pieces) {
  const J = base.JJ.J, P = base.P;
  const legScale = base.JJ.legLen / 0.87;
  const waistY = J.spine[1] - 0.03;
  const neckY = J.neck[1] - 0.025;
  const chest = g.chest || { type: 'shirt', sleeves: 1 };
  const ct = chest.type;
  const isRobe = ct === 'robe';
  const chestBottom = isRobe ? -1 : (ct === 'tunic' || ct === 'shirt' || ct === 'rags' || ct === 'gi') ? J.hips[1] - 0.06 * legScale : waistY - 0.035;
  const sleeves = chest.sleeves ?? 1;
  const bootTop = 2 - (g.feet?.height ?? 0.4) * 0.95;
  const gloveCuff = g.hands ? 2 - (g.hands.cuff ?? 0.3) : 9;
  const gloves = g.hands?.type;
  const neck = chest.neck || 'crew';
  const tier = g.tier || 0;
  const out = {};
  const armorSlot = chest.coat ? SLOT.COAT : ct === 'plate' || ct === 'mail' || ct === 'leather' ? SLOT.ARMOR1 : SLOT.CLOTH1;
  const sleeveType = chest.sleeveType || ct;
  const legType = g.legs?.type || 'pants';
  for (const key of ['body', 'handL', 'handR', 'head']) {
    const pc = pieces[key];
    const n = pc.n;
    const slot = new Uint8Array(pc.slot), mul = new Float32Array(pc.mul), off = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const ch = pc.chain[v], c = pc.coord[v], a = pc.ang[v];
      const x = pc.pos[v * 3], y = pc.pos[v * 3 + 1], z = pc.pos[v * 3 + 2];
      const ny = pc.nrm[v * 3 + 1];
      let s = SLOT.SKIN, o = 0, f = 1, tint = null;
      if (ch === CH_TORSO) {
        if (ct === 'gi' && y <= neckY + 0.03 && y > chestBottom) { // crossed lapels (left over right), trimmed; open V on males
          const front = Math.cos(a) > 0.1;
          const yV = J.chest[1] - 0.03;
          let edge = 9, skin = false;
          if (front) {
            if (y > yV) { const w = (y - yV) * 0.55; if (chest.open) { edge = Math.abs(Math.abs(x) - w); skin = Math.abs(x) < w - 0.022; } else edge = Math.abs(x + w); }
            else if (x > -0.03) edge = Math.abs(x - (yV - y) * 0.75);
          }
          if (!skin) {
            const sg = edge < 0.024 ? SLOT.CLOTH2 : SLOT.CLOTH1;
            const ff = (0.9 + 0.1 * ny + 0.07 * Math.sin(a * 5 + y * 14)) * (1 + NZ.noise2(x * 7.3 + z * 3.1, y * 5.7) * 0.06) * (edge < 0.03 && edge > 0.024 ? 0.8 : 1);
            slot[v] = sg; off[v] = 0.007;
            const avg = (mul[v * 3] + mul[v * 3 + 1] + mul[v * 3 + 2]) / 3;
            mul[v * 3] = lerp(mul[v * 3], avg, 0.8) * ff; mul[v * 3 + 1] = lerp(mul[v * 3 + 1], avg, 0.8) * ff; mul[v * 3 + 2] = lerp(mul[v * 3 + 2], avg, 0.8) * ff;
          }
          continue;
        }
        const vd = neck === 'v' ? (chest.vdepth ?? (ct === 'tunic' || ct === 'vest' ? 0.2 : 0.09)) * Math.pow(Math.max(0, Math.cos(a)), ct === 'tunic' || ct === 'vest' ? 10 : 4) : 0;
        const nl = neck === 'high' ? neckY + 0.05 : neckY - vd;
        if (y > nl) { s = SLOT.SKIN; }
        else if (y > chestBottom) {
          s = armorSlot; o = GARMENT_OFF[ct] ?? 0.005;
          const edgeB = y - chestBottom, edgeT = nl - y;
          f = garmentShade(ct, x, y, z, a, ny, edgeT, edgeB, J, tier);
        } else {
          s = SLOT.PANTS; o = GARMENT_OFF[legType] ?? 0.004; f = pantsShade(legType, x, y, z, a, ny);
          if (isRobe) { s = SLOT.CLOTH1; o = 0.006; }
        }
      } else if (ch === CH_ARM_L || ch === CH_ARM_R || ch === CH_HAND_L || ch === CH_HAND_R) {
        const isHand = ch === CH_HAND_L || ch === CH_HAND_R || c > 2.02;
        if ((gloves && c >= gloveCuff) || (gloves && isHand)) {
          s = SLOT.GLOVE; o = gloves === 'gauntlets' ? 0.009 : 0.004;
          f = 0.95 + 0.1 * ny;
          if (gloves === 'wraps') { f *= 0.85 + 0.2 * Math.abs(Math.sin(c * 55)); s = SLOT.LINEN; }
          if (gloves === 'bracers' && isHand) { s = SLOT.SKIN; o = 0; f = 1; }
          if (gloves === 'gauntlets' && isHand && c > 2.3) f *= 0.9 + 0.2 * Math.abs(Math.sin(c * 30));
        } else if (c < sleeves && !isHand) {
          const st = sleeveType;
          s = chest.coat ? SLOT.COAT : st === 'plate' ? SLOT.ARMOR1 : st === 'mail' ? SLOT.ARMOR1 : st === 'leather' ? SLOT.ARMOR1 : SLOT.CLOTH1;
          if (chest.sleeveType === 'mail') s = SLOT.ARMOR2;
          o = GARMENT_OFF[st] ?? 0.005;
          f = garmentShade(st, x, y, z, a, ny, 1, 1, J, tier);
          if (st === 'plate') f *= 0.92 + 0.14 * Math.max(0, Math.cos(a)) + 0.1 * Math.max(0, ny);
          if (isRobe && c > sleeves - 0.35) { o += (c - (sleeves - 0.35)) * 0.06; } // bell sleeves
        } else if (!isHand && chest.sleeves < 1.9 && ct !== 'robe' && g.armor !== 'cloth' && c < 2 && c > sleeves && (ct === 'plate' || ct === 'mail')) {
          s = SLOT.SHIRT; o = 0.003;
        }
      } else if (ch === CH_LEG_L || ch === CH_LEG_R) {
        if (c >= bootTop) {
          s = SLOT.BOOT; o = g.feet?.type === 'plate' ? 0.012 : 0.008;
          f = 0.92 + 0.12 * ny - (c > 2.0 ? 0.05 : 0);
          if (c > 2.55 && y < 0.035) f *= 0.55; // sole edge
          if (g.feet?.type === 'wraps') { s = SLOT.LINEN; f *= 0.85 + 0.2 * Math.abs(Math.sin(c * 50)); }
          if (g.feet?.type === 'plate' && Math.abs(c - 2.0) < 0.08) s = SLOT.ARMOR2;
        } else {
          s = SLOT.PANTS; o = GARMENT_OFF[legType] ?? 0.004;
          f = pantsShade(legType, x, y, z, a, ny);
          if (legType === 'plate' && c > 0.13) { s = SLOT.ARMOR1; o = 0.012; f *= 0.9 + 0.14 * Math.max(0, Math.cos(a)) + 0.1 * Math.max(0, ny); }
          if (isRobe) { s = SLOT.PANTS; }
        }
      } else if (ch === CH_HEAD) {
        s = SLOT.SKIN;
      }
      if (s !== SLOT.SKIN) {
        slot[v] = s; off[v] = o;
        // hand-painted variation: soft blotches + top light + darker undersides
        const bl = NZ.noise2(x * 7.3 + z * 3.1, y * 5.7) * 0.5 + NZ.noise2(x * 19 + 4, y * 17 - z * 11) * 0.25;
        f *= (1 + bl * 0.16) * (0.9 + 0.2 * Math.max(0, ny)) * (1 - 0.12 * Math.max(0, -ny));
        mul[v * 3] *= f; mul[v * 3 + 1] *= f; mul[v * 3 + 2] *= f;
        // garments don't need the skin's warm crevice tint; neutralise it
        const avg = (mul[v * 3] + mul[v * 3 + 1] + mul[v * 3 + 2]) / 3;
        mul[v * 3] = lerp(mul[v * 3], avg, 0.8); mul[v * 3 + 1] = lerp(mul[v * 3 + 1], avg, 0.8); mul[v * 3 + 2] = lerp(mul[v * 3 + 2], avg, 0.8);
      }
    }
    out[key] = { slot, mul, off };
  }
  // head visibility under helmets
  const ht = g.head?.type;
  if (ht === 'greathelm' || ht === 'horned' || ht === 'winged') {
    const pc = pieces.head, keep = new Uint8Array(pc.idx.length / 3);
    const Hy = J.head[1];
    for (let t = 0; t < keep.length; t++) {
      let vis = false;
      for (let k = 0; k < 3; k++) { const v = pc.idx[t * 3 + k]; if (pc.pos[v * 3 + 1] < Hy - 0.07 * P.headDef.s) vis = true; }
      keep[t] = vis ? 1 : 0;
    }
    out.head.keepTri = keep;
  }
  return out;
}

function garmentShade(type, x, y, z, a, ny, edgeT, edgeB, J, tier) {
  let f = 1;
  const n = NZ.noise2(x * 9 + a, y * 7) * 0.5;
  switch (type) {
    case 'plate': {
      f = 0.78 + 0.34 * Math.max(0, ny) + 0.12 * Math.max(0, Math.cos(a)) - 0.22 * smoothstep(0.07, 0, Math.min(edgeT, edgeB));
      if (y > J.chest[1] + 0.05 && z < 0) f *= 1.06 + 0.08 * Math.max(0, -Math.sin(a * 2) * 0); // chest plate sheen
      break;
    }
    case 'mail': f = 0.92 + 0.12 * ny + 0.06 * n; break;
    case 'leather': {
      f = 0.9 + 0.12 * ny + 0.1 * n;
      if (Math.abs(Math.abs(a) - Math.PI / 2) < 0.07) f *= 0.65; // side seams
      if (Math.abs(x) < 0.01 && z < 0) f *= 0.75; // front lacing
      break;
    }
    case 'robe': case 'tunic': case 'shirt': case 'cloth': case 'vest': case 'rags': {
      f = 0.9 + 0.1 * ny + 0.1 * Math.sin(a * 7 + y * 9 + n * 2) * 0.6;
      if (type === 'rags') f *= 0.85 + 0.3 * Math.max(0, n);
      break;
    }
    default: f = 1;
  }
  return f;
}
function pantsShade(type, x, y, z, a, ny) {
  const n = NZ.noise2(x * 11 + 3, y * 6);
  if (type === 'mail') return 0.9 + 0.1 * ny + 0.05 * n;
  if (type === 'leather') return 0.88 + 0.1 * ny + 0.1 * n;
  if (type === 'plate') return 0.9 + 0.15 * ny;
  return 0.88 + 0.1 * ny + 0.08 * Math.sin(a * 5 + y * 20) + 0.04 * n;
}
