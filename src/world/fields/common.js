// Shared helpers for the open-world field zones (brighthold, goldmeadow, thornwood, ashen_ridge, pipsprout).
// Built on top of the world kit (ground.js, kit.js, nav.js, shapes.js …) without modifying it:
//   FieldGround   Ground + per-layer albedo tint and tile size (zone moods: golden grass, grey ash, giant Pip grass…)
//   DistGrid      fast distance-to-polyline field (rivers, roads, walls) for sculpting, masks and scatter
//   paintPath     paints a long winding road in small pieces (fast), with a worn centre
//   scatter       poisson-ish dart throwing inside a box with an accept(x, z) predicate
//   FieldKit      Kit that also merges geometry with custom (non-kit) materials, and builds animated parts
//   Anchors       pack / elite / node / seed / … naming helpers; snapAnchors() puts every anchor on walkable ground
//   seedSpots     Pip Seed placement that follows the collectible hints (data/collectibles.js wording)
import * as THREE from 'three';
import { Ground } from '../ground.js';
import { Kit, kitMaterial } from '../kit.js';
import { G } from '../../engine/materials.js';
import * as S from '../shapes.js';
import { RNG, clamp, smoothstep, lerp, catmull } from '../../core/noise.js';
import { MeshBuilder, linColor } from '../../engine/geom.js';

export const TAU = Math.PI * 2;
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const faceTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
export const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

// ------------------------------------------------------------------------------------------------ ground
/**
 * Ground with per-layer albedo tint and tile size. opts (besides Ground's): ltint { layer: hex | [r,g,b] },
 * ltile { layer: metres per repeat }. The tint multiplies the layer's baked albedo before splat blending.
 */
export class FieldGround extends Ground {
  constructor(o) {
    super(o);
    this.ltint = o.ltint || {}; this.ltile = o.ltile || {};
  }
  layerTint(layer) {
    const t = this.ltint[layer];
    if (t == null) return [1, 1, 1];
    if (Array.isArray(t)) return t;
    const c = new THREE.Color(t); return [c.r, c.g, c.b];
  }
  makeMaterial() {
    const mat = super.makeMaterial();
    const u = this.uniforms;
    this.layers.forEach((l, i) => { if (this.ltile[l]) u.uTile.value[i] = 1 / this.ltile[l]; });
    const tints = [];
    for (let i = 0; i < 12; i++) { const t = i < this.layers.length ? this.layerTint(this.layers[i]) : [1, 1, 1]; tints.push(new THREE.Vector3(t[0], t[1], t[2])); }
    const uL = { value: tints };
    this.uLTint = uL;
    const ob = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      ob(sh, r);
      sh.uniforms.uLTint = uL;
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform vec3 uGTint;', 'uniform vec3 uGTint; uniform vec3 uLTint[12];')
        .replace('ALB[i] = mix(a0, a1, tb);', 'ALB[i] = mix(a0, a1, tb); ALB[i].rgb *= uLTint[i];');
    };
    mat.customProgramCacheKey = () => 'sty:ground8:fields';
    return mat;
  }
}

// ------------------------------------------------------------------------------------------------ distance fields
/** Distance to polylines on a grid (bounded by maxD), sampled bilinearly. Also records arc length along the line. */
export class DistGrid {
  constructor(x0, z0, w, d, res = 1, maxD = 24) {
    this.x0 = x0; this.z0 = z0; this.res = res; this.maxD = maxD;
    this.nx = Math.ceil(w / res) + 1; this.nz = Math.ceil(d / res) + 1;
    this.v = new Float32Array(this.nx * this.nz).fill(maxD);
    this.s = new Float32Array(this.nx * this.nz).fill(0);
    this.lines = [];
  }
  /** add a polyline [[x, z]…]; width w is subtracted from the distance (0 = centre line) */
  add(pts, w = 0) {
    const { res, x0, z0, nx, nz, maxD, v, s } = this;
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1, L = Math.sqrt(L2);
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - maxD - x0) / res)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + maxD - x0) / res));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - maxD - z0) / res)), j1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz) + maxD - z0) / res));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const px = x0 + ii * res, pz = z0 + j * res;
        const t = clamp(((px - ax) * ex + (pz - az) * ez) / L2, 0, 1);
        const dx = ax + ex * t - px, dz = az + ez * t - pz;
        const dd = Math.sqrt(dx * dx + dz * dz) - w, k = j * nx + ii;
        if (dd < v[k]) { v[k] = dd; s[k] = acc + t * L; }
      }
      acc += L;
    }
    this.lines.push({ pts, w, len: acc });
    return this;
  }
  _bil(arr, x, z) {
    const fx = clamp((x - this.x0) / this.res, 0, this.nx - 1.001), fz = clamp((z - this.z0) / this.res, 0, this.nz - 1.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * this.nx + i;
    return lerp(lerp(arr[k], arr[k + 1], tx), lerp(arr[k + this.nx], arr[k + this.nx + 1], tx), tz);
  }
  at(x, z) { return this._bil(this.v, x, z); }
  along(x, z) { const fx = clamp(Math.round((x - this.x0) / this.res), 0, this.nx - 1), fz = clamp(Math.round((z - this.z0) / this.res), 0, this.nz - 1); return this.s[fz * this.nx + fx]; }
}

/** Resample a polyline to ~step metre spacing through a Catmull-Rom spline. */
export function spline(pts, step = 2) {
  let len = 0; for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const per = Math.max(2, Math.round(len / (pts.length - 1) / step));
  return catmull(pts, per);
}
/** point & tangent at arc length s along a dense polyline */
export function along(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (acc + L >= s || i === pts.length - 2) { const t = clamp((s - acc) / (L || 1), 0, 1); return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / (L || 1), dz: (bz - az) / (L || 1) }; }
    acc += L;
  }
  return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0 };
}
export function polyLength(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; }

/** Paint a long path in pieces (each piece gets a small bounding box → fast), with a worn centre. */
export function paintPath(g, pts, layer, width, { soft = 1.2, noise = 0.9, nscale = 2.5, wear = 0.55, amount = 1, piece = 6, wet = 0 } = {}) {
  for (let i = 0; i < pts.length - 1; i += piece) {
    const sub = pts.slice(i, Math.min(pts.length, i + piece + 1));
    if (sub.length < 2) continue;
    if (layer) g.paint(layer, S.line(sub, width), { soft, noise, nscale, amount });
    if (wear) g.info('wear', S.line(sub, width * 0.55), { soft: soft * 1.6, amount: wear, noise: noise * 0.7, nscale });
    if (wet) g.info('wet', S.line(sub, width * 0.3), { soft: soft, amount: wet, noise: noise, nscale: nscale * 0.7 });
  }
}
/** a polyline as a set of small line shapes (for nav blocking / painting long walls quickly) */
export function pieces(pts, width, piece = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i += piece) { const sub = pts.slice(i, Math.min(pts.length, i + piece + 1)); if (sub.length > 1) out.push(S.line(sub, width)); }
  return out;
}

// ------------------------------------------------------------------------------------------------ scatter
/** dart-throwing poisson scatter in box [x0, z0, x1, z1]; accept(x, z) → bool | number (probability) */
export function scatter(rng, box, minD, tries, accept = () => true, existing = null) {
  const [x0, z0, x1, z1] = box;
  const cs = minD / Math.SQRT2, gw = Math.max(1, Math.ceil((x1 - x0) / cs)), gh = Math.max(1, Math.ceil((z1 - z0) / cs));
  const grid = new Int32Array(gw * gh).fill(-1), out = [];
  const put = (x, z) => { const i = clamp(Math.floor((x - x0) / cs), 0, gw - 1), j = clamp(Math.floor((z - z0) / cs), 0, gh - 1); grid[j * gw + i] = out.length; out.push([x, z]); };
  const ok = (x, z) => {
    const i = Math.floor((x - x0) / cs), j = Math.floor((z - z0) / cs);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
      const k = grid[jj * gw + ii]; if (k < 0) continue;
      const p = out[k]; if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < minD * minD) return false;
    }
    return true;
  };
  if (existing) for (const [x, z] of existing) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) put(x, z);
  const n0 = out.length;
  for (let t = 0; t < tries; t++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (!ok(x, z)) continue;
    const a = accept(x, z);
    if (a === true || (typeof a === 'number' && rng.next() < a)) put(x, z);
  }
  return out.slice(n0);
}

// ------------------------------------------------------------------------------------------------ south-fade materials
/**
 * A kit material that also dissolves (dither) wherever it stands SOUTH of the player and above the player's head —
 * i.e. between the fixed iso camera and the hero. For tall walls and gatehouses the hero walks just north of (fortress
 * and castle courtyards). Shadows are unaffected (the depth pass ignores the patch).
 */
const FADE = {};
/** GLSL: dither-dissolve fragments south of / above the player ('south'), or close to the camera ('near': [far, near] m) */
export function fadeGLSL(mode, near = [4.5, 2.4]) {
  if (mode === 'near') return `{ float cdist = length(vWPos - cameraPosition); float nf = smoothstep(${near[0].toFixed(2)}, ${near[1].toFixed(2)}, cdist);
  if (nf > 0.01 && bayer4() < nf) discard; }`;
  return `{ vec3 dp = vWPos - uPlayerPos;
  float fs = smoothstep(1.0, 3.5, dp.z) * smoothstep(0.6, 2.2, dp.y - dp.z * 0.12) * smoothstep(17.0, 10.0, abs(dp.x)) * step(uPlayerPos.y, 900.0);
  if (fs > 0.01 && bayer4() < 0.92 * fs) discard; }`;
}
export function fadeMaterial(name, mode = 'south', near = [4.5, 2.4]) {
  const key = name + '|' + mode + (mode === 'near' ? near.join(',') : '');
  if (FADE[key]) return FADE[key];
  const base = kitMaterial(name);
  if (name === 'glow') return base;
  const m = base.clone();
  const ob = base.onBeforeCompile, bu = base.userData.u;
  m.onBeforeCompile = (sh, r) => {
    ob.call(base, sh, r);
    sh.uniforms.uPlayerPos = G.uPlayerPos;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uPlayerPos;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${fadeGLSL(mode, near)}`);
  };
  m.customProgramCacheKey = () => base.customProgramCacheKey() + '|fade:' + key;
  m.userData = { ...base.userData, u: bu, shared: true };
  FADE[key] = m;
  return m;
}

// ------------------------------------------------------------------------------------------------ kit with custom materials
/**
 * A Kit that also merges geometry drawn with custom materials (addC), chunked the same way, and builds small
 * animated parts (part(name) → { add(g, m, tint), build() → Mesh }) that are NOT merged (windmill sails, cannons…).
 */
export class FieldKit extends Kit {
  constructor(o = {}) { super(o); this.cb = new Map(); this.parts = []; this.fade = o.fade === true ? 'south' : (o.fade || null); this.near = o.near || [4.5, 2.4]; }
  add(mat, g, m, opts) {
    if (this.fade && mat !== 'glow') {
      const o = opts || {};
      const material = fadeMaterial(mat, this.fade, this.near);
      return this.addC(material, 'fade-' + mat, g, m, { ...o, cast: o.cast ?? !material.userData.noShadow });
    }
    if (FieldKit.debug) { const p = g.attributes.position.array; let bad = false; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) { bad = true; break; } if (bad || (m && m.elements.some(v => !Number.isFinite(v)))) console.warn('[fieldkit] NaN geometry', mat, new Error().stack.split('\n').slice(2, 5).join(' | ')); }
    return super.add(mat, g, m, opts);
  }
  addC(material, key, g, m, { tint = 0xffffff, ao = true, yGround = null, aoH = 2.5, jitter = 0.06, cast = true, chunkAt = null, extra = null } = {}) {
    const tx = chunkAt ? chunkAt[0] : m ? m.elements[12] : 0, tz = chunkAt ? chunkAt[1] : m ? m.elements[14] : 0;
    const cx = Math.floor(tx / this.chunk), cz = Math.floor(tz / this.chunk);
    const k = `${key}|${cast ? 1 : 0}|${cx},${cz}`;
    let e = this.cb.get(k);
    if (!e) { e = { material, cast, builder: new MeshBuilder(extra ? Object.entries(extra).map(([name, v]) => ({ name, size: Array.isArray(v) ? v.length : 1 })) : []), key }; this.cb.set(k, e); }
    const j = 1 + (this.rng.next() - 0.5) * jitter;
    const yg = yGround ?? (m ? m.elements[13] : 0);
    const base = typeof tint === 'function' ? null : Array.isArray(tint) ? tint : linColor(tint);
    const col = typeof tint === 'function' ? tint : ao ? (p) => { const f = clamp(0.5 + (p.y - yg) / aoH * 0.5, 0.5, 1) * j; return [base[0] * f, base[1] * f, base[2] * f]; } : [base[0] * j, base[1] * j, base[2] * j];
    e.builder.add(g, m, col, extra ? { extra } : {});
  }
  /** an unmerged animated sub-mesh drawn with a kit material */
  part(matName, { cast = true } = {}) {
    const b = new MeshBuilder(), material = kitMaterial(matName);
    const p = {
      add: (g, m, tint = 0xffffff, jitter = 0) => { const c = Array.isArray(tint) ? tint : linColor(tint); b.add(g, m, [c[0] * (1 + jitter), c[1] * (1 + jitter), c[2] * (1 + jitter)]); return p; },
      build: () => { const mesh = new THREE.Mesh(b.build(), material); mesh.castShadow = cast; mesh.receiveShadow = true; return mesh; },
    };
    return p;
  }
  build(parent) {
    const n = super.build(parent);
    let k = 0;
    for (const e of this.cb.values()) {
      if (!e.builder.count) continue;
      const mesh = new THREE.Mesh(e.builder.build(), e.material);
      mesh.castShadow = e.cast; mesh.receiveShadow = true; mesh.name = 'fkit-' + e.key; mesh.matrixAutoUpdate = false;
      parent.add(mesh); k++;
    }
    this.cb.clear();
    return n + k;
  }
}

// ------------------------------------------------------------------------------------------------ anchors
/** Anchor naming helpers bound to a zone. */
export class Anchors {
  constructor(zone) { this.zone = zone; this.n = {}; }
  add(name, x, z, f = 0, extra = null) { return this.zone.anchor(name, x, z, f, extra); }
  next(prefix, x, z, f = 0, extra = null) { const k = (this.n[prefix] = (this.n[prefix] || 0) + 1); return this.add(`${prefix}:${k}`, x, z, f, extra); }
  pack(x, z, r, tag, f = 0) { return this.next('pack', x, z, f, { r, tag }); }
  elite(x, z, tag, f = 0) { return this.next('elite', x, z, f, { r: 5, tag }); }
  node(skill, x, z, f = 0) { return this.next('node:' + skill, x, z, f, { skill }); }
  npc(id, x, z, f = 0) { return this.add('npc:' + id, x, z, f); }
  poi(name, x, z, f = 0, extra = null) { return this.add('poi:' + name, x, z, f, extra); }
}
/** move every anchor that sits on a blocked cell to the nearest walkable cell (warn if none within r) */
export function snapAnchors(zone, nav, r = 5, tag = 'fields') {
  for (const [name, a] of Object.entries(zone.anchors)) {
    if (nav.walkable(a.x, a.z)) continue;
    const p = nav.nearest(a.x, a.z, r);
    if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } else console.warn(`[${tag}] anchor off-nav`, name, a.x, a.z);
  }
}

// ------------------------------------------------------------------------------------------------ pip seeds
// Mirrors the hint wording of src/data/collectibles.js: seed i of a zone is "<WHERE> <spot>" with
//   spot = SPOTS[zone][i % n], WHERE[(i * 3 + floor(i / n) * 5 + zone.length) % 8]
const WHERE = ['On top of', 'Behind', 'Under', 'Inside', 'At the foot of', 'Beside', 'Above', 'Tucked into'];
/**
 * spots: [{ name, at: [[x, z], …] }] in hint order (the zone's SPOTS list). Returns [{ i, name, where, x, z }] for
 * count seeds: each spot's k-th use takes its k-th candidate position.
 */
export function seedSpots(zoneId, spots, count) {
  const used = new Map(), out = [];
  for (let i = 0; i < count; i++) {
    const sp = spots[i % spots.length], k = used.get(sp.name) || 0; used.set(sp.name, k + 1);
    const [x, z] = sp.at[k % sp.at.length];
    out.push({ i: i + 1, name: sp.name, where: WHERE[(i * 3 + Math.floor(i / spots.length) * 5 + zoneId.length) % WHERE.length], x, z });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ water env
/** keep a water plane's own palette under env changes: sky reflection = dimmed fog/hemi mix, sun glint from the env */
export function waterEnv(w, env, { sky = 0.6, sun = 1 } = {}) {
  const u = w.userData.u; if (!u) return;
  u.uSky.value.set(env.fogColor).lerp(new THREE.Color(env.hemiSky), 0.5).multiplyScalar(sky);
  u.uSunCol.value.set(env.sunColor).multiplyScalar(Math.min(1.2, env.sunIntensity / 3) * sun);
}

// ------------------------------------------------------------------------------------------------ misc
/** smooth bump: 1 at the centre, 0 at radius r (cosine falloff) */
export const bump = (x, z, cx, cz, r) => { const d = Math.hypot(x - cx, z - cz) / r; return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI); };
/** ellipse bump with rotation */
export const ebump = (x, z, cx, cz, rx, rz, rot = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dz = z - cz;
  const lx = (c * dx - s * dz) / rx, lz = (s * dx + c * dz) / rz, d = Math.hypot(lx, lz);
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI);
};
export const hexMix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
export { S, RNG, clamp, smoothstep, lerp };
