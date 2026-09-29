// Small procedural props for open-world interactables the zones don't draw themselves: trade-skill nodes (herbs, logs,
// ore, tracks, fishing ripples, dig mounds), floating lore tomes and vista viewpoints. Each kind is baked once into one
// vertex-coloured mesh (+ one glowing mesh), so a prop costs 2–4 draw calls; geometry and materials are shared.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lambert } from '../../engine/materials.js';

const lin = hex => new THREE.Color(hex);
/** bake parts [{ g: BufferGeometry, c: hex, m: Matrix4 }] into one non-indexed geometry with vertex colours */
function bake(parts) {
  const gs = parts.map(({ g, c, m }) => {
    let x = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
    if (m) x.applyMatrix4(m);
    const col = lin(c), n = x.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    x.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return x;
  });
  const out = mergeGeometries(gs, false); gs.forEach(g => g.dispose());
  out.computeBoundingSphere();
  return out;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// kind → { body: [parts], glow: [parts], spark: hex, sparkY }
const RECIPES = {
  forage() {
    const body = [], glow = [];
    const stem = new THREE.ConeGeometry(0.05, 0.7, 5), leaf = new THREE.SphereGeometry(0.16, 7, 5), bloom = new THREE.IcosahedronGeometry(0.07, 0);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3, r = 0.18 + (i % 3) * 0.12;
      body.push({ g: stem, c: 0x4f8a34, m: T(Math.cos(a) * r, 0.3 + (i % 2) * 0.08, Math.sin(a) * r, Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25) });
      body.push({ g: leaf, c: i % 2 ? 0x6fb046 : 0x5a9c3c, m: T(Math.cos(a) * (r + 0.12), 0.16, Math.sin(a) * (r + 0.12), 0, -a, 0, 1, 0.35, 0.6) });
      if (i % 2 === 0) glow.push({ g: bloom, c: 0xfff0a0, m: T(Math.cos(a) * r, 0.7 + (i % 2) * 0.08, Math.sin(a) * r) });
    }
    return { body, glow, spark: 0x9ae06a, sparkY: 1.05 };
  },
  log() {
    return { body: [
      { g: new THREE.CylinderGeometry(0.34, 0.38, 2.4, 10), c: 0x7a5434, m: T(0, 0.34, 0, 0, 0.5, Math.PI / 2) },
      { g: new THREE.CircleGeometry(0.33, 12), c: 0xd8b07a, m: T(Math.cos(0.5) * 1.21, 0.34, -Math.sin(0.5) * 1.21, 0, 0.5 + Math.PI / 2, 0) },
      { g: new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), c: 0x5a3a22, m: T(0.2, 0.9, 0, 0, 0, 0.5) },
      { g: new THREE.BoxGeometry(0.22, 0.14, 0.04), c: 0xb8c0c8, m: T(0.06, 0.62, 0, 0, 0, 0.5) },
    ], glow: [], spark: 0xe8b070, sparkY: 1.3 };
  },
  mine() {
    const glow = [], cry = new THREE.OctahedronGeometry(0.16, 0);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; glow.push({ g: cry, c: 0x9ad0ff, m: T(Math.cos(a) * 0.55, 0.5 + (i % 2) * 0.25, Math.sin(a) * 0.45, a, a * 0.5, 0.3, 1, 1.8, 1) }); }
    return { body: [{ g: new THREE.DodecahedronGeometry(0.7, 0), c: 0x6a6a72, m: T(0, 0.45, 0, 0, 0.7, 0, 1.2, 0.8, 1) }], glow, spark: 0x9ab8ff, sparkY: 1.5 };
  },
  hunt() {
    const body = [], print = new THREE.CircleGeometry(0.1, 8);
    for (let i = 0; i < 6; i++) body.push({ g: print, c: 0x3a2a1a, m: T(-0.9 + i * 0.36, 0.03, (i % 2) * 0.22 - 0.1, -Math.PI / 2, 0, 0) });
    body.push({ g: new THREE.IcosahedronGeometry(0.45, 1), c: 0x4a7a36, m: T(0.9, 0.35, -0.2, 0, 0, 0, 1.2, 0.8, 1) });
    return { body, glow: [], spark: 0xe0906a, sparkY: 1.0 };
  },
  fish() { return { body: [], glow: [], spark: 0x6ac0ff, sparkY: 0.8, ripples: true }; },
  dig() {
    return { body: [
      { g: new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), c: 0x7a5a3a, m: T(0, 0, 0, 0, 0, 0, 1, 0.45, 0.85) },
      { g: new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), c: 0x6a4a2a, m: T(0.25, 0.75, 0, 0, 0, -0.3) },
      { g: new THREE.BoxGeometry(0.22, 0.28, 0.03), c: 0x9aa0a8, m: T(0.1, 0.3, 0, 0, 0, -0.3) },
    ], glow: [], spark: 0xe8d08a, sparkY: 1.3 };
  },
  lore() {
    return { body: [{ g: new THREE.BoxGeometry(0.46, 0.06, 0.34), c: 0x6a2a2a, m: T(0, 0, 0) }], glow: [{ g: new THREE.BoxGeometry(0.42, 0.05, 0.3), c: 0xfff4d8, m: T(0, 0.05, 0) }], spark: 0xffd88a, sparkY: 1.75, floatBook: true };
  },
  cannon() {
    const body = [];
    body.push({ g: new THREE.CylinderGeometry(0.26, 0.34, 2.2, 14), c: 0x2e3036, m: T(0, 1.0, -0.2, Math.PI / 2 - 0.18, 0, 0) });
    body.push({ g: new THREE.TorusGeometry(0.33, 0.06, 6, 14), c: 0xb08a3a, m: T(0, 1.13, -1.2, Math.PI / 2 - 0.18, 0, 0) });
    body.push({ g: new THREE.BoxGeometry(0.9, 0.5, 1.6), c: 0x5a3a22, m: T(0, 0.45, 0.1) });
    for (const sx of [-1, 1]) { body.push({ g: new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), c: 0x4a3020, m: T(sx * 0.55, 0.42, 0.5, 0, 0, Math.PI / 2) }); body.push({ g: new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), c: 0x4a3020, m: T(sx * 0.55, 0.42, -0.35, 0, 0, Math.PI / 2) }); }
    const balls = new THREE.SphereGeometry(0.16, 8, 6);
    for (let i = 0; i < 4; i++) body.push({ g: balls, c: 0x1e1e22, m: T(0.9 + (i % 2) * 0.3, 0.16 + (i > 1 ? 0.26 : 0), 0.6 + (i % 2) * 0.1) });
    return { body, glow: [], spark: 0xffb050, sparkY: 2.0 };
  },
  vista() {
    const body = [], leg = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; body.push({ g: leg, c: 0x5a4028, m: T(Math.cos(a) * 0.18, 0.52, Math.sin(a) * 0.18, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3) }); }
    body.push({ g: new THREE.CylinderGeometry(0.06, 0.09, 0.8, 10), c: 0xc9a45a, m: T(0, 1.12, 0, Math.PI / 2 - 0.35, 0, 0) });
    return { body, glow: [], spark: 0x7fd0ff, sparkY: 1.7 };
  },
};
const CACHE = {};
let BODY_MAT = null, GLOW_MAT = null, SPARK = null, RING = null, RIPPLE = null;
function parts(kind) {
  if (CACHE[kind]) return CACHE[kind];
  const r = (RECIPES[kind] || RECIPES.forage)();
  return (CACHE[kind] = { body: r.body.length ? bake(r.body) : null, glow: r.glow.length ? bake(r.glow) : null, spark: r.spark, sparkY: r.sparkY, ripples: r.ripples, floatBook: r.floatBook });
}
const addMats = {};
const addMat = hex => addMats[hex] || (addMats[hex] = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
const sparkMats = {};
const sparkMat = hex => sparkMats[hex] || (sparkMats[hex] = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(3.2) }));

/** a prop for kind ('forage'|'log'|'mine'|'hunt'|'fish'|'dig'|'lore'|'vista') at (x, y, z); root.userData.update(dt), setActive(on) */
export function makeFieldProp(kind, x, y, z, facing = 0) {
  const P = parts(kind);
  BODY_MAT ||= lambert({ vertexColors: true }, { rim: 0.3 });
  GLOW_MAT ||= new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.8, 1.8, 1.8) });
  SPARK ||= new THREE.OctahedronGeometry(0.11, 0);
  RING ||= (() => { const g = new THREE.RingGeometry(0.5, 0.62, 32); g.rotateX(-Math.PI / 2); return g; })();
  RIPPLE ||= (() => { const g = new THREE.RingGeometry(0.3, 0.38, 28); g.rotateX(-Math.PI / 2); return g; })();
  const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = facing;
  const holder = new THREE.Group(); root.add(holder);
  if (P.body) { const m = new THREE.Mesh(P.body, BODY_MAT); m.castShadow = true; m.receiveShadow = true; holder.add(m); }
  if (P.glow) holder.add(new THREE.Mesh(P.glow, GLOW_MAT));
  if (P.floatBook) { holder.position.y = 1.25; holder.rotation.x = -0.5; }
  const spark = new THREE.Mesh(SPARK, sparkMat(P.spark)); spark.position.y = P.sparkY; root.add(spark);
  const ring = new THREE.Mesh(RING, addMat(P.spark)); ring.position.y = 0.04; root.add(ring);
  const ripples = P.ripples ? [0, 1, 2].map(() => { const r = new THREE.Mesh(RIPPLE, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ad8ff).multiplyScalar(1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.position.y = 0.05; root.add(r); return r; }) : null;
  let t = Math.random() * 6, active = true;
  root.userData.update = dt => {
    t += dt;
    spark.position.y = P.sparkY + Math.sin(t * 2) * 0.08; spark.rotation.y += dt * 1.5;
    ring.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4));
    if (ripples) ripples.forEach((r, i) => { const k = ((t * 0.5 + i / 3) % 1); r.scale.setScalar(0.5 + k * 2.2); r.material.opacity = (active ? 0.6 : 0.15) * (1 - k); });
    if (P.floatBook) { holder.position.y = 1.25 + Math.sin(t * 1.6) * 0.06; holder.rotation.y += dt * 0.6; }
  };
  root.userData.setActive = on => { active = on; spark.visible = on; ring.visible = on; };
  root.userData.dispose = () => { if (ripples) ripples.forEach(r => r.material.dispose()); };
  return root;
}
