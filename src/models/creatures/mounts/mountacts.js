// Mount actions shared by horse / direwolf / sunstag (QuadCtl bones: body, chest, hips, neck, neck2?, head, jaw, seat?,
// tail[], gait legs FL FR RL RR). All allocation-free in fn(); o = per-species proportions.
import { legTo, pivotPitch, sstep, clamp01, mix, TAU, ease } from './common.js';

const sideOf = (a) => (Math.sin(a.seed * 7.13) > 0 ? 1 : -1);
const rx2 = (ctl, amt) => { if (ctl.b.neck2 !== undefined) ctl.pose.rx(ctl.b.neck2, amt); };
const ry2 = (ctl, x, y, z) => { if (ctl.b.neck2 !== undefined) ctl.pose.rot(ctl.b.neck2, x, y, z); };
const seatK = (ctl, x, z, w) => { if (ctl.b.seat !== undefined) ctl.pose.rot(ctl.b.seat, x * w, 0, z * w); };
const tail = (ctl, x, y) => { const T = ctl.b.tail; if (T) for (let i = 0; i < T.length; i++) ctl.pose.rot(T[i], x / T.length, y / T.length, 0); };

/** Rear up on the hind legs: forelegs paw the air, head tosses, whinny. o: { dur, ang, sit, neck, lift (front tuck height), reach } */
export function mRear(o = {}) {
  const lift = o.lift ?? 0.42, reach = o.reach ?? 0.3;
  return { dur: o.dur ?? 2.4, a: 0.001, d: 0.999, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0.08, 0.34, k) * (1 - sstep(0.7, 0.9, k));
    const gather = sstep(0, 0.1, k) * (1 - sstep(0.1, 0.26, k));
    const land = sstep(0.86, 0.91, k) * (1 - sstep(0.91, 1, k));
    const th = (o.ang ?? 0.95) * ease.io(up) + 0.03 * gather - 0.04 * land;
    const hp = P.rest[b.hips];
    pivotPitch(ctl, b.body, [0, hp.y - (o.sit ?? 0.3) * up, hp.z], th, w);
    P.move(b.body, 0, (-0.04 * gather - 0.06 * land) * w, 0);
    P.rx(b.hips, -0.22 * up * w); P.rx(b.chest, 0.06 * up * w);
    const toss = Math.sin(t * 5.2) * up, sh = Math.sin(t * 11) * sstep(0.35, 0.45, k) * (1 - sstep(0.6, 0.7, k));
    P.rot(b.neck, (-(o.neck ?? 0.42) * up) * w, 0.12 * toss * w, 0);
    ry2(ctl, -0.2 * up * w, 0.15 * toss * w, 0.1 * toss * w);
    P.rot(b.head, (0.25 * up + 0.08 * sh) * w, 0.1 * toss * w, 0.15 * sh * w);
    ctl.jaw = Math.max(ctl.jaw, (0.3 + 0.12 * Math.sin(t * 30)) * sstep(0.32, 0.4, k) * (1 - sstep(0.62, 0.7, k)) * w * (o.jaw ?? 1));
    ctl.ear = mix(ctl.ear, 0.7, up * w);
    tail(ctl, 0.5 * up * w, 0);
    seatK(ctl, -0.45 * th, 0, w);
    const G = ctl.gait;
    for (let i = 0; i < G.legs.length; i++) {
      const L = G.legs[i];
      if (L.id[0] === 'F') { // forelegs: tuck & paw alternately
        const pw = 0.5 + 0.5 * Math.sin(t * 6.5 + (L.side > 0 ? Math.PI : 0));
        legTo(L, L.toe.x * 0.9, L.toe.y + lift + 0.12 * pw, L.toe.z + 0.06 - reach * pw, up * w, true, -1.2 + 0.7 * pw, -1.9 + 1.5 * pw);
      } else legTo(L, L.F.x, L.F.y, L.F.z, up * w, false, 0);
    }
  } };
}

/** Jump (in place; the game moves the root): gather, launch, tuck, reach, land. o: { dur, h, pitch } */
export function mJump(o = {}) {
  const hgt = o.h ?? 0.55;
  return { dur: o.dur ?? 1.15, a: 0.001, d: 0.999, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const crouch = sstep(0, 0.16, k) * (1 - sstep(0.16, 0.26, k));
    const air = clamp01((k - 0.24) / 0.5), inAir = k > 0.24 && k < 0.74 ? 1 : 0;
    const arc = Math.sin(air * Math.PI) * inAir;
    const land = sstep(0.72, 0.79, k) * (1 - sstep(0.79, 1, k));
    const pitch = (o.pitch ?? 0.3) * sstep(0.12, 0.28, k) * (1 - sstep(0.3, 0.52, k)) - (o.pitch ?? 0.3) * 0.85 * sstep(0.5, 0.68, k) * (1 - sstep(0.72, 0.9, k));
    P.move(b.body, 0, (-0.09 * crouch + hgt * arc - 0.07 * land) * w, 0);
    P.rx(b.body, (pitch - 0.04 * crouch) * w);
    P.rot(b.neck, (-0.15 * crouch + 0.12 * arc - 0.1 * land) * w, 0, 0);
    rx2(ctl, 0.1 * arc * w);
    P.rx(b.head, (-0.1 * arc) * w);
    tail(ctl, -0.5 * arc * w, 0);
    ctl.ear = mix(ctl.ear, 0.3, arc * w);
    seatK(ctl, -0.4 * pitch, 0, w);
    const G = ctl.gait;
    const tuckF = sstep(0.22, 0.32, k) * (1 - sstep(0.58, 0.7, k)), reachF = sstep(0.55, 0.68, k) * (1 - sstep(0.72, 0.8, k));
    const pushH = sstep(0.16, 0.26, k) * (1 - sstep(0.3, 0.4, k)), tuckH = sstep(0.3, 0.42, k) * (1 - sstep(0.62, 0.74, k));
    for (let i = 0; i < G.legs.length; i++) {
      const L = G.legs[i];
      if (L.id[0] === 'F') {
        if (tuckF > 0) legTo(L, L.toe.x * 0.95, L.toe.y + (o.tuck ?? 0.45), L.toe.z + 0.08, tuckF * w, true, -1.3, -2.0);
        if (reachF > 0) legTo(L, L.toe.x, L.toe.y + 0.1, L.toe.z - 0.28, reachF * w, true, -0.2, 0.3);
      } else {
        if (pushH > 0) legTo(L, L.toe.x, L.toe.y + 0.08, L.toe.z + 0.32, pushH * w, true, 0.4, 0.6);
        if (tuckH > 0) legTo(L, L.toe.x, L.toe.y + (o.tuckH ?? 0.3), L.toe.z - 0.05, tuckH * w, true, -0.6, 1.2);
      }
    }
  } };
}

/** Graze: neck down to the grass, nibble, chew, ears relaxed. o: { dur, neck, neck2, head } */
export function mGraze(o = {}) {
  return { dur: o.dur ?? 5, a: 0.1, d: 0.88, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    const nib = Math.pow(Math.max(0, Math.sin(t * 2.6)), 4);
    P.rot(b.neck, (o.neck ?? -0.95) * w, Math.sin(t * 0.6) * 0.12 * w, 0);
    rx2(ctl, (o.neck2 ?? -0.35) * w);
    P.rot(b.head, ((o.head ?? 0.35) + 0.08 * nib) * w, Math.sin(t * 0.9) * 0.1 * w, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.06 + 0.1 * Math.max(0, Math.sin(t * 9))) * w);
    ctl.ear = mix(ctl.ear, 0.25 + 0.2 * Math.sin(t * 0.7), w);
    P.rx(b.chest, -0.04 * w);
    seatK(ctl, 0.03, 0, w);
  } };
}

/** Shake: head & mane shake (mane springs pick the motion up), snort. o: { dur, amp } */
export function mShake(o = {}) {
  const A = o.amp ?? 1;
  return { dur: o.dur ?? 1.6, a: 0.08, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const s = Math.sin(clamp01((k - 0.1) / 0.75) * Math.PI) * w * A, f = Math.sin(t * 24);
    P.rot(b.neck, 0.1 * s, f * 0.12 * s, f * 0.1 * s);
    ry2(ctl, 0, f * 0.16 * s, f * 0.14 * s);
    P.rot(b.head, -0.1 * s, f * 0.22 * s, f * 0.28 * s);
    P.rot(b.chest, 0, 0, f * 0.03 * s);
    ctl.ear = mix(ctl.ear, 0.5 + f * 0.5, s);
    ctl.jaw = Math.max(ctl.jaw, 0.08 * s);
  } };
}

/** Paw the ground with a foreleg (restless). o: { dur, leg (index), lift } */
export function mPaw(o = {}) {
  return { dur: o.dur ?? 2.2, a: 0.1, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const L = ctl.gait.legs[o.leg ?? 1];
    const on = sstep(0.08, 0.2, k) * (1 - sstep(0.82, 0.95, k));
    const cyc = (t * 2.4) % 1, strike = Math.sin(cyc * TAU);
    const y = (o.lift ?? 0.22) * Math.max(0, strike) + 0.01, z = L.home.z - 0.14 * Math.cos(cyc * TAU);
    legTo(L, L.home.x, y * on, mix(L.F.z, z, on), on * w, false, -0.6 * Math.max(0, strike), mix(0, -0.8, Math.max(0, strike)));
    P.rot(b.neck, -0.15 * on * w, (L.side > 0 ? -0.1 : 0.1) * on * w, 0);
    P.rx(b.head, 0.15 * on * w);
    ctl.ear = mix(ctl.ear, 0.2, on * w);
    seatK(ctl, 0, 0, w);
  } };
}

/** Tail swish (flies!) + skin twitch */
export function mSwish(o = {}) {
  return { dur: o.dur ?? 1.4, a: 0.1, d: 0.8, fn(ctl, a, w) {
    const P = ctl.pose, T = ctl.b.tail, t = a.t, k = a.k;
    const s = Math.sin(clamp01(k) * Math.PI) * w;
    if (T) for (let i = 0; i < T.length; i++) P.rot(T[i], -0.08 * s, Math.sin(t * 9 - i * 0.7) * (0.25 + 0.1 * i) * s, 0);
    P.rot(ctl.b.head, 0, Math.sin(t * 2) * 0.2 * s, 0);
    ctl.ear = mix(ctl.ear, -0.2, s);
  } };
}

/** Whinny / call: head up, mouth open with vibrato, a stamp. o: { dur, jaw } */
export function mWhinny(o = {}) {
  return { dur: o.dur ?? 1.8, a: 0.1, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const up = sstep(0, 0.2, k) * (1 - sstep(0.75, 1, k)), call = sstep(0.18, 0.28, k) * (1 - sstep(0.65, 0.8, k));
    P.rot(b.neck, 0.28 * up * w, 0, 0);
    ry2(ctl, 0.12 * up * w, Math.sin(t * 7) * 0.06 * call * w, 0);
    P.rot(b.head, (0.3 * up + 0.05 * Math.sin(t * 13) * call) * w, 0, Math.sin(t * 9) * 0.08 * call * w);
    ctl.jaw = Math.max(ctl.jaw, ((o.jaw ?? 0.35) + 0.08 * Math.sin(t * 34)) * call * w);
    ctl.ear = mix(ctl.ear, -0.3, up * w);
    P.move(b.body, 0, 0.015 * up * w, 0.02 * up * w);
    P.rx(b.body, 0.04 * up * w);
    tail(ctl, -0.2 * up * w, 0);
  } };
}

/** Hit flinch */
export function mHit(o = {}) {
  return { dur: o.dur ?? 0.5, a: 0.04, d: 0.5, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, s = sideOf(a);
    const j = sstep(0, 0.1, k) * (1 - sstep(0.25, 1, k)) * w;
    P.move(b.body, 0.03 * s * j, 0.02 * j, 0.04 * j);
    P.rot(b.body, 0.05 * j, 0, 0.05 * s * j);
    P.rot(b.neck, 0.28 * j, 0.22 * s * j, 0); rx2(ctl, 0.1 * j);
    P.rx(b.head, 0.22 * j);
    ctl.ear = mix(ctl.ear, 1.1, j); ctl.jaw = Math.max(ctl.jaw, 0.28 * j * (o.jaw ?? 1));
    seatK(ctl, -0.03 * j, -0.03 * s * j, 1);
  } };
}

/** Death: stumble, knees buckle, collapse onto the side and lie still (holds). o: { dur, lieY, roll } */
export function mDeath(o = {}) {
  return { dur: o.dur ?? 2.3, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true,
    start(ctl, a) { a.u.side = sideOf(a); },
    fn(ctl, a, w) {
      const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, s = a.u.side;
      const buckle = sstep(0.0, 0.28, k), fall = ease.in(clamp01((k - 0.2) / 0.36)), settle = sstep(0.55, 0.85, k);
      const by = P.rest[b.body].y, lieY = o.lieY ?? 0.4;
      const bounce = Math.sin(clamp01((k - 0.56) / 0.12) * Math.PI) * 0.04;
      P.move(b.body, 0, (-(by - lieY) * fall - 0.22 * buckle * (1 - fall) + bounce) * w, 0.12 * fall * w);
      P.rot(b.body, (-0.3 * buckle * (1 - fall) + 0.04 * fall) * w, 0.12 * s * fall * w, s * (o.roll ?? 1.4) * ease.io(fall) * w);
      P.rot(b.neck, (-0.35 * buckle * (1 - fall) - 0.15 * fall) * w, 0, -s * 0.15 * fall * w);
      ry2(ctl, -0.15 * fall * w, 0, -s * 0.2 * settle * w);
      P.rot(b.head, (0.2 * fall) * w, 0, -s * 0.25 * settle * w);
      ctl.jaw = Math.max(ctl.jaw, (0.15 + 0.1 * (1 - settle)) * w);
      ctl.ear = mix(ctl.ear, 0.9, w);
      tail(ctl, 0.3 * fall * w, s * 0.4 * settle * w);
      const G = ctl.gait;
      for (let i = 0; i < G.legs.length; i++) {
        const L = G.legs[i], front = L.id[0] === 'F';
        // buckle: front knees fold under; then legs carried by the body, slightly bent
        if (buckle * (1 - fall) > 0) legTo(L, L.toe.x, front ? 0.02 : 0, front ? L.toe.z + 0.18 : L.toe.z, buckle * (1 - fall) * w, false, front ? -1.4 : 0, front ? -1.7 : undefined);
        const bend = front ? 0.18 + 0.1 * (i % 2) : 0.14 + 0.12 * (i % 2);
        const hip = P.rest[L.idx[0]];
        legTo(L, L.toe.x * 1.15, L.toe.y + (hip.y - L.toe.y) * bend, L.toe.z + (front ? -0.1 : 0.08) * fall, fall * w, true, -0.5, front ? -0.4 : 0.6);
      }
      ctl.glow = mix(ctl.glow, 0.2, sstep(0.3, 1.6, t) * w);
      seatK(ctl, 0, 0, w);
    } };
}

/** Spawn / summon: bounds in from thin air (pair with setDissolve 1→0): drops from a leap, lands, tosses its head. */
export function mSpawn(o = {}) {
  const hgt = o.h ?? 0.7;
  return { dur: o.dur ?? 1.6, a: 0.001, d: 0.95, state: true, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const fallK = clamp01(k / 0.3), y = hgt * (1 - fallK * fallK);
    const land = sstep(0.28, 0.34, k) * (1 - sstep(0.36, 0.6, k));
    const toss = sstep(0.5, 0.6, k) * (1 - sstep(0.8, 0.95, k));
    const pitch = 0.18 * (1 - fallK) - 0.1 * land;
    P.move(b.body, 0, (y - 0.1 * land) * w, (0.35 * (1 - fallK)) * w);
    P.rx(b.body, pitch * w);
    P.rot(b.neck, (0.1 * (1 - fallK) - 0.2 * land + 0.25 * toss) * w, 0, 0);
    ry2(ctl, 0, Math.sin(t * 9) * 0.12 * toss * w, Math.sin(t * 9) * 0.1 * toss * w);
    P.rot(b.head, (0.2 * toss) * w, Math.sin(t * 9) * 0.1 * toss * w, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.3 * toss * (o.jaw ?? 1) * w);
    ctl.glow = mix(ctl.glow, o.glow ?? 1.6, (1 - fallK) * w);
    tail(ctl, -0.4 * (1 - fallK) * w, 0);
    const G = ctl.gait, air = 1 - sstep(0.26, 0.32, k);
    for (let i = 0; i < G.legs.length; i++) {
      const L = G.legs[i];
      if (L.id[0] === 'F') legTo(L, L.toe.x, L.toe.y + 0.12, L.toe.z - 0.25, air * w, true, -0.3, 0.3);
      else legTo(L, L.toe.x, L.toe.y + 0.2, L.toe.z + 0.12, air * w, true, -0.5, 0.9);
    }
    seatK(ctl, -0.4 * pitch, 0, w);
  } };
}

/** Bow / kneel on one foreleg (sunstag greeting, mount-up). o: { dur, depth } */
export function mBow(o = {}) {
  return { dur: o.dur ?? 2.6, a: 0.12, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const d = sstep(0, 0.3, k) * (1 - sstep(0.72, 1, k));
    const cp = P.rest[b.chest];
    pivotPitch(ctl, b.body, [0, P.rest[b.hips].y, P.rest[b.hips].z], -(o.pitch ?? 0.22) * d, w);
    P.rot(b.neck, -0.45 * d * w, 0, 0); rx2(ctl, -0.2 * d * w); P.rx(b.head, 0.35 * d * w);
    const G = ctl.gait;
    const L = G.legs[0], R = G.legs[1];
    legTo(L, L.toe.x, 0.02, L.toe.z + 0.3, d * w, false, -1.5, -1.8);   // kneel on the left foreleg (cannon flat on the ground)
    legTo(R, R.toe.x * 1.05, 0, R.toe.z - 0.12, d * w, false, 0.1, 0.4);
    ctl.ear = mix(ctl.ear, 0.1, d * w);
    tail(ctl, 0.15 * d * w, 0);
    seatK(ctl, (o.pitch ?? 0.22) * 0.5 * d, 0, w);
    void cp;
  } };
}
