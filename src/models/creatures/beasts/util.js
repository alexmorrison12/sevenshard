// Small shared helpers for the field beasts (allocation-free in the per-frame paths).
import * as THREE from 'three';
import { col } from '../../kit/sdf.js';

/** deterministic 0..1 hash */
export const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Leg override: target (x,y,z) in body-local (local=true, carried by the leg's body bone) or model space; paw pitch; weight. */
export function ov(L, x, y, z, w, local = true, paw = -0.4, meta) {
  if (!L.override) L.override = new THREE.Vector3(); // first use only
  L.override.set(x, y, z); L.overrideLocal = local; L.overridePaw = paw;
  if (meta !== undefined) L.overrideMeta = meta;
  if (w > L.overrideW) L.overrideW = w;
}

/** Resting holds (sit / sleep / root…) end by themselves once the creature is asked to move. */
export function cancelRestOnMove(ctl) {
  if (Math.abs(ctl._speed) < 0.3 && Math.abs(ctl._turn) < 0.6) return;
  const L = ctl.acts.list;
  for (let i = 0; i < L.length; i++) if (L[i].d.rest && !L[i].out) L[i].out = true;
}

/** pre-create the override vectors so no action allocates on its first frame */
export function prepLegs(gait) { const L = gait.legs; for (let i = 0; i < L.length; i++) if (!L[i].override) L[i].override = new THREE.Vector3(); }


/**
 * Crisp glowing crack (or scar) ribbon laid onto an SDF surface: pts = rough surface points (model space), projected
 * onto `group`'s surface and lifted by `lift`; 3 verts across (edge / core / edge), width tapers to the ends with a
 * jagged wobble; skinned with the surface's own weights (follows the body's deformation). ~4 tris per segment.
 * o: { width, core (hex), edge (hex), emis (core emissive), group, lift, seed, n (resample to n points) }
 */
export function surfaceCrack(acc, S, pts, o = {}) {
  if (o.n && o.n > pts.length) { // resample the polyline densely so the ribbon hugs curved surfaces
    const out = [], m = pts.length - 1;
    for (let i = 0; i < o.n; i++) {
      const f = i / (o.n - 1) * m, j = Math.min(m - 1, Math.floor(f)), u = f - j, a = pts[j], b = pts[j + 1];
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    pts = out;
  }
  const w0 = o.width ?? 0.03, E = o.emis ?? 2, g = o.group ?? 0, lift = o.lift ?? 0.012;
  const cc = col(o.core ?? 0xffe0a0), ce = col(o.edge ?? o.core ?? 0xff8a20);
  const n = pts.length, P = [], N = [], SK = [];
  for (let i = 0; i < n; i++) {
    const r = S.project(pts[i].slice(), g, 5);
    const nn = [0, 0, 0]; S.normal(r.p[0], r.p[1], r.p[2], nn, g);
    P.push([r.p[0] + nn[0] * lift, r.p[1] + nn[1] * lift, r.p[2] + nn[2] * lift]); N.push(nn);
    const sm = S.sampleAt(r.p[0], r.p[1], r.p[2]); SK.push(sm);
  }
  const base = acc.count;
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], nn = N[i];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    // side = normal × tangent
    let sx = nn[1] * tz - nn[2] * ty, sy = nn[2] * tx - nn[0] * tz, sz = nn[0] * ty - nn[1] * tx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    const u = i / (n - 1), taper = Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.92)), 0.6);
    const w = w0 * taper * (0.7 + 0.6 * hsh(i * 7.3 + (o.seed ?? 0)));
    sx *= w / sl; sy *= w / sl; sz *= w / sl;
    const p = P[i], sk = SK[i];
    acc.vert(p[0] - sx, p[1] - sy, p[2] - sz, nn[0], nn[1], nn[2], ce[0], ce[1], ce[2], sk.si, sk.sw, 0, 0, 0, 0, E * 0.45, 0);
    acc.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], cc[0], cc[1], cc[2], sk.si, sk.sw, 0, 0, 0, 0, E, 0);
    acc.vert(p[0] + sx, p[1] + sy, p[2] + sz, nn[0], nn[1], nn[2], ce[0], ce[1], ce[2], sk.si, sk.sw, 0, 0, 0, 0, E * 0.45, 0);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = base + i * 3, b = a + 3;
    acc.tri(a, b, a + 1); acc.tri(a + 1, b, b + 1); acc.tri(a + 1, b + 1, a + 2); acc.tri(a + 2, b + 1, b + 2);
  }
}
