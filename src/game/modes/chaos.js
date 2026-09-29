// Chaos Dungeon: three stages of demon hordes. Kills fill the progress bar (elites and rift crystals fill it faster);
// at 100% a portal opens to the next stage; stage three ends with the Rift Warden. Ten-minute limit.
// Rewards scale with tier and double with rest bonus.
import { makeMob, refFor } from '../ai/mob.js';
import { Party } from '../party.js';
import { Unit } from '../unit.js';

export const CHAOS_TIERS = [
  { id: 1, name: 'Demon Rift I', ilvl: 1100 }, { id: 2, name: 'Demon Rift II', ilvl: 1250 },
  { id: 3, name: 'Demon Rift III', ilvl: 1400 }, { id: 4, name: 'Demon Rift IV', ilvl: 1500 },
];
const PCT = { imp: 0.55, wisp: 0.5, hellhound: 0.9, legionnaire: 1.6, abyss_caster: 1.2, gargoyle: 1.2, skeleton: 0.6, brute: 7, crystal_golem: 6 };
const STAGE_MIX = [
  [['imp', 8], ['hellhound', 3], ['legionnaire', 1]],
  [['imp', 6], ['hellhound', 3], ['legionnaire', 2], ['abyss_caster', 2], ['gargoyle', 1]],
  [['imp', 6], ['hellhound', 2], ['legionnaire', 3], ['abyss_caster', 2], ['brute', 1]],
];

export class ChaosMode {
  constructor(game, o) { this.kind = 'chaos'; this.game = game; this.o = o; this.stage = 0; this.pct = 0; this.state = 'play'; this.t = 0; this.limit = 600; this.kills = 0; this.crystals = []; }
  get L() { return this.game.level; }
  enter() {
    const g = this.game, L = this.L;
    this.ref = refFor(this.o.ilvl || 1400);
    this.party = g.party = new Party(g);
    this.party.addLocal(g.hero);
    if (this.o.allies) this.party.fill(1 + this.o.allies - (g.net?.count || 0), this.anchor('stage1:spawn'), this.o.ilvl, this.o.seed || 3);
    this.party.bindMeter();
    this.offs = [
      L.on('death', ({ unit, killer }) => this.onDeath(unit, killer)),
    ];
    this.startStage(0);
    g.audio?.music?.('dungeon');
  }
  exit() { for (const f of this.offs || []) f(); this.party?.dispose(); }
  anchor(name) { return this.game.zone.anchors?.[name] || { x: 0, z: 0, facing: 0 }; }
  startStage(i) {
    const g = this.game, L = this.L;
    this.stage = i; this.pct = 0; this.portal = null; this.bossSpawned = false; this.spawnT = 0.5;
    const sp = this.anchor(`stage${i + 1}:spawn`);
    for (const m of this.party.members) { const u = m.kit.u; u.pos.x = sp.x + (Math.random() - 0.5) * 2; u.pos.z = sp.z + (Math.random() - 0.5) * 2; u.facing = sp.facing || 0; L.emit('teleport', { unit: u, x: u.pos.x, z: u.pos.z }); }
    g.cam.snap(g.hero.u.pos);
    // clear leftovers
    for (const u of L.units.slice()) if (u.kind === 'mob' || u.data.crystal) L.remove(u);
    g.ui?.banner?.(`Stage ${i + 1}`, { kind: 'zone', sub: i === 2 ? 'Defeat the Rift Warden' : 'Purge the rift', dur: 2.2 });
    if (i === 1) this.spawnCrystals(4);
  }
  spawnCrystals(n) {
    const L = this.L;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + 0.4, p = { x: Math.cos(a) * 11, z: Math.sin(a) * 11 - 2 };
      const c = new Unit({ kind: 'mob', team: 1, type: 'rift_crystal', name: 'Rift Crystal', x: p.x, z: p.z, radius: 0.9, height: 2.4, stats: { hpMax: Math.round(this.ref.ap * 30), atk: 0, def: 1000, speed: 0, mpMax: 0 } });
      c.data.crystal = true; c.data.immovable = true; c.data.flinch = false; c.data.noModel = false; c.data.corpseTime = 1.5; c.ctrl = null;
      c.data.tpl = { model: 'pip_seed' };
      L.add(c); this.crystals.push(c);
    }
    this.game.ui?.toast?.('Rift Crystals appeared — shatter them for bonus progress!', 'info');
  }
  onDeath(u, killer) {
    if (u.kind === 'hero') return;
    if (u.data.crystal) { this.addPct(9); this.game.level.emit('fx', { unit: u, preset: 'crystal_shatter', x: u.pos.x, z: u.pos.z }); return; }
    if (u.data.warden) { this.finish(true); return; }
    this.kills++;
    this.addPct(PCT[u.type] ?? 1 * (u.data.elite ? 5 : 1));
  }
  addPct(v) {
    if (this.stage === 2 && this.bossSpawned) return;
    this.pct = Math.min(100, this.pct + v);
    if (this.pct >= 100) {
      if (this.stage < 2 && !this.portal) this.openPortal();
      if (this.stage === 2 && !this.bossSpawned) this.spawnWarden();
    }
  }
  openPortal() {
    const L = this.L, ex = this.anchor(`stage${this.stage + 1}:exit`);
    this.portal = { x: ex.x, z: ex.z };
    this.portalFx = this.game.presenter.call('portal', { pos: { x: ex.x, y: L.heightAt(ex.x, ex.z), z: ex.z }, color: 'arcane' });
    this.game.ui?.banner?.('The rift tears open', { kind: 'quest', sub: 'Step into the portal', dur: 2.2 });
    this.game.audio?.sfx?.('portal_open', {});
    for (const u of L.units) if (u.kind === 'mob' && !u.dead) { u.hp = 0; u.dead = true; L.emit('death', { unit: u, killer: null }); }
  }
  spawnWarden() {
    this.bossSpawned = true;
    const L = this.L, b = this.anchor('stage3:boss');
    const w = makeMob('brute', { x: b.x, z: b.z, ref: this.ref, alert: true, hpMul: 14, scale: 1.45, name: 'Rift Warden', atkMul: 1.4 });
    w.data.warden = true; w.data.elite = true; w.superArmor = 2; w.baseSuperArmor = 2;
    L.add(w);
    this.warden = w;
    this.game.ui?.banner?.('Rift Warden', { kind: 'boss', sub: 'Guardian of the Demon Rift', dur: 2.5 });
    this.game.audio?.sfx?.('boss_roar', {});
  }
  finish(ok) {
    if (this.state !== 'play') return;
    this.state = ok ? 'won' : 'lost';
    const rested = this.o.rested ? 2 : 1;
    this.result = { cleared: ok, time: this.t, kills: this.kills, tier: this.o.tier, rested, meter: this.party.meterRows() };
    this.game.ui?.banner?.(ok ? 'Chaos Dungeon cleared' : 'Time is up', { kind: ok ? 'victory' : 'fail', sub: fmt(this.t) });
    this.game.audio?.stinger?.(ok ? 'quest_complete' : 'wipe');
    setTimeout(() => this.o.onEnd?.(this.result), 2500);
  }
  update(dt) {
    if (this.state !== 'play') return;
    const g = this.game, L = this.L, me = g.hero.u;
    this.t += dt;
    if (this.t > this.limit) return this.finish(false);
    if (me.dead && me.deadT > 4) this.party.revive(me, this.anchor(`stage${this.stage + 1}:spawn`));
    // portal step-in
    if (this.portal && Math.hypot(me.pos.x - this.portal.x, me.pos.z - this.portal.z) < 2.2) { this.portalFx?.stop?.(); this.startStage(this.stage + 1); return; }
    if (this.portal || (this.stage === 2 && this.bossSpawned)) return;
    // keep the horde topped up
    this.spawnT -= dt;
    const alive = L.units.filter(u => u.kind === 'mob' && !u.dead && !u.data.crystal).length;
    const cap = 22 + this.stage * 6;
    if (this.spawnT <= 0 && alive < cap) {
      this.spawnT = 1.6 + Math.random();
      const mix = STAGE_MIX[this.stage];
      const pts = Object.entries(g.zone.anchors || {}).filter(([k]) => k.startsWith(`s${this.stage + 1}:m`)).map(([, v]) => v);
      const p = pts.length ? pts[Math.floor(Math.random() * pts.length)] : { x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20 };
      const n = Math.min(cap - alive, 5 + Math.floor(Math.random() * 4));
      for (let i = 0; i < n; i++) {
        let tot = mix.reduce((a, m) => a + m[1], 0), r = Math.random() * tot, type = mix[0][0];
        for (const [t, w] of mix) { r -= w; if (r <= 0) { type = t; break; } }
        const elite = type !== 'brute' && Math.random() < 0.04 + this.stage * 0.02;
        L.add(makeMob(type, { x: p.x + (Math.random() - 0.5) * 5, z: p.z + (Math.random() - 0.5) * 5, ref: this.ref, alert: true, elite }));
      }
      g.presenter.call('portal', { pos: { x: p.x, y: 0, z: p.z }, color: 'crimson', dur: 1.2 })?.stop && setTimeout(() => {}, 0);
    }
  }
  progressHud() { return { label: `Stage ${this.stage + 1} of 3`, pct: this.stage === 2 && this.bossSpawned ? (this.warden ? 1 - this.warden.hp / this.warden.hpMax : 1) * 100 : this.pct }; }
  timerHud() { return this.state === 'play' ? { label: 'Time left', left: this.limit - this.t } : null; }
  partyHud() { return this.party?.hud(); }
  bossHud() {
    const w = this.warden; if (!w || w.dead) return null;
    return { name: w.name, title: 'Guardian of the Demon Rift', hp: w.hp, hpMax: w.hpMax, barHp: w.hpMax / 20, bars: 20, stagger: null, destruction: null, enrageLeft: null, counter: false };
  }
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
