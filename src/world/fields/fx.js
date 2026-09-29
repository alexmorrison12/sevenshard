// Field ambience, one draw call each:
//   Mist        drifting ground-fog sheets that follow the player; they fade out where the terrain rises through them
//   buildSmoke  rising smoke plumes (burning buildings, campfires, chimneys, vents): soft billboards, lit from below
//   Drifters    camera-surrounding sprites that tumble through the air: leaves, petals, pollen fluff, ash flakes
//   Butterflies little flapping wings that wander around flower beds
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../../engine/materials.js';
import { linColor } from '../../engine/geom.js';
import { noiseTex } from '../textures.js';

// ------------------------------------------------------------------------------------------------ mist
/**
 * layers: [{ y (above ground), alpha, scale (noise metres), speed [x, z], color hex }] — each a 70×60 m sheet
 * centred on the focus. ground: FieldGround (height texture) so sheets thin out over hills.
 */
export class Mist {
  constructor(ground, layers, { w = 70, d = 60, north = 6 } = {}) {
    this.north = north;
    this.group = new THREE.Group(); this.group.name = 'mist';
    this.mats = [];
    for (const L of layers) {
      const g = new THREE.PlaneGeometry(w, d, 1, 1); g.rotateX(-Math.PI / 2);
      const u = {
        uTime: G.uTime, uNoise: { value: noiseTex() }, uHeight: { value: ground.heightTex }, uHXf: { value: ground.heightInfo },
        uCol: { value: new THREE.Color(L.color ?? 0xc8d8e0) }, uA: { value: L.alpha ?? 0.3 }, uY: { value: L.y ?? 1 }, uSc: { value: L.scale ?? 18 },
        uSp: { value: new THREE.Vector2(...(L.speed || [0.4, 0.15])) }, uHalf: { value: new THREE.Vector2(w / 2, d / 2) }, uC: { value: new THREE.Vector2() },
        uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: u, transparent: true, depthWrite: false,
        vertexShader: /* glsl */`
          uniform sampler2D uHeight; uniform vec4 uHXf; uniform float uY; uniform vec2 uC; varying vec3 vW; varying float vGy;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); w.xz += uC; vGy = 0.0; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */`
          uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uHeight; uniform vec4 uHXf; uniform vec3 uCol; uniform float uA; uniform float uY; uniform float uSc; uniform vec2 uSp; uniform vec2 uHalf; uniform vec2 uC;
          varying vec3 vW; varying float vGy;
          ${FOG_GLSL_PARS}
          void main() {
            float gy = texture2D(uHeight, (vW.xz - uHXf.xy) / uHXf.zw).r;
            float above = vW.y - gy;                      // sheet height above the local ground
            float n1 = texture2D(uNoise, vW.xz / uSc + uSp * uTime * 0.01).r;
            float n2 = texture2D(uNoise, vW.xz / (uSc * 0.37) - uSp.yx * uTime * 0.017).g;
            float a = smoothstep(0.38, 0.78, n1 * 0.75 + n2 * 0.45) * uA;
            a *= smoothstep(0.05, 0.9, above) * smoothstep(uY * 3.0 + 3.0, uY, above);
            vec2 e = abs(vW.xz - uC) / uHalf; a *= smoothstep(1.0, 0.7, max(e.x, e.y));
            if (a < 0.004) discard;
            vec3 col = applyFog(uCol, vW);
            gl_FragColor = vec4(col, a);
          }`,
      });
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 6; m.userData.y = L.y ?? 1;
      this.group.add(m); this.mats.push(u);
    }
  }
  update(focus, heightAt) {
    if (!focus) return;
    const cx = focus.x, cz = focus.z - this.north, gy = heightAt ? heightAt(focus.x, focus.z) : 0;
    this.group.children.forEach((m, i) => { const u = this.mats[i]; u.uC.value.set(cx, cz); m.position.y = gy + m.userData.y; });
  }
}

// ------------------------------------------------------------------------------------------------ smoke
/**
 * list: [{ x, y, z, size (puff radius m), h (column height), rate (0.5–2), color hex, glow hex|null (fire below), dark }]
 * One mesh: `puffs` billboards per source loop upward, grow and fade; the lower part is tinted by the fire glow.
 */
export function buildSmoke(list, { puffs = 9 } = {}) {
  if (!list.length) return null;
  const corner = [], center = [], prm = [], col = [], glow = [], idx = [];
  let q = 0;
  list.forEach((s, si) => {
    const c = linColor(s.color ?? 0x3a3432), gl = s.glow != null ? linColor(s.glow) : [0, 0, 0];
    const n = s.puffs ?? puffs;
    for (let i = 0; i < n; i++) {
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        corner.push(cx, cy); center.push(s.x, s.y, s.z);
        prm.push(i / n + (si * 0.618) % 1, s.size ?? 1.2, s.h ?? 9, s.rate ?? 1);
        col.push(c[0], c[1], c[2]); glow.push(gl[0], gl[1], gl[2]);
      }
      const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); q++;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('prm', new THREE.Float32BufferAttribute(prm, 4));
  g.setAttribute('scol', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sglow', new THREE.Float32BufferAttribute(glow, 3));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.boundingSphere.radius += 20;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos, uWind: G.uWind },
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute vec4 prm; attribute vec3 scol; attribute vec3 sglow;
      uniform float uTime; uniform vec2 uWind; varying vec2 vC; varying float vT; varying vec3 vCol; varying vec3 vGlow; varying vec3 vW; varying float vSeed;
      void main() {
        float t = fract(prm.x + uTime * 0.07 * prm.w);
        float size = prm.y * (0.55 + t * 2.1);
        vec3 p = position + vec3(uWind.x * t * t * prm.z * 0.35, t * prm.z, uWind.y * t * t * prm.z * 0.35);
        p.x += sin(uTime * 0.6 + prm.x * 17.0) * t * 0.8;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = prm.x * 40.0 + uTime * 0.2;
        vec2 cr = mat2(cos(a), -sin(a), sin(a), cos(a)) * corner;
        p += (right * cr.x + up * cr.y) * size;
        vC = corner; vT = t; vCol = scol; vGlow = sglow; vW = p; vSeed = prm.x;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; varying vec2 vC; varying float vT; varying vec3 vCol; varying vec3 vGlow; varying vec3 vW; varying float vSeed;
      ${FOG_GLSL_PARS}
      void main() {
        float r = length(vC);
        float n = texture2D(uNoise, vC * 0.22 + vec2(vSeed * 7.0, vSeed * 3.0 - uTime * 0.02)).g;
        float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7);
        a *= smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.45, vT) * 0.55;
        if (a < 0.01) discard;
        vec3 col = vCol * (0.75 + n * 0.5) + vGlow * smoothstep(0.45, 0.0, vT) * 1.6;
        col = applyFog(col, vW);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 7; m.name = 'smoke';
  return m;
}

// ------------------------------------------------------------------------------------------------ drifters
const DKINDS = {
  leaves: { colors: [0x8a6a20, 0xb08a30, 0x6a7a24, 0x9a4a1a], size: 0.16, fall: 0.55, count: 70, box: [40, 12, 34], spin: 2.5 },
  petals: { colors: [0xffd0e0, 0xffffff, 0xffe0f0], size: 0.09, fall: 0.35, count: 90, box: [40, 10, 34], spin: 3 },
  fluff: { colors: [0xfff6d8, 0xfff0c0], size: 0.07, fall: -0.05, count: 110, box: [42, 8, 34], spin: 1 },
  ash: { colors: [0x3a3634, 0x5a5250, 0x2a2626], size: 0.08, fall: 0.4, count: 160, box: [42, 14, 34], spin: 2 },
};
/** tumbling sprites around the focus: kind 'leaves' | 'petals' | 'fluff' (pollen/dandelion seeds) | 'ash' */
export function buildDrifters(kind, { count = null, quality = 1, scale = 1, colors = null } = {}) {
  const K = DKINDS[kind];
  const n = Math.round((count ?? K.count) * quality);
  const pal = (colors || K.colors).map(linColor);
  const corner = [], seed = [], col = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()], c = pal[i % pal.length];
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { corner.push(cx, cy); seed.push(...s); col.push(...c); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 12), 3));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
  g.setAttribute('dcol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const u = { uTime: G.uTime, uWind: G.uWind, uFocus: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...K.box).multiplyScalar(scale) }, uSize: { value: K.size * scale }, uFall: { value: K.fall * scale }, uSpin: { value: K.spin }, uSunDir: G.uSunDir };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, transparent: true, depthWrite: true,
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute vec4 seed; attribute vec3 dcol;
      uniform float uTime; uniform vec2 uWind; uniform vec3 uFocus; uniform vec3 uBox; uniform float uSize; uniform float uFall; uniform float uSpin;
      varying vec3 vCol; varying float vA; varying vec2 vC; varying float vLit;
      void main() {
        vec3 p = seed.xyz * uBox + vec3(uWind.x * 0.9, -uFall, uWind.y * 0.9) * uTime * (0.6 + seed.w * 0.8);
        p.x += sin(uTime * (0.7 + seed.w) + seed.y * 20.0) * 0.8; p.z += cos(uTime * 0.6 + seed.x * 30.0) * 0.6;
        vec3 base = uFocus - uBox * 0.5; base.y = uFocus.y - 1.0;
        vec3 w = base + mod(p - base, uBox);
        float a1 = uTime * uSpin * (0.5 + seed.w) + seed.x * 30.0, a2 = uTime * uSpin * 0.7 + seed.y * 20.0;
        vec3 ax = vec3(cos(a1), sin(a2) * 0.6, sin(a1)), ay = normalize(cross(ax, vec3(sin(a2), 1.0, cos(a2))));
        vec3 pos = w + (ax * corner.x + ay * corner.y * 0.6) * uSize;
        vLit = 0.6 + 0.4 * abs(ay.y);
        float yf = (w.y - base.y) / uBox.y; vec2 dxz = (w.xz - uFocus.xz) / (uBox.xz * 0.5);
        vA = smoothstep(0.0, 0.1, yf) * smoothstep(1.0, 0.8, yf) * smoothstep(1.0, 0.75, max(abs(dxz.x), abs(dxz.y)));
        vCol = dcol; vC = corner;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA; varying vec2 vC; varying float vLit;
      void main() { float d = length(vC * vec2(1.0, 1.4)); if (d > 1.0 || vA < 0.05) discard; gl_FragColor = vec4(vCol * vLit * 1.25, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'drift:' + kind;
  m.userData.update = (focus) => { if (focus) u.uFocus.value.set(focus.x, focus.y ?? 0, focus.z); };
  return m;
}

// ------------------------------------------------------------------------------------------------ butterflies
/** spots: [[x, y, z]…] flower beds; each butterfly orbits its spot lazily with flapping wings */
export function buildButterflies(spots, { perSpot = 3, colors = [0xffd040, 0xffffff, 0xff8ac0, 0x8ac0ff, 0xff9a30], scale = 1 } = {}) {
  if (!spots.length) return null;
  const pal = colors.map(linColor);
  const pos = [], wing = [], prm = [], col = [], idx = [];
  let q = 0;
  for (const [x, y, z] of spots) for (let i = 0; i < perSpot; i++) {
    const ph = Math.random() * 100, c = pal[Math.floor(Math.random() * pal.length)];
    for (const side of [-1, 1]) {
      for (const [u, v] of [[0, -0.5], [side, -0.7], [side, 0.8], [0, 0.5]]) { pos.push(x, y, z); wing.push(u, v, side); prm.push(ph, 1.5 + Math.random() * 2.5, 0.8 + Math.random() * 1.5, scale); col.push(...c); }
      const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); q++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('wing', new THREE.Float32BufferAttribute(wing, 3));
  g.setAttribute('prm', new THREE.Float32BufferAttribute(prm, 4));
  g.setAttribute('bcol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius += 8;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 wing; attribute vec4 prm; attribute vec3 bcol; uniform float uTime; varying vec3 vCol; varying vec2 vUv;
      void main() {
        float t = uTime * 0.35 + prm.x;
        vec3 c = position + vec3(sin(t * 1.3) * prm.y + sin(t * 3.1) * 0.4, 0.6 + sin(t * 2.3) * 0.35 * prm.z, cos(t * 1.1) * prm.y + cos(t * 2.7) * 0.4) * prm.w;
        vec3 fwd = normalize(vec3(cos(t * 1.3) * 1.3, 0.0, -sin(t * 1.1) * 1.1) + 1e-4);
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
        float flap = sin(uTime * 22.0 + prm.x * 9.0) * 0.9;
        float s = 0.11 * prm.w;
        vec3 p = c + fwd * wing.y * s + (side * cos(flap) * wing.x + vec3(0.0, 1.0, 0.0) * sin(flap) * abs(wing.x)) * s;
        vCol = bcol; vUv = wing.xy;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`varying vec3 vCol; varying vec2 vUv; void main() { float edge = smoothstep(0.7, 1.0, abs(vUv.x)); gl_FragColor = vec4(mix(vCol * 1.3, vCol * 0.35, edge * 0.6), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'butterflies';
  return m;
}
