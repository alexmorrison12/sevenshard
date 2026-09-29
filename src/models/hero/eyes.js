// Eyes as geometry: a glossy eyeball per side (sclera, iris with limbal ring and radial fibres, pupil, lid shadow) with a
// small emissive catch-light bead, and an upper-lid shell skinned to lidL / lidR (rotated down by the animator to blink /
// squint). Built in bind space from the head definition; cached per head variant.
import * as THREE from 'three';
import { PB } from './pieces.js';
import { B } from './rig.js';
import { SLOT } from './palette.js';
import { eyeCenter } from './head.js';

const CACHE = new Map();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function eyePiece(base, d, key) {
  const k = `${key}|eyes`;
  if (CACHE.has(k)) return CACHE.get(k);
  const pb = new PB({ master: null });
  pb.ao = false;
  const J = base.JJ.J, s = d.s, H = J.head;
  const hp = (p) => [H[0] + p[0] * s, H[1] + p[1] * s, H[2] + p[2] * s];
  const crowd = base.lod === 'crowd';
  const segW = crowd ? 8 : 20, segH = crowd ? 3 : 9;
  const irisR = 0.62, pupilR = 0.23;
  for (const sg of [-1, 1]) {
    const c = hp(eyeCenter(d, sg)), r = d.eye.r * s;
    const bw = [[B.head, 1]];
    const g = new THREE.SphereGeometry(r, segW, segH, 0, Math.PI * 2, 0, 1.45); // front cap only (the rest sits in the socket)
    g.rotateX(-Math.PI / 2); // +Y pole → −Z (looking forward)
    g.rotateY(-sg * 0.03);   // a hair of outward gaze
    const m = new THREE.Matrix4().makeTranslation(c[0], c[1], c[2]);
    pb.add(g, {
      m, bw,
      slotFn: (p, n) => { const a = Math.acos(Math.max(-1, Math.min(1, -n.z))); return a < pupilR ? SLOT.DARK : a < irisR ? SLOT.IRIS : SLOT.SCLERA; },
      mulFn: (p, n) => {
        const a = Math.acos(Math.max(-1, Math.min(1, -n.z)));
        const lid = 0.62 + 0.38 * sstep(0.45, -0.25, n.y);          // upper-lid shadow on the ball
        if (a < pupilR) { const f = 0.25 * lid; return [f, f, f]; }
        if (a < irisR) {
          const t = (a - pupilR) / (irisR - pupilR);
          const ang = Math.atan2(n.y, n.x);
          const fib = 0.86 + 0.22 * Math.abs(Math.sin(ang * 11 + t * 3)) + 0.08 * Math.sin(ang * 23);
          const ring = t > 0.82 ? 0.42 + 0.58 * (1 - (t - 0.82) / 0.18) * 0.4 : 1;       // dark limbal ring
          const glow = 0.7 + 0.55 * sstep(0.05, 0.45, t) * (1 - sstep(0.6, 0.95, t) * 0.5) + 0.25 * sstep(0.2, -0.6, n.y); // lit lower iris
          const f = glow * fib * ring * lid;
          return [f, f, f];
        }
        const f = (0.86 - 0.28 * sstep(0.7, 1.6, a)) * lid;
        const corner = sstep(0.9, 1.3, Math.abs(n.x) * 1.4);          // slightly pink toward the corners
        return [f, f * (1 - 0.08 * corner), f * (1 - 0.1 * corner)];
      },
      emis: (p, n) => { const a = Math.acos(Math.max(-1, Math.min(1, -n.z))); return a < irisR && a > pupilR ? 0.04 : 0; },
    });
    // catch-light bead: same world direction for both eyes (upper, toward the key light)
    if (!crowd) {
      const dir = new THREE.Vector3(0.33, 0.36, -0.87).normalize();
      const bead = new THREE.SphereGeometry(r * 0.13, 6, 4);
      bead.scale(1, 1, 0.4);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      const mb = new THREE.Matrix4().compose(new THREE.Vector3(c[0] + dir.x * r * 1.005, c[1] + dir.y * r * 1.005, c[2] + dir.z * r * 1.005), q, new THREE.Vector3(1, 1, 1));
      pb.add(bead, { m: mb, slot: SLOT.SCLERA, bw, mul: [1.25, 1.25, 1.25], emis: 1 });
    }
    if (crowd) continue; // crowd LOD: no lid shells (blinks are invisible at that distance)
    // upper-lid shell (skin), with a dark lash rim along its edge. Open: edge above the pupil; the bone closes it.
    const lidBone = sg < 0 ? B.lidL : B.lidR;
    const rl = r * 1.075, rows = crowd ? 2 : 4, cols = crowd ? 8 : 14;
    const phiEdge = 0.24, phiTop = 1.35, th0 = 1.2;
    const tilt = -sg * (d.eye.tilt || 0);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const P3 = (phi, th, rr) => { let x = Math.sin(th) * Math.cos(phi) * rr, y = Math.sin(phi) * rr; const z = -Math.cos(th) * Math.cos(phi) * rr; const x2 = x * ct - y * st, y2 = x * st + y * ct; return [c[0] + x2, c[1] + y2, c[2] + z]; };
    const ids = [];
    for (let i = 0; i <= rows; i++) {
      const phi = phiEdge + (phiTop - phiEdge) * (i / rows);
      const row = [];
      for (let j = 0; j <= cols; j++) {
        const th = -th0 + 2 * th0 * (j / cols);
        const p = P3(phi, th, rl);
        const nx = p[0] - c[0], ny = p[1] - c[1], nz = p[2] - c[2], l = Math.hypot(nx, ny, nz);
        const edge = i === 0;
        const f = edge ? 0.35 : 0.82 + 0.1 * (i / rows);
        row.push(pb.v(p[0], p[1], p[2], nx / l, ny / l, nz / l, edge ? SLOT.LASH : SLOT.SKIN, [f, f * 0.96, f * 0.94], 0, [[lidBone, 1]]));
      }
      ids.push(row);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = ids[i][j], b = ids[i][j + 1], cc = ids[i + 1][j + 1], dd = ids[i + 1][j]; pb.tri(a, b, cc); pb.tri(a, cc, dd); }
    // lash rim: a thin dark lip curling out along the lid edge
    const rim = [];
    for (let j = 0; j <= cols; j++) {
      const th = -th0 + 2 * th0 * (j / cols);
      const outer = Math.abs(th) / th0 * Math.sign(th) * sg; // + toward the outer corner
      const lashL = (d === null ? 1 : 1) * (0.0025 + 0.0022 * Math.max(0, outer)) * s * (base.P.sex === 'f' ? 1.5 : 1);
      const p0 = P3(phiEdge - 0.02, th, rl * 1.01), p1 = P3(phiEdge - 0.16, th, rl + lashL * 2.2);
      const nx = p0[0] - c[0], ny = p0[1] - c[1], nz = p0[2] - c[2], l = Math.hypot(nx, ny, nz);
      rim.push([pb.v(p0[0], p0[1], p0[2], nx / l, ny / l, nz / l, SLOT.LASH, [0.25, 0.25, 0.25], 0, [[lidBone, 1]]), pb.v(p1[0], p1[1], p1[2], nx / l, ny / l, nz / l, SLOT.LASH, [0.2, 0.2, 0.2], 0, [[lidBone, 1]])]);
    }
    for (let j = 0; j < cols; j++) { const a = rim[j][0], b = rim[j + 1][0], cc = rim[j + 1][1], dd = rim[j][1]; pb.tri(a, b, cc); pb.tri(a, cc, dd); pb.tri(a, cc, b); pb.tri(a, dd, cc); }
  }
  const pc = pb.build();
  // eyeball flag for the shader (aFace < −1.5): sclera −2, iris / pupil −3 (demon form blackens and lights them)
  pc.face = new Float32Array(pc.n * 2).fill(-1);
  for (let v = 0; v < pc.n; v++) {
    const sl = pc.slot[v];
    const f = sl === SLOT.SCLERA ? -2 : (sl === SLOT.IRIS || sl === SLOT.DARK) ? -3 : -1;
    pc.face[v * 2] = pc.face[v * 2 + 1] = f;
  }
  CACHE.set(k, pc);
  return pc;
}
