// Prologue — The Siege of Brighthold. A scripted set piece in the `brighthold` zone (a plain arena with the story
// layout until the world-fields owner's zone lands): the intro cutscene, the burning streets with Commander Brannoc,
// the rampart cannons against the siege behemoth Ashmaw, the Shard awakening (Lv 60 skills, Horned Tyrant gear and
// the awakening for a few glorious minutes), the duel with Varkhul (a scripted loss), and the escape by ship.
// The quests in src/data/quests/prologue.js are the tracker; this director reads their state and stages each beat.
//   Start:  session.launch({ kind: 'prologue' })   (or zoneMode('brighthold') after loadZone('brighthold'))
import * as THREE from 'three';
import { registerContent, registerZoneMode } from '../registry.js';
import '../../world/zones/brighthold.js';
import { ZONES } from '../providers.js';
import { FALLBACK_LAYOUT, LOCALS } from '../../data/field.js';
import { CLASSES } from '../../data/classes/index.js';
import { GEAR_SLOTS } from '../../data/items.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { STORY_BOSSES } from '../../data/story_bosses.js';
import { CUTSCENES } from '../../data/quests/index.js';
import { makeGear } from '../systems/gear.js';
import { heroStats } from '../systems/stats.js';
import { makeBoss } from '../ai/boss.js';
import { refFor } from '../ai/mob.js';
import { dealDamage, resolveHit } from '../combat.js';
import { xpForLevel } from '../account.js';
import { makeFieldMob, makeResident, makeAlly, storyDef, anchorOf, walkable, dist, warnOnce } from '../quests/spawn.js';
import { makeFieldProp } from '../quests/props.js';
import { Cutscene, screenFade } from '../quests/cutscene.js';
import { createShip } from '../../models/creatures/index.js';

const PROLOGUE_IDS = ['p1_fire', 'p2_blades', 'p3_guns', 'p4_shardfire', 'p5_ravager', 'p6_sails'];
const BEAT_ANCHORS = {
  street: ['poi:barricade', 'poi:town_square', 'poi:lower_town', 'poi:street', 'spawn'],
  gate: ['poi:outer_gate', 'poi:gate_ramp', 'poi:gate', 'poi:gatehouse', 'duel'],
  ramparts: ['poi:ramparts', 'cannon:2', 'cannon:1'],
  breach: ['breach', 'poi:breach'],
  ashmaw: ['boss:ashmaw'],
  bailey: ['poi:bailey', 'poi:inner_gate', 'duel'],
  courtyard: ['poi:courtyard', 'duel'],
  duel: ['duel', 'poi:courtyard', 'breach'],
  varkhul: ['boss:varkhul'],
  harbor: ['poi:harbor', 'gate:solhaven', 'poi:sallyport', 'poi:dock', 'spawn'],
};
/** a point `d` metres inside the wall from an anchor that faces outward (breach, gates); side shifts along the wall */
const inward = (a, d, side = 0) => { const fx = -Math.sin(a.facing || 0), fz = -Math.cos(a.facing || 0); return { x: a.x - fx * d - fz * side, z: a.z - fz * d + fx * side }; };
const outward = (a, d) => inward(a, -d);
const NIGHT = { hemiSky: 0x2a3050, hemiGround: 0x6a2a10, hemiIntensity: 0.9, sunColor: 0xff8a4a, sunIntensity: 1.6, sunDir: [-0.3, 0.55, 0.6], fogColor: 0x2a1410, fogDensity: 0.012, fogHeight: 0.03, background: 0x0a0608, grade: { exposure: 1.02, saturation: 1.08, contrast: 1.1, vignette: 0.5, warm: 0.14 } };

export class PrologueMode {
  constructor(session, zone) {
    this.s = session; this.g = session.game; this.zone = zone; this.kind = 'prologue';
    this.units = []; this.props = []; this.fx = []; this.t = 0; this.beat = null; this.spawnT = 0; this.awakened = false; this.manning = null;
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  get Q() { return this.s.quests; }
  A(key) { return anchorOf(this.g.zone, BEAT_ANCHORS[key] || key) || this.g.zone.anchors.spawn || { x: 0, z: 0, facing: 0 }; }
  // ---------------------------------------------------------------- setup
  enter() {
    const z = this.g.zone, g = this.g;
    z.anchors ||= {};
    this.real = !!ZONES.brighthold;
    if (!this.real) { for (const [k, a] of Object.entries(FALLBACK_LAYOUT.brighthold)) if (!z.anchors[k]) z.anchors[k] = { ...a }; z.name = 'Siege of Brighthold'; g.applyEnv({ ...(z.env || {}), ...NIGHT }); z.env = { ...(z.env || {}), ...NIGHT }; }
    z.id = 'brighthold';
    this.dressSet();
    // Brannoc fights at your side (and can be talked to for the quest steps)
    const sp = this.A('spawn');
    this.brannoc = makeAlly({ ...storyDef('brannoc'), id: 'brannoc' }, walkable(this.L, sp.x + 2, sp.z - 2.5, 4), { level: 5, leader: this.me, atkMul: 1.1, talkable: true, follow: 3.5 });
    this.L.add(this.brannoc); this.units.push(this.brannoc);
    this.talkers = [this.brannoc];
    this.spawnLocals();
    g.audio?.music?.('boss'); g.audio?.ambience?.('lava');
    this.weather = g.fx?.weather?.('embers', { intensity: 1.2 });
    this.me && (this.me.data.hpFloor = 1);        // nobody dies in the prologue
    this.intro = false;
  }
  exit() {
    this.endManning();
    if (this.awakened) this.awaken(false);
    for (const h of this.fx) h?.stop?.(); this.fx = [];
    this.weather?.stop?.();
    for (const p of this.props) p.removeFromParent(); this.props = [];
    this.ship?.root.removeFromParent();
    if (this.me) this.me.data.hpFloor = 0;
  }
  /** the zone's townsfolk (dockmaster, medic, refugees…) — the story characters are placed by the director */
  spawnLocals() {
    const A = this.g.zone.anchors || {};
    for (const [k, a] of Object.entries(A)) {
      if (!k.startsWith('npc:')) continue;
      const id = k.slice(4); if (id === 'brannoc' || id === 'seraphine' || id === 'sergeant') continue;
      const d = LOCALS[id]; if (!d) continue;
      const u = makeResident({ id, ...d }, { x: a.x, z: a.z, facing: a.facing ?? Math.PI }, { lod: 'crowd' });
      this.L.add(u); this.units.push(u); this.talkers.push(u);
    }
  }
  /** fires, smoke and (in the stand-in arena) cannons */
  dressSet() {
    const g = this.g, L = this.L, z = g.zone;
    const fire = (x, zz, s = 1.4) => { try { const h = g.fx?.play?.('campfire', { pos: { x, y: L.heightAt(x, zz), z: zz }, scale: s }); if (h) this.fx.push(h); } catch { /* */ } };
    if (!this.real) {
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + 0.2, r = 22 + (i % 3) * 4; fire(Math.cos(a) * r, Math.sin(a) * r, 1.6 + (i % 2)); }
      for (const k of ['cannon:1', 'cannon:2', 'cannon:3', 'cannon:4']) { const a = z.anchors[k]; if (!a) continue; const p = makeFieldProp('cannon', a.x, L.heightAt(a.x, a.z), a.z, 0); p.userData.setActive(false); g.scene.add(p); this.props.push(p); }
    }
    this.cannons = ['cannon:1', 'cannon:2', 'cannon:3', 'cannon:4'].map(k => z.anchors[k] && { key: k, ...z.anchors[k] }).filter(Boolean);
    if (!this.cannons.length) { const r = this.A('ramparts'); this.cannons = [-6, -2, 2, 6].map((dx, i) => ({ key: 'cannon:' + (i + 1), x: r.x + dx, z: r.z, facing: 0 })); warnOnce('cannons', 'brighthold: no cannon anchors — placing cannons on the ramparts'); }
  }
  // ---------------------------------------------------------------- the director
  update(dt) {
    const Q = this.Q, me = this.me; if (!Q || !me) return;
    this.t += dt;
    if (!this.intro) { this.intro = true; if (this.fresh()) this.playIntro(); else this.resume(); return; }
    if (this.manning) this.tickManning(dt);
    this.tickAshmaw(dt);
    this.tickDuel(dt);
    const st = k => Q.stepOf(k);
    let beat = null;
    if (Q.isActive('p1_fire')) beat = st('p1_fire') === 1 ? 'street' : st('p1_fire') === 2 ? 'toGate' : 'talk';
    else if (Q.isActive('p2_blades')) beat = st('p2_blades') === 0 ? 'gate' : 'ren';
    else if (Q.isActive('p3_guns')) beat = st('p3_guns') === 2 ? 'cannons' : 'ramparts';
    else if (Q.isActive('p4_shardfire')) beat = st('p4_shardfire') === 1 ? 'horde' : st('p4_shardfire') >= 2 ? 'finish' : 'awaken';
    else if (Q.isActive('p5_ravager')) beat = st('p5_ravager') === 0 ? 'toCourtyard' : st('p5_ravager') === 2 ? 'duel' : 'varkhul';
    else if (Q.isActive('p6_sails')) beat = 'escape';
    if (beat !== this.beat) this.enterBeat(beat, this.beat);
    this.beat = beat;
    this.spawnT -= dt;
    const alive = this.units.filter(u => u.kind === 'mob' && u.level && !u.dead).length;
    // waves for the fighting beats
    if (beat === 'street' && this.spawnT <= 0 && alive < 5) { this.spawnT = 2.5; this.wave(this.A('street'), [['imp', 3]], 1, 9); }
    if (beat === 'gate' && this.spawnT <= 0 && alive < 8) { this.spawnT = 3.2; this.wave(this.A('gate'), [['imp', 3], ['hellhound', 1]], 2, 10, -1); if (Math.random() < 0.3) this.wave(this.A('gate'), [['legionnaire', 1]], 2, 10, -1); }
    if (beat === 'toCourtyard' && this.spawnT <= 0 && alive < 5) { this.spawnT = 3; this.wave(this.A('bailey'), [['imp', 3], ['legionnaire', 1]], 4, 8, -1); }
    if (beat === 'horde' && this.spawnT <= 0 && alive < 26) { this.spawnT = 1.6; this.wave(inward(this.A('breach'), 2), [['imp', 4], ['hellhound', 2], ['legionnaire', 1], ['abyss_caster', Math.random() < 0.5 ? 1 : 0]], 4, 5); }
    if (beat === 'escape' && this.spawnT <= 0) { this.spawnT = 2.2; this.debris(); if (alive < 6 && me) this.wave({ x: me.pos.x, z: me.pos.z - 14 }, [['imp', 2]], 2, 5); }
    if (beat === 'escape') this.leadEscape(dt);
    if (beat === 'cannons' && this.spawnT <= 0 && alive < 3) { this.spawnT = 11; const c = this.manning?.cannon || this.cannons[0]; this.wave(inward(c, 6), [['imp', 2]], 3, 3); }
  }
  enterBeat(b, prev) {
    const g = this.g, bran = this.brannoc;
    if (b === 'street') this.hint('Right-click to move. Q W E R · A S D F use your skills. C is your basic attack.');
    if (b === 'toGate') { this.clearMobs(); this.hint('Space dashes you out of danger.'); }
    if (b === 'gate') { bran.ctrl.leader = this.me; }
    if (b === 'ren') {
      this.clearMobs();
      const at = anchorOf(this.g.zone, ['npc:sergeant']) || (() => { const g0 = this.A('gate'); return { x: g0.x - 2.5, z: g0.z + 3, facing: Math.PI }; })();
      const ren = makeResident({ ...storyDef('guard_ren') }, { ...walkable(this.L, at.x, at.z, 4), facing: at.facing ?? Math.PI }, { story: true });
      this.L.add(ren); this.units.push(ren); this.talkers.push(ren); this.ren = ren;
    }
    if (b === 'ramparts') { bran.ctrl.leader = this.me; }
    if (b === 'cannons') { this.spawnAshmaw(); this.hint('Press G at a cannon to man it. Click to fire. G again to step away.'); for (const p of this.props) p.userData.setActive?.(true); }
    if (b === 'awaken') {
      this.endManning(); for (const p of this.props) p.userData.setActive?.(false); this.clearMobs();
      // the wall came down on Brannoc: he's pinned until the Ravager arrives
      const bb = this.A('breach'); bran.ctrl.hold = true; bran.untargetable = true; bran.ctrl.leader = null;
      const pp = inward(bb, 7, 5), pin = walkable(this.L, pp.x, pp.z, 4); bran.pos.x = pin.x; bran.pos.z = pin.z; bran.model?.play?.('knockdown', { dur: 0.8 });
    }
    if (b === 'horde') { g.audio?.music?.('boss'); this.hint('The Shard burns in you. Everything is stronger — for now.'); }
    if (b === 'finish') {
      this.clearMobs(); this.hint('Press V to unleash your Awakening!', 'warn');
      const kit = this.g.hero; if (kit) { kit.awakenUses = Math.max(1, kit.awakenUses); kit.u.cd.delete(kit.awaken?.id); }
      this.ashmawLunge();
    }
    if (b === 'toCourtyard') { bran.ctrl.hold = false; bran.untargetable = false; bran.ctrl.leader = this.me; bran.model?.play?.('getup', { dur: 0.8 }); this.hint('Brannoc: “The Ravager is in the courtyard. With me!”'); }
    if (b === 'duel') this.startDuel();
    if (b === 'escape') {
      this.clearMobs(); g.audio?.music?.('dungeon'); this.hint('Run! Follow Seraphine to the harbour.', 'warn');
      this.talkers = this.talkers.filter(u => u !== bran);
      bran.ctrl.hold = true; bran.untargetable = true; bran.model?.play?.('block', { dur: 2, loop: true });
      if (this.varkhul?.level) { if (this.varkhul.ctrl) this.varkhul.ctrl.started = false; this.varkhul.untargetable = true; this.varkhul.faceTo(bran.pos.x, bran.pos.z); }
    }
    void prev;
  }
  hint(text, kind = 'info') { if (kind === 'warn') this.g.ui?.banner?.(text, { kind: 'warn' }); else this.g.ui?.toast?.(text, 'info'); }
  wave(at, mix, lvl = 2, r = 8, dirZ = 0) {
    const L = this.L, me = this.me;
    for (const [type, n] of mix) for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = r * (0.5 + Math.random() * 0.5);
      const p = walkable(L, at.x + Math.cos(a) * rr, at.z + Math.sin(a) * rr + dirZ * 4, 6);
      if (me && dist(p, me.pos) < 5) continue;
      const u = makeFieldMob(type, { level: this.awakened ? 5 : lvl, x: p.x, z: p.z, alert: true, delay: Math.random() * 0.5 });
      u.data.noLoot = true; L.add(u); this.units.push(u);
      this.g.presenter?.call?.('play', 'spawn_puff', { pos: u.pos, x: u.pos.x, z: u.pos.z });
    }
  }
  clearMobs() { for (const u of this.units) if (u.kind === 'mob' && u.level && !u.dead) { u.level.remove(u); } this.units = this.units.filter(u => u.kind !== 'mob'); }
  debris() {
    const me = this.me; if (!me || !this.L) return;
    const x = me.pos.x + (Math.random() - 0.5) * 8, z = me.pos.z + (Math.random() - 0.5) * 8;
    const src = this.brannoc;
    this.L.telegraph({ shape: 'circle', x, z, r: 2.2, dur: 1.3, color: 'orange', owner: null, team: 1 });
    this.L.after(1.3, () => {
      this.g.fx?.play?.('fire_burst', { pos: { x, y: this.L.heightAt(x, z), z }, x, z, r: 2.2 }); this.g.audio?.sfx?.('explosion', { pos: { x, y: 0, z } });
      if (this.me && Math.hypot(this.me.pos.x - x, this.me.pos.z - z) < 2.6) dealDamage(this.L, null, this.me, this.me.hpMax * 0.12, { fixed: Math.round(this.me.hpMax * 0.12) });
      void src;
    });
  }
  // ---------------------------------------------------------------- interaction (cannons, talkers)
  /** Seraphine runs ahead to the harbour, waiting whenever you fall behind */
  leadEscape(dt) {
    const sera = this.seraphine, me = this.me; if (!sera?.level || !me) return;
    const h = this.A('harbor'), dx = h.x - sera.pos.x, dz = h.z - sera.pos.z, d = Math.hypot(dx, dz);
    sera.move.x = sera.move.z = 0;
    if (d < 1.5) { sera.faceTo(me.pos.x, me.pos.z); return; }
    if (me.distTo(sera) > 9) { sera.faceTo(me.pos.x, me.pos.z); return; }
    sera.move.x = dx / d * 4.6; sera.move.z = dz / d * 4.6; sera.faceTo(h.x, h.z);
  }
  interactable() {
    const me = this.me; if (!me || this.manning) return null;
    let best = null, bd = 3.2;
    // someone the story wants you to talk to wins over whoever happens to be closest
    for (const u of this.talkers || []) { if (!u.level || u.dead) continue; const biz = this.Q?.business(u.data.npcDef?.id)?.talk.length ? 1.6 : 0; const d = me.distTo(u) - biz; if (me.distTo(u) < 3.2 && d < bd) { bd = d; best = u; } }
    if (this.beat === 'cannons' && !this.manning) for (const c of this.cannons) { const d = dist(me.pos, c); if (d < 3 && d < bd) { bd = d; best = { name: 'Rampart Cannon', label: 'Man', pos: { x: c.x, z: c.z }, data: { npcDef: { object: true } }, cannon: c }; } }
    return best;
  }
  interact(t) {
    if (t?.cannon) { this.startManning(t.cannon); return true; }
    return false;
  }
  // ---------------------------------------------------------------- the cannons
  startManning(c) {
    const g = this.g, me = this.me;
    const a = this.ashmaw; if (!a) return;
    me.pos.x = c.x; me.pos.z = c.z + 1.3; me.faceTo(a.pos.x, a.pos.z); g.player.stop();
    me.model?.play?.('rifle_aim', { loop: true, dur: 1.2 });
    this.manning = { cannon: c, cd: 0.4, input: g.player.input };
    g.player.input = (dt, inp, cam) => this.cannonInput(dt, inp, cam);
    // over-the-shoulder artillery view: the cannon in front, the behemoth filling the sky
    const y = this.L.heightAt(c.x, c.z), dx = a.pos.x - c.x, dz = a.pos.z - c.z, d = Math.hypot(dx, dz) || 1;
    g.cam.cinematic({ pos: [c.x - dx / d * 9 + 1.5, y + 8.5, c.z - dz / d * 9], look: [c.x + dx / d * 16, y + 4, c.z + dz / d * 16], dur: 0.9, fov: 52 });
    this.reticle = g.fx?.telegraph?.({ shape: 'circle', pos: { x: a.pos.x, y: 0, z: a.pos.z }, radius: 3, color: 'white' }) || null;
    g.audio?.sfx?.('reload', { pos: me.pos });
  }
  endManning() {
    const g = this.g, m = this.manning; if (!m) return;
    g.player.input = m.input; this.manning = null;
    g.cam.endCinematic?.(0.7);
    this.reticle?.stop?.(); this.reticle = null;
    this.me?.model?.stop?.();
  }
  cannonInput(dt, inp, cam) {
    const m = this.manning, me = this.me, a = this.ashmaw; if (!m || !me || !a) return;
    me.move.x = me.move.z = 0;
    const p = cam.groundAt(inp.mouse.x, inp.mouse.y, 0);
    const c = m.cannon, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1, R = 52;
    const aim = { x: c.x + dx / d * Math.min(R, Math.max(6, d)), z: c.z + dz / d * Math.min(R, Math.max(6, d)) };
    m.aim = aim;
    this.reticle?.setPos?.(aim.x, this.L.heightAt(aim.x, aim.z) + 0.05, aim.z);
    me.faceTo(aim.x, aim.z);
    m.cd -= dt;
    if (inp.hit('interact') || inp.hit('dash') || me.hp < me.hpMax * 0.35) { this.endManning(); return; }
    if ((inp.clicked(0) || inp.hit('basic')) && m.cd <= 0) this.fire(aim);
  }
  fire(aim) {
    const g = this.g, L = this.L, m = this.manning, c = m.cannon, me = this.me;
    m.cd = 1.5;
    const from = { x: c.x - Math.sin(me.facing) * 1.2, y: L.heightAt(c.x, c.z) + 1.3, z: c.z - Math.cos(me.facing) * 1.2 };
    const speed = 36, t = Math.hypot(aim.x - from.x, aim.z - from.z) / speed;
    try { g.fx?.projectile?.({ from, to: { x: aim.x, y: L.heightAt(aim.x, aim.z) + 1, z: aim.z }, speed, kind: 'rock', color: 'fire', size: 0.45, arc: 6 }); g.fx?.play?.('muzzle_flash', { pos: from, dir: { x: -Math.sin(me.facing), z: -Math.cos(me.facing) }, weapon: 'rifle' }); } catch { /* */ }
    g.audio?.sfx?.('cannon', { pos: from }); g.cam.shake(0.18);
    L.after(t, () => {
      const y = L.heightAt(aim.x, aim.z);
      g.fx?.play?.('explosion_big', { pos: { x: aim.x, y, z: aim.z }, x: aim.x, z: aim.z, r: 3 }); g.audio?.sfx?.('explosion', { pos: { x: aim.x, y, z: aim.z } });
      const a = this.ashmaw;
      if (a && !a.dead && Math.hypot(aim.x - a.pos.x, aim.z - a.pos.z) < a.radius + 3.5) {
        dealDamage(L, me, a, 0, { fixed: Math.round(a.hpMax * 0.1) });
        a.model?.play?.('hit', { dur: 1.2 }); g.cam.shake(0.35);
        g.fx?.number?.({ x: a.pos.x, y: a.pos.y + 9, z: a.pos.z }, 'DIRECT HIT', { style: 'crit', scale: 1.4 });
        this.Q?.signal('cannon_hit');
      } else if (me) resolveHit(L, me, { shape: 'circle', r: 3.2, coef: 6, knock: 'down' }, aim.x, aim.z, 0, -1, { skill: 'cannon', kind: 'item' });
    });
  }
  tickManning(dt) { if (this.beat !== 'cannons') this.endManning(); }
  // ---------------------------------------------------------------- Ashmaw
  spawnAshmaw() {
    if (this.ashmaw?.level) return;
    const def = BOSS_DEFS.ashmaw || STORY_BOSSES.ashmaw;
    const b = this.A('breach'), at = anchorOf(this.g.zone, BEAT_ANCHORS.ashmaw) || { ...outward(b, 16), facing: (b.facing || 0) + Math.PI };
    const u = makeBoss(def, { ref: refFor(4), partySize: 1, x: at.x, z: at.z, facing: at.facing ?? 0 });
    u.ctrl = null; u.data.immovable = true; u.data.hpFloor = Math.round(u.hpMax * 0.35); u.untargetable = false; u.data.noLoot = true;
    u.facing = Math.atan2(-(b.x - at.x), -(b.z - at.z));   // glaring at the breach
    this.L.add(u); this.units.push(u); this.ashmaw = u;
    this.ashT = 5;
  }
  tickAshmaw(dt) {
    const a = this.ashmaw; if (!a || a.dead || !a.level) return;
    const me = this.me;
    if (this.beat === 'cannons') {
      this.ashT -= dt;
      if (this.ashT <= 0 && me) {
        this.ashT = 7.5;
        const target = this.manning?.cannon || { x: me.pos.x, z: me.pos.z };
        a.model?.play?.('breath', { dur: 3.2 });
        this.g.ui?.banner?.('Ashmaw breathes fire at the ramparts — get off the cannon!', { kind: 'warn' });
        const dx = target.x - a.pos.x, dz = target.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
        this.L.telegraph({ shape: 'circle', x: target.x, z: target.z, r: 4.2, dur: 1.9, color: 'orange', owner: a, team: 1 });
        this.L.after(1.9, () => {
          if (!a.level || a.dead) return;
          try { this.g.fx?.play?.('fire_breath', { pos: { x: a.pos.x, y: 0, z: a.pos.z }, dir: { x: dx / d, z: dz / d }, len: d + 3, angle: 0.3, dur: 1.2 }); } catch { /* */ }
          this.g.fx?.play?.('fire_burst', { pos: { x: target.x, y: 0, z: target.z }, x: target.x, z: target.z, r: 4 });
          if (me && Math.hypot(me.pos.x - target.x, me.pos.z - target.z) < 4.6) { dealDamage(this.L, a, me, 0, { fixed: Math.round(me.hpMax * 0.3) }); this.endManning(); }
        });
      }
    }
  }
  ashmawLunge() {
    const a = this.ashmaw; if (!a?.level) return;
    const b = this.A('breach'), p = outward(b, 8);
    a.pos.x = p.x; a.pos.z = p.z; a.data.hpFloor = 0;
    a.model?.play?.('roar', { dur: 3 }); this.g.audio?.sfx?.('boss_roar_big', { pos: a.pos }); this.g.cam.shake(0.6);
    this.offAwaken?.(); this.offAwaken = this.L.on('awaken', ({ unit }) => {
      if (unit !== this.me) return;
      this.offAwaken?.(); this.offAwaken = null;
      this.L.after(1.6, () => this.killAshmaw());
    });
  }
  killAshmaw() {
    const a = this.ashmaw, g = this.g; if (!a?.level || a.dead) { this.Q?.signal('ashmaw_down'); return; }
    a.data.hpFloor = 0; dealDamage(this.L, this.me, a, 0, { fixed: a.hp + 1 });
    g.cam.shake(0.9); g.renderer.fx.flash = 0.6;
    for (let i = 0; i < 5; i++) this.L.after(i * 0.35, () => g.fx?.play?.('explosion_big', { pos: { x: a.pos.x + (Math.random() - 0.5) * 8, y: 4 + Math.random() * 6, z: a.pos.z + (Math.random() - 0.5) * 4 }, r: 4 }));
    g.ui?.banner?.('Ashmaw falls!', { kind: 'success', sub: 'The siege behemoth is down' });
    g.audio?.sfx?.('boss_roar_big', { pos: a.pos });
    this.L.after(2.2, () => this.Q?.signal('ashmaw_down'));
  }
  // ---------------------------------------------------------------- the Shard's borrowed power
  awaken(on) {
    const s = this.s, kit = this.g.hero, c = s.char; if (!kit) return;
    const u = kit.u;
    if (on && !this.awakened) {
      const tmp = { ...c, level: 60, skills: {}, equip: {}, engr: [] };
      for (const k of CLASSES[c.cls].skills) tmp.skills[k.id] = { lv: 10, tri: [0, 1, 0] };
      for (const sl of GEAR_SLOTS) tmp.equip[sl] = makeGear('horned', sl, c.cls, { hone: 15, quality: 90 });
      kit.char = tmp; u.setStats(heroStats(tmp, {})); u.hp = u.hpMax; u.mp = u.mpMax; kit.rebuild(); kit.awakenUses = 3;
      u.cd.clear();
      try { u.model?.setGear?.({ tier: 2 }); u.model?.setWeapon?.({ tier: 2, hone: 18 }); } catch { /* */ }
      this.awakened = true;
      this.aura = this.g.fx?.aura?.({ attach: u.model?.root, kind: 'holy', color: 'gold', scale: 1.1 }) || null;
    } else if (!on && this.awakened) {
      kit.char = c; u.setStats(heroStats(c, { rosterLevel: s.account.roster.level })); kit.rebuild(); u.hp = Math.max(1, Math.round(u.hpMax * 0.3));
      u.cd.clear(); kit.awakenUses = CLASSES[c.cls].awakening.uses ?? 3;
      try { u.model?.setGear?.({ tier: 0 }); u.model?.setWeapon?.({ tier: 0, hone: 0 }); } catch { /* */ }
      this.aura?.stop?.(); this.aura = null;
      this.awakened = false;
    }
  }
  hudExtra(h) {
    if (this.awakened) { h.level = 60; h.buffs = [{ id: 'shardfire', icon: 'status:atk_up', name: 'Shardfire — the Shard’s borrowed power', left: 99, dur: 99, stacks: 1, debuff: false }, ...(h.buffs || [])]; }
    if (this.manning) h.interact = null;
    const a = this.ashmaw;
    if (a?.level && !a.dead && (this.beat === 'cannons' || this.beat === 'horde' || this.beat === 'finish')) h.boss = { name: a.name, title: a.data.def?.title || 'the Siege Behemoth', hp: a.hp, hpMax: a.hpMax, barHp: a.hpMax / 10, bars: 10, stagger: null, destruction: null, enrageLeft: null, counter: false };
    const v = this.varkhul;
    if (v?.level && this.beat === 'duel') h.boss = { name: v.name, title: v.data.def?.title || 'the Ravager', hp: v.hp, hpMax: v.hpMax, barHp: v.hpMax / 40, bars: 40, stagger: v.data.stagger ? { v: v.data.stagger.v, max: v.data.stagger.max } : null, destruction: null, enrageLeft: null, counter: (v.data.counterWindow || 0) > 0 };
  }
  // ---------------------------------------------------------------- Varkhul
  startDuel() {
    const def = BOSS_DEFS.varkhul || STORY_BOSSES.varkhul;
    const v = this.varkhul; if (!v) return;
    if (v.ctrl) v.ctrl.started = true; v.data.hpFloor = Math.round(v.hpMax * 0.62);
    this.duelT = 0; this.duelOver = false;
    this.g.audio?.music?.(def.music || 'boss');
    this.g.ui?.banner?.('Varkhul', { kind: 'boss', sub: 'the Ravager', dur: 2.4 });
  }
  spawnVarkhul(at) {
    if (this.varkhul?.level) return this.varkhul;
    const def = BOSS_DEFS.varkhul || STORY_BOSSES.varkhul;
    const u = makeBoss(def, { ref: refFor(1340), partySize: 1, x: at.x, z: at.z, facing: Math.PI, hpScale: 0.25 });
    u.data.noLoot = true; u.data.encounter = null; u.ctrl.started = false;
    this.L.add(u); this.units.push(u); this.varkhul = u;
    return u;
  }
  tickDuel(dt) {
    if (this.beat !== 'duel' || this.duelOver) return;
    const v = this.varkhul, me = this.me; if (!v || !me) return;
    this.duelT += dt;
    const done = this.duelT > 38 || v.hp <= v.data.hpFloor + 1 || me.hp <= me.hpMax * 0.22;
    if (done) { this.duelOver = true; if (v.ctrl) { v.ctrl.interrupt(0); v.ctrl.started = false; } this.Q?.signal('duel'); }
  }
  // ---------------------------------------------------------------- intro & ending
  /** a brand-new siege (nothing done yet) opens with the intro; a prologue left mid-way picks up where it stopped */
  fresh() { const Q = this.Q; return !PROLOGUE_IDS.some(id => Q.isDone(id)) && Q.stepOf('p1_fire') <= 0; }
  resume() {
    const Q = this.Q, me = this.me, st = k => Q.stepOf(k); if (!Q || !me) return;
    let at = null;
    if (Q.isActive('p1_fire')) at = st('p1_fire') >= 2 ? 'street' : null;
    else if (Q.isActive('p2_blades')) at = 'gate';
    else if (Q.isActive('p3_guns')) at = st('p3_guns') >= 1 ? 'ramparts' : 'gate';
    else if (Q.isActive('p4_shardfire')) at = 'breach';
    else if (Q.isActive('p5_ravager')) at = st('p5_ravager') >= 1 ? 'duel' : 'bailey';
    else if (Q.isActive('p6_sails')) at = 'duel';
    const a = at && anchorOf(this.g.zone, BEAT_ANCHORS[at]);
    if (a) {
      const p = at === 'breach' ? walkable(this.L, inward(a, 9).x, inward(a, 9).z, 6) : walkable(this.L, a.x, a.z + 3, 6);
      me.pos.x = p.x; me.pos.z = p.z; me.pos.y = this.L.heightAt(p.x, p.z);
      const b = this.brannoc; if (b) { const q = walkable(this.L, p.x + 2, p.z - 1.5, 4); b.pos.x = q.x; b.pos.z = q.z; }
      this.g.player?.stop?.(); this.g.cam?.snap?.(me.pos);
    }
    // the Shard was already burning when they left, and the monsters it was burning for are still here
    if (Q.isActive('p4_shardfire')) { this.spawnAshmaw(); if (st('p4_shardfire') >= 1) this.awaken(true); }
    if (Q.isActive('p5_ravager') && st('p5_ravager') < 3) this.awaken(true);
    if (Q.isActive('p5_ravager') && st('p5_ravager') >= 2) { const vk = anchorOf(this.g.zone, BEAT_ANCHORS.varkhul) || { x: me.pos.x, z: me.pos.z - 8 }; const v = this.spawnVarkhul({ x: vk.x, z: vk.z }); v?.faceTo(me.pos.x, me.pos.z); }
    if (Q.isActive('p6_sails') && !this.seraphine?.level) {
      const d = storyDef('seraphine'), q = walkable(this.L, me.pos.x - 2.5, me.pos.z + 2.5, 4);
      if (d) { const u = makeResident(d, { x: q.x, z: q.z, facing: 0 }, { story: true }); u.data.cineActor = true; u.ctrl = null; this.L.add(u); this.units.push(u); this.seraphine = u; }
    }
    this.g.audio?.music?.('boss');
    this.g.ui?.banner?.('The Siege of Brighthold', { kind: 'zone', sub: 'Prologue', dur: 3 });
  }
  async playIntro() {
    await Cutscene.play(this.s, async cs => {
      const me = cs.hero, sp = this.A('spawn'), y = cs.L.heightAt(sp.x, sp.z);
      cs.fade(1, 0.01);
      me.model?.play?.('knockdown', { dur: 0.8 });
      cs.shot([sp.x + 14, y + 22, sp.z + 26], [sp.x, y, sp.z - 16], 0.01, 50);
      await cs.fade(0, 1.6);
      await cs.say(null, 'Solmara. The night the sky burned.', 3);
      cs.shot([sp.x + 6, y + 10, sp.z + 13], [sp.x, y + 1, sp.z - 6], 5, 44);
      await cs.say(null, 'Brighthold had stood for four hundred years. The Abyssal Legion came for it in a single night.', 3.8);
      await cs.say(null, 'The last supply ship from Solhaven made port just as the demons came over the walls — carrying one passenger with a light the Legion could smell from across the sea.', 5);
      cs.sfx('explosion_big', { x: sp.x - 6, y, z: sp.z - 8 }); cs.shake(0.6); cs.flash(0.4);
      cs.fx('explosion_big', { x: sp.x - 6, z: sp.z - 8, r: 4 });
      cs.shot([sp.x + 2.2, y + 2.6, sp.z + 4.2], [sp.x, y + 0.6, sp.z], 2, 34);
      const b = this.brannoc; if (b) { cs.face(b, me); cs.walk(b, me.pos.x + 1.6, me.pos.z - 1.2, 5); }
      await cs.say('brannoc', 'You — off the docks! On your feet! The Legion is in the lower town!', 2.8);
      me.model?.play?.('getup', { dur: 0.9 });
      await cs.wait(0.9);
      await cs.title('The Siege of Brighthold', 'Prologue', 2.8);
    }, { music: 'cutscene_heroic', after: 'boss' });
  }
  async finishPrologue() {
    if (this.finishing) return; this.finishing = true; this.s.storyTransition = true;
    const s = this.s, A = s.account, c = s.char;
    if (this.awakened) this.awaken(false);
    c.zone = 'solhaven'; c.flags ||= {}; c.flags.welcomed = true;
    if ((c.level || 1) < 5) { let need = 0; for (let l = c.level; l < 5; l++) need += xpForLevel(l); A.addXp(c, need - (c.xp || 0) + 1); }
    A.save();
    await screenFade(1, 0.9);
    try { await arriveInSolhaven(s); } finally { s.storyTransition = false; }
  }
}

/** load Solhaven at dawn, the Dawnrunner at the pier, Seraphine and you stepping off — Chapter I begins */
export async function arriveInSolhaven(s) {
  const g = s.game;
  await s.loadZone('solhaven', { kind: 'city', region: 'Valemont' });
  const z = g.zone, dock = z.anchors['dock:ship'] || z.anchors.spawn;
  const pier = walkable(g.level, dock.x - 6, dock.z, 5);
  s.spawnMe({ x: pier.x, z: pier.z, facing: Math.PI / 2 });
  g.mode = s.hub = s.zoneMode('solhaven'); s.hub.enter(); s.inWorld();
  try { const env = z.setEnv?.('dusk'); if (env) g.applyEnv(env); } catch { /* */ }
  let ship = null;
  try { ship = createShip?.('dawnrunner'); if (ship) { ship.root.position.set(dock.x + 9, 0, dock.z); ship.root.rotation.y = Math.PI; g.scene.add(ship.root); } } catch (e) { ship = null; }
  s.bus.emit('zone', { id: 'solhaven', kind: 'city' });
  await Cutscene.play(s, async cs => {
    const me = cs.hero; const p = me.pos, y = cs.L.heightAt(p.x, p.z);
    cs.shot([p.x - 12, y + 6, p.z + 14], [p.x + 8, y + 1, p.z - 2], 0.01, 44);
    await cs.fade(0, 1.8);
    await cs.say(null, 'Dawn. Solhaven, the last free port of Valemont.', 2.8);
    const sera = cs.spawn('seraphine', { x: p.x - 1.2, z: p.z + 1.4, facing: Math.PI / 2 });
    cs.shot([p.x - 4, y + 2.4, p.z + 5.5], [p.x, y + 1.2, p.z], 3, 36);
    await cs.say('seraphine', 'We made it. Brighthold is gone… but we made it.', 2.8);
    if (sera) cs.anim(sera, 'point', 1.6);
    await cs.say('seraphine', 'Come. Brannoc held the gate so we could run. Let’s make it worth it.', 3);
  }, { music: 'cutscene_heroic', after: 'city' });
  ship && setTimeout(() => { ship.root.removeFromParent(); ship.dispose?.(); }, 1500);
  try { const env = z.setEnv?.('day'); if (env) g.applyEnv(env); } catch { /* */ }
}

// ------------------------------------------------------------------------------------------------ cutscenes
Object.assign(CUTSCENES, {
  pro_ashmaw: { music: 'cutscene_heroic', after: 'boss', run: async (cs, Q) => {
    const M = cs.g.mode; if (!M?.spawnAshmaw) return;
    M.spawnAshmaw();
    const a = M.ashmaw, me = cs.hero; if (!a) return;
    const y = cs.L.heightAt(me.pos.x, me.pos.z);
    const dx = a.pos.x - me.pos.x, dz = a.pos.z - me.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    cs.face(me, a.pos);
    cs.shot([me.pos.x - ux * 6 - uz * 2, y + 3.2, me.pos.z - uz * 6 + ux * 2], [me.pos.x + ux * 10, y + 3, me.pos.z + uz * 10], 0.01, 42);
    await cs.say('gunner_bess', 'The guns! Somebody man the guns — it’s coming through the east wall!', 2.6);
    cs.shot([me.pos.x - ux * 5 + uz * 7, y + 5, me.pos.z - uz * 5 - ux * 7], [a.pos.x, y + 9, a.pos.z], 2.2, 50);
    a.model?.play?.('roar', { dur: 4 }); cs.sfx('boss_roar_big', a.pos); cs.shake(0.7);
    await cs.title('Ashmaw', 'the Siege Behemoth', 2.8);
    a.model?.play?.('slam_wall', { dur: 4.2 });
    await cs.wait(2.3); cs.shake(0.8); cs.sfx('explosion_big', a.pos); cs.fx('explosion_big', { x: a.pos.x, z: a.pos.z + 8, r: 6 });
    await cs.say('brannoc', 'Guns, Shardbearer! Make it look at something other than my walls!', 2.8);
  } },
  pro_awaken: { music: 'cutscene_heroic', after: 'boss', run: async (cs, Q) => {
    const M = cs.g.mode, me = cs.hero; if (!M || !me) return;
    const a = M.ashmaw, b = M.A('breach'), y = cs.L.heightAt(b.x, b.z);
    { const cam = inward(b, 16, -8), far = outward(b, 10); cs.shot([cam.x, y + 9, cam.z], [far.x, y + 5, far.z], 0.01, 46); }
    if (a) { a.model?.play?.('slam_wall', { dur: 3.6 }); }
    await cs.say(null, 'Wounded and furious, Ashmaw throws itself at the wall one last time.', 2.4);
    cs.shake(1); cs.flash(0.7); cs.sfx('explosion_big', b);
    for (let i = 0; i < 4; i++) { const p = inward(b, 0, (i - 1.5) * 4); cs.fx('explosion_big', { x: p.x, z: p.z, r: 4 }); }
    cs.fx('crater', { x: b.x, z: b.z, r: 6 });
    await cs.wait(0.8);
    { const p = inward(b, 9, -1.5); cs.place(me, p.x, p.z); }
    me.model?.play?.('knockdown', { dur: 0.8 });
    cs.shot([me.pos.x + 3, y + 2.4, me.pos.z + 4.5], [me.pos.x, y + 0.5, me.pos.z], 1.2, 34);
    await cs.say('brannoc', 'The breach! They’re pouring through the breach!', 2.4);
    await cs.say(null, 'You try to rise. You can’t. And then — something in your chest answers.', 3);
    cs.music('cutscene_heroic');
    cs.fx('awaken_aura', { pos: me.pos, x: me.pos.x, z: me.pos.z, unit: me.model?.root });
    cs.flash(1); cs.sfx('awaken', me.pos); cs.shake(0.5);
    M.awaken(true);
    me.model?.play?.('awaken', { dur: 1.8 });
    cs.shot([me.pos.x + 1.8, y + 1.9, me.pos.z + 3.4], [me.pos.x, y + 1.3, me.pos.z], 2.2, 30);
    await cs.say('seraphine', '(From somewhere far away, a girl’s voice:) The Shard — it’s answering you! Let it in!', 3);
    await cs.title('Shardfire', 'The Shard awakens', 2.6);
  } },
  pro_varkhul: { music: 'cutscene_sad', after: 'boss', run: async (cs, Q) => {
    const M = cs.g.mode, me = cs.hero; if (!M || !me) return;
    M.clearMobs();
    const d = M.A('duel'), y = cs.L.heightAt(d.x, d.z);
    const vk = anchorOf(cs.g.zone, BEAT_ANCHORS.varkhul) || { x: d.x, z: d.z - 8 };
    const v = M.spawnVarkhul({ x: vk.x, z: vk.z });
    v.faceTo(me.pos.x, me.pos.z);
    cs.shot([d.x + 9, y + 6, d.z + 12], [vk.x, y + 2, vk.z + 2], 0.01, 42);
    cs.walk(me, d.x, d.z + 4);
    v.model?.play?.('intro', { dur: 5 }); cs.sfx('boss_roar', v.pos); cs.shake(0.4);
    cs.fx('fire_burst', { x: v.pos.x, z: v.pos.z, r: 4 });
    await cs.say('Varkhul', 'So. The little Shardbearer. You have been busy, breaking my toys.', 3.2);
    cs.shot([v.pos.x + 3, y + 3.6, v.pos.z + 5.5], [v.pos.x, y + 2.6, v.pos.z], 2, 32);
    await cs.say('Varkhul', 'The Emperor wants that light in your chest. I think I’ll take it out myself.', 3.4);
    await cs.title('Varkhul', 'the Ravager', 2.4);
    await cs.say('brannoc', 'Shardbearer — he’s too strong! Don’t —', 2);
  } },
  pro_loss: { music: 'cutscene_sad', after: 'dungeon', run: async (cs, Q) => {
    const M = cs.g.mode, me = cs.hero; if (!M || !me) return;
    const v = M.varkhul, y = cs.L.heightAt(me.pos.x, me.pos.z);
    cs.shot([me.pos.x + 5, y + 4, me.pos.z + 7], [me.pos.x, y + 1.2, me.pos.z - 1], 0.01, 40);
    if (v) { cs.face(v, me); v.model?.play?.('overhead', { dur: 2 }); }
    await cs.say('Varkhul', 'Enough.', 1.4);
    cs.flash(0.9); cs.shake(0.8); cs.sfx('explosion_big', me.pos);
    cs.fx('crater', { x: me.pos.x, z: me.pos.z, r: 4 });
    M.awaken(false);
    me.model?.play?.('knockdown', { dur: 0.8 });
    await cs.say(null, 'The Shard’s fire gutters out like a candle in the rain. The borrowed strength goes with it.', 3.2);
    if (v) { cs.walk(v, me.pos.x, me.pos.z - 2.4, 2.2); }
    cs.shot([me.pos.x + 2.5, y + 2.2, me.pos.z + 3.5], [me.pos.x, y + 1.6, me.pos.z - 2], 2.2, 34);
    await cs.say('Varkhul', 'Such a small light. I expected more.', 2.8);
    if (v) v.model?.play?.('overhead', { dur: 2.2 });
    await cs.wait(0.8);
    const b = M.brannoc;
    if (b) { cs.place(b, me.pos.x + 1.2, me.pos.z - 1.2); b.model?.play?.('block', { dur: 2, loop: true }); }
    cs.shake(0.6); cs.sfx('block', me.pos); cs.flash(0.4);
    await cs.say('brannoc', 'Not today, Ravager!', 1.8);
    const sera = cs.spawn('seraphine', { x: me.pos.x - 2.5, z: me.pos.z + 2.5, facing: 0 }, { keep: true });
    M.seraphine = sera;
    me.model?.play?.('getup', { dur: 0.9 });
    await cs.say('seraphine', 'Get up! Get UP! There’s a boat at the harbour — come on!', 2.6);
    await cs.say('brannoc', 'Go! Both of you! I’ll hold him! GO!', 2.4);
    if (v) { if (v.ctrl) v.ctrl.started = false; v.untargetable = true; }
  } },
  pro_escape: { music: 'cutscene_sad', run: async (cs, Q) => {
    const M = cs.g.mode, me = cs.hero; if (!me) return;
    const y = cs.L.heightAt(me.pos.x, me.pos.z);
    cs.shot([me.pos.x - 6, y + 5, me.pos.z + 9], [me.pos.x + 4, y + 1, me.pos.z - 4], 0.01, 44);
    await cs.say('seraphine', 'The boat — jump! JUMP!', 2);
    cs.shake(0.5); cs.sfx('explosion_big', me.pos);
    await cs.say(null, 'Behind you, Brighthold burns. Somewhere in the fire, a commander still stands at the gate.', 3.4);
    await cs.fade(1, 1.4);
    cs.sfx('wave_splash'); cs.sfx('ship_bell');
    await cs.title('Brighthold has fallen', 'Prologue', 3);
    void M;
  }, keepBlack: true },
});

// ------------------------------------------------------------------------------------------------ registration
registerZoneMode('brighthold', (session, zone) => new PrologueMode(session, zone));
registerContent('prologue', async (session) => {
  const c = session.char; if (!c) return;
  session.ui.npc?.finish?.(null);
  await session.loadZone('brighthold', { kind: 'field', region: 'Prologue' });
  const z = session.game.zone; z.anchors ||= {};
  if (!ZONES.brighthold) for (const [k, a] of Object.entries(FALLBACK_LAYOUT.brighthold)) if (!z.anchors[k]) z.anchors[k] = { ...a };
  const sp = z.anchors.spawn || { x: 0, z: 0, facing: 0 };
  session.spawnMe(sp);
  session.game.mode = new PrologueMode(session, z);
  session.game.mode.enter();
  session.inWorld();
});
