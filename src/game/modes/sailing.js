// Sailing the Glass Sea. The Dawnrunner with momentum steering (hold the move button to steer toward the cursor, click
// to set a course, click the minimap for a charted route), ship skills on Q W E R (Full Sail, Repair, Cannon Volley,
// Brace), crew skills on A S D F (from your stronghold crew), the Gale gauge (Z: Gale Force), Sunfire Barrage (V),
// sea supplies on 1-4, durability, storms with lightning, flotsam (Sea Bounty chances), sea serpents, pirate brigs,
// kraken ambushes, the Ghost Ship world event, treasure maps, a day/night cycle, and docking at every port.
//
// Plugs in through the registry: content 'sail' (session.launch({ kind: 'sail', from })), service 'sail' (the harbour
// master), a plugin that boards the Dawnrunner from any 'dock:ship' anchor and feeds the sailing HUD, and the zone
// mode for 'glass_sea'. Debug handle: window.__session.sea (spawn, ghost, storm, teleport, dock, state).
import * as THREE from 'three';
import { registerPlugin, registerContent, registerService, registerZoneMode, registerAction, LAUNCHERS } from '../registry.js';
import { ZONES } from '../providers.js';
import { Unit } from '../unit.js';
import { dealDamage } from '../combat.js';
import { ISO } from '../../engine/isocam.js';
import { G } from '../../engine/materials.js';
import '../../world/zones/glass_sea.js';
import { chart, SHIP_DRAFT } from '../../world/sea/chart.js';
import { ShipRig, isPlaceholderShip } from '../../world/sea/shiprig.js';
import { makeFloater } from '../../world/sea/flotsam.js';
import { seaIcon } from '../../world/sea/icons.js';
import { createCreature } from '../../models/creatures/index.js';
import * as SH from '../systems/stronghold.js';
import * as SYS from '../systems/index.js';
import { ITEMS } from '../../data/items.js';
import { ISLANDS, ISLAND_BY_ID, ISLAND_BY_ZONE, PORTS, STORMS, DANGER, SEA_BOUNTIES, TREASURE_SPOTS, SEA_NAME, SEA_BOUNDS, seaHour, nightAmount, isNight, compassPoint, minutesToNight } from '../../data/islands.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const KN = 1.944;   // m/s → knots

// ------------------------------------------------------------------------------------------------ persistence & crew
/** roster-wide sea state (lazily initialised under account.roster.sea) */
export function seaState(A) {
  const s = A.roster.sea ||= {};
  s.dur ??= 1; s.items ||= { repair_kit: 3, powder_keg: 3, flare: 2 }; s.visited ||= ['solhaven']; s.last ??= 'solhaven';
  s.crew ||= []; s.stats ||= { dist: 0, kills: 0, flotsam: 0, treasure: 0, ghost: 0 }; s.maps ||= {};
  return s;
}
const FALLBACK_CREW = [
  { id: 'sea1', name: 'Bosun Maddox', role: 'Sailor', power: 36 }, { id: 'sea2', name: 'Lookout Pell', role: 'Scout', power: 30 },
  { id: 'sea3', name: 'Gunner Rook', role: 'Brawler', power: 38 }, { id: 'sea4', name: 'Cookie Marl', role: 'Cook', power: 28 },
  { id: 'sea5', name: 'Purser Wynn', role: 'Trader', power: 30 },
];
/** up to 5 crew aboard: your stronghold crew not away on dispatch (chosen at the harbour master), else a default crew */
export function shipCrew(A) {
  let all = [];
  try { const s = SH.state?.(A); if (s?.crew?.length) { const busy = new Set((s.dispatch || []).filter(d => !d.collected).flatMap(d => d.crew || [])); all = s.crew.filter(c => !busy.has(c.id)); } } catch (e) { /* systems not ready */ }
  if (!all.length) all = FALLBACK_CREW;
  const sea = seaState(A), chosen = sea.crew.map(id => all.find(c => c.id === id)).filter(Boolean);
  for (const c of all) if (chosen.length < 5 && !chosen.includes(c)) chosen.push(c);
  return chosen.slice(0, 5);
}
const ROLE_SKILL = { Sailor: 'harpoon', Scout: 'spyglass', Brawler: 'chainshot', Scholar: 'starfix', Trader: 'salvage', Cook: 'stew' };
export function shipStats(crew) {
  const roles = {}; let power = 0;
  for (const c of crew) { roles[c.role] = (roles[c.role] || 0) + 1; power += c.power || 30; }
  const n = r => Math.min(2, roles[r] || 0);
  return {
    speed: 12.5 * (1 + 0.04 * n('Sailor')), turn: 0.6, accel: 2.4, decel: 1.35,
    durMax: Math.round(2400 + power * 6), cannon: 1 + 0.07 * n('Brawler') + power * 0.0008, repair: 0.35 * (1 + 0.1 * n('Cook')),
    salvage: 1 + 0.12 * n('Trader'), scout: 1 + 0.3 * n('Scout'), gale: 1 + 0.12 * n('Scholar'), roles, power,
  };
}

// ------------------------------------------------------------------------------------------------ skills
const SKILLS = {
  full_sail: { name: 'Full Sail', cd: 20, dur: 8, type: 'Normal', desc: 'Unfurl every inch of canvas: +50% speed and sharper turns for 8 s. (Q or Space)' },
  repair: { name: 'Repair', cd: 32, dur: 3, type: 'Casting', desc: 'All hands patch the hull: restores 35% durability over 3 s while the ship slows.' },
  volley: { name: 'Cannon Volley', cd: 5, type: 'Normal', desc: 'A full broadside at the nearest threat (or toward the cursor). Four guns a side.' },
  brace: { name: 'Brace', cd: 18, dur: 4, type: 'Normal', desc: 'Brace for impact: −70% damage for 4 s, storms can’t rattle you, ramming hurts them instead.' },
  harpoon: { name: 'Harpoon', cd: 10, type: 'Normal', desc: 'Sailor: a barbed harpoon at the nearest foe (heavy damage) — or reel in the nearest flotsam.', role: 'Sailor' },
  spyglass: { name: 'Spyglass', cd: 30, type: 'Normal', desc: 'Scout: sweep the horizon — flotsam, treasure and foes within 400 m are marked for 25 s.', role: 'Scout' },
  chainshot: { name: 'Chain Shot', cd: 12, type: 'Normal', desc: 'Brawler: chained shot that tears rigging and scales — damage and −60% speed for 6 s.', role: 'Brawler' },
  starfix: { name: 'Star Fix', cd: 25, type: 'Normal', desc: 'Scholar: reads the stars and charts a course to the nearest island you have not claimed.', role: 'Scholar' },
  salvage: { name: 'Salvage Hook', cd: 15, type: 'Normal', desc: 'Trader: hooks every piece of flotsam within 45 m and hauls it aboard.', role: 'Trader' },
  stew: { name: 'Galley Stew', cd: 40, type: 'Normal', desc: 'Cook: a hot meal for the crew — +15% durability and 1% per second for 10 s.', role: 'Cook' },
  sunfire: { name: 'Sunfire Barrage', cd: 45, type: 'Normal', desc: 'Every gun, both sides, twice — then the sky rains fire in a ring around the Dawnrunner. 3 per voyage.' },
  gale: { name: 'Gale Force', dur: 12, desc: 'The Gale answers: +35% speed, +30% cannon damage and cooldowns recover twice as fast for 12 s.' },
};
const ITEM_DEFS = {
  repair_kit: { name: 'Repair Kit', cd: 8, desc: 'Restores 25% durability at once.' },
  powder_keg: { name: 'Powder Keg', cd: 4, desc: 'Drop a keg astern. It bursts when a foe comes close (or after 10 s).' },
  flare: { name: 'Signal Flare', cd: 15, desc: 'Lights the sea: marks treasure, flotsam and foes within 500 m for 30 s.' },
};

// ------------------------------------------------------------------------------------------------ the ship controller
/** Replaces game.player while sailing: same method names, so HUD clicks, the minimap and keys all steer the ship. */
class ShipCtrl {
  constructor(mode) { this.m = mode; this.aim = { x: 0, z: 0 }; this.moveBtn = 2; this.held = false; }
  setMoveButton(which) { this.moveBtn = which === 'left' ? 0 : 2; }
  input(dt, inp, cam) {
    const m = this.m;
    if (!inp.enabled) return;
    const p = cam.groundAt(inp.mouse.x, inp.mouse.y, 0); this.aim.x = p.x; this.aim.z = p.z;
    if (inp.btn(this.moveBtn) && inp.mouse.over) {
      // clicking right on the ship stops it; holding steers toward the cursor
      const sh = m.sh, d = Math.hypot(p.x - sh.x, p.z - sh.z);
      if (inp.clicked(this.moveBtn) && d < 6) { m.setCourse(null); m.stopAll = true; }
      else m.setCourse({ x: p.x, z: p.z }, { steer: true });
      this.held = true;
    } else if (this.held) { this.held = false; m.releaseSteer(); }
    for (let i = 0; i < 8; i++) if (inp.hit('skill' + i)) m.cast(i);
    if (inp.hit('dash')) m.cast(0);
    if (inp.hit('idZ')) m.gale();
    if (inp.hit('awaken')) m.cast('awaken');
    for (let i = 0; i < 4; i++) if (inp.hit('item' + i)) m.useItem(i);
  }
  cast(slot) { this.m.cast(slot); }
  dash() { this.m.cast(0); }
  identity() { this.m.gale(); }
  awaken() { this.m.cast('awaken'); }
  basic() {}
  stop() { this.m.setCourse(null); }
  setDest(x, z) { this.m.setCourse({ x, z }, { route: true }); }
  update() {}
}

// ------------------------------------------------------------------------------------------------ sea foes
/** a Visuals-compatible model wrapper around a ShipRig (the rig lives in the zone root; Visuals only drives it) */
function shipModel(rig, u, mode) {
  const root = new THREE.Group();
  return {
    root, height: 12, radius: 5, sockets: { head: rig.ship.sockets.helm, overhead: rig.ship.sockets.helm, center: rig.ship.sockets.helm },
    update(dt, s) { if (!u.data.rigDriven) rig.update(dt, G.uTime.value, { x: u.pos.x, z: u.pos.z, heading: u.facing, speed: s.speed, turn: u.anim.turn || 0, sail: u.dead ? 0.2 : 1 }); },
    play() { return { dur: 0 }; }, stop() {}, setTint() {}, setGlow() {},
    dispose() { rig.dispose(); mode.rigs.delete(rig); },
  };
}
function ghostify(rig, strength = 1) {
  rig.ship.root.traverse(o => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (m.color) m.color.lerp(new THREE.Color(0x7ab8d0), 0.75 * strength); m.transparent = true; m.opacity = 0.82; if (m.emissive) m.emissive.set(0x1a4a5a); }
  });
  rig.ship.setGlow?.(2.4);
}
const placeholderShip = isPlaceholderShip;

class Foe {
  constructor(mode, u) { this.m = mode; this.u = u; this.t = 0; this.state = 'arrive'; this.stateT = 0; this.cd = 2 + Math.random() * 2; }
  get sh() { return this.m.sh; }
  set(state, t = 0) { this.state = state; this.stateT = t; }
  distShip() { return Math.hypot(this.u.pos.x - this.sh.x, this.u.pos.z - this.sh.z); }
  face(x, z, rate, dt) { const u = this.u, want = Math.atan2(-(x - u.pos.x), -(z - u.pos.z)); const d = wrap(want - u.facing); const tr = clamp(d, -rate * dt, rate * dt); u.facing += tr; u.anim.turn = tr / Math.max(dt, 1e-3); return Math.abs(d); }
}
class SerpentAI extends Foe {
  update(dt) {
    const u = this.u, m = this.m, sh = this.sh; this.t += dt; this.stateT -= dt; this.cd -= dt;
    u.move.x = u.move.z = 0; if (u.dead) return;
    const d = this.distShip();
    if (this.t > 110 || d > 220) { if (this.state !== 'leave') { this.set('leave', 2.2); u.model?.play?.('submerge'); u.untargetable = true; } }
    switch (this.state) {
      case 'arrive': if (this.t > 2.6) this.set('stalk', rnd(2.5, 4)); return;
      case 'leave': if (this.stateT <= 0) m.removeFoe(this); return;
      case 'dive': if (this.stateT <= 0) {
          // resurface on the other side of the ship, ahead of it
          const a = sh.h + (Math.random() < 0.5 ? 1 : -1) * rnd(0.9, 1.9), r = rnd(16, 24);
          const x = sh.x - Math.sin(a) * r, z = sh.z - Math.cos(a) * r;
          if (m.navOk(x, z)) { u.pos.x = x; u.pos.z = z; }
          u.facing = Math.atan2(-(sh.x - u.pos.x), -(sh.z - u.pos.z));
          u.untargetable = false; u.model?.play?.('spawn'); m.sfx('wave_splash', u.pos, 1.2); m.splash(u.pos.x, u.pos.z, 2.2);
          this.set('stalk', rnd(2.5, 3.5));
        } return;
      case 'attack': return;   // scripted by timers
    }
    // stalk: glide on a circle around the ship
    const ang = Math.atan2(u.pos.z - sh.z, u.pos.x - sh.x) + dt * 0.35 * (this.dir ||= Math.random() < 0.5 ? 1 : -1);
    const R = 17, tx = sh.x + Math.cos(ang) * R, tz = sh.z + Math.sin(ang) * R;
    const dx = tx - u.pos.x, dz = tz - u.pos.z, dd = Math.hypot(dx, dz) || 1, sp = Math.min(9 + sh.v, dd * 2);
    u.move.x = dx / dd * sp; u.move.z = dz / dd * sp;
    this.face(sh.x, sh.z, 1.6, dt);
    if (this.cd <= 0 && this.stateT <= 0) this.attack(d);
  }
  attack(d) {
    const u = this.u, m = this.m, L = m.L, sh = this.sh;
    const roll = Math.random();
    this.set('attack');
    if (roll < 0.45 && d < 26) {
      // lunging bite: a lane from the head toward the ship
      const a = Math.atan2(-(sh.x - u.pos.x), -(sh.z - u.pos.z)); u.facing = a;
      const dx = -Math.sin(a), dz = -Math.cos(a), len = Math.min(26, d + 8);
      m.warn(L.telegraph({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width: 7, dur: 1.15, color: 'red', owner: u }), u);
      L.after(0.55, () => { if (!u.dead) u.model?.play?.('attack', { dur: 1.3 }); });
      L.after(1.15, () => { if (u.dead) return; if (m.hullIn({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width: 7 })) m.hurt(0.1, u, 'bite'); m.splash(u.pos.x + dx * 10, u.pos.z + dz * 10, 2.5); m.shake(0.25); });
      L.after(2.1, () => { this.set('stalk', rnd(1.5, 3)); this.cd = rnd(3.5, 6); });
    } else if (roll < 0.75) {
      // rears up and crashes down where the ship will be
      const lead = 1.9, px = sh.x - Math.sin(sh.h) * sh.v * lead, pz = sh.z - Math.cos(sh.h) * sh.v * lead;
      this.face(px, pz, 99, 1);
      const tg = L.telegraph({ shape: 'circle', x: px, z: pz, r: 8.5, dur: 2.25, color: 'orange', owner: u });
      m.warn(tg, u); u.model?.play?.('attack_big', { dur: 3.3 }); m.sfx('roar', u.pos);
      L.after(2.25, () => { if (u.dead) return; if (m.hullIn({ shape: 'circle', x: px, z: pz, r: 8.5 })) m.hurt(0.15, u, 'crash'); m.splash(px, pz, 4.5); m.shockwave(px, pz, 9); m.shake(0.45); m.sfx('wave_splash', { x: px, y: 0, z: pz }, 1.6); });
      L.after(3.4, () => { this.set('stalk', rnd(1.5, 3)); this.cd = rnd(4, 7); });
    } else {
      // dives and repositions
      u.model?.play?.('submerge'); u.untargetable = true; this.set('dive', 2.4); this.cd = rnd(2, 4);
    }
  }
}
class PirateAI extends Foe {
  update(dt) {
    const u = this.u, m = this.m, sh = this.sh; this.t += dt; this.cd -= dt; this.stateT -= dt;
    if (u.dead) { u.move.x = u.move.z = 0; return; }
    const d = this.distShip();
    if (d > 260) { m.removeFoe(this); return; }
    const slow = u.data.slowT > 0 ? 0.4 : 1; if (u.data.slowT > 0) u.data.slowT -= dt;
    // approach, then run parallel at ~22 m to trade broadsides
    const side = this.side ||= Math.random() < 0.5 ? 1 : -1;
    const fx = -Math.sin(sh.h), fz = -Math.cos(sh.h), rx = -fz, rz = fx;
    const lead = d > 45 ? 0 : 8;
    const tx = sh.x + rx * 22 * side + fx * lead, tz = sh.z + rz * 22 * side + fz * lead;
    const want = d > 45 ? { x: sh.x, z: sh.z } : { x: tx, z: tz };
    const off = this.face(want.x, want.z, 0.55, dt);
    const sp = (d > 45 ? 11 : clamp(sh.v + (Math.hypot(tx - u.pos.x, tz - u.pos.z) > 6 ? 3 : 0), 4, 13)) * slow * (off > 1.6 ? 0.5 : 1);
    u.move.x = -Math.sin(u.facing) * sp; u.move.z = -Math.cos(u.facing) * sp;
    if (this.cd <= 0 && d < 40) this.broadside();
  }
  broadside() {
    const u = this.u, m = this.m, L = m.L, sh = this.sh;
    this.cd = rnd(6, 8.5);
    const fx = -Math.sin(u.facing), fz = -Math.cos(u.facing), rx = -fz, rz = fx;
    const sdot = (sh.x - u.pos.x) * rx + (sh.z - u.pos.z) * rz, s = sdot >= 0 ? 1 : -1;
    const dx = rx * s, dz = rz * s, len = 34, width = 15;
    const tg = L.telegraph({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width, dur: 1.7, color: 'orange', owner: u });
    m.warn(tg, u);
    L.after(1.7, () => {
      if (u.dead) return;
      const rig = u.data.rig; const fire = rig?.ship.fire?.(s > 0 ? 'R' : 'L');
      const cannons = s > 0 ? rig?.ship.sockets.cannonsR : rig?.ship.sockets.cannonsL;
      (cannons || [null, null, null, null]).forEach((sock, i) => {
        L.after(fire?.times?.[i] ?? i * 0.12, () => {
          const p = sock ? rig.world(sock, new THREE.Vector3()) : new THREE.Vector3(u.pos.x, 2, u.pos.z);
          m.muzzle(p, dx, dz); m.sfx('cannon', p, 0.8);
          const tx = p.x + dx * rnd(len * 0.6, len), tz = p.z + dz * rnd(len * 0.6, len);
          m.lob(p, tx, tz, 0.55, () => { m.splash(tx, tz, 1.2); });
        });
      });
      L.after(0.55, () => { if (!u.dead && m.hullIn({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width })) m.hurt(0.16, u, 'broadside'); });
    });
  }
}
class TentacleAI extends Foe {
  update(dt) {
    const u = this.u, m = this.m, sh = this.sh; this.t += dt; this.cd -= dt;
    u.move.x = u.move.z = 0; if (u.dead) return;
    this.face(sh.x, sh.z, 2.5, dt);
    const d = this.distShip();
    if (this.t > 60 || d > 120) { if (!this.gone) { this.gone = true; u.model?.play?.('submerge'); u.untargetable = true; m.L.after(2, () => m.removeFoe(this)); } return; }
    if (this.cd > 0 || this.t < 2.2 || d > 30) return;
    this.cd = rnd(4.5, 7);
    const L = m.L;
    if (Math.random() < 0.6) {
      const a = u.facing, dx = -Math.sin(a), dz = -Math.cos(a), len = 16;
      const tg = L.telegraph({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width: 5, dur: 1.9, color: 'red', owner: u }); m.warn(tg, u);
      u.model?.play?.('attack_big', { dur: 2.9 });
      L.after(1.9, () => { if (u.dead) return; if (m.hullIn({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx, dz, len, width: 5 })) m.hurt(0.12, u, 'slam'); m.splash(u.pos.x + dx * 9, u.pos.z + dz * 9, 3); m.shake(0.35); m.sfx('wave_splash', u.pos, 1.3); });
    } else {
      const a = u.facing, dx = -Math.sin(a), dz = -Math.cos(a);
      const tg = L.telegraph({ shape: 'cone', x: u.pos.x, z: u.pos.z, dx, dz, r: 13, angle: 1.4, dur: 1.2, color: 'red', owner: u }); m.warn(tg, u);
      u.model?.play?.('attack', { dur: 1.6 });
      L.after(1.2, () => { if (u.dead) return; if (m.hullIn({ shape: 'cone', x: u.pos.x, z: u.pos.z, dx, dz, r: 13, angle: 1.4 })) m.hurt(0.08, u, 'sweep'); m.shake(0.2); });
    }
  }
}
class GhostAI extends Foe {
  update(dt) {
    const u = this.u, m = this.m, sh = this.sh, L = m.L; this.t += dt; this.cd -= dt;
    if (u.dead) { u.move.x = u.move.z = 0; return; }
    const d = this.distShip();
    if (d > 320) { m.removeFoe(this); m.say('The Ghost Ship sinks back into the mist… for now.', 'warn'); return; }
    // circles the Dawnrunner at 30 m, ghostly and relentless
    const ang = Math.atan2(u.pos.z - sh.z, u.pos.x - sh.x) + dt * 0.12;
    const tx = sh.x + Math.cos(ang) * 30, tz = sh.z + Math.sin(ang) * 30;
    const off = this.face(tx, tz, 0.45, dt);
    const sp = (d > 60 ? 13 : 8.5) * (off > 1.6 ? 0.6 : 1);
    u.move.x = -Math.sin(u.facing) * sp; u.move.z = -Math.cos(u.facing) * sp;
    // counter window: its lanterns flare blue — a volley now staggers it
    if (u.data.counterWindow > 0) u.data.counterWindow -= dt;
    if (this.cd > 0 || this.t < 3) return;
    this.cd = rnd(4.5, 6.5);
    const r = Math.random(), hpPct = u.hp / u.hpMax;
    if (r < 0.35) {
      // spectral broadside lanes on both sides
      const fx = -Math.sin(u.facing), fz = -Math.cos(u.facing), rx = -fz, rz = fx;
      for (const s of [-1, 1]) { const tg = L.telegraph({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx: rx * s, dz: rz * s, len: 44, width: 12, dur: 2, color: 'purple', owner: u }); m.warn(tg, u); }
      m.sfx('ghost_wail', u.pos);
      L.after(2, () => { if (u.dead) return; for (const s of [-1, 1]) if (m.hullIn({ shape: 'rect', x: u.pos.x, z: u.pos.z, dx: rx * s, dz: rz * s, len: 44, width: 12 })) m.hurt(0.13, u, 'spectral broadside'); m.ghostBlast(u.pos.x, u.pos.z, rx, rz); });
    } else if (r < 0.7) {
      // the Drowned Chorus: circles rain around the Dawnrunner
      for (let i = 0; i < 6; i++) {
        const a = rnd(0, TAU), rr = rnd(0, 18), x = sh.x + Math.cos(a) * rr - Math.sin(sh.h) * sh.v * 1.4, z = sh.z + Math.sin(a) * rr - Math.cos(sh.h) * sh.v * 1.4;
        L.after(i * 0.25, () => { const tg = L.telegraph({ shape: 'circle', x, z, r: 5, dur: 1.6, color: 'purple', owner: u }); m.warn(tg, u); L.after(1.6, () => { if (!u.dead && m.hullIn({ shape: 'circle', x, z, r: 5 })) m.hurt(0.06, u, 'drowned chorus'); m.ghostPillar(x, z); }); });
      }
    } else {
      // lanterns flare blue: counter window
      u.data.counterWindow = 2.2; m.game.fx?.counterWindow?.({ pos: { x: u.pos.x, y: 6, z: u.pos.z }, dur: 2.2, height: 8, scale: 2.5 });
      m.say('The Ghost Ship’s lanterns flare — fire a volley now!', 'warn', true);
    }
    if (hpPct < 0.5 && !this.enraged) { this.enraged = true; m.say('Captain Hollowgale howls. The mist thickens!', 'warn', true); m.game.renderer.fx && (G.uDesat.value = 0.35); }
  }
}

// ------------------------------------------------------------------------------------------------ the mode
export class SailingMode {
  constructor(session, o = {}) {
    this.s = session; this.game = session.game; this.kind = 'sea'; this.o = o;
    this.cds = new Map(); this.foes = new Set(); this.rigs = new Set(); this.floaters = []; this.markers = []; this.fxh = [];
    this.voyage = { t: 0, dist: 0, kills: 0, flotsam: 0, sunfire: 3 };
  }
  get L() { return this.game.level; }
  get zone() { return this.game.zone; }
  get me() { return this.game.hero?.u; }
  // ---------------------------------------------------------------- enter / exit
  enter() {
    const g = this.game, s = this.s, A = s.account, z = this.zone;
    if (!z?.sea) { console.error('[sailing] the glass_sea zone failed to build'); s.ui?.toast?.('The sea is not ready (zone failed to build).', 'error'); return; }
    this.C = z.sea.chart || chart(); this.waves = z.sea.waves; this.ocean = z.sea.ocean;
    const sea = this.sea = seaState(A);
    this.crew = shipCrew(A); this.stats = shipStats(this.crew);
    const port = this.o.port || PORTS.solhaven;
    this.sh = { x: port.x, z: port.z, h: port.facing ?? 0, v: 0, w: 0, dur: Math.max(0.25, sea.dur) * this.stats.durMax, durMax: this.stats.durMax,
      sail: 0.2, boost: 0, brace: 0, galeT: 0, gale: 20, repair: null, stew: 0, hitT: 0 };
    this.course = null; this.stopAll = false;
    // the Dawnrunner
    const rig = this.rig = new ShipRig('dawnrunner', { waves: this.waves });
    z.root.add(rig.root); rig.place(this.sh.x, this.sh.z, this.sh.h); this.rigs.add(rig);
    // hero at the helm
    const me = this.me;
    if (me) { me.untargetable = true; me.data.rooted = true; me.data.ghostWalk = true; me.data.noAutoFace = true; }
    // controls & camera
    this.prevPlayer = g.player; g.player = this.ctrl = new ShipCtrl(this); this.ctrl.setMoveButton(A.settings.moveButton || 'right');
    const cam = g.cam; this.camPrev = { pitch: cam.pitch, zoom: cam.zoom, min: cam.minDist, max: cam.maxDist, follow: cam.follow };
    cam.pitch = 50 * Math.PI / 180; cam.minDist = 34; cam.maxDist = 110; cam.zoom = 60; cam.dist = 60; cam.follow = 6;
    this.focus = new THREE.Vector3(this.sh.x, 0, this.sh.z); g.camFocus = this.focus; cam.snap(this.focus);
    const sc = g.sun.shadow.camera; this.shadowPrev = [sc.left, sc.right, sc.top, sc.bottom]; sc.left = sc.bottom = -44; sc.right = sc.top = 44; sc.updateProjectionMatrix();
    // port markers for the minimap (invisible NPC units)
    for (const p of Object.values(PORTS)) this.marker(p.x, p.z, p.name, p.title);
    // day/night + music
    this.envT = 0; this.applySeaEnv(true);
    g.audio?.music?.('sea'); g.audio?.ambience?.('sea');
    s.ui?.banner?.(SEA_NAME, { kind: 'zone', sub: `Leaving ${port.name}`, dur: 3 });
    g.audio?.sfx?.('ship_bell', {});
    this.spawnT = 12; this.flotT = 1; this.stormLightT = 3; this.ghostChecked = false; this.saveT = 0;
    // treasure
    this.pickTreasure();
    s.sea = this.debug();
    if (!sea.tutorial) { sea.tutorial = true; A.save(); setTimeout(() => s.ui?.toast?.('Hold right-click to steer · Space / Q: Full Sail · E: broadside · click the minimap to chart a course', 'info'), 3200); }
  }
  exit() {
    const g = this.game;
    if (g.camFocus === this.focus) g.camFocus = null;
    const cam = g.cam, P = this.camPrev;
    if (P) { cam.pitch = ISO.pitch; cam.minDist = ISO.minDist; cam.maxDist = ISO.maxDist; cam.zoom = ISO.dist; cam.follow = P.follow ?? 10; }
    if (this.shadowPrev) { const sc = g.sun.shadow.camera; [sc.left, sc.right, sc.top, sc.bottom] = this.shadowPrev; sc.updateProjectionMatrix(); }
    for (const h of this.fxh) h?.stop?.(); this.fxh = [];
    this.rain?.stop?.(); this.rain = null;
    for (const r of [...this.rigs]) r.dispose(); this.rigs.clear();
    for (const f of this.floaters) f.group.removeFromParent(); this.floaters = [];
    G.uDesat.value = 0;
    this.persist();
    if (this.s.sea?.mode === this) this.s.sea = null;
  }
  persist() { const sea = this.sea; if (!sea) return; sea.dur = clamp(this.sh.dur / this.sh.durMax, 0.05, 1); sea.stats.dist += Math.round(this.voyage.dist - (this.voyage.saved || 0)); this.voyage.saved = this.voyage.dist; this.s.account.save(); }

  // ---------------------------------------------------------------- per frame: ship physics (before the level)
  preUpdate(dt) {
    const sh = this.sh, st = this.stats, C = this.C, t = G.uTime.value;
    const galeK = sh.galeT > 0 ? 1.35 : 1, boostK = sh.boost > 0 ? 1.5 : 1;
    // cooldowns (Gale Force recovers them twice as fast)
    const cdk = sh.galeT > 0 ? 2 : 1;
    for (const [k, v] of this.cds) { const n = v - dt * cdk; if (n <= 0) this.cds.delete(k); else this.cds.set(k, n); }
    sh.boost = Math.max(0, sh.boost - dt); sh.brace = Math.max(0, sh.brace - dt); sh.galeT = Math.max(0, sh.galeT - dt); sh.hitT = Math.max(0, sh.hitT - dt);
    if (sh.stew > 0) { sh.stew -= dt; this.heal(0.01 * dt); }
    // steering: toward the course point (or the next route waypoint)
    let throttle = 0, desired = sh.h;
    const c = this.course;
    if (c && !this.stopAll) {
      const P = c.path?.length ? c.path[0] : c;
      const dx = P.x - sh.x, dz = P.z - sh.z, dist = Math.hypot(dx, dz);
      if (c.path?.length && dist < 14) { c.path.shift(); if (!c.path.length) { this.course = null; } }
      else {
        desired = Math.atan2(-dx, -dz);
        const last = !c.path || c.path.length <= 1;
        throttle = c.steer ? 1 : last ? clamp((dist - 4) / 26, 0, 1) : 1;
        if (!c.steer && last && dist < 7) this.course = null;
      }
    }
    if (this.stopAll) { throttle = 0; if (sh.v < 0.3) this.stopAll = false; }
    const da = wrap(desired - sh.h);
    if (Math.abs(da) > 1.9) throttle *= 0.4;
    // wind: running downwind is faster, beating into it slower
    const W = this.waves.wind, fx = -Math.sin(sh.h), fz = -Math.cos(sh.h);
    const wdot = fx * W.x + fz * W.y;               // 1 = running with the wind
    this.windK = 1 + wdot * 0.12;
    const storm = this.stormAt = this.waves.storm(sh.x, sh.z);
    const repairing = sh.repair ? 0.55 : 1;
    const maxV = st.speed * boostK * galeK * this.windK * repairing * (1 - storm * 0.18);
    const target = throttle * maxV;
    const acc = st.accel * (sh.boost > 0 ? 1.8 : 1);
    if (sh.v < target) sh.v = Math.min(target, sh.v + acc * dt); else sh.v = Math.max(target, sh.v - st.decel * dt * (throttle === 0 ? 1.4 : 1));
    const steerage = 0.3 + 0.7 * clamp(sh.v / 6, 0, 1);
    const maxW = st.turn * steerage * (sh.boost > 0 ? 1.2 : 1);
    const wT = clamp(da * 1.5, -maxW, maxW);
    sh.w += (wT - sh.w) * (1 - Math.exp(-dt * 2.6));
    // storms shove the bow around
    if (storm > 0.2 && sh.brace <= 0) sh.w += Math.sin(t * 0.9 + sh.x * 0.01) * storm * 0.06 * dt * 10;
    sh.h = wrap(sh.h + sh.w * dt);
    // move with hull collision against the chart (shallows, rocks, coasts, the rim of the sea)
    const nx = sh.x - Math.sin(sh.h) * sh.v * dt, nz = sh.z - Math.cos(sh.h) * sh.v * dt;
    const hit = this.hullBlocked(nx, nz, sh.h);
    if (!hit) { this.voyage.dist += Math.hypot(nx - sh.x, nz - sh.z); sh.x = nx; sh.z = nz; }
    else {
      if (sh.v > 5 && sh.hitT <= 0) { this.hurt(0.02 + sh.v * 0.004, null, 'the rocks'); sh.hitT = 1; this.sfx('wave_splash', { x: nx, y: 0, z: nz }, 1.2); this.shake(0.3); this.say('Hull scraping the rocks!', 'warn'); }
      // slide along the obstacle: try the axis moves, else back off
      const sx = sh.x - Math.sin(sh.h) * sh.v * dt, sz = sh.z - Math.cos(sh.h) * sh.v * dt;
      if (!this.hullBlocked(sx, sh.z, sh.h)) sh.x = sx; else if (!this.hullBlocked(sh.x, sz, sh.h)) sh.z = sz;
      sh.v *= 0.9; if (this.hullBlocked(sh.x, sh.z, sh.h)) { sh.x += Math.sin(sh.h) * 0.6; sh.z += Math.cos(sh.h) * 0.6; sh.v = 0; }
      if (this.course && !this.course.steer) this.course = null;
    }
    // Gale gauge: fills while sailing (faster downwind)
    if (sh.galeT <= 0 && sh.v > 5) sh.gale = Math.min(100, sh.gale + dt * (0.9 + Math.max(0, wdot) * 0.8) * st.gale);
    // the rig, the hero at the helm, the camera
    sh.sail += ((throttle > 0 || sh.v > 3 ? (sh.boost > 0 ? 1 : 0.85) : 0.25) - sh.sail) * (1 - Math.exp(-dt * 1.5));
    this.rig.update(dt, t, { x: sh.x, z: sh.z, heading: sh.h, speed: sh.v, turn: sh.w, sail: sh.sail });
    const me = this.me;
    if (me) {
      const hp = this.rig.world(this.rig.ship.sockets.helm, _v);
      me.pos.x = hp.x; me.pos.z = hp.z; me.data.hover = hp.y; me.facing = sh.h; me.move.x = me.move.z = 0; me.anim.speed = 0;
    }
    const lead = clamp(sh.v * 1.3, 0, 22);
    this.focus.set(sh.x + fx * lead, 0, sh.z + fz * lead);
    this.ocean?.update(this.focus);
    // bow spray when running fast
    this.sprayT = (this.sprayT || 0) - dt;
    if (sh.v > 9 && this.sprayT <= 0) { this.sprayT = 0.18 + Math.random() * 0.25; const b = this.rig.bowPoint(_v2); this.game.fx?.burst?.({ pos: { x: b.x, y: 0.8, z: b.z }, color: 'water', kind: 'water', count: 10 + (sh.boost > 0 ? 8 : 0), speed: 4 + sh.v * 0.25, size: 0.35, life: 0.7, dir: { x: fx, y: 0.6, z: fz }, spread: 0.9, up: 3 }); }
  }
  hullBlocked(x, z, h) {
    const fx = -Math.sin(h), fz = -Math.cos(h), rx = -fz, rz = fx, C = this.C, B = SEA_BOUNDS;
    if (x < B.x0 + 8 || x > B.x1 - 8 || z < B.z0 + 8 || z > B.z1 - 8) return true;
    for (const [f, r] of HULL_PTS) { const px = x + fx * f + rx * r, pz = z + fz * f + rz * r; if (C.height(px, pz) > -1.1) return true; }
    return false;
  }
  navOk(x, z) { return this.C.nav.walkable(x, z) && this.C.height(x, z) < SHIP_DRAFT; }

  // ---------------------------------------------------------------- per frame: the sea (after the level)
  update(dt) {
    const sh = this.sh, s = this.s;
    this.voyage.t += dt;
    // map travel: announce the destination pier once we are alongside
    if (this.bound && Math.hypot(this.bound.x - sh.x, this.bound.z - sh.z) < 36) { s.ui?.banner?.(this.bound.name, { kind: 'zone', sub: 'Press G to dock', dur: 3 }); this.game.audio?.sfx?.('ship_bell', {}); this.bound = null; }
    // repair channel
    if (sh.repair) { const r = sh.repair; r.t += dt; this.heal(this.stats.repair / SKILLS.repair.dur * dt); if (r.t >= SKILLS.repair.dur) { sh.repair = null; this.say('Hull patched.', 'success'); } }
    this.updateStorm(dt);
    this.updateFloaters(dt);
    this.updateSpawns(dt);
    this.updateTreasure(dt);
    this.envT -= dt; if (this.envT <= 0) this.applySeaEnv();
    // sinking
    if (sh.dur <= 0 && !this.sinking) this.sink();
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 20; this.persist(); }
  }

  // ---------------------------------------------------------------- env: day/night clock + storms
  applySeaEnv(force = false) {
    this.envT = 0.5;
    const z = this.zone, E = z.envs; if (!E) return;
    const h = seaHour(), nt = nightAmount(h);
    const dusk = clamp(1 - Math.abs(nt - 0.5) * 2.2, 0, 1) * (h > 12 ? 1 : 0.6);
    let env = lerpEnv(E.day, E.night, nt);
    if (dusk > 0.02) env = lerpEnv(env, E.dusk, dusk * 0.8);
    const storm = this.stormAt || 0, mist = this.mistAt || 0;
    if (storm > 0.02) env = lerpEnv(env, lerpEnv(E.storm, E.night, nt * 0.6), clamp(storm * 1.25, 0, 1));
    if (mist > 0.02) env = lerpEnv(env, E.mist, mist * 0.9);
    const key = [h.toFixed(2), storm.toFixed(2), mist.toFixed(2)].join('|');
    if (!force && key === this.envKey) return;
    this.envKey = key;
    z.env = env;
    this.game.applyEnv(env);
    z.setEnv?.('__none');
    for (const r of this.rigs) r.setNight(env.night || 0);
    this.night = env.night || 0;
  }
  updateStorm(dt) {
    const sh = this.sh, L = this.L, s = this.s;
    const storm = this.stormAt || 0;
    // the Moonveil mist (calm, blinding; thins at night)
    const V = STORMS.find(x => x.kind === 'mist');
    const md = Math.hypot(sh.x - V.x, sh.z - V.z);
    const night = isNight();
    this.mistAt = clamp((1 - md / V.r) * 1.6, 0, 1) * (night ? 0.35 : 1);
    this.zone.sea?.clouds?.setMist?.(night ? 0.35 : 1);
    // rain
    if (storm > 0.15 && !this.rain) { this.rain = this.game.fx?.weather?.('rain', { intensity: 1 }) || null; if (!this.stormMsg) { this.stormMsg = true; const S = STORMS.find(x => x.kind === 'storm' && Math.hypot(sh.x - x.x, sh.z - x.z) < x.r * 1.2); s.ui?.banner?.(S?.name || 'A storm!', { kind: 'warn', sub: 'The hull groans. Brace, or push through.' }); } }
    if (this.rain) { this.rain.set?.('intensity', clamp(storm * 1.6, 0.2, 1.4)); if (storm < 0.08) { this.rain.stop?.(1.5); this.rain = null; this.stormMsg = false; } }
    // hull damage (a percentage of max durability per second at the eye)
    if (storm > 0.05) {
      const S = STORMS.filter(x => x.kind === 'storm').reduce((a, x) => Math.max(a, x.dps || 0), 0);
      const pct = storm * (S / 600) * (sh.brace > 0 ? 0.3 : 1);
      this.sh.dur = Math.max(0, this.sh.dur - pct * this.sh.durMax * dt);
    }
    // lightning
    this.stormLightT -= dt;
    if (storm > 0.35 && this.stormLightT <= 0) {
      this.stormLightT = rnd(1.8, 4.5) / (0.5 + storm);
      const lead = 1.5, a = rnd(0, TAU), r = rnd(0, 22);
      const x = sh.x - Math.sin(sh.h) * sh.v * lead + Math.cos(a) * r, z = sh.z - Math.cos(sh.h) * sh.v * lead + Math.sin(a) * r;
      const tg = L.telegraph({ shape: 'circle', x, z, r: 5.5, dur: 1.5, color: 'yellow' });
      L.after(1.5, () => {
        this.game.fx?.lightning?.({ from: { x: x + rnd(-6, 6), y: 55, z: z - 20 }, to: { x, y: 0.5, z }, color: 'lightning', width: 0.5, strands: 3 });
        this.game.fx?.shockwave?.({ pos: { x, y: 0.2, z }, radius: 6, color: 'lightning', dur: 0.5, dust: false });
        this.sfx('thunder', { x, y: 0, z }, 1.4); this.zone.sea?.clouds?.flash?.(1);
        if (this.game.renderer?.fx) this.game.renderer.fx.flash = Math.max(this.game.renderer.fx.flash || 0, 0.35);
        if (this.hullIn({ shape: 'circle', x, z, r: 5.5 })) this.hurt(0.08, null, 'lightning');
      });
      // distant strikes for drama
      if (Math.random() < 0.7) L.after(rnd(0.3, 1.2), () => { const b = rnd(0, TAU), rr = rnd(60, 110); const X = sh.x + Math.cos(b) * rr, Z = sh.z + Math.sin(b) * rr * 0.6 - 40; this.game.fx?.lightning?.({ from: { x: X, y: 70, z: Z - 30 }, to: { x: X, y: 0, z: Z }, color: 'lightning', width: 0.7, strands: 2, impact: false }); this.zone.sea?.clouds?.flash?.(0.6); this.sfx('thunder', { x: X, y: 0, z: Z }, 0.8); });
    }
  }

  // ---------------------------------------------------------------- flotsam
  updateFloaters(dt) {
    const sh = this.sh, t = G.uTime.value, W = this.waves;
    this.flotT -= dt;
    if (this.flotT <= 0 && this.floaters.length < 7) {
      this.flotT = rnd(3, 7) / this.stats.scout;
      const a = sh.h + rnd(-0.9, 0.9), r = rnd(70, 130);
      const x = sh.x - Math.sin(a) * r, z = sh.z - Math.cos(a) * r;
      if (this.navOk(x, z) && Object.values(PORTS).every(p => Math.hypot(p.x - x, p.z - z) > 40)) {
        const roll = Math.random();
        const kind = roll < 0.28 ? 'barrel' : roll < 0.56 ? 'crate' : roll < 0.78 ? 'planks' : roll < 0.92 ? 'bottle' : 'chest';
        this.addFloater(kind, x, z);
      }
    }
    const fx = -Math.sin(sh.h), fz = -Math.cos(sh.h);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt; f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.pull) { const dx = sh.x - f.x, dz = sh.z - f.z, d = Math.hypot(dx, dz) || 1; const sp = Math.min(d * 3, 30); f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; }
      const y = W.height(f.x, f.z, t);
      f.group.position.set(f.x, y + (f.kind === 'buoy' ? 0.2 : 0.05), f.z);
      f.group.rotation.set(Math.sin(t * 1.3 + f.ph) * 0.18, f.rot + t * 0.1, Math.cos(t * 1.1 + f.ph) * 0.15);
      if (f.kind === 'keg') { f.fuse -= dt; if (f.fuse <= 0 || this.nearestFoe(f.x, f.z, 7)) { this.kegBlast(f); this.floaters.splice(i, 1); f.group.removeFromParent(); } continue; }
      if (f.kind === 'buoy') continue;
      // picked up when the hull sails over it
      const rx = f.x - sh.x, rz = f.z - sh.z, along = rx * fx + rz * fz, side = Math.abs(rx * -fz + rz * fx);
      if ((Math.abs(along) < 9.5 && side < 4.5) || (f.pull && Math.hypot(rx, rz) < 4)) { this.collectFloater(f); this.floaters.splice(i, 1); f.group.removeFromParent(); continue; }
      if (Math.hypot(rx, rz) > 260 || f.t > 240) { this.floaters.splice(i, 1); f.group.removeFromParent(); }
    }
  }
  addFloater(kind, x, z, o = {}) {
    const F = makeFloater(kind);
    const f = { ...F, kind, x, z, vx: rnd(-0.4, 0.4) + this.waves.wind.x * 0.4, vz: rnd(-0.4, 0.4) + this.waves.wind.y * 0.4, t: 0, ph: rnd(0, 6), rot: rnd(0, 6), ...o };
    if (kind === 'keg' || kind === 'buoy') { f.vx = f.vz = 0; }
    this.zone.root.add(F.group); this.floaters.push(f);
    return f;
  }
  collectFloater(f) {
    const s = this.s, A = s.account, sea = this.sea, sal = this.stats.salvage;
    const rows = [];
    const give = (id, n) => { if (!n) return; A.give(id, n); rows.push({ id, n }); };
    const pos = { x: f.x, y: 0.6, z: f.z };
    this.game.fx?.pickup?.({ pos, kind: f.kind === 'chest' ? 'gold' : 'item', to: this.rig.ship.sockets.helm });
    this.voyage.flotsam++; sea.stats.flotsam++;
    this.sh.gale = Math.min(100, this.sh.gale + 8 * this.stats.gale);
    switch (f.kind) {
      case 'barrel': give('silver', Math.round(rnd(300, 900) * sal)); if (Math.random() < 0.5) give('fish', Math.round(rnd(3, 8))); if (Math.random() < 0.3) this.addSupply('powder_keg', 1); break;
      case 'crate': give('silver', Math.round(rnd(400, 1100) * sal)); give('timber', Math.round(rnd(4, 12))); if (Math.random() < 0.35) this.addSupply('repair_kit', 1); if (Math.random() < 0.25) give('pirate', Math.round(rnd(1, 3))); break;
      case 'planks': give('timber', Math.round(rnd(6, 16))); if (Math.random() < 0.4) give('clam', Math.round(rnd(2, 5))); break;
      case 'bottle': {
        if (Math.random() < 0.35) { give('map', 1); this.say('A treasure map, rolled tight in the bottle!', 'success', true); this.pickTreasure(true); }
        else { give('silver', Math.round(rnd(200, 500))); this.say(pick(BOTTLE_NOTES), 'info'); }
        break;
      }
      case 'chest': {
        give('silver', Math.round(rnd(1500, 4000) * sal)); give('pirate', Math.round(rnd(3, 8))); if (Math.random() < 0.3) give('pearl', 1);
        if (Math.random() < 0.3 * this.stats.scout) this.findBounty();
        break;
      }
    }
    this.sfx(f.kind === 'chest' ? 'loot_rare' : 'coin', pos);
    this.lootFeed(rows);
    trackTask(s, 'sail', { flotsam: 1 });
  }
  lootFeed(rows) {
    const hud = this.s.ui?.hud;
    for (const r of rows) {
      const it = ITEMS[r.id] || { name: r.id === 'pirate' ? 'Pirate Coin' : r.id === 'silver' ? 'Silver' : r.id, grade: 1, kind: 'currency' };
      hud?.loot?.({ name: it.name, grade: it.grade ?? 1, count: r.n, icon: r.id === 'silver' || r.id === 'gold' ? `currency:${r.id}` : r.id === 'pirate' ? 'currency:pirate' : `item:${r.id}`, kind: it.kind });
    }
  }
  addSupply(id, n) { this.sea.items[id] = (this.sea.items[id] || 0) + n; this.s.ui?.hud?.loot?.({ name: ITEM_DEFS[id].name, grade: 2, count: n, icon: seaIcon(id), kind: 'battle' }); }
  findBounty(pref) {
    const A = this.s.account, have = new Set(A.roster.collect.bounties || []);
    const b = pref && !have.has(pref) ? SEA_BOUNTIES.find(x => x.id === pref) : SEA_BOUNTIES.find(x => !have.has(x.id));
    if (!b) { A.give('gold', 50); this.say('An empty reliquary… but gold glitters at the bottom.', 'success'); return; }
    collect(this.s, 'bounties', b.id, b.name);
    this.s.ui?.banner?.('Sea Bounty found', { kind: 'success', sub: b.name });
    this.s.ui?.hud?.loot?.({ name: b.name, grade: 4, count: 1, icon: 'item:sea_bounty', kind: 'collectible' });
    this.sfx('loot_legendary', this.me?.pos);
  }

  // ---------------------------------------------------------------- encounters
  updateSpawns(dt) {
    const sh = this.sh;
    this.spawnT -= dt;
    // the Ghost Ship: scheduled windows (event compass) or a rare night sighting
    if (!this.ghost && !this.ghostDone) {
      const w = ghostWindow();
      if ((w && w.live) || (isNight() && this.voyage.t > 70 && !this.ghostChecked)) {
        if (!(w && w.live)) { this.ghostChecked = true; if (Math.random() < 0.35) this.spawnGhost(); }
        else this.spawnGhost();
      }
    }
    if (this.spawnT > 0) return;
    this.spawnT = rnd(28, 45);
    if (this.nearPort(150) || this.foes.size >= 3) return;
    const zone = DANGER.find(d => Math.hypot(sh.x - d.x, sh.z - d.z) < d.r);
    const r = Math.random();
    if (zone?.kind === 'pirate') { if (r < 0.7) this.spawnPirate(); }
    else if (zone?.kind === 'serpent') { if (r < 0.55) this.spawnSerpent(); else if (r < 0.8) this.spawnKraken(); }
    else if (this.stormAt > 0.3) { if (r < 0.4) this.spawnKraken(); }
    else if (r < 0.14) this.spawnSerpent(); else if (r < 0.26) this.spawnPirate();
  }
  nearPort(r) { const sh = this.sh; return Object.values(PORTS).some(p => Math.hypot(p.x - sh.x, p.z - sh.z) < r); }
  foeUnit(kind, name, x, z, hpUnits, o = {}) {
    const hero = this.me, unit = this.dmgUnit();
    const u = new Unit({ kind: o.boss ? 'boss' : 'mob', team: 1, type: o.type || kind, name, x, z, facing: o.facing ?? 0, radius: o.radius ?? 2, height: o.height ?? 5, stats: { hpMax: Math.round(hpUnits * unit), atk: 1, def: 0, speed: 12, mpMax: 0, mpRegen: 0 } });
    u.data.elite = !!o.elite; u.data.corpseTime = o.corpse ?? 6; u.data.noAutoFace = true; u.data.flinch = false; u.data.immovable = true; u.data.sea = kind;
    u.turnRate = 2; u.superArmor = 2; u.baseSuperArmor = 2;
    return u;
  }
  dmgUnit() { const me = this.me; return Math.max(4000, (me?.st?.atk || 20000) * 1.1); }
  spawnSerpent(x, z) {
    const sh = this.sh;
    if (x == null) { const a = sh.h + rnd(-1.2, 1.2), r = rnd(30, 44); x = sh.x - Math.sin(a) * r; z = sh.z - Math.cos(a) * r; }
    if (!this.navOk(x, z)) return null;
    const elite = Math.random() < 0.15 || this.stormAt > 0.5;
    const u = this.foeUnit('serpent', elite ? 'Leviathan Serpent' : 'Glass Sea Serpent', x, z, elite ? 60 : 26, { type: 'sea_serpent', radius: 2.4, height: 5, elite, corpse: 7 });
    u.model = createCreature('sea_serpent', { variant: elite ? 'leviathan' : Math.random() < 0.3 ? 'coral' : 'abyssal', elite });
    u.facing = Math.atan2(-(sh.x - x), -(sh.z - z));
    const ai = new SerpentAI(this, u); u.ctrl = ai;
    this.addFoe(ai);
    this.splash(x, z, 3); this.sfx('roar', u.pos, 1.2);
    this.say(elite ? 'A leviathan breaches beside the Dawnrunner!' : 'A sea serpent rises from the deep!', 'warn', true);
    return u;
  }
  spawnPirate(x, z) {
    const sh = this.sh;
    if (x == null) { const a = sh.h + rnd(-0.8, 0.8), r = rnd(110, 150); x = sh.x - Math.sin(a) * r; z = sh.z - Math.cos(a) * r; }
    if (!this.navOk(x, z)) return null;
    const rig = new ShipRig('pirate', { waves: this.waves });
    if (placeholderShip('pirate')) tintShip(rig);
    this.zone.root.add(rig.root); this.rigs.add(rig);
    const names = ['Blackgull Raider', 'Blackgull Brig', 'Rotten Gull', 'The Salted Tooth'];
    const u = this.foeUnit('pirate', pick(names), x, z, 30, { type: 'pirate_ship', radius: 5, height: 12, elite: true, corpse: 9 });
    u.facing = Math.atan2(-(sh.x - x), -(sh.z - z));
    rig.place(x, z, u.facing);
    u.model = shipModel(rig, u, this); u.data.rig = rig;
    const ai = new PirateAI(this, u); u.ctrl = ai; this.addFoe(ai);
    this.say('Sails on the horizon — Blackgull pirates!', 'warn', true);
    this.sfx('ship_bell', { x, y: 0, z }, 1);
    return u;
  }
  spawnKraken() {
    const sh = this.sh, fx = -Math.sin(sh.h), fz = -Math.cos(sh.h);
    const cx = sh.x + fx * (18 + sh.v * 1.5), cz = sh.z + fz * (18 + sh.v * 1.5);
    const n = 3 + Math.floor(Math.random() * 3);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnd(-0.3, 0.3), r = rnd(12, 17), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!this.navOk(x, z) || this.hullIn({ shape: 'circle', x, z, r: 5.5 })) continue;
      const u = this.foeUnit('kraken', 'Kraken Tentacle', x, z, 9, { type: 'kraken_tentacle', radius: 1.4, height: 7, corpse: 6 });
      u.model = createCreature('kraken_tentacle', { variant: this.night > 0.5 ? 'lumen' : Math.random() < 0.5 ? 'crimson' : 'violet' });
      const ai = new TentacleAI(this, u); ai.cd = rnd(2.5, 4.5); u.ctrl = ai; this.addFoe(ai);
      this.splash(x, z, 2.2); made++;
    }
    if (made) { this.say('The water churns… KRAKEN!', 'warn', true); this.shake(0.4); this.sfx('roar', { x: cx, y: 0, z: cz }, 1.5); }
  }
  spawnGhost(x, z) {
    if (this.ghost) return this.ghost.u;
    const sh = this.sh;
    if (x == null) { const a = sh.h + rnd(-0.5, 0.5), r = 95; x = sh.x - Math.sin(a) * r; z = sh.z - Math.cos(a) * r; }
    if (!this.navOk(x, z)) { x = sh.x + 60; z = sh.z - 60; }
    const rig = new ShipRig('ghost', { waves: this.waves, wakeLife: 5 });
    if (placeholderShip('ghost')) ghostify(rig);
    this.zone.root.add(rig.root); this.rigs.add(rig);
    const u = this.foeUnit('ghost', 'Captain Hollowgale', x, z, 190, { type: 'ghost_ship', radius: 6, height: 14, boss: true, corpse: 10 });
    u.data.title = 'The Ghost Ship'; u.facing = Math.atan2(-(sh.x - x), -(sh.z - z)); rig.place(x, z, u.facing);
    u.data.stagger = { v: 100, max: 100, onBreak: () => { this.say('STAGGERED! The Ghost Ship reels.', 'success', true); u.data.stagger.v = 100; u.data.stagger.broken = false; } };
    u.data.onCounter = () => { dealDamage(this.L, this.me, u, this.dmgUnit() * 8, { fixed: this.dmgUnit() * 8 }); this.shake(0.5); };
    u.model = shipModel(rig, u, this); u.data.rig = rig;
    const ai = new GhostAI(this, u); u.ctrl = ai; this.addFoe(ai); this.ghost = ai;
    this.s.ui?.banner?.('Captain Hollowgale', { kind: 'boss', title: 'The Ghost Ship', dur: 3.5 });
    this.game.audio?.stinger?.('boss_intro'); this.game.audio?.music?.('boss');
    this.sfx('ghost_wail', u.pos, 1.5);
    ai.mist = this.game.fx?.play?.('ghost_mist', { pos: u.pos, follow: u, r: 14, dur: 600 }); this.fxh.push(ai.mist);
    return u;
  }
  addFoe(ai) {
    const u = ai.u; this.foes.add(ai);
    this.L.add(u);
    u.pos.y = 0;
    const off = this.L.on('death', ({ unit }) => { if (unit !== u) return; off(); this.onFoeDeath(ai); });
  }
  removeFoe(ai) {
    this.foes.delete(ai);
    if (ai === this.ghost) { this.ghost = null; this.game.audio?.music?.('sea'); G.uDesat.value = 0; }
    if (this.L.byId.has(ai.u.id)) this.L.remove(ai.u);
  }
  onFoeDeath(ai) {
    const u = ai.u, s = this.s, A = s.account, sea = this.sea;
    this.voyage.kills++; sea.stats.kills++;
    this.sh.gale = Math.min(100, this.sh.gale + 14 * this.stats.gale);
    const kind = u.data.sea;
    if (u.data.rig) { const rig = u.data.rig; u.data.rigDriven = false; this.explode(u.pos.x, u.pos.z, 1.6); const t0 = G.uTime.value; const sinkIv = setInterval(() => { if (!this.rigs.has(rig)) { clearInterval(sinkIv); return; } rig.sink = Math.min(9, (G.uTime.value - t0) * 1.1); rig.list = Math.min(0.5, rig.sink * 0.06); }, 50); }
    const rows = [];
    const give = (id, n) => { if (!n) return; A.give(id, n); rows.push({ id, n }); };
    if (kind === 'serpent') { give('silver', Math.round(rnd(3000, 6000))); give('pearl', Math.random() < 0.5 ? 1 : 0); if (Math.random() < 0.18) this.findBounty('bounty:5'); }
    if (kind === 'pirate') { give('silver', Math.round(rnd(4000, 8000))); give('pirate', Math.round(rnd(6, 14))); for (let i = 0; i < 3; i++) this.addFloater(pick(['crate', 'barrel', 'planks']), u.pos.x + rnd(-6, 6), u.pos.z + rnd(-6, 6)); }
    if (kind === 'kraken') { give('silver', Math.round(rnd(800, 1600))); if ([...this.foes].every(f => f.u.dead || f.u.data.sea !== 'kraken')) { give('pirate', 8); if (Math.random() < 0.3) this.findBounty('bounty:8'); this.say('The kraken slinks back into the deep.', 'success'); } }
    if (kind === 'ghost') {
      this.ghostDone = true; sea.stats.ghost++;
      let res = null; try { res = SYS.loot?.eventReward?.(A, s.char, { kind: 'ghostship' }); } catch (e) { res = null; }
      if (res?.rows?.length) for (const r of res.rows) s.ui?.hud?.loot?.(r); else { give('gold', 300); give('silver', 40000); give('pirate', 40); give('card_pack', 1); }
      this.findBounty('bounty:1');
      s.ui?.banner?.('The Ghost Ship is laid to rest', { kind: 'clear', sub: 'Captain Hollowgale sails no more… tonight.' });
      this.game.audio?.stinger?.('quest_complete'); G.uDesat.value = 0;
      s.bus.emit('clear', { content: { kind: 'ghostship' }, result: { cleared: true } });
      trackTask(s, 'clear', { content: 'ghostship', id: 'ghostship' });
      setTimeout(() => { if (this.game.mode === this) this.game.audio?.music?.('sea'); }, 6000);
    }
    this.lootFeed(rows);
    ai.mist?.stop?.(2);
    this.foes.delete(ai);
    if (ai === this.ghost) this.ghost = null;
    A.save();
  }
  nearestFoe(x, z, r = 55, alive = true) {
    let best = null, bd = r;
    for (const f of this.foes) { const u = f.u; if (alive && (u.dead || u.untargetable)) continue; const d = Math.hypot(u.pos.x - x, u.pos.z - z) - u.radius; if (d < bd) { bd = d; best = u; } }
    return best;
  }

  // ---------------------------------------------------------------- combat plumbing
  /** does a hit shape overlap the Dawnrunner's hull (5 sample points along the keel)? */
  hullIn(sh0) {
    const sh = this.sh, fx = -Math.sin(sh.h), fz = -Math.cos(sh.h), rx = -fz, rz = fx;
    for (const [f, r] of HULL_HIT) {
      const px = sh.x + fx * f + rx * r, pz = sh.z + fz * f + rz * r;
      const dx = px - sh0.x, dz = pz - sh0.z;
      if (sh0.shape === 'circle' && dx * dx + dz * dz <= sh0.r * sh0.r) return true;
      if (sh0.shape === 'rect') { const along = dx * sh0.dx + dz * sh0.dz, side = Math.abs(-dx * sh0.dz + dz * sh0.dx); if (along >= 0 && along <= sh0.len && side <= sh0.width / 2) return true; }
      if (sh0.shape === 'cone') { const d = Math.hypot(dx, dz); if (d <= sh0.r && (d < 0.5 || (dx * sh0.dx + dz * sh0.dz) / d >= Math.cos(sh0.angle / 2))) return true; }
    }
    return false;
  }
  hurt(frac, src, what) {
    const sh = this.sh; if (this.sinking) return;
    const k = sh.brace > 0 ? 0.3 : 1;
    const dmg = Math.round(frac * sh.durMax * k);
    sh.dur = Math.max(0, sh.dur - dmg);
    const p = this.rig.world(this.rig.ship.sockets.helm, _v3);
    this.game.fx?.number?.({ x: p.x, y: p.y + 4, z: p.z }, dmg, { style: 'hurt' });
    this.game.fx?.hit?.({ pos: { x: sh.x, y: 2, z: sh.z }, dir: { x: 0, z: 1 }, element: 'water', scale: 2 });
    if (this.game.renderer?.fx) this.game.renderer.fx.hurt = Math.max(this.game.renderer.fx.hurt || 0, Math.min(0.5, frac * 3));
    this.shake(0.25 + frac); this.sfx('impact_heavy', p);
    if (sh.brace > 0) this.game.fx?.shockwave?.({ pos: { x: sh.x, y: 0.5, z: sh.z }, radius: 10, color: 'cyan', dur: 0.4, dust: false });
    if (sh.dur / sh.durMax < 0.3 && !this.lowWarned) { this.lowWarned = true; this.say('The hull is failing! Repair (W) or make for port!', 'warn', true); }
    if (sh.dur / sh.durMax > 0.45) this.lowWarned = false;
  }
  heal(frac) { const sh = this.sh; sh.dur = Math.min(sh.durMax, sh.dur + frac * sh.durMax); }
  sink() {
    this.sinking = true;
    const s = this.s, sea = this.sea;
    s.ui?.banner?.('The Dawnrunner is sinking!', { kind: 'defeat', sub: 'The crew bails, curses, and limps back to port.' });
    this.game.audio?.stinger?.('wipe');
    const t0 = G.uTime.value, rig = this.rig;
    const iv = setInterval(() => { if (!this.rigs.has(rig)) { clearInterval(iv); return; } rig.sink = Math.min(6, (G.uTime.value - t0) * 1.2); }, 50);
    setTimeout(async () => { clearInterval(iv); sea.dur = 0.5; const back = PORTS[sea.last] || PORTS.solhaven; if (this.game.mode !== this) return; this.sinking = false; this.sh.dur = this.sh.durMax * 0.5; await dockAt(s, back.id, { wreck: true }); }, 3800);
  }
  /** lob a cannonball (visual) from p to (tx, tz) over dur seconds; onLand at the end */
  lob(p, tx, tz, dur, onLand) {
    const fx = this.game.fx;
    const h = fx?.projectile?.({ from: { x: p.x, y: p.y, z: p.z }, to: { x: tx, y: 0.5, z: tz }, speed: Math.hypot(tx - p.x, tz - p.z) / dur, kind: 'grenade', color: 'ember', size: 0.32, arc: 2.2, impact: false });
    this.L.after(dur, () => { h?.stop?.(); onLand?.(); });
  }
  muzzle(p, dx, dz) {
    const fx = this.game.fx;
    fx?.burst?.({ pos: { x: p.x + dx * 0.8, y: p.y, z: p.z + dz * 0.8 }, kind: 'fire', color: 'ember', count: 12, speed: 8, size: 0.4, life: 0.25, dir: { x: dx, y: 0.1, z: dz }, spread: 0.3, flash: true });
    fx?.burst?.({ pos: { x: p.x + dx * 1.5, y: p.y, z: p.z + dz * 1.5 }, kind: 'dust', color: 0xf4f0e8, count: 10, speed: 3, size: 1.5, life: 1.8, dir: { x: dx, y: 0.3, z: dz }, spread: 0.5 });
  }
  splash(x, z, s = 1) { this.game.fx?.burst?.({ pos: { x, y: 0.2, z }, kind: 'water', color: 'water', count: Math.round(14 * s), speed: 4 + s * 2.5, size: 0.4 * s, life: 0.9, up: 6 * s, spread: 1 }); }
  shockwave(x, z, r) { this.game.fx?.shockwave?.({ pos: { x, y: 0.2, z }, radius: r, color: 'water', dur: 0.6, dust: false }); }
  explode(x, z, s = 1) { const fx = this.game.fx; fx?.play?.(s > 1.3 ? 'explosion_big' : 'explosion', { pos: { x, y: 1, z }, x, z, r: 3 * s }); this.sfx(s > 1.3 ? 'explosion_big' : 'explosion', { x, y: 0, z }); this.splash(x, z, s * 1.5); }
  ghostBlast(x, z, rx, rz) { for (const s of [-1, 1]) this.game.fx?.beam?.({ from: { x, y: 3, z }, to: { x: x + rx * s * 44, y: 1, z: z + rz * s * 44 }, color: 'teal', width: 3, dur: 0.6, kind: 'energy' }); this.sfx('ghost_slam', { x, y: 0, z }); }
  ghostPillar(x, z) { this.game.fx?.play?.('light_pillar', { pos: { x, y: 0, z }, x, z, color: 'teal', r: 5 }); this.splash(x, z, 1.4); }
  shake(v) { this.game.cam.shake(v * (this.s.account.settings.shake ?? 1)); }
  sfx(name, pos, vol = 1) { try { this.game.audio?.sfx?.(name, { pos, vol }); } catch (e) { /* audio locked */ } }
  say(text, kind = 'info', loud = false) { if (loud) this.s.ui?.banner?.(text, { kind: kind === 'warn' ? 'warn' : 'info', dur: 2.6 }); else this.s.ui?.toast?.(text, kind); }
  warn(tg, u) { /* hook for telegraph sounds */ if (tg && Math.random() < 0.5) this.sfx('telegraph_warn', u?.pos, 0.6); }

  // ---------------------------------------------------------------- skills
  slotSkill(slot) {
    if (slot === 'awaken') return 'sunfire';
    if (slot <= 3) return ['full_sail', 'repair', 'volley', 'brace'][slot];
    const roles = []; for (const c of this.crew) if (ROLE_SKILL[c.role] && !roles.includes(c.role)) roles.push(c.role);
    return ROLE_SKILL[roles[slot - 4]] || null;
  }
  ready(id) { return !(this.cds.get(id) > 0); }
  cast(slot) {
    const id = this.slotSkill(slot); if (!id || this.sinking) return false;
    if (!this.ready(id)) { this.sfx('ui_error'); return false; }
    const sh = this.sh, def = SKILLS[id];
    let ok = true;
    switch (id) {
      case 'full_sail': sh.boost = def.dur; this.sfx('sail_flap', this.me?.pos, 1.2); this.sfx('whoosh_big', this.me?.pos, 0.6); this.game.renderer.fx && (this.game.renderer.fx.radial = Math.max(this.game.renderer.fx.radial || 0, 0.35)); if (!this.course) this.setCourse(this.aheadPoint(120), {}); break;
      case 'repair': if (sh.dur >= sh.durMax - 1) { this.say('The hull is already sound.', 'info'); return false; } sh.repair = { t: 0 }; this.sfx('chop', this.me?.pos); this.game.fx?.burst?.({ pos: { x: sh.x, y: 3, z: sh.z }, kind: 'heal', color: 'heal', count: 26, speed: 3, size: 0.5, life: 1.2, up: 4 }); break;
      case 'volley': ok = this.volley(); break;
      case 'brace': sh.brace = def.dur; this.fxh.push(this.game.fx?.aura?.({ attach: this.rig.body, kind: 'shield', color: 'cyan', scale: 5, radius: 9, dur: def.dur })); this.sfx('shield', this.me?.pos); break;
      case 'harpoon': ok = this.harpoon(); break;
      case 'spyglass': this.reveal(400, 25); this.sfx('buff', this.me?.pos); break;
      case 'chainshot': ok = this.chainshot(); break;
      case 'starfix': ok = this.starfix(); break;
      case 'salvage': { let n = 0; for (const f of this.floaters) if (f.kind !== 'keg' && f.kind !== 'buoy' && Math.hypot(f.x - sh.x, f.z - sh.z) < 45) { f.pull = true; n++; } if (!n) { this.say('No flotsam within reach.', 'info'); ok = false; } else this.sfx('chain', this.me?.pos); break; }
      case 'stew': this.heal(0.15); sh.stew = 10; this.sfx('heal', this.me?.pos); this.game.fx?.play?.('heal_burst', { pos: this.me?.pos, x: sh.x, z: sh.z }); this.say('The crew cheers for Cookie’s stew!', 'success'); break;
      case 'sunfire': ok = this.sunfire(); break;
    }
    if (ok) { this.cds.set(id, def.cd); this.s.ui?.hud?.press?.(slot === 'awaken' ? 'V' : ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'][slot]); }
    return ok;
  }
  gale() {
    const sh = this.sh;
    if (sh.galeT > 0) return;
    if (sh.gale < 100) { this.s.ui?.toast?.('The Gale gauge is not full.', 'error'); this.sfx('ui_error'); return; }
    sh.gale = 0; sh.galeT = SKILLS.gale.dur;
    this.s.ui?.banner?.('GALE FORCE', { kind: 'counter', dur: 1.6 });
    this.sfx('identity_burst', this.me?.pos); this.game.fx?.play?.('wind_burst', { pos: { x: sh.x, y: 0, z: sh.z }, x: sh.x, z: sh.z, r: 16 });
    this.rig.ship.setGlow?.(1.8);
    setTimeout(() => this.rig.ship.setGlow?.(1), SKILLS.gale.dur * 1000);
  }
  aheadPoint(d) { const sh = this.sh; return { x: sh.x - Math.sin(sh.h) * d, z: sh.z - Math.cos(sh.h) * d }; }
  /** broadside at the nearest threat (or toward the cursor side). mult = damage multiplier */
  volley(side0 = null, mult = 1, target = null) {
    const sh = this.sh, rig = this.rig, L = this.L, me = this.me;
    const fx = -Math.sin(sh.h), fz = -Math.cos(sh.h), rx = -fz, rz = fx;
    const tgt = target || this.nearestFoe(sh.x, sh.z, 60);
    let side = side0;
    if (!side) {
      const ax = tgt ? tgt.pos.x : this.ctrl.aim.x, az = tgt ? tgt.pos.z : this.ctrl.aim.z;
      side = ((ax - sh.x) * rx + (az - sh.z) * rz) >= 0 ? 'R' : 'L';
    }
    const s = side === 'R' ? 1 : -1;
    const fire = rig.ship.fire?.(side);
    const socks = (side === 'R' ? rig.ship.sockets.cannonsR : rig.ship.sockets.cannonsL) || [];
    const dmg = this.dmgUnit() * this.stats.cannon * (sh.galeT > 0 ? 1.3 : 1) * mult;
    socks.forEach((sock, i) => {
      L.after(fire?.times?.[i] ?? i * 0.12, () => {
        if (this.game.mode !== this) return;
        const p = rig.world(sock, new THREE.Vector3());
        let dx = rx * s, dz = rz * s, range = 42;
        if (tgt && !tgt.dead) { const tx = tgt.pos.x + rnd(-2, 2), tz = tgt.pos.z + rnd(-2, 2); const vx = tx - p.x, vz = tz - p.z, d = Math.hypot(vx, vz) || 1; if ((vx * dx + vz * dz) / d > 0.2) { dx = vx / d; dz = vz / d; range = d + 3; } }
        this.muzzle(p, dx, dz); this.sfx('cannon', p, 0.9);
        L.projectile({ src: me, x: p.x, z: p.z, y: p.y, dx, dz, speed: 42, range, radius: 0.55, flies: true, arc: 2.4, kind: 'grenade', color: 'ember',
          onHit: (u, pr) => { dealDamage(L, me, u, dmg, { skill: 'volley', kind: 'skill', stagger: 12, counter: true }); this.explode(pr.x, pr.z, 0.8); },
          onEnd: (pr) => { if (!pr.hitSet.size) { this.splash(pr.x, pr.z, 1); this.sfx('wave_splash', { x: pr.x, y: 0, z: pr.z }, 0.5); } } });
      });
    });
    this.shake(0.12);
    if (me) me.model?.play?.('point', { dur: 1.2 });
    return true;
  }
  harpoon() {
    const sh = this.sh, L = this.L, me = this.me;
    const tgt = this.nearestFoe(sh.x, sh.z, 50);
    if (!tgt) { const f = this.floaters.filter(f => f.kind !== 'keg' && f.kind !== 'buoy').sort((a, b) => Math.hypot(a.x - sh.x, a.z - sh.z) - Math.hypot(b.x - sh.x, b.z - sh.z))[0]; if (f && Math.hypot(f.x - sh.x, f.z - sh.z) < 60) { f.pull = true; this.sfx('chain', me?.pos); this.game.fx?.beam?.({ from: this.rig.ship.sockets.helm, to: f.group, color: 'white', width: 0.15, dur: 0.8, kind: 'chain' }); return true; } this.say('Nothing to harpoon.', 'info'); return false; }
    this.game.fx?.beam?.({ from: this.rig.ship.sockets.helm, to: tgt.model?.sockets?.center || { x: tgt.pos.x, y: 2, z: tgt.pos.z }, color: 'white', width: 0.18, dur: 0.9, kind: 'chain' });
    dealDamage(L, me, tgt, this.dmgUnit() * 3.2 * this.stats.cannon, { skill: 'harpoon', kind: 'skill', stagger: 25 });
    this.sfx('chain', me?.pos);
    return true;
  }
  chainshot() {
    const sh = this.sh, me = this.me, tgt = this.nearestFoe(sh.x, sh.z, 55);
    if (!tgt) { this.say('No target in range.', 'info'); return false; }
    const p = this.rig.world(this.rig.ship.sockets.helm, new THREE.Vector3());
    this.muzzle(p, tgt.pos.x - p.x > 0 ? 1 : -1, 0); this.sfx('cannon', p);
    this.lob(p, tgt.pos.x, tgt.pos.z, 0.6, () => { if (tgt.dead) return; dealDamage(this.L, me, tgt, this.dmgUnit() * 2.4 * this.stats.cannon, { skill: 'chainshot', kind: 'skill', stagger: 20 }); tgt.data.slowT = 6; this.game.fx?.burst?.({ pos: { x: tgt.pos.x, y: 3, z: tgt.pos.z }, kind: 'debris', count: 18, speed: 7 }); this.sfx('chain', tgt.pos); });
    return true;
  }
  starfix() {
    const sh = this.sh, souls = new Set(this.s.account.roster.collect.souls || []);
    const next = ISLANDS.filter(I => !souls.has(I.soul.id)).sort((a, b) => Math.hypot(a.x - sh.x, a.z - sh.z) - Math.hypot(b.x - sh.x, b.z - sh.z))[0];
    if (!next) { this.say('Every Island Soul is yours. The stars have nothing left to teach.', 'success'); return false; }
    const p = PORTS[next.id]; this.setCourse({ x: p.x, z: p.z }, { route: true });
    this.say(`The stars point to ${next.name}. Course charted.`, 'success', true);
    this.sfx('buff', this.me?.pos);
    return true;
  }
  sunfire() {
    if (this.voyage.sunfire <= 0) { this.s.ui?.toast?.('No Sunfire Barrage left this voyage.', 'error'); return false; }
    this.voyage.sunfire--;
    const sh = this.sh, L = this.L, me = this.me;
    this.s.ui?.banner?.('SUNFIRE BARRAGE', { kind: 'counter', dur: 1.4 });
    this.game.renderer.fx && (this.game.renderer.fx.flash = 0.2);
    this.sfx('awaken', me?.pos);
    this.volley('L', 1.6); this.volley('R', 1.6);
    L.after(1.1, () => { this.volley('L', 1.6); this.volley('R', 1.6); });
    for (let i = 0; i < 14; i++) L.after(1.4 + i * 0.12, () => {
      if (this.game.mode !== this) return;
      const a = i / 14 * TAU + rnd(-0.2, 0.2), r = rnd(16, 32), x = sh.x + Math.cos(a) * r, z = sh.z + Math.sin(a) * r;
      this.game.fx?.meteor?.({ target: { x, y: 0, z }, radius: 5, color: 'fire', fall: 0.7, telegraph: false, onHit: () => {} });
      L.after(0.7, () => { for (const f of this.foes) { const u = f.u; if (!u.dead && Math.hypot(u.pos.x - x, u.pos.z - z) < 6 + u.radius) dealDamage(L, me, u, this.dmgUnit() * 3, { skill: 'sunfire', kind: 'awaken', stagger: 30 }); } this.splash(x, z, 2); });
    });
    return true;
  }
  useItem(i) {
    const id = ['repair_kit', 'powder_keg', 'flare', null][i]; if (!id) return;
    const sea = this.sea, sh = this.sh;
    if (!(sea.items[id] > 0)) { this.s.ui?.toast?.(`No ${ITEM_DEFS[id].name} left. Restock with the harbour master.`, 'error'); return; }
    const key = 'item:' + id; if (!this.ready(key)) return;
    sea.items[id]--; this.cds.set(key, ITEM_DEFS[id].cd);
    if (id === 'repair_kit') { this.heal(0.25); this.sfx('heal', this.me?.pos); this.game.fx?.burst?.({ pos: { x: sh.x, y: 3, z: sh.z }, kind: 'heal', color: 'heal', count: 20, speed: 3, size: 0.5, life: 1 }); }
    if (id === 'powder_keg') { const f = this.addFloater('keg', sh.x + Math.sin(sh.h) * 12, sh.z + Math.cos(sh.h) * 12); f.fuse = 10; this.sfx('whoosh', this.me?.pos); }
    if (id === 'flare') { this.reveal(500, 30); this.game.fx?.projectile?.({ from: { x: sh.x, y: 4, z: sh.z }, to: { x: sh.x, y: 60, z: sh.z - 20 }, speed: 30, kind: 'fire', color: 'pink', size: 0.6 }); this.sfx('fire', this.me?.pos); }
    this.s.ui?.hud?.press?.(String(i + 1));
  }
  kegBlast(f) {
    this.explode(f.x, f.z, 1.4);
    for (const x of this.foes) { const u = x.u; if (!u.dead && Math.hypot(u.pos.x - f.x, u.pos.z - f.z) < 8 + u.radius) dealDamage(this.L, this.me, u, this.dmgUnit() * 5, { skill: 'keg', kind: 'skill', stagger: 40 }); }
    if (Math.hypot(this.sh.x - f.x, this.sh.z - f.z) < 9) this.hurt(0.05, null, 'your own keg');
  }
  reveal(r, dur) {
    const sh = this.sh; let n = 0;
    for (const f of this.floaters) if (f.kind !== 'keg' && Math.hypot(f.x - sh.x, f.z - sh.z) < r) { this.tempMarker(f.x, f.z, f.kind === 'chest' ? 'Glinting chest' : 'Flotsam', dur); n++; }
    if (this.treasure) { this.tempMarker(this.treasure.x, this.treasure.z, 'Buried treasure', dur); n++; }
    // hidden things further out: a couple of fresh floaters and a chance of a chest
    for (let i = 0; i < 3; i++) { const a = rnd(0, TAU), rr = rnd(80, Math.min(r, 220)), x = sh.x + Math.cos(a) * rr, z = sh.z + Math.sin(a) * rr; if (this.navOk(x, z)) { const f = this.addFloater(Math.random() < 0.3 ? 'chest' : pick(['crate', 'barrel', 'bottle']), x, z); this.tempMarker(f.x, f.z, 'Flotsam', dur); n++; } }
    this.say(`${n} points of interest marked on your chart.`, 'success');
  }

  // ---------------------------------------------------------------- course & markers
  setCourse(p, o = {}) {
    if (!p) { this.course = null; return; }
    this.stopAll = false;
    const sh = this.sh;
    if (o.steer) { this.course = { x: p.x, z: p.z, steer: true }; return; }
    let path = null;
    if (o.route) {
      const N = this.L.nav;
      const goal = N.ok(p.x, p.z) ? p : this.nearestWater(p.x, p.z) || p;
      path = N.los(sh.x, sh.z, goal.x, goal.z, 6) ? [goal] : N.path(sh.x, sh.z, goal.x, goal.z, 6, 60000);
      if (!path?.length) path = [goal];
      p = path[path.length - 1];
      this.say(`Course set: ${Math.round(Math.hypot(p.x - sh.x, p.z - sh.z))} m.`, 'info');
    }
    this.course = { x: p.x, z: p.z, path, total: Math.max(1, pathLen(sh, path || [p])), steer: false };
  }
  /** map travel: a routed course to a port (island id, 'solhaven', 'stronghold', 'pipsprout'); the ship sails itself */
  travelTo(id) {
    const p = PORTS[id] || PORTS[ISLAND_BY_ZONE[id]?.id] || Object.values(PORTS).find(x => x.name.toLowerCase() === String(id).toLowerCase());
    if (!p) { this.say(`No chart for “${id}”.`, 'warn'); return false; }
    if (Math.hypot(p.x - this.sh.x, p.z - this.sh.z) < 36) { this.s.ui?.toast?.(`${p.name} is right here — press G to dock.`, 'info'); return true; }
    this.bound = p;
    this.setCourse({ x: p.x, z: p.z }, { route: true });
    this.s.ui?.banner?.(`Course set: ${p.name}`, { kind: 'info', sub: 'The Dawnrunner sails herself — hold right mouse to take the helm, G at the pier to dock.', dur: 3.2 });
    return true;
  }
  releaseSteer() { const c = this.course; if (c?.steer) this.course = { x: c.x, z: c.z, path: null, total: Math.max(1, Math.hypot(c.x - this.sh.x, c.z - this.sh.z)), steer: false }; }
  nearestWater(x, z) { return this.L.nav.nearest(x, z, 80); }
  marker(x, z, name, title = null) {
    const u = new Unit({ kind: 'npc', team: 2, name, x, z, radius: 0.5, stats: { hpMax: 1, speed: 0 } });
    u.data.noModel = true; u.untargetable = true; u.data.immovable = true; u.data.title = title; u.data.marker = true;
    this.L.add(u); this.markers.push(u);
    return u;
  }
  tempMarker(x, z, name, dur) { const u = this.marker(x, z, name); this.L.after(dur, () => { if (this.L?.byId.has(u.id)) this.L.remove(u); }); }

  // ---------------------------------------------------------------- treasure maps
  pickTreasure(fresh = false) {
    const A = this.s.account, n = A.count('map');
    if (this.treasure) { if (n > 0) return; this.treasure.buoy.group.removeFromParent(); if (this.L.byId.has(this.treasure.marker.id)) this.L.remove(this.treasure.marker); this.treasure = null; return; }
    if (n <= 0) return;
    const sea = this.sea; sea.mapSpot ??= Math.floor(Math.random() * TREASURE_SPOTS.length);
    const spot = TREASURE_SPOTS[sea.mapSpot % TREASURE_SPOTS.length];
    const f = this.addFloater('buoy', spot.x, spot.z);
    this.treasure = { ...spot, buoy: f, marker: this.marker(spot.x, spot.z, 'Buried Treasure', 'Treasure Map') };
    if (fresh) this.say('Your treasure map marks a spot on the chart — look for the golden buoy.', 'success');
  }
  updateTreasure() { if (this.treasure && this.s.account.count('map') <= 0) this.pickTreasure(); }
  async dredge() {
    const s = this.s, A = s.account, T = this.treasure; if (!T) return;
    if (!A.take('map', 1)) return;
    this.sh.v = 0; this.course = null;
    this.say('The crew hauls up a barnacled chest…', 'info');
    this.sfx('chest_open', this.me?.pos);
    T.buoy.group.removeFromParent(); this.floaters = this.floaters.filter(f => f !== T.buoy);
    if (this.L.byId.has(T.marker.id)) this.L.remove(T.marker);
    this.treasure = null; this.sea.mapSpot = null; this.sea.stats.treasure++;
    let res = null; try { res = SYS.loot?.eventReward?.(A, s.char, { kind: 'treasure' }); } catch (e) { res = null; }
    const rows = [];
    if (res?.rows?.length) for (const r of res.rows) s.ui?.hud?.loot?.(r);
    else { const give = (id, n) => { A.give(id, n); rows.push({ id, n }); }; give('silver', Math.round(rnd(15000, 35000))); give('gold', Math.round(rnd(40, 120))); give('pirate', Math.round(rnd(8, 18))); if (Math.random() < 0.3) give('card_pack', 1); }
    this.lootFeed(rows);
    this.game.fx?.lootBeam?.({ pos: { x: this.sh.x, y: 0, z: this.sh.z }, grade: 4, dur: 3 });
    if (Math.random() < 0.3) this.findBounty();
    trackTask(s, 'clear', { content: 'treasure', id: 'treasure' });
    if (Math.random() < 0.3) this.L.after(1.5, () => this.spawnKraken());
    this.pickTreasure();
  }

  // ---------------------------------------------------------------- interaction: docks & treasure
  interactable() {
    const sh = this.sh; if (!sh || this.sinking) return null;
    let best = null, bd = 30;
    for (const p of Object.values(PORTS)) { const d = Math.hypot(p.x - sh.x, p.z - sh.z); if (d < bd) { bd = d; best = { portal: 'port:' + p.id, name: p.name, port: p }; } }
    if (this.treasure && Math.hypot(this.treasure.x - sh.x, this.treasure.z - sh.z) < 14) return { portal: 'treasure', name: 'Dredge the treasure' };
    return best;
  }
  interact(t) {
    if (t?.portal === 'treasure') { this.dredge(); return true; }
    if (t?.port) { this.dock(t.port); return true; }
    return false;
  }
  async dock(p) {
    const s = this.s;
    if (this.foes.size && [...this.foes].some(f => !f.u.dead && f.distShip() < 45)) { s.ui?.toast?.('You can’t dock with enemies on your stern!', 'error'); return; }
    const I = ISLAND_BY_ID[p.id];
    if (I?.night && !isNight()) { const m = Math.ceil(minutesToNight()); s.ui?.toast?.(`The Moonveil mist will not part until nightfall (in about ${m} min). The atoll sleeps by day.`, 'warn'); return; }
    this.sea.last = p.id; if (!this.sea.visited.includes(p.id)) this.sea.visited.push(p.id);
    this.persist();
    this.game.audio?.sfx?.('ship_bell', {});
    trackTask(s, 'sail', { dist: Math.round(this.voyage.dist), arrive: p.id });
    s.bus.emit('sail', { arrive: p.id, dist: Math.round(this.voyage.dist) });
    await dockAt(s, p.id);
  }

  // ---------------------------------------------------------------- HUD (called by the plugin)
  hud(h) {
    const sh = this.sh, sea = this.sea, KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
    h.hp = Math.round(sh.dur); h.hpMax = sh.durMax; h.shield = sh.brace > 0 ? Math.round(sh.durMax * 0.2) : 0;
    h.mp = Math.round(sh.gale); h.mpMax = 100;
    const view = (id, key) => {
      if (!id) return null;
      const d = SKILLS[id];
      return { id: 'ship_' + id, name: d.name, icon: seaIcon(id), type: d.type || 'Normal', key, cd: d.cd, cdLeft: this.cds.get(id) || 0, mana: 0, level: 1, maxLevel: 1, desc: d.desc,
        active: (id === 'full_sail' && sh.boost > 0) || (id === 'brace' && sh.brace > 0) || (id === 'repair' && !!sh.repair), stagger: null, weakPoint: 0, counter: id === 'volley', attack: null, superArmor: null };
    };
    h.skills = KEYS.map((k, i) => view(this.slotSkill(i), k));
    h.awaken = { ...view('sunfire', 'V'), uses: this.voyage.sunfire };
    h.dash = { cd: SKILLS.full_sail.cd, cdLeft: this.cds.get('full_sail') || 0, charges: 1, maxCharges: 1 };
    h.identity = { kind: 'gauge', value: sh.galeT > 0 ? sh.galeT / SKILLS.gale.dur * 100 : sh.gale, max: 100, active: sh.galeT > 0, activeLeft: sh.galeT, label: sh.galeT > 0 ? 'Gale Force' : 'Gale' };
    h.items = ['repair_kit', 'powder_keg', 'flare', null].map((id, i) => id ? { id: 'sea_' + id, icon: seaIcon(id), count: sea.items[id] || 0, cd: ITEM_DEFS[id].cd, cdLeft: this.cds.get('item:' + id) || 0, key: String(i + 1), name: ITEM_DEFS[id].name } : null);
    const buffs = [];
    if (sh.boost > 0) buffs.push({ id: 'full_sail', icon: seaIcon('full_sail'), name: 'Full Sail', left: sh.boost, dur: SKILLS.full_sail.dur, stacks: 1, debuff: false });
    if (sh.brace > 0) buffs.push({ id: 'brace', icon: seaIcon('brace'), name: 'Braced', left: sh.brace, dur: SKILLS.brace.dur, stacks: 1, debuff: false });
    if (sh.galeT > 0) buffs.push({ id: 'gale', icon: seaIcon('gale'), name: 'Gale Force', left: sh.galeT, dur: SKILLS.gale.dur, stacks: 1, debuff: false });
    if (sh.stew > 0) buffs.push({ id: 'stew', icon: seaIcon('stew'), name: 'Galley Stew', left: sh.stew, dur: 10, stacks: 1, debuff: false });
    if (this.windK > 1.06) buffs.push({ id: 'tailwind', icon: seaIcon('gale'), name: 'Tailwind', left: 0, stacks: 1, debuff: false, desc: 'Running with the wind: faster, and the Gale gauge fills quicker.' });
    if ((this.stormAt || 0) > 0.1) buffs.push({ id: 'storm', icon: 'status:shock', name: 'Storm', left: 0, stacks: 1, debuff: true, desc: 'The storm batters the hull. Brace to weather it.' });
    if (this.mistAt > 0.3) buffs.push({ id: 'mist', icon: 'status:slow', name: 'Moonveil Mist', left: 0, stacks: 1, debuff: true });
    h.buffs = buffs;
    h.cast = sh.repair ? { name: 'Repair', label: 'Repairing the hull', pct: sh.repair.t / SKILLS.repair.dur, t: sh.repair.t / SKILLS.repair.dur, kind: 'channel', icon: seaIcon('repair'), left: SKILLS.repair.dur - sh.repair.t } : null;
    h.party = [{ name: 'Dawnrunner', cls: this.s.char?.cls, hp: Math.round(sh.dur), hpMax: sh.durMax, shield: h.shield, dead: false, you: true }];
    // boss / target
    const boss = this.ghost && !this.ghost.u.dead ? this.ghost.u : null;
    h.boss = boss ? { name: boss.name, title: boss.data.title, hp: boss.hp, hpMax: boss.hpMax, barHp: boss.hpMax / 12, stagger: boss.data.stagger ? { v: boss.data.stagger.v, max: boss.data.stagger.max } : null, destruction: null, enrageLeft: null, counter: (boss.data.counterWindow || 0) > 0, buffs: [], showHp: true } : null;
    const tgt = !boss && this.nearestFoe(sh.x, sh.z, 70);
    h.target = tgt ? { name: tgt.name, level: 60, hp: tgt.hp, hpMax: tgt.hpMax, kind: tgt.data.elite ? 'elite' : 'mob', title: tgt.data.sea === 'pirate' ? 'Blackgull Pirates' : null } : null;
    // speed / course as the progress bar
    const kn = Math.round(sh.v * KN), heading = compassPoint(sh.h), wind = compassPoint(Math.atan2(this.waves.wind.x, this.waves.wind.y));
    const c = this.course;
    if (c && !c.steer && c.total > 40) { const left = pathLen(sh, c.path || [c]); h.progress = { label: `Course · ${Math.round(left)} m · ${kn} kn ${heading}`, pct: clamp(1 - left / c.total, 0, 1) * 100 }; }
    else h.progress = null;                                   // speed, heading and wind live in the ship cluster
    const gw = ghostWindow();
    h.timer = !this.ghost && !this.ghostDone && gw?.live ? { label: 'Ghost Ship sighted', left: Math.max(0, (gw.end - Date.now()) / 1000), urgent: true } : null;
    // the dedicated sailing cluster (UI ShipHud: hull, speed dial, sails, Q–R ship skills, compass & wind) — it
    // replaces the combat cluster, so the crew skills (A S D F), Gale / Sunfire and stores go to the tracker below
    const wv = this.waves.wind, dest = c && !c.steer ? { name: this.destName(c), dist: pathLen(sh, c.path || [c]) } : null;
    h.ship = {
      name: 'Dawnrunner', hp: Math.round(sh.dur), hpMax: sh.durMax, speed: +(sh.v * KN).toFixed(1), speedMax: Math.round(this.stats.speed * 1.5 * KN),
      sails: sh.boost > 0 || sh.galeT > 0 ? 3 : sh.v > this.stats.speed * 0.55 ? 2 : sh.v > 1 ? 1 : 0,
      heading: sh.h, wind: Math.atan2(-wv.x, -wv.y), windSpeed: 12 + (this.stormAt || 0) * 26, crew: this.crew.length, dest,
      skills: KEYS.slice(0, 4).map((k, i) => { const v = view(this.slotSkill(i), k); return v && { id: v.id, name: v.name, icon: v.icon, key: k, cd: v.cd, cdLeft: v.cdLeft, desc: v.desc }; }),
    };
    const ready = (id, key) => { const left = this.cds.get(id) || 0; return `${key} · ${SKILLS[id].name}${left > 0.05 ? ` · ${Math.ceil(left)} s` : ' · ready'}`; };
    const crewSteps = [];
    crewSteps.push({ text: sh.galeT > 0 ? `Z · Gale Force · ${Math.ceil(sh.galeT)} s` : `Z · Gale Force · ${sh.gale >= 100 ? 'READY' : Math.floor(sh.gale) + '%'}`, n: 0, need: 1, done: false });
    crewSteps.push({ text: `V · Sunfire Barrage · ${this.voyage.sunfire} left${this.cds.get('sunfire') > 0 ? ` · ${Math.ceil(this.cds.get('sunfire'))} s` : ''}`, n: 0, need: 1, done: this.voyage.sunfire <= 0 });
    for (let i = 4; i < 8; i++) { const id = this.slotSkill(i); if (id) crewSteps.push({ text: ready(id, KEYS[i]), n: 0, need: 1, done: false }); }
    crewSteps.push({ text: `1 Kits ${sea.items.repair_kit || 0} · 2 Kegs ${sea.items.powder_keg || 0} · 3 Flares ${sea.items.flare || 0}`, n: 0, need: 1, done: false });
    // voyage log
    const A = this.s.account, souls = (A.roster.collect.souls || []).length, bounties = (A.roster.collect.bounties || []).length;
    h.quests = [{ id: 'sea:crew', title: 'Crew & stores', kind: 'guide', steps: crewSteps }, { id: 'sea:voyage', title: 'The Glass Sea', kind: 'guide', steps: [
      { text: 'Island Souls', n: souls, need: ISLANDS.length, done: souls >= ISLANDS.length },
      { text: 'Sea Bounties', n: bounties, need: SEA_BOUNTIES.length, done: bounties >= SEA_BOUNTIES.length },
      ...(this.treasure ? [{ text: 'Follow your treasure map to the golden buoy', n: 0, need: 1, done: false }] : []),
    ] }, ...(h.quests || [])];
    if (sh.repair) h.timer = { label: 'Repairing the hull', left: Math.max(0, SKILLS.repair.dur - sh.repair.t) };
  }
  /** name for the ship HUD's destination: the port / landmark the course ends at */
  destName(c) {
    let best = null, bd = 90;
    for (const p of Object.values(PORTS)) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = p.name; } }
    if (best) return best;
    if (this.treasure && Math.hypot(this.treasure.x - c.x, this.treasure.z - c.z) < 40) return 'Treasure';
    return 'Waypoint';
  }
  bossHud() { return null; }
  debug() {
    const m = this;
    return {
      mode: m, get state() { return m.sh; },
      spawn: (k) => k === 'pirate' ? m.spawnPirate() : k === 'kraken' ? m.spawnKraken() : k === 'ghost' ? m.spawnGhost() : m.spawnSerpent(),
      ghost: () => m.spawnGhost(), teleport: (x, z, h) => { m.sh.x = x; m.sh.z = z; if (h != null) m.sh.h = h; m.sh.v = 0; m.rig.place(x, z, m.sh.h); m.game.cam.snap(new THREE.Vector3(x, 0, z)); },
      goto: (id) => { const p = PORTS[id]; if (p) m.setCourse({ x: p.x, z: p.z }, { route: true }); },
      dock: (id) => dockAt(m.s, id), float: (k = 'chest') => m.addFloater(k, m.sh.x - Math.sin(m.sh.h) * 30, m.sh.z - Math.cos(m.sh.h) * 30),
      foes: () => [...m.foes].map(f => ({ kind: f.u.data.sea, hp: f.u.hp, state: f.state })),
    };
  }
}

// ------------------------------------------------------------------------------------------------ helpers
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
/** hull probe points (forward, right) in metres, for grounding and hit tests */
const HULL_PTS = [[8.6, 0], [5.4, 2.1], [5.4, -2.1], [0, 2.7], [0, -2.7], [-6.2, 2.2], [-6.2, -2.2], [-8.2, 0]];
const HULL_HIT = [[8, 0], [4, 0], [0, 0], [-4, 0], [-7.5, 0], [0, 2.4], [0, -2.4]];
function pathLen(sh, path) { let d = 0, x = sh.x, z = sh.z; for (const p of path || []) { d += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; } return d; }
/** darken a stand-in hull into a pirate brig: tarred wood, soot-black sails (until the real pirate model lands) */
function tintShip(rig) {
  rig.ship.root.traverse(o => { if (!o.material) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m.color) m.color.multiply(new THREE.Color(o.name === 'ship-sails' ? 0x3a3434 : 0x9a6a5a)); });
}
/** blend two envs (colours, numbers, sun direction, grade) */
export function lerpEnv(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const c = new THREE.Color(), d = new THREE.Color(), out = { ...a };
  for (const k of ['sunColor', 'hemiSky', 'hemiGround', 'fogColor', 'fogSunColor', 'background']) { if (a[k] == null || b[k] == null) continue; out[k] = c.set(a[k]).lerp(d.set(b[k]), t).getHex(); }
  for (const k of ['sunIntensity', 'hemiIntensity', 'fogDensity', 'fogHeight', 'fogBase', 'night', 'clouds']) if (typeof a[k] === 'number' && typeof b[k] === 'number') out[k] = lerp(a[k], b[k], t);
  const sd = [0, 1, 2].map(i => lerp(a.sunDir[i], b.sunDir[i], t)), l = Math.hypot(...sd) || 1; out.sunDir = sd.map(v => v / l);
  out.grade = { ...a.grade };
  for (const k in b.grade) { const x = a.grade[k], y = b.grade[k]; if (typeof x === 'number' && typeof y === 'number') out.grade[k] = lerp(x, y, t); else if (Array.isArray(x) && Array.isArray(y)) out.grade[k] = x.map((v, i) => lerp(v, y[i], t)); }
  out.preset = t < 0.5 ? a.preset : b.preset;
  return out;
}
/** the Ghost Ship's scheduled windows: the event compass (systems) when available, else Thu & Sun 12/16/20/23 UTC */
export function ghostWindow(now = Date.now()) {
  try { const w = SYS.tasks?.eventWindow?.('ghostship', now); if (w) return { live: !!w.live, start: w.start, end: w.end }; } catch (e) { /* systems not ready */ }
  const d = new Date(now), day = d.getUTCDay();
  if (day !== 4 && day !== 0) return null;
  for (const hr of [12, 16, 20, 23]) { const s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hr); if (now >= s && now < s + 20 * 60000) return { live: true, start: s, end: s + 20 * 60000 }; }
  return null;
}
/** a collectible (systems catalogue when present; else recorded on the roster) + the session 'collect' event */
export function collect(session, type, id, name) {
  const A = session.account;
  let res = null;
  try { res = SYS.collectibles?.collect?.(A, session.char, type, id); } catch (e) { res = null; }
  if (!res) { const list = (A.roster.collect[type] ||= []); const isNew = !list.includes(id); if (isNew) { list.push(id); A.save(); } res = { ok: true, isNew, have: list.length }; }
  session.bus.emit('collect', { id, n: 1, type, name });
  return res;
}
export function trackTask(session, event, data) {
  try { const notes = SYS.tasks?.track?.(session.account, session.char, event, data) || SYS.track?.(session.account, session.char, event, data); for (const n of notes || []) session.ui?.toast?.(n.text, 'success'); } catch (e) { /* systems not ready */ }
}
const BOTTLE_NOTES = [
  '“If found, return to Baroness Brightpenny. She owes me forty silver.”',
  '“Day 12. The Pips on the turtle have adopted me. I am their king now. Send no help.”',
  '“The bell rings at low tide. Do NOT ring it back.”',
  '“Stormcrown’s lightning strikes where you stand, not where you run. Keep running.”',
  '“To whoever finds this: the mermaid likes round pearls and sea shanties. Mostly pearls.”',
  '“Hollowgale sails when the moon is high. Bring cannons. Bring friends. Bring a spare ship.”',
];

// ------------------------------------------------------------------------------------------------ travel
function zonePort(zoneId) {
  if (zoneId === 'solhaven') return 'solhaven';
  if (zoneId === 'stronghold') return 'stronghold';
  if (zoneId === 'pipsprout') return 'pipsprout';
  const I = ISLAND_BY_ZONE[zoneId]; return I ? I.id : null;
}
/** leave the sea at a port: Solhaven, an island, Brightwater Isle, Pipsprout Hollow */
export async function dockAt(session, portId, o = {}) {
  const p = PORTS[portId] || PORTS.solhaven, g = session.game;
  if (p.kind === 'island') return session.launch({ kind: 'island', island: p.island, from: 'sea' });
  if (p.launch && LAUNCHERS[p.launch]) return session.launch({ kind: p.launch, from: 'sea', port: p.id });
  if (p.id !== 'solhaven' && !ZONES[p.zone]) {
    session.ui?.toast?.(p.id === 'pipsprout' ? 'Pipsprout Hollow’s jetty is still being built (the Pips are very small carpenters).' : `${p.name} can’t be reached yet.`, 'warn');
    if (o.wreck) return dockAt(session, 'solhaven', o);
    return;
  }
  await session.loadZone(p.zone, { kind: p.kind === 'city' ? 'city' : p.kind, region: p.region });
  const A = g.zone.anchors, a = A[p.anchor] || A['dock:ship'] || A.spawn || { x: 0, z: 0, facing: 0 };
  // step off the ship onto the pier (dock anchors face the sea)
  const back = (a.facing || 0) + Math.PI;
  session.spawnMe({ x: a.x - Math.sin(back) * 1.5, z: a.z - Math.cos(back) * 1.5, facing: back });
  g.mode = session.hub = session.zoneMode(p.zone); session.hub.enter?.();
  session.inWorld();
  session.bus.emit('zone', { id: p.zone, kind: g.zone?.kind || p.kind });
  if (o.wreck) session.ui?.toast?.('The crew patched the hull enough to limp home. Durability 50%.', 'warn');
}
/**
 * launch({ kind: 'sail', from?, to? }) — board the Dawnrunner. `from` = the port you leave from (default: the port of
 * the current zone, else the last port). `to` = a port id (island id, 'solhaven', 'stronghold', 'pipsprout'): the
 * ship takes a routed course there by itself (map travel). Already at sea: just sets the course.
 */
async function launchSail(session, c = {}) {
  const g = session.game, to = c.to && c.to !== 'sea' ? c.to : null;
  if (g.mode instanceof SailingMode) { if (to) g.mode.travelTo(to); else session.ui?.toast?.('You are already at sea.', 'info'); return; }
  const from = c.from && c.from !== 'sea' ? c.from : zonePort(g.zone?.id) || seaState(session.account).last || 'solhaven';
  if (to && to === from && PORTS[to]?.kind === 'island' && g.mode?.kind === 'island') { session.ui?.toast?.(`You are already on ${PORTS[to].name}.`, 'info'); return; }
  const port = PORTS[from] || PORTS.solhaven;
  await session.loadZone('glass_sea', { kind: 'sea', region: SEA_NAME });
  session.spawnMe({ x: port.x, z: port.z, facing: port.facing });
  const mode = new SailingMode(session, { port });
  g.mode = mode; mode.enter();
  session.inWorld();
  seaState(session.account).last = port.id;
  if (to && to !== port.id) setTimeout(() => { if (g.mode === mode) mode.travelTo(to); }, 1200);
}

// ------------------------------------------------------------------------------------------------ harbour master
async function harbourMaster(session, n) {
  const A = session.account, sea = seaState(A), ui = session.ui;
  const crew = shipCrew(A), st = shipStats(crew);
  const pct = Math.round(sea.dur * 100);
  const line = `The Dawnrunner is ${pct >= 99 ? 'sound and ready' : `at ${pct}% hull`}. Crew aboard: ${crew.map(c => `${c.name} (${c.role})`).join(', ')}.`;
  const pick = await ui.dialog({ id: n?.id || 'harbor', name: n?.name || 'Captain Mirelle Stormwake', title: n?.title || 'Harbor Master' }, [{ text: line, choices: [
    { id: 'sail', text: 'Set sail on the Glass Sea.', kind: 'quest' },
    { id: 'repair', text: `Refit the hull (${pct >= 99 ? 'free' : `${(100 - pct) * 120} silver`}).`, kind: 'shop' },
    { id: 'supplies', text: 'Restock supplies — 3 Repair Kits, 3 Powder Kegs, 2 Flares (6,000 silver).', kind: 'shop' },
    { id: 'crew', text: 'Choose my crew.', kind: 'talk' },
    { id: 'log', text: 'Show me my voyage log.', kind: 'talk' },
    { id: 'bye', text: 'Farewell.', kind: 'leave' },
  ] }]);
  if (pick === 'sail') return session.launch({ kind: 'sail', from: zonePort(session.game.zone?.id) || 'solhaven' });
  if (pick === 'repair') { const cost = (100 - pct) * 120; if (cost > 0 && !A.take('silver', cost)) { ui.toast('Not enough silver.', 'error'); return; } sea.dur = 1; A.save(); ui.toast('The shipwrights hammer and caulk. The Dawnrunner is good as new.', 'success'); session.game.audio?.sfx?.('honing_hammer', {}); return; }
  if (pick === 'supplies') { if (!A.take('silver', 6000)) { ui.toast('Not enough silver.', 'error'); return; } sea.items.repair_kit = (sea.items.repair_kit || 0) + 3; sea.items.powder_keg = (sea.items.powder_keg || 0) + 3; sea.items.flare = (sea.items.flare || 0) + 2; A.save(); ui.toast('Supplies stowed below deck.', 'success'); return; }
  if (pick === 'crew') return crewMenu(session);
  if (pick === 'log') {
    const s = sea.stats, souls = (A.roster.collect.souls || []).length, b = (A.roster.collect.bounties || []).length;
    await ui.dialog({ name: 'Voyage Log', title: 'The Dawnrunner' }, [{ text: `Sailed ${Math.round(s.dist / 1000 * 10) / 10} km · ${s.kills} sea foes sunk · ${s.flotsam} flotsam hauled · ${s.treasure} treasures dredged · Ghost Ship laid to rest ${s.ghost}×. Island Souls ${souls}/${ISLANDS.length} · Sea Bounties ${b}/${SEA_BOUNTIES.length}. Ports visited: ${sea.visited.map(id => PORTS[id]?.name || id).join(', ')}.`, choices: [{ id: 'ok', text: 'Fair winds.', kind: 'leave' }] }]);
  }
}
async function crewMenu(session) {
  const A = session.account, sea = seaState(A);
  let all = []; try { all = SH.state?.(A)?.crew || []; } catch (e) { all = []; }
  if (!all.length) all = FALLBACK_CREW;
  for (;;) {
    const aboard = shipCrew(A), ids = aboard.map(c => c.id);
    const choices = all.map(c => ({ id: c.id, text: `${ids.includes(c.id) ? '⚓ ' : '· '}${c.name} — ${c.role} (power ${c.power})${ROLE_SKILL[c.role] ? ` · ${SKILLS[ROLE_SKILL[c.role]].name}` : ''}`, kind: ids.includes(c.id) ? 'quest' : 'talk' }));
    choices.push({ id: 'done', text: 'That’s my crew.', kind: 'leave' });
    const pick = await session.ui.dialog({ name: 'The Dawnrunner’s crew', title: `${aboard.length}/5 aboard` }, [{ text: 'Five berths aboard. Each role brings a skill (A S D F) and a bonus: Sailors speed, Scouts spot flotsam, Brawlers aim true, Scholars read the wind, Traders haggle with the sea, Cooks keep the hull patched.', choices }]);
    if (!pick || pick === 'done') return;
    let cur = sea.crew.length ? sea.crew.slice() : ids.slice();
    if (cur.includes(pick)) cur = cur.filter(x => x !== pick); else { cur.push(pick); if (cur.length > 5) cur.shift(); }
    sea.crew = cur; A.save();
  }
}

// ------------------------------------------------------------------------------------------------ registration
registerContent('sail', launchSail);
registerService('sail', (session, n) => harbourMaster(session, n));
registerZoneMode('glass_sea', (session, zone) => new SailingMode(session, { port: PORTS[seaState(session.account).last] || PORTS.solhaven }));
registerPlugin({
  id: 'sailing',
  init(session) { this.s = session; },
  /** board the Dawnrunner from any dock:ship anchor (Solhaven's pier, Brightwater Isle's jetty…) */
  interact(t) {
    if (t?.portal !== 'dock:ship') return false;
    const g = this.s.game;
    if (g.mode instanceof SailingMode) return false;
    if (ISLAND_BY_ZONE[g.zone?.id]) return false;          // islands handle their own pier
    this.s.launch({ kind: 'sail', from: zonePort(g.zone?.id) || 'solhaven' });
    return true;
  },
  hud(h) { const m = this.s.game.mode; if (m instanceof SailingMode && m.sh) m.hud(h); },
});
// HUD clicks that would otherwise reach the hero's kit
registerAction('hud:item', (session, type, p) => { const m = session.game.mode; if (!(m instanceof SailingMode)) return false; m.useItem(p.slot); return true; });
registerAction('hud:awaken', (session) => { const m = session.game.mode; if (!(m instanceof SailingMode)) return false; m.cast('awaken'); return true; });
registerAction('hud:dash', (session) => { const m = session.game.mode; if (!(m instanceof SailingMode)) return false; m.cast(0); return true; });
registerAction('hud:shipskill', (session, type, p) => { const m = session.game.mode; if (!(m instanceof SailingMode)) return false; m.cast(p?.slot ?? 0); return true; });
