// Mountain-shrine architecture (original designs) for the Foxfire Shrine and anything in that style.
//   gateArch(kit, x, y, z, rot, o)        vermilion gate: round posts on black collars, a tie beam, a sweeping lintel whose
//                                         ends curl up into gilded "fox-tail" flames, a small plaque
//   stoneLantern(kit, x, y, z, o)         tiered stone lantern (lit): plinth, column, lamp box, wide flared cap, finial
//   foxGuardian(kit, x, y, z, rot, o)     a seated stone fox with a gilded ball under one paw, on a pedestal
//   shrineHall(kit, flags, x, y, z, o)    raised hall: stone plinth + stairs, vermilion colonnade, white walls, glowing
//                                         lattice doors, bracket clusters, a two-tier hipped roof with upswept corners
//   stage(kit, zone, x, y, z, w, d, h)    a low wooden deck (walkable deck registered on the zone) with a vermilion rail
//   paperLanterns(kit, a, b, o)           a string of round paper lanterns
import * as THREE from 'three';
import { RNG } from '../core/noise.js';
import { blob, tube } from '../engine/geom.js';
import { box, walls, cyl, cone, sphere, hipRoof, M, Frame } from './kit.js';
import { rect, circle, line } from './shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
export const VERMILION = 0xd8452a, BLACK_LACQUER = 0x1a1616, GOLD = 0xffd070;

export function gateArch(kit, x, y, z, rot, { w = 4.2, h = 5.2, color = VERMILION, plaque = true, s = 1 } = {}) {
  const F = new Frame(x, y, z, rot);
  const W = w * s, Hh = h * s, r = 0.26 * s;
  for (const sx of [-1, 1]) {
    kit.add('lacquer', cyl(r * 0.92, r, Hh, 12, 1), F.at(sx * W / 2, Hh / 2, 0), { tint: color, yGround: y, aoH: 1.5 });
    kit.add('lacquer', cyl(r * 1.25, r * 1.3, 0.55 * s, 12, 1), F.at(sx * W / 2, 0.27 * s, 0), { tint: BLACK_LACQUER, ao: false });
    kit.add('stone', cyl(r * 1.5, r * 1.6, 0.18 * s, 12, 1), F.at(sx * W / 2, 0.09 * s, 0), { tint: 0x8a8a90, ao: false });
    kit.block(circle(...F.world(sx * W / 2, 0), r * 1.3), 0.25);
  }
  // tie beam (straight, pokes through the posts)
  kit.add('lacquer', box(W + 1.0 * s, 0.32 * s, 0.3 * s, 1), F.at(0, Hh - 1.05 * s, 0), { tint: color, ao: false });
  // top lintel: a gentle upward curve with flared ends, black cap board on top
  const lint = [], L = W / 2 + 1.25 * s;
  for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; lint.push(V(t * L, Hh + 0.02 * s + Math.pow(Math.abs(t), 3.2) * 0.62 * s, 0)); }
  kit.add('lacquer', tube(lint, lint.map(() => 0.23 * s), 6, false), F.m, { tint: color, ao: false, chunkAt: [x, z] });
  const cap = lint.map(p => V(p.x * 1.04, p.y + 0.24 * s, p.z));
  kit.add('lacquer', tube(cap, cap.map(() => 0.17 * s), 6, false), F.m, { tint: BLACK_LACQUER, ao: false, chunkAt: [x, z] });
  // gilded fox-tail flames at the lintel ends
  for (const sx of [-1, 1]) {
    const e = cap[sx < 0 ? 0 : 12];
    kit.add('gold', tube([V(e.x, e.y, 0), V(e.x + sx * 0.3 * s, e.y + 0.35 * s, 0), V(e.x + sx * 0.05 * s, e.y + 0.75 * s, 0)], [0.14 * s, 0.1 * s, 0.01], 6, true), F.m, { ao: false, chunkAt: [x, z] });
  }
  if (plaque) {
    kit.add('lacquer', box(0.2 * s, 0.9 * s, 0.1 * s, 1), F.at(0, Hh - 0.55 * s, 0), { tint: color, ao: false });
    kit.add('planks', box(0.75 * s, 0.95 * s, 0.1 * s, 1), F.at(0, Hh - 0.52 * s, 0.03 * s), { tint: 0x2a1a14, ao: false });
    kit.add('gold', box(0.82 * s, 1.02 * s, 0.06 * s, 1), F.at(0, Hh - 0.52 * s, 0.0), { ao: false });
  }
}

export function stoneLantern(kit, x, y, z, { s = 1, lit = true, color = 0xffb060, rot = 0, moss = true } = {}) {
  const F = new Frame(x, y, z, rot);
  const st = 0xa8a4a0;
  kit.add('stone', cyl(0.55 * s, 0.62 * s, 0.25 * s, 6, 1), F.at(0, 0.12 * s, 0), { tint: st, yGround: y });
  kit.add('stone', cyl(0.42 * s, 0.5 * s, 0.22 * s, 6, 1), F.at(0, 0.36 * s, 0), { tint: st });
  kit.add('stone', cyl(0.18 * s, 0.22 * s, 1.1 * s, 8, 1), F.at(0, 1.02 * s, 0), { tint: st });
  kit.add('stone', cyl(0.46 * s, 0.34 * s, 0.2 * s, 6, 1), F.at(0, 1.66 * s, 0), { tint: st });
  // lamp box with four openings (corner posts + glow)
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4; kit.add('stone', box(0.12 * s, 0.5 * s, 0.12 * s, 1), F.at(Math.cos(a) * 0.3 * s, 2.0 * s, Math.sin(a) * 0.3 * s), { tint: st, ao: false }); }
  if (lit) { kit.glow(box(0.36 * s, 0.36 * s, 0.36 * s, 1), F.at(0, 2.0 * s, 0), color, 2.6); kit.light(x, y + 2.0 * s, z, color, 3.5 * s, 7 * s, 0.25); }
  else kit.add('stone', box(0.34 * s, 0.4 * s, 0.34 * s, 1), F.at(0, 2.0 * s, 0), { tint: 0x2a2826, ao: false });
  // wide flared cap (6 sides) with curled corners, finial
  const capG = new THREE.ConeGeometry(0.85 * s, 0.5 * s, 6, 1); capG.translate(0, 0.25 * s, 0);
  kit.add('stone', capG, F.at(0, 2.28 * s, 0), { tint: st, ao: false });
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; kit.add('stone', cone(0.07 * s, 0.22 * s, 5, 1), F.at(Math.cos(a) * 0.83 * s, 2.36 * s, Math.sin(a) * 0.83 * s, 0, 1, 1, 1, Math.sin(a) * 0.6, -Math.cos(a) * 0.6), { tint: st, ao: false }); }
  kit.add('stone', sphere(0.14 * s, 8, 6), F.at(0, 2.9 * s, 0), { tint: st, ao: false });
  kit.add('stone', cone(0.1 * s, 0.3 * s, 8, 1), F.at(0, 3.12 * s, 0), { tint: st, ao: false });
  if (moss) kit.add('paint', blob(0.3 * s, 1, null, [1.4, 0.35, 1.3]), F.at(0.1 * s, 2.62 * s, 0.05 * s), { tint: 0x4a6a2a, ao: false, cast: false });
  kit.block(circle(x, z, 0.6 * s), 0.25);
}

export function foxGuardian(kit, x, y, z, rot, { s = 1, stone = 0xb4b0a8 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('stone', box(1.5 * s, 1.1 * s, 1.5 * s, 1), F.at(0, 0.55 * s, 0), { tint: 0x9a9690, yGround: y });
  kit.add('stone', box(1.7 * s, 0.18 * s, 1.7 * s, 1), F.at(0, 1.18 * s, 0), { tint: 0xaaa6a0, ao: false });
  const G = F.m.clone().multiply(M(0, 1.27 * s, 0, 0, s, s, s));
  const at = (...a) => G.clone().multiply(M(...a));
  kit.add('stone', blob(0.5, 1, null, [0.85, 0.75, 1.1]), at(0, 0.45, 0.1), { tint: stone });                                  // haunches
  kit.add('stone', blob(0.38, 1, null, [0.75, 1.25, 0.8]), at(0, 1.0, -0.12, 0, 1, 1, 1, 0.25), { tint: stone });               // chest
  kit.add('stone', blob(0.26, 1, null, [0.95, 0.9, 1.25]), at(0, 1.55, -0.25), { tint: stone });                                // head
  kit.add('stone', cone(0.13, 0.42, 6, 1), at(0, 1.5, -0.58, 0, 1, 1, 1, -Math.PI / 2 - 0.1), { tint: stone });                // muzzle
  for (const sx of [-1, 1]) {
    kit.add('stone', cone(0.1, 0.34, 4, 1), at(sx * 0.14, 1.86, -0.2, 0, 1, 1, 1, 0.12, -sx * 0.2), { tint: stone });            // ears
    kit.add('stone', cyl(0.07, 0.09, 0.7, 6, 1), at(sx * 0.2, 0.42, -0.35), { tint: stone });                                    // forelegs
  }
  kit.add('gold', sphere(0.17, 10, 8), at(0.22, 0.2, -0.5), { ao: false });                                                     // the jewel under a paw
  kit.add('stone', tube([V(0, 0.35, 0.55), V(0.2, 0.9, 0.75), V(0.05, 1.45, 0.6), V(-0.12, 1.75, 0.35)], [0.16, 0.2, 0.16, 0.05], 7, true), G, { tint: stone, ao: false });   // tail
  kit.add('cloth', cyl(0.3, 0.34, 0.14, 10, 1), at(0, 1.25, -0.2), { tint: 0xc83a24, ao: false });                             // red bib
  kit.block(rect(x, z, 1.6 * s, 1.6 * s, rot), 0.3);
}

/** Upswept hip-roof tier: hip roof + four curling corner ridges + a ridge beam with curled ends. */
function sweptRoof(kit, F, lx, ly, lz, w, d, rise, { over = 1.6, tint = 0x5a6478 } = {}) {
  kit.add('slate', hipRoof(w, d, rise, over, 2), F.at(lx, ly, lz), { tint, ao: false });
  const W = w / 2 + over, D = d / 2 + over, y0 = -over * rise / (Math.min(w, d) / 2);
  const ridgeHalf = Math.max(0, (w - d) / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // hip ridge from the top down to the corner, then curling upward
    const pts = [V(sx * ridgeHalf, rise, 0), V(sx * (ridgeHalf + (W - ridgeHalf) * 0.5), rise * 0.5 + y0 * 0.5, sz * D * 0.5), V(sx * W * 0.96, y0 + 0.05, sz * D * 0.96), V(sx * W * 1.1, y0 + 0.55, sz * D * 1.1)];
    kit.add('slate', tube(pts, [0.16, 0.16, 0.18, 0.08], 6, true), F.at(lx, ly, lz), { tint: 0x22242a, ao: false, chunkAt: [F.x, F.z] });
    kit.add('gold', sphere(0.12, 8, 6), F.at(lx + sx * W * 1.1, ly + y0 + 0.62, lz + sz * D * 1.1), { ao: false });
  }
  kit.add('slate', box(2 * ridgeHalf + 0.6, 0.3, 0.42, 1), F.at(lx, ly + rise + 0.1, lz), { tint: 0x22242a, ao: false });
  for (const sx of [-1, 1]) kit.add('gold', tube([V(0, 0, 0), V(sx * 0.3, 0.4, 0), V(sx * 0.1, 0.85, 0)], [0.16, 0.12, 0.02], 6, true), F.at(lx + sx * (ridgeHalf + 0.3), ly + rise + 0.2, lz), { ao: false });
}

export function shrineHall(kit, flags, x, y, z, { w = 22, d = 11, rot = 0 } = {}) {
  const F = new Frame(x, y, z, rot);
  const base = 1.3, colH = 4.2;
  // stone plinth (two tiers) and a broad front stair
  kit.add('stone', box(w + 5, base * 0.55, d + 5, 2), F.at(0, base * 0.27, 0), { tint: 0xa8a49c, yGround: y });
  kit.add('stone', box(w + 3.4, base * 0.45, d + 3.4, 2), F.at(0, base * 0.55 + base * 0.22, 0), { tint: 0xb4b0a8 });
  for (let i = 0; i < 6; i++) kit.add('stone', box(8.5 - i * 0.2, (i + 1) * base / 6, 0.42, 1), F.at(0, (i + 1) * base / 12, d / 2 + 2.5 + 2.2 - i * 0.42), { tint: 0xb8b4ac, ao: false });
  // wooden floor + veranda
  kit.add('planks', box(w + 2.6, 0.18, d + 2.6, 2), F.at(0, base + 0.09, 0), { tint: 0x7a4a2e, ao: false });
  // colonnade
  const nx = 8, colR = 0.24;
  for (let i = 0; i < nx; i++) {
    const u = -w / 2 - 0.6 + (w + 1.2) * i / (nx - 1);
    for (const sz of [1, -1]) {
      kit.add('lacquer', cyl(colR, colR * 1.08, colH, 12, 1), F.at(u, base + colH / 2, sz * (d / 2 + 0.6)), { tint: VERMILION, yGround: y + base, aoH: 1.2 });
      kit.add('stone', cyl(colR * 1.5, colR * 1.6, 0.25, 12, 1), F.at(u, base + 0.12, sz * (d / 2 + 0.6)), { tint: 0x9a968e, ao: false });
    }
  }
  for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) kit.add('lacquer', cyl(colR, colR * 1.08, colH, 12, 1), F.at(sx * (w / 2 + 0.6), base + colH / 2, -d / 2 - 0.6 + (d + 1.2) * i / 4), { tint: VERMILION, yGround: y + base });
  // beams + bracket clusters
  for (const sz of [1, -1]) {
    kit.add('lacquer', box(w + 2.4, 0.36, 0.34, 1), F.at(0, base + colH - 0.1, sz * (d / 2 + 0.6)), { tint: VERMILION, ao: false });
    kit.add('lacquer', box(w + 2.6, 0.24, 0.5, 1), F.at(0, base + colH + 0.35, sz * (d / 2 + 0.6)), { tint: 0x2a2020, ao: false });
    for (let i = 0; i < nx; i++) { const u = -w / 2 - 0.6 + (w + 1.2) * i / (nx - 1); kit.add('lacquer', box(0.62, 0.3, 0.62, 1), F.at(u, base + colH + 0.12, sz * (d / 2 + 0.6)), { tint: 0x3a8a6a, ao: false }); kit.add('gold', box(0.66, 0.06, 0.66, 1), F.at(u, base + colH - 0.02, sz * (d / 2 + 0.6)), { ao: false }); }
  }
  for (const sx of [1, -1]) kit.add('lacquer', box(0.34, 0.36, d + 2.4, 1), F.at(sx * (w / 2 + 0.6), base + colH - 0.1, 0), { tint: VERMILION, ao: false });
  // walls: white plaster with dark frames; front: glowing lattice doors in five bays
  kit.add('plaster', walls(w, colH - 0.4, d, 2.4), F.at(0, base + (colH - 0.4) / 2 + 0.1, 0), { tint: 0xf4efe6, ao: false });
  for (let i = 0; i < 5; i++) {
    const u = -w / 2 + w * (i + 0.5) / 5;
    kit.add('window', box(w / 5 - 1.2, colH - 1.3, 0.08, 1), F.at(u, base + (colH - 1.3) / 2 + 0.35, d / 2 + 0.03), { ao: false });
    kit.add('timber', box(w / 5 - 1.0, 0.14, 0.12, 1), F.at(u, base + colH - 0.9, d / 2 + 0.07), { ao: false });
    kit.add('timber', box(w / 5 - 1.0, 0.14, 0.12, 1), F.at(u, base + 0.35, d / 2 + 0.07), { ao: false });
    for (let k = 0; k < 4; k++) kit.add('timber', box(0.06, colH - 1.3, 0.1, 1), F.at(u - (w / 5 - 1.2) / 2 + (k + 0.5) * (w / 5 - 1.2) / 4, base + (colH - 1.3) / 2 + 0.35, d / 2 + 0.07), { ao: false });
    for (let k = 0; k < 5; k++) kit.add('timber', box(w / 5 - 1.2, 0.05, 0.1, 1), F.at(u, base + 0.6 + k * (colH - 1.6) / 4, d / 2 + 0.07), { ao: false });
  }
  // veranda railing (vermilion), gap at the stair
  for (const sx of [-1, 1]) {
    const a0 = sx * 4.4, a1 = sx * (w / 2 + 1.2);
    kit.add('lacquer', box(Math.abs(a1 - a0), 0.12, 0.12, 1), F.at((a0 + a1) / 2, base + 0.95, d / 2 + 1.25), { tint: VERMILION, ao: false });
    for (let k = 0; k <= Math.round(Math.abs(a1 - a0) / 1.2); k++) kit.add('lacquer', box(0.1, 0.8, 0.1, 1), F.at(a0 + (a1 - a0) * k / Math.round(Math.abs(a1 - a0) / 1.2), base + 0.55, d / 2 + 1.25), { tint: VERMILION, ao: false });
  }
  // two-tier upswept roof
  const top = base + colH + 0.5;
  sweptRoof(kit, F, 0, top, 0, w + 1.2, d + 1.2, 3.4, { over: 2.2 });
  kit.add('plaster', walls(w * 0.55, 1.6, d * 0.5, 2), F.at(0, top + 3.0, 0), { tint: 0xf4efe6, ao: false });
  for (let i = 0; i < 5; i++) kit.add('lacquer', box(0.2, 1.6, 0.2, 1), F.at(-w * 0.275 + w * 0.55 * i / 4, top + 3.0, d * 0.25 + 0.05), { tint: VERMILION, ao: false });
  sweptRoof(kit, F, 0, top + 3.8, 0, w * 0.55, d * 0.5, 2.6, { over: 1.4 });
  // offering box, bell rope, hanging lanterns at the front
  kit.add('planks', box(2.6, 0.9, 1.0, 1), F.at(0, base + 0.63, d / 2 + 1.7), { tint: 0x5a3420 });
  for (let k = 0; k < 9; k++) kit.add('timber', box(0.08, 0.06, 1.0, 1), F.at(-1.1 + k * 0.275, base + 1.1, d / 2 + 1.7), { ao: false });
  kit.add('cloth', cyl(0.05, 0.05, 2.6, 6, 1), F.at(0, base + 2.4, d / 2 + 0.95), { tint: 0xf0e6d0, ao: false });
  kit.add('gold', sphere(0.32, 12, 8), F.at(0, base + 3.8, d / 2 + 0.95), { ao: false });
  for (const sx of [-1, 1]) {
    kit.glow(sphere(0.42, 12, 8), F.at(sx * 3.2, base + colH - 1.0, d / 2 + 1.0, 0, 1, 1.25, 1), 0xff8040, 2.0);
    kit.add('lacquer', box(0.5, 0.08, 0.5, 1), F.at(sx * 3.2, base + colH - 0.42, d / 2 + 1.0), { tint: BLACK_LACQUER, ao: false });
    const [lx, lz] = F.world(sx * 3.2, d / 2 + 1.2); kit.light(lx, y + base + colH - 1.0, lz, 0xff9050, 5, 9, 0.2);
  }
  if (flags) for (const sx of [-1, 1]) flags.add(F.at(sx * (w / 2 + 0.6), base + colH - 0.3, d / 2 + 0.95), 0.9, 3.0, 0xf0eadc, { hang: 'top', trim: VERMILION });
  kit.block(rect(x, z, w + 5.2, d + 5.2, rot), 0.3);
  const [sxw, szw] = F.world(0, d / 2 + 3.7);
  return { F, stairFront: [sxw, szw], floorY: y + base };
}

export function stage(kit, zone, x, y, z, w, d, h = 0.4, { rot = 0, rail = true } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('planks', box(w, h, d, 2.2), F.at(0, h / 2, 0), { tint: 0xc08a58, yGround: y - 0.1, aoH: 0.8 });
  for (let i = 0; i <= Math.round(w / 2); i++) kit.add('timber', box(0.28, h + 0.02, 0.28, 1), F.at(-w / 2 + i * w / Math.round(w / 2), h / 2, d / 2 - 0.1), { ao: false });
  kit.add('timber', box(w + 0.1, 0.12, 0.2, 1), F.at(0, h - 0.04, d / 2 + 0.02), { ao: false });
  // two broad steps on the south edge
  for (let k = 0; k < 2; k++) kit.add('planks', box(w * 0.4, h * (k + 1) / 3, 0.5, 1.5), F.at(0, h * (k + 1) / 6, d / 2 + 0.75 - k * 0.5), { tint: 0x7a4a2e, ao: false });
  if (rail) for (const sx of [-1, 1]) {
    kit.add('lacquer', box(0.12, 0.12, d, 1), F.at(sx * (w / 2 - 0.1), h + 0.8, 0), { tint: VERMILION, ao: false });
    for (let k = 0; k <= Math.round(d / 1.5); k++) kit.add('lacquer', box(0.12, 0.8, 0.12, 1), F.at(sx * (w / 2 - 0.1), h + 0.4, -d / 2 + d * k / Math.round(d / 1.5)), { tint: VERMILION, ao: false });
    kit.block(line([F.world(sx * (w / 2 - 0.1), -d / 2), F.world(sx * (w / 2 - 0.1), d / 2)], 0.2), 0.25);
  }
  if (zone) zone.deck(rect(x, z, w - 0.1, d - 0.1, rot), y + h);
}

export function paperLanterns(kit, a, b, { sag = 0.5, n = 6, colors = [0xff5a3a, 0xffc890] } = {}) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t)); }
  kit.add('metal', tube(pts, pts.map(() => 0.015), 3, false), null, { tint: 0x2a2020, ao: false, chunkAt: [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2] });
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, z = a[2] + (b[2] - a[2]) * t;
    kit.glow(sphere(0.22, 10, 8), M(x, y - 0.32, z, 0, 1, 1.2, 1), colors[i % colors.length], i % 2 ? 1.25 : 1.6);
    kit.add('lacquer', cyl(0.12, 0.12, 0.06, 8, 1), M(x, y - 0.06, z), { tint: BLACK_LACQUER, ao: false, cast: false });
  }
}
