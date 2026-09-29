// Ribbons: every strip-like effect is rebuilt into ONE dynamic geometry per frame (one draw call):
//   · weapon trails — the swept surface between a base socket and a tip socket (or one socket + width), Catmull-Rom
//     smoothed, white-hot at the edge, fading with age
//   · projectile trails — camera-facing tapered streaks following a moving point
//   · beams — straight / wavy / helix energy strands between two points or objects (followed each frame)
//   · lightning — jagged midpoint-displacement bolts with forks, re-jagged ~30×/s, flickering
//   · chains — metal links (alpha-blended) for pull skills
//   · tracers — fast bullet streaks with a moving head
import * as THREE from 'three';
import { PREMUL, GLSL_NOISE, col as parseCol, v3 } from './util.js';

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

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Vector3(), _q = new THREE.Vector3();

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
  trail(o) { const t = (this.trailPool.pop() || new Trail()).init(o); t.sample(this.fx.time); this.trails.push(t); return t; }
  beam(o, kind = 'glow') { const b = (this.beamPool.pop() || new Beam()).init(o, KIND[kind] ?? 0); this.beams.push(b); return b; }

  // ---- vertex writers
  vert(x, y, z, u0, u1, u2, u3, r, g, b, a) {
    const v = this.v; if (v >= MAXV) return -1;
    const P = this.P, U = this.U, C = this.C;
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    U[v * 4] = u0; U[v * 4 + 1] = u1; U[v * 4 + 2] = u2; U[v * 4 + 3] = u3;
    C[v * 4] = r; C[v * 4 + 1] = g; C[v * 4 + 2] = b; C[v * 4 + 3] = a;
    this.v = v + 1; return v;
  }
  quadStrip(base, pairs) {       // pairs of vertices (2 per row), rows = pairs
    const I = this.I;
    for (let k = 0; k < pairs - 1; k++) {
      if (this.i + 6 > MAXI) return;
      const a = base + k * 2;
      I[this.i++] = a; I[this.i++] = a + 1; I[this.i++] = a + 2; I[this.i++] = a + 1; I[this.i++] = a + 3; I[this.i++] = a + 2;
    }
  }

  update(dt) {
    const fx = this.fx, now = fx.time, cam = fx.camPos;
    this.v = 0; this.i = 0;
    // ---- trails
    let w = 0;
    for (const T of this.trails) {
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
    for (const B of this.beams) {
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
      g.attributes.position.clearUpdateRanges(); g.attributes.position.addUpdateRange(0, this.v * 3); g.attributes.position.needsUpdate = true;
      g.attributes.aUv.clearUpdateRanges(); g.attributes.aUv.addUpdateRange(0, this.v * 4); g.attributes.aUv.needsUpdate = true;
      g.attributes.aCol.clearUpdateRanges(); g.attributes.aCol.addUpdateRange(0, this.v * 4); g.attributes.aCol.needsUpdate = true;
      g.index.clearUpdateRanges(); g.index.addUpdateRange(0, this.i); g.index.needsUpdate = true;
    }
  }

  buildTrail(T, now, cam) {
    const S = T.S, cap = 64, n = T.n, c = T.color, sub = 3;
    const base = this.v;
    let rows = 0;
    // iterate newest → oldest, Catmull-Rom between samples
    const H = T.head;   // ring index helper: at(H, i), i = 0 newest
    for (let i = 0; i < n - 1; i++) {
      const k0 = at(H, Math.max(0, i - 1)), k1 = at(H, i), k2 = at(H, i + 1), k3 = at(H, Math.min(n - 1, i + 2));
      for (let s = 0; s < sub; s++) {
        const f = s / sub;
        const time = S[k1 + 3] + (S[k2 + 3] - S[k1 + 3]) * f;
        const age = Math.min(1, (now - time) / T.life);
        cr(S, k0, k1, k2, k3, 0, f, _a);
        if (T.blade) {
          cr(S, k0, k1, k2, k3, 4, f, _b);
          this.vert(_a.x, _a.y, _a.z, age, rows * 0.1, KIND.blade, 0, c[0], c[1], c[2], T.alpha);
          this.vert(_b.x, _b.y, _b.z, age, rows * 0.1, KIND.blade, 1, c[0], c[1], c[2], T.alpha);
        } else {
          // camera-facing: tangent from neighbours
          cr(S, k0, k1, k2, k3, 0, Math.min(1, f + 0.05), _b); _t.subVectors(_b, _a);
          if (_t.lengthSq() < 1e-10) _t.set(S[k2] - S[k1], S[k2 + 1] - S[k1 + 1], S[k2 + 2] - S[k1 + 2]);
          _c.set(cam.x - _a.x, cam.y - _a.y, cam.z - _a.z);
          _s.crossVectors(_t, _c); const L = _s.length() || 1;
          const hw = T.width * 0.5 * (1 - age * T.taper * 0.85) / L;
          const al = Math.pow(1 - age, 1.3) * T.alpha;
          this.vert(_a.x - _s.x * hw, _a.y - _s.y * hw, _a.z - _s.z * hw, -1, rows * 0.1, T.kind, 0, c[0], c[1], c[2], al);
          this.vert(_a.x + _s.x * hw, _a.y + _s.y * hw, _a.z + _s.z * hw, 1, rows * 0.1, T.kind, 0, c[0], c[1], c[2], al);
        }
        rows++;
      }
    }
    // oldest sample closes the strip
    const kl = at(H, n - 1);
    const agel = Math.min(1, (now - S[kl + 3]) / T.life);
    if (T.blade) {
      this.vert(S[kl], S[kl + 1], S[kl + 2], agel, rows * 0.1, KIND.blade, 0, c[0], c[1], c[2], T.alpha);
      this.vert(S[kl + 4], S[kl + 5], S[kl + 6], agel, rows * 0.1, KIND.blade, 1, c[0], c[1], c[2], T.alpha);
    } else {
      this.vert(S[kl], S[kl + 1], S[kl + 2], -1, rows * 0.1, T.kind, 0, c[0], c[1], c[2], 0);
      this.vert(S[kl], S[kl + 1], S[kl + 2], 1, rows * 0.1, T.kind, 0, c[0], c[1], c[2], 0);
    }
    rows++;
    this.quadStrip(base, rows);
  }

  buildBeam(B, dt, cam) {
    const fx = this.fx, A = B.A, E = B.B, c = B.color, N = B.segs;
    _t.subVectors(E, A); let len = _t.length(); if (len < 1e-3) return; _t.multiplyScalar(1 / len);
    let reach = B.reach < 1 ? Math.min(1, B.reach + B.age * (B.grow || 8) / Math.max(len, 1)) : 1;
    if (B.kind === KIND.tracer) {   // moving head: streak of length B.len travelling at B.speed
      const speed = B.speed || 160, L = B.len || Math.min(8, len * 0.35);
      const headD = Math.min(len, B.age * speed);
      const tailD = Math.max(0, headD - L);
      if (tailD >= len) { B.stopped = true; B.alpha = 0; return; }
      _a.copy(A).addScaledVector(_t, tailD); _b.copy(A).addScaledVector(_t, headD);
      this.segment(_a, _b, B.width, c, B.alpha, KIND.tracer, cam, 1);
      return;
    }
    _n.set(0, 1, 0); if (Math.abs(_t.y) > 0.9) _n.set(1, 0, 0);
    _s.crossVectors(_t, _n).normalize(); _n.crossVectors(_s, _t).normalize();
    const lightning = B.kind === KIND.lightning;
    if (lightning) {
      B.jagT -= dt;
      if (B.jagT <= 0) {
        B.jagT = 1 / 30;
        B.flick = 0.55 + 0.45 * Math.random();
        if (Math.random() < 0.08) B.flick = 0.15;
        for (let s = 0; s < B.strands; s++) this.jagged(B.jag, s * 34 * 2, N, len * (s === 0 ? 0.075 : 0.11) * B.amp);
        // forks: start index + direction for strands > 1 (strand 1 = full-length ghost, 2+ = forks)
        for (let k = 0; k < 4; k++) { B.br[k * 4] = 3 + Math.floor(Math.random() * (N - 8)); B.br[k * 4 + 1] = Math.random() * 6.283; B.br[k * 4 + 2] = 0.2 + Math.random() * 0.25; }
      }
    }
    len *= reach;
    for (let s = 0; s < B.strands; s++) {
      const fork = lightning && s >= 2;
      const bright = s === 0 ? 1 : lightning ? (fork ? 0.75 : 0.5) : 0.6;
      const wS = B.width * (s === 0 ? 1 : lightning ? (fork ? 0.55 : 0.6) : 0.55);
      const base = this.v;
      let rows = 0;
      let segs = N, u0 = 0, u1 = 1;
      if (fork) { const bi = B.br[((s - 2) % 4) * 4]; u0 = bi / N; u1 = Math.min(1, u0 + B.br[((s - 2) % 4) * 4 + 2]); segs = 10; }
      for (let i = 0; i <= segs; i++) {
        const u = u0 + (u1 - u0) * i / segs, env = Math.sin(Math.PI * Math.min(1, u));
        _p.copy(A).addScaledVector(_t, len * u);
        if (lightning) {
          const jj = s * 34 * 2, fi = u * N, i0 = Math.min(N - 1, Math.floor(fi)), fr = fi - i0;
          const ox = B.jag[jj + i0 * 2] * (1 - fr) + B.jag[jj + (i0 + 1) * 2] * fr;
          const oy = B.jag[jj + i0 * 2 + 1] * (1 - fr) + B.jag[jj + (i0 + 1) * 2 + 1] * fr;
          if (fork) {
            const bi = ((s - 2) % 4) * 4, ang = B.br[bi + 1], k = (i / segs);
            const m = k * len * B.br[bi + 2] * 0.6;
            _p.addScaledVector(_s, ox * 0.5 + Math.cos(ang) * m).addScaledVector(_n, oy * 0.5 + Math.sin(ang) * m);
          } else _p.addScaledVector(_s, ox).addScaledVector(_n, oy);
        } else if (B.helix && s > 0) {
          const th = u * len * 1.6 - B.age * 7 + s * Math.PI * 2 / Math.max(1, B.strands - 1);
          const rad = wS * 0.9 * Math.min(1, env * 3);
          _p.addScaledVector(_s, Math.cos(th) * rad).addScaledVector(_n, Math.sin(th) * rad);
        } else if (B.wave) {
          const ph = u * len * 1.4 - B.age * 9 + s * 2.1;
          _p.addScaledVector(_s, Math.sin(ph) * B.wave * env).addScaledVector(_n, Math.cos(ph * 0.7) * B.wave * 0.6 * env);
        }
        _c.set(cam.x - _p.x, cam.y - _p.y, cam.z - _p.z).normalize();
        _m.crossVectors(_t, _c).normalize();
        const tap = fork ? (1 - i / segs) : (B.taper > 0 ? (1 - B.taper) + B.taper * Math.min(1, env * 4) : 1);
        const hw = wS * 0.5 * tap;
        const al = B.alpha * bright * (lightning ? B.flick : 1);
        const kd = B.kind;
        this.vert(_p.x - _m.x * hw, _p.y - _m.y * hw, _p.z - _m.z * hw, -1, u * len, kd, s, c[0], c[1], c[2], al);
        this.vert(_p.x + _m.x * hw, _p.y + _m.y * hw, _p.z + _m.z * hw, 1, u * len, kd, s, c[0], c[1], c[2], al);
        rows++;
      }
      this.quadStrip(base, rows);
    }
  }
  segment(a, b, width, c, alpha, kind, cam, taper) {
    _t.subVectors(b, a); const len = _t.length(); if (len < 1e-4) return; _t.multiplyScalar(1 / len);
    const base = this.v;
    for (let i = 0; i <= 2; i++) {
      const u = i / 2;
      _p.copy(a).addScaledVector(_t, len * u);
      _c.set(cam.x - _p.x, cam.y - _p.y, cam.z - _p.z).normalize();
      _m.crossVectors(_t, _c).normalize();
      const hw = width * 0.5 * (taper ? 0.2 + 0.8 * u : 1);
      const al = alpha * (0.25 + 0.75 * u);
      this.vert(_p.x - _m.x * hw, _p.y - _m.y * hw, _p.z - _m.z * hw, -1, u * len, kind, 0, c[0], c[1], c[2], al);
      this.vert(_p.x + _m.x * hw, _p.y + _m.y * hw, _p.z + _m.z * hw, 1, u * len, kind, 0, c[0], c[1], c[2], al);
    }
    this.quadStrip(base, 3);
  }
  jagged(arr, off, N, amp) {
    arr[off] = arr[off + 1] = 0; arr[off + N * 2] = arr[off + N * 2 + 1] = 0;
    disp(arr, off, 0, N, amp);
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
function disp(arr, off, i0, i1, a) {   // midpoint displacement (lightning)
  if (i1 - i0 < 2) return;
  const m = (i0 + i1) >> 1;
  arr[off + m * 2] = (arr[off + i0 * 2] + arr[off + i1 * 2]) / 2 + (Math.random() * 2 - 1) * a;
  arr[off + m * 2 + 1] = (arr[off + i0 * 2 + 1] + arr[off + i1 * 2 + 1]) / 2 + (Math.random() * 2 - 1) * a;
  disp(arr, off, i0, m, a * 0.55); disp(arr, off, m, i1, a * 0.55);
}
function crc(S, k0, k1, k2, k3, j, t, t2, t3) {
  return 0.5 * (2 * S[k1 + j] + (-S[k0 + j] + S[k2 + j]) * t + (2 * S[k0 + j] - 5 * S[k1 + j] + 4 * S[k2 + j] - S[k3 + j]) * t2 + (-S[k0 + j] + 3 * S[k1 + j] - 3 * S[k2 + j] + S[k3 + j]) * t3);
}
function cr(S, k0, k1, k2, k3, o, t, out) {   // Catmull-Rom on the sample ring (no allocation)
  const t2 = t * t, t3 = t2 * t;
  return out.set(crc(S, k0, k1, k2, k3, o, t, t2, t3), crc(S, k0, k1, k2, k3, o + 1, t, t2, t3), crc(S, k0, k1, k2, k3, o + 2, t, t2, t3));
}
export { KIND as RIBBON_KIND };
