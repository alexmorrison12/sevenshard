// Water & lava.
//   buildWater(ground, { x, z, w, d, level, shallow, deep })   sea/lake/harbour: depth-tinted (reads the ground's
//        height texture), animated ripples, sky fresnel, sun glints, shoreline foam, gentle swell
//   buildPool({ x, z, r, y })                                   fountain basins / small pools (no depth lookup)
//   buildLava(ground, { x, z, w, d, level })                   crusted, glowing, slowly churning lava (HDR → bloom)
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../engine/materials.js';
import { noiseTex } from './textures.js';

const common = () => ({
  uTime: G.uTime, uNoise: { value: noiseTex() }, uDesat: G.uDesat,
  uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
});

const WATER_VS = /* glsl */`
uniform float uTime; uniform float uSwell;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += (sin(w.x * 0.21 + uTime * 0.9) * 0.5 + sin(w.z * 0.17 - uTime * 0.7) * 0.5 + sin((w.x + w.z) * 0.37 + uTime * 1.3) * 0.25) * uSwell;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FS = /* glsl */`
uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uHeight; uniform vec4 uHXf; uniform float uHasDepth;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSunCol; uniform float uDesat; uniform float uFoamAmt; uniform float uLevel;
varying vec3 vW;
${FOG_GLSL_PARS}
void main() {
  float ground = uHasDepth > 0.5 ? texture2D(uHeight, (vW.xz - uHXf.xy) / uHXf.zw).r : uLevel - 2.0;
  float depth = max(uLevel - ground, 0.0);
  vec2 uv = vW.xz;
  vec4 n1 = texture2D(uNoise, uv / 21.0 + vec2(uTime * 0.013, uTime * 0.008));
  vec4 n2 = texture2D(uNoise, uv / 7.5 - vec2(uTime * 0.02, -uTime * 0.012));
  vec4 n3 = texture2D(uNoise, uv / 3.1 + vec2(-uTime * 0.03, uTime * 0.025));
  vec3 nrm = normalize(vec3((n1.g - 0.5) * 0.7 + (n2.b - 0.5) * 0.5 + (n3.g - 0.5) * 0.25, 1.0, (n1.b - 0.5) * 0.7 + (n2.g - 0.5) * 0.5 + (n3.b - 0.5) * 0.25));
  vec3 v = normalize(uCamPos - vW);
  float fres = pow(1.0 - max(dot(nrm, v), 0.0), 4.0) * 0.75 + 0.06;
  vec3 base = mix(uShallow, uDeep, smoothstep(0.2, 4.5, depth));
  // painted caustic / ripple bands
  float band = smoothstep(0.6, 0.7, n2.r * 0.6 + n1.r * 0.5);
  base += vec3(0.07, 0.11, 0.1) * band * smoothstep(0.2, 2.5, depth);
  float caus = smoothstep(0.55, 0.75, n3.r * 0.5 + n2.g * 0.5) * smoothstep(3.0, 0.4, depth);
  base += vec3(0.12, 0.16, 0.12) * caus;
  vec3 col = mix(base, uSky, fres);
  vec3 h = normalize(uSunDir + v);
  float nh = max(dot(nrm, h), 0.0);
  col += uSunCol * (pow(nh, 260.0) * 4.0 + pow(nh, 36.0) * 0.12);
  // shoreline foam: animated lapping rings where it is shallow
  float lap = sin(depth * 8.0 - uTime * 2.1 + n1.r * 6.0) * 0.5 + 0.5;
  float foam = smoothstep(0.45, 0.0, depth) * 0.9 + smoothstep(1.1, 0.25, depth) * smoothstep(0.72, 0.95, lap) * 0.6;
  foam *= smoothstep(0.3, 0.55, n2.g + 0.2) * uFoamAmt;
  col = mix(col, vec3(0.94, 0.97, 1.0), clamp(foam, 0.0, 1.0));
  float alpha = clamp(smoothstep(0.0, 1.2, depth) * 0.72 + 0.28 + fres * 0.3 + foam, 0.0, 1.0);
  col = applyFog(col, vW);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  gl_FragColor = vec4(col, alpha);
}`;

/** Water plane covering rect (x,z centre, w×d) at `level`. Depth comes from ground.heightTex when ground is given. */
export function buildWater(ground, { x, z, w, d, level = 0, shallow = 0x3fb0a8, deep = 0x154f72, sky = 0xa8c8e0, swell = 0.05, seg = 2, foam = 1 } = {}) {
  const u = {
    ...common(), uHeight: { value: ground?.heightTex || null }, uHXf: { value: ground?.heightInfo || new THREE.Vector4() }, uHasDepth: { value: ground ? 1 : 0 },
    uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color(sky) }, uSunCol: { value: new THREE.Color(0xfff0d0) },
    uLevel: { value: level }, uSwell: { value: swell }, uFoamAmt: { value: foam },
  };
  const g = new THREE.PlaneGeometry(w, d, Math.ceil(w / seg), Math.ceil(d / seg)); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: u, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(g, mat); m.position.set(x, level, z); m.renderOrder = 5; m.name = 'water';
  m.userData.u = u;
  m.userData.setEnv = env => { u.uSky.value.set(env.fogColor).lerp(new THREE.Color(env.hemiSky), 0.5); u.uSunCol.value.set(env.sunColor).multiplyScalar(Math.min(1.2, env.sunIntensity / 3)); };
  return m;
}

/** Small circular pool surface (fountain basins). */
export function buildPool({ x, z, r, y, shallow = 0x4fc0c0, deep = 0x1f6a8a }) {
  const u = { ...common(), uHeight: { value: null }, uHXf: { value: new THREE.Vector4() }, uHasDepth: { value: 0 }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color(0xb0d0e8) }, uSunCol: { value: new THREE.Color(0xfff0d0) }, uLevel: { value: y }, uSwell: { value: 0.0 }, uFoamAmt: { value: 0 } };
  const g = new THREE.CircleGeometry(r, 32); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: u, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.renderOrder = 5; m.name = 'pool';
  m.userData.setEnv = env => { u.uSky.value.set(env.fogColor).lerp(new THREE.Color(env.hemiSky), 0.5); u.uSunCol.value.set(env.sunColor); };
  return m;
}

const LAVA_FS = /* glsl */`
uniform float uTime; uniform sampler2D uNoise; uniform vec3 uHot; uniform vec3 uCool; uniform float uDesat;
varying vec3 vW;
${FOG_GLSL_PARS}
void main() {
  vec2 uv = vW.xz;
  vec2 flow = vec2(uTime * 0.02, uTime * 0.013);
  float a = texture2D(uNoise, uv / 17.0 + flow).r;
  float b = texture2D(uNoise, uv / 6.0 - flow * 1.7 + a * 0.3).g;
  float c = texture2D(uNoise, uv / 2.5 + vec2(b, a) * 0.2 + flow * 2.0).b;
  float crust = smoothstep(0.42, 0.62, a * 0.55 + b * 0.45 + c * 0.2 - 0.1);
  float heat = 1.0 - crust;
  float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + uv.x * 0.2 + uv.y * 0.15);
  vec3 col = mix(uCool * 0.55, vec3(0.08, 0.05, 0.04), crust);
  col += uHot * pow(heat, 1.5) * 3.2 * pulse + vec3(1.0, 0.9, 0.5) * pow(heat, 5.0) * 2.5;
  col = applyFog(col, vW);
  gl_FragColor = vec4(col, 1.0);
}`;
export function buildLava({ x, z, w, d, level = 0, hot = 0xff5a10, cool = 0xff2000, seg = 2 } = {}) {
  const u = { ...common(), uHot: { value: new THREE.Color(hot) }, uCool: { value: new THREE.Color(cool) }, uSwell: { value: 0.03 } };
  const g = new THREE.PlaneGeometry(w, d, Math.ceil(w / seg), Math.ceil(d / seg)); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: LAVA_FS, uniforms: u });
  const m = new THREE.Mesh(g, mat); m.position.set(x, level, z); m.name = 'lava';
  return m;
}

/** Arcing fountain jets: list of { from:[x,y,z], to:[x,y,z], h (apex height above from), w (width) } — one draw call. */
export function buildJets(list) {
  const pos = [], uv = [], idx = [];
  for (const j of list) {
    const S = 14, base = pos.length / 3;
    const [ax, ay, az] = j.from, [bx, by, bz] = j.to;
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const x = ax + dx * t, z = az + dz * t, y = ay + (by - ay) * t + Math.sin(t * Math.PI) * j.h;
      const w = (j.w ?? 0.12) * (1 + t * 1.4);
      pos.push(x - px * w, y, z - pz * w, x + px * w, y, z + pz * w);
      uv.push(0, t, 1, t);
    }
    for (let i = 0; i < S; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
      void main(){ float n = texture2D(uNoise, vec2(vUv.x * 0.6, vUv.y * 1.5 - uTime * 1.4)).g;
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float a = edge * (0.35 + 0.65 * smoothstep(0.35, 0.7, n)) * smoothstep(1.0, 0.8, vUv.y) * smoothstep(0.0, 0.05, vUv.y);
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * (1.1 + n * 0.5), a * 0.8); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 6; m.name = 'jets';
  return m;
}
