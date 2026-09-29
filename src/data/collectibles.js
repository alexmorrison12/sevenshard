// Collectibles & the Adventure Tome. Positions are placed by the world/content owners by id; entries carry a zone and
// a hint. Zones: solhaven, goldmeadow, thornwood, ashen_ridge, pipsprout, islands.
//   COLLECTIBLES[type] = { id, name, icon, items: [{ id, name, zone, hint, source }], tiers: [{ n, bundle }] }
//   ISLANDS: the 8 islands of the Glass Sea.   TOME[region]: Adventure Tome entries & completion rewards.
export const ZONES = ['solhaven', 'goldmeadow', 'thornwood', 'ashen_ridge', 'pipsprout', 'islands'];
export const ZONE_NAMES = { solhaven: 'Solhaven', goldmeadow: 'Goldmeadow', thornwood: 'Thornwood', ashen_ridge: 'Ashen Ridge', pipsprout: 'Pipsprout Hollow', islands: 'The Glass Sea' };

// ------------------------------------------------------------------------------------------------ islands
export const ISLAND_LIST = [
  { id: 'lanternfall', name: 'Lanternfall Isle', focus: 'cards', gimmick: 'Every night the islanders release paper lanterns over the bay. Light all twelve shrines before dawn.', soul: 'Light all twelve lantern shrines in one night.' },
  { id: 'brinehollow', name: 'Brinehollow', focus: null, gimmick: 'A half-sunken fishing village where the sea witch Morwenna trades riddles for secrets.', soul: 'Answer Old Morwenna’s three riddles.' },
  { id: 'gilded_atoll', name: 'Gilded Atoll', focus: 'gold', gimmick: 'A ring of golden sand that only surfaces for Adventure Island events.', soul: 'A rare find in the Gilded Atoll event chest.' },
  { id: 'whistlewind', name: 'Whistlewind Rock', focus: 'pips', gimmick: 'Windy cliffs where Pips race kites on the updrafts — and cheat shamelessly.', soul: 'Win the Pip kite race.' },
  { id: 'ember_reef', name: 'Ember Reef', focus: 'shards', gimmick: 'A volcanic reef of fire crabs; at noon the tide boils.', soul: 'Defeat the Molten Crab Tyrant at high tide.' },
  { id: 'mirrorwater', name: 'Mirrorwater Isle', focus: 'silver', gimmick: 'A lagoon so still it reflects the Seven Lights that are no longer in the sky.', soul: 'Find the seven reflections of the Lights.' },
  { id: 'hushwater', name: 'Hushwater Atoll', focus: null, gimmick: 'A silent island where a giant turtle sleeps. Speak, and it wakes up grumpy.', soul: 'Play the Lullaby of Rest to the sleeping turtle.' },
  { id: 'skyreach', name: 'Skyreach Spire', focus: null, gimmick: 'A needle of rock above the clouds, climbed by rope bridges and bad decisions.', soul: 'Reach the summit without falling once.' },
];
export const ISLANDS = Object.fromEntries(ISLAND_LIST.map(i => [i.id, i]));
/** Adventure Island rotation (tasks.js calendar): islands with a reward focus */
export const ADVENTURE_ISLANDS = ISLAND_LIST.filter(i => i.focus).map(i => i.id);

// ------------------------------------------------------------------------------------------------ pip seeds
const SPOTS = {
  solhaven: ['the blacksmith’s chimney', 'the market flower boxes', 'the fishing pier', 'the statue of the Seven Lights', 'the harbour warehouse barrels', 'the triport crystal', 'the noble gardens waterfall', 'the cathedral belfry', 'the greengrocer’s pumpkins', 'the guild hall banner', 'the stable hay loft', 'the song teacher’s bench', 'the fountain lily pads', 'the lighthouse lantern', 'the ferry crates', 'the bird nest on the wall'],
  goldmeadow: ['the old windmill', 'the scarecrow field', 'the bandit camp', 'the beehive orchard', 'the stone bridge', 'the wheat maze', 'the hermit’s hut', 'the wolf den', 'the sunflower hill', 'the ruined watchtower', 'the millpond', 'the hay wagon', 'the shrine of dawn', 'the boar wallow'],
  thornwood: ['the hollow oak', 'the spider nests', 'the cultist altar', 'the moonlit pool', 'the toadstool ring', 'the fallen giant tree', 'the witch lights', 'the thorn arch', 'the treant grove', 'the abandoned logging camp', 'the owl roost', 'the misty creek'],
  ashen_ridge: ['the demon fortress gate', 'the lava falls', 'the scorched village', 'the obsidian spires', 'the old mine cart track', 'the burned chapel', 'the sulphur vents', 'the broken siege engine', 'the ash dunes', 'the Legion banners'],
  pipsprout: ['the giant red mushroom', 'the dewdrop pond', 'Bramblebeard’s porch', 'the acorn tower', 'the snail stables', 'the dandelion clock', 'the ladybug bridge', 'the thimble well', 'the moss library', 'the berry market', 'the sleepy caterpillar', 'the root tunnels', 'the petal theatre', 'the seed vault door'],
  islands: ['the Lanternfall shrines', 'the Brinehollow rooftops', 'the Gilded Atoll dunes', 'the Whistlewind kite launch', 'the Ember Reef crab nests', 'the Mirrorwater shallows', 'the Hushwater turtle shell', 'the Skyreach rope bridge'],
};
const WHERE = ['On top of', 'Behind', 'Under', 'Inside', 'At the foot of', 'Beside', 'Above', 'Tucked into'];
const SEED_COUNTS = { solhaven: 16, goldmeadow: 24, thornwood: 22, ashen_ridge: 18, pipsprout: 28, islands: 12 };
function seedHint(zone, i) {
  const spots = SPOTS[zone], s = spots[i % spots.length], w = WHERE[(i * 3 + Math.floor(i / spots.length) * 5 + zone.length) % WHERE.length];
  return `${w} ${s}.`;
}
export const SEEDS = ZONES.flatMap(zone => Array.from({ length: SEED_COUNTS[zone] }, (_, i) => ({ id: `seed:${zone}:${i + 1}`, name: `Pip Seed #${i + 1}`, zone, hint: seedHint(zone, i), source: 'Found in the world' })));

// ------------------------------------------------------------------------------------------------ other collectibles
const I = (id, name, zone, hint, source) => ({ id, name, zone, hint, source });
export const SOULS = ISLAND_LIST.map(i => I(`soul:${i.id}`, `Island Soul of ${i.name}`, 'islands', i.soul, i.name));
export const HEARTS = [
  I('heart:grumhald', 'Heart of Old Grumhald', 'ashen_ridge', 'The mountain giant sleeps under the ash. Wake him with a Ballad of Valor.', 'Named foe: Old Grumhald'),
  I('heart:tidebearer', 'Heart of Tidebearer', 'islands', 'The drowned giant’s heart rides the Ghost Ship’s hold.', 'Ghost Ship (rare)'),
  I('heart:thornking', 'Heart of the Thornking', 'thornwood', 'The Thornking asks a riddle once a day. Answer it.', 'Thornwood riddle'),
  I('heart:brighthold', 'Heart of Brighthold’s Warden', 'solhaven', 'Commander Brannoc guards it. Earn his trust.', 'Rapport: Brannoc (Honored)'),
  I('heart:colossus', 'Heart of the Glass Colossus', 'islands', 'Mirrorwater’s colossus reflects everything but its own heart.', 'Mirrorwater Isle'),
  I('heart:ember_titan', 'Heart of the Ember Titan', 'ashen_ridge', 'Deep below the ridge, floor fifty of the Inferno.', 'Inferno Descent floor 50'),
];
export const MASTERPIECES = [
  I('art:1', 'Masterpiece I: Sunrise over Solhaven', 'solhaven', 'Sold by the art dealer on market days.', 'Vendor (pirate coins)'),
  I('art:2', 'Masterpiece II: The Siege of Brighthold', 'solhaven', 'Commander Brannoc keeps it in a locked chest.', 'Rapport: Brannoc (Trusted)'),
  I('art:3', 'Masterpiece III: Pips at Play', 'pipsprout', 'Hung upside down in the moss library.', 'Pipsprout Hollow'),
  I('art:4', 'Masterpiece IV: The Glass Sea at Dusk', 'islands', 'Captain Mirelle traded her ship’s bell for it.', 'Rapport: Mirelle (Honored)'),
  I('art:5', 'Masterpiece V: Portrait of the Seven Lights', 'thornwood', 'In the cultists’ altar room, oddly well kept.', 'Thornwood'),
  I('art:6', 'Masterpiece VI: The Horned Tyrant', 'ashen_ridge', 'Legion propaganda, confiscated.', 'Legion Raid: Gorrath'),
  I('art:7', 'Masterpiece VII: Lanterns on the Water', 'islands', 'Lanternfall Isle’s festival prize.', 'Lanternfall Isle'),
  I('art:8', 'Masterpiece VIII: Old Thunderhoof', 'goldmeadow', 'Painted by someone standing far too close.', 'Proving Grounds vendor'),
  I('art:9', 'Masterpiece IX: The Sea Witch', 'islands', 'Morwenna swears it does not look like her.', 'Rapport: Morwenna (Trusted)'),
  I('art:10', 'Masterpiece X: The Sundering', 'solhaven', 'Seraphine dreams of it every night.', 'Rapport: Seraphine (Devoted)'),
];
export const STARS = [
  I('star:1', 'Omnium Star: First Light', 'goldmeadow', 'Fell into the millpond on the night of the Sundering.', 'Goldmeadow'),
  I('star:2', 'Omnium Star: Tide Glimmer', 'islands', 'Sea Bounty board, third column.', 'Sea Bounty rewards'),
  I('star:3', 'Omnium Star: Thorn Spark', 'thornwood', 'The owls hoard it. Ask nicely.', 'Thornwood'),
  I('star:4', 'Omnium Star: Ember Mote', 'ashen_ridge', 'Glowing in the sulphur vents.', 'Ashen Ridge'),
  I('star:5', 'Omnium Star: Pip Twinkle', 'pipsprout', 'Tumbleroot found it and will not stop talking about it.', 'Rapport: Tumbleroot (Trusted)'),
  I('star:6', 'Omnium Star: Skyreach Beacon', 'islands', 'At the very top of Skyreach Spire.', 'Skyreach Spire'),
  I('star:7', 'Omnium Star: Crucible Flame', 'solhaven', 'Awarded to fighters of renown.', 'Proving Grounds vendor'),
  I('star:8', 'Omnium Star: Hollow Wish', 'islands', 'Hushwater’s turtle dreams of it.', 'Hushwater Atoll'),
];
export const BOUNTIES = [
  I('bounty:redgull', 'Bounty: Captain Redgull', 'islands', 'A pirate who robs merchant ships for their biscuits.', 'Sea combat'),
  I('bounty:brine_maw', 'Bounty: the Brine Maw', 'islands', 'A sea serpent that surfaces in storms.', 'Sea combat (storm)'),
  I('bounty:kraken_arm', 'Bounty: the Lonely Tentacle', 'islands', 'Only one tentacle was ever seen. Where is the rest?', 'Sea combat'),
  I('bounty:hollowgale', 'Bounty: Captain Hollowgale', 'islands', 'Commands the Ghost Ship on Thursdays and Sundays.', 'Ghost Ship'),
  I('bounty:saltfang', 'Bounty: Saltfang the Shark', 'islands', 'Circles Ember Reef when the tide boils.', 'Ember Reef'),
  I('bounty:twin_sails', 'Bounty: the Twin Sails', 'islands', 'Two smugglers, one ship, zero shame.', 'Sea combat'),
  I('bounty:mistwraith', 'Bounty: the Mistwraith', 'islands', 'Appears only in fog near Brinehollow.', 'Brinehollow'),
  I('bounty:ironhull', 'Bounty: the Ironhull', 'islands', 'A Legion warship lost in the Glass Sea.', 'Sea combat'),
  I('bounty:pearl_thief', 'Bounty: the Pearl Thief', 'islands', 'Steals pearls from fishermen. Very politely.', 'Fishing spots'),
  I('bounty:stormcaller', 'Bounty: the Stormcaller', 'islands', 'A sea witch rival of Morwenna. Do not tell her.', 'Sea combat (storm)'),
];
export const LEAVES = [
  I('leaf:1', 'World Tree Leaf: Dawnleaf', 'goldmeadow', 'Blown onto the scarecrow’s hat.', 'Goldmeadow'),
  I('leaf:2', 'World Tree Leaf: Duskleaf', 'thornwood', 'The treants guard it jealously.', 'Thornwood'),
  I('leaf:3', 'World Tree Leaf: Emberleaf', 'ashen_ridge', 'Somehow unburnt among the ashes.', 'Ashen Ridge'),
  I('leaf:4', 'World Tree Leaf: Dewleaf', 'pipsprout', 'Bramblebeard uses it as an umbrella.', 'Rapport: Bramblebeard (Friendly)'),
  I('leaf:5', 'World Tree Leaf: Tideleaf', 'islands', 'Floating in Mirrorwater’s lagoon.', 'Mirrorwater Isle'),
  I('leaf:6', 'World Tree Leaf: Skyleaf', 'islands', 'Caught on Skyreach’s highest ledge.', 'Skyreach Spire'),
];
export const VISTAS = [
  I('vista:lighthouse', 'Sunset from the Solhaven Lighthouse', 'solhaven', 'Climb the lighthouse at dusk.', 'Solhaven'),
  I('vista:cathedral', 'The Cathedral Rooftops', 'solhaven', 'The belfry has the best view in the city.', 'Solhaven'),
  I('vista:windmill', 'Goldmeadow from the Windmill', 'goldmeadow', 'The sails turn slowly enough to ride.', 'Goldmeadow'),
  I('vista:sunflower', 'Sunflower Hill', 'goldmeadow', 'Every flower faces you. Unsettling.', 'Goldmeadow'),
  I('vista:moonpool', 'The Moonlit Pool', 'thornwood', 'Only at night.', 'Thornwood'),
  I('vista:giant_tree', 'Atop the Fallen Giant', 'thornwood', 'Walk the trunk to its broken end.', 'Thornwood'),
  I('vista:lava_falls', 'The Lava Falls', 'ashen_ridge', 'Stand close. Not that close.', 'Ashen Ridge'),
  I('vista:fortress', 'The Fortress Walls', 'ashen_ridge', 'Where Varkhul watched the valley burn.', 'Ashen Ridge'),
  I('vista:mushroom', 'The Giant Red Mushroom', 'pipsprout', 'The Pips will pretend they did not see you climb it.', 'Pipsprout Hollow'),
  I('vista:petal', 'The Petal Theatre', 'pipsprout', 'Front row seat, very small chair.', 'Pipsprout Hollow'),
  I('vista:skyreach', 'Above the Clouds', 'islands', 'The summit of Skyreach Spire.', 'Skyreach Spire'),
  I('vista:lanterns', 'A Thousand Lanterns', 'islands', 'Lanternfall Isle, festival night.', 'Lanternfall Isle'),
];

// ------------------------------------------------------------------------------------------------ reward tiers
const T = (n, bundle) => ({ n, bundle });
export const COLLECTIBLES = {
  seeds: { id: 'seeds', name: 'Pip Seeds', icon: 'item:pip_seed', items: SEEDS, tiers: [
    T(5, { rosterXp: 500, card_pack_pip: 1 }), T(10, { skill_potion: 1 }), T(15, { food3: 3, silver: 20000 }), T(20, { titles: ['seed_seeker'], card_pack_pip: 2 }),
    T(25, { skill_potion: 1 }), T(30, { card_pack_epic: 1, rosterXp: 1000 }), T(40, { pets: ['pip_pet'] }), T(50, { skill_potion: 1, cards: { bramblebeard: 1 } }),
    T(60, { mounts: ['snail_steed'] }), T(70, { skill_potion: 1 }), T(80, { emotes: ['pip_dance'], card_pack_pip: 3 }), T(90, { gem_pouch_hi: 1, rosterXp: 2000 }),
    T(100, { skill_potion: 1, titles: ['pip_whisperer'] }), T(110, { card_pack_legend: 1 }), T(120, { mounts: ['sunbloom_wagon'], titles: ['keeper_of_the_hollow'], skill_potion: 1 }),
  ] },
  souls: { id: 'souls', name: 'Island Souls', icon: 'item:island_soul', items: SOULS, tiers: [
    T(1, { skill_potion: 1 }), T(2, { pirate: 500 }), T(3, { skill_potion: 1 }), T(4, { titles: ['island_hopper'] }), T(5, { skill_potion: 1 }), T(6, { mounts: ['tidestrider'] }), T(7, { skill_potion: 1 }), T(8, { unlocks: ['ship:skin:soulsail'], titles: ['soul_of_the_sea'] }),
  ] },
  hearts: { id: 'hearts', name: 'Giant’s Hearts', icon: 'item:giants_heart', items: HEARTS, tiers: [
    T(1, { skill_potion: 1 }), T(2, { skill_potion: 1 }), T(3, { skill_potion: 1, card_pack_epic: 1 }), T(4, { skill_potion: 1 }), T(5, { skill_potion: 1 }), T(6, { skill_potion: 1, titles: ['giantsoul'] }),
  ] },
  masterpieces: { id: 'masterpieces', name: 'Masterpieces', icon: 'item:masterpiece', items: MASTERPIECES, tiers: [
    T(2, { silver: 50000 }), T(4, { skill_potion: 1 }), T(6, { emotes: ['applaud_art'] }), T(8, { skill_potion: 1 }), T(10, { titles: ['art_patron'], pets: ['paint_owlet'] }),
  ] },
  stars: { id: 'stars', name: 'Omnium Stars', icon: 'item:omnium_star', items: STARS, tiers: [
    T(2, { card_pack: 3 }), T(4, { skill_potion: 1 }), T(6, { card_pack_epic: 2 }), T(8, { skill_potion: 1, titles: ['star_gazer'] }),
  ] },
  bounties: { id: 'bounties', name: 'Sea Bounties', icon: 'item:sea_bounty', items: BOUNTIES, tiers: [
    T(2, { pirate: 300 }), T(4, { unlocks: ['ship:skin:bountyhunter'] }), T(6, { skill_potion: 1 }), T(8, { pirate: 1000 }), T(10, { titles: ['bounty_hunter'], skill_potion: 1 }),
  ] },
  leaves: { id: 'leaves', name: 'World Tree Leaves', icon: 'item:world_leaf', items: LEAVES, tiers: [
    T(2, { life_tonic: 3 }), T(4, { skill_potion: 1 }), T(6, { titles: ['leaf_warden'], skill_potion: 1 }),
  ] },
  vistas: { id: 'vistas', name: 'Vistas', icon: 'ui:photo', items: VISTAS, tiers: [
    T(3, { rosterXp: 800 }), T(6, { emotes: ['sightsee'] }), T(9, { card_pack_epic: 1 }), T(12, { titles: ['wanderer'], mounts: ['cloud_glider'] }),
  ] },
};
export const COLLECT_TYPES = Object.keys(COLLECTIBLES);
/** display names for unlocks granted by collectibles (mounts, pets, emotes, ship skins) */
export const UNLOCK_NAMES = {
  mounts: { snail_steed: { name: 'Snail Steed', grade: 4 }, sunbloom_wagon: { name: 'Sunbloom Pip Wagon', grade: 6 }, tidestrider: { name: 'Tidestrider', grade: 5 }, cloud_glider: { name: 'Cloud Glider', grade: 5 }, wayfarer_stag: { name: 'Wayfarer’s Sunstag', grade: 5 }, guild_warhorse: { name: 'Guild Warhorse', grade: 4 }, crystal_direwolf: { name: 'Crystal Direwolf', grade: 5 } },
  pets: { pip_pet: { name: 'Pip Buddy', grade: 4 }, paint_owlet: { name: 'Painted Owlet', grade: 4 }, foxling: { name: 'Foxling', grade: 3 }, slimelet: { name: 'Slimelet', grade: 3 } },
  emotes: { pip_dance: { name: 'Pip Dance', grade: 4 }, applaud_art: { name: 'Applaud', grade: 3 }, sightsee: { name: 'Sightsee', grade: 3 } },
  unlocks: { 'ship:skin:soulsail': { name: 'Soulsail (ship skin)', grade: 5 }, 'ship:skin:bountyhunter': { name: 'Bounty Hunter (ship skin)', grade: 4 } },
};

// ------------------------------------------------------------------------------------------------ adventure tome
const E = (id, name, hint = '') => ({ id, name, hint });
export const TOME = {
  solhaven: { name: 'Solhaven', zone: 'solhaven',
    bosses: [],
    npcs: [E('brannoc', 'Commander Brannoc Hale'), E('seraphine', 'Seraphine'), E('blacksmith', 'Hilda Ironbrand'), E('market', 'Orrin Vale'), E('harbor', 'Captain Mirelle Stormwake'), E('songs', 'Lyra Songwind'), E('rapport1', 'Wren Ashdown'), E('rapport2', 'Old Maren'), E('rapport3', 'Pip Tumbleroot')],
    lore: [E('lore:founding', 'The Founding of Solhaven', 'Cathedral library'), E('lore:seven_lights', 'The Seven Lights', 'Seraphine’s study'), E('lore:harbor', 'Tides and Tariffs', 'Harbor office')],
    cuisine: [E('food2', 'Fisher’s Pie', 'Eat one')] },
  goldmeadow: { name: 'Goldmeadow', zone: 'goldmeadow',
    bosses: [E('thunderhoof', 'Old Thunderhoof', 'Hourly field boss'), E('bandit_king', 'Rusk the Bandit King', 'Bandit camp')],
    npcs: [E('farmer_hale', 'Farmer Hale'), E('miller', 'The Miller'), E('hermit', 'The Hermit of the Hill')],
    lore: [E('lore:harvest', 'The Harvest Songs'), E('lore:windmill', 'Why the Windmill Turns Backwards')],
    cuisine: [E('food1', 'Hearty Stew', 'Eat one')] },
  thornwood: { name: 'Thornwood', zone: 'thornwood',
    bosses: [E('broodmother', 'The Broodmother', 'Spider nests'), E('thornking', 'The Thornking', 'Hollow oak')],
    npcs: [E('woodcutter', 'Old Woodcutter Bex'), E('owl_sage', 'Hoot the Owl Sage'), E('cult_defector', 'A Nervous Cultist')],
    lore: [E('lore:thorn_cult', 'The Thorn Cult'), E('lore:treants', 'Speaking with Treants'), E('lore:spiders', 'On Spiders, Regrettably')],
    cuisine: [] },
  ashen_ridge: { name: 'Ashen Ridge', zone: 'ashen_ridge',
    bosses: [E('varkhul', 'Varkhul the Ravager', 'The fortress'), E('grumhald', 'Old Grumhald', 'Under the ash')],
    npcs: [E('refugee', 'Brighthold Refugee'), E('scout_ivy', 'Scout Ivy'), E('smith_ghost', 'The Ghost Smith')],
    lore: [E('lore:sundering', 'The Sundering'), E('lore:legion', 'The Six Commanders'), E('lore:brighthold', 'The Fall of Brighthold')],
    cuisine: [] },
  pipsprout: { name: 'Pipsprout Hollow', zone: 'pipsprout',
    bosses: [E('beetle', 'The Very Large Beetle', 'Root tunnels')],
    npcs: [E('bramblebeard', 'Elder Bramblebeard'), E('puddlebutton', 'Mayor Puddlebutton'), E('mossy_gran', 'Mossy Gran'), E('captain_acorn', 'Captain Acorn')],
    lore: [E('lore:pip_seeds', 'Why Pips Hide Seeds'), E('lore:shrinking', 'On Being Shrunk')],
    cuisine: [E('food3', 'Pipberry Tart', 'Eat one')] },
  glass_sea: { name: 'The Glass Sea', zone: 'islands',
    bosses: [E('ghost_captain', 'Captain Hollowgale', 'Ghost Ship'), E('molten_crab', 'Molten Crab Tyrant', 'Ember Reef'), E('brine_maw', 'The Brine Maw', 'Storms')],
    npcs: [E('morwenna', 'Old Morwenna of the Brine'), E('lantern_keeper', 'The Lantern Keeper'), E('turtle', 'The Sleeping Turtle')],
    lore: [E('lore:glass_sea', 'Why the Sea Is Glass'), E('lore:islands', 'Eight Islands, Eight Souls')],
    cuisine: [E('food4', 'Seafarer’s Platter', 'Eat one')] },
};
export const TOME_TIERS = [
  { pct: 0.3, bundle: { rosterXp: 600, card_pack: 1 } },
  { pct: 0.6, bundle: { rosterXp: 1200, silver: 50000 } },
  { pct: 0.9, bundle: { card_pack_epic: 1, rosterXp: 2000 } },
  { pct: 1, bundle: { skill_potion: 1, rosterXp: 3000 } },
];
