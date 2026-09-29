// Melee move library: greatsword (Reaver), longsword (Oathkeeper), twin blades (Bladedancer), glaive (Demonbound),
// demon claws. Blade moves are authored as weapon trajectories: track keys [t, yaw, pitch, r, dy, roll, bdy, bdp]
// (grip at pivot + r·dir(yaw, pitch); blade along dir(yaw+bdy, pitch+bdp); see movelib.wield) solved by arm IK.
// Timing craft: anticipation (eased, 25–35%), fast strike (10–15%, hit at its end), follow-through overshoot, recovery.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { sin, cos, PI, clamp, lerp, sstep, K, KC, track, E, wieldT, step, crouch, twist, bend, base, fist, fistAt, M, def, v, vs } from './movelib.js';

// ---------------------------------------------------------------------------------------------------
// shared body helpers
/** hips lead, chest follows: twist curve applied with a small lag between hips and chest */
function swingTwist(p, u, keys, lag = 0.04, hipsShare = 0.35) {
  const h = KC(Math.min(1, u + lag), ...keys), c = KC(u, ...keys);
  p.add(B.hips, 0, h * hipsShare, 0); p.add(B.spine, 0, c * (1 - hipsShare) * 0.45, 0); p.add(B.chest, 0, c * (1 - hipsShare) * 0.55, 0);
  p.add(B.head, 0, -c * 0.4, 0); p.add(B.neck, 0, -c * 0.1, 0);
}
const mk = (keys) => keys.map(k => { const a = k.slice(); if (k.e) a.e = true; return a; });
/** two-handed / one-handed / dual blade move from tracks. o: { R, L, twoHand, px, pxL, body(p, u, R, ctx, trR, trL) } */
function blade(o) {
  const KR = o.R ? mk(o.R) : null, KL = o.L ? mk(o.L) : null;
  const trR = new Float32Array(8), trL = new Float32Array(8);
  return function (p, u, ctx, A, a) {
    const R = ctx.rig;
    if (KR) { track(u, KR, trR); wieldT(p, 'R', 1, trR, R, o.px ?? 0.02); }
    if (KL) { track(u, KL, trL); wieldT(p, 'L', 1, trL, R, o.pxL ?? -0.1); }
    p.w2h = o.twoHand ? (typeof o.twoHand === 'function' ? o.twoHand(u) : 1) : 0;
    if (!o.twoHand && !KL && o.free !== false) freeArm(p, u, o.freeK);
    o.body(p, u, R, ctx, trR, trL, A, a);
  };
}
/** off arm balances a one-handed swing (counter-swing) */
function freeArm(p, u, k = 1) {
  const c = KC(u, 0, 0, 0.3, 1, 0.45, -0.5, 0.7, -0.3, 1, 0) * k;
  setArm(p, 'L', 0.35 + c * 0.25, 0.35 + Math.abs(c) * 0.25, -0.1, 1.1 - c * 0.3, 0.1, 0, 1.2);
}

// ===================================================================================================
// GREATSWORD (Reaver): heavy, two-handed, huge arcs, deep crouches and big steps
const GS = [-8, -52, 0.42, 0, 10, -58, 62]; // ready: low guard, blade forward-left
const gs = (t, arr) => [t, ...arr];

v('atk1', 'greatsword', { dur: 0.64, hits: [0.4], drag: 0.35, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.28, 72, 26, 0.3, 0.04, -20, 80, 20]),        // wind up over the right shoulder, blade back
  [0.4, 2, -14, 0.54, 0, -30, -25, 0],              // diagonal cut through the front
  E([0.54, -62, -46, 0.46, -0.05, -20, -32, 8]),    // follow-through, tip near the ground on the left
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.28, 0.55, 0.4, -0.25, 0.55, -0.6, 1, 0]);
  bend(p, KC(u, 0, 0, 0.28, 0.1, 0.42, -0.28, 0.6, -0.22, 1, 0));
  crouch(p, KC(u, 0, 0, 0.28, -0.03, 0.44, 0.12, 0.7, 0.08, 1, 0), R);
  step(p, 0, u, -0.02, -0.24, 0.28, 0.42, 0.75, 0.98);
} }) });

v('atk2', 'greatsword', { dur: 0.66, hits: [0.42], drag: 0.35, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.26, -72, -40, 0.44, -0.04, 180, -70, 20]),   // low-left back-hand wind up
  [0.42, 8, -6, 0.56, 0, 180, 12, 6],               // rising sweep left → right
  E([0.56, 88, 20, 0.44, 0.04, 180, 32, 16]),
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.26, -0.6, 0.42, 0.15, 0.56, 0.7, 1, 0]);
  bend(p, KC(u, 0, 0, 0.26, -0.15, 0.44, -0.05, 0.6, 0.06, 1, 0));
  crouch(p, KC(u, 0, 0, 0.26, 0.1, 0.44, 0.04, 1, 0), R);
  step(p, 1, u, 0.08, -0.2, 0.3, 0.44, 0.75, 1);
} }) });

v('atk3', 'greatsword', { dur: 0.92, hits: [0.5], drag: 0.55, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.34, 10, 76, 0.32, 0.12, -90, -10, 40]),      // raised high, blade back over the head
  [0.47, 0, 12, 0.56, 0.02, -90, 0, -18],           // crushing vertical chop
  [0.52, 0, -34, 0.54, -0.1, -90, 0, -22],
  E([0.68, 0, -46, 0.52, -0.16, -90, 0, -20]),      // blade bitten into the ground
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.34, 0.2, 0.5, 0, 1, 0]);
  bend(p, KC(u, 0, 0, 0.34, 0.28, 0.5, -0.4, 0.7, -0.5, 1, 0));
  p.add(B.head, KC(u, 0, 0, 0.34, -0.15, 0.55, 0.25, 1, 0), 0, 0);
  crouch(p, KC(u, 0, 0, 0.34, -0.05, 0.52, 0.22, 0.75, 0.2, 1, 0), R);
  step(p, 0, u, 0, -0.32, 0.32, 0.48, 0.78, 1);
  p.hip[2] -= 0.08 * K(u, 0.35, 0, 0.52, 1, 0.8, 1, 1, 0);
} }) });

v('slash_h', 'greatsword', { dur: 0.86, hits: [0.46], drag: 0.6, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.34, 128, -4, 0.42, -0.04, 0, 42, 4]),        // coil far right, blade trailing behind
  [0.46, 18, -8, 0.58, -0.05, 0, 0, 0],             // huge flat sweep through the front
  [0.56, -86, -8, 0.54, -0.04, 0, -8, 0],
  E([0.7, -122, -14, 0.46, -0.06, 0, -24, -4]),     // wrapped around to the left
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.34, 1.0, 0.46, 0.1, 0.56, -0.8, 0.7, -1.05, 1, 0], 0.05, 0.4);
  bend(p, KC(u, 0, 0, 0.34, 0.05, 0.5, -0.14, 1, 0));
  crouch(p, KC(u, 0, 0, 0.34, 0.14, 0.5, 0.18, 0.8, 0.1, 1, 0), R);
  step(p, 0, u, -0.12, -0.14, 0.34, 0.5, 0.8, 1);
  p.add(B.hips, 0, 0, KC(u, 0.3, 0, 0.46, -0.08, 0.7, 0.05, 1, 0));
} }) });

v('slash_v', 'greatsword', { dur: 0.76, hits: [0.46], drag: 0.5, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.32, 16, 80, 0.3, 0.12, -90, -16, 38]),
  [0.46, 0, 0, 0.58, 0, -90, 0, -10],
  E([0.6, 0, -56, 0.5, -0.12, -90, 0, -12]),        // follows through low (no bite)
  gs(1, GS),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.32, 0.26, 0.48, -0.35, 0.65, -0.4, 1, 0));
  crouch(p, KC(u, 0, 0, 0.32, -0.04, 0.5, 0.16, 0.8, 0.1, 1, 0), R);
  step(p, 0, u, 0, -0.26, 0.3, 0.46, 0.78, 1);
} }) });

v('slash_up', 'greatsword', { dur: 0.72, hits: [0.42], drag: 0.5, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.28, -40, -62, 0.4, -0.12, 90, -30, -10]),    // low and to the left, blade dragging
  [0.42, 6, 20, 0.54, 0.04, 90, 10, 20],            // rising diagonal
  E([0.58, 40, 72, 0.4, 0.12, 90, 20, 22]),         // overhead finish (launcher)
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.28, -0.45, 0.42, 0.1, 0.58, 0.35, 1, 0]);
  bend(p, KC(u, 0, 0, 0.28, -0.3, 0.45, 0.05, 0.6, 0.2, 1, 0));
  crouch(p, KC(u, 0, 0, 0.28, 0.2, 0.45, -0.04, 0.6, -0.06, 1, 0), R);
  p.feet[1] += 0.05 * sin(clamp((u - 0.4) / 0.25, 0, 1) * PI); p.feet[6] += 0.05 * sin(clamp((u - 0.4) / 0.25, 0, 1) * PI);
  step(p, 1, u, 0.05, -0.18, 0.26, 0.4, 0.75, 1);
} }) });

v('slash_x', 'greatsword', { dur: 1.0, hits: [0.3, 0.6], drag: 0.6, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.18, 72, 30, 0.3, 0.04, -30, 80, 20]),
  [0.3, 0, -12, 0.56, 0, -40, -30, 0],              // first diagonal ↘
  E([0.42, -60, 38, 0.32, 0.06, 150, -80, 16]),     // swing back up over the left shoulder
  [0.6, 4, -14, 0.56, 0, 140, 30, 0],               // second diagonal ↙ (crossing)
  E([0.72, 66, -44, 0.46, -0.05, 150, 30, 6]),
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.18, 0.5, 0.3, -0.3, 0.42, -0.5, 0.6, 0.3, 0.72, 0.55, 1, 0]);
  bend(p, KC(u, 0, 0, 0.18, 0.08, 0.3, -0.25, 0.42, 0.05, 0.6, -0.28, 1, 0));
  crouch(p, KC(u, 0, 0, 0.3, 0.1, 0.42, 0.02, 0.6, 0.14, 0.85, 0.06, 1, 0), R);
  step(p, 0, u, -0.02, -0.2, 0.18, 0.3, 0.8, 1);
  step(p, 1, u, 0.04, -0.14, 0.45, 0.6, 0.85, 1);
} }) });

v('thrust', 'greatsword', { dur: 0.72, hits: [0.44], drag: 0.5, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.3, 70, -26, 0.22, -0.04, 90, -70, 26]),      // drawn back at the right hip, point forward
  [0.44, 4, -8, 0.64, -0.02, 90, -4, 8],            // driving thrust
  E([0.58, 0, -6, 0.66, -0.02, 90, 0, 6]),
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.3, 0.55, 0.44, -0.05, 1, 0]);
  bend(p, KC(u, 0, 0, 0.3, 0.05, 0.46, -0.25, 1, 0));
  crouch(p, KC(u, 0, 0, 0.3, 0.1, 0.46, 0.2, 0.8, 0.12, 1, 0), R);
  step(p, 0, u, 0, -0.42, 0.3, 0.44, 0.8, 1);
  p.hip[2] -= 0.14 * K(u, 0.3, 0, 0.46, 1, 0.8, 1, 1, 0);
} }) });

v('spin', 'greatsword', { dur: 0.95, hits: [0.38, 0.62], drag: 0.8, spinDrag: 1, fn(p, u, ctx) { // full 360° whirl, blade level
  const R = ctx.rig;
  const wind = K(u, 0, 0, 0.18, 1, 0.3, 0);
  const sp = sstep(0.18, 0.82, u);
  p.yaw = -(sp * PI * 2) + wind * 0.55;
  const out = K(u, 0, 0, 0.2, 1, 0.84, 1, 1, 0);
  wieldT(p, 'R', 1, [lerp(GS[0], 96, out), lerp(GS[1], -10, out), lerp(0.42, 0.58, out), 0, lerp(GS[4], 0, out), lerp(GS[5], 14, out), lerp(GS[6], 0, out)], R, 0.02); p.w2h = 1;
  twist(p, 0.4 * out, 0.3);
  crouch(p, 0.14 * out, R);
  bend(p, -0.1 * out);
  stance(p, ctx, 0.2 * out + 0.05, 0.08, -0.08, 0.3);
  p.feet[1] += 0.04 * sin(sp * PI * 4) * out; p.feet[6] += 0.04 * sin(sp * PI * 4 + PI) * out;
} });
v('spin_loop', 'greatsword', { dur: 0.55, loop: true, drag: 0.8, spinDrag: 1, fn(p, u, ctx) { // whirlwind (holding)
  const R = ctx.rig;
  p.yaw = -u * PI * 2;
  wieldT(p, 'R', 1, [96, -12, 0.58, 0, 0, 14, 0], R, 0.02); p.w2h = 1;
  twist(p, 0.4, 0.3); crouch(p, 0.16, R); bend(p, -0.1);
  stance(p, ctx, 0.22, 0.06, -0.06, 0.3);
  p.feet[1] += 0.05 * Math.max(0, sin(u * PI * 4)); p.feet[6] += 0.05 * Math.max(0, sin(u * PI * 4 + PI));
} });

v('leap', 'greatsword', { dur: 0.6, hold: true, move: true, drag: 0.6, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  [0.3, 40, -20, 0.36, -0.1, -90, -30, 10],
  E([0.75, 12, 80, 0.32, 0.12, -90, -12, 40]),      // blade raised overhead at the apex
  E([1, 12, 82, 0.32, 0.12, -90, -12, 40]),
], body(p, u, R, ctx) {
  const c = K(u, 0, 0, 0.28, 1, 0.45, 0);              // crouch before take-off
  const air = sstep(0.3, 0.75, u);
  crouch(p, 0.2 * c, R);
  p.hip[1] += 0.95 * air;
  bend(p, 0.25 * air - 0.2 * c);
  stance(p, ctx, 0.06, 0.08, -0.08, 0.25);
  p.feet[1] += 0.95 * air + 0.22 * air; p.feet[2] -= 0.15 * air; p.feet[3] = -0.5 * air;
  p.feet[6] += 0.95 * air + 0.05 * air; p.feet[7] += 0.2 * air; p.feet[8] = -0.7 * air;
} }) });
v('slam', 'greatsword', { dur: 0.62, hits: [0.3], drag: 0.6, fn: blade({ twoHand: true, R: [
  [0, 12, 82, 0.32, 0.12, -90, -12, 40],
  [0.26, 0, -10, 0.56, -0.05, -90, 0, -20],         // dive: blade comes down with the body
  E([0.34, 0, -48, 0.52, -0.2, -90, 0, -22]),       // slammed into the ground
  E([0.62, 0, -46, 0.5, -0.18, -90, 0, -20]),
  gs(1, GS),
], body(p, u, R, ctx) {
  const air = 1 - sstep(0, 0.28, u);
  p.hip[1] += 0.95 * air;
  const land = K(u, 0.24, 0, 0.34, 1, 0.65, 0.9, 1, 0);
  crouch(p, 0.3 * land, R);
  bend(p, 0.25 * air - 0.5 * land);
  stance(p, ctx, 0.1 * land + 0.06, 0.25 * land + 0.08 * air, -0.12, 0.35);
  p.feet[1] += 1.17 * air; p.feet[3] = -0.5 * air; p.feet[6] += 1.0 * air; p.feet[8] = -0.7 * air;
} }) });

v('charge_hold', 'greatsword', { dur: 1.1, loop: true, drag: 0.2, fn(p, u, ctx) { // gathering power, blade dragged behind
  const R = ctx.rig, tr = sin(u * PI * 16) * 0.8, br = sin(u * PI * 2);
  wieldT(p, 'R', 1, [118, -50 + br * 2, 0.42, -0.06, 0, 58, -18 + tr], R, 0.02); p.w2h = 1;
  twist(p, 0.75 + br * 0.03, 0.4); bend(p, -0.22); crouch(p, 0.2 + br * 0.01, R);
  base(p, ctx, 0.2, 0.26, 0.2, 0.55);
  p.add(B.head, 0.05, 0.1, 0);
} });
v('charge_release', 'greatsword', { dur: 0.7, hits: [0.28], drag: 0.8, fn: blade({ twoHand: true, R: [
  [0, 118, -50, 0.42, -0.06, 0, 58, -18],
  [0.28, 10, 10, 0.58, 0.02, 90, 0, 14],            // explosive rising diagonal
  E([0.42, -40, 64, 0.4, 0.1, 90, -20, 20]),
  gs(1, GS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0.75, 0.28, -0.1, 0.42, -0.4, 1, 0], 0.03, 0.4);
  bend(p, KC(u, 0, -0.22, 0.28, 0.05, 0.45, 0.12, 1, 0));
  crouch(p, KC(u, 0, 0.2, 0.28, 0.06, 0.45, -0.02, 1, 0), R);
  step(p, 0, u, 0, -0.3, 0.05, 0.28, 0.8, 1);
} }) });

v('dash_strike', 'greatsword', { dur: 0.62, hits: [0.56], move: true, drag: 0.9, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.4, 100, -30, 0.36, -0.06, 0, 60, 10]),       // blade trailing low behind during the rush
  [0.56, -6, -8, 0.58, -0.02, 0, -8, 0],            // cleave at the end of the rush
  E([0.7, -95, -18, 0.46, -0.05, 0, -20, -2]),
  gs(1, GS),
], body(p, u, R, ctx) {
  const rush = K(u, 0, 0, 0.12, 1, 0.5, 1, 0.62, 0);
  crouch(p, 0.16 * rush + 0.1 * K(u, 0.5, 0, 0.58, 1, 0.9, 0), R);
  bend(p, -0.35 * rush - 0.2 * K(u, 0.5, 0, 0.58, 1, 0.9, 0));
  swingTwist(p, u, [0, 0, 0.4, 0.6, 0.56, -0.2, 0.7, -0.7, 1, 0]);
  const ph = clamp(u / 0.5, 0, 1);
  stance(p, ctx, 0.04, 0, 0, 0.15);
  p.feet[2] -= (0.45 * sin(ph * PI)) * rush; p.feet[1] += 0.1 * sin(ph * PI) * rush;
  p.feet[7] += 0.4 * rush; p.feet[6] += 0.12 * rush * sin(clamp(ph * 1.5, 0, 1) * PI); p.toe[1] = 0.6 * rush;
} }) });

v('uppercut', 'greatsword', { dur: 0.66, hits: [0.4], drag: 0.5, fn: blade({ twoHand: true, R: [
  gs(0, GS),
  E([0.26, 10, -70, 0.36, -0.14, -90, 0, -20]),     // blade low in front, point down-forward
  [0.4, 0, 20, 0.54, 0.04, -90, 0, 30],             // straight up through the enemy
  E([0.56, -6, 84, 0.34, 0.14, -90, 0, 30]),
  gs(1, GS),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.26, -0.35, 0.42, 0.1, 0.56, 0.25, 1, 0));
  crouch(p, KC(u, 0, 0, 0.26, 0.22, 0.42, -0.05, 0.6, -0.04, 1, 0), R);
  p.feet[1] += 0.06 * sin(clamp((u - 0.38) / 0.2, 0, 1) * PI); p.feet[6] += 0.06 * sin(clamp((u - 0.38) / 0.2, 0, 1) * PI);
  step(p, 0, u, 0, -0.2, 0.24, 0.38, 0.75, 1);
} }) });

v('block', 'greatsword', { dur: 1.0, loop: true, fn(p, u, ctx) { // flat of the blade across the body, braced
  const R = ctx.rig, br = sin(u * PI * 2) * 0.01;
  wieldT(p, 'R', 1, [40, -18, 0.3, br, 0, -128, 72], R, 0.02); p.w2h = 1;
  twist(p, 0.25, 0.3); bend(p, -0.12); crouch(p, 0.14, R);
  base(p, ctx, 0.18, 0.2, 0.2, 0.45);
} });
v('buff', 'greatsword', { dur: 1.1, drag: 0.3, fn: blade({ twoHand: true, R: [ // plant the blade point-down, both hands on the pommel, chest out
  gs(0, GS),
  E([0.3, 0, -28, 0.34, 0.08, 0, 0, -70]),
  E([0.8, 0, -28, 0.34, 0.08, 0, 0, -70]),
  gs(1, GS),
], body(p, u, R) {
  const k = K(u, 0, 0, 0.3, 1, 0.8, 1, 1, 0);
  bend(p, 0.12 * k); p.add(B.head, -0.2 * k, 0, 0);
  setClav(p, 'L', 0.1 * k); setClav(p, 'R', 0.1 * k);
  stance(p, { rig: R }, 0.08 * k + 0.02, 0.05, -0.05, 0.3);
  p.face = k > 0.5 ? 2 : 0;
} }) });

v('victory', 'greatsword', { dur: 1.8, drag: 0.3, fn: blade({ twoHand: (u) => 1 - K(u, 0.1, 0, 0.3, 1, 0.85, 1, 1, 0), R: [
  gs(0, GS),
  E([0.35, 30, 78, 0.44, 0.24, -90, 0, 12]),        // one-handed salute, blade to the sky
  E([0.85, 30, 80, 0.46, 0.25, -90, 0, 12]),
  gs(1, GS),
], body(p, u, R) {
  const k = K(u, 0, 0, 0.35, 1, 0.85, 1, 1, 0);
  bend(p, 0.15 * k); p.add(B.head, -0.25 * k, 0.1 * k, 0);
  setArm(p, 'L', 0.2, 0.35 * k + 0.1, 0, 1.5 * k, 0, 0, 1.4); fist(p, 'L');
  stance(p, { rig: R }, 0.1 * k, 0.1, -0.1, 0.35);
  p.face = k > 0.6 ? 2 : 0;
} }) });

// ===================================================================================================
// LONGSWORD (Oathkeeper): one-handed, elegant and precise; the off hand balances (or opens toward the tome)
const LS = [26, -36, 0.44, 0, 90, -40, 70];
const ls = (t, arr) => [t, ...arr];
v('atk1', 'sword', { dur: 0.5, hits: [0.38], drag: 0.2, fn: blade({ px: 0.14, R: [
  ls(0, LS), E([0.24, 92, 10, 0.38, 0.02, 0, 40, 5]), [0.38, 0, -4, 0.56, 0, 0, -10, 0], E([0.52, -72, -12, 0.46, -0.02, 0, -30, -4]), ls(1, LS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.24, 0.5, 0.38, -0.1, 0.52, -0.5, 1, 0]);
  bend(p, KC(u, 0, 0, 0.38, -0.12, 1, 0)); crouch(p, KC(u, 0, 0, 0.4, 0.08, 1, 0), R);
  step(p, 0, u, 0, -0.16, 0.22, 0.38, 0.75, 1);
} }) });
v('atk2', 'sword', { dur: 0.52, hits: [0.38], drag: 0.2, fn: blade({ px: 0.14, R: [
  ls(0, LS), E([0.24, -60, -20, 0.38, -0.02, 180, -50, 10]), [0.38, 10, -2, 0.56, 0, 180, 20, 4], E([0.52, 84, 12, 0.46, 0.02, 180, 40, 10]), ls(1, LS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.24, -0.55, 0.38, 0.15, 0.52, 0.55, 1, 0]);
  bend(p, KC(u, 0, 0, 0.38, -0.1, 1, 0)); crouch(p, KC(u, 0, 0, 0.4, 0.06, 1, 0), R);
  step(p, 1, u, 0.06, -0.14, 0.24, 0.38, 0.75, 1);
} }) });
v('atk3', 'sword', { dur: 0.72, hits: [0.46], drag: 0.4, fn: blade({ px: 0.1, R: [
  ls(0, LS), E([0.3, 20, 80, 0.34, 0.1, -90, -10, 35]), [0.46, 0, -4, 0.6, 0, -90, 0, -14], E([0.6, 0, -40, 0.54, -0.1, -90, 0, -14]), ls(1, LS),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.3, 0.2, 0.47, -0.32, 0.65, -0.3, 1, 0)); crouch(p, KC(u, 0, 0, 0.3, -0.04, 0.48, 0.16, 0.8, 0.1, 1, 0), R);
  step(p, 0, u, 0, -0.28, 0.28, 0.46, 0.78, 1);
} }) });
v('slash_h', 'sword', { dur: 0.62, hits: [0.42], drag: 0.4, fn: blade({ px: 0.12, R: [
  ls(0, LS), E([0.28, 120, 0, 0.42, 0, 0, 40, 0]), [0.42, 10, -6, 0.6, -0.02, 0, 0, 0], E([0.58, -110, -10, 0.5, -0.04, 0, -20, 0]), ls(1, LS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.28, 0.85, 0.42, 0.05, 0.58, -0.85, 1, 0], 0.05, 0.4);
  crouch(p, KC(u, 0, 0, 0.28, 0.1, 0.45, 0.14, 1, 0), R); step(p, 0, u, -0.1, -0.12, 0.28, 0.44, 0.8, 1);
} }) });
v('slash_v', 'sword', { dur: 0.6, hits: [0.42], drag: 0.4, fn: blade({ px: 0.1, R: [
  ls(0, LS), E([0.28, 20, 82, 0.34, 0.1, -90, -10, 35]), [0.42, 0, -2, 0.6, 0, -90, 0, -12], E([0.56, 0, -52, 0.52, -0.1, -90, 0, -10]), ls(1, LS),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.28, 0.2, 0.44, -0.3, 1, 0)); crouch(p, KC(u, 0, 0, 0.44, 0.14, 1, 0), R); step(p, 0, u, 0, -0.24, 0.26, 0.42, 0.78, 1);
} }) });
v('slash_up', 'sword', { dur: 0.58, hits: [0.38], drag: 0.4, fn: blade({ px: 0.12, R: [
  ls(0, LS), E([0.24, -30, -64, 0.42, -0.1, 90, -20, -10]), [0.38, 10, 24, 0.56, 0.04, 90, 10, 20], E([0.54, 40, 76, 0.42, 0.12, 90, 20, 20]), ls(1, LS),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.24, -0.3, 0.4, 0.1, 0.55, 0.2, 1, 0)); crouch(p, KC(u, 0, 0, 0.24, 0.18, 0.42, -0.04, 1, 0), R);
  step(p, 1, u, 0.05, -0.16, 0.24, 0.38, 0.75, 1);
} }) });
v('slash_x', 'sword', { dur: 0.8, hits: [0.3, 0.58], drag: 0.5, fn: blade({ px: 0.12, R: [
  ls(0, LS), E([0.16, 72, 34, 0.34, 0.04, -30, 70, 20]), [0.3, 0, -12, 0.58, 0, -40, -30, 0], E([0.42, -56, 40, 0.34, 0.06, 150, -70, 16]), [0.58, 6, -14, 0.58, 0, 140, 30, 0], E([0.7, 64, -40, 0.46, -0.05, 150, 30, 6]), ls(1, LS),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.16, 0.45, 0.3, -0.25, 0.42, -0.45, 0.58, 0.3, 0.72, 0.5, 1, 0]);
  crouch(p, KC(u, 0, 0, 0.3, 0.1, 0.44, 0.02, 0.6, 0.12, 1, 0), R); step(p, 0, u, 0, -0.18, 0.16, 0.3, 0.8, 1);
} }) });
v('thrust', 'sword', { dur: 0.56, hits: [0.38], drag: 0.4, fn: blade({ px: 0.12, R: [
  ls(0, LS), E([0.24, 64, -20, 0.2, -0.02, 90, -64, 20]), [0.38, 4, -6, 0.68, 0, 90, -4, 6], E([0.52, 0, -4, 0.7, 0, 90, 0, 4]), ls(1, LS),
], freeK: -1, body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.24, 0.45, 0.38, -0.2, 1, 0]); bend(p, KC(u, 0, 0, 0.4, -0.25, 1, 0)); crouch(p, KC(u, 0, 0, 0.4, 0.2, 0.8, 0.12, 1, 0), R);
  step(p, 0, u, 0, -0.45, 0.22, 0.38, 0.8, 1); p.hip[2] -= 0.12 * K(u, 0.22, 0, 0.4, 1, 0.8, 1, 1, 0);
} }) });
v('spin', 'sword', { dur: 0.72, hits: [0.45], drag: 0.7, spinDrag: 1, fn(p, u, ctx) {
  const R = ctx.rig, sp = sstep(0.15, 0.8, u), out = K(u, 0, 0, 0.18, 1, 0.84, 1, 1, 0);
  p.yaw = -sp * PI * 2;
  wieldT(p, 'R', 1, [lerp(LS[0], 92, out), lerp(LS[1], -8, out), lerp(0.44, 0.6, out), 0, lerp(90, 0, out), lerp(-40, 10, out), lerp(70, 0, out)], R, 0.12);
  setArm(p, 'L', 0.2, 0.9 * out, 0, 0.6, 0, 0, 1.2); crouch(p, 0.12 * out, R); stance(p, ctx, 0.14 * out + 0.04, 0.06, -0.06, 0.3);
} });
v('block', 'sword', { dur: 1.0, loop: true, fn(p, u, ctx) {
  const R = ctx.rig;
  wieldT(p, 'R', 1, [18, -6, 0.36, 0, 0, -110, 60], R, 0.12);
  setArm(p, 'L', 1.1, 0.25, 0.6, 1.9, 0, 0, 1.3); fist(p, 'L');
  twist(p, 0.2, 0.3); crouch(p, 0.12, R); base(p, ctx, 0.14, 0.2, 0.16, 0.4);
} });
v('victory', 'sword', { dur: 1.8, fn: blade({ px: 0.12, R: [ls(0, LS), E([0.35, 20, 80, 0.46, 0.24, -90, 0, 10]), E([0.85, 20, 82, 0.47, 0.25, -90, 0, 10]), ls(1, LS)], body(p, u, R) {
  const k = K(u, 0, 0, 0.35, 1, 0.85, 1, 1, 0); bend(p, 0.12 * k); p.add(B.head, -0.25 * k, 0, 0); setArm(p, 'L', 0.3 * k, 0.3, 0.3, 1.8 * k, 0, 0, 1.3);
  p.face = k > 0.6 ? 2 : 0;
} }) });

// ===================================================================================================
// TWIN BLADES (Bladedancer): fast, low, alternating; lots of spins
const BR = [58, -40, 0.4, 0, 180, 20, -40], BL = [-15, -30, 0.44, 0, 0, -30, -35];
const bl = (t, a) => [t, ...a];
v('atk1', 'blades', { dur: 0.36, hits: [0.36], drag: 0.2, fn: blade({ px: 0.12, pxL: -0.12, R: [
  bl(0, BR), E([0.2, 100, 20, 0.34, 0.02, 0, 40, 10]), [0.36, -10, -8, 0.58, 0, 0, -10, 0], E([0.5, -60, -20, 0.5, -0.02, 0, -20, 0]), bl(1, BR),
], L: [bl(0, BL), bl(0.3, [-30, -40, 0.38, 0, 0, -30, -30]), bl(1, BL)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.2, 0.45, 0.36, -0.3, 0.5, -0.4, 1, 0]); crouch(p, 0.06, R); step(p, 0, u, 0, -0.14, 0.18, 0.34, 0.75, 1);
} }) });
v('atk2', 'blades', { dur: 0.36, hits: [0.36], drag: 0.2, fn: blade({ px: 0.12, pxL: -0.12, R: [bl(0, BR), bl(0.3, [70, -30, 0.36, 0, 180, 30, -30]), bl(1, BR)], L: [
  bl(0, BL), E([0.2, -100, 20, 0.34, 0.02, 180, -40, 10]), [0.36, 10, -8, 0.58, 0, 180, 10, 0], E([0.5, 60, -20, 0.5, -0.02, 180, 20, 0]), bl(1, BL),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.2, -0.45, 0.36, 0.3, 0.5, 0.4, 1, 0]); crouch(p, 0.06, R); step(p, 1, u, 0.04, -0.14, 0.18, 0.34, 0.75, 1);
} }) });
v('atk3', 'blades', { dur: 0.6, hits: [0.3, 0.52], drag: 0.5, fn: blade({ px: 0.12, pxL: -0.12, R: [
  bl(0, BR), E([0.18, 60, 60, 0.3, 0.06, -60, 40, 30]), [0.3, -20, -10, 0.56, 0, -60, -20, -10], E([0.4, -40, -30, 0.46, -0.04, -60, -20, -10]), [0.52, 40, 0, 0.56, 0, 0, 20, 0], E([0.64, 80, -10, 0.5, 0, 0, 30, 0]), bl(1, BR),
], L: [
  bl(0, BL), E([0.18, -60, 60, 0.3, 0.06, 60, -40, 30]), [0.3, 20, -10, 0.56, 0, 60, 20, -10], E([0.4, 40, -30, 0.46, -0.04, 60, 20, -10]), [0.52, -40, 0, 0.56, 0, 180, -20, 0], E([0.64, -80, -10, 0.5, 0, 180, -30, 0]), bl(1, BL),
], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.18, 0.15, 0.3, -0.25, 0.52, -0.1, 1, 0)); crouch(p, KC(u, 0, 0.05, 0.3, 0.16, 0.52, 0.1, 1, 0.04), R);
  step(p, 0, u, 0, -0.2, 0.16, 0.3, 0.8, 1);
} }) });
v('slash_x', 'blades', { dur: 0.6, hits: [0.38], drag: 0.5, fn: blade({ px: 0.12, pxL: -0.12, R: [bl(0, BR), E([0.24, 50, 55, 0.32, 0.04, -40, 50, 20]), [0.38, -40, -20, 0.56, 0, -40, -30, 0], E([0.52, -60, -35, 0.5, -0.04, -40, -30, 0]), bl(1, BR)],
  L: [bl(0, BL), E([0.24, -50, 55, 0.32, 0.04, 40, -50, 20]), [0.38, 40, -20, 0.56, 0, 40, 30, 0], E([0.52, 60, -35, 0.5, -0.04, 40, 30, 0]), bl(1, BL)], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.24, 0.12, 0.4, -0.3, 1, 0)); crouch(p, KC(u, 0, 0, 0.4, 0.18, 1, 0.04), R); step(p, 0, u, 0, -0.22, 0.22, 0.38, 0.8, 1);
} }) });
vs('slash_h', ['blades'], { dur: 0.5, hits: [0.36], drag: 0.5, fn: blade({ px: 0.12, pxL: -0.12, R: [bl(0, BR), E([0.22, 120, 0, 0.4, 0, 0, 30, 0]), [0.36, 0, -6, 0.6, 0, 0, 0, 0], E([0.52, -110, -10, 0.5, 0, 0, -20, 0]), bl(1, BR)],
  L: [bl(0, BL), bl(0.36, [-110, -20, 0.4, 0, 0, -30, -20]), bl(1, BL)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.22, 0.8, 0.36, 0, 0.52, -0.8, 1, 0], 0.05, 0.4); crouch(p, 0.12, R); step(p, 0, u, -0.1, -0.12, 0.2, 0.36, 0.8, 1);
} }) });
v('spin', 'blades', { dur: 0.55, hits: [0.3, 0.5], drag: 0.7, spinDrag: 1, fn(p, u, ctx) { // spincutter: blades out both sides
  const R = ctx.rig, sp = sstep(0.1, 0.85, u), out = K(u, 0, 0, 0.15, 1, 0.85, 1, 1, 0);
  p.yaw = -sp * PI * 2;
  wieldT(p, 'R', 1, [lerp(BR[0], 90, out), lerp(BR[1], -6, out), lerp(0.4, 0.58, out), 0, lerp(180, 0, out), lerp(20, 20, out), lerp(-40, 0, out)], R, 0.12);
  wieldT(p, 'L', 1, [lerp(BL[0], -90, out), lerp(BL[1], -6, out), lerp(0.44, 0.58, out), 0, lerp(0, 180, out), lerp(-30, -20, out), lerp(-35, 0, out)], R, -0.12);
  crouch(p, 0.16 * out, R); stance(p, ctx, 0.16 * out + 0.04, 0.05, -0.05, 0.3);
} });
v('spin_loop', 'blades', { dur: 0.4, loop: true, drag: 0.8, spinDrag: 1, fn(p, u, ctx) { // blade dance
  const R = ctx.rig; p.yaw = -u * PI * 2;
  wieldT(p, 'R', 1, [90, -4, 0.58, 0, 0, 20, 0], R, 0.12); wieldT(p, 'L', 1, [-90, -12, 0.58, 0, 180, -20, 0], R, -0.12);
  crouch(p, 0.18, R); stance(p, ctx, 0.18, 0.04, -0.04, 0.3);
  p.feet[1] += 0.05 * Math.max(0, sin(u * PI * 4)); p.feet[6] += 0.05 * Math.max(0, sin(u * PI * 4 + PI));
} });
v('dash_strike', 'blades', { dur: 0.5, hits: [0.5], move: true, drag: 0.9, fn: blade({ px: 0.12, pxL: -0.12, R: [bl(0, BR), E([0.35, 150, -30, 0.4, 0, 0, 20, 10]), [0.5, -30, -10, 0.58, 0, 0, -10, 0], E([0.64, -70, -20, 0.5, 0, 0, -20, 0]), bl(1, BR)],
  L: [bl(0, BL), E([0.35, -150, -30, 0.4, 0, 180, -20, 10]), [0.5, 30, -10, 0.58, 0, 180, 10, 0], E([0.64, 70, -20, 0.5, 0, 180, 20, 0]), bl(1, BL)], body(p, u, R, ctx) {
  const rush = K(u, 0, 0, 0.1, 1, 0.45, 1, 0.6, 0);
  crouch(p, 0.2 * rush, R); bend(p, -0.45 * rush);
  stance(p, ctx, 0.04, 0, 0, 0.15);
  const ph = clamp(u / 0.45, 0, 1);
  p.feet[2] -= 0.5 * sin(ph * PI) * rush; p.feet[1] += 0.1 * sin(ph * PI) * rush; p.feet[7] += 0.4 * rush; p.toe[1] = 0.6 * rush;
} }) });
v('uppercut', 'blades', { dur: 0.5, hits: [0.34], drag: 0.5, fn: blade({ px: 0.12, pxL: -0.12, R: [bl(0, BR), E([0.2, 20, -60, 0.4, -0.1, -90, 0, -20]), [0.34, 10, 30, 0.54, 0.04, -90, 0, 30], E([0.5, 10, 80, 0.36, 0.12, -90, 0, 20]), bl(1, BR)],
  L: [bl(0, BL), E([0.2, -20, -60, 0.4, -0.1, -90, 0, -20]), [0.34, -10, 30, 0.54, 0.04, -90, 0, 30], E([0.5, -10, 80, 0.36, 0.12, -90, 0, 20]), bl(1, BL)], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.2, -0.3, 0.36, 0.1, 0.5, 0.2, 1, 0)); crouch(p, KC(u, 0, 0, 0.2, 0.22, 0.36, -0.06, 0.6, -0.04, 1, 0), R);
  const air = sin(clamp((u - 0.3) / 0.35, 0, 1) * PI); p.hip[1] += 0.18 * air; p.feet[1] += 0.18 * air; p.feet[6] += 0.18 * air;
} }) });

// ===================================================================================================
// GLAIVE (Demonbound): long two-handed polearm, wide sweeping arcs and thrusts
const GV = [30, -40, 0.36, 0, 90, -70, 75];
const gv = (t, a) => [t, ...a];
v('atk1', 'glaive', { dur: 0.52, hits: [0.38], drag: 0.3, fn: blade({ twoHand: true, R: [gv(0, GV), E([0.24, 100, 10, 0.34, 0, 0, 40, 5]), [0.38, 0, -8, 0.5, 0, 0, -10, 0], E([0.52, -80, -16, 0.44, -0.02, 0, -30, -2]), gv(1, GV)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.24, 0.6, 0.38, -0.15, 0.52, -0.6, 1, 0]); crouch(p, KC(u, 0, 0, 0.4, 0.1, 1, 0), R); step(p, 0, u, -0.04, -0.18, 0.22, 0.38, 0.8, 1);
} }) });
v('atk2', 'glaive', { dur: 0.52, hits: [0.38], drag: 0.3, fn: blade({ twoHand: true, R: [gv(0, GV), E([0.24, -80, -20, 0.4, -0.02, 180, -50, 10]), [0.38, 10, -4, 0.52, 0, 180, 20, 4], E([0.52, 90, 10, 0.44, 0.02, 180, 40, 10]), gv(1, GV)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.24, -0.6, 0.38, 0.15, 0.52, 0.6, 1, 0]); crouch(p, KC(u, 0, 0, 0.4, 0.08, 1, 0), R); step(p, 1, u, 0.06, -0.16, 0.24, 0.38, 0.8, 1);
} }) });
v('atk3', 'glaive', { dur: 0.7, hits: [0.46], drag: 0.5, fn: blade({ twoHand: true, R: [gv(0, GV), E([0.3, 60, -20, 0.2, -0.02, 90, -60, 20]), [0.46, 0, -6, 0.62, 0, 90, 0, 6], E([0.6, 0, -4, 0.66, 0, 90, 0, 4]), gv(1, GV)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.3, 0.5, 0.46, -0.1, 1, 0]); bend(p, KC(u, 0, 0, 0.46, -0.25, 1, 0)); crouch(p, KC(u, 0, 0, 0.46, 0.2, 0.8, 0.12, 1, 0), R);
  step(p, 0, u, 0, -0.42, 0.3, 0.46, 0.8, 1); p.hip[2] -= 0.12 * K(u, 0.3, 0, 0.48, 1, 0.8, 1, 1, 0);
} }) });
M.thrust.v.glaive = M.atk3.v.glaive;
v('slash_h', 'glaive', { dur: 0.72, hits: [0.44], drag: 0.6, fn: blade({ twoHand: true, R: [gv(0, GV), E([0.3, 130, -4, 0.36, -0.04, 0, 40, 4]), [0.44, 10, -8, 0.52, -0.04, 0, 0, 0], E([0.62, -120, -12, 0.44, -0.04, 0, -24, -4]), gv(1, GV)], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.3, 1.0, 0.44, 0.05, 0.62, -1.0, 1, 0], 0.05, 0.4); crouch(p, KC(u, 0, 0, 0.3, 0.14, 0.5, 0.18, 1, 0), R); step(p, 0, u, -0.1, -0.12, 0.3, 0.46, 0.8, 1);
} }) });
v('slash_v', 'glaive', { dur: 0.7, hits: [0.44], drag: 0.5, fn: blade({ twoHand: true, R: [gv(0, GV), E([0.3, 10, 78, 0.32, 0.1, -90, -10, 36]), [0.44, 0, 0, 0.54, 0, -90, 0, -10], E([0.6, 0, -50, 0.5, -0.12, -90, 0, -12]), gv(1, GV)], body(p, u, R) {
  bend(p, KC(u, 0, 0, 0.3, 0.25, 0.46, -0.35, 1, 0)); crouch(p, KC(u, 0, 0, 0.46, 0.16, 1, 0), R); step(p, 0, u, 0, -0.26, 0.28, 0.44, 0.78, 1);
} }) });
v('spin', 'glaive', { dur: 0.8, hits: [0.36, 0.6], drag: 0.8, spinDrag: 1, fn(p, u, ctx) {
  const R = ctx.rig, sp = sstep(0.14, 0.85, u), out = K(u, 0, 0, 0.18, 1, 0.85, 1, 1, 0);
  p.yaw = -sp * PI * 2;
  wieldT(p, 'R', 1, [lerp(GV[0], 90, out), lerp(GV[1], -8, out), lerp(0.36, 0.5, out), 0, lerp(90, 0, out), lerp(-70, 10, out), lerp(75, 0, out)], R, 0.02); p.w2h = 1;
  twist(p, 0.4 * out, 0.3); crouch(p, 0.14 * out, R); stance(p, ctx, 0.18 * out + 0.04, 0.06, -0.06, 0.3);
} });
v('throw_weapon', 'glaive', { dur: 0.7, hits: [0.42], drag: 0.5, fn: blade({ twoHand: (u) => 1 - K(u, 0.2, 0, 0.3, 1, 0.8, 1, 1, 0), R: [ // hurl the glaive spinning (visual stays in hand; FX flies)
  gv(0, GV), E([0.3, 110, 30, 0.34, 0.06, 0, 60, 10]), [0.42, 0, 0, 0.62, 0, 0, -10, 0], E([0.56, -60, -20, 0.5, -0.04, 0, -20, 0]), gv(1, GV),
], body(p, u, R) {
  swingTwist(p, u, [0, 0, 0.3, 0.9, 0.42, -0.1, 0.56, -0.6, 1, 0], 0.05, 0.4); bend(p, KC(u, 0, 0, 0.3, 0.1, 0.44, -0.3, 1, 0));
  crouch(p, KC(u, 0, 0, 0.44, 0.12, 1, 0), R); step(p, 0, u, 0, -0.26, 0.28, 0.42, 0.8, 1);
  setArm(p, 'L', 0.2 + 0.6 * K(u, 0.3, 0, 0.45, 1, 0.8, 0), 0.5, 0, 0.6, 0, 0, 1.2);
} }) });

// ===================================================================================================
// CLAWS (demon form): hunched, bestial swipes with both hands (FK arms, fingers splayed)
function claws(p, u, R, keysL, keysR) {
  const l = KC(u, ...keysL), r = KC(u, ...keysR);
  setArm(p, 'R', 0.6 + 1.2 * r, 0.6 - 0.5 * r, 0.2 + 0.6 * r, 1.3 - 1.1 * Math.max(0, r), -0.3, 0, 0.5);
  setArm(p, 'L', 0.6 + 1.2 * l, 0.6 - 0.5 * l, 0.2 + 0.6 * l, 1.3 - 1.1 * Math.max(0, l), -0.3, 0, 0.5);
  setFingers(p, 'R', 0.5, 0.4, 0.3); setFingers(p, 'L', 0.5, 0.4, 0.3);
}
v('atk1', 'claws', { dur: 0.46, hits: [0.36], drag: 0.3, face: 2, fn(p, u, ctx) { const R = ctx.rig; claws(p, u, R, [0, 0, 1, 0], [0, 0, 0.22, -0.6, 0.36, 1, 0.52, 0.6, 1, 0]); swingTwist(p, u, [0, 0, 0.22, 0.4, 0.36, -0.3, 1, 0]); crouch(p, 0.14, R); step(p, 1, u, 0.06, -0.16, 0.2, 0.36, 0.8, 1); } });
v('atk2', 'claws', { dur: 0.46, hits: [0.36], drag: 0.3, face: 2, fn(p, u, ctx) { const R = ctx.rig; claws(p, u, R, [0, 0, 0.22, -0.6, 0.36, 1, 0.52, 0.6, 1, 0], [0, 0, 1, 0]); swingTwist(p, u, [0, 0, 0.22, -0.4, 0.36, 0.3, 1, 0]); crouch(p, 0.14, R); step(p, 0, u, -0.06, -0.16, 0.2, 0.36, 0.8, 1); } });
v('atk3', 'claws', { dur: 0.7, hits: [0.48], drag: 0.5, face: 2, fn(p, u, ctx) { // both claws raised then raked down
  const R = ctx.rig, k = [0, 0, 0.3, 1.1, 0.48, -0.2, 0.62, -0.1, 1, 0]; claws(p, u, R, k, k);
  bend(p, KC(u, 0, 0, 0.3, 0.25, 0.48, -0.45, 1, 0)); crouch(p, KC(u, 0, 0, 0.48, 0.2, 1, 0), R); step(p, 0, u, 0, -0.26, 0.28, 0.46, 0.8, 1);
} });
for (const n of ['slash_h', 'slash_v', 'slash_x', 'slash_up', 'uppercut', 'thrust']) M[n].v.claws = M.atk3.v.claws;
