// The in-game HUD. ui.hud.update(HudState) ~15×/s; every component diffs its own slice.
import { h, setCls, show } from '../core/util.js';
import { SkillCluster, XpBar } from './skillbar.js';
import { BossFrame, TargetFrame } from './boss.js';
import { PartyFrames } from './party.js';
import { Minimap } from './minimap.js';
import { QuestTracker } from './quests.js';
import { Chat } from './chat.js';
import { MenuStrip } from './menu.js';
import { Toasts, LootFeed, CastBar, Prompt, Progress, Timer } from './center.js';
import { ShipHud } from './ship.js';

export class Hud {
  constructor(ui, layer) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-hud', layer);
    this.xp = new XpBar(el);
    const top = this.top = h('div', 'ss-top', el);
    this.boss = new BossFrame(ui, top);
    this.target = new TargetFrame(ui, top);
    this.progress = new Progress(top);
    this.timer = new Timer(top);
    this.warnSlot = h('div', 'ss-bn-slot ss-bn-warn ss-bn-inline', top); // mechanic callouts (ui.banner kind 'warn')
    this.toasts = new Toasts(top);
    this.party = new PartyFrames(ui, el);
    const right = h('div', 'ss-right', el);
    this.minimap = new Minimap(ui, right);
    this.quests = new QuestTracker(ui, right);
    this.chat = new Chat(ui, el);
    this.menu = new MenuStrip(ui, el);
    this.lootFeed = new LootFeed(el);
    this.cast = new CastBar(el);
    this.prompt = new Prompt(el);
    this.prompt.el.addEventListener('click', () => ui.emit('hud:interact', {}));
    this.cluster = new SkillCluster(ui, el);
    this.ship = new ShipHud(ui, el);
    this.state = null;
    this.visible = true;
  }
  /** Push the full HudState (see README). Missing fields hide their widget. */
  update(s) {
    if (!s) return;
    this.state = s;
    this.cluster.update(s);
    this.xp.update(s);
    this.boss.update(s.boss || null);
    this.target.update(s.boss ? null : s.target || null);
    this.party.update(s.party);
    this.minimap.update(s.zone, s.minimap);
    this.quests.update(s.quests);
    this.progress.update(s.progress || null);
    // the boss frame already shows the enrage clock; don't repeat it as a separate timer pill
    this.timer.update(s.timer && !(s.boss && s.boss.enrageLeft != null && /enrage/i.test(s.timer.label || '')) ? s.timer : null);
    this.cast.update(s.cast || null);
    this.prompt.update(s.interact || null);
    if (s.badges) for (const k in s.badges) this.menu.badge(k, s.badges[k]);
    this.ship.update(s.ship || null);
    setCls(this.el, 'is-sailing', !!s.ship);
    this.ui.touchLayer?.update(s);
    setCls(this.el, 'has-boss', !!s.boss);
    setCls(this.el, 'is-dead', !!s.dead || s.hp <= 0);
  }
  /** Visual key-press feedback for a skill/item slot: 'Q'…'F', '1'…'4', 'V', 'Space'. */
  press(key) { const s = this.cluster.slotByKey(key); if (s) s.press(); }
  /** Right-side loot pickup feed. */
  loot(item) { this.lootFeed.add(item); }
  /** Menu button notification badge: ui.hud.badge('mail', 3). */
  badge(id, n) { this.menu.badge(id, n); }
  setVisible(on) { this.visible = !!on; show(this.el, this.visible); }
}
