// Volcanic & Legion props for Ashen Ridge (and the siege of Brighthold), merged into a FieldKit.
//   obsidianSpire, spikeWall, fortressTower, fortressGate, legionBanner, skullPike, cage, firePit, siegeEngine,
//   rails, mineCart, mineEntrance, sulphurVent, charredPost, rubble
import * as THREE from 'three';
import { RNG, Simplex, clamp } from '../../core/noise.js';
import { blob, tube } from '../../engine/geom.js';
import { box, cyl, cone, sphere, M, Frame, extrude, archPanel } from '../kit.js';
import { spike } from '../cliffs.js';
import * as S from '../shapes.js';
import * as F from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const IRON = 0x2a2624, DARK = 0x3a3434;

/** jagged black glass spire with glowing veins (uses the kit 'dark' material: emissive cracks) */
export function obsidianSpire(kit, x, y, z, { h = 6, r = 1.1, lean = 0.3, dir = 0, seed = 1, block = true } = {}) {
  const rng = new RNG(seed);
  spike(kit, x, y, z, { h, r, bend: lean * h * 0.3, dir, mat: 'dark', tint: 0x4a4048, block, seg: 6 });
  for (let i = 0; i < 3; i++) { const a = rng.range(0, TAU), d = r * rng.range(0.8, 1.4); spike(kit, x + Math.cos(a) * d, y, z + Math.sin(a) * d, { h: h * rng.range(0.3, 0.55), r: r * rng.range(0.35, 0.55), bend: rng.range(0.2, 0.8), dir: a, mat: 'dark', tint: 0x3a3440, block: false, seg: 5 }); }
}
/** Legion wall from a→b: dark stone blocks, a glowing rune band, spiked crenellations. hAt = ground height fn */
export function spikeWall(kit, ax, az, bx, bz, hAt, { h = 9, t = 2.6, seed = 1, rune = 0xff4a1a, spikes = true, block = true } = {}) {
  const rng = new RNG(seed), len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), n = Math.max(1, Math.ceil(len / 5));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2, x = ax + (bx - ax) * tm, z = az + (bz - az) * tm;
    const y = Math.min(hAt(ax + (bx - ax) * t0, az + (bz - az) * t0), hAt(x, z), hAt(ax + (bx - ax) * t1, az + (bz - az) * t1));
    const seg = len / n + 0.04;
    kit.add('darkrock', box(seg, h + 1.5, t, 2), M(x, y + h / 2 - 0.75, z, ang), { tint: 0x5a5250, yGround: y, aoH: 4 });
    kit.add('darkrock', box(seg, 0.6, t + 0.6, 2), M(x, y + 1.0, z, ang), { tint: 0x4a4240, ao: false });                       // plinth course
    kit.add('darkrock', box(seg, 0.5, t + 0.4, 1), M(x, y + h + 0.05, z, ang), { tint: 0x6a605c, ao: false });                   // coping
    kit.glow(box(seg * 0.9, 0.14, t + 0.02, 1), M(x, y + h * 0.62, z, ang), rune, 1.6);                                             // rune band
    if (spikes) {
      const m = Math.max(1, Math.round(seg / 1.6));
      for (let k = 0; k < m; k++) {
        const u = (k + 0.5) / m - 0.5, cx = x + Math.cos(ang) * u * seg, cz = z - Math.sin(ang) * u * seg;
        kit.add('darkrock', box(seg / m * 0.5, 1.0, t * 0.5, 1), M(cx, y + h + 0.8, cz, ang), { tint: 0x5a5250, ao: false });
        kit.add('bone', cone(0.22, 1.1 + rng.range(0, 0.6), 5, 1), M(cx, y + h + 1.8, cz, ang), { tint: 0x2a2424, ao: false });
      }
    }
    if (i % 2 === 0) kit.add('darkrock', box(1.4, h * 0.8, 1.2, 2), M(x + Math.sin(ang) * (t / 2 + 0.5), y + h * 0.35, z + Math.cos(ang) * (t / 2 + 0.5), ang, 1, 1, 1, 0.1), { tint: 0x4a4240, yGround: y });
  }
  if (block) kit.block(S.line([[ax, az], [bx, bz]], t), 0.35);
}
/** round Legion tower with horn spikes and a burning crown */
export function fortressTower(kit, flags, x, y, z, { r = 4, h = 14, fire = 0xff6a20, seed = 1, banner = 0x8a1414 } = {}) {
  const rng = new RNG(seed), F0 = new Frame(x, y, z, 0);
  kit.add('darkrock', cyl(r * 0.92, r * 1.12, h, 12, 2), F0.at(0, h / 2 - 0.5, 0), { tint: 0x5a5250, yGround: y, aoH: 6 });
  kit.add('darkrock', cyl(r * 1.18, r * 1.1, 1.0, 12, 2), F0.at(0, h - 0.2, 0), { tint: 0x6a605c, ao: false });
  for (let i = 0; i < 3; i++) kit.glow(cyl(r * 0.94 + 0.02, r * 0.94 + 0.02, 0.14, 12, 1, true), F0.at(0, h * (0.3 + i * 0.2), 0), fire, 1.3);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const [sx, sz] = F0.world(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); spike(kit, sx, y + h + 0.1, sz, { h: 2.4 + (i % 2) * 1.2, r: 0.4, bend: 0.9, dir: a, mat: 'bone', tint: 0x2e2828, block: false, seg: 5 }); }
  // horns
  for (const s of [-1, 1]) spike(kit, x + s * r * 0.9, y + h * 0.7, z + r * 0.4, { h: 4.5, r: 0.7, bend: 2.4, dir: s > 0 ? 0 : Math.PI, mat: 'bone', tint: 0x3a3232, block: false, seg: 7 });
  kit.glow(cyl(r * 0.7, r * 0.6, 0.3, 10, 1), F0.at(0, h + 0.4, 0), fire, 3.2);
  kit.flame(x, y + h + 0.6, z, r * 0.45, fire);
  kit.light(x, y + h + 2, z, fire, 10, 18, 0.3);
  if (flags) flags.add(F0.at(r * 1.1 + 0.3, h - 1.5, 0, Math.PI / 2), 1.4, 3.6, banner, { hang: 'top', trim: 0x1a1414 });
  kit.block(S.circle(x, z, r * 1.12), 0.35);
  (kit.spots.roofs ||= []).push({ circle: [x, z, r * 1.1], color: 0x3a3434 });
  void rng;
}
/** the fortress gate: two towers, a massive arched gatehouse, a raised spiked portcullis, a horned skull crest */
export function fortressGate(kit, flags, x, y, z, rot, { w = 10, h = 13, open = true, fire = 0xff6a20 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  for (const s of [-1, 1]) { const [tx, tz] = F0.world(s * (w / 2 + 4.2), 0); fortressTower(kit, flags, tx, y, tz, { r: 4.2, h: h + 3, fire, seed: s + 3 }); }
  const pts = archPanel(w + 2, h, 6.4, 5.6, 12);
  kit.add('darkrock', extrude(pts, 5, 2), F0.at(0, 0, 0), { tint: 0x5a5250, yGround: y, aoH: 5 });
  kit.add('darkrock', box(w + 2.6, 0.8, 5.6, 1), F0.at(0, h + 0.2, 0), { tint: 0x6a605c, ao: false });
  // teeth of the raised portcullis
  if (open) for (let i = 0; i < 7; i++) { kit.add('metal', box(0.18, 1.6, 0.18, 1), F0.at(-2.7 + i * 0.9, 7.7, 0.4), { tint: IRON, ao: false }); kit.add('metal', cone(0.12, 0.4, 4, 1), F0.at(-2.7 + i * 0.9, 6.7, 0.4, 0, 1, -1, 1), { tint: IRON, ao: false }); }
  else { for (let i = 0; i < 8; i++) kit.add('metal', box(0.16, 8.4, 0.16, 1), F0.at(-3.1 + i * 0.88, 4.2, 0.4), { tint: IRON, ao: false }); for (let i = 0; i < 5; i++) kit.add('metal', box(6.6, 0.16, 0.16, 1), F0.at(0, 0.8 + i * 1.7, 0.45), { tint: IRON, ao: false }); }
  // horned skull crest over the arch
  kit.add('bone', blob(0.9, 1, d => 1 + Math.max(0, d.y) * 0.2, [1.1, 1, 0.8]), F0.at(0, h - 2.2, 2.6), { tint: 0xd8ccb0 });
  for (const s of [-1, 1]) { kit.glow(sphere(0.18, 8, 6), F0.at(s * 0.34, h - 2.1, 3.3), 0xff3010, 3); const [hx, hz] = F0.world(s * 0.8, 2.6); spike(kit, hx, y + h - 1.8, hz, { h: 2.6, r: 0.3, bend: 1.3, dir: rot + (s > 0 ? 0 : Math.PI), mat: 'bone', tint: 0xc8b898, block: false, seg: 6 }); }
  // glowing runes down the arch jambs
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) kit.glow(box(0.5, 0.12, 0.05, 1), F0.at(s * 3.6, 1.2 + i * 1.1, 2.52), fire, 2.4);
  for (const s of [-1, 1]) kit.block(S.rect(...F0.world(s * (w / 2 - 0.3), 0), 2.8, 5.2, rot), 0.3);
  if (!open) kit.block(S.rect(x, z, w, 1.2, rot), 0.2);
}
/** tall Legion standard: black pole, horned crest, a long crimson banner */
export function legionBanner(kit, flags, x, y, z, rot = 0, { h = 7, color = 0x8a1414 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('metal', cyl(0.08, 0.1, h, 6, 1), F0.at(0, h / 2, 0), { tint: IRON });
  kit.add('metal', box(1.6, 0.1, 0.1, 1), F0.at(0, h - 0.4, 0), { tint: IRON, ao: false });
  for (const s of [-1, 1]) kit.add('bone', cone(0.1, 0.7, 5, 1), F0.at(s * 0.3, h + 0.2, 0, 0, 1, 1, 1, 0, -s * 0.5), { tint: 0x3a3030, ao: false });
  kit.add('metal', cone(0.14, 0.6, 5, 1), F0.at(0, h + 0.3, 0), { tint: IRON, ao: false });
  if (flags) flags.add(F0.at(0, h - 0.45, 0.06), 1.4, h * 0.55, color, { hang: 'top', trim: 0x1a1010 });
  kit.add('stone', cyl(0.4, 0.5, 0.4, 8, 1), F0.at(0, 0.2, 0), { tint: 0x4a4444 });
  kit.block(S.circle(x, z, 0.4), 0.2);
}
export function skullPike(kit, x, y, z, { h = 2.4, lean = 0 } = {}) {
  kit.add('timber', cyl(0.05, 0.07, h, 5, 1), M(x, y + h / 2 - 0.2, z, 0, 1, 1, 1, lean), { tint: 0x3a2a1c });
  kit.add('bone', blob(0.17, 1, d => 1 + Math.max(0, d.y) * 0.2, [1, 0.95, 1.15]), M(x, y + h - 0.1, z, x), { tint: 0xe0d4b8, ao: false });
  kit.block(S.circle(x, z, 0.15), 0.2);
}
/** iron cage hanging from a gibbet */
export function cage(kit, x, y, z, rot = 0, { h = 4.2 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('timber', box(0.24, h, 0.24, 1), F0.at(0, h / 2, 0), { tint: 0x3a2a1c });
  kit.add('timber', box(1.8, 0.2, 0.2, 1), F0.at(0.8, h - 0.1, 0), { tint: 0x3a2a1c, ao: false });
  kit.add('metal', cyl(0.02, 0.02, 0.8, 4, 1), F0.at(1.5, h - 0.6, 0), { tint: IRON, ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.add('metal', box(0.04, 1.3, 0.04, 1), F0.at(1.5 + Math.cos(a) * 0.45, h - 1.65, Math.sin(a) * 0.45), { tint: IRON, ao: false }); }
  for (const yy of [h - 1.0, h - 2.3]) kit.add('metal', new THREE.TorusGeometry(0.45, 0.03, 4, 16), F0.at(1.5, yy, 0, 0, 1, 1, 1, Math.PI / 2), { tint: IRON, ao: false });
  kit.add('bone', blob(0.14, 1, null, [1, 0.9, 1.1]), F0.at(1.45, h - 2.15, 0.1), { tint: 0xd8ccb0, ao: false });
  kit.block(S.circle(x, z, 0.25), 0.2);
}
/** Legion fire pit: iron-rimmed bowl sunk in the ground with tall fire (fel-green or ember) */
export function firePit(kit, x, y, z, { r = 1.1, color = 0xff6a20, glow = null } = {}) {
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; kit.add('darkrock', box(0.5, 0.5, 0.35, 1), M(x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, -a), { tint: 0x4a4240 }); }
  kit.glow(cyl(r * 0.85, r * 0.85, 0.1, 12, 1), M(x, y + 0.2, z), glow ?? color, 3.4);
  kit.flame(x, y + 0.3, z, r * 0.8, color);
  kit.light(x, y + 1.5, z, color, 9, 12, 0.35);
  kit.block(S.circle(x, z, r + 0.2), 0.25);
  return { x, y: y + 1.2, z };
}
/** a broken trebuchet: A-frame, snapped throwing arm, a wheel off, scattered stones */
export function siegeEngine(kit, x, y, z, rot = 0, { seed = 1, burnt = 0.5 } = {}) {
  const rng = new RNG(seed), F0 = new Frame(x, y, z, rot), wood = new THREE.Color(0x6a4a30).lerp(new THREE.Color(0x1e1612), burnt).getHex();
  kit.add('planks', box(3.2, 0.4, 6.4, 1), F0.at(0, 0.7, 0), { tint: wood });
  for (const s of [-1, 1]) {
    kit.add('timber', box(0.35, 6.2, 0.35, 1), F0.at(s * 1.3, 3.4, -0.9, 0, 1, 1, 1, 0.28, 0), { tint: wood });
    kit.add('timber', box(0.35, 6.2, 0.35, 1), F0.at(s * 1.3, 3.4, 0.9, 0, 1, 1, 1, -0.28, 0), { tint: wood });
  }
  kit.add('timber', cyl(0.18, 0.18, 3.2, 8, 1), F0.at(0, 6.1, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: wood });
  kit.add('timber', box(0.35, 0.35, 5.5, 1), F0.at(0, 5.0, 1.6, 0, 1, 1, 1, 0.7), { tint: wood });            // snapped arm
  kit.add('timber', box(0.3, 0.3, 3.2, 1), F0.at(0.6, 0.35, 4.4, 0.4, 1, 1, 1, 0.08), { tint: wood });        // broken half on the ground
  kit.add('metal', box(1.6, 1.4, 1.6, 1), F0.at(0, 4.1, -1.6, 0.2), { tint: IRON });                           // counterweight box
  for (const [lx, lz, fall] of [[-1.7, -2.4, 0], [1.7, -2.4, 0], [-1.7, 2.4, 0], [2.6, 3.6, 1]]) {
    const wg = new THREE.TorusGeometry(0.62, 0.12, 6, 14);
    if (fall) kit.add('timber', wg, F0.at(lx, 0.15, lz, 0, 1, 1, 1, Math.PI / 2), { tint: wood, ao: false });
    else kit.add('timber', wg, F0.at(lx, 0.62, lz, Math.PI / 2), { tint: wood, ao: false });
  }
  for (let i = 0; i < 5; i++) { const a = rng.range(0, TAU), d = rng.range(3, 6); F.rock(kit, ...F0.world(Math.cos(a) * d, Math.sin(a) * d).flatMap((v, k) => k === 0 ? [v, y] : [v]), { s: rng.range(0.4, 0.7), seed: 30 + i, tint: 0x6a6460, moss: null, block: false }); }
  kit.block(S.rect(x, z, 3.6, 6.8, rot), 0.3);
}
/** mine cart rails along a polyline */
export function rails(kit, pts, hAt, { gauge = 1.1 } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), n = Math.max(1, Math.round(L / 0.7));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; kit.add('timber', box(0.24, 0.1, gauge + 0.6, 1), M(x, hAt(x, z) + 0.05, z, ang), { tint: 0x4a3a2a, ao: false, cast: false, chunkAt: [x, z] }); }
    for (const s of [-1, 1]) { const ox = Math.sin(ang) * s * gauge / 2, oz = Math.cos(ang) * s * gauge / 2; kit.add('metal', box(L + 0.05, 0.08, 0.08, 1), M((ax + bx) / 2 + ox, (hAt(ax, az) + hAt(bx, bz)) / 2 + 0.14, (az + bz) / 2 + oz, ang, 1, 1, 1, 0, Math.atan2(hAt(bx, bz) - hAt(ax, az), L)), { tint: 0x5a5452, ao: false, cast: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] }); }
  }
}
export function mineCart(kit, x, y, z, rot = 0, { load = 0x2a2626, tipped = false } = {}) {
  const F0 = new Frame(x, y, z, rot);
  const tilt = tipped ? 1.2 : 0;
  kit.add('metal', box(1.0, 0.7, 1.5, 1), F0.at(0, 0.65, 0, 0, 1, 1, 1, 0, tilt), { tint: 0x4a403a });
  kit.add('rock', blob(0.55, 1, null, [0.9, 0.45, 1.3]), F0.at(tipped ? 0.8 : 0, tipped ? 0.3 : 1.0, 0), { tint: load, ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('metal', cyl(0.2, 0.2, 0.1, 10, 1), F0.at(sx * 0.56, 0.2, sz * 0.5, 0, 1, 1, 1, 0, Math.PI / 2), { tint: IRON, ao: false });
  kit.block(S.rect(x, z, 1.2, 1.7, rot), 0.25);
}
/** timber-framed tunnel mouth set into a rock face (the face is added by the zone's cliff) */
export function mineEntrance(kit, x, y, z, rot = 0, { w = 3.2, h = 3.4 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('paint', box(w, h, 0.2, 1), F0.at(0, h / 2, -0.2), { tint: 0x080606, ao: false, cast: false });
  for (const s of [-1, 1]) kit.add('timber', box(0.4, h + 0.2, 0.4, 1), F0.at(s * (w / 2 + 0.15), h / 2, 0.2), { tint: 0x4a3a28 });
  kit.add('timber', box(w + 1.2, 0.45, 0.5, 1), F0.at(0, h + 0.2, 0.2), { tint: 0x4a3a28 });
  kit.add('rock', blob(1, 1, null, [w * 0.9, 1.4, 1.6]), F0.at(0, h + 1.3, -0.8), { tint: 0x6a605a });
  for (const s of [-1, 1]) kit.add('rock', blob(1, 1, null, [1.4, h * 0.6, 1.4]), F0.at(s * (w / 2 + 1.3), h * 0.4, -0.6), { tint: 0x6a605a });
  kit.add('metal', box(0.06, 0.4, 0.06, 1), F0.at(w / 2 + 0.2, h - 0.4, 0.5), { tint: IRON, ao: false });
  kit.glow(box(0.2, 0.26, 0.2), F0.at(w / 2 + 0.2, h - 0.75, 0.55), 0xffa050, 2.4);
  const [lx, lz] = F0.world(w / 2 + 0.2, 0.9); kit.light(lx, y + h - 0.8, lz, 0xffa050, 3, 7, 0.1);
  for (const s of [-1, 1]) kit.block(S.circle(...F0.world(s * (w / 2 + 1.3), -0.6), 1.3), 0.25);
  kit.block(S.rect(...F0.world(0, -0.8), w + 0.4, 1.2, rot), 0.2);
}
/** crusted yellow vent mound with a glowing mouth; returns a smoke source */
export function sulphurVent(kit, x, y, z, { s = 1, seed = 1 } = {}) {
  const nz = new Simplex(seed);
  const g = blob(1, 1, d => 1 + nz.noise3(d.x * 2, d.y * 2, d.z * 2) * 0.2, [1.4 * s, 0.55 * s, 1.4 * s]);
  kit.add('rock', g, M(x, y + 0.1 * s, z, seed), { tint: (p, n) => { const t = clamp((p.y - y) / (0.6 * s), 0, 1); return [0.55 + t * 0.35, 0.5 + t * 0.32, 0.18 + t * 0.05]; } });
  kit.glow(cyl(0.3 * s, 0.22 * s, 0.1, 10, 1), M(x, y + 0.62 * s, z), 0xffc040, 2.4);
  kit.light(x, y + 1.2 * s, z, 0xffb040, 3 * s, 6 * s, 0.25);
  kit.block(S.circle(x, z, 1.1 * s), 0.25);
  return { x, y: y + 0.7 * s, z, size: 0.6 * s, h: 7, rate: 0.8, color: 0xb8a878, glow: 0x6a5010 };
}
export function charredPost(kit, x, y, z, { h = 2.4, lean = 0.1, seed = 1 } = {}) {
  const r = new RNG(seed);
  kit.add('timber', box(0.26, h, 0.26, 1), M(x, y + h / 2 - 0.1, z, r.range(0, 3), 1, 1, 1, lean * r.sign(), lean * r.sign()), { tint: 0x1e1814 });
  kit.glow(box(0.1, 0.3, 0.27, 1), M(x, y + h * 0.7, z, r.range(0, 3)), 0xff5a10, 1.2);
  kit.block(S.circle(x, z, 0.2), 0.2);
}
/** scattered masonry and charred beams (burned buildings, breaches) */
export function rubble(kit, x, y, z, { r = 2.5, n = 10, seed = 1, stone = 0x8a8278, char = 0.6, H = null } = {}) {
  const rng = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = H ? H(px, pz) : y;
    if (rng.chance(0.65)) kit.add('stone', box(rng.range(0.35, 0.8), rng.range(0.25, 0.45), rng.range(0.3, 0.6), 1), M(px, py + 0.12, pz, rng.range(0, 3), 1, 1, 1, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3)), { tint: new THREE.Color(stone).lerp(new THREE.Color(0x2a2220), char * rng.next()).getHex(), ao: false, chunkAt: [x, z] });
    else kit.add('timber', box(rng.range(1.2, 2.6), 0.2, 0.2, 1), M(px, py + 0.15, pz, rng.range(0, 3), 1, 1, 1, 0, rng.range(-0.2, 0.2)), { tint: 0x1e1612, ao: false, chunkAt: [x, z] });
  }
}
