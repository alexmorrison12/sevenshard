// Pet helpers shared by foxling / owlet / slimelet:
//   - eyes on their own bones → blinks, happy squints (^ ^), sleepy / fainted closed eyes (bone Y scale)
//   - pop-in: the instance pivot scales 0 → 1.15 → 1 (spawn) and back to the authored scale afterwards
//   - big glossy anime eyes (dark iris, two glints) that read at iso distance
import * as THREE from 'three';
import { eyeGeo, eyeMatrix } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addG, rigidSkin, sstep, clamp01, mix } from './common.js';

/**
 * Big cute eye: dark iris with a coloured ring, big pupil, two glints. Seated on the SDF surface of `group`.
 * o: { iris, ring, pupil, glow (iris emissive), sink, squash, group, seg }
 */
export function cuteEye(acc, S, bone, p, dir, r, o = {}) {
  const g = eyeGeo(r, [{ a: o.pupilA ?? 0.62, c: 0 }, { a: o.irisA ?? 0.98, c: 1 }], o.seg ?? 10, 1.62);
  const m = eyeMatrix(S, p, dir, r, o.sink ?? 0.42, o.group ?? 0, o.squash ?? 1);
  const cp = col(o.pupil ?? 0x0c0808), ci = col(o.iris ?? 0x3a2a20), cr = col(o.rim ?? 0x100a0a);
  addG(acc, g, { matrix: m, skin: rigidSkin(bone), dtl: [0, 0, 0, 0],
    color: (q, n, uv) => uv[0] === 0 ? cp : uv[0] === 1 ? ci : cr,
    emis: (q, uv) => (uv[0] === 1 ? (o.glow ?? 0.15) : uv[0] === 0 ? (o.pupilGlow ?? 0) : 0) });
  // glints: a big one up-left, a small one down-right (slightly emissive so they sparkle at distance)
  for (const [gx, gy, gr, e] of [[-0.34, 0.36, 0.3, 0.35], [0.3, -0.3, 0.14, 0.25]]) {
    const q = new THREE.Vector3(gx * r, gy * r, r * 0.96).applyMatrix4(m);
    const s = new THREE.SphereGeometry(r * gr, 5, 4);
    addG(acc, s, { matrix: new THREE.Matrix4().makeTranslation(q.x, q.y, q.z), skin: rigidSkin(bone), color: 0xffffff, emis: e, dtl: [0, 0, 0, 0] });
  }
}

/** per-frame pet face & pop: call from spec.post. ctl fields: eyeClose (0 open … 1 shut), happy (0..1 squint), pop (scale mul) */
export function petPost(ctl, dt, o = {}) {
  const P = ctl.pose, b = ctl.b;
  // blink timer
  ctl.blinkT = (ctl.blinkT ?? (1 + Math.random() * 3)) - dt;
  if (ctl.blinkT < -0.14) ctl.blinkT = 1.6 + Math.random() * 3.4;
  const blink = ctl.blinkT < 0 ? Math.sin(clamp01(-ctl.blinkT / 0.14) * Math.PI) : 0;
  const shut = Math.max(blink, ctl.eyeClose || 0, ctl.dead ? 1 : 0);
  const happy = ctl.happy || 0;
  const sy = Math.max(0.08, 1 - shut * 0.92) * (1 - happy * 0.62);
  if (b.eyes) for (let i = 0; i < b.eyes.length; i++) { const e = P.sc[b.eyes[i]]; e.x *= 1 + happy * 0.08; e.y *= sy; if (happy > 0) P.move(b.eyes[i], 0, happy * (o.happyLift ?? 0.004), 0); }
  // pop-in / pop-out
  const pop = ctl.pop ?? 1, inst = ctl.inst;
  inst.pivot.scale.setScalar(inst.scale * pop);
  ctl.eyeClose = 0; ctl.happy = 0; ctl.pop = 1;
}

/** spawn (pop in): scale 0 → overshoot → settle with a little squash-hop; pair with a sparkle / poof FX */
export function popIn(dur = 0.7, o = {}) {
  return { dur, a: 0.001, d: 0.98, state: true, excl: true, fn(ctl, a, w) {
    const k = a.k;
    const s = k < 0.45 ? mix(0.02, 1.18, 1 - Math.pow(1 - k / 0.45, 3)) : k < 0.7 ? mix(1.18, 0.94, sstep(0.45, 0.7, k)) : mix(0.94, 1, sstep(0.7, 1, k));
    ctl.pop = mix(1, s, w);
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.5, 0.7, k) * (1 - sstep(0.85, 1, k)) * w);
    if (o.fn) o.fn(ctl, a, w);
  } };
}
export { sstep, clamp01, mix };
