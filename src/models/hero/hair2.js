// Lock-based hair: a scalp cap plus many tapered clumps grown from the scalp along a style's flow (swept back, falling
// from a part, spiking up, framing the face). Each lock hugs the skull (ellipsoid push-out), then falls under gravity and
// drapes over the neck / shoulders / back (torso SDF push-out). Locks are smooth-unioned into one field, meshed with
// surface nets, decimated and skinned: scalp → head, hanging hair → hair / braid bone chains (spring-driven).
import * as THREE from 'three';
import { SDF, ADD, SUB, INT, rotEuler, surfaceNets, sdfAO, refineVerts } from './sdf.js';
import { simplify } from './simplify.js';
import { makePiece } from './body.js';
import { B } from './rig.js';
import { SLOT } from './palette.js';
import { cached } from './pieces.js';
import { clamp, lerp, smoothstep, Simplex, RNG } from '../../core/noise.js';

const NZ = new Simplex(4711);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------------------------------------
function frame(base) {
  const d = base.P.headDef, s = d.s, H = base.JJ.J.head;
  const hp = (p) => V(H[0] + p[0] * s, H[1] + p[1] * s, H[2] + p[2] * s);
  const cr = d.cranium, bk = d.back;
  const E1 = { c: hp(cr.c), r: V(cr.r[0] * s, cr.r[1] * s, cr.r[2] * s) };
  const E2 = { c: hp(bk.c), r: V(bk.r[0] * s, bk.r[1] * s, bk.r[2] * s) };
  const face = { c: hp([0, 0.04, -0.075]), r: V(0.066 * s, 0.085 * s, 0.07 * s) };
  return { d, s, H: V(...H), hp, E1, E2, face, J: base.JJ.J };
}
/** push p outside both skull ellipsoids by `off` (returns true if moved) */
function pushSkull(F, p, off) {
  let moved = false;
  for (const E of [F.E1, F.E2]) {
    const qx = (p.x - E.c.x) / (E.r.x + off), qy = (p.y - E.c.y) / (E.r.y + off), qz = (p.z - E.c.z) / (E.r.z + off);
    const l = Math.hypot(qx, qy, qz);
    if (l < 1) { p.set(E.c.x + qx / l * (E.r.x + off), E.c.y + qy / l * (E.r.y + off), E.c.z + qz / l * (E.r.z + off)); moved = true; }
  }
  return moved;
}
/** snap p onto the cranium shell at `off` (locks hug the scalp before they fall) */
function snapSkull(F, p, off) {
  const E = F.E1;
  const qx = (p.x - E.c.x) / (E.r.x + off), qy = (p.y - E.c.y) / (E.r.y + off), qz = (p.z - E.c.z) / (E.r.z + off);
  const l = Math.hypot(qx, qy, qz) || 1;
  p.set(E.c.x + qx / l * (E.r.x + off), E.c.y + qy / l * (E.r.y + off), E.c.z + qz / l * (E.r.z + off));
  pushSkull(F, p, off);
}
/** keep hair out of the face (eyes, nose, mouth) */
function pushFace(F, p, off) {
  const c = F.face.c, r = F.face.r;
  const qx = (p.x - c.x) / (r.x + off), qy = (p.y - c.y) / (r.y + off), qz = (p.z - c.z) / (r.z + off);
  const l = Math.hypot(qx, qy, qz);
  if (l < 1 && l > 1e-6) p.set(c.x + qx / l * (r.x + off), c.y + qy / l * (r.y + off), c.z + qz / l * (r.z + off));
}
/** push p out of the torso / neck by `off` using the body SDF gradient */
function pushBody(base, p, off) {
  const f = base.chainSDF.torso;
  for (let it = 0; it < 3; it++) {
    const d = f.eval(p.x, p.y, p.z);
    if (d >= off) return;
    const e = 0.004;
    const gx = f.eval(p.x + e, p.y, p.z) - f.eval(p.x - e, p.y, p.z), gy = f.eval(p.x, p.y + e, p.z) - f.eval(p.x, p.y - e, p.z), gz = f.eval(p.x, p.y, p.z + e) - f.eval(p.x, p.y, p.z - e);
    const gl = Math.hypot(gx, gy, gz) || 1;
    p.x += gx / gl * (off - d); p.y += gy / gl * (off - d); p.z += gz / gl * (off - d);
  }
}
/** scalp point & local frame at (θ azimuth from the front, φ elevation) on the cranium ellipsoid */
function scalp(F, th, ph, off = 0.004) {
  const E = F.E1, ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
  const p = V(E.c.x + (E.r.x + off) * st * cp, E.c.y + (E.r.y + off) * sp, E.c.z - (E.r.z + off) * ct * cp);
  const n = V(st * cp / E.r.x, sp / E.r.y, -ct * cp / E.r.z).normalize();
  const down = V(E.r.x * st * sp, -E.r.y * cp, -E.r.z * ct * sp).normalize();   // along the meridian, toward the neck
  const side = V(E.r.x * ct, 0, E.r.z * st).normalize();                         // along the parallel, toward +θ
  return { p, n, down, side };
}

/**
 * Grow one lock. o: { L, r0, r1, dir (Vector3), grav, gravStart, lift (extra offset from the skull along the lock),
 *   curl (Vector3 bend added along the lock), seg, tipCurl, hang }
 * Returns points + radii.
 */
function growLock(F, base, root, o) {
  const n = o.seg ?? 8, L = o.L;
  const pts = [root.p.clone()], rad = [o.r0];
  const d = o.dir.clone().normalize();
  const p = root.p.clone();
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const g = (o.grav ?? 1) * smoothstep(o.gravStart ?? 0.15, 1, t);
    d.y -= g * 0.55;
    if (o.curl) d.addScaledVector(o.curl, (o.curlK ?? 1) * t);
    d.normalize();
    p.addScaledVector(d, L / n);
    const off = (o.off ?? 0.006) + (o.lift ?? 0.012) * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5);
    if (t <= (o.hug ?? 0)) snapSkull(F, p, off); else pushSkull(F, p, off);
    if (o.face !== false) pushFace(F, p, 0.01);
    if (p.y < F.H.y + 0.02) pushBody(base, p, 0.012 + (o.bodyOff ?? 0.012));
    // re-aim along the actual step so the lock flows around obstacles
    const st = p.clone().sub(pts[pts.length - 1]); if (st.lengthSq() > 1e-8) d.lerp(st.normalize(), 0.6).normalize();
    pts.push(p.clone());
    rad.push(lerp(o.r0, o.r1 ?? 0.0015, Math.pow(t, o.taperPow ?? 1.25)));
  }
  return { pts, rad, hang: o.hang };
}

// ------------------------------------------------------------------------------------------------
// hairline: minimum scalp elevation for a root at azimuth θ (keeps the forehead, temples, ears and nape clear)
function hairlinePhi(th, o = {}) {
  const a = Math.abs(((th + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI); // 0 front … π back
  const fore = o.fore ?? 0.62, temple = o.temple ?? 0.34, ear = o.ear ?? 0.2, nape = o.nape ?? -0.45;
  if (a < 0.9) return lerp(fore, temple, smoothstep(0.1, 0.9, a));
  if (a < 1.75) return lerp(temple, ear, smoothstep(0.9, 1.75, a));
  return lerp(ear, nape, smoothstep(1.75, 2.6, a));
}

/** a style = cap + lock groups + extras; returns the SDF */
function buildStyle(F, base, style, sex, rng) {
  const sd = new SDF();
  const s = F.s;
  const locks = [];
  const add = (lk, tag = 0) => locks.push({ ...lk, tag });
  const E = F.E1;
  // scalp cap (thin shell over the cranium, trimmed at the hairline by carving the face / ears / nape)
  const cap = (thick = 0.008, o = {}) => {
    sd.ell([E.c.x, E.c.y + 0.002, E.c.z + 0.003], [E.r.x + thick, E.r.y + thick * 0.8, E.r.z + thick], { k: 0.012 * s, tag: 0 });
    sd.ell([F.E2.c.x, F.E2.c.y, F.E2.c.z + 0.002], [F.E2.r.x + thick * 0.8, F.E2.r.y + thick * 0.8, F.E2.r.z + thick], { k: 0.012 * s, tag: 0 });
    const d = F.d, fy = (d.browY ?? 0.1) + (o.foreY ?? 0.045);
    sd.ell(F.hp([0, fy - 0.11, -0.135]).toArray(), [0.13 * s, 0.11 * s, 0.11 * s], { op: SUB, k: 0.016 * s });   // face / forehead
    for (const sg of [-1, 1]) {
      sd.ell(F.hp([sg * 0.1, 0.02, -0.07]).toArray(), [0.06 * s, (o.side ?? 0.075) * s, 0.055 * s], { op: SUB, k: 0.014 * s });
      if (o.ears !== false) sd.ell(F.hp([sg * (d.earC[0] + 0.01), d.earC[1] - 0.004, d.earC[2] + 0.004]).toArray(), [0.028 * s, 0.04 * s, 0.032 * s], { op: SUB, k: 0.01 * s });
    }
    sd.plane([0, -1, -0.5], -(F.H.y + (o.nape ?? -0.035) * s) - 0.5 * F.H.z, { op: INT, k: 0.02 * s });
  };
  // grid of lock roots over a scalp region, grown with a direction function
  const field = (o) => {
    const nT = o.nT ?? 8, nP = o.nP ?? 3;
    for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) {
      const th = lerp(o.th[0], o.th[1], nT === 1 ? 0.5 : (i + (j % 2) * 0.5) / (nT - 1 + (nP > 1 ? 0.5 : 0))) + (rng.next() - 0.5) * (o.jit ?? 0.08);
      const ph = lerp(o.ph[0], o.ph[1], nP === 1 ? 0.5 : j / (nP - 1)) + (rng.next() - 0.5) * 0.05;
      if (!o.anyLine && ph < hairlinePhi(th, o.line) - 0.02) continue;
      const r = scalp(F, th, ph);
      const dir = o.dir(r, th, ph);
      const L = (typeof o.L === 'function' ? o.L(th, ph) : o.L) * (1 + (rng.next() - 0.5) * (o.Ljit ?? 0.2)) * s;
      add({ ...growLock(F, base, r, { L, r0: (o.r0 ?? 0.016) * s * (0.85 + rng.next() * 0.3) * (o.tag ? 1.3 : 1), r1: (o.r1 ?? 0.0018) * s, dir, grav: o.grav ?? 1, gravStart: o.gravStart, lift: (o.lift ?? 0.012) * s, off: (o.off ?? 0.004) * s, seg: o.seg, hug: o.hug ?? 0.55, curl: o.curl ? o.curl(r, th, ph) : null, curlK: o.curlK, taperPow: o.taperPow, bodyOff: o.bodyOff }) }, o.tag ?? 0);
    }
  };
  const back = (r) => r.down.clone().multiplyScalar(-1);            // up the meridian → over the crown → down the back
  const down = (r) => r.down.clone();
  const out = (k) => (r) => r.down.clone().multiplyScalar(-0.35).addScaledVector(r.n, k).normalize();
  const PI = Math.PI;
  switch (style) {
    // ---------------- male ----------------
    case 'swept': { // heroic swept-back mane with lift at the front and a few fallen strands
      cap(0.007);
      field({ th: [-1.0, 1.0], ph: [0.62, 0.8], nT: 9, nP: 2, L: 0.22, r0: 0.02, dir: back, grav: 0.7, gravStart: 0.6, lift: 0.016, seg: 10, hug: 0.72 });
      field({ th: [-0.7, 0.7], ph: [0.95, 1.25], nT: 6, nP: 2, L: 0.17, r0: 0.018, dir: back, grav: 0.8, gravStart: 0.5, lift: 0.012, hug: 0.6 });
      for (const sg of [-1, 1]) field({ th: [sg * 1.05, sg * 1.9], ph: [0.25, 0.75], nT: 4, nP: 2, L: 0.1, r0: 0.014, dir: (r) => back(r).multiplyScalar(0.5).addScaledVector(r.side, -sg * 0.2).add(V(0, 0, 0.6)).normalize(), grav: 0.7, lift: 0.008 });
      field({ th: [2.1, 4.2], ph: [-0.1, 0.8], nT: 7, nP: 3, L: 0.12, r0: 0.016, dir: down, grav: 1, lift: 0.01, hug: 0.5 });
      for (const th of [-0.12, 0.18]) { const r = scalp(F, th, 0.72); add(growLock(F, base, r, { L: 0.1 * s, r0: 0.008 * s, dir: r.down.clone().addScaledVector(r.n, 0.5).normalize(), grav: 0.8, lift: 0.014 * s, seg: 7, curl: V(th > 0 ? -0.25 : 0.3, 0, 0) })); }
      break;
    }
    case 'short': { // textured crop: short tousled spikes, tidy sides
      cap(0.006, { side: 0.06 });
      field({ th: [-0.8, 0.8], ph: [0.6, 1.0], nT: 8, nP: 2, L: 0.075, r0: 0.014, dir: (r, th) => r.down.clone().multiplyScalar(-0.8).addScaledVector(r.n, 0.45).add(V(0, 0, -0.2)).normalize(), grav: 0.3, lift: 0.006, seg: 5, hug: 0.3 });
      field({ th: [-0.6, 0.6], ph: [1.05, 1.4], nT: 6, nP: 2, L: 0.065, r0: 0.014, dir: (r) => r.down.clone().multiplyScalar(-1).addScaledVector(r.n, 0.5).normalize(), grav: 0.3, lift: 0.004, seg: 5, hug: 0.3 });
      field({ th: [1.0, 5.28], ph: [0.0, 0.85], nT: 12, nP: 3, L: 0.05, r0: 0.012, dir: (r) => r.down.clone().addScaledVector(r.n, 0.35).normalize(), grav: 0.6, lift: 0.004, seg: 4 });
      break;
    }
    case 'long': { // shoulder-length, centre part, framing the face
      cap(0.008, { ears: false, side: 0.05, nape: -0.1 });
      for (const sg of [-1, 1]) {
        field({ th: [sg * 0.25, sg * 2.9], ph: [1.12, 1.38], nT: 7, nP: 1, L: 0.32, r0: 0.02, dir: (r) => r.down.clone().addScaledVector(r.side, sg * 0.25).normalize(), grav: 1, gravStart: 0.35, lift: 0.012, seg: 11, bodyOff: 0.01, hug: 0.4 }, 1);
        field({ th: [sg * 0.8, sg * 1.45], ph: [0.45, 0.9], nT: 3, nP: 2, L: 0.28, r0: 0.018, dir: down, grav: 1, lift: 0.012, seg: 9, hug: 0.25 }, 1);
      }
      field({ th: [2.2, 4.1], ph: [-0.2, 0.9], nT: 7, nP: 3, L: 0.26, r0: 0.02, dir: down, grav: 1, lift: 0.012, seg: 9, hug: 0.3 }, 1);
      break;
    }
    case 'ponytail': { // slicked back into a low tail
      cap(0.007);
      field({ th: [-1.0, 1.0], ph: [0.62, 0.95], nT: 9, nP: 2, L: 0.2, r0: 0.014, dir: back, grav: 0.4, gravStart: 0.7, lift: 0.005, seg: 9, hug: 0.9 });
      field({ th: [1.05, 5.23], ph: [0.2, 0.9], nT: 10, nP: 2, L: 0.11, r0: 0.013, dir: (r) => V(0, -0.2, 1).addScaledVector(r.side, 0).normalize(), grav: 0.3, lift: 0.004, seg: 6, hug: 0.9 });
      tail(F, base, sd, [0, 0.02, 0.105], 0.3, 0.03, 0.01, rng, locks);
      break;
    }
    case 'topknot': { // shaved sides, top swept up into a knot
      cap(0.004, { side: 0.075 });
      field({ th: [-0.9, 0.9], ph: [0.8, 1.2], nT: 7, nP: 2, L: 0.13, r0: 0.016, dir: back, grav: 0.1, lift: 0.006, seg: 7, hug: 0.9 });
      const knot = F.hp([0, 0.2, 0.04]);
      sd.sphere(knot.toArray(), 0.038 * s, { k: 0.01 * s, tag: 0 });
      sd.torus(F.hp([0, 0.18, 0.04]).toArray(), 0.03 * s, 0.009 * s, { k: 0.005 * s, tag: 0 });
      tail(F, base, sd, [0, 0.215, 0.07], 0.2, 0.022, 0.008, rng, locks, V(0, 0.4, 1));
      break;
    }
    case 'mohawk': { // spiked crest, shaved sides
      cap(0.003, { side: 0.08 });
      for (let i = 0; i < 9; i++) {
        const t = i / 8, ph = lerp(0.75, -0.2, t), th = t < 0.5 ? 0 : PI;
        const phh = t < 0.5 ? lerp(0.75, 1.5, t * 2) : lerp(1.5, -0.1, (t - 0.5) * 2);
        const r = scalp(F, th, phh);
        add(growLock(F, base, r, { L: lerp(0.11, 0.07, t) * s, r0: 0.02 * s, dir: r.n.clone().addScaledVector(r.down, -0.9).normalize(), grav: 0.05, lift: 0.004 * s, seg: 5 }));
        void ph;
      }
      break;
    }
    case 'backbraid': { // swept back into a long braid
      cap(0.007);
      field({ th: [-1.0, 1.0], ph: [0.62, 1.0], nT: 9, nP: 2, L: 0.2, r0: 0.014, dir: back, grav: 0.4, gravStart: 0.7, lift: 0.006, seg: 9, hug: 0.9 });
      field({ th: [1.05, 5.23], ph: [0.2, 0.9], nT: 10, nP: 2, L: 0.11, r0: 0.013, dir: () => V(0, -0.1, 1), grav: 0.3, lift: 0.004, seg: 6, hug: 0.9 });
      braid(F, base, sd, [0, 0.04, 0.1], [0, -1, 0.25], 0.36, 0.026, 1);
      break;
    }
    // ---------------- female ----------------
    case 'fem_long': { // long straight hair with a side-swept fringe
      cap(0.008, { ears: false, side: 0.045, nape: -0.12, foreY: 0.03 });
      for (const sg of [-1, 1]) field({ th: [sg * 0.35, sg * 2.8], ph: [1.0, 1.3], nT: 7, nP: 1, L: sg < 0 ? 0.48 : 0.46, r0: 0.02, dir: (r) => r.down.clone().addScaledVector(r.side, sg * 0.3).normalize(), grav: 1, gravStart: 0.3, lift: 0.012, seg: 12, bodyOff: 0.012, hug: 0.35 }, 1);
      for (const sg of [-1, 1]) field({ th: [sg * 0.95, sg * 1.5], ph: [0.35, 0.8], nT: 3, nP: 2, L: 0.42, r0: 0.017, dir: down, grav: 1, lift: 0.012, seg: 11, hug: 0.2 }, 1);
      field({ th: [2.3, 4.0], ph: [-0.3, 0.9], nT: 8, nP: 3, L: 0.46, r0: 0.02, dir: down, grav: 1, lift: 0.012, seg: 12, hug: 0.25 }, 1);
      fringe(F, base, add, rng, { side: 1, n: 6, L: 0.13 });
      break;
    }
    case 'fem_ponytail': { // high ponytail, side bangs
      cap(0.006, { foreY: 0.035 });
      field({ th: [-1.1, 1.1], ph: [0.55, 0.95], nT: 10, nP: 2, L: 0.16, r0: 0.012, dir: back, grav: 0.1, lift: 0.004, seg: 7, hug: 0.95 });
      field({ th: [1.1, 5.18], ph: [0.0, 0.8], nT: 10, nP: 2, L: 0.14, r0: 0.012, dir: (r) => r.down.clone().multiplyScalar(-1).add(V(0, 0.3, 0.4)).normalize(), grav: 0, lift: 0.003, seg: 6, hug: 0.95 });
      tail(F, base, sd, [0, 0.19, 0.075], 0.55, 0.034, 0.012, rng, locks, V(0, 0.2, 1));
      for (const sg of [-1, 1]) { const r = scalp(F, sg * 0.95, 0.4); add(growLock(F, base, r, { L: 0.2 * s, r0: 0.009 * s, dir: r.down, grav: 1, lift: 0.006 * s, seg: 8 }), 0); }
      fringe(F, base, add, rng, { side: -1, n: 5, L: 0.1 });
      break;
    }
    case 'fem_bun': { // bun at the back of the crown, loose strands framing the face
      cap(0.006, { foreY: 0.035 });
      field({ th: [-1.1, 1.1], ph: [0.55, 0.95], nT: 10, nP: 2, L: 0.16, r0: 0.012, dir: back, grav: 0.1, lift: 0.004, seg: 7, hug: 0.95 });
      field({ th: [1.1, 5.18], ph: [0.0, 0.8], nT: 10, nP: 2, L: 0.13, r0: 0.012, dir: (r) => r.down.clone().multiplyScalar(-1).add(V(0, 0.2, 0.5)).normalize(), grav: 0, lift: 0.003, seg: 6, hug: 0.95 });
      bun(F, sd, [0, 0.16, 0.1], 0.052);
      for (const sg of [-1, 1]) { const r = scalp(F, sg * 1.0, 0.38); add(growLock(F, base, r, { L: 0.22 * s, r0: 0.008 * s, dir: r.down, grav: 1, lift: 0.006 * s, seg: 8, curl: V(-sg * 0.1, 0, -0.1) }), 0); }
      fringe(F, base, add, rng, { side: 1, n: 4, L: 0.08 });
      break;
    }
    case 'fem_braids': { // twin braids over the shoulders
      cap(0.007, { foreY: 0.035 });
      field({ th: [-1.1, 1.1], ph: [0.55, 1.0], nT: 10, nP: 2, L: 0.13, r0: 0.012, dir: back, grav: 0.3, lift: 0.004, seg: 7 });
      for (const sg of [-1, 1]) field({ th: [sg * 1.1, sg * 2.7], ph: [0.1, 0.9], nT: 5, nP: 2, L: 0.1, r0: 0.012, dir: (r) => r.down.clone().addScaledVector(r.side, -sg * 0.3).normalize(), grav: 0.6, lift: 0.004, seg: 6 });
      for (const sg of [-1, 1]) braid(F, base, sd, [sg * 0.085, 0.0, 0.01], [sg * 0.12, -1, -0.32], 0.34, 0.024, sg < 0 ? 2 : 3);
      fringe(F, base, add, rng, { side: 0, n: 6, L: 0.09 });
      break;
    }
    case 'fem_bob': { // chin-length bob with blunt bangs, tips turned in
      cap(0.008, { ears: false, side: 0.045, nape: -0.08, foreY: 0.03 });
      field({ th: [-3.0, 3.0], ph: [0.85, 1.3], nT: 16, nP: 1, L: (th) => 0.17 - 0.03 * Math.cos(th), r0: 0.02, dir: (r) => r.down.clone().addScaledVector(r.n, 0.25).normalize(), grav: 1, lift: 0.018, seg: 9, curl: (r) => r.n.clone().multiplyScalar(-0.35), curlK: 1.2 });
      field({ th: [2.2, 4.1], ph: [-0.1, 0.7], nT: 6, nP: 2, L: 0.12, r0: 0.018, dir: down, grav: 1, lift: 0.014, seg: 7, curl: (r) => r.n.clone().multiplyScalar(-0.3) });
      fringe(F, base, add, rng, { side: 0, n: 8, L: 0.085, blunt: true });
      break;
    }
    case 'fem_pigtails': { // twin tails
      cap(0.006, { foreY: 0.035 });
      field({ th: [-1.1, 1.1], ph: [0.55, 1.0], nT: 10, nP: 2, L: 0.12, r0: 0.012, dir: (r, th) => r.down.clone().multiplyScalar(-1).addScaledVector(r.side, th > 0 ? 0.6 : -0.6).normalize(), grav: 0.1, lift: 0.004, seg: 6 });
      field({ th: [1.2, 5.08], ph: [0.0, 0.9], nT: 10, nP: 2, L: 0.11, r0: 0.012, dir: (r, th) => V(Math.sin(th) > 0 ? 0.6 : -0.6, 0.3, 0.3).normalize(), grav: 0.1, lift: 0.003, seg: 6 });
      for (const sg of [-1, 1]) tail(F, base, sd, [sg * 0.1, 0.1, 0.045], 0.42, 0.03, 0.01, rng, locks, V(sg * 0.5, -0.2, 0.2), sg < 0 ? 2 : 3);
      fringe(F, base, add, rng, { side: 0, n: 7, L: 0.09 });
      break;
    }
    case 'fem_buns': { // double buns
      cap(0.006, { foreY: 0.035 });
      field({ th: [-1.1, 1.1], ph: [0.55, 1.0], nT: 10, nP: 2, L: 0.12, r0: 0.012, dir: back, grav: 0.1, lift: 0.004, seg: 6 });
      field({ th: [1.2, 5.08], ph: [0.0, 0.9], nT: 10, nP: 2, L: 0.1, r0: 0.012, dir: (r) => r.down.clone().multiplyScalar(-1).add(V(0, 0.2, 0.2)).normalize(), grav: 0.1, lift: 0.003, seg: 6 });
      for (const sg of [-1, 1]) bun(F, sd, [sg * 0.075, 0.15, 0.05], 0.042);
      fringe(F, base, add, rng, { side: 0, n: 7, L: 0.08 });
      break;
    }
    case 'fem_swept': { // side-swept long hair gathered over the left shoulder
      cap(0.008, { ears: false, side: 0.045, nape: -0.1, foreY: 0.03 });
      field({ th: [-2.9, 2.9], ph: [0.95, 1.3], nT: 12, nP: 1, L: 0.46, r0: 0.02, dir: (r) => r.down.clone().addScaledVector(r.side, -0.35).normalize(), grav: 1.2, gravStart: 0.35, lift: 0.014, seg: 12, bodyOff: 0.014, hug: 0.45, curl: () => V(-0.18, 0, -0.05) }, 1);
      field({ th: [2.2, 4.1], ph: [-0.2, 0.8], nT: 6, nP: 2, L: 0.4, r0: 0.018, dir: (r) => V(-0.3, -1, 0.1).normalize(), grav: 1.2, lift: 0.012, seg: 11, hug: 0.3, curl: () => V(-0.15, 0, -0.1) }, 1);
      field({ th: [-1.7, -0.6], ph: [0.3, 0.8], nT: 4, nP: 2, L: 0.44, r0: 0.018, dir: down, grav: 1, lift: 0.012, seg: 11 }, 1);
      fringe(F, base, add, rng, { side: -1, n: 6, L: 0.14 });
      break;
    }
    default: cap(0.008);
  }
  // lock primitives
  for (const lk of locks) {
    for (let i = 0; i < lk.pts.length - 1; i++) {
      const a = lk.pts[i], b = lk.pts[i + 1];
      const hanging = lk.tag !== 0 && b.y < F.H.y + 0.02;
      sd.cone(a.toArray(), b.toArray(), lk.rad[i], lk.rad[i + 1], { k: (i === 0 ? 0.012 : lk.tag ? 0.008 : 0.005) * s, tag: hanging ? lk.tag : 0 });
    }
  }
  return sd;
}

function fringe(F, base, add, rng, o) { // bangs across the forehead, swept to one side (o.side −1 / 0 / +1)
  const n = (o.n || 6) + 2;
  for (let i = 0; i < n; i++) {
    const th = lerp(-0.72, 0.72, i / (n - 1)) + (rng.next() - 0.5) * 0.06;
    const r = scalp(F, th, 0.92 + 0.06 * Math.cos(th * 2));
    const dir = r.down.clone().addScaledVector(r.side, (o.side ?? 0) * 0.45 - th * 0.2).addScaledVector(r.n, 0.25).normalize();
    add(growLock(F, base, r, { L: o.L * F.s * (o.blunt ? 1 : 0.85 + rng.next() * 0.3), r0: 0.015 * F.s, r1: o.blunt ? 0.006 * F.s : 0.002 * F.s, dir, grav: 0.45, lift: 0.012 * F.s, seg: 6, hug: 0.25 }), 0);
  }
}
function tail(F, base, sd, at, L, r0, r1, rng, locks, dir0 = V(0, -0.3, 1), tag = 1) { // gathered tail (ponytail / twin tail)
  const s = F.s, root = F.hp(at);
  sd.torus(root.toArray(), r0 * s * 0.95, 0.007 * s, { k: 0.004 * s, tag: 0, rot: rotEuler(Math.PI / 2 - 0.4, 0, 0) });
  for (let k = 0; k < 5; k++) { // a bundle of strands flowing out of the tie
    const off = V((rng.next() - 0.5) * r0 * s, (rng.next() - 0.5) * r0 * s, (rng.next() - 0.5) * r0 * s * 0.5);
    const r = { p: root.clone().add(off), n: dir0.clone(), down: V(0, -1, 0), side: V(1, 0, 0) };
    const lk = growLock(F, base, r, { L: L * s * (0.85 + rng.next() * 0.25), r0: r0 * s * 0.75, r1: r1 * s * 0.4, dir: dir0.clone().normalize().add(V((rng.next() - 0.5) * 0.25, -0.35, 0)), grav: 2.4, gravStart: 0.0, lift: 0, off: 0.005 * s, seg: 11, bodyOff: 0.02 });
    locks.push({ ...lk, tag });
  }
}
function braid(F, base, sd, start, dir, len, r, tag) {
  const s = F.s;
  const p0 = F.hp(start), d = V(...dir).normalize();
  const n = Math.round(len / (r * 1.25));
  for (let i = 0; i < n; i++) {
    const t = i / n, wob = (i % 2 ? 1 : -1) * r * 0.35;
    const c = p0.clone().addScaledVector(d, len * t * s).add(V(wob * 0.5 * s, 0, wob * 0.3 * s));
    if (c.y < F.H.y) pushBody(base, c, r * s * 0.9 + 0.008);
    sd.ell(c.toArray(), [r * s * (1 - t * 0.3), r * s * 0.85, r * s * (1 - t * 0.3)], { k: 0.005 * s, tag: c.y < F.H.y + 0.02 ? tag : 0, rot: rotEuler(0, 0, (i % 2 ? 0.45 : -0.45)) });
  }
  const end = p0.clone().addScaledVector(d, len * s);
  sd.cone(end.toArray(), end.clone().add(V(0, -0.05 * s, 0.01 * s)).toArray(), r * s * 0.55, 0.002, { k: 0.004 * s, tag });
}
function bun(F, sd, at, r) {
  const s = F.s, c = F.hp(at);
  sd.sphere(c.toArray(), r * s, { k: 0.008 * s, tag: 0 });
  for (let i = 0; i < 3; i++) sd.torus(c.toArray(), r * s * (0.55 + i * 0.18), 0.007 * s, { k: 0.004 * s, tag: 0, rot: rotEuler(0.4 + i * 0.5, i * 0.9, 0.2) });
}

// ------------------------------------------------------------------------------------------------
export function lockHairPiece(base, style, sex) {
  if (!style || style === 'bald') return null;
  return cached(`${base.headKey}|hair2|${style}`, () => {
    const F = frame(base), s = F.s, H = F.H;
    const rng = new RNG(style.length * 131 + 7);
    const sd = buildStyle(F, base, style, sex, rng);
    sd.build();
    // strand grooves perturb the surface for a combed, clumpy read
    const groove = (d0, x, y, z) => {
      if (d0 > 0.01) return d0;
      const az = Math.atan2(x - H.x, z - H.z);
      return d0 + 0.0016 * s * (Math.abs(Math.sin(az * 18 + (y - H.y) * 14)) - 0.5);
    };
    const wrap = { eval: (x, y, z) => groove(sd.eval(x, y, z), x, y, z), near: (cx, cy, cz, R) => { const f = sd.near(cx, cy, cz, R); return (x, y, z) => groove(f(x, y, z), x, y, z); } };
    const LQ = base.L?.hair ?? 1;
    const long = /long|swept|braid|tail|ponytail/.test(style) && style !== 'swept';
    const cell = (LQ < 1 ? 0.011 : long ? 0.0068 : 0.0062) * s;
    const bmin = [H.x - 0.24 * s, H.y - (long ? 0.62 : 0.3) * s, H.z - 0.22 * s], bmax = [H.x + 0.24 * s, H.y + 0.34 * s, H.z + 0.36 * s];
    const fn = (x, y, z) => wrap.eval(x, y, z);
    let m = surfaceNets(fn, bmin, bmax, cell, { refine: -1, near: (x, y, z, R) => wrap.near(x, y, z, R) });
    const target = Math.round((long ? 1150 : 900) * LQ);
    if (m.pos.length / 3 > target) m = simplify(m.pos, m.nrm, m.idx, target);
    refineVerts(fn, m.pos, m.nrm, cell, 1);
    const n = m.pos.length / 3;
    const pc = makePiece(n, m.idx.length);
    pc.pos.set(m.pos); pc.nrm.set(m.nrm); pc.idx.set(m.idx);
    const headFn = (x, y, z) => Math.min(fn(x, y, z), base.sdfHead.eval(x, y, z));
    const pd = new Float32Array(sd.n);
    const J = base.JJ.J, tailY = [J.hairA[1], J.hairB[1], J.hairC[1]];
    const yTop = H.y + 0.02;
    for (let v = 0; v < n; v++) {
      const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
      const nx = m.nrm[v * 3], ny = m.nrm[v * 3 + 1], nz = m.nrm[v * 3 + 2];
      // weights: nearest primitive's tag decides the bone chain
      sd.evalPrims(x, y, z, pd);
      let bestT = 0, bestD = 1e9;
      for (let i = 0; i < sd.n; i++) if (sd.opOf(i) === ADD && pd[i] < bestD) { bestD = pd[i]; bestT = sd.tagOf(i); }
      let w;
      if (bestT === 0 || y > yTop) w = [[B.head, 1]];
      else if (bestT === 1) {
        const side = Math.abs(x - H.x) > 0.07 * s && z < J.head[2] + 0.02;
        if (side) { const sL = x < H.x; const b1 = sL ? B.braidL1 : B.braidR1, b2 = sL ? B.braidL2 : B.braidR2; const t = clamp((yTop - y) / 0.4, 0, 1); w = [[B.head, Math.max(0.001, 1 - t * 2)], [b1, Math.min(t, 1 - t) * 2 + 0.01], [b2, Math.max(0, t * 2 - 1)]]; }
        else if (y > tailY[0]) w = [[B.head, 0.6], [B.hairA, 0.4]];
        else if (y > tailY[1]) { const t = (tailY[0] - y) / (tailY[0] - tailY[1]); w = [[B.hairA, 1 - t], [B.hairB, t]]; }
        else if (y > tailY[2]) { const t = (tailY[1] - y) / (tailY[1] - tailY[2]); w = [[B.hairB, 1 - t], [B.hairC, t]]; }
        else w = [[B.hairC, 1]];
      } else { // braids / twin tails
        const b1 = bestT === 2 ? B.braidL1 : B.braidR1, b2 = bestT === 2 ? B.braidL2 : B.braidR2;
        const y1 = J[bestT === 2 ? 'braidL2' : 'braidR2'][1];
        const t = clamp((H.y - y) / (H.y - y1 + 1e-4), 0, 1);
        w = [[B.head, Math.max(0.001, 1 - t * 2)], [b1, Math.min(t, 1 - t) * 2 + 0.01], [b2, Math.max(0, t * 2 - 1)]];
      }
      let sw = 0; for (const [, ww] of w) sw += ww;
      for (let k = 0; k < 4; k++) { if (k < w.length) { pc.bi[v * 4 + k] = w[k][0]; pc.bw[v * 4 + k] = w[k][1] / sw; } else { pc.bi[v * 4 + k] = 0; pc.bw[v * 4 + k] = 0; } }
      // shading: AO (between locks and against the head), strand streaks, crown sheen, lighter tips
      const ao = sdfAO(headFn, x, y, z, nx, ny, nz, 0.006, 1);
      const az = Math.atan2(x - H.x, z - H.z), ly = (y - H.y) / s;
      const streak = 0.8 + 0.28 * Math.pow(Math.abs(Math.sin(az * 18 + ly * 14)), 0.6) + 0.08 * NZ.noise2(az * 11, ly * 30);
      const sheen = 0.2 * Math.exp(-Math.pow((ly - 0.16) / 0.045, 2)) * Math.max(0, ny + 0.3);
      const tip = 1 + 0.12 * smoothstep(0, -0.35, ly);
      const f = (0.42 + 0.58 * ao) * (streak * (0.82 + 0.26 * Math.max(0, ny)) + sheen) * tip;
      pc.mul[v * 3] = f; pc.mul[v * 3 + 1] = f; pc.mul[v * 3 + 2] = f;
      pc.slot[v] = SLOT.HAIR;
    }
    return pc;
  });
}
