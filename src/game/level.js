// A running level: the zone, its units, projectiles, ground zones, telegraphs, timers and scripted waits.
// Simulation order per frame: controllers → skills → movement/physics → projectiles → ground zones → statuses → deaths.
// Presentation (models, FX, audio, UI) listens to events and never mutates simulation state.
import { Emitter } from '../core/events.js';
import { RNG } from '../core/noise.js';
import { NavGrid } from './nav.js';
import { eff, tickStatuses, resolveHit, inShape } from './combat.js';

const CANCEL = Symbol('cancel');
export { CANCEL };

export class Level extends Emitter {
  constructor(zone, { seed = Date.now() } = {}) {
    super();
    this.zone = zone;
    this.nav = zone.nav instanceof NavGrid ? zone.nav : new NavGrid(zone.nav);
    this.heightAt = zone.heightAt ? zone.heightAt.bind(zone) : () => 0;
    this.units = []; this.byId = new Map();
    this.projectiles = []; this.zones = []; this.telegraphs = [];
    this.timers = []; this.waits = [];
    this.time = 0; this.frame = 0;
    this._rng = new RNG(seed); this.rng = () => this._rng.next();
    this.hash = new Map(); this.hashCell = 4;
    this.paused = false;
    this.localHero = null;
  }
  add(u) {
    if (this.byId.has(u.id)) return u;
    this.units.push(u); this.byId.set(u.id, u); u.level = this;
    const p = this.nav.nearest(u.pos.x, u.pos.z, 6, 0);
    if (p && u.kind !== 'boss') { u.pos.x = p.x; u.pos.z = p.z; }
    u.pos.y = this.heightAt(u.pos.x, u.pos.z);
    this.emit('spawn', { unit: u });
    return u;
  }
  remove(u) {
    const i = this.units.indexOf(u); if (i < 0) return;
    this.units.splice(i, 1); this.byId.delete(u.id);
    this.emit('despawn', { unit: u });
  }
  /** units whose centre is within r (+ their radius) of (x, z). all = ignore the hash (global shapes). */
  query(x, z, r, all = false) {
    if (all) return this.units;
    const c = this.hashCell, out = [], qid = this._qid = (this._qid || 0) + 1;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.hash.get(i * 73856093 ^ j * 19349663); if (!a) continue;
      for (const u of a) {
        if (u._qid === qid) continue;          // big units live in several cells: report each once
        u._qid = qid;
        const dx = u.pos.x - x, dz = u.pos.z - z, rr = r + u.radius; if (dx * dx + dz * dz <= rr * rr) out.push(u);
      }
    }
    return out;
  }
  rebuildHash() {
    this.hash.clear(); const c = this.hashCell;
    for (const u of this.units) {
      if (u.dead && u.kind !== 'hero') continue;
      // big units occupy several cells
      const r = u.radius, i0 = Math.floor((u.pos.x - r) / c), i1 = Math.floor((u.pos.x + r) / c), j0 = Math.floor((u.pos.z - r) / c), j1 = Math.floor((u.pos.z + r) / c);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * 73856093 ^ j * 19349663; let a = this.hash.get(k); if (!a) this.hash.set(k, a = []); a.push(u); }
    }
  }
  enemiesOf(u, x = u.pos.x, z = u.pos.z, r = 30) { return this.query(x, z, r).filter(o => !o.dead && !o.untargetable && o.team !== u.team && o.team !== 2); }
  alliesOf(u, x = u.pos.x, z = u.pos.z, r = 30) { return this.query(x, z, r).filter(o => !o.dead && o.team === u.team && o.kind === 'hero'); }
  nearestEnemy(u, r = 30) { let best = null, bd = Infinity; for (const o of this.enemiesOf(u, u.pos.x, u.pos.z, r)) { const d = u.distTo(o); if (d < bd) { bd = d; best = o; } } return best; }

  // ---------------------------------------------------------------- time
  after(t, fn) { const tm = { at: this.time + t, fn }; this.timers.push(tm); return tm; }
  every(t, fn, first = t) { const tm = { at: this.time + first, fn, every: t }; this.timers.push(tm); return tm; }
  cancelTimer(tm) { const i = this.timers.indexOf(tm); if (i >= 0) this.timers.splice(i, 1); }
  /** await-able wait on the level clock; rejects with CANCEL when owner.scriptToken changes (boss interrupted). */
  wait(t, owner = null) {
    return new Promise((resolve, reject) => this.waits.push({ at: this.time + t, resolve, reject, owner, token: owner?.scriptToken }));
  }
  cancelScripts(owner) { owner.scriptToken = (owner.scriptToken || 0) + 1; }

  // ---------------------------------------------------------------- projectiles & ground zones
  /** p: { src, x, z, y, dx, dz, speed, range, radius, pierce, hit, homing (unit), kind, color, onHit, onEnd, ctx, arc } */
  projectile(p) {
    p.t = 0; p.travel = 0; p.alive = true; p.hitSet = new Set(); p.y = p.y ?? 1.1; p.ctx = { ...(p.ctx || {}), proj: true };
    this.projectiles.push(p); this.emit('projectile', p); return p;
  }
  /** z: { src, x, z, r, dur, tick, hit, first (delay before first tick), shape, team, kind, onTick, onEnd, follow (unit) } */
  groundZone(z) {
    z.t = 0; z.next = z.first ?? 0; z.alive = true; z.hitSet = new Set(); z.ctx = { ...(z.ctx || {}), zone: true };
    this.zones.push(z); this.emit('zone', z); return z;
  }
  /** Telegraph record so AI can dodge and presentation can draw. tg: { shape, x, z, dx, dz, r, inner, angle, len, width, dur, color, owner } */
  telegraph(tg) {
    tg.t = 0; tg.alive = true; this.telegraphs.push(tg); this.emit('telegraph', tg); return tg;
  }
  /** Is point (x,z) inside any active dangerous telegraph? returns seconds until the soonest detonation or -1. */
  danger(x, z, r = 0.5, team = 0) {
    let soon = -1;
    const probe = { pos: { x, z }, radius: r };
    for (const tg of this.telegraphs) {
      if (!tg.alive || tg.safe || tg.team === team) continue;
      if (inShape(tg, tg.x, tg.z, tg.dx || 0, tg.dz || -1, probe)) { const left = tg.dur - tg.t; if (soon < 0 || left < soon) soon = left; }
    }
    // lingering hostile ground zones (lava pools, ink, quicksand…) count as danger at their next tick
    for (const zn of this.zones) {
      if (!zn.alive || zn.safe || !(zn.hit || zn.onTick)) continue;
      const zt = zn.team ?? zn.src?.team; if (zt === team) continue;
      const dx = x - zn.x, dz = z - zn.z, rr = (zn.r || 0) + r;
      if (dx * dx + dz * dz <= rr * rr) { const left = Math.max(0, (zn.next ?? 0) - zn.t); if (soon < 0 || left < soon) soon = left; }
    }
    return soon;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.paused) return;
    this.time += dt; this.frame++;
    this.rebuildHash();
    // timers & waits
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if (this.time >= tm.at) { if (tm.every) tm.at += tm.every; else this.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error('[timer]', e); } }
    }
    for (let i = this.waits.length - 1; i >= 0; i--) {
      const w = this.waits[i];
      if (w.owner && w.owner.scriptToken !== w.token) { this.waits.splice(i, 1); w.reject(CANCEL); continue; }
      if (this.time >= w.at) { this.waits.splice(i, 1); w.resolve(); }
    }
    const units = this.units;
    // controllers
    for (const u of units) if (!u.dead && u.ctrl) u.ctrl.update?.(dt, this);
    // skills + movement
    for (const u of units) this.stepUnit(u, dt);
    this.separate();
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.alive) { this.projectiles.splice(i, 1); continue; }
      this.stepProjectile(p, dt);
      if (!p.alive) { this.projectiles.splice(i, 1); this.emit('projectileEnd', p); }
    }
    // ground zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.follow) { z.x = z.follow.pos.x; z.z = z.follow.pos.z; }
      if (z.alive && z.t >= z.next && (z.tick || z.next === 0 || z.first !== undefined)) {
        z.next = z.tick ? z.next + z.tick : Infinity;
        if (z.hit && z.src && !z.src.dead) resolveHit(this, z.src, { shape: z.shape || 'circle', r: z.r, ...z.hit, team: z.team || z.hit.team }, z.x, z.z, z.dx || 0, z.dz || -1, z.ctx || {});
        z.onTick?.(z, this);
      }
      if (z.t >= z.dur || !z.alive) { z.alive = false; this.zones.splice(i, 1); z.onEnd?.(z, this); this.emit('zoneEnd', z); }
    }
    // telegraphs
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i]; tg.t += dt;
      if (tg.follow) { tg.x = tg.follow.pos.x; tg.z = tg.follow.pos.z; }
      if (tg.t >= tg.dur || !tg.alive) { tg.alive = false; this.telegraphs.splice(i, 1); this.emit('telegraphEnd', tg); }
    }
    // statuses, regen, deaths
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.dead) {
        u.deadT += dt;
        if (u.kind !== 'hero' && u.deadT > (u.data.corpseTime ?? 4)) this.remove(u);
        continue;
      }
      tickStatuses(this, u, dt);
      const e = eff(u);
      if (u.mpMax > 0) u.mp = Math.min(u.mpMax, u.mp + e.mpRegen * dt);
      if (u.combatT > 0) u.combatT -= dt;
      for (const [k, v] of u.cd) { const nv = v - dt * (u.cdRate || 1); if (nv <= 0) u.cd.delete(k); else u.cd.set(k, nv); }
    }
  }

  stepUnit(u, dt) {
    if (u.dead) { u.anim.speed = 0; return; }
    if (u.puppet) {           // co-op mirror: the network places it; only replayed skills advance here
      u.udt = dt;
      if (u.skill) { u.skill.update(dt * (u.skill.speedMul || 1)); if (u.skill.done) u.skill = null; }
      return;
    }
    const e = eff(u);
    let udt = dt;
    if (u.hitstop > 0) { u.hitstop -= dt; udt = dt * 0.06; }
    u.udt = udt;
    let vx = 0, vz = 0;
    if (u.skill) {
      if (u.disabled && u.superArmor < 2) { u.skill.cancel?.('cc'); u.skill = null; }
      else {
        u.skill.update(udt * (u.skill.speedMul || 1));
        if (u.skill && u.skill.done) u.skill = null;
      }
    }
    if (u.kb.t > 0) { vx = u.kb.x; vz = u.kb.z; u.kb.t -= dt; const k = Math.max(0, u.kb.t / 0.28); vx *= 0.4 + k * 0.6; vz *= 0.4 + k * 0.6; }
    else if (u.skill?.vel) { vx = u.skill.vel.x; vz = u.skill.vel.z; }
    else if (u.cc.fear > 0 && u.data.fearFrom) { const dx = u.pos.x - u.data.fearFrom.x, dz = u.pos.z - u.data.fearFrom.z, d = Math.hypot(dx, dz) || 1; vx = dx / d * 3; vz = dz / d * 3; }
    else if (!u.disabled && !u.skill) { vx = u.move.x * e.moveSpd; vz = u.move.z * e.moveSpd; }
    if (u.data.rooted) { vx = vz = 0; }
    const sp = Math.hypot(vx, vz);
    if (sp > 0.01) {
      const r = u.kind === 'boss' ? Math.min(u.radius, 1.5) : u.radius * 0.6;
      const res = this.nav.move(u.pos.x, u.pos.z, vx * dt, vz * dt, u.data.ghostWalk ? 0 : r);
      u.pos.x = res.x; u.pos.z = res.z; u.blocked = res.hit;
      if (!u.skill && !(u.kb.t > 0) && u.cc.fear <= 0 && !u.data.noAutoFace) {
        const target = Math.atan2(-vx, -vz);
        let d = target - u.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        const turn = Math.min(Math.abs(d), (u.turnRate || 16) * dt) * Math.sign(d);
        u.facing += turn; u.anim.turn = turn / dt;
      }
    } else u.blocked = false;
    // along-facing speed for locomotion animation
    u.anim.speed = u.kb.t > 0 || u.skill?.vel ? 0 : sp;
    // airborne (launch)
    if (u.air.y > 0 || u.air.vy > 0) {
      u.air.vy -= 26 * dt; u.air.y += u.air.vy * dt;
      if (u.air.y <= 0) { u.air.y = 0; u.air.vy = 0; if (u.air.launched) { u.air.launched = false; this.emit('land', { unit: u }); } }
    }
    u.pos.y = this.heightAt(u.pos.x, u.pos.z) + u.air.y + u.lift + (u.data.hover || 0);
  }

  /** soft circle separation: heroes pass through each other; bosses do not move */
  separate() {
    const us = this.units;
    for (const a of us) {
      if (a.dead || a.data.ghostWalk || a.puppet) continue;
      for (const b of this.query(a.pos.x, a.pos.z, a.radius + 2)) {
        if (b === a || b.dead || b.id < a.id || b.data.ghostWalk || b.puppet) continue;
        if (a.kind === 'hero' && b.kind === 'hero') continue;
        if ((a.kind === 'npc' || b.kind === 'npc')) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d >= min || d < 1e-4) continue;
        const push = (min - d);
        const ma = a.kind === 'boss' ? 1e6 : a.mass, mb = b.kind === 'boss' ? 1e6 : b.mass, t = ma + mb;
        const nx = dx / d, nz = dz / d;
        const fa = mb / t, fb = ma / t;
        if (fa > 1e-4) { const r = this.nav.move(a.pos.x, a.pos.z, -nx * push * fa, -nz * push * fa, a.radius * 0.5); a.pos.x = r.x; a.pos.z = r.z; }
        if (fb > 1e-4) { const r = this.nav.move(b.pos.x, b.pos.z, nx * push * fb, nz * push * fb, b.radius * 0.5); b.pos.x = r.x; b.pos.z = r.z; }
      }
    }
  }

  stepProjectile(p, dt) {
    p.t += dt;
    if (p.homing && !p.homing.dead) {
      const dx = p.homing.pos.x - p.x, dz = p.homing.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.min(1, dt * (p.turn || 6));
      p.dx += (dx / d - p.dx) * k; p.dz += (dz / d - p.dz) * k; const n = Math.hypot(p.dx, p.dz) || 1; p.dx /= n; p.dz /= n;
    }
    const step = p.speed * dt;
    p.x += p.dx * step; p.z += p.dz * step; p.travel += step;
    if (p.arc) p.y = 1.1 + Math.sin(Math.min(1, p.travel / p.range) * Math.PI) * p.arc;
    if (p.src && !p.noHit) {
      const r = p.radius || 0.6;
      for (const u of this.query(p.x, p.z, r + 1.5)) {
        if (u.dead || u.untargetable || p.hitSet.has(u.id)) continue;
        if (p.ctx?.only && u !== p.ctx.only) continue;
        if (u.remote && p.src.team !== u.team) continue;
        const enemy = u.team !== p.src.team && u.team !== 2;
        if (p.team === 'ally' ? enemy : !enemy) continue;
        const dx = u.pos.x - p.x, dz = u.pos.z - p.z;
        if (dx * dx + dz * dz > (r + u.radius) ** 2) continue;
        p.hitSet.add(u.id);
        if (p.hit) {
          const h = p.hit.shape ? p.hit : { ...p.hit, shape: 'circle', r: p.hit.r || 0.1 };
          if (h.shape === 'circle' && (h.r || 0) <= 0.2) {
            // single-target projectile hit
            resolveHit(this, p.src, { ...h, shape: 'circle', r: 0.05, maxTargets: 1 }, u.pos.x, u.pos.z, p.dx, p.dz, p.ctx);
          } else resolveHit(this, p.src, h, p.x, p.z, p.dx, p.dz, p.ctx);
        }
        p.onHit?.(u, p, this);
        if (!p.pierce || p.hitSet.size > p.pierce) { p.alive = false; break; }
      }
    }
    if (p.alive && !this.nav.ok(p.x, p.z) && !p.flies) { p.alive = false; }
    if (p.travel >= p.range) { p.alive = false; p.atEnd = true; }
    if (!p.alive) p.onEnd?.(p, this);
  }
}
