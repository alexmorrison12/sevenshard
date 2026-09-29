// Proving Grounds (3v3 PvP in the Crucible) and duels: normalised stats, damage rules, modes, rank tiers, rewards,
// AI difficulty by rank, announcer lines. Runtime: src/game/modes/pvp.js.

/** Normalised PvP: every hero is rebuilt at this item level with skills at level 10 (your tripods), no engravings,
 *  no gems, no battle items; then HP is multiplied and hero-vs-hero damage scaled so fights last. */
export const PVP = {
  ilvl: 1415, skillLv: 10,
  hpMul: 5.2,            // × the normalised max HP
  dmg: 0.034,            // hero → hero damage multiplier
  coefCap: 60,           // any single hit counts as at most this skill coefficient (× skill level) — no one-shots
  awaken: 0.6, identity: 0.85,
  healTaken: 0.55, shieldMul: 0.6, mpRegen: 70,
  ccImmune: 2.2,         // seconds of Unstoppable after a knockdown / stun / freeze ends
  countdown: 5, respawn: 5, spawnProtect: 2.5,
};

export const PVP_MODES = {
  deathmatch: { id: 'deathmatch', name: 'Team Deathmatch', short: 'Deathmatch', desc: 'First team to 10 kills (or the most kills after 5 minutes). Respawn after 5 seconds.', kills: 10, time: 300, overtime: 60 },
  elimination: { id: 'elimination', name: 'Elimination', short: 'Elimination', desc: 'Best of five rounds: the last team standing wins the round. No respawns.', wins: 3, rounds: 5, roundTime: 100, between: 4.5, hpMul: 1.35 },
};

/** Rank tiers by rating (divisions III → I every `div` points inside a tier; Grandmaster has none). */
export const PVP_RANKS = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#c8844f' },
  { id: 'silver', name: 'Silver', min: 1150, color: '#c9d2e0' },
  { id: 'gold', name: 'Gold', min: 1300, color: '#f0c050' },
  { id: 'platinum', name: 'Platinum', min: 1450, color: '#5fe0c8' },
  { id: 'diamond', name: 'Diamond', min: 1600, color: '#7cc4ff' },
  { id: 'master', name: 'Master', min: 1800, color: '#c07bff' },
  { id: 'grandmaster', name: 'Grandmaster', min: 2000, color: '#ff6a3a' },
];
export const START_RATING = 1000;

/** AI difficulty for your opponents / teammates by your rank. */
export const PVP_AI = {
  bronze: { enemy: ['casual', 'casual', 'clueless'], ally: ['veteran', 'casual'] },
  silver: { enemy: ['casual', 'veteran', 'casual'], ally: ['veteran', 'casual'] },
  gold: { enemy: ['veteran', 'veteran', 'casual'], ally: ['veteran', 'veteran'] },
  platinum: { enemy: ['veteran', 'tryhard', 'veteran'], ally: ['veteran', 'veteran'] },
  diamond: { enemy: ['tryhard', 'veteran', 'tryhard'], ally: ['veteran', 'tryhard'] },
  master: { enemy: ['tryhard', 'tryhard', 'veteran'], ally: ['tryhard', 'veteran'] },
  grandmaster: { enemy: ['tryhard', 'tryhard', 'tryhard'], ally: ['tryhard', 'tryhard'] },
};
/** PvP personas: reaction (s), execution (0..1), aggression, how often they stand up at once, dodge chance */
export const PVP_PERSONAS = {
  tryhard: { react: 0.2, skill: 0.95, aggro: 0.8, wake: 0.3, dodge: 0.6, focus: 0.9 },
  veteran: { react: 0.3, skill: 0.8, aggro: 0.65, wake: 0.45, dodge: 0.45, focus: 0.75 },
  casual: { react: 0.45, skill: 0.62, aggro: 0.55, wake: 0.7, dodge: 0.25, focus: 0.5 },
  clueless: { react: 0.65, skill: 0.45, aggro: 0.7, wake: 1.0, dodge: 0.1, focus: 0.3 },
  afk: { react: 0.9, skill: 0.3, aggro: 0.3, wake: 1.4, dodge: 0.05, focus: 0.2 },
};

/** Rewards (Proving Tokens `pvp` + silver); first win of the day adds a bonus. */
export const PVP_REWARDS = {
  win: { pvp: 60, silver: 9000 }, loss: { pvp: 25, silver: 3500 }, draw: { pvp: 35, silver: 5000 },
  firstWin: { pvp: 100, gold: 20 }, rankBonus: { gold: 1.1, platinum: 1.2, diamond: 1.3, master: 1.4, grandmaster: 1.5 },
  kfactor: 32,
};

export const ANNOUNCER = {
  firstBlood: 'First Blood!', double: 'Double Kill!', triple: 'Triple Kill!', rampage: 'Unstoppable!',
  shutdown: 'Shutdown!', ace: 'Ace!', lastStand: 'Last one standing!',
};

/** Duels anywhere: 1v1 against an AI adventurer, first to fall below `lowHp` loses. */
export const DUEL = { lowHp: 0.1, countdown: 3, ring: 12, leave: 16, time: 90 };
