// The eight islands of the Glass Sea. Docking launches content 'island' (session.launch({ kind: 'island', island })):
// the island zone loads, its residents take their posts, Pip Seeds hide in plain sight, a vista waits to be taken in,
// the Dawnrunner is moored at the pier (G: set sail), and each island runs its own gimmick for its Island Soul:
//   coinflip   the Gilded Gull casino — the Sunwheel slots and Barnacle Bones' dice for Gilded Chips (50 → the Soul)
//   songstone  five stone Cantors hum songs; answer each with the same song (Songs key or at the statue)
//   powderkeg  man the bastion's guns against three waves of Blackgull longboats and brigs; keep the magazine intact
//   moonveil   (night only) follow the drowned wisps and light the lanterns in their order, three rounds
//   stormcrown climb the spiral ledge through lightning telegraphs and ring the Crown Bell
//   hushwater  dive for pearls at the bubbling beds, bring Coralie three pearls and sing her the Serenade of Tides
//   shellback  feed Grandmother Shellback six bundles of seaweed — dash through her snores
//   drownbell  ring the drowned bell three times and fight the Bellwarden when it surfaces
// Debug: window.__session.isle = { mode, soul(), win(), gimmick }.
import * as THREE from 'three';
import { registerContent, registerZoneMode, registerPlugin } from '../registry.js';
import { Unit } from '../unit.js';
import { dealDamage, applyKnock, inShape, applyStatus } from '../combat.js';
import { MobAI, refFor } from '../ai/mob.js';
import { PROVIDERS } from '../visuals.js';
import { G } from '../../engine/materials.js';
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
import { makeFloater } from '../../world/sea/flotsam.js';
import { seaIcon } from '../../world/sea/icons.js';
import { ISLANDS, ISLAND_BY_ID, ISLAND_BY_ZONE, SEA_NAME, SEA_BOUNTIES, seaHour, nightAmount, isNight } from '../../data/islands.js';
import { collect, trackTask, seaState, lerpEnv } from './sailing.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const SONG_NAMES = { homeward: 'Hymn of Homeward', tides: 'Serenade of Tides', rest: 'Lullaby of Rest', valor: 'Ballad of Valor', sunrise: 'Song of Sunrise' };
const _v = new THREE.Vector3();

// ------------------------------------------------------------------------------------------------ the mode
export class IslandMode {
  constructor(session, I, o = {}) {
    this.s = session; this.game = session.game; this.I = I; this.kind = 'island'; this.o = o;
    this.npcs = []; this.seeds = []; this.objs = []; this.units = []; this.timers = [];
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
    // residents
    for (const n of I.npcs) this.addNpc(n);
    // Pip Seeds that are still hidden here
    I.seeds.forEach((id, i) => {
      if ((this.A.roster.collect.seeds || []).includes(id)) return;
      const a = this.anchor('seed:' + (i + 1)); if (!a) return;
      const m = createCreature('pip_seed', { variant: pick(['gold', 'jade', 'rose']) });
      const y = a.y ?? this.y(a.x, a.z);
      m.root.position.set(a.x, y + 0.15, a.z); g.scene.add(m.root);
      this.seeds.push({ id, m, x: a.x, z: a.z, y });
    });
    // gimmick
    const Gk = GIMMICKS[I.gimmick];
    this.gimmick = Gk ? new Gk(this) : null;
    try { this.gimmick?.enter?.(); } catch (e) { console.error('[island gimmick]', I.id, e); }
    // ambient life
    this.ambient();
    // env, music, banner
    this.envT = 0; this.applyIsleEnv(true);
    const env = z.env;
    g.audio?.music?.(env.night > 0.6 && !I.night ? (env.music || 'city_night') : I.music || env.music || 'sea'); g.audio?.ambience?.(I.ambience || 'sea');
    s.ui?.banner?.(I.name, { kind: 'zone', sub: I.title, dur: 3.2 });
    if (!this.sea.visited.includes(I.id)) { this.sea.visited.push(I.id); s.ui?.toast?.(I.blurb, 'info'); }
    s.isle = { mode: this, gimmick: this.gimmick, soul: () => this.claimSoul(), win: () => this.gimmick?.win?.() };
    s.bus.emit('zone', { id: z.id, kind: 'island' });
  }
  exit() {
    try { this.gimmick?.exit?.(); } catch (e) { console.error('[island gimmick exit]', e); }
    for (const sd of this.seeds) { sd.m.root.removeFromParent(); sd.m.dispose?.(); }
    for (const o of this.objs) { o.removeFromParent?.(); o.dispose?.(); }
    for (const c of this.critters || []) { c.m.root.removeFromParent(); c.m.dispose?.(); }
    this.seeds = []; this.objs = [];
    if (this.s.isle?.mode === this) this.s.isle = null;
    G.uDesat.value = 0;
  }
  addNpc(n, over = {}) {
    const a = this.anchor(n.anchor); if (!a) return null;
    const u = new Unit({ kind: 'npc', team: 2, name: n.name, x: a.x, z: a.z, facing: a.facing ?? Math.PI, radius: 0.5, height: 1.85, stats: { hpMax: 1, speed: 2 } });
    u.data.npc = n.npc || null; u.data.look = n.npc ? {} : null; u.data.sex = n.sex || 'm'; u.data.title = n.title; u.data.npcDef = { ...n, action: 'island' }; u.data.immovable = true;
    if (n.creature) { u.type = n.creature; u.data.look = null; u.data.tpl = { model: n.creature }; u.data.variant = n.variant; u.height = 0.7; }
    u.untargetable = true;
    Object.assign(u.data, over);
    this.L.add(u); this.npcs.push(u);
    return u;
  }
  /** walkable-agnostic world object (a Group) that lives as long as the mode */
  keep(o) { this.game.scene.add(o); this.objs.push(o); return o; }
  ambient() {
    const g = this.game, z = this.zone, R = (z.bounds?.x1 || 60);
    this.critters = [];
    const add = (type, variant, x, y, z2, o = {}) => { const m = createCreature(type, { variant }); if (!m) return; m.root.position.set(x, y, z2); g.scene.add(m.root); this.critters.push({ m, type, cx: x, cz: z2, y, t: rnd(0, 10), r: o.r ?? rnd(6, 14), sp: o.sp ?? rnd(0.3, 0.6), h: o.h ?? rnd(6, 12), fly: o.fly ?? true }); };
    const n = this.I.night ? 0 : 4;
    for (let i = 0; i < n; i++) add('seagull', pick(['herring', 'blackback', 'hooded']), rnd(-R * 0.6, R * 0.6), 8, rnd(-R * 0.6, R * 0.6), { r: rnd(10, 22), h: rnd(9, 15) });
    if (!this.I.night && this.I.id !== 'stormcrown') for (let i = 0; i < 5; i++) add('butterfly', pick(['monarch', 'azure', 'sulphur', 'rose']), rnd(-30, 30), 2, rnd(-30, 30), { r: rnd(2, 5), h: rnd(1.2, 2.6), sp: rnd(0.4, 0.9) });
  }
  updateAmbient(dt) {
    for (const c of this.critters || []) {
      c.t += dt * c.sp;
      const x = c.cx + Math.cos(c.t) * c.r, z = c.cz + Math.sin(c.t * (c.type === 'butterfly' ? 1.7 : 1)) * c.r;
      const gy = this.y(x, z);
      c.m.root.position.set(x, Math.max(gy, 0) + c.h + Math.sin(c.t * 3) * 0.3, z);
      c.m.root.rotation.y = Math.atan2(Math.sin(c.t) * c.r, -Math.cos(c.t) * c.r);
      c.m.update?.(dt, { speed: c.r * c.sp, turn: c.sp, fly: true });
    }
  }
  applyIsleEnv(force = false) {
    this.envT = 2;
    const z = this.zone, E = z.envs; if (!E) return;
    const h = seaHour(), nt = this.I.night ? Math.max(0.75, nightAmount(h)) : nightAmount(h);
    const dusk = clamp(1 - Math.abs(nt - 0.5) * 2.2, 0, 1) * (h > 12 ? 1 : 0.6);
    let env = lerpEnv(E.day, E.night, nt);
    if (dusk > 0.02 && E.dusk) env = lerpEnv(env, E.dusk, dusk * 0.8);
    if (this.gimmick?.envMix) env = this.gimmick.envMix(env);
    const key = nt.toFixed(2) + (this.gimmick?.envKey || '');
    if (!force && key === this.envKey) return;
    this.envKey = key; z.env = env; this.game.applyEnv(env); z.setEnv?.('__none');
  }
  update(dt) {
    this.envT -= dt; if (this.envT <= 0) this.applyIsleEnv();
    for (const sd of this.seeds) { sd.m.update?.(dt, {}); }
    this.updateAmbient(dt);
    try { this.gimmick?.update?.(dt); } catch (e) { if (!this.gErr) { this.gErr = true; console.error('[island gimmick update]', e); } }
  }
  // ---------------------------------------------------------------- interaction
  interactable() {
    const me = this.me; if (!me) return null;
    const gi = this.gimmick?.interactable?.(); if (gi) return gi;
    let best = null, bd = 3.2;
    for (const u of this.npcs) { if (u.dead || !this.L.byId.has(u.id)) continue; const d = me.distTo(u) - (u.data.reach || 0); if (d < bd) { bd = d; best = u; } }
    for (const sd of this.seeds) { const d = Math.hypot(sd.x - me.pos.x, sd.z - me.pos.z); if (d < 2.6 && d < bd) { bd = d; best = { portal: 'seed', name: 'Pip Seed', seed: sd }; } }
    const v = this.anchor('vista'); if (v) { const d = Math.hypot(v.x - me.pos.x, v.z - me.pos.z) - (v.y != null ? Math.abs((v.y) - me.pos.y) : 0); if (d < 3 && d < bd) { bd = d; best = { portal: 'vista', name: 'Take in the view' }; } }
    const dk = this.anchor('dock:ship'); if (dk) { const d = Math.hypot(dk.x - me.pos.x, dk.z - me.pos.z); if (d < 3.4 && d < bd) { bd = d; best = { portal: 'dock', name: 'Set sail on the Dawnrunner' }; } }
    return best;
  }
  interact(t) {
    if (!t) return false;
    if (this.gimmick?.interact?.(t)) return true;
    if (t.portal === 'seed') { this.takeSeed(t.seed); return true; }
    if (t.portal === 'vista') { this.vista(); return true; }
    if (t.portal === 'dock') { this.s.launch({ kind: 'sail', from: this.I.id }); return true; }
    if (t.data?.npcDef) { this.talk(t); return true; }
    return false;
  }
  async talk(u) {
    const n = u.data.npcDef, s = this.s, me = this.me;
    me.faceTo(u.pos.x, u.pos.z); if (!n.creature) u.faceTo(me.pos.x, me.pos.z);
    s.bus.emit('talk', { npc: n.id, unit: u });
    u.model?.play?.(n.creature ? 'wave' : 'wave', { dur: 1.4 });
    if (n.creature) this.game.audio?.sfx?.('pip_squeak', { pos: u.pos });
    const choices = [...(this.gimmick?.choices?.(n.id) || [])];
    choices.push({ id: 'bye', text: 'Farewell.', kind: 'leave' });
    const line = this.gimmick?.line?.(n.id) || pick(n.lines || ['…']);
    const pickId = await s.ui.dialog({ id: n.id, name: n.name, title: n.title }, [{ text: line, choices }]);
    if (pickId && pickId !== 'bye') await this.gimmick?.choose?.(n.id, pickId, u);
  }
  takeSeed(sd) {
    const s = this.s;
    this.seeds = this.seeds.filter(x => x !== sd);
    sd.m.play?.('collect');
    this.game.fx?.pickup?.({ pos: { x: sd.x, y: sd.y + 0.5, z: sd.z }, kind: 'seed', to: this.me.model?.root });
    this.game.audio?.sfx?.('pip_cheer', { pos: this.me.pos });
    const r = collect(s, 'seeds', sd.id, 'Pip Seed');
    const have = (this.A.roster.collect.seeds || []).length;
    s.ui?.toast?.(`Pip Seed found! (${have} collected)`, 'success');
    s.ui?.hud?.loot?.({ name: 'Pip Seed', grade: 3, count: 1, icon: 'item:pip_seed', kind: 'collectible' });
    setTimeout(() => { sd.m.root.removeFromParent(); sd.m.dispose?.(); }, 1000);
    return r;
  }
  vista() {
    const s = this.s, g = this.game, v = this.anchor('vista'), I = this.I;
    const y = (v.y ?? this.y(v.x, v.z));
    const fx = -Math.sin(v.facing || 0), fz = -Math.cos(v.facing || 0);
    g.cam.cinematic({ pos: [v.x - fx * 6, y + 12, v.z - fz * 6 + 14], look: [v.x + fx * 30, y, v.z + fz * 30], dur: 2.4, fov: 44 });
    g.renderer.fx && (g.renderer.fx.letterbox = 1);
    const first = !(this.A.roster.collect.vistas || []).includes(I.vista);
    collect(s, 'vistas', I.vista, `Vista: ${I.name}`);
    s.ui?.banner?.(first ? 'Vista discovered' : I.name, { kind: 'success', sub: I.title, dur: 3 });
    this.me.model?.play?.('think', { dur: 3 });
    setTimeout(() => { g.cam.endCinematic(1.2); if (g.renderer.fx) g.renderer.fx.letterbox = 0; }, 4200);
  }
  /** the island's Soul (once per roster) + rewards */
  claimSoul() {
    const s = this.s, A = this.A, I = this.I;
    const had = (A.roster.collect.souls || []).includes(I.soul.id);
    if (had) { s.ui?.toast?.(`You already carry the ${I.soul.name}.`, 'info'); return false; }
    collect(s, 'souls', I.soul.id, I.soul.name);
    A.give('silver', 20000); A.give('tokens', 5); A.give('pirate', 10);
    s.ui?.banner?.('Island Soul', { kind: 'success', sub: `${I.soul.name} — ${I.soul.desc}`, dur: 4 });
    s.ui?.hud?.loot?.({ name: I.soul.name, grade: 4, count: 1, icon: 'item:island_soul', kind: 'collectible' });
    s.ui?.hud?.loot?.({ name: 'Silver', grade: 1, count: 20000, icon: 'currency:silver', kind: 'currency' });
    this.game.audio?.stinger?.('achievement'); this.game.audio?.sfx?.('loot_legendary', { pos: this.me?.pos });
    this.game.fx?.lootBeam?.({ pos: this.me.pos, grade: 4, dur: 4 });
    trackTask(s, 'clear', { content: 'island', id: I.id });
    s.bus.emit('clear', { content: { kind: 'island', island: I.id }, result: { cleared: true } });
    A.save();
    return true;
  }
  hasSoul() { return (this.A.roster.collect.souls || []).includes(this.I.soul.id); }
  // ---------------------------------------------------------------- shared helpers for gimmicks
  after(t, fn) { return this.L.after(t, () => { if (this.game.mode === this) fn(); }); }
  /** telegraph that hurts the hero (and knocks it down) when it detonates. o: { shape, x, z, r, inner, dx, dz, len, width, angle, dur, color, pct, knock } */
  hazard(o) {
    const L = this.L, me = this.me;
    L.telegraph({ ...o, owner: null });
    this.after(o.dur, () => {
      const h = { shape: o.shape === 'line' ? 'rect' : o.shape, r: o.r, inner: o.inner, angle: o.angle, len: o.len, width: o.width };
      o.onBlast?.(o);
      if (!me || me.dead || me.invuln > 0) return;
      if (inShape(h, o.x, o.z, o.dx ?? 0, o.dz ?? -1, me)) {
        dealDamage(L, null, me, 0, { fixed: Math.round(me.hpMax * (o.pct ?? 0.12)) });
        if (o.knock) applyKnock(L, null, me, o.knock, o.kb ?? 3, o.x, o.z, 1.1);
        o.onHit?.();
      }
    });
  }
  /** a mob unit from a custom template (MobAI), with a pre-made model (hero outfit or creature) */
  mob(tpl, x, z, o = {}) {
    const ref = refFor(Math.max(1100, this.me?.st?.ilvl || 1340));
    const u = new Unit({ kind: o.boss ? 'boss' : 'mob', team: 1, type: tpl.model, name: o.name || tpl.name, level: 60, x, z, facing: o.facing ?? 0, radius: tpl.radius * (o.scale || 1), height: tpl.height * (o.scale || 1), mass: tpl.mass || 1,
      stats: { hpMax: Math.round(tpl.hp * ref.ap * (o.hpMul || 1)), atk: tpl.atk * ref.hp / 0.55 * (o.atkMul || 1), def: 3000, speed: tpl.speed, mpMax: 0, mpRegen: 0, crit: 0.05 }, superArmor: tpl.superArmor || 0 });
    u.data.elite = !!o.elite; u.data.tpl = tpl; u.data.scale = o.scale || 1; u.data.xp = 10;
    if (tpl.hero) u.model = PROVIDERS.hero?.({ cls: null, sex: o.sex || 'm', look: {}, npc: tpl.hero, lod: 'crowd' }) || null;
    else if (tpl.creature) u.model = createCreature(tpl.creature, { variant: o.variant, scale: o.scale || 1, elite: o.elite });
    if (u.model && o.scale && tpl.hero) u.model.root.scale.setScalar(o.scale);
    u.ctrl = o.ai ? o.ai(u) : new MobAI(u, tpl, { aggro: o.aggro ?? 40, alert: o.alert ?? true });
    this.L.add(u); this.units.push(u);
    return u;
  }
  playSong(id) {
    const g = this.game, me = this.me, s = this.s;
    const secs = g.audio?.song?.(id, { pos: me.pos }) || 8;
    me.model?.play?.('play_instrument', { loop: true, dur: 2 });
    g.fx?.play?.('song_notes', { pos: me.pos, x: me.pos.x, z: me.pos.z, dur: secs, unit: me.model?.root });
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
  constructor(m) { this.m = m; }
  get s() { return this.m.s; } get g() { return this.m.game; } get L() { return this.m.L; } get me() { return this.m.me; } get A() { return this.m.A; }
  near(name, r = 3) { const a = this.m.anchor(name), me = this.me; return a && me && Math.hypot(a.x - me.pos.x, a.z - me.pos.z) < r ? a : null; }
  say(t, k = 'info') { this.s.ui?.toast?.(t, k); }
  banner(t, sub, kind = 'info') { this.s.ui?.banner?.(t, { kind, sub, dur: 2.8 }); }
  sfx(n, pos, vol = 1) { try { this.g.audio?.sfx?.(n, { pos: pos || this.me?.pos, vol }); } catch (e) { /* locked */ } }
}
const GIMMICKS = {};

// ------------------------------------------------------------------------------------------------ Coinflip: the casino
const SYMBOLS = ['sun', 'gull', 'pearl', 'anchor', 'skull', 'pip'];
function reelTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128 * SYMBOLS.length;
  const x = cv.getContext('2d');
  SYMBOLS.forEach((s, i) => {
    const y0 = i * 128;
    const g = x.createLinearGradient(0, y0, 0, y0 + 128); g.addColorStop(0, '#f6ecd6'); g.addColorStop(1, '#d8c8a8'); x.fillStyle = g; x.fillRect(0, y0, 128, 128);
    x.strokeStyle = '#8a6a3a'; x.lineWidth = 4; x.strokeRect(2, y0 + 2, 124, 124);
    x.save(); x.translate(64, y0 + 64);
    if (s === 'sun') { x.fillStyle = '#f0a020'; for (let k = 0; k < 12; k++) { x.rotate(TAU / 12); x.beginPath(); x.moveTo(0, -48); x.lineTo(8, -26); x.lineTo(-8, -26); x.fill(); } x.fillStyle = '#ffd040'; x.beginPath(); x.arc(0, 0, 26, 0, TAU); x.fill(); }
    if (s === 'gull') { x.strokeStyle = '#3a4a5a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(-44, -6); x.quadraticCurveTo(-20, -30, 0, 4); x.quadraticCurveTo(20, -30, 44, -6); x.stroke(); }
    if (s === 'pearl') { const r = x.createRadialGradient(-10, -12, 4, 0, 0, 34); r.addColorStop(0, '#ffffff'); r.addColorStop(1, '#b8b0c8'); x.fillStyle = r; x.beginPath(); x.arc(0, 0, 32, 0, TAU); x.fill(); }
    if (s === 'anchor') { x.strokeStyle = '#2a3a5a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -40); x.lineTo(0, 36); x.moveTo(-22, -24); x.lineTo(22, -24); x.moveTo(-36, 10); x.quadraticCurveTo(-30, 38, 0, 38); x.quadraticCurveTo(30, 38, 36, 10); x.stroke(); x.beginPath(); x.arc(0, -46, 8, 0, TAU); x.stroke(); }
    if (s === 'skull') { x.fillStyle = '#2a2420'; x.beginPath(); x.arc(0, -8, 30, 0, TAU); x.fill(); x.fillRect(-18, 10, 36, 22); x.fillStyle = '#f6ecd6'; x.beginPath(); x.arc(-11, -8, 8, 0, TAU); x.arc(11, -8, 8, 0, TAU); x.fill(); x.fillRect(-12, 16, 4, 14); x.fillRect(-2, 16, 4, 14); x.fillRect(8, 16, 4, 14); }
    if (s === 'pip') { x.fillStyle = '#7ac050'; x.beginPath(); x.arc(0, 8, 28, 0, TAU); x.fill(); x.fillStyle = '#4a9a30'; x.beginPath(); x.ellipse(-10, -30, 14, 7, -0.6, 0, TAU); x.ellipse(10, -30, 14, 7, 0.6, 0, TAU); x.fill(); x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(-10, 6, 5, 0, TAU); x.arc(10, 6, 5, 0, TAU); x.fill(); }
    x.restore();
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}
function diceTexture() {
  const cv = document.createElement('canvas'); cv.width = 64 * 6; cv.height = 64;
  const x = cv.getContext('2d');
  const P = { 1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[16, 16], [32, 32], [48, 48]], 4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48]], 6: [[18, 14], [46, 14], [18, 32], [46, 32], [18, 50], [46, 50]] };
  for (let f = 1; f <= 6; f++) { const x0 = (f - 1) * 64; x.fillStyle = '#f4efe2'; x.fillRect(x0, 0, 64, 64); x.fillStyle = f === 1 ? '#c02a2a' : '#1a1a1a'; for (const [px, py] of P[f]) { x.beginPath(); x.arc(x0 + px, py, 6, 0, TAU); x.fill(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** a die mesh whose face N (1-6) maps to the +Y face when rotation = FACE_UP[N] */
function makeDie(tex) {
  const g = new THREE.BoxGeometry(0.34, 0.34, 0.34);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z → faces 1..6 layout: +y=1, -y=6, +x=2, -x=5, +z=3, -z=4
  const faceFor = [2, 5, 1, 6, 3, 4];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setX(k, (faceFor[f] - 1 + uv.getX(k)) / 6); }
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
}
const FACE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
GIMMICKS.casino = class Casino extends Gimmick {
  enter() {
    const m = this.m, isle = m.zone.isle, sea = m.sea;
    sea.chips ??= 0; sea.casino ||= {};
    // the Sunwheel's three reels
    const [sx, sy, sz] = isle.slotsAt;
    const tex = reelTexture();
    this.reels = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.42, 0.42, 0.62, 24, 1, true); g.rotateZ(Math.PI / 2);
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      tex.repeat.set(1, 1);
      const r = new THREE.Mesh(g, mat); r.position.set(sx - 0.75 + i * 0.75, sy + 2.3, sz + 0.62);
      m.keep(r); this.reels.push({ mesh: r, a: rnd(0, TAU), v: 0, stopAt: null, target: 0 });
    }
    this.lever = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0xc8a040 }));
    this.lever.position.set(sx + 1.75, sy + 2.6, sz); m.keep(this.lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc02a2a, emissive: 0x400808 })); knob.position.y = 0.62; this.lever.add(knob);
    // dice
    const dt = diceTexture(), [dx, dy, dz] = isle.diceAt;
    this.dice = [0, 1, 2, 3].map(i => { const d = makeDie(dt); d.position.set(dx - 0.6 + (i % 2) * 0.35 + (i > 1 ? 0.9 : 0), dy + 1.25, dz + (i > 1 ? 0.4 : -0.4)); m.keep(d); return { mesh: d, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), rot: [0, 0, 0], spin: [0, 0, 0] }; });
    this.diceAt = isle.diceAt;
    this.busy = false;
  }
  update(dt) {
    for (const r of this.reels) {
      if (r.stopAt != null) { r.stopAt -= dt; if (r.stopAt <= 0) { r.v = 0; r.stopAt = null; r.a = r.target; this.sfx('ui_click', r.mesh.position, 1); } }
      r.a += r.v * dt; r.mesh.rotation.x = r.a;
    }
    for (const d of this.dice) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt / 1.1);
      const k = d.t, e = 1 - Math.pow(1 - k, 3);
      d.mesh.position.lerpVectors(d.from, d.to, e); d.mesh.position.y += Math.sin(k * Math.PI) * 0.9 * (1 - k) + Math.abs(Math.sin(k * Math.PI * 3)) * 0.15 * (1 - k);
      const w = 1 - e;
      d.mesh.rotation.set(d.rot[0] + d.spin[0] * w, d.rot[1] + d.spin[1] * w, d.rot[2] + d.spin[2] * w);
    }
    if (this.lever.userData.t > 0) { this.lever.userData.t -= dt; this.lever.rotation.x = Math.sin(clamp(this.lever.userData.t / 0.6, 0, 1) * Math.PI) * 0.9; }
  }
  interactable() {
    if (this.near('game:slots', 2.6)) return { portal: 'slots', name: 'The Sunwheel (500 silver a pull)' };
    if (this.near('game:dice', 2.6)) return { portal: 'dice', name: 'Roll bones with Barnacle Bones' };
    return null;
  }
  interact(t) {
    if (t.portal === 'slots') { this.pull(); return true; }
    if (t.portal === 'dice') { this.diceGame(); return true; }
    return false;
  }
  line(id) {
    const c = this.m.sea.chips;
    if (id === 'brightpenny') return this.m.hasSoul() ? 'The Coin of the Cay suits you. Do come back and lose a little silver now and then — for tradition.' : `You hold ${c} Gilded Chip${c === 1 ? '' : 's'}. Fifty, darling, and the Coin of the Cay is yours.`;
    return null;
  }
  choices(id) {
    const sea = this.m.sea, out = [];
    if (id === 'brightpenny') {
      if (!sea.casino.free) out.push({ id: 'free', text: 'I’m new here. (Five chips on the house)', kind: 'quest' });
      out.push({ id: 'buy', text: 'Buy 5 Gilded Chips (3,000 silver).', kind: 'shop' });
      if (!this.m.hasSoul()) out.push({ id: 'soul', text: `Trade 50 Gilded Chips for the Coin of the Cay (${sea.chips}/50).`, kind: 'quest' });
      else out.push({ id: 'prize', text: 'Cash 10 chips for a Pip Card Pack.', kind: 'shop' });
    }
    if (id === 'bones') out.push({ id: 'dice', text: 'Roll the bones (bet 3 chips).', kind: 'quest' });
    if (id === 'croupier') out.push({ id: 'pull', text: 'Pull the Sunwheel (500 silver).', kind: 'quest' });
    return out;
  }
  async choose(id, c) {
    const sea = this.m.sea, A = this.A;
    if (c === 'free') { sea.casino.free = true; sea.chips += 5; this.say('Five Gilded Chips, with the Baroness’s compliments.', 'success'); this.sfx('coin'); }
    if (c === 'buy') { if (!A.take('silver', 3000)) { this.say('Not enough silver.', 'error'); return; } sea.chips += 5; this.sfx('coin'); this.say('+5 Gilded Chips.', 'success'); }
    if (c === 'soul') { if (sea.chips < 50) { this.say(`You need ${50 - sea.chips} more Gilded Chips.`, 'error'); return; } sea.chips -= 50; this.m.claimSoul(); }
    if (c === 'prize') { if (sea.chips < 10) { this.say('Ten chips, darling.', 'error'); return; } sea.chips -= 10; A.give('card_pack_pip', 1); this.s.ui?.hud?.loot?.({ name: 'Pip Card Pack', grade: 3, count: 1, icon: 'item:card_pack', kind: 'consumable' }); }
    if (c === 'dice') this.diceGame();
    if (c === 'pull') this.pull();
    A.save();
  }
  pull() {
    if (this.busy) return;
    const A = this.A, sea = this.m.sea;
    if (!A.take('silver', 500)) { this.say('The Sunwheel wants 500 silver.', 'error'); return; }
    this.busy = true;
    this.lever.userData.t = 0.6; this.sfx('chain');
    this.me.model?.play?.('interact', { dur: 0.8 });
    // decide the outcome, then land the reels on it
    const r = Math.random(); let res;
    if (r < 0.045) res = ['sun', 'sun', 'sun'];
    else if (r < 0.165) { const s = pick(['gull', 'pearl', 'anchor', 'pip']); res = [s, s, s]; }
    else if (r < 0.46) { const s = pick(['sun', 'gull', 'pearl', 'anchor', 'pip']); const o = pick(SYMBOLS.filter(x => x !== s && x !== 'skull')); res = Math.random() < 0.5 ? [s, s, o] : [o, s, s]; }
    else if (r < 0.56) res = [pick(['gull', 'pearl']), 'skull', pick(['anchor', 'pip'])];
    else { const a = SYMBOLS.filter(x => x !== 'skull').sort(() => Math.random() - 0.5); res = [a[0], a[1], a[2]]; }
    this.reels.forEach((rl, i) => { rl.v = 14 + i * 2; rl.stopAt = 0.9 + i * 0.5; const idx = SYMBOLS.indexOf(res[i]); rl.target = rl.a + (TAU * (3 + i)) - ((rl.a % TAU) - (-(idx + 0.5) / SYMBOLS.length * TAU)); });
    this.m.after(2.2, () => {
      this.busy = false;
      let chips = 0, text;
      if (res.every(x => x === 'sun')) { chips = 25; text = 'JACKPOT! Three suns!'; this.jackpot(); }
      else if (res[0] === res[1] && res[1] === res[2]) { chips = 8; text = `Three ${res[0]}s!`; }
      else if (res[1] === 'skull') { chips = 0; text = 'The skull grins. The house wins.'; }
      else if (res[0] === res[1] || res[1] === res[2]) { chips = res[1] === 'sun' ? 3 : 2; text = 'A pair!'; }
      else { chips = Math.random() < 0.33 ? 1 : 0; text = chips ? 'Nothing… but the Baroness tosses you a pity chip.' : 'Nothing. The wheel hums smugly.'; }
      sea.chips += chips;
      this.say(`${text} ${chips ? `+${chips} Gilded Chip${chips > 1 ? 's' : ''}.` : ''}`, chips ? 'success' : 'info');
      if (chips) { this.sfx(chips >= 8 ? 'loot_rare' : 'coin'); const p = this.m.anchor('game:slots'); this.g.fx?.burst?.({ pos: { x: p.x, y: 3, z: p.z - 2 }, kind: 'coin', count: 6 + chips, speed: 5, up: 5 }); }
      A.save();
    });
  }
  jackpot() {
    const p = this.m.anchor('game:slots');
    this.banner('JACKPOT!', 'The Sunwheel sings', 'success');
    this.g.fx?.lootBeam?.({ pos: { x: p.x, y: 0, z: p.z - 2 }, grade: 4, dur: 3 });
    this.g.fx?.burst?.({ pos: { x: p.x, y: 4, z: p.z - 2 }, kind: 'confetti', count: 60, speed: 8, up: 8 });
    this.sfx('loot_legendary');
  }
  diceGame() {
    if (this.busy) return;
    const sea = this.m.sea, A = this.A;
    if (sea.chips < 3) { if (!A.take('silver', 400)) { this.say('You need 3 chips (or 400 silver) to roll with Bones.', 'error'); return; } sea.chips += 3; this.say('Bones slides three chips across for your silver.', 'info'); }
    sea.chips -= 3; this.busy = true;
    const rolls = [0, 1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
    const [dx, dy, dz] = this.diceAt;
    this.dice.forEach((d, i) => {
      d.from.set(dx + (i < 2 ? 0.2 : -0.2), dy + 1.9, dz + (i < 2 ? 1.2 : -1.2));
      d.to.set(dx - 0.55 + (i % 2) * 0.4 + (i > 1 ? 0.75 : 0), dy + 1.24, dz + (i > 1 ? 0.35 : -0.35) + rnd(-0.1, 0.1));
      d.rot = [...FACE_UP[rolls[i]]]; d.rot[1] = rnd(0, TAU);
      d.spin = [rnd(8, 16), rnd(4, 10), rnd(8, 16)]; d.t = 0;
    });
    this.sfx('dig');
    this.me.model?.play?.('throw', { dur: 0.6 });
    this.m.after(1.3, () => {
      this.busy = false;
      const you = rolls[0] + rolls[1], bones = rolls[2] + rolls[3], dbl = rolls[0] === rolls[1];
      let win = 0, text;
      if (you > bones) { win = 6 + (dbl ? 2 : 0); text = `You roll ${you}, Bones rolls ${bones}. You win${dbl ? ' — doubles!' : '!'}`; }
      else if (you === bones) { win = 3; text = `${you} each. A push — Bones returns your chips.`; }
      else text = `You roll ${you}, Bones rolls ${bones}. “Heh heh heh.”`;
      sea.chips += win;
      this.say(`${text}${win > 3 ? ` +${win - 3} chips.` : ''}`, win > 3 ? 'success' : 'info');
      if (win > 3) this.sfx('coin');
      const b = this.m.npcs.find(u => u.data.npcDef.id === 'bones'); b?.model?.play?.(win > 3 ? 'facepalm' : 'laugh', { dur: 1.8 });
      this.A.save();
    });
  }
  progress() { if (this.m.hasSoul()) return null; const c = this.m.sea.chips; return { label: `Gilded Chips ${c} / 50`, pct: clamp(c / 50, 0, 1) * 100 }; }
  win() { this.m.sea.chips = 50; }
};

// ------------------------------------------------------------------------------------------------ Songstone: the Cantors
GIMMICKS.songs = class Songs extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.cantors ||= {};
    this.statues = CANTORS.map((c, i) => {
      const a = m.anchor('cantor:' + i), sp = m.zone.spots['cantor' + i];
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color([0xffd070, 0x6ad0ff, 0xffa0d0, 0xff7050, 0xfff0a0][i]).multiplyScalar(2), transparent: true, opacity: 0.25, toneMapped: false }));
      ring.rotation.x = Math.PI / 2; ring.position.set(sp[0], sp[1] + 3.2, sp[2]); m.keep(ring);
      return { ...c, i, a, pos: new THREE.Vector3(sp[0], sp[1] + 3, sp[2]), ring, humT: rnd(1, 4), done: !!sea.cantors[c.song] };
    });
    this.off = this.s.bus.on('song', ev => this.onSong(ev));
    this.stone = m.zone.spots.stone;
    if (this.allDone()) this.glowStone(1);
  }
  exit() { this.off?.(); }
  allDone() { return this.statues.every(s => s.done); }
  update(dt) {
    const me = this.me, t = G.uTime.value;
    for (const s of this.statues) {
      s.ring.material.opacity = s.done ? 0.85 + Math.sin(t * 2 + s.i) * 0.1 : 0.18 + (s.humming > 0 ? 0.5 : 0);
      s.ring.rotation.z += dt * (s.done ? 0.8 : 0.2);
      if (s.humming > 0) s.humming -= dt;
      if (s.done || !me) continue;
      s.humT -= dt;
      const d = me.pos.distanceTo(_v.set(s.pos.x, me.pos.y, s.pos.z));
      if (d < 9 && s.humT <= 0) this.hum(s);
    }
  }
  hum(s) {
    s.humT = 16; s.humming = 8;
    const secs = this.g.audio?.song?.(s.song, { pos: s.pos, vol: 0.9 }) || 8;
    s.humming = secs;
    for (let k = 0; k < 6; k++) this.m.after(k * 1.2, () => this.g.fx?.burst?.({ pos: { x: s.pos.x, y: s.pos.y + 1, z: s.pos.z }, kind: 'note', count: 5, speed: 2, up: 3, life: 1.6 }));
    if (!this.hinted) { this.hinted = true; this.say(`${s.name.replace(/^the /, 'The ')} hums a melody… answer it with the same song (Songs: , key, or talk to the statue).`, 'info'); }
  }
  interactable() {
    for (const s of this.statues) if (this.near('cantor:' + s.i, 3)) return { portal: 'cantor', name: s.done ? `${cap(s.name)} (answered)` : `${cap(s.name)} — answer its song`, cantor: s };
    if (this.allDone() && !this.m.hasSoul() && this.near('stone', 4.5)) return { portal: 'stone', name: 'Touch the Songstone' };
    return null;
  }
  async interact(t) {
    if (t.portal === 'stone') { this.m.claimSoul(); return true; }
    if (t.portal !== 'cantor') return false;
    const s = t.cantor;
    if (s.done) { this.say(`${cap(s.name)} hums contentedly: ${SONG_NAMES[s.song]}.`, 'info'); return true; }
    const choices = [{ id: 'listen', text: 'Listen to its melody again.', kind: 'talk' }, ...Object.entries(SONG_NAMES).map(([id, n]) => ({ id, text: `Play: ${n}`, kind: 'quest' })), { id: 'bye', text: 'Step back.', kind: 'leave' }];
    const pickId = await this.s.ui.dialog({ name: cap(s.name), title: 'A Cantor of the Songstone' }, [{ text: 'The stone face waits, lips parted, as if mid-verse.', choices }]);
    if (pickId === 'listen') { s.humT = 0; this.hum(s); }
    else if (SONG_NAMES[pickId]) this.m.playSong(pickId);
    return true;
  }
  onSong(ev) {
    const me = this.me; if (!me) return;
    let best = null, bd = 10;
    for (const s of this.statues) { if (s.done) continue; const d = Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z); if (d < bd) { bd = d; best = s; } }
    if (!best) return;
    this.m.after(6, () => {
      if (best.song === ev.id) {
        best.done = true; this.m.sea.cantors[best.song] = true; this.A.save();
        this.sfx('harp_big', best.pos); this.g.fx?.burst?.({ pos: best.pos, kind: 'holy', count: 30, speed: 4, up: 4 });
        const n = this.statues.filter(s => s.done).length;
        this.banner(`${cap(best.name)} answers`, `${SONG_NAMES[best.song]} · ${n}/5`, 'success');
        if (!(this.A.roster.songs || []).includes(best.song)) { (this.A.roster.songs ||= []).push(best.song); this.say(`You learned ${SONG_NAMES[best.song]} (Songs key).`, 'success'); }
        if (this.allDone()) this.m.after(2.5, () => this.finale());
      } else {
        this.say(`${cap(best.name)} falls silent. That was not its song.`, 'warn');
        this.g.fx?.burst?.({ pos: best.pos, kind: 'dark', count: 14, speed: 2 });
      }
    });
  }
  glowStone(v) {
    if (this.stoneGlow) return;
    const [x, y, z] = this.stone;
    this.stoneGlow = this.m.keep(new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ad8ff).multiplyScalar(2.5 * v), transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false })));
    this.stoneGlow.position.set(x, y + 2.1, z); this.stoneGlow.scale.set(1, 1.5, 1);
  }
  finale() {
    const [x, y, z] = this.stone;
    this.glowStone(1);
    this.g.fx?.play?.('light_pillar', { pos: { x, y, z }, x, z, color: 'holy', r: 4 });
    this.g.audio?.stinger?.('quest_complete');
    this.banner('The Songstone wakes', 'Five voices, one chord.', 'success');
    for (const id of Object.keys(SONG_NAMES)) if (!(this.A.roster.songs || []).includes(id)) (this.A.roster.songs ||= []).push(id);
    this.m.after(2, () => this.m.claimSoul());
  }
  progress() { if (this.m.hasSoul()) return null; const n = this.statues.filter(s => s.done).length; return { label: `Cantors answered ${n} / 5`, pct: n / 5 * 100 }; }
  win() { for (const s of this.statues) { s.done = true; this.m.sea.cantors[s.song] = true; } this.finale(); }
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------------------------------------ Powderkeg: defend the bastion
const PIRATE = { name: 'Blackgull Cutthroat', model: 'pirate', hero: 'pirate', radius: 0.45, height: 1.85, hp: 12, atk: 0.02, speed: 4.6, aggro: 40, mass: 1,
  attacks: [{ id: 'slash', range: 1.8, cd: 1.7, windup: 0.45, dur: 0.95, anim: 'slash_h', hit: { shape: 'cone', r: 2.2, angle: 1.9, coef: 1 } }] };
const CAPTAIN = { name: 'Captain Redgull', model: 'pirate', hero: 'pirate', radius: 0.55, height: 2.2, hp: 110, atk: 0.035, speed: 4.2, aggro: 60, mass: 3, superArmor: 1,
  attacks: [{ id: 'cleave', range: 2.6, cd: 2.4, windup: 0.7, dur: 1.3, anim: 'slash_v', tele: true, hit: { shape: 'cone', r: 3.4, angle: 2.2, coef: 1.4, knock: 'push', kb: 2.5 } },
    { id: 'pistol', range: 12, minRange: 4, cd: 5, windup: 0.6, dur: 1.0, anim: 'shoot', proj: { speed: 26, range: 14, radius: 0.35, kind: 'bullet', color: 'orange', hit: { coef: 1.2 } } }] };
class RaiderAI extends MobAI {
  constructor(u, tpl, o, gim) { super(u, tpl, o); this.gim = gim; }
  update(dt, L) {
    const u = this.u, me = this.gim.me, mag = this.gim.mag;
    if (me && !me.dead && u.distTo(me) < 9) return super.update(dt, L);
    // otherwise march on the powder magazine and hack at it
    u.move.x = u.move.z = 0; if (u.disabled || u.skill) return;
    const dx = mag.x - u.pos.x, dz = mag.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.4) { this.hackT = (this.hackT || 0) - dt; u.faceTo(mag.x, mag.z); if (this.hackT <= 0) { this.hackT = 1.6; u.model?.play?.('slash_h', { dur: 0.8 }); this.gim.hitMag(u.data.elite ? 6 : 2.5); } return; }
    this.pathT = (this.pathT || 0) - dt;
    if (!this.mpath || this.pathT <= 0) { this.mpath = L.nav.path(u.pos.x, u.pos.z, mag.x, mag.z, 0.3, 8000); this.pathT = 1.2; }
    const p = this.mpath?.[0]; if (!p) return;
    const px = p.x - u.pos.x, pz = p.z - u.pos.z, pd = Math.hypot(px, pz);
    if (pd < 0.6) { this.mpath.shift(); return; }
    u.move.x = px / pd * u.st.speed; u.move.z = pz / pd * u.st.speed;
  }
}
function longboat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a3a24 }));
  hull.scale.set(1.3, 0.7, 3.4); hull.rotation.x = Math.PI; hull.position.y = 0.35; g.add(hull);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 24), new THREE.MeshLambertMaterial({ color: 0x2a1a10 })); rim.scale.set(1.3, 3.4, 1); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36; g.add(rim);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const oar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a6a44 })); oar.position.set(s * 1.6, 0.4, -1.4 + k * 1.3); oar.userData.side = s; oar.userData.k = k; g.add(oar); }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: 0x151515, side: THREE.DoubleSide })); flag.position.set(0, 1.9, 2.8); g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), new THREE.MeshLambertMaterial({ color: 0x3a2a1a })); pole.position.set(-0.4, 1.3, 2.8); g.add(pole);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
GIMMICKS.defense = class Defense extends Gimmick {
  enter() {
    const m = this.m;
    this.state = 'idle'; this.wave = 0; this.magHp = 100; this.boats = []; this.brigs = [];
    const a = m.anchor('magazine'); this.mag = { x: a.x, z: a.z - 2 };
    this.manning = null;
  }
  exit() { this.dismount(); for (const b of this.boats) b.g.removeFromParent(); for (const r of this.brigs) r.rig.dispose(); }
  line(id) { if (id === 'gunnery' && this.state === 'fight') return `Wave ${this.wave} of 3! Man a gun — they’re coming for the magazine!`; if (id === 'gunnery' && this.m.hasSoul()) return 'The Blackgulls won’t forget this cove. Neither will I.'; return null; }
  choices(id) { if (id === 'gunnery' && this.state !== 'fight') return [{ id: 'start', text: this.state === 'lost' ? 'Let’s try that again. Man the guns!' : 'Man the guns! Let them come.', kind: 'quest' }]; return []; }
  choose(id, c) { if (c === 'start') this.start(); }
  start() {
    this.state = 'fight'; this.wave = 0; this.magHp = 100; this.killed = 0;
    this.g.audio?.music?.('boss');
    this.banner('Defend Powderkeg Cove', 'Three waves of Blackgull pirates. Keep the powder magazine standing.', 'warn');
    this.m.after(3, () => this.nextWave());
  }
  nextWave() {
    if (this.state !== 'fight') return;
    this.wave++;
    this.banner(`Wave ${this.wave}`, this.wave === 3 ? 'Captain Redgull leads the charge!' : 'Longboats on the water!', 'warn');
    const n = 2 + this.wave;
    for (let i = 0; i < n; i++) this.m.after(i * 4, () => this.launchBoat(i % 2, this.wave === 3 && i === n - 1));
    if (this.wave >= 2) this.m.after(3, () => this.brig());
    this.waveLeft = n;
  }
  launchBoat(side, captain) {
    if (this.state !== 'fight') return;
    const m = this.m, from = m.anchor('sea:' + (side ? 1 : 0)), land = m.anchor('land:' + side);
    const g = longboat(); m.keep(g);
    const crew = [];
    for (let k = 0; k < 3; k++) { const p = m.game.fx ? null : null; crew.push(k); }
    const b = { g, x: from.x + rnd(-8, 8), z: from.z + rnd(-6, 6), tx: land.x, tz: land.z, side, captain, hp: 3, crew: captain ? 3 : 3 + (this.wave > 1 ? 1 : 0), t: 0 };
    b.h = Math.atan2(-(b.tx - b.x), -(b.tz - b.z));
    this.boats.push(b);
  }
  brig() {
    if (this.state !== 'fight') return;
    const rig = new ShipRig('pirate', { waves: this.m.zone.sea.waves });
    this.m.zone.root.add(rig.root);
    const r = { rig, x: -140, z: -92, h: -Math.PI / 2, hp: 8, fireT: 6 };
    rig.place(r.x, r.z, r.h);
    this.brigs.push(r);
    this.say('A Blackgull brig is running the bastion! Sink it with the guns.', 'warn');
  }
  update(dt) {
    const m = this.m, t = G.uTime.value, W = m.zone.sea.waves;
    if (this.manning) this.updateGun(dt);
    // longboats row in
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i]; b.t += dt;
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (b.sunk) { b.sinkT += dt; b.g.position.y -= dt * 0.8; b.g.rotation.z += dt * 0.4; if (b.sinkT > 3) { b.g.removeFromParent(); this.boats.splice(i, 1); } continue; }
      if (d < 3) { this.land(b); b.g.removeFromParent(); this.boats.splice(i, 1); continue; }
      const sp = 4.2; b.x += dx / d * sp * dt; b.z += dz / d * sp * dt;
      b.g.position.set(b.x, W.height(b.x, b.z, t), b.z); b.g.rotation.set(Math.sin(t * 1.4 + i) * 0.05, b.h, Math.sin(t * 1.1 + i) * 0.06);
      for (const o of b.g.children) if (o.userData.side) o.rotation.y = Math.sin(t * 5 + o.userData.k) * 0.4 * o.userData.side;
    }
    // brigs broadside the bastion
    for (let i = this.brigs.length - 1; i >= 0; i--) {
      const r = this.brigs[i];
      if (r.sunk) { r.sinkT += dt; r.rig.sink = r.sinkT * 1.1; r.rig.list = Math.min(0.4, r.sinkT * 0.1); r.rig.update(dt, t, { x: r.x, z: r.z, heading: r.h, speed: 0, turn: 0, sail: 0.2 }); if (r.sinkT > 7) { r.rig.dispose(); this.brigs.splice(i, 1); } continue; }
      r.x += 5 * dt; r.rig.update(dt, t, { x: r.x, z: r.z, heading: r.h, speed: 5, turn: 0, sail: 1 });
      r.fireT -= dt;
      if (r.fireT <= 0 && Math.abs(r.x) < 60) { r.fireT = 7; this.brigVolley(r); }
      if (r.x > 150) { r.rig.dispose(); this.brigs.splice(i, 1); }
    }
    // wave bookkeeping
    if (this.state === 'fight') {
      const alive = this.m.units.filter(u => !u.dead && this.L.byId.has(u.id));
      if (this.wave > 0 && !this.boats.length && !alive.length && this.spawned >= this.waveLeft) {
        this.spawned = 0;
        if (this.wave >= 3) this.victory(); else this.m.after(4, () => this.nextWave());
      }
    }
  }
  land(b) {
    const m = this.m;
    for (let k = 0; k < b.crew; k++) {
      const cap = b.captain && k === 0;
      const u = m.mob(cap ? CAPTAIN : PIRATE, b.tx + rnd(-2, 2), b.tz + rnd(-2, 2), { name: cap ? CAPTAIN.name : PIRATE.name, elite: cap, scale: cap ? 1.18 : 1, hpMul: 1, sex: Math.random() < 0.3 ? 'f' : 'm',
        ai: (uu) => new RaiderAI(uu, cap ? CAPTAIN : PIRATE, { aggro: 40, alert: true }, this) });
      if (cap) { this.captain = u; u.data.title = 'Scourge of the Blackgulls'; }
    }
    this.spawned = (this.spawned || 0) + 1;
    this.sfx('wave_splash', { x: b.tx, y: 0, z: b.tz });
  }
  brigVolley(r) {
    const m = this.m, L = this.L;
    const tx = rnd(-14, 14), tz = rnd(-40, -26);
    m.hazard({ shape: 'circle', x: tx, z: tz, r: 5, dur: 1.8, color: 'orange', pct: 0.1, knock: 'down', onBlast: () => { this.g.fx?.play?.('explosion', { pos: { x: tx, y: m.y(tx, tz), z: tz }, x: tx, z: tz, r: 4 }); this.sfx('explosion', { x: tx, y: 7, z: tz }); if (Math.hypot(tx - this.mag.x, tz - this.mag.z) < 6) this.hitMag(7); } });
    const p = r.rig.world(r.rig.ship.sockets.helm, new THREE.Vector3());
    r.rig.ship.fire?.('R');
    this.sfx('cannon', p);
  }
  hitMag(n) {
    if (this.state !== 'fight') return;
    this.magHp = Math.max(0, this.magHp - n);
    if (this.magHp <= 0) this.lose();
    else if (this.magHp < 40 && !this.warned) { this.warned = true; this.banner('The magazine is burning!', 'Drive them off it!', 'warn'); }
  }
  lose() {
    this.state = 'lost';
    const m = this.m, a = m.anchor('magazine');
    this.g.fx?.play?.('explosion_big', { pos: { x: a.x, y: 7.4, z: a.z - 2 }, x: a.x, z: a.z - 2, r: 8 }); this.sfx('explosion_big', { x: a.x, y: 7, z: a.z });
    this.g.cam.shake(0.8);
    this.banner('The magazine blows!', 'The Blackgulls cheer from their boats. Talk to Hettie to try again.', 'defeat');
    this.cleanup();
    this.g.audio?.music?.('sea');
  }
  victory() {
    this.state = 'won';
    this.banner('The cove holds!', 'The Blackgulls turn tail.', 'clear');
    this.g.audio?.music?.('sea');
    this.cleanup();
    this.m.after(2.5, () => { if (!this.m.hasSoul()) this.m.claimSoul(); else { this.A.give('pirate', 20); this.say('+20 Pirate Coins from Hettie’s strongbox.', 'success'); } });
  }
  cleanup() { for (const u of this.m.units) if (!u.dead && this.L.byId.has(u.id)) this.L.remove(u); this.m.units = []; for (const b of this.boats) b.g.removeFromParent(); this.boats = []; this.captain = null; this.warned = false; }
  // ---- manning a gun
  interactable() {
    if (this.manning) return { portal: 'gun-off', name: 'Leave the gun' };
    for (let i = 0; i < GUNS.length; i++) if (this.near('gun:' + i, 2.2)) return { portal: 'gun', name: 'Man the cannon', gun: i };
    return null;
  }
  interact(t) {
    if (t.portal === 'gun') { this.mount(t.gun); return true; }
    if (t.portal === 'gun-off') { this.dismount(); return true; }
    return false;
  }
  mount(i) {
    const g = this.g, me = this.me, a = this.m.anchor('gun:' + i), sp = this.m.zone.spots['gun' + i];
    me.pos.x = a.x; me.pos.z = a.z; me.data.rooted = true; me.facing = a.facing;
    this.manning = { i, pos: new THREE.Vector3(sp[0], sp[1] + 1.1, sp[2]), cd: 0 };
    this.prevInput = g.player.input.bind(g.player);
    const self = this;
    g.player.input = function (dt, inp, cam) {
      const p = cam.groundAt(inp.mouse.x, inp.mouse.y, 0); this.aim.x = p.x; this.aim.z = p.z;
      if ((inp.clicked(0) || inp.clicked(2) || inp.hit('basic')) && inp.mouse.over) self.fire(p);
    };
    g.cam.zoom = Math.max(g.cam.zoom, 24); g.cam.maxDist = 40; g.cam.zoom = 34;
    this.say('Click to fire where you aim (lead the longboats!). G leaves the gun.', 'info');
  }
  dismount() {
    if (!this.manning) return;
    const g = this.g, me = this.me;
    if (this.prevInput) g.player.input = this.prevInput;
    if (me) me.data.rooted = false;
    this.manning = null; g.cam.maxDist = 26; g.cam.zoom = 18;
  }
  updateGun(dt) { this.manning.cd -= dt; const me = this.me; if (me) { const a = this.g.player.aim; me.faceTo(a.x, a.z); } }
  fire(p) {
    const M0 = this.manning; if (M0.cd > 0) return;
    M0.cd = 1.1;
    const from = M0.pos, L = this.L, me = this.me, m = this.m;
    const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
    const dur = clamp(d / 40, 0.5, 1.8);
    this.g.fx?.burst?.({ pos: { x: from.x + dx / d * 1.6, y: from.y, z: from.z + dz / d * 1.6 }, kind: 'fire', color: 'ember', count: 10, speed: 8, size: 0.4, life: 0.25, dir: { x: dx / d, y: 0.2, z: dz / d }, spread: 0.3, flash: true });
    this.g.fx?.burst?.({ pos: { x: from.x + dx / d * 2.2, y: from.y, z: from.z + dz / d * 2.2 }, kind: 'dust', color: 0xf4f0e8, count: 8, speed: 3, size: 1.4, life: 1.6, dir: { x: dx / d, y: 0.3, z: dz / d } });
    this.sfx('cannon', from); this.g.cam.shake(0.12);
    const h = this.g.fx?.projectile?.({ from: { x: from.x, y: from.y, z: from.z }, to: { x: p.x, y: 0.4, z: p.z }, speed: d / dur, kind: 'grenade', color: 'ember', size: 0.35, arc: Math.min(8, d * 0.12), impact: false });
    m.after(dur, () => {
      h?.stop?.();
      const y = Math.max(0, m.y(p.x, p.z));
      if (y < 0.3) this.g.fx?.burst?.({ pos: { x: p.x, y: 0.2, z: p.z }, kind: 'water', count: 18, speed: 6, up: 7, size: 0.5 });
      this.g.fx?.play?.('explosion', { pos: { x: p.x, y, z: p.z }, x: p.x, z: p.z, r: 3 }); this.sfx('explosion', { x: p.x, y, z: p.z }, 0.7);
      for (const b of this.boats) if (!b.sunk && Math.hypot(b.x - p.x, b.z - p.z) < 4.5) { b.hp--; if (b.hp <= 0) { b.sunk = true; b.sinkT = 0; this.say('Longboat sunk!', 'success'); this.spawned = (this.spawned || 0) + 1; } }
      for (const r of this.brigs) if (!r.sunk && Math.abs(p.x - r.x) < 9 && Math.abs(p.z - r.z) < 5) { r.hp--; this.g.fx?.play?.('explosion', { pos: { x: p.x, y: 3, z: p.z }, x: p.x, z: p.z, r: 3 }); if (r.hp <= 0) { r.sunk = true; r.sinkT = 0; this.banner('Brig sunk!', 'The Blackgull brig goes down in flames.', 'success'); } }
      for (const u of this.m.units) if (!u.dead && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 4 + u.radius) dealDamage(L, me, u, (me.st.atk || 20000) * 6, { skill: 'cannon', kind: 'skill', stagger: 20 });
    });
  }
  progress() { if (this.state !== 'fight') return this.state === 'idle' && !this.m.hasSoul() ? { label: 'Talk to Gunner Hettie to defend the cove', pct: 0 } : null; return { label: `Wave ${this.wave}/3 · Powder magazine ${Math.round(this.magHp)}%`, pct: this.magHp }; }
  boss() { const c = this.captain; return c && !c.dead ? { name: c.name, title: c.data.title, hp: c.hp, hpMax: c.hpMax, barHp: c.hpMax / 6, stagger: null, destruction: null, enrageLeft: null, counter: false, buffs: [], showHp: true } : null; }
  win() { this.state = 'fight'; this.wave = 3; this.victory(); }
};

// ------------------------------------------------------------------------------------------------ Moonveil: the lantern ritual
const WRAITH = { name: 'Drowned Wraith', model: 'wraith', creature: 'wraith', radius: 0.5, height: 2.1, hp: 16, atk: 0.022, speed: 4.4, aggro: 40, mass: 1,
  attacks: [{ id: 'claw', range: 2, cd: 1.8, windup: 0.5, dur: 1, anim: 'attack', hit: { shape: 'cone', r: 2.4, angle: 1.8, coef: 1 } }] };
GIMMICKS.lanterns = class Lanterns extends Gimmick {
  enter() {
    const m = this.m;
    this.state = 'idle'; this.round = 0; this.seq = []; this.input = [];
    this.lamps = LANTERNS.map((L, i) => {
      const sp = m.zone.spots['lantern' + i];
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ad8ff).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0 }));
      flame.position.set(sp[0], sp[1], sp[2]); m.keep(flame);
      const light = new THREE.PointLight(0x7ad8ff, 0, 12, 1.6); light.position.copy(flame.position); m.keep(light);
      return { i, pos: flame.position.clone(), flame, light, lit: 0 };
    });
    this.wisp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfefff).multiplyScalar(3), toneMapped: false }));
    this.wisp.visible = false; m.keep(this.wisp);
    this.wispLight = new THREE.PointLight(0xbfefff, 0, 14, 1.5); m.keep(this.wispLight);
    const sh = m.zone.spots.shrine; this.shrine = new THREE.Vector3(sh[0], sh[1] + 2, sh[2]);
  }
  line(id) { if (this.m.hasSoul()) return 'The drowned rest easy now. Sometimes they hum.'; if (this.state === 'show') return 'Watch the wisp… watch the order.'; return null; }
  choices(id) { if (id === 'lanternkeeper' && (this.state === 'idle' || this.state === 'failed') && !this.m.hasSoul()) return [{ id: 'begin', text: this.round ? 'Show me again.' : 'Begin the lantern ritual.', kind: 'quest' }]; return []; }
  choose(id, c) { if (c === 'begin') { if (!this.round) this.round = 1; this.show(); } }
  show() {
    const n = [3, 4, 5][this.round - 1];
    if (!this.seq.length || this.seq.length !== n) { this.seq = []; for (let i = 0; i < n; i++) { let k; do k = Math.floor(Math.random() * 5); while (k === this.seq[i - 1]); this.seq.push(k); } }
    this.input = []; this.state = 'show'; this.showT = 0; this.showI = -1;
    for (const l of this.lamps) l.lit = 0;
    this.banner(`The ritual · round ${this.round}/3`, `Follow the wisp: ${n} lanterns.`, 'info');
    this.wisp.visible = true; this.wisp.position.copy(this.shrine);
  }
  update(dt) {
    const t = G.uTime.value;
    for (const l of this.lamps) { const k = l.lit > 0 ? 1 : l.flash > 0 ? l.flash : 0; if (l.flash > 0) l.flash -= dt; l.flame.material.opacity = k; l.light.intensity = k * 6; l.flame.scale.setScalar(1 + Math.sin(t * 9 + l.i) * 0.12); }
    if (this.state === 'show') {
      this.showT += dt;
      const step = 1.4, idx = Math.floor(this.showT / step), f = (this.showT % step) / step;
      if (idx >= this.seq.length) { this.state = 'input'; this.wisp.visible = false; this.wispLight.intensity = 0; this.say('Now light them in that order.', 'info'); return; }
      const from = idx === 0 ? this.shrine : this.lamps[this.seq[idx - 1]].pos, to = this.lamps[this.seq[idx]].pos;
      this.wisp.position.lerpVectors(from, to, Math.min(1, f * 1.4)); this.wisp.position.y += Math.sin(f * Math.PI) * 3;
      this.wispLight.position.copy(this.wisp.position); this.wispLight.intensity = 5;
      if (idx !== this.showI && f > 0.7) { this.showI = idx; this.lamps[this.seq[idx]].flash = 0.8; this.sfx('note', to, 0.8); }
    }
    if (this.state === 'wraiths' && this.m.units.every(u => u.dead)) { this.m.units = []; this.state = 'failed'; this.say('The wraiths sink back beneath the sand. Talk to the Lanternkeeper to try again.', 'info'); }
  }
  interactable() {
    if (this.state !== 'input') return null;
    for (let i = 0; i < 5; i++) if (this.near('lantern:' + i, 2.6)) return { portal: 'lantern', name: 'Light the lantern', i };
    return null;
  }
  interact(t) {
    if (t.portal !== 'lantern') return false;
    const want = this.seq[this.input.length], l = this.lamps[t.i];
    this.me.model?.play?.('interact', { dur: 0.7 });
    if (t.i === want) {
      this.input.push(t.i); l.lit = 1; this.sfx('fire', l.pos, 0.8); this.g.fx?.burst?.({ pos: l.pos, kind: 'frost', color: 0x9ad8ff, count: 16, speed: 3 });
      if (this.input.length === this.seq.length) {
        this.state = 'idle';
        if (this.round >= 3) this.finale();
        else { this.round++; this.seq = []; this.banner('The drowned sigh…', 'The next round begins.', 'success'); this.m.after(3, () => this.show()); }
      }
    } else {
      this.state = 'wraiths';
      for (const x of this.lamps) x.lit = 0;
      this.banner('Wrong lantern!', 'The drowned rise, cross and cold.', 'warn');
      this.sfx('ghost_wail', this.me.pos);
      for (let k = 0; k < 3; k++) { const a = rnd(0, TAU), x = this.me.pos.x + Math.cos(a) * 7, z = this.me.pos.z + Math.sin(a) * 7; this.m.mob(WRAITH, x, z, { name: WRAITH.name, variant: undefined }); }
      this.seq = [];
    }
    return true;
  }
  finale() {
    const m = this.m;
    this.banner('The Moonveil rests', 'All five lanterns burn together.', 'clear');
    for (const l of this.lamps) l.lit = 1;
    this.g.fx?.play?.('light_pillar', { pos: this.shrine, x: this.shrine.x, z: this.shrine.z, color: 'frost', r: 5 });
    this.g.audio?.stinger?.('quest_complete');
    // the drowned captain's ghost thanks you
    const ghost = PROVIDERS.hero?.({ cls: null, sex: 'm', look: {}, npc: 'sailor', lod: 'full' });
    if (ghost) { ghost.root.position.copy(this.shrine).setY(this.shrine.y - 1.6); m.keep(ghost.root); ghost.setTint?.(0x9ad8ff, 0.8); ghost.root.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } }); ghost.play?.('bow', { dur: 2.5 }); this.ghost = ghost; }
    m.after(2.5, () => m.claimSoul());
  }
  exit() { this.ghost?.dispose?.(); }
  progress() { if (this.m.hasSoul()) return null; return { label: this.state === 'input' ? `Round ${this.round}/3 · lanterns ${this.input.length}/${this.seq.length}` : this.round ? `The lantern ritual · round ${this.round}/3` : 'Speak with the Lanternkeeper', pct: ((this.round - 1) + (this.seq.length ? this.input.length / this.seq.length : 0)) / 3 * 100 }; }
  win() { this.round = 3; this.finale(); }
};

// ------------------------------------------------------------------------------------------------ Stormcrown: the climb
GIMMICKS.climb = class Climb extends Gimmick {
  enter() { this.state = 'idle'; this.t = 0; this.strikeT = 2; this.best = this.m.sea.climbBest || null; }
  line(id) { if (this.state === 'climb') return 'Keep moving! Up, up!'; if (this.best) return `Your best ascent: ${this.best.toFixed(1)} s. The storm remembers.`; return null; }
  choices(id) { return this.state === 'climb' ? [] : [{ id: 'climb', text: 'Begin the ascent. (The storm will try to stop you.)', kind: 'quest' }]; }
  choose(id, c) { if (c === 'climb') this.start(); }
  start() { this.state = 'climb'; this.t = 0; this.strikeT = 2.5; this.banner('The Ascent', 'Reach the Crown Bell. Lightning strikes where you stand — keep moving.', 'warn'); this.g.audio?.music?.('boss'); }
  update(dt) {
    const me = this.me; if (!me) return;
    const z = this.m.zone, L = z.ledgeAt?.(me.pos.x, me.pos.z);
    if (this.state !== 'climb') {
      // ambient storm: distant strikes on the sea
      this.amb = (this.amb || 3) - dt; if (this.amb <= 0) { this.amb = rnd(3, 7); const a = rnd(0, TAU), r = rnd(60, 90); this.g.fx?.lightning?.({ from: { x: Math.cos(a) * r, y: 70, z: Math.sin(a) * r - 20 }, to: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }, color: 'lightning', impact: false }); this.sfx('thunder', { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }, 0.6); }
      return;
    }
    this.t += dt;
    if (me.dead) { this.state = 'idle'; this.say('The storm wins this time. Speak to Brother Galewright to try again.', 'warn'); this.g.audio?.music?.('field_dark'); return; }
    const prog = L ? L.t : 0;
    this.strikeT -= dt;
    if (this.strikeT <= 0) {
      this.strikeT = Math.max(0.7, 2.1 - prog * 1.3);
      // aim where the hero will be: along the ledge ahead
      const vx = me.move.x || 0, vz = me.move.z || 0;
      const x = me.pos.x + vx * 0.9 + rnd(-1.2, 1.2), zz = me.pos.z + vz * 0.9 + rnd(-1.2, 1.2);
      this.m.hazard({ shape: 'circle', x, z: zz, r: 2.6, dur: 1.15, color: 'yellow', pct: 0.14, knock: 'down', onBlast: () => {
        const y = this.m.y(x, zz);
        this.g.fx?.lightning?.({ from: { x: x + rnd(-4, 4), y: y + 40, z: zz - 10 }, to: { x, y, z: zz }, color: 'lightning', width: 0.5 });
        this.g.fx?.shockwave?.({ pos: { x, y: y + 0.1, z: zz }, radius: 3, color: 'lightning', dur: 0.35, dust: false });
        this.sfx('thunder', { x, y, z: zz }, 1.2);
      } });
      if (prog > 0.45 && Math.random() < 0.35) { const x2 = me.pos.x + rnd(-3, 3), z2 = me.pos.z + rnd(-3, 3); this.m.hazard({ shape: 'circle', x: x2, z: z2, r: 2.2, dur: 1.4, color: 'yellow', pct: 0.1, knock: 'down', onBlast: () => { const y = this.m.y(x2, z2); this.g.fx?.lightning?.({ from: { x: x2, y: y + 40, z: z2 - 8 }, to: { x: x2, y, z: z2 }, color: 'lightning' }); this.sfx('thunder', { x: x2, y, z: z2 }, 0.8); } }); }
    }
  }
  interactable() { if (this.near('bell', 3.2) && Math.abs(this.me.pos.y - (this.m.anchor('bell').y ?? 40)) < 3) return { portal: 'bell', name: 'Ring the Crown Bell' }; return null; }
  interact(t) {
    if (t.portal !== 'bell') return false;
    const b = this.m.anchor('bell'), y = b.y ?? 40;
    this.me.model?.play?.('pull', { dur: 1 });
    this.sfx('bell', { x: b.x, y: y + 8, z: b.z }, 1.5); this.m.after(0.5, () => this.sfx('ship_bell', { x: b.x, y: y + 8, z: b.z }, 1.2));
    this.g.fx?.lightning?.({ from: { x: b.x, y: y + 60, z: b.z - 10 }, to: { x: b.x, y: y + 11, z: b.z }, color: 'lightning', width: 0.9, strands: 4 });
    this.g.fx?.shockwave?.({ pos: { x: b.x, y: y + 0.4, z: b.z }, radius: 14, color: 'lightning', dur: 0.8 });
    this.g.cam.shake(0.5);
    if (this.state === 'climb') {
      const tt = this.t; this.state = 'done';
      if (!this.best || tt < this.best) { this.best = tt; this.m.sea.climbBest = tt; this.A.save(); }
      this.banner('The Tempest knows your name', `Ascent: ${tt.toFixed(1)} s`, 'clear');
      this.g.audio?.music?.('field_dark');
    }
    if (!this.m.hasSoul()) this.m.after(1.5, () => this.m.claimSoul());
    return true;
  }
  timer() { return this.state === 'climb' ? { label: 'The Ascent', left: Math.max(0, 180 - this.t), urgent: this.t > 150 } : null; }
  progress() { if (this.state !== 'climb') return null; const L = this.m.zone.ledgeAt?.(this.me.pos.x, this.me.pos.z); return { label: 'Height', pct: (L ? L.t : 0) * 100 }; }
  win() { if (!this.m.hasSoul()) this.m.claimSoul(); }
};

// ------------------------------------------------------------------------------------------------ Hushwater: Coralie's trust
GIMMICKS.mermaid = class Mermaid extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.coralie ||= { pearls: 0, song: false };
    // Coralie sits waist-deep beside her rock, with a tail that flicks out of the water
    const u = m.npcs.find(n => n.data.npcDef.id === 'coralie');
    if (u) {
      u.data.hover = -0.95 - m.y(u.pos.x, u.pos.z); u.data.reach = 2.5;
      const tail = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x2ab0a0, emissive: 0x0a3a38 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.05, 1.8, 10), mat); body.rotation.x = Math.PI / 2; body.position.set(0, -0.1, 1.2); tail.add(body);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 3), new THREE.MeshLambertMaterial({ color: 0x5ae0c8, emissive: 0x1a5a50, side: THREE.DoubleSide })); fin.scale.set(1, 1, 0.12); fin.position.set(0, 0.25, 2.1); fin.rotation.x = -0.6; tail.add(fin);
      this.tail = tail; this.tailU = u;
    }
    this.beds = [0, 1, 2, 3, 4].map(i => ({ i, cd: 0, bubT: rnd(0, 1) }));
    this.dive = null;
    this.off = this.s.bus.on('song', ev => { if (ev.id === 'tides' && this.near('jetty', 12)) this.m.after(6, () => this.heardSong()); });
  }
  exit() { this.off?.(); this.tail?.removeFromParent(); }
  update(dt) {
    const t = G.uTime.value;
    if (this.tail && this.tailU?.model?.root && !this.tail.parent) this.tailU.model.root.add(this.tail);
    if (this.tail) this.tail.rotation.x = Math.sin(t * 1.3) * 0.15;
    for (const b of this.beds) {
      b.cd -= dt; b.bubT -= dt;
      if (b.cd <= 0 && b.bubT <= 0) { b.bubT = rnd(0.5, 1.1); const a = this.m.anchor('bed:' + b.i); this.g.fx?.burst?.({ pos: { x: a.x, y: 0.1, z: a.z - 1.2 }, kind: 'water', count: 5, speed: 1.2, up: 1.6, size: 0.25, life: 0.8 }); }
    }
    if (this.dive) {
      const d = this.dive; d.t += dt; d.k = (Math.sin(d.t * d.speed * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      if (d.t > 6) { this.say('You surface, out of breath and empty-handed.', 'info'); this.dive = null; this.me.data.rooted = false; }
      if (this.g.input.hit('interact') || this.g.input.hit('dash') || this.g.input.clicked(0)) this.stopDive();
    }
  }
  interactable() {
    if (this.dive) return { portal: 'dive-stop', name: 'Grab the pearl!' };
    for (const b of this.beds) if (this.near('bed:' + b.i, 2.4)) return b.cd > 0 ? null : { portal: 'bed', name: 'Dive for pearls', bed: b };
    return null;
  }
  interact(t) {
    if (t.portal === 'bed') { this.startDive(t.bed); return true; }
    if (t.portal === 'dive-stop') { this.stopDive(); return true; }
    return false;
  }
  startDive(b) {
    this.dive = { bed: b, t: 0, k: 0, speed: rnd(0.55, 0.75), zone: [0.66, 0.82] };
    this.me.data.rooted = true; this.me.model?.play?.('dig', { dur: 1 });
    this.sfx('wave_splash', this.me.pos, 0.8);
    if (!this.helped) { this.helped = true; this.say('Press G (or Space) when the bar sweeps through the golden band.', 'info'); }
  }
  stopDive() {
    const d = this.dive; if (!d || d.t < 0.2) return;
    this.dive = null; this.me.data.rooted = false; d.bed.cd = 18;
    const hit = d.k >= d.zone[0] && d.k <= d.zone[1], near = d.k >= d.zone[0] - 0.12 && d.k <= d.zone[1] + 0.12;
    if (hit || near) {
      const n = hit ? 2 : 1;
      this.A.give('pearl', n);
      this.s.ui?.hud?.loot?.({ name: 'Sea Pearl', grade: 3, count: n, icon: 'item:pearl', kind: 'material' });
      this.say(hit ? 'A perfect dive — two round pearls!' : 'A pearl!', 'success'); this.sfx(hit ? 'loot_rare' : 'coin');
      this.g.fx?.burst?.({ pos: { x: this.me.pos.x, y: 1, z: this.me.pos.z }, kind: 'star', count: 12, speed: 3, up: 3 });
    } else { this.say('Only sand and a very offended crab.', 'info'); }
  }
  line(id) {
    const c = this.m.sea.coralie;
    if (id !== 'coralie') return null;
    if (this.m.hasSoul()) return 'You came back! Sit with me a while. The tide is singing.';
    if (c.pearls >= 3 && c.song) return 'Pearls and a song… you understand the sea, surface-dweller.';
    return `Pearls, ${3 - Math.min(3, c.pearls)} more, if you please — and the Serenade of Tides. Then I will sing for you.`;
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
    if (c === 'give') { if (!this.A.take('pearl', 1)) { this.say('You have no pearls. Try the bubbling beds in the shallows.', 'error'); return; } st.pearls++; this.sfx('coin'); this.say(`Coralie holds the pearl to the light. (${st.pearls}/3)`, 'success'); this.A.save(); this.check(); }
    if (c === 'sing') { this.m.playSong('tides'); }
  }
  heardSong() { const st = this.m.sea.coralie; if (st.song) return; st.song = true; this.say('Coralie closes her eyes and sways with the tide.', 'success'); this.A.save(); this.check(); }
  check() {
    const st = this.m.sea.coralie;
    if (st.pearls >= 3 && st.song && !this.m.hasSoul()) {
      const u = this.tailU;
      this.banner('Coralie sings', 'A lullaby older than the Glass Sea', 'success');
      this.g.audio?.song?.('rest', { pos: u?.pos || this.me.pos });
      this.g.fx?.play?.('song_notes', { pos: u?.pos, x: u?.pos.x, z: u?.pos.z, dur: 8, unit: u?.model?.root });
      this.m.after(6, () => { this.m.claimSoul(); const have = new Set(this.A.roster.collect.bounties || []); if (!have.has('bounty:3')) { collect(this.s, 'bounties', 'bounty:3', 'Mermaid’s Tortoiseshell Comb'); this.say('She presses a tortoiseshell comb into your hand. (Sea Bounty)', 'success'); } });
    }
  }
  progress() {
    if (this.dive) return null;
    if (this.m.hasSoul()) return null;
    const c = this.m.sea.coralie; return { label: `Coralie’s trust · pearls ${c.pearls}/3 · song ${c.song ? '✓' : '—'}`, pct: (Math.min(3, c.pearls) + (c.song ? 1 : 0)) / 4 * 100 };
  }
  cast() { const d = this.dive; return d ? { name: 'Diving', label: 'Diving… grab the pearl!', pct: d.k, t: d.k, kind: 'charge', perfect: d.zone } : null; }
  win() { const st = this.m.sea.coralie; st.pearls = 3; st.song = true; this.check(); }
};

// ------------------------------------------------------------------------------------------------ Shellback: feed Grandmother Shellback
GIMMICKS.turtle = class Turtle extends Gimmick {
  enter() {
    const m = this.m, sea = m.sea;
    sea.shellback ||= { fed: 0 };
    this.snoreT = 9; this.carry = null;
    this.weeds = [0, 1, 2, 3, 4, 5].map(i => {
      const a = m.anchor('weed:' + i); if (!a) return null;
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.12, rnd(0.8, 1.3), 5), new THREE.MeshLambertMaterial({ color: pick([0x3a7a3a, 0x4a8a2a, 0x2a6a4a]) })); b.position.set(rnd(-0.3, 0.3), 0.5, rnd(-0.3, 0.3)); b.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); g.add(b); }
      g.position.set(a.x, m.y(a.x, a.z), a.z); m.keep(g);
      return { i, g, taken: false, regrow: 0 };
    }).filter(Boolean);
    const h = m.zone.spots.head; this.head = new THREE.Vector3(h[0], 0, h[2]);
  }
  update(dt) {
    const me = this.me, m = this.m;
    for (const w of this.weeds) { if (w.taken) { w.regrow -= dt; if (w.regrow <= 0) { w.taken = false; w.g.visible = true; } } }
    if (this.carryMesh && me?.model?.root) { this.carryMesh.position.set(me.pos.x, me.pos.y + 1.9, me.pos.z); this.carryMesh.rotation.y = me.facing; }
    // the Great Snore: a ripple rolls out from her head across the whole shell
    this.snoreT -= dt;
    if (this.snoreT <= 2.2 && !this.warned) { this.warned = true; this.sfx('roar', this.head, 0.5); this.g.fx?.burst?.({ pos: { x: this.head.x, y: 3, z: this.head.z - 8 }, kind: 'water', count: 20, speed: 4, up: 5 }); if (!this.helped && me && me.pos.distanceTo(this.head) < 70) { this.helped = true; this.say('Grandmother Shellback breathes in… dash (Space) through the ripple of her snore!', 'warn'); } }
    if (this.snoreT <= 0) { this.snore(); this.snoreT = rnd(14, 19); this.warned = false; }
    if (this.wave) {
      const w = this.wave; w.r += 12 * dt;
      if (me && !me.dead && !w.hit && me.invuln <= 0 && me.pos.y > 1) { const d = Math.hypot(me.pos.x - this.head.x, me.pos.z - this.head.z); if (Math.abs(d - w.r) < 1.2) { w.hit = true; applyKnock(this.L, null, me, 'down', 2, this.head.x, this.head.z, 1.2); dealDamage(this.L, null, me, 0, { fixed: Math.round(me.hpMax * 0.04) }); this.drop(); } }
      if (w.r > 110) this.wave = null;
    }
  }
  snore() {
    this.wave = { r: 4, hit: false };
    this.g.fx?.shockwave?.({ pos: { x: this.head.x, y: 2, z: this.head.z }, radius: 110, color: 'white', dur: 9, wall: 1.2, dust: true });
    this.g.cam.shake(0.35);
    this.sfx('boss_roar', this.head, 0.7);
    for (const u of this.m.npcs) if (u.type === 'pip') u.model?.play?.('cheer', { dur: 1.2 });
  }
  drop() { if (!this.carry) return; this.carry = null; this.carryMesh?.removeFromParent(); this.carryMesh = null; this.say('You dropped the seaweed!', 'warn'); }
  interactable() {
    if (!this.carry) for (const w of this.weeds) if (!w.taken && this.near('weed:' + w.i, 2.4)) return { portal: 'weed', name: 'Gather seaweed', weed: w };
    if (this.carry && this.near('mouth', 4.5)) return { portal: 'feed', name: 'Feed Grandmother Shellback' };
    return null;
  }
  interact(t) {
    if (t.portal === 'weed') {
      const w = t.weed; w.taken = true; w.regrow = 40; w.g.visible = false;
      this.me.model?.play?.('gather', { dur: 1 }); this.sfx('gather');
      this.carry = w; this.carryMesh = w.g.clone(); this.carryMesh.visible = true; this.carryMesh.scale.setScalar(0.8); this.m.keep(this.carryMesh);
      this.say('Seaweed! Carry it to Grandmother Shellback’s head (north).', 'info');
      return true;
    }
    if (t.portal === 'feed') {
      this.carry = null; this.carryMesh?.removeFromParent(); this.carryMesh = null;
      const st = this.m.sea.shellback; st.fed++; this.A.save();
      this.me.model?.play?.('throw', { dur: 0.7 });
      this.g.fx?.burst?.({ pos: { x: this.head.x, y: 2, z: this.head.z - 6 }, kind: 'leaf', count: 20, speed: 3, up: 3 });
      this.sfx('pip_cheer'); this.say(`Grandmother Shellback munches contentedly. (${Math.min(st.fed, 6)}/6)`, 'success');
      if (st.fed >= 6 && !this.m.hasSoul()) this.m.after(1.5, () => this.wake());
      return true;
    }
    return false;
  }
  wake() {
    this.banner('Grandmother Shellback stirs', 'One ancient eye opens… and something glints in her beak.', 'clear');
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe080).multiplyScalar(2.5), toneMapped: false }));
    eye.position.set(this.head.x + 4.4, 3.4, this.head.z - 3.2); this.m.keep(eye); this.eye = eye;
    this.sfx('boss_roar', this.head, 0.5); this.g.cam.shake(0.3);
    this.m.after(3, () => { this.m.claimSoul(); this.m.after(6, () => { this.eye?.removeFromParent(); }); });
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
    return null;
  }
  choose(id, c) {
    const A = this.A;
    if (c === 'pack') { if (!A.take('silver', 6000)) { this.say('Not enough silver.', 'error'); return; } A.give('card_pack_pip', 1); this.s.ui?.hud?.loot?.({ name: 'Pip Card Pack', grade: 3, count: 1, icon: 'item:card_pack', kind: 'consumable' }); }
    if (c === 'fig') { if (!A.take('silver', 2500)) { this.say('Not enough silver.', 'error'); return; } A.give('gift3', 1); this.s.ui?.hud?.loot?.({ name: 'Carved Pip Figurine', grade: 3, count: 1, icon: 'item:gift:3', kind: 'gift' }); }
  }
  progress() { if (this.m.hasSoul()) return null; const f = Math.min(6, this.m.sea.shellback.fed); return { label: `Grandmother Shellback fed ${f}/6${this.carry ? ' · carrying seaweed' : ''}`, pct: f / 6 * 100 }; }
  exit() { this.carryMesh?.removeFromParent(); }
  win() { this.m.sea.shellback.fed = 6; this.wake(); }
};

// ------------------------------------------------------------------------------------------------ Drownbell: the Bellwarden
class BellwardenAI {
  constructor(u, gim) { this.u = u; this.gim = gim; this.cd = 3; this.t = 0; this.busy = 0; }
  update(dt, L) {
    const u = this.u, me = this.gim.me; this.t += dt; this.cd -= dt; this.busy -= dt;
    u.move.x = u.move.z = 0;
    if (u.dead || !me) return;
    if (u.data.groggy > 0) { u.data.groggy -= dt; if (u.data.groggy <= 0) u.data.groggy = 0; return; }
    if (this.busy > 0) return;
    const d = u.distTo(me);
    if (d > 5.5 && !this.gim.burrowed) { const dx = me.pos.x - u.pos.x, dz = me.pos.z - u.pos.z; u.move.x = dx / d * 3.2; u.move.z = dz / d * 3.2; u.faceTo(me.pos.x, me.pos.z); }
    if (this.cd <= 0) this.pick(d);
  }
  pick(d) {
    const u = this.u, g = this.gim, me = g.me, m = g.m, hp = u.hp / u.hpMax;
    const r = Math.random();
    u.faceTo(me.pos.x, me.pos.z);
    const fx = -Math.sin(u.facing), fz = -Math.cos(u.facing);
    if (d < 8 && r < 0.35) {
      // claw snip (cone)
      this.busy = 1.4; this.cd = rnd(1.8, 2.6);
      u.model?.play?.('attack', { dur: 1.2 });
      m.hazard({ shape: 'cone', x: u.pos.x, z: u.pos.z, dx: fx, dz: fz, r: 8, angle: 1.9, dur: 0.95, color: 'red', pct: 0.12, knock: 'push', kb: 3 });
    } else if (r < 0.55) {
      // both claws up, blue shimmer — counter it! — then SLAM
      this.busy = 2.2; this.cd = rnd(2.5, 3.5);
      u.data.counterWindow = 1.0; this.gim.g.fx?.counterWindow?.({ attach: u.model?.root, dur: 1.0, height: 5, scale: 2.5 });
      u.model?.play?.('attack_big', { dur: 2 });
      m.hazard({ shape: 'circle', x: u.pos.x + fx * 6, z: u.pos.z + fz * 6, r: 6.5, dur: 1.4, color: 'orange', pct: 0.22, knock: 'down', onBlast: () => { this.gim.g.fx?.play?.('ground_slam', { pos: { x: u.pos.x + fx * 6, y: 0.5, z: u.pos.z + fz * 6 }, x: u.pos.x + fx * 6, z: u.pos.z + fz * 6, r: 6 }); this.gim.g.cam.shake(0.4); } });
    } else if (r < 0.72) {
      // bell toll: a donut of force around it — get close or get far
      this.busy = 2.6; this.cd = rnd(3, 4);
      u.model?.play?.('roar', { dur: 2.2 });
      this.gim.sfx('bell', u.pos, 1.4);
      m.hazard({ shape: 'donut', x: u.pos.x, z: u.pos.z, r: 17, inner: 5, dur: 2.1, color: 'purple', pct: 0.16, knock: 'down', onBlast: () => { this.gim.g.fx?.shockwave?.({ pos: { x: u.pos.x, y: 1, z: u.pos.z }, radius: 17, color: 0x6ad0a0, dur: 0.6 }); this.gim.sfx('ship_bell', u.pos, 1.3); } });
    } else if (r < 0.86) {
      // froth spout: three globs lobbed around the hero
      this.busy = 1.6; this.cd = rnd(2, 3);
      u.model?.play?.('spit', { dur: 1 });
      for (let k = 0; k < 3; k++) { const x = me.pos.x + rnd(-4, 4), z = me.pos.z + rnd(-4, 4); m.after(k * 0.25, () => m.hazard({ shape: 'circle', x, z, r: 3, dur: 1.3, color: 'red', pct: 0.08, onBlast: () => this.gim.g.fx?.burst?.({ pos: { x, y: 0.5, z }, kind: 'water', count: 16, speed: 5, up: 5 }) })); }
    } else {
      // burrow and burst out under the hero
      this.busy = 3.4; this.cd = rnd(3, 4);
      u.model?.play?.('burrow', { dur: 1.4 }); u.untargetable = true; this.gim.burrowed = true;
      m.after(1.4, () => { const x = me.pos.x, z = me.pos.z; m.hazard({ shape: 'circle', x, z, r: 5, dur: 1.5, color: 'orange', pct: 0.18, knock: 'up', onBlast: () => { u.pos.x = x; u.pos.z = z; u.untargetable = false; this.gim.burrowed = false; u.model?.play?.('spawn', { dur: 1.2 }); this.gim.g.fx?.burst?.({ pos: { x, y: 0.5, z }, kind: 'sand', count: 30, speed: 7, up: 7 }); this.gim.g.cam.shake(0.4); } }); });
    }
  }
}
GIMMICKS.bell = class Bell extends Gimmick {
  enter() { this.rings = 0; this.state = 'idle'; this.boss = null; this.ringCd = 0; }
  update(dt) { this.ringCd -= dt; if (this.bossU?.dead && this.state === 'fight') this.victory(); }
  interactable() { if (this.state === 'idle' && this.near('bellpull', 2.6)) return { portal: 'bell', name: `Ring the drowned bell (${this.rings}/3)` }; return null; }
  interact(t) {
    if (t.portal !== 'bell' || this.ringCd > 0) return !!t.portal && t.portal === 'bell';
    this.ringCd = 2.2; this.rings++;
    const tw = this.m.zone.spots.tower;
    this.me.model?.play?.('pull', { dur: 1 });
    this.sfx('bell', { x: tw[0], y: 15, z: tw[2] }, 1.6);
    this.g.fx?.shockwave?.({ pos: { x: tw[0], y: 0.3, z: tw[2] }, radius: 22, color: 0x6ad0a0, dur: 1.2, dust: false });
    this.g.cam.shake(0.15 * this.rings);
    if (this.rings >= 3) { this.state = 'rising'; this.say('The sea answers. Something is coming up from the deep…', 'warn'); this.m.after(3, () => this.surface()); }
    else this.say(this.rings === 1 ? 'The bell tolls across the shoal. The water trembles.' : 'Bubbles boil up from the pool beneath the tower…', 'info');
    return true;
  }
  surface() {
    const m = this.m, p = m.anchor('pool'), ar = m.anchor('arena');
    const tpl = { name: 'The Bellwarden', model: 'crab', creature: 'crab', radius: 3.4, height: 3.6, hp: 300, atk: 0.04, speed: 3.2, mass: 99, superArmor: 2, attacks: [] };
    const u = m.mob(tpl, ar.x, ar.z - 6, { name: 'The Bellwarden', boss: true, scale: 1, variant: 'barnaclaw', ai: (uu) => new BellwardenAI(uu, this) });
    u.model = u.model || createCreature('crab', { variant: 'barnaclaw', scale: 9 });
    u.data.title = 'Keeper of the Drowned Chapel';
    u.data.stagger = { v: 100, max: 100, onBreak: () => { u.data.groggy = 4; u.model?.play?.('stun', { dur: 4 }); this.banner('STAGGERED', 'The Bellwarden reels!', 'success'); this.m.after(4.5, () => { u.data.stagger.v = 100; u.data.stagger.broken = false; }); } };
    this.bossU = u; this.state = 'fight';
    this.s.ui?.banner?.('The Bellwarden', { kind: 'boss', title: 'Keeper of the Drowned Chapel', dur: 3.5 });
    this.g.audio?.stinger?.('boss_intro'); this.g.audio?.music?.('boss');
    this.g.cam.shake(0.6);
    this.g.fx?.burst?.({ pos: { x: ar.x, y: 1, z: ar.z - 6 }, kind: 'water', count: 60, speed: 9, up: 10, size: 0.8 });
    // the drowned bell rides its back
    this.m.after(0.1, () => { const root = u.model?.root; if (!root) return; const b = new THREE.Group(); const bm = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [1.1, 0.04], [1.3, 0.25], [1.2, 0.6], [0.95, 1.4], [0.75, 2.1], [0.6, 2.4], [0.1, 2.5]].map(([r, h]) => new THREE.Vector2(r * 0.16, h * 0.16)), 16), new THREE.MeshLambertMaterial({ color: 0x5a8a6a, emissive: 0x0a1a10 })); b.add(bm); b.position.set(0, 0.34, 0.05); root.children[0]?.add?.(b) ?? root.add(b); });
  }
  victory() {
    this.state = 'won';
    this.banner('The Bellwarden sinks', 'The drowned bell rings once, softly, by itself.', 'clear');
    this.g.audio?.music?.('sea');
    this.sfx('bell', this.me.pos, 1.2);
    this.A.give('silver', 25000); this.A.give('gold', 60);
    if (Math.random() < 0.5 || !(this.A.roster.collect.bounties || []).includes('bounty:6')) { collect(this.s, 'bounties', 'bounty:6', 'Barnacled Crown'); this.say('Something glitters in the sand where it fell: the Barnacled Crown! (Sea Bounty)', 'success'); }
    this.m.after(2, () => { if (!this.m.hasSoul()) this.m.claimSoul(); });
    trackTask(this.s, 'kill', { mob: 'bellwarden', family: 'beast', boss: true, zone: 'isle_drownbell' });
  }
  boss() { const u = this.bossU; return u && !u.dead && this.state === 'fight' ? { name: u.name, title: u.data.title, hp: u.hp, hpMax: u.hpMax, barHp: u.hpMax / 25, stagger: { v: u.data.stagger.v, max: 100 }, destruction: null, enrageLeft: null, counter: (u.data.counterWindow || 0) > 0, buffs: [], showHp: true, groggy: u.data.groggy > 0 } : null; }
  progress() { if (this.state === 'idle' && !this.m.hasSoul()) return { label: `The drowned bell · rung ${this.rings}/3`, pct: this.rings / 3 * 100 }; return null; }
  line(id) { if (id === 'bellfisher' && this.state === 'won') return 'You beat it! I’ll be telling that one for years. Badly, but for years.'; return null; }
  win() { if (!this.m.hasSoul()) this.m.claimSoul(); }
};

// ------------------------------------------------------------------------------------------------ launching & registration
async function launchIsland(session, c = {}) {
  const I = ISLAND_BY_ID[c.island] || ISLANDS[0];
  if (I.night && !isNight() && !c.force) { session.ui?.toast?.('The Moonveil mist will not part until nightfall.', 'warn'); return; }
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
    const I = m.I, A = this.s.account, souls = A.roster.collect.souls || [], seeds = A.roster.collect.seeds || [];
    h.quests = [{ id: 'isle:' + I.id, title: I.name, kind: 'guide', steps: [
      { text: `Island Soul: ${I.soul.name}`, n: souls.includes(I.soul.id) ? 1 : 0, need: 1, done: souls.includes(I.soul.id) },
      { text: 'Pip Seeds on this island', n: I.seeds.filter(s => seeds.includes(s)).length, need: I.seeds.length, done: I.seeds.every(s => seeds.includes(s)) },
      { text: 'Vista', n: (A.roster.collect.vistas || []).includes(I.vista) ? 1 : 0, need: 1, done: (A.roster.collect.vistas || []).includes(I.vista) },
    ] }, ...(h.quests || [])];
  },
});
