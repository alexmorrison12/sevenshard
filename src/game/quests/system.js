// The quest runtime: per-character quest log (session.char.quests), step progress from gameplay events, NPC dialogue
// (offers, talk steps, choices, turn-ins with reward choices), rewards, level-up celebrations, the quest tracker,
// minimap markers, world markers, cutscene steps, and the story NPCs / objects / runners the steps need in the world.
//
// Character state:  char.quests = { active: [{ id, step, n, t, used?, data? }], done: [ids], flags: {}, tracked, v }
// Step types: talk · choice · kill · collect · gather · reach · interact · escort · defend · use · cutscene · clear ·
//             event · zone · level · signal · encounter  (see src/data/quests/README.md)
import { QUESTS, QUEST_LIST, CUTSCENES, KIND_ORDER } from '../../data/quests/index.js';
import { STORY_NPCS, npcName as npcNameOf, cityNpc } from '../../data/quests/npcs.js';
import { FIELD_NPCS, ROUTES, GATE_FALLBACK, FIELDS, PACK_TAGS } from '../../data/field.js';
import { ZONES } from '../providers.js';
import { ITEMS, GEAR_SLOTS } from '../../data/items.js';
import { xpForLevel, MAX_LEVEL } from '../account.js';
import { storyGear, makeGear } from '../systems/gear.js';
import { itemLevel } from '../systems/stats.js';
import { Cutscene, cutsceneActive, screenDark, fill } from './cutscene.js';
import { QuestMarkers } from './markers.js';
import { QuestWorld } from './world.js';
import { anchorOf, dist, warnOnce, familyOf, makeFieldMob, walkable } from './spawn.js';
import * as COLL from '../systems/collectibles.js';

const FIELD_NPC_BY_ID = {}; for (const [zone, list] of Object.entries(FIELD_NPCS)) for (const n of list) FIELD_NPC_BY_ID[n.id] = { ...n, zone };
const ZONE_NAME = id => FIELDS[id]?.name || ZONES[id]?.name || ({ solhaven: 'Solhaven', brighthold: 'Brighthold' })[id] || id;
const OPEN_KINDS = new Set(['city', 'field', 'pipsprout', 'prologue', 'island']);
const KIND_LABEL = { msq: 'Main Story', side: 'Side Quest', guide: 'Adventurer’s Guide', event: 'Event', daily: 'Daily' };
const CLASS_NAME = { reaver: 'Reaver', oathkeeper: 'Oathkeeper', stormfist: 'Stormfist', pistoleer: 'Pistoleer', starcaller: 'Starcaller', songweaver: 'Songweaver', bladedancer: 'Bladedancer', demonbound: 'Demonbound' };

export class QuestSystem {
  constructor(session) {
    this.s = session;
    this.markers = new QuestMarkers(session.game);
    this.world = new QuestWorld(this);
    this.declined = new Set(); this.dirty = true; this.t = 0; this.busy = false; this.channel = null; this.pendingCut = null; this.pending = [];
    this.lastLevel = null; this.lastChar = null; this.boundLevel = null; this.offLevel = [];
    const on = (ev, fn) => session.bus.on(ev, d => { try { fn(d); } catch (e) { console.error('[quests]', ev, e); } });
    on('kill', d => this.onKill(d));
    on('zone', d => this.onZone(d));
    on('clear', d => this.onEvent('clear', d));
    for (const ev of ['collect', 'gather', 'song', 'emote', 'hone', 'levelup', 'item', 'sail', 'pvp', 'facet', 'npcChoice', 'death']) on(ev, d => this.onEvent(ev, d));
    this.wrapMinimap();
  }
  // ---------------------------------------------------------------- accessors
  get g() { return this.s.game; }
  get A() { return this.s.account; }
  get char() { return this.s.char; }
  get me() { return this.g.hero?.u; }
  get zoneId() { return this.g.zone?.id || null; }
  get st() {
    const c = this.char; if (!c) return null;
    const q = c.quests ||= { active: [], done: [] };
    q.active ||= []; q.done ||= []; q.flags ||= {};
    return q;
  }
  def(id) { return QUESTS[id] || null; }
  get all() { return QUEST_LIST; }
  entry(id) { return this.st?.active.find(e => e.id === id) || null; }
  isActive(id) { return !!this.entry(id); }
  isDone(id) { return !!this.st?.done.includes(id); }
  stepOf(id) { const e = this.entry(id); return e ? e.step : this.isDone(id) ? 99 : -1; }
  flag(k) { return this.st?.flags[k]; }
  setFlag(k, v = true) { if (this.st) { this.st.flags[k] = v; this.save(); } }
  npcName(id) { return npcNameOf(id, FIELD_NPC_BY_ID); }
  save() { this.A.save(); }
  step(e) { return this.def(e.id)?.steps[e.step] || null; }
  need(s) { return s?.need || 1; }
  /** where a step happens: its own zone, else the quest's; `zone: null` on a step means anywhere */
  stepZone(q, s) { return s && 'zone' in s ? s.zone : q.zone || null; }
  inZone(q, s) { const z = this.stepZone(q, s); return !z || z === this.zoneId; }
  // ---------------------------------------------------------------- availability
  available(q) {
    if (!this.char || this.isDone(q.id) || this.isActive(q.id)) return false;
    if (q.prereq && !q.prereq.every(p => this.isDone(p))) return false;
    try { if (q.when && !q.when(this)) return false; } catch { return false; }
    if (q.minLevel && (this.char.level || 1) < q.minLevel) return 'level';
    return true;
  }
  /** first-time setup for a character: characters that never played the prologue start the story in Solhaven */
  migrate() {
    const c = this.char, st = this.st; if (!c || !st) return;
    if (st.v === 1) return;
    st.v = 1;
    // characters that will not play the prologue (Powerpass, or story characters made before it existed) skip it
    const skip = c.powerpass || c.zone !== 'prologue';
    const prologue = QUEST_LIST.filter(q => q.chapter === 'prologue').map(q => q.id);
    if (skip && !prologue.some(id => st.done.includes(id) || st.active.some(e => e.id === id))) {
      for (const id of prologue) if (!st.done.includes(id)) st.done.push(id);
      c.flags ||= {}; c.flags.welcomed = true;
    }
    this.save();
  }
  /** quests only start (and chapter cards only show) in the open world, never over content, cutscenes or boss intros */
  openWorld() {
    const g = this.g; if (!g.level || !g.hero || this.s.screen !== 'game') return false;
    if (g.inputBlocked || g.cam?.cine || cutsceneActive() || screenDark() || this.s.storyTransition || this.s._traveling || this.s.ui?.npc?.active) return false;
    const k = g.mode?.kind, zk = ZONES[g.zone?.id]?.kind || g.zone?.kind;
    return OPEN_KINDS.has(k) || ['city', 'field', 'island'].includes(zk);
  }
  autoAccept() {
    if (!this.openWorld()) return false;
    for (const q of QUEST_LIST) if (q.auto && this.available(q) === true) this.accept(q.id, { auto: true });
    return true;
  }
  /** Powerpass characters play the story at their own pace: its quests arrive quietly and never take the tracker */
  optional(q) { return !!this.char?.powerpass && q.kind === 'msq'; }
  /** does an active quest's current step lead to zone `id` (from somewhere else)? */
  wantsZone(id) { if (!id || id === this.zoneId || !this.st) return false; return this.st.active.some(e => { const q = this.def(e.id), s = q && this.step(e); return s && this.stepZone(q, s) === id; }); }
  // ---------------------------------------------------------------- lifecycle
  accept(id, o = {}) {
    const q = this.def(id), st = this.st; if (!q || !st || this.isActive(id) || this.isDone(id)) return false;
    const e = { id, step: 0, n: 0, t: Date.now() };
    st.active.push(e);
    const quiet = o.silent || this.optional(q);
    if (this.optional(q)) { if (!st.tracked || !this.isActive(st.tracked)) st.tracked = id; }
    else if (!st.tracked || q.kind === 'msq' || !this.isActive(st.tracked) || (q.kind === 'guide' && this.char.powerpass)) st.tracked = id;
    this.s.bus.emit('quest', { id, state: 'accepted' });
    if (!quiet) {
      if (q.chapterStart) this.g.ui?.banner?.(q.chapterStart, { kind: 'zone', sub: q.chapterOver || KIND_LABEL[q.kind], dur: 3.6 });
      else if (q.kind === 'msq' || !o.auto) this.g.ui?.toast?.(`${KIND_LABEL[q.kind] || 'Quest'} accepted: ${q.title}`, 'success');
      else this.g.ui?.toast?.(`New ${KIND_LABEL[q.kind] || 'quest'}: ${q.title}`, 'info');
      this.sfx('quest_accept');
    }
    this.enterStep(e);
    this.dirty = true; this.save();
    return true;
  }
  /** run a notification now if the player is in the open world, else when they get back there */
  note(fn) { if (this.openWorld()) { try { fn(); } catch (e) { console.error('[quests note]', e); } } else this.pending.push(fn); }
  flushNotes() { const list = this.pending.splice(0); for (const fn of list) { try { fn(); } catch (e) { console.error('[quests note]', e); } } }
  abandon(id) {
    const q = this.def(id); if (!q || q.kind === 'msq') return false;
    this.st.active = this.st.active.filter(e => e.id !== id);
    if (this.st.tracked === id) this.st.tracked = null;
    this.dirty = true; this.save(); return true;
  }
  enterStep(e) {
    const s = this.step(e), q = this.def(e.id); if (!s) return;
    e.n = e.n || 0;
    if (s.type === 'cutscene') this.pendingCut = e;
    if (s.type === 'level' && (this.char.level || 1) >= s.need) queueMicrotask(() => this.progressEntry(e, s.need));
    if (s.type === 'zone' && this.zoneId === s.zone) queueMicrotask(() => this.progressEntry(e, 1));
    if (s.type === 'reach' && s.mountedHint) this.g.ui?.toast?.(s.mountedHint, 'info');
    if (s.init) { let v = 0; try { v = +s.init(this) || 0; } catch { v = 0; } if (v > 0) queueMicrotask(() => this.progressEntry(e, Math.min(this.need(s), v))); }
    try { s.onEnter?.(this, e); } catch (err) { console.error('[quest onEnter]', e.id, err); }
    void q;
  }
  /** add progress to an entry's current step; advances when full */
  progressEntry(e, n = 1) {
    if (!e || !this.isActive(e.id)) return;
    const s = this.step(e); if (!s) return;
    e.n = Math.min(this.need(s), (e.n || 0) + n);
    this.dirty = true;
    if (e.n >= this.need(s)) this.advance(e);
    else this.save();
  }
  advance(e) {
    const q = this.def(e.id), s = this.step(e);
    try { s?.onDone?.(this, e); } catch (err) { console.error('[quest onDone]', e.id, err); }
    e.step++; e.n = 0; delete e.used; delete e.data;
    this.dirty = true;
    if (e.step >= q.steps.length) return this.complete(e.id);
    this.sfx('quest_accept', 0.5);
    this.enterStep(e); this.save();
  }
  /** finish a quest: rewards (choice index for reward choices), banner, follow-ups */
  complete(id, choice = 0) {
    const q = this.def(id), st = this.st; if (!q || !st) return;
    st.active = st.active.filter(x => x.id !== id);
    if (!st.done.includes(id)) st.done.push(id);
    if (st.tracked === id) st.tracked = null;
    const rows = this.grant(q, choice);
    this.note(() => {
      this.g.ui?.banner?.(q.title, { kind: 'quest', sub: q.kind === 'msq' ? 'Main Story Complete' : q.kind === 'guide' ? 'Guide Complete' : 'Quest Complete' });
      this.g.audio?.stinger?.('quest_complete');
      for (const r of rows) this.g.ui?.hud?.loot?.(r);
    });
    try { q.onComplete?.(this); } catch (err) { console.error('[quest onComplete]', id, err); }
    this.s.bus.emit('quest', { id, state: 'done' });
    this.dirty = true; this.save();
    this.nextAccept = 0.8;          // follow-ups appear a moment later
  }
  // ---------------------------------------------------------------- rewards
  rewardOf(q, choice = 0) {
    const R = { ...(q.rewards || {}) };
    if (R.choice && R.choice[choice]) { const c = R.choice[choice]; for (const [k, v] of Object.entries(c)) if (k !== 'label') R[k] = k === 'items' ? { ...(R.items || {}), ...v } : v; }
    delete R.choice;
    return R;
  }
  xpFor(q) {
    const R = q.rewards || {};
    if (R.xpFlat != null) return R.xpFlat;
    const k = R.xp ?? (q.kind === 'msq' ? 1.1 : q.kind === 'side' ? 0.55 : q.kind === 'guide' ? 0 : 0.4);
    if (!k) return 0;
    const lvl = q.level || this.char.level || 1, mine = this.char.level || 1;
    const catchUp = 1 + 0.25 * Math.max(0, lvl - mine);
    return Math.round(k * xpForLevel(Math.max(1, lvl)) * catchUp);
  }
  /** rows describing what a quest gives (for dialogue text and the journal) */
  rewardRows(q, choice = 0) {
    const R = this.rewardOf(q, choice), rows = [];
    const xp = this.xpFor(q); if (xp && (this.char.level || 1) < MAX_LEVEL) rows.push({ id: 'xp', name: 'Experience', count: xp, grade: 1, icon: 'ui:xp' });
    for (const k of ['silver', 'gold', 'crystals']) if (R[k]) rows.push({ id: k, name: k[0].toUpperCase() + k.slice(1), count: R[k], grade: k === 'silver' ? 1 : 4, icon: `currency:${k}` });
    for (const [id, n] of Object.entries(R.items || {})) rows.push({ id, name: ITEMS[id]?.name || id, count: n, grade: ITEMS[id]?.grade ?? 1, icon: ITEMS[id]?.icon || `item:${id}`, kind: ITEMS[id]?.kind });
    for (const g of [].concat(R.gear || [])) rows.push({ id: 'gear', name: `${['Worn', 'Sturdy', 'Fine', 'Heroic', 'Ancestral'][Math.min(4, g.grade ?? 1)]} ${g.slot === 'weapon' ? 'Weapon' : SLOT_WORD[g.slot] || 'Armor'}`, count: 1, grade: g.grade ?? 1, icon: g.slot === 'weapon' ? `item:weapon:${this.char.cls}:t0` : `item:${g.slot}:t0` });
    if (R.vanguard) rows.push({ id: 'vanguard', name: 'Vanguard Armament (full set)', count: 1, grade: 4, icon: `item:weapon:${this.char.cls}:t1` });
    if (R.skillPts) rows.push({ id: 'skillpts', name: 'Skill Points', count: R.skillPts, grade: 4, icon: 'item:skill_potion' });
    for (const k of ['songs', 'emotes', 'pets', 'mounts', 'titles']) for (const v of [].concat(R[k] || [])) rows.push({ id: `${k}:${v}`, name: `${UNLOCK_WORD[k]}: ${unlockName(k, v)}`, count: 1, grade: 4, icon: `ui:${k}` });
    for (const u of [].concat(R.unlock || [])) rows.push({ id: `unlock:${u}`, name: `Unlocked: ${UNLOCK_NAMES[u] || u}`, count: 1, grade: 5, icon: 'ui:quest' });
    return rows;
  }
  grant(q, choice = 0) {
    const R = this.rewardOf(q, choice), A = this.A, c = this.char, rows = this.rewardRows(q, choice);
    const xp = this.xpFor(q);
    for (const k of ['silver', 'gold', 'crystals']) if (R[k]) A.give(k, R[k]);
    for (const [id, n] of Object.entries(R.items || {})) A.give(id, n);
    let gearChanged = false;
    for (const g of [].concat(R.gear || [])) {
      const it = storyGear(Math.max(c.level || 1, q.level || 1), g.slot, c.cls, g.grade ?? 1);
      A.addItem(c, it);
      const cur = c.equip?.[g.slot];
      if (!cur || (cur.set === 'story' && (cur.iLvl || 0) < it.iLvl)) { A.equip(c, it); gearChanged = true; this.g.ui?.toast?.(`Equipped ${it.name} (item level ${it.iLvl}).`, 'loot'); }
    }
    if (R.vanguard) {
      for (const sl of GEAR_SLOTS) { const it = makeGear('vanguard', sl, c.cls, { hone: R.vanguard.hone ?? 0, quality: 60 }); A.addItem(c, it); A.equip(c, it); }
      gearChanged = true; this.g.ui?.toast?.('Vanguard armament equipped — you can now hone your gear at the blacksmith.', 'loot');
    }
    if (R.skillPts) { c.bonusPts = (c.bonusPts || 0) + R.skillPts; c.skillPts = (c.skillPts || 0) + R.skillPts; }
    const r = A.roster;
    for (const k of ['songs', 'emotes', 'pets', 'mounts', 'titles']) for (const v of [].concat(R[k] || [])) { r[k] ||= []; if (!r[k].includes(v)) r[k].push(v); }
    for (const u of [].concat(R.unlock || [])) { (r.unlocked ||= {})[u] = true; }
    if (R.char) Object.assign(c, R.char);
    A.save();
    if (xp) this.grantXp(xp);
    if (gearChanged) { c.ilvl = itemLevel(c); this.s.refreshChar?.(); }
    return rows.filter(x => x.id !== 'xp').concat(xp ? [{ id: 'xp', name: `${xp.toLocaleString('en-US')} XP`, count: 1, grade: 1, icon: 'ui:xp' }] : []);
  }
  /** grant XP and celebrate level-ups (used by quests and field kills) */
  grantXp(n) {
    const c = this.char; if (!c || !n) return [];
    const ups = this.A.addXp(c, Math.round(n));
    if (ups?.length) this.celebrate(ups[ups.length - 1], ups.length);
    return ups;
  }
  celebrate(lv, n = 1) {
    this.s.refreshChar?.();
    const me = this.me; if (me) { me.hp = me.hpMax; me.mp = me.mpMax; }
    this.lastLevel = lv;
    setTimeout(() => this.note(() => {
      this.g.ui?.banner?.('Level Up', { kind: 'levelup', level: lv, sub: `You reached level ${lv}` });
      this.g.audio?.stinger?.('level_up');
      const u = this.me; if (u) { try { this.g.fx?.play?.('level_up', { pos: u.pos, x: u.pos.x, z: u.pos.z, unit: u.model?.root }); } catch { /* */ } }
      this.g.ui?.toast?.(`+${6 * n} skill points — spend them in Skills (K).`, 'success');
    }), 400);
    this.s.bus.emit('levelup', { level: lv });
  }
  // ---------------------------------------------------------------- events
  onKill({ unit, killer, mine }) {
    const st = this.st, me = this.me; if (!st || !unit) return;
    const near = mine || (me && dist(unit.pos, me.pos) < 30);
    if (!near) return;
    for (const e of st.active.slice()) {
      const q = this.def(e.id), s = this.step(e);
      if (!s || !this.inZone(q, s)) continue;
      if (s.type === 'kill' && this.matchMob(s, unit, e)) this.progressEntry(e, 1);
      else if (s.type === 'collect' && this.matchMob(s.from || {}, unit, e)) {
        if (Math.random() < (s.chance ?? 0.6)) {
          this.progressEntry(e, 1);
          this.g.ui?.toast?.(`${s.item} ${Math.min(e.n, this.need(s))}/${this.need(s)}`, 'loot');
          try { this.g.fx?.pickup?.({ pos: unit.pos, kind: 'item', to: me?.model?.root }); } catch { /* */ }
          this.g.audio?.sfx?.('loot_drop', { pos: unit.pos });
        }
      }
    }
  }
  matchMob(m, u, e) {
    if (m.spawn && u.data.questSpawn !== `${e.id}:${e.step}`) return false;
    if (m.spawn) return true;
    const types = m.mob ? [].concat(m.mob) : null;
    if (types && !types.includes(u.type)) return false;
    if (m.tag && ![].concat(m.tag).includes(u.data.tag)) return false;
    if (m.family && ![].concat(m.family).includes(u.data.family || familyOf(u.type))) return false;
    if (m.name && u.name !== m.name) return false;
    if (m.elite && !u.data.elite) return false;
    if (m.boss && u.kind !== 'boss') return false;
    return !!(types || m.tag || m.family || m.name || m.elite || m.boss || m.any);
  }
  onZone({ id }) {
    const c = this.char; if (!c || !id) return;
    if (['solhaven', 'goldmeadow', 'thornwood', 'ashen_ridge', 'pipsprout'].includes(id) && c.zone !== 'prologue') { c.zone = id; this.save(); }
    for (const e of this.st?.active.slice() || []) { const s = this.step(e); if (s?.type === 'zone' && s.zone === id) this.progressEntry(e, 1); }
    this.onEvent('zone', { id });
    this.dirty = true;
  }
  onEvent(type, d = {}) {
    for (const e of this.st?.active.slice() || []) {
      const s = this.step(e); if (!s) continue;
      if (type === 'clear' && s.type === 'clear') {
        const k = d.content?.kind; if (!d.result?.cleared && !s.any) continue;
        if ([].concat(s.content).includes(k) && (!s.boss || d.content?.boss === s.boss || d.result?.boss === s.boss)) this.progressEntry(e, 1);
      } else if (s.type === 'event' && s.ev === type) {
        let ok = true; try { ok = s.match ? !!s.match(d, this) : true; } catch { ok = false; }
        if (ok) this.progressEntry(e, s.count ? s.count(d) : 1);
      } else if (type === 'levelup' && s.type === 'level' && (this.char.level || 1) >= s.need) this.progressEntry(e, s.need);
      else if (type === 'gather' && s.type === 'gather' && (!s.skill || [].concat(s.skill).includes(d.skill))) this.progressEntry(e, 1);
    }
  }
  /** named signals from modes (prologue beats, cannon hits…) */
  signal(id, n = 1) {
    for (const e of this.st?.active.slice() || []) { const s = this.step(e); if (s?.type === 'signal' && s.id === id) this.progressEntry(e, n); }
  }
  bindLevel() {
    const L = this.g.level; if (L === this.boundLevel) return;
    for (const f of this.offLevel) f(); this.offLevel = []; this.boundLevel = L; if (!L) return;
    const use = (what, u, id) => {
      if (u !== this.me) return;
      for (const e of this.st?.active.slice() || []) {
        const s = this.step(e); if (s?.type !== 'use' || ![].concat(s.what).includes(what)) continue;
        if (s.distinct) { const d = e.data ||= { seen: [] }; if (d.seen.includes(id)) continue; d.seen.push(id); }
        this.progressEntry(e, 1);
      }
    };
    this.offLevel.push(
      L.on('skillStart', ({ unit, run, def }) => { if (run?.kind === 'skill') use('skill', unit, def?.id); else if (run?.kind === 'basic') use('basic', unit, 'basic'); }),
      L.on('identity', ({ unit, def }) => use('identity', unit, def?.id)),
      L.on('awaken', ({ unit, def }) => use('awakening', unit, def?.id)),
      L.on('dash', ({ unit }) => use('dash', unit, 'dash')),
      L.on('itemUsed', ({ unit, item }) => use('item', unit, item)),
    );
  }
  // ---------------------------------------------------------------- per frame
  update(dt) {
    const c = this.char; if (!c || !this.g.level) return;
    if (this.lastChar !== c) { this.lastChar = c; this.lastLevel = c.level; this.declined.clear(); this.migrate(); this.dirty = true; }
    this.t += dt;
    this.bindLevel();
    if (this.nextAccept != null) { this.nextAccept -= dt; if (this.nextAccept <= 0 && this.autoAccept()) this.nextAccept = null; }
    this.acceptT = (this.acceptT || 0) - dt;
    if (this.acceptT <= 0) { this.acceptT = 1; this.autoAccept(); }
    if (this.pending.length && this.openWorld()) this.flushNotes();
    // reach steps & reach-while-mounted
    this.reachT = (this.reachT || 0) - dt;
    if (this.reachT <= 0 && this.me) {
      this.reachT = 0.2;
      for (const e of this.st.active.slice()) {
        const q = this.def(e.id), s = this.step(e);
        if (s?.type !== 'reach' || !this.inZone(q, s) || s.spawn) continue;
        const a = anchorOf(this.g.zone, s.at, s.off); if (!a) { if (!s.at) continue; warnOnce('reach:' + e.id, `no anchor ${s.at} for ${e.id}`); continue; }
        if (dist(this.me.pos, a) < (s.r || 4) && (!s.mounted || this.me.data.mounted)) this.progressEntry(e, 1);
      }
    }
    // cutscene steps start when nothing else is on screen
    if (this.pendingCut && !cutsceneActive() && !this.busy && !this.s.ui?.npc?.active && this.s.screen === 'game') {
      const e = this.pendingCut, q = this.def(e.id), s = this.step(e);
      if (!s || s.type !== 'cutscene' || !this.isActive(e.id)) this.pendingCut = null;
      else if (this.inZone(q, s)) { this.pendingCut = null; this.playCutscene(s.id).then(() => { if (this.step(e) === s) this.progressEntry(e, 1); }); }
    }
    // channel (interact objects)
    if (this.channel) this.tickChannel(dt);
    this.world.update(dt, this.dirty);
    if (this.dirty) { this.dirty = false; this.syncMarkers(); }
    this.markers.update(dt);
    if (c.level > (this.lastLevel || 0)) this.lastLevel = c.level;
  }
  // ---------------------------------------------------------------- cutscenes
  async playCutscene(id, ctx = {}) {
    const fn = CUTSCENES[id];
    if (!fn) { warnOnce('cut:' + id, 'missing cutscene', id); return; }
    const def = typeof fn === 'function' ? { run: fn } : fn;
    await Cutscene.play(this.s, cs => def.run(cs, this, ctx), { music: def.music, after: def.after ?? this.g.zone?.env?.music, keepBlack: def.keepBlack });
  }
  // ---------------------------------------------------------------- interaction
  interactable() {
    const me = this.me; if (!me || this.channel || cutsceneActive()) return null;
    // whoever the story wants you to talk to wins over whoever happens to be a step closer
    const bonus = u => { if (u?.fobj?.kind === 'gate') return this.wantsZone(u.fobj.to) ? 2.4 : 0; const id = u?.data?.npcDef?.id; if (!id || u.data.npcDef.object) return 0; const b = this.business(id); return b.talk.length ? 1.6 : b.offer.length ? 0.7 : 0; };
    let best = null, bs = Infinity;
    const o = this.world.nearestObj(me);
    if (o) {
      bs = dist(o, me.pos);
      best = o.launch ? { name: o.s.launchName || o.q.title, label: o.s.launchLabel || 'Enter', portal: 'quest:launch', pos: { x: o.x, z: o.z }, data: { npcDef: { object: true } }, qobj: o }
        : { name: o.s.name || o.q.title, label: o.s.label || 'Use', pos: { x: o.x, z: o.z }, data: { npcDef: { object: true } }, qobj: o };
    }
    // story NPCs we spawned (the zone's own mode doesn't know about them)
    for (const u of this.world.spawned.values()) { if (!u.level || u.dead || !u.data.npcDef) continue; const d = me.distTo(u); if (d > 3.2) continue; const sc = d - bonus(u); if (sc < bs) { bs = sc; best = u; } }
    const other = this.g.mode?.interactable?.();
    if (!best) return null;
    if (other && other !== best && other.pos) { const so = dist(other.pos, me.pos) - bonus(other); if (so < bs - 0.2) return null; }
    return best;
  }
  interact(t) {
    if (cutsceneActive()) return true;
    if (this.busy) return true;
    if (t.qobj) { this.useObject(t.qobj); return true; }
    const n = t.data?.npcDef; if (!n?.id || n.object) return false;
    if (this.passThrough === t) { this.passThrough = null; return false; }
    const biz = this.business(n.id);
    if (biz.talk.length) { this.runNpc(t, n, biz); return true; }
    if (biz.offer.length && !this.declined.has(n.id)) { this.runNpc(t, n, biz); return true; }
    return false;
  }
  /** what quest business an NPC has with us right now */
  business(npcId) {
    const out = { talk: [], offer: [] }, st = this.st; if (!st) return out;
    for (const e of st.active) { const q = this.def(e.id), s = this.step(e); if ((s?.type === 'talk' || s?.type === 'choice') && s.npc === npcId && this.inZone(q, s)) out.talk.push(e); }
    for (const q of QUEST_LIST) if (!q.auto && q.giver === npcId && this.available(q) === true) out.offer.push(q);
    out.talk.sort((a, b) => (KIND_ORDER[this.def(a.id).kind] ?? 9) - (KIND_ORDER[this.def(b.id).kind] ?? 9));
    return out;
  }
  npcChoices(npcId) {
    const biz = this.business(npcId), out = [];
    for (const e of biz.talk) out.push({ id: 'q:talk:' + e.id, text: `[${KIND_LABEL[this.def(e.id).kind] || 'Quest'}] ${this.def(e.id).title}`, kind: 'quest' });
    for (const q of biz.offer) out.push({ id: 'q:offer:' + q.id, text: `[${KIND_LABEL[q.kind] || 'Quest'}] ${q.title}`, kind: 'quest' });
    return out;
  }
  onNpcChoice(npcId, choice, unit) {
    if (!choice || !String(choice).startsWith('q:')) return false;
    const [, kind, id] = String(choice).split(':');
    const n = unit?.data?.npcDef || { id: npcId, name: this.npcName(npcId) };
    if (kind === 'talk') { const e = this.entry(id); if (e) this.runNpc(unit, n, { talk: [e], offer: [] }); }
    if (kind === 'offer') { const q = this.def(id); if (q) this.runNpc(unit, n, { talk: [], offer: [q] }); }
    return true;
  }
  /** full conversation with an NPC: pending talk steps first, then new offers */
  async runNpc(unit, n, biz) {
    if (this.busy) return;
    this.busy = true;
    try {
      const me = this.me;
      if (unit?.pos && me) { me.faceTo(unit.pos.x, unit.pos.z); if (unit.kind === 'npc') unit.faceTo(me.pos.x, me.pos.z); }
      this.g.player?.stop?.();
      this.s.bus.emit('talk', { npc: n.id, unit });
      unit?.model?.play?.(unit.type === 'pip' ? 'talk' : 'wave', { dur: 1.4 });
      for (const e of biz.talk) { if (!this.isActive(e.id)) continue; const ok = await this.runTalk(e, n); if (!ok) break; }
      // follow-up offers from the same person
      const offers = biz.offer.length ? biz.offer : this.business(n.id).offer;
      for (const q of offers.slice(0, 1)) await this.runOffer(q, n, unit);
    } catch (err) { console.error('[quests] dialogue', err); }
    finally { this.busy = false; this.dirty = true; }
  }
  /** a talk / choice step: its lines, optional choices, and — if it is the last step — the turn-in with rewards */
  async runTalk(e, n) {
    const q = this.def(e.id), s = this.step(e);
    const last = e.step === q.steps.length - 1;
    const lines = this.lines(s.lines || [s.text || '…'], s.npc);
    const choices = s.choices ? s.choices.filter(c => !c.if || c.if(this)).map(c => ({ id: 'c:' + c.id, text: fill(c.text, this.s), kind: c.kind || 'talk' })) : null;
    if (choices?.length) {
      const pick = await this.say(n, lines, choices);
      if (!pick) return false;                       // closed without choosing: nothing happens
      const c = s.choices.find(x => 'c:' + x.id === pick);
      if (c?.flag) this.setFlag(c.flag, c.value ?? c.id); else if (s.flag) this.setFlag(s.flag, c?.id);
      if (c?.stay) { if (c.reply) await this.say(n, this.lines(c.reply, s.npc)); return true; }
      if (!last) { if (c?.reply) await this.say(n, this.lines(c.reply, s.npc)); this.progressEntry(e, this.need(s)); return true; }
      return this.turnIn(e, n, c?.reply ? this.lines(c.reply, s.npc) : []);
    }
    if (!last) { await this.say(n, lines); this.progressEntry(e, this.need(s)); return true; }
    return this.turnIn(e, n, lines);
  }
  /** turn-in: the NPC's last words + the rewards (with a reward choice when the quest offers one) */
  async turnIn(e, n, head) {
    const q = this.def(e.id), s = this.step(e), R = q.rewards || {};
    const rows = this.rewardRows(q).map(r => r.id === 'xp' ? `${r.count.toLocaleString('en-US')} XP` : r.count > 1 ? `${r.name} ×${r.count.toLocaleString('en-US')}` : r.name);
    const rewardText = R.choice ? `Choose your reward. ${rows.length ? 'Also: ' + rows.join(' · ') + '.' : ''}` : `Rewards: ${rows.join(' · ') || 'the thanks of Solmara'}.`;
    const rc = R.choice ? R.choice.map((c, i) => ({ id: 'r:' + i, text: fill(c.label, this.s), kind: 'quest' })) : [{ id: 'r:0', text: `Complete “${q.title}”`, kind: 'quest' }];
    const got = await this.say(n, [...head, { s: s.npc, t: rewardText }], rc);
    if (!got) return false;                          // closed: the step stays open (any choice flag is kept)
    this.complete(e.id, +String(got).split(':')[1] || 0);
    return true;
  }
  async runOffer(q, n, unit) {
    const lines = this.lines(q.offer || [q.desc || q.title], q.giver);
    const pick = await this.say(n, lines, [{ id: 'accept', text: `Accept: ${q.title}`, kind: 'quest' }, { id: 'later', text: 'Not right now.', kind: 'leave' }]);
    if (pick === 'accept') { this.accept(q.id); if (q.onAccept) try { q.onAccept(this); } catch { /* */ } }
    else { this.declined.add(n.id); if (unit && n.action && n.action !== 'story') { this.passThrough = unit; } }
  }
  /** normalise dialogue lines: strings / { s, t, if } / functions → [{ speaker, text }] */
  lines(list, defaultSpeaker) {
    const out = [];
    for (let l of [].concat(list || [])) {
      if (typeof l === 'function') l = l(this);
      if (!l) continue;
      if (typeof l === 'string') { out.push({ s: defaultSpeaker, t: l }); continue; }
      if (l.if && !l.if(this)) continue;
      out.push({ s: l.s ?? defaultSpeaker, t: typeof l.t === 'function' ? l.t(this) : l.t });
    }
    return out;
  }
  /** show lines grouped by speaker (portrait changes per speaker); choices on the last line. → choice id | null */
  async say(n, lines, choices = null) {
    const groups = [];
    for (const l of lines) { const g = groups[groups.length - 1]; if (g && g.s === l.s) g.lines.push(l.t); else groups.push({ s: l.s, lines: [l.t] }); }
    if (!groups.length) groups.push({ s: n.id, lines: ['…'] });
    let res = null;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i], lastG = i === groups.length - 1;
      const who = this.speaker(g.s, n);
      const script = g.lines.map(t => ({ text: fill(t, this.s) }));
      if (lastG && choices) script[script.length - 1].choices = choices;
      res = await this.s.ui.dialog(who, script);
      if (lastG) return res;
    }
    return res;
  }
  speaker(id, fallback) {
    if (id === 'hero') { const c = this.char; return { name: c?.name || 'You', title: CLASS_NAME[c?.cls] || '', cls: c?.cls }; }
    if (id === 'narrator') return { name: '', title: '' };
    const sd = STORY_NPCS[id]; if (sd) return { id: sd.portrait || id, name: sd.name, title: sd.title };
    const fd = FIELD_NPC_BY_ID[id]; if (fd) return { id: fd.portrait || id, name: fd.name, title: fd.title };
    const cd = cityNpc(id); if (cd) return { id: cd.id, name: cd.name, title: cd.title };
    if (fallback && (!id || id === fallback.id)) return { id: fallback.portrait || fallback.id, name: fallback.name, title: fallback.title };
    return { name: id || fallback?.name || '', title: '' };
  }
  // ---------------------------------------------------------------- quest objects
  useObject(o) {
    const me = this.me; if (!me || this.channel) return;
    if (o.launch) { this.g.player?.stop?.(); this.s.launch(o.launch); return; }
    me.faceTo(o.x, o.z); this.g.player?.stop?.();
    const dur = o.s.dur ?? 1.4;
    if (dur <= 0) return this.finishObject(o);
    me.model?.play?.(o.s.anim || 'interact', { dur: Math.max(0.8, dur), loop: dur > 1.4 });
    this.channel = { o, t: 0, dur, x: me.pos.x, z: me.pos.z, hp: me.hp };
    this.g.audio?.sfx?.(o.s.sfx || 'ui_click', { pos: me.pos });
  }
  tickChannel(dt) {
    const c = this.channel, me = this.me;
    if (!me || me.dead || me.skill || Math.hypot(me.pos.x - c.x, me.pos.z - c.z) > 0.6 || me.hp < c.hp - me.hpMax * 0.05) {
      this.channel = null; me?.model?.stop?.(); this.g.ui?.toast?.('Interrupted.', 'warn'); return;
    }
    c.t += dt;
    if (c.t >= c.dur) { this.channel = null; me.model?.stop?.(); this.finishObject(c.o); }
  }
  async finishObject(o) {
    const e = o.e; if (!this.isActive(e.id) || this.step(e) !== o.s) return;
    (e.used ||= []).push(o.idx);
    this.world.dropObj(o); this.world.objs.delete(o.key);
    try { this.g.fx?.burst?.({ pos: { x: o.x, y: (this.g.level?.heightAt(o.x, o.z) || 0) + 0.8, z: o.z }, color: o.s.color || 'gold', count: 26, speed: 4, kind: 'star' }); } catch { /* */ }
    this.g.audio?.sfx?.(o.s.doneSfx || 'chest_open', { pos: { x: o.x, y: 0, z: o.z } });
    if (o.s.lines?.[o.idx] || o.s.say) { const l = o.s.lines?.[o.idx] ?? o.s.say; this.g.ui?.toast?.(fill(typeof l === 'function' ? l(this) : l, this.s), 'info'); }
    try { o.s.onUse?.(this, o, e); } catch (err) { console.error('[quest onUse]', err); }
    if (this.need(o.s) > 1) this.g.ui?.toast?.(`${o.s.name || o.q.title} ${Math.min(e.used.length, this.need(o.s))}/${this.need(o.s)}`, 'loot');
    this.progressEntry(e, 1);
  }
  /** a few level-scaled foes that burst out around a point (step onUse hooks): Q.spawnNear('skeleton', 2, obj, { spread }) */
  spawnNear(type, n = 1, at = null, o = {}) {
    const L = this.g.level, p = at || this.me?.pos; if (!L || !p) return [];
    const [lo, hi] = at?.q?.levels || [1, MAX_LEVEL];
    const level = Math.max(lo, Math.min(hi, this.char?.level || 5)) + (o.levelBonus || 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n + Math.random() * 0.2) * Math.PI * 2, r = (o.spread ?? 4) * (0.55 + Math.random() * 0.45);
      const w = walkable(L, p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r, 5);
      try {
        const u = makeFieldMob(type, { level, x: w.x, z: w.z, alert: true, aggro: o.aggro ?? 18, elite: o.elite ?? false, name: o.name, delay: 0.4 + i * 0.15 });
        u.data.questNear = true; L.add(u); out.push(u);
        this.g.presenter?.call?.('play', 'spawn_puff', { pos: u.pos, x: u.pos.x, z: u.pos.z });
      } catch (err) { warnOnce('near:' + type, 'spawnNear', type, err.message); }
    }
    return out;
  }
  // ---------------------------------------------------------------- targets, routing, markers
  /** where to go for an entry's current step in this zone: [{ x, z, label, r }] (+ .route for other zones) */
  targets(e) {
    const q = this.def(e.id), s = this.step(e), z = this.g.zone; if (!s || !z) return [];
    const want = this.stepZone(q, s);
    if (want && want !== this.zoneId) { const g = this.gateToward(want); return g ? [{ ...g, label: `To ${ZONE_NAME(g.to)}`, route: true }] : []; }
    const L = this.g.level, out = [];
    const npcPos = id => { const u = L.units.find(x => x.data.npcDef?.id === id && !x.dead); return u ? { x: u.pos.x, z: u.pos.z } : null; };
    const label = this.stepText(e);
    switch (s.type) {
      case 'talk': case 'choice': { const p = npcPos(s.npc); if (p) out.push({ ...p, label, npc: s.npc }); break; }
      case 'interact': for (const o of this.world.objs.values()) if (o.e === e) out.push({ x: o.x, z: o.z, label }); break;
      case 'kill': case 'collect': {
        const sp = s.spawn ? L.units.find(u => u.data.questSpawn === `${e.id}:${e.step}` && !u.dead) : null;
        if (sp) { out.push({ x: sp.pos.x, z: sp.pos.z, label }); break; }
        const at = anchorOf(z, s.at || s.spawn?.at); if (at) { out.push({ x: at.x, z: at.z, label, r: s.r || 8 }); break; }
        const m = s.type === 'collect' ? (s.from || {}) : s;
        const packs = Object.entries(z.anchors || {}).filter(([k, a]) => k.startsWith('pack:') && (!m.tag || [].concat(m.tag).includes(a.tag)) && (!m.mob || this.packHas(a.tag, m.mob)) && (!m.family || this.packFamily(a.tag, m.family)));
        const me = this.me;
        packs.sort((a, b) => (me ? dist(a[1], me.pos) - dist(b[1], me.pos) : 0));
        for (const [, a] of packs.slice(0, 2)) out.push({ x: a.x, z: a.z, label, r: a.r || 8 });
        break;
      }
      case 'gather': { const me = this.me; const nodes = Object.entries(z.anchors || {}).filter(([k]) => k.startsWith('node:') && (!s.skill || [].concat(s.skill).includes(k.split(':')[1]))); nodes.sort((a, b) => me ? dist(a[1], me.pos) - dist(b[1], me.pos) : 0); for (const [, a] of nodes.slice(0, 2)) out.push({ x: a.x, z: a.z, label }); break; }
      default: { const a = anchorOf(z, s.at, s.off); if (a) out.push({ x: a.x, z: a.z, label, r: s.r }); else if (s.npc) { const p = npcPos(s.npc); if (p) out.push({ ...p, label }); } }
    }
    return out;
  }
  packHas(tag, mobs) { const list = PACK_TAGS[tag]; return !list || list.some(([t]) => [].concat(mobs).includes(t)); }
  packFamily(tag, fam) { const list = PACK_TAGS[tag]; return !list || list.some(([t]) => [].concat(fam).includes(familyOf(t))); }
  /** the gate in this zone that leads toward zone `to` → { x, z, to } */
  gateToward(to) {
    const from = this.zoneId, z = this.g.zone; if (!z || !from || from === to) return null;
    const prev = { [from]: null }, queue = [from];
    while (queue.length) { const a = queue.shift(); if (a === to) break; for (const b of ROUTES[a] || []) if (!(b in prev)) { prev[b] = a; queue.push(b); } }
    if (!(to in prev)) return null;
    let hop = to; while (prev[hop] && prev[hop] !== from) hop = prev[hop];
    const a = anchorOf(z, [`gate:${hop}`, ...(GATE_FALLBACK[`${from}>${hop}`] || [])]);
    return a ? { x: a.x, z: a.z, to: hop } : null;
  }
  /** overhead ! / ? markers on NPCs and beacons on objectives */
  syncMarkers() {
    const L = this.g.level; if (!L || !this.char) return;
    this.markers.sync();
    const keep = new Set();
    for (const u of L.units) {
      const id = u.data.npcDef?.id; if (!id || u.kind === 'object') continue;
      const biz = this.business(id);
      // "?" = someone you need to talk to (or report back to); "!" = a new quest (gold main story, blue side, green guide)
      const mark = biz.talk.length ? 'done' : biz.offer.length ? (biz.offer[0].kind === 'msq' ? 'msq' : biz.offer[0].kind === 'guide' ? 'guide' : 'side') : null;
      this.markers.setNpc(u, mark);
    }
    for (const o of this.world.objs.values()) { if (!o.unit) { this.markers.setBeacon('obj:' + o.key, { x: o.x, z: o.z, r: 0.8, color: o.q.kind === 'msq' ? 'gold' : 'blue' }); keep.add('obj:' + o.key); } }
    // reach targets get a ring
    for (const e of this.st.active) {
      const q = this.def(e.id), s = this.step(e);
      if (s?.type === 'reach' && this.inZone(q, s) && !s.hideBeacon) { const a = anchorOf(this.g.zone, s.at, s.off); if (a) { this.markers.setBeacon('reach:' + e.id, { x: a.x, z: a.z, r: Math.min(4, s.r || 4), color: q.kind === 'msq' ? 'gold' : 'blue', core: false }); keep.add('reach:' + e.id); } }
    }
    for (const k of this.markers.beacons.keys()) if (k.startsWith('run:')) keep.add(k);
    this.markers.pruneBeacons(keep);
  }
  wrapMinimap() {
    const s = this.s; if (!s.minimap || s.minimap.__quests) return;
    const base = s.minimap.bind(s);
    const wrapped = () => { const mm = base(); try { if (mm) this.minimapMarkers(mm); } catch (e) { console.error('[quests minimap]', e); } return mm; };
    wrapped.__quests = true; s.minimap = wrapped;
  }
  minimapMarkers(mm) {
    if (mm._quests || !this.char) return; mm._quests = true;
    const L = this.g.level, out = mm.markers;
    // friendlier gate labels
    for (const m of out) if (typeof m.label === 'string' && m.label.startsWith('gate:')) m.label = `To ${ZONE_NAME(m.label.slice(5))}`;
    else if (typeof m.label === 'string' && m.label.startsWith('triport')) m.label = 'Triport';
    for (const [u, mk] of this.markers.npc) if (u.level === L) out.push({ x: u.pos.x, z: u.pos.z, kind: mk.kind === 'done' ? 'questdone' : 'quest', label: u.name });
    for (const e of this.st.active) {
      const q = this.def(e.id); if (!q || (e.id !== this.st.tracked && q.kind !== 'msq' && this.st.active.length > 3)) continue;
      for (const t of this.targets(e)) if (!t.npc) out.push({ x: t.x, z: t.z, kind: 'objective', label: `${q.title}: ${t.label}` });
    }
    this.g.mode?.minimapExtra?.(out);
  }
  // ---------------------------------------------------------------- HUD
  stepText(e) {
    const q = this.def(e.id), s = this.step(e); if (!s) return '';
    let t = s.text;
    if (!t) switch (s.type) {
      case 'talk': case 'choice': t = `Talk to ${this.npcName(s.npc)}`; break;
      case 'kill': t = `Defeat ${s.spawn?.name || s.label || 'enemies'}`; break;
      case 'collect': t = `Collect ${s.item}`; break;
      case 'reach': t = 'Travel to the marked area'; break;
      case 'interact': t = `${s.label || 'Use'}: ${s.name || 'the marked objects'}`; break;
      case 'zone': t = `Travel to ${ZONE_NAME(s.zone)}`; break;
      case 'level': t = `Reach level ${s.need}`; break;
      default: t = q.title;
    }
    t = fill(t, this.s);
    const want = this.stepZone(q, s);
    if (want && want !== this.zoneId && s.type !== 'zone') t += ` (${ZONE_NAME(want)})`;
    return t;
  }
  trackerList() {
    const st = this.st; if (!st) return [];
    const list = st.active.slice().sort((a, b) => (a.id === st.tracked ? -1 : b.id === st.tracked ? 1 : 0) || (KIND_ORDER[this.def(a.id)?.kind] ?? 9) - (KIND_ORDER[this.def(b.id)?.kind] ?? 9));
    return list.slice(0, 6).map(e => {
      const q = this.def(e.id), s = this.step(e), need = this.need(s);
      return { id: e.id, title: q.title, kind: q.kind, steps: [{ text: this.stepText(e), n: need > 1 ? (e.n || 0) : 0, need: need > 1 ? need : 0, done: false }] };
    });
  }
  hud(h) {
    if (!this.char) return;
    h.quests = [...this.trackerList(), ...(h.quests || []).filter(x => !this.def(x.id))];
    if (this.channel) h.cast = { label: this.channel.o.s.label ? `${this.channel.o.s.label}…` : 'Working…', t: Math.min(1, this.channel.t / this.channel.dur), kind: 'cast' };
    this.world.runnerHud(h);
    this.g.mode?.hudExtra?.(h);
  }
  /** tracker click: track it and auto-path toward the objective */
  onTrackerClick(id) {
    const st = this.st, e = this.entry(id); if (!st || !e) return true;
    st.tracked = id; this.dirty = true;
    const t = this.targets(e)[0];
    if (!t) { this.g.ui?.toast?.(this.stepText(e), 'info'); return true; }
    if ((this.me?.combatT || 0) > 0) { this.g.ui?.toast?.('You can’t auto-path while in combat.', 'warn'); return true; }
    this.g.player?.setDest?.(t.x, t.z, true);
    this.g.ui?.toast?.(`Auto-path: ${t.label}`, 'info');
    return true;
  }
  // ---------------------------------------------------------------- journal & story service
  journal() {
    const st = this.st; if (!st) return null;
    const view = q => ({ id: q.id, title: q.title, kind: q.kind, chapter: q.chapterName || '', level: q.level || null, desc: fill(q.desc || '', this.s), rewards: this.rewardRows(q) });
    return {
      active: st.active.map(e => ({ ...view(this.def(e.id)), step: this.stepText(e), n: e.n || 0, need: this.need(this.step(e)), tracked: st.tracked === e.id, canAbandon: this.def(e.id).kind !== 'msq' })),
      available: QUEST_LIST.filter(q => !q.auto && this.available(q) === true).map(q => ({ ...view(q), giver: this.npcName(q.giver) })),
      done: st.done.length, total: QUEST_LIST.length,
      chapters: this.chapters(),
    };
  }
  chapters() {
    const out = [];
    for (const q of QUEST_LIST) if (q.kind === 'msq') { let c = out.find(x => x.id === q.chapter); if (!c) out.push(c = { id: q.chapter, name: q.chapterName || q.chapter, done: 0, total: 0 }); c.total++; if (this.isDone(q.id)) c.done++; }
    return out;
  }
  sfx(name, vol = 1) { try { this.g.audio?.sfx?.(name, { vol }); } catch { /* */ } }
  /** how many lore books of a zone this roster has read */
  loreRead(zone) {
    const F = FIELDS[zone] || {}, r = this.A.roster, region = F.tome || zone;
    const read = new Set([...(r.tome?.[region]?.lore || []), ...(r.flags?.lore || [])]);
    return [...read].filter(id => (F.lore || []).includes(id) || id.startsWith(`lore:${zone}:`)).length;
  }
  /** record an Adventure Tome entry (systems collectibles when present, else directly on the roster) */
  tome(region, kind, id) {
    try { const r = COLL.tomeRecord?.(this.A, region, kind, id, this.char); if (r && r.ok !== false) { if (r.isNew) this.g.ui?.toast?.('Adventure Tome updated.', 'success'); return r; } } catch (e) { /* fall through */ }
    const t = this.A.roster.tome ||= {}, rec = t[region] ||= {}, list = rec[kind] ||= [];
    if (!list.includes(id)) { list.push(id); this.save(); this.g.ui?.toast?.('Adventure Tome updated.', 'success'); }
    return { ok: true };
  }
}
const SLOT_WORD = { head: 'Helm', shoulder: 'Pauldrons', chest: 'Chestguard', pants: 'Legguards', gloves: 'Gauntlets' };
const UNLOCK_WORD = { songs: 'Song', emotes: 'Emote', pets: 'Pet', mounts: 'Mount', titles: 'Title' };
const UNLOCK_NAMES = { chaos: 'Chaos Dungeons', guardians: 'Guardian Hunts', raid: 'Legion Raid: Gorrath', sailing: 'Sailing the Glass Sea', endgame: 'The endgame', pipsprout: 'Pipsprout Hollow' };
const NICE = { homeward: 'Hymn of Homeward', tides: 'Serenade of Tides', rest: 'Lullaby of Rest', valor: 'Ballad of Valor', sunrise: 'Song of Sunrise', foxling: 'Foxling', pip_pet: 'Pip Buddy', shardbearer: 'Shardbearer', pipfriend: 'Friend of the Pips', ravager_bane: 'Bane of the Ravager', wayfarer: 'Wayfarer' };
const unlockName = (k, v) => NICE[v] || String(v).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
