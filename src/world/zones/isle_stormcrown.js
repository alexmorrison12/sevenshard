// 'isle_stormcrown' — Stormcrown Spire: a small black-rock island in the eye of the Maelstrom. A 40 m needle of stacked
// rock rises from its middle; a planked ledge spirals 2.6 turns up its flanks to the summit, where the Crown Bell hangs
// in a golden crown of lightning rods. The walkable height follows the ledge (custom heightAt), the nav marks only the
// ledge on the rock. Anchors: spawn, dock:ship, npc:warden, climb (foot of the ledge), summit, bell, seed:1, seed:2, vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import { SPIRE, spirePath } from '../sea/landmarks.js';
import { ISLE_TERRAIN } from '../sea/isles.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import { makeEnv } from '../env.js';

const TAU = Math.PI * 2;
const CX = 0, CZ = -6;
/** ledge height at (x, z) or null (t: 0 at the foot … 1 at the summit) */
export function ledgeAt(x, z) {
  const S0 = SPIRE, dx = x - CX, dz = z - CZ, rho = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
  if (rho < S0.r1 - S0.width / 2 + 0.15) return { y: S0.h1 + 0.3, t: 1, summit: true };
  const span = S0.turns * TAU;
  for (let k = -1; k <= Math.ceil(S0.turns) + 1; k++) {
    const t = (S0.a0 - th + TAU * k) / span;
    if (t < -0.01 || t > 1.01) continue;
    const r = S0.r0 + (S0.r1 - S0.r0) * t;
    if (Math.abs(rho - r) <= S0.width / 2 + 0.05) return { y: S0.h0 + (S0.h1 - S0.h0) * Math.min(1, Math.max(0, t)), t };
  }
  return null;
}
const rockR = y => (SPIRE.r0 - 1.5) + ((SPIRE.r1 - 1.2) - (SPIRE.r0 - 1.5)) * Math.min(1, Math.max(0, y / SPIRE.h1));

export async function build(zone, o = {}) {
  const T = ISLE_TERRAIN.stormcrown;
  await buildIsle(zone, 'stormcrown', {
    paint(g) {
      g.paint('rock', S.circle(0, -6, 22), { soft: 2, noise: 1.5, nscale: 3 });
      g.paint('gravel', S.line([[2, 36], [2, 24], [0, 16]], 2.6), { soft: 1, noise: 0.8, nscale: 2 });
    },
    paintOpts: { grassAt: 2.2, moss: true, dirt: false },
    grassDensity: 0.35,
    storm: 0.45, swell: 1, groundTint: [1, 1, 1],
    decorate(c) {
      const { kit, H, rng, dec } = c;
      for (let i = 0; i < 22; i++) dec.add(rng.pick(['scorch', 'cracks', 'rubble']), rng.range(-26, 26), rng.range(-30, 24), { size: rng.range(1, 2.6), alpha: 0.7 });
      // the warden's shelter: a lean-to of spars and sailcloth, a brazier
      P.brazier(kit, 7, H(7, 22), 22, { s: 0.8 });
      P.crateStack(kit, 10, H(10, 25), 25, 0.5, 11);
      const f = spirePath(0);
      c.anchor('npc:warden', 5.5, 21.5, Math.PI * 0.9);
      c.anchor('climb', f.x, f.z + 1.5, Math.PI / 2);
      c.anchor('summit', 3.2, -6, Math.PI / 2); c.anchors.summit.extra = { free: true, y: SPIRE.h1 + 0.3 };
      c.anchor('bell', 1.8, -6, 0); c.anchors.bell.extra = { free: true, y: SPIRE.h1 + 0.3 };
      c.anchor('seed:1', -19, 17, 0);
      c.anchor('seed:2', -3.2, -6, 0); c.anchors['seed:2'].extra = { free: true, y: SPIRE.h1 + 0.3 };
      c.anchor('vista', 0, -2.8, 0); c.anchors.vista.extra = { free: true, y: SPIRE.h1 + 0.3 };
    },
    nav(nav, c) {
      // the rock blocks; the ledge (and the summit) is walkable
      nav.blockWhere((x, z) => Math.hypot(x - CX, z - CZ) < rockR(T.height(x, z)) + 0.2 && !ledgeAt(x, z));
      nav.walk({ sd: (x, z) => ledgeAt(x, z) ? -1 : 1, box: [CX - SPIRE.r0 - 3, CZ - SPIRE.r0 - 3, CX + SPIRE.r0 + 3, CZ + SPIRE.r0 + 3] });
    },
    heightFn: (x, z, zone) => { const L = ledgeAt(x, z); return L ? L.y : zone.ground.heightAt(x, z) + 0; },
    envOver: {
      day: { sunColor: 0xc8d4e4, sunIntensity: 2.4, hemiSky: 0x8a9cb4, hemiGround: 0x3a4250, hemiIntensity: 1.45, fogColor: 0x687684, fogDensity: 0.0052, background: 0x4a5664, grade: { exposure: 1.15, saturation: 0.88, contrast: 1.08, vignette: 0.36, cool: 0.08, bloom: 0.6, bloomThreshold: 0.86 } },
      night: { sunColor: 0x9ab0d8, sunIntensity: 1.6, hemiSky: 0x5a6a90, hemiIntensity: 1.2, fogColor: 0x243044, grade: { exposure: 1.3, saturation: 0.9, vignette: 0.4, bloom: 0.9, bloomThreshold: 0.78 } },
    },
    water: { cloud: 1.4 },
  }, o);
  // decks and the ground: heightAt consults the ledge first (buildIsle installed heightFn)
  const base = zone.heightAt;
  zone.heightAt = (x, z) => { const L = ledgeAt(x, z); if (L) return L.y; for (const d of zone.decks) if (d.shape.sd(x, z) <= 0) return d.y; return zone.ground.heightAt(x, z); };
  zone.ledgeAt = ledgeAt;
  zone.envs.dusk = makeEnv('dusk', { ...zone.envs.day, sunColor: 0xa08090 });
  zone.env = zone.envs.day;
}
registerZone('isle_stormcrown', { name: 'Stormcrown Spire', kind: 'island', size: 180 }, build);
