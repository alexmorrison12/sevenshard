// Boss animation core: compiled keyframe actions (per-channel tracks with per-segment easing, carry-forward keys,
// time-warp for stretched durations), an action player with cross-fades, secondary-motion spring chains and
// weapon/arm IK. Keys are authored in seconds at the action's default duration:
//
//   keys: [[t, { bone: [x, y, z] (euler YXZ, radians, delta from rest; replaces the locomotion pose),
//               'bone+': [x, y, z] (additive on top of the locomotion pose),
//               $hips: [x, y, z] (additive hips offset, model units),
//               $air: 0..1 (legs tuck with the body), $footL / $footR / $<legId>: [x, y, z, paw?, meta?] foot target,
//               $handR: [x, y, z] grip point target, $aimR: [hx, hy, hz, bx, by, bz] haft + blade directions,
//               $poleR: [x, y, z] elbow hint, $gripL: 0..1 (left hand onto the weapon's second grip),
//               $handL / $aimL / $poleL (free left hand IK), $charge, $body, $counter, $ghost, $eyes, $shake … },
//          ease], …]
//   A channel value of null releases it back to the base pose from that key on.
//   ease (of the segment ending at this key): 'io' (default) | 'i' | 'i3' | 'o' | 'o3' | 'l' | 's' (step) | 'b' (overshoot)
import * as THREE from 'three';
import { solveIK, frameRot } from '../../kit/rig.js';

export const EASE = {
  io: t => t * t * (3 - 2 * t),
  i: t => t * t,
  i3: t => t * t * t,
  o: t => 1 - (1 - t) * (1 - t),
  o3: t => 1 - (1 - t) ** 3,
  l: t => t,
  s: t => (t >= 1 ? 1 : 0),
  b: t => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
};

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();

const VEC_CH = new Set(['$hips', '$handR', '$handL', '$poleR', '$poleL', '$look']);
const AIM_CH = new Set(['$aimR', '$aimL']);

/** Compile an action definition into tracks. rig: kit Rig (bone name → index). */
export function compileAction(name, def, rig) {
  const D = def.dur;
  const keys = (def.keys || []).slice().sort((a, b) => a[0] - b[0]);
  if (!keys.length || keys[0][0] > 0) keys.unshift([0, {}]);
  const times = keys.map(k => Math.min(1, k[0] / D));
  const eases = keys.map(k => EASE[k[2] || 'io'] || EASE.io);
  const names = new Set();
  for (const k of keys) for (const c of Object.keys(k[1])) names.add(c);
  const tracks = [];
  for (const c of names) {
    const add = c.endsWith('+');
    const base = add ? c.slice(0, -1) : c;
    const isBone = !base.startsWith('$');
    if (isBone && !rig.has(base)) { console.warn(`[legion] ${name}: unknown bone ${base}`); continue; }
    const kind = isBone ? 'bone' : VEC_CH.has(base) ? 'vec' : AIM_CH.has(base) ? 'aim' : base.startsWith('$foot') || base.startsWith('$leg') ? 'foot' : 'num';
    const vals = [], ws = [];
    let cur = null, w = 0;
    // first defined value (used as the value while the weight ramps in)
    let first = null; for (const k of keys) if (k[1][c] !== undefined && k[1][c] !== null) { first = k[1][c]; break; }
    for (const k of keys) {
      const v = k[1][c];
      if (v === null) { w = 0; }
      else if (v !== undefined) { cur = v; w = 1; }
      vals.push(cur ?? first); ws.push(w);
    }
    const tr = { ch: base, add, kind, ws, bone: isBone ? rig.index(base) : -1 };
    if (kind === 'bone') tr.q = vals.map(v => new THREE.Quaternion().setFromEuler(_e.set(v[0], v[1], v[2], 'YXZ')));
    else if (kind === 'aim') tr.a = vals.map(v => ({ h: new THREE.Vector3(v[0], v[1], v[2]).normalize(), b: new THREE.Vector3(v[3], v[4], v[5]).normalize() }));
    else tr.v = vals.map(v => (Array.isArray(v) ? v.slice() : v));
    tracks.push(tr);
  }
  return {
    name, def, D, times, eases, tracks,
    hits: (def.hits || []).slice(), ev: (def.ev || []).slice().sort((a, b) => a[0] - b[0]),
    stretch: def.stretch || null, sustain: def.sustain || null,
    hold: !!def.hold, fadeIn: def.fadeIn ?? 0.16, fadeOut: def.fadeOut ?? 0.32, fn: def.fn || null,
  };
}

/** Real time (played) → definition time, and the inverse, for a played duration `dur`. */
export function warp(C, dur) {
  const D = C.D;
  if (Math.abs(dur - D) < 1e-6) return { toDef: t => t, toReal: t => t };
  const S = C.stretch;
  if (S) {
    const L = S[1] - S[0], L2 = L + (dur - D);
    if (L2 > 0.05) return {
      toDef: t => (t < S[0] ? t : t < S[0] + L2 ? S[0] + (t - S[0]) * L / L2 : t - (dur - D)),
      toReal: t => (t < S[0] ? t : t < S[1] ? S[0] + (t - S[0]) * L2 / L : t + (dur - D)),
    };
  }
  const k = dur / D;
  return { toDef: t => t / k, toReal: t => t * k };
}

/** Sample every track of a compiled action at definition time td. Writes into out (Map ch → value/weight). */
export function sample(C, td, out) {
  const u = Math.min(1, Math.max(0, td / C.D));
  const T = C.times;
  let i = 0; while (i < T.length - 1 && T[i + 1] <= u) i++;
  const j = Math.min(i + 1, T.length - 1);
  const f = j === i ? 0 : C.eases[j]((u - T[i]) / Math.max(1e-6, T[j] - T[i]));
  for (const tr of C.tracks) {
    let o = out.get(tr);
    if (!o) { o = { w: 0, q: new THREE.Quaternion(), v: null, h: new THREE.Vector3(), b: new THREE.Vector3() }; out.set(tr, o); }
    const w0 = tr.ws[i], w1 = tr.ws[j];
    o.w = w0 + (w1 - w0) * Math.min(1, Math.max(0, f));
    if (tr.kind === 'bone') o.q.copy(tr.q[i]).slerp(tr.q[j], f);
    else if (tr.kind === 'aim') {
      o.h.copy(tr.a[i].h).lerp(tr.a[j].h, f).normalize(); o.b.copy(tr.a[i].b).lerp(tr.a[j].b, f).normalize();
    } else if (tr.kind === 'num') o.v = tr.v[i] + (tr.v[j] - tr.v[i]) * f;
    else {
      const a = tr.v[i], b = tr.v[j];
      if (!o.v || o.v.length !== a.length) o.v = a.slice();
      for (let k = 0; k < a.length; k++) o.v[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * f;
    }
  }
  return out;
}

/**
 * Spring chain (secondary motion): each bone's tip is a damped spring point following the animated tip, simulated
 * in model space with root-motion compensation (so capes trail when the boss walks or turns).
 * cfg: { bones: [names], tips?: [[x,y,z]] (rest tip of the last bone), k, d, g (gravity scale), coll: [{bone, c:[x,y,z], r}] }
 */
export class SpringChain {
  constructor(pose, rig, cfg) {
    this.cfg = cfg;
    this.idx = cfg.bones.map(n => rig.index(n));
    this.tip = this.idx.map((b, i) => {
      if (i < this.idx.length - 1) return pose.rest[this.idx[i + 1]].clone();
      const t = cfg.tip; return t ? new THREE.Vector3(...t) : pose.rest[b].clone().add(pose.rest[b].clone().sub(pose.rest[this.idx[Math.max(0, i - 1)]]).multiplyScalar(0.8));
    });
    this.len = this.idx.map((b, i) => this.tip[i].distanceTo(pose.rest[b]));
    this.x = this.idx.map(() => new THREE.Vector3()); this.v = this.idx.map(() => new THREE.Vector3());
    this.init = false;
    this.coll = (cfg.coll || []).map(c => ({ bone: rig.index(c.bone), c: new THREE.Vector3(...c.c), r: c.r }));
    this.k = cfg.k ?? 40; this.d = cfg.d ?? 7; this.g = cfg.g ?? 1;
  }
  /** delta: Matrix4 mapping last frame's model space into this frame's (root motion); rot: its rotation part. */
  update(P, dt, delta, gravity, weight = 1) {
    const n = this.idx.length;
    for (let i = 0; i < n; i++) {
      const b = this.idx[i];
      const head = P.wp[b];
      const tipA = P.carry(b, this.tip[i], _v);
      const x = this.x[i], v = this.v[i];
      if (!this.init) { x.copy(tipA); v.set(0, 0, 0); }
      else if (dt > 0) {
        x.applyMatrix4(delta.m); v.applyQuaternion(delta.q);
        const steps = dt > 1 / 45 ? 2 : 1, h = dt / steps;
        for (let s = 0; s < steps; s++) {
          _v2.subVectors(tipA, x).multiplyScalar(this.k);
          _v2.addScaledVector(v, -this.d);
          _v2.y -= gravity * this.g;
          v.addScaledVector(_v2, h); x.addScaledVector(v, h);
        }
      }
      // length constraint + collisions
      _v3.subVectors(x, head); let l = _v3.length() || 1e-6; x.copy(head).addScaledVector(_v3, this.len[i] / l);
      for (const c of this.coll) {
        P.carry(c.bone, c.c, _v4);
        _v3.subVectors(x, _v4); const dd = _v3.length();
        if (dd < c.r) { x.copy(_v4).addScaledVector(_v3, c.r / (dd || 1e-6)); _v3.subVectors(x, head); l = _v3.length() || 1e-6; x.copy(head).addScaledVector(_v3, this.len[i] / l); }
      }
      // rotate the bone so its tip points at x (weighted)
      _v3.subVectors(tipA, head).normalize(); _v4.subVectors(x, head).normalize();
      _q.setFromUnitVectors(_v3, _v4);
      if (weight < 1) _q.slerp(_q2.identity(), 1 - weight);
      P.wq[b].premultiply(_q);
      P.fkChildren(b);
    }
    this.init = true;
  }
  reset() { this.init = false; }
}

/**
 * Two-bone arm IK with hand orientation. chain: makeChain() result for [upper, lower, hand].
 * target: wrist position (model space); handQ: desired hand world rotation (or null to keep FK); w: blend weight.
 */
const _sq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], _sp = [new THREE.Vector3(), new THREE.Vector3()];
export function armIK(P, ch, hand, target, pole, handQ, w) {
  if (w <= 0.001) return;
  _sq[0].copy(P.wq[ch.a]); _sq[1].copy(P.wq[ch.b]); _sq[2].copy(P.wq[hand]); _sp[0].copy(P.wp[ch.b]); _sp[1].copy(P.wp[ch.c]);
  solveIK(P, ch, target, pole);
  if (handQ) P.wq[hand].copy(handQ); else P.wq[hand].copy(_sq[2]);
  if (w < 0.999) {
    P.wq[ch.a].slerp(_sq[0], 1 - w); P.wq[ch.b].slerp(_sq[1], 1 - w); P.wq[hand].slerp(_sq[2], 1 - w);
    // re-derive joint positions from the blended rotations (keeps bone lengths)
    P.wp[ch.b].copy(P.rest[ch.b]).sub(P.rest[ch.a]).applyQuaternion(P.wq[ch.a]).add(P.wp[ch.a]);
    P.wp[ch.c].copy(P.rest[ch.c]).sub(P.rest[ch.b]).applyQuaternion(P.wq[ch.b]).add(P.wp[ch.b]);
  }
  P.fkChildren(hand);
}

/** Hand world rotation that carries the weapon's rest frame (haft h0, blade b0) onto (h, b). */
export function weaponQ(out, h0, b0, h, b) { return frameRot(out, h0, b0, h, b); }

export { _e as TMP_EULER };
