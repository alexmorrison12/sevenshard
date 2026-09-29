// Sunheart Passive — SEVENSHARD's take on Lost Ark's Ark Passive. Unlocks at item level 1400. Points come from
// endgame clears; each tree has tiers that open once enough points sit in the tiers below.
//   node: { id, tier, name, desc, max (ranks), cost (points per rank), mods (per rank; keys as in stats) }
export const SUNHEART_UNLOCK = 1400;
export const TIER_GATE = [0, 0, 10, 20, 30, 40];   // points spent in the tree before a tier opens (tier 1..5)

export const TREES = {
  evolution: { name: 'Evolution', color: '#f3c46a', blurb: 'Raw power: combat stats and universal damage.', nodes: [
    { id: 'ev_crit', tier: 1, name: 'Honed Instinct', desc: 'Crit +50 per rank.', max: 10, cost: 1, mods: { critStat: 50 } },
    { id: 'ev_spec', tier: 1, name: 'Focused Soul', desc: 'Specialization +50 per rank.', max: 10, cost: 1, mods: { specStat: 50 } },
    { id: 'ev_swift', tier: 1, name: 'Quickened Step', desc: 'Swiftness +50 per rank.', max: 10, cost: 1, mods: { swiftStat: 50 } },
    { id: 'ev_keen', tier: 2, name: 'Keen Strikes', desc: 'Crit Damage +4% per rank.', max: 2, cost: 5, mods: { critDmg: 0.04 } },
    { id: 'ev_tempo', tier: 2, name: 'Rapid Tempo', desc: 'Attack and Move Speed +2% per rank.', max: 2, cost: 5, mods: { atkSpd: 0.02, moveSpd: 0.02 } },
    { id: 'ev_ward', tier: 2, name: 'Iron Ward', desc: 'Damage taken −3% per rank.', max: 2, cost: 5, mods: { dmgTaken: -0.03 } },
    { id: 'ev_slayer', tier: 3, name: 'Giant Slayer', desc: 'Damage to bosses +3% per rank.', max: 2, cost: 10, mods: { bossMul: 0.03 } },
    { id: 'ev_rhythm', tier: 3, name: 'Battle Rhythm', desc: 'Cooldown reduction +2.5% per rank.', max: 2, cost: 10, mods: { cdr: 0.025 } },
    { id: 'ev_sky', tier: 4, name: 'Sundered Sky', desc: 'Damage +5%. Crit Damage +8%.', max: 1, cost: 15, mods: { dmgMul: 0.05, critDmg: 0.08 } },
    { id: 'ev_core', tier: 5, name: 'Radiant Core', desc: 'Damage +8%. Your awakening deals 25% more.', max: 1, cost: 20, mods: { dmgMul: 0.08, awakenMul: 0.25 } },
  ] },
  enlightenment: { name: 'Enlightenment', color: '#8fd0ff', blurb: 'Your class, perfected: identity and signature skills.', nodes: [
    { id: 'en_gain', tier: 1, name: 'Awakened Identity', desc: 'Identity gauge gain +6% per rank.', max: 5, cost: 1, mods: { identityGain: 0.06 } },
    { id: 'en_power', tier: 1, name: 'Identity Mastery', desc: 'Identity skill damage +6% per rank.', max: 5, cost: 1, mods: { identityMul: 0.06 } },
    { id: 'en_back', tier: 2, name: 'Predator’s Angle', desc: 'Back and Head Attack damage +4% per rank.', max: 3, cost: 3, mods: { backMul: 0.04, headMul: 0.04 } },
    { id: 'en_support', tier: 2, name: 'Guardian’s Oath', desc: 'Shields and heals +8% per rank.', max: 3, cost: 3, mods: { shieldMul: 0.08, healMul: 0.08 } },
    { id: 'en_stagger', tier: 3, name: 'Mountain’s Weight', desc: 'Stagger +15% per rank.', max: 2, cost: 5, mods: { staggerMul: 0.15 } },
    { id: 'en_mana', tier: 3, name: 'Wellspring', desc: 'Mana regeneration +20% per rank.', max: 2, cost: 5, mods: { mpRegenMul: 0.2 } },
    { id: 'en_apex', tier: 4, name: 'Apex Technique', desc: 'Skill damage +6%; identity skills +15%.', max: 1, cost: 12, mods: { dmgMul: 0.06, identityMul: 0.15 } },
  ] },
  leap: { name: 'Leap', color: '#ff9a6a', blurb: 'Beyond awakening: more uses, faster, harder.', nodes: [
    { id: 'lp_charge', tier: 1, name: 'Surging Light', desc: 'Awakening cooldown −8% per rank.', max: 5, cost: 1, mods: { awakenCdr: 0.08 } },
    { id: 'lp_force', tier: 1, name: 'Unbound Force', desc: 'Awakening damage +8% per rank.', max: 5, cost: 1, mods: { awakenMul: 0.08 } },
    { id: 'lp_use', tier: 2, name: 'Second Dawn', desc: 'One extra awakening use per fight.', max: 1, cost: 6, mods: { awakenUses: 1 } },
    { id: 'lp_hyper', tier: 3, name: 'Hyper Awakening Technique', desc: 'Every 30 s your next skill hits 40% harder (a golden flash marks it).', max: 1, cost: 10, mods: { hyperTech: 1 } },
  ] },
};

/** points earned for content (added to char.sunheart.points) */
export const SUNHEART_POINTS = { chaos: 1, guardian: 2, raid: 4, abyss: 3, inferno: 1, trial: 3, cube: 2 };
