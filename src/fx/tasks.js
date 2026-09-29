// Timed composite effects. A Task runs a recipe { dur, fade, init(T), tick(T, dt), stop(T), end(T) } over time.
// Tasks are pooled; callers get a Handle whose methods are no-ops once the task has finished (generation check), so a
// stale handle can never stop an unrelated effect.
//   T.p       params (the object passed to play / the primitive)
//   T.pos     live position (follows T.attach — an Object3D — when given, plus T.offset in its local space);
//             T.place(x, y, z) pins it at a world point and drops attach/follow
//   T.dir     unit horizontal forward, T.right = its right vector
//   T.age     seconds since start, T.dur, T.u = age / dur
//   T.rate(key, perSecond) → how many to emit this frame (fractional accumulation, quality-scaled)
//   T.once(key, t) → true exactly once when age passes t
//   T.stopping (after stop()), T.k (fade 1 → 0 while stopping)
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Task {
  constructor(fx) {
    this.fx = fx;
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1); this.right = new THREE.Vector3(1, 0, 0);
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.c = new THREE.Vector3();   // recipe scratch
    this.acc = Object.create(null); this.flags = Object.create(null);
    this.gen = 0; this.alive = false; this.dim = 1;
    this.slots = [];      // [layer, slot] pairs to release on end (ground layers etc.)
    this.handles = [];    // child handles stopped on stop()
  }
  init(recipe, p) {
    this.recipe = recipe; this.p = p;
    this.gen++; this.alive = true; this.stopping = false; this.k = 1; this.fadeT = recipe.fade ?? 0.3;
    this.age = 0; this.dt = 0;
    this.dur = p.dur ?? recipe.dur ?? Infinity;
    const att = p.attach ?? p.follow;
    this.attach = att?.isObject3D ? att : null;
    this.follow = !this.attach && att && typeof att === 'object' && (att.pos || att.x !== undefined) ? att : null;
    this.offset = p.offset ? new THREE.Vector3().copy(p.offset) : null;
    for (const k in this.acc) this.acc[k] = 0;
    for (const k in this.flags) this.flags[k] = 0;
    this.slots.length = 0; this.handles.length = 0;
    this.v = {};           // recipe-owned state
    this.anchor = -1; this.held = null; this.dim = 1;
    return this;
  }
  get u() { return isFinite(this.dur) ? Math.min(1, this.age / this.dur) : 0; }
  /** pin the effect at a world point and stop following (a spell cast at a target while the caster is attached) */
  place(x, y, z) { this.attach = null; this.follow = null; this.offset = null; this.pos.set(x, y, z); this.prev.copy(this.pos); return this; }
  readPos(out) {
    if (this.attach) {
      if (this.offset) { out.copy(this.offset); this.attach.localToWorld(out); }
      else this.attach.getWorldPosition(out);
    }
    return out;
  }
  rate(key, perSec) {
    const n0 = (this.acc[key] || 0) + perSec * this.dt * this.fx.q * this.k * this.dim;
    const n = Math.floor(n0); this.acc[key] = n0 - n;
    return n > 300 ? 300 : n;
  }
  once(key, t) { if (this.age >= t && !this.flags[key]) { this.flags[key] = 1; return true; } return false; }
  // anchor: a GPU-side follow point for held particles / particles spawned in local space
  useAnchor() {
    if (this.anchor < 0) { this.anchor = this.fx.anchors.alloc(this.fx.time); if (this.anchor >= 0) this.fx.anchors.set(this.anchor, this.pos.x, this.pos.y, this.pos.z, 1); }
    return this.anchor;
  }
  hold(pr, x, y, z, o) {           // looping particle owned by the task, following its anchor
    const a = this.useAnchor();
    const ps = this.fx.ps, pool = ps.pools[pr.pool];
    const oo = o || {};
    oo.held = true; oo.anchor = a;
    const slot = ps.spawn(pr, x, y, z, oo.vx ?? 0, oo.vy ?? 0, oo.vz ?? 0, oo);
    if (slot >= 0) (this.held || (this.held = [])).push(pool, slot);
    return slot;
  }
  own(layer, slot) { if (slot >= 0) this.slots.push(layer, slot); return slot; }
  child(h) { if (h) this.handles.push(h); return h; }
  stop(fade) {
    if (!this.alive || this.stopping) return;
    this.stopping = true;
    if (fade != null) this.fadeT = fade;
    const fx = this.fx, pd = fx.dimK; fx.dimK = this.dim;
    for (let i = 0; i < this.handles.length; i++) this.handles[i].stop?.();
    try { this.recipe.stop?.(this); } catch (e) { console.error('[fx] stop', e); }
    fx.dimK = pd;
  }
  update(dt) {
    this.dt = dt; this.age += dt;
    if (this.attach) {
      if (!this.attach.parent && !this.attach.isScene && this.age > 0.05) this.stop(0.15);
      this.prev.copy(this.pos); this.readPos(this.pos);
    } else if (this.follow) {
      const f = this.follow.pos || this.follow;
      if (f.x !== this.pos.x || f.z !== this.pos.z) { this.prev.copy(this.pos); this.pos.x = f.x; this.pos.z = f.z; if (f.y !== undefined) this.pos.y = f.y; this.recipe.moved?.(this); }
    }
    if (this.stopping) { this.k -= dt / Math.max(this.fadeT, 1e-3); if (this.k <= 0) { this.end(); return false; } }
    const fx = this.fx;
    fx.ps.tint = this.tint || null;
    try { this.recipe.tick?.(this, dt); } catch (e) { console.error('[fx] tick', this.recipe.name, e); this.end(); fx.ps.tint = null; return false; }
    fx.ps.tint = null;
    if (this.anchor >= 0) fx.anchors.set(this.anchor, this.pos.x, this.pos.y, this.pos.z, this.k);
    if (!this.stopping && this.age >= this.dur) this.stop();
    return this.alive;
  }
  end() {
    if (!this.alive) return;
    this.alive = false;
    const fx = this.fx, pd = fx.dimK; fx.dimK = this.dim;
    try { this.recipe.end?.(this); } catch (e) { console.error('[fx] end', e); }
    fx.dimK = pd;
    for (let i = 0; i < this.handles.length; i++) this.handles[i].stop?.(0.1);
    if (this.held) { for (let i = 0; i < this.held.length; i += 2) this.held[i].killHeld(this.held[i + 1]); this.held.length = 0; }
    for (let i = 0; i < this.slots.length; i += 2) this.slots[i].release(this.slots[i + 1]);
    this.slots.length = 0;
    if (this.anchor >= 0) { this.fx.anchors.free(this.anchor); this.anchor = -1; }
    this.gen++;
  }
}

/** What callers hold. Safe after the effect ends (methods become no-ops, alive = false). */
export class Handle {
  constructor(task) { this.t = task; this.g = task.gen; }
  get alive() { return this.t.gen === this.g && this.t.alive; }
  get pos() { return this.t.pos; }
  get dir() { return this.t.dir; }
  stop(fade) { if (this.alive) this.t.stop(fade); return this; }
  /** setPos(Vector3 | {x,y,z} | [x,y,z]) or setPos(x, y, z) */
  setPos(p, y, z) {
    if (!this.alive) return this;
    const P = this.t.pos;
    if (typeof p === 'number') P.set(p, y ?? P.y, z ?? P.z);
    else if (p?.isVector3) P.copy(p);
    else if (Array.isArray(p)) P.set(p[0], p[1], p[2]);
    else if (p) P.set(p.x ?? P.x, p.y ?? P.y, p.z ?? P.z);
    this._cb('moved');
    return this;
  }
  setDir(d) { if (this.alive) { this.t.fx._dir(d, this.t.dir); this.t.right.set(-this.t.dir.z, 0, this.t.dir.x); this._cb('moved'); } return this; }
  setFill(v) { if (this.alive) this._cb('setFill', v); return this; }
  detonate() { if (this.alive) this._cb('detonate'); return this; }
  set(k, v) { if (this.alive) { this.t.p[k] = v; this._cb('set', k, v); } return this; }
  _cb(name, a, b) {
    const T = this.t, fn = T.recipe[name]; if (!fn) return;
    const fx = T.fx, pd = fx.dimK; fx.dimK = T.dim;
    try { fn(T, a, b); } finally { fx.dimK = pd; }
  }
}
export const NOOP = Object.freeze({ alive: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), stop() { return this; }, setPos() { return this; }, setDir() { return this; }, setFill() { return this; }, detonate() { return this; }, set() { return this; } });
void _v;
