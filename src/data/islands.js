// The Glass Sea: ports, the eight islands (gimmick, Island Soul, Pip Seeds, vista, NPCs), sea bounties, treasure spots,
// storms and the sea clock. Pure data + tiny helpers (no three.js) — shared by the sea chart (src/world/sea/chart.js),
// the ocean zone (glass_sea), sailing (src/game/modes/sailing.js) and the islands (src/game/modes/island.js).
//
// Chart coordinates are world metres on the 'glass_sea' zone (x east, z south, north = −Z). Each island zone is built
// in its own local frame; `x, z` below place that frame's origin on the chart (1:1 scale, no rotation), so what you
// see from the ship is the same island you walk on.

/** playable sea rectangle */
export const SEA_BOUNDS = { x0: -760, z0: -600, x1: 760, z1: 600 };
export const SEA_NAME = 'The Glass Sea';

/**
 * Collectible ids. The systems catalogue (src/game/systems/collectibles.js) owns names & reward tiers; these are the
 * ids the sea content hands to `collect(account, char, type, id)`: souls 'soul:<island>', seeds 'seed:islands:<n>',
 * vistas 'vista:<island>', sea bounties 'bounty:<n>'.
 */
export const ISLANDS = [
  {
    id: 'coinflip', zone: 'isle_coinflip', name: 'Coinflip Cay', title: 'The Gilded Gull Casino', x: -330, z: 170, r: 62,
    gimmick: 'casino', music: 'city', ambience: 'city', level: 1,
    blurb: 'A crescent cay where every gull wears a tiny gold chain. The Gilded Gull never closes, and the house almost always wins.',
    soul: { id: 'soul:coinflip', name: 'Soul of Fortune', desc: 'A coin that always lands on its edge.' },
    seeds: ['seed:islands:1', 'seed:islands:2'], vista: 'vista:coinflip',
    dock: { x: 4, z: 58, facing: 0 },         // local: where the Dawnrunner moors (the port on the chart)
    npcs: [
      { id: 'brightpenny', name: 'Baroness Brightpenny', title: 'Proprietress of the Gilded Gull', npc: 'noble', sex: 'f', anchor: 'npc:baroness',
        lines: ['Welcome, welcome! Leave your worries at the door and your silver at the tables.', 'Fifty Gilded Chips and the Coin of the Cay is yours. I have never once regretted that promise. Yet.'] },
      { id: 'bones', name: 'Barnacle Bones', title: 'Dice Dealer', npc: 'pirate', anchor: 'npc:dice',
        lines: ['Roll against old Bones, matey. Higher total takes the pot.', 'I lost my flesh at this table. Kept my luck, though.'] },
      { id: 'croupier', name: 'Marlo Quickfinger', title: 'Keeper of the Sunwheel', npc: 'merchant', anchor: 'npc:slots',
        lines: ['Three suns and the Sunwheel sings!', 'Pull the lever, friend. The wheel is hungry.'] },
      { id: 'gullwatch', name: 'Gull Inspector Pim', title: 'Very Serious Pip', creature: 'pip', anchor: 'npc:pip',
        lines: ['Pip! (It is guarding a very small pile of gold coins with a very large frown.)'] },
    ],
  },
  {
    id: 'songstone', zone: 'isle_songstone', name: 'Songstone Isle', title: 'Where the Statues Sing', x: -300, z: -260, r: 60,
    gimmick: 'songs', music: 'stronghold', ambience: 'meadow', level: 1,
    blurb: 'Five stone Cantors ring a sunken amphitheatre. The wind hums through them, and they remember every song ever played here.',
    soul: { id: 'soul:songstone', name: 'Soul of the Chorus', desc: 'A pebble that hums a different tune in every hand.' },
    seeds: ['seed:islands:3'], vista: 'vista:songstone',
    dock: { x: 6, z: 56, facing: 0 },
    npcs: [
      { id: 'cantrix', name: 'Cantrix Elowen', title: 'Keeper of the Songstone', npc: 'bard', sex: 'f', anchor: 'npc:keeper',
        lines: ['Each Cantor hums a song it once heard. Answer each with the same song and the Songstone will wake.', 'Listen close. The stone never forgets a melody — or a wrong note.'] },
      { id: 'goat', name: 'Old Humphrey', title: 'Goatherd', npc: 'farmer', anchor: 'npc:goatherd',
        lines: ['My goats won’t graze near the statues. Say the humming gives ’em ideas.'] },
    ],
  },
  {
    id: 'powderkeg', zone: 'isle_powderkeg', name: 'Powderkeg Cove', title: 'The Last Free Fort', x: 70, z: -420, r: 66,
    gimmick: 'defense', music: 'sea', ambience: 'sea', level: 1,
    blurb: 'A smugglers’ cove behind an old stone bastion. The Blackgull pirates want it back, and they come in waves.',
    soul: { id: 'soul:powderkeg', name: 'Soul of Gunsmoke', desc: 'Still warm. Smells faintly of victory.' },
    seeds: ['seed:islands:4', 'seed:islands:5'], vista: 'vista:powderkeg',
    dock: { x: -6, z: 60, facing: 0 },
    npcs: [
      { id: 'gunnery', name: 'Gunner Hettie Flint', title: 'Master of the Bastion', npc: 'guard', sex: 'f', anchor: 'npc:gunner',
        lines: ['Man the cannons, Shardbearer! Sink the ships before they land their boats.', 'Three waves, and the Blackgulls will think twice about this cove.'] },
      { id: 'smuggler', name: 'Oswin Tallow', title: 'Retired Smuggler', npc: 'sailor', anchor: 'npc:smuggler',
        lines: ['I only smuggle candles now. Mostly.', 'The pirates pay better than the candles. Don’t tell Hettie.'] },
    ],
  },
  {
    id: 'moonveil', zone: 'isle_moonveil', name: 'Moonveil Atoll', title: 'The Lantern Shrine', x: 430, z: -320, r: 60,
    gimmick: 'lanterns', music: 'city_night', ambience: 'night', level: 1, night: true,
    blurb: 'A ring of pale sand that only rises from the mist after dusk. The drowned light lanterns here, in an order only they remember.',
    soul: { id: 'soul:moonveil', name: 'Soul of the Veil', desc: 'A lantern flame that burns cold and never goes out.' },
    seeds: ['seed:islands:6'], vista: 'vista:moonveil',
    dock: { x: 0, z: 56, facing: 0 },
    npcs: [
      { id: 'lanternkeeper', name: 'Wistful Aldren', title: 'Last Lanternkeeper', npc: 'priest', anchor: 'npc:keeper',
        lines: ['The wisps show the order. Follow them, and the drowned may finally rest.', 'Light them wrong and they get… cross.'] },
    ],
  },
  {
    id: 'stormcrown', zone: 'isle_stormcrown', name: 'Stormcrown Spire', title: 'Heart of the Maelstrom', x: 600, z: 30, r: 54,
    gimmick: 'climb', music: 'field_dark', ambience: 'snow', level: 1,
    blurb: 'A needle of black rock in the eye of an endless storm. At its crown hangs a bell that calls the lightning.',
    soul: { id: 'soul:stormcrown', name: 'Soul of the Tempest', desc: 'A crackling shard of the storm’s own heart.' },
    seeds: ['seed:islands:7', 'seed:islands:8'], vista: 'vista:stormcrown',
    dock: { x: 2, z: 52, facing: 0 },
    npcs: [
      { id: 'stormwarden', name: 'Brother Galewright', title: 'Stormwarden', npc: 'priest', anchor: 'npc:warden',
        lines: ['Climb fast. The storm aims where you stand, not where you are going.', 'Ring the Crown Bell and the Tempest will know your name.'] },
    ],
  },
  {
    id: 'hushwater', zone: 'isle_hushwater', name: 'Hushwater Lagoon', title: 'The Mermaid’s Rest', x: 380, z: 250, r: 62,
    gimmick: 'mermaid', music: 'stronghold', ambience: 'sea', level: 1,
    blurb: 'A reef-ringed lagoon so calm the stars can see themselves. Coralie the mermaid sings here, when she trusts you.',
    soul: { id: 'soul:hushwater', name: 'Soul of the Tide-Song', desc: 'A shell that whispers lullabies.' },
    seeds: ['seed:islands:9'], vista: 'vista:hushwater',
    dock: { x: -4, z: 58, facing: 0 },
    npcs: [
      { id: 'coralie', name: 'Coralie', title: 'Mermaid of Hushwater', npc: 'oracle', sex: 'f', anchor: 'npc:mermaid', mermaid: true,
        lines: ['Oh! A surface-dweller. You have kind eyes… and very dry hair.', 'Bring me pearls from the beds and sing me the tides, and perhaps I will sing for you.'] },
      { id: 'pearler', name: 'Nessa Brine', title: 'Pearl Diver', npc: 'fisher', sex: 'f', anchor: 'npc:diver',
        lines: ['Bubbles mean pearls. Time your dive and you’ll come up grinning.', 'Coralie likes the round ones. So do I.'] },
    ],
  },
  {
    id: 'shellback', zone: 'isle_shellback', name: 'Shellback Isle', title: 'The Sleeping Giant', x: 60, z: 360, r: 64,
    gimmick: 'turtle', music: 'pip', ambience: 'meadow', level: 1,
    blurb: 'Not an island at all, but Grandmother Shellback, a turtle older than the Sundering. The Pips run a market on her back.',
    soul: { id: 'soul:shellback', name: 'Soul of the Ancient Shell', desc: 'A scale of shell, warm as a sleeping heart.' },
    seeds: ['seed:islands:10', 'seed:islands:11'], vista: 'vista:shellback',
    dock: { x: 8, z: 62, facing: 0 },
    npcs: [
      { id: 'pipmerchant', name: 'Merchant Nib', title: 'Shell Market', creature: 'pip', variant: 'merchant', anchor: 'npc:market',
        lines: ['Pip-pip! (Nib points at a crate of seaweed, then at the turtle’s enormous mouth, then at you.)'] },
      { id: 'pipelder', name: 'Elder Knotwhisker', title: 'Shell Elder', creature: 'pip', variant: 'elder', anchor: 'npc:elder',
        lines: ['Pip… pip. (The elder mimes a huge yawn and a very long nap.)'] },
      { id: 'pipguard', name: 'Sprig', title: 'Snore Watch', creature: 'pip', variant: 'guard', anchor: 'npc:guard',
        lines: ['PIP! (Sprig braces dramatically. Something is about to snore.)'] },
    ],
  },
  {
    id: 'drownbell', zone: 'isle_drownbell', name: 'Drownbell Shoal', title: 'The Bell Beneath', x: -60, z: -60, r: 58,
    gimmick: 'bell', music: 'sea', ambience: 'sea', level: 1,
    blurb: 'The drowned chapel’s bell still rings at low tide. Fishermen say something answers it from the deep.',
    soul: { id: 'soul:drownbell', name: 'Soul of the Deep Bell', desc: 'A green-bronze clapper that tolls underwater.' },
    seeds: ['seed:islands:12'], vista: 'vista:drownbell',
    dock: { x: 0, z: 56, facing: 0 },
    npcs: [
      { id: 'bellfisher', name: 'Grizzel Hookhand', title: 'Shoal Fisher', npc: 'fisher', anchor: 'npc:fisher',
        lines: ['Ring that bell three times and the Bellwarden comes up for a look. Then it comes up for a snack.', 'Its shell is the old chapel tower. Crabs will wear anything.'] },
    ],
  },
];
export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map(i => [i.id, i]));
export const ISLAND_BY_ZONE = Object.fromEntries(ISLANDS.map(i => [i.zone, i]));

/**
 * Ports on the chart (the anchors `port:<id>` of the glass_sea zone). `zone` + `anchor` say where docking takes you
 * (`kind`: how to enter it; `launch` = a registered content kind to start instead of loading the zone directly).
 * Islands add theirs automatically from ISLANDS (dock position + island origin).
 */
export const PORTS = {
  solhaven: { id: 'solhaven', name: 'Solhaven', title: 'Capital of Valemont', x: -548, z: 30, facing: -Math.PI / 2, zone: 'solhaven', anchor: 'dock:ship', kind: 'city', region: 'Valemont' },
  stronghold: { id: 'stronghold', name: 'Brightwater Isle', title: 'Your stronghold', x: -436, z: 346, facing: Math.PI, zone: 'stronghold', anchor: 'dock:ship', kind: 'stronghold', launch: 'stronghold', region: 'Stronghold' },
  pipsprout: { id: 'pipsprout', name: 'Pipsprout Hollow', title: 'Home of the Pips', x: -466, z: -376, facing: Math.PI, zone: 'pipsprout', anchor: 'dock:ship', kind: 'field', launch: 'pipsprout', region: 'Pipsprout Hollow' },
};
// port facing = the ship's heading when it casts off (out to sea); island docks are on the south shore
for (const I of ISLANDS) PORTS[I.id] = { id: I.id, name: I.name, title: I.title, x: I.x + I.dock.x, z: I.z + I.dock.z + 14, facing: Math.PI, zone: I.zone, anchor: 'spawn', kind: 'island', region: SEA_NAME, island: I.id };
/** where Solhaven sits on the chart: chart = solhaven zone coords + this offset (the zone's sea level −3 is the chart's 0) */
export const SOLHAVEN_OFFSET = { x: -643.5, y: 3, z: 24 };

/** Non-island landmarks on the chart (silhouettes only): Brightwater Isle and Pipsprout Hollow. */
export const LANDMARKS = [
  { id: 'brightwater', name: 'Brightwater Isle', x: -440, z: 300, r: 44, kind: 'stronghold', dock: { x: 4, z: 34 } },
  { id: 'pipsprout', name: 'Pipsprout Hollow', x: -470, z: -430, r: 56, kind: 'pipsprout', dock: { x: 4, z: 42 } },
];

/**
 * Weather on the chart. storms hurt the hull while you are inside (dps = durability per second at the eye).
 * `drift` storms wander on a circle (cx, cz, orbit radius, period in seconds). `mist` is calm but blinding.
 */
export const STORMS = [
  { id: 'maelstrom', name: 'The Maelstrom', x: 600, z: 30, r: 190, dps: 7, eye: 60, kind: 'storm' },
  { id: 'squall', name: 'Wandering Squall', x: 150, z: 150, r: 105, dps: 4, kind: 'storm', drift: { cx: 170, cz: 120, R: 150, period: 420 } },
  { id: 'veil', name: 'The Moonveil Mist', x: 430, z: -320, r: 150, dps: 0, kind: 'mist' },
];

/** Sea Bounties (the 10 collectibles): found in floating flotsam, treasure spots and sea monsters. */
export const SEA_BOUNTIES = [
  { id: 'bounty:1', name: 'Captain Hollowgale’s Spyglass' }, { id: 'bounty:2', name: 'The Drowned Ledger' },
  { id: 'bounty:3', name: 'Mermaid’s Tortoiseshell Comb' }, { id: 'bounty:4', name: 'Bottled Storm' },
  { id: 'bounty:5', name: 'Serpent Scale Compass' }, { id: 'bounty:6', name: 'Barnacled Crown' },
  { id: 'bounty:7', name: 'Message in a Very Small Bottle' }, { id: 'bounty:8', name: 'Kraken Ink Map' },
  { id: 'bounty:9', name: 'Ghostlight Lantern' }, { id: 'bounty:10', name: 'The Glass Sea’s First Pearl' },
];

/** Treasure-map spots (an X on the chart; dredge there with a Treasure Map). */
export const TREASURE_SPOTS = [
  { id: 't1', x: -230, z: 20 }, { id: 't2', x: 250, z: -200 }, { id: 't3', x: -120, z: 470 }, { id: 't4', x: 520, z: 330 },
  { id: 't5', x: -20, z: -300 }, { id: 't6', x: 330, z: -470 }, { id: 't7', x: -420, z: -120 }, { id: 't8', x: 260, z: 40 },
];

/** Pirate waters (more patrols) and serpent grounds on the chart. */
export const DANGER = [
  { id: 'blackgull', name: 'Blackgull Waters', x: 250, z: -360, r: 240, kind: 'pirate' },
  { id: 'teeth', name: 'The Serpent’s Teeth', x: 230, z: -130, r: 140, kind: 'serpent' },
  { id: 'deep', name: 'The Glass Deep', x: 180, z: 470, r: 200, kind: 'serpent' },
];

// ------------------------------------------------------------------------------------------------ sea clock
/** Real minutes per in-game day on the Glass Sea (and its islands). */
export const DAY_MINUTES = 40;
/** In-game hour 0..24 (override for tests: globalThis.__seaHour = 22). */
export function seaHour(now = Date.now()) {
  if (typeof globalThis !== 'undefined' && globalThis.__seaHour != null) return +globalThis.__seaHour;
  const d = now / 60000 / DAY_MINUTES;
  return ((d - Math.floor(d)) * 24 + 9) % 24;
}
export const isNight = (h = seaHour()) => h >= 19.5 || h < 5;
/** 0 day … 1 deep night, smooth through dusk (18–20.5) and dawn (4–6). */
export function nightAmount(h = seaHour()) {
  const s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  return h >= 12 ? s(18, 20.5, h) : 1 - s(4, 6, h);
}
/** minutes (real) until the next in-game night starts */
export function minutesToNight(now = Date.now()) {
  const h = seaHour(now); if (isNight(h)) return 0;
  const dh = (19.5 - h + 24) % 24; return dh / 24 * DAY_MINUTES;
}

/** A readable compass point for a facing (model convention: forward = (−sin f, −cos f), 0 = north). */
export function compassPoint(facing) {
  const deg = ((-facing * 180 / Math.PI) % 360 + 360) % 360;   // clockwise from north
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}
