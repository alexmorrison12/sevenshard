// Ground layers: telegraphs (the red/orange/blue/purple/yellow/white warning shapes players learn) and decals
// (scorch, cracks, craters, frost, runes, blood, fissures, lava, …). Both are ONE instanced draw call each: a
// subdivided unit grid per instance, placed and oriented in the vertex shader and conformed to the terrain height
// texture when the world provides one (G.uHeightTex), otherwise to the instance's base height. Everything animates
// analytically from the spawn time, so the CPU writes an instance once (and again only on setFill / stop).
import * as THREE from 'three';
import { G, FOG_GLSL_PARS } from '../engine/materials.js';
import { GLSL_GROUND, GLSL_NOISE, PREMUL, queueRange, queueAll } from './util.js';
import { D, DGRID } from './textures.js';

export const SHAPE = { circle: 0, cone: 1, rect: 2, line: 2, donut: 3, wedges: 4, ring: 3 };
export const TSTRIDE = 24, DSTRIDE = 16;

function gridGeo(n) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(i / n, j / n, 0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------ telegraph shader
const TELE_VERT = /* glsl */`
attribute vec4 i0; attribute vec4 i1; attribute vec4 i2; attribute vec4 i3; attribute vec4 i4; attribute vec4 i5;
uniform float uFxTime;
varying vec2 vL; varying vec3 vW; varying vec4 vI0; varying vec4 vI1; varying vec4 vI2; varying vec4 vI3; varying vec4 vI4; varying vec4 vI5;
${GLSL_GROUND}
void main() {
  vI0 = i0; vI1 = i1; vI2 = i2; vI3 = i3; vI4 = i4; vI5 = i5;
  int shape = int(i1.z + 0.5);
  float R = i2.x, W = i2.y, halfA = i2.z, m = 0.45 + R * 0.02;
  vec2 mn, mx;
  if (shape == 2) { mn = vec2(-W * 0.5 - m, -m); mx = vec2(W * 0.5 + m, R + m); }
  else if (shape == 1) {
    float sx = halfA < 1.5708 ? R * sin(halfA) : R;
    float y0 = halfA < 1.5708 ? 0.0 : R * cos(halfA);
    mn = vec2(-sx - m, min(y0, 0.0) - m); mx = vec2(sx + m, R + m);
  } else { mn = vec2(-R - m); mx = vec2(R + m); }
  vec2 l = mix(mn, mx, position.xy);
  vec2 f = i1.xy, r = vec2(-f.y, f.x);
  vec2 xz = i0.xz + r * l.x + f * l.y;
  float y = groundH(xz, i0.y) + 0.035 + fract(i5.z * 7.3) * 0.02;
  vL = l; vW = vec3(xz.x, y, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;

const TELE_FRAG = /* glsl */`
uniform float uFxTime; uniform float uDesat;
varying vec2 vL; varying vec3 vW; varying vec4 vI0; varying vec4 vI1; varying vec4 vI2; varying vec4 vI3; varying vec4 vI4; varying vec4 vI5;
${FOG_GLSL_PARS}
float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
void main() {
  float age = uFxTime - vI0.w;
  if (age < 0.0) discard;
  int shape = int(vI1.z + 0.5);
  float dur = vI1.w, R = vI2.x, W = vI2.y, halfA = vI2.z, n = vI2.w;
  int flags = int(vI5.y + 0.5);
  vec2 p = vL;
  float r = length(p);
  float d, prog, L;
  if (shape == 0) { d = r - R; prog = r / R; L = R; }
  else if (shape == 1) {
    float ang = abs(atan(p.x, p.y));
    float side = halfA < 1.5708 ? dot(vec2(abs(p.x), p.y), vec2(cos(halfA), -sin(halfA))) : (ang - halfA) * r;
    d = max(r - R, side); prog = r / R; L = R;
  } else if (shape == 2) { d = sdBox(p - vec2(0.0, R * 0.5), vec2(W * 0.5, R * 0.5)); prog = clamp(p.y / R, 0.0, 1.0); L = R; }
  else if (shape == 3) { d = max(r - R, W - r); prog = clamp((r - W) / max(R - W, 1e-3), 0.0, 1.0); L = R - W; }
  else {
    float sw = 6.2831853 / max(n, 1.0);
    float a = atan(p.x, p.y) + 3.14159265 + vI5.x * sw;
    float k = floor(a / sw), da = a - k * sw;
    float on = mod(k, 2.0);
    float e = min(da, sw - da);
    float sd = r * sin(min(e, 1.5707));
    d = on < 0.5 ? max(r - R, -sd) : max(r - R, sd);
    prog = r / R; L = R;
  }
  if ((flags & 8) != 0) prog = 1.0 - prog;                 // fill from the far edge inward
  float aa = max(fwidth(d), 0.003);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  // lifecycle
  float appear = smoothstep(0.0, 0.14, age);
  float fill = vI4.w >= 0.0 ? vI4.w : (dur > 0.0 ? clamp(age / dur, 0.0, 1.0) : 1.0);
  float post = dur > 0.0 ? age - dur : -1.0;               // seconds since detonation
  float kill = uFxTime - vI3.w;                            // seconds since cancel
  float fade = 1.0;
  if (post > 0.0) fade *= 1.0 - smoothstep(0.08, 0.34, post);
  if (kill > 0.0) fade *= 1.0 - smoothstep(0.0, 0.22, kill);
  fade *= appear * vI5.w;
  if (fade <= 0.001) discard;
  bool pulse = (flags & 2) != 0;
  bool noFill = (flags & 4) != 0;
  vec3 fc = vI3.rgb, rc = vI4.rgb;
  float lr = max(max(rc.r, rc.g), rc.b);
  vec3 rimC = rc / max(lr, 1e-3) * 1.4;                    // rim colour at a moderate HDR level (subtle bloom only)
  // rim + glows
  float rw = max(0.055 + R * 0.0025, aa * 1.5);
  float rim = inside * (1.0 - smoothstep(rw - aa, rw + aa, -d));
  float inner = inside * exp(-max(-d, 0.0) / 0.28);       // soft light band just inside the rim
  float outer = (1.0 - inside) * exp(-max(d, 0.0) / 0.1); // thin outer halo
  float edgeGrad = inside * exp(-max(-d, 0.0) / (0.5 + L * 0.08));
  // fill region (grows from the origin / centre to the edge)
  float pp = max(fwidth(prog), 1e-4);
  float filled = noFill ? 0.0 : inside * (1.0 - smoothstep(fill - pp, fill + pp, prog));
  float fr = (prog - fill) * L;
  float front = noFill ? 0.0 : inside * exp(-fr * fr / 0.006) * step(0.004, fill) * step(fill, 0.996);
  float t = uFxTime + vI5.z * 10.0;
  float pat;
  if (shape == 2 || shape == 1) pat = smoothstep(0.62, 0.8, fract((prog * L - abs(shape == 2 ? p.x : r * sin(atan(p.x, p.y))) * 0.55) * 0.42 - t * 0.9)) * 0.05;
  else pat = smoothstep(0.7, 0.9, fract(prog * L * 0.5 - t * 0.7)) * 0.035;
  float breathe = pulse ? 0.65 + 0.35 * sin(t * 5.0) : 1.0;
  // dark translucent zone (darkens + tints the ground); the growing fill is denser and brighter
  float a = inside * (0.28 + 0.1 * edgeGrad + pat * (1.0 - filled)) + filled * 0.2;
  vec3 body = fc * inside * (0.09 + 0.1 * edgeGrad) + fc * filled * (0.2 + 0.22 * prog);
  if (pulse) { a = inside * (0.14 + 0.12 * edgeGrad); body = fc * inside * (0.06 + 0.1 * edgeGrad) * breathe; }
  // additive light: crisp rim, inner band, thin halo, fill front
  vec3 add = rimC * (rim * breathe + inner * 0.14 + outer * 0.2) + fc * front * 1.1;
  // detonation flash
  if (post > 0.0 && (flags & 1) != 0) {
    float fl = exp(-post * 12.0);
    add += (fc * 1.3 + vec3(0.2)) * inside * fl + rimC * outer * fl;
    a += inside * fl * 0.15;
  }
  a = clamp(a, 0.0, 0.92) * fade;
  vec3 rgb = (body + add) * fade;
  vec3 f0 = applyFog(vec3(0.0), vW), f1 = applyFog(vec3(1.0), vW);
  float fog = clamp(1.0 - (f1.r - f0.r), 0.0, 1.0);
  rgb *= 1.0 - fog * 0.7;
  rgb = mix(rgb, vec3(dot(rgb, vec3(0.3, 0.5, 0.2))), uDesat * 0.5);
  gl_FragColor = vec4(rgb, a);
}`;

// ------------------------------------------------------------------ decal shader
const DECAL_VERT = /* glsl */`
attribute vec4 i0; attribute vec4 i1; attribute vec4 i2; attribute vec4 i3;
varying vec2 vL; varying vec3 vW; varying vec4 vI0; varying vec4 vI1; varying vec4 vI2; varying vec4 vI3;
${GLSL_GROUND}
void main() {
  vI0 = i0; vI1 = i1; vI2 = i2; vI3 = i3;
  float R = i1.x, Ln = i1.y;
  vec2 mn = Ln > 0.0 ? vec2(-R, -R * 0.5) : vec2(-R), mx = Ln > 0.0 ? vec2(R, Ln + R * 0.5) : vec2(R);
  vec2 l = mix(mn, mx, position.xy);
  float c = cos(i1.z), s = sin(i1.z);
  vec2 f = vec2(-s, -c), r = vec2(-f.y, f.x);   // yaw → forward (−sin, −cos)
  vec2 xz = i0.xz + r * l.x + f * l.y;
  float y = groundH(xz, i0.y) + 0.022 + fract(i3.y * 3.7) * 0.012;
  vL = l; vW = vec3(xz.x, y, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;

const DECAL_FRAG = /* glsl */`
uniform float uFxTime; uniform float uDesat; uniform sampler2D uDecal; uniform vec3 uLight;
varying vec2 vL; varying vec3 vW; varying vec4 vI0; varying vec4 vI1; varying vec4 vI2; varying vec4 vI3;
${FOG_GLSL_PARS}
${GLSL_NOISE}
float cellTex(float cell, vec2 uv) {  // uv in [-1,1] → decal atlas cell
  if (abs(uv.x) > 1.0 || abs(uv.y) > 1.0) return 0.0;
  vec2 c = vec2(mod(cell, ${DGRID}.0), floor(cell / ${DGRID}.0));
  return texture2D(uDecal, (c + 0.5 + uv * 0.497) / ${DGRID}.0).r;
}
vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
vec2 vor(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h21(i + g + seed), h21(i + g + 19.7 + seed));
    vec2 rr = g + o - f; float d = dot(rr, rr);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(sqrt(f1), sqrt(f2) - sqrt(f1));
}
void main() {
  float age = uFxTime - vI0.w;
  if (age < 0.0) discard;
  float R = vI1.x, Ln = vI1.y, dur = vI1.w;
  int kind = int(vI2.w + 0.5);
  vec3 C = vI2.rgb;
  float fadeIn = max(vI3.x, 0.01), seed = vI3.y, inten = vI3.z, hot = vI3.w;
  float life = dur > 0.0 ? age / dur : 0.0;
  float fade = smoothstep(0.0, fadeIn, age) * (dur > 0.0 ? 1.0 - smoothstep(0.65, 1.0, life) : 1.0) * inten;
  if (fade <= 0.001) discard;
  float heat = hot > 0.0 ? exp(-age / hot) : 0.0;          // 1 → 0 as lines cool
  vec2 p = vL / R;                                        // radial decals: [-1,1]
  float r = length(p);
  float t = uFxTime;
  float a = 0.0; vec3 dark = vec3(0.0); vec3 add = vec3(0.0);
  float nz = fbm2(vL * 1.3 + seed * 7.0);
  if (kind == 0 || kind == 2) {            // scorch / crater
    float m = cellTex(${D.scorch}.0, rot2(p, seed * 6.0));
    float blot = smoothstep(0.1, 0.7, m * (0.75 + 0.5 * nz));
    a = blot * 0.82;
    dark = vec3(0.035, 0.025, 0.02) * a;
    float emb = smoothstep(0.62, 0.78, fbm2(vL * 4.0 + seed)) * blot;
    add = vec3(3.0, 0.9, 0.2) * emb * heat * 1.1 + C * blot * heat * 0.06;
    if (kind == 2) {
      float cr = cellTex(${D.crack}.0, rot2(p * 0.95, seed * 3.0));
      float rim = cellTex(${D.ring}.0, rot2(p * 1.05, seed));
      a = max(a, cr * 0.9);
      a = max(a, rim * 0.55 * smoothstep(1.0, 0.6, r));
      dark = mix(dark, vec3(0.02, 0.015, 0.012) * a, cr);
      add += C * cr * (0.3 + heat * 2.2) * smoothstep(1.0, 0.3, r) + vec3(2.2, 0.6, 0.1) * cr * heat * 1.2;
    }
  } else if (kind == 1) {                  // radial crack
    float cr = cellTex(${D.crack}.0, rot2(p, seed * 6.0));
    float hole = smoothstep(0.35, 0.0, r) * (0.6 + 0.4 * nz);
    a = max(cr * 0.9, hole * 0.6);
    dark = vec3(0.025, 0.02, 0.018) * a;
    add = C * cr * (heat * 3.0 + 0.15) * smoothstep(1.0, 0.2, r) + C * hole * heat * 1.2;
  } else if (kind == 3 || kind == 21) {    // frost / frozen floor
    float fr = cellTex(${D.frost}.0, rot2(p, seed * 6.0));
    float body = smoothstep(1.0, 0.55, r + (nz - 0.5) * 0.35);
    float sheet = kind == 21 ? body * 0.55 : body * 0.28;
    a = max(sheet, fr * 0.7 * body);
    dark = mix(vec3(0.55, 0.75, 0.95), vec3(0.9, 0.97, 1.0), fr) * uLight * a;
    float tw = step(0.985, h21(floor(vL * 7.0) + floor(t * 3.0 + h21(floor(vL * 7.0)) * 3.0)));
    add = (vec3(0.3, 0.7, 1.4) * fr * 0.6 + vec3(2.5, 3.0, 3.5) * tw * body) * 0.8;
    if (kind == 21) { vec2 v = vor(vL * 0.9, seed); add += vec3(0.4, 0.8, 1.4) * (1.0 - smoothstep(0.0, 0.05, v.y)) * body * 0.6; }
  } else if (kind == 4 || kind == 5 || kind == 6 || kind == 14 || kind == 15 || kind == 19) {  // rune circles
    float cell = kind == 4 ? ${D.holy}.0 : kind == 5 ? ${D.arcane}.0 : kind == 6 ? ${D.demon}.0 : kind == 14 ? ${D.music}.0 : kind == 15 ? ${D.leaves}.0 : ${D.sigil}.0;
    float spd = kind == 6 ? -0.35 : kind == 19 ? 0.8 : 0.22;
    float m = cellTex(cell, rot2(p, t * spd + seed));
    float inner = cellTex(cell, rot2(p * 1.35, -t * spd * 1.6 + seed)) * step(r, 0.55);
    float glow = smoothstep(1.0, 0.0, r);
    float pulse = 0.82 + 0.18 * sin(t * 3.0 + seed);
    a = (m * 0.45 + glow * 0.1) * smoothstep(1.03, 0.97, r);
    dark = C * 0.18 * a;
    float big = 1.0 / (1.0 + R * 0.07);                  // large circles: thinner-looking, less bloom
    add = C * (m * 1.35 * pulse + inner * 0.6 + glow * 0.05 + heat * m * 1.6) * smoothstep(1.04, 0.96, r) * big;
  } else if (kind == 7) {                  // blood splatter
    float m = cellTex(${D.splat}.0, rot2(p, seed * 6.0));
    a = smoothstep(0.2, 0.6, m) * 0.85;
    dark = vec3(0.16, 0.01, 0.012) * a + vec3(0.1, 0.0, 0.0) * a * nz;
    add = vec3(0.25, 0.02, 0.02) * a * pow(max(nz, 0.0), 3.0);
  } else if (kind == 8) {                  // fissure: glowing split along the length
    float along = clamp(vL.y / max(Ln, 0.01), 0.0, 1.0);
    float wob = (fbm2(vec2(vL.y * 0.35, seed)) - 0.5) * R * 0.9 + (vn2(vec2(vL.y * 2.2, seed + 3.0)) - 0.5) * R * 0.25;
    float wdt = R * (0.14 + 0.1 * vn2(vec2(vL.y * 0.8, seed + 1.0))) * smoothstep(0.0, 0.06, along) * smoothstep(1.0, 0.94, along);
    float dx = abs(vL.x - wob);
    float core = 1.0 - smoothstep(wdt * 0.25, wdt, dx);
    float edge = exp(-dx * dx / (wdt * wdt * 6.0 + 1e-3));
    vec2 v = vor(vL * 1.1 + seed, seed);
    float side = (1.0 - smoothstep(0.0, 0.08, v.y)) * exp(-dx / (R * 0.8)) * step(0.0, vL.y) * step(vL.y, Ln);
    a = max(core * 0.95, edge * 0.45) + side * 0.6;
    a *= smoothstep(-R * 0.4, 0.0, vL.y) * smoothstep(Ln + R * 0.4, Ln, vL.y);
    dark = vec3(0.02, 0.012, 0.01) * a;
    float lava = core * (0.6 + 0.4 * sin(t * 4.0 + vL.y * 0.8));
    add = C * (lava * (0.7 + heat * 1.5) + edge * 0.3 * (0.3 + heat) + side * heat * 0.9);
  } else if (kind == 9 || kind == 10 || kind == 11 || kind == 18) {  // pools: lava / poison / void / water
    float warp = fbm2(vL * 0.45 + nz * 1.4 + t * 0.07);
    float mask = smoothstep(1.0, 0.82, r + (warp - 0.5) * 0.35);
    if (kind == 9) {
      vec2 v = vor(vL * 0.85 + warp * 1.3, seed);
      float crack = 1.0 - smoothstep(0.0, 0.14, v.y);
      float heatN = fbm2(vL * 1.2 - vec2(t * 0.35, t * 0.2));
      float h = crack * 0.9 + smoothstep(0.58, 0.88, heatN) * 0.55 + (1.0 - r) * 0.12;
      vec3 lava = mix(vec3(1.4, 0.28, 0.04), vec3(4.2, 1.7, 0.35), smoothstep(0.45, 0.85, heatN + crack * 0.3));
      a = mask * 0.92; dark = vec3(0.045, 0.016, 0.01) * a;
      add = lava * clamp(h, 0.0, 1.3) * mask * (0.8 + 0.2 * sin(t * 6.0 + heatN * 14.0)) + vec3(2.2, 0.6, 0.1) * exp(-sq((r - 0.86) / 0.1)) * 0.5;
    } else if (kind == 10) {
      float goo = fbm2(vL * 1.6 + vec2(sin(t * 0.3), t * 0.2));
      vec2 v = vor(vL * 1.6 + vec2(0.0, t * 0.1), seed);
      float bub = fract(t * 0.7 + h21(floor(vL * 1.6 + vec2(0.0, t * 0.1))));
      float ring = exp(-sq((v.x - bub * 0.45) / 0.035)) * (1.0 - bub);
      a = mask * 0.85; dark = mix(vec3(0.05, 0.16, 0.02), vec3(0.18, 0.45, 0.05), goo) * uLight * a;
      add = C * (smoothstep(0.62, 0.8, goo) * 0.6 + ring * 1.1) * mask;
    } else if (kind == 11) {
      float ang = atan(p.y, p.x);
      float sw = ang * 3.0 + log(max(r, 0.03)) * 4.0 + t * 1.6;
      float arms = pow(max(0.5 + 0.5 * sin(sw + fbm2(vL * 1.2) * 3.0), 0.0), 3.0);
      a = mask * mix(0.95, 0.75, r); dark = vec3(0.02, 0.0, 0.04) * a;
      add = C * arms * mask * (0.35 + r * 0.9) + C * 1.6 * exp(-sq((r - 0.93) / 0.06)) * mask;
    } else {
      float rip = sin(r * 30.0 - t * 4.0) * 0.5 + 0.5;
      a = mask * 0.45; dark = vec3(0.06, 0.09, 0.12) * uLight * a;
      add = vec3(0.25, 0.4, 0.55) * pow(max(rip, 0.0), 8.0) * mask * 0.35 * (1.0 - r);
    }
  } else if (kind == 12) {                 // electric scorch (flickering branches)
    float m = cellTex(${D.bolt}.0, rot2(p, seed * 6.0));
    float fl = 0.5 + 0.5 * step(0.4, h11(floor(t * 20.0) + seed));
    a = m * 0.7 * smoothstep(1.0, 0.5, r); dark = vec3(0.03, 0.03, 0.04) * a;
    add = C * m * (heat * 4.0 * fl + 0.12);
  } else if (kind == 13) {                 // claw marks
    float m = cellTex(${D.claw}.0, rot2(p, seed));
    a = m * 0.85; dark = vec3(0.03, 0.01, 0.02) * a;
    add = C * m * (0.3 + heat * 3.5);
  } else if (kind == 16) {                 // sunburst
    float m = cellTex(${D.sun}.0, rot2(p, seed + t * 0.1));
    a = m * 0.35; dark = C * 0.3 * a;
    add = C * (m * (0.45 + heat * 2.2) + smoothstep(1.0, 0.0, r) * heat * 0.4);
  } else if (kind == 17) {                 // quake: cracked earth cells
    float m = cellTex(${D.cells}.0, rot2(p * 0.9, seed * 6.0));
    float body = smoothstep(1.0, 0.6, r + (nz - 0.5) * 0.3);
    a = (m * 0.85 + body * 0.18) * body; dark = vec3(0.05, 0.04, 0.035) * a;
    add = C * m * body * (heat * 2.5 + 0.05);
  } else if (kind == 20) {                 // void swirl mask (portals / black holes)
    float m = cellTex(${D.swirl}.0, rot2(p, -t * 1.2 + seed));
    float core = smoothstep(0.45, 0.0, r);
    a = (m * 0.6 + core * 0.8) * smoothstep(1.02, 0.9, r); dark = vec3(0.02, 0.0, 0.04) * a;
    add = C * m * 1.4 * smoothstep(1.0, 0.3, r);
  }
  a = clamp(a * fade, 0.0, 1.0);
  vec3 rgb = dark * fade + add * fade;
  vec3 f0 = applyFog(vec3(0.0), vW), f1 = applyFog(vec3(1.0), vW);
  float fog = clamp(1.0 - (f1.r - f0.r), 0.0, 1.0);
  rgb = mix(rgb, f0 * a, fog);
  rgb = mix(rgb, vec3(dot(rgb, vec3(0.3, 0.5, 0.2))) * vec3(0.85, 0.95, 1.1), uDesat);
  gl_FragColor = vec4(rgb, a);
}`;

export const DECAL = {
  scorch: 0, crack: 1, crater: 2, frost: 3, holy: 4, rune: 5, arcane: 5, demon: 6, blood: 7, fissure: 8, lava: 9, fire: 9,
  poison: 10, void: 11, electric: 12, lightning: 12, claw: 13, music: 14, nature: 15, heal: 15, sun: 16, quake: 17, water: 18,
  sigil: 19, swirl: 20, ice: 21,
};
// default look per kind: colour (linear HDR), duration, fade-in, heat (glow cooling time)
export const DECAL_DEF = {
  scorch: { c: [1, 0.4, 0.1], dur: 7, fin: 0.1, hot: 0.8 }, crack: { c: [1.6, 0.5, 0.12], dur: 6, fin: 0.05, hot: 1.2 },
  crater: { c: [1.6, 0.45, 0.1], dur: 9, fin: 0.05, hot: 1.6 }, frost: { c: [0.5, 0.8, 1], dur: 6, fin: 0.3, hot: 0 },
  holy: { c: [1.4, 1.05, 0.45], dur: 3, fin: 0.25, hot: 0.4 }, rune: { c: [0.9, 0.45, 1.6], dur: 3, fin: 0.25, hot: 0.4 },
  arcane: { c: [0.9, 0.45, 1.6], dur: 3, fin: 0.25, hot: 0.4 }, demon: { c: [1.6, 0.15, 0.35], dur: 3, fin: 0.25, hot: 0.4 },
  blood: { c: [0.6, 0.02, 0.02], dur: 10, fin: 0.05, hot: 0 }, fissure: { c: [1.8, 0.35, 0.1], dur: 7, fin: 0.05, hot: 1.8 },
  lava: { c: [1.6, 0.5, 0.1], dur: 12, fin: 0.5, hot: 0 }, fire: { c: [1.6, 0.5, 0.1], dur: 8, fin: 0.4, hot: 0 },
  poison: { c: [0.6, 1.8, 0.2], dur: 10, fin: 0.4, hot: 0 }, void: { c: [0.8, 0.25, 1.6], dur: 8, fin: 0.3, hot: 0 },
  electric: { c: [0.6, 0.8, 2.2], dur: 3, fin: 0.03, hot: 0.6 }, lightning: { c: [0.6, 0.8, 2.2], dur: 3, fin: 0.03, hot: 0.6 },
  claw: { c: [1.5, 0.2, 0.3], dur: 4, fin: 0.03, hot: 0.6 }, music: { c: [1.4, 0.55, 1.2], dur: 3, fin: 0.25, hot: 0.3 },
  nature: { c: [0.5, 1.4, 0.55], dur: 3, fin: 0.3, hot: 0.3 }, heal: { c: [0.5, 1.4, 0.55], dur: 3, fin: 0.3, hot: 0.3 },
  sun: { c: [1.5, 1.1, 0.5], dur: 3, fin: 0.05, hot: 0.6 }, quake: { c: [1.4, 0.55, 0.15], dur: 7, fin: 0.05, hot: 1.0 },
  water: { c: [0.3, 0.5, 0.7], dur: 8, fin: 0.2, hot: 0 }, sigil: { c: [1.4, 0.3, 1.2], dur: 4, fin: 0.2, hot: 0.3 },
  swirl: { c: [0.7, 0.2, 1.4], dur: 4, fin: 0.3, hot: 0 }, ice: { c: [0.5, 0.8, 1.2], dur: 10, fin: 0.4, hot: 0 },
};

class Layer {
  constructor(fx, n, stride, vert, frag, uniforms, renderOrder, offset, name) {
    this.fx = fx; this.n = n; this.stride = stride;
    this.data = new Float32Array(n * stride);
    for (let i = 0; i < n; i++) { this.data[i * stride + 3] = 1e9; }   // t0 far future = invisible
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, stride, 1);
    this.buf.setUsage(THREE.DynamicDrawUsage);
    const g = gridGeo(16);
    for (let k = 0; k < stride / 4; k++) g.setAttribute('i' + k, new THREE.InterleavedBufferAttribute(this.buf, 4, k * 4));
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms,
      ...PREMUL, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; this.mesh.name = name;
    this.free = new Int32Array(n); this.nFree = 0;
    for (let i = n - 1; i >= 0; i--) this.free[this.nFree++] = i;
    this.until = new Float64Array(n);   // auto-release time (Infinity = owned by a handle)
    this.used = new Uint8Array(n);
    this.hi = 0;                        // highest used slot + 1 (instanceCount)
    this.dirty = false; this.minD = n; this.maxD = -1;
  }
  alloc() {
    if (!this.nFree) { this.reclaim(this.fx.time, true); if (!this.nFree) return -1; }
    const s = this.free[--this.nFree];
    this.used[s] = 1; this.until[s] = Infinity;
    if (s + 1 > this.hi) { this.hi = s + 1; this.geo.instanceCount = this.hi; }
    return s;
  }
  release(s) {
    if (s < 0 || !this.used[s]) return;
    this.used[s] = 0; this.data[s * this.stride + 3] = 1e9; this.touch(s);
    this.free[this.nFree++] = s;
  }
  touch(s) { this.dirty = true; if (s < this.minD) this.minD = s; if (s > this.maxD) this.maxD = s; }
  // free slots whose auto-release time has passed (force: steal the oldest when the pool is exhausted)
  reclaim(now, force = false) {
    let oldest = -1, ot = Infinity;
    for (let i = 0; i < this.hi; i++) {
      if (!this.used[i]) continue;
      if (this.until[i] <= now) this.release(i);
      else if (force && this.until[i] < ot) { ot = this.until[i]; oldest = i; }
    }
    if (force && !this.nFree && oldest >= 0 && isFinite(ot)) this.release(oldest);
    // shrink the instance count past trailing free slots
    while (this.hi > 0 && !this.used[this.hi - 1]) this.hi--;
    this.geo.instanceCount = this.hi;
  }
  flush() {
    if (!this.dirty) return;
    queueRange(this.buf, this.minD * this.stride, (this.maxD - this.minD + 1) * this.stride);
    this.dirty = false; this.minD = this.n; this.maxD = -1;
  }
  reset() {
    for (let i = 0; i < this.n; i++) { this.used[i] = 0; this.data[i * this.stride + 3] = 1e9; }
    this.nFree = 0; for (let i = this.n - 1; i >= 0; i--) this.free[this.nFree++] = i;
    this.hi = 0; this.geo.instanceCount = 0;
    queueAll(this.buf);
  }
  count() { let c = 0; for (let i = 0; i < this.hi; i++) c += this.used[i]; return c; }
}

export class Ground {
  constructor(fx, { tele = 160, decals = 320 } = {}) {
    this.fx = fx;
    const u = fx.u;
    const common = {
      uFxTime: u.uFxTime, uHeightTex: u.uHeightTex, uHeightInfo: u.uHeightInfo, uHasHeight: u.uHasHeight, uGroundY: u.uGroundY,
      uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight, uFogBase: G.uFogBase,
      uSunDir: G.uSunDir, uCamPos: G.uCamPos, uDesat: G.uDesat,
    };
    this.tele = new Layer(fx, tele, TSTRIDE, TELE_VERT, TELE_FRAG, { ...common }, 3, 3, 'fx-telegraphs');
    this.decal = new Layer(fx, decals, DSTRIDE, DECAL_VERT, DECAL_FRAG, { ...common, uDecal: { value: fx.tex.decals }, uLight: u.uLight }, 2, 2, 'fx-decals');
    this._rt = 0;
  }
  get meshes() { return [this.decal.mesh, this.tele.mesh]; }

  /**
   * Write a telegraph instance. o: { x, y, z, dx, dz, shape, R, W, halfA, n, phase, fill:[r,g,b], rim:[r,g,b],
   * t0, dur, flags, seed, inten }  → slot (or -1)
   */
  teleWrite(s, o) {
    const L = this.tele, d = L.data, b = s * TSTRIDE;
    d[b] = o.x; d[b + 1] = o.y; d[b + 2] = o.z; d[b + 3] = o.t0;
    d[b + 4] = o.dx; d[b + 5] = o.dz; d[b + 6] = o.shape; d[b + 7] = o.dur;
    d[b + 8] = o.R; d[b + 9] = o.W; d[b + 10] = o.halfA; d[b + 11] = o.n;
    d[b + 12] = o.fill[0]; d[b + 13] = o.fill[1]; d[b + 14] = o.fill[2]; d[b + 15] = 1e9;
    d[b + 16] = o.rim[0]; d[b + 17] = o.rim[1]; d[b + 18] = o.rim[2]; d[b + 19] = -1;
    d[b + 20] = o.phase; d[b + 21] = o.flags; d[b + 22] = o.seed; d[b + 23] = o.inten;
    L.touch(s);
  }
  teleSet(s, idx, v) { if (s < 0) return; this.tele.data[s * TSTRIDE + idx] = v; this.tele.touch(s); }
  teleGet(s, idx) { return this.tele.data[s * TSTRIDE + idx]; }

  /** Write a decal. o: { x, y, z, R, len, yaw, dur, c:[r,g,b], kind, fin, seed, inten, hot, t0 } */
  decalWrite(s, o) {
    const L = this.decal, d = L.data, b = s * DSTRIDE;
    d[b] = o.x; d[b + 1] = o.y; d[b + 2] = o.z; d[b + 3] = o.t0;
    d[b + 4] = o.R; d[b + 5] = o.len; d[b + 6] = o.yaw; d[b + 7] = o.dur;
    d[b + 8] = o.c[0]; d[b + 9] = o.c[1]; d[b + 10] = o.c[2]; d[b + 11] = o.kind;
    d[b + 12] = o.fin; d[b + 13] = o.seed; d[b + 14] = o.inten; d[b + 15] = o.hot;
    L.touch(s);
  }
  update(dt) {
    this._rt -= dt;
    if (this._rt <= 0) { this._rt = 0.25; this.tele.reclaim(this.fx.time); this.decal.reclaim(this.fx.time); }
    this.tele.flush(); this.decal.flush();
    this.tele.mesh.visible = this.tele.hi > 0; this.decal.mesh.visible = this.decal.hi > 0;
  }
  reset() { this.tele.reset(); this.decal.reset(); }
  dispose() { for (const L of [this.tele, this.decal]) { L.geo.dispose(); L.mat.dispose(); } }
}
