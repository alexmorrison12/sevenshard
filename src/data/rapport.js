// Rapport: 8 NPCs you befriend with songs, emotes and gifts. Ids match the `rapport` field of data/npcs.js CITY_NPCS
// (brannoc, seraphine, mirelle, wren, maren, tumbleroot) plus Bramblebeard (Pipsprout Hollow) and Morwenna (Brinehollow).
// Stage rewards: { bundle, collect?: [[type, id]] } — collect entries go through systems/collectibles.collect.
export const STAGES = [
  { idx: 0, name: 'Neutral', min: 0 }, { idx: 1, name: 'Amicable', min: 1000 }, { idx: 2, name: 'Friendly', min: 3000 },
  { idx: 3, name: 'Trusted', min: 6000 }, { idx: 4, name: 'Honored', min: 10000 }, { idx: 5, name: 'Devoted', min: 16000 },
];
export const SONGS = {
  homeward: { name: 'Hymn of Homeward', desc: 'Carries you home to the last city you visited.' },
  tides: { name: 'Serenade of Tides', desc: 'Calls your ship to the nearest shore.' },
  rest: { name: 'Lullaby of Rest', desc: 'Soothes the weary — and certain sleeping turtles.' },
  valor: { name: 'Ballad of Valor', desc: 'Stirs brave hearts. Wakes sleeping giants.' },
  sunrise: { name: 'Song of Sunrise', desc: 'Warms any heart. Everyone’s favourite.' },
};
export const EMOTES = ['wave', 'bow', 'dance', 'cheer', 'clap', 'laugh', 'cry', 'salute', 'point', 'flex', 'sit', 'sleep', 'shrug', 'facepalm', 'kneel', 'think', 'heart', 'angry', 'yes', 'no'];
export const DAILY_SONGS = 6, DAILY_EMOTES = 6;
export const BASE = { song: 40, emote: 15, gift: { gift1: 60, gift2: 180, gift3: 180, gift4: 600 } };
export const PREF = { love: 2, like: 1.5, neutral: 1, dislike: 0.5 };
const R = (bundle, collect) => ({ bundle, ...(collect ? { collect } : {}) });
export const RAPPORT_NPCS = [
  { id: 'brannoc', name: 'Commander Brannoc Hale', title: 'Knight-Commander of Brighthold', zone: 'solhaven',
    personality: 'Gruff, loyal and secretly sentimental. Hums marching songs when he thinks nobody is listening.',
    songs: { valor: 'love', homeward: 'like', rest: 'dislike' }, emotes: { salute: 'love', bow: 'like', kneel: 'like', dance: 'dislike', laugh: 'dislike' },
    gifts: { gift1: 'dislike', gift2: 'love', gift3: 'neutral', gift4: 'like' },
    rewards: [R({ silver: 20000, gift1: 2 }), R({ cards: { brannoc: 1 } }), R({ songs: ['valor'] }, [['masterpieces', 'art:2']]), R({ skill_potion: 1 }, [['hearts', 'heart:brighthold']]), R({ titles: ['brannocs_shield'] })],
    lines: ['Hmph. Another recruit.', 'You fight well. For a civilian.', 'Brighthold will stand again. You have my word.', 'I would trust you with my back. That is not nothing.', 'My father carried this at the first siege. Now you will.', 'You are family now, Shardbearer. Don’t make it weird.'] },
  { id: 'seraphine', name: 'Seraphine', title: 'Oracle of the Shards', zone: 'solhaven',
    personality: 'Gentle and dreamy; hears the Shards sing and answers questions nobody asked yet.',
    songs: { sunrise: 'love', rest: 'like', valor: 'neutral' }, emotes: { bow: 'love', heart: 'like', think: 'like', angry: 'dislike' },
    gifts: { gift1: 'like', gift2: 'like', gift3: 'neutral', gift4: 'love' },
    rewards: [R({ card_pack: 2 }), R({ cards: { seraphine: 1 } }), R({ songs: ['sunrise'] }), R({ skill_potion: 1, gift4: 1 }), R({ titles: ['voice_of_shards'] }, [['masterpieces', 'art:10']])],
    lines: ['The Shards are loud today.', 'You carry a little of their light. Did you know?', 'I dreamed of you. You were holding a very small Pip.', 'Seven lights, scattered. You are gathering them, one friend at a time.', 'When I close my eyes, I see the Sunheart whole again.', 'Whatever comes, I will sing you home.'] },
  { id: 'mirelle', name: 'Captain Mirelle Stormwake', title: 'Harbor Master', zone: 'solhaven',
    personality: 'Brash, loud and fearless; distrusts calm seas and anyone who has never been seasick.',
    songs: { tides: 'love', homeward: 'neutral', sunrise: 'like' }, emotes: { laugh: 'love', cheer: 'like', flex: 'like', cry: 'dislike' },
    gifts: { gift1: 'neutral', gift2: 'love', gift3: 'dislike', gift4: 'like' },
    rewards: [R({ pirate: 200 }), R({ cards: { mirelle: 1 } }), R({ songs: ['tides'] }), R({ skill_potion: 1 }, [['masterpieces', 'art:4']]), R({ titles: ['stormwake_crew'], unlocks: ['ship:skin:stormwake'] })],
    lines: ['Mind the ropes, landlubber.', 'You’ve got sea legs after all.', 'The Glass Sea respects nobody. It might respect you.', 'I’d sail into a storm with you. Twice, even.', 'Take her helm for a day. I trust you.', 'Wherever the tide goes, you’ll have a berth on my ship.'] },
  { id: 'wren', name: 'Wren Ashdown', title: 'Bard of the Plaza', zone: 'solhaven',
    personality: 'Flamboyant, generous and competitive — every song you play gets a better one back.',
    songs: { sunrise: 'like', valor: 'like', rest: 'love', tides: 'like', homeward: 'like' }, emotes: { clap: 'love', dance: 'love', cheer: 'like', sleep: 'dislike' },
    gifts: { gift1: 'like', gift2: 'love', gift3: 'like', gift4: 'neutral' },
    rewards: [R({ emotes: ['laugh'] }), R({ cards: { wren: 1 } }), R({ songs: ['rest'] }), R({ skill_potion: 1, emotes: ['heart'] }), R({ titles: ['plaza_legend'], emotes: ['flex'] })],
    lines: ['Play me something and I’ll play you something back.', 'Not bad! Your timing’s a hair late.', 'The plaza hums your tunes now. I’m jealous.', 'Duet tomorrow? I’ll bring the good lute.', 'I wrote a song about you. It’s mostly about your boots.', 'Every song I play from now on has a verse for you.'] },
  { id: 'maren', name: 'Old Maren', title: 'Retired Adventurer', zone: 'solhaven',
    personality: 'Wry and unimpressed; has fought every guardian twice and will tell you about it.',
    songs: { valor: 'love', homeward: 'like', sunrise: 'neutral' }, emotes: { salute: 'like', flex: 'love', bow: 'like', dance: 'dislike' },
    gifts: { gift1: 'love', gift2: 'neutral', gift3: 'like', gift4: 'dislike' },
    rewards: [R({ leapstone: 20 }), R({ cards: { maren: 1 } }), R({ emotes: ['salute'], solar_blessing: 5 }), R({ skill_potion: 1 }), R({ titles: ['marens_apprentice'], mounts: ['old_warhorse'] })],
    lines: ['Back in my day, guardians were bigger.', 'You dodged that one? Huh.', 'Rimewing still owes me a boot. Get it back for me.', 'You remind me of me. Sadly.', 'Take my old saddle. The horse comes with it.', 'Go on then. Make them tell stories about you, too.'] },
  { id: 'tumbleroot', name: 'Pip Tumbleroot', title: 'Visiting Pip', zone: 'solhaven',
    personality: 'Tiny, curious, easily distracted by shiny things and seeds. Especially seeds.',
    songs: { sunrise: 'love', rest: 'like', valor: 'dislike' }, emotes: { dance: 'love', wave: 'like', heart: 'like', angry: 'dislike' },
    gifts: { gift1: 'like', gift2: 'neutral', gift3: 'love', gift4: 'dislike' },
    rewards: [R({ card_pack_pip: 1 }), R({ cards: { tumbleroot: 1 } }), R({ emotes: ['pip_wave'] }, [['stars', 'star:5']]), R({ skill_potion: 1 }), R({ titles: ['honorary_pip'] })],
    lines: ['Pip!', 'Pip pip! (It hands you a pebble.)', 'Pip-pip-pip! (It shows you where a seed might be.)', 'Piiip. (It falls asleep on your boot.)', 'PIP! (It gives you its favourite star.)', 'Pip. (It considers you a very large Pip now.)'] },
  { id: 'bramblebeard', name: 'Elder Bramblebeard', title: 'Elder of Pipsprout Hollow', zone: 'pipsprout',
    personality: 'Ancient, whimsical and forgetful; his moss beard is home to at least three snails.',
    songs: { rest: 'love', sunrise: 'like', homeward: 'like' }, emotes: { bow: 'love', dance: 'like', sit: 'like', angry: 'dislike' },
    gifts: { gift1: 'love', gift2: 'like', gift3: 'love', gift4: 'neutral' },
    rewards: [R({ food3: 3 }), R({ cards: { bramblebeard: 1 } }), R({ skill_potion: 1 }, [['leaves', 'leaf:4']]), R({ skill_potion: 1 }), R({ titles: ['twig_bearer'], mounts: ['acorn_cart'] })],
    lines: ['Eh? A big one! Mind the mushrooms.', 'You found a seed? Keep it, keep it. There are more. Probably.', 'In my day we hid seeds from the Legion. Now we hide them from you.', 'Sit, sit. The snails like you.', 'Take my second-best twig. The best one is taken.', 'You are a Pip at heart, big one.'] },
  { id: 'morwenna', name: 'Old Morwenna of the Brine', title: 'Sea Witch of Brinehollow', zone: 'islands',
    personality: 'Cryptic, amused and mildly alarming; answers questions with riddles and riddles with tea.',
    songs: { tides: 'love', rest: 'like', sunrise: 'dislike' }, emotes: { think: 'love', bow: 'like', kneel: 'like', cheer: 'dislike' },
    gifts: { gift1: 'dislike', gift2: 'like', gift3: 'neutral', gift4: 'love' },
    rewards: [R({ pearl: 2 }), R({ cards: { morwenna: 1 } }), R({ skill_potion: 1 }, [['masterpieces', 'art:9']]), R({ skill_potion: 1, gift4: 1 }), R({ titles: ['brine_touched'], pets: ['brine_crab'] })],
    lines: ['The tide told me you were coming. Late, as usual.', 'What has roots nobody sees? Never mind. Tea?', 'You answered one. Most drown on the first.', 'The sea likes you. Be careful with that.', 'Take this. Do not ask what it was before it was a painting.', 'Should the sea ever take you, it will give you back. I asked.'] },
];
export const RAPPORT_BY_ID = Object.fromEntries(RAPPORT_NPCS.map(n => [n.id, n]));
/** display names for unlocks granted by rapport */
export const RAPPORT_UNLOCKS = {
  mounts: { old_warhorse: { name: 'Maren’s Old Warhorse', grade: 4 }, acorn_cart: { name: 'Acorn Cart', grade: 5 } },
  pets: { brine_crab: { name: 'Brine Crab', grade: 4 } },
  emotes: { pip_wave: { name: 'Pip Wave', grade: 3 }, laugh: { name: 'Laugh', grade: 2 }, heart: { name: 'Heart', grade: 2 }, flex: { name: 'Flex', grade: 2 }, salute: { name: 'Salute', grade: 2 } },
  songs: Object.fromEntries(Object.entries(SONGS).map(([id, s]) => [id, { name: s.name, grade: 4 }])),
  unlocks: { 'ship:skin:stormwake': { name: 'Stormwake (ship skin)', grade: 5 } },
};
