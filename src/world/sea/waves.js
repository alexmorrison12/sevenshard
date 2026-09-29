// Stylised ocean swell shared by every water surface that moves: a sum of Gerstner waves (GPU) with an exact CPU mirror
// for the vertical part, so ships, flotsam and serpents bob on the very waves you see. Storm cells (up to 4 circles)
// and a global storm level raise the swell, sharpen the crests and whip up whitecaps.
//
//   const W = new Waves({ storms, base })        // one per zone; the uniforms object is shared by all its materials
//   W.uniforms                                   // { uWA, uWB, uStorm, uStormBase, uWind } → merge into ShaderMaterial uniforms
//   WAVES_GLSL                                   // `float stormAt(vec2)` + `vec3 waveDisp(vec2 p, float t, float storm, out vec3 N, out float J)`
//   W.height(x, z, t) / W.storm(x, z) / W.tilt(x, z, t, heading, len, beam) → { y, pitch, roll }
import * as THREE from 'three';

export const NW = 5;
// direction (x, z), wavelength (m), amplitude (m), steepness share, speed multiplier
const BASE = [
  [0.82, 0.57, 44, 0.44, 0.62, 1.0],
  [0.28, 0.96, 26, 0.27, 0.66, 1.0],
  [-0.62, 0.78, 14.5, 0.12, 0.7, 1.0],
  [0.96, -0.28, 8.2, 0.055, 0.72, 1.0],
  [-0.35, -0.94, 4.6, 0.03, 0.62, 1.0],
];
const G = 9.81;

export const WAVES_GLSL = /* glsl */`
uniform vec4 uWA[${NW}];   // dir.x, dir.z, k, amplitude
uniform vec4 uWB[${NW}];   // steepness share, omega, phase, 0
uniform vec4 uStorm[4];    // x, z, radius, strength (radius 0 = unused)
uniform float uStormBase;
uniform vec2 uWind;
float stormAt(vec2 p) {
  float s = uStormBase;
  for (int i = 0; i < 4; i++) {
    vec4 S = uStorm[i];
    if (S.z <= 0.0) continue;
    s = max(s, S.w * smoothstep(S.z, S.z * 0.35, length(p - S.xy)));
  }
  return s;
}
// Gerstner displacement at world p (xz), time t. N = surface normal, J = crest pinch (≈ 1 flat, < 0.5 sharp crest)
vec3 waveDisp(vec2 p, float t, float storm, out vec3 N, out float J) {
  vec3 d = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float jac = 1.0;
  float am = 1.0 + storm * 2.2;
  float sm = 1.0 + storm * 0.45;
  for (int i = 0; i < ${NW}; i++) {
    vec4 A = uWA[i]; vec4 B = uWB[i];
    float k = A.z, a = A.w * am;
    float wa = k * a;
    float q = min(B.x * sm, 1.0) / max(wa * ${NW}.0, 1e-4);
    float th = k * dot(A.xy, p) - B.y * t + B.z;
    float c = cos(th), s = sin(th);
    d.x += q * a * A.x * c; d.z += q * a * A.y * c; d.y += a * s;
    n.x -= A.x * wa * c; n.z -= A.y * wa * c; n.y -= q * wa * s;
    jac -= q * wa * s;
  }
  N = normalize(n); J = jac;
  return d;
}
`;

export class Waves {
  /** storms: [{ x, z, r, strength }] (≤ 4), base: global storm level 0..1, wind: [x, z] (unit) */
  constructor({ storms = [], base = 0, wind = [0.8, 0.6], scale = 1, seed = 0 } = {}) {
    this.def = BASE.map(([dx, dz, L, A, S, sp], i) => {
      const l = Math.hypot(dx, dz); const k = Math.PI * 2 / L;
      return { dx: dx / l, dz: dz / l, k, a: A * scale, s: S, w: Math.sqrt(G * k) * sp, ph: (i * 1.7 + seed * 0.37) % (Math.PI * 2) };
    });
    const WA = [], WB = [];
    for (const w of this.def) { WA.push(new THREE.Vector4(w.dx, w.dz, w.k, w.a)); WB.push(new THREE.Vector4(w.s, w.w, w.ph, 0)); }
    const ST = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0));
    this.uniforms = { uWA: { value: WA }, uWB: { value: WB }, uStorm: { value: ST }, uStormBase: { value: base }, uWind: { value: new THREE.Vector2(wind[0], wind[1]).normalize() } };
    this.storms = [];
    this.setStorms(storms);
  }
  /** [{ x, z, r, strength }] — call whenever a storm moves (cheap) */
  setStorms(list) {
    this.storms = list.slice(0, 4);
    const ST = this.uniforms.uStorm.value;
    for (let i = 0; i < 4; i++) { const s = this.storms[i]; if (s) ST[i].set(s.x, s.z, s.r, s.strength ?? 1); else ST[i].set(0, 0, 0, 0); }
  }
  set base(v) { this.uniforms.uStormBase.value = v; }
  get base() { return this.uniforms.uStormBase.value; }
  get wind() { return this.uniforms.uWind.value; }
  /** storm level 0..1 at (x, z) (same as the shader) */
  storm(x, z) {
    let s = this.uniforms.uStormBase.value;
    for (const S of this.storms) {
      if (!(S.r > 0)) continue;
      const d = Math.hypot(x - S.x, z - S.z), a = S.r, b = S.r * 0.35;
      const t = Math.min(1, Math.max(0, (d - a) / (b - a)));
      s = Math.max(s, (S.strength ?? 1) * t * t * (3 - 2 * t));
    }
    return s;
  }
  /** vertical displacement at (x, z) — matches the shader's y (ignores the small horizontal Gerstner shift) */
  height(x, z, t, storm = this.storm(x, z)) {
    const am = 1 + storm * 2.2;
    let y = 0;
    for (const w of this.def) y += w.a * am * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
    return y;
  }
  /**
   * Hull attitude on the swell: samples bow/stern/port/starboard. heading = model facing (forward (−sin f, −cos f)).
   * Returns { y, pitch (bow up +), roll (starboard up + = rotation.z) } — radians.
   */
  tilt(x, z, t, heading, len = 14, beam = 4.5, out = { y: 0, pitch: 0, roll: 0 }) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading), rx = -fz, rz = fx;   // right = forward × up
    const st = this.storm(x, z);
    const hb = this.height(x + fx * len / 2, z + fz * len / 2, t, st), hs = this.height(x - fx * len / 2, z - fz * len / 2, t, st);
    const hr = this.height(x + rx * beam / 2, z + rz * beam / 2, t, st), hl = this.height(x - rx * beam / 2, z - rz * beam / 2, t, st);
    const hc = this.height(x, z, t, st);
    out.y = (hb + hs + hr + hl) * 0.125 + hc * 0.5;
    out.pitch = Math.atan2(hb - hs, len);
    out.roll = Math.atan2(hr - hl, beam);
    return out;
  }
}
