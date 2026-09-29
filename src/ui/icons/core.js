// SEVENSHARD icon painting toolkit. Every icon is painted in a 100×100 unit space (light from the top-left),
// at 2× the requested pixel size, then downsampled. Pure 2D canvas: no images, no fonts, no emoji.
export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

/** Device px per unit of the icon being painted (shadowBlur is not affected by transforms). */
export let K = 1.28;
export function setK(k) { K = k; }

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ------------------------------------------------------------------ colour
const RGB = new Map();
export function hexToRgb(h) {
  let v = RGB.get(h);
  if (v) return v;
  let s = h.charAt(0) === '#' ? h.slice(1) : h;
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  RGB.set(h, v);
  return v;
}
const hex2 = v => (v < 16 ? '0' : '') + v.toString(16);
const toHex = (r, g, b) => '#' + hex2(clamp(Math.round(r), 0, 255)) + hex2(clamp(Math.round(g), 0, 255)) + hex2(clamp(Math.round(b), 0, 255));
export function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
/** f < 0 darkens toward black, f > 0 lightens toward white. */
export function shade(h, f) {
  const [r, g, b] = hexToRgb(h);
  const m = v => (f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return toHex(m(r), m(g), m(b));
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
/** Saturation multiply (s > 1 = more vivid). */
export function sat(h, s) {
  const [r, g, b] = hexToRgb(h), l = 0.3 * r + 0.59 * g + 0.11 * b;
  return toHex(l + (r - l) * s, l + (g - l) * s, l + (b - l) * s);
}

// ------------------------------------------------------------------ canvas
export function mk(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true }); // CPU raster: no GPU readback per toDataURL
  x.setTransform(S / 100, 0, 0, S / 100, 0, 0);
  x.lineJoin = 'round'; x.lineCap = 'round';
  return [c, x];
}
export function downscale(src, size) {
  let cur = src;
  while (cur.width / 2 >= size) {
    const n = document.createElement('canvas'); n.width = n.height = cur.width / 2;
    const nx = n.getContext('2d', { willReadFrequently: true }); nx.imageSmoothingQuality = 'high';
    nx.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  if (cur.width !== size) {
    const n = document.createElement('canvas'); n.width = n.height = size;
    const nx = n.getContext('2d', { willReadFrequently: true }); nx.imageSmoothingQuality = 'high';
    nx.drawImage(cur, 0, 0, size, size); cur = n;
  }
  return cur;
}

// ------------------------------------------------------------------ primitives
export function lg(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
export function rg(x, cx, cy, r0, r1, stops, fx = cx, fy = cy) { const g = x.createRadialGradient(fx, fy, r0, cx, cy, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
export function poly(x, pts, close = true) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); if (close) x.closePath(); }
export function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, Math.max(0.01, r), 0, TAU); }
export function ellipse(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
export function star(x, cx, cy, n, r0, r1, rot = -PI / 2) {
  x.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  x.closePath();
}
export function blur(x, b, col) { x.shadowBlur = b * K; x.shadowColor = col; }
export function noBlur(x) { x.shadowBlur = 0; x.shadowColor = 'transparent'; }
export function add(x) { x.globalCompositeOperation = 'lighter'; }
export function norm(x) { x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
export function outline(x, col = 'rgba(0,0,0,.85)', w = 1.2) { x.strokeStyle = col; x.lineWidth = w; x.stroke(); }
export const bez = (a, b, c, d) => t => { const u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t; return [A * a[0] + B * b[0] + C * c[0] + D * d[0], A * a[1] + B * b[1] + C * c[1] + D * d[1]]; };
export const qbez = (a, b, c) => t => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; };
export const line = (a, b) => t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const arcF = (cx, cy, r, a0, a1, sy = 1) => t => { const a = a0 + (a1 - a0) * t; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]; };

/** Closed outline around a centreline f(t) with width w(t). */
export function ribbon(x, f, w, n = 28) {
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = f(t), a = f(Math.max(0, t - 0.01)), b = f(Math.min(1, t + 0.01));
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const ww = w(t) / 2;
    L.push([p[0] - dy * ww, p[1] + dx * ww]); Rr.push([p[0] + dy * ww, p[1] - dx * ww]);
  }
  x.beginPath(); x.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) x.lineTo(L[i][0], L[i][1]);
  for (let i = Rr.length - 1; i >= 0; i--) x.lineTo(Rr[i][0], Rr[i][1]);
  x.closePath();
}
export function strokeCurve(x, f, n = 24) { x.beginPath(); const p = f(0); x.moveTo(p[0], p[1]); for (let i = 1; i <= n; i++) { const q = f(i / n); x.lineTo(q[0], q[1]); } }

// ------------------------------------------------------------------ light & fx
/** Additive radial glow. */
export function glow(x, cx, cy, r, col, a = 1) {
  const pc = x.globalCompositeOperation, pa = x.globalAlpha;
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = a;
  x.fillStyle = rg(x, cx, cy, 0, r, [[0, col], [0.3, rgba(col, 0.5)], [0.65, rgba(col, 0.14)], [1, rgba(col, 0)]]);
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
  x.globalAlpha = pa; x.globalCompositeOperation = pc;
}
/** Soft darkening blob (shadow, smoke). */
export function shadowBlob(x, cx, cy, rx, ry, a = 0.5, col = '#000000') {
  x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
  x.fillStyle = rg(x, 0, 0, 0, rx, [[0, rgba(col, a)], [0.6, rgba(col, a * 0.45)], [1, rgba(col, 0)]]);
  x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
}
/** 4-point glint. */
export function sparkle(x, cx, cy, r, col = '#ffffff', rot = 0, a = 1) {
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  glow(x, cx, cy, r * 1.4, col, 0.5 * a);
  x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = a;
  x.fillStyle = 'rgba(255,255,255,.95)';
  for (let k = 0; k < 2; k++) {
    const q = k ? 0.55 : 1;
    x.beginPath();
    x.moveTo(-r * q, 0); x.quadraticCurveTo(0, -r * 0.08, 0, -r * q); x.quadraticCurveTo(0, -r * 0.08, r * q, 0);
    x.quadraticCurveTo(0, r * 0.08, 0, r * q); x.quadraticCurveTo(0, r * 0.08, -r * q, 0); x.fill();
    x.rotate(PI / 4);
  }
  x.restore(); x.globalAlpha = 1; x.globalCompositeOperation = pc;
}
export function embers(x, R, n, cx, cy, spread, cols, rmax = 1.4, sy = 0.9) {
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.pow(R(), 0.7) * spread;
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * sy;
    const r = 0.4 + R() * rmax, c = cols[(R() * cols.length) | 0];
    glow(x, px, py, r * 3, c, 0.45);
    x.fillStyle = c; circle(x, px, py, r * 0.55); x.fill();
  }
  x.globalCompositeOperation = pc;
}
/** Glowing stroke of the current path-builder fn(x): wide soft halo → body → white-hot core. */
export function glowPath(x, build, col, w, o = {}) {
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  const core = o.core ?? '#ffffff';
  const passes = [[w * 3.2, rgba(col, 0.1)], [w * 1.9, rgba(col, 0.22)], [w, rgba(col, 0.85)], [w * 0.38, rgba(core, o.coreA ?? 0.95)]];
  for (const [ww, c] of passes) { x.lineWidth = ww; x.strokeStyle = c; build(x); x.stroke(); }
  x.globalCompositeOperation = pc;
}
/** Tapered crescent slash along an arc. dir = +1 thick at a1, -1 thick at a0. */
export function slash(x, cx, cy, r, a0, a1, w, col, o = {}) {
  const sy = o.sy ?? 1, bias = o.bias ?? 1.5, rot = o.rot ?? 0;
  x.save(); x.translate(cx, cy); x.rotate(rot);
  const f = arcF(0, 0, r, a0, a1, sy);
  const wf = t => w * Math.pow(Math.sin(PI * Math.pow(t, bias)), 0.85) + 0.15;
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  // halo
  ribbon(x, f, t => wf(t) * 2.6 + 2, 40); x.fillStyle = rgba(col, 0.13); x.fill();
  ribbon(x, f, t => wf(t) * 1.6 + 0.8, 40); x.fillStyle = rgba(col, 0.28); x.fill();
  // body: hot toward the outer edge
  ribbon(x, f, wf, 40);
  x.fillStyle = rg(x, 0, 0, Math.max(0, r - w * 0.8), r + w * 0.6, [[0, rgba(col, 0)], [0.45, rgba(col, 0.75)], [0.8, rgba(o.hot ?? mix(col, '#ffffff', 0.55), 1)], [1, '#ffffff']]);
  x.fill();
  // white core line near the outer edge
  const g = arcF(0, 0, r + w * 0.12, a0, a1, sy);
  ribbon(x, g, t => wf(t) * 0.26, 40); x.fillStyle = rgba('#ffffff', o.coreA ?? 0.9); x.fill();
  x.globalCompositeOperation = pc; x.restore();
}
/** Slash crescent from A to B bulging sideways by `bulge` units (+ = to the left of A→B). Thick end at B. */
export function slashAB(x, ax, ay, bx, by, bulge, w, col, o = {}) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, c = Math.hypot(dx, dy) || 1;
  const nx = dy / c, ny = -dx / c, s = Math.abs(bulge) < 0.01 ? 0.01 : bulge, as = Math.abs(s);
  const r = (c * c / 4 + as * as) / (2 * as);
  const bxp = mx + nx * s, byp = my + ny * s, sg = Math.sign(s);
  const cx = bxp - nx * sg * r, cy = byp - ny * sg * r;
  const a0 = Math.atan2(ay - cy, ax - cx), a1 = Math.atan2(by - cy, bx - cx), aB = Math.atan2(byp - cy, bxp - cx);
  const nrm = a => { while (a <= -PI) a += TAU; while (a > PI) a -= TAU; return a; };
  let d1 = nrm(a1 - a0); const dB = nrm(aB - a0);
  if (Math.sign(d1) !== Math.sign(dB) || Math.abs(dB) > Math.abs(d1)) d1 -= Math.sign(d1) * TAU;
  slash(x, cx, cy, r, a0, a0 + d1, w, col, o);
}
/** Straight tapered streak (thrusts, speed lines, beams). */
export function streak(x, x0, y0, x1, y1, w, col, o = {}) {
  const f = line([x0, y0], [x1, y1]);
  const wf = o.even ? () => w : t => w * Math.pow(Math.sin(PI * Math.pow(t, o.bias ?? 1)), 0.7) + 0.1;
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  ribbon(x, f, t => wf(t) * 2.4 + 1, 12); x.fillStyle = rgba(col, 0.16 * (o.a ?? 1)); x.fill();
  ribbon(x, f, wf, 12); x.fillStyle = rgba(col, 0.8 * (o.a ?? 1)); x.fill();
  ribbon(x, f, t => wf(t) * 0.35, 12); x.fillStyle = rgba('#ffffff', 0.9 * (o.a ?? 1)); x.fill();
  x.globalCompositeOperation = pc;
}
/** Perspective ground ring (shockwave). */
export function ring(x, cx, cy, rx, ry, col, w = 2, a = 1) {
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  for (const [ww, al] of [[w * 4, 0.12], [w * 2, 0.3], [w, 0.85], [w * 0.35, 1]]) {
    x.lineWidth = ww; x.strokeStyle = al === 1 ? rgba('#ffffff', 0.8 * a) : rgba(col, al * a); ellipse(x, cx, cy, rx, ry); x.stroke();
  }
  x.globalCompositeOperation = pc;
}
/** Light rays from a point. */
export function rays(x, R, cx, cy, n, r0, r1, col, o = {}) {
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  const spread = o.spread ?? 0.06, a0 = o.a0 ?? 0, arc = o.arc ?? TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (arc === TAU ? (i / n) * TAU : (i / Math.max(1, n - 1)) * arc) + (R() - 0.5) * (o.jit ?? 0.25);
    const len = r0 + (r1 - r0) * (0.55 + R() * 0.45), sp = spread * (0.5 + R());
    x.fillStyle = rg(x, cx, cy, r0 * 0.5, len, [[0, rgba(col, o.alpha ?? 0.7)], [1, rgba(col, 0)]]);
    x.beginPath(); x.moveTo(cx + Math.cos(a - sp) * r0 * 0.3, cy + Math.sin(a - sp) * r0 * 0.3);
    x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    x.lineTo(cx + Math.cos(a + sp) * r0 * 0.3, cy + Math.sin(a + sp) * r0 * 0.3); x.closePath(); x.fill();
  }
  x.globalCompositeOperation = pc;
}
/** Spiky impact burst. */
export function burst(x, R, cx, cy, n, r0, r1, col, o = {}) {
  x.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + (o.rot ?? 0), r = i % 2 ? r0 * (0.8 + R() * 0.3) : r1 * (0.6 + R() * 0.45);
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * (o.sy ?? 1);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  x.fillStyle = rg(x, cx, cy, 0, r1, [[0, '#ffffff'], [0.25, mix(col, '#ffffff', 0.6)], [0.6, rgba(col, 0.8)], [1, rgba(col, 0)]]);
  x.fill(); x.globalCompositeOperation = pc;
}
/** Jagged lightning (midpoint displacement) with optional branches. Returns the points. */
export function bolt(x, R, x0, y0, x1, y1, o = {}) {
  let pts = [[x0, y0], [x1, y1]];
  const gens = o.gens ?? 5; let disp = (o.jit ?? 0.22) * Math.hypot(x1 - x0, y1 - y0);
  for (let g = 0; g < gens; g++) {
    const np = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const off = (R() - 0.5) * disp;
      np.push([(a[0] + b[0]) / 2 - (dy / l) * off, (a[1] + b[1]) / 2 + (dx / l) * off], b);
    }
    pts = np; disp *= 0.55;
  }
  const col = o.col || '#6ab8ff', w = o.w ?? 2.6;
  glowPath(x, xx => poly(xx, pts, false), col, w, o);
  if (o.branches) {
    for (let k = 0; k < o.branches; k++) {
      const i = 2 + ((R() * (pts.length - 6)) | 0), p = pts[i], q = pts[Math.min(pts.length - 1, i + 3)];
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6);
      const len = (o.blen ?? 16) * (0.5 + R() * 0.7);
      bolt(x, R, p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, { ...o, branches: 0, gens: 3, w: w * 0.5 });
    }
  }
  return pts;
}
/** Single flame tongue pointing up from local (0,0). */
export function tongue(x, h, w, sway) {
  x.beginPath();
  x.moveTo(-w / 2, 0);
  x.bezierCurveTo(-w * 0.62, -h * 0.38, -w * 0.05 + sway * 0.25, -h * 0.62, sway, -h);
  x.bezierCurveTo(w * 0.25 + sway * 0.35, -h * 0.55, w * 0.62, -h * 0.32, w / 2, 0);
  x.quadraticCurveTo(0, w * 0.42, -w / 2, 0);
  x.closePath();
}
export const FIRE = [['#6a0a00', 1.0, 1.0, 0.95], ['#d2380a', 0.86, 0.82, 0.95], ['#ff8a1a', 0.68, 0.62, 1], ['#ffd24a', 0.48, 0.42, 1], ['#fff6d0', 0.26, 0.22, 1]];
/** Layered flames at (cx,cy) pointing along rot (0 = up). o.layers = [[col, hScale, wScale, alpha]…] */
export function fire(x, R, cx, cy, h, w, rot = 0, o = {}) {
  const layers = o.layers || FIRE, n = o.n ?? 5;
  x.save(); x.translate(cx, cy); x.rotate(rot);
  for (let li = 0; li < layers.length; li++) {
    const [col, hs, ws, a] = layers[li];
    x.globalCompositeOperation = li < 2 ? 'source-over' : 'lighter';
    x.globalAlpha = a * (li < 2 ? 1 : 0.9);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) / Math.max(1, n - 1);
      const hh = h * hs * (1 - Math.abs(off) * 0.55) * (0.8 + R() * 0.35);
      const ww = w * ws * (0.45 + R() * 0.25);
      x.save(); x.translate(off * w * 0.62 * ws, 0); x.rotate(off * 0.35 + (R() - 0.5) * 0.15);
      x.fillStyle = lg(x, 0, 0, 0, -hh, [[0, col], [0.7, col], [1, rgba(col, 0)]]);
      tongue(x, hh, ww, (R() - 0.5) * ww * 0.9 + off * ww * 0.4); x.fill();
      x.restore();
    }
  }
  x.restore(); norm(x);
}
/** Fire palette tinted toward a hue (purple hellfire, blue flame, etc.). */
export function fireLayers(dark, mid, hot, core = '#ffffff') {
  return [[dark, 1.0, 1.0, 0.95], [mid, 0.86, 0.82, 0.95], [mix(mid, hot, 0.5), 0.68, 0.62, 1], [hot, 0.48, 0.42, 1], [core, 0.26, 0.22, 1]];
}
/** Faceted crystal shard, base at (0,0) pointing along angle a. */
export function crystal(x, cx, cy, len, w, a, col, o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(a);
  const tip = [len, 0], b1 = [len * 0.22, -w / 2], b2 = [len * 0.22, w / 2], base = [0, 0], ridge = [len * 0.28, (o.skew ?? 0.1) * w];
  if (o.glow !== false) glow(x, len * 0.5, 0, len * 0.7, col, o.glowA ?? 0.35);
  // lit facet (upper) and shadow facet (lower)
  poly(x, [base, b1, tip, ridge]); x.fillStyle = lg(x, 0, -w / 2, len * 0.3, w * 0.2, [[0, shade(col, 0.75)], [0.5, shade(col, 0.3)], [1, col]]); x.fill();
  poly(x, [base, ridge, tip, b2]); x.fillStyle = lg(x, 0, 0, len * 0.3, w / 2, [[0, col], [1, shade(col, -0.55)]]); x.fill();
  poly(x, [base, b1, tip, b2]); outline(x, o.edge ?? rgba(shade(col, -0.8), 0.9), o.lw ?? 0.8);
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.6; poly(x, [b1, tip], false); x.stroke();
  x.restore();
}
/** Faceted gem (top view) with n sides. */
export function gem(x, cx, cy, r, col, o = {}) {
  const n = o.n ?? 8, sy = o.sy ?? 1, pts = [], inner = [], ir = o.inner ?? 0.55, rot = o.rot ?? -PI / 2;
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]); inner.push([cx + Math.cos(a) * r * ir - r * 0.04, cy + Math.sin(a) * r * ir * sy - r * 0.05]); }
  if (o.glow !== false) glow(x, cx, cy, r * 2, col, o.glowA ?? 0.45);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, lit = 0.5 + 0.5 * Math.cos(((i + 0.5) / n) * TAU + rot + PI * 0.75 + PI / 2);
    x.fillStyle = mix(shade(col, -0.7), shade(col, 0.6), lit);
    poly(x, [pts[i], pts[j], inner[j], inner[i]]); x.fill();
  }
  x.fillStyle = rg(x, cx - r * 0.25, cy - r * 0.3, 0, r * 0.8, [[0, shade(col, 0.8)], [0.45, shade(col, 0.15)], [1, shade(col, -0.35)]]);
  poly(x, inner); x.fill();
  poly(x, pts); outline(x, o.edge ?? 'rgba(0,0,0,.85)', o.lw ?? 0.9);
  x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 0.45;
  for (let i = 0; i < n; i++) { x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(inner[i][0], inner[i][1]); x.stroke(); }
  if (o.spark !== false) sparkle(x, cx - r * 0.32, cy - r * 0.38 * sy, r * 0.5);
}
/** Irregular rock chunks (debris). */
export function rocks(x, R, n, cx, cy, spread, o = {}) {
  const cols = o.cols || ['#6a5a4a', '#3a3028', '#8a7a64'];
  for (let i = 0; i < n; i++) {
    const a = (o.a0 ?? 0) + (o.arc ?? TAU) * R(), d = spread * (0.3 + R() * 0.7);
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * (o.sy ?? 1), s = (o.size ?? 3) * (0.5 + R());
    const k = 5 + ((R() * 3) | 0), pts = [];
    for (let j = 0; j < k; j++) { const b = (j / k) * TAU + R() * 0.5; pts.push([px + Math.cos(b) * s * (0.7 + R() * 0.5), py + Math.sin(b) * s * (0.7 + R() * 0.5)]); }
    const c = cols[(R() * cols.length) | 0];
    x.fillStyle = lg(x, px - s, py - s, px + s, py + s, [[0, shade(c, 0.35)], [1, shade(c, -0.6)]]); poly(x, pts); x.fill();
    outline(x, 'rgba(0,0,0,.7)', 0.5);
    if (o.hot) { x.strokeStyle = rgba(o.hot, 0.8); x.lineWidth = 0.6; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); x.lineTo(pts[1][0], pts[1][1]); x.stroke(); }
  }
}
/** Glowing ground cracks radiating from a point (perspective sy). */
export function cracks(x, R, cx, cy, n, len, col, o = {}) {
  const sy = o.sy ?? 0.4;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + R() * 0.5, px = cx, py = cy;
    const pts = [[px, py]], segs = 4 + ((R() * 3) | 0), L = len * (0.5 + R() * 0.6);
    for (let s = 0; s < segs; s++) { a += (R() - 0.5) * 0.9; px += Math.cos(a) * L / segs; py += Math.sin(a) * L / segs * sy; pts.push([px, py]); }
    glowPath(x, xx => poly(xx, pts, false), col, o.w ?? 1.3, { coreA: 0.8 });
  }
}
/** Soft smoke puffs. */
export function smoke(x, R, n, cx, cy, spread, col = '#40404a', a = 0.35, rmax = 9) {
  for (let i = 0; i < n; i++) {
    const px = cx + (R() - 0.5) * spread * 2, py = cy + (R() - 0.5) * spread, r = rmax * (0.4 + R() * 0.7);
    x.fillStyle = rg(x, px - r * 0.3, py - r * 0.35, 0, r, [[0, rgba(shade(col, 0.25), a)], [0.7, rgba(col, a * 0.6)], [1, rgba(col, 0)]]);
    circle(x, px, py, r); x.fill();
  }
}
/** Puffy cloud bank centred at (cx,cy): lit tops (top-left light), dark bellies. cols = [light, mid, dark]. */
export function clouds(x, R, cx, cy, w, h, cols, n = 9) {
  const puffs = [];
  for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0.5; puffs.push([cx - w / 2 + t * w + (R() - 0.5) * w * 0.08, cy + (R() - 0.5) * h * 0.5 - Math.sin(t * PI) * h * 0.25, h * (0.45 + R() * 0.35) * (0.7 + Math.sin(t * PI) * 0.5)]); }
  for (const [px, py, r] of puffs) { x.fillStyle = cols[2]; circle(x, px + r * 0.12, py + r * 0.18, r); x.fill(); }
  for (const [px, py, r] of puffs) { x.fillStyle = rg(x, px - r * 0.35, py - r * 0.45, 0, r * 1.05, [[0, cols[0]], [0.55, cols[1]], [1, rgba(cols[2], 0.9)]]); circle(x, px, py, r * 0.94); x.fill(); }
}
/** Speed lines in a direction. */
export function speedLines(x, R, n, box, ang, col, o = {}) {
  const [x0, y0, x1, y1] = box, dx = Math.cos(ang), dy = Math.sin(ang);
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = x0 + R() * (x1 - x0), py = y0 + R() * (y1 - y0), len = (o.len ?? 22) * (0.5 + R() * 0.8);
    x.strokeStyle = lg(x, px, py, px - dx * len, py - dy * len, [[0, rgba(col, (o.a ?? 0.6) * (0.4 + R() * 0.6))], [1, rgba(col, 0)]]);
    x.lineWidth = (o.w ?? 1.4) * (0.4 + R()); x.beginPath(); x.moveTo(px, py); x.lineTo(px - dx * len, py - dy * len); x.stroke();
  }
  x.globalCompositeOperation = pc;
}
/** Magic circle (optionally squashed for a ground plane). */
export function runeCircle(x, R, cx, cy, r, col, o = {}) {
  const sy = o.sy ?? 1, w = o.w ?? 1;
  x.save(); x.translate(cx, cy); x.scale(1, sy); x.rotate(o.rot ?? 0);
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  const st = (lw, a) => { x.lineWidth = lw; x.strokeStyle = rgba(col, a); };
  glow(x, 0, 0, r * 1.25, col, o.glowA ?? 0.35);
  st(3.2 * w, 0.18); circle(x, 0, 0, r); x.stroke();
  st(1.1 * w, 0.95); circle(x, 0, 0, r); x.stroke();
  st(0.7 * w, 0.8); circle(x, 0, 0, r * 0.84); x.stroke();
  st(0.6 * w, 0.7); circle(x, 0, 0, r * 0.52); x.stroke();
  // glyph ticks between the rings
  const n = o.glyphs ?? 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a), rr = r * 0.92;
    st(0.9 * w, 0.9); x.beginPath();
    const kind = (R() * 4) | 0;
    if (kind === 0) { x.moveTo(c * r * 0.86, s * r * 0.86); x.lineTo(c * r * 0.98, s * r * 0.98); }
    else if (kind === 1) { x.arc(c * rr, s * rr, r * 0.035, 0, TAU); }
    else if (kind === 2) { x.moveTo(c * rr - s * r * 0.04, s * rr + c * r * 0.04); x.lineTo(c * rr + s * r * 0.04, s * rr - c * r * 0.04); x.moveTo(c * r * 0.87, s * r * 0.87); x.lineTo(c * rr, s * rr); }
    else { x.moveTo(c * r * 0.87, s * r * 0.87); x.lineTo(c * rr + s * r * 0.03, s * rr - c * r * 0.03); x.lineTo(c * r * 0.97, s * r * 0.97); }
    x.stroke();
  }
  // inner star polygon: odd k → one {k/2} star, even k → two interleaved k/2-gons
  const k = o.points ?? 6, rr = r * 0.82, V = i => [Math.cos(-PI / 2 + (i / k) * TAU) * rr, Math.sin(-PI / 2 + (i / k) * TAU) * rr];
  st(0.8 * w, 0.85);
  if (k % 2) { x.beginPath(); for (let i = 0; i <= k; i++) { const p = V((i * 2) % k); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.stroke(); }
  else for (const s of [0, 1]) { x.beginPath(); for (let i = 0; i <= k / 2; i++) { const p = V((s + i * 2) % k); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.stroke(); }
  x.globalCompositeOperation = pc; x.restore();
}
/** Eighth note (head at cx,cy). kind 0 = single, 1 = beamed pair. */
export function note(x, cx, cy, s, col, kind = 0, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.rotate(o.rot ?? 0);
  const body = () => {
    x.beginPath(); x.ellipse(0, 0, 4.4, 3.2, -0.45, 0, TAU);
    if (kind === 1) { x.moveTo(15.4, -4); x.ellipse(11, -4, 4.4, 3.2, -0.45, 0, TAU); }
    x.rect(2.6, -20, 1.9, 19);
    if (kind === 1) { x.rect(13.6, -24, 1.9, 19); x.moveTo(2.6, -20); x.lineTo(15.5, -24); x.lineTo(15.5, -19.5); x.lineTo(2.6, -15.5); x.closePath(); }
    else { x.moveTo(4.5, -20); x.bezierCurveTo(7, -15, 11, -14, 9.5, -7.5); x.bezierCurveTo(9, -11, 7, -13, 4.5, -14); x.closePath(); }
  };
  if (o.glow !== false) { blur(x, 5 * s, col); }
  body(); x.fillStyle = o.fill || lg(x, -4, -22, 8, 4, [[0, '#ffffff'], [0.35, shade(col, 0.5)], [1, col]]); x.fill();
  noBlur(x);
  if (o.outline !== false) { x.lineWidth = 0.9 / s; x.strokeStyle = rgba(shade(col, -0.75), 0.9); body(); x.stroke(); }
  x.restore();
}

// ------------------------------------------------------------------ metals & materials
export const METAL = {
  steel: ['#ffffff', '#c8d2de', '#7c8898', '#39414d', '#15191f'],
  gold: ['#fffbe0', '#ffd866', '#c48a22', '#6a4208', '#2a1a02'],
  bronze: ['#ffe8c8', '#d8995a', '#8e5424', '#452108', '#1c0c02'],
  brass: ['#fff4d0', '#e8c070', '#a87a2a', '#5a3a10', '#201204'],
  iron: ['#d9dde3', '#8d949e', '#4d535c', '#262a30', '#0e1013'],
  silver: ['#ffffff', '#e6ecf5', '#a4afbf', '#5b6574', '#232830'],
  dark: ['#b8b0c8', '#6c6480', '#3a344a', '#1c1826', '#08060c'],
  rose: ['#fff0ea', '#f4c0a8', '#c07a64', '#6a3428', '#2a100a'],
  crimson: ['#ffd0d0', '#e0606a', '#a01828', '#500810', '#1c0204'],
  obsidian: ['#a898b8', '#5a4a6a', '#2c2238', '#140e1c', '#050308'],
};
export function metal(m) { return typeof m === 'string' ? METAL[m] : m; }
/** Mirror-metal gradient across a direction. */
export function metalLG(x, x0, y0, x1, y1, m = 'steel') {
  const p = metal(m);
  return lg(x, x0, y0, x1, y1, [[0, p[3]], [0.16, p[1]], [0.32, p[0]], [0.5, p[2]], [0.78, p[3]], [1, p[4]]]);
}
/** Round metal (rivets, pommels, studs). */
export function metalRG(x, cx, cy, r, m = 'gold') {
  const p = metal(m);
  return rg(x, cx, cy, 0, r, [[0, p[0]], [0.35, p[1]], [0.75, p[2]], [1, p[3]]], cx - r * 0.35, cy - r * 0.4);
}
export function tintMetal(base, col, t) { return METAL[base].map((c, i) => mix(c, i < 1 ? '#ffffff' : shade(col, [-0.1, -0.2, -0.45, -0.7, -0.85][i] ?? -0.5), t)); }
export function rivet(x, cx, cy, r = 1.6, m = 'gold') { x.fillStyle = metalRG(x, cx, cy, r, m); circle(x, cx, cy, r); x.fill(); outline(x, 'rgba(0,0,0,.6)', 0.4); }

// ------------------------------------------------------------------ backgrounds
export function brush(x, R, n, cols, o = {}) {
  const ang = o.angle ?? -0.6, spread = o.spread ?? 0.7;
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const cx = R() * 116 - 8, cy = R() * 116 - 8;
    const a = ang + (R() - 0.5) * spread, len = (o.len ?? 26) * (0.45 + R()), w = (o.w ?? 7) * (0.35 + R());
    const dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2, bend = (R() - 0.5) * 0.6;
    x.strokeStyle = cols[(R() * cols.length) | 0];
    x.globalAlpha = (o.alpha ?? 0.12) * (0.35 + R());
    x.lineWidth = w;
    x.beginPath(); x.moveTo(cx - dx, cy - dy); x.quadraticCurveTo(cx - dy * bend, cy + dx * bend, cx + dx, cy + dy); x.stroke();
  }
  x.globalAlpha = 1;
}
/**
 * Square painted backdrop. pal = [light, mid, dark]. Light pools up-left of centre, corners fall to near-black,
 * with painterly strokes and a faint diagonal light shaft (the SEVENSHARD look).
 */
export function backdrop(x, R, pal, o = {}) {
  const cx = o.cx ?? 44, cy = o.cy ?? 40;
  x.fillStyle = pal[2]; x.fillRect(0, 0, 100, 100);
  x.fillStyle = rg(x, cx, cy, 0, o.r ?? 80, [[0, pal[0]], [o.mid ?? 0.38, pal[1]], [1, pal[2]]]);
  x.fillRect(0, 0, 100, 100);
  brush(x, R, o.n ?? 22, o.strokes || [pal[0], pal[1], shade(pal[2], 0.2)], { angle: o.angle ?? -0.75, alpha: o.alpha ?? 0.12, len: o.len ?? 34, w: o.w ?? 10 });
  if (o.shaft !== false) {
    const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
    x.fillStyle = lg(x, 0, 0, 70, 70, [[0, rgba(pal[0], 0.16)], [1, rgba(pal[0], 0)]]);
    poly(x, [[-5, 18], [18, -5], [60, 38], [38, 60]]); x.fill();
    x.globalCompositeOperation = pc;
  }
}

// ------------------------------------------------------------------ grain & finishes
let GRAIN = null;
export function grain() {
  if (GRAIN) return GRAIN;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true }), img = g.createImageData(S, S), R = rng(1337);
  const L = 9, lat = []; for (let i = 0; i < L * L; i++) lat.push(R());
  const at = (i, j) => lat[(((j % L) + L) % L) * L + (((i % L) + L) % L)];
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = (xx / S) * (L - 1), v = (y / S) * (L - 1), i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fu, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
    const low = a + (b - a) * fv;
    // diagonal canvas weave + blotches + fine grain
    const weave = Math.sin((xx + y) * 0.9) * 6 + Math.sin((xx - y) * 1.3) * 4;
    const val = 128 + (low - 0.5) * 64 + weave + (R() - 0.5) * 46;
    const k = (y * S + xx) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = val; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (GRAIN = c);
}
export function applyGrain(x, a = 0.5) {
  x.globalCompositeOperation = 'soft-light'; x.globalAlpha = a;
  x.drawImage(grain(), 0, 0, 100, 100);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
}
/** Square icon finish: grain, vignette, top-left sheen, inner bevel, dark border. */
export function finishSquare(x, o = {}) {
  applyGrain(x, o.grain ?? 0.5);
  const v = o.vignette ?? 0.6;
  if (v > 0) { x.fillStyle = rg(x, 46, 44, 24, 76, [[0, 'rgba(0,0,0,0)'], [0.6, `rgba(0,0,0,${v * 0.35})`], [1, `rgba(0,0,0,${v})`]]); x.fillRect(0, 0, 100, 100); }
  x.fillStyle = lg(x, 0, 0, 40, 60, [[0, 'rgba(255,250,235,.14)'], [1, 'rgba(255,250,235,0)']]); x.fillRect(0, 0, 100, 100);
  x.lineCap = 'butt';
  // inner bevel
  x.lineWidth = 1.6;
  x.strokeStyle = o.bevelLight ?? 'rgba(255,240,215,.34)'; poly(x, [[3.4, 96.6], [3.4, 3.4], [96.6, 3.4]], false); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,.55)'; poly(x, [[96.6, 3.4], [96.6, 96.6], [3.4, 96.6]], false); x.stroke();
  // accent line (grade / buff colour)
  if (o.accent) { x.lineWidth = 1.3; x.strokeStyle = o.accent; x.strokeRect(5.2, 5.2, 89.6, 89.6); }
  x.lineWidth = 3; x.strokeStyle = o.border ?? 'rgba(4,5,8,.95)'; x.strokeRect(1.5, 1.5, 97, 97);
  x.lineCap = 'round';
}
/** Circular emblem finish: clip away the corners, bevelled ring. ring = metal palette. */
export function finishRound(x, o = {}) {
  const r = o.r ?? 47;
  applyGrain(x, o.grain ?? 0.45);
  const v = o.vignette ?? 0.55;
  if (v > 0) { x.fillStyle = rg(x, 46, 44, r * 0.45, r, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${v})`]]); x.fillRect(0, 0, 100, 100); }
  x.fillStyle = lg(x, 20, 10, 55, 60, [[0, 'rgba(255,250,235,.16)'], [1, 'rgba(255,250,235,0)']]); circle(x, 50, 50, r); x.fill();
  // cut corners
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; circle(x, 50, 50, r + 0.2); x.fill();
  x.globalCompositeOperation = 'source-over';
  const m = metal(o.ring ?? 'gold'), rw = o.ringW ?? 4.2;
  if (rw > 0) {
    x.lineWidth = rw + 2; x.strokeStyle = 'rgba(0,0,0,.9)'; circle(x, 50, 50, r - rw / 2); x.stroke();
    x.lineWidth = rw; x.strokeStyle = lg(x, 10, 10, 90, 90, [[0, m[0]], [0.25, m[1]], [0.55, m[2]], [0.8, m[3]], [1, m[1]]]); circle(x, 50, 50, r - rw / 2 - 0.4); x.stroke();
    x.lineWidth = 0.7; x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(50, 50, r - rw + 0.2, PI * 1.05, PI * 1.6); x.stroke();
    x.lineWidth = 0.8; x.strokeStyle = 'rgba(0,0,0,.75)'; circle(x, 50, 50, r - rw - 0.6); x.stroke();
  }
  if (o.accent) { x.lineWidth = 1; x.strokeStyle = o.accent; circle(x, 50, 50, r - rw - 1.8); x.stroke(); }
}
