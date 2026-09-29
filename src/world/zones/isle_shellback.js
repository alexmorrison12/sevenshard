// 'isle_shellback' — Shellback Isle: Grandmother Shellback, a sleeping sea turtle older than the Sundering. Her domed,
// plated shell is the island (moss, blossom trees, a Pip market on the ridge); her great head rests on the north beach
// and her flippers splay into the shallows. Every so often she snores and the whole isle heaves. Anchors: spawn,
// dock:ship, npc:market, npc:elder, npc:guard, weed:0…5 (seaweed to gather), mouth (feed her), market, seed:1, seed:2, vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { mushroom } from '../sea/landmarks.js';
import { hexSeam } from '../sea/isles.js';
import { M, box } from '../kit.js';

export const WEEDS = [[-34, 16], [30, 24], [-38, -8], [37, -12], [-19, 38], [22, 39]];
export async function build(zone, o = {}) {
  await buildIsle(zone, 'shellback', {
    paint(g, c) {
      g.paint('moss', S.circle(0, -2, 34), { soft: 3, noise: 2, nscale: 4, amount: 0.7 });
      // the shell's plates: hexagonal seams painted dark, a marginal band of scutes near the rim
      const seam = hexSeam;
      const dome = (x, z) => c.T.height(x, z) > 3.2 && Math.hypot(x, z + 2) > 12.5;
      g.paint('dirt', { sd: (x, z) => dome(x, z) ? seam(x, z) - 0.55 : 9, box: [-44, -48, 44, 48] }, { soft: 0.4, noise: 0.25, nscale: 1.5 });
      g.paint('rock', { sd: (x, z) => { const r = Math.hypot(x / 40, (z) / 46); return Math.abs(r - 0.86) * 40 - 2.2; }, box: [-44, -48, 44, 48] }, { soft: 0.8, noise: 0.6, nscale: 2, amount: 0.6 });
      g.paint('cobble', S.circle(0, -2, 11.5), { soft: 0.6 });
      g.plaza(0, -2, 11.2, { layer: 'cobble', tile: 1.8, rings: [3.2, 7.4, 10.8], spokes: 12, border: 0.4 });
      g.paint('gravel', S.line([[8, 46], [6, 32], [3, 18], [1, 10]], 2.8), { soft: 1, noise: 0.8, nscale: 2 });
      g.paint('gravel', S.line([[0, -12], [3, -26], [7, -40]], 2.4), { soft: 1, noise: 0.8, nscale: 2 });
    },
    decorate(c) {
      const { kit, flora, H, rng, dec } = c;
      for (let i = 0; i < 160; i++) { const x = rng.range(-36, 36), z = rng.range(-38, 38), y = H(x, z); if (y < 4 || Math.hypot(x, z + 2) < 12) continue; flora.flower(x, y, z, rng.pick([0xffffff, 0xf4d040, 0xff8ab0, 0xa0e070])); }
      for (let i = 0; i < 16; i++) dec.add(rng.pick(['leaves', 'petals', 'moss']), rng.range(-30, 30), rng.range(-30, 30), { size: rng.range(1, 2), alpha: 0.7 });
      // tiny Pip houses (mushroom-capped) around the market
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.6, x = Math.cos(a) * 17, z = -2 + Math.sin(a) * 17, y = H(x, z); if (z < -14) continue; mushroom(kit, x, y - 0.1, z, 0.42, [0xd8483a, 0xe8883a, 0xc86ad0, 0x5a9ae0][i % 4], 300 + i); kit.add('timber', box(0.5, 0.8, 0.08, 1), M(x - Math.cos(a) * 0.3, y + 0.4, z - Math.sin(a) * 0.3, Math.atan2(-Math.cos(a), -Math.sin(a))), { tint: 0x7a4a2a, ao: false }); kit.block(S.circle(x, z, 0.5), 0.3); }
      // seaweed drying racks by the beaches
      for (const [x, z] of [[-26, 30], [26, 32]]) { const y = H(x, z); P.fenceLine(kit, [[x - 2, z], [x + 2, z]], (xx, zz) => H(xx, zz)); P.fishBasket(kit, x, y, z + 1.2, 0.5); }
      c.anchor('npc:market', 1.5, 7.6, Math.PI);
      c.anchor('npc:elder', -6, -8.5, Math.PI * 0.8);
      c.anchor('npc:guard', 11, -40, Math.PI * 1.1);
      WEEDS.forEach(([x, z], i) => c.anchor('weed:' + i, x, z, 0));
      c.anchor('mouth', 8.5, -42.5, Math.PI * 1.25);
      c.anchor('market', 0, -2, 0);
      c.anchor('seed:1', 3.5, -10.5, 0); c.anchor('seed:2', -2, 43, 0);
      c.anchor('vista', 0, -30, 0);
    },
  }, o);
}
registerZone('isle_shellback', { name: 'Shellback Isle', kind: 'island', size: 200 }, build);
