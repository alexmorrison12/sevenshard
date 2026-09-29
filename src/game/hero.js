// Hero kit: turns a character record into a playable Unit and owns everything a hero can do — skills (cooldowns,
// mana, combo/chain/holding/charge semantics), basic-attack combo, dash and stand-up, identity, awakening and battle
// items. The local player controller, AI party members and network mirrors all drive heroes through this API.
import { Unit } from './unit.js';
import { SkillRun } from './skills/runner.js';
import { buildSkill } from './skills/tripods.js';
import { eff, applyStatus, removeStatus, heal, resolveHit } from './combat.js';
import { CLASSES } from '../data/classes/index.js';
import { makeIdentity } from './identity.js';
import { facingOf } from '../core/util.js';
import { mods as gemMods } from './systems/gems.js';

export const SLOT_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];

export class HeroKit {
  /**
   * char: { name, cls, sex, level, look, gear, skills: { [id]: { lv, tri: [a,b,c] } }, bar: [ids ×8], engr: [...] }
   * stats: combat stats (systems/stats.js), items: battle items [{ id, count }]
   */
  constructor(level, char, stats, o = {}) {
    this.level = level; this.char = char;
    this.cls = CLASSES[char.cls];
    const u = this.u = new Unit({ kind: 'hero', team: o.team ?? 0, name: char.name, cls: char.cls, level: char.level, x: o.x, z: o.z, facing: o.facing, radius: 0.45, height: 1.85, stats });
    u.kit = this; u.data.sex = char.sex;
    u.mp = u.mpMax;
    this.skills = {};           // id → built def
    this.rebuild();
    this.basicStage = 0; this.basicT = 0; this.basicQueued = false;
    this.dashCd = 0; this.standCd = 0; this.dashCharges = 1;
    this.awakenUses = (this.cls.awakening.uses ?? 3) + (stats.awakenUses || 0);
    if (stats.cheat) u.data.cheatDeath = true;                 // Crisis Evasion
    if (stats.superArmor) u.baseSuperArmor = stats.superArmor; // Bloodfrenzy
    if (stats.tyrant) u.data.tyrant = true;                    // Horned Tyrant 6-set
    this.items = o.items || [{ id: 'hp_potion', count: 10, cd: 0 }, { id: 'destruction_bomb', count: 5, cd: 0 }, { id: 'flame_grenade', count: 5, cd: 0 }, { id: 'time_stop', count: 2, cd: 0 }];
    this.identity = makeIdentity(this);
    u.data.onHitLanded = (evs, h, ctx) => {
      this.identity.onHit?.(evs, h, ctx);
      if (u.data.tyrant) for (const ev of evs) if (ev.tgt.kind === 'boss' && Math.random() < 0.06) applyStatus(this.level, ev.tgt, 'brand', { dur: 6, src: u });
    };
  }
  rebuild() {
    const c = this.char;
    this.skills = {};
    for (const k of this.cls.skills) {
      const s = c.skills?.[k.id] || { lv: 1, tri: [-1, -1, -1] };
      this.skills[k.id] = buildSkill(k, s.lv, s.tri);
    }
    this.awaken = buildSkill(this.cls.awakening, 1, []);
    // per-class damage tuning (tools/balance.mjs keeps DPS classes within ~10% of each other)
    const tune = this.cls.tune || 1;
    if (tune !== 1) { for (const d of Object.values(this.skills)) d.mult *= tune; this.awaken.mult *= tune; }
    const st = this.u?.st || {};
    if (st.awakenCdr) this.awaken.cd *= 1 - st.awakenCdr;
    // gems: Ruinstones raise a skill's damage, Swiftstones cut its cooldown (sockets: char.gems, see systems/gems.js)
    if (c.gems?.length) for (const [id, m] of Object.entries(gemMods(c))) {
      const d = this.skills[id]; if (!d) continue;
      if (m.dmg) d.mult *= 1 + m.dmg;
      if (m.cdr) d.cd *= 1 - m.cdr;
    }
    // Mana Flow and friends: flat mana cost reduction
    if (st.mpCostMul) for (const d of Object.values(this.skills)) d.mp = Math.round(d.mp * st.mpCostMul);
    this.bar = (c.bar && c.bar.length ? c.bar : this.cls.defaultBar).slice(0, 8);
    while (this.bar.length < 8) this.bar.push(null);
  }
  get busy() { return !!this.u.skill; }
  skillAt(slot) { const o = this.identity.overrideSkill?.(slot); if (o) return o; const id = this.bar[slot]; return id ? this.skills[id] || null : null; }

  /** Can a new skill start now? (not disabled; current skill finished or in its cancel window) */
  ready(def) {
    const u = this.u;
    if (u.dead || u.disabled || u.cc.silence > 0) return false;
    if (def && u.cdLeft(def.id) > 0) return false;
    if (def && def.mp && u.mp < def.mp * (this.identity.mpMul?.() ?? 1)) return false;
    if (u.skill && !(u.skill.canDashCancel() && def?.cancelsOthers !== false && u.skill.t >= (u.skill.cancelAt ?? 0))) return false;
    return true;
  }
  _start(def, aim, opts = {}) {
    const u = this.u, L = this.level;
    if (u.skill) u.skill.cancel('chain');
    const run = new SkillRun(L, u, { ...def, speedBonus: undefined }, { aimX: aim.x, aimZ: aim.z }, {
      kind: opts.kind || 'skill', mult: (opts.mult ?? 1) * (this.identity.skillMul?.(def, opts) ?? 1),
      onEnd: (r, why) => { this.onSkillEnd(def, r, why, opts); },
    });
    run.speedMul *= 1 + (def.speedBonus || 0);
    // Sunheart "Hyper Awakening Technique": every 30 s the next skill hits 40% harder
    if (u.st.hyperTech && opts.kind === 'skill' && L.time >= (this.hyperT || 0)) { run.mult *= 1.4; this.hyperT = L.time + 30; L.emit('fx', { unit: u, preset: 'hyper_flash', x: u.pos.x, z: u.pos.z, ev: { color: 'gold', r: 2.5 } }); }
    if (def.domBonus) run.mult *= 1; // handled via executeBonus/domBonus in onDealt (kept for tooltips)
    u.skill = run;
    if (!opts.free) u.mp -= (def.mp || 0) * (this.identity.mpMul?.() ?? 1);
    if (def.type !== 'combo' && def.type !== 'chain' && !opts.noCd) this.startCd(def);
    this.identity.onCast?.(def, run, opts);
    L.emit('cast', { unit: u, def, run });
    return run;
  }
  startCd(def) { if (def.cd) this.u.cd.set(def.id, def.cd * (1 - eff(this.u).cdr) * (this.identity.cdMul?.(def) ?? 1)); }
  onSkillEnd(def, run, why, opts) {
    if ((def.type === 'combo' || def.type === 'chain') && !opts.noCd) this.startCd(def);
  }

  /** press a skill slot (0..7) */
  press(slot, aim) {
    const def = this.skillAt(slot); if (!def) return false;
    const u = this.u;
    if (u.skill && u.skill.def.id === def.id && !u.skill.done) {
      if (def.type === 'combo' || def.type === 'chain') { u.skill.press(); return true; }
      return false;
    }
    if (!this.ready(def)) { if (u.skill) { this.queued = { slot, t: this.level.time }; return false; } if (u.cdLeft(def.id) > 0) this.level.emit('denied', { unit: u, why: 'cooldown' }); else if (def.mp && u.mp < def.mp) this.level.emit('denied', { unit: u, why: 'mana' }); return false; }
    this._start(def, aim, { slot });
    return true;
  }
  release(slot) { const def = this.skillAt(slot); const r = this.u.skill; if (def && r && r.def.id === def.id) r.release(); }

  basic(aim) {
    const u = this.u;
    if (u.skill && u.skill.def.basic) { u.skill.queuedBasic = true; return; }
    if (!this.ready(null)) return;
    const now = this.level.time;
    if (now - this.basicT > 0.9) this.basicStage = 0;
    const b = this.cls.basic[this.basicStage % this.cls.basic.length];
    const events = [{ t: 0, a: 'anim', name: b.anim, dur: b.dur }];
    if (b.hit && b.hit.shape !== 'none') events.push({ ...b.hit, a: 'hit' });
    if (b.fx) events.push({ ...b.fx, a: 'fx' });
    if (b.proj) events.push({ t: 0.12, ...b.proj, a: 'proj' });
    events.push({ t: b.hit?.t ?? b.proj?.t ?? 0.15, a: 'sfx', name: b.sfx || 'slash' });
    events.sort((a, c) => (a.t || 0) - (c.t || 0));
    const def = { id: 'basic', basic: true, type: 'normal', dur: b.dur, cancelAt: b.dur * 0.55, events };
    const run = this._start(def, aim, { kind: 'basic', free: true, noCd: true });
    this.basicStage = (this.basicStage + 1) % this.cls.basic.length; this.basicT = now + b.dur;
    return run;
  }

  /** Space: dash (or Stand Up while knocked down) */
  dash(aim) {
    const u = this.u, L = this.level;
    if (u.dead) return false;
    if (u.cc.down > 0 || u.air.launched) {
      if (this.standCd > 0 || u.cc.down > 3.5) return false;
      if (u.cc.down > 0 && u.data.downT != null && u.data.downT < 0.3) return false;
      u.cc.down = 0; u.air.launched = false; u.air.y = 0; u.kb.t = 0; u.invuln = Math.max(u.invuln, 0.6); this.standCd = 12;
      L.emit('standUp', { unit: u });
      return true;
    }
    if (this.dashCd > 0 || u.cc.stun > 0 || u.cc.freeze > 0 || u.cc.sleep > 0 || u.cc.fear > 0) return false;
    if (u.skill && !u.skill.canDashCancel()) return false;
    if (u.skill) u.skill.cancel('dash');
    const d = this.cls.dash;
    let dx = aim.x - u.pos.x, dz = aim.z - u.pos.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const def = { id: 'dash', type: 'normal', dur: d.dur + 0.08, fixedSpeed: true, events: [{ t: 0, a: 'anim', name: 'dash', dur: d.dur + 0.1 }, { t: 0, a: 'move', kind: 'dash', dist: d.dist, dur: d.dur, iframes: d.dur + 0.05 }, { t: 0, a: 'fx', preset: 'dash_trail', color: this.cls.palette?.fx || 'white' }, { t: 0, a: 'sfx', name: 'dash' }] };
    u.skill = new SkillRun(L, u, def, { aimX: u.pos.x + dx, aimZ: u.pos.z + dz }, { kind: 'dash' });
    this.dashCd = d.cd * (1 - eff(u).cdr * 0.5);
    L.emit('dash', { unit: u });
    return true;
  }
  identityKey(k, aim) { return this.identity.key?.(k, aim) ?? false; }
  awakenCast(aim) {
    if (this.awakenUses <= 0) { this.level.emit('denied', { unit: this.u, why: 'awakening' }); return false; }
    const def = this.awaken;
    if (!this.ready(def)) return false;
    const r = this._start(def, aim, { kind: 'awaken', mult: eff(this.u).awakenMul });
    this.awakenUses--;
    this.level.emit('awaken', { unit: this.u, def });
    return !!r;
  }
  useItem(i, aim) {
    const it = this.items[i]; const u = this.u, L = this.level;
    if (!it || it.count <= 0 || it.cd > 0 || u.dead) return false;
    const def = BATTLE_ITEMS[it.id]; if (!def) return false;
    if (def.needsReady && !this.ready(null)) return false;
    def.use(L, u, aim, this);
    it.count--; it.cd = def.cd || 1; it.cdMax = def.cd || 1;
    L.emit('itemUsed', { unit: u, item: it.id });
    return true;
  }
  update(dt) {
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.standCd > 0) this.standCd -= dt;
    for (const it of this.items) if (it.cd > 0) it.cd -= dt;
    const u = this.u;
    if (u.cc.down > 0) u.data.downT = (u.data.downT ?? 0) + dt; else u.data.downT = null;
    this.identity.update?.(dt);
    // buffered skill press (pressed while another skill was finishing)
    if (this.queued && this.level.time - this.queued.t < 0.45 && (!u.skill || u.skill.canDashCancel())) { const q = this.queued; this.queued = null; const aim = u.ctrl?.aim || { x: u.pos.x + u.fx, z: u.pos.z + u.fz }; const d = this.skillAt(q.slot); if (d && u.cdLeft(d.id) <= 0) this.press(q.slot, aim); }
    else if (this.queued && this.level.time - this.queued.t >= 0.45) this.queued = null;
    // queued basic attack continues the combo
    if (u.skill?.def.basic && u.skill.queuedBasic && u.skill.t >= u.skill.cancelAt) { const aim = u.ctrl?.aim || { x: u.pos.x + u.fx, z: u.pos.z + u.fz }; u.skill.cancel('combo'); u.skill = null; this.basic(aim); }
  }
  hudIdentity() { return this.identity.hud?.() || null; }
}

// ---------------------------------------------------------------- battle items
export const BATTLE_ITEMS = {
  hp_potion: { name: 'Healing Potion', cd: 10, use(L, u) { heal(L, u, u, u.hpMax * 0.3); u.model?.play?.('use_item', { dur: 0.6 }); L.emit('fx', { unit: u, preset: 'heal_burst', x: u.pos.x, z: u.pos.z }); L.emit('sfx', { unit: u, name: 'heal', pos: u.pos }); } },
  elixir: { name: 'Major Elixir', cd: 30, use(L, u) { heal(L, u, u, u.hpMax * 0.5); u.model?.play?.('use_item', { dur: 0.6 }); L.emit('fx', { unit: u, preset: 'heal_burst', x: u.pos.x, z: u.pos.z }); L.emit('sfx', { unit: u, name: 'heal', pos: u.pos }); } },
  destruction_bomb: { name: 'Destruction Bomb', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 4, r: 2.6, wp: 3, stagger: 30, destruction: 30, fx: 'explosion' }); } },
  flame_grenade: { name: 'Flame Grenade', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 6, r: 3, status: [{ id: 'burn', dur: 6, power: 1 }], fx: 'fire_burst', elem: 'fire' }); } },
  frost_grenade: { name: 'Frost Grenade', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 3, r: 3, status: [{ id: 'freeze', dur: 3 }], fx: 'frost_burst', elem: 'ice' }); } },
  whirlwind_grenade: { name: 'Whirlwind Grenade', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 2, r: 3.5, stagger: 45, knock: 'pull', kb: 3, fx: 'wind_burst' }); } },
  clay_grenade: { name: 'Clay Grenade', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 2, r: 3, stagger: 30, status: [{ id: 'stun', dur: 2.5 }], fx: 'dust_burst' }); } },
  dark_grenade: { name: 'Dark Grenade', cd: 25, use(L, u, aim) { throwItem(L, u, aim, { coef: 3, r: 3, status: [{ id: 'def_down', dur: 10 }], fx: 'dark_burst' }); } },
  time_stop: { name: 'Time Stop Potion', cd: 60, use(L, u) { applyStatus(L, u, 'invuln', { dur: 3, src: u }); u.invuln = Math.max(u.invuln, 3); u.data.rooted = true; L.after(3, () => { u.data.rooted = false; }); L.emit('fx', { unit: u, preset: 'time_stop', x: u.pos.x, z: u.pos.z }); } },
  panacea: { name: 'Panacea', cd: 30, use(L, u) { for (const s of u.statuses.slice()) if (s.def.debuff) removeStatus(L, u, s.id); L.emit('fx', { unit: u, preset: 'cleanse', x: u.pos.x, z: u.pos.z }); } },
  feather: { name: 'Resurrection Feather', cd: 1, use() {} },
};
function throwItem(L, u, aim, o) {
  const dx = aim.x - u.pos.x, dz = aim.z - u.pos.z, d = Math.min(12, Math.hypot(dx, dz)) || 1;
  const nx = dx / (Math.hypot(dx, dz) || 1), nz = dz / (Math.hypot(dx, dz) || 1);
  u.facing = facingOf(nx, nz);
  u.model?.play?.('throw', { dur: 0.5 });
  L.projectile({ src: u, x: u.pos.x, z: u.pos.z, dx: nx, dz: nz, speed: 18, range: d, radius: 0.1, noHit: true, arc: 2.5, kind: 'grenade', flies: true,
    onEnd: p => {
      const hit = { shape: 'circle', r: o.r, coef: o.coef, wp: o.wp, stagger: o.stagger, status: o.status, knock: o.knock, kb: o.kb, elem: o.elem };
      const evs = resolveHit(L, u, hit, p.x, p.z, nx, nz, { skill: 'item', kind: 'item' });
      if (o.destruction) for (const ev of evs) { const ds = ev.tgt.data.destruction; if (ds && !ds.broken) { ds.v = Math.max(0, ds.v - o.destruction); if (ds.v <= 0) { ds.broken = true; L.emit('partBreak', { tgt: ev.tgt, src: u, part: ds.part }); ds.onBreak?.(u); } } }
      L.emit('fx', { unit: u, preset: o.fx, x: p.x, z: p.z, r: o.r });
      L.emit('sfx', { unit: u, name: 'explosion', pos: { x: p.x, y: 0, z: p.z } });
    } });
}
