// Lab harness: one call gives a lit scene, the game's post chain, the game camera ("iso") or a free orbit camera,
// a control panel and a stats line. Every lab page (src/lab/<name>.js) starts with createLab().
//
//   import { createLab } from './kit.js';
//   const lab = createLab({ title: 'Heroes', view: 'iso', ground: 'stone', light: 'day' });
//   lab.add(mesh); lab.onFrame((dt, t) => …); lab.panel.button('Attack', () => …);
//
// URL params override options: ?view=iso|orbit|close|front|side|top &light=day|dusk|dungeon|night &q=low|medium|high|ultra
// Automation: window.__lab = { ready, lab } — screenshot scripts can call __lab.lab.setView('close'), etc.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Renderer } from '../engine/renderer.js';
import { IsoCam, ISO } from '../engine/isocam.js';
import { G } from '../engine/materials.js';

export const LIGHTS = {
  //            sky        ground     hemi  sun        sunI  sunDir             fog        bg
  day: { sky: 0xbcd6ff, gnd: 0x6b5a44, hemi: 1.15, sun: 0xfff1dc, sunI: 3.2, dir: [-0.45, 0.8, 0.4], fog: 0x9fb8d6, bg: 0x8fa9c8 },
  dusk: { sky: 0xffb48a, gnd: 0x3a2a3a, hemi: 0.9, sun: 0xffb070, sunI: 2.6, dir: [-0.7, 0.45, -0.2], fog: 0xd99a7a, bg: 0x6a4a5a },
  dungeon: { sky: 0x5a64a8, gnd: 0x2a1c2a, hemi: 0.75, sun: 0xb8b0ff, sunI: 1.4, dir: [-0.3, 0.9, 0.3], fog: 0x1a1830, bg: 0x0c0a16 },
  night: { sky: 0x4a64a8, gnd: 0x141a26, hemi: 0.6, sun: 0x9ab8ff, sunI: 1.1, dir: [0.4, 0.8, -0.3], fog: 0x162034, bg: 0x070b16 },
  studio: { sky: 0xffffff, gnd: 0x707070, hemi: 1.3, sun: 0xffffff, sunI: 2.6, dir: [-0.5, 0.8, 0.6], fog: 0x30343c, bg: 0x2a2e36 },
};

export function createLab(opts = {}) {
  const q = Object.fromEntries(new URLSearchParams(location.search));
  const o = { title: 'Lab', view: 'orbit', ground: 'checker', light: 'day', size: 60, ...opts, ...(q.view && { view: q.view }), ...(q.light && { light: q.light }) };
  const renderer = new Renderer(document.body, { quality: q.q || 'high', preserve: true });
  renderer.fixedScale = true;
  const scene = new THREE.Scene();
  const iso = new IsoCam();
  const camera = iso.cam;
  const controls = new OrbitControls(camera, renderer.canvas);
  controls.enableDamping = true; controls.target.set(0, 1, 0);
  renderer.setScene(scene, camera);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 1; sc.far = 120;
  scene.add(hemi, sun, sun.target);
  const setLight = name => {
    const L = LIGHTS[name] || LIGHTS.day;
    hemi.color.set(L.sky); hemi.groundColor.set(L.gnd); hemi.intensity = L.hemi;
    sun.color.set(L.sun); sun.intensity = L.sunI;
    sun.position.set(...L.dir).normalize().multiplyScalar(50); G.uSunDir.value.copy(sun.position).normalize();
    scene.background = new THREE.Color(L.bg); G.uFogColor.value.set(L.fog);
    lab.light = name;
  };

  let ground = null;
  if (o.ground === 'checker' || o.ground === 'stone') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    if (o.ground === 'checker') {
      x.fillStyle = '#5b5f66'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#53575e'; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128);
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 256, 256);
    } else {
      x.fillStyle = '#6d655b'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) { const s = 18 + Math.random() * 30; x.fillStyle = `hsl(${30 + Math.random() * 15},${8 + Math.random() * 10}%,${36 + Math.random() * 14}%)`; x.beginPath(); x.roundRect(Math.random() * 256 - 10, Math.random() * 256 - 10, s, s * (0.7 + Math.random() * 0.4), 6); x.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(o.size / 2, o.size / 2); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    ground = new THREE.Mesh(new THREE.PlaneGeometry(o.size, o.size), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:10px;top:10px;z-index:100;display:flex;flex-direction:column;gap:5px;max-height:calc(100% - 20px);overflow:auto;padding:10px;background:rgba(8,10,18,.82);border:1px solid #2c3550;border-radius:8px;font:12px system-ui;color:#cfd6ea;min-width:180px;max-width:280px';
  panel.innerHTML = `<b style="font-size:13px;color:#ffd98a">${o.title}</b><div id="lab-stats" style="color:#8fa0c8;font:11px monospace"></div>`;
  document.body.appendChild(panel);
  const stats = panel.querySelector('#lab-stats');
  const row = el => { panel.appendChild(el); return el; };
  const api = {
    el: panel,
    hide() { panel.style.display = 'none'; },
    show() { panel.style.display = 'flex'; },
    label(text) { const d = document.createElement('div'); d.style.cssText = 'margin-top:6px;color:#ffd98a;font-weight:600'; d.textContent = text; return row(d); },
    text(text = '') { const d = document.createElement('div'); d.style.cssText = 'color:#aab;white-space:pre-wrap'; d.textContent = text; row(d); return { set: s => { d.textContent = s; } }; },
    button(label, fn) { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'text-align:left;padding:4px 8px;background:#1a2138;color:#e6ebff;border:1px solid #33406a;border-radius:4px;cursor:pointer;font:12px system-ui'; b.onclick = () => fn(b); return row(b); },
    buttons(labels, fn) { const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px'; for (const l of labels) { const b = document.createElement('button'); b.textContent = l; b.style.cssText = 'padding:3px 7px;background:#1a2138;color:#e6ebff;border:1px solid #33406a;border-radius:4px;cursor:pointer;font:11px system-ui'; b.onclick = () => fn(l, b); d.appendChild(b); } return row(d); },
    slider(label, min, max, value, fn, step = (max - min) / 100) {
      const d = document.createElement('label'); d.style.cssText = 'display:grid;grid-template-columns:1fr 40px;gap:4px;align-items:center';
      d.innerHTML = `<span>${label}</span><span style="text-align:right;color:#8fa0c8"></span><input type="range" style="grid-column:1/3" min="${min}" max="${max}" step="${step}" value="${value}">`;
      const inp = d.querySelector('input'), out = d.querySelectorAll('span')[1];
      const upd = () => { out.textContent = (+inp.value).toFixed(2); fn(+inp.value); }; inp.oninput = upd; out.textContent = (+value).toFixed(2);
      return row(d);
    },
    select(label, options, value, fn) {
      const d = document.createElement('label'); d.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:space-between';
      d.innerHTML = `<span>${label}</span><select style="background:#1a2138;color:#e6ebff;border:1px solid #33406a;border-radius:4px;max-width:150px">${options.map(v => `<option ${v === value ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
      d.querySelector('select').onchange = e => fn(e.target.value); return row(d);
    },
    check(label, value, fn) { const d = document.createElement('label'); d.style.cssText = 'display:flex;gap:6px;align-items:center'; d.innerHTML = `<input type="checkbox" ${value ? 'checked' : ''}><span>${label}</span>`; d.querySelector('input').onchange = e => fn(e.target.checked); return row(d); },
  };

  const frames = [];
  const lab = {
    THREE, scene, renderer, camera, controls, iso, sun, hemi, ground, panel: api, view: o.view, time: 0, paused: false,
    add(...objs) { for (const ob of objs) { scene.add(ob); ob.traverse?.(m => { if (m.isMesh || m.isSkinnedMesh) { m.castShadow = m.castShadow !== false; m.receiveShadow = true; } }); } return objs[0]; },
    onFrame(fn) { frames.push(fn); },
    setLight,
    /** views: iso (the game camera), orbit (free), close (hero close-up), front, side, top */
    setView(name, target = controls.target) {
      lab.view = name;
      const t = target.clone ? target.clone() : new THREE.Vector3(...target);
      controls.enabled = name !== 'iso';
      if (name === 'iso') { iso.zoom = iso.dist = ISO.dist; iso.snap(new THREE.Vector3(t.x, 0, t.z)); }
      else {
        const d = { orbit: [6, 5, 9], close: [0, 0.6, 3.4], front: [0, 1, 7], side: [7, 1, 0], top: [0, 16, 0.01] }[name] || [6, 5, 9];
        camera.position.set(t.x + d[0], t.y + d[1], t.z + d[2]); controls.target.copy(t); camera.fov = name === 'close' ? 30 : ISO.fov; camera.updateProjectionMatrix();
      }
    },
    focus(v) { if (lab.view === 'iso') iso.target.set(v.x, 0, v.z); else controls.target.copy(v); },
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); },
  };
  setLight(o.light);
  lab.setView(o.view, new THREE.Vector3(0, 1, 0));
  api.select('view', ['iso', 'orbit', 'close', 'front', 'side', 'top'], o.view, v => lab.setView(v));
  api.select('light', Object.keys(LIGHTS), o.light, v => setLight(v));
  addEventListener('wheel', e => { if (lab.view === 'iso') iso.zoomBy(e.deltaY * 0.01); }, { passive: true });

  let last = performance.now();
  function tick(dt) {
    lab.time += dt; G.uTime.value = lab.time; G.uCamPos.value.copy(camera.position);
    for (const f of frames) f(dt, lab.time);
    if (lab.view === 'iso') iso.update(dt, lab.time); else controls.update();
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!lab.paused) tick(dt);
    renderer.render(dt, lab.time);
    const i = renderer.r.info;
    stats.textContent = `${renderer.fps.toFixed(0)} fps · ${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__lab = { ready: true, lab };
  return lab;
}
