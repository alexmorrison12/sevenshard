// Foliage: GPU grass tufts that follow the player and grow wherever the ground's grass layer is painted, instanced
// flower clusters, bushes and trees (broadleaf, blossom, cypress, pine, dead) — all swaying in the wind, all
// dissolving into a dither lattice when they stand between the camera and the hero.
//   const grass = new Grass(ground, { layer: 'grass' }); zone.root.add(grass.mesh); grass.update(focus)
//   const flora = new Flora(kit?); flora.tree('broadleaf', x, y, z, { s, rot }); flora.flower(x, y, z, colour); flora.build(zone.root)
import * as THREE from 'three';
import { RNG, Simplex, clamp } from '../core/noise.js';
import { MeshBuilder, tube, blob, linColor } from '../engine/geom.js';
import { lambert, G } from '../engine/materials.js';
import { groundLayers, foliageAtlas, kitTex, LAYER_TILE } from './textures.js';
import { BAYER, cutV, cutF } from './kit.js';
import { circle } from './shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- GPU grass
export class Grass {
  constructor(ground, { layer = 'grass', w = 46, d = 40, spacing = 0.4, density = 1, height = 1, tint = [1, 1, 1], north = 4 } = {}) {
    const GL = groundLayers();
    const L = ground.layers.indexOf(layer);
    this.north = north; this.spacing = spacing;
    const nx = Math.floor(w / spacing), nz = Math.floor(d / spacing);
    const geo = new THREE.InstancedBufferGeometry();
    const pos = [], nrm = [], ty = [], idx = [];
    const blades = 7;
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + b * 0.9;
      const r = b === 0 ? 0 : 0.05 + (b % 3) * 0.05;
      const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
      const facing = a + 1.3 + b;
      const bw = 0.035 - (b % 2) * 0.008, h = (0.22 + ((b * 37) % 7) / 7 * 0.22) * height;
      const lean = 0.1 + (b % 3) * 0.05;
      const dx = Math.cos(facing), dz = Math.sin(facing), lx = Math.cos(a), lz = Math.sin(a);
      const base = pos.length / 3;
      [0, 0.5, 1].forEach((t, i) => {
        const ww = bw * (1 - t * 0.85), cx = bx + lx * lean * t * t, cz = bz + lz * lean * t * t, cy = h * t;
        if (i < 2) { pos.push(cx - dx * ww, cy, cz - dz * ww, cx + dx * ww, cy, cz + dz * ww); nrm.push(lx * 0.3, 1, lz * 0.3, lx * 0.3, 1, lz * 0.3); ty.push(t, t); }
        else { pos.push(cx, cy, cz); nrm.push(lx * 0.3, 1, lz * 0.3); ty.push(1); }
      });
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('ty', new THREE.Float32BufferAttribute(ty, 1));
    geo.setIndex(idx);
    const off = new Float32Array(nx * nz * 2);
    let k = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { off[k++] = (i - nx / 2) * spacing; off[k++] = (j - nz / 2) * spacing; }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
    geo.instanceCount = nx * nz;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const sel = (o) => new THREE.Vector4(L === o ? 1 : 0, L === o + 1 ? 1 : 0, L === o + 2 ? 1 : 0, L === o + 3 ? 1 : 0);
    const selA = sel(0), selB = sel(4), selC = sel(8);
    this.uCenter = { value: new THREE.Vector2() };
    const mat = lambert({}, {
      wrap: 0.6, trans: 0.4, key: 'grass-gpu',
      uniforms: {
        uCenter: this.uCenter, uSpacing: { value: spacing }, uHalf: { value: new THREE.Vector2(w / 2, d / 2) }, uDensity: { value: density },
        uCtrlA: { value: ground.ctrlA }, uCtrlB: { value: ground.ctrlB }, uCtrlC: { value: ground.ctrlC }, uCtrlXf: { value: ground.ctrlInfo }, uSelA: { value: selA }, uSelB: { value: selB }, uSelC: { value: selC },
        uHeight: { value: ground.heightTex }, uHXf: { value: ground.heightInfo }, uAlb: { value: GL.albedo }, uLayer: { value: GL.index[layer] }, uTileG: { value: 1 / (LAYER_TILE[layer] || 4) },
        uTintG: { value: new THREE.Vector3(...tint) }, uPlayerPos: G.uPlayerPos,
      },
      vertex: vs => vs.replace('#include <common>', `#include <common>
precision highp sampler2DArray;
attribute vec2 aOff; attribute float ty;
uniform vec2 uCenter; uniform float uSpacing; uniform vec2 uHalf; uniform float uDensity;
uniform sampler2D uCtrlA; uniform sampler2D uCtrlB; uniform sampler2D uCtrlC; uniform vec4 uCtrlXf; uniform vec4 uSelA; uniform vec4 uSelB; uniform vec4 uSelC;
uniform sampler2D uHeight; uniform vec4 uHXf; uniform sampler2DArray uAlb; uniform float uLayer; uniform float uTileG; uniform vec3 uTintG; uniform vec3 uPlayerPos;
varying vec3 vGrassCol;
float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
        .replace('#include <begin_vertex>', `
vec2 cell = floor(uCenter / uSpacing) * uSpacing + aOff;
float r1 = gh(cell), r2 = gh(cell + 17.3), r3 = gh(cell + 41.1);
vec2 wxz = cell + (vec2(r1, r2) - 0.5) * uSpacing * 1.2;
vec2 cuv = (wxz - uCtrlXf.xy) / uCtrlXf.zw;
float m = dot(texture2D(uCtrlA, cuv), uSelA) + dot(texture2D(uCtrlB, cuv), uSelB) + dot(texture2D(uCtrlC, cuv), uSelC);
float hy = texture2D(uHeight, (wxz - uHXf.xy) / uHXf.zw).r;
vec2 dd = abs(wxz - uCenter) / uHalf;
float fade = smoothstep(1.0, 0.8, max(dd.x, dd.y));
float s = step(r3, smoothstep(0.35, 0.8, m) * uDensity) * fade * (0.65 + r1 * 0.7);
float rot = r2 * 6.2832;
mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
vec3 transformed = vec3(position);
transformed.xz = R * transformed.xz;
transformed *= s;
// wind + push away from the hero
float sway = (sin(uTime * 2.2 + wxz.x * 0.35 + wxz.y * 0.2) * 0.3 + sin(uTime * 3.7 + wxz.x * 0.9) * 0.12) * ty * ty * 0.18;
transformed.x += sway * uWind.x; transformed.z += sway * uWind.y;
vec2 away = wxz - uPlayerPos.xz; float dp = length(away);
transformed.xz += normalize(away + 1e-4) * smoothstep(0.9, 0.2, dp) * ty * 0.25;
transformed.y *= 1.0 - smoothstep(0.9, 0.2, dp) * ty * 0.4;
transformed.xz += wxz; transformed.y += hy - 0.02;
vec3 gcol = textureLod(uAlb, vec3(wxz * uTileG, uLayer), 3.0).rgb;
vGrassCol = gcol * mix(0.55, 1.25, ty) * uTintG;
`),
      fragment: fs => fs.replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb = vGrassCol;'),
    });
    mat.side = THREE.DoubleSide;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.name = 'grass';
  }
  update(focus) { if (focus) this.uCenter.value.set(focus.x, focus.z - this.north); }
}

// ---------------------------------------------------------------- materials
function windVertex(amp) {
  return vs => vs.replace('#include <common>', '#include <common>\nattribute float sway;\nvarying vec3 vTreePos;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz;
  #endif
  vTreePos = (modelMatrix * vec4(ip, 1.0)).xyz;
  float ph = ip.x * 0.13 + ip.z * 0.17;
  float w = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.7 + ph * 2.3 + position.y * 0.4) * 0.4;
  transformed.xz += uWind * w * sway * ${amp.toFixed(3)};
  transformed.y += sin(uTime * 3.1 + ph + position.x) * sway * ${(amp * 0.25).toFixed(3)}; }`);
}
// foliage covering the hero on screen dissolves (screen-space ellipse, see kit.js cutF)
const leafFade = fs => cutF(fs, 0.9, 0.17, 0.3);
const trunkFade = fs => cutF(fs, 0.85, 0.12, 0.2);
let FM = null;
export function foliageMaterials() {
  if (FM) return FM;
  const atlas = foliageAtlas().map, bark = kitTex('bark');
  const U = { uPlayerPos: G.uPlayerPos };
  FM = {
    leaves: lambert({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }, { wrap: 0.6, trans: 0.5, rim: 0.15, rimColor: 0xf0ffb0, key: 'fol-leaves', uniforms: U, vertex: vs => cutV(windVertex(0.1)(vs)), fragment: leafFade }),
    core: lambert({ vertexColors: true }, { wrap: 0.65, trans: 0.3, key: 'fol-core', uniforms: U, vertex: vs => cutV(windVertex(0.08)(vs)), fragment: leafFade }),
    bark: lambert({ map: bark.map, normalMap: bark.normalMap, vertexColors: true }, { wrap: 0.3, key: 'fol-bark', uniforms: U, vertex: vs => cutV(windVertex(0.015)(vs)), fragment: trunkFade }),
    flower: lambert({ vertexColors: true, side: THREE.DoubleSide }, { wrap: 0.5, trans: 0.3, key: 'fol-flower', uniforms: U, vertex: windVertex(0.12) }),
  };
  for (const m of Object.values(FM)) m.userData.shared = true;
  return FM;
}

// ---------------------------------------------------------------- generators
function bentPath(from, to, bend, segs, rng) {
  const pts = [], side = V(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize().multiplyScalar(bend);
  for (let i = 0; i <= segs; i++) { const t = i / segs; const p = from.clone().lerp(to, t); p.addScaledVector(side, Math.sin(t * Math.PI)); pts.push(p); }
  return pts;
}
const SLOT = { leaf: 0, blossom: 1, needle: 2, grass: 3 };
function cardUV(g, slot) {
  const uv = g.attributes.uv, ox = (slot % 2) * 0.5, oy = Math.floor(slot / 2) * 0.5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + 0.01 + uv.getX(i) * 0.48, oy + 0.01 + uv.getY(i) * 0.48);
  return g;
}
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** canopy of small dark solid cores + dense leaf cards around puff spheres (cards carry the silhouette) */
function canopy(leafB, coreB, puffs, rng, nz, { slot = 0, dark, light, core = null, cards = 18, hue = 0, cardSize = 1.9 }) {
  const cc = V(); puffs.forEach(p => cc.add(p.c)); cc.multiplyScalar(1 / puffs.length);
  let yMin = Infinity, yMax = -Infinity; puffs.forEach(p => { yMin = Math.min(yMin, p.c.y - p.r); yMax = Math.max(yMax, p.c.y + p.r); });
  let rMax = 0; puffs.forEach(p => { rMax = Math.max(rMax, p.c.distanceTo(cc) + p.r); });
  const dk = linColor(dark), lt = linColor(light), cr = linColor(core ?? dark);
  const col = (p) => {
    const t = clamp((p.y - yMin) / (yMax - yMin), 0, 1);
    const out = clamp(p.distanceTo(cc) / rMax, 0, 1);
    const k = clamp(t * 0.8 + out * 0.45 - 0.2, 0, 1);
    const c = lerpC(dk, lt, k * k * (3 - 2 * k));
    return [c[0] + hue, c[1], c[2] - hue * 0.5];
  };
  const sph = (p, n) => { const s = p.clone().sub(cc).normalize(); n.lerp(s, 0.85).normalize(); };
  for (const pf of puffs) {
    const g = blob(pf.r * 0.6, 1, d => 1 + nz.noise3(d.x * 1.7 + pf.c.x, d.y * 1.7, d.z * 1.7) * 0.25, [1, 0.85, 1]);
    coreB.add(g, new THREE.Matrix4().makeTranslation(pf.c.x, pf.c.y, pf.c.z), (p) => { const t = clamp((p.y - yMin) / (yMax - yMin), 0, 1); return lerpC(cr, lerpC(cr, dk, 0.5), t); }, { normalFn: sph, extra: { sway: p => clamp(p.y / 8, 0.1, 1) } });
    const n = Math.round(cards * (pf.r / 2.0) ** 1.6);
    for (let i = 0; i < n; i++) {
      // bias cards toward the top/outside (what the high camera sees)
      const d = V(rng.range(-1, 1), rng.range(-0.25, 1.0) + 0.25, rng.range(-1, 1)).normalize();
      const pos = pf.c.clone().addScaledVector(d, pf.r * rng.range(0.72, 1.02));
      const sz = rng.range(0.85, 1.25) * cardSize;
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().lerp(V(0, 1, 0), 0.25).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rng.range(0, Math.PI * 2)));
      leafB.add(cardUV(new THREE.PlaneGeometry(1, 1), slot), new THREE.Matrix4().compose(pos, q, V(sz, sz, sz)), col, { normalFn: sph, extra: { sway: p => clamp(p.y / 8, 0.1, 1) * 1.3 } });
    }
  }
  return yMax;
}

export const SPECIES = {
  broadleaf(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.9, 1.1);
    const trunk = new MeshBuilder([{ name: 'sway', size: 1 }]), leaf = new MeshBuilder([{ name: 'sway', size: 1 }]), core = new MeshBuilder([{ name: 'sway', size: 1 }]);
    const splitH = rng.range(2.6, 3.4) * sc;
    const top = V(rng.range(-0.3, 0.3), splitH, rng.range(-0.3, 0.3));
    const tp = bentPath(V(0, -0.3, 0), top, 0.2, 5, rng);
    const bc = (p) => { const k = 0.7 + clamp(p.y / splitH, 0, 1) * 0.35; return [k, k * 0.96, k * 0.9]; };
    trunk.add(tube(tp, tp.map((p, i) => (0.42 - 0.18 * (i / (tp.length - 1))) * sc * (i === 0 ? 1.3 : 1)), 9), null, bc, { extra: { sway: p => clamp(p.y / 10, 0, 1) * 0.3 } });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + rng.range(-0.3, 0.3), d = V(Math.cos(a), 0, Math.sin(a));
      trunk.add(tube([V(d.x * 0.2, 0.7 * sc, d.z * 0.2), V(d.x * 0.6 * sc, 0.2 * sc, d.z * 0.6 * sc), V(d.x * rng.range(1.0, 1.4) * sc, -0.2, d.z * rng.range(1.0, 1.4) * sc)], [0.22 * sc, 0.14 * sc, 0.05 * sc], 5, false), null, [0.62, 0.58, 0.52], { extra: { sway: 0 } });
    }
    const puffs = [], crownR = rng.range(2.8, 3.4) * sc, nl = rng.int(3, 4);
    for (let i = 0; i < nl; i++) {
      const a = i / nl * Math.PI * 2 + rng.range(-0.4, 0.4), out = rng.range(0.5, 0.8) * crownR;
      const end = V(top.x + Math.cos(a) * out, top.y + rng.range(1.6, 2.6) * sc, top.z + Math.sin(a) * out);
      const lp = bentPath(top.clone().add(V(0, -0.3, 0)), end, 0.35, 4, rng);
      trunk.add(tube(lp, lp.map((_, k) => (0.24 - 0.16 * k / (lp.length - 1)) * sc), 6, true), null, bc, { extra: { sway: p => clamp(p.y / 10, 0, 1) * 0.5 } });
      puffs.push({ c: end.clone().add(V(0, rng.range(0.3, 0.8), 0)), r: rng.range(1.8, 2.3) * sc });
    }
    puffs.push({ c: V(top.x, top.y + rng.range(3.4, 4.0) * sc, top.z), r: rng.range(2.1, 2.5) * sc });
    for (let i = 0; i < 2; i++) { const a = rng.range(0, 6.28); puffs.push({ c: V(top.x + Math.cos(a) * crownR * 0.45, top.y + rng.range(1.4, 3) * sc, top.z + Math.sin(a) * crownR * 0.45), r: rng.range(1.4, 1.8) * sc }); }
    const h = canopy(leaf, core, puffs, rng, nz, { slot: o.slot ?? SLOT.leaf, dark: o.dark ?? 0x1c4012, light: o.light ?? 0xb4d858, core: o.core ?? 0x10240a, cards: 34, hue: rng.range(-0.02, 0.03), cardSize: 1.55 * sc });
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: h, radius: 0.45 * sc };
  },
  blossom(seed, o = {}) { return SPECIES.broadleaf(seed, { slot: SLOT.blossom, dark: 0x6a4050, light: 0xffd0e0, core: 0x2a1a20, ...o }); },
  cypress(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.9, 1.15), H = rng.range(7, 9) * sc;
    const trunk = new MeshBuilder([{ name: 'sway', size: 1 }]), leaf = new MeshBuilder([{ name: 'sway', size: 1 }]), core = new MeshBuilder([{ name: 'sway', size: 1 }]);
    trunk.add(tube([V(0, -0.3, 0), V(0, 1.5, 0)], [0.22 * sc, 0.16 * sc], 7), null, [0.8, 0.75, 0.7], { extra: { sway: 0 } });
    const puffs = [];
    for (let i = 0; i < 6; i++) { const t = i / 5; puffs.push({ c: V(rng.range(-0.1, 0.1), 1.4 + t * (H - 2.4), rng.range(-0.1, 0.1)), r: (1.05 - t * 0.62) * sc * rng.range(0.95, 1.05) }); }
    const h = canopy(leaf, core, puffs, rng, nz, { slot: SLOT.leaf, dark: 0x122a14, light: 0x6a9a44, core: 0x0a180c, cards: 40, cardSize: 1.0 * sc });
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: h, radius: 0.3 * sc };
  },
  pine(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.9, 1.2), H = rng.range(8, 11) * sc;
    const trunk = new MeshBuilder([{ name: 'sway', size: 1 }]), leaf = new MeshBuilder([{ name: 'sway', size: 1 }]), core = new MeshBuilder([{ name: 'sway', size: 1 }]);
    trunk.add(tube([V(0, -0.4, 0), V(rng.range(-0.15, 0.15), H * 0.5, 0), V(0, H, 0)], [0.32 * sc, 0.18 * sc, 0.04], 7), null, [0.8, 0.72, 0.66], { extra: { sway: p => p.y / H * 0.3 } });
    const dark = linColor(o.dark ?? 0x14361e), light = linColor(o.light ?? 0x4a7a3a), snow = linColor(0xf0f6ff);
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, y0 = H * (0.16 + t * 0.74), rr = (1 - t * 0.8) * 2.6 * sc, hh = H * 0.28 * (1 - t * 0.3);
      const g = new THREE.ConeGeometry(rr, hh, 11, 2, true);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k), a = Math.atan2(z, x), rim = y < -hh * 0.45 ? 1 : 0;
        const j = 1 + rim * (Math.sin(a * 7 + i) * 0.12 + nz.noise2(a * 2, i) * 0.12);
        p.setXYZ(k, x * j, y - rim * (0.3 + Math.abs(Math.sin(a * 7 + i)) * 0.3), z * j);
      }
      g.computeVertexNormals();
      const snowy = o.snow ?? 0;
      core.add(g, new THREE.Matrix4().makeTranslation(0, y0 + hh * 0.5, 0), (pp, n) => {
        const s = clamp((pp.y - y0 + hh * 0.2) / hh, 0, 1) * 0.6 + t * 0.4;
        const c = lerpC(dark, light, s);
        const sw = snowy * clamp(n.y * 1.6 - 0.2, 0, 1) * clamp((pp.y - y0) / hh + 0.6, 0, 1);
        return lerpC(c, snow, sw);
      }, { normalFn: (pp, n) => { n.y = Math.max(n.y, 0.3); n.normalize(); }, extra: { sway: pp => pp.y / H } });
      for (let c = 0; c < 9; c++) {
        const a = c / 9 * Math.PI * 2 + rng.range(-0.3, 0.3);
        const pos = V(Math.cos(a) * rr * 0.85, y0 + hh * 0.2, Math.sin(a) * rr * 0.85);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, -a + Math.PI / 2, 0, 'YXZ'));
        leaf.add(cardUV(new THREE.PlaneGeometry(1.3, 1.3), SLOT.needle), new THREE.Matrix4().compose(pos, q, V(sc, sc, sc)), (pp) => lerpC(dark, light, 0.5 + t * 0.3), { extra: { sway: pp => pp.y / H * 1.2 } });
      }
    }
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: H, radius: 0.35 * sc };
  },
  dead(seed, o = {}) {
    const rng = new RNG(seed);
    const sc = o.scale ?? rng.range(0.8, 1.2);
    const b = new MeshBuilder([{ name: 'sway', size: 1 }]);
    const tint = linColor(o.tint ?? 0x8a7a70);
    const grow = (from, dir, len, r, depth) => {
      const to = from.clone().addScaledVector(dir, len);
      const pts = bentPath(from, to, len * 0.2, depth === 0 ? 5 : 3, rng);
      b.add(tube(pts, pts.map((_, k) => r * (1 - 0.6 * k / (pts.length - 1))), Math.max(3, 7 - depth * 2), true), null, tint, { extra: { sway: p => clamp(p.y / 10, 0, 1) * 0.3 } });
      if (depth >= 3) return;
      const n = depth === 0 ? 3 : 2;
      for (let i = 0; i < n; i++) grow(pts[pts.length - 1 - (i % 2)], dir.clone().add(V(rng.range(-0.9, 0.9), rng.range(0.1, 0.6), rng.range(-0.9, 0.9))).normalize(), len * rng.range(0.5, 0.7), r * 0.55, depth + 1);
    };
    grow(V(0, -0.4, 0), V(rng.range(-0.15, 0.15), 1, rng.range(-0.15, 0.15)).normalize(), rng.range(3.5, 5) * sc, 0.4 * sc, 0);
    return { trunk: b.build(), leaves: null, core: null, height: 7 * sc, radius: 0.4 * sc };
  },
  bush(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const leaf = new MeshBuilder([{ name: 'sway', size: 1 }]), core = new MeshBuilder([{ name: 'sway', size: 1 }]);
    const n = rng.int(3, 5), puffs = [];
    for (let i = 0; i < n; i++) puffs.push({ c: V(rng.range(-0.6, 0.6), rng.range(0.35, 0.7), rng.range(-0.6, 0.6)), r: rng.range(0.5, 0.85) });
    canopy(leaf, core, puffs, rng, nz, { slot: o.slot ?? SLOT.leaf, dark: o.dark ?? 0x1c4414, light: o.light ?? 0xa0cc48, core: 0x0e220a, cards: 40, cardSize: 0.85 });
    return { trunk: null, leaves: leaf.build(), core: core.build(), height: 1.5, radius: 0.8 };
  },
};

function flowerGeo(color, seed) {
  const rng = new RNG(seed), b = new MeshBuilder([{ name: 'sway', size: 1 }]);
  const petal = linColor(color), center = linColor(0xf6d040), stem = linColor(0x3e7a28);
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-0.25, 0.25), z = rng.range(-0.25, 0.25), h = rng.range(0.2, 0.4);
    const st = new THREE.CylinderGeometry(0.008, 0.012, h, 3); st.translate(x, h / 2, z);
    b.add(st, null, stem, { extra: { sway: p => p.y } });
    const head = new THREE.OctahedronGeometry(0.06, 0); head.scale(1, 0.4, 1); head.translate(x, h + 0.01, z);
    b.add(head, null, petal, { extra: { sway: () => h } });
    const c = new THREE.OctahedronGeometry(0.024, 0); c.translate(x, h + 0.03, z);
    b.add(c, null, center, { extra: { sway: () => h } });
    const lf = new THREE.PlaneGeometry(0.07, 0.16); lf.translate(0, 0.08, 0); lf.rotateZ(0.6); lf.rotateY(rng.range(0, 6)); lf.translate(x, 0.02, z);
    b.add(lf, null, stem, { extra: { sway: () => 0.05 } });
  }
  return b.build();
}

// ---------------------------------------------------------------- instanced placement (bucketed by 40 m cells)
const CELL = 40;
export class Flora {
  constructor() {
    this.mats = foliageMaterials();
    this.proto = new Map();   // key → { geos: {trunk, leaves, core}, height }
    this.items = [];          // { key, x, y, z, rot, s, kind }
    this.flowers = new Map(); // colour → geometry
    this.colliders = [];
  }
  _proto(species, variant, opts) {
    const key = `${species}:${variant}:${opts ? JSON.stringify(opts) : ''}`;
    if (!this.proto.has(key)) this.proto.set(key, SPECIES[species](1000 + variant * 37 + species.length * 101, opts || {}));
    return key;
  }
  tree(species, x, y, z, { s = 1, rot = Math.random() * 6.28, variant = Math.floor(Math.random() * 3), opts = null, block = true } = {}) {
    const key = this._proto(species, variant, opts);
    this.items.push({ key, x, y, z, rot, s });
    if (block && species !== 'bush') this.colliders.push({ shape: circle(x, z, this.proto.get(key).radius * s + 0.1), inflate: 0.3 });
  }
  flower(x, y, z, color = 0xffffff, { s = 1, rot = Math.random() * 6.28 } = {}) {
    if (!this.flowers.has(color)) this.flowers.set(color, { geo: flowerGeo(color, color & 255), list: [] });
    this.flowers.get(color).list.push({ x, y, z, rot, s });
  }
  build(parent) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = V(0, 1, 0);
    const bucket = (list) => { const b = new Map(); for (const it of list) { const k = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`; if (!b.has(k)) b.set(k, []); b.get(k).push(it); } return b; };
    const place = (geo, mat, list, cast) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); sc.setScalar(it.s); p.set(it.x, it.y, it.z); m.compose(p, q, sc); im.setMatrixAt(i, m); });
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'flora';
      parent.add(im);
    };
    const byKey = new Map();
    for (const it of this.items) { if (!byKey.has(it.key)) byKey.set(it.key, []); byKey.get(it.key).push(it); }
    for (const [key, list] of byKey) {
      const pr = this.proto.get(key);
      for (const [, sub] of bucket(list)) {
        if (pr.trunk) place(pr.trunk, this.mats.bark, sub, true);
        if (pr.core) place(pr.core, this.mats.core, sub, true);
        if (pr.leaves) place(pr.leaves, this.mats.leaves, sub, true);
      }
    }
    for (const [, f] of this.flowers) for (const [, sub] of bucket(f.list)) place(f.geo, this.mats.flower, sub, false);
  }
}
