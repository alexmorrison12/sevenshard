// Zone: the object buildZone() returns (see ARCHITECTURE.md "World" contract) plus small helpers used by builders.
import * as THREE from 'three';
import { G } from '../engine/materials.js';
import { makeEnv } from './env.js';

export const tick = () => new Promise(r => setTimeout(r, 0));

export class Zone {
  constructor(id, def, opts = {}) {
    this.id = id; this.def = def; this.opts = opts;
    this.root = new THREE.Group(); this.root.name = 'zone:' + id;
    this.anchors = {};
    this.regions = [];
    this.env = makeEnv('day');
    this.envs = null;          // optional named variants { day, dusk, night } — see setEnv()
    this.minimap = null;
    this.nav = null;
    this._nav = null;
    this.ground = null;
    this._updaters = [];
    this._disposables = [];
    this.stats = { build: 0, phases: {} };
    this.bounds = null;        // { x0, z0, x1, z1 } playable area
    this.decks = [];           // walkable surfaces above the heightfield: [{ shape, y }] (piers, bridges)
  }
  /** register a walkable deck (pier, bridge, stage) — heightAt returns its y inside the shape */
  deck(shape, y) { this.decks.push({ shape, y }); }
  anchor(name, x, z, facing = 0, extra = null) {
    const a = { x: +x.toFixed(2), z: +z.toFixed(2), facing: +facing.toFixed(3) };
    if (extra) Object.assign(a, extra);
    this.anchors[name] = a; return a;
  }
  region(name, x, z, r) { this.regions.push({ name, x, z, r }); }
  heightAt(x, z) {
    for (let i = 0; i < this.decks.length; i++) { const d = this.decks[i]; if (x >= d.shape.box[0] && x <= d.shape.box[2] && z >= d.shape.box[1] && z <= d.shape.box[3] && d.shape.sd(x, z) <= 0) return d.y; }
    return this.ground ? this.ground.heightAt(x, z) : 0;
  }
  walkable(x, z) { return this._nav ? this._nav.walkable(x, z) : true; }
  onUpdate(fn) { this._updaters.push(fn); }
  own(...things) { this._disposables.push(...things); }
  /** Per frame: water, foliage wind, flags, torches, particles, the player cutaway. */
  update(dt, t, focus, camera) {
    if (focus) G.uPlayerPos.value.set(focus.x, focus.y ?? this.heightAt(focus.x, focus.z), focus.z);
    for (const f of this._updaters) f(dt, t, focus, camera);
  }
  /** Switch between named lighting variants (e.g. 'day' | 'dusk' | 'night' for the city). Returns the env. */
  setEnv(name) {
    if (this.envs && this.envs[name]) this.env = this.envs[name];
    for (const f of this._envHooks || []) f(this.env);
    return this.env;
  }
  onEnv(fn) { (this._envHooks ||= []).push(fn); fn(this.env); }
  /** Compile every shader the zone uses up-front (avoids hitches the first time water/foliage comes into view).
   *  renderer: the game's Renderer (or a THREE.WebGLRenderer); scene: the scene zone.root was added to. */
  async precompile(renderer, camera, scene) {
    const r = renderer?.r || renderer;
    if (!r) return;
    try { if (r.compileAsync) await r.compileAsync(this.root, camera, scene); else r.compile(this.root, camera, scene); } catch (e) { console.warn('[world] precompile', e); }
  }
  dispose() {
    const g = this.ground;
    if (g) for (const t of [g.ctrlA, g.ctrlB, g.ctrlC, g.infoTex, g.heightTex]) t?.dispose();
    this.root.traverse(o => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (!m.userData?.shared) m.dispose();
    });
    for (const d of this._disposables) d?.dispose?.();
    this.root.removeFromParent();
    this._updaters.length = 0;
  }
}
