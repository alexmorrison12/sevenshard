// Procedural texture library (GLSL recipes baked on the GPU by bake.js), cached for the whole session.
//   groundLayers()      → { albedo, normal: DataArrayTexture, index: { grass: 0, … }, names }
//   kitTex(name)        → { map, normalMap }  architecture surfaces (UVs in metres / tile, see kit.js)
//   decalAtlas()        → { map, normal, slots }  4×4 atlas of ground decals (rgba + packed normal/emissive)
//   foliageAtlas()      → { map }  2×2 atlas: leaf cluster, blossom cluster, needle spray, grass card
//   noiseTex()          → periodic RGBA noise (macro variation, water, fog)
import * as THREE from 'three';
import { bakeSet, precompile } from './bake.js';

// ------------------------------------------------------------------ ground layers
// Every layer: albedo (display rgb) + height (alpha) and packed normal + cavity AO + emissive.
// World tiling (metres per texture repeat) lives in LAYER_TILE (the ground shader reads it).
export const LAYERS = {
  grass: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n1 = fbm(uv, 3, 4, 11), n2 = fbm(uv, 9, 3, 12);
  vec3 deep = vec3(0.10, 0.21, 0.05), dark = vec3(0.17, 0.32, 0.07), mid = vec3(0.30, 0.50, 0.12), lite = vec3(0.50, 0.68, 0.20), gold = vec3(0.64, 0.66, 0.24);
  vec3 col = mix(deep, dark, sat(0.55 + n1 * 0.9));
  col = mix(col, mid * 0.8, sat(n2) * 0.4);
  float hgt = 0.18 + n2 * 0.06;
  for (int L = 0; L < 4; L++) {
    int F = 26 + L * 12;
    vec2 p = uv * float(F);
    ivec2 ip = ivec2(floor(p));
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 g = ip + ivec2(i, j);
      ivec2 c = wrapc(g, ivec2(F));
      vec4 r = h4(c, 100 + L * 7);
      vec2 o = vec2(g) + r.xy;
      float ang = r.z * TAU;
      float len = 0.7 + r.w * 0.9;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 q = p - o;
      float along = dot(q, dir);
      float t = clamp(along / len, 0.0, 1.0);
      float d = length(q - dir * t * len);
      float w = mix(0.2, 0.03, t);
      // soft cast shadow of the blade (offset down-right)
      vec2 qs = q - vec2(0.12, -0.12);
      float ts = clamp(dot(qs, dir) / len, 0.0, 1.0);
      float sh = smoothstep(w * 2.2, 0.0, length(qs - dir * ts * len)) * step(-0.1, dot(qs, dir));
      col *= 1.0 - sh * 0.18;
      float m = smoothstep(w, w * 0.35, d) * step(-0.05, along);
      if (m > 0.0) {
        float tone = t * 0.75 + r.x * 0.35 + float(L) * 0.08;
        vec3 bc = mix(dark * 1.2, mix(mid, lite, sat(tone - 0.35)), sat(tone));
        bc *= 0.86 + r.y * 0.28;
        bc = mix(bc, gold, step(0.92, h1(c, 300 + L)) * 0.55);
        col = mix(col, bc, m);
        hgt = max(hgt, 0.35 + t * 0.45 + float(L) * 0.04);
      }
    }
  }
  // clover specks
  ivec2 cc; vec2 ctr; vec4 v = pvoro(uv * 40.0, ivec2(40), 17, 0.9, cc, ctr);
  float cl = smoothstep(0.16, 0.1, v.x) * step(h1(cc, 18), 0.07);
  col = mix(col, vec3(0.42, 0.62, 0.18), cl);
  s.col = col; s.h = hgt;
  return s;
}`,
  dirt: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 21), n2 = fbm(uv, 16, 3, 22), n3 = fbm(uv, 2, 3, 26);
  vec3 a = vec3(0.40, 0.29, 0.18), b = vec3(0.54, 0.41, 0.27), c = vec3(0.30, 0.22, 0.14);
  vec3 col = mix(a, b, sat(0.5 + n * 1.2));
  col = mix(col, c, sat(-n2 * 1.8) * 0.5);
  col = mix(col, col * vec3(1.08, 1.02, 0.9), sat(n3));
  float h = 0.32 + n * 0.14 + n2 * 0.05;
  // ruts / scuffs
  float sc = ridged(uv * vec2(1.0, 1.0), 6, 3, 27);
  col *= 1.0 - smoothstep(0.75, 0.95, sc) * 0.15;
  // pebbles in two sizes
  for (int L = 0; L < 2; L++) {
    int F = L == 0 ? 22 : 48;
    ivec2 cell; vec2 ctr;
    vec4 v = pvoro(uv * float(F), ivec2(F), 23 + L, 0.9, cell, ctr);
    vec4 r = h4(cell, 24 + L);
    float size = (L == 0 ? 0.2 : 0.28) + r.x * 0.2;
    float keep = step(r.y, L == 0 ? 0.35 : 0.3);
    float peb = smoothstep(size, size - 0.07, v.x) * keep;
    vec3 pc = mix(vec3(0.52, 0.49, 0.44), vec3(0.72, 0.66, 0.56), r.z) * (0.78 + r.w * 0.4);
    pc *= 0.85 + 0.3 * sat(1.0 - v.x / size);
    // pebble shadow
    col *= 1.0 - smoothstep(size + 0.12, size - 0.02, length(ctr - uv * float(F) + vec2(0.08, -0.08)) ) * keep * 0.25 * (1.0 - peb);
    col = mix(col, pc, peb);
    h = max(h, peb * (0.5 + 0.35 * smoothstep(size, 0.0, v.x)));
  }
  float g = h1(wrapc(ivec2(floor(uv * 512.0)), ivec2(512)), 25);
  col *= 0.93 + g * 0.14;
  s.col = col; s.h = h;
  return s;
}`,
  cobble: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 w = vec2(fbm(uv, 3, 2, 31), fbm(uv, 3, 2, 32)) * 0.3;
  ivec2 cell; vec2 ctr;
  vec2 p = uv * 13.0 + w;
  vec4 v = pvoro(p, ivec2(13), 33, 0.55, cell, ctr);
  vec4 r = h4(cell, 34);
  // rounded setts: blend polygon border distance with radial distance
  float edge = v.z * 0.65 + (0.52 - v.x) * 0.35 + fbm(uv, 52, 2, 37) * 0.02;
  float stone = smoothstep(0.035, 0.075, edge);
  float dome = sqrt(sat(edge / 0.36));
  vec3 c1 = vec3(0.62, 0.59, 0.54), c2 = vec3(0.58, 0.57, 0.56), c3 = vec3(0.66, 0.61, 0.53), c4 = vec3(0.55, 0.52, 0.48), c5 = vec3(0.63, 0.58, 0.52);
  vec3 sc = r.x < 0.28 ? c1 : r.x < 0.5 ? c2 : r.x < 0.72 ? c3 : r.x < 0.86 ? c5 : c4;
  sc *= 0.94 + r.y * 0.12;
  float m = fbm(uv, 26, 3, 35);
  sc *= 0.93 + m * 0.12;
  sc = mix(sc, sc * 1.12, smoothstep(0.1, 0.3, edge) * 0.5);
  float speck = step(0.94, h1(wrapc(ivec2(floor(uv * 400.0)), ivec2(400)), 38));
  sc *= 1.0 - speck * 0.1;
  float mossy = smoothstep(0.1, 0.5, fbm(uv, 2, 3, 36));
  vec3 grout = mix(vec3(0.44, 0.40, 0.34), vec3(0.34, 0.38, 0.22), mossy * 0.7);
  vec3 col = mix(grout, sc, stone);
  col *= mix(0.88, 1.0, smoothstep(0.03, 0.12, edge));
  s.col = col;
  s.h = stone * (0.4 + 0.5 * dome) * (0.88 + r.z * 0.12) + (1.0 - stone) * 0.1;
  s.ao = mix(0.75, 1.0, smoothstep(0.02, 0.12, edge));
  return s;
}`,
  flagstone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const int ROWS = 5, COLS = 5;
  float y = uv.y * float(ROWS);
  int row = int(floor(y));
  int rw = int(mod(float(row), float(ROWS)));
  float off = h1(ivec2(rw, 3), 41);
  float x = uv.x * float(COLS) + off * float(COLS);
  int ci = int(floor(x));
  int left = ci;
  for (int k = 0; k < 3; k++) { if (h1(wrapc(ivec2(left, rw), ivec2(COLS, ROWS)), 42) < 0.62) break; left--; }
  int right = ci + 1;
  for (int k = 0; k < 3; k++) { if (h1(wrapc(ivec2(right, rw), ivec2(COLS, ROWS)), 42) < 0.62) break; right++; }
  ivec2 id = wrapc(ivec2(left, rw), ivec2(COLS, ROWS));
  vec4 r = h4(id, 43);
  float ex = min(x - float(left), float(right) - x) / float(COLS);
  float ey = min(y - float(row), float(row + 1) - y) / float(ROWS);
  float e = min(ex, ey);
  e += fbm(uv, 32, 3, 44) * 0.004 + fbm(uv, 90, 2, 45) * 0.0015;
  float slab = smoothstep(0.002, 0.011, e);
  vec3 p1 = vec3(0.76, 0.72, 0.64), p2 = vec3(0.71, 0.69, 0.65), p3 = vec3(0.77, 0.70, 0.61), p4 = vec3(0.68, 0.66, 0.61);
  vec3 sc = r.x < 0.35 ? p1 : r.x < 0.6 ? p2 : r.x < 0.82 ? p3 : p4;
  sc *= 0.93 + r.y * 0.1;
  vec2 lp = vec2(x / float(COLS), y / float(ROWS));
  float m = fbm(uv + r.zw, 12, 4, 46);
  sc *= 0.93 + m * 0.12;
  // worn centre, darker rim grime
  sc = mix(sc * 0.84, sc, smoothstep(0.004, 0.05, e));
  // veins / cracks (only some slabs)
  float cr = ridged(uv + r.xy * 3.0, 5, 4, 47);
  float crack = smoothstep(0.92, 0.985, cr) * step(0.55, r.w);
  sc *= 1.0 - crack * 0.45;
  // lichen blotches
  ivec2 lc; vec2 lct; vec4 lv = pvoro(uv * 30.0, ivec2(30), 48, 0.9, lc, lct);
  float lich = smoothstep(0.3, 0.18, lv.x + fbm(uv, 60, 2, 49) * 0.1) * step(h1(lc, 50), 0.12);
  sc = mix(sc, mix(vec3(0.72, 0.66, 0.40), vec3(0.58, 0.62, 0.42), h1(lc, 51)), lich * 0.6);
  vec3 grout = vec3(0.42, 0.39, 0.34);
  vec3 col = mix(grout, sc, slab);
  s.col = col;
  s.h = slab * (0.62 + m * 0.06 - crack * 0.15) * mix(0.8, 1.0, smoothstep(0.0, 0.02, e)) + (1.0 - slab) * 0.12;
  s.ao = mix(0.6, 1.0, smoothstep(0.0, 0.015, e));
  return s;
}`,
  fan: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const float N = 4.0;
  vec2 p = uv * N;                          // fan radius 1 (cell width), rows every 0.5
  float bestY = -99.0; vec2 bc = vec2(0.0); vec2 bid = vec2(0.0);
  float r0 = floor(p.y / 0.5);
  for (int k = 0; k < 3; k++) {
    float row = r0 - float(k);
    float cy = row * 0.5;
    float off = mod(row, 2.0) * 0.5;
    float ci = floor(p.x - off + 0.5);
    for (int m = -1; m <= 1; m++) {
      float cx = ci + float(m) + off;
      vec2 d = p - vec2(cx, cy);
      if (d.y >= 0.0 && dot(d, d) < 1.0 && cy > bestY) { bestY = cy; bc = vec2(cx, cy); bid = vec2(mod(ci + float(m), N), mod(row, 2.0 * N)); }
    }
  }
  vec2 d = p - bc;
  float dist = length(d), ang = atan(d.y, d.x);
  const float RW = 0.145;
  float ring = floor(dist / RW);
  float fr = fract(dist / RW);
  float nk = max(2.0, floor(PI * (ring + 0.5) * RW / 0.15 + 0.5));
  float fa = ang / PI * nk;
  float ai = floor(fa); float fa2 = fract(fa);
  float e = min(min(fr, 1.0 - fr) * RW, min(fa2, 1.0 - fa2) * PI / nk * max(dist, 0.05));
  e += fbm(uv, 40, 2, 501) * 0.006;
  // the fan's outer arc (top-most row paints over) gets a darker kerb line
  float rim = smoothstep(0.02, 0.0, 1.0 - dist);
  vec4 r = h4(ivec2(int(bid.x * 64.0 + ring), int(bid.y * 64.0 + ai)), 502);
  float stone = smoothstep(0.004, 0.018, e);
  float dome = sqrt(sat(e / 0.06));
  vec3 c1 = vec3(0.60, 0.58, 0.55), c2 = vec3(0.55, 0.55, 0.56), c3 = vec3(0.66, 0.60, 0.52), c4 = vec3(0.52, 0.49, 0.46);
  vec3 sc = r.x < 0.3 ? c1 : r.x < 0.55 ? c2 : r.x < 0.8 ? c3 : c4;
  sc *= 0.93 + r.y * 0.14;
  sc *= 0.95 + fbm(uv, 24, 3, 503) * 0.1;
  sc = mix(sc, sc * 1.1, smoothstep(0.02, 0.06, e) * 0.5);
  vec3 grout = vec3(0.42, 0.38, 0.33);
  vec3 col = mix(grout, sc, stone) * (1.0 - rim * 0.25);
  s.col = col;
  s.h = stone * (0.4 + 0.45 * dome) + (1.0 - stone) * 0.1;
  s.ao = mix(0.72, 1.0, smoothstep(0.0, 0.03, e));
  return s;
}`,
  sand: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 3, 4, 61), n2 = fbm(uv, 12, 3, 62);
  vec2 wp = uv + vec2(fbm(uv, 2, 3, 63), fbm(uv, 2, 3, 64)) * 0.08;
  float rip = sin((wp.x * 5.0 + wp.y * 18.0) * TAU + n * 3.0);
  vec3 col = mix(vec3(0.74, 0.64, 0.46), vec3(0.84, 0.76, 0.58), sat(0.5 + n));
  col *= 1.0 + rip * 0.035 + n2 * 0.04;
  float g = h1(wrapc(ivec2(floor(uv * 512.0)), ivec2(512)), 65);
  col *= 0.94 + g * 0.1;
  ivec2 cell; vec2 ctr; vec4 v = pvoro(uv * 30.0, ivec2(30), 66, 0.9, cell, ctr);
  vec4 r = h4(cell, 67);
  float peb = smoothstep(0.14, 0.08, v.x) * step(r.x, 0.12);
  col = mix(col, mix(vec3(0.95, 0.9, 0.84), vec3(0.62, 0.56, 0.48), r.y), peb);
  s.col = col; s.h = 0.4 + rip * 0.05 + n * 0.1 + peb * 0.2;
  return s;
}`,
  snow: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 2, 5, 71), n2 = fbm(uv, 8, 4, 72);
  float drift = sat(0.5 + n * 0.9);
  vec3 col = mix(vec3(0.78, 0.84, 0.94), vec3(0.97, 0.98, 1.0), drift);
  col = mix(col, vec3(0.72, 0.80, 0.93), sat(-n2) * 0.25);
  // wind-sculpted streaks
  float st = fbm(uv * vec2(1.0, 1.0) + vec2(0.0, n * 0.1), 24, 2, 73);
  col *= 1.0 + st * 0.02;
  float sp = step(0.985, h1(wrapc(ivec2(floor(uv * 512.0)), ivec2(512)), 74));
  col += sp * 0.25;
  s.col = col; s.h = 0.3 + n * 0.3 + n2 * 0.06;
  return s;
}`,
  obsidian: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 w = vec2(fbm(uv, 3, 3, 81), fbm(uv, 3, 3, 82)) * 0.5;
  ivec2 cell; vec2 ctr;
  vec4 v = pvoro(uv * 6.0 + w, ivec2(6), 83, 0.85, cell, ctr);
  vec4 r = h4(cell, 84);
  float e = v.z + fbm(uv, 40, 2, 85) * 0.03;
  float plate = smoothstep(0.02, 0.07, e);
  float n = fbm(uv, 16, 4, 86);
  vec3 base = mix(vec3(0.07, 0.06, 0.07), vec3(0.17, 0.15, 0.17), r.x);
  base *= 0.85 + n * 0.3;
  // glassy conchoidal ripples
  float rip = sin(length(ctr - (uv * 6.0 + w)) * 30.0 + r.y * 6.0) * 0.5 + 0.5;
  base += vec3(0.05, 0.04, 0.06) * rip * smoothstep(0.05, 0.3, e);
  // ash dust settled in the lows
  vec3 ash = vec3(0.30, 0.28, 0.27);
  float dust = smoothstep(0.1, -0.3, n) * 0.5;
  vec3 col = mix(base, ash, dust);
  // fissures (glowing): some borders are open
  float open = smoothstep(-0.1, 0.4, fbm(uv, 4, 3, 87));
  float fiss = smoothstep(0.03, 0.0, e) * open;
  col = mix(col * mix(0.5, 1.0, plate), vec3(0.9, 0.3, 0.08), fiss);
  s.col = col; s.emit = fiss;
  s.h = plate * (0.55 + n * 0.1) + (1.0 - plate) * 0.1;
  s.ao = mix(0.5, 1.0, plate);
  return s;
}`,
  ice: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 3, 4, 91), n2 = fbm(uv, 9, 3, 92);
  vec3 deep = vec3(0.16, 0.36, 0.52), mid = vec3(0.36, 0.62, 0.78), pale = vec3(0.72, 0.87, 0.95);
  vec3 col = mix(deep, mid, sat(0.55 + n));
  col = mix(col, pale, sat(n2 * 1.4) * 0.45);
  // crack network at two scales
  ivec2 c1; vec2 t1; vec4 v1 = pvoro(uv * 4.0 + vec2(n, n2) * 0.3, ivec2(4), 93, 0.9, c1, t1);
  ivec2 c2; vec2 t2; vec4 v2 = pvoro(uv * 11.0 + vec2(n2, n) * 0.2, ivec2(11), 94, 0.9, c2, t2);
  float cr1 = smoothstep(0.03, 0.0, v1.z);
  float cr2 = smoothstep(0.02, 0.0, v2.z) * step(0.5, h1(c2, 95));
  col = mix(col, vec3(0.92, 0.97, 1.0), max(cr1 * 0.9, cr2 * 0.55));
  // trapped bubbles
  ivec2 bc; vec2 bt; vec4 bv = pvoro(uv * 36.0, ivec2(36), 96, 0.9, bc, bt);
  float bub = smoothstep(0.1, 0.05, bv.x) * step(h1(bc, 97), 0.25);
  col = mix(col, vec3(0.85, 0.95, 1.0), bub * 0.5);
  // frost patches
  float fr = smoothstep(0.25, 0.6, fbm(uv, 5, 4, 98));
  col = mix(col, vec3(0.86, 0.92, 0.97), fr * 0.55);
  s.col = col; s.h = 0.5 - cr1 * 0.25 - cr2 * 0.1 + fr * 0.1 + n * 0.05;
  return s;
}`,
  rock: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 3, 5, 101);
  // strata bands along v
  float band = uv.y * 7.0 + n * 0.6;
  float bi = floor(band);
  float bf = fract(band);
  float bh = h1(wrapc(ivec2(int(bi), 0), ivec2(7)), 102);
  vec3 c = mix(vec3(0.47, 0.44, 0.41), vec3(0.60, 0.56, 0.50), bh);
  c = mix(c, vec3(0.53, 0.47, 0.40), step(0.8, h1(wrapc(ivec2(int(bi), 1), ivec2(7)), 103)) * 0.6);
  // fractured blocks within bands
  ivec2 cell; vec2 ctr; vec4 v = pvoro(vec2(uv.x * 9.0, band * 1.3), ivec2(9, 9), 104, 0.8, cell, ctr);
  float blk = smoothstep(0.0, 0.07, v.z);
  vec4 r = h4(cell, 105);
  c *= 0.84 + r.x * 0.28;
  float ledge = smoothstep(0.0, 0.1, bf) * smoothstep(1.0, 0.8, bf);
  c *= mix(0.62, 1.0, ledge);
  c *= mix(0.7, 1.0, blk);
  float n2 = fbm(uv, 20, 3, 106);
  c *= 0.9 + n2 * 0.15;
  // lichen / moss on tops of ledges
  float moss = smoothstep(0.85, 1.0, bf) * smoothstep(0.1, 0.5, fbm(uv, 4, 3, 107));
  c = mix(c, vec3(0.34, 0.42, 0.20), moss * 0.6);
  s.col = c;
  s.h = ledge * 0.5 + blk * 0.3 + n2 * 0.08 + r.y * 0.1;
  return s;
}`,
  marble: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  // 4×4 tiles, alternating warm-white / pale grey with thin dark joints
  vec2 p = uv * 4.0;
  ivec2 t = wrapc(ivec2(floor(p)), ivec2(4));
  vec2 f = fract(p);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float chk = mod(float(t.x + t.y), 2.0);
  vec4 r = h4(t, 111);
  vec3 a = vec3(0.86, 0.83, 0.77), b = vec3(0.72, 0.71, 0.70);
  vec3 col = mix(a, b, chk) * (0.95 + r.x * 0.08);
  // veins
  vec2 q = uv + vec2(fbm(uv, 3, 4, 112), fbm(uv, 3, 4, 113)) * 0.12;
  float vein = ridged(q + r.yz, 4, 5, 114);
  col = mix(col, col * vec3(0.62, 0.62, 0.66), smoothstep(0.78, 0.96, vein) * 0.8);
  col *= 0.97 + fbm(uv, 32, 2, 115) * 0.05;
  float joint = smoothstep(0.012, 0.03, e);
  col = mix(vec3(0.34, 0.31, 0.28), col, joint);
  s.col = col; s.h = joint * 0.6 + 0.1;
  s.ao = mix(0.7, 1.0, joint);
  return s;
}`,
  moss: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 121), n2 = fbm(uv, 14, 3, 122);
  vec3 col = mix(vec3(0.16, 0.24, 0.08), vec3(0.34, 0.44, 0.14), sat(0.5 + n));
  col = mix(col, vec3(0.30, 0.22, 0.12), sat(-n2 * 1.5) * 0.5);
  float h = 0.3 + n * 0.2;
  // leaf litter
  for (int L = 0; L < 2; L++) {
    int F = 18 + L * 10;
    vec2 p = uv * float(F); ivec2 ip = ivec2(floor(p));
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 g = ip + ivec2(i, j); ivec2 c = wrapc(g, ivec2(F));
      vec4 r = h4(c, 130 + L);
      if (r.w > 0.55) continue;
      vec2 q = rot(p - (vec2(g) + r.xy), r.z * TAU);
      float lf = length(q * vec2(1.0, 2.2));
      float m = smoothstep(0.42, 0.34, lf);
      vec3 lc = mix(vec3(0.56, 0.36, 0.12), vec3(0.64, 0.52, 0.18), r.x);
      lc = mix(lc, vec3(0.30, 0.40, 0.12), step(0.7, r.y));
      col *= 1.0 - smoothstep(0.55, 0.3, length((q + vec2(0.08, -0.08)) * vec2(1.0, 2.2))) * 0.2;
      col = mix(col, lc * (0.85 + r.y * 0.3), m);
      h = max(h, m * 0.55);
    }
  }
  s.col = col; s.h = h;
  return s;
}`,
  void: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 w = vec2(fbm(uv, 2, 3, 141), fbm(uv, 2, 3, 142)) * 0.35;
  ivec2 cell; vec2 ctr;
  vec4 v = pvoro(uv * 5.0 + w, ivec2(5), 143, 0.8, cell, ctr);
  vec4 r = h4(cell, 144);
  float e = v.z;
  float slab = smoothstep(0.015, 0.05, e);
  float n = fbm(uv, 10, 4, 145);
  vec3 col = mix(vec3(0.16, 0.13, 0.20), vec3(0.28, 0.23, 0.32), r.x) * (0.85 + n * 0.3);
  // corruption veins crawling over the stone
  float vein = ridged(uv + r.yz * 0.2, 6, 4, 146);
  float vm = smoothstep(0.86, 0.97, vein) * smoothstep(-0.2, 0.3, fbm(uv, 3, 3, 147));
  col = mix(col, vec3(0.62, 0.16, 0.80), vm * 0.9);
  float fiss = smoothstep(0.02, 0.0, e) * smoothstep(0.0, 0.4, fbm(uv, 4, 3, 148));
  col = mix(col * mix(0.45, 1.0, slab), vec3(0.85, 0.25, 1.0), fiss);
  s.col = col; s.emit = max(fiss, vm * 0.7);
  s.h = slab * (0.55 + n * 0.1) + 0.05;
  s.ao = mix(0.5, 1.0, slab);
  return s;
}`,
  gravel: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec3 col = vec3(0.36, 0.33, 0.30);
  float h = 0.2;
  for (int L = 0; L < 3; L++) {
    int F = 30 + L * 18;
    ivec2 cell; vec2 ctr;
    vec4 v = pvoro(uv * float(F), ivec2(F), 151 + L, 0.9, cell, ctr);
    vec4 r = h4(cell, 154 + L);
    float sz = 0.36 + r.x * 0.14;
    float st = smoothstep(sz, sz - 0.1, v.x);
    vec3 sc = mix(vec3(0.46, 0.43, 0.40), vec3(0.66, 0.62, 0.56), r.y) * (0.75 + r.z * 0.4);
    sc *= 0.8 + 0.3 * sat(1.0 - v.x / sz);
    col = mix(col, sc, st);
    h = max(h, st * (0.4 + 0.3 * sat(1.0 - v.x / sz)) + float(L) * 0.02);
  }
  s.col = col; s.h = h;
  return s;
}`,
  bloodstone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  // big dark-red arena flagstones, cracked, stained
  const int N = 4;
  vec2 p = uv * float(N);
  float rowOff = h1(wrapc(ivec2(0, int(floor(p.y))), ivec2(1, N)), 161) * 0.5;
  p.x += step(0.5, mod(floor(p.y), 2.0)) * 0.5;
  ivec2 t = wrapc(ivec2(floor(p)), ivec2(N));
  vec2 f = fract(p);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) + fbm(uv, 24, 3, 162) * 0.02;
  vec4 r = h4(t, 163);
  vec3 col = mix(vec3(0.30, 0.20, 0.18), vec3(0.42, 0.30, 0.26), r.x);
  float n = fbm(uv, 12, 4, 164);
  col *= 0.85 + n * 0.25;
  float cr = ridged(uv + r.zw, 5, 4, 165);
  float crack = smoothstep(0.9, 0.98, cr) * step(0.4, r.y);
  float stain = smoothstep(0.1, 0.6, fbm(uv, 3, 4, 166));
  col = mix(col, vec3(0.25, 0.04, 0.03), stain * 0.55);
  col *= 1.0 - crack * 0.5;
  float slab = smoothstep(0.01, 0.04, e);
  col = mix(vec3(0.10, 0.07, 0.06), col, slab);
  s.col = col; s.h = slab * (0.6 - crack * 0.2 + n * 0.05) + 0.1;
  s.ao = mix(0.5, 1.0, slab);
  return s;
}`,
  mud: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 3, 5, 171), n2 = fbm(uv, 10, 3, 172);
  vec3 col = mix(vec3(0.20, 0.15, 0.10), vec3(0.34, 0.26, 0.17), sat(0.5 + n));
  float wet = smoothstep(0.1, -0.3, n2);
  col = mix(col, col * 0.6 + vec3(0.02, 0.03, 0.04), wet);
  float ft = smoothstep(0.9, 0.97, ridged(uv, 5, 3, 173));
  col *= 1.0 - ft * 0.2;
  s.col = col; s.h = 0.3 + n * 0.2 - wet * 0.1;
  return s;
}`,

  basalt: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 w = vec2(fbm(uv, 3, 2, 801), fbm(uv, 3, 2, 802)) * 0.18;
  ivec2 cell; vec2 ctr;
  vec4 v = pvoroHex(uv * vec2(5.0, 6.0) + w, ivec2(5, 6), 803, 0.5, cell, ctr);
  vec4 r = h4(cell, 804);
  float e = v.z + fbm(uv, 48, 2, 805) * 0.025;
  float top = smoothstep(0.03, 0.1, e);
  float n = fbm(uv + r.xy, 14, 4, 806);
  // column tops: charcoal with a faint warm/violet cast; some tops dusted pale with ash
  vec3 c = mix(vec3(0.19, 0.18, 0.19), vec3(0.34, 0.32, 0.32), r.x) * (0.84 + n * 0.3);
  float ring = sin(length((uv * vec2(5.0, 6.0) + w) - ctr) * 22.0 + r.y * 6.0) * 0.5 + 0.5;
  c *= 0.93 + ring * 0.09 * top;
  float dusted = smoothstep(0.55, 0.85, r.w) * smoothstep(-0.1, 0.4, n);
  c = mix(c, vec3(0.52, 0.49, 0.47), dusted * 0.55);
  float ash = smoothstep(0.1, -0.4, n) * 0.5 + (1.0 - top) * 0.25;
  c = mix(c, vec3(0.38, 0.36, 0.35), ash * 0.5);
  // molten seams: only a few meandering stretches of joint are open
  float open = smoothstep(0.32, 0.6, fbm(uv, 2, 3, 807) * 0.8 + fbm(uv, 6, 2, 808) * 0.35);
  float seam = smoothstep(0.03, 0.0, v.z) * open;
  c = mix(c * mix(0.4, 1.0, top), vec3(1.0, 0.42, 0.1), seam);
  s.col = c; s.emit = seam;
  s.h = top * (0.4 + r.z * 0.4) + (1.0 - top) * 0.05;
  s.ao = mix(0.5, 1.0, top);
  return s;
}`,
  cinder: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 811), n2 = fbm(uv, 16, 3, 812);
  vec3 c = mix(vec3(0.20, 0.19, 0.19), vec3(0.40, 0.38, 0.37), sat(0.5 + n * 0.9));
  c *= 0.9 + n2 * 0.2;
  float h = 0.35 + n * 0.15;
  // pumice & slag pebbles
  ivec2 cell; vec2 ctr; vec4 v = pvoro(uv * 26.0, ivec2(26), 813, 0.9, cell, ctr);
  vec4 r = h4(cell, 814);
  float peb = smoothstep(0.34, 0.24, v.x) * step(r.x, 0.3);
  c = mix(c, mix(vec3(0.18, 0.16, 0.16), vec3(0.34, 0.30, 0.28), r.y) * (0.8 + 0.4 * sat(1.0 - v.x / 0.34)), peb);
  h = max(h, peb * 0.6);
  // crust cracks with a faint glow deep inside
  ivec2 c2; vec2 t2; vec4 v2 = pvoro(uv * 7.0 + n * 0.4, ivec2(7), 815, 0.9, c2, t2);
  float crack = smoothstep(0.03, 0.0, v2.z);
  float hot = crack * smoothstep(0.3, 0.6, fbm(uv, 3, 3, 816));
  c = mix(c, vec3(0.06, 0.05, 0.05), crack * 0.8);
  c = mix(c, vec3(1.0, 0.36, 0.08), hot * 0.9);
  // ember specks
  float sp = step(0.997, h1(wrapc(ivec2(floor(uv * 256.0)), ivec2(256)), 817));
  s.col = c + vec3(1.0, 0.4, 0.1) * sp * 0.4; s.emit = max(hot * 0.8, sp * 0.35);
  s.h = h - crack * 0.2;
  return s;
}`,
  dunes: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 q = uv + vec2(fbm(uv, 2, 3, 821), fbm(uv, 2, 3, 822)) * 0.06;
  float n = fbm(uv, 3, 4, 823), n2 = fbm(uv, 12, 3, 824);
  // asymmetric wind ripples: gentle windward slope, steep lee face
  float ph = fract(q.x * 6.0 + q.y * 16.0 + n * 0.6);          // integer frequencies → tiles seamlessly
  float rip = ph < 0.78 ? ph / 0.78 : 1.0 - (ph - 0.78) / 0.22;
  float rip2 = fract(q.x * 8.0 + q.y * 41.0 + n2 * 0.8);
  vec3 c = mix(vec3(0.74, 0.56, 0.34), vec3(0.93, 0.78, 0.54), sat(0.45 + n * 0.8));
  c *= 0.9 + rip * 0.14;
  c *= 1.0 - smoothstep(0.8, 1.0, ph) * 0.18;             // shaded lee faces
  c *= 0.97 + (rip2 < 0.5 ? rip2 : 1.0 - rip2) * 0.06;
  float g = h1(wrapc(ivec2(floor(uv * 512.0)), ivec2(512)), 825);
  c *= 0.95 + g * 0.1;
  float glint = step(0.996, g);
  s.col = c + glint * 0.18;
  s.h = 0.35 + rip * 0.3 + n * 0.1;
  return s;
}`,
  sandstone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const int ROWS = 4, COLS = 4;
  float y = uv.y * float(ROWS); int row = int(floor(y));
  int rw = int(mod(float(row), float(ROWS)));
  float x = uv.x * float(COLS) + h1(ivec2(rw, 7), 831) * float(COLS);
  int ci = int(floor(x));
  int left = ci; for (int k = 0; k < 2; k++) { if (h1(wrapc(ivec2(left, rw), ivec2(COLS, ROWS)), 832) < 0.6) break; left--; }
  int right = ci + 1; for (int k = 0; k < 2; k++) { if (h1(wrapc(ivec2(right, rw), ivec2(COLS, ROWS)), 832) < 0.6) break; right++; }
  ivec2 id = wrapc(ivec2(left, rw), ivec2(COLS, ROWS));
  vec4 r = h4(id, 833);
  float e = min(min(x - float(left), float(right) - x) / float(COLS), min(y - float(row), float(row + 1) - y) / float(ROWS));
  float n = fbm(uv + r.xy, 10, 4, 834);
  e += n * 0.012 + fbm(uv, 60, 2, 835) * 0.004;           // eroded, rounded edges
  float slab = smoothstep(0.004, 0.03, e);
  vec3 c = mix(vec3(0.78, 0.60, 0.40), vec3(0.88, 0.74, 0.52), r.x) * (0.9 + n * 0.16);
  // wind-etched layers and pits
  c *= 0.95 + sin((uv.y * 30.0 + n * 3.0) * TAU) * 0.03;
  ivec2 pc; vec2 pt; vec4 pv = pvoro(uv * 40.0, ivec2(40), 836, 0.9, pc, pt);
  float pit = smoothstep(0.12, 0.05, pv.x) * step(h1(pc, 837), 0.3);
  c *= 1.0 - pit * 0.25;
  vec3 sand = vec3(0.86, 0.70, 0.48);
  c = mix(sand * (0.9 + n * 0.1), c, slab);
  s.col = c; s.h = slab * (0.55 + n * 0.08) - pit * 0.1 + 0.1;
  s.ao = mix(0.7, 1.0, slab);
  return s;
}`,
  seastone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  // drowned cathedral floor: diagonal checker of dark/pale stone with algae creeping along the joints
  vec2 p = uv * 4.0;
  vec2 d = vec2(p.x + p.y, p.x - p.y) * 0.7071 * 1.4142;
  ivec2 t = wrapc(ivec2(floor(p)), ivec2(4));
  vec2 f = fract(p);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float chk = mod(float(t.x + t.y), 2.0);
  vec4 r = h4(t, 841);
  float n = fbm(uv, 8, 4, 842);
  vec3 a = vec3(0.62, 0.66, 0.64), b = vec3(0.24, 0.30, 0.32);
  vec3 c = mix(a, b, chk) * (0.9 + r.x * 0.12 + n * 0.12);
  // inlaid diamond in each pale tile
  float dia = step(abs(f.x - 0.5) + abs(f.y - 0.5), 0.28) * (1.0 - chk);
  c = mix(c, vec3(0.30, 0.40, 0.44), dia * 0.7);
  float joint = smoothstep(0.012, 0.03, e + n * 0.01);
  vec3 algae = mix(vec3(0.10, 0.22, 0.16), vec3(0.22, 0.38, 0.22), sat(0.5 + fbm(uv, 20, 2, 843)));
  float grow = smoothstep(0.1, 0.0, e) * smoothstep(-0.2, 0.3, fbm(uv, 4, 3, 844)) + smoothstep(0.35, 0.7, fbm(uv, 3, 4, 845)) * 0.6;
  c = mix(c, algae, sat(grow) * 0.85);
  c = mix(vec3(0.08, 0.12, 0.12), c, joint);
  // barnacle clusters
  ivec2 bc; vec2 bt; vec4 bv = pvoro(uv * 30.0, ivec2(30), 846, 0.9, bc, bt);
  float bar = smoothstep(0.2, 0.12, bv.x) * step(h1(bc, 847), 0.12);
  c = mix(c, vec3(0.78, 0.76, 0.70), bar);
  s.col = c; s.h = joint * (0.5 + n * 0.05) + bar * 0.2 + sat(grow) * 0.08;
  s.ao = mix(0.6, 1.0, joint);
  return s;
}`,
};

// metres per texture repeat on the ground
export const LAYER_TILE = { basalt: 5.5, cinder: 4.5, dunes: 7, sandstone: 5, seastone: 4.5, fan: 5.2, grass: 4.5, dirt: 4, cobble: 3.2, flagstone: 4.2, sand: 6, snow: 7, obsidian: 7, ice: 9, rock: 8, marble: 6, moss: 4, void: 8, gravel: 3, bloodstone: 7, mud: 5 };
const BUMP = { basalt: 7, cinder: 5, dunes: 3, sandstone: 5, seastone: 4, fan: 7, grass: 3, dirt: 5, cobble: 7, flagstone: 5, sand: 3, snow: 2, obsidian: 6, ice: 3, rock: 6, marble: 3, moss: 4, void: 6, gravel: 6, bloodstone: 5, mud: 3 };

let GROUND = null;
export function groundLayers(size = 512) {
  if (GROUND) return GROUND;
  const names = Object.keys(LAYERS);
  const n = names.length, px = size * size * 4;
  precompile([...names.map(k => LAYERS[k]), ...Object.values(KIT), DECAL_GLSL, FOLIAGE_GLSL, NOISE_GLSL]);
  const alb = new Uint8Array(px * n), nrm = new Uint8Array(px * n);
  names.forEach((k, i) => {
    const o = bakeSet(LAYERS[k], { size, outputs: ['albedo', 'normal'], bump: BUMP[k] ?? 4, cavity: 5 });
    alb.set(o.albedo, i * px); nrm.set(o.normal, i * px);
  });
  const mk = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, size, size, n);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  };
  const index = {}; names.forEach((k, i) => index[k] = i);
  GROUND = { albedo: mk(alb, true), normal: mk(nrm, false), index, names, tile: names.map(k => LAYER_TILE[k] || 4) };
  return GROUND;
}

// ------------------------------------------------------------------ architecture surfaces
// (col = base colour; vertex colours multiply it, so most are painted near-white/neutral and tinted per use)
export const KIT = {
  // pale ashlar blocks: 1 texture repeat = 2 m (rows of 0.5 m blocks)
  ashlar: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const int ROWS = 4;
  float y = uv.y * float(ROWS); int row = int(floor(y));
  int rw = int(mod(float(row), float(ROWS)));
  float x = uv.x * 3.0 + h1(ivec2(rw, 1), 201) * 3.0;
  int ci = int(floor(x));
  int left = ci; for (int k = 0; k < 2; k++) { if (h1(wrapc(ivec2(left, rw), ivec2(3, ROWS)), 202) < 0.7) break; left--; }
  int right = ci + 1; for (int k = 0; k < 2; k++) { if (h1(wrapc(ivec2(right, rw), ivec2(3, ROWS)), 202) < 0.7) break; right++; }
  ivec2 id = wrapc(ivec2(left, rw), ivec2(3, ROWS));
  vec4 r = h4(id, 203);
  float ex = min(x - float(left), float(right) - x) / 3.0, ey = min(y - float(row), float(row + 1) - y) / float(ROWS);
  float e = min(ex * 1.0, ey) + fbm(uv, 24, 3, 204) * 0.006;
  float blk = smoothstep(0.004, 0.018, e);
  float n = fbm(uv + r.xy, 8, 4, 205);
  vec3 c = mix(vec3(0.92, 0.89, 0.83), vec3(0.84, 0.82, 0.78), r.x) * (0.94 + r.y * 0.1);
  c *= 0.95 + n * 0.08;
  c = mix(c * 0.86, c, smoothstep(0.0, 0.05, e));
  // weathering streaks running down
  float streak = smoothstep(0.55, 0.9, fbm(vec2(uv.x * 1.0, uv.y * 0.25), 24, 3, 206)) * 0.12;
  c *= 1.0 - streak;
  vec3 mortar = vec3(0.70, 0.67, 0.61);
  s.col = mix(mortar, c, blk);
  s.h = blk * (0.6 + n * 0.08) * mix(0.75, 1.0, smoothstep(0.0, 0.03, e)) + 0.1;
  s.ao = mix(0.75, 1.0, blk);
  return s;
}`,
  plaster: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 211), n2 = fbm(uv, 16, 3, 212);
  vec3 c = vec3(0.95, 0.92, 0.86) * (0.96 + n * 0.06);
  c = mix(c, vec3(0.86, 0.80, 0.70), smoothstep(0.3, 0.7, fbm(vec2(uv.x, uv.y * 0.3), 6, 3, 213)) * 0.2);
  // a few exposed bricks where the plaster flaked off
  float flake = smoothstep(0.55, 0.62, fbm(uv, 3, 4, 214));
  vec2 bp = uv * vec2(10.0, 20.0); bp.x += step(1.0, mod(floor(bp.y), 2.0)) * 0.5;
  vec2 bf = fract(bp); float be = min(min(bf.x, 1.0 - bf.x) * 0.5, min(bf.y, 1.0 - bf.y));
  vec3 brick = mix(vec3(0.55, 0.30, 0.22), vec3(0.66, 0.40, 0.28), h1(wrapc(ivec2(floor(bp)), ivec2(10, 20)), 215));
  brick = mix(vec3(0.6, 0.56, 0.5), brick, smoothstep(0.02, 0.06, be));
  c = mix(c, brick, flake);
  s.col = c * (0.97 + n2 * 0.04);
  s.h = 0.5 + n * 0.05 - flake * 0.2 + flake * smoothstep(0.02, 0.06, be) * 0.1;
  return s;
}`,
  // clay barrel tiles; 1 repeat = 2 m; tinted per roof (blue / red / slate) with vertex colour
  tiles: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const float COLS = 8.0, ROWS = 9.0;
  vec2 p = vec2(uv.x * COLS, uv.y * ROWS);
  float row = floor(p.y);
  vec2 f = fract(p);
  ivec2 id = wrapc(ivec2(floor(p.x), int(row)), ivec2(8, 9));
  vec4 r = h4(id, 221);
  float cx = abs(f.x - 0.5) * 2.0;
  float barrel = sqrt(sat(1.0 - cx * cx));
  // each course overlaps the one below: lower part of tile lighter, top shadowed by course above
  float lap = smoothstep(0.0, 0.25, f.y);
  float lip = smoothstep(1.0, 0.88, f.y);
  float h = barrel * (0.5 + 0.4 * f.y) * lip;
  vec3 c = vec3(0.92) * (0.82 + r.x * 0.3);
  c *= mix(0.55, 1.0, barrel) * mix(0.6, 1.0, lap);
  c *= 1.0 - (1.0 - lip) * 0.45;
  float n = fbm(uv, 16, 3, 222);
  c *= 0.92 + n * 0.12;
  // lichen / weathering spots
  float lich = smoothstep(0.5, 0.7, fbm(uv, 6, 4, 223)) * 0.25;
  c = mix(c, vec3(0.72, 0.70, 0.52), lich);
  // occasional odd tile (replaced)
  c *= mix(1.0, 1.15, step(0.93, r.y));
  s.col = c; s.h = h;
  return s;
}`,
  slate: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const float COLS = 7.0, ROWS = 10.0;
  vec2 p = vec2(uv.x * COLS, uv.y * ROWS);
  float row = floor(p.y);
  p.x += step(1.0, mod(row, 2.0)) * 0.5;
  vec2 f = fract(p);
  ivec2 id = wrapc(ivec2(floor(p.x), int(row)), ivec2(7, 10));
  vec4 r = h4(id, 231);
  float ex = min(f.x, 1.0 - f.x);
  float edge = smoothstep(0.0, 0.08, ex);
  float bot = 1.0 - pow(abs(f.x - 0.5) * 2.0, 4.0) * 0.25;
  float lip = smoothstep(bot, bot - 0.08, f.y);
  vec3 c = vec3(0.9) * (0.8 + r.x * 0.3) * mix(0.65, 1.0, f.y) * mix(0.6, 1.0, edge);
  c *= mix(0.55, 1.0, lip);
  c *= 0.93 + fbm(uv, 20, 3, 232) * 0.1;
  s.col = c; s.h = (0.4 + 0.5 * f.y) * lip * edge;
  return s;
}`,
  planks: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const float N = 6.0;
  float pi = floor(uv.y * N);
  float py = fract(uv.y * N);
  vec4 r = h4(wrapc(ivec2(int(pi), 0), ivec2(6, 1)), 241);
  // plank ends
  float endX = fract(uv.x * 2.0 + r.x);
  float g = fbm(vec2(uv.x * 0.5, uv.y * 3.0) + r.yz, 8, 4, 242);
  float grain = sin((uv.y * N * 9.0 + g * 5.0) * PI) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.46, 0.32, 0.20), vec3(0.62, 0.46, 0.30), r.w) * (0.85 + grain * 0.2);
  c *= 0.9 + fbm(uv, 16, 3, 243) * 0.15;
  float seam = smoothstep(0.0, 0.06, py) * smoothstep(1.0, 0.94, py) * smoothstep(0.0, 0.01, endX) * smoothstep(1.0, 0.99, endX);
  c *= mix(0.35, 1.0, seam);
  // nails
  vec2 nl = vec2(fract(uv.x * 2.0 + r.x) , py);
  float nail = smoothstep(0.03, 0.015, length((nl - vec2(0.04, 0.5)) * vec2(4.0, 1.0)));
  c = mix(c, vec3(0.2, 0.18, 0.17), nail);
  s.col = c; s.h = seam * (0.6 + grain * 0.05);
  s.ao = mix(0.6, 1.0, seam);
  return s;
}`,
  timber: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float g = fbm(uv * vec2(1.0, 1.0), 4, 4, 251);
  float grain = sin((uv.x * 30.0 + g * 6.0) * PI) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.24, 0.15, 0.09), vec3(0.40, 0.27, 0.16), grain * 0.6 + g * 0.3 + 0.2);
  float knot = smoothstep(0.08, 0.02, length(wd(uv - vec2(0.3, 0.6)) * vec2(3.0, 1.0)));
  c *= 1.0 - knot * 0.4;
  s.col = c; s.h = 0.5 + grain * 0.1 - knot * 0.1;
  return s;
}`,
  metal: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 6, 4, 261), n2 = fbm(uv, 30, 2, 262);
  vec3 c = vec3(0.55, 0.56, 0.6) * (0.85 + n * 0.2 + n2 * 0.08);
  float rust = smoothstep(0.35, 0.7, fbm(uv, 4, 4, 263));
  c = mix(c, vec3(0.45, 0.28, 0.18), rust * 0.35);
  s.col = c; s.h = 0.5 + n2 * 0.05;
  return s;
}`,
  gold: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 6, 4, 271);
  vec3 c = vec3(0.95, 0.72, 0.30) * (0.88 + n * 0.2);
  // engraved filigree
  float fil = smoothstep(0.9, 0.97, ridged(uv, 6, 3, 272));
  c *= 1.0 - fil * 0.35;
  s.col = c; s.h = 0.6 - fil * 0.3;
  return s;
}`,
  cloth: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 p = uv * 96.0;
  float wx = sin(p.x * PI) * 0.5 + 0.5, wy = sin(p.y * PI) * 0.5 + 0.5;
  float weave = mix(wx, wy, step(0.5, fract((floor(p.x) + floor(p.y)) * 0.5)));
  float n = fbm(uv, 4, 4, 281);
  vec3 c = vec3(0.93) * (0.9 + weave * 0.1) * (0.95 + n * 0.08);
  s.col = c; s.h = 0.5 + weave * 0.1;
  return s;
}`,
  rockface: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 291);
  ivec2 cell; vec2 ctr; vec4 v = pvoro(uv * vec2(5.0, 5.0) + n * 0.3, ivec2(5), 292, 0.9, cell, ctr);
  vec4 r = h4(cell, 293);
  float blk = smoothstep(0.0, 0.08, v.z);
  // facet shading from a random plane per block
  vec2 fn = (r.xy - 0.5) * 1.6;
  vec2 lp = (uv * 5.0 + n * 0.3) - ctr;
  float facet = 0.82 + (fn.x * 0.3 - fn.y * 0.35) + dot(lp, fn) * 0.15;
  vec3 c = mix(vec3(0.52, 0.49, 0.46), vec3(0.64, 0.60, 0.55), r.z) * facet;
  c *= mix(0.55, 1.0, blk);
  float n2 = fbm(uv, 24, 3, 294);
  c *= 0.9 + n2 * 0.15;
  float strata = sin((uv.y * 14.0 + n * 1.5) * TAU) * 0.5 + 0.5;
  c *= 0.92 + strata * 0.1;
  s.col = c; s.h = blk * (0.5 + dot(lp, fn) * 0.3) + n2 * 0.05;
  return s;
}`,
  marbleWall: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 q = uv + vec2(fbm(uv, 2, 4, 301), fbm(uv, 2, 4, 302)) * 0.15;
  float vein = ridged(q, 3, 5, 303);
  vec3 c = vec3(0.94, 0.92, 0.88) * (0.96 + fbm(uv, 8, 3, 304) * 0.05);
  c = mix(c, vec3(0.64, 0.64, 0.68), smoothstep(0.8, 0.97, vein) * 0.7);
  s.col = c; s.h = 0.5;
  return s;
}`,
  darkstone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  const int ROWS = 5;
  float y = uv.y * float(ROWS); int row = int(floor(y));
  float x = uv.x * 3.0 + step(1.0, mod(float(row), 2.0)) * 0.5;
  vec2 f = vec2(fract(x), fract(y));
  ivec2 id = wrapc(ivec2(floor(x), row), ivec2(3, ROWS));
  vec4 r = h4(id, 311);
  float e = min(min(f.x, 1.0 - f.x) / 1.6, min(f.y, 1.0 - f.y)) + fbm(uv, 20, 3, 312) * 0.03;
  float blk = smoothstep(0.02, 0.07, e);
  float n = fbm(uv, 10, 4, 313);
  vec3 c = mix(vec3(0.14, 0.12, 0.15), vec3(0.24, 0.20, 0.24), r.x) * (0.85 + n * 0.3);
  float cr = ridged(uv + r.yz, 4, 4, 314);
  float crack = smoothstep(0.93, 0.99, cr) * step(0.5, r.w);
  float glow = max(crack, smoothstep(0.02, 0.0, e) * smoothstep(0.2, 0.6, fbm(uv, 3, 3, 315)));
  c = mix(c * mix(0.4, 1.0, blk), vec3(1.0, 0.35, 0.1), glow);
  s.col = c; s.emit = glow;
  s.h = blk * (0.6 + n * 0.08) - crack * 0.2 + 0.05;
  return s;
}`,
  bone: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 4, 5, 321);
  float rings = sin((uv.y * 22.0 + n * 2.0) * TAU) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.72, 0.66, 0.54), vec3(0.90, 0.86, 0.74), rings * 0.5 + n * 0.4 + 0.3);
  c *= 0.92 + fbm(uv, 24, 2, 322) * 0.1;
  s.col = c; s.h = 0.5 + rings * 0.1;
  return s;
}`,
  window: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  // leaded diamond panes, 1 repeat = one window
  vec2 p = uv * vec2(4.0, 6.0);
  vec2 d = vec2(p.x + p.y, p.x - p.y);
  vec2 f = fract(d * 0.5);
  float lead = smoothstep(0.03, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  float frame = smoothstep(0.02, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  float mull = smoothstep(0.012, 0.03, abs(uv.x - 0.5));
  float m = lead * frame * mull;
  vec3 glass = mix(vec3(0.16, 0.22, 0.32), vec3(0.42, 0.56, 0.68), smoothstep(0.8, 0.2, length(uv - vec2(0.3, 0.7))));
  s.col = mix(vec3(0.12, 0.10, 0.09), glass, m);
  s.emit = m;
  s.h = m * 0.3 + (1.0 - m) * 0.6;
  return s;
}`,
  bark: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 q = uv + vec2(fbm(uv, 2, 3, 341) * 0.08, 0.0);
  float n = fbm(q * vec2(1.0, 1.0), 4, 4, 342);
  // vertical furrows (u around the trunk, v up)
  float fur = ridged(vec2(q.x * 1.0, q.y * 0.25), 8, 3, 343);
  float plate = smoothstep(0.35, 0.8, fur);
  vec3 c = mix(vec3(0.20, 0.14, 0.10), vec3(0.46, 0.36, 0.26), plate);
  c *= 0.85 + n * 0.25;
  float lichen = smoothstep(0.55, 0.75, fbm(uv, 3, 4, 344)) * plate;
  c = mix(c, vec3(0.44, 0.50, 0.30), lichen * 0.5);
  s.col = c; s.h = plate * 0.7 + n * 0.1;
  return s;
}`,
  glacier: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float n = fbm(uv, 3, 5, 351);
  float streak = fbm(vec2(uv.x, uv.y * 0.2), 10, 3, 352);
  vec3 c = mix(vec3(0.50, 0.72, 0.90), vec3(0.86, 0.94, 1.0), sat(0.5 + n * 0.9 + streak * 0.5));
  ivec2 cell; vec2 ctr; vec4 v = pvoro(uv * 4.0 + vec2(n, streak) * 0.3, ivec2(4), 353, 0.9, cell, ctr);
  float fr = smoothstep(0.035, 0.0, v.z);
  c = mix(c, vec3(0.25, 0.5, 0.75), fr * 0.65);
  float band = smoothstep(0.72, 0.92, sin((uv.y * 6.0 + n * 0.8) * TAU) * 0.5 + 0.5);
  c = mix(c, vec3(0.95, 0.98, 1.0), band * 0.55);
  s.col = c; s.h = 0.5 + n * 0.25 - fr * 0.3 + band * 0.08;
  return s;
}`,
  lacquer: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  float g = fbm(vec2(uv.x * 0.4, uv.y * 3.0), 6, 4, 851);
  float grain = sin((uv.y * 40.0 + g * 5.0) * PI) * 0.5 + 0.5;
  vec3 c = vec3(0.9) * (0.95 + grain * 0.04);
  // worn-through spots where the dark wood shows
  float wear = smoothstep(0.62, 0.72, fbm(uv, 5, 4, 852) + grain * 0.05);
  c = mix(c, vec3(0.30, 0.16, 0.10), wear * 0.8);
  s.col = c; s.h = 0.5 - wear * 0.1 + grain * 0.02;
  return s;
}`,
  thatch: /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec3 c = vec3(0.52, 0.40, 0.20);
  float h = 0.3;
  for (int L = 0; L < 3; L++) {
    int F = 40 + L * 20;
    vec2 p = vec2(uv.x * float(F), uv.y * 8.0);
    ivec2 ip = ivec2(floor(p));
    vec4 r = h4(wrapc(ip, ivec2(F, 8)), 330 + L);
    float fx = fract(p.x);
    float st = smoothstep(0.5, 0.2, abs(fx - 0.5 - (r.x - 0.5) * 0.3));
    vec3 sc = mix(vec3(0.70, 0.56, 0.30), vec3(0.86, 0.72, 0.42), r.y) * (0.8 + fract(p.y) * 0.3);
    c = mix(c, sc, st * step(0.3, r.z));
    h = max(h, st * 0.6 * step(0.3, r.z));
  }
  c *= mix(0.6, 1.0, smoothstep(0.0, 0.3, fract(uv.y * 8.0)));
  s.col = c; s.h = h;
  return s;
}`,
};
const KIT_REPEAT_BUMP = { lacquer: 1.5, glacier: 3, bark: 6, ashlar: 4, plaster: 2, tiles: 6, slate: 5, planks: 4, timber: 2, metal: 1.5, gold: 2, cloth: 1.5, rockface: 5, marbleWall: 1, darkstone: 5, bone: 2, window: 3, thatch: 4 };

const KITCACHE = new Map();
function dataTex(px, size, srgb, repeat = true) {
  const t = new THREE.DataTexture(px, size, size, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
/** { map, normalMap, emissiveMap? } for an architecture surface. */
export function kitTex(name, size = 512) {
  if (KITCACHE.has(name)) return KITCACHE.get(name);
  const src = KIT[name];
  const emit = name === 'darkstone' || name === 'window';
  const o = bakeSet(src, { size, outputs: emit ? ['albedo', 'normal3', 'emit'] : ['albedo', 'normal3'], bump: KIT_REPEAT_BUMP[name] ?? 3, cavity: 4 });
  // albedo alpha holds height; three ignores it (materials are opaque)
  const res = { map: dataTex(o.albedo, size, true), normalMap: dataTex(o.normal3, size, false) };
  if (emit) res.emissiveMap = dataTex(o.emit, size, false);
  KITCACHE.set(name, res);
  return res;
}

// ------------------------------------------------------------------ decals (4×4 atlas, each slot alpha-faded)
export const DECAL_SLOTS = ['cracks', 'rubble', 'leaves', 'puddle', 'moss', 'blood', 'scorch', 'stain', 'runes', 'pebbles', 'petals', 'grate', 'fissure', 'frost', 'straw', 'sunmark'];
const DECAL_GLSL = /* glsl */`
Surf decal(int k, vec2 q, vec2 slot) {
  Surf s = S0(); s.a = 0.0; s.h = 0.5;
  vec2 c = q - 0.5; float r = length(c) * 2.0; float ang = atan(c.y, c.x);
  int sd = k * 13 + 500;
  float edge = smoothstep(1.0, 0.7, r + fbm(q + slot, 4, 3, sd) * 0.25);
  if (k == 0 || k == 1) { // cracks radiating from an impact point, plus rubble chips
    float cr = 0.0;
    for (int i = 0; i < 7; i++) {
      float a0 = float(i) / 7.0 * TAU + h1(ivec2(i, k), sd) * 0.8;
      vec2 p0 = vec2(0.0);
      for (int j = 0; j < 5; j++) {
        float a = a0 + (h1(ivec2(i, j), sd + 1) - 0.5) * 1.0;
        vec2 p1 = p0 + vec2(cos(a), sin(a)) * (0.07 + h1(ivec2(j, i), sd + 2) * 0.06);
        float w = mix(0.012, 0.002, float(j) / 5.0);
        cr = max(cr, smoothstep(w, 0.0, sdSeg(c, p0, p1)));
        p0 = p1;
      }
    }
    s.col = vec3(0.08, 0.07, 0.06); s.a = cr * 0.95; s.h = 0.5 - cr * 0.4;
    if (k == 1) {
      ivec2 cell; vec2 ct; vec4 v = pvoro(q * 14.0, ivec2(14), sd + 3, 0.9, cell, ct);
      float chip = smoothstep(0.25, 0.18, v.x) * step(h1(cell, sd + 4), 0.3) * smoothstep(0.9, 0.3, r);
      s.col = mix(s.col, vec3(0.55, 0.52, 0.48) * (0.8 + h1(cell, sd + 5) * 0.4), chip);
      s.a = max(s.a, chip); s.h = max(s.h, 0.5 + chip * 0.4);
      s.a = max(s.a, smoothstep(0.6, 0.0, r) * 0.25); // dust
      s.col = mix(vec3(0.3, 0.28, 0.25), s.col, max(cr, chip));
    }
    s.a *= smoothstep(1.0, 0.8, r);
  } else if (k == 2) { // fallen leaves
    for (int L = 0; L < 3; L++) {
      vec2 p = q * 7.0; ivec2 ip = ivec2(floor(p));
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        ivec2 g = ip + ivec2(i, j); vec4 rr = h4(g + ivec2(L * 17, 0), sd + L);
        if (rr.w > 0.6) continue;
        vec2 lq = rot(p - vec2(g) - rr.xy, rr.z * TAU);
        float lf = length(lq * vec2(1.0, 2.0)) + abs(lq.x) * 0.2;
        float m = smoothstep(0.34, 0.28, lf);
        vec3 lc = mix(vec3(0.72, 0.36, 0.08), vec3(0.85, 0.62, 0.16), rr.x);
        lc = mix(lc, vec3(0.55, 0.20, 0.08), step(0.75, rr.y));
        lc *= 1.0 - smoothstep(0.02, 0.0, abs(lq.y)) * 0.3;
        if (m > s.a) { s.col = lc; s.a = m; s.h = 0.6; }
      }
    }
    s.a *= edge;
  } else if (k == 3) { // puddle
    float m = smoothstep(0.85, 0.65, r + fbm(q, 3, 4, sd) * 0.35);
    s.col = vec3(0.10, 0.12, 0.14); s.a = m * 0.85; s.h = 0.3; s.emit = m; // emit channel = wet/gloss mask
  } else if (k == 4) { // moss patch
    float n = fbm(q, 6, 5, sd);
    float m = smoothstep(0.95, 0.55, r + n * 0.5);
    s.col = mix(vec3(0.16, 0.28, 0.08), vec3(0.38, 0.52, 0.14), sat(0.5 + fbm(q, 16, 3, sd + 1)));
    s.a = m; s.h = 0.5 + n * 0.3;
  } else if (k == 5) { // blood splatter
    float m = smoothstep(0.5, 0.35, r + fbm(q, 5, 4, sd) * 0.3);
    for (int i = 0; i < 12; i++) {
      float a = h1(ivec2(i, 1), sd) * TAU, d = 0.25 + h1(ivec2(i, 2), sd) * 0.6;
      vec2 p = vec2(cos(a), sin(a)) * d * 0.5;
      m = max(m, smoothstep(0.03 + h1(ivec2(i, 3), sd) * 0.04, 0.0, length(c - p)));
    }
    s.col = mix(vec3(0.30, 0.02, 0.02), vec3(0.45, 0.04, 0.03), fbm(q, 8, 2, sd + 2) * 0.5 + 0.5); s.a = m * 0.92; s.h = 0.55;
  } else if (k == 6) { // scorch
    float n = fbm(q, 5, 4, sd);
    float m = smoothstep(1.0, 0.4, r + n * 0.4);
    s.col = mix(vec3(0.02, 0.02, 0.02), vec3(0.18, 0.12, 0.08), smoothstep(0.3, 0.9, r));
    s.a = m * 0.9; s.h = 0.45;
    s.emit = smoothstep(0.35, 0.0, r + n * 0.3) * 0.6;
  } else if (k == 7) { // stain / dirt smudge
    float m = smoothstep(1.0, 0.2, r + fbm(q, 4, 5, sd) * 0.6);
    s.col = vec3(0.22, 0.18, 0.13); s.a = m * 0.55; s.h = 0.5;
  } else if (k == 8) { // arcane rune circle
    float ring = smoothstep(0.02, 0.0, abs(r - 0.9)) + smoothstep(0.015, 0.0, abs(r - 0.8)) + smoothstep(0.012, 0.0, abs(r - 0.45));
    float sectors = 12.0;
    float sa = fract(ang / TAU * sectors);
    float glyph = step(0.8, r) * step(r, 0.9) * smoothstep(0.1, 0.05, abs(sa - 0.5)) * 0.8;
    float spokes = smoothstep(0.01, 0.0, abs(sin(ang * 3.5)) * r * 0.5) * step(0.45, r) * step(r, 0.8);
    // star polygon
    float star = 0.0;
    for (int i = 0; i < 7; i++) {
      float a0 = float(i) / 7.0 * TAU, a1 = float(i + 3) / 7.0 * TAU;
      star = max(star, smoothstep(0.012, 0.0, sdSeg(c, vec2(cos(a0), sin(a0)) * 0.4, vec2(cos(a1), sin(a1)) * 0.4)));
    }
    float m = sat(ring + glyph + spokes * 0.8 + star);
    s.col = vec3(0.9, 0.95, 1.0); s.a = m; s.emit = m; s.h = 0.5 - m * 0.1;
  } else if (k == 9) { // pebbles
    ivec2 cell; vec2 ct; vec4 v = pvoro(q * 16.0, ivec2(16), sd, 0.9, cell, ct);
    vec4 rr = h4(cell, sd + 1);
    float peb = smoothstep(0.3, 0.22, v.x) * step(rr.x, 0.45) * edge;
    s.col = mix(vec3(0.5, 0.47, 0.43), vec3(0.72, 0.68, 0.6), rr.y) * (0.8 + 0.4 * sat(1.0 - v.x / 0.3));
    s.a = peb; s.h = 0.5 + peb * 0.4 * sat(1.0 - v.x / 0.3);
  } else if (k == 10) { // petals
    ivec2 cell; vec2 ct; vec4 v = pvoro(q * 20.0, ivec2(20), sd, 0.9, cell, ct);
    vec4 rr = h4(cell, sd + 1);
    vec2 lq = rot(q * 20.0 - ct, rr.z * TAU);
    float m = smoothstep(0.24, 0.18, length(lq * vec2(1.0, 1.7))) * step(rr.x, 0.5) * edge;
    s.col = mix(vec3(1.0, 0.72, 0.82), vec3(1.0, 0.95, 0.96), rr.y); s.a = m; s.h = 0.55;
  } else if (k == 11) { // iron drain grate
    vec2 b = abs(c);
    float box = step(max(b.x, b.y), 0.42);
    float rim = box * (1.0 - step(max(b.x, b.y), 0.36));
    float bars = step(0.5, fract(c.x * 10.0 + 0.25)) * step(max(b.x, b.y), 0.36);
    s.col = mix(vec3(0.03, 0.03, 0.03), vec3(0.22, 0.22, 0.24), max(rim, bars));
    s.a = box; s.h = mix(0.2, 0.55, max(rim, bars));
  } else if (k == 12) { // glowing fissure
    float n = fbm(q, 3, 4, sd);
    float line = abs(c.y + n * 0.25 + sin(c.x * 6.0) * 0.05);
    float w = 0.04 * smoothstep(0.5, 0.0, abs(c.x));
    float m = smoothstep(w + 0.03, w, line);
    float core = smoothstep(w, w * 0.2, line);
    s.col = mix(vec3(0.05, 0.02, 0.04), vec3(1.0, 0.5, 0.9), core);
    s.a = m * smoothstep(0.5, 0.35, abs(c.x)); s.emit = core; s.h = 0.5 - m * 0.4;
  } else if (k == 13) { // frost patch
    float n = fbm(q, 6, 5, sd);
    float m = smoothstep(0.95, 0.5, r + n * 0.5);
    float cr = smoothstep(0.9, 0.98, ridged(q, 8, 3, sd + 1));
    s.col = mix(vec3(0.8, 0.88, 0.96), vec3(1.0), cr); s.a = m * 0.85; s.h = 0.55 + cr * 0.1;
  } else if (k == 14) { // straw
    float m = 0.0;
    for (int i = 0; i < 40; i++) {
      vec4 rr = h4(ivec2(i, 7), sd);
      vec2 p0 = (rr.xy - 0.5) * 0.8; float a = rr.z * TAU; vec2 d = vec2(cos(a), sin(a)) * (0.08 + rr.w * 0.1);
      m = max(m, smoothstep(0.008, 0.0, sdSeg(c, p0 - d, p0 + d)) * (0.7 + rr.w * 0.3));
    }
    s.col = vec3(0.86, 0.72, 0.38); s.a = m; s.h = 0.55;
  } else { // 15: sun emblem inlay (seven rays)
    float disc = smoothstep(0.26, 0.25, r);
    float ring = smoothstep(0.02, 0.0, abs(r - 0.32));
    float ray = 0.0;
    for (int i = 0; i < 7; i++) {
      float a = float(i) / 7.0 * TAU - PI * 0.5;
      vec2 d = vec2(cos(a), sin(a));
      vec2 pp = c - d * 0.34;
      float along = dot(pp, d), perp = abs(dot(pp, vec2(-d.y, d.x)));
      ray = max(ray, step(0.0, along) * step(along, 0.28) * step(perp, 0.05 * (1.0 - along / 0.3)));
    }
    float m = max(max(disc, ring), ray);
    s.col = mix(vec3(0.78, 0.58, 0.26), vec3(0.98, 0.82, 0.44), disc); s.a = m; s.h = 0.5 + m * 0.15;
  }
  return s;
}
Surf surf(vec2 uv) {
  vec2 g = uv * 4.0; ivec2 id = ivec2(floor(g)); vec2 q = fract(g);
  int k = id.y * 4 + id.x;
  Surf s = decal(k, q, vec2(id));
  float border = smoothstep(0.0, 0.03, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
  s.a *= border;
  return s;
}`;
let DECALS = null;
export function decalAtlas(size = 1024) {
  if (DECALS) return DECALS;
  const o = bakeSet(DECAL_GLSL, { size, outputs: ['rgba', 'normal'], bump: 6, cavity: 3 });
  const mk = (px, srgb) => { const t = dataTex(px, size, srgb, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const slots = {}; DECAL_SLOTS.forEach((k, i) => slots[k] = i);
  DECALS = { map: mk(o.rgba, true), normal: mk(o.normal, false), slots };
  return DECALS;
}

// ------------------------------------------------------------------ foliage atlas (2×2): leaf cluster, blossom, needles, grass card
const FOLIAGE_GLSL = /* glsl */`
Surf leafCluster(vec2 q, int seed, vec3 lo, vec3 hi, float blossom) {
  Surf s = S0(); s.a = 0.0; s.col = mix(lo, hi, 0.45);
  vec2 c = q - 0.5;
  for (int i = 0; i < 70; i++) {
    vec4 r = h4(ivec2(i, seed), 600);
    float rr = sqrt(r.x) * 0.36, a = r.y * TAU;
    vec2 p = vec2(cos(a), sin(a)) * rr;
    vec2 lq = rot(c - p, r.z * TAU);
    float len = 0.07 + r.w * 0.05;
    float lf = length(lq * vec2(1.0, 2.1) - vec2(len * 0.5, 0.0)) ;
    float m = smoothstep(len * 0.62, len * 0.5, lf);
    if (m > 0.02) {
      float t = 1.0 - rr / 0.36;
      vec3 col = mix(lo, hi, sat(t * 0.6 + r.x * 0.3 + (lq.x / len) * 0.2));
      col *= 1.0 - smoothstep(0.004, 0.0, abs(lq.y)) * 0.25;
      if (blossom > 0.5 && fract(r.w * 7.0) > 0.45) col = mix(vec3(0.98, 0.70, 0.80), vec3(1.0, 0.92, 0.95), r.z);
      s.col = mix(s.col, col, m); s.a = max(s.a, m);
    }
  }
  return s;
}
Surf surf(vec2 uv) {
  vec2 g = uv * 2.0; ivec2 id = ivec2(floor(g)); vec2 q = fract(g);
  int k = id.y * 2 + id.x;
  Surf s;
  if (k == 0) s = leafCluster(q, 1, vec3(0.16, 0.34, 0.08), vec3(0.62, 0.80, 0.26), 0.0);
  else if (k == 1) s = leafCluster(q, 2, vec3(0.20, 0.36, 0.10), vec3(0.58, 0.74, 0.28), 1.0);
  else if (k == 2) { // needle spray
    s = S0(); s.a = 0.0; s.col = vec3(0.16, 0.34, 0.18); vec2 c = q - vec2(0.5, 0.1);
    for (int i = 0; i < 40; i++) {
      vec4 r = h4(ivec2(i, 3), 610);
      float y = r.x * 0.8; vec2 base = vec2(0.0, y);
      float a = (r.y - 0.5) * 2.2 + PI * 0.5; vec2 d = vec2(cos(a), sin(a)) * (0.18 * (1.0 - y) + 0.05);
      float m = smoothstep(0.012, 0.0, sdSeg(c, base, base + d));
      vec3 col = mix(vec3(0.08, 0.22, 0.12), vec3(0.30, 0.50, 0.26), r.z);
      if (m > s.a) { s.col = col; s.a = m; }
    }
    s.a = max(s.a, smoothstep(0.02, 0.0, abs(c.x)) * step(0.0, c.y) * step(c.y, 0.8));
  } else { // grass card: blades fanning upward
    s = S0(); s.a = 0.0; s.col = vec3(0.3, 0.48, 0.14); vec2 c = q - vec2(0.5, 0.0);
    for (int i = 0; i < 22; i++) {
      vec4 r = h4(ivec2(i, 4), 620);
      float x0 = (r.x - 0.5) * 0.7, h = 0.5 + r.y * 0.45, lean = (r.z - 0.5) * 0.5;
      float t = sat(c.y / h);
      float x = x0 + lean * t * t;
      float w = mix(0.03, 0.002, t);
      float m = smoothstep(w, w * 0.4, abs(c.x - x)) * step(c.y, h);
      vec3 col = mix(vec3(0.16, 0.32, 0.06), vec3(0.56, 0.72, 0.24), t) * (0.85 + r.w * 0.3);
      if (m > s.a) { s.col = col; s.a = m; }
    }
  }
  return s;
}`;
let FOLIAGE = null;
export function foliageAtlas(size = 1024) {
  if (FOLIAGE) return FOLIAGE;
  const alb = bakeSet(FOLIAGE_GLSL, { size, outputs: ['rgba'] }).rgba; // transparent texels carry the mean leaf colour (clean mips)
  const t = dataTex(alb, size, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  FOLIAGE = { map: t };
  return FOLIAGE;
}


// ------------------------------------------------------------------ autumn foliage atlas (2×2): maple clusters in three
// palettes + a gold fan-leaf cluster. Same slot layout as foliageAtlas (cards tinted by vertex colour).
const AUTUMN_GLSL = /* glsl */`
float mapleLeaf(vec2 q, float sz) {
  // five-lobed star leaf in local coords (q scaled so the leaf spans ~sz)
  q /= sz; float r = length(q), a = atan(q.y, q.x);
  float lobes = 0.55 + 0.45 * pow(abs(cos(a * 2.5)), 0.6);
  float stemNotch = smoothstep(0.35, 0.0, abs(a + 1.5708)) * 0.35;
  return smoothstep(lobes - stemNotch, lobes - stemNotch - 0.12, r);
}
Surf cluster(vec2 q, int seed, vec3 lo, vec3 hi, float fan) {
  Surf s = S0(); s.a = 0.0; s.col = mix(lo, hi, 0.5);
  vec2 c = q - 0.5;
  for (int i = 0; i < 60; i++) {
    vec4 r = h4(ivec2(i, seed), 700);
    float rr = sqrt(r.x) * 0.36, a = r.y * TAU;
    vec2 p = vec2(cos(a), sin(a)) * rr;
    vec2 lq = rot(c - p, r.z * TAU);
    float sz = 0.06 + r.w * 0.035;
    float m;
    if (fan > 0.5) { float fr = length(lq), fa = atan(lq.y, lq.x); m = smoothstep(sz, sz * 0.85, fr) * step(abs(fa - 1.5708), 0.8); }
    else m = mapleLeaf(lq, sz);
    if (m > 0.02) {
      float t = 1.0 - rr / 0.36;
      vec3 col = mix(lo, hi, sat(t * 0.55 + r.x * 0.35 + r.w * 0.2));
      col *= 1.0 - smoothstep(0.006, 0.0, abs(lq.x)) * 0.25 * step(lq.y, 0.0);
      s.col = mix(s.col, col, m); s.a = max(s.a, m);
    }
  }
  return s;
}
Surf surf(vec2 uv) {
  vec2 g = uv * 2.0; ivec2 id = ivec2(floor(g)); vec2 q = fract(g);
  int k = id.y * 2 + id.x;
  if (k == 0) return cluster(q, 11, vec3(0.55, 0.08, 0.03), vec3(1.0, 0.42, 0.10), 0.0);   // flame red → orange
  if (k == 1) return cluster(q, 12, vec3(0.62, 0.22, 0.04), vec3(1.0, 0.72, 0.18), 0.0);   // orange → gold
  if (k == 2) return cluster(q, 13, vec3(0.36, 0.03, 0.05), vec3(0.85, 0.12, 0.10), 0.0);  // deep crimson
  return cluster(q, 14, vec3(0.70, 0.52, 0.06), vec3(1.0, 0.88, 0.30), 1.0);               // gold fans
}`;
let AUTUMN = null;
export function autumnAtlas(size = 1024) {
  if (AUTUMN) return AUTUMN;
  const alb = bakeSet(AUTUMN_GLSL, { size, outputs: ['rgba'] }).rgba;
  const t = dataTex(alb, size, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  AUTUMN = { map: t };
  return AUTUMN;
}

// ------------------------------------------------------------------ macro noise (periodic)
const NOISE_GLSL = /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  s.col = vec3(fbm(uv, 2, 4, 701), fbm(uv, 6, 4, 702), fbm(uv, 16, 3, 703)) * 0.5 + 0.5;
  s.h = vfbm(uv, 4, 4, 704);
  return s;
}`;
let NOISE = null;
export function noiseTex(size = 256) {
  if (NOISE) return NOISE;
  const px = bakeSet(NOISE_GLSL, { size, outputs: ['albedo'] }).albedo;
  NOISE = dataTex(px, size, false);
  return NOISE;
}
