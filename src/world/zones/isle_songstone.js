// 'isle_songstone' — Songstone Isle: a green isle around a sunken amphitheatre. Five stone Cantors on the terrace
// ring each hum a song; answer each with the same song and the Songstone in the middle wakes. Ruins on the northern
// hill, wind harps, wildflowers, goats' paths. Anchors: spawn, dock:ship, npc:keeper, npc:goatherd, cantor:0…4,
// stone, seed:1 (→ seed:islands:3), vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import { CANTORS } from '../sea/landmarks.js';
import * as S from '../shapes.js';
import * as P from '../props.js';

export async function build(zone, o = {}) {
  await buildIsle(zone, 'songstone', {
    paint(g) {
      g.paint('flagstone', S.circle(0, -6, 12.8), { soft: 0.4 });
      g.plaza(0, -6, 12.6, { layer: 'flagstone', tile: 2.2, rings: [3.6, 8.2, 12.2], spokes: 10, border: 0.4 });
      g.paint('gravel', S.ring(0, -6, 22.5, 4.2), { soft: 0.8, noise: 0.6, nscale: 2 });
      g.paint('gravel', S.line([[6, 42], [4, 28], [0, 17]], 3), { soft: 1, noise: 0.8, nscale: 2 });
      g.paint('dirt', S.line([[0, -29], [-4, -36], [-6, -42]], 2.4), { soft: 1, noise: 0.8, nscale: 2 });
      g.info('wear', S.ring(0, -6, 22.5, 3), { soft: 2, amount: 0.5 });
    },
    decorate(c) {
      const { kit, flora, H, rng } = c;
      // wildflowers everywhere the grass is thick
      for (let i = 0; i < 260; i++) { const x = rng.range(-44, 44), z = rng.range(-48, 36), y = H(x, z); if (y < 1.6 || Math.hypot(x, z + 6) < 26) continue; flora.flower(x, y, z, rng.pick([0xffffff, 0xf4d040, 0xa070e0, 0xff8ab0, 0x7ab0ff])); }
      // benches on the amphitheatre floor, lamp braziers at the dais
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * 8.6, z = -6 + Math.sin(a) * 8.6; P.bench(kit, x, H(x, z), z, Math.atan2(x, z + 6) + Math.PI, { w: 2.2 }); }
      for (const s of [-1, 1]) P.brazier(kit, s * 4.6, H(s * 4.6, -2), -2, { s: 0.7, color: 0x9ad8ff, glow: 0x7ac0ff });
      // a goat pen by the goatherd's hut
      P.fenceLine(kit, [[-30, 10], [-30, 22], [-18, 22], [-18, 10]], (x, z) => H(x, z));
      P.hay(kit, -26, H(-26, 18), 18, 1, 0.3); P.barrel(kit, -20, H(-20, 12), 12, 1);
      // anchors
      c.anchor('npc:keeper', 2.5, 12.5, Math.PI);
      c.anchor('npc:goatherd', -16.5, 16, Math.PI * 0.8);
      CANTORS.forEach((cn, i) => { const r = 18.4, x = Math.cos(cn.a) * r, z = -6 + Math.sin(cn.a) * r; c.anchor('cantor:' + i, x, z, Math.atan2(-x, -(z + 6)) + Math.PI); });
      c.anchor('stone', 0, -1.2, 0);
      c.anchor('seed:1', 5, -44, 0);
      c.anchor('vista', -3, -37.5, 0);
    },
  }, o);
}
registerZone('isle_songstone', { name: 'Songstone Isle', kind: 'island', size: 200 }, build);
