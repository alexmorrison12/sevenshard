// 2D signed-distance shapes (x/z plane) shared by ground painting, height sculpting and the nav rasteriser.
// Every shape: { sd(x, z) → metres (negative inside), box: [x0, z0, x1, z1] }.
//   circle(x, z, r)   ring(x, z, r, w)   rect(x, z, w, d, rot)   poly([[x,z]…])   line([[x,z]…], width)   all()
// rot follows the world convention (rotation about +Y; a rect's local +Z is its "front").

export function circle(x, z, r) {
  return { sd: (px, pz) => Math.hypot(px - x, pz - z) - r, box: [x - r, z - r, x + r, z + r] };
}
export function ring(x, z, r, w) {
  const R = r + w / 2;
  return { sd: (px, pz) => Math.abs(Math.hypot(px - x, pz - z) - r) - w / 2, box: [x - R, z - R, x + R, z + R] };
}
export function rect(x, z, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
  const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
  return {
    sd: (px, pz) => {
      const dx = px - x, dz = pz - z;
      // world → local (inverse of rotation about Y: local x = c*dx - s*dz ... with three's Y rotation)
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      const qx = Math.abs(lx) - hw, qz = Math.abs(lz) - hd;
      return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
    },
    box: [x - ex, z - ez, x + ex, z + ez],
  };
}
export function poly(pts) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const n = pts.length;
  return {
    sd: (px, pz) => {
      let d = Infinity, inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [ax, az] = pts[j], [bx, bz] = pts[i];
        const ex = bx - ax, ez = bz - az, wx = px - ax, wz = pz - az;
        const t = Math.max(0, Math.min(1, (wx * ex + wz * ez) / (ex * ex + ez * ez || 1)));
        d = Math.min(d, Math.hypot(wx - ex * t, wz - ez * t));
        if ((az > pz) !== (bz > pz) && px < (bx - ax) * (pz - az) / (bz - az) + ax) inside = !inside;
      }
      return inside ? -d : d;
    },
    box: [x0, z0, x1, z1],
  };
}
export function line(pts, width) {
  const hw = width / 2;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return {
    sd: (px, pz) => {
      let d = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const ex = bx - ax, ez = bz - az, wx = px - ax, wz = pz - az;
        const t = Math.max(0, Math.min(1, (wx * ex + wz * ez) / (ex * ex + ez * ez || 1)));
        d = Math.min(d, Math.hypot(wx - ex * t, wz - ez * t));
      }
      return d - hw;
    },
    box: [x0 - hw, z0 - hw, x1 + hw, z1 + hw],
  };
}
export function all() { return { sd: () => -1e6, box: [-1e6, -1e6, 1e6, 1e6] }; }
/** union / subtract helpers */
export function union(...shapes) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) { b[0] = Math.min(b[0], s.box[0]); b[1] = Math.min(b[1], s.box[1]); b[2] = Math.max(b[2], s.box[2]); b[3] = Math.max(b[3], s.box[3]); }
  return { sd: (x, z) => { let d = Infinity; for (const s of shapes) d = Math.min(d, s.sd(x, z)); return d; }, box: b };
}
export function subtract(a, b) { return { sd: (x, z) => Math.max(a.sd(x, z), -b.sd(x, z)), box: a.box }; }
export function inflate(s, r) { return { sd: (x, z) => s.sd(x, z) - r, box: [s.box[0] - r, s.box[1] - r, s.box[2] + r, s.box[3] + r] }; }
