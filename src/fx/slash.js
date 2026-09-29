// Mesh slash arcs: thick crescent ribbons (bright white-hot blade edge, coloured body with scrolling streak noise,
// soft inner edge, sweeping reveal, noise dissolve), all slashes in ONE instanced draw call. Each instance is a
// 64×4 strip bent around a pivot in an arbitrary plane (basis A, B). When that plane is seen edge-on (vertical
// slashes from the iso camera) the strip expands toward the camera instead, so a vertical cut still reads as a
// bold curved stroke. A velocity turns a slash into a travelling wave (Strike Wave, Crimson Wave, wind blades).
import * as THREE from 'three';
import { PREMUL, GLSL_NOISE } from './util.js';

export const SSTRIDE = 24;
const VERT = /* glsl */`
attribute vec4 s0; attribute vec4 s1; attribute vec4 s2; attribute vec4 s3; attribute vec4 s4; attribute vec4 s5;
uniform float uFxTime;
varying vec2 vUv; varying float vT; varying vec4 vC; varying vec4 vX; varying float vLen;
void main() {
  float age = uFxTime - s0.w, dur = max(s3.w, 1e-3), T = age / dur;
  if (age < 0.0 || T > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float u = position.x, v = position.y;
  vec3 A = s1.xyz, B = s2.xyz;
  float R = s1.w, arc = s2.w, W = s4.w;
  int flags = int(s5.w + 0.5);
  float grow = 1.0 + s5.y * (1.0 - (1.0 - T) * (1.0 - T));
  float prof = pow(max(sin(3.14159 * clamp(u * 0.94 + 0.03, 0.0, 1.0)), 0.0), 0.6) * mix(0.55, 1.0, smoothstep(0.0, 0.7, u));
  float th = W * prof * mix(1.0, 0.8, T);
  vec3 c = s0.xyz + s4.xyz * age;
  vec3 pos, radial, tang;
  if ((flags & 1) != 0) {            // straight thrust: along A, width along B
    radial = B; tang = A;
    pos = c + A * (u * R * grow);
    radial = normalize(cross(A, normalize(cameraPosition - pos)));
    pos += radial * (v - 0.5) * th * 2.0;
  } else {
    float th0 = u * arc;
    radial = A * cos(th0) + B * sin(th0);
    tang = -A * sin(th0) + B * cos(th0);
    float Rt = R * grow;
    vec3 on = c + radial * Rt;
    vec3 N = normalize(cross(A, B));
    vec3 vd = normalize(cameraPosition - on);
    float facing = abs(dot(N, vd));
    vec3 E = normalize(cross(tang, vd));
    if (dot(E, radial) < 0.0) E = -E;
    vec3 ex = (flags & 4) != 0 ? radial : normalize(mix(E, radial, smoothstep(0.12, 0.45, facing)));
    pos = on - ex * (1.0 - v) * th;
  }
  vUv = vec2(u, v); vT = T; vC = s3; vX = s5; vLen = arc * R;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;
const FRAG = /* glsl */`
uniform float uFxTime;
varying vec2 vUv; varying float vT; varying vec4 vC; varying vec4 vX; varying float vLen;
${GLSL_NOISE}
void main() {
  float u = vUv.x, v = vUv.y, T = vT;
  float sweep = max(vX.x, 0.01);
  int flags = int(vX.w + 0.5);
  float head = clamp(T / sweep, 0.0, 1.0);
  float hs = 0.04 + 0.06 * (1.0 - head);
  float reveal = 1.0 - smoothstep(head - hs, head + 0.01, u);
  if (head >= 1.0) reveal = 1.0;
  float ed = 1.0 - v;                                   // 0 at the blade (outer) edge
  float age = T * vC.w;
  float n = fbm2(vec2(u * vLen * 0.55 - age * 7.0, ed * 2.6 + vX.z * 13.0));
  float n2 = vn2(vec2(u * vLen * 1.7 - age * 11.0, ed * 6.0 + vX.z * 7.0));
  float core = exp(-ed * ed / 0.018);
  float body = pow(max(1.0 - ed, 0.0), 1.35);
  float streak = smoothstep(0.25, 0.85, n) * 0.7 + n2 * 0.3;
  float ends = smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.9, u);
  // dissolve: tail first, noisy
  float dp = clamp((T - sweep * 0.7) / max(1.0 - sweep * 0.7, 0.05), 0.0, 1.0);
  float keep = smoothstep(dp * 1.25 - 0.12, dp * 1.25, n * 0.45 + u * 0.55 + (1.0 - ed) * 0.1);
  float headGlow = exp(-sq((u - head) * vLen / 0.7)) * step(head, 0.999);
  float a = (body * (0.35 + 0.65 * streak) + core * 0.9) * reveal * ends * keep;
  a *= 1.0 - smoothstep(0.82, 1.0, T) * 0.6;
  vec3 C = vC.rgb;
  vec3 hot = vec3(1.0) + C * 0.25;
  vec3 rgb = C * a * (0.55 + 0.9 * streak) + hot * (core * a * 1.4 + headGlow * reveal * ends * 1.8 * (1.0 - T));
  if ((flags & 2) != 0) {             // dark slash: black body occludes, coloured rim glows
    float dk = body * (0.5 + 0.5 * streak) * reveal * ends * keep * (1.0 - smoothstep(0.7, 1.0, T));
    gl_FragColor = vec4(C * (core * 1.6 + streak * body * 0.35) * reveal * ends * keep + C * headGlow * 2.0 * reveal, dk * 0.85);
    return;
  }
  gl_FragColor = vec4(rgb, 0.0);
}`;

function stripGeo(nu, nv) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(i / nu, j / nv, 0);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class Slashes {
  constructor(fx, n = 160) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * SSTRIDE);
    for (let i = 0; i < n; i++) this.data[i * SSTRIDE + 3] = -1e9;
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, SSTRIDE, 1);
    this.buf.setUsage(THREE.DynamicDrawUsage);
    const g = stripGeo(64, 4);
    for (let k = 0; k < 6; k++) g.setAttribute('s' + k, new THREE.InterleavedBufferAttribute(this.buf, 4, k * 4));
    g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uFxTime: fx.u.uFxTime }, ...PREMUL, depthTest: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 24; this.mesh.name = 'fx-slashes';
    this.head = 0; this.until = -1;
    this.lo = n; this.hi = -1;
  }
  /**
   * Write one arc. c pivot (Vector3), A/B plane basis (unit Vector3s: arc starts along A, sweeps toward B), R outer
   * radius, arc (rad), W thickness, col [r,g,b] HDR, dur, sweep (fraction of dur for the reveal), grow, vel (Vector3 or
   * null), flags (1 straight, 2 dark, 4 flat), delay.
   */
  spawn(c, A, B, R, arc, W, col, dur, sweep, grow, vel, flags, delay = 0) {
    const s = this.head; this.head = (this.head + 1) % this.n;
    const d = this.data, b = s * SSTRIDE, t0 = this.fx.time + delay;
    d[b] = c.x; d[b + 1] = c.y; d[b + 2] = c.z; d[b + 3] = t0;
    d[b + 4] = A.x; d[b + 5] = A.y; d[b + 6] = A.z; d[b + 7] = R;
    d[b + 8] = B.x; d[b + 9] = B.y; d[b + 10] = B.z; d[b + 11] = arc;
    d[b + 12] = col[0]; d[b + 13] = col[1]; d[b + 14] = col[2]; d[b + 15] = dur;
    d[b + 16] = vel ? vel.x : 0; d[b + 17] = vel ? vel.y : 0; d[b + 18] = vel ? vel.z : 0; d[b + 19] = W;
    d[b + 20] = sweep; d[b + 21] = grow; d[b + 22] = Math.random(); d[b + 23] = flags;
    if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s;
    if (t0 + dur > this.until) this.until = t0 + dur;
    return s;
  }
  update() {
    if (this.hi >= this.lo) {
      this.buf.clearUpdateRanges();
      this.buf.addUpdateRange(this.lo * SSTRIDE, (this.hi - this.lo + 1) * SSTRIDE);
      this.buf.needsUpdate = true;
      this.lo = this.n; this.hi = -1;
    }
    this.mesh.visible = this.fx.time <= this.until;
  }
  reset() { for (let i = 0; i < this.n; i++) this.data[i * SSTRIDE + 3] = -1e9; this.lo = 0; this.hi = this.n - 1; this.until = -1; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
