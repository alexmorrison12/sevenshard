// Class silhouette pieces (skinned, cached per base + spec): hats, headbands with tails, sash tails, ribbons, scarves,
// coat tails, high collars, bandoliers, chains, gauntlet shells, hip chains. Built in bind space like pieces.js.
import * as THREE from 'three';
import { PB, cached, tubeGeo, topLit, ringSweep, chainFrame, PROFILES, axisMatrix, M4 } from './pieces.js';
import { marchIn } from './sdf.js';
import { limbShellPiece } from './armor.js';
import { B } from './rig.js';
import { SLOT } from './palette.js';
import { clamp, lerp, smoothstep, Simplex } from '../../core/noise.js';

const NZ = new Simplex(909);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Double-sided thin strip along a path. pts: Vector3[], widths: number[], sides: Vector3[] (width direction, will be
 * orthogonalised), bwFn(i, t) → [[bone, w], ...]. o: { th, slot, slotFn(i, j), mulFn(t, j), rune, emis }
 */
export function ribbon(pb, pts, widths, sides, bwFn, o = {}) {
  const n = pts.length, th = o.th ?? 0.006;
  const T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3();
  const ids = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    if (i < n - 1) T.subVectors(pts[i + 1], pts[i]); else T.subVectors(pts[i], pts[i - 1]);
    T.normalize();
    S.copy(sides[i]).addScaledVector(T, -sides[i].dot(T)).normalize();
    N.crossVectors(T, S).normalize();
    const w = widths[i] * 0.5, bw = bwFn(i, t);
    const row = [];
    for (const face of [1, -1]) for (const e of [-1, 1]) {
      const p = pts[i];
      const x = p.x + S.x * w * e + N.x * th * 0.5 * face, y = p.y + S.y * w * e + N.y * th * 0.5 * face, z = p.z + S.z * w * e + N.z * th * 0.5 * face;
      const f = o.mulFn ? o.mulFn(t, e) : (face > 0 ? 0.95 : 0.7);
      const slot = o.slotFn ? o.slotFn(i, e, t) : (o.slot ?? SLOT.SASH);
      row.push(pb.v(x, y, z, N.x * face, N.y * face, N.z * face, slot, [f * (face > 0 ? 1 : 0.75), f * (face > 0 ? 1 : 0.75), f * (face > 0 ? 1 : 0.75)], o.emis || 0, bw, o.rune || 0));
    }
    ids.push(row);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = ids[i], b = ids[i + 1];
    // front (face +): verts 0 (e-), 1 (e+); back: 2, 3
    pb.tri(a[0], b[0], b[1]); pb.tri(a[0], b[1], a[1]);
    pb.tri(a[2], b[3], b[2]); pb.tri(a[2], a[3], b[3]);
    pb.tri(a[1], b[1], b[3]); pb.tri(a[1], b[3], a[3]);
    pb.tri(a[0], b[2], b[0]); pb.tri(a[0], a[2], b[2]);
  }
  return ids;
}
/** weights along a chain of bones by parameter t (0 at bones[0]) */
function chainW(bones, t) {
  const k = clamp(t, 0, 1) * (bones.length - 1), i = Math.min(bones.length - 2, Math.floor(k)), f = k - i;
  return [[bones[i], 1 - f + 1e-3], [bones[i + 1], f + 1e-3]];
}
function headFrame(base) {
  const d = base.P.headDef, s = d.s, H = base.JJ.J.head, cr = d.cranium;
  const cc = [H[0] + cr.c[0] * s, H[1] + cr.c[1] * s, H[2] + cr.c[2] * s];
  return { d, s, H, cc, rx: cr.r[0] * s, ry: cr.r[1] * s, rz: cr.r[2] * s, browY: H[1] + (d.browY ?? 0.1) * s };
}

// ------------------------------------------------------------------------------------------------
/** headband with two long tails (Stormfist) */
export function headbandPiece(base, sp = {}) {
  return cached(`${base.headKey}|headband|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const F = headFrame(base);
    const bw = [[B.head, 1]];
    const r = Math.max(F.rx, F.rz) + 0.004;
    const y = F.browY + 0.034 * F.s;
    const band = new THREE.TorusGeometry(r, 0.0085 * F.s, 5, 30);
    const sc = new THREE.Matrix4().makeScale(0.99 * F.rx / Math.max(F.rx, F.rz) + 0.03, (F.rz + 0.006) / r, 2.2);
    pb.add(band, { m: new THREE.Matrix4().makeTranslation(F.cc[0], y, F.cc[2] + 0.002).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.22)).multiply(sc), slot: SLOT.SASH, bw, mulFn: topLit(0.25, 0.9) });
    if (sp.plate) pb.add(new THREE.BoxGeometry(0.05 * F.s, 0.022 * F.s, 0.008), { m: new THREE.Matrix4().makeTranslation(F.cc[0], y - 0.004, F.cc[2] - F.rz - 0.006).multiply(new THREE.Matrix4().makeRotationX(0.25)), slot: SLOT.METAL, bw, mulFn: topLit(0.3, 0.8) });
    const kz = F.cc[2] + F.rz + 0.012, ky = y - 0.018;
    pb.add(new THREE.SphereGeometry(0.022 * F.s, 7, 5), { m: new THREE.Matrix4().makeTranslation(F.cc[0], ky, kz), slot: SLOT.SASH, bw, mulFn: topLit(0.2, 0.85) });
    const J = base.JJ.J;
    const len = sp.len ?? 0.55;
    for (const sg of [-1, 1]) {
      const pts = [], wid = [], sides = [];
      for (let i = 0; i <= 9; i++) {
        const t = i / 9;
        pts.push(v3(F.cc[0] + sg * (0.012 + t * 0.07), ky - t * len * 0.85, kz + 0.01 + t * len * 0.35 + Math.sin(t * 5 + sg) * 0.012));
        wid.push(0.042 * (1 - t * 0.25)); sides.push(v3(1, 0, sg * 0.4));
      }
      ribbon(pb, pts, wid, sides, (i, t) => t < 0.12 ? [[B.head, 1]] : chainW([B.head, B.hairA, B.hairB, B.hairC], t * 1.05), { slot: SLOT.SASH, th: 0.005 });
    }
    return pb.build();
  });
}

/** wide-brim hat, cocked, with a band and a feather (Pistoleer) */
export function hatPiece(base, sp = {}) {
  return cached(`${base.headKey}|hat|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const F = headFrame(base);
    const bw = [[B.head, 1]];
    const R0 = Math.max(F.rx, F.rz) + 0.012, brimR = R0 + (sp.brim ?? 0.16) * F.s;
    const y0 = F.browY + 0.02 * F.s;
    const cock = new THREE.Matrix4().makeTranslation(F.cc[0], y0, F.cc[2]).multiply(new THREE.Matrix4().makeRotationZ(0.1)).multiply(new THREE.Matrix4().makeRotationX(-0.08));
    const brim = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.004), new THREE.Vector2(R0, 0.0), new THREE.Vector2(brimR * 0.75, -0.012), new THREE.Vector2(brimR, 0.006), new THREE.Vector2(brimR + 0.006, 0.016), new THREE.Vector2(brimR - 0.008, 0.012), new THREE.Vector2(brimR * 0.75, -0.004), new THREE.Vector2(R0, 0.008), new THREE.Vector2(0.001, 0.012)], 28);
    // curl the brim sides up
    const bp = brim.attributes.position;
    for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i), rr = Math.hypot(x, z); if (rr > R0) { const k = (rr - R0) / (brimR - R0); bp.setY(i, bp.getY(i) + k * k * 0.06 * Math.pow(Math.abs(x) / rr, 2)); } }
    brim.computeVertexNormals();
    const sz = new THREE.Matrix4().makeScale(1, 1, 1.12);
    pb.add(brim, { m: cock.clone().multiply(sz), slot: SLOT.COAT2, bw, mulFn: topLit(0.25, 0.82) });
    const crown = new THREE.LatheGeometry([new THREE.Vector2(R0 + 0.006, 0.0), new THREE.Vector2(R0 + 0.004, 0.06 * F.s), new THREE.Vector2(R0 * 0.92, 0.1 * F.s), new THREE.Vector2(R0 * 0.55, 0.115 * F.s), new THREE.Vector2(0.001, 0.1 * F.s)], 20);
    const cp = crown.attributes.position; // pinched crown dent
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i); if (y > 0.07 * F.s) cp.setY(i, y - Math.exp(-x * x / 0.0008) * 0.022 * F.s); }
    crown.computeVertexNormals();
    pb.add(crown, { m: cock.clone().multiply(sz), slot: SLOT.COAT2, bw, mulFn: topLit(0.3, 0.8) });
    const band = new THREE.TorusGeometry(R0 + 0.007, 0.011, 4, 22);
    pb.add(band, { m: cock.clone().multiply(sz).multiply(new THREE.Matrix4().makeTranslation(0, 0.016, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), slot: SLOT.SASH, bw });
    pb.add(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 8).rotateZ(Math.PI / 2), { m: cock.clone().multiply(new THREE.Matrix4().makeTranslation(R0 + 0.01, 0.018, 0.02)), slot: SLOT.TRIM, bw });
    if (sp.feather !== false) { // plume sweeping back from the band
      const pts = [], wid = [], sides = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(v3(F.cc[0] + R0 * 0.8 + t * 0.03, y0 + 0.03 + t * 0.12 - t * t * 0.07, F.cc[2] + 0.03 + t * 0.26)); wid.push(0.05 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 0.006); sides.push(v3(0.3, 1, 0.2)); }
      ribbon(pb, pts, wid, sides, () => [[B.head, 1]], { slot: SLOT.FEATHER, th: 0.004, mulFn: (t, e) => 0.8 + 0.25 * (e > 0 ? 1 : 0.6) });
    }
    return pb.build();
  });
}

/** hanging sash / ribbon tails from the belt (swing with the back flap bones) */
export function tailsPiece(base, sp = {}) {
  return cached(`${base.key}|tails|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J;
    const fn = base.chainSDF.torso;
    const y0 = J.spine[1] + (sp.dy ?? -0.045);
    const list = sp.list || [{ a: 2.5, len: 0.55, w: 0.07 }, { a: 2.75, len: 0.45, w: 0.06 }];
    for (const tl of list) { // a: angle around the waist (0 front, +π/2 right, π back)
      const dx = Math.sin(tl.a), dz = -Math.cos(tl.a);
      const rr = marchIn((x, y, z) => fn.eval(x, y, z), 0, y0, J.spine[2], dx, 0, dz, 0.5) + (sp.off ?? 0.03);
      const pts = [], wid = [], sides = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const out = rr + t * (tl.out ?? 0.07);
        pts.push(v3(dx * out + Math.sin(t * 4 + tl.a) * 0.01, y0 - t * tl.len, J.spine[2] + dz * out));
        wid.push(tl.w * (1 - t * (tl.taper ?? 0.2)) * (tl.point && t > 0.85 ? (1 - t) / 0.15 : 1)); sides.push(v3(-dz, 0, dx));
      }
      const front = Math.cos(tl.a) > 0;
      const bones = front ? [B.hips, B.skirtF, B.skirtF2] : [B.hips, B.skirtB, B.skirtB2];
      ribbon(pb, pts, wid, sides, (i, t) => chainW(bones, Math.min(1, t * 1.2)), { slot: tl.slot ?? sp.slot ?? SLOT.SASH, th: 0.006, rune: tl.rune || 0 });
      if (tl.knot) pb.add(new THREE.SphereGeometry(0.03, 7, 5), { m: new THREE.Matrix4().makeTranslation(dx * rr, y0 + 0.01, J.spine[2] + dz * rr).multiply(new THREE.Matrix4().makeScale(1.3, 0.9, 0.8)), slot: tl.slot ?? sp.slot ?? SLOT.SASH, bw: [[B.hips, 1]], mulFn: topLit(0.2, 0.85) });
    }
    return pb.build();
  });
}

/** scarf around the neck with two tails fluttering behind (weighted to the cape bones) */
export function scarfPiece(base, sp = {}) {
  return cached(`${base.key}|scarf|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J;
    const y = J.neck[1] - 0.005;
    const f = chainFrame(base, 'torso', y);
    ringSweep(pb, { ...f, sdf: base.chainSDF.torso, n: 20, off: 0.012, profile: PROFILES.tube(sp.w ?? 0.07), slot: SLOT.SASH, rMax: 0.3, smooth: 3, mulFn: (j, k, m) => { const q = 0.85 + 0.15 * Math.sin(j * 1.7); return [m[0] * q, m[1] * q, m[2] * q]; } });
    const fn = base.chainSDF.torso;
    for (const sg of [-1, 1]) {
      const pts = [], wid = [], sides = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, yy = y - 0.02 - t * (sp.len ?? 0.6);
        const x = sg * (0.04 + t * 0.05);
        const rr = marchIn((xx, yy2, zz) => fn.eval(xx, yy2, zz), x, Math.max(yy, J.spine[1]), J.spine[2], 0, 0, 1, 0.5);
        pts.push(v3(x, yy, J.spine[2] + rr + 0.035 + t * 0.05));
        wid.push((sp.tw ?? 0.075) * (1 - t * 0.2)); sides.push(v3(1, 0, 0));
      }
      ribbon(pb, pts, wid, sides, (i, t) => t < 0.05 ? [[B.chest, 1]] : chainW([B.cape0, B.cape1, B.cape2, B.cape3], t * 0.9), { slot: SLOT.SASH, th: 0.007 });
    }
    return pb.build();
  });
}

/** tall flared collar open at the front (Starcaller robe, coats) */
export function collarPiece(base, sp = {}) {
  return cached(`${base.key}|collar|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J;
    const y = J.neck[1] + (sp.dy ?? 0.0);
    const f = chainFrame(base, 'torso', y);
    const w = sp.h ?? 0.14, open = sp.open ?? 0.7;
    const fl = sp.flare ?? 0.07, prof = [];
    const N = 7;
    for (let i = 0; i <= N; i++) { const t = i / N; prof.push([0.01 + fl * Math.pow(t, 1.8), -w * 0.2 + w * t]); }                 // outer face, curving outward
    prof.push([0.014 + fl * 1.08, w * 1.02], [0.006 + fl * 1.0, w * 1.02]);                                                               // rolled edge
    for (let i = N; i >= 0; i--) { const t = i / N; prof.push([0.002 + fl * Math.pow(t, 1.8) * 0.92, -w * 0.2 + w * t * 0.98]); }      // inner face
    ringSweep(pb, { ...f, sdf: base.chainSDF.torso, n: 26, arc: [open, Math.PI * 2 - open], off: 0.012, profile: prof, closedProfile: true, slot: sp.slot ?? SLOT.COAT, rMax: 0.3, smooth: 3,
      slotFn: (j, k) => (sp.trim && (k === N + 1 || k === N + 2 || k === N) ? SLOT.TRIM : k > N + 2 ? (sp.inner ?? sp.slot ?? SLOT.COAT2) : sp.slot ?? SLOT.COAT), bw: (x, yy, z) => [[B.chest, 0.6], [B.neck, 0.4]] });
    return pb.build();
  });
}

/** skirt split open at the front: coat tails / open robe (uses skirt rows, front opening + optional back slit) */
export function coatTailsPiece(base, sp = {}) {
  return cached(`${base.key}|coat|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J;
    const fn = base.chainSDF.torsoLegs;
    const y0 = J.spine[1] + (sp.top ?? -0.03), legTop = J.thighL[1];
    const hem = lerp(legTop, 0.06, sp.len ?? 0.75);
    const rows = 11, n = 26;
    const hemOff = (th) => sp.tatter ? -0.07 * Math.abs(NZ.noise2(th * 2.3, 4.1)) - ((Math.round(th * 4) % 2) ? 0.04 : 0) : 0;
    const open = sp.open ?? 0.34, slit = sp.slit ?? 0;
    const angs = [];
    for (let j = 0; j <= n; j++) angs.push(open + (Math.PI * 2 - 2 * open) * j / n);
    const ring = [];
    let prev = null;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, y = lerp(y0, hem, t);
      const rs = angs.map(th => Math.max(0.05, marchIn((x, yy, z) => fn.eval(x, yy, z), 0, y, J.hips[2], Math.sin(th), 0, -Math.cos(th), 0.6)));
      ring.hemY = hemOff;
      for (let it = 0; it < 3; it++) { const cp = rs.slice(); for (let j = 1; j < rs.length - 1; j++) rs[j] = Math.max(cp[j], (cp[j - 1] + cp[j + 1]) * 0.5); }
      const flare = (sp.flare ?? 0.14) * t * t;
      for (let j = 0; j < rs.length; j++) { rs[j] += (sp.off ?? 0.016) + flare; if (prev) rs[j] = Math.max(rs[j], prev[j] * (t > 0.3 ? 1 : 0.97)); }
      prev = rs.slice();
      ring.push({ y, rs, t });
    }
    const wfn = (x, y, t, z) => {
      const sL = smoothstep(0.06, -0.06, x), sR = 1 - sL;
      const back = smoothstep(-0.02, 0.08, z - J.hips[2]);
      const wh = 1 - smoothstep(0.0, 0.45, t) * 0.9 * (1 - back * 0.6);
      const wt = smoothstep(0.0, 0.45, t) * (1 - back * 0.65);
      const wb = smoothstep(0.1, 1, t) * back;
      const out = [[B.hips, wh + 0.001]];
      if (sL > 0.01) out.push([B.thighL, wt * sL]);
      if (sR > 0.01) out.push([B.thighR, wt * sR]);
      if (wb > 0.01) out.push([t > 0.6 ? B.skirtB2 : B.skirtB, wb]);
      out.sort((a, b) => b[1] - a[1]);
      return out.slice(0, 4);
    };
    const ids = [];
    for (let r = 0; r <= rows; r++) {
      const { y, rs, t } = ring[r];
      const row = [];
      for (let j = 0; j <= n; j++) {
        const th = angs[j], dx = Math.sin(th), dz = -Math.cos(th);
        const edge = j === 0 || j === n || Math.abs(th - Math.PI) < slit + 0.01;
        const slot = (sp.trim && (edge || t > 0.9)) ? SLOT.TRIM : (sp.slot ?? SLOT.COAT);
        const f = (0.88 + 0.14 * Math.sin(th * 7 + t * 1.5) * t) * (0.95 - 0.12 * t);
        const x = dx * rs[j], z = J.hips[2] + dz * rs[j];
        const yy = y + hemOff(th) * t * t;
        row.push(pb.v(x, yy, z, dx, 0.15, dz, slot, [f, f, f], 0, wfn(x, yy, t, z)));
      }
      ids.push(row);
    }
    for (let r = 0; r < rows; r++) for (let j = 0; j < n; j++) {
      const thm = (angs[j] + angs[j + 1]) / 2;
      if (slit && Math.abs(thm - Math.PI) < slit && ring[r].t > 0.25) continue;
      const a = ids[r][j], b = ids[r][j + 1], c = ids[r + 1][j + 1], d = ids[r + 1][j];
      pb.tri(a, d, c); pb.tri(a, c, b);
      pb.tri(a, c, d); pb.tri(a, b, c); // inner side (lining)
    }
    return pb.build();
  });
}

/** bandolier across the chest with cartridge loops */
export function bandolierPiece(base, sp = {}) {
  return cached(`${base.key}|bandolier|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J, P = base.P;
    const sh = [P.shX * 0.55, J.neck[1] - 0.01], hp = [-P.core[0] * 0.95, J.spine[1] - 0.06];
    let dx = hp[0] - sh[0], dy = hp[1] - sh[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    const axis = [dy, -dx, 0];
    const C = [(sh[0] + hp[0]) / 2, (sh[1] + hp[1]) / 2, J.spine[2]];
    const { rs, dirs } = ringSweep(pb, { sdf: base.chainSDF.torso, C, axis, front: [0, 0, -1], n: 32, off: 0.014, profile: PROFILES.band(0.05 * base.scale, 0.012), slot: SLOT.BELT, rMax: 0.5, stitch: true, smooth: 3 });
    const ax = new THREE.Vector3(...axis).normalize();
    for (let j = 0; j < 32; j++) {
      const d = dirs[j]; if (d.z > -0.35 || j % 2) continue;
      const r = rs[j] + 0.03;
      const c = v3(C[0] + d.x * r, C[1] + d.y * r, C[2] + d.z * r);
      const m = axisMatrix([c.x, c.y, c.z], [ax.x, ax.y, ax.z], [d.x, d.y, d.z]);
      pb.add(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6), { m, slot: SLOT.TRIM, bw: 'auto', mulFn: topLit(0.3, 0.95) });
      pb.add(new THREE.ConeGeometry(0.009, 0.014, 6), { m: m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.032, 0)), slot: SLOT.METAL, bw: 'auto' });
    }
    return pb.build();
  });
}

/** chains: links along curves (waist loop, chest diagonal, forearm wraps) */
export function chainsPiece(base, sp = {}) {
  return cached(`${base.key}|chains|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J, P = base.P;
    const fn = base.chainSDF.torsoLegs;
    const link = (p, dir, k, sz = 1) => {
      const g = new THREE.TorusGeometry(0.014 * sz, 0.0042 * sz, 3, 7);
      const m = axisMatrix([p.x, p.y, p.z], [dir.x, dir.y, dir.z], k % 2 ? [0, 0, 1] : [1, 0, 0]);
      m.multiply(new THREE.Matrix4().makeScale(1, 1.5, 1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      pb.add(g, { m, slot: SLOT.CHAIN, bw: 'auto', mulFn: (q, n) => { const f = 0.75 + 0.4 * Math.max(0, n.y); return [f, f, f]; } });
    };
    const along = (pts, sz) => { // place links every ~2.4 cm
      let acc = 0, k = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
        while (acc < L) { link(new THREE.Vector3().copy(a).addScaledVector(d, acc), d, k++, sz); acc += 0.024 * sz; }
        acc -= L;
      }
    };
    if (sp.waist !== false) { // sagging loop around the hips, lower at the front-left
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const th = i / 28 * Math.PI * 2, dx = Math.sin(th), dz = -Math.cos(th);
        const sag = 0.06 * Math.max(0, Math.cos(th + 0.6));
        const y = J.hips[1] - 0.02 - sag;
        const rr = marchIn((x, yy, z) => fn.eval(x, yy, z), 0, y, J.hips[2], dx, 0, dz, 0.5) + 0.018;
        pts.push(v3(dx * rr, y, J.hips[2] + dz * rr));
      }
      along(pts, 1);
    }
    if (sp.chest) { // diagonal from the right shoulder to the left hip (front)
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, x = lerp(P.shX * 0.6, -P.core[0], t), y = lerp(J.neck[1] - 0.02, J.spine[1] - 0.05, t);
        const rr = marchIn((xx, yy, z) => fn.eval(xx, yy, z), x, y, J.spine[2], 0, 0, -1, 0.5) + 0.02;
        pts.push(v3(x, y, J.spine[2] - rr));
      }
      along(pts, 1);
    }
    if (sp.hang) { // short hanging ends at the left hip
      const s = -1, x0 = s * (P.pelvis[0] + 0.02), y0 = J.hips[1] - 0.04;
      const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(v3(x0 + s * 0.01 * t, y0 - t * 0.22, J.hips[2] - 0.03 + Math.sin(t * 3) * 0.02)); }
      along(pts, 1);
    }
    return pb.build();
  });
}

/** big metal gauntlets (Stormfist): bulky forearm guards with a fin + armoured knuckles (skinned to the hand) */
export function gauntletPiece(base, side, sp = {}) {
  return cached(`${base.key}|gauntlet|${side}|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const P = base.P, A = base.JJ.A[side], sg = A.sg, n = A.n;
    const X = M4(A.RA, [A.S[0] - (A.RA[0] * A.S[0] + A.RA[1] * A.S[1] + A.RA[2] * A.S[2]), A.S[1] - (A.RA[3] * A.S[0] + A.RA[4] * A.S[1] + A.RA[5] * A.S[2]), A.S[2] - (A.RA[6] * A.S[0] + A.RA[7] * A.S[1] + A.RA[8] * A.S[2])]);
    const bf = B['farm' + side], bh = B['hand' + side];
    const hs = P.hand, sz = sp.size ?? 1;
    const E = n.E, W = n.W, K = n.K;
    const fr = P.farmR[0] + 0.012;
    // forearm guard: a sculpted shell over the forearm, flaring toward the wrist, with a raised rim
    const guardSh = limbShellPiece(base, 'arm' + side, 1.18, 2.02, { t: 0.02 * sz + 0.006, target: 520, runes: sp.runes, flare: 0.016 * sz, slot: SLOT.GLOVE });
    if (guardSh) { const o0 = pb.n; for (let i = 0; i < guardSh.n; i++) pb.v(guardSh.pos[i * 3], guardSh.pos[i * 3 + 1], guardSh.pos[i * 3 + 2], guardSh.nrm[i * 3], guardSh.nrm[i * 3 + 1], guardSh.nrm[i * 3 + 2], guardSh.slot[i], [guardSh.mul[i * 3], guardSh.mul[i * 3 + 1], guardSh.mul[i * 3 + 2]], 0, { bi: Array.from(guardSh.bi.slice(i * 4, i * 4 + 4)), bw: Array.from(guardSh.bw.slice(i * 4, i * 4 + 4)) }, guardSh.rune ? guardSh.rune[i] : 0); for (let t = 0; t < guardSh.idx.length; t += 3) pb.tri(o0 + guardSh.idx[t], o0 + guardSh.idx[t + 1], o0 + guardSh.idx[t + 2]); }
    // dorsal fin plate on the outer side of the forearm
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.035, 0.04); fin.lineTo(0.06, 0.2); fin.lineTo(0.0, 0.2); fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    fg.translate(0, 0, -0.005);
    const mfin = new THREE.Matrix4().makeTranslation(E[0] + sg * (fr + 0.022 * sz), W[1] + 0.02, E[2] + 0.01).multiply(new THREE.Matrix4().makeRotationY(sg > 0 ? 0 : Math.PI)).multiply(new THREE.Matrix4().makeRotationZ(-0.12)).multiply(new THREE.Matrix4().makeScale(sz * 0.9, sz, 1));
    pb.add(fg, { m: new THREE.Matrix4().multiplyMatrices(X, mfin), slot: SLOT.METAL, bw: [[bf, 1]], mulFn: topLit(0.3, 0.85) });
    // armoured hand: back plate + knuckle ridge + finger plates
    const back = new THREE.BoxGeometry(0.022 * hs, 0.075 * hs, 0.085 * hs);
    pb.add(back, { m: new THREE.Matrix4().multiplyMatrices(X, new THREE.Matrix4().makeTranslation(W[0] + sg * 0.024 * hs, W[1] - 0.05 * hs, W[2] - 0.004)), slot: SLOT.GLOVE, bw: [[bh, 1]], mulFn: topLit(0.25, 0.85) });
    const kn = new THREE.CapsuleGeometry(0.016 * hs, 0.07 * hs, 3, 6); kn.rotateX(Math.PI / 2);
    pb.add(kn, { m: new THREE.Matrix4().multiplyMatrices(X, new THREE.Matrix4().makeTranslation(K[0] + sg * 0.024 * hs, K[1] + 0.004, K[2] - 0.004)), slot: SLOT.TRIM, bw: [[bh, 1]], mulFn: topLit(0.3, 0.95), rune: sp.runes ? 1 : 0 });
    for (const [fz, fb] of [[-0.031, 'idx'], [-0.0105, 'fng'], [0.0105, 'fng'], [0.03, 'fng']]) {
      const pl = new THREE.BoxGeometry(0.016 * hs, 0.038 * hs, 0.02 * hs);
      pb.add(pl, { m: new THREE.Matrix4().multiplyMatrices(X, new THREE.Matrix4().makeTranslation(K[0] + sg * 0.014 * hs, K[1] - 0.024 * hs, K[2] + fz * hs)), slot: SLOT.GLOVE, bw: [[B[fb + side + '1'], 1]], mulFn: topLit(0.25, 0.85) });
    }
    return pb.build();
  });
}

/** short hanging chain at the hip that carries the tome (Oathkeeper) */
export function hipChainPiece(base, sp = {}) {
  return cached(`${base.key}|hipchain|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J, P = base.P;
    const sgn = sp.side === 'R' ? 1 : -1;
    const x0 = sgn * (P.pelvis[0] + 0.03), y0 = J.spine[1] - 0.04;
    let k = 0;
    for (let i = 0; i < 7; i++) {
      const t = i / 6, p = [x0 + sgn * 0.008 * t, y0 - t * 0.12, 0.02 - t * 0.01];
      const g = new THREE.TorusGeometry(0.012, 0.0038, 3, 7);
      const m = axisMatrix(p, [0, -1, 0], k++ % 2 ? [0, 0, 1] : [1, 0, 0]).multiply(new THREE.Matrix4().makeScale(1, 1.5, 1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      pb.add(g, { m, slot: SLOT.CHAIN, bw: [[B.hips, 1]] });
    }
    return pb.build();
  });
}
