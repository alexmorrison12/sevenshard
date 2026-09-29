// Legged locomotion (SEVENSHARD copy of kit/gait.js — same behaviour, spec format and public fields, plus):
//   - digitigrade metatarsi & paws of body-carried legs (local overrides, airborne) follow the body's full rotation, so
//     lying / flung / flying poses keep their leg shape instead of standing the metatarsus upright;
//   - allocation-free per frame: gait/leg parameters are flattened into typed arrays / fixed-shape records at
//     construction (no megamorphic `cfg[k] ?? def` loads that box doubles), no closures, no option objects, local IK.
// Gaits are blended by speed (phase offsets per leg, duty factor, stride frequency, body oscillation). Stance feet are
// integrated with the ground velocity in model space (forward speed + turn), so feet stay planted; swing feet arc from
// lift-off to the predicted touchdown; when the creature stops, unfinished swings land at home and strays settle.
import * as THREE from 'three';
import { fract, clamp01, mix, sstep, TAU } from '../kit/rig.js';

const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

// per-gait scalar parameters (name → default)
const GP = ['v', 0, 'f', 2, 'duty', 0.6, 'lift', 1, 'lean', 0,
  'bob', 0, 'bobF', 2, 'bobPh', 0, 'pitch', 0, 'pitchF', 2, 'pitchPh', 0, 'roll', 0, 'rollF', 2, 'rollPh', 0,
  'sway', 0, 'swayF', 2, 'swayPh', 0, 'flex', 0, 'flexF', 2, 'flexPh', 0, 'nod', 0, 'nodF', 2, 'nodPh', 0];
const NP = GP.length / 2;
const PI = {}; for (let i = 0; i < NP; i++) PI[GP[i * 2]] = i;
const O_BOB = PI.bob, O_PITCH = PI.pitch, O_ROLL = PI.roll, O_SWAY = PI.sway, O_FLEX = PI.flex, O_NOD = PI.nod;

// ---- 2-bone IK (same maths as kit/rig.js makeChain / solveIK / frameRot, no boxed return value)
const _d = new THREE.Vector3(), _pp = new THREE.Vector3(), _ax = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4(), _u0 = new THREE.Vector3(), _p0 = new THREE.Vector3(), _w0 = new THREE.Vector3();
const _kn = new THREE.Vector3(), _ss = new THREE.Vector3();
function frameRot(out, u0, p0, u, p) {
  _u0.copy(u0).normalize(); _p0.copy(p0).addScaledVector(_u0, -p0.dot(_u0)).normalize(); _w0.crossVectors(_u0, _p0);
  _u.copy(u).normalize(); _pp.copy(p).addScaledVector(_u, -p.dot(_u));
  if (_pp.lengthSq() < 1e-10) _pp.copy(_p0); _pp.normalize(); _w.crossVectors(_u, _pp);
  _m0.makeBasis(_u0, _p0, _w0).transpose();
  _m1.makeBasis(_u, _pp, _w).multiply(_m0);
  out.setFromRotationMatrix(_m1);
}
function makeChain(pose, a, b, c, pole0) {
  const ra = pose.rest[a], rb = pose.rest[b], rc = pose.rest[c];
  const l1 = ra.distanceTo(rb), l2 = rb.distanceTo(rc);
  const u1 = rb.clone().sub(ra).normalize(), u2 = rc.clone().sub(rb).normalize();
  let p0;
  if (pole0) p0 = new THREE.Vector3(...pole0);
  else { const ac = rc.clone().sub(ra).normalize(); p0 = rb.clone().sub(ra); p0.addScaledVector(ac, -p0.dot(ac)); if (p0.lengthSq() < 1e-8) p0.set(0, 0, 1); }
  p0.normalize();
  return { a, b, c, l1, l2, u1, u2, pole0: p0 };
}
function solveIK(pose, ch, target, pole) {
  const A = pose.wp[ch.a];
  _d.subVectors(target, A);
  let d = _d.length();
  _d.divideScalar(d || 1e-6);
  const dmax = ch.l1 + ch.l2 - 1e-4, dmin = Math.abs(ch.l1 - ch.l2) + 1e-4;
  d = d > dmax ? dmax : d < dmin ? dmin : d;
  _pp.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_pp.lengthSq() < 1e-10) { _pp.set(0, 1, 0).addScaledVector(_d, -_d.y); }
  _pp.normalize();
  const ca = (ch.l1 * ch.l1 + d * d - ch.l2 * ch.l2) / (2 * ch.l1 * d);
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  _kn.copy(A).addScaledVector(_d, ch.l1 * ca).addScaledVector(_pp, ch.l1 * sa);
  pose.wp[ch.b].copy(_kn);
  pose.wp[ch.c].copy(A).addScaledVector(_d, d);
  _ax.copy(_pp);
  _ss.subVectors(_kn, A);
  frameRot(pose.wq[ch.a], ch.u1, ch.pole0, _ss, _ax);
  _ss.subVectors(pose.wp[ch.c], _kn);
  frameRot(pose.wq[ch.b], ch.u2, ch.pole0, _ss, _ax);
}

class Leg { // fixed-shape leg record (all fields created up-front)
  constructor(L, pose, gi, nG, gaits) {
    const idx = L.chain.map(n => pose.b[n]);
    const four = idx.length === 4;
    const toe = new THREE.Vector3(...L.toe);
    const endRest = pose.rest[four ? idx[3] : idx[2]];
    this.id = L.id; this.idx = idx; this.four = four; this.chain = makeChain(pose, idx[0], idx[1], idx[2], L.pole);
    this.paw = four ? idx[3] : idx[2]; this.meta = four ? idx[2] : -1;
    this.toe = toe; this.toeOff = toe.clone().sub(endRest);
    this.metaVec = four ? pose.rest[idx[3]].clone().sub(pose.rest[idx[2]]) : new THREE.Vector3();
    this.home = toe.clone(); this.homeOff = new THREE.Vector3();
    this.F = toe.clone(); this.liftF = toe.clone(); this.T = toe.clone();
    this.stance = true; this.u = 1; this.dur = 0.3; this.settle = false; this.lastLp = 0;
    this.liftH = L.lift ?? 0.08; this.flex = L.flex ?? 0.9; this.body = pose.b[L.body]; this.out = L.out ?? 0.15; this.side = Math.sign(L.toe[0]) || 1;
    this.pawPitch = 0; this.metaPitch = 0; this.air = 0; this.down = 0;
    this.override = new THREE.Vector3(); this.overrideW = 0; this.overrideLocal = false; this.overridePaw = 0; this.pawAdd = 0; this.overrideMeta = NaN;
    this.metaK = L.metaK ?? 1.2; this.metaBase = L.metaBase ?? 0; this.heel = L.heel ?? 0.35; this.scap = L.scap ?? 0; this.dutyMul = L.dutyMul ?? 1;
    // phase offset of this leg in every gait (unit-circle blend input)
    this.offC = new Float64Array(nG); this.offS = new Float64Array(nG);
    for (let g = 0; g < nG; g++) { const o = ((gaits[g].off || {})[L.id] ?? 0) * TAU; this.offC[g] = Math.cos(o); this.offS[g] = Math.sin(o); }
  }
}

/**
 * cfg.legs: [{ id, chain:[upper, lower, end(, paw)], toe:[x,0,z] rest contact point, body: bone whose rotation carries the pole,
 *              lift, flex (swing paw curl rad), pole?:[x,y,z], out: outward pole bias, metaK, metaBase, heel, scap, dutyMul }]
 * cfg.gaits: [{ v, f, duty, lift, off:{id:phase}, bob, bobF, bobPh, pitch, pitchF, pitchPh, flex…, roll…, sway…, nod…, lean }]
 * cfg: maxStride, fMin, actV, actTurn, settleDist
 */
export class Gait {
  constructor(pose, cfg) {
    this.pose = pose; this.cfg = cfg;
    const G = cfg.gaits, nG = G.length;
    this.nG = nG;
    this.P = new Float64Array(nG * NP);
    for (let g = 0; g < nG; g++) for (let i = 0; i < NP; i++) this.P[g * NP + i] = G[g][GP[i * 2]] ?? GP[i * 2 + 1];
    this.phase = 0; this.f = this.P[PI.f]; this.sSm = 0; this.act = 0; this.moving = false;
    this.maxStride = cfg.maxStride ?? 1.0; this.fMin = cfg.fMin ?? 0.6; this.actV = cfg.actV ?? 0.25; this.actTurn = cfg.actTurn ?? 0.9; this.settleDist = cfg.settleDist ?? 0.07;
    this.gw = new Float64Array(nG); this.gw[0] = 1;
    this.legs = cfg.legs.map((L, i) => new Leg(L, pose, i, nG, G));
    this.bob = 0; this.pitch = 0; this.roll = 0; this.sway = 0; this.flex = 0; this.lean = 0; this.nod = 0;
    this.onStep = null;
    this.ground = null;            // optional (lx, lz) → local ground height (terrain following), set by Creature.setGround
    this.gOff = 0; this.gPitch = 0; this.gRoll = 0; // smoothed body adaptation to the ground under the feet
  }
  gy(x, z) { return this.ground ? this.ground(x, z) : 0; }
  /** Smoothed body height / pitch / roll from the ground under the legs' home positions. */
  adaptBody(dt, pitchRoll = true) {
    if (!this.ground) { this.gOff = 0; this.gPitch = 0; this.gRoll = 0; return; }
    let sum = 0, fr = 0, fn = 0, re = 0, rn = 0, le = 0, ln = 0, ri = 0, rin = 0, fz = 0, rz = 0, lx = 0, rx = 0;
    const legs = this.legs;
    for (let i = 0; i < legs.length; i++) {
      const L = legs[i], h = this.gy(L.home.x, L.home.z); sum += h;
      if (L.home.z < 0) { fr += h; fn++; fz += L.home.z; } else { re += h; rn++; rz += L.home.z; }
      if (L.home.x < 0) { le += h; ln++; lx += L.home.x; } else { ri += h; rin++; rx += L.home.x; }
    }
    const k = 1 - Math.exp(-8 * dt);
    this.gOff += (sum / legs.length - this.gOff) * k;
    let p = 0, r = 0;
    if (pitchRoll && fn && rn) p = Math.atan2(fr / fn - re / rn, rz / rn - fz / fn);
    if (pitchRoll && ln && rin) r = Math.atan2(ri / rin - le / ln, rx / rin - lx / ln);
    this.gPitch += (Math.max(-0.5, Math.min(0.5, p)) - this.gPitch) * k;
    this.gRoll += (Math.max(-0.4, Math.min(0.4, r)) * 0.8 - this.gRoll) * k;
  }
  get speedSm() { return this.sSm; }
  _gaitWeights(s) {
    const w = this.gw, P = this.P, nG = this.nG, vi = PI.v;
    for (let i = 0; i < nG; i++) w[i] = 0;
    if (s <= P[vi]) w[0] = 1;
    else if (s >= P[(nG - 1) * NP + vi]) w[nG - 1] = 1;
    else for (let i = 0; i < nG - 1; i++) {
      const a = P[i * NP + vi], b = P[(i + 1) * NP + vi];
      if (s >= a && s < b) { const t = sstep(0, 1, (s - a) / (b - a)); w[i] = 1 - t; w[i + 1] = t; break; }
    }
  }
  _mix(pi) { let s = 0; const w = this.gw, P = this.P; for (let i = 0; i < this.nG; i++) if (w[i]) s += P[i * NP + pi] * w[i]; return s; }
  _osc(pi) { // amplitude at pi, frequency at pi+1, phase at pi+2
    let s = 0; const w = this.gw, P = this.P;
    for (let i = 0; i < this.nG; i++) { const wi = w[i]; if (!wi) continue; const o = i * NP + pi; s += wi * P[o] * Math.cos(TAU * (P[o + 1] * this.phase + P[o + 2])); }
    return s;
  }
  _legPhase(L) { // per-gait phase offsets of one leg, blended on the unit circle by gait weights
    let c = 0, s = 0; const w = this.gw;
    for (let i = 0; i < this.nG; i++) { const wi = w[i]; if (!wi) continue; c += L.offC[i] * wi; s += L.offS[i] * wi; }
    return fract(Math.atan2(s, c) / TAU + 1);
  }

  /** speed/turn in model units (m/s, rad/s along the model's -Z facing). */
  update(dt, speed, turn, strafe = 0) {
    this.sSm += (speed - this.sSm) * (1 - Math.exp(-6 * dt));
    const as = Math.abs(this.sSm);
    this._gaitWeights(as);
    const v0 = this.P[PI.v];
    let f = this._mix(PI.f);
    if (as < v0) f *= mix(this.fMin, 1, as / v0);
    const tr = Math.abs(turn);
    const actT = clamp01(Math.sqrt(speed * speed + strafe * strafe) / this.actV + tr * this.actTurn);
    this.act += (actT - this.act) * (1 - Math.exp(-(actT > this.act ? 10 : 5) * dt));
    const moving = actT > 0.04;
    this.moving = moving;
    const dutyAll = this._mix(PI.duty);
    const liftK = this._mix(PI.lift);
    if (moving) { this.f = f; this.phase = fract(this.phase + f * dt); }
    const a = this.act;
    this.bob = this._osc(O_BOB) * a;
    this.pitch = this._osc(O_PITCH) * a;
    this.roll = this._osc(O_ROLL) * a;
    this.sway = this._osc(O_SWAY) * a;
    this.flex = this._osc(O_FLEX) * a;
    this.nod = this._osc(O_NOD) * a;
    this.lean = this._mix(PI.lean) * clamp01(as / 2);
    const swingDur = (1 - dutyAll) / Math.max(0.3, this.f);
    const legs = this.legs;
    for (let i = 0; i < legs.length; i++) {
      const L = legs[i];
      L.overrideW = 0; L.overrideLocal = false; L.overridePaw = 0; L.pawAdd = 0; L.overrideMeta = NaN;
      L.home.copy(L.toe).add(L.homeOff);
      const vgx = -turn * L.F.z - strafe, vgz = speed + turn * L.F.x;
      if (moving) {
        const lp = fract(this.phase + this._legPhase(L));
        const duty = dutyAll * L.dutyMul;
        if (lp < duty) {
          if (!L.stance) { L.stance = true; L.settle = false; L.down = 1; if (this.onStep) this.onStep(L); }
          L.u = 1;
          const ca = Math.cos(turn * dt), sa = Math.sin(turn * dt), fx = L.F.x, fz = L.F.z;
          L.F.x = fx * ca - fz * sa - strafe * dt; L.F.z = fx * sa + fz * ca + speed * dt; L.F.y = this.gy(L.F.x, L.F.z);
          L.pawPitch = -L.heel * sstep(0.65, 1.0, lp / duty) * clamp01(as / 1.5);
        } else {
          if (L.stance) { L.stance = false; L.liftF.copy(L.F); }
          const u = (lp - duty) / (1 - duty);
          L.u = u;
          const Dx = vgx * duty / this.f, Dz = vgz * duty / this.f;
          const dl = Math.sqrt(Dx * Dx + Dz * Dz), k = dl > this.maxStride ? this.maxStride / dl : 1;
          L.T.set(L.home.x - Dx * 0.5 * k, 0, L.home.z - Dz * 0.5 * k); L.T.y = this.gy(L.T.x, L.T.z);
          this._swing(L, u, liftK * a);
        }
      } else if (!L.stance) {
        L.u = Math.min(1, L.u + dt / Math.max(0.12, swingDur));
        L.T.copy(L.home); L.T.y = this.gy(L.T.x, L.T.z);
        this._swing(L, L.u, liftK * 0.6);
        if (L.u >= 1) { L.stance = true; L.settle = false; L.F.copy(L.T); L.down = 1; if (this.onStep) this.onStep(L); }
      } else {
        L.pawPitch *= Math.exp(-8 * dt);
        L.F.y = this.gy(L.F.x, L.F.z);
      }
      L.down = Math.max(0, L.down - dt * 6);
    }
    if (!moving) { // settle steps: at most one leg swinging at a time
      let busy = false;
      for (let i = 0; i < legs.length; i++) if (!legs[i].stance) { busy = true; break; }
      if (!busy) {
        let worst = null, wd = this.settleDist;
        for (let i = 0; i < legs.length; i++) { const L = legs[i], ex = L.F.x - L.home.x, ez = L.F.z - L.home.z, d = Math.sqrt(ex * ex + ez * ez); if (d > wd) { wd = d; worst = L; } }
        if (worst) { worst.stance = false; worst.settle = true; worst.u = 0; worst.liftF.copy(worst.F); }
      }
    }
  }
  _swing(L, u, liftK) {
    const e = u * u * (3 - 2 * u);
    L.F.lerpVectors(L.liftF, L.T, e);
    const h = L.liftH * liftK * (L.settle ? 0.6 : 1);
    L.F.y = L.liftF.y + (L.T.y - L.liftF.y) * e + h * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8);
    L.pawPitch = -L.flex * Math.sin(Math.PI * u) * clamp01(liftK * 1.5);
  }

  /** Solve all legs after FK. air (0..1): tuck toward the rest pose relative to the body; airPaw: paw curl when airborne. */
  solve(pose, air = 0, airPaw = -0.6) {
    if (typeof air === 'object') { airPaw = air.airPaw ?? -0.6; air = air.air ?? 0; } // kit-style opts object (compat)
    const legs = this.legs;
    for (let li = 0; li < legs.length; li++) {
      const L = legs[li];
      const bodyQ = pose.wq[L.body];
      _p.copy(L.F);
      let pawPitch = L.pawPitch, metaPitch = 0;
      if (L.four) metaPitch = L.metaBase - (L.F.z - L.home.z) * L.metaK - (L.stance ? 0 : L.flex * 0.45 * Math.sin(Math.PI * L.u));
      const ow = L.overrideW;
      if (air > 0) {
        pose.carry(L.body, L.toe, _v);
        _p.lerp(_v, air);
        pawPitch = mix(pawPitch, airPaw, air);
      }
      if (ow > 0) {
        if (L.overrideLocal) pose.carry(L.body, L.override, _v); else _v.copy(L.override);
        _p.lerp(_v, ow);
        pawPitch = mix(pawPitch, L.overridePaw, ow);
        const om = L.overrideMeta; if (typeof om === 'number' && om === om) metaPitch = mix(metaPitch, om, ow);
      }
      const yaw = yawOf(bodyQ);
      _q.setFromAxisAngle(Y, yaw).multiply(_q2.setFromAxisAngle(X, pawPitch + L.pawAdd));
      if (air > 0 || ow > 0) _q.slerp(bodyQ, Math.max(air * 0.5, L.overrideLocal ? ow : 0));
      _v.copy(L.toeOff).applyQuaternion(_q);
      const endP = _p.sub(_v);
      const pole = _v.copy(L.chain.pole0).applyQuaternion(bodyQ);
      pole.x += L.side * L.out;
      if (L.scap) {
        const rel = Math.max(-0.45, Math.min(0.45, L.F.z - L.home.z)) * (1 - ow) * (1 - air);
        tmpV.set(0, -Math.abs(rel) * 0.12, rel * L.scap).applyQuaternion(bodyQ);
        pose.wp[L.chain.a].add(tmpV);
      }
      if (L.four) {
        const qm = _q2.setFromAxisAngle(Y, yaw).multiply(tmpQ.setFromAxisAngle(X, metaPitch));
        const carry = Math.max(air, L.overrideLocal ? ow : 0);
        if (carry > 0) { const om = L.overrideMeta; tmpQ.copy(bodyQ).multiply(tmpQ2.setFromAxisAngle(X, typeof om === 'number' && om === om ? om : 0.35)); qm.slerp(tmpQ, carry); }
        const hock = tmpV.copy(L.metaVec).applyQuaternion(qm).negate().add(endP);
        solveIK(pose, L.chain, hock, pole);
        pose.wq[L.meta].copy(qm);
        pose.wp[L.paw].copy(pose.wp[L.meta]).add(tmpV2.copy(L.metaVec).applyQuaternion(qm));
        pose.wq[L.paw].copy(_q);
      } else {
        solveIK(pose, L.chain, endP, pole);
        pose.wq[L.paw].copy(_q);
      }
      if (pose.hasKids !== undefined && pose.hasKids[L.paw]) pose.fkChildren(L.paw);
    }
  }
}
const _fw = new THREE.Vector3();
export function yawOf(q) { _fw.set(0, 0, -1).applyQuaternion(q); return Math.atan2(-_fw.x, -_fw.z); }
