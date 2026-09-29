// Chapter V — Ashen Ridge (Lv 40–50): the Vanguard camp, rift totems in the ash dunes, signal fires on the broken
// watchtowers, the assault on the Legion fortress gate, the Varkhul rematch (EncounterMode) and the Shard of Dawn.
const CAMP = ['poi:camp', 'npc:captain', 'spawn'];
const GATE = ['poi:fortress_gate', 'poi:gate', 'duel', 'spawn'];
const ARENA = ['duel', 'poi:courtyard', 'poi:arena', 'boss', 'poi:fortress_gate'];

export default {
  id: 'ch5', name: 'Chapter V · Ashen Ridge', zone: 'ashen_ridge', levels: [40, 50],
  quests: [
    { id: 'a1_camp', kind: 'msq', title: 'The Vanguard Camp', level: 40, prereq: ['t7_road'], chapterStart: 'Ashen Ridge', chapterOver: 'Chapter V',
      desc: 'The Vanguard is camped under the Legion fortress. Report in.',
      steps: [
        { type: 'talk', npc: 'captain', text: 'Report to Captain Darra Flint', lines: [
          'So you’re the Shardbearer. I expected — no, never mind. Everyone says that, don’t they.',
          'Welcome to the Vanguard. We hold this ridge with pikes, prayers and paperwork. Pell handles the paperwork.',
        ] },
        { type: 'talk', npc: 'quartermaster', text: 'Draw supplies from Quartermaster Pell', lines: [
          'Name? Rank? Blood type? Shard type? Sign here. And here. And — no, that’s my lunch order.',
          'You’ll need supplies. Take these. Don’t lose them. I’ve lost enough crates this week to build a second fortress.',
        ] },
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'Good. You made it. Seraphine is already scouting the walls with Ivy.',
          'Varkhul has held that fortress since Brighthold fell. He’s bleeding the ridge dry to feed his rifts. We end that.',
          'But not blind. Help Flint clear the dunes and light the old signal fires, and then — then we knock on his door.',
        ] },
      ],
      rewards: { xp: 1.0, items: { hp_potion: 15, elixir: 5 } } },

    { id: 'a2_ash', kind: 'msq', title: 'Ash and Embers', level: 42, prereq: ['a1_camp'],
      desc: 'Legion rift totems keep pouring demons into the ash dunes.',
      steps: [
        { type: 'talk', npc: 'captain', text: 'Talk to Captain Flint', lines: [
          'Before we march, the dunes need clearing. Imps and hellhounds, pouring out of rift totems the Legion planted in the ash.',
          'Break the totems and the flood stops. Break a few demons on the way. They won’t mind. They’re demons.',
        ] },
        { type: 'kill', family: 'demon', need: 15, text: 'Thin the demons in the ash dunes' },
        { type: 'interact', at: ['poi:totems', 'poi:rift', 'pack:2', 'pack:1', 'spawn'], need: 3, spread: 10, name: 'Legion Spawning Totem', label: 'Shatter', dur: 1.8, anim: 'slash_v', sfx: 'impact_heavy', doneSfx: 'explosion', text: 'Shatter the Legion spawning totems', onUse: (Q, o) => Q.spawnNear('imp', 3, o, { spread: 4 }) },
        { type: 'talk', npc: 'captain', text: 'Report to Captain Flint', lines: [
          'The ash is settling. First quiet morning this camp’s had in a month.',
          'Don’t tell the soldiers. They’ll want a nap.',
        ] },
      ],
      rewards: { xp: 1.1, gear: [{ slot: 'pants', grade: 3 }] } },

    { id: 'a3_towers', kind: 'msq', title: 'Signal Fires', level: 44, prereq: ['a2_ash'],
      desc: 'Light the broken watchtowers so the Vanguard’s catapults know where to aim.',
      steps: [
        { type: 'talk', npc: 'scout_ivy', text: 'Talk to Scout Ivy', lines: [
          'I’ve counted the demons on the wall. Twice. Stopped counting after that.',
          'When we attack, the fortress will call reinforcements from the ridge. Light the three old watchtower fires and our catapult crews will know exactly where to aim.',
        ] },
        { type: 'interact', points: [[['poi:tower1', 'poi:watchtower1', 'poi:watchtower', 'pack:3'], 0, 3], [['poi:tower2', 'poi:watchtower2', 'pack:4'], 0, 3], [['poi:tower3', 'poi:watchtower3', 'pack:6'], 0, 3]], need: 3, name: 'Signal Brazier', label: 'Light the fire', dur: 2.2, anim: 'cast', sfx: 'fire', doneSfx: 'fire_big', text: 'Light the three watchtower signal fires' },
        { type: 'talk', npc: 'scout_ivy', text: 'Report to Scout Ivy', lines: [
          'Three fires. I can see them from here, and so can every catapult crew in the Vanguard.',
          'Varkhul will know we’re coming. Good. Let him sweat. Do demons sweat? Let him try.',
        ] },
      ],
      rewards: { xp: 1.1, items: { flame_grenade: 5, clay_grenade: 5 } } },

    { id: 'a4_gate', kind: 'msq', title: 'The Fortress Gate', level: 46, prereq: ['a3_towers'],
      desc: 'The sappers need two minutes at the fortress gate.',
      steps: [
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'The sappers need a minute at the gate. One minute, with every demon on that wall trying to stop them.',
          'Hold them off. I’ll be right beside you. Like old times — except this time we win.',
        ] },
        { type: 'defend', at: GATE, r: 10, dur: 60, every: 6, cap: 12, protect: 'sappers', protectName: 'Vanguard Sappers', protectNpc: 'guard',
          waves: [[['imp', 4], ['hellhound', 1]], [['legionnaire', 2], ['imp', 2]], [['hellhound', 3]], [['abyss_caster', 2], ['imp', 3]], [['legionnaire', 3]]], text: 'Protect the sappers at the fortress gate!', label: 'The sappers are setting charges' },
        { type: 'cutscene', id: 'gate_breach' },
      ],
      rewards: { xp: 1.2, silver: 10000 } },

    { id: 'a5_varkhul', kind: 'msq', title: 'Varkhul the Ravager', level: 48, prereq: ['a4_gate'],
      desc: 'The gate is down. Varkhul waits in the courtyard.',
      steps: [
        { type: 'choice', npc: 'seraphine', text: 'Talk to Seraphine at the breached gate', lines: [
          'He’s in the courtyard. I can hear the Shard screaming under his feet.',
          'Last time he broke you. This time you’re not alone — and you’re not the same.',
        ], choices: [
          { id: 'end', text: 'Let’s end this.', reply: ['(She squeezes your hand once, hard.) Go.'] },
          { id: 'lose', text: 'What if I lose again?', reply: ['Then you get up. Like last time.', 'But you won’t lose. I can hear your Shard, and it isn’t afraid of him any more.'] },
        ] },
        { type: 'encounter', boss: 'varkhul', at: ARENA, bossAt: ['boss', 'poi:courtyard', 'duel'], r: 11, text: 'Defeat Varkhul the Ravager in the fortress courtyard', retry: 'Varkhul laughs as you stagger back. Catch your breath — then step into the courtyard again.' },
      ],
      rewards: { xp: 1.5, silver: 20000 } },

    { id: 'a6_shard', kind: 'msq', title: 'The Shard of Dawn', level: 49, prereq: ['a5_varkhul'],
      desc: 'Varkhul is beaten. Beneath the courtyard, something is singing.',
      steps: [
        { type: 'cutscene', id: 'shard_of_dawn' },
        { type: 'talk', npc: 'seraphine', text: 'Talk to Seraphine', lines: [
          'Two Shards. In one chest. (She laughs, a little shakily.) The Magister is going to faint.',
          'The Legion will never stop hunting you now.',
          { s: 'brannoc', t: 'Then we never stop running at them.' },
          'Let’s go home. The King will want to hear this from you — and Solhaven will want to see you.',
        ] },
      ],
      rewards: { xp: 2.0, silver: 30000, titles: ['shardbearer'], gear: [{ slot: 'weapon', grade: 4 }] } },

    // ------------------------------------------------------------------ side stories
    { id: 'as_crates', kind: 'side', title: 'Pell’s Missing Crates', level: 41, giver: 'quartermaster', prereq: ['a1_camp'],
      desc: 'Quartermaster Pell has lost five crates of supplies in the ash dunes. Again.',
      offer: ['Five crates. FIVE. Blown off a wagon in an ash storm. Bandages, rations, and my good pen.', 'The pen is the important one. Please.'],
      steps: [
        { type: 'interact', at: ['poi:dunes', 'pack:1', 'pack:2', 'spawn'], need: 5, spread: 14, name: 'Lost Supply Crate', label: 'Recover', dur: 1.4, anim: 'pickup', text: 'Recover Pell’s crates from the dunes' },
        { type: 'talk', npc: 'quartermaster', text: 'Return the crates to Quartermaster Pell', lines: ['My PEN. (Pell cradles it.) Oh, and the bandages. Yes. Those too. Very important.', 'Sign here to confirm delivery. And here. Lovely.'] },
      ],
      rewards: { xp: 0.55, items: { elixir: 5, hp_potion: 10 } } },

    { id: 'as_gargoyles', kind: 'side', title: 'Gargoyle Season', level: 43, giver: 'scout_ivy', prereq: ['a1_camp'],
      desc: 'Gargoyles nest on the broken towers and drop on scouts from above.',
      offer: ['Gargoyles nest on the broken towers. They drop on my scouts from above. We’ve started wearing pots on our heads.', 'Thin them out and we’ll take the pots off. Probably.'],
      steps: [
        { type: 'kill', mob: 'gargoyle', need: 8, text: 'Knock the gargoyles off the towers' },
        { type: 'talk', npc: 'scout_ivy', text: 'Tell Scout Ivy', lines: ['The towers are quiet. We can see for miles.', 'Keep the pot, though. You never know.'] },
      ],
      rewards: { xp: 0.6, gear: [{ slot: 'head', grade: 3 }] } },

    { id: 'as_smith', kind: 'side', title: 'The Ghost Smith', level: 45, giver: 'smith_ghost', prereq: ['a1_camp'],
      desc: 'An echo of a smith still hammers at a forge that isn’t there.',
      offer: ['…clang… (The ghost’s hammer passes through the anvil. He looks up, surprised to be seen.)', '…my last blade… never finished… the Ravager’s men took my ore… bring me ore… let me finish…'],
      steps: [
        { type: 'gather', skill: 'mine', need: 2, text: 'Mine ore on the Ridge' },
        { type: 'talk', npc: 'smith_ghost', text: 'Bring the ore to the Ghost Smith', lines: ['…clang… clang… CLANG. (For one heartbeat, the anvil is solid under his hammer.)', '…finished… (He holds out a blade of pale light, and fades with a smile.)'] },
      ],
      rewards: { xp: 0.6, gear: [{ slot: 'weapon', grade: 3 }] } },

    { id: 'as_archive', kind: 'side', title: 'The Ashen Archive', level: 44, giver: 'medic', prereq: ['a1_camp'],
      desc: 'A hidden story: the Legion left its war-journals among the ashes.',
      offer: ['The Legion left journals behind in the ash. Nobody wants to read them. I think someone should.', 'Know your enemy, my mother used to say. She was a midwife. She had a lot of enemies.'],
      steps: [
        { type: 'event', ev: 'collect', match: d => d.type === 'lore' && d.zone === 'ashen_ridge', need: 3, init: Q => Q.loreRead('ashen_ridge'), text: 'Read the scorched records (lore in Ashen Ridge)' },
        { type: 'talk', npc: 'medic', text: 'Talk to Sister Maribel', lines: ['Six Commanders, and Varkhul isn’t even one of them. Lights preserve us.', 'Thank you for reading them. Now I don’t have to.'] },
      ],
      rewards: { xp: 0.5, skillPts: 1 } },
  ],

  cutscenes: {
    gate_breach: { music: 'cutscene_heroic', run: async (cs, Q) => {
      const z = Q.g.zone, g = z && (z.anchors['poi:fortress_gate'] || z.anchors['poi:gate'] || z.anchors.duel || z.anchors.spawn);
      if (!g) return;
      const y = cs.L.heightAt(g.x, g.z);
      cs.shot([g.x + 10, y + 7, g.z + 14], [g.x, y + 2, g.z - 4], 0.01, 42);
      await cs.say('brannoc', 'Sappers — clear the gate! Everyone else, DOWN!', 2);
      cs.shake(0.9); cs.flash(0.9); cs.sfx('explosion_big', { x: g.x, y, z: g.z - 4 });
      cs.fx('explosion_big', { x: g.x, z: g.z - 4, r: 6 });
      cs.fx('crater', { x: g.x, z: g.z - 4, r: 5 });
      await cs.wait(1.2);
      cs.shot([g.x - 4, y + 3, g.z + 6], [g.x, y + 2, g.z - 8], 2.4, 36);
      await cs.title('The gate is breached', 'Ashen Ridge', 2.4);
      await cs.say('brannoc', 'VANGUARD! FOR BRIGHTHOLD!', 2);
    } },
    shard_of_dawn: { music: 'cutscene_heroic', run: async (cs, Q) => {
      const me = cs.hero; if (!me) return;
      const p = { x: me.pos.x, z: me.pos.z - 5 }, y = cs.L.heightAt(p.x, p.z);
      cs.shot([p.x + 5, y + 3.5, p.z + 9], [p.x, y + 1.5, p.z], 0.01, 38);
      await cs.say('Varkhul', 'The Emperor… will unmake you… Shardbearer…', 3);
      cs.shake(0.5); cs.sfx('boss_roar_big', p);
      await cs.say(null, 'The Ravager falls. The courtyard cracks open, and light pours up from beneath it.', 3.2);
      cs.flash(0.8); cs.sfx('holy_big', p);
      cs.fx('light_pillar', { x: p.x, z: p.z, target: { x: p.x, z: p.z }, r: 3 });
      cs.fx('holy_nova', { x: p.x, z: p.z, r: 7 });
      cs.shot([p.x + 2, y + 6, p.z + 6], [p.x, y + 4, p.z], 2.5, 44);
      await cs.title('The Shard of Dawn', 'The first Shard', 2.8);
      const sprig = cs.spawn('sprig', { x: me.pos.x + 1.2, z: me.pos.z + 0.5, facing: Math.PI });
      if (sprig) cs.anim(sprig, 'cheer', 1.3);
      await cs.say(null, 'In Sprig’s arms, the Sunseed cracks — and blooms. The Shard answers it, and drifts down into your chest.', 3.6);
      cs.fx('awaken_aura', { pos: me.pos, x: me.pos.x, z: me.pos.z, unit: me.model?.root });
      cs.anim(me, 'awaken', 1.6);
      await cs.wait(1.2);
      await cs.say('seraphine', 'It’s singing. Two voices now. Can you hear it?', 2.8);
      await cs.say('hero', 'I can hear it.', 1.8);
      await cs.say('brannoc', 'For Brighthold.', 2);
    } },
  },
};
