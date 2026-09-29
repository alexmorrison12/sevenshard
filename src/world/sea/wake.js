// Ship wake & hull foam, riding the same swell as the ocean (waves.js):
//   Wake      a ribbon dropped behind the stern: churned turquoise water, a turbulent foam lane that spreads and
//             fades, and the two diverging Kelvin arms (±19.5°). One draw call per ship, no per-frame allocation.
//   HullFoam  the white water hugging a moving hull: bow wave, side wash, a ring when idle. Parented to the ship
//             (heading only), vertices follow the swell in world space.
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../../engine/materials.js';
import { WAVES_GLSL } from './waves.js';
import { seaTextures } from './ocean.js';

const ACROSS = 7;                      // vertices across the ribbon
const KELVIN = Math.tan(19.5 * Math.PI / 180);

const WAKE_VS = /* glsl */`
${WAVES_GLSL}
uniform float uTime;
attribute vec4 aWake;      // across (-1..1), age (s), intensity 0..1, dist (m behind the stern)
attribute vec2 aW;         // half width, centre width (m)
varying vec3 vW; varying vec4 vWake; varying vec2 vWid;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 N; float J;
  vec3 d = waveDisp(w.xz, uTime, stormAt(w.xz), N, J);
  w.y += d.y + 0.07; w.x += d.x; w.z += d.z;
  vW = w.xyz; vWake = aWake; vWid = aW;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WAKE_FS = /* glsl */`
uniform float uTime; uniform sampler2D uFoamTex; uniform vec3 uFoamCol; uniform vec3 uChurn; uniform float uLife; uniform float uDesat; uniform float uBio;
varying vec3 vW; varying vec4 vWake; varying vec2 vWid;
${FOG_GLSL_PARS}
void main() {
  float across = vWake.x, age = vWake.y, inten = vWake.z, dist = vWake.w;
  float halfW = vWid.x, cw = vWid.y;
  float xm = abs(across) * halfW;
  float life = clamp(age / uLife, 0.0, 1.0);
  float fade = pow(1.0 - life, 1.4) * inten * smoothstep(0.0, 2.5, dist);
  vec4 f1 = texture2D(uFoamTex, vW.xz / 9.0 + vec2(0.0, uTime * 0.008));
  vec4 f2 = texture2D(uFoamTex, vW.xz / 3.6 - vec2(uTime * 0.01, 0.0));
  float fv = f1.r * 0.72 + f2.r * 0.46 + f2.g * 0.22 + f1.b * 0.14;
  float centre = smoothstep(cw, cw * 0.2, xm);
  float laneAmt = centre * fade * (1.25 - life * 0.55);
  float tl = 1.45 - laneAmt;
  float lane = smoothstep(tl, tl + 0.12, fv) * smoothstep(0.0, 0.1, laneAmt);
  float armX = halfW - 1.1;
  float armAmt = smoothstep(1.1, 0.1, abs(xm - armX)) * smoothstep(1.0, 5.0, dist) * fade * (1.0 - life * 0.75);
  float ta = 1.45 - armAmt * 0.9;
  float arm = smoothstep(ta, ta + 0.16, fv + 0.12) * smoothstep(0.0, 0.1, armAmt);
  float foam = clamp(lane + arm * 0.85, 0.0, 1.0);
  float churn = centre * fade * 0.3;
  vec3 col = mix(uChurn, uFoamCol, clamp(foam * 1.4, 0.0, 1.0));
  float a = clamp(max(foam, churn), 0.0, 1.0);
  col = applyFog(col, vW);
  // night: the Glass Sea glows where it is stirred
  col += vec3(0.1, 0.9, 0.85) * uBio * (foam * 0.9 + churn * 1.6) * (0.6 + 0.4 * sin(uTime * 2.0 + vW.x * 0.4 + vW.z * 0.3));
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  gl_FragColor = vec4(col, a * 0.9);
}`;

const HULL_VS = /* glsl */`
${WAVES_GLSL}
uniform float uTime;
varying vec3 vW; varying vec2 vL;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 N; float J;
  vec3 d = waveDisp(w.xz, uTime, stormAt(w.xz), N, J);
  w.xyz += d; w.y += 0.09;
  vW = w.xyz; vL = position.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HULL_FS = /* glsl */`
uniform float uTime; uniform sampler2D uFoamTex; uniform vec3 uFoamCol; uniform float uSpeed; uniform vec2 uHalf; uniform float uDesat; uniform float uAmt;
varying vec3 vW; varying vec2 vL;
${FOG_GLSL_PARS}
void main() {
  // hull-local: x = beam axis, z = length axis (bow at -z). Elliptical distance to the waterline footprint.
  vec2 q = vL / uHalf;
  float e = length(q);
  float bow = smoothstep(0.2, -1.0, q.y);                         // 1 at the bow
  float sp = clamp(uSpeed, 0.0, 1.4);
  vec4 f1 = texture2D(uFoamTex, vW.xz / 6.0 + vec2(uTime * 0.03, -uTime * 0.05));
  vec4 f2 = texture2D(uFoamTex, vW.xz / 2.6 - vec2(uTime * 0.05, uTime * 0.02));
  float fv = f1.r * 0.72 + f2.r * 0.46 + f2.g * 0.22 + f1.b * 0.14;
  float ring = smoothstep(0.9, 1.0, e) * smoothstep(1.0 + 0.1 + sp * (0.22 + bow * 0.5), 1.0, e);
  // the bow wave: a V of foam peeling off the stem
  float vx = abs(vL.x) - (-vL.y - uHalf.y * 0.82) * 0.42;
  float vee = smoothstep(1.1, 0.0, abs(vx)) * smoothstep(-uHalf.y * 0.6, -uHalf.y * 1.05, vL.y) * smoothstep(-uHalf.y * 2.0, -uHalf.y * 1.05, vL.y) * sp;
  float amt = clamp(ring * (0.5 + 0.6 * sp) * (0.45 + bow * 0.9) + vee * 0.9, 0.0, 1.0);
  float tf = 1.45 - amt * 1.05;
  float foam = smoothstep(tf, tf + 0.12, fv) * smoothstep(0.0, 0.1, amt);
  foam *= uAmt;
  vec3 col = applyFog(uFoamCol, vW);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  gl_FragColor = vec4(col, clamp(foam, 0.0, 1.0) * 0.95);
}`;

function common(waves) {
  const T = seaTextures();
  return {
    ...waves.uniforms, uTime: G.uTime, uFoamTex: { value: T.foam }, uFoamCol: { value: new THREE.Color(0xf6fbff).multiplyScalar(0.74) }, uDesat: G.uDesat,
    uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
  };
}

export class Wake {
  /** o: { waves, max (points), spacing (m), life (s), beam (m) } */
  constructor(o = {}) {
    this.max = o.max ?? 110; this.spacing = o.spacing ?? 1.3; this.life = o.life ?? 9; this.beam = o.beam ?? 4.8;
    const N = this.max, V = N * ACROSS;
    this.pts = [];                                   // newest first: { x, z, rx, rz, t, inten, dist }
    this.pool = []; for (let i = 0; i < N + 2; i++) this.pool.push({ x: 0, z: 0, rx: 1, rz: 0, t: 0, inten: 0, dist: 0 });
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(V * 3); this.wk = new Float32Array(V * 4); this.wd = new Float32Array(V * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aWake', new THREE.BufferAttribute(this.wk, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aW', new THREE.BufferAttribute(this.wd, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < ACROSS - 1; j++) { const a = i * ACROSS + j, b = a + 1, c = a + ACROSS, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setIndex(idx); g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const u = this.uniforms = { ...common(o.waves), uChurn: { value: new THREE.Color(0x7fe0dc) }, uLife: { value: this.life }, uBio: { value: 0 } };
    this.material = new THREE.ShaderMaterial({ vertexShader: WAKE_VS, fragmentShader: WAKE_FS, uniforms: u, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = -8; this.mesh.name = 'wake';
    this.last = null; this.time = 0;
  }
  /** call every frame with the stern point (x, z), heading (model facing) and speed (m/s) */
  update(dt, x, z, heading, speed, maxSpeed = 14) {
    this.time += dt;
    const fx = -Math.sin(heading), fz = -Math.cos(heading), rx = -fz, rz = fx;
    const inten = Math.min(1, Math.max(0, (Math.abs(speed) - 0.6) / (maxSpeed * 0.6)));
    const P = this.pts;
    // the head point rides the stern; every `spacing` metres it is left behind and a new head starts
    if (!P.length || !this.last || Math.hypot(x - this.last.x, z - this.last.z) >= this.spacing) {
      const p = this.pool.pop() || P.pop();
      p.x = x; p.z = z; p.rx = rx; p.rz = rz; p.t = this.time; p.inten = inten; p.dist = 0;
      P.unshift(p); (this.last ||= { x: 0, z: 0 }).x = x; this.last.z = z;
      while (P.length > this.max) this.pool.push(P.pop());
    }
    // expire, accumulate distance behind the ship
    let dist = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (i === 0) { p.x = x; p.z = z; p.rx = rx; p.rz = rz; p.inten = Math.max(p.inten * 0.9, inten); }
      else dist += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z);
      p.dist = dist;
    }
    while (P.length && this.time - P[P.length - 1].t > this.life) this.pool.push(P.pop());
    // write the ribbon
    const pos = this.pos, wk = this.wk, wd = this.wd;
    let v = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], age = this.time - p.t;
      const halfW = Math.max(this.beam * 0.75, KELVIN * p.dist + this.beam * 0.55 + age * 0.3);
      const cw = this.beam * 0.5 + age * 0.5;
      for (let j = 0; j < ACROSS; j++) {
        const a = j / (ACROSS - 1) * 2 - 1;
        pos[v * 3] = p.x + p.rx * a * halfW; pos[v * 3 + 1] = 0; pos[v * 3 + 2] = p.z + p.rz * a * halfW;
        wk[v * 4] = a; wk[v * 4 + 1] = age; wk[v * 4 + 2] = p.inten; wk[v * 4 + 3] = p.dist;
        wd[v * 2] = halfW; wd[v * 2 + 1] = cw;
        v++;
      }
    }
    const g = this.geo;
    g.attributes.position.needsUpdate = true; g.attributes.aWake.needsUpdate = true; g.attributes.aW.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, P.length - 1) * (ACROSS - 1) * 6);
  }
  reset() { while (this.pts.length) this.pool.push(this.pts.pop()); this.last = null; }
  setNight(n) { this.uniforms.uFoamCol.value.setRGB(0.96 - n * 0.55, 0.98 - n * 0.5, 1 - n * 0.4).multiplyScalar(0.74); this.uniforms.uChurn.value.set(0x7fe0dc).lerp(new THREE.Color(0x0e3a4a), n); this.uniforms.uBio.value = Math.max(0, n - 0.4) * 0.9; }
  dispose() { this.geo.dispose(); this.material.dispose(); }
}

export class HullFoam {
  /** o: { waves, len, beam } — add .mesh to the ship's heading node (not the rocking hull) */
  constructor(o = {}) {
    const len = o.len ?? 17, beam = o.beam ?? 5.4;
    const g = new THREE.PlaneGeometry(beam * 2.6, len * 2.2, 18, 30); g.rotateX(-Math.PI / 2); g.translate(0, 0, -len * 0.15);
    const u = this.uniforms = { ...common(o.waves), uSpeed: { value: 0 }, uHalf: { value: new THREE.Vector2(beam * 0.5, len * 0.5) }, uAmt: { value: 1 } };
    this.material = new THREE.ShaderMaterial({ vertexShader: HULL_VS, fragmentShader: HULL_FS, uniforms: u, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.renderOrder = -7; this.mesh.frustumCulled = false; this.mesh.name = 'hullfoam';
  }
  set speed(v) { this.uniforms.uSpeed.value = v; }
  set amount(v) { this.uniforms.uAmt.value = v; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
