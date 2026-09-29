// Demon form parts (setDemonForm): swept horns on the head bone, two membrane wings on the chest bone (flapped by the
// hero update), talons on both hands (arms.js 'claw'), and a dark fresnel aura shell that re-uses the hero's skinned
// geometry + skeleton. Rigid parts are built once per body kind and cached; they are cheap (~3k tris all together).
import * as THREE from 'three';
import { PB, tubeGeo, cached } from './pieces.js';
import { assemble } from './assemble.js';
import { SLOT, NSLOT, DET } from './palette.js';
import { linColor } from '../../engine/geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let PAL = null;
function palette() {
  if (PAL) return PAL;
  const m = (hex, spec, det = DET.none, emis = 0, rune = 0) => ({ c: linColor(hex), spec, det, emis, cast: 0, rune });
  PAL = [];
  for (let i = 0; i < NSLOT; i++) PAL.push(m(0x808080, 0));
  PAL[SLOT.HORN] = m(0x2a2026, 0.55, DET.plate);
  PAL[SLOT.BONE] = m(0x241a22, 0.35, DET.leather);
  PAL[SLOT.DARK] = m(0x160e16, 0.2);
  PAL[SLOT.CLOTH1] = m(0x3a1236, 0.08, DET.leather);   // wing membrane
  PAL[SLOT.GLOW] = m(0xd050ff, 0, DET.none, 1);
  return PAL;
}
const NOBASE = { master: null };
const build = (fn) => { const pb = new PB(NOBASE); pb.ao = false; fn(pb); const g = assemble([{ p: pb.build() }], palette(), { skinned: false }); g.computeBoundingSphere(); return g; };

/** a tapered horn along a sampled centreline; ridged, darkening toward the root, glowing tip */
function hornTube(pb, pts, r0, glow = 0.16) {
  const n = pts.length - 1, rad = [];
  let L = 0; const acc = [0]; for (let i = 1; i <= n; i++) { L += pts[i].distanceTo(pts[i - 1]); acc.push(L); }
  for (let i = 0; i <= n; i++) rad.push(r0 * Math.pow(1 - acc[i] / L, 0.8) + 0.0018);
  const g = tubeGeo(pts, rad, 10);
  const tip = pts[n];
  pb.add(g, {
    bw: 0,
    slotFn: (p) => (p.distanceTo(tip) < L * glow ? SLOT.GLOW : SLOT.HORN),
    mulFn: (p, nn) => {
      const d = p.distanceTo(tip) / L;                            // 0 at the tip → 1 at the root
      const ring = 0.84 + 0.16 * Math.abs(Math.sin(d * 46));      // growth ridges
      const f = ring * (0.62 + 0.45 * Math.max(0, nn.y) + 0.12 * (1 - d));
      return d < glow ? [1, 1, 1] : [f, f * 0.94, f * 1.02];
    },
    emis: (p) => { const d = p.distanceTo(tip) / L; return d < glow ? 1 - d / glow * 0.6 : 0; },
  });
}

/** horns in head-bone space (the head bone sits at J.head; the cranium is shared by every face preset) */
export function demonHorns(base) {
  return cached(`${base.headKey}|demonHorns`, () => build(pb => {
    const d = base.P.headDef, s = d.s;
    for (const sg of [-1, 1]) {
      const root = V(sg * 0.06 * s, 0.172 * s, -0.03 * s);
      const pts = [root.clone()];
      const len = 0.34 * s, n = 18;
      const p = root.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n, th = 0.25 + 1.25 * t - 0.35 * t * t;       // rise, then sweep back; tip lifts again
        const dir = V(sg * (0.62 - 0.36 * t), Math.cos(th), Math.sin(th) * 0.95).normalize();
        p.addScaledVector(dir, len / n); pts.push(p.clone());
      }
      hornTube(pb, pts, 0.034 * s);
      // a second, short spur above the temple
      const r2 = V(sg * 0.084 * s, 0.13 * s, -0.01 * s), q = r2.clone(), p2 = [r2.clone()];
      for (let i = 1; i <= 8; i++) { const t = i / 8; q.addScaledVector(V(sg * (0.9 - 0.3 * t), 0.25 + 0.6 * t, 0.35).normalize(), 0.075 * s / 8); p2.push(q.clone()); }
      hornTube(pb, p2, 0.015 * s, 0.25);
    }
  }));
}

/** one wing (sg = +1 right / −1 left) in its own frame: root at the origin (shoulder blade), spanning ±X and back (+Z) */
export function demonWing(base, sg) {
  return cached(`${base.key}|demonWing${sg}`, () => build(pb => {
    const k = Math.max(0.9, base.scale || 1);
    const P = (x, y, z) => V(sg * x * k, y * k, z * k);
    const root = P(0, 0, 0), E = P(0.3, 0.26, 0.16), W = P(0.6, 0.44, 0.24);
    const tips = [P(1.08, 0.34, 0.42), P(1.04, -0.02, 0.48), P(0.84, -0.36, 0.44), P(0.5, -0.54, 0.32)];
    const A = P(0.07, -0.38, 0.06);
    const shade = (p, nn) => { const f = 0.7 + 0.4 * Math.max(0, nn.y); return [f, f * 0.95, f]; };
    // arm bones + thumb talon
    pb.add(tubeGeo([root, E, W], [0.03 * k, 0.024 * k, 0.018 * k], 9), { slot: SLOT.BONE, bw: 0, mulFn: shade });
    pb.add(new THREE.SphereGeometry(0.026 * k, 9, 7), { m: new THREE.Matrix4().makeTranslation(E.x, E.y, E.z), slot: SLOT.BONE, bw: 0, mulFn: shade });
    pb.add(new THREE.SphereGeometry(0.022 * k, 9, 7), { m: new THREE.Matrix4().makeTranslation(W.x, W.y, W.z), slot: SLOT.BONE, bw: 0, mulFn: shade });
    { const pts = []; const q = W.clone(); pts.push(q.clone()); for (let i = 1; i <= 6; i++) { const t = i / 6; q.addScaledVector(V(sg * (0.3 - 0.5 * t), 1, 0.2 - 0.5 * t).normalize(), 0.13 * k / 6); pts.push(q.clone()); } hornTube(pb, pts, 0.016 * k, 0.3); }
    // finger bones (slightly bowed) ending in glowing points
    for (const tp of tips) {
      const mid = W.clone().lerp(tp, 0.5).add(V(0, 0.035 * k, 0.03 * k));
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; const a = W.clone().lerp(mid, t), b = mid.clone().lerp(tp, t); pts.push(a.lerp(b, t)); }
      hornTube(pb, pts, 0.014 * k, 0.1);
    }
    // membrane panels fanned from the wrist; outer edges scalloped between the finger tips, a light billow
    const spokes = [...tips, A, root];
    const RR = 6, UU = 9;
    for (let s = 0; s < spokes.length - 1; s++) {
      const a = spokes[s], b = spokes[s + 1];
      const scal = s < tips.length ? 0.26 : 0.04;
      const edge = (u) => { const e = a.clone().lerp(b, u); return e.addScaledVector(e.clone().sub(W), -scal * Math.sin(Math.PI * u)); };
      const nrm = new THREE.Vector3().subVectors(a, W).cross(new THREE.Vector3().subVectors(b, W)).normalize();
      if (nrm.z * sg < 0 && sg > 0) nrm.negate();
      for (const side of [1, -1]) {
        const ids = [];
        for (let i = 0; i <= RR; i++) {
          const r = i / RR, row = [];
          for (let j = 0; j <= UU; j++) {
            const u = j / UU;
            const e = edge(u);
            const p = W.clone().lerp(e, r).addScaledVector(nrm, 0.035 * k * Math.sin(Math.PI * u) * Math.sin(Math.PI * r * 0.9));
            const nearBone = Math.min(u, 1 - u) * (1 - r * 0.3);
            const f = (side > 0 ? 0.9 : 0.62) * (0.72 + 0.4 * Math.max(0, 0.25 - nearBone)) * (0.9 + 0.2 * r);
            const vein = Math.abs(Math.sin(u * Math.PI * 3 + r * 2)) < 0.07 && r > 0.2 ? 0.35 : 0;
            row.push(pb.v(p.x, p.y, p.z, nrm.x * side, nrm.y * side, nrm.z * side, vein ? SLOT.GLOW : SLOT.CLOTH1, vein ? [0.5, 0.5, 0.5] : [f, f * 0.9, f], vein * (side > 0 ? 1 : 0.5), 0));
          }
          ids.push(row);
        }
        for (let i = 0; i < RR; i++) for (let j = 0; j < UU; j++) { const q0 = ids[i][j], q1 = ids[i][j + 1], q2 = ids[i + 1][j + 1], q3 = ids[i + 1][j]; pb.tri(q0, q1, q2); pb.tri(q0, q2, q3); }
      }
    }
  }));
}

/** dark aura: smoke puffs and embers born on the body's bones, left behind in world space as they rise and fade.
 * One THREE.Points draw call; update(dt, bones, root, k) with k = demon blend (0..1). */
const AURA_VS = /* glsl */`
attribute vec3 aA; varying vec3 vA; uniform float uScale;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aA.y * uScale / max(0.2, -mv.z); vA = aA; }`;
const AURA_FS = /* glsl */`
varying vec3 vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = (1.0 - d) * (1.0 - d);
  vec3 smoke = mix(vec3(0.3, 0.06, 0.42), vec3(0.06, 0.01, 0.09), d);
  vec3 ember = mix(vec3(1.3, 0.5, 1.6), vec3(0.55, 0.08, 0.8), d);
  gl_FragColor = vec4(mix(smoke, ember, vA.z), a * vA.x);
}`;
export function makeAura(n = 44) {
  const pos = new Float32Array(n * 3), aA = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aA', new THREE.BufferAttribute(aA, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 } }, vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, mat);
  pts.name = 'demon_aura'; pts.frustumCulled = false; pts.renderOrder = 3;
  const v2 = new THREE.Vector2();
  pts.onBeforeRender = (r, sc, cam) => { r.getDrawingBufferSize(v2); mat.uniforms.uScale.value = cam.isPerspectiveCamera ? v2.y / (2 * Math.tan(cam.fov * Math.PI / 360)) : v2.y * cam.zoom / Math.max(1e-3, cam.top - cam.bottom); };
  const anchors = [0, 1, 2, 2, 3, 4, 6, 16, 7, 17, 8, 18, 25, 29, 26, 30, 27, 31]; // hips spine chest… (rig order)
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const P = [];
  for (let i = 0; i < n; i++) P.push({ b: anchors[i % anchors.length], w: new THREE.Vector3(), life: 1, t: 1 + rnd(), size: 0, ember: 0, sw: rnd() * 6.28, born: false });
  const _v = new THREE.Vector3(), inv = new THREE.Matrix4();
  function spawn(p, bones) {
    p.life = 0.7 + rnd() * 0.9; p.t = 0; p.ember = rnd() < 0.3 ? 1 : 0;
    p.size = p.ember ? 0.05 + rnd() * 0.05 : 0.26 + rnd() * 0.26;
    p.w.set((rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.22).applyMatrix4(bones[p.b].matrixWorld);
    p.born = true;
  }
  return {
    pts, mat,
    update(dt, bones, root, k) {
      inv.copy(root.matrixWorld).invert();
      for (let i = 0; i < n; i++) {
        const p = P[i];
        p.t += dt;
        if (p.t >= p.life) { if (k > 0.05) spawn(p, bones); else { aA[i * 3] = 0; continue; } }
        const u = p.t / p.life;
        p.w.y += dt * (p.ember ? 0.9 : 0.45);
        p.w.x += Math.sin(p.sw + p.t * 3) * dt * 0.08; p.w.z += Math.cos(p.sw + p.t * 3) * dt * 0.08;
        _v.copy(p.w).applyMatrix4(inv);
        pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z;
        aA[i * 3] = (p.born ? Math.sin(Math.PI * u) : 0) * k * (p.ember ? 1 : 0.4);
        aA[i * 3 + 1] = p.size * (p.ember ? 1 - u * 0.5 : 0.7 + u * 0.8);
        aA[i * 3 + 2] = p.ember;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}
