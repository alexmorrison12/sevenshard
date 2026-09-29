// Generic whole-body actions shared by every creature family (parameterised by body proportions):
// hit, knockback, knockdown (hold) → getup, death (a satisfying fling / collapse, holds), stun (loop), spawn (claw out of
// the ground / drop from a portal), roar. Species files add their own attacks on top.
import { legsLocal, legsPlant, legsLie, armRot, ease, sstep, clamp01, mix, TAU } from './ctl.js';

/** piecewise smooth interpolation through keys (T ascending) */
/** Time-warp for re-timing an authored action: normalised k where the authored impact (`from`) should land at `to`. */
export const retime = (k, from, to) => k < to ? k * from / to : from + (k - to) * (1 - from) / (1 - to);
export function kf(k, T, V) {
  if (k <= T[0]) return V[0];
  for (let i = 1; i < T.length; i++) if (k <= T[i]) { const u = (k - T[i - 1]) / (T[i] - T[i - 1]); return V[i - 1] + (V[i] - V[i - 1]) * u * u * (3 - 2 * u); }
  return V[V.length - 1];
}
const sideOf = (a) => (Math.sin(a.seed * 7.13) > 0 ? 1 : -1);
// knockdown → getup / lying death continuity: the side it fell on is stored on the controller at knockdown start, and
// the backward slide of the fall (in body heights) is carried through the getup / lying death so nothing pops
const downSide = (ctl, a) => ctl.downSide || sideOf(a);
const KD_ZB = 0.2, KD_ZQ = 0.15;
const hipsY = (ctl) => ctl.pose.rest[ctl.b.hips].y;
const bodyY = (ctl) => ctl.pose.rest[ctl.b.body].y;

// ============================================================================================== bipeds
// legs of a biped lying on its back: resting on the ground in front (legsLie) — or, for bodies flipped past vertical
// (pitch > 1.7, e.g. a bird on its back), tucked up relative to the body
const lieLegs = (ctl, w, o, slide) => { if ((o.pitch ?? 1.5) <= 1.7) legsLie(ctl, w, slide, o.lieLegs); else legsLocal(ctl, w, 0.04, 1.2, 0, o.legBack ?? 0.28); };
function bLieLimbs(ctl, w, side, t, o, slide = 0) {
  const P = ctl.pose, b = ctl.b;
  const br = Math.sin(t * 2.4) * 0.03;
  P.rx(b.spine, (0.05 + br) * w); P.rx(b.chest, (0.06 - br) * w);
  if (b.neck !== undefined) P.rx(b.neck, -0.1 * w);
  P.rot(b.head, -0.15 * w, 0.6 * side * w, 0.15 * side * w);
  armRot(ctl, -1, o.armUp ?? -0.2, 0.25, w, o.armOut ?? 1.15);
  armRot(ctl, 1, (o.armUp ?? -0.2) * 0.6, 0.35, w, (o.armOut ?? 1.15) * 0.8);
  if (b.tail) for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], 0.25 * w, side * 0.2 * w, 0);
  ctl.jaw = Math.max(ctl.jaw, 0.3 * w);
  ctl.wingSpread = mix(ctl.wingSpread, o.wingLie ?? 0.9, w);
  lieLegs(ctl, w, o, slide);
}
/** Lying on the back exactly as bKnockdown leaves the body (for custom deaths from the knockdown: pass ctl.downSide,
 *  ctl.downO || own options) — keeps knockdown → death continuity. */
export function bLie(ctl, w, side, t, o) {
  const P = ctl.pose, b = ctl.b, lie = hipsY(ctl) - (o.lieY ?? ctl.H * 0.11);
  P.move(b.hips, 0, -lie * w, KD_ZB * ctl.H * w);
  P.rot(b.hips, (o.pitch ?? 1.5) * w, 0, 0.1 * side * w);
  bLieLimbs(ctl, w, side, t, o, KD_ZB * ctl.H);
}

export function bHit(o = {}) {
  return { dur: o.dur ?? 0.42, a: 0.05, d: 0.4, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, s = sideOf(a);
    const j = sstep(0, 0.12, k) * (1 - sstep(0.25, 1, k)) * w;
    P.move(b.hips, 0, -0.02 * ctl.H * j, 0.05 * ctl.H * j);
    P.rot(b.spine, 0.28 * j, 0.15 * s * j, 0.1 * s * j); P.rx(b.chest, 0.12 * j);
    P.rot(b.head, 0.35 * j, 0.3 * s * j, 0.1 * s * j);
    armRot(ctl, -1, 0.5, 0.6, j, 0.3); armRot(ctl, 1, 0.4, 0.6, j, 0.3);
    ctl.jaw = Math.max(ctl.jaw, 0.45 * j); ctl.ear = mix(ctl.ear, 1.2, j);
    ctl.wingSpread = mix(ctl.wingSpread, 0.6, j);
  } };
}

export function bKnockback(o = {}) {
  return { dur: o.dur ?? 0.9, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const j = sstep(0, 0.08, k) * (1 - sstep(0.45, 1, k)) * w;
    const skid = sstep(0.05, 0.2, k) * (1 - sstep(0.55, 0.95, k)) * w;
    P.move(b.hips, 0, -0.07 * H * skid, 0.1 * H * j);
    P.rx(b.hips, 0.22 * j);
    P.rx(b.spine, 0.35 * j); P.rx(b.chest, 0.2 * j);
    P.rot(b.head, 0.5 * j - 0.2 * skid, 0.2 * j * Math.sin(a.seed), 0);
    armRot(ctl, -1, 1.4 * j - 0.3 * skid, 0.4, 1, 0.5 * j); armRot(ctl, 1, 1.2 * j - 0.3 * skid, 0.5, 1, 0.5 * j);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * j); ctl.ear = mix(ctl.ear, 1.2, j);
    ctl.wingSpread = mix(ctl.wingSpread, 1, j); ctl.flap = Math.max(ctl.flap, 0.6 * j);
    legsPlant(ctl, skid, 1.35, 0.06 * H);
  } };
}

export function bKnockdown(o = {}) {
  return { dur: o.dur ?? 0.8, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0,
    start(ctl, a) { ctl.downSide = sideOf(a); ctl.downO = o; },
    fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, s = downSide(ctl, a), H = ctl.H;
    const lie = hipsY(ctl) - (o.lieY ?? H * 0.11);
    const fall = ease.in(clamp01((k - 0.08) / 0.55));
    const bounce = Math.sin(clamp01((k - 0.63) / 0.2) * Math.PI) * 0.05 * H;
    const jolt = sstep(0, 0.08, k) * (1 - sstep(0.1, 0.5, k));
    P.move(b.hips, 0, (-lie * fall + bounce + 0.04 * H * jolt) * w, (KD_ZB * H * ease.out(k / 0.6)) * w);
    P.rot(b.hips, ((o.pitch ?? 1.5) * fall + 0.2 * jolt) * w, 0, 0.1 * s * fall * w);
    armRot(ctl, -1, 1.5 * jolt, 0.3, w, 0.5 * jolt); armRot(ctl, 1, 1.3 * jolt, 0.3, w, 0.5 * jolt);
    // struggle twitches while down
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + a.seed)), 12) * sstep(1.2, 1.6, t);
    P.rx(b.chest, -0.25 * tw * w); P.rx(b.head, -0.3 * tw * w);
    bLieLimbs(ctl, fall * w, s, t, o, KD_ZB * H * ease.out(k / 0.6));
    ctl.jaw = Math.max(ctl.jaw, 0.4 * jolt * w);
  } };
}

const GU_T = [0, 0.3, 0.62, 1], GU_Y = [-1, -0.8, -0.45, 0], GU_P = [1.5, 0.55, -0.35, 0], GU_S = [0.05, -0.35, -0.2, 0], GU_A = [0.35, -0.5, 0.7, 0];
export function bGetup(o = {}) {
  return { dur: o.dur ?? 1.0, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H, side = ctl.downSide || 1;
    const lie = hipsY(ctl) - (o.lieY ?? H * 0.11);
    const pitch = kf(k, GU_T, GU_P) * (o.pitch ?? 1.5) / 1.5;
    const f = sstep(0, 0.3, k), lw0 = (1 - f) * w; // f: lying pose → getup pose
    P.move(b.hips, 0, kf(k, GU_T, GU_Y) * lie * w, KD_ZB * H * (1 - sstep(0.3, 1, k)) * w);
    P.rot(b.hips, pitch * w, 0, 0.1 * side * lw0);
    P.rx(b.spine, kf(k, GU_T, GU_S) * w); P.rx(b.chest, kf(k, GU_T, GU_S) * 0.6 * w);
    if (b.neck !== undefined) P.rx(b.neck, -0.1 * lw0);
    P.rot(b.head, (0.2 * sstep(0.2, 0.6, k) * (1 - sstep(0.7, 1, k))) * w - 0.15 * lw0, 0.6 * side * lw0, 0.15 * side * lw0);
    if (b.tail) for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], 0.25 * lw0, side * 0.2 * lw0, 0);
    const au = kf(k, GU_T, GU_A), aw = w * (1 - sstep(0.75, 1, k)), lo = 0.3 + 0.4 * sstep(0.3, 0.6, k), out = 0.5 * (1 - sstep(0.3, 0.7, k));
    const armUp = o.armUp ?? -0.2, armOut = o.armOut ?? 1.15;
    armRot(ctl, -1, mix(armUp, au, f), mix(0.25, lo, f), aw, mix(armOut, out, f));
    armRot(ctl, 1, mix(armUp * 0.6, au, f), mix(0.35, lo, f), aw, mix(armOut * 0.8, out, f));
    const lw = 1 - sstep(0.22, 0.42, k), pw = sstep(0.22, 0.42, k) * (1 - sstep(0.8, 1, k));
    if (lw > 0) lieLegs(ctl, lw * w, o, KD_ZB * H * (1 - sstep(0.3, 1, k)));
    if (pw > 0) legsPlant(ctl, pw * w, 1.25, 0.05 * H);
    ctl.jaw = Math.max(ctl.jaw, 0.3 * lw0);
    ctl.wingSpread = mix(ctl.wingSpread, mix(o.wingLie ?? 0.9, 0.8, f), (1 - k) * w);
  } };
}

/** death: flung back (maybe a full backflip), lands on its back, bounces, goes limp. o: { dist, peak, spin (0..1 chance), lieY } */
export function bDeath(o = {}) {
  return { dur: o.dur ?? 1.5, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true,
    start(ctl, a) { a.u.spin = Math.random() < (o.spin ?? 0.4) ? 1 : 0; a.u.side = sideOf(a); a.u.dist = (o.dist ?? 1.6) * (0.75 + Math.random() * 0.5); },
    fn(ctl, a, w) {
      const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H, s = a.u.fromDown ? (ctl.downSide || a.u.side) : a.u.side;
      if (a.u.fromDown) { bLie(ctl, w, s, t, ctl.downO || o); const tw = Math.sin(t * 30) * 0.08 * (1 - sstep(0.1, 0.6, t)); P.rx(b.chest, -tw * w); ctl.jaw = Math.max(ctl.jaw, 0.5 * w); return; }
      const lie = hipsY(ctl) - (o.lieY ?? H * 0.11), dist = a.u.dist * H, peak = (o.peak ?? 0.45) * H;
      const T1 = o.air ?? 0.38;
      const u = clamp01(k / T1);
      const land = sstep(T1 * 0.75, T1 * 1.1, k);
      const fz = ease.out(u) * dist + sstep(T1, T1 + 0.35, k) * dist * 0.16;
      const arc = 4 * u * (1 - u) * peak + Math.sin(clamp01((k - T1) / 0.13) * Math.PI) * peak * 0.2 * (k > T1 ? 1 : 0);
      const pitchLie = o.pitch ?? 1.5;
      const pitch = ease.out(u) * (pitchLie + a.u.spin * TAU);
      const roll = Math.sin(u * Math.PI) * 0.35 * s + 0.1 * s * land;
      P.move(b.hips, 0, (arc - lie * ease.io(u)) * w, fz * w);
      P.rot(b.hips, pitch * w, 0.3 * s * Math.sin(u * Math.PI) * w, roll * w);
      // limbs: flail in the air → limp
      const fl = (1 - land) * w;
      armRot(ctl, -1, 2.2 + 0.5 * Math.sin(t * 22), 0.35, fl, 0.9); armRot(ctl, 1, 2.0 + 0.5 * Math.sin(t * 19 + 1), 0.35, fl, 0.9);
      P.rot(b.head, 0.6 * fl, 0, 0); P.rx(b.spine, 0.3 * fl);
      ctl.jaw = Math.max(ctl.jaw, 0.7 * fl);
      ctl.wingSpread = mix(ctl.wingSpread, 1, fl); ctl.flap = Math.max(ctl.flap, fl * 0.8);
      if ((o.pitch ?? 1.5) <= 1.7) legsLocal(ctl, w, 0.3, 1.2); // tucked in the air; the lying legs blend in on landing
      else legsLocal(ctl, w, mix(0.3, 0.04, land), 1.2, 0, (o.legBack ?? 0.28) * land);
      bLieLimbs(ctl, land * w, s, t, o, fz);
      ctl.ear = mix(ctl.ear, 1.2, w);
      // eyes & veins fade out
      ctl.glow = mix(ctl.glow, 0.15, sstep(0.4, 1.4, t) * w);
    } };
}

export function bStun(o = {}) {
  return { dur: o.dur ?? 1.6, loop: true, state: true, fadeIn: 0.25, fadeOut: 0.3, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, ph = a.t / (o.dur ?? 1.6) * TAU, H = ctl.H;
    P.move(b.hips, Math.sin(ph) * 0.03 * H * w, -0.05 * H * w, 0);
    P.rot(b.hips, 0, 0, Math.sin(ph) * 0.1 * w);
    P.rot(b.spine, -0.2 * w, 0, -Math.sin(ph) * 0.08 * w);
    P.rot(b.head, (0.15 + 0.2 * Math.sin(ph)) * w, 0.35 * Math.cos(ph) * w, 0.2 * Math.sin(ph) * w);
    armRot(ctl, -1, 0.25, 0.3, w, 0.05); armRot(ctl, 1, 0.25, 0.3, w, 0.05);
    ctl.jaw = Math.max(ctl.jaw, 0.35 * w); ctl.ear = mix(ctl.ear, -0.3, w);
    ctl.wingSpread = mix(ctl.wingSpread, -0.5, w);
    legsPlant(ctl, w * 0.6, 1.3, 0);
  } };
}

/** spawn from the ground: claws break the surface, it hauls itself out, roars. o: { depth (×H), dur } */
export function bSpawn(o = {}) {
  return { dur: o.dur ?? 1.7, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const depth = (o.depth ?? 1.05) * H;
    const rise = sstep(0.08, 0.6, k);
    const y = -depth * (1 - rise) - 0.12 * H * sstep(0.55, 0.62, k) * (1 - sstep(0.62, 0.72, k));
    const wob = Math.sin(t * 16) * 0.16 * (1 - rise) * sstep(0.1, 0.2, k);
    P.move(b.hips, 0, y * w, 0);
    P.rot(b.hips, (-0.45 * (1 - sstep(0.5, 0.8, k))) * w, 0, wob * w);
    const roar = sstep(0.7, 0.8, k) * (1 - sstep(0.9, 1, k));
    P.rx(b.spine, (-0.2 * (1 - rise) + 0.25 * roar) * w); P.rx(b.chest, 0.2 * roar * w);
    P.rot(b.head, (0.4 * (1 - rise) + 0.35 * roar) * w, Math.sin(t * 5) * 0.3 * (1 - rise) * w, 0);
    const reach = 1 - sstep(0.18, 0.3, k), claw = sstep(0.18, 0.3, k) * (1 - sstep(0.5, 0.62, k)), push = sstep(0.5, 0.6, k) * (1 - sstep(0.66, 0.74, k));
    for (let s = -1; s <= 1; s += 2) {
      const cl = Math.sin(t * 18 + (s > 0 ? Math.PI : 0));
      armRot(ctl, s, 2.9 * reach + (2.2 + 0.6 * cl) * claw + 0.3 * push + 1.3 * roar, 0.2 * reach + (0.6 - 0.4 * cl) * claw + 0.3 * push + 0.3 * roar, w, 0.3 + 0.4 * push + 0.8 * roar);
    }
    ctl.jaw = Math.max(ctl.jaw, (0.8 * roar + 0.3 * (1 - rise)) * w);
    ctl.wingSpread = mix(ctl.wingSpread, 1.1 * roar - 0.6 * (1 - rise), w); ctl.flap = Math.max(ctl.flap, roar * 0.5 * w);
    ctl.glow = mix(ctl.glow, 2.2, roar * w);
    const lw = 1 - sstep(0.55, 0.7, k);
    legsLocal(ctl, lw * w, 0.25, 1.1);
  } };
}
/** drop out of a portal / the sky and land in a crouch */
export function bDrop(o = {}) {
  return { dur: o.dur ?? 1.1, a: 0.001, d: 0.85, state: true, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const fallK = clamp01(k / 0.4), y = (o.height ?? 3) * H * (1 - fallK * fallK);
    const land = sstep(0.36, 0.44, k) * (1 - sstep(0.55, 0.95, k));
    P.move(b.hips, 0, (y - 0.18 * H * land) * w, 0);
    P.rx(b.hips, (0.3 * (1 - fallK) - 0.3 * land) * w);
    armRot(ctl, -1, 1.8 * (1 - fallK) + 0.4 * land, 0.3, w, 0.9 * (1 - fallK) + 0.6 * land);
    armRot(ctl, 1, 1.8 * (1 - fallK) + 0.4 * land, 0.3, w, 0.9 * (1 - fallK) + 0.6 * land);
    ctl.wingSpread = mix(ctl.wingSpread, 1, (1 - fallK) * w); ctl.flap = Math.max(ctl.flap, (1 - fallK) * w);
    legsLocal(ctl, (1 - sstep(0.3, 0.4, k)) * w, 0.3, 1.1);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * land * w);
  } };
}

export function bRoar(o = {}) {
  return { dur: o.dur ?? 1.5, a: 0.12, d: 0.82, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const up = sstep(0, 0.25, k) * (1 - sstep(0.8, 1, k));
    const shake = Math.sin(t * 40) * 0.03 * up;
    P.move(b.hips, 0, -0.03 * ctl.H * up * w, 0.02 * ctl.H * up * w);
    P.rx(b.spine, (0.18 * up) * w); P.rx(b.chest, 0.15 * up * w);
    P.rot(b.head, (0.45 * up + shake) * w, shake * w, 0);
    armRot(ctl, -1, 1.2 * up, 0.5, w, 1.0 * up); armRot(ctl, 1, 1.2 * up, 0.5, w, 1.0 * up);
    ctl.jaw = Math.max(ctl.jaw, (0.9 + 0.1 * Math.sin(t * 25)) * up * w);
    ctl.wingSpread = mix(ctl.wingSpread, 1.2, up * w); ctl.flap = Math.max(ctl.flap, 0.3 * up * w);
    ctl.glow = mix(ctl.glow, 2.0, up * w); ctl.ear = mix(ctl.ear, 1.3, up * w);
    legsPlant(ctl, up * w * 0.5, 1.3, 0);
  } };
}

// ============================================================================================== quadrupeds
function qLie(ctl, w, side, t, o, noRoot) {
  const P = ctl.pose, b = ctl.b, lie = bodyY(ctl) - (o.lieY ?? ctl.H * 0.2);
  if (!noRoot) { P.move(b.body, 0, -lie * w, 0); P.rot(b.body, 0.05 * w, 0, side * (o.roll ?? 1.45) * w); }
  const br = Math.sin(t * 2.2) * 0.02;
  P.rx(b.neck, (-0.2 + br) * w); P.rot(b.head, -0.1 * w, 0, side * 0.35 * w);
  if (b.tail) for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], -0.12 * w, side * 0.15 * w, 0);
  ctl.jaw = Math.max(ctl.jaw, 0.25 * w); ctl.ear = mix(ctl.ear, 0.8, w); ctl.hackle = 0;
  legsLocal(ctl, w, 0.22, 1.1);
}
export function qHit(o = {}) {
  return { dur: o.dur ?? 0.4, a: 0.06, d: 0.45, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, s = sideOf(a), H = ctl.H;
    const j = sstep(0, 0.12, k) * (1 - sstep(0.25, 1, k)) * w;
    P.move(b.body, 0, 0.02 * H * j, 0.06 * H * j);
    P.rot(b.body, 0.1 * j, 0, 0.08 * s * j);
    P.rot(b.neck, 0.3 * j, 0.25 * s * j, 0); P.rx(b.head, 0.25 * j);
    ctl.ear = mix(ctl.ear, 1, j); ctl.jaw = Math.max(ctl.jaw, 0.35 * j);
  } };
}
export function qKnockback(o = {}) {
  return { dur: o.dur ?? 0.85, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const j = sstep(0, 0.08, k) * (1 - sstep(0.4, 1, k)) * w;
    const skid = sstep(0.05, 0.2, k) * (1 - sstep(0.55, 0.95, k)) * w;
    P.move(b.body, 0, (0.05 * j - 0.06 * skid) * H, 0.08 * H * j);
    P.rot(b.body, 0.2 * j, 0, 0.06 * j * Math.sin(a.seed));
    P.rx(b.neck, 0.45 * j); P.rx(b.head, 0.3 * j);
    ctl.jaw = Math.max(ctl.jaw, 0.4 * j); ctl.ear = mix(ctl.ear, 1.1, j);
    legsPlant(ctl, skid, 1.2, 0.05 * H);
  } };
}
export function qKnockdown(o = {}) {
  return { dur: o.dur ?? 0.8, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0,
    start(ctl, a) { ctl.downSide = sideOf(a); ctl.downO = o; },
    fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, s = downSide(ctl, a), H = ctl.H;
    const lie = bodyY(ctl) - (o.lieY ?? H * 0.2);
    const fall = ease.in(clamp01((k - 0.1) / 0.5));
    const bounce = Math.sin(clamp01((k - 0.6) / 0.2) * Math.PI) * 0.04 * H;
    const jolt = sstep(0, 0.08, k) * (1 - sstep(0.1, 0.45, k));
    P.move(b.body, 0, (-lie * fall + bounce + 0.06 * H * jolt) * w, KD_ZQ * H * ease.out(k / 0.6) * w);
    P.rot(b.body, (0.25 * jolt + 0.05 * fall) * w, 0, s * (o.roll ?? 1.45) * fall * w);
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.4 + a.seed)), 10) * sstep(1.2, 1.6, t);
    P.rx(b.neck, (0.2 * tw + 0.35 * jolt) * w);
    qLie(ctl, fall * w, s, t, o, true);
    legsLocal(ctl, w, 0.22 - 0.1 * tw, 1.1);
  } };
}
export function qGetup(o = {}) {
  return { dur: o.dur ?? 0.9, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H, side = ctl.downSide || 1;
    const lie = bodyY(ctl) - (o.lieY ?? H * 0.2);
    const roll = 1 - sstep(0.0, 0.5, k), up = sstep(0.3, 1.0, k), lw0 = (1 - sstep(0, 0.35, k)) * w;
    P.move(b.body, 0, -lie * (1 - up) * w, KD_ZQ * H * (1 - sstep(0.3, 1, k)) * w);
    P.rot(b.body, (-0.15 * sstep(0.3, 0.6, k) * (1 - sstep(0.7, 1, k)) + 0.05 * roll) * w, 0, side * (o.roll ?? 1.45) * roll * w);
    P.rx(b.neck, (-0.2 * roll + 0.25 * sstep(0.4, 0.7, k) * (1 - sstep(0.8, 1, k))) * w);
    P.rot(b.head, -0.1 * lw0, 0, side * 0.35 * lw0);
    if (b.tail) for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], -0.12 * lw0, side * 0.15 * lw0, 0);
    legsLocal(ctl, (1 - sstep(0.25, 0.5, k)) * w, 0.22, 1.1);
    legsPlant(ctl, sstep(0.25, 0.5, k) * (1 - sstep(0.8, 1, k)) * w, 1.1, 0);
    ctl.ear = mix(ctl.ear, 0.8, (1 - k) * w); ctl.jaw = Math.max(ctl.jaw, 0.25 * lw0);
  } };
}
export function qDeath(o = {}) {
  return { dur: o.dur ?? 1.5, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true,
    start(ctl, a) { a.u.spin = Math.random() < (o.spin ?? 0.35) ? 1 : 0; a.u.side = sideOf(a); a.u.dist = (o.dist ?? 1.1) * (0.75 + Math.random() * 0.5); },
    fn(ctl, a, w) {
      const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H, s = a.u.fromDown ? (ctl.downSide || a.u.side) : a.u.side;
      const lie = bodyY(ctl) - (o.lieY ?? H * 0.2);
      if (a.u.fromDown) { const d = ctl.downO || o, dl = bodyY(ctl) - (d.lieY ?? H * 0.2); P.move(b.body, 0, -dl * w, KD_ZQ * H * w); P.rot(b.body, 0.05 * w, 0, s * (d.roll ?? 1.45) * w); qLie(ctl, w, s, t, d, true); ctl.glow = mix(ctl.glow, 0.15, sstep(0.2, 1.2, t) * w); return; }
      const dist = a.u.dist * H, peak = (o.peak ?? 0.35) * H, T1 = o.air ?? 0.36;
      const u = clamp01(k / T1), land = sstep(T1 * 0.75, T1 * 1.1, k);
      const fz = ease.out(u) * dist + sstep(T1, T1 + 0.35, k) * dist * 0.15;
      const arc = 4 * u * (1 - u) * peak + (k > T1 ? Math.sin(clamp01((k - T1) / 0.13) * Math.PI) * peak * 0.2 : 0);
      const roll = ease.out(u) * s * ((o.roll ?? 1.45) + a.u.spin * TAU);
      P.move(b.body, 0, (arc - lie * ease.io(u)) * w, fz * w);
      P.rot(b.body, (0.35 * Math.sin(u * Math.PI) + 0.05 * land) * w, 0.2 * s * Math.sin(u * Math.PI) * w, roll * w);
      const fl = (1 - land) * w;
      P.rx(b.neck, 0.5 * fl); P.rx(b.head, 0.4 * fl);
      ctl.jaw = Math.max(ctl.jaw, 0.6 * fl);
      qLie(ctl, land * w, s, t, o, true);
      legsLocal(ctl, w, mix(0.35, 0.22, land), 1.1);
      ctl.glow = mix(ctl.glow, 0.15, sstep(0.4, 1.4, t) * w);
    } };
}
export function qStun(o = {}) {
  return { dur: o.dur ?? 1.8, loop: true, state: true, fadeIn: 0.25, fadeOut: 0.3, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, ph = a.t / (o.dur ?? 1.8) * TAU, H = ctl.H;
    P.move(b.body, Math.sin(ph) * 0.03 * H * w, -0.04 * H * w, 0);
    P.rot(b.body, 0, 0, Math.sin(ph) * 0.07 * w);
    P.rot(b.neck, (-0.3 + 0.12 * Math.sin(ph)) * w, 0.3 * Math.cos(ph) * w, 0);
    P.rot(b.head, 0.1 * w, 0.2 * Math.cos(ph) * w, 0.25 * Math.sin(ph) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.3 * w); ctl.ear = mix(ctl.ear, -0.2, w); ctl.hackle = 0;
    legsPlant(ctl, w * 0.6, 1.2, 0);
  } };
}
/** crawl out of the ground: front paws claw out first, then the body hauls up */
export function qSpawn(o = {}) {
  return { dur: o.dur ?? 1.6, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const depth = (o.depth ?? 1.2) * H;
    const riseF = sstep(0.05, 0.45, k), riseB = sstep(0.25, 0.7, k);
    const pitch = (riseF - riseB) * 0.7;
    P.move(b.body, 0, (-depth * (1 - (riseF + riseB) * 0.5)) * w, 0);
    P.rot(b.body, pitch * w, 0, Math.sin(t * 14) * 0.1 * (1 - riseB) * w);
    const howl = sstep(0.72, 0.82, k) * (1 - sstep(0.92, 1, k));
    P.rx(b.neck, (0.3 * (1 - riseF) + 0.5 * howl) * w); P.rx(b.head, 0.3 * howl * w);
    ctl.jaw = Math.max(ctl.jaw, (0.8 * howl + 0.3 * (1 - riseB)) * w); ctl.hackle = Math.max(ctl.hackle, w);
    ctl.glow = mix(ctl.glow, 2.2, howl * w);
    const G = ctl.gait;
    for (let i = 0; i < G.legs.length; i++) {
      const L = G.legs[i], front = L.toe.z < 0;
      L.override = L.override || L.toe.clone();
      if (front) {
        const cl = Math.sin(t * 16 + (L.side > 0 ? Math.PI : 0));
        L.override.set(L.toe.x * 1.1, L.toe.y + (0.15 + 0.1 * cl) * H * (1 - riseB), L.toe.z - 0.1 * H);
      } else L.override.set(L.toe.x * 1.1, L.toe.y + 0.1 * H, L.toe.z);
      L.overrideLocal = true; L.overridePaw = -0.4;
      const lw = (1 - sstep(0.6, 0.75, k)) * w; if (lw > L.overrideW) L.overrideW = lw;
    }
  } };
}
export function qRoar(o = {}) {
  return { dur: o.dur ?? 1.6, a: 0.12, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const up = sstep(0, 0.25, k) * (1 - sstep(0.82, 1, k));
    P.move(b.body, 0, 0.02 * ctl.H * up * w, 0.04 * ctl.H * up * w);
    P.rx(b.body, 0.1 * up * w); P.rx(b.chest, 0.08 * up * w);
    P.rx(b.neck, 0.5 * up * w); P.rx(b.head, (0.35 * up + Math.sin(t * 30) * 0.03 * up) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.8 + 0.1 * Math.sin(t * 20)) * up * w);
    ctl.ear = mix(ctl.ear, 1, up * w); ctl.hackle = Math.max(ctl.hackle, up * w);
    ctl.glow = mix(ctl.glow, 2.0, up * w);
  } };
}
