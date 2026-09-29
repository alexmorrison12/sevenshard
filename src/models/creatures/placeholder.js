// Stand-in creature for types that are not sculpted yet: a coloured blob body + head with glowing eyes, hovering bob
// and generic hit / death / spawn actions. Keeps createCreature(type) working for every contract type from day one.
import { HoverCtl } from './ctl.js';
import { col } from '../kit/sdf.js';
import { addEye } from '../kit/parts.js';
import { sstep, clamp01 } from '../kit/rig.js';

export function placeholderDef(name, o = {}) {
  const H = o.height ?? 1, R = o.radius ?? 0.4, C = o.color ?? 0x8a7a6a;
  return {
    name, variants: ['default'], flying: !!o.flying, placeholder: true,
    config(variant) { return { variant: 'default', h: Math.max(0.02, H * 0.035), mat: { dfreq: 3 } }; },
    rig(Rg) { Rg.add('root', null, [0, H * 0.45, 0]); Rg.add('head', 'root', [0, H * 0.78, -R * 0.2]); },
    sculpt(S) {
      S.ell('root', [0, H * 0.42, 0], [R * 0.8, H * 0.36, R], { k: 0.08 * H, col: C, dtl: [0.2, 0, 0.2, 0] });
      S.ell('head', [0, H * 0.8, -R * 0.35], [R * 0.55, H * 0.18, R * 0.55], { k: 0.06 * H, col: C, dtl: [0.2, 0, 0.2, 0] });
    },
    parts(acc, S, Rg) {
      for (const s of [-1, 1]) addEye(acc, S, Rg.index('head'), [s * R * 0.25, H * 0.83, -R * 0.8], [s * 0.4, 0.1, -1], H * 0.05, { iris: 0xffd040, glow: 2.5, irisA: 1.2, pupilA: 0.3 });
    },
    sockets: { head: ['head', [0, H * 1.0, -R * 0.3]], mouth: ['head', [0, H * 0.75, -R * 0.9]], center: ['root', [0, H * 0.45, 0]], back: ['root', [0, H * 0.8, 0.1]] },
    height: H, radius: R,
    controller(inst) { return new HoverCtl(inst, SPEC); },
    get actionList() { return SPEC.actions; },
  };
}
const SPEC = {
  bones: { root: 'root', head: 'head' }, bob: 0.03, bobF: 0.8, lean: 0.15,
  actions: {
    attack: { dur: 0.6, hit: 0.5, fn(ctl, a, w) { const k = a.k, j = sstep(0.3, 0.5, k) * (1 - sstep(0.6, 1, k)); ctl.pose.move(ctl.b.root, 0, 0, -0.2 * j * w); ctl.pose.rx(ctl.b.root, -0.3 * j * w); } },
    hit: { dur: 0.35, fn(ctl, a, w) { ctl.pose.rx(ctl.b.root, 0.25 * Math.sin(a.k * Math.PI) * w); } },
    death: { dur: 1, hold: true, excl: true, state: true, fn(ctl, a, w) { const f = sstep(0, 0.7, a.k); ctl.pose.rot(ctl.b.root, 1.3 * f * w, 0, 0.3 * f * w); ctl.pose.move(ctl.b.root, 0, -0.3 * f * w, 0.3 * f * w); ctl.glow = 1 - 0.8 * f; } },
    spawn: { dur: 1, a: 0.001, state: true, fn(ctl, a, w) { ctl.pose.move(ctl.b.root, 0, -ctl.H * (1 - sstep(0, 0.8, a.k)) * w, 0); } },
  },
};
