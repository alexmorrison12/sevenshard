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
      const root = V(sg * 0.056 * s, 0.176 * s, -0.026 * s);
      const pts = [root.clone()];
      const len = 0.27 * s, n = 16;
      const p = root.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n, th = 0.4 + 1.3 * t - 0.5 * t * t;          // sweep from mostly-up to back
        const dir = V(sg * (0.42 - 0.18 * t), Math.cos(th), Math.sin(th)).normalize();
        p.addScaledVector(dir, len / n); pts.push(p.clone());
      }
      hornTube(pb, pts, 0.03 * s);
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

/** dark aura: an inflated, fresnel-faded, gently rippling copy of the skinned body (shares geometry & skeleton) */
export function makeAuraMaterial() {
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a0624, transparent: true, depthWrite: false });
  const u = { uPush: { value: 0.03 }, uAura: { value: 0 }, uTime: { value: 0 } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPush; uniform float uTime; varying vec3 vNv; varying vec3 vVv; varying float vW;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        float wob = sin(uTime * 3.1 + position.y * 11.0 + position.x * 6.0) * 0.5 + 0.5;
        float lick = smoothstep(0.9, 1.9, position.y) * (sin(uTime * 5.3 + position.x * 23.0 + position.z * 17.0) * 0.5 + 0.5);
        vW = wob;
        #ifdef USE_SKINNING
        transformed += normalize(objectNormal) * uPush * (0.65 + 0.7 * wob) + vec3(0.0, lick * uPush * 1.6, 0.0);
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_SKINNING
        vNv = normalize(normalMatrix * objectNormal);
        #else
        vNv = vec3(0.0, 0.0, 1.0);
        #endif
        vVv = -mvPosition.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAura; uniform float uTime; varying vec3 vNv; varying vec3 vVv; varying float vW;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `float fr = pow(1.0 - abs(dot(normalize(vNv), normalize(vVv))), 1.5);
        vec3 ac = mix(diffuse, vec3(0.62, 0.1, 0.85), fr * fr);
        vec4 diffuseColor = vec4(ac * (0.7 + 0.9 * fr), clamp(fr * uAura * (0.7 + 0.45 * vW), 0.0, 0.8));`);
  };
  mat.customProgramCacheKey = () => 'hero-aura';
  return mat;
}
