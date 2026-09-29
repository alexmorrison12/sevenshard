// Card collection: Solhaven folk, Pips, legion commanders, guardians and the heroes of legend. Grades 2–5
// (Rare → Relic). Cards are awakened 0–5 with duplicates; six cards form the deck; set bonuses unlock by the number of
// set cards in the deck and by the deck's total awakening in that set.
//   CARDS[id] = { id, name, grade, kind: 'npc'|'pip'|'boss'|'legend', sets: [setId], source, flavor }
//   CARD_SETS[id] = { id, name, cards: [ids], bonuses: [{ n, awk, chain, desc, mods }] }
// Bonus mods (see systems/cards.js cardMods): dmgAdd (additive damage), crit, critDmg (additive to the crit multiplier),
// dmgTaken (additive to the incoming-damage multiplier), hpMaxMul, healMul, shieldMul, silverGain, xpGain,
// elemRes (elemental damage taken reduction), dotMul (damage-over-time), seedSense (flag). Within one set `chain`,
// only the best reached bonus applies (higher awakening tiers replace lower ones).
const C = (id, name, grade, kind, sets, source, flavor) => ({ id, name, grade, kind, sets, source, flavor });

export const CARD_LIST = [
  // Tides of Light — the Seven Lights and their heirs
  C('seraphine', 'Seraphine, Voice of the Shards', 5, 'npc', ['tides'], 'Rapport: Seraphine (Friendly) · card packs', 'She hears the Shards sing, and lately they sing of you.'),
  C('ithra', 'Ithra the Tidecaller', 5, 'legend', ['tides'], 'Legendary card selector · Card Island', 'The Light who taught the Glass Sea to hold its breath.'),
  C('aurelion', 'Aurelion the Radiant', 5, 'legend', ['tides'], 'Legendary card selector · Inferno Descent', 'First of the Seven Lights. His lantern still burns somewhere.'),
  C('solenne', 'Solenne of Dawn', 4, 'legend', ['tides'], 'Card packs · Adventure Tome', 'Every sunrise over Solhaven is a promise she kept.'),
  C('brannoc', 'Commander Brannoc Hale', 4, 'npc', ['tides'], 'Rapport: Brannoc (Friendly) · card packs', 'Knight-Commander of Brighthold. Has not smiled since the Siege. Probably.'),
  C('maelis', 'Maelis the Lorekeeper', 4, 'legend', ['tides'], 'Card packs · lore books', 'She wrote down everything. Especially the parts you forgot.'),
  // Pip Parade
  C('bramblebeard', 'Elder Bramblebeard', 5, 'pip', ['pips'], 'Rapport: Bramblebeard (Friendly) · Pip card packs', 'Walks with a twig. The twig walks with him.'),
  C('puddlebutton', 'Mayor Puddlebutton', 3, 'pip', ['pips'], 'Pip card packs', 'Elected unanimously. Nobody else wanted the hat.'),
  C('sprig', 'Sprig', 2, 'pip', ['pips'], 'Pip card packs · card packs', 'Hides seeds. Forgets where. Hides more seeds.'),
  C('tumbleroot', 'Pip Tumbleroot', 2, 'pip', ['pips'], 'Rapport: Tumbleroot (Friendly) · Pip card packs', 'Visiting Solhaven to ask everyone, very politely, about seeds.'),
  C('captain_acorn', 'Captain Acorn', 3, 'pip', ['pips'], 'Pip card packs · Pip Island', 'Commands a fleet of one walnut shell.'),
  C('mossy_gran', 'Mossy Gran', 4, 'pip', ['pips'], 'Pip card packs · seed rewards', 'Knits moss into blankets. Knits blankets into moss.'),
  // Horns of the Legion — the Abyssal Legion's commanders
  C('gorrath', 'Gorrath, the Horned Tyrant', 5, 'boss', ['horns'], 'Legion Raid: Gorrath', 'The first commander to fall. He did not go quietly.'),
  C('varkhul', 'Varkhul the Ravager', 5, 'boss', ['horns'], 'Legendary card selector · Inferno Descent', 'He burned Brighthold and called it a warm welcome.'),
  C('skarn', 'Skarn, Hound of the Horn', 4, 'boss', ['horns'], 'Legion Raid: Hounds of the Horn', 'The left head of a very bad dog.'),
  C('vesk', 'Vesk, Hound of the Horn', 4, 'boss', ['horns'], 'Legion Raid: Hounds of the Horn', 'The right head. Worse.'),
  C('ashmaw', 'Ashmaw the Siege Behemoth', 4, 'boss', ['horns'], 'Card packs · Prologue', 'Brighthold’s walls were thick. Ashmaw was thicker.'),
  // Storm & Ember — the guardians
  C('rimewing', 'Rimewing', 3, 'boss', ['elements'], 'Guardian Hunt: Rimewing', 'An ice wyvern with a grudge against warm-blooded things.'),
  C('cinderhorn', 'Cinderhorn', 3, 'boss', ['elements'], 'Guardian Hunt: Cinderhorn', 'Lava-crusted and extremely bad at standing still.'),
  C('sandmaw', 'Sandmaw', 4, 'boss', ['elements'], 'Guardian Hunt: Sandmaw', 'You will hear it before you see it. Then you will see a lot of it.'),
  C('kurai', 'Kurai the Pyrefox', 4, 'boss', ['elements'], 'Guardian Hunt: Kurai', 'Nine tails, nine fires, one real fox.'),
  C('thunderhoof', 'Old Thunderhoof', 3, 'boss', ['elements'], 'Field Boss', 'Shows up every hour on the hour. More punctual than the ferry.'),
  C('nerissa', 'Nerissa of the Drowned Choir', 4, 'boss', ['elements'], 'Abyssal Dungeon: The Sunken Oratory', 'Her song drowned a cathedral. Do not hum along.'),
  // Wardens of Brighthold — Solhaven's defenders
  C('maren', 'Old Maren', 4, 'npc', ['wardens'], 'Rapport: Old Maren (Friendly) · card packs', 'Hunted guardians before your parents were born. Rimewing still owes her a boot.'),
  C('hilda', 'Hilda Ironbrand', 3, 'npc', ['wardens'], 'Card packs · honing milestones', 'Master blacksmith of Solhaven. Your +19 failure is not her fault. Ask her.'),
  C('mirelle', 'Captain Mirelle Stormwake', 3, 'npc', ['wardens'], 'Rapport: Mirelle (Friendly) · card packs', 'Harbor master of Solhaven. Calm seas make her nervous.'),
  C('wren', 'Wren Ashdown', 3, 'npc', ['wardens'], 'Rapport: Wren (Friendly) · card packs', 'Bard of the Plaza. Plays you a song, expects one back.'),
  C('morwenna', 'Old Morwenna of the Brine', 4, 'npc', ['wardens'], 'Rapport: Morwenna (Friendly) · Ghost Ship', 'The sea witch of Brinehollow. Knows your name. Never asked.'),
  // loose cards
  C('deep_oracle', 'The Deep Oracle', 4, 'boss', [], 'Abyssal Dungeon: The Sunken Oratory', 'It saw the Sundering coming, and said nothing.'),
  C('ghost_captain', 'Captain Hollowgale', 3, 'boss', [], 'Ghost Ship', 'Died at sea, kept sailing out of spite.'),
  C('gatekeeper', 'The Gatekeeper', 4, 'boss', [], 'Card packs · Inferno Descent', 'Nobody passes. Nobody has ever asked nicely.'),
  C('vorrathis', 'Vorrathis, Emperor of the Abyss', 5, 'boss', [], 'Legendary card selector (very rare)', 'The shadow behind every Legion banner.'),
  C('vaelor', 'Vaelor the Unbroken', 4, 'legend', [], 'Card packs · Adventure Tome', 'The Light who held the gate alone for seven days.'),
  C('kest', 'Kest the Wanderer', 3, 'legend', [], 'Card packs', 'The Light who never stayed anywhere long enough to be thanked.'),
  C('corvan', 'Corvan Stormhand', 3, 'legend', [], 'Card packs', 'Caught lightning once. Kept it in a jar.'),
  C('tully', 'Bram Tully', 2, 'npc', [], 'Card packs', 'General goods. Sells you the potion you forgot, every single time.'),
  C('iolanthe', 'Madame Iolanthe', 2, 'npc', [], 'Card packs', 'Collects faces on cards. Yours is next.'),
];
export const CARDS = Object.fromEntries(CARD_LIST.map(c => [c.id, c]));
const BOSS_ART = new Set(['gorrath', 'skarn', 'vesk', 'varkhul', 'ashmaw', 'gatekeeper', 'rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'nerissa', 'deep_oracle', 'thunderhoof']);
const LEGEND_ART = { aurelion: 'oathkeeper', ithra: 'songweaver', solenne: 'starcaller', maelis: 'starcaller', vaelor: 'reaver', kest: 'bladedancer', corvan: 'stormfist' };
/** Portrait icon id for a card (canonical icon ids: boss:<id>, npc:<id>, class:<id>). */
export function cardIcon(id) {
  if (BOSS_ART.has(id)) return `boss:${id}`;
  if (id === 'brannoc' || id === 'seraphine' || id === 'bramblebeard') return `npc:${id}`;
  if (LEGEND_ART[id]) return `class:${LEGEND_ART[id]}`;
  if (id === 'vorrathis') return 'boss:gatekeeper';
  if (id === 'ghost_captain') return 'boss:nerissa';
  if (CARDS[id]?.kind === 'pip') return 'npc:bramblebeard';
  return 'npc:merchant';
}


export const CARD_SETS = {
  tides: { id: 'tides', name: 'Tides of Light', cards: ['seraphine', 'ithra', 'aurelion', 'solenne', 'brannoc', 'maelis'], bonuses: [
    { n: 2, awk: 0, chain: 'res', desc: 'Light damage taken −8%.', mods: { elemRes: 0.08 } },
    { n: 4, awk: 0, chain: 'res', desc: 'Light damage taken −16%.', mods: { elemRes: 0.16 } },
    { n: 6, awk: 0, chain: 'dmg', desc: 'Damage +4%.', mods: { dmgAdd: 0.04 } },
    { n: 6, awk: 12, chain: 'dmg', desc: 'Damage +7%.', mods: { dmgAdd: 0.07 } },
    { n: 6, awk: 18, chain: 'dmg', desc: 'Damage +10%.', mods: { dmgAdd: 0.1 } },
    { n: 6, awk: 30, chain: 'dmg', desc: 'Damage +15%.', mods: { dmgAdd: 0.15 } },
  ] },
  pips: { id: 'pips', name: 'Pip Parade', cards: ['bramblebeard', 'puddlebutton', 'sprig', 'tumbleroot', 'captain_acorn', 'mossy_gran'], bonuses: [
    { n: 2, awk: 0, chain: 'silver', desc: 'Silver gained +3%.', mods: { silverGain: 0.03 } },
    { n: 4, awk: 0, chain: 'xp', desc: 'Experience gained +5%.', mods: { xpGain: 0.05 } },
    { n: 6, awk: 0, chain: 'parade', desc: 'Silver +6%, experience +8%.', mods: { silverGain: 0.06, xpGain: 0.08 } },
    { n: 6, awk: 12, chain: 'parade', desc: 'Silver +10%, experience +12%.', mods: { silverGain: 0.1, xpGain: 0.12 } },
    { n: 6, awk: 30, chain: 'parade', desc: 'Silver +15%, experience +20%. Pip Seeds sparkle on your minimap.', mods: { silverGain: 0.15, xpGain: 0.2, seedSense: 1 } },
  ] },
  horns: { id: 'horns', name: 'Horns of the Legion', cards: ['gorrath', 'varkhul', 'skarn', 'vesk', 'ashmaw'], bonuses: [
    { n: 2, awk: 0, chain: 'crit', desc: 'Crit Rate +3%.', mods: { crit: 0.03 } },
    { n: 4, awk: 0, chain: 'cdmg', desc: 'Crit Damage +8%.', mods: { critDmg: 0.08 } },
    { n: 5, awk: 0, chain: 'cdmg', desc: 'Crit Damage +12%.', mods: { critDmg: 0.12 } },
    { n: 5, awk: 15, chain: 'cdmg', desc: 'Crit Damage +18%.', mods: { critDmg: 0.18 } },
    { n: 5, awk: 25, chain: 'cdmg', desc: 'Crit Damage +25%.', mods: { critDmg: 0.25 } },
  ] },
  elements: { id: 'elements', name: 'Storm & Ember', cards: ['rimewing', 'cinderhorn', 'sandmaw', 'kurai', 'thunderhoof', 'nerissa'], bonuses: [
    { n: 2, awk: 0, chain: 'res', desc: 'Elemental damage taken −8%.', mods: { elemRes: 0.08 } },
    { n: 4, awk: 0, chain: 'res', desc: 'Elemental damage taken −16%.', mods: { elemRes: 0.16 } },
    { n: 6, awk: 0, chain: 'dot', desc: 'Burn, bleed, freeze and shock damage +10%.', mods: { dotMul: 0.1 } },
    { n: 6, awk: 18, chain: 'dot', desc: 'Burn, bleed, freeze and shock damage +20%.', mods: { dotMul: 0.2 } },
    { n: 6, awk: 30, chain: 'dmg', desc: 'Damage +6%.', mods: { dmgAdd: 0.06 } },
  ] },
  wardens: { id: 'wardens', name: 'Wardens of Brighthold', cards: ['hilda', 'mirelle', 'wren', 'maren', 'morwenna'], bonuses: [
    { n: 2, awk: 0, chain: 'hp', desc: 'Max HP +3%.', mods: { hpMaxMul: 0.03 } },
    { n: 3, awk: 0, chain: 'care', desc: 'Healing and shields you grant +5%.', mods: { healMul: 0.05, shieldMul: 0.05 } },
    { n: 5, awk: 0, chain: 'guard', desc: 'Damage taken −6%.', mods: { dmgTaken: -0.06 } },
    { n: 5, awk: 15, chain: 'care', desc: 'Healing and shields you grant +10%.', mods: { healMul: 0.1, shieldMul: 0.1 } },
    { n: 5, awk: 25, chain: 'guard', desc: 'Damage taken −10%.', mods: { dmgTaken: -0.1 } },
  ] },
};

/** duplicates needed to awaken from level i to i+1 (0→1 … 4→5); silver per step = grade × 800 × (i + 1) */
export const AWAKEN_DUPES = [1, 2, 3, 4, 5];
export const DECK_SIZE = 6;
/** pack id → { name, grades: { grade: weight }, pool?: kind filter, choose?: n (selector) } */
export const CARD_PACKS = {
  card_pack: { name: 'Card Pack', grades: { 2: 52, 3: 32, 4: 13, 5: 3 } },
  card_pack_epic: { name: 'Epic Card Pack', grades: { 3: 70, 4: 25, 5: 5 } },
  card_pack_legend: { name: 'Legendary Card Selector', grades: { 4: 80, 5: 20 }, choose: 3 },
  card_pack_pip: { name: 'Pip Card Pack', grades: { 2: 50, 3: 30, 4: 15, 5: 5 }, kind: 'pip' },
};
