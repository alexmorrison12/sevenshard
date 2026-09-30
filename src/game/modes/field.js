// Open-world field play (Goldmeadow, Thornwood, Ashen Ridge, Pipsprout Hollow): residents at npc:* anchors, mob packs
// at pack:* anchors (streamed in around the hero, level-scaled to the zone, respawning), named elites, zone travel through
// gate:* anchors, triports, Pip Seeds, vistas, lore books, trade-skill nodes, ground loot with grade beams, kill XP with
// level-up celebrations, out-of-combat regeneration, and Pip-scale shrinking in Pipsprout Hollow.
// Also a small plugin for travel from Solhaven's west gate and for every triport statue.
import { registerZoneMode, registerPlugin, ZONE_MODES } from '../registry.js';
import '../../world/zones/goldmeadow.js';          // field zones self-register when imported (harmless if the world
import '../../world/zones/thornwood.js';           // index already imports them)
import '../../world/zones/ashen_ridge.js';
import '../../world/zones/pipsprout.js';
import { ZONES } from '../providers.js';
import { FIELDS, FIELD_NPCS, GENERIC_NPC, LOCALS, PACK_TAGS, NODES, FALLBACK_LAYOUT, GATE_FALLBACK } from '../../data/field.js';
import { LORE } from '../../data/quests/lore.js';
import { makeFieldMob, makeResident, makeProp, anchorOf, walkable, dist, warnOnce, templateOf } from '../quests/spawn.js';
import { makeFieldProp } from '../quests/props.js';
import { applyStatus, removeStatus } from '../combat.js';
import { storyGear } from '../systems/gear.js';
import { itemLevel } from '../systems/stats.js';
import { GEAR_SLOTS } from '../../data/items.js';
import * as LIFE from '../systems/lifeskills.js';
import * as COLL from '../systems/collectibles.js';
import * as LOOT from '../systems/loot.js';
import { grantBundle } from '../systems/common.js';
import { Cutscene } from '../quests/cutscene.js';
import { xpScale } from '../quests/system.js';

const FIELD_IDS = ['goldmeadow', 'thornwood', 'ashen_ridge', 'pipsprout'];
const ZONE_NAME = id => FIELDS[id]?.name || ZONES[id]?.name || ({ solhaven: 'Solhaven', brighthold: 'Brighthold' })[id] || id;
const SEED_VARIANTS = ['gold', 'jade', 'rose'];
const ACTIVE_R = 58, SLEEP_R = 82;        // packs stream in / out around the hero
const SAFE_R = 16;                        // packs keep this far from anyone you might stop to talk to

/** zones whose real builder hasn't landed load as a plain arena: give them the story layout so the content works */
export function ensureAnchors(id, zone) {
  if (!zone) return;
  zone.anchors ||= {};
  const real = !!ZONES[id];
  const F = FALLBACK_LAYOUT[id];
  if (!real && F) { for (const [k, a] of Object.entries(F)) if (!zone.anchors[k]) zone.anchors[k] = { ...a }; zone.fallbackLayout = true; }
  if (FIELDS[id]?.name) zone.name = FIELDS[id].name;
  zone.id = id;
}

export class FieldMode {
  constructor(session, zone, o = {}) {
    this.s = session; this.g = session.game; this.zone = zone; this.id = zone?.id; this.o = o;
    this.cfg = FIELDS[this.id] || { name: zone?.name, levels: [1, 60], music: 'field', ambience: 'meadow' };
    this.kind = this.cfg.shrink ? 'pipsprout' : 'field';        // not 'field' in Pipsprout: no full-size mounts/pets there
    this.npcs = []; this.packs = []; this.objs = []; this.drops = []; this.offs = []; this.t = 0; this.channel = null; this.safe = null; this.safeT = 0;
    this.quiet = new Map();                  // story fights in progress: no field packs inside these circles
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  get Q() { return this.s.quests; }
  get A() { return this.s.account; }
  get char() { return this.s.char; }
  level(bonus = 0) { const [a, b] = this.cfg.levels || [1, 60]; return Math.max(1, Math.max(a, Math.min(b, this.char?.level || a)) + bonus); }
  // ---------------------------------------------------------------- setup
  enter() {
    const z = this.g.zone; if (!z) return;
    ensureAnchors(this.id, z);
    this.zone = z;
    const A = z.anchors;
    this.spawnResidents();
    for (const [k, a] of Object.entries(A)) {
      if (k.startsWith('pack:')) this.packs.push({ key: k, a, units: [], t: 0, state: 'sleep', elite: false });
      else if (k.startsWith('elite:')) this.packs.push({ key: k, a, units: [], t: 0, state: 'sleep', elite: true });
      else if (k.startsWith('seed:')) this.addSeed(k, a);
      else if (k.startsWith('node:')) this.addObj('node', k, a, { skill: a.skill || k.split(':')[1] });
      else if (k.startsWith('lore:')) this.addObj('lore', k, a);
      else if (k.startsWith('vista:')) this.addObj('vista', k, a);
      else if (k.startsWith('triport:')) this.addObj('triport', k, a, { prop: false });
      else if (k.startsWith('gate:') && travelable(k.slice(5))) this.addObj('gate', k, a, { prop: false, to: k.slice(5) });
    }
    // the fairy-ring ways between Goldmeadow and the Hollow when the zones have no explicit gates for them
    if (this.id === 'goldmeadow' && !A['gate:pipsprout']) {
      const p = anchorOf(z, GATE_FALLBACK['goldmeadow>pipsprout']);
      if (p) { const w = walkable(this.L, p.x, p.z, 7, 1.8); A['gate:pipsprout'] = { x: w.x, z: w.z, facing: Math.PI }; this.addObj('gate', 'gate:pipsprout', { ...w, facing: Math.PI }, { prop: false, to: 'pipsprout', locked: () => !this.Q?.isActive('g8_hollow') && !this.Q?.isDone('g8_hollow') && !this.A.roster.unlocked?.pipsprout, ring: true, ringFx: true }); }
    }
    if (this.id === 'pipsprout' && !A['gate:goldmeadow']) {
      const p = anchorOf(z, GATE_FALLBACK['pipsprout>goldmeadow']);
      if (p) { const w = walkable(this.L, p.x, p.z, 7, 1.8); A['gate:goldmeadow'] = { x: w.x, z: w.z, facing: 0 }; this.addObj('gate', 'gate:goldmeadow', { ...w, facing: 0 }, { prop: false, to: 'goldmeadow', ring: true, ringFx: true }); }
    }
    for (const o of this.objs) if (o.ringFx) { try { const h = this.g.fx?.play?.('portal_flash', { pos: { x: o.x, y: this.L.heightAt(o.x, o.z), z: o.z } }); void h; o.portalFx = this.g.fx?.portal?.({ pos: { x: o.x, y: this.L.heightAt(o.x, o.z) + 0.05, z: o.z }, color: 'nature', radius: this.cfg.shrink ? 1.2 : 1.6, flat: true }); } catch { /* */ } }
    this.offs.push(this.L.on('death', ev => this.onDeath(ev)));
    this.g.audio?.music?.(this.cfg.music || 'field');
    this.g.audio?.ambience?.(this.cfg.ambience || 'meadow');
    this.g.ui?.banner?.(this.cfg.name || z.name, { kind: 'zone', sub: this.cfg.region || 'Valemont', dur: 3.2 });
    if (this.cfg.shrink || z.scale) this.shrink(true);
    if (z.fallbackLayout) warnOnce('fallback:' + this.id, `${this.id}: zone not built yet — using the story fallback layout`);
    this.attuneT = 0;
  }
  exit() {
    for (const f of this.offs) f(); this.offs = [];
    for (const o of this.objs) { if (o.prop?.isObject3D) { o.prop.removeFromParent(); o.prop.userData?.dispose?.(); } o.portalFx?.stop?.(); }
    for (const d of this.drops) d.beam?.stop?.();
    this.objs = []; this.drops = []; this.channel = null;
    if (this.shrunk) this.shrink(false);
  }
  spawnResidents() {
    const z = this.zone, L = this.L, A = z.anchors;
    const list = FIELD_NPCS[this.id] || [], claimed = new Set(), place = [];
    const npcAnchors = Object.keys(A).filter(k => k.startsWith('npc:'));
    // residents take the first free anchor they prefer (npc anchors are exclusive; poi anchors can be shared)
    const pick = r => { for (const e of r.at || []) { const name = Array.isArray(e) ? e[0] : e; if (!A[name] || (name.startsWith('npc:') && claimed.has(name))) continue; if (name.startsWith('npc:')) claimed.add(name); const a = anchorOf(z, [e]); return a; } return null; };
    for (const r of list) { const a = pick(r); if (a) place.push([r, a, 'full']); }
    for (const r of list.filter(r => !place.some(p => p[0] === r))) { const n = npcAnchors.find(k => !claimed.has(k)); if (n) { claimed.add(n); place.push([r, A[n], 'full']); } else warnOnce('res:' + r.id, `${this.id}: no npc anchor left for ${r.id}`); }
    const gen = GENERIC_NPC[this.id] || [{ name: 'Local', npc: 'villager', lines: ['Safe travels.'] }];
    npcAnchors.filter(n => !claimed.has(n)).forEach((n, i) => { const id = n.slice(4), g = LOCALS[id] || { ...gen[i % gen.length], name: NAMES[id] || gen[i % gen.length].name, title: TITLES[id] || gen[i % gen.length].title || '' }; place.push([{ id, ...g }, A[n], 'crowd']); });
    for (const [r, a, lod] of place) {
      const u = makeResident({ ...r, action: r.action || ACTIONS[r.id] || null }, { x: a.x, z: a.z, facing: a.facing ?? Math.PI }, { lod });
      L.add(u); this.npcs.push(u);
    }
  }
  // ---------------------------------------------------------------- objects
  addObj(kind, key, a, o = {}) {
    const { prop: wantProp, ...rest } = o;
    const obj = { kind, key, x: a.x, z: a.z, facing: a.facing || 0, cd: 0, ...rest };
    if (wantProp !== false) {
      const propKind = kind === 'node' ? obj.skill : kind;
      const y = this.L.heightAt(a.x, a.z);
      obj.prop = makeFieldProp(propKind, a.x, y, a.z, a.facing || 0);
      this.g.scene.add(obj.prop);
    }
    if (kind === 'vista' || kind === 'lore') obj.done = this.collected(kind, key);
    if (obj.done) obj.prop?.userData.setActive?.(false);
    this.objs.push(obj);
    return obj;
  }
  seedId(key) { return `seed:${this.id}:${key.split(':')[1]}`; }
  addSeed(key, a) {
    const id = this.seedId(key);
    if ((this.A.roster.collect?.seeds || []).includes(id)) return;
    this.objs.push({ kind: 'seed', key, id, x: a.x, z: a.z, variant: SEED_VARIANTS[(+key.split(':')[1] || 0) % 3], hint: a.hint });
  }
  vistaId(key) { const n = key.slice(6); return /^\d+$/.test(n) ? (this.cfg.vistas || [])[+n - 1] || `vista:${this.id}:${n}` : `vista:${n}`; }
  loreId(key) { const n = key.slice(5); return /^\d+$/.test(n) ? (this.cfg.lore || [])[+n - 1] || `lore:${this.id}:${n}` : `lore:${n}`; }
  collected(kind, key) {
    const r = this.A.roster;
    if (kind === 'vista') return (r.collect?.vistas || []).includes(this.vistaId(key));
    if (kind === 'lore') { const t = r.tome?.[this.cfg.tome || this.id]?.lore || []; return t.includes(this.loreId(key)) || (r.flags?.lore || []).includes(this.loreId(key)); }
    return false;
  }
  // ---------------------------------------------------------------- per frame
  update(dt) {
    const me = this.me; if (!me || !this.L) return;
    this.t += dt;
    // packs stream in/out and respawn
    this.safeT -= dt;
    const recheck = this.safeT <= 0; if (recheck) { this.safeT = 2; this.safe = null; }
    // co-op guest: the host owns the field's monsters (we see theirs), so no packs of our own
    for (const p of this.s.guestMode ? [] : this.packs) {
      const d = dist(me.pos, p.a), alive = p.units.filter(u => u.level && !u.dead);
      if (p.state === 'sleep') { if (d < ACTIVE_R && !this.isQuiet(p.a)) this.spawnPack(p); continue; }
      const calm = alive.every(u => u.combatT <= 0);
      if (d > SLEEP_R && calm) { for (const u of alive) this.L.remove(u); p.units = []; p.state = 'sleep'; continue; }
      // a story NPC turned up next to an idle pack: send the pack elsewhere (it re-forms clear of the NPC)
      if (recheck && calm && alive.length && d > 20 && alive.some(u => this.safeSpots().some(s => dist(s, u.pos) < SAFE_R - 4))) { for (const u of alive) this.L.remove(u); p.units = []; p.state = 'sleep'; continue; }
      if (!alive.length) {
        if (p.t <= 0) p.t = p.elite ? 110 + Math.random() * 40 : 26 + Math.random() * 16;
        p.t -= dt;
        if (p.t <= 0 && d > 16 && !this.isQuiet(p.a)) this.spawnPack(p);
      }
    }
    // seeds appear near the hero
    for (const o of this.objs) {
      if (o.kind === 'seed') {
        const d = dist(me.pos, o);
        if (!o.unit && d < 42) { o.unit = makeProp('pip_seed', { x: o.x, z: o.z, facing: 0 }, { name: 'Pip Seed', variant: o.variant, scale: this.cfg.shrink ? 1.6 : 1 }); this.L.add(o.unit); }
        else if (o.unit && d > 60) { this.L.remove(o.unit); o.unit = null; }
      } else if (o.prop) {
        o.prop.visible = dist(me.pos, o) < 70;
        if (o.prop.visible) o.prop.userData.update?.(dt);
        if (o.cd > 0) { o.cd -= dt; if (o.cd <= 0) o.prop.userData.setActive?.(true); }
      }
    }
    // loot on the ground
    this.updateDrops(dt);
    // gathering channel
    if (this.channel) this.tickChannel(dt);
    // out-of-combat regeneration (Lost Ark style)
    if (!me.dead && me.combatT <= 0 && me.hp < me.hpMax) me.hp = Math.min(me.hpMax, me.hp + me.hpMax * 0.035 * dt);
    // the shrink follows a rebuilt hero model — and friends (co-op) are Pip-sized here too
    if (this.shrunk) for (const u of this.L.units) if (u.kind === 'hero' && u.model && u.model.root.scale.x !== this.shrunk && (u === me || u.remote || u.puppet || u.party)) u.model.root.scale.setScalar(this.shrunk);
    // triports attune by walking past them
    this.attuneT -= dt;
    if (this.attuneT <= 0) { this.attuneT = 0.5; for (const o of this.objs) if (o.kind === 'triport' && dist(me.pos, o) < 5) attune(this.s, o.key); }
  }
  /** a quest fight (boss encounter, defence) claims a circle: packs inside it leave and don't come back until it ends */
  quietZone(key, z) {
    if (!z) { this.quiet.delete(key); return; }
    this.quiet.set(key, z);
    for (const p of this.packs) {
      if (p.state === 'sleep' || !this.isQuiet(p.a)) continue;
      for (const u of p.units) if (u.level && !u.dead) { this.g.presenter?.call?.('play', 'spawn_puff', { pos: u.pos, x: u.pos.x, z: u.pos.z }); this.L.remove(u); }
      p.units = []; p.state = 'sleep';
    }
  }
  isQuiet(a) { for (const q of this.quiet.values()) if (dist(q, a) < q.r + (a.r || 6)) return true; return false; }
  /** everyone the hero might stop and talk to (residents and story NPCs); packs keep clear of them */
  safeSpots() {
    return this.safe ||= this.L.units.filter(u => u.kind === 'npc' && u.data.npcDef && !u.data.npcDef.object && !u.data.storyHidden && !u.dead).map(u => ({ x: u.pos.x, z: u.pos.z }));
  }
  /** a pack anchor nudged out of every NPC's safe circle (null: no room here) */
  packCentre(a0) {
    const spots = this.safeSpots(), R = SAFE_R + (a0.r || 6) * 0.65;
    let c = { x: a0.x, z: a0.z, r: a0.r, tag: a0.tag };
    for (let k = 0; k < 3; k++) {
      const sp = spots.find(q => dist(q, c) < R); if (!sp) return c;
      const d = dist(sp, c), nx = d > 0.01 ? (c.x - sp.x) / d : 1, nz = d > 0.01 ? (c.z - sp.z) / d : 0;
      c = { ...walkable(this.L, sp.x + nx * (R + 1.5), sp.z + nz * (R + 1.5), 8), r: a0.r, tag: a0.tag };
    }
    return spots.some(q => dist(q, c) < R - 4) ? null : c;
  }
  spawnPack(p) {
    const L = this.L, me = this.me;
    p.units = []; p.state = 'awake'; p.t = 0;
    const a = this.packCentre(p.a);
    if (!a) { p.t = 60; return; }                 // no room away from the locals: stay quiet for a while
    if (p.elite) {
      const E = this.cfg.elites || [];
      const idx = Math.max(0, (+p.key.split(':')[1] || 1) - 1), match = E.filter(x => x.tag === a.tag);
      const e = (match.length ? match[idx % match.length] : E[idx % Math.max(1, E.length)]) || { type: 'wolf', name: 'Alpha Wolf', hpMul: 1 };
      if (!templateOf(e.type)) return;
      const pt = walkable(L, a.x, a.z, 5);
      const u = makeFieldMob(e.type, { level: this.level(2), x: pt.x, z: pt.z, elite: true, named: !!FIELD_MOB_NAMED[e.type], name: e.name, hpMul: e.hpMul, scale: e.scale, tag: a.tag });
      u.data.fieldPack = p.key; L.add(u); p.units.push(u);
      return;
    }
    const tag = a.tag && PACK_TAGS[a.tag] ? a.tag : this.cfg.defaultPack;
    const mix = PACK_TAGS[tag] || [['wolf', 1]];
    const n = Math.max(3, Math.min(6, Math.round((a.r || 6) * 0.62)));
    const lvl = this.level((+p.key.split(':')[1] || 0) % 3);
    for (let i = 0; i < n; i++) {
      const type = weighted(mix);
      if (!templateOf(type)) continue;
      const ang = Math.random() * Math.PI * 2, rr = (a.r || 6) * 0.65 * Math.sqrt(Math.random());
      const pt = walkable(L, a.x + Math.cos(ang) * rr, a.z + Math.sin(ang) * rr, 5);
      if (me && dist(pt, me.pos) < 6) continue;
      const u = makeFieldMob(type, { level: lvl, x: pt.x, z: pt.z, tag: a.tag || tag, delay: Math.random() * 0.6 });
      u.data.fieldPack = p.key; L.add(u); p.units.push(u);
    }
  }
  // ---------------------------------------------------------------- kills: XP & loot
  onDeath({ unit: u, killer }) {
    if (!u || (u.kind !== 'mob' && u.kind !== 'boss') || u.data.noLoot) return;
    const me = this.me; if (!me) return;
    const ours = killer === me || killer?.team === 0 || dist(u.pos, me.pos) < 26;
    if (!ours) return;
    if (u.data.xp && !u.data.noXp) this.Q?.grantXp(Math.round(u.data.xp * Math.min(1, xpScale(u.lv || 1, this.char?.level || 1))));
    this.dropLoot(u);
  }
  dropLoot(u) {
    const A = this.A, c = this.char; if (!c) return;
    const kind = u.data.named || u.kind === 'boss' ? 'named' : u.data.elite ? 'elite' : 'mob';
    let bundle = {};
    try { const r = LOOT.fieldDrop?.(A, c, { kind, grant: false }); if (r?.ok) bundle = { ...r.bundle }; } catch (e) { warnOnce('loot', 'fieldDrop failed', e); }
    if (!LOOT.fieldDrop) { if (Math.random() < 0.4) bundle.silver = Math.round(20 + u.lv * 6 * Math.random()); if (kind !== 'mob') bundle.silver = (bundle.silver || 0) + 400 + u.lv * 30; }
    // story gear keeps the MSQ journey rewarding (Lost Ark-style drops before the endgame)
    if (!c.powerpass && (c.level || 1) < 50 && Math.random() < (kind === 'mob' ? 0.03 : kind === 'elite' ? 0.3 : 0.7)) {
      const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
      const grade = kind === 'mob' ? (Math.random() < 0.2 ? 2 : 1) : kind === 'elite' ? 2 + (Math.random() < 0.25 ? 1 : 0) : 3;
      (bundle.items ||= []).push(storyGear(u.lv || c.level || 1, slot, c.cls, grade));
    }
    const silverOnly = Object.keys(bundle).every(k => k === 'silver');
    if (!Object.keys(bundle).length) return;
    if (silverOnly) { A.give('silver', bundle.silver); this.fxPickup(u.pos, 'silver'); if (bundle.silver >= 100) this.g.ui?.hud?.loot?.({ name: 'Silver', count: bundle.silver, grade: 1, icon: 'currency:silver', kind: 'currency' }); return; }
    const grade = Math.max(1, ...Object.keys(bundle).filter(k => k !== 'items' && k !== 'silver').map(k => ITEM_GRADE(k)), ...(bundle.items || []).map(it => it.grade || 1));
    const pos = { x: u.pos.x + (Math.random() - 0.5), y: this.L.heightAt(u.pos.x, u.pos.z), z: u.pos.z + (Math.random() - 0.5) };
    let beam = null; try { beam = this.g.fx?.lootBeam?.({ pos, grade, dur: 60 }); } catch { /* fx optional */ }
    this.drops.push({ ...pos, bundle, grade, beam, t: 0 });
    this.g.audio?.sfx?.(grade >= 4 ? 'loot_legendary' : grade >= 2 ? 'loot_rare' : 'loot_drop', { pos });
  }
  updateDrops(dt) {
    const me = this.me; if (!me || !this.drops.length) return;
    const pet = !!(this.char?.pet || this.A.roster.pets?.length);
    const R = pet ? 9 : 2.2;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt;
      if (d.t > 90) { d.beam?.stop?.(); this.drops.splice(i, 1); continue; }
      if (me.dead || dist(me.pos, d) > R || d.t < 0.5) continue;
      d.beam?.stop?.(); this.drops.splice(i, 1);
      const rows = grantBundle(this.A, this.char, d.bundle);
      for (const r of rows) this.g.ui?.hud?.loot?.(r);
      for (const it of d.bundle.items || []) this.maybeEquip(it);
      this.fxPickup(d, d.grade >= 2 ? 'item' : 'silver');
    }
  }
  /** auto-equip story gear upgrades (story characters only; never replaces Vanguard/Horned pieces) */
  maybeEquip(it) {
    const c = this.char; if (!it?.slot || it.set !== 'story') return;
    const cur = c.equip?.[it.slot];
    if (cur && (cur.set !== 'story' || (cur.iLvl || 0) >= it.iLvl)) return;
    const inv = c.inv.find(x => x.uid === it.uid); if (!inv) return;
    this.A.equip(c, inv); c.ilvl = itemLevel(c);
    this.s.refreshChar?.();
    this.g.ui?.toast?.(`Equipped ${it.name} (item level ${it.iLvl}).`, 'loot');
  }
  fxPickup(p, kind) { try { this.g.fx?.pickup?.({ pos: { x: p.x, y: (p.y ?? this.L.heightAt(p.x, p.z)) + 0.3, z: p.z }, kind, to: this.me?.model?.root }); } catch { /* */ } this.g.audio?.sfx?.('coin', { pos: p }); }
  // ---------------------------------------------------------------- interaction
  interactable() {
    const me = this.me; if (!me || me.dead || this.channel) return null;
    let best = null, bd = Infinity;
    const Q = this.Q, bonus = u => { const b = Q?.business?.(u.data.npcDef?.id); return b?.talk.length ? 1.6 : b?.offer.length ? 0.7 : 0; };
    for (const u of this.npcs) { if (!u.level || u.dead) continue; const d = me.distTo(u); if (d > 3.2) continue; const sc = d - bonus(u); if (sc < bd) { bd = sc; best = u; } }
    for (const o of this.objs) {
      const r = o.kind === 'gate' ? 4.2 : o.kind === 'triport' ? 3.4 : o.kind === 'seed' ? 2.2 : 2.6;
      const d = dist(me.pos, o); if (d > r) continue;
      const sc = d - (o.kind === 'gate' && Q?.wantsZone?.(o.to) ? 2.4 : 0);   // the way the story wants beats a chat
      if (sc >= bd) continue;
      if (o.kind === 'seed' && !o.unit) continue;
      if (o.kind === 'node' && o.cd > 0) continue;
      bd = sc; best = o;
    }
    if (!best || best.pos) return best;
    const o = best;
    const label = { seed: 'Pick up', node: NODES[o.skill]?.label || 'Gather', lore: 'Read', vista: 'Admire the view', triport: 'Triport', gate: 'Travel' }[o.kind];
    const name = { seed: 'Pip Seed', node: NODES[o.skill]?.name || 'Resource', lore: LORE[this.loreId(o.key)]?.title || 'Old Book', vista: 'Vista', triport: `Triport: ${ZONE_NAME(o.key.slice(8))}`, gate: `To ${ZONE_NAME(o.to)}` }[o.kind];
    return { name, label, pos: { x: o.x, z: o.z }, ...(o.kind === 'gate' ? { portal: o.key } : { data: { npcDef: { object: true } } }), fobj: o };
  }
  interact(t) {
    const o = t?.fobj; if (!o) return false;
    const me = this.me; if (me) { me.faceTo(o.x, o.z); this.g.player?.stop?.(); }
    if (o.kind === 'seed') this.takeSeed(o);
    else if (o.kind === 'node') this.startGather(o);
    else if (o.kind === 'lore') this.readLore(o);
    else if (o.kind === 'vista') this.viewVista(o);
    else if (o.kind === 'triport') triportMenu(this.s, o.key);
    else if (o.kind === 'gate') {
      if (o.locked?.()) { this.g.ui?.toast?.(o.to === 'pipsprout' ? 'A ring of tiny mushrooms. Something small and green must show you the way.' : 'The way is closed.', 'info'); return true; }
      travel(this.s, o.to, { from: this.id });
    }
    return true;
  }
  takeSeed(o) {
    const me = this.me, A = this.A, c = this.char;
    me?.model?.play?.('pickup', { dur: 0.7 });
    o.unit?.model?.play?.('collect', { dur: 0.9 });
    let res = null;
    try { res = COLL.collect?.(A, c, 'seeds', o.id); } catch (e) { warnOnce('seed', 'collect failed', e); }
    if (!res || res.ok === false) { const list = (A.roster.collect ||= {}).seeds ||= []; if (!list.includes(o.id)) list.push(o.id); A.save(); res = { have: list.length, total: 120 }; }
    this.g.audio?.sfx?.('pip_cheer', { pos: o }); this.fxPickup(o, 'seed');
    this.g.ui?.toast?.(`Pip Seed found! (${res.have}/${res.total || 120})${res.ready?.length ? ' — a collection reward is ready in the Adventure Tome.' : ''}`, 'success');
    this.s.bus.emit('collect', { id: o.id, type: 'seeds', n: 1, zone: this.id });
    const u = o.unit; o.unit = null;
    this.objs = this.objs.filter(x => x !== o);
    if (u) setTimeout(() => { if (u.level) u.level.remove(u); }, 900);
  }
  startGather(o) {
    const N = NODES[o.skill] || NODES.forage, me = this.me; if (!me) return;
    me.model?.play?.(N.anim, { dur: N.dur, loop: true });
    this.channel = { o, t: 0, dur: N.dur, x: me.pos.x, z: me.pos.z, hp: me.hp, label: N.label };
    this.g.audio?.sfx?.(o.skill === 'mine' ? 'mine' : o.skill === 'log' ? 'chop' : o.skill === 'fish' ? 'fishing_cast' : o.skill === 'dig' ? 'dig' : 'gather', { pos: me.pos });
  }
  tickChannel(dt) {
    const c = this.channel, me = this.me;
    if (!me || me.dead || me.skill || Math.hypot(me.pos.x - c.x, me.pos.z - c.z) > 0.6 || me.hp < c.hp - me.hpMax * 0.05) { this.channel = null; me?.model?.stop?.(); return; }
    c.t += dt;
    if (c.t < c.dur) return;
    this.channel = null; me.model?.stop?.();
    const o = c.o, A = this.A, ch = this.char;
    let rows = null;
    if (LIFE.gather) { const r = LIFE.gather(A, ch, o.skill); if (r?.ok === false) { this.g.ui?.toast?.(r.msg || 'You are too tired to gather (Life Energy).', 'warn'); return; } rows = r?.rows || []; if (r?.levelUp) this.g.ui?.toast?.(`${o.skill[0].toUpperCase() + o.skill.slice(1)} skill level ${r.level}!`, 'success'); }
    else { const b = {}; for (const [id, a, bb, ch2] of (NODES[o.skill] || NODES.forage).yield) if (Math.random() < (ch2 ?? 1)) b[id] = a + Math.floor(Math.random() * (bb - a + 1)); rows = grantBundle(A, ch, b); }
    for (const r of rows) this.g.ui?.hud?.loot?.(r);
    this.g.audio?.sfx?.('loot_drop', { pos: o });
    o.cd = 45; o.prop?.userData.setActive?.(false);
    this.s.bus.emit('gather', { skill: o.skill, node: o.key, items: rows.map(r => r.id), zone: this.id });
  }
  async readLore(o) {
    const id = this.loreId(o.key), L = LORE[id] || { title: 'A Weathered Book', text: ['The pages are too water-stained to read. Someone drew a small, round creature with a leaf on its head in the margin.'] };
    this.me?.model?.play?.('interact', { dur: 1 });
    this.g.audio?.sfx?.('ui_open', {});
    await this.s.ui.dialog({ name: L.title, title: L.sub || 'Lore', id: 'lore' }, L.text);
    if (!o.done) {
      o.done = true; o.prop?.userData.setActive?.(false);
      const region = this.cfg.tome || this.id;
      if (this.Q?.tome) this.Q.tome(region, 'lore', id); else { const r = this.A.roster; (r.flags.lore ||= []).push(id); this.A.save(); }
      this.s.bus.emit('collect', { id, type: 'lore', n: 1, zone: this.id });
    }
  }
  async viewVista(o) {
    const id = this.vistaId(o.key), me = this.me, L = this.L;
    const f = o.facing || 0, fx = -Math.sin(f), fz = -Math.cos(f), y = L.heightAt(o.x, o.z);
    await Cutscene.play(this.s, async cs => {
      cs.shot([o.x - fx * 3, y + 7, o.z - fz * 3], [o.x + fx * 30, y + 2, o.z + fz * 30], 2.2, 44);
      cs.anim(me, 'point', 1.6);
      await cs.wait(2.4);
      cs.shot([o.x - fx * 1 + fz * 6, y + 9, o.z - fz * 1 - fx * 6], [o.x + fx * 40, y + 1, o.z + fz * 40], 3.5, 50);
      await cs.title(VISTA_NAMES[id] || 'A view worth the climb', 'Vista', 2.4);
    }, { keepHud: false });
    if (!o.done) {
      o.done = true; o.prop?.userData.setActive?.(false);
      let res = null; try { res = COLL.collect?.(this.A, this.char, 'vistas', id); } catch { /* */ }
      if (!res || res.ok === false) { const list = (this.A.roster.collect ||= {}).vistas ||= []; if (!list.includes(id)) list.push(id); this.A.save(); }
      this.g.ui?.toast?.('Vista discovered — recorded in the Adventure Tome.', 'success');
      this.s.bus.emit('collect', { id, type: 'vistas', n: 1, zone: this.id });
    }
  }
  // ---------------------------------------------------------------- HUD & map
  hudExtra(h) {
    if (this.channel) h.cast = { label: `${this.channel.label}…`, t: Math.min(1, this.channel.t / this.channel.dur), kind: 'cast' };
  }
  minimapExtra(out) {
    for (const o of this.objs) {
      if (o.kind === 'node' && o.cd <= 0) out.push({ x: o.x, z: o.z, kind: 'poi', label: NODES[o.skill]?.name || 'Resource' });
      else if ((o.kind === 'lore' || o.kind === 'vista') && !o.done) out.push({ x: o.x, z: o.z, kind: 'poi', label: o.kind === 'lore' ? 'Lore' : 'Vista' });
      else if (o.kind === 'gate' && o.ring) out.push({ x: o.x, z: o.z, kind: 'portal', label: `To ${ZONE_NAME(o.to)}` });
    }
    const pet = !!(this.char?.pet || this.A.roster.pets?.length);
    if (pet || this.A.roster.flags?.seedSense) for (const o of this.objs) if (o.kind === 'seed' && this.me && dist(o, this.me.pos) < 30) out.push({ x: o.x, z: o.z, kind: 'seed', label: 'Pip Seed' });
  }
  // ---------------------------------------------------------------- Pipsprout: shrink to Pip size
  shrink(on) {
    const g = this.g, me = this.me, cam = g.cam, k = this.zone?.scale || this.cfg.shrink || 0.35;
    if (on) {
      this.shrunk = k;
      this.camSave = { zoom: cam.zoom, min: cam.minDist, max: cam.maxDist, dist: cam.dist };
      cam.minDist = cam.minDist * 0.42; cam.maxDist = cam.maxDist * 0.46; cam.zoom = cam.dist = Math.max(cam.minDist, Math.min(cam.maxDist, cam.zoom * 0.45));
      if (me) { me.model?.root.scale.setScalar(k); applyStatus(g.level, me, 'pip_size', { dur: 1e6, force: true, mods: { moveSpd: -0.4 }, name: 'Pip-Sized', icon: 'status:slow' }); }
    } else {
      this.shrunk = 0;
      if (this.camSave) { cam.minDist = this.camSave.min; cam.maxDist = this.camSave.max; cam.zoom = this.camSave.zoom; }
      if (me) { me.model?.root.scale.setScalar(1); if (me.level) removeStatus(me.level, me, 'pip_size'); }
    }
  }
}

// ------------------------------------------------------------------------------------------------ travel
/** load another open-world zone and arrive at the gate that leads back (or `at`) */
export async function travel(s, to, { from, at } = {}) {
  if (s._traveling || !to) return;
  if (s.guestMode) { s.ui?.toast?.('Your host leads the party between zones.', 'info'); return; }
  s._traveling = true;
  try {
    s.game.player?.stop?.();
    const kind = to === 'solhaven' ? 'city' : 'field';
    await s.loadZone(to, { region: FIELDS[to]?.region || 'Valemont', kind });
    const z = s.game.zone; ensureAnchors(to, z);
    const a = (at && anchorOf(z, at)) || (from && anchorOf(z, [`gate:${from}`, ...(GATE_FALLBACK[`${to}>${from}`] || [])])) || z.anchors.spawn || { x: 0, z: 0, facing: 0 };
    // gates face out of the zone: step a few metres inward and look into it
    const isGate = a.name?.startsWith?.('gate:');
    const f = a.facing || 0, fx = -Math.sin(f), fz = -Math.cos(f);
    const p = walkable(s.game.level, a.x - (isGate ? fx * 5 : 0), a.z - (isGate ? fz * 5 : 0), 6);
    s.spawnMe({ x: p.x, z: p.z, facing: isGate ? f + Math.PI : f });
    s.game.mode = s.hub = s.zoneMode(to);
    s.hub.enter();
    s.inWorld();
    s.bus.emit('zone', { id: to, kind });
  } catch (e) { console.error('[field] travel', to, e); s.ui?.toast?.('The road is blocked. (' + e.message + ')', 'error'); }
  finally { s._traveling = false; }
}
function attune(s, key) {
  const r = s.account.roster, list = r.triports ||= ['triport:solhaven'];
  if (list.includes(key)) return;
  list.push(key); s.account.save();
  s.ui?.toast?.(`Triport attuned: ${ZONE_NAME(key.slice(8))}.`, 'success');
  s.game.audio?.sfx?.('teleport', {});
}
async function triportMenu(s, key) {
  attune(s, key);
  const list = (s.account.roster.triports || []).filter(k => k !== key);
  if (!list.length) { s.ui.toast('Triport attuned. Attune more triports to travel between them.', 'info'); return; }
  const choices = list.map(k => ({ id: k, text: `Travel to ${ZONE_NAME(k.slice(8))}`, kind: 'talk' }));
  choices.push({ id: 'bye', text: 'Stay here.', kind: 'leave' });
  const pick = await s.ui.dialog({ name: 'Triport', title: 'Waystone of the Seven Lights' }, [{ text: 'The waystone hums. Where will the light carry you?', choices }]);
  if (!pick || pick === 'bye') return;
  const to = pick.slice(8);
  s.game.fx?.play?.('teleport_blink', { pos: s.game.hero.u.pos }); s.game.audio?.sfx?.('teleport', {});
  if (to === s.game.zone?.id) return;
  if (to === 'solhaven') { await s.loadZone('solhaven', { kind: 'city', region: 'Valemont' }); const a = s.game.zone.anchors[pick] || s.game.zone.anchors.spawn; s.spawnMe({ x: a.x, z: a.z + 2.5, facing: 0 }); s.game.mode = s.hub = s.zoneMode('solhaven'); s.hub.enter(); s.inWorld(); s.bus.emit('zone', { id: 'solhaven', kind: 'city' }); return; }
  travel(s, to, { at: pick });
}

// ------------------------------------------------------------------------------------------------ registration
for (const id of FIELD_IDS) registerZoneMode(id, (session, zone, o) => new FieldMode(session, zone, o));
registerZoneMode('field', (session, zone, o) => new FieldMode(session, zone, o));
registerPlugin({
  id: 'field-travel',
  init(s) { this.s = s; s.storyTravel = (to, o) => travel(s, to, o); },
  interact(t) {
    const s = this.s; if (!t?.portal || t.qobj) return false;
    const here = s.game.zone?.id;
    if (t.portal.startsWith('gate:') && here === 'solhaven') { const to = t.portal.slice(5); if (FIELD_IDS.includes(to)) { travel(s, to, { from: 'solhaven' }); return true; } }
    if (t.portal.startsWith('triport') && !t.fobj) { triportMenu(s, t.portal.includes(':') ? t.portal : `triport:${here}`); return true; }
    return false;
  },
});

/** only open gates we know how to arrive through: the story fields, Solhaven, and zones another owner registered a mode for */
const travelable = id => FIELD_IDS.includes(id) || id === 'solhaven' || !!ZONE_MODES[id];
// ------------------------------------------------------------------------------------------------ small tables
const weighted = mix => { const tot = mix.reduce((a, m) => a + m[1], 0); let r = Math.random() * tot; for (const [t, w] of mix) { r -= w; if (r <= 0) return t; } return mix[0][0]; };
const FIELD_MOB_NAMED = { grizzlefang: 1, broodmother: 1, hollow_knight: 1, big_beetle: 1, ash_warlord: 1, rusk: 1, blightroot: 1 };
const ITEM_GRADE = id => ({ silver: 0, gold: 3, hp_potion: 1, herb: 1, ore: 1, guardian_stone: 2, destruction_stone: 2, leapstone: 3, card_pack: 3 })[id] ?? 2;
const NAMES = { merchant: 'Pedlar Wick', beekeeper: 'Honeysuckle Nell', guard: 'Sheafton Watchman', shrinekeeper: 'Sister Aubade', trader: 'Travelling Trader' };
const TITLES = { merchant: 'Travelling Goods', beekeeper: 'Beekeeper', guard: 'Goldmeadow Watch', shrinekeeper: 'Keeper of the Dawn Shrine', trader: 'Goods' };
const ACTIONS = { merchant: 'shop:general', quartermaster: 'shop:general', nib: 'shop:general' };
const VISTA_NAMES = { 'vista:windmill': 'Goldmeadow from the Windmill', 'vista:sunflower': 'Sunflower Hill', 'vista:moonpool': 'The Moonlit Pool', 'vista:giant_tree': 'Atop the Fallen Giant', 'vista:lava_falls': 'The Lava Falls', 'vista:fortress': 'The Fortress Walls', 'vista:mushroom': 'The Giant Red Mushroom', 'vista:petal': 'The Petal Theatre', 'vista:lighthouse': 'Sunset from the Lighthouse', 'vista:cathedral': 'The Cathedral Rooftops' };
