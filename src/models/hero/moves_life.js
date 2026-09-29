// Utility, life-skill and social moves. Actions may carry a prop (tool) shown in a hand while they play:
// prop: 'axe' | 'pickaxe' | 'shovel' | 'rod' | 'lute' | 'potion' | 'bomb' | 'sickle' (weapons are sheathed meanwhile).
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';
import { sin, cos, PI, clamp, lerp, sstep, K, KC, E, track, wieldT, step, crouch, twist, bend, base, fist, fistAt, M, def, v, vs } from './movelib.js';
import { deathPose } from './poses.js';

const P3 = (p, R, s, u, f) => [s + p.hip[0], R.chestY + u + p.hip[1], -f + p.hip[2]];
const clearW = (p, k = 1) => { p.wR[0] *= 1 - k; p.wL[0] *= 1 - k; p.w2h *= 1 - k; };
const kneelLegs = (p, ctx, k) => { const R = ctx.rig, L = R.legLen; p.hip[1] -= 0.44 * L * k; p.hip[2] += 0.05 * k; p.feet[0] = -R.stanceX; p.feet[1] = R.ankleH; p.feet[2] = -0.3 * L * k; p.feet[3] = 0; p.feet[5] = R.stanceX * 0.8; p.feet[6] = R.ankleH + 0.06 * k; p.feet[7] = 0.52 * L * k; p.feet[8] = -1.2 * k; p.toe[1] = 0.9 * k; };
const squatLegs = (p, ctx, k) => { const R = ctx.rig; crouch(p, 0.5 * k, R); p.hip[2] += 0.1 * k; stance(p, ctx, 0.08 * k + 0.02, 0.05, -0.02, 0.3); p.feet[3] = 0; p.feet[8] = 0; };
const DRAWN_NO = { sheath: true, draw: false };

// ---- utility -------------------------------------------------------------------------------------------
def('interact', { dur: 0.9, ...DRAWN_NO, blendIn: 0.1, blendOut: 0.8, fn(p, u, ctx) { // reach out and touch / activate
  const R = ctx.rig, k = K(u, 0, 0, 0.35, 1, 0.65, 1, 1, 0);
  fistAt(p.wR, k, P3(p, R, 0.1, -0.02, 0.55), [0, 0.1, -1], [-1, 0.2, 0]); setFingers(p, 'R', 0.15, 0.05, 0.2);
  bend(p, -0.15 * k); step(p, 0, u, 0, -0.14, 0.15, 0.35, 0.7, 0.95); p.add(B.head, 0.1 * k, 0, 0);
} });
def('pickup', { dur: 1.0, ...DRAWN_NO, blendIn: 0.1, blendOut: 0.8, fn(p, u, ctx) { // bend down, grab, straighten
  const R = ctx.rig, k = K(u, 0, 0, 0.4, 1, 0.55, 1, 0.9, 0);
  squatLegs(p, ctx, 0.75 * k); bend(p, -0.55 * k);
  fistAt(p.wR, k, P3(p, R, 0.14, -1.0, 0.42), [0, -1, -0.3], [-1, 0, 0]); setFingers(p, 'R', K(u, 0.4, 0.2, 0.5, 1.2), 1, 0.9);
  setArm(p, 'L', 0.4 * k, 0.3, 0, 0.6, 0, 0, 0.5);
} });
def('use_item', { dur: 1.3, ...DRAWN_NO, prop: 'potion', blendIn: 0.1, blendOut: 0.82, fn(p, u, ctx) { // drink a potion
  const R = ctx.rig, lift = K(u, 0, 0, 0.3, 1, 0.8, 1, 1, 0), tip = K(u, 0.3, 0, 0.45, 1, 0.75, 1, 0.85, 0);
  fistAt(p.wR, lift, P3(p, R, lerp(0.15, 0.03, lift), lerp(-0.15, 0.36, lift) + 0.02 * tip, lerp(0.3, 0.14, lift)), [-0.4, lerp(0.2, -0.2, tip), -0.9 + 0.5 * tip], [-0.2, lerp(1, -0.2, tip), 0.4 * tip]);
  setFingers(p, 'R', 1.1, 1, 0.9);
  p.add(B.head, -0.45 * tip, 0, 0); p.add(B.neck, -0.15 * tip, 0, 0); bend(p, 0.08 * tip);
  setArm(p, 'L', 0.1, 0.15, 0, 0.4, 0, 0, 0.5);
} });
def('throw', { dur: 0.75, hits: [0.46], ...DRAWN_NO, prop: 'bomb', blendIn: 0.08, blendOut: 0.8, fn(p, u, ctx) { // overhand throw of a battle item
  const R = ctx.rig;
  const tr = [[0, 0.18, -0.15, 0.3], E([0.36, 0.3, 0.3, -0.2]), [0.46, 0.12, 0.3, 0.55], [0.6, 0.0, -0.05, 0.6], [1, 0.18, -0.15, 0.3]];
  const kk = track(u, tr);
  fistAt(p.wR, 1, P3(p, R, kk[0], kk[1], kk[2]), [0, KC(u, 0, 0.3, 0.36, 0.8, 0.46, 0.1, 1, 0.3), -1], [-1, 0.2, 0]); setFingers(p, 'R', u < 0.46 ? 1.1 : 0.2, u < 0.46 ? 1 : 0.1, 0.8);
  setArm(p, 'L', 1.3 * K(u, 0, 0, 0.36, 1, 0.5, 0.3, 1, 0), 0.3, 0, 0.5, 0, 0, 0.4);
  twist(p, KC(u, 0, 0, 0.36, 0.6, 0.48, -0.4, 1, 0), 0.35); bend(p, KC(u, 0, 0, 0.36, 0.15, 0.5, -0.3, 1, 0)); step(p, 0, u, 0, -0.26, 0.3, 0.46, 0.8, 1);
} });
def('victory', { dur: 1.8, blendIn: 0.1, blendOut: 0.85, fn(p, u, ctx) { // fist pump to the sky
  const R = ctx.rig, k = K(u, 0, 0, 0.3, 1, 0.85, 1, 1, 0), pump = sin(clamp((u - 0.3) / 0.5, 0, 1) * PI * 2) * 0.1 * k;
  setArm(p, 'R', 0.5 * k, 0.3 + 2.3 * k, -0.2, 0.3 + pump * 2, 0, 0, 1.4); setClav(p, 'R', 0.3 * k);
  setArm(p, 'L', 0.15, 0.3, 0.5, 1.7 * k, 0, 0, 1.4);
  bend(p, 0.15 * k); p.add(B.head, -0.3 * k, 0.1 * k, 0); stance(p, ctx, 0.1 * k, 0.08, -0.08, 0.35);
  p.face = k > 0.5 ? 2 : 0; clearW(p, k * (ctx.kind === 'greatsword' || ctx.kind === 'sword' ? 0 : 1));
} });
def('transform', { dur: 1.3, hits: [0.6], attack: true, blendIn: 0.05, blendOut: 0.85, fn(p, u, ctx) { // hunch, gather, burst out with a roar
  const R = ctx.rig, hunch = K(u, 0, 0, 0.4, 1, 0.55, 0.2, 1, 0), burst = K(u, 0.5, 0, 0.62, 1, 0.9, 0.8, 1, 0);
  const sh = sin(u * 90) * 0.02 * hunch;
  crouch(p, 0.3 * hunch + 0.1 * burst, R); bend(p, -0.55 * hunch + 0.3 * burst + sh);
  for (const s of ['L', 'R']) { setArm(p, s, 0.9 * hunch - 0.3 * burst, 0.25 + 1.2 * burst, 0.4, 1.8 * hunch + 0.6 * burst, 0.2, 0, 1.4 - 0.9 * burst); setClav(p, s, -0.1 * hunch + 0.3 * burst); }
  p.add(B.head, 0.3 * hunch - 0.45 * burst, 0, 0); base(p, ctx, 0.2, 0.15, 0.15, 0.5);
  p.face = burst > 0.3 ? 2 : hunch > 0.5 ? 1 : 0; clearW(p, Math.max(hunch, burst));
} });
def('awaken', { dur: 2.0, hits: [1.1 / 2, 1.5 / 2], attack: true, blendIn: 0.05, blendOut: 0.9, fn(p, u, ctx, A) { // ultimate: gather high, then the finishing strike
  const R = ctx.rig, rise = K(u, 0, 0, 0.35, 1, 0.5, 1), strike = K(u, 0.5, 0, 0.58, 1, 0.85, 1, 1, 0);
  const T = A.T4.copy(p);
  const fin = resolveFinisher(ctx.kind);
  if (fin) { fin(T, clamp((u - 0.4) / 0.6, 0, 1), ctx, A); }
  for (const s of ['L', 'R']) { setArm(p, s, 0.4 + 0.9 * rise, 0.4 + 1.8 * rise, -0.4, 0.4, -0.3, 0, 0.5); setClav(p, s, 0.3 * rise); }
  bend(p, 0.25 * rise); p.add(B.head, -0.4 * rise, 0, 0); p.hip[1] += 0.06 * rise;
  p.feet[3] = -0.2 * rise; p.feet[8] = -0.2 * rise;
  clearW(p, rise * (1 - strike));
  if (fin) p.lerp(T, strike);
  p.face = rise > 0.5 ? 2 : 0;
} });
function resolveFinisher(kind) {
  const d = (M.atk3.v && M.atk3.v[kind]) || M.slash_v.v?.[kind] || null;
  return d && d.fn;
}
def('identity', { dur: 1.1, blendIn: 0.05, blendOut: 0.85, fn(p, u, ctx) { // power surge: fists clenched at the sides, head thrown back
  const R = ctx.rig, k = K(u, 0, 0, 0.25, 1, 0.75, 1, 1, 0), sh = sin(u * 70) * 0.015 * k;
  for (const s of ['L', 'R']) { setArm(p, s, -0.1, 0.45 * k + 0.1, 0.3, 1.6 * k, 0.1, 0, 1.45); setClav(p, s, 0.25 * k + sh); }
  crouch(p, 0.16 * k, R); bend(p, 0.25 * k + sh); p.add(B.head, -0.45 * k, 0, 0); base(p, ctx, 0.2 * k, 0.1, 0.1, 0.45);
  p.face = k > 0.4 ? 2 : 0;
} });
def('taunt', { dur: 1.4, blendIn: 0.1, blendOut: 0.85, fn(p, u, ctx) { // beckon: come at me
  const R = ctx.rig, k = K(u, 0, 0, 0.25, 1, 0.8, 1, 1, 0), wave = Math.max(0, sin((u - 0.25) * PI * 7)) * k;
  setArm(p, 'L', 1.1 * k, 0.2, 0.9 * k, 0.6 + 0.9 * wave, 0.3, 0, 0.2 + 0.9 * wave); setClav(p, 'L', 0.1 * k);
  bend(p, 0.1 * k); p.add(B.head, -0.1 * k, 0.15 * k, 0.1 * k); p.face = k > 0.5 ? 2 : 0;
} });
def('pull', { dur: 0.8, hits: [0.3, 0.55], attack: true, blendIn: 0.06, blendOut: 0.82, fn(p, u, ctx) { // hurl a chain, then yank the target in
  const R = ctx.rig, out = K(u, 0, 0, 0.25, 1, 0.42, 1, 0.55, 0), yank = K(u, 0.42, 0, 0.56, 1, 0.8, 1, 1, 0);
  fistAt(p.wL, Math.max(out, yank), P3(p, R, lerp(-0.1, -0.2, yank), lerp(0.05, -0.05, yank), lerp(0.66, 0.15, yank)), [0, 0, -1], [1, 0.3, 0]); fist(p, 'L', 1.5);
  twist(p, -0.3 * out + 0.45 * yank, 0.35); bend(p, -0.2 * out + 0.25 * yank); p.hip[2] += 0.1 * yank; crouch(p, 0.14 * yank, R);
  step(p, 0, u, 0, -0.2, 0.1, 0.28, 0.5, 0.65);
} });
def('throw_weapon', { dur: 0.7, hits: [0.42], attack: true, blendIn: 0.06, blendOut: 0.8, fn(p, u, ctx) { // generic overhand hurl
  const R = ctx.rig, w = K(u, 0, 0, 0.3, 1, 0.42, 0), r = K(u, 0.32, 0, 0.44, 1, 0.7, 1, 1, 0);
  setArm(p, 'R', 0.3 + 2.4 * w + 1.2 * r, 0.4 * w, 0.2, 1.4 * w + 0.2 * r, -0.2, 0, 1.2);
  twist(p, 0.5 * w - 0.4 * r, 0.35); bend(p, 0.15 * w - 0.3 * r); step(p, 0, u, 0, -0.24, 0.28, 0.42, 0.8, 1);
} });
v('throw_weapon', 'blades', { dur: 0.6, hits: [0.36], fn(p, u, ctx) { // both blades flung outward (dark order)
  const R = ctx.rig, w = K(u, 0, 0, 0.26, 1, 0.36, 0), r = K(u, 0.28, 0, 0.38, 1, 0.65, 1, 1, 0);
  wieldT(p, 'R', 1, [lerp(80, 30, r), lerp(40, 0, r) - 20 * (1 - w), lerp(0.3, 0.58, r), 0, 0, 20, 0], R, 0.12);
  wieldT(p, 'L', 1, [lerp(-80, -30, r), lerp(40, 0, r) - 20 * (1 - w), lerp(0.3, 0.58, r), 0, 180, -20, 0], R, -0.12);
  bend(p, 0.15 * w - 0.25 * r); crouch(p, 0.1 * r, R); step(p, 0, u, 0, -0.2, 0.24, 0.36, 0.8, 1);
} });
def('vanish', { dur: 0.45, attack: true, blendIn: 0.05, blendOut: 0.95, fn(p, u, ctx) { // crouch and melt into shadow (fx hides the body)
  const R = ctx.rig, k = K(u, 0, 0, 0.6, 1);
  crouch(p, 0.3 * k, R); bend(p, -0.4 * k); base(p, ctx, 0.16, 0.2, 0.2, 0.45);
  setArm(p, 'L', 0.9 * k, 0.4, 0.4, 1.4 * k, 0, 0, 1.2); setArm(p, 'R', -0.4 * k, 0.4, 0.2, 0.6, 0, 0, 1.2);
} });
def('appear', { dur: 0.5, attack: true, blendIn: 0.0, blendOut: 0.8, fn(p, u, ctx) { // emerge low, rising into a guard
  const R = ctx.rig, k = K(u, 0, 1, 0.6, 0);
  crouch(p, 0.34 * k, R); bend(p, -0.45 * k); base(p, ctx, 0.2 * k, 0.25 * k, 0.2 * k, 0.5);
  setArm(p, 'L', -0.5 * k, 0.5 * k, 0.2, 0.5, 0, 0, 1.2); setArm(p, 'R', -0.5 * k, 0.5 * k, 0.2, 0.5, 0, 0, 1.2);
} });
def('block', { dur: 1.0, loop: true, attack: true, blendIn: 0.15, fn(p, u, ctx) { // generic guard: forearms up
  const R = ctx.rig;
  setArm(p, 'L', 1.4, 0.2, 0.9, 1.9, 0, 0, 1.4); setArm(p, 'R', 1.3, 0.2, 0.9, 2.0, 0, 0, 1.4);
  crouch(p, 0.12, R); bend(p, -0.12); base(p, ctx, 0.16, 0.18, 0.16, 0.45);
} });

// ---- life skills (props) -------------------------------------------------------------------------------
def('gather', { dur: 1.8, ...DRAWN_NO, loop: false, blendIn: 0.12, blendOut: 0.85, fn(p, u, ctx) { // kneel, pluck twice, stand
  const R = ctx.rig, k = K(u, 0, 0, 0.25, 1, 0.8, 1, 1, 0), pl = Math.max(0, sin(clamp((u - 0.3) / 0.45, 0, 1) * PI * 2));
  kneelLegs(p, ctx, k); bend(p, -0.45 * k);
  fistAt(p.wR, k, P3(p, R, 0.12, -0.95 + 0.12 * pl, 0.45), [0, -1, -0.2], [-1, 0, 0]); setFingers(p, 'R', 0.6 + 0.6 * pl, 0.6, 0.8);
  setArm(p, 'L', 0.9 * k, 0.2, 0.2, 1.1 * k, 0, 0, 0.5);
} });
function toolSwing(tool, fwd, low) {
  return (p, u, ctx) => { // two-handed overhead swing into a target in front (chop: waist height, mine: low)
    const R = ctx.rig, lp = (u * 2) % 1; // two swings per cycle
    const tr = track(lp, [[0, 30, -30, 0.4, 0, -90, -20, 70], E([0.4, 20, 70, 0.34, 0.1, -90, -10, 40]), [0.58, 0, low, 0.55, 0, -90, 0, 20], E([0.7, 0, low - 6, 0.54, -0.02, -90, 0, 18]), [1, 30, -30, 0.4, 0, -90, -20, 70]]);
    wieldT(p, 'R', 1, tr, R, 0.02); p.w2h = 1;
    bend(p, KC(lp, 0, 0, 0.4, 0.15, 0.6, -0.3, 1, 0)); crouch(p, KC(lp, 0, 0.04, 0.6, 0.14, 1, 0.04), R);
    base(p, ctx, 0.16, fwd, 0.14, 0.4);
  };
}
def('chop', { dur: 1.6, loop: true, hits: [0.29, 0.79], ...DRAWN_NO, prop: 'axe', blendIn: 0.1, fn: toolSwing('axe', 0.2, -5) });
def('mine', { dur: 1.6, loop: true, hits: [0.29, 0.79], ...DRAWN_NO, prop: 'pickaxe', blendIn: 0.1, fn: toolSwing('pickaxe', 0.22, -30) });
def('dig', { dur: 1.5, loop: true, hits: [0.3], ...DRAWN_NO, prop: 'shovel', blendIn: 0.1, fn(p, u, ctx) { // push the shovel in with the foot, lift the dirt
  const R = ctx.rig;
  const tr = track(u, [[0, 10, -55, 0.4, 0, 90, 0, -30], E([0.3, 10, -70, 0.46, -0.06, 90, 0, -30]), [0.55, 20, -30, 0.4, 0, 90, 0, 20], E([0.72, 40, -10, 0.38, 0.04, 90, 30, 30]), [1, 10, -55, 0.4, 0, 90, 0, -30]]);
  wieldT(p, 'R', 1, tr, R, 0.02); p.w2h = 1;
  const push = K(u, 0.1, 0, 0.3, 1, 0.45, 0);
  bend(p, KC(u, 0, -0.35, 0.3, -0.45, 0.6, -0.15, 1, -0.35)); crouch(p, 0.12 + 0.08 * push, R); base(p, ctx, 0.14, 0.2, 0.14, 0.4);
  p.feet[1] += 0.12 * K(u, 0.05, 0, 0.18, 1, 0.3, 0); p.feet[2] -= 0.15 * K(u, 0.05, 0, 0.18, 1, 0.3, 0.6, 0.5, 0);
} });
def('fish_cast', { dur: 1.2, hits: [0.5], ...DRAWN_NO, prop: 'rod', blendIn: 0.1, blendOut: 0.9, fn(p, u, ctx) { // rod back over the shoulder, whip forward
  const R = ctx.rig;
  const tr = track(u, [[0, 30, -20, 0.36, 0, 90, -20, 60], E([0.38, 60, 40, 0.3, 0.08, 90, 30, 60]), [0.5, 10, 0, 0.5, 0, 90, -10, 30], E([0.66, 5, -10, 0.52, 0, 90, -5, 20]), [1, 10, -18, 0.46, 0, 90, -10, 30]]);
  wieldT(p, 'R', 1, tr, R, 0.08);
  setArm(p, 'L', 0.5, 0.2, 0, 0.9, 0, 0, 1);
  twist(p, KC(u, 0, 0, 0.38, 0.4, 0.5, -0.1, 1, 0), 0.35); bend(p, KC(u, 0, 0, 0.38, 0.15, 0.52, -0.2, 1, -0.05)); step(p, 0, u, 0, -0.18, 0.36, 0.5, 2, 2);
} });
def('fish_idle', { dur: 3.0, loop: true, ...DRAWN_NO, prop: 'rod', blendIn: 0.15, fn(p, u, ctx) { // waiting for a bite
  const R = ctx.rig, a = u * PI * 2, twitch = Math.max(0, sin(a * 5)) ** 8 * 0.5;
  wieldT(p, 'R', 1, [10, -18 + 3 * sin(a) + 4 * twitch, 0.46, 0, 90, -10, 30], R, 0.08);
  setArm(p, 'L', 0.2, 0.15, 0, 0.5, 0, 0, 0.6); base(p, ctx, 0.08, 0.14, 0.1, 0.35);
  p.add(B.head, 0.12 + 0.05 * sin(a * 0.5), 0.1 * sin(a * 0.5), 0);
} });
def('fish_reel', { dur: 1.4, hits: [0.8], ...DRAWN_NO, prop: 'rod', blendIn: 0.08, blendOut: 0.85, fn(p, u, ctx) { // fight the fish, haul it up
  const R = ctx.rig, a = u * PI * 2, haul = K(u, 0.6, 0, 0.8, 1, 1, 0.6);
  wieldT(p, 'R', 1, [10, lerp(-5, 60, haul) + 6 * sin(a * 6) * (1 - haul), 0.42, 0.02, 90, -10, lerp(30, 10, haul)], R, 0.08);
  fistAt(p.wL, 1, P3(p, R, 0.05, -0.05 + 0.03 * sin(a * 8), 0.3), [0, 0.2, -1], [-1, 0.3, 0]); fist(p, 'L', 1.2);
  bend(p, 0.2 * haul - 0.1 * (1 - haul)); crouch(p, 0.12 * (1 - haul), R); base(p, ctx, 0.14, 0.18, 0.16, 0.4); p.hip[2] += 0.06 * haul;
  p.face = haul > 0.5 ? 2 : 0;
} });
def('play_instrument', { dur: 1.2, loop: true, ...DRAWN_NO, prop: 'lute', blendIn: 0.12, fn(p, u, ctx) { // strum a lute
  const R = ctx.rig, a = u * PI * 2;
  fistAt(p.wL, 1, P3(p, R, -0.3, 0.08, 0.2), [-0.6, 0.5, -0.4], [0, 0.4, -1]); setFingers(p, 'L', 0.7 + 0.2 * sin(a * 4), 0.8, 0.6);
  fistAt(p.wR, 1, P3(p, R, 0.06, -0.12 + 0.04 * sin(a * 4), 0.24), [-0.5, -0.4, -0.5], [0, 1, 0]); setFingers(p, 'R', 0.4, 0.3, 0.4);
  p.hip[0] += 0.02 * sin(a); p.add(B.chest, 0, 0.05 * sin(a), -0.04 * sin(a)); p.add(B.head, 0.15, 0.1 * sin(a), 0.1 * sin(a + 0.5));
  p.feet[1] += 0.03 * Math.max(0, sin(a * 2));
} });

// ---- emotes (social) -------------------------------------------------------------------------------------
const emote = (name, dur, fn, o = {}) => def(name, { dur, ...DRAWN_NO, blendIn: 0.12, blendOut: 0.88, ...o, fn });
emote('wave', 2.2, (p, u, ctx) => {
  const t = u * 2.2, k = K(t, 0, 0, 0.3, 1, 1.9, 1, 2.2, 0), w = sin(t * 9) * 0.35 * k;
  setArm(p, 'R', 0.5 * k, 0.3 + 2.0 * k, -0.5 * k, 0.4 + 0.5 * k + w * 0.3, -0.2, 0, 0.1);
  p.set(B.farmR, 0.4 + 0.5 * k, w * 1.2, 0); p.add(B.head, 0.05 * k, 0.1 * k, -0.12 * k); p.add(B.chest, 0, 0.08 * k, -0.06 * k); setClav(p, 'R', 0.2 * k);
  p.face = k > 0.5 ? 3 : 0; clearW(p, k);
});
emote('bow', 2.4, (p, u, ctx) => {
  const t = u * 2.4, k = K(t, 0, 0, 0.6, 1, 1.6, 1, 2.2, 0);
  p.add(B.hips, -0.45 * k, 0, 0); p.add(B.spine, -0.25 * k, 0, 0); p.add(B.chest, -0.1 * k, 0, 0); p.add(B.head, -0.2 * k, 0, 0); p.hip[2] += 0.1 * k;
  setArm(p, 'R', 0.45 * k + 0.1, -0.55 * k + 0.1, 0.5 * k, 2.0 * k, 0.1, 0, 0.3); setArm(p, 'L', -0.5 * k, 0.1, 0.5 * k, 0.9 * k, 0, 0, 0.5);
  stance(p, ctx, 0, 0.02, -0.02, 0.15); clearW(p, k);
});
emote('dance', 2.0, (p, u, ctx) => { // an energetic step-groove (8 counts)
  const R = ctx.rig, b = u * 8, ph = b * PI, s = sin(ph), k = 1;
  p.hip[0] += 0.07 * s; p.hip[1] += -0.05 + 0.04 * Math.abs(sin(ph));
  p.add(B.hips, 0, 0.18 * s, 0.14 * s); p.add(B.spine, 0, 0, -0.12 * s); p.add(B.chest, 0, -0.15 * s, -0.08 * s);
  const up = (Math.floor(b / 2) % 2) === 0, kk = sin((b % 2) / 2 * PI);
  setArm(p, 'R', up ? 0.4 + 0.3 * kk : 0.6, up ? 0.6 + 1.9 * kk : 0.3, -0.3, 0.3, 0, 0, 1.2); setFingers(p, 'R', 1.3, 0, 0.9);
  setArm(p, 'L', -0.2, 0.55, 0.9, 1.9, 0.3, 0, 1.2);
  p.add(B.head, 0, up ? -0.2 * kk : 0.2 * kk, 0.1 * s);
  stance(p, ctx, 0.08, 0.05 * s, -0.05 * s, 0.25); p.feet[6] += 0.06 * Math.max(0, -s); p.feet[1] += 0.06 * Math.max(0, s);
  p.face = 3; clearW(p, k);
}, { loop: true });
emote('cheer', 2.4, (p, u, ctx) => {
  const t = u * 2.4, k = K(t, 0, 0, 0.25, 1, 2.1, 1, 2.4, 0), pump = Math.abs(sin(t * 5.5));
  for (const s of ['L', 'R']) { setArm(p, s, 0.4 * k, (0.3 + 2.4 * k) - 0.35 * pump * k, 0.2, 0.3 + 0.7 * pump * k, 0.1, 0, 1.3); setClav(p, s, 0.25 * k); }
  p.hip[1] += 0.06 * pump * k - 0.03 * k; p.feet[1] += 0.05 * pump * k; p.feet[6] += 0.05 * pump * k;
  p.add(B.head, -0.25 * k, 0, 0); p.add(B.chest, 0.12 * k, 0, 0); p.face = k > 0.5 ? 2 : 0; clearW(p, k);
});
emote('clap', 2.0, (p, u, ctx) => {
  const t = u * 2, k = K(t, 0, 0, 0.3, 1, 1.7, 1, 2, 0), c = Math.abs(sin(t * 9)) * k;
  for (const s of ['L', 'R']) { const sg = s === 'R' ? 1 : -1; fistAt(s === 'R' ? p.wR : p.wL, k, P3(p, ctx.rig, sg * (0.02 + 0.1 * c), 0.02, 0.32), [0, 1, -0.3], [-sg, 0, 0]); setFingers(p, s, 0.1, 0.05, 0.2); }
  p.add(B.head, -0.1 * k, 0, 0); p.face = k > 0.5 ? 3 : 0;
});
emote('laugh', 2.4, (p, u, ctx) => {
  const t = u * 2.4, k = K(t, 0, 0, 0.3, 1, 2.1, 1, 2.4, 0), sh = sin(t * 16) * 0.05 * k;
  p.add(B.spine, -0.1 * k, 0, 0); p.add(B.chest, -0.05 * k + sh, 0, 0); p.add(B.head, -0.3 * k + sh, 0.1 * k, 0.1 * k);
  setArm(p, 'R', 0.55 * k, -0.35 * k + 0.1, 0.2, 1.5 * k, 0.2, 0, 0.5); setArm(p, 'L', 0.35 * k, 0.1, 0.1, 1.1 * k, 0.1, 0, 0.5);
  setClav(p, 'L', 0.1 * k + sh); setClav(p, 'R', 0.1 * k + sh); p.face = k > 0.3 ? 3 : 0; clearW(p, k);
});
emote('cry', 2.6, (p, u, ctx) => {
  const t = u * 2.6, k = K(t, 0, 0, 0.4, 1, 2.2, 1, 2.6, 0), sob = sin(t * 11) * 0.03 * k;
  bend(p, -0.25 * k + sob); p.add(B.head, 0.35 * k, 0, 0);
  for (const s of ['L', 'R']) { const sg = s === 'R' ? 1 : -1; fistAt(s === 'R' ? p.wR : p.wL, k, P3(p, ctx.rig, sg * 0.04, 0.3 + sob, 0.12), [-sg * 0.3, 1, -0.4], [0, 0, -1]); setFingers(p, s, 0.6, 0.5, 0.5); setClav(p, s, 0.1 * k + sob); }
  p.face = 1;
});
emote('salute', 2.0, (p, u, ctx) => {
  const t = u * 2, k = K(t, 0, 0, 0.3, 1, 1.6, 1, 2, 0);
  fistAt(p.wR, k, P3(p, ctx.rig, 0.1, 0.36, 0.1), [-0.9, 0.3, -0.1], [0, 0.2, -1]); setFingers(p, 'R', 0.05, 0.02, 0.1);
  setArm(p, 'L', 0, 0.08, 0.1, 0.1, 0, 0, 0.5); stance(p, ctx, -0.04, 0, 0, 0.3); p.add(B.chest, 0.08 * k, 0, 0); p.add(B.head, -0.05 * k, 0, 0);
  p.wL[0] = 0;
});
emote('point', 2.0, (p, u, ctx) => {
  const t = u * 2, k = K(t, 0, 0, 0.25, 1, 1.7, 1, 2.0, 0);
  setArm(p, 'R', 1.45 * k + 0.05, 0.12 + 0.05 * k, -0.2 * k, 0.1 + 0.2 * (1 - k), -0.1, 0, 1.3); setFingers(p, 'R', 1.3 * k, 0.0, 0.9);
  p.add(B.chest, 0, -0.18 * k, 0); p.add(B.head, 0, -0.1 * k, 0); clearW(p, k);
});
emote('flex', 2.2, (p, u, ctx) => {
  const t = u * 2.2, k = K(t, 0, 0, 0.35, 1, 1.9, 1, 2.2, 0), pulse = 1 + 0.08 * sin(t * 12) * k;
  for (const s of ['L', 'R']) { setArm(p, s, 0.1, 1.45 * k, -1.1 * k, 2.2 * k * pulse, 0, 0, 1.5); setClav(p, s, 0.2 * k); }
  p.add(B.chest, 0.1 * k, 0, 0); p.add(B.head, -0.1 * k, 0.2 * k, 0); stance(p, ctx, 0.1 * k, 0.05, -0.05, 0.4); crouch(p, 0.06 * k, ctx.rig);
  p.face = k > 0.5 ? 2 : 0; clearW(p, k);
});
emote('sit', 1.0, (p, u, ctx) => { // sit on the ground, one knee up
  const R = ctx.rig, k = 1;
  p.ikw = 0; p.hip[1] = -(R.hips.y - 0.1); p.hip[2] = 0.08;
  p.set(B.hips, 0.35, 0, 0); p.set(B.spine, -0.12, 0, 0); p.set(B.chest, -0.15, 0, 0); p.set(B.head, 0.08, 0.2 * sin(ctx.t * 0.3), 0);
  p.set(B.thighL, 1.2, 0.3, -0.35); p.set(B.shinL, -2.2, 0, 0); p.set(B.footL, 0.3, 0, 0);
  p.set(B.thighR, 1.55, -0.1, 0.1); p.set(B.shinR, -2.4, 0, 0); p.set(B.footR, 0.5, 0, 0);
  setArm(p, 'R', 0.9, 0.3, -0.3, 1.2, 0, 0, 0.5); setArm(p, 'L', -0.4, 0.3, 0, 0.3, -0.5, 0, 0.3); clearW(p, k);
}, { loop: true, blendIn: 0.3 });
emote('sleep', 3.0, (p, u, ctx) => { // curled up on the side, breathing
  const R = ctx.rig, br = sin(u * PI * 2) * 0.02;
  p.ikw = 0; p.hip[1] = -(R.hips.y - 0.14); p.hip[2] = 0.05;
  p.set(B.hips, 0.4, 0, Math.PI / 2 - 0.1); p.set(B.spine, -0.2 + br, 0, 0); p.set(B.chest, -0.15 + br, 0, 0); p.set(B.head, 0.15, 0, -0.3);
  p.set(B.thighL, 1.2, 0, 0); p.set(B.shinL, -1.6, 0, 0); p.set(B.thighR, 0.9, 0, 0); p.set(B.shinR, -1.4, 0, 0);
  setArm(p, 'R', 1.3, 0.2, 0.2, 1.8, 0, 0, 0.4); setArm(p, 'L', 1.1, 0.3, 0.2, 1.6, 0, 0, 0.4); p.face = 1; clearW(p, 1);
}, { loop: true, blendIn: 0.3 });
emote('shrug', 1.6, (p, u, ctx) => {
  const t = u * 1.6, k = K(t, 0, 0, 0.3, 1, 1.1, 1, 1.6, 0);
  for (const s of ['L', 'R']) { setArm(p, s, 0.2 * k, 0.3 + 0.35 * k, -0.9 * k, 1.5 * k, -0.4 * k, 0, 0.2); setClav(p, s, 0.35 * k); }
  p.add(B.head, 0.05 * k, 0, 0.18 * k); p.face = k > 0.5 ? 2 : 0; clearW(p, k);
});
emote('facepalm', 2.0, (p, u, ctx) => {
  const t = u * 2, k = K(t, 0, 0, 0.35, 1, 1.6, 1, 2, 0);
  fistAt(p.wR, k, P3(p, ctx.rig, 0.03, 0.38, 0.14), [-0.3, 1, -0.4], [-1, 0, 0]); setFingers(p, 'R', 0.2, 0.1, 0.3);
  p.add(B.head, 0.3 * k, 0.05 * k, 0); p.add(B.neck, 0.1 * k, 0, 0); p.add(B.chest, 0.05 * k, 0, 0); p.face = 1;
});
emote('kneel', 1.2, (p, u, ctx) => {
  const k = K(u, 0, 0, 0.5, 1); kneelLegs(p, ctx, k);
  p.add(B.spine, -0.1 * k, 0, 0); p.add(B.head, -0.35 * k, 0, 0);
  setArm(p, 'L', 0.9 * k, 0.1, 0, 1.2 * k, 0, 0, 0.5); setArm(p, 'R', 0.3 * k, 0.1, 0.2, 0.7 * k, 0, 0, 0.5); clearW(p, k);
}, { hold: true });
emote('think', 2.4, (p, u, ctx) => {
  const t = u * 2.4, k = K(t, 0, 0, 0.35, 1, 2.0, 1, 2.4, 0);
  fistAt(p.wR, k, P3(p, ctx.rig, 0.05, 0.28, 0.16), [-0.2, 1, -0.3], [-1, 0, 0]); fist(p, 'R', 1.0);
  setArm(p, 'L', 0.7 * k, 0.1, 0.9 * k, 1.9 * k, 0, 0, 1); p.add(B.head, 0.1 * k, 0.15 * k, 0.12 * k); p.add(B.hips, 0, 0, 0.05 * k);
});
emote('heart', 2.2, (p, u, ctx) => { // hands shape a heart over the chest
  const t = u * 2.2, k = K(t, 0, 0, 0.35, 1, 1.8, 1, 2.2, 0);
  for (const s of ['L', 'R']) { const sg = s === 'R' ? 1 : -1; fistAt(s === 'R' ? p.wR : p.wL, k, P3(p, ctx.rig, sg * 0.05, 0.2, 0.3), [-sg * 0.8, 0.5, -0.2], [0, 0.2, -1]); setFingers(p, s, 0.5, 0.6, 0.2); }
  p.add(B.head, 0.05 * k, 0, 0.15 * k); p.add(B.hips, 0, 0, 0.06 * k); p.face = 3;
});
emote('angry', 1.8, (p, u, ctx) => { // stamp and shake the fists
  const t = u * 1.8, k = K(t, 0, 0, 0.25, 1, 1.5, 1, 1.8, 0), sh = sin(t * 30) * 0.04 * k, stamp = Math.max(0, sin(t * 7)) ** 4;
  for (const s of ['L', 'R']) { setArm(p, s, 0.6 * k, 0.3, 0.3, 1.9 * k + sh, 0, 0, 1.5); setClav(p, s, 0.12 * k + sh); }
  bend(p, -0.15 * k); p.add(B.head, 0.1 * k + sh, 0, 0); p.feet[6] += 0.08 * stamp * k; p.face = 2; clearW(p, k);
});
emote('yes', 1.2, (p, u) => { const t = u * 1.2, k = K(t, 0, 0, 0.15, 1, 1.0, 1, 1.2, 0); p.add(B.head, 0.25 * sin(t * 11) * k, 0, 0); p.add(B.neck, 0.08 * sin(t * 11) * k, 0, 0); p.face = 3; });
emote('no', 1.2, (p, u) => { const t = u * 1.2, k = K(t, 0, 0, 0.15, 1, 1.0, 1, 1.2, 0); p.add(B.head, 0, 0.4 * sin(t * 10) * k, 0); p.add(B.neck, 0, 0.12 * sin(t * 10) * k, 0); });
