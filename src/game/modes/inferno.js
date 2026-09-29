// Inferno Descent — a roguelite of 100 floors under the world: mob hordes, elite hunts, rift pylons, endurance rounds,
// named champions, a Gilded Imp to catch, and a real boss every 10th floor (normalised HP). A boon (1 of 3) after
// every 5th floor, Ember Keys for Cinder Chests, a floor timer (then the Inferno rises), death ends the run.
// Records in roster.records.inferno. Also: the shared instance helpers used by every modes file (pvp, events, trial,
// cube, stronghold) and the Rift Nexus entries (Inferno Descent, Trial Guardian, Rift Cube).
import * as THREE from 'three';
import { registerPlugin, registerContent, PLUGINS } from '../registry.js';
import { buildZone, ZONES } from '../providers.js';
import { heroStats, itemLevel } from '../systems/stats.js';
import * as S from '../systems/index.js';
import { Unit } from '../unit.js';
import { MobAI, refFor } from '../ai/mob.js';
import { makeBoss } from '../ai/boss.js';
import { AllyAI } from '../ai/ally.js';
import { Party } from '../party.js';
import { applyStatus, removeStatus, dealDamage, heal, eff, addShield, kill } from '../combat.js';
import { MOBS } from '../../data/mobs.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { CLASSES } from '../../data/classes/index.js';
import { INFERNO, FLOOR_KINDS, BOSS_FLOORS, INFERNO_MOBS, BOONS, BOON_BY_ID, RARITY, MODIFIERS, HUNTERS, bandOf, themeOf, floorHp, floorAtk, bossHpAp, partyHp, TRIAL, AFFIXES, CUBE } from '../../data/inferno.js';
import { RNG } from '../../core/noise.js';
import { weekId } from '../../core/util.js';
import { Kit, M, box, cyl } from '../../world/kit.js';
import { boulder, spike, crystal } from '../../world/cliffs.js';
import * as SH from '../../world/shapes.js';
import { trialState } from './trial.js';
import { cubeState } from './cube.js';

const Q = typeof location !== 'undefined' ? Object.fromEntries(new URLSearchParams(location.search)) : {};
/** ?auto=1: the AI plays your hero in modes content and dialogs pick automatically (headless testing). */
export const AUTO = Q.auto === '1' || Q.auto === 'true';

// ================================================================================================ shared helpers
export { S };
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function gearTier(c) { const s = c?.equip?.chest?.set || c?.equip?.weapon?.set; return s === 'horned' ? 2 : s === 'vanguard' ? 1 : 0; }
export const TIPS = ['Space stands you up when you are knocked down — with a moment of invulnerability.', 'Boons stack. Two Ember Furies are better than one.', 'Ember Keys drop from champions. Cinder Chests will not open without one.', 'The fire gate opens when the floor is purged. Step in to descend, or press G to leave with your spoils.'];

/** Build a zone like session.loadZone, but with a seed (Inferno floors re-roll their layout) and a custom name. */
export async function loadInstance(session, id, o = {}) {
  const g = session.game;
  session.ui.screen('loading', { zone: o.name || ZONES[id]?.name || id, region: o.region, kind: o.kind || ZONES[id]?.kind || 'dungeon', pct: 5, tip: o.tip || TIPS[Math.floor(Math.random() * TIPS.length)] });
  const t0 = performance.now();
  const zone = await buildZone(id, { quality: g.renderer.quality, seed: o.seed, onProgress: f => session.ui.screen('loading', { pct: 5 + f * 85 }) });
  zone.name = o.name || zone.name || ZONES[id]?.name || id; zone.id = id;
  g.setZone(zone);
  session.relayLevel?.(g.level);
  session.ui.screen('loading', { pct: 100 });
  if (performance.now() - t0 < 350) await new Promise(r => setTimeout(r, 200));
  return zone;
}

/** A normalised copy of a character record: fixed item level, skills at least `skillLv` (tripods keep your picks). */
export function normalChar(c, { ilvl = 1415, skillLv = 10, quality = 70, engr = true } = {}) {
  const K = CLASSES[c.cls] || CLASSES.reaver;
  const skills = {};
  for (const s of K.skills) {
    const cur = c.skills?.[s.id] || { lv: 1, tri: [-1, -1, -1] };
    const lv = Math.max(cur.lv || 1, skillLv);
    skills[s.id] = { lv, tri: [0, 1, 2].map(i => lv >= [4, 7, 10][i] ? (cur.tri?.[i] >= 0 ? cur.tri[i] : 0) : -1) };
  }
  const equip = {};
  for (const sl of ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves']) equip[sl] = { iLvl: ilvl, quality: Math.max(quality, c.equip?.[sl]?.quality ?? 0) };
  return { ...c, level: Math.max(c.level || 1, 50), skills, equip, books: engr ? (c.books || []) : [], engr: engr ? (c.engr || []) : [], gems: [] };
}

/** Spawn the local player's hero (optionally with a normalised record / fixed stats / a battle-item kit). */
export function spawnLocal(session, at, { char, stats, items } = {}) {
  const g = session.game, c0 = session.heroChar ? session.heroChar(session.char) : session.char;
  const c = char || c0;
  const st = stats || heroStats(c, { rosterLevel: session.account.roster.level });
  const tier = gearTier(c0);
  const kit = g.spawnHero({ ...c, gear: { tier }, weapon: { tier, hone: c0.equip?.weapon?.hone || 0 } }, st, at || g.zone?.anchors?.spawn || { x: 0, z: 0 });
  kit.items = items ? items.map(it => ({ id: it.id, count: it.count, cd: 0 })) : (c0.items || []).map(it => ({ id: it.id, count: Math.min(it.count, session.account.count(it.id) || it.count), cd: 0 }));
  kit.u.data.title = c0.title;
  g.player?.setMoveButton?.(session.account.settings.moveButton || 'right');
  if (AUTO) { g.player.input = () => {}; kit.u.ctrl = new AllyAI(kit, 'tryhard'); }
  return kit;
}

export const mobTemplate = type => MOBS[type] || INFERNO_MOBS[type] || null;
/** makeMob for any template (src/data/mobs.js, Inferno extras, named field foes); o.scale scales the body. */
export function mobFrom(type, o = {}) {
  const tpl = o.tpl || mobTemplate(type); if (!tpl) throw new Error('no mob template ' + type);
  const ref = o.ref || refFor(1415);
  const elite = o.elite ?? tpl.elite ?? false;
  const hpMul = (o.hpMul ?? 1) * (elite && !tpl.elite ? 4 : 1);
  const bs = o.scale || 1;
  const u = new Unit({
    kind: 'mob', team: o.team ?? 1, type: tpl.model && !MOBS[type] && !INFERNO_MOBS[type] ? tpl.model : type, name: o.name || tpl.name, level: 60,
    x: o.x, z: o.z, facing: o.facing ?? Math.random() * 6.28, radius: tpl.radius * bs, height: tpl.height * bs, mass: tpl.mass,
    stats: { hpMax: Math.max(1, Math.round(tpl.hp * ref.ap * hpMul)), atk: tpl.atk * ref.hp / 0.55 * (o.atkMul ?? 1), def: 3000, speed: tpl.speed * (o.speedMul ?? 1), mpMax: 0, mpRegen: 0, crit: 0.05 },
    superArmor: tpl.superArmor || 0,
  });
  u.data.elite = elite; u.data.tpl = tpl; u.data.xp = (tpl.xp || 5) * (elite ? 3 : 1); u.data.scale = (tpl.scale || 1) * bs;
  if (tpl.poise) u.data.poise = tpl.poise * (o.poiseMul ?? 1);
  u.ctrl = tpl.flee ? new FleeAI(u, o) : new MobAI(u, tpl, { alert: o.alert ?? true, delay: o.delay });
  return u;
}

/** A treasure runner: keeps away from heroes, zig-zagging between far points; escapes after o.escape seconds. */
class FleeAI {
  constructor(u, o = {}) { this.u = u; this.t = 0; this.pickT = 0; this.goal = null; this.escape = o.escape ?? 25; this.onEscape = o.onEscape; }
  update(dt, L) {
    const u = this.u; u.move.x = u.move.z = 0;
    this.t += dt; this.pickT -= dt;
    if (this.t > this.escape) { if (!u.dead) { L.emit('fx', { unit: u, preset: 'portal_flash', x: u.pos.x, z: u.pos.z, ev: { color: 'gold' } }); u.hp = 0; u.dead = true; u.data.escaped = true; L.remove(u); this.onEscape?.(u); } return; }
    if (u.disabled) return;
    const heroes = L.units.filter(h => h.kind === 'hero' && !h.dead && h.team !== u.team && h.team !== 2);
    if (!heroes.length) return;
    const near = Math.min(...heroes.map(h => h.distTo(u)));
    if (!this.goal || this.pickT <= 0 || Math.hypot(this.goal.x - u.pos.x, this.goal.z - u.pos.z) < 1.2 || near < 3) {
      this.pickT = 1.2 + Math.random();
      let best = null, bs = -1;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 9, x = u.pos.x + Math.cos(a) * r, z = u.pos.z + Math.sin(a) * r;
        if (!L.nav.ok(x, z)) continue;
        const d = Math.min(...heroes.map(h => Math.hypot(h.pos.x - x, h.pos.z - z)));
        if (d > bs) { bs = d; best = { x, z }; }
      }
      this.goal = best;
      if (Math.random() < 0.35) L.emit('fx', { unit: u, preset: 'burst', x: u.pos.x, z: u.pos.z, ev: { color: 'gold' } });
    }
    if (!this.goal) return;
    const dx = this.goal.x - u.pos.x, dz = this.goal.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
    const sp = u.st.speed * (near < 5 ? 1.12 : 0.9);
    u.move.x = dx / d * sp; u.move.z = dz / d * sp;
  }
}

/** A Party whose members do not revive on their own; hooks decide (Inferno: death ends the run; PvP: respawns). */
export class RunParty extends Party {
  constructor(game, hooks = {}) { super(game); this.hooks = hooks; }
  onDeath(u) { this.hooks.onDeath?.(u); }
  revive(u, at) {
    if (this.hooks.canRevive && !this.hooks.canRevive(u)) { if (u === this.game.hero?.u && this.hooks.noRevive) this.game.ui?.toast?.(this.hooks.noRevive, 'warn'); return; }
    super.revive(u, at || this.hooks.reviveAt?.(u));
    this.hooks.onRevive?.(u);
  }
}

/** merge LootResult rows into an accumulator list (stackables by id; unique items stay separate) */
export function mergeRows(into, rows = []) {
  for (const r of rows) {
    if (!r || r.uid || r.item) { into.push(r); continue; }
    const e = into.find(x => x.id === r.id && !x.uid && !x.item);
    if (e) e.count = (e.count || 0) + (r.count || 0); else into.push({ ...r });
  }
  return into;
}
export function addCurrencies(cur, c = {}) { for (const k of Object.keys(c)) cur[k] = (cur[k] || 0) + (c[k] || 0); return cur; }

/** Fixed %-max-HP damage to the heroes of `team` in a circle (hazards the world deals). */
export function hurtHeroes(L, x, z, r, pct, o = {}) {
  const out = [];
  for (const h of L.units) {
    if (h.kind !== 'hero' || h.dead || h.team === 2 || (o.team != null && h.team !== o.team) || h.untargetable) continue;
    if (Math.hypot(h.pos.x - x, h.pos.z - z) > r + h.radius) continue;
    const ev = dealDamage(L, o.src || null, h, 0, { fixed: Math.max(1, Math.round(h.hpMax * pct)), skill: o.skill || 'hazard', kind: 'hazard', dot: !!o.dot });
    if (ev) out.push(ev);
    if (o.knock && !h.dead && h.superArmor < 1) { h.cc.down = Math.max(h.cc.down, 0.9); L.emit('knock', { tgt: h, knock: 'down' }); }
  }
  return out;
}
/** invisible telegraph the AI treats as about to detonate while it lives (lava pools, danger zones) */
export function aiMarker(L, { x, z, r, dur = 5, team = 1 }) {
  const tg = { shape: 'circle', r, x, z, dx: 0, dz: -1, dur: 1e6, t: 1e6 - 0.4, color: 'red', owner: null, team, alive: true, hidden: true };
  L.telegraphs.push(tg);
  const end = L.time + dur;
  const tm = L.every(0.1, () => { if (!tg.alive || L.time >= end) { tg.alive = false; L.cancelTimer(tm); return; } tg.t = tg.dur - 0.4; });
  return tg;
}
/** a lingering pool: draws its zone FX, hurts heroes inside every tick, and the AI steps out of it */
export function lavaPool(L, { x, z, r = 2.6, dur = 5, pct = 0.02, tick = 0.5, kind = 'lava', team } = {}) {
  const mk = aiMarker(L, { x, z, r, dur });
  return L.groundZone({ src: null, x, z, r, dur, tick, first: 0.35, kind, onTick: () => hurtHeroes(L, x, z, r, pct, { dot: true, team }), onEnd: () => { mk.alive = false; } });
}
/** telegraphed eruption: orange circle → burst → optional pool */
export function eruption(L, { x, z, r = 2.6, delay = 1.3, pct = 0.09, fx = 'fire_burst', color = 'fire', sfx = 'fire_burst', pool = null, knock = false, team = 0 } = {}) {
  const tg = L.telegraph({ shape: 'circle', x, z, r, dx: 0, dz: -1, dur: delay, color: 'orange', team: 1, owner: null });
  L.after(delay, () => {
    tg.alive = false;
    L.emit('fx', { unit: null, preset: fx, x, z, ev: { r, color } });
    L.emit('sfx', { name: sfx, pos: { x, y: 0, z } });
    hurtHeroes(L, x, z, r, pct, { knock, team });
    if (pool) lavaPool(L, { x, z, r: pool.r ?? r * 0.9, dur: pool.dur ?? 5, pct: pool.pct ?? 0.02, kind: pool.kind || 'lava', team });
  });
  return tg;
}

/** Wayfarer's Tasks / titles / boards tracking for content that runs its own results; toasts the notifications. */
export function track(session, event, data) {
  let notes = [];
  try { notes = S.tasks.track(session.account, session.char, event, data) || []; } catch (e) { console.error('[modes track]', e); }
  notes.forEach((n, i) => setTimeout(() => session.ui.toast(n.text, /title|achievement|board/.test(n.kind) ? 'success' : 'info'), 1200 + i * 700));
  return notes;
}
const systemsHooked = () => PLUGINS.some(p => p.id === 'systems');
/** publish a content clear on the session bus (the systems plugin tracks tasks/boards from it; tracked here if absent) */
export function emitClear(session, content, result) {
  session.bus.emit('clear', { content, result });
  if (!systemsHooked() && result?.cleared) track(session, 'clear', { content: content.kind, id: content.boss || content.island || content.kind, floor: content.floor || result.floor, time: result.time });
}
/** publish a Proving Grounds result on the session bus (tracked by the systems plugin) */
export function emitPvp(session, data) {
  session.bus.emit('pvp', data);
  if (!systemsHooked()) track(session, 'pvp', data);
}
/** results screen + music */
export function showResults(session, data, win = data.kind !== 'fail') {
  session.ui.screen('results', data);
  session.game.audio?.music?.(win ? 'victory' : 'defeat');
}
/** meter rows → results dps table */
export const dpsRows = meter => (meter || []).map(m => ({ name: m.name, cls: m.cls, dmg: m.dmg, dps: m.dps, crit: m.critPct, back: m.backPct, counters: m.counters, stagger: m.stagger, deaths: m.deaths, you: !!m.you, support: CLASSES[m.cls]?.role === 'support' }));
/** pick from [[id, weight], …] */
export function weighted(rng, list) {
  let tot = 0; for (const [, w] of list) tot += w;
  let r = rng.next() * tot; for (const [id, w] of list) { r -= w; if (r <= 0) return id; }
  return list[list.length - 1][0];
}
/** a small treasure chest (world kit materials) */
export function chestMesh(grade = 4) {
  const kit = new Kit({ seed: 11 }), g = new THREE.Group();
  kit.add('planks', box(1.2, 0.62, 0.8), M(0, 0.31, 0), { tint: 0x8a5230 });
  kit.add('planks', cyl(0.4, 0.4, 1.2, 12, 1), M(0, 0.62, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x9a6038 });
  const trim = grade >= 5 ? 'gold' : grade >= 4 ? 'gold' : 'metal';
  kit.add(trim, box(1.26, 0.08, 0.84), M(0, 0.6, 0), { ao: false });
  for (const s of [-1, 1]) kit.add(trim, box(0.1, 0.5, 0.86), M(s * 0.52, 0.33, 0), { ao: false });
  for (const s of [-1, 1]) kit.add(trim, cyl(0.43, 0.43, 0.1, 12, 1), M(s * 0.52, 0.62, 0, 0, 1, 1, 1, 0, Math.PI / 2), { ao: false });
  kit.add(trim, box(0.2, 0.24, 0.08), M(0, 0.55, 0.43), { ao: false });
  kit.build(g);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
/** remove every non-hero unit (mobs, bosses, objects) from a level */
export function clearFoes(L) { for (const u of L.units.slice()) if (u.kind !== 'hero' && u.kind !== 'npc') L.remove(u); }

// ================================================================================================ Inferno Descent
const INF_KEY = 'ember_key';
/** Inferno records (roster-wide) */
export function infernoRecords(account) {
  const r = account.roster.records ||= {};
  const I = r.inferno ||= {};
  I.best ??= 0; I.runs ??= 0; I.fastest ||= {}; I.bestTime ??= null;
  return I;
}

class InfernoRun {
  constructor(session, c) {
    this.kind = 'inferno';
    this.s = session; this.g = session.game; this.c = c;
    this.start = Math.max(1, Math.min(INFERNO.floors, c.start | 0 || 1));
    this.floor = this.start; this.partySize = Math.max(1, Math.min(4, c.party | 0 || 1));
    this.seed = (c.seed ?? (Date.now() % 1e9)) >>> 0; this.rng = new RNG(this.seed);
    this.boons = {}; this.boonOrder = []; this.keys = 0; this.rows = []; this.cur = { silver: 0, gold: 0, xp: 0 };
    this.kills = 0; this.cleared = 0; this.deepest = this.start - 1; this.t = 0; this.floorT = 0;
    this.state = 'loading'; this.segment = -1; this.meterAcc = new Map();
    this.items = INFERNO.items.map(x => ({ ...x }));
    this.awakenUses = null; this.prevKind = null; this.secondUsed = false; this.props = null;
    this.offs = [];
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  // ---------------------------------------------------------------- lifecycle
  async begin() {
    // checkpoint starts: one random boon per 10 floors skipped
    for (let i = 0; i < Math.floor((this.start - 1) / 10); i++) { const b = this.offer(1)[0]; if (b) this.addBoon(b.id, true); }
    await this.enterFloor(this.floor);
  }
  enter() {}
  exit() {
    // leaving the world (song of homeward, logout, results continue): the run is over
    if (this.swapping) return;
    this.unbind();
    if (this.state !== 'over') { this.state = 'over'; this.saveRecords('left'); }
    this.cleanupFloor();
    this.party?.dispose?.();
    if (window.__modes?.inferno === this) window.__modes.inferno = null;
  }
  unbind() { for (const f of this.offs) f(); this.offs = []; }
  async enterFloor(f) {
    const seg = Math.floor((f - 1) / INFERNO.segment);
    if (seg !== this.segment || !this.L) await this.buildSegment(seg, f);
    else this.resetFloor();
    this.startFloor(f);
  }
  /** carry the run over to a freshly built (re-seeded) zone */
  async buildSegment(seg, f) {
    const g = this.g, s = this.s;
    const carry = this.party ? this.party.members.map(m => ({ sim: m.sim, local: m.local, hp: m.kit.u.dead ? 0.3 : m.kit.u.hp / m.kit.u.hpMax })) : null;
    const me = this.party && this.me; if (me) { this.items = this.g.hero.items.map(it => ({ id: it.id, count: it.count })); this.awakenUses = this.g.hero.awakenUses; }
    this.accMeter();
    this.swapping = true; this.unbind(); this.cleanupFloor();
    if (g.mode === this) g.mode = null;
    this.party?.dispose?.(); this.party = null;
    const theme = themeOf(f);
    this.state = 'loading';
    try { await loadInstance(s, 'inferno', { seed: (this.seed + seg * 7919) % 100000 + 1, name: `Inferno Descent`, region: theme.name, kind: 'dungeon' }); }
    finally { this.swapping = false; }
    this.segment = seg;
    const z = g.zone, sp = z.anchors?.spawn || { x: 0, z: 18, facing: 0 };
    this.navBase = g.level.nav.data.slice();
    // heroes: you (normalised) + AI companions
    const nc = normalChar(s.heroChar(s.char), { ilvl: INFERNO.ilvl, skillLv: INFERNO.skillLv });
    this.baseStats = heroStats(nc, { rosterLevel: s.account.roster.level });
    const kit = spawnLocal(s, sp, { char: nc, stats: { ...this.baseStats }, items: this.items });
    if (this.awakenUses != null) kit.awakenUses = this.awakenUses;
    const party = this.party = g.party = new RunParty(g, { onDeath: u => this.onHeroDeath(u), canRevive: () => false, noRevive: 'Death is final in the Inferno.' });
    party.addLocal(kit);
    if (this.partySize > 1) {
      const sims = carry ? carry.filter(m => m.sim).map(m => m.sim) : null;
      if (sims?.length) sims.forEach((sim, i) => party.addSim(sim, { x: sp.x + (i - 1) * 1.6, z: sp.z + 1.5, facing: sp.facing || 0 }, INFERNO.ilvl));
      else party.fill(this.partySize, sp, INFERNO.ilvl, this.seed % 997);
    }
    party.bindMeter();
    if (carry) for (const m of party.members) { const c = carry.find(x => (m.local && x.local) || (m.sim && x.sim === m.sim)); if (c) m.kit.u.hp = Math.max(1, Math.round(m.kit.u.hpMax * Math.max(0.25, c.hp))); }
    this.applyBoons(true);
    if (carry) { const c = carry.find(x => x.local); if (c) kit.u.hp = Math.max(1, Math.round(kit.u.hpMax * Math.max(0.25, c.hp))); }
    this.bind();
    // theme: tint the grade and sky light per depth band
    g.renderer.grade = { ...g.renderer.grade, ...theme.grade };
    if (theme.hemi) g.hemi.color.set(theme.hemi);
    g.mode = this;
    s.inWorld();
    g.audio?.music?.('inferno'); g.audio?.ambience?.('lava');
    if (window.__modes) window.__modes.inferno = this;
  }
  bind() {
    const L = this.L;
    this.offs = [
      L.on('death', ev => this.onDeath(ev)),
      L.on('damage', ev => this.onDamage(ev)),
      L.on('dash', ev => this.onDash(ev)),
      L.on('cheatDeath', ev => this.onCheat(ev)),
    ];
  }
  accMeter() {
    if (!this.party) return;
    for (const r of this.party.meterRows()) {
      const a = this.meterAcc.get(r.name) || { name: r.name, cls: r.cls, dmg: 0, hits: 0, crits: 0, back: 0, counters: 0, stagger: 0, deaths: 0, secs: 0, you: r.you };
      a.dmg += r.dmg; a.hits += r.hits; a.crits += r.crits; a.back += r.back; a.counters += r.counters; a.deaths += r.deaths; a.secs += Math.max(1, this.L.time - this.party.startT);
      this.meterAcc.set(r.name, a);
    }
  }
  meterRows() {
    this.accMeter();
    const rows = [...this.meterAcc.values()].map(a => ({ ...a, dps: a.dmg / Math.max(1, a.secs), critPct: a.hits ? a.crits / a.hits : 0, backPct: a.hits ? a.back / a.hits : 0 }));
    this.meterAcc.clear();
    return rows.sort((a, b) => b.dmg - a.dmg);
  }
  // ---------------------------------------------------------------- floors
  pickKind(f) {
    if (BOSS_FLOORS[f] && BOSS_DEFS[BOSS_FLOORS[f]]) return 'boss';
    if (f === 1) return 'purge';
    const list = Object.entries(FLOOR_KINDS).filter(([id, k]) => f >= k.from && id !== this.prevKind).map(([id, k]) => [id, k.weight]);
    return weighted(this.rng, list);
  }
  pickMods(f, kind) {
    const pool = Object.entries(MODIFIERS).filter(([, m]) => f >= m.from).map(([id]) => id).filter(id => !(kind === 'boss' && (id === 'swarm' || id === 'haunted' || id === 'volatile')));
    let n = f >= 61 ? 2 : f >= 31 ? 1 : f >= 11 ? (this.rng.chance(0.5) ? 1 : 0) : 0;
    if (kind === 'boss') n = Math.min(n, 1);
    const out = []; const p = pool.slice();
    while (out.length < n && p.length) { const i = Math.floor(this.rng.next() * p.length); out.push(p.splice(i, 1)[0]); }
    return out;
  }
  resetFloor() {
    const L = this.L;
    this.cleanupFloor();
    clearFoes(L);
    const sp = this.g.zone.anchors.spawn;
    for (const m of this.party.members) {
      const u = m.kit.u;
      if (u.dead) { this.party.hooks.canRevive = () => true; this.party.revive(u, { x: sp.x, z: sp.z }); this.party.hooks.canRevive = () => false; u.hp = Math.round(u.hpMax * 0.3); }
      u.pos.x = sp.x + (m.local ? 0 : (Math.random() - 0.5) * 3); u.pos.z = sp.z + (m.local ? 0 : 1 + Math.random()); u.facing = sp.facing || 0;
      u.skill?.cancel?.('teleport'); u.skill = null; u.kb.t = 0; u.cc.down = 0;
      L.emit('teleport', { unit: u, x: u.pos.x, z: u.pos.z });
    }
    this.g.cam.snap(this.me.pos);
    if (this.g.player) this.g.player.stop();
  }
  cleanupFloor() {
    this.portalFx?.stop?.(); this.portalFx = null; this.portalOpen = false;
    this.chest?.beam?.stop?.(); if (this.chest?.mesh) this.chest.mesh.removeFromParent(); this.chest = null;
    if (this.props) { this.props.removeFromParent(); this.props.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.props = null; }
    if (this.navBase && this.L && this.L.nav.data.length === this.navBase.length) this.L.nav.data.set(this.navBase);
    for (const tm of this.timers || []) this.L?.cancelTimer(tm);
    this.timers = [];
    this.boss = null; this.target = null; this.crystals = []; this.elites = [];
  }
  startFloor(f) {
    const g = this.g, L = this.L, z = g.zone;
    this.floor = f; this.floorT = 0; this.burnT = 0; this.overtime = false; this.spawned = 0; this.killedF = 0; this.spawnT = 0; this.minionQuota = null; this.need = 0; this.stuckT = 0;
    const kind = this.fkind = this.pickKind(f); this.prevKind = kind;
    this.mods = this.pickMods(f, kind);
    this.limit = INFERNO.floorTime[kind === 'boss' ? 'boss' : kind === 'hunter' ? 'hunter' : 'normal'];
    this.ref = refFor(INFERNO.ilvl);
    const n = this.party.members.length;
    this.hpMul = floorHp(f) * partyHp(n) * (this.mods.includes('swarm') ? 0.7 : 1);
    this.atkMul = floorAtk(f) * (this.mods.includes('ashfall') ? 1.1 : 1) * (this.mods.includes('frenzied') ? 1.1 : 1);
    this.addProps(f, Math.floor((f - 1) / INFERNO.segment) !== Math.floor((f - 2) / INFERNO.segment));
    // awakening charges and items: Awakened Soul adds a use each floor; Second Wind a potion every 5 floors
    const kit = g.hero;
    if (this.boons.awaken) kit.awakenUses = Math.min(3, kit.awakenUses + this.boons.awaken);
    if (kit.awakenUses <= 0 && f % 10 === 1) kit.awakenUses = 1;
    if (this.boons.wind && f % 5 === 1 && f > 1) { const p = kit.items.find(it => it.id === 'hp_potion'); if (p) p.count += this.boons.wind; }
    if (f % 10 === 1 && f > 1) { const p = kit.items.find(it => it.id === 'hp_potion'); if (p) p.count = Math.max(p.count, 3); }
    // chest
    const chestP = 0.3 + (this.boons.greed || 0) * 0.15 + (this.mods.includes('ashfall') ? 0.2 : 0);
    if (kind !== 'boss' && this.rng.chance(chestP)) this.placeChest();
    const theme = themeOf(f);
    const K = kind === 'boss' ? { name: BOSS_DEFS[BOSS_FLOORS[f]]?.name || 'Guardian', desc: BOSS_DEFS[BOSS_FLOORS[f]]?.title || '' } : FLOOR_KINDS[kind];
    g.ui?.banner?.(`Floor ${f}`, { kind: 'zone', sub: kind === 'boss' ? `${theme.name} · Guardian` : `${theme.name} · ${K.name}`, dur: 2.4 });
    if (kind === 'boss') g.audio?.stinger?.('boss_intro');
    this.s.ui.chat?.add?.({ channel: 'system', text: `Floor ${f}: ${K.name}${kind === 'boss' ? '' : ' — ' + K.desc}${this.mods.length ? ` · ${this.mods.map(id => MODIFIERS[id].name).join(', ')}` : ''}` });
    for (const id of this.mods) setTimeout(() => this.state !== 'over' && g.ui?.toast?.(`${MODIFIERS[id].name}: ${MODIFIERS[id].desc}`, MODIFIERS[id].good ? 'success' : 'warn'), 1400);
    if (this.mods.includes('blessed')) applyStatus(L, this.me, 'ember_blessing', { dur: this.limit + 60, mods: { dmgMul: 0.25 }, name: 'Ember Blessing', icon: 'status:atk_up', src: this.me });
    this.state = 'intro'; this.introT = kind === 'boss' ? 2.2 : 1.4;
    if (kind === 'boss') g.audio?.music?.(BOSS_DEFS[BOSS_FLOORS[f]]?.music || 'boss');
    else if (g.audio?.currentMusic !== 'inferno') g.audio?.music?.('inferno');
  }
  spawnObjective() {
    const f = this.floor, kind = this.fkind;
    this.state = 'fight';
    if (kind === 'purge') { this.need = Math.min(50, 22 + Math.floor(f / 2)) * (this.mods.includes('swarm') ? 1.5 : 1) | 0; this.wave(9); }
    else if (kind === 'elites') {
      const band = bandOf(f), n = 2 + (f >= 25 ? 1 : 0) + (f >= 60 ? 1 : 0);
      this.elites = [];
      for (let i = 0; i < n; i++) { const t = this.rng.pick(band.elites); const e = this.spawnMob(t, this.spot(10), { elite: true, hpMul: (mobTemplate(t).elite ? 1.1 : 0.9), scale: mobTemplate(t).elite ? 1.05 : 1.2, name: 'Champion ' + (mobTemplate(t).name || t) }); e.data.champion = true; this.elites.push(e); }
      this.need = n; this.wave(6); this.minionQuota = 8 + Math.floor(f / 5);
    } else if (kind === 'pylons') {
      this.crystals = [];
      const spots = this.spots(3, 9);
      for (const p of spots) this.crystals.push(this.spawnCrystal(p));
      this.need = this.crystals.length; this.wave(5);
      this.every(6.5, () => { for (const c of this.crystals) if (!c.dead) this.spawnAround(c.pos, 2, 3); });
    } else if (kind === 'survive') {
      this.need = FLOOR_KINDS.survive.secs; this.wave(7);
      this.every(4.5, () => this.wave(3 + Math.floor(this.rng.next() * 3) + Math.floor(f / 25)));
      this.every(5.5, () => this.eruptions(2));
    } else if (kind === 'hunter') {
      const opts = HUNTERS.filter(h => f >= h.from && mobTemplate(h.type));
      const h = this.rng.pick(opts.length ? opts : [{ type: 'pit_lord' }]);
      const tpl = mobTemplate(h.type);
      const hpAp = (620 + f * 20) * partyHp(this.party.members.length);
      const bp = this.g.zone.anchors.boss || { x: 0, z: -4 };
      const u = this.spawnMob(h.type, bp, { hpMul: hpAp / (tpl.hp * this.hpMul * (tpl.elite ? 1 : 4)), name: h.name, elite: true, poiseMul: 1.5 });
      u.data.champion = true; u.superArmor = Math.max(u.superArmor, 1); u.baseSuperArmor = Math.max(u.baseSuperArmor, 1);
      this.target = u; this.need = 1; this.minionQuota = 6 + Math.floor(f / 10); this.wave(4);
      this.g.ui?.banner?.(u.name, { kind: 'boss', sub: 'Champion of the Inferno', dur: 2.2 });
    } else if (kind === 'treasure') {
      const p = this.spot(8);
      const u = this.spawnMob('gilded_imp', p, { hpMul: 1 / this.hpMul * (1 + f * 0.03), escape: 24, onEscape: () => { this.g.ui?.banner?.('The Gilded Imp escaped!', { kind: 'fail', dur: 2 }); this.clearFloor(); } });
      u.data.gilded = true; u.data.flinch = false;
      this.target = u; this.need = 1; this.minionQuota = 8; this.wave(4);
    } else if (kind === 'boss') this.spawnBoss();
  }
  spawnBoss() {
    const f = this.floor, id = BOSS_FLOORS[f], def = BOSS_DEFS[id];
    const n = this.party.members.length;
    const bp = this.g.zone.anchors.boss || { x: 0, z: -4, facing: Math.PI };
    const hpScale = bossHpAp(f) * partyHp(n) / def.hp;
    const u = makeBoss(def, { ref: this.ref, partySize: n, x: bp.x, z: bp.z, facing: bp.facing ?? Math.PI, hpScale, mods: {} });
    const enc = { o: { partySize: n, hard: false, ref: this.ref }, bosses: [u], boss: u, def, game: this.g, party: this.party };
    u.data.encounter = enc;
    this.L.add(u);
    def.onStart?.(enc);
    u.st.atk *= this.atkMul * 0.9; u._statDirty = true;
    u.ctrl.o.ref = this.ref;
    this.boss = u; this.bossEnc = enc; this.target = u; this.need = 1;
    this.g.ui?.bossIntro?.({ name: def.name, title: def.title }) || this.g.ui?.banner?.(def.name, { kind: 'boss', sub: def.title, dur: 2.6 });
    u.model?.play?.('intro', { dur: 2.2 });
    this.after(1.6, () => { u.ctrl.started = true; });
  }
  spawnMob(type, p, o = {}) {
    const f = this.floor;
    const u = mobFrom(type, { x: p.x, z: p.z, ref: this.ref, hpMul: this.hpMul * (o.hpMul ?? 1), atkMul: this.atkMul * (o.atkMul ?? 1), elite: o.elite, scale: o.scale, name: o.name, escape: o.escape, onEscape: o.onEscape, poiseMul: o.poiseMul, speedMul: this.mods.includes('frenzied') ? 1.25 : 1 });
    if (this.mods.includes('frenzied')) applyStatus(this.L, u, 'frenzy', { dur: 1e7, mods: { moveSpd: 0.05 }, name: 'Frenzy', icon: 'status:enrage', force: true });
    if (this.mods.includes('bulwark') && u.data.elite) addShield(this.L, null, u, u.hpMax * 0.35, 1e6, 'bulwark');
    u.data.floor = f;
    this.L.add(u);
    this.g.presenter?.call?.('portal', { pos: { x: u.pos.x, y: this.L.heightAt(u.pos.x, u.pos.z), z: u.pos.z }, color: 'crimson', dur: 1 });
    return u;
  }
  spawnCrystal(p) {
    const c = new Unit({ kind: 'mob', team: 1, type: 'rift_crystal', name: 'Rift Pylon', x: p.x, z: p.z, radius: 0.9, height: 2.6, stats: { hpMax: Math.round(this.ref.ap * 26 * this.hpMul), atk: 0, def: 1500, speed: 0, mpMax: 0 } });
    c.data.crystal = true; c.data.immovable = true; c.data.flinch = false; c.data.tpl = { model: 'rift_crystal' }; c.data.corpseTime = 1.2; c.ctrl = null;
    this.L.add(c);
    return c;
  }
  /** a walkable spot at least minD metres from the heroes (anchors spawn:m* first) */
  spot(minD = 8) {
    const L = this.L, A = this.g.zone.anchors || {};
    const heroes = this.party.members.map(m => m.kit.u).filter(u => !u.dead);
    const far = p => heroes.every(h => Math.hypot(h.pos.x - p.x, h.pos.z - p.z) >= minD);
    const pts = Object.entries(A).filter(([k]) => k.startsWith('spawn:m')).map(([, v]) => v).filter(far);
    if (pts.length) { const p = this.rng.pick(pts); return { x: p.x + this.rng.range(-2, 2), z: p.z + this.rng.range(-2, 2) }; }
    for (let i = 0; i < 30; i++) { const b = this.g.zone.bounds || { x0: -20, z0: -20, x1: 20, z1: 20 }; const p = { x: this.rng.range(b.x0 + 3, b.x1 - 3), z: this.rng.range(b.z0 + 3, b.z1 - 3) }; if (L.nav.ok(p.x, p.z) && far(p)) return p; }
    return { x: 0, z: -4 };
  }
  spots(n, minSep = 8) {
    const out = [];
    for (let i = 0; i < 40 && out.length < n; i++) { const p = this.spot(9); if (out.every(q => Math.hypot(q.x - p.x, q.z - p.z) >= minSep)) out.push(p); }
    while (out.length < n) out.push(this.spot(6));
    return out;
  }
  wave(n) {
    const band = bandOf(this.floor), L = this.L;
    const alive = L.units.filter(u => u.kind === 'mob' && !u.dead && !u.data.crystal).length;
    n = Math.max(0, Math.min(n, 22 - alive));
    if (this.fkind === 'purge') n = Math.min(n, this.need - this.spawned);
    if (this.minionQuota != null) { n = Math.min(n, this.minionQuota); this.minionQuota -= n; }
    if (n <= 0) return;
    const p = this.spot(9);
    this.spawnAround(p, n, 3.5, band);
    if (this.mods.includes('haunted') && this.rng.chance(0.7)) this.spawnAround(this.spot(8), 1 + (this.floor >= 50 ? 1 : 0), 2, { pool: [['wraith', 1]] });
  }
  spawnAround(p, n, r = 3, band = bandOf(this.floor)) {
    for (let i = 0; i < n; i++) {
      const t = weighted(this.rng, band.pool);
      const a = this.rng.next() * Math.PI * 2, d = this.rng.range(0.5, r);
      let x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const q = this.L.nav.nearest(x, z, 4, 0.4); if (q) { x = q.x; z = q.z; }
      const elite = this.fkind !== 'elites' && t !== 'brute' && t !== 'crystal_golem' && this.rng.chance(0.03 + this.floor * 0.0012);
      this.spawnMob(t, { x, z }, { elite });
      if (this.fkind === 'purge') this.spawned++;
    }
  }
  eruptions(n) {
    const heroes = this.party.members.map(m => m.kit.u).filter(u => !u.dead);
    for (let i = 0; i < n && heroes.length; i++) {
      const h = heroes[Math.floor(this.rng.next() * heroes.length)];
      const x = h.pos.x + this.rng.range(-1.5, 1.5), z = h.pos.z + this.rng.range(-1.5, 1.5);
      eruption(this.L, { x, z, r: 2.6, delay: 1.3, pct: 0.07 + this.floor * 0.0006, pool: { dur: 4.5, pct: 0.02 } });
    }
  }
  every(t, fn) { const tm = this.L.every(t, () => { if (this.state === 'fight') fn(); }); this.timers.push(tm); return tm; }
  after(t, fn) { const tm = this.L.after(t, fn); this.timers.push(tm); return tm; }
  /** random basalt / spikes / crystals on the floor (blocking), keeping spawn → exit connected */
  addProps(f, fresh) {
    const L = this.L, A = this.g.zone.anchors, rng = new RNG(this.seed + f * 131);
    const kit = new Kit({ seed: f });
    const keep = [A.spawn, A.exit, A.boss, A.boon].filter(Boolean);
    const b = this.g.zone.bounds || { x0: -20, z0: -20, x1: 20, z1: 20 };
    const n = fresh ? rng.int(1, 3) : rng.int(3, 6);
    const placed = [];
    for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
      const x = rng.range(b.x0 + 5, b.x1 - 5), z = rng.range(b.z0 + 6, b.z1 - 6);
      if (!L.nav.ok(x, z) || keep.some(k => Math.hypot(k.x - x, k.z - z) < 7) || placed.some(p => Math.hypot(p.x - x, p.z - z) < 7)) continue;
      const y = L.heightAt(x, z), kind = rng.next();
      const before = kit.colliders.length;
      if (kind < 0.4) { const m = rng.int(2, 4); for (let k = 0; k < m; k++) { const a = rng.range(0, 6.28), d = k ? rng.range(0.8, 1.8) : 0, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = rng.range(1.6, 4.5), r = rng.range(0.5, 0.8); kit.add('darkrock', cyl(r, r * 1.05, h, 6, 1), M(px, y + h / 2 - 0.3, pz, rng.range(0, 1)), { tint: 0x3a3232, yGround: y, aoH: 2 }); kit.add('dark', cyl(r * 0.96, r * 0.96, 0.08, 6, 1), M(px, y + h - 0.28, pz), { tint: 0x6a5050, ao: false }); kit.block(SH.circle(px, pz, r + 0.05), 0.3); } }
      else if (kind < 0.7) boulder(kit, x, y, z, { s: rng.range(0.9, 1.6), seed: f * 7 + i, tint: 0x3a3030, mat: 'darkrock', flat: 0.6 });
      else if (kind < 0.85) spike(kit, x, y, z, { h: rng.range(2.2, 4), r: 0.45, bend: 0.9, dir: rng.range(0, 6), mat: 'dark' });
      else crystal(kit, x, y, z, { s: rng.range(0.8, 1.2), color: f > 60 ? 0xa050ff : 0xff6a20, intensity: 2.8, seed: f + i, light: false });
      placed.push({ x, z, from: before, to: kit.colliders.length }); i++;
    }
    // rasterise colliders onto the level nav (restored at the next floor), then verify spawn → exit / boss
    const nav = L.nav, data = nav.data, before = data.slice();
    const block = (c) => { const sh = c.shape, inf = c.inflate ?? 0.35; const [x0, z0, x1, z1] = sh.box; for (let zz = z0 - inf - 0.5; zz <= z1 + inf + 0.5; zz += nav.cell) for (let xx = x0 - inf - 0.5; xx <= x1 + inf + 0.5; xx += nav.cell) { const k = nav.ci(xx, zz); if (k >= 0 && sh.sd(nav.center(k).x, nav.center(k).z) <= inf) data[k] = 0; } };
    for (const c of kit.colliders) block(c);
    const reach = (a, b) => { if (!a || !b) return true; const p = nav.path(a.x, a.z, b.x, b.z, 0.3); const e = p?.[p.length - 1]; return !!e && Math.hypot(e.x - b.x, e.z - b.z) < 2.5; };
    if (!reach(A.spawn, A.exit) || !reach(A.spawn, A.boss)) { data.set(before); return; }
    const grp = new THREE.Group(); grp.name = 'inferno-props';
    kit.build(grp);
    this.g.zone.root.add(grp);
    this.props = grp;
  }
  placeChest() {
    const p = this.spot(7), L = this.L;
    const mesh = chestMesh(4); mesh.position.set(p.x, L.heightAt(p.x, p.z), p.z); mesh.rotation.y = this.rng.range(-0.6, 0.6);
    this.g.zone.root.add(mesh);
    const beam = this.g.fx?.lootBeam?.({ pos: { x: p.x, y: L.heightAt(p.x, p.z), z: p.z }, grade: 4 });
    this.chest = { x: p.x, z: p.z, mesh, beam, open: false };
  }
  // ---------------------------------------------------------------- events
  onDeath({ unit: u, killer }) {
    if (this.state === 'over') return;
    if (u.kind === 'hero') return;
    const mine = killer && (killer === this.me || killer.party === this.party);
    if (u.kind === 'mob' || u.kind === 'boss') {
      if (!u.data.escaped) this.kills++;
      if (mine && this.boons.phoenix && this.me && !this.me.dead) heal(this.L, this.me, this.me, this.me.hpMax * BOON_BY_ID.phoenix.v * this.boons.phoenix);
      if (this.mods.includes('volatile') && u.kind === 'mob' && !u.data.crystal && !u.data.escaped && this.rng.chance(0.55)) eruption(this.L, { x: u.pos.x, z: u.pos.z, r: 2.2, delay: 0.9, pct: 0.06, fx: 'explosion', color: 'fire', sfx: 'explosion' });
      // keys
      const keyChance = u.kind === 'boss' || u.data.champion ? 1 : u.data.elite ? 0.3 + (this.boons.greed || 0) * 0.15 : 0.012;
      if (!u.data.escaped && !u.data.crystal && this.rng.chance(keyChance)) this.gainKey(u.pos);
    }
    if (this.state !== 'fight') return;
    const k = this.fkind;
    if (k === 'purge' && u.kind === 'mob' && !u.data.crystal) { this.killedF++; if (this.killedF >= this.need) this.clearFloor(); }
    else if (k === 'elites' && u.data.champion) { this.killedF++; if (this.killedF >= this.need) this.clearFloor(); }
    else if (k === 'pylons' && u.data.crystal) { this.killedF++; this.L.emit('fx', { unit: u, preset: 'crystal_shatter', x: u.pos.x, z: u.pos.z }); if (this.killedF >= this.need) this.clearFloor(); }
    else if ((k === 'hunter' || k === 'boss') && u === this.target) { if (this.boss && this.bossEnc) this.boss.data.def?.onBossDeath?.(this.bossEnc, this.boss); this.clearFloor(); }
    else if (k === 'treasure' && u === this.target && !u.data.escaped) {
      const f = this.floor, bonus = { silver: 6000 + f * 500, shards: 400 + f * 30, gold: 10 + Math.floor(f / 2) };
      S.common.grantBundle?.(this.s.account, this.s.char, bonus);
      mergeRows(this.rows, S.common.bundleRows?.(bonus) || []); addCurrencies(this.cur, { silver: bonus.silver, gold: bonus.gold });
      this.gainKey(u.pos); this.g.fx?.pickup?.({ pos: u.pos, kind: 'gold', to: this.me?.model?.root });
      this.g.ui?.banner?.('Gilded Imp caught!', { kind: 'success', sub: `+${bonus.silver.toLocaleString()} silver · +${bonus.gold} gold · Ember Key`, dur: 2.4 });
      this.g.audio?.sfx?.('loot_rare', {});
      this.clearFloor();
    }
  }
  onDamage(ev) {
    const me = this.me; if (!me || this.state === 'over') return;
    if (ev.src === me && ev.tgt.team !== me.team && ev.amount > 0 && !ev.dot && ev.skill !== 'boon') {
      if (this.boons.leech) this._leech = (this._leech || 0) + ev.amount * BOON_BY_ID.leech.v * this.boons.leech * (ev.tgt.kind === 'boss' ? 0.5 : 1);
      if (this.boons.chain && this.rng.chance(BOON_BY_ID.chain.v * this.boons.chain) && (this._chainT || 0) <= this.L.time) {
        this._chainT = this.L.time + 0.12;
        const foes = this.L.enemiesOf(me, ev.tgt.pos.x, ev.tgt.pos.z, 7).filter(e => e !== ev.tgt).slice(0, 3);
        let from = ev.tgt;
        for (const e of foes) {
          dealDamage(this.L, me, e, eff(me).atk * 6, { skill: 'boon', kind: 'skill', elem: 'lightning' });
          this.g.fx?.lightning?.({ from: { x: from.pos.x, y: from.pos.y + 1.2, z: from.pos.z }, to: { x: e.pos.x, y: e.pos.y + 1.2, z: e.pos.z }, color: 'lightning' });
          from = e;
        }
        if (foes.length) this.g.presenter?.sfx?.('lightning', ev.tgt.pos);
      }
    }
    if (ev.tgt === me && ev.src && ev.src.team !== me.team && ev.amount > 0 && this.boons.thorns && !ev.src.dead && ev.skill !== 'boon') {
      dealDamage(this.L, me, ev.src, ev.amount * BOON_BY_ID.thorns.v * this.boons.thorns * (ev.src.kind === 'boss' ? 0.4 : 1), { skill: 'boon', kind: 'skill', noCrit: true, true: true });
    }
  }
  onDash({ unit }) {
    if (unit !== this.me) return;
    const kit = this.g.hero;
    if (this.boons.fleet) kit.dashCd *= 1 - BOON_BY_ID.fleet.v;
    if (this.boons.meteor && (this._meteorT || 0) <= this.L.time) {
      this._meteorT = this.L.time + 4;
      const u = this.me, L = this.L;
      L.after(0.35, () => {
        if (u.dead) return;
        const x = u.pos.x, z = u.pos.z;
        this.g.fx?.meteor?.({ target: { x, y: L.heightAt(x, z), z }, radius: 3.4, color: 'fire', fall: 0.5, telegraph: false });
        L.after(0.5, () => { for (const e of L.enemiesOf(u, x, z, 4)) dealDamage(L, u, e, eff(u).atk * 40, { skill: 'boon', kind: 'skill', elem: 'fire' }); L.emit('shake', { unit: u, v: 0.25 }); });
      });
    }
  }
  onCheat({ tgt }) {
    if (tgt !== this.me || !this.boons.second || this.secondUsed) return;
    this.secondUsed = true;
    const u = this.me, L = this.L;
    u.hp = Math.round(u.hpMax * 0.5); u.invuln = Math.max(u.invuln, 2.5);
    L.emit('fx', { unit: u, preset: 'revive', x: u.pos.x, z: u.pos.z, ev: { color: 'gold' } });
    this.g.ui?.banner?.('Second Life', { kind: 'success', sub: 'The embers refuse to let you fall.', dur: 2.4 });
    this.g.audio?.sfx?.('revive', { pos: u.pos });
    delete this.boons.second; this.applyBoons();
  }
  onHeroDeath(u) {
    if (this.state === 'over') return;
    if (u === this.me) {
      const alive = this.party.members.filter(m => !m.kit.u.dead);
      if (!alive.length || this.partySize <= 1) this.fall();
      else this.g.ui?.toast?.('You have fallen — your companions fight on. Clear the floor to rise again.', 'warn');
    } else if (this.party.members.every(m => m.kit.u.dead)) this.fall();
  }
  fall() {
    if (this.state === 'over' || this.falling) return;
    this.falling = true;
    this.g.ui?.banner?.('The Inferno claims you', { kind: 'defeat', sub: `Floor ${this.floor}`, dur: 2.6 });
    this.g.audio?.stinger?.('wipe');
    setTimeout(() => { if (this.s.screen === 'game' && this.me?.dead) this.s.ui.screen('death', { reason: `Fell on Floor ${this.floor}`, by: 'Inferno Descent', revives: [], auto: { label: 'The run ends in', left: 2.5 } }); }, 100);
    setTimeout(() => this.finish('fell'), 2600);
  }
  gainKey(p) {
    this.keys++;
    this.g.fx?.pickup?.({ pos: p, kind: 'shard', to: this.me?.model?.root });
    this.g.ui?.hud?.loot?.({ name: 'Ember Key', grade: 4, count: 1, icon: 'item:key', kind: 'quest' });
    if (this.chest && !this.chest.open) this.g.ui?.toast?.('Ember Key — a Cinder Chest waits on this floor.', 'loot');
  }
  // ---------------------------------------------------------------- boons
  offer(n = 3) {
    const pool = BOONS.filter(b => (this.boons[b.id] || 0) < b.max);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      let tot = 0; for (const b of pool) tot += RARITY[b.rarity].weight;
      let r = this.rng.next() * tot, pick = pool[0];
      for (const b of pool) { r -= RARITY[b.rarity].weight; if (r <= 0) { pick = b; break; } }
      out.push(pick); pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }
  addBoon(id, quiet = false) {
    const b = BOON_BY_ID[id]; if (!b) return;
    this.boons[id] = Math.min(b.max, (this.boons[id] || 0) + 1);
    if (!this.boonOrder.includes(id)) this.boonOrder.push(id);
    if (this.me) this.applyBoons();
    if (!quiet) { this.g.ui?.banner?.(b.name, { kind: 'success', sub: b.desc, dur: 2.4 }); this.g.audio?.sfx?.('buff', {}); this.L && this.me && this.L.emit('fx', { unit: this.me, preset: 'aura_burst', x: this.me.pos.x, z: this.me.pos.z, ev: { color: 'fire' } }); }
  }
  applyBoons(fresh = false) {
    const u = this.me, L = this.L; if (!u || !L) return;
    let hpMul = 1;
    for (const [id, n] of Object.entries(this.boons)) hpMul += (BOON_BY_ID[id]?.hpMul || 0) * n;
    const st = { ...this.baseStats, hpMax: Math.round(this.baseStats.hpMax * Math.max(0.3, hpMul)) };
    if (this.boons.execute) { const prev = this.baseStats.onDamageMul, v = BOON_BY_ID.execute.v * this.boons.execute; st.onDamageMul = (src, tgt, o, b, h) => (prev ? prev(src, tgt, o, b, h) : 1) * (tgt.hp / tgt.hpMax < 0.3 ? 1 + v : 1); }
    if (fresh) { u.st = st; u.hpMax = st.hpMax; u.hp = st.hpMax; u._statDirty = true; } else u.setStats(st);
    for (const id of Object.keys(BOON_BY_ID)) if (u.hasStatus('boon_' + id) && !this.boons[id]) removeStatus(L, u, 'boon_' + id);
    for (const [id, n] of Object.entries(this.boons)) {
      const b = BOON_BY_ID[id]; if (!b) continue;
      const mods = b.mods ? Object.fromEntries(Object.entries(b.mods).map(([k, v]) => [k, v * n])) : null;
      removeStatus(L, u, 'boon_' + id);
      applyStatus(L, u, 'boon_' + id, { dur: 1e7, mods, name: n > 1 ? `${b.name} ×${n}` : b.name, icon: b.icon, src: u, force: true });
    }
    u.data.cheatDeath = !!this.boons.second && !this.secondUsed;
    // timed boon effects
    for (const tm of this.boonTimers || []) L.cancelTimer(tm);
    this.boonTimers = [];
    if (this.boons.aura) this.boonTimers.push(L.every(1, () => {
      const me = this.me; if (!me || me.dead || this.state !== 'fight') return;
      const foes = L.enemiesOf(me, me.pos.x, me.pos.z, 5);
      for (const e of foes) dealDamage(L, me, e, eff(me).atk * BOON_BY_ID.aura.v * this.boons.aura, { skill: 'boon', kind: 'skill', elem: 'fire', noCrit: true });
      if (foes.length) L.emit('fx', { unit: me, preset: 'shockwave', x: me.pos.x, z: me.pos.z, ev: { r: 5, color: 'fire' } });
    }));
    if (this.boons.storm) this.boonTimers.push(L.every(Math.max(2, BOON_BY_ID.storm.v - (this.boons.storm - 1)), () => {
      const me = this.me; if (!me || me.dead || this.state !== 'fight') return;
      const e = L.nearestEnemy(me, 14); if (!e) return;
      L.emit('fx', { unit: me, preset: 'lightning_bolt', x: e.pos.x, z: e.pos.z, ev: { color: 'lightning', r: 2 } });
      for (const t of L.enemiesOf(me, e.pos.x, e.pos.z, 2.5)) dealDamage(L, me, t, eff(me).atk * 28, { skill: 'boon', kind: 'skill', elem: 'lightning' });
      this.g.presenter?.sfx?.('thunder', e.pos);
    }));
  }
  async chooseBoon() {
    const opts = this.offer(3);
    if (!opts.length) return;
    let pick = null;
    if (AUTO) pick = opts[0].id;
    else {
      const choices = opts.map(b => ({ id: b.id, text: `${b.name}${this.boons[b.id] ? ` (${this.boons[b.id] + 1}/${b.max})` : ''} — ${b.desc} · ${RARITY[b.rarity].name}`, kind: b.rarity >= 3 ? 'quest' : b.rarity === 2 ? 'shop' : 'talk' }));
      choices.push({ id: 'skip', text: 'Refuse the embers (heal to full instead).', kind: 'leave' });
      pick = await this.s.ui.dialog({ name: 'The Inferno', title: `Floor ${this.floor} · Boon` }, [{ text: 'Embers swirl around you, eager to be carried deeper. Choose one blessing.', choices }]);
      if (pick == null) { pick = opts[0].id; this.g.ui?.toast?.(`The embers choose for you: ${opts[0].name}.`, 'info'); }
    }
    if (this.state === 'over') return;
    if (pick === 'skip') { const me = this.me; if (me && !me.dead) heal(this.L, me, me, me.hpMax); this.g.ui?.toast?.('You refuse the embers and feel whole again.', 'success'); }
    else this.addBoon(pick);
  }
  // ---------------------------------------------------------------- floor end
  clearFloor() {
    if (this.state !== 'fight') return;
    this.state = 'cleared';
    const f = this.floor, L = this.L, g = this.g;
    this.cleared++; this.deepest = Math.max(this.deepest, f);
    if (f % 10 === 0) (this.milestones ||= {})[f] = this.t;
    for (const u of L.units.slice()) if ((u.kind === 'mob' || u.kind === 'boss') && !u.dead) { u.hp = 0; kill(L, u, null); }
    if (this.me?.hasStatus('ember_blessing')) removeStatus(L, this.me, 'ember_blessing');
    // heal the party, revive the fallen
    for (const m of this.party.members) {
      const u = m.kit.u;
      if (u.dead) { this.party.hooks.canRevive = () => true; this.party.revive(u, { x: u.pos.x, z: u.pos.z }); this.party.hooks.canRevive = () => false; u.hp = Math.round(u.hpMax * 0.3); }
      else heal(L, u, u, u.hpMax * INFERNO.clearHeal * (1 + (m.local ? (this.boons.wind || 0) * BOON_BY_ID.wind.v / INFERNO.clearHeal : 0)));
    }
    // rewards
    try {
      const r = S.loot.infernoReward(this.s.account, this.s.char, { floor: f });
      if (r?.ok !== false) {
        if (this.boons.greed && r.currencies?.silver) { const extra = Math.round(r.currencies.silver * BOON_BY_ID.greed.v * this.boons.greed); this.s.account.give('silver', extra); r.currencies.silver += extra; const row = r.rows.find(x => x.id === 'silver'); if (row) row.count += extra; }
        mergeRows(this.rows, r.rows); addCurrencies(this.cur, r.currencies);
        for (const n of r.notes || []) if (/chest/i.test(n)) this.g.ui?.toast?.(`${n}!`, 'loot');
        for (const row of (r.rows || []).filter(x => x.grade >= 3).slice(0, 3)) g.ui?.hud?.loot?.({ name: row.name, grade: row.grade, count: row.count, icon: row.icon, kind: row.kind });
      }
    } catch (e) { console.error('[inferno reward]', e); }
    const xp = 180 + f * 6; this.cur.xp += xp;
    const ups = this.s.account.addXp(this.s.char, xp);
    if (ups?.length) setTimeout(() => { g.ui?.banner?.('Level Up', { kind: 'levelup', level: ups[ups.length - 1], sub: `You reached level ${ups[ups.length - 1]}` }); this.s.bus.emit('levelup', { level: ups[ups.length - 1] }); }, 800);
    if (f % 10 === 0 && this.rng.chance(0.5)) { this.s.account.give(CUBE.ticket, 1); mergeRows(this.rows, [{ id: CUBE.ticket, name: 'Rift Cube Ticket', count: 1, grade: 3, icon: 'item:key', kind: 'material' }]); g.ui?.toast?.('A Rift Cube Ticket smoulders in the ashes.', 'loot'); }
    // the fire gate opens
    const ex = g.zone.anchors.exit || { x: 0, z: -18 };
    this.portalOpen = true;
    this.portalFx = g.presenter?.call?.('portal', { pos: { x: ex.x, y: L.heightAt(ex.x, ex.z), z: ex.z }, color: 'fire', radius: 2.2 });
    g.audio?.sfx?.('portal_open', {});
    const last = f >= INFERNO.floors;
    g.ui?.banner?.(last ? 'The Inferno is conquered!' : `Floor ${f} cleared`, { kind: 'clear', sub: last ? 'You reached the bottom of the world' : `${fmtTime(this.floorT)} · step into the fire gate`, dur: 2.6 });
    if (this.fkind === 'boss') g.audio?.music?.('inferno');
    const next = () => {
      if (this.state !== 'cleared') return;
      if (last) { this.finish('conquered'); return; }
      this.state = 'cleared';
      if (AUTO) this.after(2.5, () => this.descend());
    };
    if (f % INFERNO.boonEvery === 0 && !last) { this.state = 'boon'; this.after(1.4, async () => { await this.chooseBoon(); if (this.state === 'boon') this.state = 'cleared'; next(); }); }
    else next();
    this.s.bus.emit('inferno', { floor: f, cleared: true });
  }
  async descend() {
    if (this.state !== 'cleared' || this.descending) return;
    this.descending = true;
    try {
      const g = this.g;
      g.audio?.sfx?.('portal_enter', {});
      g.renderer.fx.flash = 0.35;
      await this.enterFloor(this.floor + 1);
    } finally { this.descending = false; }
  }
  saveRecords(reason) {
    const A = this.s.account, I = infernoRecords(A);
    I.runs++;
    const prevBest = I.best;
    if (this.deepest > I.best || (this.deepest === I.best && this.deepest > 0 && (I.bestTime == null || this.t < I.bestTime))) { I.best = Math.max(I.best, this.deepest); I.bestTime = this.t; I.bestAt = Date.now(); I.bestBy = { name: this.s.char.name, cls: this.s.char.cls }; }
    if (this.start === 1) for (let m = 10; m <= this.deepest; m += 10) { const t = this.milestones?.[m]; if (t != null && (I.fastest[m] == null || t < I.fastest[m])) I.fastest[m] = Math.round(t); }
    I.last = { floor: this.deepest, start: this.start, time: Math.round(this.t), kills: this.kills, boons: { ...this.boons }, reason, t: Date.now() };
    A.save();
    emitClear(this.s, { kind: 'inferno', start: this.start, floor: this.deepest }, { cleared: this.deepest >= this.start, floor: this.deepest, time: this.t, kills: this.kills });
    return prevBest;
  }
  finish(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    const g = this.g;
    const prevBest = this.saveRecords(reason);
    const I = infernoRecords(this.s.account);
    const meter = this.meterRows();
    const d = this.deepest, conquered = reason === 'conquered';
    const rank = conquered || d >= 60 ? 'S' : d >= 40 ? 'A' : d >= 20 ? 'B' : d >= 10 ? 'C' : 'D';
    const boonList = this.boonOrder.map(id => `${BOON_BY_ID[id].name}${this.boons[id] > 1 ? ' ×' + this.boons[id] : ''}`).join(', ');
    setTimeout(() => {
      showResults(this.s, {
        kind: d >= this.start ? 'clear' : 'fail', over: 'Inferno Descent',
        title: conquered ? 'The Inferno Conquered' : d >= this.start ? `Floor ${d} Reached` : 'The Inferno Claims You',
        sub: reason === 'fell' ? `Fell on Floor ${this.floor}` : reason === 'left' ? 'You left the Inferno with your spoils' : conquered ? 'All one hundred floors' : '',
        rank: d >= this.start ? rank : null, time: this.t,
        stats: [{ label: 'Deepest Floor', value: String(d), tag: d > prevBest ? 'New Record' : null }, { label: 'Floors Cleared', value: String(this.cleared) }, { label: 'Kills', value: String(this.kills) }, { label: 'Best Ever', value: `Floor ${I.best}` }, { label: 'Boons', value: boonList || '—' }],
        loot: this.rows, currencies: this.cur, retry: true, continueLabel: 'Return to Solhaven',
        dps: dpsRows(meter),
      }, d >= this.start);
    }, reason === 'fell' ? 0 : 1600);
    this.s.lastContent = { ...this.c, seed: undefined };
  }
  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.g, L = this.L; if (!L || !this.me) return;
    if (this.state === 'loading' || this.state === 'over') return;
    this.t += dt;
    const me = this.me;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) this.spawnObjective(); return; }
    if (this.state === 'fight') {
      this.floorT += dt;
      if (this.fkind === 'survive' && this.floorT >= this.need) { g.ui?.toast?.('You endured the onslaught!', 'success'); this.clearFloor(); return; }
      // keep the horde topped up
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 1.4 + this.rng.next();
        const alive = L.units.filter(u => u.kind === 'mob' && !u.dead && !u.data.crystal).length;
        if (this.fkind === 'purge' && this.spawned < this.need && alive < 12) this.wave(6 + Math.floor(this.rng.next() * 4));
        else if ((this.fkind === 'elites' || this.fkind === 'hunter' || this.fkind === 'treasure') && (this.minionQuota || 0) > 0 && alive < 7) this.wave(4);
      }
      if (this.mods.includes('molten') && ((this._moltenT = (this._moltenT ?? 6) - dt) <= 0)) { this._moltenT = 7; this.eruptions(Math.min(3, this.party.members.length + 1)); }
      // floor timer → the Inferno rises
      if (this.floorT > this.limit) {
        if (!this.overtime) { this.overtime = true; g.ui?.banner?.('The Inferno rises!', { kind: 'warn', sub: 'Clear the floor before it consumes you' }); g.renderer.fx.hurt = 0.4; }
        this.burnT -= dt;
        if (this.burnT <= 0) { this.burnT = INFERNO.burnTick; for (const m of this.party.members) { const u = m.kit.u; if (!u.dead) dealDamage(L, null, u, 0, { fixed: Math.round(u.hpMax * INFERNO.burnPct), skill: 'inferno', kind: 'hazard', dot: true }); } L.emit('fx', { unit: me, preset: 'fire_burst', x: me.pos.x, z: me.pos.z, ev: { r: 2, color: 'fire' } }); }
      }
      // the Gilded Imp drops sparkles as it runs
      if (this.fkind === 'treasure' && this.target && !this.target.dead && Math.random() < dt * 3) L.emit('fx', { unit: this.target, preset: 'burst', x: this.target.pos.x, z: this.target.pos.z, ev: { color: 'gold' } });
      // failsafe: stragglers that cannot reach the party (or be reached) are pulled in
      this.stuckT = (this.stuckT || 0) + dt;
      if (this.killsSeen !== this.kills) { this.killsSeen = this.kills; this.stuckT = 0; }
      if (this.stuckT > 22) {
        this.stuckT = 0;
        for (const u of L.units) if (u.kind === 'mob' && !u.dead && !u.data.crystal && !u.data.gilded && u.distTo(me) > 9) { const a = Math.random() * 6.28, p = L.nav.nearest(me.pos.x + Math.cos(a) * 5, me.pos.z + Math.sin(a) * 5, 5, 0.4); if (p) { u.pos.x = p.x; u.pos.z = p.z; g.presenter?.call?.('portal', { pos: { x: p.x, y: L.heightAt(p.x, p.z), z: p.z }, color: 'crimson', dur: 1 }); } }
      }
    }
    // Bloodthirst heals in pulses (no number spam)
    if (this._leech > 0 && ((this._leechT = (this._leechT || 0) - dt) <= 0)) { this._leechT = 0.6; if (!me.dead) heal(L, me, me, this._leech); this._leech = 0; }
    // chest & gate
    if (this.chest && !this.chest.open && Math.hypot(me.pos.x - this.chest.x, me.pos.z - this.chest.z) < 1.6 && this.keys > 0 && AUTO) this.openChest();
    if ((this.state === 'cleared') && this.portalOpen && !this.descending) {
      const ex = g.zone.anchors.exit || { x: 0, z: -18 };
      if (Math.hypot(me.pos.x - ex.x, me.pos.z - ex.z) < 2.0) this.descend();
    }
    if (me.dead && this.s.deadShown && !this._deathSkinned) { this._deathSkinned = true; if (this.partySize > 1 && this.party.members.some(m => !m.kit.u.dead)) this.s.ui.screen('death', { reason: 'You have fallen', by: 'Your companions fight on', revives: [], auto: { label: 'Rise again when the floor is cleared', left: 0 } }); }
    if (!me.dead) this._deathSkinned = false;
  }
  // ---------------------------------------------------------------- interaction
  interactable() {
    const me = this.me; if (!me || this.state === 'over' || this.state === 'loading') return null;
    if (this.chest && !this.chest.open && Math.hypot(me.pos.x - this.chest.x, me.pos.z - this.chest.z) < 2.2) return { name: this.keys > 0 ? 'Cinder Chest (1 Ember Key)' : 'Cinder Chest (locked)', infernoChest: true, data: { npcDef: { object: true } } };
    const ex = this.g.zone.anchors.exit;
    if (ex && this.portalOpen && Math.hypot(me.pos.x - ex.x, me.pos.z - ex.z) < 4) return { name: 'Fire Gate', portal: 'inferno:gate', infernoGate: true };
    return null;
  }
  interact(t) {
    if (t?.infernoChest) { this.openChest(); return true; }
    if (t?.infernoGate) { this.gateMenu(); return true; }
    return false;
  }
  async gateMenu() {
    if (this.state !== 'cleared') return;
    const pick = await this.s.ui.dialog({ name: 'The Fire Gate', title: `Inferno Descent · Floor ${this.floor}` }, [{ text: `The gate roars. Floor ${this.floor + 1} waits below — or you can climb back to the world with everything you have earned.`, choices: [{ id: 'down', text: `Descend to Floor ${this.floor + 1}.`, kind: 'quest' }, { id: 'leave', text: 'Leave the Inferno with your spoils.', kind: 'leave' }, { id: 'stay', text: 'Not yet.', kind: 'talk' }] }]);
    if (pick === 'down') this.descend();
    else if (pick === 'leave') this.finish('left');
  }
  openChest() {
    const c = this.chest; if (!c || c.open) return;
    if (this.keys <= 0) { this.g.ui?.toast?.('The Cinder Chest is sealed. Ember Keys drop from champions and elites.', 'warn'); return; }
    this.keys--; c.open = true; c.beam?.stop?.();
    const f = this.floor, g = this.g, me = this.me;
    g.audio?.sfx?.('chest_open', { pos: me.pos });
    this.L.emit('fx', { unit: me, preset: 'burst', x: c.x, z: c.z, ev: { color: 'gold' } });
    const lid = c.mesh; if (lid) { lid.scale.y = 0.7; setTimeout(() => lid.removeFromParent(), 2500); }
    const b = { silver: 3000 + f * 350, shards: 250 + f * 25 };
    if (this.rng.chance(0.35)) b.gold = 8 + Math.floor(f / 3);
    if (this.rng.chance(0.2)) b.leapstone = 2 + Math.floor(f / 15);
    S.common.grantBundle?.(this.s.account, this.s.char, b);
    const rows = S.common.bundleRows?.(b) || [];
    mergeRows(this.rows, rows); addCurrencies(this.cur, { silver: b.silver, gold: b.gold || 0 });
    for (const r of rows.slice(0, 3)) g.ui?.hud?.loot?.({ name: r.name, grade: r.grade, count: r.count, icon: r.icon, kind: r.kind });
    const roll = this.rng.next();
    if (roll < 0.22) { g.ui?.toast?.('The chest holds a living ember — choose a boon!', 'success'); this.chooseBoon(); }
    else if (roll < 0.5) { const p = g.hero.items.find(it => it.id === 'hp_potion'); if (p) p.count++; g.ui?.toast?.('+1 Healing Potion', 'loot'); }
    else if (roll < 0.65) { g.hero.awakenUses = Math.min(3, g.hero.awakenUses + 1); g.ui?.toast?.('+1 Awakening use', 'loot'); }
    else if (roll < 0.8) { heal(this.L, me, me, me.hpMax * 0.5); g.ui?.toast?.('Warmth floods back: +50% HP', 'success'); }
  }
  // ---------------------------------------------------------------- HUD
  progressHud() {
    if (this.state === 'loading' || this.state === 'over') return null;
    const f = this.floor, k = this.fkind, K = k === 'boss' ? { name: 'Guardian' } : FLOOR_KINDS[k];
    let pct = 0;
    if (this.state === 'cleared' || this.state === 'boon') pct = 100;
    else if (k === 'survive') pct = this.floorT / this.need * 100;
    else if ((k === 'hunter' || k === 'boss') && this.target) pct = (1 - this.target.hp / this.target.hpMax) * 100;
    else if (k === 'treasure') pct = this.target && !this.target.dead ? Math.min(99, this.floorT / 24 * 100) : 100;
    else pct = this.need ? this.killedF / this.need * 100 : 0;
    return { label: `Floor ${f} · ${K?.name || ''}`, pct };
  }
  timerHud() {
    if (this.state !== 'fight') return null;
    if (this.fkind === 'treasure' && this.target && !this.target.dead) return { label: 'Escapes in', left: Math.max(0, (this.target.ctrl?.escape ?? 24) - (this.target.ctrl?.t ?? 0)), urgent: true };
    return this.overtime ? { label: 'The Inferno rises', left: 0, urgent: true } : { label: 'Floor time', left: Math.max(0, this.limit - this.floorT), urgent: this.limit - this.floorT < 15 };
  }
  bossHud() {
    const b = this.target; if (!b || b.dead || !(this.fkind === 'boss' || this.fkind === 'hunter' || this.fkind === 'treasure')) return null;
    if (b.kind === 'boss') return { name: b.name, title: b.data.def?.title, hp: b.hp, hpMax: b.hpMax, barHp: b.data.barHp, bars: b.data.bars, stagger: b.data.stagger ? { v: b.data.stagger.v, max: b.data.stagger.max, left: b.data.stagger.left } : null, destruction: b.data.destruction && !b.data.destruction.broken ? { v: b.data.destruction.v, max: b.data.destruction.max } : null, enrageLeft: null, counter: (b.data.counterWindow || 0) > 0, groggy: !!b.data.groggy, buffs: b.statuses.map(s => ({ id: s.id, icon: s.icon, name: s.name, left: s.left, debuff: !!s.def.debuff })) };
    return { name: b.name, title: b.data.gilded ? 'Catch it before it escapes!' : 'Champion of the Inferno', hp: b.hp, hpMax: b.hpMax, barHp: b.hpMax / (b.data.gilded ? 5 : 30), bars: b.data.gilded ? 5 : 30, stagger: null, destruction: null, enrageLeft: null, counter: false };
  }
  partyHud() { return this.party?.hud(); }
  questHud() {
    const f = this.floor, k = this.fkind;
    const K = k === 'boss' ? { name: BOSS_DEFS[BOSS_FLOORS[f]]?.name || 'Guardian', desc: 'Defeat the guardian of the floor.' } : FLOOR_KINDS[k] || { name: '', desc: '' };
    const steps = [];
    if (this.state === 'cleared' || this.state === 'boon') steps.push({ text: f >= INFERNO.floors ? 'The Inferno is conquered' : 'Step into the fire gate (G: leave)', n: 0, need: 1, done: false });
    else if (k === 'purge') steps.push({ text: 'Purge the horde', n: this.killedF || 0, need: this.need || 1, done: false });
    else if (k === 'elites') steps.push({ text: 'Slay the champions', n: this.killedF || 0, need: this.need || 1, done: false });
    else if (k === 'pylons') steps.push({ text: 'Shatter the rift pylons', n: this.killedF || 0, need: this.need || 1, done: false });
    else if (k === 'survive') steps.push({ text: `Endure (${Math.max(0, Math.ceil((this.need || 40) - this.floorT))} s)`, n: Math.floor(this.floorT), need: this.need || 40, done: false });
    else steps.push({ text: K.desc, n: 0, need: 1, done: false });
    if (this.mods?.length) steps.push({ text: this.mods.map(id => MODIFIERS[id].name).join(' · '), n: 0, need: 0, done: false });
    if (this.boonOrder.length) steps.push({ text: 'Boons: ' + this.boonOrder.map(id => `${BOON_BY_ID[id].name}${this.boons[id] > 1 ? ' ×' + this.boons[id] : ''}`).join(', '), n: 0, need: 0, done: false });
    steps.push({ text: `Ember Keys ${this.keys} · Best floor ${infernoRecords(this.s.account).best}`, n: 0, need: 0, done: false });
    return { id: 'inferno', title: `Inferno Descent — Floor ${f}`, kind: 'event', steps };
  }
}

// ================================================================================================ launch & menus
async function launchInferno(session, c) {
  const run = new InfernoRun(session, c);
  window.__modes ||= {};
  window.__modes.inferno = run;
  await run.begin();
}
registerContent('inferno', launchInferno);

/** "Inferno Descent" menu: start floor (checkpoints every 10 up to your best) and party size */
export async function infernoMenu(session) {
  const I = infernoRecords(session.account);
  const top = Math.min(INFERNO.floors - 9, Math.floor(Math.max(0, I.best) / 10) * 10 + 1);
  const starts = [];
  for (let f = 1; f <= top; f += 10) starts.push(f);
  const choices = starts.slice(-4).reverse().map(f => ({ id: 'start:' + f, text: f === 1 ? 'Descend from Floor 1.' : `Descend from Floor ${f} (checkpoint — ${Math.floor((f - 1) / 10)} free boon${f > 11 ? 's' : ''}).`, kind: 'quest' }));
  if (!starts.includes(1)) choices.push({ id: 'start:1', text: 'Descend from Floor 1.', kind: 'quest' });
  choices.push({ id: 'party', text: 'Bring three companions (AI party of 4).', kind: 'talk' }, { id: 'bye', text: 'Not today.', kind: 'leave' });
  const fastest = Object.entries(I.fastest || {}).sort((a, b) => b[0] - a[0])[0];
  const text = `One hundred floors of fire. Every fifth floor offers a boon; every tenth hides a guardian. Death ends the run.\nBest: Floor ${I.best}${I.bestTime ? ` (${fmtTime(I.bestTime)})` : ''}${fastest ? ` · Fastest to Floor ${fastest[0]}: ${fmtTime(fastest[1])}` : ''} · Runs: ${I.runs}`;
  let pick = await session.ui.dialog({ name: 'Rift Warden Oriel', title: 'Inferno Descent' }, [{ text, choices }]);
  let party = 1;
  if (pick === 'party') {
    party = 4;
    pick = await session.ui.dialog({ name: 'Rift Warden Oriel', title: 'Inferno Descent' }, [{ text: 'Three adventurers step forward. From which floor?', choices: [...choices.filter(c => c.id.startsWith('start:')), { id: 'bye', text: 'Not today.', kind: 'leave' }] }]);
  }
  if (!pick || !pick.startsWith('start:')) return;
  return session.launch({ kind: 'inferno', start: +pick.split(':')[1], party });
}

// ================================================================================================ Rift Nexus entries
function trialOfWeek(now = Date.now()) {
  const w = weekId(now), rng = new RNG(w * 7919 + 13);
  const guardian = TRIAL.guardians[((w % TRIAL.guardians.length) + TRIAL.guardians.length) % TRIAL.guardians.length];
  const ids = Object.keys(AFFIXES); const a = [];
  while (a.length < 2) { const id = rng.pick(ids); if (!a.includes(id)) a.push(id); }
  return { week: w, guardian, affixes: a };
}
export { trialOfWeek };
registerPlugin({
  id: 'modes:nexus',
  init(session) { this.s = session; window.__modes ||= {}; window.__modes.session = session; },
  npcChoices(npcId) {
    if (npcId !== 'nexus') return [];
    const A = this.s.account, I = infernoRecords(A);
    const t = trialOfWeek(), def = BOSS_DEFS[t.guardian];
    const cleared = this.s.char ? trialState(this.s.char).cleared : false;
    cubeState(A);
    return [
      { id: 'modes:inferno', text: `Inferno Descent — 100 floors, boons, one life${I.best ? ` (best: Floor ${I.best})` : ''}`, kind: 'quest' },
      { id: 'modes:trial', text: `Trial Guardian — ${def?.name || t.guardian} · ${t.affixes.map(a => AFFIXES[a].name).join(' & ')}${cleared ? ' (cleared this week)' : ' (weekly reward)'}`, kind: 'quest' },
      { id: 'modes:cube', text: `Rift Cube — 10-room gauntlet (${A.count(CUBE.ticket)} ticket${A.count(CUBE.ticket) === 1 ? '' : 's'})`, kind: 'quest' },
    ];
  },
  onNpcChoice(npcId, choice) {
    if (npcId !== 'nexus' || !String(choice || '').startsWith('modes:')) return false;
    const s = this.s;
    if (s.guestMode) { s.ui.toast('Your host leads the party through the rifts.', 'info'); return true; }
    if (choice === 'modes:inferno') infernoMenu(s);
    else if (choice === 'modes:trial') s.launch({ kind: 'trial' });
    else if (choice === 'modes:cube') s.launch({ kind: 'cube' });
    return true;
  },
  hud(h) {
    const m = this.s?.game?.mode;
    if (m && m.questHud && (m.kind === 'inferno' || m.kind === 'cube' || m.kind === 'trial')) { try { const q = m.questHud(); if (q) (h.quests ||= []).unshift(q); } catch (e) { console.error('[modes hud]', e); } }
  },
});
