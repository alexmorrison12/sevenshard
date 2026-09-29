// Hellhound: lean fire-maned demon dog. Charcoal hide split by glowing magma cracks, bony shoulder blades and spine
// spikes, swept-back horns, long wedge skull with a heavy jaw (mouth glows), flickering flame mane from brow to
// shoulders and a flaming whip tail. Variants: ember (default), blight (green fire), void (violet fire); elite: alpha.
import * as THREE from 'three';
import { QuadCtl, legsLocal, legsPlant } from '../ctl.js';
import { qHit, qKnockback, qKnockdown, qGetup, qDeath, qStun, qSpawn, qRoar } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, lerp3 } from '../../kit/parts.js';
import { flame } from '../parts2.js';
import { sstep, clamp01, mix, bell } from '../../kit/rig.js';

const PAL = {
  ember: { skin: 0x2e2527, dark: 0x120d0f, belly: 0x44302c, crack: 0xff5a0c, core: 0xffd060, mid: 0xff7a14, tip: 0xb8200a, eye: 0xffe070, horn: 0x1a1414, hornTip: 0x9a7a5a, claw: 0x0c0a0a, mouth: 0xff7a18, glow: 0xff6010 },
  blight: { skin: 0x28302a, dark: 0x0e1410, belly: 0x3a4436, crack: 0x86ff30, core: 0xe0ff90, mid: 0x7ae02a, tip: 0x1a7a1c, eye: 0xe0ff70, horn: 0x141a14, hornTip: 0x8a9a6a, claw: 0x080c08, mouth: 0x9aff40, glow: 0x6ae020 },
  void: { skin: 0x262236, dark: 0x0c0a16, belly: 0x3a3450, crack: 0xa860ff, core: 0xe8c8ff, mid: 0x9a4aff, tip: 0x3010a0, eye: 0xe0c8ff, horn: 0x16121e, hornTip: 0x9a8ab0, claw: 0x08060c, mouth: 0xb070ff, glow: 0x9050ff },
  alpha: { skin: 0x1e1618, dark: 0x0a0607, belly: 0x3a2622, crack: 0xff8a18, core: 0xffe8a0, mid: 0xff9420, tip: 0xd0280a, eye: 0xfffff0, horn: 0x100c0c, hornTip: 0xd8c0a0, claw: 0x080606, mouth: 0xffa030, glow: 0xff8a20 },
};

const HP = [0, 1.04, -0.62], HS = 1.12; // head pivot & head scale
const hx = (p) => [HP[0] + (p[0] - HP[0]) * HS, HP[1] + (p[1] - HP[1]) * HS, HP[2] + (p[2] - HP[2]) * HS];
const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const hellhound = {
  name: 'Hellhound',
  variants: ['ember', 'blight', 'void', 'alpha'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'alpha' : 'ember');
    const elite = v === 'alpha' || !!opts.elite;
    return { variant: v, pal: PAL[v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.4 : 1.1, h: 0.046, hg: { 1: 0.03, 2: 0.029 }, mat: { dfreq: 3.2, rim: 0.3, rimColor: 0xff9a60 }, aoScale: 1.1 };
  },
  rig(R) {
    R.add('body', null, [0, 0.84, 0.04]);
    R.add('hips', 'body', [0, 0.84, 0.36]);
    R.add('chest', 'body', [0, 0.82, -0.22]);
    R.add('neck', 'chest', [0, 0.92, -0.42]);
    R.add('head', 'neck', HP);
    R.add('jaw', 'head', hx([0, 0.985, -0.66]));
    R.add('earL', 'head', hx([-0.07, 1.12, -0.62])); R.add('earR', 'head', hx([0.07, 1.12, -0.62]));
    R.add('tail1', 'hips', [0, 0.88, 0.48]); R.add('tail2', 'tail1', [0, 0.86, 0.66]); R.add('tail3', 'tail2', [0, 0.8, 0.84]); R.add('tail4', 'tail3', [0, 0.7, 1.0]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.14 * s, 0.74, -0.32]); R.add('fL' + n, 'fU' + n, [0.15 * s, 0.45, -0.2]); R.add('fP' + n, 'fL' + n, [0.15 * s, 0.12, -0.28]);
      R.add('rT' + n, 'hips', [0.13 * s, 0.8, 0.4]); R.add('rS' + n, 'rT' + n, [0.15 * s, 0.51, 0.26]); R.add('rM' + n, 'rS' + n, [0.15 * s, 0.25, 0.5]); R.add('rP' + n, 'rM' + n, [0.15 * s, 0.075, 0.46]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const hide = [0.12, 0.18, 0.2, 0], hideS = [0.06, 0.12, 0.15, 0];
    // ---- torso: deep keel chest, bony shoulder blades, wasp waist, compact muscular rump
    S.ell('chest', [0, 0.78, -0.2], [0.165, 0.245, 0.27], { k: 0.07, col: c.skin, tag: 'chest', dtl: hide });
    S.ell('chest', [0, 0.6, -0.3], [0.12, 0.1, 0.13], { k: 0.07, col: c.belly, tag: 'keel', dtl: hideS });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.1, 0.95, -0.27], [0.065, 0.1, 0.12], { k: 0.05, col: c.dark, tag: 'blade', rot: [-0.3, 0, s * 0.25], dtl: hide });
    S.ell('body', [0, 0.85, 0.07], [0.1, 0.095, 0.21], { k: 0.08, col: c.skin, tag: 'waist', dtl: hide });
    S.ell('hips', [0, 0.86, 0.35], [0.13, 0.13, 0.14], { k: 0.07, col: c.skin, tag: 'rump', dtl: hide });
    // ---- neck: thick, arched
    S.cone('neck', [0, 0.86, -0.34], [0, 1.0, -0.58], 0.125, 0.085, { k: 0.07, col: c.skin, b2: 'head', t0: 0.6, t1: 1, dtl: hide });
    S.ell('neck', [0, 0.97, -0.44], [0.12, 0.13, 0.13], { k: 0.07, col: c.dark, tag: 'crest', dtl: hide });
    // ---- head: long wedge skull, heavy brow, pointed snout (scaled around the head pivot)
    const hr = (r) => r * HS;
    S.ell('head', hx([0, 1.07, -0.67]), [hr(0.095), hr(0.08), hr(0.11)], { group: 2, k: 0.045, col: c.skin, tag: 'head', dtl: hideS });
    for (const s of [-1, 1]) {
      S.ell('head', hx([s * 0.05, 1.105, -0.745]), [hr(0.045), hr(0.022), hr(0.04)], { group: 2, k: 0.02, col: c.dark, tag: 'brow', rot: [0.2, s * 0.4, -s * 0.35], dtl: hideS });
      S.ell('head', hx([s * 0.07, 1.0, -0.66]), [hr(0.045), hr(0.05), hr(0.07)], { group: 2, k: 0.03, col: c.skin, tag: 'cheek', dtl: hideS });
    }
    S.cone('head', hx([0, 1.055, -0.74]), hx([0, 1.025, -0.935]), hr(0.058), hr(0.036), { group: 2, k: 0.03, col: c.skin, tag: 'snout', dtl: hideS });
    S.ell('head', hx([0, 1.03, -0.945]), [hr(0.03), hr(0.024), hr(0.022)], { group: 2, k: 0.012, col: c.dark, tag: 'nose', dtl: hideS });
    S.cone('head', hx([0, 0.985, -0.72]), hx([0, 0.985, -0.93]), hr(0.03), hr(0.018), { group: 2, k: 0.012, sub: true, col: c.mouth, tag: 'mouth' });
    S.cone('jaw', hx([0, 0.975, -0.69]), hx([0, 0.962, -0.915]), hr(0.052), hr(0.028), { group: 1, k: 0.03, col: c.skin, tag: 'jaw', dtl: hideS });
    S.ell('jaw', hx([0, 0.958, -0.74]), [hr(0.058), hr(0.03), hr(0.08)], { group: 1, k: 0.03, col: c.skin, tag: 'jaw', dtl: hideS });
    // ---- legs: long, sinewy; knobbly joints; big splayed paws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('fU' + n, [s * 0.125, 0.67, -0.3], [0.07, 0.13, 0.09], { k: 0.06, col: c.skin, tag: 'shoulder', rot: [-0.2, 0, 0], dtl: hide });
      S.cone('fU' + n, [s * 0.14, 0.74, -0.32], [s * 0.15, 0.45, -0.2], 0.062, 0.042, { k: 0.05, col: c.skin, b2: 'fL' + n, t0: 0.75, t1: 1, dtl: hide });
      S.cone('fL' + n, [s * 0.15, 0.45, -0.2], [s * 0.15, 0.13, -0.28], 0.042, 0.032, { k: 0.03, col: c.skin, tag: 'leg', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: hideS });
      S.sph('fL' + n, [s * 0.152, 0.45, -0.19], 0.042, { k: 0.02, col: c.dark, tag: 'knob', dtl: hideS });
      S.ell('fP' + n, [s * 0.15, 0.045, -0.335], [0.048, 0.04, 0.065], { k: 0.035, col: c.dark, tag: 'paw', dtl: hideS });
      S.cone('fP' + n, [s * 0.15, 0.13, -0.28], [s * 0.15, 0.05, -0.32], 0.032, 0.036, { k: 0.03, col: c.dark, tag: 'leg', dtl: hideS });
      S.ell('rT' + n, [s * 0.115, 0.7, 0.37], [0.085, 0.16, 0.13], { k: 0.07, col: c.skin, tag: 'haunch', rot: [0.3, 0, 0], dtl: hide });
      S.cone('rT' + n, [s * 0.13, 0.8, 0.4], [s * 0.15, 0.51, 0.26], 0.07, 0.046, { k: 0.05, col: c.skin, b2: 'rS' + n, t0: 0.8, t1: 1, dtl: hide });
      S.cone('rS' + n, [s * 0.15, 0.51, 0.26], [s * 0.15, 0.25, 0.5], 0.046, 0.031, { k: 0.035, col: c.skin, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: hideS });
      S.sph('rM' + n, [s * 0.15, 0.255, 0.515], 0.036, { k: 0.02, col: c.dark, tag: 'knob', dtl: hideS });
      S.cone('rM' + n, [s * 0.15, 0.25, 0.5], [s * 0.15, 0.075, 0.46], 0.031, 0.03, { k: 0.025, col: c.dark, tag: 'leg', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: hideS });
      S.ell('rP' + n, [s * 0.15, 0.042, 0.405], [0.046, 0.038, 0.062], { k: 0.035, col: c.dark, tag: 'paw', dtl: hideS });
    }
    // ---- whip tail
    S.cone('tail1', [0, 0.88, 0.45], [0, 0.86, 0.66], 0.05, 0.035, { k: 0.04, col: c.skin, tag: 'tail', b2: 'tail2', t0: 0.6, t1: 1, dtl: hide });
    S.cone('tail2', [0, 0.86, 0.66], [0, 0.8, 0.84], 0.035, 0.025, { k: 0.03, col: c.skin, tag: 'tail', b2: 'tail3', t0: 0.6, t1: 1, dtl: hide });
    S.cone('tail3', [0, 0.8, 0.84], [0, 0.7, 1.0], 0.025, 0.016, { k: 0.02, col: c.dark, tag: 'tail', b2: 'tail4', t0: 0.6, t1: 1, dtl: hide });
    if (E) for (const s of [-1, 1]) S.ell('chest', [s * 0.12, 0.88, -0.33], [0.08, 0.1, 0.1], { k: 0.06, col: c.dark, tag: 'blade', dtl: hide });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const g = v.group;
    // darker back, slightly warmer underside
    v.mix(c.dark, sstep(0.3, 0.9, ny) * 0.55 * (1 - v.t('snout')));
    v.mix(c.belly, sstep(-0.2, -0.7, ny) * 0.5);
    // ribs: raised pale bars on the chest flanks
    const ribs = sstep(0.55, 0.85, Math.sin(z * 58 + 1.3)) * sstep(0.5, 0.85, Math.abs(nx)) * v.t('chest') * sstep(0.62, 0.72, y) * (1 - sstep(0.9, 0.98, y));
    v.mix(0x5a4644, ribs * 0.45);
    // magma cracks: branching lines over flanks, legs, neck and face
    const n1 = Math.sin(x * 31 + Math.sin(z * 17 + y * 9) * 2.4) * Math.sin(z * 27 - y * 21 + Math.sin(x * 13) * 1.5);
    const n2 = Math.sin(y * 43 + z * 19 + Math.sin(x * 21) * 1.8);
    const crack = Math.max(1 - sstep(0.0, 0.035, Math.abs(n1)), (1 - sstep(0.0, 0.025, Math.abs(n2))) * 0.6 * sstep(0.3, 0.6, Math.sin(x * 7 + z * 5)));
    const where = (1 - sstep(0.4, 0.9, ny)) * (1 - v.t('paw')) * (1 - v.t('nose')) * (g === 0 ? 1 : 0.6) * (0.35 + 0.65 * Math.max(v.t('chest'), v.t('leg'), v.t('haunch'), v.t('shoulder')));
    const glow = crack * where;
    if (glow > 0.02) { v.mix(c.crack, glow * 0.9); v.emis = Math.max(v.emis, glow * 1.25); }
    // glowing mouth interior
    if (v.t('mouth') > 0.25) { v.mix(c.mouth, 0.95); v.emis = Math.max(v.emis, 2.2 * v.t('mouth')); }
    if (g === 1 && ny > 0.4 && z < -0.75) { v.mix(c.mouth, 0.9); v.emis = 1.8; }
    // eye sockets
    for (const s of [-1, 1]) { const e = hx([s * 0.055, 1.085, -0.775]); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(0x050304, (1 - sstep(0.03, 0.05, d)) * 0.9); }
    v.mul(1 + Math.sin(x * 9 + z * 5) * Math.sin(y * 7) * 0.05);
    v.fx = v.t('crest') * sstep(0.9, 1.0, y);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    const fc = { core: c.core, mid: c.mid, tip: c.tip };
    // eyes: slanted, burning
    for (const s of [-1, 1]) addEye(acc, S, b('head'), hx([s * 0.055, 1.085, -0.775]), [s * 0.65, 0.12, -1], 0.022 * HS, { iris: c.eye, pupil: c.mid, rim: 0x120806, irisA: 0, pupilA: 1.0, glow: E ? 5 : 3.6, sink: 0.45, seg: 10, glint: false });
    // horns: from behind the brow, swept back & out
    const hk = E ? 1.3 : 1;
    for (const s of [-1, 1]) {
      addHorn(acc, b('head'), hx([s * 0.045, 1.13, -0.7]), hx([s * 0.1 * hk, 1.2 * (E ? 1.02 : 1), -0.6]), hx([s * 0.14 * hk, 1.19 + 0.04 * (hk - 1), -0.44]), 0.026 * hk, 0.003, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.8 });
      // small pointed ears
      const g = leafGeo(0.035, 0.08, 0.02, 0.6, 0.15, { nu: 4, nv: 4, pw: 1 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.55, s * 0.5, -s * 0.5, 'YXZ')); m.setPosition(...hx([s * 0.07, 1.11, -0.625]));
      acc.add(g, { matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: [0, 0.15, 0.1, 0], color: (p, n, uv) => uv[0] >= 1 ? col(c.dark) : col(c.skin) });
      // bony cheek spikes
      addHorn(acc, b('head'), hx([s * 0.085, 1.0, -0.64]), hx([s * 0.14, 0.99, -0.6]), hx([s * 0.17, 1.0, -0.53]), 0.018, 0.002, { base: c.dark, tip: c.hornTip, radial: 4, n: 3 });
    }
    // fangs
    const tc = col(0xf0e4c8), tb = col(0xa08870), tcol = (p, n, uv) => lerp3(tb, tc, uv[1]);
    for (const s of [-1, 1]) {
      acc.add(sweep(bez(hx([s * 0.028, 0.99, -0.895]), hx([s * 0.031, 0.965, -0.9]), hx([s * 0.029, 0.935, -0.89]), 3), taper(3, 0.012, 0.002), { radial: 4 }), { skin: rigid(b('head')), color: tcol, dtl: [0, 0, 0, 0] });
      acc.add(sweep(bez(hx([s * 0.024, 0.955, -0.865]), hx([s * 0.026, 0.975, -0.868]), hx([s * 0.024, 0.995, -0.86]), 3), taper(3, 0.01, 0.002), { radial: 4 }), { skin: rigid(b('jaw')), color: tcol, dtl: [0, 0, 0, 0] });
      for (let i = 0; i < 3; i++) { const z = -0.84 + i * 0.045; acc.add(sweep([hx([s * 0.042, 0.985, z]), hx([s * 0.043, 0.962, z])], [0.007, 0.001], { radial: 4 }), { skin: rigid(b('head')), color: tcol, dtl: [0, 0, 0, 0] }); }
    }
    // spine spikes from the neck crest to the rump
    const spk = [[1.08, -0.46, 'neck', 0.1], [1.06, -0.33, 'chest', 0.12], [1.02, -0.2, 'chest', 0.11], [0.97, -0.06, 'body', 0.09], [0.95, 0.08, 'body', 0.08], [0.97, 0.22, 'hips', 0.08], [0.98, 0.34, 'hips', 0.07]];
    for (const [y, z, bone, L0] of spk) { const L = L0 * (E ? 1.4 : 1); addHorn(acc, b(bone), [0, y - 0.03, z], [0, y + L * 0.6, z + L * 0.25], [0, y + L * 0.9, z + L * 0.75], 0.022, 0.002, { base: c.dark, tip: c.hornTip, radial: 5, n: 4, gpow: 2 }); }
    // claws
    for (const [paw, z0] of [['fP', -0.395], ['rP', 0.345]]) for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
      const x = s * 0.15 + i * 0.026;
      addHorn(acc, b(paw + (s < 0 ? 'L' : 'R')), [x, 0.035, z0 + 0.02], [x + i * 0.004, 0.03, z0 - 0.02], [x + i * 0.006, 0.0, z0 - 0.035], 0.011, 0.001, { base: c.dark, tip: c.claw, radial: 4, n: 3 });
    }
    // flame mane: crest of flame tongues from the brow down the neck to the shoulders, leaning back
    let fi = 0;
    const maneN = E ? 12 : 9;
    for (let i = 0; i < maneN; i++) {
      const t = i / (maneN - 1);
      const z = mix(-0.66, -0.2, t), y = mix(1.17, 1.02, t) + Math.sin(t * Math.PI) * 0.04;
      const side = (i % 2 ? 1 : -1) * (0.025 + 0.05 * hsh(fi));
      const bone = t < 0.25 ? 'head' : t < 0.7 ? 'neck' : 'chest';
      const L = (0.22 + 0.16 * Math.sin(t * Math.PI) + 0.06 * hsh(fi + 3)) * (E ? 1.3 : 1);
      flame(acc, [side, y - 0.03, z], [side * 3, 1.0, 0.55 + t * 0.3], L, 0.05 + 0.02 * Math.sin(t * Math.PI), rigid(b(bone)), fc, { bend: [side * 0.6, 0.1, 0.5], emis: 1.7, radial: 5, n: 5 });
      fi++;
    }
    // shoulder flames licking up from the blades
    for (const s of [-1, 1]) for (let i = 0; i < 1; i++) flame(acc, [s * (0.1 + i * 0.03), 1.0, -0.3 + i * 0.07], [s * 0.6, 1, 0.6], 0.17 * (E ? 1.3 : 1), 0.045, rigid(b('chest')), fc, { bend: [s * 0.3, 0, 0.5], emis: 1.5, n: 4 });
    // tail flame
    for (let i = 0; i < 2; i++) flame(acc, [(i - 0.5) * 0.03, 0.7, 0.99], [(i - 0.5) * 0.4, 0.6, 1], 0.2, 0.045, rigid(b('tail4')), fc, { bend: [0, 0.3, 0.4], emis: 1.7, n: 4 });
  },
  sockets: {
    mouth: ['jaw', hx([0, 0.97, -0.93])], head: ['head', hx([0, 1.2, -0.66])], center: ['chest', [0, 0.8, -0.1]], chest: ['chest', [0, 0.72, -0.35]],
    back: ['body', [0, 1.02, 0.0]], tail: ['tail4', [0, 0.72, 1.02]],
  },
  height: 1.3, radius: 0.5,
  controller(inst) { return new QuadCtl(inst, HOUND_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const legs = (fz, rz) => [
  { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.15, 0, fz], body: 'chest', scap: 0.35, lift: 0.14, flex: 1.5, out: 0.05, heel: 0.5 },
  { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.15, 0, fz], body: 'chest', scap: 0.35, lift: 0.14, flex: 1.5, out: 0.05, heel: 0.5 },
  { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.15, 0, rz], body: 'hips', scap: 0.3, lift: 0.13, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 },
  { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.15, 0, rz], body: 'hips', scap: 0.3, lift: 0.13, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 },
];
const ov = (L, x, y, z, w, local = true, paw = -0.4) => { L.override = L.override || new THREE.Vector3(); L.override.set(x, y, z); L.overrideLocal = local; L.overridePaw = paw; if (w > L.overrideW) L.overrideW = w; };

const ACTIONS = {
  attack: { dur: 0.7, a: 0.12, d: 0.75, hit: 0.45, fn(ctl, a, w) { // lunge bite
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.3, k) * (1 - sstep(0.3, 0.45, k));
    const lunge = sstep(0.28, 0.45, k) * (1 - sstep(0.6, 1, k));
    P.move(b.body, 0, (-0.03 * wind - 0.04 * lunge) * w, (0.07 * wind - 0.24 * lunge) * w);
    P.rx(b.body, (0.06 * wind - 0.08 * lunge) * w);
    P.rx(b.neck, (0.25 * wind - 0.22 * lunge) * w);
    P.rot(b.head, (0.2 * wind - 0.15 * lunge) * w, 0, 0.25 * lunge * Math.sin(k * 30) * w);
    const open = sstep(0.1, 0.4, k) * (1 - sstep(0.46, 0.52, k));
    ctl.jaw = Math.max(ctl.jaw, 0.75 * open * w);
    ctl.ear = mix(ctl.ear, 1, w); ctl.hackle = Math.max(ctl.hackle, w);
    ctl.glow = mix(ctl.glow, 1.5, lunge * w);
  } },
  attack2: { dur: 0.85, a: 0.1, d: 0.8, hit: 0.5, fn(ctl, a, w) { // rear & rake with the right fore paw
    const P = ctl.pose, b = ctl.b, k = a.k;
    const rise = sstep(0, 0.35, k) * (1 - sstep(0.55, 0.9, k)), sw = sstep(0.38, 0.55, k);
    P.move(b.body, 0, 0.1 * rise * w, 0.05 * rise * w); P.rot(b.body, 0.22 * rise * w, (0.15 * rise - 0.3 * sw * rise) * w, 0);
    P.rot(b.head, -0.1 * rise * w, -0.3 * sw * rise * w, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.55 * rise * w);
    const L = ctl.gait.legs[1];
    ov(L, 0.2 + 0.12 * rise - 0.35 * sw, 0.42 * rise + 0.1, -0.62 - 0.2 * sw, rise * w, true, -0.7);
  } },
  attack_big: { dur: 1.7, a: 0.05, d: 0.9, hit: 0.64, fn(ctl, a, w) { // crouch while the flames roar up (telegraph) → explosive pounce
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const crouch = sstep(0, 0.3, k) * (1 - sstep(0.52, 0.56, k));
    const trem = crouch * sstep(0.2, 0.5, k) * Math.sin(t * 55) * 0.012;
    const jump = sstep(0.52, 0.62, k) * (1 - sstep(0.68, 0.82, k));
    const h = Math.sin(clamp01((k - 0.53) / 0.22) * Math.PI);
    const fwd = sstep(0.52, 0.72, k) * (1 - sstep(0.8, 1, k));
    P.move(b.body, trem, (-0.16 * crouch + 0.3 * h) * w, (0.08 * crouch - 0.55 * fwd) * w);
    P.rx(b.body, (-0.1 * crouch + 0.3 * h - 0.1 * sstep(0.7, 0.78, k) * (1 - sstep(0.8, 1, k))) * w);
    P.rx(b.neck, (-0.35 * crouch - 0.1 * h) * w); P.rx(b.head, (0.25 * crouch + 0.1 * h) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.25 * crouch + 0.85 * jump) * w);
    ctl.hackle = Math.max(ctl.hackle, w);
    ctl.glow = mix(ctl.glow, 1 + 2.2 * sstep(0.05, 0.5, k) * (1 - sstep(0.6, 0.8, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.5, k) * (1 - sstep(0.55, 0.65, k)) * w);
    for (const L of ctl.gait.legs) {
      const front = L.id[0] === 'F';
      if (front) ov(L, L.toe.x, 0.22 * h, L.toe.z - 0.2 * h, h * w, true, -0.5);
      else ov(L, L.toe.x, 0.08 * h, L.toe.z + 0.12 * h, h * 0.8 * w, true, -0.3);
    }
  } },
  spit: { dur: 1.1, a: 0.1, d: 0.85, hit: 0.4, fn(ctl, a, w) { // fire breath: head low & forward, jaws wide, braced
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const draw = sstep(0, 0.3, k) * (1 - sstep(0.3, 0.4, k)), breathe = sstep(0.32, 0.42, k) * (1 - sstep(0.85, 1, k));
    P.move(b.body, 0, -0.04 * breathe * w, (0.05 * draw - 0.05 * breathe) * w);
    P.rx(b.body, (0.05 * draw - 0.06 * breathe) * w);
    P.rx(b.neck, (0.3 * draw - 0.25 * breathe) * w); P.rot(b.head, (0.25 * draw + 0.05 * breathe) * w, Math.sin(t * 6) * 0.15 * breathe * w, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * draw + 0.9 * breathe) * w);
    ctl.glow = mix(ctl.glow, 1 + 1.8 * breathe, w); ctl.hackle = Math.max(ctl.hackle, w);
    legsPlant(ctl, breathe * w * 0.7, 1.2, 0);
  } },
  roar: qRoar({ dur: 1.6 }),
  idle_alt: { dur: 2.4, a: 0.15, d: 0.8, fn(ctl, a, w) { // sniff the ground, snort sparks
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rx(b.neck, -0.5 * w); P.rot(b.head, (-0.2 + Math.sin(t * 18) * 0.025) * w, Math.sin(t * 1.3) * 0.3 * w, 0);
    const sn = Math.pow(Math.max(0, Math.sin(t * 2.6)), 12);
    P.rx(b.head, 0.15 * sn * w); ctl.glow = mix(ctl.glow, 1.8, sn * w);
  } },
  shake: { dur: 1.8, a: 0.15, d: 0.85, fn(ctl, a, w) { // shake off embers
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const s = bell(clamp01((k - 0.1) / 0.8)) * w, f = Math.sin(t * 28);
    P.rot(b.chest, 0, 0, f * 0.12 * s); P.rot(b.neck, 0, f * 0.25 * s, f * 0.2 * s); P.rot(b.head, 0, f * 0.3 * s, f * 0.3 * s);
    P.rot(b.hips, 0, 0, -Math.sin(t * 28 - 1) * 0.1 * s);
    ctl.glow = mix(ctl.glow, 1.6, s);
  } },
  hit: qHit(),
  knockback: qKnockback(),
  knockdown: qKnockdown({ lieY: 0.22 }),
  getup: qGetup({ lieY: 0.22 }),
  death: qDeath({ lieY: 0.2, dist: 1.2, peak: 0.4 }),
  stun: qStun(),
  spawn: qSpawn({ depth: 1.2 }),
};

const HOUND_SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3', 'tail4'], ears: ['earL', 'earR'] },
  gait: {
    legs: legs(-0.4, 0.38),
    maxStride: 0.85,
    gaits: [
      { v: 1.3, f: 1.6, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.025, rollF: 1, sway: 0.01, swayF: 1, nod: 0.035, nodF: 2, nodPh: 0.3 },
      { v: 3.4, f: 2.4, duty: 0.44, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.025, bobF: 2, bobPh: 0.35, roll: 0.02, rollF: 1, nod: 0.03, nodF: 2, nodPh: 0.5, pitch: 0.012, pitchF: 2 },
      { v: 8, f: 3.0, duty: 0.27, lift: 1.3, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.065, bobF: 1, bobPh: 0.62, pitch: 0.12, pitchF: 1, pitchPh: 0.05, flex: 0.18, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  },
  neck: { pitch: -0.05, run: -0.35, combat: -0.4, walk: -0.08, headCombat: 0.25, comp: 0.55 },
  tail: { wag: 0.18, wagF: 0.7, run: 0.35, combat: -0.2, base: 0.1 },
  combatCrouch: 0.08, combatPitch: -0.07, runDrop: 0.05, breathe: 0.015,
  fidgets: [{ name: 'idle_alt', w: 3 }, { name: 'shake', w: 1 }],
  pose(ctl) {
    // pant (embers breathed out) when running / fighting; menacing low-head carriage in combat
    ctl.jaw += (0.12 + 0.06 * Math.sin(ctl.t * 14)) * ctl.run + ctl.combat * (0.15 + 0.05 * Math.sin(ctl.t * 9));
    ctl.glow *= 1 + 0.15 * Math.sin(ctl.t * 3.1) + 0.3 * ctl.combat;
    for (const L of ctl.gait.legs) L.homeOff.set(L.side * 0.035 * ctl.combat, 0, (L.id[0] === 'F' ? -0.05 : 0.02) * ctl.combat);
    ctl.flame = ctl.dead ? Math.max(0, 1 - (ctl.acts.get('death')?.t ?? 0) * 0.6) : 1;
  },
  actions: ACTIONS,
};
