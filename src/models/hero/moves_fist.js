// Fist & kick move library (Stormfist gauntlets; kicks and palms work for every class).
// Punches place the fist with fistAt (pose frame): position, forearm direction, thumb direction → arm IK + wrist.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { sin, cos, PI, clamp, lerp, sstep, K, KC, E, step, crouch, twist, bend, base, fist, fistAt, dirDeg, M, def, v, vs } from './movelib.js';

// ---------------------------------------------------------------------------------------------------
// fist targets relative to the chest joint (side +right, up, forward), with the hip offset applied
const P3 = (p, R, s, u, f) => [s + p.hip[0], R.chestY + u + p.hip[1], -f + p.hip[2]];
const GUARD = { L: [-0.1, 0.12, 0.3], R: [0.13, 0.08, 0.22] }; // lead left hand forward, rear right hand by the chin
/** keyed fist path: keys [[t, side, up, fwd, fx, fy, fz, tx, ty, tz]] (fwd dir + thumb dir) */
function fistPath(p, side, u, R, keys, w = 1) {
  const n = keys.length;
  let i = 0; while (i < n - 2 && u > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, n - 1)];
  const t = b[0] > a[0] ? clamp((u - a[0]) / (b[0] - a[0]), 0, 1) : 1;
  const s = b.lin ? t : t * t * (3 - 2 * t);
  const L = (k) => a[k] + (b[k] - a[k]) * s;
  fistAt(side === 'R' ? p.wR : p.wL, w, P3(p, R, L(1), L(2), L(3)), [L(4), L(5), L(6)], [L(7), L(8), L(9)]);
  fist(p, side, 1.5);
}
const lin = (k) => { k.lin = true; return k; };
// guard fist keys (forearm up-forward, thumb up-inward)
const gL = (t) => [t, -0.1, 0.1, 0.3, 0.1, 0.6, -0.8, 0.6, 0.6, 0.2];
const gR = (t) => [t, 0.13, 0.06, 0.22, -0.2, 0.7, -0.7, -0.6, 0.6, 0.2];

// ---- jab / cross / hook combo -------------------------------------------------------------------------
v('atk1', 'fists', { dur: 0.34, hits: [0.36], drag: 0.15, fn(p, u, ctx) { // left jab
  const R = ctx.rig;
  fistPath(p, 'L', u, R, [gL(0), [0.14, -0.12, 0.14, 0.24, 0.05, 0.3, -1, 0.6, 0.5, 0], lin([0.36, -0.04, 0.15, 0.62, 0, 0.05, -1, 1, 0, 0]), [0.52, -0.05, 0.14, 0.58, 0, 0.1, -1, 1, 0, 0], gL(1)]);
  fistPath(p, 'R', u, R, [gR(0), gR(1)]);
  swingTwist2(p, u, [0, 0, 0.14, 0.1, 0.36, -0.28, 0.6, -0.2, 1, 0]);
  crouch(p, 0.06, R); step(p, 0, u, 0, -0.14, 0.2, 0.36, 0.7, 1, 0.04);
} });
v('atk2', 'fists', { dur: 0.38, hits: [0.38], drag: 0.2, fn(p, u, ctx) { // right cross
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), [0.16, 0.16, 0.06, 0.16, -0.1, 0.4, -1, -0.5, 0.5, 0], lin([0.38, 0.02, 0.15, 0.66, -0.1, 0.05, -1, -1, 0, 0]), [0.54, 0.02, 0.14, 0.62, -0.1, 0.1, -1, -1, 0, 0], gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.38, -0.12, 0.08, 0.2, 0.2, 0.7, -0.6, 0.6, 0.6, 0.2], gL(1)]);
  swingTwist2(p, u, [0, 0, 0.16, -0.2, 0.38, 0.55, 0.6, 0.4, 1, 0]);
  crouch(p, KC(u, 0, 0.04, 0.4, 0.1, 1, 0.04), R); step(p, 1, u, 0.02, -0.08, 0.2, 0.38, 0.75, 1, 0.03);
  p.feet[8] -= 0.5 * K(u, 0.2, 0, 0.38, 1, 0.75, 1, 1, 0); p.toe[1] += 0.4 * K(u, 0.2, 0, 0.38, 1, 0.75, 1, 1, 0); // pivot on the rear foot
} });
v('atk3', 'fists', { dur: 0.6, hits: [0.44], drag: 0.4, fn(p, u, ctx) { // big right hook through the body
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), E([0.26, 0.42, 0.08, 0.05, -0.3, 0.2, -0.9, 0, 1, 0]), lin([0.44, -0.12, 0.14, 0.5, -1, 0.1, -0.2, 0, 1, 0]), [0.56, -0.28, 0.12, 0.38, -0.8, 0.1, 0.4, 0, 1, 0], gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.44, -0.2, 0.06, 0.12, 0.2, 0.7, -0.6, 0.6, 0.6, 0.2], gL(1)]);
  swingTwist2(p, u, [0, 0, 0.26, -0.6, 0.44, 0.7, 0.56, 0.85, 1, 0], 0.4);
  crouch(p, KC(u, 0, 0.05, 0.26, 0.12, 0.46, 0.14, 1, 0.04), R);
  step(p, 0, u, -0.05, -0.16, 0.24, 0.42, 0.8, 1, 0.04);
} });
vs('slash_h', ['fists', 'none'], M.atk3.v.fists);
v('slash_v', 'fists', { dur: 0.6, hits: [0.46], drag: 0.4, fn(p, u, ctx) { // hammer fist from overhead
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), E([0.3, 0.08, 0.5, 0.05, 0, 1, 0.3, -1, 0, 0]), lin([0.46, 0.05, -0.05, 0.5, 0, -1, -0.4, -1, 0, 0]), [0.6, 0.05, -0.12, 0.48, 0, -1, -0.2, -1, 0, 0], gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), E([0.3, -0.08, 0.5, 0.05, 0, 1, 0.3, 1, 0, 0]), lin([0.46, -0.05, -0.05, 0.5, 0, -1, -0.4, 1, 0, 0]), [0.6, -0.05, -0.12, 0.48, 0, -1, -0.2, 1, 0, 0], gL(1)]);
  bend(p, KC(u, 0, 0, 0.3, 0.25, 0.46, -0.45, 1, 0)); crouch(p, KC(u, 0, 0.05, 0.3, -0.03, 0.48, 0.2, 1, 0.04), R);
  step(p, 0, u, 0, -0.22, 0.28, 0.46, 0.8, 1);
} });
v('uppercut', 'fists', { dur: 0.52, hits: [0.4], drag: 0.4, fn(p, u, ctx) { // dragon uppercut: dip then drive up
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), E([0.24, 0.18, -0.28, 0.18, 0, 0.4, -1, -1, 0, 0]), lin([0.4, 0.04, 0.38, 0.36, 0, 1, -0.3, -1, 0, 0]), E([0.56, 0.04, 0.52, 0.28, 0, 1, 0, -1, 0, 0]), gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.4, -0.25, -0.05, 0.1, 0.2, 0.3, -0.4, 0.6, 0.6, 0.2], gL(1)]);
  swingTwist2(p, u, [0, 0, 0.24, -0.3, 0.4, 0.35, 1, 0]);
  bend(p, KC(u, 0, 0, 0.24, -0.28, 0.42, 0.2, 0.6, 0.15, 1, 0)); crouch(p, KC(u, 0, 0.05, 0.24, 0.26, 0.42, -0.08, 0.6, -0.04, 1, 0.04), R);
  const air = sin(clamp((u - 0.36) / 0.36, 0, 1) * PI); p.hip[1] += 0.22 * air; p.feet[1] += 0.2 * air; p.feet[6] += 0.24 * air; p.feet[3] = -0.4 * air; p.feet[8] = -0.5 * air;
} });
M.slash_up.v.fists = M.uppercut.v.fists;
v('thrust', 'fists', { dur: 0.46, hits: [0.36], drag: 0.4, fn(p, u, ctx) { // lunging straight punch
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), E([0.2, 0.2, 0.02, 0.05, 0, 0.3, -1, -0.5, 0.5, 0]), lin([0.36, 0.0, 0.12, 0.72, 0, 0.05, -1, -1, 0, 0]), [0.52, 0.0, 0.12, 0.7, 0, 0.05, -1, -1, 0, 0], gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.36, -0.15, 0.02, 0.05, 0.2, 0.7, -0.4, 0.6, 0.6, 0.2], gL(1)]);
  swingTwist2(p, u, [0, 0, 0.2, -0.35, 0.36, 0.6, 1, 0]); bend(p, KC(u, 0, 0, 0.36, -0.2, 1, 0));
  crouch(p, KC(u, 0, 0.04, 0.36, 0.16, 1, 0.04), R); step(p, 0, u, 0, -0.38, 0.18, 0.36, 0.78, 1, 0.05); p.hip[2] -= 0.12 * K(u, 0.2, 0, 0.38, 1, 0.8, 1, 1, 0);
} });
v('slash_x', 'fists', { dur: 0.5, hits: [0.38], drag: 0.4, fn(p, u, ctx) { // double straight punch
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [gR(0), E([0.22, 0.2, 0.0, 0.05, 0, 0.3, -1, -0.5, 0.5, 0]), lin([0.38, 0.1, 0.12, 0.64, 0, 0, -1, -1, 0, 0]), [0.54, 0.1, 0.12, 0.6, 0, 0, -1, -1, 0, 0], gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), E([0.22, -0.2, 0.0, 0.05, 0, 0.3, -1, 0.5, 0.5, 0]), lin([0.38, -0.1, 0.12, 0.64, 0, 0, -1, 1, 0, 0]), [0.54, -0.1, 0.12, 0.6, 0, 0, -1, 1, 0, 0], gL(1)]);
  bend(p, KC(u, 0, 0, 0.22, 0.1, 0.38, -0.2, 1, 0)); crouch(p, KC(u, 0, 0.04, 0.22, 0.14, 0.4, 0.1, 1, 0.04), R);
  step(p, 0, u, 0, -0.26, 0.2, 0.38, 0.8, 1, 0.05); p.hip[2] -= 0.1 * K(u, 0.2, 0, 0.4, 1, 0.8, 1, 1, 0);
} });
def('palm', { dur: 0.62, hits: [0.42], attack: true, drag: 0.5, blendIn: 0.08, blendOut: 0.8, fn(p, u, ctx) { // twin palm strike (fingers up, heels of the hands forward)
  const R = ctx.rig;
  const pl = (s) => [[0, s * 0.12, 0.06, 0.25, 0.2 * s, 0.6, -0.6, 0, 1, 0], E([0.26, s * 0.18, 0.0, 0.02, 0, 1, 0.2, -s, 0, 0]), lin([0.42, s * 0.1, 0.1, 0.62, 0, 1, 0, -s, 0, 0.3]), E([0.6, s * 0.1, 0.1, 0.6, 0, 1, 0, -s, 0, 0.3]), [1, s * 0.12, 0.06, 0.25, 0.2 * s, 0.6, -0.6, 0, 1, 0]];
  fistPath(p, 'R', u, R, pl(1)); fistPath(p, 'L', u, R, pl(-1));
  setFingers(p, 'R', 0.05, 0.05, 0.1); setFingers(p, 'L', 0.05, 0.05, 0.1);
  bend(p, KC(u, 0, 0, 0.26, 0.1, 0.42, -0.2, 1, 0)); crouch(p, KC(u, 0, 0.04, 0.26, 0.2, 0.44, 0.16, 1, 0.04), R);
  base(p, ctx, 0.2, 0.3, 0.14, 0.5); p.hip[2] -= 0.1 * K(u, 0.26, 0, 0.44, 1, 0.8, 1, 1, 0);
} });

// ---- barrage / charge -----------------------------------------------------------------------------
def('punch_loop', { dur: 0.36, loop: true, attack: true, hits: [0.25, 0.75], drag: 0.3, blendIn: 0.1, fn(p, u, ctx) { // rapid alternating punches
  const R = ctx.rig;
  const jab = (ph) => { const k = Math.max(0, sin(ph * PI * 2)); return k * k; };
  const kr = jab(u), kl = jab(u + 0.5);
  const a = (s, k) => [s * lerp(0.13, 0.03, k), lerp(0.08, 0.14, k), lerp(0.22, 0.66, k)];
  fistAt(p.wR, 1, P3(p, R, ...a(1, kr)), [0, 0.1 * (1 - kr), -1], [-1, 0.3 * (1 - kr), 0]); fist(p, 'R', 1.5);
  fistAt(p.wL, 1, P3(p, R, ...a(-1, kl)), [0, 0.1 * (1 - kl), -1], [1, 0.3 * (1 - kl), 0]); fist(p, 'L', 1.5);
  p.add(B.chest, 0, 0.18 * (kr - kl), 0); p.add(B.spine, -0.06, 0.06 * (kr - kl), 0);
  crouch(p, 0.12, R); base(p, ctx, 0.18, 0.22, 0.16, 0.5);
} });
def('charge_hold', { dur: 1.2, loop: true, attack: true, drag: 0.1, fn(p, u, ctx) { // gathering power: fists at the hip, crouched, trembling
  const R = ctx.rig, tr = sin(u * PI * 18) * 0.006, br = sin(u * PI * 2);
  fistAt(p.wR, 1, P3(p, R, 0.2, -0.22 + tr, 0.02), [0, -0.3, -1], [-1, 0.3, 0]); fist(p, 'R', 1.5);
  fistAt(p.wL, 1, P3(p, R, -0.2, -0.22 - tr, 0.02), [0, -0.3, -1], [1, 0.3, 0]); fist(p, 'L', 1.5);
  crouch(p, 0.2 + br * 0.01, R); bend(p, -0.12); base(p, ctx, 0.24, 0.2, 0.2, 0.55); setClav(p, 'L', 0.12); setClav(p, 'R', 0.12);
  p.face = 2;
} });
def('charge_release', { dur: 0.6, hits: [0.26], attack: true, drag: 0.8, blendIn: 0.02, fn(p, u, ctx) { // explosive palm / punch release
  const R = ctx.rig;
  fistPath(p, 'R', u, R, [[0, 0.2, -0.22, 0.02, 0, -0.3, -1, -1, 0.3, 0], lin([0.26, 0.05, 0.12, 0.74, 0, 0.1, -1, -1, 0, 0]), E([0.5, 0.05, 0.12, 0.7, 0, 0.1, -1, -1, 0, 0]), gR(1)]);
  fistPath(p, 'L', u, R, [[0, -0.2, -0.22, 0.02, 0, -0.3, -1, 1, 0.3, 0], [0.26, -0.22, 0.0, 0.0, 0.2, 0.4, -0.5, 1, 0.3, 0], gL(1)]);
  swingTwist2(p, u, [0, 0, 0.26, 0.55, 1, 0]); bend(p, KC(u, 0, -0.12, 0.26, -0.25, 1, 0)); crouch(p, KC(u, 0, 0.2, 0.26, 0.18, 1, 0.04), R);
  step(p, 0, u, 0, -0.4, 0.02, 0.26, 0.8, 1, 0.05); p.hip[2] -= 0.16 * K(u, 0, 0, 0.28, 1, 0.8, 1, 1, 0);
} });
for (const f of ['greatsword', 'sword', 'glaive', 'blades', 'staff', 'pistol', 'shotgun', 'rifle', 'harp']) { if (!M.charge_hold.v[f]) M.charge_hold.v[f] = { fn: chargeArmed }; if (!M.charge_release.v[f]) M.charge_release.v[f] = { fn: (M.slash_up.v[f] || M.atk3.v[f] || {}).fn || M.charge_release.fn, hits: [0.3], dur: 0.7 }; }
function chargeArmed(p, u, ctx) { // armed default: crouched, weapon kept in its hold, trembling with power
  const R = ctx.rig, br = sin(u * PI * 2);
  crouch(p, 0.16 + br * 0.01, R); bend(p, -0.1); base(p, ctx, 0.22, 0.2, 0.2, 0.5);
  p.add(B.chest, sin(u * PI * 18) * 0.01, 0, 0);
}

// ---- kicks (every class) -------------------------------------------------------------------------
def('kick_high', { dur: 0.6, hits: [0.4], attack: true, draw: false, drag: 0.4, blendIn: 0.06, blendOut: 0.8, fn(p, u, ctx) { // high front snap kick (right)
  const R = ctx.rig;
  const up = K(u, 0.1, 0, 0.26, 0.55, 0.4, 1, 0.52, 0.9, 0.7, 0);
  const ext = K(u, 0.2, 0, 0.4, 1, 0.52, 0.8, 0.7, 0);
  stance(p, ctx, 0.02, 0.02, 0, 0.3);
  p.feet[5] = R.stanceX * 0.6; p.feet[6] = R.ankleH + lerp(0, 0.95, up) * R.legLen / 0.87; p.feet[7] = -lerp(0.1, 0.72, ext) * R.legLen / 0.87 - 0.1 * up;
  p.feet[8] = lerp(0, 0.9, ext); p.toe[1] = 0.3 * ext;
  bend(p, 0.25 * up); p.add(B.hips, 0.2 * up, 0.2 * up, 0); crouch(p, 0.05 * (1 - up), R);
  p.feet[4] = 0.5 * up; // support foot pivots out
  if (!p.wR[0] && !p.wL[0]) { setArm(p, 'L', 0.9, 0.5, 0.2, 1.6, 0, 0, 1.4); setArm(p, 'R', -0.2, 0.4, 0.2, 1.4, 0, 0, 1.4); }
} });
def('kick_spin', { dur: 0.7, hits: [0.48], attack: true, draw: false, drag: 0.6, spinDrag: 0.8, blendIn: 0.05, blendOut: 0.8, fn(p, u, ctx) { // spinning roundhouse
  const R = ctx.rig;
  const sp = sstep(0.1, 0.72, u);
  p.yaw = -sp * PI * 2;
  const lift = K(u, 0.2, 0, 0.4, 1, 0.58, 1, 0.75, 0);
  stance(p, ctx, 0.02, 0.0, 0, 0.3);
  p.feet[5] = lerp(R.stanceX, 0.75 * R.legLen / 0.87, lift); p.feet[6] = R.ankleH + 0.82 * lift * R.legLen / 0.87; p.feet[7] = -0.1 * lift;
  p.feet[9] = -1.2 * lift; p.feet[8] = 0.8 * lift;
  p.add(B.hips, 0, 0, -0.55 * lift); p.add(B.spine, 0, 0, 0.3 * lift); p.add(B.chest, 0, 0, 0.2 * lift);
  crouch(p, 0.06 * (1 - lift), R);
  if (!p.wR[0] && !p.wL[0]) { setArm(p, 'L', 0.2, 0.9 * lift + 0.2, 0, 0.8, 0, 0, 1.4); setArm(p, 'R', 0.3, 0.6 * lift + 0.2, 0, 1.4, 0, 0, 1.4); }
} });
def('kick_flip', { dur: 0.8, hits: [0.36], attack: true, draw: false, drag: 0.7, blendIn: 0.04, blendOut: 0.85, fn(p, u, ctx) { // back-flip kick (moonflash)
  const R = ctx.rig;
  const air = sin(clamp((u - 0.12) / 0.66, 0, 1) * PI);
  const rot = sstep(0.16, 0.74, u);
  const cr = K(u, 0, 0, 0.12, 1, 0.2, 0, 0.78, 0, 0.88, 0.7, 1, 0);
  p.ikw = 1 - K(u, 0.1, 0, 0.18, 1, 0.74, 1, 0.8, 0);
  p.hip[1] += 0.48 * air - 0.18 * cr * R.legLen / 0.87; p.hip[2] += 0.25 * rot;
  p.set(B.hips, rot * PI * 2 * 0.98, 0, 0);
  const tuck = sin(rot * PI);
  const kick = K(u, 0.22, 0, 0.36, 1, 0.5, 0.2);
  p.set(B.thighR, 1.4 * tuck + 0.6 * kick, 0, 0.1); p.set(B.shinR, -1.6 * tuck * (1 - kick) - 0.1, 0, 0);
  p.set(B.thighL, 1.6 * tuck, 0, -0.1); p.set(B.shinL, -2.0 * tuck - 0.1, 0, 0);
  bend(p, 0.3 * tuck);
  stance(p, ctx, 0.04, 0.05, -0.05, 0.25);
  if (!p.wR[0] && !p.wL[0]) { setArm(p, 'L', 0.6 + tuck, 0.5, 0.2, 1.2, 0, 0, 1.4); setArm(p, 'R', 0.6 + tuck, 0.5, 0.2, 1.2, 0, 0, 1.4); }
} });
v('spin', 'fists', { dur: 0.6, hits: [0.46], drag: 0.6, spinDrag: 1, fn(p, u, ctx) { // spinning backfist
  const R = ctx.rig, sp = sstep(0.12, 0.7, u), out = K(u, 0, 0, 0.3, 1, 0.62, 1, 0.85, 0);
  p.yaw = sp * PI * 2;
  fistAt(p.wR, 1, P3(p, R, lerp(0.13, 0.6, out), lerp(0.08, 0.12, out), lerp(0.22, 0.1, out)), [1, 0, -0.3 * (1 - out)], [0, 1, 0]); fist(p, 'R', 1.5);
  fistPath(p, 'L', u, R, [gL(0), gL(1)]);
  crouch(p, 0.1, R); stance(p, ctx, 0.1, 0.05, -0.05, 0.3);
} });
v('spin_loop', 'fists', { dur: 0.5, loop: true, drag: 0.7, spinDrag: 1, hits: [0.5], fn(p, u, ctx) { // whirling kicks
  const R = ctx.rig;
  p.yaw = -u * PI * 2;
  p.feet[5] = 0.7 * R.legLen / 0.87; p.feet[6] = R.ankleH + 0.55 * R.legLen / 0.87; p.feet[7] = 0; p.feet[9] = -1.3;
  p.feet[0] = -R.stanceX * 0.4; p.feet[2] = 0; p.feet[1] = R.ankleH + 0.04 * Math.max(0, sin(u * PI * 4));
  p.add(B.hips, 0, 0, -0.45); p.add(B.spine, 0, 0, 0.25);
  setArm(p, 'L', 0.2, 1.1, 0, 0.6, 0, 0, 1.4); setArm(p, 'R', 0.2, 0.8, 0, 1.0, 0, 0, 1.4);
  p.wR[0] = 0; p.wL[0] = 0;
} });
def('ground_punch', { dur: 0.9, hits: [0.5], attack: true, drag: 0.6, blendIn: 0.06, blendOut: 0.85, fn(p, u, ctx) { // leap and drive the fist into the ground
  const R = ctx.rig;
  const air = sin(clamp((u - 0.12) / 0.34, 0, 1) * PI) * (u < 0.46 ? 1 : 0);
  const land = K(u, 0.4, 0, 0.5, 1, 0.8, 0.9, 1, 0);
  p.hip[1] += 0.36 * air; crouch(p, 0.34 * land + 0.12 * K(u, 0, 0, 0.12, 1, 0.2, 0), R);
  fistPath(p, 'R', u, R, [gR(0), E([0.3, 0.12, 0.5, 0.0, 0, 1, 0.2, -1, 0, 0]), lin([0.5, 0.1, -0.62, 0.4, 0, -1, -0.2, -1, 0, 0]), E([0.8, 0.1, -0.6, 0.4, 0, -1, -0.2, -1, 0, 0]), gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.5, -0.3, 0.0, 0.1, 0.3, 0.6, -0.4, 0.6, 0.6, 0.2], gL(1)]);
  bend(p, 0.3 * air - 0.6 * land);
  base(p, ctx, 0.2, 0.3 * land + 0.05, 0.2, 0.5);
  p.feet[1] += 0.33 * air; p.feet[6] += 0.33 * air; p.feet[8] -= 1.0 * land; p.toe[1] = 0.8 * land;
} });
v('dash_strike', 'fists', { dur: 0.52, hits: [0.5], move: true, drag: 0.9, fn(p, u, ctx) { // flying knee into a straight punch
  const R = ctx.rig;
  const rush = K(u, 0, 0, 0.1, 1, 0.5, 1, 0.62, 0);
  crouch(p, 0.12 * rush, R); bend(p, -0.4 * rush);
  fistPath(p, 'R', u, R, [gR(0), E([0.3, 0.2, 0.0, 0.0, 0, 0.3, -1, -0.5, 0.5, 0]), lin([0.5, 0.02, 0.12, 0.72, 0, 0, -1, -1, 0, 0]), E([0.66, 0.02, 0.12, 0.7, 0, 0, -1, -1, 0, 0]), gR(1)]);
  fistPath(p, 'L', u, R, [gL(0), [0.5, -0.2, 0.0, 0.0, 0.2, 0.6, -0.5, 0.6, 0.6, 0.2], gL(1)]);
  stance(p, ctx, 0.04, 0, 0, 0.15);
  const ph = clamp(u / 0.45, 0, 1);
  p.feet[7] -= 0.5 * sin(ph * PI) * rush; p.feet[6] += 0.35 * sin(ph * PI) * rush; p.feet[8] = -0.6 * rush;
  p.feet[2] += 0.3 * rush; p.feet[1] += 0.1 * rush * sin(clamp(ph * 1.6, 0, 1) * PI); p.toe[0] = 0.6 * rush;
} });
v('block', 'fists', { dur: 1, loop: true, fn(p, u, ctx) { // forearms crossed high
  const R = ctx.rig;
  fistAt(p.wR, 1, P3(p, R, 0.04, 0.24, 0.3), [-0.5, 1, -0.3], [-1, 0, 0]); fist(p, 'R', 1.5);
  fistAt(p.wL, 1, P3(p, R, -0.04, 0.3, 0.32), [0.5, 1, -0.3], [1, 0, 0]); fist(p, 'L', 1.5);
  crouch(p, 0.14, R); bend(p, -0.12); base(p, ctx, 0.18, 0.18, 0.18, 0.5);
} });
v('leap', 'fists', { dur: 0.5, hold: true, move: true, fn(p, u, ctx) {
  const R = ctx.rig, c = K(u, 0, 0, 0.25, 1, 0.42, 0), air = sstep(0.28, 0.75, u);
  crouch(p, 0.2 * c, R); p.hip[1] += 0.95 * air; bend(p, 0.2 * air - 0.2 * c);
  fistAt(p.wR, 1, P3(p, R, 0.12, 0.52 * air + 0.08, 0.1), [0, 1, 0.2], [-1, 0, 0]); fist(p, 'R', 1.5);
  fistPath(p, 'L', u, R, [gL(0), gL(1)]);
  stance(p, ctx, 0.06, 0.08, -0.08, 0.25);
  p.feet[1] += 1.1 * air; p.feet[3] = -0.5 * air; p.feet[6] += 1.0 * air; p.feet[7] += 0.2 * air; p.feet[8] = -0.7 * air;
} });
v('slam', 'fists', { dur: 0.55, hits: [0.28], fn(p, u, ctx) {
  const R = ctx.rig, air = 1 - sstep(0, 0.26, u), land = K(u, 0.22, 0, 0.3, 1, 0.65, 0.9, 1, 0);
  p.hip[1] += 0.95 * air; crouch(p, 0.34 * land, R); bend(p, 0.2 * air - 0.6 * land);
  fistAt(p.wR, 1, P3(p, R, lerp(0.12, 0.1, land), lerp(0.6, -0.62, sstep(0, 0.3, u)), lerp(0.1, 0.42, land)), [0, lerp(1, -1, sstep(0, 0.3, u)), -0.2], [-1, 0, 0]); fist(p, 'R', 1.5);
  fistPath(p, 'L', u, R, [gL(0), gL(1)]);
  base(p, ctx, 0.2, 0.3 * land + 0.08 * air, 0.2, 0.5);
  p.feet[1] += 1.1 * air; p.feet[6] += 1.0 * air; p.feet[8] -= 1.0 * land; p.toe[1] = 0.8 * land;
} });

/** hips lead the chest (local copy to avoid a cross-file import cycle) */
function swingTwist2(p, u, keys, hipsShare = 0.35) {
  const h = KC(Math.min(1, u + 0.04), ...keys), c = KC(u, ...keys);
  p.add(B.hips, 0, h * hipsShare, 0); p.add(B.spine, 0, c * (1 - hipsShare) * 0.45, 0); p.add(B.chest, 0, c * (1 - hipsShare) * 0.55, 0);
  p.add(B.head, 0, -c * 0.45, 0);
}
