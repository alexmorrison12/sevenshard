// Chapter IV — Thornwood (Lv 25–40): the Warden, the spider hollows, the last monk of a ruined abbey, the Thorn cult,
// a frightened defector, the Thornking and his corrupted seedling — and the Sunseed pointing east, toward fire.
const WARDEN = ['npc:warden', 'poi:wardens_camp', 'spawn'];
const ABBEY = ['poi:abbey', 'npc:monk', 'spawn'];
const GROVE = ['poi:treant_grove', 'poi:hollow_oak', 'npc:thornking', 'elite:2', 'spawn'];

export default {
  id: 'ch4', name: 'Chapter IV · Thornwood', zone: 'thornwood', levels: [25, 40],
  quests: [
    { id: 't1_dark', kind: 'msq', title: 'The Dark Between the Trees', level: 25, prereq: ['h5_farewell'], chapterStart: 'Thornwood', chapterOver: 'Chapter IV',
      desc: 'The Sunseed was taken into Thornwood. The forest is not friendly.',
      steps: [
        { type: 'choice', npc: 'warden', text: 'Find the Warden of Thornwood', lines: [
          'Stop right there. Hands where I can see them. …And the Pip where I can see it.',
          'Sprig? Oh, it’s YOU. You’re the little thief who keeps stealing my mushrooms.',
          { s: 'sprig', t: 'Pip. (Sprig studies the treetops, whistling innocently.)' },
          'I’m Sylva Thornwick, Warden of this wood. What’s left of it. The Thorn cult poisons the groves, the spiders grow fat on pilgrims, and the old trees have started… walking.',
        ], choices: [
          { id: 'seed', text: 'We’re hunting a stolen seed.', reply: ['Then you’re hunting the cult. They took the old abbey. Everything bad in this forest ends up at the abbey sooner or later.'] },
          { id: 'trees', text: 'Walking trees?', reply: ['Treants. They sleep for centuries, usually. Something woke them up angry.', 'Whatever you’re here for, it’ll lead you to the abbey. Everything does.'] },
        ] },
      ],
      rewards: { xp: 1.0, items: { hp_potion: 10 } } },

    { id: 't2_webs', kind: 'msq', title: 'Webs and Whispers', level: 27, prereq: ['t1_dark'],
      desc: 'The abbey road runs straight through the spider hollows.',
      steps: [
        { type: 'talk', npc: 'warden', text: 'Talk to Warden Thornwick', lines: [
          'The abbey road runs through the spider hollows. Clear it, or you’ll be wrapped up like a pilgrim pastry.',
          'And watch the canopy. They drop.',
        ] },
        { type: 'kill', mob: 'spider', need: 10, text: 'Clear the spiders from the abbey road' },
        { type: 'talk', npc: 'warden', text: 'Report to Warden Thornwick', lines: [
          'The road’s open. You smell terrible, but the road’s open.',
          'Brother Aldous still lives at the abbey, if you can call it living. He refuses to leave his candles.',
        ] },
      ],
      rewards: { xp: 1.1, gear: [{ slot: 'pants', grade: 2 }] } },

    { id: 't3_brother', kind: 'msq', title: 'The Last Brother', level: 29, prereq: ['t2_webs'],
      desc: 'The Abbey of the Seventh Light has one monk left, and he is not leaving.',
      steps: [
        { type: 'reach', at: ABBEY, r: 9, text: 'Go to the ruined abbey' },
        { type: 'talk', npc: 'monk', text: 'Talk to Brother Aldous', lines: [
          'A visitor! And a Pip! The Lights have a sense of humour after all.',
          'The cult came a month ago. They smashed the altar, stole the relics, and raised our old dead from the crypt. Rude. Very rude.',
          'Our braziers kept the dead asleep. Light them again, and the abbey will be quiet. Mind the — ah. They’re already coming.',
        ] },
        { type: 'interact', at: ABBEY, need: 3, spread: 7, name: 'Cold Brazier', label: 'Light', dur: 2.2, anim: 'cast', sfx: 'fire', doneSfx: 'fire_big', text: 'Light the abbey braziers (the dead will rise)', onUse: (Q, o) => Q.spawnNear('skeleton', 2, o, { spread: 5 }) },
        { type: 'talk', npc: 'monk', text: 'Talk to Brother Aldous', lines: [
          'Light! Blessed light! (He sits down heavily on a broken pew.)',
          'Seven candles, six Lights, one hidden. I’ve said that every night for forty years.',
          'The cultists took their loot east, to the Thorn circles. And they took something they were very excited about. Something that glowed.',
        ] },
      ],
      rewards: { xp: 1.2, silver: 5000 } },

    { id: 't4_veil', kind: 'msq', title: 'The Thorn Cult', level: 31, prereq: ['t3_brother'],
      desc: 'Break the Thorn cult’s circles and find out what they want with the Sunseed.',
      steps: [
        { type: 'kill', mob: ['cultist', 'cultist_zealot'], need: 12, text: 'Break the Thorn cult’s circles' },
        { type: 'collect', item: 'Ritual Orders', from: { mob: ['cultist', 'cultist_zealot'] }, need: 3, chance: 0.4, text: 'Take the cult’s ritual orders' },
        { type: 'talk', npc: 'monk', text: 'Bring the orders to Brother Aldous', lines: [
          '“The Seed feeds the Blightroot. When the Blightroot blooms, the Thornking’s heart will rot, and the forest will be ours.” …Oh dear.',
          'The Blightroot. The Thornking’s own seedling, grown from his heartwood. If they are feeding it the Sunseed’s light…',
          'There’s one of them who might talk. A young one who ran off. Nan Wicket has been hiding him in her hut. She thinks I don’t know. I know everything. I have a very good window.',
        ] },
      ],
      rewards: { xp: 1.2, gear: [{ slot: 'head', grade: 2 }] } },

    { id: 't5_defector', kind: 'msq', title: 'A Nervous Cultist', level: 33, prereq: ['t4_veil'],
      desc: 'A young cultist ran away from the Thorn. He knows where the Sunseed is.',
      steps: [
        { type: 'talk', npc: 'herbalist', text: 'Talk to Nan Wicket at the Wardens’ Camp', lines: [
          'Shh! Not so loud. Poor lamb. Joined for the robes, stayed because he was scared, ran because he was more scared.',
          'He’s hiding out in the Witch Lights marsh, west of here, with Old Mother Hesk. Be gentle with him. He faints.',
        ] },
        { type: 'choice', npc: 'cult_defector', text: 'Find Morrow in the Witch Lights marsh', lines: [
          'Please don’t hurt me. I only held the candles. And the knives. But mostly the candles.',
          'The Sunseed is in the Blightroot’s grove. The High Zealot feeds its light to the tree a little every night.',
          'When it blooms, the Thornking dies and the whole forest turns to thorns. Forever. That’s the plan. It’s a bad plan. I said so. Quietly.',
          'I’ll tell you everything. I just — what happens to me after?',
        ], choices: [
          { id: 'spare', text: 'You’re free. Go and do better.', flag: 'morrow', reply: ['Free? I… thank you. I’ll stay with Nan. She says I’m useful. For carrying soup.'] },
          { id: 'turnin', text: 'You’ll answer to the Warden.', flag: 'morrow', reply: ['…That’s fair. That’s more than fair. Better her than the Zealot.'] },
        ] },
        { type: 'talk', npc: 'warden', text: 'Report to Warden Thornwick', lines: [
          { if: Q => Q.flag('morrow') === 'spare', t: 'You let him go? …Hm. Maybe this forest could use a little mercy. Don’t tell anyone I said that.' },
          { if: Q => Q.flag('morrow') !== 'spare', t: 'He came quietly. He even apologised to the handcuffs.' },
          'The Thornking is awake in his grove. If the Blightroot is his seedling, he’ll want to know. Speak to him — and speak slowly.',
        ] },
      ],
      onComplete: Q => {
        if (Q.flag('morrow') === 'spare') { Q.A.give('life_tonic', 2); Q.g.ui?.toast?.('Morrow sends Nan’s herbal tonics with a note: “Thank you. Also, sorry.”', 'loot'); }
        else { Q.A.give('silver', 8000); Q.g.ui?.toast?.('The Warden pays the bounty on a Thorn cultist: 8,000 silver.', 'loot'); }
      },
      rewards: { xp: 1.2 } },

    { id: 't6_blightroot', kind: 'msq', title: 'The Blightroot', level: 36, prereq: ['t5_defector'],
      desc: 'The Thornking’s seedling has drunk too much stolen sunlight.',
      steps: [
        { type: 'talk', npc: 'thornking', text: 'Speak with the Thornking in his grove', lines: [
          'Hrrrmm. Little bright one. You smell of sunlight… and trouble.',
          'The Blightroot is my seedling. My only one in a thousand years. The Thorn-folk have fed it stolen sun until it forgot my voice.',
          'It will not listen. It cannot. Cut it down, bright one. …Gently, if you can. It is still mine.',
        ] },
        { type: 'kill', spawn: { type: 'blightroot', name: 'The Blightroot', title: 'Seedling of the Thornking', at: GROVE, off: [0, -8], trigger: 34 }, need: 1, text: 'Cut down the Blightroot' },
        { type: 'cutscene', id: 'sunseed_found' },
        { type: 'talk', npc: 'thornking', text: 'Speak with the Thornking', lines: [
          'Hrrm. It sleeps now. Truly sleeps. Thank you, bright one.',
          'The little seed points east. Toward fire. Toward the one you call the Ravager.',
          'Go. The forest will remember your name. Slowly. But it will remember.',
        ] },
      ],
      rewards: { xp: 1.3, choice: [
        { label: 'Take the Thornking’s gift: a heartwood weapon', gear: [{ slot: 'weapon', grade: 3 }] },
        { label: 'Take a bundle of elder heartwood and silver', items: { heartwood: 3 }, silver: 15000 },
      ] } },

    { id: 't7_road', kind: 'msq', title: 'The Road to Ash', level: 38, prereq: ['t6_blightroot'],
      desc: 'The Sunseed points to Ashen Ridge. Brannoc has brought an army.',
      steps: [
        { type: 'talk', npc: 'brannoc', text: 'Meet Commander Brannoc at the eastern road', lines: [
          'There you are. And — is that a Pip holding the sun?',
          { s: 'sprig', t: 'PIP. (Sprig holds the Sunseed up proudly. It hums, and turns to point east.)' },
          'Seraphine sent word. The Vanguard is marching on Ashen Ridge. Varkhul holds the old fortress there, and she says he’s sitting on a Shard.',
          'I’ve waited a long time to see that burning sword again. This time, we bring an army.',
        ] },
        { type: 'zone', zone: 'ashen_ridge', text: 'Ride to the Vanguard camp in Ashen Ridge' },
      ],
      rewards: { xp: 1.1, items: { hp_potion: 10, elixir: 3 } } },

    // ------------------------------------------------------------------ side stories
    { id: 'ts_remedy', kind: 'side', title: 'Nan’s Remedy', level: 28, giver: 'herbalist', prereq: ['t1_dark'],
      desc: 'Nan Wicket is brewing a remedy. For whom is not entirely clear.',
      offer: ['Spider bites, cult curses, and a very persistent cough. I need glowcaps and fresh spider venom for my remedy.', 'The glowcaps grow where the light gets in. The venom… well. You know where the venom is.'],
      steps: [
        { type: 'gather', skill: 'forage', need: 3, text: 'Gather glowcaps (foraging spots in Thornwood)' },
        { type: 'collect', item: 'Spider Venom Sac', from: { mob: 'spider' }, need: 3, chance: 0.5, text: 'Collect spider venom sacs' },
        { type: 'talk', npc: 'herbalist', text: 'Bring the ingredients to Nan Wicket', lines: ['Perfect. Now we boil it, sing to it, and never, ever drink it.', 'It’s for the cough of the TREES, dear. Have you heard them at night? Dreadful.'] },
      ],
      rewards: { xp: 0.55, items: { hp_potion: 10, panacea: 3 } } },

    { id: 'ts_knight', kind: 'side', title: 'The Hollow Knight', level: 32, giver: 'monk', prereq: ['t3_brother'],
      desc: 'The abbey’s old protector walks again, hollow and guarding nothing.',
      offer: ['In the crypt below the abbey lies Sir Aldric, our protector in better days. The cult raised him. He walks the grounds now — hollow, guarding nothing.', 'Lay him to rest. Then lay these lilies on his grave. He always said lilies were for weaklings. He was wrong about many things.'],
      steps: [
        { type: 'kill', spawn: { type: 'hollow_knight', name: 'Sir Aldric, the Hollow Knight', title: 'Protector of the Abbey', at: ABBEY, off: [8, 6], trigger: 30 }, need: 1, text: 'Lay Sir Aldric to rest' },
        { type: 'interact', at: ABBEY, off: [6, 4], name: 'Sir Aldric’s Grave', label: 'Lay lilies', dur: 2.5, anim: 'kneel', doneSfx: 'holy', text: 'Lay the lilies on Sir Aldric’s grave' },
        { type: 'talk', npc: 'monk', text: 'Tell Brother Aldous', lines: ['Rest, old friend. (Brother Aldous lights an eighth candle.) One for him, too.'] },
      ],
      rewards: { xp: 0.6, gear: [{ slot: 'shoulder', grade: 3 }] } },

    { id: 'ts_pilgrim', kind: 'side', title: 'The Lost Pilgrim', level: 30, giver: 'owl_sage', prereq: ['t2_webs'],
      desc: 'A pilgrim is lost in Thornwood. Very lost. Also rude.',
      offer: ['Whooo? A pilgrim, that’s who! Lost in the woods. Very lost. Said she was looking for the abbey.', 'I said, “Which way is the abbey?” She said, “You tell me, you’re the sage.” RUDE. Anyway, she’s by the old logging camp. Walk her to the abbey?'],
      steps: [
        { type: 'escort', who: { id: 'pilgrim', name: 'Pilgrim Oona', npc: 'villager', sex: 'f' }, from: ['poi:logging_camp', 'npc:woodcutter', 'spawn'], fromOff: [3, 3], to: ABBEY, speed: 3.2,
          ambush: [[0.35, [['spider', 3]]], [0.7, [['cultist', 2], ['cultist_zealot', 1]]]], say: 'Pilgrim Oona: “Finally. Lead the way. Slowly — my feet are older than your grandmother.”', text: 'Escort Pilgrim Oona to the abbey' },
        { type: 'talk', npc: 'owl_sage', text: 'Tell Hoot the Owl Sage', lines: ['She made it? Whooo would have thought.', 'Here — a feather for your trouble. Not one of mine. I found it. Probably a phoenix. Probably.'] },
      ],
      rewards: { xp: 0.6, silver: 4000, items: { feather: 1 } } },

    { id: 'ts_brood', kind: 'side', title: 'The Broodmother', level: 34, giver: 'woodcutter', prereq: ['t2_webs'],
      desc: 'Something big has moved into Old Bex’s logging camp. Something with a lot of legs.',
      offer: ['My logging camp’s been swallowed by webs. Something big lives in the hollows now. Big as a cart. With a cart’s worth of legs.', 'I don’t want revenge. I want my camp back. …Revenge would be nice, though.'],
      steps: [
        { type: 'kill', spawn: { type: 'broodmother', name: 'The Broodmother', title: 'Queen of the Hollows', at: ['poi:spider_hollow', 'poi:logging_camp', 'elite:1', 'spawn'], trigger: 30 }, need: 1, text: 'Slay the Broodmother in the spider hollows' },
        { type: 'talk', npc: 'woodcutter', text: 'Tell Old Bex', lines: ['Gone? Really gone? (Bex hugs her axe.)', 'Forty years, and I’ve never been so happy to see a dead spider. Here — take this. Take two.'] },
      ],
      rewards: { xp: 0.65, choice: [
        { label: 'Bex’s spare axe (weapon)', gear: [{ slot: 'weapon', grade: 3 }] },
        { label: 'A cart of timber and a purse of silver', items: { timber: 20 }, silver: 10000 },
      ] } },

    { id: 'ts_chronicle', kind: 'side', title: 'Chronicles of the Seventh Light', level: 32, giver: 'monk', prereq: ['t3_brother'],
      desc: 'A hidden story: the abbey’s scattered chronicles speak of the Hidden Light.',
      offer: ['The abbey’s chronicles were scattered by the cult — torn pages everywhere, in the grove, on the stones.', 'Find them. Read them. The seventh chapter speaks of the Hidden Light, and I would like someone besides me to know it.'],
      steps: [
        { type: 'event', ev: 'collect', match: d => d.type === 'lore' && d.zone === 'thornwood', need: 3, init: Q => Q.loreRead('thornwood'), text: 'Read the scattered chronicles (lore books in Thornwood)' },
        { type: 'talk', npc: 'monk', text: 'Return to Brother Aldous', lines: ['You’ve read them all? Then you know what I know: the Hidden Light was never lost. It was given to someone small, for safekeeping.', '(He looks at Sprig for a long, long time. Sprig looks back, and says nothing, which for a Pip is very unusual.)'] },
      ],
      rewards: { xp: 0.5, skillPts: 1 } },
  ],

  cutscenes: {
    sunseed_found: { music: 'cutscene_heroic', run: async (cs, Q) => {
      const me = cs.hero; if (!me) return;
      const tk = cs.L.units.find(u => u.data.npcDef?.id === 'thornking');
      const p = { x: me.pos.x, z: me.pos.z }, y = cs.L.heightAt(p.x, p.z);
      cs.shot([p.x + 4, y + 3, p.z + 7], [p.x, y + 1, p.z - 2], 0.01, 40);
      cs.flash(0.5); cs.sfx('holy_big', me.pos);
      cs.fx('holy_nova', { x: p.x, z: p.z - 2, r: 5 });
      await cs.say(null, 'The Blightroot shudders and falls still. From the hollow of its roots, something golden rolls free.', 3.2);
      const sprig = cs.spawn('sprig', { x: p.x + 1.2, z: p.z + 0.6, facing: Math.PI });
      if (sprig) { cs.anim(sprig, 'hop', 0.7); cs.sfx('pip_cheer', sprig.pos); }
      cs.shot([p.x + 1.5, y + 1.3, p.z + 3.2], [p.x + 1.2, y + 0.4, p.z + 0.6], 1.2, 32);
      await cs.say('sprig', 'PIP! (Sprig dives and catches the Sunseed in both arms. It is nearly as big as he is.)', 3);
      await cs.say(null, 'The seed turns slowly in his arms — and stops, pointing east, toward a red glow on the horizon.', 3.2);
      if (tk) { cs.face(tk, me); cs.anim(tk, 'idle_alt', 2); cs.shot([tk.pos.x + 6, y + 5, tk.pos.z + 10], [tk.pos.x, y + 3, tk.pos.z], 2, 40); }
      await cs.say('thornking', 'Hrrrm. Ashen Ridge. The seed wants to go home to its sisters.', 3.2);
    } },
  },
};
