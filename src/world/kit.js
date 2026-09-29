// Architecture kit: baked-texture materials, metre-UV primitives, and a chunked merging builder.
// Everything static in a zone goes through Kit.add(material, geometry, matrix, opts) and is merged into one mesh per
// (material × 40 m chunk × shadow flag) — a whole city is ~60–120 draw calls with frustum culling per chunk.
// Materials dither away fragments that stand between the camera and the player (never lose sight of your hero).
import * as THREE from 'three';
import { RNG, clamp } from '../core/noise.js';
import { MeshBuilder, linColor } from '../engine/geom.js';
import { lambert, G } from '../engine/materials.js';
import { kitTex } from './textures.js';

// ---------------------------------------------------------------- shader patches
export const BAYER = `const float BAYER16[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer4() { ivec2 q = ivec2(gl_FragCoord.xy) & 3; return (BAYER16[q.y * 4 + q.x] + 0.5) / 16.0; }`;
/**
 * Screen-space cutaway: fragments that are in front of the hero AND inside a small ellipse around the hero's
 * on-screen position dissolve into a dither lattice, so you never lose sight of your character behind a roof, a
 * tree or a wall — without punching holes into anything that doesn't actually cover the hero.
 * cutV patches a vertex shader, cutF a fragment shader (both needed; uniform uPlayerPos = G.uPlayerPos).
 */
export const cutV = vs => vs.replace('#include <common>', '#include <common>\nuniform vec3 uPlayerPos;\nvarying vec4 vCutClip; varying vec4 vCutP; varying float vCutAsp;')
  .replace('#include <project_vertex>', `#include <project_vertex>
vCutClip = gl_Position;
vCutP = projectionMatrix * viewMatrix * vec4(uPlayerPos + vec3(0.0, 0.95, 0.0), 1.0);
vCutAsp = projectionMatrix[1][1] / projectionMatrix[0][0];`);
export function cutF(fs, strength = 0.86, r0 = 0.15, r1 = 0.25) {
  return fs.replace('#include <common>', `#include <common>\nvarying vec4 vCutClip; varying vec4 vCutP; varying float vCutAsp;\n${BAYER}`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{
  vec2 cd = (vCutClip.xy / vCutClip.w - vCutP.xy / vCutP.w) * vec2(vCutAsp, 0.78);
  float cm = step(vCutClip.w, vCutP.w - 1.4) * smoothstep(${r1.toFixed(3)}, ${r0.toFixed(3)}, length(cd));
  if (cm > 0.01 && bayer4() < ${strength.toFixed(2)} * cm) discard;
}`);
}
/** back-compat: fragment-only name used by older call sites (now screen-space; needs cutV on the vertex side) */
export const cutaway = (fs) => cutF(fs);
const TRI_V = vs => vs.replace('#include <common>', '#include <common>\nvarying vec3 vNrmW;')
  .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{ vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
    wn = mat3(instanceMatrix) * wn;
  #endif
  vNrmW = normalize(mat3(modelMatrix) * wn); }`);
const TRI_F = (scale, bump) => fs => fs.replace('#include <common>', '#include <common>\nvarying vec3 vNrmW;\nvec3 gTriW;')
  .replace('#include <map_fragment>', `
gTriW = pow(abs(normalize(vNrmW)), vec3(4.0)); gTriW /= gTriW.x + gTriW.y + gTriW.z;
{ vec4 tX = texture2D(map, vWPos.zy * ${scale.toFixed(4)}), tY = texture2D(map, vWPos.xz * ${scale.toFixed(4)}), tZ = texture2D(map, vWPos.xy * ${scale.toFixed(4)});
  diffuseColor *= tX * gTriW.x + tY * gTriW.y + tZ * gTriW.z; }`)
  .replace('#include <normal_fragment_maps>', `
{ vec2 nX = texture2D(normalMap, vWPos.zy * ${scale.toFixed(4)}).xy * 2.0 - 1.0;
  vec2 nY = texture2D(normalMap, vWPos.xz * ${scale.toFixed(4)}).xy * 2.0 - 1.0;
  vec2 nZ = texture2D(normalMap, vWPos.xy * ${scale.toFixed(4)}).xy * 2.0 - 1.0;
  vec3 wn = normalize(vNrmW);
  vec3 pert = vec3(0.0, nX.y, nX.x) * gTriW.x + vec3(nY.x, 0.0, nY.y) * gTriW.y + vec3(nZ.x, nZ.y, 0.0) * gTriW.z;
  vec3 nw = normalize(wn + pert * ${bump.toFixed(2)});
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`);

// ---------------------------------------------------------------- materials (shared, cached)
const MATS = {};
const P = (name) => kitTex(name);
const DEFS = {
  stone: () => ({ tex: 'ashlar', opts: { wrap: 0.35, rim: 0.08 } }),
  plaster: () => ({ tex: 'plaster', opts: { wrap: 0.4 } }),
  roof: () => ({ tex: 'tiles', opts: { wrap: 0.35, spec: 0.25, shine: 20 } }),
  slate: () => ({ tex: 'slate', opts: { wrap: 0.3, spec: 0.3, shine: 30 } }),
  planks: () => ({ tex: 'planks', opts: { wrap: 0.35 } }),
  timber: () => ({ tex: 'timber', opts: { wrap: 0.3 } }),
  metal: () => ({ tex: 'metal', opts: { wrap: 0.25, spec: 0.9, shine: 40 } }),
  gold: () => ({ tex: 'gold', opts: { wrap: 0.3, spec: 1.3, shine: 28, rim: 0.3, rimColor: 0xffe0a0 } }),
  cloth: () => ({ tex: 'cloth', params: { side: THREE.DoubleSide }, opts: { wrap: 0.55, trans: 0.35 } }),
  rock: () => ({ tex: 'rockface', opts: { wrap: 0.3 }, tri: [1 / 7, 0.9] }),
  marble: () => ({ tex: 'marbleWall', opts: { wrap: 0.4, spec: 0.35, shine: 50 } }),
  dark: () => ({ tex: 'darkstone', params: { emissive: 0xff5a20, emissiveIntensity: 2.2 }, opts: { wrap: 0.3, spec: 0.3, shine: 30 } }),
  darkrock: () => ({ tex: 'rockface', opts: { wrap: 0.25 }, tri: [1 / 7, 0.9] }),
  icecliff: () => ({ tex: 'glacier', opts: { wrap: 0.45, spec: 0.7, shine: 36, rim: 0.35, rimColor: 0xd8f4ff }, tri: [1 / 9, 0.6] }),
  lacquer: () => ({ tex: 'lacquer', opts: { wrap: 0.4, spec: 0.18, shine: 70, rim: 0.1, rimColor: 0xffd0a0 } }),
  obsidian: () => ({ tex: null, opts: { wrap: 0.15, spec: 1.6, shine: 90, rim: 0.45, rimColor: 0xff6a30 } }),
  coral: () => ({ tex: null, opts: { wrap: 0.65, trans: 0.3, rim: 0.3, rimColor: 0xa8fff0 } }),
  wetstone: () => ({ tex: 'ashlar', opts: { wrap: 0.3, spec: 0.55, shine: 44, rim: 0.12, rimColor: 0x9ff0ff } }),
  wetrock: () => ({ tex: 'rockface', opts: { wrap: 0.3, spec: 0.5, shine: 40 }, tri: [1 / 7, 0.9] }),
  bone: () => ({ tex: 'bone', opts: { wrap: 0.45, spec: 0.3, shine: 20 } }),
  window: () => ({ tex: 'window', params: { emissive: 0xffb050, emissiveIntensity: 0 }, opts: { wrap: 0.3, spec: 0.9, shine: 70 }, noShadow: true }),
  thatch: () => ({ tex: 'thatch', opts: { wrap: 0.45 } }),
  paint: () => ({ tex: null, opts: { wrap: 0.4 } }),
  ice: () => ({ tex: null, params: { transparent: false }, opts: { wrap: 0.5, spec: 1.1, shine: 60, rim: 0.5, rimColor: 0xc8f0ff } }),
};
export function kitMaterial(name) {
  if (MATS[name]) return MATS[name];
  if (name === 'glow') {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    m.userData.shared = true; return (MATS.glow = m);
  }
  const d = DEFS[name]();
  const params = { vertexColors: true, ...(d.params || {}) };
  if (d.tex) { const t = P(d.tex); params.map = t.map; params.normalMap = t.normalMap; if (t.emissiveMap && params.emissive !== undefined) params.emissiveMap = t.emissiveMap; }
  const opts = { key: 'kit-' + name, uniforms: { uPlayerPos: G.uPlayerPos }, ...d.opts };
  opts.fragment = d.tri ? (fs => cutF(TRI_F(d.tri[0], d.tri[1])(fs))) : (fs => cutF(fs));
  opts.vertex = d.tri ? (vs => cutV(TRI_V(vs))) : cutV;
  const m = lambert(params, opts);
  if (d.tex && !d.tri) m.normalScale = new THREE.Vector2(1, 1);
  m.userData.shared = true; m.userData.noShadow = !!d.noShadow;
  MATS[name] = m;
  return m;
}

// ---------------------------------------------------------------- primitives (UVs in metres / tile)
export function box(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  return g;
}
/** box without top & bottom faces (hollow wall volume: no hidden interior faces to reveal) */
export function walls(w, h, d, tile = 2) {
  const g = box(w, h, d, tile);
  const ix = g.index.array, keep = [];
  for (let f = 0; f < 6; f++) if (f !== 2 && f !== 3) for (let k = 0; k < 6; k++) keep.push(ix[f * 6 + k]);
  g.setIndex(keep);
  return g;
}
export function cyl(rt, rb, h, seg = 12, tile = 2, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv, circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * h / tile);
  return g;
}
export function cone(r, h, seg = 12, tile = 2) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, true);
  const uv = g.attributes.uv, circ = Math.PI * 2 * r, sl = Math.hypot(r, h);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * sl / tile);
  return g;
}
export function sphere(r, ws = 12, hs = 8, phiLen = Math.PI * 2, thetaLen = Math.PI) { return new THREE.SphereGeometry(r, ws, hs, 0, phiLen, 0, thetaLen); }
/** Gable roof: ridge along X; w length, d depth, rise h, overhang, slab thickness. Tiles run down the slope. */
export function gableRoof(w, d, h, over = 0.5, thick = 0.2, tile = 2) {
  const W = w / 2 + over, D = d / 2 + over, y0 = -over * h / (d / 2);
  const pos = [], uv = [], idx = [];
  const slope = Math.hypot(D, h - y0);
  const quad = (a, b, c, e, uvs) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...e); uv.push(...uvs); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const U = 2 * W / tile, V = slope / tile;
  quad([-W, h, 0], [-W, y0, D], [W, y0, D], [W, h, 0], [0, V, 0, 0, U, 0, U, V]);
  quad([W, h, 0], [W, y0, -D], [-W, y0, -D], [-W, h, 0], [0, V, 0, 0, U, 0, U, V]);
  quad([-W, h - thick, 0], [W, h - thick, 0], [W, y0 - thick, D], [-W, y0 - thick, D], [0, 0, 1, 0, 1, 1, 0, 1]);
  quad([W, h - thick, 0], [-W, h - thick, 0], [-W, y0 - thick, -D], [W, y0 - thick, -D], [0, 0, 1, 0, 1, 1, 0, 1]);
  quad([-W, y0, D], [-W, y0 - thick, D], [W, y0 - thick, D], [W, y0, D], [0, 0, 0, 0.1, 1, 0.1, 1, 0]);
  quad([W, y0, -D], [W, y0 - thick, -D], [-W, y0 - thick, -D], [-W, y0, -D], [0, 0, 0, 0.1, 1, 0.1, 1, 0]);
  // verge (gable-end thickness)
  for (const s of [-1, 1]) {
    quad([s * W, h, 0], [s * W, h - thick, 0], [s * W, y0 - thick, s > 0 ? D : -D], [s * W, y0, s > 0 ? D : -D], [0, 0, 0, 0.1, 1, 0.1, 1, 0]);
    quad([s * W, h, 0], [s * W, y0, s > 0 ? -D : D], [s * W, y0 - thick, s > 0 ? -D : D], [s * W, h - thick, 0], [0, 0, 0, 0.1, 1, 0.1, 1, 0]);
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roof.setIndex(idx); roof.computeVertexNormals();
  const gp = [], gu = [], gi = [];
  for (const s of [-1, 1]) {
    const x = s * w / 2, i = gp.length / 3;
    gp.push(x, 0, -d / 2, x, 0, d / 2, x, h, 0);
    gu.push(-d / 2 / tile, 0, d / 2 / tile, 0, 0, h / tile);
    if (s > 0) gi.push(i, i + 2, i + 1); else gi.push(i, i + 1, i + 2);
  }
  const gables = new THREE.BufferGeometry();
  gables.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gables.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2));
  gables.setIndex(gi); gables.computeVertexNormals();
  return { roof, gables };
}
/** Hip roof (four slopes) over w×d with rise h. */
export function hipRoof(w, d, h, over = 0.5, tile = 2) {
  const W = w / 2 + over, D = d / 2 + over, y0 = -over * h / (Math.min(w, d) / 2);
  const r = Math.max(0, (w - d) / 2);        // ridge half-length along x (0 → pyramid when square)
  const pos = [], uv = [], idx = [];
  const tri = (a, b, c, uvs) => { const i = pos.length / 3; pos.push(...a, ...b, ...c); uv.push(...uvs); idx.push(i, i + 1, i + 2); };
  const quad = (a, b, c, e, uvs) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...e); uv.push(...uvs); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const sl = Math.hypot(D, h - y0) / tile;
  quad([-r, h, 0], [-W, y0, D], [W, y0, D], [r, h, 0], [(W - r) / tile, sl, 0, 0, 2 * W / tile, 0, (W + r) / tile, sl]);
  quad([r, h, 0], [W, y0, -D], [-W, y0, -D], [-r, h, 0], [(W - r) / tile, sl, 0, 0, 2 * W / tile, 0, (W + r) / tile, sl]);
  const sl2 = Math.hypot(W - r, h - y0) / tile;
  tri([W, y0, D], [W, y0, -D], [r, h, 0], [0, 0, 2 * D / tile, 0, D / tile, sl2]);
  tri([-W, y0, -D], [-W, y0, D], [-r, h, 0], [0, 0, 2 * D / tile, 0, D / tile, sl2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Extruded 2D shape (x,y outline) with depth along z, UVs in metres/tile. */
export function extrude(outline, depth, tile = 2, bevel = 0) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (az >= ax && az >= ay) uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
    else if (ax >= ay) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
  }
  return g;
}
/** Arch outline (for extrude): opening w wide, h to the spring line + semicircle, inside a wall panel pw×ph. */
export function archPanel(pw, ph, w, h, seg = 10) {
  const outer = [[-pw / 2, 0], [-w / 2, 0], [-w / 2, h]];
  for (let i = 1; i < seg; i++) { const a = Math.PI - i / seg * Math.PI; outer.push([Math.cos(a) * w / 2, h + Math.sin(a) * w / 2]); }
  outer.push([w / 2, h], [w / 2, 0], [pw / 2, 0], [pw / 2, ph], [-pw / 2, ph]);
  return outer;
}

// ---------------------------------------------------------------- matrices
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function M(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
/** Local frame of a structure placed at (x, y, z) rotated by rot about Y. Local +Z is the "front". */
export class Frame {
  constructor(x, y, z, rot = 0) { this.m = M(x, y, z, rot); this.x = x; this.y = y; this.z = z; this.rot = rot; this.c = Math.cos(rot); this.s = Math.sin(rot); }
  at(lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { return this.m.clone().multiply(M(lx, ly, lz, ry, sx, sy, sz, rx, rz)); }
  world(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
  /** facing (contract convention: forward = (−sin f, 0, −cos f)) for a local direction */
  facing(ldx, ldz) { const wx = ldx * this.c + ldz * this.s, wz = -ldx * this.s + ldz * this.c; return Math.atan2(-wx, -wz); }
}
/** facing that looks from (x,z) toward (tx,tz) */
export const faceTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

// ---------------------------------------------------------------- merging builder
const CHUNK = 40;
export class Kit {
  constructor(opts = {}) {
    this.chunk = opts.chunk ?? CHUNK;
    this.b = new Map();              // key → { mat, cast, builder, cx, cz }
    this.colliders = [];             // shapes for the nav grid: { shape, inflate }
    this.rng = new RNG(opts.seed ?? 5150);
    this.lights = [];                // { x, y, z, color, intensity, radius, flicker }
    this.flames = [];                // { x, y, z, size, color } for fx.js
    this.spots = {};                 // named points collected while building
  }
  /**
   * Merge geometry. opts: tint (hex | [r,g,b] linear | fn(p,n)), ao (darken toward yGround over aoH),
   * yGround, aoH, jitter (random brightness), cast (shadow; default: material decides), chunkAt [x,z]
   */
  add(mat, g, m, { tint = 0xffffff, ao = true, yGround = null, aoH = 2.5, jitter = 0.06, cast = null, chunkAt = null } = {}) {
    if (m && !(Math.abs(m.determinant()) > 1e-12)) { console.warn('[kit] skipped degenerate transform for', mat); return; } // singular → NaN normals → black bloom
    const material = kitMaterial(mat);
    const castS = cast ?? (!material.userData.noShadow && mat !== 'glow');
    const tx = chunkAt ? chunkAt[0] : m ? m.elements[12] : 0, tz = chunkAt ? chunkAt[1] : m ? m.elements[14] : 0;
    const cx = Math.floor(tx / this.chunk), cz = Math.floor(tz / this.chunk);
    const key = `${mat}|${castS ? 1 : 0}|${cx},${cz}`;
    let e = this.b.get(key);
    if (!e) { e = { mat, material, cast: castS, builder: new MeshBuilder(), cx, cz }; this.b.set(key, e); }
    const j = 1 + (this.rng.next() - 0.5) * jitter;
    const yg = yGround ?? (m ? m.elements[13] : 0);
    if (typeof tint === 'function') { e.builder.add(g, m, (p, n, i) => tint(p, n, i)); return; }
    const base = Array.isArray(tint) ? tint : linColor(tint);
    e.builder.add(g, m, ao ? (p) => { const f = clamp(0.5 + (p.y - yg) / aoH * 0.5, 0.5, 1) * j; return [base[0] * f, base[1] * f, base[2] * f]; } : [base[0] * j, base[1] * j, base[2] * j]);
  }
  /** glowing (HDR) geometry: colour hex × intensity */
  glow(g, m, hex, intensity = 3) { const c = linColor(hex); this.add('glow', g, m, { tint: [c[0] * intensity, c[1] * intensity, c[2] * intensity], ao: false, jitter: 0, cast: false }); }
  block(shape, inflate = 0.35) { this.colliders.push({ shape, inflate }); }
  light(x, y, z, color = 0xffa850, intensity = 6, radius = 9, flicker = 0.25) { this.lights.push({ x, y, z, color, intensity, radius, flicker }); }
  flame(x, y, z, size = 0.35, color = 0xffa040) { this.flames.push({ x, y, z, size, color }); }
  build(parent) {
    let n = 0;
    for (const e of this.b.values()) {
      if (!e.builder.count) continue;
      const mesh = new THREE.Mesh(e.builder.build(), e.material);
      mesh.castShadow = e.cast; mesh.receiveShadow = e.mat !== 'glow';
      mesh.name = 'kit-' + e.mat; mesh.matrixAutoUpdate = false;
      parent.add(mesh); n++;
    }
    this.b.clear();
    return n;
  }
}
