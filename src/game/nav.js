// Walkability grid for a zone: queries, collision-and-slide movement, line of sight, and A* with path smoothing.
// The world builds the grid (zone.nav = { cell, w, h, x0, z0, data: Uint8Array(1 = walkable) }).

export class NavGrid {
  constructor(nav) {
    this.cell = nav.cell; this.w = nav.w; this.h = nav.h; this.x0 = nav.x0; this.z0 = nav.z0; this.data = nav.data;
    this.inv = 1 / nav.cell;
    const n = this.w * this.h;
    this.g = new Float32Array(n); this.f = new Float32Array(n); this.from = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.run = 0; this.heap = new Int32Array(n); // binary heap of cell indices keyed by f
  }
  /** Flat open ground (for placeholder arenas): a disc or rectangle of walkable cells. */
  static open(size = 60, cell = 0.5, shape = 'square') {
    const w = Math.ceil(size / cell), h = w, data = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * cell - size / 2, z = (j + 0.5) * cell - size / 2;
      data[j * w + i] = shape === 'disc' ? (x * x + z * z < (size / 2 - 1) ** 2 ? 1 : 0) : (Math.abs(x) < size / 2 - 1 && Math.abs(z) < size / 2 - 1 ? 1 : 0);
    }
    return new NavGrid({ cell, w, h, x0: -size / 2, z0: -size / 2, data });
  }
  ci(x, z) { const i = Math.floor((x - this.x0) * this.inv), j = Math.floor((z - this.z0) * this.inv); return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i; }
  ok(x, z) { const k = this.ci(x, z); return k >= 0 && this.data[k] > 0; }
  /** walkable for a body of radius r (centre + 4 probes) */
  okR(x, z, r) { if (!this.ok(x, z)) return false; if (r < 0.2) return true; const q = r * 0.7; return this.ok(x + q, z) && this.ok(x - q, z) && this.ok(x, z + q) && this.ok(x, z - q); }
  center(k) { return { x: this.x0 + ((k % this.w) + 0.5) * this.cell, z: this.z0 + (Math.floor(k / this.w) + 0.5) * this.cell }; }

  /** Move by (dx, dz) with collision; slides along walls. Returns the new position in out. */
  move(x, z, dx, dz, r, out = { x: 0, z: 0, hit: false }) {
    const len = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    const sx = dx / steps, sz = dz / steps;
    out.hit = false;
    for (let s = 0; s < steps; s++) {
      if (this.okR(x + sx, z + sz, r)) { x += sx; z += sz; continue; }
      out.hit = true;
      if (this.okR(x + sx, z, r)) x += sx; else if (this.okR(x, z + sz, r)) z += sz; else break;
    }
    out.x = x; out.z = z; return out;
  }
  /** Straight segment clear of walls? (sampled at a third of a cell) */
  los(ax, az, bx, bz, r = 0) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (this.cell * 0.33)));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!(r ? this.okR(ax + (bx - ax) * t, az + (bz - az) * t, r) : this.ok(ax + (bx - ax) * t, az + (bz - az) * t))) return false; }
    return true;
  }
  /** Closest walkable point to (x, z) within maxR (spiral over cells). */
  nearest(x, z, maxR = 8, r = 0) {
    if (r ? this.okR(x, z, r) : this.ok(x, z)) return { x, z };
    const c = this.cell;
    for (let ring = 1; ring * c <= maxR; ring++) {
      let best = null, bd = Infinity;
      for (let a = 0; a < ring * 8; a++) {
        const ang = a / (ring * 8) * Math.PI * 2, px = x + Math.cos(ang) * ring * c, pz = z + Math.sin(ang) * ring * c;
        if (r ? this.okR(px, pz, r) : this.ok(px, pz)) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = { x: px, z: pz }; } }
      }
      if (best) return best;
    }
    return null;
  }
  /** A* (8-way, octile) → smoothed waypoint list [{x,z}…] ending at the goal (or the closest reachable point). */
  path(ax, az, bx, bz, r = 0.3, maxExpand = 40000) {
    if (this.los(ax, az, bx, bz, r)) return [{ x: bx, z: bz }];
    const goalP = this.nearest(bx, bz, 10, r) || { x: bx, z: bz };
    const s = this.ci(ax, az), gk = this.ci(goalP.x, goalP.z);
    if (s < 0 || gk < 0) return null;
    const W = this.w, run = ++this.run, g = this.g, f = this.f, from = this.from, stamp = this.stamp, closed = this.closed, heap = this.heap, data = this.data;
    const gx = gk % W, gz = (gk / W) | 0;
    const hfn = k => { const dx = Math.abs((k % W) - gx), dz = Math.abs(((k / W) | 0) - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    let hn = 0;
    const push = k => { let i = hn++; heap[i] = k; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[k]) break; heap[i] = heap[p]; heap[p] = k; i = p; } };
    const pop = () => { const top = heap[0], last = heap[--hn]; let i = 0; if (hn > 0) { heap[0] = last; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < hn && f[heap[l]] < f[heap[m]]) m = l; if (rr < hn && f[heap[rr]] < f[heap[m]]) m = rr; if (m === i) break; const t = heap[i]; heap[i] = heap[m]; heap[m] = t; i = m; } } return top; };
    stamp[s] = run; g[s] = 0; f[s] = hfn(s); from[s] = -1; push(s);
    let best = s, bestH = hfn(s), expanded = 0;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1], C = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    while (hn > 0 && expanded++ < maxExpand) {
      const k = pop();
      if (closed[k] === run) continue;
      closed[k] = run;
      if (k === gk) { best = k; break; }
      const h = hfn(k); if (h < bestH) { bestH = h; best = k; }
      const kx = k % W, kz = (k / W) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = kx + DX[d], nz = kz + DZ[d];
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const nk = nz * W + nx;
        if (!data[nk] || closed[nk] === run) continue;
        if (d >= 4 && (!data[kz * W + nx] || !data[nz * W + kx])) continue; // no corner cutting
        const ng = g[k] + C[d];
        if (stamp[nk] !== run || ng < g[nk]) { stamp[nk] = run; g[nk] = ng; f[nk] = ng + hfn(nk) * 1.001; from[nk] = k; push(nk); }
      }
    }
    const cells = [];
    for (let k = best; k >= 0 && cells.length < 4000; k = from[k]) { cells.push(k); if (k === s) break; }
    cells.reverse();
    const pts = cells.map(k => this.center(k));
    if (best === gk) pts.push(goalP); else if (!pts.length) return null;
    // string pulling
    const out = []; let cx = ax, cz = az, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.los(cx, cz, pts[j].x, pts[j].z, r)) j--;
      out.push(pts[j]); cx = pts[j].x; cz = pts[j].z; i = j + 1;
    }
    return out;
  }
}
