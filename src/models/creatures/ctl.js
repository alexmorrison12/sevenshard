// Creature controllers (adapted copies of kit/quadruped.js + kit/biped.js, extended for SEVENSHARD's contract):
//   - Actions: layered one-shots with { dur, loop } stretching, hit timing, holds, cross-fades on restart.
//   - BaseCtl: shared state machine — dead / down (knockdown…getup) / stunned (loop) / fly / spawn / revive.
//   - BipedCtl (legs IK + FK arms + optional bat wings & flight), QuadCtl (4-leg gait), HoverCtl (floating, no legs).
// Every per-frame path is allocation-free (indexed loops, scratch vectors).
import * as THREE from 'three';
import { Gait } from './gait2.js';
import { sstep, clamp01, mix, TAU, env } from '../kit/rig.js';

const NOINFO = { dur: 0 };

// ================================================================================================ actions
export class Actions {
  constructor(ctl, defs) { this.ctl = ctl; this.defs = defs; this.list = []; this.last = null; }
  info(name, speed) {
    const d = this.defs[name], base = d.dur ?? 1;
    const o = { dur: base / speed };
    if (d.hit !== undefined) o.hit = d.hit * base / speed;
    if (d.hits) o.hits = d.hits.map(h => h * base / speed);
    return o;
  }
  play(name, dur, loop) {
    const d = this.defs[name];
    if (!d) return null;
    const base = d.dur ?? 1;
    const speed = dur > 0 ? base / dur : (d.speed ?? 1);
    loop = loop ?? d.loop ?? false;
    const L = this.list;
    let old = null;
    for (let i = 0; i < L.length; i++) if (L[i].name === name && !L[i].out) { old = L[i]; break; }
    if (old && d.hold) { this.last = old; return this.info(name, old.speed); }
    if (d.excl) for (let i = 0; i < L.length; i++) { const x = L[i]; const dx = x.d; if (x !== old && (dx.hold || dx.excl) && !dx.keep) x.out = true; }
    if (old) { old.out = true; old.fo = 0.12; } // restart: cross-fade the old instance out quickly
    const a = { name, d, t: 0, age: 0, k: 0, speed, w: 0, out: false, outT: 0, w0: undefined, fo: undefined, loop, seed: Math.random() * 100, done: false, u: {} };
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
      const a = L[i], d = a.d, dur = d.dur ?? 1;
      a.t += dt * a.speed; a.age += dt;
      if (a.loop && !d.hold && a.t >= dur && !a.out) a.t -= dur;
      a.k = Math.min(1, a.t / dur);
      if (a.out) { if (a.w0 === undefined) a.w0 = a.w; a.outT += dt; a.w = a.w0 * (1 - clamp01(a.outT / (a.fo ?? d.fadeOut ?? 0.3))); }
      else if (d.hold || a.loop) a.w = Math.max(a.w, clamp01(a.age / (d.fadeIn ?? 0.2)));
      else a.w = Math.max(env(a.k, d.a ?? 0.12, d.d ?? 0.8), a.age < 0.1 ? a.w : 0);
      if (!d.hold && !a.loop && a.k >= 1 && !a.out) a.done = true;
    }
    let j = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.done && !(a.out && a.w <= 0.001)) L[j++] = a; }
    L.length = j;
  }
  apply() { const L = this.list; for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.w > 0) a.d.fn(this.ctl, a, a.w); } }
}

// ================================================================================================ base
export class BaseCtl {
  constructor(inst, spec) {
    this.inst = inst; this.pose = inst.pose; this.spec = spec;
    const P = this.pose, b = {};
    const map = (v) => Array.isArray(v) ? v.map(map) : P.b[v];
    for (const k in spec.bones) b[k] = map(spec.bones[k]);
    this.b = b;
    this.acts = new Actions(this, spec.actions || {});
    this.t = Math.random() * 100;
    this.H = inst.entry.height;             // model-space height
    this.dead = false; this.isDown = false;
    this.combat = 0; this.run = 0; this.turnSm = 0; this.speedSm = 0; this.accel = 0;
    this.air = 0; this.fly = 0; this.flyT = 0; this.locoW = 1; this.restW = 0;
    this.jaw = 0; this.ear = 0; this.hackle = 0; this.glow = 1; this.flame = 1; this.charge = 0; this.wingSpread = 0; this.flap = 0; this.wt = Math.random() * 10;
    this.look = { y: 0, p: 0, ty: 0, tp: 0, timer: 1 + Math.random() * 3 };
    this.fidgetTimer = 3 + Math.random() * 5;
    this._sd = false; this._sdown = false;
    this.state = {};
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
  /** state transitions shared by every controller; returns effective [speed, turn] in model units */
  _state(state, dt) {
    this.state = state;
    if (state.dead && !this.dead) this.play('death');
    if (this._sd && !state.dead && this.dead) this.play('revive');
    this._sd = !!state.dead;
    if (!this.dead) {
      if (state.down && !this.isDown) this.play('knockdown');
      if (this._sdown && !state.down && this.isDown) this.play('getup');
    }
    this._sdown = !!state.down;
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
    const sc = this.inst.scale;
    this._speed = this.dead || this.isDown ? 0 : (state.speed ?? 0) / sc;
    this._turn = this.dead || this.isDown ? 0 : (state.turn ?? 0);
    this._strafe = this.dead || this.isDown ? 0 : (state.strafe ?? 0) / sc;
  }
  _fidget(dt, idle) {
    const F = this.spec.fidgets;
    if (!F || idle < 0.9 || this.dead || this.isDown || this.combat > 0.3 || this.acts.list.length) return;
    this.fidgetTimer -= dt;
    if (this.fidgetTimer > 0) return;
    this.fidgetTimer = (this.spec.fidgetGap ?? 4) + Math.random() * (this.spec.fidgetGap ?? 4) * 1.3;
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
    const W = this.spec.wings; if (!W) return;
    const b = this.b, fl = Math.max(this.fly, this.flap);
    const f = mix(W.idleF ?? 0.5, W.flapF ?? 6, fl);
    this.wt += dt * TAU * f;
    const beat = Math.sin(this.wt), beat2 = Math.sin(this.wt - 1.1);
    const amp = mix(W.idleAmp ?? 0.06, W.amp ?? 0.8, fl);
    const spread = this.wingSpread + fl * (W.flySpread ?? 0.3);
    const fold = (W.fold ?? 0.3) * (1 - clamp01(spread + fl)) * (1 - this.combat * 0.3);
    for (let s = -1; s <= 1; s += 2) {
      const w = s < 0 ? b.wingL : b.wingR; if (!w) continue;
      P.rot(w[0], -0.25 * fl * beat - (W.tilt ?? 0) * (1 - fl), -s * (fold - spread * 0.35 + 0.25 * fl * beat2 * 0.3), s * (amp * beat + spread * (W.lift ?? 0.35)));
      if (w[1] !== undefined) P.rot(w[1], 0, -s * (fold * (W.fold2 ?? 1.2) - spread * 0.4), s * (amp * 0.55 * beat2 + spread * 0.2));
    }
    this.wingBeat = beat;
  }
  _uniforms() {
    const u = this.u;
    u.uHackle.value = this.hackle;
    u.uFlame.value = this.flame;
    u.uEmisK.value = this.glow;
    u.uGlowAdd.value = this.charge * (this.spec.chargeK ?? 0.3);
    this.charge = 0;
  }
}

// ================================================================================================ biped
/**
 * spec: { bones: { hips, spine, chest, neck?, head, jaw?, tail?:[], ears?:[L,R], armL:[up, lo, hand], armR, wingL?:[w1,w2], wingR? },
 *         gait (kit Gait cfg), arm: {...}, lean: {walk, run, combat}, twist, waddle, crouch, breathe, tailLift,
 *         wings: { flapF, amp, fold, ... }, flyH (hover height, model units), alwaysFly, actions, fidgets, pose(ctl, dt) }
 */
export class BipedCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = new Gait(this.pose, spec.gait);
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec, G = this.gait;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed, turn = this._turn, strafe = this._strafe;
    const k6 = 1 - Math.exp(-6 * dt);
    this.speedSm += (speed - this.speedSm) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    const gs = spec.gait.gaits;
    this.run = sstep(gs[0].v * 1.2, gs[gs.length - 1].v, Math.abs(this.speedSm));
    const fly = this.fly;
    this.air = Math.max(fly, this.air + (0 - this.air) * (1 - Math.exp(-10 * dt)));
    const lw = this.locoW * (1 - fly * 0.95);
    P.reset();
    G.update(dt, speed * lw, turn * lw, strafe * lw);
    const act = G.act * (1 - fly), idle = 1 - clamp01(act * 1.5), ph = G.phase * TAU;
    this.flap = Math.max(0, this.flap - dt * 2.5);
    // ---------- pelvis & spine ----------
    const breath = Math.sin(this.t * TAU * mix(0.3, 0.8, Math.max(this.run, this.combat * 0.4)));
    const L = spec.lean || {};
    const flyLean = fly * clamp01(Math.abs(this.speedSm) / 4) * (spec.flyLean ?? 0.5);
    const lean = (L.walk ?? 0.1) * clamp01(Math.abs(this.speedSm) / 1.5) * (1 - this.run) + (L.run ?? 0.3) * this.run + (L.combat ?? 0.08) * this.combat;
    const twA = (spec.twist ?? 0.12) * act;
    const wad = (spec.waddle ?? 0) * act;
    G.adaptBody(dt, false);
    const hov = fly * ((spec.flyH ?? 1) + Math.sin(this.wt) * (spec.flyBob ?? 0.04));
    P.move(b.hips, G.sway * (1 - fly), (G.bob - (spec.crouch ?? 0.03) * this.combat - 0.02 * this.run) * (1 - fly) + G.gOff + hov, 0);
    P.rot(b.hips, G.pitch - lean * 0.3 - flyLean, -twA * Math.cos(ph), G.roll + wad * Math.sin(ph) + this.turnSm * clamp01(Math.abs(this.speedSm) / 3) * (0.08 + fly * 0.25));
    P.rot(b.spine, -lean * 0.4 + 0.015 * breath, twA * 0.6 * Math.cos(ph), -wad * 0.5 * Math.sin(ph));
    P.rot(b.chest, -lean * 0.3 - 0.01 * breath, twA * 0.6 * Math.cos(ph), -(G.roll + wad * Math.sin(ph)) * 0.5);
    P.sc[b.chest].setScalar(1 + breath * (spec.breathe ?? 0.015));
    // ---------- look & head ----------
    this._look(dt, idle, 0.6);
    const lk = this.look;
    const headStab = (lean + flyLean - G.pitch) * 0.85;
    if (b.neck !== undefined) P.rot(b.neck, headStab * 0.4 + lk.p * 0.4, lk.y * 0.4 + this.turnSm * 0.1, 0);
    P.rot(b.head, headStab * (b.neck !== undefined ? 0.5 : 0.8) + lk.p * 0.6 + G.nod * (1 - fly), lk.y * 0.6 + this.turnSm * 0.12 - twA * 0.8 * Math.cos(ph), -(G.roll + wad * Math.sin(ph)) * 0.3);
    // ---------- arms ----------
    const A = spec.arm || {};
    const swing = ((A.swing ?? 0.45) * act * (1 - this.run * 0.3) + (A.runSwing ?? 0.9) * this.run * act) * this.locoW;
    for (let s = -1; s <= 1; s += 2) {
      const arm = s < 0 ? b.armL : b.armR;
      if (!arm) continue;
      const fw = s * Math.cos(ph) * (s > 0 ? (A.weaponSwing ?? 1) : 1);
      const out = (A.out ?? 0.15) + (A.runOut ?? 0.1) * this.run + (A.combatOut ?? 0.1) * this.combat + fly * (A.flyOut ?? 0.3);
      const elbow = (A.elbow ?? 0.25) + (A.runElbow ?? 1.1) * this.run + (A.combatElbow ?? 0.4) * this.combat + fly * (A.flyElbow ?? 0.4);
      P.rot(arm[0], swing * fw + (A.combatUp ?? 0.2) * this.combat + 0.02 * breath + fly * (A.flyUp ?? 0.2), 0, s * out);
      P.rot(arm[1], elbow + Math.max(0, swing * fw) * 0.5, 0, 0);
      if (arm[2] !== undefined) P.rot(arm[2], (A.wrist ?? 0), 0, 0);
    }
    // ---------- tail / ears ----------
    if (b.tail) for (let i = 0; i < b.tail.length; i++) {
      const wv = Math.sin(this.t * 2.2 - i * 0.8) * (0.15 + 0.1 * i) * (1 - act * 0.5) + Math.sin(ph - i) * 0.15 * act;
      P.rot(b.tail[i], ((spec.tailLift ?? 0.1) * this.run + fly * (spec.tailFly ?? 0.2)) / b.tail.length - 0.05, wv - this.turnSm * 0.2 / b.tail.length, 0);
    }
    this.jaw = 0; this.ear = this.run * 0.5 + this.combat * 0.4; this.wingSpread = 0; this.glow = 1;
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    this._wings(dt, P);
    if (b.ears) for (let i = 0; i < b.ears.length; i++) {
      const s = i === 0 ? 1 : -1, tw = Math.pow(Math.max(0, Math.sin(this.t * 1.9 + i * 2.3)), 30) * idle;
      P.rot(b.ears[i], this.ear * 0.6 + tw * 0.3, 0, s * (this.ear * 0.4 + tw * 0.3));
    }
    if (b.jaw !== undefined) P.rx(b.jaw, -this.jaw);
    P.fk();
    G.solve(P, { air: this.air * this.locoW, airPaw: spec.airPaw ?? -0.3 });
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ quadruped
/**
 * spec: { bones: {body, hips, chest, neck, head, jaw, tail:[..], ears:[L,R]}, gait, neck: {pitch, run, combat, walk, headCombat, comp, stab},
 *         tail: {wag, wagF, run, combat}, combatCrouch, combatPitch, runDrop, breathe, actions, fidgets, pose(ctl, dt) }
 */
export class QuadCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = new Gait(this.pose, spec.gait);
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec, G = this.gait;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed, turn = this._turn, strafe = this._strafe;
    const k6 = 1 - Math.exp(-6 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k6;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-4 * dt));
    const gs = spec.gait.gaits;
    this.run = sstep(gs[1]?.v ?? 3, gs[gs.length - 1].v, Math.abs(this.speedSm));
    const walkK = clamp01(Math.abs(this.speedSm) / 1.2);
    const fly = this.fly;
    this.air = Math.max(fly, this.air + (0 - this.air) * (1 - Math.exp(-10 * dt)));
    const lw = this.locoW * (1 - fly * 0.95);
    P.reset();
    G.update(dt, speed * lw, turn * lw, strafe * lw);
    const idle = 1 - clamp01(G.act * 1.5);
    this.flap = Math.max(0, this.flap - dt * 2.5);
    // ---------- body ----------
    const breathF = mix(0.28, 0.9, Math.max(this.run, this.combat * 0.5));
    const breath = Math.sin(this.t * TAU * breathF);
    P.sc[b.chest].setScalar(1 + breath * (spec.breathe ?? 0.012));
    const crouch = (spec.combatCrouch ?? 0.05) * this.combat * (1 - this.run);
    const lean = clamp01(this.accel * 0.05) * 0.12 - clamp01(-this.accel * 0.05) * 0.1;
    G.adaptBody(dt);
    const hov = fly * ((spec.flyH ?? 1) + Math.sin(this.wt) * (spec.flyBob ?? 0.05));
    P.move(b.body, G.sway, G.bob - crouch - this.run * (spec.runDrop ?? 0.03) + G.gOff + hov, 0);
    P.rot(b.body, G.pitch - lean * 0.5 + (spec.combatPitch ?? -0.05) * this.combat + G.gPitch, 0, G.roll + this.turnSm * clamp01(Math.abs(this.speedSm) / 4) * 0.12 + G.gRoll);
    P.rx(b.chest, G.flex - crouch * 0.6);
    P.rx(b.hips, -G.flex * 0.8);
    // ---------- look ----------
    this._look(dt, idle, 0.7);
    const L = this.look;
    // ---------- neck & head ----------
    const N = spec.neck || {};
    const stab = -(G.pitch + G.flex) * (N.stab ?? 0.85);
    const neckP = (N.pitch ?? 0) + (N.run ?? -0.25) * this.run + (N.combat ?? -0.3) * this.combat + (N.walk ?? -0.05) * walkK * (1 - this.run);
    P.rot(b.neck, neckP + stab * 0.4 + L.p * 0.4, L.y * 0.45 + this.turnSm * 0.12, 0);
    P.rot(b.head, stab * 0.6 + G.nod + L.p * 0.6 - neckP * (N.comp ?? 0.6) + (N.headCombat ?? 0.15) * this.combat, L.y * 0.55 + this.turnSm * 0.1, -L.y * 0.25);
    // ---------- tail ----------
    if (b.tail) {
      const T = spec.tail || {};
      const n = b.tail.length;
      const wagA = (T.wag ?? 0.25) * idle * (1 - this.combat) + 0.08 * G.act;
      for (let i = 0; i < n; i++) {
        const ph = this.t * TAU * (T.wagF ?? 0.6) - i * 0.9;
        const sway = Math.sin(ph) * wagA * (0.6 + i * 0.3) + Math.sin(G.phase * TAU * 2 - i) * 0.1 * G.act;
        const pitch = -((T.run ?? 0.45) * this.run + (T.combat ?? 0.3) * this.combat) / n + Math.sin(this.t * 2.1 - i) * 0.03 + (G.pitch * 0.5) / n + (T.base ?? 0) / n;
        P.rot(b.tail[i], pitch, sway + this.turnSm * 0.15, 0);
      }
    }
    this.jaw = 0; this.ear = this.run * 0.6 + this.combat * 0.5; this.wingSpread = 0; this.glow = 1;
    this.hackle = mix(this.hackle, this.combat, 1 - Math.exp(-5 * dt));
    this._fidget(dt, idle);
    if (spec.pose) spec.pose(this, dt);
    this.acts.apply();
    if (spec.post) spec.post(this, dt);
    this._wings(dt, P);
    if (b.ears) for (let i = 0; i < b.ears.length; i++) {
      const s = i === 0 ? 1 : -1;
      const tw = Math.pow(Math.max(0, Math.sin(this.t * 1.7 + i * 2.1)), 40) * 0.5 * idle;
      P.rot(b.ears[i], this.ear * 0.8 + tw * 0.3, 0, s * (this.ear * 0.3 + tw * 0.25));
    }
    if (b.jaw !== undefined) P.rx(b.jaw, -this.jaw);
    P.fk();
    G.solve(P, { air: this.air * this.locoW });
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ hover (no legs)
/**
 * Floating creatures (robed casters, wraiths, wisps): the root bone hovers with a slow bob, leans into motion and banks
 * into turns; trailing bones (robe/cloak/tail chains) follow with damped lag.
 * spec: { bones: { root, spine?, chest?, head, jaw?, armL?, armR?, trail?: [[bone…]…] }, hoverH, bob, bobF, lean, bank, pose(ctl, dt) }
 */
export class HoverCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    this.lag = new Float32Array(8); this.lagV = new Float32Array(8);
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, spec = this.spec;
    this.t += dt;
    this._state(state, dt);
    const speed = this._speed * this.locoW, turn = this._turn * this.locoW;
    const k6 = 1 - Math.exp(-4 * dt);
    const prevS = this.speedSm;
    this.speedSm += (speed - this.speedSm) * k6;
    this.accel += (((this.speedSm - prevS) / Math.max(dt, 1e-4)) - this.accel) * k6;
    this.turnSm += (turn - this.turnSm) * (1 - Math.exp(-3 * dt));
    this.run = clamp01(Math.abs(this.speedSm) / (spec.runV ?? 4));
    const moveK = clamp01(Math.abs(this.speedSm) / 1.5);
    const idle = 1 - moveK;
    P.reset();
    const bob = Math.sin(this.t * TAU * (spec.bobF ?? 0.4)) * (spec.bob ?? 0.06);
    P.move(b.root, Math.sin(this.t * 0.9) * 0.015, bob * this.locoW, 0);
    P.rot(b.root, -(spec.lean ?? 0.25) * moveK * Math.sign(this.speedSm) - clamp01(this.accel * 0.1) * 0.1, 0, this.turnSm * (spec.bank ?? 0.12));
    // trailing chains: damped springs driven by speed, acceleration & turning
    const tr = b.trail;
    if (tr) {
      const drive = this.speedSm * (spec.trailK ?? 0.12) + this.accel * 0.02;
      for (let c = 0; c < tr.length && c < 8; c++) {
        const target = drive + Math.sin(this.t * 2.1 + c) * 0.04;
        this.lagV[c] += ((target - this.lag[c]) * 40 - this.lagV[c] * 7) * dt; this.lag[c] += this.lagV[c] * dt;
        const ch = tr[c];
        for (let i = 0; i < ch.length; i++) P.rot(ch[i], (this.lag[c] + Math.sin(this.t * 2.6 - i * 0.9 + c) * (spec.flutter ?? 0.05)) * (0.6 + i * 0.25), -this.turnSm * 0.1 * (i + 1) / ch.length, Math.sin(this.t * 1.7 - i + c * 2) * (spec.flutter ?? 0.05) * 0.6);
      }
    }
    this._look(dt, idle, 0.5);
    const L = this.look;
    if (b.spine !== undefined) P.rx(b.spine, 0.02 * Math.sin(this.t * 1.3));
    P.rot(b.head, L.p * 0.6 + (spec.headLean ?? 0.2) * moveK, L.y * 0.6 + this.turnSm * 0.15, 0);
    const A = spec.arm || {};
    for (let s = -1; s <= 1; s += 2) {
      const arm = s < 0 ? b.armL : b.armR; if (!arm) continue;
      const sw = Math.sin(this.t * 1.1 + (s > 0 ? 0 : 2)) * 0.06;
      P.rot(arm[0], (A.up ?? 0.2) + sw + (A.combatUp ?? 0.3) * this.combat - (A.trail ?? 0.4) * moveK, 0, s * ((A.out ?? 0.2) + 0.1 * this.combat));
      P.rot(arm[1], (A.elbow ?? 0.5) + (A.combatElbow ?? 0.4) * this.combat, 0, 0);
    }
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
const _ov = new THREE.Vector3();
/** Legs carried rigidly by the body (lying, flung, rising from the ground). bend pulls feet toward the hip. */
export function legsLocal(ctl, w, bend = 0.1, spread = 1.15, up = 0, back = 0) {
  const G = ctl.gait; if (!G) return;
  const legs = G.legs;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    L.override = L.override || new THREE.Vector3();
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
    L.override = L.override || new THREE.Vector3();
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
