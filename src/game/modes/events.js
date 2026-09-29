// World events on the Lost Ark schedule (UTC; the calendar is src/game/systems/tasks.js):
//   Field Boss every hour at :00 — the boss appears at the `fieldboss` anchor of the field named by the calendar and
//     AI adventurers arrive to fight it (open world, rewards once per event window);
//   Chaos Gate at :30 — a rift portal at the field's `chaosgate` anchor → a short instanced wave defense that ends
//     with the Gatekeeper;
//   Adventure Island every 2 h at :00 — an instanced island (built here from the world kit) with an objective that
//     depends on the island's reward focus (gold rush, mirror shards, lantern vigil, boiling tide, runaway Pips).
// Warnings 5 minutes before (toast + chat), the event compass (H or the minimap button; "Go" travels there), and
// ?event=fieldboss|chaosgate|island to force one now for testing (window.__modes.events.force(kind) too).
import * as THREE from 'three';
import { registerPlugin, registerContent, registerAction, registerWindow, WINDOWS, ACTIONS } from '../registry.js';
import { makeBoss } from '../ai/boss.js';
import { refFor } from '../ai/mob.js';
import { makeSim } from '../social/names.js';
import { itemLevel } from '../systems/stats.js';
import { heal } from '../combat.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { EVENTS } from '../../data/tasks.js';
import { WARN_MIN, FIELD_BOSS, ZONE_BY_NAME, CHAOS_GATE, ISLAND_EVENTS, ISLAND_NAMES } from '../../data/events.js';
import { CUBE } from '../../data/inferno.js';
import { S, loadInstance, spawnLocal, mobFrom, mobTemplate, RunParty, showResults, dpsRows, emitClear, fmtTime, AUTO, weighted, mergeRows } from './inferno.js';
import * as FIELD from './field.js';
import { registerZone } from '../../world/index.js';
import { Ground } from '../../world/ground.js';
import { NavGrid } from '../../world/nav.js';
import { Kit, M, box, cyl } from '../../world/kit.js';
import * as SH from '../../world/shapes.js';
import * as P from '../../world/props.js';
import { boulder } from '../../world/cliffs.js';
import { buildWater } from '../../world/water.js';
import { Flora, Grass } from '../../world/foliage.js';
import { makeEnv } from '../../world/env.js';
import { paintMinimap } from '../../world/minimap.js';
import { Decals } from '../../world/decals.js';
import { buildFlames, LightPool, buildParticles } from '../../world/fx.js';
import { tick } from '../../world/zone.js';
import { RNG, Simplex, smoothstep, lerp } from '../../core/noise.js';

const Q = typeof location !== 'undefined' ? Object.fromEntries(new URLSearchParams(location.search)) : {};
const MIN = 60e3;
const OPEN = new Set(['city', 'field', 'island', 'stronghold', 'pipsprout']);
const FIELDS_WITH_EVENTS = ['goldmeadow', 'thornwood', 'ashen_ridge'];
const inField = s => FIELDS_WITH_EVENTS.includes(s.game.zone?.id) && (s.game.mode?.kind === 'field' || !s.game.mode?.kind || s.game.mode?.kind === 'city');
const say = (s, from, text, channel = 'world') => s.ui.chat?.add?.({ channel, from, text });
const simName = seed => makeSim(seed).name;

// ================================================================================================ island arena
/** a small event island per reward focus, built from the world kit (sand, grass, rocks, ruins, trees, the sea) */
const buildIsle = focus => async (zone, { quality = 1 } = {}) => {
  const cfg = ISLAND_EVENTS[focus], seed = focus.length * 977 + focus.charCodeAt(0);
  const rng = new RNG(seed), nz = new Simplex(seed + 7);
  const R = 27, shoreR = a => R + nz.noise2(Math.cos(a) * 1.3, Math.sin(a) * 1.3) * 3.2 + nz.noise2(Math.cos(a) * 3, Math.sin(a) * 3) * 1.2;
  zone.bounds = { x0: -R, z0: -R, x1: R, z1: R };
  const volcanic = cfg.ground === 'rock';
  const g = zone.ground = new Ground({ x0: -80, z0: -80, w: 160, d: 160, res: 1, layers: ['sand', 'grass', 'seastone', 'rock', 'dirt', 'moss'], base: 'sand', seed: seed % 97 });
  g.sculpt((x, z) => {
    const r = Math.hypot(x, z), sr = shoreR(Math.atan2(z, x));
    let h = 0.55 + nz.noise2(x / 9, z / 9) * 0.3 + smoothstep(sr - 6, 4, r) * 0.9;
    if (r > sr - 4) h = lerp(h, 0.05, smoothstep(sr - 4, sr + 0.5, r));
    if (r > sr + 0.5) h = lerp(0.05, -3.2, smoothstep(sr + 0.5, sr + 14, r));
    return h;
  });
  g.paint(volcanic ? 'rock' : cfg.ground === 'sand' ? 'dirt' : 'grass', SH.circle(0, 0, R - 9), { soft: 4, noise: 3, nscale: 5, amount: cfg.ground === 'sand' ? 0.35 : 1 });
  g.paint('dirt', SH.line([[0, R - 4], [0, 8], [-6, -2], [0, -10]], 2.6), { soft: 1.2, noise: 1, nscale: 2, amount: 0.8 });
  for (let i = 0; i < 7; i++) g.paint(rng.pick(['seastone', 'moss', 'rock']), SH.circle(rng.range(-R + 6, R - 6), rng.range(-R + 6, R - 6), rng.range(2, 4)), { soft: 2, noise: 1.6, nscale: 2, amount: 0.7 });
  const kit = new Kit({ seed });
  const H = (x, z) => g.heightAt(x, z);
  // shore rocks, a ruined shrine in the north, a little camp in the south
  for (let i = 0; i < 26; i++) { const a = rng.range(0, Math.PI * 2), r = shoreR(a) + rng.range(-2, 2.5), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 6 && z > 10) continue; boulder(kit, x, H(x, z), z, { s: rng.range(0.7, 1.9), seed: i + seed, tint: volcanic ? 0x3a3232 : 0x8a8278, moss: volcanic ? null : 0x5a7a34, mat: volcanic ? 'darkrock' : 'rock' }); }
  for (let i = 0; i < 5; i++) { const a = Math.PI + 0.35 + i / 4 * (Math.PI - 0.7), x = Math.cos(a) * 12, z = Math.sin(a) * 12 - 6; P.column(kit, x, H(x, z), z, i % 2 ? 3.4 : 5.2, 0.55, { capital: i % 2 === 0, tint: 0xe8e0d0 }); }
  P.statue(kit, 0, H(0, -16), -16, 0, { s: 0.9, pose: 'sword' });
  P.crateStack(kit, -6, H(-6, R - 7), R - 7, 0.4, seed); P.barrel(kit, -4.4, H(-4.4, R - 6), R - 6, 1); P.barrel(kit, 5.5, H(5.5, R - 7.5), R - 7.5, 1); P.ropeCoil(kit, 4, H(4, R - 5), R - 5, 1);
  P.brazier(kit, -2.6, H(-2.6, R - 9), R - 9, { s: 0.8 }); P.brazier(kit, 2.6, H(2.6, R - 9), R - 9, { s: 0.8 });
  for (const c of kit.colliders) g.info('ao', SH.inflate(c.shape, 0.2), { soft: 1.6, amount: 0.3 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  const flora = new Flora();
  const nTrees = cfg.ground === 'sand' ? 12 : 22;
  for (let i = 0; i < nTrees; i++) {
    const a = rng.range(Math.PI * 1.05, Math.PI * 1.95), r = rng.range(15, shoreR(a) - 4), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z + 8) < 9) continue;
    flora.tree(volcanic ? 'dead' : rng.chance(0.3) ? 'blossom' : rng.chance(0.35) ? 'cypress' : 'broadleaf', x, H(x, z) - 0.1, z, { s: rng.range(0.7, 1.0), variant: i % 3 });
  }
  if (!volcanic) for (let i = 0; i < 16; i++) { const x = rng.range(-R + 6, R - 6), z = rng.range(-R + 6, R - 6); if (Math.hypot(x, z) < 9 || Math.hypot(x, z) > R - 5) continue; flora.tree('bush', x, H(x, z), z, { s: rng.range(0.5, 0.85), variant: i % 3 }); }
  if (!volcanic) for (let i = 0; i < 160; i++) { const x = rng.range(-R, R), z = rng.range(-R, R); if (g.weight('grass', x, z) > 0.75) flora.flower(x, H(x, z), z, rng.pick([0xffffff, 0xf4d040, 0xe04060, 0xa070e0, 0xff8ab0])); }
  flora.build(zone.root);
  kit.colliders.push(...flora.colliders);
  let grass = null;
  if (!volcanic) { grass = new Grass(g, { layer: 'grass', density: quality }); zone.root.add(grass.mesh); }
  const sea = buildWater(g, { x: 0, z: 0, w: 320, d: 320, level: -0.3, swell: 0.06, ...(volcanic ? { shallow: 0xff6a20, deep: 0x5a1a08, sky: 0xffb070 } : {}) });
  zone.root.add(sea);
  const dec = new Decals(H);
  for (let i = 0; i < 16; i++) dec.add(rng.pick(volcanic ? ['scorch', 'cracks', 'fissure'] : ['pebbles', 'leaves', 'petals']), rng.range(-R + 4, R - 4), rng.range(-R + 4, R - 4), { size: rng.range(1.2, 2.4), alpha: 0.7 });
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 3);
  const motes = buildParticles(volcanic ? 'embers' : cfg.env === 'dusk' ? 'fireflies' : 'dust', { quality });
  zone.root.add(motes);
  zone.onUpdate((dt, t, focus2) => { pool.update(dt, t, focus2); grass?.update(focus2); motes.userData.update(focus2); });
  zone.onEnv?.(env => { sea.userData.setEnv?.(env); });
  const nav = new NavGrid(-R - 6, -R - 6, 2 * R + 12, 2 * R + 12, 0.5);
  nav.walk(SH.poly(Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2, r = shoreR(a) - 2.4; return [Math.cos(a) * r, Math.sin(a) * r]; })));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, R - 8]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, R - 8, 0);
  zone.anchor('boss', 0, -6, Math.PI);
  let n = 0;
  for (let i = 0; i < 400 && n < 18; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(5, shoreR(a) - 5), x = Math.cos(a) * r, z = Math.sin(a) * r; if (!nav.walkable(x, z) || Math.hypot(x, z - (R - 8)) < 6 || Object.keys(zone.anchors).some(k => k.startsWith('spot:') && Math.hypot(zone.anchors[k].x - x, zone.anchors[k].z - z) < 4)) continue; zone.anchor(`spot:${++n}`, x, z, 0); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, x = Math.cos(a) * 15, z = Math.sin(a) * 15 - 2; const p = nav.walkable(x, z) ? [x, z] : nav.nearest(x, z, 6) || [x, z]; zone.anchor(`shrine:${i + 1}`, p[0], p[1], 0); }
  for (const [, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 6); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region(ISLAND_NAMES[focus] || 'Adventure Island', 0, 0, R);
  zone.env = makeEnv(volcanic ? 'caldera' : cfg.env || 'day', { music: 'sea', ambience: 'sea' });
  zone.minimap = paintMinimap(zone, { px: 256, area: { x0: -R - 8, z0: -R - 8, size: 2 * R + 16 } });
};
for (const f of Object.keys(ISLAND_EVENTS)) registerZone(`event_isle_${f}`, { name: ISLAND_NAMES[f], kind: 'arena', size: 70 }, buildIsle(f));

// ================================================================================================ helpers
function eventRef(s) { const il = Math.max(FIELD_BOSS.minIlvl, Math.min(FIELD_BOSS.maxIlvl, itemLevel(s.char) || 0)); return { il, ref: refFor(il) }; }
function reward(s, kind, o = {}) {
  let r = null;
  try { r = S.loot.eventReward(s.account, s.char, { kind, ...o }); } catch (e) { console.error('[events reward]', e); }
  if (!r || r.ok === false) return { rows: [], currencies: {}, notes: [r?.msg || 'No rewards.'] };
  return r;
}
function lootToasts(s, rows = []) { for (const r of rows.filter(x => x.grade >= 2 || x.kind === 'currency').slice(0, 5)) s.ui.hud?.loot?.({ name: r.name, grade: r.grade, count: r.count, icon: r.icon, kind: r.kind }); }
function nearPoint(L, p, r, tries = 12) { for (let i = 0; i < tries; i++) { const a = Math.random() * 6.28, d = r * (0.5 + Math.random() * 0.5); const q = L.nav.nearest(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 5, 0.4); if (q) return q; } return { x: p.x, z: p.z }; }

// ================================================================================================ Field Boss (open world)
class FieldBoss {
  constructor(s, o) { this.s = s; this.g = s.game; this.L = s.game.level; this.o = o; this.t = 0; this.dmg = new Map(); this.state = 'fight'; this.offs = []; }
  spawn() {
    const s = this.s, g = this.g, L = this.L, z = g.zone;
    const a = z.anchors.fieldboss || z.anchors.boss || { x: (z.anchors.spawn?.x || 0), z: (z.anchors.spawn?.z || 0) - 18, facing: Math.PI };
    const def = this.def = BOSS_DEFS[FIELD_BOSS.byZone[z.id]] || BOSS_DEFS[FIELD_BOSS.fallback];
    const { il, ref } = eventRef(s); this.il = il; this.ref = ref;
    const u = this.boss = makeBoss(def, { ref, partySize: 8, x: a.x, z: a.z, facing: a.facing ?? Math.PI, hpScale: FIELD_BOSS.hpScale, mods: {} });
    u.data.fieldBoss = true;
    const enc = { o: { partySize: 8, hard: false, ref }, bosses: [u], boss: u, def, game: g };
    u.data.encounter = enc; this.enc = enc;
    L.add(u);
    def.onStart?.(enc);
    this.center = { x: a.x, z: a.z };
    u.model?.play?.('intro', { dur: 2.4 });
    g.ui?.banner?.(def.name, { kind: 'boss', sub: def.title, dur: 2.8 });
    g.audio?.stinger?.('boss_intro');
    setTimeout(() => { if (!u.dead && L === this.g.level) { u.ctrl.started = true; g.audio?.music?.('boss'); } }, 2600);
    say(s, simName(Date.now() % 997), FIELD_BOSS.lines[0]);
    // AI adventurers arrive (two already at the stones, the rest run in)
    const helpers = this.helpers = new RunParty(g, { onDeath: hu => L.after(9, () => { if (hu.dead && !this.done) this.helpers.revive(hu, nearPoint(L, this.center, 12)); }) });
    const seed = Math.floor(Date.now() / 3600e3);
    for (let i = 0; i < FIELD_BOSS.helpers; i++) {
      const delay = i < 2 ? 0 : 2 + i * 2.2;
      L.after(delay, () => {
        if (this.done || L !== this.g.level) return;
        const sim = makeSim(seed * 31 + i * 101);
        const p = i < 2 ? nearPoint(L, this.center, 9) : nearPoint(L, this.center, 22);
        const kit = helpers.addSim(sim, { x: p.x, z: p.z, facing: 0 }, il);
        kit.u.data.eventHelper = true;
        if (i === 3) say(s, sim.name, FIELD_BOSS.lines[1 + Math.floor(Math.random() * 3)]);
      });
    }
    this.offs.push(L.on('damage', ev => { if (ev.tgt === u && ev.src?.kind === 'hero') this.dmg.set(ev.src, (this.dmg.get(ev.src) || 0) + ev.amount); }));
    this.offs.push(L.on('death', ({ unit }) => { if (unit === u) this.win(); }));
    return true;
  }
  update(dt) {
    if (this.g.level !== this.L) return this.dispose();
    this.t += dt;
    if (this.done) { this.leaveT = (this.leaveT || 0) + dt; if (this.leaveT > 24) this.dispose(); return; }
  }
  win() {
    if (this.done) return;
    this.done = true; this.state = 'won';
    const s = this.s, g = this.g, me = g.hero?.u, t = this.t;
    const total = [...this.dmg.values()].reduce((a, b) => a + b, 0) || 1;
    const rows = [...this.dmg.entries()].sort((a, b) => b[1] - a[1]);
    const rank = rows.findIndex(([u]) => u === me) + 1, share = (this.dmg.get(me) || 0) / total;
    const eligible = me && (share >= 0.01 || me.distTo(this.boss) < 40);
    g.ui?.banner?.(`${this.def.name} defeated`, { kind: 'clear', sub: eligible ? `Contribution #${rank || '—'} · ${(share * 100).toFixed(0)}% of the damage · ${fmtTime(t)}` : 'You arrived too late for a share of the spoils', dur: 3.2 });
    g.audio?.stinger?.('raid_clear');
    g.audio?.music?.(g.zone?.env?.music || 'field');
    if (eligible) {
      const r = reward(s, 'fieldboss');
      lootToasts(s, r.rows);
      if (r.notes?.length) for (const n of r.notes) s.ui.toast(n, 'info');
      else s.ui.toast(`Field Boss rewards: ${r.rows.slice(0, 4).map(x => `${x.count} × ${x.name}`).join(', ')}`, 'loot');
      g.fx?.lootBeam?.({ pos: this.boss.pos, grade: 4, dur: 8 });
      emitClear(s, { kind: 'fieldboss', boss: this.def.id }, { cleared: true, time: t });
    }
    this.o.onDone?.(true);
    for (const m of this.helpers?.members || []) { const u = m.kit.u; if (!u.dead) u.model?.play?.(Math.random() < 0.5 ? 'cheer' : 'victory', { dur: 2.4 }); }
    setTimeout(() => say(s, this.helpers?.members?.[0]?.kit.u.name || 'Adventurer', FIELD_BOSS.lines[4 + Math.floor(Math.random() * 2)]), 1500);
    // everyone drifts away after the celebration
    setTimeout(() => { for (const m of this.helpers?.members || []) { const ai = m.ai; if (ai) { const u = m.kit.u; const a = Math.random() * 6.28; ai.update = () => { u.move.x = Math.cos(a) * u.st.speed * 0.7; u.move.z = Math.sin(a) * u.st.speed * 0.7; }; } } }, 9000);
  }
  retreat() {
    if (this.done) return;
    this.done = true; this.state = 'fled';
    const L = this.L, u = this.boss;
    if (L === this.g.level && !u.dead) { L.emit('fx', { unit: u, preset: 'lightning_strike', x: u.pos.x, z: u.pos.z, ev: { r: 4, color: 'lightning' } }); L.remove(u); }
    this.g.ui?.banner?.(`${this.def.name} retreats`, { kind: 'info', sub: 'The event window has closed', dur: 2.6 });
    this.o.onDone?.(false);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const f of this.offs) f(); this.offs = [];
    if (this.g.level === this.L) { for (const m of this.helpers?.members || []) this.L.remove(m.kit.u); if (!this.boss.dead && this.state !== 'fight') this.L.remove(this.boss); }
    this.helpers?.dispose?.();
  }
  bossHud() {
    const b = this.boss; if (!b || b.dead || this.done) return null;
    const me = this.g.hero?.u; if (!me || me.distTo(b) > 45) return null;
    return { name: b.name, title: `${b.data.def.title} · Field Boss`, hp: b.hp, hpMax: b.hpMax, barHp: b.data.barHp, bars: b.data.bars, stagger: b.data.stagger ? { v: b.data.stagger.v, max: b.data.stagger.max, left: b.data.stagger.left } : null, destruction: b.data.destruction && !b.data.destruction.broken ? { v: b.data.destruction.v, max: b.data.destruction.max } : null, enrageLeft: null, counter: (b.data.counterWindow || 0) > 0, groggy: !!b.data.groggy, buffs: b.statuses.map(s => ({ id: s.id, icon: s.icon, name: s.name, left: s.left, debuff: !!s.def.debuff })) };
  }
}

// ================================================================================================ Chaos Gate (instanced)
class ChaosGateMode {
  constructor(s, c) { this.kind = 'chaosgate'; this.s = s; this.g = s.game; this.c = c; this.state = 'intro'; this.t = 0; this.wave = -1; this.kills = 0; this.offs = []; this.introT = 2; }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  anchor(k) { const A = this.g.zone.anchors || {}; return A[k] || A.spawn || { x: 0, z: 10, facing: 0 }; }
  enter() {
    const g = this.g, L = this.L, i = CHAOS_GATE.island;
    const { il, ref } = eventRef(this.s); this.il = il; this.ref = ref;
    this.sp = this.anchor(`stage${i}:spawn`);
    this.points = Object.entries(g.zone.anchors).filter(([k]) => k.startsWith(`s${i}:m`)).map(([, v]) => v);
    const party = this.party = g.party = new RunParty(g, { reviveAt: () => this.sp, onDeath: u => { if (this.party.members.every(m => m.kit.u.dead)) this.finish(false); else if (u !== this.me) L.after(8, () => { if (u.dead && this.state !== 'over') this.party.revive(u, this.sp); }); } });
    party.addLocal(g.hero);
    party.fill(CHAOS_GATE.party, this.sp, il, Math.floor(Date.now() / 1800e3));
    party.bindMeter();
    // three rift tears the waves pour out of
    this.tears = (this.points.length ? this.points : [this.sp]).slice().sort(() => Math.random() - 0.5).slice(0, 3);
    this.tearFx = this.tears.map(p => g.presenter?.call?.('portal', { pos: { x: p.x, y: L.heightAt(p.x, p.z), z: p.z }, color: 'demon', radius: 1.8 }));
    this.offs.push(L.on('death', ({ unit }) => { if (unit.kind === 'mob' || unit.kind === 'boss') this.kills++; if (unit === this.boss) this.finish(true); }));
    g.renderer.grade = { ...g.renderer.grade, saturation: 1.12, gain: [1.1, 0.9, 1.05] };
    g.audio?.music?.('dungeon'); g.audio?.ambience?.('void');
    g.ui?.banner?.('Chaos Gate', { kind: 'zone', sub: `${this.c.where || 'The Rift'} · hold the gate`, dur: 2.6 });
  }
  exit() { for (const f of this.offs) f(); this.offs = []; for (const h of this.tearFx || []) h?.stop?.(); this.party?.dispose?.(); }
  spawnWave(i) {
    const L = this.L, W = CHAOS_GATE.waves[i];
    this.wave = i; this.waveT = 0;
    this.g.ui?.banner?.(`Wave ${i + 1} of ${CHAOS_GATE.waves.length}`, { kind: 'warn', sub: 'Demons pour out of the rift tears' });
    let k = 0;
    for (const [type, n] of W) for (let j = 0; j < n; j++, k++) {
      const p = this.tears[k % this.tears.length];
      const q = nearPoint(L, p, 3);
      L.after(0.15 * k, () => { if (this.state !== 'over') L.add(mobFrom(type, { x: q.x, z: q.z, ref: this.ref, hpMul: CHAOS_GATE.waveHp?.[i] ?? 2 })); });
    }
  }
  spawnBoss() {
    const g = this.g, L = this.L, def = BOSS_DEFS[CHAOS_GATE.boss];
    const bp = this.anchor(`stage${CHAOS_GATE.island}:boss`);
    const u = this.boss = makeBoss(def, { ref: this.ref, partySize: 4, x: bp.x, z: bp.z, facing: bp.facing ?? Math.PI, hpScale: CHAOS_GATE.bossHp, mods: {} });
    const enc = { o: { partySize: 4, hard: false, ref: this.ref }, bosses: [u], boss: u, def, game: g };
    u.data.encounter = enc; this.enc = enc;
    L.add(u); def.onStart?.(enc);
    g.ui?.banner?.(def.name, { kind: 'boss', sub: def.title, dur: 2.6 }); g.audio?.stinger?.('boss_intro'); g.audio?.music?.('boss');
    u.model?.play?.('intro', { dur: 2 });
    L.after(2, () => { u.ctrl.started = true; });
    this.state = 'boss';
  }
  update(dt) {
    const L = this.L, me = this.me; if (!L || !me || this.state === 'over') return;
    this.t += dt;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) { this.state = 'waves'; this.spawnWave(0); } return; }
    if (this.t > CHAOS_GATE.time) return this.finish(false, 'time');
    if (this.state === 'waves') {
      this.waveT += dt;
      const alive = L.units.filter(u => u.kind === 'mob' && !u.dead).length;
      if (alive === 0 && this.waveT > 2) { if (this.wave + 1 < CHAOS_GATE.waves.length) this.spawnWave(this.wave + 1); else { for (const h of this.tearFx || []) h?.stop?.(); this.spawnBoss(); } }
    }
    if (me.dead && me.deadT > 6) this.party.revive(me, this.sp);
  }
  finish(win, why) {
    if (this.state === 'over') return;
    this.state = 'over';
    const s = this.s, g = this.g;
    if (this.boss && !this.boss.dead) this.enc?.def?.onBossDeath?.(this.enc, this.boss);
    g.ui?.banner?.(win ? 'The Chaos Gate is sealed' : why === 'time' ? 'The gate overwhelms you' : 'Party wiped', { kind: win ? 'clear' : 'defeat', sub: fmtTime(this.t), dur: 2.6 });
    let rows = [], cur = {}, notes = [];
    if (win) {
      const r = reward(s, 'chaosgate'); rows = r.rows || []; cur = r.currencies || {}; notes = r.notes || [];
      if (Math.random() < CHAOS_GATE.ticket) { s.account.give(CUBE.ticket, 1); mergeRows(rows, [{ id: CUBE.ticket, name: 'Rift Cube Ticket', count: 1, grade: 3, icon: 'item:key', kind: 'material' }]); }
      emitClear(s, { kind: 'chaosgate', boss: CHAOS_GATE.boss }, { cleared: true, time: this.t });
    }
    const meter = this.party.meterRows(), mine = meter.find(m => m.you);
    setTimeout(() => showResults(s, {
      kind: win ? 'clear' : 'fail', over: 'Chaos Gate', title: win ? 'The Gatekeeper Falls' : 'The Gate Holds', sub: this.c.where ? `Opened in ${this.c.where}` : '',
      rank: !win ? null : this.t < 200 ? 'S' : this.t < 280 ? 'A' : this.t < 360 ? 'B' : 'C', time: this.t,
      stats: [{ label: 'Kills', value: String(this.kills) }, { label: 'Your DPS', value: mine ? Math.round(mine.dps).toLocaleString('en-US') : '—' }, ...(notes.length ? [{ label: 'Note', value: notes[0] }] : [])],
      loot: rows, currencies: cur, retry: false, dps: dpsRows(meter),
    }, win), 2600);
  }
  progressHud() { if (this.state === 'over') return null; if (this.state === 'boss' && this.boss) return { label: 'The Gatekeeper', pct: (1 - this.boss.hp / this.boss.hpMax) * 100 }; const alive = this.L.units.filter(u => u.kind === 'mob' && !u.dead).length, tot = Math.max(1, (CHAOS_GATE.waves[this.wave] || []).reduce((a, w) => a + w[1], 0)); return { label: `Chaos Gate · Wave ${Math.max(1, this.wave + 1)} of ${CHAOS_GATE.waves.length}`, pct: Math.max(0, Math.min(100, (1 - alive / tot) * 100)) }; }
  timerHud() { return this.state === 'over' ? null : { label: 'Gate closes', left: Math.max(0, CHAOS_GATE.time - this.t) }; }
  bossHud() { const b = this.boss; if (!b || b.dead) return null; return { name: b.name, title: b.data.def.title, hp: b.hp, hpMax: b.hpMax, barHp: b.data.barHp, bars: b.data.bars, stagger: b.data.stagger ? { v: b.data.stagger.v, max: b.data.stagger.max, left: b.data.stagger.left } : null, destruction: b.data.destruction && !b.data.destruction.broken ? { v: b.data.destruction.v, max: b.data.destruction.max } : null, enrageLeft: null, counter: (b.data.counterWindow || 0) > 0, groggy: !!b.data.groggy, buffs: [] }; }
  partyHud() { return this.party?.hud(); }
}
async function launchChaosGate(session, c) {
  await loadInstance(session, CHAOS_GATE.zone, { kind: 'dungeon', region: 'Chaos Gate', name: 'The Chaos Gate' });
  const g = session.game, sp = g.zone.anchors[`stage${CHAOS_GATE.island}:spawn`] || g.zone.anchors.spawn || { x: 0, z: 10 };
  spawnLocal(session, sp);
  g.mode = new ChaosGateMode(session, c);
  g.mode.enter();
  session.inWorld();
}
registerContent('chaosgate', launchChaosGate);

// ================================================================================================ Adventure Island (instanced)
class IslandEventMode {
  constructor(s, c) {
    this.kind = 'island_event'; this.s = s; this.g = s.game; this.c = c;
    this.focus = ISLAND_EVENTS[c.focus] ? c.focus : 'gold'; this.cfg = ISLAND_EVENTS[this.focus];
    this.islandId = c.island || null; this.name = c.name || ISLAND_NAMES[this.focus];
    this.state = 'intro'; this.introT = 2.4; this.t = 0; this.n = 0; this.kills = 0; this.offs = []; this.objs = [];
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  enter() {
    const g = this.g, L = this.L, A = g.zone.anchors;
    const { il, ref } = eventRef(this.s); this.il = il; this.ref = ref;
    this.sp = A.spawn || { x: 0, z: 18 };
    this.spots = Object.entries(A).filter(([k]) => k.startsWith('spot:')).map(([, v]) => v);
    const party = this.party = g.party = new RunParty(g, { reviveAt: () => this.sp, onDeath: u => { if (this.party.members.every(m => m.kit.u.dead)) this.finish(false); else if (u !== this.me) L.after(8, () => { if (u.dead && this.state !== 'over') this.party.revive(u, this.sp); }); } });
    party.addLocal(g.hero);
    party.fill(4, this.sp, il, Math.floor(Date.now() / 7200e3));
    party.bindMeter();
    this.offs.push(L.on('death', ({ unit }) => this.onDeath(unit)));
    g.audio?.music?.('sea'); g.audio?.ambience?.('sea');
    g.ui?.banner?.(this.name, { kind: 'zone', sub: `Adventure Island · ${this.cfg.title}`, dur: 3 });
    this.s.ui.chat?.add?.({ channel: 'system', text: `${this.cfg.title}: ${this.cfg.desc}` });
  }
  exit() {
    for (const f of this.offs) f(); this.offs = [];
    for (const o of this.objs) { o.mesh?.removeFromParent(); o.fx?.stop?.(); }
    this.coinMesh?.removeFromParent(); this.party?.dispose?.();
  }
  start() {
    const g = this.g, L = this.L, cfg = this.cfg;
    this.state = 'objective';
    if (cfg.type === 'collect') this.makeCoins();
    else if (cfg.type === 'destroy') { for (const p of this.pick(cfg.need, 7)) { const c = mobFrom('wisp', { x: p.x, z: p.z, ref: this.ref }); c.type = 'rift_crystal'; c.name = 'Mirror Crystal'; c.data.tpl = { model: 'rift_crystal' }; c.data.crystal = true; c.data.immovable = true; c.data.flinch = false; c.ctrl = null; c.hpMax = c.st.hpMax = Math.round(this.ref.ap * 40); c.hp = c.hpMax; c.radius = 0.9; c.height = 2.4; L.add(c); this.objs.push({ unit: c }); } }
    else if (cfg.type === 'channel') this.makeShrines();
    else if (cfg.type === 'catch') { for (const p of this.pick(cfg.need, 6)) { const u = mobFrom('gilded_imp', { x: p.x, z: p.z, ref: this.ref, escape: 1e9, name: 'Runaway Pip', team: 2 }); u.type = 'pip'; u.data.tpl = { ...u.data.tpl, model: 'pip' }; u.radius = 0.4; u.height = 0.8; u.st.speed = 4.9; u.untargetable = true; u.data.pip = true; L.add(u); this.objs.push({ unit: u }); } }
    this.mobT = 2;
  }
  pick(n, minSep = 5) { const out = [], pool = this.spots.slice().sort(() => Math.random() - 0.5); for (const p of pool) { if (out.length >= n) break; if (Math.hypot(p.x - this.sp.x, p.z - this.sp.z) < 7 || out.some(q => Math.hypot(q.x - p.x, q.z - p.z) < minSep)) continue; out.push(p); } while (out.length < n) out.push(nearPoint(this.L, { x: 0, z: 0 }, 16)); return out; }
  makeCoins() {
    const L = this.L;
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.3, 0.7) });
    const mesh = this.coinMesh = new THREE.InstancedMesh(geo, mat, 14); mesh.frustumCulled = false;
    this.g.zone.root.add(mesh);
    this.coins = [];
    for (let i = 0; i < 14; i++) this.coins.push(this.newCoin());
    this.dummy = new THREE.Object3D();
    void L;
  }
  newCoin() { const p = nearPoint(this.L, { x: 0, z: -2 }, 20); return { x: p.x, z: p.z, ph: Math.random() * 6.28, on: true }; }
  makeShrines() {
    const L = this.L, A = this.g.zone.anchors;
    for (let i = 1; i <= this.cfg.need; i++) {
      const a = A[`shrine:${i}`] || nearPoint(L, { x: 0, z: 0 }, 15);
      const kit = new Kit({ seed: i }), grp = new THREE.Group();
      kit.add('stone', cyl(0.5, 0.62, 0.5, 8, 1), M(0, 0.25, 0), { tint: 0xd8d0c4 });
      kit.add('stone', cyl(0.14, 0.18, 1.6, 6, 1), M(0, 1.2, 0), { tint: 0xc8c0b4 });
      kit.add('metal', box(0.46, 0.5, 0.46, 1), M(0, 2.2, 0), { tint: 0x3a3430 });
      kit.build(grp);
      const y = L.heightAt(a.x, a.z); grp.position.set(a.x, y, a.z);
      this.g.zone.root.add(grp);
      this.objs.push({ shrine: true, x: a.x, z: a.z, y, mesh: grp, lit: false, prog: 0 });
    }
  }
  onDeath(u) {
    if (this.state === 'over') return;
    if (u.kind === 'mob' || u.kind === 'boss') this.kills++;
    if (u === this.boss) return this.finish(true);
    if (this.state === 'objective' && this.cfg.type === 'destroy' && u.data.crystal) { this.n++; this.L.emit('fx', { unit: u, preset: 'crystal_shatter', x: u.pos.x, z: u.pos.z }); this.bump(); }
  }
  bump() {
    this.g.audio?.sfx?.('loot_drop', {});
    if (this.n >= this.cfg.need) this.objectiveDone();
  }
  objectiveDone() {
    if (this.state !== 'objective') return;
    const g = this.g, L = this.L, b = this.cfg.boss;
    this.coinMesh && (this.coinMesh.visible = false);
    if (!b) return this.finish(true);
    this.state = 'boss';
    const bp = g.zone.anchors.boss || { x: 0, z: -6 };
    const tpl = mobTemplate(b.type);
    const u = this.boss = mobFrom(b.type, { x: bp.x, z: bp.z, ref: this.ref, elite: true, scale: b.scale, name: b.name, hpMul: b.hp * 100 / (tpl.hp * (tpl.elite ? 1 : 4)), atkMul: 1.3, poiseMul: 2 });
    u.superArmor = u.baseSuperArmor = 1;
    L.add(u);
    g.ui?.banner?.(b.name, { kind: 'boss', sub: `${this.name} · the island’s guardian`, dur: 2.6 });
    g.audio?.stinger?.('boss_intro');
    g.presenter?.call?.('portal', { pos: { x: bp.x, y: L.heightAt(bp.x, bp.z), z: bp.z }, color: 'gold', dur: 1.6 });
  }
  update(dt) {
    const g = this.g, L = this.L, me = this.me; if (!L || !me || this.state === 'over') return;
    this.t += dt;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) this.start(); return; }
    if (this.t > this.cfg.time + (this.state === 'boss' ? 90 : 0)) return this.finish(false, 'time');
    const cfg = this.cfg;
    // harassing mobs
    this.mobT -= dt;
    if (cfg.mobs.length && this.mobT <= 0) {
      this.mobT = cfg.type === 'survive' ? 3.2 : 6;
      const alive = L.units.filter(u => u.kind === 'mob' && !u.dead && !u.data.crystal && !u.data.pip).length;
      const cap = cfg.type === 'survive' ? 14 : 7;
      if (alive < cap) { const p = nearPoint(L, { x: 0, z: -4 }, 18); for (let i = 0; i < (cfg.type === 'survive' ? 4 : 2); i++) { const q = nearPoint(L, p, 3); L.add(mobFrom(weighted({ next: Math.random }, cfg.mobs), { x: q.x, z: q.z, ref: this.ref, hpMul: 1.3 })); } }
    }
    if (this.state === 'objective') {
      if (cfg.type === 'collect') this.updateCoins(dt);
      else if (cfg.type === 'channel') this.updateShrines(dt);
      else if (cfg.type === 'survive') { this.n = Math.floor(this.t - 2.4); if (this.n >= cfg.need) this.objectiveDone(); }
      else if (cfg.type === 'catch') {
        for (const o of this.objs) { const u = o.unit; if (!u || u.dead || o.caught) continue; if (this.party.members.some(m => !m.kit.u.dead && m.kit.u.distTo(u) < 1.5)) { o.caught = true; u.dead = true; u.hp = 0; L.emit('fx', { unit: u, preset: 'burst', x: u.pos.x, z: u.pos.z, ev: { color: 'green' } }); g.audio?.sfx?.('pip_cheer', { pos: u.pos }); L.remove(u); this.n++; g.ui?.toast?.(`Pip caught! (${this.n}/${cfg.need})`, 'success'); this.bump(); } }
      }
    }
    if (me.dead && me.deadT > 6) this.party.revive(me, this.sp);
  }
  updateCoins(dt) {
    const mesh = this.coinMesh; if (!mesh) return;
    const d = this.dummy, L = this.L, tt = this.t;
    const heroes = this.party.members.map(m => m.kit.u).filter(u => !u.dead);
    this.coins.forEach((c, i) => {
      if (c.on && heroes.some(h => Math.hypot(h.pos.x - c.x, h.pos.z - c.z) < 1.4)) {
        c.on = false; this.n++;
        this.g.fx?.pickup?.({ pos: { x: c.x, y: L.heightAt(c.x, c.z) + 0.8, z: c.z }, kind: 'gold', to: this.me?.model?.root });
        this.g.audio?.sfx?.('coin', {});
        if (this.n >= this.cfg.need) { this.objectiveDone(); return; }
        if (this.n + this.coins.filter(x => x.on).length < this.cfg.need) setTimeout(() => { if (this.state === 'objective') this.coins[i] = this.newCoin(); }, 1500);
      }
      if (c.on && Math.random() < dt * 0.6) this.g.fx?.burst?.({ pos: { x: c.x, y: L.heightAt(c.x, c.z) + 0.8, z: c.z }, color: 'gold', count: 6, speed: 1.5, size: 0.14, life: 0.6, kind: 'star' });
      d.position.set(c.x, L.heightAt(c.x, c.z) + 0.85 + Math.sin(tt * 3 + c.ph) * 0.14, c.z);
      d.rotation.set(0, tt * 2.4 + c.ph, 0);
      d.scale.setScalar(c.on ? 1 : 0.001);
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  updateShrines(dt) {
    const me = this.me, g = this.g;
    this.channel = null;
    for (const o of this.objs) {
      if (!o.shrine || o.lit) continue;
      if (!me.dead && Math.hypot(me.pos.x - o.x, me.pos.z - o.z) < 2) {
        o.prog += dt; this.channel = o;
        if (o.prog >= this.cfg.channel) {
          o.lit = true; this.n++;
          o.fx = g.fx?.play?.('brazier', { pos: { x: o.x, y: o.y + 2.2, z: o.z }, x: o.x, z: o.z, scale: 0.5 });
          o.mesh.traverse(m => { if (m.isMesh && m.material?.emissive) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffa040); m.material.emissiveIntensity = 3; } });
          g.audio?.sfx?.('fire', { pos: me.pos });
          g.ui?.toast?.(`Lantern lit (${this.n}/${this.cfg.need})`, 'success');
          this.bump();
        }
      } else o.prog = Math.max(0, o.prog - dt * 0.5);
    }
  }
  finish(win, why) {
    if (this.state === 'over') return;
    this.state = 'over';
    const s = this.s, g = this.g;
    g.ui?.banner?.(win ? `${this.cfg.title} complete!` : why === 'time' ? 'The tide turns against you' : 'Party wiped', { kind: win ? 'clear' : 'defeat', sub: this.name, dur: 2.6 });
    let rows = [], cur = {}, notes = [];
    if (win) { const r = reward(s, 'island', { island: this.islandId, focus: this.focus }); rows = r.rows || []; cur = r.currencies || {}; notes = r.notes || []; emitClear(s, { kind: 'island', island: this.islandId || this.focus }, { cleared: true, time: this.t }); }
    const meter = this.party.meterRows();
    setTimeout(() => showResults(s, {
      kind: win ? 'clear' : 'fail', over: 'Adventure Island', title: this.name, sub: this.cfg.title,
      rank: !win ? null : this.t < this.cfg.time * 0.55 ? 'S' : this.t < this.cfg.time * 0.75 ? 'A' : 'B', time: this.t,
      stats: [{ label: 'Objective', value: `${Math.min(this.n, this.cfg.need)} / ${this.cfg.need}` }, { label: 'Kills', value: String(this.kills) }, ...(notes.length ? [{ label: 'Note', value: notes[0] }] : [])],
      loot: rows, currencies: cur, retry: false, dps: dpsRows(meter),
    }, win), 2600);
  }
  progressHud() {
    if (this.state === 'over' || this.state === 'intro') return null;
    if (this.state === 'boss') return null;
    return { label: `${this.cfg.title} · ${Math.min(this.n, this.cfg.need)} / ${this.cfg.need}${this.cfg.type === 'survive' ? ' s' : ''}`, pct: Math.min(100, this.n / this.cfg.need * 100) };
  }
  timerHud() { return this.state === 'over' ? null : { label: 'Time left', left: Math.max(0, this.cfg.time + (this.state === 'boss' ? 90 : 0) - this.t) }; }
  bossHud() { const b = this.boss; if (!b || b.dead) return null; return { name: b.name, title: this.name, hp: b.hp, hpMax: b.hpMax, barHp: b.hpMax / 30, bars: 30, stagger: null, destruction: null, enrageLeft: null, counter: false }; }
  partyHud() { return this.party?.hud(); }
  questHud() { return { id: 'island', title: `Adventure Island — ${this.name}`, kind: 'event', steps: [{ text: this.cfg.desc, n: Math.min(this.n, this.cfg.need), need: this.cfg.need, done: this.state === 'boss' }, ...(this.cfg.boss ? [{ text: `Defeat ${this.cfg.boss.name}`, n: this.boss?.dead ? 1 : 0, need: 1, done: !!this.boss?.dead }] : [])] }; }
}
async function launchIsland(session, c) {
  const w = S.tasks.eventWindow('island');
  const focus = ISLAND_EVENTS[c.focus] ? c.focus : w?.island?.focus || 'gold';
  const sched = w?.island?.focus === focus ? w.island : null;
  const island = c.island || sched?.id || null, name = sched?.name || ISLAND_NAMES[focus];
  await loadInstance(session, `event_isle_${ISLAND_EVENTS[focus] ? focus : 'gold'}`, { kind: 'arena', region: 'Adventure Island', name });
  const g = session.game;
  spawnLocal(session, g.zone.anchors.spawn);
  g.mode = new IslandEventMode(session, { ...c, focus, island, name });
  g.mode.enter();
  session.inWorld();
}
registerContent('adventure_island', launchIsland);

// ================================================================================================ the schedule plugin
const PLUGIN = {
  id: 'modes:events',
  init(session) {
    this.s = session; this.warned = new Set(); this.announced = new Set(); this.forced = {}; this.done = new Set(); this.t = 0; this.gate = null; this.fb = null;
    window.__modes ||= {}; window.__modes.events = this;
    // compass: keep the systems provider (if any) and add travel on "Go"
    const prev = WINDOWS.compass;
    registerWindow('compass', s => this.compassData(s, prev));
    registerAction('compass:go', (s, type, p) => { this.go(p.id); return true; });
    registerAction('hud:compass', s => { s.menu('compass'); return true; });
    if (!ACTIONS['compass:']) registerAction('compass:', () => true);
    // ?event=fieldboss|chaosgate|island forces an event once you are in the world
    if (Q.event) session.bus.on('zone', () => { if (this.qDone) return; this.qDone = true; setTimeout(() => this.force(Q.event), 1200); });
    session.bus.on('zone', () => { this.gateFx?.stop?.(); this.gateFx = null; this.gate = null; this.fb?.dispose?.(); this.fb = null; });
  },
  live(kind) { return !!S.tasks.eventWindow(kind)?.live || (this.forced[kind] || 0) > Date.now(); },
  where(kind) { const w = S.tasks.eventWindow(kind); return ZONE_BY_NAME[w?.where] || 'goldmeadow'; },
  windowKey(kind) { const w = S.tasks.eventWindow(kind); return `${kind}:${w?.live ? w.start : this.forced[kind] || 0}`; },
  /** force an event now (testing / ?event=) */
  force(kind) {
    const s = this.s; if (!s?.char) return;
    kind = kind === 'island' || kind === 'adventure' ? 'island' : kind === 'gate' ? 'chaosgate' : kind;
    if (!['fieldboss', 'chaosgate', 'island'].includes(kind)) { s.ui.toast(`Unknown event "${kind}".`, 'error'); return; }
    this.forced[kind] = Date.now() + 10 * MIN;
    s.ui.toast(`Event forced: ${EVENTS[kind]?.name || kind}.`, 'info');
    this.go(kind, true);
  },
  async go(kind, forced = false) {
    const s = this.s, g = s.game, mk = g.mode?.kind;
    if (!s.char || s.guestMode) return;
    if (mk && !OPEN.has(mk)) { s.ui.toast('Finish what you are doing first.', 'warn'); return; }
    const w = S.tasks.eventWindow(kind), live = this.live(kind);
    if (kind === 'island') {
      if (!live) { s.ui.toast(`${w?.name || 'Adventure Island'} begins in ${Math.ceil((w?.left || 0) / MIN)} min.`, 'info'); return; }
      return s.launch({ kind: 'adventure_island', forced });
    }
    if (kind === 'ghostship') { s.ui.toast('The Ghost Ship haunts the Glass Sea — set sail from the harbour.', 'info'); return; }
    const to = forced && FIELDS_WITH_EVENTS.includes(g.zone?.id) ? g.zone.id : this.where(kind);
    if (!live) s.ui.toast(`${w?.name || kind} begins in ${Math.ceil((w?.left || 0) / MIN)} min in ${w?.where || 'the fields'}.`, 'info');
    if (g.zone?.id === to) { s.ui.toast(kind === 'fieldboss' ? 'The field boss appears at the standing stones.' : 'The Chaos Gate opens nearby — look for the rift.', 'info'); return; }
    if (typeof FIELD.travel === 'function') await FIELD.travel(s, to, {});
    else s.ui.toast('The roads to the fields are not open yet.', 'warn');
  },
  update(dt) {
    const s = this.s, g = s.game;
    this.fb?.update(dt);
    if (this.fb?.disposed) this.fb = null;
    this.t -= dt; if (this.t > 0) return; this.t = 1;
    if (!s.char || s.screen !== 'game') return;
    const now = Date.now();
    // warnings & live chatter
    let cal = [];
    try { cal = S.tasks.calendar(now, { hours: 1 }); } catch { cal = []; }
    for (const e of cal) {
      if (!e.live && e.left <= WARN_MIN * MIN && e.left > 0 && !this.warned.has(e.id)) {
        this.warned.add(e.id);
        const m = Math.max(1, Math.ceil(e.left / MIN));
        s.ui.toast(`${e.name} begins in ${m} min${e.where ? ` — ${e.where}` : ''}. (H: Event Compass)`, 'info');
        s.ui.chat?.add?.({ channel: 'system', text: `${e.name} begins in ${m} minute${m > 1 ? 's' : ''}${e.where ? ` in ${e.where}` : ''}.` });
      }
      if (e.live && !this.announced.has(e.id)) {
        this.announced.add(e.id);
        const line = e.kind === 'fieldboss' ? FIELD_BOSS.lines[Math.floor(Math.random() * 3)] : e.kind === 'chaosgate' ? CHAOS_GATE.lines[Math.floor(Math.random() * 2)] : e.kind === 'island' ? `${e.island?.name || 'the island'} is up, ${e.island?.focus || 'gold'} island!!` : 'ghost ship spotted, bring cannons';
        say(s, simName(e.start % 9973), line);
      }
    }
    // field boss & chaos gate in the fields
    if (!inField(s) || g.zone?.fallbackLayout && !g.zone.anchors?.fieldboss) return;
    const here = g.zone.id;
    const fbLive = this.live('fieldboss'), fbKey = this.windowKey('fieldboss');
    const fbHere = (this.forced.fieldboss || 0) > now || this.where('fieldboss') === here;
    if (fbLive && fbHere && !this.fb && !this.done.has(fbKey)) {
      this.fb = new FieldBoss(s, { onDone: () => this.done.add(fbKey) });
      if (!this.fb.spawn()) this.fb = null;
    } else if (this.fb && !this.fb.done && !fbLive) this.fb.retreat();
    const cgLive = this.live('chaosgate'), cgHere = (this.forced.chaosgate || 0) > now || this.where('chaosgate') === here;
    if (cgLive && cgHere && !this.gate) {
      const a = g.zone.anchors.chaosgate; if (a) {
        this.gate = { x: a.x, z: a.z, zone: here };
        this.gateFx = g.presenter?.call?.('portal', { pos: { x: a.x, y: g.level.heightAt(a.x, a.z), z: a.z }, color: 'demon', radius: 2.6 });
        s.ui.toast('A Chaos Gate has torn open nearby!', 'warn');
      }
    } else if (this.gate && !cgLive) { this.gateFx?.stop?.(); this.gateFx = null; this.gate = null; }
  },
  interactable() {
    const g = this.s?.game, me = g?.hero?.u; if (!me || !this.gate || g.zone?.id !== this.gate.zone) return null;
    return Math.hypot(me.pos.x - this.gate.x, me.pos.z - this.gate.z) < 3.2 ? { name: 'Chaos Gate', portal: 'modes:chaosgate', modesGate: true } : null;
  },
  interact(t) {
    if (!t?.modesGate) return false;
    const s = this.s, w = S.tasks.eventWindow('chaosgate');
    (async () => {
      const ok = AUTO || await s.ui.confirm({ title: 'Chaos Gate', text: `Step through the rift with three adventurers? Waves of demons, then the Gatekeeper. Rewards once per gate (item level ${CHAOS_GATE.minIlvl}+).`, ok: 'Enter the gate', cancel: 'Not yet' });
      if (ok) s.launch({ kind: 'chaosgate', from: s.game.zone?.id, where: w?.where || s.game.zone?.name });
    })();
    return true;
  },
  hud(h) {
    const fb = this.fb; if (!fb || fb.done) return;
    const b = fb.bossHud(); if (b && !h.boss) h.boss = b;
    const w = S.tasks.eventWindow('fieldboss');
    if (b && !h.timer) h.timer = { label: 'Field Boss', left: Math.max(0, ((w?.live ? w.end : this.forced.fieldboss) - Date.now()) / 1000) };
  },
  compassData(s, prev) {
    let d = null;
    try { d = prev ? prev(s) : null; } catch (e) { console.error('[compass]', e); }
    if (!d) d = ownCompass();
    for (const e of d.events || []) {
      const kind = e.id;
      if (kind === 'fieldboss' && this.fb && !this.fb.done) e.where = `${e.where || ''} · ${this.fb.def.name} ${Math.round(this.fb.boss.hp / this.fb.boss.hpMax * 100)}%`;
      if ((this.forced[kind] || 0) > Date.now()) { e.active = true; e.left = Math.round((this.forced[kind] - Date.now()) / 1000); }
    }
    return d;
  },
};
/** compass data when the systems plugin is not present */
function ownCompass() {
  const now = Date.now(), d = new Date(now), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = S.tasks.calendar(mid, { hours: 24 });
  const KIND = { fieldboss: 'field_boss', chaosgate: 'chaos_gate', island: 'adventure_island', ghostship: 'ghost_ship' };
  return { events: Object.keys(EVENTS).map(kind => { const w = S.tasks.eventWindow(kind, now); return { id: kind, name: w?.name || EVENTS[kind].name, kind: KIND[kind], where: w?.where || '', times: day.filter(e => e.kind === kind).map(e => Math.round((e.start - mid) / MIN)), dur: EVENTS[kind].dur, active: !!w?.live, left: w?.live ? Math.round(w.left / 1000) : undefined, next: w && !w.live ? Math.round(w.left / 1000) : undefined }; }), tracked: [] };
}
registerPlugin(PLUGIN);
