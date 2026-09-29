// Shared full-body poses used by the animator and by moves (lying down, dead, kneeling).
import { B } from './rig.js';
import { setArm, setClav, stance } from './pose.js';
import { clamp, lerp, smoothstep } from '../../core/noise.js';

/** lying on the back (knocked down) */
export function downPose(p, t, ctx, A) {
  const R = ctx.rig;
  const br = Math.sin(t * 2.4) * 0.02;
  p.ikw = 0;
  p.hip[1] = -(R.hips.y - 0.11); p.hip[2] = 0.3 * R.legLen;
  p.set(B.hips, -Math.PI / 2 + 0.08, 0.05, 0.02);
  p.set(B.spine, 0.12 + br, 0, 0); p.set(B.chest, 0.08, 0, 0); p.set(B.neck, 0.25, 0, 0); p.set(B.head, 0.1, -0.35, 0.1);
  setArm(p, 'L', -0.2, 0.9, 0.2, 0.5, 0, 0, 0.3); setArm(p, 'R', 0.3, 0.6, 0.1, 0.9, 0, 0, 0.35);
  p.set(B.thighL, 0.15, 0, -0.1); p.set(B.shinL, -0.25, 0, 0); p.set(B.footL, 0.3, 0, 0);
  p.set(B.thighR, 0.55, 0, 0.1); p.set(B.shinR, -1.0, 0, 0); p.set(B.footR, 0.2, 0, 0);
  p.w2h = 0; p.wR[0] = 0; p.wL[0] = 0;
}

export function deathPose(p, ctx, A, t) {
  const R = ctx.rig;
  const k1 = smoothstep(0, 0.3, t), k2 = smoothstep(0.2, 0.75, t);
  const bounce = t > 0.75 && t < 1.05 ? Math.sin((t - 0.75) / 0.3 * Math.PI) * 0.03 : 0;
  p.ikw = 1 - k2;
  const legScale = R.legLen / 0.87;
  stance(p, ctx, 0.05, 0.1 * k1, -0.1 * k1, 0.2);
  p.hip[1] = lerp(-0.28 * k1 * legScale, -(R.hips.y - 0.12), k2) + bounce;
  p.hip[2] = lerp(0.05 * k1, 0.36 * legScale, k2);
  p.set(B.hips, lerp(0.15 * k1, -Math.PI / 2 + 0.05, k2), 0.1 * k2, 0.05 * k2);
  p.set(B.spine, lerp(0.25 * k1, 0.05, k2), 0, 0);
  p.set(B.chest, lerp(0.3 * k1, 0.02, k2), 0, 0);
  p.set(B.neck, lerp(0.1, 0.12, k2), 0, 0);
  p.set(B.head, lerp(0.25, 0.05, k2), -0.7 * k2, 0.2 * k2);
  setArm(p, 'L', lerp(0.3, -0.1, k2), lerp(0.3, 1.25, k2), 0, lerp(0.8, 0.3, k2), 0, 0, 0.25);
  setArm(p, 'R', lerp(0.3, 0.2, k2), lerp(0.3, 0.9, k2), 0, lerp(0.8, 0.6, k2), 0, 0, 0.3);
  p.set(B.thighL, lerp(0, 0.1, k2), 0, -0.12); p.set(B.shinL, lerp(-0.8, -0.15, k2), 0, 0); p.set(B.footL, 0.3 * k2, 0, 0);
  p.set(B.thighR, lerp(0, 0.45, k2), 0, 0.1); p.set(B.shinR, lerp(-0.8, -0.8, k2), 0, 0); p.set(B.footR, 0.2 * k2, 0, 0);
  p.w2h = 0; p.wR[0] = 0; p.wL[0] = 0;
}

