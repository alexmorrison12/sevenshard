// Lore books & steles found in the world (lore:* anchors). Ids match the Adventure Tome (src/data/collectibles.js TOME);
// a zone's numbered lore:<n> anchors map to FIELDS[zone].lore[n-1] (src/data/field.js).
export const LORE = {
  // ---------------------------------------------------------------- Solhaven
  'lore:founding': { title: 'The Founding of Solhaven', sub: 'Cathedral library', text: [
    'Solhaven was founded by fishermen who refused to leave when the Sundering split the sky.',
    '“The sea still has fish,” said Old Maribet Solhane, “and I still have a boat.” They built the first pier out of the wreck of a warship that fell from nowhere.',
    'The city’s motto, carved over the harbour gate, is her second sentence: “Stop crying and hold this rope.”',
  ] },
  'lore:seven_lights': { title: 'The Seven Lights', sub: 'A hymnal, well thumbed', text: [
    'Before the Sundering, seven lights hung in the sky: Dawn, Tide, Ember, Thorn, Frost, Song and the Hidden Light, which no one ever saw but everyone agreed was there.',
    'Together they forged the Sunheart, a prism that held the Abyss shut like a lid on a boiling pot.',
    'The seventh verse of the old ballad says the Hidden Light was never lost at all — only “held by the smallest hands.” Scholars argue about this. Pips do not argue about anything; they just look smug.',
  ] },
  'lore:harbor': { title: 'Tides and Tariffs', sub: 'Harbour office ledger', text: [
    'Tariff on salted fish: one copper per barrel. Tariff on live fish: two coppers, plus whatever the fish bites.',
    'Tariff on Pips arriving by barrel: none. We have tried. They do not have coppers. They offer buttons.',
    'Note in the margin, different hand: “Accept the buttons. The buttons are lucky.”',
  ] },
  // ---------------------------------------------------------------- Goldmeadow
  'lore:harvest': { title: 'The Harvest Songs', sub: 'Shrine of Dawn', text: [
    'Goldmeadow sings to its wheat. Every family has a harvest song, and every song is about the same three things: rain, sun, and somebody’s uncle who fell in the millpond.',
    'The oldest song asks the Dawn Light to “keep the wolves polite and the bandits lazy.” It has worked for four hundred years, give or take the bandits.',
  ] },
  'lore:windmill': { title: 'Why the Windmill Turns Backwards', sub: 'Standing Stones', text: [
    'Every child in Goldmeadow knows the old windmill on the hill turns backwards on moonless nights.',
    'The grown-ups say it’s the wind off the river. The children say it’s the little green folk, grinding seeds into starlight.',
    'The children are, for once, closer to the truth.',
  ] },
  'lore:goldmeadow:3': { title: 'A Brass Plaque', sub: 'Goldmeadow', text: [
    '“On this bridge in the Year of the Sundering, Tobiah Hale held back a pack of shadow-wolves with a pitchfork and a very loud voice.”',
    'Someone has scratched underneath: “It was mostly the voice.”',
  ] },
  // ---------------------------------------------------------------- Thornwood
  'lore:thorn_cult': { title: 'The Thorn Cult', sub: 'A burned sermon', text: [
    'We are the Thorn that grows in the dark. We are the root that drinks the Abyss. When the last light fails, only the thorn will remain.',
    'The Horned Ones have promised us a garden without sun. We will water it with — (the rest is scorched away).',
    'Scrawled at the bottom, shaky: “I just wanted the robes.” — M.',
  ] },
  'lore:treants': { title: 'Speaking with Treants', sub: 'A hermit’s notes', text: [
    'Rule one: be patient. A treant’s “hello” can take an afternoon.',
    'Rule two: never bring an axe. Not even a small one. Not even as a joke. Treants do not understand jokes; they understand axes.',
    'Rule three: the Thornking answers one riddle a day. If you answer his, he remembers you for a hundred years.',
  ] },
  'lore:spiders': { title: 'On Spiders, Regrettably', sub: 'Owl Sage’s pamphlet', text: [
    'Thornwood spiders are not evil. They are hungry, which from the fly’s point of view is the same thing.',
    'The Broodmother is older than the abbey. She was here when the Thorn Light still shone. Some say she remembers it, and weaves its shape into her webs.',
    'Do not test this theory up close.',
  ] },
  'lore:thornwood:4': { title: 'Chronicle of the Seventh Light, Folio IV', sub: 'The Abbey', text: [
    'Brother Anselm writes: the pilgrims came less each year. The forest grew darker, and the candles harder to light.',
    'We keep seven candles burning. Six for the Lights that fell. One for the Light that hid.',
  ] },
  // ---------------------------------------------------------------- Ashen Ridge
  'lore:sundering': { title: 'The Sundering', sub: 'A scorched stele', text: [
    'The sky cracked like an egg. Light poured out, and then the dark poured in.',
    'The Sunheart held for a single breath, and then it broke into seven pieces, and the pieces fell like burning stars across Solmara.',
    'Where they landed, the land remembered. Goldmeadow grew gold. Thornwood grew thorns. And here, on the Ridge, the ground has been burning ever since.',
  ] },
  'lore:legion': { title: 'The Six Commanders', sub: 'Legion war-journal (captured)', text: [
    'By the will of Emperor Vorrathis, six Commanders march:',
    'Gorrath of the Horns, who breaks. Two more, whose names the scribe has blacked out in terror. Three whose names are simply “the Others.”',
    'Varkhul the Ravager is not among them. Varkhul wants to be. That is what makes him dangerous.',
  ] },
  'lore:brighthold': { title: 'The Fall of Brighthold', sub: 'A soldier’s last letter', text: [
    'If you find this, the south tower is gone. The thing outside the walls ate it. We call it Ashmaw because nobody has a better word.',
    'The Commander says hold. We are holding. There is a child on the walls with a light in their chest, and the demons flinch when they come near.',
    'Tell my sister I kept the scarf. — T.',
  ] },
  // ---------------------------------------------------------------- Pipsprout Hollow
  'lore:pip_seeds': { title: 'Why Pips Hide Seeds', sub: 'Written very small', text: [
    'Pip. Pip pip. Pip! (The whole book is written in Pip.)',
    'A translation has been pencilled in the margins by Elder Bramblebeard: “We hide seeds so the world remembers how to grow. Also because it is fun.”',
    '“Mostly because it is fun.”',
  ] },
  'lore:shrinking': { title: 'On Being Shrunk', sub: 'A travel guide for big-ones', text: [
    'Welcome, big-one! You are now small-one. Please do not panic. Panicking at this size is very loud for us.',
    'Things you may notice: grass is a forest. A dewdrop is a pond. A ladybug is a pony. Do not try to ride the ladybug.',
    'You will return to your usual size when you leave. Please do not take any of us with you by accident. Check your pockets.',
  ] },
};
