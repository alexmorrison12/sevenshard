// 'isle_powderkeg' — Powderkeg Cove: a horseshoe island around a sheltered cove (south), the smugglers' village on its
// shores, and the old bastion on the northern headland — a low gun parapet over the open sea, seven cannons you can
// man, the powder magazine the Blackgull pirates want to blow up. Anchors: spawn, dock:ship, npc:gunner,
// npc:smuggler, gun:0…6 (stand here to man a gun), magazine, land:0/1 (pirate landing beaches), sea:0…3 (where
// longboats appear), brig (the brigs' lane), seed:1, seed:2, vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import { GUNS } from '../sea/landmarks.js';
import { BASTION } from '../sea/isles.js';
import * as S from '../shapes.js';
import * as P from '../props.js';

export async function build(zone, o = {}) {
  await buildIsle(zone, 'powderkeg', {
    paint(g) {
      g.paint('cobble', S.poly(BASTION), { soft: 0.6 });
      g.paint('gravel', S.rect(0, -17, 8, 12), { soft: 0.6 });
      g.paint('dirt', S.line([[-6, 28], [-10, 14], [-4, 2], [0, -10]], 3.2), { soft: 1.2, noise: 1, nscale: 2 });
      g.paint('dirt', S.line([[-30, 12], [-14, -2], [14, -2], [30, 12]], 2.6), { soft: 1.2, noise: 1, nscale: 2 });
      g.info('wear', S.poly(BASTION), { soft: 2, amount: 0.4 });
    },
    decorate(c) {
      const { kit, H, rng, dec } = c;
      for (let i = 0; i < 16; i++) dec.add(rng.pick(['scorch', 'cracks', 'rubble']), rng.range(-16, 16), rng.range(-40, -24), { size: rng.range(0.8, 2), alpha: 0.6 });
      for (const [x, z] of [[-8, -12], [8, -12], [-20, 4], [20, 4], [-4, 10]]) P.lampPost(kit, x, H(x, z), z, 0);
      P.crateStack(kit, -12, H(-12, 18), 18, 0.3, 4); P.crateStack(kit, 12, H(12, 18), 18, -0.4, 8);
      P.net(kit, -8, H(-8, 22) + 0.02, 22, 0.2); P.ropeCoil(kit, -3, H(-3, 26), 26, 1);
      c.anchor('npc:gunner', 5.5, -25.5, Math.PI);
      c.anchor('npc:smuggler', -25, 6, Math.PI * 0.8);
      GUNS.forEach(([x, z, r], i) => c.anchor('gun:' + i, x - Math.sin(r) * -2.1, z + Math.cos(r) * 2.1, r));
      c.anchor('magazine', 0, -27.2, 0);
      c.anchor('land:0', -33, -33, Math.PI * 0.5); c.anchor('land:1', 33, -33, -Math.PI * 0.5);
      for (const [i, x, z] of [[0, -26, -78], [1, 26, -78], [2, -10, -84], [3, 10, -84]]) { c.anchor('sea:' + i, x, z, Math.PI); c.anchors['sea:' + i].extra = { free: true }; }
      c.anchor('brig', 0, -72, 0); c.anchors.brig.extra = { free: true };
      c.anchor('seed:1', -15.5, 22, 0); c.anchor('seed:2', 41, 8, 0);
      c.anchor('vista', 0, -38, 0);
    },
  }, o);
  for (let i = 0; i < 4; i++) if (zone.anchors['sea:' + i]) zone.anchors['sea:' + i].free = true;
}
registerZone('isle_powderkeg', { name: 'Powderkeg Cove', kind: 'island', size: 200 }, build);
