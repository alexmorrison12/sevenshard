// SimPlayer identities: fantasy names built from syllables plus a sprinkle of very-online MMO names, titles and guilds.
import { RNG } from '../../core/noise.js';

const A = ['Ae', 'Ka', 'Ly', 'Mo', 'Se', 'Va', 'Ri', 'Thal', 'Dra', 'Ny', 'Eli', 'Ar', 'Zy', 'Ka', 'Mi', 'Fae', 'Or', 'Bel', 'Cor', 'Isa', 'Jun', 'Rey', 'Sol', 'Tae', 'Vel', 'Xan', 'Yu', 'Ze', 'Ash', 'Bri', 'Cae', 'Del', 'Em', 'Fi', 'Gal', 'Hel', 'Ira', 'Kai', 'Lor', 'Mae', 'Nor', 'Oli', 'Pry', 'Quin', 'Ros', 'Sy', 'Tor', 'Ul', 'Vi', 'Wyn'];
const B = ['ra', 'lis', 'vyn', 'dor', 'nia', 'thas', 'mir', 'wen', 'ric', 'lyn', 'sar', 'vek', 'nor', 'ssa', 'rith', 'la', 'dris', 'ven', 'thys', 'mar', 'ka', 'rion', 'sha', 'lor', 'zen', 'ria', 'dan', 'fyr', 'gar', 'hild'];
const C = ['', '', '', 'a', 'el', 'is', 'on', 'yn', 'ia', 'ar'];
const MEME = ['Pipslayer', 'Honingcopium', 'SupportMain', 'TotallyNotBot', 'SirTapsALot', 'Artisan100', 'OneMoreTap', 'NinetySevenStone', 'CounterKing', 'StaggerEnjoyer', 'DashIntoWall', 'BrandMeDaddy', 'ShieldPlz', 'GoldMaker', 'AlwaysLate', 'AFKinTown', 'DoggoDestroyer', 'SeedHunter', 'RestedBonus', 'FusionMats', 'PerfectZone', 'WipeCaller', 'PizzaSlicer', 'BackAttacker', 'HeadHunter', 'ChaosEnjoyer', 'BidWarrior', 'MariShopper', 'GemFuser', 'LeapstoneLad'];
export const TITLES = ['Seed Seeker', 'Horn Breaker', 'Frostbitten', 'The Unstaggerable', 'Island Hopper', 'Pip Whisperer', 'Master Angler', 'Hellwalker', 'Artisan', 'Shardbearer', 'Legion Slayer', 'Sea Wolf', 'The Lucky', 'Stone Cutter', 'Tome Keeper', 'Rift Diver', null, null, null, null];
export const GUILDS = ['Dawnforged', 'Salt & Steel', 'The Rested Bonus', 'Pip Appreciation Society', 'Horned Helm', 'Glass Sea Rovers', 'Counterplay', 'Last Refrain', 'Brightwater Co.', 'Bid Wars', 'Ninety Seven', 'Gate Crashers', null, null, null];
const CLS = ['reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound'];
const PERSONA = ['tryhard', 'veteran', 'veteran', 'casual', 'casual', 'casual', 'clueless', 'afk'];

export function simName(rng) {
  if (rng.next() < 0.18) { const n = rng.pick(MEME); return rng.next() < 0.4 ? n + rng.int(1, 99) : n; }
  let n = rng.pick(A) + rng.pick(B) + rng.pick(C);
  if (rng.next() < 0.15) n = n + n.slice(-1);
  return n.slice(0, 14);
}

/** A SimPlayer roster entry: name, class, sex, persona, title, guild, item level, look seed. */
export function makeSim(seed, o = {}) {
  const rng = new RNG(seed);
  const cls = o.cls || rng.pick(CLS);
  return {
    sim: true, name: o.name || simName(rng), cls, sex: rng.next() < 0.5 ? 'm' : 'f', persona: o.persona || rng.pick(PERSONA),
    title: rng.pick(TITLES), guild: rng.pick(GUILDS), ilvl: o.ilvl || Math.round(1340 + rng.next() * 180),
    look: { face: rng.int(0, 5), hair: rng.int(0, 7), hairColor: rng.pick([0x1a1410, 0x3a2412, 0x7a4a22, 0xd8b070, 0xe8e0d0, 0x8a1a1a, 0x2a3a6a, 0x9a8ac8, 0x101010]), skin: rng.int(0, 7), eyes: rng.pick([0x3a6ab0, 0x5a8a3a, 0x7a4a1a, 0x9a3ab0, 0xc8a030]), height: 0.95 + rng.next() * 0.1, build: rng.next(), marks: rng.int(0, 3), markColor: rng.pick([0xc03030, 0x3060c0, 0x202020, 0xd0a040]) },
    gear: { tier: rng.next() < 0.35 ? 2 : 1, dye: null },
    seed,
  };
}
