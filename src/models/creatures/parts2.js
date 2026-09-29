// SEVENSHARD rigid-part builders (on top of kit/parts.js): bat wings (2-bone membrane, skinned), flame tongues
// (emissive, flicker via fx<0), glowing orbs, simple plates. All emit into a GeoAcc as part of the creature's one mesh.
import * as THREE from 'three';
import { sweep, rigid, bez, taper } from '../kit/geo.js';
import { col } from '../kit/sdf.js';
import { lerp3 } from '../kit/parts.js';
import { sstep, mix, clamp01 } from '../kit/rig.js';

const V3 = THREE.Vector3;

/**
 * Wing plane layout shared by rig() and parts(): 2D wing coordinates (u outward along the span, v up) are mapped into
 * model space around the shoulder S. side: -1 left / +1 right. o: { S:[x,y,z], out:[x,y,z] span dir (for the right
 * wing), up:[x,y,z], wrist:[u,v], tips:[[u,v]…] (leading → trailing), body:[u,v] (membrane attach on the back) }
 */
export function wingLayout(side, o) {
  const S = new V3(o.S[0] * (side < 0 ? 1 : 1), o.S[1], o.S[2]); S.x = Math.abs(o.S[0]) * side;
  const X = new V3(o.out[0] * side, o.out[1], o.out[2]).normalize();
  const Yh = new V3(o.up[0] * side, o.up[1], o.up[2]);
  const Y = Yh.addScaledVector(X, -Yh.dot(X)).normalize();
  const N = new V3().crossVectors(X, Y).multiplyScalar(side); // points backward-ish for both sides
  const cup = o.cup ?? 0.06;
  const map = (u, v, bulge = 0) => new V3().copy(S).addScaledVector(X, u).addScaledVector(Y, v).addScaledVector(N, bulge * cup);
  const W = map(o.wrist[0], o.wrist[1]);
  return { S, W, X, Y, N, map, o, side };
}

/**
 * Bat wing: arm + fingers (bone struts) + a scalloped two-sided membrane between them. Skinned: body edge → chest bone,
 * inner membrane → wing1, beyond the wrist → wing2 (smooth blends so flapping stretches the membrane).
 * c: { bone: hex, membrane: hex, membrane2: hex (inner/translucent centre), claw: hex, emis }
 */
export function batWing(acc, L, bones, c, o = {}) {
  const { chest, w1, w2 } = bones;
  const lo = L.o, side = L.side;
  const tips = lo.tips, body = lo.body, wr = lo.wrist;
  const cb = col(c.bone), cm = col(c.membrane), cm2 = col(c.membrane2 ?? c.membrane), cc = col(c.claw ?? 0x1a1010);
  const armR = o.armR ?? 0.018, fingR = o.fingR ?? 0.008;
  // skin weights by span position: u<0.25 wrist-fraction → chest/w1 blend, towards wrist → w1, beyond → w2
  const skinAt = (u, v) => {
    const f = u / wr[0];
    const tb = sstep(0.12, 0.45, f), t2 = sstep(0.75, 1.05, f);
    const a = 1 - tb, b1 = tb * (1 - t2), b2 = tb * t2;
    return { si: [chest, w1, w2, 0], sw: [a, b1, b2, 0] };
  };
  // ---- struts: arm (shoulder → wrist), fingers (wrist → tips), thumb claw
  const Sp = L.map(0, 0), Wp = L.map(wr[0], wr[1]);
  const armPts = bez(Sp.toArray(), L.map(wr[0] * 0.5, wr[1] * 0.5 + 0.03, 0.3).toArray(), Wp.toArray(), 5);
  acc.add(sweep(armPts, taper(5, armR, armR * 0.75), { radial: 6, capStart: true }), {
    skin: (p) => { const d = p.distanceTo(Sp) / Sp.distanceTo(Wp); return d < 0.5 ? { si: [w1, 0, 0, 0], sw: [1, 0, 0, 0] } : { si: [w1, w2, 0, 0], sw: [1 - sstep(0.7, 1, d), sstep(0.7, 1, d), 0, 0] }; },
    color: cb, dtl: [0, 0.15, 0.15, 0],
  });
  for (let i = 0; i < tips.length; i++) {
    const tp = tips[i];
    const mid = L.map(mix(wr[0], tp[0], 0.5), mix(wr[1], tp[1], 0.5), 0.5);
    const g = sweep(bez(Wp.toArray(), mid.toArray(), L.map(tp[0], tp[1]).toArray(), 5), taper(5, fingR * (i === 0 ? 1.4 : 1), fingR * 0.3), { radial: 5 });
    acc.add(g, { skin: rigid(w2), color: cb, dtl: [0, 0.1, 0.1, 0] });
  }
  // thumb claw at the wrist
  const th = L.map(wr[0] + 0.02, wr[1] + 0.05), th2 = L.map(wr[0] - 0.01, wr[1] + 0.11);
  acc.add(sweep([Wp, th, th2], [armR * 0.8, armR * 0.5, 0.001], { radial: 5 }), { skin: rigid(w2), color: cc, dtl: [0, 0, 0.1, 0] });
  // ---- membrane: boundary chain tip0 → (scallop) → tip1 … → body → shoulder; fanned from the wrist with rings
  const chain = [];
  const scal = o.scallop ?? 0.22, nsc = o.nsc ?? 5;
  const pts2 = [...tips, body];
  for (let i = 0; i < pts2.length - 1; i++) {
    const a = pts2[i], b = pts2[i + 1];
    for (let j = 0; j < nsc; j++) {
      const t = j / nsc;
      let u = mix(a[0], b[0], t), v = mix(a[1], b[1], t);
      // pull toward the wrist between struts (scallop)
      const pull = Math.sin(t * Math.PI) * scal * (i === pts2.length - 2 ? 0.6 : 1);
      u = mix(u, wr[0], pull); v = mix(v, wr[1], pull);
      chain.push([u, v]);
    }
  }
  chain.push(body.slice());
  // body edge → shoulder (membrane attached along the back)
  for (let j = 1; j <= 3; j++) chain.push([mix(body[0], 0, j / 3), mix(body[1], 0, j / 3)]);
  // leading edge: shoulder → wrist along the arm (closes the fan)
  const nr = o.rings ?? 4;
  const P = [], I = [];
  const n = chain.length;
  for (let r = 0; r <= nr; r++) {
    const f = r / nr;
    for (let j = 0; j < n; j++) {
      const u = mix(wr[0], chain[j][0], f), v = mix(wr[1], chain[j][1], f);
      P.push([u, v, f, j / (n - 1)]);
    }
  }
  for (let r = 0; r < nr; r++) for (let j = 0; j < n - 1; j++) {
    const a = r * n + j, b = a + 1, cI = a + n, d = cI + 1;
    I.push(a, cI, b, b, cI, d);
  }
  // leading-edge web between the arm and the first finger: fan from the wrist to shoulder points
  const lead = [];
  for (let j = 0; j <= 4; j++) { const t = j / 4; lead.push([mix(0, tips[0][0] * 0.35 + wr[0] * 0.65, 0), 0]); }
  const bulge = (u, v) => { // membrane billows backward between struts
    const r = Math.hypot(u - wr[0], v - wr[1]);
    return Math.sin(clamp01(r / 0.5) * Math.PI) * 0.5 + 0.3 * sstep(0, 0.2, wr[0] - u);
  };
  const thick = o.thick ?? 0.004;
  for (const face of [1, -1]) {
    const pos = [], nrm = [], uv = [];
    for (const q of P) {
      const p = L.map(q[0], q[1], bulge(q[0], q[1]));
      p.addScaledVector(L.N, thick * face);
      pos.push(p.x, p.y, p.z); nrm.push(L.N.x * face, L.N.y * face, L.N.z * face); uv.push(q[2], q[3]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx = face > 0 ? I : I.map((x, i) => i % 3 === 1 ? I[i + 1] : i % 3 === 2 ? I[i - 1] : x);
    g.setIndex(idx);
    g.computeVertexNormals();
    // re-orient normals consistently to the face side (fan geometry can flip)
    const na = g.attributes.normal;
    for (let i = 0; i < na.count; i++) { const d = na.getX(i) * L.N.x + na.getY(i) * L.N.y + na.getZ(i) * L.N.z; if (d * face < 0) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i)); }
    const qs = P;
    acc.add(g, {
      skin: (p) => { // recover the 2D coords from the model position
        const d = new V3().subVectors(p, L.S); return skinAt(d.dot(L.X), d.dot(L.Y));
      },
      color: (p, nn, uvv) => {
        const f = uvv[0]; // 0 at wrist → 1 at the edge
        const edge = sstep(0.8, 1, f), inner = sstep(0.15, 0.6, f) * (1 - edge);
        const vein = Math.pow(Math.abs(Math.sin(uvv[1] * (pts2.length - 1) * nsc / nsc * Math.PI * 2.0 + f * 1.3)), 24) * 0.5;
        return lerp3(lerp3(lerp3(cm, cm2, inner), cb, edge * 0.55), cb, vein * (1 - edge));
      },
      emis: (p, uvv) => (c.emis ?? 0) * sstep(0.1, 0.6, uvv[0]) * (1 - sstep(0.85, 1, uvv[0])),
      dtl: [0, 0.08, 0.2, 0],
    });
  }
  return { S: Sp, W: Wp };
}

/**
 * Flame tongue (emissive, flickers in the vertex shader: aux.y < 0). base [x,y,z], dir [x,y,z] (normalised inside),
 * len, r (base radius), bone (skin), c: { core, mid, tip }, o: { bend:[x,y,z] (tip drift), emis, radial }
 */
export function flame(acc, base, dir, len, r, skin, c, o = {}) {
  const d = new V3(...dir).normalize(), b0 = new V3(...base), bend = new V3(...(o.bend ?? [0, 0, 0]));
  const pts = [], rad = [], n = o.n ?? 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push(b0.clone().addScaledVector(d, len * t).addScaledVector(bend, t * t * len));
    rad.push(r * Math.pow(Math.sin(Math.min(1, t * 1.0 + 0.25) * Math.PI * 0.95), 0.8) * (1 - t * 0.85) + 0.001);
  }
  const g = sweep(pts, rad, { radial: o.radial ?? 5 });
  const c0 = col(c.core ?? 0xfff2b0), c1 = col(c.mid ?? 0xff8a1a), c2 = col(c.tip ?? 0xc0200a);
  const E = o.emis ?? 3.2;
  acc.add(g, {
    skin, dtl: [0, 0, 0, 0],
    color: (p, nn, uv) => uv[1] < 0.45 ? lerp3(c0, c1, sstep(0.05, 0.45, uv[1])) : lerp3(c1, c2, sstep(0.45, 1, uv[1])),
    emis: (p, uv) => E * (1.1 - uv[1] * 0.55),
    fx: (p, uv) => -(0.15 + uv[1] * (o.flick ?? 1.2)),
  });
}

/** Glowing orb (icosphere) with an emissive core colour; optional rigid skin. */
export function orb(acc, pos, r, skin, color, emis = 4, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  acc.add(g, { matrix: new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]), skin, color, emis, dtl: [0, 0, 0, 0] });
}

/** A box plate (armour / shield / plank) oriented by euler, with a colour fn or hex. */
export function plate(acc, pos, size, rot, skin, color, o = {}) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2], o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')); m.setPosition(pos[0], pos[1], pos[2]);
  acc.add(g, { matrix: m, skin, color, dtl: o.dtl ?? [0, 0, 0.2, 0], emis: o.emis ?? 0 });
}

export { lerp3 };

/**
 * Author rigid parts in a POSED space (e.g. a spear held upright in the idle grip) instead of the rest pose.
 * hold(P, b) applies the same rotations the controller applies for that pose (P = kit Pose, b = bone index map).
 * Returns { M(bone) → Matrix4 posed→rest for geometry carried by `bone`, P (the posed Pose: P.wp / P.wq per bone) }.
 */
import { Pose } from '../kit/rig.js';
export function posedFrame(R, hold) {
  const P = new Pose(R); P.reset(); hold(P, P.b); P.fk();
  const M = (bone) => {
    const i = typeof bone === 'number' ? bone : R.index(bone);
    const q = P.wq[i].clone().invert(), wp = P.wp[i], rest = P.rest[i];
    const m = new THREE.Matrix4().makeTranslation(rest.x, rest.y, rest.z);
    m.multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
    m.multiply(new THREE.Matrix4().makeTranslation(-wp.x, -wp.y, -wp.z));
    return m;
  };
  return { M, P };
}
