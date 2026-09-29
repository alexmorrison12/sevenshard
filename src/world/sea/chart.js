// The Glass Sea chart: one static description of the whole sea shared by the ocean zone, sailing and the map.
//   seabed height (continent coast with Solhaven's harbour, every island's terrain, reefs, sea stacks, sandbars),
//   a 2 m seabed raster (→ half-float texture: the ocean's depth colour & shore foam), a 4 m navigation grid for the
//   ship, and the painted nautical chart (minimap / world map canvas with names, rhumb lines and a compass rose).
//
//   const C = chart()   // built once, cached
//   C.height(x, z)      seabed / land height (bilinear on the raster)      C.exact(x, z) analytic
//   C.tex, C.xf         depth texture + (x0, z0, w, d) for the ocean       C.nav (world NavGrid, 4 m)
//   C.canvas            painted chart (C.mapArea = { x0, z0, size })       C.rocks [{ x, z, s, h }]
//   C.islands           [{ id, name, x, z, T, r, kind }]                   C.coastX(z) continent shoreline
import * as THREE from 'three';
import { RNG, clamp, smoothstep, lerp } from '../../core/noise.js';
import { NavGrid } from '../nav.js';
import { SEA_BOUNDS, ISLANDS, LANDMARKS, PORTS, STORMS, DANGER, SOLHAVEN_OFFSET } from '../../data/islands.js';
import { ISLE_TERRAIN } from './isles.js';
import { noise2, fbm2 } from './isle.js';

export const RES = 2;          // seabed raster (m per texel)
export const NAV_CELL = 4;     // ship navigation grid
export const SHIP_DRAFT = -2.2;

const sst = smoothstep;
const B = SEA_BOUNDS;
const SO = SOLHAVEN_OFFSET;

// ------------------------------------------------------------------------------------------------ continent
/** Valemont's shoreline: land lies west of coastX(z). Solhaven's quay (zone x = 62) is straight. */
export function coastX(z) {
  let x = -612 + 20 * Math.sin(z / 150 + 0.6) + 12 * Math.sin(z / 61 + 2.1) + 5 * noise2(z / 30, 3.7);
  // Solhaven: the quay wall between the NE bluff and the southern beach
  const q = SO.x + 62, t = sst(-70, -30, z) * (1 - sst(96, 132, z));
  x = lerp(x, q, t);
  return x;
}
function continent(x, z) {
  const cx = coastX(z), d = x - cx;                         // > 0 at sea
  // Solhaven (zone heights + 3: the zone's sea level −3 is the chart's 0): city 3, terrace 6, harbour promenade 1.5
  const zx = x - SO.x, zz = z - SO.z;
  const inCity = zx > -95 && zx < 62 && zz > -40 && zz < 92;
  if (d >= 0) {
    const harbour = sst(-40, -20, zz) * (1 - sst(80, 110, zz)) * (1 - sst(40, 70, d));
    let h = lerp(-1.2, -3.2, sst(0, 10, d)) + (-22 + 3.2) * sst(12, 90, d);
    h = lerp(h, Math.min(h, -6), harbour);
    // the breakwater and the lighthouse islet (zone [[70,70],[100,58]], islet (104, 56))
    const bw = segDist(zx, zz, 70, 70, 100, 58);
    h = Math.max(h, lerp(2.2, h, sst(3.2, 6.5, bw)));
    h = Math.max(h, lerp(2.6, h, sst(7, 12, Math.hypot(zx - 104, zz - 56))));
    return h;
  }
  const u = -d;
  if (inCity) {
    if (zx >= 46) return 1.5;
    return zz < -32 ? 6 : 3;
  }
  let h = Math.min(1.6, u * 0.2) + 5 * sst(10, 60, u) + 12 * sst(60, 160, u) * (0.6 + 0.4 * noise2(x / 80, z / 80));
  h += fbm2(x / 40, z / 40, 3) * 2.5 * sst(8, 30, u);
  // the keep hill north of the city, cliffs along the northern coast
  h += 9 * sst(-86 + SO.z, -130 + SO.z, z) * sst(-120 + SO.x, -60 + SO.x, x) * (1 - sst(50 + SO.x, 90 + SO.x, x));
  if (z < -120) h += 9 * sst(2, 14, u) * sst(-120, -200, z);
  return h;
}
function segDist(px, pz, ax, az, bx, bz) { const ex = bx - ax, ez = bz - az, t = clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez), 0, 1); return Math.hypot(px - ax - ex * t, pz - az - ez * t); }

// ------------------------------------------------------------------------------------------------ rocks & reefs
function makeRocks() {
  const rng = new RNG(4242), out = [];
  const add = (x, z, s, h) => out.push({ x, z, s, h, seed: rng.int(1, 1e6) });
  // the Serpent's Teeth: a field of sea stacks
  const T = DANGER.find(d => d.id === 'teeth');
  for (let i = 0; i < 34; i++) { const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * T.r * 0.9; add(T.x + Math.cos(a) * r, T.z + Math.sin(a) * r, rng.range(1.6, 4.2), rng.range(3, 11)); }
  // scattered stacks and reef crowns across the sea (kept clear of ports, islands and the coast)
  let tries = 0;
  while (out.length < 110 && tries++ < 4000) {
    const x = rng.range(B.x0 + 40, B.x1 - 30), z = rng.range(B.z0 + 30, B.z1 - 30);
    if (x < coastX(z) + 60) continue;
    if ([...ISLANDS, ...LANDMARKS].some(I => Math.hypot(x - I.x, z - I.z) < (I.r || 60) + 55)) continue;
    if (Object.values(PORTS).some(p => Math.hypot(x - p.x, z - p.z) < 70)) continue;
    const cl = rng.int(1, 4);
    for (let k = 0; k < cl; k++) add(x + rng.range(-9, 9), z + rng.range(-9, 9), rng.range(1.2, 3.4), rng.range(1.5, 6.5));
  }
  // rocks along the edges of the chart (the Glass Sea's rim)
  for (let i = 0; i < 70; i++) {
    const side = i % 3, t = rng.next();
    const x = side === 0 ? lerp(B.x0 + 120, B.x1 - 20, t) : B.x1 - rng.range(8, 30);
    const z = side === 0 ? (rng.chance(0.5) ? B.z0 + rng.range(8, 26) : B.z1 - rng.range(8, 26)) : lerp(B.z0 + 20, B.z1 - 20, t);
    add(x, z, rng.range(2.5, 6), rng.range(5, 16));
  }
  return out;
}
/** reef flats (turquoise shallows the ship can cross slowly… no: they block): { x, z, r } */
function makeReefs() {
  const rng = new RNG(99), out = [];
  const T = DANGER.find(d => d.id === 'teeth');
  for (let i = 0; i < 6; i++) out.push({ x: T.x + rng.range(-90, 90), z: T.z + rng.range(-80, 80), r: rng.range(12, 22) });
  out.push({ x: -250, z: 380, r: 26 }, { x: 150, z: 200, r: 20 }, { x: 320, z: -120, r: 18 }, { x: -120, z: -420, r: 24 }, { x: 480, z: 470, r: 22 });
  return out;
}

// ------------------------------------------------------------------------------------------------ the chart
let CHART = null;
export function chart() {
  if (CHART) return CHART;
  const t0 = performance.now();
  const islands = [
    ...ISLANDS.map(I => ({ id: I.id, name: I.name, x: I.x, z: I.z, T: ISLE_TERRAIN[I.id], kind: 'island', night: !!I.night })),
    ...LANDMARKS.map(L => ({ id: L.id, name: L.name, x: L.x, z: L.z, T: ISLE_TERRAIN[L.id], kind: L.kind })),
  ].filter(I => I.T);
  const rocks = makeRocks(), reefs = makeReefs();
  // spatial buckets for rocks (64 m)
  const RB = new Map(), rk = (i, j) => i * 4099 + j;
  for (const r of rocks) { const k = rk(Math.floor(r.x / 64), Math.floor(r.z / 64)); if (!RB.has(k)) RB.set(k, []); RB.get(k).push(r); }
  function exact(x, z) {
    let h = continent(x, z);
    if (h < 2) h = Math.max(h, -22 - 4 * (noise2(x / 140, z / 140) * 0.5 + 0.5) + fbm2(x / 60, z / 60, 2) * 1.5);
    for (const I of islands) {
      const dx = x - I.x, dz = z - I.z;
      if (dx * dx + dz * dz > I.T.radius * I.T.radius) continue;
      h = Math.max(h, I.T.height(dx, dz));
    }
    for (const R of reefs) { const d = Math.hypot(x - R.x, z - R.z); if (d < R.r + 18) h = Math.max(h, lerp(-0.7 + noise2(x / 5, z / 5) * 0.5, h, sst(R.r * 0.6, R.r + 18, d))); }
    const i0 = Math.floor(x / 64), j0 = Math.floor(z / 64);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const a = RB.get(rk(i, j)); if (!a) continue;
      for (const r of a) { const d = Math.hypot(x - r.x, z - r.z); if (d < r.s * 3.2) h = Math.max(h, lerp(-1.2, h, sst(r.s * 1.1, r.s * 3.2, d))); }
    }
    return h;
  }
  // raster
  const W = Math.round((B.x1 - B.x0) / RES) + 1, H = Math.round((B.z1 - B.z0) / RES) + 1;
  const data = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) data[j * W + i] = exact(B.x0 + i * RES, B.z0 + j * RES);
  const half = new Uint16Array(W * H);
  for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(data[k]);
  const tex = new THREE.DataTexture(half, W, H, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const xf = new THREE.Vector4(B.x0 - RES * 0.5, B.z0 - RES * 0.5, W * RES, H * RES);
  function height(x, z) {
    const fx = clamp((x - B.x0) / RES, 0, W - 1.001), fz = clamp((z - B.z0) / RES, 0, H - 1.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * W + i;
    return lerp(lerp(data[k], data[k + 1], tx), lerp(data[k + W], data[k + W + 1], tx), tz);
  }
  // navigation: water deep enough for a hull, inside the chart
  const nav = new NavGrid(B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0, NAV_CELL);
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const x = B.x0 + (i + 0.5) * NAV_CELL, z = B.z0 + (j + 0.5) * NAV_CELL;
    let ok = x > B.x0 + 6 && x < B.x1 - 6 && z > B.z0 + 6 && z < B.z1 - 6;
    if (ok) { const q = NAV_CELL * 0.4; ok = Math.max(height(x, z), height(x + q, z), height(x - q, z), height(x, z + q), height(x, z - q)) < SHIP_DRAFT; }
    nav.data[j * nav.w + i] = ok ? 1 : 0;
  }
  nav.keepConnected([[PORTS.solhaven.x, PORTS.solhaven.z]]);
  // make sure every port is reachable water
  for (const p of Object.values(PORTS)) {
    const i = Math.floor((p.x - B.x0) / NAV_CELL), j = Math.floor((p.z - B.z0) / NAV_CELL);
    if (!nav.data[j * nav.w + i]) console.warn('[chart] port on land/shallows', p.id, height(p.x, p.z).toFixed(1));
  }
  CHART = { bounds: B, res: RES, w: W, h: H, data, tex, xf, height, exact, nav, rocks, reefs, islands, coastX, continent, build: 0 };
  CHART.canvas = paintChart(CHART);
  CHART.mapArea = { x0: B.x0, z0: B.z0 - (B.x1 - B.x0 - (B.z1 - B.z0)) / 2, size: B.x1 - B.x0 };
  CHART.build = Math.round(performance.now() - t0);
  return CHART;
}

// ------------------------------------------------------------------------------------------------ painted chart
const SEA_DEEP = [22, 58, 92], SEA_MID = [34, 92, 124], SEA_SHALLOW = [74, 168, 172], SAND = [214, 196, 146], GRASS = [104, 138, 76], ROCK = [120, 112, 104], HIGH = [150, 150, 118];
function paintChart(C) {
  const size = C.bounds.x1 - C.bounds.x0;                 // square canvas over the whole width (map windows are square)
  const px = 1536, mpp = size / px;
  const x0 = C.bounds.x0, z0 = C.bounds.z0 - (size - (C.bounds.z1 - C.bounds.z0)) / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(px, px), d = img.data;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const x = x0 + (i + 0.5) * mpp, z = z0 + (j + 0.5) * mpp, k = (j * px + i) * 4;
    const inB = z >= C.bounds.z0 && z <= C.bounds.z1;
    const h = inB ? C.height(x, z) : -24;
    let c;
    if (h < 0) {
      const dep = -h;
      c = mix(SEA_SHALLOW, SEA_MID, sst(0.5, 6, dep)); c = mix(c, SEA_DEEP, sst(8, 22, dep));
      // contour lines every few metres of depth
      const cl = Math.abs(((dep + 1) % 6) - 3); if (dep > 2 && dep < 20 && cl < 0.18) c = mix(c, [200, 220, 220], 0.18);
      const n = noise2(x / 50, z / 50) * 6; c = [c[0] + n, c[1] + n, c[2] + n];
    } else {
      const e = 1.2, sl = Math.hypot(C.height(x + e, z) - C.height(x - e, z), C.height(x, z + e) - C.height(x, z - e)) / (2 * e);
      c = h < 1.2 ? SAND : mix(GRASS, HIGH, sst(8, 20, h));
      if (sl > 0.7) c = mix(c, ROCK, sst(0.7, 1.2, sl));
      const shade = clamp(1 + (C.height(x - 2, z - 2) - C.height(x + 2, z + 2)) * 0.12, 0.7, 1.25);
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
    }
    if (!inB) c = mix(c, [10, 22, 34], 0.6);
    d[k] = clamp(c[0], 0, 255); d[k + 1] = clamp(c[1], 0, 255); d[k + 2] = clamp(c[2], 0, 255); d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const W = (x, z) => [(x - x0) / mpp, (z - z0) / mpp];
  // coast ink: darken pixels at the waterline
  {
    const im = ctx.getImageData(0, 0, px, px), o = im.data;
    const land = new Uint8Array(px * px);
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) { const x = x0 + (i + 0.5) * mpp, z = z0 + (j + 0.5) * mpp; land[j * px + i] = z >= C.bounds.z0 && z <= C.bounds.z1 && C.height(x, z) >= 0 ? 1 : 0; }
    for (let j = 1; j < px - 1; j++) for (let i = 1; i < px - 1; i++) {
      const k = j * px + i; if (!land[k]) continue;
      if (!land[k - 1] || !land[k + 1] || !land[k - px] || !land[k + px]) { o[k * 4] *= 0.35; o[k * 4 + 1] *= 0.33; o[k * 4 + 2] *= 0.3; }
    }
    ctx.putImageData(im, 0, 0);
  }
  // rhumb lines from a compass rose
  const rose = W(-40, 470);
  ctx.save(); ctx.strokeStyle = 'rgba(230, 214, 170, 0.12)'; ctx.lineWidth = 1;
  for (let a = 0; a < 32; a++) { const ang = a / 32 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(rose[0], rose[1]); ctx.lineTo(rose[0] + Math.cos(ang) * px * 1.5, rose[1] + Math.sin(ang) * px * 1.5); ctx.stroke(); }
  ctx.restore();
  drawRose(ctx, rose[0], rose[1], px * 0.05);
  // storms & mists (hatched swirls), pirate waters
  for (const S of STORMS) {
    const [u, v] = W(S.x, S.z), r = S.r / mpp;
    ctx.save(); ctx.globalAlpha = S.kind === 'mist' ? 0.16 : 0.22; ctx.strokeStyle = S.kind === 'mist' ? '#dfe8f0' : '#1a1e2a'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 2 * 2.2 + i * 1.25, rr = r * (0.2 + 0.8 * t); const X = u + Math.cos(a) * rr, Y = v + Math.sin(a) * rr; t ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); }
    ctx.restore();
  }
  // island & landmark names
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = (text, x, z, sz = 22, col = '#f3e6c4', sub = null) => {
    const [u, v] = W(x, z);
    ctx.font = `600 ${sz}px Georgia, 'Times New Roman', serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12, 18, 26, 0.85)'; ctx.strokeText(text, u, v); ctx.fillStyle = col; ctx.fillText(text, u, v);
    if (sub) { ctx.font = `italic ${Math.round(sz * 0.62)}px Georgia, serif`; ctx.lineWidth = 3; ctx.strokeText(sub, u, v + sz * 0.9); ctx.fillStyle = 'rgba(243, 230, 196, 0.8)'; ctx.fillText(sub, u, v + sz * 0.9); }
  };
  for (const I of ISLANDS) label(I.name, I.x, I.z + (I.r || 50) + 34, 20, '#f6e7c0');
  for (const L of LANDMARKS) label(L.name, L.x, L.z + (L.r || 50) + 30, 19, '#e8f0d8');
  label('SOLHAVEN', PORTS.solhaven.x - 70, PORTS.solhaven.z - 120, 26, '#fff2cc', 'Valemont');
  label('The Maelstrom', 600, 30 - 150, 18, '#c8d0e8');
  label('Blackgull Waters', 250, -470, 17, '#e0b0a0');
  label('The Serpent’s Teeth', 230, -40, 16, '#bfe0d0');
  label('The Glass Deep', 180, 520, 16, '#a8d0e8');
  label('THE GLASS SEA', 20, 150, 34, 'rgba(243, 230, 196, 0.55)');
  // vignette
  const vg = ctx.createRadialGradient(px / 2, px / 2, px * 0.35, px / 2, px / 2, px * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, px, px);
  return cv;
}
function drawRose(ctx, u, v, r) {
  ctx.save(); ctx.translate(u, v);
  ctx.strokeStyle = 'rgba(243, 230, 196, 0.7)'; ctx.fillStyle = 'rgba(243, 230, 196, 0.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 - Math.PI / 2, L = i % 2 ? r * 0.62 : r * 1.12, w = i % 2 ? r * 0.08 : r * 0.13;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(243, 230, 196, 0.5)' : 'rgba(243, 230, 196, 0.85)'; ctx.fill();
  }
  ctx.font = `bold ${Math.round(r * 0.36)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f6e7c0';
  ctx.fillText('N', 0, -r * 1.3);
  ctx.restore();
}
