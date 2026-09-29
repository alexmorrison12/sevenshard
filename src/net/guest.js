// Co-op guest. Joins a friend's world: builds the same place, mirrors every unit as an interpolated puppet, runs
// our own hero locally (instant controls), resolves enemy attacks against our hero on this side (fair dodging),
// and reports our hits, casts, heals and state to the host.
import { GuestTransport } from './peer.js';
import { F } from './codec.js';
import { Unit } from '../game/unit.js';
import { SkillRun } from '../game/skills/runner.js';
import { resolveHit, heal, addShield, applyStatus, kill } from '../game/combat.js';
import { CLASSES } from '../data/classes/index.js';
import { CITY_NPCS } from '../data/npcs.js';

const SEND = 1 / 15;
const KNOCK = { push: 'push', pull: 'pull', down: 'down', up: 'up', stun: 'stun' };

export class NetGuest {
  /**
   * session: { onPlace(place) → Promise (build zone + our hero), onResult(r), onClose(reason), onHud(h) }
   */
  constructor(game, code, char, session) {
    this.game = game; this.char = char; this.s = session;
    this.hostIds = new Map();   // host unit id → local unit
    this.youHostId = null; this.hits = []; this.acc = 0; this.hud = {}; this.teles = new Map();
    this.open = false; this.building = false;
    this.net = new GuestTransport(code, char.name, {
      onOpen: () => { this.open = true; this.send({ t: 'hello', c: charSummary(char, game) }); session.onStatus?.({ open: true }); },
      onMessage: m => { try { this.on(m); } catch (e) { console.warn('[guest] msg', m?.t, e); } },
      onClose: reason => { this.open = false; session.onClose?.(reason); },
      onError: msg => session.onStatus?.({ error: msg }),
    });
    game.net = this;
  }
  send(m) { this.net.send(m); }
  close() { try { this.send({ t: 'bye' }); } catch { /* */ } this.net.close(); this.detach(); this.game.net = null; }
  get level() { return this.game.level; }
  get me() { return this.game.hero?.u; }

  // ---------------------------------------------------------------- local level hooks
  attach(L) {
    this.detach();
    this.L = L;
    L.netHit = (src, tgt, amount, o, ev) => {
      if (src !== this.me || !tgt.hostId) return;
      const h = o.hit || {};
      const flags = (ev.crit ? 1 : 0) | (ev.back ? 2 : 0) | (ev.head ? 4 : 0) | (o.counter ? 8 : 0) | (h.brand ? 16 : 0);
      this.hits.push([tgt.hostId, amount, flags, Math.round(o.stagger || 0), o.wp || 0, KNOCK[h.knock] || 0, h.kb, Math.round(src.pos.x * 10) / 10, Math.round(src.pos.z * 10) / 10, h.status || 0, o.skill, o.kind]);
    };
    L.netAlly = (src, tgt, m) => { if (src === this.me && tgt.hostId) this.send({ t: 'al', g: tgt.hostId, ...m }); };
    const on = (t, f) => this.offs.push(L.on(t, f));
    this.offs = [];
    on('skillStart', ({ unit, def, run }) => { if (unit === this.me && !run.opts.visualOnly) this.send({ t: 'cs', sk: def.id, ax: r1(run.aimX), az: r1(run.aimZ), k: run.kind }); });
    on('skillStage', ({ unit, run }) => { if (unit === this.me) this.send({ t: 'cg', st: run.stage, ax: r1(run.aimX), az: r1(run.aimZ) }); });
    on('identity', ({ unit }) => { if (unit === this.me) this.send({ t: 'an', n: 'identity', d: 0.7 }); });
  }
  detach() { for (const f of this.offs || []) f(); this.offs = []; if (this.L) { this.L.netHit = null; this.L.netAlly = null; } this.L = null; }

  // ---------------------------------------------------------------- puppets
  puppet(rec) {
    const L = this.level; if (!L || this.hostIds.has(rec.id)) return this.hostIds.get(rec.id);
    const u = new Unit({ kind: rec.k, team: rec.tm, name: rec.n, type: rec.t, cls: rec.c, level: rec.lv, x: rec.x, z: rec.z, facing: rec.f, radius: rec.r, height: rec.h, stats: { hpMax: rec.hm, atk: rec.atk, mpMax: 0, mpRegen: 0 } });
    u.hp = rec.hp; u.puppet = true; u.hostId = rec.id; u.ctrl = null;
    Object.assign(u.data, { sex: rec.sx, look: rec.lk, gear: rec.gr, weapon: rec.wp, npc: rec.npc, elite: !!rec.el, scale: rec.sc, modelOpts: rec.mo, title: rec.ti, variant: rec.var, lod: rec.lod, bars: rec.bars, barHp: rec.bh });
    if (rec.tpl) u.data.tpl = { model: rec.tpl };
    if (rec.def) u.data.def = rec.def;
    if (rec.nd) { u.data.npcDef = CITY_NPCS.find(n => n.id === rec.nd) || null; u.untargetable = true; }
    u.net = { tx: rec.x, tz: rec.z, tf: rec.f, lift: 0 };
    this.hostIds.set(rec.id, u);
    L.add(u);
    u.pos.x = rec.x; u.pos.z = rec.z;
    return u;
  }
  unit(hostId) { if (hostId == null) return null; if (hostId === this.youHostId) return this.me; return this.hostIds.get(hostId) || null; }

  // ---------------------------------------------------------------- messages
  async on(m) {
    const L = this.level, me = this.me;
    switch (m.t) {
      case 'hi': return;
      case 'pl': { // (re)build the host's place
        this.building = true;
        for (const u of this.hostIds.values()) L?.remove(u);
        this.hostIds.clear(); this.teles.clear();
        await this.s.onPlace(m.p);
        this.attach(this.game.level);
        this.building = false;
        this.send({ t: 'ready' });
        return;
      }
      case 'wl': this.youHostId = m.you; for (const rec of m.units) this.puppet(rec); return;
      case 'sp': if (!this.building && m.u.id !== this.youHostId) this.puppet(m.u); return;
      case 'ds': { const u = this.hostIds.get(m.id); if (u) { L.remove(u); this.hostIds.delete(m.id); } return; }
      case 'sn': this.snapshot(m); return;
      case 'tl': {
        const g = m.g; const tg = L.telegraph({ ...g, follow: this.unit(g.fo), owner: null, team: 1 });
        tg.t = g.t || 0; this.teles.set(g.id, tg); setTimeout(() => this.teles.delete(g.id), (g.dur + 1) * 1000);
        return;
      }
      case 'te': { const tg = this.teles.get(m.id); if (tg) tg.alive = false; return; }
      case 'eh': { // an enemy attack landed on the host: did it catch our hero here?
        if (!me || me.dead) return;
        const src = this.unit(m.s) || this.stub(m.s);
        resolveHit(L, src, m.h, m.x, m.z, m.dx, m.dz, { only: me, skill: 'enemy', kind: 'boss' });
        return;
      }
      case 'pj': {
        const p = m.p, src = this.unit(p.s) || this.stub(p.s);
        L.projectile({ src, x: p.x, z: p.z, y: p.y, dx: p.dx, dz: p.dz, speed: p.speed, range: p.range, radius: p.radius, pierce: p.pierce, hit: p.hit, kind: p.kind, color: p.color, arc: p.arc, homing: p.ho === this.youHostId ? me : null, turn: p.turn, flies: p.flies, ctx: { only: me, skill: 'enemy' }, noHit: !p.hit });
        return;
      }
      case 'zn': { const z = m.z, src = this.unit(z.s) || this.stub(z.s); L.groundZone({ src, x: z.x, z: z.z, dx: z.dx, dz: z.dz, r: z.r, dur: z.dur, tick: z.tick, first: z.first, hit: z.hit, shape: z.shape, kind: z.kind, follow: this.unit(z.fo), ctx: { only: me, skill: 'enemy' } }); return; }
      case 'fx': { const u = this.unit(m.u); L.emit('fx', { unit: u, preset: m.n, x: m.x, z: m.z, dx: m.dx, dz: m.dz, ev: { ...m.p, follow: m.p?.follow } }); return; }
      case 'sfx': L.emit('sfx', { name: m.n, pos: { x: m.x ?? me?.pos.x ?? 0, y: 0, z: m.z ?? me?.pos.z ?? 0 } }); return;
      case 'sk': if (me && Math.hypot((m.x ?? me.pos.x) - me.pos.x, (m.z ?? me.pos.z) - me.pos.z) < 20) this.game.cam.shake(m.v * 0.8); return;
      case 'an': { const u = this.unit(m.id); u?.model?.play?.(m.n, { dur: m.d }); return; }
      case 'cs': { const u = this.unit(m.id); if (u && u !== me) this.replay(u, m.sk, m.ax, m.az, m.k); return; }
      case 'cg': { const u = this.unit(m.id); if (u?.skill && !u.skill.done && u !== me) { u.skill.setAim(m.ax, m.az); u.skill.nextStage?.(); } return; }
      case 'bn': this.game.ui?.banner?.(m.text, { kind: m.kind }); return;
      case 'ev': {
        const g = this.unit(m.g);
        if (m.e === 'counter') L.emit('counter', { src: this.unit(m.s), tgt: g });
        else if (m.e === 'staggerBreak' && g) L.emit('staggerBreak', { tgt: g });
        else if (m.e === 'partBreak' && g) { L.emit('partBreak', { tgt: g, part: m.part }); g.model?.breakPart?.(m.part); }
        else if (m.e === 'groggy' && g) g.model?.play?.('groggy', { dur: m.d, loop: true });
        else if (m.e === 'death' && g && g !== me && !g.dead) { g.dead = true; g.hp = 0; L.emit('death', { unit: g, killer: this.unit(m.k) }); }
        return;
      }
      case 'al': {
        if (!me || me.dead) return;
        if (m.k === 'heal') heal(L, null, me, m.a);
        else if (m.k === 'shield') addShield(L, null, me, m.a, 6);
        else if (m.k === 'status') applyStatus(L, me, m.id, { dur: m.dur, mods: m.mods, name: m.name, icon: m.icon });
        return;
      }
      case 'ch': this.game.ui?.chat?.add?.(m.m); return;
      case 'pg': this.game.onPing?.({ x: m.x, z: m.z, from: m.from }); return;
      case 'rs': this.s.onResult?.(m.r); return;
      case 'bye': this.s.onClose?.('The host closed the world.'); return;
    }
  }
  /** a source we don't know yet (spawn raced the attack): borrow numbers from the hud */
  stub(id) { return { id, team: 1, pos: { x: 0, y: 0, z: 0 }, st: { atk: this.lastAtk || 5000 }, data: {}, statuses: [], shields: [], _statDirty: true, baseSuperArmor: 0, facing: 0, fx: 0, fz: -1 }; }
  replay(u, skillId, ax, az, kind) {
    const kit = CLASSES[u.cls]; if (!kit) return;
    const def = kit.skills.find(s => s.id === skillId) || (kit.awakening?.id === skillId ? kit.awakening : null);
    if (!def) { if (skillId === 'dash') u.model?.play?.('dash', { dur: 0.3 }); return; }
    u.skill?.cancel?.('replay');
    u.skill = new SkillRun(this.level, u, { ...def, type: def.type === 'holding' || def.type === 'charge' ? 'normal' : def.type }, { aimX: ax, aimZ: az }, { visualOnly: true, kind });
  }
  snapshot(m) {
    const L = this.level; if (!L || this.building) return;
    for (const r of m.u) {
      const [id, x, z, f, hp, fl, sp, lift] = r;
      if (id === this.youHostId) continue;
      const u = this.hostIds.get(id); if (!u) continue;
      u.net.tx = x; u.net.tz = z; u.net.tf = f; u.net.lift = lift;
      u.anim.speed = sp;
      if (!(u.hp < hp && u._optT > performance.now())) u.hp = hp; // keep our optimistic hit visible briefly
      if (u.kind === 'boss' || u.kind === 'mob') this.lastAtk = u.st.atk;
      const dead = !!(fl & F.dead);
      if (dead && !u.dead) { u.dead = true; u.deadT = 0; L.emit('death', { unit: u, killer: null }); }
      if (!dead && u.dead) { u.dead = false; u.deadT = 0; }
      u.cc.down = fl & F.down ? 0.3 : 0; u.cc.stun = fl & F.stun ? 0.3 : 0;
      u.data.groggy = !!(fl & F.groggy); u.data.fly = fl & F.fly ? 1 : 0; u.data.burrowed = fl & F.burrow ? 1 : 0; u.data.ghost = fl & F.ghost ? 1 : 0;
      u.data.enraged = !!(fl & F.enraged); u.untargetable = !!(fl & F.untarget); u.data.counterWindow = fl & F.counter ? 0.5 : 0;
      u.model?.setGlow?.('counter', fl & F.counter ? 1 : 0);
    }
    if (m.h) { this.hud = m.h; this.s.onHud?.(m.h); }
  }
  update(dt) {
    const L = this.level; if (!L || this.building) return;
    // interpolate puppets toward the latest snapshot
    const k = 1 - Math.exp(-14 * dt);
    for (const u of this.hostIds.values()) {
      const n = u.net; if (!n) continue;
      const dx = n.tx - u.pos.x, dz = n.tz - u.pos.z;
      if (dx * dx + dz * dz > 64) { u.pos.x = n.tx; u.pos.z = n.tz; } else { u.pos.x += dx * k; u.pos.z += dz * k; }
      let df = n.tf - u.facing; df = Math.atan2(Math.sin(df), Math.cos(df)); u.facing += df * Math.min(1, k * 1.5);
      u.pos.y = L.heightAt(u.pos.x, u.pos.z) + (n.lift || 0);
    }
    if (this.hits.length) { this.send({ t: 'ht', h: this.hits }); this.hits = []; }
    this.acc += dt;
    const me = this.me;
    if (me && this.acc >= SEND) {
      this.acc = 0;
      const fl = (me.dead ? 1 : 0) | (me.cc.down > 0 || me.air.launched ? 2 : 0) | (me.cc.stun > 0 || me.cc.freeze > 0 ? 4 : 0);
      this.send({ t: 'st', x: r1(me.pos.x), z: r1(me.pos.z), f: Math.round(me.facing * 100) / 100, sp: r1(me.anim.speed || 0), hp: Math.round(me.hp), hm: me.hpMax, sh: Math.round(me.shield), fl, l: r1(me.lift || 0) });
    }
  }
}
const r1 = v => Math.round(v * 10) / 10;
export function charSummary(c, game) {
  const u = game?.hero?.u;
  return { name: c.name, cls: c.cls, sex: c.sex, level: c.level, look: c.look, gear: c.gear || { tier: 1 }, weapon: c.weapon, title: c.title, atk: u?.st.atk, hpMax: u?.hpMax, ilvl: c.ilvl };
}
export { kill };
