// Mob brains: acquire the nearest hero, chase (straight line, or A* when a wall is in the way), keep ranged distance,
// and attack with windup-telegraphed moves from the template. Hits during a windup interrupt non-armoured mobs.
import { Unit } from '../unit.js';
import { SkillRun } from '../skills/runner.js';
import { MOBS } from '../../data/mobs.js';

/** Reference numbers for a content level (hero attack power / hero HP at that point in progression). */
export function refFor(lvOrIlvl) {
  if (lvOrIlvl > 100) { // item level (endgame)
    const t = (lvOrIlvl - 1100) / 500;
    return { ap: 21000 + t * 22000, hp: 140000 + t * 110000, ilvl: lvOrIlvl };
  }
  const lv = lvOrIlvl;
  return { ap: 700 + 380 * lv, hp: 3200 + 2600 * lv, level: lv };
}

export function makeMob(type, o = {}) {
  const tpl = MOBS[type]; if (!tpl) throw new Error('no mob ' + type);
  const ref = o.ref || refFor(o.level || 10);
  const elite = o.elite ?? tpl.elite ?? false;
  const hpMul = (o.hpMul ?? 1) * (elite && !tpl.elite ? 4 : 1);
  const u = new Unit({
    kind: 'mob', team: 1, type, name: o.name || tpl.name, level: o.level || ref.level || 50,
    x: o.x, z: o.z, facing: o.facing ?? Math.random() * 6.28, radius: tpl.radius * (o.scale || 1), height: tpl.height * (o.scale || 1), mass: tpl.mass,
    stats: { hpMax: Math.round(tpl.hp * ref.ap * hpMul), atk: tpl.atk * ref.hp / 0.55 * (o.atkMul ?? 1), def: 3000, speed: tpl.speed, mpMax: 0, mpRegen: 0, crit: 0.05 },
    superArmor: tpl.superArmor || 0,
  });
  u.data.elite = elite; u.data.tpl = tpl; u.data.xp = tpl.xp * (elite ? 3 : 1); u.data.scale = o.scale || 1;
  if (tpl.poise) u.data.poise = tpl.poise;
  u.ctrl = new MobAI(u, tpl, o);
  return u;
}

export class MobAI {
  constructor(u, tpl, o = {}) {
    this.u = u; this.tpl = tpl; this.target = null; this.retarget = 0;
    this.home = { x: u.pos.x, z: u.pos.z }; this.path = null; this.pathT = 0;
    this.cds = new Map(); this.side = Math.random() < 0.5 ? -1 : 1; this.wander = 0;
    this.aggro = o.aggro ?? tpl.aggro; this.alert = !!o.alert; // alert = hunt the nearest hero anywhere (dungeon waves)
    this.delay = o.delay ?? Math.random() * 0.4;
  }
  update(dt, L) {
    const u = this.u, tpl = this.tpl;
    for (const [k, v] of this.cds) { if (v - dt <= 0) this.cds.delete(k); else this.cds.set(k, v - dt); }
    u.move.x = u.move.z = 0;
    if (this.delay > 0) { this.delay -= dt; return; }
    if (u.disabled) return;
    if (u.data.flinchT > 0) {
      u.data.flinchT -= dt;
      if (u.skill && !u.superArmor && u.skill.t < (u.skill.def.windup || 0.5) * 0.9) { u.skill.cancel('flinch'); u.skill = null; }
      return;
    }
    if (u.data.poise != null && u.data.poise <= 0) { u.data.poise = tpl.poise; u.cc.down = 1.2; u.skill?.cancel('poise'); u.skill = null; L.emit('knock', { tgt: u, knock: 'down' }); return; }
    if (u.skill) return;
    this.retarget -= dt;
    if (!this.target || this.target.dead || this.retarget <= 0) {
      this.retarget = 0.8 + Math.random() * 0.4;
      const range = this.alert ? 60 : this.aggro;
      let best = null, bd = Infinity;
      for (const h of L.query(u.pos.x, u.pos.z, range)) {
        if (h.dead || h.team === u.team || h.team === 2 || h.untargetable || h.kind === 'npc') continue;
        const d = u.distTo(h) * (h === this.target ? 0.8 : 1);
        if (d < bd) { bd = d; best = h; }
      }
      if (!best && u.lastHitBy && !u.lastHitBy.dead) best = u.lastHitBy;
      if (!best && this.target && !this.target.dead && u.distTo(this.target) < range * 1.6) best = this.target;
      this.target = best;
    }
    const t = this.target;
    if (!t) { this.idle(dt, L); return; }
    const gap = u.gap(t);
    for (const a of tpl.attacks) {
      if (this.cds.has(a.id)) continue;
      if (gap > a.range || gap < (a.minRange || 0)) continue;
      if (a.proj && !L.nav.los(u.pos.x, u.pos.z, t.pos.x, t.pos.z)) continue;
      this.attack(a, t, L); return;
    }
    // movement
    const want = tpl.ranged ? tpl.ranged : Math.max(0.3, (tpl.attacks[0]?.range || 1.5) * 0.7);
    let mx = 0, mz = 0;
    const dx = t.pos.x - u.pos.x, dz = t.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
    if (gap > want) {
      if (L.nav.los(u.pos.x, u.pos.z, t.pos.x, t.pos.z, u.radius * 0.5)) { mx = dx / d; mz = dz / d; this.path = null; }
      else {
        this.pathT -= dt;
        if (!this.path || this.pathT <= 0) { this.path = L.nav.path(u.pos.x, u.pos.z, t.pos.x, t.pos.z, u.radius * 0.5, 6000); this.pathT = 0.7; }
        const p = this.path?.[0];
        if (p) { const px = p.x - u.pos.x, pz = p.z - u.pos.z, pd = Math.hypot(px, pz); if (pd < 0.6) this.path.shift(); else { mx = px / pd; mz = pz / pd; } }
      }
      // spread out around the target so hordes surround instead of stacking
      mx += -dz / d * this.side * 0.25; mz += dx / d * this.side * 0.25;
    } else if (tpl.ranged && gap < want * 0.45) { mx = -dx / d; mz = -dz / d; }
    else { u.faceTo(t.pos.x, t.pos.z); }
    const n = Math.hypot(mx, mz);
    if (n > 0) { u.move.x = mx / n * u.st.speed; u.move.z = mz / n * u.st.speed; }
  }
  idle(dt, L) {
    const u = this.u;
    this.wander -= dt;
    if (this.wander <= 0) { this.wander = 2 + Math.random() * 4; this.wx = this.home.x + (Math.random() - 0.5) * 6; this.wz = this.home.z + (Math.random() - 0.5) * 6; }
    const dx = this.wx - u.pos.x, dz = this.wz - u.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5 && this.wander > 1.2) { u.move.x = dx / d * u.st.speed * 0.3; u.move.z = dz / d * u.st.speed * 0.3; }
  }
  attack(a, t, L) {
    const u = this.u;
    u.faceTo(t.pos.x, t.pos.z);
    const hitSpec = { ...a.hit };
    const at = a.atTarget ? 'point' : undefined;
    const events = [{ t: 0, a: 'anim', name: a.anim, dur: a.dur }];
    if (a.tele) events.push({ t: 0, a: 'tele', ...hitSpec, at, dur: a.windup, color: u.data.elite ? 'orange' : 'red' });
    if (a.lunge) events.push({ t: a.windup * 0.6, a: 'move', kind: 'toAim', dist: a.lunge, dur: a.windup * 0.4, stopShort: 1 });
    if (a.proj) events.push({ t: a.windup, a: 'proj', ...a.proj, y: u.height * 0.6 });
    else events.push({ t: a.windup, a: 'hit', ...hitSpec, at });
    events.push({ t: a.windup, a: 'sfx', name: a.sfx || 'monster_hit' });
    const def = { id: a.id, type: 'normal', dur: a.dur, windup: a.windup, range: a.atTarget ? a.range + 2 : 30, fixedSpeed: true, events };
    u.skill = new SkillRun(L, u, def, { aimX: t.pos.x, aimZ: t.pos.z }, { kind: 'mob' });
    this.cds.set(a.id, a.cd * (0.85 + Math.random() * 0.3));
    // everyone else waits a moment so a pack doesn't hit in perfect sync
  }
}
