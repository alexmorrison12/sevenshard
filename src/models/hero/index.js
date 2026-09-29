// SEVENSHARD heroes: sculpted (SDF) skinned bodies with heroic proportions, painted faces, sculpted hair, class
// outfits in three gear tiers, oversized class weapons and a layered procedural animator with the full action set.
//
//   import { createHero } from './models/hero/index.js';
//   const h = createHero({ cls: 'reaver', sex: 'm', gear: { tier: 1 }, weapon: { tier: 1, hone: 12 } });
//   scene.add(h.root); h.update(dt, { speed, turn, combat }); h.play('slash_h', { dur: 0.8 });
//
// See README.md for the full API (actions, sockets, options). Contract: ARCHITECTURE.md › Heroes.
import * as THREE from 'three';
import { getBase, getHead, buildBucket } from './body.js';
import { BONES, B, NB, PARENTS } from './rig.js';
import { assemble } from './assemble.js';
import { makeUniforms, makeHeroMaterial } from './material.js';
import { faceTexture, marksTexture } from './face.js';
import { Animator } from './anim.js';
import { resolveGear, buildPalette, paintBody } from './gear.js';
import { outfitPieces } from './outfit.js';
import { HAIR_STYLES } from './hair.js';
import { lockHairPiece } from './hair2.js';
import { armGeometry, CLASS_ACCENT } from './arms.js';
import { MOVE_NAMES } from './moves.js';
import { FACE_PRESETS } from './head.js';
import { demonHorns, demonWing, makeAura } from './demon.js';

export { HAIR_STYLES, FACE_PRESETS };

// ------------------------------------------------------------------------------------------------
export const SKIN_TONES = [0xf6dccb, 0xedc7ae, 0xdfb094, 0xc99676, 0xab7859, 0x8a5b40, 0x68432e, 0x4a3021];
export const HAIR_COLORS = [0x1c1612, 0x3a2616, 0x6a4424, 0xa87038, 0xe0c080, 0xe8e4dc, 0x9a2a1c, 0x2a3a6a, 0x5a2a6a, 0xc8d4e0];
export const EYE_COLORS = [0x3a6ab0, 0x4a8a5a, 0x6a4a2a, 0x8a8a9a, 0xc08a2a, 0x8a3ac0, 0xd03030, 0x30c0c0];
export const MARK_COLORS = [0x9a1c1c, 0x1c3a9a, 0xe8e0d0, 0x1a1a1a, 0xd8a030, 0x6a1a8a];

export const CLASSES = {
  reaver: { name: 'Reaver', role: 'dps', weapon: 'Greatsword', kind: 'greatsword', accent: CLASS_ACCENT.reaver },
  oathkeeper: { name: 'Oathkeeper', role: 'support', weapon: 'Longsword & Tome', kind: 'sword', accent: CLASS_ACCENT.oathkeeper },
  stormfist: { name: 'Stormfist', role: 'dps', weapon: 'Gauntlets', kind: 'fists', accent: CLASS_ACCENT.stormfist },
  pistoleer: { name: 'Pistoleer', role: 'dps', weapon: 'Pistols / Shotgun / Rifle', kind: 'pistol', accent: CLASS_ACCENT.pistoleer },
  starcaller: { name: 'Starcaller', role: 'dps', weapon: 'Star Staff', kind: 'staff', accent: CLASS_ACCENT.starcaller },
  songweaver: { name: 'Songweaver', role: 'support', weapon: 'Harp', kind: 'harp', accent: CLASS_ACCENT.songweaver },
  bladedancer: { name: 'Bladedancer', role: 'dps', weapon: 'Twin Blades & Greatblade', kind: 'blades', accent: CLASS_ACCENT.bladedancer },
  demonbound: { name: 'Demonbound', role: 'dps', weapon: 'Demonic Glaive', kind: 'glaive', accent: CLASS_ACCENT.demonbound },
};
export const NPCS = ['guard', 'knight', 'noble', 'king', 'oracle', 'merchant', 'blacksmith', 'sailor', 'pirate', 'bandit', 'cultist', 'priest', 'bard', 'farmer', 'fisher', 'villager', 'child'];

// class weapon sets: which arm goes in which hand, and where it rides when sheathed
const WEAPON_SETS = {
  reaver: [{ arm: 'greatsword', hand: 'R', sheath: 'backGreat' }],
  oathkeeper: [{ arm: 'longsword', hand: 'R', sheath: 'hipL' }, { arm: 'tome', hand: null, sheath: 'hipTome' }],
  stormfist: [], // the gauntlets are part of the outfit (skinned to the hands)
  pistoleer: [{ arm: 'pistol', hand: 'R', sheath: 'holsterR', stance: 'pistol' }, { arm: 'pistol', hand: 'L', sheath: 'holsterL', stance: 'pistol' },
    { arm: 'shotgun', hand: 'R', sheath: 'backGun', stance: 'shotgun' }, { arm: 'rifle', hand: 'R', sheath: 'backRifle', stance: 'rifle' }],
  starcaller: [{ arm: 'starstaff', hand: 'R', sheath: 'backStaff', orb: 'staforb' }],
  songweaver: [{ arm: 'harp', hand: 'L', sheath: 'backHarp' }],
  bladedancer: [{ arm: 'shortblade', hand: 'R', sheath: 'waistR' }, { arm: 'shortblade', hand: 'L', sheath: 'waistL' }, { arm: 'greatblade', hand: null, sheath: 'backDiag' }],
  demonbound: [{ arm: 'glaive', hand: 'R', sheath: 'backGlaive' }],
};

// default looks per class + sex (the creation screen starts here)
const DEFAULT_LOOK = {
  reaver: { m: { face: 1, hair: 0, hairColor: 0x2a1c14, skin: 2, eyes: 0x8a3a2a }, f: { face: 4, hair: 1, hairColor: 0x9a2a1c, skin: 1, eyes: 0x7a2a1a } },
  oathkeeper: { m: { face: 3, hair: 1, hairColor: 0xd8b068, skin: 1, eyes: 0x3a6ab0 }, f: { face: 3, hair: 0, hairColor: 0xe8d098, skin: 0, eyes: 0x3a7ac0 } },
  stormfist: { m: { face: 5, hair: 4, hairColor: 0x1c1612, skin: 3, eyes: 0x4a3a2a }, f: { face: 2, hair: 6, hairColor: 0x1c1612, skin: 2, eyes: 0x5a3a2a } },
  pistoleer: { m: { face: 0, hair: 3, hairColor: 0x5a3a20, skin: 2, eyes: 0x4a7a5a }, f: { face: 1, hair: 0, hairColor: 0x6a3a1c, skin: 1, eyes: 0x4a8a5a } },
  starcaller: { m: { face: 3, hair: 2, hairColor: 0xd8dce8, skin: 0, eyes: 0x6a5ad8 }, f: { face: 2, hair: 0, hairColor: 0xc8c8e8, skin: 0, eyes: 0x8a6ae0 } },
  songweaver: { m: { face: 2, hair: 2, hairColor: 0xe0c080, skin: 1, eyes: 0x3a8a6a }, f: { face: 5, hair: 3, hairColor: 0xe0909a, skin: 0, eyes: 0x3a8a7a } },
  bladedancer: { m: { face: 5, hair: 1, hairColor: 0xd8dce4, skin: 1, eyes: 0x30c0c0 }, f: { face: 2, hair: 1, hairColor: 0xe8e8ee, skin: 1, eyes: 0x30c0c0 } },
  demonbound: { m: { face: 5, hair: 0, hairColor: 0x1a1620, skin: 3, eyes: 0xa040e0, marks: 2, markColor: 0x6a1a8a }, f: { face: 4, hair: 0, hairColor: 0x2a1830, skin: 2, eyes: 0xc040e0, marks: 3, markColor: 0x6a1a8a } },
};
function defaultLook(cls, sex) {
  const d = DEFAULT_LOOK[cls]?.[sex] || { face: 0, hair: 0, hairColor: 0x3a2616, skin: 2, eyes: 0x3a6ab0 };
  return { face: 0, hair: 0, hairColor: 0x3a2616, skin: 2, eyes: 0x3a6ab0, height: 1, build: 0.5, marks: 0, markColor: 0x9a1c1c, ...d };
}

// hair styles that would poke through a hat crown fall back to a flatter cut
const HAT_SAFE = { topknot: 'short', mohawk: 'short', swept: 'short', fem_bun: 'fem_long', fem_buns: 'fem_braids', fem_pigtails: 'fem_braids', bald: 'bald' };

// ------------------------------------------------------------------------------------------------
const INV_CACHE = new Map();
function makeSkeleton(base) {
  const bones = BONES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  const J = base.joints;
  for (let i = 0; i < NB; i++) {
    const p = PARENTS[i];
    if (p < 0) bones[i].position.set(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
    else { bones[i].position.set(J[i * 3] - J[p * 3], J[i * 3 + 1] - J[p * 3 + 1], J[i * 3 + 2] - J[p * 3 + 2]); bones[p].add(bones[i]); }
  }
  let inv = INV_CACHE.get(base.key);
  if (!inv) {
    bones[0].updateMatrixWorld(true);
    inv = bones.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert());
    INV_CACHE.set(base.key, inv);
  }
  return { bones, skeleton: new THREE.Skeleton(bones, inv) };
}

// weapon grip sockets, authored in the neutral frame of the hand bone
const _m4 = new THREE.Matrix4();
function handSocket(anim, bone, side, hs, kind = 'grip') {
  const sg = side === 'R' ? 1 : -1;
  const o = new THREE.Object3D(); o.name = 'socket_' + kind + side;
  const Ninv = anim.N[B['hand' + side]].clone().invert();
  let pos, q;
  if (kind === 'palm') { // flat on the palm (harp frame, tome)
    pos = new THREE.Vector3(-sg * 0.03 * hs, -0.08 * hs, 0);
    q = new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)));
  } else { // fist grip: weapon +Y along the thumb (neutral −Z), blade width along the fingers
    pos = new THREE.Vector3(-sg * 0.032 * hs, -0.072 * hs, 0.004);
    q = new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)));
  }
  o.position.copy(pos.applyQuaternion(Ninv));
  o.quaternion.copy(Ninv).multiply(q);
  bone.add(o);
  return o;
}

function mountSocket(base, bones, kind) {
  const P = base.P;
  const o = new THREE.Object3D(); o.name = 'mount_' + kind;
  const zBack = P.ribs[2] + 0.085 + P.back[2] * 0.3;
  const basis = (dir, z = new THREE.Vector3(0, 0, 1)) => { const Y = dir.normalize(), X = new THREE.Vector3().crossVectors(Y, z).normalize(), Z = new THREE.Vector3().crossVectors(X, Y); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); };
  if (kind === 'backGreat') { bones[B.chest].add(o); o.position.set(0.14, P.shY + 0.1, zBack + 0.03); o.quaternion.copy(basis(new THREE.Vector3(-0.42, -0.9, 0.02))); }
  else if (kind === 'backDiag') { bones[B.chest].add(o); o.position.set(0.1, P.shY + 0.06, zBack); o.quaternion.copy(basis(new THREE.Vector3(-0.38, -0.92, 0))); }
  else if (kind === 'backStaff') { bones[B.chest].add(o); o.position.set(-0.05, P.shY - 0.28, zBack); o.quaternion.copy(basis(new THREE.Vector3(0.34, 0.94, 0))); }
  else if (kind === 'backCenter') { bones[B.chest].add(o); o.position.set(0, P.shY - 0.14, zBack + 0.03); }
  else if (kind === 'backCross') { bones[B.chest].add(o); o.position.set(-0.1, P.shY + 0.02, zBack + 0.02); o.quaternion.copy(basis(new THREE.Vector3(0.45, -0.89, 0))); }
  else if (kind === 'backGlaive') { bones[B.chest].add(o); o.position.set(0.0, P.shY - 0.2, zBack + 0.03); o.quaternion.copy(basis(new THREE.Vector3(0.62, 0.78, 0.0))); }
  else if (kind === 'backHarp') { bones[B.chest].add(o); o.position.set(0.02, P.shY - 0.44, zBack + 0.05); o.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0.25))); }
  else if (kind === 'backGun' || kind === 'backRifle') { // long guns slung diagonally (barrel = weapon +X)
    bones[B.chest].add(o); const r = kind === 'backGun';
    o.position.set(r ? 0.05 : -0.04, P.shY - (r ? 0.3 : 0.12), zBack + (r ? 0.06 : 0.03));
    o.quaternion.setFromEuler(new THREE.Euler(0, 0, r ? 2.1 : 1.1)); }
  else if (kind === 'waistR' || kind === 'waistL') { // short blades crossed at the small of the back, hilts outward
    bones[B.hips].add(o); const sg = kind === 'waistR' ? 1 : -1;
    o.position.set(sg * 0.1, 0.1, P.pelvis[2] + 0.07);
    o.quaternion.copy(basis(new THREE.Vector3(-sg * 0.95, -0.3, 0.0), new THREE.Vector3(0, 0, 1))); }
  else if (kind === 'holsterR' || kind === 'holsterL') { // pistols holstered on the thighs, barrel down
    bones[B.hips].add(o); const sg = kind === 'holsterR' ? 1 : -1;
    o.position.set(sg * (P.pelvis[0] + 0.04), -0.1, 0.0);
    o.quaternion.setFromEuler(new THREE.Euler(0, sg > 0 ? 0 : Math.PI, -Math.PI / 2 + 0.15)); }
  else if (kind === 'hipTome') { bones[B.hips].add(o); o.position.set(-(P.pelvis[0] + 0.035), -0.08, 0.035); o.quaternion.setFromEuler(new THREE.Euler(0.1, Math.PI / 2 + 0.25, 0.05)); }
  else { // hips
    bones[B.hips].add(o);
    const sg = kind === 'hipL' ? -1 : 1;
    o.position.set(sg * (P.pelvis[0] + 0.035), -0.03, 0.03);
    o.quaternion.copy(basis(new THREE.Vector3(sg * 0.1, -0.9, 0.42), new THREE.Vector3(sg, 0, 0)));
  }
  return o;
}

// ------------------------------------------------------------------------------------------------
function normOpts(o = {}) {
  const cls = o.npc ? null : (CLASSES[o.cls] ? o.cls : (o.cls === null ? null : 'reaver'));
  const sex = o.sex === 'f' ? 'f' : 'm';
  const look = { ...defaultLook(cls || 'npc', sex), ...(o.look || {}) };
  const gear = { tier: 1, dye: null, ...(o.gear || {}) };
  const weapon = { tier: gear.tier ?? 1, hone: 0, ...(o.weapon || {}) };
  return { cls, sex, look, gear, weapon, npc: o.npc || null, lod: o.lod === 'crowd' ? 'crowd' : 'full', seed: o.seed ?? 1 };
}

/**
 * createHero(opts) → hero. opts: { cls, sex, look, gear, weapon, npc, lod, seed } (see README.md)
 */
export function createHero(opts = {}) {
  const t0 = performance.now();
  const o = normOpts(opts);
  const U = makeUniforms();
  const UW = { ...U, uRune: { value: new THREE.Vector4(1, 0.15, 0.05, 0) }, uCast: U.uCast }; // weapons: own rune glow (hone)
  const matSkinned = makeHeroMaterial(U);
  const matRigid = makeHeroMaterial(UW, { key: 'r' });
  const UD = { ...U, uDemon: { value: 0 }, uRune: { value: new THREE.Vector4(0.85, 0.3, 1.0, 1.4) } }; // demon parts: own glow, no darkening
  let matDemon = null, D = null;
  const root = new THREE.Group(); root.name = 'hero';
  const inner = new THREE.Group(); root.add(inner);
  const h = { root, inner, U, UW, opts: o, sockets: {}, stats: {}, height: 1.85, radius: 0.45 };
  let mesh = null, bones = null, skeleton = null, anim = null, base = null, head = null;
  const weapons = []; // { mesh, spec, info }
  let stance = 'pistol', demon = 0, demonTarget = 0;
  const S = h.sockets;
  // stable sockets that survive rebuilds
  S.feet = new THREE.Object3D(); S.feet.name = 'socket_feet'; root.add(S.feet);
  S.overhead = new THREE.Object3D(); S.overhead.name = 'socket_overhead'; root.add(S.overhead);
  S.weapon = new THREE.Object3D(); S.weapon.name = 'socket_weapon';
  S.weaponTip = new THREE.Object3D(); S.weaponTip.name = 'socket_weaponTip';

  function build() {
    const tb = performance.now();
    const L = o.look;
    const newBase = getBase(o.sex, L.build, o.lod);
    const rebuildSkeleton = !base || newBase.key !== base.key;
    base = newBase;
    head = getHead(base, (L.face | 0) % 6);
    if (rebuildSkeleton) {
      const prevState = anim ? { action: anim.action, drawn: anim.drawn, t: anim.t } : null;
      if (mesh) { inner.remove(mesh); mesh.geometry.dispose(); skeleton.dispose(); }
      mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), matSkinned);
      ({ bones, skeleton } = makeSkeleton(base));
      mesh.add(bones[0]);
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      inner.add(mesh);
      h.mesh = mesh; h.bones = bones; h.base = base;
      anim = new Animator(h);
      h.anim = anim;
      if (prevState) { anim.drawn = prevState.drawn; anim.t = prevState.t; }
      const hs = base.P.hand, hd = base.P.headDef;
      S.handR = handSocket(anim, bones[B.handR], 'R', hs, 'grip');
      S.handL = handSocket(anim, bones[B.handL], 'L', hs, 'grip');
      S.palmL = handSocket(anim, bones[B.handL], 'L', hs, 'palm');
      anim.gripR = S.handR; anim.gripL = S.handL;
      const mk = (name, bone, x, y, z) => { const s = new THREE.Object3D(); s.name = name; s.position.set(x, y, z); bones[bone].add(s); return s; };
      S.head = mk('socket_head', B.head, 0, hd.eye.y * hd.s, 0);
      S.chest = mk('socket_chest', B.chest, 0, base.P.shY - 0.06, -base.P.ribs[2] - 0.04);
      S.back = mk('socket_back', B.chest, 0, base.P.shY - 0.05, base.P.ribs[2] + 0.1);
      h.mounts = {};
      anim.onSheath = (drawn) => attachWeapons(drawn);
      anim.onProp = (name, hand) => setProp(name, hand);
    }
    // face textures
    U.uFace.value = faceTexture(head, o.sex, L.face | 0);
    const mt = marksTexture(head, L.marks | 0);
    if (mt) U.uMarks.value = mt;
    U.uMarkCol.value.set(...new THREE.Color(L.markColor ?? 0x9a1c1c).toArray(), mt ? 1 : 0);
    U.uEye.value.set(L.eyes ?? 0x3a6ab0);
    U.uBrow.value.set(L.hairColor).multiplyScalar(0.8);
    const skinHex = typeof L.skin === 'number' && L.skin < 16 ? SKIN_TONES[(L.skin | 0) % SKIN_TONES.length] : (L.skin ?? SKIN_TONES[2]);
    { const sk = new THREE.Color(skinHex); U.uInk.value.setRGB(sk.r * 0.07 + 0.006, sk.g * 0.045 + 0.004, sk.b * 0.04 + 0.004);
      U.uLip.value.setRGB(sk.r * (o.sex === 'f' ? 0.95 : 0.9) + 0.05, sk.g * (o.sex === 'f' ? 0.42 : 0.6), sk.b * (o.sex === 'f' ? 0.46 : 0.58)); }
    // outfit
    const g = resolveGear({ cls: o.cls, npc: o.npc, tier: o.gear.tier, sex: o.sex, dye: o.gear.dye, spec: o.gear.spec });
    h.gear = g;
    const pieces = { body: base.pieces.body, handL: base.pieces.handL, handR: base.pieces.handR, head: head.piece };
    const paint = paintBody(base, g, pieces);
    const parts = [
      { p: pieces.body, ...paint.body },
      { p: pieces.head, ...paint.head },
      { p: head.eyes },
      { p: pieces.handL, ...paint.handL, cast: 0.6 },
      { p: pieces.handR, ...paint.handR, cast: 0.6 },
    ];
    const op = outfitPieces(base, g);
    const styles = HAIR_STYLES[o.sex];
    let style = styles[(L.hair | 0) % styles.length];
    if (op.hat) style = HAT_SAFE[style] ?? style;
    if (!op.hideHair && style) { const hp = lockHairPiece(base, style, o.sex); if (hp) parts.push({ p: hp }); }
    for (const it of op.list) parts.push(it);
    const pal = buildPalette(g, { skin: skinHex, hairColor: L.hairColor, eyes: L.eyes ?? 0x3a6ab0 });
    const old = mesh.geometry;
    mesh.geometry = assemble(parts, pal);
    old.dispose();
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, base.height * 0.5, 0), base.height * 0.9);
    // rune glow (legion set)
    if (g.runes) U.uRune.value.set(1.0, 0.1, 0.04, 1.6);
    else if (g.accent) { const ac = new THREE.Color(g.accent); U.uRune.value.set(ac.r, ac.g, ac.b, 0.9); }
    else U.uRune.value.set(1, 0.1, 0.04, 0);
    // scale / sizes
    const hk = Math.max(0.9, Math.min(1.1, L.height ?? 1));
    inner.scale.setScalar(hk * (1 + demon * 0.18));
    h.height = base.height * hk; h.radius = base.P.radius * hk;
    S.overhead.position.set(0, h.height + 0.32, 0);
    buildWeapons();
    // stats
    h.stats.verts = mesh.geometry.attributes.position.count;
    h.stats.tris = mesh.geometry.index.count / 3 + weapons.reduce((a, w) => a + w.tris, 0);
    h.stats.drawCalls = 1 + weapons.length;
    h.stats.ms = performance.now() - tb;
  }

  function weaponSet() {
    if (o.npc) return [];
    return WEAPON_SETS[o.cls] || WEAPON_SETS.reaver;
  }
  function buildWeapons() {
    for (const w of weapons) w.mesh.parent?.remove(w.mesh);
    weapons.length = 0;
    const tier = Math.max(0, Math.min(2, o.weapon.tier ?? o.gear.tier ?? 1));
    for (const spec of weaponSet()) {
      const a = armGeometry(spec.arm, { tier, cls: o.cls, lod: o.lod });
      if (!a) continue;
      const m = new THREE.Mesh(a.geo, matRigid); m.castShadow = true; m.name = 'weapon_' + spec.arm;
      const w = { mesh: m, spec, info: a.info, tris: a.tris };
      if (spec.orb) { const ob = armGeometry(spec.orb, { tier, cls: o.cls, lod: o.lod }); w.orb = new THREE.Mesh(ob.geo, matRigid); w.orb.position.fromArray(a.info.orb); m.add(w.orb); w.tris += ob.tris; }
      weapons.push(w);
    }
    setHone(o.weapon.hone ?? 0, tier);
    anim.kind = kindNow();
    const main = weapons.find(w => w.spec.hand === 'R') || weapons[0];
    anim.grip2 = main?.info.grip2 ?? -0.15;
    attachWeapons(anim.drawn);
  }
  let propMesh = null;
  function setProp(name, hand = 'R') {
    if (propMesh) { propMesh.parent?.remove(propMesh); propMesh = null; }
    if (!name) return;
    const a = armGeometry(name, { tier: 1, cls: 'npc', lod: o.lod });
    if (!a) return;
    if (anim.drawn) anim.forceDraw(false);
    propMesh = new THREE.Mesh(a.geo, matRigid); propMesh.castShadow = true; propMesh.name = 'prop_' + name;
    (hand === 'L' ? S.handL : S.handR).add(propMesh);
    anim.grip2 = a.info.grip2 ?? anim.grip2;
  }
  function kindNow() {
    if (o.npc) return 'none';
    if (demon > 0.5 && o.cls === 'demonbound') return 'claws';
    if (o.cls === 'pistoleer') return stance;
    return CLASSES[o.cls]?.kind || 'none';
  }
  function setHone(hone, tier) {
    // rune glow on the weapon: tier 2 always smoulders; +15 and up glows ever stronger (emissive > 1 blooms)
    const k = hone >= 15 ? 1.1 + (hone - 15) * 0.34 : tier === 2 ? 0.75 : tier === 1 ? 0.22 + Math.max(0, hone - 9) * 0.08 : Math.max(0, hone - 9) * 0.06;
    const col = new THREE.Color(tier === 2 ? 0xff2a12 : (CLASSES[o.cls]?.accent ?? 0x9ab8ff));
    UW.uRune.value.set(col.r, col.g, col.b, k);
  }
  function attachWeapons(drawn) {
    const put = (m, parent) => { parent.add(m); m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.setScalar(1); };
    for (const w of weapons) {
      const sp = w.spec;
      const inHand = drawn && sp.hand && (!sp.stance || sp.stance === stance);
      if (inHand) put(w.mesh, sp.hand === 'R' ? S.handR : sp.palm ? S.palmL : S.handL);
      else put(w.mesh, h.mounts[sp.sheath] || (h.mounts[sp.sheath] = mountSocket(base, bones, sp.sheath)));
    }
    // weapon / tip sockets follow the active main weapon
    const main = weapons.find(w => w.spec.hand === 'R' && (!w.spec.stance || w.spec.stance === stance)) || weapons.find(w => w.spec.hand) || weapons[0];
    if (main) {
      main.mesh.add(S.weapon); S.weapon.position.set(0, 0, 0);
      main.mesh.add(S.weaponTip); S.weaponTip.position.fromArray(main.info.muzzle || main.info.tip || [0, main.info.len || 1, 0]);
      anim.grip2 = typeof main.info.grip2 === 'number' ? main.info.grip2 : -0.15;
      anim.grip2v = Array.isArray(main.info.grip2) ? main.info.grip2 : null;
      anim.grip2rot = main.info.grip2rot || null;
    } else { S.handR.add(S.weapon); S.handR.add(S.weaponTip); S.weaponTip.position.set(0, 0.1, 0); }
    // demon form: the glaive is put away and the talons carry the weapon sockets
    const claws = kindNow() === 'claws' && D;
    for (const w of weapons) w.mesh.visible = !claws;
    if (claws) { S.weapon.position.set(0, 0, 0); D.clawR.add(S.weapon); D.clawR.add(S.weaponTip); S.weaponTip.position.fromArray(D.info.tip); }
  }

  build();

  // ----------------------------------------------------------------------------------------------
  h.update = (dt, state = {}) => {
    if (demon !== demonTarget) {
      demon = demonTarget > demon ? Math.min(demonTarget, demon + dt * 2.2) : Math.max(demonTarget, demon - dt * 2.2);
      U.uDemon.value = UW.uDemon.value = demon;
      const hk = Math.max(0.9, Math.min(1.1, o.look.height ?? 1));
      inner.scale.setScalar(hk * (1 + sstep(demon) * 0.18));
    }
    const k = kindNow(); if (k !== anim.kind) { anim.kind = k; syncDemonArms(); }
    const P = anim.update(dt, state);
    if (demon > 0.001 || D) updateDemon(dt, state);
    U.uFaceTile.value.set((P.face & 1) * 0.5, (P.face >> 1) * 0.5);
    for (const w of weapons) if (w.orb && dt > 0) { w.orb.rotation.y += dt * 1.6; w.orb.rotation.x += dt * 0.7; w.orb.position.y = w.info.orb[1] + 0.03 + Math.sin(anim.t * 2.2) * 0.025; }
  };
  h.play = (action, opt = {}) => anim.play(action, opt);
  h.stop = () => anim.stop();
  h.setTint = (hex, amount = 0.5) => { const c = new THREE.Color(hex); U.uTint.value.set(c.r, c.g, c.b, amount); };
  h.setGlow = (hex, intensity = 1) => { const c = new THREE.Color(hex); U.uCast.value.set(c.r, c.g, c.b, intensity); };
  h.setStance = (s) => {
    if (!['pistol', 'shotgun', 'rifle'].includes(s)) return;
    stance = s; if (o.cls === 'pistoleer') { anim.kind = kindNow(); if (!anim.drawn) anim.forceDraw(true); else attachWeapons(true); }
  };
  h.setDemonForm = (on) => { demonTarget = on ? 1 : 0; };

  // demon form: horns + wings + talons + aura, grown in with the transition (built lazily, once per body kind)
  function ensureDemon() {
    if (D && D.base === base) return D;
    if (D) dropDemon();
    if (!matDemon) matDemon = makeHeroMaterial(UD, { key: 'r' });
    const P = base.P;
    const horns = new THREE.Mesh(demonHorns(base), matDemon); horns.castShadow = true; horns.name = 'demon_horns';
    bones[B.head].add(horns);
    const wing = (sg) => {
      const piv = new THREE.Group(); piv.name = 'demon_wing' + (sg > 0 ? 'R' : 'L');
      piv.position.set(sg * 0.07, P.shY - 0.1, P.ribs[2] + 0.05);
      const m = new THREE.Mesh(demonWing(base, sg), matDemon); m.castShadow = true; piv.add(m);
      bones[B.chest].add(piv); return piv;
    };
    const cg = armGeometry('claw', { tier: 2, cls: 'demonbound', lod: o.lod });
    const clawR = new THREE.Mesh(cg.geo, matDemon), clawL = new THREE.Mesh(cg.geo, matDemon);
    clawR.name = 'demon_clawR'; clawL.name = 'demon_clawL'; clawR.castShadow = clawL.castShadow = true;
    S.handR.add(clawR); S.handL.add(clawL); clawR.visible = clawL.visible = false;
    const aura = makeAura();
    root.add(aura.pts);
    D = { base, horns, wingR: wing(1), wingL: wing(-1), clawR, clawL, aura, t: 0, flap: 0, info: cg.info };
    if (kindNow() === 'claws') { clawR.visible = clawL.visible = true; attachWeapons(anim.drawn); }
    return D;
  }
  function dropDemon() {
    if (!D) return;
    for (const m of [D.horns, D.wingR, D.wingL, D.clawR, D.clawL, D.aura.pts]) m.parent?.remove(m);
    D.aura.dispose(); D = null;
  }
  function syncDemonArms() {
    const on = kindNow() === 'claws';
    if (on) { ensureDemon(); D.clawR.visible = D.clawL.visible = true; }
    else if (D) D.clawR.visible = D.clawL.visible = false;
    attachWeapons(anim.drawn);
  }
  function updateDemon(dt, state) {
    const s = sstep(demon);
    if (s <= 0.001) { if (D) { D.horns.visible = D.wingR.visible = D.wingL.visible = D.aura.pts.visible = false; } return; }
    ensureDemon();
    D.t += dt;
    D.horns.visible = D.wingR.visible = D.wingL.visible = D.aura.pts.visible = true;
    D.horns.scale.setScalar(Math.max(0.001, s));
    const moving = (state.speed || 0) > 0.6, down = state.dead || state.down;
    D.flap += dt * (moving ? 7.5 : 2.3);
    const amp = down ? 0.02 : moving ? 0.34 : 0.1;
    const f = Math.sin(D.flap), fold = (1 - s) * 1.3 + (down ? 0.9 : 0);
    for (const [wg, sg] of [[D.wingR, 1], [D.wingL, -1]]) {
      wg.scale.setScalar(Math.max(0.001, 0.25 + 0.75 * s));
      wg.rotation.set(0.12 + fold * 0.3, -sg * (0.3 + fold + (moving ? 0.2 : 0) - f * amp * 0.5), sg * (0.1 + f * amp - fold * 0.4));
    }
    root.updateMatrixWorld();
    D.aura.update(dt, bones, root, s);
  }
  h.setLook = (look = {}) => { Object.assign(o.look, look); build(); };
  h.setGear = (gear = {}) => { Object.assign(o.gear, gear); if (gear.tier != null && !(opts.weapon && opts.weapon.tier != null)) o.weapon.tier = gear.tier; build(); };
  h.setWeapon = (weapon = {}) => { Object.assign(o.weapon, weapon); buildWeapons(); };
  h.dispose = () => {
    root.parent?.remove(root);
    mesh.geometry.dispose(); matSkinned.dispose(); matRigid.dispose(); skeleton.dispose();
    if (D) dropDemon(); matDemon?.dispose();
  };
  h.weapons = weapons;
  h.actions = MOVE_NAMES;
  h.stats.ms = performance.now() - t0;
  anim.update(0, {});
  return h;
}
const sstep = (x) => x * x * (3 - 2 * x);

/** Build caches for a hero kind synchronously (creates and disposes a throwaway hero). */
export function warmHero(opts) { const h = createHero(opts); h.dispose(); }
export { buildBucket };
