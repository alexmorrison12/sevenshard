// 3D FX meshes, all instanced (one draw call per kind):
//   rocks     GPU-analytic debris: ballistic arcs that land on the ground (terrain height) and cool (lava cracks glow)
//   crystals  GPU-analytic crystal spikes: erupt from the ground and sink (ice spikes, blood/earth spikes), or fly as
//             spinning shards (part breaks, ice shatter) — per-instance colour, glow and fresnel
//   bubbles   fresnel hex shield spheres (follow their target on the CPU; pop on stop)
//   pillars   volumetric-looking energy cylinders (light pillars, loot beams, blood pillars, tornado columns)
//   portals   swirling vortex discs (vertical or flat)
//   props     CPU-posed solid/emissive meshes: spinning glaive, meteor rock, grenade, ice lance, giant light sword, orbs
import * as THREE from 'three';
import { G } from '../engine/materials.js';
import { PREMUL, GLSL_NOISE, GLSL_GROUND, queueRange, queueAll } from './util.js';

const DEF_TINT = [1, 0.5, 0.2];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _fwd = new THREE.Vector3(0, 0, -1), _y = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ geometry
function faceted(g) { if (g.index) g = g.toNonIndexed(); g.computeVertexNormals(); return g; }
function spikeGeo() { // faceted crystal, base at y=0, tip at y=1.35
  const pts = [new THREE.Vector2(0, -0.1), new THREE.Vector2(0.24, 0.02), new THREE.Vector2(0.28, 0.5), new THREE.Vector2(0.16, 1.0), new THREE.Vector2(0, 1.35)];
  return faceted(new THREE.LatheGeometry(pts, 5));
}
function rockGeo(r = 0.28, seed = 4.1) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = seen.get(k); if (f === undefined) { f = 0.75 + Math.abs(Math.sin(i * 12.9898 + seed)) * 0.5; seen.set(k, f); }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
  }
  return faceted(g);
}
function meteorGeo() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let f = seen.get(k);
    if (f === undefined) { f = 0.82 + 0.18 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.2 - y) + 0.08 * Math.sin(x * 13 + z * 11); seen.set(k, f); }
    p.setXYZ(i, x * f, y * f, z * f);
  }
  return faceted(g);
}
function glaiveGeo() { // flat 4-bladed demonic throwing glaive in the XZ plane
  const shape = new THREE.Shape();
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const p0 = [Math.cos(a) * 0.22, Math.sin(a) * 0.22], tip = [Math.cos(a + 0.5) * 1.0, Math.sin(a + 0.5) * 1.0], p1 = [Math.cos(a + Math.PI / 2) * 0.22, Math.sin(a + Math.PI / 2) * 0.22];
    const ctl = [Math.cos(a + 0.9) * 0.75, Math.sin(a + 0.9) * 0.75];
    if (i === 0) shape.moveTo(p0[0], p0[1]);
    shape.lineTo(tip[0], tip[1]);
    shape.quadraticCurveTo(ctl[0], ctl[1], p1[0], p1[1]);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.04, 0);
  return g;
}
function swordGeo() { // giant sword pointing DOWN (tip at y=0), length 1
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.07, 0.1); s.lineTo(0.06, 0.72); s.lineTo(0.2, 0.74); s.lineTo(0.2, 0.78); s.lineTo(0.035, 0.79);
  s.lineTo(0.035, 0.95); s.lineTo(0.06, 0.98); s.lineTo(0, 1.02); s.lineTo(-0.06, 0.98); s.lineTo(-0.035, 0.95); s.lineTo(-0.035, 0.79);
  s.lineTo(-0.2, 0.78); s.lineTo(-0.2, 0.74); s.lineTo(-0.06, 0.72); s.lineTo(-0.07, 0.1); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 1 });
  g.translate(0, 0, -0.01);
  return g;
}
function lanceGeo() { // long double-pointed ice lance along -Z
  const pts = [new THREE.Vector2(0, -1.1), new THREE.Vector2(0.14, -0.4), new THREE.Vector2(0.12, 0.5), new THREE.Vector2(0, 1.0)];
  const g = new THREE.LatheGeometry(pts, 6); g.rotateX(-Math.PI / 2);
  return faceted(g);
}

// ------------------------------------------------------------------ GPU pools (rocks, crystals)
const MSTRIDE = 24;
const POOL_VERT = /* glsl */`
attribute vec4 iP; attribute vec4 iV; attribute vec4 iR; attribute vec4 iS; attribute vec4 iC; attribute vec4 iX;
uniform float uFxTime;
varying vec3 vN; varying vec3 vW; varying float vHeat; varying vec3 vLocal; varying vec4 vC; varying vec4 vX;
${GLSL_GROUND}
mat3 eul(vec3 e) {
  float cx = cos(e.x), sx = sin(e.x), cy = cos(e.y), sy = sin(e.y), cz = cos(e.z), sz = sin(e.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return ry * rx * rz;
}
void main() {
  float age = uFxTime - iP.w, life = iV.w, killed = uFxTime - iS.w;
  if (age < 0.0 || age > life || killed > 0.35) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 p = position * iS.x; mat3 R; vec3 pos;
  int mode = int(iS.y + 0.5);
  if (mode == 0) {                                  // debris: ballistic, lands on the ground and stops
    float g = iS.z, vy = iV.y, y0 = iP.y;
    float gy = groundH(iP.xz + iV.xz * 0.5, iC.w) + 0.1 * iS.x;
    float disc = vy * vy - 2.0 * g * (y0 - gy);
    float tl = disc > 0.0 ? (-vy - sqrt(disc)) / g : life;
    if (tl < 0.0) tl = life;
    float ta = min(age, tl);
    pos = iP.xyz + iV.xyz * ta + vec3(0.0, 0.5 * g * ta * ta, 0.0);
    R = eul(iR.xyz + vec3(1.0, 0.63, 0.37) * iR.w * ta);
    p *= 1.0 - smoothstep(0.72, 1.0, age / life);
    vHeat = 1.0 - smoothstep(0.0, life * 0.85, age);
  } else if (mode == 1) {                           // spike: erupts from the ground, then sinks / shatters
    R = eul(iR.xyz);
    float grow = smoothstep(0.0, 0.09, age);
    float gone = max(smoothstep(life - 0.35, life, age), smoothstep(0.0, 0.3, killed));
    float h = grow * (1.0 - gone);
    p.y *= h; p.xz *= mix(0.5, 1.0, h);
    pos = iP.xyz;
    vHeat = (1.0 - smoothstep(0.0, 0.3, age));
  } else {                                          // shard: ballistic spin, no landing, shrinks away
    float g = iS.z;
    pos = iP.xyz + iV.xyz * age + vec3(0.0, 0.5 * g * age * age, 0.0);
    R = eul(iR.xyz + vec3(1.0, 0.63, 0.37) * iR.w * age);
    p *= 1.0 - smoothstep(0.6, 1.0, age / life);
    vHeat = 1.0 - smoothstep(0.0, 0.4, age);
  }
  vec3 wp = pos + R * p;
  vN = R * normal; vW = wp; vLocal = position; vC = iC; vX = iX;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const ROCK_FRAG = /* glsl */`
uniform vec3 uLight; uniform vec3 uSunDir; uniform float uDesat;
varying vec3 vN; varying vec3 vW; varying float vHeat; varying vec3 vLocal; varying vec4 vC; varying vec4 vX;
${GLSL_NOISE}
float vn3(vec3 p) { return vn2(p.xy + p.z * 1.7); }
void main() {
  vec3 n = normalize(vN);
  float wrap = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  vec3 col = vC.rgb * (0.3 + 0.7 * wrap) * uLight;
  float c = vn3(vLocal * 9.0) * 0.6 + vn3(vLocal * 21.0) * 0.4;
  float crack = smoothstep(0.52, 0.66, c) * (1.0 - smoothstep(0.66, 0.8, c) * 0.4);
  col += vX.rgb * crack * vHeat * 2.2 + vX.rgb * vHeat * 0.3;
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))), uDesat);
  gl_FragColor = vec4(col, 1.0);
}`;
const CRYSTAL_FRAG = /* glsl */`
uniform vec3 uLight; uniform vec3 uSunDir; uniform float uDesat;
varying vec3 vN; varying vec3 vW; varying float vHeat; varying vec3 vLocal; varying vec4 vC; varying vec4 vX;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float wrap = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float fres = pow(max(1.0 - abs(dot(n, v)), 0.0), 2.2);
  vec3 col = vC.rgb * (0.42 + 0.5 * wrap) * (0.55 + 0.45 * uLight);
  col += vX.rgb * fres * vX.w;
  col += vX.rgb * smoothstep(0.6, 1.0, vLocal.y / 1.3) * 0.45;
  col += vX.rgb * vHeat * 0.7;
  float glint = pow(max(dot(reflect(-uSunDir, n), v), 0.0), 40.0);
  col += vec3(1.4) * glint;
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))), uDesat);
  gl_FragColor = vec4(col, 1.0);
}`;

class MeshPool {
  constructor(fx, geo, frag, n, name) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * MSTRIDE);
    for (let i = 0; i < n; i++) { this.data[i * MSTRIDE + 3] = -1e9; this.data[i * MSTRIDE + 7] = 1; this.data[i * MSTRIDE + 15] = 1e9; }
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, MSTRIDE, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.InstancedBufferGeometry();
    g.index = geo.index; g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
    ['iP', 'iV', 'iR', 'iS', 'iC', 'iX'].forEach((a, i) => g.setAttribute(a, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const u = fx.u;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT, fragmentShader: frag,
      uniforms: { uFxTime: u.uFxTime, uLight: u.uLight, uSunDir: G.uSunDir, uDesat: G.uDesat, uHeightTex: u.uHeightTex, uHeightInfo: u.uHeightInfo, uHasHeight: u.uHasHeight, uGroundY: u.uGroundY },
    });
    this.geo = g;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.name = name; this.mesh.castShadow = false;
    this.head = 0; this.until = -1; this.lo = n; this.hi = -1;
    this.heldFree = [];      // slots reserved by handles (killed via kill())
  }
  /** mode 0 debris / 1 spike / 2 shard. c: [r,g,b] base colour, gl: [r,g,b] glow colour, fres: fresnel strength */
  spawn(delay, x, y, z, vx, vy, vz, life, rx, ry, rz, spin, scale, mode, grav, c, gl, fres, gy) {
    const s = this.head; this.head = (this.head + 1) % this.n;
    const d = this.data, b = s * MSTRIDE, t0 = this.fx.time + delay;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = t0;
    d[b + 4] = vx; d[b + 5] = vy; d[b + 6] = vz; d[b + 7] = life;
    d[b + 8] = rx; d[b + 9] = ry; d[b + 10] = rz; d[b + 11] = spin;
    d[b + 12] = scale; d[b + 13] = mode; d[b + 14] = grav; d[b + 15] = 1e9;
    d[b + 16] = c[0]; d[b + 17] = c[1]; d[b + 18] = c[2]; d[b + 19] = gy;
    d[b + 20] = gl[0]; d[b + 21] = gl[1]; d[b + 22] = gl[2]; d[b + 23] = fres;
    if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s;
    if (t0 + life > this.until) this.until = t0 + life;
    return s;
  }
  kill(slot) { if (slot < 0) return; this.data[slot * MSTRIDE + 15] = this.fx.time; if (slot < this.lo) this.lo = slot; if (slot > this.hi) this.hi = slot; }
  update() {
    if (this.hi >= this.lo) { queueRange(this.buf, this.lo * MSTRIDE, (this.hi - this.lo + 1) * MSTRIDE); this.lo = this.n; this.hi = -1; }
    this.mesh.visible = this.fx.time <= this.until + 0.5;
  }
  reset() { for (let i = 0; i < this.n; i++) { this.data[i * MSTRIDE + 3] = -1e9; this.data[i * MSTRIDE + 15] = 1e9; } this.lo = 0; this.hi = this.n - 1; this.until = -1; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ bubbles
const BUB_VERT = /* glsl */`
attribute vec4 b0; attribute vec4 b1; attribute vec4 b2;
uniform float uFxTime;
varying vec3 vN; varying vec3 vW; varying vec3 vO; varying vec4 vB1; varying vec4 vB2;
void main() {
  if (b1.w <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float age = uFxTime - b2.x;
  float pop = age < 0.25 ? 1.0 + sin(clamp(age / 0.25, 0.0, 1.0) * 3.14159) * 0.12 : 1.0;
  vec3 wp = b0.xyz + position * b0.w * pop * b2.w;
  vW = wp; vN = normal; vO = position; vB1 = b1; vB2 = b2;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const BUB_FRAG = /* glsl */`
uniform float uFxTime;
varying vec3 vN; varying vec3 vW; varying vec3 vO; varying vec4 vB1; varying vec4 vB2;
${GLSL_NOISE}
float hexEdge(vec2 p) {
  p *= vec2(1.0, 1.1547);
  vec2 a = mod(p, vec2(1.0, 1.732)) - vec2(0.5, 0.866);
  vec2 b = mod(p + vec2(0.5, 0.866), vec2(1.0, 1.732)) - vec2(0.5, 0.866);
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  g = abs(g);
  float d = max(dot(g, vec2(0.5, 0.866)), g.x);
  return smoothstep(0.4, 0.5, d);
}
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float nv = abs(dot(n, v));
  float fres = pow(max(1.0 - nv, 0.0), 2.4);
  vec3 o = normalize(vO);
  float style = vB2.z;
  vec2 uv = vec2(atan(o.z, o.x) * 2.2, o.y * 3.4);
  float hex = style < 0.5 ? hexEdge(uv * 1.2 + vec2(0.0, uFxTime * 0.08)) : 0.0;
  float flow = vn2(o.xy * 3.0 + vec2(o.z * 2.0, uFxTime * 0.6));
  float band = smoothstep(0.0, 0.2, sin(o.y * 5.0 - uFxTime * 2.5) * 0.5 + 0.5 - 0.7);
  float a = fres * 1.2 + hex * (0.1 + 0.35 * fres) * (0.6 + 0.8 * flow) + band * 0.12 + 0.05;
  if (style > 0.5 && style < 1.5) a = fres * 1.5 + flow * 0.15 + 0.08;               // smooth (water / holy dome)
  if (style > 1.5) a = fres * 0.9 + smoothstep(0.55, 0.9, flow) * 0.35 + 0.1;        // dark void sphere rim
  float hit = vB2.y;
  a *= vB1.w * (gl_FrontFacing ? 1.0 : 0.45);
  vec3 col = vB1.rgb * a * (1.4 + hit * 2.5);
  if (style > 1.5) { gl_FragColor = vec4(vB1.rgb * fres * 2.0 * vB1.w, (0.85 - fres * 0.3) * vB1.w); return; }
  gl_FragColor = vec4(col, 0.0);
}`;

class Bubbles {
  constructor(fx, n = 48) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * 12);
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, 12, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const src = new THREE.IcosahedronGeometry(1, 4);
    const g = new THREE.InstancedBufferGeometry();
    g.index = src.index; g.setAttribute('position', src.attributes.position); g.setAttribute('normal', src.attributes.normal);
    ['b0', 'b1', 'b2'].forEach((a, i) => g.setAttribute(a, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: BUB_VERT, fragmentShader: BUB_FRAG, uniforms: { uFxTime: fx.u.uFxTime }, ...PREMUL, side: THREE.DoubleSide, depthTest: true });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 18; this.mesh.name = 'fx-bubbles';
    this.used = new Uint8Array(n); this.hi = 0;
  }
  alloc() { for (let i = 0; i < this.n; i++) if (!this.used[i]) { this.used[i] = 1; if (i + 1 > this.hi) this.hi = i + 1; this.geo.instanceCount = this.hi; const b = i * 12; this.data[b + 8] = this.fx.time; this.data[b + 11] = 1; return i; } return -1; }
  set(i, x, y, z, R, c, a, hit = 0, style = 0, squash = 1) {
    if (i < 0) return;
    const d = this.data, b = i * 12;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = R;
    d[b + 4] = c[0]; d[b + 5] = c[1]; d[b + 6] = c[2]; d[b + 7] = a;
    d[b + 9] = hit; d[b + 10] = style; d[b + 11] = squash;
  }
  free(i) { if (i < 0) return; this.used[i] = 0; this.data[i * 12 + 7] = 0; while (this.hi > 0 && !this.used[this.hi - 1]) this.hi--; this.geo.instanceCount = this.hi; }
  update() { if (this.hi) { queueRange(this.buf, 0, this.hi * 12); } this.mesh.visible = this.hi > 0; }
  reset() { this.used.fill(0); this.data.fill(0); this.hi = 0; this.geo.instanceCount = 0; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ pillars
const PIL_VERT = /* glsl */`
attribute vec4 p0; attribute vec4 p1; attribute vec4 p2; attribute vec4 p3;
uniform float uFxTime;
varying vec2 vUv; varying vec4 vP1; varying vec4 vP2; varying vec4 vP3; varying float vT; varying float vAge; varying float vEdge;
void main() {
  float age = uFxTime - p0.w, dur = p1.z, T = age / dur;
  float kill = uFxTime - p3.x;
  if (age < 0.0 || T > 1.0 || kill > 0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float style = p1.w;
  float a = position.x * 6.2831853, v = position.y;
  float R = p1.x, H = p1.y;
  float grow = smoothstep(0.0, max(p2.w, 0.01), age);
  float rr = R * (style > 2.5 && style < 3.5 ? mix(0.6, 1.2, v) : mix(1.0, 0.85, v)) * (0.3 + 0.7 * grow);
  if (style > 3.5) rr = R * (0.35 + v * 1.4) * (0.4 + 0.6 * grow);    // tornado funnel
  float tw = style > 3.5 ? age * 5.0 + v * 3.0 : 0.0;
  vec3 wp = p0.xyz + vec3(cos(a + tw) * rr, v * H * (style < 0.5 ? mix(0.2, 1.0, grow) : 1.0), sin(a + tw) * rr);
  vec3 N = normalize(vec3(cos(a + tw), 0.0, sin(a + tw)));
  vec3 V = normalize(cameraPosition - wp);
  vEdge = abs(dot(N, normalize(vec3(V.x, 0.0, V.z) + 1e-5)));
  vUv = vec2(position.x, v); vP1 = p1; vP2 = p2; vP3 = p3; vT = T; vAge = age;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const PIL_FRAG = /* glsl */`
uniform float uFxTime;
varying vec2 vUv; varying vec4 vP1; varying vec4 vP2; varying vec4 vP3; varying float vT; varying float vAge; varying float vEdge;
${GLSL_NOISE}
void main() {
  float style = vP1.w, v = vUv.y, T = vT;
  float kill = uFxTime - vP3.x;
  float life = smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.7, 1.0, T)) * (kill > 0.0 ? 1.0 - smoothstep(0.0, 0.5, kill) : 1.0) * vP3.y;
  float circ = vUv.x * 6.2831853;
  float n = fbm2(vec2(circ * 1.3, v * 4.0 - uFxTime * 2.5 + vP3.z * 5.0));
  float core = pow(max(vEdge, 0.0), 2.5);                   // bright at the centre line of the column (facing the camera)
  float rim = pow(max(1.0 - vEdge, 0.0), 3.0);
  vec3 C = vP2.rgb;
  float a; vec3 rgb;
  if (style < 0.5) {                              // light pillar: soft fade at the top, streaks rising
    float vf = smoothstep(0.0, 0.05, v) * pow(max(1.0 - v, 0.0), 1.2);
    a = vf * (0.28 * core + 0.1 + 0.35 * smoothstep(0.4, 0.9, n) * core);
    rgb = C * a * 1.1 + C * pow(max(core, 0.0), 5.0) * vf * 0.35;
  } else if (style < 1.5) {                       // loot beam: tall, thin, pulsing, fades high up
    float vf = smoothstep(0.0, 0.03, v) * pow(max(1.0 - v, 0.0), 1.8);
    float pulse = 0.8 + 0.2 * sin(uFxTime * 3.0 + v * 6.0);
    a = vf * (0.25 + 0.75 * core) * pulse;
    rgb = C * a * 1.3 + C * pow(max(core, 0.0), 6.0) * vf * 0.9;
  } else if (style < 2.5) {                       // blood / dark pillar: dense, dark core with red rim glow
    float vf = smoothstep(0.0, 0.04, v) * smoothstep(1.0, 0.75, v);
    a = vf * (0.55 + 0.35 * n);
    gl_FragColor = vec4(C * (rim * 1.6 + smoothstep(0.55, 0.85, n) * 0.8) * vf * life, a * 0.9 * life);
    return;
  } else if (style < 3.5) {                       // energy column (lightning / arcane): streaky, bright
    float vf = smoothstep(0.0, 0.04, v) * smoothstep(1.0, 0.8, v);
    float s = smoothstep(0.5, 0.9, n);
    a = vf * (0.2 + 0.8 * s) * (0.5 + 0.5 * core);
    rgb = C * a * 1.6 + vec3(1.0) * s * core * vf * 0.4;
  } else {                                        // tornado: alpha-blended dusty funnel
    float vf = smoothstep(0.0, 0.1, v) * smoothstep(1.0, 0.7, v);
    float s = smoothstep(0.3, 0.8, fbm2(vec2(circ * 2.0 + v * 3.0, v * 3.0 - uFxTime * 3.0)));
    a = vf * (0.25 + 0.5 * s);
    gl_FragColor = vec4(C * (0.5 + 0.5 * s) * a * life, a * 0.8 * life);
    return;
  }
  gl_FragColor = vec4(rgb * life, 0.0);
}`;
class Pillars {
  constructor(fx, n = 64) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) { this.data[i * 16 + 3] = -1e9; this.data[i * 16 + 6] = 1; this.data[i * 16 + 12] = 1e9; }
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, 16, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.InstancedBufferGeometry();
    const pos = [], idx = [], seg = 40, rows = 10;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) pos.push(i / seg, j / rows, 0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    ['p0', 'p1', 'p2', 'p3'].forEach((a, i) => g.setAttribute(a, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: PIL_VERT, fragmentShader: PIL_FRAG, uniforms: { uFxTime: fx.u.uFxTime }, ...PREMUL, side: THREE.DoubleSide, depthTest: true });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 27; this.mesh.name = 'fx-pillars';
    this.head = 0; this.lo = n; this.hi = -1; this.until = -1;
  }
  /** style: 0 light, 1 loot, 2 blood/dark, 3 energy, 4 tornado. dur Infinity = until kill(). */
  spawn(x, y, z, R, H, dur, style, c, growT = 0.12, inten = 1, delay = 0) {
    const s = this.head; this.head = (this.head + 1) % this.n;
    const d = this.data, b = s * 16, t0 = this.fx.time + delay, D = isFinite(dur) ? dur : 1e7;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = t0;
    d[b + 4] = R; d[b + 5] = H; d[b + 6] = D; d[b + 7] = style;
    d[b + 8] = c[0]; d[b + 9] = c[1]; d[b + 10] = c[2]; d[b + 11] = growT;
    d[b + 12] = 1e9; d[b + 13] = inten; d[b + 14] = Math.random(); d[b + 15] = 0;
    if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s;
    if (t0 + D > this.until) this.until = t0 + D;
    return s;
  }
  move(s, x, y, z) { const b = s * 16; this.data[b] = x; this.data[b + 1] = y; this.data[b + 2] = z; if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s; }
  kill(s) { if (s < 0) return; this.data[s * 16 + 12] = this.fx.time; if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s; }
  update() {
    if (this.hi >= this.lo) { queueRange(this.buf, this.lo * 16, (this.hi - this.lo + 1) * 16); this.lo = this.n; this.hi = -1; }
    this.mesh.visible = this.fx.time <= this.until + 1;
  }
  reset() { for (let i = 0; i < this.n; i++) { this.data[i * 16 + 3] = -1e9; this.data[i * 16 + 12] = 1e9; } this.lo = 0; this.hi = this.n - 1; this.until = -1; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ portals
const POR_VERT = /* glsl */`
attribute vec4 q0; attribute vec4 q1; attribute vec4 q2; attribute vec4 q3;
uniform float uFxTime;
varying vec2 vP; varying vec4 vQ1; varying vec4 vQ2; varying vec4 vQ3; varying float vAge;
void main() {
  float age = uFxTime - q0.w, kill = uFxTime - q3.x;
  if (age < 0.0 || kill > 0.8) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float R = q1.x, yaw = q1.y, flat_ = q1.z;
  float open = smoothstep(0.0, 0.6, age) * (kill > 0.0 ? 1.0 - smoothstep(0.0, 0.7, kill) : 1.0);
  vec2 p = position.xy * R * 1.1 * (0.2 + 0.8 * open);
  vec3 wp;
  if (flat_ > 0.5) wp = q0.xyz + vec3(p.x, 0.05, p.y);
  else { float c = cos(yaw), s = sin(yaw); wp = q0.xyz + vec3(p.x * c, p.y + R, -p.x * s); }
  vP = position.xy * 1.1; vQ1 = q1; vQ2 = q2; vQ3 = q3; vAge = age;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const POR_FRAG = /* glsl */`
uniform float uFxTime;
varying vec2 vP; varying vec4 vQ1; varying vec4 vQ2; varying vec4 vQ3; varying float vAge;
${GLSL_NOISE}
void main() {
  float r = length(vP);
  if (r > 1.08) discard;
  float kill = uFxTime - vQ3.x;
  float open = smoothstep(0.0, 0.6, vAge) * (kill > 0.0 ? 1.0 - smoothstep(0.0, 0.7, kill) : 1.0);
  float a = atan(vP.y, vP.x), t = uFxTime * vQ1.w;
  float sw = a * 3.0 + log(max(r, 0.02)) * 5.5 + t * 2.6;
  float n1 = vn2(vec2(cos(sw) * 1.6 + r * 4.0 - t, sin(sw) * 1.6));
  float n2 = fbm2(vP * 3.0 + vec2(t * 0.3, -t * 0.2));
  float arms = sq(0.5 + 0.5 * sin(sw + n2 * 3.0));
  float heat = clamp(arms * 0.65 + n1 * 0.55 - r * 0.25, 0.0, 1.0);
  vec3 C = vQ2.rgb;
  vec3 col = mix(C * 0.12, C, smoothstep(0.1, 0.55, heat));
  col = mix(col, C * 1.8 + vec3(0.6), smoothstep(0.65, 0.95, heat));
  float eye = smoothstep(0.42, 0.05, r);
  col *= 1.0 - eye * 0.92;
  float rim = exp(-sq((r - 0.97) / 0.06)) * (0.8 + 0.6 * n2);
  col += (C * 2.2 + vec3(0.4)) * rim;
  float edge = smoothstep(1.06, 0.96, r + (n2 - 0.5) * 0.08);
  float alpha = edge * clamp(0.6 + eye * 0.4 - heat * 0.25, 0.0, 1.0) * open * vQ2.w;
  gl_FragColor = vec4(col * edge * open * vQ2.w, alpha);
}`;
class Portals {
  constructor(fx, n = 16) {
    this.fx = fx; this.n = n;
    this.data = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) { this.data[i * 16 + 3] = -1e9; this.data[i * 16 + 12] = -1e9; }
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, 16, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const src = new THREE.CircleGeometry(1, 64);
    const g = new THREE.InstancedBufferGeometry(); g.index = src.index; g.setAttribute('position', src.attributes.position);
    ['q0', 'q1', 'q2', 'q3'].forEach((a, i) => g.setAttribute(a, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: POR_VERT, fragmentShader: POR_FRAG, uniforms: { uFxTime: fx.u.uFxTime }, ...PREMUL, side: THREE.DoubleSide, depthTest: true });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 19; this.mesh.name = 'fx-portals';
    this.used = new Uint8Array(n);
  }
  alloc() { for (let i = 0; i < this.n; i++) if (!this.used[i]) { this.used[i] = 1; return i; } return -1; }
  set(i, x, y, z, R, yaw, flat, spin, c, a) {
    const d = this.data, b = i * 16;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; if (d[b + 3] < -1e8) { d[b + 3] = this.fx.time; d[b + 12] = 1e9; }
    d[b + 4] = R; d[b + 5] = yaw; d[b + 6] = flat ? 1 : 0; d[b + 7] = spin;
    d[b + 8] = c[0]; d[b + 9] = c[1]; d[b + 10] = c[2]; d[b + 11] = a;
    this.dirty = true;
  }
  kill(i) { if (i < 0) return; this.data[i * 16 + 12] = this.fx.time; this.dirty = true; }
  free(i) { if (i < 0) return; this.used[i] = 0; this.data[i * 16 + 3] = -1e9; this.data[i * 16 + 12] = -1e9; this.dirty = true; }
  update() { if (this.dirty) { queueAll(this.buf); this.dirty = false; } let any = 0; for (let i = 0; i < this.n; i++) any |= this.used[i]; this.mesh.visible = !!any; }
  reset() { this.used.fill(0); for (let i = 0; i < this.n; i++) { this.data[i * 16 + 3] = -1e9; this.data[i * 16 + 12] = -1e9; } this.dirty = true; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ props (CPU-posed instanced meshes)
const GLOW_VERT = /* glsl */`
attribute vec4 aTint;
varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vL;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vN = normalize(mat3(m) * normal); vW = wp.xyz; vTint = aTint; vL = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const GLOW_FRAG = /* glsl */`   // emissive "made of light" (sword of light, orbs): additive fresnel glow
uniform float uFxTime;
varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vL;
${GLSL_NOISE}
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float nv = abs(dot(n, v));
  float fres = pow(max(1.0 - nv, 0.0), 1.8);
  float streak = vn2(vec2(vL.x * 8.0, vL.y * 3.0 - uFxTime * 3.0));
  vec3 C = vTint.rgb;
  vec3 col = C * (0.14 + fres * 1.5 + streak * 0.25) + C * pow(max(nv, 0.0), 8.0) * 0.35;
  gl_FragColor = vec4(col * vTint.a, 0.0);
}`;
const SOLID_FRAG = /* glsl */`
uniform vec3 uLight; uniform vec3 uSunDir;
varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vL;
${GLSL_NOISE}
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float wrap = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float fres = sq(1.0 - abs(dot(n, v)));
  float c = vn2(vL.xy * 7.0 + vL.z * 3.0) * 0.6 + vn2(vL.yz * 17.0) * 0.4;
  float crack = smoothstep(0.5, 0.64, c);
  vec3 base = vec3(0.16, 0.13, 0.12) * (0.35 + 0.65 * wrap) * uLight;
  vec3 col = base + vTint.rgb * (crack * 2.2 + fres * 0.8) * vTint.a;
  gl_FragColor = vec4(col, 1.0);
}`;
const METAL_FRAG = /* glsl */`
uniform vec3 uLight; uniform vec3 uSunDir;
varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vL;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float wrap = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  vec3 h = normalize(uSunDir + v);
  float spec = pow(max(dot(n, h), 0.0), 40.0);
  float fres = pow(max(1.0 - abs(dot(n, v)), 0.0), 2.5);
  vec3 col = vec3(0.1, 0.09, 0.11) * (0.4 + 0.6 * wrap) * uLight + vec3(1.2) * spec + vTint.rgb * (fres * 1.5 + 0.25) * vTint.a;
  gl_FragColor = vec4(col, 1.0);
}`;

class Props {
  constructor(fx) {
    this.fx = fx;
    const u = fx.u;
    const glowMat = () => new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { uFxTime: u.uFxTime }, ...PREMUL, side: THREE.DoubleSide, depthTest: true });
    const solidMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: SOLID_FRAG, uniforms: { uLight: u.uLight, uSunDir: G.uSunDir } });
    const metalMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: METAL_FRAG, uniforms: { uLight: u.uLight, uSunDir: G.uSunDir }, side: THREE.DoubleSide });
    const make = (geo, mat, n, order = 0) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); tint.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aTint', tint);
      m.count = 0; m.frustumCulled = false; m.visible = false; m.renderOrder = order;
      return m;
    };
    this.types = {
      glaive: make(glaiveGeo(), metalMat, 24),
      meteor: make(meteorGeo(), solidMat, 24),
      rock: make(rockGeo(0.5, 7.7), solidMat, 32),
      sword: make(swordGeo(), glowMat(), 8, 28),
      lance: make(lanceGeo(), glowMat(), 24, 28),
      orb: make(new THREE.IcosahedronGeometry(1, 3), glowMat(), 48, 28),
      grenade: make(new THREE.IcosahedronGeometry(0.16, 1), metalMat, 24),
    };
    this.users = {}; for (const k in this.types) this.users[k] = [];
  }
  get meshes() { return Object.values(this.types); }
  /**
   * Register a posed prop. src: object with { pos: Vector3, dir?: Vector3, alive (bool), scale?, spin? (rad/s),
   * roll?, tint?: [r,g,b], alpha? } read every frame; removed when src.alive becomes false.
   */
  add(type, src) { this.users[type].push(src); return src; }
  update(dt) {
    for (const type in this.types) {
      const list = this.users[type], mesh = this.types[type];
      const tint = mesh.geometry.attributes.aTint;
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (!u.alive) continue;
        list[n] = u;
        if (n < mesh.instanceMatrix.count) {
          u.rollA = (u.rollA || 0) + (u.spin || 0) * dt;
          if (u.dir) _q.setFromUnitVectors(_fwd, u.dir); else _q.identity();
          if (u.spinAxis === 'y') { _q2.setFromAxisAngle(_y, u.rollA); _q.multiply(_q2); }
          else if (u.spin) { _q2.setFromAxisAngle(_fwd, u.rollA); _q.multiply(_q2); }
          if (u.quat) _q.copy(u.quat);
          const sc = u.scale ?? 1;
          if (u.scaleV) _s.copy(u.scaleV); else _s.setScalar(sc);
          _m.compose(u.pos, _q, _s);
          mesh.setMatrixAt(n, _m);
          const t = u.tint || DEF_TINT;
          tint.array[n * 4] = t[0]; tint.array[n * 4 + 1] = t[1]; tint.array[n * 4 + 2] = t[2]; tint.array[n * 4 + 3] = u.alpha ?? 1;
        }
        n++;
      }
      list.length = n;
      mesh.count = Math.min(n, mesh.instanceMatrix.count);
      mesh.visible = n > 0;
      if (n) { mesh.instanceMatrix.needsUpdate = true; tint.needsUpdate = true; }
    }
  }
  reset() { for (const k in this.users) this.users[k].length = 0; }
  dispose() { for (const m of this.meshes) { m.geometry.dispose(); m.material.dispose(); } }
}

export class Meshes {
  constructor(fx) {
    this.fx = fx;
    this.rocks = new MeshPool(fx, rockGeo(), ROCK_FRAG, 320, 'fx-rocks');
    this.crystals = new MeshPool(fx, spikeGeo(), CRYSTAL_FRAG, 640, 'fx-crystals');
    this.bubbles = new Bubbles(fx);
    this.pillars = new Pillars(fx);
    this.portals = new Portals(fx);
    this.props = new Props(fx);
  }
  get meshes() { return [this.rocks.mesh, this.crystals.mesh, this.bubbles.mesh, this.pillars.mesh, this.portals.mesh, ...this.props.meshes]; }
  update(dt) { this.rocks.update(); this.crystals.update(); this.bubbles.update(); this.pillars.update(); this.portals.update(); this.props.update(dt); }
  reset() { this.rocks.reset(); this.crystals.reset(); this.bubbles.reset(); this.pillars.reset(); this.portals.reset(); this.props.reset(); }
  dispose() { this.rocks.dispose(); this.crystals.dispose(); this.bubbles.dispose(); this.pillars.dispose(); this.portals.dispose(); this.props.dispose(); }

  // ---- helpers
  debris(x, y, z, n, s = 1, speed = 8, { color = [0.23, 0.2, 0.18], glow = [1.6, 0.45, 0.08], gy = y, up = 1, delay = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, u = 0.45 + Math.random() * 0.55 * up, sp = (0.4 + Math.random() * 0.6) * speed * s;
      this.rocks.spawn(delay, x, y, z, Math.cos(a) * sp * (1 - u * 0.5), u * sp * 1.1, Math.sin(a) * sp * (1 - u * 0.5), 2.2 + Math.random(), Math.random() * 6, Math.random() * 6, Math.random() * 6, 4 + Math.random() * 6, (0.5 + Math.random() * 0.9) * s, 0, -16 * Math.max(0.6, s), color, glow, 0, gy);
    }
  }
  /** ring(s) of crystal spikes erupting outward; rings: [[radius, count, scale], …] */
  spikeRings(x, y, z, rings, s, { color = [0.62, 0.85, 1], glow = [0.4, 0.75, 1.5], fres = 0.9, life = [1.5, 2.0], speed = 16, tilt = 0.35 } = {}) {
    for (const [r0, n, sc] of rings) {
      const r = r0 * s;
      for (let i = 0; i < n; i++) {
        const a = (i + Math.random() * 0.6) / n * Math.PI * 2, rr = r + (Math.random() - 0.5) * 0.6 * s;
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        const delay = rr / (speed * s);
        this.crystals.spawn(delay, px, y - 0.05, pz, 0, 0, 0, life[0] + Math.random() * (life[1] - life[0]), 0.18 + Math.random() * tilt, Math.PI / 2 - a + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 0, sc * s * (0.75 + Math.random() * 0.5), 1, 0, color, glow, fres, y);
      }
    }
  }
  /** a line of spikes from (x,z) along (dx,dz): n spikes over length L, erupting in sequence */
  spikeLine(x, y, z, dx, dz, L, n, s, { color = [0.62, 0.85, 1], glow = [0.4, 0.75, 1.5], fres = 0.9, speed = 18, life = 1.6, spread = 0.5 } = {}) {
    for (let i = 0; i < n; i++) {
      const d = (i + Math.random() * 0.5) / n * L, side = (Math.random() - 0.5) * spread * 2 * s;
      const px = x + dx * d - dz * side, pz = z + dz * d + dx * side;
      const yaw = Math.atan2(dx, dz) + (Math.random() - 0.5);
      this.crystals.spawn(d / speed, px, y - 0.05, pz, 0, 0, 0, life + Math.random() * 0.4, 0.15 + Math.random() * 0.35, yaw, (Math.random() - 0.5) * 0.5, 0, s * (0.7 + Math.random() * 0.6) * (1 - 0.3 * (Math.abs(side) / (spread * s + 1e-3))), 1, 0, color, glow, fres, y);
    }
  }
  shards(x, y, z, n, s = 1, { color = [0.62, 0.85, 1], glow = [0.4, 0.75, 1.5], fres = 0.9, speed = 6, up = 0.6, size = 0.28, life = [0.9, 1.4], dir = null } = {}) {
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      const a = Math.random() * 6.283, u = -0.2 + Math.random() * (0.2 + up), sp = (0.5 + Math.random() * 0.5) * speed * s;
      vx = Math.cos(a) * sp * (1 - Math.abs(u) * 0.4); vy = u * sp + 1.5 * s; vz = Math.sin(a) * sp * (1 - Math.abs(u) * 0.4);
      if (dir) { vx += dir.x * speed * 0.7 * s; vz += dir.z * speed * 0.7 * s; }
      this.crystals.spawn(0, x, y, z, vx, vy, vz, life[0] + Math.random() * (life[1] - life[0]), Math.random() * 6, Math.random() * 6, Math.random() * 6, 8 + Math.random() * 10, size * s * (0.6 + Math.random() * 0.7), 2, -14 * s, color, glow, fres, y);
    }
  }
}
