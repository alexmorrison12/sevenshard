// Hub mode (Solhaven and other towns): residents at their posts, dozens of AI adventurers living their lives
// (wandering between hangouts, emoting, sitting, playing songs, chatting), interaction prompts, portals.
import { Unit } from '../unit.js';
import { CITY_NPCS } from '../../data/npcs.js';
import { makeSim } from '../social/names.js';
import { pickLine, CHAT } from '../social/chatter.js';
import { refFor } from '../ai/mob.js';

const EMOTES = ['wave', 'bow', 'dance', 'cheer', 'clap', 'laugh', 'salute', 'flex', 'think', 'point', 'shrug'];

class TownSim {
  constructor(u, spots, rng) { this.u = u; this.spots = spots; this.rng = rng; this.wait = rng() * 6; this.target = null; this.act = null; }
  update(dt, L) {
    const u = this.u;
    u.move.x = u.move.z = 0;
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.target) {
      const r = this.rng();
      if (r < 0.55) { this.target = this.spots[Math.floor(this.rng() * this.spots.length)]; u.data.sit = false; }
      else if (r < 0.75) { u.model?.play?.(EMOTES[Math.floor(this.rng() * EMOTES.length)], { dur: 2.5 }); this.wait = 3 + this.rng() * 5; }
      else if (r < 0.85) { u.data.sit = true; u.model?.play?.('sit', { loop: true, dur: 2 }); this.wait = 10 + this.rng() * 20; }
      else if (r < 0.92) { u.model?.play?.('play_instrument', { loop: true, dur: 3 }); this.wait = 8 + this.rng() * 10; }
      else this.wait = 4 + this.rng() * 8;
      return;
    }
    const dx = this.target.x - u.pos.x, dz = this.target.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.8 || u.blocked && d < 3) { this.target = null; this.wait = 2 + this.rng() * 10; u.model?.stop?.(); return; }
    const sp = u.st.speed * (u.data.mounted ? 1.6 : 0.55);
    u.move.x = dx / d * sp; u.move.z = dz / d * sp;
  }
}

export class CityMode {
  constructor(game, o = {}) { this.game = game; this.o = o; this.npcs = []; this.sims = []; this.chatT = 3; this.kind = 'city'; this.rng = Math.random; }
  get L() { return this.game.level; }
  enter() {
    const g = this.game, L = this.L, A = g.zone.anchors || {};
    // residents
    for (const n of CITY_NPCS) {
      const a = A[n.anchor]; if (!a) continue;
      const x = a.x + (n.offset?.[0] || 0), z = a.z + (n.offset?.[1] || 0);
      const u = new Unit({ kind: 'npc', team: 2, name: n.name, x, z, facing: a.facing ?? Math.PI, radius: 0.5, height: 1.85, stats: { hpMax: 1, speed: 2 } });
      u.data.npc = n.npc || null; u.data.look = n.npc ? {} : null; u.data.sex = n.sex || 'm'; u.data.title = n.title; u.data.npcDef = n; u.data.immovable = true;
      if (n.creature) { u.kind = 'npc'; u.type = n.creature; u.data.look = null; u.data.tpl = { model: n.creature }; u.height = 0.7; }
      if (n.noModel) u.data.noModel = true;
      u.untargetable = true;
      L.add(u); this.npcs.push(u);
    }
    // AI adventurers
    const spots = Object.entries(A).filter(([k]) => k.startsWith('idle:')).map(([, v]) => v);
    if (!spots.length) for (let i = 0; i < 16; i++) spots.push({ x: (Math.random() - 0.5) * 40, z: (Math.random() - 0.5) * 40 });
    const n = this.o.sims ?? (g.renderer.quality === 'low' ? 14 : 28);
    for (let i = 0; i < n; i++) {
      const sim = makeSim(1000 + i * 77 + (this.o.seed || 0));
      const s = spots[i % spots.length];
      const u = new Unit({ kind: 'hero', team: 2, name: sim.name, cls: sim.cls, x: s.x + (Math.random() - 0.5) * 3, z: s.z + (Math.random() - 0.5) * 3, facing: Math.random() * 6.28, radius: 0.4, stats: { hpMax: 200000, speed: 5.4 } });
      Object.assign(u.data, { sex: sim.sex, look: sim.look, gear: sim.gear, title: sim.title, guild: sim.guild, sim, lod: i < 8 ? 'full' : 'crowd', ilvl: sim.ilvl });
      u.untargetable = true;
      u.ctrl = new TownSim(u, spots, Math.random);
      L.add(u); this.sims.push(u);
    }
    g.audio?.music?.(this.o.music || 'city');
    g.audio?.ambience?.('city');
    g.ui?.banner?.(g.zone.name || 'Solhaven', { kind: 'zone', sub: this.o.region || 'Valemont', dur: 3 });
  }
  exit() {}
  /** nearest interactable within reach of the hero */
  interactable() {
    const me = this.game.hero?.u; if (!me) return null;
    let best = null, bd = 3.2;
    for (const u of this.npcs) { const d = me.distTo(u); if (d < bd) { bd = d; best = u; } }
    for (const [name, a] of Object.entries(this.game.zone.anchors || {})) {
      if (!/^(portal|dock|gate|triport)/.test(name)) continue;
      const d = Math.hypot(a.x - me.pos.x, a.z - me.pos.z);
      if (d < 2.6 && d < bd) { bd = d; best = { portal: name, name: PORTAL_NAMES[name.split(':')[0]] || name, anchor: a }; }
    }
    return best;
  }
  update(dt) {
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = 4 + Math.random() * 9;
      const s = this.sims[Math.floor(Math.random() * this.sims.length)];
      if (s) {
        const r = Math.random();
        const pool = r < 0.18 ? 'lf' : r < 0.28 ? 'trade' : 'area';
        this.game.ui?.chat?.add?.({ channel: pool === 'lf' ? 'world' : pool === 'trade' ? 'shout' : 'area', from: s.name, text: pickLine(pool) });
      }
    }
  }
  simList() { return this.sims.map(u => ({ name: u.name, cls: u.cls, ilvl: u.data.ilvl, title: u.data.title, guild: u.data.guild })); }
}
export const PORTAL_NAMES = { portal: 'Rift Portal', dock: 'Board your ship', gate: 'Leave the city', triport: 'Triport' };
export { CHAT };
