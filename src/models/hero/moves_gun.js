// Gun move library (Pistoleer): twin pistols, shotgun, rifle. Guns are placed with aimGun (grip position, barrel = weapon +X,
// weapon +Y up); recoil = a sharp muzzle climb + hand kick back at the hit, then an eased recovery.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { sin, cos, PI, clamp, lerp, sstep, K, KC, E, step, crouch, twist, bend, base, fist, aimGun, M, def, v, vs } from './movelib.js';

const P3 = (p, R, s, u, f) => [s + p.hip[0], R.chestY + u + p.hip[1], -f + p.hip[2]];
/** recoil envelope: 0 → 1 at the shot (fast), back to 0 over `rec` */
const kick = (u, t, rec = 0.18) => (u < t ? 0 : Math.exp(-(u - t) / rec * 3) * (1 - Math.exp(-(u - t) / 0.012)));
/** one pistol: raise (up) to aim, fire at t */
function pistol(p, side, R, up, recoil, yawDeg = 0, pitchDeg = 0) {
  const s = side === 'R' ? 1 : -1;
  const ext = lerp(0.3, 0.6, up) - 0.06 * recoil;
  const y = lerp(-0.12, 0.13, up) + 0.03 * recoil;
  const a = (yawDeg * PI) / 180, pt = (pitchDeg * PI) / 180 + lerp(-0.9, 0, up) + 0.45 * recoil;
  aimGun(side === 'R' ? p.wR : p.wL, 1, P3(p, R, s * lerp(0.2, 0.17, up) + Math.sin(a) * ext * 0.3, y, ext), [Math.sin(a) * Math.cos(pt), Math.sin(pt), -Math.cos(a) * Math.cos(pt)], [-s * 0.25 * up, 1, 0]);
  setFingers(p, side, 1.2, 0.6, 0.9);
}
const idleP = (p, side, R) => pistol(p, side, R, 0, 0);

// ---- pistols ---------------------------------------------------------------------------------------
v('atk1', 'pistol', { dur: 0.36, hits: [0.3], drag: 0.1, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.22, 1, 0.7, 1, 1, 0);
  pistol(p, 'R', R, up, kick(u, 0.3)); idleP(p, 'L', R);
  twist(p, 0.25 * up, 0.3); crouch(p, 0.04, R); base(p, ctx, 0.1, 0.16, 0.12, 0.35);
} });
v('atk2', 'pistol', { dur: 0.36, hits: [0.3], drag: 0.1, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.22, 1, 0.7, 1, 1, 0);
  pistol(p, 'L', R, up, kick(u, 0.3)); idleP(p, 'R', R);
  twist(p, -0.25 * up, 0.3); crouch(p, 0.04, R); base(p, ctx, 0.1, 0.16, 0.12, 0.35);
} });
v('atk3', 'pistol', { dur: 0.6, hits: [0.3, 0.42], drag: 0.2, fn(p, u, ctx) { // both guns, a flourish spin of the wrists after
  const R = ctx.rig, up = K(u, 0, 0, 0.2, 1, 0.66, 1, 1, 0);
  pistol(p, 'R', R, up, kick(u, 0.3), -6); pistol(p, 'L', R, up, kick(u, 0.42), 6);
  crouch(p, 0.06, R); bend(p, -0.05 * up); base(p, ctx, 0.14, 0.18, 0.14, 0.4);
} });
def('shoot', { dur: 0.42, hits: [0.3], attack: true, drag: 0.1, blendIn: 0.05, blendOut: 0.8, fn(p, u, ctx) { // generic: snap the right arm forward
  const R = ctx.rig, up = K(u, 0, 0, 0.24, 1, 0.7, 1, 1, 0);
  setArm(p, 'R', 1.45 * up + 0.2, 0.2, -0.1, 0.25, 0, 0, 0.8); twist(p, 0.3 * up, 0.3);
} });
v('shoot', 'pistol', { dur: 0.4, hits: [0.28], drag: 0.1, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.2, 1, 0.7, 1, 1, 0);
  pistol(p, 'R', R, up, kick(u, 0.28)); idleP(p, 'L', R); twist(p, 0.3 * up, 0.3); base(p, ctx, 0.1, 0.16, 0.12, 0.35);
} });
def('shoot_dual', { dur: 0.5, hits: [0.3, 0.38], attack: true, drag: 0.15, blendIn: 0.05, blendOut: 0.8, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.22, 1, 0.7, 1, 1, 0);
  setArm(p, 'R', 1.45 * up + 0.2, 0.15, -0.1, 0.25, 0, 0, 0.8); setArm(p, 'L', 1.45 * up + 0.2, 0.15, -0.1, 0.25, 0, 0, 0.8);
} });
v('shoot_dual', 'pistol', { dur: 0.5, hits: [0.3, 0.38], drag: 0.15, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.22, 1, 0.72, 1, 1, 0);
  pistol(p, 'R', R, up, kick(u, 0.3), -8); pistol(p, 'L', R, up, kick(u, 0.38), 8);
  crouch(p, 0.06, R); bend(p, -0.05); base(p, ctx, 0.14, 0.18, 0.14, 0.4);
} });
def('shoot_loop', { dur: 0.26, loop: true, hits: [0.1, 0.6], attack: true, drag: 0.2, blendIn: 0.15, fn(p, u, ctx) { // rapid alternating fire
  const R = ctx.rig;
  setArm(p, 'R', 1.5, 0.15, -0.1, 0.25 + 0.2 * kick(u, 0.1, 0.3), 0, 0, 0.8); setArm(p, 'L', 1.5, 0.15, -0.1, 0.25 + 0.2 * kick(u, 0.6, 0.3), 0, 0, 0.8);
} });
v('shoot_loop', 'pistol', { dur: 0.26, loop: true, hits: [0.1, 0.6], drag: 0.2, fn(p, u, ctx) {
  const R = ctx.rig;
  pistol(p, 'R', R, 1, Math.max(kick(u, 0.1, 0.3), kick(u + 1, 1.1, 0.3)), -10); pistol(p, 'L', R, 1, Math.max(kick(u, 0.6, 0.3), kick(u + 1, 0.6, 0.3)), 10);
  crouch(p, 0.08, R); base(p, ctx, 0.16, 0.18, 0.16, 0.4);
  p.add(B.chest, -0.02 * sin(u * PI * 4), 0.04 * sin(u * PI * 2), 0);
} });

// ---- shotgun -----------------------------------------------------------------------------------------
function shotgunAim(p, R, up, rec, yaw = 0) {
  const pt = lerp(-0.5, -0.05, up) + 0.55 * rec;
  aimGun(p.wR, 1, P3(p, R, lerp(0.16, 0.12, up), lerp(-0.26, -0.12, up) + 0.04 * rec, lerp(0.22, 0.32, up) - 0.12 * rec), [Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt)], [0, 1, 0]);
  p.w2h = 1;
}
def('shotgun', { dur: 0.7, hits: [0.3], attack: true, drag: 0.3, blendIn: 0.05, blendOut: 0.8, fn(p, u, ctx) { // generic big blast (arms)
  const R = ctx.rig, up = K(u, 0, 0, 0.2, 1, 0.75, 1, 1, 0), r = kick(u, 0.3, 0.3);
  setArm(p, 'R', 1.2 * up + 0.3 - 0.4 * r, 0.2, -0.2, 0.9, 0, 0, 1); setArm(p, 'L', 1.3 * up + 0.3 - 0.4 * r, 0.15, 0.3, 0.8, 0, 0, 1);
  bend(p, 0.2 * r); p.hip[2] += 0.08 * r;
} });
v('shotgun', 'shotgun', { dur: 0.72, hits: [0.3], drag: 0.3, fn(p, u, ctx) {
  const R = ctx.rig, up = K(u, 0, 0, 0.2, 1, 0.75, 1, 1, 0), r = kick(u, 0.3, 0.35);
  shotgunAim(p, R, up, r);
  twist(p, 0.2 * up, 0.3); bend(p, -0.08 * up + 0.22 * r); p.hip[2] += 0.1 * r; crouch(p, 0.08 + 0.04 * r, R);
  base(p, ctx, 0.14, 0.2, 0.16, 0.45); p.feet[2] += 0.06 * r; p.face = r > 0.3 ? 2 : 0;
} });
v('atk1', 'shotgun', M.shotgun.v.shotgun);
v('atk2', 'shotgun', { dur: 0.66, hits: [0.36], drag: 0.3, fn(p, u, ctx) { // pump, then blast
  const R = ctx.rig, up = K(u, 0, 0, 0.2, 1, 0.75, 1, 1, 0), r = kick(u, 0.36, 0.35);
  const pump = sin(clamp((u - 0.08) / 0.2, 0, 1) * PI);
  shotgunAim(p, R, up, r, 0.1);
  p.w2h = 1 - pump * 0.9; setArm(p, 'L', 0.9, 0.25, 0.2, 1.3 - 0.4 * pump, 0, 0, 1.2);
  twist(p, 0.25 * up, 0.3); bend(p, 0.2 * r); p.hip[2] += 0.1 * r; crouch(p, 0.08, R); base(p, ctx, 0.14, 0.2, 0.16, 0.45);
} });
v('atk3', 'shotgun', { dur: 0.9, hits: [0.3, 0.55], drag: 0.4, fn(p, u, ctx) { // two blasts, second with a lunge
  const R = ctx.rig, up = K(u, 0, 0, 0.18, 1, 0.8, 1, 1, 0), r = Math.max(kick(u, 0.3, 0.3), kick(u, 0.55, 0.35) * 1.3);
  shotgunAim(p, R, up, r, -0.1);
  twist(p, 0.2 * up, 0.3); bend(p, 0.22 * r - 0.1 * K(u, 0.4, 0, 0.55, 1, 0.8, 0)); p.hip[2] += 0.1 * r; crouch(p, 0.1, R);
  base(p, ctx, 0.16, 0.2, 0.16, 0.45); step(p, 0, u, 0, -0.2, 0.4, 0.55, 0.85, 1);
} });
v('shoot', 'shotgun', M.shotgun.v.shotgun);
v('shoot_loop', 'shotgun', { dur: 0.4, loop: true, hits: [0.3], drag: 0.3, fn(p, u, ctx) {
  const R = ctx.rig, r = Math.max(kick(u, 0.3, 0.35), kick(u + 1, 1.3, 0.35));
  shotgunAim(p, R, 1, r, 0.2 * sin(u * PI * 2)); bend(p, 0.2 * r); crouch(p, 0.1, R); base(p, ctx, 0.16, 0.2, 0.16, 0.45);
} });

// ---- rifle -------------------------------------------------------------------------------------------
function rifleShoulder(p, R, k, rec = 0, sway = 0) {
  // k: 0 port arms (hold) → 1 shouldered; stock butt at the right shoulder, cheek on the stock
  const pt = lerp(-0.35, 0.0, k) + 0.4 * rec + sway * 0.01;
  aimGun(p.wR, 1, P3(p, R, lerp(0.15, 0.09, k), lerp(-0.2, 0.12, k) + 0.02 * rec, lerp(0.25, 0.26, k) - 0.08 * rec), [0.02 * sway, Math.sin(pt), -Math.cos(pt)], [lerp(0.3, 0, k), 1, 0]);
  p.w2h = 1;
  p.add(B.head, 0.18 * k, -0.1 * k, -0.2 * k); p.add(B.neck, 0.05 * k, 0, -0.05 * k); // cheek weld
}
def('rifle_aim', { dur: 2.0, loop: true, attack: true, drag: 0.05, blendIn: 0.1, fn(p, u, ctx) { // generic: steady aim with the right arm
  const R = ctx.rig; setArm(p, 'R', 1.45, 0.1, -0.1, 0.3, 0, 0, 0.8); setArm(p, 'L', 1.3, 0.3, 0.5, 1.0, 0, 0, 0.8);
  base(p, ctx, 0.12, 0.2, 0.14, 0.4);
} });
v('rifle_aim', 'rifle', { dur: 2.0, loop: true, drag: 0.05, fn(p, u, ctx) {
  const R = ctx.rig, br = sin(u * PI * 2);
  rifleShoulder(p, R, 1, 0, br);
  twist(p, 0.15, 0.3); bend(p, -0.06); crouch(p, 0.06, R); base(p, ctx, 0.14, 0.22, 0.14, 0.5);
} });
def('rifle_fire', { dur: 0.6, hits: [0.1], attack: true, drag: 0.3, blendIn: 0.02, blendOut: 0.75, fn(p, u, ctx) {
  const R = ctx.rig, r = kick(u, 0.1, 0.4);
  setArm(p, 'R', 1.45 - 0.5 * r, 0.1, -0.1, 0.3 + 0.3 * r, 0, 0, 0.8); setArm(p, 'L', 1.3 - 0.4 * r, 0.3, 0.5, 1.0, 0, 0, 0.8); bend(p, 0.2 * r); p.hip[2] += 0.1 * r;
} });
v('rifle_fire', 'rifle', { dur: 0.62, hits: [0.1], drag: 0.3, fn(p, u, ctx) {
  const R = ctx.rig, r = kick(u, 0.1, 0.45);
  rifleShoulder(p, R, K(u, 0, 1, 0.7, 1, 1, 0.6), r);
  twist(p, 0.15, 0.3); bend(p, -0.06 + 0.25 * r); p.hip[2] += 0.12 * r; crouch(p, 0.06, R); base(p, ctx, 0.14, 0.22, 0.14, 0.5);
  p.feet[2] += 0.04 * r;
} });
v('atk1', 'rifle', { dur: 0.5, hits: [0.3], drag: 0.2, fn(p, u, ctx) { // snap to the shoulder, fire
  const R = ctx.rig, k = K(u, 0, 0, 0.24, 1, 0.75, 1, 1, 0), r = kick(u, 0.3, 0.4);
  rifleShoulder(p, R, k, r); twist(p, 0.15 * k, 0.3); bend(p, 0.2 * r); p.hip[2] += 0.08 * r; base(p, ctx, 0.12, 0.2, 0.12, 0.45);
} });
v('atk2', 'rifle', M.atk1.v.rifle);
v('atk3', 'rifle', { dur: 0.8, hits: [0.3, 0.56], drag: 0.3, fn(p, u, ctx) {
  const R = ctx.rig, k = K(u, 0, 0, 0.22, 1, 0.8, 1, 1, 0), r = Math.max(kick(u, 0.3, 0.4), kick(u, 0.56, 0.4));
  rifleShoulder(p, R, k, r); twist(p, 0.15 * k, 0.3); bend(p, 0.2 * r); p.hip[2] += 0.08 * r; base(p, ctx, 0.12, 0.2, 0.12, 0.45);
} });
v('shoot', 'rifle', M.atk1.v.rifle);
v('charge_hold', 'rifle', M.rifle_aim.v.rifle);
v('charge_release', 'rifle', M.rifle_fire.v.rifle);
v('charge_hold', 'shotgun', { dur: 1, loop: true, fn(p, u, ctx) { const R = ctx.rig; shotgunAim(p, R, 1, 0); crouch(p, 0.12, R); base(p, ctx, 0.16, 0.2, 0.16, 0.45); } });
v('charge_release', 'shotgun', M.shotgun.v.shotgun);
v('charge_hold', 'pistol', { dur: 1, loop: true, fn(p, u, ctx) { const R = ctx.rig; pistol(p, 'R', R, 1, 0, -5); pistol(p, 'L', R, 1, 0, 5); crouch(p, 0.08, R); base(p, ctx, 0.14, 0.18, 0.14, 0.4); } });
v('charge_release', 'pistol', M.shoot_dual.v.pistol);
