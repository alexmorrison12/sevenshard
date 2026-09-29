// Combat rules: hit shapes, damage (crit, back/head attacks, brand, defence, engravings), shields, healing,
// statuses (buffs, debuffs, damage over time, crowd control), knockback, hit-stop, boss counters / stagger checks /
// destruction. All functions take the level (for events and RNG) and emit presentation events:
//   'damage' { src, tgt, amount, crit, back, head, counter, absorbed, killed, skill, hit, pos }
//   'heal' { src, tgt, amount }  'shield' { src, tgt, amount }  'status' { tgt, id, on }  'death' { unit, killer }
//   'counter' { src, tgt }  'staggerBreak' { tgt }  'partBreak' { tgt, part }
import { clamp } from '../core/util.js';

// ---------------------------------------------------------------- statuses
// mods are additive on stats, except keys ending in 'Mul' which multiply by (1 + v).
export const STATUS = {
  burn: { name: 'Burn', debuff: true, dot: 0.05, maxStacks: 3, elem: 'fire' },
  bleed: { name: 'Bleed', debuff: true, dot: 0.06, maxStacks: 3 },
  poison: { name: 'Poison', debuff: true, dot: 0.04, maxStacks: 5 },
  shock: { name: 'Shock', debuff: true, dot: 0.03, mods: { moveSpd: -0.15 } },
  freeze: { name: 'Frozen', debuff: true, cc: 'freeze' },
  stun: { name: 'Stunned', debuff: true, cc: 'stun' },
  fear: { name: 'Fear', debuff: true, cc: 'fear' },
  sleep: { name: 'Sleep', debuff: true, cc: 'sleep', breakOnHit: true },
  silence: { name: 'Silenced', debuff: true, cc: 'silence' },
  slow: { name: 'Slowed', debuff: true, mods: { moveSpd: -0.3 } },
  brand: { name: 'Brand', debuff: true, mods: { dmgTaken: 0.1 } },
  armor_break: { name: 'Armor Break', debuff: true, mods: { dmgTaken: 0.12 } },
  def_down: { name: 'Defense Down', debuff: true, mods: { dmgTaken: 0.15 } },
  weaken: { name: 'Weakened', debuff: true, mods: { dmgMul: -0.2 } },
  atk_up: { name: 'Attack Up', mods: { dmgMul: 0.1 } },
  crit_up: { name: 'Crit Up', mods: { crit: 0.15 } },
  speed_up: { name: 'Haste', mods: { atkSpd: 0.15, moveSpd: 0.15 } },
  def_up: { name: 'Protection', mods: { dmgTaken: -0.2 } },
  super_armor: { name: 'Super Armor', superArmor: 2 },
  invuln: { name: 'Invulnerable', invuln: true },
  regen: { name: 'Regeneration', hot: 0.02 },
  enrage: { name: 'Enraged', mods: { dmgMul: 0.5, atkSpd: 0.2, moveSpd: 0.25 } },
};

/** Apply (or refresh/stack) a status. o: { dur, stacks, src, mods (override), power, name, icon, id2 } */
export function applyStatus(level, tgt, id, o = {}) {
  if (tgt.dead) return null;
  const def = STATUS[id] || { name: o.name || id, mods: o.mods };
  if (tgt.puppet) { // co-op guest: the host owns this unit; forward friendly buffs, let the host apply the rest
    if (!def.debuff && !def.cc && tgt.kind === 'hero') level.netAlly?.(o.src, tgt, { k: 'status', id, dur: o.dur ?? 3, mods: o.mods || def.mods || null, name: o.name || def.name, icon: o.icon });
    return null;
  }
  if (def.debuff && tgt.invuln > 0 && !o.force) return null;
  if (def.cc && tgt.kind === 'boss' && !o.force) return null;             // bosses shrug off CC (use mechanics)
  if (def.cc && tgt.superArmor >= 2 && !o.force) return null;
  let s = tgt.statuses.find(x => x.id === id && (!o.uniqueSrc || x.src === o.src));
  const dur = o.dur ?? 3;
  if (s) {
    s.left = Math.max(s.left, dur); s.dur = Math.max(s.dur, dur);
    if (def.maxStacks) s.stacks = Math.min(def.maxStacks, s.stacks + (o.stacks || 1));
    if (o.power) s.power = Math.max(s.power || 0, o.power);
  } else {
    s = { id, def, left: dur, dur, stacks: o.stacks || 1, src: o.src || null, power: o.power || 0, mods: o.mods || def.mods || null, tick: 0, name: o.name || def.name, icon: o.icon || `status:${id}` };
    tgt.statuses.push(s);
    level.emit('status', { tgt, id, on: true, s });
  }
  if (def.cc) tgt.cc[def.cc] = Math.max(tgt.cc[def.cc], dur);
  tgt._statDirty = true;
  return s;
}
export function removeStatus(level, tgt, id) {
  const i = tgt.statuses.findIndex(s => s.id === id);
  if (i < 0) return;
  const s = tgt.statuses[i]; tgt.statuses.splice(i, 1);
  if (s.def.cc) tgt.cc[s.def.cc] = 0;
  tgt._statDirty = true;
  level.emit('status', { tgt, id, on: false, s });
}
/** Effective stats = base stats + status mods (cached until statuses change). */
export function eff(u) {
  if (!u._statDirty && u._eff && u._effBase === u.st) return u._eff;
  const e = { ...u.st };
  let sa = u.baseSuperArmor;
  for (const s of u.statuses) {
    if (s.def.superArmor) sa = Math.max(sa, s.def.superArmor);
    if (!s.mods) continue;
    for (const k in s.mods) {
      const v = s.mods[k] * (s.def.maxStacks ? s.stacks : 1);
      if (k.endsWith('Mul')) e[k] = (e[k] ?? 1) * (1 + v); else e[k] = (e[k] ?? 0) + v;
    }
  }
  e.moveSpd = Math.max(0.2, e.moveSpd); e.atkSpd = Math.max(0.3, e.atkSpd); e.cdr = clamp(e.cdr, 0, 0.6);
  u._eff = e; u._effBase = u.st; u._statDirty = false; u._effSA = sa;
  return e;
}
export function tickStatuses(level, u, dt) {
  const st = u.statuses;
  let dirty = false;
  for (let i = st.length - 1; i >= 0; i--) {
    const s = st[i];
    s.left -= dt;
    if ((s.def.dot || s.def.hot) && !u.dead) {
      s.tick += dt;
      while (s.tick >= 1) {
        s.tick -= 1;
        if (s.def.dot) {
          const base = s.power || (s.src ? eff(s.src).atk * 2 : u.hpMax * 0.01);
          dealDamage(level, s.src, u, base * s.def.dot * 20 * s.stacks, { dot: true, noCrit: true, elem: s.def.elem });
        } else heal(level, s.src || u, u, u.hpMax * s.def.hot);
      }
    }
    if (s.left <= 0) { st.splice(i, 1); if (s.def.cc) u.cc[s.def.cc] = 0; dirty = true; level.emit('status', { tgt: u, id: s.id, on: false, s }); }
  }
  if (dirty) u._statDirty = true;
  const c = u.cc;
  for (const k in c) if (c[k] > 0) c[k] = Math.max(0, c[k] - dt);
  if (u.invuln > 0) u.invuln -= dt;
  for (let i = u.shields.length - 1; i >= 0; i--) { const sh = u.shields[i]; sh.left -= dt; if (sh.left <= 0 || sh.amt <= 0) u.shields.splice(i, 1); }
  eff(u); u.superArmor = Math.max(u._effSA || 0, u.skill?.superArmor || 0);
}

// ---------------------------------------------------------------- shapes
/**
 * Is unit u inside the hit shape? shape: { shape: 'circle'|'cone'|'rect'|'donut'|'all', r, inner, angle (rad, full), len, width }
 * origin (ox, oz), direction (dx, dz) normalised. Unit radius counts (touching the edge hits).
 */
export function inShape(h, ox, oz, dx, dz, u) {
  const px = u.pos.x - ox, pz = u.pos.z - oz, rr = u.radius;
  switch (h.shape) {
    case 'all': return true;
    case 'circle': { const r = (h.r || 1) + rr; return px * px + pz * pz <= r * r; }
    case 'donut': { const d = Math.hypot(px, pz); return d <= h.r + rr && d >= (h.inner || 0) - rr; }
    case 'cone': {
      const d = Math.hypot(px, pz); if (d > (h.r || 1) + rr) return false; if (d < rr + 0.3) return true;
      const cos = (px * dx + pz * dz) / d, half = (h.angle || Math.PI / 2) / 2;
      return cos >= Math.cos(Math.min(Math.PI, half + Math.asin(Math.min(1, rr / d))));
    }
    case 'rect': case 'line': {
      const along = px * dx + pz * dz, side = Math.abs(-px * dz + pz * dx);
      return along >= -(h.back || 0) - rr && along <= (h.len || 4) + rr && side <= (h.width || 1.5) / 2 + rr;
    }
  }
  return false;
}

// ---------------------------------------------------------------- damage
const EPS = 1e-6;
/** relation of attacker to target: 'back' | 'head' | 'side' */
export function position(src, tgt) {
  const dx = src.pos.x - tgt.pos.x, dz = src.pos.z - tgt.pos.z, d = Math.hypot(dx, dz) || 1;
  const dot = (dx * tgt.fx + dz * tgt.fz) / d;
  return dot < -0.5 ? 'back' : dot > 0.55 ? 'head' : 'side';
}
const debilitated = u => u.cc.stun > 0 || u.cc.down > 0 || u.cc.freeze > 0 || u.air.launched || u.data.groggy;

/**
 * Deal damage. o: { coef (× attack power), flat (absolute), crit (bonus), attack: 'back'|'head', counter, stagger,
 *   wp, knock, kb, elem, skill (id), kind ('skill'|'identity'|'awaken'|'basic'), noCrit, dot, hit (spec), true (ignore def) }
 */
export function dealDamage(level, src, tgt, base, o = {}) {
  if (!tgt || tgt.dead || tgt.untargetable) return null;
  if (tgt.invuln > 0) { level.emit('damage', { src, tgt, amount: 0, immune: true, pos: tgt.pos }); return null; }
  const se = src ? eff(src) : null, te = eff(tgt);
  let amount = base, crit = !!o.fixedCrit, back = !!o.fixedBack, head = !!o.fixedHead;
  if (o.fixed != null) amount = o.fixed;
  else if (src && !o.dot) {
    const rel = position(src, tgt);
    back = o.attack === 'back' && rel === 'back';
    head = o.attack === 'head' && rel === 'head';
    let critRate = se.crit + (o.crit || 0) + (back ? se.backCrit : 0);
    if (!o.noCrit && level.rng() < critRate) crit = true;
    let add = se.dmgAdd + (o.kind === 'awaken' ? se.awakenMul - 1 : 0) + (o.kind === 'identity' ? se.identityMul - 1 : 0);
    if (debilitated(tgt)) add += se.domMul;
    amount *= (1 + add) * se.dmgMul;
    if (crit) amount *= se.critDmg;
    if (back) amount *= se.backMul;
    if (head) amount *= se.headMul;
    if (se.onDamageMul) amount *= se.onDamageMul(src, tgt, o, back, head);
    amount *= 0.96 + level.rng() * 0.08;
  }
  if (o.fixed == null) {
    amount *= te.dmgTaken;
    if (!o.true) amount *= 1 - te.def / (te.def + 6500);
    if (tgt.data.dmgTakenFn) amount *= tgt.data.dmgTakenFn(src, o);
  }
  amount = Math.max(1, Math.round(amount));
  // co-op guest: the host owns this unit's health. Show the hit now, send it, never kill locally.
  if (tgt.puppet) {
    const ev = { src, tgt, amount, crit, back, head, counter: !!(o.counter && tgt.data.counterWindow > 0), absorbed: 0, killed: false, skill: o.skill, kind: o.kind, elem: o.elem, dot: !!o.dot, pos: tgt.pos };
    tgt.hp = Math.max(1, tgt.hp - amount);
    level.emit('damage', ev);
    level.netHit?.(src, tgt, amount, o, ev);
    return ev;
  }
  // shields first
  let absorbed = 0;
  for (const sh of tgt.shields) { if (amount <= 0) break; const a = Math.min(sh.amt, amount); sh.amt -= a; amount -= a; absorbed += a; }
  if (tgt.data.hpFloor && tgt.hp - amount < tgt.data.hpFloor) amount = Math.max(0, tgt.hp - tgt.data.hpFloor); // scripted phase gates
  tgt.hp -= amount;
  tgt.lastHitBy = src; tgt.combatT = 8; if (src) src.combatT = 8;
  let counter = false;
  if (src && o.counter && tgt.data.counterWindow > 0 && tgt.team !== src.team) {
    counter = true; tgt.data.counterWindow = 0;
    level.emit('counter', { src, tgt });
    tgt.data.onCounter?.(src);
  }
  if (src && tgt.data.stagger && o.stagger) {
    const sg = tgt.data.stagger; sg.v = Math.max(0, sg.v - o.stagger * (se?.staggerMul || 1));
    if (sg.v <= 0 && !sg.broken) { sg.broken = true; level.emit('staggerBreak', { tgt, src }); sg.onBreak?.(src); }
  }
  if (src && tgt.data.destruction && (o.wp || 0) > 0) {
    const ds = tgt.data.destruction; ds.v = Math.max(0, ds.v - (o.wp + (se?.wpBonus || 0)) * 10);
    if (ds.v <= 0 && !ds.broken) { ds.broken = true; level.emit('partBreak', { tgt, src, part: ds.part }); ds.onBreak?.(src); }
  }
  if (tgt.data.poise != null && o.stagger && tgt.superArmor < 2) { tgt.data.poise -= o.stagger; }
  // sleep breaks on hit
  if (tgt.cc.sleep > 0 && !o.dot) { const s = tgt.statuses.find(x => x.def.breakOnHit); if (s) removeStatus(level, tgt, s.id); }
  const ev = { src, tgt, amount, crit, back, head, counter, absorbed, killed: false, skill: o.skill, kind: o.kind, elem: o.elem, dot: !!o.dot, pos: tgt.pos };
  if (tgt.hp <= 0) {
    if (tgt.data.cheatDeath && !tgt.data.cheatUsed) { tgt.data.cheatUsed = true; tgt.hp = 1; level.emit('cheatDeath', { tgt }); }
    else { tgt.hp = 0; ev.killed = true; kill(level, tgt, src); }
  }
  level.emit('damage', ev);
  if (src?.data.onDealt) src.data.onDealt(ev);
  if (tgt.data.onHurt) tgt.data.onHurt(ev);
  return ev;
}

export function kill(level, u, killer) {
  if (u.dead) return;
  u.dead = true; u.deadT = 0; u.hp = 0; u.skill?.cancel?.('death'); u.skill = null;
  u.shields.length = 0; u.move.x = u.move.z = 0;
  for (const s of u.statuses.slice()) if (s.def.debuff || s.def.cc) removeStatus(level, u, s.id);
  level.emit('death', { unit: u, killer });
}

export function heal(level, src, tgt, amount) {
  if (!tgt || tgt.dead) return 0;
  const se = src ? eff(src) : null, te = eff(tgt);
  const a = Math.round(amount * (se?.healMul || 1) * te.healTaken);
  if (tgt.puppet) { level.netAlly?.(src, tgt, { k: 'heal', a }); level.emit('heal', { src, tgt, amount: a, real: 0, pos: tgt.pos }); return 0; }
  const real = Math.min(a, tgt.hpMax - tgt.hp);
  tgt.hp += real;
  level.emit('heal', { src, tgt, amount: a, real, pos: tgt.pos });
  return real;
}
export function addShield(level, src, tgt, amount, dur = 6, id = null) {
  if (!tgt || tgt.dead) return;
  const se = src ? eff(src) : null;
  const a = Math.round(amount * (se?.shieldMul || 1));
  if (tgt.puppet) { level.netAlly?.(src, tgt, { k: 'shield', a }); level.emit('shield', { src, tgt, amount: a, pos: tgt.pos }); return; }
  if (id) { const ex = tgt.shields.find(s => s.id === id); if (ex) { ex.amt = Math.max(ex.amt, a); ex.left = dur; level.emit('shield', { src, tgt, amount: a, pos: tgt.pos }); return; } }
  tgt.shields.push({ amt: a, left: dur, src, id });
  level.emit('shield', { src, tgt, amount: a, pos: tgt.pos });
}

// ---------------------------------------------------------------- knockback & CC from hits
/** knock: 'push' | 'pull' | 'down' | 'up' | 'stun' | 'grab' ; kb metres */
export function applyKnock(level, src, tgt, knock, kb = 3, ox, oz, dur = 1.2) {
  if (!knock || tgt.dead) return;
  if (tgt.kind === 'boss' || tgt.data.immovable) return;
  if (knock === 'stun') { if (tgt.superArmor < 2) applyStatus(level, tgt, 'stun', { dur, src }); return; }
  if (tgt.superArmor >= 1 && tgt.kind !== 'hero') return;
  if (tgt.superArmor >= 1 && tgt.kind === 'hero' && knock !== 'down' && knock !== 'up') return;
  if (tgt.kind === 'hero' && tgt.superArmor >= 2) return;
  let dx = tgt.pos.x - ox, dz = tgt.pos.z - oz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  if (knock === 'pull') { dx = -dx; dz = -dz; kb = Math.min(kb, Math.max(0, d - 1.2)); }
  const t = 0.28;
  tgt.kb.x = dx * kb / t; tgt.kb.z = dz * kb / t; tgt.kb.t = t;
  if (knock === 'down') { tgt.cc.down = Math.max(tgt.cc.down, dur); tgt.skill?.cancel?.('cc'); tgt.skill = null; level.emit('knock', { tgt, knock }); }
  if (knock === 'up') { tgt.air.vy = 7.5; tgt.air.y = Math.max(tgt.air.y, 0.06); tgt.air.launched = true; tgt.cc.down = Math.max(tgt.cc.down, dur + 0.6); tgt.skill?.cancel?.('cc'); tgt.skill = null; level.emit('knock', { tgt, knock }); }
  if (knock === 'push' || knock === 'pull') level.emit('knock', { tgt, knock });
}

/**
 * Resolve one hit spec from src at origin/direction against every enemy inside the shape.
 * h: { shape, r, inner, angle, len, width, off (forward offset of origin), coef, stagger, wp, counter, knock, kb,
 *      attack, elem, status: [{ id, dur, chance }], maxTargets, heal/shield for allies, team: 'enemy'|'ally'|'all' }
 * ctx: { skill, kind, mult, level: skillLevelMult, hitSet (Set of unit ids already hit by this instance, for "once") }
 * Returns the list of damage events.
 */
export function resolveHit(level, src, h, ox, oz, dx, dz, ctx = {}) {
  const out = [];
  const off = h.off || 0; ox += dx * off; oz += dz * off;
  const team = h.team || 'enemy';
  const cands = level.query(ox, oz, (h.r || h.len || 4) + 3, h.shape === 'all');
  let n = 0;
  const se = eff(src);
  if (level.netHost && src.team !== 0 && !ctx.only && !ctx.proj && !ctx.zone) level.emit('hitSpec', { src, h, ox, oz, dx, dz, ctx });
  for (const u of cands) {
    if (u.dead || u.untargetable || u === src && team !== 'self') continue;
    if (ctx.only && u !== ctx.only) continue;
    if (u.remote && src.team !== u.team) continue;      // a friend's hero: their own browser decides if it was hit
    const enemy = u.team !== src.team && u.team !== 2;
    if (team === 'enemy' && !enemy) continue;
    if (team === 'ally' && enemy) continue;
    if (ctx.hitSet && h.once && ctx.hitSet.has(u.id)) continue;
    if (!inShape(h, ox, oz, dx, dz, u)) continue;
    if (h.maxTargets && n >= h.maxTargets) break;
    n++;
    ctx.hitSet?.add(u.id);
    if (!enemy) { // ally effects (support skills)
      if (h.heal) heal(level, src, u, h.heal * (h.healOf === 'max' ? u.hpMax : se.atk));
      if (h.shield) addShield(level, src, u, h.shield * (h.shieldOf === 'max' ? src.hpMax : se.atk), h.shieldDur || 5, h.shieldId);
      if (h.buff) for (const b of [].concat(h.buff)) applyStatus(level, u, b.id, { dur: b.dur, src, mods: b.mods, name: b.name, icon: b.icon });
      continue;
    }
    const coef = (h.coef ?? 1) * (ctx.mult ?? 1);
    let c2 = coef;
    if (ctx.exec && u.hp / u.hpMax < 0.3) c2 *= 1 + ctx.exec;
    if (ctx.dom && (u.cc.stun > 0 || u.cc.down > 0 || u.data.groggy)) c2 *= 1 + ctx.dom;
    const ev = dealDamage(level, src, u, se.atk * c2, { attack: h.attack, counter: h.counter, stagger: (h.stagger || 0) * Math.min(1.5, ctx.mult ?? 1), wp: h.wp, elem: h.elem, skill: ctx.skill, kind: ctx.kind, stype: ctx.stype, crit: h.crit, hit: h });
    if (!ev) continue;
    out.push(ev);
    if (!u.dead) {
      if (h.knock) applyKnock(level, src, u, h.knock, h.kb ?? 3, ox, oz, h.knockDur);
      else if (u.kind === 'mob' && !u.superArmor && u.data.flinch !== false) u.data.flinchT = 0.25;  // light flinch
      if (h.status) for (const s of h.status) if (level.rng() < (s.chance ?? 1)) applyStatus(level, u, s.id, { dur: s.dur, src, stacks: s.stacks, power: s.power ? se.atk * s.power : 0 });
      if (h.brand) applyStatus(level, u, 'brand', { dur: h.brand, src });
    }
    // hit-stop: heavier for big hits and crits
    const hs = h.hitstop ?? (h.heavy ? 0.085 : ev.crit ? 0.05 : 0.03);
    if (hs > 0) { src.hitstop = Math.max(src.hitstop, hs * 0.7); u.hitstop = Math.max(u.hitstop, hs); }
  }
  if (out.length && h.gain !== 0) src.data.onHitLanded?.(out, h, ctx);
  return out;
}
export { EPS };
