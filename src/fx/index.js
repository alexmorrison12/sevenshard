// SEVENSHARD FX — every skill, impact, telegraph, number and ambient effect in the game. See fx/README.md.
//
//   const fx = new FX(scene, { quality, heightAt })
//   fx.update(dt, t, camera)                        once per frame, after the game moved its objects
//   fx.play(preset, params) → handle                named composite effects (fx.PRESETS lists them)
//   primitives: slash · burst · shockwave · projectile · beam · lightning · meteor · decal · aura · trail · telegraph
//               number · hit · death · portal · lootBeam · pickup · counterWindow · weather
//
// Architecture: GPU-analytic particles (2 draw calls), instanced slash arcs (1), instanced ground telegraphs (1) and
// decals (1), shockwave rings/walls (2), one batched ribbon mesh for trails/beams/lightning (1), instanced debris /
// crystals / bubbles / pillars / portals (5), CPU-posed props (≤7), damage-number glyphs (1). Everything is pooled;
// the per-frame path allocates nothing.
import * as THREE from 'three';
import { G } from '../engine/materials.js';
import { buildTextures } from './textures.js';
import { Particles, Anchors } from './particles.js';
import { Ground } from './ground.js';
import { Slashes } from './slash.js';
import { Rings } from './rings.js';
import { Ribbons } from './ribbons.js';
import { Meshes } from './meshes.js';
import { Numbers } from './numbers.js';
import { Task, Handle, NOOP } from './tasks.js';
import { col, v3, dirOf, dir3, hasCol } from './util.js';
import * as prims from './prims.js';
import { PRESETS } from './presets/index.js';

export { PRESETS };
export { TELE, GRADES, ELEM, PAL } from './util.js';

const DENSITY = { low: 0.45, medium: 0.75, high: 1, ultra: 1.25 };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
const _ray = new THREE.Ray(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class FX {
  constructor(scene, { quality = 'high', heightAt = null, camera = null } = {}) {
    const t0 = performance.now();
    this.scene = scene; this.camera = camera; this.quality = quality;
    this.q = DENSITY[quality] ?? 1;
    this.heightAt = heightAt;
    this.time = 0;
    this.camPos = new THREE.Vector3(0, 20, 20);
    this.focus = new THREE.Vector3();
    this.tex = buildTextures();
    this.anchors = new Anchors(1024);
    this.u = {
      uFxTime: { value: 0 }, uRamp: { value: this.tex.ramps }, uRampRows: { value: this.tex.rampRows },
      uAnchors: { value: this.anchors.tex }, uAtlas: { value: this.tex.atlas }, uLight: { value: new THREE.Color(1, 1, 1) },
      uFocus: { value: this.focus }, uWrapBox: { value: new THREE.Vector3(44, 18, 40) },
      uHeightTex: { value: G.uHeightTex.value }, uHeightInfo: { value: new THREE.Vector4().copy(G.uHeightInfo.value) },
      uHasHeight: { value: G.uHeightTex.value ? 1 : 0 }, uGroundY: { value: 0 }, uAspect: { value: 16 / 9 }, uDesat: G.uDesat,
    };
    this.group = new THREE.Group(); this.group.name = 'fx';
    const low = quality === 'low';
    this.ps = new Particles(this, low ? { ring: 12288, ringAlpha: 6144, held: 2048, heldAlpha: 1536 } : { ring: 28672, ringAlpha: 12288, held: 4096, heldAlpha: 2560 });
    this.ground = new Ground(this);
    this.slashes = new Slashes(this);
    this.rings = new Rings(this);
    this.ribbons = new Ribbons(this);
    this.meshes = new Meshes(this);
    this.numbers = new Numbers(this);
    for (const m of [...this.ground.meshes, ...this.rings.meshes, ...this.ps.meshes, this.slashes.mesh, this.ribbons.mesh, ...this.meshes.meshes, this.numbers.mesh]) this.group.add(m);
    scene.add(this.group);
    this.tasks = []; this.taskPool = [];
    // screen-space feedback the game applies to its camera / renderer (see applyScreen)
    this.screen = { shake: 0, flash: 0, flashCol: new THREE.Color(1, 0.9, 0.7), radial: 0, radialX: 0.5, radialY: 0.5, aberration: 0 };
    this.onShake = null;      // (amount 0..1, pos) — called immediately on big impacts
    this.lights = null; this._lightT = 0;
    this._o = {};
    this.initMs = performance.now() - t0;
  }

  // ================================================================== frame
  update(dt, t, camera) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.time += dt;
    this.u.uFxTime.value = this.time;
    if (camera) this.camera = camera;
    const cam = this.camera;
    if (cam) {
      cam.getWorldPosition(this.camPos);
      if (cam.aspect) this.u.uAspect.value = cam.aspect;
      // weather / ambient focus = where the camera looks on the ground plane
      cam.getWorldDirection(_v);
      _ray.set(this.camPos, _v); _plane.constant = -this.u.uGroundY.value;
      if (!_ray.intersectPlane(_plane, this.focus)) this.focus.set(this.camPos.x, this.u.uGroundY.value, this.camPos.z - 10);
    }
    const ht = G.uHeightTex.value;
    this.u.uHeightTex.value = ht; this.u.uHasHeight.value = ht ? 1 : 0;
    if (ht) this.u.uHeightInfo.value.copy(G.uHeightInfo.value);
    this.updateLight(dt);
    const T = this.tasks;
    let w = 0;
    for (let i = 0; i < T.length; i++) {
      const task = T[i];
      if (task.update(dt)) T[w++] = task; else this.taskPool.push(task);
    }
    T.length = w;
    this.ribbons.update(dt);
    this.meshes.update(dt);
    this.slashes.update();
    this.rings.update();
    this.ground.update(dt);
    this.numbers.update();
    this.ps.flush();
    this.anchors.flush();
    const s = this.screen, k = Math.exp(-dt * 7);
    s.shake = Math.max(0, s.shake - dt * 1.6); s.flash *= Math.exp(-dt * 14); s.radial *= Math.exp(-dt * 5); s.aberration *= k;
  }
  /** Convenience: push this frame's screen feedback into an IsoCam + Renderer (takes the max with their own values). */
  applyScreen(renderer, isoCam) {
    const s = this.screen;
    if (renderer?.fx) {
      const f = renderer.fx;
      f.flash = Math.max(f.flash * 0.5, s.flash); f.aberration = Math.max(f.aberration * 0.5, s.aberration); f.radial = Math.max(f.radial * 0.5, s.radial);
      if (renderer.F?.uFlashCol) renderer.F.uFlashCol.value.set(s.flashCol.r, s.flashCol.g, s.flashCol.b);
      if (renderer.F?.uRadialCenter) renderer.F.uRadialCenter.value.set(s.radialX, s.radialY);
    }
    if (isoCam && s.shakeQueued) { isoCam.shake(s.shakeQueued); s.shakeQueued = 0; }
  }
  updateLight(dt) {
    if (this.lights === false) return;
    this._lightT -= dt;
    if (this._lightT > 0 && this.lights) return;
    this._lightT = 0.5;
    if (!this.lights) {
      let hemi = null, sun = null;
      this.scene.traverse(o => { if (o.isHemisphereLight && !hemi) hemi = o; if (o.isDirectionalLight && !sun) sun = o; });
      if (!hemi && !sun) return;
      this.lights = { hemi, sun };
    }
    const { hemi, sun } = this.lights, c = this.u.uLight.value;
    c.setRGB(0, 0, 0);
    if (hemi) c.r += hemi.color.r * hemi.intensity, c.g += hemi.color.g * hemi.intensity, c.b += hemi.color.b * hemi.intensity;
    if (sun) c.r += sun.color.r * sun.intensity * 0.3, c.g += sun.color.g * sun.intensity * 0.3, c.b += sun.color.b * sun.intensity * 0.3;
    c.multiplyScalar(1 / 2.1);
    c.r = Math.min(Math.max(c.r, 0.12), 1.15); c.g = Math.min(Math.max(c.g, 0.12), 1.15); c.b = Math.min(Math.max(c.b, 0.14), 1.15);
  }
  /** Override the light multiplier for alpha-blended particles (smoke, dust); otherwise follows the scene lights. */
  setLight(color) { this.u.uLight.value.set(color); this.lights = false; }
  /** Ground height function (x, z) → y for ground placement when there is no terrain height texture. */
  setHeight(fn, groundY = 0) { this.heightAt = fn; this.u.uGroundY.value = groundY; }

  // ================================================================== public primitives
  /** Mesh slash arc. { pos (feet or pivot), dir, radius, arc (rad), color, width, dur, style, height, tilt, cw, speed, intensity, glow, sparks } */
  slash(p = {}) { prims.slash(this, p); return NOOP; }
  /** Particle explosion. { pos, color, count, speed, size, life, kind, dir, spread, up, flash } */
  burst(p = {}) { prims.burst(this, p); return NOOP; }
  /** Expanding shockwave. { pos, radius, color, dur, width, wall, height, dust, delay } */
  shockwave(p = {}) { prims.shockwave(this, p); return NOOP; }
  /** { from, dir | to, speed, kind, color, size, range, arc, homing, onHit, impact, delay } → handle (.pos, .stop()) */
  projectile(p = {}) { return this.task(prims.PROJECTILE, p); }
  /** { from, to, color, width, dur, kind: 'glow'|'energy'|'holy'|'helix'|'wave'|'chain'|'tracer'|'lightning' } → handle */
  beam(p = {}) { return this.task(prims.BEAM, p); }
  /** Jagged branching bolt. { from, to, color, width, dur, strands, impact } → handle */
  lightning(p = {}) { return this.task(prims.BEAM, { ...p, kind: 'lightning' }); }
  /** { target, radius, color, delay, telegraph, from, scale, onHit } → handle */
  meteor(p = {}) { return this.task(prims.METEOR, p); }
  /** Ground decal. { pos, radius, kind, dur, color, dir, length, intensity } → handle */
  decal(p = {}) { return prims.decal(this, p); }
  /** Status / buff aura on an Object3D (feet origin). { attach, kind, color, scale, height, dur } → handle */
  aura(p = {}) { return this.task(prims.AURA, p); }
  /** Ribbon trail. { attach, tip (Object3D) | tipOffset (local Vector3), color, width, life, dur } → handle */
  trail(p = {}) { return this.task(prims.TRAIL, p); }
  /** Ground warning shape. See README. → handle (.stop() cancel, .setFill(v), .detonate()) */
  telegraph(p = {}) { return this.task(prims.TELEGRAPH, p); }
  /** Damage number. value: number | string. o: { style, scale, crit, tag } */
  number(pos, value, o = {}) { this.numbers.spawn(v3(pos, _v), value, o); }
  /** Impact spark/flash at a hit point. { pos, dir, crit, element, scale, back } */
  hit(p = {}) { prims.hit(this, p); return NOOP; }
  /** Death puff. { pos, kind: 'mob'|'demon'|'beast'|'boss'|'player'|'undead', color, scale } */
  death(p = {}) { return prims.death(this, p); }
  /** Swirling portal. { pos, color, dir, radius, flat } → handle */
  portal(p = {}) { return this.task(prims.PORTAL, p); }
  /** Loot beam by grade (0-7 or name). { pos, grade } → handle */
  lootBeam(p = {}) { return this.task(prims.LOOT, p); }
  /** Pickup sparkle. { pos, kind: 'gold'|'silver'|'item'|'hp'|'mp'|'seed'|'shard'|'xp', to } */
  pickup(p = {}) { prims.pickup(this, p); return NOOP; }
  /** Blue counter-window shimmer on a boss. { attach | pos, dur, height, scale } → handle */
  counterWindow(p = {}) { return this.task(prims.COUNTER, p); }
  /** Camera-following weather. kind: 'snow'|'ash'|'rain'|'embers'|'fireflies'|'dust'|'leaves'|'petals' → handle */
  weather(kind, p = {}) { return this.task(prims.WEATHER, { ...p, kind }); }
  /** Named composite effect (see fx.PRESETS / README). */
  play(name, p = {}) {
    const r = PRESETS[name];
    if (!r) { this.warnOnce('unknown preset ' + name); return null; }   // null → callers can fall back
    if (typeof r === 'function') { r(this, p); return NOOP; }
    return this.task(r, p);
  }
  get PRESETS() { return PRESETS; }
  has(name) { return !!PRESETS[name]; }

  // ================================================================== internals shared with prims / presets
  task(recipe, p) {
    const T = (this.taskPool.pop() || new Task(this)).init(recipe, p);
    if (p.pos !== undefined && !p.pos?.isObject3D) v3(p.pos, T.pos);
    else if (p.pos?.isObject3D) p.pos.getWorldPosition(T.pos);
    else if (p.from !== undefined) v3(p.from, T.pos);
    else if (p.target !== undefined) v3(p.target, T.pos);
    if (T.attach) T.readPos(T.pos);
    T.prev.copy(T.pos);
    this._dir(p.dir ?? p.facing, T.dir);
    T.right.set(-T.dir.z, 0, T.dir.x);
    T.tint = hasCol(p.color) ? col(p.color, 1, T.tintArr || (T.tintArr = [0, 0, 0])) : null;
    try { recipe.init?.(T); } catch (e) { console.error('[fx] init', recipe.name, e); T.end(); this.taskPool.push(T); return NOOP; }
    if (!T.alive) { this.taskPool.push(T); return NOOP; }
    this.tasks.push(T);
    return new Handle(T);
  }
  _dir(d, out) {
    if (d == null) return out.set(0, 0, -1);
    if (d.isObject3D) { d.getWorldQuaternion(_q); out.set(0, 0, -1).applyQuaternion(_q); out.y = 0; const l = Math.hypot(out.x, out.z) || 1; return out.set(out.x / l, 0, out.z / l); }
    return dirOf(d, out);
  }
  dir3(d, out) { return dir3(d, out); }
  gy(x, z, fallback) { return this.heightAt ? this.heightAt(x, z) : (fallback ?? this.u.uGroundY.value); }
  /** scratch spawn options (reset every call): fx.o(scale, tint) */
  o(scale = 1, tint = null) {
    const o = this._o;
    o.scale = scale; o.tint = tint; o.size = undefined; o.life = undefined; o.end = undefined; o.i = undefined; o.alpha = undefined;
    o.dt = 0; o.rot = undefined; o.spin = undefined; o.drag = undefined; o.stretch = undefined; o.anchor = -1; o.held = false; o.mirror = false; o.yaw = 0;
    return o;
  }
  spawn(pr, x, y, z, vx, vy, vz, o) { return this.ps.spawn(pr, x, y, z, vx, vy, vz, o); }
  n(count) { return Math.max(count > 0 ? 1 : 0, Math.round(count * this.q)); }
  r(a, b) { return a + (b - a) * Math.random(); }
  rdir(out, dir = null, ang = Math.PI) {
    const cosA = Math.cos(ang), z = cosA + (1 - cosA) * Math.random(), t = Math.random() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - z * z));
    out.set(s * Math.cos(t), s * Math.sin(t), z);
    if (dir) { _q.setFromUnitVectors(_z, dir); out.applyQuaternion(_q); }
    return out;
  }
  /** radial ring of particles on the ground plane: horizontal speed [a,b], vertical [ua,ub], spawn radius r0 */
  radial(pr, n, p, a, b, ua, ub, s = 1, tint = null, r0 = 0, y0 = 0, extra = null) {
    n = this.n(n);
    const o = this.o(s, tint); if (extra) Object.assign(o, extra);
    for (let i = 0; i < n; i++) {
      const ang = (i + Math.random()) / n * Math.PI * 2, sp = this.r(a, b) * s, c = Math.cos(ang), si = Math.sin(ang);
      this.ps.spawn(pr, p.x + c * r0 * s, p.y + y0 * s, p.z + si * r0 * s, c * sp, this.r(ua, ub) * s, si * sp, o);
    }
  }
  /** spherical burst, optionally within a cone of half-angle ang around dir */
  sphere(pr, n, p, a, b, s = 1, tint = null, dir = null, ang = Math.PI, r0 = 0, extra = null) {
    n = this.n(n);
    const o = this.o(s, tint); if (extra) Object.assign(o, extra);
    for (let i = 0; i < n; i++) {
      this.rdir(_v2, dir, ang);
      const sp = this.r(a, b) * s;
      this.ps.spawn(pr, p.x + _v2.x * r0 * s, p.y + _v2.y * r0 * s, p.z + _v2.z * r0 * s, _v2.x * sp, _v2.y * sp, _v2.z * sp, o);
    }
  }
  /** one particle at p (+ offset), no velocity */
  at(pr, p, s = 1, tint = null, extra = null, dx = 0, dy = 0, dz = 0) {
    const o = this.o(s, tint); if (extra) Object.assign(o, extra);
    return this.ps.spawn(pr, p.x + dx, p.y + dy, p.z + dz, 0, 0, 0, o);
  }
  shake(a, pos) {
    this.screen.shake = Math.min(1, Math.max(this.screen.shake, a));
    this.screen.shakeQueued = Math.min(1, (this.screen.shakeQueued || 0) + a);
    if (this.onShake) { try { this.onShake(a, pos); } catch (e) { /* ignore */ } }
  }
  flash(a, c = null) {       // brief full-screen flash (whitened colour, capped so the frame never washes out)
    const s = this.screen; s.flash = Math.min(0.35, Math.max(s.flash, a));
    if (c) { const k = col(c, 1, _tmpC), m = Math.max(k[0], k[1], k[2], 1e-3); s.flashCol.setRGB(0.55 + 0.45 * k[0] / m, 0.55 + 0.45 * k[1] / m, 0.55 + 0.45 * k[2] / m); } else s.flashCol.setRGB(1, 0.92, 0.75);
  }
  radialBlur(a, pos) {
    const s = this.screen; s.radial = Math.min(1, Math.max(s.radial, a));
    if (pos && this.camera) { _v.copy(pos).project(this.camera); s.radialX = _v.x * 0.5 + 0.5; s.radialY = _v.y * 0.5 + 0.5; } else { s.radialX = 0.5; s.radialY = 0.5; }
  }
  aberr(a) { this.screen.aberration = Math.min(1, Math.max(this.screen.aberration, a)); }
  warnOnce(msg) { if (!_warned.has(msg)) { _warned.add(msg); console.warn('[fx] ' + msg); } }

  // ================================================================== bookkeeping
  stats() {
    return {
      tasks: this.tasks.length, particles: this.ps.alive(), anchors: this.anchors.count(), ribbons: this.ribbons.count(),
      telegraphs: this.ground.tele.count(), decals: this.ground.decal.count(), numbersSpawned: this.numbers.count, initMs: +this.initMs.toFixed(1),
      drawCalls: this.group.children.filter(m => m.visible).length,
    };
  }
  clear() { for (const t of this.tasks) t.end(); for (const t of this.tasks) this.taskPool.push(t); this.tasks.length = 0; }
  reset() {
    this.clear();
    this.ps.reset(); this.ground.reset(); this.slashes.reset(); this.rings.reset(); this.ribbons.reset(); this.meshes.reset(); this.numbers.reset(); this.anchors.reset();
  }
  dispose() {
    this.clear();
    this.ps.dispose(); this.ground.dispose(); this.slashes.dispose(); this.rings.dispose(); this.ribbons.dispose(); this.meshes.dispose(); this.numbers.dispose();
    this.anchors.tex.dispose();
    this.scene.remove(this.group);
  }
}
const _tmpC = [0, 0, 0];
const _warned = new Set();
export default FX;
