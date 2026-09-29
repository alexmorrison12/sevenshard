// The open ocean: a camera-following grid (world-locked vertices, so nothing swims) displaced by the shared Gerstner
// swell (waves.js), shaded with depth colour (reads a seabed height texture), crest light, drifting cloud shadows,
// sky & cloud reflections, HDR sun/moon glints, whitecaps on pinching crests, lapping shore foam and fog.
//
//   const ocean = new Ocean({ waves, size: 380, step: 1.5, depth: { tex, xf: Vector4(x0, z0, w, d) } | { ground } })
//   zone.root.add(ocean.mesh); ocean.update(focus); ocean.setEnv(env)
//   seaTextures() → { foam, ripple }  periodic baked textures shared by every sea material (wake, bow foam…)
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../../engine/materials.js';
import { noiseTex } from '../textures.js';
import { bakeSet } from '../bake.js';
import { WAVES_GLSL } from './waves.js';

// ------------------------------------------------------------------------------------------------ baked textures
// R: coarse foam web (voronoi borders), G: fine foam web, B: soft noise, A: sparkle mask — plus a ripple normal map.
const FOAM_GLSL = /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  ivec2 c; vec2 ct;
  vec2 w = vec2(fbm(uv, 4, 3, 41), fbm(uv + 0.37, 4, 3, 42)) * 0.1;
  vec4 v1 = pvoro((uv + w) * 6.0, ivec2(6), 11, 1.0, c, ct);
  vec4 v2 = pvoro((uv - w * 1.3) * 15.0, ivec2(15), 12, 1.0, c, ct);
  vec4 v3 = pvoro((uv + w * 0.7) * 33.0, ivec2(33), 13, 1.0, c, ct);
  // bubbly foam density: bright cell centres at three scales, broken by noise
  float n = fbm(uv, 5, 4, 43) * 0.5 + 0.5;
  float bub = (1.0 - smoothstep(0.0, 0.75, v1.x)) * 0.5 + (1.0 - smoothstep(0.0, 0.7, v2.x)) * 0.32 + (1.0 - smoothstep(0.0, 0.62, v3.x)) * 0.22;
  bub = clamp(bub * (0.65 + n * 0.6), 0.0, 1.0);
  // thin torn web between bubbles (only where the noise allows)
  float web = (1.0 - smoothstep(0.0, 0.045, v2.z)) * smoothstep(0.35, 0.7, fbm(uv, 7, 3, 46) * 0.5 + 0.5);
  vec4 v4 = pvoro(uv * 41.0, ivec2(41), 14, 1.0, c, ct);
  float spark = smoothstep(0.22, 0.0, v4.x) * step(0.72, h1(c, 15));
  s.col = vec3(bub, web, n);
  s.a = spark;
  s.h = fbm(uv, 6, 5, 44) * 0.5 + 0.5 + ridged(uv, 11, 3, 45) * 0.25;
  return s;
}`;
let TEX = null;
export function seaTextures() {
  if (TEX) return TEX;
  const size = 512;
  const out = bakeSet(FOAM_GLSL, { size, outputs: ['albedo', 'rgba', 'normal3'], bump: 5, cavity: 0 });
  // albedo = (web1, web2, noise, h); rgba = (web1, web2, noise, spark) → foam texture uses rgba
  const mk = (px) => {
    const t = new THREE.DataTexture(px, size, size, THREE.RGBAFormat);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
    t.needsUpdate = true; return t;
  };
  TEX = { foam: mk(out.rgba), ripple: mk(out.normal3) };
  return TEX;
}

export const PALETTE = {
  day: { deep: 0x0b3a6a, mid: 0x0e6a8e, shallow: 0x38ccc2, sand: 0xd8c898, sky: 0x9ecbf2, horizon: 0xdcecf6, crest: 0x2c86b8, foam: 0xf4fafd, storm: 0x1e3846 },
  night: { deep: 0x03102a, mid: 0x072a4a, shallow: 0x0e5866, sand: 0x44506a, sky: 0x1a2a4c, horizon: 0x33466a, crest: 0x0d5064, foam: 0xaabcd4, storm: 0x0a1620 },
  dusk: { deep: 0x10305a, mid: 0x1c5a7c, shallow: 0x3aa8a8, sand: 0xc8a888, sky: 0xe0a890, horizon: 0xf0c8a8, crest: 0x3a9aa0, foam: 0xfbe8dc, storm: 0x2a2a3a },
};

const VS = /* glsl */`
${WAVES_GLSL}
uniform float uTime; uniform sampler2D uDepth; uniform vec4 uDepthXf; uniform float uHasDepth; uniform float uLevel; uniform float uSwellMul;
varying vec3 vW; varying vec3 vN; varying float vH; varying float vJ; varying float vStorm;
float seabed(vec2 p) { return uHasDepth > 0.5 ? texture2D(uDepth, (p - uDepthXf.xy) / uDepthXf.zw).r : uLevel - 40.0; }
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float depth = uLevel - seabed(w.xz);
  float att = smoothstep(0.1, 7.0, depth) * uSwellMul;
  float storm = stormAt(w.xz);
  vec3 N; float J;
  vec3 d = waveDisp(w.xz, uTime, storm, N, J);
  w.xyz += d * att;
  vW = w.xyz; vN = normalize(mix(vec3(0.0, 1.0, 0.0), N, att)); vH = d.y * att; vJ = mix(1.0, J, att); vStorm = storm;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS = /* glsl */`
uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uFoamTex; uniform sampler2D uRipple;
uniform sampler2D uDepth; uniform vec4 uDepthXf; uniform float uHasDepth; uniform float uLevel;
uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uShallow; uniform vec3 uSand; uniform vec3 uSky; uniform vec3 uHorizon;
uniform vec3 uCrest; uniform vec3 uFoamCol; uniform vec3 uStormTint; uniform vec3 uSunCol;
uniform float uDesat; uniform float uGlint; uniform float uCloud; uniform float uShoreAlpha; uniform float uFoamMul; uniform vec2 uWind;
uniform float uGlow; uniform vec3 uGlowCol;
varying vec3 vW; varying vec3 vN; varying float vH; varying float vJ; varying float vStorm;
${FOG_GLSL_PARS}
float seabed(vec2 p) { return uHasDepth > 0.5 ? texture2D(uDepth, (p - uDepthXf.xy) / uDepthXf.zw).r : uLevel - 40.0; }
void main() {
  vec2 p = vW.xz;
  vec4 nz = texture2D(uNoise, p / 37.0);
  float depth = max(uLevel - seabed(p + (nz.rg - 0.5) * 1.6), 0.0);
  // ripple normals: two layers scrolling with and across the wind, stronger in storms
  vec2 wd = uWind;
  vec3 r1 = texture2D(uRipple, p / 10.5 + wd * uTime * 0.03).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(uRipple, p / 3.9 + vec2(-wd.y, wd.x) * uTime * 0.045 + 0.37).xyz * 2.0 - 1.0;
  float rs = 0.22 + vStorm * 0.45;
  vec3 nrm = normalize(vN + vec3(r1.x + r2.x * 0.8, 0.0, r1.y + r2.y * 0.8) * rs);
  vec3 v = normalize(uCamPos - vW);
  float ndv = max(dot(nrm, v), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  // water body: deep → mid → turquoise shallows → sand showing through
  vec3 body = mix(uMid, uDeep, smoothstep(4.0, 26.0, depth + (nz.b - 0.5) * 6.0));
  body = mix(uShallow, body, smoothstep(0.4, 6.5, depth));
  body = mix(uSand, body, smoothstep(0.05, 1.5, depth) * 0.8 + 0.2);
  // light through the crests (brighter, greener where the swell rises)
  float crest = smoothstep(-0.15, 0.85, vH);
  vec3 sd = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4);
  float back = clamp(dot(normalize(vec3(-nrm.x, 0.0, -nrm.z) + 1e-4), sd) * 0.5 + 0.5, 0.0, 1.0);
  body += uCrest * crest * (0.1 + 0.2 * back) * smoothstep(1.0, 6.0, depth);
  body *= 0.9 + 0.2 * smoothstep(-0.3, 0.5, vH) ;
  body = mix(body, uStormTint, vStorm * 0.6);
  // drifting cloud shadows
  float cl = texture2D(uNoise, p / 340.0 + wd * uTime * 0.0014).r * 0.7 + texture2D(uNoise, p / 120.0 + wd * uTime * 0.002).g * 0.3;
  float shade = smoothstep(0.5, 0.68, cl) * uCloud;
  body *= 1.0 - shade * 0.18;
  // reflection: sky gradient + reflected cloud masses
  vec3 rd = reflect(-v, nrm);
  vec3 sky = mix(uHorizon, uSky, clamp(rd.y * 1.25, 0.0, 1.0));
  float rc = texture2D(uNoise, p / 170.0 + rd.xz * 0.05 + wd * uTime * 0.0018).g;
  sky = mix(sky, uHorizon * 1.04 + 0.02, smoothstep(0.52, 0.78, rc) * 0.35 * (1.0 - vStorm));
  vec3 col = mix(body, sky, fres * (1.0 - vStorm * 0.4));
  // sun / moon glints: tight HDR sparkles + a broad sheen. The glint light is the sun mirrored to the north so the
  // glitter path lies ahead of the camera (the key light itself stays behind it and lights the ships).
  vec3 gd = normalize(vec3(uSunDir.x * 0.45, max(uSunDir.y, 0.3) * 0.8, -abs(uSunDir.z) - 0.45));
  vec3 hv = normalize(gd + v);
  vec3 r3 = texture2D(uRipple, p / 1.4 + wd * uTime * 0.07).xyz * 2.0 - 1.0;
  vec3 gn = normalize(nrm + vec3(r3.x, 0.0, r3.y) * 0.3);
  float nh = max(dot(gn, hv), 0.0), nh0 = max(dot(nrm, hv), 0.0);
  float spark = texture2D(uFoamTex, p / 2.7 + wd * uTime * 0.05).a;
  float gl = pow(nh, 420.0) * 7.0 * spark * spark + pow(nh0, 150.0) * 0.06 + pow(nh0, 12.0) * 0.012;
  col += uSunCol * gl * uGlint * (1.0 - shade * 0.85) * (1.0 - vStorm * 0.75);
  // foam: whitecaps where crests pinch (more in storms) + lapping shore foam; thresholds eat into the bubble field
  vec4 f1 = texture2D(uFoamTex, p / 13.0 + wd * uTime * 0.012);
  vec4 f2 = texture2D(uFoamTex, p / 5.1 - wd * uTime * 0.017 + 0.5);
  float fv = f1.r * 0.72 + f2.r * 0.46 + f1.g * 0.22 + f2.b * 0.12;
  float pinch = 1.0 - smoothstep(0.05 - vStorm * 0.2, 0.6 + vStorm * 0.25, vJ);
  float capAmt = clamp(pinch * (0.5 + vStorm * 1.1), 0.0, 1.0);
  float tc = 1.4 - capAmt * 0.95;
  float caps = smoothstep(tc, tc + 0.14, fv) * smoothstep(0.0, 0.2, capAmt);
  float lap = sin(depth * 4.5 - uTime * 1.7 + f1.b * 7.0) * 0.5 + 0.5;
  float shoreAmt = clamp(smoothstep(0.6, 0.0, depth) * 1.1 + smoothstep(2.6, 0.25, depth) * smoothstep(0.6, 0.92, lap) * 0.7, 0.0, 1.0);
  float ts = 1.4 - shoreAmt * 1.05;
  float shore = smoothstep(ts, ts + 0.14, fv + 0.08) * smoothstep(0.0, 0.15, shoreAmt);
  float foam = clamp((caps + shore) * uFoamMul, 0.0, 1.0);
  col = mix(col, uFoamCol * (0.78 + 0.14 * ndv), foam * 0.93);
  col += uGlowCol * uGlow * smoothstep(3.5, 0.3, depth) * (0.5 + 0.5 * f2.b);
  col = applyFog(col, vW);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  float alpha = clamp(smoothstep(0.0, uShoreAlpha, depth) * 0.82 + 0.18 + foam * 0.8 + fres * 0.35, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

export class Ocean {
  /**
   * o: { waves (Waves), size (m), step (grid spacing m), level, depth: { tex, xf } | { ground }, follow (true),
   *      palette ('day'), glint, cloud, shoreAlpha (m of fade), foam (multiplier), swell (multiplier) }
   */
  constructor(o = {}) {
    const T = seaTextures();
    const size = o.size ?? 380, step = o.step ?? 1.5;
    this.size = size; this.step = step; this.follow = o.follow ?? true; this.level = o.level ?? 0;
    const n = Math.ceil(size / step);
    const g = new THREE.PlaneGeometry(n * step, n * step, n, n); g.rotateX(-Math.PI / 2);
    this.waves = o.waves;
    const P = PALETTE.day;
    const u = this.uniforms = {
      ...o.waves.uniforms,
      uTime: G.uTime, uNoise: { value: noiseTex() }, uFoamTex: { value: T.foam }, uRipple: { value: T.ripple },
      uDepth: { value: null }, uDepthXf: { value: new THREE.Vector4(0, 0, 1, 1) }, uHasDepth: { value: 0 }, uLevel: { value: this.level },
      uDeep: { value: new THREE.Color(P.deep) }, uMid: { value: new THREE.Color(P.mid) }, uShallow: { value: new THREE.Color(P.shallow) }, uSand: { value: new THREE.Color(P.sand) },
      uSky: { value: new THREE.Color(P.sky) }, uHorizon: { value: new THREE.Color(P.horizon) }, uCrest: { value: new THREE.Color(P.crest) }, uFoamCol: { value: new THREE.Color(P.foam).multiplyScalar(0.78) },
      uStormTint: { value: new THREE.Color(P.storm) }, uSunCol: { value: new THREE.Color(0xfff0d0) },
      uDesat: G.uDesat, uGlint: { value: o.glint ?? 1 }, uCloud: { value: o.cloud ?? 1 }, uShoreAlpha: { value: o.shoreAlpha ?? 2.2 }, uFoamMul: { value: o.foam ?? 1 }, uSwellMul: { value: o.swell ?? 1 },
      uGlow: { value: 0 }, uGlowCol: { value: new THREE.Color(0x40ffe0) },
      uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos,
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u, transparent: true, depthWrite: true });
    const m = this.mesh = new THREE.Mesh(g, this.material);
    m.name = 'ocean'; m.frustumCulled = false; m.renderOrder = -10; m.position.y = this.level;
    m.userData.setEnv = env => this.setEnv(env);
    if (o.depth) this.setDepth(o.depth);
    if (o.palette) this.setPalette(o.palette);
  }
  /** { tex, xf: Vector4(x0, z0, w, d) } or { ground } (a world Ground after build: heightTex + heightInfo) */
  setDepth(d) {
    const u = this.uniforms;
    if (d.ground) { u.uDepth.value = d.ground.heightTex; u.uDepthXf.value.copy(d.ground.heightInfo); }
    else { u.uDepth.value = d.tex; u.uDepthXf.value.copy(d.xf); }
    u.uHasDepth.value = u.uDepth.value ? 1 : 0;
  }
  setPalette(p) {
    const P = typeof p === 'string' ? PALETTE[p] : p, u = this.uniforms;
    for (const [k, key] of [['deep', 'uDeep'], ['mid', 'uMid'], ['shallow', 'uShallow'], ['sand', 'uSand'], ['sky', 'uSky'], ['horizon', 'uHorizon'], ['crest', 'uCrest'], ['foam', 'uFoamCol'], ['storm', 'uStormTint']]) if (P[k] != null) u[key].value.set(P[k]);
  }
  /** blend day/dusk/night palettes by env.night, take sky & sun from the env */
  setEnv(env) {
    const nt = env.night ?? 0, D = PALETTE.day, N = PALETTE.night, K = PALETTE.dusk, u = this.uniforms;
    const c = new THREE.Color(), d2 = new THREE.Color(), e = new THREE.Color();
    const dusk = Math.max(0, 1 - Math.abs(nt - 0.35) / 0.35) * (env.preset === 'dusk' ? 1 : 0.6);
    for (const [k, key] of [['deep', 'uDeep'], ['mid', 'uMid'], ['shallow', 'uShallow'], ['sand', 'uSand'], ['crest', 'uCrest'], ['foam', 'uFoamCol'], ['storm', 'uStormTint']]) {
      c.set(D[k]).lerp(d2.set(N[k]), Math.min(1, nt)); c.lerp(e.set(K[k]), dusk * 0.6);
      u[key].value.copy(c);
    }
    u.uFoamCol.value.multiplyScalar(0.78);
    u.uSky.value.set(env.hemiSky ?? D.sky).lerp(d2.set(env.fogColor ?? D.horizon), 0.25);
    u.uHorizon.value.set(env.fogColor ?? D.horizon).lerp(d2.set(0xffffff), 0.12 * (1 - nt));
    u.uSunCol.value.set(env.sunColor ?? 0xfff0d0).multiplyScalar(Math.min(1.25, (env.sunIntensity ?? 3) / 2.8) * (nt > 0.6 ? 0.8 : 1));
    this.uniforms.uCloud.value = env.clouds ?? (1 - nt * 0.6);
  }
  /** keep the grid under the camera focus (snapped to the grid step: vertices stay world-locked) */
  update(focus) {
    if (!this.follow || !focus) return;
    const s = this.step * 2;
    this.mesh.position.set(Math.round(focus.x / s) * s, this.level, Math.round(focus.z / s) * s);
  }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
