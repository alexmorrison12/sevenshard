// 'isle_coinflip' — Coinflip Cay: a crescent cay around a turquoise lagoon. The Gilded Gull casino crowns the western
// rise (marble drum, golden dome, lantern towers); in front of it the Sunwheel (slots) and Barnacle Bones' dice table;
// a boardwalk runs up from the south pier; beach umbrellas, palms, the Golden Gull statue on the northern horn.
// Anchors: spawn, dock:ship, npc:baroness, npc:slots, npc:dice, npc:pip, game:slots, game:dice, seed:1, seed:2, vista.
import * as THREE from 'three';
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { M, box, cyl, sphere } from '../kit.js';

export async function build(zone, o = {}) {
  await buildIsle(zone, 'coinflip', {
    paint(g) {
      g.paint('flagstone', S.circle(-18, -7, 16.2), { soft: 0.5 });
      g.plaza(-18, -7, 16, { layer: 'flagstone', tile: 2.4, rings: [11.2, 15.4], spokes: 18, border: 0.5 });
      g.paint('gravel', S.line([[4, 46], [-2, 30], [-10, 16], [-14, 8]], 3.4), { soft: 1, noise: 0.8, nscale: 2 });
      g.paint('gravel', S.line([[-6, 2], [6, -10], [14, -30]], 2.6), { soft: 1, noise: 0.8, nscale: 2 });
      g.info('wear', S.line([[4, 46], [-10, 16], [-18, 4]], 3), { soft: 2, amount: 0.6 });
    },
    decorate(c) {
      const { kit, flags, H, rng, dec } = c;
      // the Sunwheel cabinet (reels spin at runtime) and the dice table
      const sx = -28, sz = 1.5, sy = H(sx, sz);
      kit.add('marble', box(3.4, 0.4, 2.2, 1), M(sx, sy + 0.2, sz), { tint: 0xf2eadc, yGround: sy });
      kit.add('gold', box(3.0, 3.4, 1.6, 1), M(sx, sy + 2.1, sz - 0.1), { tint: 0xd8a040 });
      kit.add('paint', box(2.5, 1.3, 0.1, 1), M(sx, sy + 2.3, sz + 0.72), { tint: 0x2a1030, ao: false });
      kit.add('gold', cyl(1.45, 1.45, 0.2, 24, 1), M(sx, sy + 4.2, sz, 0, 1, 1, 1, Math.PI / 2), { tint: 0xffd060, ao: false });
      kit.glow(new THREE.TorusGeometry(1.35, 0.06, 6, 40), M(sx, sy + 4.2, sz + 0.12), 0xffe080, 2.6);
      kit.light(sx, sy + 3.5, sz + 1.5, 0xffc860, 5, 9, 0.1);
      kit.block(S.rect(sx, sz, 3.4, 2.2), 0.3);
      const dx = -9, dz = 3.5, dy = H(dx, dz);
      kit.add('planks', cyl(1.6, 1.6, 0.14, 16, 1), M(dx, dy + 1.0, dz), { tint: 0x2a6a3a, ao: false });
      kit.add('gold', new THREE.TorusGeometry(1.6, 0.08, 6, 32).rotateX(Math.PI / 2), M(dx, dy + 1.05, dz), { tint: 0xe0b050, ao: false });
      kit.add('timber', cyl(0.25, 0.4, 1.0, 8, 1), M(dx, dy + 0.5, dz), { tint: 0x5a3a20 });
      kit.block(S.circle(dx, dz, 1.7), 0.3);
      for (const a of [0.6, 2.5]) P.bench(kit, dx + Math.cos(a) * 2.6, dy, dz + Math.sin(a) * 2.6, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI, { w: 1.4 });
      // plaza dressing: planters, lamp posts, bunting from the lantern towers
      for (let i = 0; i < 6; i++) { const a = -0.3 + i * 0.75 + Math.PI * 0.25, r = 15.2, x = -18 + Math.cos(a) * r, z = -7 + Math.sin(a) * r; if (z < -12) continue; P.roundPlanter(kit, x, H(x, z), z, { r: 0.9, seed: 20 + i }); }
      for (const [x, z] of [[-6, 6], [-30, 6], [-2, 20], [2, 34], [-8, 12]]) P.lampPost(kit, x, H(x, z), z, 0, { color: 0xffd070 });
      P.bunting(kit, [-26, H(-26, 1) + 6, 1], [-10, H(-10, 1) + 6, 1], { sag: 1, colors: [0xe8b830, 0xc03a4a, 0x3ab0d8, 0xf6e8c8] });
      // café tables along the boardwalk
      for (let i = 0; i < 3; i++) { const x = -1 + i * 4, z = 24 + i * 3; const y = H(x, z); kit.add('timber', cyl(0.06, 0.08, 1, 6, 1), M(x, y + 0.5, z), { ao: false }); kit.add('planks', cyl(0.6, 0.6, 0.06, 12, 1), M(x, y + 1.02, z), { tint: 0xe8d8b8, ao: false }); kit.add('cloth', new THREE.ConeGeometry(1.4, 0.6, 8), M(x, y + 2.4, z), { tint: i % 2 ? 0xc03a4a : 0xf6e8c8, ao: false }); kit.add('timber', cyl(0.04, 0.04, 2.3, 5, 1), M(x, y + 1.2, z), { ao: false }); }
      // crates of "donations" by the door, a golden coin fountain
      P.crateStack(kit, -30, H(-30, -1), -1, 0.4, 5);
      { const fx = -18, fz = 6, fy = H(fx, fz); kit.add('marble', cyl(1.8, 2, 0.6, 20, 1), M(fx, fy + 0.3, fz), { tint: 0xf0e8dc }); kit.add('gold', cyl(0.3, 0.5, 1.6, 10, 1), M(fx, fy + 1.1, fz), { tint: 0xf0c050 }); kit.add('gold', cyl(0.9, 0.9, 0.12, 20, 1), M(fx, fy + 1.95, fz, 0, 1, 1, 1, 0.3), { tint: 0xffd060, ao: false }); kit.block(S.circle(fx, fz, 2), 0.3); }
      for (let i = 0; i < 14; i++) dec.add(rng.pick(['petals', 'leaves', 'pebbles']), rng.range(-40, 40), rng.range(-30, 40), { size: rng.range(1, 2.2), alpha: 0.7 });
      // anchors
      c.anchor('npc:baroness', -18, 4.2, Math.PI);
      c.anchor('npc:slots', -24.6, 2.4, Math.PI * 0.85);
      c.anchor('npc:dice', -9, 1.2, Math.PI);
      c.anchor('npc:pip', 12.5, -33, Math.PI * 0.9);
      c.anchor('game:slots', sx, sz + 2.3, 0);
      c.anchor('game:dice', dx, dz + 2.3, 0);
      c.anchor('seed:1', 30.5, 17.5, 0); c.anchor('seed:2', 20.5, -43.5, 0);
      c.anchor('vista', 10.5, -35, 0);
      c.slotsAt = [sx, sy, sz]; c.diceAt = [dx, dy, dz];
    },
  }, o);
}
registerZone('isle_coinflip', { name: 'Coinflip Cay', kind: 'island', size: 200 }, build);
