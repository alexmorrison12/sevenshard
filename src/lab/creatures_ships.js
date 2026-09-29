// Ships lab: one ship (or the whole fleet) on the world's sea shader, game iso camera or ship-relative close-ups,
// speed / sail / turn controls, still / straight / circle sailing, broadsides.
// URL params (all optional):
//   ship=dawnrunner|pirate|ghost|merchant|fleet   mode=still|straight|circle   speed=4 sail=1 turn=0 radius=30 yaw=0 (deg)
//   view=iso|isofar|orbit   cam=side|port|bow|stern|deck|fig|helm|transom|top|full|q34   dist=36 (isofar distance)
//   t=2.5 (advance & freeze)   fire=L|R  fireAt=0.3 (s)   light=day|dusk|night   q=high
import * as THREE from 'three';
import { createLab } from './kit.js';
import { G } from '../engine/materials.js';
import { buildWater } from '../world/water.js';
import { createShip, SHIPS, shipStats } from '../models/creatures/ships/index.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const view0 = Q.get('view') || 'orbit';
const lab = createLab({ title: 'Ships', view: view0 === 'isofar' ? 'iso' : view0, ground: 'none', light: Q.get('light') || 'day', size: 60 });
G.uFogDensity.value = 0.0022;
const P = lab.panel;
const info = P.text('');

// ------------------------------------------------------------------------------------------------ sea
const sea = buildWater(null, { x: 0, z: 0, w: 700, d: 700, level: 0, shallow: 0x2c8fa6, deep: 0x134a70, sky: 0xa8c8e0, swell: 0.08, seg: 3.5, foam: 0 });
lab.scene.add(sea);
const env = { day: [0xa8c8e0, 0xfff0d0], dusk: [0xe0a888, 0xffb070], night: [0x2a3a5a, 0x9ab8ff], dungeon: [0x3a3a6a, 0xb8b0ff], studio: [0xc0c8d0, 0xffffff] };
function seaEnv(name) { const e = env[name] || env.day; sea.userData.u.uSky.value.set(e[0]); sea.userData.u.uSunCol.value.set(e[1]); }
seaEnv(lab.light);
if (lab.light === 'night') { lab.renderer.grade.exposure = 1.25; }

// ------------------------------------------------------------------------------------------------ ships
const state = { speed: num('speed', 4), sail: num('sail', 1), turn: num('turn', 0) };
let mode = Q.get('mode') || 'still', type = Q.get('ship') || 'dawnrunner';
const R = num('radius', 30);
const list = [];   // { s, x, z, heading }
const api = (window.__ships = { lab, list, state, SHIPS, createShip, shipStats });

function clear() { for (const it of list) it.s.dispose(); list.length = 0; }
// placeholder 1.85 m captain on the helm socket + muzzle markers (toggle: captain=0, markers=1)
function dressShip(s) {
  if (Q.get('captain') !== '0') {
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0x8a2a2a }), sk = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.0, 4, 8), m); body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), sk); head.position.y = 1.7; g.add(head);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    s.sockets.helm.add(g);
  }
  if (Q.get('markers') === '1') for (const k of ['cannonsL', 'cannonsR']) for (const o of s.sockets[k]) {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), new THREE.MeshBasicMaterial({ color: k === 'cannonsL' ? 0xff3030 : 0x30ff30 }));
    a.rotation.x = -Math.PI / 2; a.position.z = -0.3; o.add(a);   // cone tip along local −Z (out of the muzzle)
  }
}
function spawn() {
  clear();
  const t0 = performance.now();
  const types = type === 'fleet' ? Object.keys(SHIPS) : [type];
  types.forEach((t, i) => {
    const s = createShip(t);
    dressShip(s);
    const x = type === 'fleet' ? (i - (types.length - 1) / 2) * 16 : 0;
    s.root.position.set(x, 0, 0);
    lab.scene.add(s.root);
    list.push({ s, x0: x, z0: 0, heading: THREE.MathUtils.degToRad(num('yaw', 0)), ang: 0, dist: 0 });
  });
  api.ship = list[0].s;
  const ms = performance.now() - t0;
  const st = shipStats().filter(e => types.includes(e.type));
  setTimeout(() => {
    const i = lab.renderer.r.info;
    info.set(`${types.join(', ')}\n` + st.map(e => `${e.type}: ${(e.tris / 1000).toFixed(1)}k tris · ${e.drawCalls} calls · build ${e.ms.toFixed(0)} ms`).join('\n') + `\ncreate ${ms.toFixed(0)} ms · scene ${i.render.calls} calls`);
  }, 400);
}
spawn();

// ------------------------------------------------------------------------------------------------ camera presets (ship-relative)
const CAMS = {
  side: [[24, 6, 0], [0, 5.5, 0]], port: [[-24, 6, 0], [0, 5.5, 0]], bow: [[15, 7, -21], [0, 4.5, -2]], stern: [[-11, 9, 23], [0, 4.5, 2]],
  deck: [[6, 13, 15], [0, 2.5, -1]], fig: [[3.4, 3.6, -13.2], [0, 2.9, -9.2]], helm: [[4.5, 6.2, 11.5], [0, 3.8, 5.5]], transom: [[1.5, 3.6, 16], [0, 2.8, 8.4]],
  top: [[0, 50, 0.01], [0, 0, 0]], gun: [[0.4, 3.9, 1.2], [2.2, 1.9, -1.2]], full: [[27, 12, -15], [0, 6, 0]], q34: [[-19, 11, -17], [0, 5, 0]], low: [[16, 1.6, 9], [0, 3.5, 0]],
};
let cam = Q.get('cam') || (view0 === 'orbit' ? 'full' : null);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
function applyCam(snap) {
  if (!cam || lab.view === 'iso' || !list.length) return;
  const c = CAMS[cam]; if (!c) return;
  const root = type === 'fleet' ? null : list[0].s.root;
  if (root) { root.updateMatrixWorld(); _m.copy(root.matrixWorld); } else _m.identity();
  const zoom = num('zoom', 1);
  _p.set(c[0][0] * zoom, c[0][1] * (zoom > 1 ? zoom * 0.8 : 1), c[0][2] * zoom).applyMatrix4(_m); _t.set(...c[1]).applyMatrix4(_m);
  if (type === 'fleet') { _p.multiplyScalar(1.9); _p.y *= 0.9; }
  if (snap) lab.camera.position.copy(_p); else lab.camera.position.lerp(_p, 0.2);
  lab.controls.target.copy(_t); lab.camera.fov = cam === 'top' ? 40 : 35; lab.camera.updateProjectionMatrix();
}
api.setCam = (name) => { cam = name; if (lab.view === 'iso') lab.setView('orbit'); applyCam(true); lab.controls.update(); };
api.setIso = (dist = 21) => { cam = null; lab.setView('iso', list[0].s.root.position); lab.iso.zoom = lab.iso.dist = dist; };

// ------------------------------------------------------------------------------------------------ simulation
const _v = new THREE.Vector3();
lab.onFrame((dt) => {
  for (const it of list) {
    const r = it.s.root;
    let turn = state.turn;
    if (mode === 'circle') {
      it.ang += state.speed / R * dt;
      // counter-clockwise circle seen from above; heading follows the velocity (bow first)
      r.position.set(it.x0 + Math.cos(it.ang) * R - R, 0, it.z0 - Math.sin(it.ang) * R);
      const vx = -Math.sin(it.ang), vz = -Math.cos(it.ang);           // velocity direction
      it.heading = Math.atan2(-vx, -vz);                                // forward = (−sin h, 0, −cos h)
      turn = state.speed / R;
    } else if (mode === 'straight') {
      it.heading += state.turn * dt;
      r.position.x -= Math.sin(it.heading) * state.speed * dt; r.position.z -= Math.cos(it.heading) * state.speed * dt;
      if (r.position.length() > 160) r.position.set(it.x0, 0, it.z0);
    } else {
      it.heading += 0; // still: speed only drives the rigging
    }
    r.rotation.y = it.heading;
    it.s.update(dt, { speed: state.speed, turn, sail: state.sail });
  }
  const f = list[0]?.s.root.position;
  if (f) {
    sea.position.set(Math.round(f.x / 7) * 7, 0, Math.round(f.z / 7) * 7);
    if (lab.view === 'iso') lab.focus(type === 'fleet' ? _v.set(0, 0, 0) : f); else applyCam(false);
  }
});

// ------------------------------------------------------------------------------------------------ panel
P.select('ship', [...Object.keys(SHIPS), 'fleet'], type, v => { type = v; spawn(); applyCam(true); });
P.label('sailing');
P.buttons(['still', 'straight', 'circle'], m => { mode = m; for (const it of list) { it.s.root.position.set(it.x0, 0, it.z0); it.ang = 0; it.heading = 0; } });
P.slider('speed', 0, 12, state.speed, v => { state.speed = v; });
P.slider('sail', 0, 1, state.sail, v => { state.sail = v; });
P.slider('turn', -0.4, 0.4, state.turn, v => { state.turn = v; });
P.buttons(['fire L', 'fire R', 'both'], l => { for (const it of list) { if (l !== 'fire R') it.s.fire('L'); if (l !== 'fire L') it.s.fire('R'); } });
P.label('camera');
P.buttons(['iso', 'isofar', ...Object.keys(CAMS)], c => { if (c === 'iso') api.setIso(21); else if (c === 'isofar') api.setIso(num('dist', 36)); else api.setCam(c); });

// initial view
if (view0 === 'iso') api.setIso(21); else if (view0 === 'isofar') api.setIso(num('dist', 36)); else applyCam(true);
lab.controls.update();

// deterministic capture: advance t seconds with fixed steps and freeze
const fireSide = Q.get('fire');
if (Q.has('t')) {
  lab.paused = true;
  const dt = 1 / 60, steps = Math.round(num('t', 0) / dt), fAt = Math.round(num('fireAt', 0.3) / dt);
  for (let i = 0; i < steps; i++) { if (fireSide && i === fAt) for (const it of list) it.s.fire(fireSide); lab.step(1, dt); }
  applyCam(true);
} else if (fireSide) setTimeout(() => { for (const it of list) it.s.fire(fireSide); }, num('fireAt', 0.3) * 1000);
api.step = (sec, dt = 1 / 60) => lab.step(Math.round(sec / dt), dt);
