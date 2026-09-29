// Ambient zone FX, each one draw call:
//   Flames      billboard torch/brazier/candle flames (+ soft halo), HDR so they bloom
//   LightPool   the K nearest light sources to the player become real PointLights (with flicker)
//   Particles   camera-surrounding embers / dust motes / snow / ash / void motes / fireflies (GPU-animated)
//   Flags       banners and pennants waving in the wind (vertex shader)
//   Shafts      fake god rays: additive, noise-broken light planes
import * as THREE from 'three';
import { G, FOG_GLSL_PARS, lambert } from '../engine/materials.js';
import { linColor } from '../engine/geom.js';
import { noiseTex, kitTex } from './textures.js';
import { cutF, cutV } from './kit.js';

// ---------------------------------------------------------------- flames
export function buildFlames(list) {
  if (!list.length) return null;
  const n = list.length;
  const corner = [], center = [], size = [], phase = [], color = [], idx = [];
  list.forEach((f, i) => {
    for (const [cx, cy] of [[-1, -0.6], [1, -0.6], [1, 1.6], [-1, 1.6]]) { corner.push(cx, cy); center.push(f.x, f.y, f.z); size.push(f.size); phase.push(i * 1.618 % 1); color.push(...linColor(f.color ?? 0xffa040)); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
  g.setAttribute('fcol', new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() } },
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute float size; attribute float phase; attribute vec3 fcol;
      uniform float uTime; varying vec2 vC; varying float vPh; varying vec3 vCol;
      void main() {
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(0.0, 1.0, 0.0);
        float s = size * (0.92 + 0.12 * sin(uTime * 13.0 + phase * 40.0));
        vec3 p = position + right * corner.x * s + up * corner.y * s;
        vC = corner; vPh = phase; vCol = fcol;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; varying vec2 vC; varying float vPh; varying vec3 vCol;
      void main() {
        vec2 c = vC; float y = (c.y + 0.6) / 2.2;
        float n = texture2D(uNoise, vec2(c.x * 0.25 + vPh * 7.0, y * 0.5 - uTime * 1.3 + vPh)).g;
        float n2 = texture2D(uNoise, vec2(c.x * 0.5 + vPh * 3.0, y * 1.1 - uTime * 2.1)).b;
        float w = mix(0.62, 0.02, pow(y, 0.8)) * (0.8 + n * 0.5);
        float x = c.x + (n2 - 0.5) * 0.5 * y;
        float body = smoothstep(w, w * 0.25, abs(x)) * smoothstep(0.0, 0.14, y) * smoothstep(1.0, 0.45, y + n2 * 0.25);
        float core = smoothstep(w * 0.55, 0.0, abs(x)) * smoothstep(0.55, 0.1, y);
        float halo = smoothstep(1.2, 0.0, length(vec2(c.x, (c.y - 0.2) * 0.9))) * 0.16;
        vec3 col = vCol * body * 2.4 + vec3(1.0, 0.9, 0.7) * core * 2.6 + vCol * halo;
        float a = max(body, halo);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = true; m.renderOrder = 8; m.name = 'flames';
  return m;
}

// ---------------------------------------------------------------- light pool
export class LightPool {
  constructor(parent, lights, K = 4) {
    this.src = lights; this.K = K;
    this.pl = [];
    for (let i = 0; i < K; i++) { const l = new THREE.PointLight(0xffa850, 0, 10, 1.6); l.castShadow = false; parent.add(l); this.pl.push(l); }
    this.assigned = new Array(K).fill(null);
    this._t = 0; this._fx = 1e9; this._fz = 1e9;
    this.scale = 1;
  }
  update(dt, t, focus) {
    if (!focus) return;
    this._t -= dt;
    if (this._t <= 0 || Math.hypot(focus.x - this._fx, focus.z - this._fz) > 1.5) {
      this._t = 0.3; this._fx = focus.x; this._fz = focus.z;
      const best = this.src.map(l => [l, (l.x - focus.x) ** 2 + ((l.z - focus.z) * 1.4) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, this.K);
      for (let i = 0; i < this.K; i++) this.assigned[i] = best[i] ? best[i][0] : null;
    }
    for (let i = 0; i < this.K; i++) {
      const l = this.pl[i], s = this.assigned[i];
      if (!s) { l.intensity = 0; continue; }
      l.position.set(s.x, s.y, s.z); l.color.set(s.color); l.distance = s.radius;
      const fl = s.flicker ? 1 + s.flicker * (Math.sin(t * 11 + s.x) * 0.5 + Math.sin(t * 23.7 + s.z * 2) * 0.3 + Math.sin(t * 5.3) * 0.2) : 1;
      l.intensity = s.intensity * fl * this.scale;
    }
  }
}

// ---------------------------------------------------------------- ambient particles
const KINDS = {
  embers: { color: [4.0, 1.4, 0.35], size: 0.07, vel: [0.2, 0.9, 0.1], swirl: 0.6, count: 260, add: true, box: [36, 10, 30] },
  dust: { color: [1.3, 1.2, 0.95], size: 0.045, vel: [0.12, 0.05, 0.04], swirl: 0.35, count: 320, add: true, box: [36, 7, 30] },
  snow: { color: [1.1, 1.15, 1.25], size: 0.06, vel: [0.35, -1.1, 0.2], swirl: 0.5, count: 900, add: false, box: [40, 16, 34] },
  ash: { color: [0.3, 0.28, 0.28], size: 0.06, vel: [0.25, -0.5, 0.12], swirl: 0.6, count: 500, add: false, box: [40, 14, 34] },
  motes: { color: [2.2, 0.8, 3.0], size: 0.06, vel: [0.05, 0.45, 0.05], swirl: 0.8, count: 300, add: true, box: [38, 9, 32] },
  fireflies: { color: [2.4, 3.0, 0.8], size: 0.06, vel: [0.1, 0.12, 0.1], swirl: 1.2, count: 90, add: true, box: [34, 4, 28] },
};
export function buildParticles(kind, { count = null, quality = 1, color = null, yBase = 0 } = {}) {
  const K = KINDS[kind]; if (!K) return null;
  const n = Math.round((count ?? K.count) * quality);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const u = {
    uTime: G.uTime, uFocus: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...K.box) }, uVel: { value: new THREE.Vector3(...K.vel) },
    uSwirl: { value: K.swirl }, uSize: { value: K.size }, uCol: { value: new THREE.Vector3(...(color || K.color)) }, uScale: { value: 900 }, uYBase: { value: yBase },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      attribute vec4 seed; uniform float uTime; uniform vec3 uFocus; uniform vec3 uBox; uniform vec3 uVel; uniform float uSwirl; uniform float uSize; uniform float uScale; uniform float uYBase;
      varying float vA; varying float vTw;
      void main() {
        vec3 p = seed.xyz * uBox + uVel * uTime * (0.6 + seed.w * 0.8);
        p.x += sin(uTime * 0.7 + seed.w * 30.0) * uSwirl; p.z += cos(uTime * 0.6 + seed.x * 30.0) * uSwirl;
        vec3 base = uFocus - uBox * 0.5; base.y = uFocus.y + uYBase - 1.0;
        vec3 w = base + mod(p - base, uBox);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float yf = (w.y - base.y) / uBox.y;
        vA = smoothstep(0.0, 0.15, yf) * smoothstep(1.0, 0.7, yf);
        vec2 dxz = (w.xz - uFocus.xz) / (uBox.xz * 0.5);
        vA *= smoothstep(1.0, 0.75, max(abs(dxz.x), abs(dxz.y)));
        vTw = 0.6 + 0.4 * sin(uTime * (2.0 + seed.w * 4.0) + seed.y * 20.0);
        gl_PointSize = uSize * uScale / -mv.z * (0.6 + seed.w * 0.8);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA; varying float vTw;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.1, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol * vTw, a); }`,
    transparent: true, depthWrite: false, blending: K.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 9; pts.name = 'particles:' + kind;
  pts.userData.u = u;
  pts.userData.update = (focus) => { if (focus) u.uFocus.value.set(focus.x, focus.y ?? 0, focus.z); u.uScale.value = innerHeight * 1.1; };
  return pts;
}

// ---------------------------------------------------------------- flags & banners
// Collect cloth quads that wave: flags.add(matrix, w, h, colour, { pole: 'left'|'top', emblem })
export class Flags {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.sway = []; this.nrm = []; this.idx = []; this.ph = []; }
  add(m, w, h, color = 0xc03030, { hang = 'top', segs = 6, trim = 0xd8b060, phase = Math.random() * 6 } = {}) {
    const c = linColor(color), tc = linColor(trim);
    const base = this.pos.length / 3;
    const v = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1).transformDirection(m);
    for (let j = 0; j <= segs; j++) for (let i = 0; i <= 2; i++) {
      const u = i / 2, t = j / segs;
      // hang 'top': attached along the top edge, free at the bottom; 'left': attached to a pole on the left
      let x, y, sw;
      if (hang === 'top') { x = (u - 0.5) * w; y = -t * h; sw = t; }
      else { x = t * w; y = -u * h; sw = t; }
      v.set(x, y, 0).applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z); this.nrm.push(n.x, n.y, n.z);
      this.uv.push(hang === 'top' ? u : t, hang === 'top' ? 1 - t : 1 - u);
      const edge = hang === 'top' ? (t > 0.9 || u === 0 || u === 1 ? 1 : 0) : (u === 0 || u === 1 || t > 0.95 ? 1 : 0);
      const cc = edge && hang === 'top' && t > 0.9 ? tc : c;
      this.col.push(cc[0], cc[1], cc[2]); this.sway.push(sw); this.ph.push(phase);
    }
    for (let j = 0; j < segs; j++) for (let i = 0; i < 2; i++) {
      const a = base + j * 3 + i, b = a + 1, cc = a + 3, d = cc + 1;
      this.idx.push(a, cc, b, b, cc, d);
    }
  }
  build() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setAttribute('fph', new THREE.Float32BufferAttribute(this.ph, 1));
    g.setIndex(this.idx); g.computeBoundingSphere();
    const t = kitTex('cloth');
    const mat = lambert({ map: t.map, vertexColors: true, side: THREE.DoubleSide }, {
      wrap: 0.6, trans: 0.45, key: 'flags', uniforms: { uPlayerPos: G.uPlayerPos },
      vertex: vs => cutV(vs.replace('#include <common>', '#include <common>\nattribute float sway; attribute float fph;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { float w = sin(uTime * 3.1 + fph + position.y * 1.7 + position.x * 0.6) * 0.5 + sin(uTime * 5.3 + fph * 2.0 + position.y * 3.1) * 0.25;
            transformed.xz += vec2(uWind.x, uWind.y) * w * sway * 0.22;
            transformed.x += sin(uTime * 2.3 + fph) * sway * 0.08; }`)),
      fragment: fs => cutF(fs),
    });
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'flags';
    return mesh;
  }
}

// ---------------------------------------------------------------- light shafts
export function buildShafts(list) {
  // list: [{ x, y, z, w, h, rot, color, alpha }] — vertical-ish planes tilted along the sun
  if (!list.length) return null;
  const pos = [], uv = [], idx = [], col = [];
  for (const s of list) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s.tilt ?? -0.5, s.rot ?? 0, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const b = pos.length / 3;
    const c = linColor(s.color ?? 0xffe0a0);
    for (const [x, y, u, v] of [[-s.w / 2, 0, 0, 0], [s.w / 2, 0, 1, 0], [s.w / 2, s.h, 1, 1], [-s.w / 2, s.h, 0, 1]]) {
      const p = new THREE.Vector3(x, y, 0).applyMatrix4(m); pos.push(p.x, p.y, p.z); uv.push(u, v); col.push(c[0] * (s.alpha ?? 0.35), c[1] * (s.alpha ?? 0.35), c[2] * (s.alpha ?? 0.35));
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('scol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() } },
    vertexShader: `attribute vec3 scol; varying vec2 vUv; varying vec3 vCol; varying vec3 vW; void main(){ vUv = uv; vCol = scol; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vCol; varying vec3 vW;
      void main(){ float n = texture2D(uNoise, vec2(vUv.x * 0.8 + uTime * 0.01, vUv.y * 0.15)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 2.3 - uTime * 0.02, 0.3)).g;
        float a = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        a *= smoothstep(0.25, 0.75, n * 0.7 + n2 * 0.6);
        gl_FragColor = vec4(vCol * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 7; mesh.name = 'shafts';
  return mesh;
}
