// Chapter III — Pipsprout Hollow (any level; ~20–24): shrunk to Pip size, Elder Bramblebeard, the stolen seeds, a
// siege at the Acorn Gate, and the tale of the Sunseed — the Pips' sacred seed that always points to the Shards.
const ELDER = ['npc:bramblebeard', 'spawn'];
const GATE = ['poi:acorn_gate', 'poi:gate', 'npc:captain_acorn', 'spawn'];
const VAULT = ['poi:seed_vault', 'poi:vault', ['npc:bramblebeard', -4, -10], 'spawn'];

export default {
  id: 'ch3', name: 'Chapter III · Pipsprout Hollow', zone: 'pipsprout', levels: [20, 26],
  quests: [
    { id: 'h1_small', kind: 'msq', title: 'Small World', level: 20, prereq: ['g8_hollow'], chapterStart: 'Pipsprout Hollow', chapterOver: 'Chapter III',
      desc: 'You are very small now. Everything else is very big.',
      steps: [
        { type: 'cutscene', id: 'hollow_arrival' },
        { type: 'choice', npc: 'bramblebeard', text: 'Meet Elder Bramblebeard', lines: [
          'Well, well. A big-one, made small. Sprig, you’ve outdone yourself. (Sprig beams so hard his leaf quivers.)',
          'Welcome to Pipsprout Hollow, Shardbearer. Yes, I know what you are. The seeds told me. They are terrible gossips.',
          'I am Bramblebeard, eldest of the Pips — and the only one who bothered to learn your language. The others think it has too many words. They are not wrong.',
        ], choices: [
          { id: 'small', text: 'Why am I so small?', reply: ['Because the Hollow is small, and you are our guest. The mushroom ring makes everyone Pip-sized.', 'It wears off when you leave. Mostly. There was a goat, once. We don’t talk about the goat.'] },
          { id: 'legion', text: 'The Legion is hunting your seeds.', reply: ['Yes. And now they have found our home.', 'Sit. Well — stand. We have very small chairs. Let me tell you what they took.'] },
        ] },
      ],
      rewards: { xp: 1.0, items: { food3: 2 } } },

    { id: 'h2_seeds', kind: 'msq', title: 'The Stolen Seeds', level: 21, prereq: ['h1_small'],
      desc: 'The Sootlings — imps — raided the seed vault three nights ago.',
      steps: [
        { type: 'talk', npc: 'bramblebeard', text: 'Talk to Elder Bramblebeard', lines: [
          'Three nights ago the Sootlings came — imps, you call them — through a crack in the roots. They raided our seed vault.',
          'Captain Acorn has been guarding what’s left. He hasn’t slept. He is very small, and very tired, and very angry.',
        ] },
        { type: 'talk', npc: 'captain_acorn', text: 'Report to Captain Acorn', lines: [
          'PIP! PIP PIP! (Captain Acorn salutes so hard he falls over. He points at the imp camps with his twig spear.)',
          '(He mimes: pouches. Seeds. Imps stole them. Get them back. Then he salutes again, more carefully.)',
        ] },
        { type: 'collect', item: 'Stolen Seed Pouch', from: { mob: 'imp' }, need: 8, chance: 0.7, text: 'Take back the stolen seed pouches from the Sootlings' },
        { type: 'talk', npc: 'captain_acorn', text: 'Return the pouches to Captain Acorn', lines: [
          'Pip… (He counts the pouches. Twice. His lip trembles.)',
          'PIP! (He hugs your knee, which is the highest part of you he can reach at the moment.)',
        ] },
      ],
      rewards: { xp: 1.1, items: { card_pack_pip: 1 } } },

    { id: 'h3_gate', kind: 'msq', title: 'The Acorn Gate', level: 22, prereq: ['h2_seeds'],
      desc: 'The Sootlings want their seeds back. They are coming for the Acorn Gate tonight.',
      steps: [
        { type: 'talk', npc: 'captain_acorn', text: 'Talk to Captain Acorn', lines: [
          '(Captain Acorn draws in the dirt with his spear: the gate, a great many imps, and one big imp wearing a crown.)',
          'Pip. (He taps the drawing. Tonight.) Pip pip. (He taps you. You’re on the wall.)',
        ] },
        { type: 'defend', at: GATE, r: 9, dur: 50, every: 6.5, cap: 10, waves: [[['imp', 4]], [['imp', 5]], [['imp', 3], ['hellhound', 1]], [['imp', 6]]], text: 'The Sootlings attack — hold the Acorn Gate!', label: 'Hold the Acorn Gate' },
        { type: 'kill', spawn: { type: 'imp', name: 'Sootling Boss Grubnik', title: 'Wearer of a Stolen Thimble', at: GATE, hpMul: 3, scale: 1.4, trigger: 40 }, need: 1, text: 'Defeat Sootling Boss Grubnik' },
        { type: 'talk', npc: 'captain_acorn', text: 'Celebrate with Captain Acorn', lines: [
          '(The Captain plants his twig spear in the ground and does a small, stern victory dance.)',
          '(All around the gate, Pips pop out of hiding and cheer. Somebody starts a song. It is mostly the word “pip”.)',
        ] },
      ],
      rewards: { xp: 1.2, silver: 4000, gear: [{ slot: 'shoulder', grade: 2 }] } },

    { id: 'h4_sunseed', kind: 'msq', title: 'The Sunseed', level: 23, prereq: ['h3_gate'],
      desc: 'The Sootlings took one seed above all others.',
      steps: [
        { type: 'talk', npc: 'bramblebeard', text: 'Talk to Elder Bramblebeard', lines: [
          'You saved our seeds, Shardbearer — most of them. But the Sootlings took the one that matters most.',
          'Come. Let an old Pip tell you a story. It’s a short one. Pips don’t have the attention for long ones.',
        ] },
        { type: 'cutscene', id: 'sunseed_tale' },
        { type: 'interact', at: VAULT, name: 'Empty Pedestal', label: 'Examine', dur: 1.6, anim: 'kneel', say: 'The pedestal is still warm. Scratched into the soil beside it: a thorn.', text: 'Examine the empty pedestal in the seed vault' },
        { type: 'talk', npc: 'mossy_gran', text: 'Ask Mossy Gran to read the roots', lines: [
          'Pip… pip. (Mossy Gran presses her ear to a root and listens for a long, long time.)',
          '(She points east. Then she draws a thorn in the dirt, and scowls at it.)',
        ] },
        { type: 'talk', npc: 'bramblebeard', text: 'Tell Elder Bramblebeard', lines: [
          'Thornwood. The cult of the Thorn has it. Of course they do — they want a garden where the sun never shines, and the Sunseed is the sun that won’t stop shining.',
          'Go, Shardbearer. And take Sprig — he refuses to stay. I tried. He bit me.',
          { s: 'sprig', t: 'PIP. (Sprig does not look sorry at all.)' },
        ] },
      ],
      onComplete: Q => Q.tome('pipsprout', 'lore', 'lore:pip_seeds'),
      rewards: { xp: 1.2, silver: 5000 } },

    { id: 'h5_farewell', kind: 'msq', title: 'A Pip-Sized Farewell', level: 24, prereq: ['h4_sunseed'],
      desc: 'The whole Hollow wants to say goodbye. At length.',
      steps: [
        { type: 'talk', npc: 'puddlebutton', text: 'Say goodbye to Mayor Puddlebutton', lines: [
          'PIP PIP PIP! (A speech. A very long one. There is a lot of bowing and, at one point, a very small flag.)',
          '(At the end the Mayor presents you with a tiny golden whistle. When you blow it, a Pip somewhere nearby says “pip.”)',
          '(A small green someone climbs into your pack. The whistle, it seems, came with a friend.)',
        ] },
        { type: 'zone', zone: 'goldmeadow', text: 'Return to Goldmeadow through the mushroom ring' },
        { type: 'zone', zone: 'thornwood', text: 'Take the northern road into Thornwood' },
      ],
      rewards: { xp: 1.0, pets: ['pip_pet'] } },

    // ------------------------------------------------------------------ side stories
    { id: 'hs_hide', kind: 'side', title: 'Hide and Squeak', level: 21, giver: 'tadpole', prereq: ['h1_small'],
      desc: 'Tadpole wants to play hide-and-seek. He is already hiding. Badly.',
      offer: ['PIP! (Tadpole covers his eyes, counts on his fingers — he has three — and runs off giggling.)', '(He wants to play hide-and-seek. You can still see his leaf.)'],
      steps: [
        { type: 'interact', at: ['poi:hide1', ['npc:bramblebeard', 14, 10], 'spawn'], model: 'pip', variant: 'child', name: 'Tadpole', label: 'Found you!', dur: 0.6, anim: 'point', doneSfx: 'pip_cheer', say: 'PIP! (Tadpole shrieks with delight and runs off to hide again.)', text: 'Find Tadpole (somewhere near the pond)' },
        { type: 'interact', at: ['poi:hide2', ['npc:bramblebeard', -16, -6], 'spawn'], model: 'pip', variant: 'child', name: 'Tadpole', label: 'Found you!', dur: 0.6, anim: 'point', doneSfx: 'pip_cheer', say: 'PIP PIP! (He is outraged. You cheated. You did not cheat.)', text: 'Find Tadpole again' },
        { type: 'interact', at: ['poi:hide3', ['npc:bramblebeard', 12, -16], 'spawn'], model: 'pip', variant: 'child', name: 'Tadpole', label: 'Found you!', dur: 0.6, anim: 'point', doneSfx: 'pip_cheer', say: 'Pip… (Tadpole has fallen asleep in his hiding spot.)', text: 'Find Tadpole one last time' },
        { type: 'talk', npc: 'tadpole', text: 'Bring Tadpole home', lines: ['PIP PIP PIP! (Tadpole is thrilled to have been found three times. He wants to go again. Mossy Gran intervenes.)'] },
      ],
      rewards: { xp: 0.5, items: { food3: 2 } } },

    { id: 'hs_tax', kind: 'side', title: 'The Shiny Tax', level: 21, giver: 'puddlebutton', prereq: ['h1_small'],
      desc: 'Pipsprout Hollow has a Shiny Tax. Nobody knows who invented it. (The Mayor did.)',
      offer: ['Pip! Pip pip. (The Mayor points at your shiniest buckle, then at a very small ledger. There appears to be a Shiny Tax.)', '(He will accept flowers instead. Pips love flowers. They are shiny AND they smell nice.)'],
      steps: [
        { type: 'gather', skill: 'forage', need: 3, text: 'Gather flowers in the Hollow (foraging spots)' },
        { type: 'talk', npc: 'puddlebutton', text: 'Pay the Shiny Tax', lines: ['(The Mayor inspects each petal, stamps a leaf with a tiny seal, and declares you a Friend of the Hollow.)', 'Pip. (He also keeps your buckle. Nobody is sure how.)'] },
      ],
      rewards: { xp: 0.5, items: { gift3: 1 } } },

    { id: 'hs_garden', kind: 'side', title: 'Mossy Gran’s Garden', level: 22, giver: 'mossy_gran', prereq: ['h1_small'],
      desc: 'The imps trampled Mossy Gran’s dew-channels. Her sprouts are thirsty.',
      offer: ['Pip… (Mossy Gran shows you her garden. The sprouts are drooping. The imps trampled the dew-channels.)', '(She hands you a thimble. It is a watering can, at this size.)'],
      steps: [
        { type: 'interact', at: ['poi:garden', ['npc:mossy_gran', 3, 3], 'spawn'], need: 5, spread: 5, name: 'Thirsty Sprout', label: 'Water', dur: 1.4, anim: 'interact', text: 'Water the thirsty sprouts' },
        { type: 'talk', npc: 'mossy_gran', text: 'Tell Mossy Gran', lines: ['(The sprouts perk up one by one. Mossy Gran pats your cheek. It takes her three jumps to reach.)'] },
      ],
      rewards: { xp: 0.55, items: { food3: 3 } } },

    { id: 'hs_census', kind: 'side', title: 'The Great Pip Census', level: 22, giver: 'bramblebeard', prereq: ['h2_seeds'],
      desc: 'Every year the Pips count their hidden seeds. Every year they lose count.',
      offer: ['Every year we count our hidden seeds. Every year we lose count, because we hide them too well.', 'Find three of them in the Hollow and I will put your name in the census. As an honorary Pip.'],
      steps: [
        { type: 'event', ev: 'collect', match: d => d.type === 'seeds' && d.zone === 'pipsprout', need: 3, init: Q => (Q.A.roster.collect?.seeds || []).filter(id => id.startsWith('seed:pipsprout:')).length, text: 'Find hidden Pip Seeds in the Hollow' },
        { type: 'talk', npc: 'bramblebeard', text: 'Report to Elder Bramblebeard', lines: ['Three! You have the eyes of a Pip. The nose too, now that you’re small.', 'Welcome to the census, honorary Pip {name}. You are number four thousand and twelve. Probably.'] },
      ],
      rewards: { xp: 0.5, items: { card_pack_pip: 1 } } },
  ],

  cutscenes: {
    hollow_arrival: { music: 'pip', run: async (cs, Q) => {
      const me = cs.hero; if (!me) return;
      const y = cs.L.heightAt(me.pos.x, me.pos.z);
      cs.shot([me.pos.x + 1.2, y + 0.9, me.pos.z + 2.4], [me.pos.x, y + 0.45, me.pos.z], 0.01, 40);
      await cs.wait(0.4);
      await cs.say(null, 'The world tilts, the mushrooms flash — and suddenly every blade of grass is a tree.', 3);
      cs.shot([me.pos.x - 4, y + 5, me.pos.z + 7], [me.pos.x + 2, y + 1.5, me.pos.z - 8], 3.2, 48);
      cs.anim(me, 'think', 2);
      await cs.title('Pipsprout Hollow', 'Chapter III', 2.6);
      const sprig = cs.L.units.find(u => u.data.npcDef?.id === 'sprig');
      if (sprig) { cs.anim(sprig, 'cheer', 1.3); cs.sfx('pip_cheer', sprig.pos); }
      await cs.say('sprig', 'PIP! (Sprig spreads his arms wide. Home!)', 2.2);
      for (const u of cs.L.units) if (u.type === 'pip' && u !== sprig && Math.random() < 0.7) cs.anim(u, 'surprised', 1.1);
      await cs.say(null, 'Dozens of tiny faces peek out from acorn doors and flower windows.', 2.8);
    } },
    sunseed_tale: { music: 'cutscene_sad', run: async (cs, Q) => {
      const elder = cs.L.units.find(u => u.data.npcDef?.id === 'bramblebeard'); const me = cs.hero;
      const p = elder ? elder.pos : me.pos, y = cs.L.heightAt(p.x, p.z);
      cs.shot([p.x + 1.8, y + 1.0, p.z + 2.6], [p.x, y + 0.45, p.z], 1.2, 34);
      if (elder) cs.anim(elder, 'talk', 3, true);
      await cs.say('bramblebeard', 'When the sky broke, a piece of the Sunheart fell into the Hollow. Not a Shard. A seed.', 3.6);
      cs.flash(0.3); cs.sfx('holy');
      await cs.say('bramblebeard', 'We planted it. It never grew. But it was always warm — and it always turned, slowly, like a flower following the sun.', 4.2);
      await cs.say('bramblebeard', 'It took us three hundred years to notice what it was following. Pips are not quick. We are thorough.', 3.8);
      cs.shot([p.x - 3, y + 3.5, p.z + 5], [p.x + 1, y + 0.6, p.z - 2], 3, 44);
      await cs.say('bramblebeard', 'It points to the Shards, Shardbearer. Whoever holds the Sunseed can find every one of them.', 3.6);
      await cs.say('hero', 'And now the Legion has it.', 1.8);
      if (elder) cs.anim(elder, 'bow', 1.4);
      await cs.say('bramblebeard', 'Now the Legion has it.', 1.8);
    } },
  },
};
