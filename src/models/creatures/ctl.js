// Creature controllers (adapted copies of kit/quadruped.js + kit/biped.js, extended for SEVENSHARD's contract):
//   - Actions: layered one-shots with { dur, loop } stretching, hit timing, holds, cross-fades on restart.
//   - BaseCtl: shared state machine — dead / down (knockdown…getup) / stunned (loop) / fly / spawn / revive.
//   - BipedCtl (legs IK + FK arms + optional bat wings & flight), QuadCtl (4-leg gait), HoverCtl (floating, no legs).
// Hot paths are allocation-free: every per-frame parameter is read from fixed-shape `Knobs` / `ActDef` objects built once
// per spec (not from the creature's spec literals, whose varied shapes make V8 box every double it loads), no closures,
// no temporary objects, indexed loops.
import * as THREE from 'three';
import { Gait } from './gait2.js';
import { sstep, clamp01, mix, TAU, env } from '../kit/rig.js';

const NOINFO = { dur: 0 };
const EMPTY = {};

// ================================================================================================ action defs
/** Normalised, fixed-shape action definition (the authored literal is kept as `src`; extra fields are copied too). */
class ActDef {
  constructor(d) {
    this.dur = d.dur ?? 1; this.a = d.a ?? 0.12; this.d = d.d ?? 0.8;
    this.hasHit = d.hit !== undefined; this.hit = d.hit ?? 0; this.hits = d.hits ?? null;
    this.hold = !!d.hold; this.loop = !!d.loop; this.excl = !!d.excl; this.state = !!d.state; this.rest = !!d.rest; this.keep = !!d.keep;
    this.fadeIn = d.fadeIn ?? 0.2; this.fadeOut = d.fadeOut ?? 0.3; this.speed = d.speed ?? 1;
    this.fn = d.fn || noop; this.start = d.start || null; this.src = d;
    for (const k in d) if (!(k in this)) this[k] = d[k];
  }
}
function noop() {}
const DEFCACHE = new WeakMap();
function normDefs(defs) {
  let n = DEFCACHE.get(defs);
  if (!n) { n = {}; for (const k in defs) n[k] = defs[k] instanceof ActDef ? defs[k] : new ActDef(defs[k]); DEFCACHE.set(defs, n); }
  return n;
}
class ActInst { // fixed-shape running action
  constructor(name, d, speed, loop) {
    this.name = name; this.d = d; this.t = 0; this.age = 0; this.k = 0; this.speed = speed; this.w = 0;
    this.out = false; this.outT = 0; this.w0 = -1; this.fo = -1; this.loop = loop; this.seed = Math.random() * 100; this.done = false; this.u = {};
  }
}

// ================================================================================================ actions
export class Actions {
  constructor(ctl, defs) { this.ctl = ctl; this.defs = normDefs(defs || EMPTY); this.list = []; this.last = null; }
  info(name, speed) {
    const d = this.defs[name], base = d.dur;
    const o = { dur: base / speed };
    if (d.hasHit) o.hit = d.hit * base / speed;
    if (d.hits) o.hits = d.hits.map(h => h * base / speed);
    return o;
  }
  play(name, dur, loop) {
    const d = this.defs[name];
    if (!d) return null;
    const base = d.dur;
    const speed = dur > 0 ? base / dur : d.speed;
    loop = loop ?? d.loop;
    const L = this.list;
    let old = null;
    for (let i = 0; i < L.length; i++) if (L[i].name === name && !L[i].out) { old = L[i]; break; }
    if (old && d.hold) { this.last = old; return this.info(name, old.speed); }
    if (d.excl) for (let i = 0; i < L.length; i++) { const x = L[i], dx = x.d; if (x !== old && (dx.hold || dx.excl) && !dx.keep) x.out = true; }
    if (old) { old.out = true; old.fo = 0.12; } // restart: cross-fade the old instance out quickly
    const a = new ActInst(name, d, speed, !!loop);
    if (old) a.w = old.w * 0.5; // start from part of the old weight to avoid a pop
    L.push(a);
    this.last = a;
    if (d.start) d.start(this.ctl, a);
    return this.info(name, speed);
  }
  stop(name, fadeOut) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (!name || a.name === name) { a.out = true; if (fadeOut !== undefined) a.fo = fadeOut; } }
  }
  /** stop everything except state holds (death/knockdown/stun/spawn) */
  stopSoft() { const L = this.list; for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.d.state) a.out = true; } }
  has(name) { const L = this.list; for (let i = 0; i < L.length; i++) if (L[i].name === name && !L[i].out) return true; return false; }
  get(name) { const L = this.list; for (let i = 0; i < L.length; i++) if (L[i].name === name && !L[i].out) return L[i]; return null; }
  weight(name) { let w = 0; const L = this.list; for (let i = 0; i < L.length; i++) if (L[i].name === name && L[i].w > w) w = L[i].w; return w; }
  update(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], d = a.d, dur = d.dur;
      a.t += dt * a.speed; a.age += dt;
      if (a.loop && !d.hold && a.t >= dur && !a.out) a.t -= dur;
      a.k = Math.min(1, a.t / dur);
      if (a.out) { if (a.w0 < 0) a.w0 = a.w; a.outT += dt; a.w = a.w0 * (1 - clamp01(a.outT / (a.fo >= 0 ? a.fo : d.fadeOut))); }
      else if (d.hold || a.loop) a.w = Math.max(a.w, clamp01(a.age / d.fadeIn));
      else a.w = Math.max(env(a.k, d.a, d.d), a.age < 0.1 ? a.w : 0);
      if (!d.hold && !a.loop && a.k >= 1 && !a.out) a.done = true;
    }
    let j = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.done && !(a.out && a.w <= 0.001)) L[j++] = a; }
    L.length = j;
  }
  apply() { const L = this.list; for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.w > 0) a.d.fn(this.ctl, a, a.w); } }
}

// ================================================================================================ knobs
/** Every numeric spec parameter a controller reads per frame, flattened once per (spec, controller kind). */
class Knobs {
  constructor(spec, kind) {
    const A = spec.arm || EMPTY, Ln = typeof spec.lean === 'object' ? spec.lean : EMPTY, W = spec.wings || EMPTY, N = spec.neck || EMPTY, T = spec.tail && !Array.isArray(spec.tail) ? spec.tail : EMPTY;
    const hover = kind === 'hover', quad = kind === 'quad';
    const gs = spec.gait?.gaits;
    this.runV0 = gs ? (quad ? (gs[1]?.v ?? 3) : gs[0].v * 1.2) : 0; this.runV1 = gs ? gs[gs.length - 1].v : 1;
    this.leanWalk = Ln.walk ?? 0.1; this.leanRun = Ln.run ?? 0.3; this.leanCombat = Ln.combat ?? 0.08;
    this.flyLean = spec.flyLean ?? 0.5; this.twist = spec.twist ?? 0.12; this.waddle = spec.waddle ?? 0;
    this.flyH = spec.flyH ?? 1; this.flyBob = spec.flyBob ?? (quad ? 0.05 : 0.04); this.crouch = spec.crouch ?? 0.03;
    this.breathe = spec.breathe ?? (quad ? 0.012 : 0.015); this.tailLift = spec.tailLift ?? 0.1; this.tailFly = spec.tailFly ?? 0.2;
    this.airPaw = spec.airPaw ?? (quad ? -0.6 : -0.3); this.chargeK = spec.chargeK ?? 0.3; this.fidgetGap = spec.fidgetGap ?? 4;
    // arms
    this.swing = A.swing ?? 0.45; this.runSwing = A.runSwing ?? 0.9; this.weaponSwing = A.weaponSwing ?? 1;
    this.armOut = A.out ?? (hover ? 0.2 : 0.15); this.runOut = A.runOut ?? 0.1; this.combatOut = A.combatOut ?? 0.1; this.flyOut = A.flyOut ?? 0.3;
    this.elbow = A.elbow ?? (hover ? 0.5 : 0.25); this.runElbow = A.runElbow ?? 1.1; this.combatElbow = A.combatElbow ?? 0.4; this.flyElbow = A.flyElbow ?? 0.4;
    this.combatUp = A.combatUp ?? (hover ? 0.3 : 0.2); this.flyUp = A.flyUp ?? 0.2; this.wrist = A.wrist ?? 0; this.armUp = A.up ?? 0.2; this.armTrail = A.trail ?? 0.4;
    // wings
    this.hasWings = !!spec.wings; this.wIdleF = W.idleF ?? 0.5; this.wFlapF = W.flapF ?? 6; this.wIdleAmp = W.idleAmp ?? 0.06; this.wAmp = W.amp ?? 0.8;
    this.wFlySpread = W.flySpread ?? 0.3; this.wFold = W.fold ?? 0.3; this.wFold2 = W.fold2 ?? 1.2; this.wTilt = W.tilt ?? 0; this.wLift = W.lift ?? 0.35;
    // quadruped carriage
    this.combatCrouch = spec.combatCrouch ?? 0.05; this.runDrop = spec.runDrop ?? 0.03; this.combatPitch = spec.combatPitch ?? -0.05;
    this.nStab = N.stab ?? 0.85; this.nPitch = N.pitch ?? 0; this.nRun = N.run ?? -0.25; this.nCombat = N.combat ?? -0.3; this.nWalk = N.walk ?? -0.05;
    this.nComp = N.comp ?? 0.6; this.nHeadCombat = N.headCombat ?? 0.15;
    this.tWag = T.wag ?? 0.25; this.tWagF = T.wagF ?? 0.6; this.tRun = T.run ?? 0.45; this.tCombat = T.combat ?? 0.3; this.tBase = T.base ?? 0;
    // hover
    this.runVh = spec.runV ?? 4; this.bobF = spec.bobF ?? 0.4; this.bob = spec.bob ?? 0.06; this.hLean = typeof spec.lean === 'number' ? spec.lean : 0.25;
    this.bank = spec.bank ?? 0.12; this.trailK = spec.trailK ?? 0.12; this.flutter = spec.flutter ?? 0.05; this.headLean = spec.headLean ?? 0.2;
  }
}
const KCACHE = new WeakMap();
function knobsFor(spec, kind) {
  let m = KCACHE.get(spec); if (!m) { m = {}; KCACHE.set(spec, m); }
  return m[kind] || (m[kind] = new Knobs(spec, kind));
}

// ================================================================================================ base
export class BaseCtl {
  constructor(inst, spec, kind = 'base') {
    this.inst = inst; this.pose = inst.pose; this.spec = spec; this.k = knobsFor(spec, kind);
    const P = this.pose, b = {};
    const map = (v) => Array.isArray(v) ? v.map(map) : P.b[v];
    for (const k in spec.bones) b[k] = map(spec.bones[k]);
    this.b = b;
    this.acts = new Actions(this, spec.actions || EMPTY);
    this.t = Math.random() * 100;
    this.H = inst.entry.height;             // model-space height
    this.dead = false; this.isDown = false;
    this.combat = 0; this.run = 0; this.turnSm = 0; this.speedSm = 0; this.accel = 0;
    this.air = 0; this.fly = 0; this.flyT = 0; this.locoW = 1; this.restW = 0;
    this.jaw = 0; this.ear = 0; this.hackle = 0; this.glow = 1; this.flame = 1; this.charge = 0; this.wingSpread = 0; this.flap = 0; this.wt = Math.random() * 10; this.wingBeat = 0;
    this._speed = 0; this._turn = 0; this._strafe = 0;
    this.look = { y: 0, p: 0, ty: 0, tp: 0, timer: 1 + Math.random() * 3 };
    this.fidgetTimer = 3 + Math.random() * 5;
    this._sd = false; this._sdown = false;
    this.state = EMPTY;
    this.u = inst.material.userData.u;
  }
  stopActions() { this.acts.stopSoft(); }
  play(name, dur, loop) {
    const A = this.acts;
    if (name === 'idle' || name === 'stand') { A.stopSoft(); return NOINFO; }
    if (name === 'revive') { this.dead = false; this.isDown = false; A.stop(); return { dur: 0.3 }; }
    let fromDown = false;
    if (name === 'spawn') { this.dead = false; this.isDown = false; A.stop(undefined, 0.01); }
    else if (this.dead && name !== 'death') return null;
    if (name === 'death') {
      if (this.dead && A.has('death')) return A.info('death', A.get('death').speed);
      fromDown = this.isDown || A.weight('knockdown') > 0.5;
      this.dead = true; this.isDown = false;
      if (!A.defs.death) return NOINFO;
    }
    if (name === 'knockdown') { if (this.isDown && A.has('knockdown')) return A.info('knockdown', A.get('knockdown').speed); this.isDown = true; A.stop('stun', 0.1); }
    if (name === 'getup') {
      if (!this.isDown && !A.has('knockdown')) return null;
      this.isDown = false;
      const kd = A.get('knockdown'); if (kd) { kd.out = true; kd.fo = 0.02; }
    }
    const r = A.play(name, dur, loop);
    if (r && A.last) A.last.u.fromDown = fromDown;
    if (!r && name === 'knockdown') this.isDown = false;
    return r;
  }
  /** state transitions shared by every controller; sets this._speed / _turn / _strafe (model units) */
  _state(state, dt) {
    this.state = state;
    const dead = !!state.dead, down = !!state.down;
    if (dead && !this.dead) this.play('death');
    if (this._sd && !dead && this.dead) this.play('revive');
    this._sd = dead;
    if (!this.dead) {
      if (down && !this.isDown) this.play('knockdown');
      if (this._sdown && !down && this.isDown) this.play('getup');
    }
    this._sdown = down;
    const stun = !!state.stunned && !this.dead && !this.isDown;
    const A = this.acts;
    if (stun && !A.has('stun') && A.defs.stun) A.play('stun', 0, true);
    if (!stun && A.has('stun')) A.stop('stun');
    A.update(dt);
    let restW = 0;
    const L = A.list;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if ((a.d.rest || a.d.state) && a.w > restW) restW = a.w; }
    this.restW = restW; this.locoW = 1 - restW;
    this.flyT = (state.fly || this.spec.alwaysFly) && !this.dead && !this.isDown ? 1 : 0;
    this.fly += (this.flyT - this.fly) * (1 - Math.exp(-(this.flyT > this.fly ? 2.5 : (this.dead ? 5 : 3)) * dt));
    this.combat += ((state.combat ? 1 : 0) - this.combat) * (1 - Math.exp(-4 * dt));
    const sc = this.inst.scale, off = this.dead || this.isDown;
    const sp = state.speed, tu = state.turn, st = state.strafe;
    this._speed = off || sp === undefined ? 0 : sp / sc;
    this._turn = off || tu === undefined ? 0 : tu;
    this._strafe = off || st === undefined ? 0 : st / sc;
  }
  _fidget(dt, idle) {
    const F = this.spec.fidgets;
    if (!F || idle < 0.9 || this.dead || this.isDown || this.combat > 0.3 || this.acts.list.length) return;
    this.fidgetTimer -= dt;
    if (this.fidgetTimer > 0) return;
    const gap = this.k.fidgetGap;
    this.fidgetTimer = gap + Math.random() * gap * 1.3;
    let tot = 0; for (let i = 0; i < F.length; i++) tot += F[i].w;
    let r = Math.random() * tot;
    for (let i = 0; i < F.length; i++) { r -= F[i].w; if (r <= 0) { this.acts.play(F[i].name); break; } }
  }
  _look(dt, idle, combatK = 0.7) {
    const L = this.look;
    L.timer -= dt;
    if (L.timer <= 0) { L.timer = 1.5 + Math.random() * 3.5; L.ty = Math.random() < 0.3 ? 0 : (Math.random() - 0.5) * 1.3; L.tp = (Math.random() - 0.4) * 0.3; }
    const lookK = idle * (1 - this.combat * combatK);
    const k = 1 - Math.exp(-3 * dt);
    L.y += (L.ty * lookK - L.y) * k; L.p += (L.tp * lookK - L.p) * k;
  }
  _wings(dt, P) {
    const K = this.k; if (!K.hasWings) return;
    const b = this.b, fl = Math.max(this.fly, this.flap);
    this.wt += dt * TAU * mix(K.wIdleF, K.wFlapF, fl);
    const beat = Math.sin(this.wt), beat2 = Math.sin(this.wt - 1.1);
    const amp = mix(K.wIdleAmp, K.wAmp, fl);
    const spread = this.wingSpread + fl * K.wFlySpread;
    const fold = K.wFold * (1 - clamp01(spread + fl)) * (1 - this.combat * 0.3);
    const wl = b.wingL, wr = b.wingR;
    if (wl) {
      P.rot(wl[0], -0.25 * fl * beat - K.wTilt * (1 - fl), fold - spread * 0.35 + 0.075 * fl * beat2, -(amp * beat + spread * K.wLift));
      if (wl.length > 1) P.rot(wl[1], 0, fold * K.wFold2 - spread * 0.4, -(amp * 0.55 * beat2 + spread * 0.2));
    }
    if (wr) {
      P.rot(wr[0], -0.25 * fl * beat - K.wTilt * (1 - fl), -(fold - spread * 0.35 + 0.075 * fl * beat2), amp * beat + spread * K.wLift);
      if (wr.length > 1) P.rot(wr[1], 0, -(fold * K.wFold2 - spread * 0.4), amp * 0.55 * beat2 + spread * 0.2);
    }
    this.wingBeat = beat;
  }
  _uniforms() {
    const u = this.u;
    u.uHackle.value = this.hackle;
    u.uFlame.value = this.flame;
    u.uEmisK.value = this.glow;
    u.uGlowAdd.value = this.charge * this.k.chargeK;
    this.charge = 0;
  }
}

// ================================================================================================ biped
/**
 * spec: { bones: { hips, spine, chest, neck?, head, jaw?, tail?:[], ears?:[L,R], armL:[up, lo, hand], armR, wingL?:[w1,w2], wingR? },
 *         gait (Gait cfg), arm: {...}, lean: {walk, run, combat}, twist, waddle, crouch, breathe, tailLift, tailFly, airPaw,
 *         wings: { flapF, amp, fold, ... }, flyH (hover height, model units), flyBob, flyLean, alwaysFly, chargeK,
 *         actions, fidgets, fidgetGap, pose(ctl, dt) (before actions), post(ctl, dt) (after actions) }
 */
export class BipedCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec, 'biped');
    this.gait = new Gait(this.pose, spec.gait);
  }
  update(dt, state = EMPTY) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec, G = this.gait, K = this.k;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed, turn = this._turn, strafe = this._strafe;
    this.speedSm += (speed - this.speedSm) * (1 - Math.exp(-6 * dt));
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    const asp = Math.abs(this.speedSm);
    this.run = sstep(K.runV0, K.runV1, asp);
    const fly = this.fly;
    this.air = Math.max(fly, this.air * Math.exp(-10 * dt));
    const lw = this.locoW * (1 - fly * 0.95);
    P.reset();
    G.update(dt, speed * lw, turn * lw, strafe * lw);
    const act = G.act * (1 - fly), idle = 1 - clamp01(act * 1.5), ph = G.phase * TAU, cph = Math.cos(ph), sph = Math.sin(ph);
    this.flap = Math.max(0, this.flap - dt * 2.5);
    // ---------- pelvis & spine ----------
    const breath = Math.sin(this.t * TAU * mix(0.3, 0.8, Math.max(this.run, this.combat * 0.4)));
    const flyLean = fly * clamp01(asp / 4) * K.flyLean;
    const lean = K.leanWalk * clamp01(asp / 1.5) * (1 - this.run) + K.leanRun * this.run + K.leanCombat * this.combat;
    const twA = K.twist * act, wad = K.waddle * act;
    G.adaptBody(dt, false);
    const hov = fly * (K.flyH + Math.sin(this.wt) * K.flyBob);
    P.move(b.hips, G.sway * (1 - fly), (G.bob - K.crouch * this.combat - 0.02 * this.run) * (1 - fly) + G.gOff + hov, 0);
    P.rot(b.hips, G.pitch - lean * 0.3 - flyLean, -twA * cph, G.roll + wad * sph + this.turnSm * clamp01(asp / 3) * (0.08 + fly * 0.25));
    P.rot(b.spine, -lean * 0.4 + 0.015 * breath, twA * 0.6 * cph, -wad * 0.5 * sph);
    P.rot(b.chest, -lean * 0.3 - 0.01 * breath, twA * 0.6 * cph, -(G.roll + wad * sph) * 0.5);
    P.sc[b.chest].setScalar(1 + breath * K.breathe);
    // ---------- look & head ----------
    this._look(dt, idle, 0.6);
    const lk = this.look;
    const headStab = (lean + flyLean - G.pitch) * 0.85;
    if (b.neck !== undefined) P.rot(b.neck, headStab * 0.4 + lk.p * 0.4, lk.y * 0.4 + this.turnSm * 0.1, 0);
    P.rot(b.head, headStab * (b.neck !== undefined ? 0.5 : 0.8) + lk.p * 0.6 + G.nod * (1 - fly), lk.y * 0.6 + this.turnSm * 0.12 - twA * 0.8 * cph, -(G.roll + wad * sph) * 0.3);
    // ---------- arms ----------
    const swing = (K.swing * act * (1 - this.run * 0.3) + K.runSwing * this.run * act) * this.locoW;
    const out = K.armOut + K.runOut * this.run + K.combatOut * this.combat + fly * K.flyOut;
    const elbow = K.elbow + K.runElbow * this.run + K.combatElbow * this.combat + fly * K.flyElbow;
    const up0 = K.combatUp * this.combat + 0.02 * breath + fly * K.flyUp;
    if (b.armL) { const fw = -cph; P.rot(b.armL[0], swing * fw + up0, 0, -out); P.rot(b.armL[1], elbow + Math.max(0, swing * fw) * 0.5, 0, 0); if (b.armL.length > 2) P.rot(b.armL[2], K.wrist, 0, 0); }
    if (b.armR) { const fw = cph * K.weaponSwing; P.rot(b.armR[0], swing * fw + up0, 0, out); P.rot(b.armR[1], elbow + Math.max(0, swing * fw) * 0.5, 0, 0); if (b.armR.length > 2) P.rot(b.armR[2], K.wrist, 0, 0); }
    // ---------- tail / ears ----------
    const tl = b.tail;
    if (tl) { const n = tl.length, lift = (K.tailLift * this.run + fly * K.tailFly) / n - 0.05; for (let i = 0; i < n; i++) {
      const wv = Math.sin(this.t * 2.2 - i * 0.8) * (0.15 + 0.1 * i) * (1 - act * 0.5) + Math.sin(ph - i) * 0.15 * act;
      P.rot(tl[i], lift, wv - this.turnSm * 0.2 / n, 0);
    } }
    this.jaw = 0; this.ear = this.run * 0.5 + this.combat * 0.4; this.wingSpread = 0; this.glow = 1;
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    this._wings(dt, P);
    const ears = b.ears;
    if (ears) for (let i = 0; i < ears.length; i++) {
      const s = i === 0 ? 1 : -1, tw = Math.pow(Math.max(0, Math.sin(this.t * 1.9 + i * 2.3)), 30) * idle;
      P.rot(ears[i], this.ear * 0.6 + tw * 0.3, 0, s * (this.ear * 0.4 + tw * 0.3));
    }
    if (b.jaw !== undefined) P.rx(b.jaw, -this.jaw);
    P.fk();
    G.solve(P, this.air * this.locoW, K.airPaw);
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ quadruped
/**
 * spec: { bones: {body, hips, chest, neck, head, jaw, tail:[..], ears:[L,R], wingL?, wingR?}, gait,
 *         neck: {pitch, run, combat, walk, headCombat, comp, stab}, tail: {wag, wagF, run, combat, base},
 *         combatCrouch, combatPitch, runDrop, breathe, flyH, flyBob, wings, actions, fidgets, pose(ctl, dt), post(ctl, dt) }
 */
export class QuadCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec, 'quad');
    this.gait = new Gait(this.pose, spec.gait);
  }
  update(dt, state = EMPTY) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec, G = this.gait, K = this.k;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed, turn = this._turn, strafe = this._strafe;
    const k6 = 1 - Math.exp(-6 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k6;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    const asp = Math.abs(this.speedSm);
    this.run = sstep(K.runV0, K.runV1, asp);
    const walkK = clamp01(asp / 1.2);
    const fly = this.fly;
    this.air = Math.max(fly, this.air * Math.exp(-10 * dt));
    const lw = this.locoW * (1 - fly * 0.95);
    P.reset();
    G.update(dt, speed * lw, turn * lw, strafe * lw);
    const idle = 1 - clamp01(G.act * 1.5);
    this.flap = Math.max(0, this.flap - dt * 2.5);
    // ---------- body ----------
    const breath = Math.sin(this.t * TAU * mix(0.28, 0.9, Math.max(this.run, this.combat * 0.5)));
    P.sc[b.chest].setScalar(1 + breath * K.breathe);
    const crouch = K.combatCrouch * this.combat * (1 - this.run);
    const lean = clamp01(this.accel * 0.05) * 0.12 - clamp01(-this.accel * 0.05) * 0.1;
    G.adaptBody(dt);
    const hov = fly * (K.flyH + Math.sin(this.wt) * K.flyBob);
    P.move(b.body, G.sway, G.bob - crouch - this.run * K.runDrop + G.gOff + hov, 0);
    P.rot(b.body, G.pitch - lean * 0.5 + K.combatPitch * this.combat + G.gPitch, 0, G.roll + this.turnSm * clamp01(asp / 4) * 0.12 + G.gRoll);
    P.rx(b.chest, G.flex - crouch * 0.6);
    P.rx(b.hips, -G.flex * 0.8);
    // ---------- look ----------
    this._look(dt, idle, 0.7);
    const L = this.look;
    // ---------- neck & head ----------
    const stab = -(G.pitch + G.flex) * K.nStab;
    const neckP = K.nPitch + K.nRun * this.run + K.nCombat * this.combat + K.nWalk * walkK * (1 - this.run);
    P.rot(b.neck, neckP + stab * 0.4 + L.p * 0.4, L.y * 0.45 + this.turnSm * 0.12, 0);
    P.rot(b.head, stab * 0.6 + G.nod + L.p * 0.6 - neckP * K.nComp + K.nHeadCombat * this.combat, L.y * 0.55 + this.turnSm * 0.1, -L.y * 0.25);
    // ---------- tail ----------
    const tl = b.tail;
    if (tl) {
      const n = tl.length;
      const wagA = K.tWag * idle * (1 - this.combat) + 0.08 * G.act;
      const pitch0 = -(K.tRun * this.run + K.tCombat * this.combat) / n + (G.pitch * 0.5) / n + K.tBase / n;
      for (let i = 0; i < n; i++) {
        const ph = this.t * TAU * K.tWagF - i * 0.9;
        const sway = Math.sin(ph) * wagA * (0.6 + i * 0.3) + Math.sin(G.phase * TAU * 2 - i) * 0.1 * G.act;
        P.rot(tl[i], pitch0 + Math.sin(this.t * 2.1 - i) * 0.03, sway + this.turnSm * 0.15, 0);
      }
    }
    this.jaw = 0; this.ear = this.run * 0.6 + this.combat * 0.5; this.wingSpread = 0; this.glow = 1;
    this.hackle = mix(this.hackle, this.combat, 1 - Math.exp(-5 * dt));
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    this._wings(dt, P);
    const ears = b.ears;
    if (ears) for (let i = 0; i < ears.length; i++) {
      const s = i === 0 ? 1 : -1;
      const tw = Math.pow(Math.max(0, Math.sin(this.t * 1.7 + i * 2.1)), 40) * 0.5 * idle;
      P.rot(ears[i], this.ear * 0.8 + tw * 0.3, 0, s * (this.ear * 0.3 + tw * 0.25));
    }
    if (b.jaw !== undefined) P.rx(b.jaw, -this.jaw);
    P.fk();
    G.solve(P, this.air * this.locoW, K.airPaw);
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ hover (no legs)
/**
 * Floating creatures (robed casters, wraiths, wisps): the root bone hovers with a slow bob, leans into motion and banks
 * into turns; trailing bones (robe/cloak/tail chains) follow with damped lag.
 * spec: { bones: { root, spine?, chest?, head, jaw?, armL?, armR?, trail?: [[bone…]…] }, bob, bobF, lean (number), bank,
 *         trailK, flutter, runV, headLean, arm: { up, out, elbow, combatUp, combatElbow, trail }, pose, post }
 */
export class HoverCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec, 'hover');
    this.gait = null;
    this.lag = new Float32Array(8); this.lagV = new Float32Array(8);
  }
  update(dt, state = EMPTY) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec, K = this.k;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed * this.locoW, turn = this._turn * this.locoW;
    const k6 = 1 - Math.exp(-4 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k6;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-3 * dt));
    const asp = Math.abs(this.speedSm);
    this.run = clamp01(asp / K.runVh);
    const moveK = clamp01(asp / 1.5);
    const idle = 1 - moveK;
    P.reset();
    const bob = Math.sin(this.t * TAU * K.bobF) * K.bob;
    P.move(b.root, Math.sin(this.t * 0.9) * 0.015, bob * this.locoW, 0);
    P.rot(b.root, -K.hLean * moveK * Math.sign(this.speedSm) - clamp01(this.accel * 0.1) * 0.1, 0, this.turnSm * K.bank);
    // trailing chains: damped springs driven by speed, acceleration & turning
    const tr = b.trail;
    if (tr) {
      const drive = this.speedSm * K.trailK + this.accel * 0.02, fl = K.flutter;
      for (let c = 0; c < tr.length && c < 8; c++) {
        const target = drive + Math.sin(this.t * 2.1 + c) * 0.04;
        this.lagV[c] += ((target - this.lag[c]) * 40 - this.lagV[c] * 7) * dt; this.lag[c] += this.lagV[c] * dt;
        const ch = tr[c], n = ch.length;
        for (let i = 0; i < n; i++) P.rot(ch[i], (this.lag[c] + Math.sin(this.t * 2.6 - i * 0.9 + c) * fl) * (0.6 + i * 0.25), -this.turnSm * 0.1 * (i + 1) / n, Math.sin(this.t * 1.7 - i + c * 2) * fl * 0.6);
      }
    }
    this._look(dt, idle, 0.5);
    const L = this.look;
    if (b.spine !== undefined) P.rx(b.spine, 0.02 * Math.sin(this.t * 1.3));
    P.rot(b.head, L.p * 0.6 + K.headLean * moveK, L.y * 0.6 + this.turnSm * 0.15, 0);
    const up = K.armUp + K.combatUp * this.combat - K.armTrail * moveK, out = K.armOut + 0.1 * this.combat, el = K.elbow + K.combatElbow * this.combat;
    if (b.armL) { P.rot(b.armL[0], up + Math.sin(this.t * 1.1 + 2) * 0.06, 0, -out); P.rot(b.armL[1], el, 0, 0); }
    if (b.armR) { P.rot(b.armR[0], up + Math.sin(this.t * 1.1) * 0.06, 0, out); P.rot(b.armR[1], el, 0, 0); }
    this.jaw = 0; this.glow = 1;
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    if (b.jaw !== undefined) P.rx(b.jaw, -this.jaw);
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ helpers for actions
/** Legs carried rigidly by the body (lying, flung, rising from the ground). bend pulls feet toward the hip; back (×hip
 *  height) pushes them toward the body's back so a body lying on its back rests its feet on the ground. */
export function legsLocal(ctl, w, bend = 0.1, spread = 1.15, up = 0, back = 0) {
  const G = ctl.gait; if (!G) return;
  const legs = G.legs;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    const hip = ctl.pose.rest[L.idx[0]];
    L.override.set(L.toe.x * spread, L.toe.y + (hip.y - L.toe.y) * bend + up, L.toe.z + (hip.z - L.toe.z) * bend * 0.5 + back * hip.y);
    L.overrideLocal = true; L.overridePaw = -0.3;
    if (w > L.overrideW) L.overrideW = w;
  }
}
/** Feet pinned to world-ish positions (model space): home * spread, forward offset dz. */
export function legsPlant(ctl, w, spread = 1.2, dz = 0) {
  const G = ctl.gait; if (!G) return;
  const legs = G.legs;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    L.override.set(L.home.x * spread, 0, L.home.z + dz); L.overrideLocal = false;
    if (w > L.overrideW) L.overrideW = w;
  }
}
export function armRot(ctl, side, up, lo, w, out = 0, twist = 0) {
  const arm = side < 0 ? ctl.b.armL : ctl.b.armR, P = ctl.pose;
  if (!arm) return;
  P.rot(arm[0], up * w, twist * w, side * out * w);
  P.rot(arm[1], lo * w, 0, 0);
}
export const ease = {
  out: (x) => 1 - (1 - clamp01(x)) * (1 - clamp01(x)),
  in: (x) => clamp01(x) * clamp01(x),
  io: (x) => { x = clamp01(x); return x * x * (3 - 2 * x); },
  back: (x) => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};
export { sstep, clamp01, mix, TAU };
