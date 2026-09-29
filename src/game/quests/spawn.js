// Unit factories shared by the quest system, the field mode and the prologue: level-scaled field enemies (creatures or
// hero-model humanoids like bandits and cultists), NPC residents, story allies, quest props, plus anchor helpers.
// Leaf module: imports only engine/game building blocks and data (no quest/mode modules), so everyone can use it.
import { Unit } from '../unit.js';
import { MobAI, refFor } from '../ai/mob.js';
import { MOBS } from '../../data/mobs.js';
import { PROVIDERS } from '../visuals.js';
import { placeholderHero } from '../placeholders.js';
import { FIELD_MOBS, FAMILY } from '../../data/field.js';
import { STORY_NPCS } from '../../data/quests/npcs.js';
import { xpForLevel } from '../account.js';

export const templateOf = type => FIELD_MOBS[type] || MOBS[type] || null;
export const familyOf = (type, tpl = templateOf(type)) => tpl?.family || FAMILY[type] || 'beast';

// ------------------------------------------------------------------------------------------------ anchors
const warned = new Set();
export function warnOnce(key, ...msg) { if (warned.has(key)) return; warned.add(key); console.info('[story]', ...msg); }
/**
 * first existing anchor among names → { x, z, facing, name } or null. names: 'anchor' | [entries]; an entry is an anchor
 * name, [name, dx, dz], an absolute point [x, z] (numbers) or { x, z } — so content can say at: ['poi:x', [0, -74]].
 */
export function anchorOf(zone, names, off = null) {
  const A = zone?.anchors || {};
  const list = typeof names === 'string' || (Array.isArray(names) && typeof names[0] === 'number') || (names && !Array.isArray(names)) ? [names] : (names || []);
  for (const n of list) {
    if (n && typeof n === 'object' && !Array.isArray(n)) return { x: n.x + (off?.[0] || 0), z: n.z + (off?.[1] || 0), facing: n.facing || 0, name: 'point' };
    if (Array.isArray(n) && typeof n[0] === 'number') return { x: n[0] + (off?.[0] || 0), z: n[1] + (off?.[1] || 0), facing: n[2] || 0, name: 'point' };
    const [name, dx = 0, dz = 0] = Array.isArray(n) ? n : [n];
    const a = A[name]; if (!a) continue;
    return { ...a, x: a.x + dx + (off?.[0] || 0), z: a.z + dz + (off?.[1] || 0), name };
  }
  return null;
}
/** nearest walkable point to (x, z) (falls back to the point itself) */
export function walkable(L, x, z, r = 8, clr = 0.2) { const p = (clr > 0.2 && L?.nav?.nearest?.(x, z, r, clr)) || L?.nav?.nearest?.(x, z, r, 0.2); return p ? { x: p.x, z: p.z } : { x, z }; }
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const facingTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

// ------------------------------------------------------------------------------------------------ models
function heroModel(o) {
  try { if (PROVIDERS.hero) return PROVIDERS.hero(o); } catch (e) { console.warn('[story] hero model', o.npc, e); }
  return placeholderHero({ npc: o.npc });
}

// ------------------------------------------------------------------------------------------------ enemies
/**
 * A level-scaled open-world enemy. type: FIELD_MOBS / MOBS id. o: { level, x, z, facing, elite, hpMul, atkMul, scale,
 * name, tag, alert, aggro, lod }. Humanoids (tpl.npc) get a hero NPC model; others a creature model.
 */
export function makeFieldMob(type, o = {}) {
  const tpl = templateOf(type); if (!tpl) throw new Error('no field mob ' + type);
  const level = Math.max(1, Math.round(o.level || 5));
  const ref = o.ref || refFor(level);
  const elite = !!(o.elite ?? tpl.elite);
  const hpMul = (o.hpMul ?? 1) * (elite && !tpl.elite && !o.named ? 4 : 1);
  const scale = (o.scale || 1) * (tpl.scale || 1);
  const u = new Unit({
    kind: 'mob', team: 1, type, name: o.name || tpl.name, level,
    x: o.x, z: o.z, facing: o.facing ?? Math.random() * 6.28, radius: tpl.radius * (o.scale || 1), height: tpl.height * (o.scale || 1), mass: tpl.mass,
    stats: { hpMax: Math.round(tpl.hp * ref.ap * hpMul), atk: tpl.atk * ref.hp / 0.55 * (o.atkMul ?? 1), def: 800 + level * 60, speed: tpl.speed, mpMax: 0, mpRegen: 0, crit: 0.05 },
    superArmor: tpl.superArmor || 0,
  });
  u.data.elite = elite; u.data.tpl = { ...tpl, model: tpl.model || type }; u.data.scale = scale; u.data.tag = o.tag || null; u.data.family = familyOf(type, tpl);
  u.data.xp = Math.round((tpl.xp || 5) * (elite ? 3 : 1) * (o.xpMul || 1) * xpForLevel(level) / 150);
  if (tpl.poise) u.data.poise = tpl.poise * (elite ? 2 : 1);
  if (tpl.npc) {
    u.data.npc = tpl.npc; u.data.sex = o.sex || tpl.sex || (Math.random() < 0.3 ? 'f' : 'm');
    u.model = heroModel({ cls: null, sex: u.data.sex, npc: tpl.npc, look: {}, lod: o.lod || 'crowd', seed: (o.seed ?? Math.floor(Math.random() * 999)) });
    if (scale !== 1) u.model.root.scale.setScalar(scale);
  }
  if (tpl.immobile) { u.data.immovable = true; u.data.flinch = false; u.ctrl = null; }
  else u.ctrl = new MobAI(u, tpl, { alert: o.alert, aggro: o.aggro ?? tpl.aggro, delay: o.delay });
  return u;
}

// ------------------------------------------------------------------------------------------------ friendly units
/**
 * An NPC resident / story character. def: { id, name, title, npc | creature, variant, sex, lines, action, portrait }.
 * The unit is interactable through data.npcDef (session.interact → quests plugin → dialog).
 */
export function makeResident(def, at, o = {}) {
  const u = new Unit({ kind: 'npc', team: 2, name: def.name, x: at.x, z: at.z, facing: at.facing ?? o.facing ?? Math.PI, radius: 0.5, height: 1.85, stats: { hpMax: 1, speed: 2 } });
  u.data.npcDef = { id: def.id, name: def.name, title: def.title, lines: def.lines || [], action: def.action || null, portrait: def.portrait || null, rapport: def.rapport || null };
  u.data.title = def.title; u.data.immovable = true; u.untargetable = true;
  if (def.creature) {
    u.type = def.creature; u.data.tpl = { model: def.creature }; u.data.variant = def.variant || undefined; u.data.look = null;
    const cs = def.scale || 1; u.data.scale = cs; u.height = (def.creature === 'pip' ? 0.7 : def.creature === 'treant' ? 4.2 : 1.2) * cs; u.radius = def.creature === 'treant' ? 1.4 * cs : 0.4;
  } else {
    u.data.npc = def.npc || 'villager'; u.data.look = {}; u.data.sex = def.sex || 'm'; u.data.lod = o.lod || 'full';
    // build the model here so every local gets their own face (seeded by id) and background folk use the cheap LOD
    u.model = heroModel({ cls: null, sex: u.data.sex, npc: u.data.npc, look: {}, lod: u.data.lod, seed: hashId(def.id || def.name) });
  }
  if (o.story) u.data.storyNpc = def.id;
  return u;
}
export const storyDef = id => STORY_NPCS[id] ? { id, ...STORY_NPCS[id] } : null;
const hashId = str => { let h = 7; for (const c of String(str || '')) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };

/**
 * A friendly fighter (Brannoc in the prologue, sappers, escorts): a hero-model unit on the player's team with a mob brain
 * that hunts enemies and follows a leader when idle. o: { level, leader (unit), follow (m), atkMul, hpMul, attacks, name, npc }
 */
export function makeAlly(def, at, o = {}) {
  const level = Math.max(1, o.level || 5), ref = refFor(level);
  const u = new Unit({ kind: 'hero', team: 0, name: def.name, x: at.x, z: at.z, facing: at.facing ?? 0, radius: 0.45, height: 1.85,
    stats: { hpMax: Math.round(ref.hp * (o.hpMul ?? 3)), atk: Math.round(ref.ap * (o.atkMul ?? 1)), def: 800 + level * 60, speed: o.speed ?? 5.2, mpMax: 0, mpRegen: 0, crit: 0.1 } });
  u.data.npc = def.npc || 'knight'; u.data.sex = def.sex || 'm'; u.data.title = def.title; u.data.ally = true; u.data.lod = 'full';
  u.data.hpFloor = Math.round(u.hpMax * (o.floor ?? 0.2));   // story allies never die
  u.data.npcDef = o.talkable ? { id: def.id, name: def.name, title: def.title, lines: def.lines || [] } : null;
  u.model = heroModel({ cls: null, sex: u.data.sex, npc: u.data.npc, look: {}, lod: 'full', seed: 7 });
  const tpl = { name: def.name, speed: o.speed ?? 5.2, aggro: 16, attacks: o.attacks || ALLY_ATTACKS };
  u.ctrl = new AllyBrain(u, tpl, o);
  return u;
}
const ALLY_ATTACKS = [
  { id: 'cleave', range: 2.2, cd: 1.5, windup: 0.3, dur: 0.85, anim: 'slash_h', sfx: 'slash', hit: { shape: 'cone', r: 3, angle: 2.4, coef: 2.2 } },
  { id: 'smite', range: 2.4, cd: 4.5, windup: 0.5, dur: 1.2, anim: 'slash_v', sfx: 'slash_heavy', hit: { shape: 'circle', r: 3.2, coef: 4, knock: 'down', off: 1 } },
];
/** MobAI that fights for the player: acquires the nearest enemy near itself or its leader, follows the leader when idle,
 *  can be parked (hold) or sent somewhere (goto). */
export class AllyBrain extends MobAI {
  constructor(u, tpl, o = {}) {
    super(u, tpl, { alert: false, aggro: 16 });
    this.leader = o.leader || null; this.followDist = o.follow ?? 3.2; this.hold = false; this.dest = null; this.regen = o.regen ?? 0.04;
  }
  update(dt, L) {
    const u = this.u;
    if (u.hp < u.hpMax) u.hp = Math.min(u.hpMax, u.hp + u.hpMax * this.regen * dt);
    if (this.dest) {
      u.move.x = u.move.z = 0;
      const dx = this.dest.x - u.pos.x, dz = this.dest.z - u.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { this.dest.done?.(); this.dest = null; return; }
      const sp = (this.dest.speed || u.st.speed);
      u.move.x = dx / d * sp; u.move.z = dz / d * sp; return;
    }
    if (this.hold) { u.move.x = u.move.z = 0; return; }
    super.update(dt, L);
  }
  goto(x, z, speed) { return new Promise(res => { this.dest = { x, z, speed, done: res }; }); }
  idle(dt, L) {
    const u = this.u, l = this.leader;
    if (!l || l.dead) return super.idle(dt, L);
    const dx = l.pos.x - l.fx * 1.5 - u.pos.x, dz = l.pos.z - l.fz * 1.5 - u.pos.z, d = Math.hypot(dx, dz);
    if (d > this.followDist) { const sp = Math.min(u.st.speed * 1.15, d * 2); u.move.x = dx / d * sp; u.move.z = dz / d * sp; }
    else if (d > 0.5) u.faceTo(l.pos.x, l.pos.z);
  }
}

/** a static prop unit showing a creature model (pip_seed, a crate stand-in…): not targetable, no collisions */
export function makeProp(model, at, o = {}) {
  const u = new Unit({ kind: 'object', team: 2, name: o.name || model, x: at.x, z: at.z, facing: at.facing ?? 0, radius: 0.3, height: o.height || 0.6, stats: { hpMax: 1, speed: 0 } });
  u.untargetable = true; u.data.ghostWalk = true; u.data.immovable = true; u.data.tpl = { model }; u.data.variant = o.variant; u.data.scale = o.scale || 1;
  return u;
}
