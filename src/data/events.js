// World events (the Lost Ark schedule, UTC — the calendar itself lives in src/data/tasks.js EVENTS and
// src/game/systems/tasks.js): which boss each field hosts, AI adventurers who show up, the Chaos Gate wave defense and
// the Adventure Island objectives by reward focus. Runtime: src/game/modes/events.js.

export const WARN_MIN = 5;                 // notify this many minutes before an event starts

/** Field Boss (hourly at :00): the boss each field hosts, how many AI adventurers join, HP scaling. */
export const FIELD_BOSS = {
  byZone: { goldmeadow: 'thunderhoof', thornwood: 'thunderhoof', ashen_ridge: 'cinderhorn' },
  fallback: 'thunderhoof',
  helpers: 6, hpScale: 1.15, minIlvl: 1300, maxIlvl: 1520,
  lines: ['FIELD BOSS UP, everyone to the stones!', 'field boss again lol, who needs the card', 'no one stand in front of it pls', 'break the parts first, destruction bombs ready', 'ty for the carry', 'gg, see you next hour'],
};
/** calendar `where` names → field zone ids */
export const ZONE_BY_NAME = { Goldmeadow: 'goldmeadow', Thornwood: 'thornwood', 'Ashen Ridge': 'ashen_ridge' };

/** Chaos Gate (hourly at :30): a portal at the field's `chaosgate` anchor → a short instanced wave defense. */
export const CHAOS_GATE = {
  zone: 'chaos_rift', island: 3, party: 4, minIlvl: 1100, time: 420, boss: 'gatekeeper', bossHp: 0.6, waveHp: [2.4, 3, 3.6], ticket: 0.3,
  waves: [
    [['imp', 10], ['hellhound', 3]],
    [['imp', 8], ['hellhound', 4], ['legionnaire', 3], ['abyss_caster', 2]],
    [['legionnaire', 4], ['abyss_caster', 3], ['gargoyle', 4], ['brute', 1]],
  ],
  lines: ['gate at :30, who’s in', 'LF3 chaos gate, any ilvl', 'the Gatekeeper counters are free damage', 'gate done, ty all'],
};

/** Adventure Island (every 2 h at :00): one objective per reward focus, then (usually) a boss. */
export const ISLAND_EVENTS = {
  gold: { title: 'Gold Rush', desc: 'Gather the gold coins washed up on the beach before the tide steals them back.', type: 'collect', need: 30, time: 210,
    mobs: [['crab', 1]], boss: { type: 'crab', name: 'The Gilded Crab King', scale: 2.4, hp: 90 }, env: 'day', ground: 'sand' },
  silver: { title: 'Mirror Shards', desc: 'Shatter the mirror crystals that trap the Seven Lights’ reflections.', type: 'destroy', need: 7, time: 210,
    mobs: [['wisp', 3], ['crab', 1]], boss: { type: 'crystal_golem', name: 'The Mirror Warden', scale: 1.5, hp: 70 }, env: 'day', ground: 'grass' },
  cards: { title: 'Lantern Vigil', desc: 'Light the eight lantern shrines before nightfall while the shades try to snuff them out.', type: 'channel', need: 8, time: 240, channel: 2.4,
    mobs: [['wisp', 2], ['wraith', 1]], boss: { type: 'wraith', name: 'The Drowned Lamplighter', scale: 1.6, hp: 80 }, env: 'dusk', ground: 'grass' },
  shards: { title: 'Boiling Tide', desc: 'The reef boils at noon. Hold the beach against the magma crabs.', type: 'survive', need: 75, time: 240,
    mobs: [['crab', 3], ['imp', 1]], boss: { type: 'crab', name: 'The Molten Crab Tyrant', scale: 2.6, hp: 110 }, env: 'dusk', ground: 'rock' },
  pips: { title: 'Runaway Pips', desc: 'The kite-racing Pips have cut their strings. Catch every one before they blow away!', type: 'catch', need: 8, time: 150,
    mobs: [], boss: null, env: 'day', ground: 'grass' },
};
export const ISLAND_NAMES = { gold: 'Gilded Atoll', silver: 'Mirrorwater Isle', cards: 'Lanternfall Isle', shards: 'Ember Reef', pips: 'Whistlewind Rock' };
