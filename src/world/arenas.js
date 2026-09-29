// Arena kit: set-piece effects for guardian arenas, one draw call each.
//   buildLavaFalls(list)       molten falls pouring over a cliff lip (HDR, flowing crust)
//   buildPlumes(list)          slow smoke columns (normal blend) — volcanic sky, burning braziers
//   buildHaze(list)            heat shimmer: faint rising wavy sheets over lava
//   buildMoon(o)               a big moon billboard with halo (sky backdrop; also usable as a reflection)
//   buildFlood(ground, o)      shallow flood water you wade through: tint, caustics, fresnel, rings around the hero
//   buildKelp(list, o)         instanced swaying kelp strands with bioluminescent tips
//   buildStreamers(list, hAt)  wind-blown sand ribbons hugging the ground
import * as THREE from 'three';
import { G, FOG_GLSL_PARS, lambert } from '../engine/materials.js';
import { linColor } from '../engine/geom.js';
import { noiseTex } from './textures.js';
import { cutV, cutF } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- lava falls
/** list: [{ x, z, top, bottom, w, dir }] — dir = yaw the fall faces (toward the viewer / arena), lip at (x, top, z) */
export function buildLavaFalls(list, { hot = 0xff8a20, crust = 0x3a0c04 } = {}) {
  const pos = [], uv = [], idx = [];
  for (const f of list) {
    const S = 20, base = pos.length / 3;
    const fx = -Math.sin(f.dir), fz = -Math.cos(f.dir);            // forward (away from the cliff)
    const rx = Math.cos(f.dir), rz = -Math.sin(f.dir);
    const H = f.top - f.bottom;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const out = 0.6 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 1.6 + t * 1.2;   // arcs off the lip then clings
      const y = f.top - H * Math.pow(t, 1.25);
      const w = f.w * (1 + t * 0.35);
      const cx = f.x + fx * out, cz = f.z + fz * out;
      pos.push(cx - rx * w / 2, y, cz - rz * w / 2, cx + rx * w / 2, y, cz + rz * w / 2);
      uv.push(0, t * H / f.w, 1, t * H / f.w);
    }
    for (let i = 0; i < S; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uHot: { value: new THREE.Color(hot) }, uCrust: { value: new THREE.Color(crust) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uHot, uCrust; varying vec2 vUv;
      void main() {
        float a = texture2D(uNoise, vec2(vUv.x * 0.7, vUv.y * 0.25 - uTime * 0.28)).g;
        float b = texture2D(uNoise, vec2(vUv.x * 1.9 + 0.3, vUv.y * 0.6 - uTime * 0.55)).b;
        float crust = smoothstep(0.55, 0.75, a * 0.6 + b * 0.55);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 col = mix(uHot * (1.25 + b * 0.8), uCrust, crust * 0.9);
        col += vec3(1.0, 0.8, 0.45) * smoothstep(0.3, 0.1, abs(vUv.x - 0.5)) * (1.0 - crust) * 0.7;
        gl_FragColor = vec4(col * edge, 1.0);
        if (edge < 0.02) discard;
      }`,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'lava-falls';
  return m;
}

// ---------------------------------------------------------------- smoke plumes
/** list: [{ x, y, z, h, r, dark }] — each plume is 7 camera-facing puffs rising and widening */
export function buildPlumes(list, { color = 0x1a1414, alpha = 0.55 } = {}) {
  const corner = [], center = [], size = [], phase = [], rise = [], idx = [];
  let n = 0;
  for (const p of list) for (let k = 0; k < 7; k++) {
    const t = k / 6;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { corner.push(cx, cy); center.push(p.x, p.y, p.z); size.push(p.r * (0.55 + t * 1.2)); phase.push((k * 0.137 + n * 0.31) % 1); rise.push(t, p.h); }
    const b = n * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('psize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
  g.setAttribute('rise', new THREE.Float32BufferAttribute(rise, 2));
  g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius += 40;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uCol: { value: new THREE.Color(color) }, uA: { value: alpha } },
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute float psize; attribute float phase; attribute vec2 rise;
      uniform float uTime; varying vec2 vC; varying float vPh; varying float vT;
      void main() {
        float t = fract(rise.x + uTime * 0.018 + phase * 0.1);          // puffs cycle upward
        vec3 c = position + vec3(sin(uTime * 0.2 + phase * 9.0) * t * 3.0, t * rise.y, cos(uTime * 0.17 + phase * 7.0) * t * 2.0);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float s = psize * (0.6 + t * 1.1);
        float a = uTime * 0.05 + phase * 6.28;
        vec2 cr = vec2(cos(a) * corner.x - sin(a) * corner.y, sin(a) * corner.x + cos(a) * corner.y);
        vec3 p = c + (right * cr.x + up * cr.y) * s;
        vC = corner; vPh = phase; vT = t;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uNoise; uniform vec3 uCol; uniform float uA; uniform float uTime; varying vec2 vC; varying float vPh; varying float vT;
      void main() {
        float n = texture2D(uNoise, vC * 0.35 + vec2(vPh * 3.0, uTime * 0.01)).r;
        float d = length(vC);
        float a = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.6) * uA * smoothstep(0.0, 0.15, vT) * smoothstep(1.0, 0.55, vT);
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCol * (0.8 + n * 0.5), a);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 9; m.name = 'plumes';
  return m;
}

// ---------------------------------------------------------------- heat haze
export function buildHaze(list, { color = 0xff5a18, alpha = 0.12 } = {}) {
  const corner = [], center = [], size = [], phase = [], idx = [];
  list.forEach((h, i) => {
    for (const [cx, cy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { corner.push(cx, cy); center.push(h.x, h.y, h.z); size.push(h.w, h.h); phase.push(i * 0.37 % 1); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('hsize', new THREE.Float32BufferAttribute(size, 2));
  g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
  g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius += 20;
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uCol: { value: new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(alpha) } },
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute vec2 hsize; attribute float phase; varying vec2 vC; varying float vPh;
      void main() {
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec3 p = position + right * corner.x * hsize.x * 0.5 + vec3(0.0, corner.y * hsize.y, 0.0);
        vC = vec2(corner.x * 0.5 + 0.5, corner.y); vPh = phase;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uCol; varying vec2 vC; varying float vPh;
      void main() {
        float n = texture2D(uNoise, vec2(vC.x * 1.3 + vPh, vC.y * 0.6 - uTime * 0.12)).g;
        float wave = sin((vC.y * 7.0 - uTime * 2.3 + n * 5.0 + vC.x * 3.0)) * 0.5 + 0.5;
        float a = smoothstep(0.0, 0.3, vC.x) * smoothstep(1.0, 0.7, vC.x) * smoothstep(0.0, 0.2, vC.y) * smoothstep(1.0, 0.4, vC.y) * wave * (0.5 + n);
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 8; m.name = 'haze';
  return m;
}

// ---------------------------------------------------------------- moon
export function buildMoon({ x = 0, y = 60, z = -150, r = 22, color = 0xe8f0ff, halo = 0x7aa0ff, intensity = 1.6 } = {}) {
  const g = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNoise: { value: noiseTex() }, uCol: { value: new THREE.Color(color).multiplyScalar(intensity) }, uHalo: { value: new THREE.Color(halo) }, uR: { value: r }, uCenter: { value: V(x, y, z) } },
    vertexShader: /* glsl */`
      uniform float uR; uniform vec3 uCenter; varying vec2 vC;
      void main() {
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vC = position.xy * 2.2;
        vec3 p = uCenter + (right * position.x + up * position.y) * uR * 2.2;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uNoise; uniform vec3 uCol; uniform vec3 uHalo; varying vec2 vC;
      void main() {
        float d = length(vC);
        vec2 uv = vC * 0.5 + 0.5;
        float mare = smoothstep(0.45, 0.75, texture2D(uNoise, uv * 0.9 + 0.2).r) * 0.35 + smoothstep(0.6, 0.8, texture2D(uNoise, uv * 2.3).g) * 0.15;
        float limb = sqrt(max(0.0, 1.0 - d * d));
        float disc = smoothstep(1.0, 0.985, d);
        vec3 col = uCol * (0.62 + 0.38 * limb) * (1.0 - mare) * disc;
        float halo = pow(max(0.0, 1.0 - (d - 1.0) / 1.2), 3.0) * (1.0 - disc) * step(1.0, d);
        col += uHalo * halo * 0.55;
        float a = max(disc, halo * 0.9);
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -8; m.name = 'moon';
  return m;
}

// ---------------------------------------------------------------- shallow flood water
/** Flood water over a floor: ground = Ground (for depth), rect { x, z, w, d }, level (absolute y). */
export function buildFlood(ground, { x, z, w, d, level, tint = 0x2a8a90, deep = 0x0a3a44, sky = 0x9ad8e0, seg = 1.5 } = {}) {
  const u = {
    uTime: G.uTime, uNoise: { value: noiseTex() }, uHeight: { value: ground.heightTex }, uHXf: { value: ground.heightInfo },
    uTint: { value: new THREE.Color(tint) }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color(sky) }, uSunCol: { value: new THREE.Color(0xe0fbff) },
    uLevel: { value: level }, uFocus: { value: V(0, -999, 0) }, uMove: { value: 0 }, uDesat: G.uDesat,
    uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
  };
  const geo = new THREE.PlaneGeometry(w, d, Math.ceil(w / seg), Math.ceil(d / seg)); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec3 uFocus; uniform float uMove; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float dp = length(w.xz - uFocus.xz);
        w.y += sin(dp * 6.0 - uTime * 5.5) * exp(-dp * 0.55) * 0.035 * (0.4 + uMove);
        w.y += sin(w.x * 0.9 + uTime * 1.1) * 0.012 + sin(w.z * 0.7 - uTime * 0.9) * 0.012;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uHeight; uniform vec4 uHXf;
      uniform vec3 uTint, uDeep, uSky, uSunCol, uFocus; uniform float uLevel, uMove, uDesat;
      varying vec3 vW;
      ${FOG_GLSL_PARS}
      void main() {
        float ground = texture2D(uHeight, (vW.xz - uHXf.xy) / uHXf.zw).r;
        float depth = max(uLevel - ground, 0.0);
        vec2 uv = vW.xz;
        vec4 n1 = texture2D(uNoise, uv / 7.0 + vec2(uTime * 0.02, uTime * 0.013));
        vec4 n2 = texture2D(uNoise, uv / 2.9 - vec2(uTime * 0.03, -uTime * 0.022));
        vec2 dv = vW.xz - uFocus.xz; float dp = length(dv);
        float ring = cos(dp * 6.0 - uTime * 5.5) * exp(-dp * 0.55) * (0.4 + uMove) * smoothstep(0.2, 0.9, dp);
        vec2 rn = dv / max(dp, 0.01) * ring * 0.35;
        vec3 nrm = normalize(vec3((n1.g - 0.5) * 0.45 + (n2.b - 0.5) * 0.3 + rn.x, 1.0, (n1.b - 0.5) * 0.45 + (n2.g - 0.5) * 0.3 + rn.y));
        vec3 v = normalize(uCamPos - vW);
        float fres = pow(1.0 - max(dot(nrm, v), 0.0), 5.0) * 0.85 + 0.05;
        float c1 = texture2D(uNoise, uv / 2.2 + vec2(uTime * 0.045, 0.0) + n1.rg * 0.15).r;
        float c2 = texture2D(uNoise, uv / 1.6 - vec2(0.0, uTime * 0.038) + n2.rg * 0.1).g;
        float caus = pow(max(0.0, 1.0 - abs(c1 - c2) * 3.0), 6.0);
        vec3 col = mix(uTint, uDeep, smoothstep(0.1, 1.6, depth));
        col = mix(col, uSky, fres);
        vec3 h = normalize(uSunDir + v);
        col += uSunCol * (pow(max(dot(nrm, h), 0.0), 160.0) * 2.4 + pow(max(dot(nrm, h), 0.0), 24.0) * 0.08);
        col += uTint * caus * 0.9 * smoothstep(1.5, 0.2, depth);
        col += vec3(0.8, 0.95, 1.0) * smoothstep(0.75, 1.0, ring) * 0.25 * exp(-dp * 0.3);
        float alpha = clamp(0.2 + depth * 0.45 + fres * 0.55 + caus * 0.1, 0.0, 0.88);
        col = applyFog(col, vW);
        col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))), uDesat);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat); m.position.set(x, level, z); m.renderOrder = 5; m.name = 'flood';
  let lx = 0, lz = 0;
  m.userData.update = (focus, dt = 1 / 60) => {
    if (!focus) return;
    const sp = Math.hypot(focus.x - lx, focus.z - lz) / Math.max(dt, 1e-3); lx = focus.x; lz = focus.z;
    u.uMove.value += (Math.min(1, sp / 5) - u.uMove.value) * Math.min(1, dt * 4);
    u.uFocus.value.set(focus.x, focus.y ?? 0, focus.z);
  };
  m.userData.u = u;
  return m;
}

// ---------------------------------------------------------------- kelp
/** list: [{ x, y, z, h, s }] — tall swaying strands, dark at the root, glowing tips */
export function buildKelp(list, { base = 0x0a2a24, mid = 0x1e6a58, glow = 0x40ffd8, glowI = 2.2 } = {}) {
  if (!list.length) return null;
  const pos = [], nrm = [], col = [], gl = [], idx = [];
  const cb = linColor(base), cm = linColor(mid);
  const strand = (ox, oz, rot, len, w) => {
    const S = 12, b = pos.length / 3, c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= S; i++) {
      const t = i / S, y = t * len, ww = w * (0.6 + Math.sin(t * Math.PI) * 0.6) * (1 - t * 0.5);
      const off = Math.sin(t * 5 + rot) * 0.12 * t;
      for (const sx of [-1, 1]) { pos.push(ox + (sx * ww + off) * c, y, oz - (sx * ww + off) * s); nrm.push(s, 0.2, c); }
      const k = Math.min(1, t * 1.3);
      const cc = [cb[0] + (cm[0] - cb[0]) * k, cb[1] + (cm[1] - cb[1]) * k, cb[2] + (cm[2] - cb[2]) * k];
      col.push(...cc, ...cc);
      const tip = Math.pow(Math.max(0, (t - 0.65) / 0.35), 2) + (i % 3 === 0 ? 0.18 * t : 0);
      gl.push(tip, tip);
    }
    for (let i = 0; i < S; i++) { const a = b + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  };
  strand(0, 0, 0, 1, 0.14); strand(0.12, 0.05, 1.3, 0.8, 0.12); strand(-0.1, 0.08, 2.4, 0.9, 0.11); strand(0.05, -0.12, 3.6, 0.7, 0.1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('kglow', new THREE.Float32BufferAttribute(gl, 1));
  geo.setIndex(idx);
  const gc = new THREE.Color(glow).multiplyScalar(glowI);
  const mat = lambert({ vertexColors: true, side: THREE.DoubleSide }, {
    wrap: 0.6, trans: 0.4, key: 'kelp', uniforms: { uPlayerPos: G.uPlayerPos, uKGlow: { value: gc } },
    vertex: vs => cutV(vs.replace('#include <common>', '#include <common>\nattribute float kglow; varying float vKG;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKG = kglow;
        { vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = ip.x * 0.31 + ip.z * 0.23;
          float t = position.y;
          transformed.x += sin(uTime * 0.7 + ph + t * 2.2) * t * t * 0.28;
          transformed.z += cos(uTime * 0.55 + ph * 1.3 + t * 1.7) * t * t * 0.22; }`)),
    fragment: fs => cutF(fs.replace('#include <common>', '#include <common>\nuniform vec3 uKGlow; varying float vKG;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uKGlow * vKG * (0.75 + 0.25 * sin(uTime * 1.9 + vWPos.x * 0.7 + vWPos.z * 0.5));`)),
  });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = V(0, 1, 0);
  list.forEach((k, i) => { q.setFromAxisAngle(up, k.rot ?? i * 2.39); s.set(k.s ?? 1, k.h, k.s ?? 1); p.set(k.x, k.y, k.z); m.compose(p, q, s); im.setMatrixAt(i, m); });
  im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'kelp';
  return im;
}

// ---------------------------------------------------------------- sand streamers
/** list: [{ a: [x, z], b: [x, z], w }] — ground-hugging ribbons of blowing sand (normal blend, scrolling streaks) */
export function buildStreamers(list, hAt, { color = 0xf0d8a8, alpha = 0.5, speed = 0.9 } = {}) {
  const pos = [], uv = [], idx = [];
  for (const st of list) {
    const [ax, az] = st.a, [bx, bz] = st.b, L = Math.hypot(bx - ax, bz - az), S = Math.max(8, Math.round(L / 1.5));
    const dx = (bx - ax) / L, dz = (bz - az) / L, px = -dz, pz = dx, base = pos.length / 3;
    for (let i = 0; i <= S; i++) {
      const t = i / S, cx = ax + (bx - ax) * t + px * Math.sin(t * 5 + ax) * 1.5, cz = az + (bz - az) * t + pz * Math.sin(t * 5 + ax) * 1.5;
      for (const sx of [-1, 1]) { const x = cx + px * sx * st.w / 2, z = cz + pz * sx * st.w / 2; pos.push(x, hAt(x, z) + 0.08 + (1 - Math.abs(sx)) * 0.1, z); uv.push(t * L / 6, sx * 0.5 + 0.5); }
    }
    for (let i = 0; i < S; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uCol: { value: new THREE.Color(color) }, uA: { value: alpha }, uSp: { value: speed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uCol; uniform float uA, uSp; varying vec2 vUv;
      void main() {
        float n = texture2D(uNoise, vec2(vUv.x * 0.35 - uTime * uSp * 0.35, vUv.y * 0.9)).g;
        float n2 = texture2D(uNoise, vec2(vUv.x * 1.1 - uTime * uSp * 0.8, vUv.y * 2.3 + 0.3)).b;
        float streak = smoothstep(0.5, 0.8, n * 0.6 + n2 * 0.6);
        float a = streak * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y) * uA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCol * (0.9 + n2 * 0.2), a);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 3; m.name = 'streamers';
  return m;
}

// ---------------------------------------------------------------- moon pond
/** A still pond that reflects the (unseen) moon: dark water, sky fresnel, a rippling moon disc and its glitter path.
 *  { x, z, r, level, moon: [dx, dz] (moon reflection offset from the centre), moonR, color } */
export function buildMoonPond({ x, z, r, level, moon = [0, -0.2], moonR = 0.24, deep = 0x061020, sky = 0x2a3a66, moonCol = 0xe8f0ff } = {}) {
  const g = new THREE.CircleGeometry(r, 48); g.rotateX(-Math.PI / 2);
  const u = {
    uTime: G.uTime, uNoise: { value: noiseTex() }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color(sky) },
    uMoon: { value: new THREE.Color(moonCol).multiplyScalar(0.8) }, uMoonP: { value: new THREE.Vector2(moon[0], moon[1]) }, uMoonR: { value: moonR }, uR: { value: r }, uC: { value: new THREE.Vector2(x, z) },
    uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform float uTime, uMoonR, uR; uniform sampler2D uNoise; uniform vec3 uDeep, uSky, uMoon; uniform vec2 uMoonP, uC;
      varying vec3 vW;
      ${FOG_GLSL_PARS}
      void main() {
        vec2 p = (vW.xz - uC) / uR;                                  // −1..1 across the pond
        vec4 n1 = texture2D(uNoise, vW.xz / 5.0 + vec2(uTime * 0.01, uTime * 0.007));
        vec4 n2 = texture2D(uNoise, vW.xz / 1.7 - vec2(uTime * 0.02, -uTime * 0.015));
        vec2 wob = (vec2(n1.g, n2.b) - 0.5) * 0.05;
        vec3 v = normalize(uCamPos - vW);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.6 + (n1.r - 0.5) * 0.1);
        // the moon's reflection and a glitter path under it
        vec2 mp = p + wob - uMoonP;
        float disc = smoothstep(uMoonR, uMoonR * 0.9, length(mp * vec2(1.0, 1.25)));
        float halo = exp(-length(mp) * 5.0) * 0.35;
        float path = exp(-abs(mp.x) * 10.0) * smoothstep(0.9, 0.0, mp.y) * smoothstep(-0.02, 0.1, mp.y) * smoothstep(0.55, 0.8, n2.g + n1.b * 0.4);
        col += uMoon * (disc * 0.8 + halo * 0.6 + path * 0.45);
        float edge = smoothstep(1.0, 0.9, length(p));
        col = applyFog(col, vW);
        gl_FragColor = vec4(col, 0.9 * edge);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.position.set(x, level, z); m.renderOrder = 5; m.name = 'moon-pond';
  return m;
}
