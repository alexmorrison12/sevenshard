// A combatant or NPC in a level: position, facing, stats, health/mana/shields, statuses, cooldowns, crowd control,
// knockback, and the link to its visual model and controller. Pure simulation — no three.js scene work here.
import * as THREE from 'three';
import { fwdX, fwdZ } from '../core/util.js';

let NEXT_ID = 1;
export const resetUnitIds = (n = 1) => { NEXT_ID = n; };

/** Default combat stats. Heroes get theirs from gear/engravings (systems/stats.js); mobs from their template. */
export function baseStats(o = {}) {
  return {
    atk: 1000,          // attack power
    hpMax: 10000,
    mpMax: 1000, mpRegen: 30,   // per second
    crit: 0.1,          // crit rate 0..1
    critDmg: 2.0,       // crit multiplier
    atkSpd: 1,          // attack speed multiplier (skill animations)
    moveSpd: 1,         // movement multiplier
    cdr: 0,             // cooldown reduction 0..0.6
    dmgAdd: 0,          // additive damage bucket
    dmgMul: 1,          // multiplicative damage bucket
    def: 0,             // defence (flat)
    dmgTaken: 1,        // incoming damage multiplier
    healMul: 1, shieldMul: 1, healTaken: 1,
    backMul: 1.05, headMul: 1.2, backCrit: 0.1,
    identityGain: 1, awakenMul: 1, identityMul: 1,
    domMul: 0,          // extra damage vs debilitated targets
    staggerMul: 1, wpBonus: 0,
    speed: 5.2,         // base run speed m/s
    ...o,
  };
}

export class Unit {
  constructor(o = {}) {
    this.id = o.id ?? NEXT_ID++;
    this.kind = o.kind || 'mob';           // hero | mob | boss | npc | pet | summon | object
    this.team = o.team ?? (this.kind === 'hero' ? 0 : 1);
    this.name = o.name || 'Unit';
    this.lv = o.level ?? 1;                // combat level (unit.level is the Level it lives in)
    this.level = null;
    this.cls = o.cls || null;
    this.type = o.type || null;             // mob / boss template id
    this.pos = new THREE.Vector3(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    this.facing = o.facing ?? 0;
    this.radius = o.radius ?? 0.45;
    this.height = o.height ?? 1.85;
    this.mass = o.mass ?? 1;                // push resistance for unit separation
    this.st = baseStats(o.stats);
    this.hpMax = this.st.hpMax; this.hp = o.hp ?? this.hpMax;
    this.mpMax = this.st.mpMax; this.mp = this.mpMax;
    this.shields = [];                      // { amt, left, src, id }
    this.statuses = [];                     // see combat.js applyStatus
    this.cd = new Map();                    // skillId → seconds left
    this.move = { x: 0, z: 0 };             // desired velocity from the controller (m/s, before moveSpd)
    this.kb = { x: 0, z: 0, t: 0 };         // knockback velocity + remaining time
    this.air = { y: 0, vy: 0, launched: false }; // launch height above ground (knock-up)
    this.lift = 0;                          // visual height from skills (leaps)
    this.cc = { stun: 0, down: 0, freeze: 0, fear: 0, sleep: 0, silence: 0, grab: 0 };
    this.superArmor = 0;                    // 0 none, 1 push immunity, 2 paralysis immunity
    this.baseSuperArmor = o.superArmor ?? 0;
    this.invuln = 0;                        // seconds of i-frames
    this.untargetable = false;
    this.hitstop = 0;                       // seconds of frozen animation/skill time
    this.skill = null;                      // running SkillRun
    this.model = null;                      // visual (hero/creature/boss contract) — optional
    this.ctrl = null;                       // controller (player/AI/net)
    this.dead = false; this.deadT = 0;
    this.spawnT = 0;
    this.tags = new Set(o.tags || []);
    this.anim = { speed: 0, turn: 0, combat: false };
    this.lastHitBy = null; this.combatT = 0;
    this.data = o.data || {};               // free slot for modes/AI
    this.party = null;
  }
  get alive() { return !this.dead; }
  get fx() { return fwdX(this.facing); }
  get fz() { return fwdZ(this.facing); }
  get hpPct() { return this.hp / this.hpMax; }
  get shield() { let s = 0; for (const x of this.shields) s += x.amt; return s; }
  /** crowd-controlled: cannot act */
  get disabled() { const c = this.cc; return c.stun > 0 || c.down > 0 || c.freeze > 0 || c.fear > 0 || c.sleep > 0 || c.grab > 0 || this.air.launched || this.dead; }
  get busy() { return !!this.skill; }
  cdLeft(id) { return this.cd.get(id) || 0; }
  hasStatus(id) { return this.statuses.some(s => s.id === id); }
  status(id) { return this.statuses.find(s => s.id === id); }
  distTo(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }
  /** surface distance (centre distance minus both radii) */
  gap(u) { return Math.max(0, this.distTo(u) - this.radius - u.radius); }
  faceTo(x, z) { const dx = x - this.pos.x, dz = z - this.pos.z; if (dx * dx + dz * dz > 1e-6) this.facing = Math.atan2(-dx, -dz); }
  setStats(st) {
    const pct = this.hp / this.hpMax;
    this.st = st; this.hpMax = st.hpMax; this.mpMax = st.mpMax;
    this.hp = Math.min(this.hpMax, Math.max(1, Math.round(pct * this.hpMax)));
    this.mp = Math.min(this.mp, this.mpMax);
  }
}
