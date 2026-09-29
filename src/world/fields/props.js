// Field prop & building library (merged into a FieldKit; local +Z = front, rot about +Y as in props.js).
// Natural: rockCluster, stump, log, cliffEdge, standingStone, bushes via flora.
// Rural:   cottage (timber-framed, thatched), barn, windmill (animated sails), stoneBridge (walkable deck), dryWall,
//          hayBale, haystack, scarecrow, beehive, signpost, shrine, lanternPost, woodpile, trough, wagon (hay).
// Camps:   tent, palisade, campfire, lookout (wooden tower), ruinTower, ruinWall, archRuin, gravestone.
import * as THREE from 'three';
import { RNG, Simplex, clamp, smoothstep } from '../../core/noise.js';
import { blob, tube, linColor } from '../../engine/geom.js';
import { box, walls, cyl, cone, sphere, gableRoof, hipRoof, M, Frame, extrude, archPanel } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { boulder, cliffRing } from '../cliffs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** facade faces north (the fixed camera never sees it)? */
const hidden = (F, ldx, ldz) => (-ldx * F.s + ldz * F.c) < -0.35;
const roofSpot = (kit, x, z, w, d, rot, color) => (kit.spots.roofs ||= []).push({ rect: [x, z, w, d, rot], color });

// ------------------------------------------------------------------------------------------------ natural
const ROCKG = new Map();
function rockGeo(seed, detail = 1) {
  const k = seed % 6 + ':' + detail;
  if (!ROCKG.has(k)) { const nz = new Simplex(seed % 6 + 11); const g = blob(1, detail, d => 1 + nz.noise3(d.x * 1.5, d.y * 1.5, d.z * 1.5) * 0.28 + nz.noise3(d.x * 4, d.y * 4, d.z * 4) * 0.06, [1.2, 1, 1]).toNonIndexed(); g.computeVertexNormals(); ROCKG.set(k, g); }
  return ROCKG.get(k);
}
/** boulder with controllable moss and a sun-bleached top (lighter than cliffs.boulder) */
export function rock(kit, x, y, z, { s = 1, seed = 1, tint = 0x9a9284, moss = 0x7a8a4a, mossAmt = 0.35, flat = 0.7, block = true, mat = 'rock', rot = null, bury = 0.2 } = {}) {
  const base = linColor(tint), mc = moss != null ? linColor(moss) : null, top = base.map(v => Math.min(1, v * 1.22));
  kit.add(mat, rockGeo(seed), M(x, y + (flat - bury) * s * 0.9, z, rot ?? seed * 1.7, s, s * flat, s), { tint: (p, n) => {
    const t = clamp((p.y - y) / (1.6 * s * flat), 0, 1);
    let c = lerpC(base.map(v => v * 0.72), top, t * 0.8 + clamp(n.y, 0, 1) * 0.2);
    if (mc) c = lerpC(c, mc, smoothstep(0.62, 0.9, n.y) * mossAmt);
    return c;
  } });
  if (block && s > 0.55) kit.block(S.circle(x, z, s * 1.1), 0.3);
}
/** a cluster of 2–5 boulders around (x, z); H = heightAt */
export function rockCluster(kit, x, z, H, { n = 3, s = 1, seed = 1, tint = 0x9e9688, moss = 0x7a8a4a, spread = 1.4, flat = 0.7, block = true, mat = 'rock' } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = r.range(0, TAU), d = i === 0 ? 0 : r.range(0.6, 1.2) * spread * s, sc = (i === 0 ? 1 : r.range(0.35, 0.7)) * s;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    rock(kit, px, H(px, pz), pz, { s: sc, seed: seed * 7 + i, tint, moss, mossAmt: 0.3, flat: flat * r.range(0.8, 1.2), block: block && sc > 0.5, mat });
  }
}
export function stump(kit, x, y, z, { r = 0.45, h = 0.6, seed = 1, tint = 0x7a5a3a, moss = true } = {}) {
  const rng = new RNG(seed);
  kit.add('timber', cyl(r * 0.92, r * 1.15, h, 10, 1), M(x, y + h / 2 - 0.05, z, rng.range(0, 6)), { tint, yGround: y });
  kit.add('planks', cyl(r * 0.9, r * 0.9, 0.04, 10, 1), M(x, y + h - 0.03, z), { tint: 0xc8a070, ao: false });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + rng.range(-0.3, 0.3); kit.add('timber', tube([V(x + Math.cos(a) * r * 0.6, y + 0.25, z + Math.sin(a) * r * 0.6), V(x + Math.cos(a) * r * 1.4, y - 0.05, z + Math.sin(a) * r * 1.4)], [0.16 * r / 0.45, 0.05], 5, true), null, { tint, ao: false, chunkAt: [x, z] }); }
  if (moss) kit.add('paint', blob(r * 0.5, 1, null, [1.4, 0.3, 1.2]), M(x + r * 0.3, y + h * 0.4, z + r * 0.5), { tint: 0x4a6a24, ao: false, cast: false });
  kit.block(S.circle(x, z, r * 1.1), 0.25);
}
/** fallen log from (x, z) along rot (local X), length len */
export function log(kit, x, y, z, rot, { len = 4, r = 0.35, tint = 0x6a4a30, moss = 0x4a6a22, block = true, hollow = false } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('timber', cyl(r, r * 1.05, len, 10, 1, hollow), F.at(0, r * 0.8, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint, ao: false });
  for (const s of [-1, 1]) kit.add('planks', cyl(r * 0.95, r * 0.95, 0.03, 10, 1), F.at(s * len / 2, r * 0.8, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0xb89060, ao: false, cast: false });
  if (moss != null) kit.add('paint', blob(r, 1, null, [len * 0.42 / r, 0.35, 0.9]), F.at(0, r * 1.45, 0), { tint: moss, ao: false, cast: false });
  if (block) kit.block(S.rect(x, z, len, r * 2.2, rot), 0.25);
}
/** rock face along an open polyline (natural boundary). inside = a point on the playable side. */
export function cliffEdge(kit, pts, H, { height = 7, thick = 5, seed = 1, tint = 0x8a8074, strata = 0x6a6258, top = 0x5a7a30, inside = [0, 0], step = 1.6, lean = 0.3, jag = 1.4, mat = 'rock' } = {}) {
  return cliffRing(kit, pts, H, { height, thick, seed, tint, strata, top, inside, step, closed: false, lean, jag, mat });
}
export function standingStone(kit, x, y, z, { h = 3, w = 1, rot = 0, tint = 0x8a8478, glyph = null, lean = 0, block = true } = {}) {
  const g = blob(1, 1, d => 1 + Math.sin(d.x * 5 + d.y * 3) * 0.05, [w * 0.55, h * 0.5, w * 0.35]).toNonIndexed(); g.computeVertexNormals();
  kit.add('rock', g, M(x, y + h * 0.42, z, rot, 1, 1, 1, lean, 0), { tint, yGround: y, aoH: h });
  if (glyph != null) kit.glow(box(w * 0.18, h * 0.35, 0.04, 1), M(x + Math.sin(rot) * w * 0.34, y + h * 0.5, z + Math.cos(rot) * w * 0.34, rot), glyph, 2.4);
  if (block) kit.block(S.circle(x, z, w * 0.55), 0.3);
}

/** dolmen: a heavy capstone resting on three uprights (old altar) */
export function dolmen(kit, x, y, z, rot = 0, { s = 1, tint = 0xb0a898, glyph = null } = {}) {
  const F = new Frame(x, y, z, rot);
  for (const [lx, lz, hh] of [[-1.1, -0.5, 1.35], [1.1, -0.45, 1.3], [0.05, 0.75, 1.25]]) {
    const g = blob(1, 1, d => 1 + Math.sin(d.x * 5 + d.y * 3 + lx) * 0.06, [0.42 * s, hh * 0.5 * s, 0.34 * s]).toNonIndexed(); g.computeVertexNormals();
    kit.add('rock', g, F.at(lx * s, hh * 0.45 * s, lz * s, lx), { tint, yGround: y, aoH: 1.5 });
  }
  const cap = blob(1, 1, d => 1 + Math.sin(d.x * 4 + d.z * 3) * 0.08, [1.9 * s, 0.36 * s, 1.35 * s]).toNonIndexed(); cap.computeVertexNormals();
  kit.add('rock', cap, F.at(0, 1.45 * s, 0.05, 0.2), { tint: new THREE.Color(tint).multiplyScalar(1.08).getHex() });
  if (glyph != null) kit.glow(cyl(0.3 * s, 0.3 * s, 0.03, 12, 1), F.at(0, 1.83 * s, 0.1), glyph, 1.6);
  kit.block(S.circle(x, z, 1.7 * s), 0.3);
}

// ------------------------------------------------------------------------------------------------ rural buildings
const WALL_P = [0xf2e6cc, 0xeee0c2, 0xf6ecd6, 0xe8dcc0];
const SHUT = [0x5a7a4a, 0x3a5a8a, 0x8a3a2a, 0x6a5a3a, 0x3a6a6a];
function smallWindow(kit, F, lx, ly, lz, ry, { w = 0.75, h = 0.85, shutter = 0x5a7a4a, box: flowers = false, seed = 1 } = {}) {
  const fr = F.at(lx, ly, lz, ry), mul = m => fr.clone().multiply(m);
  kit.add('window', box(w, h, 0.06, w), mul(M(0, 0, 0.02)), { ao: false });
  kit.add('timber', box(w + 0.2, 0.12, 0.16, 1), mul(M(0, h / 2 + 0.06, 0.06)), { ao: false, tint: 0x5a3a24 });
  kit.add('timber', box(w + 0.26, 0.1, 0.22, 1), mul(M(0, -h / 2 - 0.05, 0.08)), { ao: false, tint: 0x5a3a24 });
  kit.add('timber', box(0.06, h, 0.05, 1), mul(M(0, 0, 0.06)), { ao: false, tint: 0x4a3020 });
  if (shutter) for (const s of [-1, 1]) kit.add('planks', box(w * 0.5, h, 0.05, 0.6), mul(M(s * (w * 0.75 + 0.05), 0, 0.07, s * 0.1)), { tint: shutter, ao: false });
  if (flowers) P.flowerBox(kit, { at: (a, b, c) => mul(M(a, b, c)) }, 0, -h / 2 - 0.2, 0.22, w + 0.1, seed);
}
function plankDoor(kit, F, lx, lz, ry, { w = 1.05, h = 2.0, tint = 0x6a4428, y = 0 } = {}) {
  const fr = F.at(lx, y, lz, ry), mul = m => fr.clone().multiply(m);
  kit.add('planks', box(w, h, 0.1, 0.8), mul(M(0, h / 2, 0.03)), { tint, ao: false });
  for (const s of [-1, 1]) kit.add('timber', box(0.16, h + 0.1, 0.18, 1), mul(M(s * (w / 2 + 0.08), h / 2, 0.06)), { ao: false, tint: 0x4a3020 });
  kit.add('timber', box(w + 0.4, 0.18, 0.2, 1), mul(M(0, h + 0.08, 0.06)), { ao: false, tint: 0x4a3020 });
  for (const yy of [0.4, 1.5]) kit.add('metal', box(w * 0.7, 0.05, 0.03, 1), mul(M(-w * 0.1, yy, 0.09)), { tint: 0x2a2624, ao: false });
  kit.add('metal', sphere(0.045, 6, 4), mul(M(w * 0.32, h * 0.5, 0.1)), { tint: 0xa08040, ao: false });
  kit.add('stone', box(w + 0.5, 0.14, 0.5, 1), mul(M(0, 0.03, 0.3)), { tint: 0xb8b0a0, ao: false });
}
/**
 * Timber-framed cottage with a thatched (or tiled) roof. o: { w, d, h (wall height), roof: 'thatch'|'tiles'|'slate',
 * roofTint, plaster, shutter, chimney, porch, seed, sign (hex: an inn sign), burnt (0..1 scorched), noDoor, lean }
 * Returns { F, chimney: [x, y, z] | null, top }.
 */
export function cottage(kit, x, y, z, rot, o = {}) {
  const r = new RNG(o.seed ?? Math.round(x * 7.3 + z * 13.1));
  const w = o.w ?? 6, d = o.d ?? 5, h = o.h ?? 3.0, F = new Frame(x, y, z, rot);
  const burnt = o.burnt ?? 0;
  const plaster = o.plaster ?? r.pick(WALL_P), shutter = o.shutter ?? r.pick(SHUT);
  const dark = (hex) => burnt ? new THREE.Color(hex).lerp(new THREE.Color(0x1a1412), burnt * 0.8).getHex() : hex;
  const beam = dark(o.beam ?? 0x4a3020);
  const fH = hidden(F, 0, 1), bH = hidden(F, 0, -1), lH = hidden(F, -1, 0), rH = hidden(F, 1, 0);
  // plinth + stone course + plaster walls
  kit.add('stone', box(w + 0.3, 0.7, d + 0.3, 1.5), F.at(0, 0.05, 0), { tint: dark(0xb8ad98), yGround: y - 0.3 });
  kit.add('stone', walls(w, 1.0, d, 1.5), F.at(0, 0.8, 0), { tint: dark(0xcfc4ae), yGround: y, aoH: 2 });
  kit.add('plaster', walls(w - 0.04, h - 1.0, d - 0.04, 2.4), F.at(0, 1.3 + (h - 1.0) / 2, 0), { tint: dark(plaster), ao: false });
  // timber frame on the visible faces: corner posts, sill & top beams, braces
  const T = 0.18;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', box(T, h - 1.0 + 0.1, T, 1), F.at(sx * (w / 2 - 0.05), 1.3 + (h - 1.0) / 2, sz * (d / 2 - 0.05)), { tint: beam, ao: false });
  const faces = [
    { hid: fH, len: w, at: (u, yy, rz = 0) => F.at(u, yy, d / 2 + 0.03, 0, 1, 1, 1, 0, rz), place: (u) => [u, d / 2 + 0.01, 0] },
    { hid: bH, len: w, at: (u, yy, rz = 0) => F.at(-u, yy, -d / 2 - 0.03, Math.PI, 1, 1, 1, 0, rz), place: (u) => [-u, -d / 2 - 0.01, Math.PI] },
    { hid: rH, len: d, at: (u, yy, rz = 0) => F.at(w / 2 + 0.03, yy, -u, Math.PI / 2, 1, 1, 1, 0, rz), place: (u) => [w / 2 + 0.01, -u, Math.PI / 2] },
    { hid: lH, len: d, at: (u, yy, rz = 0) => F.at(-w / 2 - 0.03, yy, u, -Math.PI / 2, 1, 1, 1, 0, rz), place: (u) => [-w / 2 - 0.01, u, -Math.PI / 2] },
  ];
  faces.forEach((fc, fi) => {
    if (fc.hid) return;
    kit.add('timber', box(fc.len, T, 0.1, 1), fc.at(0, 1.35, 0), { tint: beam, ao: false });
    kit.add('timber', box(fc.len, T, 0.1, 1), fc.at(0, h - 0.05, 0), { tint: beam, ao: false });
    const n = Math.max(1, Math.round(fc.len / 1.7));
    for (let i = 1; i < n; i++) kit.add('timber', box(0.14, h - 1.3, 0.1, 1), fc.at(-fc.len / 2 + fc.len * i / n, 1.3 + (h - 1.3) / 2, 0), { tint: beam, ao: false });
    // diagonal braces in the end bays
    const bw = fc.len / n, bh = h - 1.45, ang = Math.atan2(bh, bw);
    for (const s of [-1, 1]) kit.add('timber', box(Math.hypot(bw, bh) * 0.92, 0.12, 0.1, 1), fc.at(s * (fc.len / 2 - bw / 2), 1.35 + bh / 2, 0, s * ang), { tint: beam, ao: false });
    // openings
    const nw = Math.max(1, Math.floor((fc.len - 0.6) / 2.2));
    for (let i = 0; i < nw; i++) {
      const u = -fc.len / 2 + fc.len * (i + 0.5) / nw;
      const [lx, lz, ry] = fc.place(u);
      if (fi === 0 && i === Math.floor(nw / 2) && !o.noDoor) { plankDoor(kit, F, lx, lz, ry, { tint: dark(o.door ?? 0x6a4428) }); continue; }
      if (!burnt || r.chance(0.5)) smallWindow(kit, F, lx, 1.95, lz, ry, { shutter: fi < 2 ? dark(shutter) : null, box: fi === 0 && !burnt && r.chance(0.7), seed: r.int(0, 999) });
    }
  });
  // roof
  const ridgeX = (o.ridge ?? (w >= d ? 'x' : 'z')) === 'x';
  const span = ridgeX ? d : w, len = ridgeX ? w : d, rise = span * (o.pitch ?? 0.62);
  const roofMat = o.roof ?? 'thatch';
  const { roof, gables } = gableRoof(len, span, rise, roofMat === 'thatch' ? 0.65 : 0.45, roofMat === 'thatch' ? 0.38 : 0.2, roofMat === 'thatch' ? 1.6 : 2);
  const rr = ridgeX ? 0 : Math.PI / 2;
  const roofTint = dark(o.roofTint ?? (roofMat === 'thatch' ? r.pick([0xd8b878, 0xcaa868, 0xe0c080]) : roofMat === 'slate' ? 0x5a6070 : 0xb05a3a));
  if (burnt < 0.85) kit.add(roofMat === 'tiles' ? 'roof' : roofMat, roof, F.at(0, h + 0.05, 0, rr), { tint: roofTint, ao: false });
  else for (let i = 0; i < 5; i++) kit.add('timber', box(0.14, 0.14, span * 0.62, 1), F.at(-len / 2 + len * (i + 0.5) / 5, h + rise * 0.5, 0, rr, 1, 1, 1, 0.9 * (i % 2 ? 1 : -1)), { tint: 0x1e1612, ao: false });
  kit.add('plaster', gables, F.at(0, h + 0.05, 0, rr), { tint: dark(plaster), ao: false });
  if (roofMat === 'thatch' && burnt < 0.85) kit.add('thatch', box(len + 1.2, 0.42, 0.62, 1), F.at(0, h + rise + 0.05, 0, rr), { tint: dark(0xb89858), ao: false });
  // gable timbers facing the camera
  if (!ridgeX && !fH) { kit.add('timber', box(0.14, rise * 0.9, 0.1, 1), F.at(0, h + rise * 0.45, d / 2 + 0.05), { tint: beam, ao: false }); smallWindow(kit, F, 0, h + rise * 0.3, d / 2 + 0.01, 0, { w: 0.55, h: 0.6, shutter: null }); }
  let chimney = null;
  if (o.chimney ?? r.chance(0.8)) {
    const cx = (r.chance(0.5) ? 1 : -1) * (ridgeX ? (w / 2 - 0.55) : 0), cz = ridgeX ? -0.4 : -(d / 2 - 0.55);
    const ch = rise + 1.4;
    kit.add('stone', box(0.75, ch + h - 1.0, 0.75, 1), F.at(cx, 1.0 + (ch + h - 1.0) / 2, cz), { tint: dark(0xb0a48e), ao: false });
    kit.add('stone', box(0.9, 0.16, 0.9, 1), F.at(cx, h + ch, cz), { tint: dark(0x9a9080), ao: false });
    const [wx, wz] = F.world(cx, cz); chimney = [wx, y + h + ch + 0.3, wz];
    (kit.spots.chimneys ||= []).push(chimney);
  }
  if (o.porch && !fH) {
    const pw = Math.min(2.6, w * 0.5);
    for (const s of [-1, 1]) kit.add('timber', box(0.14, 2.3, 0.14, 1), F.at(s * pw / 2, 1.15, d / 2 + 1.2), { tint: beam });
    const pr = gableRoof(pw + 0.4, 1.4, 0.55, 0.15, 0.12, 1.5);
    kit.add(roofMat === 'tiles' ? 'roof' : roofMat, pr.roof, F.at(0, 2.3, d / 2 + 0.75, Math.PI / 2, 1, 1, 1), { tint: roofTint, ao: false });
    kit.block(S.circle(...F.world(-pw / 2, d / 2 + 1.2), 0.15), 0.25); kit.block(S.circle(...F.world(pw / 2, d / 2 + 1.2), 0.15), 0.25);
  }
  if (o.sign != null && !fH) {
    const [sx, sz] = F.world(w / 2 - 0.2, d / 2 + 0.1);
    kit.add('metal', box(0.05, 0.05, 0.9, 1), F.at(w / 2 - 0.2, 2.65, d / 2 + 0.45), { tint: 0x2a2624, ao: false });
    kit.add('planks', box(0.07, 0.62, 0.8, 0.6), F.at(w / 2 - 0.2, 2.2, d / 2 + 0.72), { tint: 0x8a5a34, ao: false });
    kit.add('paint', box(0.08, 0.36, 0.5, 1), F.at(w / 2 - 0.2, 2.2, d / 2 + 0.72), { tint: o.sign, ao: false });
    void sx; void sz;
  }
  kit.block(S.rect(x, z, w + 0.35, d + 0.35, rot), 0.3);
  roofSpot(kit, x, z, (ridgeX ? w : d) + 1.2, (ridgeX ? d : w) + 1.2, rot + (ridgeX ? 0 : 0), burnt > 0.85 ? '#3a2e28' : '#' + new THREE.Color(roofTint).getHexString());
  return { F, chimney, top: h + rise };
}
/** big red timber barn with double doors and a hay loft */
export function barn(kit, x, y, z, rot, { w = 11, d = 7.5, h = 4.4, tint = 0x9a3a28, roofTint = 0x5a4a44, seed = 1 } = {}) {
  const F = new Frame(x, y, z, rot), r = new RNG(seed);
  kit.add('stone', box(w + 0.3, 0.6, d + 0.3, 1.5), F.at(0, 0.0, 0), { tint: 0xa89c88, yGround: y - 0.3 });
  kit.add('planks', walls(w, h, d, 1.2), F.at(0, h / 2 + 0.25, 0), { tint, yGround: y, aoH: 3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', box(0.24, h + 0.1, 0.24, 1), F.at(sx * (w / 2 - 0.05), h / 2 + 0.25, sz * (d / 2 - 0.05)), { tint: 0xe8e0d0, ao: false });
  const fH = hidden(F, 0, 1);
  if (!fH) {
    // double doors with white X-braces, loft door above
    for (const s of [-1, 1]) {
      kit.add('planks', box(1.7, 3.0, 0.12, 0.8), F.at(s * 0.86, 1.75, d / 2 + 0.06), { tint: 0x8a3020, ao: false });
      kit.add('timber', box(1.8, 0.14, 0.08, 1), F.at(s * 0.86, 3.2, d / 2 + 0.13), { tint: 0xf0e8d8, ao: false });
      kit.add('timber', box(1.8, 0.14, 0.08, 1), F.at(s * 0.86, 0.32, d / 2 + 0.13), { tint: 0xf0e8d8, ao: false });
      kit.add('timber', box(3.1, 0.12, 0.08, 1), F.at(s * 0.86, 1.75, d / 2 + 0.13, 0, 1, 1, 1, 0, s * 1.02), { tint: 0xf0e8d8, ao: false });
    }
    kit.add('planks', box(1.4, 1.2, 0.1, 0.8), F.at(0, h - 0.3, d / 2 + 0.06), { tint: 0x2a1a14, ao: false });
    kit.add('thatch', blob(0.6, 1, null, [1.2, 0.5, 0.6]), F.at(0, h - 0.8, d / 2 + 0.2), { tint: 0xe8c870, ao: false });
    kit.add('timber', box(0.14, 0.14, 1.4, 1), F.at(0, h + 0.55, d / 2 + 0.5), { tint: 0x4a3020, ao: false });
  }
  const rise = d * 0.55;
  const { roof, gables } = gableRoof(w, d, rise, 0.6, 0.2, 2);
  kit.add('roof', roof, F.at(0, h + 0.3, 0), { tint: roofTint, ao: false });
  kit.add('planks', gables, F.at(0, h + 0.3, 0), { tint, ao: false });
  kit.block(S.rect(x, z, w + 0.4, d + 0.4, rot), 0.3);
  roofSpot(kit, x, z, w + 1.2, d + 1.2, rot, '#6a5048');
  void r;
  return F;
}
/**
 * Windmill: whitewashed round tower, thatched cap, door facing the camera, sails on a separate animated mesh.
 * Returns { sails: Mesh (rotate .rotation.z each frame), top: y of the cap }.
 */
export function windmill(kit, x, y, z, rot = 0, { h = 9, r = 2.6, seed = 1, cap = 0xb8904c } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('stone', cyl(r + 0.4, r + 0.55, 0.8, 16, 2), F.at(0, 0.2, 0), { tint: 0xb0a690, yGround: y - 0.3 });
  kit.add('plaster', cyl(r * 0.72, r, h, 18, 2.4), F.at(0, h / 2 + 0.5, 0), { tint: 0xf0e8d8, yGround: y, aoH: 4 });
  kit.add('stone', cyl(r * 1.02, r * 1.05, 1.2, 18, 1.5), F.at(0, 1.0, 0), { tint: 0xc0b49c, ao: false });
  // gallery at mid height
  const gy = h * 0.55;
  kit.add('planks', cyl(r * 1.25, r * 1.25, 0.14, 18, 1), F.at(0, gy, 0), { tint: 0x8a6440, ao: false });
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; kit.add('timber', box(0.07, 0.8, 0.07, 1), F.at(Math.cos(a) * r * 1.22, gy + 0.45, Math.sin(a) * r * 1.22), { tint: 0x6a4a30, ao: false }); }
  const rail = new THREE.TorusGeometry(r * 1.22, 0.04, 4, 36); rail.rotateX(Math.PI / 2);
  kit.add('timber', rail, F.at(0, gy + 0.85, 0), { tint: 0x6a4a30, ao: false });
  // door + windows on the camera side
  plankDoor(kit, F, 0, r - 0.05, 0, { w: 1.1, h: 2.1, y: 0.5 });
  smallWindow(kit, F, 0, gy + 1.6, r * 0.82, 0, { w: 0.6, h: 0.75, shutter: 0x3a5a8a });
  smallWindow(kit, F, Math.sin(0.9) * r * 0.86, h * 0.3 + 0.8, Math.cos(0.9) * r * 0.86, 0.9, { w: 0.55, h: 0.7, shutter: 0x3a5a8a });
  // cap
  kit.add('thatch', cone(r * 0.98, 2.8, 16, 1.6), F.at(0, h + 1.9, 0), { tint: cap, ao: false });
  kit.add('timber', cyl(0.1, 0.12, 1.0, 6, 1), F.at(0, h + 3.6, 0), { tint: 0x4a3020, ao: false });
  // sails (animated part): 4 lattice blades with cloth, hub on the front
  const sails = kit.part('timber');
  const cloth = kit.part('cloth', { cast: true });
  const L = h * 0.82;
  sails.add(cyl(0.34, 0.34, 0.5, 10, 1), M(0, 0, 0.2, 0, 1, 1, 1, Math.PI / 2), 0x4a3020);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    const R = new THREE.Matrix4().makeRotationZ(a);
    sails.add(box(0.2, L, 0.16, 1), R.clone().multiply(M(0, L / 2, 0.3)), 0x5a3a24);
    for (let k = 0; k < 7; k++) sails.add(box(1.5, 0.07, 0.06, 1), R.clone().multiply(M(0.75, L * 0.25 + k * L * 0.11, 0.34)), 0x6a4a30);
    sails.add(box(0.06, L * 0.72, 0.06, 1), R.clone().multiply(M(1.45, L * 0.61, 0.34)), 0x6a4a30);
    cloth.add(box(1.3, L * 0.66, 0.02, 1), R.clone().multiply(M(0.78, L * 0.6, 0.38)), 0xf0e6d0);
  }
  const spin = new THREE.Group(); spin.add(sails.build(), cloth.build());
  const outer = new THREE.Group(); outer.add(spin); outer.name = 'windmill-sails';
  outer.applyMatrix4(F.at(0, h + 0.9, r * 0.82 + 0.35));
  kit.block(S.circle(x, z, r + 0.5), 0.3);
  roofSpot(kit, x, z, r * 2, r * 2, 0, '#c8a868');
  return { sails: outer, spin, top: y + h + 3.3 };
}
/**
 * Arched stone bridge along local X (rot about Y), deck at absolute deckY, spanning over a river bed at bedY.
 * Returns the deck rect shape (register it with zone.deck + nav.walk) and the parapet colliders are added.
 */
export function stoneBridge(kit, x, z, rot, { len = 16, w = 4.6, deckY = 0.6, bedY = -2.2, arches = 2, tint = 0xc4b8a0, seed = 1 } = {}) {
  const F = new Frame(x, deckY, z, rot), r = new RNG(seed);
  const hh = deckY - bedY + 0.6;
  const aw = (len - 2) / arches * 0.72;
  // spandrel walls with arches (both faces), filled deck body between
  const panel = [];
  const seg = len / arches;
  const out = [[-len / 2, 0]];
  for (let i = 0; i < arches; i++) {
    const cx = -len / 2 + seg * (i + 0.5), a0 = cx - aw / 2, a1 = cx + aw / 2, sy = hh * 0.35;
    out.push([a0, 0], [a0, sy]);
    for (let k = 1; k < 12; k++) { const t = Math.PI - k / 12 * Math.PI; out.push([cx + Math.cos(t) * aw / 2, sy + Math.sin(t) * aw / 2]); }
    out.push([a1, sy], [a1, 0]);
  }
  out.push([len / 2, 0], [len / 2 + 1.2, hh - 0.35], [len / 2 + 1.2, hh], [-len / 2 - 1.2, hh], [-len / 2 - 1.2, hh - 0.35]);
  void panel;
  const body = extrude(out, w, 2);
  const moss = linColor(0x6a7a3a), base = linColor(tint);
  kit.add('stone', body, F.at(0, -hh + 0.05, 0), { tint: (p) => { const t = clamp((p.y - bedY) / 2.0, 0, 1); const k = 0.82 + r.next() * 0.04; return lerpC(moss, base, t).map(v => v * k); }, chunkAt: [x, z] });
  // arch voussoir rims + dark soffit so the openings read
  for (let i = 0; i < arches; i++) {
    const cx = -len / 2 + seg * (i + 0.5), sy = hh * 0.35 - hh + 0.05;
    const rim = new THREE.TorusGeometry(aw / 2 + 0.12, 0.2, 4, 14, Math.PI);
    for (const s of [-1, 1]) kit.add('stone', rim, F.at(cx, sy, s * (w / 2 + 0.02)), { tint: 0xb4a890, ao: false });
    kit.add('paint', box(aw - 0.1, 0.05, w - 0.1, 1), F.at(cx, sy + aw / 2 - 0.02, 0), { tint: 0x1a1a18, ao: false, cast: false });
  }
  // parapets with coping
  for (const s of [-1, 1]) {
    kit.add('stone', box(len + 2.4, 0.75, 0.38, 1.5), F.at(0, 0.38, s * (w / 2 - 0.19)), { tint, ao: false });
    kit.add('stone', box(len + 2.5, 0.12, 0.5, 1), F.at(0, 0.8, s * (w / 2 - 0.19)), { tint: 0xd8ceb8, ao: false });
    for (const e of [-1, 1]) kit.add('stone', box(0.6, 1.1, 0.6, 1), F.at(e * (len / 2 + 1.2), 0.55, s * (w / 2 - 0.19)), { tint, ao: false });
  }
  kit.add('stone', box(len + 2.4, 0.06, w - 0.7, 2), F.at(0, 0.08, 0), { tint: 0xa89c86, ao: false, cast: false });
  for (const s of [-1, 1]) kit.block(S.line([F.world(-len / 2 - 1.5, s * (w / 2 - 0.19)), F.world(len / 2 + 1.5, s * (w / 2 - 0.19))], 0.4), 0.25);
  return { deck: S.rect(x, z, len + 2.4, w - 0.9, rot), y: deckY + 0.1, F };
}
/** low dry-stone wall along a polyline: irregular flat stones laid in courses, capstones, sparse moss */
export function dryWall(kit, pts, H, { h = 0.85, t = 0.62, tint = 0xb4ac9a, seed = 1, block = true, gaps = [], moss = 0x7a8a48 } = {}) {
  const r = new RNG(seed), nz = new Simplex(seed);
  const stoneG = [0, 1, 2].map(k => { const g = blob(1, 1, d => 1 + nz.noise3(d.x * 2.1 + k * 5, d.y * 2.1, d.z * 2.1) * 0.22, [1, 1, 1]).toNonIndexed(); g.computeVertexNormals(); return g; });
  const col = (m) => new THREE.Color(tint).multiplyScalar(m).getHex();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const n = Math.max(1, Math.round(L / 0.5));
    for (let k = 0; k < n; k++) {
      const tt = (k + 0.5) / n, px = ax + (bx - ax) * tt, pz = az + (bz - az) * tt;
      if (gaps.some(([gx, gz, gr]) => Math.hypot(px - gx, pz - gz) < gr)) continue;
      const y = H(px, pz), courses = 3;
      for (let c = 0; c < courses; c++) {
        const sx = r.range(0.24, 0.34), sy = r.range(0.1, 0.16), sz = t * r.range(0.4, 0.52), off = (c % 2) * 0.25;
        const lx = (tt * L + off) % 0.5 - 0.25;
        void lx;
        kit.add('paint', stoneG[(k + c) % 3], M(px + r.range(-0.05, 0.05), y + 0.08 + c * h * 0.3 + sy * 0.5, pz + r.range(-0.05, 0.05), ang + r.range(-0.15, 0.15), sx, sy, sz), { tint: col(r.range(0.78, 1.1)), ao: c === 0, yGround: y, aoH: 1.0, chunkAt: [px, pz] });
      }
      kit.add('paint', stoneG[k % 3], M(px, y + h * 0.92, pz, ang + r.range(-0.3, 0.3), 0.3, 0.1, t * 0.55), { tint: col(r.range(1.0, 1.2)), ao: false, chunkAt: [px, pz] });
      if (moss != null && r.chance(0.18)) kit.add('paint', blob(0.16, 1, null, [1.3, 0.25, 1]), M(px, y + h * 1.0, pz, ang), { tint: moss, ao: false, cast: false, chunkAt: [px, pz] });
      if (block && !gaps.length) continue;
      if (block) kit.block(S.circle(px, pz, 0.34), 0.25);
    }
    if (block && !gaps.length) kit.block(S.line([[ax, az], [bx, bz]], t), 0.25);
  }
}
/** zone entrance on an east–west road: two stone gate pillars with lanterns & banners, a signboard facing the camera */
export function gatePosts(kit, flags, x, y, z, { w = 7, axis = 'x', sign = 0xd8a830, banner = 0x2a5aa8, H = null } = {}) {
  const pts = axis === 'x' ? [[x, z - w / 2], [x, z + w / 2]] : [[x - w / 2, z], [x + w / 2, z]];
  for (const [px, pz] of pts) {
    const py = H ? H(px, pz) : y;
    kit.add('stone', box(1.2, 0.5, 1.2, 1), M(px, py + 0.1, pz), { tint: 0xa89e8c, yGround: py });
    kit.add('stone', box(0.9, 3.4, 0.9, 1.5), M(px, py + 1.9, pz), { tint: 0xc4baa6, yGround: py, aoH: 2 });
    kit.add('stone', box(1.15, 0.3, 1.15, 1), M(px, py + 3.7, pz), { tint: 0xd8d0bc, ao: false });
    kit.add('stone', cone(0.55, 0.8, 4, 1), M(px, py + 4.25, pz, Math.PI / 4), { tint: 0xc4baa6, ao: false });
    kit.glow(box(0.24, 0.3, 0.24), M(px, py + 3.1, pz + 0.62), 0xffc070, 2.6);
    kit.add('metal', box(0.3, 0.05, 0.3), M(px, py + 3.28, pz + 0.62), { tint: 0x26262c, ao: false });
    kit.add('metal', box(0.05, 0.05, 0.25), M(px, py + 3.28, pz + 0.47), { tint: 0x26262c, ao: false });
    kit.light(px, py + 3.1, pz + 0.8, 0xffc070, 4, 8, 0.08);
    if (flags) flags.add(M(px, py + 3.4, pz + 0.47), 0.8, 2.2, banner, { hang: 'top' });
    kit.block(S.circle(px, pz, 0.8), 0.25);
  }
  // signboard on two posts beside the road, facing south (the camera)
  const [sx, sz] = axis === 'x' ? [x - 2.5, z + w / 2 + 2.2] : [x + w / 2 + 2.2, z + 2.5];
  const sy = H ? H(sx, sz) : y;
  for (const d of [-0.9, 0.9]) kit.add('timber', box(0.14, 2.0, 0.14, 1), M(sx + d, sy + 1.0, sz), { tint: 0x6a4a30 });
  kit.add('planks', box(2.3, 1.0, 0.1, 0.8), M(sx, sy + 1.55, sz + 0.05), { tint: 0x8a5a34 });
  kit.add('paint', box(1.9, 0.62, 0.11, 1), M(sx, sy + 1.55, sz + 0.06), { tint: sign });
  kit.add('roof', gableRoof(2.6, 0.5, 0.3, 0.1, 0.06, 1).roof, M(sx, sy + 2.1, sz + 0.05), { tint: 0x7a4a34, ao: false });
  kit.block(S.rect(sx, sz, 2.2, 0.4), 0.25);
}
/** timber gate arch over a road: posts on stone footings, crossbeam with a shingled cap, hanging sign, lanterns, banners */
export function roadArch(kit, flags, x, y, z, rot, { w = 6.5, h = 4.6, sign = 0xd8a830, banner = 0x2a5aa8, tint = 0x6a4a30 } = {}) {
  const F = new Frame(x, y, z, rot);
  for (const s of [-1, 1]) {
    kit.add('stone', box(1.0, 0.9, 1.0, 1), F.at(s * w / 2, 0.35, 0), { tint: 0xb4aa98, yGround: y });
    kit.add('timber', box(0.42, h, 0.42, 1), F.at(s * w / 2, h / 2 + 0.6, 0), { tint });
    kit.add('timber', box(0.2, 1.5, 0.2, 1), F.at(s * (w / 2 - 0.55), h - 0.1, 0, 0, 1, 1, 1, 0, s * 0.75), { tint, ao: false });
    // lantern on the outer face
    kit.add('metal', box(0.08, 0.08, 0.5, 1), F.at(s * w / 2, h * 0.62, 0.42), { tint: 0x2a2624, ao: false });
    kit.glow(box(0.2, 0.28, 0.2), F.at(s * w / 2, h * 0.62 - 0.25, 0.62), 0xffc070, 2.6);
    kit.add('metal', cone(0.17, 0.16, 4), F.at(s * w / 2, h * 0.62 - 0.02, 0.62, Math.PI / 4), { tint: 0x26262c, ao: false });
    const [lx, lz] = F.world(s * w / 2, 0.62); kit.light(lx, y + h * 0.62 - 0.2, lz, 0xffc070, 4, 8, 0.08);
    if (flags) flags.add(F.at(s * (w / 2 + 0.24), h + 0.1, 0.1, 0), 0.9, 2.2, banner, { hang: 'top' });
    kit.block(S.circle(...F.world(s * w / 2, 0), 0.6), 0.25);
  }
  kit.add('timber', box(w + 1.2, 0.46, 0.5, 1), F.at(0, h + 0.75, 0), { tint });
  const cap = gableRoof(w + 1.6, 1.1, 0.45, 0.12, 0.1, 1.5);
  kit.add('roof', cap.roof, F.at(0, h + 1.0, 0), { tint: 0x7a4a34, ao: false });
  // hanging sign
  for (const s of [-1, 1]) kit.add('metal', box(0.03, 0.5, 0.03, 1), F.at(s * 0.9, h + 0.28, 0.05), { tint: 0x2a2624, ao: false });
  kit.add('planks', box(2.2, 0.62, 0.1, 0.8), F.at(0, h - 0.2, 0.05), { tint: 0x8a5a34, ao: false });
  kit.add('paint', box(1.8, 0.36, 0.11, 1), F.at(0, h - 0.2, 0.06), { tint: sign, ao: false });
}
/** rail fence with a gate gap list [[x, z, r]] */
export function railFence(kit, pts, H, { post = 2.2, tint = 0x8a6a48, gaps = [] } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / post)), ang = Math.atan2(-(bz - az), bx - ax);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (gaps.some(([gx, gz, gr]) => Math.hypot(mx - gx, mz - gz) < gr)) continue;
      for (const [px, pz] of [[x0, z0], [x1, z1]]) kit.add('timber', box(0.14, 1.15, 0.14, 1), M(px, H(px, pz) + 0.5, pz, ang + 0.3), { tint, chunkAt: [px, pz] });
      const y0 = H(x0, z0), y1 = H(x1, z1), seg = Math.hypot(x1 - x0, z1 - z0), tilt = Math.atan2(y1 - y0, seg);
      for (const hy of [0.45, 0.88]) kit.add('planks', box(seg + 0.1, 0.1, 0.06, 1.5), M(mx, (y0 + y1) / 2 + hy, mz, ang, 1, 1, 1, 0, tilt), { tint, ao: false, chunkAt: [mx, mz] });
      kit.block(S.line([[x0, z0], [x1, z1]], 0.2), 0.3);
    }
  }
}
export function hayBale(kit, x, y, z, rot = 0, { round = true, s = 1 } = {}) {
  if (round) {
    kit.add('thatch', cyl(0.75 * s, 0.75 * s, 1.2 * s, 14, 1), M(x, y + 0.72 * s, z, rot, 1, 1, 1, 0, Math.PI / 2), { tint: 0xe8c878 });
    for (const e of [-1, 1]) kit.add('thatch', cyl(0.72 * s, 0.72 * s, 0.02, 14, 0.5), M(x + Math.cos(rot) * e * 0.61 * s, y + 0.72 * s, z - Math.sin(rot) * e * 0.61 * s, rot, 1, 1, 1, 0, Math.PI / 2), { tint: 0xc8a050, ao: false });
    kit.block(S.rect(x, z, 1.25 * s, 1.5 * s, rot), 0.25);
  } else P.hay(kit, x, y, z, s, rot);
}
export function haystack(kit, x, y, z, s = 1) {
  kit.add('thatch', blob(1.4 * s, 1, d => 1 + Math.max(0, d.y) * 0.5, [1, 1.15, 1]), M(x, y + 1.0 * s, z), { tint: 0xe4c070, yGround: y, aoH: 2 });
  kit.add('timber', cyl(0.05, 0.05, 1.2, 5, 1), M(x, y + 2.9 * s, z), { tint: 0x6a4a30, ao: false });
  kit.block(S.circle(x, z, 1.35 * s), 0.25);
}
export function scarecrow(kit, x, y, z, rot = 0, { hat = 0x5a4a30, shirt = 0x8a4a3a, seed = 1 } = {}) {
  const F = new Frame(x, y, z, rot), r = new RNG(seed);
  kit.add('timber', cyl(0.06, 0.07, 2.3, 6, 1), F.at(0, 1.1, 0), { tint: 0x7a5a38 });
  kit.add('timber', box(1.8, 0.09, 0.09, 1), F.at(0, 1.65, 0), { tint: 0x7a5a38, ao: false });
  kit.add('cloth', cyl(0.3, 0.42, 0.95, 8, 1), F.at(0, 1.35, 0), { tint: shirt });
  for (const s of [-1, 1]) kit.add('cloth', cyl(0.12, 0.16, 0.75, 6, 1), F.at(s * 0.52, 1.62, 0, 0, 1, 1, 1, 0, s * 1.45), { tint: shirt, ao: false });
  for (const s of [-1, 1]) kit.add('thatch', cone(0.12, 0.3, 6, 1), F.at(s * 0.95, 1.62, 0, 0, 1, 1, 1, 0, -s * Math.PI / 2), { tint: 0xe0c070, ao: false });
  kit.add('cloth', sphere(0.24, 10, 8), F.at(0, 2.05, 0.02), { tint: 0xd8c49a });
  kit.add('paint', box(0.06, 0.06, 0.02, 1), F.at(-0.08, 2.08, 0.24), { tint: 0x1a1a1a, ao: false, cast: false });
  kit.add('paint', box(0.06, 0.06, 0.02, 1), F.at(0.08, 2.08, 0.24), { tint: 0x1a1a1a, ao: false, cast: false });
  kit.add('cloth', cyl(0.5, 0.5, 0.04, 12, 1), F.at(0, 2.24, 0, 0, 1, 1, 1, r.range(-0.15, 0.15)), { tint: hat, ao: false });
  kit.add('cloth', cyl(0.2, 0.26, 0.34, 10, 1), F.at(0, 2.42, 0), { tint: hat, ao: false });
  kit.block(S.circle(x, z, 0.3), 0.25);
}
export function beehive(kit, x, y, z) {
  kit.add('planks', box(0.9, 0.5, 0.9, 1), M(x, y + 0.25, z), { tint: 0x8a6a48 });
  for (let i = 0; i < 5; i++) kit.add('thatch', cyl(0.42 - i * 0.07, 0.46 - i * 0.07, 0.17, 12, 0.5), M(x, y + 0.58 + i * 0.15, z), { tint: 0xd8b060, ao: false });
  kit.add('paint', box(0.14, 0.1, 0.02, 1), M(x, y + 0.62, z + 0.44), { tint: 0x2a1a0a, ao: false, cast: false });
  kit.block(S.circle(x, z, 0.5), 0.2);
}
export function signpost(kit, x, y, z, rot = 0, { arms = [0.3, -2.4], tint = 0x7a5a38 } = {}) {
  kit.add('timber', cyl(0.07, 0.08, 2.4, 6, 1), M(x, y + 1.2, z), { tint });
  arms.forEach((a, i) => {
    const F = new Frame(x, y, z, rot + a);
    kit.add('planks', box(1.0, 0.24, 0.06, 0.8), F.at(0.45, 2.0 - i * 0.32, 0.08), { tint: 0xb89068, ao: false });
    kit.add('planks', cone(0.14, 0.2, 3, 0.8), F.at(1.0, 2.0 - i * 0.32, 0.08, 0, 1, 0.6, 0.4, 0, -Math.PI / 2), { tint: 0xb89068, ao: false });
  });
  kit.block(S.circle(x, z, 0.2), 0.2);
}
/** wayside shrine: stone niche with a golden sun disc, candles and flowers (the Shrine of Dawn) */
export function shrine(kit, x, y, z, rot = 0, { tint = 0xcfc4ae, sun = 0xffd070 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('stone', box(1.8, 0.4, 1.4, 1), F.at(0, 0.2, 0), { tint: 0xb8ad98, yGround: y });
  kit.add('stone', box(1.3, 1.9, 0.9, 1), F.at(0, 1.35, -0.1), { tint, ao: false });
  const gr = gableRoof(1.6, 1.2, 0.5, 0.15, 0.14, 1.2);
  kit.add('roof', gr.roof, F.at(0, 2.3, -0.1), { tint: 0x8a4a34, ao: false });
  kit.add('stone', gr.gables, F.at(0, 2.3, -0.1), { tint, ao: false });
  kit.add('paint', box(0.8, 1.1, 0.1, 1), F.at(0, 1.45, 0.32), { tint: 0x2a241e, ao: false });
  kit.glow(cyl(0.26, 0.26, 0.04, 16, 1), F.at(0, 1.6, 0.38, 0, 1, 1, 1, Math.PI / 2), sun, 2.6);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.glow(box(0.04, 0.16, 0.02, 1), F.at(Math.cos(a) * 0.38, 1.6 + Math.sin(a) * 0.38, 0.38, 0, 1, 1, 1, 0, a - Math.PI / 2), sun, 2.2); }
  for (const s of [-0.55, 0.55]) { kit.add('paint', cyl(0.05, 0.05, 0.22, 6, 1), F.at(s, 0.51, 0.45), { tint: 0xf4ecd8, ao: false, cast: false }); const [fx, fz] = F.world(s, 0.45); kit.flame(fx, y + 0.66, fz, 0.07, 0xffc060); }
  const [lx, lz] = F.world(0, 0.8); kit.light(lx, y + 1.4, lz, 0xffc070, 2.5, 5, 0.15);
  P.flowerPot(kit, ...F.world(-0.95, 0.5).flatMap((v, i) => i === 0 ? [v, y] : [v]), { s: 0.8, color: 0xf4d040 });
  kit.block(S.rect(x, z, 1.9, 1.5, rot), 0.25);
}
export function lanternPost(kit, x, y, z, rot = 0, { h = 2.6, color = 0xffc070, tint = 0x6a4a30 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('timber', box(0.16, h, 0.16, 1), F.at(0, h / 2, 0), { tint });
  kit.add('timber', box(0.8, 0.12, 0.12, 1), F.at(0.3, h - 0.1, 0), { tint, ao: false });
  kit.add('timber', box(0.06, 0.5, 0.06, 1), F.at(0.15, h - 0.35, 0, 0, 1, 1, 1, 0, 0.8), { tint, ao: false });
  kit.add('metal', cone(0.17, 0.18, 4), F.at(0.6, h - 0.3, 0, Math.PI / 4), { tint: 0x26262c, ao: false });
  kit.glow(box(0.18, 0.24, 0.18), F.at(0.6, h - 0.52, 0), color, 2.6);
  kit.add('metal', box(0.22, 0.04, 0.22), F.at(0.6, h - 0.66, 0), { tint: 0x26262c, ao: false });
  const [lx, lz] = F.world(0.6, 0);
  kit.light(lx, y + h - 0.5, lz, color, 4, 8, 0.08);
  kit.block(S.circle(x, z, 0.2), 0.2);
}
export function woodpile(kit, x, y, z, rot = 0, { n = 4, len = 1.4 } = {}) {
  const F = new Frame(x, y, z, rot);
  for (let row = 0; row < 3; row++) for (let i = 0; i < n - row; i++) kit.add('timber', cyl(0.13, 0.13, len, 7, 1), F.at((i - (n - row - 1) / 2) * 0.27, 0.13 + row * 0.23, 0, 0, 1, 1, 1, Math.PI / 2), { tint: [0xa87850, 0x9a6a44, 0xb08058][(i + row) % 3] });
  kit.add('planks', box(n * 0.28 + 0.2, 0.06, len + 0.2, 1), F.at(0, 0.78, 0, 0, 1, 1, 1, 0.1), { tint: 0x6a4a30, ao: false });
  kit.block(S.rect(x, z, n * 0.3, len, rot), 0.2);
}
export function trough(kit, x, y, z, rot = 0) {
  const F = new Frame(x, y, z, rot);
  kit.add('planks', box(2.0, 0.55, 0.7, 1), F.at(0, 0.3, 0), { tint: 0x8a6440 });
  kit.add('paint', box(1.85, 0.03, 0.55, 1), F.at(0, 0.52, 0), { tint: 0x2a4a5a, ao: false, cast: false });
  kit.block(S.rect(x, z, 2.0, 0.7, rot), 0.25);
}
/** hay wagon: cart with a heaped load of hay */
export function hayWagon(kit, x, y, z, rot = 0) {
  P.cart(kit, x, y, z, rot, { load: 0xe0c070 });
  const F = new Frame(x, y, z, rot);
  kit.add('thatch', blob(1.2, 1, d => 1 + Math.max(0, d.y) * 0.2, [0.75, 0.55, 1.2]), F.at(0, 1.55, 0), { tint: 0xe4c474, ao: false });
}
export function pumpkin(kit, x, y, z, s = 1) {
  const g = new THREE.SphereGeometry(0.3 * s, 12, 8); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 + Math.cos(a * 8) * 0.06; p.setXYZ(i, p.getX(i) * f, p.getY(i) * 0.72, p.getZ(i) * f); }
  g.computeVertexNormals();
  kit.add('paint', g, M(x, y + 0.2 * s, z, x * 3), { tint: 0xe07a1a, ao: false });
  kit.add('timber', cyl(0.03, 0.04, 0.12, 5, 1), M(x, y + 0.45 * s, z), { tint: 0x4a6a2a, ao: false, cast: false });
}

// ------------------------------------------------------------------------------------------------ camps & ruins
export function tent(kit, x, y, z, rot = 0, { w = 2.8, d = 3.4, h = 2.2, color = 0xb89c70, patch = 0x8a6a4a } = {}) {
  const F = new Frame(x, y, z, rot);
  const half = w / 2, slope = Math.hypot(half, h), ang = Math.atan2(h, half);
  for (const s of [-1, 1]) {
    kit.add('cloth', box(slope + 0.25, 0.06, d, 1.2), F.at(s * half / 2, h / 2 - 0.02, 0, 0, 1, 1, 1, 0, -s * ang), { tint: color });
    kit.add('cloth', box(slope * 0.4, 0.07, d * 0.3, 1), F.at(s * half * 0.55, h * 0.42, d * 0.12, 0, 1, 1, 1, 0, -s * ang), { tint: patch, ao: false, cast: false });
  }
  kit.add('timber', cyl(0.05, 0.05, d + 0.7, 5, 1), F.at(0, h + 0.02, 0, 0, 1, 1, 1, Math.PI / 2), { tint: 0x5a4028, ao: false });
  for (const s of [-1, 1]) kit.add('timber', cyl(0.05, 0.05, h + 0.25, 5, 1), F.at(0, h / 2, s * (d / 2 + 0.2)), { tint: 0x5a4028, ao: false });
  // back wall + dark entrance with a rolled flap
  const tri = (zz, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-half, 0, 0, half, 0, 0, 0, h, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 1]); g.computeVertexNormals(); kit.add('cloth', g, F.at(0, 0.02, zz), { tint: c, ao: false }); };
  tri(-d / 2 + 0.02, color);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-half * 0.6, 0, 0, half * 0.6, 0, 0, 0, h * 0.8, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); kit.add('paint', g, F.at(0, 0.02, d / 2 - 0.05), { tint: 0x1a140e, ao: false, cast: false }); }
  kit.add('cloth', cyl(0.12, 0.12, h * 0.8, 6, 1), F.at(-half * 0.55, h * 0.4, d / 2 + 0.02, 0, 1, 1, 1, 0, -ang * 0.35), { tint: color, ao: false });
  // guy ropes and pegs
  for (const s of [-1, 1]) for (const e of [-1, 1]) {
    kit.add('timber', tube([V(s * half * 0.2, h * 0.9, e * d / 2), V(s * (half + 0.9), 0.05, e * (d / 2 + 0.5))], [0.012, 0.012], 3, false), F.m, { tint: 0xc8b890, ao: false, cast: false, chunkAt: [x, z] });
    kit.add('timber', box(0.05, 0.25, 0.05, 1), F.at(s * (half + 0.9), 0.08, e * (d / 2 + 0.5)), { tint: 0x6a4a30, ao: false, cast: false });
  }
  kit.block(S.rect(x, z, w + 0.2, d + 0.2, rot), 0.25);
}
/** sharpened-log palisade along a polyline; gaps [[x, z, r]] */
export function palisade(kit, pts, H, { h = 3, tint = 0x7a5a3a, gaps = [], seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 0.42));
    let run = [];
    const flush = () => { if (run.length > 1) kit.block(S.line(run, 0.5), 0.3); run = []; };
    for (let k = 0; k <= n; k++) {
      const t = k / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (gaps.some(([gx, gz, gr]) => Math.hypot(px - gx, pz - gz) < gr)) { flush(); continue; }
      const y = H(px, pz), hh = h * r.range(0.85, 1.1);
      kit.add('timber', cyl(0.2, 0.22, hh, 7, 1), M(px, y + hh / 2 - 0.2, pz, r.range(0, 6), 1, 1, 1, r.range(-0.05, 0.05), r.range(-0.05, 0.05)), { tint: new THREE.Color(tint).multiplyScalar(r.range(0.85, 1.12)).getHex(), yGround: y, chunkAt: [px, pz] });
      kit.add('timber', cone(0.2, 0.5, 7, 1), M(px, y + hh - 0.2 + 0.25, pz), { tint: 0x9a7a58, ao: false, chunkAt: [px, pz] });
      run.push([px, pz]);
    }
    flush();
  }
}
/** stone ring, log seats, flame + light + a smoke source (returned) */
export function campfire(kit, x, y, z, { seats = true, s = 1, seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; kit.add('rock', blob(0.18 * s, 0, null, [1.2, 0.7, 1]), M(x + Math.cos(a) * 0.62 * s, y + 0.06, z + Math.sin(a) * 0.62 * s, a), { tint: 0x6a6460, ao: false, cast: false }); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; kit.add('timber', cyl(0.07 * s, 0.07 * s, 0.9 * s, 6, 1), M(x, y + 0.2, z, a, 1, 1, 1, 0, 1.2), { tint: 0x3a2618, ao: false, cast: false }); }
  kit.glow(blob(0.3 * s, 0, null, [1, 0.3, 1]), M(x, y + 0.08, z), 0xff6a20, 3.2);
  kit.flame(x, y + 0.25, z, 0.5 * s, 0xff9a40);
  kit.light(x, y + 1.0, z, 0xff9a50, 8 * s, 10 * s, 0.35);
  if (seats) for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + r.range(0, 1); log(kit, x + Math.cos(a) * 2.0 * s, y, z + Math.sin(a) * 2.0 * s, -a + Math.PI / 2, { len: 1.6, r: 0.22, moss: null, block: true }); }
  kit.block(S.circle(x, z, 0.7 * s), 0.2);
  return { x, y: y + 0.6, z };
}
/** wooden lookout tower: four legs, cross braces, platform with rail, a little roof */
export function lookout(kit, x, y, z, rot = 0, { h = 5, w = 2.6, roof = true, tint = 0x7a5a3a } = {}) {
  const F = new Frame(x, y, z, rot);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', cyl(0.13, 0.16, h + 0.2, 6, 1), F.at(sx * w / 2, h / 2, sz * w / 2, 0, 1, 1, 1, sz * 0.04, -sx * 0.04), { tint });
  for (const yy of [h * 0.35, h * 0.7]) for (const s of [-1, 1]) {
    kit.add('timber', box(w, 0.1, 0.1, 1), F.at(0, yy, s * w / 2), { tint, ao: false });
    kit.add('timber', box(0.1, 0.1, w, 1), F.at(s * w / 2, yy, 0), { tint, ao: false });
  }
  for (const s of [-1, 1]) kit.add('timber', box(Math.hypot(w, h * 0.35) , 0.08, 0.08, 1), F.at(0, h * 0.52, s * w / 2, 0, 1, 1, 1, 0, s * Math.atan2(h * 0.35, w)), { tint, ao: false });
  kit.add('planks', box(w + 0.6, 0.14, w + 0.6, 1), F.at(0, h, 0), { tint: 0x8a6440 });
  for (const s of [-1, 1]) { kit.add('planks', box(w + 0.6, 0.7, 0.08, 1), F.at(0, h + 0.45, s * (w / 2 + 0.28)), { tint: 0x8a6440, ao: false }); kit.add('planks', box(0.08, 0.7, w + 0.6, 1), F.at(s * (w / 2 + 0.28), h + 0.45, 0), { tint: 0x8a6440, ao: false }); }
  if (roof) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', box(0.1, 1.8, 0.1, 1), F.at(sx * w / 2, h + 0.9, sz * w / 2), { tint, ao: false }); kit.add('thatch', cone(w * 0.95, 1.4, 4, 1.4), F.at(0, h + 2.4, 0, Math.PI / 4), { tint: 0xa88a58, ao: false }); }
  kit.add('timber', box(0.5, h, 0.08, 1), F.at(0, h / 2, w / 2 + 0.3, 0, 1, 1, 1, -0.25), { tint: 0x6a4a30, ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = F.world(sx * w / 2, sz * w / 2); kit.block(S.circle(px, pz, 0.2), 0.25); }
}
/** broken round stone tower (ruined watchtower). tops: jagged. */
export function ruinTower(kit, x, y, z, { r = 2.6, h = 7, tint = 0xb0a690, seed = 1, moss = 0x5a7a30, mat = 'stone', scorch = 0 } = {}) {
  const rng = new RNG(seed);
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, hh = h * (0.45 + 0.55 * Math.abs(Math.sin(i * 0.9 + seed))) * rng.range(0.8, 1);
    const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
    kit.add(mat, box(r * TAU / N + 0.12, hh, 0.9, 1.5), M(cx, y + hh / 2 - 0.3, cz, -a + Math.PI / 2), { tint: new THREE.Color(tint).lerp(new THREE.Color(0x201a18), scorch * rng.range(0.3, 0.8)).getHex(), yGround: y, aoH: 3, chunkAt: [x, z] });
    if (rng.chance(0.4)) kit.add('paint', blob(0.4, 0, null, [1.4, 0.4, 1]), M(cx, y + hh - 0.25, cz), { tint: moss, ao: false, cast: false, chunkAt: [x, z] });
  }
  for (let i = 0; i < 7; i++) { const a = rng.range(0, TAU), d = r + rng.range(0.6, 2.5); boulder(kit, x + Math.cos(a) * d, y - 0.1, z + Math.sin(a) * d, { s: rng.range(0.25, 0.5), seed: seed + i, tint, block: false }); }
  // door gap facing south
  kit.block(S.subtract(S.ring(x, z, r, 1.1), S.rect(x, z + r, 1.8, 2.4)), 0.3);
}
/** ruined wall from a→b: stacked blocks with a jagged broken top */
export function ruinWall(kit, ax, az, bx, bz, H, { h = 4, t = 1.0, tint = 0xb4aa94, seed = 1, moss = 0x5a7a30, mat = 'stone', window = false } = {}) {
  const rng = new RNG(seed), len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), n = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i < n; i++) {
    const tt = (i + 0.5) / n, px = ax + (bx - ax) * tt, pz = az + (bz - az) * tt, y = H(px, pz);
    const hh = h * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.7 + seed * 1.3))) * rng.range(0.85, 1.05);
    const hole = window && i % 3 === 1 && hh > 2.6;
    if (hole) { kit.add(mat, box(len / n + 0.05, 0.9, t, 1.5), M(px, y + 0.15, pz, ang), { tint, yGround: y, chunkAt: [px, pz] }); kit.add(mat, box(len / n + 0.05, hh - 2.4, t, 1.5), M(px, y + 2.4 + (hh - 2.4) / 2, pz, ang), { tint, ao: false, chunkAt: [px, pz] }); }
    else kit.add(mat, box(len / n + 0.05, hh, t, 1.5), M(px, y + hh / 2 - 0.3, pz, ang), { tint, yGround: y, aoH: 3, chunkAt: [px, pz] });
    if (rng.chance(0.55)) kit.add('paint', blob(0.45, 0, null, [1.5, 0.35, 1.1]), M(px, y + hh - 0.3, pz, ang), { tint: moss, ao: false, cast: false, chunkAt: [px, pz] });
    if (rng.chance(0.3)) boulder(kit, px + Math.sin(ang) * rng.range(1, 2), y - 0.1, pz + Math.cos(ang) * rng.range(1, 2), { s: rng.range(0.25, 0.45), seed: seed * 11 + i, tint, block: false });
  }
  kit.block(S.line([[ax, az], [bx, bz]], t), 0.3);
}
/** gothic arch ruin (two piers + pointed arch), opening along local X */
export function archRuin(kit, x, y, z, rot, { w = 4, h = 6, t = 1.0, tint = 0xb4aa94, broken = false, mat = 'stone' } = {}) {
  const F = new Frame(x, y, z, rot);
  for (const s of [-1, 1]) kit.add(mat, box(1.0, h, t, 1.5), F.at(s * (w / 2 + 0.5), h / 2 - 0.2, 0), { tint, yGround: y, aoH: 3 });
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(V(-w / 2 - 0.5 + Math.sin(a) * (w / 2 + 0.5) * 0.98, h - 0.2 + Math.cos(Math.PI / 2 - a) * 0 + Math.sin(a) * w * 0.55, 0)); }
  if (!broken) {
    for (const s of [-1, 1]) { const p2 = []; for (let i = 0; i <= 8; i++) { const a = i / 8; p2.push(V(s * (w / 2 + 0.3) * (1 - Math.sin(a * Math.PI / 2)), h - 0.4 + Math.sin(a * Math.PI / 2) * w * 0.6, 0)); } kit.add(mat, tube(p2, p2.map(() => 0.45), 6, false), F.m, { tint, ao: false, chunkAt: [x, z] }); }
  } else {
    const p2 = []; for (let i = 0; i <= 5; i++) { const a = i / 8; p2.push(V(-(w / 2 + 0.3) * (1 - Math.sin(a * Math.PI / 2)), h - 0.4 + Math.sin(a * Math.PI / 2) * w * 0.6, 0)); }
    kit.add(mat, tube(p2, p2.map(() => 0.45), 6, true), F.m, { tint, ao: false, chunkAt: [x, z] });
  }
  void pts;
  for (const s of [-1, 1]) kit.block(S.circle(...F.world(s * (w / 2 + 0.5), 0), 0.75), 0.25);
}
export function gravestone(kit, x, y, z, rot = 0, { tint = 0x9a948a, kind = 0, lean = 0 } = {}) {
  const F = new Frame(x, y, z, rot);
  if (kind === 0) { kit.add('stone', box(0.6, 0.9, 0.16, 1), F.at(0, 0.4, 0, 0, 1, 1, 1, lean), { tint }); kit.add('stone', cyl(0.3, 0.3, 0.16, 10, 1, false), F.at(0, 0.85, 0, 0, 1, 1, 1, Math.PI / 2 + lean), { tint }); }
  else { kit.add('stone', box(0.14, 1.1, 0.14, 1), F.at(0, 0.5, 0, 0, 1, 1, 1, lean), { tint }); kit.add('stone', box(0.6, 0.14, 0.14, 1), F.at(0, 0.78, 0, 0, 1, 1, 1, lean), { tint }); }
  kit.add('paint', box(0.7, 0.04, 1.4, 1), F.at(0, 0.02, 0.7), { tint: 0x4a5a2a, ao: false, cast: false });
  kit.block(S.circle(x, z, 0.35), 0.2);
}
