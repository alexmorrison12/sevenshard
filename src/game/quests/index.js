// Quest plugin: registers the quest runtime with the session (tracker, markers, NPC dialogue, rewards, cutscenes) plus
// the story content launcher ('story_chaos'), the tracker click action, the 'story' NPC service and the quest journal.
// Access at runtime: session.quests (QuestSystem) — modes use it for signals, XP and cutscenes.
import { registerPlugin, registerContent, registerAction, registerService, registerWindow } from '../registry.js';
import { QuestSystem } from './system.js';
import { ChaosMode } from '../modes/chaos.js';
import { storyTalk } from './story.js';

let Q = null;
export const quests = () => Q;

registerPlugin({
  id: 'quests',
  init(session) { Q = session.quests = new QuestSystem(session); },
  update(dt) { Q?.update(dt); },
  hud(h) { Q?.hud(h); },
  interactable() { return Q?.interactable() || null; },
  interact(t) { return Q?.interact(t) || false; },
  npcChoices(npcId) { return Q?.npcChoices(npcId) || []; },
  onNpcChoice(npcId, choice, unit) { return Q?.onNpcChoice(npcId, choice, unit) || false; },
});

// tracker click → track + auto-path
registerAction('hud:quest', (s, type, p) => { Q?.onTrackerClick(p?.id); return true; });
// Brannoc / Seraphine: "Ask about the Shards"
registerService('story', (s, npcDef, unit) => storyTalk(Q, npcDef, unit));
// quest journal data (J) for the UI's 'quests' window
registerWindow('quests', () => Q?.journal() || null);

// A story-sized Demon Rift for Chapter I: the chaos dungeon at the character's level, faster to fill, no allies.
class StoryRift extends ChaosMode {
  enter() { super.enter(); this.ref = { ...this.ref, ap: this.ref.ap * 0.55 }; this.limit = 900; }
  addPct(v) { super.addPct(v * 1.7); }
}
registerContent('story_chaos', async (session, c) => {
  const lvl = Math.max(1, session.char?.level || 5);
  await session.loadZone('chaos_rift', { kind: 'dungeon', region: 'Demon Rift' });
  session.spawnMe(session.game.zone.anchors['stage1:spawn'] || session.game.zone.anchors.spawn);
  const mode = session.game.mode = new StoryRift(session.game, { ilvl: lvl, tier: 1, allies: 0, onEnd: r => storyRiftDone(session, c, r) });
  mode.enter();
  session.inWorld();
  session.game.ui?.banner?.('Demon Rift', { kind: 'zone', sub: 'Proof in the Rift' });
});
function storyRiftDone(session, c, r) {
  session.bus.emit('clear', { content: { kind: 'story_chaos' }, result: r });
  const A = session.account, xp = r.cleared ? Math.round(1500 + (session.char?.level || 5) * 400) : 0;
  if (r.cleared) { A.give('silver', 4000); Q?.grantXp(xp); }
  A.save();
  const me = r.meter?.find(x => x.you) || r.meter?.[0];
  session.ui.screen('results', {
    kind: r.cleared ? 'clear' : 'fail', over: 'Demon Rift', title: 'Proof in the Rift', sub: r.cleared ? 'Rift closed' : 'The rift held', rank: r.cleared ? (r.time < 240 ? 'S' : r.time < 360 ? 'A' : 'B') : 'D', time: r.time,
    stats: [{ label: 'Demons slain', value: String(r.kills || 0) }, { label: 'Your DPS', value: me ? Math.round(me.dps).toLocaleString('en-US') : '—' }],
    loot: r.cleared ? [{ id: 'silver', name: 'Silver', count: 4000, icon: 'currency:silver', grade: 1 }] : [], currencies: { silver: r.cleared ? 4000 : 0, gold: 0, xp }, retry: !r.cleared,
    dps: (r.meter || []).map(m => ({ name: m.name, cls: m.cls, dmg: m.dmg, dps: m.dps, crit: m.critPct, back: m.backPct, counters: m.counters, stagger: m.stagger, deaths: m.deaths, you: !!m.you })),
  });
  session.game.audio?.music?.(r.cleared ? 'victory' : 'defeat');
}
