// Floating things: flotsam you can sail through (barrels, crates, wreck planks, message bottles, glinting chests),
// powder kegs and treasure buoys. Shared geometries & one material; each item is a small Group the game bobs on the
// swell (Waves.height) — a handful exist at once.
import * as THREE from 'three';
import { lambert } from '../../engine/materials.js';
import { MeshBuilder, linColor as lc } from '../../engine/geom.js';

let MAT = null, GLOW = null;
const GEO = {};
function mat() {
  if (MAT) return MAT;
  MAT = lambert({ vertexColors: true }, { wrap: 0.45, spec: 0.3, shine: 30, rim: 0.15, key: 'flotsam' });
  GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return MAT;
}
const add = (b, g, m, c) => b.add(g, m, lc(c));
const Mx = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
function geo(kind) {
  if (GEO[kind]) return GEO[kind];
  const b = new MeshBuilder();
  if (kind === 'barrel') {
    const lathe = new THREE.LatheGeometry([0, 0.15, 0.4, 0.65, 0.85, 1].map(t => new THREE.Vector2(0.34 + Math.sin(t * Math.PI) * 0.07, t * 0.95 - 0.47)), 12);
    add(b, lathe, Mx(0, 0, 0, Math.PI / 2, 0, 0), 0x9a6a3a);
    for (const y of [-0.3, 0.3]) add(b, new THREE.TorusGeometry(0.4, 0.035, 5, 16), Mx(0, 0, y, 0, 0, 0), 0x2e2e32);
  } else if (kind === 'crate') {
    add(b, new THREE.BoxGeometry(0.9, 0.9, 0.9), null, 0xb88a52);
    for (const [x, z] of [[0.46, 0.46], [-0.46, 0.46], [0.46, -0.46], [-0.46, -0.46]]) add(b, new THREE.BoxGeometry(0.1, 0.94, 0.1), Mx(x, 0, z), 0x6a4a2a);
    add(b, new THREE.BoxGeometry(0.94, 0.1, 0.1), Mx(0, 0.3, 0.46), 0x6a4a2a); add(b, new THREE.BoxGeometry(0.94, 0.1, 0.1), Mx(0, -0.3, 0.46), 0x6a4a2a);
  } else if (kind === 'planks') {
    for (let i = 0; i < 4; i++) add(b, new THREE.BoxGeometry(0.34, 0.1, 2.6 - i * 0.3), Mx(-0.55 + i * 0.36, 0.02 * i, i * 0.12, 0, i * 0.15, 0), [0x8a6a44, 0x7a5a36, 0x9a7650, 0x6a4a2c][i]);
    add(b, new THREE.BoxGeometry(1.6, 0.08, 0.22), Mx(0, 0.08, 0.6), 0x5a3a20);
    add(b, new THREE.CylinderGeometry(0.1, 0.12, 1.4, 6), Mx(0.8, 0.1, -0.4, 0, 0, Math.PI / 2 - 0.3), 0x6a4a2a);
  } else if (kind === 'bottle') {
    const lathe = new THREE.LatheGeometry([[0.02, 0], [0.14, 0.02], [0.16, 0.3], [0.12, 0.38], [0.05, 0.44], [0.05, 0.56], [0.07, 0.58]].map(([r, h]) => new THREE.Vector2(r, h - 0.3)), 10);
    add(b, lathe, Mx(0, 0, 0, Math.PI / 2 - 0.3, 0, 0), 0x3aa870);
    add(b, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), Mx(0, 0.08, -0.3, Math.PI / 2 - 0.3, 0, 0), 0x8a6a3a);
    add(b, new THREE.BoxGeometry(0.1, 0.02, 0.2), Mx(0, 0.04, 0, -0.3, 0, 0), 0xf4ead0);
  } else if (kind === 'chest') {
    add(b, new THREE.BoxGeometry(1.1, 0.6, 0.75), null, 0x7a4a24);
    const lid = new THREE.CylinderGeometry(0.375, 0.375, 1.1, 10, 1, false, 0, Math.PI); lid.rotateZ(Math.PI / 2);
    add(b, lid, Mx(0, 0.3, 0), 0x8a5a2a);
    for (const x of [-0.42, 0, 0.42]) add(b, new THREE.BoxGeometry(0.08, 0.66, 0.78), Mx(x, 0, 0), 0xd8a030);
    add(b, new THREE.BoxGeometry(0.2, 0.22, 0.06), Mx(0, 0.18, 0.4), 0xe8c040);
  } else if (kind === 'keg') {
    const lathe = new THREE.LatheGeometry([0, 0.2, 0.5, 0.8, 1].map(t => new THREE.Vector2(0.28 + Math.sin(t * Math.PI) * 0.06, t * 0.8 - 0.4)), 10);
    add(b, lathe, null, 0x5a3a24);
    for (const y of [-0.25, 0.25]) add(b, new THREE.TorusGeometry(0.33, 0.03, 5, 14), Mx(0, y, 0, Math.PI / 2), 0x2a2a2e);
    add(b, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), Mx(0, 0.5, 0), 0xd8b070);
  } else if (kind === 'buoy') {
    add(b, new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), Mx(0, 1.0, 0), 0x6a4a2a);
    add(b, new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), Mx(0, -0.15, 0), 0xc83a3a);
    add(b, new THREE.BoxGeometry(0.9, 0.5, 0.05), Mx(0.45, 2.1, 0), 0xe8c040);
  }
  return (GEO[kind] = b.build());
}
let GLOWGEO = null;
function glowGeo() {
  if (GLOWGEO) return GLOWGEO;
  const b = new MeshBuilder();
  const g = new THREE.CylinderGeometry(0.9, 0.2, 7, 12, 1, true); g.translate(0, 3.5, 0);
  b.add(g, null, (p) => { const t = 1 - (p.y) / 7; return [1.6 * t, 1.25 * t, 0.5 * t]; });
  return (GLOWGEO = b.build());
}
/** a floating item: { group, kind, glow? }  (group origin = waterline) */
export function makeFloater(kind) {
  const group = new THREE.Group(); group.name = 'flotsam:' + kind;
  const m = new THREE.Mesh(geo(kind), mat()); m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  let glow = null;
  if (kind === 'chest' || kind === 'bottle' || kind === 'buoy') { glow = new THREE.Mesh(glowGeo(), GLOW); glow.scale.setScalar(kind === 'buoy' ? 1.6 : kind === 'chest' ? 1 : 0.6); glow.renderOrder = 10; group.add(glow); }
  return { group, mesh: m, glow, kind };
}
