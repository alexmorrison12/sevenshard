// Heightfield ground with splat painting.
//   const g = new Ground({ x0, z0, w, d, res: 1, layers: ['cobble', 'grass', …≤8], base: 'cobble', seed })
//   g.sculpt((x, z, h) => newH)        g.flatten(shape, h, soft)        g.raise(shape, dh, soft)
//   g.paint('grass', shape, { soft, noise, amount })     // "over" compositing: later paint covers earlier
//   g.info('wear'|'wet'|'ao'|'glow', shape, { soft, amount, noise })   // extra channels
//   g.plaza(x, z, r, { layer, tile, rings })            // polar paving (up to 4 plazas)
//   await g.build(zone)  → meshes (chunked) added to zone.root, material, heightTex
//   g.heightAt(x, z), g.normalAt(x, z), g.weight(layer, x, z)
import * as THREE from 'three';
import { Simplex, clamp, smoothstep } from '../core/noise.js';
import { lambert, G } from '../engine/materials.js';
import { groundLayers, noiseTex } from './textures.js';

const CH = 32; // cells per chunk side

export class Ground {
  constructor({ x0, z0, w, d, res = 1, layers = ['cobble'], base = null, seed = 1, paintRes = 0.5 }) {
    this.x0 = x0; this.z0 = z0; this.w = w; this.d = d; this.res = res;
    this.nx = Math.round(w / res); this.nz = Math.round(d / res);
    this.sx = this.nx + 1; this.sz = this.nz + 1;
    this.h = new Float32Array(this.sx * this.sz);
    this.layers = layers.slice(0, 12);
    this.pr = paintRes;
    this.px = Math.round(w / paintRes) + 1; this.pz = Math.round(d / paintRes) + 1;
    this.wgt = new Float32Array(this.px * this.pz * 12);
    const b = this.layers.indexOf(base ?? this.layers[0]);
    for (let k = 0; k < this.px * this.pz; k++) this.wgt[k * 12 + b] = 1;
    this.inf = new Float32Array(this.px * this.pz * 4); // ao, wear, wet, glow
    for (let k = 0; k < this.px * this.pz; k++) this.inf[k * 4] = 1;
    this.noise = new Simplex(seed * 7 + 3);
    this.plazas = [];
    this.emitColor = new THREE.Color(1.0, 0.35, 0.1);
    this.tint = new THREE.Color(1, 1, 1);          // multiplies the final ground colour (zone mood)
  }
  // ---------------- height ----------------
  sculpt(fn) {
    const { sx, sz, res, x0, z0, h } = this;
    for (let j = 0; j < sz; j++) for (let i = 0; i < sx; i++) { const k = j * sx + i; h[k] = fn(x0 + i * res, z0 + j * res, h[k]); }
  }
  _shapeLoop(shape, fn, pad = 0) {
    const { sx, sz, res, x0, z0 } = this;
    const i0 = Math.max(0, Math.floor((shape.box[0] - pad - x0) / res)), i1 = Math.min(sx - 1, Math.ceil((shape.box[2] + pad - x0) / res));
    const j0 = Math.max(0, Math.floor((shape.box[1] - pad - z0) / res)), j1 = Math.min(sz - 1, Math.ceil((shape.box[3] + pad - z0) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * sx + i, x0 + i * res, z0 + j * res);
  }
  /** blend heights toward h inside shape (soft metres of falloff outside). h may be a fn(x,z). */
  flatten(shape, h, soft = 2) {
    this._shapeLoop(shape, (k, x, z) => {
      const t = smoothstep(soft, 0, shape.sd(x, z));
      if (t > 0) this.h[k] += ((typeof h === 'function' ? h(x, z) : h) - this.h[k]) * t;
    }, soft);
  }
  raise(shape, dh, soft = 2) {
    this._shapeLoop(shape, (k, x, z) => { const t = smoothstep(soft, 0, shape.sd(x, z)); if (t > 0) this.h[k] += (typeof dh === 'function' ? dh(x, z) : dh) * t; }, soft);
  }
  heightAt(x, z) {
    const { sx, sz, res, x0, z0, h } = this;
    const fx = clamp((x - x0) / res, 0, sx - 1.0001), fz = clamp((z - z0) / res, 0, sz - 1.0001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const k = j * sx + i;
    const a = h[k], b = h[k + 1], c = h[k + sx], d = h[k + sx + 1];
    // triangle split matching the mesh (diagonal (0,0)→(1,1))
    if (tx > tz) return a + (b - a) * tx + (d - b) * tz;
    return a + (d - c) * tx + (c - a) * tz;
  }
  normalAt(x, z, out = [0, 1, 0]) {
    const e = this.res;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z), hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l; return out;
  }
  // ---------------- paint ----------------
  _paintLoop(shape, fn, pad = 0) {
    const { px, pz, pr, x0, z0 } = this;
    const i0 = Math.max(0, Math.floor((shape.box[0] - pad - x0) / pr)), i1 = Math.min(px - 1, Math.ceil((shape.box[2] + pad - x0) / pr));
    const j0 = Math.max(0, Math.floor((shape.box[1] - pad - z0) / pr)), j1 = Math.min(pz - 1, Math.ceil((shape.box[3] + pad - z0) / pr));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * px + i, x0 + i * pr, z0 + j * pr);
  }
  _alpha(shape, x, z, soft, noise, nscale) {
    let d = shape.sd(x, z);
    if (noise) d += this.noise.noise2(x / nscale, z / nscale) * noise + this.noise.noise2(x / (nscale * 0.3), z / (nscale * 0.3)) * noise * 0.4;
    return soft > 0 ? smoothstep(soft * 0.5, -soft * 0.5, d) : (d <= 0 ? 1 : 0);
  }
  paint(layer, shape, { soft = 1, noise = 0, nscale = 4, amount = 1 } = {}) {
    const L = this.layers.indexOf(layer);
    if (L < 0) throw new Error(`ground: layer "${layer}" not in [${this.layers}]`);
    const W = this.wgt;
    this._paintLoop(shape, (k, x, z) => {
      const a = this._alpha(shape, x, z, soft, noise, nscale) * amount;
      if (a <= 0) return;
      const o = k * 12;
      for (let c = 0; c < 12; c++) W[o + c] *= 1 - a;
      W[o + L] += a;
    }, soft + noise * 1.5);
  }
  info(ch, shape, { soft = 1, noise = 0, nscale = 4, amount = 1, mode = 'max' } = {}) {
    const c = { ao: 0, wear: 1, wet: 2, glow: 3 }[ch];
    const I = this.inf;
    this._paintLoop(shape, (k, x, z) => {
      const a = this._alpha(shape, x, z, soft, noise, nscale) * amount;
      if (a <= 0) return;
      const o = k * 4 + c;
      if (ch === 'ao') I[o] = Math.min(I[o], 1 - a);   // amount = darkness
      else if (mode === 'add') I[o] = Math.min(1, I[o] + a);
      else I[o] = Math.max(I[o], a);
    }, soft + noise * 1.5);
  }
  weight(layer, x, z) {
    const L = this.layers.indexOf(layer); if (L < 0) return 0;
    const i = clamp(Math.round((x - this.x0) / this.pr), 0, this.px - 1), j = clamp(Math.round((z - this.z0) / this.pr), 0, this.pz - 1);
    return this.wgt[(j * this.px + i) * 12 + L];
  }
  infoAt(ch, x, z) {
    const c = { ao: 0, wear: 1, wet: 2, glow: 3 }[ch];
    const i = clamp(Math.round((x - this.x0) / this.pr), 0, this.px - 1), j = clamp(Math.round((z - this.z0) / this.pr), 0, this.pz - 1);
    return this.inf[(j * this.px + i) * 4 + c];
  }
  /** Polar paving: concentric courses around (x, z) out to r. layer must be one of this.layers. */
  plaza(x, z, r, { layer = 'flagstone', tile = 1.4, rings = [], spokes = 0, border = 0.0, keep = false } = {}) {
    if (this.plazas.length >= 4) return;
    this.plazas.push({ x, z, r, layer, tile, rings, spokes, border, keep });
  }

  // ---------------- build ----------------
  _textures() {
    const { px, pz } = this;
    const a = new Uint8Array(px * pz * 4), b = new Uint8Array(px * pz * 4), c3 = new Uint8Array(px * pz * 4), inf = new Uint8Array(px * pz * 4);
    const W = this.wgt, I = this.inf;
    for (let k = 0; k < px * pz; k++) {
      let s = 0; for (let c = 0; c < 12; c++) s += W[k * 12 + c];
      s = s > 0 ? 1 / s : 0;
      for (let c = 0; c < 4; c++) { a[k * 4 + c] = Math.round(W[k * 12 + c] * s * 255); b[k * 4 + c] = Math.round(W[k * 12 + 4 + c] * s * 255); c3[k * 4 + c] = Math.round(W[k * 12 + 8 + c] * s * 255); }
      for (let c = 0; c < 4; c++) inf[k * 4 + c] = Math.round(clamp(I[k * 4 + c], 0, 1) * 255);
    }
    const mk = d => { const t = new THREE.DataTexture(d, px, pz, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
    this.ctrlA = mk(a); this.ctrlB = mk(b); this.ctrlC = mk(c3); this.infoTex = mk(inf);
    // height (half float) for GPU consumers: grass, decals, water depth
    const hd = new Uint16Array(this.sx * this.sz);
    for (let k = 0; k < hd.length; k++) hd[k] = THREE.DataUtils.toHalfFloat(this.h[k]);
    const ht = new THREE.DataTexture(hd, this.sx, this.sz, THREE.RedFormat, THREE.HalfFloatType);
    ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
    this.heightTex = ht;
    // uv = (xz - origin) / size, sampled at texel centres: (i + 0.5)/px ↔ x0 + i*pr
    this.ctrlInfo = new THREE.Vector4(this.x0 - this.pr * 0.5, this.z0 - this.pr * 0.5, this.px * this.pr, this.pz * this.pr);
    this.heightInfo = new THREE.Vector4(this.x0 - this.res * 0.5, this.z0 - this.res * 0.5, this.sx * this.res, this.sz * this.res);
  }

  makeMaterial() {
    const GL = groundLayers();
    const idx = this.layers.map(l => GL.index[l]);
    while (idx.length < 12) idx.push(0);
    const tiles = this.layers.map(l => 1 / GL.tile[GL.index[l]]);
    while (tiles.length < 12) tiles.push(0.25);
    const pz = [], pp = [], pr = [];
    for (let i = 0; i < 4; i++) {
      const P = this.plazas[i];
      if (!P) { pz.push(new THREE.Vector4(0, 0, -1, 1)); pp.push(new THREE.Vector4(0, 0, 0, 0)); pr.push(new THREE.Vector4(0, 0, 0, 0)); continue; }
      pz.push(new THREE.Vector4(P.x, P.z, P.r, P.tile));
      pp.push(new THREE.Vector4(this.layers.indexOf(P.layer), P.spokes, P.border, P.keep ? 1 : 0)); // w = 1: keep painted weights (half-buried plaza)
      const R = P.rings.concat([0, 0, 0, 0]).slice(0, 4);
      pr.push(new THREE.Vector4(...R));
    }
    const u = {
      uAlb: { value: GL.albedo }, uNrm: { value: GL.normal }, uCtrlA: { value: this.ctrlA }, uCtrlB: { value: this.ctrlB }, uCtrlC: { value: this.ctrlC }, uInfo: { value: this.infoTex },
      uCtrlXf: { value: this.ctrlInfo }, uIdx: { value: idx.map(Number) }, uTile: { value: tiles }, uNoise: { value: noiseTex() },
      uPlaza: { value: pz }, uPlazaP: { value: pp }, uPlazaR: { value: pr }, uEmit: { value: this.emitColor }, uEmitPulse: { value: 1 },
      uHB: { value: 0.55 }, uGTint: { value: this.tint }, uWetCol: { value: new THREE.Color(0.55, 0.62, 0.72) }, uGlowCol: { value: new THREE.Color(1.6, 0.8, 0.3) },
    };
    this.uniforms = u;
    const mat = lambert({ color: 0xffffff }, {
      wrap: 0.28, spec: 0.35, shine: 60, key: 'ground8',
      uniforms: u,
      vertex: vs => vs
        .replace('#include <common>', '#include <common>\nattribute float aAO;\nvarying float vAO;\nvarying vec3 vNrmW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = aAO;\nvNrmW = normal;'),
      fragment: fs => fs
        .replace('#include <common>', `#include <common>
precision highp sampler2DArray;
#define TAU 6.28318530718
uniform sampler2DArray uAlb; uniform sampler2DArray uNrm; uniform sampler2D uCtrlA; uniform sampler2D uCtrlB; uniform sampler2D uCtrlC; uniform sampler2D uInfo; uniform sampler2D uNoise;
uniform vec4 uCtrlXf; uniform float uIdx[12]; uniform float uTile[12];
uniform vec4 uPlaza[4]; uniform vec4 uPlazaP[4]; uniform vec4 uPlazaR[4];
uniform vec3 uEmit; uniform float uEmitPulse; uniform float uHB; uniform vec3 uWetCol; uniform vec3 uGlowCol; uniform vec3 uGTint;
varying float vAO; varying vec3 vNrmW;
float gSpecMask = 0.0;
`)
        .replace('if ( uSpec > 0.0 ) {', 'if ( uSpec * gSpecMask > 0.0 ) {')
        .replace('* uSpec * saturate( nl * 4.0 );', '* uSpec * gSpecMask * saturate( nl * 4.0 );')
        .replace('#include <map_fragment>', `
vec2 cuv = (vWPos.xz - uCtrlXf.xy) / uCtrlXf.zw;
vec4 wa = texture2D(uCtrlA, cuv), wb = texture2D(uCtrlB, cuv), wc = texture2D(uCtrlC, cuv);
vec4 inf = texture2D(uInfo, cuv);
float W[12]; W[0] = wa.r; W[1] = wa.g; W[2] = wa.b; W[3] = wa.a; W[4] = wb.r; W[5] = wb.g; W[6] = wb.b; W[7] = wb.a; W[8] = wc.r; W[9] = wc.g; W[10] = wc.b; W[11] = wc.a;
vec4 nz = texture2D(uNoise, vWPos.xz / 53.0), nz2 = texture2D(uNoise, vWPos.xz / 13.0);
// wobble the splat borders so they never look bilinear-blurry
float wob = (nz2.b - 0.5) * 0.5;
vec2 wxz = vWPos.xz;
vec2 dx = dFdx(wxz), dy = dFdy(wxz);
// polar plazas: find the one we are in (first match)
int pl = -1; vec2 puv = vec2(0.0); float pr = 0.0; float pa = 0.0; vec4 PZ = vec4(0.0); vec4 PP = vec4(0.0); vec4 PR = vec4(0.0);
for (int i = 0; i < 4; i++) {
  vec2 d = wxz - uPlaza[i].xy; float r = length(d);
  if (pl < 0 && r < uPlaza[i].z) { pl = i; pr = r; pa = atan(d.y, d.x); PZ = uPlaza[i]; PP = uPlazaP[i]; PR = uPlazaR[i]; }
}
if (pl >= 0) {
  float v = pr / PZ.w;
  float band = floor(v);
  float circ = TAU * (band + 0.5) * PZ.w;
  float n = max(6.0, floor(circ / (PZ.w * 1.6) + 0.5));
  puv = vec2((pa / TAU + 0.5) * n, v);
  int L = int(PP.x + 0.5);
  if (PP.w < 0.5) for (int i = 0; i < 12; i++) W[i] = (i == L) ? 1.0 : W[i] * smoothstep(PZ.z - 1.2, PZ.z, pr);
}
float gPlazaW = 1.0;
if (pl >= 0 && PP.w > 0.5) { int L2 = int(PP.x + 0.5); for (int i = 0; i < 12; i++) if (i == L2) gPlazaW = W[i]; }
float vk = texture2D(uNoise, wxz / 29.0).a * 7.0 + texture2D(uNoise, wxz / 11.0).b * 1.5;
float vIa = floor(vk), vIf = fract(vk);
vec3 acc = vec3(0.0); vec3 nacc = vec3(0.0); float aoAcc = 0.0; float emAcc = 0.0; float wsum = 0.0;
float hv[12]; vec4 ALB[12]; vec4 NRM[12]; float hmax = -10.0;
for (int i = 0; i < 12; i++) {
  hv[i] = -10.0;
  if (W[i] < 0.02) continue;
  vec2 uv = wxz * uTile[i];
  vec2 gx = dx * uTile[i], gy = dy * uTile[i];
  if (pl >= 0 && i == int(PP.x + 0.5) && pr < PZ.z) { uv = puv; float s = 1.0 / PZ.w; gx = dx * s * 1.6; gy = dy * s * 1.6; }
  // anti-tiling ("virtual pattern"): two samples with per-patch offsets, blended through a noise field by height
  vec2 offA = sin(vec2(3.0, 7.0) * vIa) * 0.5 + vec2(float(i) * 0.37, 0.0), offB = sin(vec2(3.0, 7.0) * (vIa + 1.0)) * 0.5 + vec2(float(i) * 0.37, 0.0);
  vec4 a0 = textureGrad(uAlb, vec3(uv + offA, uIdx[i]), gx, gy), a1 = textureGrad(uAlb, vec3(uv + offB, uIdx[i]), gx, gy);
  float tb = smoothstep(0.25, 0.75, vIf + (a1.a - a0.a) * 0.6);
  ALB[i] = mix(a0, a1, tb);
  NRM[i] = mix(textureGrad(uNrm, vec3(uv + offA, uIdx[i]), gx, gy), textureGrad(uNrm, vec3(uv + offB, uIdx[i]), gx, gy), tb);
  hv[i] = W[i] + ALB[i].a * uHB + wob * (1.0 - W[i]) * 0.35;
  hmax = max(hmax, hv[i]);
}
for (int i = 0; i < 12; i++) {
  if (hv[i] < -5.0) continue;
  float b = max(hv[i] - (hmax - 0.16), 0.0);
  if (b <= 0.0) continue;
  acc += ALB[i].rgb * b; nacc += vec3(NRM[i].xy * 2.0 - 1.0, 1.0) * b; aoAcc += NRM[i].z * b; emAcc += NRM[i].w * b; wsum += b;
}
acc /= max(wsum, 1e-4); nacc /= max(wsum, 1e-4); aoAcc /= max(wsum, 1e-4); emAcc /= max(wsum, 1e-4);
vec3 col = acc;
// plaza decoration: inlay rings, spokes, outer border course
if (pl >= 0) {
  float dk = smoothstep(0.35, 0.8, gPlazaW);   // decoration only where the paving shows
  for (int k = 0; k < 4; k++) {
    float rr = PR[k]; if (rr <= 0.0) continue;
    float ring = smoothstep(0.34, 0.26, abs(pr - rr));
    float trim = smoothstep(0.05, 0.0, abs(abs(pr - rr) - 0.32));
    col = mix(col, col * vec3(0.62, 0.66, 0.78), ring * 0.8 * dk);
    col = mix(col, vec3(0.86, 0.68, 0.36), trim * 0.9 * dk);
  }
  if (PP.y > 0.0) {
    float sp = abs(fract(pa / TAU * PP.y + 0.5) - 0.5) * TAU / PP.y * pr;
    float spoke = smoothstep(0.22, 0.15, sp) * step(PR.x + 0.4, pr);
    col = mix(col, col * vec3(0.7, 0.72, 0.82), spoke * 0.75 * dk);
  }
  if (PP.z > 0.0) {
    float bd = PZ.z - pr;
    col = mix(col, col * 0.8, smoothstep(PP.z, PP.z - 0.1, bd) * 0.6 * dk);
    col = mix(col, vec3(0.3, 0.27, 0.23), smoothstep(0.08, 0.0, abs(bd - PP.z)) * 0.8 * dk);
  }
}
// macro variation (warm/cool, light/dark) at two scales
col *= mix(vec3(0.88, 0.92, 0.98), vec3(1.08, 1.03, 0.93), smoothstep(0.2, 0.8, nz.r));
col *= 0.86 + nz2.g * 0.26;
col = mix(col, col * vec3(1.05, 0.98, 0.9), smoothstep(0.55, 0.8, texture2D(uNoise, wxz / 7.0).r) * 0.5);
// info: contact AO, wear (polished, lighter, less bumpy), wet (dark, glossy), glow (warm emissive tint)
float wear = inf.g * smoothstep(0.2, 0.7, nz2.r + inf.g * 0.4);
col = mix(col, col * 1.12 + 0.02, wear * 0.5);
nacc.xy *= 1.0 - wear * 0.45;
float wet = inf.b * smoothstep(0.15, 0.5, nz.b + inf.b * 0.5);
col = mix(col, col * 0.55, wet * 0.8);
nacc.xy *= 1.0 - wet * 0.7;
gSpecMask = wet * 1.6 + wear * 0.12;
col *= mix(1.0, aoAcc, 0.6) * vAO * mix(0.45, 1.0, inf.r);
diffuseColor.rgb *= col * uGTint;
totalEmissiveRadiance += uEmit * emAcc * uEmitPulse * (0.8 + 0.4 * sin(uTime * 1.6 + vWPos.x * 0.21 + vWPos.z * 0.17));
totalEmissiveRadiance += uGlowCol * inf.a * diffuseColor.rgb * 0.9;
vec3 gNT = nacc;
`)
        .replace('#include <normal_fragment_maps>', `
{
  vec3 N = normalize(vNrmW);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  vec3 B = normalize(cross(T, N));
  vec3 nw = normalize(T * gNT.x + B * gNT.y + N * gNT.z);
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}`),
    });
    return mat;
  }

  /** Build chunked meshes into parent; optional clip(x, z) → false drops cells entirely outside. */
  async build(parent, { clip = null, receive = true, yieldFn = null } = {}) {
    this._textures();
    this.material = this.makeMaterial();
    const { nx, nz, sx, res, x0, z0, h } = this;
    const aoAt = (i, j) => {
      // curvature AO: darker in hollows (bowl bottoms, foot of slopes)
      const c = h[j * sx + i];
      const r = Math.max(1, Math.round(3 / res));
      const s = (a, b) => h[clamp(b, 0, this.sz - 1) * sx + clamp(a, 0, sx - 1)];
      const avg = (s(i - r, j) + s(i + r, j) + s(i, j - r) + s(i, j + r)) * 0.25;
      return clamp(1 - (avg - c) * 0.12, 0.6, 1.08);
    };
    this.meshes = [];
    for (let cj = 0; cj < nz; cj += CH) for (let ci = 0; ci < nx; ci += CH) {
      const cw = Math.min(CH, nx - ci), cd = Math.min(CH, nz - cj);
      const vw = cw + 1, vd = cd + 1;
      const pos = new Float32Array(vw * vd * 3), nrm = new Float32Array(vw * vd * 3), ao = new Float32Array(vw * vd);
      for (let j = 0; j < vd; j++) for (let i = 0; i < vw; i++) {
        const gi = ci + i, gj = cj + j, k = j * vw + i;
        const x = x0 + gi * res, z = z0 + gj * res;
        pos[k * 3] = x; pos[k * 3 + 1] = h[gj * sx + gi]; pos[k * 3 + 2] = z;
        const hl = h[gj * sx + Math.max(0, gi - 1)], hr = h[gj * sx + Math.min(sx - 1, gi + 1)];
        const hd = h[Math.max(0, gj - 1) * sx + gi], hu = h[Math.min(this.sz - 1, gj + 1) * sx + gi];
        const nX = (hl - hr), nY = 2 * res, nZ = (hd - hu), l = Math.hypot(nX, nY, nZ);
        nrm[k * 3] = nX / l; nrm[k * 3 + 1] = nY / l; nrm[k * 3 + 2] = nZ / l;
        ao[k] = aoAt(gi, gj);
      }
      const idx = [];
      for (let j = 0; j < cd; j++) for (let i = 0; i < cw; i++) {
        if (clip) {
          const xa = x0 + (ci + i) * res, za = z0 + (cj + j) * res;
          if (!clip(xa, za) && !clip(xa + res, za) && !clip(xa, za + res) && !clip(xa + res, za + res)) continue;
        }
        const a = j * vw + i, b = a + 1, c = a + vw, d = c + 1;
        idx.push(a, c, d, a, d, b);
      }
      if (!idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
      geo.setIndex(idx);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, this.material);
      m.receiveShadow = receive; m.castShadow = false; m.name = 'ground';
      m.matrixAutoUpdate = false;
      parent.add(m); this.meshes.push(m);
    }
    if (yieldFn) await yieldFn();
    return this;
  }
}
