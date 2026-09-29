// World lab: build any zone, walk it with a 1.85 m capsule (WASD / arrows, Shift = run) under the game camera,
// switch to an overview, toggle nav-grid overlay, anchor labels and lighting variants.
// URL: ?zone=solhaven&view=iso&env=day&at=spawn|x,z&nav=1&labels=1&q=high
// Scripting: window.__lab.world = { zone, capsule, teleport(x, z), setEnv(name), overview(), iso(), build(id) }
import * as THREE from 'three';
import { createLab } from './kit.js';
import { buildZone, ZONES, applyEnv } from '../world/index.js';
import { lambert } from '../engine/materials.js';
import { ISO } from '../engine/isocam.js';

const Q = Object.fromEntries(new URLSearchParams(location.search));
const lab = createLab({ title: 'World', view: Q.view === 'overview' ? 'orbit' : 'iso', ground: 'none', light: 'day' });
const { scene, camera, renderer, iso, controls } = lab;
lab.sun.shadow.camera.left = lab.sun.shadow.camera.bottom = -26; lab.sun.shadow.camera.right = lab.sun.shadow.camera.top = 26;
lab.sun.shadow.camera.far = 160; lab.sun.shadow.camera.updateProjectionMatrix();
lab.sun.shadow.normalBias = 0.03; lab.sun.shadow.bias = -0.0003;

// ---------------------------------------------------------------- capsule "hero"
const capsule = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.17, 6, 14), lambert({ color: 0x3a78ff }, { rim: 0.6, rimColor: 0xbfe0ff, key: 'lab-cap' }));
body.position.y = 0.925; body.castShadow = true; capsule.add(body);
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 10), lambert({ color: 0xffd060 }, { key: 'lab-nose' }));
nose.rotation.x = -Math.PI / 2; nose.position.set(0, 1.45, -0.42); capsule.add(nose);
scene.add(capsule);
let facing = 0;

// ---------------------------------------------------------------- state
const S = { zone: null, id: Q.zone || 'test', env: Q.env || null, nav: Q.nav === '1', labels: Q.labels !== '0', building: false };
const info = lab.panel.text('');
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.key === 'n') toggleNav(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// overlay for anchor labels
const overlay = document.createElement('div');
overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;font:11px system-ui;overflow:hidden';
document.body.appendChild(overlay);
let labels = [];
const markers = new THREE.Group(); scene.add(markers);
let navMesh = null;

function clearMarkers() {
  for (const l of labels) l.el.remove();
  labels = [];
  markers.clear();
}
const COLORS = { spawn: '#5dff8a', npc: '#ffd35a', portal: '#c77dff', idle: '#8fd0ff', seed: '#9dff5a', dock: '#5ac8ff', gate: '#ff9a5a', stage: '#ff6ad5', boss: '#ff4a4a', pillar: '#ffb0b0' };
function makeMarkers() {
  clearMarkers();
  const z = S.zone; if (!z) return;
  const geo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6);
  for (const [name, a] of Object.entries(z.anchors)) {
    const kind = name.split(':')[0];
    const col = COLORS[kind] || (name.includes(':m') ? '#ff8a8a' : '#ffffff');
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
    const y = z.heightAt(a.x, a.z);
    m.position.set(a.x, y + 1.1, a.z); markers.add(m);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), new THREE.MeshBasicMaterial({ color: col }));
    arrow.position.set(a.x - Math.sin(a.facing) * 0.5, y + 0.15, a.z - Math.cos(a.facing) * 0.5);
    arrow.rotation.set(-Math.PI / 2, 0, 0); arrow.rotation.z = 0; arrow.lookAt(a.x - Math.sin(a.facing) * 2, y + 0.15, a.z - Math.cos(a.facing) * 2); arrow.rotateX(Math.PI / 2);
    markers.add(arrow);
    const el = document.createElement('div');
    el.textContent = name;
    el.style.cssText = `position:absolute;transform:translate(-50%,-100%);padding:1px 4px;border-radius:3px;background:rgba(8,10,18,.72);color:${col};white-space:nowrap`;
    overlay.appendChild(el);
    labels.push({ el, p: new THREE.Vector3(a.x, y + 2.4, a.z) });
  }
  markers.visible = S.labels; overlay.style.display = S.labels ? '' : 'none';
}
function makeNavOverlay() {
  if (navMesh) { scene.remove(navMesh); navMesh.geometry.dispose(); navMesh.material.map.dispose(); navMesh.material.dispose(); navMesh = null; }
  const z = S.zone; if (!z || !z.nav) return;
  const n = z.nav;
  const cv = document.createElement('canvas'); cv.width = n.w; cv.height = n.h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(n.w, n.h);
  for (let k = 0; k < n.w * n.h; k++) { const w = n.data[k]; img.data[k * 4] = w ? 40 : 255; img.data[k * 4 + 1] = w ? 255 : 40; img.data[k * 4 + 2] = w ? 90 : 60; img.data[k * 4 + 3] = w ? 70 : 150; }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const W = n.w * n.cell, D = n.h * n.cell;
  const seg = [Math.min(200, Math.ceil(W / 1)), Math.min(200, Math.ceil(D / 1))];
  const g = new THREE.PlaneGeometry(W, D, seg[0], seg[1]); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + n.x0 + W / 2, zz = p.getZ(i) + n.z0 + D / 2;
    p.setXYZ(i, x, z.heightAt(x, zz) + 0.08, zz);
    uv.setXY(i, (x - n.x0) / W, 1 - (zz - n.z0) / D);
  }
  tex.flipY = true;
  navMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  navMesh.renderOrder = 20; navMesh.visible = S.nav;
  scene.add(navMesh);
}
function toggleNav(v = !S.nav) { S.nav = v; if (navMesh) navMesh.visible = v; }

function setEnv(name) {
  const z = S.zone; if (!z) return;
  const env = name ? z.setEnv(name) : z.env;
  S.env = env.preset;
  applyEnv(env, { sun: lab.sun, hemi: lab.hemi, scene, renderer, focus: capsule.position });
  return env;
}

async function build(id) {
  if (S.building) return; S.building = true;
  info.set(`building ${id}…`);
  if (S.zone) { S.zone.dispose(); S.zone = null; }
  const t0 = performance.now();
  const zone = await buildZone(id, { quality: Q.q || 'high' });
  S.zone = zone; S.id = id;
  scene.add(zone.root);
  let at = zone.anchors.spawn || zone.anchors['stage1:spawn'] || Object.values(zone.anchors)[0] || { x: 0, z: 0, facing: 0 };
  if (Q.at) {
    if (zone.anchors[Q.at]) at = zone.anchors[Q.at];
    else { const [x, z2] = Q.at.split(',').map(Number); at = { x, z: z2, facing: 0 }; }
  }
  teleport(at.x, at.z, at.facing);
  setEnv(S.env && zone.envs && zone.envs[S.env] ? S.env : null);
  makeMarkers(); makeNavOverlay();
  const st = zone.stats;
  info.set(`${ZONES[id].name}: ${st.build} ms (bake ${st.bake} ms)\n${st.meshes} meshes · ${(st.tris / 1000).toFixed(0)}k tris\nanchors ${Object.keys(zone.anchors).length}`);
  console.log(`[world] ${id} built in ${(performance.now() - t0).toFixed(0)} ms`, JSON.stringify(st));
  S.building = false;
  if (Q.view === 'overview') overview();

  window.__lab.world.ready = true;
  return zone;
}
function teleport(x, z, f = facing) {
  facing = f;
  capsule.position.set(x, S.zone ? S.zone.heightAt(x, z) : 0, z);
  capsule.rotation.y = facing;
  if (lab.view === 'iso') iso.snap(new THREE.Vector3(x, capsule.position.y, z));
}
function overview() {
  const z = S.zone; if (!z) return;
  const b = z.bounds || { x0: -50, z0: -50, x1: 50, z1: 50 };
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, size = Math.max(b.x1 - b.x0, b.z1 - b.z0);
  lab.setView('orbit', new THREE.Vector3(cx, 0, cz));
  camera.position.set(cx, size * 0.95, cz + size * 0.62); controls.target.set(cx, 0, cz - size * 0.04);
  camera.far = 2000; camera.updateProjectionMatrix(); controls.update();
}
function isoView() { lab.setView('iso'); iso.snap(capsule.position.clone()); }

// ---------------------------------------------------------------- panel
lab.panel.label('Zone');
lab.panel.select('zone', Object.keys(ZONES), S.id, v => build(v));
lab.panel.buttons(['day', 'dusk', 'night'], v => setEnv(v));
lab.panel.buttons(['iso', 'overview'], v => (v === 'iso' ? isoView() : overview()));
lab.panel.check('nav grid (N)', S.nav, v => toggleNav(v));
lab.panel.check('anchors', S.labels, v => { S.labels = v; markers.visible = v; overlay.style.display = v ? '' : 'none'; });
const pos = lab.panel.text('');

// ---------------------------------------------------------------- loop
const _v = new THREE.Vector3();
lab.onFrame((dt, t) => {
  const z = S.zone;
  // movement
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if ((mx || mz) && z) {
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    const sp = (keys.has('shift') ? 14 : 6) * dt;
    const p = capsule.position;
    const nx = p.x + mx * sp, nz = p.z + mz * sp;
    if (z.walkable(nx, nz)) { p.x = nx; p.z = nz; }
    else if (z.walkable(nx, p.z)) p.x = nx;
    else if (z.walkable(p.x, nz)) p.z = nz;
    facing = Math.atan2(-mx, -mz);
    capsule.rotation.y = facing;
  }
  if (z) {
    capsule.position.y = z.heightAt(capsule.position.x, capsule.position.z);
    if (lab.view === 'iso') iso.target.set(capsule.position.x, capsule.position.y, capsule.position.z);
    z.update(dt, t, capsule.position, camera);
    // sun + shadow frustum follow the capsule
    const e = z.env;
    lab.sun.position.set(capsule.position.x + e.sunDir[0] * 60, capsule.position.y + e.sunDir[1] * 60, capsule.position.z + e.sunDir[2] * 60);
    lab.sun.target.position.copy(capsule.position); lab.sun.target.updateMatrixWorld();
    pos.set(`x ${capsule.position.x.toFixed(1)}  z ${capsule.position.z.toFixed(1)}  y ${capsule.position.y.toFixed(2)}\nwalkable ${z.walkable(capsule.position.x, capsule.position.z)}`);
  }
  // labels
  if (S.labels && labels.length) {
    const w = innerWidth, h = innerHeight;
    for (const l of labels) {
      _v.copy(l.p).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = ''; l.el.style.left = ((_v.x * 0.5 + 0.5) * w).toFixed(0) + 'px'; l.el.style.top = ((-_v.y * 0.5 + 0.5) * h).toFixed(0) + 'px';
    }
  }
});

window.__lab.world = { capsule, teleport, setEnv, overview, iso: isoView, build, toggleNav, get zone() { return S.zone; }, ready: false, ISO };
build(S.id);
