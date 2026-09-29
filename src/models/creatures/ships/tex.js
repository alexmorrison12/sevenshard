// Ship textures, generated in code once per session:
//   plankTex()      512² grey plank/grain detail (tiles; multiplied by the vertex paint in the wood shader)
//   new Atlas(S)    canvas sail atlas with a shelf packer; each sail/flag gets a region and a draw callback
import * as THREE from 'three';

// integer hash → [0,1)
export const hh = (a, b, s = 0) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
// periodic value noise (lattice units, periods px/py)
export function vnoise(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hh(x0, y0, s), b = hh(x1, y0, s), c = hh(x0, y1, s), d = hh(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ------------------------------------------------------------------------------------------------ planks
// 8 planks per tile (tile = TU × TV metres, see build.js). Row 0 is one long joint-free plank: spars, rails and
// ropes map into it (plain grain). Seams are dark grooves with a light lip, butt joints staggered, nails at joints.
let PLANK = null;
export function plankTex() {
  if (PLANK) return PLANK;
  const W = 512, H = 512, N = 8, ph = H / N;
  const data = new Uint8Array(W * H * 4);
  const joints = [];
  for (let k = 0; k < N; k++) {
    if (k === 0) { joints.push([]); continue; }
    const o = Math.floor(((k * 0.382 + 0.13) % 1) * W);
    joints.push([o, Math.floor((o + W * (0.42 + hh(k, 1) * 0.16)) % W)].sort((a, b) => a - b));
  }
  for (let y = 0; y < H; y++) {
    const k = Math.floor(y / ph), ly = y - k * ph, J = joints[k];
    for (let x = 0; x < W; x++) {
      let seg = 0;
      if (J.length) { seg = x >= J[0] && x < J[1] ? 1 : 2; }
      const base = 0.8 + (hh(k, seg, 7) - 0.5) * 0.2;
      // grain: long streaks along x (+ a finer octave), a little wave
      const wy = y + Math.sin(x / W * Math.PI * 2 * 3 + k) * 1.5;
      const g1 = vnoise(x / W * 10, wy / 3, 10, H / 3, 11 + k);
      const g2 = vnoise(x / W * 28, wy / 1.3, 28, 1e6, 23 + k);
      let t = base + (g1 - 0.5) * 0.16 + (g2 - 0.5) * 0.08;
      // knots (one per few segments)
      const kx = hh(k, seg, 31) * W, ky = k * ph + ph * (0.3 + hh(k, seg, 32) * 0.4);
      if (hh(k, seg, 33) < 0.45) {
        const dx = (x - kx) / 7, dy = (y - ky) / 4.2, r = Math.sqrt(dx * dx + dy * dy);
        if (r < 2.2) t *= 0.78 + 0.22 * Math.min(1, Math.abs(Math.sin(r * 4.2)) + r * 0.25);
      }
      // seams
      if (ly < 2) t *= 0.34; else if (ly === 2) t *= 1.12; else if (ly >= ph - 1) t *= 0.78;
      // butt joints + nails
      for (const j of J) {
        let dx = Math.abs(x - j); dx = Math.min(dx, W - dx);
        if (dx < 1.2) t *= 0.4; else if (dx < 2.2) t *= 0.82;
        for (const ny of [k * ph + 16, k * ph + 48]) for (const nx of [j - 6, j + 6]) {
          const d2 = (x - nx) ** 2 + (y - ny) ** 2;
          if (d2 < 3.2) t *= 0.45; else if (d2 < 6) t *= 0.85;
        }
      }
      const i = (y * W + x) * 4;
      const v = Math.max(0, Math.min(255, t * 255));
      data[i] = v; data[i + 1] = v * 0.985; data[i + 2] = v * 0.96; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8; tex.needsUpdate = true;
  return (PLANK = tex);
}

// ------------------------------------------------------------------------------------------------ sail atlas
/** Canvas atlas with shelf packing. region = alloc(w, h, draw(ctx, r)) → { x, y, w, h, uv(a, b) → [u, v] }
 *  (a across 0..1, b down 0..1 from the region's top edge). */
export class Atlas {
  constructor(size = 1024) {
    this.S = size;
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = size;
    this.g = this.cv.getContext('2d');
    this.x = 0; this.y = 0; this.rowH = 0; this.pad = 6;
  }
  alloc(w, h, draw) {
    const S = this.S, p = this.pad;
    if (this.x + w + p > S) { this.x = 0; this.y += this.rowH + p; this.rowH = 0; }
    const r = { x: this.x + p / 2, y: this.y + p / 2, w, h };
    this.x += w + p; this.rowH = Math.max(this.rowH, h);
    if (r.y + h > S) console.warn('ship atlas overflow');
    r.uv = (a, b) => [(r.x + 0.5 + a * (w - 1)) / S, 1 - (r.y + 0.5 + b * (h - 1)) / S];
    if (draw) { const g = this.g; g.save(); g.beginPath(); g.rect(r.x - 2, r.y - 2, w + 4, h + 4); g.clip(); g.translate(r.x, r.y); draw(g, w, h, r); g.restore(); }
    return r;
  }
  texture() {
    const t = new THREE.CanvasTexture(this.cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  }
}

// ------------------------------------------------------------------------------------------------ canvas cloth helpers
export const rgb = (hex, a = 1) => `rgba(${hex >> 16 & 255},${hex >> 8 & 255},${hex & 255},${a})`;

/** Sailcloth: base fill, vertical panel seams, faint horizontal weave, darker bolt-rope border, soft dirt toward the foot. */
export function cloth(g, w, h, o = {}) {
  const base = o.base ?? 0xf0e4c6, seam = o.seam ?? 0x000000, panels = o.panels ?? 9, rnd = o.seed ?? 1;
  g.fillStyle = rgb(base); g.fillRect(-2, -2, w + 4, h + 4);
  // per-panel tone variation
  for (let i = 0; i < panels; i++) {
    const x0 = i / panels * w, x1 = (i + 1) / panels * w;
    const t = hh(i, rnd, 5) - 0.5;
    g.fillStyle = t > 0 ? `rgba(255,255,255,${t * 0.12})` : `rgba(0,0,0,${-t * 0.1})`;
    g.fillRect(x0, 0, x1 - x0, h);
  }
  // weave streaks
  for (let i = 0; i < h; i += 3) { g.fillStyle = `rgba(0,0,0,${0.015 + hh(i, rnd, 9) * 0.03})`; g.fillRect(0, i, w, 1); }
  // seams (double stitch lines)
  g.strokeStyle = rgb(seam, o.seamA ?? 0.16); g.lineWidth = Math.max(1, w / 400);
  for (let i = 1; i < panels; i++) { const x = i / panels * w; g.beginPath(); g.moveTo(x - 1.5, 0); g.lineTo(x - 1.5, h); g.moveTo(x + 1.5, 0); g.lineTo(x + 1.5, h); g.stroke(); }
  // reef bands (horizontal doubled strips with reef points)
  for (const rb of o.reefs || []) {
    const y = rb * h; g.fillStyle = rgb(seam, 0.1); g.fillRect(0, y - 3, w, 6);
    g.fillStyle = rgb(o.point ?? 0x5a4a38, 0.8);
    for (let x = w / 24; x < w; x += w / 12) { g.fillRect(x - 1, y - 1, 2, 7 + hh(x | 0, rnd, 4) * 5); }
  }
  // dirt toward the foot, darker edges (bolt rope)
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.10)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(40,30,10,${o.dirt ?? 0.16})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (o.border !== false) { g.strokeStyle = rgb(o.borderCol ?? 0x6a5a40, 0.55); g.lineWidth = Math.max(2, w / 110); g.strokeRect(1, 1, w - 2, h - 2); }
}

/** Ragged cut-outs: torn foot / leech and holes (alpha). */
export function tatter(g, w, h, o = {}) {
  const rnd = o.seed ?? 3;
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  // torn bottom edge
  if (o.foot) {
    g.beginPath(); g.moveTo(-4, h + 4);
    const n = o.teeth ?? 14;
    for (let i = 0; i <= n; i++) {
      const x = i / n * w, d = (hh(i, rnd, 1) ** 1.6) * o.foot * h;
      g.lineTo(x - w / n * 0.35, h - d * 0.3); g.lineTo(x, h - d); g.lineTo(x + w / n * 0.3, h - d * 0.2);
    }
    g.lineTo(w + 4, h + 4); g.closePath(); g.fill();
  }
  // torn side edges
  for (const side of o.sides ? [0, 1] : []) {
    g.beginPath(); const x0 = side ? w + 4 : -4; g.moveTo(x0, -4);
    const n = 10;
    for (let i = 0; i <= n; i++) { const y = i / n * h, d = hh(i, rnd + side, 2) ** 2 * o.sides * w * (0.3 + i / n); g.lineTo(side ? w - d : d, y); }
    g.lineTo(x0, h + 4); g.closePath(); g.fill();
  }
  // holes: jagged polygons
  for (let k = 0; k < (o.holes ?? 0); k++) {
    const cx = (0.15 + hh(k, rnd, 3) * 0.7) * w, cy = (0.25 + hh(k, rnd, 4) * 0.65) * h;
    const r = (0.03 + hh(k, rnd, 5) * (o.holeR ?? 0.07)) * Math.min(w, h * 1.4);
    g.beginPath();
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, rr = r * (0.45 + hh(k * 13 + i, rnd, 6) * 0.9); g.lineTo(cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  g.restore();
}

/** Stitched patch (square-ish) with a darker border and cross stitches. */
export function patch(g, x, y, w, h, col, stitch = 0x2a2018, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = rgb(col); g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = rgb(stitch, 0.7); g.lineWidth = 1.5; g.setLineDash([3, 3]); g.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); g.setLineDash([]);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-w / 2, h / 2 - 3, w, 3);
  g.restore();
}
