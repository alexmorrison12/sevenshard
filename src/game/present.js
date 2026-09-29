// Presentation: turns simulation events into effects, sounds, numbers, camera shake and UI callouts.
// Works with the full FX module or the FXLite fallback (same contract). Never changes simulation state.
import * as THREE from 'three';
import { FXLite } from './fxlite.js';

const _v = new THREE.Vector3();

export class Presenter {
  constructor(game) {
    this.g = game;
    this.lite = null;
    this.lastSfx = new Map();
    this.projFx = new Map();
    this.telegraphFx = new Map();
    this.zoneFx = new Map();
  }
  get fx() { return this.g.fx; }
  get lvl() { return this.g.level; }
  liteFx() { return this.lite || (this.lite = new FXLite(this.g.scene)); }
  bind(level) {
    this.unbind();
    const on = (t, f) => this.offs.push(level.on(t, f));
    this.offs = [];
    on('damage', ev => this.onDamage(ev));
    on('heal', ev => { if (this.isLocal(ev.tgt) || this.isLocal(ev.src)) this.num(ev.tgt, ev.amount, 'heal'); });
    on('shield', ev => { if (this.isLocal(ev.tgt)) this.num(ev.tgt, ev.amount, 'shield'); });
    on('fx', ev => this.onFx(ev));
    on('sfx', ev => this.sfx(ev.name, ev.pos || ev.unit?.pos));
    on('shake', ev => { if (this.near(ev.unit, 18)) this.g.cam.shake(ev.v * (this.isLocal(ev.unit) ? 1 : 0.5)); });
    on('telegraph', tg => this.onTelegraph(tg));
    on('telegraphEnd', tg => { const h = this.telegraphFx.get(tg); h?.stop?.(); this.telegraphFx.delete(tg); });
    on('projectile', p => this.onProjectile(p));
    on('projectileEnd', p => { const h = this.projFx.get(p); h?.stop?.(); this.projFx.delete(p); if (p.kind !== 'grenade') this.call('hit', { pos: _pos(p), dir: { x: p.dx, z: p.dz }, element: p.hit?.elem }); });
    on('zone', z => this.onZone(z));
    on('zoneEnd', z => { const h = this.zoneFx.get(z); h?.stop?.(); this.zoneFx.delete(z); });
    on('death', ({ unit }) => this.onDeath(unit));
    on('counter', ({ src, tgt }) => { this.call('play', 'counter_hit', { pos: tgt.pos, x: tgt.pos.x, z: tgt.pos.z }); this.sfx('counter', tgt.pos); if (this.isLocal(src)) this.g.ui?.banner?.('COUNTER!', { kind: 'counter' }); this.g.cam.shake(0.3); });
    on('staggerBreak', ({ tgt }) => { this.call('play', 'stagger_break', { pos: tgt.pos, x: tgt.pos.x, z: tgt.pos.z, r: tgt.radius * 2 }); this.sfx('stagger_break', tgt.pos); this.g.ui?.banner?.('STAGGER BREAK', { kind: 'stagger' }); this.g.cam.shake(0.45); });
    on('partBreak', ({ tgt }) => { this.call('play', 'part_break', { pos: tgt.pos, x: tgt.pos.x, z: tgt.pos.z }); this.sfx('part_break', tgt.pos); this.g.ui?.banner?.('PART DESTROYED', { kind: 'stagger' }); });
    on('perfect', ({ unit }) => { if (this.isLocal(unit)) { this.num(unit, 'PERFECT', 'crit'); this.sfx('crit', unit.pos); } });
    on('awaken', ({ unit }) => { if (this.near(unit, 30)) { this.g.renderer.fx.flash = 0.12; this.g.renderer.fx.radial = 0.6; } });
    on('dash', ({ unit }) => { if (this.isLocal(unit)) this.g.renderer.fx.radial = Math.max(this.g.renderer.fx.radial, 0.25); });
    on('denied', ({ unit, why }) => { if (this.isLocal(unit)) { this.sfx('ui_error'); this.g.ui?.toast?.({ cooldown: 'Skill is on cooldown.', mana: 'Not enough mana.', identity: 'Identity gauge is not full.', awakening: 'No awakening uses left.' }[why] || 'Not ready.', 'error'); } });
    on('knock', ({ tgt, knock }) => { if (this.isLocal(tgt) && (knock === 'down' || knock === 'up')) { this.g.cam.shake(0.25); this.g.renderer.fx.hurt = Math.max(this.g.renderer.fx.hurt, 0.25); } });
    on('identityOrb', ({ unit }) => { if (this.isLocal(unit)) this.sfx('identity_ready'); });
  }
  unbind() { for (const f of this.offs || []) f(); this.offs = []; }
  isLocal(u) { return u && u === this.g.hero?.u; }
  near(u, r) { const h = this.g.hero?.u; if (!u || !h) return true; return Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) < r; }
  call(fn, ...a) {
    const fx = this.fx;
    try { const h = fx?.[fn]?.(...a); if (h !== undefined && h !== null) return h; } catch (e) { if (!this._warned?.[fn]) { (this._warned ||= {})[fn] = 1; console.warn('[fx]', fn, e); } }
    const lite = this.liteFx(); return lite[fn]?.(...a);
  }
  sfx(name, pos, o = {}) {
    const a = this.g.audio; if (!a || !name) return;
    const now = performance.now(), last = this.lastSfx.get(name) || 0;
    if (now - last < (o.gap ?? 40)) return;
    this.lastSfx.set(name, now);
    try { a.sfx(name, { pos, vol: o.vol, pitch: o.pitch }); } catch { /* audio not ready */ }
  }
  num(u, v, style, scale) { this.call('number', { x: u.pos.x, y: u.pos.y + u.height * 0.9, z: u.pos.z }, v, { style, scale }); }
  onDamage(ev) {
    const { src, tgt } = ev;
    if (ev.immune) { if (this.isLocal(src)) this.num(tgt, 'IMMUNE', 'miss'); return; }
    const local = this.isLocal(src), victim = this.isLocal(tgt);
    if (local || victim || (src && src.team === 0 && this.g.showAllNumbers)) {
      let style = ev.dot ? 'dot' : 'normal';
      const boss = tgt.kind === 'boss' || tgt.data.elite;
      if (local && boss && ev.back) style = 'back';
      if (local && boss && ev.head) style = 'head';
      if (ev.counter) style = 'counter';
      if (victim) style = 'hurt';
      this.call('number', { x: tgt.pos.x, y: tgt.pos.y + tgt.height * 0.9, z: tgt.pos.z }, ev.amount, { style, crit: ev.crit && !victim, scale: ev.kind === 'awaken' ? 1.5 : ev.kind === 'identity' ? 1.25 : 1 });
    }
    if (!ev.dot && (local || victim || this.near(tgt, 14))) {
      _v.set(tgt.pos.x, tgt.pos.y + tgt.height * 0.55, tgt.pos.z);
      const dir = src ? { x: tgt.pos.x - src.pos.x, z: tgt.pos.z - src.pos.z } : { x: 0, z: 1 };
      this.call('hit', { pos: _v.clone(), dir, crit: ev.crit, element: ev.elem || 'phys' });
      if (local) this.sfx(ev.crit ? 'crit' : (src.cls === 'pistoleer' ? 'impact' : 'impact'), tgt.pos, { gap: 30 });
      if (victim) { this.sfx('impact_heavy', tgt.pos); this.g.renderer.fx.hurt = Math.max(this.g.renderer.fx.hurt, Math.min(0.5, ev.amount / tgt.hpMax * 2)); }
    }
  }
  onDeath(u) {
    this.call('death', { pos: u.pos.clone(), kind: u.tags?.has?.('demon') || /imp|hound|legion|brute|abyss|garg/.test(u.type || '') ? 'demon' : 'beast', color: 'dark' });
    this.sfx(u.kind === 'boss' ? 'boss_roar_big' : /imp|hound|legion|brute|abyss/.test(u.type || '') ? 'demon_die' : 'monster_die', u.pos, { gap: 60 });
    if (u.kind === 'boss') this.g.cam.shake(0.6);
  }
  onFx(ev) {
    const p = ev.ev || {}, u = ev.unit;
    const pos = { x: ev.x, y: (u?.pos.y || 0), z: ev.z };
    const dir = { x: ev.dx ?? u?.fx ?? 0, z: ev.dz ?? u?.fz ?? -1 };
    const scale = p.scale || 1;
    const color = p.color || ev.color;
    const r = (p.r || ev.r || 3) * scale;
    const name = ev.preset;
    switch (name) {
      case 'slash': return this.call('slash', { pos: { x: pos.x, y: pos.y + (p.vertical ? 1.2 : 1.0), z: pos.z }, dir, radius: r, arc: p.arc || 140, color, width: p.big ? 1.6 : 1, dur: p.big ? 0.32 : 0.22, style: p.vertical ? 'vertical' : p.spin ? 'spin' : 'sword', flip: p.flip });
      case 'shockwave': return this.call('shockwave', { pos, radius: r, color, dur: 0.45 });
      case 'burst': return this.call('burst', { pos, color, count: 24, speed: 6, size: 0.3, life: 0.5, kind: 'spark' });
      default: {
        const h = this.fx?.play ? safe(() => this.fx.play(name, { pos, dir, r, radius: r, len: (p.len || 0) * scale, width: p.width, color, x: pos.x, z: pos.z, dur: p.dur, follow: p.follow ? u?.model?.root : null, unit: u?.model?.root, big: p.big })) : null;
        if (h) return h;
        return this.liteFx().play(name, { pos, dir, r, color, x: pos.x, z: pos.z });
      }
    }
  }
  onTelegraph(tg) {
    const shape = tg.shape === 'line' ? 'rect' : tg.shape;
    const h = this.call('telegraph', { shape, pos: { x: tg.x, y: this.g.level.heightAt(tg.x, tg.z), z: tg.z }, dir: { x: tg.dx || 0, z: tg.dz ?? -1 }, radius: tg.r, inner: tg.inner, angle: tg.angle, width: tg.width, length: tg.len, color: tg.color || 'red', dur: tg.dur, follow: tg.follow });
    if (h) this.telegraphFx.set(tg, h);
  }
  onProjectile(p) {
    const h = this.call('projectile', { from: { x: p.x, y: p.y, z: p.z }, dir: { x: p.dx, y: 0, z: p.dz }, speed: p.speed, kind: p.kind || 'bolt', color: p.color || 'orange', size: p.radius, range: p.range, arc: p.arc });
    if (h) this.projFx.set(p, h);
  }
  onZone(z) {
    const h = this.fx?.play ? safe(() => this.fx.play(`zone_${z.kind || 'generic'}`, { pos: { x: z.x, y: 0, z: z.z }, r: z.r, radius: z.r, dur: z.dur, color: z.color, x: z.x, z: z.z })) : null;
    if (h) { this.zoneFx.set(z, h); return; }
    const d = this.call('decal', { pos: { x: z.x, y: 0, z: z.z }, radius: z.r, kind: z.kind || 'rune', dur: z.dur });
    if (d) this.zoneFx.set(z, d);
  }
  update(dt) {
    for (const [p, h] of this.projFx) { if (h?.pos?.set) h.pos.set(p.x, p.y, p.z); if (h?.setPos) h.setPos(p.x, p.y, p.z); }
    for (const [z, h] of this.zoneFx) { if (z.follow && h?.pos?.set) h.pos.set(z.x, 0, z.z); }
    const rf = this.g.renderer.fx;
    rf.hurt = Math.max(0, rf.hurt - dt * 1.5); rf.flash = Math.max(0, rf.flash - dt * 2); rf.radial = Math.max(0, rf.radial - dt * 2.5); rf.aberration = Math.max(0, rf.aberration - dt * 3);
    this.lite?.update(dt, 0, this.g.cam.cam);
  }
}
function safe(f) { try { return f(); } catch (e) { console.warn('[fx play]', e); return null; } }
function _pos(p) { return { x: p.x, y: p.y, z: p.z }; }
