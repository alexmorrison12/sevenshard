// What the quest system puts into the current level: story NPCs (spawned, moved or hidden per PLACEMENTS), objects to
// use for interact steps, and step runners for things that happen in the world (named foes to defeat, places to
// defend, people to escort, boss encounters). Rebuilt whenever the level or the quest state changes.
import * as THREE from 'three';
import { PLACEMENTS } from '../../data/quests/npcs.js';
import { anchorOf, makeResident, storyDef, makeFieldMob, makeProp, makeAlly, walkable, dist, warnOnce } from './spawn.js';
import { EncounterMode } from '../modes/encounter.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { STORY_BOSSES } from '../../data/story_bosses.js';
import { refFor } from '../ai/mob.js';

export class QuestWorld {
  constructor(Q) { this.Q = Q; this.level = null; this.objs = new Map(); this.runners = new Map(); this.moved = new Map(); this.hidden = new Map(); this.spawned = new Map(); }
  get g() { return this.Q.g; }
  get L() { return this.g.level; }
  get zone() { return this.g.zone; }
  /** called every frame: rebuild on level change, sync on dirty */
  update(dt, dirty) {
    if (this.L !== this.level) { this.reset(); this.level = this.L; dirty = true; }
    if (!this.L || !this.zone) return;
    if (dirty) { this.syncPlacements(); this.syncObjects(); this.syncRunners(); }
    for (const r of this.runners.values()) { try { r.update?.(dt); } catch (e) { console.error('[quest runner]', e); } }
    for (const o of this.objs.values()) if (o.unit && !o.unit.level && this.L) { o.unit = null; this.objs.delete(o.key); this.Q.dirty = true; }
  }
  reset() {
    for (const r of this.runners.values()) try { r.dispose?.(true); } catch { /* */ }
    this.runners.clear(); this.objs.clear(); this.moved.clear(); this.hidden.clear(); this.spawned.clear();
    this.Q.markers.sync();
  }
  // ---------------------------------------------------------------- story NPC placements
  resolve(p) {
    if (p.at) { const a = anchorOf(this.zone, p.at, p.off); if (a) { const w = walkable(this.L, a.x, a.z, 4); return { x: w.x, z: w.z, facing: p.face ?? a.facing }; } }
    if (p.pos) { const w = walkable(this.L, p.pos[0], p.pos[1], 4); return { x: w.x, z: w.z, facing: p.face ?? 0 }; }
    warnOnce('place:' + p.id + ':' + p.zone, `no anchor for story NPC ${p.id} in ${p.zone}`, p.at);
    return null;
  }
  findNpc(id) { return this.L?.units.find(u => u.data.npcDef?.id === id && !u.dead) || null; }
  syncPlacements() {
    const Q = this.Q, zid = this.zone.id, L = this.L;
    const want = new Map();
    for (const p of PLACEMENTS) { if (p.zone !== zid || want.has(p.id)) continue; let ok = false; try { ok = !!p.when(Q); } catch { ok = false; } if (ok) want.set(p.id, p); }
    // hidden residents that should come back
    for (const [id, u] of [...this.hidden]) if (!want.get(id)?.hide) { this.unhide(u); this.hidden.delete(id); }
    for (const [id, p] of want) {
      let u = this.findNpc(id);
      if (p.hide) { if (u) { this.hide(u); this.hidden.set(id, u); } continue; }
      const at = this.resolve(p); if (!at) continue;
      if (u) {
        if (!u.data.storyNpc && !p.move) continue;          // a zone resident we must not touch
        if (!u.data.storyNpc && !this.moved.has(u)) this.moved.set(u, { x: u.pos.x, z: u.pos.z, facing: u.facing });
        if (dist(u.pos, at) > 0.8) { u.pos.x = at.x; u.pos.z = at.z; u.pos.y = L.heightAt(at.x, at.z); }
        u.facing = at.facing ?? u.facing; u.data.placement = p;
      } else {
        const def = storyDef(id); if (!def) continue;
        u = makeResident(def, at, { story: true }); u.data.placement = p;
        L.add(u); this.spawned.set(id, u);
      }
    }
    // story NPCs we spawned that are no longer wanted
    for (const [id, u] of [...this.spawned]) if (!want.has(id) || want.get(id).hide) { if (u.level) u.level.remove(u); this.spawned.delete(id); }
    // residents we moved that should return to their post
    for (const [u, home] of [...this.moved]) if (!want.has(u.data.npcDef?.id) || want.get(u.data.npcDef.id).hide) { u.pos.x = home.x; u.pos.z = home.z; u.facing = home.facing; this.moved.delete(u); }
  }
  hide(u) {
    if (!u.level) return;
    const m = this.g.mode; if (m?.npcs) m.npcs = m.npcs.filter(x => x !== u);
    u.level.remove(u); u.model = null; u.data.storyHidden = true;
  }
  unhide(u) {
    if (!this.L || u.level) return;
    u.data.storyHidden = false; this.L.add(u);
    const m = this.g.mode; if (m?.npcs && !m.npcs.includes(u)) m.npcs.push(u);
  }
  // ---------------------------------------------------------------- interact objects
  syncObjects() {
    const Q = this.Q, zid = this.zone.id, want = new Map();
    for (const e of Q.st?.active || []) {
      const q = Q.def(e.id), s = q?.steps[e.step];
      if (s?.type === 'clear' && s.launch && (!s.launchZone || s.launchZone === zid)) {
        const a = anchorOf(this.zone, s.launchAt || s.at);
        if (a) { const p = walkable(this.L, a.x, a.z, 4); want.set(`${e.id}:${e.step}:launch`, { key: `${e.id}:${e.step}:launch`, e, s, q, idx: -1, x: p.x, z: p.z, launch: s.launch }); }
        continue;
      }
      if (!s || s.type !== 'interact' || !Q.inZone(q, s)) continue;
      const pts = this.points(q, s, e); if (!pts) continue;
      const used = e.used || [];
      pts.forEach((p, i) => { if (!used.includes(i)) want.set(`${e.id}:${e.step}:${i}`, { key: `${e.id}:${e.step}:${i}`, e, s, q, idx: i, x: p.x, z: p.z, facing: p.facing }); });
    }
    for (const [k, o] of [...this.objs]) if (!want.has(k)) { this.dropObj(o); this.objs.delete(k); }
    for (const [k, o] of want) {
      if (this.objs.has(k)) continue;
      if (o.s.model) { const u = makeProp(o.s.model, o, { name: o.s.name, variant: o.s.variant, scale: o.s.scale }); this.L.add(u); u.model?.play?.('spawn', { dur: 0.8 }); o.unit = u; }
      this.objs.set(k, o);
    }
  }
  dropObj(o) { if (o.unit?.level) o.unit.level.remove(o.unit); this.Q.markers.setBeacon('obj:' + o.key, null); }
  /** object positions for an interact step: explicit points, or `need` points spread around an anchor */
  points(q, s, e) {
    const need = s.need || 1;
    if (s.points) return s.points.map((pt, i) => { const a = anchorOf(this.zone, pt[0], [pt[1] || 0, pt[2] || 0]); if (!a) { warnOnce('pt:' + q.id + i, `no anchor ${pt[0]} for ${q.id}`); return null; } return walkable(this.L, a.x, a.z, 4); }).map((p, i, arr) => p || this.fallbackPoint(q, s, i, arr.length));
    const a = anchorOf(this.zone, s.at, s.off) || this.fallbackAnchor(q, s);
    if (!a) return null;
    if (need === 1 && !s.spread) return [walkable(this.L, a.x, a.z, 4)];
    const R = s.spread ?? 3.5, out = [];
    for (let i = 0; i < need; i++) { const ang = i / need * Math.PI * 2 + (e.id.length % 7) * 0.4, r = R * (0.6 + 0.4 * ((i * 7) % 3) / 2); out.push(walkable(this.L, a.x + Math.cos(ang) * r, a.z + Math.sin(ang) * r, 4)); }
    return out;
  }
  fallbackAnchor(q, s) {
    warnOnce('anchor:' + q.id + ':' + s.type, `no anchor ${JSON.stringify(s.at)} in ${this.zone.id} for ${q.id} — placing near spawn`);
    const sp = this.zone.anchors?.spawn || { x: 0, z: 0 };
    return { x: sp.x + 6, z: sp.z - 6 };
  }
  fallbackPoint(q, s, i, n) { const sp = this.zone.anchors?.spawn || { x: 0, z: 0 }; const a = i / n * Math.PI * 2; return walkable(this.L, sp.x + Math.cos(a) * 7, sp.z + Math.sin(a) * 7, 4); }
  nearestObj(me, r = 2.6) {
    let best = null, bd = r;
    for (const o of this.objs.values()) { const d = Math.hypot(o.x - me.pos.x, o.z - me.pos.z); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  // ---------------------------------------------------------------- runners
  syncRunners() {
    const Q = this.Q, want = new Map();
    for (const e of Q.st?.active || []) {
      const q = Q.def(e.id), s = q?.steps[e.step];
      if (!s || !Q.inZone(q, s)) continue;
      const key = `${e.id}:${e.step}`;
      if (s.type === 'defend' || s.type === 'escort' || s.type === 'encounter' || (s.type === 'kill' && s.spawn) || (s.type === 'reach' && s.spawn)) want.set(key, { e, q, s });
    }
    for (const [k, r] of [...this.runners]) if (!want.has(k)) { r.dispose?.(); this.runners.delete(k); }
    for (const [k, w] of want) {
      if (this.runners.has(k)) continue;
      const R = { defend: DefendRunner, escort: EscortRunner, encounter: EncounterRunner, kill: SpawnRunner, reach: SpawnRunner }[w.s.type];
      this.runners.set(k, new R(this, w.e, w.q, w.s, k));
    }
  }
  runnerHud(h) { for (const r of this.runners.values()) r.hud?.(h); }
}

// ------------------------------------------------------------------------------------------------ runners
class Runner {
  constructor(W, e, q, s, key) { this.W = W; this.Q = W.Q; this.e = e; this.q = q; this.s = s; this.key = key; this.units = []; }
  get g() { return this.W.g; }
  get L() { return this.W.L; }
  get me() { return this.g.hero?.u; }
  anchor(fallbackSpawn = true) {
    const a = anchorOf(this.W.zone, this.s.at, this.s.off);
    if (a) return a;
    if (!fallbackSpawn) return null;
    const sp = this.W.zone.anchors?.spawn || { x: 0, z: 0 };
    warnOnce('run:' + this.key, `no anchor ${JSON.stringify(this.s.at)} for ${this.q.id} — using spawn`);
    return { x: sp.x + 4, z: sp.z - 8, facing: 0 };
  }
  level() { const [a, b] = this.q.levels || [0, 99]; return Math.max(a, Math.min(b, this.Q.char?.level || 5)) + (this.s.levelBonus || 0); }
  spawn(type, at, o = {}) {
    const u = makeFieldMob(type, { level: this.level(), x: at.x, z: at.z, alert: true, ...o });
    u.data.questRun = this.key; this.L.add(u); this.units.push(u);
    this.g.presenter?.call?.('play', 'spawn_puff', { pos: u.pos, x: u.pos.x, z: u.pos.z });
    return u;
  }
  dispose() { for (const u of this.units) if (u.level && !u.dead) u.level.remove(u); this.units.length = 0; }
}

/** a named foe (or a few) that appears when the step is current: { spawn: { type, name, at, n, elite, hpMul, scale } } */
class SpawnRunner extends Runner {
  constructor(...a) { super(...a); this.t = 0; }
  update(dt) {
    const sp = this.s.spawn, me = this.me; if (!me) return;
    this.t -= dt;
    const alive = this.units.filter(u => u.level && !u.dead);
    if (alive.length || this.t > 0) return;
    const at = anchorOf(this.W.zone, sp.at || this.s.at, sp.off) || this.anchor();
    if (dist(me.pos, at) > (sp.trigger ?? 40)) return;           // spawn when the hero comes near
    const left = (this.s.need || 1) - (this.e.n || 0); if (left <= 0) return;
    const n = Math.min(left, sp.n || 1);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, p = walkable(this.L, at.x + Math.cos(a) * (n > 1 ? 2.5 : 0), at.z + Math.sin(a) * (n > 1 ? 2.5 : 0), 5);
      const u = this.spawn(sp.type, p, { name: sp.name, elite: sp.elite ?? true, named: !!sp.name, hpMul: sp.hpMul, scale: sp.scale, alert: false, aggro: sp.aggro ?? 14 });
      u.data.questSpawn = this.key; u.data.named = !!sp.name;
      if (sp.name) { u.data.title = sp.title || ''; }
    }
    if (sp.banner !== false && sp.name) this.g.ui?.banner?.(sp.name, { kind: 'boss', sub: sp.title || 'Named foe', dur: 2.4 });
    this.t = 6;
  }
  hud(h) {
    const u = this.units.find(x => x.level && !x.dead && x.data.named && x.combatT > 0);
    if (u && !h.boss) h.boss = { name: u.name, title: u.data.title || '', hp: u.hp, hpMax: u.hpMax, barHp: u.hpMax / 12, bars: 12, stagger: null, destruction: null, enrageLeft: null, counter: false };
  }
  dispose(levelGone) { if (!levelGone) super.dispose(); }
}

/** hold a point for `dur` seconds while waves come: { at, r, dur, waves: [[type, n], …], every, protect: storyNpcId } */
class DefendRunner extends Runner {
  constructor(...a) { super(...a); this.state = 'idle'; this.t = 0; this.next = 0; this.ally = null; }
  update(dt) {
    const s = this.s, me = this.me; if (!me) return;
    const at = this.at || (this.at = this.anchor());
    const r = s.r || 9;
    this.Q.markers.setBeacon('run:' + this.key, { x: at.x, z: at.z, r: this.state === 'run' ? r : 2.2, color: this.state === 'run' ? 'red' : 'gold', core: this.state !== 'run' });
    if (s.protect && !this.ally) { const def = { id: s.protect, name: s.protectName || this.Q.npcName(s.protect), npc: s.protectNpc || 'villager' }; this.ally = this.spawnAlly(def, at); }
    const d = dist(me.pos, at);
    if (this.state === 'idle') { if (d < r) this.start(); return; }
    if (this.state !== 'run') return;
    if (me.dead || d > r * 3.2) { this.fail(me.dead ? 'You fell.' : 'You left the area.'); return; }
    this.t += dt; this.next -= dt;
    const alive = this.units.filter(u => u.level && !u.dead).length;
    if (this.next <= 0 && alive < (s.cap || 10)) {
      this.next = s.every || 7;
      const wave = s.waves[this.wave++ % s.waves.length];
      for (const [type, n] of [].concat(Array.isArray(wave[0]) ? wave : [wave])) for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, p = walkable(this.L, at.x + Math.cos(a) * (r + 4), at.z + Math.sin(a) * (r + 4), 6);
        const u = this.spawn(type, p); u.ctrl.target = this.ally && Math.random() < 0.4 ? this.ally : me;
      }
    }
    if (this.t >= s.dur) this.win();
  }
  spawnAlly(def, at) { const u = makeAlly(def, { x: at.x, z: at.z - 1 }, { level: this.level(), leader: null, atkMul: 0.6 }); u.ctrl.hold = true; this.L.add(u); this.units.push(u); return u; }
  start() {
    this.state = 'run'; this.t = 0; this.next = 1; this.wave = 0;
    this.g.ui?.banner?.(this.s.text || 'Hold the line!', { kind: 'warn', sub: `Survive ${Math.round(this.s.dur)} seconds` });
    this.g.audio?.sfx?.('raid_warning', {});
  }
  fail(why) {
    this.state = 'idle';
    for (const u of this.units) if (u !== this.ally && u.level && !u.dead) u.level.remove(u);
    this.units = this.units.filter(u => u === this.ally);
    this.g.ui?.toast?.(`${why} The defence failed — step back into the circle to try again.`, 'warn');
  }
  win() {
    this.state = 'done';
    for (const u of this.units) if (u !== this.ally && u.level && !u.dead) { u.hp = 0; u.dead = true; u.level.emit('death', { unit: u, killer: null }); }
    this.Q.markers.setBeacon('run:' + this.key, null);
    this.Q.progressEntry(this.e, this.s.need || 1);
  }
  hud(h) { if (this.state === 'run') { h.progress = { label: this.s.label || this.s.text || 'Defend', pct: Math.min(100, this.t / this.s.dur * 100) }; h.timer = { label: 'Hold', left: Math.max(0, this.s.dur - this.t), urgent: this.s.dur - this.t < 10 }; } }
  dispose(gone) { this.Q.markers.setBeacon('run:' + this.key, null); if (!gone) super.dispose(); }
}

/** walk someone from A to B: { who: storyNpcId | { name, npc }, from, to: [anchors] | path: [[anchor,dx,dz]…], ambush: [[pct, [[type, n]]]] } */
class EscortRunner extends Runner {
  constructor(...a) { super(...a); this.state = 'wait'; this.leg = 0; this.ambushed = new Set(); }
  update(dt) {
    const s = this.s, me = this.me; if (!me) return;
    if (!this.npc || !this.npc.level) {
      const from = anchorOf(this.W.zone, s.from, s.fromOff) || this.anchor();
      const d = typeof s.who === 'string' ? (storyDef(s.who) || { id: s.who, name: this.Q.npcName(s.who), npc: 'villager' }) : s.who;
      this.npc = makeAlly(d, walkable(this.L, from.x, from.z, 4), { level: this.level(), leader: null, atkMul: 0.3, floor: 0.35, talkable: false });
      this.npc.ctrl.hold = true; this.L.add(this.npc); this.units.push(this.npc);
      this.path = (s.path || [s.to]).map(p => { const a = Array.isArray(p) && typeof p[1] === 'number' ? anchorOf(this.W.zone, p[0], [p[1], p[2]]) : anchorOf(this.W.zone, p); return a ? walkable(this.L, a.x, a.z, 4) : null; }).filter(Boolean);
      if (!this.path.length) { const t = this.anchor(); this.path = [walkable(this.L, t.x + 20, t.z, 6)]; }
      this.total = this.path.reduce((acc, p, i) => acc + dist(i ? this.path[i - 1] : this.npc.pos, p), 0) || 1;
    }
    const u = this.npc, goal = this.path[this.leg];
    this.Q.markers.setBeacon('run:' + this.key, goal ? { x: goal.x, z: goal.z, r: 2.4, color: 'blue', core: false } : null);
    if (!goal) return;
    const near = dist(me.pos, u.pos) < 10, fighting = this.units.some(x => x !== u && x.level && !x.dead && dist(x.pos, u.pos) < 12);
    if (this.state === 'wait' && near) { this.state = 'walk'; if (s.say) this.g.ui?.toast?.(s.say, 'info'); }
    if (this.state === 'walk') {
      if (fighting) { u.ctrl.dest = null; u.ctrl.hold = false; }                     // stand and fight
      else if (!near) { u.ctrl.dest = null; u.ctrl.hold = true; }                    // wait for the hero
      else if (!u.ctrl.dest) { u.ctrl.hold = false; const leg = this.leg; u.ctrl.goto(goal.x, goal.z, s.speed || 3).then(() => { if (this.leg !== leg || this.state !== 'walk') return; this.leg++; if (this.leg >= this.path.length) this.arrive(); }); }
    }
    // ambushes at fractions of the way
    const done = this.leg / Math.max(1, this.path.length) + (goal ? (1 - Math.min(1, dist(u.pos, goal) / (dist(this.leg ? this.path[this.leg - 1] : u.pos, goal) || 1))) / this.path.length : 0);
    for (const [pct, wave] of s.ambush || []) {
      if (this.ambushed.has(pct) || done < pct) continue;
      this.ambushed.add(pct);
      for (const [type, n] of wave) for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; this.spawn(type, walkable(this.L, u.pos.x + Math.cos(a) * 9, u.pos.z + Math.sin(a) * 9, 6)); }
      this.g.ui?.banner?.(s.ambushText || 'Ambush!', { kind: 'warn' });
    }
    this.pct = Math.min(1, done);
  }
  arrive() {
    this.state = 'done'; this.Q.markers.setBeacon('run:' + this.key, null);
    this.npc?.model?.play?.('wave', { dur: 1.5 });
    this.Q.progressEntry(this.e, this.s.need || 1);
  }
  hud(h) { if (this.state === 'walk' && this.npc) h.progress = { label: this.s.label || `Escort ${this.npc.name}`, pct: Math.round((this.pct || 0) * 100) }; }
  dispose(gone) { this.Q.markers.setBeacon('run:' + this.key, null); if (!gone) setTimeout(() => super.dispose(), 2500); }
}

/** a boss fight in the open world (EncounterMode run inside the current mode): { boss: id, at: arena anchor, r, hpScale, intro } */
class EncounterRunner extends Runner {
  constructor(...a) { super(...a); this.state = 'idle'; this.enc = null; }
  update(dt) {
    const s = this.s, me = this.me; if (!me) return;
    const at = this.at || (this.at = this.anchor());
    if (this.state === 'idle') {
      this.Q.markers.setBeacon('run:' + this.key, { x: at.x, z: at.z, r: s.r || 6, color: 'red' });
      if (dist(me.pos, at) < (s.r || 6) && !me.dead) this.start(at);
      return;
    }
    if (this.state === 'fight' && this.enc) {
      this.enc.update(dt);
      if (me.dead && me.deadT > 1.5 && this.enc.state === 'fight') this.enc.wipe();
    }
  }
  start(at) {
    const s = this.s;
    const def = BOSS_DEFS[s.boss] || STORY_BOSSES[s.boss];
    if (!def) { warnOnce('boss:' + s.boss, 'no boss def', s.boss); this.Q.progressEntry(this.e, 1); return; }
    this.Q.markers.setBeacon('run:' + this.key, null);
    this.state = 'fight';
    const lvl = this.level(), ref = refFor(lvl);
    // tune a def written for a 4-player raid down to a solo story fight (≈ 2 minutes for a level-appropriate hero)
    const hpScale = s.hpScale ?? Math.min(1, (s.storyHp || def.storyHp || 700) / Math.max(1, def.hp));
    const z = this.W.zone, A = z.anchors || (z.anchors = {});
    const bossAt = anchorOf(z, s.bossAt || ['boss', 'poi:courtyard'], null) || { x: at.x, z: at.z - 8, facing: 0 };
    A['__qenc_spawn'] = { x: this.me.pos.x, z: this.me.pos.z, facing: 0 }; A['__qenc_boss'] = { x: bossAt.x, z: bossAt.z, facing: bossAt.facing ?? Math.PI };
    const enc = this.enc = new EncounterMode(this.g, { boss: def, bosses: [{ boss: def, anchor: '__qenc_boss', hpScale }], ilvl: lvl, partySize: 1, spawnAnchor: '__qenc_spawn', noRevive: true, seed: 5,
      onEnd: r => this.end(r) });
    enc.party = null;
    try { enc.enter(); } catch (e) { console.error('[quest encounter]', e); this.state = 'idle'; return; }
    for (const b of enc.bosses) {
      b.data.questRun = this.key; this.units.push(b);
      b.st.atk *= s.atkScale ?? def.storyAtk ?? 0.6;                       // hits hard, but a story boss shouldn't one-shot
      b.data.bars = Math.min(b.data.bars || 30, s.bars || 30); b.data.barHp = b.hpMax / b.data.bars;
    }
    this.g.audio?.music?.(def.music || 'boss');
    this.fieldMusic = this.W.zone.env?.music;
    void ref;
  }
  end(r) {
    const enc = this.enc; this.enc = null;
    try { enc?.exit?.(); } catch { /* */ }
    this.g.party = null;
    for (const u of this.units) if (u.level) u.level.remove(u);
    this.units.length = 0;
    const me = this.me;
    if (r?.cleared) { this.state = 'done'; this.g.audio?.music?.(this.fieldMusic || 'field'); this.Q.progressEntry(this.e, 1); return; }
    this.state = 'idle';
    if (me?.dead) { me.dead = false; me.hp = Math.round(me.hpMax * 0.6); me.invuln = 2; me.deadT = 0; me.model?.play?.('revive', { dur: 0.8 }); }
    this.g.ui?.toast?.(this.s.retry || 'You were beaten back. Catch your breath, then step into the arena again.', 'warn');
    this.g.audio?.music?.(this.fieldMusic || 'field');
  }
  hud(h) {
    if (!this.enc) return;
    h.boss = this.enc.bossHud(); const t = this.enc.timerHud?.(); if (t) h.timer = t;
  }
  dispose(gone) { this.Q.markers.setBeacon('run:' + this.key, null); if (this.enc) { try { this.enc.exit(); } catch { /* */ } this.enc = null; this.g.party = null; } if (!gone) super.dispose(); }
}
export { THREE };
