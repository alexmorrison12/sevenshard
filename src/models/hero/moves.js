// Authored procedural moves: weapon holds, run carries, one-shot / looped actions and emotes.
// Every fn(p, u, ctx, A, a) writes into a pose that starts as a copy of the current (locomotion) pose; u = 0..1.
// Weapon-aware: resolveMove(name, kind) merges a move's per-family variant (kind = weapon family, see WEAPON_KIND).
// Big weapon swings are authored as blade trajectories (polar keys around a pivot) solved by arm IK in the animator.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { deathPose, downPose } from './poses.js';
import { sin, cos, PI, DEG, clamp, lerp, sstep, K, KC, track, E, wield, wieldT, step, crouch, twist, bend, base, fist, fistAt, aimGun, dirDeg, at, M, def, v, vs, resolveMove, MOVE_NAMES } from './movelib.js';
import './moves_melee.js';
import './moves_fist.js';
import './moves_gun.js';
import { harpAt, pluck } from './moves_magic.js';
import './moves_life.js';
export { resolveMove, MOVE_NAMES, K, KC, track };

// ================================================================================================
// Weapon families. The hero sets A.kind from its class / stance (see index.js).
export const FAMILIES = ['greatsword', 'sword', 'fists', 'pistol', 'shotgun', 'rifle', 'staff', 'harp', 'blades', 'glaive', 'claws', 'none'];
const TWO_HANDED = { greatsword: 1, glaive: 1, shotgun: 1, rifle: 1 };

// weapon-ready holds (combat idle; bob = slow breathing oscillation)
export function holdPose(p, kind, t, ctx, A, bob = 0) {
  const R = ctx.rig, b = bob * 0.012;
  const hipsDrop = R.legLen / 0.87;
  switch (kind) {
    case 'greatsword': { // low forward guard: blade angled up across the body, wide base
      p.hip[1] = -0.09 * hipsDrop + b; p.hip[2] = 0.03;
      p.set(B.hips, 0.06, -0.3, 0); p.set(B.spine, -0.04, 0.16, 0); p.set(B.chest, -0.02 + bob * 0.01, 0.14, 0);
      p.set(B.neck, 0.0, 0.0, 0); p.set(B.head, 0.04, 0.02, 0);
      base(p, ctx, 0.16, 0.2, 0.18, 0.45);
      wieldT(p, 'R', 1, [38, -48 + bob * 1.5, 0.42, 0, 10, -78, 88], R, 0.02);
      p.w2h = 1; setArm(p, 'L', 0.7, 0.1, -0.2, 1.3, 0, 0, 1.3);
      break;
    }
    case 'glaive': {
      p.hip[1] = -0.08 * hipsDrop + b; p.set(B.hips, 0.06, -0.35, 0); p.set(B.spine, -0.05, 0.18, 0); p.set(B.chest, -0.03, 0.15, 0);
      base(p, ctx, 0.14, 0.2, 0.16, 0.45);
      wieldT(p, 'R', 1, [30, -40 + bob, 0.36, 0, 90, -70, 75], R, 0.02);
      p.w2h = 1;
      break;
    }
    case 'sword': { // longsword forward, tome hand ready
      p.hip[1] = -0.06 * hipsDrop + b; p.set(B.hips, 0.04, -0.22, 0); p.set(B.spine, -0.04, 0.1, 0); p.set(B.chest, -0.02, 0.1, 0);
      base(p, ctx, 0.1, 0.16, 0.14, 0.35);
      wieldT(p, 'R', 1, [28, -38 + bob, 0.44, 0, 90, -40, 70], R, 0.14);
      setArm(p, 'L', 0.45, 0.28, -0.1, 1.2, 0.1, 0, 1.25);
      break;
    }
    case 'fists': { // guard up, lead hand forward
      p.hip[1] = -0.08 * hipsDrop + b * 1.5; p.set(B.hips, 0.05, -0.35, 0); p.set(B.spine, -0.06, 0.15, 0); p.set(B.chest, -0.05, 0.12, 0);
      p.set(B.head, 0.12, 0.05, 0);
      base(p, ctx, 0.12, 0.2, 0.14, 0.5);
      setArm(p, 'L', 1.05 + b * 2, 0.25, 0.35, 1.95, 0.1, 0.2, 1.4); setArm(p, 'R', 0.7 - b * 2, 0.35, 0.45, 2.15, 0.1, 0.2, 1.4);
      setClav(p, 'L', 0.08, 0.05); setClav(p, 'R', 0.1, 0.05);
      break;
    }
    case 'pistol': { // guns low and out, ready to snap up
      p.hip[1] = -0.05 * hipsDrop + b; p.set(B.hips, 0.02, -0.1, 0); p.set(B.chest, -0.02, 0.05, 0);
      base(p, ctx, 0.08, 0.12, 0.1, 0.3);
      setArm(p, 'R', 0.55, 0.32, 0.1, 0.75, -0.2, 0, 1.3); setArm(p, 'L', 0.55, 0.32, 0.1, 0.75, -0.2, 0, 1.3);
      break;
    }
    case 'shotgun': { // at the hip, both hands
      p.hip[1] = -0.06 * hipsDrop + b; p.set(B.hips, 0.03, -0.3, 0); p.set(B.chest, -0.03, 0.18, 0);
      base(p, ctx, 0.1, 0.15, 0.14, 0.4);
      wieldT(p, 'R', 1, [40, -62 + bob, 0.36, 0, 90, -52, 72], R, 0.04);
      p.w2h = 1;
      break;
    }
    case 'rifle': { // port arms across the chest
      p.hip[1] = -0.04 * hipsDrop + b; p.set(B.hips, 0.02, -0.18, 0); p.set(B.chest, -0.02, 0.12, 0);
      base(p, ctx, 0.06, 0.12, 0.1, 0.3);
      wieldT(p, 'R', 1, [32, -52 + bob, 0.33, 0, 90, -92, 100], R, 0.04);
      p.w2h = 1;
      break;
    }
    case 'staff': { // staff planted beside, free hand gathering light
      p.hip[1] = -0.03 * hipsDrop + b; p.set(B.hips, 0.02, -0.12, 0); p.set(B.chest, -0.02, 0.08, 0);
      base(p, ctx, 0.05, 0.12, 0.08, 0.25);
      wieldT(p, 'R', 1, [48, -30 + bob, 0.4, 0, 90, -45, 118], R, 0.04);
      setArm(p, 'L', 0.55, 0.45, -0.35, 1.25, -0.4, 0, 0.2);
      break;
    }
    case 'harp': { // harp held up in the left hand, right hand resting by the strings
      p.hip[1] = -0.02 * hipsDrop + b; p.set(B.hips, 0.0, -0.08, 0); p.set(B.chest, -0.02, 0.05, 0);
      base(p, ctx, 0.02, 0.1, 0.06, 0.2);
      harpAt(p, R, -0.14, -0.22 + bob * 0.004, 0.3);
      pluck(p, R, 0.35, 0.5, 0.85);
      break;
    }
    case 'blades': { // low predatory crouch, blades back
      p.hip[1] = -0.12 * hipsDrop + b; p.set(B.hips, 0.12, -0.25, 0); p.set(B.spine, -0.1, 0.12, 0); p.set(B.chest, -0.08, 0.1, 0);
      p.set(B.head, 0.14, 0.05, 0);
      base(p, ctx, 0.16, 0.2, 0.18, 0.5);
      wieldT(p, 'R', 1, [58, -40 + bob, 0.4, 0, 180, 20, -40], R, 0.12);
      wieldT(p, 'L', 1, [-15, -30 - bob, 0.44, 0, 0, -30, -35], R, -0.12);
      break;
    }
    case 'claws': {
      p.hip[1] = -0.14 * hipsDrop + b; p.set(B.hips, 0.2, -0.1, 0); p.set(B.spine, -0.12, 0.05, 0); p.set(B.chest, -0.12, 0.05, 0);
      p.set(B.head, 0.2, 0, 0);
      base(p, ctx, 0.18, 0.18, 0.18, 0.45);
      setArm(p, 'L', 0.6, 0.6, 0.2, 1.3, -0.3, 0, 0.9); setArm(p, 'R', 0.6, 0.6, 0.2, 1.3, -0.3, 0, 0.9);
      setClav(p, 'L', 0.15); setClav(p, 'R', 0.15);
      break;
    }
    default: // bare fists / civilians
      p.hip[1] = -0.05 * hipsDrop + b; p.set(B.hips, 0.04, -0.25, 0); p.set(B.chest, -0.03, 0.1, 0);
      base(p, ctx, 0.08, 0.14, 0.12, 0.35);
      setArm(p, 'L', 0.95, 0.3, 0.3, 1.9, 0.1, 0.2, 1.35); setArm(p, 'R', 0.7, 0.35, 0.3, 2.0, 0.1, 0.2, 1.35);
  }
}

/** arms while running with the weapon drawn (sw = arm swing −1..1, g = gait 0 walk .. 1 run) */
export function runArms(p, kind, sw, g, ctx, A) {
  const R = ctx.rig;
  switch (kind) {
    case 'greatsword': // blade trailing low behind the right side, left arm pumps
      wieldT(p, 'R', 1, [118 + sw * 4, -52 + sw * 3, 0.46, 0, 60, 58, -28], R, 0.06);
      p.w2h = 0;
      break;
    case 'glaive':
      wieldT(p, 'R', 1, [105 + sw * 4, -40, 0.44, 0, 90, 70, -30], R, 0.06); p.w2h = 0;
      break;
    case 'shotgun': case 'rifle':
      wieldT(p, 'R', 1, [30 + sw * 3, -48 + sw * 2, 0.34, 0, 90, -85, 95], R, 0.04); p.w2h = 1;
      break;
    case 'staff':
      wieldT(p, 'R', 1, [60 + sw * 5, -35, 0.42, 0, 90, 40, 70], R, 0.04);
      break;
    case 'harp':
      harpAt(p, R, -0.14, -0.2, 0.28);
      break;
    case 'fists':
      setArm(p, 'L', 0.9 - sw * 0.5, 0.25, 0.3, 1.9, 0.1, 0.2, 1.4); setArm(p, 'R', 0.9 + sw * 0.5, 0.25, 0.3, 1.9, 0.1, 0.2, 1.4);
      break;
    case 'blades':
      setArm(p, 'L', 0.05 - sw * 0.6, 0.35, 0.2, 0.7, 0.2, 0, 1.3); setArm(p, 'R', 0.05 + sw * 0.6, 0.35, 0.2, 0.7, 0.2, 0, 1.3);
      break;
    case 'pistol':
      setArm(p, 'L', 0.3 - sw * 0.5, 0.2, 0.1, 1.2, 0, 0, 1.3); setArm(p, 'R', 0.3 + sw * 0.5, 0.2, 0.1, 1.2, 0, 0, 1.3);
      break;
    case 'sword':
      wieldT(p, 'R', 1, [70 + sw * 25, -55 + sw * 10, 0.4, 0, 90, 40, 20], R, 0.12);
      break;
  }
}

// ================================================================================================
// Moves. Fields: dur (s), hits (fractions), loop, hold (keeps the last frame until the next play), attack (draws the
// weapon), move (drives the legs even while the game moves the hero), blendIn/blendOut (fractions), drag / spinDrag
// (cape & hair response), face, fn. Per-family variants in `v: { family: {...} }`.
export const EMOTE_SET = new Set();

// ---- utility -----------------------------------------------------------------------------------------
def('dash', { dur: 0.42, move: true, blendIn: 0.05, blendOut: 0.72, drag: 0.9, fn(p, u, ctx, A) { // low forward burst
  const R = ctx.rig;
  const k = K(u, 0, 0, 0.12, 1, 0.7, 1, 1, 0);
  const ph = clamp(u / 0.75, 0, 1);
  crouch(p, 0.14 * k, R); p.hip[2] -= 0.06 * k;
  p.set(B.hips, -0.25 * k, 0, 0); p.set(B.spine, -0.25 * k, 0, 0); p.set(B.chest, -0.1 * k, 0, 0); p.set(B.neck, 0.15 * k, 0, 0); p.set(B.head, 0.25 * k, 0, 0);
  // bounding stride: left foot reaches, right pushes off
  stance(p, ctx, 0.02, 0, 0, 0.1);
  p.feet[2] -= lerp(0.1, 0.55, sin(ph * PI)) * k; p.feet[1] += 0.12 * sin(ph * PI) * k; p.feet[3] = -0.2 * k;
  p.feet[7] += 0.45 * k * sin(ph * PI * 0.5 + 0.3); p.feet[6] += 0.2 * k * sin(clamp(ph * 1.6, 0, 1) * PI); p.feet[8] = -0.9 * k * sin(ph * PI);
  p.toe[1] = 0.6 * k;
  setArm(p, 'L', -0.9 * k, 0.25, 0.3, 0.5, 0.2, 0, 1.2); setArm(p, 'R', -0.9 * k, 0.25, 0.3, 0.5, 0.2, 0, 1.2);
  p.wR[0] *= 1 - k; p.wL[0] *= 1 - k; p.w2h *= 1 - k;
} });
def('dash_back', { dur: 0.45, move: true, blendIn: 0.05, blendOut: 0.72, fn(p, u, ctx) { // hop backwards
  const R = ctx.rig;
  const k = K(u, 0, 0, 0.15, 1, 0.65, 1, 1, 0);
  const air = sin(clamp((u - 0.08) / 0.55, 0, 1) * PI);
  p.hip[1] += 0.12 * air - 0.08 * k * (1 - air); p.hip[2] += 0.1 * k;
  p.set(B.hips, 0.12 * k, 0, 0); p.set(B.spine, 0.1 * k, 0, 0); p.set(B.chest, 0.05 * k, 0, 0); p.set(B.head, -0.1 * k, 0, 0);
  stance(p, ctx, 0.06, 0.12 * k, -0.2 * k, 0.25);
  p.feet[1] += 0.14 * air; p.feet[6] += 0.2 * air; p.feet[3] = 0.25 * air; p.feet[8] = 0.3 * air;
  setArm(p, 'L', 0.6 * k, 0.5 * k, 0.1, 0.9, 0, 0, 0.8); setArm(p, 'R', 0.6 * k, 0.5 * k, 0.1, 0.9, 0, 0, 0.8);
  p.wR[0] *= 1 - k * 0.7; p.w2h *= 1 - k;
} });
def('hit_heavy', { dur: 0.6, blendIn: 0.04, blendOut: 0.7, fn(p, u, ctx) { // big stagger back
  const R = ctx.rig;
  const k = K(u, 0, 0, 0.1, 1, 0.45, 0.8, 1, 0);
  p.hip[2] += 0.12 * k; crouch(p, 0.08 * k, R);
  p.set(B.hips, 0.15 * k, 0.1 * k, 0); p.add(B.spine, 0.25 * k, 0, 0); p.add(B.chest, 0.3 * k, -0.15 * k, 0.1 * k); p.add(B.head, 0.35 * k, 0.2 * k, 0);
  step(p, 1, u, 0.03, 0.22, 0.02, 0.25, 0.7, 1);
  setArm(p, 'L', 0.2 + 0.5 * k, 0.4 + 0.3 * k, 0, 0.5, 0, 0, 0.6); setArm(p, 'R', 0.2 + 0.5 * k, 0.4 + 0.3 * k, 0, 0.5, 0, 0, 0.6);
  p.wR[0] *= 1 - k * 0.6; p.w2h *= 1 - k; p.face = u < 0.5 ? 3 : 0;
} });
def('knockdown', { dur: 0.75, hold: true, blendIn: 0.04, fn(p, u, ctx, A) {
  const R = ctx.rig;
  const T = A.T4.copy(p); downPose(T, ctx.t, ctx, A);
  const k1 = K(u, 0, 0, 0.25, 1), k2 = K(u, 0.15, 0, 0.72, 1);
  // flung back: rise a little, then land on the back
  p.hip[2] += 0.15 * k1; p.hip[1] += 0.08 * sin(clamp(u / 0.6, 0, 1) * PI);
  p.set(B.hips, 0.3 * k1, 0, 0); p.add(B.chest, 0.3 * k1, 0, 0); p.add(B.head, 0.3 * k1, 0, 0);
  setArm(p, 'L', 0.9 * k1, 0.6, 0, 0.4, 0, 0, 0.3); setArm(p, 'R', 0.9 * k1, 0.6, 0, 0.4, 0, 0, 0.3);
  p.lerp(T, k2);
  if (u > 0.7) { const b = sin(clamp((u - 0.7) / 0.3, 0, 1) * PI) * 0.03; p.hip[1] += b; }
  p.wR[0] = 0; p.wL[0] = 0; p.w2h = 0; p.face = u < 0.6 ? 3 : 1;
} });
def('getup', { dur: 0.8, blendIn: 0.02, blendOut: 0.8, fn(p, u, ctx, A) { // roll to a knee, push up
  const R = ctx.rig;
  const T = A.T4.copy(p); downPose(T, ctx.t, ctx, A);
  const k = K(u, 0, 1, 0.45, 0, 1, 0); // weight of the lying pose
  const kn = K(u, 0.1, 0, 0.45, 1, 0.75, 1, 1, 0); // kneel
  if (kn > 0) {
    crouch(p, 0.42 * kn, R); p.hip[2] += 0.05 * kn;
    p.feet[2] -= 0.28 * kn; p.feet[7] += 0.45 * kn; p.feet[6] += 0.05 * kn; p.feet[8] = -1.1 * kn; p.toe[1] = 0.9 * kn;
    p.add(B.spine, -0.3 * kn, 0, 0); p.add(B.chest, -0.15 * kn, 0, 0);
    setArm(p, 'L', 0.7 * kn, 0.2, 0, 1.1 * kn, 0, 0, 0.5); setArm(p, 'R', 0.2, 0.3, 0, 0.5, 0, 0, 0.5);
  }
  p.lerp(T, k);
  p.wR[0] *= 1 - Math.max(k, kn); p.w2h *= 1 - Math.max(k, kn);
} });
def('stun', { dur: 1.6, loop: true, blendIn: 0.1, fn(p, u, ctx, A) {
  const R = ctx.rig, t = u * PI * 2;
  const sw = sin(t), sw2 = sin(t * 2 + 1);
  crouch(p, 0.08, R); p.hip[0] += sw * 0.03;
  p.set(B.hips, 0.1, sw * 0.08, sw2 * 0.04); p.set(B.spine, 0.12, 0, sw * 0.06); p.set(B.chest, 0.1, sw2 * 0.08, 0);
  p.set(B.neck, 0.2, 0, 0); p.set(B.head, 0.3 + sw2 * 0.1, sw * 0.4, sw * 0.25);
  setArm(p, 'L', 0.1, 0.12, 0.1, 0.35, 0.1, 0, 0.3); setArm(p, 'R', 0.1, 0.12, 0.1, 0.35, 0.1, 0, 0.3);
  stance(p, ctx, 0.06, 0.05, -0.08, 0.3);
  p.w2h = 0; p.wR[0] = 0; p.wL[0] = 0; p.face = 1;
} });
def('death', { dur: 1.2, hold: true, blendIn: 0.03, fn(p, u, ctx, A) { deathPose(p, ctx, A, u * 1.2); } });
def('revive', { dur: 1.3, blendIn: 0.02, blendOut: 0.85, fn(p, u, ctx, A) {
  const R = ctx.rig;
  const T = A.T4.copy(p); deathPose(T, ctx, A, 1.2);
  const k = K(u, 0, 1, 0.5, 0);
  const up = K(u, 0.35, 0, 0.7, 1, 1, 0);
  p.add(B.chest, 0.2 * up, 0, 0); p.add(B.head, -0.3 * up, 0, 0);
  for (const s of ['L', 'R']) setArm(p, s, 0.3 * up, 0.3 + 1.2 * up, -0.4, 0.4, -0.3, 0, 0.2);
  p.lerp(T, k);
  p.wR[0] *= 1 - Math.max(k, up); p.w2h *= 1 - Math.max(k, up); p.face = up > 0.3 ? 2 : 1;
} });

def('atk1', { dur: 0.62, hits: [0.42], attack: true, blendIn: 0.06, blendOut: 0.8, fn(p, u, ctx) { // generic: quick forward jab/slash
  const k = K(u, 0, 0, 0.3, -1, 0.45, 1, 0.7, 0.6, 1, 0);
  twist(p, 0.5 * k); setArm(p, 'R', 0.7 + 0.8 * Math.max(0, k), 0.3, 0.1, 1.4 - 1.1 * Math.max(0, k), 0.1, 0, 1.3);
} });
const genericSwing = (p, u, ctx) => { const k = K(u, 0, 0, 0.3, -1, 0.45, 1, 0.7, 0.6, 1, 0); twist(p, 0.5 * k); setArm(p, 'R', 0.7 + 0.8 * Math.max(0, k), 0.3, 0.1, 1.4 - 1.1 * Math.max(0, k), 0.1, 0, 1.3); };
def('atk2', { dur: 0.62, hits: [0.45], attack: true, blendIn: 0.06, blendOut: 0.8, fn: genericSwing });
def('atk3', { dur: 0.9, hits: [0.5], attack: true, blendIn: 0.06, blendOut: 0.8, fn: genericSwing });
def('slash_h', { dur: 0.8, hits: [0.46], attack: true, blendIn: 0.06, blendOut: 0.8, fn: genericSwing });
def('spin', { dur: 0.9, hits: [0.4, 0.65], attack: true, blendIn: 0.06, blendOut: 0.8, fn: genericSwing });
def('spin_loop', { dur: 0.6, loop: true, attack: true, fn: genericSwing });
// ---- contract completeness: every action name plays something sensible until its authored version lands ----------
export const ACTION_LIST = {
  utility: ['dash', 'dash_back', 'hit', 'hit_heavy', 'knockdown', 'getup', 'stun', 'death', 'revive', 'interact', 'pickup', 'use_item', 'throw', 'victory', 'transform', 'awaken', 'identity'],
  attacks: ['atk1', 'atk2', 'atk3', 'slash_h', 'slash_v', 'slash_up', 'slash_x', 'thrust', 'spin', 'spin_loop', 'leap', 'slam', 'charge_hold', 'charge_release', 'dash_strike', 'uppercut', 'punch_loop', 'kick_high', 'kick_spin', 'kick_flip', 'palm', 'ground_punch', 'shoot', 'shoot_dual', 'shoot_loop', 'shotgun', 'rifle_aim', 'rifle_fire', 'cast', 'cast_up', 'cast_ground', 'channel', 'summon', 'strum', 'strum_big', 'harp_loop', 'throw_weapon', 'pull', 'buff', 'block', 'taunt', 'vanish', 'appear'],
  life: ['gather', 'chop', 'mine', 'dig', 'fish_cast', 'fish_idle', 'fish_reel', 'play_instrument', 'wave', 'bow', 'dance', 'cheer', 'clap', 'laugh', 'cry', 'salute', 'point', 'flex', 'sit', 'sleep', 'shrug', 'facepalm', 'kneel', 'think', 'heart', 'angry', 'yes', 'no'],
};
const LOOPS = new Set(['stun', 'spin_loop', 'charge_hold', 'punch_loop', 'shoot_loop', 'rifle_aim', 'channel', 'harp_loop', 'block', 'fish_idle', 'play_instrument', 'dance', 'sit', 'sleep']);
const HOLDS = new Set(['death', 'knockdown', 'leap']);
const genericGesture = (p, u) => { const k = sin(u * PI); setArm(p, 'R', 0.3 + 1.2 * k, 0.3 + 0.4 * k, -0.2, 0.9, -0.2, 0, 0.3); p.add(B.chest, 0.05 * k, 0.1 * k, 0); };
for (const group of Object.values(ACTION_LIST)) for (const n of group) {
  if ((M[n] && M[n].fn) || n === 'hit') continue;
  const atk = group === ACTION_LIST.attacks;
  def(n, { dur: LOOPS.has(n) ? 1.2 : atk ? 0.8 : 1.4, loop: LOOPS.has(n), hold: HOLDS.has(n), attack: atk, hits: atk ? [0.5] : [], blendIn: 0.1, blendOut: 0.8, fn: atk ? genericSwing : genericGesture, generic: true });
}
