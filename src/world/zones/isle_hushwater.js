// 'isle_hushwater' — Hushwater Lagoon: a high rocky ring (cliffs, a waterfall) around a lagoon so calm the stars can
// see themselves. A jetty runs from the south beach across the wading shallows (pearl beds bubble there) to Coralie's
// rock. The lagoon glows teal at night. Anchors: spawn, dock:ship, npc:mermaid, npc:diver, bed:0…4, jetty,
// seed:1 (→ seed:islands:9), vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import * as S from '../shapes.js';
import * as P from '../props.js';

export async function build(zone, o = {}) {
  let spots;
  await buildIsle(zone, 'hushwater', {
    paint(g) {
      g.paint('sand', S.rect(0, 12, 34, 22), { soft: 2, noise: 1.5, nscale: 3 });
      g.paint('gravel', S.line([[-4, 42], [-4, 30], [0, 22]], 2.6), { soft: 1, noise: 0.8, nscale: 2 });
    },
    decorate(c) {
      const { kit, flora, H, rng, dec } = c;
      spots = c.spots;
      // jetty deck to the mermaid's rock
      const J = c.spots.jettyDeck; c.zone.deck(S.rect(J[0], J[2], J[4], J[3]), J[1]);
      for (let i = 0; i < 90; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(28, 40), x = Math.cos(a) * r, z = -4 + Math.sin(a) * r, y = H(x, z); if (y < 2 || z > 20) continue; flora.flower(x, y, z, rng.pick([0xff8ab0, 0xffffff, 0x7ad8ff, 0xf4d040])); }
      for (let i = 0; i < 12; i++) dec.add(rng.pick(['pebbles', 'moss', 'petals']), rng.range(-16, 16), rng.range(14, 28), { size: rng.range(1, 2), alpha: 0.7 });
      P.net(kit, -9, H(-9, 19) + 0.02, 19, 0.3); P.fishBasket(kit, -6.5, H(-6.5, 18), 18, 0.4); P.ropeCoil(kit, 5, H(5, 20), 20, 1);
      c.anchor('npc:mermaid', 2.6, -5.4, Math.PI); c.anchors['npc:mermaid'].extra = { free: true };
      c.anchor('npc:diver', -7.5, 17.5, Math.PI * 0.9);
      [[-11, 7], [-5, 11.5], [7, 10], [12, 5], [-14, 2]].forEach(([x, z], i) => c.anchor('bed:' + i, x, z + 1.2, 0));
      c.anchor('jetty', 0, -3, 0);
      c.anchor('seed:1', -31, -2, 0);
      c.anchor('vista', 24, -22, 0);
    },
    nav(nav, c) { const J = c.spots.jettyDeck; nav.walk(S.rect(J[0], J[2], J[4] - 0.6, J[3])); },
    water: { glint: 1.1 },
    particles: 'fireflies',
  }, o);
  zone.onEnv(env => { zone.sea.ocean.uniforms.uGlow.value = (env.night || 0) * 0.7 + 0.08; });
}
registerZone('isle_hushwater', { name: 'Hushwater Lagoon', kind: 'island', size: 200 }, build);
