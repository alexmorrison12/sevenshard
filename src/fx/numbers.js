// Damage numbers in WebGL: instanced glyph quads from a canvas glyph atlas (bold italic, thick dark outline, vertical
// gradient fill), anchored to a world point but sized in screen space (virtual pixels of a 900 px tall view, so they
// read the same at any resolution / zoom). Pop with overshoot, float up and aside, fade. One draw call for hundreds.
// Styles: normal (white), crit (yellow→orange, bigger), back / head (orange tag), counter (blue + COUNTER!), heal
// (green +), shield (cyan +), miss / immune (grey), dot (small), hurt (red, damage taken), stagger (purple).
import * as THREE from 'three';
import { lin, queueRange } from './util.js';

const GSTRIDE = 20;
const CHARS = '0123456789,.+-!%?ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GC = 128, GG = 8, FONT_PX = 86;

function buildGlyphs() {
  const cv = document.createElement('canvas'); cv.width = cv.height = GC * GG;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, cv.width, cv.height);
  g.font = `italic 900 ${FONT_PX}px "Arial Black", "Helvetica Neue", "Segoe UI Black", Impact, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
  const adv = new Float32Array(CHARS.length);
  for (let i = 0; i < CHARS.length; i++) {
    const ch = CHARS[i], cx = (i % GG) * GC + GC / 2, cy = Math.floor(i / GG) * GC + 98;
    adv[i] = g.measureText(ch).width / FONT_PX;
    g.strokeStyle = 'rgba(8,6,10,1)'; g.lineWidth = 17; g.strokeText(ch, cx, cy);
    g.fillStyle = '#fff'; g.fillText(ch, cx, cy);
  }
  const img = g.getImageData(0, 0, cv.width, cv.height);
  // flip Y for GL, keep straight (un-premultiplied) RGBA
  const W = cv.width, H = cv.height, src = img.data, dst = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) dst.set(src.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  const tex = new THREE.DataTexture(dst, W, H, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return { tex, adv };
}

const VERT = /* glsl */`
attribute vec4 g0; attribute vec4 g1; attribute vec4 g2; attribute vec4 g3; attribute vec4 g4;
uniform float uFxTime; uniform float uAspect;
varying vec2 vUv; varying vec3 vTop; varying vec3 vBot; varying float vA; varying float vG;
void main() {
  float age = uFxTime - g0.w, life = g4.z, T = age / life;
  if (age < 0.0 || T > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int anim = int(g2.w + 0.5);
  float peak = anim == 1 ? 1.6 : anim == 3 ? 1.15 : anim == 4 ? 1.1 : 1.35;
  float pop = age < 0.05 ? mix(0.4, peak, age / 0.05) : age < 0.17 ? mix(peak, 1.0, smoothstep(0.0, 1.0, (age - 0.05) / 0.12)) : 1.0;
  pop *= mix(1.0, 0.82, smoothstep(0.72, 1.0, T));
  float riseAmt = anim == 2 ? 56.0 : anim == 1 ? 44.0 : 38.0;
  float rise = riseAmt * (1.0 - exp(-age * 3.4)) + age * 8.0;
  float drift = g4.y * (1.0 - exp(-age * 2.6));
  float shake = anim == 1 ? sin(age * 70.0) * 3.0 * exp(-age * 9.0) : 0.0;
  vec2 corner = position.xy;                              // [-0.5, 0.5]
  float size = g1.w * pop;                                // px per em
  float cellEm = ${(GC / FONT_PX).toFixed(4)};
  vec2 px = vec2((g1.y + corner.x * cellEm) * size + drift + shake, corner.y * cellEm * size + g4.x + rise);
  vec4 clip = projectionMatrix * viewMatrix * vec4(g0.xyz, 1.0);
  clip.xy += vec2(px.x * 2.0 / (900.0 * uAspect), px.y * 2.0 / 900.0) * clip.w;
  clip.z = -clip.w * 0.999;                                // always in front
  float cell = g1.x;
  vUv = (vec2(mod(cell, ${GG}.0), ${GG - 1}.0 - floor(cell / ${GG}.0)) + corner + 0.5) / ${GG}.0;
  vTop = g2.rgb; vBot = g3.rgb; vG = corner.y + 0.5;
  vA = (1.0 - smoothstep(0.72, 1.0, T)) * smoothstep(0.0, 0.03, age);
  gl_Position = clip;
}`;
const FRAG = /* glsl */`
uniform sampler2D uGlyphs;
varying vec2 vUv; varying vec3 vTop; varying vec3 vBot; varying float vA; varying float vG;
void main() {
  vec4 t = texture2D(uGlyphs, vUv);
  float a = t.a * vA;
  if (a < 0.003) discard;
  vec3 c = mix(vBot, vTop, smoothstep(0.28, 0.72, vG));
  gl_FragColor = vec4(c * t.r * a, a);
}`;

// style → fill gradient (top, bottom; linear HDR), size (virtual px per em), anim, tag
const ST = {
  normal: { top: lin(0xffffff, 0.95), bot: lin(0xc4c8d2, 0.85), size: 25, anim: 0 },
  crit: { top: lin(0xfff27a, 1.05), bot: lin(0xff8a1a, 1.05), size: 34, anim: 1 },
  back: { top: lin(0xffffff, 0.95), bot: lin(0xc4c8d2, 0.85), size: 27, anim: 0, tag: 'BACK ATTACK', tagTop: lin(0xffc070, 1.1), tagBot: lin(0xff6a10, 1.1) },
  head: { top: lin(0xffffff, 0.95), bot: lin(0xc4c8d2, 0.85), size: 27, anim: 0, tag: 'HEAD ATTACK', tagTop: lin(0xffc070, 1.1), tagBot: lin(0xff6a10, 1.1) },
  counter: { top: lin(0xc8ecff, 1.1), bot: lin(0x3a8cff, 1.15), size: 34, anim: 1, tag: 'COUNTER!', tagTop: lin(0xd8f0ff, 1.2), tagBot: lin(0x4aa0ff, 1.2) },
  heal: { top: lin(0xc8ffb0, 0.95), bot: lin(0x3adc5a, 0.95), size: 25, anim: 2, prefix: '+' },
  shield: { top: lin(0xd0ffff, 0.95), bot: lin(0x30d0e8, 0.95), size: 23, anim: 2, prefix: '+' },
  miss: { top: lin(0xd8d8d8, 0.75), bot: lin(0x8a8a90, 0.7), size: 22, anim: 4 },
  immune: { top: lin(0xd8d8d8, 0.75), bot: lin(0x8a8a90, 0.7), size: 22, anim: 4 },
  dot: { top: lin(0xffd8a8, 0.85), bot: lin(0xc07a40, 0.8), size: 19, anim: 0 },
  hurt: { top: lin(0xff9a8a, 1.0), bot: lin(0xe01818, 1.0), size: 26, anim: 0 },
  stagger: { top: lin(0xe8c8ff, 1.0), bot: lin(0x9a4aff, 1.0), size: 24, anim: 0 },
};
// stacking slots for simultaneous numbers on one target (x drift, y offset in em): a zig-zag ladder, newest on top
const FAN = [[0, 0], [0.45, 1.05], [-0.45, 2.1], [0.45, 3.15], [-0.45, 4.2], [0.45, 5.25], [-0.45, 6.3], [0.45, 7.35]];

export class Numbers {
  constructor(fx, n = 6144) {
    this.fx = fx; this.n = n;
    const { tex, adv } = buildGlyphs();
    this.tex = tex; this.adv = adv;
    this.idx = new Int16Array(128).fill(-1);
    for (let i = 0; i < CHARS.length; i++) this.idx[CHARS.charCodeAt(i)] = i;
    this.data = new Float32Array(n * GSTRIDE);
    for (let i = 0; i < n; i++) { this.data[i * GSTRIDE + 3] = -1e9; this.data[i * GSTRIDE + 18] = 1; }
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, GSTRIDE, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    for (let k = 0; k < 5; k++) g.setAttribute('g' + k, new THREE.InterleavedBufferAttribute(this.buf, 4, k * 4));
    g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uFxTime: fx.u.uFxTime, uAspect: fx.u.uAspect, uGlyphs: { value: tex } },
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1000; this.mesh.name = 'fx-numbers';
    this.head = 0; this.until = -1; this.lo = n; this.hi = -1;
    // recent numbers for stacking: x, z, time, count
    this.recent = new Float32Array(48 * 4).fill(-99); this.rHead = 0;
    this.buf8 = new Uint8Array(40); // char scratch
    this.count = 0;
  }
  // format into this.buf8 (char codes); returns length
  fmt(value, prefix) {
    const b = this.buf8; let n = 0;
    if (prefix) b[n++] = prefix.charCodeAt(0);
    if (typeof value === 'string') { const s = value.toUpperCase(); for (let i = 0; i < s.length && n < 38; i++) b[n++] = s.charCodeAt(i); return n; }
    let v = Math.round(Math.abs(value));
    if (value < 0 && !prefix) b[n++] = 45;
    const start = n; let digits = 0;
    do { b[n++] = 48 + (v % 10); v = Math.floor(v / 10); digits++; if (v > 0 && digits % 3 === 0) b[n++] = 44; } while (v > 0 && n < 38);
    for (let i = start, j = n - 1; i < j; i++, j--) { const t = b[i]; b[i] = b[j]; b[j] = t; }
    return n;
  }
  widthOf(len) { let w = 0; for (let i = 0; i < len; i++) { const k = this.idx[this.buf8[i]]; w += (k >= 0 ? this.adv[k] : 0.4) - 0.07; } return w + 0.07; }
  writeRun(len, x, y, z, t0, size, top, bot, anim, yOff, drift, life) {
    const w = this.widthOf(len);
    let cx = -w / 2;
    for (let i = 0; i < len; i++) {
      const k = this.idx[this.buf8[i]], a = k >= 0 ? this.adv[k] : 0.4;
      if (k >= 0) {
        const s = this.head; this.head = (this.head + 1) % this.n;
        const d = this.data, b = s * GSTRIDE;
        d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = t0;
        d[b + 4] = k; d[b + 5] = cx + a / 2; d[b + 6] = a; d[b + 7] = size;
        d[b + 8] = top[0]; d[b + 9] = top[1]; d[b + 10] = top[2]; d[b + 11] = anim;
        d[b + 12] = bot[0]; d[b + 13] = bot[1]; d[b + 14] = bot[2]; d[b + 15] = 0;
        d[b + 16] = yOff; d[b + 17] = drift; d[b + 18] = life; d[b + 19] = 0;
        if (s < this.lo) this.lo = s; if (s > this.hi) this.hi = s;
      }
      cx += a - 0.07;
    }
  }
  /** value: number or string. o: { style, scale, crit, tag } */
  spawn(p, value, o) {
    const fx = this.fx, now = fx.time;
    let st = ST[o.style] || ST.normal;
    const crit = o.crit || o.style === 'crit';
    const scale = o.scale ?? 1;
    let top = st.top, bot = st.bot, size = st.size * scale, anim = st.anim;
    if (crit && o.style !== 'crit' && o.style !== 'counter') { top = ST.crit.top; bot = ST.crit.bot; size = ST.crit.size * scale * 1.05; anim = 1; }
    if (o.style === 'miss' && value == null) value = 'MISS';
    if (o.style === 'immune' && value == null) value = 'IMMUNE';
    // stacking: count recent numbers near this point
    let near = 0;
    const R = this.recent;
    for (let i = 0; i < 48; i++) {
      const b = i * 4;
      if (now - R[b + 2] < 0.45 && Math.abs(R[b] - p.x) < 1.6 && Math.abs(R[b + 1] - p.z) < 1.6) near++;
    }
    const rb = this.rHead * 4; R[rb] = p.x; R[rb + 1] = p.z; R[rb + 2] = now; this.rHead = (this.rHead + 1) % 48;
    const slot = near % FAN.length, fan = FAN[slot];
    const len = this.fmt(value, st.prefix);
    const yOff = fan[1] * 33 + (Math.random() - 0.5) * 4;              // fixed rung height: crits and normals share the ladder
    const drift = fan[0] * size * Math.max(1, len * 0.4) + (Math.random() - 0.5) * 10;   // side slots clear the run's width
    const life = anim === 2 ? 1.15 : anim === 1 ? 1.05 : 0.9;
    this.writeRun(len, p.x, p.y, p.z, now, size, top, bot, anim, yOff, drift, life);
    const tag = o.tag ?? st.tag;
    if (tag) {
      const tl = this.fmt(tag, null);
      const tst = ST[o.style]?.tagTop ? ST[o.style] : ST.back;
      this.writeRun(tl, p.x, p.y, p.z, now, size * 0.5, tst.tagTop, tst.tagBot, 3, yOff + size * 0.95, drift, life);
    }
    if (now + life > this.until) this.until = now + life;
    this.count++;
  }
  update() {
    if (this.hi >= this.lo) {
      queueRange(this.buf, this.lo * GSTRIDE, (this.hi - this.lo + 1) * GSTRIDE);
      this.lo = this.n; this.hi = -1;
    }
    this.mesh.visible = this.fx.time <= this.until;
  }
  reset() { for (let i = 0; i < this.n; i++) this.data[i * GSTRIDE + 3] = -1e9; this.lo = 0; this.hi = this.n - 1; this.until = -1; this.recent.fill(-99); }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.tex.dispose(); }
}
export const NUMBER_STYLES = Object.keys(ST);
