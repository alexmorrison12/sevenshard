// Co-op host. This browser owns the world: enemies, bosses, AI SimPlayers, loot and the current place (zone + mode).
// Each friend's browser owns their own hero (instant controls, local dodging). The host keeps a puppet of every
// friend's hero, streams 15 Hz snapshots + events to everyone, and applies the hits friends report.
import { HostTransport } from './peer.js';
import { spawnRec, row, hitRec } from './codec.js';
import { Unit } from '../game/unit.js';
import { SkillRun } from '../game/skills/runner.js';
import { dealDamage, applyKnock, applyStatus, heal, addShield } from '../game/combat.js';
import { CLASSES } from '../data/classes/index.js';
import { heroStats } from '../game/systems/stats.js';

const SNAP = 1 / 15;

export class NetHost {
  constructor(game, { code = null, name = 'Host', onStatus } = {}) {
    this.game = game; this.name = name; this.onStatus = onStatus || (() => {});
    this.guests = new Map();     // relay id → guest
    this.code = null; this.acc = 0; this.hudAcc = 0; this.teleId = 1; this.projId = 1;
    this.net = new HostTransport({
      onOpen: c => { this.code = c; this.onStatus({ open: true, code: c }); game.ui?.chat?.add?.({ channel: 'system', text: `Your world is open. Room code ${c} — friends can join from Play Together.` }); },
      onWait: c => this.onStatus({ waiting: c }),
      onJoin: (id, nm) => this.join(id, nm),
      onLeave: id => this.leave(id),
      onMessage: (id, m) => { const g = this.guests.get(id); if (g) { try { this.onGuest(g, m); } catch (e) { console.warn('[host] msg', m?.t, e); } } },
      onError: msg => this.onStatus({ error: msg }),
    }, code);
    game.net = this;
    if (game.level) this.attach(game.level);
    if (typeof window !== 'undefined') window.__probeSpawn = () => this.level.units.map(u => { const r = spawnRec(u); const bad = Object.keys(r).filter(k => { try { JSON.stringify(r[k]); return false; } catch { return true; } }); return bad.length ? [u.name, u.kind, bad] : null; }).filter(Boolean);
  }
  get level() { return this.game.level; }
  get count() { return this.guests.size; }
  send(g, m) { this.net.send(g.id, m); }
  all(m, except) { for (const g of this.guests.values()) if (g.ready && g !== except) this.send(g, m); }
  close() { this.all({ t: 'bye' }); this.net.close(); this.detach(); this.game.net = null; for (const g of this.guests.values()) this.removePuppet(g); }

  // ---------------------------------------------------------------- level hooks
  attach(L) {
    this.detach();
    this.L = L; L.netHost = this;
    const on = (t, f) => this.offs.push(L.on(t, f));
    this.offs = [];
    on('spawn', ({ unit }) => { if (!unit.remote) this.all({ t: 'sp', u: spawnRec(unit) }); });
    on('despawn', ({ unit }) => this.all({ t: 'ds', id: unit.id }));
    on('telegraph', tg => { tg.nid = this.teleId++; this.all({ t: 'tl', g: { id: tg.nid, shape: tg.shape, x: tg.x, z: tg.z, dx: tg.dx, dz: tg.dz, r: tg.r, inner: tg.inner, angle: tg.angle, len: tg.len, width: tg.width, back: tg.back, dur: tg.dur, t: tg.t, color: tg.color, safe: tg.safe, fo: tg.follow?.id } }); });
    on('telegraphEnd', tg => { if (tg.t < tg.dur - 0.05) this.all({ t: 'te', id: tg.nid }); });
    on('hitSpec', ({ src, h, ox, oz, dx, dz }) => this.all({ t: 'eh', s: src.id, h: hitRec(h), x: ox, z: oz, dx, dz }));
    on('projectile', p => { if (p.src?.team === 0 || p.src?.remote) return; p.nid = this.projId++; this.all({ t: 'pj', p: { id: p.nid, s: p.src?.id, x: p.x, z: p.z, y: p.y, dx: p.dx, dz: p.dz, speed: p.speed, range: p.range, radius: p.radius, pierce: p.pierce, hit: p.hit ? hitRec(p.hit) : null, kind: p.kind, color: p.color, arc: p.arc, ho: p.homing?.id, turn: p.turn, flies: p.flies } }); });
    on('zone', z => { if (z.src?.team === 0) return; this.all({ t: 'zn', z: { s: z.src?.id, x: z.x, z: z.z, dx: z.dx, dz: z.dz, r: z.r, dur: z.dur, tick: z.tick, first: z.first, hit: z.hit ? hitRec(z.hit) : null, shape: z.shape, kind: z.kind, fo: z.follow?.id } }); });
    on('fx', ev => { if (ev.unit?.remote) return; const p = ev.ev || {}; this.all({ t: 'fx', u: ev.unit?.id, n: ev.preset, x: ev.x, z: ev.z, dx: ev.dx, dz: ev.dz, p: { r: p.r, color: p.color || ev.color, arc: p.arc, flip: p.flip, vertical: p.vertical, spin: p.spin, big: p.big, len: p.len, width: p.width, follow: p.follow, scale: p.scale, dur: p.dur } }); });
    on('sfx', ev => { if (!ev.unit?.remote) this.all({ t: 'sfx', n: ev.name, x: ev.pos?.x, z: ev.pos?.z }); });
    on('shake', ev => { if (!ev.unit?.remote && ev.unit?.team !== 0) this.all({ t: 'sk', v: ev.v, x: ev.unit?.pos.x, z: ev.unit?.pos.z }); });
    on('anim', ev => { if (!ev.unit?.remote && ev.unit?.kind !== 'hero') this.all({ t: 'an', id: ev.unit.id, n: ev.name, d: ev.dur }); });
    on('skillStart', ({ unit, def, run }) => { if (unit.remote) return; if (unit.kind === 'hero') this.all({ t: 'cs', id: unit.id, sk: def.id, ax: run.aimX, az: run.aimZ, k: run.kind }); });
    on('skillStage', ({ unit, run }) => { if (unit.kind === 'hero' && !unit.remote) this.all({ t: 'cg', id: unit.id, st: run.stage, ax: run.aimX, az: run.aimZ }); });
    on('bossBanner', ({ text, kind }) => this.all({ t: 'bn', text, kind }));
    on('counter', ({ src, tgt }) => this.all({ t: 'ev', e: 'counter', s: src?.id, g: tgt?.id }));
    on('staggerBreak', ({ tgt }) => this.all({ t: 'ev', e: 'staggerBreak', g: tgt?.id }));
    on('partBreak', ({ tgt, part }) => this.all({ t: 'ev', e: 'partBreak', g: tgt?.id, part }));
    on('bossGroggy', ({ unit, dur }) => this.all({ t: 'ev', e: 'groggy', g: unit.id, d: dur }));
    on('death', ({ unit, killer }) => this.all({ t: 'ev', e: 'death', g: unit.id, k: killer?.id }));
    // support effects landing on a friend's hero are theirs to apply
    on('heal', ev => { if (ev.tgt?.remote && ev.src !== ev.tgt) this.toOwner(ev.tgt, { t: 'al', k: 'heal', a: ev.amount }); });
    on('shield', ev => { if (ev.tgt?.remote) this.toOwner(ev.tgt, { t: 'al', k: 'shield', a: ev.amount }); });
    on('status', ev => { if (ev.on && ev.tgt?.remote && !ev.s?.def?.debuff && !ev.s?.def?.cc && !ev.s?.netApplied) this.toOwner(ev.tgt, { t: 'al', k: 'status', id: ev.id, dur: ev.s.left, mods: ev.s.mods, name: ev.s.name, icon: ev.s.icon }); });
    // re-seat every friend in the new level
    for (const g of this.guests.values()) { g.unit = null; g.ready = false; this.send(g, { t: 'pl', p: this.game.placeInfo?.() || {} }); }
  }
  detach() { for (const f of this.offs || []) f(); this.offs = []; if (this.L) this.L.netHost = null; this.L = null; }
  toOwner(u, m) { for (const g of this.guests.values()) if (g.unit === u && g.ready) this.send(g, m); }

  // ---------------------------------------------------------------- connections
  join(id, name) {
    const g = { id, name, unit: null, char: null, ready: false, lastSt: null };
    this.guests.set(id, g);
    this.send(g, { t: 'hi', host: this.name });
    this.onStatus({ guests: this.guests.size });
  }
  leave(id) {
    const g = this.guests.get(id); if (!g) return;
    this.guests.delete(id);
    this.removePuppet(g);
    this.game.ui?.chat?.add?.({ channel: 'system', text: `${g.char?.name || g.name} left your world.` });
    this.onStatus({ guests: this.guests.size });
  }
  removePuppet(g) {
    const u = g.unit; if (!u) return;
    const party = this.game.party; if (party) { const i = party.members.findIndex(m => m.kit?.u === u || m.u === u); if (i >= 0) party.members.splice(i, 1); }
    if (u.level) u.level.remove(u);
    g.unit = null;
  }
  makePuppet(g) {
    const L = this.level; if (!L || !g.char) return;
    const c = g.char;
    const st = heroStats({ cls: c.cls, level: c.level, equip: c.equipLite || {}, engr: [] });
    const at = this.game.hero?.u.pos || { x: 0, z: 0 };
    const u = new Unit({ kind: 'hero', team: 0, name: c.name, cls: c.cls, level: c.level, x: at.x + 1.5, z: at.z + 1.5, radius: 0.45, height: 1.85, stats: { ...st, atk: c.atk || st.atk, hpMax: c.hpMax || st.hpMax } });
    u.remote = true; u.puppet = false; // on the host the friend's hero is a remote-driven unit (not simulated, not hit locally)
    u.data.look = c.look; u.data.gear = c.gear; u.data.sex = c.sex; u.data.weapon = c.weapon; u.data.title = c.title; u.data.owner = g.id;
    u.ctrl = { update: () => {} };
    g.unit = u;
    L.add(u);
    const party = this.game.party;
    if (party && !party.members.some(m => m.kit?.u === u)) { party.members.push({ kit: { u, char: { cls: c.cls, name: c.name } }, remote: true, guest: g.id }); u.party = party; }
    // send the whole world (the guest builds it), then their own id
    this.send(g, { t: 'wl', you: u.id, units: L.units.filter(x => x !== u).map(spawnRec), place: this.game.placeInfo?.() || {} });
    this.all({ t: 'sp', u: spawnRec(u) }, g);
  }

  // ---------------------------------------------------------------- guest messages
  onGuest(g, m) {
    const u = g.unit, L = this.level;
    switch (m.t) {
      case 'hello': g.char = m.c; this.send(g, { t: 'pl', p: this.game.placeInfo?.() || {} }); return;
      case 'ready': g.ready = true; if (!g.unit) this.makePuppet(g); return;   // guest built the place
      case 'st': {
        if (!u) return;
        u.pos.x = m.x; u.pos.z = m.z; u.pos.y = L.heightAt(m.x, m.z) + (m.l || 0); u.facing = m.f; u.anim.speed = m.sp || 0;
        u.hp = m.hp; u.hpMax = m.hm || u.hpMax; u.lift = m.l || 0;
        u.shields.length = 0; if (m.sh > 0) u.shields.push({ amt: m.sh, left: 1, src: null });
        const wasDead = u.dead; u.dead = !!(m.fl & 1); if (u.dead && !wasDead) L.emit('death', { unit: u, killer: null }); if (!u.dead && wasDead) { u.deadT = 0; L.emit('revive', { unit: u }); }
        u.cc.down = m.fl & 2 ? 0.2 : 0; u.cc.stun = m.fl & 4 ? 0.2 : 0;
        return;
      }
      case 'cs': { // a friend cast a skill: replay it visually here and for everyone else
        if (!u) return;
        this.replay(u, m.sk, m.ax, m.az, m.k);
        this.all({ t: 'cs', id: u.id, sk: m.sk, ax: m.ax, az: m.az, k: m.k }, g);
        return;
      }
      case 'cg': if (u?.skill && !u.skill.done) { u.skill.setAim(m.ax, m.az); u.skill.nextStage?.(); } this.all({ t: 'cg', id: u?.id, st: m.st, ax: m.ax, az: m.az }, g); return;
      case 'an': if (u) { u.model?.play?.(m.n, { dur: m.d }); this.all({ t: 'an', id: u.id, n: m.n, d: m.d }, g); } return;
      case 'ht': for (const h of m.h) this.applyHit(u, h); return;
      case 'al': { const tgt = L.byId.get(m.g); if (!tgt || tgt.dead) return; this.applyAlly(u, tgt, m); return; }
      case 'ch': { const msg = { channel: m.ch || 'party', from: g.char?.name || g.name, text: String(m.text || '').slice(0, 240) }; this.game.ui?.chat?.add?.(msg); this.all({ t: 'ch', m: msg }, g); return; }
      case 'pg': this.game.onPing?.({ x: m.x, z: m.z, from: g.char?.name }); this.all({ t: 'pg', x: m.x, z: m.z, from: g.char?.name }, g); return;
      case 'bye': this.leave(g.id); return;
      case 'req': this.game.onNetRequest?.(g, m); return;
    }
  }
  replay(u, skillId, ax, az, kind) {
    const kit = CLASSES[u.cls]; if (!kit) return;
    const def = kit.skills.find(s => s.id === skillId) || (kit.awakening?.id === skillId ? kit.awakening : null) || (skillId === 'basic' ? null : null);
    if (!def && skillId !== 'dash') return;
    u.skill?.cancel?.('replay');
    const d = def || { id: 'dash', type: 'normal', dur: 0.3, events: [{ t: 0, a: 'anim', name: 'dash', dur: 0.3 }] };
    u.skill = new SkillRun(this.level, u, { ...d, type: d.type === 'holding' || d.type === 'charge' ? 'normal' : d.type }, { aimX: ax, aimZ: az }, { visualOnly: true, kind });
  }
  /** a friend's hit on a unit we own: trust the number, apply the side effects here */
  applyHit(src, h) {
    const L = this.level; const tgt = L.byId.get(h[0]); if (!tgt || tgt.dead || !src) return;
    const [, amount, flags, stagger, wp, knock, kb, ox, oz, statuses, skill, kind] = h;
    const o = { fixed: amount, fixedCrit: !!(flags & 1), fixedBack: !!(flags & 2), fixedHead: !!(flags & 4), counter: !!(flags & 8), stagger, wp, skill, kind };
    const ev = dealDamage(L, src, tgt, 0, o);
    if (!ev || tgt.dead) return;
    if (knock) applyKnock(L, src, tgt, knock, kb ?? 3, ox ?? src.pos.x, oz ?? src.pos.z);
    if (statuses) for (const s of statuses) applyStatus(L, tgt, s.id, { dur: s.dur, src, power: s.power ? src.st.atk * s.power : 0 });
    if (flags & 16) applyStatus(L, tgt, 'brand', { dur: 10, src });
  }
  applyAlly(src, tgt, m) {
    const L = this.level;
    if (tgt.remote) { this.toOwner(tgt, m); return; }
    if (m.k === 'heal') heal(L, src, tgt, m.a / (src?.st.healMul || 1));
    else if (m.k === 'shield') addShield(L, src, tgt, m.a / (src?.st.shieldMul || 1), 6);
    else if (m.k === 'status') { const s = applyStatus(L, tgt, m.id, { dur: m.dur, src, mods: m.mods, name: m.name, icon: m.icon }); if (s) s.netApplied = true; }
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (!this.guests.size || !this.level) return;
    this.acc += dt; this.hudAcc += dt;
    if (this.acc < SNAP) return;
    this.acc = 0;
    const L = this.level, rows = [];
    for (const u of L.units) rows.push(row(u));
    const m = { t: 'sn', tm: Math.round(L.time * 1000), u: rows };
    if (this.hudAcc > 0.25) {
      this.hudAcc = 0;
      const mode = this.game.mode;
      m.h = { boss: mode?.bossHud?.() || null, progress: mode?.progressHud?.() || null, timer: mode?.timerHud?.() || null, party: this.game.party?.hud?.() || null, state: mode?.state };
      if (m.h.boss) delete m.h.boss.buffs;
    }
    for (const g of this.guests.values()) if (g.ready) this.send(g, m);
  }
  /** the game changed place (zone/mode): guests rebuild */
  placeChanged() { for (const g of this.guests.values()) { g.ready = false; g.unit = null; this.send(g, { t: 'pl', p: this.game.placeInfo?.() || {} }); } }
  result(r) { this.all({ t: 'rs', r: { cleared: r.cleared, time: r.time, kind: r.kind, name: r.name, meter: r.meter?.map(x => ({ name: x.name, cls: x.cls, dmg: x.dmg, dps: x.dps, share: x.share, deaths: x.deaths, counters: x.counters })) } }); }
}
