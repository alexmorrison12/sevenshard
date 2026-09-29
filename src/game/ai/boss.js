// Boss brains. A boss definition (src/data/bosses/*.js) lists moves (async scripts) and HP-gated mechanics; the
// brain picks targets, walks into range, runs weighted moves, and exposes script helpers: telegraphs, timed hits,
// counter windows, stagger checks, destruction parts, charges, leaps, adds, hazards, banners and cinematics.
// Moves are cancelled (CANCEL) when the boss is countered, stagger-broken or killed.
import { Unit } from '../unit.js';
import { CANCEL } from '../level.js';
import { resolveHit, applyStatus, inShape } from '../combat.js';
import { makeMob, refFor } from './mob.js';
import { facingOf } from '../../core/util.js';

const DEG = Math.PI / 180;

export function makeBoss(def, o = {}) {
  const ref = o.ref || refFor(o.ilvl || 1415);
  const size = o.partySize ?? 4;
  const hpScale = o.hpScale ?? (size <= 1 ? 0.3 : size <= 4 ? 1 : 1.9);
  const u = new Unit({
    kind: 'boss', team: 1, type: def.model || def.id, name: def.name, level: 60, x: o.x ?? 0, z: o.z ?? -10, facing: o.facing ?? 0,
    radius: def.radius, height: def.height, mass: 1e6,
    stats: { hpMax: Math.round(def.hp * ref.ap * hpScale), atk: def.atk * ref.hp / 0.55, def: 6500, speed: def.speed || 4.5, mpMax: 0, mpRegen: 0, crit: 0.05 },
  });
  u.data.def = def; u.data.bars = def.bars || 100; u.data.barHp = u.hpMax / u.data.bars;
  u.data.title = def.title; u.data.immovable = true; u.data.corpseTime = 1e9;
  u.turnRate = def.turnRate || 4;
  u.data.modelOpts = def.modelOpts || {};
  u.ctrl = new BossBrain(u, def, o);
  return u;
}

export class BossBrain {
  constructor(u, def, o = {}) {
    this.u = u; this.def = def; this.o = o;
    this.target = null; this.targetT = 0; this.cds = new Map(); this.busy = false; this.phase = 0;
    this.mechDone = new Set(); this.started = false; this.fightT = 0; this.enraged = false;
    this.moveT = 0; this.idleT = 1.2; this.sinceMove = 0;
    this.mods = o.mods || {};   // hard mode, affixes
    this.flags = {};             // per-fight script state (parts broken, phases…)
  }
  get level() { return this.u.level; }
  // ---------------------------------------------------------------- loop
  update(dt, L) {
    const u = this.u;
    u.move.x = u.move.z = 0;
    if (!this.started) return;
    this.fightT += dt;
    if (!this.enraged && this.def.enrage && this.fightT > this.def.enrage) { this.enraged = true; u.data.enraged = true; applyStatus(L, u, 'enrage', { dur: 1e6, force: true, mods: { dmgMul: 2, atkSpd: 0.3, moveSpd: 0.3 } }); L.emit('bossEnrage', { unit: u }); }
    if (u.data.groggy) { this.groggyT -= dt; if (this.groggyT <= 0) { u.data.groggy = false; this.idleT = 0.4; } return; }
    // HP-gated mechanics take priority
    if (!this.busy) {
      for (const m of this.def.mechanics || []) {
        if (this.mechDone.has(m.id)) continue;
        if (u.hp / u.hpMax <= m.at + 1e-6) { this.mechDone.add(m.id); this.run(m, true); return; }
      }
    }
    if (this.busy) return;
    this.targetT -= dt;
    if (!this.target || this.target.dead || this.targetT <= 0) this.pickTarget(L);
    const t = this.target; if (!t) return;
    this.idleT -= dt;
    if (this.idleT > 0) { this.face(t, dt * 0.6); return; }
    // choose a move
    const dist = u.gap(t);
    const pool = [];
    for (const [id, m] of Object.entries(this.def.moves)) {
      if (this.cds.has(id) && this.cds.get(id) > this.fightT) continue;
      if (m.phase !== undefined && !(Array.isArray(m.phase) ? m.phase.includes(this.phase) : m.phase === this.phase)) continue;
      if (m.minPhase !== undefined && this.phase < m.minPhase) continue;
      if (m.when && !m.when(this)) continue;
      const range = m.range ?? 4;
      if (dist > range || dist < (m.minRange ?? 0)) continue;
      pool.push([id, m]);
    }
    if (pool.length) {
      let tot = 0; for (const [, m] of pool) tot += m.weight ?? 1;
      let r = L.rng() * tot, pick = pool[0];
      for (const p of pool) { r -= p[1].weight ?? 1; if (r <= 0) { pick = p; break; } }
      const [id, m] = pick;
      this.cds.set(id, this.fightT + (m.cd ?? 4));
      this.run(m);
      return;
    }
    // approach
    const dx = t.pos.x - u.pos.x, dz = t.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
    const sp = u.st.speed * (dist > 12 ? 1.6 : 1);
    u.move.x = dx / d * sp; u.move.z = dz / d * sp;
  }
  pickTarget(L) {
    const heroes = L.units.filter(h => h.kind === 'hero' && !h.dead && !h.untargetable);
    if (!heroes.length) { this.target = null; return; }
    // Lost Ark bosses roam between targets: favour whoever dealt damage recently, with randomness
    const last = this.u.lastHitBy && !this.u.lastHitBy.dead && this.u.lastHitBy.kind === 'hero' ? this.u.lastHitBy : null;
    this.target = last && L.rng() < 0.5 ? last : heroes[Math.floor(L.rng() * heroes.length)];
    this.targetT = 6 + L.rng() * 6;
  }
  face(t, rate = 1) { const u = this.u; const f = facingOf(t.pos.x - u.pos.x, t.pos.z - u.pos.z); let d = f - u.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); u.facing += Math.sign(d) * Math.min(Math.abs(d), (u.turnRate || 4) * Math.max(rate, 0.016)); }
  async run(m, mech = false) {
    this.busy = true;
    const L = this.level, u = this.u;
    try { await m.run(this, this.target); }
    catch (e) { if (e !== CANCEL) console.error('[boss move]', e); }
    finally {
      this.busy = false; u.data.counterWindow = 0; u.model?.setGlow?.('counter', 0);
      this.idleT = (m.recover ?? 0.6) * (this.enraged ? 0.5 : 1) * (this.mods.hard ? 0.75 : 1);
      if (m.phaseAfter !== undefined) this.phase = m.phaseAfter;
    }
  }
  /** interrupt the running script (counter, stagger break) */
  interrupt(groggy = 0) {
    const L = this.level, u = this.u;
    L.cancelScripts(u);
    u.data.counterWindow = 0; u.model?.setGlow?.('counter', 0);
    for (const tg of L.telegraphs) if (tg.owner === u) tg.alive = false;
    this.busy = false;
    if (groggy > 0) { u.data.groggy = true; this.groggyT = groggy; u.model?.play?.('groggy', { dur: groggy, loop: true }); L.emit('bossGroggy', { unit: u, dur: groggy }); }
  }

  // ---------------------------------------------------------------- script helpers (await-able)
  wait(s) { return this.level.wait(s / (this.enraged ? 1.3 : 1) / (this.mods.hard ? 1.12 : 1), this.u); }
  /** play a model action; returns { dur, hits } scaled to dur */
  anim(name, dur) {
    const u = this.u, meta = u.model?.meta?.actions?.[name] || this.def.anims?.[name];
    const d = dur ?? meta?.dur ?? 1.2;
    const r = u.model?.play?.(name, { dur: d }) || { dur: d, hits: [d * 0.55] };
    return { dur: d, hits: (r.hits && r.hits.length ? r.hits : [d * 0.55]) };
  }
  turnTo(t) { const u = this.u; if (!t) return; u.facing = facingOf(t.pos.x - u.pos.x, t.pos.z - u.pos.z); }
  lookAt(x, z) { const u = this.u; u.facing = facingOf(x - u.pos.x, z - u.pos.z); }
  get fwd() { return { x: this.u.fx, z: this.u.fz }; }
  /** telegraph at the boss (or opts.x/z) facing its forward; shape: circle/cone/rect/donut; returns record */
  tele(shape, o = {}) {
    const u = this.u, f = this.fwd;
    const dir = o.dir || f;
    const off = o.off || 0;
    const x = (o.x ?? u.pos.x) + dir.x * off, z = (o.z ?? u.pos.z) + dir.z * off;
    return this.level.telegraph({ shape, r: o.r, inner: o.inner, angle: o.deg ? o.deg * DEG : o.angle, len: o.len, width: o.width, back: o.back,
      x, z, dx: dir.x, dz: dir.z, dur: o.dur ?? 1, color: o.color || 'red', owner: u, team: u.team, follow: o.follow, safe: o.safe });
  }
  /** resolve a hit with the same geometry as a telegraph (or explicit), damage coef × boss atk */
  hit(shape, o = {}) {
    const u = this.u, f = o.dir || this.fwd, off = o.off || 0;
    const x = (o.x ?? u.pos.x) + f.x * off, z = (o.z ?? u.pos.z) + f.z * off;
    const h = { shape, r: o.r, inner: o.inner, angle: o.deg ? o.deg * DEG : o.angle, len: o.len, width: o.width, back: o.back,
      coef: (o.coef ?? 1) * (this.mods.hard ? 1.25 : 1), knock: o.knock, kb: o.kb, knockDur: o.knockDur, status: o.status, hitstop: 0.05, heavy: !!o.heavy };
    const evs = resolveHit(this.level, u, h, x, z, f.x, f.z, { skill: o.id || 'boss', kind: 'boss' });
    if (o.fx) this.level.emit('fx', { unit: u, preset: o.fx, x, z, dx: f.x, dz: f.z, ev: { r: o.r, len: o.len, width: o.width, color: o.color, angle: o.deg } });
    if (o.shake) this.level.emit('shake', { unit: u, v: o.shake });
    if (o.sfx) this.level.emit('sfx', { unit: u, name: o.sfx, pos: { x, y: u.pos.y, z } });
    return evs;
  }
  /** telegraph then hit after dur */
  async strike(shape, o = {}) {
    const tg = this.tele(shape, o);
    await this.wait(o.dur ?? 1);
    tg.alive = false;
    return this.hit(shape, o);
  }
  /** Counter window: boss glows blue; a counter-flagged hit stuns it. */
  counterWindow(dur, groggy = 3.5) {
    const u = this.u, L = this.level;
    u.data.counterWindow = dur;
    u.model?.setGlow?.('counter', 1);
    L.emit('counterWindow', { unit: u, dur });
    u.data.onCounter = src => { this.interrupt(groggy); L.emit('bossCountered', { unit: u, src }); };
    const t0 = L.time;
    const tm = L.every(0.05, () => { if (L.time - t0 >= dur || !u.data.counterWindow) { u.data.counterWindow = 0; u.model?.setGlow?.('counter', 0); L.cancelTimer(tm); } else u.data.counterWindow = dur - (L.time - t0); });
  }
  /** Stagger check: deplete `amount` stagger within dur or onFail runs. Resolves true if broken. */
  async staggerCheck(amount, dur, { groggy = 4, onFail, label } = {}) {
    const u = this.u, L = this.level;
    const sg = u.data.stagger = { v: amount, max: amount, broken: false, label, left: dur };
    L.emit('staggerCheck', { unit: u, sg, dur, label });
    const t0 = L.time;
    while (L.time - t0 < dur && !sg.broken && !u.dead) { sg.left = dur - (L.time - t0); await this.wait(0.1); }
    u.data.stagger = null;
    if (sg.broken) { this.interrupt(groggy); throw CANCEL; }
    await onFail?.();
    return false;
  }
  destruction(part, amount, onBreak) { this.u.data.destruction = { v: amount, max: amount, part, broken: false, onBreak: src => { this.u.model?.breakPart?.(part); onBreak?.(src); } }; }
  /** run forward along facing for dist over dur, hitting everything in a rect ahead each tick */
  async charge(dist, dur, hitO = {}) {
    const u = this.u, L = this.level, f = this.fwd, steps = Math.ceil(dur / 0.05), hitSet = new Set();
    u.data.ghostWalk = true;
    for (let i = 0; i < steps; i++) {
      const r = L.nav.move(u.pos.x, u.pos.z, f.x * dist / steps, f.z * dist / steps, Math.min(u.radius, 1.2));
      u.pos.x = r.x; u.pos.z = r.z;
      for (const h of L.query(u.pos.x, u.pos.z, u.radius + 2)) {
        if (h.team === u.team || h.dead || hitSet.has(h.id)) continue;
        if (!inShape({ shape: 'circle', r: u.radius + 0.6 }, u.pos.x, u.pos.z, f.x, f.z, h)) continue;
        hitSet.add(h.id);
        resolveHit(L, u, { shape: 'circle', r: 0.1, coef: hitO.coef ?? 1, knock: hitO.knock ?? 'down', kb: hitO.kb ?? 4, maxTargets: 1 }, h.pos.x, h.pos.z, f.x, f.z, { skill: 'charge', kind: 'boss' });
      }
      await this.wait(dur / steps);
    }
    u.data.ghostWalk = false;
  }
  /** jump to (x, z) over dur with an arc; lands with the given hit */
  async leap(x, z, dur, height = 5) {
    const u = this.u, x0 = u.pos.x, z0 = u.pos.z, steps = Math.ceil(dur / 0.033);
    this.lookAt(x, z);
    u.data.ghostWalk = true; u.untargetable = true;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      u.pos.x = x0 + (x - x0) * k; u.pos.z = z0 + (z - z0) * k;
      u.data.hover = Math.sin(k * Math.PI) * height;
      await this.wait(dur / steps);
    }
    u.data.hover = 0; u.data.ghostWalk = false; u.untargetable = false;
    const p = this.level.nav.nearest(u.pos.x, u.pos.z, 8, 1); if (p) { u.pos.x = p.x; u.pos.z = p.z; }
  }
  spawnAdds(type, n, r = 8, o = {}) {
    const u = this.u, L = this.level, out = [];
    for (let i = 0; i < n; i++) {
      const a = L.rng() * Math.PI * 2, rr = r * (0.5 + L.rng() * 0.5);
      const m = makeMob(type, { x: u.pos.x + Math.cos(a) * rr, z: u.pos.z + Math.sin(a) * rr, ref: this.o.ref, alert: true, ...o });
      L.add(m); out.push(m);
    }
    return out;
  }
  hazard(o) { return this.level.groundZone({ src: this.u, team: 'enemy', ...o, hit: o.hit ? { ...o.hit, coef: (o.hit.coef ?? 0.2) } : null }); }
  banner(text, kind = 'mechanic') { this.level.emit('bossBanner', { unit: this.u, text, kind }); }
  heroes() { return this.level.units.filter(h => h.kind === 'hero' && !h.dead); }
  randomHero() { const hs = this.heroes(); return hs[Math.floor(this.level.rng() * hs.length)] || null; }
}
