// In-engine cutscenes: letterboxed camera shots, subtitles, title cards, fades, actor moves & animations, FX, music.
// Every helper returns a promise; pressing Esc (or clicking "Skip") fast-forwards the script: waits resolve at once,
// camera cuts, walkers teleport — so state changes made by the script still happen, just instantly.
//
//   await Cutscene.play(session, async cs => {
//     cs.shot([x, y, z], [lx, ly, lz], 2);  await cs.say('seraphine', 'The Shards are singing.');
//     await cs.walk(unit, x, z);  cs.anim(unit, 'point');  await cs.fade(1, 0.8);
//   }, { music: 'cutscene_heroic', after: 'field' });
import * as THREE from 'three';
import { STORY_NPCS } from '../../data/quests/npcs.js';
import { makeResident, storyDef, walkable } from './spawn.js';

export const SKIP = Symbol('skip');
let active = null;
export const cutsceneActive = () => active;
/** true while a story fade has the screen (mostly) black */
export const screenDark = () => { const f = document.querySelector('.qs-cine .qs-fade'); return !!f && +f.style.opacity > 0.4; };

const CSS = `
.qs-cine{position:fixed;inset:0;pointer-events:none;z-index:45;font-family:"Segoe UI",Roboto,system-ui,sans-serif}
.qs-fade{position:absolute;inset:0;background:#000;opacity:0;transition:none}
.qs-sub{position:absolute;left:50%;bottom:13.8%;transform:translateX(-50%);width:min(980px,88vw);padding:10px 34px 12px;text-align:center;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center,rgba(4,4,8,.62) 0%,rgba(4,4,8,.42) 55%,rgba(4,4,8,0) 78%)}
.qs-sub.on{opacity:1}
.qs-sub b{display:block;font:600 13px/1.2 Georgia,"Times New Roman",serif;letter-spacing:.22em;text-transform:uppercase;color:#e9c46a;margin-bottom:6px;text-shadow:0 1px 3px #000}
.qs-sub span{display:inline;font:500 clamp(16px,1.35vw,22px)/1.45 Georgia,"Times New Roman",serif;color:#f6efdd;text-shadow:0 2px 4px #000,0 0 14px rgba(0,0,0,.85)}
.qs-title{position:absolute;left:0;right:0;top:36%;text-align:center;opacity:0;transition:opacity .9s}
.qs-title.on{opacity:1}
.qs-title i{display:block;font:500 clamp(12px,1vw,15px)/1 Georgia,serif;font-style:normal;letter-spacing:.5em;text-transform:uppercase;color:#d9b36a;margin-bottom:14px;text-shadow:0 2px 6px #000}
.qs-title b{display:block;font:400 clamp(34px,4.2vw,68px)/1.05 Georgia,"Times New Roman",serif;letter-spacing:.14em;text-transform:uppercase;color:#fbf3dc;text-shadow:0 3px 12px #000,0 0 40px rgba(255,190,90,.35)}
.qs-title s{display:block;width:min(420px,50vw);height:1px;margin:18px auto 0;background:linear-gradient(90deg,transparent,#e9c46a,transparent);text-decoration:none}
.qs-skip{position:absolute;right:28px;bottom:calc(6% + 8px);font:600 12px/1 "Segoe UI",Roboto,sans-serif;letter-spacing:.12em;color:rgba(240,232,210,.72);text-transform:uppercase;pointer-events:auto;cursor:pointer;padding:6px 10px;border:1px solid rgba(233,196,106,.35);background:rgba(8,10,18,.45);border-radius:2px}
.qs-skip:hover{color:#fff;border-color:#e9c46a}
`;
let styled = false;
function ui() {
  if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  let el = document.querySelector('.qs-cine');
  if (!el) {
    el = document.createElement('div'); el.className = 'qs-cine';
    el.innerHTML = '<div class="qs-fade"></div><div class="qs-title"><i></i><b></b><s></s></div><div class="qs-sub"><b></b><span></span></div><div class="qs-skip">Esc · Skip</div>';
    document.body.appendChild(el);
  }
  return { el, fade: el.querySelector('.qs-fade'), title: el.querySelector('.qs-title'), sub: el.querySelector('.qs-sub'), skip: el.querySelector('.qs-skip') };
}
/** a black screen fade that can outlive a cutscene (zone loads between scenes) */
export function screenFade(to, dur = 0.6) {
  const d = ui(); d.el.style.display = '';
  const f = d.fade, from = +getComputedStyle(f).opacity || 0, t0 = performance.now();
  return new Promise(res => {
    const step = () => { const k = Math.min(1, (performance.now() - t0) / (dur * 1000 || 1)); f.style.opacity = String(from + (to - from) * k * k * (3 - 2 * k)); if (k < 1) requestAnimationFrame(step); else res(); };
    step();
  });
}

export class Cutscene {
  /** play a script (async cs => {…}); opts: { music, after (music afterwards), keepHud, skippable = true, hideMobs = true, letterbox = true } */
  static async play(session, script, opts = {}) {
    if (active) { try { active.skip(); } catch { /* */ } }
    const cs = new Cutscene(session, opts);
    await cs.run(script);
    return cs;
  }
  constructor(session, o = {}) {
    this.s = session; this.g = session.game; this.o = o;
    this.skipping = false; this.t = 0; this.waits = []; this.movers = []; this.actors = []; this.frozen = []; this.tweens = [];
    this.d = ui();
  }
  get hero() { return this.g.hero?.u; }
  get L() { return this.g.level; }
  // ---------------------------------------------------------------- lifecycle
  async run(script) {
    this.begin();
    try { await script(this); } catch (e) { if (e !== SKIP) console.error('[cutscene]', e); }
    finally { await this.end(); }
  }
  begin() {
    active = this;
    const g = this.g, s = this.s, me = this.hero;
    this.prevHud = s.ui.hudVisible;
    if (!this.o.keepHud) s.ui.setHudVisible?.(false);
    g.inputBlocked = true;
    if (g.plates) { this.prevPlates = g.plates.enabled; g.plates.enabled = false; }
    g.player?.stop?.(); if (me) { me.move.x = me.move.z = 0; this.prevInvuln = me.invuln; me.invuln = 1e6; }
    if (this.o.hideMobs !== false && this.L) for (const u of this.L.units) if ((u.kind === 'mob' || u.kind === 'boss') && !u.dead && u.ctrl && !u.data.cineActor) { this.frozen.push([u, u.ctrl]); u.ctrl = null; u.move.x = u.move.z = 0; }
    if (this.o.letterbox !== false) this.tween(v => { g.renderer.fx.letterbox = v; }, g.renderer.fx.letterbox || 0, 1, 0.6);
    if (this.o.music) g.audio?.music?.(this.o.music);
    this.d.el.style.display = '';
    this.d.skip.style.display = this.o.skippable === false ? 'none' : '';
    this.d.skip.onclick = () => this.skip();
    this._key = e => {
      if (this.dialogOpen) return;               // let the NPC dialogue own the keyboard
      if (e.key === 'Escape' && this.o.skippable !== false) this.skip();
      else if ((e.key === ' ' || e.key === 'Enter') && this.lineWait) this.lineWait();
      e.stopImmediatePropagation(); e.preventDefault();
    };
    addEventListener('keydown', this._key, true);
    this._frame = dt => this.tick(dt);
    g.hooks.frame.push(this._frame);
  }
  async end() {
    const g = this.g, s = this.s, me = this.hero;
    removeEventListener('keydown', this._key, true);
    this.d.skip.onclick = null; this.d.skip.style.display = 'none';
    this.subtitle(null); this.titleCard(null);
    for (const w of this.waits) w.res(); this.waits.length = 0;
    for (const m of this.movers) { this.place(m.u, m.x, m.z); m.res(); } this.movers.length = 0;
    if (this.o.letterbox !== false) this.tween(v => { g.renderer.fx.letterbox = v; }, g.renderer.fx.letterbox || 1, 0, 0.5);
    g.cam.endCinematic?.(this.skipping ? 0.3 : 0.9); g.camFocus = null;
    for (const [u, c] of this.frozen) if (!u.dead && u.level) u.ctrl = c; this.frozen.length = 0;
    for (const u of this.actors) if (u.level) u.level.remove(u); this.actors.length = 0;
    if (me) me.invuln = Math.max(this.prevInvuln || 0, 0.8);
    if (!this.o.keepHud) s.ui.setHudVisible?.(this.prevHud !== false);
    if (g.plates) g.plates.enabled = this.prevPlates !== false;
    g.inputBlocked = false;
    if (this.o.after) g.audio?.music?.(this.o.after);
    if (+this.d.fade.style.opacity > 0.01 && !this.o.keepBlack) await screenFade(0, 0.7);
    // let the letterbox tween finish on its own
    const idx = g.hooks.frame.indexOf(this._frame);
    setTimeout(() => { const i = g.hooks.frame.indexOf(this._frame); if (i >= 0) g.hooks.frame.splice(i, 1); }, 800);
    if (idx < 0) { /* already removed */ }
    if (active === this) active = null;
  }
  skip() {
    if (this.skipping || this.o.skippable === false) return;
    this.skipping = true;
    for (const w of this.waits.splice(0)) w.res();
    for (const m of this.movers.splice(0)) { this.place(m.u, m.x, m.z); m.res(); }
    this.lineWait?.();
    this.subtitle(null);
  }
  tick(dt) {
    this.t += dt;
    for (let i = this.waits.length - 1; i >= 0; i--) if (this.t >= this.waits[i].at) { const w = this.waits[i]; this.waits.splice(i, 1); w.res(); }
    for (let i = this.tweens.length - 1; i >= 0; i--) { const tw = this.tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.set(tw.a + (tw.b - tw.a) * k * k * (3 - 2 * k)); if (k >= 1) this.tweens.splice(i, 1); }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i], u = m.u;
      if (!u.level || u.dead) { this.movers.splice(i, 1); m.res(); continue; }
      const dx = m.x - u.pos.x, dz = m.z - u.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.35 || (u.blocked && d < 1.5)) { u.move.x = u.move.z = 0; if (u === this.hero) this.g.player?.stop?.(); this.movers.splice(i, 1); m.res(); continue; }
      if (u !== this.hero) { const sp = Math.min(m.speed, d * 3 + 0.5); u.move.x = dx / d * sp; u.move.z = dz / d * sp; }
    }
  }
  tween(set, a, b, dur) { this.tweens.push({ set, a, b, dur: Math.max(0.01, dur), t: 0 }); set(a); }
  // ---------------------------------------------------------------- time
  wait(s) { if (this.skipping || s <= 0) return Promise.resolve(); return new Promise(res => this.waits.push({ at: this.t + s, res })); }
  // ---------------------------------------------------------------- camera
  /** fly the camera to pos looking at look over dur seconds (cuts when skipping) */
  shot(pos, look, dur = 1.5, fov) { this.g.cam.cinematic({ pos: v3(pos), look: v3(look), dur: this.skipping ? 0.01 : dur, fov }); return this; }
  /** frame a point from the iso angle but closer (height/dist in metres) */
  frame(p, { dist = 11, height = 7, side = 0, lookY = 1.2, dur = 1.5, fov } = {}) {
    const y = this.L?.heightAt?.(p.x, p.z) ?? 0;
    return this.shot([p.x + side, y + height, p.z + dist], [p.x, y + lookY, p.z], dur, fov);
  }
  /** follow a point with the gameplay camera (no cinematic) */
  focus(p) { this.g.camFocus = p ? new THREE.Vector3(p.x, this.L?.heightAt?.(p.x, p.z) ?? 0, p.z) : null; if (p && this.g.cam.cine) this.g.cam.endCinematic(this.skipping ? 0.01 : 1); return this; }
  release(dur = 1) { this.g.cam.endCinematic(this.skipping ? 0.01 : dur); this.g.camFocus = null; return this; }
  shake(v = 0.3) { if (!this.skipping) this.g.cam.shake(v); return this; }
  // ---------------------------------------------------------------- text
  subtitle(speaker, text) {
    const sub = this.d.sub;
    if (!speaker && !text) { sub.classList.remove('on'); return; }
    sub.querySelector('b').textContent = speaker || '';
    sub.querySelector('span').textContent = text || '';
    sub.classList.add('on');
  }
  /** a subtitle line; speaker: story npc id, 'hero', a name, or null (narration). Resolves after dur (or Space). */
  async say(speaker, text, dur) {
    if (this.skipping) return;
    const name = speaker === 'hero' ? (this.s.char?.name || 'You') : speakerName(speaker);
    this.subtitle(name, fill(text, this.s));
    await new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; this.lineWait = null; res(); }; this.lineWait = fin; this.waits.push({ at: this.t + (dur ?? Math.min(6, 1.4 + String(text).length * 0.045)), res: fin }); });
    this.subtitle(null);
    await this.wait(0.18);
  }
  titleCard(text, over = '') {
    const t = this.d.title;
    if (!text) { t.classList.remove('on'); return; }
    t.querySelector('i').textContent = over; t.querySelector('b').textContent = text; t.classList.add('on');
  }
  async title(text, over = '', hold = 2.6) { if (this.skipping) return; this.titleCard(text, over); await this.wait(hold); this.titleCard(null); await this.wait(0.6); }
  /** real NPC dialogue (click to advance, choices) inside a cutscene; resolves with the choice id */
  async talk(npc, lines) {
    if (this.skipping) return null;
    this.dialogOpen = true; this.subtitle(null);
    try { return await this.s.ui.dialog(npc, lines); } finally { this.dialogOpen = false; }
  }
  // ---------------------------------------------------------------- screen & sound
  fade(to, dur = 0.8) { if (this.skipping) { this.d.fade.style.opacity = String(to); return Promise.resolve(); } return screenFade(to, dur); }
  flash(v = 0.6) { if (!this.skipping) this.g.renderer.fx.flash = Math.max(this.g.renderer.fx.flash, v); return this; }
  music(track) { this.g.audio?.music?.(track); return this; }
  sfx(name, pos) { if (!this.skipping) try { this.g.audio?.sfx?.(name, { pos }); } catch { /* */ } return this; }
  stinger(name) { if (!this.skipping) try { this.g.audio?.stinger?.(name); } catch { /* */ } return this; }
  fx(name, p = {}) {
    if (this.skipping && !p.persist) return null;
    const pos = p.pos || (p.x != null ? { x: p.x, y: p.y ?? this.L?.heightAt?.(p.x, p.z) ?? 0, z: p.z } : undefined);
    try { return this.g.fx?.play?.(name, { ...p, pos }) || this.g.presenter?.call?.('play', name, { ...p, pos }) || null; } catch (e) { return null; }
  }
  // ---------------------------------------------------------------- actors
  /** spawn a temporary actor: a story npc id, a resident def, or a prebuilt Unit. Removed when the scene ends unless keep. */
  spawn(who, at, o = {}) {
    const L = this.L; if (!L) return null;
    let u = who;
    if (typeof who === 'string') { const d = storyDef(who); if (!d) return null; u = makeResident(d, at); }
    else if (!who.pos) u = makeResident(who, at);
    u.pos.x = at.x; u.pos.z = at.z; u.facing = at.facing ?? u.facing;
    u.data.cineActor = true; u.ctrl = null;
    L.add(u);
    if (!o.keep) this.actors.push(u);
    return u;
  }
  place(u, x, z) { if (!u) return; const p = walkable(this.L, x, z, 3); u.pos.x = p.x; u.pos.z = p.z; u.move.x = u.move.z = 0; if (u === this.hero) this.g.player?.stop?.(); }
  /** walk a unit to (x, z); the hero paths with the player controller, others steer directly */
  walk(u, x, z, speed = 3.2) {
    if (!u) return Promise.resolve();
    if (this.skipping) { this.place(u, x, z); return Promise.resolve(); }
    if (u === this.hero) this.g.player?.setDest?.(x, z, true);
    else if (u.ctrl) { this.frozen.push([u, u.ctrl]); u.ctrl = null; }
    return new Promise(res => this.movers.push({ u, x, z, speed, res }));
  }
  face(u, x, z) { if (u) { if (typeof x === 'object') { z = x.pos ? x.pos.z : x.z; x = x.pos ? x.pos.x : x.x; } u.faceTo(x, z); } return this; }
  anim(u, action, dur, loop = false) { if (u && !this.skipping) try { return u.model?.play?.(action, { dur, loop }); } catch { /* */ } return null; }
}

const v3 = a => a?.isVector3 ? a : Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : new THREE.Vector3(a.x, a.y ?? 0, a.z);
function speakerName(id) {
  if (!id) return '';
  const d = STORY_NPCS[id]; if (!d) return id;
  return d.short || d.name;
}
/** {name} / {class} placeholders in story text */
export function fill(text, s) {
  const c = s?.char;
  return String(text ?? '').replace(/\{name\}/g, c?.name || 'Shardbearer').replace(/\{class\}/g, CLASS_TITLES[c?.cls] || 'hero');
}
const CLASS_TITLES = { reaver: 'Reaver', oathkeeper: 'Oathkeeper', stormfist: 'Stormfist', pistoleer: 'Pistoleer', starcaller: 'Starcaller', songweaver: 'Songweaver', bladedancer: 'Bladedancer', demonbound: 'Demonbound' };
