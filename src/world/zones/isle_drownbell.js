// 'isle_drownbell' — Drownbell Shoal: low sandbars and ankle-deep shallows among the drowned chapel's ruins. A flat
// arena of packed sand in the middle ringed by a wading moat and broken walls; the chapel's leaning bell tower rises
// from the deep pool to the north, its bell-rope tied to a post on the arena's edge. Ring it three times… Anchors:
// spawn, dock:ship, npc:fisher, bellpull, arena, pool (the Bellwarden surfaces here), seed:1 (→ seed:islands:12), vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { M, box, cyl } from '../kit.js';
import { tube } from '../../engine/geom.js';
import * as THREE from 'three';

export async function build(zone, o = {}) {
  await buildIsle(zone, 'drownbell', {
    paint(g) {
      g.paint('sand', S.circle(0, -6, 14), { soft: 1 });
      g.paint('gravel', S.ring(0, -6, 13.2, 1.4), { soft: 0.6, noise: 0.5, nscale: 1.5 });
      g.paint('flagstone', S.rect(0, -19, 5, 4), { soft: 0.6, noise: 0.5, nscale: 1.5 });
      g.info('wet', S.ring(0, -6, 20, 9), { soft: 2, amount: 0.8 });
    },
    paintOpts: { grassAt: 0.75, moss: true, dirt: false },
    grassDensity: 0.5,
    wade: -0.5,
    decorate(c) {
      const { kit, H, rng, dec } = c;
      // the bell-pull: a leaning post with a green-bronze rope running to the tower
      const bx = 0, bz = -19, by = H(bx, bz);
      kit.add('timber', cyl(0.18, 0.24, 3.4, 8, 1), M(bx, by + 1.7, bz, 0, 1, 1, 1, 0.1), { tint: 0x5a4a38 });
      kit.add('metal', tube([new THREE.Vector3(bx, by + 3.3, bz - 0.3), new THREE.Vector3(bx, 9, -26), new THREE.Vector3(0, 15, -34)], [0.05, 0.05, 0.05], 4, false), null, { tint: 0x6a8a5a, ao: false, chunkAt: [bx, bz] });
      kit.add('stone', box(1.6, 0.4, 1.6, 1), M(bx, by + 0.2, bz), { tint: 0x9aa494 });
      kit.block(S.circle(bx, bz, 0.5), 0.3);
      for (let i = 0; i < 24; i++) dec.add(rng.pick(['puddle', 'moss', 'pebbles', 'cracks']), rng.range(-28, 28), rng.range(-26, 26), { size: rng.range(1, 2.4), alpha: 0.7 });
      P.net(kit, 6, H(6, 34), 34, 0.4); P.fishBasket(kit, 9, H(9, 32), 32, 0.8); P.ropeCoil(kit, 3.5, H(3.5, 36), 36, 1);
      c.anchor('npc:fisher', 7.5, 30.5, Math.PI);
      c.anchor('npc:witch', -7.5, 31, Math.PI * 0.85);   // Old Morwenna of the Brine (rapport)
      c.anchor('bellpull', bx, bz + 2, Math.PI);
      c.anchor('arena', 0, -4, Math.PI);
      c.anchor('pool', 0, -30, 0); c.anchors.pool.extra = { free: true };
      c.anchor('seed:1', -25, 20, 0);
      c.anchor('vista', -19.5, -13, 0);
    },
  }, o);
}
registerZone('isle_drownbell', { name: 'Drownbell Shoal', kind: 'island', size: 200 }, build);
