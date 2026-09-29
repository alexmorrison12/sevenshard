// Prologue — The Siege of Brighthold (Lv 1–5). A burning castle at night: fight through the streets with Commander
// Brannoc, man the rampart cannons against the siege behemoth Ashmaw, awaken the Shard in your chest, lose to Varkhul,
// escape by ship with Seraphine. The set piece (spawns, cannons, the awakening, the duel, cutscenes) is directed by
// src/game/modes/prologue.js; these quests are its tracker, dialogue and rewards.
export default {
  id: 'prologue', name: 'Prologue · The Siege of Brighthold', zone: 'brighthold', levels: [1, 5],
  quests: [
    { id: 'p1_fire', kind: 'msq', title: 'Fire Over Brighthold', level: 1, when: Q => Q.g.mode?.kind === 'prologue',
      desc: 'Brighthold is burning. Find Commander Brannoc.',
      steps: [
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'Shardbearer! On your feet — the Legion is inside the lower town!',
          'I don’t know what that stone in your chest is, but Seraphine says it’s the only reason we’re not all ash already.',
          'Stay behind me, hit anything with horns, and don’t stop moving. Right-click where you want to go.',
          { s: 'hero', t: 'Where’s Seraphine?' },
          'At the castle, with the King’s gunners. Which is where we’re going. Through them.',
        ] },
        { type: 'kill', mob: ['imp', 'hellhound'], need: 5, text: 'Drive the imps out of the square (skills: Q W E R A S D F)' },
        { type: 'reach', at: ['poi:gate', 'poi:gatehouse', 'duel'], r: 5, text: 'Fight your way to the castle gate' },
      ],
      rewards: { xp: 1.2 } },

    { id: 'p2_blades', kind: 'msq', title: 'Blades in the Smoke', level: 2, prereq: ['p1_fire'],
      desc: 'The Legion is trying to force the castle gate. Hold it.',
      steps: [
        { type: 'kill', family: 'demon', need: 12, text: 'Hold the gate with Brannoc' },
        { type: 'talk', npc: 'guard_ren', text: 'Talk to Sergeant Ren', lines: [
          'Commander! Thank the Lights. The rampart guns have gone silent — the gunners are pinned down up there.',
          'And there’s… something outside the walls. Big. Bigger than big. It’s eating the south tower.',
          { s: 'brannoc', t: 'Then we give it something else to chew on. Shardbearer — the ramparts. Get those guns firing.' },
        ] },
      ],
      rewards: { xp: 1.2 } },

    { id: 'p3_guns', kind: 'msq', title: 'The Rampart Guns', level: 3, prereq: ['p2_blades'],
      desc: 'Something enormous is battering Brighthold’s walls. The cannons are the only answer.',
      steps: [
        { type: 'reach', at: ['poi:ramparts', 'cannon:2', 'cannon:1'], r: 6, text: 'Climb to the ramparts' },
        { type: 'cutscene', id: 'pro_ashmaw' },
        { type: 'signal', id: 'cannon_hit', need: 6, text: 'Man a cannon (G) and fire at Ashmaw (click)', at: ['cannon:1', 'cannon:2', 'cannon:3', 'cannon:4'] },
      ],
      rewards: { xp: 1.2 } },

    { id: 'p4_shardfire', kind: 'msq', title: 'Shardfire', level: 4, prereq: ['p3_guns'],
      desc: 'The wall has fallen. The Shard in your chest is burning.',
      steps: [
        { type: 'cutscene', id: 'pro_awaken' },
        { type: 'kill', family: 'demon', need: 30, text: 'Unleash the Shard: purge the horde at the breach' },
        { type: 'use', what: 'awakening', need: 1, text: 'Unleash your Awakening (V) on Ashmaw' },
        { type: 'signal', id: 'ashmaw_down', need: 1, text: 'Bring down Ashmaw' },
      ],
      rewards: { xpFlat: 0, items: { hp_potion: 5 } } },

    { id: 'p5_ravager', kind: 'msq', title: 'The Ravager', level: 5, prereq: ['p4_shardfire'],
      desc: 'The Legion’s general has come for the Shard himself.',
      steps: [
        { type: 'cutscene', id: 'pro_varkhul' },
        { type: 'signal', id: 'duel', need: 1, text: 'Face Varkhul the Ravager' },
        { type: 'cutscene', id: 'pro_loss' },
      ],
      rewards: { xp: 1.0 } },

    { id: 'p6_sails', kind: 'msq', title: 'Sails at Dawn', level: 5, prereq: ['p5_ravager'],
      desc: 'Brighthold is lost. Seraphine has a ship. Run.',
      steps: [
        { type: 'reach', at: ['poi:harbor', 'poi:sallyport', 'poi:dock', 'spawn'], r: 5, text: 'Escape to the harbour!' },
        { type: 'cutscene', id: 'pro_escape' },
      ],
      onComplete: Q => Q.g.mode?.finishPrologue?.(),
      rewards: { xp: 1.4, silver: 5000, items: { hp_potion: 10 } } },
  ],
};
