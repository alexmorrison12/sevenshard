// Shockwaves: expanding ground rings (bright leading edge, dark "pressure" band behind it for a distortion-like
// read, soft trailing wash, noise break-up) and vertical ring walls (energy curtains that rise and fade as they
// expand). One instanced draw call per style; fully analytic after spawn.
import * as THREE from 'three';
import { PREMUL, GLSL_NOISE, GLSL_GROUND, queueRange, SlotTimes } from './util.js';

export const RSTRIDE = 16;
const RING_VERT = /* glsl */`
attribute vec4 r0; attribute vec4 r1; attribute vec4 r2; attribute vec4 r3;
uniform float uFxTime;
varying float vX; varying float vAng; varying float vT; varying vec4 vR1; varying vec4 vR2; varying vec4 vR3; varying float vRad;
${GLSL_GROUND}
void main() {
  float age = uFxTime - r0.w, dur = max(r1.y, 1e-3), T = age / dur;
  if (age < 0.0 || T > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float R = r1.x, ew = r1.z, trail = r2.w, p = max(r3.x, 1.0);
  float rad = r3.y + (R - r3.y) * (1.0 - pow(max(1.0 - T, 0.0), p));
  float row = position.y;
  float off = row < 0.5 ? -trail : row < 1.5 ? -ew * 3.5 : row < 2.5 ? 0.0 : ew * 2.5;
  float rr = max(rad + off * (0.35 + 0.65 * min(1.0, rad / max(R * 0.25, 0.01))), 0.0);
  float a = position.x * 6.2831853;
  vec2 xz = r0.xz + vec2(cos(a), sin(a)) * rr;
  float y = groundH(xz, r0.y) + 0.06;
  vX = rr - rad; vAng = position.x; vT = T; vR1 = r1; vR2 = r2; vR3 = r3; vRad = rad;
  gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, y, xz.y, 1.0);
}`;
const RING_FRAG = /* glsl */`
uniform float uFxTime;
varying float vX; varying float vAng; varying float vT; varying vec4 vR1; varying vec4 vR2; varying vec4 vR3; varying float vRad;
${GLSL_NOISE}
void main() {
  float ew = vR1.z, trail = vR2.w, T = vT;
  int flags = int(vR3.w + 0.5);
  float x = vX;
  float circ = vAng * 6.2831853 * max(vRad, 0.5);
  float n = fbm2(vec2(circ * 0.45, T * 3.0 + vR3.z * 10.0));
  float edge = exp(-x * x / (ew * ew)) * (0.65 + 0.7 * n);
  float wash = x < 0.0 ? smoothstep(-trail, 0.0, x) * (0.25 + 0.5 * smoothstep(0.35, 0.8, n)) : 0.0;
  float press = exp(-sq((x + ew * 2.2) / (ew * 1.3)));
  float life = pow(max(1.0 - T, 0.0), 1.3) * smoothstep(0.0, 0.04, T);
  vec3 C = vR2.rgb;
  float pk = max(max(C.r, C.g), C.b);
  vec3 Cb = C / max(pk, 1e-3) * min(pk, 1.25);
  vec3 rgb = (Cb * (edge * 1.15 + wash * 0.35) + C * pow(max(edge, 0.0), 4.0) * 0.35) * life;
  float a = (flags & 1) != 0 ? press * 0.35 * life : 0.0;
  gl_FragColor = vec4(rgb, a) * (1.0 - vR1.w);
}`;
const WALL_VERT = /* glsl */`
attribute vec4 r0; attribute vec4 r1; attribute vec4 r2; attribute vec4 r3;
uniform float uFxTime;
varying vec2 vUv; varying float vT; varying vec4 vR2; varying vec4 vR3; varying float vRad; varying float vDim;
${GLSL_GROUND}
void main() {
  float age = uFxTime - r0.w, dur = max(r1.y, 1e-3), T = age / dur;
  if (age < 0.0 || T > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float R = r1.x, p = max(r3.x, 1.0), H = r2.w;
  float rad = r3.y + (R - r3.y) * (1.0 - pow(max(1.0 - T, 0.0), p));
  float a = position.x * 6.2831853;
  float v = position.y;
  float h = H * (0.35 + 0.65 * smoothstep(0.0, 0.25, T)) * (1.0 - 0.4 * T);
  vec2 xz = r0.xz + vec2(cos(a), sin(a)) * rad * (1.0 + v * 0.08 * r1.z);
  float y = groundH(r0.xz, r0.y) + v * h;
  vUv = vec2(position.x, v); vT = T; vR2 = r2; vR3 = r3; vRad = rad; vDim = 1.0 - r1.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, y, xz.y, 1.0);
}`;
const WALL_FRAG = /* glsl */`
uniform float uFxTime;
varying vec2 vUv; varying float vT; varying vec4 vR2; varying vec4 vR3; varying float vRad; varying float vDim;
${GLSL_NOISE}
void main() {
  float v = vUv.y, T = vT;
  float circ = vUv.x * 6.2831853 * max(vRad, 0.5);
  float n = fbm2(vec2(circ * 0.6, v * 2.5 - T * 5.0 + vR3.z * 9.0));
  float body = pow(max(1.0 - v, 0.0), 1.6) * smoothstep(0.0, 0.08, v);
  float streak = smoothstep(0.35, 0.85, n);
  float life = pow(max(1.0 - T, 0.0), 1.6) * smoothstep(0.0, 0.05, T);
  vec3 C = vR2.rgb;
  float a = body * (0.3 + 0.7 * streak) * life;
  float pk = max(max(C.r, C.g), C.b);
  vec3 Cb = C / max(pk, 1e-3) * min(pk, 1.2);
  gl_FragColor = vec4(Cb * a + Cb * pow(max(body, 0.0), 6.0) * streak * life * 0.3, 0.0) * vDim;
}`;

function annulusGeo(seg, rows) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = [], idx = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i <= seg; i++) pos.push(i / seg, j, 0);
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
function wallGeo(seg, rows) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) pos.push(i / seg, j / rows, 0);
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

class RingPool {
  constructor(fx, n, geo, vert, frag, order, name) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * RSTRIDE);
    for (let i = 0; i < n; i++) this.data[i * RSTRIDE + 3] = -1e9;
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, RSTRIDE, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < 4; k++) geo.setAttribute('r' + k, new THREE.InterleavedBufferAttribute(this.buf, 4, k * 4));
    geo.instanceCount = n; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const u = fx.u;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, ...PREMUL, depthTest: true, side: THREE.DoubleSide,
      uniforms: { uFxTime: u.uFxTime, uHeightTex: u.uHeightTex, uHeightInfo: u.uHeightInfo, uHasHeight: u.uHasHeight, uGroundY: u.uGroundY },
    });
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.name = name;
    this.slots = new SlotTimes(n); this.until = -1; this.lo = n; this.hi = -1;
  }
  spawn(x, y, z, R, dur, ew, col, hOrTrail, ease, r0, flags, delay) {
    const s = this.slots.take(this.fx.time);
    const d = this.data, b = s * RSTRIDE, t0 = this.fx.time + delay;
    this.slots.end[s] = t0 + dur;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = t0;
    d[b + 4] = R; d[b + 5] = dur; d[b + 6] = ew; d[b + 7] = 1 - this.fx.dimK;
    d[b + 8] = col[0]; d[b + 9] = col[1]; d[b + 10] = col[2]; d[b + 11] = hOrTrail;
    d[b + 12] = ease; d[b + 13] = r0; d[b + 14] = Math.random(); d[b + 15] = flags;
    if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s;
    if (t0 + dur > this.until) this.until = t0 + dur;
    return s;
  }
  update() {
    if (this.hi >= this.lo) {
      queueRange(this.buf, this.lo * RSTRIDE, (this.hi - this.lo + 1) * RSTRIDE);
      this.lo = this.n; this.hi = -1;
    }
    this.geo.instanceCount = this.slots.count(this.fx.time);
    this.mesh.visible = this.fx.time <= this.until;
  }
  reset() { for (let i = 0; i < this.n; i++) this.data[i * RSTRIDE + 3] = -1e9; this.lo = 0; this.hi = this.n - 1; this.until = -1; this.slots.reset(); this.geo.instanceCount = 0; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class Rings {
  constructor(fx) {
    this.fx = fx;
    this.ring = new RingPool(fx, 96, annulusGeo(128, 4), RING_VERT, RING_FRAG, 5, 'fx-rings');
    this.wall = new RingPool(fx, 48, wallGeo(96, 6), WALL_VERT, WALL_FRAG, 25, 'fx-ringwalls');
  }
  get meshes() { return [this.ring.mesh, this.wall.mesh]; }
  /** flat ground ring. ew: edge width (m), trail: wash length behind the front (m), flags 1 = pressure band */
  ground(p, R, dur, col, { ew = 0.22, trail = 1.6, ease = 3, r0 = 0, flags = 1, delay = 0 } = {}) {
    return this.ring.spawn(p.x, p.y, p.z, R, dur, ew, col, trail, ease, r0, flags, delay);
  }
  /** vertical ring wall of height h */
  walls(p, R, dur, col, { h = 1.6, ease = 3, r0 = 0, flare = 1, delay = 0 } = {}) {
    return this.wall.spawn(p.x, p.y, p.z, R, dur, flare, col, h, ease, r0, 0, delay);
  }
  update() { this.ring.update(); this.wall.update(); }
  reset() { this.ring.reset(); this.wall.reset(); }
  dispose() { this.ring.dispose(); this.wall.dispose(); }
}
