// Painted minimap: a stylised top-down map drawn on a 2D canvas from the zone's own data — splat colours with
// hill-shading, water, footprints of everything that blocks movement (roofs), walkable-edge outlines, and extra
// marks (roads, plazas) supplied by the zone. Returns the contract object { canvas, x0, z0, size }.
import { clamp } from '../core/noise.js';

const LAYER_RGB = {
  fan: [146, 140, 128],
  grass: [96, 132, 52], dirt: [150, 116, 78], cobble: [150, 144, 132], flagstone: [178, 170, 152], sand: [206, 186, 140],
  snow: [226, 234, 244], obsidian: [52, 46, 52], ice: [140, 186, 214], rock: [128, 120, 110], marble: [214, 208, 196],
  moss: [80, 96, 46], void: [70, 52, 86], gravel: [128, 120, 110], bloodstone: [98, 64, 58], mud: [82, 64, 44],
};

/**
 * zone: needs zone.ground (Ground) and zone._nav (NavGrid). opts: { size (px), area: {x0, z0, size} (world square),
 * roofs: [{shape, color}], water: [{shape}], marks: [{shape, color, alpha}], outline: true, void: css colour for no-ground }
 */
export function paintMinimap(zone, { px = 512, area = null, roofs = [], water = [], marks = [], outline = true, voidColor = '#0a0c14', clip = null } = {}) {
  const g = zone.ground;
  const A = area || { x0: g.x0, z0: g.z0, size: Math.max(g.w, g.d) };
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(px, px), d = img.data;
  const mpp = A.size / px;
  const layerCols = g.layers.map(l => LAYER_RGB[l] || [128, 128, 128]);
  const nrm = [0, 1, 0];
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const x = A.x0 + (i + 0.5) * mpp, z = A.z0 + (j + 0.5) * mpp, k = (j * px + i) * 4;
    if (x < g.x0 || z < g.z0 || x > g.x0 + g.w || z > g.z0 + g.d || (clip && !clip(x, z))) {
      d[k] = 10; d[k + 1] = 12; d[k + 2] = 20; d[k + 3] = 255; continue;
    }
    let r = 0, gg = 0, b = 0;
    for (let l = 0; l < g.layers.length; l++) {
      const w = g.weight(g.layers[l], x, z);
      if (w <= 0) continue;
      r += layerCols[l][0] * w; gg += layerCols[l][1] * w; b += layerCols[l][2] * w;
    }
    g.normalAt(x, z, nrm);
    const shade = clamp(0.78 + (-nrm[0] * 0.55 - nrm[2] * 0.45) * 1.4 + nrm[1] * 0.12, 0.45, 1.25);
    const walk = zone._nav ? zone._nav.walkable(x, z) : true;
    const f = shade * (walk ? 1 : 0.8);
    d[k] = clamp(r * f, 0, 255); d[k + 1] = clamp(gg * f, 0, 255); d[k + 2] = clamp(b * f, 0, 255); d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const W = (x, z) => [(x - A.x0) / mpp, (z - A.z0) / mpp];
  const path = (shape) => {
    ctx.beginPath();
    if (shape.poly) { shape.poly.forEach(([x, z], i) => { const [u, v] = W(x, z); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.closePath(); }
    else if (shape.circle) { const [x, z, r] = shape.circle; const [u, v] = W(x, z); ctx.arc(u, v, r / mpp, 0, Math.PI * 2); }
    else if (shape.rect) {
      const [x, z, w, dd, rot = 0] = shape.rect; const c = Math.cos(rot), s = Math.sin(rot);
      [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]].forEach(([lx, lz], i) => { const [u, v] = W(x + lx * c + lz * s, z - lx * s + lz * c); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); });
      ctx.closePath();
    } else if (shape.line) { shape.line.forEach(([x, z], i) => { const [u, v] = W(x, z); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); }
  };
  for (const m of marks) { ctx.globalAlpha = m.alpha ?? 0.5; path(m.shape); if (m.shape.line) { ctx.lineWidth = (m.width || 3) / mpp; ctx.strokeStyle = m.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); } else { ctx.fillStyle = m.color; ctx.fill(); } }
  ctx.globalAlpha = 1;
  for (const w of water) {
    path(w.shape); const grd = ctx.createLinearGradient(0, 0, px, px); grd.addColorStop(0, '#3f7fa8'); grd.addColorStop(1, '#2a5f8a');
    ctx.fillStyle = w.color || grd; ctx.fill();
  }
  // roofs with a soft drop shadow
  for (const r of roofs) {
    ctx.save(); ctx.translate(2, 2); path(r.shape); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
    path(r.shape); ctx.fillStyle = r.color || '#6a7a9a'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,20,30,0.55)'; ctx.stroke();
  }
  if (outline && zone._nav) {
    // walkable-edge outline: bright rim where walkable meets blocked
    const n = zone._nav, ov = ctx.getImageData(0, 0, px, px), o = ov.data;
    for (let j = 1; j < px - 1; j++) for (let i = 1; i < px - 1; i++) {
      const x = A.x0 + (i + 0.5) * mpp, z = A.z0 + (j + 0.5) * mpp;
      const w0 = n.walkable(x, z);
      if (!w0) continue;
      if (!n.walkable(x + mpp, z) || !n.walkable(x - mpp, z) || !n.walkable(x, z + mpp) || !n.walkable(x, z - mpp)) {
        const k = (j * px + i) * 4; o[k] = Math.min(255, o[k] * 0.6 + 100); o[k + 1] = Math.min(255, o[k + 1] * 0.6 + 96); o[k + 2] = Math.min(255, o[k + 2] * 0.6 + 80);
      }
    }
    ctx.putImageData(ov, 0, 0);
  }
  // vignette
  const vg = ctx.createRadialGradient(px / 2, px / 2, px * 0.3, px / 2, px / 2, px * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, px, px);
  return { canvas: cv, x0: A.x0, z0: A.z0, size: A.size };
}
