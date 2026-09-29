// The Sunken Oratory (Abyssal Dungeon), two gates.
//   oratory_choir — Gate 1, Nerissa of the Drowned Choir: a flooded cathedral nave (~56 m). Ankle-deep reflective water
//                   over a checkered sea-stone floor, two rows of coral-crusted columns, broken lancet windows and a vault
//                   open to the surface far above (god rays), ruined pews in the aisles, a fallen chandelier, a raised
//                   apse with a pipe organ and a shattered rose window lying in glowing shards, the great rose window on
//                   the north wall, drifting motes, cold teal light.
//   oratory_abyss — Gate 2, the Deep Oracle: a circular platform of ancient stone (~50 m) standing in black abyssal
//                   water; broken arches ring its rim, glow-coral and bioluminescent kelp climb out of the dark, giant
//                   tentacles rise around it, and the drowned cathedral looms as a silhouette to the north.
import * as THREE from 'three';
import { tick } from '../zone.js';
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit, M, box, walls, cyl, cone, sphere, faceTo, extrude, kitMaterial } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { Decals } from '../decals.js';
import { buildFlames, LightPool, buildParticles, buildShafts, Flags } from '../fx.js';
import { cliffRing, boulder, islandSkirt } from '../cliffs.js';
import { buildWater } from '../water.js';
import { buildFlood, buildKelp } from '../arenas.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { RNG, Simplex, smoothstep, lerp, catmull } from '../../core/noise.js';
import { blob, tube, linColor } from '../../engine/geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const WALL = 0xa8b8b8, WALL_D = 0x7a8a8c;

// ------------------------------------------------------------------ shared pieces
/** outline (x, y) of a panel pw×ph with a pointed lancet opening w wide, spring line at h (arc radius 0.85·w) */
function lancetPanel(pw, ph, w, h, seg = 8) {
  const r = w * 0.85, cx = r - w / 2, apexA = Math.acos(cx / r);
  const out = [[-pw / 2, 0], [-w / 2, 0], [-w / 2, h]];
  for (let i = 1; i <= seg; i++) { const a = Math.PI - apexA * i / seg; out.push([cx + Math.cos(a) * r, h + Math.sin(a) * r]); }     // left arc up to the apex
  for (let i = seg - 1; i >= 1; i--) { const a = Math.PI - apexA * i / seg; out.push([-(cx + Math.cos(a) * r), h + Math.sin(a) * r]); } // right arc down
  out.push([w / 2, h], [w / 2, 0], [pw / 2, 0], [pw / 2, ph], [-pw / 2, ph]);
  return out;
}
/** flat pointed-arch glass pane (x, y plane) filling a lancet opening w×h */
function lancetGlass(w, h, seg = 8) {
  const r = w * 0.85, cx = r - w / 2, apexA = Math.acos(cx / r);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h);
  for (let i = 1; i <= seg; i++) { const a = apexA * i / seg; shape.lineTo(-cx + Math.cos(a) * r, h + Math.sin(a) * r); }
  for (let i = 1; i <= seg; i++) { const a = Math.PI - apexA + apexA * i / seg; shape.lineTo(cx + Math.cos(a) * r, h + Math.sin(a) * r); }
  shape.lineTo(-w / 2, 0);
  return new THREE.ShapeGeometry(shape, 1);
}
/** coral cluster: branching tubes + a brain-coral dome; glowing tips when glow != null */
function coral(kit, x, y, z, { s = 1, seed = 1, cols = [0xff7a8a, 0xffb060, 0xc070ff], glow = 0x40ffe0, glowI = 2.4 } = {}) {
  const r = new RNG(seed);
  for (let b = 0; b < 4; b++) {
    const a0 = r.range(0, TAU), col = r.pick(cols);
    const grow = (from, dir, len, rad, depth) => {
      const to = from.clone().addScaledVector(dir, len);
      kit.add('coral', tube([from, from.clone().lerp(to, 0.5).add(V(r.range(-0.05, 0.05), 0, r.range(-0.05, 0.05))), to], [rad, rad * 0.8, rad * 0.55], 5, true), null, { tint: col, chunkAt: [x, z], cast: false });
      if (depth >= 2) { if (glow != null && r.chance(0.7)) kit.glow(sphere(rad * 0.9, 6, 4), M(to.x, to.y, to.z), glow, glowI); return; }
      for (let k = 0; k < 2; k++) grow(to, dir.clone().add(V(r.range(-0.7, 0.7), r.range(0.2, 0.6), r.range(-0.7, 0.7))).normalize(), len * r.range(0.55, 0.75), rad * 0.62, depth + 1);
    };
    grow(V(x + Math.cos(a0) * 0.3 * s, y, z + Math.sin(a0) * 0.3 * s), V(Math.cos(a0) * 0.4, 1, Math.sin(a0) * 0.4).normalize(), 0.6 * s, 0.09 * s, 0);
  }
  const dome = blob(0.35 * s, 1, d => 1 + Math.sin(d.x * 14 + d.z * 11) * 0.05, [1.2, 0.7, 1]);
  kit.add('coral', dome, M(x + r.range(-0.3, 0.3) * s, y + 0.05, z + r.range(-0.3, 0.3) * s), { tint: r.pick([0xe8b098, 0xd8a0b8, 0xa8d8c0]), cast: false });
}
/** gothic column crusted with coral and barnacles */
function reefColumn(kit, x, y, z, h, r, { seed = 1, glow = 0x40ffe0 } = {}) {
  const rng = new RNG(seed);
  kit.add('wetstone', box(r * 3, 0.6, r * 3, 1), M(x, y + 0.3, z, Math.PI / 4), { tint: WALL, yGround: y });
  // clustered shaft: a core + four engaged shafts
  kit.add('wetstone', cyl(r, r * 1.05, h, 12, 2), M(x, y + h / 2 + 0.5, z), { tint: WALL, yGround: y, aoH: 3 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4; kit.add('wetstone', cyl(r * 0.36, r * 0.38, h, 8, 1), M(x + Math.cos(a) * r * 0.95, y + h / 2 + 0.5, z + Math.sin(a) * r * 0.95), { tint: WALL_D, yGround: y, aoH: 3 }); }
  kit.add('wetstone', cyl(r * 1.4, r * 1.05, 0.9, 12, 1), M(x, y + h + 0.9, z), { tint: WALL, ao: false });
  // coral climbing the base, barnacle bands, a strand of hanging weed
  for (let k = 0; k < 3; k++) { const a = rng.range(0, TAU); coral(kit, x + Math.cos(a) * r * 1.3, y + rng.range(0, 0.5), z + Math.sin(a) * r * 1.3, { s: rng.range(0.8, 1.3), seed: seed * 7 + k, glow }); }
  for (let k = 0; k < 10; k++) { const a = rng.range(0, TAU), hh = rng.range(0.6, h * 0.6); kit.add('coral', blob(rng.range(0.08, 0.16), 0), M(x + Math.cos(a) * r * 1.02, y + hh, z + Math.sin(a) * r * 1.02), { tint: 0xd8d0c0, ao: false, cast: false }); }
  kit.block(S.circle(x, z, r * 1.5), 0.3);
}
/** giant tentacle rising from the water (decor), dark with a glowing underside and tip */
function tentacle(kit, x, y, z, { h = 12, r = 1.1, curl = 1, dir = 0, seed = 1, tint = 0x3a2a4a, glow = 0xb060ff } = {}) {
  const rng = new RNG(seed), pts = [];
  const dx = Math.cos(dir), dz = Math.sin(dir);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, bend = Math.sin(t * Math.PI * 0.9) * 3 * curl + t * t * t * 4 * curl;
    pts.push(V(x + dx * bend + Math.sin(t * 5 + seed) * 0.4, y + t * h, z + dz * bend + Math.cos(t * 4 + seed) * 0.4));
  }
  const curve = new THREE.CatmullRomCurve3(pts), sm = curve.getPoints(24);
  kit.add('coral', tube(sm, sm.map((_, i) => r * (1 - i / 24 * 0.92)), 10, true), null, { tint, chunkAt: [x, z] });
  for (let i = 3; i < 22; i += 2) { const p = sm[i], rr = r * (1 - i / 24 * 0.92); kit.glow(sphere(rr * 0.28, 6, 4), M(p.x - dx * rr * 0.85, p.y, p.z - dz * rr * 0.85), glow, 1.6); }
  const tip = sm[24]; kit.glow(sphere(r * 0.18, 6, 4), M(tip.x, tip.y, tip.z), glow, 3);
}

// ------------------------------------------------------------------ Gate 1: the flooded choir
export async function buildChoir(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 31);
  const XW = 19, ZN = -31, ZS = 29, WL = 0.3, DAIS = 0.95;
  zone.bounds = { x0: -XW, z0: -24, x1: XW, z1: 27 };
  const g = zone.ground = new Ground({ x0: -80, z0: -90, w: 160, d: 180, res: 1, layers: ['seastone', 'marble', 'moss', 'rock', 'gravel', 'mud'], base: 'rock', seed: 41 });
  g.tint.setRGB(0.92, 1.0, 1.0);
  g.sculpt((x, z) => {
    const inNave = Math.abs(x) < XW + 0.5 && z > ZN - 0.5 && z < ZS + 0.5;
    if (!inNave) return 1.5 + g.noise.noise2(x / 9, z / 9) * 1.5 + smoothstep(XW + 4, XW + 30, Math.abs(x)) * 6;
    let h = g.noise.noise2(x / 7, z / 7) * 0.04;
    if (z < -23.5) h = DAIS * smoothstep(-23.5, -25.2, z);
    return h;
  });
  g.paint('seastone', S.rect(0, -1, 2 * XW, ZS - ZN), { soft: 0.3 });
  g.paint('marble', S.rect(0, -27.5, 22, 8), { soft: 0.3 });
  g.plaza(0, -2, 9.6, { layer: 'seastone', tile: 2.2, rings: [3.2, 9.4], spokes: 12, border: 0.4, keep: true });
  for (let i = 0; i < 18; i++) g.paint('mud', S.circle(rng.range(-XW, XW), rng.range(-24, 28), rng.range(1.2, 3.0)), { soft: 2, noise: 1.5, nscale: 2, amount: 0.55 });
  for (let i = 0; i < 10; i++) g.paint('mud', S.circle(rng.range(-XW, XW), rng.range(-22, 28), rng.range(1, 2.5)), { soft: 1.5, noise: 1, nscale: 1.5, amount: 0.6 });
  g.info('ao', S.subtract(S.rect(0, -1, 2 * XW + 2, ZS - ZN + 2), S.rect(0, -1, 2 * XW - 3, ZS - ZN - 3)), { soft: 2, amount: 0.35 });

  const kit = new Kit({ seed: 13 });
  const flags = new Flags();
  const H = (x, z) => g.heightAt(x, z);
  // --- side walls with buttressed bays and broken lancet windows (inner faces toward the nave)
  const wallH = 16, bay = 7;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const z = ZN + 3.5 + i * bay, x = sx * (XW + 0.7);
      const topJag = wallH - (i % 3 === 1 ? rng.range(3, 6) : rng.range(0, 1.5));
      const panel = extrude(lancetPanel(bay, topJag, 3.2, 5.2, 8), 1.4, 2);
      kit.add('wetstone', panel, M(x, 0, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2), { tint: WALL, yGround: 0, aoH: 3 });
      if (rng.chance(0.55)) { const glass = lancetGlass(3.2, 5.2); kit.glow(glass, M(x + sx * 0.1, 0.02, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2), rng.pick([0x2a8a9a, 0x3a6aaa, 0x2a9a8a]), 0.9); }
      kit.add('wetstone', box(1.6, topJag + 0.5, 1.8, 2), M(x + sx * 0.2, (topJag + 0.5) / 2, z - bay / 2), { tint: WALL_D, yGround: 0 });   // pier between bays
      // vault rib stub springing inward
      kit.add('wetstone', tube([V(x, topJag - 1, z - bay / 2), V(x - sx * 2.4, topJag + 1.2, z - bay / 2), V(x - sx * 4.2, topJag + 1.6, z - bay / 2 + rng.range(-0.3, 0.3))], [0.45, 0.4, 0.3], 6, true), null, { tint: WALL, chunkAt: [x, z] });
    }
    kit.block(S.rect(sx * (XW + 0.7), -1, 1.6, ZS - ZN), 0.35);
  }
  // --- north wall with the great rose window, the apse dais, organ pipes, fallen rose window shards
  const nz = ZN - 0.7;
  kit.add('wetstone', box(2 * XW + 3, wallH + 2, 1.4, 2), M(0, (wallH + 2) / 2, nz), { tint: WALL, yGround: 0, aoH: 4 });
  { // great rose window: stone ring, 12 mullions, glass petals (some broken out)
    const rc = V(0, 11.5, nz + 0.75), RR = 5.6;
    const ring = new THREE.TorusGeometry(RR, 0.5, 8, 48); kit.add('wetstone', ring, M(rc.x, rc.y, rc.z), { tint: WALL, ao: false });
    const ring2 = new THREE.TorusGeometry(RR * 0.38, 0.28, 6, 32); kit.add('wetstone', ring2, M(rc.x, rc.y, rc.z), { tint: WALL, ao: false });
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU; kit.add('wetstone', box(0.28, RR * 0.64, 0.4, 1), M(rc.x + Math.cos(a) * RR * 0.69, rc.y + Math.sin(a) * RR * 0.69, rc.z, 0, 1, 1, 1, 0, a - Math.PI / 2), { tint: WALL, ao: false });
      if (k === 2 || k === 7 || k === 8) continue;                          // broken-out panes
      const pane = new THREE.RingGeometry(RR * 0.4, RR * 0.95, 4, 1, a + 0.05, TAU / 12 - 0.1);
      kit.glow(pane, M(rc.x, rc.y, rc.z - 0.05), [0x3a9ab0, 0x4a7ac8, 0x2ab0a0][k % 3], 1.3);
    }
    kit.glow(new THREE.CircleGeometry(RR * 0.36, 24), M(rc.x, rc.y, rc.z - 0.04), 0x7ad8e0, 1.6);
  }
  for (let k = 0; k < 3; k++) kit.add('wetstone', box(22 - k * 1.2, DAIS * (k + 1) / 3, 0.7, 1), M(0, DAIS * (k + 1) / 6, -23.3 - k * 0.6), { tint: 0xc8d4d4, ao: false });
  kit.add('marble', box(22, DAIS, 6.8, 2), M(0, DAIS / 2, -27.6), { tint: 0xd0dada, yGround: 0 });
  // organ: pipes rising in a symmetric fan, on a carved console
  kit.add('planks', box(12, 2.2, 1.6, 1.5), M(0, DAIS + 1.1, -29.4), { tint: 0x4a3024 });
  for (let k = 0; k < 17; k++) {
    const u = (k - 8) / 8, hh = 4 + (1 - Math.abs(u)) ** 1.4 * 8 + (k % 2) * 0.8, px = u * 6.6;
    kit.add('metal', cyl(0.24, 0.24, hh, 10, 1), M(px, DAIS + 2.2 + hh / 2, -29.9), { tint: 0x6aa898, ao: false });
    kit.add('metal', cone(0.26, 0.5, 10, 1), M(px, DAIS + 2.5, -29.6, 0, 1, 1, 1, Math.PI / 2 + 0.4), { tint: 0x2a3a36, ao: false });
    kit.add('gold', cyl(0.28, 0.28, 0.1, 10, 1), M(px, DAIS + 2.2 + hh, -29.9), { ao: false });
  }
  kit.block(S.rect(0, -29.6, 13, 2), 0.3);
  // the fallen rose window: tracery ring lying cracked across the dais, glass shards glowing
  { const fc = V(5.5, DAIS + 0.15, -26.2);
    const fr = new THREE.TorusGeometry(3.2, 0.32, 6, 36, TAU * 0.72); fr.rotateX(Math.PI / 2);
    kit.add('wetstone', fr, M(fc.x, fc.y, fc.z, 0.6, 1, 1, 1, 0.08, 0.05), { tint: WALL, ao: false });
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU * 0.72 + 0.6; kit.add('wetstone', box(0.2, 0.2, 2.2, 1), M(fc.x + Math.cos(a) * 1.3, fc.y + 0.05, fc.z + Math.sin(a) * 1.3, -a + Math.PI / 2), { tint: WALL, ao: false }); }
    for (let k = 0; k < 16; k++) { const a = rng.range(0, TAU), d = rng.range(0.3, 3.4); const sh = new THREE.CircleGeometry(rng.range(0.25, 0.6), 3); sh.rotateX(-Math.PI / 2); kit.glow(sh, M(fc.x + Math.cos(a) * d, fc.y + 0.03, fc.z + Math.sin(a) * d, rng.range(0, 6)), rng.pick([0x3a9ab0, 0x4a7ac8, 0x2ab0a0, 0x7ad8e0]), 1.5); }
    kit.light(fc.x, fc.y + 1.5, fc.z, 0x5ad0e0, 4, 8, 0.1);
  }
  // Nerissa's coral throne on the dais (west of centre)
  { const tx = -5.5, tz = -27.4, y = DAIS;
    kit.add('coral', blob(1.2, 1, null, [1.3, 0.55, 1.0]), M(tx, y + 0.3, tz), { tint: 0xd89aa8 });
    kit.add('coral', box(2.2, 3.2, 0.6, 1), M(tx, y + 1.6, tz - 0.9), { tint: 0xc88898 });
    for (let k = 0; k < 5; k++) kit.add('coral', cone(0.22, 1.6 + (k % 2) * 0.8, 6, 1), M(tx - 1.0 + k * 0.5, y + 3.4 + (k % 2) * 0.4, tz - 0.9), { tint: 0xe0a0b0, ao: false });
    coral(kit, tx - 1.6, y, tz + 0.2, { s: 1.2, seed: 4 }); coral(kit, tx + 1.6, y, tz + 0.2, { s: 1.1, seed: 5 });
    kit.block(S.rect(tx, tz - 0.3, 3, 2.2), 0.3);
  }
  // --- nave columns (coral-crusted), aisle pews, the fallen chandelier
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) reefColumn(kit, sx * 12.5, 0, -20 + i * 7, 13, 0.75, { seed: i * 2 + (sx > 0 ? 1 : 0) });
  const pew = (x, z, rot, broken = false) => {
    const tilt = broken ? rng.range(0.15, 0.5) : 0;
    kit.add('planks', box(3.2, 0.12, 0.55, 1), M(x, 0.5, z, rot, 1, 1, 1, 0, tilt), { tint: 0xd8b898, ao: false });
    kit.add('planks', box(3.2, 0.7, 0.1, 1), M(x - Math.sin(rot) * 0.3, 0.85, z - Math.cos(rot) * 0.3, rot, 1, 1, 1, -0.1, tilt), { tint: 0xd8b898, ao: false });
    for (const s of [-1, 1]) kit.add('planks', box(0.12, 0.9, 0.6, 1), M(x + Math.cos(rot) * s * 1.55, 0.45, z - Math.sin(rot) * s * 1.55, rot, 1, 1, 1, 0, tilt), { tint: 0xc8a888, ao: false });
    kit.block(S.rect(x, z, 3.3, 0.7, rot), 0.25);
  };
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const z = -16 + i * 7 + rng.range(-1, 1); if (rng.chance(0.2)) continue; pew(sx * 15.6, z, rng.range(-0.15, 0.15) + (sx > 0 ? 0 : 0), rng.chance(0.35)); }
  for (let i = 0; i < 4; i++) pew(rng.pick([-1, 1]) * rng.range(3, 9), rng.range(12, 24), rng.range(-0.8, 0.8), true);
  { const cx = 7, cz = 10, ring = new THREE.TorusGeometry(2.4, 0.13, 6, 32); ring.rotateX(Math.PI / 2);
    kit.add('metal', ring, M(cx, 0.35, cz, 0.3, 1, 1, 1, 0.25, 0.1), { tint: 0x2a3434, ao: false });
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; kit.add('metal', cyl(0.05, 0.05, 0.4, 5, 1), M(cx + Math.cos(a) * 2.4, 0.5 + Math.sin(a) * 0.5, cz + Math.sin(a) * 2.4), { tint: 0x2a3434, ao: false }); }
    kit.add('metal', tube([V(cx, 0.4, cz), V(cx + 0.5, 3, cz - 1), V(cx + 1.8, 6, cz - 1.5)], [0.05, 0.05, 0.05], 4, false), null, { tint: 0x2a3434, ao: false, chunkAt: [cx, cz] });
    kit.block(S.circle(cx, cz, 2.6), 0.2);
  }
  // --- ruined south wall and the broken great door (low, so it never hides the fight)
  for (const [x0, x1, h] of [[-XW - 1, -9, 3.2], [-9, -3.4, 1.4], [3.4, 9, 2.2], [9, XW + 1, 3.6]]) { kit.add('wetstone', box(x1 - x0, h, 1.4, 2), M((x0 + x1) / 2, h / 2, ZS + 0.7), { tint: WALL, yGround: 0 }); kit.block(S.rect((x0 + x1) / 2, ZS + 0.7, x1 - x0, 1.4), 0.3); }
  for (let i = 0; i < 14; i++) { const x = rng.range(-XW + 1, XW - 1), z = ZS - rng.range(0.5, 3); kit.add('wetstone', box(rng.range(0.6, 1.4), rng.range(0.4, 0.9), rng.range(0.6, 1.2), 1), M(x, 0.25, z, rng.range(0, 3), 1, 1, 1, rng.range(-0.3, 0.3)), { tint: WALL_D }); }
  // kelp & coral along the walls; the cave outside
  const kelp = [];
  for (let i = 0; i < 40; i++) { const sx = rng.pick([-1, 1]), z = rng.range(-22, 27); kelp.push({ x: sx * rng.range(16.5, 18.3), y: 0, z, h: rng.range(2.4, 5.2), s: rng.range(1.2, 1.8) }); }
  for (let i = 0; i < 10; i++) coral(kit, rng.pick([-1, 1]) * rng.range(16, 18), 0, rng.range(-22, 26), { s: rng.range(0.9, 1.5), seed: 90 + i });
  const cave = catmull([[-XW - 6, ZS + 6], [-XW - 14, 0], [-XW - 12, ZN - 8], [0, ZN - 16], [XW + 12, ZN - 8], [XW + 14, 0], [XW + 6, ZS + 6]], 6);
  cliffRing(kit, cave, (x, z) => Math.min(H(x, z), 3), { height: 26, thick: 12, seed: 4, tint: 0x3a4a50, strata: 0x243236, top: 0x2a3a34, inside: [0, 0], closed: false, lean: 0.2, jag: 4, mat: 'wetrock' });
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.28 });
  await tick();
  await g.build(zone.root);
  kit.build(zone.root);
  await tick();

  // --- water, light, life
  const flood = buildFlood(g, { x: 0, z: -1, w: 2 * XW, d: ZS - ZN - 2, level: WL, tint: 0x2a8a90, deep: 0x0e4a52, sky: 0x8ad8e0 });
  zone.root.add(flood);
  const km = buildKelp(kelp, { base: 0x0a2a20, mid: 0x2a6a4a, glow: 0x40ffd0, glowI: 1.8 }); if (km) zone.root.add(km);
  const shafts = [];
  for (let i = 0; i < 6; i++) shafts.push({ x: rng.range(-10, 10), y: 0.3, z: -20 + i * 8 + rng.range(-2, 2), w: rng.range(1.3, 2.2), h: 24, rot: 0.35, tilt: -0.28, alpha: rng.range(0.2, 0.3), color: 0xb8f0ff });
  zone.root.add(buildShafts(shafts));
  for (const s2 of shafts) g.info('glow', S.circle(s2.x, s2.z - 3, s2.w * 0.6), { soft: 2, amount: 0.14 });
  g.uniforms.uGlowCol.value.setRGB(0.25, 0.7, 0.75);
  for (const s2 of shafts) kit.lights.push({ x: s2.x, y: 3, z: s2.z - 2, color: 0xa8f0ff, intensity: 5, radius: 9, flicker: 0.05 });
  const dec = new Decals(H);
  for (let i = 0; i < 26; i++) dec.add(rng.pick(['cracks', 'stain', 'moss', 'rubble']), rng.range(-XW + 1, XW - 1), rng.range(-22, 27), { size: rng.range(1.4, 3.2), alpha: 0.7 });
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 5);
  const motes = buildParticles('plankton', { quality, count: 300, color: [0.5, 1.6, 1.5], color2: [0.8, 1.2, 1.8] });
  const bubbles = buildParticles('bubbles', { quality, count: 120 });
  zone.root.add(motes, bubbles);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); motes.userData.update(focus); bubbles.userData.update(focus); flood.userData.update(focus, dt); });

  // --- nav & anchors
  const nav = new NavGrid(-XW - 1, -26, 2 * XW + 2, 56, 0.5);
  nav.walk(S.rect(0, 2, 2 * XW - 2.4, 49.6));
  nav.walk(S.rect(0, -25.2, 20, 3.4));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 20]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 21, 0);
  zone.anchor('boss', 0, -12, Math.PI);
  zone.anchor('camp', -6.5, 24.5, faceTo(-6.5, 24.5, 0, 0));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('The Drowned Choir', 0, 0, 24);
  zone.env = makeEnv('drowned', { music: 'abyss_choir', ambience: 'underwater' });
  zone.envs = { drowned: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -30, z0: -32, size: 62 }, water: [{ shape: { rect: [0, 2, 2 * XW, 50] }, color: 'rgba(40,140,150,0.45)' }] });
}

// ------------------------------------------------------------------ Gate 2: the abyss platform
export async function buildAbyss(zone, { quality = 1 } = {}) {
  const rng = new RNG(zone.opts.seed ?? 37);
  const R = 24.5, WL = -1.6;
  zone.bounds = { x0: -R, z0: -R, x1: R, z1: R };
  const nz = new Simplex(77);
  const rimPoly = Array.from({ length: 40 }, (_, i) => { const a = i / 40 * TAU; const k = 1 + nz.noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5) * 0.03; return [Math.cos(a) * R * k, Math.sin(a) * R * k]; });
  const plat = S.poly(rimPoly);
  const g = zone.ground = new Ground({ x0: -100, z0: -120, w: 200, d: 220, res: 1, layers: ['marble', 'seastone', 'moss', 'rock', 'mud', 'void'], base: 'rock', seed: 43 });
  g.tint.setRGB(1.0, 1.0, 1.04);
  g.emitColor.setRGB(0.9, 0.5, 1.8);
  g.sculpt((x, z) => {
    const d = plat.sd(x, z);
    if (d > 0.3) return -14 + nz.noise2(x / 20, z / 20) * 3;
    return nz.noise2(x / 9, z / 9) * 0.05 - smoothstep(-2, 0.3, d) * 0.3;
  });
  g.paint('seastone', plat, { soft: 0.5 });
  g.paint('marble', S.circle(0, 0, 19.5), { soft: 0.4 });
  g.plaza(0, 0, 19.2, { layer: 'marble', tile: 2.8, rings: [5.8, 12.5, 19.0], spokes: 8, border: 0.5 });
  for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), rr = rng.range(15, R); g.paint(rng.chance(0.5) ? 'mud' : 'seastone', S.circle(Math.cos(a) * rr, Math.sin(a) * rr, rng.range(1.5, 3.5)), { soft: 2, noise: 1.5, nscale: 2, amount: 0.8 }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; g.paint('void', S.line([[Math.cos(a) * 20, Math.sin(a) * 20], [Math.cos(a) * 24.5, Math.sin(a) * 24.5]], 1.6), { soft: 0.8, noise: 0.8, nscale: 1.2, amount: 0.9 }); }
  g.info('ao', S.ring(0, 0, R - 0.4, 2), { soft: 1.5, amount: 0.3 });

  const kit = new Kit({ seed: 19 });
  const H = (x, z) => g.heightAt(x, z);
  islandSkirt(kit, rimPoly, H, { depth: 12, seed: 8, tint: 0x4a5664, strata: 0x2a3440, glow: 0x7a40ff, lip: 0.5, rings: 10 });
  // broken parapet on the rim
  for (let i = 0; i < 40; i++) {
    if (i % 5 === 2 || rng.chance(0.2)) continue;
    const a = (i + 0.5) / 40 * TAU, a2 = (i + 1.5) / 40 * TAU;
    const x0 = Math.cos(a) * (R - 0.6), z0 = Math.sin(a) * (R - 0.6), x1 = Math.cos(a2) * (R - 0.6), z1 = Math.sin(a2) * (R - 0.6);
    const h = rng.chance(0.3) ? rng.range(0.3, 0.6) : 1.05;
    kit.add('wetstone', box(Math.hypot(x1 - x0, z1 - z0) * 0.98, h, 0.6, 1), M((x0 + x1) / 2, h / 2, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)), { tint: 0x8a98a4, yGround: 0 });
  }
  kit.block(S.ring(0, 0, R - 0.6, 0.8), 0.3);
  // broken arches: whole ones to the north, stumps to the south (camera side)
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) / 8 * TAU;
    const x = Math.cos(a) * (R - 1.4), z = Math.sin(a) * (R - 1.4);
    const rot = faceTo(x, z, 0, 0);
    const north = z < 0;
    const panel = extrude(lancetPanel(6.5, north ? rng.range(9, 13) : rng.range(2.5, 4.2), 4, north ? 5.5 : 9, 8), 1.2, 2);
    kit.add('wetstone', panel, M(x, 0, z, rot + Math.PI), { tint: 0x9aa8b4, yGround: 0, aoH: 3 });
    for (const sx of [-1, 1]) kit.block(S.circle(x + Math.cos(rot) * sx * 2.6, z - Math.sin(rot) * sx * 2.6, 1.0), 0.3);
    coral(kit, x + Math.cos(rot) * 3.2, 0, z - Math.sin(rot) * 3.2, { s: 1.2, seed: i + 20, glow: 0x9a60ff, cols: [0x8a5aff, 0x40c0e0, 0xff6aa0] });
  }
  for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), rr = rng.range(18, R - 1.5); coral(kit, Math.cos(a) * rr, 0, Math.sin(a) * rr, { s: rng.range(0.7, 1.3), seed: 40 + i, glow: rng.pick([0x40ffe0, 0x9a60ff]), cols: [0x8a5aff, 0x40c0e0, 0xff6aa0, 0x4a3a6a] }); }
  // rubble from the fallen arches
  for (let i = 0; i < 20; i++) { const a = rng.range(0, TAU), rr = rng.range(16, R - 1.2); kit.add('wetstone', box(rng.range(0.5, 1.2), rng.range(0.3, 0.7), rng.range(0.5, 1.0), 1), M(Math.cos(a) * rr, 0.2, Math.sin(a) * rr, rng.range(0, 3), 1, 1, 1, rng.range(-0.3, 0.3)), { tint: 0x8a98a4 }); }
  // giant tentacles rising from the abyss around the platform
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.55 + rng.range(-0.1, 0.1), rr = R + rng.range(6, 12);
    tentacle(kit, Math.cos(a) * rr, WL - 2, Math.sin(a) * rr, { h: rng.range(11, 18), r: rng.range(0.9, 1.4), curl: rng.range(0.6, 1.2), dir: a + Math.PI + rng.range(-0.5, 0.5), seed: i + 3 });
  }
  // the drowned cathedral: a dark silhouette rising out of the water to the north
  { const cz = -66, base = WL - 4;
    kit.add('wetstone', box(40, 30, 22, 3), M(0, base + 15, cz - 10), { tint: 0x2a3440 });
    for (const sx of [-1, 1]) {
      kit.add('wetstone', box(9, 44, 9, 3), M(sx * 16, base + 22, cz), { tint: 0x2e3844 });
      kit.add('wetstone', cone(6.5, 18, 4, 3), M(sx * 16, base + 53, cz, Math.PI / 4), { tint: 0x263038 });
    }
    const ring = new THREE.TorusGeometry(7, 0.8, 8, 40); kit.add('wetstone', ring, M(0, base + 24, cz + 1.2), { tint: 0x2a3440 });
    kit.glow(new THREE.CircleGeometry(6.4, 32), M(0, base + 24, cz + 1.0), 0x5a3a9a, 0.7);
    kit.add('wetstone', extrude(lancetPanel(14, 20, 7, 9, 10), 2, 3), M(0, base, cz + 1), { tint: 0x2a3440 });
    kit.add('wetstone', cone(2.2, 14, 4, 3), M(0, base + 37, cz - 10, Math.PI / 4), { tint: 0x263038 });
  }
  // glowing pedestals where the raid gathers (south) and a camp of the expedition
  { const cx = -9, cz = 16.5;
    kit.add('wetstone', cyl(0.9, 1.1, 1.0, 8, 1), M(cx + 1.8, 0.5, cz - 1.2), { tint: 0x8a98a4 });
    kit.glow(new THREE.OctahedronGeometry(0.28, 0), M(cx + 1.8, 1.35, cz - 1.2, 0, 1, 1.6, 1), 0x60e0ff, 1.8);
    kit.light(cx + 1.8, 1.6, cz - 1.2, 0x60e0ff, 4, 9, 0.08);
    P.crateStack(kit, cx - 1.2, 0, cz + 0.8, 0.3, 11);
    kit.block(S.circle(cx + 1.8, cz - 1.2, 1.1), 0.3);
  }
  for (const c of kit.colliders) g.info('ao', S.inflate(c.shape, 0.2), { soft: 1.8, amount: 0.3 });
  await tick();
  await g.build(zone.root, { clip: (x, z) => plat.sd(x, z) < 0.5 });
  kit.build(zone.root);
  await tick();

  const water = buildWater(g, { x: 0, z: -20, w: 240, d: 260, level: WL, shallow: 0x0c1a34, deep: 0x02040c, sky: 0x2a2a5a, swell: 0.08, foam: 0.25 });
  zone.root.add(water);
  water.userData.setEnv?.(makeEnv('abyss'));
  const kelp = [];
  for (let i = 0; i < 70; i++) { const a = rng.range(0, TAU), rr = R + rng.range(0.8, 7); kelp.push({ x: Math.cos(a) * rr, y: WL - 6, z: Math.sin(a) * rr, h: rng.range(7, 11.5), s: rng.range(1.2, 2.0) }); }
  const km = buildKelp(kelp, { base: 0x0a0a24, mid: 0x3a2a7a, glow: 0x6a8aff, glowI: 2.4 }); if (km) zone.root.add(km);
  const dec = new Decals(H);
  for (let i = 0; i < 22; i++) { const a = rng.range(0, TAU), rr = rng.range(2, R - 2); dec.add(rng.pick(['cracks', 'stain', 'rubble', 'pebbles']), Math.cos(a) * rr, Math.sin(a) * rr, { size: rng.range(1.4, 3), alpha: 0.75 }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; dec.add('fissure', Math.cos(a) * 5.5, -6 + Math.sin(a) * 5.5, { size: 6, sz: 0.3, rot: -a, tint: 0xa090c8, emit: 0x8a50ff, emitI: 0.6, alpha: 0.7 }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; dec.add('fissure', Math.cos(a) * 22, Math.sin(a) * 22, { size: 5, sz: 0.4, rot: -a, tint: 0xc0a0ff, emit: 0x8a50ff, emitI: 1.3, alpha: 0.9 }); }
  const dm = dec.build(); if (dm) zone.root.add(dm);
  const flames = buildFlames(kit.flames); if (flames) zone.root.add(flames);
  const pool = new LightPool(zone.root, kit.lights, 4);
  const motes = buildParticles('plankton', { quality, count: 420 });
  const bubbles = buildParticles('bubbles', { quality, count: 100, color: [0.7, 0.9, 1.6] });
  zone.root.add(motes, bubbles);
  zone.onUpdate((dt, t, focus) => { pool.update(dt, t, focus); motes.userData.update(focus); bubbles.userData.update(focus); if (g.uniforms) g.uniforms.uEmitPulse.value = 0.75 + 0.25 * Math.sin(t * 0.9); });

  const nav = new NavGrid(-R - 1, -R - 1, 2 * R + 2, 2 * R + 2, 0.5).walk(S.inflate(plat, -1.1));
  for (const c of kit.colliders) nav.block(c.shape, c.inflate);
  nav.keepConnected([[0, 17]]);
  zone._nav = nav; zone.nav = nav.toContract();
  zone.anchor('spawn', 0, 17, 0);
  zone.anchor('boss', 0, -7, Math.PI);
  zone.anchor('camp', -7.5, 18.4, faceTo(-7.5, 18.4, 0, 0));
  for (const [name, a] of Object.entries(zone.anchors)) { if (nav.walkable(a.x, a.z)) continue; const p = nav.nearest(a.x, a.z, 5); if (p) { a.x = +p[0].toFixed(2); a.z = +p[1].toFixed(2); } }
  zone.region('Oracle of the Deep', 0, 0, R);
  zone.env = makeEnv('abyss', { music: 'abyss_oracle', ambience: 'abyss' });
  zone.envs = { abyss: zone.env };
  zone.minimap = paintMinimap(zone, { px: 384, area: { x0: -R - 4, z0: -R - 4, size: 2 * R + 8 }, clip: (x, z) => plat.sd(x, z) < 0.3 });
}
