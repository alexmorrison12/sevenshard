// Mount tack builders (saddle pad, saddle with pommel & cantle, girth, stirrups, reins, ornaments). Everything is a thin
// shell conforming to the SDF body (skinned like the flesh beneath) or a strap skinned along the bones it spans.
import * as THREE from 'three';
import { col } from '../../kit/sdf.js';
import { addHorn } from '../../kit/parts.js';
import { wrapGrid, shell, strap, ring, addG, linspace, skinAt, marchOut, sdfNormal, mixSkin, rigidSkin, lerp3, sstep, mix } from './common.js';

const V3 = THREE.Vector3;

/**
 * Saddle pad + saddle + girth + stirrups over a barrel.
 * o: { group, axis(z) → [cx, cy], pad: { z0, z1, th: (v) → half angle, nu, nv, off, main, trim, trim2, emisTrim },
 *      seat: { z0, z1, th: (v) → half angle, nu, nv, off, pommel, cantle, leather, seatCol, stitch, trimMetal },
 *      girth: { z, w, from } , stirrup: { x, y, z, top: [x,y,z], metal, leather, skin }, horn: bool }
 * → { seat: [x, y, z] } top of the seat (rider socket position)
 */
export function saddleSet(acc, S, o) {
  const g = o.group ?? 0, axis = o.axis;
  const out = {};
  // ---- saddle pad (shabraque): trimmed cloth under the saddle
  if (o.pad) {
    const p = o.pad, nv = p.nv ?? 7, nu = p.nu ?? 11;
    const G = wrapGrid(S, g, linspace(p.z0, p.z1, nv), (v) => linspace(-p.th(v), p.th(v), nu), axis);
    const cm = col(p.main), ct = col(p.trim), c2 = col(p.trim2 ?? p.main);
    shell(acc, S, G, {
      off: (u, v) => (p.off ?? 0.012) + 0.006 * (1 - sstep(0.0, 0.12, Math.min(u, 1 - u, v, 1 - v))), thick: p.thick ?? 0.014,
      color: (u, v) => {
        const e = Math.min(u * 1.6, (1 - u) * 1.6, v, 1 - v);
        if (e < 0.09) return ct;
        if (e < 0.14) return lerp3(cm, [0, 0, 0], 0.35);
        if (p.pattern && e > 0.2) return p.pattern(u, v, cm, c2) || cm;
        return e < 0.2 ? c2 : cm;
      },
      emis: p.emisTrim ? (u, v) => (Math.min(u * 1.6, (1 - u) * 1.6, v, 1 - v) < 0.09 ? p.emisTrim : 0) : null,
      dtl: [0, 0, 0.15, 0.45], recalcN: 0.5,
    });
  }
  // ---- saddle: leather shell with raised pommel & cantle, skirts down the sides
  if (o.seat) {
    const s = o.seat, nv = s.nv ?? 9, nu = s.nu ?? 9;
    const zs = linspace(s.z0, s.z1, nv);
    const G = wrapGrid(S, g, zs, (v) => linspace(-s.th(v), s.th(v), nu), axis);
    const prof = (u, v) => {
      const xn = (u - 0.5) * 2, ax = Math.abs(xn);
      const pom = (s.pommel ?? 0.1) * Math.exp(-(((v - 0.03) / 0.13) ** 2)) * Math.max(0, 1 - xn * xn * 1.5);
      const can = (s.cantle ?? 0.085) * Math.exp(-(((v - 0.97) / 0.14) ** 2)) * Math.max(0, 1 - xn * xn * 1.25);
      const seatH = (s.seatH ?? 0.035) * (1 - 0.55 * sstep(0.5, 0.95, ax));
      return (s.off ?? 0.02) + seatH + pom + can;
    };
    const cl = col(s.leather), cs = col(s.seatCol ?? s.leather), cst = col(s.stitch ?? s.leather), ctm = col(s.trimMetal ?? s.stitch ?? s.leather);
    shell(acc, S, G, {
      off: prof, thick: s.thick ?? 0.03, recalcN: true,
      color: (u, v) => {
        const xn = Math.abs(u - 0.5) * 2, e = Math.min(u * 1.2, (1 - u) * 1.2, v * 0.9, (1 - v) * 0.9);
        if (s.trimMetal && e < 0.05) return ctm;
        if (e < 0.08) return lerp3(cl, [0, 0, 0], 0.25);
        if (Math.abs(e - 0.12) < 0.02) return cst;
        return xn < 0.45 && v > 0.18 && v < 0.85 ? cs : cl;
      },
      emis: s.emisTrim ? (u, v) => (Math.min(u * 1.2, (1 - u) * 1.2, v * 0.9, (1 - v) * 0.9) < 0.05 ? s.emisTrim : 0) : null,
      dtl: [0, 0, 0.18, 0.2],
    });
    // seat point: lowest outer point along the centre column
    const ic = (nu - 1) / 2;
    let best = null;
    for (let j = 1; j < nv - 1; j++) {
      const P = G.P[j][ic], N = G.N[j][ic], of = prof(0.5, j / (nv - 1));
      const y = P[1] + N[1] * of;
      if (!best || (j / (nv - 1) > 0.3 && j / (nv - 1) < 0.75 && y < best[1])) best = [0, y, P[2] + N[2] * of];
    }
    out.seat = best;
    // pommel horn (rein hook)
    if (s.horn) {
      const P0 = G.P[0][ic], N0 = G.N[0][ic], of = prof(0.5, 0.0);
      const b = [0, P0[1] + N0[1] * of - 0.01, P0[2] + N0[2] * of + 0.02];
      addHorn(acc, skinAt(S, G.P[0][ic]), b, [0, b[1] + 0.05, b[2] - 0.015], [0, b[1] + 0.075, b[2] - 0.04], 0.022, 0.016, { base: s.leather, tip: s.hornTip ?? s.trimMetal ?? s.leather, radial: 6, n: 4 });
      out.horn = [0, b[1] + 0.07, b[2] - 0.035];
    }
    out.front = [0, G.P[0][ic][1] + G.N[0][ic][1] * prof(0.5, 0), G.P[0][ic][2]];
  }
  // ---- girth: band around the belly
  if (o.girth) {
    const gr = o.girth, from = gr.from ?? 1.05;
    const G = wrapGrid(S, g, [gr.z - gr.w / 2, gr.z + gr.w / 2], linspace(from, Math.PI * 2 - from, 15), axis);
    shell(acc, S, G, { off: gr.off ?? 0.008, thick: 0.01, color: () => gr.color ?? 0x3a2414, dtl: [0, 0, 0.15, 0.4] });
  }
  // ---- stirrup leathers + irons (hang from the saddle skirt)
  if (o.stirrup) {
    const st = o.stirrup;
    for (const sd of [-1, 1]) {
      const top = [sd * st.top[0], st.top[1], st.top[2]];
      // leather follows the flank outward then hangs straight
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, y = mix(top[1], st.y + st.r * 1.6, t), z = mix(top[2], st.z, t);
        const hit = marchOut(S, [0, y, z], [sd, 0, 0], g, 1);
        const xs = hit ? Math.abs(hit[0]) + 0.016 : Math.abs(top[0]);
        pts.push(new V3(sd * Math.max(xs, mix(Math.abs(top[0]), st.x, sstep(0.3, 1, t))), y, z));
      }
      const sk = st.skin;
      strap(acc, pts, st.w ?? 0.035, 0.006, { up: [sd, 0, 0], skin: sk, color: st.leather });
      // iron: a D ring in the fore-aft plane + tread
      const c = [sd * st.x, st.y, st.z];
      ring(acc, c, [1, 0, 0], st.r, st.r * 0.16, sk, st.metal, { rs: 4, ts: 10 });
      const tread = new THREE.BoxGeometry(0.075, 0.012, st.r * 1.3);
      addG(acc, tread, { matrix: new THREE.Matrix4().makeTranslation(c[0], c[1] - st.r * 0.95, c[2]), skin: sk, color: st.metal, dtl: [0, 0, 0.1, 0] });
    }
  }
  return out;
}

/** Reins: from both bit rings along the neck sides to a meeting point (pommel / hands). stops: [[t, skin]] along the rein */
export function reins(acc, pairs, o) {
  for (const pts of pairs) strap(acc, pts, o.w ?? 0.022, 0.006, { up: o.up ?? [0, 1, 0], skin: o.skin, color: o.color });
}

/** Heraldic sun emblem (disc + rays) as a thin raised plate on a surface frame. fr: { p, n, u (right), v (up) } */
export function sunEmblem(acc, fr, R, skin, colA, colB, o = {}) {
  const pos = [], nrm = [], clr = [], idx = [];
  const n = new V3(...fr.n), U = new V3(...fr.u), Vv = new V3(...fr.v), P = new V3(...fr.p).addScaledVector(n, o.lift ?? 0.004);
  const ca = col(colA), cb = col(colB);
  const add = (x, y, c, dz = 0) => { const q = P.clone().addScaledVector(U, x).addScaledVector(Vv, y).addScaledVector(n, dz); pos.push(q.x, q.y, q.z); nrm.push(n.x, n.y, n.z); clr.push(...c); return pos.length / 3 - 1; };
  // disc
  const segs = 16, c0 = add(0, 0, ca, 0.002);
  const rim = []; for (let i = 0; i < segs; i++) { const a = i / segs * Math.PI * 2; rim.push(add(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, ca, 0.001)); }
  for (let i = 0; i < segs; i++) idx.push(c0, rim[i], rim[(i + 1) % segs]);
  // rays (alternating long / short)
  const rays = o.rays ?? 12;
  for (let i = 0; i < rays; i++) {
    const a = i / rays * Math.PI * 2, L = i % 2 ? 0.78 : 1.0, hw = Math.PI / rays * 0.55;
    const a0 = add(Math.cos(a - hw) * R * 0.55, Math.sin(a - hw) * R * 0.55, cb), a1 = add(Math.cos(a + hw) * R * 0.55, Math.sin(a + hw) * R * 0.55, cb), tp = add(Math.cos(a) * R * L, Math.sin(a) * R * L, cb);
    idx.push(a0, tp, a1);
  }
  // orient triangles to face n
  for (let t = 0; t < idx.length; t += 3) {
    const A = new V3(pos[idx[t] * 3], pos[idx[t] * 3 + 1], pos[idx[t] * 3 + 2]), B = new V3(pos[idx[t + 1] * 3], pos[idx[t + 1] * 3 + 1], pos[idx[t + 1] * 3 + 2]), C = new V3(pos[idx[t + 2] * 3], pos[idx[t + 2] * 3 + 1], pos[idx[t + 2] * 3 + 2]);
    if (B.sub(A).cross(C.sub(A)).dot(n) < 0) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
  }
  const gm = new THREE.BufferGeometry();
  gm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gm.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  gm.setIndex(idx);
  let i = 0; const cols = clr;
  addG(acc, gm, { skin, color: (p, nn, uv, k) => [cols[k * 3], cols[k * 3 + 1], cols[k * 3 + 2]], dtl: [0, 0, 0.1, 0], emis: o.emis ?? 0 });
}

/** surface frame at the SDF point hit from `o` along `d` (for emblems / plates): { p, n, u, v } */
export function surfFrame(S, group, o, d, up = [0, 1, 0]) {
  const p = marchOut(S, o, d, group, 1.5); if (!p) return null;
  const n = new V3(...sdfNormal(S, p, group));
  const u = new V3().crossVectors(new V3(...up), n).normalize(), v = new V3().crossVectors(n, u).normalize();
  return { p, n: n.toArray(), u: u.toArray(), v: v.toArray() };
}
export { mixSkin, rigidSkin, skinAt };
