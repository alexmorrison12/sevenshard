// Rock & terrain dressing for arenas and dungeons (merged into a Kit unless noted):
//   islandSkirt(kit, poly, hAt, opts)   the jagged rocky underside of a floating island (strata + AO in vertex colours)
//   cliffRing(kit, pts, hAt, opts)      a displaced rock wall along a polyline (arena rims, ice cliffs)
//   boulder(kit, x, y, z, opts)         faceted rocks;  spike(kit, …) curved demonic spikes / horns;  crystal(kit, …)
//   buildFloaters(list, opts)           instanced floating rocks that bob and turn slowly (one draw call)
//   buildVoidFloor(opts)                an animated nebula far below the islands (abyss depth for the void)
import * as THREE from 'three';
import { RNG, Simplex, clamp, smoothstep } from '../core/noise.js';
import { MeshBuilder, blob, tube, linColor } from '../engine/geom.js';
import { lambert, G } from '../engine/materials.js';
import { M, kitMaterial, cutV, cutF } from './kit.js';
import { noiseTex } from './textures.js';
import { circle } from './shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** resample a closed polygon to roughly `step` metre spacing */
function resample(poly, step, closed = true) {
  const out = [];
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.round(L / step));
    for (let j = 0; j < k; j++) out.push([ax + (bx - ax) * j / k, az + (bz - az) * j / k]);
  }
  if (!closed) out.push(poly[poly.length - 1].slice());
  return out;
}

/**
 * Underside of a floating island: from the outline (at ground height) down to a jagged point `depth` below.
 * opts: { depth, seed, tint (hex), strata (hex), lip (outward overhang m), rings }
 */
export function islandSkirt(kit, poly, hAt, { depth = 22, seed = 1, tint = 0x5a4a5e, strata = 0x3a2e40, glow = null, lip = 0.8, rings = 12, step = 1.6 } = {}) {
  const nz = new Simplex(seed), rng = new RNG(seed);
  const pts = resample(poly, step);
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  const N = pts.length, pos = [], idx = [], col = [], uv = [];
  const cT = linColor(tint), cS = linColor(strata), cG = glow != null ? linColor(glow) : null;
  const tipY = Math.min(...pts.map(([x, z]) => hAt(x, z))) - depth;
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;                          // 0 top edge → 1 tip
    for (let i = 0; i <= N; i++) {
      const [px, pz] = pts[i % N];
      const dx = px - cx, dz = pz - cz, L = Math.hypot(dx, dz) || 1;
      const ang = Math.atan2(dz, dx);
      // radius shrinks with depth (with bulges and gullies), the top ring pushes out as a lip
      const gully = nz.noise2(Math.cos(ang) * 3 + seed, Math.sin(ang) * 3) * 0.25 + nz.noise2(ang * 5, t * 3) * 0.12;
      // profile: a short lip, a near-vertical cliff face (~4 m), then the long taper to the tip
      const T1 = 0.06, T2 = 0.3;
      const face = 4.2 + nz.noise2(ang * 3, 5) * 1.2;
      const y0 = hAt(px, pz) + 0.05;
      let shrink, yy;
      if (t < T1) { shrink = 1 + lip / L * (1 - t / T1); yy = y0 - t / T1 * 0.4; }
      else if (t < T2) { const u = (t - T1) / (T2 - T1); shrink = 1 + (lip * 0.6 - u * 1.2) / L + gully * 0.05; yy = y0 - 0.4 - u * face; }
      else { const u = (t - T2) / (1 - T2); shrink = Math.pow(1 - u, 0.8) * (1 - 1.2 / L) * (1 + gully * u); yy = y0 - 0.4 - face - u * (y0 - 0.4 - face - tipY) * (1 + nz.noise2(ang * 4 + 7, 2) * 0.15); }
      const rr = Math.max(0.02, shrink);
      const jx = nz.noise3(px * 0.3, yy * 0.25, pz * 0.3) * 0.9 * t, jz = nz.noise3(px * 0.3 + 11, yy * 0.25, pz * 0.3) * 0.9 * t;
      pos.push(cx + dx * rr + jx, yy, cz + dz * rr + jz);
      uv.push(i / N * 8, t * 4);
      const band = 0.5 + 0.5 * Math.sin(yy * 1.7 + nz.noise2(ang * 2, yy * 0.2) * 2.5);
      let c = lerpC(cT, cS, band * 0.7);
      c = c.map(v => v * (1 - t * 0.55));   // darker toward the tip (AO)
      if (cG && t > 0.06) { const gl = smoothstep(0.62, 0.92, nz.noise2(ang * 6, yy * 0.4)) * 0.9 + (t < 0.12 ? 0.35 : 0); c = lerpC(c, cG.map(v => v * 2.2), Math.min(1, gl)); }
      col.push(...c);
    }
  }
  for (let r = 0; r < rings; r++) for (let i = 0; i < N; i++) {
    const a = r * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // tint via the builder: per-vertex colours are baked above → pass as a colour fn reading the attribute
  const colAttr = col;
  kit.add('rock', g, null, { tint: (p, n, i) => [colAttr[i * 3], colAttr[i * 3 + 1], colAttr[i * 3 + 2]], chunkAt: [cx, cz], cast: false });
  // stalactites hanging from the underside
  for (let k = 0; k < Math.round(N / 5); k++) {
    const i = rng.int(0, N - 1), [px, pz] = pts[i];
    const t = rng.range(0.25, 0.6), dx = px - cx, dz = pz - cz;
    const rr = Math.pow(1 - (t - 0.08) / 0.92, 0.75) * 0.9;
    const y0 = hAt(px, pz) - 0.5 - (t - 0.08) / 0.92 * (hAt(px, pz) - 0.5 - tipY);
    const len = rng.range(3, 8);
    kit.add('rock', tube([V(cx + dx * rr, y0, cz + dz * rr), V(cx + dx * rr * 1.02, y0 - len * 0.6, cz + dz * rr * 1.02), V(cx + dx * rr * 0.98, y0 - len, cz + dz * rr * 0.98)], [rng.range(0.8, 1.6), 0.5, 0.05], 6, false), null, { tint: strata, cast: false, chunkAt: [cx, cz] });
  }
  return { cx, cz, tipY };
}

/**
 * Rock wall along a polyline. The wall rises from the ground to base+height, leaning back (away from `inside`).
 * opts: { height, thick, seed, tint, top (hex, e.g. snow), inside: [x,z] (arena centre), step, closed, mat }
 */
export function cliffRing(kit, pts0, hAt, { height = 8, heightFn = null, thick = 5, seed = 1, tint = 0x7a7068, strata = 0x5a524c, top = null, inside = [0, 0], step = 1.5, closed = true, lean = 0.35, mat = 'rock', jag = 1.6 } = {}) {
  const nz = new Simplex(seed);
  const pts = resample(pts0, step, closed);
  const N = pts.length, R = 7;
  const pos = [], idx = [], col = [], uv = [];
  const boost = (c) => c;
  const cT = boost(linColor(tint)), cS = boost(linColor(strata)), cTop = top != null ? linColor(top).map(v => v * 1.15) : null;
  for (let i = 0; i <= (closed ? N : N - 1); i++) {
    const [px, pz] = pts[i % N];
    // outward direction = away from the arena centre
    let ox = px - inside[0], oz = pz - inside[1]; const L = Math.hypot(ox, oz) || 1; ox /= L; oz /= L;
    const y0 = hAt(px, pz) - 1.5;
    const hh = (heightFn ? heightFn(px, pz) : height) * (1 + nz.noise2(px * 0.07, pz * 0.07) * 0.35) + nz.noise2(px * 0.4, pz * 0.4) * jag;
    for (let r = 0; r <= R; r++) {
      const t = r / R;
      // profile: rise steeply, then fold back over the top (thick) → a rounded crest
      const up = t < 0.75 ? t / 0.75 : 1;
      const back = t < 0.75 ? up * up * lean * hh * 0.35 : lean * hh * 0.35 + (t - 0.75) / 0.25 * thick;
      const y = y0 + (t < 0.75 ? up * (hh + 1.5) : hh + 1.5 - (t - 0.75) / 0.25 * 0.6);
      const jx = nz.noise3(px * 0.25, y * 0.3, pz * 0.25) * 1.1, jz = nz.noise3(px * 0.25 + 9, y * 0.3, pz * 0.25) * 1.1, jy = nz.noise3(px * 0.2, y * 0.2 + 4, pz * 0.2) * 0.5;
      pos.push(px + ox * back + jx * (0.3 + t), y + jy, pz + oz * back + jz * (0.3 + t));
      uv.push(i * 0.3, t * 3);
      const band = 0.5 + 0.5 * Math.sin(y * 1.5 + nz.noise2(px * 0.1, pz * 0.1) * 3);
      let c = lerpC(cT, cS, band * 0.6);
      c = c.map(v => v * (0.55 + 0.45 * smoothstep(0, 0.5, t)));
      if (cTop) c = lerpC(c, cTop, smoothstep(0.7, 0.85, t) * 0.95);
      col.push(...c);
    }
  }
  const cols = closed ? N + 1 : N;
  for (let i = 0; i < cols - 1; i++) for (let r = 0; r < R; r++) {
    const a = i * (R + 1) + r, b = a + R + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // orient outward-facing (flip if the winding came out inward)
  const nAttr = g.attributes.normal; let dot = 0;
  for (let i = 0; i < Math.min(40, pos.length / 3); i++) { const k = i * 3; dot += nAttr.getX(i) * (inside[0] - pos[k]) + nAttr.getZ(i) * (inside[1] - pos[k + 2]); }
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  const colAttr = col;
  // split into chunks by x so frustum culling still works for long rings
  kit.add(mat, g, null, { tint: (p, n, i) => [colAttr[i * 3], colAttr[i * 3 + 1], colAttr[i * 3 + 2]], chunkAt: [inside[0], inside[1]] });
  return pts;
}

export function boulder(kit, x, y, z, { s = 1, seed = 1, tint = 0x7a7068, moss = null, snow = null, flat = 0.7, block = true, mat = 'rock' } = {}) {
  const nz = new Simplex(seed);
  const g = blob(1, 1, d => 1 + nz.noise3(d.x * 1.6, d.y * 1.6, d.z * 1.6) * 0.3, [1.2, flat, 1]).toNonIndexed();
  g.computeVertexNormals();
  const base = linColor(tint), mc = moss != null ? linColor(moss) : null, sc = snow != null ? linColor(snow) : null;
  kit.add(mat, g, M(x, y + 0.1 * s, z, seed, s, s, s), { tint: (p, n) => { let c = base.map(v => v * (0.75 + clamp(p.y - y, 0, 2 * s) / (2 * s) * 0.35)); if (mc) c = lerpC(c, mc, smoothstep(0.55, 0.85, n.y) * 0.8); if (sc) c = lerpC(c, sc, smoothstep(0.45, 0.75, n.y)); return c; } });
  if (block && s > 0.6) kit.block(circle(x, z, s * 1.05), 0.3);
}
/** curved horn/spike rising from the ground; mat 'dark' (glowing cracks), 'bone' or 'rock' */
export function spike(kit, x, y, z, { h = 5, r = 0.6, bend = 1.2, dir = 0, mat = 'dark', tint = 0x9a8a90, block = true, seg = 7 } = {}) {
  const dx = Math.cos(dir), dz = Math.sin(dir), pts = [], radii = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pts.push(V(x + dx * bend * t * t, y - 0.4 + h * t, z + dz * bend * t * t));
    radii.push(r * (1 - t * 0.92) * (i === 0 ? 1.25 : 1));
  }
  kit.add(mat, tube(pts, radii, 8, true), null, { tint, yGround: y, aoH: h * 0.4, chunkAt: [x, z] });
  if (block) kit.block(circle(x, z, r * 1.1), 0.25);
}
/** glowing crystal cluster (HDR colour) */
export function crystal(kit, x, y, z, { s = 1, color = 0xc060ff, intensity = 2.6, n = 5, seed = 1, light = true, block = true } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const g = new THREE.OctahedronGeometry(0.35, 0); g.scale(0.55, 2.2, 0.55);
    const a = r.range(0, Math.PI * 2), d = i === 0 ? 0 : r.range(0.25, 0.6) * s;
    const sc = (i === 0 ? 1.4 : r.range(0.6, 1.1)) * s;
    kit.glow(g, M(x + Math.cos(a) * d, y + 0.5 * sc, z + Math.sin(a) * d, r.range(0, 6), sc, sc, sc, r.range(-0.4, 0.4), r.range(-0.4, 0.4)), color, intensity * r.range(0.8, 1.1));
  }
  kit.add('rock', blob(0.45 * s, 0, null, [1.3, 0.5, 1.3]), M(x, y, z), { tint: 0x3a3040, ao: false, cast: false });
  if (light) kit.light(x, y + 1.2 * s, z, color, 4 * s, 8 * s, 0.1);
  if (block) kit.block(circle(x, z, 0.6 * s), 0.25);
}

/** instanced floating rocks: list [{ x, y, z, s, seed }] — bob & turn slowly */
export function buildFloaters(list, { tint = 0x4a3e52, glow = null } = {}) {
  if (!list.length) return null;
  const nz = new Simplex(77);
  const b = new MeshBuilder();
  const g0 = blob(1, 1, d => 1 + nz.noise3(d.x * 1.8, d.y * 1.8, d.z * 1.8) * 0.35, [1.2, 0.75, 1]);
  const base = linColor(tint), gc = glow != null ? linColor(glow) : null;
  b.add(g0, null, (p, n) => { let c = base.map(v => v * (0.55 + clamp(n.y * 0.5 + 0.5, 0, 1) * 0.6)); if (gc && p.y < -0.45) c = lerpC(c, gc, 0.6); return c; });
  // a stalactite tail under each floater
  b.add(tube([V(0, -0.5, 0), V(0.1, -1.4, 0.05), V(0, -2.2, 0)], [0.6, 0.3, 0.02], 6, false), null, base.map(v => v * 0.5));
  const geo = b.build();
  const mat = lambert({ vertexColors: true }, {
    wrap: 0.4, key: 'floaters', uniforms: { uPlayerPos: G.uPlayerPos },
    vertex: vs => cutV(vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float a = sin(uTime * 0.15 + ph) * 0.25;
        float c = cos(a), s = sin(a);
        transformed.xz = mat2(c, -s, s, c) * transformed.xz;
        transformed.y += sin(uTime * 0.6 + ph * 3.0) * 0.35; }`)),
    fragment: fs => cutF(fs),
  });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((f, i) => { q.setFromEuler(new THREE.Euler(0, f.seed ?? i, 0)); s.setScalar(f.s); p.set(f.x, f.y, f.z); m.compose(p, q, s); im.setMatrixAt(i, m); });
  im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'floaters';
  return im;
}

/** Nebula floor far below the islands: swirling violet/crimson clouds with bright filaments. */
export function buildVoidFloor({ x = 0, z = 0, y = -45, size = 700, c1 = 0x2a0a3a, c2 = 0x8a1a5a, c3 = 0xff6ad0, bg = 0x12061a } = {}) {
  const g = new THREE.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uC3: { value: new THREE.Color(c3) }, uBg: { value: new THREE.Color(bg) }, uCenter: { value: new THREE.Vector2(x, z) }, uSize: { value: size } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uC1, uC2, uC3, uBg; uniform vec2 uCenter; uniform float uSize;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz;
        vec2 fl = vec2(uTime * 0.003, -uTime * 0.002);
        float a = texture2D(uNoise, p / 420.0 + fl).r;
        float b = texture2D(uNoise, p / 190.0 - fl * 1.3 + a * 0.2).g;
        float cloud = smoothstep(0.25, 0.85, a * 0.65 + b * 0.45);
        vec3 col = mix(uC1, uC2, cloud * cloud);
        float fil = smoothstep(0.035, 0.0, abs(b - 0.55)) * smoothstep(0.45, 0.75, a);
        col += uC3 * fil * 0.8;
        float e = length(p - uCenter) / (uSize * 0.5);
        col = mix(col, uBg, smoothstep(0.3, 0.9, e));
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.renderOrder = -10; m.name = 'void-floor';
  return m;
}

/** Drifting abyss mist: stacked transparent layers below the islands (parallax depth into the void). */
export function buildAbyssMist({ x = 0, z = 0, size = 500, layers = [-10, -20, -34], color = 0x2a0e36, glow = 0x6a1a5a, alpha = 0.45 } = {}) {
  const grp = new THREE.Group(); grp.name = 'abyss-mist';
  layers.forEach((y, i) => {
    const g = new THREE.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uC: { value: new THREE.Color(color) }, uG: { value: new THREE.Color(glow) }, uA: { value: alpha * (1 - i * 0.12) }, uK: { value: 1 + i * 0.7 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime, uA, uK; uniform sampler2D uNoise; uniform vec3 uC, uG; varying vec3 vW;
        void main(){ vec2 p = vW.xz / (240.0 * uK) + vec2(uTime * 0.004 * uK, uTime * 0.003);
          float n = texture2D(uNoise, p).r;
          float a = smoothstep(0.3, 0.8, n) * uA;
          vec3 col = mix(uC, uG, smoothstep(0.5, 0.9, n) * 0.5);
          gl_FragColor = vec4(col, a); }`,
      transparent: true, depthWrite: false,
    });
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.renderOrder = -5 + i; grp.add(m);
  });
  return grp;
}

/** Void energy seeping up an island's cliff edge: an additive ribbon hugging the outline (one draw call per zone). */
export function buildRimGlow(polys, hAt, { color = 0xd040ff, height = 5, below = 5.5, step = 1.2, intensity = 1.6 } = {}) {
  const pos = [], uv = [], idx = [];
  for (const poly of polys) {
    const pts = resample(poly, step);
    let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
    const base = pos.length / 3, N = pts.length;
    for (let i = 0; i <= N; i++) {
      const [px, pz] = pts[i % N], dx = px - cx, dz = pz - cz, L = Math.hypot(dx, dz) || 1;
      const ox = dx / L * 1.3, oz = dz / L * 1.3, y = hAt(px, pz);
      pos.push(px + ox, y - below, pz + oz, px + ox * 0.6, y + height - below, pz + oz * 0.6);
      uv.push(i * step / 6, 0, i * step / 6, 1);
    }
    for (let i = 0; i < N; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  const c = new THREE.Color(color).multiplyScalar(intensity);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uNoise: { value: noiseTex() }, uC: { value: c } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; uniform vec3 uC; varying vec2 vUv;
      void main(){ float n = texture2D(uNoise, vec2(vUv.x * 0.7, vUv.y * 0.35 - uTime * 0.06)).g;
        float n2 = texture2D(uNoise, vec2(vUv.x * 2.1 + 0.4, vUv.y * 0.8 - uTime * 0.14)).b;
        float a = pow(max(1.0 - vUv.y, 0.0), 1.6) * (0.35 + 0.65 * smoothstep(0.3, 0.8, n * 0.6 + n2 * 0.5));
        gl_FragColor = vec4(uC * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 4; m.name = 'rim-glow';
  return m;
}
