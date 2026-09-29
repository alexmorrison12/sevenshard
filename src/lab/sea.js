// Sea lab: the ocean, a sailing ship with wake & foam, and (mode=zone) the whole Glass Sea or an island zone.
// URL: ?mode=ship|zone &zone=glass_sea|isle_* &env=day|dusk|night &storm=0..1 &speed=9 &radius=45 &dist=55 &at=x,z
//      &ship=dawnrunner &steer=1 (WASD/arrows sail the ship; Shift = full sail) &view=iso|orbit|top &t=seconds
// Scripting: window.__sea = { lab, ocean, waves, rig, zone, state, build(id), teleport(x, z), env(name) }
import * as THREE from 'three';
import { createLab } from './kit.js';
import { G } from '../engine/materials.js';
import { makeEnv, applyEnv } from '../world/env.js';
import { Waves } from '../world/sea/waves.js';
import { Ocean } from '../world/sea/ocean.js';
import { ShipRig } from '../world/sea/shiprig.js';
import { buildZone, ZONES } from '../world/index.js';
import '../world/zones/glass_sea.js';

const Q = Object.fromEntries(new URLSearchParams(location.search));
const num = (k, d) => (Q[k] != null ? +Q[k] : d);
const lab = createLab({ title: 'Sea', view: Q.view === 'orbit' ? 'orbit' : 'iso', ground: 'none', light: 'day' });
const { scene, iso } = lab;
const sc = lab.sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.far = 200; sc.updateProjectionMatrix();

const S = window.__sea = { lab, state: { x: 0, z: 0, heading: num('yaw', 0) * Math.PI / 180, speed: num('speed', 8), turn: 0, sail: 1 }, zone: null, ocean: null, waves: null, rig: null };
const info = lab.panel.text('');

function env(name) {
  const e = S.zone?.envs?.[name] || S.zone?.env || makeEnv(name || 'day', { fogDensity: 0.0026 });
  applyEnv(e, { sun: lab.sun, hemi: lab.hemi, scene, renderer: lab.renderer, focus: new THREE.Vector3(S.state.x, 0, S.state.z) });
  S.ocean?.setEnv(e); S.zone?.setEnv?.(name);
  S.rig?.setNight(e.night || 0);
  S.envNow = e;
  return e;
}

async function build(id) {
  info.set('building…');
  if (S.zone) { S.zone.dispose(); S.zone = null; }
  if (S.ocean && !S.ownOcean) { scene.remove(S.ocean.mesh); S.ocean.dispose(); }
  S.ocean = null;
  if (id && ZONES[id]) {
    const t0 = performance.now();
    const z = await buildZone(id, { quality: Q.q || 'high' });
    S.zone = z; scene.add(z.root);
    S.waves = z.sea?.waves; S.ocean = z.sea?.ocean; S.ownOcean = true;
    const a = Q.at ? (z.anchors[Q.at] || (() => { const [x, zz] = Q.at.split(',').map(Number); return { x, z: zz, facing: S.state.heading }; })()) : z.anchors['port:solhaven'] || z.anchors.spawn || { x: 0, z: 0, facing: 0 };
    S.state.x = a.x; S.state.z = a.z; S.state.heading = a.facing ?? 0;
    info.set(`${ZONES[id].name}: ${z.stats.build} ms · ${z.stats.meshes} meshes · ${(z.stats.tris / 1000).toFixed(0)}k tris`);
  } else {
    S.waves = new Waves({ base: num('storm', 0) });
    S.ocean = new Ocean({ waves: S.waves }); scene.add(S.ocean.mesh); S.ownOcean = false;
    info.set('open ocean');
  }
  if (!S.rig && S.waves) { S.rig = new ShipRig(Q.ship || 'dawnrunner', { waves: S.waves }); scene.add(S.rig.root); }
  else if (S.rig && S.waves && S.rig.waves !== S.waves) { S.rig.dispose(); S.rig = new ShipRig(Q.ship || 'dawnrunner', { waves: S.waves }); scene.add(S.rig.root); }
  S.rig?.place(S.state.x, S.state.z, S.state.heading);
  env(Q.env || 'day');
  if (lab.view === 'iso') { iso.zoom = iso.dist = num('dist', 55); iso.maxDist = 400; iso.snap(new THREE.Vector3(S.state.x, 0, S.state.z)); }
  S.ready = true;
}
S.build = build;
S.env = env;
S.teleport = (x, z) => { S.state.x = x; S.state.z = z; S.rig?.place(x, z, S.state.heading); iso.snap(new THREE.Vector3(x, 0, z)); };

// controls
const keys = new Set();
addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
lab.panel.buttons(['day', 'dusk', 'night'], v => env(v));
lab.panel.slider('storm', 0, 1, num('storm', 0), v => { if (S.waves) S.waves.base = v; });
lab.panel.slider('speed', 0, 20, S.state.speed, v => { S.state.speed = v; });

const R = num('radius', 0), steer = Q.steer === '1';
lab.onFrame((dt, t) => {
  const st = S.state;
  if (steer) {
    const tgtSp = (keys.has('w') || keys.has('arrowup')) ? (keys.has('shift') ? 16 : 10) : (keys.has('s') || keys.has('arrowdown')) ? 0 : st.speed * 0.995;
    st.speed += (tgtSp - st.speed) * (1 - Math.exp(-dt * 0.8));
    const tr = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    st.turn += (tr * 0.35 * Math.min(1, st.speed / 5 + 0.3) - st.turn) * (1 - Math.exp(-dt * 2.5));
  } else st.turn = R > 0 ? st.speed / R : 0;
  st.heading += st.turn * dt;
  st.x += -Math.sin(st.heading) * st.speed * dt; st.z += -Math.cos(st.heading) * st.speed * dt;
  S.rig?.update(dt, t, st);
  const f = new THREE.Vector3(st.x, 0, st.z);
  if (lab.view === 'iso') iso.target.copy(f);
  S.ocean?.update(f);
  S.zone?.update?.(dt, t, f, lab.camera);
  G.uPlayerPos.value.set(st.x, 0, st.z);
  const e = S.envNow; if (e) { lab.sun.position.set(st.x + e.sunDir[0] * 80, e.sunDir[1] * 80, st.z + e.sunDir[2] * 80); lab.sun.target.position.set(st.x, 0, st.z); lab.sun.target.updateMatrixWorld(); }
});
if (Q.t) setTimeout(() => { lab.paused = true; }, 10);
S.showChart = () => { const c = S.zone?.minimap?.canvas; if (!c) return; c.style.cssText = 'position:fixed;right:10px;top:10px;width:860px;height:860px;z-index:200;border:2px solid #c9a45a'; document.body.appendChild(c); };
S.overview = (h = 900) => { lab.setView('orbit', new THREE.Vector3(0, 0, 0)); lab.camera.position.set(0, h, h * 0.35); lab.controls.target.set(0, 0, 0); lab.camera.far = 5000; lab.camera.updateProjectionMatrix(); lab.controls.update(); };
build(Q.mode === 'zone' ? (Q.zone || 'glass_sea') : null).then(() => { if (Q.t) { lab.step(Math.round(num('t', 0) * 60)); } if (Q.chart === '1') S.showChart(); if (Q.overview) S.overview(+Q.overview); console.log('phases', JSON.stringify(S.zone?.stats)); });
