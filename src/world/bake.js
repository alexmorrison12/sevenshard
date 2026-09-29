// GPU texture baker. A private offscreen WebGL2 context runs procedural GLSL "paintings" (tileable, periodic noise),
// reads the pixels back, and hands them to three.js as Data(Array)Textures in the game's own context.
// Painting on the GPU is ~100× faster than per-pixel JS, so every zone gets rich 512² ground, wall, roof and decal
// textures (albedo + height, and normal + cavity AO + emissive mask) in a few milliseconds each.
//
//   const { albedo, normal, normal3, rgba } = bakeSet(recipeGLSL, { size: 512, outputs: ['albedo', 'normal'], bump, cavity })
//
// A recipe is GLSL that defines `Surf surf(vec2 uv)` for uv in [0,1) and MUST be periodic in uv (use the p* helpers,
// which wrap on an integer lattice). Surf = { col (display-space rgb), h (0..1 height), ao, emit, a (alpha) }.
// Pass 1 renders the recipe ONCE per texel into two targets (col,h) and (ao,emit,a); pass 2 derives the normal map
// and cavity AO from the height channel with wrapped texel fetches.
// Outputs: albedo  → (col, h)              ground layers: height in alpha drives height-blending
//          normal  → (nx, ny, ao, emit)    ground layers: packed normal + cavity AO + emissive mask
//          normal3 → (n.xyz, ao)           three.js tangent-space normal maps for kit materials
//          rgba    → (col, a)              cut-out/alpha textures: leaves, decals, sprites
//          emit    → (emit, emit, emit, 1) emissive maps

export const GLSL_LIB = /* glsl */`
#define PI 3.14159265
#define TAU 6.2831853
uniform float uP[16];
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint hu(ivec2 c, int seed) { return pcg(uint(c.x) + pcg(uint(c.y) + pcg(uint(seed) + 1013904223u))); }
float h1(ivec2 c, int seed) { return float(hu(c, seed) & 0xffffffu) / 16777215.0; }
vec2 h2(ivec2 c, int seed) { uint a = hu(c, seed); return vec2(float(a & 0xffffu), float(a >> 16u)) / 65535.0; }
vec4 h4(ivec2 c, int seed) { uint a = hu(c, seed), b = pcg(a ^ 0x9e3779b9u); return vec4(float(a & 0xffffu), float(a >> 16u), float(b & 0xffffu), float(b >> 16u)) / 65535.0; }
ivec2 wrapc(ivec2 c, ivec2 per) { return ivec2(mod(vec2(c), vec2(per))); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// periodic value noise [0,1]; p in lattice units, per = lattice period
float pvnoise(vec2 p, ivec2 per, int seed) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = h1(wrapc(c, per), seed), b = h1(wrapc(c + ivec2(1, 0), per), seed);
  float d = h1(wrapc(c + ivec2(0, 1), per), seed), e = h1(wrapc(c + ivec2(1, 1), per), seed);
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}
// periodic gradient noise [-1,1]
float pnoise(vec2 p, ivec2 per, int seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  vec2 ga = h2(wrapc(c, per), seed) * 2.0 - 1.0, gb = h2(wrapc(c + ivec2(1, 0), per), seed) * 2.0 - 1.0;
  vec2 gc = h2(wrapc(c + ivec2(0, 1), per), seed) * 2.0 - 1.0, gd = h2(wrapc(c + ivec2(1, 1), per), seed) * 2.0 - 1.0;
  float va = dot(ga, f), vb = dot(gb, f - vec2(1, 0)), vc = dot(gc, f - vec2(0, 1)), vd = dot(gd, f - vec2(1, 1));
  return 1.6 * mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}
// fbm over uv with base frequency f (integer), octaves oct → [-1,1]-ish
float fbm(vec2 uv, int f, int oct, int seed) {
  float s = 0.0, a = 0.5, n = 0.0; int fr = f;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * pnoise(uv * float(fr), ivec2(fr), seed + i * 31); n += a; a *= 0.5; fr *= 2; }
  return s / n;
}
float vfbm(vec2 uv, int f, int oct, int seed) {
  float s = 0.0, a = 0.5, n = 0.0; int fr = f;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * pvnoise(uv * float(fr), ivec2(fr), seed + i * 31); n += a; a *= 0.5; fr *= 2; }
  return s / n;
}
float ridged(vec2 uv, int f, int oct, int seed) {
  float s = 0.0, a = 0.5, n = 0.0; int fr = f;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; float v = 1.0 - abs(pnoise(uv * float(fr), ivec2(fr), seed + i * 31)); s += a * v * v; n += a; a *= 0.5; fr *= 2; }
  return s / n;
}
// periodic voronoi (lattice units). Returns (F1, F2, border distance, cell hash); cell = wrapped cell id, ctr = feature point.
vec4 pvoro(vec2 p, ivec2 per, int seed, float jit, out ivec2 cell, out vec2 ctr) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0; vec2 mr = vec2(0); ivec2 mc = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 g = ivec2(i, j);
    ivec2 c = wrapc(ivec2(ip) + g, per);
    vec2 o = 0.5 + (h2(c, seed) - 0.5) * jit;
    vec2 r = vec2(g) + o - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; mr = r; mc = c; } else if (d < f2) f2 = d;
  }
  float bd = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    ivec2 g = ivec2(i, j);
    ivec2 c = wrapc(ivec2(ip) + g, per);
    vec2 o = 0.5 + (h2(c, seed) - 0.5) * jit;
    vec2 r = vec2(g) + o - fp;
    if (dot(mr - r, mr - r) > 0.00001) bd = min(bd, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  cell = mc; ctr = p + mr;
  return vec4(sqrt(f1), sqrt(f2), bd, h1(mc, seed + 7));
}
// staggered periodic voronoi: odd rows shifted by half a cell → hexagonal cells (per.y must be even)
vec4 pvoroHex(vec2 p, ivec2 per, int seed, float jit, out ivec2 cell, out vec2 ctr) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0; vec2 mr = vec2(0); ivec2 mc = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -2; i <= 2; i++) {
    ivec2 g = ivec2(i, j);
    ivec2 raw = ivec2(ip) + g;
    ivec2 c = wrapc(raw, per);
    float sh = mod(float(c.y), 2.0) * 0.5;
    vec2 o = vec2(0.5 + sh, 0.5) + (h2(c, seed) - 0.5) * jit;
    vec2 r = vec2(g) + o - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; mr = r; mc = c; } else if (d < f2) f2 = d;
  }
  float bd = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    ivec2 g = ivec2(i, j);
    ivec2 c = wrapc(ivec2(ip) + g, per);
    float sh = mod(float(c.y), 2.0) * 0.5;
    vec2 o = vec2(0.5 + sh, 0.5) + (h2(c, seed) - 0.5) * jit;
    vec2 r = vec2(g) + o - fp;
    if (dot(mr - r, mr - r) > 0.00001) bd = min(bd, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  cell = mc; ctr = p + mr;
  return vec4(sqrt(f1), sqrt(f2), bd, h1(mc, seed + 7));
}
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h); }
vec2 wd(vec2 d) { return d - floor(d + 0.5); }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

struct Surf { vec3 col; float h; float ao; float emit; float a; };
Surf S0() { Surf s; s.col = vec3(0.5); s.h = 0.5; s.ao = 1.0; s.emit = 0.0; s.a = 1.0; return s; }
`;

const VERT = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const recipeSrc = recipe => `#version 300 es
precision highp float; precision highp int;
uniform vec2 uRes;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
${GLSL_LIB}
${recipe}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  Surf s = surf(uv);
  o0 = vec4(s.col, s.h);
  o1 = vec4(s.ao, s.emit, s.a, 1.0);
}`;

const NORMAL_SRC = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uA; uniform sampler2D uB; uniform int uMode; uniform float uBump; uniform float uCav; uniform ivec2 uSize;
out vec4 o;
float H(ivec2 p) { p = ivec2(mod(vec2(p), vec2(uSize))); return texelFetch(uA, p, 0).a; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 A = texelFetch(uA, p, 0), B = texelFetch(uB, p, 0);
  if (uMode == 3) { o = vec4(A.rgb, B.b); return; }
  if (uMode == 4) { o = vec4(B.g, B.g, B.g, 1.0); return; }
  float h = A.a;
  float hl = H(p - ivec2(1, 0)), hr = H(p + ivec2(1, 0)), hd = H(p - ivec2(0, 1)), hu = H(p + ivec2(0, 1));
  float hw = (H(p - ivec2(3, 0)) + H(p + ivec2(3, 0)) + H(p - ivec2(0, 3)) + H(p + ivec2(0, 3))) * 0.25;
  float hw2 = (H(p - ivec2(2, 2)) + H(p + ivec2(2, 2)) + H(p + ivec2(2, -2)) + H(p - ivec2(2, -2))) * 0.25;
  float cav = clamp(1.0 - max((hw + hw2) * 0.5 - h, 0.0) * uCav, 0.0, 1.0);
  vec3 n = normalize(vec3((hl - hr) * uBump, (hd - hu) * uBump, 1.0));
  if (uMode == 1) o = vec4(n.xy * 0.5 + 0.5, B.r * cav, B.g);
  else o = vec4(n * 0.5 + 0.5, B.r * cav);
}`;

let ctx = null;
function getCtx() {
  if (ctx && !ctx.gl.isContextLost()) return ctx;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4, 4) : document.createElement('canvas');
  const gl = cv.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('bake: WebGL2 unavailable');
  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VERT); gl.compileShader(vs);
  ctx = { gl, vs, progs: new Map(), fbos: new Map(), vao: gl.createVertexArray(), par: gl.getExtension('KHR_parallel_shader_compile') };
  return ctx;
}

function compile(src) {
  const c = getCtx(), gl = c.gl;
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, src); gl.compileShader(fs);
  const pr = gl.createProgram(); gl.attachShader(pr, c.vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  return { pr, fs, src, ready: false };
}
function finish(p) {
  if (p.ready) return p;
  const gl = getCtx().gl;
  if (!gl.getProgramParameter(p.pr, gl.LINK_STATUS)) {
    const log = gl.getShaderInfoLog(p.fs) || gl.getProgramInfoLog(p.pr), src = p.src.split('\n');
    const m = /0:(\d+)/.exec(log || ''); const line = m ? +m[1] : 0;
    throw new Error('bake shader error: ' + log + '\n' + src.slice(Math.max(0, line - 3), line + 2).join('\n'));
  }
  const L = n => gl.getUniformLocation(p.pr, n);
  p.u = { res: L('uRes'), P: L('uP'), A: L('uA'), B: L('uB'), mode: L('uMode'), bump: L('uBump'), cav: L('uCav'), size: L('uSize') };
  p.ready = true;
  return p;
}
function program(key, src) {
  const c = getCtx();
  const t0 = performance.now();
  let p = c.progs.get(key);
  if (!p) { p = compile(src); c.progs.set(key, p); }
  const r = finish(p);
  bakeStats.compile += performance.now() - t0;
  return r;
}
/** Start compiling recipes in the background (parallel compile when available). */
export function precompile(recipes) {
  const c = getCtx();
  for (const r of recipes) if (!c.progs.has(r)) c.progs.set(r, compile(recipeSrc(r)));
  if (!c.progs.has('__normal')) c.progs.set('__normal', compile(NORMAL_SRC));
}

function targets(size) {
  const c = getCtx(), gl = c.gl;
  let f = c.fbos.get(size);
  if (f) return f;
  const mk = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
  const tA = mk(), tB = mk(), tO = mk();
  const fb1 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tA, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tB, 0);
  const fb2 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tO, 0);
  f = { fb1, fb2, tA, tB, tO }; c.fbos.set(size, f);
  return f;
}

const MODE = { normal: 1, normal3: 2, rgba: 3, emit: 4 };
export const bakeStats = { calls: 0, ms: 0, compile: 0, log: [] };

/**
 * Bake a recipe once and return the requested outputs as Uint8Arrays (size*size*4, row 0 = v 0).
 * outputs ⊂ ['albedo', 'normal', 'normal3', 'rgba', 'emit']
 */
export function bakeSet(recipe, { size = 512, outputs = ['albedo'], bump = 3, cavity = 5, params = null } = {}) {
  const t0 = performance.now();
  const c = getCtx(), gl = c.gl, f = targets(size);
  const p = program(recipe, recipeSrc(recipe));
  gl.bindVertexArray(c.vao);
  gl.viewport(0, 0, size, size);
  gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb1);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.useProgram(p.pr);
  gl.uniform2f(p.u.res, size, size);
  if (p.u.P) { const P = new Float32Array(16); if (params) P.set(params.slice(0, 16)); gl.uniform1fv(p.u.P, P); }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = {};
  const read = () => { const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  if (outputs.includes('albedo')) { gl.readBuffer(gl.COLOR_ATTACHMENT0); out.albedo = read(); }
  const post = outputs.filter(o => MODE[o]);
  if (post.length) {
    const n = program('__normal', NORMAL_SRC);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb2);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.useProgram(n.pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, f.tB);
    gl.uniform1i(n.u.A, 0); gl.uniform1i(n.u.B, 1);
    gl.uniform1f(n.u.bump, bump); gl.uniform1f(n.u.cav, cavity); gl.uniform2i(n.u.size, size, size);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    for (const o of post) { gl.uniform1i(n.u.mode, MODE[o]); gl.drawArrays(gl.TRIANGLES, 0, 3); out[o] = read(); }
  }
  bakeStats.calls++; bakeStats.ms += performance.now() - t0;
  bakeStats.log.push([recipe.slice(0, 40).replace(/\s+/g, ' '), Math.round(performance.now() - t0)]);
  return out;
}
/** single-output convenience (compat) */
export function bake(recipe, { mode = 'albedo', ...o } = {}) { return bakeSet(recipe, { ...o, outputs: [mode] })[mode]; }

/** Free the private GL context (textures already live in the game's context). */
export function releaseBaker() {
  if (!ctx) return;
  ctx.gl.getExtension('WEBGL_lose_context')?.loseContext();
  ctx = null;
}
