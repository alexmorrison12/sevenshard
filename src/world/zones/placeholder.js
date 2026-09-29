// Placeholder builder: a plain walled arena with every anchor the real zone will have, so the game can integrate
// a zone id before its real builder lands. (Real builders replace these one by one.)
import { Ground } from '../ground.js';
import { NavGrid } from '../nav.js';
import { Kit } from '../kit.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { makeEnv } from '../env.js';
import { paintMinimap } from '../minimap.js';
import { tick } from '../zone.js';

export function placeholder({ half = 30, layer = 'flagstone', preset = 'day', anchors = {}, region = 'Arena' }) {
  return async function build(zone) {
    zone.bounds = { x0: -half, z0: -half, x1: half, z1: half };
    const g = zone.ground = new Ground({ x0: -half - 30, z0: -half - 30, w: 2 * half + 60, d: 2 * half + 60, layers: [layer, 'dirt', 'gravel'], base: 'gravel' });
    g.paint(layer, S.rect(0, 0, 2 * half, 2 * half), { soft: 0.5 });
    await g.build(zone.root);
    const kit = new Kit();
    const H = (x, z) => g.heightAt(x, z), W = half + 0.7;
    P.wall(kit, -W, -W, W, -W, H); P.wall(kit, W, -W, W, W, H); P.wall(kit, W, W, -W, W, H); P.wall(kit, -W, W, -W, -W, H);
    kit.build(zone.root);
    await tick();
    const nav = new NavGrid(-half, -half, 2 * half, 2 * half, 0.5).walk(S.rect(0, 0, 2 * half - 0.8, 2 * half - 0.8));
    for (const c of kit.colliders) nav.block(c.shape, c.inflate);
    zone._nav = nav; zone.nav = nav.toContract();
    for (const [k, v] of Object.entries(anchors)) zone.anchor(k, v[0], v[1], v[2] || 0);
    zone.region(region, 0, 0, half);
    zone.env = makeEnv(preset);
    zone.minimap = paintMinimap(zone, { px: 256, area: { x0: -half - 4, z0: -half - 4, size: 2 * half + 8 } });
  };
}
