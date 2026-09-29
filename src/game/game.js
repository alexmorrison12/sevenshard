// The game shell: renderer, scene, lights, camera, input, the running level, visuals, presentation and the active
// mode (city, dungeon, raid…). One instance for the page lifetime; levels and modes come and go.
import * as THREE from 'three';
import { Renderer, GRADE_DEFAULT } from '../engine/renderer.js';
import { IsoCam } from '../engine/isocam.js';
import { Input } from '../engine/input.js';
import { G } from '../engine/materials.js';
import { Level } from './level.js';
import { Visuals } from './visuals.js';
import { Presenter } from './present.js';
import { HeroKit } from './hero.js';
import { PlayerCtrl } from './player.js';
import { eff } from './combat.js';
import { Nameplates } from './nameplates.js';

export class Game {
  constructor({ quality = 'high' } = {}) {
    this.renderer = new Renderer(document.getElementById('app') || document.body, { quality });
    this.scene = new THREE.Scene();
    this.cam = new IsoCam();
    this.renderer.setScene(this.scene, this.cam.cam);
    this.input = new Input(this.renderer.canvas);
    this.renderer.canvas.tabIndex = 0;
    // lights (zones restyle them)
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6b5a44, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -26; sc.right = sc.top = 26; sc.near = 1; sc.far = 160;
    this.sunDir = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.presenter = new Presenter(this);
    this.plates = new Nameplates(this);
    this.fx = null; this.audio = null; this.ui = null;
    this.level = null; this.zone = null; this.visuals = null; this.hero = null; this.player = null; this.mode = null;
    this.time = 0; this.running = false; this.timeScale = 1;
    this.hudT = 0;
    this.hooks = { frame: [] };
  }
  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = now => {
      if (!this.running) return;
      // rAF timestamps can be earlier than a performance.now() taken during a long load → clamp negative steps
      const raw = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now);
      try { this.frame(Math.min(0.05, raw) * this.timeScale, raw); }
      catch (e) {
        // never let one bad frame freeze the game: log each distinct error once, keep rendering
        const k = String(e?.message); this._errs ||= new Set();
        if (!this._errs.has(k)) { this._errs.add(k); console.error('[frame]', e); }
        try { this.renderer.render(raw, this.time); this.input.endFrame(); } catch { /* */ }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  /** Apply a zone environment (lights, fog, grade). */
  applyEnv(env = {}) {
    this.hemi.color.set(env.hemiSky ?? 0xbcd6ff); this.hemi.groundColor.set(env.hemiGround ?? 0x6b5a44); this.hemi.intensity = env.hemiIntensity ?? 1.1;
    this.sun.color.set(env.sunColor ?? 0xfff1dc); this.sun.intensity = env.sunIntensity ?? 3.2;
    this.sunDir.set(...(env.sunDir || [-0.45, 0.8, 0.4])).normalize();
    G.uSunDir.value.copy(this.sunDir);
    G.uFogColor.value.set(env.fogColor ?? 0x9fb8d6); G.uFogDensity.value = env.fogDensity ?? 0.0016; G.uFogHeight.value = env.fogHeight ?? 0.012; G.uFogBase.value = env.fogBase ?? 0;
    const bg = env.background;
    this.scene.background = bg?.isTexture || bg?.isColor ? bg : new THREE.Color(bg ?? 0x0b0e16);
    this.renderer.grade = { ...GRADE_DEFAULT, ...(env.grade || {}) };
  }
  /** Replace the running level with a zone. zone: world contract object. */
  setZone(zone) {
    this.clearLevel();
    this.zone = zone;
    if (zone.root) this.scene.add(zone.root);
    this.applyEnv(zone.env);
    this.level = new Level(zone);
    this.visuals = new Visuals(this.scene, this.level);
    this.presenter.bind(this.level);
    if (this.net?.attach) this.net.attach(this.level);
    this.renderer.resetAdapt?.();
    return this.level;
  }
  clearLevel() {
    this.mode?.exit?.();
    this.mode = null;
    this.presenter.unbind();
    this.visuals?.dispose(); this.visuals = null;
    this.plates?.clear();
    if (this.zone?.root) { this.scene.remove(this.zone.root); this.zone.dispose?.(); }
    this.zone = null; this.level = null; this.hero = null; this.player = null;
  }
  /** Put the local player's hero into the level. */
  spawnHero(char, stats, at = { x: 0, z: 0, facing: 0 }) {
    const kit = new HeroKit(this.level, char, stats, { x: at.x, z: at.z, facing: at.facing });
    kit.u.data.look = char.look; kit.u.data.gear = char.gear; kit.u.data.weapon = char.weapon; kit.u.data.sex = char.sex;
    this.hero = kit;
    this.player = new PlayerCtrl(kit, this);
    this.level.localHero = kit.u;
    this.level.add(kit.u);
    this.cam.snap(kit.u.pos);
    return kit;
  }
  frame(dt, raw) {
    this.time += dt;
    G.uTime.value = this.time;
    const L = this.level;
    if (L && this.player && !this.inputBlocked) this.player.input(dt, this.input, this.cam);
    if (this.input.wheel) this.cam.zoomBy(this.input.wheel * 0.01);
    this.mode?.preUpdate?.(dt);
    if (L) L.update(dt);
    this.mode?.update?.(dt);
    this.net?.update?.(dt);
    for (const f of this.hooks.frame) f(dt);
    this.visuals?.update(dt);
    this.presenter.update(dt);
    // camera + sun shadow follow the hero
    const focus = this.camFocus || this.hero?.u.pos;
    if (focus) this.cam.target.set(focus.x, focus.y, focus.z);
    this.cam.update(dt, this.time);
    G.uCamPos.value.copy(this.cam.cam.position);
    if (focus) {
      G.uPlayerPos.value.set(focus.x, focus.y, focus.z);
      this.sun.target.position.set(focus.x, focus.y, focus.z - 4);
      this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 70);
    }
    this.zone?.update?.(dt, this.time, focus || this.cam.target, this.cam.cam);
    if (!this.cam.manual) this.plates.update(); else this.plates.clear();
    this.fx?.update?.(dt, this.time, this.cam.cam);
    this.audio?.listener?.(focus || this.cam.target);
    this.hudT -= raw;
    if (this.hudT <= 0 && this.ui && this.onHud) { this.hudT = 1 / 15; try { this.onHud(); } catch (e) { console.error('[hud]', e); } }
    this.renderer.render(raw, this.time);
    this.input.endFrame();
  }
}
export { eff };
