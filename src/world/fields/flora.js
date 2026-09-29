// Field vegetation (variants of the world kit's foliage.js, copied & extended — the kit stays untouched):
//   FieldGrass   GPU tufts that follow the player and grow where a ground layer is painted. Shapes: 'grass' (the
//                kit's look), 'wheat' (stalks + golden ears), 'reed' (tall blades + cattails), 'giant' (Pip-scale
//                blades), 'fern'. Colours from the layer albedo or explicit gradients; wind + push from the hero.
//   FieldFlora   instanced trees/bushes/flowers bucketed per 48 m cell, with the kit's species plus field species:
//                oak, apple, poplar, fir, ancient (Thornwood giants), charred, willow; and `thing(geo, mat, …)` for any
//                instanced prop (sunflowers, mushrooms, giant flowers…).
//   geo helpers  sunflowerGeo, mushroomGeo, fernGeo, giantFlowerGeo … (MeshBuilder geometry with a `sway` attribute)
import * as THREE from 'three';
import { RNG, Simplex, clamp } from '../../core/noise.js';
import { MeshBuilder, tube, blob, linColor } from '../../engine/geom.js';
import { lambert, G } from '../../engine/materials.js';
import { groundLayers, LAYER_TILE } from '../textures.js';
import { foliageMaterials, SPECIES } from '../foliage.js';
import { cutV, cutF } from '../kit.js';
import { circle } from '../shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------------------------------------ GPU grass variants
function tuftGeometry(shape, height, width) {
  const pos = [], nrm = [], ty = [], idx = [];
  const blade = (bx, bz, facing, lean, h, w, lx, lz, prof = null) => {
    const dx = Math.cos(facing), dz = Math.sin(facing), base = pos.length / 3;
    const P = prof || [[0, 1], [0.5, 1], [1, 0]];
    P.forEach(([t, wm], i) => {
      const ww = w * wm, cx = bx + lx * lean * t * t, cz = bz + lz * lean * t * t, cy = h * t;
      if (wm > 0) { pos.push(cx - dx * ww, cy, cz - dz * ww, cx + dx * ww, cy, cz + dz * ww); nrm.push(lx * 0.3, 1, lz * 0.3, lx * 0.3, 1, lz * 0.3); ty.push(t, t); }
      else { pos.push(cx, cy, cz); nrm.push(lx * 0.3, 1, lz * 0.3); ty.push(t); }
    });
    // strip indices: pairs then a tip
    const pairs = P.filter(p => p[1] > 0).length;
    for (let k = 0; k < pairs - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (P[P.length - 1][1] === 0) { const a = base + (pairs - 1) * 2; idx.push(a, a + 1, a + 2); }
  };
  if (shape === 'wheat') {
    for (let b = 0; b < 4; b++) {
      const a = b / 4 * Math.PI * 2 + b * 1.3, r = b === 0 ? 0.02 : 0.07 + (b % 2) * 0.05;
      const h = (0.82 + ((b * 29) % 7) / 7 * 0.3) * height;
      // thin stalk that widens into a plump ear, then a short awned tip
      blade(Math.cos(a) * r, Math.sin(a) * r, a + 1.1 + b, 0.1 + (b % 3) * 0.04, h, 0.012 * width, Math.cos(a), Math.sin(a),
        [[0, 0.8], [0.62, 0.7], [0.72, 2.6], [0.86, 3.0], [0.96, 1.8], [1.0, 0]]);
    }
  } else if (shape === 'reed') {
    for (let b = 0; b < 6; b++) {
      const a = b / 6 * Math.PI * 2 + b * 0.7, r = 0.04 + (b % 3) * 0.05, h = (0.75 + ((b * 37) % 5) / 5 * 0.5) * height;
      blade(Math.cos(a) * r, Math.sin(a) * r, a + 1.3, 0.12 + (b % 2) * 0.1, h, 0.022 * width, Math.cos(a), Math.sin(a), [[0, 1], [0.5, 0.9], [0.85, 0.5], [1, 0]]);
    }
    for (let b = 0; b < 2; b++) { // cattails
      const a = b * 2.6 + 0.4, r = 0.05, h = 0.95 * height;
      blade(Math.cos(a) * r, Math.sin(a) * r, a, 0.05, h, 0.01 * width, 0, 0, [[0, 1], [0.7, 1], [0.74, 3.4], [0.93, 3.4], [1, 0]]);
    }
  } else if (shape === 'giant') {
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2 + b * 0.9, r = b === 0 ? 0 : 0.07 + (b % 3) * 0.06, h = (0.6 + ((b * 37) % 7) / 7 * 0.5) * height;
      blade(Math.cos(a) * r, Math.sin(a) * r, a + 1.3 + b, 0.18 + (b % 3) * 0.08, h, 0.05 * width, Math.cos(a), Math.sin(a), [[0, 0.8], [0.35, 1], [0.7, 0.75], [1, 0]]);
    }
  } else if (shape === 'fern') {
    for (let b = 0; b < 7; b++) {
      const a = b / 7 * Math.PI * 2 + (b % 2) * 0.3, h = (0.35 + (b % 3) * 0.08) * height;
      blade(0, 0, a + Math.PI / 2, 0.55 + (b % 2) * 0.15, h, 0.07 * width, Math.cos(a), Math.sin(a), [[0, 0.3], [0.3, 1], [0.65, 0.9], [1, 0]]);
    }
  } else {
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2 + b * 0.9, r = b === 0 ? 0 : 0.05 + (b % 3) * 0.05;
      const h = (0.22 + ((b * 37) % 7) / 7 * 0.22) * height;
      blade(Math.cos(a) * r, Math.sin(a) * r, a + 1.3 + b, 0.1 + (b % 3) * 0.05, h, (0.035 - (b % 2) * 0.008) * width, Math.cos(a), Math.sin(a));
    }
  }
  return { pos, nrm, ty, idx };
}

/**
 * opts: { layer, shape, w, d, spacing, density, height, width, tint [r,g,b], north,
 *         colors: null | [hexBase, hexMid, hexTip] (overrides the layer albedo), layerMix (0..1 how much layer colour
 *         to keep with explicit colors), threshold [a, b] mask smoothstep, push (hero push radius), sway }
 */
export class FieldGrass {
  constructor(ground, { layer = 'grass', shape = 'grass', w = 46, d = 40, spacing = 0.4, density = 1, height = 1, width = 1, tint = [1, 1, 1], north = 4, colors = null, layerMix = 0.35, threshold = [0.35, 0.8], push = 0.9, sway = 0.18, scaleVar = [0.65, 1.35] } = {}) {
    const GL = groundLayers();
    const L = ground.layers.indexOf(layer);
    this.north = north; this.spacing = spacing;
    const nx = Math.floor(w / spacing), nz = Math.floor(d / spacing);
    const geo = new THREE.InstancedBufferGeometry();
    const t = tuftGeometry(shape, height, width);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.nrm, 3));
    geo.setAttribute('ty', new THREE.Float32BufferAttribute(t.ty, 1));
    geo.setIndex(t.idx);
    const off = new Float32Array(nx * nz * 2);
    let k = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { off[k++] = (i - nx / 2) * spacing; off[k++] = (j - nz / 2) * spacing; }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
    geo.instanceCount = nx * nz;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const sel = (o) => new THREE.Vector4(L === o ? 1 : 0, L === o + 1 ? 1 : 0, L === o + 2 ? 1 : 0, L === o + 3 ? 1 : 0);
    this.uCenter = { value: new THREE.Vector2() };
    const lt = ground.layerTint ? ground.layerTint(layer) : [1, 1, 1];
    const C = (colors || [0x406020, 0x70a030, 0xb0d060]).map(h => new THREE.Color(h));
    const mat = lambert({}, {
      wrap: 0.6, trans: 0.4, key: 'fgrass-' + shape + (colors ? '-c' : ''),
      uniforms: {
        uCenter: this.uCenter, uSpacing: { value: spacing }, uHalf: { value: new THREE.Vector2(w / 2, d / 2) }, uDensity: { value: density },
        uCtrlA: { value: ground.ctrlA }, uCtrlB: { value: ground.ctrlB }, uCtrlC: { value: ground.ctrlC }, uCtrlXf: { value: ground.ctrlInfo }, uSelA: { value: sel(0) }, uSelB: { value: sel(4) }, uSelC: { value: sel(8) },
        uHeight: { value: ground.heightTex }, uHXf: { value: ground.heightInfo }, uAlb: { value: GL.albedo }, uLayer: { value: GL.index[layer] }, uTileG: { value: 1 / ((ground.ltile && ground.ltile[layer]) || LAYER_TILE[layer] || 4) },
        uTintG: { value: new THREE.Vector3(tint[0] * lt[0], tint[1] * lt[1], tint[2] * lt[2]) }, uPlayerPos: G.uPlayerPos,
        uC0: { value: C[0] }, uC1: { value: C[1] }, uC2: { value: C[2] }, uLMix: { value: colors ? layerMix : 1 },
        uThr: { value: new THREE.Vector2(threshold[0], threshold[1]) }, uPush: { value: push }, uSway: { value: sway }, uSVar: { value: new THREE.Vector2(scaleVar[0], scaleVar[1] - scaleVar[0]) },
      },
      vertex: vs => vs.replace('#include <common>', `#include <common>
precision highp sampler2DArray;
attribute vec2 aOff; attribute float ty;
uniform vec2 uCenter; uniform float uSpacing; uniform vec2 uHalf; uniform float uDensity;
uniform sampler2D uCtrlA; uniform sampler2D uCtrlB; uniform sampler2D uCtrlC; uniform vec4 uCtrlXf; uniform vec4 uSelA; uniform vec4 uSelB; uniform vec4 uSelC;
uniform sampler2D uHeight; uniform vec4 uHXf; uniform sampler2DArray uAlb; uniform float uLayer; uniform float uTileG; uniform vec3 uTintG; uniform vec3 uPlayerPos;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uLMix; uniform vec2 uThr; uniform float uPush; uniform float uSway; uniform vec2 uSVar;
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
float s = step(r3, smoothstep(uThr.x, uThr.y, m) * uDensity) * fade * (uSVar.x + r1 * uSVar.y);
float rot = r2 * 6.2832;
mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
vec3 transformed = vec3(position);
transformed.xz = R * transformed.xz;
transformed *= s;
float sway = (sin(uTime * 2.2 + wxz.x * 0.35 + wxz.y * 0.2) * 0.3 + sin(uTime * 3.7 + wxz.x * 0.9) * 0.12) * ty * ty * uSway * max(s, 0.5);
transformed.x += sway * uWind.x; transformed.z += sway * uWind.y;
vec2 away = wxz - uPlayerPos.xz; float dp = length(away);
float pk = smoothstep(uPush, uPush * 0.22, dp);
transformed.xz += normalize(away + 1e-4) * pk * ty * 0.28 * uPush;
transformed.y *= 1.0 - pk * ty * 0.4;
transformed.xz += wxz; transformed.y += hy - 0.02;
vec3 gcol = textureLod(uAlb, vec3(wxz * uTileG, uLayer), 3.0).rgb * uTintG * mix(0.55, 1.25, ty);
vec3 ccol = ty < 0.5 ? mix(uC0, uC1, ty * 2.0) : mix(uC1, uC2, ty * 2.0 - 1.0);
ccol *= 0.85 + r1 * 0.3;
vGrassCol = mix(ccol, gcol, uLMix);
`),
      fragment: fs => fs.replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb = vGrassCol;'),
    });
    mat.side = THREE.DoubleSide;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.name = 'fgrass-' + shape;
  }
  update(focus) { if (focus) this.uCenter.value.set(focus.x, focus.z - this.north); }
}

// ------------------------------------------------------------------------------------------------ tree builders (copied from foliage.js)
const SLOT = { leaf: 0, blossom: 1, needle: 2, grass: 3 };
function cardUV(g, slot) {
  const uv = g.attributes.uv, ox = (slot % 2) * 0.5, oy = Math.floor(slot / 2) * 0.5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + 0.01 + uv.getX(i) * 0.48, oy + 0.01 + uv.getY(i) * 0.48);
  return g;
}
function bentPath(from, to, bend, segs, rng) {
  const pts = [], side = V(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize().multiplyScalar(bend);
  for (let i = 0; i <= segs; i++) { const t = i / segs; const p = from.clone().lerp(to, t); p.addScaledVector(side, Math.sin(t * Math.PI)); pts.push(p); }
  return pts;
}
function canopy(leafB, coreB, puffs, rng, nz, { slot = 0, dark, light, core = null, cards = 18, hue = 0, cardSize = 1.9, swayH = 8 }) {
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
    coreB.add(g, new THREE.Matrix4().makeTranslation(pf.c.x, pf.c.y, pf.c.z), (p) => { const t = clamp((p.y - yMin) / (yMax - yMin), 0, 1); return lerpC(cr, lerpC(cr, dk, 0.5), t); }, { normalFn: sph, extra: { sway: p => clamp(p.y / swayH, 0.1, 1) } });
    const n = Math.round(cards * (pf.r / 2.0) ** 1.6);
    for (let i = 0; i < n; i++) {
      const d = V(rng.range(-1, 1), rng.range(-0.25, 1.0) + 0.25, rng.range(-1, 1)).normalize();
      const pos = pf.c.clone().addScaledVector(d, pf.r * rng.range(0.72, 1.02));
      const sz = rng.range(0.85, 1.25) * cardSize;
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().lerp(V(0, 1, 0), 0.25).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rng.range(0, Math.PI * 2)));
      leafB.add(cardUV(new THREE.PlaneGeometry(1, 1), slot), new THREE.Matrix4().compose(pos, q, V(sz, sz, sz)), col, { normalFn: sph, extra: { sway: p => clamp(p.y / swayH, 0.1, 1) * 1.3 } });
    }
  }
  return yMax;
}
const MB = () => new MeshBuilder([{ name: 'sway', size: 1 }]);

export const FIELD_SPECIES = {
  ...SPECIES,
  oak(seed, o = {}) { return SPECIES.broadleaf(seed, { dark: 0x24461a, light: 0xc8d860, core: 0x13280b, ...o }); },
  autumn(seed, o = {}) { return SPECIES.broadleaf(seed, { dark: 0x6a3a14, light: 0xf0b040, core: 0x3a1e0a, ...o }); },
  poplar(seed, o = {}) { return SPECIES.cypress(seed, o); },
  fir(seed, o = {}) { return SPECIES.pine(seed, { dark: 0x0e2a1c, light: 0x2e5a3a, ...o }); },
  charred(seed, o = {}) { return SPECIES.dead(seed, { tint: 0x2c2420, ...o }); },
  /** orchard tree: short trunk, round crown, fruit */
  apple(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.85, 1.05);
    const trunk = MB(), leaf = MB(), core = MB();
    const top = V(rng.range(-0.15, 0.15), 1.5 * sc, rng.range(-0.15, 0.15));
    const tp = bentPath(V(0, -0.3, 0), top, 0.15, 4, rng);
    trunk.add(tube(tp, tp.map((_, i) => (0.2 - 0.07 * i / (tp.length - 1)) * sc), 8), null, [0.7, 0.62, 0.55], { extra: { sway: 0 } });
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + rng.range(-0.3, 0.3), out = rng.range(0.6, 1.0) * sc;
      const end = V(top.x + Math.cos(a) * out, top.y + rng.range(0.7, 1.2) * sc, top.z + Math.sin(a) * out);
      const lp = bentPath(top, end, 0.2, 3, rng);
      trunk.add(tube(lp, lp.map((_, k) => (0.1 - 0.06 * k / (lp.length - 1)) * sc), 5, true), null, [0.7, 0.62, 0.55], { extra: { sway: 0.2 } });
      puffs.push({ c: end.clone().add(V(0, 0.3 * sc, 0)), r: rng.range(0.95, 1.2) * sc });
    }
    puffs.push({ c: V(top.x, top.y + 1.7 * sc, top.z), r: 1.25 * sc });
    const h = canopy(leaf, core, puffs, rng, nz, { dark: o.dark ?? 0x2a5018, light: o.light ?? 0xb8d858, core: 0x142a0a, cards: 26, cardSize: 1.05 * sc, swayH: 5 });
    const fruit = linColor(o.fruit ?? 0xd8301c);
    for (let i = 0; i < 16; i++) {
      const pf = rng.pick(puffs), d = V(rng.range(-1, 1), rng.range(-0.3, 0.9), rng.range(-1, 1)).normalize();
      const p = pf.c.clone().addScaledVector(d, pf.r * 0.95);
      core.add(blob(0.11 * sc, 0), new THREE.Matrix4().makeTranslation(p.x, p.y, p.z), (pp, n) => lerpC(fruit, [1, 0.8, 0.5], clamp(n.y, 0, 1) * 0.3), { extra: { sway: clamp(p.y / 5, 0.1, 1) } });
    }
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: h, radius: 0.28 * sc };
  },
  /** Thornwood giant: massive buttressed trunk with roots, gnarled limbs, a high dark canopy */
  ancient(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.9, 1.1);
    const trunk = MB(), leaf = MB(), core = MB();
    const H = rng.range(8.5, 10.5) * sc, R = rng.range(1.3, 1.7) * sc;
    const bark = (p) => { const k = 0.55 + clamp(p.y / H, 0, 1) * 0.35 + nz.noise3(p.x * 0.8, p.y * 0.3, p.z * 0.8) * 0.12; return [k * 0.92, k * 0.9, k * 0.8]; };
    // trunk: a twisted tube with a flared base
    const tp = []; for (let i = 0; i <= 8; i++) { const t = i / 8; tp.push(V(Math.sin(t * 2.4 + seed) * 0.5 * sc * t, -0.8 + t * (H + 0.8), Math.cos(t * 1.9 + seed) * 0.4 * sc * t)); }
    trunk.add(tube(tp, tp.map((_, i) => { const t = i / 8; return R * (1 - t * 0.45) * (1 + Math.max(0, 0.25 - t) * 2.2); }), 14, false), null, bark, { extra: { sway: p => clamp(p.y / 30, 0, 0.25) } });
    // buttress roots
    const nr = rng.int(6, 8);
    for (let i = 0; i < nr; i++) {
      const a = i / nr * Math.PI * 2 + rng.range(-0.25, 0.25), d = V(Math.cos(a), 0, Math.sin(a)), L = rng.range(2.6, 4.2) * sc;
      const pts = [V(d.x * R * 0.5, 1.6 * sc, d.z * R * 0.5), V(d.x * (R + 0.6 * sc), 0.9 * sc, d.z * (R + 0.6 * sc)), V(d.x * (R + L * 0.55), 0.25, d.z * (R + L * 0.55)), V(d.x * (R + L), -0.35, d.z * (R + L))];
      trunk.add(tube(pts, [0.75 * sc, 0.55 * sc, 0.32 * sc, 0.1 * sc], 7, true), null, bark, { extra: { sway: 0 } });
    }
    // limbs + canopy
    const top = tp[tp.length - 1], puffs = [], nl = rng.int(4, 5), crown = rng.range(4.5, 5.5) * sc;
    for (let i = 0; i < nl; i++) {
      const a = i / nl * Math.PI * 2 + rng.range(-0.3, 0.3), out = rng.range(0.6, 0.95) * crown;
      const from = tp[rng.int(5, 7)];
      const end = V(top.x + Math.cos(a) * out, top.y + rng.range(0.5, 2.2) * sc, top.z + Math.sin(a) * out);
      const lp = bentPath(from, end, 0.8, 5, rng);
      trunk.add(tube(lp, lp.map((_, k) => (0.55 - 0.4 * k / (lp.length - 1)) * sc), 7, true), null, bark, { extra: { sway: p => clamp(p.y / 30, 0, 0.3) } });
      puffs.push({ c: end.clone().add(V(0, rng.range(0.6, 1.2) * sc, 0)), r: rng.range(2.6, 3.3) * sc });
    }
    puffs.push({ c: V(top.x, top.y + 2.6 * sc, top.z), r: 3.4 * sc });
    const h = canopy(leaf, core, puffs, rng, nz, { dark: o.dark ?? 0x0c2418, light: o.light ?? 0x4e8a4a, core: o.core ?? 0x06140c, cards: 30, cardSize: 2.4 * sc, hue: -0.01, swayH: 16 });
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: h, radius: R * 1.1 };
  },
  /** weeping willow for riverbanks: short trunk, drooping curtains of leaf cards */
  willow(seed, o = {}) {
    const rng = new RNG(seed), nz = new Simplex(seed);
    const sc = o.scale ?? rng.range(0.9, 1.1);
    const trunk = MB(), leaf = MB(), core = MB();
    const top = V(rng.range(-0.3, 0.3), 3.2 * sc, rng.range(-0.3, 0.3));
    const tp = bentPath(V(0, -0.3, 0), top, 0.4, 5, rng);
    trunk.add(tube(tp, tp.map((_, i) => (0.36 - 0.14 * i / (tp.length - 1)) * sc), 9), null, [0.72, 0.66, 0.58], { extra: { sway: 0 } });
    const puffs = [{ c: top.clone().add(V(0, 1.4 * sc, 0)), r: 2.2 * sc }, { c: top.clone().add(V(1.2 * sc, 0.8 * sc, 0.4)), r: 1.7 * sc }, { c: top.clone().add(V(-1.1 * sc, 0.9 * sc, -0.5)), r: 1.7 * sc }];
    canopy(leaf, core, puffs, rng, nz, { dark: 0x2e4a18, light: 0xa8c858, core: 0x16280a, cards: 16, cardSize: 1.4 * sc, swayH: 6 });
    // hanging strands
    const dk = linColor(0x345a1c), lt = linColor(0x9cc050);
    for (let i = 0; i < 46; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(1.2, 2.8) * sc, y0 = top.y + rng.range(0.4, 2.2) * sc, len = rng.range(1.8, 3.2) * sc;
      const g = new THREE.PlaneGeometry(0.5 * sc, len, 1, 3); g.translate(0, -len / 2, 0);
      const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -a + Math.PI / 2);
      leaf.add(cardUV(g, SLOT.leaf), new THREE.Matrix4().compose(V(top.x + Math.cos(a) * r, y0, top.z + Math.sin(a) * r), q, V(1, 1, 1)), (p) => lerpC(dk, lt, clamp((p.y - (y0 - len)) / len, 0, 1)), { extra: { sway: p => 0.5 + clamp((y0 - p.y) / len, 0, 1) * 1.5 } });
    }
    return { trunk: trunk.build(), leaves: leaf.build(), core: core.build(), height: top.y + 3.6 * sc, radius: 0.4 * sc };
  },
};

// ------------------------------------------------------------------------------------------------ instanced flora
const CELL = 48;
/**
 * Like foliage.js Flora, with FIELD_SPECIES and generic instanced things:
 *   flora.tree(species, x, y, z, { s, rot, variant, opts, block })
 *   flora.thing(key, geoFn, material, x, y, z, { s, rot, sx, sy, sz, cast })   geoFn called once per key
 *   flora.flower(x, y, z, colour)
 */
export class FieldFlora {
  constructor({ cell = CELL } = {}) {
    this.mats = foliageMaterials();
    this.cell = cell;
    this.proto = new Map(); this.items = []; this.flowers = new Map(); this.things = new Map(); this.colliders = [];
  }
  _proto(species, variant, opts) {
    const key = `${species}:${variant}:${opts ? JSON.stringify(opts) : ''}`;
    if (!this.proto.has(key)) this.proto.set(key, FIELD_SPECIES[species](1000 + variant * 37 + species.length * 101, opts || {}));
    return key;
  }
  tree(species, x, y, z, { s = 1, rot = Math.random() * 6.28, variant = 0, opts = null, block = true, br = null } = {}) {
    const key = this._proto(species, variant, opts);
    this.items.push({ key, x, y, z, rot, s });
    if (block && species !== 'bush') this.colliders.push({ shape: circle(x, z, br ?? (this.proto.get(key).radius * s + 0.1)), inflate: 0.3 });
    return this.proto.get(key);
  }
  flower(x, y, z, color = 0xffffff, { s = 1, rot = Math.random() * 6.28 } = {}) {
    if (!this.flowers.has(color)) this.flowers.set(color, { geo: flowerGeo(color, color & 255), list: [] });
    this.flowers.get(color).list.push({ x, y, z, rot, s });
  }
  thing(key, geoFn, material, x, y, z, { s = 1, rot = 0, sx = 1, sy = 1, sz = 1, cast = true } = {}) {
    if (!this.things.has(key)) this.things.set(key, { geo: geoFn(), material, cast, list: [] });
    this.things.get(key).list.push({ x, y, z, rot, s, sx, sy, sz });
  }
  build(parent) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = V(0, 1, 0);
    const bucket = (list) => { const b = new Map(); for (const it of list) { const k = `${Math.floor(it.x / this.cell)},${Math.floor(it.z / this.cell)}`; if (!b.has(k)) b.set(k, []); b.get(k).push(it); } return b; };
    const place = (geo, mat, list, cast, name = 'flora') => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); sc.set(it.s * (it.sx ?? 1), it.s * (it.sy ?? 1), it.s * (it.sz ?? 1)); p.set(it.x, it.y, it.z); m.compose(p, q, sc); im.setMatrixAt(i, m); });
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); im.name = name;
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
    for (const [key, t] of this.things) for (const [, sub] of bucket(t.list)) place(t.geo, t.material, sub, t.cast, 'thing:' + key);
  }
}
function flowerGeo(color, seed) {
  const rng = new RNG(seed), b = MB();
  const petal = linColor(color), center = linColor(0xf6d040), stem = linColor(0x3e7a28);
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-0.25, 0.25), z = rng.range(-0.25, 0.25), h = rng.range(0.2, 0.4);
    const st = new THREE.CylinderGeometry(0.008, 0.012, h, 3); st.translate(x, h / 2, z);
    b.add(st, null, stem, { extra: { sway: p => p.y } });
    const head = new THREE.OctahedronGeometry(0.06, 0); head.scale(1, 0.4, 1); head.translate(x, h + 0.01, z);
    b.add(head, null, petal, { extra: { sway: () => h } });
    const c = new THREE.OctahedronGeometry(0.024, 0); c.translate(x, h + 0.03, z);
    b.add(c, null, center, { extra: { sway: () => h } });
  }
  return b.build();
}

// ------------------------------------------------------------------------------------------------ prop geometry (sway-able)
/** Sunflower: stem, broad leaves, a big head facing +Z (south → the camera). h ≈ 1.9 m */
export function sunflowerGeo(seed = 1) {
  const rng = new RNG(seed), b = MB();
  const stem = linColor(0x4a7a22), leafC = linColor(0x3a6a1a), pet = linColor(0xf6c21a), petD = linColor(0xe09a10), disc = linColor(0x4a2a10);
  const h = 1.8;
  b.add(tube([V(0, -0.1, 0), V(0.05, h * 0.5, 0.02), V(0.02, h, 0.12)], [0.035, 0.028, 0.022], 5, false), null, stem, { extra: { sway: p => (p.y / h) ** 2 * 0.6 } });
  for (let i = 0; i < 4; i++) {
    const y = 0.45 + i * 0.3, a = i * 2.3 + rng.range(-0.3, 0.3);
    const g = new THREE.PlaneGeometry(0.34, 0.22, 2, 1); g.translate(0.2, 0, 0);
    const pp = g.attributes.position; for (let k = 0; k < pp.count; k++) pp.setY(k, pp.getY(k) - Math.abs(pp.getX(k)) * 0.25);
    g.rotateX(-Math.PI / 2 + 0.5); g.rotateY(a);
    g.translate(0, y, 0);
    b.add(g, null, leafC, { extra: { sway: p => (p.y / h) ** 2 * 0.6 } });
  }
  // head: disc + two petal rings, tilted toward +Z and a little down
  const head = new THREE.Matrix4().compose(V(0.02, h, 0.14), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)), V(1, 1, 1));
  const discG = new THREE.CylinderGeometry(0.16, 0.17, 0.07, 14); discG.rotateX(Math.PI / 2);
  b.add(discG, head, (p, n) => n.z > 0.5 ? disc : lerpC(stem, disc, 0.5), { extra: { sway: 0.6 } });
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14; i++) {
    const a = (i + ring * 0.5) / 14 * Math.PI * 2, L = 0.17 + ring * 0.03;
    const g = new THREE.PlaneGeometry(0.07, L); g.translate(0, 0.16 + L / 2, 0); g.rotateZ(a);
    g.rotateX(ring ? -0.12 : -0.3);
    b.add(g, head, ring ? petD : pet, { extra: { sway: 0.6 } });
  }
  return b.build();
}
/**
 * Mushroom (small cluster member or Pip-scale giant). o: { h, r (cap radius), cap, spots, stem, gills, glow (0..), droop }
 * Returns MeshBuilder geometry with sway (0 for giants).
 */
export function mushroomGeo({ h = 0.35, r = 0.22, cap = 0xc03020, spots = 0xfff4e0, stem = 0xf0e6d0, gills = 0xd8c8a8, spotN = 9, seed = 1, sway = 0.05, flat = 0.55, lean = 0.08 } = {}) {
  const rng = new RNG(seed), nz = new Simplex(seed), b = MB();
  const cC = linColor(cap), sC = linColor(spots), stC = linColor(stem), gC = linColor(gills);
  const top = V(lean * h, h, 0);
  b.add(tube([V(0, -0.02, 0), V(lean * h * 0.3, h * 0.5, 0), top], [r * 0.34, r * 0.26, r * 0.22], 10, false), null, (p) => lerpC(stC, lerpC(stC, [0.6, 0.55, 0.45], 0.3), clamp(1 - p.y / h, 0, 1) * 0.4), { extra: { sway: p => clamp(p.y / h, 0, 1) * sway } });
  // cap: a flattened hemisphere with a curled rim, gills underneath
  const capG = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const cp = capG.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); cp.setXYZ(i, x * (1 + nz.noise2(x * 3, z * 3) * 0.05), y * flat, z * (1 + nz.noise2(x * 3 + 9, z * 3) * 0.05)); }
  capG.computeVertexNormals();
  const spotsAt = []; for (let i = 0; i < spotN; i++) { const a = rng.range(0, Math.PI * 2), el = rng.range(0.25, 1.2); spotsAt.push([Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el), rng.range(0.13, 0.22)]); }
  b.add(capG, new THREE.Matrix4().makeTranslation(top.x, top.y - r * flat * 0.3, top.z), (p, n) => {
    const d = V(p.x - top.x, (p.y - top.y + r * flat * 0.3) / flat, p.z - top.z).normalize();
    let sp = 0; for (const s of spotsAt) sp = Math.max(sp, clamp(1 - Math.hypot(d.x - s[0], d.y - s[1], d.z - s[2]) / s[3], 0, 1));
    const k = 0.85 + d.y * 0.2;
    return sp > 0.35 ? sC : [cC[0] * k, cC[1] * k, cC[2] * k];
  }, { extra: { sway: sway } });
  const under = new THREE.CircleGeometry(r * 0.98, 18); under.rotateX(Math.PI / 2);
  b.add(under, new THREE.Matrix4().makeTranslation(top.x, top.y - r * flat * 0.3 + 0.005, top.z), gC, { extra: { sway: sway } });
  return b.build();
}
/** reed clump for banks and marshes: blades + two cattails (static, instanced) */
export function reedGeo(seed = 1, { h = 1.6, color = 0x4a6a24, tip = 0xa8b060, n = 9 } = {}) {
  const rng = new RNG(seed), b = MB(), c0 = linColor(color), c1 = linColor(tip), cat = linColor(0x5a3a1c);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(0, 0.22), L = h * rng.range(0.6, 1.05), lean = rng.range(0.1, 0.35);
    const g = new THREE.PlaneGeometry(0.06, L, 1, 3); g.translate(0, L / 2, 0);
    const pp = g.attributes.position; for (let k = 0; k < pp.count; k++) { const t = pp.getY(k) / L; pp.setX(k, pp.getX(k) * (1 - t * 0.9)); pp.setZ(k, t * t * lean * L); }
    g.rotateY(a); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    b.add(g, null, (p) => lerpC(c0, c1, clamp(p.y / h, 0, 1)), { extra: { sway: p => clamp(p.y / h, 0, 1) ** 2 } });
  }
  for (let i = 0; i < 2; i++) {
    const x = rng.range(-0.12, 0.12), z = rng.range(-0.12, 0.12), L = h * rng.range(0.85, 1.1);
    const st = new THREE.CylinderGeometry(0.01, 0.014, L, 3); st.translate(x, L / 2, z); b.add(st, null, c0, { extra: { sway: p => clamp(p.y / h, 0, 1) ** 2 } });
    const hd = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 6); hd.translate(x, L - 0.14, z); b.add(hd, null, cat, { extra: { sway: (L / h) ** 2 } });
  }
  return b.build();
}
/** single fern fan (instanced on the forest floor) */
export function fernGeo(seed = 1, { h = 0.9, color = 0x3a6a26, tip = 0x88b048, n = 8 } = {}) {
  const rng = new RNG(seed), b = MB(), c0 = linColor(color), c1 = linColor(tip);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rng.range(-0.2, 0.2), L = h * rng.range(0.75, 1.1);
    const g = new THREE.PlaneGeometry(0.28, L, 1, 4); g.translate(0, L / 2, 0);
    const pp = g.attributes.position;
    for (let k = 0; k < pp.count; k++) { const t = pp.getY(k) / L; pp.setX(k, pp.getX(k) * Math.sin(Math.min(1, t * 1.3) * Math.PI) ); pp.setZ(k, Math.sin(t * 1.7) * L * 0.55); pp.setY(k, pp.getY(k) * (1 - t * 0.35)); }
    g.rotateY(a);
    b.add(cardUV(g, SLOT.leaf), null, (p) => lerpC(c0, c1, clamp(Math.hypot(p.x, p.z) / (L * 0.6), 0, 1)), { extra: { sway: p => clamp(Math.hypot(p.x, p.z) / L, 0, 1) * 0.8 } });
  }
  return b.build();
}
/** Pip-scale giant flower: tall stem, leaves, a big bloom (kinds: daisy, tulip, bell, dandelion (seed clock)) facing up/south */
export function giantFlowerGeo({ kind = 'daisy', h = 3, color = 0xffffff, center = 0xf0c020, seed = 1 } = {}) {
  const rng = new RNG(seed), b = MB();
  const stem = linColor(0x4a8a2a), leafC = linColor(0x3a7a22), pc = linColor(color), cc = linColor(center);
  const tip = V(rng.range(-0.15, 0.15), h, rng.range(0, 0.25));
  b.add(tube([V(0, -0.1, 0), V(tip.x * 0.3, h * 0.5, tip.z * 0.2), tip], [0.07, 0.06, 0.05], 7, false), null, stem, { extra: { sway: p => (p.y / h) ** 2 } });
  for (let i = 0; i < 3; i++) {
    const y = h * (0.15 + i * 0.18), a = i * 2.2 + rng.range(-0.4, 0.4), L = h * 0.32;
    const g = new THREE.PlaneGeometry(L * 0.35, L, 2, 3); g.translate(0, L / 2, 0);
    const pp = g.attributes.position; for (let k = 0; k < pp.count; k++) { const t = pp.getY(k) / L; pp.setX(k, pp.getX(k) * Math.sin(Math.min(1, t * 1.2) * Math.PI)); pp.setZ(k, Math.sin(t * 1.5) * L * 0.45); }
    g.rotateY(a); g.translate(0, y, 0);
    b.add(g, null, (p) => lerpC(leafC, [0.5, 0.75, 0.3], clamp((p.y - y) / L, 0, 1) * 0.6), { extra: { sway: p => (p.y / h) ** 2 } });
  }
  const head = new THREE.Matrix4().compose(tip, new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1, 0, 0)), V(1, 1, 1)); // bloom tilted toward the camera
  const S = h / 3;
  if (kind === 'daisy') {
    const disc = new THREE.SphereGeometry(0.22 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); disc.scale(1, 0.5, 1); disc.rotateX(Math.PI / 2);
    b.add(disc, head, cc, { extra: { sway: 1 } });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const g = new THREE.PlaneGeometry(0.16 * S, 0.62 * S); g.translate(0, 0.5 * S, 0); g.rotateZ(a); g.rotateX(-0.12); b.add(g, head, lerpC(pc, [1, 1, 1], (i % 2) * 0.1), { extra: { sway: 1 } }); }
  } else if (kind === 'tulip') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const g = new THREE.SphereGeometry(0.34 * S, 8, 6, 0, Math.PI * 0.7, 0, Math.PI * 0.6); g.scale(0.8, 1.6, 0.8); g.rotateY(a); g.translate(0, 0.05, 0); b.add(g, new THREE.Matrix4().makeTranslation(tip.x, tip.y, tip.z), (p) => lerpC(pc, [1, 1, 0.9], clamp((p.y - tip.y) / (0.8 * S), 0, 1) * 0.25), { extra: { sway: 1 } }); }
  } else if (kind === 'bell') {
    const g = new THREE.LatheGeometry([[0.02, 0], [0.18, -0.05], [0.3, -0.35], [0.36, -0.62], [0.44, -0.72]].map(([r, y]) => new THREE.Vector2(r * S, y * S)), 12);
    b.add(g, new THREE.Matrix4().compose(tip.clone().add(V(0.2 * S, -0.05, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.5)), V(1, 1, 1)), pc, { extra: { sway: 1 } });
  } else if (kind === 'dandelion') {
    const ball = blob(0.5 * S, 1, null, [1, 1, 1]);
    b.add(ball, new THREE.Matrix4().makeTranslation(tip.x, tip.y + 0.4 * S, tip.z), (p, n) => lerpC([0.85, 0.85, 0.8], [1, 1, 1], clamp(n.y, 0, 1)), { extra: { sway: 1 } });
    for (let i = 0; i < 40; i++) { const d = V(rng.range(-1, 1), rng.range(-0.6, 1), rng.range(-1, 1)).normalize(); const g = new THREE.PlaneGeometry(0.18 * S, 0.18 * S); const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d); b.add(g, new THREE.Matrix4().compose(V(tip.x + d.x * 0.62 * S, tip.y + 0.4 * S + d.y * 0.62 * S, tip.z + d.z * 0.62 * S), q, V(1, 1, 1)), [1, 1, 1], { extra: { sway: 1 } }); }
  }
  return b.build();
}
export { SLOT, cardUV, canopy, bentPath, MB, lerpC };
