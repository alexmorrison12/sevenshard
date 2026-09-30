// Creature core: build-once-per-(type, variant) entries (SDF sculpt → surface nets → ONE skinned mesh with baked AO and
// vertex colours + rigid parts), and the per-instance Creature (own bones/skeleton/material, shared geometry & program).
import * as THREE from 'three';
import { Rig, Pose } from '../kit/rig.js';
import { Sculpt } from '../kit/sdf.js';
import { GeoAcc } from '../kit/geo.js';
import { creatureMaterial, detailTexture } from './material.js';

const CACHE = new Map();   // type:variant[:elite][:key] → entry
const SHAPES = new Map();  // type:shapeKey → meshed SDF shape (palette-free), shared by palette-swap variants
const IDENT = new THREE.Matrix4();
export const DEFS = {};

export function register(type, def) { DEFS[type] = def; }

function buildEntry(type, cfg, def) {
  const t0 = performance.now();
  const rig = new Rig();
  def.rig(rig, cfg);
  const S = new Sculpt(rig);
  def.sculpt?.(S, cfg);
  const acc = new GeoAcc();
  const mcfg = {
    h: cfg.h ?? 0.03, hg: cfg.hg, paint: def.paint ? (v) => def.paint(v, cfg) : null,
    ao: cfg.ao ?? { dist: 0.035 * (cfg.aoScale ?? 1), str: 0.8 }, grad: cfg.grad ?? { top: 0.18, bottom: 0.32, y0: 0, y1: 0.5, low: 0.22 },
    dtl: cfg.dtl, smoothW: cfg.smoothW ?? 2,
  };
  let stats = { ms: 0, evals: 0 };
  if (S.prims.length) {
    const skey = cfg.shapeKey !== undefined ? type + ':' + cfg.shapeKey : null;
    const shared = skey && SHAPES.get(skey);
    if (shared && shared.primCount === S.prims.length) stats = S.recolor(shared, acc, mcfg);
    else { stats = S.mesh(acc, mcfg); if (skey) SHAPES.set(skey, S.shape); }
  }
  const sdfVerts = acc.count;
  if (def.parts) def.parts(acc, S, rig, cfg);
  const geo = acc.build();
  const boneInverses = rig.bones.map(b => new THREE.Matrix4().makeTranslation(-b.rest.x, -b.rest.y, -b.rest.z));
  const bb = geo.boundingBox;
  const sphere = new THREE.Sphere(); bb.getBoundingSphere(sphere); sphere.radius *= cfg.sphereMul ?? 1.5;
  const sockets = {};
  const sdef = typeof def.sockets === 'function' ? def.sockets(cfg) : (def.sockets || {});
  for (const [name, [bone, pos]] of Object.entries(sdef)) sockets[name] = { bone: rig.index(bone), pos: new THREE.Vector3(...pos) };
  const height = (typeof def.height === 'function' ? def.height(cfg) : def.height) ?? bb.max.y;
  const radius = (typeof def.radius === 'function' ? def.radius(cfg) : def.radius) ?? Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.35;
  return {
    type, cfg, def, rig, geo, boneInverses, sockets, sphere, height, radius,
    stats: { ms: performance.now() - t0, sdfMs: stats.ms, verts: geo.attributes.position.count, sdfVerts, tris: geo.index.count / 3, bones: rig.bones.length, evals: stats.evals, t: stats.t, recolor: !!stats.recolor },
  };
}

export function getEntry(type, opts = {}) {
  const def = DEFS[type];
  if (!def) throw new Error('unknown creature type: ' + type);
  const cfg = def.config(opts.variant, opts);
  const key = type + ':' + cfg.variant + (cfg.elite ? ':elite' : '') + (cfg.key ? ':' + cfg.key : '');
  let e = CACHE.get(key);
  if (!e) { e = buildEntry(type, cfg, def); CACHE.set(key, e); }
  return e;
}

const _c = new THREE.Color();
const rnd = (seed, k) => { const x = Math.sin((seed || 0) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const NOOP = { dur: 0 };

export class Creature {
  constructor(type, entry, opts = {}) {
    const cfg = entry.cfg, def = entry.def;
    this.type = type; this.variant = cfg.variant; this.elite = !!cfg.elite; this.entry = entry; this.def = def;
    // per-instance variety: opts.seed → ±6% size and a subtle brightness / warmth shift (0 or undefined = none)
    const vary = opts.seed ? 1 : 0;
    this.seed = opts.seed || 0;
    this.scale = (opts.scale ?? 1) * (cfg.scale ?? 1) * (1 + (rnd(opts.seed, 1) - 0.5) * 0.12 * vary);
    this.root = new THREE.Object3D(); this.root.name = 'creature:' + type;
    this.pivot = new THREE.Object3D(); this.pivot.scale.setScalar(this.scale); this.root.add(this.pivot);
    this.bones = entry.rig.bones.map(b => { const bone = new THREE.Bone(); bone.name = b.name; bone.position.copy(b.rest); this.pivot.add(bone); return bone; });
    this.skeleton = new THREE.Skeleton(this.bones, entry.boneInverses);
    this.material = creatureMaterial(cfg.mat || def.mat || {});
    const u = this.material.userData.u;
    if (vary) { const br = 1 + (rnd(opts.seed, 2) - 0.5) * 0.16, w = (rnd(opts.seed, 3) - 0.5) * 0.08; u.uColorMul.value.setRGB(br * (1 + w), br, br * (1 - w)); }
    if (opts.tint !== undefined && opts.tint !== null) u.uColorMul.value.multiply(_c.set(opts.tint));
    if (cfg.pal?.glow !== undefined) u.uGlowCol.value.set(cfg.pal.glow);
    this.mesh = new THREE.SkinnedMesh(entry.geo, this.material);
    this.mesh.bind(this.skeleton, IDENT);
    this.mesh.boundingSphere = entry.sphere.clone();
    this.mesh.frustumCulled = true;
    this.mesh.castShadow = cfg.castShadow ?? true; this.mesh.receiveShadow = true;
    this.pivot.add(this.mesh);
    this.pose = new Pose(entry.rig);
    this.sockets = {};
    for (const [name, s] of Object.entries(entry.sockets)) {
      const o = new THREE.Object3D(); o.name = name;
      o.position.copy(s.pos).sub(entry.rig.bones[s.bone].rest);
      this.bones[s.bone].add(o); this.sockets[name] = o;
    }
    // every creature exposes the standard sockets; missing ones alias the closest available
    const S = this.sockets;
    S.center ||= S.chest || S.back || S.head; S.chest ||= S.center; S.head ||= S.center; S.mouth ||= S.head; S.back ||= S.center;
    this.height = entry.height * this.scale;
    this.radius = entry.radius * this.scale;
    this.flying = !!def.flying;
    this.actions = def.actionNames || Object.keys(def.actionList || {});
    /** optional callback (legId, worldPosition: Vector3, strength 0..1) fired when a foot plants — dust puffs / footstep sounds */
    this.onFootstep = null;
    /** a white setTint flash (the game's damage flash) plays a light `hit` flinch; false for super-armoured types */
    this.autoFlinch = def.autoFlinch ?? true;
    this._tintA = 0;
    this.ctl = def.controller(this, opts);
    const g = this.ctl.gait;
    if (g) {
      const wp = new THREE.Vector3();
      g.onStep = (L) => {
        if (!this.onFootstep) return;
        wp.copy(L.F); this.pivot.localToWorld(wp);
        this.onFootstep(L.id, wp, Math.min(1, Math.abs(g.sSm) / 4 + 0.3));
      };
    }
    this._dis = 0;
    if (opts.rest !== true) this.update(0, {});
  }
  /** state: { speed (m/s along facing), turn (rad/s), strafe, combat, dead, down, stunned, fly, enraged } */
  update(dt, state = {}) { this.ctl.update(dt, state); }
  /** One-shot (or looped until the next play / stop) layered action. Returns { dur, hit? } in seconds (hit = impact moment). */
  play(action, opts = {}) { return this.ctl.play(action, opts.dur, opts.loop) || NOOP; }
  stop() { this.ctl.stopActions(); }
  setTint(hex, amount = 0.5) {
    const u = this.material.userData.u; u.uTint.value.set(hex); u.uTintAmt.value = amount;
    // rising white flash = fresh damage → flinch (see autoFlinch)
    if (this.autoFlinch && hex === 0xffffff && amount >= 0.25 && amount > this._tintA + 0.05) this.ctl.flinch?.();
    this._tintA = amount;
  }
  /** Emissive multiplier (1 = authored). e.g. 2.5 for an enrage / charge flash. */
  // glow multiplier (1 = authored). Boss-style calls — setGlow('counter', v) — are not a creature thing: ignore them.
  setGlow(k = 1) { if (typeof k !== 'number' || !Number.isFinite(k)) return; this.material.userData.u.uGlow.value = k; }
  /** 0..1 burn-away with ember edges (hide the corpse after death; reverse it for a magical spawn). */
  setDissolve(v, hex) {
    const u = this.material.userData.u; u.uDissolve.value = v; if (hex !== undefined) u.uDissolveCol.value.set(hex);
    this.mesh.castShadow = v < 0.35 && (this.entry.cfg.castShadow ?? true);
  }
  /**
   * Optional terrain following: fn(worldX, worldZ) → ground height. Feet plant on the terrain and the body pitches /
   * rolls with the slope (the game still sets root.position.y to the ground height at the root). null disables.
   */
  setGround(fn) {
    const g = this.ctl.gait; if (!g) return;
    if (!fn) { g.ground = null; return; }
    const r = this.root;
    g.ground = (lx, lz) => {
      const s = this.scale, f = r.rotation.y, c = Math.cos(f), sn = Math.sin(f);
      const wx = r.position.x + (lx * c + lz * sn) * s, wz = r.position.z + (-lx * sn + lz * c) * s;
      return (fn(wx, wz) - r.position.y) / s;
    };
  }
  get isDead() { return this.ctl.dead; }
  dispose() {
    this.root.removeFromParent();
    this.material.dispose(); this.skeleton.dispose();
  }
}

export function createFromDef(type, opts = {}) {
  const entry = getEntry(type, opts);
  return new Creature(type, entry, opts);
}

export function preload(list) {
  detailTexture();
  const out = [];
  for (const it of list) { const [type, variant] = Array.isArray(it) ? it : [it]; out.push({ type, variant, ...getEntry(type, { variant }).stats }); }
  return out;
}
export function disposeCache() { for (const e of CACHE.values()) e.geo.dispose(); CACHE.clear(); SHAPES.clear(); }
export function stats() { return [...CACHE.entries()].map(([k, e]) => ({ key: k, ...e.stats })); }

/** Metadata for CREATURES: { name, height, radius, flying?, variants, actions, placeholder?, mount?, pet? } */
export function describe(type, names = {}) {
  const d = DEFS[type];
  const cfg = d.config(undefined, {});
  const hgt = typeof d.height === 'function' ? d.height(cfg) : d.height;
  const rad = typeof d.radius === 'function' ? d.radius(cfg) : d.radius;
  const o = { name: d.name && d.name !== type ? d.name : (names[type] || type), height: +(hgt * (cfg.scale ?? 1)).toFixed(3), radius: +(rad * (cfg.scale ?? 1)).toFixed(3), variants: d.variants || ['default'], actions: Object.keys(d.actionList || {}) };
  if (d.flying || d.canFly) o.flying = true;
  if (d.placeholder) o.placeholder = true;
  if (d.mount) o.mount = true;
  if (d.pet) o.pet = true;
  return o;
}
/** A self-contained registry for a subset of defs (sub-area labs): → { createCreature, CREATURES, creatureStats } */
export function makeRegistry(defs) {
  for (const [t, d] of Object.entries(defs)) register(t, d);
  const CREATURES = {};
  for (const t of Object.keys(defs)) CREATURES[t] = describe(t);
  return { CREATURES, createCreature: (type, opts = {}) => createFromDef(type, opts), creatureStats: stats, preloadCreatures: preload };
}
