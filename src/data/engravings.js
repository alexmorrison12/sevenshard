// Combat engravings (levels 1–3 at 5 / 10 / 15 nodes). Class engravings live in each class kit.
// levels[i] = stat mods at level i+1 (additive; keys ending in Mul multiply). Special behaviour is keyed by id in combat code.
export const ENGRAVINGS = {
  vendetta: { name: 'Vendetta', desc: 'Damage to bosses +{4/10/20}%. Damage taken +20%.', levels: [{ bossMul: 0.04, dmgTaken: 0.2 }, { bossMul: 0.1, dmgTaken: 0.2 }, { bossMul: 0.2, dmgTaken: 0.2 }] },
  hexed_idol: { name: 'Hexed Idol', desc: 'Attack Power +{3/8/16}%. Healing received −25%.', levels: [{ dmgMul: 0.03, healTaken: -0.25 }, { dmgMul: 0.08, healTaken: -0.25 }, { dmgMul: 0.16, healTaken: -0.25 }] },
  keen_edge: { name: 'Keen Edge', desc: 'Crit Damage +{10/25/50}%. 10% chance to deal 20% less damage.', levels: [{ critDmg: 0.1 }, { critDmg: 0.25 }, { critDmg: 0.5 }] },
  adrenaline: { name: 'Adrenaline', desc: 'Using skills stacks Attack Power (max 6 stacks); at max stacks Crit Rate +{5/10/15}%.', levels: [{ dmgMul: 0.03, crit: 0.05 }, { dmgMul: 0.05, crit: 0.1 }, { dmgMul: 0.06, crit: 0.15 }] },
  backstabber: { name: 'Backstabber', desc: 'Back Attack damage +{5/12/25}%.', levels: [{ backMul: 0.05 }, { backMul: 0.12 }, { backMul: 0.25 }] },
  master_brawler: { name: 'Master Brawler', desc: 'Head Attack damage +{5/12/25}%.', levels: [{ headMul: 0.05 }, { headMul: 0.12 }, { headMul: 0.25 }] },
  frontliner: { name: 'Frontliner', desc: 'Damage of skills without Back/Head Attack +{3/8/16}%.', levels: [{ plainMul: 0.03 }, { plainMul: 0.08 }, { plainMul: 0.16 }] },
  wind_captain: { name: 'Wind Captain', desc: 'Damage +{10/22/45}% of your bonus Move Speed.', levels: [{ captain: 0.1 }, { captain: 0.22 }, { captain: 0.45 }] },
  spirit_absorption: { name: 'Spirit Absorption', desc: 'Attack and Move Speed +{3/8/15}%.', levels: [{ atkSpd: 0.03, moveSpd: 0.03 }, { atkSpd: 0.08, moveSpd: 0.08 }, { atkSpd: 0.15, moveSpd: 0.15 }] },
  precise_blade: { name: 'Precise Blade', desc: 'Crit Rate +{4/10/20}%. Crit Damage −12%.', levels: [{ crit: 0.04, critDmg: -0.12 }, { crit: 0.1, critDmg: -0.12 }, { crit: 0.2, critDmg: -0.12 }] },
  super_charge: { name: 'Super Charge', desc: 'Charge skill damage +{4/10/20}%; charging is 40% faster.', levels: [{ chargeMul: 0.04 }, { chargeMul: 0.1 }, { chargeMul: 0.2 }] },
  barricade: { name: 'Barricade', desc: 'Damage +{3/8/16}% while shielded.', levels: [{ shieldedMul: 0.03 }, { shieldedMul: 0.08 }, { shieldedMul: 0.16 }] },
  expert: { name: 'Expert', desc: 'Healing and shields you grant +{6/14/28}%.', levels: [{ healMul: 0.06, shieldMul: 0.06 }, { healMul: 0.14, shieldMul: 0.14 }, { healMul: 0.28, shieldMul: 0.28 }] },
  awakening: { name: 'Awakening', desc: 'Awakening cooldown −{10/25/50}%; +{1/2/3} uses.', levels: [{ awakenCdr: 0.1, awakenUses: 1 }, { awakenCdr: 0.25, awakenUses: 2 }, { awakenCdr: 0.5, awakenUses: 3 }] },
  ether_predator: { name: 'Ether Predator', desc: 'Hits leave ether that grants Attack Power +{0.5/1/1.5}% (max 30 stacks).', levels: [{ dmgMul: 0.05 }, { dmgMul: 0.1 }, { dmgMul: 0.15 }] },
  crisis_evasion: { name: 'Crisis Evasion', desc: 'Survive a lethal hit once every {180/150/120} s.', levels: [{ cheat: 180 }, { cheat: 150 }, { cheat: 120 }] },
  stabilized_status: { name: 'Stabilized Status', desc: 'Damage +{3/8/16}% while HP is above 80%.', levels: [{ stableMul: 0.03 }, { stableMul: 0.08 }, { stableMul: 0.16 }] },
  all_out_attack: { name: 'All-Out Attack', desc: 'Holding and Casting skill damage +{4/10/20}%.', levels: [{ holdMul: 0.04 }, { holdMul: 0.1 }, { holdMul: 0.2 }] },
  mana_flow: { name: 'Mana Flow', desc: 'Mana regeneration +{10/20/30}%; skill mana cost −{4/10/20}%.', levels: [{ mpRegenMul: 0.1 }, { mpRegenMul: 0.2 }, { mpRegenMul: 0.3 }] },
  heavy_armor: { name: 'Heavy Armor', desc: 'Defense +{20/50/100}%.', levels: [{ defMul: 0.2 }, { defMul: 0.5 }, { defMul: 1 }] },
  sight_focus: { name: 'Sight Focus', desc: 'Damage to targets under Brand +{5/10/15}%.', levels: [{ brandMul: 0.05 }, { brandMul: 0.1 }, { brandMul: 0.15 }] },
  drops_of_ether: { name: 'Drops of Ether', desc: 'Attacks sometimes drop ether that restores HP/MP.', levels: [{ mpRegenMul: 0.05 }, { mpRegenMul: 0.1 }, { mpRegenMul: 0.15 }] },
  propulsion: { name: 'Propulsion', desc: 'After dashing, damage +{4/8/16}% for 5 s.', levels: [{ dashMul: 0.04 }, { dashMul: 0.08 }, { dashMul: 0.16 }] },
  increase_mass: { name: 'Increase Mass', desc: 'Attack Power +{4/10/18}%. Attack Speed −10%.', levels: [{ dmgMul: 0.04, atkSpd: -0.1 }, { dmgMul: 0.1, atkSpd: -0.1 }, { dmgMul: 0.18, atkSpd: -0.1 }] },
  // negatives
  neg_atk: { name: 'Atk. Power Reduction', negative: true, desc: 'Attack Power −{2/4/6}%.', levels: [{ dmgMul: -0.02 }, { dmgMul: -0.04 }, { dmgMul: -0.06 }] },
  neg_speed: { name: 'Atk. Speed Reduction', negative: true, desc: 'Attack Speed −{2/4/6}%.', levels: [{ atkSpd: -0.02 }, { atkSpd: -0.04 }, { atkSpd: -0.06 }] },
  neg_def: { name: 'Defense Reduction', negative: true, desc: 'Defense −{10/20/30}%.', levels: [{ defMul: -0.1 }, { defMul: -0.2 }, { defMul: -0.3 }] },
  neg_move: { name: 'Move Speed Reduction', negative: true, desc: 'Move Speed −{2/4/6}%.', levels: [{ moveSpd: -0.02 }, { moveSpd: -0.04 }, { moveSpd: -0.06 }] },
};
export const COMBAT_ENGRAVINGS = Object.keys(ENGRAVINGS).filter(k => !ENGRAVINGS[k].negative);

/** nodes per engraving from books, accessories and the ability stone → levels (floor(nodes/5), max 3) */
export function engravingNodes(char) {
  const n = {};
  const add = (id, v) => { if (id) n[id] = (n[id] || 0) + v; };
  for (const b of char.books || []) add(b.id, b.nodes);
  for (const it of Object.values(char.equip || {})) {
    if (!it) continue;
    for (const e of it.engr || []) add(e.id, e.v);
    if (it.neg) add(it.neg.id, it.neg.v);
    if (it.facets) { const names = it.lines || []; it.facets.forEach((line, i) => add(names[i], line.filter(x => x === 1).length)); }
  }
  return n;
}
export function engravingLevels(char) {
  const n = engravingNodes(char), lv = {};
  for (const id in n) lv[id] = Math.min(3, Math.floor(n[id] / 5));
  for (const id of char.classEngr || []) lv[id] = Math.max(lv[id] || 0, 3);
  return lv;
}
