// Party (4) / raid (8): the local hero, AI SimPlayers and (in co-op) remote friends. Builds allies from SimPlayer
// identities, revives the fallen after a delay, and reports frames + a live damage meter.
import { HeroKit } from './hero.js';
import { AllyAI } from './ai/ally.js';
import { heroStats } from './systems/stats.js';
import { makeSim } from './social/names.js';
import { CLASSES } from '../data/classes/index.js';

/** A full character record for a SimPlayer at an item level (all skills 10, tripods picked by seed). */
export function simChar(sim, ilvl = 1415) {
  const cls = CLASSES[sim.cls] ? sim.cls : 'reaver';
  const c = { name: sim.name, cls, sex: sim.sex, level: 60, look: sim.look, gear: sim.gear, engr: [], skills: {}, sim: true, persona: sim.persona, title: sim.title, guild: sim.guild };
  let s = sim.seed || 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const k of CLASSES[cls].skills) c.skills[k.id] = { lv: 10, tri: [Math.floor(r() * 3), Math.floor(r() * 3), Math.floor(r() * 2)] };
  c.equip = Object.fromEntries(['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'].map(sl => [sl, { iLvl: ilvl + Math.round((r() - 0.5) * 20), quality: 50 + Math.round(r() * 50) }]));
  return c;
}

export class Party {
  constructor(game) {
    this.game = game; this.members = []; // { kit, ai, remote, sim, stats: meter }
    this.meter = new Map();               // unit id → { dmg, crit, hits, back, head, counters, stagger, heal, shield, taken, deaths, name, cls }
    this.startT = 0;
  }
  get level() { return this.game.level; }
  addLocal(kit) { this.members.push({ kit, local: true }); kit.u.party = this; return kit; }
  addSim(sim, at, ilvl) {
    const char = simChar(sim, ilvl);
    const kit = new HeroKit(this.level, char, heroStats(char), { x: at.x, z: at.z, facing: at.facing });
    kit.u.data.look = char.look; kit.u.data.gear = char.gear; kit.u.data.sex = char.sex; kit.u.data.sim = sim; kit.u.data.lod = 'full';
    const ai = new AllyAI(kit, sim.persona);
    this.members.push({ kit, ai, sim });
    kit.u.party = this;
    this.level.add(kit.u);
    return kit;
  }
  /** Fill up to n members with SimPlayers, preferring supports when the party has none. */
  fill(n, at, ilvl = 1415, seed = Date.now()) {
    const needSupports = n >= 8 ? 2 : 1;
    let supports = this.members.filter(m => CLASSES[m.kit.char.cls]?.role === 'support').length;
    let i = 0;
    const available = Object.keys(CLASSES);
    // friends you invited in town come first
    for (const sim of this.game.invitedSims || []) {
      if (this.members.length >= n) break;
      if (this.members.some(m => m.sim === sim)) continue;
      if (CLASSES[sim.cls]?.role === 'support') supports++;
      const a = (this.members.length / n) * Math.PI * 2;
      this.addSim(sim, { x: at.x + Math.cos(a) * 2, z: at.z + 1.5 + Math.sin(a) * 1.5, facing: at.facing || 0 }, ilvl);
    }
    while (this.members.length < n) {
      const wantSupport = supports < needSupports && (n - this.members.length) <= (needSupports - supports) + 1;
      const supportCls = available.filter(c => CLASSES[c].role === 'support');
      const dpsCls = available.filter(c => CLASSES[c].role !== 'support');
      const pool = wantSupport && supportCls.length ? supportCls : dpsCls.length ? dpsCls : available;
      const cls = pool[(seed + i * 7) % pool.length];
      const sim = makeSim(seed + i * 101, { cls });
      if (CLASSES[cls].role === 'support') supports++;
      const a = (this.members.length / n) * Math.PI * 2;
      this.addSim(sim, { x: at.x + Math.cos(a) * 2, z: at.z + 1.5 + Math.sin(a) * 1.5, facing: at.facing || 0 }, ilvl);
      i++;
    }
  }
  bindMeter() {
    const L = this.level; this.startT = L.time;
    const row = u => { let r = this.meter.get(u.id); if (!r) this.meter.set(u.id, r = { id: u.id, name: u.name, cls: u.cls, dmg: 0, crits: 0, hits: 0, back: 0, head: 0, counters: 0, stagger: 0, heal: 0, shield: 0, taken: 0, deaths: 0, you: u === L.localHero }); return r; };
    this.offs = [
      L.on('damage', ev => {
        if (ev.src?.kind === 'hero' && ev.src.party === this) { const r = row(ev.src); r.dmg += ev.amount; r.hits++; if (ev.crit) r.crits++; if (ev.back) r.back++; if (ev.head) r.head++; if (ev.counter) r.counters++; if (ev.tgt.kind === 'boss') r.bossDmg = (r.bossDmg || 0) + ev.amount; }
        if (ev.tgt?.kind === 'hero' && ev.tgt.party === this) row(ev.tgt).taken += ev.amount + (ev.absorbed || 0);
      }),
      L.on('heal', ev => { if (ev.src?.party === this) row(ev.src).heal += ev.real || 0; }),
      L.on('shield', ev => { if (ev.src?.party === this) row(ev.src).shield += ev.amount; }),
      L.on('death', ev => { if (ev.unit.kind === 'hero' && ev.unit.party === this) { row(ev.unit).deaths++; this.onDeath(ev.unit); } }),
    ];
  }
  unbind() { for (const f of this.offs || []) f(); }
  onDeath(u) {
    const m = this.members.find(x => x.kit.u === u); if (!m) return;
    if (m.ai) this.level.after(9, () => this.revive(u));        // AI allies revive themselves at the entrance
  }
  revive(u, at) {
    if (!u.dead) return;
    const sp = at || this.game.zone?.anchors?.spawn || { x: 0, z: 0 };
    u.dead = false; u.hp = Math.round(u.hpMax * 0.6); u.pos.x = sp.x + (Math.random() - 0.5) * 2; u.pos.z = sp.z + (Math.random() - 0.5) * 2;
    u.invuln = 2; u.cc.down = 0; u.air.launched = false; u.deadT = 0;
    u.model?.play?.('revive', { dur: 0.8 });
    this.level.emit('revive', { unit: u });
  }
  get alive() { return this.members.filter(m => !m.kit.u.dead); }
  hud() {
    return this.members.map(m => { const u = m.kit.u; return { name: u.name, cls: u.cls, hp: u.hp, hpMax: u.hpMax, shield: u.shield, dead: u.dead, you: !!m.local, support: CLASSES[u.cls]?.role === 'support', ai: !!m.ai, remote: !!m.remote }; });
  }
  meterRows() {
    const secs = Math.max(1, this.level.time - this.startT);
    const rows = [...this.meter.values()].map(r => ({ ...r, dps: r.dmg / secs, critPct: r.hits ? r.crits / r.hits : 0, backPct: r.hits ? r.back / r.hits : 0 }));
    const total = rows.reduce((a, r) => a + r.dmg, 0) || 1;
    for (const r of rows) r.share = r.dmg / total;
    return rows.sort((a, b) => b.dmg - a.dmg);
  }
  dispose() { this.unbind(); }
}
