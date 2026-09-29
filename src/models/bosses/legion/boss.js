// Legion boss runtime shared by every boss in this folder.
//
// A boss definition (gorrath.js, hounds.js, …) provides: meta (name, title, height, radius), scale (sculpt units →
// metres), rig(R), sculpt(S), paint(v, X), parts(acc, S, R, out) (rigid parts, weapons, capes), sockets, legs/gait,
// carriage(ctl, dt) (procedural locomotion/idle pose), actions (keyframes, see anim.js), springs, emitters, events.
//
// Geometry is built once per boss id (cached, < 600 ms) and shared by instances; each instance owns bones, pose,
// materials (shared GL programs) and particle pools. Everything is modelled in sculpt units; `pivot` scales to metres.
import * as THREE from 'three';
import { Rig, Pose, makeChain, clamp01, mix, TAU } from '../../kit/rig.js';
import { Sculpt } from '../../kit/sdf.js';
import { Gait } from '../../kit/gait.js';
import { BossAcc } from './acc.js';
import { bossMaterials } from './material.js';
import { Particles, PRESETS, Trail } from './fxlite.js';
import { compileAction, warp, sample, SpringChain, armIK, weaponQ } from './anim.js';
import { metaOf } from './meta.js';

const IDENT = new THREE.Matrix4();
const CACHE = new Map();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _s = new THREE.Vector3();
const PART_SLOT = ['x', 'y', 'z', 'w'];

// ------------------------------------------------------------------------------------------------ build (cached)
export function buildEntry(id, def) {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const t0 = performance.now();
  const rig = new Rig();
  def.rig(rig);
  const S = new Sculpt(rig);
  def.sculpt(S);
  const acc = new BossAcc();
  const X = acc.X;
  const mcfg = {
    h: def.h ?? 0.02, hg: def.hg, ao: def.ao ?? { dist: 0.04, str: 0.8 }, grad: def.grad ?? { top: 0.14, bottom: 0.3, y0: 0, y1: 0.6, low: 0.2 },
    dtl: def.dtl, smoothW: def.smoothW ?? 2,
    paint: (v) => { X[0] = X[1] = X[2] = X[3] = 0; if (def.paint) def.paint(v, X); },
  };
  const st = S.mesh(acc, mcfg);
  const tMesh = performance.now();
  const sdfVerts = acc.count;
  const extra = { weapons: {} };
  if (def.parts) def.parts(acc, S, rig, extra);
  const geo = acc.build();
  const weapons = {};
  for (const [name, w] of Object.entries(extra.weapons)) weapons[name] = { ...w, geo: w.acc.build() };
  const boneInverses = rig.bones.map(b => new THREE.Matrix4().makeTranslation(-b.rest.x, -b.rest.y, -b.rest.z));
  const actions = {};
  for (const [name, a] of Object.entries(def.actions)) actions[name] = compileAction(name, a, rig);
  let tris = geo.index.count / 3; for (const w of Object.values(weapons)) tris += w.geo.index.count / 3;
  const e = {
    id, def, rig, geo, weapons, boneInverses, actions,
    stats: { ms: +(performance.now() - t0).toFixed(1), sculptMs: +(tMesh - t0).toFixed(1), verts: geo.attributes.position.count, sdfVerts, tris, bones: rig.bones.length, groups: S.shape.groups.map(g => [g.g, g.nv]), partTris: (geo.index.count - S.shape.groups.reduce((a, g) => a + g.tris.length, 0)) / 3 },
  };
  CACHE.set(id, e);
  return e;
}
export function clearCache() { for (const e of CACHE.values()) { e.geo.dispose(); for (const w of Object.values(e.weapons)) w.geo.dispose(); } CACHE.clear(); }
export function cacheStats() { return [...CACHE.values()].map(e => ({ id: e.id, ...e.stats })); }

// ------------------------------------------------------------------------------------------------ debris (part breaks)
class Debris {
  constructor(geo, mat, cap = 24) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.matrixWorldAutoUpdate = false;
    this.mesh.castShadow = true; this.mesh.count = 0;
    this.items = [];
    this.cap = cap;
  }
  spawn(p, dir, n, scale, ground) {
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.cap) this.items.shift();
      const a = Math.random() * TAU;
      this.items.push({
        p: new THREE.Vector3(p.x + (Math.random() - 0.5) * scale, p.y + (Math.random() - 0.5) * scale, p.z + (Math.random() - 0.5) * scale),
        v: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 3) + dir.x * 4, 3 + Math.random() * 5, Math.sin(a) * (1 + Math.random() * 3) + dir.z * 4),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ws: 4 + Math.random() * 10,
        s: scale * (0.45 + Math.random() * 0.8), age: 0, ground,
      });
    }
  }
  update(dt) {
    if (!this.items.length) { this.mesh.count = 0; return; }
    let j = 0;
    for (const it of this.items) {
      it.age += dt;
      if (it.age > 7) continue;
      if (dt > 0) {
        it.v.y -= 16 * dt; it.p.addScaledVector(it.v, dt);
        const gy = it.ground + it.s * 0.25;
        if (it.p.y < gy) { it.p.y = gy; it.v.y *= -0.3; it.v.x *= 0.6; it.v.z *= 0.6; it.ws *= 0.5; }
        it.q.multiply(_q.setFromAxisAngle(it.w, it.ws * dt));
      }
      const fade = it.age > 5.5 ? 1 - (it.age - 5.5) / 1.5 : 1;
      _m.compose(it.p, it.q, _s.setScalar(it.s * Math.max(0.001, fade)));
      this.mesh.setMatrixAt(j++, _m);
      this.items[j - 1] = it;
    }
    this.items.length = j;
    this.mesh.count = j;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------ instance
export class Boss {
  constructor(id, entry, opts = {}) {
    const def = entry.def;
    this.id = id; this.def = def; this.entry = entry; this.opts = opts;
    this.S = def.scale;
    this.root = new THREE.Object3D(); this.root.name = 'boss:' + id;
    this.pivot = new THREE.Object3D(); this.pivot.name = 'pivot'; this.pivot.scale.setScalar(this.S); this.root.add(this.pivot);
    const rig = entry.rig;
    this.bones = rig.bones.map(b => { const bone = new THREE.Bone(); bone.name = b.name; bone.position.copy(b.rest); this.pivot.add(bone); return bone; });
    this.skeleton = new THREE.Skeleton(this.bones, entry.boneInverses);
    const M = this.mats = bossMaterials({ ...def.mat });
    this.U = M.U;
    this.mesh = new THREE.SkinnedMesh(entry.geo, M.body);
    this.mesh.bind(this.skeleton, IDENT);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.customDepthMaterial = M.depth; this.mesh.name = 'body';
    this.pivot.add(this.mesh);
    this.pre = new THREE.SkinnedMesh(entry.geo, M.prepass);
    this.pre.bind(this.skeleton, IDENT); this.pre.frustumCulled = false; this.pre.visible = false; this.pre.renderOrder = -1; this.pre.castShadow = false;
    this.pivot.add(this.pre);
    // rigid weapons (separate objects so they can be thrown / dropped)
    this.weapons = {};
    for (const [name, w] of Object.entries(entry.weapons)) {
      const m = new THREE.Mesh(w.geo, M.body);
      m.name = 'weapon:' + name; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.customDepthMaterial = M.depth;
      const bi = rig.index(w.bone);
      m.position.copy(rig.bones[bi].rest).negate();
      this.bones[bi].add(m);
      this.weapons[name] = { mesh: m, bone: bi, cfg: w, flight: null };
    }
    // sockets
    this.sockets = { parts: {} };
    const mk = (name, bone, pos, parent) => {
      const o = new THREE.Object3D(); o.name = 'socket:' + name;
      const bi = rig.index(bone);
      if (parent) { o.position.set(...pos); parent.add(o); }
      else { o.position.set(pos[0], pos[1], pos[2]).sub(rig.bones[bi].rest); this.bones[bi].add(o); }
      return o;
    };
    for (const [name, s] of Object.entries(def.sockets)) {
      const [bone, pos, wname] = s;
      const parent = wname ? this.weapons[wname]?.mesh : null;
      this.sockets[name] = mk(name, bone, pos, parent);
    }
    for (const [name, p] of Object.entries(def.breakable || {})) this.sockets.parts[name] = mk(name, p.bone, p.pos);
    for (const k of ['head', 'mouth', 'chest', 'handR', 'handL', 'weapon', 'weaponTip']) this.sockets[k] ||= this.sockets.chest || this.sockets.head;
    this.height = def.meta.height; this.radius = def.meta.radius;
    this.meta = entry.meta || (entry.meta = metaOf(id, def));   // BOSSES-style metadata (name, title, actions: {dur, hits…})
    // particles + debris (world space)
    this.fxAdd = new Particles(def.particles?.add ?? 700, { additive: true, soft: 1.5 });
    this.fxAlpha = new Particles(def.particles?.alpha ?? 260, { additive: false, soft: 1.2 });
    this.root.add(this.fxAdd.obj, this.fxAlpha.obj);
    // speed-driven weapon trails (def.trails: [{ weapon | bone, a:[x,y,z], b:[x,y,z], vMin, vMax, core, edge, life }])
    this.trails = (def.trails || []).map(t => {
      const tr = new Trail(t.n ?? 22, { core: t.core, edge: t.edge, life: t.life ?? 0.22 });
      this.root.add(tr.obj);
      return { cfg: t, tr, a: new THREE.Vector3(...t.a), b: new THREE.Vector3(...t.b), pa: new THREE.Vector3(), pb: new THREE.Vector3(), prev: new THREE.Vector3(), init: false };
    });
    if (def.debris) {
      this.debris = new Debris(def.debris.geo(), M.body, 28);
      this.root.add(this.debris.mesh);
    }
    this.pose = new Pose(rig);
    this.onEvent = null;
    this._initCtl();
    this.update(0, {});
  }

  // ---------------------------------------------------------------------------------------------- controller setup
  _initCtl() {
    const def = this.def, P = this.pose, rig = this.entry.rig;
    this.B = {};
    for (const [k, v] of Object.entries(def.bones)) this.B[k] = Array.isArray(v) ? v.map(n => rig.index(n)) : rig.index(v);
    this.gait = new Gait(P, def.gait);
    this.gait.onStep = (L) => this._step(L);
    this.acts = [];
    this.t = Math.random() * 50;
    this.speedSm = 0; this.turnSm = 0; this.run = 0; this.combat = 0; this.dead = false; this._sd = false;
    this.glowSet = { counter: 0, enrage: 0, ghost: 0 };
    this.glow = { counter: 0, enrage: 0, ghost: 0, charge: 0, body: 0, eyes: 1 };
    this.springs = (def.springs || []).map(c => new SpringChain(P, rig, c));
    this.chains = {};
    for (const side of ['R', 'L']) {
      const a = def.arms?.[side];
      if (a) this.chains[side] = { ch: makeChain(P, rig.index(a[0]), rig.index(a[1]), rig.index(a[2]), def.armPole?.[side]), hand: rig.index(a[2]) };
    }
    const W = def.weapon;
    if (W) {
      this.wpn = {
        grip: new THREE.Vector3(...W.grip), grip2: W.grip2 ? new THREE.Vector3(...W.grip2) : null,
        h0: new THREE.Vector3(...W.h0).normalize(), b0: new THREE.Vector3(...W.b0).normalize(),
        gripL: W.gripL ? new THREE.Vector3(...W.gripL) : null,
        hL0: W.hL0 ? new THREE.Vector3(...W.hL0).normalize() : null, bL0: W.bL0 ? new THREE.Vector3(...W.bL0).normalize() : null,
      };
    }
    // IK accumulators (base pose from carriage, then actions blend in)
    const ikState = () => ({ w: 0, p: new THREE.Vector3(), h: new THREE.Vector3(0, 1, 0), b: new THREE.Vector3(1, 0, 0), pole: new THREE.Vector3(1, -1, 1), hasAim: false, hasPole: false });
    this.ik = { R: ikState(), L: ikState(), grip: 0 };
    this.special = { hips: new THREE.Vector3(), air: 0, feet: {}, shake: 0, num: {} };
    this.pivotW = new THREE.Matrix4(); this.pivotWPrev = new THREE.Matrix4(); this._hasPrev = false; this.pivotQ = new THREE.Quaternion();
    this.delta = { m: new THREE.Matrix4(), q: new THREE.Quaternion() };
    this.emitAcc = (def.emitters || []).map(() => 0);
    this.state = {};
    this.lockLoco = 0;
  }

  // ---------------------------------------------------------------------------------------------- public API
  /** Play a one-shot action. opts: { dur } → { dur, hits } (hit moments in seconds, scaled with dur). */
  play(name, opts = {}) {
    const C = this.entry.actions[name];
    if (name === 'idle' || name === 'stand') { this.stop(); return { dur: C?.D ?? 0, hits: [] }; }
    if (!C) return { dur: 0, hits: [] };
    if (this.dead && name !== 'death') return { dur: 0, hits: [] };
    if (name === 'death') this.dead = true;
    const dur = Math.max(0.05, opts.dur ?? C.D);
    const W = warp(C, dur);
    for (const a of this.acts) if (!a.out) { a.out = true; a.outT = 0; a.w0 = a.w; a.fadeOut = Math.max(0.12, C.fadeIn * 1.2); }
    const a = { name, C, W, dur, t: 0, w: 0, out: false, outT: 0, w0: 0, fired: 0, S: new Map(), opts, sustainOn: !!opts.sustain, td: 0, done: false, seed: Math.random() };
    a.evReal = C.ev.map(e => W.toReal(e[0]));
    a.hitsReal = C.hits.map(h => W.toReal(h));
    a.hitFired = 0;
    if (C.sustain) a.sus = [W.toReal(C.sustain[0]), W.toReal(C.sustain[1])];
    this.acts.push(a);
    if (C.def.onStart) C.def.onStart(this, a);
    return { dur, hits: a.hitsReal.slice() };
  }
  stop(name) { for (const a of this.acts) if (!name || a.name === name) if (!a.out) { a.out = true; a.outT = 0; a.w0 = a.w; a.fadeOut = a.C.fadeOut; } }
  /** Is an action currently playing (not fading out)? */
  playing(name) { return this.acts.some(a => !a.out && (!name || a.name === name)); }
  setGlow(kind, v) { if (kind in this.glowSet) this.glowSet[kind] = Math.max(0, Math.min(1, v)); }
  setTint(hex, amount = 0.5) { this.U.uTint.value.set(hex); this.U.uTintAmt.value = amount; }
  breakPart(name) {
    const p = this.def.breakable?.[name];
    if (!p || this.broken?.[name]) return false;
    (this.broken ||= {})[name] = true;
    this.U.uHide.value[PART_SLOT[p.id - 1]] = 1;
    const wp = this._world(this.pose, this.entry.rig.index(p.bone), _v2.set(...p.pos), new THREE.Vector3());
    if (this.debris) {
      const dir = _v3.set(...(p.dir || [0, 0, 0])).transformDirection(this.pivotW);
      this.debris.spawn(wp, dir, p.shards ?? 9, (p.shardSize ?? 0.18) * this.S, this.root.position.y);
    }
    this.fx('spark', wp, 26, { scale: 1.2 }); this.fx('dust', wp, 6, { scale: 0.8, col: [0.5, 0.45, 0.4] });
    this._emitEvent('break', wp, name);
    return true;
  }
  /** Restore broken parts (e.g. lab reset). */
  repair() { this.broken = {}; this.U.uHide.value.set(0, 0, 0, 0); }
  /** World-space particle burst using a preset ('ember','flame','smoke','steam','ghost','void','spark','dust'). */
  fx(kind, p, n = 1, o = {}) {
    const f = PRESETS[kind]; if (!f) return;
    const arr = [p.x, p.y, p.z];
    if (kind === 'spark' || kind === 'dust') f(this.fxAdd, this.fxAlpha, arr, n, o);
    else for (let i = 0; i < n; i++) f(this.fxAdd, this.fxAlpha, arr, 1, o);
  }
  dispose() {
    this.root.removeFromParent();
    const M = this.mats; M.body.dispose(); M.ghost.dispose(); M.prepass.dispose(); M.depth.dispose();
    this.skeleton.dispose(); this.fxAdd.dispose(); this.fxAlpha.dispose();
    for (const T of this.trails) T.tr.dispose();
    if (this.debris) this.debris.mesh.dispose();
  }

  // ---------------------------------------------------------------------------------------------- helpers
  _world(P, bi, rest, out) { return P.carry(bi, rest, out).applyMatrix4(this.pivotW); }
  _emitEvent(name, pos, data) { if (this.onEvent) this.onEvent(name, pos, data, this); }
  _step(L) {
    const P = this.pose;
    const wp = _v3.copy(L.F).applyMatrix4(this.pivotW);
    const heavy = this.def.stepFx;
    if (heavy && this._stepFxOn) this.fx('dust', wp, Math.round(heavy.n * (0.4 + 0.6 * this.run)), { scale: heavy.scale });
    this._emitEvent('step', wp.clone(), L.id);
  }
  _worldMatrices() {
    this.root.updateWorldMatrix(true, false);
    this.pivot.updateMatrix();
    this.pivotWPrev.copy(this.pivotW);
    this.pivotW.multiplyMatrices(this.root.matrixWorld, this.pivot.matrix);
    if (!this._hasPrev) { this.pivotWPrev.copy(this.pivotW); this._hasPrev = true; }
    // model-space delta for springs: M_now^-1 * M_prev
    this.delta.m.copy(this.pivotW).invert().multiply(this.pivotWPrev);
    this.delta.m.decompose(_v, this.delta.q, _s);
    this.pivotW.decompose(_v, this.pivotQ, _s);
  }

  // ---------------------------------------------------------------------------------------------- update
  /**
   * state: { speed (m/s along facing), turn (rad/s), dead, groggy, enraged, ghost (0..1), fly, burrowed, combat }
   * dt = 0 holds the current pose (hit-stop).
   */
  update(dt, state = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.dt = dt;
    const def = this.def, P = this.pose, G = this.gait, U = this.U, S = this.S;
    this.state = state;
    this._worldMatrices();
    this.t += dt;
    // ---- state transitions
    if (state.dead && !this.dead) this.play('death');
    if (this._sd && !state.dead && this.dead) { this.dead = false; this.stop(); for (const w of Object.values(this.weapons)) this.catch(w); }
    this._sd = !!state.dead;
    if (state.groggy && !this._groggy && !this.dead && this.entry.actions.groggy) { this.play('groggy', { sustain: true }); }
    if (!state.groggy && this._groggy) for (const a of this.acts) if (a.name === 'groggy') a.sustainOn = false;
    this._groggy = !!state.groggy;
    // ---- actions: advance time, envelopes, events
    for (const a of this.acts) this._advance(a, dt);
    this.acts = this.acts.filter(a => !a.done && !(a.out && a.w <= 0.001));
    // ---- locomotion
    let speed = (state.speed ?? 0) / S, turn = state.turn ?? 0;
    let lock = 0; for (const a of this.acts) if (a.C.def.lock) lock = Math.max(lock, a.w * a.C.def.lock);
    if (this.dead) { speed = 0; turn = 0; }
    let vSpeed = 0;
    for (const a of this.acts) { const g = a.C.def.gait; if (g && !a.out) for (const seg of g) if (a.td >= seg[0] && a.td <= seg[1]) vSpeed = Math.max(vSpeed, seg[2] / S * a.w); }
    if (vSpeed > Math.abs(speed)) speed = vSpeed;
    this.lockLoco = lock;
    const k6 = 1 - Math.exp(-6 * dt);
    this.speedSm += (speed - this.speedSm) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    this.combat += (((state.combat ?? 1) ? 1 : 0) - this.combat) * (1 - Math.exp(-3 * dt));
    const gs = def.gait.gaits;
    this.run = clamp01((Math.abs(this.speedSm) - gs[0].v) / (gs[gs.length - 1].v - gs[0].v));
    this._stepFxOn = dt > 0;
    P.reset();
    if (dt > 0) G.update(dt, speed * (1 - lock), turn * (1 - lock));
    for (const L of G.legs) { L.overrideW = 0; L.overrideLocal = false; L.overridePaw = 0; L.pawAdd = 0; L.overrideMeta = undefined; }
    // ---- base pose
    const ik = this.ik; ik.R.w = 0; ik.L.w = 0; ik.grip = 0; ik.R.hasAim = ik.L.hasAim = false; ik.R.hasPole = ik.L.hasPole = false;
    const sp = this.special; sp.hips.set(0, 0, 0); sp.air = 0; sp.shake = 0; sp.eyes = 1; for (const k in sp.feet) sp.feet[k].w = 0; for (const k in sp.num) sp.num[k] = 0;
    def.carriage(this, dt);
    // ---- actions
    for (const a of this.acts) this._applyAction(a);
    // ---- procedural shake (roars, channel, groggy)
    if (sp.shake > 0.001) {
      const s = sp.shake, t = this.t;
      const B = this.B;
      if (B.chest !== undefined) P.rot(B.chest, Math.sin(t * 41) * 0.02 * s, Math.sin(t * 37 + 1) * 0.025 * s, Math.sin(t * 45 + 2) * 0.02 * s);
      if (B.head !== undefined) P.rot(B.head, Math.sin(t * 47 + 3) * 0.04 * s, Math.sin(t * 39) * 0.04 * s, 0);
    }
    P.move(this.B.hips, sp.hips.x, sp.hips.y, sp.hips.z);
    P.fk();
    // ---- legs: action foot keys drive the gait's own foot state (F) so feet stay where an action left them
    // and the gait takes a natural recovery step afterwards (no sliding back)
    for (const L of G.legs) {
      const f = sp.feet[L.id];
      if (f && f.w > 0.001) {
        if (!L.stance && L.settle) { L.stance = true; L.settle = false; L.u = 1; }
        const k = dt > 0 ? Math.min(1, f.w) : 0;
        if (k > 0) { L.F.x += (f.v[0] - L.F.x) * k; L.F.y += (f.v[1] - L.F.y) * k; L.F.z += (f.v[2] - L.F.z) * k; }
        L.override = L.override || new THREE.Vector3();
        L.override.copy(L.F); L.overrideW = Math.min(1, f.w);
        if (f.v[3] !== undefined) L.overridePaw = f.v[3];
        if (f.v[4] !== undefined) L.overrideMeta = f.v[4];
      } else if (L.stance && L.F.y > 0.001 && dt > 0) L.F.y = Math.max(0, L.F.y - dt * 2);
    }
    G.solve(P, { air: sp.air, airPaw: def.airPaw ?? -0.4 });
    // ---- arms
    this._arms();
    // ---- def extras after IK (look-at, jaw…) and springs
    if (def.post) def.post(this, dt);
    for (const c of this.springs) c.update(P, dt, this.delta, (9.8 / S), c.cfg.w ?? 1);
    P.apply(this.bones);
    // ---- weapons in flight
    for (const w of Object.values(this.weapons)) this._weapon(w, dt);
    // ---- glow / material
    this._glow(dt);
    // ---- particles
    this._emitters(dt);
    const fl = this.root.position.y + 0.05;
    this.fxAdd.update(dt, this.t, fl); this.fxAlpha.update(dt, this.t, fl);
    if (dt > 0) this._trails(dt);
    if (this.debris) this.debris.update(dt);
  }

  _advance(a, dt) {
    const C = a.C;
    const prev = a.t;
    if (a.out) {
      a.outT += dt; a.w = a.w0 * (1 - clamp01(a.outT / (a.fadeOut || C.fadeOut)));
    } else {
      a.t += dt;
      if (a.sus && a.sustainOn && a.t > a.sus[1]) a.t = a.sus[0] + ((a.t - a.sus[0]) % Math.max(0.05, a.sus[1] - a.sus[0]));
      let w = clamp01(a.t / Math.max(0.01, C.fadeIn));
      if (!C.hold) w *= clamp01((a.dur - a.t) / Math.max(0.01, C.fadeOut));
      a.w = w;
      if (!C.hold && a.t >= a.dur) a.done = true;
      if (C.hold && a.t > a.dur) a.t = a.dur;
      // events & hits
      while (dt > 0 && a.fired < C.ev.length && a.evReal[a.fired] <= a.t) {
        const e = C.ev[a.fired++];
        this._event(a, e[1], e[2]);
      }
      if (dt > 0) while (a.hitFired < a.hitsReal.length && a.hitsReal[a.hitFired] <= a.t) {
        const i = a.hitFired++;
        this._event(a, 'hit', C.def.hitAt?.[i] ?? C.def.hitAt?.[0] ?? 'weaponTip', i);
      }
    }
    a.td = a.W.toDef(Math.min(a.t, a.dur));
    if (C.def.fn && dt > 0) C.def.fn(this, a, dt);
  }

  _event(a, name, arg, idx) {
    const def = this.def;
    let pos = null;
    const sock = typeof arg === 'string' ? (this.sockets[arg] || this.sockets.parts[arg]) : null;
    if (sock) { pos = new THREE.Vector3(); this._socketWorld(sock, pos); }
    const h = def.events?.[name];
    if (h) h(this, a, pos, arg, idx);
    this._emitEvent(name === 'hit' ? 'hit' : name, pos, { action: a.name, arg, index: idx });
  }
  /** World position of a socket using this frame's pose (valid inside update, before three's matrix update). */
  _socketWorld(sock, out) {
    // walk up to the bone (socket may hang under a weapon mesh)
    const par = sock.parent;
    if (par && par.isBone) {
      const bi = this.bones.indexOf(par);
      return this._world(this.pose, bi, _v.copy(sock.position).add(this.entry.rig.bones[bi].rest), out);
    }
    if (par && par.isMesh) {
      const w = Object.values(this.weapons).find(x => x.mesh === par);
      if (w.flight) return out.copy(sock.position).applyMatrix4(w.mesh.matrixWorld);
      return this._world(this.pose, w.bone, _v.copy(sock.position), out);
    }
    return sock.getWorldPosition(out);
  }

  _applyAction(a) {
    const P = this.pose, C = a.C, w = a.w;
    if (w <= 0.0005) return;
    sample(C, a.td, a.S);
    const sp = this.special, ik = this.ik;
    for (const [tr, o] of a.S) {
      const we = w * o.w;
      if (we <= 0.0005) continue;
      switch (tr.kind) {
        case 'bone':
          if (tr.add) P.lq[tr.bone].multiply(_q.identity().slerp(o.q, we));
          else P.lq[tr.bone].slerp(o.q, we);
          break;
        case 'vec': {
          const v = o.v;
          if (tr.ch === '$hips') sp.hips.x += v[0] * we, sp.hips.y += v[1] * we, sp.hips.z += v[2] * we;
          else if (tr.ch === '$handR' || tr.ch === '$handL') {
            const s = ik[tr.ch[5]];
            if (s.w <= 0.0005) { s.p.set(v[0], v[1], v[2]); s.w = we; } else { s.p.lerp(_v.set(v[0], v[1], v[2]), we); s.w += (1 - s.w) * we; }
          } else if (tr.ch === '$poleR' || tr.ch === '$poleL') {
            const s = ik[tr.ch[5]]; if (!s.hasPole) { s.pole.set(v[0], v[1], v[2]); s.hasPole = true; } else s.pole.lerp(_v.set(v[0], v[1], v[2]), we);
          }
          break;
        }
        case 'aim': {
          const s = ik[tr.ch[4]];
          if (!s.hasAim) { s.h.copy(o.h); s.b.copy(o.b); s.hasAim = true; } else { s.h.lerp(o.h, we).normalize(); s.b.lerp(o.b, we).normalize(); }
          break;
        }
        case 'foot': {
          const id = tr.ch.slice(5);
          const f = sp.feet[id] || (sp.feet[id] = { w: 0, v: [0, 0, 0], local: false });
          const v = o.v;
          if (f.w <= 0.0005) { for (let k = 0; k < v.length; k++) f.v[k] = v[k]; f.v.length = v.length; f.w = we; }
          else { for (let k = 0; k < v.length; k++) f.v[k] = f.v[k] + (v[k] - f.v[k]) * we; f.w += (1 - f.w) * we; }
          break;
        }
        default: {
          const n = tr.ch;
          if (n === '$air') sp.air = Math.max(sp.air, o.v * we);
          else if (n === '$gripL') ik.grip += (o.v - ik.grip) * we;
          else if (n === '$shake') sp.shake = Math.max(sp.shake, o.v * we);
          else if (n === '$eyes') sp.eyes *= 1 + (o.v - 1) * we;
          else sp.num[n] = (sp.num[n] ?? 0) + o.v * we;
        }
      }
    }
  }

  _arms() {
    const P = this.pose, ik = this.ik, W = this.wpn, num = this.special.num;
    const R = this.chains.R, L = this.chains.L;
    if (num.$freeR) ik.R.w *= 1 - clamp01(num.$freeR);
    if (num.$freeL) { ik.L.w *= 1 - clamp01(num.$freeL); ik.grip *= 1 - clamp01(num.$freeL); }
    if (R && ik.R.w > 0.001) {
      let Q = null;
      if (W && ik.R.hasAim) {
        Q = weaponQ(_q2, W.h0, W.b0, ik.R.h, ik.R.b);
        // wrist target = grip target − Q·(gripRest − wristRest)
        _v.copy(W.grip).sub(P.rest[R.hand]).applyQuaternion(Q);
        _v2.copy(ik.R.p).sub(_v);
      } else _v2.copy(ik.R.p);
      armIK(P, R.ch, R.hand, _v2, ik.R.hasPole ? ik.R.pole : _v3.set(1, -0.6, 0.8), Q, ik.R.w);
    }
    if (L && W && W.grip2 && ik.grip > 0.001) {
      // left fist onto the second grip point of the weapon held in the right hand
      const T = this._tmpArm || (this._tmpArm = { g2: new THREE.Vector3(), h: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), off: new THREE.Vector3(), pole: new THREE.Vector3() });
      const hR = this.chains.R.hand;
      T.g2.copy(W.grip2).sub(P.rest[hR]).applyQuaternion(P.wq[hR]).add(P.wp[hR]);
      T.h.copy(W.h0).applyQuaternion(P.wq[hR]);
      T.b.copy(W.b0).applyQuaternion(P.wq[hR]).multiplyScalar(W.leftFlip ?? -1);
      weaponQ(T.q, W.hL0, W.bL0, T.h, T.b);
      T.off.copy(W.gripL).sub(P.rest[L.hand]).applyQuaternion(T.q);
      T.g2.sub(T.off);
      armIK(P, L.ch, L.hand, T.g2, ik.L.hasPole ? ik.L.pole : T.pole.set(-1, -0.6, 0.8), T.q, ik.grip);
    } else if (L && ik.L.w > 0.001) {
      armIK(P, L.ch, L.hand, ik.L.p, ik.L.hasPole ? ik.L.pole : _v3.set(-1, -0.6, 0.8), null, ik.L.w);
    }
  }

  // ---- thrown weapon flight (e.g. Gorrath's boomerang axe): world-space path, spins, returns to the hand
  launch(name, o) {
    const w = this.weapons[name]; if (!w) return;
    const P = this.pose, bi = w.bone;
    // current world transform of the held weapon
    const q0 = new THREE.Quaternion().copy(this.pivotQ).multiply(P.wq[bi]);
    const p0 = this.wpn.grip.clone().sub(P.rest[bi]).applyQuaternion(P.wq[bi]).add(P.wp[bi]).applyMatrix4(this.pivotW);
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(this.pivotW); fwd.y = 0; fwd.normalize();
    w.flight = { t: 0, T: o.T, dist: o.dist, side: o.side ?? 0.35, q0, fwd, p0, spin: o.spin ?? 2.6, hgt: o.height ?? p0.y, catchP: new THREE.Vector3(), handQ: new THREE.Quaternion(), pos: new THREE.Vector3() };
    w.mesh.matrixWorldAutoUpdate = false;
  }
  _weapon(w, dt) {
    const f = w.flight; if (!f) return;
    const m = w.mesh, W = this.wpn;
    f.t += dt;
    if (f.mode === 'drop') {
      const u = clamp01(f.t / f.T);
      const pos = f.pos.copy(f.p0).lerp(f.p1, u * u);
      if (u >= 1) { const bt = f.t - f.T; pos.y += Math.abs(Math.sin(Math.min(bt * 9, Math.PI))) * Math.exp(-bt * 6) * 0.35; }
      const q = _q.copy(f.q0).slerp(f.q1, Math.min(1, u * u * 1.1));
      _m.compose(pos, q, _s.setScalar(this.S)).multiply(_m2.makeTranslation(-W.grip.x, -W.grip.y, -W.grip.z));
      m.matrixWorld.copy(_m);
      for (const c of m.children) c.updateMatrixWorld(true);
      if (u >= 1 && !f.landed) { f.landed = true; this.fx('dust', pos, 10, { scale: 1.5 }); this._emitEvent('weaponDrop', pos.clone(), w.mesh.name); }
      return;
    }
    const u = clamp01(f.t / f.T);
    // hand grip point + orientation now (catch target)
    const P = this.pose, bi = w.bone;
    const handGrip = f.catchP.copy(W.grip).sub(P.rest[bi]).applyQuaternion(P.wq[bi]).add(P.wp[bi]).applyMatrix4(this.pivotW);
    f.handQ.copy(this.pivotQ).multiply(P.wq[bi]);
    const side = _v3.set(-f.fwd.z, 0, f.fwd.x); // right of facing
    const out = Math.sin(Math.PI * u) ** 0.8;
    const pos = f.pos.copy(f.p0).addScaledVector(f.fwd, f.dist * out).addScaledVector(side, f.dist * f.side * Math.sin(TAU * u) * 0.5);
    pos.y = f.p0.y + (f.hgt - f.p0.y) * Math.sin(Math.PI * u);
    const ret = clamp01((u - 0.7) / 0.3);
    pos.lerp(handGrip, ret * ret * (3 - 2 * ret));
    // orientation: haft horizontal, flat spin about world up (blades sweep like a boomerang)
    const spin = f.t * f.spin * TAU;
    const flat = weaponQ(_q, W.h0, W.b0, _v2.set(Math.cos(spin), 0, Math.sin(spin)), _v.set(0, 1, 0));
    const held = _q2.copy(u < 0.5 ? f.q0 : f.handQ);
    const blend = Math.min(clamp01(u / 0.1), clamp01((1 - u) / 0.1));
    const q = held.slerp(flat, blend * blend * (3 - 2 * blend));
    // matrixWorld = T(pos) R(q) S(S) T(-grip)
    _m.compose(pos, q, _s.setScalar(this.S)).multiply(_m2.makeTranslation(-W.grip.x, -W.grip.y, -W.grip.z));
    m.matrixWorld.copy(_m);
    for (const c of m.children) c.updateMatrixWorld(true);
    if (u >= 1) this.catch(w);
  }
  /** Drop a held weapon: it tumbles to the ground beside the boss and stays there (until catch/revive). */
  drop(name, o = {}) {
    const w = this.weapons[name]; if (!w || w.flight) return;
    const P = this.pose, bi = w.bone, W = this.wpn;
    const q0 = new THREE.Quaternion().copy(this.pivotQ).multiply(P.wq[bi]);
    const p0 = W.grip.clone().sub(P.rest[bi]).applyQuaternion(P.wq[bi]).add(P.wp[bi]).applyMatrix4(this.pivotW);
    const h = new THREE.Vector3().copy(W.h0).applyQuaternion(q0); h.y = 0; if (h.lengthSq() < 1e-4) h.set(1, 0, 0); h.normalize();
    const b = new THREE.Vector3(-h.z, 0, h.x);
    const q1 = weaponQ(new THREE.Quaternion(), W.h0, W.b0, h, b);
    const p1 = p0.clone(); p1.y = this.root.position.y + (o.rest ?? 0.05) * this.S;
    w.flight = { mode: 'drop', t: 0, T: o.T ?? 0.7, q0, q1, p0, p1, pos: new THREE.Vector3() };
    w.mesh.matrixWorldAutoUpdate = false;
  }
  catch(w) { if (!w.flight) return; w.flight = null; w.mesh.matrixWorldAutoUpdate = true; }
  /** Is the named weapon currently flying (thrown)? */
  flying(name = 'axe') { return !!this.weapons[name]?.flight; }

  _glow(dt) {
    const U = this.U, g = this.glow, st = this.state, sp = this.special.num, gs = this.glowSet;
    const k = dt > 0 ? 1 - Math.exp(-8 * dt) : 0;
    const tgt = {
      counter: Math.max(gs.counter, clamp01(sp.$counter ?? 0)),
      enrage: Math.max(gs.enrage, st.enraged ? 1 : 0, clamp01(sp.$enrage ?? 0)),
      ghost: Math.max(gs.ghost, clamp01(st.ghost ?? 0), clamp01(sp.$ghost ?? 0)),
      charge: clamp01(sp.$charge ?? 0), body: clamp01(sp.$body ?? 0),
      eyes: this.special.eyes,
    };
    if (!this._glowInit) { Object.assign(g, tgt); this._glowInit = true; }
    for (const key in tgt) g[key] += (tgt[key] - g[key]) * (key === 'counter' ? Math.min(1, k * 2) : k);
    U.uCounter.value = g.counter; U.uEnrage.value = g.enrage; U.uGhost.value = g.ghost;
    U.uCharge.value = g.charge; U.uBodyGlow.value = g.body; U.uEyeK.value = g.eyes;
    // ghost: transparent variant + depth prepass; ghosts cast no shadow
    const ghost = g.ghost > 0.01;
    const mat = ghost ? this.mats.ghost : this.mats.body;
    if (this.mesh.material !== mat) {
      this.mesh.material = mat; this.pre.visible = ghost;
      for (const w of Object.values(this.weapons)) w.mesh.material = mat;
    }
    const cast = g.ghost < 0.5;
    this.mesh.castShadow = cast; for (const w of Object.values(this.weapons)) w.mesh.castShadow = cast;
    if (this.def.glowHook) this.def.glowHook(this, dt);
  }

  _trails(dt) {
    const P = this.pose, S = this.S;
    for (const T of this.trails) {
      const c = T.cfg, w = c.weapon ? this.weapons[c.weapon] : null;
      const bi = w ? w.bone : (T.bi ?? (T.bi = this.entry.rig.index(c.bone)));
      if (w && w.flight) { T.pa.copy(T.a).applyMatrix4(w.mesh.matrixWorld); T.pb.copy(T.b).applyMatrix4(w.mesh.matrixWorld); }
      else { this._world(P, bi, T.a, T.pa); this._world(P, bi, T.b, T.pb); }
      let v = T.init ? T.prev.distanceTo(T.pb) / dt : 0;
      if (v > 90) { T.tr.clear(); v = 0; }   // teleport / pose jump: restart the ribbon
      T.prev.copy(T.pb); T.init = true;
      const vMin = (c.vMin ?? 7), vMax = (c.vMax ?? 16);
      const alpha = Math.min(1, Math.max(0, (v - vMin) / (vMax - vMin))) * (this.dead ? 0 : 1);
      T.tr.push(T.pa, T.pb, alpha);
      T.tr.update(dt);
    }
  }
  _emitters(dt) {
    if (dt <= 0) return;
    const E = this.def.emitters; if (!E) return;
    const P = this.pose, g = this.glow;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      let rate = e.rate * (e.when ? e.when(this) : 1);
      if (rate <= 0) continue;
      this.emitAcc[i] += rate * dt;
      let n = Math.floor(this.emitAcc[i]);
      if (n <= 0) continue;
      this.emitAcc[i] -= n;
      const wpn = e.weapon ? this.weapons[e.weapon] : null;
      const bi = wpn ? wpn.bone : (e._bi ?? (e._bi = this.entry.rig.index(e.bone)));
      for (let j = 0; j < n; j++) {
        const jit = e.jitter ?? 0;
        _v2.set(e.p[0] + (Math.random() - 0.5) * jit, e.p[1] + (Math.random() - 0.5) * jit * 0.5, e.p[2] + (Math.random() - 0.5) * jit);
        if (e.span) { const u = Math.random(); _v2.x += e.span[0] * (u - 0.5) * 2; _v2.y += e.span[1] * (u - 0.5) * 2; _v2.z += e.span[2] * (u - 0.5) * 2; }
        if (wpn && wpn.flight) _v3.copy(_v2).applyMatrix4(wpn.mesh.matrixWorld);
        else this._world(P, bi, _v2, _v3);
        const o = e.opts ? (typeof e.opts === 'function' ? e.opts(this) : e.opts) : {};
        if (e.dir) { o.dir = o.dir || [0, 0, 0]; _v.set(...e.dir).applyQuaternion(P.wq[bi]).transformDirection(this.pivotW); o.dir[0] = _v.x; o.dir[1] = _v.y; o.dir[2] = _v.z; }
        PRESETS[e.kind](this.fxAdd, this.fxAlpha, [_v3.x, _v3.y, _v3.z], 1, o);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ shared carriage helpers
/**
 * Generic heavy-biped carriage: hips bob/sway from the gait, torso counter-twist, breathing, head stabilisation,
 * look-around, arm swing. cfg: { lean:{walk,run}, twist, crouch, breathe, arm:{swing, out, elbow}, look }
 */
export function bipedCarriage(ctl, dt, cfg = {}) {
  const P = ctl.pose, G = ctl.gait, B = ctl.B, t = ctl.t;
  const act = G.act, ph = G.phase * TAU, run = ctl.run;
  const walkK = clamp01(Math.abs(ctl.speedSm) / (ctl.def.gait.gaits[0].v || 1));
  const breathF = mix(0.22, 0.55, Math.max(run, ctl.glow.enrage * 0.6));
  const breath = Math.sin(t * TAU * breathF);
  const lean = (cfg.lean?.walk ?? 0.08) * walkK * (1 - run) + (cfg.lean?.run ?? 0.3) * run;
  const tw = (cfg.twist ?? 0.1) * act;
  G.adaptBody(dt, false);
  P.move(B.hips, G.sway, G.bob + G.gOff - (cfg.crouch ?? 0.02) * ctl.combat - 0.03 * run, 0);
  P.rot(B.hips, G.pitch - lean * 0.3, -tw * Math.cos(ph), G.roll + ctl.turnSm * clamp01(Math.abs(ctl.speedSm) * 2) * 0.05);
  P.rot(B.spine, -lean * 0.45 + 0.02 * breath, tw * 0.6 * Math.cos(ph), -G.roll * 0.5);
  P.rot(B.chest, -lean * 0.35 - 0.018 * breath, tw * 0.5 * Math.cos(ph), -G.roll * 0.4);
  P.sc[B.chest].setScalar(1 + breath * (cfg.breathe ?? 0.012));
  // look around (idle only)
  const L = ctl._look || (ctl._look = { y: 0, p: 0, ty: 0, tp: 0, timer: 1 });
  if (dt > 0) {
    L.timer -= dt;
    if (L.timer <= 0) { L.timer = 2 + Math.random() * 4; L.ty = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * (cfg.look ?? 0.8); L.tp = (Math.random() - 0.5) * 0.2; }
    const idle = 1 - clamp01(act * 1.5);
    L.y += (L.ty * idle - L.y) * (1 - Math.exp(-2.5 * dt)); L.p += (L.tp * idle - L.p) * (1 - Math.exp(-2.5 * dt));
  }
  const stab = (lean - G.pitch) * 0.8;
  if (B.neck !== undefined) P.rot(B.neck, stab * 0.4 + L.p * 0.4 + (cfg.neckPitch ?? 0), L.y * 0.4 + ctl.turnSm * 0.08, 0);
  P.rot(B.head, stab * 0.5 + L.p * 0.6 + G.nod + (cfg.headPitch ?? 0), L.y * 0.6 + ctl.turnSm * 0.1 - tw * 0.6 * Math.cos(ph), -G.roll * 0.3);
  // arms
  const A = cfg.arm || {};
  const swing = (A.swing ?? 0.3) * act * (1 - run * 0.3) + (A.runSwing ?? 0.7) * run * act;
  for (const [arm, s] of [[B.armL, -1], [B.armR, 1]]) {
    if (!arm) continue;
    const fw = s * Math.cos(ph) * (s > 0 ? (A.weaponSwing ?? 1) : 1);
    const out = (A.out ?? 0.1) + (A.runOut ?? 0.1) * run;
    const elbow = (A.elbow ?? 0.25) + (A.runElbow ?? 0.9) * run;
    P.rot(arm[0], swing * fw + 0.02 * breath, 0, s * out);
    P.rot(arm[1], elbow + Math.max(0, swing * fw) * 0.5, 0, 0);
  }
  return { breath, lean, ph, act, walkK };
}

/**
 * Generic quadruped carriage (hounds, behemoths): body bob/pitch/roll/flex from the gait, combat crouch, breathing,
 * neck/head stabilisation + look-around, tail sway. cfg: { crouch, runDrop, combatPitch, breathe, neck:{pitch, run, combat, headCombat}, tail:{wag, run} }
 */
export function quadCarriage(ctl, dt, cfg = {}) {
  const P = ctl.pose, G = ctl.gait, B = ctl.B, t = ctl.t;
  const idle = 1 - clamp01(G.act * 1.5), run = ctl.run, combat = ctl.combat;
  const breath = Math.sin(t * TAU * mix(0.28, 0.9, Math.max(run, ctl.glow.enrage * 0.5)));
  if (B.chest !== undefined) P.sc[B.chest].setScalar(1 + breath * (cfg.breathe ?? 0.012));
  G.adaptBody(dt);
  const crouch = (cfg.crouch ?? 0.04) * combat * (1 - run);
  P.move(B.hips, G.sway, G.bob - crouch - run * (cfg.runDrop ?? 0.04) + G.gOff, 0);
  P.rot(B.hips, G.pitch + (cfg.combatPitch ?? -0.04) * combat + G.gPitch, 0, G.roll + ctl.turnSm * clamp01(Math.abs(ctl.speedSm) / 2) * 0.1 + G.gRoll);
  if (B.chest !== undefined) P.rx(B.chest, G.flex - crouch * 0.6 + breath * 0.01);
  if (B.pelvis !== undefined) P.rx(B.pelvis, -G.flex * 0.8);
  const L = ctl._look || (ctl._look = { y: 0, p: 0, ty: 0, tp: 0, timer: 1 });
  if (dt > 0) {
    L.timer -= dt;
    if (L.timer <= 0) { L.timer = 1.5 + Math.random() * 3.5; L.ty = Math.random() < 0.3 ? 0 : (Math.random() - 0.5) * (cfg.look ?? 1.0); L.tp = (Math.random() - 0.4) * 0.3; }
    const lk = idle * (1 - combat * 0.5);
    L.y += (L.ty * lk - L.y) * (1 - Math.exp(-3 * dt)); L.p += (L.tp * lk - L.p) * (1 - Math.exp(-3 * dt));
  }
  const N = cfg.neck || {};
  const stab = -(G.pitch + G.flex) * 0.85;
  const neckP = (N.pitch ?? 0) + (N.run ?? -0.25) * run + (N.combat ?? -0.25) * combat;
  P.rot(B.neck, neckP + stab * 0.4 + L.p * 0.4, L.y * 0.45 + ctl.turnSm * 0.12, 0);
  P.rot(B.head, stab * 0.6 + G.nod + L.p * 0.6 - neckP * (N.comp ?? 0.6) + (N.headCombat ?? 0.15) * combat, L.y * 0.55 + ctl.turnSm * 0.1, -L.y * 0.2);
  if (B.tail) {
    const T = cfg.tail || {}, n = B.tail.length;
    const wag = (T.wag ?? 0.12) * idle + 0.06 * G.act;
    for (let i = 0; i < n; i++) {
      const ph = t * TAU * (T.wagF ?? 0.4) - i * 0.9;
      P.rot(B.tail[i], -((T.run ?? 0.3) * run) / n + Math.sin(t * 1.7 - i) * 0.02, Math.sin(ph) * wag * (0.5 + i * 0.3) + ctl.turnSm * 0.1, 0);
    }
  }
  return { breath, idle };
}
