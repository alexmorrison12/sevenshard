// Nav-grid rasteriser: walkable shapes minus obstacles (inflated by the hero radius), at 0.5 m cells.
//   const nav = new NavGrid(x0, z0, w, d, 0.5)
//   nav.walk(shape) / nav.block(shape, inflate) / nav.blockWhere((x, z) => bool)
//   nav.data  (Uint8Array, row-major, 1 = walkable)   nav.walkable(x, z)   nav.toContract()
import { clamp } from '../core/noise.js';

export class NavGrid {
  constructor(x0, z0, w, d, cell = 0.5) {
    this.cell = cell; this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil(w / cell); this.h = Math.ceil(d / cell);
    this.data = new Uint8Array(this.w * this.h);
  }
  _loop(shape, pad, fn) {
    const { cell, x0, z0, w, h } = this;
    const i0 = clamp(Math.floor((shape.box[0] - pad - x0) / cell), 0, w - 1), i1 = clamp(Math.ceil((shape.box[2] + pad - x0) / cell), 0, w - 1);
    const j0 = clamp(Math.floor((shape.box[1] - pad - z0) / cell), 0, h - 1), j1 = clamp(Math.ceil((shape.box[3] + pad - z0) / cell), 0, h - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * w + i, x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell);
  }
  /** mark cells whose centre is inside shape as walkable */
  walk(shape) { this._loop(shape, 0, (k, x, z) => { if (shape.sd(x, z) <= 0) this.data[k] = 1; }); return this; }
  /** mark cells within `inflate` metres of the shape as blocked */
  block(shape, inflate = 0.35) { this._loop(shape, inflate, (k, x, z) => { if (shape.sd(x, z) <= inflate) this.data[k] = 0; }); return this; }
  blockWhere(fn) {
    const { cell, x0, z0, w, h } = this;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; if (this.data[k] && fn(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) this.data[k] = 0; }
    return this;
  }
  walkable(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    return this.data[j * this.w + i] === 1;
  }
  /** Remove walkable islands not connected to (sx, sz) (keeps the playable area one piece). */
  keepConnected(seeds) {
    const { w, h, data } = this;
    const seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    for (const [x, z] of seeds) {
      const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const k = j * w + i; if (data[k] && !seen[k]) { seen[k] = 1; q[qt++] = k; }
    }
    while (qh < qt) {
      const k = q[qh++], i = k % w, j = (k / w) | 0;
      if (i > 0 && data[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; q[qt++] = k - 1; }
      if (i < w - 1 && data[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; q[qt++] = k + 1; }
      if (j > 0 && data[k - w] && !seen[k - w]) { seen[k - w] = 1; q[qt++] = k - w; }
      if (j < h - 1 && data[k + w] && !seen[k + w]) { seen[k + w] = 1; q[qt++] = k + w; }
    }
    for (let k = 0; k < w * h; k++) if (data[k] && !seen[k]) data[k] = 0;
    return this;
  }
  /** nearest walkable cell centre to (x, z) within r metres (for snapping anchors) */
  nearest(x, z, r = 6) {
    let best = null, bd = Infinity;
    const n = Math.ceil(r / this.cell);
    const ci = Math.floor((x - this.x0) / this.cell), cj = Math.floor((z - this.z0) / this.cell);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h || !this.data[j * this.w + i]) continue;
      const px = this.x0 + (i + 0.5) * this.cell, pz = this.z0 + (j + 0.5) * this.cell, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best;
  }
  toContract() { return { cell: this.cell, w: this.w, h: this.h, x0: this.x0, z0: this.z0, data: this.data }; }
}
