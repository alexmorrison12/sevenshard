// Procedural layered animation for heroes (evolved from Everdawn's humanoid animator).
// Poses are per-bone Euler angles authored in "neutral" frames (arms/legs hanging straight down, frames aligned
// with the character: X right, Y up, Z back, facing -Z). Legs are driven by foot targets + analytic IK.
// Big weapon moves are authored as weapon trajectories (Pose.wR / wL) and solved with arm IK + wrist orientation.
// Sign conventions: torso/head x<0 bends forward, y>0 turns left, z>0 leans left.
//   arms: x>0 swings forward, abduction = sg*z (sg=+1 right, -1 left), internal twist = sg*y; elbow x>0 flexes.
//   legs: thigh x>0 swings forward; knee x<0 flexes; foot x>0 toes up.
//
// Layers: idle → combat ready (weapon hold) → locomotion (walk/run, turn lean) → states (stun, sit, mount, down)
//         → action (one-shot / loop / hold; full body when standing, upper body when moving) → hit flinch → death.
// dt may be 0 (hit-stop): nothing advances, the pose holds.
import * as THREE from 'three';
import { BONES, B, NB, PARENTS, UPPER_MASK, ARM_MASK } from './rig.js';
import { clamp, lerp, smoothstep, damp } from '../../core/noise.js';
import { resolveMove, holdPose, runArms } from './moves.js';
import { deathPose, downPose } from './poses.js';
import { Pose, setArm, setFingers, setClav, stance } from './pose.js';
export { Pose };

const XZY = 1, YXZ = 0, EXP = 2;
export const ORDER = BONES.map(n => /^(uarm|thigh)/.test(n) ? EXP : /^(farm|hand|idx|fng|thb|shin|foot|toe|cape|hair|braid|beard|clav|skirt)/.test(n) ? XZY : YXZ);

// ---- math --------------------------------------------------------------------------------------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qy = new THREE.Quaternion();
export function eulerQuat(q, x, y, z, order) {
  if (order === EXP) {
    const a = Math.sqrt(x * x + z * z);
    let ax = 0, az = 0, cw = 1;
    if (a > 1e-7) { const sa = Math.sin(a / 2) / a; ax = x * sa; az = z * sa; cw = Math.cos(a / 2); }
    const sy = Math.sin(y / 2), cy = Math.cos(y / 2);
    q.x = ax * cy - az * sy; q.y = cw * sy; q.z = az * cy + ax * sy; q.w = cw * cy;
    return q;
  }
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  if (order === XZY) {
    q.x = s1 * c2 * c3 - c1 * s2 * s3; q.y = c1 * s2 * c3 - s1 * c2 * s3; q.z = c1 * c2 * s3 + s1 * s2 * c3; q.w = c1 * c2 * c3 + s1 * s2 * s3;
  } else {
    q.x = s1 * c2 * c3 + c1 * s2 * s3; q.y = c1 * s2 * c3 - s1 * c2 * s3; q.z = c1 * c2 * s3 - s1 * s2 * c3; q.w = c1 * c2 * c3 + s1 * s2 * s3;
  }
  return q;
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3(), _v8 = new THREE.Vector3(), _v9 = new THREE.Vector3(), _v10 = new THREE.Vector3(), _v11 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qf = new THREE.Quaternion();
const _lv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _eul = new THREE.Euler();
const _lq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
function basisQuat(q, X, Y, Z) { _m.makeBasis(X, Y, Z); return q.setFromRotationMatrix(_m); }

class Spring {
  constructor(k = 60, c = 9) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(target, dt, ext = 0) {
    if (dt <= 0) return this.x;
    const n = Math.max(1, Math.ceil(dt / 0.012)); const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (this.k * (target - this.x) - this.c * this.v + ext) * h; this.x += this.v * h; }
    return this.x;
  }
}

const LIDS = [B.lidL, B.lidR];
const LEGS_MASK = new Float32Array(NB);
for (const n of ['thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR', 'hips']) LEGS_MASK[B[n]] = 1;

// ================================================================================================
export class Animator {
  constructor(c) {
    this.c = c;
    const base = c.base, J = base.joints, P = base.P;
    const jv = (n) => new THREE.Vector3(J[B[n] * 3], J[B[n] * 3 + 1], J[B[n] * 3 + 2]);
    this.rig = {
      hips: jv('hips'), hipOffL: jv('thighL').sub(jv('hips')), hipOffR: jv('thighR').sub(jv('hips')),
      L1: base.JJ.thighLen, L2: base.JJ.shinLen, ankleH: J[B.footL * 3 + 1],
      stanceX: Math.abs(J[B.thighL * 3]) * 1.08, legLen: base.JJ.thighLen + base.JJ.shinLen,
      height: base.height, sex: P.sex,
      toeZ: J[B.toeL * 3 + 2] - J[B.footL * 3 + 2],
      bodyScale: base.scale, shX: P.shX, shY: P.shY, hs: P.headDef.s, torso: J[B.neck * 3 + 1] - J[B.hips * 3 + 1],
      shoulderY: J[B.uarmR * 3 + 1], chestY: J[B.chest * 3 + 1], hipY: J[B.hips * 3 + 1], headY: J[B.head * 3 + 1],
      chin: [J[B.head * 3] - J[B.chest * 3], J[B.head * 3 + 1] - J[B.chest * 3 + 1], J[B.head * 3 + 2] - J[B.chest * 3 + 2]],
      arm: 0,
    };
    this.N = []; this.Npi = [];
    for (let i = 0; i < NB; i++) this.N.push(new THREE.Quaternion(base.N[i * 4], base.N[i * 4 + 1], base.N[i * 4 + 2], base.N[i * 4 + 3]));
    for (let i = 0; i < NB; i++) this.Npi.push(PARENTS[i] >= 0 ? this.N[PARENTS[i]].clone().invert() : new THREE.Quaternion());
    this.bones = c.bones;
    const dist = (a, b2) => Math.hypot(J[B[a] * 3] - J[B[b2] * 3], J[B[a] * 3 + 1] - J[B[b2] * 3 + 1], J[B[a] * 3 + 2] - J[B[b2] * 3 + 2]);
    this.armL1 = dist('uarmL', 'farmL'); this.armL2 = dist('farmL', 'handL');
    this.armR1 = dist('uarmR', 'farmR'); this.armR2 = dist('farmR', 'handR');
    this.rig.arm = this.armR1 + this.armR2;
    this.armIK = { L: { t: [0, 0, 0], pole: [0, 0, 0], w: 0 }, R: { t: [0, 0, 0], pole: [0, 0, 0], w: 0 } };
    this.palmOff = 0.075 * P.hand;
    // weapon info (set by the hero when weapons change): { kind, family, grip2, sockets }
    this.kind = 'none';
    this.grip2 = -0.15;
    this.gripR = null; this.gripL = null; // Object3D sockets on the hand bones
    // state
    this.t = 0; this.phase = 0; this.speed = 0; this.strafe = 0; this.moveW = 0; this.gait = 0;
    this.combatW = 0; this.sitW = 0; this.deadW = 0; this.deadT = 0; this.downW = 0; this.downT = 0; this.stunW = 0; this.mountW = 0;
    this.turnS = 0; this.lean = 0;
    this.action = null; this.prevAction = null; this.hitT = 9; this.hitDir = 1; this.hitK = 1;
    this.holdDown = false; // knocked down (held until getup)
    let rs = (c.opts?.seed ?? 12345) >>> 0;
    this.rand = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.blinkT = 2 + this.rand() * 3; this.blinkOn = 0;
    this.look = 0; this.lookT = 3; this.lookTarget = 0;
    this.seed = this.rand() * 100;
    this.cape = [new Spring(40, 7), new Spring(40, 7), new Spring(36, 6), new Spring(32, 5)];
    this.capeR = [new Spring(30, 6), new Spring(30, 6), new Spring(28, 5), new Spring(26, 5)];
    this.hair = [new Spring(55, 6), new Spring(45, 5), new Spring(40, 4.5)];
    this.hairR = [new Spring(50, 6), new Spring(45, 5), new Spring(40, 4.5)];
    this.braid = [new Spring(60, 6), new Spring(50, 5)];
    this.beard = [new Spring(70, 7), new Spring(60, 6)];
    this.skirt = [new Spring(70, 8), new Spring(60, 7), new Spring(70, 8), new Spring(60, 7)];
    this.prevVel = new THREE.Vector3(); this.accel = new THREE.Vector3();
    this.P = new Pose(); this.T1 = new Pose(); this.T2 = new Pose(); this.T3 = new Pose(); this.T4 = new Pose();
    this.ctx = { rig: this.rig, anim: this, kind: 'none', t: 0, drawn: false };
    this.onSheath = null; // callback(drawn:boolean)
    this.onProp = null;   // callback(prop:string|null, hand)
    this.prop = null;
    this.drawn = false; this.drawT = 9; this.drawTarget = false; this.inCombat = false;
    this.demon = 0;
  }

  // ---------------------------------------------------------------------------------------------
  /** play(name, { dur, loop, speed }) → { dur, hits } | null */
  play(name, o = {}) {
    if (name === 'hit' && !(this.action && this.action.def.stun)) { // additive flinch; does not interrupt the current move
      this.hitT = 0; this.hitDir = this.rand() < 0.5 ? -1 : 1; this.hitK = 1;
      return { dur: 0.35, hits: [] };
    }
    const def = resolveMove(name, this.kind, this);
    if (!def) return null;
    const dur = Math.max(0.05, o.dur ?? def.dur ?? 1);
    const loop = o.loop ?? !!def.loop;
    if (def.draw !== false && !this.drawn && this.kind !== 'none' && (def.attack || def.draw)) this.forceDraw(true);
    if (def.sheath && this.drawn) this.forceDraw(false);
    if ((def.prop || null) !== this.prop) { this.prop = def.prop || null; this.onProp?.(this.prop, def.propHand || 'R'); }
    if (name === 'knockdown') this.holdDown = true;
    if (name === 'getup' || name === 'revive' || name === 'dash' || name === 'dash_back') this.holdDown = false;
    const prev = this.action;
    this.action = { name, def, t: 0, dur, loop, w: 0, stopping: false, hold: !!def.hold && !loop, prevW: prev ? prev.w : 0 };
    // cross-fade: keep the previous action's final pose for a short blend
    if (prev && prev.w > 0.05) { this.prevAction = prev; this.prevAction.fade = 1; } else this.prevAction = null;
    const hits = (def.hits || []).map(h => h * dur);
    return { dur, hits };
  }
  stop() {
    if (this.action) this.action.stopping = true;
  }
  forceDraw(on) {
    this.drawn = on; this.drawTarget = on; this.drawT = 9; this.onSheath?.(on);
  }

  // ---------------------------------------------------------------------------------------------
  update(dt, s = {}) {
    dt = Math.max(0, Math.min(dt, 0.1));
    this.t += dt; const t = this.t;
    const ctx = this.ctx; ctx.t = t; ctx.kind = this.kind; ctx.drawn = this.drawn; ctx.dt = dt;
    const speed = s.speed || 0, strafe = s.strafe || 0;
    const mv = Math.hypot(speed, strafe);
    const dead = !!s.dead;
    this.speed = damp(this.speed, speed, 12, dt); this.strafe = damp(this.strafe, strafe, 12, dt);
    const smv = Math.hypot(this.speed, this.strafe);
    this.moveW = damp(this.moveW, mv > 0.2 ? 1 : 0, 10, dt);
    this.gait = damp(this.gait, smoothstep(2.4, 4.6, mv), 6, dt);
    this.inCombat = !!s.combat;
    this.combatW = damp(this.combatW, s.combat || (this.action && this.action.def.attack) ? 1 : 0, 7, dt);
    this.sitW = damp(this.sitW, s.sit && mv < 0.1 ? 1 : 0, 5, dt);
    this.mountW = damp(this.mountW, s.mounted ? 1 : 0, 8, dt);
    this.stunW = damp(this.stunW, s.stunned && !dead ? 1 : 0, 10, dt);
    const down = (!!s.down || this.holdDown) && !dead;
    if (down) this.downT += dt; else this.downT = 0;
    this.downW = damp(this.downW, down && !(this.action && this.action.name === 'knockdown') ? 1 : 0, 6, dt);
    if (dead) this.deadT += dt; else this.deadT = 0;
    this.deadW = dead ? 1 : damp(this.deadW, 0, 3, dt);
    this.turnS = damp(this.turnS, clamp(s.turn || 0, -8, 8), 6, dt);
    // weapon draw / sheathe (idle ↔ combat)
    const wantDrawn = !!(s.combat || (this.action && this.action.def.attack));
    if (wantDrawn !== this.drawn && this.drawT > 0.4 && wantDrawn !== this.drawTarget) { this.drawT = 0; this.drawTarget = wantDrawn; }
    if (this.drawT < 0.4) { this.drawT += dt; if (this.drawT >= 0.2 && this.drawn !== this.drawTarget) { this.drawn = this.drawTarget; this.onSheath?.(this.drawn); } }
    else this.drawT += dt;
    ctx.drawn = this.drawn;
    // gait phase
    const R = this.rig;
    const legK = Math.sqrt(R.legLen / 0.87);
    const period = lerp(1.06, 0.66, this.gait) * legK;
    const cad = smv > 0.05 ? 1 / period : 0;
    const turnStep = Math.abs(s.turn || 0) > 1.2 && mv < 0.2 ? 0.9 : 0;
    this.phase = (this.phase + dt * Math.max(cad, turnStep)) % 1;
    this.turnW = damp(this.turnW || 0, turnStep ? 1 : 0, 6, dt);

    // ---------------- build pose ----------------
    this.armIK.L.w = 0; this.armIK.R.w = 0;
    const P = this.P.clear();
    idlePose(P, t, dt, ctx, this);
    if (this.combatW > 0.01) { this.T1.copy(P); combatIdle(this.T1, t, ctx, this); P.lerp(this.T1, this.combatW); }
    if (this.turnW > 0.01 && this.moveW < 0.5) { locoPose(this.T1.clear(), ctx, this, 0.9, (s.turn || 0) > 0 ? -Math.PI / 2 : Math.PI / 2, 0.25); P.lerp(this.T1, this.turnW * 0.7, LEGS_MASK); }
    if (this.moveW > 0.01) {
      this.T1.copy(P);
      locoPose(this.T1, ctx, this, Math.max(smv, 1.2), Math.atan2(this.strafe, this.speed), 1);
      P.lerp(this.T1, this.moveW);
    }
    // turn lean (into the turn), head leads
    const leanT = clamp(-this.turnS * smv * 0.028, -0.32, 0.32) * this.moveW;
    this.lean = damp(this.lean, leanT, 8, dt);
    if (Math.abs(this.lean) > 1e-4) { P.add(B.hips, 0, 0, this.lean * 0.6); P.add(B.spine, 0, 0, this.lean * 0.25); P.add(B.head, 0, clamp(this.turnS * 0.06, -0.3, 0.3), -this.lean * 0.4); }
    if (this.sitW > 0.01) { this.T1.copy(P); sitPose(this.T1, ctx, this); P.lerp(this.T1, this.sitW); }
    if (this.mountW > 0.01) { this.T1.copy(P); ridePose(this.T1, ctx, this); P.lerp(this.T1, this.mountW); }
    if (this.stunW > 0.01) { this.T1.copy(P); stunPose(this.T1, t, ctx, this); P.lerp(this.T1, this.stunW); }
    if (this.downW > 0.01) { this.T1.copy(P); downPose(this.T1, t, ctx, this); P.lerp(this.T1, this.downW); }
    // draw / sheathe gesture
    if (this.drawT < 0.4 && !this.action) { const k = Math.sin(this.drawT / 0.4 * Math.PI); drawGesture(this.T2.copy(P), ctx, this); P.lerp(this.T2, k * 0.85, UPPER_MASK); }
    // previous action fading out (cross-fade)
    const pa = this.prevAction;
    if (pa) {
      pa.fade = Math.max(0, pa.fade - dt / 0.12);
      if (pa.fade <= 0) this.prevAction = null;
      else { this.T3.copy(P); pa.def.fn(this.T3, pa.loop ? (pa.t / pa.dur) % 1 : Math.min(pa.t / pa.dur, 1), ctx, this, pa); P.lerp(this.T3, pa.fade * pa.w, this.moveW > 0.5 && !pa.def.move ? UPPER_MASK : null); }
    }
    // action
    if (this.action) {
      const a = this.action, d = a.def;
      a.t += dt;
      let u = a.t / a.dur;
      if (a.loop) { u = u % 1; if (a.stopping) a.w = Math.max(0, a.w - dt / 0.15); else a.w = Math.min(1, a.w + dt / Math.max(0.01, (d.blendIn ?? 0.1) * Math.min(a.dur, 1))); }
      else {
        if (a.stopping && !a.hold) a.w = Math.max(0, a.w - dt / 0.15);
        const bi = d.blendIn ?? 0.08, bo = d.blendOut ?? 0.82;
        const env = (a.prevW > 0.5 ? 1 : smoothstep(0, bi, u)) * (a.hold ? 1 : 1 - smoothstep(bo, 1, u));
        a.w = a.stopping && !a.hold ? Math.min(a.w, env) : env;
        if (u >= 1) { u = 1; if (!a.hold) { a.done = true; } }
      }
      if (a.done || (a.stopping && a.w <= 0.001)) { this.action = null; if (this.prop) { this.prop = null; this.onProp?.(null); } }
      else {
        this.T2.copy(P);
        d.fn(this.T2, u, ctx, this, a);
        const moving = this.moveW > 0.5 && !d.move && !d.full2;
        const w = a.w;
        this.armIK.L.w *= w; this.armIK.R.w *= w;
        P.lerp(this.T2, w, moving ? UPPER_MASK : null);
        if (d.face && w > 0.5) P.face = typeof d.face === 'function' ? d.face(u) : d.face;
      }
    }
    // hit flinch (additive)
    if (this.hitT < 0.4) {
      this.hitT += dt; const k = Math.sin(clamp(this.hitT / 0.32, 0, 1) * Math.PI) * (1 - this.hitT / 0.4) * this.hitK;
      P.add(B.chest, 0.24 * k, 0.12 * k * this.hitDir, 0.08 * k * this.hitDir); P.add(B.head, 0.25 * k, 0.15 * k * this.hitDir, 0); P.add(B.spine, 0.08 * k, 0, 0);
      P.hip[2] += 0.05 * k; P.hip[1] -= 0.02 * k; setClav(P, 'L', 0.15 * k); setClav(P, 'R', 0.15 * k); P.face = 1;
    }
    // death (overrides everything)
    if (this.deadW > 0.01) { this.T1.copy(P); deathPose(this.T1, ctx, this, this.deadT); P.lerp(this.T1, this.deadW); }
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkOn = 0.12; this.blinkT = 2.5 + this.rand() * 4; }
    if (this.blinkOn > 0) { this.blinkOn -= dt; if (P.face === 0) P.face = 1; else if (P.face === 2) P.face = 3; }
    if ((dead && this.deadT > 0.6) || (this.action && this.action.name === 'death' && this.action.t > 0.5)) P.face = 1;
    this.apply(P, dt, s);
    return P;
  }

  // ---------------- apply pose to bones (leg IK, weapon IK, secondary) ----------------
  apply(P, dt, s) {
    const bones = this.bones, R = this.rig;
    const yaw = P.yaw;
    _qy.setFromAxisAngle(_v1.set(0, 1, 0), yaw);
    const hb = bones[B.hips];
    hb.position.set(R.hips.x + P.hip[0], R.hips.y + P.hip[1], R.hips.z + P.hip[2]);
    if (yaw) hb.position.applyQuaternion(_qy);
    for (let i = 0; i < NB; i++) {
      eulerQuat(_q, P.r[i * 3], P.r[i * 3 + 1], P.r[i * 3 + 2], ORDER[i]);
      bones[i].quaternion.multiplyQuaternions(this.Npi[i], _q).multiply(this.N[i]);
    }
    if (yaw) hb.quaternion.premultiply(_qy);
    if (P.ikw > 0.01) this.solveLegs(P);
    // eyelids: blink / closed (face 1 or 3), otherwise open
    this.lidK = damp(this.lidK || 0, (P.face === 1 || P.face === 3) ? 1 : 0, 38, dt);
    for (const b of LIDS) { eulerQuat(_q, -1.0 * this.lidK, 0, 0, YXZ); bones[b].quaternion.multiplyQuaternions(this.Npi[b], _q).multiply(this.N[b]); }
    this.secondary(P, dt, s);
    // weapon-driven hands
    const mesh = this.c.mesh;
    let solved = false;
    if (P.wR[0] > 0.01 && this.gripR) { mesh.updateWorldMatrix(true, false); this.solveWeapon('R', P.wR, P.yaw); solved = true; }
    if (P.wL[0] > 0.01 && this.gripL) { if (!solved) mesh.updateWorldMatrix(true, false); this.solveWeapon('L', P.wL, P.yaw); }
    if (P.w2h > 0.02 && this.gripR && this.drawn) this.solveOffHand(P.w2h);
    this.solveArmRequests();
  }

  /** place a hand so that its weapon socket matches a pose-frame transform (arm IK + wrist orientation) */
  solveWeapon(side, W, yaw) {
    const mesh = this.c.mesh, sock = side === 'R' ? this.gripR : this.gripL;
    const w = clamp(W[0], 0, 1);
    // desired socket transform in world space
    const Pw = _lv[0].set(W[1], W[2], W[3]);
    const Qc = _lq[0].set(W[4], W[5], W[6], W[7]);
    if (yaw) { _qy.setFromAxisAngle(_lv[1].set(0, 1, 0), yaw); Pw.applyQuaternion(_qy); Qc.premultiply(_qy); }
    Pw.applyMatrix4(mesh.matrixWorld);
    mesh.getWorldQuaternion(_lq[1]);
    const Qw = _lq[2].multiplyQuaternions(_lq[1], Qc);
    const ws = _lv[2].setFromMatrixScale(mesh.matrixWorld).x || 1;
    // hand world rotation and wrist position
    const Qh = _lq[3].copy(Qw).multiply(_lq[4].copy(sock.quaternion).invert());
    const off = _lv[3].copy(sock.position).multiplyScalar(ws).applyQuaternion(Qh);
    const T = _lv[4].copy(Pw).sub(off);
    const pole = side === 'R' ? POLE_R : POLE_L;
    this.solveArm(side, T, pole, w);
    // wrist orientation
    const hand = this.bones[B['hand' + side]], farm = this.bones[B['farm' + side]];
    farm.updateWorldMatrix(true, false);
    farm.getWorldQuaternion(_lq[4]);
    const ql = _lq[4].invert().multiply(Qh);
    hand.quaternion.slerp(ql, w);
  }

  /** off hand grips the main-hand weapon at grip2 (along the weapon's +Y) */
  solveOffHand(w) {
    const socket = this.gripR;
    socket.updateWorldMatrix(true, false);
    const g2 = this.grip2v;
    const T = (g2 ? _v1.set(g2[0], g2[1], g2[2]) : _v1.set(0, this.grip2, 0)).applyMatrix4(socket.matrixWorld);
    const ws = _v4.setFromMatrixScale(socket.matrixWorld).x || 1;
    // left-hand socket frame: same blade axis, turned to wrap the handle from the other side
    socket.getWorldQuaternion(_qe);
    let Qw;
    if (this.grip2rot) { const r = this.grip2rot; Qw = _qe.multiply(_qf.setFromEuler(_eul.set(r[0], r[1], r[2]))).multiply(_qf.setFromAxisAngle(_v2.set(0, 1, 0), Math.PI)); }
    else Qw = _qe.multiply(_qf.setFromAxisAngle(_v2.set(0, 1, 0), Math.PI));
    const sockL = this.gripL;
    const Qh = _qd.copy(Qw).multiply(_qc.copy(sockL.quaternion).invert());
    const off = _v3.copy(sockL.position).multiplyScalar(ws).applyQuaternion(Qh);
    T.sub(off);
    this.solveArm('L', T, POLE_L2, w);
    const hand = this.bones[B.handL], farm = this.bones[B.farmL];
    farm.updateWorldMatrix(true, false);
    farm.getWorldQuaternion(_qc);
    hand.quaternion.slerp(_qc.invert().multiply(Qh), w);
  }

  /** generic arm IK. T: world-space wrist target (Vector3, may be modified). poleLocal: elbow direction in clavicle space. */
  solveArm(side, T, poleLocal, w, palmOff = 0) {
    const bones = this.bones;
    const bC = bones[B['clav' + side]], bU = bones[B['uarm' + side]], bF = bones[B['farm' + side]];
    bC.updateWorldMatrix(true, false);
    const S = _v2.setFromMatrixPosition(_m.multiplyMatrices(bC.matrixWorld, _m2.compose(bU.position, bU.quaternion, bU.scale)));
    const ws = _v4.setFromMatrixScale(bC.matrixWorld).x || 1;
    if (palmOff) { const toS = _v3.subVectors(S, T).normalize(); T.addScaledVector(toS, palmOff); }
    const L1 = (side === 'L' ? this.armL1 : this.armR1) * ws, L2 = (side === 'L' ? this.armL2 : this.armR2) * ws;
    const D = _v4.subVectors(T, S); let d = D.length();
    d = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999); D.normalize();
    const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    bC.getWorldQuaternion(_q3);
    const pole = _v5.set(poleLocal[0], poleLocal[1], poleLocal[2]).applyQuaternion(_q3).normalize();
    const perp = pole.addScaledVector(D, -pole.dot(D)).normalize();
    const E = _v6.copy(S).addScaledVector(D, Math.cos(a) * L1).addScaledVector(perp, Math.sin(a) * L1);
    const armDir = _v7.subVectors(E, S).normalize(), foreDir = _v8.subVectors(T, E).normalize();
    const X = _v9.crossVectors(armDir, foreDir); if (X.lengthSq() < 1e-8) X.set(1, 0, 0).applyQuaternion(_q3); X.normalize();
    const Yu = _v10.copy(armDir).negate(), Zu = _v11.crossVectors(X, Yu).normalize();
    const Au = basisQuat(_qa, X, Yu, Zu);
    const Yf = _v10.copy(foreDir).negate(), Zf = _v11.crossVectors(X, Yf).normalize();
    const Af = basisQuat(_qb, X, Yf, Zf);
    const Eu = _qc.copy(_q3).invert().multiply(Au);
    const qu = _qd.multiplyQuaternions(this.Npi[B['uarm' + side]], Eu).multiply(this.N[B['uarm' + side]]);
    bU.quaternion.slerp(qu, w);
    const Ef = _qc.copy(Au).invert().multiply(Af);
    const qf = _qd.multiplyQuaternions(this.Npi[B['farm' + side]], Ef).multiply(this.N[B['farm' + side]]);
    bF.quaternion.slerp(qf, w);
  }

  solveArmRequests() {
    for (const side of ['L', 'R']) {
      const r = this.armIK[side];
      if (!r || r.w <= 0.01) continue;
      const bc = this.bones[B.chest]; bc.updateWorldMatrix(true, false);
      const T = _v1.set(r.t[0], r.t[1], r.t[2]).applyMatrix4(bc.matrixWorld);
      this.solveArm(side, T, r.pole, clamp(r.w, 0, 1));
    }
  }

  solveLegs(P) {
    const R = this.rig, bones = this.bones;
    eulerQuat(_q3, P.r[B.hips * 3], P.r[B.hips * 3 + 1], P.r[B.hips * 3 + 2], YXZ);
    const yaw = P.yaw;
    if (yaw) { _qy.setFromAxisAngle(_v1.set(0, 1, 0), yaw); _q3.premultiply(_qy); }
    const hipsPos = bones[B.hips].position;
    for (let side = 0; side < 2; side++) {
      const s = side === 0 ? 'L' : 'R', sg = side === 0 ? -1 : 1;
      const off = side === 0 ? R.hipOffL : R.hipOffR;
      const H = _v1.copy(off).applyQuaternion(_q3).add(hipsPos);
      const f = P.feet, o = side * 5;
      const T = _v2.set(f[o], f[o + 1], f[o + 2]);
      const fyaw = f[o + 4] + yaw;
      if (yaw) { const c = Math.cos(yaw), sn = Math.sin(yaw); const x = T.x, z = T.z; T.x = x * c + z * sn; T.z = -x * sn + z * c; }
      const hint = _v3.set(-Math.sin(fyaw) + sg * 0.12 * Math.cos(fyaw), 0, -Math.cos(fyaw) - sg * 0.12 * Math.sin(fyaw));
      const d = _v4.subVectors(T, H); let dl = d.length();
      const L1 = R.L1, L2 = R.L2;
      dl = clamp(dl, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.9995);
      d.normalize();
      const a = (L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl);
      const ang = Math.acos(clamp(a, -1, 1));
      const side2 = _v5.crossVectors(d, hint); if (side2.lengthSq() < 1e-6) side2.set(1, 0, 0); side2.normalize();
      const up = _v6.crossVectors(side2, d).normalize();
      const knee = _v7.copy(H).addScaledVector(d, Math.cos(ang) * L1).addScaledVector(up, Math.sin(ang) * L1);
      const thighDir = _v8.subVectors(knee, H).normalize();
      const shinDir = _v9.subVectors(T, knee).normalize();
      const X = _v10.copy(side2);
      const Y = _v11.copy(thighDir).negate();
      const Z = _lv[5].crossVectors(X, Y).normalize();
      X.crossVectors(Y, Z).normalize();
      const Athigh = basisQuat(_lq[0], X, Y, Z);
      const Ys = _lv[6].copy(shinDir).negate();
      const Zs = _lv[7].crossVectors(X, Ys).normalize();
      const Xs = _lv[5].crossVectors(Ys, Zs).normalize();
      const Ashin = basisQuat(_lq[1], Xs, Ys, Zs);
      eulerQuat(_lq[2], f[o + 3], fyaw, 0, YXZ);
      const Afoot = _lq[2];
      const w = P.ikw;
      const bt = bones[B['thigh' + s]], bs = bones[B['shin' + s]], bf = bones[B['foot' + s]];
      const Eth = _q2.copy(_q3).invert().multiply(Athigh);
      const qth = _qa.multiplyQuaternions(this.Npi[B['thigh' + s]], Eth).multiply(this.N[B['thigh' + s]]);
      const Esh = _qb.copy(Athigh).invert().multiply(Ashin);
      const qsh = _qc.multiplyQuaternions(this.Npi[B['shin' + s]], Esh).multiply(this.N[B['shin' + s]]);
      const Eft = _qd.copy(Ashin).invert().multiply(Afoot);
      const qft = _qe.multiplyQuaternions(this.Npi[B['foot' + s]], Eft).multiply(this.N[B['foot' + s]]);
      if (w >= 0.999) { bt.quaternion.copy(qth); bs.quaternion.copy(qsh); bf.quaternion.copy(qft); }
      else { bt.quaternion.slerp(qth, w); bs.quaternion.slerp(qsh, w); bf.quaternion.slerp(qft, w); }
      eulerQuat(_q, P.toe[side], 0, 0, XZY);
      bones[B['toe' + s]].quaternion.multiplyQuaternions(this.Npi[B['toe' + s]], _q).multiply(this.N[B['toe' + s]]);
    }
  }

  secondary(P, dt, s) {
    const bones = this.bones, t = this.t;
    const r = P.r;
    const chestPitch = r[B.hips * 3] + r[B.spine * 3] + r[B.chest * 3];
    const chestRoll = r[B.hips * 3 + 2] + r[B.spine * 3 + 2] + r[B.chest * 3 + 2];
    const fwd = this.speed, side = this.strafe;
    const vx = side, vz = -fwd;
    if (dt > 0) {
      const ax = (vx - this.prevVel.x) / dt, az = (vz - this.prevVel.z) / dt;
      this.prevVel.set(vx, 0, vz);
      this.accel.x = damp(this.accel.x, clamp(ax, -40, 40), 8, dt); this.accel.z = damp(this.accel.z, clamp(az, -40, 40), 8, dt);
    }
    const lying = Math.max(this.deadW * smoothstep(0.3, 0.9, this.deadT), this.downW);
    const act = this.action;
    const actDrag = act && act.def.drag ? act.def.drag * act.w : 0;
    const drag = clamp(Math.max(0, fwd) * 0.075 + actDrag, 0, 0.95);
    const spin = act && act.def.spinDrag ? act.def.spinDrag * act.w : 0;
    for (let i = 0; i < 4; i++) {
      const flutter = (Math.sin(t * 9.5 + i * 1.3) * 0.5 + Math.sin(t * 13.1 + i * 2.1) * 0.3) * 0.06 * drag * (i + 1) * 0.5;
      let target = (i === 0 ? -chestPitch : 0) - drag * (i === 0 ? 0.75 : 0.25) + flutter - spin * (i === 0 ? 0.6 : 0.2);
      target -= Math.max(0, this.gait * this.moveW * 0.1 * (i === 0 ? 1 : 0));
      if (lying > 0) target = lerp(target, i === 0 ? -0.2 : -0.05, lying);
      let v = this.cape[i].step(target, dt, this.accel.z * 0.35 * (i === 0 ? 1 : 0.5));
      if (i === 0) v = Math.min(v, 0.05);
      const rollT = (i === 0 ? -chestRoll : 0) + clamp(this.accel.x * 0.02, -0.25, 0.25) + clamp(side * 0.04, -0.3, 0.3) * (i === 0 ? 1 : 0.4) + clamp(this.turnS * 0.05, -0.3, 0.3) * (i === 0 ? 1 : 0.3);
      const vr = this.capeR[i].step(rollT, dt);
      eulerQuat(_q, v, 0, vr, XZY);
      const b = B['cape' + i];
      bones[b].quaternion.multiplyQuaternions(this.Npi[b], _q).multiply(this.N[b]);
    }
    const hp = r[B.hips * 3] + r[B.spine * 3] + r[B.chest * 3] + r[B.neck * 3] + r[B.head * 3];
    const hr = r[B.hips * 3 + 2] + r[B.spine * 3 + 2] + r[B.chest * 3 + 2] + r[B.neck * 3 + 2] + r[B.head * 3 + 2];
    const bounce = Math.sin(this.phase * Math.PI * 4) * 0.12 * this.moveW * (0.4 + this.gait * 0.6);
    for (let i = 0; i < 3; i++) {
      const tgt = (i === 0 ? -hp * 0.8 : -hp * 0.1) - drag * 0.4 + bounce * (i + 1) * 0.3 - spin * 0.5;
      const v = this.hair[i].step(clamp(tgt, -1.2, 1.2), dt, this.accel.z * 0.2);
      const vr = this.hairR[i].step((i === 0 ? -hr * 0.8 : 0) + clamp(this.turnS * 0.04, -0.3, 0.3), dt, this.accel.x * 0.15);
      eulerQuat(_q, v, 0, vr, XZY);
      const b = B[['hairA', 'hairB', 'hairC'][i]];
      bones[b].quaternion.multiplyQuaternions(this.Npi[b], _q).multiply(this.N[b]);
    }
    for (let i = 0; i < 2; i++) {
      const tgt = (i === 0 ? -hp * 0.7 : 0) + bounce * 0.5 - drag * 0.3;
      const v = this.braid[i].step(clamp(tgt, -1, 1), dt, this.accel.z * 0.2);
      eulerQuat(_q, v, 0, i === 0 ? -hr * 0.6 : 0, XZY);
      for (const n of ['braidL' + (i + 1), 'braidR' + (i + 1)]) bones[B[n]].quaternion.multiplyQuaternions(this.Npi[B[n]], _q).multiply(this.N[B[n]]);
    }
    for (let i = 0; i < 2; i++) {
      const tgt = (i === 0 ? -hp * 0.35 : 0) + bounce * 0.4;
      const v = this.beard[i].step(clamp(tgt, -0.8, 0.8), dt, this.accel.z * 0.1);
      eulerQuat(_q, v, 0, 0, XZY);
      const b = B['beard' + (i + 1)];
      bones[b].quaternion.multiplyQuaternions(this.Npi[b], _q).multiply(this.N[b]);
    }
    // front / back flaps: follow the thighs (stay between the legs) + spring lag
    const tl = r[B.thighL * 3], tr2 = r[B.thighR * 3];
    const bt = this.bones[B.thighL].quaternion, bt2 = this.bones[B.thighR].quaternion;
    const legF = Math.max(0, thighSwing(bt), thighSwing(bt2)), legB = Math.min(0, thighSwing(bt), thighSwing(bt2));
    const hipP = r[B.hips * 3];
    const fT = [clamp(legF * 0.85 - hipP * 0.9 - drag * 0.35, -0.3, 1.4), 0, clamp(legB * 0.7 - hipP * 0.9 - drag * 0.6 - spin * 0.8, -1.4, 0.3), 0];
    const flaps = ['skirtF', 'skirtF2', 'skirtB', 'skirtB2'];
    for (let i = 0; i < 4; i++) {
      const base = i % 2 === 0 ? fT[i] : (this.skirt[i - 1].x - fT[i - 1]) * 0.6 + (i === 1 ? -drag * 0.2 : -drag * 0.4);
      const v = this.skirt[i].step(base, dt, (i < 2 ? -1 : 1) * this.accel.z * 0.25);
      eulerQuat(_q, v, 0, 0, XZY);
      const b = B[flaps[i]];
      bones[b].quaternion.multiplyQuaternions(this.Npi[b], _q).multiply(this.N[b]);
    }
    void tl; void tr2;
  }
}
// forward swing of a thigh from its quaternion (approx, bind-neutral frames): positive = forward
const _tv = new THREE.Vector3();
function thighSwing(q) { _tv.set(0, -1, 0).applyQuaternion(q); return Math.atan2(-_tv.z, -_tv.y); }

const POLE_R = [0.7, -0.6, 0.45], POLE_L = [-0.7, -0.6, 0.45], POLE_L2 = [-0.5, -1, 0.4];

// ================================================================================================
// Base poses
function idlePose(p, t, dt, ctx, A) {
  const R = ctx.rig, sd = A.seed;
  const breath = Math.sin(t * 1.6 + sd) * 0.5 + 0.5;
  const shift = Math.sin(t * 0.42 + sd * 1.7);
  A.lookT -= dt;
  if (A.lookT < 0) { A.lookTarget = A.rand() < 0.5 ? 0 : (A.rand() - 0.5) * 1.1; A.lookT = 2 + A.rand() * 4; }
  A.look = damp(A.look, A.lookTarget, 1.5, dt);
  const f = R.sex === 'f';
  p.set(B.hips, 0.02, shift * 0.04, shift * (f ? 0.05 : 0.035));
  p.hip[0] = shift * 0.025; p.hip[1] = -0.012 - breath * 0.004;
  p.set(B.spine, 0.02, -shift * 0.02, -shift * 0.02);
  p.set(B.chest, 0.04 - breath * 0.03, -shift * 0.02, -shift * 0.012); // proud chest
  p.set(B.neck, -0.06, A.look * 0.35, 0);
  p.set(B.head, 0.02 + breath * 0.015, A.look * 0.55, shift * 0.02);
  setClav(p, 'L', 0.0 + breath * 0.025, 0.02); setClav(p, 'R', 0.0 + breath * 0.025, 0.02);
  const ab = f ? 0.06 : 0.09;
  setArm(p, 'L', 0.06 + breath * 0.02, ab + breath * 0.015, 0.18, 0.28 + shift * 0.03, 0.08, 0, 0.45);
  setArm(p, 'R', 0.06 + breath * 0.02, ab + breath * 0.015, 0.18, 0.28 - shift * 0.03, 0.08, 0, 0.45);
  stance(p, ctx, f ? 0.0 : 0.05, 0.035 + shift * 0.01, -0.03, f ? 0.1 : 0.17);
  p.face = 0;
}

function combatIdle(p, t, ctx, A) {
  const R = ctx.rig, sd = A.seed;
  const bob = Math.sin(t * 3.0 + sd);
  holdPose(p, ctx.drawn ? ctx.kind : 'fists', t, ctx, A, bob);
}

function locoPose(p, ctx, A, speed, dir, amp) {
  const R = ctx.rig;
  const g = A.gait * amp;
  const ph = A.phase * Math.PI * 2;
  const back = Math.cos(dir) < -0.3;
  const sideness = Math.abs(Math.sin(dir));
  const legYaw = !back ? -clamp(dir, -1.2, 1.2) * 0.62 : -clamp(Math.atan2(Math.sin(dir), -Math.cos(dir)), -1.2, 1.2) * 0.5;
  const dx = Math.sin(dir), dz = -Math.cos(dir);
  const legScale = R.legLen / 0.87;
  const period = lerp(1.06, 0.66, A.gait) * Math.sqrt(legScale);
  const duty = lerp(0.6, 0.34, g);
  const S = Math.min(speed * duty * period, lerp(0.8, 1.0, g) * R.legLen) * amp;
  const lift = lerp(0.1, 0.32, g) * legScale * amp;
  const uF = lerp(0.5, 0.32, g), uB = uF - 1;
  const bobA = lerp(0.018, 0.045, g) * legScale * amp;
  p.hip[1] = -lerp(0.025, 0.07, g) * legScale - bobA * Math.cos(4 * Math.PI * (A.phase - duty * 0.5));
  p.hip[0] = Math.sin(ph) * lerp(0.03, 0.012, g) * amp;
  p.hip[2] = lerp(0, 0.05, g) * (back ? -1 : 1) * amp;
  const hipYaw = legYaw + Math.sin(ph) * lerp(0.12, 0.22, g) * amp;
  p.set(B.hips, lerp(0.0, -0.14, g) * (back ? -0.4 : 1), hipYaw, Math.sin(ph) * 0.05 * amp);
  for (let side = 0; side < 2; side++) {
    const fph = (A.phase + (side === 0 ? 0 : 0.5)) % 1;
    let u, y = 0, pitch, toe = 0;
    if (fph < duty) {
      const k = fph / duty;
      u = lerp(uF, uB, k);
      if (!back) pitch = k < 0.18 ? lerp(0.28 * (1 - g * 0.6), 0, k / 0.18) : -smoothstep(0.6, 1, k) * lerp(0.35, 0.65, g);
      else pitch = k < 0.18 ? lerp(-0.3, 0, k / 0.18) : smoothstep(0.7, 1, k) * 0.2;
      toe = smoothstep(0.6, 1, k) * lerp(0.4, 0.75, g) * (back ? 0.3 : 1);
    } else {
      const k = (fph - duty) / (1 - duty);
      const e = smoothstep(lerp(0.0, 0.18, g), 0.92, k);
      u = lerp(uB, uF, e);
      const lk = Math.sin(Math.PI * Math.pow(k, lerp(1, 0.6, g)));
      y = lift * lk;
      pitch = back ? lerp(0.2, -0.3, k) : lerp(lerp(-0.45, -1.0, g), lerp(0.2, 0.1, g), smoothstep(0.25, 0.95, k));
      toe = (1 - k) * 0.25;
    }
    const sg = side === 0 ? -1 : 1, o = side * 5;
    const wid = R.stanceX * (1 - sideness * 0.3) + sideness * 0.02 - g * 0.025;
    const lx = sg * wid * Math.cos(legYaw), lz = sg * wid * Math.sin(legYaw);
    p.feet[o] = lx + dx * u * S; p.feet[o + 1] = R.ankleH + y; p.feet[o + 2] = lz + dz * u * S;
    p.feet[o + 3] = pitch; p.feet[o + 4] = legYaw + sg * 0.08;
    p.toe[side] = toe;
  }
  const sw = Math.sin(ph);
  const leanB = back ? 0.08 : 1;
  p.set(B.spine, lerp(-0.02, -0.12, g) * leanB * amp, -hipYaw * 0.45, -Math.sin(ph) * 0.03);
  p.set(B.chest, lerp(0.0, -0.08, g) * leanB * amp + Math.abs(Math.cos(ph)) * 0.02 * g, -hipYaw * 0.45 - sw * 0.07 * g, 0);
  p.set(B.neck, lerp(-0.02, 0.1, g) * leanB * amp, 0, 0);
  p.set(B.head, lerp(0.02, 0.12, g) * leanB * amp, 0, 0);
  const armAmp = lerp(0.34, 0.66, g) * amp;
  for (const s of ['L', 'R']) {
    const a = (s === 'L' ? -sw : sw);
    const fwd = Math.max(0, a);
    setArm(p, s, lerp(0.04, 0.12, g) + a * armAmp, lerp(0.12, 0.18, g), lerp(0.05, 0.35, g),
      lerp(0.22 + fwd * 0.2, 1.45 + fwd * 0.3 - Math.max(0, -a) * 0.25, g), 0.1, 0, lerp(0.42, 1.25, g));
    setClav(p, s, 0.03 + fwd * 0.05 * g, a * 0.1 * g);
  }
  // weapon-aware arms (carry the drawn weapon while running)
  if (A.combatW > 0.01 && ctx.drawn) { const T = A.T4.copy(p); runArms(T, ctx.kind, sw, g, ctx, A); p.lerp(T, A.combatW, ARM_MASK); p.w2h = T.w2h * A.combatW; }
}

function sitPose(p, ctx, A) {
  const R = ctx.rig, t = ctx.t;
  p.ikw = 0;
  const legScale = R.legLen / 0.87;
  p.hip[1] = -(R.hips.y - 0.12 * legScale - 0.05); p.hip[2] = 0.05;
  const br = Math.sin(t * 1.5) * 0.015;
  p.set(B.hips, 0.25, 0, 0);
  p.set(B.spine, -0.15, 0, 0); p.set(B.chest, -0.2 + br, 0, 0); p.set(B.neck, 0.05, 0, 0); p.set(B.head, 0.1, Math.sin(t * 0.3) * 0.2, 0);
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1;
    p.set(B['thigh' + s], 1.3, -sg * 0.1, sg * 0.3);
    p.set(B['shin' + s], -2.1, 0, 0);
    p.set(B['foot' + s], 0.4, 0, 0);
    setArm(p, s, 0.55, 0.35, -0.2, 0.7, -0.2, 0, 0.3);
  }
  p.wR[0] = 0; p.wL[0] = 0; p.w2h = 0;
}

function ridePose(p, ctx, A) {
  const R = ctx.rig, t = ctx.t;
  p.ikw = 0;
  p.hip[1] = -(R.hips.y - 0.04); p.hip[2] = 0.02;
  const bob = Math.sin(t * 7) * 0.02;
  p.set(B.hips, 0.12, 0, 0);
  p.set(B.spine, 0.05 + bob, 0, 0); p.set(B.chest, 0.02, 0, 0); p.set(B.neck, -0.05, 0, 0); p.set(B.head, 0.05, 0, 0);
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1;
    p.set(B['thigh' + s], 0.95, -sg * 0.2, sg * 0.62);
    p.set(B['shin' + s], -1.35, 0, 0);
    p.set(B['foot' + s], 0.35, 0, 0);
    setArm(p, s, 0.75, 0.25, -0.15, 0.95, -0.25, 0, 0.25);
  }
  p.wR[0] = 0; p.wL[0] = 0; p.w2h = 0;
}

function stunPose(p, t, ctx, A) {
  const R = ctx.rig;
  const sw = Math.sin(t * 2.2), sw2 = Math.sin(t * 1.3 + 1);
  p.hip[1] = -0.08 * R.legLen / 0.87; p.hip[0] = sw * 0.03;
  p.set(B.hips, 0.1, sw * 0.08, sw2 * 0.05);
  p.set(B.spine, 0.12, 0, sw * 0.06); p.set(B.chest, 0.1, sw2 * 0.1, 0);
  p.set(B.neck, 0.2, 0, 0); p.set(B.head, 0.3 + sw2 * 0.1, sw * 0.4, sw * 0.25);
  setArm(p, 'L', 0.1, 0.12, 0.1, 0.35, 0.1, 0, 0.3); setArm(p, 'R', 0.1, 0.12, 0.1, 0.35, 0.1, 0, 0.3);
  setClav(p, 'L', -0.08); setClav(p, 'R', -0.08);
  stance(p, ctx, 0.06, 0.05, -0.08, 0.3);
  p.w2h = 0; p.wR[0] = 0; p.wL[0] = 0;
  p.face = 1;
}

function drawGesture(p, ctx, A) {
  const k = ctx.kind;
  const hip = k === 'sword' || k === 'blades' || k === 'pistol' || k === 'none';
  if (hip) setArm(p, 'R', 0.5, -0.35, 0.3, 1.2, 0.2, 0, 1.0);
  else setArm(p, 'R', 2.4, 0.5, 0.2, 1.8, 0.2, 0, 1.0);
  if (k === 'blades' || k === 'pistol') setArm(p, 'L', 0.5, -0.35, 0.3, 1.2, 0.2, 0, 1.0);
  p.add(B.chest, 0, hip ? 0.2 : -0.15, 0);
  p.w2h = 0;
}
