// Crystal Golem: 2.8 m hunched rock golem. Massive faceted boulder shoulders and fists, a small head sunk between them
// with glowing eye slits, a stone body of chiselled low-poly boulders (flat facets + voronoi / mottle detail), glowing
// crystal growths (a big array along the back and shoulders, a crystal heart in the chest, shards on the forearms and
// knees) and bright crystal cores binding the joints. Heavy, stomping gait.
// Variants: amethyst, aqua, amber; elite geode_colossus (×1.4, basalt shell split by magenta geode crystals).
// Every boulder rides its own bone, so death crumbles it into a rubble heap and spawn assembles it out of the ground.
import * as THREE from 'three';
import { BipedCtl, armRot, legsLocal, legsPlant } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bStun, retime } from '../acts.js';
import { rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { orb } from '../parts2.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { postHook, boneStats, Pile, crystal, rockGeo, lerp3, hash, easeOut } from './common.js';

const V3 = THREE.Vector3;
const PAL = {
  amethyst: { stone: 0x646070, stone2: 0x3a3644, cb: 0x5a1aa0, ct: 0xe8c0ff, glow: 0xb45cff, eye: 0xf0d8ff },
  aqua: { stone: 0x5a6670, stone2: 0x323c46, cb: 0x0a6a8a, ct: 0xb4fff6, glow: 0x3ae6ff, eye: 0xd8ffff },
  amber: { stone: 0x6e6254, stone2: 0x40362c, cb: 0xa44a06, ct: 0xffe49a, glow: 0xff9a1a, eye: 0xfff0c0 },
  geode_colossus: { stone: 0x3c3a42, stone2: 0x1e1c24, cb: 0x9a1070, ct: 0xffd2f2, glow: 0xff46cc, eye: 0xfff0fa, vein: 0xd8c08a },
};
const J = {
  hips: [0, 1.08, 0.14], spine: [0, 1.42, 0.1], chest: [0, 1.86, 0.02], head: [0, 2.12, -0.28],
  sho: [0.66, 2.12, 0.02], elb: [0.84, 1.44, -0.06], wri: [0.9, 0.84, -0.16],
  hip: [0.34, 1.02, 0.14], knee: [0.4, 0.56, 0.02], ank: [0.42, 0.16, 0.1],
};
const mx = (p, s) => [p[0] * s, p[1], p[2]];

export const crystal_golem = {
  name: 'Crystal Golem',
  variants: ['amethyst', 'aqua', 'amber', 'geode_colossus'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'geode_colossus' : 'amethyst');
    const elite = v === 'geode_colossus' || !!opts.elite;
    const pal = elite && v !== 'geode_colossus' ? { ...PAL[v], stone: PAL.geode_colossus.stone, stone2: PAL.geode_colossus.stone2 } : PAL[v];
    return { variant: v, pal, elite, geode: v === 'geode_colossus', scale: elite ? 1.4 : 1, mat: { dfreq: 2.2, furAxis: 1, rim: 0.22, rimColor: pal.glow, dissolveCol: pal.glow, wrap: 0.45 } };
  },
  rig(R) {
    R.add('hips', null, J.hips); R.add('spine', 'hips', J.spine); R.add('chest', 'spine', J.chest); R.add('head', 'chest', J.head);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', mx(J.sho, s)); R.add('armL' + n, 'armU' + n, mx(J.elb, s)); R.add('hand' + n, 'armL' + n, mx(J.wri, s));
      R.add('thigh' + n, 'hips', mx(J.hip, s)); R.add('shin' + n, 'thigh' + n, mx(J.knee, s)); R.add('foot' + n, 'shin' + n, mx(J.ank, s));
    }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite, G = cfg.geode;
    const cS = col(c.stone), cS2 = col(c.stone2), cV = col(c.vein ?? c.stone);
    const dStone = [0, 0.5, 0.4, 0.08];
    let seed = cfg.variant.length * 7 + (E ? 50 : 0);
    const rock = (bone, pos, r, rot = [0, 0, 0], detail = 1, o = {}) => {
      const g = rockGeo(pos, r, rot, seed++, detail, { cuts: 8, bump: 0.07, ...o });
      const tone = 0.85 + hash(seed, 9) * 0.3;
      acc.add(g, {
        skin: rigid(b(bone)), dtl: dStone,
        color: (p, n) => {
          const up = n.y * 0.5 + 0.5, stripe = G ? sstep(0.8, 0.95, Math.sin(p.x * 9 + p.y * 13 + p.z * 7)) : 0;
          const q = lerp3(cS2, cS, sstep(0.1, 0.9, up) * 0.8 + 0.2 * hash(Math.round(p.x * 40 + p.y * 31 + p.z * 17), 3));
          return lerp3([q[0] * tone, q[1] * tone, q[2] * tone], cV, stripe * 0.6);
        },
      });
    };
    const cry = (bone, base, dir, len, r, k = 1) => crystal(acc, rigid(b(bone)), base, dir, len * k, r * k, { base: c.cb, tip: c.ct }, [0.35, 2.1], { rot: hash(seed++, 4) * 3 });
    const cluster = (bone, base, dir, n, len, r, spread = 0.45) => {
      const D = new V3(...dir).normalize(), up = Math.abs(D.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
      const u = new V3().crossVectors(D, up).normalize(), v = new V3().crossVectors(D, u);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + hash(seed, 1) * 2, t = i === 0 ? 0 : spread * (0.6 + hash(seed + i, 2) * 0.6);
        const d = D.clone().addScaledVector(u, Math.cos(a) * t).addScaledVector(v, Math.sin(a) * t).normalize();
        const p = new V3(...base).addScaledVector(u, Math.cos(a) * r * 1.2 * (i ? 1 : 0)).addScaledVector(v, Math.sin(a) * r * 1.2 * (i ? 1 : 0));
        cry(bone, p.toArray(), d.toArray(), len * (i === 0 ? 1 : 0.55 + hash(seed + i, 3) * 0.35), r * (i === 0 ? 1 : 0.7));
      }
      seed += 7;
    };
    const core = (bone, p, r) => orb(acc, p, r, rigid(b(bone)), c.glow, 2.4, 0);
    // ---------------- torso: pelvis, belly, massive hunched chest, back hump
    rock('hips', [0, 1.06, 0.15], [0.41, 0.24, 0.31], [0.1, 0, 0], 1);
    rock('spine', [0, 1.43, 0.1], [0.42, 0.3, 0.34], [0.05, 0.3, 0], 1);
    rock('chest', [0, 1.9, 0.03], [0.66, 0.46, 0.48], [0.28, 0, 0], 2, { cuts: 10 });
    rock('chest', [0, 2.12, 0.3], [0.44, 0.3, 0.32], [0.5, 0, 0.1], 1);
    for (const s of [-1, 1]) rock('chest', [s * 0.36, 1.66, -0.2], [0.2, 0.2, 0.18], [0.3, s * 0.5, 0], 1); // pectoral slabs
    // ---------------- head: small, low between the shoulders; brow slab, glowing eye slits, crystal crest
    rock('head', [0, 2.18, -0.33], [0.17, 0.15, 0.18], [0.1, 0, 0], 1, { cuts: 4 });
    rock('head', [0, 2.25, -0.45], [0.16, 0.05, 0.07], [-0.2, 0, 0], 0, { cuts: 2, bump: 0.05 });
    for (const s of [-1, 1]) acc.add(new THREE.BoxGeometry(0.075, 0.022, 0.03), { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, s * 0.25, s * 0.18, 'YXZ')).setPosition(s * 0.065, 2.2, -0.49), skin: rigid(b('head')), color: c.eye, emis: 4, dtl: [0, 0, 0, 0] });
    cluster('head', [0, 2.3, -0.26], [0, 1, 0.35], E ? 3 : 2, 0.2, 0.035, 0.5);
    // ---------------- arms: shoulder boulders, upper arms, forearms, massive fists with knuckle stones
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      rock('armU' + n, [s * 0.72, 2.22, 0.02], [0.41, 0.34, 0.38], [0.2, s * 0.4, s * 0.25], 2, { cuts: 10 });
      rock('armU' + n, [s * 0.8, 1.78, -0.02], [0.23, 0.32, 0.23], [0, 0, s * 0.1], 1);
      rock('armL' + n, [s * 0.87, 1.13, -0.1], [0.28, 0.35, 0.28], [0.1, 0, s * 0.05], 1);
      rock('hand' + n, [s * 0.92, 0.58, -0.23], [0.34, 0.29, 0.34], [0.1, s * 0.3, 0], 2, { cuts: 10 });
      for (let k = 0; k < 3; k++) rock('hand' + n, [s * (0.84 + k * 0.08), 0.52 - Math.abs(k - 1) * 0.02, -0.48], [0.085, 0.08, 0.08], [k, k * 2, 0], 0, { cuts: 2, bump: 0.08 });
      // crystal growths: shoulders (up & out), forearms (outer side)
      cluster('armU' + n, [s * 0.78, 2.4, 0.08], [s * 0.45, 1, 0.3], E ? 4 : 3, E ? 0.55 : 0.45, 0.075, 0.45);
      cluster('armL' + n, [s * 1.04, 1.22, -0.06], [s * 1, 0.55, 0.2], 2, 0.26, 0.05, 0.4);
      // glowing binding cores at the joints
      core('armU' + n, mx(J.sho, s), 0.1); core('armL' + n, mx(J.elb, s), 0.11); core('hand' + n, mx(J.wri, s), 0.1);
    }
    // ---------------- legs: thighs, shins, slab feet; knee crystals & cores
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      rock('thigh' + n, [s * 0.37, 0.8, 0.1], [0.25, 0.29, 0.27], [0.1, 0, 0], 1);
      rock('shin' + n, [s * 0.41, 0.37, 0.05], [0.24, 0.27, 0.25], [0, s * 0.2, 0], 1);
      rock('foot' + n, [s * 0.43, 0.1, -0.03], [0.26, 0.11, 0.32], [0, s * 0.1, 0], 1, { flatBottom: 0.85, cuts: 4 });
      core('shin' + n, mx(J.knee, s), 0.09); core('thigh' + n, mx(J.hip, s), 0.09);
      cluster('shin' + n, [s * 0.5, 0.5, -0.06], [s * 0.6, 0.7, -0.3], 1, 0.2, 0.045);
    }
    // ---------------- crystal array along the back (reads from the iso camera), crystal heart in the chest
    cluster('chest', [0, 2.3, 0.3], [0, 1, 0.45], E ? 7 : 5, E ? 0.95 : 0.72, 0.1, 0.5);
    cluster('chest', [0.26, 2.2, 0.36], [0.35, 1, 0.5], E ? 3 : 2, 0.45, 0.07, 0.35);
    cluster('chest', [-0.26, 2.2, 0.36], [-0.35, 1, 0.5], E ? 3 : 2, 0.45, 0.07, 0.35);
    cluster('chest', [0, 1.84, -0.42], [0, 0.1, -1], G ? 6 : 4, G ? 0.3 : 0.22, 0.06, 0.55);
    core('chest', [0, 1.84, -0.36], G ? 0.17 : 0.13);
    core('head', J.head, 0.08); core('spine', [0, 1.26, 0.05], 0.1);
    if (G) { // geode: split open shell glittering with crystals along the flanks
      for (const s of [-1, 1]) { cluster('chest', [s * 0.5, 1.95, -0.2], [s * 0.8, 0.4, -0.6], 4, 0.3, 0.06, 0.5); cluster('spine', [s * 0.3, 1.45, -0.18], [s * 0.7, 0.2, -0.7], 3, 0.22, 0.05, 0.5); }
    }
    cfg.boneStats = boneStats(acc, R.bones.length);
  },
  sockets: {
    head: ['head', [0, 2.45, -0.3]], mouth: ['head', [0, 2.1, -0.5]], center: ['chest', [0, 1.7, 0.0]], chest: ['chest', [0, 1.84, -0.45]],
    back: ['chest', [0, 2.3, 0.4]], handR: ['handR', [0.92, 0.55, -0.3]], handL: ['handL', [-0.92, 0.55, -0.3]], fistR: ['handR', [0.92, 0.4, -0.3]], fistL: ['handL', [-0.92, 0.4, -0.3]],
  },
  height: 2.8, radius: 1.0,
  controller(inst) { return new GolemCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
class GolemCtl extends BipedCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.stats = inst.entry.cfg.boneStats; this.pile = new Pile(this.pose.n);
    this.seed = (inst.seed || 0) + Math.random() * 100;
    postHook(this, post);
  }
}
function post(ctl) {
  const P = ctl.pose;
  const da = ctl.acts.get('death');
  if (da) {
    if (!da.u.planned) { da.u.planned = true; const hp = P.wp[P.b.hips]; ctl.pile.plan(ctl, ctl.stats, { cx: hp.x, cz: hp.z + 0.2, pull: da.u.fromDown ? 0.15 : 0.4, spread: 0.7, delay: da.u.fromDown ? [0.1, 0.45] : [0.45, 0.85], fall: 0.3, hop: 0.07, stack: 0.12, seed: ctl.seed + da.seed }); }
    ctl.pile.blend(ctl, da.t, da.w);
  }
  const sa = ctl.acts.get('spawn');
  if (sa) {
    if (!sa.u.planned) { sa.u.planned = true; ctl.pile.plan(ctl, ctl.stats, { cx: 0, cz: 0, pull: 0.25, spread: 0.5, delay: [0.05, 1.05], fall: 0.18, bury: 1.15, order: 'height', H: 2.6, seed: ctl.seed + sa.seed }); }
    ctl.pile.assemble(ctl, sa.t, sa.w, 1);
  }
}

// ================================================================================================ animation
const GAIT = {
  legs: [
    { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.44, 0, -0.2], body: 'hips', lift: 0.16, flex: 0.35, heel: 0.2, out: 0.12 },
    { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.44, 0, -0.2], body: 'hips', lift: 0.16, flex: 0.35, heel: 0.2, out: 0.12 },
  ],
  maxStride: 0.95, fMin: 0.5, settleDist: 0.1,
  gaits: [
    { v: 1.1, f: 1.0, duty: 0.66, lift: 1, off: { L: 0, R: 0.5 }, bob: 0.05, bobF: 2, bobPh: 0.05, roll: 0.08, rollF: 1, rollPh: 0.25, sway: 0.07, swayF: 1, swayPh: 0.25, nod: 0.03, nodF: 2 },
    { v: 3.4, f: 1.55, duty: 0.5, lift: 1.35, off: { L: 0, R: 0.5 }, bob: 0.09, bobF: 2, bobPh: 0.1, roll: 0.07, rollF: 1, rollPh: 0.25, sway: 0.06, swayF: 1, swayPh: 0.25, nod: 0.04, nodF: 2 },
  ],
};
const up2 = (ctl, s, u, o, e, tw = 0, w = 1) => armRot(ctl, s, u, e, w, o, tw);
const ACTIONS = {
  attack: { dur: 1.0, a: 0.06, d: 0.86, hit: 0.5, fn(ctl, a, w) { // haymaker: right fist cocks back, torso winds, then punches through
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.4, k) * (1 - sstep(0.4, 0.5, k)), pu = sstep(0.4, 0.52, k) * (1 - sstep(0.66, 1, k));
    P.move(b.hips, 0, -0.06 * (wind + pu) * w, (0.08 * wind - 0.22 * pu) * w);
    P.rot(b.hips, 0, (0.2 * wind - 0.25 * pu) * w, 0);
    P.rot(b.spine, (0.05 * wind - 0.15 * pu) * w, (0.35 * wind - 0.4 * pu) * w, 0);
    P.rot(b.chest, (-0.1 * pu) * w, (0.2 * wind - 0.25 * pu) * w, 0);
    up2(ctl, 1, -0.4 * wind + 1.45 * pu, 0.35 * wind - 0.15 * pu, 1.5 * wind + 0.05 * pu, 0, w);
    up2(ctl, -1, 0.5 * wind + 0.2 * pu, 0.2, 0.6, 0, w);
    ctl.glow = mix(ctl.glow, 1.5, pu * w);
    legsPlant(ctl, (wind + pu) * w * 0.7, 1.3, -0.1 * pu);
  } },
  attack2: { dur: 1.3, a: 0.05, d: 0.88, hit: 0.58, fn(ctl, a, w) { // double-fist hammer: both fists raised overhead together → smash down
    const P = ctl.pose, b = ctl.b, k = a.k;
    const lift = sstep(0, 0.45, k) * (1 - sstep(0.5, 0.58, k)), sm = sstep(0.5, 0.6, k) * (1 - sstep(0.76, 1, k));
    P.move(b.hips, 0, (0.04 * lift - 0.2 * sm) * w, (0.06 * lift - 0.16 * sm) * w);
    P.rot(b.hips, (0.1 * lift - 0.2 * sm) * w, 0, 0);
    P.rot(b.spine, (0.25 * lift - 0.35 * sm) * w, 0, 0); P.rot(b.chest, (0.15 * lift - 0.25 * sm) * w, 0, 0);
    P.rot(b.head, (0.25 * lift - 0.1 * sm) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) up2(ctl, s, 2.9 * lift + 0.85 * sm, -0.45 * lift - 0.35 * sm, 0.6 * lift + 0.05 * sm, s * 0.2 * lift, w);
    ctl.glow = mix(ctl.glow, 1 + 1.2 * lift + 1.2 * sm, w);
    legsPlant(ctl, (lift + sm) * w * 0.8, 1.35, -0.06 * sm);
  } },
  attack_big: { dur: 1.9, a: 0.04, d: 0.9, hit: 0.53, fn(ctl, a, w) { // crystals flare, fists rise high (trembling telegraph) → earth-shattering ground slam
    const P = ctl.pose, b = ctl.b, k = retime(a.k, 0.7, 0.53), t = a.t; // authored impact at 0.70 lands at 0.53 (game: dur 1.5, hit 0.8 s)
    const rise = sstep(0.02, 0.5, k) * (1 - sstep(0.64, 0.7, k)), trem = sstep(0.35, 0.64, k) * (1 - sstep(0.64, 0.66, k)) * Math.sin(t * 48) * 0.03;
    const slam = sstep(0.64, 0.7, k) * (1 - sstep(0.86, 1, k));
    P.move(b.hips, trem, (0.03 * rise - 0.34 * slam) * w, (0.1 * rise - 0.2 * slam) * w);
    P.rot(b.hips, (0.15 * rise - 0.3 * slam + trem) * w, 0, trem * w);
    P.rot(b.spine, (0.3 * rise - 0.45 * slam) * w, 0, 0); P.rot(b.chest, (0.2 * rise - 0.3 * slam) * w, 0, 0);
    P.rot(b.head, (0.35 * rise - 0.2 * slam) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) up2(ctl, s, 3.0 * rise + 0.55 * slam + trem * 4, 0.35 * rise - 0.05 * slam, 0.35 * rise, 0, w);
    const g = sstep(0.02, 0.62, k) * (1 - sstep(0.72, 0.9, k));
    ctl.glow = mix(ctl.glow, 1 + 2.4 * g + 1.2 * slam, w); ctl.charge = Math.max(ctl.charge, g * w);
    legsPlant(ctl, (rise + slam) * w * 0.9, 1.45, -0.08 * slam);
  } },
  roar: { dur: 1.8, a: 0.1, d: 0.85, fn(ctl, a, w) { // chest out, arms spread, crystals blaze
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const u = sstep(0, 0.25, k) * (1 - sstep(0.8, 1, k)), sh = Math.sin(t * 36) * 0.02 * u;
    P.move(b.hips, 0, -0.05 * u * w, 0);
    P.rot(b.spine, (0.22 * u + sh) * w, 0, 0); P.rot(b.chest, (0.2 * u + sh) * w, 0, sh * w); P.rot(b.head, 0.45 * u * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) up2(ctl, s, 0.7 * u, 1.0 * u, 0.7 * u, 0, w);
    ctl.glow = mix(ctl.glow, 1 + 2.2 * u, w); ctl.charge = Math.max(ctl.charge, 0.45 * u * w);
    legsPlant(ctl, u * w * 0.7, 1.4, 0);
  } },
  idle_alt: { dur: 3.0, a: 0.12, d: 0.85, fn(ctl, a, w) { // lifts a fist to its face, turns it; crystals pulse
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const u = sstep(0, 0.3, k) * (1 - sstep(0.75, 1, k));
    up2(ctl, 1, 1.6 * u, -0.25 * u, 1.7 * u, Math.sin(t * 2) * 0.4 * u, w);
    P.rot(b.head, 0.1 * u * w, -0.35 * u * w, 0.1 * u * w);
    ctl.glow = mix(ctl.glow, 1 + 0.6 * Math.max(0, Math.sin(t * 4)), u * w);
  } },
  hit: bHit({ dur: 0.5 }),
  knockback: bKnockback({ dur: 1.0 }),
  knockdown: bKnockdown({ lieY: 0.36, dur: 1.0 }),
  getup: bGetup({ lieY: 0.36, dur: 1.4 }),
  stun: bStun({ dur: 2.0 }),
  death: { dur: 2.2, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, fn(ctl, a, w) { // staggers, knees give, the magic fails and it crumbles
    const P = ctl.pose, b = ctl.b, t = a.t;
    ctl.glow = mix(ctl.glow, t < 0.25 ? 2.5 : Math.max(0.08, 1.2 - (t - 0.25) * 1.3) * (0.7 + 0.3 * Math.abs(Math.sin(t * 30))), w);
    if (a.u.fromDown) { P.move(b.hips, 0, -(P.rest[b.hips].y - 0.36) * w, 0); P.rx(b.hips, 1.5 * w); legsLocal(ctl, w, 0.04, 1.2, 0, 0.28); return; }
    const st = sstep(0, 0.15, t) * (1 - sstep(0.2, 0.5, t)), buckle = sstep(0.15, 0.6, t);
    P.move(b.hips, 0, -0.45 * buckle * w, 0.06 * st * w);
    P.rot(b.hips, (0.15 * st - 0.25 * buckle) * w, 0, 0.1 * buckle * w);
    P.rot(b.spine, (0.2 * st + 0.3 * buckle) * w, 0, 0); P.rot(b.head, (0.3 * st - 0.4 * buckle) * w, 0, 0.2 * buckle * w);
    up2(ctl, 1, 0.5 * st, 0.3, 0.3, 0, w); up2(ctl, -1, 0.4 * st, 0.3, 0.3, 0, w);
    legsLocal(ctl, buckle * w, 0.35, 1.2, 0, 0);
  } },
  spawn: { dur: 2.4, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // rocks rise out of the ground and assemble bottom-up (post()), then it roars
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const roar = sstep(0.72, 0.8, k) * (1 - sstep(0.92, 1, k));
    P.rot(b.spine, 0.2 * roar * w, 0, 0); P.rot(b.chest, 0.18 * roar * w, 0, 0); P.rot(b.head, 0.4 * roar * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) up2(ctl, s, 0.8 * roar, 0.9 * roar, 0.6 * roar, 0, w);
    ctl.glow = mix(ctl.glow, 0.3 + 0.7 * sstep(0.2, 0.7, k) + 2 * roar, w); ctl.charge = Math.max(ctl.charge, 0.5 * roar * w);
  } },
};
const SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
  gait: GAIT,
  arm: { swing: 0.28, out: 0.12, elbow: 0.25, runSwing: 0.45, runOut: 0.15, runElbow: 0.5, combatUp: 0.45, combatElbow: 0.55, combatOut: 0.1 },
  lean: { walk: 0.08, run: 0.22, combat: 0.12 }, twist: 0.08, waddle: 0.05, crouch: 0.08, breathe: 0.006,
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 6, chargeK: 0.16,
  pose(ctl) { // heavy footfalls: every stomp jolts the body and shakes the crystals
    const P = ctl.pose, b = ctl.b, G = ctl.gait;
    let jolt = 0; for (let i = 0; i < G.legs.length; i++) jolt = Math.max(jolt, G.legs[i].down);
    const j = jolt * jolt * clamp01(Math.abs(ctl.speedSm) * 2);
    P.move(b.hips, 0, -0.045 * j, 0);
    P.rot(b.chest, 0.04 * j, 0, 0.02 * j * Math.sin(ctl.t * 40)); P.rot(b.head, -0.05 * j, 0, 0);
    P.rx(b.spine, -0.12); P.rx(b.chest, -0.08); P.rx(b.head, 0.12);
    ctl.glow *= 1 + 0.12 * Math.sin(ctl.t * 1.7) + 0.25 * j;
  },
  actions: ACTIONS,
};
