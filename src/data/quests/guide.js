// The Adventurer's Guide: onboarding for Powerpass / level 50+ characters, auto-granted in Solhaven. Teaches the
// endgame loop the way Lost Ark's guide quests do — chaos dungeon, honing, a guardian, songs & emotes, mounts, the raid.
const endgame = Q => Q.char && (Q.char.powerpass || (Q.char.level || 1) >= 50);

export default {
  id: 'guide', name: 'Adventurer’s Guide', zone: 'solhaven',
  quests: [
    { id: 'gd1_road', kind: 'guide', title: 'The Road Beyond', level: 50, zone: 'solhaven',
      when: Q => endgame(Q) && Q.zoneId === 'solhaven',
      desc: 'Seraphine has a plan for a Shardbearer at the height of their power.',
      steps: [
        { type: 'talk', npc: 'seraphine', text: 'Talk to Seraphine at the Rift Nexus', lines: [
          'There you are. The Shards have been humming about you all morning — loudly.',
          'You’ve grown strong. Strong enough that the Legion notices. That’s good. It means they’ll come to us, one rift at a time.',
          'Let me show you how Solhaven’s finest spend their days: rifts, guardians, the anvil, and — eventually — the Horned Tyrant himself.',
          { s: 'hero', t: 'Where do I start?' },
          'The Rift Nexus. Right behind me. Everything starts in the rifts.',
        ] },
      ],
      rewards: { silver: 20000, items: { hp_potion: 20 } } },

    { id: 'gd2_rift', kind: 'guide', title: 'Into the Rift', level: 50, zone: 'solhaven', prereq: ['gd1_road'],
      desc: 'Chaos Dungeons are the daily bread of every Shardbearer: three stages of demons, and materials for your gear.',
      steps: [
        { type: 'reach', at: 'portal:chaos', r: 6, text: 'Visit the Rift Nexus' },
        { type: 'clear', content: 'chaos', at: 'portal:chaos', text: 'Clear a Chaos Dungeon (talk to Rift Warden Oriel)', zone: null },
      ],
      rewards: { gold: 300, items: { leapstone: 15, destruction_stone: 120, guardian_stone: 300 } } },

    { id: 'gd3_anvil', kind: 'guide', title: 'Hammer and Hope', level: 50, zone: 'solhaven', prereq: ['gd2_rift'],
      desc: 'Honing turns materials into item level. It fails. A lot. Artisan’s Energy remembers every failure.',
      steps: [
        { type: 'talk', npc: 'blacksmith', text: 'Talk to Hilda Ironbrand, the blacksmith', lines: [
          'Seraphine sent you, didn’t she? She sends everyone to me when they start glowing.',
          'Honing. The noble art of hitting metal until it gets better, or until you run out of silver. Whichever comes first.',
          'Every failure fills your Artisan’s Energy. Fill it to the brim and the anvil can’t say no. Now — pick a piece and swing.',
        ] },
        { type: 'event', ev: 'hone', text: 'Hone any piece of gear once (blacksmith)' },
      ],
      rewards: { gold: 500, items: { leapstone: 20, solar_grace: 10, solar_blessing: 4 } } },

    { id: 'gd4_wyvern', kind: 'guide', title: 'Wings of Frost', level: 50, zone: 'solhaven', prereq: ['gd3_anvil'],
      desc: 'Guardians are ancient beasts the rifts drag into the world. Rimewing, Tyrant of the Frozen Sky, is the first.',
      steps: [
        { type: 'clear', content: 'guardian', at: 'portal:chaos', text: 'Hunt a guardian: Rimewing (Rift Nexus)', zone: null },
      ],
      rewards: { gold: 600, items: { leapstone: 25, solar_protection: 2 } } },

    { id: 'gd5_song', kind: 'guide', title: 'A Song and a Smile', level: 50, zone: 'solhaven', prereq: ['gd4_wyvern'],
      desc: 'Not every battle is won with a blade. Solhaven’s people remember who plays for them — and who waves back.',
      steps: [
        { type: 'event', ev: 'song', text: 'Play a song on your instrument (Songs)', zone: null },
        { type: 'event', ev: 'emote', match: d => !!d.npc, text: 'Use an emote next to someone in town (/wave, /bow…)', zone: null },
      ],
      rewards: { items: { gift1: 1, gift2: 1 }, silver: 30000 } },

    { id: 'gd6_saddle', kind: 'guide', title: 'Saddle Up', level: 50, zone: 'solhaven', prereq: ['gd5_song'],
      desc: 'Solhaven is big and your boots are not. Your mount is waiting: press T to summon it.',
      steps: [
        { type: 'reach', at: 'dock:ship', r: 7, mounted: true, text: 'Mount up (T) and ride to the harbour pier', mountedHint: 'Press T to summon your mount.' },
        { type: 'talk', npc: 'harbor', text: 'Talk to Captain Mirelle at the harbour', lines: [
          'Nice beast. Don’t let it near my ropes — the last horse ate a mooring line.',
          'The Glass Sea is calm today. That’s when it’s most dangerous. When you’re ready to sail, the Dawnrunner will be ready for you.',
          'Here — a stray followed the fishmongers in this morning and won’t leave the pier. It seems to like you better than me.',
        ] },
      ],
      rewards: { pets: ['foxling'], gold: 300, items: { food2: 5 } } },

    { id: 'gd7_legion', kind: 'guide', title: 'Eight Blades', level: 50, zone: 'solhaven', prereq: ['gd6_saddle'],
      desc: 'The Horned Tyrant waits beyond the Rift Nexus. Eight Shardbearers, two gates. Try the raid in trial mode to learn the mechanics.',
      steps: [
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'So. You’ve bled in the rifts and frozen on a wyvern’s back. Good. Now for the real thing.',
          'Gorrath, the Horned Tyrant. First of the Legion Commanders. His horns have toppled cities. His axe has toppled more.',
          'Nobody fights him alone. Eight blades, two gates, and a support who remembers to shield. Try the raid — even a trial run teaches you more than any book.',
        ] },
        { type: 'clear', content: 'raid', at: 'portal:chaos', text: 'Attempt the Legion Raid: Gorrath — any gate, trial counts (Rift Nexus)', zone: null, any: true },
        { type: 'talk', npc: 'brannoc', text: 'Report to Commander Brannoc', lines: [
          'You walked into the Tyrant’s hall and walked back out. That puts you ahead of most of my old company.',
          'Keep honing. Keep your party close. And when the horns come down — and they will — I want to hear about it first.',
        ] },
      ],
      rewards: { gold: 1500, items: { leapstone: 40, solar_protection: 3, card_pack_epic: 1 } } },
  ],
};
