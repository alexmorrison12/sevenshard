// Proving Grounds — 3v3 PvP in the Crucible: Team Deathmatch (first to 10 kills or 5 minutes, respawn after 5 s) and
// Elimination (best of five rounds, last team standing). Normalised stats (item level 1415, skills level 10, no
// engravings/gems/battle items, PvP damage and HP rules, Unstoppable after crowd control). Both teams are HeroKits;
// your teammates and the enemy team are driven by PvpAI (targets heroes, kites, focuses, opens with crowd control,
// punishes downed foes, stands up, dodges telegraphed skills, awakens for the kill). Kill feed, scoreboard, results,
// rating (Bronze → Grandmaster) in roster.pvp, Proving Tokens. Duels: session.bus 'duel' { unit } — a 1v1 in place
// against that AI adventurer (first below 10% HP loses, nobody dies).
import { registerPlugin, registerContent, registerService } from '../registry.js';
import { HeroKit } from '../hero.js';
import { simChar } from '../party.js';
import { makeSim } from '../social/names.js';
import { heroStats } from '../systems/stats.js';
import { applyStatus, removeStatus, eff } from '../combat.js';
import { reach } from '../ai/ally.js';
import { CLASSES } from '../../data/classes/index.js';
import { PVP, PVP_MODES, PVP_RANKS, START_RATING, PVP_AI, PVP_PERSONAS, PVP_REWARDS, ANNOUNCER, DUEL } from '../../data/pvp.js';
import { dayId } from '../../core/util.js';
import { RNG } from '../../core/noise.js';
import { iconUrl } from '../../ui/index.js';
import { S, loadInstance, normalChar, spawnLocal, RunParty, showResults, emitPvp, fmtTime, AUTO } from './inferno.js';

// ================================================================================================ ranks & records
export function rankOf(rating) {
  let i = 0; for (let k = 0; k < PVP_RANKS.length; k++) if (rating >= PVP_RANKS[k].min) i = k;
  const R = PVP_RANKS[i], next = PVP_RANKS[i + 1];
  if (!next) return { ...R, tier: i, div: 0, label: R.name, next: null };
  const span = next.min - R.min, div = 3 - Math.min(2, Math.floor((rating - R.min) / (span / 3)));
  return { ...R, tier: i, div, label: `${R.name} ${['', 'I', 'II', 'III'][div]}`, next: next.min };
}
/** roster.pvp = { rating, wins, losses, draws, streak, best, day, history, duels } */
export function pvpRecord(account) {
  const r = account.roster.pvp ||= {};
  r.rating ??= START_RATING; r.wins ??= 0; r.losses ??= 0; r.draws ??= 0; r.streak ??= 0; r.best ??= r.rating; r.history ||= []; r.duels ||= { wins: 0, losses: 0 };
  return r;
}

// ================================================================================================ normalised heroes
const GEAR6 = ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'];
/** a PvP copy of a character (or SimPlayer character): item level 1415, skills level 10, no engravings or gems */
export function pvpChar(c) {
  const n = normalChar(c, { ilvl: PVP.ilvl, skillLv: PVP.skillLv, engr: false });
  n.equip = Object.fromEntries(GEAR6.map(s => [s, { iLvl: PVP.ilvl, quality: 70 }]));
  return n;
}
export function pvpStats(c) {
  const st = heroStats({ ...c, books: [], engr: [], gems: [] }, { rosterLevel: 1 });
  st.hpMax = Math.round(st.hpMax * PVP.hpMul);
  st.healTaken = PVP.healTaken; st.shieldMul = PVP.shieldMul; st.mpRegen = PVP.mpRegen; st.crit = 0.15;
  delete st.onDamageMul; delete st.cheat; delete st.superArmor; delete st.tyrant; delete st.awakenUses;
  return st;
}
/** hero → hero damage in the Proving Grounds: scaled, big hits compressed, reduced while knocked down */
function pvpDamage(tgt, src, o) {
  if (!src || src.kind !== 'hero') return 1;
  let m = PVP.dmg;
  if (o.kind === 'awaken') m *= PVP.awaken; else if (o.kind === 'identity') m *= PVP.identity;
  const coef = o.hit?.coef;
  if (coef) {
    const d = o.kind === 'awaken' ? src.kit?.awaken : src.kit?.skills?.[o.skill];
    const ec = coef * (d?.mult || (o.kind === 'identity' ? 1 : 2));
    if (ec > PVP.coefCap) m *= PVP.coefCap / ec;
  }
  if (tgt.cc.down > 0 || tgt.air.launched) m *= 0.6;
  return m;
}
/** apply the PvP rules to a hero unit */
function pvpRules(u) {
  u.data.dmgTakenFn = (src, o) => pvpDamage(u, src, o);
  u.data.hitBy = new Map();
  u.data.pvp = true;
}
/** Unstoppable after crowd control ends (call per frame for every PvP hero) */
function ccImmunity(L, u) {
  if (u.dead) { u.data.ccWas = false; return; }
  const cc = u.cc.down > 0 || u.air.launched || u.cc.stun > 0 || u.cc.freeze > 0 || u.cc.fear > 0 || u.cc.sleep > 0;
  if (u.data.ccWas && !cc) applyStatus(L, u, 'super_armor', { dur: PVP.ccImmune, name: 'Unstoppable', icon: 'status:super_armor', src: u });
  u.data.ccWas = cc;
}

// ================================================================================================ PvP brain
const INFO = new WeakMap();
const CC_STATUS = new Set(['stun', 'freeze', 'fear', 'sleep']);
/** what a skill does, for the AI: reach, crowd control, gap-closing distance, total damage coefficient, support */
export function skillInfo(def) {
  let i = INFO.get(def); if (i) return i;
  let cc = false, gap = 0, dmg = 0, ally = false, heal = false, shield = false, buff = false;
  const scan = (l, mul = 1) => {
    for (const e of l || []) {
      if (e.a === 'hit') {
        if (e.team === 'ally') { ally = true; if (e.heal) heal = true; if (e.shield) shield = true; if (e.buff) buff = true; }
        else { dmg += (e.coef || 0) * mul; if (e.knock && e.knock !== 'push') cc = true; if (e.status?.some(s => CC_STATUS.has(s.id))) cc = true; }
      }
      if (e.a === 'proj' && e.hit) { dmg += (e.hit.coef || 0) * (e.count || 1) * mul; if (e.hit.knock && e.hit.knock !== 'push') cc = true; if (e.hit.status?.some(s => CC_STATUS.has(s.id))) cc = true; }
      if (e.a === 'zone' && e.hit) { if (e.team === 'ally') { ally = true; if (e.hit.heal) heal = true; } else dmg += (e.hit.coef || 0) * Math.min(6, (e.dur || 1) / (e.tick || 1)) * mul * 0.6; }
      if (e.a === 'move' && ['dash', 'toAim', 'leap', 'blink'].includes(e.kind) && (e.dist || 0) >= 3.5) gap = Math.max(gap, e.dist);
      if (e.a === 'buff') { ally = true; buff = true; if (e.heal) heal = true; if (e.shield) shield = true; }
    }
  };
  scan(def.events); scan(def.end);
  if (def.loop) scan(def.loop.events, Math.min(10, (def.holdMax || 2) / (def.loop.every || 0.3)));
  for (const s of def.stages || []) scan(s.events);
  i = { cc, gap, dmg: dmg * (def.mult || 1), ally, heal, shield, buff, reach: reach(def), support: ally && dmg < 4 };
  INFO.set(def, i);
  return i;
}
const RANGED = new Set(['pistoleer', 'starcaller', 'songweaver']);

export class PvpAI {
  /** ctx: { active(), foes(u), allies(u), focus(team), center() } */
  constructor(kit, ctx, persona = 'veteran') {
    this.kit = kit; this.u = kit.u; this.ctx = ctx;
    this.persona = PVP_PERSONAS[persona] ? persona : 'veteran'; this.p = PVP_PERSONAS[this.persona];
    this.aim = { x: this.u.pos.x, z: this.u.pos.z - 3 };
    this.support = kit.cls.role === 'support'; this.ranged = RANGED.has(kit.cls.id);
    this.want = this.ranged ? 7 : this.support ? 4.2 : 1.2;
    this.think = Math.random() * 0.3; this.retT = 0; this.downT = 0; this.wake = this.p.wake;
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0; this.combo = []; this.holding = null; this.threat = null; this.stuckT = 0; this.path = null; this.side = null;
    this.u.ctrl = this;
  }
  update(dt, L) {
    const kit = this.kit, u = this.u;
    kit.update(dt);
    u.move.x = u.move.z = 0;
    if (u.dead) { this.holding = null; this.combo.length = 0; return; }
    for (let i = this.combo.length - 1; i >= 0; i--) if (L.time >= this.combo[i].at) { kit.press(this.combo[i].slot, this.aim); this.combo.splice(i, 1); }
    if (!this.ctx.active()) { const f = this.nearestFoe(); if (f) u.faceTo(f.pos.x, f.pos.z); return; }
    // knocked down: Space to stand up after a (persona) beat
    if (u.cc.down > 0 || u.air.launched) {
      this.downT += dt;
      if (this.downT > this.wake && kit.standCd <= 0) { const t = this.target || this.nearestFoe(); kit.dash(t ? this.away(t, 4) : this.aim); this.downT = 0; this.wake = this.p.wake * (0.5 + Math.random()); }
      return;
    }
    this.downT = 0;
    if (u.disabled) return;
    if (this.holding != null) { this.holdT -= dt; if (this.target) { this.aim.x = this.target.pos.x; this.aim.z = this.target.pos.z; } if (this.holdT <= 0 || !u.skill) { kit.release(this.holding); this.holding = null; } }
    this.retT -= dt;
    if (!this.target || this.target.dead || this.retT <= 0) { this.target = this.pickTarget(); this.retT = 0.45 + Math.random() * 0.4; }
    const t = this.target;
    if (t) { const lead = this.ranged ? 0.22 : 0.08; this.aim.x = t.pos.x + (t.move.x || 0) * lead; this.aim.z = t.pos.z + (t.move.z || 0) * lead; }
    // dodge a telegraphed enemy skill (after reacting)
    if (this.threat && L.time >= this.threat.at) { const th = this.threat; this.threat = null; if (L.time - th.at < 0.4 && this.dodge(L, th)) return; }
    if (this.side && L.time < this.side.until && !u.skill) { this.goTo(L, this.side.x, this.side.z, 0.3); return; }
    if (u.skill) return;
    this.think -= dt;
    if (this.think > 0) { this.move(L, t, dt); return; }
    this.think = 0.06 + this.p.react * 0.2;
    if (!t) { this.move(L, null, dt); return; }
    if (this.support && this.supportTurn(L)) return;
    if (this.offense(L, t)) return;
    this.move(L, t, dt);
  }
  nearestFoe() { let best = null, bd = Infinity; for (const f of this.ctx.foes(this.u)) { const d = this.u.distTo(f); if (d < bd) { bd = d; best = f; } } return best; }
  pickTarget() {
    const u = this.u, focus = this.ctx.focus(u.team);
    let best = null, bs = Infinity;
    for (const f of this.ctx.foes(u)) {
      if (f.dead || f.untargetable) continue;
      let s = u.distTo(f) + (f.hp / f.hpMax) * 9;
      if (f === focus) s -= 6 * this.p.focus;
      if (f.cc.down > 0 || f.cc.stun > 0 || f.air.launched) s -= 2.5;
      if (f.invuln > 0) s += 8;
      if (f === this.target) s -= 2;
      if (s < bs) { bs = s; best = f; }
    }
    return best;
  }
  /** the caster → me threat from a starting enemy skill; dodge after reacting */
  notice(L, caster, def) {
    const u = this.u; if (u.dead || this.threat) return;
    const I = skillInfo(def);
    if (!(I.cc || I.dmg > 45) || I.support) return;
    const d = u.distTo(caster); if (d > I.reach + 1.5) return;
    const dx = u.pos.x - caster.pos.x, dz = u.pos.z - caster.pos.z, n = Math.hypot(dx, dz) || 1;
    if (d > 3 && (dx * caster.fx + dz * caster.fz) / n < 0.2) return;   // not aimed at me
    this.threat = { from: caster, at: L.time + this.p.react * (0.6 + Math.random() * 0.8) };
  }
  dodge(L, th) {
    const u = this.u, kit = this.kit;
    if (Math.random() > this.p.dodge) return false;
    if (u.skill && !u.skill.canDashCancel()) return false;
    const c = th.from, dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, n = Math.hypot(dx, dz) || 1;
    const s = Math.random() < 0.5 ? 1 : -1, px = -dz / n * s, pz = dx / n * s;
    const aim = { x: u.pos.x + (px * 0.85 + dx / n * 0.35) * 6, z: u.pos.z + (pz * 0.85 + dz / n * 0.35) * 6 };
    if (kit.dashCd <= 0 && kit.dash(aim)) return true;
    this.side = { x: aim.x, z: aim.z, until: L.time + 0.5 };
    return false;
  }
  offense(L, t) {
    const kit = this.kit, u = this.u, dist = u.gap(t);
    const down = t.cc.down > 0 || t.cc.stun > 0 || t.cc.freeze > 0 || t.air.launched;
    const armored = t.superArmor >= 2 || t.invuln > 0;
    const idh = kit.hudIdentity();
    if (idh && dist < 7 && Math.random() < 0.3 * this.p.skill) {
      if ((idh.kind === 'orbs' || idh.kind === 'bubbles') && idh.orbs >= 1) { if (kit.identityKey(idh.orbs >= 2 && Math.random() < 0.5 ? 'x' : 'z', this.aim)) return true; }
      else if (idh.ready && !idh.active && idh.kind !== 'stance') { if (kit.identityKey('z', this.aim)) return true; }
      else if (idh.kind === 'stance' && idh.ready && !idh.active) { if (kit.identityKey('x', this.aim)) return true; }
    }
    // awakening: finish a low target or punish a downed one
    if (kit.awakenUses > 0 && u.cdLeft(kit.awaken.id) <= 0 && !armored && dist <= skillInfo(kit.awaken).reach * 0.85 && (t.hp / t.hpMax < 0.4 || (down && t.hp / t.hpMax < 0.65)) && Math.random() < 0.4 * this.p.skill) { if (kit.awakenCast(this.aim)) return true; }
    let best = -1, bsc = -Infinity;
    for (let s = 0; s < 8; s++) {
      const d = kit.skillAt(s); if (!d || u.cdLeft(d.id) > 0 || (d.mp && u.mp < d.mp)) continue;
      const I = skillInfo(d); if (I.support) continue;
      const inRange = dist <= I.reach * 0.9;
      const closer = !inRange && !this.ranged && I.gap && dist <= I.gap + 2;
      if (!inRange && !closer) continue;
      let sc = I.dmg * (0.85 + Math.random() * 0.5 * (1.15 - this.p.skill));
      if (down) sc *= I.cc ? 0.55 : 1.35;
      else if (!armored && I.cc) sc += 40 * this.p.skill + 10;
      if (closer) sc += 30 * this.p.aggro;
      if (d.type === 'casting' && dist < 3.5) sc *= 0.45;
      if (sc > bsc) { bsc = sc; best = s; }
    }
    if (best >= 0 && this.cast(L, best, kit.skillAt(best), t)) return true;
    if (dist < (this.ranged ? 8 : 2.4) && Math.random() < 0.75) { kit.basic(this.aim); return true; }
    return false;
  }
  cast(L, slot, def, t) {
    const kit = this.kit;
    const aim = def.type === 'point' && t ? { x: t.pos.x, z: t.pos.z } : this.aim;
    if (!kit.press(slot, aim)) return false;
    if (def.type === 'holding') { this.holding = slot; this.holdT = (def.holdMax || 2) * (0.5 + Math.random() * 0.45); }
    else if (def.type === 'charge') { this.holding = slot; const pf = def.perfect ? (def.perfect[0] + def.perfect[1]) / 2 : 0.9; this.holdT = (def.chargeTime || 1) * (this.p.skill > 0.85 ? pf : pf * (0.75 + Math.random() * 0.4)); }
    else if (def.type === 'combo' || def.type === 'chain') { const n = (def.stages?.length || 1) - 1; for (let i = 1; i <= n; i++) this.combo.push({ slot, at: L.time + 0.17 * i + Math.random() * 0.06 }); }
    return true;
  }
  supportTurn(L) {
    const kit = this.kit, u = this.u;
    const allies = [u, ...this.ctx.allies(u)].filter(a => !a.dead && u.distTo(a) < 14);
    const hurt = allies.filter(a => a.hp / a.hpMax < 0.6).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax);
    const pressured = allies.some(a => (a.combatT || 0) > 6.6);
    for (let s = 0; s < 8; s++) {
      const d = kit.skillAt(s); if (!d || u.cdLeft(d.id) > 0 || (d.mp && u.mp < d.mp)) continue;
      const I = skillInfo(d); if (!I.ally) continue;
      if (I.heal && !hurt.length) continue;
      if (I.shield && !pressured && !hurt.length) continue;
      if (!I.heal && !I.shield && !pressured) continue;
      if (this.cast(L, s, d, hurt[0] || this.target || u)) return true;
    }
    const idh = kit.hudIdentity();
    if (idh && (idh.ready || idh.orbs >= 1) && (hurt.length || pressured) && Math.random() < 0.3) return kit.identityKey(hurt.length >= 2 ? 'x' : 'z', this.aim);
    return false;
  }
  move(L, t, dt) {
    const u = this.u;
    if (!t) { const c = this.ctx.center(); this.goTo(L, c.x, c.z, 2.5); return; }
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 1.5; if (Math.random() < 0.45) this.strafe *= -1; }
    const d = u.distTo(t), want = this.want + t.radius + u.radius;
    const dx = u.pos.x - t.pos.x, dz = u.pos.z - t.pos.z, n = Math.hypot(dx, dz) || 1;
    let tx, tz;
    if (this.ranged || this.support) {
      const close = this.ctx.foes(u).find(f => !f.dead && u.distTo(f) < 3.2 && f.cc.down <= 0 && !f.air.launched);
      if (close && this.kit.dashCd <= 0 && u.hp / u.hpMax < 0.85 && Math.random() < this.p.skill * 0.35) { this.kit.dash(this.away(close, 6)); return; }
      const r = d < want * 0.8 ? want + 1 : Math.min(Math.max(d, want), want + 1.5);
      const ang = Math.atan2(dz / n, dx / n) + this.strafe * 0.55;
      tx = t.pos.x + Math.cos(ang) * r; tz = t.pos.z + Math.sin(ang) * r;
    } else if (d > 5) { tx = t.pos.x; tz = t.pos.z; }
    else {
      // melee: work around toward the back, strafing
      tx = t.pos.x - t.fx * want + (-t.fz) * this.strafe * 0.9; tz = t.pos.z - t.fz * want + (t.fx) * this.strafe * 0.9;
    }
    this.goTo(L, tx, tz, 0.45);
  }
  goTo(L, x, z, stop = 0.4) {
    const u = this.u, q = L.nav.nearest(x, z, 4, 0.4) || { x, z };
    let dx = q.x - u.pos.x, dz = q.z - u.pos.z;
    if (Math.hypot(dx, dz) < stop) { if (this.target) u.faceTo(this.target.pos.x, this.target.pos.z); return; }
    this.stuckT = u.blocked ? this.stuckT + 0.1 : Math.max(0, this.stuckT - 0.05);
    if (this.stuckT > 0.35 || this.path) {
      if (!this.path || L.time > (this.pathT || 0)) { this.path = L.nav.path(u.pos.x, u.pos.z, q.x, q.z, 0.4, 4000); this.pathT = L.time + 0.7; }
      const p = this.path?.[0];
      if (p) { if (Math.hypot(p.x - u.pos.x, p.z - u.pos.z) < 0.6) this.path.shift(); dx = p.x - u.pos.x; dz = p.z - u.pos.z; }
      if (!this.path?.length) { this.path = null; this.stuckT = 0; }
    }
    const n = Math.hypot(dx, dz) || 1, sp = u.st.speed;
    u.move.x = dx / n * sp; u.move.z = dz / n * sp;
  }
  away(f, dist) {
    const u = this.u, dx = u.pos.x - f.pos.x, dz = u.pos.z - f.pos.z, n = Math.hypot(dx, dz) || 1, s = Math.random() < 0.5 ? 0.5 : -0.5;
    return { x: u.pos.x + (dx / n - dz / n * s) * dist, z: u.pos.z + (dz / n + dx / n * s) * dist };
  }
}

// ================================================================================================ scoreboard overlay
const CSS = `
.md-pvp{position:fixed;left:50%;top:8px;z-index:21;pointer-events:none;transform-origin:50% 0;display:flex;flex-direction:column;align-items:center;gap:6px;font:600 13px "Segoe UI",Roboto,system-ui,sans-serif;color:#e8ebf3;text-shadow:0 1px 2px #000}
.md-sb{display:flex;align-items:center;gap:12px;padding:6px 12px;background:linear-gradient(180deg,rgba(27,35,57,.94),rgba(8,11,20,.95));border:1px solid #3a4560;border-radius:3px;box-shadow:0 10px 26px rgba(0,0,0,.55),inset 0 1px 0 rgba(200,214,245,.12)}
.md-team{display:flex;gap:6px}
.md-p{position:relative;width:40px;text-align:center}
.md-p i{display:block;width:36px;height:36px;margin:0 auto;background:#10141f center/cover;border:1px solid rgba(110,150,220,.6);border-radius:3px;box-shadow:0 0 0 1px #000}
.md-p.red i{border-color:rgba(255,110,90,.65)}
.md-p.you i{border-color:#f3dca0;box-shadow:0 0 0 1px #000,0 0 8px rgba(243,220,160,.55)}
.md-p s{display:block;height:4px;margin:3px 2px 0;background:rgba(0,0,0,.75);text-decoration:none}
.md-p s b{display:block;height:100%;background:linear-gradient(#9fe0ff,#3a8ee0);transition:width .15s}
.md-p.red s b{background:linear-gradient(#ff9a86,#c02a1a)}
.md-p.dead i{filter:grayscale(1) brightness(.4)}
.md-p em{position:absolute;left:0;right:0;top:9px;font:800 15px/1 "Segoe UI",sans-serif;font-style:normal;color:#fff}
.md-p u{position:absolute;left:0;right:0;top:-2px;font:700 10px/1 "Segoe UI",sans-serif;text-decoration:none;color:#f3dca0}
.md-mid{display:flex;flex-direction:column;align-items:center;min-width:132px}
.md-sc{display:flex;align-items:baseline;gap:10px}
.md-sc b{font:700 32px/1 Georgia,"Times New Roman",serif;font-variant-numeric:tabular-nums}
.md-sc b.blue{color:#79bfff}.md-sc b.red{color:#ff735f}
.md-sc span{color:#5f6880;font:400 18px/1 Georgia,serif}
.md-mid em{font:700 14px/1.2 "Segoe UI",sans-serif;font-style:normal;font-variant-numeric:tabular-nums;color:#fff;margin-top:3px}
.md-mid em.urgent{color:#ff8a6a}
.md-mid small{font:500 10px/1.3 "Segoe UI",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#c9a45a}
.md-feed{display:flex;flex-direction:column;align-items:center;gap:3px}
.md-f{padding:3px 12px;background:rgba(4,6,12,.72);border:1px solid rgba(110,130,180,.2);border-radius:2px;font:600 12px/1.3 "Segoe UI",sans-serif;animation:md-in .25s ease-out;transition:opacity .5s}
.md-f .blue{color:#8ccaff}.md-f .red{color:#ff8a78}.md-f i{font-style:normal;color:#8c95ab;margin:0 6px}
.md-f.old{opacity:0}
@keyframes md-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.md-hp{position:fixed;left:0;top:0;z-index:4;width:64px;height:5px;background:rgba(0,0,0,.7);border:1px solid rgba(0,0,0,.85);pointer-events:none;will-change:transform}
.md-hp b{display:block;height:100%;background:linear-gradient(#ff8a6a,#b01a10)}
.md-hp.shielded{box-shadow:0 0 0 1px rgba(240,245,255,.7)}
`;
let styled = false;
class PvpBoard {
  constructor(match) {
    if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
    this.m = match;
    const el = this.el = document.createElement('div'); el.className = 'md-pvp';
    el.innerHTML = `<div class="md-sb"><div class="md-team blue"></div><div class="md-mid"><div class="md-sc"><b class="blue">0</b><span>:</span><b class="red">0</b></div><em>0:00</em><small></small></div><div class="md-team red"></div></div><div class="md-feed"></div>`;
    document.body.appendChild(el);
    this.teams = [el.querySelector('.md-team.blue'), el.querySelector('.md-team.red')];
    this.sc = el.querySelectorAll('.md-sc b'); this.clock = el.querySelector('.md-mid em'); this.sub = el.querySelector('.md-mid small'); this.feedEl = el.querySelector('.md-feed');
    this.cards = new Map(); this.bars = new Map(); this.p = { x: 0, y: 0 };
    for (const e of match.entries) {
      const c = document.createElement('div'); c.className = `md-p ${e.team ? 'red' : 'blue'}${e.local ? ' you' : ''}`;
      c.innerHTML = `<u></u><i style="background-image:url('${iconUrl('class:' + e.cls, 36)}')"></i><em></em><s><b></b></s>`;
      c.title = e.name;
      this.teams[e.team].appendChild(c);
      this.cards.set(e, { el: c, hp: c.querySelector('s b'), em: c.querySelector('em'), k: c.querySelector('u') });
      if (e.team === 1) { const b = document.createElement('div'); b.className = 'md-hp'; b.innerHTML = '<b></b>'; document.body.appendChild(b); this.bars.set(e, { el: b, fill: b.firstChild }); }
    }
  }
  feed(html) {
    const f = document.createElement('div'); f.className = 'md-f'; f.innerHTML = html;
    this.feedEl.prepend(f);
    while (this.feedEl.children.length > 4) this.feedEl.lastChild.remove();
    setTimeout(() => f.classList.add('old'), 6000); setTimeout(() => f.remove(), 6600);
  }
  update() {
    const m = this.m, g = m.g;
    this.el.style.zoom = g.ui?.scale || 1;
    const [a, b] = m.mode === 'elimination' ? [m.teams[0].rounds, m.teams[1].rounds] : [m.teams[0].score, m.teams[1].score];
    this.sc[0].textContent = a; this.sc[1].textContent = b;
    const left = m.clockLeft();
    this.clock.textContent = m.state === 'countdown' ? 'Get ready' : m.overtime ? 'Sudden death' : fmtTime(Math.max(0, left));
    this.clock.classList.toggle('urgent', m.overtime || (m.state === 'fight' && left < 30));
    this.sub.textContent = m.mode === 'elimination' ? `Round ${m.round} · first to ${PVP_MODES.elimination.wins}` : `First to ${PVP_MODES.deathmatch.kills}`;
    for (const [e, c] of this.cards) {
      const u = e.u;
      c.hp.style.width = `${Math.max(0, u.hp / u.hpMax * 100).toFixed(1)}%`;
      c.el.classList.toggle('dead', u.dead);
      c.em.textContent = u.dead && e.respawnAt != null && m.mode === 'deathmatch' ? String(Math.max(1, Math.ceil(e.respawnAt - m.t))) : '';
      c.k.textContent = e.k ? String(e.k) : '';
    }
    // enemy HP bars over their heads
    const me = g.hero?.u;
    for (const [e, bar] of this.bars) {
      const u = e.u;
      if (u.dead || !me || u.level !== g.level) { bar.el.style.display = 'none'; continue; }
      const s = g.cam.toScreen({ x: u.pos.x, y: u.pos.y + (u.model?.height || u.height) + 0.18, z: u.pos.z }, this.p);
      if (!s) { bar.el.style.display = 'none'; continue; }
      bar.el.style.display = '';
      bar.el.style.transform = `translate(${(s.x - 32) | 0}px,${(s.y + 2) | 0}px)`;
      bar.fill.style.width = `${Math.max(0, u.hp / u.hpMax * 100).toFixed(1)}%`;
      bar.el.classList.toggle('shielded', u.shield > 0);
    }
  }
  dispose() { this.el.remove(); for (const b of this.bars.values()) b.el.remove(); this.bars.clear(); }
}

// ================================================================================================ the match
const TEAM = [{ name: 'Blue', css: 'blue', color: '#79bfff' }, { name: 'Red', css: 'red', color: '#ff735f' }];
class PvpMatch {
  constructor(session, c) {
    this.kind = 'pvp'; this.s = session; this.g = session.game; this.c = c;
    this.mode = PVP_MODES[c.mode] ? c.mode : 'deathmatch'; this.def = PVP_MODES[this.mode];
    this.state = 'countdown'; this.t = 0; this.cd = PVP.countdown; this.round = 1; this.roundT = 0; this.overtime = false; this.overT = 0;
    this.entries = []; this.teams = [{ score: 0, rounds: 0 }, { score: 0, rounds: 0 }]; this.focus = [null, null]; this.focusT = 0; this.offs = [];
    this.rng = new RNG((c.seed ?? Date.now()) % 1e9 >>> 0);
    this.firstBlood = false;
    this.ctx = {
      active: () => this.state === 'fight',
      foes: u => this.entries.filter(e => e.team !== u.team && !e.u.dead).map(e => e.u),
      allies: u => this.entries.filter(e => e.team === u.team && e.u !== u && !e.u.dead).map(e => e.u),
      focus: team => this.focus[team],
      center: () => ({ x: 0, z: 0 }),
    };
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  entry(u) { return u && this.entries.find(e => e.u === u); }
  spawnAt(team, slot) {
    const A = this.g.zone.anchors || {};
    const a = A[`team:${team ? 'b' : 'a'}${slot + 1}`] || { x: (slot - 1) * 3, z: team ? -16 : 16, facing: team ? Math.PI : 0 };
    return team ? a : { ...a, z: a.z - 3.5 };
  }
  enter() {
    const g = this.g, L = this.L, s = this.s, A = s.account;
    const R = pvpRecord(A), rk = rankOf(R.rating), ai = PVP_AI[rk.id] || PVP_AI.silver;
    this.ratingBefore = R.rating;
    this.opp = Math.max(800, R.rating + Math.round(this.rng.range(-50, 90)));
    // you (already spawned) + two teammates vs three
    const me = g.hero; me.items = []; me.awakenUses = 1; me.u.team = 0;
    this.addEntry(me, 0, { local: true });
    const clsPool = Object.keys(CLASSES);
    const pick = (team, n) => {
      const taken = team === 0 ? [this.s.char.cls] : [];
      const out = [];
      for (let i = 0; i < n; i++) {
        let cls = this.rng.pick(clsPool);
        for (let k = 0; k < 8 && (taken.includes(cls) || (CLASSES[cls].role === 'support' && [...taken, ...out].some(c => CLASSES[c].role === 'support'))); k++) cls = this.rng.pick(clsPool);
        out.push(cls); taken.push(cls);
      }
      return out;
    };
    pick(0, 2).forEach((cls, i) => this.addAI(0, i === 0 ? 0 : 2, cls, ai.ally[i % ai.ally.length]));
    pick(1, 3).forEach((cls, i) => this.addAI(1, i, cls, ai.enemy[i % ai.enemy.length]));
    // HUD party frames = your team; the death screen's revive goes through the match
    const party = this.party = g.party = new RunParty(g, { canRevive: () => false, noRevive: this.mode === 'deathmatch' ? 'You respawn in a moment.' : 'Wait for the next round.' });
    for (const e of this.entries.filter(x => x.team === 0)) party.members.push({ kit: e.kit, local: e.local, ai: e.ai, sim: e.sim });
    for (const e of this.entries) pvpRules(e.u);
    this.offs = [
      L.on('damage', ev => this.onDamage(ev)),
      L.on('heal', ev => { const e = this.entry(ev.src); if (e && ev.tgt?.team === e.team) e.heal += ev.real || 0; }),
      L.on('death', ev => this.onDeath(ev)),
      L.on('skillStart', ({ unit, def }) => { if (unit.kind !== 'hero' || def.basic || !this.entry(unit)) return; for (const e of this.entries) if (e.ai && e.team !== unit.team && !e.u.dead) e.ai.notice(L, unit, def); }),
    ];
    this.board = new PvpBoard(this);
    g.inputBlocked = true;
    g.audio?.music?.('pvp'); g.audio?.ambience?.('crowd');
    g.ui?.banner?.(this.def.name, { kind: 'zone', sub: `The Crucible · ${rk.label} · ${R.rating}`, dur: 2.6 });
    this.s.ui.chat?.add?.({ channel: 'system', text: `${this.def.name}: ${this.def.desc}` });
    this.cd = PVP.countdown; this.lastBeep = null;
    window.__modes ||= {}; window.__modes.pvp = this;
  }
  addEntry(kit, team, o = {}) {
    const e = { kit, u: kit.u, team, name: kit.u.name, cls: kit.cls.id, local: !!o.local, ai: o.ai || null, sim: o.sim || null, slot: this.entries.filter(x => x.team === team).length, k: 0, d: 0, a: 0, dmg: 0, taken: 0, heal: 0, hits: 0, crits: 0, streak: 0, multi: 0, multiT: 0, respawnAt: null };
    this.entries.push(e);
    return e;
  }
  addAI(team, slot, cls, persona) {
    const L = this.L, sim = makeSim(this.rng.int(1, 1e9), { cls, persona });
    const char = pvpChar(simChar(sim, PVP.ilvl));
    const at = this.spawnAt(team, slot);
    const kit = new HeroKit(L, char, pvpStats(char), { x: at.x, z: at.z, facing: at.facing ?? (team ? Math.PI : 0), team });
    const u = kit.u;
    Object.assign(u.data, { look: char.look, gear: char.gear, sex: char.sex, pvpSim: sim, lod: 'full', title: sim.title, guild: sim.guild });
    if (team === 1) u.data.elite = true;
    kit.items = []; kit.awakenUses = 1;
    const ai = new PvpAI(kit, this.ctx, persona);
    L.add(u);
    return this.addEntry(kit, team, { ai, sim });
  }
  exit() {
    for (const f of this.offs) f(); this.offs = [];
    this.board?.dispose(); this.board = null;
    this.g.camFocus = null; this.g.inputBlocked = false;
    if (window.__modes?.pvp === this) window.__modes.pvp = null;
  }
  clockLeft() {
    if (this.mode === 'deathmatch') return this.overtime ? this.def.overtime - this.overT : this.def.time - this.t;
    return this.def.roundTime - this.roundT;
  }
  // ---------------------------------------------------------------- events
  onDamage(ev) {
    const se = this.entry(ev.src), te = this.entry(ev.tgt);
    if (!se || !te || se.team === te.team || ev.amount <= 0) return;
    se.dmg += ev.amount; se.hits++; if (ev.crit) se.crits++;
    te.taken += ev.amount;
    ev.tgt.data.hitBy?.set(ev.src.id, this.L.time);
  }
  onDeath({ unit, killer }) {
    const ve = this.entry(unit); if (!ve || this.state === 'over') return;
    const L = this.L;
    ve.d++;
    let ke = this.entry(killer);
    if (!ke || ke.team === ve.team) { let bt = -1; for (const [id, t] of unit.data.hitBy || []) { const e = this.entries.find(x => x.u.id === id); if (e && e.team !== ve.team && t > bt && L.time - t < 6) { bt = t; ke = e; } } }
    if (ke && ke.team === ve.team) ke = null;
    const shutdown = ve.streak >= 3;
    ve.streak = 0;
    const assists = [];
    for (const [id, t] of unit.data.hitBy || []) { const e = this.entries.find(x => x.u.id === id); if (e && e !== ke && e.team !== ve.team && L.time - t < 10) { e.a++; assists.push(e); } }
    unit.data.hitBy?.clear();
    if (ke) {
      ke.k++; ke.streak++;
      ke.multi = this.t - ke.multiT < 10 ? ke.multi + 1 : 1; ke.multiT = this.t;
      if (this.mode === 'deathmatch' && this.state === 'fight') this.teams[ke.team].score++;
    }
    // feed + chat + announcer
    const kn = ke ? `<span class="${TEAM[ke.team].css}">${esc(ke.name)}</span>` : '<span>The Crucible</span>';
    this.board?.feed(`${kn}<i>defeated</i><span class="${TEAM[ve.team].css}">${esc(ve.name)}</span>${assists.length ? `<i>+${assists.length}</i>` : ''}`);
    this.s.ui.chat?.add?.({ channel: 'system', text: `${ke ? ke.name : 'The Crucible'} defeated ${ve.name}${assists.length ? ` (assist: ${assists.map(a => a.name).join(', ')})` : ''}.` });
    const g = this.g, meTeam = 0;
    if (!this.firstBlood && ke) { this.firstBlood = true; g.ui?.banner?.(ANNOUNCER.firstBlood, { kind: 'warn', sub: `${ke.name} draws first blood` }); g.audio?.sfx?.('raid_warning', {}); }
    else if (ke && ke.multi >= 2) g.ui?.banner?.(ke.multi >= 4 ? ANNOUNCER.rampage : ke.multi === 3 ? ANNOUNCER.triple : ANNOUNCER.double, { kind: ke.team === meTeam ? 'stagger' : 'counter' });
    else if (ke && shutdown) g.ui?.banner?.(ANNOUNCER.shutdown, { kind: 'stagger', sub: `${ke.name} ends ${ve.name}'s streak` });
    if (ke?.local) g.audio?.sfx?.('victory_horn', {});
    // mode rules
    if (this.mode === 'deathmatch') {
      ve.respawnAt = this.t + PVP.respawn;
      const alive = this.entries.filter(e => e.team === ve.team && !e.u.dead);
      if (!alive.length && ke) g.ui?.banner?.(ANNOUNCER.ace, { kind: ke.team === meTeam ? 'stagger' : 'counter' });
      if (this.state === 'fight') {
        if (this.overtime && ke) return this.end(ke.team);
        if (ke && this.teams[ke.team].score >= this.def.kills) return this.end(ke.team);
        if (ke && this.teams[ke.team].score === this.def.kills - 1) g.ui?.toast?.(`Match point: ${TEAM[ke.team].name}!`, 'warn');
      }
    } else {
      const alive = t => this.entries.filter(e => e.team === t && !e.u.dead);
      if (alive(ve.team).length === 1) { const last = alive(ve.team)[0]; if (last.local) g.ui?.banner?.(ANNOUNCER.lastStand, { kind: 'warn', sub: 'Your team is counting on you' }); }
      if (!alive(ve.team).length && this.state === 'fight') this.endRound(1 - ve.team);
      if (unit === this.me) { const mate = alive(0)[0]; if (mate) this.g.camFocus = mate.u.pos; }
    }
  }
  // ---------------------------------------------------------------- flow
  update(dt) {
    const g = this.g, L = this.L; if (!L) return;
    for (const e of this.entries) ccImmunity(L, e.u);
    this.boardT = (this.boardT || 0) - dt;
    if (this.boardT <= 0) { this.boardT = 0.1; this.board?.update(); }
    if (this.state === 'countdown') {
      this.cd -= dt;
      const n = Math.ceil(this.cd);
      if (n !== this.lastBeep && n >= 1 && n <= 3) { this.lastBeep = n; g.ui?.banner?.(String(n), { kind: 'counter', dur: 0.9 }); g.audio?.sfx?.('pvp_countdown', {}); }
      if (this.cd <= 0) { this.state = 'fight'; g.inputBlocked = false; g.ui?.banner?.('FIGHT!', { kind: 'stagger', dur: 1.2 }); g.audio?.sfx?.('pvp_countdown', { final: true }); }
      return;
    }
    if (this.state === 'between') { this.betweenT -= dt; if (this.betweenT <= 0) this.startRound(); return; }
    if (this.state !== 'fight') return;
    this.t += dt; this.roundT += dt;
    // team focus: the weakest enemy near each team
    this.focusT -= dt;
    if (this.focusT <= 0) { this.focusT = 1; for (const team of [0, 1]) this.focus[team] = this.pickFocus(team); }
    const me = this.me;
    if (this.mode === 'deathmatch') {
      for (const e of this.entries) if (e.u.dead && e.respawnAt != null && this.t >= e.respawnAt) this.respawn(e);
      if (this.overtime) { this.overT += dt; if (this.overT >= this.def.overtime) this.end(null); }
      else if (this.t >= this.def.time) {
        const [a, b] = [this.teams[0].score, this.teams[1].score];
        if (a !== b) this.end(a > b ? 0 : 1);
        else { this.overtime = true; this.overT = 0; g.ui?.banner?.('Sudden Death', { kind: 'warn', sub: 'The next kill wins' }); }
      }
      if (me?.dead && this.s.deadShown && !this._skin) { this._skin = true; const e = this.entry(me); this.s.ui.screen('death', { reason: me.lastHitBy ? `Slain by ${me.lastHitBy.name}` : 'You have fallen', by: this.def.name, revives: [], auto: { label: 'Respawning in', left: Math.max(0.5, (e.respawnAt ?? this.t) - this.t) } }); }
    } else {
      if (this.roundT >= this.def.roundTime) {
        const hp = t => this.entries.filter(e => e.team === t && !e.u.dead).reduce((a, e) => a + e.u.hp / e.u.hpMax, 0);
        const a = hp(0), b = hp(1);
        this.endRound(Math.abs(a - b) < 0.05 ? null : a > b ? 0 : 1, true);
      }
      if (me?.dead && this.s.deadShown && !this._skin) { this._skin = true; this.s.ui.screen('death', { reason: me.lastHitBy ? `Slain by ${me.lastHitBy.name}` : 'You have fallen', by: 'Elimination', revives: [], auto: null }); }
    }
    if (me && !me.dead) this._skin = false;
  }
  pickFocus(team) {
    const mine = this.entries.filter(e => e.team === team && !e.u.dead).map(e => e.u); if (!mine.length) return null;
    const cx = mine.reduce((a, u) => a + u.pos.x, 0) / mine.length, cz = mine.reduce((a, u) => a + u.pos.z, 0) / mine.length;
    let best = null, bs = Infinity;
    for (const e of this.entries) { if (e.team === team || e.u.dead) continue; const u = e.u; const s = u.hp / u.hpMax * 10 + Math.hypot(u.pos.x - cx, u.pos.z - cz) * 0.45 + (u.invuln > 0 ? 6 : 0); if (s < bs) { bs = s; best = u; } }
    return best;
  }
  resetHero(e, at, full = true) {
    const u = e.u, L = this.L;
    u.dead = false; u.deadT = 0; u.hp = u.hpMax; u.mp = u.mpMax;
    for (const k in u.cc) u.cc[k] = 0;
    u.air.y = 0; u.air.vy = 0; u.air.launched = false; u.kb.t = 0; u.lift = 0;
    u.skill?.cancel?.('reset'); u.skill = null;
    for (const s of u.statuses.slice()) removeStatus(L, u, s.id);
    u.shields.length = 0;
    if (full) { u.cd.clear(); e.kit.dashCd = 0; e.kit.standCd = 0; e.kit.awakenUses = Math.max(e.kit.awakenUses, 1); }
    u.pos.x = at.x + (Math.random() - 0.5) * 0.6; u.pos.z = at.z + (Math.random() - 0.5) * 0.6; u.facing = at.facing ?? (e.team ? Math.PI : 0);
    u.invuln = PVP.spawnProtect; u.data.ccWas = false; u.data.hitBy?.clear();
    u.model?.play?.('revive', { dur: 0.8 });
    L.emit('revive', { unit: u }); L.emit('teleport', { unit: u, x: u.pos.x, z: u.pos.z });
    if (e.local) { this.g.cam.snap(u.pos); this.g.player?.stop?.(); this.g.camFocus = null; }
  }
  respawn(e) {
    e.respawnAt = null;
    this.resetHero(e, this.spawnAt(e.team, Math.floor(this.rng.next() * 3)), false);
    e.kit.awakenUses = Math.max(e.kit.awakenUses, 1);
    this.L.emit('fx', { unit: e.u, preset: 'portal_flash', x: e.u.pos.x, z: e.u.pos.z, ev: { color: e.team ? 'crimson' : 'holy' } });
  }
  endRound(winner, timeout = false) {
    if (this.state !== 'fight') return;
    const g = this.g;
    if (winner != null) this.teams[winner].rounds++;
    const [a, b] = [this.teams[0].rounds, this.teams[1].rounds];
    g.ui?.banner?.(winner == null ? 'Round Drawn' : winner === 0 ? 'Round Won' : 'Round Lost', { kind: winner === 0 ? 'success' : winner == null ? 'info' : 'fail', sub: `${timeout ? 'Time — ' : ''}Blue ${a} : ${b} Red`, dur: 2.4 });
    g.audio?.sfx?.(winner === 0 ? 'quest_complete' : 'ui_error', {});
    this.s.ui.chat?.add?.({ channel: 'system', text: `Round ${this.round}: ${winner == null ? 'draw' : TEAM[winner].name + ' wins'} (Blue ${a} : ${b} Red).` });
    if (a >= this.def.wins || b >= this.def.wins || this.round >= this.def.rounds) return this.end(a === b ? null : a > b ? 0 : 1);
    this.state = 'between'; this.betweenT = this.def.between; this.round++;
  }
  startRound() {
    const g = this.g;
    for (const e of this.entries) this.resetHero(e, this.spawnAt(e.team, e.slot), true);
    for (const e of this.entries) e.kit.awakenUses = 1;
    this.roundT = 0; this.state = 'countdown'; this.cd = 3.2; this.lastBeep = null; g.inputBlocked = true; g.camFocus = null;
    g.ui?.banner?.(`Round ${this.round}`, { kind: 'zone', sub: `Blue ${this.teams[0].rounds} : ${this.teams[1].rounds} Red`, dur: 2 });
  }
  end(winner) {
    if (this.state === 'over') return;
    this.state = 'over';
    const g = this.g, s = this.s, A = s.account, ch = s.char;
    g.inputBlocked = true;
    const win = winner === 0, draw = winner == null;
    g.ui?.banner?.(draw ? 'Draw' : win ? 'Victory' : 'Defeat', { kind: win ? 'clear' : draw ? 'info' : 'defeat', sub: this.scoreText(), dur: 3 });
    g.audio?.stinger?.(win ? 'raid_clear' : draw ? 'quest_complete' : 'wipe');
    for (const e of this.entries) if (!e.u.dead) e.u.model?.play?.(e.team === winner ? 'victory' : draw ? 'shrug' : 'kneel', { dur: 2.6 });
    // rating
    const R = pvpRecord(A), before = R.rating;
    const exp = 1 / (1 + Math.pow(10, (this.opp - before) / 400));
    let delta = Math.round(PVP_REWARDS.kfactor * ((win ? 1 : draw ? 0.5 : 0) - exp));
    if (win) delta = Math.max(8, delta + Math.min(10, R.streak * 2)); else if (!draw) delta = Math.min(-6, delta);
    R.rating = Math.max(0, before + delta); R.best = Math.max(R.best, R.rating);
    if (win) { R.wins++; R.streak = Math.max(0, R.streak) + 1; } else if (draw) { R.draws++; } else { R.losses++; R.streak = Math.min(0, R.streak) - 1; }
    const me = this.entry(this.me);
    R.history.unshift({ t: Date.now(), mode: this.mode, result: win ? 'win' : draw ? 'draw' : 'loss', delta, k: me?.k || 0, d: me?.d || 0, a: me?.a || 0, score: this.scoreText() });
    R.history.length = Math.min(R.history.length, 12);
    const rkBefore = rankOf(before), rkAfter = rankOf(R.rating);
    // rewards
    const base = { ...(win ? PVP_REWARDS.win : draw ? PVP_REWARDS.draw : PVP_REWARDS.loss) };
    const mul = PVP_REWARDS.rankBonus[rkAfter.id] || 1; base.pvp = Math.round(base.pvp * mul);
    const first = win && R.day !== dayId();
    if (first) { R.day = dayId(); for (const [k, v] of Object.entries(PVP_REWARDS.firstWin)) base[k] = (base[k] || 0) + v; }
    const rows = S.common.grantBundle(A, ch, base) || [];
    const xp = win ? 1500 : 700; A.addXp(ch, xp);
    A.save();
    emitPvp(s, { win, draw, mode: this.mode, rating: R.rating, delta });
    if (rkAfter.tier !== rkBefore.tier) setTimeout(() => g.ui?.banner?.(rkAfter.name, { kind: rkAfter.tier > rkBefore.tier ? 'levelup' : 'fail', sub: rkAfter.tier > rkBefore.tier ? 'Promoted' : 'Demoted', dur: 3 }), 3200);
    const secs = Math.max(1, this.t);
    const perf = me ? (me.k + me.a * 0.5) / Math.max(1, me.d) : 0;
    const topDmg = Math.max(...this.entries.map(e => e.dmg));
    const grade = !me ? null : perf >= 3 || (me.dmg >= topDmg && perf >= 1.5) ? 'S' : perf >= 1.6 ? 'A' : perf >= 0.9 ? 'B' : perf >= 0.5 ? 'C' : 'D';
    setTimeout(() => {
      g.inputBlocked = false;
      showResults(s, {
        kind: win || draw ? 'clear' : 'fail', over: `Proving Grounds · ${this.def.name}`, title: draw ? 'Draw' : win ? 'Victory' : 'Defeat',
        sub: `${this.scoreText()} · ${rkAfter.label}`, rank: win || draw ? grade : null, time: this.t,
        stats: [{ label: 'K / D / A', value: me ? `${me.k} / ${me.d} / ${me.a}` : '—' }, { label: 'Damage', value: me ? Math.round(me.dmg).toLocaleString('en-US') : '—' }, { label: 'Rating', value: R.rating.toLocaleString('en-US'), tag: `${delta >= 0 ? '+' : ''}${delta}` }, { label: 'Rank', value: rkAfter.label }, { label: 'Record', value: `${R.wins}W ${R.losses}L${R.draws ? ` ${R.draws}D` : ''}` }],
        loot: rows, currencies: { silver: base.silver || 0, gold: base.gold || 0, xp },
        dps: this.entries.slice().sort((a, b) => b.dmg - a.dmg).map(e => ({ name: `${e.team ? '[Red]' : '[Blue]'} ${e.name}  ${e.k}/${e.d}/${e.a}`, cls: e.cls, dmg: e.dmg, dps: e.dmg / secs, crit: e.hits ? e.crits / e.hits : 0, back: null, counters: e.k, deaths: e.d, you: e.local, support: CLASSES[e.cls]?.role === 'support' })),
        retry: true, continueLabel: 'Return to Solhaven',
      }, win || draw);
    }, 3400);
  }
  scoreText() { return this.mode === 'elimination' ? `Blue ${this.teams[0].rounds} : ${this.teams[1].rounds} Red` : `Blue ${this.teams[0].score} : ${this.teams[1].score} Red`; }
  partyHud() { return this.party?.hud(); }
  questHud() {
    const R = pvpRecord(this.s.account), rk = rankOf(R.rating), me = this.entry(this.me);
    return { id: 'pvp', title: `${this.def.name} — ${rk.label}`, kind: 'event', steps: [{ text: this.mode === 'deathmatch' ? `First to ${this.def.kills} kills` : `Win ${this.def.wins} rounds`, n: this.mode === 'deathmatch' ? this.teams[0].score : this.teams[0].rounds, need: this.mode === 'deathmatch' ? this.def.kills : this.def.wins, done: false }, { text: `You: ${me?.k || 0} kills · ${me?.d || 0} deaths · ${me?.a || 0} assists`, n: 0, need: 0, done: false }] };
  }
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function launchPvp(session, c) {
  const mode = PVP_MODES[c.mode] ? c.mode : 'deathmatch';
  session.ui.toast(`Searching for a ${PVP_MODES[mode].name} match…`, 'info');
  await new Promise(r => setTimeout(r, AUTO ? 200 : 900 + Math.random() * 900));
  await loadInstance(session, 'crucible', { kind: 'arena', region: 'Proving Grounds', name: 'The Crucible', tip: 'Knocked down? Space stands you up — and you are Unstoppable for a moment after any crowd control.' });
  const g = session.game;
  const match = new PvpMatch(session, { ...c, mode });
  const pc = pvpChar(session.heroChar(session.char));
  spawnLocal(session, match.spawnAt(0, 1), { char: pc, stats: pvpStats(pc), items: [] });
  g.mode = match;
  match.enter();
  if (AUTO) { const e = match.entry(g.hero.u); e.ai = new PvpAI(g.hero, match.ctx, 'veteran'); }
  session.inWorld();
}
registerContent('pvp', launchPvp);

/** Marshal Kaine: the Proving Grounds registrar */
export async function pvpMenu(session) {
  const R = pvpRecord(session.account), rk = rankOf(R.rating);
  const first = R.day !== dayId();
  const last = R.history[0];
  const text = `${rk.label} · Rating ${R.rating.toLocaleString('en-US')} (best ${R.best.toLocaleString('en-US')}) · ${R.wins}W ${R.losses}L${R.draws ? ` ${R.draws}D` : ''}${R.streak > 1 ? ` · ${R.streak} wins in a row` : ''}.\n${first ? 'First win of the day pays +100 Proving Tokens and 20 gold. ' : ''}${last ? `Last match: ${last.result} ${last.score} (${last.delta >= 0 ? '+' : ''}${last.delta}).` : 'Three on three. Normalised gear, no potions — skill decides.'}`;
  const pick = await session.ui.dialog({ id: 'pvp', name: 'Marshal Kaine', title: 'Proving Grounds' }, [{ text, choices: [
    { id: 'deathmatch', text: `${PVP_MODES.deathmatch.name} — ${PVP_MODES.deathmatch.desc}`, kind: 'quest' },
    { id: 'elimination', text: `${PVP_MODES.elimination.name} — ${PVP_MODES.elimination.desc}`, kind: 'quest' },
    { id: 'ranks', text: 'How do ranks and duels work?', kind: 'talk' },
    { id: 'bye', text: 'Farewell.', kind: 'leave' },
  ] }]);
  if (pick === 'deathmatch' || pick === 'elimination') return session.launch({ kind: 'pvp', mode: pick });
  if (pick === 'ranks') {
    await session.ui.dialog({ id: 'pvp', name: 'Marshal Kaine', title: 'Proving Grounds' }, [
      `Ranks: ${PVP_RANKS.map(r => `${r.name} ${r.min}+`).join(' · ')}. Win to climb; the better your rank, the sharper your opponents and the more Proving Tokens you earn.`,
      'Duels: walk up to any adventurer, click them and choose "Challenge to a Duel". First to fall below a tenth of their health loses — nobody dies.',
      'In the Crucible every fighter is normalised. When you are knocked down, press Space to stand up; after any stun or knockdown you are Unstoppable for a moment.',
    ]);
  }
}
registerService('pvp', session => pvpMenu(session));

// ================================================================================================ duels
class Duel {
  constructor(session, sim) { this.s = session; this.g = session.game; this.sim = sim; this.state = 'countdown'; this.t = 0; this.cd = DUEL.countdown; this.outT = 0; }
  get L() { return this.g.level; }
  start() {
    const g = this.g, L = this.L, me = g.hero?.u, sim = this.sim;
    if (!me || !L.byId.has(sim.id) || !sim.data.sim) return false;
    this.level = L;
    // the duelist steps into the ring: a combat-ready copy of the adventurer wearing the same model
    let x = sim.pos.x, z = sim.pos.z;
    const d = Math.hypot(x - me.pos.x, z - me.pos.z);
    if (d > 10 || d < 3) { const a = Math.atan2(z - me.pos.z, x - me.pos.x) || 0; const p = L.nav.nearest(me.pos.x + Math.cos(a) * 7, me.pos.z + Math.sin(a) * 7, 5, 0.4); if (p) { x = p.x; z = p.z; } }
    this.center = { x: (x + me.pos.x) / 2, z: (z + me.pos.z) / 2 };
    sim.data.keepModel = true; sim.model?.stop?.(); sim.data.sit = false;
    L.remove(sim);
    const char = pvpChar(simChar(sim.data.sim, PVP.ilvl));
    const kit = this.kit = new HeroKit(L, char, pvpStats(char), { x, z, facing: 0, team: 1 });
    const u = this.u = kit.u;
    u.name = sim.name; u.model = sim.model || null;
    Object.assign(u.data, { look: char.look, gear: char.gear, sex: char.sex, pvpSim: sim.data.sim, title: sim.data.title, guild: sim.data.guild, lod: 'full', keepModel: true, elite: true });
    kit.items = []; kit.awakenUses = 1;
    this.ai = new PvpAI(kit, { active: () => this.state === 'fight', foes: () => (me.dead ? [] : [me]), allies: () => [], focus: () => me, center: () => this.center }, sim.data.sim.persona || 'veteran');
    L.add(u);
    u.faceTo(me.pos.x, me.pos.z); me.faceTo(u.pos.x, u.pos.z);
    // you: PvP stats for the duel, no items
    const kitMe = g.hero;
    this.saved = { items: kitMe.items, awaken: kitMe.awakenUses };
    kitMe.items = []; kitMe.awakenUses = 1;
    me.setStats(pvpStats(pvpChar(this.s.heroChar(this.s.char)))); me.hp = me.hpMax;
    for (const x of [me, u]) { pvpRules(x); x.data.hpFloor = 1; }
    this.ring = g.fx?.telegraph?.({ shape: 'donut', pos: { x: this.center.x, y: L.heightAt(this.center.x, this.center.z), z: this.center.z }, radius: DUEL.ring, inner: DUEL.ring - 0.35, color: 'white' });
    g.inputBlocked = true;
    g.ui?.banner?.('Duel', { kind: 'zone', sub: `${this.s.char.name} vs ${u.name}`, dur: 2 });
    this.s.ui.chat?.add?.({ channel: 'area', from: u.name, text: ['ok lets go', 'no potions, no mercy', 'gl hf', 'you sure? :)', 'ready when you are'][Math.floor(Math.random() * 5)] });
    return true;
  }
  update(dt) {
    const g = this.g, L = this.L, me = g.hero?.u;
    if (!me || L !== this.level || !L.byId.has(this.u.id)) return this.abort();
    ccImmunity(L, me); ccImmunity(L, this.u);
    if (this.state === 'countdown') {
      this.cd -= dt; const n = Math.ceil(this.cd);
      if (n !== this.beep && n >= 1) { this.beep = n; g.ui?.banner?.(String(n), { kind: 'counter', dur: 0.8 }); g.audio?.sfx?.('pvp_countdown', {}); }
      if (this.cd <= 0) { this.state = 'fight'; g.inputBlocked = false; g.ui?.banner?.('FIGHT!', { kind: 'stagger', dur: 1 }); g.audio?.sfx?.('pvp_countdown', { final: true }); }
      return;
    }
    if (this.state !== 'fight') return;
    this.t += dt;
    const low = x => x.hp / x.hpMax <= DUEL.lowHp;
    if (low(me)) return this.end(false);
    if (low(this.u)) return this.end(true);
    const out = Math.hypot(me.pos.x - this.center.x, me.pos.z - this.center.z) > DUEL.leave;
    this.outT = out ? this.outT + dt : 0;
    if (out && this.outT < dt * 1.5) g.ui?.toast?.('Return to the duel ring or forfeit!', 'warn');
    if (this.outT > 3) return this.end(false, 'You left the ring.');
    if (this.t > DUEL.time) return this.end(me.hp / me.hpMax >= this.u.hp / this.u.hpMax, 'Time!');
  }
  end(won, why) {
    if (this.state === 'over') return;
    this.state = 'over';
    const g = this.g, R = pvpRecord(this.s.account);
    if (won) R.duels.wins++; else R.duels.losses++;
    this.s.account.save();
    g.ui?.banner?.(won ? 'Duel Won' : 'Duel Lost', { kind: won ? 'success' : 'fail', sub: why || `${this.s.char.name} vs ${this.u.name}`, dur: 2.4 });
    this.u.skill?.cancel?.('duel'); this.u.skill = null; this.ai.holding = null;
    this.u.model?.play?.(won ? 'bow' : 'cheer', { dur: 2.2 });
    this.s.ui.chat?.add?.({ channel: 'area', from: this.u.name, text: won ? ['gg, you got me', 'nice counters', 'rematch later?', 'gg wp'][Math.floor(Math.random() * 4)] : ['gg ez… jk, gg', 'close one!', 'gg, try dashing more :)', 'gg wp'][Math.floor(Math.random() * 4)] });
    setTimeout(() => this.restore(), 2400);
  }
  restore() {
    const g = this.g, L = this.L, me = g.hero?.u, s = this.s;
    this.ring?.stop?.(); this.ring = null;
    g.inputBlocked = false;
    if (me && L === this.level) {
      for (const st of me.statuses.slice()) if (st.def.debuff || st.def.cc || st.id === 'super_armor') removeStatus(L, me, st.id);
      delete me.data.dmgTakenFn; delete me.data.hpFloor; delete me.data.pvp; delete me.data.hitBy;
      g.hero.items = this.saved.items; g.hero.awakenUses = this.saved.awaken;
      s.refreshChar?.(); me.hp = me.hpMax;
    }
    if (L === this.level && L.byId.has(this.u.id)) {
      const sim = this.sim;
      sim.pos.x = this.u.pos.x; sim.pos.z = this.u.pos.z; sim.facing = this.u.facing;
      this.u.model = null; this.u.data.keepModel = true;
      L.remove(this.u);
      sim.data.keepModel = false; sim.dead = false;
      L.add(sim);
    }
    if (DUELS.active === this) DUELS.active = null;
  }
  abort() {
    // the level changed under the duel (zone travel): nothing to restore in the old level
    this.ring?.stop?.(); this.g.inputBlocked = false; this.state = 'over';
    if (DUELS.active === this) DUELS.active = null;
  }
}
const DUELS = { active: null };
registerPlugin({
  id: 'modes:pvp',
  init(session) {
    this.s = session;
    session.bus.on('duel', ({ unit }) => this.challenge(unit));
  },
  challenge(unit) {
    const s = this.s, g = s.game, kind = g.mode?.kind;
    if (!unit || !g.hero) return;
    if (DUELS.active) { s.ui.toast('You are already dueling.', 'warn'); return; }
    if (unit.remote || unit.puppet) { s.ui.toast('Duels with friends are coming with the next co-op update.', 'info'); return; }
    if (kind && !['city', 'field', 'island', 'stronghold'].includes(kind)) { s.ui.toast('Duels are fought in towns and in the open world.', 'warn'); return; }
    if (g.hero.u.dead || g.hero.u.combatT > 0) { s.ui.toast('You can’t start a duel right now.', 'warn'); return; }
    const d = new Duel(s, unit);
    setTimeout(() => { if (!DUELS.active && d.start()) DUELS.active = d; }, 600);
  },
  update(dt) { DUELS.active?.update(dt); },
  hud(h) {
    const m = this.s.game.mode;
    if (m?.kind === 'pvp' && m.questHud) { try { (h.quests ||= []).unshift(m.questHud()); } catch (e) { console.error('[pvp hud]', e); } }
    const d = DUELS.active; if (!d || d.state === 'over' || !d.u) return;
    h.target = { name: d.u.name, level: 60, hp: d.u.hp, hpMax: d.u.hpMax, kind: 'player', title: 'Duel' };
    h.timer = d.state === 'fight' ? { label: 'Duel', left: Math.max(0, DUEL.time - d.t), urgent: DUEL.time - d.t < 15 } : { label: 'Duel starts', left: Math.max(0, d.cd) };
  },
  npcChoices(npcId) {
    if (npcId !== 'pvp') return [];
    return [{ id: 'pvp:deathmatch', text: `Queue: ${PVP_MODES.deathmatch.name} (3v3)`, kind: 'quest' }, { id: 'pvp:elimination', text: `Queue: ${PVP_MODES.elimination.name} (3v3)`, kind: 'quest' }];
  },
  onNpcChoice(npcId, choice) {
    if (npcId !== 'pvp' || !String(choice || '').startsWith('pvp:')) return false;
    if (this.s.guestMode) { this.s.ui.toast('Your host picks the match.', 'info'); return true; }
    this.s.launch({ kind: 'pvp', mode: choice.split(':')[1] });
    return true;
  },
});
