// GPU "analytic" particles. The CPU writes a particle ONCE (at spawn) into an interleaved instance buffer; the vertex
// shader evaluates position / size / colour as closed-form functions of age:
//   ballistic:  p(t) = p0 + v0·(1-e^-kt)/k + a·(t - (1-e^-kt)/k)/k  (+ sine-field turbulence)
//   orbit:      spiral around p0 (vertical axis, or a vertical plane with a yaw) with rise + radius growth (pull-in < 0)
//   wrap:       weather — ballistic motion wrapped inside a box that follows the camera focus (zero CPU per frame)
// Orientation: camera billboard, velocity-stretched streak, flat on the ground, vertical axis billboard, vertical plane.
// Colour/alpha over life: ramp LUT row × per-particle HDR tint. Premultiplied blending mixes additive (alpha = 0) and
// alpha-blended (alpha = coverage) particles in one draw call. Two pools (alpha first, additive after) = 2 draw calls.
// Each pool = ring regions (fire-and-forget; short-lived and long-lived) + a "held" region (free-list, looping
// particles owned by handles: projectile cores, auras). Anchors (a float texture of positions) let particles follow
// moving objects without CPU work per particle.
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../engine/materials.js';
import { GRID, S, R, WHITE_RAMPS } from './textures.js';
import { GLSL_GROUND, NO, addRange } from './util.js';

export const STRIDE = 28;
export const F = {
  ORBIT: 1, ORBITV: 2,                       // motion (bits 0-1)
  STRETCH: 4, FLAT: 8, AXISY: 12,            // orientation (bits 2-4)
  LOOP: 32, NOGROUND: 64, PINGPONG: 128, FLATV: 256, WRAP: 512, MIRROR: 1024,
};

const vert = /* glsl */`
precision highp float;
precision highp int;
attribute vec4 aP0; attribute vec4 aV0; attribute vec4 aDyn; attribute vec4 aSize;
attribute vec4 aCol; attribute vec4 aMisc; attribute vec4 aExtra;
uniform float uFxTime;
uniform sampler2D uRamp; uniform float uRampRows;
uniform sampler2D uAnchors;
uniform vec3 uLight; uniform vec3 uFocus; uniform vec3 uWrapBox;
varying vec2 vUv; varying vec4 vColor; varying float vAdd; varying float vGround; varying float vSoft; varying float vFog; varying vec3 vFogCol;
${GLSL_GROUND}
${FOG_GLSL_PARS}
void main() {
  float age = uFxTime - aP0.w;
  float life = max(aV0.w, 1e-4);
  int flags = int(aMisc.w + 0.5);
  bool loop = (flags & 32) != 0;
  float t = age / life;
  if (loop) { t = fract(t); if ((flags & 128) != 0) t = 1.0 - abs(2.0 * t - 1.0); }
  vec4 anc = vec4(0.0, 0.0, 0.0, 1.0);
  if (aMisc.z >= 0.0) { int ai = int(aMisc.z + 0.5); anc = texelFetch(uAnchors, ivec2(ai & 63, ai >> 6), 0); }
  if (age < 0.0 || (!loop && t > 1.0) || anc.w <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int motion = flags & 3;
  vec3 pos; vec3 vel;
  if (motion == 0) {
    float k = aDyn.y;
    float e = exp(-k * age);
    float f = k > 1e-4 ? (1.0 - e) / k : age;
    float g = k > 1e-4 ? (age - f) / k : 0.5 * age * age;
    pos = aP0.xyz + aV0.xyz * f + vec3(0.0, aDyn.x * g, 0.0);
    vel = aV0.xyz * e + vec3(0.0, aDyn.x * f, 0.0);
  } else {
    float ang = aV0.y + aV0.z * age;
    float rad = max(aV0.x + aDyn.y * age, 0.0);
    float ca = cos(ang), sa = sin(ang);
    vec3 off = vec3(ca * rad, aDyn.x * age, sa * rad);
    vel = vec3(-sa * aV0.z * rad + ca * aDyn.y, aDyn.x, ca * aV0.z * rad + sa * aDyn.y);
    if (motion == 2) {
      vec3 lo = vec3(ca * rad, sa * rad, aDyn.x * age);
      vec3 lv = vec3(vel.x, vel.z, aDyn.x);
      float cy = cos(aExtra.z), sy = sin(aExtra.z);
      off = vec3(lo.x * cy + lo.z * sy, lo.y, -lo.x * sy + lo.z * cy);
      vel = vec3(lv.x * cy + lv.z * sy, lv.y, -lv.x * sy + lv.z * cy);
    }
    pos = aP0.xyz + off;
  }
  if (aDyn.z > 0.0) {
    float seed = fract(aP0.w * 7.13 + aSize.z * 3.7) * 6.2831;
    vec3 q = pos * 0.85;
    float amp = aDyn.z * ((flags & 512) != 0 ? 1.0 : min(age, 1.5));
    pos += amp * vec3(sin(q.y * 1.3 + uFxTime * 1.7 + seed), sin(q.z * 1.1 + uFxTime * 1.3 + seed * 1.7) * 0.6, sin(q.x * 1.2 + uFxTime * 1.9 + seed * 2.3));
  }
  float wrapFade = 1.0;
  if ((flags & 512) != 0) {   // weather box around the focus point (aExtra.z > 0 overrides the box height)
    vec3 box = uWrapBox; if (aExtra.z > 0.0) box.y = aExtra.z;
    vec3 rel = pos - uFocus + vec3(box.x, 0.0, box.z) * 0.5;
    rel.xz = mod(rel.xz, box.xz);
    rel.y = mod(rel.y, box.y);
    pos = uFocus + rel - vec3(box.x, 0.0, box.z) * 0.5;
    vec2 e2 = min(rel.xz, box.xz - rel.xz) / (box.xz * 0.12);
    wrapFade = clamp(min(e2.x, e2.y), 0.0, 1.0) * clamp(min(rel.y, box.y - rel.y) / (box.y * 0.1), 0.0, 1.0);
  } else pos += anc.xyz;
  float st = 1.0 - pow(max(1.0 - t, 0.0), aExtra.y);
  float size = mix(aSize.x, aSize.y, st);
  float rot = aSize.z + aDyn.w * age;
  vec4 rc = texture2D(uRamp, vec2((t * 63.0 + 0.5) / 64.0, (aCol.w + 0.5) / uRampRows));
  float add = aMisc.y;
  vec3 col = rc.rgb * aCol.rgb;
  if (aExtra.w > 0.5) {   // recolour: luminance × packed tint (24-bit RGB + 1)
    float pk = aExtra.w - 1.0;
    float cb = floor(pk / 65536.0), cg = floor((pk - cb * 65536.0) / 256.0), cr = pk - cb * 65536.0 - cg * 256.0;
    vec3 tc = vec3(cr, cg, cb) / 255.0;
    col = tc * dot(col, vec3(0.3, 0.55, 0.15)) * 1.7;
  }
  col *= mix(uLight, vec3(1.0), add);
  float alpha = rc.a * aExtra.x * anc.w * wrapFade;
  int orient = (flags >> 2) & 7;
  vec2 corner = position.xy;
  if ((flags & 1024) != 0) corner.x = -corner.x;
  float c = cos(rot), s = sin(rot);
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp;
  if (orient == 1) {
    vec3 vv = (viewMatrix * vec4(vel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float len = size * (1.0 + aSize.w * length(vel));
    vec2 o2 = perp * corner.x * size + dir * (corner.y - 0.5) * len;
    wp = pos + camR * o2.x + camU * o2.y;
  } else if (orient == 2) {
    vec2 r2 = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c) * size;
    wp = pos + vec3(r2.x, 0.0, r2.y);
  } else if (orient == 3) {
    vec3 tc = cameraPosition - pos;
    vec3 right = normalize(vec3(tc.z, 0.0, -tc.x) + 1e-5);
    wp = pos + right * corner.x * size + vec3(0.0, (corner.y + 0.5) * size * aSize.w, 0.0);
  } else {
    vec2 r2 = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c) * size;
    wp = pos + camR * r2.x + camU * r2.y;
  }
  if ((flags & 256) != 0) {  // vertical plane facing yaw (aExtra.z)
    vec2 r2 = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c) * size;
    float cy = cos(aExtra.z), sy = sin(aExtra.z);
    wp = pos + vec3(r2.x * cy, r2.y, -r2.x * sy);
  }
  // soft intersection with the ground (cheap stand-in for depth-buffer soft particles)
  vGround = 1e3; vSoft = 1.0;
  if ((flags & 64) == 0) {
    float hc = groundH(pos.xz, uGroundY);
    if (pos.y > hc - 2.0) { vGround = wp.y - groundH(wp.xz, uGroundY); vSoft = clamp(size * 0.3, 0.05, 1.6); }
  }
  vec3 f0 = applyFog(vec3(0.0), pos), f1 = applyFog(vec3(1.0), pos);
  vFog = clamp(1.0 - (f1.r - f0.r), 0.0, 1.0);
  vFogCol = f0 / max(vFog, 1e-3);
  float cellI = aMisc.x;
  vec2 cell = vec2(mod(cellI, ${GRID}.0), floor(cellI / ${GRID}.0));
  vUv = (cell + 0.004 + uv * 0.992) / ${GRID}.0;
  vColor = vec4(col, alpha);
  vAdd = add;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D uAtlas; uniform float uDesat;
varying vec2 vUv; varying vec4 vColor; varying float vAdd; varying float vGround; varying float vSoft; varying float vFog; varying vec3 vFogCol;
void main() {
  vec4 tx = texture2D(uAtlas, vUv);
  float a = tx.a * vColor.a;
  if (vGround < vSoft) a *= smoothstep(0.0, vSoft, vGround);
  if (a < 0.002) discard;
  vec3 rgb = tx.rgb * vColor.rgb;
  float fa = vFog * (1.0 - vAdd);
  rgb = mix(rgb, vFogCol, fa) * (1.0 - vFog * vAdd);
  rgb = mix(rgb, vec3(dot(rgb, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  gl_FragColor = vec4(rgb * a, a * (1.0 - vAdd));
}`;

// ------------------------------------------------------------------ particle type compiler
const toR = v => Array.isArray(v) ? v : [v, v];
/**
 * Compile a particle type. Values are numbers or [min, max] ranges.
 * pool 'add'|'alpha' · sprite (index | [indices]) · ramp · life · size · end (end-size multiplier) · ease (size ease-out)
 * rot · spin (rad/s; randSpin flips sign randomly) · drag · accY (gravity < 0 < buoyancy) · turb (sine-field wobble, m)
 * stretch (velocity streak factor) · color [r,g,b] linear · color2 (random mix) · i (HDR intensity) · alpha · add (0..1)
 * orient 'billboard'|'stretch'|'flat'|'axisY'|'plane' · motion 'ballistic'|'orbit'|'orbitV' (rise, rgrow) · noGround
 * pingpong · loop · wrap (weather)
 */
export function P(d) {
  let flags = 0;
  if (d.motion === 'orbit') flags |= F.ORBIT; else if (d.motion === 'orbitV') flags |= F.ORBITV;
  if (d.orient === 'stretch') flags |= F.STRETCH; else if (d.orient === 'flat') flags |= F.FLAT | F.NOGROUND; else if (d.orient === 'axisY') flags |= F.AXISY;
  else if (d.orient === 'plane') flags |= F.FLATV;
  if (d.loop) flags |= F.LOOP; if (d.pingpong) flags |= F.PINGPONG; if (d.noGround) flags |= F.NOGROUND; if (d.wrap) flags |= F.WRAP | F.NOGROUND;
  const add = d.add ?? (d.pool === 'alpha' ? 0 : 1);
  const orbit = !!(flags & 3);
  const ramp = d.ramp ?? R.wFade;
  const p = {
    pool: d.pool || (add > 0.5 ? 'add' : 'alpha'),
    sprites: Array.isArray(d.sprite) ? d.sprite : [d.sprite ?? S.glow],
    ramp, white: WHITE_RAMPS.has(ramp),
    life: toR(d.life ?? 1), size: toR(d.size ?? 1), end: toR(d.end ?? 1), ease: d.ease ?? 1,
    rot: toR(d.rot ?? [0, 6.2832]), spin: toR(d.spin ?? 0), randSpin: !!d.randSpin,
    k0: toR(orbit ? (d.rise ?? 0) : (d.accY ?? 0)), k1: toR(orbit ? (d.rgrow ?? 0) : (d.drag ?? 0)), orbit,
    turb: toR(d.turb ?? 0), stretch: toR(d.stretch ?? (d.orient === 'axisY' ? 1 : 0)),
    color: d.color ?? [1, 1, 1], color2: d.color2 ?? null, i: toR(d.i ?? 1), alpha: toR(d.alpha ?? 1), add,
    tintable: d.tintable ?? true, flags, src: d,
  };
  return p;
}
/** Derive a particle type with overrides. */
export const V = (base, over) => P({ ...base.src, ...over });

// ------------------------------------------------------------------ anchors
// 1024 world positions (+ alpha in w) in a float texture, re-uploaded when dirty.
export class Anchors {
  constructor(n = 1024) {
    this.n = n;
    this.data = new Float32Array(n * 4);
    this.until = new Float64Array(n);
    this.used = new Uint8Array(n);
    this.tex = new THREE.DataTexture(this.data, 64, Math.ceil(n / 64), THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;
    this.dirty = false; this.cursor = 0;
  }
  alloc(now) {
    for (let k = 0; k < this.n; k++) {
      const i = (this.cursor + k) % this.n;
      if (!this.used[i] && this.until[i] <= now) { this.used[i] = 1; this.until[i] = now; this.set(i, 0, -9999, 0, 0); this.cursor = (i + 1) % this.n; return i; }
    }
    return -1;
  }
  set(i, x, y, z, a) {
    if (i < 0) return;
    const d = this.data, k = i * 4;
    d[k] = x; d[k + 1] = y; d[k + 2] = z; d[k + 3] = a;
    this.dirty = true;
  }
  setA(i, a) { if (i >= 0) { this.data[i * 4 + 3] = a; this.dirty = true; } }
  touch(i, until) { if (i >= 0 && until > this.until[i]) this.until[i] = until; }
  free(i) { if (i < 0) return; this.used[i] = 0; this.setA(i, 0); }
  reset() { this.used.fill(0); this.until.fill(0); this.data.fill(0); this.dirty = true; this.cursor = 0; }
  flush() { if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; } }
  count() { let c = 0; for (let i = 0; i < this.n; i++) c += this.used[i]; return c; }
}

// ------------------------------------------------------------------ pools
const QUAD = (() => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
})();

export class ParticlePool {
  constructor(name, ring, held, material, renderOrder) {
    this.name = name; this.ring = ring; this.heldN = held; this.size = ring + held;
    this.data = new Float32Array(this.size * STRIDE);
    for (let i = 0; i < this.size; i++) { this.data[i * STRIDE + 3] = -1e9; this.data[i * STRIDE + 7] = 1; this.data[i * STRIDE + 22] = -1; }
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buf.setUsage(THREE.DynamicDrawUsage);
    this.uploads = 0; this.fullAt = -1;
    this.buf.onUpload(() => { this.uploads++; });
    const g = new THREE.InstancedBufferGeometry();
    g.index = QUAD.index;
    g.setAttribute('position', QUAD.attributes.position);
    g.setAttribute('uv', QUAD.attributes.uv);
    ['aP0', 'aV0', 'aDyn', 'aSize', 'aCol', 'aMisc', 'aExtra'].forEach((n, i) => g.setAttribute(n, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    g.instanceCount = this.size;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; this.mesh.name = 'fx-particles-' + name;
    // two ring regions: short-lived bursts, and a smaller one for long-lived (> 4 s) particles (so combat spam can
    // never recycle ambient smoke / weather early)
    const longN = Math.min(4096, ring >> 3);
    this.regions = [{ base: 0, n: ring - longN, head: 0, written: 0, start: 0 }, { base: ring - longN, n: longN, head: 0, written: 0, start: 0 }];
    this.free = new Int32Array(held); this.nFree = 0;
    for (let i = this.size - 1; i >= ring; i--) this.free[this.nFree++] = i;
    this.heldDirty = new Int32Array(held + 16); this.nDirty = 0;
    this.spawned = 0; this.until = -1;
  }
  reset() {
    for (let i = 0; i < this.size; i++) { const b = i * STRIDE; this.data[b + 3] = -1e9; this.data[b + 7] = 1; this.data[b + 22] = -1; this.data[b + 23] = 0; }
    for (const r of this.regions) { r.head = 0; r.written = 0; r.start = 0; }
    this.nDirty = 0; this.until = -1;
    this.nFree = 0; for (let i = this.size - 1; i >= this.ring; i--) this.free[this.nFree++] = i;
    this.fullAt = this.uploads;
  }
  nextRing(life = 0) {
    const r = this.regions[life > 4 ? 1 : 0];
    const s = r.base + r.head;
    r.head = (r.head + 1) % r.n;
    r.written++;
    return s;
  }
  allocHeld() { return this.nFree ? this.free[--this.nFree] : -1; }
  killHeld(slot) {
    if (slot < this.ring) return;
    const b = slot * STRIDE;
    this.data[b + 3] = -1e9; this.data[b + 7] = 1; this.data[b + 23] = 0;
    this.markHeld(slot);
    this.free[this.nFree++] = slot;
  }
  markHeld(slot) {
    if (this.nDirty < this.heldDirty.length) this.heldDirty[this.nDirty++] = slot;
    else this.fullAt = this.uploads;
  }
  flush() {
    if (this.fullAt >= 0) {
      if (this.uploads > this.fullAt) this.fullAt = -1;
      else {
        for (let i = 0; i < this.regions.length; i++) { const r = this.regions[i]; this.spawned += r.written; r.written = 0; r.start = r.head; }
        this.nDirty = 0;
        this.buf.clearUpdateRanges(); this.buf.needsUpdate = true; return;
      }
    }
    let any = false;
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (r.written <= 0) continue;
      const n = Math.min(r.written, r.n), a = r.start;
      if (a + n <= r.n) addRange(this.buf, (r.base + a) * STRIDE, n * STRIDE);
      else { addRange(this.buf, (r.base + a) * STRIDE, (r.n - a) * STRIDE); addRange(this.buf, r.base * STRIDE, (a + n - r.n) * STRIDE); }
      this.spawned += r.written;
      r.written = 0; r.start = r.head; any = true;
    }
    if (this.nDirty) {
      for (let i = 0; i < this.nDirty; i++) addRange(this.buf, this.heldDirty[i] * STRIDE, STRIDE);
      this.nDirty = 0; any = true;
    }
    if (any) this.buf.needsUpdate = true;
  }
  alive(now) {
    let c = 0; const d = this.data;
    for (let i = 0; i < this.size; i++) { const b = i * STRIDE; const age = now - d[b + 3]; if (age >= 0 && (age <= d[b + 7] || (d[b + 23] & 32))) c++; }
    return c;
  }
}

// ------------------------------------------------------------------ system
export class Particles {
  constructor(fx, { ring = 24576, ringAlpha = 12288, held = 3072, heldAlpha = 1024 } = {}) {
    this.fx = fx;
    const u = fx.u;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: {
        uFxTime: u.uFxTime, uRamp: u.uRamp, uRampRows: u.uRampRows, uAnchors: u.uAnchors, uAtlas: u.uAtlas,
        uLight: u.uLight, uFocus: u.uFocus, uWrapBox: u.uWrapBox,
        uHeightTex: u.uHeightTex, uHeightInfo: u.uHeightInfo, uHasHeight: u.uHasHeight, uGroundY: u.uGroundY,
        uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase,
        uSunDir: G.uSunDir, uCamPos: G.uCamPos, uDesat: G.uDesat,
      },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mat = mat;
    this.alpha = new ParticlePool('alpha', ringAlpha, heldAlpha, mat, 20);
    this.add = new ParticlePool('add', ring, held, mat, 26);
    this.pools = { alpha: this.alpha, add: this.add }; this.poolList = [this.alpha, this.add];
    this.bt = 0;          // back-date seconds for sub-frame emission
    this.tint = null;     // effect-level colour (re-themes particles that allow it)
  }
  get meshes() { return [this.alpha.mesh, this.add.mesh]; }
  /**
   * Write one particle. pr = compiled type (P()). Velocity args are (radius, angle, angVel) for orbit types.
   * o: { scale, size, end, life, drag, alpha, i, tint:[r,g,b], anchor, held, dt (delay >0 / backdate <0 … see below),
   *      rot, yaw, spin, mirror }   o.dt: seconds the particle is born AFTER now (positive = delayed start)
   */
  spawn(pr, x, y, z, vx, vy, vz, o = NO) {
    const fx = this.fx, pool = this.pools[pr.pool];
    const rng = Math.random;
    const life = (pr.life[0] === pr.life[1] ? pr.life[0] : pr.life[0] + (pr.life[1] - pr.life[0]) * rng()) * (o.life ?? 1);
    const slot = o.held ? pool.allocHeld() : pool.nextRing(life + (o.dt > 0 ? o.dt : 0));
    if (slot < 0) return -1;
    const d = pool.data, b = slot * STRIDE;
    const sc = o.scale ?? 1;
    const s0 = rr(pr.size) * sc * (o.size ?? 1);
    let flags = pr.flags;
    if (o.held) flags |= F.LOOP;
    if (o.mirror) flags |= F.MIRROR;
    d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = fx.time + (o.dt ?? 0) - this.bt;
    d[b + 4] = vx; d[b + 5] = vy; d[b + 6] = vz; d[b + 7] = life;
    d[b + 8] = rr(pr.k0) * (pr.orbit ? sc : 1); d[b + 9] = o.drag ?? rr(pr.k1) * (pr.orbit ? sc : 1); d[b + 10] = rr(pr.turb) * sc;
    let spin = o.spin ?? rr(pr.spin); if (pr.randSpin && rng() < 0.5) spin = -spin;
    d[b + 11] = spin;
    d[b + 12] = s0; d[b + 13] = s0 * rr(pr.end) * (o.end ?? 1); d[b + 14] = o.rot ?? rr(pr.rot); d[b + 15] = o.stretch ?? rr(pr.stretch);
    const c = pr.color, c2 = pr.color2, it = rr(pr.i) * (o.i ?? 1);
    let cr = c[0], cg = c[1], cb = c[2];
    if (c2) { const m = rng(); cr += (c2[0] - cr) * m; cg += (c2[1] - cg) * m; cb += (c2[2] - cb) * m; }
    let recolor = 0;
    if (pr.tintable !== false) {
      const tn = o.tint, ct = this.tint;
      if (tn) { if (pr.white) { cr *= tn[0]; cg *= tn[1]; cb *= tn[2]; } else recolor = pack(tn); }
      else if (ct) { if (pr.white) { cr *= ct[0]; cg *= ct[1]; cb *= ct[2]; } else recolor = pack(ct); }
    }
    d[b + 16] = cr * it; d[b + 17] = cg * it; d[b + 18] = cb * it; d[b + 19] = pr.ramp;
    const sp = pr.sprites; d[b + 20] = sp.length === 1 ? sp[0] : sp[(rng() * sp.length) | 0];
    d[b + 21] = pr.add; d[b + 22] = o.anchor ?? -1; d[b + 23] = flags;
    d[b + 24] = rr(pr.alpha) * (o.alpha ?? 1) * fx.dimK; d[b + 25] = pr.ease; d[b + 26] = o.yaw ?? 0; d[b + 27] = recolor;
    if (o.held) pool.markHeld(slot);
    else {
      const end = d[b + 3] + life;
      if (end > pool.until) pool.until = end;
      if (o.anchor >= 0) fx.anchors.touch(o.anchor, end);
    }
    return slot;
  }
  flush() {
    const now = this.fx.time;
    for (let i = 0; i < this.poolList.length; i++) { const p = this.poolList[i]; p.flush(); p.mesh.visible = now <= p.until || p.nFree < p.heldN; }
  }
  reset() { this.alpha.reset(); this.add.reset(); }
  alive() { const now = this.fx.time; return this.add.alive(now) + this.alpha.alive(now); }
  dispose() { this.alpha.geo.dispose(); this.add.geo.dispose(); this.mat.dispose(); }
}
function rr(a) { return a[0] === a[1] ? a[0] : a[0] + (a[1] - a[0]) * Math.random(); }
// recolour packing: 1 + r + g·256 + b·65536 (0..255 each, from a linear tint normalised to max 1)
function pack(t) {
  const m = Math.max(t[0], t[1], t[2], 1e-4), k = m > 1 ? 1 / m : 1;
  return 1 + Math.round(Math.min(1, t[0] * k) * 255) + Math.round(Math.min(1, t[1] * k) * 255) * 256 + Math.round(Math.min(1, t[2] * k) * 255) * 65536;
}
