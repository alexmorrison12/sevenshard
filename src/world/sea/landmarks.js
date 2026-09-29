// Island landmarks & sea dressing, shared by the Glass Sea (silhouettes, lod 'sea') and the island zones (lod 'full'):
//   Palms            instanced, wind-swayed coconut palms (trunk + frond cards), dithered when they hide the hero
//   StormClouds      drifting cloud banks inside storm cells (low, dark, swirling) and the Moonveil mist
//   buildSolhaven    Valemont's harbour as seen from the sea: quay, piers, moored ships, cranes, lighthouse, walls, keep
//   buildLandmarks   per island: the casino, the Cantor statues, the bastion, the lantern shrine, the spire, the
//                    lagoon cliffs, the turtle, the drowned chapel, Brightwater manor, Pipsprout's giant mushrooms
// Every builder works in the island's local frame (ox, oz = where that frame sits) and returns named spots.
import * as THREE from 'three';
import { G } from '../../engine/materials.js';
import { lambert } from '../../engine/materials.js';
import { MeshBuilder, tube, blob, linColor } from '../../engine/geom.js';
import { RNG, Simplex, clamp, smoothstep, lerp } from '../../core/noise.js';
import { Kit, M, Frame, box, cyl, cone, sphere, walls, cutV, cutF, kitMaterial } from '../kit.js';
import * as P from '../props.js';
import * as Bd from '../buildings.js';
import { boulder, spike, crystal } from '../cliffs.js';
import { circle, rect } from '../shapes.js';
import { bakeSet } from '../bake.js';
import { SOLHAVEN_OFFSET } from '../../data/islands.js';
import { BASTION } from './isles.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lc = linColor;

// ================================================================================================ palms
const PALM_VS = vs => cutV(vs.replace('#include <common>', '#include <common>\nattribute float sway;')
  .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz;
  #endif
  float ph = ip.x * 0.13 + ip.z * 0.17;
  float w = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 2.1 + position.y * 0.3) * 0.4;
  transformed.xz += uWind * w * sway * 0.22;
  transformed.y += sin(uTime * 2.9 + ph + position.x * 1.3) * sway * 0.06; }`));
let PALM_MATS = null;
function palmMats() {
  if (PALM_MATS) return PALM_MATS;
  const U = { uPlayerPos: G.uPlayerPos };
  PALM_MATS = {
    trunk: lambert({ vertexColors: true }, { wrap: 0.35, key: 'palm-trunk', uniforms: U, vertex: PALM_VS, fragment: fs => cutF(fs, 0.85, 0.12, 0.2) }),
    fronds: lambert({ vertexColors: true, side: THREE.DoubleSide }, { wrap: 0.6, trans: 0.45, rim: 0.12, rimColor: 0xf0ffb0, key: 'palm-frond', uniforms: U, vertex: PALM_VS, fragment: fs => cutF(fs, 0.9, 0.17, 0.3) }),
  };
  for (const m of Object.values(PALM_MATS)) m.userData.shared = true;
  return PALM_MATS;
}
function palmGeo(seed) {
  const rng = new RNG(seed), nz = new Simplex(seed);
  const trunk = new MeshBuilder([{ name: 'sway', size: 1 }]), fronds = new MeshBuilder([{ name: 'sway', size: 1 }]);
  const H = rng.range(6.2, 8.8), lean = rng.range(0.6, 2.4), la = rng.range(0, TAU);
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V(Math.cos(la) * lean * t * t, -0.3 + H * t, Math.sin(la) * lean * t * t)); }
  const radii = pts.map((_, i) => 0.3 - 0.13 * (i / 10) + (i === 0 ? 0.12 : 0));
  const tg = tube(pts, radii, 8, false);
  const bark = lc(0x8a6a4a), dark = lc(0x5a4230);
  trunk.add(tg, null, (p) => { const ring = Math.abs(Math.sin(p.y * 8.5)); const k = 0.75 + 0.25 * ring; const c = ring > 0.85 ? dark : bark; return [c[0] * k, c[1] * k, c[2] * k]; }, { extra: { sway: p => clamp((p.y + 0.3) / H, 0, 1) * 0.5 } });
  const top = pts[pts.length - 1];
  // coconuts
  for (let i = 0; i < 4; i++) { const a = rng.range(0, TAU); trunk.add(new THREE.SphereGeometry(0.17, 7, 5), M(top.x + Math.cos(a) * 0.25, top.y - 0.35, top.z + Math.sin(a) * 0.25), lc(0x5a3a1c), { extra: { sway: 0.5 } }); }
  // fronds: arched rachis with leaflets on both sides
  const n = rng.int(9, 12);
  const g0 = lc(0x1f5a1a), g1 = lc(0x6aa83a), dead = lc(0x9a8448);
  for (let f = 0; f < n; f++) {
    const a = f / n * TAU + rng.range(-0.2, 0.2), len = rng.range(3.4, 4.6), droop = rng.range(0.9, 1.6), rise = rng.range(0.4, 1.0);
    const isDead = rng.chance(0.12);
    const S = 9, dir = V(Math.cos(a), 0, Math.sin(a)), side = V(-dir.z, 0, dir.x);
    const spine = [];
    for (let i = 0; i <= S; i++) { const t = i / S; spine.push(V(top.x + dir.x * len * t, top.y + rise * Math.sin(t * Math.PI * 0.6) - droop * t * t * 1.6 - (isDead ? t * 1.6 : 0), top.z + dir.z * len * t)); }
    const pos = [], idx = [], col = [], sw = [];
    for (let i = 0; i < S; i++) {
      const p0 = spine[i], p1 = spine[i + 1], t = i / S;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * 0.95;
      for (const sgn of [-1, 1]) {
        const tip = p0.clone().addScaledVector(side, sgn * w).add(V(0, -0.35 * w, 0)).addScaledVector(dir, 0.35);
        const b = pos.length / 3;
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, tip.x, tip.y, tip.z);
        idx.push(b, b + 1, b + 2);
        const c0 = isDead ? dead : g0, c1 = isDead ? dead : g1, k = 0.85 + nz.noise2(f, i) * 0.15;
        col.push(c0[0], c0[1], c0[2], c0[0], c0[1], c0[2], c1[0] * k, c1[1] * k, c1[2] * k);
        sw.push(0.5 + t * 0.5, 0.5 + t * 0.5, 0.6 + t * 0.6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // bias normals upward (reads as a canopy, lit from the sky)
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) { const y = Math.abs(nr.getY(i)); nr.setXYZ(i, nr.getX(i) * 0.4, 0.8 + y * 0.2, nr.getZ(i) * 0.4); }
    fronds.add(g, null, (p, nn, i) => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]], { extra: { sway: (p, nn, i) => sw[i] } });
  }
  return { trunk: trunk.build(), fronds: fronds.build(), h: H };
}
const PALM_PROTOS = [];
export class Palms {
  constructor() { this.items = []; }
  add(x, y, z, { s = 1, rot = Math.random() * TAU, variant = null } = {}) { this.items.push({ x, y, z, s, rot, v: variant ?? (this.items.length % 4) }); }
  build(parent) {
    if (!this.items.length) return;
    const mats = palmMats();
    while (PALM_PROTOS.length < 4) PALM_PROTOS.push(palmGeo(900 + PALM_PROTOS.length * 37));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = V(0, 1, 0);
    const buckets = new Map();
    for (const it of this.items) { const k = `${it.v}|${Math.floor(it.x / 60)},${Math.floor(it.z / 60)}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
    for (const [k, list] of buckets) {
      const pr = PALM_PROTOS[+k.split('|')[0]];
      for (const [geo, mat] of [[pr.trunk, mats.trunk], [pr.fronds, mats.fronds]]) {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); sc.setScalar(it.s); p.set(it.x, it.y, it.z); m.compose(p, q, sc); im.setMatrixAt(i, m); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'palms';
        parent.add(im);
      }
    }
  }
}

// ================================================================================================ storm clouds & mist
const CLOUD_GLSL = /* glsl */`
Surf surf(vec2 uv) {
  Surf s = S0();
  vec2 p = uv - 0.5;
  float r = length(p * vec2(1.0, 1.25));
  float n = fbm(uv, 4, 5, 71) * 0.5 + 0.5, n2 = fbm(uv + 0.3, 9, 4, 72) * 0.5 + 0.5;
  float d = smoothstep(0.5, 0.12, r + (n - 0.5) * 0.35 + (n2 - 0.5) * 0.12);
  s.col = vec3(0.55 + 0.45 * smoothstep(0.1, -0.35, p.y + (n2 - 0.5) * 0.2));   // lit top, darker belly
  s.a = d * (0.75 + 0.25 * n2);
  return s;
}`;
let CLOUD_TEX = null;
function cloudTex() {
  if (CLOUD_TEX) return CLOUD_TEX;
  const px = bakeSet(CLOUD_GLSL, { size: 256, outputs: ['rgba'] }).rgba;
  const t = new THREE.DataTexture(px, 256, 256, THREE.RGBAFormat); t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (CLOUD_TEX = t);
}
const CLOUD_VS = /* glsl */`
attribute vec4 aC;        // local x, local z, altitude, size
attribute vec4 aD;        // storm index, orbit phase, spin, kind (0 storm, 1 mist)
uniform vec4 uCells[4];   // x, z, r, strength (live storm positions)
uniform float uTime;
varying vec2 vUv; varying float vA; varying float vK; varying vec3 vW;
void main() {
  vUv = uv; vK = aD.w;
  vec4 C = uCells[int(aD.x + 0.5)];
  float ang = aD.y + uTime * aD.z;
  vec2 o = vec2(cos(ang) * aC.x - sin(ang) * aC.y, sin(ang) * aC.x + cos(ang) * aC.y);
  vec3 c = vec3(C.x + o.x, aC.z + sin(uTime * 0.3 + aD.y * 5.0) * 0.8, C.y + o.y);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float s = aC.w * (C.z > 0.0 ? 1.0 : 0.0);
  vec3 p = c + (right * position.x + up * position.y) * s;
  vW = p;
  vA = C.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const CLOUD_FS = /* glsl */`
uniform sampler2D uTex; uniform vec3 uLit; uniform vec3 uDark; uniform vec3 uMist; uniform vec3 uCamPos; uniform float uFlash;
varying vec2 vUv; varying float vA; varying float vK; varying vec3 vW;
void main() {
  vec4 t = texture2D(uTex, vUv);
  vec3 col = vK > 0.5 ? uMist * (0.8 + 0.3 * t.r) : mix(uDark, uLit, t.r) + vec3(0.6, 0.7, 0.9) * uFlash * t.r;
  // fade near the camera so flying through a bank never becomes a wall
  float d = length(vW - uCamPos);
  float a = t.a * vA * smoothstep(8.0, 26.0, d) * (vK > 0.5 ? 0.5 : 0.72);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
export class StormClouds {
  /** storms: [{ x, z, r, kind: 'storm'|'mist' }] (≤ 4); puffs orbit their storm's live centre */
  constructor(storms, { quality = 1 } = {}) {
    const rng = new RNG(31);
    this.storms = storms.slice(0, 4);
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.attributes.position); g.setAttribute('uv', quad.attributes.uv);
    const C = [], D = [];
    this.storms.forEach((S, si) => {
      const mist = S.kind === 'mist', n = Math.round((mist ? 60 : 90) * Math.max(0.5, quality));
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * S.r * (mist ? 0.9 : 0.85);
        const alt = mist ? rng.range(2, 9) : rng.range(19, 34) - (r / S.r) * 6;
        const size = mist ? rng.range(18, 34) : rng.range(26, 48);
        C.push(Math.cos(a) * r, Math.sin(a) * r, alt, size);
        D.push(si, rng.range(0, TAU), (mist ? 0.004 : 0.018) * (S.id === 'maelstrom' ? 1.6 : 1) * (1 - r / S.r * 0.5), mist ? 1 : 0);
      }
    });
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(C), 4));
    g.setAttribute('aD', new THREE.InstancedBufferAttribute(new Float32Array(D), 4));
    g.instanceCount = C.length / 4;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const cells = [0, 1, 2, 3].map(i => { const s = this.storms[i]; return new THREE.Vector4(s?.x || 0, s?.z || 0, s?.r || 0, 1); });
    this.u = { uTex: { value: cloudTex() }, uCells: { value: cells }, uTime: G.uTime, uLit: { value: new THREE.Color(0x8a96a8) }, uDark: { value: new THREE.Color(0x2a3040) }, uMist: { value: new THREE.Color(0xc8d8ec) }, uCamPos: G.uCamPos, uFlash: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, uniforms: this.u, transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 12; this.mesh.name = 'storm-clouds';
  }
  /** live storm list (moving squalls) + visibility fade by the storm's `strength` 0..1 */
  update(dt, t, focus, live) {
    const cells = this.u.uCells.value;
    this.storms.forEach((S, i) => { const L = live?.find(l => l.id === S.id); cells[i].set(L?.x ?? S.x, L?.z ?? S.z, S.r, S.kind === 'mist' ? (S.visible ?? 1) : 1); });
    this.u.uFlash.value = Math.max(0, this.u.uFlash.value - dt * 3);
  }
  flash(v = 1) { this.u.uFlash.value = v; }
  setMist(v) { const i = this.storms.findIndex(s => s.kind === 'mist'); if (i >= 0) this.storms[i].visible = v; }
  setEnv(env) { const n = env.night || 0; this.u.uLit.value.set(0x8a96a8).multiplyScalar(1 - n * 0.6); this.u.uDark.value.set(0x2a3040).multiplyScalar(1 - n * 0.5); this.u.uMist.value.set(n > 0.5 ? 0x7a98c0 : 0xc8d8ec); }
}

// ================================================================================================ helpers
function frameAt(ox, oz) { return (x, z) => [ox + x, oz + z]; }
/** stylised cannon on a wooden carriage (muzzle toward local -Z) */
export function cannon(kit, x, y, z, ry = 0, s = 1) {
  const F = new Frame(x, y, z, ry);
  kit.add('planks', box(0.9 * s, 0.35 * s, 1.5 * s, 1), F.at(0, 0.32 * s, 0.1), { tint: 0x6a4a2e });
  for (const sx of [-1, 1]) for (const sz of [-0.45, 0.55]) kit.add('timber', cyl(0.26 * s, 0.26 * s, 0.12 * s, 10, 1), F.at(sx * 0.5 * s, 0.26 * s, sz * s, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x4a3420, ao: false });
  const barrel = new THREE.LatheGeometry([[0.0, 0], [0.26, 0], [0.3, 0.08], [0.24, 0.3], [0.2, 1.3], [0.23, 1.38], [0.2, 1.46], [0.12, 1.46], [0.12, 1.3]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), 12);
  kit.add('metal', barrel, F.at(0, 0.62 * s, 0.55 * s, 0, 1, 1, 1, -Math.PI / 2 + 0.08), { tint: 0x2e2e34, ao: false });
}
/** stone lantern post (the Moonveil lanterns) — returns the flame position */
export function lanternPost(kit, x, y, z, { h = 2.6, color = 0x7ad8ff, lit = true, s = 1 } = {}) {
  kit.add('stone', cyl(0.36 * s, 0.44 * s, 0.4 * s, 8, 1), M(x, y + 0.2 * s, z), { tint: 0xb8bcc4, yGround: y });
  kit.add('stone', cyl(0.16 * s, 0.2 * s, h * s, 6, 1), M(x, y + (0.4 + h / 2) * s, z), { tint: 0xc8ccd4 });
  kit.add('stone', box(0.7 * s, 0.16 * s, 0.7 * s, 1), M(x, y + (0.5 + h) * s, z, Math.PI / 4), { tint: 0xb8bcc4, ao: false });
  for (const [dx, dz] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) kit.add('stone', box(0.08 * s, 0.5 * s, 0.08 * s, 1), M(x + dx * s, y + (0.82 + h) * s, z + dz * s), { tint: 0xc8ccd4, ao: false });
  kit.add('stone', cone(0.55 * s, 0.5 * s, 4), M(x, y + (1.32 + h) * s, z, Math.PI / 4), { tint: 0x9aa0aa, ao: false });
  const fy = y + (0.82 + h) * s;
  if (lit) kit.glow(sphere(0.14 * s, 8, 6), M(x, fy, z), color, 3);
  return [x, fy, z];
}
/** bronze bell (lathe) hanging from (x, y, z) */
export function bell(kit, x, y, z, s = 1, tint = 0x9a7a3a) {
  const pts = [[0.02, 0], [0.5, 0.02], [0.62, 0.12], [0.58, 0.3], [0.45, 0.7], [0.36, 1.05], [0.3, 1.2], [0.08, 1.26], [0.0, 1.26]].map(([r, h]) => new THREE.Vector2(r * s, h * s));
  const g = new THREE.LatheGeometry(pts, 16);
  kit.add('gold', g, M(x, y - 1.26 * s, z), { tint, ao: false });
  kit.add('metal', cyl(0.06 * s, 0.06 * s, 0.4 * s, 6, 1), M(x, y + 0.1 * s, z), { tint: 0x2a2a2a, ao: false });
}
function ruinColumn(kit, x, y, z, h, rng, tint = 0xd8d2c4) {
  kit.add('stone', box(1.1, 0.4, 1.1, 1), M(x, y + 0.2, z, rng.range(0, 1)), { tint, yGround: y });
  kit.add('marble', cyl(0.36, 0.42, h, 10, 1), M(x, y + 0.4 + h / 2, z, 0, 1, 1, 1, rng.range(-0.05, 0.05), rng.range(-0.05, 0.05)), { tint });
  if (rng.chance(0.5)) kit.add('stone', box(1.0, 0.35, 1.0, 1), M(x, y + 0.55 + h, z, rng.range(0, 1)), { tint, ao: false });
}
function palmRing(palms, H, ox, oz, pts, rng, s = 1) { for (const [x, z] of pts) palms.add(ox + x, H(x, z) - 0.2, oz + z, { s: s * rng.range(0.85, 1.15), variant: rng.int(0, 3) }); }
/** scatter palms on sand/grass between heights a..b inside radius r (local), avoiding circles */
function scatterPalms(palms, H, ox, oz, n, r, rng, { a = 0.5, b = 4, avoid = [], s = 1 } = {}) {
  let k = 0, tries = 0;
  while (k < n && tries++ < n * 30) {
    const ang = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * r, x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, h = H(x, z);
    if (h < a || h > b || avoid.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue;
    palms.add(ox + x, h - 0.2, oz + z, { s: s * rng.range(0.8, 1.2) }); k++;
  }
}

// ================================================================================================ Solhaven (sea view)
/** Solhaven's harbour and skyline, mirroring the solhaven zone layout (chart = zone + SOLHAVEN_OFFSET). */
export function buildSolhaven(kit, flags, H, { flora } = {}) {
  const O = SOLHAVEN_OFFSET, X = x => x + O.x, Z = z => z + O.z;
  const HAR = -1.5 + O.y, QX = 62, HX = 46, SEA = -3.0 + O.y, CITY = O.y, TER = 3 + O.y;
  const h = (x, z) => H(X(x), Z(z));
  const HZ = (x, z) => H(x, z);
  // quay wall & promenade edge
  kit.add('stone', box(1.4, 12, 112, 2), M(X(QX + 0.7), HAR - 5.8, Z(24)), { tint: 0xd0c8bc });
  for (let z = -28; z < 80; z += 6) if (![-20, 6, 32, 58].some(pz => Math.abs(z - pz) < 4)) kit.add('stone', box(0.5, 0.6, 0.5, 1), M(X(QX - 0.4), HAR + 0.3, Z(z)), { tint: 0xd8d0c4 });
  P.retaining(kit, X(HX - 0.6), Z(81), X(HX - 0.6), Z(-32.6), HAR, CITY);
  // piers, moored ships, cranes, cargo
  const piers = [-20, 6, 32, 58];
  for (const pz of piers) Bd.pier(kit, X(QX - 1), Z(pz), -Math.PI / 2, 24, 4.2, HAR + 0.1);
  Bd.ship(kit, flags, X(76.5), SEA - 0.4, Z(19), -Math.PI / 2, { len: 22, beam: 6.2, masts: 2, stripe: 0x2a4a8a, seed: 1 });
  Bd.ship(kit, flags, X(75.5), SEA - 0.4, Z(45), -Math.PI / 2 + 0.05, { len: 17, beam: 5.2, masts: 2, hull: 0x7a4a2a, stripe: 0x8a2a2a, sail: 0xf0e0c0, seed: 2 });
  Bd.ship(kit, flags, X(78.5), SEA - 0.4, Z(-7), -Math.PI / 2 - 0.04, { len: 26, beam: 7, masts: 3, hull: 0x5a3822, stripe: 0xc8a040, seed: 3 });
  for (const z of [-12, 22, 50]) Bd.crane(kit, X(QX - 2.4), HAR, Z(z), Math.PI / 2);
  for (let i = 0; i < 8; i++) { const z = -27 + i * 13.5; if (piers.some(p => Math.abs(z - p) < 4.5)) continue; P.crateStack(kit, X(HX + 3), HAR, Z(z), 0.2, 70 + i); }
  for (const pz of piers) { P.lampPost(kit, X(QX - 1.0), HAR, Z(pz + 6.5), Math.PI / 2); P.ropeCoil(kit, X(QX + 20), HAR + 0.21, Z(pz + 1.2), 0.8); }
  Bd.lighthouse(kit, flags, X(104), h(104, 56), Z(56));
  // north-east sea wall & tower
  P.wall(kit, X(HX - 0.5), Z(-33), X(QX + 4), Z(-33), (x, z) => (x > X(HX) ? HAR : CITY), { h: 4, t: 1.4 });
  P.tower(kit, X(QX + 4), HAR, Z(-33), { r: 3.4, h: 11, roofH: 7, roof: Bd.ROOF.blue, flags, flag: 0x2a5aa8 });
  // city walls & towers (seaward and north)
  const W = (ax, az, bx, bz, o = {}) => P.wall(kit, X(ax), Z(az), X(bx), Z(bz), HZ, { h: 7, t: 2.2, buttress: 3, ...o });
  W(-82, 82, 58, 82); W(58, 82, QX, 82); W(-82, -84, -11.6, -84); W(11.6, -84, QX + 3, -84); W(-82, -84, -82, 82);
  for (const [x, z] of [[-82, -84], [-82, 82], [58, 82], [QX + 3, -84]]) P.tower(kit, X(x), h(x, z), Z(z), { r: 3.6, h: 12, roofH: 8, roof: Bd.ROOF.blue, flags, flag: 0xb02a2a });
  Bd.keep(kit, flags, X(0), h(0, -128), Z(-128));
  Bd.guildHall(kit, flags, X(44), TER, Z(-64), 0, { banner: 0x2a5aa8 });
  // skyline: rows of houses along the main streets (same seeds as the city)
  const roofs = [Bd.ROOF.blue, Bd.ROOF.blue, Bd.ROOF.red, Bd.ROOF.deepblue, Bd.ROOF.terracotta];
  const row = (a, b, street, o) => Bd.row(kit, [X(a[0]), Z(a[1])], [X(b[0]), Z(b[1])], HZ, { street: [X(street[0]), Z(street[1])], roofs, ...o });
  row([27, -6.3], [HX - 1.5, -6.3], [36, 0], { depth: [8, 10], floors: [2, 3], seed: 31, shopChance: 0.95, balcony: 0.6 });
  row([HX - 1.5, 7.2], [26, 7.2], [36, 0], { depth: [6.5, 7.5], widths: [5.5, 7.5], floors: [1, 1], seed: 33, shopChance: 0.9, balcony: 0 });
  row([16, 35.5], [44, 35.5], [25, 44], { depth: [7.5, 8.5], floors: [2, 3], seed: 112, shopChance: 0.4, balcony: 0.5 });
  row([16, 72], [44, 72], [30, 64], { depth: [7.5, 8.5], floors: [1, 1], seed: 114, shopChance: 0 });
  row([HX - 1.5, 27], [16, 27], [30, 20], { depth: [6, 7], floors: [2, 2], seed: 119, shopChance: 0.2 });
  row([5.6, 26], [5.6, 79], [0, 50], { depth: [8, 9.5], floors: [2, 3], seed: 111, shopChance: 0.4 });
  row([-5.6, 79], [-5.6, 26], [0, 50], { depth: [7, 8], floors: [2, 3], seed: 115, shopChance: 0.4 });
  row([14, -44], [14, -80], [0, -60], { depth: [8, 9], floors: [2, 3], seed: 103, shopChance: 0.3 });
  row([-24, 5.4], [-44, 5.4], [-35, 0], { depth: [6.5, 7.5], widths: [6, 8], floors: [1, 1], seed: 75, shopChance: 0.5, balcony: 0 });
  row([-66, -23], [-46, -23], [-56, -10], { depth: [7, 8], floors: [2, 3], seed: 71, shopChance: 0 });
  row([-14, 27], [-38, 27], [-26, 20], { depth: [6.5, 7], floors: [1, 1], seed: 116, shopChance: 0.2 });
  // the plaza ring and the Seven Lights (a gleam you can spot from the sea)
  for (let i = 0; i < 9; i++) { const a = -2.8 + i * 0.62, r = 29; Bd.townhouse(kit, X(Math.cos(a) * r), CITY, Z(Math.sin(a) * r), Math.atan2(-Math.cos(a), -Math.sin(a)), { w: 8, d: 8.5, floors: 2 + (i % 2), seed: 200 + i, roof: roofs[i % roofs.length] }); }
  Bd.sevenLights(kit, X(0), CITY + 0.2, Z(0), { r: 1.5 });
  // gardens outside the walls, pines on the keep hill
  if (flora) {
    const rng = new RNG(8);
    for (let i = 0; i < 60; i++) { const x = rng.range(-150, -95), z = rng.range(-120, 120); flora.tree(rng.chance(0.6) ? 'broadleaf' : 'cypress', X(x), h(x, z) - 0.1, Z(z), { s: rng.range(0.9, 1.3), variant: i % 3, block: false }); }
    for (let i = 0; i < 40; i++) { const x = rng.range(-90, 60), z = rng.range(-170, -100); if (Math.abs(x) < 36 && z > -152) continue; flora.tree(rng.chance(0.7) ? 'pine' : 'cypress', X(x), h(x, z) - 0.1, Z(z), { s: rng.range(0.9, 1.3), variant: i % 3, block: false }); }
    for (let i = 0; i < 30; i++) { const x = rng.range(-80, 30), z = rng.range(88, 150); if (h(x, z) < 0.5) continue; flora.tree(rng.chance(0.7) ? 'broadleaf' : 'bush', X(x), h(x, z) - 0.1, Z(z), { s: rng.range(0.9, 1.3), variant: i % 3, block: false }); }
  }
  return { dock: [X(83.5), Z(6)] };
}

// ================================================================================================ islands
const BUILD = {};
/**
 * ctx: { kit, flags, flora, palms, ox, oz, H(localX, localZ) → height, lod: 'sea'|'full', night, spots (out) }
 * Returns spots: { name: [x, y, z] } in WORLD coordinates of the caller's frame (ox, oz applied).
 */
export function buildLandmarks(id, ctx) {
  const f = BUILD[id]; if (!f) return {};
  const spots = {};
  f({ ...ctx, spots, W: frameAt(ctx.ox, ctx.oz), rng: new RNG(id.length * 131 + 7) });
  return spots;
}

// ---------------------------------------------------------------- Coinflip Cay: the Gilded Gull casino
BUILD.coinflip = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const cx = -18, cz = -11, cy = H(cx, cz), full = lod === 'full';
  const [X, Z] = W(cx, cz);
  const F = new Frame(X, cy, Z, 0);
  // the pavilion: marble drum, gold-ribbed dome, lantern cupola, arched loggia
  kit.add('marble', cyl(9, 9.4, 1.0, 28, 2), F.at(0, 0.5, 0), { tint: 0xf4efe4, yGround: cy });
  kit.add('marble', cyl(7.6, 7.6, 6.5, 28, 2, true), F.at(0, 4.2, 0), { tint: 0xfaf5ea });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; kit.add('marble', cyl(0.32, 0.36, 6.4, 8, 1), F.at(Math.cos(a) * 8.3, 4.2, Math.sin(a) * 8.3), { tint: 0xffffff }); }
  kit.add('stone', cyl(8.9, 8.9, 0.5, 28, 1), F.at(0, 7.6, 0), { tint: 0xe8d8b0, ao: false });
  const dome = new THREE.SphereGeometry(7.8, 28, 12, 0, TAU, 0, Math.PI / 2);
  kit.add('gold', dome, F.at(0, 7.8, 0, 0, 1, 0.8, 1), { tint: 0xf0c050, ao: false });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const rib = tube(Array.from({ length: 9 }, (_, k) => { const t = k / 8 * Math.PI / 2; return V(Math.cos(a) * 7.85 * Math.cos(t), 7.8 + 6.25 * Math.sin(t), Math.sin(a) * 7.85 * Math.cos(t)); }), Array(9).fill(0.12), 5, false); kit.add('gold', rib, F.m, { tint: 0xfff0b0, ao: false }); }
  kit.add('marble', cyl(1.5, 1.7, 2.2, 12, 1), F.at(0, 14.8, 0), { tint: 0xffffff, ao: false });
  kit.glow(cyl(1.2, 1.2, 1.6, 12, 1), F.at(0, 14.8, 0), 0xffd070, 3);
  kit.add('gold', cone(1.8, 2.6, 12), F.at(0, 17.2, 0), { tint: 0xf8d060, ao: false });
  kit.add('gold', sphere(0.5, 10, 8), F.at(0, 18.8, 0), { ao: false });
  kit.light(X, cy + 15, Z, 0xffd080, 10, 22, 0.05);
  // four lantern towers
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, tx = Math.cos(a) * 11.5, tz = Math.sin(a) * 11.5;
    kit.add('marble', cyl(0.9, 1.1, 9, 10, 1), F.at(tx, 4.5, tz), { tint: 0xf4efe4 });
    kit.add('gold', cone(1.3, 2.4, 10), F.at(tx, 10.2, tz), { tint: 0xe8b040, ao: false });
    kit.glow(sphere(0.55, 10, 8), F.at(tx, 9.2, tz), i % 2 ? 0xff5a8a : 0x5ae0ff, 3.2);
  }
  // striped awnings over the entrance (south)
  for (let i = 0; i < 5; i++) kit.add('cloth', box(1.6, 0.08, 3, 1), F.at(-3.2 + i * 1.6, 6.3, 9.6, 0, 1, 1, 1, 0.25), { tint: i % 2 ? 0xc03a4a : 0xf6e8c8, ao: false });
  kit.glow(box(4.2, 1.1, 0.2, 1), F.at(0, 7.9, 9.2), 0xffc040, 2.6);          // the sign: THE GILDED GULL
  kit.block(circle(X, Z, 9.4), 0.35);
  spots.casino = [X, cy, Z]; spots.door = [X, cy, Z + 10.5];
  // the Golden Gull on the northern horn
  { const gx = 16, gz = -38, gy = H(gx, gz); const [a, b] = W(gx, gz); const G2 = new Frame(a, gy, b, 0.6);
    kit.add('stone', cyl(1.4, 1.8, 2.2, 10, 1), G2.at(0, 1.1, 0), { tint: 0xe6dccb, yGround: gy });
    kit.add('gold', blob(1, 1, null, [0.9, 0.75, 1.6]), G2.at(0, 3.2, 0), { tint: 0xffd060, ao: false });
    kit.add('gold', blob(0.6, 1), G2.at(0, 3.9, -1.3), { tint: 0xffd060, ao: false });
    kit.add('gold', cone(0.22, 0.7, 6), G2.at(0, 3.8, -2.1, 0, 1, 1, 1, -Math.PI / 2), { tint: 0xffb030, ao: false });
    for (const s of [-1, 1]) kit.add('gold', box(3.4, 0.12, 1.1, 1), G2.at(s * 1.9, 3.8, 0.2, 0, 1, 1, 1, 0, s * 0.45), { tint: 0xffe070, ao: false });
    kit.block(circle(a, b, 1.9), 0.3); spots.gull = [a, gy, b]; }
  // boardwalk: pier (south) → casino
  const pier = BUILD.pier(kit, W, H, 4, 60, 60, 4.2);
  spots.pier = pier;
  // beach umbrellas & deck chairs
  for (let i = 0; i < 6; i++) { const x = -34 + i * 6 + rng.range(-1, 1), z = 34 + rng.range(-2, 2); const [a, b] = W(x, z); const y = H(x, z); kit.add('timber', cyl(0.05, 0.05, 2.4, 6, 1), M(a, y + 1.2, b), { ao: false }); kit.add('cloth', cone(1.3, 0.55, 8), M(a, y + 2.5, b), { tint: i % 2 ? 0xe04a5a : 0x3ab0d8, ao: false }); }
  palmRing(palms, H, ox, oz, [[-38, 20], [-44, 4], [-40, -18], [-30, -34], [-12, -40], [6, -44], [30, -22], [32, 18], [14, 30], [-24, 28], [-8, 34], [26, 34], [36, -8]], rng, 1.05);
  scatterPalms(palms, H, ox, oz, full ? 18 : 10, 44, rng, { a: 0.6, b: 5, avoid: [[cx, cz, 16], [4, 46, 6], [16, -38, 5]] });
  if (flags) P.flagPole(kit, flags, ...[W(-6, 4)[0], H(-6, 4), W(-6, 4)[1]], { h: 9, color: 0xe8b830 });
};

/** a timber pier from the shore to (x, zEnd) (local), deck at y; returns the end spot (world) */
/** a timber pier whose sea end is at (x, zEnd) (local), running north until it reaches dry land (auto length) */
BUILD.pier = (kit, W, H, x, zEnd, maxLen = 60, w = 4, deckY = 0.6) => {
  let len = 6;
  while (len < maxLen && H(x, zEnd - len) < deckY - 0.1) len += 0.5;
  len += 1.5;
  const [a, b] = W(x, zEnd);
  Bd.pier(kit, a, b, 0, len, w, deckY, { posts: 3 });
  // lanterns on posts at the pier head
  for (const s of [-1, 1]) { kit.add('timber', cyl(0.12, 0.14, 2.6, 6, 1), M(a + s * (w / 2 - 0.2), deckY + 1.3, b - 0.6), { tint: 0x6a4a30, ao: false }); kit.glow(box(0.26, 0.34, 0.26, 1), M(a + s * (w / 2 - 0.2), deckY + 2.5, b - 0.6), 0xffc070, 2.6); kit.light(a + s * (w / 2 - 0.2), deckY + 2.4, b - 0.6, 0xffc070, 4, 8, 0.1); }
  return [a, deckY, b, len, w];
};

// ---------------------------------------------------------------- Songstone Isle: the five Cantors
export const CANTORS = [
  { song: 'homeward', name: 'the Pilgrim', a: -Math.PI / 2 },
  { song: 'tides', name: 'the Mariner', a: -Math.PI / 2 + TAU / 5 },
  { song: 'rest', name: 'the Mother', a: -Math.PI / 2 + TAU * 2 / 5 },
  { song: 'valor', name: 'the Knight', a: -Math.PI / 2 + TAU * 3 / 5 },
  { song: 'sunrise', name: 'the Herald', a: -Math.PI / 2 + TAU * 4 / 5 },
];
BUILD.songstone = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const cz = -6, full = lod === 'full';
  // amphitheatre: stone tiers (rings) descending to the floor
  for (let i = 0; i < 4; i++) {
    const r = 13.2 + i * 1.6, [a, b] = W(0, cz), y = H(0, cz) + 0.25 + i * 0.75;
    const ring = new THREE.RingGeometry(r - 0.8, r + 0.6, 40, 1, Math.PI * 0.18, Math.PI * 1.64); ring.rotateX(-Math.PI / 2);
    kit.add('stone', ring, M(a, y, b, Math.PI / 2 + 0.2), { tint: 0xd6ceb8, ao: false });
    const wall = new THREE.CylinderGeometry(r - 0.8, r - 0.8, 0.75, 40, 1, true, Math.PI * 0.18, Math.PI * 1.64);
    kit.add('stone', wall, M(a, y - 0.37, b, Math.PI / 2 + 0.2), { tint: 0xc8bfa8 });
  }
  { const [a, b] = W(0, cz); const y = H(0, cz);
    kit.add('marble', cyl(3.2, 3.6, 0.6, 24, 1), M(a, y + 0.3, b), { tint: 0xe8e2d4 });                  // the Songstone dais
    kit.add('marble', blob(1.4, 1, d => 1 + Math.sin(d.y * 6) * 0.05, [0.9, 1.5, 0.9]), M(a, y + 2.1, b), { tint: 0xd8e4f0 });
    kit.glow(new THREE.TorusGeometry(2.2, 0.06, 6, 40), M(a, y + 0.65, b, 0, 1, 1, 1, Math.PI / 2), 0x9ad8ff, 2.2);
    spots.stone = [a, y, b]; }
  // the Cantors on their terrace
  CANTORS.forEach((c, i) => {
    const x = Math.cos(c.a) * 22.5, z = cz + Math.sin(c.a) * 22.5, [a, b] = W(x, z), y = H(x, z);
    const ry = Math.atan2(x, z - cz);                // facing the centre (local +Z of the statue toward the dais)
    P.statue(kit, a, y, b, ry + Math.PI, { s: 1.7, pose: i % 2 ? 'shield' : 'sword' });
    kit.glow(new THREE.TorusGeometry(1.6, 0.05, 6, 28), M(a, y + 2.55, b, 0, 1, 1, 1, Math.PI / 2), [0xffd070, 0x6ad0ff, 0xffa0d0, 0xff7050, 0xfff0a0][i], 1.8);
    spots['cantor' + i] = [a, y, b];
  });
  // ruins on the northern hill, wind harps
  for (let i = 0; i < 7; i++) { const x = -12 + i * 4, z = -40 + rng.range(-2, 2), [a, b] = W(x, z); ruinColumn(kit, a, H(x, z), b, rng.range(2.5, 6), rng); }
  for (let i = 0; i < 3; i++) {
    const x = [-30, 30, 0][i], z = [-26, 10, -52][i]; if (H(x, z) < 0.5) continue; const [a, b] = W(x, z), y = H(x, z);
    const F = new Frame(a, y, b, rng.range(0, 3));
    kit.add('timber', box(0.25, 5, 0.25, 1), F.at(-1.4, 2.5, 0), {}); kit.add('timber', box(0.25, 5, 0.25, 1), F.at(1.4, 2.5, 0), {});
    kit.add('timber', box(3.2, 0.25, 0.3, 1), F.at(0, 5, 0), { ao: false });
    for (let k = 0; k < 7; k++) kit.add('metal', box(0.02, 4.4, 0.02, 1), F.at(-1.1 + k * 0.37, 2.7, 0), { tint: 0xd8c890, ao: false });
    spots['harp' + i] = [a, y, b];
  }
  spots.pier = BUILD.pier(kit, W, H, 6, 56, 60, 4.2);
  if (flora) { for (let i = 0; i < (full ? 26 : 14); i++) { const x = rng.range(-44, 44), z = rng.range(-50, 38), y = H(x, z); if (y < 1.4 || Math.hypot(x, z - cz) < 27) continue; flora.tree(rng.chance(0.5) ? 'cypress' : 'broadleaf', ox + x, y - 0.1, oz + z, { s: rng.range(0.8, 1.1), variant: i % 3, block: full }); } }
};

// ---------------------------------------------------------------- Powderkeg Cove: the bastion
export const GUNS = [[-14, -36, 0.5], [-7, -40, 0.22], [0, -42.5, 0], [7, -40, -0.22], [14, -36, -0.5], [-17, -28, 0.9], [17, -28, -0.9]];
BUILD.powderkeg = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const by = 7.4;
  // the bastion: low gun parapet facing the open sea (north), tall walls on the flanks
  const pts = BASTION;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a1, b1] = W(...pts[i]), [a2, b2] = W(...pts[i + 1]);
    const north = i >= 1 && i <= 4;
    P.wall(kit, a1, b1, a2, b2, (x, z) => Math.min(by, H(x - ox, z - oz)), { h: north ? 1.4 : 4.2, t: 1.8, crenel: !north, buttress: 0 });
  }
  for (const [x, z] of [[-21, -35], [21, -35]]) { const [a, b] = W(x, z); P.tower(kit, a, H(x, z) - 0.5, b, { r: 3.2, h: 9, roofH: 5, roof: 0x5a3a2a, windows: false, flags, flag: 0x1a1a1a }); }
  // gun emplacements on the yard, muzzles over the parapet
  GUNS.forEach(([x, z, r], i) => { const [a, b] = W(x, z); kit.add('stone', box(2.6, 0.5, 2.8, 1), M(a, by + 0.25, b, r), { tint: 0xb8b0a0 }); cannon(kit, a, by + 0.5, b, r, 1.25); spots['gun' + i] = [a, by + 0.5, b, r]; });
  // the powder magazine (defend it!), a flag, shot pyramids
  { const [a, b] = W(0, -31); Bd.townhouse(kit, a, by, b, 0, { w: 7, d: 5.5, floors: 1, roof: 0x6a3a2a, seed: 5, noDoor: false, chimney: false }); spots.magazine = [a, by, b + 3.4]; }
  if (flags) { const [a, b] = W(9, -27); P.flagPole(kit, flags, a, by, b, { h: 11, color: 0xe8e0d0 }); }
  for (const [x, z] of [[-10, -30], [10, -30], [-4, -36]]) { const [a, b] = W(x, z); for (let k = 0; k < 6; k++) kit.add('metal', sphere(0.2, 8, 6), M(a + (k % 3) * 0.42 - 0.42 + (k > 2 ? 0.21 : 0), by + 0.2 + (k > 2 ? 0.34 : 0), b + (k > 2 ? 0 : 0.1)), { tint: 0x2a2a2e, ao: false }); }
  for (let i = 0; i < 6; i++) { const x = rng.range(-16, 16), z = rng.range(-36, -25); if (Math.hypot(x, z + 31) < 5) continue; const [a, b] = W(x, z); P.barrel(kit, a, by, b, 1, rng.range(0, 6), { block: lod === 'full' }); }
  // the smugglers' village around the cove
  const houses = [[-30, 10, 1.2], [-26, 26, 1.0], [30, 10, -1.2], [26, 26, -1.0], [-14, -6, 0.2], [14, -6, -0.2]];
  houses.forEach(([x, z, r], i) => { const [a, b] = W(x, z); Bd.townhouse(kit, a, H(x, z), b, r + Math.PI, { w: 6, d: 6, floors: 1 + (i % 2), roof: [0xb4523a, 0x8a5a3a, 0x3d62a8][i % 3], seed: 40 + i, timber: i % 2 === 0 }); });
  for (let i = 0; i < 8; i++) { const x = rng.range(-24, 24), z = rng.range(-12, 30); const y = H(x, z); if (y < 0.6 || Math.abs(x) < 6) continue; const [a, b] = W(x, z); P.barrel(kit, a, y, b, 1, rng.range(0, 6), { block: lod === 'full' }); }
  spots.pier = BUILD.pier(kit, W, H, -6, 48, 60, 4.2, 0.7);
  palmRing(palms, H, ox, oz, [[-40, -2], [40, -2], [-44, 20], [44, 20], [-36, 36], [36, 36]], rng);
};
// ---------------------------------------------------------------- Moonveil Atoll: the lantern shrine
export const LANTERNS = [0, 1, 2, 3, 4].map(i => ({ a: -Math.PI / 2 + i * TAU / 5 + 0.3, r: 38 }));
BUILD.moonveil = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng, night }) => {
  // shrine on the central islet: ring of columns, a crescent arch, the moon basin
  const [a, b] = W(0, -4), y = H(0, -4);
  for (let i = 0; i < 8; i++) { const ang = i / 8 * TAU; ruinColumn(kit, a + Math.cos(ang) * 6.5, y, b + Math.sin(ang) * 6.5, 4.2, rng, 0xc8ccd8); }
  const arch = new THREE.TorusGeometry(5, 0.5, 8, 30, Math.PI * 1.3);
  kit.add('marble', arch, M(a, y + 1.2, b - 1, 0, 1, 1, 1, 0, -Math.PI * 0.15), { tint: 0xdde4f0 });
  kit.add('marble', cyl(2.2, 2.6, 0.9, 20, 1), M(a, y + 0.45, b), { tint: 0xc8d0dc });
  kit.glow(cyl(1.9, 1.9, 0.1, 20, 1), M(a, y + 0.92, b), 0x9ad0ff, night ? 2.4 : 0.6);
  spots.shrine = [a, y, b];
  // bridge from the south ring to the islet
  for (let i = 0; i < 6; i++) { const z = 7 + i * 3.2, [c, d] = W(0, z), y = H(0, z); kit.add('planks', box(3, 0.2, 3.0, 1.5), M(c, y + 0.1, d), { tint: 0x9a8a78, ao: false }); for (const s of [-1, 1]) kit.add('stone', cyl(0.18, 0.22, 1.1, 6, 1), M(c + s * 1.7, y + 0.5, d), { tint: 0xb0b8c4, ao: false }); }
  // the five lantern posts around the ring
  LANTERNS.forEach((L, i) => { const x = Math.cos(L.a) * L.r, z = -2 + Math.sin(L.a) * L.r, [c, d] = W(x, z); const f = lanternPost(kit, c, H(x, z), d, { h: 2.8, color: 0x7ad8ff, lit: false, s: 1.2 }); spots['lantern' + i] = f; });
  // the wreck of the ghost galleon on the east reef
  { const [c, d] = W(44, -24); Bd.ship(kit, flags, c, -1.6, d, 0.9, { len: 20, beam: 6, masts: 2, hull: 0x3a3a44, stripe: 0x2a2a30, sail: 0x9aa4b0, seed: 9 }); spots.wreck = [c, 0, d]; }
  spots.pier = BUILD.pier(kit, W, H, 0, 56, 60, 4, 0.6);
  palmRing(palms, H, ox, oz, [[-36, 14], [36, 12], [-20, -38], [22, -38], [-40, -14], [40, -12]], rng, 0.9);
};

// ---------------------------------------------------------------- Stormcrown Spire
export const SPIRE = { turns: 2.6, r0: 21, r1: 6, h0: 4, h1: 40, width: 3.6, a0: Math.PI / 2 };
/** point on the spiral ledge at t 0..1 (local) → { x, y, z, a, r } */
export function spirePath(t) {
  const S = SPIRE, a = S.a0 - t * S.turns * TAU, r = lerp(S.r0, S.r1, t), y = lerp(S.h0, S.h1, t);
  return { x: Math.cos(a) * r, y, z: -6 + Math.sin(a) * r, a, r };
}
BUILD.stormcrown = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const [cx, cz] = W(0, -6), S = SPIRE;
  // the rock: stacked, jittered frusta tapering to the crown
  const nz = new Simplex(4);
  const layers = 14;
  for (let i = 0; i < layers; i++) {
    const t = i / layers, t2 = (i + 1) / layers;
    const r0 = lerp(S.r0 - 1.5, S.r1 - 1.2, t), r1 = lerp(S.r0 - 1.5, S.r1 - 1.2, t2), y0 = lerp(0, S.h1, t), y1 = lerp(0, S.h1, t2);
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0 + 0.4, 18, 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), a = Math.atan2(z, x); const j = 1 + nz.noise2(a * 2 + i, y * 0.3 + i * 0.7) * 0.16; p.setXYZ(k, x * j, y, z * j); }
    g.computeVertexNormals();
    kit.add('rock', g, M(cx, (y0 + y1) / 2, cz, i * 0.7), { tint: i % 2 ? 0x7c7684 : 0x8a8492, yGround: 0, aoH: 30, chunkAt: [cx, cz] });
    if (i % 3 === 1) kit.glow(new THREE.TorusGeometry((r0 + r1) / 2 + 0.05, 0.05, 4, 30), M(cx, (y0 + y1) / 2 + 0.6, cz, i, 1, 1, 1, Math.PI / 2 + Math.sin(i) * 0.08), 0x8ad8ff, 1.6);
  }
  // the ledge: planked segments bolted to the rock, with posts and a rope rail
  const N = Math.round(S.turns * 26);
  for (let i = 0; i < N; i++) {
    const p0 = spirePath(i / N), p1 = spirePath((i + 1) / N), mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2, my = (p0.y + p1.y) / 2;
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z), rot = Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2;
    const [a, b] = W(mx, mz);
    kit.add('planks', box(S.width, 0.3, len + 0.3, 1.5), M(a, my - 0.15, b, rot + Math.PI / 2, 1, 1, 1, 0, Math.atan2(p1.y - p0.y, len)), { tint: 0xb89068, ao: false, chunkAt: [cx, cz] });
    if (i % 3 === 0) { const ox2 = Math.cos(p0.a) * (S.width / 2 + 0.1), oz2 = Math.sin(p0.a) * (S.width / 2 + 0.1); const [c, d] = W(p0.x + ox2, p0.z + oz2); kit.add('timber', cyl(0.1, 0.12, 1.4, 6, 1), M(c, p0.y + 0.5, d), { ao: false, chunkAt: [cx, cz] }); }
  }
  // lightning rods and the Crown Bell at the top
  const [ta, tb] = W(0, -6);
  kit.add('stone', cyl(4.4, 4.8, 1, 16, 1), M(ta, S.h1 - 0.2, tb), { tint: 0x3a3640 });
  kit.add('stone', new THREE.TorusGeometry(4.4, 0.18, 5, 32).rotateX(Math.PI / 2), M(ta, S.h1 + 0.35, tb), { tint: 0x8a8494, ao: false });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; kit.add('metal', cyl(0.12, 0.16, 8, 6, 1), M(ta + Math.cos(a) * 3.6, S.h1 + 4.3, tb + Math.sin(a) * 3.6), { tint: 0x7a7a88, ao: false }); kit.add('metal', tube([V(ta + Math.cos(a) * 3.6, S.h1 + 8.2, tb + Math.sin(a) * 3.6), V(ta + Math.cos(a) * 1.2, S.h1 + 9.4, tb + Math.sin(a) * 1.2)], [0.08, 0.08], 5, false), null, { tint: 0x7a7a88, ao: false, chunkAt: [ta, tb] }); }
  const crown = new THREE.TorusGeometry(2.4, 0.18, 6, 24); crown.rotateX(Math.PI / 2);
  kit.add('gold', crown, M(ta, S.h1 + 9.4, tb), { tint: 0xe8c060, ao: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; kit.add('gold', cone(0.3, 1.2, 5), M(ta + Math.cos(a) * 2.4, S.h1 + 10, tb + Math.sin(a) * 2.4), { tint: 0xffd060, ao: false }); }
  bell(kit, ta, S.h1 + 9.2, tb, 1.5, 0x8a9aa0);
  kit.glow(sphere(0.4, 8, 6), M(ta, S.h1 + 12.4, tb), 0x9ad8ff, 3.5);
  kit.light(ta, S.h1 + 10, tb, 0x9ad8ff, 12, 30, 0.2);
  kit.block(circle(ta, tb, 1.4), 0.3);
  spots.bell = [ta, S.h1 + 0.3, tb]; spots.base = W(spirePath(0).x, spirePath(0).z);
  // shattered rocks around the base, lightning-scorched
  for (let i = 0; i < 18; i++) { const a = rng.range(0, TAU), r = rng.range(S.r0 + 1, 32), x = Math.cos(a) * r, z = -6 + Math.sin(a) * r, y = H(x, z); if (y < 0.3 || z > 20) continue; const [c, d] = W(x, z); boulder(kit, c, y - 0.3, d, { s: rng.range(0.8, 2.2), seed: 60 + i, tint: 0x4a464e, flat: 0.7, block: lod === 'full' }); }
  spots.pier = BUILD.pier(kit, W, H, 2, 52, 60, 4, 0.8);
};

// ---------------------------------------------------------------- Hushwater Lagoon
BUILD.hushwater = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng, night }) => {
  // mermaid rock in the lagoon, the jetty from the south beach, pearl-bed markers, a waterfall cleft
  const [a, b] = W(0, -8), y = H(0, -8);
  boulder(kit, a, y - 0.4, b, { s: 2.6, seed: 5, tint: 0x6a7a80, moss: 0x3a7a5a, flat: 0.55, block: lod === 'full' });
  crystal(kit, a + 1.5, y + 0.6, b - 1.2, { s: 0.9, color: 0x60f0e0, intensity: 2.2, n: 4, seed: 3, light: true, block: false });
  spots.mermaid = [a, y + 1.4, b];
  for (let i = 0; i < 8; i++) { const [c, d] = W(0, 14 - i * 2.6); kit.add('planks', box(2.6, 0.22, 2.8, 1.5), M(c, 0.45, d), { tint: 0xb0906a, ao: false }); if (i % 2 === 0) for (const s of [-1, 1]) kit.add('timber', cyl(0.12, 0.12, 2.2, 6, 1), M(c + s * 1.3, -0.4, d), { ao: false }); }
  spots.jetty = W(0, -3.5); spots.jettyDeck = [W(0, 5)[0], 0.56, W(0, 5)[1], 20.8, 2.6];
  const beds = [[-11, 7], [-5, 11.5], [7, 10], [12, 5], [-14, 2]];
  beds.forEach(([x, z], i) => { const [c, d] = W(x, z); for (let k = 0; k < 5; k++) kit.add('stone', sphere(rng.range(0.25, 0.45), 8, 6), M(c + rng.range(-0.8, 0.8), H(x, z) + 0.05, d + rng.range(-0.8, 0.8), 0, 1, 0.5, 1), { tint: 0xe8e0e8, ao: false }); spots['bed' + i] = [c, H(x, z), d]; });
  // cliff waterfall on the north rim
  { const [c, d] = W(-4, -30); kit.glow(box(3, 9, 0.4, 1), M(c, 3.8, d), 0xbfefff, 0.9); spots.falls = [c, 0, d]; }
  spots.pier = BUILD.pier(kit, W, H, -4, 58, 60, 4.2, 0.7);
  palmRing(palms, H, ox, oz, [[-8, 26], [8, 26], [-20, 20], [20, 20], [-30, 10], [30, 10]], rng, 0.95);
  if (flora) for (let i = 0; i < (lod === 'full' ? 30 : 16); i++) { const ang = rng.range(0, TAU), r = rng.range(30, 40), x = Math.cos(ang) * r, z = -4 + Math.sin(ang) * r, h = H(x, z); if (h < 2.5 || z > 18) continue; flora.tree(rng.chance(0.4) ? 'bush' : 'broadleaf', ox + x, h - 0.1, oz + z, { s: rng.range(0.7, 1.0), variant: i % 3, block: lod === 'full' }); }
};

// ---------------------------------------------------------------- Shellback Isle: Grandmother Shellback
/** Grandmother Shellback's head, neck and flippers (sculpted blobs, vertex-painted); head centre (hx, hz) faces north */
export function turtleParts(kit, hx, hz, { y = 1.2, s = 1 } = {}) {
  const skin = lc(0x6f8f5c), skinD = lc(0x445c3c), skinL = lc(0x9ab27a), beak = lc(0x3a3a2e);
  const paint = (base) => (p, n) => { const k = 0.72 + 0.28 * Math.max(0, n.y) + (Math.sin(p.x * 3.1) * Math.sin(p.z * 2.7)) * 0.05; return [base[0] * k, base[1] * k, base[2] * k]; };
  const at = (x, yy, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => M(hx + x * s, y + yy * s, hz + z * s, ry, sx * s, sy * s, sz * s, rx, rz);
  // neck (three soft folds) sliding under the shell
  for (let i = 0; i < 3; i++) kit.add('paint', blob(1, 1, null, [5.2 - i * 0.3, 3.2 - i * 0.2, 3.4]), at(0, -0.4 - i * 0.2, 7 + i * 3.2), { tint: paint(i % 2 ? skin : skinD), chunkAt: [hx, hz] });
  // skull: long, low, a little wider at the cheeks
  kit.add('paint', blob(1, 2, d => 1 + Math.max(0, -d.z) * 0.1 - Math.max(0, d.y) * 0.12 + Math.abs(d.x) * 0.06, [5.6, 4.0, 8.2]), at(0, 0.6, 0), { tint: paint(skin), chunkAt: [hx, hz] });
  // pale throat & jaw
  kit.add('paint', blob(1, 1, null, [4.8, 1.8, 6.4]), at(0, -1.6, -1.2), { tint: paint(skinL), chunkAt: [hx, hz] });
  // beak: a dark hooked ridge at the front
  kit.add('paint', blob(1, 1, d => 1 + Math.max(0, -d.y) * 0.3, [2.4, 2.1, 2.2]), at(0, -0.2, -7.4, 0, 1, 1, 1, 0.25), { tint: paint(beak), chunkAt: [hx, hz] });
  kit.add('paint', box(5.6, 0.35, 0.5, 1), at(0, -1.25, -5.6, 0, 1, 1, 1, 0.1), { tint: beak, ao: false, chunkAt: [hx, hz] });     // the mouth line
  for (const sx of [-1, 1]) {
    kit.add('paint', sphere(0.28, 8, 6), at(sx * 0.9, 0.6, -8.6), { tint: 0x1a1a14, ao: false, chunkAt: [hx, hz] });                                              // nostrils
    kit.add('paint', blob(1, 1, null, [1.7, 1.1, 1.3]), at(sx * 3.9, 2.4, -2.8, sx * 0.4), { tint: paint(skinD), chunkAt: [hx, hz] });                          // brow
    kit.add('paint', blob(1, 1, null, [1.5, 0.28, 1.0]), at(sx * 4.3, 2.0, -3.2, sx * 0.4, 1, 1, 1, 0, sx * 0.3), { tint: 0x2a3424, ao: false, chunkAt: [hx, hz] }); // closed lid
    for (let k = 0; k < 3; k++) kit.add('paint', box(1.6, 0.12, 0.2, 1), at(sx * (4.4 + k * 0.1), 1.6 - k * 0.3, -2.2 - k * 0.25, sx * 0.5), { tint: 0x3a4a30, ao: false, chunkAt: [hx, hz] }); // wrinkles
  }
  // scale plates on the crown of the head
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; kit.add('paint', blob(1, 0, null, [1.2, 0.3, 1.1]), at(Math.cos(a) * 1.9, 4.3 - Math.abs(Math.sin(a)) * 0.4, -1 + Math.sin(a) * 2.2), { tint: paint(skinD), ao: false, chunkAt: [hx, hz] }); }
}
function flipper(kit, x, y, z, ry, len, s = 1) {
  const skin = lc(0x6f8f5c), dark = lc(0x445c3c);
  const g = blob(1, 2, d => 1 - Math.max(0, d.z) * 0.35, [len * 0.32, 0.5, len * 0.5]);
  kit.add('paint', g, M(x, y, z, ry, s, s, s, 0, 0.12), { tint: (p, n) => { const k = 0.75 + 0.25 * Math.max(0, n.y); const c = Math.sin(p.x * 2.4 + p.z * 1.7) > 0.6 ? dark : skin; return [c[0] * k, c[1] * k, c[2] * k]; }, chunkAt: [x, z] });
}
BUILD.shellback = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  // the head rests on the north beach, eyes closed; flippers splay out into the shallows
  const [hx, hz] = W(0, -50);
  turtleParts(kit, hx, hz, { y: 1.4, s: 1 });
  flipper(kit, ...W(-40, -26), 0.3, -Math.PI * 0.3, 16); flipper(kit, ...W(40, -26), 0.3, Math.PI * 0.3, 16);
  flipper(kit, ...W(-32, 38), 0.2, -Math.PI * 0.75, 11); flipper(kit, ...W(32, 38), 0.2, Math.PI * 0.75, 11);
  { const [tx, tz] = W(0, 50); kit.add('paint', blob(1, 1, null, [2.2, 1.2, 5]), M(tx, 0.3, tz, 0.1), { tint: 0x6f8f5c, chunkAt: [tx, tz] }); }
  spots.head = [hx, 2, hz]; spots.mouth = [hx, 0.8, hz - 8];
  // the Pip market on the ridge: little stalls, lanterns, bunting
  const cols = [0xe05a5a, 0x5ab0e0, 0xf0c040, 0x7ad070, 0xc07ae0];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3, x = Math.cos(a) * 8, z = -2 + Math.sin(a) * 8, [c, d] = W(x, z); P.stall(kit, c, H(x, z), d, Math.atan2(x, z + 2) + Math.PI, { color: cols[i], goods: ['fruit', 'cloth', 'fish', 'pots', 'potions'][i], seed: 90 + i, w: 2.4 }); spots['stall' + i] = [c, H(x, z), d]; }
  { const [c, d] = W(0, -2); P.lanternString(kit, [c - 7, H(-7, -2) + 3.5, d], [c + 7, H(7, -2) + 3.5, d], { sag: 0.8 }); spots.market = [c, H(0, -2), d]; }
  spots.pier = BUILD.pier(kit, W, H, 8, 62, 60, 4.2, 0.6);
  // moss trees and blossoms growing on the shell
  if (flora) for (let i = 0; i < (lod === 'full' ? 34 : 18); i++) { const a = rng.range(0, TAU), r = rng.range(14, 36), x = Math.cos(a) * r, z = Math.sin(a) * r, y = H(x, z); if (y < 3 || z < -40) continue; flora.tree(rng.chance(0.35) ? 'blossom' : rng.chance(0.5) ? 'bush' : 'broadleaf', ox + x, y - 0.1, oz + z, { s: rng.range(0.55, 0.85), variant: i % 3, block: lod === 'full' }); }
};

// ---------------------------------------------------------------- Drownbell Shoal: the drowned chapel
BUILD.drownbell = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  // broken chapel walls & arches around the arena, the leaning bell tower rising from the pool (north)
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + 0.2, r = 23 + rng.range(-1.5, 1.5), x = Math.cos(a) * r, z = -6 + Math.sin(a) * r;
    if (z > 10) continue;
    const [c, d] = W(x, z), y = H(x, z);
    if (i % 3 === 0) { ruinColumn(kit, c, y - 0.2, d, rng.range(3, 6), rng, 0xa8b0a0); continue; }
    const F = new Frame(c, y - 0.3, d, a + Math.PI / 2);
    kit.add('stone', box(5, rng.range(2.2, 4.5), 0.9, 2), F.at(0, 1.5, 0), { tint: 0x9aa494, yGround: y - 0.3 });
    kit.add('stone', box(1.2, 0.5, 1.2, 1), F.at(rng.range(-2, 2), 0.25, 1.6), { tint: 0x8a9484 });
  }
  { const [c, d] = W(0, -36), y = -0.6;
    const F = new Frame(c, y, d, 0.2);
    const T = F.m.clone().multiply(M(0, 0, 0, 0, 1, 1, 1, 0.12, 0.08));
    const at = (...a) => T.clone().multiply(M(...a));
    kit.add('stone', walls(5, 16, 5, 2), at(0, 8, 0), { tint: 0xa8b0a2, yGround: y, aoH: 6 });
    for (let i = 0; i < 4; i++) kit.add('stone', walls(5.4, 0.4, 5.4, 1), at(0, 3 + i * 4, 0), { tint: 0x8a9484, ao: false });
    kit.add('stone', walls(5.6, 3.4, 5.6, 2), at(0, 17.6, 0), { tint: 0xb8c0b0 });
    kit.add('slate', cone(4.4, 5, 4), at(0, 21.8, 0, Math.PI / 4), { tint: 0x3a5a54, ao: false });
    kit.add('gold', new THREE.LatheGeometry([[0.02, 0], [1.1, 0.04], [1.3, 0.25], [1.2, 0.6], [0.95, 1.4], [0.75, 2.1], [0.6, 2.4], [0.1, 2.5]].map(([r, h]) => new THREE.Vector2(r, h)), 16), at(0, 15.6, 0), { tint: 0x5a8a6a, ao: false });
    spots.tower = [c, 0, d]; spots.bell = [c, 17, d]; }
  // the arena (flat sand) centre and the pool where the Bellwarden surfaces
  spots.arena = W(0, -6); spots.pool = W(0, -30);
  for (let i = 0; i < 10; i++) { const x = rng.range(-30, 30), z = rng.range(-20, 26), y = H(x, z); if (y < -0.2 || Math.hypot(x, z + 6) < 15) continue; const [c, d] = W(x, z); boulder(kit, c, y - 0.2, d, { s: rng.range(0.4, 1.1), seed: 30 + i, tint: 0x8a9080, moss: 0x5a7a4a, flat: 0.6, block: lod === 'full' }); }
  spots.pier = BUILD.pier(kit, W, H, 0, 56, 60, 4, 0.6);
  palmRing(palms, H, ox, oz, [[-30, 20], [30, 18], [-8, 34], [10, 36]], rng, 0.8);
};

// ---------------------------------------------------------------- Brightwater Isle (the stronghold, silhouette)
BUILD.brightwater = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const [a, b] = W(-6, -8), y = H(-6, -8);
  Bd.townhouse(kit, a, y, b, 0, { w: 14, d: 10, floors: 3, roof: Bd.ROOF.blue, seed: 12, balcony: true, shop: false });
  // windmill
  { const [c, d] = W(18, -14), yy = H(18, -14); kit.add('stone', cyl(2.2, 3, 10, 12, 2), M(c, yy + 5, d), { tint: 0xe8e0d0 }); kit.add('roof', cone(3, 3.5, 12), M(c, yy + 11.7, d), { tint: Bd.ROOF.red, ao: false });
    for (let i = 0; i < 4; i++) kit.add('cloth', box(1.4, 8, 0.1, 1), M(c, yy + 9, d + 3.2, 0, 1, 1, 1, 0, i * Math.PI / 2 + 0.3), { tint: 0xf2eadc, ao: false }); }
  if (flags) P.flagPole(kit, flags, ...[W(4, 10)[0], H(4, 10), W(4, 10)[1]], { h: 10, color: 0x2a5aa8 });
  spots.pier = BUILD.pier(kit, W, H, 4, 34, 60, 4, 0.7);
  if (flora) for (let i = 0; i < 20; i++) { const x = rng.range(-38, 38), z = rng.range(-30, 26), yy = H(x, z); if (yy < 1.6 || Math.hypot(x + 6, z + 8) < 10) continue; flora.tree(rng.chance(0.3) ? 'blossom' : 'broadleaf', ox + x, yy - 0.1, oz + z, { s: rng.range(0.8, 1.1), variant: i % 3, block: false }); }
};

// ---------------------------------------------------------------- Pipsprout Hollow (silhouette: giant mushrooms)
export function mushroom(kit, x, y, z, s = 1, cap = 0xd8483a, seed = 1) {
  const r = new RNG(seed);
  const stem = new THREE.LatheGeometry([[0.9, 0], [0.75, 1], [0.62, 3], [0.7, 5.5], [0.95, 6.2]].map(([rr, h]) => new THREE.Vector2(rr * s, h * s)), 12);
  kit.add('paint', stem, M(x, y, z, 0, 1, 1, 1, r.range(-0.08, 0.08), r.range(-0.08, 0.08)), { tint: 0xf2e8d0, yGround: y });
  const capG = new THREE.SphereGeometry(3.4 * s, 18, 8, 0, TAU, 0, Math.PI / 2); capG.scale(1, 0.62, 1);
  kit.add('paint', capG, M(x, y + 6 * s, z), { tint: cap, ao: false });
  kit.add('paint', new THREE.CircleGeometry(3.3 * s, 18).rotateX(Math.PI / 2), M(x, y + 6 * s, z), { tint: 0xe8d8b8, ao: false });
  for (let i = 0; i < 7; i++) { const a = r.range(0, TAU), rr = r.range(0.6, 2.6) * s; const yy = y + 6 * s + Math.sqrt(Math.max(0, 1 - (rr / (3.4 * s)) ** 2)) * 2.1 * s; kit.add('paint', sphere(r.range(0.3, 0.55) * s, 8, 6), M(x + Math.cos(a) * rr, yy - 0.1 * s, z + Math.sin(a) * rr, 0, 1, 0.4, 1), { tint: 0xfff6e8, ao: false }); }
}
BUILD.pipsprout = ({ kit, flags, palms, flora, ox, oz, H, W, lod, spots, rng }) => {
  const caps = [0xd8483a, 0xe8883a, 0xc86ad0, 0x5a9ae0, 0xf0c040];
  for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * 44, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8, y = H(x, z); if (y < 1.2) continue; const [c, d] = W(x, z); mushroom(kit, c, y - 0.2, d, rng.range(0.8, 1.9), rng.pick(caps), 70 + i); }
  for (let i = 0; i < 24; i++) { const x = rng.range(-46, 46), z = rng.range(-36, 30), y = H(x, z); if (y < 1.2) continue; const [c, d] = W(x, z); kit.add('paint', cyl(0.12, 0.16, 4, 6, 1), M(c, y + 2, d), { tint: 0x3e7a28 }); kit.add('paint', blob(1.2, 1, null, [1, 0.35, 1]), M(c, y + 4.1, d), { tint: rng.pick([0xff8ab0, 0xf4d040, 0xffffff, 0xa070e0]), ao: false }); }
  spots.pier = BUILD.pier(kit, W, H, 4, 42, 60, 4, 0.7);
  if (flora) for (let i = 0; i < 16; i++) { const x = rng.range(-46, 46), z = rng.range(-36, 30), y = H(x, z); if (y < 1.4) continue; flora.tree('bush', ox + x, y - 0.1, oz + z, { s: rng.range(0.8, 1.4), variant: i % 3, block: false }); }
};
export { BUILD as LANDMARK_BUILDERS };
