// Creatures lab: type / variant / action picker, filmstrips, lineups, HORDE (60 mobs charging, fps), mount + rider,
// ship on a flat sea. URL params (all optional):
//   mode=single|lineup|strip|horde|mount|ship|gallery   type=imp   variant=red   act=attack   loop=1
//   speed=m/s turn=rad/s combat=1 fly=1 stunned=1 down=1 dead=1   yaw=deg (creature facing, 180 = toward camera)
//   n=8 (strip copies)  span=s (strip time span)  t=s (advance & freeze)  cam=close|full|head|iso  zoom=1
//   count=60 (horde)  types=imp,hellhound (lineup/gallery)
import * as THREE from 'three';
import { createLab } from './kit.js';
import { G } from '../engine/materials.js';
// Registry: sub-area labs (creatures_<area>.js) copy this file and swap ONLY this import for their own mini-index
// that exports the same names (createCreature, CREATURES, creatureStats; createShip/SHIPS optional).
import * as REG from '../models/creatures/beasts/index.js';
const { createCreature, CREATURES, createShip, creatureStats } = REG;

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const mode = Q.get('mode') || 'single';
const lab = createLab({ title: 'Creatures', view: Q.get('view') || (mode === 'horde' ? 'iso' : 'orbit'), ground: mode === 'ship' ? 'none' : 'stone', light: Q.get('light') || 'day', size: mode === 'horde' ? 80 : 60 });
G.uFogDensity.value = mode === 'ship' ? 0.002 : 0.0008;
const api = (window.__cr = { lab, list: [], stats: creatureStats, CREATURES });
const P = lab.panel;
let type = Q.get('type') || Object.keys(CREATURES).find(t => !CREATURES[t].placeholder) || Object.keys(CREATURES)[0];
// ---- beasts lab extras: zone-like ground (?ground=grass|sand|forest), hero-height reference (?ref=1)
{
  const gk = Q.get('ground');
  const TONES = { grass: ['#6f7a2e', [[70, 38, 34], [58, 45, 30], [80, 50, 42]]], sand: ['#c8ae7e', [[40, 40, 70], [36, 35, 62], [44, 45, 76]]], forest: ['#2e3424', [[80, 25, 18], [100, 22, 22], [60, 20, 14]]] };
  if (gk && TONES[gk] && lab.ground) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = TONES[gk][0]; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { const t = TONES[gk][1][i % 3]; x.fillStyle = `hsla(${t[0] + Math.random() * 14},${t[1]}%,${t[2] + Math.random() * 10}%,0.55)`; const r = 2 + Math.random() * 7; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, r, r * (0.4 + Math.random()), Math.random() * 3, 0, 7); x.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 20); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    lab.ground.material.map = tex; lab.ground.material.needsUpdate = true;
  }
}
function heroRef(x, z) { // 1.85 m capsule "hero" for scale
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x4a6ab0 }), sk = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.0, 4, 10), m); body.position.y = 0.86; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), sk); head.position.y = 1.7; g.add(head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0, z); lab.add(g); return g;
}
let variant = Q.get('variant') || null;
const state = { speed: num('speed', 0), turn: num('turn', 0), combat: Q.get('combat') === '1', fly: Q.get('fly') === '1', stunned: Q.get('stunned') === '1', down: Q.get('down') === '1', dead: Q.get('dead') === '1' };
const yaw = THREE.MathUtils.degToRad(num('yaw', 150));
const info = P.text('');
const setInfo = (s) => info.set(s);

function clear() { for (const it of api.list) it.c.dispose(); api.list.length = 0; }
function add(c, x = 0, z = 0, ry = yaw) { c.root.position.set(x, 0, z); c.root.rotation.y = ry; lab.add(c.root); const it = { c, x, z, t0: 0 }; api.list.push(it); return it; }
function frameCam(h, center = new THREE.Vector3(0, 0, 0), how = Q.get('cam') || 'full') {
  if (lab.view === 'iso') { lab.setView('iso', center); return; }
  const cam = lab.camera, ctr = lab.controls;
  const d = how === 'head' ? h * 1.0 + 0.6 : how === 'close' ? h * 1.9 + 1 : h * 2.6 + 1.6;
  const ty = how === 'head' ? h * 0.8 : h * 0.5;
  const a = THREE.MathUtils.degToRad(num('camYaw', 0)), p = THREE.MathUtils.degToRad(num('camPitch', 14));
  ctr.target.set(center.x, ty, center.z);
  cam.position.set(center.x + Math.sin(a) * Math.cos(p) * d * num('zoom', 1), ty + Math.sin(p) * d * num('zoom', 1), center.z + Math.cos(a) * Math.cos(p) * d * num('zoom', 1));
  cam.fov = 35; cam.updateProjectionMatrix(); ctr.update();
}
api.frame = frameCam;

// ------------------------------------------------------------------------------------------------ single / lineup / strip
function buildSingle() {
  clear();
  const t0 = performance.now();
  const c = createCreature(type, { variant: variant || undefined, elite: Q.get('elite') === '1', seed: num('seed', 0) });
  const ms = performance.now() - t0;
  add(c);
  if (Q.get('ref') === '1') heroRef(-(c.radius + 0.9), 0.3);
  const e = c.entry.stats;
  setInfo(`${type}/${c.variant}  ${e.tris} tris · ${e.verts} v · ${e.bones} bones\nbuild ${e.ms.toFixed(0)} ms (sdf ${e.sdfMs.toFixed(0)}) · inst ${ms.toFixed(1)} ms\nh ${c.height.toFixed(2)} m · r ${c.radius.toFixed(2)} m`);
  frameCam(c.height);
  return c;
}
function buildZoo() { // every beast (default variant) in a row + a hero reference, facing the camera
  clear();
  const types = (Q.get('types') || Object.keys(CREATURES).join(',')).split(',');
  let x = 0; const items = [];
  for (const t of types) { const [tt, v] = t.split(':'); const c = createCreature(tt, { variant: v || undefined }); const w = Math.max(c.radius * 2.2, 0.9); items.push([c, x + w / 2]); x += w + 0.4; }
  for (const [c, px] of items) add(c, px - x / 2, 0);
  heroRef(-x / 2 - 0.8, 0);
  frameCam(Math.max(4.3, x * 0.38));
  setInfo(types.join('  '));
}
function buildLineup() {
  clear();
  const types = (Q.get('types') || type).split(',');
  const specs = [];
  for (const t of types) { const [tt, v] = t.split(':'); if (v) specs.push([tt, v]); else for (const vv of CREATURES[tt].variants) specs.push([tt, vv]); }
  let x = 0; const items = [];
  for (const [t, v] of specs) { const c = createCreature(t, { variant: v }); const w = Math.max(c.radius * 2.6, 0.8); items.push([c, x + w / 2]); x += w + 0.3; }
  let hmax = 0;
  for (const [c, px] of items) { add(c, px - x / 2, 0); hmax = Math.max(hmax, c.height); }
  frameCam(Math.max(hmax, x * 0.38));
  setInfo(specs.map(s => s.join(':')).join('  '));
}
function buildStrip() { // N copies of one action at spread times (frozen)
  clear();
  const n = num('n', 6), act = Q.get('act') || 'attack';
  let x = 0; const items = [];
  for (let i = 0; i < n; i++) { const c = createCreature(type, { variant: variant || undefined }); const w = Math.max(c.radius * 2.4, 0.7) * num('gap', 1); items.push([c, x + w / 2]); x += w; }
  for (const [c, px] of items) add(c, px - x / 2, 0);
  const span = num('span', 0);
  lab.paused = true;
  const dt = 1 / 60;
  api.list.forEach((it, i) => {
    for (let s = 0; s < 30; s++) it.c.update(dt, state);
    const r = it.c.play(act, { loop: Q.get('loop') === '1' });
    const T = (span || r.dur || 1) * i / Math.max(1, n - 1);
    const steps = Math.round(T / dt); for (let s = 0; s < steps; s++) it.c.update(dt, state);
    it.label = T;
  });
  frameCam(Math.max(items[0][0].height, x * 0.36));
  setInfo(`${type} ${act} strip: ${api.list.map(i => i.label.toFixed(2)).join(' ')}`);
}

// ------------------------------------------------------------------------------------------------ horde
function buildHorde() {
  clear();
  const count = num('count', 60);
  const mix = (Q.get('types') || 'wolf:20,boar:16,spider:14,crab:10').split(',').map(s => { const [t, n] = s.split(':'); return [t, +n]; });
  const T0 = performance.now();
  const kinds = [];
  for (const [t, n] of mix) for (let i = 0; i < n && kinds.length < count; i++) kinds.push(t);
  while (kinds.length < count) kinds.push(mix[0][0]);
  const rng = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  kinds.forEach((t, i) => {
    const vs = CREATURES[t].variants.filter(v => !/overseer|alpha|elite|centurion|warlord|duskfang|gnarltusk|broodmother|barnaclaw/.test(v));
    const c = createCreature(t, { variant: vs[i % vs.length], seed: i + 1 });
    const it = add(c, (rng(i, 1) - 0.5) * 24, -14 - rng(i, 2) * 16, 0);
    it.speed = t === 'wolf' ? 5.5 + rng(i, 3) * 1.5 : t === 'boar' ? 4.5 + rng(i, 3) * 1.2 : t === 'treant' ? 1.6 : 3 + rng(i, 3) * 0.8;
    it.phase = 'run'; it.timer = rng(i, 4) * 2; it.dead = false;
  });
  const buildMs = performance.now() - T0;
  lab.setView('iso', new THREE.Vector3(0, 0, 0));
  let upd = 0, frames = 0, acc = 0;
  lab.onFrame((dt) => {
    const t0 = performance.now();
    for (const it of api.list) {
      const c = it.c, r = c.root;
      it.timer -= dt;
      let speed = 0, st = it.st || (it.st = { speed: 0, turn: 0, combat: true, dead: false });
      if (it.phase === 'run') {
        speed = it.speed;
        r.position.z += speed * dt; // charge toward the camera (south)
        r.rotation.y = Math.PI;
        if (r.position.z > 8 + (it.x % 3)) { it.phase = 'fight'; it.timer = 1 + Math.random() * 2; }
      } else if (it.phase === 'fight') {
        if (it.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.35) { c.play('death'); it.phase = 'dead'; it.timer = 2.2; st.dead = true; }
          else { c.play(roll < 0.7 ? 'attack' : roll < 0.85 ? 'attack2' : 'hit'); it.timer = 0.9 + Math.random() * 1.2; }
        }
      } else if (it.phase === 'dead') {
        c.setDissolve(Math.min(1, Math.max(0, (2.2 - it.timer - 1.2) / 1)));
        if (it.timer <= 0) { r.position.set((Math.random() - 0.5) * 24, 0, -18 - Math.random() * 10); st.dead = false; c.setDissolve(0); c.play('spawn'); it.phase = 'rise'; it.timer = 1.4; }
      } else if (it.phase === 'rise') { if (it.timer <= 0) it.phase = 'run'; }
      st.speed = speed;
      c.update(dt, st);
    }
    upd += performance.now() - t0; frames++; acc += dt;
    if (acc > 1) {
      const i = lab.renderer.r.info;
      setInfo(`HORDE ${api.list.length} mobs · ${lab.renderer.fps.toFixed(0)} fps\ncreature update ${(upd / frames).toFixed(2)} ms/frame\n${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris\nbuild ${buildMs.toFixed(0)} ms`);
      api.horde = { fps: lab.renderer.fps, updMs: upd / frames, calls: i.render.calls, tris: i.render.triangles, buildMs };
      upd = 0; frames = 0; acc = 0;
    }
  });
}

// ------------------------------------------------------------------------------------------------ mount
function buildMount() {
  clear();
  const c = createCreature(type === 'imp' ? 'horse' : type, { variant: variant || undefined });
  const it = add(c, 0, 0, 0);
  // placeholder rider: capsule torso + head + legs straddling the saddle
  const rider = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x3a5a9a }), sk = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), m); torso.position.y = 0.5; rider.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), sk); head.position.y = 0.98; rider.add(head);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 4, 6), m); leg.position.set(s * 0.22, 0.05, -0.05); leg.rotation.z = s * 0.35; rider.add(leg); }
  rider.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const sock = c.sockets.rider || c.sockets.back; sock.add(rider);
  const R = 7; let ang = 0;
  const spd = num('speed', 3);
  lab.onFrame((dt) => {
    ang += spd / R * dt;
    c.root.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
    c.root.rotation.y = -ang; // tangent (counter-clockwise)
    c.update(dt, { speed: spd, turn: -spd / R, combat: false });
    if (lab.view === 'iso') lab.focus(c.root.position); else lab.controls.target.lerp(new THREE.Vector3(c.root.position.x, 1.2, c.root.position.z), 0.1);
  });
  frameCam(c.height * 1.6, new THREE.Vector3(R, 0, 0));
  setInfo(`${c.type}/${c.variant} mount · rider socket ${c.sockets.rider ? 'yes' : 'no (back)'}`);
}

// ------------------------------------------------------------------------------------------------ ship
function buildShip() {
  clear();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x2a6a9a }));
  sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; lab.scene.add(sea);
  lab.scene.background = new THREE.Color(0x9ac4e8);
  if (!createShip) return;
  const s = createShip(Q.get('ship') || 'dawnrunner');
  lab.scene.add(s.root);
  const R = num('radius', 30); let ang = 0; const spd = num('speed', 4);
  const circle = Q.get('circle') !== '0';
  lab.onFrame((dt) => {
    if (circle) { ang += spd / R * dt; s.root.position.set(Math.cos(ang) * R - R, 0, Math.sin(ang) * R); s.root.rotation.y = -ang; }
    s.update(dt, { speed: spd, turn: circle ? -spd / R : 0, sail: num('sail', 1) });
    if (lab.view === 'iso') lab.focus(s.root.position); else lab.controls.target.lerp(s.root.position.clone().setY(4), 0.1);
  });
  api.ship = s;
  P.buttons(['fire L', 'fire R'], (l) => s.fire(l.endsWith('L') ? 'L' : 'R'));
  lab.camera.position.set(-30, 14, 26); lab.controls.target.set(0, 4, 0); lab.controls.update();
  setInfo(`${Q.get('ship') || 'dawnrunner'}`);
}

// ------------------------------------------------------------------------------------------------ gallery: every type in a grid
function buildGallery() {
  clear();
  const types = (Q.get('types') || Object.keys(CREATURES).join(',')).split(',');
  const cols = Math.ceil(Math.sqrt(types.length * 1.6));
  types.forEach((t, i) => {
    const c = createCreature(t, {});
    const x = (i % cols - (cols - 1) / 2) * 3, z = (Math.floor(i / cols)) * 3.2 - 6;
    add(c, x, z, Math.PI - 0.4);
  });
  frameCam(8, new THREE.Vector3(0, 0, 0));
}

// ------------------------------------------------------------------------------------------------ panel
if (mode === 'single' || mode === 'strip' || mode === 'lineup') {
  P.select('type', Object.keys(CREATURES), type, v => { type = v; variant = null; rebuild(); refreshActs(); });
  const vsel = P.select('variant', CREATURES[type].variants, variant || CREATURES[type].variants[0], v => { variant = v; rebuild(); });
  P.label('actions');
  let actRow = null;
  const refreshActs = () => {
    actRow?.remove();
    actRow = P.buttons(['idle', ...CREATURES[type].actions], (a) => { for (const it of api.list) { const r = it.c.play(a); setInfo(`${a}: dur ${r.dur?.toFixed(2)}${r.hit !== undefined ? ' hit ' + r.hit.toFixed(2) : ''}`); } });
    vsel.querySelector('select').innerHTML = CREATURES[type].variants.map(v => `<option>${v}</option>`).join('');
  };
  refreshActs();
  P.slider('speed', -2, 12, state.speed, v => { state.speed = v; });
  P.slider('turn', -2, 2, state.turn, v => { state.turn = v; });
  for (const k of ['combat', 'fly', 'stunned', 'down', 'dead']) P.check(k, state[k], v => { state[k] = v; });
  P.button('horde', () => { location.search = '?mode=horde'; });
  P.button('mount', () => { location.search = '?mode=mount&type=horse'; });
  P.button('ship', () => { location.search = '?mode=ship'; });
}
function rebuild() { if (mode === 'lineup') buildLineup(); else if (mode === 'strip') buildStrip(); else buildSingle(); }

({ single: buildSingle, lineup: buildLineup, strip: buildStrip, horde: buildHorde, mount: buildMount, ship: buildShip, gallery: buildGallery, zoo: buildZoo })[mode]?.();

if (mode === 'single' || mode === 'lineup' || mode === 'gallery' || mode === 'zoo') {
  lab.onFrame((dt) => {
    for (const it of api.list) {
      if (state.speed || state.turn) { const r = it.c.root; r.rotation.y += state.turn * dt; if (Q.get('move') === '1') { r.position.x -= Math.sin(r.rotation.y) * state.speed * dt; r.position.z -= Math.cos(r.rotation.y) * state.speed * dt; } }
      it.c.update(dt, state);
    }
  });
  const act = Q.get('act');
  if (act && !Q.has('t')) setTimeout(() => { for (const it of api.list) it.c.play(act, { loop: Q.get('loop') === '1' }); }, num('delay', 300));
}
// deterministic capture: ?t=1.2 → play act at 0, advance t seconds with fixed steps, freeze
if (Q.has('t') && mode !== 'strip') {
  lab.paused = true;
  const dt = 1 / 60;
  for (let s = 0; s < 30; s++) for (const it of api.list) it.c.update(dt, state);
  const act = Q.get('act');
  if (act) for (const it of api.list) it.c.play(act, { loop: Q.get('loop') === '1' });
  const steps = Math.round(num('t', 0) / dt);
  for (let s = 0; s < steps; s++) { G.uTime.value += dt; for (const it of api.list) it.c.update(dt, state); }
}
api.step = (sec, dt = 1 / 60) => { for (let s = 0; s < Math.round(sec / dt); s++) { G.uTime.value += dt; for (const it of api.list) it.c.update(dt, state); } };
api.state = state;
