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
  zone.env = zone.envs.night;
}
registerZone('isle_moonveil', { name: 'Moonveil Atoll', kind: 'island', size: 200 }, build);
