// Chapter II — Goldmeadow (Lv 7–24): Brannoc's brother, wolves gnawing demon bones, the Redscarf bandits stealing
// seed-grain for hooded strangers, a windmill that turns backwards at night, and the first Pip.
// Anchors from src/world/zones/goldmeadow.js (poi:hale_farm, poi:windmill, poi:bandit_camp, poi:hermit_hut …).
const FARM = ['poi:hale_farm', 'npc:farmer_hale', 'spawn'];
const MILL = ['poi:windmill', 'npc:miller', 'spawn'];
const CAMP = ['poi:bandit_camp', 'elite:3', 'spawn'];

export default {
  id: 'ch2', name: 'Chapter II · Goldmeadow', zone: 'goldmeadow', levels: [7, 24],
  quests: [
    // ------------------------------------------------------------------ main story
    { id: 'g1_farm', kind: 'msq', title: 'The Hale Farm', level: 7, prereq: ['c1_westgate'], chapterStart: 'Goldmeadow', chapterOver: 'Chapter II',
      desc: 'Brannoc’s brother Gideon farms the heart of Goldmeadow. He would never ask for help.',
      steps: [
        { type: 'choice', npc: 'farmer_hale', text: 'Find Gideon Hale at the Hale Farm', lines: [
          'Another one of Brannoc’s strays? He sends me one every spring. Last year it was a goat.',
          'Tell my brother I’m fine. The wolves are fine. The bandits are fine. Everything is — (a crash from the barn) — fine.',
          '…Alright. It’s not fine. Wolves took three sheep this week. The Redscarf gang took the rest of the seed-grain. And the lights…',
        ], choices: [
          { id: 'lights', text: 'What lights?', reply: ['Up on Windmill Hill. Little green lights bobbing about at night. Mirabel the miller swears her sails turn backwards.', 'Start with the wolves, though. Fenn the hunter has been tracking them from his camp on the west bank.'] },
          { id: 'help', text: 'I’m here to help.', reply: ['Help. Hah. Hale men don’t need help.', '…Start with the wolves. Fenn the hunter’s camp is across the river, under the western cliffs.'] },
        ] },
      ],
      rewards: { xp: 1.0, items: { hp_potion: 5 } } },

    { id: 'g2_wolves', kind: 'msq', title: 'Wolves at the Fence', level: 8, prereq: ['g1_farm'],
      desc: 'Something is driving the wolves out of their dens and down to the farms.',
      steps: [
        { type: 'talk', npc: 'hunter', text: 'Talk to Fenn Greyfletch at the hunter’s camp', lines: [
          'Gideon sent you? Then it’s bad. He’d sooner eat his hat than ask.',
          'Wolves don’t take sheep for sport. Something’s driving them out of the dens — something worse than wolves.',
          'Thin the packs and bring me their fangs. I want to see what they’ve been chewing.',
        ] },
        { type: 'collect', item: 'Scorched Wolf Fang', from: { mob: 'wolf' }, need: 5, chance: 0.65, text: 'Collect Scorched Wolf Fangs from wolves' },
        { type: 'talk', npc: 'hunter', text: 'Bring the fangs to Fenn', lines: [
          'Scorched. See the black on the enamel? These wolves have been gnawing on something burnt.',
          'Demon bones. There’s Legion filth in my hills, and the wolves found it before we did.',
          'Tell Captain Marsh in Sheafton. If the Legion’s this close, the bandits are the least of our problems.',
        ] },
      ],
      rewards: { xp: 1.1, silver: 2000, gear: [{ slot: 'gloves', grade: 1 }] } },

    { id: 'g3_redscarf', kind: 'msq', title: 'Redscarf Trouble', level: 10, prereq: ['g2_wolves'],
      desc: 'The Redscarf gang is stealing seed-grain. Nobody steals seed-grain.',
      steps: [
        { type: 'talk', npc: 'captain', text: 'Report to Captain Rowan Marsh at the stone bridge', lines: [
          'Demon bones? Wonderful. Add it to the list.',
          'Six guards, forty farms, one road. And now the Redscarfs have a new trick — they’re not stealing coin. They’re stealing seed-grain.',
          'Who steals seed-grain? You can’t eat it, you can’t sell it this side of the river… Break their raiding parties. Then get our grain back from their camp.',
        ] },
        { type: 'kill', mob: ['bandit', 'bandit_slinger', 'bandit_brute'], need: 10, text: 'Defeat Redscarf bandits' },
        { type: 'interact', at: CAMP, need: 4, spread: 6, name: 'Stolen Grain Sack', label: 'Recover', dur: 1.4, anim: 'pickup', text: 'Recover the stolen grain at the bandit camp' },
        { type: 'talk', npc: 'captain', text: 'Return to Captain Marsh', lines: [
          'Four sacks! Gideon will actually smile. He’ll deny it, but he’ll smile.',
          'Here’s the strange thing. Every sack’s been slit open and sewn shut again. Like someone was searching inside.',
        ] },
      ],
      rewards: { xp: 1.1, silver: 3000, gear: [{ slot: 'chest', grade: 2 }] } },

    { id: 'g4_gentleman', kind: 'msq', title: 'The Gentleman Bandit', level: 12, prereq: ['g3_redscarf'],
      desc: 'The Redscarf leader calls himself a gentleman. He robs you, then thanks you for your patience.',
      steps: [
        { type: 'talk', npc: 'captain', text: 'Talk to Captain Marsh', lines: [
          'My scouts spotted their leader at the camp. Rusk. Calls himself “the Gentleman.”',
          'He robs travellers and then thanks them for their patience. Wrote my wife a poem once. It was a good poem. I’m still angry.',
          'Bring him in. Alive, if he lets you.',
        ] },
        { type: 'reach', at: CAMP, r: 10, text: 'Go to the Redscarf camp' },
        { type: 'kill', spawn: { type: 'rusk', name: 'Rusk the Gentleman', title: 'Bandit King of Goldmeadow', at: CAMP, trigger: 30 }, need: 1, text: 'Defeat Rusk the Gentleman' },
        { type: 'talk', npc: 'rusk', text: 'Question Rusk', lines: [
          'Enough! I yield, I yield. Mind the coat — it’s borrowed.',
          'The grain? Not for us, friend. We were PAID for it. Hooded folk, ash-grey veils, smelled of burnt thorns. Wanted every sack cut open.',
          'They were looking for seeds. Little glowing ones. Said the “sprout-folk” hide them in the grain at harvest.',
          'Tell your captain I’m retiring. To Thornwood. …Actually, no. Not Thornwood. Somewhere without veils.',
        ] },
        { type: 'talk', npc: 'captain', text: 'Report to Captain Marsh', lines: [
          'Hooded folk with grey veils… Thornwood cultists, this far west?',
          'And glowing seeds. Mirabel the miller’s been going on about green lights all month. Maybe she’s not mad after all.',
        ] },
      ],
      rewards: { xp: 1.2, silver: 4000, choice: [
        { label: 'Take Rusk’s borrowed coat (armor)', gear: [{ slot: 'chest', grade: 3 }] },
        { label: 'Take the bounty on his head (silver)', silver: 14000 },
      ] } },

    { id: 'g5_windmill', kind: 'msq', title: 'The Windmill Turns at Night', level: 14, prereq: ['g4_gentleman'],
      desc: 'Every moonless night, the old windmill on the hill turns backwards.',
      steps: [
        { type: 'talk', npc: 'miller', text: 'Talk to Mirabel Thresh at the windmill', lines: [
          'You’re here about the lights? FINALLY. Nobody believes me. Captain Marsh thinks I’ve been sniffing the flour.',
          'Every moonless night: little green lights at the top of the hill, and my sails turning BACKWARDS. Backwards! It’s un-mill-like.',
          'Look around the mill. Something’s been getting in.',
        ] },
        { type: 'interact', at: MILL, need: 3, spread: 4, name: 'Something Odd', label: 'Search', dur: 1.2, anim: 'interact', text: 'Search around the windmill',
          lines: ['Tiny footprints in the spilled flour — round toes, three of them. Whatever it is, it’s small.', 'A hat made from a single folded leaf. Very well made. Very, very small.', 'A trail of seeds glowing faintly green, leading up to the loft.'] },
        { type: 'talk', npc: 'miller', text: 'Tell Mirabel what you found', lines: [
          'Footprints? A HAT? I KNEW it. I knew it! Not mad. Take that, Captain Marsh.',
          'The loft. It’s up in the loft. You go. I’ll… guard the door. Bravely. From here.',
        ] },
      ],
      rewards: { xp: 1.1, items: { food1: 3 } } },

    { id: 'g6_pip', kind: 'msq', title: 'Something Small and Green', level: 16, prereq: ['g5_windmill'],
      desc: 'Something is hiding in the windmill loft — and something else is hunting it.',
      steps: [
        { type: 'reach', at: MILL, r: 5, text: 'Climb up to the windmill loft' },
        { type: 'cutscene', id: 'sprig_reveal' },
        { type: 'defend', at: MILL, r: 10, dur: 45, every: 7, cap: 9, waves: [[['imp', 4]], [['imp', 3], ['hellhound', 1]], [['imp', 5]], [['hellhound', 2], ['imp', 2]]], text: 'Imps are coming for the Pip — defend the windmill!', label: 'Defend the windmill' },
        { type: 'talk', npc: 'sprig', text: 'Talk to the little creature', lines: [
          'Pip! Pip pip pip! (The little creature bounces, grabs your finger with both hands and shakes it very seriously.)',
          '(It points at itself.) Sprig! (Then at the glowing seeds in its pouch, then at the hills, and mimes something big with horns.)',
          '(You are fairly sure it is saying the demons are hunting its seeds.)',
          { s: 'hero', t: 'I’m {name}. Nice to meet you, Sprig.' },
          'PIP! (Sprig does a small, dignified bow. Then falls over.)',
        ] },
      ],
      rewards: { xp: 1.2, silver: 3000 } },

    { id: 'g7_seeds', kind: 'msq', title: 'Seeds of Light', level: 18, prereq: ['g6_pip'],
      desc: 'Seraphine has followed a Shard-song all the way from Solhaven — to a Pip.',
      steps: [
        { type: 'talk', npc: 'seraphine', text: 'Meet Seraphine at the Hale Farm', lines: [
          'I felt it all the way from Solhaven. A Shard-song, faint as a whisper, coming from… a Pip?',
          '(Sprig hides behind your leg.) Oh, you’re adorable. Don’t tell Brannoc I said that.',
          'These seeds glow with the Sunheart’s light — tiny splinters of it. The Pips have been gathering them for centuries.',
          'Sprig dropped three while running from the imps. Find them before the Legion does.',
        ] },
        { type: 'interact', at: ['poi:scarecrow_field', 'poi:hale_farm', 'spawn'], need: 3, spread: 8, model: 'pip_seed', variant: 'gold', name: 'Glowing Pip Seed', label: 'Pick up', dur: 0.8, anim: 'pickup', doneSfx: 'pip_cheer', text: 'Find Sprig’s three glowing seeds near the scarecrow field' },
        { type: 'talk', npc: 'seraphine', text: 'Bring the seeds to Seraphine', lines: [
          'Three. Warm as a hearth, all of them. (She holds one to her ear.) It’s humming the same chord as your Shard.',
          'The Pips must have a vault full of these. And the Legion wants every one — because somewhere among them is a way to find the Shards.',
          'We need to see this Hollow of theirs. Sprig? Sprig, where do you live?',
          { s: 'sprig', t: 'PIP! (Sprig points west, toward the Standing Stones and their ring of fairy mushrooms, and makes a very small “shrinking” gesture.)' },
        ] },
      ],
      rewards: { xp: 1.2, items: { card_pack_pip: 1 } } },

    { id: 'g8_hollow', kind: 'msq', title: 'Into the Hollow', level: 20, prereq: ['g7_seeds'],
      desc: 'The way to Pipsprout Hollow is the ring of fairy mushrooms around the Standing Stones.',
      steps: [
        { type: 'choice', npc: 'sprig', text: 'Meet Sprig at the Standing Stones', lines: [
          '(Sprig hops into the ring of fairy mushrooms around the Standing Stones and beckons.)',
          'Pip! (It waves you into the ring. You have a sudden, strong feeling that you are about to become much smaller.)',
        ], choices: [
          { id: 'go', text: 'Step into the mushroom ring.', reply: ['(Sprig claps. The mushrooms begin to glow.)'] },
          { id: 'how', text: 'Wait — how small?', reply: ['(Sprig holds up two fingers, very close together. Then brings them closer.)'] },
        ] },
        { type: 'zone', zone: 'pipsprout', text: 'Step into the fairy ring at the Standing Stones' },
      ],
      rewards: { xp: 1.0, unlock: ['pipsprout'] } },

    // ------------------------------------------------------------------ side stories
    { id: 'gs_cat', kind: 'side', title: 'Sir Whiskerton', level: 9, giver: 'child', prereq: ['g1_farm'],
      desc: 'Tilly Hale’s cat is missing. He is orange and very brave, except about most things.',
      offer: [
        'Sir Whiskerton is missing! He’s a cat. He’s orange. He’s very brave, except about dogs, and birds, and wind.',
        'Last time he ran away he climbed the windmill and cried until Papa got the ladder. Papa says no more ladders.',
        'Nell the beekeeper saw an orange blur by the hay wagon. Please find him!',
      ],
      steps: [
        { type: 'interact', at: ['poi:hay_wagon', 'poi:hale_farm', 'spawn'], off: [1.5, 1], model: 'cat', name: 'Sir Whiskerton', label: 'Coax him out', dur: 2.2, anim: 'kneel', doneSfx: 'ui_click', say: 'Sir Whiskerton emerges from the hay, sneezes, and allows himself to be carried. With dignity.', text: 'Find Sir Whiskerton near the hay wagon' },
        { type: 'talk', npc: 'child', text: 'Bring Sir Whiskerton home to Tilly', lines: [
          'SIR WHISKERTON! (The cat tolerates being squeezed.)',
          'You’re the best hero ever. Better than Uncle Brannoc. Don’t tell him.',
          'Here — I saved this for whoever found him. It’s a pie. I only ate a little bit of it.',
        ] },
      ],
      rewards: { xp: 0.5, silver: 800, items: { food1: 2 } } },

    { id: 'gs_pies', kind: 'side', title: 'Revenge Is a Dish Best Served in a Pie', level: 10, giver: 'innkeeper', prereq: ['g1_farm'],
      desc: 'The boars ate Bertha’s cabbages. All of them.',
      offer: [
        'The boars ate my cabbages. All of them. Every. Last. Cabbage.',
        'Now, I’m not saying revenge is a dish best served in a pie. But I’m not NOT saying it.',
        'The wallows are out west, past the river. Bring me tusks. I have plans.',
      ],
      steps: [
        { type: 'kill', mob: 'boar', need: 8, text: 'Hunt Bristleback Boars' },
        { type: 'collect', item: 'Boar Tusk', from: { mob: 'boar' }, need: 4, chance: 0.5, text: 'Collect Boar Tusks' },
        { type: 'talk', npc: 'innkeeper', text: 'Bring the tusks to Bertha at the inn', lines: [
          'Tusks! Lovely. I’ll hang them over the bar. Scares off the tax collector.',
          'Here — pie. Fresh from the oven. Don’t ask what’s in it. Well. You know what’s in it.',
        ] },
      ],
      rewards: { xp: 0.55, silver: 2500, items: { food1: 3 } } },

    { id: 'gs_grizzle', kind: 'side', title: 'Old Grizzlefang', level: 14, giver: 'hunter', prereq: ['g2_wolves'],
      desc: 'An ancient wolf leads the packs down to the farms. Fenn has history with him.',
      offer: [
        'There’s a wolf up at the dens older than me. Grizzlefang. Took my father’s hound when I was a boy.',
        'He’s the one leading the packs down to the farms now. I can’t take him alone, and I’m too proud to say that twice.',
      ],
      steps: [
        { type: 'kill', name: 'Old Grizzlefang', at: ['poi:wolf_den', 'elite:1'], need: 1, text: 'Hunt Old Grizzlefang at the wolf dens' },
        { type: 'talk', npc: 'hunter', text: 'Tell Fenn Greyfletch', lines: [
          'He’s gone? (Fenn is quiet for a long moment.)',
          'Thank you. I’ll tell my father. He’s been dead ten years, but I’ll tell him anyway.',
        ] },
      ],
      rewards: { xp: 0.6, choice: [
        { label: 'Take Fenn’s hunting gloves', gear: [{ slot: 'gloves', grade: 3 }] },
        { label: 'Take the farmers’ bounty (silver)', silver: 9000 },
      ] } },

    { id: 'gs_scarecrow', kind: 'side', title: 'Scarecrow Sentry', level: 12, giver: 'farmer_hale', prereq: ['g3_redscarf'],
      desc: 'The bandits knocked over Gideon’s scarecrows. The crows are laughing.',
      offer: [
        'The crows are laughing at my scarecrows. I can hear them. Four scarecrows, all knocked flat by bandits looking for… I don’t know what.',
        'Stand them back up. And if you could make them look scarier, I wouldn’t complain.',
      ],
      steps: [
        { type: 'interact', at: ['poi:scarecrow_field', 'poi:hale_farm', 'spawn'], need: 4, spread: 7, name: 'Toppled Scarecrow', label: 'Stand it up', dur: 1.8, anim: 'interact', text: 'Stand the scarecrows back up' },
        { type: 'talk', npc: 'farmer_hale', text: 'Tell Gideon', lines: [
          'Hm. That one looks like my brother.',
          '…Leave it. The crows will hate it.',
        ] },
      ],
      rewards: { xp: 0.55, silver: 2000, items: { hp_potion: 5 } } },

    { id: 'gs_treasure', kind: 'side', title: 'X Marks the Spot', level: 14, giver: 'captain', prereq: ['g4_gentleman'],
      desc: 'Rusk’s coat had a treasure map in it. Or a very bad drawing of a potato.',
      offer: [
        'Found this in Rusk’s coat. A map, or a very bad drawing of a potato.',
        'Three X’s: the old watchtower, the millpond, and the standing stones. Old Redscarf stashes, I’d wager.',
        'Dig them up and keep what you find. Call it hazard pay.',
      ],
      steps: [
        { type: 'interact', points: [['poi:watchtower', 3, 2], ['poi:millpond', -2, 3], ['poi:standing_stones', 4, -3]], need: 3, name: 'Buried Stash', label: 'Dig', anim: 'dig', dur: 2.4, sfx: 'dig', doneSfx: 'chest_open', text: 'Dig up Rusk’s three stashes', lines: ['A rusty box: silver coins and one left boot.', 'A pouch with a pearl the size of a thumbnail… and another left boot.', 'A strongbox: silver, silver, and a third left boot. What was he DOING?'] },
        { type: 'talk', npc: 'captain', text: 'Show Captain Marsh your haul', lines: [
          'Well? … Ha! Silver, a pearl, and three left boots.',
          'Bandits. I’ll never understand them. Keep the loot — I’ll keep the boots. For evidence.',
        ] },
      ],
      rewards: { xp: 0.6, silver: 9000, items: { card_pack: 1 } } },

    { id: 'gs_almanac', kind: 'side', title: 'The Goldmeadow Almanac', level: 10, giver: 'shrinekeeper', prereq: ['g1_farm'],
      desc: 'A hidden story: the lost pages of Goldmeadow’s oldest book.',
      offer: [
        'The old Almanac of Goldmeadow was torn apart in the Sundering. Its pages turn up carved on stones and hung on shrines.',
        'Read them — all three — and the Dawn Light might remember you kindly.',
      ],
      steps: [
        { type: 'event', ev: 'collect', match: d => d.type === 'lore' && d.zone === 'goldmeadow', need: 3, init: Q => Q.loreRead('goldmeadow'), text: 'Read the lost Almanac pages (lore books in Goldmeadow)' },
        { type: 'talk', npc: 'shrinekeeper', text: 'Return to Sister Aubade at the Dawn Shrine', lines: [
          'The Harvest Songs, the Windmill, the Bridge… you read them all.',
          'Here. The shrine has kept this for whoever finished the Almanac. It has waited a long time — longer than me.',
        ] },
      ],
      rewards: { xp: 0.5, skillPts: 1 } },
  ],

  cutscenes: {
    sprig_reveal: { music: 'pip', run: async (cs, Q) => {
      const mill = Q.g.zone && (Q.g.zone.anchors['poi:windmill'] || Q.g.zone.anchors['npc:miller'] || Q.g.zone.anchors.spawn);
      const me = cs.hero; if (!mill || !me) return;
      const y = cs.L.heightAt(mill.x, mill.z);
      let sprig = cs.L.units.find(u => u.data.npcDef?.id === 'sprig');
      const sp = sprig ? sprig.pos : { x: mill.x + 2.2, z: mill.z + 3 };
      cs.shot([sp.x + 3.5, y + 2.6, sp.z + 5], [sp.x, y + 0.5, sp.z], 0.01, 36);
      cs.face(me, sp);
      await cs.wait(0.6);
      await cs.say(null, 'Something rustles behind a flour sack…', 2.2);
      if (sprig) { cs.anim(sprig, 'surprised', 1.1); cs.sfx('pip_squeak', sprig.pos); }
      cs.shot([sp.x + 1.8, y + 1.3, sp.z + 2.6], [sp.x, y + 0.45, sp.z], 1.2, 30);
      await cs.say('sprig', 'PIP!', 1.4);
      if (sprig) cs.anim(sprig, 'hop', 0.7);
      await cs.say('hero', 'Hello there, little one.', 1.8);
      if (sprig) { cs.anim(sprig, 'wave', 1.5); cs.sfx('pip_cheer', sprig.pos); }
      await cs.say('sprig', 'Pip pip! (It waves with both arms, then freezes, staring past you.)', 2.6);
      cs.shot([sp.x - 6, y + 6, sp.z + 12], [sp.x - 12, y + 1, sp.z - 6], 1.6, 40);
      cs.sfx('imp_screech', { x: sp.x - 14, y, z: sp.z - 8 });
      await cs.say(null, 'Screeches echo across the hill. Imps — a hunting party of them — sniffing for the seeds.', 3.2);
      await cs.say('hero', 'Stay behind me, Sprig.', 1.6);
    } },
  },
};
