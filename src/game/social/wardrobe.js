// The tailor: dye your armour (three-colour palettes) and choose which unlocked armour look to wear (transmog).
import { registerService } from '../registry.js';

export const DYES = [
  { id: 'default', name: 'Class Colours', dye: null },
  { id: 'crimson', name: 'Crimson Oath', dye: [0x8a1a1a, 0x2a2a30, 0xd8b060] },
  { id: 'royal', name: 'Royal Azure', dye: [0x1c3a8a, 0xe8e0d0, 0xd8b060] },
  { id: 'night', name: 'Midnight Raven', dye: [0x14141c, 0x3a3a48, 0x9a86ff] },
  { id: 'sunlit', name: 'Sunlit Ivory', dye: [0xeae2cc, 0xc9a45a, 0x7a5a2a] },
  { id: 'verdant', name: 'Verdant Warden', dye: [0x2a5a2a, 0x6a4a2a, 0xc8d4a0] },
  { id: 'ember', name: 'Ember Forged', dye: [0x3a2014, 0xd8541a, 0xffc060] },
  { id: 'frost', name: 'Frostbound', dye: [0xcfe4f4, 0x4a7ab0, 0xe8f4ff] },
  { id: 'pip', name: 'Pip Parade', dye: [0x8ad06a, 0xf0e0a0, 0xe06a8a] },
];
const TIERS = [{ tier: 0, name: 'Adventurer’s garb' }, { tier: 1, name: 'Vanguard plate' }, { tier: 2, name: 'Horned Tyrant regalia' }];

registerService('wardrobe', async (s, npc) => {
  const c = s.char; if (!c) return;
  const pick = await s.ui.dialog({ name: npc.name, title: npc.title }, [{ text: 'Fashion is the true endgame. What shall we change?', choices: [{ id: 'dye', text: 'Dye my armour', kind: 'shop' }, { id: 'look', text: 'Change my armour look', kind: 'shop' }, { id: 'bye', text: 'Just browsing.', kind: 'leave' }] }]);
  if (pick === 'dye') {
    const d = await s.ui.dialog({ name: npc.name, title: npc.title }, [{ text: 'Every dye is free for heroes of Solhaven. Which palette?', choices: DYES.map(x => ({ id: x.id, text: x.name, kind: 'talk' })) }]);
    const dye = DYES.find(x => x.id === d); if (!dye) return;
    c.gear = { ...(c.gear || {}), dye: dye.dye }; s.account.save();
    s.game.hero?.u.model?.setGear?.({ dye: dye.dye });
    s.game.fx?.play?.('portal_flash', { pos: s.game.hero.u.pos, x: s.game.hero.u.pos.x, z: s.game.hero.u.pos.z, color: 'gold' });
    s.ui.toast(`Dyed: ${dye.name}.`, 'success');
  } else if (pick === 'look') {
    const best = Math.max(...['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'].map(sl => { const set = c.equip?.[sl]?.set; return set === 'horned' ? 2 : set === 'vanguard' ? 1 : 0; }), c.lookTierMax || 0);
    c.lookTierMax = best;
    const t = await s.ui.dialog({ name: npc.name, title: npc.title }, [{ text: 'You can wear any look you have earned.', choices: TIERS.map(x => ({ id: 't' + x.tier, text: x.tier <= best ? x.name : `${x.name} (locked)`, kind: x.tier <= best ? 'talk' : 'leave' })) }]);
    const tier = t ? +t.slice(1) : NaN; if (!(tier >= 0 && tier <= best)) return;
    c.gear = { ...(c.gear || {}), tier, lookTier: tier }; s.account.save();
    s.game.hero?.u.model?.setGear?.({ tier });
    s.ui.toast(`Now wearing: ${TIERS[tier].name}.`, 'success');
  }
});
