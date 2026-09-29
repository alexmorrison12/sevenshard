// Runtime guardian instance (the contract object returned by createBoss).
import * as THREE from 'three';
import { Pose } from '../../../kit/rig.js';
import { BossCtl } from './ctl.js';
import { guardianUniforms, guardianMaterial } from './material.js';

const IDENT = new THREE.Matrix4();
const _v = new THREE.Vector3();

export class Boss {
  constructor(id, entry, info, opts = {}) {
    const def = entry.def, cfg = entry.cfg;
    this.id = id; this.entry = entry; this.info = info; this.opts = opts;
    this.scale = opts.scale ?? 1;
    this.root = new THREE.Object3D(); this.root.name = 'boss:' + id;
    this.pivot = new THREE.Object3D(); this.pivot.scale.setScalar(this.scale); this.root.add(this.pivot);
    this.bones = entry.rig.bones.map(b => { const bone = new THREE.Bone(); bone.name = b.name; bone.position.copy(b.rest); this.pivot.add(bone); return bone; });
    this.skeleton = new THREE.Skeleton(this.bones, entry.boneInverses);
    this.U = guardianUniforms({ ...(def.look || {}), ...(opts.clone && def.cloneLook ? def.cloneLook : {}) });
    this.materials = [];
    this.meshes = {};
    const mk = (name, variant, mo) => {
      const g = entry.geos[name]; if (!g) return;
      const mat = guardianMaterial(this.U, variant, mo);
      const mesh = new THREE.SkinnedMesh(g, mat);
      mesh.bind(this.skeleton, IDENT);
      mesh.boundingSphere = entry.sphere.clone();
      mesh.castShadow = variant !== 'flame'; mesh.receiveShadow = variant !== 'flame';
      mesh.name = id + ':' + name;
      if (variant === 'flame') mesh.renderOrder = 2;
      this.pivot.add(mesh);
      this.meshes[name] = mesh; this.materials.push(mat);
    };
    mk('body', 'body', def.mat?.body);
    mk('membrane', 'membrane', def.mat?.membrane);
    mk('flame', 'flame', def.mat?.flame);
    this.mesh = this.meshes.body;
    this.pose = new Pose(entry.rig);
    // sockets: Object3Ds parented to bones; forward = local -Z
    const S = {};
    for (const [name, s] of Object.entries(entry.sockets)) {
      const o = new THREE.Object3D(); o.name = 'socket:' + name;
      o.position.copy(s.pos).sub(entry.rig.bones[s.bone].rest);
      if (s.rot) o.rotation.set(s.rot[0], s.rot[1], s.rot[2], 'YXZ');
      this.bones[s.bone].add(o); S[name] = o;
    }
    S.chest ||= S.head; S.head ||= S.chest; S.mouth ||= S.head;
    S.handR ||= S.chest; S.handL ||= S.chest; S.weapon ||= S.handR; S.weaponTip ||= S.weapon;
    S.parts = {};
    for (const [name, p] of Object.entries(def.breakable || {})) S.parts[name] = S[p.socket] || S.chest;
    this.sockets = S;
    this.height = (info.height ?? entry.bb.max.y) * this.scale;
    this.radius = (info.radius ?? 3) * this.scale;
    this.actions = Object.keys(info.actions);
    this.glow = { counter: 0, enrage: 0, ghost: 0 };
    this.tintFade = 0;
    this.clone = !!opts.clone;
    this.ctl = new BossCtl(this, def.spec);
    this._transparent = false;
    if (this.clone && def.cloneSetup) def.cloneSetup(this);
    this.ctl.update(1e-4, {});
    this._syncMaterials(0);
    this.root.updateMatrixWorld(true);
  }

  /** state: { speed (m/s along facing), turn (rad/s), dead, groggy, enraged, fly (0..1), burrowed (0..1), ghost } */
  update(dt, state = {}) {
    if (this.ctl.update(dt, state)) {
      if (this.entry.def.spec.material) this.entry.def.spec.material(this.ctl, this.U, dt);
      this._syncMaterials(dt);
      this.root.updateMatrixWorld(true);
    }
  }
  _syncMaterials(dt) {
    const U = this.U, g = this.glow, c = this.ctl;
    U.uCounter.value = g.counter;
    U.uEnrage.value = Math.max(g.enrage, c.enrage * 0.85);
    const ghost = this.clone ? 1 : Math.max(g.ghost, c.ghost);
    U.uGhost.value = ghost;
    const tr = ghost > 0.002 || U.uAlpha.value < 0.999;
    if (tr !== this._transparent) {
      this._transparent = tr;
      for (const m of this.materials) if (m.userData.variant !== 'flame') { m.transparent = tr; m.needsUpdate = true; }
      for (const k in this.meshes) if (this.meshes[k].material.userData.variant !== 'flame') this.meshes[k].castShadow = !tr;
    }
    if (this.tintFade > 0 && dt > 0) { U.uTintAmt.value = Math.max(0, U.uTintAmt.value - dt / this.tintFade * this._tint0); if (U.uTintAmt.value <= 0) this.tintFade = 0; }
  }
  /** play(action, { dur }) → { dur, hits: [seconds] } */
  play(action, opts = {}) { return this.ctl.play(action, opts); }
  /** end a looping action (fly / sing / groggy …) or everything */
  stop(action) { this.ctl.stop(action); }
  /** 'counter' | 'enrage' | 'ghost', 0..1 */
  setGlow(kind, v = 1) { if (kind in this.glow) { this.glow[kind] = Math.max(0, Math.min(1, v)); this._syncMaterials(0); } }
  /** Hide a breakable part (see BOSSES[id].parts). Returns true if it broke now. */
  breakPart(name) {
    const p = this.entry.def.breakable?.[name];
    if (!p || this.ctl.broken.has(name)) return false;
    this.ctl.broken.add(name);
    if (p.onBreak) p.onBreak(this);
    return true;
  }
  isBroken(name) { return this.ctl.broken.has(name); }
  /** Colour overlay (hit flash, freeze). Persistent until changed; fade (s) makes it decay to 0. */
  setTint(hex, amount = 0.5, fade = 0) {
    this.U.uTintAmt.value = amount; this.U.uTint.value.set(hex);
    this.tintFade = fade > 0 ? fade : 0; this._tint0 = amount;
  }
  /** Current internal lift of the body above the root (flight / burrow), metres. */
  get altitude() { return this.ctl.lift ?? 0; }
  get dead() { return this.ctl.dead; }
  set onEvent(fn) { this.ctl.onEvent = fn; }
  get onEvent() { return this.ctl.onEvent; }
  /** World position of a socket (fresh after update()). */
  socketPos(name, out = new THREE.Vector3()) { const s = this.sockets[name] || this.sockets.parts[name]; return s ? s.getWorldPosition(out) : out.copy(this.root.position); }
  /** World forward (-Z) of a socket. */
  socketDir(name, out = new THREE.Vector3()) { const s = this.sockets[name]; if (!s) return out.set(0, 0, -1); return out.set(0, 0, -1).transformDirection(s.matrixWorld); }
  dispose() {
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
    this.skeleton.dispose();
  }
}
