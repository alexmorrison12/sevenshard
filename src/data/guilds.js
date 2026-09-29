// Guilds: the AI guilds of Solmara-1, donations, guild research perks and weekly guild missions.
export const AI_GUILDS = [
  { id: 'dawnforged', name: 'Dawnforged', tag: 'DAWN', level: 18, members: 76, focus: 'raid', motto: 'World first or bust.' },
  { id: 'salt_steel', name: 'Salt & Steel', tag: 'SALT', level: 12, members: 44, focus: 'sailing', motto: 'The sea takes what it wants. We take the rest.' },
  { id: 'rested_bonus', name: 'The Rested Bonus', tag: 'REST', level: 9, members: 38, focus: 'casual', motto: 'We log in when the rest bar is full.' },
  { id: 'pip_society', name: 'Pip Appreciation Society', tag: 'PIPS', level: 7, members: 29, focus: 'collect', motto: 'Every seed matters. Every Pip matters more.' },
  { id: 'horned_helm', name: 'Horned Helm', tag: 'HORN', level: 15, members: 61, focus: 'raid', motto: 'Break the horns, keep the helm.' },
  { id: 'glass_rovers', name: 'Glass Sea Rovers', tag: 'ROVE', level: 11, members: 40, focus: 'sailing', motto: 'Eight islands, one crew.' },
  { id: 'counterplay', name: 'Counterplay', tag: 'CNTR', level: 13, members: 52, focus: 'pvp', motto: 'Blue glow? Our cue.' },
  { id: 'last_refrain', name: 'Last Refrain', tag: 'SONG', level: 10, members: 33, focus: 'social', motto: 'Supports first. Always.' },
  { id: 'brightwater', name: 'Brightwater Co.', tag: 'BWCO', level: 8, members: 27, focus: 'life', motto: 'Fish, forage, profit.' },
  { id: 'bid_wars', name: 'Bid Wars', tag: 'BIDS', level: 14, members: 58, focus: 'trade', motto: 'Every book has a price. Usually ours.' },
  { id: 'ninety_seven', name: 'Ninety Seven', tag: 'NS97', level: 6, members: 21, focus: 'casual', motto: 'One day. One day.' },
  { id: 'gate_crashers', name: 'Gate Crashers', tag: 'GATE', level: 16, members: 66, focus: 'raid', motto: 'Gate 2 or bed.' },
];
export const GUILD_MAX_LEVEL = 20;
export const guildXpFor = lv => Math.round(4000 * Math.pow(lv, 1.35));
export const memberCap = lv => 20 + lv * 4;
export const CREATE_COST = { silver: 20000 };
export const DONATIONS = {
  silver: { cost: { silver: 10000 }, bloodstones: 40, xp: 100 },
  gold: [{ cost: { gold: 100 }, bloodstones: 100, xp: 500 }, { cost: { gold: 500 }, bloodstones: 400, xp: 2000 }, { cost: { gold: 1000 }, bloodstones: 700, xp: 3500 }],
};
/** research perks: level = min(max, floor(guild level / every)) (+1 for your own guild's focus) × per */
export const GUILD_RESEARCH = [
  { id: 'blessing', name: 'Guild Blessing', desc: 'Experience +{v}%.', perk: 'xpGain', per: 0.02, max: 5, every: 3 },
  { id: 'treasure', name: 'Treasure Sense', desc: 'Silver gained +{v}%.', perk: 'silverGain', per: 0.01, max: 5, every: 4 },
  { id: 'lifecraft', name: 'Life Mastery', desc: 'Life skill experience +{v}%.', perk: 'lifeXp', per: 0.04, max: 5, every: 3 },
  { id: 'quartermaster', name: 'Quartermaster', desc: 'Guild shop prices −{v}%.', perk: 'shopDiscount', per: 0.02, max: 5, every: 4 },
  { id: 'rested', name: 'Rested Minds', desc: 'Rest bonus gained +{v}%.', perk: 'restGain', per: 0.05, max: 4, every: 5 },
];
export const GUILD_MISSIONS = [
  { id: 'chaos', name: 'Rift Sweep', desc: 'Clear {need} Chaos Dungeons as a guild.', event: 'clear', match: { content: 'chaos' }, need: 60, reward: { bloodstone: 300 }, xp: 1500 },
  { id: 'guardian', name: 'Guardian Cull', desc: 'Defeat {need} guardians as a guild.', event: 'clear', match: { content: 'guardian' }, need: 40, reward: { bloodstone: 300 }, xp: 1500 },
  { id: 'abyss', name: 'Deep Dive', desc: 'Clear {need} Abyssal Dungeon gates as a guild.', event: 'clear', match: { content: 'abyss' }, need: 12, reward: { bloodstone: 400 }, xp: 2000 },
  { id: 'hone', name: 'Forge Fire', desc: 'Attempt honing {need} times as a guild.', event: 'hone', match: {}, need: 150, reward: { bloodstone: 250 }, xp: 1200 },
  { id: 'fish', name: 'Guild Fish Fry', desc: 'Catch {need} fish as a guild.', event: 'gather', match: { skill: 'fish' }, need: 100, reward: { bloodstone: 250 }, xp: 1200 },
  { id: 'raid', name: 'Horn Hunters', desc: 'Defeat Gorrath {need} times as a guild.', event: 'clear', match: { content: 'raid' }, need: 6, reward: { bloodstone: 500 }, xp: 2500 },
  { id: 'donate', name: 'Full Coffers', desc: 'Donate {need} times as a guild.', event: 'donate', match: {}, need: 40, reward: { bloodstone: 200 }, xp: 1000 },
];
