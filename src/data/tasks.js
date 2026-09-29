// Wayfarer's Tasks (daily, pick 3 of 6 offered), weekly tasks (pick 3 of 5), Wayfarer reputation, and the
// world event schedule (the "compass"). Task templates progress on tracked events:
//   { id, name, desc ({n} = need), events: [event], match: { key: value | [values] }, need, amount: 'count'|'dist'|1, reward, rep }
const D = (id, name, desc, events, match, need, reward, amount = 'count') => ({ id, name, desc, events: [].concat(events), match, need, amount, reward, rep: 100 });
const DAILY_REWARD = { silver: 35000, shards: 1500, leapstone: 6 };
const DAILY_REWARD_GOLD = { silver: 25000, gold: 60, leapstone: 4 };
export const DAILY_TASKS = [
  D('slay_demons', 'Demon Culling', 'Defeat {n} demons.', 'kill', { family: 'demon' }, 60, DAILY_REWARD),
  D('slay_beasts', 'Pest Control', 'Defeat {n} beasts in the fields.', 'kill', { family: 'beast' }, 40, DAILY_REWARD),
  D('elites', 'Big Game', 'Defeat {n} elite monsters.', 'kill', { elite: true }, 5, DAILY_REWARD_GOLD),
  D('chaos', 'Into the Rift', 'Clear a Chaos Dungeon.', 'clear', { content: 'chaos' }, 1, DAILY_REWARD),
  D('guardian', 'Guardian Hunt', 'Defeat a guardian.', 'clear', { content: 'guardian' }, 1, DAILY_REWARD_GOLD),
  D('event', 'Answer the Call', 'Take part in a Field Boss, Chaos Gate, Adventure Island or Ghost Ship.', 'clear', { content: ['fieldboss', 'chaosgate', 'island', 'ghostship'] }, 1, DAILY_REWARD_GOLD),
  D('inferno', 'Descend', 'Clear {n} Inferno Descent floors.', 'clear', { content: 'inferno' }, 5, DAILY_REWARD),
  D('fish', 'Catch of the Day', 'Catch {n} fish.', 'gather', { skill: 'fish' }, 5, DAILY_REWARD),
  D('forage', 'Herbalist', 'Forage {n} times.', 'gather', { skill: 'forage' }, 10, DAILY_REWARD),
  D('mine', 'Rock and Stone', 'Mine {n} times.', 'gather', { skill: 'mine' }, 8, DAILY_REWARD),
  D('dig', 'Dig Site', 'Excavate {n} times.', 'gather', { skill: 'dig' }, 3, DAILY_REWARD),
  D('song', 'Serenade', 'Play a song for someone in Solhaven.', 'song', {}, 1, DAILY_REWARD),
  D('emote', 'Friendly Gestures', 'Perform {n} emotes for rapport NPCs.', 'emote', {}, 3, DAILY_REWARD),
  D('hone', 'Hot Iron', 'Attempt honing {n} times.', 'hone', {}, 3, DAILY_REWARD_GOLD),
  D('facet', 'Stonecutter', 'Facet an ability stone {n} times.', 'facet', {}, 5, DAILY_REWARD),
  D('trade', 'Market Day', 'Buy or sell something on the market.', ['buy', 'sell'], {}, 1, DAILY_REWARD),
  D('donate', 'Guild Spirit', 'Donate to your guild.', 'donate', {}, 1, DAILY_REWARD),
  D('craft', 'Workshop Duty', 'Collect a craft from your stronghold workshop.', 'craft', {}, 1, DAILY_REWARD),
  D('dispatch', 'Send the Crew', 'Send a crew on a dispatch mission.', 'dispatch', {}, 1, DAILY_REWARD),
  D('sail', 'Sea Legs', 'Sail {n} m on the Glass Sea.', 'sail', {}, 1500, DAILY_REWARD, 'dist'),
  D('pvp', 'Prove Yourself', 'Play a Proving Grounds match.', 'pvp', {}, 1, DAILY_REWARD_GOLD),
];
const W = (id, name, desc, events, match, need, reward, amount = 'count') => ({ id, name, desc, events: [].concat(events), match, need, amount, reward, rep: 400 });
export const WEEKLY_TASKS = [
  W('w_abyss', 'Deep Waters', 'Clear {n} Abyssal Dungeon gates.', 'clear', { content: 'abyss' }, 2, { gold: 200, horn_shard: 6, leapstone: 30 }),
  W('w_chaos', 'Rift Regular', 'Clear {n} Chaos Dungeons.', 'clear', { content: 'chaos' }, 10, { gold: 150, leapstone: 40, fusion: 15 }),
  W('w_guardian', 'Guardian Patrol', 'Defeat {n} guardians.', 'clear', { content: 'guardian' }, 6, { gold: 150, leapstone: 50, solar_blessing: 3 }),
  W('w_hone', 'Anvil Week', 'Attempt honing {n} times.', 'hone', {}, 20, { gold: 200, solar_protection: 1, fusion: 20 }),
  W('w_fish', 'Big Catch', 'Catch {n} fish.', 'gather', { skill: 'fish' }, 30, { gold: 120, pearl: 2, card_pack: 2 }),
  W('w_daily', 'Reliable Wayfarer', 'Complete {n} daily Wayfarer’s Tasks.', 'taskDone', {}, 10, { gold: 250, card_pack_epic: 1, horn_shard: 5 }),
  W('w_inferno', 'Deeper Still', 'Clear {n} Inferno Descent floors.', 'clear', { content: 'inferno' }, 20, { gold: 200, gem_pouch: 2 }),
  W('w_pvp', 'Crucible Regular', 'Win {n} Proving Grounds matches.', 'pvp', { win: true }, 5, { gold: 150, pvp: 300 }),
  W('w_events', 'Event Chaser', 'Take part in {n} world events.', 'clear', { content: ['fieldboss', 'chaosgate', 'island', 'ghostship'] }, 3, { gold: 250, card_pack: 3 }),
];
export const DAILY_OFFER = 6, DAILY_PICK = 3, WEEKLY_OFFER = 5, WEEKLY_PICK = 3;

/** Wayfarer reputation: cumulative points per level (index = level − 1) and level rewards */
export const REP_LEVELS = [0, 500, 1200, 2200, 3500, 5000, 7000, 9500, 12500, 16000];
export const REP_REWARDS = {
  2: { card_pack: 2 }, 3: { skill_potion: 1 }, 4: { gift2: 2, silver: 50000 }, 5: { card_pack_epic: 1 },
  6: { skill_potion: 1 }, 7: { gem_pouch_hi: 1 }, 8: { emotes: ['salute_wayfarer'] }, 9: { skill_potion: 1, card_pack_epic: 1 }, 10: { mounts: ['wayfarer_stag'], titles: ['wayfarer'] },
};

/** World event schedule (UTC). Field boss zones and chaos gate zones rotate by hour. */
export const EVENTS = {
  fieldboss: { name: 'Field Boss: Old Thunderhoof', every: 60, at: 0, dur: 10, where: ['Goldmeadow', 'Thornwood', 'Ashen Ridge'], rows: ['gold', 'leapstone', 'horn_shard', 'card_pack'] },
  chaosgate: { name: 'Chaos Gate', every: 60, at: 30, dur: 10, where: ['Ashen Ridge', 'Thornwood', 'Goldmeadow'], rows: ['gold', 'guardian_stone', 'leapstone', 'horn_shard'] },
  island: { name: 'Adventure Island', every: 120, at: 0, dur: 15, where: ['The Glass Sea'], rows: ['tokens'] },
  ghostship: { name: 'Ghost Ship', days: [4, 0], hours: [12, 16, 20, 23], dur: 20, where: ['The Glass Sea'], rows: ['pirate', 'gold', 'card_pack'] },
};
