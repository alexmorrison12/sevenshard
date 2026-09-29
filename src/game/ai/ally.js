// AI party members (SimPlayers in dungeons and raids). They play a HeroKit like a person would: position for
// back/head attacks or range, dodge telegraphs (with human reaction time and the odd mistake), counter blue
// windows, dump stagger into stagger checks, pop identity and awakening, drink potions, and — as supports —
// keep the party shielded, buffed and branded. Personas tune reaction, skill and discipline.
import { eff } from '../combat.js';

export const PERSONAS = {
  tryhard: { react: 0.18, skill: 0.95, greed: 0.3, chatty: 0.4 },
  veteran: { react: 0.25, skill: 0.85, greed: 0.2, chatty: 0.2 },
  casual: { react: 0.38, skill: 0.65, greed: 0.5, chatty: 0.5 },
  clueless: { react: 0.6, skill: 0.4, greed: 0.8, chatty: 0.7 },
  afk: { react: 0.9, skill: 0.3, greed: 0.2, chatty: 0.1 },
};

/** longest reach of a skill (metres) for "am I in range" checks */
export function reach(def) {
  if (def._reach) return def._reach;
  let r = 2;
  const scan = l => { for (const e of l || []) { if (e.a === 'hit') r = Math.max(r, (e.off || 0) + (e.r || e.len || 2) + (e.at === 'point' ? (def.range || 8) : 0)); if (e.a === 'proj') r = Math.max(r, (e.range || 8) * 0.8); if (e.a === 'move' && e.dist) r = Math.max(r, e.dist * 0.8 + 2); } };
  scan(def.events); scan(def.end); scan(def.loop?.events); for (const s of def.stages || []) scan(s.events);
  if (def.type === 'point') r = Math.max(r, def.range || 8);
  return (def._reach = Math.min(16, r));
}
const isSupportSkill = def => { let s = false; const scan = l => { for (const e of l || []) if (e.a === 'buff' || (e.a === 'hit' && e.team === 'ally')) s = true; }; scan(def.events); for (const st of def.stages || []) scan(st.events); return s; };
const hasCounter = def => !!def.props?.counter;
const staggerOf = def => ({ 'Very High': 4, High: 3, Mid: 2, Low: 1 }[def.props?.stagger] || 0);

export class AllyAI {
  constructor(kit, persona = 'veteran') {
    this.kit = kit; this.u = kit.u; this.p = PERSONAS[persona] || PERSONAS.veteran; this.personaId = persona;
    this.aim = { x: this.u.pos.x, z: this.u.pos.z };
    this.reactT = 0; this.dodgeTo = null; this.dodgeSpot = null; this.dodgeT = 0; this.holding = null; this.holdT = 0; this.think = Math.random() * 0.3; this.slotOrder = [0, 1, 2, 3, 4, 5, 6, 7];
    this.u.ctrl = this;
    this.support = kit.cls.role === 'support';
    this.melee = !['pistoleer', 'starcaller', 'songweaver'].includes(kit.cls.id);
    this.backClass = ['bladedancer', 'reaver', 'demonbound'].includes(kit.cls.id);
  }
  update(dt, L) {
    const kit = this.kit, u = this.u;
    kit.update(dt);
    u.move.x = u.move.z = 0;
    if (u.dead) return;
    // knocked down → stand up after reacting
    if (u.cc.down > 0) { this.reactT += dt; if (this.reactT > this.p.react + 0.25) { kit.dash(this.aim); this.reactT = 0; } return; }
    // release held skills
    if (this.holding != null) { this.holdT -= dt; if (this.holdT <= 0 || !u.skill) { kit.release(this.holding); this.holding = null; } }
    const target = this.pickTarget(L);
    if (target) { this.aim.x = target.pos.x; this.aim.z = target.pos.z; }
    // dodge
    // dodge: start early enough to walk out (reaction + escape distance / speed); dash when walking is too slow
    const danger = L.danger(u.pos.x, u.pos.z, u.radius + 0.3, u.team);
    if (danger >= 0 && danger < 3) {
      const spot = this.dodgeSpot && this.dodgeT > L.time ? this.dodgeSpot : (this.dodgeSpot = this.safeSpot(L, target));
      if (spot && this.dodgeT <= L.time) this.dodgeT = L.time + 0.25;
      if (spot) {
        const d = Math.hypot(spot.x - u.pos.x, spot.z - u.pos.z), spd = Math.max(2, (u.st.speed || 5) * (eff(u).moveSpd || 1));
        const walk = d / spd, need = this.p.react + walk + 0.12;
        if (danger < need && (Math.random() < this.p.skill * dt * 25 || danger < this.p.react + 0.3)) {
          if (danger < walk + 0.15 && d > 1.5 && kit.dashCd <= 0 && Math.random() < 0.35 + this.p.skill * 0.65) { kit.dash(spot); return; }
          this.moveTo(spot.x, spot.z); return;
        }
      }
    } else this.dodgeSpot = null;
    if (u.skill) return;
    this.think -= dt; if (this.think > 0) { this.position(L, target, dt); return; }
    this.think = 0.1 + this.p.react * 0.3;
    // potions
    if (u.hp / u.hpMax < 0.35 && Math.random() < this.p.skill) { const i = kit.items.findIndex(it => it.id === 'hp_potion' && it.count > 0 && it.cd <= 0); if (i >= 0) { kit.useItem(i, this.aim); return; } }
    if (!target) { this.follow(L); return; }
    const dist = u.gap(target);
    const boss = target.kind === 'boss' ? target : null;
    // support duties first
    if (this.support && this.supportTurn(L, target)) return;
    // counter window
    if (boss && boss.data.counterWindow > 0 && Math.random() < this.p.skill) {
      for (let s = 0; s < 8; s++) { const d = kit.skillAt(s); if (d && hasCounter(d) && u.cdLeft(d.id) <= 0 && dist <= reach(d)) { this.cast(s, d, target); return; } }
    }
    // stagger check / destruction bar: heavy stagger skills + bombs
    if (boss && boss.data.stagger && !boss.data.stagger.broken) {
      let best = -1, bs = 0; for (let s = 0; s < 8; s++) { const d = kit.skillAt(s); if (d && u.cdLeft(d.id) <= 0 && dist <= reach(d) && staggerOf(d) > bs) { bs = staggerOf(d); best = s; } }
      if (best >= 0) { this.cast(best, kit.skillAt(best), target); return; }
    }
    if (boss && boss.data.destruction && !boss.data.destruction.broken && Math.random() < 0.3 * this.p.skill) { const i = kit.items.findIndex(it => it.id === 'destruction_bomb' && it.count > 0 && it.cd <= 0); if (i >= 0 && dist < 10) { kit.useItem(i, this.aim); return; } }
    // identity & awakening
    const idh = kit.hudIdentity();
    if (idh?.ready && !idh.active && idh.kind !== 'stance' && Math.random() < 0.3) { if (kit.identityKey('z', this.aim)) return; }
    if (idh?.orbs >= 2 && Math.random() < 0.2) { if (kit.identityKey('x', this.aim)) return; }
    if (idh?.kind === 'stance' && idh.ready && !idh.active && Math.random() < 0.4) { if (kit.identityKey('x', this.aim)) return; }
    if (boss && kit.awakenUses > 0 && u.cdLeft(kit.awaken.id) <= 0 && (boss.data.groggy || boss.hp / boss.hpMax < 0.5) && Math.random() < 0.05 && dist < 8) { kit.awakenCast(this.aim); return; }
    // rotation
    this.slotOrder.sort(() => Math.random() - 0.5);
    for (const s of this.slotOrder) {
      const d = kit.skillAt(s);
      if (!d || u.cdLeft(d.id) > 0 || (d.mp && u.mp < d.mp)) continue;
      if (this.support && isSupportSkill(d)) continue;   // handled by supportTurn
      if (dist > reach(d) * 0.9) continue;
      this.cast(s, d, target); return;
    }
    if (dist < 3.2 && Math.random() < 0.6) { kit.basic(this.aim); return; }
    this.position(L, target, dt);
  }
  cast(slot, def, target) {
    const kit = this.kit;
    let aim = this.aim;
    if (def.type === 'point' && target) aim = { x: target.pos.x, z: target.pos.z };
    if (kit.press(slot, aim)) {
      if (def.type === 'holding') { this.holding = slot; this.holdT = (def.holdMax || 2) * (0.6 + Math.random() * 0.4); }
      else if (def.type === 'charge') { this.holding = slot; this.holdT = (def.chargeTime || 1) * (def.perfect ? (def.perfect[0] + def.perfect[1]) / 2 : 1) * (this.p.skill > 0.8 ? 1 : 0.7 + Math.random() * 0.5); }
      else if (def.type === 'combo' || def.type === 'chain') { const n = (def.stages?.length || 1) - 1; for (let i = 1; i <= n; i++) setTimeout(() => kit.press(slot, this.aim), 150 * i); }
      return true;
    }
    return false;
  }
  supportTurn(L, target) {
    const kit = this.kit, u = this.u;
    const allies = L.alliesOf(u, u.pos.x, u.pos.z, 20);
    const hurt = allies.filter(a => a.hp / a.hpMax < 0.65).length;
    for (let s = 0; s < 8; s++) {
      const d = kit.skillAt(s); if (!d || u.cdLeft(d.id) > 0 || (d.mp && u.mp < d.mp) || !isSupportSkill(d)) continue;
      const shieldy = /shield|bulwark|guardian|tune/i.test(d.id + d.name), heal = /heal|mend|rite|hymn|salvation/i.test(d.id + d.name);
      if (heal && hurt === 0) continue;
      if (shieldy && hurt === 0 && Math.random() < 0.6) continue;
      // buffs: cast when the party is engaged
      const aim = target ? { x: target.pos.x, z: target.pos.z } : this.aim;
      if (kit.press(s, aim)) return true;
    }
    const idh = kit.hudIdentity();
    if (idh && (idh.ready || idh.orbs >= 2) && allies.length > 1 && Math.random() < 0.4) { if (kit.identityKey(hurt >= 2 ? 'x' : 'z', this.aim)) return true; }
    return false;
  }
  pickTarget(L) {
    const u = this.u;
    let best = null, bd = Infinity;
    for (const e of L.query(u.pos.x, u.pos.z, 40)) {
      if (e.dead || e.team === u.team || e.team === 2 || e.untargetable) continue;
      const d = u.distTo(e) * (e.kind === 'boss' ? 0.5 : 1);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** preferred standing spot around the target */
  position(L, t, dt) {
    const u = this.u; if (!t) return;
    let tx, tz;
    const r = t.radius + (this.melee ? 1.4 : 7);
    if (this.melee && t.kind === 'boss') {
      const side = this.backClass ? -1 : (this.u.id % 2 ? 0.35 : -0.35);
      const ang = Math.atan2(t.fx, t.fz) + (side === -1 ? Math.PI : side) + (this.u.id % 3 - 1) * 0.5;
      tx = t.pos.x + Math.sin(ang) * r; tz = t.pos.z + Math.cos(ang) * r;
    } else {
      const dx = u.pos.x - t.pos.x, dz = u.pos.z - t.pos.z, d = Math.hypot(dx, dz) || 1;
      tx = t.pos.x + dx / d * r; tz = t.pos.z + dz / d * r;
    }
    if (Math.hypot(tx - u.pos.x, tz - u.pos.z) > 0.8) this.moveTo(tx, tz); else u.faceTo(t.pos.x, t.pos.z);
  }
  follow(L) {
    const lead = L.localHero; if (!lead || lead === this.u) return;
    const d = this.u.distTo(lead);
    if (d > 5) this.moveTo(lead.pos.x + (this.u.id % 3 - 1) * 1.5, lead.pos.z + 2);
  }
  moveTo(x, z) {
    const u = this.u, dx = x - u.pos.x, dz = z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return;
    const s = u.st.speed; u.move.x = dx / d * s; u.move.z = dz / d * s;
  }
  safeSpot(L, t) {
    const u = this.u;
    let best = null, bd = Infinity;
    for (let ring = 1; ring <= 4; ring++) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, r = ring * 2.4;
      const x = u.pos.x + Math.cos(a) * r, z = u.pos.z + Math.sin(a) * r;
      if (!L.nav.ok(x, z) || L.danger(x, z, u.radius + 0.4, u.team) >= 0) continue;
      const toT = t ? Math.abs(Math.hypot(x - t.pos.x, z - t.pos.z) - (t.radius + (this.melee ? 2 : 7))) * 0.3 : 0;
      const c = r + toT;
      if (c < bd) { bd = c; best = { x, z }; }
    }
    return best;
  }
}
