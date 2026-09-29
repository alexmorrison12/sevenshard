// The eight islands of the Glass Sea. Docking launches content 'island' (session.launch({ kind: 'island', island })):
// the island zone loads, its residents take their posts, Pip Seeds hide in plain sight (a faint glint gives them
// away), a vista waits to be taken in, the Dawnrunner is moored at the pier (G: set sail), and each island runs its
// own gimmick for its Island Soul:
//   coinflip   the Gilded Gull casino — the Sunwheel slots and Barnacle Bones' dice for Gilded Chips (50 → the Soul)
//   songstone  five stone Cantors hum songs; answer each with the same song (at the statue, or with the Songs key)
//   powderkeg  man the bastion's cannons against three waves of Blackgull longboats and brigs; keep the magazine intact
//   moonveil   (night only) follow the drowned wisp and light the lanterns in its order, three rounds
//   stormcrown climb the spiral ledge through lightning that strikes where you stand, ring the Crown Bell
//   hushwater  dive for pearls at the bubbling beds (timing), bring Coralie three and play her the Serenade of Tides
//   shellback  carry six bundles of seaweed to Grandmother Shellback — dash through the ripple of her snores
//   drownbell  ring the drowned bell three times and fight the Bellwarden when it surfaces
// Debug: window.__session.isle = { mode, gimmick, soul(), win(), tp(anchor), state() }.
import * as THREE from 'three';
import { registerContent, registerZoneMode, registerPlugin } from '../registry.js';
import { Unit } from '../unit.js';
import { dealDamage, applyKnock, inShape } from '../combat.js';
import { MobAI } from '../ai/mob.js';
import { PROVIDERS } from '../visuals.js';
import { G } from '../../engine/materials.js';
import { ISO } from '../../engine/isocam.js';
import { createCreature } from '../../models/creatures/index.js';
import '../../world/zones/isle_coinflip.js';
import '../../world/zones/isle_songstone.js';
import '../../world/zones/isle_powderkeg.js';
import '../../world/zones/isle_moonveil.js';
import '../../world/zones/isle_stormcrown.js';
import '../../world/zones/isle_hushwater.js';
import '../../world/zones/isle_shellback.js';
import '../../world/zones/isle_drownbell.js';
import { CANTORS, LANTERNS, GUNS } from '../../world/sea/landmarks.js';
import { ShipRig } from '../../world/sea/shiprig.js';
import { ISLANDS, ISLAND_BY_ID, ISLAND_BY_ZONE, SEA_NAME, seaHour, nightAmount, isNight } from '../../data/islands.js';
import { collect, trackTask, seaState, lerpEnv } from './sailing.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const SONG_NAMES = { homeward: 'Hymn of Homeward', tides: 'Serenade of Tides', rest: 'Lullaby of Rest', valor: 'Ballad of Valor', sunrise: 'Song of Sunrise' };
/** interactables that are objects, not people: the HUD prompt reads "Use" (same convention as the quest system) */
const OBJ = { npcDef: { object: true } };
const obj = (isle, name, extra = {}) => ({ isle, name, data: OBJ, ...extra });
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
/** idle emotes per resident (hero NPCs) — a little life between conversations */
const IDLE = { brightpenny: ['laugh', 'point'], bones: ['laugh', 'shrug'], croupier: ['clap', 'point'], cantrix: ['think', 'bow'], goat: ['shrug', 'think'],
  gunnery: ['salute', 'point'], smuggler: ['shrug', 'laugh'], lanternkeeper: ['think', 'bow'], stormwarden: ['point', 'think'], coralie: ['wave', 'laugh'],
  pearler: ['wave', 'cheer'], bellfisher: ['laugh', 'shrug'] };

// ------------------------------------------------------------------------------------------------ the mode
export class IslandMode {
  constructor(session, I, o = {}) {
    this.s = session; this.game = session.game; this.I = I; this.kind = 'island'; this.o = o;
    this.npcs = []; this.markers = []; this.seeds = []; this.objs = []; this.units = []; this.critters = [];
  }
  get L() { return this.game.level; }
  get zone() { return this.game.zone; }
  get me() { return this.game.hero?.u; }
  get A() { return this.s.account; }
  anchor(n) { return this.zone.anchors[n]; }
  y(x, z) { return this.zone.heightAt(x, z); }
  enter() {
    const g = this.game, s = this.s, I = this.I, z = this.zone;
    this.sea = seaState(this.A);
    g.camFocus = null;
    for (const n of I.npcs) this.addNpc(n);
    // Pip Seeds still hidden here
    I.seeds.forEach((id, i) => {
      if ((this.A.roster.collect.seeds || []).includes(id)) return;
      const a = this.anchor('seed:' + (i + 1)); if (!a) return;
      const m = createCreature('pip_seed', { variant: pick(['gold', 'jade', 'rose']), seed: i + 3 });
      const y = a.y ?? this.y(a.x, a.z);
      m.root.position.set(a.x, y + 0.05, a.z); m.root.rotation.y = rnd(0, TAU); g.scene.add(m.root);
      this.seeds.push({ id, m, x: a.x, z: a.z, y, glint: rnd(0, 2) });
    });
    const Gk = GIMMICKS[I.gimmick];
    this.gimmick = Gk ? new Gk(this) : null;
    try { this.gimmick?.enter?.(); } catch (e) { console.error('[island gimmick]', I.id, e); }
    this.ambient();
    this.envT = 0; this.applyIsleEnv(true);
    g.audio?.music?.(I.music || 'sea'); g.audio?.ambience?.(I.ambience || 'sea');
    s.ui?.banner?.(I.name, { kind: 'zone', sub: `${SEA_NAME} · ${I.title}`, dur: 3.2 });
    if (!this.sea.visited.includes(I.id)) { this.sea.visited.push(I.id); this.A.save(); this.after(3.5, () => s.ui?.toast?.(I.blurb, 'info')); }
    const self = this;
    s.isle = {
      mode: this, get gimmick() { return self.gimmick; }, soul: () => this.claimSoul(), win: () => this.gimmick?.win?.(),
      tp: (name, dz = 0) => { const a = this.anchor(name); if (!a || !this.me) return false; this.me.pos.x = a.x; this.me.pos.z = a.z + dz; this.me.pos.y = a.y ?? this.y(a.x, a.z + dz); this.game.cam.snap(this.me.pos); return true; },
      state: () => ({ island: I.id, gimmick: this.gimmick?.state ?? null, soul: this.hasSoul(), seeds: this.seeds.length, units: this.units.filter(u => !u.dead).length }),
    };
    s.bus.emit('zone', { id: z.id, kind: 'island' });
  }
  exit() {
    try { this.gimmick?.exit?.(); } catch (e) { console.error('[island gimmick exit]', e); }
    const g = this.game;
    for (const sd of this.seeds) { sd.m.root.removeFromParent(); sd.m.dispose?.(); }
    for (const o of this.objs) { o.removeFromParent?.(); o.geometry?.dispose?.(); }
    for (const c of this.critters) { c.m.root.removeFromParent(); c.m.dispose?.(); }
    this.seeds = []; this.objs = []; this.critters = [];
    g.camFocus = null; g.inputBlocked = false;
    const cam = g.cam; cam.pitch = ISO.pitch; cam.minDist = ISO.minDist; cam.maxDist = ISO.maxDist; if (cam.zoom > ISO.maxDist) cam.zoom = ISO.dist;
    if (g.renderer?.fx) g.renderer.fx.letterbox = 0;
    if (this.s.isle?.mode === this) this.s.isle = null;
  }
  addNpc(n) {
    const a = this.anchor(n.anchor); if (!a) return null;
    const u = new Unit({ kind: 'npc', team: 2, name: n.name, x: a.x, z: a.z, facing: a.facing ?? Math.PI, radius: 0.5, height: 1.85, stats: { hpMax: 1, speed: 2 } });
    u.data.npc = n.npc || null; u.data.look = n.npc ? {} : null; u.data.sex = n.sex || 'm'; u.data.title = n.title; u.data.npcDef = { ...n, action: 'island' }; u.data.immovable = true;
    if (n.creature) { u.type = n.creature; u.data.tpl = { model: n.creature }; u.data.variant = n.variant; u.height = 0.8; }
    u.untargetable = true;
    this.L.add(u);
    if (a.free) { u.pos.x = a.x; u.pos.z = a.z; }         // Level.add snaps to the nav; some residents stand in the water
    u.data.idleT = rnd(4, 10);
    this.npcs.push(u);
    return u;
  }
  /** an invisible labelled point (nameplate + minimap marker) for an objective */
  marker(name, x, z, h = 1.8, title = null) {
    const u = new Unit({ kind: 'npc', team: 2, name, x, z, radius: 0.3, height: h, stats: { hpMax: 1, speed: 0 } });
    u.data.noModel = true; u.untargetable = true; u.data.immovable = true; u.data.marker = true; u.data.title = title;
    this.L.add(u); u.pos.x = x; u.pos.z = z;
    this.markers.push(u);
    return u;
  }
  unmark(u) { if (u && this.L?.byId.has(u.id)) this.L.remove(u); this.markers = this.markers.filter(x => x !== u); }
  /** a world object (mesh / group / light) that lives as long as the mode */
  keep(o) { this.game.scene.add(o); this.objs.push(o); return o; }
  ambient() {
    const g = this.game, R = (this.zone.bounds?.x1 || 60), I = this.I, night = I.night || nightAmount(seaHour()) > 0.6;
    const add = (type, variant, x, z, o = {}) => { const m = createCreature(type, { variant }); if (!m) return; g.scene.add(m.root); this.critters.push({ m, type, cx: x, cz: z, t: rnd(0, 10), r: o.r ?? rnd(6, 14), sp: o.sp ?? rnd(0.3, 0.6), h: o.h ?? rnd(6, 12), k: o.k ?? 1 }); };
    if (!I.night) for (let i = 0; i < 4; i++) add('seagull', pick(['herring', 'blackback', 'hooded']), rnd(-R * 0.6, R * 0.6), rnd(-R * 0.6, R * 0.6), { r: rnd(10, 22), h: rnd(9, 15), sp: rnd(0.25, 0.45) });
    if (I.id !== 'stormcrown' && I.id !== 'powderkeg') for (let i = 0; i < 5; i++) add('butterfly', night ? 'glow' : pick(['monarch', 'azure', 'sulphur', 'rose']), rnd(-30, 30), rnd(-30, 30), { r: rnd(2, 5), h: rnd(1.2, 2.6), sp: rnd(0.4, 0.9), k: 1.7 });
  }
  updateAmbient(dt) {
    for (const c of this.critters) {
      c.t += dt * c.sp;
      const x = c.cx + Math.cos(c.t) * c.r, z = c.cz + Math.sin(c.t * c.k) * c.r;
      const vx = -Math.sin(c.t) * c.r, vz = Math.cos(c.t * c.k) * c.r * c.k;
      c.m.root.position.set(x, Math.max(this.y(x, z), 0) + c.h + Math.sin(c.t * 3) * 0.3, z);
      c.m.root.rotation.y = Math.atan2(-vx, -vz);
      c.m.update?.(dt, { speed: Math.hypot(vx, vz) * c.sp, turn: c.sp, fly: 1 });
    }
  }
  applyIsleEnv(force = false) {
    this.envT = 2;
    const z = this.zone, E = z.envs; if (!E) return;
    const h = seaHour(), nt = this.I.night ? Math.max(0.75, nightAmount(h)) : nightAmount(h);
    const dusk = clamp(1 - Math.abs(nt - 0.5) * 2.2, 0, 1) * (h > 12 ? 1 : 0.6);
    const key = nt.toFixed(2) + (this.gimmick?.envKey || '');
    if (!force && key === this.envKey) return;
    let env = lerpEnv(E.day, E.night, nt);
    if (dusk > 0.02 && E.dusk) env = lerpEnv(env, E.dusk, dusk * 0.8);
    if (this.gimmick?.envMix) env = this.gimmick.envMix(env);
    this.envKey = key; z.env = env; this.game.applyEnv(env); z.setEnv?.('__none');
  }
  update(dt) {
    this.envT -= dt; if (this.envT <= 0) this.applyIsleEnv();
    for (const sd of this.seeds) {
      sd.m.update?.(dt, {});
      sd.glint -= dt;
      if (sd.glint <= 0) { sd.glint = rnd(1.8, 3); if (this.me && Math.hypot(sd.x - this.me.pos.x, sd.z - this.me.pos.z) < 30) this.game.fx?.burst?.({ pos: { x: sd.x, y: sd.y + 0.6, z: sd.z }, kind: 'star', count: 3, speed: 0.8, up: 0.6, size: 0.18, life: 0.9, flash: false }); }
    }
    for (const u of this.npcs) {
      u.data.idleT -= dt;
      if (u.data.idleT > 0) continue;
      u.data.idleT = rnd(9, 16);
      const n = u.data.npcDef, me = this.me;
      if (me && u.distTo(me) < 4 && !n.creature) { u.faceTo(me.pos.x, me.pos.z); continue; }
      u.model?.play?.(n.creature ? pick(['idle_alt', 'think', 'wave']) : pick(IDLE[n.id] || ['think']), { dur: n.creature ? 1.8 : 2.2 });
    }
    this.updateAmbient(dt);
    try { this.gimmick?.update?.(dt); } catch (e) { if (!this.gErr) { this.gErr = true; console.error('[island gimmick update]', e); } }
  }
  // ---------------------------------------------------------------- interaction
  interactable() {
    const me = this.me; if (!me || me.dead) return null;
    const gi = this.gimmick?.interactable?.(); if (gi) return gi;
    let best = null, bd = 3.2;
    for (const u of this.npcs) { if (u.dead || !this.L.byId.has(u.id)) continue; const d = me.distTo(u) - (u.data.reach || 0); if (d < bd) { bd = d; best = u; } }
    for (const sd of this.seeds) { const d = Math.hypot(sd.x - me.pos.x, sd.z - me.pos.z); if (d < 2.6 && d < bd && Math.abs(sd.y - me.pos.y) < 3) { bd = d; best = obj('seed', 'Pip Seed', { seed: sd }); } }
    const v = this.anchor('vista');
    if (v) { const d = Math.hypot(v.x - me.pos.x, v.z - me.pos.z); if (d < 3 && d < bd && Math.abs((v.y ?? this.y(v.x, v.z)) - me.pos.y) < 3) { bd = d; best = obj('vista', 'Take in the view'); } }
    const dk = this.anchor('dock:ship');
    if (dk) { const d = Math.hypot(dk.x - me.pos.x, dk.z - me.pos.z); if (d < 3.4 && d < bd) { bd = d; best = obj('dock', 'Set sail on the Dawnrunner'); } }
    return best;
  }
  interact(t) {
    if (!t) return false;
    if (t.isle && this.gimmick?.interact?.(t)) return true;
    if (t.isle === 'seed') { this.takeSeed(t.seed); return true; }
    if (t.isle === 'vista') { this.vista(); return true; }
    if (t.isle === 'dock') { this.s.launch({ kind: 'sail', from: this.I.id }); return true; }
    if (t.data?.npcDef && !t.data.npcDef.object && this.npcs.includes(t)) { this.talk(t); return true; }
    return false;
  }
  async talk(u) {
    const n = u.data.npcDef, s = this.s, me = this.me;
    me.faceTo(u.pos.x, u.pos.z); if (!n.creature) u.faceTo(me.pos.x, me.pos.z);
    s.bus.emit('talk', { npc: n.id, unit: u });
    u.model?.play?.(n.creature ? pick(['wave', 'cheer', 'talk']) : 'wave', { dur: 1.4 });
    if (n.creature) this.game.audio?.sfx?.('pip_squeak', { pos: u.pos });
    const choices = [...(this.gimmick?.choices?.(n.id) || [])];
    choices.push({ id: 'bye', text: 'Farewell.', kind: 'leave' });
    const line = this.gimmick?.line?.(n.id) || pick(n.lines || ['…']);
    const pickId = await s.ui.dialog({ id: n.id, name: n.name, title: n.title }, [{ text: line, choices }]);
    if (pickId && pickId !== 'bye' && this.game.mode === this) await this.gimmick?.choose?.(n.id, pickId, u);
  }
  takeSeed(sd) {
    const s = this.s, me = this.me;
    this.seeds = this.seeds.filter(x => x !== sd);
    me.model?.play?.('pickup', { dur: 1 });
    sd.m.play?.('collect');
    this.game.fx?.pickup?.({ pos: { x: sd.x, y: sd.y + 0.4, z: sd.z }, kind: 'item', color: 0xb8f070, to: me.model?.root });
    this.game.audio?.sfx?.('pip_cheer', { pos: me.pos });
    const r = collect(s, 'seeds', sd.id, 'Pip Seed');
    const have = (this.A.roster.collect.seeds || []).length;
    s.ui?.toast?.(`Pip Seed found! (${have} collected)`, 'success');
    s.ui?.hud?.loot?.({ name: 'Pip Seed', grade: 3, count: 1, icon: 'item:pip_seed', kind: 'collectible' });
    setTimeout(() => { sd.m.root.removeFromParent(); sd.m.dispose?.(); }, 1000);
    return r;
  }
  vista() {
    const s = this.s, g = this.game, v = this.anchor('vista'), I = this.I;
    const y = v.y ?? this.y(v.x, v.z);
    const fx = -Math.sin(v.facing || 0), fz = -Math.cos(v.facing || 0);
    g.cam.cinematic({ pos: [v.x - fx * 12, y + 8, v.z - fz * 12], look: [v.x + fx * 45, Math.max(0, y - 6), v.z + fz * 45], dur: 2.6, fov: 46 });
    if (g.renderer?.fx) g.renderer.fx.letterbox = 1;
    const first = !(this.A.roster.collect.vistas || []).includes(I.vista);
    collect(s, 'vistas', I.vista, `Vista: ${I.name}`);
    s.ui?.banner?.(first ? 'Vista discovered' : I.name, { kind: 'success', sub: `${I.name} — ${I.title}`, dur: 3.4 });
    this.me.model?.play?.('think', { dur: 3 });
    if (first) g.audio?.stinger?.('quest_complete');
    setTimeout(() => { if (g.renderer?.fx) g.renderer.fx.letterbox = 0; if (this.game.mode === this) g.cam.endCinematic(1.4); }, 5200);
  }
  /** the island's Soul (once per roster) + rewards */
  claimSoul() {
    const s = this.s, A = this.A, I = this.I, me = this.me;
    if (this.hasSoul()) { s.ui?.toast?.(`You already carry the ${I.soul.name}.`, 'info'); return false; }
    collect(s, 'souls', I.soul.id, I.soul.name);
    A.give('silver', 20000); A.give('tokens', 5); A.give('pirate', 10);
    s.ui?.banner?.('Island Soul', { kind: 'clear', sub: `${I.soul.name} — ${I.soul.desc}`, dur: 4.5 });
    s.ui?.hud?.loot?.({ name: I.soul.name, grade: 4, count: 1, icon: 'item:island_soul', kind: 'collectible' });
    s.ui?.hud?.loot?.({ name: 'Silver', grade: 1, count: 20000, icon: 'currency:silver', kind: 'currency' });
    s.ui?.hud?.loot?.({ name: 'Pirate Coin', grade: 2, count: 10, icon: 'currency:pirate', kind: 'currency' });
    this.game.audio?.stinger?.('achievement'); this.game.audio?.sfx?.('loot_legendary', { pos: me?.pos });
    if (me) { this.game.fx?.lootBeam?.({ pos: { x: me.pos.x, y: me.pos.y, z: me.pos.z }, grade: 4, dur: 4 }); me.model?.play?.('cheer', { dur: 2.4 }); }
    trackTask(s, 'clear', { content: 'island', id: I.id });
    s.bus.emit('clear', { content: { kind: 'island', island: I.id }, result: { cleared: true } });
    A.save();
    return true;
  }
  hasSoul() { return (this.A.roster.collect.souls || []).includes(this.I.soul.id); }
  // ---------------------------------------------------------------- shared helpers for gimmicks
  after(t, fn) { return this.L.after(t, () => { if (this.game.mode === this) fn(); }); }
  /**
   * A telegraph that hurts the hero when it detonates. o: { shape: circle|cone|rect|donut, x, z, dx, dz, r, inner, angle
   * (full), len, width, dur, color, pct (of max HP), knock, kb, src (unit, for "Slain by"), onBlast(), onHit() }.
   * Returns a handle with cancel().
   */
  hazard(o) {
    const L = this.L;
    const tg = L.telegraph({ shape: o.shape, x: o.x, z: o.z, dx: o.dx ?? 0, dz: o.dz ?? -1, r: o.r, inner: o.inner, angle: o.angle, len: o.len, width: o.width, dur: o.dur, color: o.color || 'red', owner: o.src || null, team: 1 });
    const h = { tg, dead: false, cancel() { h.dead = true; tg.alive = false; } };
    this.after(o.dur, () => {
      if (h.dead) return;
      try { o.onBlast?.(o); } catch (e) { console.error('[hazard]', e); }
      const me = this.me;
      if (!me || me.dead || me.invuln > 0) return;
      if (inShape({ shape: o.shape, r: o.r, inner: o.inner, angle: o.angle, len: o.len, width: o.width }, o.x, o.z, o.dx ?? 0, o.dz ?? -1, me)) {
        dealDamage(L, o.src || null, me, 0, { fixed: Math.round(me.hpMax * (o.pct ?? 0.12)) });
        if (o.knock) applyKnock(L, o.src || null, me, o.knock, o.kb ?? 3, o.x, o.z, 1.1);
        o.onHit?.();
      }
    });
    return h;
  }
  /** content numbers follow the hero's own power (side content for every item level) */
  ref() { const me = this.me; return { ap: Math.max(6000, me?.st?.atk || 20000), hp: Math.max(30000, me?.hpMax || 150000) }; }
  /** a mob from a custom template (MobAI unless o.ai), with its model made up front (hero outfit or creature) */
  mob(tpl, x, z, o = {}) {
    const ref = this.ref(), sc = o.scale || 1;
    const u = new Unit({ kind: o.boss ? 'boss' : 'mob', team: 1, type: tpl.model, name: o.name || tpl.name, level: 60, x, z, facing: o.facing ?? 0,
      radius: tpl.radius * sc, height: tpl.height * sc, mass: tpl.mass || 1,
      stats: { hpMax: Math.round(tpl.hp * ref.ap * (o.hpMul || 1)), atk: tpl.atk * ref.hp / 0.55 * (o.atkMul || 1), def: 3000, speed: tpl.speed, mpMax: 0, mpRegen: 0, crit: 0.05 }, superArmor: tpl.superArmor || 0 });
    u.data.elite = !!o.elite; u.data.tpl = tpl; u.data.scale = sc; u.data.xp = 10;
    if (tpl.hero) { u.model = PROVIDERS.hero?.({ cls: null, sex: o.sex || 'm', look: {}, npc: tpl.hero, lod: 'crowd', seed: Math.floor(rnd(1, 999)) }) || null; if (u.model && sc !== 1) u.model.root.scale.setScalar(sc); }
    else if (tpl.creature) u.model = createCreature(tpl.creature, { variant: o.variant, scale: o.modelScale ?? sc, elite: o.elite, seed: Math.floor(rnd(1, 99)) });
    u.ctrl = o.ai ? o.ai(u) : new MobAI(u, tpl, { aggro: o.aggro ?? 40, alert: o.alert ?? true });
    this.L.add(u); this.units.push(u);
    return u;
  }
  /** play a song yourself (the Cantors and Coralie listen for it) — without the Songs feature's travel side effects */
  playSong(id) {
    const g = this.game, me = this.me, s = this.s;
    const secs = g.audio?.song?.(id) || 8;
    me.model?.play?.('play_instrument', { loop: true, dur: 2 });
    g.fx?.play?.('orbiting_notes', { attach: me.model?.root, pos: me.pos, dur: Math.min(secs, 8) });
    s.bus.emit('song', { id, npc: null, island: this.I.id });
    this.after(Math.min(secs, 8), () => me.model?.stop?.());
    return secs;
  }
  progressHud() { return this.gimmick?.progress?.() || null; }
  timerHud() { return this.gimmick?.timer?.() || null; }
  bossHud() { return this.gimmick?.boss?.() || null; }
}

// ================================================================================================ gimmicks
class Gimmick {
  constructor(m) { this.m = m; this.state = 'idle'; }
  get s() { return this.m.s; } get g() { return this.m.game; } get L() { return this.m.L; } get me() { return this.m.me; } get A() { return this.m.A; }
  near(name, r = 3) { const a = this.m.anchor(name), me = this.me; return a && me && Math.hypot(a.x - me.pos.x, a.z - me.pos.z) < r ? a : null; }
  say(t, k = 'info') { this.s.ui?.toast?.(t, k); }
  banner(t, sub, kind = 'info', dur = 2.8) { this.s.ui?.banner?.(t, { kind, sub, dur }); }
  sfx(n, pos, vol = 1) { try { this.g.audio?.sfx?.(n, { pos: pos || this.me?.pos, vol }); } catch (e) { /* locked */ } }
  spot(name) { return this.m.zone.spots?.[name]; }
}
const GIMMICKS = {};

// ------------------------------------------------------------------------------------------------ Coinflip: the casino
const SYMBOLS = ['sun', 'gull', 'pearl', 'anchor', 'skull', 'pip'];
function reelTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S * SYMBOLS.length;
  const x = cv.getContext('2d');
  SYMBOLS.forEach((s, i) => {
    const y0 = i * S;
    const gr = x.createLinearGradient(0, y0, 0, y0 + S); gr.addColorStop(0, '#fbf3df'); gr.addColorStop(0.5, '#f4e8cc'); gr.addColorStop(1, '#d9c69e'); x.fillStyle = gr; x.fillRect(0, y0, S, S);
    x.fillStyle = 'rgba(120,80,30,0.35)'; x.fillRect(0, y0, S, 3); x.fillRect(0, y0 + S - 3, S, 3);
    x.save(); x.translate(64, y0 + 64);
    if (s === 'sun') { x.fillStyle = '#f09018'; for (let k = 0; k < 12; k++) { x.rotate(TAU / 12); x.beginPath(); x.moveTo(0, -50); x.lineTo(9, -26); x.lineTo(-9, -26); x.fill(); } const r = x.createRadialGradient(-6, -6, 2, 0, 0, 27); r.addColorStop(0, '#fff2a0'); r.addColorStop(1, '#f0b020'); x.fillStyle = r; x.beginPath(); x.arc(0, 0, 27, 0, TAU); x.fill(); }
    if (s === 'gull') { x.strokeStyle = '#34485c'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-46, -2); x.quadraticCurveTo(-22, -34, 0, 6); x.quadraticCurveTo(22, -34, 46, -2); x.stroke(); }
    if (s === 'pearl') { const r = x.createRadialGradient(-11, -13, 3, 0, 0, 36); r.addColorStop(0, '#ffffff'); r.addColorStop(0.6, '#e6e0ee'); r.addColorStop(1, '#a89cb8'); x.fillStyle = r; x.beginPath(); x.arc(0, 0, 33, 0, TAU); x.fill(); }
    if (s === 'anchor') { x.strokeStyle = '#26385a'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -34); x.lineTo(0, 38); x.moveTo(-22, -20); x.lineTo(22, -20); x.moveTo(-38, 10); x.quadraticCurveTo(-32, 40, 0, 40); x.quadraticCurveTo(32, 40, 38, 10); x.stroke(); x.beginPath(); x.arc(0, -43, 9, 0, TAU); x.stroke(); }
    if (s === 'skull') { x.fillStyle = '#2a2420'; x.beginPath(); x.arc(0, -8, 32, 0, TAU); x.fill(); x.fillRect(-19, 10, 38, 24); x.fillStyle = '#f4e8cc'; x.beginPath(); x.arc(-12, -8, 9, 0, TAU); x.arc(12, -8, 9, 0, TAU); x.fill(); for (const px of [-13, -2, 9]) x.fillRect(px, 18, 5, 15); }
    if (s === 'pip') { x.fillStyle = '#6cbc44'; x.beginPath(); x.arc(0, 10, 30, 0, TAU); x.fill(); x.fillStyle = '#3e8e26'; x.beginPath(); x.ellipse(-11, -30, 15, 7, -0.6, 0, TAU); x.ellipse(11, -30, 15, 7, 0.6, 0, TAU); x.fill(); x.fillStyle = '#161616'; x.beginPath(); x.arc(-10, 6, 5.5, 0, TAU); x.arc(10, 6, 5.5, 0, TAU); x.fill(); x.strokeStyle = '#161616'; x.lineWidth = 3; x.beginPath(); x.arc(0, 16, 8, 0.2, Math.PI - 0.2); x.stroke(); }
    x.restore();
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function diceTexture() {
  const cv = document.createElement('canvas'); cv.width = 64 * 6; cv.height = 64;
  const x = cv.getContext('2d');
  const P = { 1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[16, 16], [32, 32], [48, 48]], 4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48]], 6: [[18, 14], [46, 14], [18, 32], [46, 32], [18, 50], [46, 50]] };
  for (let f = 1; f <= 6; f++) { const x0 = (f - 1) * 64; x.fillStyle = '#f4efe2'; x.fillRect(x0, 0, 64, 64); x.strokeStyle = '#c8bca0'; x.lineWidth = 3; x.strokeRect(x0 + 1.5, 1.5, 61, 61); x.fillStyle = f === 1 ? '#c02a2a' : '#1a1a1a'; for (const [px, py] of P[f]) { x.beginPath(); x.arc(x0 + px, py, 6, 0, TAU); x.fill(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** a die whose face N shows on top when its rotation (order YXZ, any yaw) is FACE_UP[N] */
function makeDie(tex) {
  const g = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  const faceFor = [2, 5, 1, 6, 3, 4];                   // box face order +x −x +y −y +z −z (opposite faces sum to 7)
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setX(k, (faceFor[f] - 1 + uv.getX(k)) / 6); }
  const d = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  d.rotation.order = 'YXZ'; d.castShadow = true;
  return d;
}
const FACE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
const backOut = k => { const c1 = 1.1, c3 = c1 + 1, q = k - 1; return 1 + c3 * q * q * q + c1 * q * q; };
GIMMICKS.casino = class Casino extends Gimmick {
  enter() {
    const m = this.m, isle = m.zone.isle, sea = m.sea;
    sea.chips ??= 0; sea.casino ||= {};
    const [sx, sy, sz] = isle.slotsAt;
    const tex = reelTexture(), gold = new THREE.MeshLambertMaterial({ color: 0xd8a848, emissive: 0x3a2206 });
    this.reels = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.6, 30, 1, false);
      const uv = geo.attributes.uv, side = (30 + 1) * 2;   // side vertices first: u around, v along → swap so symbols run around the reel
      for (let k = 0; k < side; k++) { const u = uv.getX(k), v = uv.getY(k); uv.setXY(k, 1 - v, u); }
      geo.rotateZ(Math.PI / 2);
      const r = new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ map: tex, emissive: 0x201810 }), gold, gold]);
      r.position.set(sx - 0.72 + i * 0.72, sy + 2.3, sz + 0.5);
      m.keep(r); this.reels.push({ mesh: r, a: rnd(0, TAU), from: 0, to: 0, t: 0, dur: 0 });
    }
    this.lever = new THREE.Group(); this.lever.position.set(sx + 1.62, sy + 2.0, sz + 0.1); m.keep(this.lever);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 8), gold); rod.position.y = 0.6; this.lever.add(rod);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshLambertMaterial({ color: 0xc8202a, emissive: 0x500808 })); knob.position.y = 1.22; this.lever.add(knob);
    this.leverT = 0;
    const dt = diceTexture(), [dx, dy, dz] = isle.diceAt;
    this.diceAt = isle.diceAt;
    this.dice = [0, 1, 2, 3].map(i => {
      const d = makeDie(dt); d.position.set(dx - 0.55 + (i % 2) * 0.42 + (i > 1 ? 0.75 : 0), dy + 1.25, dz + (i > 1 ? 0.35 : -0.35)); d.rotation.set(...FACE_UP[1 + i]); d.rotation.y = rnd(0, TAU);
      m.keep(d); return { mesh: d, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), rot: [0, 0, 0], spin: [0, 0, 0] };
    });
    this.busy = false;
    this.mk = [m.marker('The Sunwheel', sx, sz + 1.2, 4.6, '500 silver a pull'), m.marker('Barnacle Bones’ Table', dx, dz, 1.6)];
  }
  update(dt) {
    for (const r of this.reels) {
      if (r.dur > 0) { r.t += dt; const k = Math.min(1, r.t / r.dur); r.a = r.from + (r.to - r.from) * backOut(k); if (k >= 1) { r.dur = 0; r.a = r.to; this.sfx('ui_click', r.mesh.position, 1); } }
      r.mesh.rotation.x = r.a;
    }
    for (const d of this.dice) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt / 1.1);
      const k = d.t, e = 1 - Math.pow(1 - k, 3);
      d.mesh.position.lerpVectors(d.from, d.to, e); d.mesh.position.y += Math.sin(k * Math.PI) * 0.8 * (1 - k) + Math.abs(Math.sin(k * Math.PI * 3)) * 0.12 * (1 - k);
      const w = 1 - e;
      d.mesh.rotation.set(d.rot[0] + d.spin[0] * w, d.rot[1] + d.spin[1] * w, d.rot[2] + d.spin[2] * w);
    }
    if (this.leverT > 0) { this.leverT = Math.max(0, this.leverT - dt); this.lever.rotation.x = Math.sin((1 - this.leverT / 0.6) * Math.PI) * 0.95; }
  }
  interactable() {
    if (this.near('game:slots', 2.6)) return obj('slots', `The Sunwheel (500 silver a pull)`);
    if (this.near('game:dice', 2.6)) return obj('dice', 'Roll bones with Barnacle Bones (3 chips)');
    return null;
  }
  interact(t) {
    if (t.isle === 'slots') { this.pull(); return true; }
    if (t.isle === 'dice') { this.diceGame(); return true; }
    return false;
  }
  line(id) {
    const c = this.m.sea.chips, soul = this.m.I.soul.name;
    if (id === 'brightpenny') return this.m.hasSoul() ? `The ${soul} suits you, darling. Do come back and lose a little silver now and then — for tradition.` : `You hold ${c} Gilded Chip${c === 1 ? '' : 's'}. Fifty, darling, and the ${soul} is yours. I have never once regretted that promise. Yet.`;
    return null;
  }
  choices(id) {
    const sea = this.m.sea, out = [];
    if (id === 'brightpenny') {
      if (!sea.casino.free) out.push({ id: 'free', text: 'I’m new here. (Five chips on the house)', kind: 'quest' });
      out.push({ id: 'buy', text: 'Buy 5 Gilded Chips (3,000 silver).', kind: 'shop' });
      if (!this.m.hasSoul()) out.push({ id: 'soul', text: `Trade 50 Gilded Chips for the ${this.m.I.soul.name} (${sea.chips}/50).`, kind: 'quest' });
      else out.push({ id: 'prize', text: 'Cash 10 chips for a Pip Card Pack.', kind: 'shop' });
    }
    if (id === 'bones') out.push({ id: 'dice', text: 'Roll the bones (bet 3 chips).', kind: 'quest' });
    if (id === 'croupier') out.push({ id: 'pull', text: 'Pull the Sunwheel (500 silver).', kind: 'quest' });
    return out;
  }
  choose(id, c) {
    const sea = this.m.sea, A = this.A;
    if (c === 'free') { sea.casino.free = true; sea.chips += 5; this.say('Five Gilded Chips, with the Baroness’s compliments.', 'success'); this.sfx('coin'); }
    if (c === 'buy') { if (!A.take('silver', 3000)) { this.say('Not enough silver.', 'error'); return; } sea.chips += 5; this.sfx('coin'); this.say('+5 Gilded Chips.', 'success'); }
    if (c === 'soul') { if (sea.chips < 50) { this.say(`You need ${50 - sea.chips} more Gilded Chips.`, 'error'); return; } sea.chips -= 50; this.m.claimSoul(); }
    if (c === 'prize') { if (sea.chips < 10) { this.say('Ten chips, darling.', 'error'); return; } sea.chips -= 10; A.give('card_pack_pip', 1); this.s.ui?.hud?.loot?.({ name: 'Pip Card Pack', grade: 3, count: 1, icon: 'item:card_pack_pip', kind: 'consumable' }); }
    if (c === 'dice') this.diceGame();
    if (c === 'pull') this.pull();
    A.save();
  }
  pull() {
    if (this.busy) return;
    const A = this.A, sea = this.m.sea, me = this.me;
    if (!A.take('silver', 500)) { this.say('The Sunwheel wants 500 silver.', 'error'); return; }
    this.busy = true;
    this.leverT = 0.6; this.sfx('chain', this.lever.position);
    me.faceTo(this.lever.position.x - 1.6, this.lever.position.z); me.model?.play?.('interact', { dur: 0.8 });
    // decide the outcome, then land each reel on it
    const r = Math.random(); let res;
    if (r < 0.045) res = ['sun', 'sun', 'sun'];
    else if (r < 0.165) { const s = pick(['gull', 'pearl', 'anchor', 'pip']); res = [s, s, s]; }
    else if (r < 0.46) { const s = pick(['sun', 'gull', 'pearl', 'anchor', 'pip']); const o = pick(SYMBOLS.filter(x => x !== s && x !== 'skull')); res = Math.random() < 0.5 ? [s, s, o] : [o, s, s]; }
    else if (r < 0.56) res = [pick(['gull', 'pearl']), 'skull', pick(['anchor', 'pip'])];
    else { const a = SYMBOLS.filter(x => x !== 'skull').sort(() => Math.random() - 0.5); res = [a[0], a[1], a[2]]; }
    this.reels.forEach((rl, i) => {
      const idx = SYMBOLS.indexOf(res[i]), off = (((-(idx + 0.5) / SYMBOLS.length) * TAU) % TAU + TAU) % TAU;
      rl.from = rl.a; rl.to = Math.ceil((rl.a + TAU * (3 + i)) / TAU) * TAU + off; rl.t = 0; rl.dur = 1.15 + i * 0.45;
    });
    this.m.after(2.35, () => {
      this.busy = false;
      let chips = 0, text;
      if (res.every(x => x === 'sun')) { chips = 25; text = 'JACKPOT! Three suns!'; this.jackpot(); }
      else if (res[0] === res[1] && res[1] === res[2]) { chips = 8; text = `Three ${res[0]}s!`; }
      else if (res[1] === 'skull') { text = 'The skull grins. The house wins.'; }
      else if (res[0] === res[1] || res[1] === res[2]) { chips = res[1] === 'sun' ? 3 : 2; text = res[1] === 'sun' ? 'Two suns!' : 'A pair!'; }
      else { chips = Math.random() < 0.33 ? 1 : 0; text = chips ? 'Nothing… but the Baroness tosses you a pity chip.' : 'Nothing. The wheel hums smugly.'; }
      sea.chips += chips;
      this.say(`${text}${chips ? ` +${chips} Gilded Chip${chips > 1 ? 's' : ''} (${sea.chips}).` : ''}`, chips ? 'success' : 'info');
      if (chips) { this.sfx(chips >= 8 ? 'loot_rare' : 'coin'); const p = this.lever.position; this.g.fx?.burst?.({ pos: { x: p.x - 1.6, y: p.y + 1, z: p.z + 0.8 }, kind: 'coin', count: 6 + chips, speed: 4 }); }
      if (!chips && res[1] === 'skull') { const cr = this.m.npcs.find(u => u.data.npcDef.id === 'croupier'); cr?.model?.play?.('laugh', { dur: 1.6 }); }
      A.save();
    });
  }
  jackpot() {
    const p = this.lever.position;
    this.banner('JACKPOT!', 'The Sunwheel sings', 'success');
    this.g.fx?.lootBeam?.({ pos: { x: p.x - 1.6, y: p.y - 2, z: p.z + 1 }, grade: 4, dur: 3 });
    this.g.fx?.burst?.({ pos: { x: p.x - 1.6, y: p.y + 2.5, z: p.z + 1 }, kind: 'confetti', count: 60, speed: 7, up: 0.9 });
    this.sfx('loot_legendary');
    for (const u of this.m.npcs) if (!u.data.npcDef.creature) u.model?.play?.('clap', { dur: 2 });
  }
  diceGame() {
    if (this.busy) return;
    const sea = this.m.sea, A = this.A;
    if (sea.chips < 3) { if (!A.take('silver', 400)) { this.say('You need 3 chips (or 400 silver) to roll with Bones.', 'error'); return; } sea.chips += 3; this.say('Bones slides three chips across for your silver.', 'info'); }
    sea.chips -= 3; this.busy = true;
    const rolls = [0, 1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
    const [dx, dy, dz] = this.diceAt;
    this.dice.forEach((d, i) => {
      d.from.set(dx + (i < 2 ? 0.2 : -0.2), dy + 1.9, dz + (i < 2 ? 1.3 : -1.3));
      d.to.set(dx - 0.5 + (i % 2) * 0.42 + (i > 1 ? 0.62 : 0), dy + 1.25, dz + (i > 1 ? 0.35 : -0.35) + rnd(-0.1, 0.1));
      d.rot = [...FACE_UP[rolls[i]]]; d.rot[1] = rnd(0, TAU);
      d.spin = [rnd(8, 16), rnd(4, 10), rnd(8, 16)]; d.t = i > 1 ? -0.25 : 0;
    });
    this.sfx('dig');
    this.me.faceTo(dx, dz); this.me.model?.play?.('throw', { dur: 0.6 });
    const b = this.m.npcs.find(u => u.data.npcDef.id === 'bones');
    this.m.after(0.3, () => b?.model?.play?.('throw', { dur: 0.6 }));
    this.m.after(1.6, () => {
      this.busy = false;
      const you = rolls[0] + rolls[1], bones = rolls[2] + rolls[3], dbl = rolls[0] === rolls[1];
      let win = 0, text;
      if (you > bones) { win = 6 + (dbl ? 2 : 0); text = `You roll ${you}, Bones rolls ${bones}. You win${dbl ? ' — doubles!' : '!'}`; }
      else if (you === bones) { win = 3; text = `${you} each. A push — Bones returns your chips.`; }
      else text = `You roll ${you}, Bones rolls ${bones}. “Heh heh heh.”`;
      sea.chips += win;
      this.say(`${text}${win > 3 ? ` +${win - 3} chips (${sea.chips}).` : ''}`, win > 3 ? 'success' : 'info');
      if (win > 3) this.sfx('coin');
      b?.model?.play?.(win > 3 ? 'facepalm' : 'laugh', { dur: 1.8 });
      this.A.save();
    });
  }
  progress() { if (this.m.hasSoul()) return null; const c = this.m.sea.chips; return { label: `Gilded Chips ${c} / 50 · the Baroness trades them for the Soul`, pct: clamp(c / 50, 0, 1) * 100 }; }
  win() { this.m.sea.chips = Math.max(50, this.m.sea.chips); this.say('Chips: 50. Talk to the Baroness.', 'info'); }
};

// ------------------------------------------------------------------------------------------------ Songstone: the Cantors
GIMMICKS.songs = class Songs extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.cantors ||= {};
    const cols = [0xffd070, 0x6ad0ff, 0xffa0d0, 0xff7050, 0xfff0a0];
    this.statues = CANTORS.map((c, i) => {
      const sp = this.spot('cantor' + i);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i]).multiplyScalar(2.2), transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; ring.position.set(sp[0], sp[1] + 4.4, sp[2]); m.keep(ring);
      m.marker(cap(c.name), sp[0], sp[2], 4.6, 'Cantor');
      return { ...c, i, pos: new THREE.Vector3(sp[0], sp[1] + 3, sp[2]), ring, humT: rnd(0.5, 3), humming: 0, done: !!sea.cantors[c.song] };
    });
    this.off = this.s.bus.on('song', ev => this.onSong(ev));
    this.stone = this.spot('stone');
    this.mk = m.marker('The Songstone', this.stone[0], this.stone[2], 4.2);
    if (this.allDone()) this.glowStone();
  }
  exit() { this.off?.(); }
  allDone() { return this.statues.every(s => s.done); }
  update(dt) {
    const me = this.me, t = G.uTime.value;
    for (const s of this.statues) {
      s.ring.material.opacity = s.done ? 0.8 + Math.sin(t * 2 + s.i) * 0.12 : 0.15 + (s.humming > 0 ? 0.55 + Math.sin(t * 6) * 0.1 : 0);
      s.ring.rotation.z += dt * (s.done ? 0.8 : 0.25);
      s.ring.position.y = s.pos.y + 1.4 + Math.sin(t * 1.3 + s.i) * 0.08;
      if (s.humming > 0) s.humming -= dt;
      if (s.done || !me) continue;
      s.humT -= dt;
      if (s.humT <= 0 && Math.hypot(me.pos.x - s.pos.x, me.pos.z - s.pos.z) < 10) this.hum(s);
    }
  }
  hum(s) {
    s.humT = 18;
    const secs = this.g.audio?.song?.(s.song, { pos: s.pos, vol: 0.9 }) || 9;
    s.humming = secs;
    for (let k = 0; k < 6; k++) this.m.after(k * 1.3, () => this.g.fx?.burst?.({ pos: { x: s.pos.x, y: s.pos.y + 1.2, z: s.pos.z }, kind: 'note', count: 4, speed: 1.4, up: 0.9, life: 1.8, flash: false }));
    if (!this.hinted) { this.hinted = true; this.say(`${cap(s.name)} hums a melody… Stand before it (G) and answer with the same song.`, 'info'); }
  }
  interactable() {
    for (const s of this.statues) if (this.near('cantor:' + s.i, 3)) return obj('cantor', s.done ? `${cap(s.name)} (answered)` : `Answer ${s.name}`, { cantor: s });
    if (this.allDone() && !this.m.hasSoul() && this.near('stone', 4.5)) return obj('stone', 'Touch the Songstone');
    return null;
  }
  interact(t) {
    if (t.isle === 'stone') { this.m.claimSoul(); return true; }
    if (t.isle !== 'cantor') return false;
    const s = t.cantor;
    if (s.done) { this.say(`${cap(s.name)} hums contentedly: ${SONG_NAMES[s.song]}.`, 'info'); return true; }
    this.me.faceTo(s.pos.x, s.pos.z);
    this.ask(s);
    return true;
  }
  async ask(s) {
    const choices = [{ id: 'listen', text: 'Listen to its melody again.', kind: 'talk' }, ...Object.entries(SONG_NAMES).map(([id, n]) => ({ id, text: `Play ${n}`, kind: 'quest' })), { id: 'bye', text: 'Step back.', kind: 'leave' }];
    const pickId = await this.s.ui.dialog({ name: cap(s.name), title: 'Cantor of the Songstone' }, [{ text: 'The stone face waits, lips parted, as if mid-verse. Which song was it humming?', choices }]);
    if (this.g.mode !== this.m) return;
    if (pickId === 'listen') { s.humT = 0; this.hum(s); }
    else if (SONG_NAMES[pickId]) this.m.playSong(pickId);
  }
  onSong(ev) {
    const me = this.me; if (!me) return;
    let best = null, bd = 10;
    for (const s of this.statues) { if (s.done) continue; const d = Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z); if (d < bd) { bd = d; best = s; } }
    if (!best) return;
    // judged a few bars in (before the Songs feature's own after-effects, e.g. Homeward's recall)
    this.m.after(3, () => {
      if (best.done) return;
      if (best.song === ev.id) {
        best.done = true; this.m.sea.cantors[best.song] = true;
        this.sfx('harp_big', best.pos); this.g.fx?.burst?.({ pos: { x: best.pos.x, y: best.pos.y + 1, z: best.pos.z }, kind: 'holy', count: 30, speed: 4, up: 0.6 });
        const n = this.statues.filter(s => s.done).length;
        this.banner(`${cap(best.name)} answers`, `${SONG_NAMES[best.song]} · ${n}/5`, 'success');
        if (!(this.A.roster.songs ||= []).includes(best.song)) { this.A.roster.songs.push(best.song); this.say(`You learned ${SONG_NAMES[best.song]} (Songs key).`, 'success'); }
        this.A.save();
        if (this.allDone()) this.m.after(2.5, () => this.finale());
      } else {
        this.say(`${cap(best.name)} falls silent. That was not its song.`, 'warn');
        this.g.fx?.burst?.({ pos: { x: best.pos.x, y: best.pos.y + 1, z: best.pos.z }, kind: 'smoke', count: 10, speed: 1.2, flash: false });
        best.humT = Math.min(best.humT, 4);
      }
    });
  }
  glowStone() {
    if (this.stoneGlow) return;
    const [x, y, z] = this.stone;
    this.stoneGlow = this.m.keep(new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ad8ff).multiplyScalar(2.2), transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.stoneGlow.position.set(x, y + 2.1, z); this.stoneGlow.scale.set(1, 1.45, 1);
    const l = new THREE.PointLight(0x9ad8ff, 5, 16, 1.6); l.position.set(x, y + 3, z); this.m.keep(l);
  }
  finale() {
    const [x, y, z] = this.stone;
    this.glowStone();
    this.g.fx?.play?.('light_pillar', { pos: { x, y, z }, x, z, color: 0x9ad8ff, r: 4 });
    this.g.audio?.stinger?.('quest_complete');
    this.banner('The Songstone wakes', 'Five voices, one chord.', 'success');
    for (const s of this.statues) this.g.fx?.burst?.({ pos: { x: s.pos.x, y: s.pos.y + 1.5, z: s.pos.z }, kind: 'note', count: 16, speed: 2, up: 0.8, flash: false });
    for (const id of Object.keys(SONG_NAMES)) if (!(this.A.roster.songs ||= []).includes(id)) this.A.roster.songs.push(id);
    this.m.after(2, () => this.m.claimSoul());
  }
  progress() { if (this.m.hasSoul()) return null; const n = this.statues.filter(s => s.done).length; return { label: `Cantors answered ${n} / 5`, pct: n / 5 * 100 }; }
  win() { for (const s of this.statues) { s.done = true; this.m.sea.cantors[s.song] = true; } this.finale(); }
};

// ------------------------------------------------------------------------------------------------ Powderkeg: defend the bastion
const PIRATE = { name: 'Blackgull Cutthroat', model: 'pirate', hero: 'pirate', radius: 0.45, height: 1.85, hp: 12, atk: 0.02, speed: 4.6, aggro: 40, mass: 1,
  attacks: [{ id: 'slash', range: 1.8, cd: 1.7, windup: 0.45, dur: 0.95, anim: 'slash_h', hit: { shape: 'cone', r: 2.2, angle: 1.9, coef: 1 } }] };
const CAPTAIN = { name: 'Captain Redgull', model: 'pirate', hero: 'pirate', radius: 0.55, height: 2.2, hp: 260, atk: 0.035, speed: 4.2, aggro: 60, mass: 3, superArmor: 1,
  attacks: [{ id: 'cleave', range: 2.6, cd: 2.4, windup: 0.7, dur: 1.3, anim: 'atk2', tele: true, hit: { shape: 'cone', r: 3.4, angle: 2.2, coef: 1.4, knock: 'push', kb: 2.5 } },
    { id: 'pistol', range: 12, minRange: 4, cd: 5, windup: 0.6, dur: 1.0, anim: 'shoot', proj: { speed: 26, range: 14, radius: 0.35, kind: 'bullet', color: 'orange', hit: { coef: 1.2 } } }] };
/** pirates fight the hero when close, otherwise march on the powder magazine and hack at it */
class RaiderAI extends MobAI {
  constructor(u, tpl, o, gim) { super(u, tpl, o); this.gim = gim; }
  update(dt, L) {
    const u = this.u, me = this.gim.me, mag = this.gim.mag;
    if (me && !me.dead && !this.gim.manning && u.distTo(me) < 9) return super.update(dt, L);
    for (const [k, v] of this.cds) { if (v - dt <= 0) this.cds.delete(k); else this.cds.set(k, v - dt); }
    u.move.x = u.move.z = 0; if (u.disabled || u.skill) return;
    if (this.delay > 0) { this.delay -= dt; return; }
    const dx = mag.x - u.pos.x, dz = mag.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.6) {
      this.hackT = (this.hackT ?? rnd(0.2, 1)) - dt; u.faceTo(mag.x, mag.z);
      if (this.hackT <= 0) { this.hackT = 1.6; u.model?.play?.('slash_h', { dur: 0.8 }); this.gim.hitMag(u.data.elite ? 6 : 2.5, u); }
      return;
    }
    this.pathT = (this.pathT || 0) - dt;
    if (!this.mpath || this.pathT <= 0) { this.mpath = L.nav.path(u.pos.x, u.pos.z, mag.x, mag.z, 0.3, 12000); this.pathT = 1.5; }
    let p = this.mpath?.[0];
    while (p && Math.hypot(p.x - u.pos.x, p.z - u.pos.z) < 0.6) { this.mpath.shift(); p = this.mpath[0]; }
    const tx = p ? p.x : mag.x, tz = p ? p.z : mag.z, px = tx - u.pos.x, pz = tz - u.pos.z, pd = Math.hypot(px, pz) || 1;
    u.move.x = px / pd * u.st.speed; u.move.z = pz / pd * u.st.speed;
  }
}
function longboat() {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x6a4428, side: THREE.DoubleSide }), dark = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, TAU, Math.PI / 2, Math.PI / 2), wood);
  hull.scale.set(1.25, 0.75, 3.4); hull.position.y = 0.42; g.add(hull);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshLambertMaterial({ color: 0x8a6440 }));
  floor.rotation.x = -Math.PI / 2; floor.scale.set(1.0, 2.9, 1); floor.position.y = 0.12; g.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 6, 28), dark); rim.scale.set(1.25, 3.4, 1); rim.rotation.x = Math.PI / 2; rim.position.y = 0.42; g.add(rim);
  for (let k = 0; k < 3; k++) { const th = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.3), dark); th.position.set(0, 0.3, -1.3 + k * 1.3); g.add(th); }
  g.userData.oars = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const pivot = new THREE.Group(); pivot.position.set(s * 1.15, 0.5, -1.3 + k * 1.3);
    const oar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a6a44 })); oar.position.x = s * 1.0; oar.rotation.z = -s * 0.35; pivot.add(oar);
    pivot.userData = { s, k }; g.add(pivot); g.userData.oars.push(pivot);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), dark); pole.position.set(0, 1.4, 2.6); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: 0x141414, side: THREE.DoubleSide })); flag.position.set(0.45, 2.2, 2.6); g.add(flag);
  const skull = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide })); skull.position.set(0.45, 2.2, 2.61); g.add(skull);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
GIMMICKS.defense = class Defense extends Gimmick {
  enter() {
    const m = this.m;
    this.wave = 0; this.magHp = 100; this.boats = []; this.brigs = []; this.spawned = 0; this.waveLeft = 0;
    const a = m.anchor('magazine'); this.mag = { x: a.x, z: a.z };
    this.manning = null;
    this.mk = m.marker('Powder Magazine', a.x, a.z - 2.6, 5.2, 'Defend it!');
  }
  exit() { this.dismount(); for (const b of this.boats) b.g.removeFromParent(); for (const r of this.brigs) r.rig.dispose(); this.boats = []; this.brigs = []; }
  line(id) {
    if (id !== 'gunnery') return null;
    if (this.state === 'fight') return `Wave ${this.wave} of 3! Man a cannon — or get down there and cut them off the magazine!`;
    if (this.m.hasSoul()) return 'The Blackgulls won’t forget this cove. Neither will I. Want another go at them?';
    return null;
  }
  choices(id) { if (id === 'gunnery' && this.state !== 'fight') return [{ id: 'start', text: this.state === 'lost' ? 'Let’s try that again. Man the guns!' : 'Man the guns! Let them come.', kind: 'quest' }]; return []; }
  choose(id, c) { if (c === 'start') this.start(); }
  start() {
    this.state = 'fight'; this.wave = 0; this.magHp = 100; this.spawned = 0; this.waveLeft = 0; this.warned = false;
    this.g.audio?.stinger?.('boss_intro'); this.g.audio?.music?.('boss');
    this.banner('Defend Powderkeg Cove', 'Three waves of Blackgull pirates. Keep the powder magazine standing — the cannons are yours.', 'warn', 3.5);
    this.m.after(4, () => this.nextWave());
  }
  nextWave() {
    if (this.state !== 'fight') return;
    this.wave++;
    this.banner(`Wave ${this.wave} of 3`, this.wave === 3 ? 'Captain Redgull leads the charge!' : 'Longboats on the water!', 'warn');
    const n = 2 + this.wave;
    this.waveLeft = n; this.spawned = 0;
    for (let i = 0; i < n; i++) this.m.after(i * 3.5, () => this.launchBoat(i % 2, this.wave === 3 && i === n - 1));
    if (this.wave >= 2) this.m.after(2, () => this.brig());
  }
  launchBoat(side, captain) {
    if (this.state !== 'fight') return;
    const m = this.m, from = m.anchor('sea:' + (side ? 1 : 0)), land = m.anchor('land:' + side);
    const g = longboat(); m.keep(g);
    const b = { g, x: from.x + rnd(-6, 6), z: from.z + rnd(-4, 4), tx: land.x, tz: land.z, side, captain, hp: captain ? 4 : 3, crew: captain ? 3 : 3 + (this.wave > 1 ? 1 : 0), t: 0, sunk: false };
    b.h = Math.atan2(-(b.tx - b.x), -(b.tz - b.z));
    // a few pirates visible in the boat
    b.rowers = [];
    for (let k = 0; k < 2; k++) { const r = PROVIDERS.hero?.({ cls: null, sex: 'm', look: {}, npc: 'pirate', lod: 'crowd', seed: Math.floor(rnd(1, 999)) }); if (!r) continue; r.root.position.set(0, 0.1, -0.9 + k * 1.6); r.root.scale.setScalar(0.95); r.play?.('sit', { dur: 1 }); g.add(r.root); b.rowers.push(r); }
    this.boats.push(b);
  }
  brig() {
    if (this.state !== 'fight') return;
    const rig = new ShipRig('pirate', { waves: this.m.zone.sea.waves });
    this.m.zone.root.add(rig.root);
    const west = Math.random() < 0.5, lane = this.m.anchor('brig')?.z ?? -72;
    const r = { rig, x: west ? -150 : 150, z: lane, h: west ? -Math.PI / 2 : Math.PI / 2, dir: west ? 1 : -1, hp: 8, fireT: 3, sunk: false };
    rig.place(r.x, r.z, r.h);
    this.brigs.push(r);
    this.say('A Blackgull brig is running the bastion! Sink it with the cannons (8 hits).', 'warn');
  }
  update(dt) {
    const m = this.m, t = G.uTime.value, W = m.zone.sea.waves;
    if (this.manning) this.updateGun(dt);
    // longboats row in
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i]; b.t += dt;
      if (b.sunk) { b.sinkT += dt; b.g.position.y -= dt * 0.9; b.g.rotation.z += dt * 0.5 * (b.side ? 1 : -1); if (b.sinkT > 3.5) { this.dropBoat(b); this.boats.splice(i, 1); } continue; }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d < 2.5) { this.land(b); this.dropBoat(b); this.boats.splice(i, 1); continue; }
      const sp = d < 8 ? 2.5 + d * 0.2 : 4.2; b.x += dx / d * sp * dt; b.z += dz / d * sp * dt;
      b.g.position.set(b.x, W.height(b.x, b.z, t) - 0.15, b.z); b.g.rotation.set(Math.sin(t * 1.4 + i) * 0.05, b.h, Math.sin(t * 1.1 + i) * 0.06);
      for (const o of b.g.userData.oars) o.rotation.y = Math.sin(t * 4.5 + o.userData.k * 0.3) * 0.45 * o.userData.s;
      b.splashT = (b.splashT || 0) - dt;
      if (b.splashT <= 0) { b.splashT = 0.9; this.g.fx?.burst?.({ pos: { x: b.x, y: 0.1, z: b.z }, kind: 'water', count: 6, speed: 2, up: 0.5, size: 0.3, life: 0.6 }); }
    }
    // brigs sail past and broadside the bastion
    for (let i = this.brigs.length - 1; i >= 0; i--) {
      const r = this.brigs[i];
      if (r.sunk) { r.sinkT += dt; r.rig.sink = r.sinkT * 1.1; r.rig.list = Math.min(0.5, r.sinkT * 0.12) * r.dir; r.rig.update(dt, t, { x: r.x, z: r.z, heading: r.h, speed: 0, turn: 0, sail: 0.2 }); if (r.sinkT > 7) { r.rig.dispose(); this.brigs.splice(i, 1); } continue; }
      const slow = Math.abs(r.x) < 40 ? 3.2 : 6;
      r.x += slow * r.dir * dt; r.rig.update(dt, t, { x: r.x, z: r.z, heading: r.h, speed: slow, turn: 0, sail: 1 });
      r.fireT -= dt;
      if (r.fireT <= 0 && Math.abs(r.x) < 55 && this.state === 'fight') { r.fireT = 6.5; this.brigVolley(r); }
      if (Math.abs(r.x) > 160 && Math.sign(r.x) === r.dir) { r.rig.dispose(); this.brigs.splice(i, 1); }
    }
    // wave bookkeeping
    if (this.state === 'fight' && this.wave > 0 && this.spawned >= this.waveLeft && !this.boats.length) {
      const alive = this.m.units.some(u => !u.dead && this.L.byId.has(u.id));
      if (!alive && !this.advancing) {
        this.advancing = true;
        if (this.wave >= 3) this.victory();
        else { this.banner('Wave repelled', 'Reload! More sails on the horizon…', 'success'); this.m.after(5, () => { this.advancing = false; this.nextWave(); }); }
      }
    }
  }
  dropBoat(b) { for (const r of b.rowers || []) r.dispose?.(); b.g.removeFromParent(); }
  land(b) {
    const m = this.m;
    for (let k = 0; k < b.crew; k++) {
      const isCap = b.captain && k === 0, tpl = isCap ? CAPTAIN : PIRATE;
      const u = m.mob(tpl, b.tx + rnd(-1.5, 1.5), b.tz + rnd(-1.5, 1.5), { name: tpl.name, elite: isCap, scale: isCap ? 1.15 : 1, sex: !isCap && Math.random() < 0.3 ? 'f' : 'm',
        ai: uu => new RaiderAI(uu, tpl, { aggro: 40, alert: true, delay: k * 0.3 }, this) });
      if (isCap) { this.captain = u; u.data.title = 'Scourge of the Blackgulls'; this.banner('Captain Redgull', 'has landed!', 'warn'); }
    }
    this.spawned++;
    this.sfx('wave_splash', { x: b.tx, y: 0, z: b.tz });
    this.g.fx?.burst?.({ pos: { x: b.tx, y: 0.3, z: b.tz }, kind: 'water', count: 16, speed: 4, up: 0.6 });
  }
  brigVolley(r) {
    const m = this.m, ship = r.rig.ship, side = r.dir > 0 ? 'R' : 'L';   // heading east the bastion is to starboard
    const f = ship.fire?.(side);
    const socks = ship.sockets?.['cannons' + side] || [];
    socks.forEach((s, i) => this.m.after(f?.times?.[i] ?? i * 0.12, () => {
      s.getWorldPosition(_v); s.getWorldDirection(_w).negate();
      this.g.fx?.burst?.({ pos: { x: _v.x + _w.x * 0.6, y: _v.y, z: _v.z + _w.z * 0.6 }, kind: 'fire', color: 'ember', count: 10, speed: 7, size: 0.4, life: 0.25, dir: { x: _w.x, y: 0.1, z: _w.z }, spread: 0.3 });
      this.g.fx?.burst?.({ pos: { x: _v.x + _w.x * 1.4, y: _v.y, z: _v.z + _w.z * 1.4 }, kind: 'smoke', count: 6, speed: 2, size: 1.2, life: 1.4, flash: false });
      this.sfx('cannon', _v, 0.8);
    }));
    for (let k = 0; k < 3; k++) {
      const near = k === 0 && Math.random() < 0.6, tx = near ? this.mag.x + rnd(-3, 3) : rnd(-16, 16), tz = near ? this.mag.z - rnd(1, 4) : rnd(-42, -26);
      this.m.after(0.4 + k * 0.35, () => m.hazard({ shape: 'circle', x: tx, z: tz, r: 4, dur: 1.6, color: 'orange', pct: 0.1, knock: 'down', onBlast: () => {
        const y = m.y(tx, tz);
        this.g.fx?.play?.('explosion', { pos: { x: tx, y, z: tz }, x: tx, z: tz, r: 3.5 }); this.sfx('explosion', { x: tx, y, z: tz }, 0.8);
        if (Math.hypot(tx - this.mag.x, tz - (this.mag.z - 3)) < 5.5) this.hitMag(6);
      } }));
    }
  }
  hitMag(n, by) {
    if (this.state !== 'fight') return;
    this.magHp = Math.max(0, this.magHp - n);
    this.g.fx?.burst?.({ pos: { x: this.mag.x, y: this.m.y(this.mag.x, this.mag.z) + 1.5, z: this.mag.z - 1.5 }, kind: 'debris', count: 4, speed: 3 });
    if (this.magHp <= 0) this.lose();
    else if (this.magHp < 40 && !this.warned) { this.warned = true; this.banner('The magazine is burning!', 'Drive them off it!', 'warn'); }
  }
  lose() {
    this.state = 'lost';
    const a = this.m.anchor('magazine'), y = this.m.y(a.x, a.z);
    this.g.fx?.play?.('explosion_big', { pos: { x: a.x, y, z: a.z - 3 }, x: a.x, z: a.z - 3, r: 8 }); this.sfx('explosion_big', { x: a.x, y, z: a.z });
    this.g.cam.shake(0.8);
    this.banner('The magazine blows!', 'The Blackgulls cheer from their boats. Talk to Gunner Hettie to try again.', 'defeat', 4);
    this.cleanup();
    this.g.audio?.music?.('sea');
  }
  victory() {
    this.state = 'won';
    this.banner('The cove holds!', 'The Blackgulls turn tail.', 'clear', 3.5);
    this.g.audio?.music?.('sea');
    this.cleanup();
    this.m.after(2.5, () => { if (!this.m.hasSoul()) this.m.claimSoul(); else { this.A.give('pirate', 20); this.say('+20 Pirate Coins from Hettie’s strongbox.', 'success'); } });
  }
  cleanup() {
    for (const u of this.m.units) if (!u.dead && this.L.byId.has(u.id)) this.L.remove(u);
    this.m.units = [];
    for (const b of this.boats) this.dropBoat(b);
    this.boats = []; this.captain = null; this.warned = false; this.advancing = false;
  }
  // ---- manning a cannon
  interactable() {
    if (this.manning) return obj('gun-off', 'Leave the cannon');
    for (let i = 0; i < GUNS.length; i++) if (this.near('gun:' + i, 2.2)) return obj('gun', 'Man the cannon', { gun: i });
    return null;
  }
  interact(t) {
    if (t.isle === 'gun') { this.mount(t.gun); return true; }
    if (t.isle === 'gun-off') { this.dismount(); return true; }
    return false;
  }
  mount(i) {
    const g = this.g, me = this.me, a = this.m.anchor('gun:' + i), sp = this.spot('gun' + i), r = sp[3] || 0;
    me.pos.x = a.x; me.pos.z = a.z; me.data.rooted = true; me.facing = r; me.move.x = me.move.z = 0;
    const fx = -Math.sin(r), fz = -Math.cos(r);
    this.manning = { i, pos: new THREE.Vector3(sp[0] + fx * 1.2, sp[1] + 1.05, sp[2] + fz * 1.2), dir: { x: fx, z: fz }, cd: 0, focus: new THREE.Vector3(sp[0] + fx * 9, sp[1] - 3, sp[2] + fz * 9) };
    const self = this;
    g.player.input = function (dt, inp, cam) {
      const p = cam.groundAt(inp.mouse.x, inp.mouse.y, 0); this.aim.x = p.x; this.aim.z = p.z;
      if ((inp.clicked(0) || inp.clicked(2) || inp.hit('basic') || inp.hit('skill0')) && inp.mouse.over) self.fire(p);
    };
    this.camPrev = { pitch: g.cam.pitch, zoom: g.cam.zoom, maxDist: g.cam.maxDist };
    g.cam.pitch = 0.82; g.cam.maxDist = 52; g.cam.zoom = 48; g.camFocus = this.manning.focus;     // pulled back over the parapet: the gun at the bottom, the approaches above
    me.model?.play?.('interact', { dur: 0.8 });
    this.say('Aim with the mouse and click (or Q) to fire — lead the longboats! G leaves the cannon.', 'info');
  }
  dismount() {
    if (!this.manning) return;
    const g = this.g, me = this.me;
    delete g.player?.input;                               // back to PlayerCtrl.prototype.input
    if (me) me.data.rooted = false;
    if (g.camFocus === this.manning.focus) g.camFocus = null;
    const P = this.camPrev || { pitch: ISO.pitch, zoom: ISO.dist, maxDist: ISO.maxDist };
    g.cam.pitch = P.pitch; g.cam.maxDist = P.maxDist; g.cam.zoom = Math.min(P.zoom, P.maxDist);
    this.manning = null;
  }
  updateGun(dt) { this.manning.cd -= dt; const me = this.me, a = this.g.player?.aim; if (me && a) me.faceTo(a.x, a.z); if (me?.dead) this.dismount(); }
  fire(p) {
    const M0 = this.manning; if (!M0 || M0.cd > 0) return;
    M0.cd = 1.0;
    const from = M0.pos, L = this.L, me = this.me, m = this.m;
    let dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (d > 90) { p = { x: from.x + dx / d * 90, z: from.z + dz / d * 90 }; dx = p.x - from.x; dz = p.z - from.z; d = 90; }
    const dur = clamp(d / 42, 0.45, 1.9);
    this.g.fx?.burst?.({ pos: { x: from.x + dx / d * 0.8, y: from.y, z: from.z + dz / d * 0.8 }, kind: 'fire', color: 'ember', count: 12, speed: 8, size: 0.45, life: 0.25, dir: { x: dx / d, y: 0.2, z: dz / d }, spread: 0.3 });
    this.g.fx?.burst?.({ pos: { x: from.x + dx / d * 1.8, y: from.y, z: from.z + dz / d * 1.8 }, kind: 'smoke', count: 8, speed: 2.5, size: 1.4, life: 1.6, flash: false, dir: { x: dx / d, y: 0.3, z: dz / d } });
    this.sfx('cannon', from); this.g.cam.shake(0.14);
    const h = this.g.fx?.projectile?.({ from: { x: from.x, y: from.y, z: from.z }, to: { x: p.x, y: 0.4, z: p.z }, speed: d / dur, kind: 'grenade', color: 'ember', size: 0.34, arc: Math.min(9, 1 + d * 0.1), impact: false });
    m.after(dur, () => {
      h?.stop?.();
      const y = Math.max(0, m.y(p.x, p.z));
      if (y < 0.3) this.g.fx?.burst?.({ pos: { x: p.x, y: 0.2, z: p.z }, kind: 'water', count: 22, speed: 6, up: 0.9, size: 0.5 });
      this.g.fx?.play?.('explosion', { pos: { x: p.x, y, z: p.z }, x: p.x, z: p.z, r: 3 }); this.sfx('explosion', { x: p.x, y, z: p.z }, 0.7);
      for (const b of this.boats) if (!b.sunk && Math.hypot(b.x - p.x, b.z - p.z) < 4.2) {
        b.hp--; this.g.fx?.burst?.({ pos: { x: b.x, y: 0.8, z: b.z }, kind: 'debris', count: 8, speed: 5 });
        if (b.hp <= 0) { b.sunk = true; b.sinkT = 0; this.spawned++; this.say(b.captain ? 'Captain Redgull’s longboat goes down — he swims for it!' : 'Longboat sunk!', 'success'); if (b.captain) this.land({ ...b, crew: 1, tx: this.m.anchor('land:' + b.side).x, tz: this.m.anchor('land:' + b.side).z }); }
      }
      for (const r of this.brigs) {
        if (r.sunk) continue;
        const lx = p.x - r.x, lz = p.z - r.z, c = Math.cos(r.h), s = Math.sin(r.h), along = -(lx * s + lz * c), across = lx * c - lz * s;
        if (Math.abs(along) < 9 && Math.abs(across) < 3.5) { r.hp--; this.g.fx?.burst?.({ pos: { x: p.x, y: 3, z: p.z }, kind: 'debris', count: 10, speed: 6 }); if (r.hp <= 0) { r.sunk = true; r.sinkT = 0; this.banner('Brig sunk!', 'The Blackgull brig goes down in flames.', 'success'); this.sfx('explosion_big', { x: r.x, y: 2, z: r.z }); } }
      }
      for (const u of this.m.units) if (!u.dead && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 3.5 + u.radius) dealDamage(L, me, u, (me.st.atk || 20000) * 9, { skill: 'cannon', kind: 'skill', stagger: 20 });
    });
  }
  progress() {
    if (this.state !== 'fight') return this.state !== 'won' && !this.m.hasSoul() ? { label: 'Talk to Gunner Hettie to defend the cove', pct: 0 } : null;
    return { label: `Wave ${this.wave}/3 · Powder magazine ${Math.round(this.magHp)}%${this.boats.length ? ` · ${this.boats.filter(b => !b.sunk).length} longboat${this.boats.length > 1 ? 's' : ''} inbound` : ''}`, pct: this.magHp };
  }
  boss() { const c = this.captain; return c && !c.dead ? { name: c.name, title: c.data.title, hp: c.hp, hpMax: c.hpMax, barHp: c.hpMax / 6, stagger: null, destruction: null, enrageLeft: null, counter: false, buffs: [], showHp: true } : null; }
  win() { this.state = 'fight'; this.wave = 3; this.victory(); }
};

// ------------------------------------------------------------------------------------------------ Moonveil: the lantern ritual
const WRAITH = { name: 'Drowned Wraith', model: 'wraith', creature: 'wraith', radius: 0.5, height: 2.1, hp: 16, atk: 0.022, speed: 4.4, aggro: 40, mass: 1,
  attacks: [{ id: 'claw', range: 2, cd: 1.8, windup: 0.5, dur: 1, anim: 'attack', hit: { shape: 'cone', r: 2.4, angle: 1.8, coef: 1 } }] };
GIMMICKS.lanterns = class Lanterns extends Gimmick {
  enter() {
    const m = this.m;
    this.round = 0; this.seq = []; this.input = [];
    const flameMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ad8ff).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.lamps = LANTERNS.map((L, i) => {
      const sp = this.spot('lantern' + i);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), flameMat()); flame.scale.set(1, 1.5, 1);
      flame.position.set(sp[0], sp[1], sp[2]); m.keep(flame);
      const light = new THREE.PointLight(0x7ad8ff, 0, 14, 1.6); light.position.copy(flame.position); m.keep(light);
      return { i, pos: flame.position.clone(), flame, light, lit: 0, flash: 0 };
    });
    this.wisp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcff4ff).multiplyScalar(3), toneMapped: false }));
    this.wisp.visible = false; m.keep(this.wisp);
    this.wispLight = new THREE.PointLight(0xbfefff, 0, 16, 1.5); m.keep(this.wispLight);
    const sh = this.spot('shrine'); this.shrine = new THREE.Vector3(sh[0], sh[1] + 2, sh[2]);
    this.mk = m.marker('Lantern Shrine', sh[0], sh[2], 3.2);
  }
  exit() { this.ghost?.dispose?.(); if (this.g.camFocus === this.wisp.position) this.g.camFocus = null; }
  line(id) { if (id !== 'lanternkeeper') return null; if (this.m.hasSoul()) return 'The drowned rest easy now. Sometimes, on still nights, they hum.'; if (this.state === 'show') return 'Watch the wisp… watch the order.'; if (this.state === 'input') return 'Now! Light them as the wisp did — the post’s foot, G.'; return null; }
  choices(id) { if (id === 'lanternkeeper' && ['idle', 'failed'].includes(this.state) && !this.m.hasSoul()) return [{ id: 'begin', text: this.round ? `Show me again (round ${this.round}/3).` : 'Begin the lantern ritual.', kind: 'quest' }]; return []; }
  choose(id, c) { if (c === 'begin') { if (!this.round) this.round = 1; this.seq = []; this.show(); } }
  show() {
    const n = [3, 4, 5][this.round - 1];
    if (this.seq.length !== n) this.seq = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, n);   // each lantern once per round
    this.input = []; this.state = 'show'; this.showT = -0.8; this.showI = -1;
    for (const l of this.lamps) l.lit = 0;
    this.banner(`The ritual · round ${this.round}/3`, `Follow the wisp: ${n} lanterns.`, 'info');
    this.wisp.visible = true; this.wisp.position.copy(this.shrine);
    this.g.camFocus = this.wisp.position; this.camZoom = this.g.cam.zoom; this.g.cam.zoom = ISO.maxDist;
    this.sfx('ghost_wail', this.shrine, 0.4);
  }
  update(dt) {
    const t = G.uTime.value;
    for (const l of this.lamps) {
      if (l.flash > 0) l.flash -= dt;
      const k = l.lit > 0 ? 1 : Math.max(0, l.flash);
      l.flame.material.opacity = k; l.light.intensity = k * 7; l.flame.scale.set(1 + Math.sin(t * 9 + l.i) * 0.12, 1.5 + Math.sin(t * 7 + l.i) * 0.2, 1);
    }
    if (this.state === 'show') {
      this.showT += dt;
      const step = 1.5, idx = Math.floor(Math.max(0, this.showT) / step), f = (Math.max(0, this.showT) % step) / step;
      if (idx >= this.seq.length) {
        this.state = 'input'; this.wisp.visible = false; this.wispLight.intensity = 0;
        if (this.g.camFocus === this.wisp.position) this.g.camFocus = null;
        this.g.cam.zoom = Math.min(this.camZoom ?? ISO.dist, ISO.maxDist);
        this.say('Now light them in that order (stand at each post and press G).', 'info');
        return;
      }
      const from = idx === 0 ? this.shrine : this.lamps[this.seq[idx - 1]].pos, to = this.lamps[this.seq[idx]].pos;
      const e = Math.min(1, f * 1.35), ee = e * e * (3 - 2 * e);
      this.wisp.position.lerpVectors(from, to, ee); this.wisp.position.y += Math.sin(ee * Math.PI) * 3.5;
      this.wispLight.position.copy(this.wisp.position); this.wispLight.intensity = 6;
      if (this.showT > 0 && Math.random() < dt * 20) this.g.fx?.burst?.({ pos: this.wisp.position, kind: 'frost', count: 2, speed: 0.6, size: 0.2, life: 0.8, flash: false });
      if (idx !== this.showI && f > 0.72) { this.showI = idx; this.lamps[this.seq[idx]].flash = 1.1; this.sfx('note', to, 0.9); this.g.fx?.burst?.({ pos: to, kind: 'frost', color: 0x9ad8ff, count: 12, speed: 2 }); }
    }
    if (this.state === 'wraiths' && this.m.units.every(u => u.dead)) { this.m.units = []; this.state = 'failed'; this.say('The wraiths sink back beneath the sand. Talk to the Lanternkeeper to try again.', 'info'); }
  }
  interactable() {
    if (this.state !== 'input') return null;
    for (let i = 0; i < 5; i++) if (this.near('lantern:' + i, 2.6)) return this.lamps[i].lit ? null : obj('lantern', 'Light the lantern', { i });
    return null;
  }
  interact(t) {
    if (t.isle !== 'lantern') return false;
    const want = this.seq[this.input.length], l = this.lamps[t.i];
    this.me.faceTo(l.pos.x, l.pos.z); this.me.model?.play?.('interact', { dur: 0.7 });
    if (t.i === want) {
      this.input.push(t.i); l.lit = 1; this.sfx('fire', l.pos, 0.8); this.g.fx?.burst?.({ pos: l.pos, kind: 'frost', color: 0x9ad8ff, count: 16, speed: 3 });
      if (this.input.length === this.seq.length) {
        this.state = 'idle';
        if (this.round >= 3) this.finale();
        else { this.round++; this.seq = []; this.banner('The drowned sigh…', `Round ${this.round} begins.`, 'success'); this.state = 'between'; this.m.after(3, () => this.show()); }
      }
    } else {
      this.state = 'wraiths';
      for (const x of this.lamps) x.lit = 0;
      this.banner('Wrong lantern!', 'The drowned rise, cross and cold.', 'warn');
      this.sfx('ghost_wail', this.me.pos);
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + rnd(0, 1), x = this.me.pos.x + Math.cos(a) * 6, z = this.me.pos.z + Math.sin(a) * 6; this.m.mob(WRAITH, x, z, { name: WRAITH.name }); }
      this.seq = [];
    }
    return true;
  }
  finale() {
    const m = this.m;
    this.state = 'done';
    this.banner('The Moonveil rests', 'All five lanterns burn together.', 'clear', 3.5);
    for (const l of this.lamps) l.lit = 1;
    this.g.fx?.play?.('light_pillar', { pos: this.shrine, x: this.shrine.x, z: this.shrine.z, color: 0x9ad8ff, r: 5 });
    this.g.audio?.stinger?.('quest_complete');
    // the drowned captain's ghost rises from the moon basin and bows
    const ghost = PROVIDERS.hero?.({ cls: null, sex: 'm', look: {}, npc: 'sailor', lod: 'full', seed: 7 });
    if (ghost) {
      ghost.root.position.set(this.shrine.x, this.shrine.y - 1.1, this.shrine.z); ghost.root.rotation.y = 0; m.keep(ghost.root);
      ghost.setTint?.(0x9ad8ff, 0.85); ghost.setGlow?.(0x6ac8ff, 1.4); ghost.update?.(0.016, {});
      this.m.after(0.6, () => ghost.play?.('bow', { dur: 2.4 }));
      const l = new THREE.PointLight(0x9ad8ff, 6, 10, 1.6); l.position.set(this.shrine.x, this.shrine.y + 1, this.shrine.z); m.keep(l);
      this.ghost = ghost; this.ghostUpd = true;
    }
    m.after(2.8, () => m.claimSoul());
    m.after(8, () => { if (this.ghost) { this.g.fx?.burst?.({ pos: this.ghost.root.position, kind: 'frost', count: 30, speed: 2, up: 0.8 }); this.ghost.root.visible = false; } });
  }
  progress() {
    if (this.m.hasSoul()) return null;
    if (this.state === 'input') return { label: `Round ${this.round}/3 · lanterns ${this.input.length}/${this.seq.length}`, pct: ((this.round - 1) + this.input.length / this.seq.length) / 3 * 100 };
    return { label: this.round ? `The lantern ritual · round ${this.round}/3` : 'Speak with the Lanternkeeper', pct: Math.max(0, this.round - 1) / 3 * 100 };
  }
  win() { this.round = 3; this.finale(); }
};

// ------------------------------------------------------------------------------------------------ Stormcrown: the climb
GIMMICKS.climb = class Climb extends Gimmick {
  enter() {
    this.t = 0; this.strikeT = 2; this.best = this.m.sea.climbBest || null; this.amb = 2;
    const b = this.m.anchor('bell'); this.mk = this.m.marker('The Crown Bell', b.x, b.z, 2.2);
    this.flash = 0;
    this.rain = this.g.fx?.weather?.('rain', { intensity: 0.7 }) || null;       // the Maelstrom never stops raining
  }
  exit() { this.rain?.stop?.(); this.rain = null; if (this.g.renderer?.fx) this.g.renderer.fx.flash = 0; }
  line(id) { if (id !== 'stormwarden') return null; if (this.state === 'climb') return 'Keep moving! Up, up!'; if (this.best) return `Your best ascent: ${this.best.toFixed(1)} s. The storm remembers.`; return null; }
  choices(id) { return id === 'stormwarden' && this.state !== 'climb' ? [{ id: 'how', text: 'How do I reach the Crown Bell?', kind: 'talk' }] : []; }
  choose(id, c) { if (c === 'how') this.say('Take the ledge from the spire’s foot. Once you set foot on it the storm hunts you — three minutes to the summit. Never stand still.', 'info'); }
  start() {
    this.state = 'climb'; this.t = 0; this.strikeT = 1.8;
    this.banner('The Ascent', 'Lightning strikes where you stand — keep moving. Ring the Crown Bell.', 'warn', 3.2);
    this.g.audio?.music?.('boss');
  }
  stop(msg) { this.state = 'idle'; if (msg) this.say(msg, 'warn'); this.g.audio?.music?.(this.m.I.music || 'field_dark'); }
  bolt(x, z, r, dur, pct) {
    this.m.hazard({ shape: 'circle', x, z, r, dur, color: 'yellow', pct, knock: 'down', kb: 1.5, onBlast: () => {
      const y = this.m.y(x, z);
      this.g.fx?.lightning?.({ from: { x: x + rnd(-5, 5), y: y + 45, z: z - 12 }, to: { x, y, z }, color: 'lightning', width: 0.5 });
      this.g.fx?.shockwave?.({ pos: { x, y: y + 0.1, z }, radius: r + 0.5, color: 'lightning', dur: 0.35, dust: false });
      this.g.fx?.burst?.({ pos: { x, y: y + 0.3, z }, kind: 'lightning', count: 14, speed: 5 });
      this.sfx('thunder', { x, y, z }, 1.1); this.flash = 0.4;
    } });
  }
  update(dt) {
    const me = this.me; if (!me) return;
    const L = this.m.zone.ledgeAt?.(me.pos.x, me.pos.z);
    // distant strikes on the sea all the time (and a sky flash with each)
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 3); if (this.g.renderer?.fx) this.g.renderer.fx.flash = Math.max(this.g.renderer.fx.flash || 0, this.flash * 0.35); }
    this.amb -= dt;
    if (this.amb <= 0) { this.amb = rnd(3, 7); const a = rnd(0, TAU), r = rnd(55, 85), x = Math.cos(a) * r, z = Math.sin(a) * r - 6; this.g.fx?.lightning?.({ from: { x: x + rnd(-6, 6), y: 70, z: z - 20 }, to: { x, y: 0, z }, color: 'lightning', impact: false }); this.sfx('thunder', { x, y: 0, z }, 0.55); this.flash = 0.25; }
    if (this.state !== 'climb') {
      if (this.state === 'done' && (!L || L.t < 0.05)) this.state = 'idle';           // back at the foot: ready for another run
      if (this.state === 'idle' && L && L.t > 0.015 && L.t < 0.12 && !me.dead) this.start();
      return;
    }
    this.t += dt;
    if (me.dead) return this.stop('The storm wins this time. The ledge waits for you.');
    if (!L) { if (me.pos.y < 3) this.stop('You step off the ledge. The storm loses interest… for now.'); return; }
    if (this.t > 180) {
      const c = this.m.anchor('climb');
      this.bolt(me.pos.x, me.pos.z, 3, 0.6, 0.2);
      this.m.after(0.7, () => { if (!c || this.me.dead) return; this.me.pos.x = c.x; this.me.pos.z = c.z; this.g.cam.snap(this.me.pos); applyKnock(this.L, null, this.me, 'down', 0.5, c.x, c.z + 1, 1.4); });
      return this.stop('The Tempest’s patience runs out — it hurls you back to the foot of the spire!');
    }
    this.strikeT -= dt;
    if (this.strikeT <= 0) {
      const prog = L.t;
      this.strikeT = Math.max(0.75, 2.0 - prog * 1.2);
      this.bolt(me.pos.x + rnd(-0.6, 0.6), me.pos.z + rnd(-0.6, 0.6), 2.4, 1.15, 0.14);
      if (prog > 0.4 && Math.random() < 0.4) { const a = rnd(0, TAU); this.bolt(me.pos.x + Math.cos(a) * 4, me.pos.z + Math.sin(a) * 4, 2.2, 1.4, 0.1); }
    }
  }
  interactable() { const b = this.m.anchor('bell'); if (b && this.near('bell', 3.4) && Math.abs(this.me.pos.y - (b.y ?? 40)) < 3) return obj('bell', 'Ring the Crown Bell'); return null; }
  interact(t) {
    if (t.isle !== 'bell') return false;
    const b = this.m.anchor('bell'), y = b.y ?? 40;
    this.me.faceTo(b.x - 1.8, b.z); this.me.model?.play?.('pull', { dur: 1 });
    this.sfx('bell', { x: b.x, y: y + 8, z: b.z }, 1.5); this.m.after(0.5, () => this.sfx('ship_bell', { x: b.x, y: y + 8, z: b.z }, 1.2));
    this.g.fx?.lightning?.({ from: { x: b.x, y: y + 60, z: b.z - 10 }, to: { x: b.x - 1.8, y: y + 9, z: b.z }, color: 'lightning', width: 0.9 });
    this.g.fx?.shockwave?.({ pos: { x: b.x, y: y + 0.4, z: b.z }, radius: 14, color: 'lightning', dur: 0.8 });
    this.g.cam.shake(0.5); this.flash = 0.6;
    if (this.state === 'climb') {
      const tt = this.t; this.state = 'done';
      const record = !this.best || tt < this.best;
      if (record) { this.best = tt; this.m.sea.climbBest = tt; this.A.save(); }
      this.banner('The Tempest knows your name', `Ascent: ${tt.toFixed(1)} s${record ? ' · a new best!' : ''}`, 'clear', 3.5);
      this.g.audio?.music?.(this.m.I.music || 'field_dark');
      if (!this.m.hasSoul()) this.m.after(1.5, () => this.m.claimSoul());
    } else if (!this.m.hasSoul()) this.say('The bell answers only a true ascent. Climb from the foot of the spire.', 'info');
    return true;
  }
  timer() { return this.state === 'climb' ? { label: 'The Ascent', left: Math.max(0, 180 - this.t), urgent: this.t > 150 } : null; }
  progress() { if (this.state !== 'climb') return null; const L = this.m.zone.ledgeAt?.(this.me.pos.x, this.me.pos.z); return { label: `The Ascent · ${Math.round((L ? L.t : 0) * 40)} m of 40`, pct: (L ? L.t : 0) * 100 }; }
  win() { if (!this.m.hasSoul()) this.m.claimSoul(); }
};

// ------------------------------------------------------------------------------------------------ Hushwater: Coralie's trust
GIMMICKS.mermaid = class Mermaid extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.coralie ||= { pearls: 0, song: false };
    // Coralie sits waist-deep beside her rock; her tail curls behind her and the fin flicks out of the water
    const u = this.coralie = m.npcs.find(n => n.data.npcDef.id === 'coralie');
    if (u) {
      u.data.hover = -0.92 - m.y(u.pos.x, u.pos.z); u.data.reach = 2.2;
      const scale = new THREE.MeshLambertMaterial({ color: 0x1fa296, emissive: 0x08302c });
      const tail = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.95, 0.1), new THREE.Vector3(0, 0.7, 0.8), new THREE.Vector3(0.15, 0.62, 1.6), new THREE.Vector3(0.3, 0.9, 2.2)]);
      const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.2, 10, false), scale); tail.add(body);
      for (let k = 0; k < 6; k++) { const p = curve.getPoint(k / 6); const s = new THREE.Mesh(new THREE.SphereGeometry(0.21 - k * 0.022, 10, 8), scale); s.position.copy(p); tail.add(s); }
      const finMat = new THREE.MeshLambertMaterial({ color: 0x6ae8d0, emissive: 0x1a6a5a, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
      const fin = new THREE.Group(); fin.position.copy(curve.getPoint(1));
      for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12, 0, Math.PI * 0.9), finMat); f.rotation.set(0, Math.PI / 2, s * 0.35 + Math.PI / 2); f.position.y = 0.1; fin.add(f); }
      tail.add(fin); this.fin = fin;
      this.tail = tail;
      u.data.idleT = 3;
    }
    this.beds = [0, 1, 2, 3, 4].map(i => ({ i, cd: 0, bubT: rnd(0, 1), spot: this.spot('bed' + i) }));
    this.dive = null;
    this.off = this.s.bus.on('song', ev => { if (ev.id === 'tides' && this.coralie && this.coralie.distTo(this.me) < 14) this.m.after(2.5, () => this.heardSong()); });
    this.mk = m.marker('Pearl Beds', -4, 9.5, 1.2, 'Dive where it bubbles');
  }
  exit() { this.off?.(); this.tail?.removeFromParent(); if (this.dive) this.surface(); }
  update(dt) {
    const t = G.uTime.value, me = this.me;
    if (this.tail && this.coralie?.model?.root && this.tail.parent !== this.coralie.model.root) this.coralie.model.root.add(this.tail);
    if (this.fin) { this.fin.rotation.x = Math.sin(t * 1.6) * 0.35; this.fin.rotation.z = Math.sin(t * 0.9) * 0.2; }
    for (const b of this.beds) {
      b.cd -= dt; b.bubT -= dt;
      if (b.cd <= 0 && b.bubT <= 0 && b.spot) { b.bubT = rnd(0.35, 0.8); this.g.fx?.burst?.({ pos: { x: b.spot[0] + rnd(-0.5, 0.5), y: 0.05, z: b.spot[2] + rnd(-0.5, 0.5) }, kind: 'water', count: 4, speed: 1, up: 0.9, size: 0.2, life: 0.7 }); }
    }
    const d = this.dive;
    if (d) {
      d.t += dt; d.k = (Math.sin(d.t * d.speed * TAU - Math.PI / 2) + 1) / 2;
      d.bubT -= dt; if (d.bubT <= 0) { d.bubT = 0.25; this.g.fx?.burst?.({ pos: { x: d.x + rnd(-0.3, 0.3), y: 0.05, z: d.z + rnd(-0.3, 0.3) }, kind: 'water', count: 3, speed: 0.8, up: 0.8, size: 0.2, life: 0.6 }); }
      if (d.t > 7) { this.say('You surface, out of breath and empty-handed.', 'info'); this.surface(); return; }
      const inp = this.g.input;
      if (d.t > 0.25 && (inp.hit('dash') || inp.clicked(0) || inp.clicked(2))) this.stopDive();
      if (me?.dead) this.surface();
    }
  }
  interactable() {
    if (this.dive) return obj('dive-stop', 'Grab the pearl!');
    for (const b of this.beds) if (this.near('bed:' + b.i, 2.4)) return b.cd > 0 ? null : obj('bed', 'Dive for pearls', { bed: b });
    return null;
  }
  interact(t) {
    if (t.isle === 'bed') { this.startDive(t.bed); return true; }
    if (t.isle === 'dive-stop') { this.stopDive(); return true; }
    return false;
  }
  startDive(b) {
    const me = this.me, g = this.g, x = b.spot ? b.spot[0] : me.pos.x, z = b.spot ? b.spot[2] : me.pos.z;
    this.dive = { bed: b, t: 0, k: 0, speed: rnd(0.5, 0.7), zone: [0.68, 0.84], x, z, bubT: 0.3 };
    me.data.rooted = true; me.move.x = me.move.z = 0; g.inputBlocked = true;
    me.faceTo(x, z);
    g.fx?.burst?.({ pos: { x, y: 0.1, z }, kind: 'water', count: 26, speed: 4, up: 0.8, size: 0.4 });
    this.sfx('wave_splash', { x, y: 0, z }, 0.9);
    if (me.model?.root) me.model.root.visible = false;
    if (!this.helped) { this.helped = true; this.say('Grab the pearl when the bar sweeps through the golden band: G, Space or click.', 'info'); }
  }
  surface() {
    const me = this.me, d = this.dive; this.dive = null;
    this.g.inputBlocked = false;
    if (!me) return;
    me.data.rooted = false;
    if (me.model?.root) me.model.root.visible = true;
    if (d) { this.g.fx?.burst?.({ pos: { x: d.x, y: 0.1, z: d.z }, kind: 'water', count: 18, speed: 3, up: 0.8, size: 0.35 }); d.bed.cd = 16; }
  }
  stopDive() {
    const d = this.dive; if (!d || d.t < 0.25) return;
    const hit = d.k >= d.zone[0] && d.k <= d.zone[1], near = d.k >= d.zone[0] - 0.1 && d.k <= d.zone[1] + 0.1;
    this.surface();
    this.me.model?.play?.(hit || near ? 'cheer' : 'shrug', { dur: 1.6 });
    if (hit || near) {
      const n = hit ? 2 : 1;
      this.A.give('pearl', n);
      this.s.ui?.hud?.loot?.({ name: 'Sea Pearl', grade: 3, count: n, icon: 'item:pearl', kind: 'material' });
      this.say(hit ? 'A perfect dive — two round pearls!' : 'A pearl!', 'success'); this.sfx(hit ? 'loot_rare' : 'coin');
      this.g.fx?.burst?.({ pos: { x: this.me.pos.x, y: this.me.pos.y + 1.4, z: this.me.pos.z }, kind: 'star', count: 12, speed: 3, up: 0.6 });
    } else this.say('Only sand and a very offended crab.', 'info');
  }
  line(id) {
    const c = this.m.sea.coralie;
    if (id === 'pearler') return 'Bubbles mean pearls. Dive when they rise and grab when your breath is steady — the golden moment.';
    if (id !== 'coralie') return null;
    if (this.m.hasSoul()) return 'You came back! Sit with me a while. The tide is singing.';
    if (c.pearls >= 3 && c.song) return 'Pearls and a song… you understand the sea, surface-dweller.';
    return `Pearls, ${Math.max(0, 3 - c.pearls)} more, if you please${c.song ? '' : ' — and the Serenade of Tides'}. Then I will sing for you.`;
  }
  choices(id) {
    if (id !== 'coralie' || this.m.hasSoul()) return [];
    const c = this.m.sea.coralie, out = [];
    if (c.pearls < 3) out.push({ id: 'give', text: `Offer a pearl (${this.A.count('pearl')} in your bag · ${c.pearls}/3 given).`, kind: 'quest' });
    if (!c.song) out.push({ id: 'sing', text: 'Play her the Serenade of Tides.', kind: 'quest' });
    return out;
  }
  choose(id, c) {
    const st = this.m.sea.coralie;
    if (c === 'give') {
      if (!this.A.take('pearl', 1)) { this.say('You have no pearls. Try the bubbling beds in the shallows.', 'error'); return; }
      st.pearls++; this.sfx('coin'); this.say(`Coralie holds the pearl to the moonlight. (${st.pearls}/3)`, 'success');
      this.coralie?.model?.play?.('cheer', { dur: 1.6 }); this.A.save(); this.check();
    }
    if (c === 'sing') this.m.playSong('tides');
  }
  heardSong() { const st = this.m.sea.coralie; if (st.song) return; st.song = true; this.say('Coralie closes her eyes and sways with the tide.', 'success'); this.A.save(); this.check(); }
  check() {
    const st = this.m.sea.coralie;
    if (!(st.pearls >= 3 && st.song) || this.m.hasSoul()) return;
    const u = this.coralie;
    this.banner('Coralie sings', 'A lullaby older than the Glass Sea', 'success', 3.5);
    this.g.audio?.song?.('rest', { pos: u?.pos });
    if (u?.model?.root) this.g.fx?.play?.('orbiting_notes', { attach: u.model.root, pos: u.pos, dur: 9 });
    // granted at once: the Serenade of Tides (Songs key) also calls the Dawnrunner a few seconds later
    this.m.claimSoul();
    if (!(this.A.roster.collect.bounties || []).includes('bounty:3')) { collect(this.s, 'bounties', 'bounty:3', 'Mermaid’s Tortoiseshell Comb'); this.m.after(1.2, () => this.say('She presses a tortoiseshell comb into your hand. (Sea Bounty)', 'success')); this.s.ui?.hud?.loot?.({ name: 'Mermaid’s Tortoiseshell Comb', grade: 4, count: 1, icon: 'item:sea_bounty', kind: 'collectible' }); }
  }
  progress() {
    if (this.dive || this.m.hasSoul()) return null;
    const c = this.m.sea.coralie; return { label: `Coralie’s trust · pearls ${Math.min(3, c.pearls)}/3 · song ${c.song ? '✓' : '—'}`, pct: (Math.min(3, c.pearls) + (c.song ? 1 : 0)) / 4 * 100 };
  }
  cast() { const d = this.dive; return d ? { name: 'Pearl dive', label: 'Diving… grab the pearl!', pct: d.k, t: d.k, kind: 'charge', perfect: d.zone, left: Math.max(0, 7 - d.t) } : null; }
  win() { const st = this.m.sea.coralie; st.pearls = 3; st.song = true; this.check(); }
};

// ------------------------------------------------------------------------------------------------ Shellback: feed Grandmother Shellback
/** a terrain-hugging ripple ring (the snore) — vertices follow the ground every frame */
class Ripple {
  constructor(heightAt, segs = 128) {
    this.H = heightAt; this.n = segs;
    const g = new THREE.BufferGeometry(), N = segs + 1;
    this.pos = new Float32Array(N * 3 * 3); const col = new Float32Array(N * 3 * 4), idx = [];
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { const j = (i * 3 + k) * 4; col[j] = 0.85; col[j + 1] = 1; col[j + 2] = 0.9; col[j + 3] = k === 1 ? 0.75 : 0; }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = (i + 1) * 3 + k; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.visible = false;
  }
  set(cx, cz, r, w = 1.4, a = 1) {
    const P = this.pos, n = this.n;
    for (let i = 0; i <= n; i++) {
      const ang = i / n * TAU, c = Math.cos(ang), s = Math.sin(ang);
      for (let k = 0; k < 3; k++) { const rr = r + (k - 1) * w, x = cx + c * rr, z = cz + s * rr, j = (i * 3 + k) * 3; P[j] = x; P[j + 1] = Math.max(0.05, this.H(x, z)) + 0.12 + (k === 1 ? 0.25 : 0); P[j + 2] = z; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.material.opacity = a; this.mesh.visible = a > 0.01;
  }
}
GIMMICKS.turtle = class Turtle extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.shellback ||= { fed: 0 };
    this.snoreT = 10; this.carry = null;
    const weedMat = [0x3a7a3a, 0x4a8a2a, 0x2a6a4a].map(c => new THREE.MeshLambertMaterial({ color: c }));
    this.weeds = [0, 1, 2, 3, 4, 5].map(i => {
      const a = m.anchor('weed:' + i); if (!a) return null;
      const g = new THREE.Group();
      for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, rnd(0.8, 1.4), 5), pick(weedMat)); b.position.set(rnd(-0.35, 0.35), 0.45, rnd(-0.35, 0.35)); b.rotation.set(rnd(-0.35, 0.35), 0, rnd(-0.35, 0.35)); b.castShadow = true; g.add(b); }
      g.position.set(a.x, m.y(a.x, a.z), a.z); m.keep(g);
      return { i, g, taken: false, regrow: 0 };
    }).filter(Boolean);
    const h = this.spot('head'); this.head = new THREE.Vector3(h[0], 0, h[2]);
    this.ripple = new Ripple((x, z) => m.y(x, z)); m.keep(this.ripple.mesh);
    const mo = m.anchor('mouth'); this.mk = m.marker('Grandmother Shellback', mo.x, mo.z - 3, 5, 'Feed her seaweed');
  }
  exit() { this.carryMesh?.removeFromParent(); }
  update(dt) {
    const me = this.me;
    for (const w of this.weeds) if (w.taken) { w.regrow -= dt; if (w.regrow <= 0) { w.taken = false; w.g.visible = true; } }
    if (this.carryMesh && me) { this.carryMesh.position.set(me.pos.x, me.pos.y + 2.1, me.pos.z); this.carryMesh.rotation.y = me.facing; }
    // the Great Snore: a ripple rolls out from her head across the whole shell
    this.snoreT -= dt;
    if (this.snoreT <= 2.4 && !this.warned) {
      this.warned = true; this.sfx('roar', this.head, 0.6);
      this.g.fx?.burst?.({ pos: { x: this.head.x, y: 3, z: this.head.z - 6 }, kind: 'dust', count: 20, speed: 3 });
      if (me && Math.hypot(me.pos.x - this.head.x, me.pos.z - this.head.z) < 90) { if (!this.helped) { this.helped = true; this.say('Grandmother Shellback breathes in… dash (Space) through the ripple of her snore!', 'warn'); } this.banner('Deep breath…', 'Dash through the snore!', 'warn', 1.6); }
    }
    if (this.snoreT <= 0) { this.snore(); this.snoreT = rnd(14, 18); this.warned = false; }
    if (this.wave) {
      const w = this.wave; w.r += 11 * dt;
      this.ripple.set(this.head.x, this.head.z, w.r, 1.5, clamp(1.4 - w.r / 90, 0, 1));
      if (me && !me.dead && !w.hit && me.invuln <= 0 && me.pos.y > 0.4) {
        const d = Math.hypot(me.pos.x - this.head.x, me.pos.z - this.head.z);
        if (Math.abs(d - w.r) < 1.1) { w.hit = true; applyKnock(this.L, null, me, 'down', 2.5, this.head.x, this.head.z, 1.2); dealDamage(this.L, null, me, 0, { fixed: Math.round(me.hpMax * 0.04) }); this.drop(); }
      }
      if (w.r > 105) { this.wave = null; this.ripple.mesh.visible = false; }
    }
  }
  snore() {
    this.wave = { r: 3, hit: false };
    this.g.cam.shake(0.3);
    this.sfx('boss_roar', this.head, 0.8);
    this.g.fx?.burst?.({ pos: { x: this.head.x, y: 2.5, z: this.head.z - 4 }, kind: 'dust', count: 30, speed: 5 });
    for (const u of this.m.npcs) if (u.type === 'pip') u.model?.play?.(pick(['surprised', 'cheer', 'spin']), { dur: 1.2 });
  }
  drop() { if (!this.carry) return; this.carry = null; this.carryMesh?.removeFromParent(); this.carryMesh = null; this.say('The snore knocks the seaweed out of your arms!', 'warn'); }
  interactable() {
    if (!this.carry) for (const w of this.weeds) if (!w.taken && this.near('weed:' + w.i, 2.4)) return obj('weed', 'Gather seaweed', { weed: w });
    if (this.carry && this.near('mouth', 4.5)) return obj('feed', 'Feed Grandmother Shellback');
    return null;
  }
  interact(t) {
    if (t.isle === 'weed') {
      const w = t.weed; w.taken = true; w.regrow = 35; w.g.visible = false;
      this.me.model?.play?.('gather', { dur: 1 }); this.sfx('gather');
      this.carry = w; this.carryMesh = w.g.clone(); this.carryMesh.visible = true; this.carryMesh.scale.setScalar(0.7); this.m.keep(this.carryMesh);
      this.say('Seaweed! Carry it to Grandmother Shellback’s head on the north beach.', 'info');
      return true;
    }
    if (t.isle === 'feed') {
      this.carry = null; this.carryMesh?.removeFromParent(); this.carryMesh = null;
      const st = this.m.sea.shellback; st.fed++; this.A.save();
      this.me.model?.play?.('throw', { dur: 0.7 });
      const mo = this.m.anchor('mouth');
      this.g.fx?.burst?.({ pos: { x: mo.x, y: this.m.y(mo.x, mo.z) + 1.5, z: mo.z - 2 }, kind: 'leaf', count: 20, speed: 3, up: 0.6 });
      this.sfx('pip_cheer'); this.say(`Grandmother Shellback munches contentedly. (${Math.min(st.fed, 6)}/6)`, 'success');
      if (st.fed >= 6 && !this.m.hasSoul()) this.m.after(1.5, () => this.wake());
      return true;
    }
    return false;
  }
  wake() {
    this.banner('Grandmother Shellback stirs', 'One ancient eye opens… and something glints in her beak.', 'clear', 3.5);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe080).multiplyScalar(2.2), toneMapped: false }));
    const h = this.spot('head'); eye.position.set(h[0] + 3.6, (h[1] || 2) + 1.6, h[2] - 2.6); this.m.keep(eye);
    this.sfx('boss_roar', this.head, 0.5); this.g.cam.shake(0.3);
    for (const u of this.m.npcs) if (u.type === 'pip') u.model?.play?.('cheer', { dur: 2 });
    this.m.after(3, () => { this.m.claimSoul(); this.m.after(6, () => eye.removeFromParent()); });
  }
  choices(id) {
    const out = [];
    if (id === 'pipmerchant') { out.push({ id: 'pack', text: 'Buy a Pip Card Pack (6,000 silver).', kind: 'shop' }); out.push({ id: 'fig', text: 'Buy a Carved Pip Figurine (2,500 silver).', kind: 'shop' }); }
    return out;
  }
  line(id) {
    const st = this.m.sea.shellback;
    if (id === 'pipmerchant' && !this.m.hasSoul()) return `Pip-pip! (Nib points at the seaweed on the beaches, then at the enormous head to the north. ${Math.min(6, st.fed)}/6 fed.)`;
    if (id === 'pipguard') return 'PIP! (Sprig mimes a big breath, then a huge leap — dash when the snore-ripple reaches you!)';
    if (id === 'pipelder' && this.m.hasSoul()) return 'Pip… (The elder pats the shell fondly. Grandmother is pleased with you.)';
    return null;
  }
  choose(id, c) {
    const A = this.A;
    if (c === 'pack') { if (!A.take('silver', 6000)) { this.say('Not enough silver.', 'error'); return; } A.give('card_pack_pip', 1); this.s.ui?.hud?.loot?.({ name: 'Pip Card Pack', grade: 3, count: 1, icon: 'item:card_pack_pip', kind: 'consumable' }); this.sfx('coin'); }
    if (c === 'fig') { if (!A.take('silver', 2500)) { this.say('Not enough silver.', 'error'); return; } A.give('gift3', 1); this.s.ui?.hud?.loot?.({ name: 'Carved Pip Figurine', grade: 3, count: 1, icon: 'item:gift:3', kind: 'gift' }); this.sfx('coin'); }
  }
  progress() { if (this.m.hasSoul()) return null; const f = Math.min(6, this.m.sea.shellback.fed); return { label: `Grandmother Shellback fed ${f}/6${this.carry ? ' · carrying seaweed' : ''}`, pct: f / 6 * 100 }; }
  timer() { return this.snoreT < 6 && !this.m.hasSoul() ? { label: 'Next snore', left: Math.max(0, this.snoreT), urgent: this.snoreT < 2.5 } : null; }
  win() { this.m.sea.shellback.fed = 6; this.wake(); }
};

// ------------------------------------------------------------------------------------------------ Drownbell: the Bellwarden
class BellwardenAI {
  constructor(u, gim) { this.u = u; this.gim = gim; this.cd = 2.5; this.busy = 0; this.groggy = 0; }
  update(dt, L) {
    const u = this.u, me = this.gim.me;
    this.cd -= dt; this.busy -= dt;
    u.move.x = u.move.z = 0;
    if (u.data.counterWindow > 0) { u.data.counterWindow = Math.max(0, u.data.counterWindow - dt); if (!u.data.counterWindow) u.model?.setGlow?.(1); }
    if (u.dead || !me || this.gim.intro) return;
    if (this.groggy > 0) { this.groggy -= dt; if (this.groggy <= 0) { u.data.groggy = false; u.model?.stop?.(); } return; }
    if (this.busy > 0 || me.dead) return;
    const d = u.distTo(me);
    if (d > 6 && !this.gim.burrowed) { const dx = me.pos.x - u.pos.x, dz = me.pos.z - u.pos.z; u.move.x = dx / d * u.st.speed; u.move.z = dz / d * u.st.speed; }
    else u.faceTo(me.pos.x, me.pos.z);
    if (this.cd <= 0) this.act(d);
  }
  stun(dur) {
    const u = this.u;
    this.groggy = dur; this.busy = 0; u.data.groggy = true;
    this.pending?.cancel(); this.pending = null;
    if (this.gim.burrowed) { this.gim.burrowed = false; u.untargetable = false; u.data.hover = 0; }
    this.u.model?.play?.('stun', { dur, loop: true });
  }
  act(d) {
    const u = this.u, g = this.gim, me = g.me, m = g.m, enraged = u.hp / u.hpMax < 0.35;
    const r = Math.random(), tempo = enraged ? 0.8 : 1;
    u.faceTo(me.pos.x, me.pos.z);
    const fx = -Math.sin(u.facing), fz = -Math.cos(u.facing), x = u.pos.x, z = u.pos.z;
    if (d < 9 && r < 0.32) {
      // crusher snip: a wide cone in front
      this.busy = 1.5 * tempo; this.cd = rnd(1.6, 2.4) * tempo;
      u.model?.play?.('attack', { dur: 1.3 * tempo });
      this.pending = m.hazard({ shape: 'cone', x, z, dx: fx, dz: fz, r: 9, angle: 1.9, dur: 0.95 * tempo, color: 'red', pct: 0.12, knock: 'push', kb: 3, src: u, onBlast: () => { g.sfx('claw', { x: x + fx * 5, y: 1, z: z + fz * 5 }); g.g.fx?.play?.('claw_swipe', { pos: { x, y: 0.5, z }, x, z, dir: { x: fx, z: fz }, r: 8 }); } });
    } else if (r < 0.54) {
      // both claws raised, eyes flare blue — COUNTER it, or eat the slam
      const dur = 1.5 * tempo;
      this.busy = 2.3 * tempo; this.cd = rnd(2.4, 3.4) * tempo;
      u.data.counterWindow = dur * 0.8; u.model?.setGlow?.(3);
      u.data.onCounter = () => { u.model?.setGlow?.(1); this.stun(3.2); g.say('Countered! The Bellwarden reels.', 'success'); };
      g.g.fx?.counterWindow?.({ attach: u.model?.root, pos: u.pos, dur: dur * 0.8, height: 4, scale: 2.4 });
      g.L.emit('counterWindow', { unit: u, dur: dur * 0.8 });
      u.model?.play?.('attack_big', { dur: dur + 0.3 });
      const sx = x + fx * 5.5, sz = z + fz * 5.5;
      this.pending = m.hazard({ shape: 'circle', x: sx, z: sz, r: 6.5, dur, color: 'orange', pct: 0.22, knock: 'down', src: u, onBlast: () => { g.g.fx?.play?.('ground_slam', { pos: { x: sx, y: m.y(sx, sz), z: sz }, x: sx, z: sz, r: 6 }); g.g.cam.shake(0.45); g.sfx('stomp', { x: sx, y: 0, z: sz }, 1.2); } });
    } else if (r < 0.72) {
      // the toll: a ring of force around it — hug it or run far
      this.busy = 2.6 * tempo; this.cd = rnd(2.8, 3.8) * tempo;
      u.model?.play?.('roar', { dur: 2.2 * tempo });
      g.sfx('bell', u.pos, 1.4);
      this.pending = m.hazard({ shape: 'donut', x, z, r: 16, inner: 5.5, dur: 2.1 * tempo, color: 'purple', pct: 0.16, knock: 'down', src: u, onBlast: () => { g.g.fx?.shockwave?.({ pos: { x, y: 0.5, z }, radius: 16, color: 0x6ad0a0, dur: 0.6 }); g.sfx('ship_bell', u.pos, 1.3); g.g.cam.shake(0.3); } });
    } else if (r < 0.87) {
      // froth: three globs of spume lobbed around the hero
      this.busy = 1.6 * tempo; this.cd = rnd(2, 3) * tempo;
      u.model?.play?.('spit', { dur: 1 });
      for (let k = 0; k < (enraged ? 5 : 3); k++) {
        const tx = me.pos.x + rnd(-4, 4), tz = me.pos.z + rnd(-4, 4);
        m.after(k * 0.22, () => {
          g.g.fx?.projectile?.({ from: { x: x + fx * 3, y: 3, z: z + fz * 3 }, to: { x: tx, y: 0.4, z: tz }, speed: 14, kind: 'water', arc: 5, size: 0.5 });
          m.hazard({ shape: 'circle', x: tx, z: tz, r: 2.8, dur: 1.3, color: 'red', pct: 0.08, src: u, onBlast: () => g.g.fx?.burst?.({ pos: { x: tx, y: 0.4, z: tz }, kind: 'water', count: 16, speed: 5, up: 0.7 }) });
        });
      }
    } else {
      // burrow, then burst out under the hero
      this.busy = 3.6 * tempo; this.cd = rnd(3, 4) * tempo;
      u.model?.play?.('burrow', { dur: 1.2 }); g.burrowed = true;
      g.g.fx?.burst?.({ pos: { x, y: 0.5, z }, kind: 'sand', count: 30, speed: 5 });
      m.after(1.1, () => {
        if (u.dead) return;
        u.untargetable = true; u.data.hover = -4;
        const tx = me.pos.x, tz = me.pos.z;
        this.pending = m.hazard({ shape: 'circle', x: tx, z: tz, r: 5, dur: 1.6 * tempo, color: 'orange', pct: 0.18, knock: 'up', src: u, onBlast: () => {
          u.pos.x = tx; u.pos.z = tz; u.untargetable = false; u.data.hover = 0; g.burrowed = false;
          u.model?.stop?.(); u.model?.play?.('spawn', { dur: 1.2 });
          g.g.fx?.burst?.({ pos: { x: tx, y: 0.5, z: tz }, kind: 'sand', count: 40, speed: 8 }); g.g.fx?.burst?.({ pos: { x: tx, y: 0.5, z: tz }, kind: 'water', count: 20, speed: 6, up: 0.8 });
          g.g.cam.shake(0.45); g.sfx('ground_crack', { x: tx, y: 0, z: tz }, 1.2);
        } });
      });
    }
  }
}
GIMMICKS.bell = class Bell extends Gimmick {
  enter() {
    this.rings = 0; this.ringCd = 0; this.bossU = null; this.away = 0;
    const b = this.m.anchor('bellpull'); this.mk = this.m.marker('The Drowned Bell’s Rope', b.x, b.z - 2, 3.2, 'Ring three times…');
  }
  update(dt) {
    this.ringCd -= dt;
    const u = this.bossU, me = this.me;
    if (u && this.state === 'fight') {
      if (u.dead) return this.victory();
      const ar = this.m.anchor('arena');
      this.away = me && !me.dead && Math.hypot(me.pos.x - ar.x, me.pos.z - ar.z) < 45 ? 0 : this.away + dt;
      if (this.away > 8) this.retreat();
    }
  }
  interactable() { if (this.state === 'idle' && this.near('bellpull', 2.6)) return obj('bell', `Ring the drowned bell (${this.rings}/3)`); return null; }
  interact(t) {
    if (t.isle !== 'bell') return false;
    if (this.ringCd > 0) return true;
    this.ringCd = 2.2; this.rings++;
    const tw = this.spot('tower'), bp = this.m.anchor('bellpull');
    this.me.faceTo(bp.x, bp.z - 3); this.me.model?.play?.('pull', { dur: 1 });
    this.sfx('bell', { x: tw[0], y: 15, z: tw[2] }, 1.6);
    this.g.fx?.shockwave?.({ pos: { x: tw[0], y: 0.3, z: tw[2] }, radius: 18 + this.rings * 6, color: 0x6ad0a0, dur: 1.4, dust: false });
    this.g.cam.shake(0.12 * this.rings);
    const pool = this.m.anchor('pool');
    this.g.fx?.burst?.({ pos: { x: pool.x, y: 0.2, z: pool.z }, kind: 'water', count: 12 * this.rings, speed: 3 + this.rings, up: 0.8 });
    if (this.rings >= 3) { this.state = 'rising'; this.banner('Something stirs in the deep…', 'The sea answers the bell.', 'warn', 2.6); this.m.after(3, () => this.surface()); }
    else this.say(this.rings === 1 ? 'The bell tolls across the shoal. The water trembles.' : 'Bubbles boil up from the pool beneath the tower…', 'info');
    return true;
  }
  surface() {
    const m = this.m, pool = m.anchor('pool'), ar = m.anchor('arena');
    const tpl = { name: 'The Bellwarden', model: 'crab', creature: 'crab', radius: 3.2, height: 4.5, hp: 1600, atk: 0.04, speed: 3.6, mass: 99, superArmor: 2 };
    const u = m.mob(tpl, pool.x, pool.z + 2, { name: 'The Bellwarden', boss: true, variant: 'barnaclaw', modelScale: 5, ai: uu => new BellwardenAI(uu, this) });
    u.data.title = 'Keeper of the Drowned Chapel'; u.data.hover = -5; u.data.noAutoFace = false; u.turnRate = 3;
    u.data.stagger = { v: 100, max: 100, broken: false, onBreak: () => { this.ai.stun(4.5); this.m.after(4.8, () => { u.data.stagger.v = u.data.stagger.max; u.data.stagger.broken = false; }); } };
    u.faceTo(ar.x, ar.z);
    this.bossU = u; this.ai = u.ctrl; this.state = 'fight'; this.intro = true; this.away = 0;
    // the drowned bell rides its back
    const sock = u.model?.sockets?.back;
    if (sock) { const bm = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [1.1, 0.04], [1.3, 0.25], [1.2, 0.6], [0.95, 1.4], [0.75, 2.1], [0.6, 2.4], [0.1, 2.5]].map(([r, h]) => new THREE.Vector2(r * 0.09, h * 0.09)), 18), new THREE.MeshLambertMaterial({ color: 0x5a8a6a, emissive: 0x0a1a10 })); bm.castShadow = true; bm.rotation.x = -0.25; bm.position.y = 0.02; sock.add(bm); }
    this.s.ui?.banner?.('The Bellwarden', { kind: 'boss', title: 'Keeper of the Drowned Chapel', dur: 3.5 });
    this.g.audio?.stinger?.('boss_intro'); this.g.audio?.music?.('boss');
    this.g.cam.shake(0.5);
    // rise out of the pool… then leap into the arena
    const rise = { t: 0 };
    const leapTo = { x: ar.x, z: ar.z - 3 };
    this.g.fx?.burst?.({ pos: { x: pool.x, y: 0.5, z: pool.z }, kind: 'water', count: 60, speed: 9, up: 0.9, size: 0.8 });
    this.sfx('wave_splash', { x: pool.x, y: 0, z: pool.z }, 1.5);
    const gy = m.y(u.pos.x, u.pos.z), surf = -gy - 0.8;            // hover that puts it at the waterline
    u.data.hover = surf - 5;
    const tm = this.L.every(0.016, () => {
      rise.t += 0.016;
      if (u.dead || this.state !== 'fight') { this.L.cancelTimer(tm); return; }
      if (rise.t < 1.2) { u.data.hover = surf - 5 + 5 * (rise.t / 1.2); return; }
      if (rise.t < 1.9) { if (!rise.roar) { rise.roar = true; u.model?.play?.('roar', { dur: 1.2 }); this.sfx('boss_roar', u.pos, 1); } return; }
      const k = Math.min(1, (rise.t - 1.9) / 1.1);
      if (!rise.from) rise.from = { x: u.pos.x, z: u.pos.z, y: u.pos.y };
      u.pos.x = rise.from.x + (leapTo.x - rise.from.x) * k; u.pos.z = rise.from.z + (leapTo.z - rise.from.z) * k;
      const ground = m.y(u.pos.x, u.pos.z);
      u.data.hover = (rise.from.y - ground) * (1 - k) + Math.sin(k * Math.PI) * 9;
      if (k >= 1) {
        this.L.cancelTimer(tm); u.data.hover = 0; this.intro = false;
        this.g.fx?.play?.('ground_slam', { pos: { x: leapTo.x, y: 0.3, z: leapTo.z }, x: leapTo.x, z: leapTo.z, r: 7 }); this.g.cam.shake(0.7); this.sfx('stomp', { x: leapTo.x, y: 0, z: leapTo.z }, 1.5);
        const me = this.me;
        if (me && !me.dead && me.invuln <= 0 && Math.hypot(me.pos.x - leapTo.x, me.pos.z - leapTo.z) < 7.5) { dealDamage(this.L, u, me, 0, { fixed: Math.round(me.hpMax * 0.15) }); applyKnock(this.L, u, me, 'down', 4, leapTo.x, leapTo.z, 1.2); }
      }
    });
    this.m.hazard({ shape: 'circle', x: leapTo.x, z: leapTo.z, r: 7, dur: 3, color: 'orange', pct: 0, src: u });
  }
  retreat() {
    const u = this.bossU;
    this.state = 'idle'; this.rings = 0; this.bossU = null;
    if (u && this.L.byId.has(u.id)) { this.g.fx?.burst?.({ pos: { x: u.pos.x, y: 0.5, z: u.pos.z }, kind: 'water', count: 40, speed: 6, up: 0.8 }); this.L.remove(u); }
    this.m.units = this.m.units.filter(x => x !== u);
    this.say('The Bellwarden sinks back into the deep. Ring the bell to call it again.', 'info');
    this.g.audio?.music?.(this.m.I.music || 'sea');
  }
  victory() {
    this.state = 'won';
    this.banner('The Bellwarden sinks', 'The drowned bell rings once, softly, by itself.', 'clear', 3.5);
    this.g.audio?.music?.(this.m.I.music || 'sea');
    this.m.after(1.2, () => this.sfx('bell', this.me?.pos, 1.2));
    this.A.give('silver', 25000); this.A.give('gold', 60);
    this.s.ui?.hud?.loot?.({ name: 'Silver', grade: 1, count: 25000, icon: 'currency:silver', kind: 'currency' });
    this.s.ui?.hud?.loot?.({ name: 'Gold', grade: 3, count: 60, icon: 'currency:gold', kind: 'currency' });
    const have = (this.A.roster.collect.bounties || []).includes('bounty:6');
    if (!have || Math.random() < 0.25) { collect(this.s, 'bounties', 'bounty:6', 'Barnacled Crown'); this.say('Something glitters in the sand where it fell: the Barnacled Crown! (Sea Bounty)', 'success'); this.s.ui?.hud?.loot?.({ name: 'Barnacled Crown', grade: 4, count: 1, icon: 'item:sea_bounty', kind: 'collectible' }); }
    trackTask(this.s, 'kill', { mob: 'bellwarden', family: 'beast', boss: true, zone: 'isle_drownbell' });
    this.m.after(2, () => { if (!this.m.hasSoul()) this.m.claimSoul(); this.rings = 0; this.state = 'idle'; this.bossU = null; });
  }
  boss() { const u = this.bossU; return u && !u.dead && this.state === 'fight' ? { name: u.name, title: u.data.title, hp: u.hp, hpMax: u.hpMax, barHp: u.hpMax / 30, stagger: { v: u.data.stagger.v, max: u.data.stagger.max }, destruction: null, enrageLeft: null, counter: (u.data.counterWindow || 0) > 0, buffs: [], showHp: true, groggy: !!u.data.groggy, enraged: u.hp / u.hpMax < 0.35 } : null; }
  progress() { if (this.state === 'idle' && !this.m.hasSoul()) return { label: `The drowned bell · rung ${this.rings}/3`, pct: this.rings / 3 * 100 }; return null; }
  line(id) { if (id !== 'bellfisher') return null; if (this.state === 'won' || this.m.hasSoul()) return 'You beat it! I’ll be telling that one for years. Badly, but for years.'; return null; }
  win() { const u = this.bossU; if (u && !u.dead) { u.hp = 1; dealDamage(this.L, this.me, u, 0, { fixed: 10 }); } else if (!this.m.hasSoul()) this.m.claimSoul(); }
};

// ------------------------------------------------------------------------------------------------ launching & registration
async function launchIsland(session, c = {}) {
  const I = ISLAND_BY_ID[c.island] || ISLANDS[0];
  if (I.night && !isNight() && !c.force) { session.ui?.toast?.('The Moonveil mist will not part until nightfall. (Check the sea clock — night falls every 40 minutes.)', 'warn'); return; }
  await session.loadZone(I.zone, { kind: 'island', region: SEA_NAME });
  const a = session.game.zone.anchors.spawn || { x: 0, z: 40, facing: 0 };
  session.spawnMe({ x: a.x, z: a.z, facing: a.facing });
  const mode = new IslandMode(session, I, c);
  session.game.mode = session.hub = mode; mode.enter();
  session.inWorld();
  seaState(session.account).last = I.id; session.account.save();
}
registerContent('island', launchIsland);
registerZoneMode('island', (session, zone) => { const I = ISLAND_BY_ZONE[zone?.id]; return I ? new IslandMode(session, I, {}) : null; });
registerPlugin({
  id: 'islands',
  init(session) { this.s = session; },
  hud(h) {
    const m = this.s.game.mode; if (!(m instanceof IslandMode)) return;
    const c = m.gimmick?.cast?.(); if (c) h.cast = c;
    const I = m.I, A = this.s.account, souls = A.roster.collect.souls || [], seeds = A.roster.collect.seeds || [], vistas = A.roster.collect.vistas || [];
    h.quests = [{ id: 'isle:' + I.id, title: I.name, kind: 'guide', steps: [
      { text: `Island Soul: ${I.soul.name}`, n: souls.includes(I.soul.id) ? 1 : 0, need: 1, done: souls.includes(I.soul.id) },
      { text: 'Pip Seeds hidden here', n: I.seeds.filter(s => seeds.includes(s)).length, need: I.seeds.length, done: I.seeds.every(s => seeds.includes(s)) },
      { text: 'Vista', n: vistas.includes(I.vista) ? 1 : 0, need: 1, done: vistas.includes(I.vista) },
    ] }, ...(h.quests || [])];
  },
});
