// Skill runtime. A skill definition is data: a type (normal/combo/chain/holding/charge/casting/point), a timeline of
// events, and optional stages/loops. SkillRun executes one cast on a unit, honouring attack speed, hit-stop,
// super armor, dash-cancel windows, and key press/hold/release semantics.
//
// Timeline event (`ev`) kinds (field `a`):
//   anim   { name, dur }                       hero/creature animation
//   hit    { ...hitSpec }                       resolveHit at the caster (or at: 'aim'/'point')
//   move   { kind: 'dash'|'leap'|'blink'|'back'|'toAim', dist, dur, height, to }
//   proj   { speed, range, radius, pierce, count, spread, kind, hit, homing, arc, at }
//   zone   { r, dur, tick, hit, at, first, kind }
//   buff   { target: 'self'|'party', id, dur, mods, name, shield, heal, r }
//   fx     { preset, at, ...params }   sfx { name }   shake { v }   call { fn(run) }
import { resolveHit, applyStatus, addShield, heal, eff } from '../combat.js';
import { facingOf } from '../../core/util.js';

export class SkillRun {
  /**
   * @param level   Level
   * @param unit    caster
   * @param def     skill definition (after tripods applied)
   * @param input   { aimX, aimZ, key } — aim point on the ground
   * @param opts    { level: skill level, mult, kind, onEnd }
   */
  constructor(level, unit, def, input, opts = {}) {
    this.level = level; this.u = unit; this.def = def; this.opts = opts;
    this.t = 0; this.done = false; this.stage = 0; this.fired = 0;
    this.kind = opts.kind || def.kind || 'skill';
    this.mult = (opts.mult ?? 1) * (def.mult ?? 1);
    this.hitSet = new Set();
    this.held = true; this.charge = 0; this.chargeDone = false; this.queued = false;
    this.superArmor = def.superArmor === 'full' ? 2 : def.superArmor === 'push' ? 1 : 0;
    this.vel = null;
    const e = eff(unit);
    this.speedMul = def.fixedSpeed ? 1 : e.atkSpd;
    this.setAim(input.aimX, input.aimZ);
    unit.facing = this.facing;
    this.timeline = def.stages ? def.stages[0].events : def.events || [];
    this.len = def.stages ? def.stages[0].dur : def.dur ?? 0.6;
    this.cancelAt = def.cancelAt ?? this.len * 0.6;
    this.moveState = null;
    if (def.type === 'casting') { this.casting = def.cast || 1; this.castLeft = this.casting; }
    level.emit('skillStart', { unit, def, run: this });
    if (def.onStart) def.onStart(this);
  }
  setAim(x, z) {
    const u = this.u, def = this.def;
    let dx = x - u.pos.x, dz = z - u.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = u.fx; dz = u.fz; } else { dx /= d; dz /= d; }
    this.dx = dx; this.dz = dz; this.facing = facingOf(dx, dz);
    const range = def.range ?? 12;
    const pd = Math.min(d, range);
    this.px = u.pos.x + dx * pd; this.pz = u.pos.z + dz * pd;   // clamped point target
    this.aimX = x; this.aimZ = z;
  }
  get ctx() { return { skill: this.def.id, kind: this.kind, mult: this.mult, hitSet: this.hitSet, stype: this.def.type, exec: this.def.executeBonus, dom: this.def.domBonus }; }
  /** key released (holding / charge skills) */
  release() {
    if (!this.held) return;
    this.held = false;
    const def = this.def;
    if (def.type === 'charge' && !this.chargeDone) this.fireCharge();
    if (def.type === 'holding') this.endHold();
  }
  /** key pressed again (combo / chain) */
  press() { if (this.def.type === 'combo' || this.def.stages) this.queued = true; }
  cancel(why) {
    if (this.done) return;
    this.done = true; this.vel = null; this.u.lift = 0;
    this.u.model?.stop?.();
    this.level.emit('skillEnd', { unit: this.u, def: this.def, run: this, why });
    this.opts.onEnd?.(this, why);
  }
  canDashCancel() { return this.t >= this.cancelAt || this.def.type === 'holding' || this.def.type === 'charge'; }

  update(dt) {
    if (this.done) return;
    const def = this.def, u = this.u;
    // casting: fill the cast bar first
    if (this.castLeft > 0) { this.castLeft -= dt; this.level.emit('castProgress', { unit: u, run: this, pct: 1 - this.castLeft / this.casting }); if (this.castLeft > 0) return; }
    // charging: hold until release or max
    if (def.type === 'charge' && !this.chargeDone) {
      this.charge = Math.min(1, this.charge + dt / (def.chargeTime || 1));
      if (def.turnWhileHeld && u.ctrl?.aim) { this.setAim(u.ctrl.aim.x, u.ctrl.aim.z); u.facing = this.facing; }
      this.level.emit('charge', { unit: u, run: this, pct: this.charge });
      if (this.charge >= 1 && (!this.held || def.autoRelease !== false)) this.fireCharge();
      if (this.charge >= 1 && this.held && def.autoRelease === false) this.fireCharge();
      if (!this.chargeDone) return;
    }
    this.t += dt;
    // holding: play the opening timeline (animation, FX), then loop while held
    if (def.type === 'holding' && this.held && def.loop) {
      if (this.idx === undefined) this.idx = 0;
      const tl0 = this.timeline;
      while (this.idx < tl0.length && tl0[this.idx].t <= this.t) this.exec(tl0[this.idx++]);
      if (def.turnWhileHeld !== false && u.ctrl?.aim) { this.setAim(u.ctrl.aim.x, u.ctrl.aim.z); u.facing = this.facing; }
      const L = def.loop;
      if (L.walk && u.ctrl?.aim) {
        const dx = u.ctrl.aim.x - u.pos.x, dz = u.ctrl.aim.z - u.pos.z, d = Math.hypot(dx, dz);
        this.vel = d > 0.6 ? { x: dx / d * L.walk * eff(u).moveSpd, z: dz / d * L.walk * eff(u).moveSpd } : null;
      }
      this.loopT = (this.loopT ?? (L.first ?? 0)) - dt;
      if (this.loopT <= 0) {
        this.loopT += L.every;
        this.hitSet.clear();
        for (const ev of L.events) this.exec(ev);
        this.fired++;
      }
      if (this.t >= (def.holdMax || 3)) this.endHold();
      return;
    }
    // timeline
    const tl = this.timeline;
    if (this.idx === undefined) this.idx = 0;
    while (this.idx < tl.length && tl[this.idx].t <= this.t) this.exec(tl[this.idx++]);
    this.updateMove(dt);
    // combo / chain stage advance
    if (def.stages && this.stage < def.stages.length - 1) {
      const st = def.stages[this.stage];
      const winOpen = this.t >= (st.window ?? st.dur * 0.45);
      if (this.queued && winOpen && this.idx >= tl.length) { this.nextStage(); return; }
      if (this.t >= st.dur && !this.queued) {
        if (def.type === 'chain') { this.waitChain = (this.waitChain ?? 0) + dt; if (this.waitChain < (def.chainWindow || 2.5)) { this.vel = null; this.idle = true; return; } }
        return this.finish();
      }
      if (this.t >= st.dur && this.queued) { this.nextStage(); return; }
      return;
    }
    if (this.t >= this.len && this.idx >= tl.length && !this.moveState) this.finish();
  }
  nextStage() {
    this.stage++; this.t = 0; this.idx = 0; this.queued = false; this.idle = false; this.waitChain = 0; this.hitSet.clear();
    const st = this.def.stages[this.stage];
    this.timeline = st.events; this.len = st.dur; this.cancelAt = st.cancelAt ?? st.dur * 0.6;
    if (this.u.ctrl?.aim) { this.setAim(this.u.ctrl.aim.x, this.u.ctrl.aim.z); this.u.facing = this.facing; }
    this.level.emit('skillStage', { unit: this.u, def: this.def, run: this, stage: this.stage });
  }
  endHold() {
    if (this.endedHold) return;
    this.endedHold = true; this.held = false; this.vel = null;
    const end = this.def.end || [];
    this.timeline = end; this.idx = 0; this.t = 0; this.len = this.def.endDur ?? (end.length ? Math.max(...end.map(e => e.t)) + 0.25 : 0.1);
    this.def = { ...this.def, type: 'normal', loop: null };
  }
  fireCharge() {
    this.chargeDone = true;
    const c = this.charge, def = this.def;
    const perfect = def.perfect && c >= def.perfect[0] && c <= def.perfect[1];
    this.mult *= (def.minCharge ?? 0.45) + (1 - (def.minCharge ?? 0.45)) * c;
    if (perfect) { this.mult *= def.perfectMul || 1.2; this.level.emit('perfect', { unit: this.u, run: this }); }
    this.perfect = perfect;
    this.t = 0; this.idx = 0;
  }
  finish() {
    if (this.done) return;
    this.done = true; this.vel = null;
    this.level.emit('skillEnd', { unit: this.u, def: this.def, run: this, why: 'done' });
    this.opts.onEnd?.(this, 'done');
  }
  where(at) {
    const u = this.u;
    if (at === 'point' || at === 'aim') return [this.px, this.pz];
    if (typeof at === 'number') return [u.pos.x + this.dx * at, u.pos.z + this.dz * at];
    return [u.pos.x, u.pos.z];
  }
  exec(ev) {
    const L = this.level, u = this.u;
    if (ev.if && !ev.if(this)) return;
    if (this.opts.visualOnly && !(ev.a === 'anim' || ev.a === 'fx' || ev.a === 'sfx' || (ev.a === 'shake' && this.opts.shake))) return;
    switch (ev.a) {
      case 'anim': u.model?.play?.(ev.name, { dur: (ev.dur ?? this.len) / this.speedMul, loop: ev.loop }); L.emit('anim', { unit: u, name: ev.name, dur: ev.dur }); break;
      case 'hit': {
        const [x, z] = this.where(ev.at);
        const dirX = ev.dirFrom === 'center' ? 0 : this.dx, dirZ = ev.dirFrom === 'center' ? -1 : this.dz;
        const res = resolveHit(L, u, ev, x, z, dirX, dirZ, this.ctx);
        L.emit('skillHit', { unit: u, run: this, ev, x, z, dx: this.dx, dz: this.dz, res });
        break;
      }
      case 'move': this.startMove(ev); break;
      case 'proj': {
        const n = ev.count || 1, spread = ev.spread || 0;
        const [x, z] = this.where(ev.at);
        for (let i = 0; i < n; i++) {
          const a = n > 1 ? (i / (n - 1) - 0.5) * spread : 0;
          const c = Math.cos(a), s = Math.sin(a);
          const dx = this.dx * c - this.dz * s, dz = this.dx * s + this.dz * c;
          const tgt = ev.homing ? L.nearestEnemy(u, ev.range || 14) : null;
          L.projectile({ src: u, x: x + dx * (ev.off || 0.8), z: z + dz * (ev.off || 0.8), y: ev.y ?? 1.2, dx, dz, speed: ev.speed || 24, range: ev.range || 14, radius: ev.radius || 0.6, pierce: ev.pierce, hit: ev.hit, homing: tgt, turn: ev.turn, kind: ev.kind, color: ev.color, arc: ev.arc, ctx: this.ctx, onEnd: ev.onEnd ? (p, lv) => ev.onEnd(p, lv, this) : null, team: ev.team });
        }
        break;
      }
      case 'zone': {
        const [x, z] = this.where(ev.at);
        L.groundZone({ src: u, x, z, dx: this.dx, dz: this.dz, r: ev.r, dur: ev.dur, tick: ev.tick, first: ev.first, hit: ev.hit, shape: ev.shape, kind: ev.kind, team: ev.team, follow: ev.follow ? u : null, ctx: { ...this.ctx, hitSet: null }, onTick: ev.onTick });
        break;
      }
      case 'buff': {
        const targets = ev.target === 'party' ? L.alliesOf(u, u.pos.x, u.pos.z, ev.r || 12) : [u];
        if (ev.target === 'party' && !targets.includes(u)) targets.push(u);
        for (const t of targets) {
          if (ev.id) applyStatus(L, t, ev.id, { dur: ev.dur, src: u, mods: ev.mods, name: ev.name, icon: ev.icon });
          if (ev.shield) addShield(L, u, t, ev.shield * eff(u).atk, ev.shieldDur || ev.dur || 5, ev.shieldId);
          if (ev.heal) heal(L, u, t, ev.healOf === 'max' ? t.hpMax * ev.heal : eff(u).atk * ev.heal);
        }
        L.emit('buffCast', { unit: u, ev, targets });
        break;
      }
      case 'fx': { const [x, z] = this.where(ev.at); L.emit('fx', { unit: u, run: this, preset: ev.preset, x, z, dx: this.dx, dz: this.dz, ev }); break; }
      case 'sfx': L.emit('sfx', { unit: u, name: ev.name, pos: u.pos }); break;
      case 'shake': L.emit('shake', { unit: u, v: ev.v }); break;
      case 'tele': { const [x, z] = this.where(ev.at); L.telegraph({ ...ev, x, z, dx: this.dx, dz: this.dz, team: u.team, owner: u }); break; }
      case 'call': ev.fn(this, L); break;
    }
  }
  startMove(ev) {
    const u = this.u;
    let dist = ev.dist ?? 4;
    if (ev.kind === 'toAim' || ev.kind === 'leap') dist = Math.min(Math.hypot(this.px - u.pos.x, this.pz - u.pos.z) - (ev.stopShort ?? 0.5), ev.dist ?? 12);
    if (ev.kind === 'blink') {
      const tx = ev.to === 'behind' ? this.behindTarget() : null;
      const nx = tx ? tx.x : u.pos.x + this.dx * dist, nz = tx ? tx.z : u.pos.z + this.dz * dist;
      const p = this.level.nav.nearest(nx, nz, 4, u.radius * 0.6);
      if (p) { u.pos.x = p.x; u.pos.z = p.z; }
      if (tx) { u.faceTo(tx.fx, tx.fz); this.setAim(tx.fx, tx.fz); }
      this.level.emit('blink', { unit: u });
      return;
    }
    const sign = ev.kind === 'back' ? -1 : 1;
    const dur = (ev.dur ?? 0.25);
    this.moveState = { left: dur, dur, vx: this.dx * sign * Math.max(0, dist) / dur, vz: this.dz * sign * Math.max(0, dist) / dur, height: ev.height || 0, t: 0 };
    if (ev.iframes) u.invuln = Math.max(u.invuln, ev.iframes);
    // dashes pass through enemies (bosses would otherwise block them); cleared on a level timer so a cancel can't strand it
    if (ev.kind === 'dash' || ev.kind === 'toAim' || ev.kind === 'leap') { u.data.ghostWalk = true; const L = this.level; clearTimeout(u._ghostTm); L.after(dur + 0.05, () => { if (!u.skill?.moveState) u.data.ghostWalk = false; }); }
  }
  behindTarget() {
    const t = this.level.nearestEnemy(this.u, 10); if (!t) return null;
    return { x: t.pos.x - t.fx * (t.radius + 1), z: t.pos.z - t.fz * (t.radius + 1), fx: t.pos.x, fz: t.pos.z };
  }
  updateMove(dt) {
    const m = this.moveState; if (!m) { if (!this.def.loop?.walk) this.vel = null; return; }
    m.left -= dt; m.t += dt;
    this.vel = { x: m.vx, z: m.vz };
    if (m.height) this.u.lift = Math.sin(Math.min(1, m.t / m.dur) * Math.PI) * m.height;
    if (m.left <= 0) { this.moveState = null; this.vel = null; this.u.lift = 0; }
  }
}
