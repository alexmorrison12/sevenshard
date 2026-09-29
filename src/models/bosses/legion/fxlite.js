// Boss-intrinsic ambient particles (flame manes, ember mantles, burning eyes, snort steam, ghost wisps, hit sparks,
// landing dust). One additive and one alpha-blended THREE.Points per boss instance, simulated on the CPU in WORLD
// space: the Points objects hang under the boss root with matrixWorldAutoUpdate = false and an identity matrixWorld,
// so trails stay behind when the boss moves or turns. Preallocated; no per-frame allocations.
import * as THREE from 'three';

const VS = /* glsl */`
attribute vec4 aCol; attribute float aSize;
varying vec4 vCol;
uniform float uPx;
void main() {
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aCol.a <= 0.0 ? 0.0 : clamp( aSize * uPx / max( 0.1, -mv.z ), 0.0, 256.0 );
}`;
const FS = /* glsl */`
varying vec4 vCol;
uniform float uSoft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length( d ) * 2.0;
  if ( r > 1.0 ) discard;
  float a = pow( 1.0 - r, uSoft );
  gl_FragColor = vec4( vCol.rgb, vCol.a * a );
}`;

export class Particles {
  constructor(cap, { additive = true, soft = 1.6 } = {}) {
    this.cap = cap; this.n = 0;
    this.P = new Float32Array(cap * 3); this.V = new Float32Array(cap * 3);
    this.C0 = new Float32Array(cap * 4); this.C1 = new Float32Array(cap * 4);
    this.S = new Float32Array(cap * 2); this.L = new Float32Array(cap * 2); // life, age
    this.F = new Float32Array(cap * 2); // gravity (m/s², + = up), drag
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    const U = { uPx: { value: 500 }, uSoft: { value: soft } };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = this.obj = new THREE.Points(g, this.mat);
    pts.frustumCulled = false; pts.matrixAutoUpdate = false; pts.matrixWorldAutoUpdate = false;
    pts.renderOrder = additive ? 12 : 11; pts.castShadow = false; pts.receiveShadow = false;
    const sz = new THREE.Vector2();
    pts.onBeforeRender = (renderer, scene, camera) => { renderer.getDrawingBufferSize(sz); U.uPx.value = camera.projectionMatrix.elements[5] * sz.y * 0.5; };
    this.geo = g;
  }
  /** c0/c1: [r,g,b,a] (linear, HDR allowed) start → end colour; s0/s1 size (m) start → end. */
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav = 0, drag = 0) {
    let i;
    if (this.n < this.cap) i = this.n++;
    else { // recycle the oldest-ish (highest age/life ratio) among a few probes
      i = 0; let best = -1;
      for (let k = 0; k < 8; k++) { const j = (Math.random() * this.cap) | 0; const r = this.L[j * 2 + 1] / this.L[j * 2]; if (r > best) { best = r; i = j; } }
    }
    const P = this.P, V = this.V;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    for (let k = 0; k < 4; k++) { this.C0[i * 4 + k] = c0[k]; this.C1[i * 4 + k] = c1[k]; }
    this.S[i * 2] = s0; this.S[i * 2 + 1] = s1; this.L[i * 2] = life; this.L[i * 2 + 1] = 0;
    this.F[i * 2] = grav; this.F[i * 2 + 1] = drag;
  }
  update(dt, t = 0, floor = -1e9) {
    const P = this.P, V = this.V, L = this.L, F = this.F;
    const ap = this.aPos.array, ac = this.aCol.array, as = this.aSize.array;
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const age = L[i * 2 + 1] + dt, life = L[i * 2];
      if (age >= life) continue;
      // compact in place
      if (j !== i) {
        for (let k = 0; k < 3; k++) { P[j * 3 + k] = P[i * 3 + k]; V[j * 3 + k] = V[i * 3 + k]; }
        for (let k = 0; k < 4; k++) { this.C0[j * 4 + k] = this.C0[i * 4 + k]; this.C1[j * 4 + k] = this.C1[i * 4 + k]; }
        this.S[j * 2] = this.S[i * 2]; this.S[j * 2 + 1] = this.S[i * 2 + 1];
        F[j * 2] = F[i * 2]; F[j * 2 + 1] = F[i * 2 + 1]; L[j * 2] = life;
      }
      L[j * 2 + 1] = age;
      const dr = Math.exp(-F[j * 2 + 1] * dt);
      V[j * 3] *= dr; V[j * 3 + 1] = V[j * 3 + 1] * dr + F[j * 2] * dt; V[j * 3 + 2] *= dr;
      // a little curl so flames lick instead of rising in straight lines
      const sw = Math.sin(t * 7 + j * 1.7) * 0.6 * dt * (F[j * 2] > 0 ? 1 : 0);
      V[j * 3] += sw; V[j * 3 + 2] += Math.cos(t * 6.3 + j * 2.3) * 0.6 * dt * (F[j * 2] > 0 ? 1 : 0);
      P[j * 3] += V[j * 3] * dt; P[j * 3 + 1] += V[j * 3 + 1] * dt; P[j * 3 + 2] += V[j * 3 + 2] * dt;
      if (P[j * 3 + 1] < floor) { P[j * 3 + 1] = floor; if (V[j * 3 + 1] < 0) { const sp = -V[j * 3 + 1] * 0.5; V[j * 3 + 1] = sp * 0.2; const h = Math.hypot(V[j * 3], V[j * 3 + 2]) || 1; V[j * 3] += V[j * 3] / h * sp; V[j * 3 + 2] += V[j * 3 + 2] / h * sp; } }
      const u = age / life, e = u * u * (3 - 2 * u);
      ap[j * 3] = P[j * 3]; ap[j * 3 + 1] = P[j * 3 + 1]; ap[j * 3 + 2] = P[j * 3 + 2];
      const C0 = this.C0, C1 = this.C1;
      for (let k = 0; k < 3; k++) ac[j * 4 + k] = C0[j * 4 + k] + (C1[j * 4 + k] - C0[j * 4 + k]) * e;
      const fin = Math.min(1, age / Math.min(0.08, life * 0.2));
      ac[j * 4 + 3] = (C0[j * 4 + 3] + (C1[j * 4 + 3] - C0[j * 4 + 3]) * u) * fin;
      as[j] = this.S[j * 2] + (this.S[j * 2 + 1] - this.S[j * 2]) * u;
      j++;
    }
    this.n = j;
    this.geo.setDrawRange(0, j);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, j * 3);
    this.aCol.clearUpdateRanges(); this.aCol.addUpdateRange(0, j * 4);
    this.aSize.clearUpdateRanges(); this.aSize.addUpdateRange(0, j);
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.obj.removeFromParent(); }
}

// ------------------------------------------------------------------------------------------------ weapon trails
const TVS = /* glsl */`
attribute float aA; attribute float aSide;
varying float vA; varying float vSide;
void main() { vA = aA; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const TFS = /* glsl */`
varying float vA; varying float vSide;
uniform vec3 uCore; uniform vec3 uEdge;
void main() {
  float s = vSide;
  float a = vA * smoothstep( 0.0, 0.35, s ) * ( 0.55 + 0.45 * s );
  gl_FragColor = vec4( mix( uEdge, uCore, s * s ), a );
}`;
/** Ribbon between two tracked points (blade root → blade edge) over the last `life` seconds, world space. */
export class Trail {
  constructor(n = 22, { core = [6, 3.2, 1.1], edge = [2.2, 0.35, 0.05], life = 0.22 } = {}) {
    this.n = n; this.life = life; this.cnt = 0;
    this.A = new Float32Array(n * 3); this.B = new Float32Array(n * 3); this.age = new Float32Array(n); this.al = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(new Float32Array(n * 2), 1).setUsage(THREE.DynamicDrawUsage);
    const side = new Float32Array(n * 2); for (let i = 0; i < n; i++) { side[i * 2] = 0; side[i * 2 + 1] = 1; }
    g.setAttribute('position', this.pos); g.setAttribute('aA', this.aA); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ vertexShader: TVS, fragmentShader: TFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCore: { value: new THREE.Color(...core) }, uEdge: { value: new THREE.Color(...edge) } } });
    const m = this.obj = new THREE.Mesh(g, this.mat);
    m.frustumCulled = false; m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false; m.renderOrder = 13; m.castShadow = false;
    this.geo = g;
  }
  /** push a sample at the head (a, b world points), alpha 0..1 */
  push(a, b, alpha) {
    const n = this.n;
    this.A.copyWithin(3, 0, (n - 1) * 3); this.B.copyWithin(3, 0, (n - 1) * 3);
    this.age.copyWithin(1, 0, n - 1); this.al.copyWithin(1, 0, n - 1);
    this.A[0] = a.x; this.A[1] = a.y; this.A[2] = a.z; this.B[0] = b.x; this.B[1] = b.y; this.B[2] = b.z;
    this.age[0] = 0; this.al[0] = alpha; this.cnt = Math.min(n, this.cnt + 1);
  }
  update(dt) {
    const p = this.pos.array, aa = this.aA.array;
    let live = 0;
    for (let i = 0; i < this.cnt; i++) {
      this.age[i] += dt;
      const f = Math.max(0, 1 - this.age[i] / this.life);
      const a = this.al[i] * f * f;
      p[i * 6] = this.A[i * 3]; p[i * 6 + 1] = this.A[i * 3 + 1]; p[i * 6 + 2] = this.A[i * 3 + 2];
      p[i * 6 + 3] = this.B[i * 3]; p[i * 6 + 4] = this.B[i * 3 + 1]; p[i * 6 + 5] = this.B[i * 3 + 2];
      aa[i * 2] = a; aa[i * 2 + 1] = a;
      if (a > 0.002) live = i + 1;
    }
    const k = Math.min(this.cnt, live + 1);
    this.geo.setDrawRange(0, Math.max(0, (k - 1) * 6));
    this.pos.needsUpdate = true; this.aA.needsUpdate = true;
  }
  clear() { this.cnt = 0; this.geo.setDrawRange(0, 0); }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.obj.removeFromParent(); }
}

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Emission presets. Each takes the two particle pools, a world position, an intensity k (≈ particles per call
 * scale) and optional params { dir:[x,y,z] (unit, world), col, scale }.
 */
export const PRESETS = {
  ember(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [4.5, 1.6, 0.35];
    add.emit(p[0] + rnd(-0.1, 0.1) * s, p[1] + rnd(-0.1, 0.1) * s, p[2] + rnd(-0.1, 0.1) * s, rnd(-0.4, 0.4) * s, rnd(0.6, 1.8) * s, rnd(-0.4, 0.4) * s,
      rnd(0.7, 1.5), rnd(0.07, 0.13) * s, 0.02 * s, [c[0], c[1], c[2], 1], [c[0] * 0.5, c[1] * 0.15, c[2] * 0.1, 0], 0.9 * s, 0.6);
  },
  flame(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [5, 2.1, 0.55], d = o.dir;
    const up = o.up ?? 1.8;
    // licks: small, fast-rising, shrinking; hot core fading to deep red
    add.emit(p[0] + rnd(-0.08, 0.08) * s, p[1] + rnd(-0.05, 0.05) * s, p[2] + rnd(-0.08, 0.08) * s,
      (rnd(-0.3, 0.3) + (d ? d[0] * 1.6 : 0)) * s, (rnd(1.0, 1.8) * up + (d ? d[1] * 1.6 : 0)) * s, (rnd(-0.3, 0.3) + (d ? d[2] * 1.6 : 0)) * s,
      rnd(0.22, 0.42), rnd(0.2, 0.34) * s, 0.03 * s, [c[0] * 1.1, c[1] * 1.15, c[2] * 1.2, 0.9], [c[0] * 0.5, c[1] * 0.12, c[2] * 0.05, 0], 1.6 * s, 1.0);
  },
  smoke(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [0.05, 0.04, 0.04];
    alpha.emit(p[0] + rnd(-0.1, 0.1) * s, p[1], p[2] + rnd(-0.1, 0.1) * s, rnd(-0.2, 0.2) * s, rnd(0.5, 0.9) * s, rnd(-0.2, 0.2) * s,
      rnd(1.2, 2.2), rnd(0.25, 0.4) * s, rnd(0.9, 1.4) * s, [c[0], c[1], c[2], o.a ?? 0.32], [c[0], c[1], c[2], 0], 0.2 * s, 0.9);
  },
  steam(add, alpha, p, k, o) {
    const s = o.scale ?? 1, d = o.dir || [0, -0.3, -1], v = rnd(1.4, 2.6) * s;
    alpha.emit(p[0], p[1], p[2], d[0] * v + rnd(-0.25, 0.25) * s, d[1] * v + rnd(-0.1, 0.3) * s, d[2] * v + rnd(-0.25, 0.25) * s,
      rnd(0.8, 1.3), rnd(0.12, 0.2) * s, rnd(0.6, 0.95) * s, [0.85, 0.82, 0.8, 0.38], [0.7, 0.68, 0.7, 0], 0.5 * s, 2.2);
  },
  ghost(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [0.9, 0.8, 3.2];
    add.emit(p[0] + rnd(-0.3, 0.3) * s, p[1] + rnd(-0.2, 0.2) * s, p[2] + rnd(-0.3, 0.3) * s, rnd(-0.2, 0.2) * s, rnd(0.5, 1.2) * s, rnd(-0.2, 0.2) * s,
      rnd(0.9, 1.8), rnd(0.25, 0.45) * s, 0.05 * s, [c[0], c[1], c[2], 0.5], [c[0] * 0.3, c[1] * 0.3, c[2] * 0.6, 0], 0.4 * s, 0.8);
  },
  void(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [1.9, 0.5, 4.2];
    add.emit(p[0] + rnd(-0.08, 0.08) * s, p[1], p[2] + rnd(-0.08, 0.08) * s, rnd(-0.3, 0.3) * s, rnd(1.2, 2.2) * s, rnd(-0.3, 0.3) * s,
      rnd(0.25, 0.5), rnd(0.18, 0.3) * s, 0.03 * s, [c[0], c[1], c[2], 0.85], [c[0] * 0.3, c[1] * 0.1, c[2] * 0.4, 0], 1.2 * s, 1.1);
    if (Math.random() < 0.35) alpha.emit(p[0], p[1] + 0.1 * s, p[2], rnd(-0.2, 0.2) * s, rnd(0.8, 1.4) * s, rnd(-0.2, 0.2) * s,
      rnd(0.6, 1.1), rnd(0.2, 0.32) * s, rnd(0.6, 0.9) * s, [0.03, 0.0, 0.06, 0.4], [0.02, 0.0, 0.04, 0], 0.4 * s, 1.0);
  },
  breath(add, alpha, p, k, o) {
    // directed jet: fast, spreading, growing puffs with a hot core (cone attacks)
    const s = o.scale ?? 1, c = o.col ?? [5.5, 2.3, 0.6], d = o.dir || [0, 0, -1];
    const v = rnd(9, 14) * s, sp = 0.22;
    add.emit(p[0], p[1], p[2], (d[0] + rnd(-sp, sp)) * v, (d[1] + rnd(-sp, sp) * 0.6) * v, (d[2] + rnd(-sp, sp)) * v,
      rnd(0.45, 0.7), rnd(0.25, 0.4) * s, rnd(1.2, 1.9) * s, [c[0] * 1.2, c[1] * 1.3, c[2] * 1.4, 0.75], [c[0] * 0.4, c[1] * 0.1, c[2] * 0.05, 0], 1.5 * s, 1.6);
    if (Math.random() < 0.25) alpha.emit(p[0], p[1], p[2], d[0] * v * 0.6, d[1] * v * 0.6 + 1, d[2] * v * 0.6, rnd(0.8, 1.2), 0.5 * s, 2.2 * s, [0.06, 0.04, 0.04, 0.25], [0.05, 0.04, 0.04, 0], 1.0 * s, 1.5);
  },
  spark(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [6, 3.2, 1.2];
    const n = Math.max(1, Math.round(k));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = rnd(0.2, 1.2), v = rnd(3, 9) * s;
      add.emit(p[0], p[1], p[2], Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v,
        rnd(0.35, 0.8), rnd(0.07, 0.12) * s, 0.02 * s, [c[0], c[1], c[2], 1], [c[0] * 0.4, c[1] * 0.1, 0, 0], -9.8 * s, 0.4);
    }
  },
  dust(add, alpha, p, k, o) {
    const s = o.scale ?? 1, c = o.col ?? [0.32, 0.27, 0.22];
    const n = Math.max(1, Math.round(k));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(1.5, 4.5) * s;
      alpha.emit(p[0] + Math.cos(a) * 0.3 * s, p[1] + 0.1 * s, p[2] + Math.sin(a) * 0.3 * s, Math.cos(a) * v, rnd(0.3, 1.2) * s, Math.sin(a) * v,
        rnd(0.8, 1.6), rnd(0.4, 0.7) * s, rnd(1.4, 2.2) * s, [c[0], c[1], c[2], 0.5], [c[0], c[1], c[2], 0], 0.1 * s, 2.5);
    }
  },
};
