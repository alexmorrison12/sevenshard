// Epilogue — The Horned Legion Rises (Lv 50): a hero's welcome in Solhaven, Seraphine's vision of Gorrath, the Horned
// Tyrant, and the road ahead — guardian hunts, the Glass Sea and the legion raid unlock, with Vanguard gear to hone.
import { BOSS_DEFS } from '../bosses/index.js';
import { makeBoss } from '../../game/ai/boss.js';
import { refFor } from '../../game/ai/mob.js';

export default {
  id: 'epilogue', name: 'Epilogue · The Horned Legion Rises', zone: 'solhaven', levels: [50, 50],
  quests: [
    { id: 'e1_homecoming', kind: 'msq', title: 'Homecoming', level: 50, prereq: ['a6_shard'], chapterStart: 'The Horned Legion Rises', chapterOver: 'Epilogue',
      desc: 'Solhaven wants to see its Shardbearer.',
      steps: [
        { type: 'zone', zone: 'solhaven', text: 'Return to Solhaven (Hymn of Homeward, a triport, or the roads west)' },
        { type: 'choice', npc: 'king', text: 'Go to King Oswin at the keep forecourt', lines: [
          'Solhaven has not cheered like that since my coronation. And they cheered then mostly because there was free wine.',
          { s: 'magister', t: 'Two Shards. In one chest. I need to sit down. I AM sitting down. I need to sit down more.' },
          { s: 'chancellor', t: 'The Legion’s western armies have fallen back to the sea. Our granaries are full. For the first time this year, the ledger balances.' },
          '{name}. Varkhul is fallen and a Shard is reclaimed. Valemont owes you more than a crown can pay. Kneel, if you would.',
        ], choices: [
          { id: 'kneel', text: '(Kneel.)', flag: 'knelt', reply: ['(The King touches your shoulder with a plain steel sword. Not a ceremonial one. His own.)', 'Rise, Shardbearer of Valemont. Rise, and never kneel to anything with horns.'] },
          { id: 'stand', text: '(Stay standing.)', flag: 'knelt', reply: [{ s: 'brannoc', t: '(Brannoc coughs something that sounds a lot like a laugh.)' }, 'Ha! Brannoc warned me about you. Very well — stand, then. Stand in front of us. That’s where you’ve always been.'] },
        ] },
      ],
      rewards: { xp: 1.0, gold: 500, silver: 50000 } },

    { id: 'e2_horns', kind: 'msq', title: 'Horns in the Dark', level: 50, prereq: ['e1_homecoming'],
      desc: 'The Shards went quiet the moment you came home. They are listening.',
      steps: [
        { type: 'talk', npc: 'seraphine', text: 'Talk to Seraphine', lines: [
          'Something’s wrong. The Shards stopped singing the moment we came home. They’re… listening.',
          'I think something is listening back. Stay close to me. I want to try to see it.',
        ] },
        { type: 'cutscene', id: 'horned_vision' },
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'I saw it too. Didn’t need a Shard. I could feel it in my teeth.',
          'Gorrath. The Horned Tyrant. First of the six. Horns like siege towers and an axe that has toppled more cities than I have visited.',
          'We’ll need more than a Shard for him. We’ll need eight of the best blades in Solmara — and a support who remembers to shield.',
        ] },
      ],
      rewards: { xp: 1.0, gold: 500 } },

    { id: 'e3_road', kind: 'msq', title: 'The Road Ahead', level: 50, prereq: ['e2_horns'],
      desc: 'Solhaven is ready to send you everywhere at once.',
      steps: [
        { type: 'talk', npc: 'nexus', text: 'Talk to Rift Warden Oriel at the Rift Nexus', lines: [
          'The rifts have changed since the Ravager fell. Guardians are coming through now — ancient beasts, dragged out of whatever dark they slept in.',
          'Rimewing, the ice wyvern, is the first. You’re ready. Or at least, you are less unready than anyone else I know.',
        ] },
        { type: 'talk', npc: 'harbor', text: 'Talk to Captain Mirelle at the harbour', lines: [
          'The King’s gift: the Dawnrunner. The ship that carried you out of Brighthold. She’s yours now — sails, crew, and a cook who cannot cook.',
          'The Glass Sea is calm today. That’s when it’s most dangerous. There are islands out there with souls of their own. Go find them.',
        ] },
        { type: 'talk', npc: 'brannoc', text: 'Talk to Commander Brannoc', lines: [
          'Here. Vanguard steel. Real armour — the kind a blacksmith can hone. Hilda has been waiting months to get her hammer on something like this.',
          'Gorrath’s gates are open beyond the Rift Nexus. Find your seven. I’ll be here, shouting at recruits.',
          'And {name}? …Brighthold would have been proud of you. I am.',
        ] },
      ],
      rewards: { xp: 1.0, gold: 1000, vanguard: { hone: 0 }, unlock: ['guardians', 'raid', 'sailing', 'endgame'], items: { leapstone: 30, guardian_stone: 600, destruction_stone: 200 } } },
  ],

  cutscenes: {
    horned_vision: { music: 'cutscene_sad', after: 'city', run: async (cs, Q) => {
      const me = cs.hero; if (!me) return;
      const g = cs.g, y = cs.L.heightAt(me.pos.x, me.pos.z);
      const sera = cs.L.units.find(u => u.data.npcDef?.id === 'seraphine');
      if (sera) { cs.face(sera, me); cs.anim(sera, 'channel', 3, true); }
      cs.shot([me.pos.x + 3, y + 2.4, me.pos.z + 4.5], [me.pos.x, y + 1.4, me.pos.z], 0.01, 34);
      await cs.say('seraphine', 'Take my hand. Don’t let go — whatever you see.', 2.6);
      cs.flash(0.8); cs.sfx('void');
      // the vision: somewhere far to the east, a throne carved out of a mountain
      const def = BOSS_DEFS.gorrath;
      const at = { x: me.pos.x, z: me.pos.z - 60 };
      let boss = null;
      try { if (def) { boss = makeBoss(def, { ref: refFor(1415), partySize: 8, x: at.x, z: at.z, facing: 0 }); boss.ctrl = null; boss.untargetable = true; cs.spawn(boss, { x: at.x, z: at.z, facing: 0 }); boss.facing = 0; } } catch (e) { boss = null; }
      const prevDesat = g.renderer.fx.desat;
      g.renderer.fx.desat = 0.55;
      const by = cs.L.heightAt(at.x, at.z);
      cs.shot([at.x + 4, by + 5, at.z - 13], [at.x, by + 5.5, at.z], 0.01, 38);
      await cs.say(null, 'Far to the east, beyond the Glass Sea, something vast lifts its head from a throne of broken horns.', 3.6);
      if (boss) { boss.model?.play?.('roar', { dur: 3 }) || boss.model?.play?.('stomp', { dur: 2 }); }
      cs.sfx('boss_roar_big', { x: at.x, y: by, z: at.z }); cs.shake(0.7);
      cs.shot([at.x + 2, by + 7, at.z - 8], [at.x, by + 6.5, at.z], 1.4, 30);
      await cs.title('Gorrath', 'the Horned Tyrant', 2.8);
      await cs.say('Gorrath', 'TWO LIGHTS, IN ONE SMALL HEART. COME, THEN. COME AND BE BROKEN.', 3.4);
      cs.flash(1); cs.sfx('explosion_big');
      g.renderer.fx.desat = prevDesat || 0;
      cs.shot([me.pos.x + 3, y + 2.4, me.pos.z + 4.5], [me.pos.x, y + 1.4, me.pos.z], 0.01, 34);
      if (sera) cs.anim(sera, 'kneel', 1.6);
      await cs.say('seraphine', '(Seraphine gasps and lets go.) The Horned Tyrant. He’s awake — and he knows your name.', 3.4);
    } },
  },
};
