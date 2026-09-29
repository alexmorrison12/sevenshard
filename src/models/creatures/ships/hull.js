// Parametric lofted hull. Stations u ∈ [0 stern, 1 bow], heights y (metres, waterline y = 0). Bow faces −Z.
//   hb(y, u)   outer half-breadth           zAt(u, y)  station z at height y (raked stem / counter stern)
//   deckAt(u)  deck level (piecewise: quarterdeck, main deck, forecastle)   railY(u)  bulwark top (swept at the breaks)
//   frame(u, y, side) → { o, T, U, N } point on the side with tangent (bow-ward), up and outward normal
// buildHull(wb, H, paint) adds the outer shell, transom, decks, inner bulwarks, rail caps and bulkheads to a WoodBuilder.
import * as THREE from 'three';
import { lerp, clamp01, smooth, gridGeo, TU, TV, GV0, GV1, V3 } from './build.js';

export function makeHull(c) {
  const H = { c };
  const L = c.L, B = c.B, keel = c.keel;
  const zS = L / 2 + (c.zOff || 0), zB = -L / 2 + (c.zOff || 0);
  const decks = c.decks;
  const dy = (d, u) => (typeof d.y === 'function' ? d.y(u) : d.y);
  H.decks = decks;
  H.deckAt = u => { for (const d of decks) if (u <= d.u1 + 1e-6) return dy(d, u); return dy(decks[decks.length - 1], u); };
  H.seg = u => { for (const d of decks) if (u <= d.u1 + 1e-6) return d; return decks[decks.length - 1]; };
  const bl = c.railBlend ?? 0.07;
  H.railBase = u => {
    let y = H.deckAt(u);
    for (let i = 0; i < decks.length - 1; i++) {
      const a = decks[i], b = decks[i + 1], ub = a.u1, ya = dy(a, u), yb = dy(b, u);
      if (ya > yb) { if (u > ub - 0.012 && u < ub + bl) y = lerp(ya, yb, smooth(ub - 0.012, ub + bl, u)); }
      else if (u > ub - bl && u < ub + 0.012) y = lerp(ya, yb, smooth(ub - bl, ub + 0.012, u));
    }
    return y;
  };
  H.railY = u => H.railBase(u) + c.bulwark + (c.railExtra ? c.railExtra(u) : 0);
  const yT0 = H.railY(0), yT1 = H.railY(1);
  H.zStern = y => {
    const yK = c.knuckle;
    if (y >= yK) return zS - (yT0 - y) * c.transomRake;
    const zK = zS - (yT0 - yK) * c.transomRake;
    const t = clamp01((yK - y) / (yK - keel));
    return zK - c.sternRake * Math.pow(t, c.sternCurve ?? 0.7);
  };
  H.zBow = y => { const q = clamp01((y - keel) / (yT1 - keel)); return zB + c.bowRake * Math.pow(1 - q, c.bowCurve ?? 2); };
  H.zAt = (u, y) => lerp(H.zStern(y), H.zBow(y), u);
  H.sf = (y, u) => {
    const yw = c.yw;
    if (y <= yw) { const r = clamp01((yw - y) / (yw - keel)); return Math.pow(Math.max(0, 1 - Math.pow(r, c.bilge)), 1 / c.bilge); }
    const r = clamp01((y - yw) / Math.max(0.6, H.railY(u) - yw)); return 1 - c.tumble * Math.pow(r, 1.5);
  };
  H.pf = (u, y) => {
    const m = c.maxU;
    if (u >= m) {
      const r = clamp01((u - m) / (1 - m));
      const pb = lerp(c.bowFull[0], c.bowFull[1], smooth(keel, yT1, y));
      return Math.pow(Math.max(0, 1 - Math.pow(r, pb)), (c.bowSharp ?? 1) / pb);
    }
    const r = clamp01((m - u) / m);
    const base = Math.pow(Math.max(0, 1 - Math.pow(r, c.sternFull)), 1 / c.sternFull);
    const tw = c.transom * smooth(c.knuckle - c.transomDrop, c.knuckle + 0.2, y) + 0.03;
    return tw + (1 - tw) * base;
  };
  H.hb = (y, u) => Math.max(0.035, B / 2 * H.sf(y, u) * H.pf(u, y)) * (c.widen ? c.widen(u, y) : 1);
  H.P = (u, y, side = 1, out = V3()) => out.set(side * H.hb(y, u), y, H.zAt(u, y));
  const _t = V3(), _u = V3(), _p0 = V3(), _p1 = V3();
  H.frame = (u, y, side = 1) => {
    const o = H.P(u, y, side);
    const du = 0.003, dyy = 0.02;
    H.P(Math.min(1, u + du), y, side, _p1); H.P(Math.max(0, u - du), y, side, _p0);
    const T = V3().subVectors(_p1, _p0).normalize();         // toward the bow
    H.P(u, y + dyy, side, _p1); H.P(u, y - dyy, side, _p0);
    const U0 = V3().subVectors(_p1, _p0).normalize();
    const X = T.clone().multiplyScalar(side);                 // right-handed frame per side
    const N = V3().crossVectors(X, U0).normalize();
    const U = V3().crossVectors(N, X).normalize();
    return { o, T, U, N, X };
  };
  /** Matrix placing local (x along hull toward the bow on starboard / aft on port, y up the side, z outward). */
  H.mat = (u, y, side = 1, out = 0) => {
    const f = H.frame(u, y, side);
    return new THREE.Matrix4().makeBasis(f.X, f.U, f.N).setPosition(f.o.addScaledVector(f.N, out));
  };
  /** u at which the side at height y reaches z (Newton on the linear-in-u zAt). */
  H.uAtZ = (z, y) => clamp01((z - H.zStern(y)) / (H.zBow(y) - H.zStern(y)));
  H.zS = zS; H.zB = zB;
  return H;
}

// ------------------------------------------------------------------------------------------------ sweep along a path
/** path: [{ o, A, B }] (A, B span the profile plane); profile: CCW [[a, b], …] (closed if first==last not required: open).
 *  o: builder opts (color, e, d, metal…). Flat across profile segments, smooth along the path. Grain UVs. */
export function sweep(wb, path, profile, o = {}) {
  const n = path.length, np = profile.length, closed = o.closed ?? true;
  const segs = closed ? np : np - 1;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + path[i].o.distanceTo(path[i - 1].o));
  const col = o.color || [1, 1, 1];
  for (let s = 0; s < segs; s++) {
    const [a0, b0] = profile[s], [a1, b1] = profile[(s + 1) % np];
    let na = b1 - b0, nb = -(a1 - a0); const nl = Math.hypot(na, nb) || 1; na /= nl; nb /= nl;
    const base = wb.count;
    for (let i = 0; i < n; i++) {
      const { o: p, A, B } = path[i];
      const nx = A.x * na + B.x * nb, ny = A.y * na + B.y * nb, nz = A.z * na + B.z * nb;
      const c0 = typeof col === 'function' ? col(p, i / (n - 1)) : col;
      wb.vert(p.x + A.x * a0 + B.x * b0, p.y + A.y * a0 + B.y * b0, p.z + A.z * a0 + B.z * b0, nx, ny, nz, c0, cum[i] / TU, GV0 + 0.02, o);
      wb.vert(p.x + A.x * a1 + B.x * b1, p.y + A.y * a1 + B.y * b1, p.z + A.z * a1 + B.z * b1, nx, ny, nz, c0, cum[i] / TU, GV1 - 0.02, o);
    }
    // winding check with the first quad
    let flip = false;
    if (n > 1) {
      const P = wb.P, i0 = base * 3, i1 = (base + 2) * 3, i2 = (base + 1) * 3;
      const ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2];
      const vx = P[i2] - P[i0], vy = P[i2 + 1] - P[i0 + 1], vz = P[i2 + 2] - P[i0 + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const N = wb.N; flip = cx * N[i0] + cy * N[i0 + 1] + cz * N[i0 + 2] < 0;
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 2;
      if (!flip) wb.I.push(a, b, a + 1, a + 1, b, b + 1); else wb.I.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}
/** Path along the hull side at y = yFn(u) for u ∈ [u0, u1]; profile axes A = outward, B = up the side. */
export function sidePath(H, u0, u1, yFn, side, n = 40, out = 0) {
  const path = [];
  for (let i = 0; i <= n; i++) {
    const u = lerp(u0, u1, i / n), f = H.frame(u, yFn(u), side);
    path.push({ o: f.o.addScaledVector(f.N, out), A: f.N, B: f.U });
  }
  return path;
}

// ------------------------------------------------------------------------------------------------ hull surfaces
/** paint: { hull(x, y, z, u) → rgb, deck → rgb | fn, inner → rgb, cap → rgb, capMetal, bulkhead → rgb, transom(x, y) → rgb } */
export function buildHull(wb, H, paint, opt = {}) {
  const c = H.c, keel = c.keel, th = c.thick ?? 0.14;
  const NU = opt.nu ?? 64, NS = opt.ns ?? 30;
  const us = []; // stations 0 → 1, denser at both ends (round bow, tucked stern)
  for (let i = 0; i <= NU; i++) { const t = i / NU; us.push(lerp(t, 0.5 - 0.5 * Math.cos(Math.PI * t), 0.6)); }
  // ---- outer shell (both sides)
  for (const side of [-1, 1]) {
    const girth = [];
    for (let i = 0; i <= NU; i++) {
      const u = us[i], yT = H.railY(u), col = [];
      let g = 0, prev = null;
      for (let j = NS; j >= 0; j--) {
        const y = keel + (yT - keel) * (j / NS), p = H.P(u, y, side);
        if (prev) g += p.distanceTo(prev);
        prev = p; col[j] = g;
      }
      girth.push(col);
    }
    const geo = gridGeo(NU, NS, (i, j) => {
      const u = us[i], y = keel + (H.railY(u) - keel) * (j / NS), p = H.P(u, y, side);
      return [p.x, p.y, p.z, p.z / TU, girth[i][j] / TV + 0.013];
    }, side < 0);
    wb.add(geo, null, { uv: 'keep', color: (p) => paint.hull(p.x, p.y, p.z, H.uAtZ(p.z, p.y)), d: paint.hullDetail ?? 1 });
  }
  // ---- transom face (u = 0), planks across
  {
    const NT = 18, yT = H.railY(0), y0 = keel;
    const geo = gridGeo(8, NT, (i, j) => {
      const y = lerp(y0, yT, j / NT), w = H.hb(y, 0), x = lerp(-w, w, i / 8), z = H.zStern(y) + 0.002;
      return [x, y, z, x / TU, y / TV];
    });
    wb.add(geo, null, { uv: 'keep', color: (p) => (paint.transom ? paint.transom(p.x, p.y) : paint.hull(p.x, p.y, p.z, 0)) });
  }
  // ---- decks
  for (const d of H.decks) {
    if (d.noDeck) continue;
    const n = Math.max(4, Math.ceil((d.u1 - d.u0) * 70)), NL = 8, cam = c.camber ?? 0.06;
    const geo = gridGeo(n, NL, (i, j) => {
      const u = lerp(d.u0, d.u1, i / n), y = H.deckAt(Math.min(d.u1 - 1e-4, Math.max(d.u0 + 1e-4, u)));
      const w = Math.max(0.02, H.hb(y, u) - th), t = j / NL * 2 - 1, x = t * w, z = H.zAt(u, y);
      return [x, y + cam * (1 - t * t), z, z / TU, x / TV + 0.5];
    }, true);
    wb.add(geo, null, { uv: 'keep', color: paint.deck, d: 1 });
  }
  // ---- inner bulwarks (per deck segment)
  for (const d of H.decks) for (const side of [-1, 1]) {
    const n = Math.max(4, Math.ceil((d.u1 - d.u0) * 70)), NV = 3;
    const geo = gridGeo(n, NV, (i, j) => {
      const u = lerp(d.u0, d.u1, i / n), yd = H.deckAt(Math.min(d.u1 - 1e-4, Math.max(d.u0 + 1e-4, u))), y = lerp(yd, H.railY(u), j / NV);
      const x = side * Math.max(0.03, H.hb(y, u) - th), z = H.zAt(u, y);
      return [x, y, z, z / TU, y / TV];
    }, side > 0);
    wb.add(geo, null, { uv: 'keep', color: paint.inner, d: 1 });
  }
  // inner face of the transom above the quarterdeck
  {
    const yd = H.deckAt(0.0001), yT = H.railY(0);
    const geo = gridGeo(6, 2, (i, j) => {
      const y = lerp(yd, yT, j / 2), w = H.hb(y, 0) - th, x = lerp(-w, w, i / 6), z = H.zStern(y) - th;
      return [x, y, z, x / TU, y / TV];
    }, true);
    wb.add(geo, null, { uv: 'keep', color: paint.inner, d: 1 });
  }
  // ---- rail caps (sides + taffrail)
  const capW = c.capW ?? 0.1, capH = c.capH ?? 0.07, capOut = c.capOut ?? 0.05;
  const capProf = [[-th - 0.03, -0.02], [capOut, -0.02], [capOut, capH], [-th - 0.03, capH]];
  for (const side of [-1, 1]) {
    const path = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const u = Math.min(0.997, i / n), f = H.frame(u, H.railY(u), side);
      path.push({ o: f.o, A: f.N.clone().setY(0).normalize(), B: V3(0, 1, 0) });
    }
    sweep(wb, path, capProf, { color: paint.cap, metal: paint.capMetal || 0, d: 0.8 });
  }
  {
    const yT = H.railY(0), w = H.hb(yT, 0), path = [];
    for (let i = 0; i <= 8; i++) { const x = lerp(-w, w, i / 8); path.push({ o: V3(x, yT, H.zStern(yT)), A: V3(0, 0, 1), B: V3(0, 1, 0) }); }
    sweep(wb, path, capProf, { color: paint.cap, metal: paint.capMetal || 0, d: 0.8 });
  }
  // ---- bulkheads at deck breaks (facing the lower deck)
  for (let i = 0; i < H.decks.length - 1; i++) {
    const a = H.decks[i], b = H.decks[i + 1], ub = a.u1;
    const ya = H.deckAt(ub - 1e-4), yb = H.deckAt(ub + 1e-4);
    const lo = Math.min(ya, yb), hi = Math.max(ya, yb), aftHigh = ya > yb;
    const geo = gridGeo(8, 3, (ii, jj) => {
      const y = lerp(lo, hi, jj / 3), w = H.hb(y, ub) - th, x = lerp(-w, w, ii / 8), z = H.zAt(ub, y) + (aftHigh ? -0.004 : 0.004);
      return [x, y, z, x / TU, y / TV];
    }, aftHigh);
    wb.add(geo, null, { uv: 'keep', color: paint.bulkhead || paint.inner, d: 1 });
    // deck-edge fascia (a moulding along the top of the bulkhead)
    const w = H.hb(hi, ub) - th, z = H.zAt(ub, hi), path = [];
    for (let k = 0; k <= 6; k++) path.push({ o: V3(lerp(-w, w, k / 6), hi, z), A: V3(0, 0, aftHigh ? -1 : 1), B: V3(0, 1, 0) });
    sweep(wb, path, [[-0.02, -0.16], [0.07, -0.16], [0.07, 0.03], [-0.02, 0.03]], { color: paint.cap, metal: paint.capMetal || 0, d: 0.8 });
  }
}
