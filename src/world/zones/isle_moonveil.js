// 'isle_moonveil' — Moonveil Atoll: a ring of pale sand around a still lagoon, only above the mist at night. The
// lantern shrine on the central islet (a causeway from the south), five stone lantern posts around the ring, the
// wreck of a ghost galleon on the east reef, pale grass, moon-bright water. Anchors: spawn, dock:ship, npc:keeper,
// lantern:0…4 (stand here to light), shrine, wreck, seed:1 (→ seed:islands:6), vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import { LANTERNS } from '../sea/landmarks.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { makeEnv } from '../env.js';
import { M, box, cyl, sphere } from '../kit.js';
import { crystal, boulder } from '../cliffs.js';
import { tube } from '../../engine/geom.js';
import * as THREE from 'three';

const TAU = Math.PI * 2;
/** the bleached skeleton of a great sea-beast lying on the sand (spine along the ring, ribs arching over) */
function whale(kit, H, cx, cz, rot, rng) {
  const bone = 0xe6ded0, dir = [Math.sin(rot), Math.cos(rot)], side = [dir[1], -dir[0]];
  const at = (a, s = 0) => [cx + dir[0] * a + side[0] * s, cz + dir[1] * a + side[1] * s];
  const spine = [];
  for (let k = 0; k <= 12; k++) { const a = -9 + k * 1.6, [x, z] = at(a); spine.push(new THREE.Vector3(x, H(x, z) + 0.35 + Math.sin(k / 12 * Math.PI) * 0.5, z)); }
  kit.add('bone', tube(spine, spine.map((_, k) => 0.22 - Math.abs(k - 5) * 0.012), 7, false), null, { tint: bone, ao: false, chunkAt: [cx, cz] });
  for (let k = 1; k < 10; k++) {
    const a = -7.5 + k * 1.5, h = 2.6 * Math.sin(k / 10 * Math.PI) + 0.6, w = 2.4 * Math.sin(k / 10 * Math.PI) + 0.8;
    for (const sg of [-1, 1]) {
      if (rng.chance(0.12)) continue;                                   // a few ribs are missing
      const pts = [];
      for (let i = 0; i <= 7; i++) { const t = i / 7, [x, z] = at(a + t * 0.5, sg * Math.sin(t * Math.PI * 0.62) * w); pts.push(new THREE.Vector3(x, H(x, z) + 0.45 + Math.sin(t * Math.PI * 0.85) * h * (1 - t * 0.35), z)); }
      kit.add('bone', tube(pts, pts.map((_, i) => 0.12 - i * 0.01), 5, false), null, { tint: bone, ao: false, chunkAt: [cx, cz] });
    }
  }
  const [hx, hz] = at(11), hy = H(hx, hz);
  kit.add('bone', sphere(1.2, 12, 8), M(hx, hy + 0.5, hz, rot, 1.2, 0.7, 1.9), { tint: bone, yGround: hy });
  for (const sg of [-1, 1]) { const [jx, jz] = at(13.2, sg * 0.7); kit.add('bone', box(0.25, 0.3, 3.2, 1), M(jx, H(jx, jz) + 0.2, jz, rot + sg * 0.12), { tint: bone, ao: false }); }
}

export async function build(zone, o = {}) {
  await buildIsle(zone, 'moonveil', {
    paint(g) {
      g.paint('marble', S.circle(0, -4, 8.5), { soft: 0.5 });
      g.plaza(0, -4, 8.2, { layer: 'marble', tile: 2, rings: [2.4, 5.6, 7.8], spokes: 8, border: 0.4 });
      g.paint('gravel', S.rect(0, 16, 3.2, 20), { soft: 0.6, noise: 0.4, nscale: 1.5 });
    },
    paintOpts: { grassAt: 1.1, moss: true, dirt: false },
    decorate(c) {
      const { kit, flora, H, rng, dec } = c;
      for (let i = 0; i < 70; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(30, 44), x = Math.cos(a) * r, z = -2 + Math.sin(a) * r, y = H(x, z); if (y < 0.9) continue; flora.flower(x, y, z, rng.pick([0xe8f0ff, 0xb8c8ff, 0x9ad0ff])); }
      for (let i = 0; i < 20; i++) dec.add(rng.pick(['moss', 'pebbles', 'cracks']), rng.range(-40, 40), rng.range(-40, 36), { size: rng.range(1, 2.4), alpha: 0.6, tint: 0xc8d0e0 });
      P.brazier(kit, -3, H(-3, 4), 4, { s: 0.6, color: 0x7ad8ff, glow: 0x6ac0ff });
      P.brazier(kit, 3, H(3, 4), 4, { s: 0.6, color: 0x7ad8ff, glow: 0x6ac0ff });
      // the ring: a beached leviathan's bones, standing stones with drowned runes, moonglass crystals, driftwood
      whale(kit, H, -37, -2, 0.08, rng);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + 0.62, r = 42.5, x = Math.cos(a) * r, z = -2 + Math.sin(a) * r, y = H(x, z);
        if (y < 0.4 || Math.abs(a % TAU - Math.PI * 0.5) < 0.25) continue;             // keep the causeway clear
        const tilt = rng.range(-0.12, 0.12), ry = Math.atan2(x, z + 2) + Math.PI;
        kit.add('stone', box(1.0, 3.4, 0.7, 1), M(x, y + 1.5, z, ry, 1, 1, 1, tilt, rng.range(-0.08, 0.08)), { tint: 0x8a94a6, yGround: y });
        kit.glow(box(0.08, 1.5, 0.05, 1), M(x - Math.sin(ry) * 0.37, y + 1.8, z - Math.cos(ry) * 0.37, ry), 0x7ad8ff, 1.3);
        kit.block(S.circle(x, z, 0.7), 0.3);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i + 0.5) / 5 * TAU - Math.PI / 2 + 0.3, r = rng.range(31, 35), x = Math.cos(a) * r, z = -2 + Math.sin(a) * r, y = H(x, z);
        if (y < 0.2) continue;
        crystal(kit, x, y - 0.1, z, { s: rng.range(0.6, 0.9), color: 0x7ad8ff, intensity: 2, n: 4, seed: 40 + i, light: i % 2 === 0, block: true });
      }
      for (let i = 0; i < 9; i++) { const a = rng.range(0, TAU), r = rng.range(29, 44), x = Math.cos(a) * r, z = -2 + Math.sin(a) * r, y = H(x, z); if (y < 0.3 || Math.abs(x) < 4 && z > 0) continue; kit.add('timber', cyl(0.14, 0.2, rng.range(2, 3.6), 7, 1), M(x, y + 0.12, z, rng.range(0, TAU), 1, 1, 1, Math.PI / 2), { tint: 0x9a9488, ao: false }); }
      for (let i = 0; i < 6; i++) { const a = rng.range(0, TAU), r = rng.range(30, 44), x = Math.cos(a) * r, z = -2 + Math.sin(a) * r, y = H(x, z); if (y < 0.3) continue; boulder(kit, x, y - 0.25, z, { s: rng.range(0.5, 1.1), seed: 80 + i, tint: 0x7a8494, flat: 0.6, block: true }); }
      c.anchor('npc:keeper', 3.5, 11, Math.PI);
      LANTERNS.forEach((L, i) => { const x = Math.cos(L.a) * L.r, z = -2 + Math.sin(L.a) * L.r; const dx = -Math.cos(L.a), dz = -Math.sin(L.a); c.anchor('lantern:' + i, x + dx * 2, z + dz * 2, Math.atan2(-(-dx), -(-dz))); });
      c.anchor('shrine', 0, 1.5, 0);
      c.anchor('wreck', 38, -18, 0);
      c.anchor('seed:1', 36, -6, 0);
      c.anchor('vista', 0, -9, 0);
    },
    envOver: { day: { fogColor: 0xb8c8dc, fogDensity: 0.012 } },
    particles: 'fireflies',
    water: { glint: 1.2 },
  }, o);
  // Moonveil is a night place: its "day" is a pale, misty pre-dawn
  zone.envs.day = makeEnv('night', { ...zone.envs.night, fogColor: 0x5a7090, fogDensity: 0.012, sunIntensity: 1.6, hemiIntensity: 1.05, grade: { ...zone.envs.night.grade, exposure: 1.25 } });
  zone.envs.night = makeEnv('night', { ...zone.envs.night, sunColor: 0xb0c8f0, sunIntensity: 1.7, hemiSky: 0x5a78b0, hemiIntensity: 1.15, fogColor: 0x1a2a48, grade: { ...zone.envs.night.grade, exposure: 1.3, saturation: 1.0 } });
  zone.env = zone.envs.night;
  zone.ground.tint.setRGB(1.3, 1.36, 1.48);             // moonlit sand reads pale, not grey
}
registerZone('isle_moonveil', { name: 'Moonveil Atoll', kind: 'island', size: 200 }, build);
