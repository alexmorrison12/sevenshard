// Chapter I — Solhaven: the survivors reach the capital, the Crown's council, proof in the rift, steel and song,
// and the road west. Plus Solhaven's side stories (fishermen, a broken hammer, a lost verse, a boot, letters home).
const FORECOURT = [[0, -72.5]];

export default {
  id: 'ch1', name: 'Chapter I · Solhaven', zone: 'solhaven', levels: [5, 7],
  quests: [
    // ------------------------------------------------------------------ main story
    { id: 'c1_harbour', kind: 'msq', title: 'A Harbour at Dawn', level: 5, prereq: ['p6_sails'],
      chapterStart: 'Solhaven', chapterOver: 'Chapter I',
      desc: 'You made it out of Brighthold. Seraphine is waiting for you on the pier.',
      steps: [
        { type: 'talk', npc: 'seraphine', text: 'Talk to Seraphine on the pier', lines: [
          'You’re awake. Good. You slept the whole crossing — and you talked in your sleep. Mostly about fire.',
          'This is Solhaven. The last free port of Valemont. Brighthold’s survivors are coming in on every boat that still floats.',
          'The Shard in your chest has gone quiet. It isn’t gone. I can still hear it — like a song behind a closed door.',
        ], choices: [
          { id: 'brannoc', text: 'What happened to Brannoc?', reply: ['He held the gate so we could run. That’s all I know.', 'That, and that he is far too stubborn to die. If he made it, he’ll be at his post on the terrace — up the grand stairs, north of the plaza.'] },
          { id: 'next', text: 'Where do we go now?', reply: ['Up. The Commander keeps a post at the top of the grand stairs, north of the plaza.', 'If Brannoc lived, that’s where he’ll be — shouting at someone.'] },
        ] },
        { type: 'talk', npc: 'brannoc', text: 'Find Commander Brannoc on the north terrace', lines: [
          '{name}. On your feet and in one piece. Good. Saves me the paperwork.',
          'Varkhul carved through my knights like wheat. Thirty years I’ve fought demons, and I have never seen a blade burn like that.',
          'And then I saw you. Glowing like a lighthouse. Cutting through his horde like it was made of straw.',
          { s: 'hero', t: 'I don’t know how I did it.' },
          'Nobody does, the first time. The King wants to see the Shardbearer. The whole council is waiting at the keep. I’ll walk you up.',
        ] },
      ],
      rewards: { xp: 1.2, silver: 3000, items: { hp_potion: 10 } } },

    { id: 'c1_council', kind: 'msq', title: 'The Crown’s Council', level: 5, prereq: ['c1_harbour'],
      desc: 'King Oswin and his council wait at the keep forecourt, at the end of the terrace avenue.',
      steps: [
        { type: 'reach', at: FORECOURT, r: 6, text: 'Go to the keep forecourt (north end of the terrace)' },
        { type: 'cutscene', id: 'council_arrive' },
        { type: 'choice', npc: 'king', text: 'Speak with King Oswin', lines: [
          'So this is the one. Forgive me — I expected someone taller. Or older. Or on fire.',
          { s: 'chancellor', t: 'Your Majesty, Brighthold’s refugees number four thousand. The treasury numbers considerably less.' },
          { s: 'magister', t: 'A Shard of the Sunheart living in a human chest. Five hundred years of scholarship say that is impossible.' },
          { s: 'seraphine', t: 'Impossible things have been happening all week, Magister. Do try to keep up.' },
          { s: 'marshal', t: 'If the Shard makes one soldier worth a hundred, I want a hundred of them. Can it be copied?' },
          { s: 'magister', t: 'It is not a recipe, Isolde.' },
          '{name}. The Legion did not take Brighthold for its walls. Varkhul came for what you carry.',
          'I cannot command a Shard. I can only ask. Will you stand with Valemont?',
        ], choices: [
          { id: 'valor', text: 'I will. Brighthold burned once. Never again.', flag: 'oath', reply: [{ s: 'king', t: 'Then Valemont stands with you, too. Whatever it costs.' }, { s: 'marshal', t: 'Finally. Someone who talks like a soldier.' }] },
          { id: 'people', text: 'I’ll fight — for the people, not the crown.', flag: 'oath', reply: [{ s: 'king', t: 'Good. The crown is heavy; the people are heavier. Carry them first.' }, { s: 'chancellor', t: 'Your Majesty, please don’t encourage them.' }] },
          { id: 'coin', text: 'Does the job come with pay?', flag: 'oath', reply: [{ s: 'chancellor', t: '…The treasury will consider a modest stipend.' }, { s: 'king', t: '(The King laughs for the first time in a week.) I like this one, Edda. Pay them.' }] },
        ] },
        { type: 'talk', npc: 'magister', text: 'Hear out High Magister Ashby', lines: [
          'Then indulge an old scholar. Prove the Shard isn’t a fluke.',
          'The Rift Nexus opened a new wound last night — a small Demon Rift. Step into it, close it, and come back alive.',
          'Rift Warden Oriel keeps the portals, on the west side of the terrace. Tell her I sent you. She’ll sigh. She always sighs.',
        ] },
      ],
      onComplete: Q => { if (Q.flag('oath') === 'coin') { Q.A.give('silver', 5000); Q.g.ui?.toast?.('The Chancellor counts out a “modest stipend”: 5,000 silver.', 'loot'); } },
      rewards: { xp: 1.0, silver: 5000 } },

    { id: 'c1_rift', kind: 'msq', title: 'Proof in the Rift', level: 6, prereq: ['c1_council'],
      desc: 'Close a Demon Rift to prove the Shard’s power to the High Magister.',
      steps: [
        { type: 'talk', npc: 'nexus', text: 'Talk to Rift Warden Oriel at the Rift Nexus', lines: [
          'The Magister sent you? Of course he did. He sends everyone. (A long sigh.) Most of them come back.',
          'Rifts are wounds in the world. Demons pour through them like water through a cracked hull. Close one, and you seal a leak.',
          'I’ve opened a small one — first circle, barely a scratch. Step onto the glowing pad when you’re ready. Purge it and the Magister gets his proof.',
        ] },
        { type: 'clear', content: 'story_chaos', launch: { kind: 'story_chaos' }, launchAt: ['portal:chaos', [-44, -58]], launchLabel: 'Enter', launchName: 'Demon Rift (Story)', at: ['portal:chaos', [-44, -58]], zone: null, text: 'Enter the Demon Rift and close it' },
        { type: 'talk', npc: 'magister', text: 'Report to High Magister Ashby', lines: [
          'You came back. With all your limbs! Most irregular.',
          'The readings are extraordinary. The Shard didn’t just protect you — it pulled at the rift like a lodestone pulls iron.',
          'Which means every demon in Solmara can feel you coming. Congratulations. You are a lighthouse in a storm.',
          'Before you go anywhere, see Hilda Ironbrand at the forge. Steel won’t stop Varkhul. It will, however, stop his imps.',
        ] },
      ],
      rewards: { xp: 1.2, silver: 4000, items: { destruction_bomb: 3, flame_grenade: 3 } } },

    { id: 'c1_steel', kind: 'msq', title: 'Steel for the Road', level: 6, prereq: ['c1_rift'],
      desc: 'Hilda Ironbrand, Solhaven’s master blacksmith, will reforge your battered Brighthold weapon.',
      steps: [
        { type: 'talk', npc: 'blacksmith', text: 'Talk to Hilda Ironbrand at the forge', lines: [
          'So you’re the glowing one. Seraphine said you’d come. Seraphine says a lot of things.',
          'Let me see that weapon. … Hm. Brighthold steel. Good bones, bad life. It’s been through a fire.',
          'I’ll fold it again. You work the bellows. Hotter. HOTTER. That’s how steel likes it.',
        ] },
        { type: 'interact', at: [['npc:blacksmith', -2.2, 1.6]], name: 'Forge Bellows', label: 'Work the bellows', anim: 'interact', dur: 2.6, sfx: 'honing_hammer', doneSfx: 'honing_success', text: 'Work the forge bellows' },
        { type: 'talk', npc: 'blacksmith', text: 'Talk to Hilda Ironbrand', lines: [
          'There. Reforged. It’ll cut deeper and complain less.',
          'Now listen, because I only say this once a day: when you get real gear — Vanguard steel — you can hone it here. Stones, silver, patience. Mostly patience.',
          'Every failure fills your Artisan’s Energy. Keep hammering. The anvil always pays its debts. Eventually.',
        ] },
      ],
      rewards: { xp: 0.9, silver: 2000, gear: [{ slot: 'weapon', grade: 2 }] } },

    { id: 'c1_song', kind: 'msq', title: 'A Song for the Road', level: 6, prereq: ['c1_steel'],
      desc: 'Lyra Songwind teaches travellers the songs that carry them home — and make friends of strangers.',
      steps: [
        { type: 'talk', npc: 'songs', text: 'Talk to Lyra Songwind in the Garden of Dawn', lines: [
          'Ah — the Shardbearer! Seraphine hums about you, you know. Constantly. Slightly off-key.',
          'Every adventurer needs a song. You already know the Hymn of Homeward — it carries you back to Solhaven from anywhere under the Seven Lights.',
          'But do you know the Song of Sunrise? It makes friends of strangers. Here — listen once, then play it back to me.',
        ], onDone: Q => { const r = Q.A.roster; r.songs ||= ['homeward']; if (!r.songs.includes('sunrise')) r.songs.push('sunrise'); Q.save(); Q.g.ui?.toast?.('Learned the Song of Sunrise.', 'success'); } },
        { type: 'event', ev: 'song', match: d => d.id === 'sunrise', text: 'Play the Song of Sunrise near Lyra (Songs menu)' },
        { type: 'talk', npc: 'songs', text: 'Talk to Lyra Songwind', lines: [
          'Beautiful! Well — enthusiastic. Enthusiasm counts.',
          'Play it for the people you meet. Some will like you more for it. Some will pretend they don’t, and hum it all day.',
        ] },
      ],
      rewards: { xp: 0.9, silver: 1500, items: { gift1: 1 } } },

    { id: 'c1_westgate', kind: 'msq', title: 'The Road West', level: 7, prereq: ['c1_song'],
      desc: 'Brannoc has a favour to ask about his brother in Goldmeadow.',
      steps: [
        { type: 'choice', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'Good. You’ve got steel and a song. That’s more than I had at your age.',
          'I’ve a favour to ask. My brother Gideon farms in Goldmeadow, west of the city. Stubborn as a mule and twice as proud.',
          'His letters talk about bandits and wolves — and lights in the fields at night. He would never ask for help. So I’m asking for him.',
        ], choices: [
          { id: 'yes', text: 'I’ll look in on him.', reply: ['Thank you. Tell him — no. Don’t tell him I sent you. He’ll only argue.'] },
          { id: 'lights', text: 'Lights in the fields?', reply: ['Gideon says fireflies. Gideon also said the bandits were “just a phase.”', 'Go. The West Gate is at the end of the artisans’ road. Please.'] },
        ] },
        { type: 'zone', zone: 'goldmeadow', at: ['gate:goldmeadow', [-78.5, 0]], text: 'Leave through the West Gate to Goldmeadow', zoneStep: true },
      ],
      rewards: { xp: 0.9, items: { hp_potion: 10 } } },

    // ------------------------------------------------------------------ side stories
    { id: 's_fish', kind: 'side', title: 'The One That Got Away', level: 7, giver: 'fisher_barty', prereq: ['c1_harbour'],
      desc: 'Two old fishers, one pier, and a forty-year argument about a carp.',
      offer: [
        'You there! Settle something. Last spring I hooked a Glass Carp as long as a rowboat.',
        'Nessa says it was “a boot with ambition.” I say she’s jealous.',
        'Cast a line off this pier and prove the Glass Carp still bite here. Loser buys the pie.',
      ],
      steps: [
        { type: 'interact', at: [['fish:1', 1.2, 0]], name: 'Fishing Spot', label: 'Cast a line', anim: 'fish_cast', dur: 3.2, sfx: 'fishing_cast', doneSfx: 'fishing_reel', say: 'Something silver and furious bites. A Glass Carp! (A small one.)', text: 'Catch a fish off the pier' },
        { type: 'choice', npc: 'fisher_nessa', text: 'Show your catch to Nessa Gill', lines: [
          'Let me guess. Barty told you about the rowboat carp.',
          'It was a boot. I was there. It had laces.',
          'Show me what you caught… Oh. Oh, my. That’s a Glass Carp. A small one — but a real one. They haven’t bitten here in years.',
        ], choices: [
          { id: 'barty', text: 'Tell her it’s Barty’s pier luck.', flag: 'fish', reply: ['Hmph. Fine. HIS luck. Tell him his hat is still ugly.'] },
          { id: 'mine', text: 'Tell her it’s my catch, fair and square.', flag: 'fish', reply: ['Ha! A newcomer out-fishes the old fool. I’ll be telling this one for years.'] },
        ] },
        { type: 'talk', npc: 'fisher_barty', text: 'Report back to Barty Brine', lines: [
          { if: Q => Q.flag('fish') === 'barty', t: 'She SAID that? My luck? Hah! I’ll be insufferable for a month.' },
          { if: Q => Q.flag('fish') !== 'barty', t: 'Your catch?! On MY pier? … Fine. Fine! Beginner’s luck. It happens to the worst of us.' },
          'Here. Nessa’s pie money — I mean, my pie money. Well earned.',
        ] },
      ],
      rewards: { xp: 0.5, silver: 2500, items: { food2: 3 } } },

    { id: 's_hammer', kind: 'side', title: 'Gerald', level: 9, giver: 'apprentice', prereq: ['c1_steel'],
      desc: 'Hilda’s apprentice has broken her favourite hammer, and it has a name.',
      offer: [
        'Psst. You’re friends with Hilda, right? Don’t be. I mean — can you keep a secret?',
        'I broke her favourite hammer. The one she named. It’s called Gerald.',
        'If I had good iron ore from Goldmeadow’s hills, I could forge Gerald a new head before she notices. Please. Gerald deserves better.',
      ],
      steps: [
        { type: 'gather', skill: 'mine', need: 3, zone: 'goldmeadow', text: 'Mine iron ore in Goldmeadow' },
        { type: 'choice', npc: 'apprentice', zone: 'solhaven', text: 'Bring the ore to Tobs Kettle', lines: [
          'You got it! Oh, Gerald, you’re going to be beautiful again.',
          'Now. Hilda’s going to ask where the new head came from. What do we tell her?',
        ], choices: [
          { id: 'truth', text: 'The truth. You broke it, you fixed it.', flag: 'gerald', reply: ['…Right. Yes. The truth. Gerald would want that.'] },
          { id: 'lie', text: 'Tell her Gerald was always like this.', flag: 'gerald', reply: ['Genius. Terrible, but genius.'] },
        ] },
        { type: 'talk', npc: 'blacksmith', zone: 'solhaven', text: 'Talk to Hilda Ironbrand', lines: [
          { if: Q => Q.flag('gerald') === 'truth', t: 'Tobs told me. Broke Gerald and fixed him with his own two hands. Hm. Maybe he’ll make a smith yet.' },
          { if: Q => Q.flag('gerald') === 'truth', t: 'Thank you for not letting the boy lie to me. Here — for honest work.' },
          { if: Q => Q.flag('gerald') !== 'truth', t: 'Funny thing. Gerald’s head is on backwards. Wonder how that happened.' },
          { if: Q => Q.flag('gerald') !== 'truth', t: '(She looks at you. She knows.) Here. For your trouble, and your terrible poker face.' },
        ] },
      ],
      rewards: { xp: 0.5, silver: 3000, items: { flame_grenade: 3, clay_grenade: 3 } } },

    { id: 's_verse', kind: 'side', title: 'The Seventh Verse', level: 8, giver: 'rapport1', prereq: ['c1_song'],
      desc: 'The Ballad of the Seven Lights has seven verses. Everyone knows six.',
      offer: [
        'The Ballad of the Seven Lights has seven verses. I know six. Everybody knows six.',
        'The seventh was torn out of every songbook in the city when the Sundering came. Scattered, they say, like the Shards.',
        'Pages turn up in odd places: one in Goldmeadow’s inn, one in Thornwood’s old abbey… and one right here in Solhaven, near Lyra’s bench, if my nose for music is right.',
      ],
      steps: [
        { type: 'interact', zone: 'solhaven', at: [['npc:songs', 2.4, 1.8]], name: 'Torn Song Page', label: 'Search', dur: 1.6, anim: 'pickup', text: 'Find the song page in the Garden of Dawn' },
        { type: 'interact', zone: 'goldmeadow', at: [['npc:innkeeper', 2.6, -1.4], ['poi:inn', 0, 2], ['spawn', 4, 4]], name: 'Torn Song Page', label: 'Search', dur: 1.6, anim: 'pickup', text: 'Find the song page at the Sleepy Sheaf Inn' },
        { type: 'interact', zone: 'thornwood', at: [['poi:abbey', -3, 2], ['npc:monk', 2, 2], ['spawn', 4, 4]], name: 'Torn Song Page', label: 'Search', dur: 1.6, anim: 'pickup', text: 'Find the song page in the ruined abbey' },
        { type: 'talk', npc: 'rapport1', zone: 'solhaven', text: 'Bring the pages to Wren Ashdown', lines: [
          'You found them. All three. (Wren reads, lips moving, fingers tapping out a rhythm.)',
          '“And when the seventh light is lost, the smallest hands shall hold it.”',
          'The smallest hands… Children? Pips? I’ll need a very long walk to think about that one.',
          'Here — the ballad is yours as much as mine now. Play it loud.',
        ] },
      ],
      onComplete: Q => Q.tome('solhaven', 'lore', 'lore:seven_lights'),
      rewards: { xp: 0.8, silver: 4000, songs: ['valor'] } },

    { id: 's_boot', kind: 'side', title: 'Old Maren’s Boot', level: 50, giver: 'rapport2', when: Q => (Q.char.level || 1) >= 50 || Q.char.powerpass,
      desc: 'Rimewing, the ice wyvern, owes Old Maren a boot.',
      offer: [
        'The ice wyvern still owes me a boot. Rimewing. Took it right off my foot in ’71. Left the foot, thank the Lights.',
        'If you ever hunt her — and you will — check her hoard for a left boot. Size nine, fur-lined. Sentimental value.',
        'Also, my other boot is lonely.',
      ],
      steps: [
        { type: 'clear', content: 'guardian', boss: 'rimewing', at: 'portal:chaos', zone: null, text: 'Defeat Rimewing (Guardian Hunt)' },
        { type: 'talk', npc: 'rapport2', zone: 'solhaven', text: 'Return the boot to Old Maren', lines: [
          'My BOOT! Look at it. Thirty years in a wyvern’s nest and not a single hole. They don’t make boots like this any more.',
          '(She hugs it. Then sniffs it. Then hugs it again.)',
          'Here. I carried this for luck against her. Seems you need it more than me.',
        ] },
      ],
      rewards: { gold: 400, items: { solar_blessing: 4, leapstone: 20 } } },

    { id: 's_letters', kind: 'side', title: 'Letters from Brighthold', level: 7, giver: 'refugee_wenna', prereq: ['c1_harbour'],
      desc: 'A baker from Brighthold is looking for her brother.',
      offer: [
        'You were at Brighthold. On the walls. I saw you — the light.',
        'My brother Tam was a pikeman. They say the Vanguard took the survivors east. I wrote him letters. I don’t know where to send them.',
        'Commander Brannoc knows the rolls. Would you ask him? Please.',
      ],
      steps: [
        { type: 'talk', npc: 'brannoc', text: 'Ask Commander Brannoc about Tam Coalbrook', lines: [
          'Coalbrook… Tam Coalbrook. Pikeman, third company. Big lad. Terrible jokes.',
          'He was alive when we broke out. The third company marched east with the Vanguard, toward Ashen Ridge.',
          'If your road takes you that way, take her letters. A letter from home is worth a regiment.',
        ] },
        { type: 'talk', npc: 'refugee_wenna', text: 'Tell Wenna the news', lines: [
          'Alive. ALIVE. (She presses a bundle of letters into your hands.)',
          'Find him. Tell him I kept the bakery key. Tell him — just give him these.',
        ] },
      ],
      rewards: { xp: 0.4, items: { hp_potion: 5 } } },

    { id: 's_letters2', kind: 'side', title: 'A Letter Home', level: 42, auto: true, prereq: ['s_letters', 'a1_camp'],
      desc: 'Wenna’s letters are still in your pack. Tam Coalbrook marched with the Vanguard.',
      steps: [
        { type: 'talk', npc: 'tam', zone: 'ashen_ridge', text: 'Find Corporal Tam Coalbrook at the Vanguard camp', lines: [
          'Letters? From… Wenna? She’s alive?',
          '(Tam reads the first letter twice. Then a third time. He laughs, and it cracks halfway.)',
          'She kept the bakery key. Of course she did. She never lost anything in her life except her temper.',
          'Tell her… no. I’ll tell her myself. When this is over I’m walking into Solhaven and eating every loaf she’s got.',
        ] },
        { type: 'talk', npc: 'refugee_wenna', zone: 'solhaven', text: 'Bring Tam’s answer to Wenna in Solhaven', lines: [
          '(Before you can speak, she reads your face and starts crying.)',
          'He’s alive. He’s alive, and he’s an idiot, and he’s alive.',
          'When the bakery opens again, you never pay for bread. Not once. Not ever.',
        ] },
      ],
      rewards: { xp: 0.6, silver: 6000, items: { food2: 5 } } },
  ],

  cutscenes: {
    council_arrive: { music: 'cutscene_heroic', run: async (cs, Q) => {
      const find = id => cs.L.units.find(u => u.data.npcDef?.id === id);
      const king = find('king'), me = cs.hero;
      const k = king ? king.pos : { x: 0, z: -79.5 };
      cs.shot([k.x + 9, (cs.L.heightAt(k.x, k.z) || 3) + 5.5, k.z + 16], [k.x, (cs.L.heightAt(k.x, k.z) || 3) + 1.6, k.z], 0.01, 34);
      cs.shot([k.x + 3, (cs.L.heightAt(k.x, k.z) || 3) + 3.2, k.z + 8.5], [k.x, (cs.L.heightAt(k.x, k.z) || 3) + 1.7, k.z], 4, 30);
      await cs.title('The Crown’s Council', 'Solhaven Keep', 2.4);
      if (me) cs.walk(me, k.x, k.z + 5.5);
      await cs.say(null, 'The council of Valemont: a king without a castle to spare, and advisors who agree on nothing.', 3.6);
      if (king) cs.anim(king, 'wave', 1.4);
      await cs.say('king', 'Let them through. The Shardbearer has walked far enough tonight.');
      await cs.wait(0.4);
    } },
  },
};
