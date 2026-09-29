// Ribbons: every strip-like effect is rebuilt into ONE dynamic geometry per frame (one draw call):
//   · weapon trails — the swept surface between a base socket and a tip socket (or one socket + width), Catmull-Rom
//     smoothed, white-hot at the edge, fading with age
//   · projectile trails — camera-facing tapered streaks following a moving point
//   · beams — straight / wavy / helix energy strands between two points or objects (followed each frame)
//   · lightning — jagged midpoint-displacement bolts with forks, re-jagged ~30×/s, flickering
//   · chains — metal links (alpha-blended) for pull skills
//   · tracers — fast bullet streaks with a moving head
import * as THREE from 'three';
import { PREMUL, GLSL_NOISE, col as parseCol, v3, queueRange } from './util.js';

const MAXV = 60000, MAXI = 150000;
const KIND = { glow: 0, lightning: 1, chain: 2, blade: 3, energy: 4, tracer: 5 };

const VERT = /* glsl */`
attribute vec4 aUv; attribute vec4 aCol;
varying vec4 vUv; varying vec4 vCol;
void main() { vUv = aUv; vCol = aCol; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
uniform float uFxTime; uniform float uDesat;
varying vec4 vUv; varying vec4 vCol;
${GLSL_NOISE}
void main() {
  float x = vUv.x, along = vUv.y;
  int kind = int(vUv.z + 0.5);
  vec3 C = vCol.rgb; float A = vCol.a;
  vec3 rgb; float a = 0.0;
  if (kind == 2) {                                  // chain links (metal, alpha-blended)
    float f = fract(along / 0.34);
    float odd = mod(floor(along / 0.34), 2.0);
    vec2 q = odd < 0.5 ? vec2(x * 1.25, (f - 0.5) * 2.0) : vec2(x * 3.2, (f - 0.5) * 2.0);
    float ring = abs(length(q) - 0.68);
    float m = 1.0 - smoothstep(0.16, 0.26, ring);
    if (odd >= 0.5) m = 1.0 - smoothstep(0.3, 0.45, abs(x)) ;
    float shade = 0.55 + 0.45 * (1.0 - abs(x));
    a = m * A;
    rgb = C * shade * a + vec3(1.2, 1.1, 0.9) * pow(max(1.0 - abs(x), 0.0), 8.0) * a * 0.35;
    gl_FragColor = vec4(rgb, a); return;
  }
  if (kind == 3) {                                  // blade trail: x = age (0 new), vUv.w = 0 base .. 1 tip
    float age = clamp(x, 0.0, 1.0), side = vUv.w;
    float edge = smoothstep(0.0, 0.45, side) * (0.35 + 0.65 * side);
    float tipLine = exp(-sq((1.0 - side) / 0.08)) * (1.0 - age);
    float n = vn2(vec2(along * 3.0 - uFxTime * 6.0, side * 4.0));
    float k = pow(max(1.0 - age, 0.0), 1.5) * edge * (0.7 + 0.3 * n);
    rgb = (C * k * 1.3 + (vec3(1.0) + C * 0.2) * tipLine * 1.6) * A;
    gl_FragColor = vec4(rgb, 0.0); return;
  }
  float ax = abs(x);
  float core = exp(-ax * ax * (kind == 1 ? 40.0 : 22.0));
  float glow = exp(-ax * ax * 3.2);
  float flow = 1.0;
  if (kind == 4) flow = 0.55 + 0.9 * vn2(vec2(along * 1.6 - uFxTime * 9.0, vUv.w * 5.0)) * vn2(vec2(along * 3.7 - uFxTime * 14.0, 3.0));
  if (kind == 5) flow = 1.0;
  float m = max(C.r, max(C.g, C.b));
  rgb = (C * glow * 0.9 * flow + (vec3(m) * 0.55 + C * 0.45) * core * 1.25) * A;
  rgb = mix(rgb, vec3(dot(rgb, vec3(0.3, 0.5, 0.2))), uDesat);
  gl_FragColor = vec4(rgb, 0.0);
}`;

// Hot-loop scratch as typed arrays (never boxed, whatever the engine does with object fields):
//   VA — row attributes for Ribbons.pair(): [u0 left, u0 right, u1 (along), u2 (kind), u3 left, u3 right, r, g, b, a]
//   PV — positions: [0..2] left vertex, [3..5] right vertex, [6..8] / [9..11] Catmull-Rom outputs
const VA = new Float64Array(10), PV = new Float64Array(12);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// read a followed source: Object3D (world pos), { pos } (projectile), Vector3-like
function readSrc(src, out, off) {
  if (!src) return out;
  if (src.isObject3D) { if (off) { out.copy(off); src.localToWorld(out); } else src.getWorldPosition(out); return out; }
  if (src.pos && src.pos.isVector3) return out.copy(src.pos);
  return out.set(src.x, src.y, src.z);
}

// ------------------------------------------------------------------ trail
class Trail {
  constructor() { this.S = new Float32Array(64 * 7); this.n = 0; this.head = 0; }
  init(o) {
    this.attach = o.attach; this.tipSrc = o.tip || null; this.tipOff = o.tipOffset || null; this.off = o.offset || null;
    this.color = parseCol(o.color ?? 0xffe2a8, o.intensity ?? 1.6, this.color || [0, 0, 0]);
    this.width = o.width ?? 0.35; this.life = o.life ?? 0.2; this.alpha = 1;
    this.blade = !!(this.tipSrc || this.tipOff);
    this.n = 0; this.head = 0; this.stopped = false; this.dead = false; this.until = o.dur != null ? o.dur : Infinity; this.age = 0;
    this.taper = o.taper ?? 1; this.kind = o.kind === 'energy' ? KIND.energy : KIND.glow; this.gen = (this.gen || 0) + 1;
    this.minStep = o.minStep ?? 0.02;
    return this;
  }
  sample(now) {
    readSrc(this.attach, _a, this.off);
    if (this.blade) { if (this.tipSrc) readSrc(this.tipSrc, _b, null); else { _b.copy(this.tipOff); this.attach.localToWorld(_b); } }
    const S = this.S, cap = 64;
    if (this.n > 0) {
      const lb = ((this.head - 1 + cap) % cap) * 7;
      const dx = S[lb] - _a.x, dy = S[lb + 1] - _a.y, dz = S[lb + 2] - _a.z;
      const moved = dx * dx + dy * dy + dz * dz;
      let moved2 = 0;
      if (this.blade) { const ex = S[lb + 4] - _b.x, ey = S[lb + 5] - _b.y, ez = S[lb + 6] - _b.z; moved2 = ex * ex + ey * ey + ez * ez; }
      if (moved < this.minStep * this.minStep && moved2 < this.minStep * this.minStep && now - S[lb + 3] < 0.05) {
        S[lb] = _a.x; S[lb + 1] = _a.y; S[lb + 2] = _a.z; if (this.blade) { S[lb + 4] = _b.x; S[lb + 5] = _b.y; S[lb + 6] = _b.z; }
        return;
      }
    }
    const k = this.head * 7;
    S[k] = _a.x; S[k + 1] = _a.y; S[k + 2] = _a.z; S[k + 3] = now;
    if (this.blade) { S[k + 4] = _b.x; S[k + 5] = _b.y; S[k + 6] = _b.z; }
    this.head = (this.head + 1) % cap; if (this.n < cap) this.n++;
  }
}

// ------------------------------------------------------------------ beam / lightning / chain / tracer
class Beam {
  constructor() { this.jag = new Float32Array(6 * 34 * 2); this.br = new Float32Array(4 * 4); }
  init(o, kind) {
    this.from = o.from; this.to = o.to; this.fromOff = o.fromOffset || null;
    this.kind = kind; this.width = o.width ?? (kind === KIND.lightning ? 0.34 : kind === KIND.chain ? 0.22 : 0.5);
    this.color = parseCol(o.color ?? (kind === KIND.lightning ? [0.5, 0.7, 1.6] : kind === KIND.chain ? [0.55, 0.52, 0.5] : [1.4, 1.1, 0.6]), o.intensity ?? 1, this.color || [0, 0, 0]);
    this.dur = o.dur ?? (kind === KIND.lightning ? 0.35 : kind === KIND.tracer ? 0.12 : 1);
    this.age = 0; this.alpha = 1; this.stopped = false; this.dead = false; this.fade = o.fade ?? 0.12;
    this.wave = o.wave ?? 0; this.helix = o.helix ?? 0; this.strands = Math.min(6, o.strands ?? (kind === KIND.lightning ? 3 : 1));
    this.jagT = 0; this.flick = 1; this.segs = Math.min(32, o.segments ?? (kind === KIND.lightning ? 24 : kind === KIND.chain ? 2 : 20));
    this.amp = o.amp ?? 1; this.taper = o.taper ?? (kind === KIND.tracer ? 1 : 0.4); this.reach = o.reach ?? 1;   // reach < 1: beam grows toward B
    this.grow = o.grow ?? 0; this.speed = o.speed ?? 0; this.len = o.length ?? 0;
    this.A = this.A || new THREE.Vector3(); this.B = this.B || new THREE.Vector3();
    readSrc(this.from, this.A, this.fromOff); readSrc(this.to, this.B, null);
    this.gen = (this.gen || 0) + 1;
    return this;
  }
}

export class Ribbons {
  constructor(fx) {
    this.fx = fx;
    const g = new THREE.BufferGeometry();
    this.P = new Float32Array(MAXV * 3); this.U = new Float32Array(MAXV * 4); this.C = new Float32Array(MAXV * 4); this.I = new Uint16Array(MAXI);
    g.setAttribute('position', new THREE.BufferAttribute(this.P, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUv', new THREE.BufferAttribute(this.U, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.C, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(this.I, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uFxTime: fx.u.uFxTime, uDesat: fx.u.uDesat }, ...PREMUL, depthTest: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 25; this.mesh.name = 'fx-ribbons';
    this.trails = []; this.beams = [];
    this.trailPool = []; this.beamPool = [];
    this.v = 0; this.i = 0;
  }
  trail(o) { const t = (this.trailPool.pop() || new Trail()).init(o); t.dim = this.fx.dimK; t.sample(this.fx.time); this.trails.push(t); return t; }
  beam(o, kind = 'glow') { const b = (this.beamPool.pop() || new Beam()).init(o, KIND[kind] ?? 0); b.dim = this.fx.dimK; this.beams.push(b); return b; }

  // ---- vertex writers
  /** one row = two vertices at PV[0..2] / PV[3..5] with the row attributes in VA */
  pair() {
    const v = this.v; if (v + 2 > MAXV) return;
    const P = this.P, U = this.U, C = this.C;
    let o = v * 3;
    P[o] = PV[0]; P[o + 1] = PV[1]; P[o + 2] = PV[2]; P[o + 3] = PV[3]; P[o + 4] = PV[4]; P[o + 5] = PV[5];
    o = v * 4;
    U[o] = VA[0]; U[o + 1] = VA[2]; U[o + 2] = VA[3]; U[o + 3] = VA[4];
    U[o + 4] = VA[1]; U[o + 5] = VA[2]; U[o + 6] = VA[3]; U[o + 7] = VA[5];
    C[o] = C[o + 4] = VA[6]; C[o + 1] = C[o + 5] = VA[7]; C[o + 2] = C[o + 6] = VA[8]; C[o + 3] = C[o + 7] = VA[9];
    this.v = v + 2;
  }
  quadStrip(base, pairs) {       // pairs of vertices (2 per row), rows = pairs
    const I = this.I;
    for (let k = 0; k < pairs - 1; k++) {
      if (this.i + 6 > MAXI) return;
      const a = base + k * 2;
      if (a + 3 >= this.v) return;             // vertex budget ran out mid-strip
      I[this.i++] = a; I[this.i++] = a + 1; I[this.i++] = a + 2; I[this.i++] = a + 1; I[this.i++] = a + 3; I[this.i++] = a + 2;
    }
  }

  update(dt) {
    const fx = this.fx, now = fx.time, cam = fx.camPos;
    this.v = 0; this.i = 0;
    // ---- trails
    let w = 0;
    for (let j = 0; j < this.trails.length; j++) {
      const T = this.trails[j];
      T.age += dt;
      if (!T.stopped && T.age > T.until) T.stopped = true;
      if (!T.stopped) {
        if (T.attach?.isObject3D && !T.attach.parent && T.age > 0.1) T.stopped = true;
        else T.sample(now);
      }
      // drop old samples
      const S = T.S, cap = 64;
      while (T.n > 0) { const k = ((T.head - T.n + cap) % cap) * 7; if (now - S[k + 3] > T.life) T.n--; else break; }
      if (T.stopped && T.n < 2) { T.dead = true; this.trailPool.push(T); continue; }
      this.trails[w++] = T;
      if (T.n >= 2) this.buildTrail(T, now, cam);
    }
    this.trails.length = w;
    // ---- beams
    w = 0;
    for (let j = 0; j < this.beams.length; j++) {
      const B = this.beams[j];
      B.age += dt;
      if (!B.stopped && B.age >= B.dur) B.stopped = true;
      if (B.stopped) { B.alpha -= dt / Math.max(B.fade, 1e-3); if (B.alpha <= 0) { B.dead = true; this.beamPool.push(B); continue; } }
      this.beams[w++] = B;
      if (B.from) readSrc(B.from, B.A, B.fromOff);
      if (B.to) readSrc(B.to, B.B, null);
      this.buildBeam(B, dt, cam);
    }
    this.beams.length = w;
    const g = this.geo;
    g.setDrawRange(0, this.i);
    this.mesh.visible = this.i > 0;
    if (this.i) {
      queueRange(g.attributes.position, 0, this.v * 3); queueRange(g.attributes.aUv, 0, this.v * 4);
      queueRange(g.attributes.aCol, 0, this.v * 4); queueRange(g.index, 0, this.i);
    }
  }

  buildTrail(T, now, cam) {
    const S = T.S, n = T.n, c = T.color, sub = 3, blade = T.blade;
    const base = this.v;
    let rows = 0;
    VA[6] = c[0]; VA[7] = c[1]; VA[8] = c[2];
    if (blade) { VA[3] = KIND.blade; VA[4] = 0; VA[5] = 1; } else { VA[0] = -1; VA[1] = 1; VA[3] = T.kind; VA[4] = 0; VA[5] = 0; }
    // iterate newest → oldest, Catmull-Rom between samples
    const H = T.head;   // ring index helper: at(H, i), i = 0 newest
    for (let i = 0; i < n - 1; i++) {
      const k0 = at(H, Math.max(0, i - 1)), k1 = at(H, i), k2 = at(H, i + 1), k3 = at(H, Math.min(n - 1, i + 2));
      for (let st = 0; st < sub; st++) {
        const f = st / sub;
        const time = S[k1 + 3] + (S[k2 + 3] - S[k1 + 3]) * f;
        const age = Math.min(1, (now - time) / T.life);
        VA[2] = rows * 0.1;
        if (blade) {
          cr(S, k0, k1, k2, k3, 0, st, sub, 0, 0);          // base edge → PV[0..2]
          cr(S, k0, k1, k2, k3, 4, st, sub, 0, 3);          // tip edge  → PV[3..5]
          VA[0] = age; VA[1] = age; VA[9] = T.alpha * T.dim;
          this.pair();
        } else {
          // camera-facing: tangent from the curve just ahead
          cr(S, k0, k1, k2, k3, 0, st, sub, 0, 6);
          cr(S, k0, k1, k2, k3, 0, st, sub, 1, 9);
          const ax = PV[6], ay = PV[7], az = PV[8];
          let tx = PV[9] - ax, ty = PV[10] - ay, tz = PV[11] - az;
          if (tx * tx + ty * ty + tz * tz < 1e-10) { tx = S[k2] - S[k1]; ty = S[k2 + 1] - S[k1 + 1]; tz = S[k2 + 2] - S[k1 + 2]; }
          const cx = cam.x - ax, cy = cam.y - ay, cz = cam.z - az;
          const sx = ty * cz - tz * cy, sy = tz * cx - tx * cz, sz = tx * cy - ty * cx;
          const L = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
          const hw = T.width * 0.5 * (1 - age * T.taper * 0.85) / L;
          VA[9] = Math.pow(1 - age, 1.3) * T.alpha * T.dim;
          PV[0] = ax - sx * hw; PV[1] = ay - sy * hw; PV[2] = az - sz * hw;
          PV[3] = ax + sx * hw; PV[4] = ay + sy * hw; PV[5] = az + sz * hw;
          this.pair();
        }
        rows++;
      }
    }
    // oldest sample closes the strip
    const kl = at(H, n - 1);
    const agel = Math.min(1, (now - S[kl + 3]) / T.life);
    VA[2] = rows * 0.1;
    PV[0] = S[kl]; PV[1] = S[kl + 1]; PV[2] = S[kl + 2];
    if (blade) { PV[3] = S[kl + 4]; PV[4] = S[kl + 5]; PV[5] = S[kl + 6]; VA[0] = agel; VA[1] = agel; VA[9] = T.alpha * T.dim; }
    else { PV[3] = PV[0]; PV[4] = PV[1]; PV[5] = PV[2]; VA[9] = 0; }
    this.pair();
    rows++;
    this.quadStrip(base, rows);
  }

  buildBeam(B, dt, cam) {
    // all vector math on local doubles (no Vector3 methods with scalar arguments) → nothing boxed, zero allocation
    const A = B.A, E = B.B, c = B.color, N = B.segs;
    let tx = E.x - A.x, ty = E.y - A.y, tz = E.z - A.z;
    let len = Math.sqrt(tx * tx + ty * ty + tz * tz); if (len < 1e-3) return;
    tx /= len; ty /= len; tz /= len;
    const reach = B.reach < 1 ? Math.min(1, B.reach + B.age * (B.grow || 8) / Math.max(len, 1)) : 1;
    if (B.kind === KIND.tracer) {   // moving head: streak of length B.len travelling at B.speed
      const speed = B.speed || 160, L = B.len || Math.min(8, len * 0.35);
      const headD = Math.min(len, B.age * speed);
      const tailD = Math.max(0, headD - L);
      if (tailD >= len) { B.stopped = true; B.alpha = 0; return; }
      PV[6] = A.x + tx * tailD; PV[7] = A.y + ty * tailD; PV[8] = A.z + tz * tailD;
      PV[9] = A.x + tx * headD; PV[10] = A.y + ty * headD; PV[11] = A.z + tz * headD;
      this.segment(B, cam);
      return;
    }
    // side (s) and normal (n) basis around the beam axis
    let nx = 0, ny = 1, nz = 0; if (Math.abs(ty) > 0.9) { nx = 1; ny = 0; }
    let sx = ty * nz - tz * ny, sy = tz * nx - tx * nz, sz = tx * ny - ty * nx;
    let l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= l; sy /= l; sz /= l;
    nx = sy * tz - sz * ty; ny = sz * tx - sx * tz; nz = sx * ty - sy * tx;
    l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    const lightning = B.kind === KIND.lightning;
    if (lightning) {
      B.jagT -= dt;
      if (B.jagT <= 0) {
        B.jagT = 1 / 30;
        B.flick = 0.55 + 0.45 * Math.random();
        if (Math.random() < 0.08) B.flick = 0.15;
        for (let s = 0; s < B.strands; s++) { JAG[0] = len * (s === 0 ? 0.075 : 0.11) * B.amp; jagged(B.jag, s * 34 * 2, N); }
        // forks: start index + direction for strands > 1 (strand 1 = full-length ghost, 2+ = forks)
        for (let k = 0; k < 4; k++) { B.br[k * 4] = 3 + Math.floor(Math.random() * (N - 8)); B.br[k * 4 + 1] = Math.random() * 6.283; B.br[k * 4 + 2] = 0.2 + Math.random() * 0.25; }
      }
    }
    len *= reach;
    VA[0] = -1; VA[1] = 1; VA[3] = B.kind; VA[6] = c[0]; VA[7] = c[1]; VA[8] = c[2];
    for (let s = 0; s < B.strands; s++) {
      const fork = lightning && s >= 2;
      const bright = s === 0 ? 1 : lightning ? (fork ? 0.75 : 0.5) : 0.6;
      const wS = B.width * (s === 0 ? 1 : lightning ? (fork ? 0.55 : 0.6) : 0.55);
      const base = this.v;
      let rows = 0;
      let segs = N, u0 = 0, u1 = 1;
      if (fork) { const bi = B.br[((s - 2) % 4) * 4]; u0 = bi / N; u1 = Math.min(1, u0 + B.br[((s - 2) % 4) * 4 + 2]); segs = 10; }
      VA[4] = s; VA[5] = s; VA[9] = B.alpha * bright * (lightning ? B.flick : 1) * B.dim;
      for (let i = 0; i <= segs; i++) {
        const u = u0 + (u1 - u0) * i / segs, env = Math.sin(Math.PI * Math.min(1, u));
        let px = A.x + tx * len * u, py = A.y + ty * len * u, pz = A.z + tz * len * u;
        if (lightning) {
          const jj = s * 34 * 2, fi = u * N, i0 = Math.min(N - 1, Math.floor(fi)), fr = fi - i0;
          let ox = B.jag[jj + i0 * 2] * (1 - fr) + B.jag[jj + (i0 + 1) * 2] * fr;
          let oy = B.jag[jj + i0 * 2 + 1] * (1 - fr) + B.jag[jj + (i0 + 1) * 2 + 1] * fr;
          if (fork) {
            const bi = ((s - 2) % 4) * 4, ang = B.br[bi + 1], k = (i / segs);
            const m = k * len * B.br[bi + 2] * 0.6;
            ox = ox * 0.5 + Math.cos(ang) * m; oy = oy * 0.5 + Math.sin(ang) * m;
          }
          px += sx * ox + nx * oy; py += sy * ox + ny * oy; pz += sz * ox + nz * oy;
        } else if (B.helix && s > 0) {
          const th = u * len * 1.6 - B.age * 7 + s * Math.PI * 2 / Math.max(1, B.strands - 1);
          const rad = wS * 0.9 * Math.min(1, env * 3), cs = Math.cos(th) * rad, sn = Math.sin(th) * rad;
          px += sx * cs + nx * sn; py += sy * cs + ny * sn; pz += sz * cs + nz * sn;
        } else if (B.wave) {
          const ph = u * len * 1.4 - B.age * 9 + s * 2.1, a1 = Math.sin(ph) * B.wave * env, a2 = Math.cos(ph * 0.7) * B.wave * 0.6 * env;
          px += sx * a1 + nx * a2; py += sy * a1 + ny * a2; pz += sz * a1 + nz * a2;
        }
        // camera-facing half-width direction m = t × (cam − p)
        const cx = cam.x - px, cy = cam.y - py, cz = cam.z - pz;
        const mx = ty * cz - tz * cy, my = tz * cx - tx * cz, mz = tx * cy - ty * cx;
        const tap = fork ? (1 - i / segs) : (B.taper > 0 ? (1 - B.taper) + B.taper * Math.min(1, env * 4) : 1);
        const hw = wS * 0.5 * tap / (Math.sqrt(mx * mx + my * my + mz * mz) || 1);
        VA[2] = u * len;
        PV[0] = px - mx * hw; PV[1] = py - my * hw; PV[2] = pz - mz * hw;
        PV[3] = px + mx * hw; PV[4] = py + my * hw; PV[5] = pz + mz * hw;
        this.pair();
        rows++;
      }
      this.quadStrip(base, rows);
    }
  }
  segment(B, cam) {               // tracer streak PV[6..8] → PV[9..11], tapered toward the tail
    const ax = PV[6], ay = PV[7], az = PV[8];
    let tx = PV[9] - ax, ty = PV[10] - ay, tz = PV[11] - az;
    const len = Math.sqrt(tx * tx + ty * ty + tz * tz); if (len < 1e-4) return;
    const base = this.v, c = B.color;
    VA[0] = -1; VA[1] = 1; VA[3] = KIND.tracer; VA[4] = 0; VA[5] = 0; VA[6] = c[0]; VA[7] = c[1]; VA[8] = c[2];
    for (let i = 0; i <= 2; i++) {
      const u = i / 2;
      const px = ax + tx * u, py = ay + ty * u, pz = az + tz * u;
      const cx = cam.x - px, cy = cam.y - py, cz = cam.z - pz;
      const mx = ty * cz - tz * cy, my = tz * cx - tx * cz, mz = tx * cy - ty * cx;
      const hw = B.width * 0.5 * (0.2 + 0.8 * u) / (Math.sqrt(mx * mx + my * my + mz * mz) || 1);
      VA[2] = u * len; VA[9] = B.alpha * (0.25 + 0.75 * u) * B.dim;
      PV[0] = px - mx * hw; PV[1] = py - my * hw; PV[2] = pz - mz * hw;
      PV[3] = px + mx * hw; PV[4] = py + my * hw; PV[5] = pz + mz * hw;
      this.pair();
    }
    this.quadStrip(base, 3);
  }
  reset() {
    for (const t of this.trails) this.trailPool.push(t); this.trails.length = 0;
    for (const b of this.beams) this.beamPool.push(b); this.beams.length = 0;
    this.geo.setDrawRange(0, 0);
  }
  count() { return this.trails.length + this.beams.length; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
function at(head, i) { return ((head - 1 - i + 128) % 64) * 7; }
// lightning jag: midpoint displacement between i0..i1; amplitude = JAG[0] · 0.55^level. Integer arguments and an
// inline xorshift instead of Math.random (whose boxed result allocates in the recursive, non-inlined case).
const JAG = new Float64Array(1), XS = new Int32Array([0x2545f491]);
function disp(arr, off, i0, i1, level) {
  if (i1 - i0 < 2) return;
  const m = (i0 + i1) >> 1, a = JAG[0] * Math.pow(0.55, level);
  let x = XS[0]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const r1 = (x >>> 0) * 4.656612873077393e-10 - 1;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5; XS[0] = x; const r2 = (x >>> 0) * 4.656612873077393e-10 - 1;
  arr[off + m * 2] = (arr[off + i0 * 2] + arr[off + i1 * 2]) / 2 + r1 * a;
  arr[off + m * 2 + 1] = (arr[off + i0 * 2 + 1] + arr[off + i1 * 2 + 1]) / 2 + r2 * a;
  disp(arr, off, i0, m, level + 1); disp(arr, off, m, i1, level + 1);
}
function jagged(arr, off, N) {
  arr[off] = arr[off + 1] = 0; arr[off + N * 2] = arr[off + N * 2 + 1] = 0;
  disp(arr, off, 0, N, 0);
}
// Catmull-Rom on the sample ring at t = st / sub (+0.05 when ahead = 1, for tangents). Integer arguments only and the
// result written into PV[oi..oi+2]: nothing is boxed or allocated even when the call is not inlined.
function cr(S, k0, k1, k2, k3, o, st, sub, ahead, oi) {
  let t = st / sub; if (ahead) t = Math.min(1, t + 0.05);
  const t2 = t * t, t3 = t2 * t;
  let j = k0 + o; const ax = S[j], ay = S[j + 1], az = S[j + 2];
  j = k1 + o; const bx = S[j], by = S[j + 1], bz = S[j + 2];
  j = k2 + o; const cx = S[j], cy = S[j + 1], cz = S[j + 2];
  j = k3 + o; const dx = S[j], dy = S[j + 1], dz = S[j + 2];
  PV[oi] = 0.5 * (2 * bx + (cx - ax) * t + (2 * ax - 5 * bx + 4 * cx - dx) * t2 + (3 * bx - ax - 3 * cx + dx) * t3);
  PV[oi + 1] = 0.5 * (2 * by + (cy - ay) * t + (2 * ay - 5 * by + 4 * cy - dy) * t2 + (3 * by - ay - 3 * cy + dy) * t3);
  PV[oi + 2] = 0.5 * (2 * bz + (cz - az) * t + (2 * az - 5 * bz + 4 * cz - dz) * t2 + (3 * bz - az - 3 * cz + dz) * t3);
}
export { KIND as RIBBON_KIND };
