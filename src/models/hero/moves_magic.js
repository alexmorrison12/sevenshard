// Magic & support move library: star staff (Starcaller), harp (Songweaver), and generic casts for every class.
// The harp is held with weapon IK (left hand) so its strings sit where the right hand strums them.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { sin, cos, PI, clamp, lerp, sstep, K, KC, E, track, wieldT, step, crouch, twist, bend, base, fist, fistAt, aimGun, M, def, v, vs } from './movelib.js';

const P3 = (p, R, s, u, f) => [s + p.hip[0], R.chestY + u + p.hip[1], -f + p.hip[2]];
const open = (p, s, c = 0.08) => setFingers(p, s, c, c * 0.7, 0.15);
/** open palm facing forward (fingers up) at a chest-relative point */
function palm(p, side, R, s, u, f, w = 1, dir = [0, 0.2, -1]) {
  const sg = side === 'R' ? 1 : -1;
  fistAt(side === 'R' ? p.wR : p.wL, w, P3(p, R, s, u, f), [dir[0], 1, dir[2] * 0.3], [-sg, 0, 0]);
  open(p, side);
}

// ---- generic casts (any class; weapon stays in its hold hand) ---------------------------------------------
def('cast', { dur: 0.7, hits: [0.46], attack: true, drag: 0.3, blendIn: 0.08, blendOut: 0.8, fn(p, u, ctx, A) { // gather at the chest, push forward
  const R = ctx.rig;
  const g = K(u, 0, 0, 0.32, 1, 0.42, 0), r = K(u, 0.34, 0, 0.46, 1, 0.72, 1, 1, 0);
  const s = lerp(-0.08, -0.14, r), up = lerp(0.02, 0.1, r), f = lerp(0.22, 0.58, r);
  palm(p, 'L', R, s, up - 0.05 * g, f, Math.max(g, r));
  if (!A.gripR || !p.wR[0]) palm(p, 'R', R, -s, up - 0.05 * g, f, Math.max(g, r));
  twist(p, 0.3 * g - 0.2 * r, 0.3); bend(p, 0.08 * g - 0.12 * r); crouch(p, 0.08 * r, R);
  step(p, 0, u, 0, -0.16, 0.3, 0.46, 0.8, 1);
} });
def('cast_up', { dur: 0.9, hits: [0.52], attack: true, drag: 0.3, blendIn: 0.08, blendOut: 0.82, fn(p, u, ctx) { // arms / weapon raised to the sky
  const R = ctx.rig, k = K(u, 0, 0, 0.4, 1, 0.52, 1.1, 0.8, 1, 1, 0);
  for (const s of ['L', 'R']) { setArm(p, s, 0.3 + 0.6 * k, 0.3 + 2.1 * k, -0.4, 0.4 - 0.2 * k, -0.3, 0, 0.15); setClav(p, s, 0.25 * k); }
  bend(p, 0.2 * k); p.add(B.head, -0.35 * k, 0, 0); p.hip[1] += 0.03 * k;
  p.wR[0] *= 1 - k; p.w2h *= 1 - k; p.face = k > 0.8 ? 2 : 0;
} });
def('cast_ground', { dur: 0.9, hits: [0.5], attack: true, drag: 0.3, blendIn: 0.08, blendOut: 0.82, fn(p, u, ctx) { // palm slammed to the ground
  const R = ctx.rig, k = K(u, 0, 0, 0.36, 1, 0.5, 1.2, 0.8, 1, 1, 0), dn = K(u, 0.3, 0, 0.5, 1, 0.8, 1, 1, 0);
  palm(p, 'R', R, 0.14, lerp(0.1, -0.78, dn), lerp(0.25, 0.45, dn), k, [0, 0, -1]);
  crouch(p, 0.36 * dn, R); bend(p, -0.45 * dn); base(p, ctx, 0.2, 0.3 * dn, 0.2, 0.5);
  p.feet[8] -= 0.9 * dn; p.toe[1] = 0.8 * dn;
} });
def('channel', { dur: 1.6, loop: true, attack: true, drag: 0.1, blendIn: 0.1, fn(p, u, ctx) { // both hands forward, energy flowing
  const R = ctx.rig, tr = sin(u * PI * 22) * 0.004, br = sin(u * PI * 2);
  palm(p, 'L', R, -0.12, 0.08 + tr, 0.52); palm(p, 'R', R, 0.12, 0.08 - tr, 0.52);
  bend(p, -0.06); crouch(p, 0.06 + br * 0.01, R); base(p, ctx, 0.12, 0.2, 0.12, 0.4);
} });
def('summon', { dur: 1.2, hits: [0.6], attack: true, drag: 0.3, blendIn: 0.08, blendOut: 0.85, fn(p, u, ctx) { // arms sweep up and out, then pull down
  const R = ctx.rig, up = K(u, 0, 0, 0.45, 1, 0.6, 0.3, 1, 0), dn = K(u, 0.45, 0, 0.6, 1, 0.9, 1, 1, 0);
  for (const s of ['L', 'R']) setArm(p, s, 0.4 + 1.4 * up, 0.5 + 1.2 * up + 0.4 * dn, -0.4, 0.5, -0.3, 0, 0.15);
  bend(p, 0.2 * up - 0.2 * dn); crouch(p, 0.14 * dn, R); p.add(B.head, -0.3 * up + 0.2 * dn, 0, 0);
  p.wR[0] *= 1 - Math.max(up, dn); p.w2h *= 1 - Math.max(up, dn);
} });
def('buff', { dur: 1.0, attack: false, draw: true, drag: 0.2, blendIn: 0.08, blendOut: 0.8, fn(p, u, ctx) { // power up: fists clenched, chest out, roar
  const R = ctx.rig, k = K(u, 0, 0, 0.3, 1, 0.8, 1, 1, 0);
  for (const s of ['L', 'R']) { setArm(p, s, 0.2 * k, 0.35 + 0.3 * k, 0.3, 1.5 * k, 0, 0, 1.4); setClav(p, s, 0.15 * k); }
  bend(p, 0.15 * k); p.add(B.head, -0.25 * k, 0, 0); crouch(p, 0.12 * k, R); base(p, ctx, 0.16 * k, 0.08, 0.08, 0.35);
  p.face = k > 0.5 ? 2 : 0;
} });

// ---- star staff (Starcaller) --------------------------------------------------------------------------
const ST = [48, -30, 0.4, 0, 90, -45, 118]; // hold (see holdPose 'staff')
const st = (t, a) => [t, ...a];
function staffMove(keys, body, px = 0.04) {
  const Kk = keys.map(k => { const a = k.slice(); if (k.e) a.e = true; return a; });
  const tr = new Float32Array(8);
  return (p, u, ctx, A) => { const R = ctx.rig; track(u, Kk, tr); wieldT(p, 'R', 1, tr, R, px); body(p, u, R, ctx); };
}
v('cast', 'staff', { dur: 0.7, hits: [0.46], fn: staffMove([
  st(0, ST), E([0.32, 60, 10, 0.34, 0.04, 90, -60, 60]), [0.46, 10, 0, 0.58, 0.04, 90, -10, 70], E([0.7, 8, 0, 0.58, 0.04, 90, -8, 70]), st(1, ST),
], (p, u, R, ctx) => {
  const r = K(u, 0.34, 0, 0.46, 1, 0.75, 1, 1, 0);
  palm(p, 'L', R, -0.12, 0.08, lerp(0.2, 0.55, r), Math.max(r, K(u, 0, 0, 0.3, 0.6)));
  twist(p, 0.25 * K(u, 0, 0, 0.32, 1, 0.46, 0), 0.3); crouch(p, 0.08 * r, R); step(p, 0, u, 0, -0.18, 0.3, 0.46, 0.8, 1);
}) });
v('cast_up', 'staff', { dur: 0.9, hits: [0.52], fn: staffMove([
  st(0, ST), E([0.4, 10, 70, 0.46, 0.18, 90, -10, 20]), [0.52, 6, 78, 0.5, 0.22, 90, -6, 12], E([0.82, 6, 78, 0.5, 0.22, 90, -6, 12]), st(1, ST),
], (p, u, R) => {
  const k = K(u, 0, 0, 0.4, 1, 0.82, 1, 1, 0);
  setArm(p, 'L', 0.3 + 0.8 * k, 0.4 + 1.6 * k, -0.4, 0.4, -0.3, 0, 0.15); open(p, 'L');
  bend(p, 0.18 * k); p.add(B.head, -0.35 * k, 0, 0); p.hip[1] += 0.03 * k; p.face = k > 0.8 ? 2 : 0;
}) });
v('cast_ground', 'staff', { dur: 0.9, hits: [0.5], fn: staffMove([
  st(0, ST), E([0.34, 20, 40, 0.38, 0.1, 90, -20, 50]), [0.5, 10, -30, 0.42, -0.1, 90, -10, -58], E([0.8, 10, -30, 0.42, -0.1, 90, -10, -58]), st(1, ST),
], (p, u, R, ctx) => { // staff butt slammed down, rune circle
  const dn = K(u, 0.34, 0, 0.5, 1, 0.8, 1, 1, 0);
  palm(p, 'L', R, -0.2, lerp(0.05, -0.3, dn), 0.4, 0.8, [0, 0, -1]);
  crouch(p, 0.2 * dn, R); bend(p, -0.25 * dn); base(p, ctx, 0.18, 0.2, 0.16, 0.45);
}) });
v('channel', 'staff', { dur: 1.6, loop: true, fn(p, u, ctx) { // staff held forward, the orb blazing; a slight levitation
  const R = ctx.rig, br = sin(u * PI * 2), tr = sin(u * PI * 26) * 0.4;
  wieldT(p, 'R', 1, [20, 4 + tr, 0.56, 0.04, 90, -20, 60], R, 0.04);
  palm(p, 'L', R, -0.14, 0.12, 0.5);
  p.hip[1] += 0.06 + 0.02 * br; p.feet[1] += 0.06 + 0.02 * br; p.feet[6] += 0.08 + 0.02 * br; p.feet[3] = -0.35; p.feet[8] = -0.4;
  bend(p, -0.04); p.face = 0;
} });
v('summon', 'staff', { dur: 1.2, hits: [0.6], fn: staffMove([
  st(0, ST), E([0.45, 0, 80, 0.5, 0.2, 90, 0, 12]), [0.6, 0, 20, 0.56, 0.05, 90, 0, 40], E([0.9, 0, 10, 0.56, 0.02, 90, 0, 50]), st(1, ST),
], (p, u, R) => {
  const up = K(u, 0, 0, 0.45, 1, 0.6, 0.3, 1, 0);
  setArm(p, 'L', 0.4 + 1.4 * up, 0.6 + 1.2 * up, -0.4, 0.5, -0.3, 0, 0.15); open(p, 'L');
  bend(p, 0.2 * up); p.add(B.head, -0.3 * up, 0, 0);
}) });
v('atk1', 'staff', { dur: 0.46, hits: [0.36], drag: 0.2, fn: staffMove([st(0, ST), E([0.24, 70, 20, 0.34, 0.04, 90, -40, 50]), [0.36, 20, 5, 0.56, 0.02, 90, -20, 60], st(1, ST)], (p, u, R) => {
  twist(p, KC(u, 0, 0, 0.24, 0.3, 0.36, -0.15, 1, 0), 0.3); crouch(p, 0.05, R);
}) });
v('atk2', 'staff', { dur: 0.46, hits: [0.36], drag: 0.2, fn(p, u, ctx) { // off-hand palm blast
  const R = ctx.rig, r = K(u, 0.22, 0, 0.36, 1, 0.6, 1, 1, 0);
  palm(p, 'L', R, lerp(-0.2, -0.08, r), 0.08, lerp(0.15, 0.6, r), Math.max(r, K(u, 0, 0, 0.2, 1)));
  twist(p, -0.3 * r, 0.3); step(p, 0, u, 0, -0.12, 0.22, 0.36, 0.8, 1);
} });
v('atk3', 'staff', { dur: 0.7, hits: [0.46], drag: 0.4, fn: staffMove([st(0, ST), E([0.3, 110, 20, 0.36, 0.04, 0, 20, 40]), [0.46, 0, -4, 0.56, 0, 0, -10, 10], E([0.62, -80, -10, 0.46, -0.02, 0, -20, 10]), st(1, ST)], (p, u, R) => {
  twist(p, KC(u, 0, 0, 0.3, 0.7, 0.46, 0, 0.62, -0.6, 1, 0), 0.35); crouch(p, KC(u, 0, 0, 0.46, 0.12, 1, 0), R); step(p, 0, u, -0.06, -0.16, 0.28, 0.46, 0.8, 1);
}) });
v('buff', 'staff', { dur: 1.1, fn: staffMove([st(0, ST), E([0.35, 0, 30, 0.34, 0.1, 90, 0, 60]), E([0.8, 0, 30, 0.34, 0.1, 90, 0, 60]), st(1, ST)], (p, u, R) => {
  const k = K(u, 0, 0, 0.35, 1, 0.8, 1, 1, 0); setArm(p, 'L', 0.7 * k, 0.1, 0.4, 1.9 * k, 0, 0, 0.3); bend(p, 0.1 * k); p.add(B.head, -0.2 * k, 0, 0);
}) });
v('block', 'staff', { dur: 1, loop: true, fn(p, u, ctx) { const R = ctx.rig; wieldT(p, 'R', 1, [30, 8, 0.36, 0.04, 90, -120, 80], R, 0.04); palm(p, 'L', R, -0.28, 0.14, 0.34); crouch(p, 0.1, R); base(p, ctx, 0.14, 0.18, 0.14, 0.4); } });
v('spin', 'staff', { dur: 0.7, hits: [0.45], spinDrag: 1, drag: 0.5, fn(p, u, ctx) {
  const R = ctx.rig, sp = sstep(0.12, 0.82, u), out = K(u, 0, 0, 0.2, 1, 0.8, 1, 1, 0);
  p.yaw = -sp * PI * 2; wieldT(p, 'R', 1, [lerp(48, 90, out), lerp(-30, -5, out), lerp(0.4, 0.5, out), 0, lerp(90, 0, out), lerp(-45, 60, out), lerp(118, 0, out)], R, 0.04);
  setArm(p, 'L', 0.2, 0.8 * out, 0, 0.6, 0, 0, 0.3); crouch(p, 0.1 * out, R); stance(p, ctx, 0.12 * out + 0.04, 0.05, -0.05, 0.3);
} });

// ---- harp (Songweaver) --------------------------------------------------------------------------------
// The harp's grip is the base of its arc; its plane is the weapon YZ plane (strings along Y, pillar at +Z).
// harpAt: harp base at a chest-relative point, harp +Y up (tilted), +Z pointing forward, tilt = lean toward the body.
export function harpAt(p, R, s, u, f, tilt = 0.25, raise = 0) {
  const t = tilt, c = Math.cos(t), sn = Math.sin(t);
  // basis: X = left (-1,0,0) rotated by the tilt about Z; Y = up tilted toward +X (toward the body center); Z = forward
  fistAt(p.wL, 1, P3(p, R, s, u + raise, f), [-c, -sn, 0], [sn * 0.9, c, 0.15]);
  setFingers(p, 'L', 1.1, 1.0, 0.9);
}
/** right hand plucking at a point on the string plane: y (0 bottom … 1 top of the strings) and depth across the strings */
export function pluck(p, R, y, z, w = 1, rs = -0.08, raise = 0) {
  fistAt(p.wR, w, P3(p, R, rs + 0.02, -0.12 + y * 0.42 + raise, 0.26 + z * 0.24), [-0.9, -0.2, -0.3], [0, 1, 0.2]);
  setFingers(p, 'R', 0.3, 0.15, 0.3);
}
v('strum', 'harp', { dur: 0.6, hits: [0.4], drag: 0.2, fn(p, u, ctx) {
  const R = ctx.rig;
  harpAt(p, R, -0.14, -0.22, 0.3);
  const y = KC(u, 0, 0.5, 0.26, 1.0, 0.4, 0.05, 0.55, 0.0, 1, 0.5);
  pluck(p, R, y, KC(u, 0, 0.5, 0.26, 0.8, 0.4, 0.2, 1, 0.5));
  bend(p, KC(u, 0, 0, 0.26, 0.08, 0.42, -0.1, 1, 0)); twist(p, KC(u, 0, 0.1, 0.4, 0.25, 1, 0.1), 0.3);
  p.face = u > 0.36 && u < 0.6 ? 2 : 0;
} });
v('strum_big', 'harp', { dur: 1.1, hits: [0.52], drag: 0.5, fn(p, u, ctx) { // harp raised high, a sweeping chord, body arched
  const R = ctx.rig, lift = K(u, 0, 0, 0.36, 1, 0.8, 1, 1, 0);
  harpAt(p, R, lerp(-0.14, -0.08, lift), -0.22, lerp(0.3, 0.36, lift), lerp(0.25, 0.4, lift), 0.32 * lift);
  const y = KC(u, 0, 0.5, 0.4, 1.05, 0.52, -0.05, 0.7, 0.0, 1, 0.5);
  pluck(p, R, y, KC(u, 0, 0.5, 0.4, 1, 0.52, 0, 1, 0.5), 1, -0.06, 0.32 * lift);
  bend(p, 0.2 * lift - 0.15 * K(u, 0.45, 0, 0.55, 1, 0.8, 0)); p.add(B.head, -0.3 * lift, 0, 0); crouch(p, 0.12 * K(u, 0.45, 0, 0.55, 1, 0.9, 0), R);
  step(p, 0, u, 0, -0.14, 0.4, 0.52, 0.85, 1); p.face = lift > 0.5 ? 2 : 0;
} });
v('harp_loop', 'harp', { dur: 1.4, loop: true, drag: 0.1, fn(p, u, ctx) { // performing: fingers rippling over the strings, body swaying
  const R = ctx.rig, a = u * PI * 2;
  harpAt(p, R, -0.14, -0.22, 0.3, 0.25 + 0.04 * sin(a));
  pluck(p, R, 0.5 + 0.3 * sin(a * 2), 0.5 + 0.35 * sin(a * 3 + 1));
  setFingers(p, 'R', 0.3 + 0.25 * Math.abs(sin(a * 6)), 0.15 + 0.3 * Math.abs(sin(a * 6 + 1)), 0.3);
  p.hip[0] += 0.03 * sin(a); p.add(B.hips, 0, 0, 0.05 * sin(a)); p.add(B.chest, 0, 0.06 * sin(a), -0.05 * sin(a)); p.add(B.head, 0.1, 0.1 * sin(a), 0.12 * sin(a + 0.5));
} });
v('play_instrument', 'harp', M.harp_loop.v.harp);
for (const [n, d] of [['atk1', 0.44], ['atk2', 0.44], ['cast', 0.6], ['shoot', 0.5]]) v(n, 'harp', { ...M.strum.v.harp, dur: d, hits: [0.4] });
v('atk3', 'harp', M.strum_big.v.harp);
v('cast_up', 'harp', M.strum_big.v.harp);
v('channel', 'harp', M.harp_loop.v.harp);
v('buff', 'harp', { dur: 1.1, fn(p, u, ctx) { const R = ctx.rig, k = K(u, 0, 0, 0.35, 1, 0.8, 1, 1, 0); harpAt(p, R, -0.1, -0.22, 0.32, 0.3, 0.45 * k); pluck(p, R, 0.6, 0.5, 1, -0.06, 0.45 * k); bend(p, 0.15 * k); p.add(B.head, -0.3 * k, 0, 0); p.face = k > 0.5 ? 2 : 0; } });
