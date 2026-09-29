// Building generators (merged into a Kit). Local +Z is a building's front (street side). Faces that look north
// (away from the fixed game camera) get no detail — the camera can never see them.
import * as THREE from 'three';
import { RNG } from '../core/noise.js';
import { blob, tube } from '../engine/geom.js';
import { box, walls, cyl, cone, sphere, gableRoof, hipRoof, M, Frame, extrude, archPanel } from './kit.js';
import { rect, circle, line } from './shapes.js';
import * as P from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
export const ROOF = { blue: 0x3d62a8, deepblue: 0x2c4a86, red: 0xb4523a, terracotta: 0xc0643e, slate: 0x4a5566, green: 0x3e7a5a, ochre: 0xc49040 };
const PLASTER = [0xfbf6ec, 0xf6efe0, 0xfff4e4, 0xf3ede6, 0xf8ecdc, 0xf2f0ea];
const SHUTTER = [0x3a62a0, 0x2f6f5a, 0x9a3a2a, 0x4a4a8a, 0x6a4a2a];
const STONE_T = 0xf1ece2, TRIM_T = 0xfaf7f0;
/** world [x, y, z] of a local point */
const wp = (F, lx, lz, y) => { const [a, b] = F.world(lx, lz); return [a, y, b]; };

/** facade faces north (invisible to the game camera)? */
const hidden = (F, ldx, ldz) => { const wz = -ldx * F.s + ldz * F.c; return wz < -0.35; };

// ---------------------------------------------------------------- facade details
export function archedWindow(kit, F, lx, ly, lz, ry, { w = 0.95, h = 1.5, shutter = 0x3a62a0, flowers = false, seed = 1, frame = 'stone', open = false } = {}) {
  const fr = F.at(lx, ly, lz, ry);
  const mul = (m) => fr.clone().multiply(m);
  kit.add('window', box(w, h, 0.06, w), mul(M(0, 0, 0.02)), { ao: false });
  const top = cyl(w / 2, w / 2, 0.06, 10, 1); // half disc via full cylinder clipped by wall (cheap)
  kit.add('window', top, mul(M(0, h / 2, 0.02, 0, 1, 1, 1, Math.PI / 2)), { ao: false });
  // stone surround: jambs, arch, sill
  for (const s of [-1, 1]) kit.add(frame, box(0.14, h, 0.16, 1), mul(M(s * (w / 2 + 0.07), 0, 0.06)), { tint: TRIM_T, ao: false });
  const arch = new THREE.TorusGeometry(w / 2 + 0.07, 0.08, 4, 10, Math.PI);
  kit.add(frame, arch, mul(M(0, h / 2, 0.06)), { tint: TRIM_T, ao: false });
  kit.add(frame, box(w + 0.4, 0.1, 0.26, 1), mul(M(0, -h / 2 - 0.05, 0.1)), { tint: TRIM_T, ao: false });
  kit.add(frame, box(0.22, 0.24, 0.1, 1), mul(M(0, h / 2 + w / 2 + 0.06, 0.1)), { tint: TRIM_T, ao: false }); // keystone
  if (shutter) for (const s of [-1, 1]) {
    const sx = open ? s * (w * 0.75 + 0.12) : s * w * 0.25;
    kit.add('planks', box(w * 0.48, h, 0.05, 0.6), mul(M(sx, -0.02, open ? 0.09 : 0.07, open ? s * 0.18 : 0)), { tint: shutter, ao: false });
  }
  if (flowers) P.flowerBox(kit, { at: (a, b, c) => mul(M(a, b, c)) }, 0, -h / 2 - 0.2, 0.28, w + 0.2, seed);
}
function squareWindow(kit, F, lx, ly, lz, ry, { w = 0.8, h = 1.1, shutter = null } = {}) {
  const fr = F.at(lx, ly, lz, ry), mul = m => fr.clone().multiply(m);
  kit.add('window', box(w, h, 0.06, w), mul(M(0, 0, 0.02)), { ao: false });
  kit.add('stone', box(w + 0.26, 0.12, 0.2, 1), mul(M(0, h / 2 + 0.06, 0.06)), { tint: TRIM_T, ao: false });
  kit.add('stone', box(w + 0.3, 0.1, 0.24, 1), mul(M(0, -h / 2 - 0.05, 0.08)), { tint: TRIM_T, ao: false });
  if (shutter) for (const s of [-1, 1]) kit.add('planks', box(w * 0.5, h, 0.05, 0.6), mul(M(s * (w * 0.75 + 0.05), 0, 0.07)), { tint: shutter, ao: false });
}
export function archDoor(kit, F, lx, lz, ry, { w = 1.3, h = 2.3, tint = 0x6a4028, y = 0, steps = 1 } = {}) {
  const fr = F.at(lx, y, lz, ry), mul = m => fr.clone().multiply(m);
  kit.add('planks', box(w, h, 0.1, 0.8), mul(M(0, h / 2, 0.02)), { tint, ao: false });
  kit.add('planks', cyl(w / 2, w / 2, 0.1, 10, 1), mul(M(0, h, 0.02, 0, 1, 1, 1, Math.PI / 2)), { tint, ao: false });
  for (const s of [-1, 1]) kit.add('stone', box(0.22, h + 0.05, 0.24, 1), mul(M(s * (w / 2 + 0.11), h / 2, 0.08)), { tint: TRIM_T, ao: false });
  const arch = new THREE.TorusGeometry(w / 2 + 0.11, 0.12, 4, 12, Math.PI);
  kit.add('stone', arch, mul(M(0, h, 0.08)), { tint: TRIM_T, ao: false });
  kit.add('metal', sphere(0.05, 6, 4), mul(M(w * 0.28, h * 0.48, 0.1)), { tint: 0xc8a040, ao: false });
  for (let i = 0; i < 3; i++) kit.add('metal', box(w * 0.9, 0.05, 0.03, 1), mul(M(0, 0.4 + i * 0.75, 0.08)), { tint: 0x2a2a2a, ao: false });
  for (let i = 0; i < steps; i++) kit.add('stone', box(w + 0.9 - i * 0.2, 0.16, 0.5 - i * 0.12, 1), mul(M(0, 0.08 + i * 0.16 - 0.16 * steps + 0.16, 0.3 - i * 0.1)), { tint: STONE_T, ao: false });
}
function awning(kit, F, lx, ly, lz, w, color, { depth = 1.4 } = {}) {
  const n = Math.max(3, Math.round(w / 0.45));
  for (let i = 0; i < n; i++) kit.add('cloth', box(w / n + 0.01, 0.03, depth, 1), F.at(lx - w / 2 + (i + 0.5) * w / n, ly, lz + depth / 2 - 0.1, 0, 1, 1, 1, 0.42), { tint: i % 2 ? color : 0xf6efe0, ao: false });
  for (let i = 0; i < n; i++) kit.add('cloth', cyl(w / n / 2, w / n / 2, 0.03, 8, 1), F.at(lx - w / 2 + (i + 0.5) * w / n, ly - Math.sin(0.42) * depth - 0.02, lz + Math.cos(0.42) * depth - 0.1, 0, 1, 1, 1, Math.PI / 2 - 0.42), { tint: i % 2 ? color : 0xf6efe0, ao: false, cast: false });
  kit.add('metal', box(w + 0.1, 0.05, 0.05, 1), F.at(lx, ly + 0.03, lz - 0.08), { tint: 0x2a2a2a, ao: false });
}
function hangingSign(kit, F, lx, ly, lz, color = 0xd8b060) {
  kit.add('metal', box(0.06, 0.06, 1.0, 1), F.at(lx, ly, lz + 0.5), { tint: 0x2a2a2a, ao: false });
  kit.add('metal', tube([V(0, -0.35, 0), V(0, 0, 0.35)], [0.02, 0.02], 4, false), F.at(lx, ly, lz), { tint: 0x2a2a2a, ao: false });
  kit.add('planks', box(0.07, 0.6, 0.75, 0.6), F.at(lx, ly - 0.4, lz + 0.62), { tint: 0x9a6a40, ao: false });
  kit.add('paint', box(0.08, 0.4, 0.5, 1), F.at(lx, ly - 0.4, lz + 0.62), { tint: color, ao: false });
}
function balcony(kit, F, lx, ly, lz, w) {
  kit.add('stone', box(w, 0.18, 0.9, 1), F.at(lx, ly, lz + 0.42), { tint: TRIM_T, ao: false });
  for (let i = 0; i < 3; i++) kit.add('stone', box(0.16, 0.3, 0.7, 1), F.at(lx - w / 2 + 0.2 + i * (w - 0.4) / 2, ly - 0.22, lz + 0.3), { tint: TRIM_T, ao: false });
  kit.add('metal', box(w, 0.05, 0.05, 1), F.at(lx, ly + 0.95, lz + 0.84), { tint: 0x26262c, ao: false });
  for (const s of [-1, 1]) kit.add('metal', box(0.05, 0.05, 0.8, 1), F.at(lx + s * (w / 2 - 0.03), ly + 0.95, lz + 0.44), { tint: 0x26262c, ao: false });
  const n = Math.round(w / 0.16);
  for (let i = 0; i <= n; i++) kit.add('metal', box(0.025, 0.85, 0.025, 1), F.at(lx - w / 2 + i * w / n, ly + 0.52, lz + 0.84), { tint: 0x26262c, ao: false });
}

// ---------------------------------------------------------------- townhouse
/**
 * White-stone Solhaven house. o: { w, d, floors, roof (hex), ridge 'x'|'z', shop, awning, balcony, chimney, dormers,
 * seed, plaster, shutter, base ('stone'|'plaster'), timber (bool: timber-framed upper floors) }
 * Returns { top, F, eave }.
 */
export function townhouse(kit, x, y, z, rot, o = {}) {
  const r = new RNG(o.seed ?? Math.round(x * 7.3 + z * 13.1));
  const w = o.w ?? 7, d = o.d ?? 7, floors = o.floors ?? 2;
  const F = new Frame(x, y, z, rot);
  const plaster = o.plaster ?? r.pick(PLASTER), shutter = o.shutter ?? r.pick(SHUTTER);
  const roofC = o.roof ?? (r.chance(0.6) ? ROOF.blue : ROOF.red);
  const f0 = 3.5, fh = 3.1;
  const frontHidden = hidden(F, 0, 1), leftHidden = hidden(F, -1, 0), rightHidden = hidden(F, 1, 0), backHidden = hidden(F, 0, -1);
  // plinth + ground floor stone
  kit.add('stone', box(w + 0.2, 0.6, d + 0.2, 2), F.at(0, 0.05, 0), { tint: 0xe2dccf, yGround: y - 0.3 });
  kit.add('stone', walls(w, f0, d, 2), F.at(0, f0 / 2 + 0.3, 0), { tint: STONE_T, yGround: y, aoH: 3 });
  let top = f0 + 0.3;
  for (let f = 0; f < floors - 1; f++) {
    // string course
    kit.add('stone', walls(w + 0.16, 0.22, d + 0.16, 1), F.at(0, top, 0), { tint: TRIM_T, ao: false });
    if (o.timber) {
      kit.add('plaster', walls(w, fh, d, 2.4), F.at(0, top + fh / 2, 0), { tint: plaster, ao: false });
      const t = 0.2;
      for (let i = 0; i <= Math.round(w / 1.6); i++) { const u = -w / 2 + i * w / Math.round(w / 1.6); kit.add('timber', box(t, fh, t, 1), F.at(u, top + fh / 2, d / 2 + 0.04), { ao: false }); }
      kit.add('timber', box(w + 0.1, t, t, 1), F.at(0, top + fh - 0.1, d / 2 + 0.04), { ao: false });
    } else kit.add('plaster', walls(w, fh, d, 2.4), F.at(0, top + fh / 2, 0), { tint: plaster, ao: false });
    // quoins
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if ((sz > 0 && frontHidden && (sx > 0 ? rightHidden : leftHidden))) continue;
      for (let k = 0; k < 4; k++) {
        const big = k % 2 === 0;
        kit.add('stone', box(big ? 0.62 : 0.42, 0.34, big ? 0.42 : 0.62, 1), F.at(sx * (w / 2 - (big ? 0.26 : 0.16)), top + 0.45 + k * 0.72, sz * (d / 2 - (big ? 0.16 : 0.26))), { tint: TRIM_T, ao: false });
      }
    }
    top += fh;
  }
  // cornice
  kit.add('stone', walls(w + 0.36, 0.26, d + 0.36, 1), F.at(0, top + 0.02, 0), { tint: TRIM_T, ao: false });
  // ---------- facade details (only faces the camera can see)
  const faces = [
    { hid: frontHidden, len: w, place: (u) => [u, d / 2 + 0.01, 0] },
    { hid: backHidden, len: w, place: (u) => [-u, -d / 2 - 0.01, Math.PI] },
    { hid: rightHidden, len: d, place: (u) => [w / 2 + 0.01, -u, Math.PI / 2] },
    { hid: leftHidden, len: d, place: (u) => [-w / 2 - 0.01, u, -Math.PI / 2] },
  ];
  faces.forEach((fc, fi) => {
    if (fc.hid) return;
    const n = Math.max(1, Math.floor((fc.len - 0.8) / 2.3));
    // ground floor
    for (let i = 0; i < n; i++) {
      const u = -fc.len / 2 + fc.len * (i + 0.5) / n;
      const [lx, lz, ry] = fc.place(u);
      if (fi === 0 && i === Math.floor(n / 2) && !o.noDoor) { archDoor(kit, F, lx, lz, ry, { y: 0.3 }); continue; }
      if (fi === 0 && o.shop) archedWindow(kit, F, lx, 1.95, lz, ry, { w: 1.5, h: 1.6, shutter: null });
      else squareWindow(kit, F, lx, 2.1, lz, ry, { shutter: fi === 0 ? shutter : null });
    }
    // upper floors
    for (let f = 0; f < floors - 1; f++) {
      const wy = f0 + 0.3 + f * fh + fh * 0.5;
      for (let i = 0; i < n; i++) {
        const u = -fc.len / 2 + fc.len * (i + 0.5) / n;
        const [lx, lz, ry] = fc.place(u);
        archedWindow(kit, F, lx, wy - 0.1, lz, ry, { shutter, flowers: fi === 0 && r.chance(0.55), seed: r.int(0, 999), open: r.chance(0.3) });
      }
    }
  });
  if (!frontHidden && o.shop) { awning(kit, F, 0, 3.3, d / 2 + 0.05, w - 0.6, o.awning ?? r.pick([0xb03030, 0x2f5fa8, 0x2f8a5a, 0xd09a30])); hangingSign(kit, F, w / 2 - 0.3, 3.4, d / 2, o.sign ?? 0xd8b060); }
  if (!frontHidden && o.balcony && floors > 1) balcony(kit, F, 0, f0 + 0.35, d / 2, Math.min(3.2, w * 0.45));
  // ---------- roof
  const ridgeX = (o.ridge ?? (w >= d ? 'x' : 'z')) === 'x';
  const span = ridgeX ? d : w, len = ridgeX ? w : d;
  const rise = span * (o.pitch ?? 0.5);
  const { roof, gables } = gableRoof(len, span, rise, 0.45, 0.22, 2);
  const rr = ridgeX ? 0 : Math.PI / 2;
  kit.add('roof', roof, F.at(0, top + 0.12, 0, rr), { tint: roofC, ao: false });
  kit.add('plaster', gables, F.at(0, top + 0.12, 0, rr), { tint: plaster, ao: false });
  kit.add('stone', box(len + 1.0, 0.22, 0.3, 1), F.at(0, top + 0.12 + rise + 0.05, 0, rr), { tint: 0xd8d0c4, ao: false });
  // gable window (round) when the gable faces the camera
  if (!ridgeX && !frontHidden) kit.add('window', cyl(0.4, 0.4, 0.08, 12, 1), F.at(0, top + rise * 0.42, d / 2 + 0.02, 0, 1, 1, 1, Math.PI / 2), { ao: false });
  // dormers on the front slope
  if (ridgeX && (o.dormers ?? w > 7.5) && !frontHidden) {
    const nd = Math.max(1, Math.floor(w / 4));
    for (let i = 0; i < nd; i++) {
      const u = -w / 2 + w * (i + 0.5) / nd;
      const dz = d * 0.2, dy = top + rise * 0.42;
      kit.add('plaster', box(1.3, 1.3, 1.6, 1), F.at(u, dy + 0.3, dz), { tint: plaster, ao: false });
      const g = gableRoof(1.6, 1.3, 0.7, 0.15, 0.1, 2);
      kit.add('roof', g.roof, F.at(u, dy + 0.95, dz, Math.PI / 2), { tint: roofC, ao: false });
      kit.add('window', box(0.7, 0.8, 0.06, 1), F.at(u, dy + 0.3, dz + 0.81), { ao: false });
    }
  }
  if (o.chimney ?? r.chance(0.75)) {
    const cx = (r.chance(0.5) ? 1 : -1) * (w / 2 - 0.8), cz = -d * 0.2;
    kit.add('stone', box(0.8, rise + 1.8, 0.8, 1), F.at(cx, top + (rise + 1.8) / 2, cz), { tint: 0xe8e2d6, ao: false });
    kit.add('stone', box(1.0, 0.18, 1.0, 1), F.at(cx, top + rise + 1.8, cz), { tint: TRIM_T, ao: false });
    for (const s of [-1, 1]) kit.add('roof', cyl(0.12, 0.12, 0.4, 6, 1), F.at(cx + s * 0.2, top + rise + 2.05, cz), { tint: 0xa05030, ao: false });
    const [wx, wz] = F.world(cx, cz); (kit.spots.chimneys ||= []).push([wx, y + top + rise + 2.2, wz]);
  }
  kit.block(rect(x, z, w + 0.3, d + 0.3, rot), 0.3);
  (kit.spots.roofs ||= []).push({ rect: [x, z, w + 0.9, d + 0.9, rot], color: roofC });
  (kit.spots.houses ||= []).push({ x, y, z, w, d, rot, shop: !!o.shop, floors, front: !frontHidden, door: !o.noDoor, seed: r.int(0, 1e6) });
  return { top: top + rise, F, eave: top };
}

/**
 * A row of townhouses along the line a→b, fronts facing the `street` point's side, bodies behind the line.
 * opts: { street: [x, z], depth: [min, max], widths, floors, seed, shopChance, skip: [[t0, t1]] (metres along), roofs }
 */
export function row(kit, a, b, H, { street, depth = [7, 9], widths = [5.5, 8.5], floors = [2, 3], seed = 1, shopChance = 0.4, skip = [], roofs = null, gap = 0, balcony = 0.3 } = {}) {
  const r = new RNG(seed);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
  let nx = dz, nz = -dx;
  if (street && (street[0] - a[0]) * nx + (street[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const rot = Math.atan2(nx, nz); // local +Z → (nx, nz), toward the street
  let t = 0; const out = [];
  while (t < len - 3) {
    let w = r.range(widths[0], widths[1]);
    if (t + w > len) w = len - t;
    if (w < 3.5) break;
    const mid = t + w / 2;
    if (!skip.some(([s0, s1]) => mid > s0 && mid < s1)) {
      const d = r.range(depth[0], depth[1]);
      const cx = a[0] + dx * mid - nx * d / 2, cz = a[1] + dz * mid - nz * d / 2;
      const res = townhouse(kit, cx, H(cx, cz), cz, rot, { w: w - 0.02, d, floors: r.int(floors[0], floors[1]), seed: r.int(0, 1e6), shop: r.chance(shopChance), balcony: r.chance(balcony), roof: roofs ? r.pick(roofs) : undefined, ridge: r.chance(0.3) ? 'z' : 'x' });
      out.push({ x: cx, z: cz, w, d, rot, ...res });
    }
    t += w + gap;
  }
  return out;
}

// ---------------------------------------------------------------- civic buildings
export function portico(kit, F, lx, lz, w, h, { n = 6, depth = 3, y = 0, pediment = true, tint = 0xf4f0e8 } = {}) {
  kit.add('marble', box(w + 1, 0.5, depth + 1, 2), F.at(lx, y + 0.25, lz), { tint });
  for (let i = 0; i < n; i++) {
    const u = lx - w / 2 + w * (i + 0.5) / n;
    const [cx, cz] = F.world(u, lz + depth / 2 - 0.3);
    P.column(kit, cx, F.y + y + 0.5, cz, h, 0.38, { tint });
  }
  kit.add('marble', box(w + 1, 0.7, depth + 1, 2), F.at(lx, y + h + 0.85, lz), { tint });
  if (pediment) {
    const tri = extrude([[-w / 2 - 0.5, 0], [w / 2 + 0.5, 0], [0, 2.2]], depth + 1.1, 2);
    kit.add('marble', tri, F.at(lx, y + h + 1.2, lz), { tint });
    kit.add('gold', sphere(0.5, 12, 8), F.at(lx, y + h + 2.3, lz + depth / 2 + 0.5, 0, 1, 1, 0.2), { ao: false });
  }
}
export function guildHall(kit, flags, x, y, z, rot, { banner = 0x2a5aa8 } = {}) {
  const F = new Frame(x, y, z, rot);
  const w = 24, d = 14, h = 9;
  kit.add('stone', box(w + 0.6, 1.0, d + 0.6, 2), F.at(0, 0.3, 0), { tint: 0xe6e0d4, yGround: y - 0.4 });
  kit.add('stone', walls(w, h, d, 2), F.at(0, h / 2 + 0.8, 0), { tint: STONE_T, yGround: y, aoH: 4 });
  kit.add('stone', box(w + 0.5, 0.35, d + 0.5, 1), F.at(0, 4.6, 0), { tint: TRIM_T, ao: false });
  kit.add('stone', box(w + 0.7, 0.45, d + 0.7, 1), F.at(0, h + 0.9, 0), { tint: TRIM_T, ao: false });
  // buttress pilasters + tall arched windows on the front
  for (let i = 0; i < 7; i++) {
    const u = -w / 2 + w * i / 6;
    kit.add('stone', box(0.7, h, 0.5, 1), F.at(u, h / 2 + 0.8, d / 2 + 0.2), { tint: TRIM_T });
    if (i < 6 && i !== 2 && i !== 3) { const wu = u + w / 12; archedWindow(kit, F, wu, 6.9, d / 2 + 0.01, 0, { w: 1.3, h: 2.6, shutter: null }); archedWindow(kit, F, wu, 2.7, d / 2 + 0.01, 0, { w: 1.2, h: 1.8, shutter: null }); }
  }
  portico(kit, F, 0, d / 2 + 2.2, 8.5, 6.5, { n: 4, depth: 3.4, y: 0.3 });
  archDoor(kit, F, 0, d / 2 + 0.02, 0, { w: 2.4, h: 3.6, y: 0.8, steps: 0 });
  // roof: hipped with a cupola
  const g = hipRoof(w, d, 5.5, 0.6, 2);
  kit.add('roof', g, F.at(0, h + 1.1, 0), { tint: ROOF.blue, ao: false });
  kit.add('stone', cyl(1.6, 1.8, 2.4, 8, 2), F.at(0, h + 5.8, 0), { tint: STONE_T });
  kit.add('roof', cone(2.3, 3, 8, 2), F.at(0, h + 8.5, 0), { tint: ROOF.blue, ao: false });
  kit.add('gold', cyl(0.05, 0.1, 1.6, 6, 1), F.at(0, h + 10.6, 0), { ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.add('window', box(0.5, 1.2, 0.1, 1), F.at(Math.cos(a) * 1.65, h + 5.8, Math.sin(a) * 1.65, -a + Math.PI / 2), { ao: false }); }
  // banners between pilasters
  for (const u of [-w / 2 + w * 2 / 6, w / 2 - w * 2 / 6]) P.banner(kit, flags, ...wp(F, u, d / 2 + 0.45, y + 8.4), rot, { w: 1.4, h: 4.2, color: banner });
  if (flags) flags.add(F.at(0.05, h + 11.3, 0), 1.6, 0.8, banner, { hang: 'left' });
  kit.block(rect(x, z, w + 0.8, d + 0.8, rot), 0.3);
  const [px, pz] = F.world(0, d / 2 + 2.2); kit.block(rect(px, pz, 9.5, 4.4, rot), 0.1);
  (kit.spots.roofs ||= []).push({ rect: [x, z, w + 1.2, d + 1.2, rot], color: ROOF.blue });
  return F;
}
export function bank(kit, flags, x, y, z, rot) {
  const F = new Frame(x, y, z, rot);
  const w = 14, d = 11, h = 7.5;
  kit.add('marble', box(w + 0.8, 0.9, d + 0.8, 2), F.at(0, 0.25, 0), { tint: 0xf0ece4, yGround: y - 0.4 });
  kit.add('marble', walls(w, h, d, 2), F.at(0, h / 2 + 0.7, 0), { tint: 0xf6f2ea, yGround: y, aoH: 4 });
  kit.add('marble', box(w + 0.5, 0.5, d + 0.5, 1), F.at(0, h + 0.8, 0), { tint: 0xfaf7f0, ao: false });
  portico(kit, F, 0, d / 2 + 1.9, w - 1, 6, { n: 6, depth: 3.0, y: 0.2 });
  archDoor(kit, F, 0, d / 2 + 0.02, 0, { w: 2.0, h: 3.2, y: 0.7, steps: 0, tint: 0x5a3a20 });
  for (const s of [-1, 1]) archedWindow(kit, F, s * 4.2, 3.4, d / 2 + 0.01, 0, { w: 1.3, h: 2.2, shutter: null });
  // golden dome
  kit.add('marble', cyl(4.2, 4.4, 1.6, 20, 2), F.at(0, h + 1.8, -0.5), { tint: 0xf6f2ea });
  kit.add('gold', sphere(4.2, 24, 12, TAU, Math.PI / 2), F.at(0, h + 2.5, -0.5, 0, 1, 0.8, 1), { ao: false });
  kit.add('gold', cyl(0.1, 0.18, 1.8, 8, 1), F.at(0, h + 6.6, -0.5), { ao: false });
  kit.add('gold', sphere(0.35, 10, 8), F.at(0, h + 7.6, -0.5), { ao: false });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; kit.add('window', box(0.5, 0.9, 0.1, 1), F.at(Math.cos(a) * 4.25, h + 1.8, -0.5 + Math.sin(a) * 4.25, -a + Math.PI / 2), { ao: false }); }
  kit.block(rect(x, z, w + 1, d + 1, rot), 0.3);
  const [px, pz] = F.world(0, d / 2 + 1.9); kit.block(rect(px, pz, w, 4, rot), 0.1);
  (kit.spots.roofs ||= []).push({ circle: [x, z, 4.4], color: 0xd8a840 });
  return F;
}
export function forge(kit, x, y, z, rot) {
  // open-fronted smithy: stone back walls, timber posts, lean-to roof, huge chimney + hood, glowing hearth & anvil
  const F = new Frame(x, y, z, rot);
  const w = 11, d = 8;
  kit.add('stone', box(w + 0.4, 0.5, d + 0.4, 2), F.at(0, 0.05, 0), { tint: 0xd8d0c4, yGround: y - 0.3 });
  kit.add('stone', box(w, 4.2, 0.7, 2), F.at(0, 2.35, -d / 2 + 0.35), { tint: 0xe0d8cc });
  kit.add('stone', box(0.7, 4.2, d, 2), F.at(-w / 2 + 0.35, 2.35, 0), { tint: 0xe0d8cc });
  for (const u of [-w / 2 + 0.35, -w / 6, w / 6, w / 2 - 0.3]) kit.add('timber', box(0.35, 4.4, 0.35, 1), F.at(u, 2.45, d / 2 - 0.3), {});
  kit.add('timber', box(0.35, 4.4, 0.35, 1), F.at(w / 2 - 0.3, 2.45, -d / 2 + 0.4), {});
  kit.add('timber', box(w + 0.4, 0.35, 0.35, 1), F.at(0, 4.6, d / 2 - 0.3), { ao: false });
  kit.add('roof', box(w + 1.4, 0.22, d + 1.6, 2), F.at(0, 5.3, 0, 0, 1, 1, 1, 0.24), { tint: ROOF.red, ao: false });
  // hearth + hood + chimney
  kit.add('stone', box(3.2, 1.2, 2.2, 1), F.at(-w / 2 + 2.3, 0.9, -d / 2 + 1.5), { tint: 0xc8c0b4 });
  kit.glow(box(2.4, 0.12, 1.5, 1), F.at(-w / 2 + 2.3, 1.52, -d / 2 + 1.5), 0xff5a18, 4.5);
  for (let i = 0; i < 9; i++) kit.add('dark', blob(0.18, 0), F.at(-w / 2 + 1.4 + (i % 3) * 0.8, 1.6, -d / 2 + 1.0 + Math.floor(i / 3) * 0.5), { tint: 0x1a1414, ao: false, cast: false });
  kit.add('stone', box(3.4, 1.6, 2.4, 1), F.at(-w / 2 + 2.3, 3.6, -d / 2 + 1.4, 0, 1, 1, 1, -0.12), { tint: 0xd0c8bc });
  kit.add('stone', box(1.8, 7, 1.8, 1.4), F.at(-w / 2 + 2.3, 6.6, -d / 2 + 1.0), { tint: 0xd8d0c4 });
  kit.add('stone', box(2.1, 0.3, 2.1, 1), F.at(-w / 2 + 2.3, 10.1, -d / 2 + 1.0), { tint: TRIM_T, ao: false });
  const [hx, hz] = F.world(-w / 2 + 2.3, -d / 2 + 1.5);
  kit.flame(hx, y + 1.62, hz, 0.45, 0xff7a20); kit.light(hx, y + 2.4, hz, 0xff7a30, 10, 12, 0.35);
  const [chx, chz] = F.world(-w / 2 + 2.3, -d / 2 + 1.0); (kit.spots.chimneys ||= []).push([chx, y + 10.4, chz]); (kit.spots.forge ||= []).push([hx, y + 1.6, hz]);
  // anvils, quench trough, racks, coal, bellows
  const [ax, az] = F.world(0.4, 0.6); P.anvil(kit, ax, y + 0.3, az, rot + 0.3);
  const [bx, bz] = F.world(2.8, -0.8); P.anvil(kit, bx, y + 0.3, bz, rot - 0.2, { hot: false });
  kit.add('planks', box(1.8, 0.7, 0.8, 1), F.at(-1.4, 0.65, 0.8), { tint: 0x7a5030 });
  kit.add('stone', box(1.6, 0.05, 0.6, 1), F.at(-1.4, 1.0, 0.8), { tint: 0x2a4050, ao: false });
  const [rx, rz] = F.world(w / 2 - 0.8, -1.2); P.weaponRack(kit, rx, y + 0.3, rz, rot - Math.PI / 2);
  const [bbx, bbz] = F.world(-w / 2 + 4.6, -d / 2 + 1.2); P.barrel(kit, bbx, y + 0.3, bbz, 1);
  kit.add('planks', box(1.4, 0.5, 0.9, 1), F.at(-w / 2 + 4.3, 1.2, -d / 2 + 2.6, 0.3), { tint: 0x6a4028, ao: false }); // bellows
  kit.block(rect(...F.world(0, -d / 2 + 0.35), w, 0.9, rot), 0.3);
  kit.block(rect(...F.world(-w / 2 + 0.35, 0), 0.9, d, rot), 0.3);
  kit.block(rect(...F.world(-w / 2 + 2.3, -d / 2 + 1.5), 3.4, 2.4, rot), 0.3);
  for (const u of [-w / 6, w / 6, w / 2 - 0.3]) kit.block(circle(...F.world(u, d / 2 - 0.3), 0.25), 0.25);
  kit.block(rect(...F.world(-1.4, 0.8), 1.9, 0.9, rot), 0.25);
  (kit.spots.roofs ||= []).push({ rect: [x, z, w + 1.4, d + 1.6, rot], color: ROOF.red });
  return F;
}
export function gatehouse(kit, flags, x, y, z, rot, { w = 9, h = 11, open = true, banner = 0x2a5aa8 } = {}) {
  const F = new Frame(x, y, z, rot);
  for (const s of [-1, 1]) {
    const [tx, tz] = F.world(s * (w / 2 + 3), 0);
    P.tower(kit, tx, y, tz, { r: 3.4, h: h + 2, roofH: 7, roof: ROOF.blue, flags, flag: banner });
  }
  const pts = archPanel(w + 1, h, 4.6, 4.2, 12);
  kit.add('stone', extrude(pts, 3.2, 2), F.at(0, 0, 0), { tint: STONE_T, yGround: y });
  for (let i = 0; i < Math.round(w / 1.2); i++) kit.add('stone', box(0.7, 0.9, 0.9, 1), F.at(-w / 2 + 0.5 + i * 1.2, h + 0.45, 1.2), { tint: STONE_T, ao: false });
  kit.add('stone', box(w + 1.2, 0.35, 3.6, 1), F.at(0, h - 0.1, 0), { tint: TRIM_T, ao: false });
  // raised portcullis teeth
  if (open) for (let i = 0; i < 6; i++) kit.add('metal', box(0.1, 1.1, 0.1, 1), F.at(-2 + i * 0.8, 7.9, 0.2), { tint: 0x2a2a2e, ao: false });
  kit.add('paint', box(2.4, 1.6, 0.1, 1), F.at(0, 8.2, 1.62), { tint: banner, ao: false });
  kit.add('gold', sphere(0.45, 10, 6), F.at(0, 8.2, 1.7, 0, 1, 1, 0.3), { ao: false });
  for (const s of [-1, 1]) P.wallTorch(kit, ...wp(F, s * 2.9, 1.62, y + 3.2), rot);
  for (const s of [-1, 1]) kit.block(rect(...F.world(s * (w / 2 - 0.6), 0), 2.4, 3.4, rot), 0.3);
}
export function keep(kit, flags, x, y, z) {
  // the royal keep: layered curtain walls, round towers with tall blue cones, a great hall and a soaring donjon
  const F = new Frame(x, y, z, 0);
  const T = (lx, lz, r, h, roofH, flag = 0x2a5aa8) => { const [tx, tz] = F.world(lx, lz); P.tower(kit, tx, y, tz, { r, h, roofH, roof: ROOF.blue, flags, flag }); };
  // lower curtain
  const cw = 60, cd = 34;
  for (const [ax, az, bx, bz] of [[-cw / 2, cd / 2, cw / 2, cd / 2], [-cw / 2, -cd / 2, -cw / 2, cd / 2], [cw / 2, -cd / 2, cw / 2, cd / 2]]) {
    const [x0, z0] = F.world(ax, az), [x1, z1] = F.world(bx, bz);
    P.wall(kit, x0, z0, x1, z1, () => y, { h: 9, t: 2.2, buttress: 3 });
  }
  T(-cw / 2, cd / 2, 4.2, 14, 9); T(cw / 2, cd / 2, 4.2, 14, 9); T(-cw / 2, -cd / 2, 4, 16, 9); T(cw / 2, -cd / 2, 4, 16, 9);
  // great hall
  kit.add('stone', box(34, 14, 16, 2), F.at(0, 7, -4), { tint: STONE_T, yGround: y, aoH: 6 });
  const gr = gableRoof(34, 16, 8, 0.8, 0.3, 2);
  kit.add('roof', gr.roof, F.at(0, 14, -4), { tint: ROOF.deepblue, ao: false });
  kit.add('stone', gr.gables, F.at(0, 14, -4), { tint: STONE_T, ao: false });
  for (let i = 0; i < 7; i++) archedWindow(kit, F, -15 + i * 5, 9, 4.02, 0, { w: 1.4, h: 3.2, shutter: null });
  for (let i = 0; i < 8; i++) kit.add('stone', box(1.0, 12, 1.0, 1), F.at(-16.5 + i * 4.7, 6, 4.3), { tint: TRIM_T });
  // donjon
  kit.add('stone', box(14, 30, 14, 2), F.at(0, 15, -12), { tint: STONE_T, yGround: y, aoH: 8 });
  kit.add('stone', box(15, 0.8, 15, 1), F.at(0, 30.2, -12), { tint: TRIM_T, ao: false });
  for (let i = 0; i < 4; i++) archedWindow(kit, F, -4.5 + i * 3, 22, -4.98, 0, { w: 1.2, h: 2.6, shutter: null });
  for (let i = 0; i < 3; i++) archedWindow(kit, F, -3 + i * 3, 15, -4.98, 0, { w: 1.1, h: 2.2, shutter: null });
  const hr = hipRoof(14, 14, 11, 0.8, 2);
  kit.add('roof', hr, F.at(0, 30.6, -12), { tint: ROOF.deepblue, ao: false });
  kit.add('gold', cyl(0.12, 0.2, 3, 8, 1), F.at(0, 43, -12), { ao: false });
  if (flags) flags.add(F.at(0.1, 44.2, -12), 3.2, 1.6, 0x2a5aa8, { hang: 'left' });
  for (const [lx, lz] of [[-7, -5], [7, -5], [-7, -19], [7, -19]]) T(lx, lz, 2.2, 33, 8);
  T(-12, 3, 3, 22, 8, 0xb02a2a); T(12, 3, 3, 22, 8, 0xb02a2a);
  // banners on the great hall
  for (const s of [-1, 1]) flags && P.banner(kit, flags, ...wp(F, s * 8, 4.4, y + 12.5), 0, { w: 2.2, h: 7, color: s > 0 ? 0x2a5aa8 : 0xb02a2a });
  return F;
}
export function lighthouse(kit, flags, x, y, z) {
  const F = new Frame(x, y, z, 0);
  kit.add('stone', cyl(3.4, 3.8, 2, 16, 2), F.at(0, 1, 0), { tint: 0xd8d0c4, yGround: y });
  kit.add('stone', cyl(2.2, 3.0, 17, 16, 2), F.at(0, 10.5, 0), { tint: STONE_T, yGround: y, aoH: 6 });
  for (let i = 0; i < 4; i++) kit.add('paint', cyl(2.25 + i * 0.02, 2.3 + i * 0.02, 1.2, 16, 1), F.at(0, 5 + i * 3.5, 0), { tint: 0xb03a2a, ao: false });
  kit.add('stone', cyl(3.0, 2.8, 0.6, 16, 1), F.at(0, 19.3, 0), { tint: TRIM_T, ao: false });
  kit.glow(cyl(1.4, 1.4, 2, 12, 1), F.at(0, 20.8, 0), 0xffe0a0, 3.5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.add('metal', box(0.12, 2.2, 0.12, 1), F.at(Math.cos(a) * 1.5, 20.8, Math.sin(a) * 1.5), { tint: 0x2a2a2e, ao: false }); }
  kit.add('roof', cone(2.2, 2.4, 16, 2), F.at(0, 23, 0), { tint: ROOF.red, ao: false });
  kit.light(x, y + 21, z, 0xffe0a0, 8, 18, 0.05);
  kit.block(circle(x, z, 3.9), 0.3);
}

// ---------------------------------------------------------------- harbour
/** A moored ship: lofted hull, deck, masts with furled/half sails, rigging lines. Bow toward local -Z. */
export function ship(kit, flags, x, y, z, rot, { len = 22, beam = 6.5, masts = 2, hull = 0x6a4028, stripe = 0x2a4a8a, sail = 0xf2ead8, seed = 1 } = {}) {
  const F = new Frame(x, y, z, rot), r = new RNG(seed);
  // hull cross-sections along z (−len/2 bow → +len/2 stern)
  const S = 14, R = 10, pos = [], idx = [], uv = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S, zz = -len / 2 + t * len;
    const bowT = Math.min(1, t / 0.28), sternT = Math.min(1, (1 - t) / 0.18);
    const wmul = Math.sin(Math.min(bowT, 1) * Math.PI / 2) * (0.75 + 0.25 * sternT) ;
    const halfW = beam / 2 * Math.max(0.05, wmul);
    const keel = -2.2 * Math.max(0.15, Math.min(bowT, sternT * 1.5, 1));
    const sheer = 1.2 + (1 - bowT) * 1.4 + (1 - sternT) * 1.2;
    for (let j = 0; j <= R; j++) {
      const a = j / R * Math.PI; // 0 → starboard gunwale, π → port gunwale, through the keel
      const cx = Math.cos(a) * halfW;
      const yy = keel + (sheer - keel) * (1 - Math.sin(a));
      pos.push(cx * (0.75 + 0.25 * (1 - Math.sin(a))), yy, zz); uv.push(j / R * 3, t * len / 2);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hg.setIndex(idx); hg.computeVertexNormals();
  const cH = new THREE.Color(hull), cS = new THREE.Color(stripe), cK = new THREE.Color(0x3a2418);
  kit.add('planks', hg, F.at(0, 0, 0), { tint: (p) => { const ly = p.y - y; const c = ly > 0.55 && ly < 0.95 ? cS : ly < -0.3 ? cK : cH; return [c.r, c.g, c.b]; } });
  // deck
  kit.add('planks', box(beam * 0.78, 0.15, len * 0.8, 1.5), F.at(0, 1.05, 0.5), { tint: 0xb08a60, ao: false });
  // stern castle + cabin
  kit.add('planks', box(beam * 0.75, 1.8, 4.5, 1.5), F.at(0, 1.95, len / 2 - 3.2), { tint: hull });
  kit.add('planks', box(beam * 0.8, 0.15, 4.8, 1.5), F.at(0, 2.9, len / 2 - 3.2), { tint: 0xb08a60, ao: false });
  for (let i = 0; i < 3; i++) kit.add('window', box(0.6, 0.5, 0.1, 1), F.at(-1.2 + i * 1.2, 2.1, len / 2 - 0.92), { ao: false });
  // rails
  for (const s of [-1, 1]) kit.add('timber', box(0.12, 0.35, len * 0.72, 1), F.at(s * beam * 0.38, 1.4, 0.2), { ao: false });
  // bowsprit
  kit.add('timber', cyl(0.12, 0.18, 7, 8, 1), F.at(0, 2.6, -len / 2 - 2, 0, 1, 1, 1, -Math.PI / 2 + 0.35), { ao: false });
  // masts + yards + furled sails
  const mz = masts === 3 ? [-5, 0.5, 5.5] : [-3.5, 3.5];
  mz.forEach((m, k) => {
    const mh = (k === 1 || masts === 2 && k === 0 ? 16 : 13) * len / 22;
    kit.add('timber', cyl(0.16, 0.26, mh, 8, 1), F.at(0, 1 + mh / 2, m), {});
    for (let yy = 0; yy < 2; yy++) {
      const ay = 1 + mh * (0.45 + yy * 0.33), yl = (5.4 - yy * 1.3) * len / 22;
      kit.add('timber', cyl(0.08, 0.08, yl, 6, 1), F.at(0, ay, m, 0, 1, 1, 1, 0, Math.PI / 2), { ao: false });
      // half-furled sail: a billowing cloth slab below the yard
      const sg = new THREE.PlaneGeometry(yl * 0.92, 2.6 - yy * 0.6, 6, 3);
      const sp = sg.attributes.position; for (let q = 0; q < sp.count; q++) { const sx = sp.getX(q) / (yl * 0.46), sy = sp.getY(q); sp.setZ(q, (1 - sx * sx) * 0.5 * (0.6 + 0.4 * (1 - sy))); }
      sg.computeVertexNormals();
      kit.add('cloth', sg, F.at(0, ay - 1.4 + yy * 0.3, m + 0.1), { tint: sail, ao: false });
    }
    kit.add('timber', cyl(0.35, 0.35, 0.5, 8, 1), F.at(0, 1 + mh * 0.82, m), { ao: false }); // crow's nest
    if (flags) flags.add(F.at(0.05, 1 + mh + 0.4, m), 1.6, 0.5, stripe, { hang: 'left' });
    // shrouds
    for (const s of [-1, 1]) for (let q = 0; q < 3; q++) kit.add('timber', tube([V(s * beam * 0.4, 1.3, m - 0.8 + q * 0.8), V(0, 1 + mh * 0.8, m)], [0.025, 0.02], 3, false), F.m, { tint: 0x3a2a1a, ao: false, chunkAt: [x, z] });
  });
  // stays bow→mast→stern
  kit.add('timber', tube([V(0, 3.6, -len / 2 - 4.5), V(0, 1 + 16 * len / 22, mz[0])], [0.03, 0.03], 3, false), F.m, { tint: 0x3a2a1a, ao: false, chunkAt: [x, z] });
  // cargo
  for (let i = 0; i < 3; i++) P.barrel(kit, ...wp(F, r.range(-1.2, 1.2), r.range(-4, 2), y + 1.12), 0.9, r.range(0, 6), { block: false });
  (kit.spots.roofs ||= []).push({ rect: [x, z, beam * 0.9, len, rot], color: 0x8a5a34 });
}
export function crane(kit, x, y, z, rot, { h = 9 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('stone', box(2.6, 0.6, 2.6, 1), F.at(0, 0.3, 0), { tint: 0xd8d0c4 });
  for (const s of [-1, 1]) kit.add('timber', box(0.35, h, 0.35, 1), F.at(s * 0.9, h / 2, 0, 0, 1, 1, 1, 0, -s * 0.08), {});
  for (let i = 1; i < 4; i++) kit.add('timber', box(1.9 - i * 0.2, 0.2, 0.2, 1), F.at(0, i * h / 4, 0), { ao: false });
  // jib out over the water (local +Z)
  kit.add('timber', box(0.3, 0.3, 7.5, 1), F.at(0, h - 0.6, 3.2, 0, 1, 1, 1, -0.22), {});
  kit.add('timber', tube([V(0, h + 0.3, 0), V(0, h - 1.8, 6.6)], [0.03, 0.03], 3, false), F.m, { tint: 0x3a2a1a, ao: false });
  kit.add('timber', tube([V(0, h - 1.9, 6.6), V(0, 2.5, 6.6)], [0.03, 0.03], 3, false), F.m, { tint: 0x3a2a1a, ao: false });
  P.crate(kit, ...wp(F, 0, 6.6, y + 1.9), 0.9, rot + 0.3, { block: false });
  // treadwheel
  const wheel = new THREE.TorusGeometry(1.4, 0.12, 6, 18);
  kit.add('timber', wheel, F.at(0, 1.8, -1.2), { ao: false });
  for (let k = 0; k < 4; k++) kit.add('timber', box(0.08, 2.8, 0.08, 1), F.at(0, 1.8, -1.2, 0, 1, 1, 1, 0, k * Math.PI / 4), { ao: false });
  kit.block(rect(x, z, 2.8, 3.2, rot), 0.3);
}
/** timber pier on posts: from (x,z) extending along local -Z for len, width w, deck at height deckY (absolute) */
export function pier(kit, x, z, rot, len, w, deckY, { posts = 3 } = {}) {
  const F = new Frame(x, deckY, z, rot);
  kit.add('planks', box(w, 0.22, len, 2.2), F.at(0, 0, -len / 2), { tint: 0xb89068, ao: false });
  for (let i = 0; i <= len; i += posts) for (const s of [-1, 1]) kit.add('timber', cyl(0.18, 0.2, 4, 8, 1), F.at(s * (w / 2 - 0.1), -1.8, -i), { tint: 0x8a6a4a });
  for (const s of [-1, 1]) kit.add('timber', box(0.14, 0.14, len, 1), F.at(s * (w / 2 + 0.05), 0.08, -len / 2), { ao: false });
  // mooring bollards
  for (let i = 4; i < len; i += 7) for (const s of [-1, 1]) kit.add('timber', cyl(0.16, 0.2, 0.8, 8, 1), F.at(s * (w / 2 - 0.3), 0.45, -i), { tint: 0x6a4a30 });
  return F;
}

// ---------------------------------------------------------------- arcane & monuments
/** portal pad: raised round dais, rune ring (glowing), four standing stones, an arch frame. colour = portal theme */
export function portalPad(kit, x, y, z, rot, { color = 0x9a6aff, r = 3.2 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('stone', cyl(r + 0.5, r + 0.7, 0.5, 24, 2), F.at(0, 0.25, 0), { tint: 0xd8d2c8, yGround: y });
  kit.add('marble', cyl(r, r, 0.12, 24, 2), F.at(0, 0.55, 0), { tint: 0xe8e4dc, ao: false });
  const ring = new THREE.TorusGeometry(r - 0.35, 0.06, 4, 48); ring.rotateX(Math.PI / 2);
  kit.glow(ring, F.at(0, 0.62, 0), color, 3.2);
  const ring2 = new THREE.TorusGeometry(r * 0.55, 0.04, 4, 40); ring2.rotateX(Math.PI / 2);
  kit.glow(ring2, F.at(0, 0.62, 0), color, 2.6);
  // arch behind (north side, local -Z)
  const archG = new THREE.TorusGeometry(r * 0.95, 0.32, 8, 24, Math.PI);
  kit.add('stone', archG, F.at(0, 0.6, -r * 0.35), { tint: 0xe6e0d4, ao: false });
  for (const s of [-1, 1]) {
    kit.add('stone', box(0.8, 0.9, 0.8, 1), F.at(s * r * 0.95, 1.0, -r * 0.35), { tint: 0xe0dacd });
    kit.glow(box(0.14, 0.6, 0.06, 1), F.at(s * r * 0.95, 2.3, -r * 0.35 + 0.34), color, 3);
  }
  kit.glow(sphere(0.32, 12, 8), F.at(0, r * 0.95 + 0.6, -r * 0.35), color, 4);
  kit.light(x, y + 2.2, z, color, 5, 9, 0.12);
  kit.block(subtractArch(F, r), 0.1);
  return F;
}
function subtractArch(F, r) { // only the arch feet block movement; the dais itself is walkable (portals are stepped onto)
  const [ax, az] = F.world(-r * 0.95, -r * 0.35), [bx, bz] = F.world(r * 0.95, -r * 0.35);
  return { sd: (x, z) => Math.min(Math.hypot(x - ax, z - az), Math.hypot(x - bx, z - bz)) - 0.55, box: [Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1] };
}
/** triport: a floating blue crystal over a carved pedestal (waypoint) */
export function triport(kit, x, y, z, { color = 0x6ac8ff } = {}) {
  const F = new Frame(x, y, z, 0);
  kit.add('stone', cyl(1.6, 1.9, 0.4, 8, 1), F.at(0, 0.2, 0), { tint: 0xe0dacd, yGround: y });
  kit.add('marble', cyl(0.7, 1.1, 1.2, 8, 1), F.at(0, 1.0, 0), { tint: 0xeeeae2 });
  kit.add('gold', cyl(1.15, 1.15, 0.12, 8, 1), F.at(0, 1.62, 0), { ao: false });
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; kit.add('marble', box(0.25, 1.8, 0.25, 1), F.at(Math.cos(a) * 0.95, 2.4, Math.sin(a) * 0.95, -a, 1, 1, 1, 0, 0.25), { tint: 0xeeeae2 }); }
  const cr = new THREE.OctahedronGeometry(0.55, 0); cr.scale(0.8, 1.9, 0.8);
  kit.glow(cr, F.at(0, 3.4, 0), color, 2.8);
  kit.light(x, y + 3.4, z, color, 6, 10, 0.08);
  kit.block(circle(x, z, 1.7), 0.3);
  (kit.spots.crystals ||= []).push([x, y + 3.4, z]);
}
/** The Seven Lights: seven robed stone figures in a ring, hands raised to a golden prism (the Sunheart). */
export function sevenLights(kit, x, y, z, { r = 1.5 } = {}) {
  const F = new Frame(x, y, z, 0);
  kit.add('marble', cyl(2.6, 2.9, 1.4, 14, 2), F.at(0, 0.7, 0), { tint: 0xf2eee6 });
  kit.add('marble', cyl(2.9, 2.9, 0.25, 14, 2), F.at(0, 1.45, 0), { tint: 0xfaf7f0, ao: false });
  kit.add('gold', cyl(2.95, 2.95, 0.1, 14, 1), F.at(0, 1.2, 0), { ao: false });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU;
    const fx = Math.cos(a) * r, fz = Math.sin(a) * r;
    const ry = Math.atan2(-fx, -fz) + Math.PI; // facing outward
    const G = F.m.clone().multiply(M(fx, 1.55, fz, ry));
    const at = (lx, ly, lz, ...rest) => G.clone().multiply(M(lx, ly, lz, ...rest));
    kit.add('marble', cone(0.55, 2.1, 10, 1), at(0, 1.05, 0), { tint: 0xf4f0e8 });            // robe
    kit.add('marble', cyl(0.22, 0.36, 0.7, 10, 1), at(0, 2.2, 0), { tint: 0xf4f0e8 });        // torso
    kit.add('marble', sphere(0.2, 10, 8), at(0, 2.72, -0.02), { tint: 0xf4f0e8 });            // head
    kit.add('marble', sphere(0.26, 10, 8, TAU, Math.PI * 0.6), at(0, 2.76, 0.03, 0, 1, 1.1, 1, -0.2), { tint: 0xece6dc }); // hood
    for (const s of [-1, 1]) kit.add('marble', tube([V(s * 0.25, 2.35, 0), V(s * 0.28, 2.85, 0.35), V(s * 0.12, 3.35, 0.72)], [0.09, 0.08, 0.07], 6, true), G, { tint: 0xf4f0e8, ao: false });
  }
  // the Sunheart
  const prism = new THREE.OctahedronGeometry(0.62, 0); prism.scale(1, 1.5, 1);
  kit.add('gold', cyl(0.12, 0.2, 1.2, 8, 1), F.at(0, 4.4, 0), { ao: false });
  kit.glow(prism, F.at(0, 5.6, 0), 0xffd070, 3.4);
  kit.light(x, y + 5.6, z, 0xffd48a, 7, 14, 0.05);
  (kit.spots.sunheart ||= []).push([x, y + 5.6, z]);
}

/**
 * Low arcade (one storey of arches with a flat roof terrace and balustrade) along a→b, arches facing `street`.
 * The iso-friendly way to line the SOUTH side of a street: it never hides the hero or the street behind a roof.
 */
export function arcade(kit, a, b, H, { street, depth = 5, h = 4.4, bay = 3.2, seed = 1, goods = true, pots = true } = {}) {
  const r = new RNG(seed);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
  let nx = dz, nz = -dx;
  if (street && (street[0] - a[0]) * nx + (street[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const rot = Math.atan2(nx, nz);
  const cx = (a[0] + b[0]) / 2 - nx * depth / 2, cz = (a[1] + b[1]) / 2 - nz * depth / 2;
  const y = H(cx, cz);
  const F = new Frame(cx, y, cz, rot);
  kit.add('stone', box(len, 0.4, depth, 2), F.at(0, 0.1, 0), { tint: 0xe2dccf, yGround: y - 0.2 });
  kit.add('stone', walls(len, h, 0.6, 2), F.at(0, h / 2, -depth / 2 + 0.3), { tint: STONE_T, yGround: y, aoH: 3 });
  for (const s of [-1, 1]) kit.add('stone', box(0.6, h, depth, 2), F.at(s * (len / 2 - 0.3), h / 2, 0), { tint: STONE_T, yGround: y, aoH: 3 });
  const n = Math.max(1, Math.round(len / bay));
  for (let i = 0; i <= n; i++) {
    const u = -len / 2 + len * i / n;
    kit.add('stone', box(0.7, h - 0.9, 0.7, 1), F.at(u, (h - 0.9) / 2 + 0.3, depth / 2 - 0.35), { tint: TRIM_T, yGround: y, aoH: 2 });
    kit.add('stone', box(0.9, 0.25, 0.9, 1), F.at(u, h - 0.72, depth / 2 - 0.35), { tint: TRIM_T, ao: false });
    if (i < n) {
      const bw = len / n - 0.7;
      const arch = new THREE.TorusGeometry(bw / 2, 0.22, 4, 12, Math.PI);
      kit.add('stone', arch, F.at(u + len / n / 2, h - 0.85 - bw / 2, depth / 2 - 0.35), { tint: TRIM_T, ao: false });
      kit.add('stone', box(len / n, 0.9, 0.5, 1), F.at(u + len / n / 2, h - 0.45, depth / 2 - 0.35), { tint: STONE_T, ao: false });
      // interior: shop counter and wares against the back wall
      if (goods && r.chance(0.8)) {
        kit.add('planks', box(bw * 0.8, 0.9, 0.7, 1), F.at(u + len / n / 2, 0.75, -depth / 2 + 1.0), { tint: 0x8a5a38, ao: false });
        for (let k = 0; k < 4; k++) kit.add('paint', blob(0.12, 0), F.at(u + len / n / 2 + (k - 1.5) * bw * 0.18, 1.3, -depth / 2 + 1.0), { tint: r.pick([0xe03020, 0x60b030, 0xf0c030, 0x4a70c0, 0xc050c0]), ao: false, cast: false });
        kit.add('cloth', box(bw * 0.9, 0.9, 0.04, 1), F.at(u + len / n / 2, h - 1.2, -depth / 2 + 0.62), { tint: r.pick([0xb03030, 0x2f5fa8, 0x2f8a5a, 0xd09a30]), ao: false, cast: false });
      }
    }
  }
  kit.add('stone', box(len + 0.2, 0.5, depth + 0.2, 2), F.at(0, h + 0.05, 0), { tint: TRIM_T, ao: false });
  kit.add('stone', box(len - 0.2, 0.08, depth - 0.2, 2), F.at(0, h + 0.33, 0), { tint: 0xd8d0c4, ao: false });
  // roof terrace: balustrade along the front, flower pots
  const [fa, fb] = [F.world(-len / 2 + 0.3, depth / 2 - 0.1), F.world(len / 2 - 0.3, depth / 2 - 0.1)];
  P.balustrade(kit, fa[0], fa[1], fb[0], fb[1], y + h + 0.3, { h: 0.8, block: false });
  if (pots) for (let i = 0; i < n; i++) {
    const [px, pz] = F.world(-len / 2 + len * (i + 0.5) / n, i % 2 ? 1.2 : -0.9);
    if (i % 3 === 1) { // rooftop café: parasol, round table, two stools
      const col = r.pick([0xc03a3a, 0x2f5fa8, 0x2f8a5a, 0xe0a030]);
      kit.add('cloth', cone(1.3, 0.55, 10, 1), M(px, y + h + 2.55, pz), { tint: col, ao: false });
      kit.add('metal', cyl(0.03, 0.03, 2.3, 5, 1), M(px, y + h + 1.45, pz), { tint: 0x2a2a2a, ao: false });
      kit.add('planks', cyl(0.45, 0.45, 0.06, 10, 1), M(px, y + h + 1.05, pz), { tint: 0xa87850, ao: false });
      for (const s of [-1, 1]) kit.add('planks', cyl(0.18, 0.18, 0.45, 8, 1), M(px + s * 0.75, y + h + 0.55, pz), { tint: 0x8a6040, ao: false });
    } else { P.flowerPot(kit, px, y + h + 0.37, pz, { color: r.pick([0xe04060, 0xf4d040, 0xffffff, 0xff8ab0]) }); kit.colliders.pop(); }
  }
  // only the back wall and the piers block: the arcade itself is walkable shade
  kit.block(line([F.world(-len / 2, -depth / 2 + 0.3), F.world(len / 2, -depth / 2 + 0.3)], 0.8), 0.3);
  for (const s of [-1, 1]) kit.block(line([F.world(s * (len / 2 - 0.3), -depth / 2), F.world(s * (len / 2 - 0.3), depth / 2)], 0.7), 0.3);
  for (let i = 0; i <= n; i++) kit.block(circle(...F.world(-len / 2 + len * i / n, depth / 2 - 0.35), 0.4), 0.25);
  for (let i = 0; i < n; i++) kit.block(rect(...F.world(-len / 2 + len * (i + 0.5) / n, -depth / 2 + 1.0), len / n * 0.8, 0.8, rot), 0.2);
  (kit.spots.roofs ||= []).push({ rect: [cx, cz, len, depth, rot], color: 0xd8d0c4 });
  return F;
}

/**
 * Dress the visible fronts of every townhouse built so far: sidewalk strip (painted into the ground), flower pots
 * by the door, barrels / crates / sacks at shops, benches, wall lanterns. `paint(shape)` paints a sidewalk.
 */
export function dressStreets(kit, { paint = null, decals = null, skip = () => false, lamps = 0.55 } = {}) {
  for (const h of kit.spots.houses || []) {
    if (!h.front || skip(h)) continue;
    const r = new RNG(h.seed);
    const F = new Frame(h.x, h.y, h.z, h.rot);
    const fz = h.d / 2;
    if (paint) paint(rect(...F.world(0, fz + 1.05), h.w + 0.1, 2.1, h.rot));
    const at = (lx, lz) => F.world(lx, fz + lz);
    // door side: flower pots and a wall lantern
    if (h.door) {
      if (r.chance(0.7)) for (const s of [-1, 1]) { const [px, pz] = at(s * 1.25, 0.45); P.flowerPot(kit, px, h.y, pz, { s: 0.9, color: r.pick([0xe04060, 0xf4d040, 0xffffff, 0xff8ab0, 0xa070e0]) }); }
      if (r.chance(lamps)) { const [lx, lz] = at(r.chance(0.5) ? 1.5 : -1.5, 0.02); P.wallLamp(kit, lx, h.y + 2.7, lz, h.rot); }
    }
    // along the facade
    const slots = [[-h.w / 2 + 0.9], [h.w / 2 - 0.9]];
    for (const [lx] of slots) {
      const roll = r.next();
      const [px, pz] = at(lx, 0.6);
      if (h.shop && roll < 0.45) { P.barrel(kit, px, h.y, pz, 0.9, r.range(0, 6)); if (r.chance(0.6)) { const [qx, qz] = at(lx + Math.sign(-lx) * 0.8, 0.5); P.crate(kit, qx, h.y, qz, 0.65, h.rot + r.range(-0.3, 0.3)); } }
      else if (h.shop && roll < 0.7) { P.sack(kit, px, h.y, pz, 1, r.range(0, 6)); const [qx, qz] = at(lx + Math.sign(-lx) * 0.6, 0.45); P.sack(kit, qx, h.y, qz, 0.85, r.range(0, 6)); }
      else if (roll < 0.62 && h.w > 6.5) { const [bx, bz] = at(lx * 0.55, 0.55); P.bench(kit, bx, h.y, bz, h.rot, { w: 1.6 }); break; }
      else if (roll < 0.8) { const [qx, qz] = at(lx, 0.55); P.planter(kit, qx, h.y, qz, { w: 1.2, d: 0.55, h: 0.5, ry: h.rot, seed: r.int(0, 999) }); }
    }
    if (decals && r.chance(0.5)) { const [sx, sz] = at(r.range(-h.w / 2, h.w / 2), 0.9); decals.add(r.pick(['stain', 'stain', 'leaves', 'pebbles']), sx, sz, { size: r.range(1.2, 2.2), alpha: 0.6 }); }
  }
}
