// Outfit assembly: turns a resolved gear spec into a list of skinned pieces (rings, cuffs, pauldrons, cape, skirt,
// panels, headgear, class extras) fitted to a body base. All pieces are cached per base + spec.
import { SLOT } from './palette.js';
import { ringPiece, pauldronPiece, headgearPiece, capePiece, skirtPiece, panelPiece, copPiece, cuffPiece, beltPiece, strapPiece, lamesPiece, limbPlatesPiece } from './pieces.js';
import { hoodPiece } from './hair.js';
import { headbandPiece, hatPiece, tailsPiece, scarfPiece, collarPiece, coatTailsPiece, bandolierPiece, chainsPiece, gauntletPiece, hipChainPiece } from './extras.js';

/** list of { p: piece } for a base + resolved gear spec; also reports whether hair is hidden */
export function outfitPieces(base, g) {
  const L = [];
  const J = base.JJ.J;
  const add = (p, extra = {}) => { if (p && p.n) L.push({ p, ...extra }); };
  const chest = g.chest || { type: 'shirt', sleeves: 1 };
  const ct = chest.type, tier = g.tier || 0;
  const legScale = base.JJ.legLen / 0.87;
  const sl = chest.sleeves ?? 1;
  if (sl > 0.25 && sl < 1.93 && !(g.hands && sl > 2 - (g.hands.cuff ?? 0.3))) {
    for (const s of ['L', 'R']) {
      if (ct === 'plate') add(ringPiece(base, 'arm' + s, sl, { profile: 'lip', w: 0.03, t: 0.022, slot: SLOT.TRIM, off: 0.012 }));
      else if (ct === 'leather' || ct === 'mail') add(ringPiece(base, 'arm' + s, sl, { profile: 'band', w: 0.028, t: 0.012, slot: SLOT.ARMOR2, off: 0.008, stitch: true }));
      else add(ringPiece(base, 'arm' + s, sl, { profile: 'tube', w: 0.018, slot: tier >= 1 ? SLOT.CLOTH2 : SLOT.CLOTH1, off: 0.006 }));
    }
  }
  if (ct === 'robe' && sl >= 1.9) for (const s of ['L', 'R']) add(cuffPiece(base, 'arm' + s, 1.72, { w: 0.13, flare: 0.045, t: 0.008, slot: SLOT.CLOTH1, off: 0.012, trim: tier >= 1 }));
  if (chest.neck === 'high') {
    if (ct === 'plate') add(ringPiece(base, 'torso', J.neck[1] + 0.012, { profile: 'band', w: 0.05, t: 0.02, slot: SLOT.TRIM, off: 0.012, rMax: 0.3 }));
    else add(ringPiece(base, 'torso', J.neck[1] + 0.01, { profile: 'flare', w: 0.06, t: 0.008, flare: 0.02, slot: ct === 'robe' ? SLOT.CLOTH2 : SLOT.ARMOR2, off: 0.01, rMax: 0.3 }));
  }
  if (ct === 'tunic' || ct === 'shirt' || ct === 'rags') add(ringPiece(base, 'torso', J.hips[1] - 0.06 * legScale, { profile: 'tube', w: 0.016, slot: SLOT.CLOTH2, off: 0.01 }));
  if (chest.straps && ct !== 'robe') add(strapPiece(base, { off: ct === 'mail' ? 0.018 : 0.014 }));
  if (ct === 'plate') add(lamesPiece(base, { count: 3, trim: tier >= 1 }));
  if (ct === 'plate' || g.legs?.type === 'plate') {
    add(limbPlatesPiece(base, { arms: ct === 'plate' ? [0.45, 1.3] : [], legs: g.legs?.type === 'plate' ? [0.13, 0.72, 1.3] : [] }));
  }
  if (ct === 'robe' && g.skirt?.panel) add(panelPiece(base, { top: J.neck[1] - 0.02, bottom: J.spine[1] - 0.01, hw: 0.05 * base.scale, slot: SLOT.CLOTH2, trim: true, front: true }));
  if (g.belt) {
    const bt = g.belt.type;
    if (bt === 'sash') add(beltPiece(base, { type: 'sash', w: 0.075, slot: SLOT.CLOTH2, buckle: g.belt.buckle || 'none', off: 0.012 }));
    else if (bt === 'rope') add(ringPiece(base, 'torso', J.spine[1] - 0.035, { profile: 'tube', w: 0.02, slot: SLOT.STRAW, off: 0.012 }));
    else add(beltPiece(base, { type: bt, w: bt === 'plate' ? 0.07 : 0.055, slot: bt === 'plate' ? SLOT.ARMOR2 : SLOT.BELT, buckle: g.belt.buckle, pouches: g.belt.pouches || 0, off: ct === 'plate' ? 0.02 : 0.013 }));
  }
  if (g.feet) {
    const bt = 2 - (g.feet.height ?? 0.4) * 0.95;
    for (const s of ['L', 'R']) {
      if (g.feet.cuff) add(cuffPiece(base, 'leg' + s, bt + 0.04, { w: 0.08, flare: g.feet.type === 'plate' ? 0.03 : 0.025, t: 0.01, slot: SLOT.BOOT, off: 0.01, trim: g.feet.type === 'plate' && tier >= 1 }));
      else add(ringPiece(base, 'leg' + s, bt, { profile: 'tube', w: 0.016, slot: SLOT.BOOT, off: 0.01 }));
      if (g.feet.type === 'plate') add(copPiece(base, s, 'toe', { slot: SLOT.BOOT, size: 1 }));
    }
  }
  if (g.hands) {
    const gc = 2 - (g.hands.cuff ?? 0.3);
    for (const s of ['L', 'R']) {
      if (g.hands.type === 'gauntlets') add(cuffPiece(base, 'arm' + s, gc + 0.04, { w: 0.1, flare: 0.04, t: 0.012, slot: SLOT.GLOVE, off: 0.012, trim: tier >= 1, glowTrim: g.hands.glowTrim }));
      else if (g.hands.type === 'gloves') add(cuffPiece(base, 'arm' + s, gc + 0.03, { w: 0.07, flare: 0.02, t: 0.008, slot: SLOT.GLOVE, off: 0.006 }));
      else add(ringPiece(base, 'arm' + s, g.hands.type === 'bracers' ? 1.6 : gc + 0.02, { profile: 'band', w: g.hands.type === 'bracers' ? 0.12 : 0.03, t: 0.01, slot: g.hands.type === 'bracers' ? SLOT.LEATHER : SLOT.LINEN, off: 0.007, stitch: true }));
    }
  }
  if (g.shoulders) for (const s of ['L', 'R']) {
    if (g.shoulders.side && g.shoulders.side !== s) continue;
    add(pauldronPiece(base, s, { ...g.shoulders, tier, runes: !!g.runes }));
  }
  if (g.legs?.kneepads) for (const s of ['L', 'R']) add(copPiece(base, s, 'knee', { slot: g.legs.type === 'leather' ? SLOT.ARMOR2 : SLOT.ARMOR1, size: g.legs.type === 'plate' ? 1.15 : 1, rim: g.legs.type === 'plate' && tier >= 1, spike: tier >= 2 }));
  if (ct === 'plate' && tier >= 1) for (const s of ['L', 'R']) add(copPiece(base, s, 'elbow', { slot: SLOT.ARMOR1, size: 1.1, rim: true }));
  let hideHair = false;
  const ht = g.head?.type;
  if (ht === 'hood') { add(hoodPiece(base)); hideHair = true; }
  else if (ht) { add(headgearPiece(base, { type: ht, gem: g.head.gem, glowTrim: g.head.glowTrim })); if (/helm|horned|winged|bandana|cap/.test(ht)) hideHair = true; }
  if (g.head?.mask) add(headgearPiece(base, { type: 'none', mask: true }));
  if (g.cloak) add(capePiece(base, { len: g.cloak.len, trim: g.cloak.trim, emblem: g.cloak.emblem, glowTrim: g.cloak.glowTrim, hem: g.cloak.hem || (tier >= 2 && g.cloak.trim ? 'v' : 'round') }));
  if (ct === 'robe' || g.skirt) {
    const sk = g.skirt || {};
    const isPlate = sk.type === 'plate' || sk.type === 'leather';
    add(skirtPiece(base, { len: sk.len ?? 0.95, flare: sk.flare ?? 0.12, panel: sk.panel, hemTrim: sk.hemTrim, slot: isPlate ? SLOT.ARMOR1 : SLOT.CLOTH1, hemSlot: SLOT.TRIM, top: isPlate ? -0.05 : -0.02, off: isPlate ? 0.02 : 0.012 }));
  }
  if (g.tabard) {
    const tb = g.tabard;
    const top = tb.short ? J.spine[1] - 0.06 : undefined;
    add(panelPiece(base, { emblem: tb.emblem, back: tb.back, slot: SLOT.TABARD, trim: !tb.short, top, tatter: tb.tatter, hw: tb.hw, runes: !!g.runes, trimSlot: g.runes ? SLOT.RUNE : SLOT.TRIM }));
  }
  if (g.apron) add(panelPiece(base, { top: J.chest[1] + 0.06, bottom: J.shinL[1] + 0.02, hw: base.P.core[1] * 0.95, slot: SLOT.TABARD }));
  for (const ex of g.extras || []) {
    const o = { ...ex, runes: !!g.runes }; delete o.type;
    switch (ex.type) {
      case 'headband': add(headbandPiece(base, o)); break;
      case 'hat': add(hatPiece(base, o)); hideHair = hideHair || false; break;
      case 'tails': add(tailsPiece(base, o)); break;
      case 'scarf': add(scarfPiece(base, o)); break;
      case 'collar': add(collarPiece(base, o)); break;
      case 'coat': add(coatTailsPiece(base, o)); break;
      case 'bandolier': add(bandolierPiece(base, o)); break;
      case 'chains': add(chainsPiece(base, o)); break;
      case 'gauntlets': for (const s of ['L', 'R']) add(gauntletPiece(base, s, o)); break;
      case 'hipchain': add(hipChainPiece(base, o)); break;
    }
  }
  return { list: L, hideHair, hat: (g.extras || []).some(e => e.type === 'hat') };
}
