// The game flow: title → character select → creation → world (hub, fields, instances) → results → back.
// Owns the Account, routes every UI action, feeds windows with data, launches content, and keeps saves fresh.
import * as THREE from 'three';
import { Game } from './game.js';
import { equip, buildZone, ZONES } from './providers.js';
import { Account, xpForLevel, MAX_CHARS } from './account.js';
import { MenuStage } from './stage.js';
import { heroStats, itemLevel } from './systems/stats.js';
import { engravingLevels, engravingNodes } from '../data/engravings.js';
import { buildHud, skillView } from './hudstate.js';
import { CLASSES, CLASS_LIST } from '../data/classes/index.js';
import { CityMode } from './modes/city.js';
import { ChaosMode, CHAOS_TIERS } from './modes/chaos.js';
import { EncounterMode } from './modes/encounter.js';
import { BOSS_DEFS } from '../data/bosses/index.js';
import { GUARDIANS, RAIDS } from '../data/raids.js';
import { ITEMS, SLOT_NAMES } from '../data/items.js';
import { makeGear, honeChance, honeCost, hone, BOOSTER_CAP } from './systems/gear.js';
import { refFor } from './ai/mob.js';
import { AllyAI } from './ai/ally.js';
if (typeof window !== 'undefined') window.__AllyAI = AllyAI;
import { dayId, fmt, uid } from '../core/util.js';
import { openLobby, NetBadge } from '../net/lobby.js';
import { CITY_NPCS } from '../data/npcs.js';
import { Emitter } from '../core/events.js';
import { PLUGINS, LAUNCHERS, SERVICES, WINDOWS, ACTIONS, ZONE_MODES } from './registry.js';
import './plugins.js';
import { TouchControls } from './touch.js';
import { SocialContext } from './social/context.js';
import { sunView, rank as sunRank, resetTree as sunReset, sunState, unlocked as sunUnlocked } from './progression/sunheart.js';
import { SUNHEART_POINTS } from '../data/sunheart.js';
import { pickLine } from './social/chatter.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
const NEWS = [
  { tag: 'Event', title: 'The Horned Legion stirs', date: 'This week', body: 'Gorrath, the Horned Tyrant, waits beyond the Rift Nexus. Eight Shardbearers. Two gates. One weekly race.' },
  { tag: 'Guide', title: 'Counters save lives', date: 'Tip', body: 'When a boss glows blue, hit it with a counter skill (★) to stun it and cancel the attack.' },
  { tag: 'Collect', title: 'Pip Seeds everywhere', date: 'Always', body: 'The Pips have hidden 120 seeds across Solmara. Find them all for a very special mount.' },
];

export class Session {
  constructor() {
    this.game = new Game({ quality: q.q || 'high' });
    this.account = Account.load();
    this.game.renderer.setQuality(this.account.settings.quality || q.q || 'high');
    equip(this.game, { onAction: (t, p) => this.onAction(t, p) });
    this.ui = this.game.ui; this.game.session = this;
    this.stage = new MenuStage(this.game);
    this.char = null; this.hub = null; this.screen = null;
    this.bus = new Emitter();
    this.touch = new TouchControls(this.game);
    this.social = new SocialContext(this);
    this.game.invitedSims = this.invited = [];
    const coarse = matchMedia?.('(pointer: coarse)').matches && !matchMedia?.('(pointer: fine)').matches;
    if (coarse || q.touch) { this.ui.setTouch?.(true, { skills: true }); this.touch.enable(true); }
    this.applyVolumes();
    for (const pl of PLUGINS) { try { pl.init?.(this); } catch (e) { console.error('[plugin init]', pl.id, e); } }
    window.__session = this; window.__game = this.game;
    this.game.hooks.frame.push(dt => this.tick(dt));
  }
  applyVolumes() { const s = this.account.settings; this.game.audio?.setVolumes?.({ master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience }); }
  get L() { return this.game.level; }

  // ---------------------------------------------------------------- boot & menus
  async boot() {
    this.game.start();
    await this.backdrop();
    this.title();
    document.getElementById('boot')?.remove();
    if (q.join) this.together(q.join);
  }
  /** Solhaven at dusk behind the menus */
  async backdrop() {
    if (this.backdropZone && this.game.zone === this.backdropZone) return;
    const zone = await buildZone('solhaven', { quality: this.game.renderer.quality });
    zone.name = ZONES.solhaven?.name || 'Solhaven';
    this.game.setZone(zone); this.backdropZone = zone;
    this.game.renderer.grade = { ...this.game.renderer.grade, exposure: 0.92, vignette: 0.5 };
  }
  title() {
    this.screen = 'title';
    this.stage.title(this.game.zone?.anchors?.spawn || { x: 0, z: 0 });
    const last = this.account.char(this.account.data.lastChar);
    this.ui.screen('title', { server: 'Solmara-1', status: 'Busy', version: 'v1.0 · build ' + (__DEV__ ? 'dev' : 'live'), news: NEWS, continue: last ? { name: last.name, cls: last.cls, level: last.level } : null });
    this.game.audio?.music?.('title');
  }
  charSelect() {
    const A = this.account;
    if (!A.chars.length) return this.create();
    this.screen = 'charselect';
    const sel = A.char(A.data.lastChar) || A.chars[0];
    this.selected = sel.id;
    const sp = this.game.zone?.anchors?.spawn || { x: 0, z: 0 };
    this.stage.lineup(A.chars.map(c => ({ id: c.id, cls: c.cls, sex: c.sex, look: c.look, gear: { tier: gearTier(c) }, level: c.level })), sel.id, { x: sp.x, z: sp.z });
    this.ui.screen('charselect', { server: 'Solmara-1', roster: { level: A.roster.level, xp: A.roster.xp / (400 + A.roster.level * 120) }, max: MAX_CHARS, selected: sel.id,
      chars: A.chars.map(c => ({ id: c.id, name: c.name, cls: c.cls, level: c.level, iLvl: Math.floor(itemLevel(c)), title: c.title, location: ZONES[c.zone]?.name || (c.zone === 'prologue' ? 'Brighthold' : 'Solhaven'), rested: c.rest ? Math.round((c.rest.chaos + c.rest.guardian) / 2) : 0 })) });
  }
  create() {
    this.screen = 'create';
    this.draft = { cls: 'reaver', sex: 'm', look: { face: 0, hair: 0, hairColor: 0x3a2616, skin: 1, eyes: 0x3a6ab0, height: 1, build: 0.5, marks: 0, markColor: 0x9a1c1c }, name: '', step: 'class' };
    const sp = this.game.zone?.anchors?.spawn || { x: 0, z: 0 };
    this.stage.preview(this.draft, { x: sp.x, z: sp.z });
    if (!this._demoHover) { this._demoHover = true; document.addEventListener('pointerover', e => { if (this.screen !== 'create') return; const el = e.target.closest?.('.ss-cc-sk, .ss-cc-awk'); if (!el || el === this._demoEl) return; this._demoEl = el; const n = el.querySelector('b')?.textContent; if (n) this.stage.demoByName(n); }); }
    this.ui.screen('create', { ...this.draft, classes: CLASS_LIST.map(c => c.id), taken: this.account.chars.map(c => c.name) });
  }

  // ---------------------------------------------------------------- UI actions
  async onAction(type, p = {}) {
    try { await this.route(type, p); } catch (e) { console.error('[action]', type, e); this.ui?.toast?.('Something went wrong: ' + e.message, 'error'); }
  }
  async route(type, p) {
    const A = this.account;
    const ext = ACTIONS[type] || ACTIONS[type.split(':')[0] + ':'];
    if (ext && await ext(this, type, p)) return;
    switch (type) {
      // title
      case 'title:enter': return this.charSelect();
      case 'title:together': return this.together();
      case 'title:leaderboards': return this.openBoards();
      case 'title:settings': return this.openSettings();
      // character select
      case 'select:pick': this.selected = p.id; A.data.lastChar = p.id; this.stage.select(p.id); return;
      case 'select:enter': { const c = A.char(p.id); if (c) return this.enterWorld(c); return; }
      case 'select:create': return this.create();
      case 'select:delete': A.deleteChar(p.id); return this.charSelect();
      case 'select:back': return this.title();
      // creation
      case 'create:change': Object.assign(this.draft, { cls: p.cls, sex: p.sex, look: p.look }); this.stage.preview(this.draft); return;
      case 'create:camera': this.stage.view = p.view; return;
      case 'create:back': return A.chars.length ? this.charSelect() : this.title();
      case 'create:confirm': {
        const name = String(p.name || '').trim();
        if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{1,15}$/.test(name)) { this.ui.toast('Names are 2–16 letters or digits, starting with a letter.', 'error'); return; }
        if (A.chars.some(c => c.name.toLowerCase() === name.toLowerCase())) { this.ui.toast('You already have a character with that name.', 'error'); return; }
        const c = A.createChar({ name, cls: p.cls, sex: p.sex, look: p.look, mode: p.path === 'powerpass' ? 'powerpass' : p.path === 'raid' ? 'raid' : 'story' });
        this.ui.toast(p.path === 'powerpass' ? 'Powerpass used: welcome to the endgame.' : 'Your story begins.', 'success');
        return this.enterWorld(c);
      }
      // results
      case 'results:continue': if (this.guestMode) { this.ui.screen('game'); return; } return this.returnToHub();
      case 'results:retry': return this.lastContent ? this.launch(this.lastContent) : this.returnToHub();
      case 'results:share': return this.share?.();
      // death
      case 'death:revive': return this.revive(p.id);
      // HUD
      case 'hud:menu': return this.menu(p.id);
      case 'hud:escape': return this.ui.toggle('gamemenu', { items: gameMenuItems() });
      case 'gamemenu': return this.gameMenu(p.id);
      case 'touch:skill': return this.touch.key(p.key, p.phase);
      case 'touch': this.touch?.enable(!!p.on); return;
      case 'hud:interact': { const t = this.findInteractable(); if (t) this.interact(t); return; }
      case 'hud:skill': return this.game.player?.cast(p.slot);
      case 'hud:item': return this.game.hero?.useItem(p.slot, this.game.player.aim);
      case 'hud:awaken': return this.game.player?.awaken();
      case 'hud:minimap': case 'map:click': return this.game.player?.setDest(p.x, p.z);
      case 'chat:send': return this.chat(p);
      case 'chat:command': return this.command(p);
      case 'window:open': return this.refreshWindow(p.id);
      // character & inventory
      case 'inv:equip': case 'inv:use': return this.useItem(p.uid, p.slot);
      case 'char:unequip': this.account.unequip(this.char, p.slot); return this.refreshChar();
      // vendors
      case 'vendor:buy': return this.buy(p.id, p.qty || 1);
      case 'vendor:sell': case 'inv:sell': return this.sell(p.uid);
      // skills
      case 'skills:level': if (A.levelSkill(this.char, p.id, p.delta)) this.refreshChar(); return this.refreshWindow('skills');
      case 'skills:tripod': if (A.setTripod(this.char, p.id, p.tier, p.index)) this.refreshChar(); return this.refreshWindow('skills');
      case 'skills:assign': { const bar = this.char.bar; const from = bar.indexOf(p.id); if (from >= 0) bar[from] = bar[p.slot] ?? null; bar[p.slot] = p.id; A.save(); this.refreshChar(); return this.refreshWindow('skills'); }
      // engravings
      case 'engr:equip': { const b = (this.char.library || {})[p.id]; this.char.books[p.slot] = { id: p.id, nodes: Math.min(12, b || 12) }; A.save(); this.refreshChar(); return this.refreshWindow('engravings'); }
      case 'engr:unequip': this.char.books[p.slot] = null; this.char.books = this.char.books.filter(Boolean); A.save(); this.refreshChar(); return this.refreshWindow('engravings');
      // Sunheart Passive
      case 'sunheart:rank': { const r = sunRank(this.char, p.id, p.delta || 1); if (!r.ok) this.ui.toast({ points: 'Not enough Sunheart points.', tier: 'Spend more points in the tiers below first.', max: 'Already at max rank.', locked: 'The Sunheart awakens at item level 1400.', dependent: 'Higher tiers depend on this rank.' }[r.why] || 'Can\u2019t do that.', 'warn'); A.save(); this.refreshChar(); return this.refreshWindow('sunheart'); }
      case 'sunheart:reset': sunReset(this.char, p.tree); A.save(); this.refreshChar(); return this.refreshWindow('sunheart');
      // settings
      case 'settings:change': return this.setting(p.key, p.value);
      case 'dialog:choice': return;
      default: if (__DEV__ && !/^hud:party|resize|touch|screen|window:close/.test(type)) console.log('[ui]', type, p);
    }
  }

  // ---------------------------------------------------------------- entering the world
  heroChar(c) {
    c.engr = Object.entries(engravingLevels(c)).filter(([, v]) => v > 0).map(([k]) => k);
    return c;
  }
  async enterWorld(c) {
    this.char = c; this.account.data.lastChar = c.id; this.account.save();
    if (this.joinCode) { const code = this.joinCode; this.joinCode = null; return this.joinWorld(c, code); }
    this.stage.leave();
    const zoneId = c.zone === 'prologue' && !CLASSES[c.cls] ? 'solhaven' : (c.zone === 'prologue' ? 'solhaven' : (c.zone || 'solhaven'));
    await this.loadZone(zoneId, { region: 'Valemont', kind: 'city' });
    this.spawnMe(this.game.zone.anchors.spawn);
    this.game.mode = this.hub = this.zoneMode(zoneId);
    this.hub.enter();
    this.inWorld();
    this.bus.emit('zone', { id: zoneId, kind: this.game.zone?.kind || 'city' });
    if (this.hostMode && !this.game.net) this.startHosting();
    if (c.level < 10 && !c.flags?.welcomed) { (c.flags ||= {}).welcomed = true; this.ui.dialog({ name: 'Seraphine', title: 'Oracle of the Shards' }, ['Shardbearer! You made it out of Brighthold alive.', 'The Legion is moving. The Rift Nexus in the east plaza leads to where the fighting is — and the harbour to everything else.', { text: 'Speak with the townsfolk (G), and when you are ready, step onto a rift portal.', choices: [{ id: 'ok', text: 'I’m ready.', kind: 'talk' }] }]); }
  }
  async loadZone(id, o = {}) {
    this.ui.screen('loading', { zone: ZONES[id]?.name || id, region: o.region, kind: o.kind || ZONES[id]?.kind, pct: 5, tip: TIPS[Math.floor(Math.random() * TIPS.length)] });
    const t0 = performance.now();
    const zone = await buildZone(id, { quality: this.game.renderer.quality, onProgress: f => this.ui.screen('loading', { pct: 5 + f * 85 }) });
    zone.name = zone.name || ZONES[id]?.name || id; zone.id = id;
    this.game.setZone(zone);
    this.relayLevel(this.game.level);
    this.ui.screen('loading', { pct: 100 });
    if (performance.now() - t0 < 500) await new Promise(r => setTimeout(r, 300));
    return zone;
  }
  spawnMe(at) {
    const c = this.heroChar(this.char);
    const st = heroStats(c, { rosterLevel: this.account.roster.level });
    const kit = this.game.spawnHero({ ...c, gear: { tier: gearTier(c) }, weapon: { tier: gearTier(c), hone: c.equip.weapon?.hone || 0 } }, st, at || { x: 0, z: 0 });
    kit.items = (c.items || []).map(it => ({ id: it.id, count: Math.min(it.count, this.account.count(it.id) || it.count), cd: 0 }));
    kit.u.data.title = c.title;
    this.game.player.setMoveButton(this.account.settings.moveButton || 'right');
    return kit;
  }
  inWorld() {
    this.screen = 'game';
    this.ui.screen('game');
    this.game.onHud = () => this.ui.hud.update(this.hud());
  }
  hud() {
    const h = buildHud(this.game);
    if (!h) return h;
    h.cls = this.char?.cls; h.level = this.char?.level; h.xp = this.char?.xp || 0; h.xpMax = xpForLevel(this.char?.level || 1);
    h.currencies = { silver: this.account.count('silver'), gold: this.account.count('gold'), crystals: this.account.count('crystals') };
    for (const pl of PLUGINS) if (pl.hud) { try { pl.hud(h); } catch (e) { console.error('[plugin hud]', pl.id, e); } }
    const it = this.findInteractable();
    h.interact = it ? { key: 'G', label: it.portal ? 'Enter' : it.data?.npcDef?.object ? 'Use' : 'Talk', name: it.name } : null;
    h.zone = { name: this.game.zone?.name || '', sub: this.game.mode?.kind === 'city' ? 'Valemont' : '' };
    h.minimap = this.minimap();
    return h;
  }
  minimap() {
    const z = this.game.zone, me = this.game.hero?.u; if (!z || !me) return null;
    const mm = z.minimap || {};
    const markers = [];
    for (const u of this.L.units) {
      if (u === me || u.dead) continue;
      if (u.kind === 'npc') markers.push({ x: u.pos.x, z: u.pos.z, kind: u.data.npcDef?.action?.startsWith('shop') || u.data.npcDef?.action === 'market' ? 'vendor' : 'npc', label: u.name });
      else if (u.kind === 'boss') markers.push({ x: u.pos.x, z: u.pos.z, kind: 'boss', label: u.name });
      else if (u.kind === 'mob') markers.push({ x: u.pos.x, z: u.pos.z, kind: u.data.elite ? 'elite' : 'mob' });
      else if (u.kind === 'hero' && u.team === 0) markers.push({ x: u.pos.x, z: u.pos.z, kind: 'party', label: u.name });
      else if (u.kind === 'hero') markers.push({ x: u.pos.x, z: u.pos.z, kind: 'player' });
    }
    for (const [k, a] of Object.entries(z.anchors || {})) if (/^(portal|dock|triport|gate)/.test(k)) markers.push({ x: a.x, z: a.z, kind: k.startsWith('triport') ? 'triport' : 'portal', label: k });
    const m = this.game.mode;
    if (m?.portal) markers.push({ x: m.portal.x, z: m.portal.z, kind: 'portal', label: 'Portal' });
    return { canvas: mm.canvas || null, x0: mm.x0 ?? -80, z0: mm.z0 ?? -80, size: mm.size ?? 160, you: { x: me.pos.x, z: me.pos.z, facing: me.facing }, markers };
  }
  refreshChar() {
    if (!this.char || !this.game.hero) return;
    const c = this.heroChar(this.char), kit = this.game.hero;
    kit.char = c; kit.u.setStats(heroStats(c, { rosterLevel: this.account.roster.level })); kit.rebuild();
    c.ilvl = itemLevel(c);
    this.refreshWindow('character'); this.refreshWindow('inventory');
  }

  // ---------------------------------------------------------------- per frame
  tick(dt) {
    const g = this.game, inp = g.input;
    this.touch?.update();
    this.social?.update(); this.social?.tick();
    if (this.screen !== 'game' || !g.hero) return;
    this.char.played = (this.char.played || 0) + dt;
    for (const pl of PLUGINS) if (pl.update) { try { pl.update(dt); } catch (e) { console.error('[plugin update]', pl.id, e); } }
    if (inp.hit('interact') && !this.ui.wantsKeyboard) { const t = this.findInteractable(); if (t) this.interact(t); }
    if (inp.hit('chat') && !this.ui.wantsKeyboard) this.ui.chat.focus?.();
    // death overlay
    const me = g.hero.u;
    if (me.dead && !this.deadShown) { this.deadShown = true; this.ui.screen('death', { reason: me.lastHitBy ? `Slain by ${me.lastHitBy.name}` : 'You have fallen', revives: [{ id: 'entrance', label: 'Revive at the entrance', sub: 'Return to the start of the area', wait: 6 }, { id: 'feather', label: 'Resurrection Feather', sub: 'Revive where you fell', count: this.account.count('feather'), disabled: this.account.count('feather') <= 0 }] }); }
    if (!me.dead && this.deadShown) { this.deadShown = false; this.ui.screen('game'); }
  }
  revive(id) {
    const me = this.game.hero?.u; if (!me?.dead) return;
    const party = this.game.party;
    const at = id === 'feather' && this.account.take('feather', 1) ? { x: me.pos.x, z: me.pos.z } : null;
    if (party) party.revive(me, at || undefined);
    else { me.dead = false; me.hp = Math.round(me.hpMax * 0.6); me.invuln = 2; const sp = at || this.game.zone.anchors.spawn; me.pos.x = sp.x; me.pos.z = sp.z; }
  }

  // ---------------------------------------------------------------- hub interactions
  findInteractable() {
    for (const pl of PLUGINS) { const t = pl.interactable?.(); if (t) return t; }
    return this.game.mode?.interactable?.() || this.hub?.interactable?.() || null;
  }
  /** mode for an open-world zone: registered by id or kind, else a hub */
  zoneMode(zoneId) {
    const z = this.game.zone, f = ZONE_MODES[zoneId] || ZONE_MODES[z?.kind];
    if (f) { try { const m = f(this, z, {}); if (m) return m; } catch (e) { console.error('[zone mode]', zoneId, e); } }
    return new CityMode(this.game, { seed: dayId() });
  }
  /** publish level events on the session bus (quests, tasks, collectibles, achievements listen here) */
  relayLevel(L) {
    L.on('death', ({ unit, killer }) => {
      const me = this.game.hero?.u;
      if (unit.kind === 'mob' || unit.kind === 'boss') this.bus.emit('kill', { unit, killer, mine: killer === me || (killer?.party && killer.party === me?.party), zone: this.game.zone?.id });
      if (unit === me) this.bus.emit('death', { unit });
    });
  }
  async interact(t) {
    for (const pl of PLUGINS) if (pl.interact?.(t)) return;
    if (this.game.mode?.interact?.(t)) return;
    const me = this.game.hero.u;
    if (t.portal) {
      if (t.portal.startsWith('portal:')) return this.contentMenu(t.portal.split(':')[1]);
      if (t.portal === 'dock:ship') return this.ui.toast('The Dawnrunner is being rigged for the Glass Sea. (Sailing opens from the harbour soon.)', 'info');
      if (t.portal.startsWith('gate:')) return this.ui.toast('The road to Goldmeadow is under guard while the Legion marches.', 'info');
      if (t.portal.startsWith('triport')) return this.ui.toast('Triport attuned: Solhaven.', 'success');
      return;
    }
    const n = t.data?.npcDef; if (!n) return;
    me.faceTo(t.pos.x, t.pos.z); t.faceTo(me.pos.x, me.pos.z);
    this.bus.emit('talk', { npc: n.id, unit: t });
    t.model?.play?.('wave', { dur: 1.4 });
    const line = n.lines?.[Math.floor(Math.random() * n.lines.length)] || '…';
    const choices = [];
    const svc = SERVICE_LABELS[n.action];
    if (svc) choices.push({ id: 'svc', text: svc, kind: 'shop' });
    if (n.rapport) choices.push({ id: 'rapport', text: 'Spend time together (Rapport)', kind: 'talk' });
    for (const pl of PLUGINS) if (pl.npcChoices) { try { choices.unshift(...(pl.npcChoices(n.id) || [])); } catch (e) { console.error('[plugin choices]', pl.id, e); } }
    choices.push({ id: 'bye', text: 'Farewell.', kind: 'leave' });
    const pick = await this.ui.dialog({ id: n.id, name: n.name, title: n.title }, [{ text: line, choices }]);
    for (const pl of PLUGINS) if (pl.onNpcChoice?.(n.id, pick, t)) return;
    if (pick === 'svc') this.service(n.action, n, t);
    else if (pick && pick !== 'bye' && pick !== 'rapport') this.bus.emit('npcChoice', { npc: n.id, choice: pick, unit: t });
    if (pick === 'rapport') this.ui.toast('Rapport with ' + n.name + ' grows warmer. (Songs and emotes: B / .)', 'success');
  }
  service(action, n, unit) {
    if (SERVICES[action]) return SERVICES[action](this, n, unit);
    switch (action) {
      case 'content': return this.contentMenu('chaos');
      case 'honing': return this.honingMenu();
      case 'shop:general': this.vendorOpen = { ...this.vendorData('general', n), kind: 'general' }; return this.ui.open('vendor', this.vendorOpen);
      case 'tasks': return this.ui.toast('Wayfarer’s Tasks refresh daily at 10:00 UTC.', 'info');
      default: this.ui.toast(`${n.name}: this service opens soon.`, 'info');
    }
  }

  // ---------------------------------------------------------------- content launcher (Rift Nexus)
  async contentMenu(kind) {
    if (this.guestMode) { this.ui.toast('Your host leads the party through the rifts.', 'info'); return; }
    const il = Math.floor(itemLevel(this.char));
    const opts = [];
    for (const t of CHAOS_TIERS) opts.push({ id: `chaos:${t.id}`, text: `Chaos Dungeon — ${t.name} (iLvl ${t.ilvl})${il < t.ilvl ? ' · locked' : ''}`, kind: il < t.ilvl ? 'leave' : 'quest', ok: il >= t.ilvl });
    for (const g of GUARDIANS) if (BOSS_DEFS[g.id]) opts.push({ id: `guardian:${g.id}`, text: `Guardian Hunt — ${BOSS_DEFS[g.id].name} (iLvl ${g.ilvl})${il < g.ilvl ? ' · locked' : ''}`, kind: il < g.ilvl ? 'leave' : 'quest', ok: il >= g.ilvl });
    for (const r of Object.values(RAIDS)) r.gates.forEach((gt, i) => { if (gt.bosses.every(b => BOSS_DEFS[b.boss])) { const need = r.ilvl.normal; opts.push({ id: `raid:${r.id}:${i}`, text: `${r.kind === 'legion' ? 'Legion Raid' : 'Abyssal Dungeon'} — ${r.name}, Gate ${i + 1}: ${gt.name} (${need})${il < need ? ' · trial' : ''}`, kind: 'quest', ok: true, trial: il < need }); } });
    opts.push({ id: 'bye', text: 'Not now.', kind: 'leave', ok: true });
    const pick = await this.ui.dialog({ name: 'Rift Warden Oriel', title: 'Rift Nexus' }, [{ text: `Your item level is ${il}. Where will the rifts take you?`, choices: opts.map(o => ({ id: o.id, text: o.text, kind: o.kind })) }]);
    if (!pick || pick === 'bye') return;
    const o = opts.find(x => x.id === pick);
    if (!o?.ok) { this.ui.toast('Your item level is too low. Hone your gear at the blacksmith.', 'error'); return; }
    const [k, a, b] = pick.split(':');
    if (k === 'chaos') return this.launch({ kind: 'chaos', tier: +a });
    if (k === 'guardian') return this.launch({ kind: 'guardian', boss: a });
    if (k === 'raid') return this.launch({ kind: 'raid', raid: a, gate: +b, trial: o.trial });
  }
  async launch(c) {
    this.lastContent = c;
    if (LAUNCHERS[c.kind]) { this.hub = null; await LAUNCHERS[c.kind](this, c); this.bus.emit('zone', { id: this.game.zone?.id, kind: c.kind }); return; }
    const A = this.account, ch = this.char;
    this.hub = null;
    const done = r => this.contentDone(c, r);
    if (c.kind === 'chaos') {
      const tier = CHAOS_TIERS.find(t => t.id === c.tier) || CHAOS_TIERS[0];
      await this.loadZone('chaos_rift', { kind: 'dungeon', region: tier.name });
      this.spawnMe(this.game.zone.anchors['stage1:spawn']);
      const rested = (ch.rest?.chaos || 0) >= 20;
      this.game.mode = new ChaosMode(this.game, { ilvl: Math.max(tier.ilvl, Math.min(itemLevel(ch), tier.ilvl + 100)), tier: tier.id, allies: c.allies ?? 0, rested, onEnd: done });
      this.game.mode.enter();
    } else if (c.kind === 'guardian') {
      const def = BOSS_DEFS[c.boss], gd = GUARDIANS.find(g => g.id === c.boss);
      await this.loadZone(def.arena || gd?.arena || 'frostmere', { kind: 'arena', region: 'Guardian Hunt' });
      this.spawnMe(this.game.zone.anchors.spawn);
      this.game.mode = new EncounterMode(this.game, { boss: def, ilvl: gd?.ilvl || 1100, partySize: 4, seed: Date.now() % 1000, onEnd: done });
      this.game.mode.enter();
    } else if (c.kind === 'raid') {
      const r = RAIDS[c.raid], gt = r.gates[c.gate];
      await this.loadZone(gt.zone, { kind: 'raid', region: r.name });
      this.spawnMe(this.game.zone.anchors.spawn);
      if (c.trial) { const st = heroStats({ ...this.heroChar(ch), equip: Object.fromEntries(['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'].map(s => [s, { iLvl: r.ilvl.normal, quality: 70 }])) }); this.game.hero.u.setStats(st); this.game.hero.u.hp = this.game.hero.u.hpMax; }
      this.game.mode = new EncounterMode(this.game, { boss: gt.bosses[0].boss, bosses: gt.bosses, ilvl: r.ilvl.normal, partySize: r.players, hard: !!c.hard, seed: Date.now() % 1000, onEnd: done });
      this.game.mode.enter();
    }
    this.inWorld();
  }
  contentDone(c, r) {
    const A = this.account, ch = this.char;
    if (this.game.net?.result) this.game.net.result({ ...r, kind: c.kind, content: c });
    this.bus.emit('clear', { content: c, result: r });
    if (r.cleared && sunUnlocked(ch)) { const pts = SUNHEART_POINTS[c.kind] || 1; sunState(ch).points += pts; setTimeout(() => this.ui.toast(`+${pts} Sunheart point${pts > 1 ? 's' : ''}`, 'success'), 2200); }
    const loot = [], cur = { silver: 0, gold: 0, xp: 0 };
    if (r.cleared) {
      if (c.kind === 'chaos') {
        const t = c.tier, m = r.rested || 1;
        cur.silver = 6000 * t * m; A.give('silver', cur.silver);
        const give = (id, n) => { n = Math.round(n * m); A.give(id, n); loot.push({ ...ITEMS[id], id, name: ITEMS[id].name, count: n, icon: `item:${id}`, grade: ITEMS[id].grade }); };
        give('destruction_stone', 40 * t); give('guardian_stone', 110 * t); give('leapstone', 3 * t); if (Math.random() < 0.5) give('fusion', 2 * t);
        A.give('shards', 1500 * t * m);
        (ch.daily ||= {}).chaos = (ch.daily.chaos || 0) + 1; if (r.rested > 1 && ch.rest) ch.rest.chaos = Math.max(0, ch.rest.chaos - 20);
      } else {
        let gold = c.kind === 'raid' ? (c.gate === 0 ? 1200 : 2400) * (c.hard ? 1.5 : 1) : 0;
        const wk = `${c.raid || c.boss}:${c.gate ?? 0}:${c.hard ? 'h' : 'n'}`;
        ch.weekly ||= {}; ch.weekly.raids ||= {};
        if (gold && ch.weekly.raids[wk]) { gold = 0; this.ui.toast('Weekly raid gold already claimed on this character — practice runs still drop materials.', 'info'); }
        if (gold && !c.trial) { cur.gold = gold; A.give('gold', gold); ch.weekly.raids[wk] = Date.now(); }
        cur.silver = 25000; A.give('silver', cur.silver);
        const give = (id, n) => { A.give(id, n); loot.push({ id, name: ITEMS[id].name, count: n, icon: `item:${id}`, grade: ITEMS[id].grade }); };
        give('leapstone', c.kind === 'raid' ? 12 : 8); give('destruction_stone', 120); give('guardian_stone', 300);
        if (c.kind === 'raid') give('horn_shard', c.hard ? 12 : 8);
      }
      cur.xp = 1200 * (c.kind === 'raid' ? 3 : c.kind === 'guardian' ? 2 : 1);
      const ups = A.addXp(ch, cur.xp);
      if (ups?.length) { const lv = ups[ups.length - 1]; setTimeout(() => { this.ui.banner('Level Up', { kind: 'levelup', level: lv, sub: `You reached level ${lv}` }); this.game.audio?.stinger?.('level_up'); this.bus.emit('levelup', { level: lv }); }, 600); }
      for (const it of loot) this.ui.hud?.loot?.({ name: it.name, grade: it.grade, count: it.count, icon: it.icon, kind: 'material' });
      A.roster.stats.kills += r.kills || 1;
    }
    const me = r.meter?.find(x => x.you) || r.meter?.[0];
    const rank = !r.cleared ? 'D' : r.time < 150 ? 'S' : r.time < 240 ? 'A' : r.time < 360 ? 'B' : 'C';
    A.save();
    this.ui.screen('results', {
      kind: r.cleared ? 'clear' : 'fail', over: c.kind === 'chaos' ? 'Chaos Dungeon' : c.kind === 'guardian' ? 'Guardian Hunt' : 'Legion Raid',
      title: r.name || (c.kind === 'chaos' ? CHAOS_TIERS.find(t => t.id === c.tier)?.name : ''), sub: r.cleared ? 'Cleared' : 'Defeated', rank, time: r.time,
      stats: [{ label: 'Deaths', value: String(r.deaths ?? 0) }, { label: 'Your DPS', value: me ? fmt(me.dps) : '—' }, { label: 'Counters', value: String(me?.counters ?? 0) }],
      loot, currencies: cur, retry: true,
      dps: (r.meter || []).map(m => ({ name: m.name, cls: m.cls, dmg: m.dmg, dps: m.dps, crit: m.critPct, back: m.backPct, counters: m.counters, stagger: m.stagger, deaths: m.deaths, you: !!m.you, support: CLASSES[m.cls]?.role === 'support' })),
    });
    this.game.audio?.music?.(r.cleared ? 'victory' : 'defeat');
    // Lost Ark's "More Rewards" chest after a raid gate: pay gold for extra materials
    if (r.cleared && c.kind === 'raid' && !c.trial && !this.guestMode) setTimeout(() => this.moreRewards(c), 1400);
  }
  async moreRewards(c) {
    const A = this.account, cost = c.gate === 0 ? 300 : 500;
    const ok = await this.ui.confirm({ title: 'More Rewards', text: `Open the More Rewards chest for ${cost} gold? It holds Horns of the Tyrant, leapstones and a chance at a relic accessory or an engraving recipe.`, ok: `Open (${cost} gold)`, cancel: 'Leave it' });
    if (!ok) return;
    if (!A.take('gold', cost)) { this.ui.toast('Not enough gold.', 'error'); return; }
    const got = [];
    const give = (id, n) => { A.give(id, n); got.push(`${n} × ${ITEMS[id]?.name || id}`); };
    give('horn_shard', c.hard ? 10 : 6); give('leapstone', 8);
    if (Math.random() < 0.3) { const acc = (await import('./systems/gear.js')).makeAccessory(['necklace', 'earring', 'ring'][Math.floor(Math.random() * 3)], 5); A.addItem(this.char, acc); got.push(acc.name); }
    this.game.audio?.sfx?.('chest_open', {});
    this.ui.toast(`More Rewards: ${got.join(', ')}.`, 'loot');
  }
  async returnToHub() {
    await this.loadZone('solhaven', { kind: 'city', region: 'Valemont' });
    this.spawnMe(this.game.zone.anchors['portal:chaos'] ? { x: this.game.zone.anchors['portal:chaos'].x + 2, z: this.game.zone.anchors['portal:chaos'].z + 3 } : this.game.zone.anchors.spawn);
    this.game.mode = this.hub = this.zoneMode('solhaven'); this.hub.enter();
    this.inWorld();
  }

  // ---------------------------------------------------------------- honing (blacksmith)
  async honingMenu() {
    const c = this.char, A = this.account;
    const slots = ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'].filter(s => c.equip[s] && c.equip[s].set !== 'story');
    if (!slots.length) { this.ui.toast('Story gear can’t be honed. Reach level 50 or use a Powerpass to receive Vanguard gear.', 'info'); return; }
    const opts = slots.map(s => { const it = c.equip[s]; const ch = honeChance(it); return { id: s, text: `${SLOT_NAMES[s]}: ${it.name} +${it.hone} → +${it.hone + 1}  (${(ch.total * 100).toFixed(1)}%, energy ${(ch.energy * 100).toFixed(1)}%)`, kind: 'shop' }; });
    opts.push({ id: 'bye', text: 'Leave', kind: 'leave' });
    const pick = await this.ui.dialog({ name: 'Hilda Ironbrand', title: 'Master Blacksmith' }, [{ text: 'Which piece shall we hammer?', choices: opts }]);
    if (!pick || pick === 'bye') return;
    const it = c.equip[pick];
    const cost = honeCost(it);
    const costText = Object.entries(cost).map(([k, v]) => `${fmt(v)} ${ITEMS[k]?.name || k}`).join(', ');
    const ok = await this.ui.confirm({ title: `Hone ${it.name} to +${it.hone + 1}`, text: `Cost: ${costText}. Chance ${(honeChance(it).total * 100).toFixed(1)}%.`, ok: 'Hone', cancel: 'Cancel' });
    if (!ok) return;
    const res = hone(it, {}, (k, n) => A.has(k, n), (k, n) => A.take(k, n));
    if (!res.ok) { this.ui.toast(res.why === 'max' ? 'This piece is fully honed.' : `Not enough ${ITEMS[res.need]?.name || res.need}.`, 'error'); return; }
    A.roster.stats.honeTaps++;
    this.bus.emit('hone', { success: res.success, item: it, chance: res.chance, energy: res.energy });
    this.game.audio?.sfx?.('honing_hammer', {});
    setTimeout(() => {
      if (res.success) { A.roster.stats.honeWins++; this.game.audio?.sfx?.('honing_success', {}); this.ui.banner(`+${res.hone} SUCCESS`, { kind: 'success', sub: it.name }); }
      else { this.game.audio?.sfx?.('honing_fail', {}); this.ui.banner('Honing failed', { kind: 'fail', sub: `Artisan’s Energy ${(res.energy * 100).toFixed(1)}%` }); }
      A.save(); this.refreshChar();
    }, 900);
  }
  vendorData(kind, n) {
    const items = ['hp_potion', 'elixir', 'destruction_bomb', 'flame_grenade', 'frost_grenade', 'whirlwind_grenade', 'clay_grenade', 'dark_grenade', 'time_stop', 'panacea', 'feather'];
    return { name: n.name, title: n.title, items: items.map(id => ({ id, item: { id, name: ITEMS[id].name, grade: ITEMS[id].grade, icon: `item:${id}`, kind: ITEMS[id].kind, desc: ITEMS[id].desc }, price: { cur: 'silver', amount: ITEMS[id].value * 10 } })), currencies: { silver: this.account.count('silver'), gold: this.account.count('gold'), crystals: this.account.count('crystals') } };
  }

  // ---------------------------------------------------------------- windows
  menu(id) {
    if (id === 'settings') return this.openSettings();
    const data = this.windowData(id);
    if (data) this.ui.toggle(id, data); else this.ui.toast('This window opens soon.', 'info');
  }
  refreshWindow(id) { if (this.ui.isOpen?.(id)) { const d = this.windowData(id); if (d) this.ui.update(id, d); } }
  windowData(id) {
    const c = this.char, A = this.account; if (!c) return null;
    if (WINDOWS[id]) { try { return WINDOWS[id](this); } catch (e) { console.error('[window]', id, e); return null; } }
    const st = this.game.hero?.u.st || heroStats(c);
    switch (id) {
      case 'character': return { name: c.name, cls: c.cls, level: c.level, iLvl: Math.floor(itemLevel(c)), title: c.title, roster: A.roster.level, gear: c.equip,
        stats: { atk: Math.round(st.atk), hp: Math.round(st.hpMax), ...st.combat }, engravings: Object.entries(engravingNodes(c)).map(([id, nodes]) => ({ id, nodes, neg: id.startsWith('neg_') })) };
      case 'inventory': return { items: [...c.inv, ...Object.entries(A.roster.mats).map(([id, n]) => ({ uid: 'mat:' + id, id, name: ITEMS[id]?.name || id, kind: ITEMS[id]?.kind || 'material', grade: ITEMS[id]?.grade ?? 1, icon: `item:${id}`, count: n, desc: ITEMS[id]?.desc }))], currencies: { silver: A.count('silver'), gold: A.count('gold'), crystals: A.count('crystals') } };
      case 'skills': {
        const kit = CLASSES[c.cls];
        const hero = this.game.hero;
        return { cls: c.cls, points: c.skillPts, bar: c.bar, skills: kit.skills.map(s => { const lv = c.skills[s.id]?.lv || 1; const built = hero?.skills[s.id] || s; const v = hero ? skillView(hero, built, '') : { id: s.id, name: s.name }; return { ...v, level: lv, learned: true, lvlReq: 1, tripods: (s.tripods || []).map((tier, ti) => tier.map((tp, i) => { const t = typeof tp === 'string' ? { id: tp.split(':')[0], name: tp.split(':')[0] } : tp; return { id: t.id, name: t.name || t.id, desc: t.desc || '', icon: `tripod:${t.icon || t.id}`, unlock: [4, 7, 10][ti], picked: (c.skills[s.id]?.tri || [])[ti] === i }; })) }; }) };
      }
      case 'engravings': { const n = engravingNodes(c); return { active: Object.entries(n).map(([id, nodes]) => ({ id, nodes, neg: id.startsWith('neg_') })), equipped: [c.books?.[0] || null, c.books?.[1] || null], books: Object.entries(c.library || {}).map(([id, nodes]) => ({ id, nodes })), maxBook: 12 }; }
      case 'map': return { ...this.minimap(), zone: { name: this.game.zone?.name } };
      case 'sunheart': return sunView(c);
    }
    return null;
  }
  buy(id, qty = 1) {
    const v = this.vendorOpen || this.vendorData('general', { name: 'Vendor' });
    const row = v.items.find(r => r.id === id); if (!row) return;
    const cost = row.price.amount * qty;
    if (!this.account.take(row.price.cur, cost)) { this.ui.toast(`Not enough ${row.price.cur}.`, 'error'); this.game.audio?.sfx?.('ui_error', {}); return; }
    this.account.give(id, qty);
    const slot = this.char.items.find(it => it.id === id); if (slot) slot.count += qty;
    const hi = this.game.hero?.items.find(it => it.id === id); if (hi) hi.count += qty;
    this.game.audio?.sfx?.('coin', {});
    this.ui.toast(`Bought ${qty} × ${ITEMS[id]?.name || id}.`, 'success');
    this.refreshWindow('inventory'); if (this.ui.isOpen?.('vendor')) this.ui.update('vendor', this.vendorData(v.kind || 'general', v));
  }
  sell(uidv) {
    const c = this.char; if (!c) return;
    if (String(uidv).startsWith('mat:')) { const id = uidv.slice(4); const n = this.account.count(id); const val = (ITEMS[id]?.value || 1) * n; if (!n || !ITEMS[id]?.value) return; this.account.take(id, n); this.account.give('silver', val); this.ui.toast(`Sold ${n} × ${ITEMS[id].name} for ${fmt(val)} silver.`, 'success'); }
    else { const it = this.account.removeItem(c, uidv); if (!it) return; const val = Math.max(50, Math.round((it.iLvl || 100) * (it.grade + 1) * 2)); this.account.give('silver', val); (this.buyback ||= []).unshift({ ...it, price: { cur: 'silver', amount: val } }); this.ui.toast(`Sold ${it.name} for ${fmt(val)} silver.`, 'success'); }
    this.game.audio?.sfx?.('coin', {});
    this.refreshWindow('inventory');
  }
  useItem(uidv, slot) {
    const c = this.char; const it = c.inv.find(x => x.uid === uidv); if (!it) return;
    if (['weapon', 'armor', 'accessory', 'stone', 'bracelet'].includes(it.kind)) { const r = this.account.equip(c, it, slot); if (!r.ok) this.ui.toast(r.why === 'class' ? 'Your class can’t use this weapon.' : 'Can’t equip that.', 'error'); this.refreshChar(); }
  }
  openSettings() {
    const s = this.account.settings;
    this.ui.open('settings', { values: { quality: this.game.renderer.quality, master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, moveButton: s.moveButton, damageNumbers: s.numbers, cameraShake: s.shake }, keybinds: Object.entries(this.game.input.binds).map(([action, key]) => ({ action, keys: [key] })) });
  }
  setting(key, v) {
    const s = this.account.settings;
    if (key === 'quality') { s.quality = v; this.game.renderer.setQuality(v); }
    else if (['master', 'music', 'sfx', 'ambience'].includes(key)) { s[key] = v; this.applyVolumes(); }
    else if (key === 'moveButton') { s.moveButton = v; this.game.player?.setMoveButton(v); }
    else if (key === 'cameraShake') { s.shake = v; }
    else s[key] = v;
    this.account.save();
  }
  gameMenu(id) {
    this.ui.close('gamemenu');
    if (id === 'settings') return this.openSettings();
    if (id === 'host') { if (!this.game.net) { this.hostMode = true; this.startHosting(); } return; }
    if (id === 'charselect' || id === 'logout') { this.account.save(true); this.leaveWorld(); return this.backdrop().then(() => this.charSelect()); }
    if (id === 'title') { this.account.save(true); this.leaveWorld(); return this.backdrop().then(() => this.title()); }
  }
  leaveWorld() { this.game.clearLevel(); this.hub = null; this.game.party = null; this.game.onHud = null; }
  chat(p) { const text = String(p.text || '').slice(0, 240); if (!text) return; this.ui.chat.add({ channel: p.channel || 'area', from: this.char?.name, text, you: true }); this.game.net?.send?.({ t: 'ch', ch: p.channel, text }); }
  command(p) {
    const cmd = p.cmd.toLowerCase();
    const EM = ['wave', 'bow', 'dance', 'cheer', 'clap', 'laugh', 'cry', 'salute', 'point', 'flex', 'sit', 'sleep', 'shrug', 'facepalm', 'kneel', 'think', 'heart', 'angry', 'yes', 'no'];
    if (EM.includes(cmd)) {
      const me = this.game.hero?.u; me?.model?.play?.(cmd, { dur: 2.5, loop: cmd === 'dance' || cmd === 'sit' || cmd === 'sleep' });
      const npc = me && this.L?.units.filter(u => u.kind === 'npc' && u.distTo(me) < 8).sort((a, b) => a.distTo(me) - b.distTo(me))[0];
      this.bus.emit('emote', { id: cmd, npc: npc?.data.npcDef?.id || null });
      // the city answers: nearby adventurers sometimes mirror your emote
      if (me) for (const u of this.L.units) if (u.data.sim && u.distTo(me) < 10 && Math.random() < 0.35) setTimeout(() => u.model?.play?.(cmd, { dur: 2.5 }), 300 + Math.random() * 900);
      return;
    }
    if (['w', 'whisper', 't', 'tell', 'msg'].includes(cmd)) {
      const [to, ...rest] = String(p.args || '').split(' '); const text = rest.join(' ').trim();
      if (!to || !text) return;
      this.ui.chat.add({ channel: 'whisper', to, text, you: true });
      const sim = this.L?.units.find(u => u.name.toLowerCase() === to.toLowerCase() && u.data.sim);
      if (sim) setTimeout(() => this.ui.chat.add({ channel: 'whisper', from: sim.name, text: /bot|ai|real/i.test(text) ? 'beep boop. i mean, no?' : pickLine('reply') }), 1200 + Math.random() * 2500);
      return;
    }
    if (cmd === 'host') { if (!this.game.net) { this.hostMode = true; this.startHosting(); } return; }
    if (cmd === 'stuck') { const sp = this.game.zone.anchors.spawn; const u = this.game.hero.u; u.pos.x = sp.x; u.pos.z = sp.z; return; }
    this.ui.chat.add({ channel: 'system', text: `Unknown command /${cmd}.` });
  }
  together(code = q.join) {
    openLobby({ code,
      onHost: () => { this.hostMode = true; this.ui.toast('Choose the character you will host with.', 'info'); this.charSelect(); },
      onJoin: (c2, st) => { this.joinCode = c2; st.ok(); this.ui.toast('Choose the character you will join with.', 'info'); this.charSelect(); },
    });
  }
  startHosting() {
    import('../net/host.js').then(({ NetHost }) => {
      const badge = this.badge = new NetBadge({ role: 'host', code: null, onLeave: () => this.stopNet() });
      new NetHost(this.game, { name: this.char.name, onStatus: s => {
        if (s.code) badge.set({ code: s.code });
        if (s.guests != null) { badge.set({ n: s.guests }); }
        if (s.error) this.ui.toast(s.error, 'error');
      } });
      this.game.placeInfo = () => this.placeInfo();
    });
  }
  placeInfo() { const m = this.game.mode; return { zone: this.game.zone?.id || 'solhaven', kind: m?.kind || 'city', content: this.lastContent || null, host: this.char?.name, music: m?.kind === 'city' ? 'city' : null }; }
  stopNet() { this.game.net?.close?.(); this.game.net = null; this.badge?.remove(); this.badge = null; this.hostMode = false; if (this.guestMode) { this.guestMode = false; this.leaveWorld(); this.backdrop().then(() => this.title()); } }
  async joinWorld(c, code) {
    const { NetGuest } = await import('../net/guest.js');
    const { GuestMode } = await import('../net/guestmode.js');
    this.stage.leave();
    this.char = c; this.guestMode = true;
    this.ui.screen('loading', { zone: 'Connecting…', region: `Room ${code}`, kind: 'city', pct: 10 });
    const badge = this.badge = new NetBadge({ role: 'guest', host: '…', onLeave: () => this.stopNet() });
    const net = new NetGuest(this.game, code, this.heroChar(c), {
      onStatus: st => { if (st.error) { this.ui.toast(st.error, 'error'); this.stopNet(); } },
      onClose: reason => { this.ui.toast(reason || 'Disconnected from your friend’s world.', 'warn'); this.stopNet(); },
      onPlace: async place => {
        badge.set({ host: place.host || 'your friend' });
        await this.loadZone(place.zone || 'solhaven', { kind: place.kind === 'city' ? 'city' : 'dungeon' });
        this.spawnMe(this.game.zone.anchors?.spawn || this.game.zone.anchors?.['stage1:spawn'] || { x: 0, z: 0 });
        this.game.mode = this.hub = new GuestMode(this.game, place, net);
        this.hub.interactable = () => this.guestInteractable();
        this.game.mode.enter();
        this.lastContent = place.content;
        this.inWorld();
      },
      onResult: r => this.contentDone(r.content || { kind: r.kind || 'guardian' }, { ...r, meter: (r.meter || []).map(m => ({ ...m, you: m.name === c.name })) }),
    });
  }
  guestInteractable() {
    const me = this.game.hero?.u; if (!me) return null;
    let best = null, bd = 3.2;
    for (const u of this.L.units) { if (u.kind !== 'npc' || !u.data.npcDef) continue; const d = me.distTo(u); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  openBoards() { this.ui.toast('Leaderboards open soon in this build.', 'info'); }
}
const SERVICE_LABELS = { honing: 'Hone my gear', market: 'Browse the market', storage: 'Open roster storage', guild: 'Guild services', cards: 'Cards & engravings', 'shop:general': 'Browse goods', songs: 'Learn songs', pvp: 'Enter the Proving Grounds', sail: 'Set sail', stronghold: 'Ferry to Brightwater Isle', tasks: 'Read the notices', gems: 'Gems', wardrobe: 'Wardrobe', mounts: 'Mounts', content: 'Open the Rift Nexus', mail: 'Read mail', partyfinder: 'Find a party', story: 'Ask about the Shards', rapport: null };
const TIPS = ['Hit a boss while it glows blue with a counter skill to stun it.', 'Stand behind bosses: Back Attack skills deal more damage from behind.', 'Press Space to dash through danger. Knocked down? Space stands you back up.', 'Artisan’s Energy fills with every failed honing attempt. At 100% success is guaranteed.', 'Supports decide raids. Stay close to your Songweaver and Oathkeeper.', 'The Pips hid 120 seeds across Solmara. Some are in plain sight.', 'Rest bonus builds up for dailies you skip. Your chaos rewards double while it lasts.'];
const gameMenuItems = () => [{ id: 'host', label: 'Play Together: Host', glyph: 'users' }, { id: 'settings', label: 'Settings', glyph: 'gear' }, { id: 'charselect', label: 'Character Select', glyph: 'user' }, { id: 'title', label: 'Title Screen', glyph: 'door' }];
function gearTier(c) { const s = c.equip?.chest?.set || c.equip?.weapon?.set; return s === 'horned' ? 2 : s === 'vanguard' ? 1 : 0; }
