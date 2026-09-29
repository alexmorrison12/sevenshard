// Procedural FX textures, generated once at FX init (cached):
//   atlas   8×8 sprites of 128 px (RGBA8, mipmapped) — soft glows, sparks, smoke puffs, embers, shards, feathers, music
//           notes, leaves, rune rings, cracks, blades, chain links, afterimage silhouettes … authored as per-pixel
//           functions (x, y ∈ [-1, 1], y up → [luminance, alpha]) or stroked on a 2D canvas (masks).
//   ramps   colour/alpha-over-life LUT rows (RGBA16F, HDR) — the particle shader multiplies ramp × per-particle tint.
//   decals  4×4 cells of 512 px, single channel: radial crack, holy/arcane/demon circles, splatter, frost, music ring…
//           used as masks by the ground decal / telegraph shader.
import * as THREE from 'three';
import { Simplex, RNG, clamp, smoothstep } from '../core/noise.js';

export const CELL = 128, GRID = 8, ATLAS = CELL * GRID;

// ---------------------------------------------------------------- sprites
export const S = {};            // name → atlas index
const DEFS = [];
function def(name, fn, canvas = null) { S[name] = DEFS.length; DEFS.push({ name, fn, canvas }); }

const N = new Simplex(4242);
const fbm = (x, y, o = 3) => N.fbm2(x, y, o);
const edge = r => 1 - smoothstep(0.84, 0.99, r);
const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
const gauss = (v, w) => Math.exp(-(v * v) / (w * w));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function polyDist(x, y, pts) { let d = 9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, segDist(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1])); return d; }
function rays(x, y, len, w) { // 4 tapered rays along the axes
  const ax = Math.abs(x), ay = Math.abs(y);
  const a = Math.exp(-ax / (w * (1 - Math.min(ay / len, 1)) + 1e-3)) * Math.pow(Math.max(0, 1 - ay / len), 1.6);
  const b = Math.exp(-ay / (w * (1 - Math.min(ax / len, 1)) + 1e-3)) * Math.pow(Math.max(0, 1 - ax / len), 1.6);
  return a + b;
}

def('glow', (x, y, o) => { const r = Math.hypot(x, y); o[0] = 1; o[1] = (Math.exp(-r * r * 5.5) * 0.72 + Math.exp(-r * 3.2) * 0.28) * edge(r); });
def('flash', (x, y, o) => { const r = Math.hypot(x, y); o[0] = 1; o[1] = sat(Math.exp(-r * r * 30) * 0.85 + Math.exp(-r * r * 4) * 0.3 + Math.exp(-r * 3) * 0.12) * edge(r); });
def('dot', (x, y, o) => { const r = Math.hypot(x, y); o[0] = 1; o[1] = sat(smoothstep(0.6, 0.32, r) * 0.9 + Math.exp(-r * r * 5) * 0.3) * edge(r); });
def('spark', (x, y, o) => { // stretched along +y (head at the top, fading tail)
  const w = 0.12 + 0.12 * smoothstep(-1, 0.75, y);
  const body = gauss(x, w) * smoothstep(-1.0, 0.35, y) * smoothstep(0.98, 0.72, y);
  const head = Math.exp(-(x * x + (y - 0.7) * (y - 0.7)) * 28);
  o[0] = 1; o[1] = sat(body * 0.9 + head * 0.6);
});
def('star', (x, y, o) => {
  const r = Math.hypot(x, y), u = (x + y) * 0.7071, v = (x - y) * 0.7071;
  o[0] = 1; o[1] = sat(Math.exp(-r * r * 40) + rays(x, y, 0.98, 0.07) * 0.95 + rays(u, v, 0.5, 0.05) * 0.4 + Math.exp(-r * r * 7) * 0.25) * edge(r);
});
def('twinkle', (x, y, o) => { // thin 4-point glint
  const r = Math.hypot(x, y);
  o[0] = 1; o[1] = sat(Math.exp(-r * r * 60) + rays(x, y, 0.98, 0.03) * 1.1 + Math.exp(-r * r * 12) * 0.2) * edge(r);
});
def('holy', (x, y, o) => {
  const r = Math.hypot(x, y), u = (x + y) * 0.7071, v = (x - y) * 0.7071;
  o[0] = 1; o[1] = sat(Math.exp(-r * r * 18) * 0.9 + rays(x, y, 0.98, 0.16) * 0.9 + rays(u, v, 0.62, 0.08) * 0.45 + Math.exp(-r * r * 3.5) * 0.3) * edge(r);
});
def('ring', (x, y, o) => { const r = Math.hypot(x, y); o[0] = 1; o[1] = sat(gauss(r - 0.8, 0.055) + gauss(r - 0.8, 0.16) * 0.3) * edge(r); });
def('shock', (x, y, o) => {
  const r = Math.hypot(x, y);
  o[0] = 0.55 + 0.45 * smoothstep(0.6, 0.9, r);
  o[1] = sat(Math.pow(smoothstep(0.35, 0.86, r), 2.2) * (1 - smoothstep(0.87, 0.97, r)) * 1.1);
});
// billowy cloud: soft union of a few discs, eroded by low-frequency noise, lit from the top
function smoke(seed, lumpy = 0.28, holes = 0.45) {
  const R = new RNG(seed * 1000 | 0), blobs = [[0, -0.02, 0.64]];
  const n = 4 + Math.round(lumpy * 6);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R.range(-0.4, 0.4), r = R.range(0.26, 0.46); blobs.push([Math.cos(a) * r, Math.sin(a) * r * 0.85, R.range(0.36, 0.5)]); }
  return (x, y, o) => {
    let f = 0;
    for (const [bx, by, br] of blobs) { const d = ((x - bx) ** 2 + (y - by) ** 2) / (br * br); f += Math.exp(-d * 2.2); }
    const nz = fbm(x * 1.9 + seed * 3.1, y * 1.9 - seed, 3);
    const dens = smoothstep(0.18, 0.95, f * 0.9 + nz * holes * 0.6) * (0.78 + 0.22 * fbm(x * 3.5 + seed, y * 3.5, 2));
    let lit = 0;
    for (const [bx, by, br] of blobs) { const d = ((x - bx) ** 2 + (y - by - br * 0.35) ** 2) / (br * br); lit += Math.exp(-d * 2.6); }
    o[0] = clamp(0.5 + 0.38 * Math.min(1, lit) + 0.14 * y + 0.08 * nz, 0.3, 1);
    o[1] = sat(dens) * edge(Math.hypot(x, y));
  };
}
def('smoke1', smoke(1.3));
def('smoke2', smoke(5.7, 0.34, 0.55));
def('smoke3', smoke(9.1, 0.22, 0.7));
def('dust', smoke(13.7, 0.4, 0.8));
def('plume', smoke(21.3, 0.25, 0.35));
// flame lick: rounded base tapering into a curling tip, plus a smaller side lick
function flame(seed) {
  const side = seed > 5 ? -1 : 1;
  return (x, y, o) => {
    const cy = -0.42, rb = 0.52;
    const t = clamp((y - cy) / (0.98 - cy), 0, 1);
    const bend = (0.18 * Math.sin(t * 3.0 + seed) + 0.1 * fbm(y * 1.4 + seed, seed, 2)) * t * t;
    const xd = x - bend * side;
    let d;
    if (y < cy) d = Math.hypot(xd, (y - cy) * 1.1) / rb;
    else { const w = rb * Math.pow(1 - t, 0.8) * (1 - 0.2 * t) + 0.004; d = Math.abs(xd) / w; }
    const ts = clamp((y + 0.2) / 0.62, 0, 1), sx = x - side * (0.16 + 0.2 * ts * ts);
    const ws = 0.22 * Math.pow(1 - ts, 0.9) * smoothstep(-0.35, -0.1, y) + 0.004;
    d = Math.min(d, Math.abs(sx) / ws + (y > 0.42 ? 9 : 0) + (y < -0.3 ? 9 : 0));
    const n = fbm(x * 2.6 + seed * 2, y * 2.2 - seed * 1.3, 3);
    d += 0.18 * n * (0.5 + 0.5 * t);
    const a = smoothstep(1.0, 0.55, d) * smoothstep(0.99, 0.84, t);
    o[0] = clamp(1.12 - d * 0.55 - t * 0.3, 0.35, 1);
    o[1] = sat(a) * edge(Math.hypot(x, y) * 0.96);
  };
}
def('flame1', flame(2.1));
def('flame2', flame(7.4));
def('blob', (x, y, o) => { // billowy fire blob: bright core, lumpy soft rim
  const r = Math.hypot(x, y), ang = Math.atan2(y, x);
  const rr = r * (1 + 0.22 * fbm(Math.cos(ang) * 1.3 + 11, Math.sin(ang) * 1.3, 2)) + 0.12 * fbm(x * 2.2 + 3, y * 2.2, 3);
  o[0] = clamp(1.05 - rr * 0.75 + 0.12 * fbm(x * 3, y * 3 + 3, 2), 0.3, 1);
  o[1] = sat(smoothstep(0.9, 0.3, rr) * (0.82 + 0.25 * fbm(x * 2.6 + 5, y * 2.6, 3))) * edge(r);
});
def('snow', (x, y, o) => {
  const r = Math.hypot(x, y);
  let d = 9;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
    const u = x * c + y * s, v = -x * s + y * c;
    d = Math.min(d, segDist(u, v, 0, 0, 0.84, 0));
    for (const [p, l] of [[0.36, 0.26], [0.58, 0.17]]) d = Math.min(d, segDist(u, v, p, 0, p + l * 0.6, l * 0.8), segDist(u, v, p, 0, p + l * 0.6, -l * 0.8));
  }
  o[0] = 1; o[1] = sat(gauss(d, 0.05) + Math.exp(-r * r * 14) * 0.5 + gauss(d, 0.14) * 0.25) * edge(r);
});
const SHARD = [[0, 0.96], [0.3, 0.14], [0.17, -0.8], [0, -0.96], [-0.17, -0.8], [-0.3, 0.14]];
def('shard', (x, y, o) => {
  const inside = inPoly(x, y, SHARD), d = polyDist(x, y, SHARD);
  const facet = x > 0.02 * y ? 0.68 : 1.0;
  const ridge = gauss(x - 0.02 * y, 0.03) * 0.3;
  o[0] = inside ? clamp(facet + ridge + (1 - (y + 1) * 0.5) * 0.1, 0, 1) : 1;
  o[1] = inside ? sat(0.82 + gauss(d, 0.05) * 0.2) : sat(Math.exp(-d * 16) * 0.35);
});
def('leaf', (x, y, o) => {
  const t = (y + 0.82) / 1.66, xx = x - 0.07 * Math.sin(t * 3.2);
  const w = 0.42 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1))), 0.72) * (1 - 0.3 * t);
  let a = (t >= 0 && t <= 1) ? smoothstep(w, w - 0.05, Math.abs(xx)) : 0;
  if (y < -0.8 && y > -1 && Math.abs(x - 0.02) < 0.03) a = 1;
  const vein = 1 - 0.3 * gauss(xx, 0.03) - 0.15 * gauss((Math.abs(xx) * 1.4 - (t - 0.2)) % 0.28 - 0.1, 0.03) * (Math.abs(xx) < w * 0.9 ? 1 : 0);
  o[0] = clamp((0.78 + 0.22 * (xx / Math.max(w, 0.05))) * vein, 0.35, 1);
  o[1] = sat(a);
});
def('petal', (x, y, o) => {
  const t = (y + 0.85) / 1.7, w = 0.5 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1) * 0.92)), 0.6) * (1 - 0.15 * t);
  const notch = y > 0.72 ? gauss(x, 0.08) : 0;
  const a = t >= 0 && t <= 1 ? smoothstep(w, w - 0.06, Math.abs(x)) * (1 - notch) : 0;
  o[0] = clamp(0.7 + 0.3 * t + 0.1 * (1 - Math.abs(x) / Math.max(w, 0.05)), 0, 1); o[1] = sat(a);
});
def('feather', (x, y, o) => { // quill along y, barbed vanes, slight curve
  const t = (y + 0.95) / 1.9, cx = 0.12 * Math.sin(t * 2.4) - 0.05;
  const xx = x - cx;
  const w = 0.34 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t * 0.95 + 0.04, 0, 1))), 0.55) * (t < 0.15 ? t / 0.15 : 1);
  const side = xx > 0 ? 1 : -1;
  const barb = 0.82 + 0.18 * Math.sin((t * 40 - Math.abs(xx) * 22 * side) * 1.0);
  const nick = gauss(t - 0.62, 0.02) * (side > 0 ? 1 : 0) + gauss(t - 0.4, 0.015) * (side < 0 ? 1 : 0);
  let a = (t >= 0.08 && t <= 1) ? smoothstep(w, w - 0.05, Math.abs(xx)) * barb * (1 - nick * 0.9) : 0;
  const quill = t >= 0 && t <= 0.99 ? gauss(xx, 0.022) : 0;
  a = Math.max(a * 0.85, quill);
  o[0] = clamp(0.72 + 0.28 * (1 - Math.abs(xx) / 0.35) + quill * 0.2, 0, 1); o[1] = sat(a);
});
def('swirl', (x, y, o) => {
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const arm = Math.pow(sat(0.5 + 0.5 * Math.sin(3 * a + 7.5 * r)), 3);
  o[0] = 1; o[1] = sat(arm * smoothstep(0.95, 0.45, r) * smoothstep(0.02, 0.22, r) + Math.exp(-r * r * 30) * 0.6) * edge(r);
});
def('beam', (x, y, o) => { // vertical column, base at the bottom, fading upward (axis-Y billboards)
  const v = (y + 1) * 0.5;
  const prof = gauss(x, 0.13) * 0.85 + gauss(x, 0.45) * 0.45;
  o[0] = 1; o[1] = sat(prof * smoothstep(0, 0.07, v) * Math.pow(1 - v, 0.9)) * (1 - smoothstep(0.9, 0.99, Math.abs(x)));
});
def('column', (x, y, o) => { // full-height column (both ends soft) for pillars
  const v = (y + 1) * 0.5;
  const prof = gauss(x, 0.16) * 0.8 + gauss(x, 0.5) * 0.4;
  o[0] = 1; o[1] = sat(prof * smoothstep(0, 0.12, v) * smoothstep(1, 0.7, v)) * (1 - smoothstep(0.9, 0.99, Math.abs(x)));
});
def('rock', (x, y, o) => {
  const r = Math.hypot(x, y), ang = Math.atan2(y, x);
  const rad = 0.72 * (1 + 0.22 * fbm(Math.cos(ang) * 1.2 + 3, Math.sin(ang) * 1.2, 2) + 0.08 * Math.sin(ang * 5 + 1));
  o[0] = clamp(0.6 + 0.3 * (-x * 0.5 + y * 0.8) + 0.18 * fbm(x * 5, y * 5, 2), 0.2, 1);
  o[1] = smoothstep(rad, rad - 0.05, r);
});
def('drop', (x, y, o) => { // droplet, head at top (for stretched splashes)
  const head = Math.hypot(x, y - 0.45);
  const tail = y < 0.45 ? gauss(x, 0.25 * smoothstep(-1, 0.45, y)) * smoothstep(-1, 0.2, y) : 0;
  o[0] = clamp(0.75 + 0.35 * gauss(Math.hypot(x + 0.12, y - 0.58), 0.12), 0, 1);
  o[1] = sat(smoothstep(0.42, 0.3, head) + tail * 0.8);
});
def('bubble', (x, y, o) => {
  const r = Math.hypot(x, y);
  o[0] = 1; o[1] = sat(gauss(r - 0.72, 0.07) * 0.9 + (r < 0.72 ? 0.14 : 0) + gauss(Math.hypot(x + 0.28, y - 0.3), 0.13) * 0.9) * edge(r);
});
def('wisp', (x, y, o) => {
  const t = (y + 0.9) / 1.8, d = Math.abs(x - 0.32 * Math.sin(y * 2.9));
  const w = 0.19 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1))), 0.8);
  o[0] = 1; o[1] = t > 0 && t < 1 ? sat(gauss(d, w + 0.01) * smoothstep(0, 0.3, t)) : 0;
});
def('hex', (x, y, o) => {
  const d = Math.max(Math.abs(x) * 0.866 + Math.abs(y) * 0.5, Math.abs(y));
  o[0] = 1; o[1] = sat(gauss(d - 0.74, 0.045) + (d < 0.74 ? 0.1 : 0) + gauss(d - 0.74, 0.14) * 0.25) * edge(Math.hypot(x, y) * 0.9);
});
function crackField(x, y, cells, seed) {
  const gx = (x * 0.5 + 0.5) * cells, gy = (y * 0.5 + 0.5) * cells;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j;
    const h = Math.sin(cx * 127.1 + cy * 311.7 + seed) * 43758.5453, h2 = Math.sin(cx * 269.5 + cy * 183.3 + seed) * 43758.5453;
    const px = cx + (h - Math.floor(h)) * 0.85, py = cy + (h2 - Math.floor(h2)) * 0.85;
    const d = Math.hypot(gx - px, gy - py);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
def('crack', (x, y, o) => {
  const r = Math.hypot(x, y);
  const e = crackField(x + 0.08 * fbm(x * 3, y * 3, 2), y + 0.08 * fbm(x * 3 + 4, y * 3, 2), 5, 3.3);
  const line = gauss(e, 0.07 * (1 - r * 0.6)) + gauss(e, 0.2) * 0.25;
  o[0] = clamp(0.6 + 0.4 * gauss(e, 0.05), 0, 1); o[1] = sat(line * smoothstep(0.98, 0.45, r + 0.2 * fbm(x * 2, y * 2, 2)));
});
def('scorch', (x, y, o) => {
  const r = Math.hypot(x, y), rr = r + 0.3 * fbm(x * 2.1 + 3, y * 2.1, 3);
  o[0] = 0.3 + 0.2 * fbm(x * 6, y * 6, 2);
  o[1] = sat(smoothstep(0.92, 0.3, rr) * (0.72 + 0.35 * fbm(x * 5 + 1, y * 5, 3))) * edge(r);
});
def('flare', (x, y, o) => { // anamorphic streak + hot centre
  const r = Math.hypot(x, y);
  o[0] = 1; o[1] = sat(gauss(y, 0.045) * Math.pow(Math.max(0, 1 - Math.abs(x)), 1.4) + Math.exp(-r * r * 20) * 0.85 + Math.exp(-r * r * 3.5) * 0.18) * edge(Math.abs(x) * 0.98);
});
def('crescent', (x, y, o) => { // swoosh: head at +y, tail sweeps counter-clockwise ~250°
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  let d = (Math.PI / 2 - a); d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); d = Math.PI * 2 - d;
  const along = d < 4.4 ? Math.pow(1 - d / 4.4, 1.5) * smoothstep(0, 0.12, d) : 0;
  const inner = 0.9 - 0.3 * (d / 4.4);
  const band = smoothstep(inner - 0.25, inner, r) * smoothstep(0.97, 0.9, r);
  o[0] = clamp(0.5 + 0.5 * smoothstep(inner - 0.1, 0.93, r), 0, 1);
  o[1] = sat(band * along * 1.2);
});
def('cross', (x, y, o) => {
  const r = Math.hypot(x, y);
  const bar = (u, v, len, w) => gauss(u, w) * smoothstep(len, len - 0.2, Math.abs(v));
  o[0] = 1; o[1] = sat(Math.max(bar(x, y + 0.1, 0.95, 0.09), bar(y - 0.28, x, 0.55, 0.09)) + Math.exp(-r * r * 4) * 0.3) * edge(r);
});
def('plus', (x, y, o) => { // heal "+"
  const r = Math.hypot(x, y);
  const bar = (u, v) => smoothstep(0.2, 0.14, Math.abs(u)) * smoothstep(0.66, 0.6, Math.abs(v));
  const m = Math.max(bar(x, y), bar(y, x));
  o[0] = 1; o[1] = sat(m + Math.exp(-r * r * 3) * 0.35) * edge(r);
});
def('streak', (x, y, o) => { o[0] = 1; o[1] = sat(gauss(y, 0.07) * Math.pow(Math.max(0, Math.sin(Math.PI * (x + 1) / 2)), 1.5)); });
def('ember', (x, y, o) => { // small irregular hot fleck
  const r = Math.hypot(x * (1 + 0.3 * Math.sin(y * 3)), y);
  o[0] = 1; o[1] = sat(smoothstep(0.45, 0.2, r + 0.1 * fbm(x * 4, y * 4, 2)) + Math.exp(-r * r * 6) * 0.35) * edge(r);
});
def('ash', (x, y, o) => { // irregular dark flake
  const r = Math.hypot(x * 1.3, y * 0.8), ang = Math.atan2(y, x);
  const rad = 0.62 * (1 + 0.35 * fbm(Math.cos(ang) * 1.5 + 7, Math.sin(ang) * 1.5, 2));
  o[0] = clamp(0.6 + 0.4 * fbm(x * 4, y * 4, 2), 0, 1); o[1] = smoothstep(rad, rad - 0.08, r);
});
def('spike', (x, y, o) => { // vertical spike silhouette (axis-Y billboards)
  const t = (y + 1) * 0.5, w = 0.34 * (1 - t), d = Math.abs(x);
  o[0] = x > 0 ? 0.7 : 1; o[1] = sat(smoothstep(w, w - 0.04, d) + gauss(d - w, 0.06) * 0.3);
});
def('soft', (x, y, o) => { const r = Math.hypot(x, y); o[0] = 1; o[1] = sat(1 - r) ** 1.5 * edge(r); });
def('rays', (x, y, o) => { // sunburst
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const k = Math.pow(sat(0.5 + 0.5 * Math.cos(a * 12 + Math.sin(a * 5) * 0.8)), 6) * 0.8 + Math.pow(sat(0.5 + 0.5 * Math.cos(a * 7 + 1.3)), 10) * 0.6;
  o[0] = 1; o[1] = sat(k * smoothstep(1.0, 0.15, r) * smoothstep(0.0, 0.12, r) + Math.exp(-r * r * 12) * 0.9) * edge(r);
});
def('coin', (x, y, o) => {
  const r = Math.hypot(x * 1.0, y);
  const disc = smoothstep(0.78, 0.72, r), rim = gauss(r - 0.62, 0.05);
  const shine = gauss(x + y * 0.4 + 0.2, 0.12) * 0.5;
  o[0] = clamp(0.62 + shine + rim * 0.35 - (r < 0.5 ? 0.08 * fbm(x * 6, y * 6, 2) : 0), 0, 1); o[1] = sat(disc);
});
def('slashmark', (x, y, o) => { // single thin curved slash (crescent sliver) for thousand-cuts style spam
  const cy = -0.9, R0 = 1.65;
  const r = Math.hypot(x, y - cy), a = Math.atan2(x, y - cy);
  const t = clamp(0.5 + a / 1.2, 0, 1);
  const w = 0.09 * Math.pow(Math.sin(Math.PI * t), 1.2) + 0.004;
  const d = Math.abs(r - R0 + 0.15 * (t - 0.5) * (t - 0.5));
  o[0] = clamp(1 - d / (w + 0.02) * 0.4, 0.5, 1); o[1] = sat(smoothstep(w + 0.02, w * 0.4, d) + gauss(d, w * 3 + 0.02) * 0.25) * (Math.abs(a) < 0.62 ? 1 : 0);
});

// ---- canvas-stroked sprites (white on black → alpha mask)
function glyph(g, R, s) {
  g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s);
  const k = R.int(0, 3);
  if (k === 0) { g.moveTo(0, -s * 0.2); g.lineTo(s * 0.8, -s * 0.8); }
  if (k === 1) { g.moveTo(-s * 0.7, -s * 0.5); g.lineTo(s * 0.7, 0); g.lineTo(-s * 0.7, s * 0.5); }
  if (k === 2) { g.moveTo(0, 0); g.lineTo(s * 0.7, s * 0.6); g.moveTo(0, 0); g.lineTo(-s * 0.7, s * 0.6); }
  if (k === 3) { g.moveTo(-s * 0.6, -s); g.lineTo(s * 0.6, -s * 0.2); }
  g.stroke();
}
function glyphRing(g, R, c, rad, n, size) {
  g.lineWidth = 1.7;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    g.save(); g.translate(c + Math.cos(a) * rad, c + Math.sin(a) * rad); g.rotate(a + Math.PI / 2); glyph(g, R, size); g.restore();
  }
}
def('rune', null, (g, R) => {
  const c = 64;
  g.lineWidth = 3; g.beginPath(); g.arc(c, c, 58, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, 46, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.arc(c, c, 24, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + i * Math.PI * 2 / 3 - Math.PI / 2; const px = c + Math.cos(a) * 46, py = c + Math.sin(a) * 46; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  glyphRing(g, R, c, 52, 16, 5);
});
def('bolt', null, (g, R) => {
  const pts = [[64, 3]]; let x = 64;
  for (let i = 1; i < 12; i++) { x = clamp(x + R.range(-13, 13), 30, 98); pts.push([x, 3 + i * 11]); }
  pts.push([64, 125]);
  const path = (p, w) => { g.lineWidth = w; g.beginPath(); p.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); };
  g.shadowColor = '#fff'; g.shadowBlur = 8; path(pts, 3.2);
  for (const bi of [3, 7]) {
    const b = [pts[bi]]; let bx = pts[bi][0], by = pts[bi][1]; const dir = R.sign();
    for (let k = 0; k < 3; k++) { bx += dir * R.range(6, 13); by += R.range(7, 12); b.push([bx, by]); }
    path(b, 1.6);
  }
  g.shadowBlur = 0; path(pts, 1.4);
});
def('glyph1', null, (g, R) => { g.lineWidth = 7; g.shadowColor = '#fff'; g.shadowBlur = 10; g.translate(64, 64); glyph(g, R, 34); g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.stroke(); });
def('glyph2', null, (g, R) => { g.lineWidth = 7; g.shadowColor = '#fff'; g.shadowBlur = 10; g.translate(64, 64); glyph(g, R, 36); glyph(g, R, 24); });
def('note1', null, g => { // ♪ eighth note
  g.shadowColor = '#fff'; g.shadowBlur = 6;
  g.save(); g.translate(50, 94); g.rotate(-0.42); g.beginPath(); g.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.lineWidth = 7; g.beginPath(); g.moveTo(67, 88); g.lineTo(67, 16); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(67, 18); g.bezierCurveTo(84, 30, 100, 40, 90, 66); g.stroke();
});
def('note2', null, g => { // ♫ beamed pair
  g.shadowColor = '#fff'; g.shadowBlur = 6;
  for (const [x, y] of [[34, 100], [88, 88]]) { g.save(); g.translate(x, y); g.rotate(-0.42); g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(49, 95); g.lineTo(49, 28); g.moveTo(103, 83); g.lineTo(103, 16); g.stroke();
  g.lineWidth = 12; g.beginPath(); g.moveTo(47, 30); g.lineTo(105, 18); g.stroke();
});
def('link', null, g => { // chain link (oval ring, 3/4 view)
  g.lineWidth = 13; g.beginPath(); g.ellipse(64, 64, 26, 50, 0, 0, Math.PI * 2); g.stroke();
});
def('blade', null, g => { // small double-edged blade silhouette pointing up
  g.shadowColor = '#fff'; g.shadowBlur = 4;
  g.beginPath(); g.moveTo(64, 4); g.lineTo(78, 30); g.lineTo(74, 96); g.lineTo(54, 96); g.lineTo(50, 30); g.closePath(); g.fill();
  g.fillRect(40, 96, 48, 8); g.fillRect(59, 104, 10, 20);
});
def('claw', null, g => { // three parallel curved rakes
  g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  for (let i = 0; i < 3; i++) {
    const ox = 34 + i * 26;
    g.lineWidth = 11 - Math.abs(i - 1) * 2;
    g.beginPath(); g.moveTo(ox - 16, 116); g.quadraticCurveTo(ox + 14, 64, ox + 6, 10); g.stroke();
  }
});
def('skull', null, g => { // stylised screaming ghost face (fear)
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(64, 8); g.bezierCurveTo(112, 8, 118, 60, 100, 84); g.lineTo(96, 122); g.lineTo(80, 108); g.lineTo(64, 124); g.lineTo(48, 108); g.lineTo(32, 122); g.lineTo(28, 84); g.bezierCurveTo(10, 60, 16, 8, 64, 8); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0;
  g.beginPath(); g.ellipse(46, 56, 12, 16, 0.25, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(82, 56, 12, 16, -0.25, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(64, 92, 9, 14, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
});
def('wing', null, g => { // bat/demon wing silhouette (right wing, root at left)
  g.shadowColor = '#fff'; g.shadowBlur = 4;
  g.beginPath(); g.moveTo(8, 70); g.lineTo(60, 18); g.lineTo(122, 6); g.lineTo(112, 40);
  g.quadraticCurveTo(100, 50, 104, 68); g.quadraticCurveTo(84, 66, 80, 86); g.quadraticCurveTo(62, 80, 54, 104); g.quadraticCurveTo(36, 88, 8, 70); g.fill();
});
def('silhouette', null, g => { // lunging swordsman afterimage
  g.shadowColor = '#fff'; g.shadowBlur = 6;
  g.beginPath(); g.arc(70, 22, 11, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 20; g.beginPath(); g.moveTo(68, 36); g.lineTo(60, 70); g.stroke();              // torso
  g.lineWidth = 12; g.beginPath(); g.moveTo(60, 70); g.lineTo(84, 92); g.lineTo(92, 122); g.stroke(); // front leg
  g.beginPath(); g.moveTo(60, 70); g.lineTo(40, 96); g.lineTo(18, 112); g.stroke();                    // back leg
  g.lineWidth = 9; g.beginPath(); g.moveTo(68, 42); g.lineTo(90, 52); g.lineTo(106, 44); g.stroke();  // sword arm
  g.beginPath(); g.moveTo(66, 42); g.lineTo(44, 56); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(104, 45); g.lineTo(126, 16); g.stroke();                   // blade
});

// ---------------------------------------------------------------- ramps (colour + alpha over life)
export const R = {};
const RAMPS = [];
const RW = 64;
function ramp(name, keys) { R[name] = RAMPS.length; RAMPS.push(keys); }
// keys: [t, hex, alpha, intensity=1]
ramp('fire', [[0, 0xfff4c8, 0, 1.2], [0.07, 0xffd070, 1], [0.3, 0xff8e28, 0.95], [0.55, 0xff6a1c, 0.7, 0.85], [0.8, 0xb04a12, 0.3, 0.6], [1, 0x5a2008, 0, 0.4]]);
ramp('blast', [[0, 0xfff6d8, 0, 1.1], [0.06, 0xffe08a, 1], [0.22, 0xffa434, 0.95], [0.45, 0xf07a22, 0.55, 0.8], [0.7, 0x8a4414, 0.2, 0.5], [1, 0x301408, 0, 0.3]]);
ramp('fireCore', [[0, 0xffffff, 0], [0.08, 0xfff4d0, 1], [0.45, 0xffc050, 0.9], [1, 0xff7010, 0, 0.8]]);
ramp('ember', [[0, 0xfff2b0, 1], [0.3, 0xffb040, 1], [0.7, 0xff5a10, 0.85, 0.8], [1, 0x901804, 0, 0.5]]);
ramp('smoke', [[0, 0x3a3430, 0], [0.14, 0x453e3a, 0.55], [0.6, 0x55504c, 0.32], [1, 0x66625e, 0]]);
ramp('smokeLight', [[0, 0xd8d8d8, 0], [0.18, 0xc4c4c4, 0.42], [0.7, 0xb0b0b4, 0.2], [1, 0xa0a0a8, 0]]);
ramp('dust', [[0, 0xc8b090, 0], [0.12, 0xb09878, 0.55], [0.6, 0x9c8668, 0.3], [1, 0x8c7860, 0]]);
ramp('sand', [[0, 0xe8c890, 0], [0.1, 0xd8b47a, 0.7], [0.6, 0xc4a068, 0.4], [1, 0xb09060, 0]]);
ramp('frost', [[0, 0xffffff, 0], [0.07, 0xe8faff, 1], [0.4, 0x7ad0ff, 0.9], [1, 0x2050c0, 0, 0.8]]);
ramp('frostMist', [[0, 0xf0fbff, 0], [0.2, 0xd8f2ff, 0.38], [0.7, 0xc0e4f8, 0.18], [1, 0xb0d8f0, 0]]);
ramp('frostCore', [[0, 0xffffff, 0], [0.1, 0xf4fdff, 1], [0.5, 0xb8ecff, 0.9], [1, 0x60b8ff, 0]]);
ramp('arcane', [[0, 0xffffff, 0], [0.07, 0xffd8ff, 1], [0.4, 0xd860ff, 0.9], [1, 0x5a18c0, 0]]);
ramp('shadow', [[0, 0xf0d8ff, 0], [0.1, 0xb468ff, 1], [0.5, 0x7a28d0, 0.8], [1, 0x2a0860, 0]]);
ramp('shadowCore', [[0, 0xffffff, 0], [0.1, 0xf0d8ff, 1], [0.5, 0xc080ff, 0.9], [1, 0x6020c0, 0]]);
ramp('void', [[0, 0x1c0c2a, 0], [0.16, 0x140a22, 0.85], [0.6, 0x1a0c2a, 0.5], [1, 0x241034, 0]]);
ramp('demon', [[0, 0xffd0e0, 0], [0.08, 0xff4a6a, 1], [0.4, 0xc0103a, 0.85], [0.75, 0x60106a, 0.4], [1, 0x200830, 0]]);
ramp('holy', [[0, 0xffffff, 0], [0.07, 0xfffbe4, 1], [0.4, 0xffe07a, 0.9], [1, 0xffa028, 0]]);
ramp('holyWarm', [[0, 0xffffff, 0], [0.1, 0xfff0c0, 1], [0.6, 0xffc860, 0.7], [1, 0xff9020, 0]]);
ramp('nature', [[0, 0xffffff, 0], [0.1, 0xecffd8, 1], [0.5, 0x8cff64, 0.8], [1, 0x20a040, 0]]);
ramp('heal', [[0, 0xffffff, 0], [0.1, 0xeaffd8, 1], [0.5, 0x7cff8a, 0.85], [1, 0x20c060, 0]]);
ramp('poison', [[0, 0xf4ffa8, 0], [0.1, 0xc8ff48, 1], [0.5, 0x64d020, 0.8], [1, 0x1e6010, 0]]);
ramp('poisonMist', [[0, 0x90d048, 0], [0.2, 0x70b038, 0.42], [0.7, 0x508828, 0.2], [1, 0x305018, 0]]);
ramp('storm', [[0, 0xffffff, 0], [0.05, 0xe8f4ff, 1], [0.3, 0x88c4ff, 1], [1, 0x4848ff, 0]]);
ramp('stormCore', [[0, 0xffffff, 0], [0.08, 0xffffff, 1], [0.5, 0xc8e4ff, 0.9], [1, 0x7090ff, 0]]);
ramp('chi', [[0, 0xffffff, 0], [0.06, 0xf0ffff, 1], [0.35, 0x80e8ff, 0.9], [1, 0x2060ff, 0]]);
ramp('crimson', [[0, 0xfff0f0, 0, 1.2], [0.06, 0xff7070, 1], [0.35, 0xff1a2a, 0.9], [0.7, 0xa00818, 0.5], [1, 0x400008, 0]]);
ramp('lava', [[0, 0xffffa0, 1, 1.3], [0.2, 0xffa020, 1], [0.6, 0xe04008, 0.9, 0.8], [1, 0x401004, 0, 0.5]]);
ramp('spirit', [[0, 0xffffff, 0], [0.15, 0xd8faff, 0.9], [0.6, 0x90d0ff, 0.6], [1, 0x6090ff, 0]]);
ramp('ghost', [[0, 0xe8faff, 0], [0.2, 0xc8ecff, 0.8], [0.7, 0x98c8ff, 0.5], [1, 0x7090e0, 0]]);
ramp('foxfire', [[0, 0xffffff, 0], [0.08, 0xd8e8ff, 1], [0.4, 0x7a90ff, 0.9], [0.8, 0x7040e0, 0.4], [1, 0x301080, 0]]);
ramp('music', [[0, 0xffffff, 0], [0.1, 0xffe8f8, 1], [0.5, 0xff90d8, 0.85], [1, 0xa040ff, 0]]);
ramp('blood', [[0, 0xd01a14, 1], [0.6, 0x9a1010, 1], [1, 0x600808, 0]]);
ramp('water', [[0, 0xffffff, 0.9], [0.5, 0xd8f0ff, 0.7], [1, 0xb0d8f0, 0]]);
ramp('scorch', [[0, 0x0e0804, 0], [0.04, 0x0e0804, 0.85], [0.7, 0x0e0804, 0.6], [1, 0x0e0804, 0]]);
ramp('ash', [[0, 0x2a2624, 0], [0.1, 0x3a3432, 0.9], [0.8, 0x4a4442, 0.7], [1, 0x5a5452, 0]]);
ramp('fireSmokeWarm', [[0, 0xff7a30, 0, 1.4], [0.12, 0x6a4030, 0.6], [0.5, 0x3e3834, 0.4], [1, 0x4a4644, 0]]);
ramp('plume', [[0, 0xff8a40, 0, 1.5], [0.05, 0x9a6448, 0.75, 1], [0.18, 0x4e4644, 0.8], [0.5, 0x686260, 0.62], [0.8, 0x7c7874, 0.35], [1, 0x8a8682, 0]]);
ramp('venomGoo', [[0, 0x9ae830, 1], [0.6, 0x5aa018, 0.9], [1, 0x2a5008, 0]]);
ramp('enrage', [[0, 0xffd0c0, 0], [0.1, 0xff6040, 1], [0.5, 0xe01810, 0.8], [1, 0x600404, 0]]);
// white ramps (tinted per particle): envelope shapes only
ramp('wFade', [[0, 0xffffff, 1], [1, 0xffffff, 0]]);
ramp('wInOut', [[0, 0xffffff, 0], [0.15, 0xffffff, 1], [0.7, 0xffffff, 0.75], [1, 0xffffff, 0]]);
ramp('wFlash', [[0, 0xffffff, 1], [0.25, 0xffffff, 0.55], [1, 0xffffff, 0]]);
ramp('wPulse', [[0, 0xffffff, 0.72], [0.5, 0xffffff, 1], [1, 0xffffff, 0.72]]);
ramp('wLate', [[0, 0xffffff, 0], [0.5, 0xffffff, 1], [1, 0xffffff, 0]]);
ramp('wConst', [[0, 0xffffff, 1], [1, 0xffffff, 1]]);
ramp('wSolid', [[0, 0xffffff, 0], [0.06, 0xffffff, 1], [0.85, 0xffffff, 1], [1, 0xffffff, 0]]);
ramp('wBlink', [[0, 0xffffff, 0.05], [0.35, 0xffffff, 0.1], [0.45, 0xffffff, 1], [0.6, 0xffffff, 0.15], [1, 0xffffff, 0.05]]);
ramp('wHot', [[0, 0xffffff, 0, 1.3], [0.08, 0xffffff, 1, 1.2], [0.5, 0xffffff, 0.7, 0.8], [1, 0xffffff, 0, 0.5]]);
ramp('wQuick', [[0, 0xffffff, 0], [0.04, 0xffffff, 1], [0.3, 0xffffff, 0.8], [1, 0xffffff, 0]]);
export const WHITE_RAMPS = new Set([R.wFade, R.wInOut, R.wFlash, R.wPulse, R.wLate, R.wConst, R.wSolid, R.wBlink, R.wHot, R.wQuick]);

// ---------------------------------------------------------------- decal masks (4×4 × 512 px, single channel)
export const DCELL = 512, DGRID = 4;
export const D = {};
const DDEFS = [];
function ddef(name, fn) { D[name] = DDEFS.length; DDEFS.push({ name, fn }); }
function jag(g, R, x0, y0, ang, len, w, depth) { // recursive jagged crack
  let x = x0, y = y0, a = ang;
  const steps = Math.max(3, Math.round(len / 14));
  g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < steps; i++) {
    a += R.range(-0.45, 0.45); const st = len / steps;
    x += Math.cos(a) * st; y += Math.sin(a) * st; g.lineTo(x, y);
    if (depth > 0 && R.chance(0.22)) { g.stroke(); jag(g, R, x, y, a + R.sign() * R.range(0.5, 1.1), len * R.range(0.25, 0.5), w * 0.6, depth - 1); g.lineWidth = w * (1 - i / steps * 0.5); g.beginPath(); g.moveTo(x, y); }
  }
  g.stroke();
}
ddef('crack', (g, R, c) => { // radial fracture from the centre (impact craters, slams)
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  const n = 11;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R.range(-0.2, 0.2); jag(g, R, c + Math.cos(a) * 18, c + Math.sin(a) * 18, a, R.range(130, 235), R.range(5, 8), 2); }
  g.lineWidth = 3; for (let k = 0; k < 2; k++) { g.beginPath(); const rr = [70, 130][k]; for (let a = 0; a < Math.PI * 2; a += 0.3) { const r = rr + R.range(-10, 10); a ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke(); }
});
function runeCircle(g, R, c, style) {
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); };
  ring(246, 8); ring(214, 4); ring(128, 4); ring(70, 3);
  if (style === 'holy') {
    for (let i = 0; i < 8; i++) { // 8 rays / sword points
      const a = i / 8 * Math.PI * 2; g.lineWidth = i % 2 ? 3 : 5; g.beginPath();
      g.moveTo(c + Math.cos(a) * 70, c + Math.sin(a) * 70); g.lineTo(c + Math.cos(a) * (i % 2 ? 180 : 212), c + Math.sin(a) * (i % 2 ? 180 : 212)); g.stroke();
    }
    g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; const px = c + Math.cos(a) * 128, py = c + Math.sin(a) * 128; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    g.beginPath(); for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI * 2; const px = c + Math.cos(a) * 214, py = c + Math.sin(a) * 214; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    g.beginPath(); for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const px = c + Math.cos(a) * 214, py = c + Math.sin(a) * 214; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  } else if (style === 'arcane') {
    for (let k = 0; k < 2; k++) { g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + i * Math.PI * 2 / 3 - Math.PI / 2; const px = c + Math.cos(a) * 214, py = c + Math.sin(a) * 214; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; ringAt(g, c + Math.cos(a) * 170, c + Math.sin(a) * 170, 22); }
  } else if (style === 'demon') {
    for (let i = 0; i < 7; i++) { // 7-point spiked star
      const a0 = i / 7 * Math.PI * 2 - Math.PI / 2, a1 = ((i + 3) % 7) / 7 * Math.PI * 2 - Math.PI / 2;
      g.lineWidth = 4; g.beginPath(); g.moveTo(c + Math.cos(a0) * 214, c + Math.sin(a0) * 214); g.lineTo(c + Math.cos(a1) * 214, c + Math.sin(a1) * 214); g.stroke();
    }
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.lineWidth = 5; g.beginPath(); g.moveTo(c + Math.cos(a) * 246, c + Math.sin(a) * 246); g.lineTo(c + Math.cos(a + 0.07) * 272, c + Math.sin(a + 0.07) * 272); g.stroke(); }
  }
  g.lineWidth = 4;
  const n = style === 'demon' ? 20 : 28;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 230, c + Math.sin(a) * 230); g.rotate(a + Math.PI / 2); glyph(g, R, 11); g.restore(); }
  g.lineWidth = 3;
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 128, c + Math.sin(a) * 128); g.lineTo(c + Math.cos(a) * (i % 4 ? 138 : 150), c + Math.sin(a) * (i % 4 ? 138 : 150)); g.stroke(); }
}
function ringAt(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
ddef('holy', (g, R, c) => runeCircle(g, R, c, 'holy'));
ddef('arcane', (g, R, c) => runeCircle(g, R, c, 'arcane'));
ddef('demon', (g, R, c) => runeCircle(g, R, c, 'demon'));
ddef('splat', (g, R, c) => { // blood splatter
  g.beginPath(); g.arc(c, c, 90, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 26; i++) { const a = R.range(0, Math.PI * 2), r = R.range(60, 150), s = R.range(18, 48); g.beginPath(); g.ellipse(c + Math.cos(a) * r * 0.7, c + Math.sin(a) * r * 0.7, s, s * R.range(0.5, 1), a, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 40; i++) { const a = R.range(0, Math.PI * 2), r = R.range(120, 240), s = R.range(4, 14); g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, s, 0, Math.PI * 2); g.fill(); }
  g.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = R.range(0, Math.PI * 2); g.lineWidth = R.range(6, 12); g.beginPath(); g.moveTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100); g.lineTo(c + Math.cos(a) * R.range(170, 240), c + Math.sin(a) * R.range(170, 240)); g.stroke(); }
});
ddef('frost', (g, R, c) => { // branching frost dendrites
  g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 4;
  const branch = (x, y, a, len, w, d) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (d <= 0) return;
    for (let k = 1; k <= 3; k++) { const t = k / 4, px = x + (x2 - x) * t, py = y + (y2 - y) * t; branch(px, py, a + 0.9, len * 0.35, w * 0.6, d - 1); branch(px, py, a - 0.9, len * 0.35, w * 0.6, d - 1); }
  };
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R.range(-0.2, 0.2); branch(c, c, a, R.range(160, 230), 5, 2); }
});
ddef('music', (g, R, c) => { // staff-line ring with notes
  g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 4;
  for (let k = 0; k < 5; k++) { g.lineWidth = 3; g.beginPath(); g.arc(c, c, 170 + k * 14, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.1, r = 170 + R.int(0, 4) * 14;
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
    g.beginPath(); g.ellipse(0, 0, 11, 8, -0.4, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.beginPath(); g.moveTo(10, -2); g.lineTo(10, -40); g.stroke();
    g.restore();
  }
  g.lineWidth = 6; g.beginPath(); g.arc(c, c, 120, 0, Math.PI * 2); g.stroke();
});
ddef('bolt', (g, R, c) => { // branching lightning scorch
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + R.range(-0.3, 0.3); jag(g, R, c, c, a, R.range(150, 240), 5, 3); }
});
ddef('claw', (g, R, c) => {
  g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  for (let i = 0; i < 3; i++) { const ox = c - 90 + i * 90; g.lineWidth = 26 - Math.abs(i - 1) * 6; g.beginPath(); g.moveTo(ox - 60, c + 210); g.quadraticCurveTo(ox + 50, c, ox + 20, c - 220); g.stroke(); }
});
ddef('scorch', (g, R, c) => { // soft irregular burnt blotch
  const grd = g.createRadialGradient(c, c, 10, c, c, 250); grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#ddd'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(c, c, 250, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  for (let i = 0; i < 30; i++) { const a = R.range(0, Math.PI * 2), r = R.range(120, 220), s = R.range(20, 60); g.globalAlpha = 0.5; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, s, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
});
ddef('ring', (g, R, c) => { // crater rim: broken rocky ring
  g.lineCap = 'round';
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2 + R.range(-0.04, 0.04), r = R.range(150, 190); g.lineWidth = R.range(8, 26); g.beginPath(); g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); g.lineTo(c + Math.cos(a + 0.08) * (r + R.range(-12, 12)), c + Math.sin(a + 0.08) * (r + R.range(-12, 12))); g.stroke(); }
});
ddef('leaves', (g, R, c) => { // nature ring (heal zone)
  g.shadowColor = '#fff'; g.shadowBlur = 4; g.lineWidth = 5;
  ringAt(g, c, c, 238); ringAt(g, c, c, 200);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 219, c + Math.sin(a) * 219); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, 26, 11, 0.5, 0, Math.PI * 2); g.fill(); g.restore();
  }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.save(); g.translate(c, c); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(50, -60, 0, -150); g.quadraticCurveTo(-50, -60, 0, 0); g.lineWidth = 4; g.stroke(); g.restore(); }
});
ddef('sun', (g, R, c) => { // radiant sunburst (holy explosion scorch)
  g.shadowColor = '#fff'; g.shadowBlur = 10;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, L = i % 2 ? 150 : 240; g.lineWidth = i % 2 ? 6 : 12; g.beginPath(); g.moveTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L); g.stroke(); }
  g.lineWidth = 8; ringAt(g, c, c, 60);
});
ddef('cells', (g, R, c) => { // cracked earth voronoi network (quake)
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 3;
  const pts = []; for (let i = 0; i < 40; i++) pts.push([R.range(0, 512), R.range(0, 512)]);
  for (let y = 0; y < 512; y += 3) for (let x = 0; x < 512; x += 3) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) { const d = (x - px) ** 2 + (y - py) ** 2; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.sqrt(d2) - Math.sqrt(d1);
    if (e < 3.2) { g.globalAlpha = 1 - e / 3.2; g.fillRect(x, y, 3, 3); }
  }
  g.globalAlpha = 1;
});
ddef('swirl', (g, R, c) => { // spiral arms (void / black hole / portal floor)
  g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  for (let k = 0; k < 5; k++) {
    g.lineWidth = 10; g.beginPath();
    for (let t = 0; t <= 1; t += 0.02) { const a = k / 5 * Math.PI * 2 + t * 4.2, r = 20 + t * 230; t ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
    g.stroke();
  }
});
ddef('sigil', (g, R, c) => { // brand mark (targeted debuff): diamond + orbit ring + ticks
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  g.lineWidth = 10; ringAt(g, c, c, 200);
  g.lineWidth = 12; g.beginPath(); g.moveTo(c, c - 150); g.lineTo(c + 95, c); g.lineTo(c, c + 150); g.lineTo(c - 95, c); g.closePath(); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(c, c - 90); g.lineTo(c + 50, c); g.lineTo(c, c + 90); g.lineTo(c - 50, c); g.closePath(); g.stroke();
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.lineWidth = 10; g.beginPath(); g.moveTo(c + Math.cos(a) * 200, c + Math.sin(a) * 200); g.lineTo(c + Math.cos(a) * 245, c + Math.sin(a) * 245); g.stroke(); }
});

// ---------------------------------------------------------------- build (cached)
let cache = null;
export function buildTextures() {
  if (cache) return cache;
  const t0 = performance.now();
  // sprite atlas
  const data = new Uint8Array(ATLAS * ATLAS * 4);
  const out = [0, 0];
  const cv = document.createElement('canvas'); cv.width = cv.height = CELL;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const rng = new RNG(77);
  DEFS.forEach((d, idx) => {
    const cx = (idx % GRID) * CELL, cy = Math.floor(idx / GRID) * CELL;
    if (d.canvas) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.shadowBlur = 0; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#000'; g.fillRect(0, 0, CELL, CELL);
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      d.canvas(g, rng);
      const img = g.getImageData(0, 0, CELL, CELL).data;
      for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
        const s = ((CELL - 1 - py) * CELL + px) * 4;   // canvas y down → texture y up
        const k = ((cy + py) * ATLAS + cx + px) * 4;
        const border = Math.min(1, Math.min(px, CELL - 1 - px, py, CELL - 1 - py) / 3);
        data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = img[s] * border;
      }
      return;
    }
    for (let py = 0; py < CELL; py++) {
      const y = (py + 0.5) / CELL * 2 - 1;
      for (let px = 0; px < CELL; px++) {
        const x = (px + 0.5) / CELL * 2 - 1;
        d.fn(x, y, out);
        const k = ((cy + py) * ATLAS + cx + px) * 4;
        const border = Math.min(1, Math.min(px, CELL - 1 - px, py, CELL - 1 - py) / 3);
        const l = clamp(out[0], 0, 1) * 255, a = clamp(out[1] * border, 0, 1) * 255;
        data[k] = data[k + 1] = data[k + 2] = l; data[k + 3] = a;
      }
    }
  });
  if (DEFS.length > GRID * GRID) console.warn('[fx] sprite atlas overflow', DEFS.length);
  const atlas = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat);
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter;
  atlas.generateMipmaps = true; atlas.anisotropy = 4; atlas.needsUpdate = true;

  // ramps → RGBA16F
  const rows = RAMPS.length;
  const rd = new Uint16Array(RW * rows * 4);
  const ca = new THREE.Color(), cb = new THREE.Color();
  RAMPS.forEach((keys, row) => {
    for (let i = 0; i < RW; i++) {
      const t = i / (RW - 1);
      let k = 0; while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
      const A = keys[k], B = keys[k + 1] || A;
      const f = B[0] > A[0] ? clamp((t - A[0]) / (B[0] - A[0]), 0, 1) : 0;
      ca.set(A[1]); cb.set(B[1]); ca.lerp(cb, f);
      const inten = (A[3] ?? 1) + ((B[3] ?? 1) - (A[3] ?? 1)) * f;
      const al = A[2] + (B[2] - A[2]) * f;
      const o = (row * RW + i) * 4;
      rd[o] = THREE.DataUtils.toHalfFloat(ca.r * inten); rd[o + 1] = THREE.DataUtils.toHalfFloat(ca.g * inten);
      rd[o + 2] = THREE.DataUtils.toHalfFloat(ca.b * inten); rd[o + 3] = THREE.DataUtils.toHalfFloat(al);
    }
  });
  const ramps = new THREE.DataTexture(rd, RW, rows, THREE.RGBAFormat, THREE.HalfFloatType);
  ramps.minFilter = ramps.magFilter = THREE.LinearFilter; ramps.needsUpdate = true;

  // decal masks
  const DA = DCELL * DGRID;
  const dcv = document.createElement('canvas'); dcv.width = dcv.height = DCELL;
  const dg = dcv.getContext('2d', { willReadFrequently: true });
  const dd = new Uint8Array(DA * DA);
  const drng = new RNG(31);
  DDEFS.forEach((d, idx) => {
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.shadowBlur = 0; dg.globalAlpha = 1; dg.globalCompositeOperation = 'source-over';
    dg.fillStyle = '#000'; dg.fillRect(0, 0, DCELL, DCELL);
    dg.strokeStyle = '#fff'; dg.fillStyle = '#fff';
    d.fn(dg, drng, DCELL / 2);
    const img = dg.getImageData(0, 0, DCELL, DCELL).data;
    const cx = (idx % DGRID) * DCELL, cy = Math.floor(idx / DGRID) * DCELL;
    for (let py = 0; py < DCELL; py++) {
      const row = (cy + py) * DA + cx, src = (DCELL - 1 - py) * DCELL;
      for (let px = 0; px < DCELL; px++) {
        const b = Math.min(1, Math.min(px, DCELL - 1 - px, py, DCELL - 1 - py) / 4);
        dd[row + px] = img[(src + px) * 4] * b;
      }
    }
  });
  const decals = new THREE.DataTexture(dd, DA, DA, THREE.RedFormat, THREE.UnsignedByteType);
  decals.minFilter = THREE.LinearMipmapLinearFilter; decals.magFilter = THREE.LinearFilter;
  decals.generateMipmaps = true; decals.anisotropy = 8; decals.needsUpdate = true;

  cache = { atlas, ramps, rampRows: rows, rampW: RW, decals, ms: performance.now() - t0 };
  return cache;
}
export const SPRITE_NAMES = () => Object.keys(S);
