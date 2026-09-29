// Wild creatures lab (sea monsters + critters): a copy of src/lab/creatures.js wired to the wild registry, plus a water
// plane for sea types, a sea-encounter scene and an ambient meadow. URL params (all optional):
//   mode=single|lineup|strip|horde|gallery|sea|meadow   type=sea_serpent   variant=abyssal   act=attack   loop=1
//   speed=m/s turn=rad/s combat=1 fly=1 stunned=1 down=1 dead=1   yaw=deg (creature facing, 180 = toward camera)
//   n=8 (strip copies)  span=s (strip time span)  gap=1 (strip spacing ×)  t=s (advance & freeze)  cam=close|full|head
//   zoom=1 camYaw camPitch   water=game|clear|none (default: game water for sea types)   ship=1 (ship stand-in)
//   marks=1 (show sockets)   count (meadow)   types=a,b (lineup/gallery)
import * as THREE from 'three';
import { createLab } from './kit.js';
import { G } from '../engine/materials.js';
import { buildWater } from '../world/water.js';
import { createShip } from '../models/creatures/ships.js';
// Registry: sub-area labs (creatures_<area>.js) copy this file and swap ONLY this import for their own mini-index
// that exports the same names (createCreature, CREATURES, creatureStats; createShip/SHIPS optional).
import * as REG from '../models/creatures/wild/index.js';
const { createCreature, CREATURES, creatureStats } = REG;

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const mode = Q.get('mode') || 'single';
const SEA = new Set(['sea_serpent', 'kraken_tentacle', 'fish']);
let type = Q.get('type') || Object.keys(CREATURES).find(t => !CREATURES[t].placeholder) || Object.keys(CREATURES)[0];
const wet = mode === 'sea' || (mode !== 'meadow' && mode !== 'gallery' && SEA.has(type));
const waterMode = Q.get('water') || (wet ? 'game' : 'none');
const lab = createLab({ title: 'Wild creatures', view: Q.get('view') || (mode === 'meadow' || mode === 'sea' ? 'iso' : 'orbit'), ground: waterMode !== 'none' ? 'none' : 'stone', light: Q.get('light') || 'day', size: 80 });
G.uFogDensity.value = waterMode !== 'none' ? 0.0012 : 0.0008;
const api = (window.__cr = { lab, list: [], stats: creatureStats, CREATURES });
const P = lab.panel;
let variant = Q.get('variant') || null;
const state = { speed: num('speed', 0), turn: num('turn', 0), combat: Q.get('combat') === '1', fly: Q.get('fly') === '1', stunned: Q.get('stunned') === '1', down: Q.get('down') === '1', dead: Q.get('dead') === '1' };
const yaw = THREE.MathUtils.degToRad(num('yaw', 150));
const info = P.text('');
const setInfo = (s) => info.set(s);

// ------------------------------------------------------------------------------------------------ water
if (waterMode !== 'none') {
  const w = buildWater(null, { x: 0, z: 0, w: 260, d: 260, level: 0, swell: 0.04, seg: 2 });
  if (waterMode === 'clear') { // see-through: judge the underwater parts
    w.material.uniforms.uShallow.value.set(0x5fc8c8); w.material.uniforms.uDeep.value.set(0x2a7a9a);
    w.material.fragmentShader = w.material.fragmentShader.replace('gl_FragColor = vec4(col, alpha);', 'gl_FragColor = vec4(col, 0.42);');
  }
  lab.scene.add(w);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x1c4a5a }));
  bed.rotation.x = -Math.PI / 2; bed.position.y = -14; lab.scene.add(bed);
  lab.scene.background = new THREE.Color(0x9cc6e6);
  api.water = w;
}

function clear() { for (const it of api.list) it.c.dispose(); api.list.length = 0; }
function add(c, x = 0, z = 0, ry = yaw) { c.root.position.set(x, 0, z); c.root.rotation.y = ry; lab.add(c.root); const it = { c, x, z, t0: 0 }; api.list.push(it); if (Q.get('marks') === '1') marks(c); return it; }
function marks(c) {
  const cols = { head: 0xffff00, mouth: 0xff3030, center: 0x30ff30, back: 0x3090ff, grip: 0xff40ff, tip: 0xffffff };
  for (const [k, o] of Object.entries(c.sockets)) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, c.height * 0.012), 8, 6), new THREE.MeshBasicMaterial({ color: cols[k] ?? 0xff9020, depthTest: false }));
    m.renderOrder = 10; o.add(m);
  }
}
function frameCam(h, center = new THREE.Vector3(0, 0, 0), how = Q.get('cam') || 'full') {
  const fs = Q.get('focus'), it0 = api.list[0];
  if (fs && it0 && it0.c.sockets[fs]) { // aim at a socket (after posing the creature once)
    it0.c.update(1 / 60, state); it0.c.root.updateMatrixWorld(true);
    const p = it0.c.sockets[fs].getWorldPosition(new THREE.Vector3());
    center = new THREE.Vector3(p.x, 0, p.z); h = p.y / (how === 'head' ? 0.8 : 0.5);
    if (lab.view !== 'iso') { const d = num('dist', 3); const a = THREE.MathUtils.degToRad(num('camYaw', 0)), pp = THREE.MathUtils.degToRad(num('camPitch', 10)); lab.controls.target.copy(p); lab.camera.position.set(p.x + Math.sin(a) * Math.cos(pp) * d, p.y + Math.sin(pp) * d, p.z + Math.cos(a) * Math.cos(pp) * d); lab.camera.fov = 35; lab.camera.near = 0.02; lab.camera.updateProjectionMatrix(); lab.controls.update(); return; }
  }
  if (lab.view === 'iso') { lab.setView('iso', center); return; }
  const cam = lab.camera, ctr = lab.controls;
  const d = how === 'head' ? h * 1.0 + 0.6 : how === 'close' ? h * 1.9 + 1 : h * 2.6 + 1.6;
  const ty = (how === 'head' ? h * 0.8 : h * 0.5) + num('camY', 0);
  const a = THREE.MathUtils.degToRad(num('camYaw', 0)), p = THREE.MathUtils.degToRad(num('camPitch', 14));
  ctr.target.set(center.x + num('camX', 0), ty, center.z + num('camZ', 0));
  cam.position.set(ctr.target.x + Math.sin(a) * Math.cos(p) * d * num('zoom', 1), ty + Math.sin(p) * d * num('zoom', 1), ctr.target.z + Math.cos(a) * Math.cos(p) * d * num('zoom', 1));
  cam.fov = 35; cam.near = Math.max(0.01, d * 0.01); cam.updateProjectionMatrix(); ctr.update();
}
api.frame = frameCam;
let shipObj = null;
function addShip(x = 0, z = 0, ry = 0) {
  if (shipObj) return shipObj;
  const s = createShip('dawnrunner'); s.root.position.set(x, 0, z); s.root.rotation.y = ry; lab.add(s.root); shipObj = s; return s;
}

// ------------------------------------------------------------------------------------------------ single / lineup / strip
function buildSingle() {
  clear();
  const t0 = performance.now();
  const c = createCreature(type, { variant: variant || undefined, elite: Q.get('elite') === '1', seed: num('seed', 0) });
  const ms = performance.now() - t0;
  add(c);
  const e = c.entry.stats;
  setInfo(`${type}/${c.variant}  ${e.tris} tris · ${e.verts} v · ${e.bones} bones\nbuild ${e.ms.toFixed(0)} ms (sdf ${e.sdfMs.toFixed(0)}) · inst ${ms.toFixed(1)} ms\nh ${c.height.toFixed(2)} m · r ${c.radius.toFixed(2)} m`);
  if (Q.get('ship') === '1') addShip(num('shipX', 0), num('shipZ', -9), Math.PI / 2);
  frameCam(c.height);
  return c;
}
function buildLineup() {
  clear();
  const types = (Q.get('types') || type).split(',');
  const specs = [];
  for (const t of types) { const [tt, v] = t.split(':'); if (v) specs.push([tt, v]); else for (const vv of CREATURES[tt].variants) specs.push([tt, vv]); }
  let x = 0; const items = [];
  for (const [t, v] of specs) { const c = createCreature(t, { variant: v }); const w = Math.max(c.radius * 2.6, 0.25) * num('gap', 1); items.push([c, x + w / 2]); x += w + 0.1 * num('gap', 1); }
  let hmax = 0;
  for (const [c, px] of items) { add(c, px - x / 2, 0); hmax = Math.max(hmax, c.height); }
  frameCam(Math.max(hmax, x * 0.38));
  setInfo(specs.map(s => s.join(':')).join('  '));
}
function buildStrip() { // N copies of one action at spread times (frozen)
  clear();
  const n = num('n', 6), act = Q.get('act') || 'attack';
  let x = 0; const items = [];
  for (let i = 0; i < n; i++) { const c = createCreature(type, { variant: variant || undefined }); const w = Math.max(c.radius * 2.4, 0.2) * num('gap', 1); items.push([c, x + w / 2]); x += w; }
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

// ------------------------------------------------------------------------------------------------ horde (perf: many critters)
function buildHorde() {
  clear();
  const count = num('count', 60);
  const types = (Q.get('types') || 'rabbit,cat,chicken,bird,seagull,butterfly').split(',');
  const T0 = performance.now();
  const rng = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length], vs = CREATURES[t].variants;
    const c = createCreature(t, { variant: vs[i % vs.length], seed: i + 1 });
    const it = add(c, (rng(i, 1) - 0.5) * 16, (rng(i, 2) - 0.5) * 12, rng(i, 3) * 6.28);
    it.st = { speed: 0, turn: 0, fly: t === 'butterfly' || (t !== 'chicken' && CREATURES[t].flying && rng(i, 5) < 0.4) };
    it.timer = rng(i, 4) * 2;
  }
  const buildMs = performance.now() - T0;
  lab.setView('iso', new THREE.Vector3(0, 0, 0));
  let upd = 0, frames = 0, acc = 0;
  lab.onFrame((dt) => {
    const t0 = performance.now();
    for (const it of api.list) wander(it, dt, 7);
    upd += performance.now() - t0; frames++; acc += dt;
    if (acc > 1) {
      const i = lab.renderer.r.info;
      setInfo(`HORDE ${api.list.length} critters · ${lab.renderer.fps.toFixed(0)} fps\nupdate ${(upd / frames).toFixed(2)} ms/frame\n${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris\nbuild ${buildMs.toFixed(0)} ms`);
      api.horde = { fps: lab.renderer.fps, updMs: upd / frames, calls: i.render.calls, tris: i.render.triangles, buildMs };
      upd = 0; frames = 0; acc = 0;
    }
  });
}
// simple ambient wander AI: walk/hop about, idle actions, flyers take off and land
function wander(it, dt, R = 8) {
  const c = it.c, r = c.root, st = it.st, ty = c.type;
  it.timer -= dt;
  if (it.timer <= 0) {
    const roll = Math.random();
    const acts = CREATURES[ty].actions.filter(a => !/death|hit|spawn|flee|submerge|emerge|flop/.test(a));
    if (roll < 0.45) { st.speed = 0; st.turn = 0; if (acts.length && Math.random() < 0.7) c.play(acts[(Math.random() * acts.length) | 0]); it.timer = 1.5 + Math.random() * 3; }
    else { st.speed = (ty === 'butterfly' ? 0.6 : ty === 'seagull' && st.fly ? 3.5 : ty === 'bird' && st.fly ? 3 : 0.5) * (0.6 + Math.random() * 0.8); st.turn = (Math.random() - 0.5) * 1.2; it.timer = 1 + Math.random() * 2.5; c.stop(); }
    if (ty !== 'butterfly' && CREATURES[ty].flying && Math.random() < 0.15) st.fly = !st.fly;
  }
  const d = Math.hypot(r.position.x, r.position.z);
  if (d > R) { const want = Math.atan2(r.position.x, r.position.z); let e = want - r.rotation.y; e = Math.atan2(Math.sin(e), Math.cos(e)); st.turn = Math.sign(e) * 1.5; if (!st.speed) st.speed = 0.5; }
  r.rotation.y += st.turn * dt;
  r.position.x -= Math.sin(r.rotation.y) * st.speed * dt; r.position.z -= Math.cos(r.rotation.y) * st.speed * dt;
  c.update(dt, st);
}

// ------------------------------------------------------------------------------------------------ meadow: ambient life at the game camera
function buildMeadow() {
  clear();
  const n = num('count', 18);
  const mix = (Q.get('types') || 'rabbit:3,cat:2,chicken:4,bird:4,seagull:2,butterfly:4').split(',').map(s => { const [t, k] = s.split(':'); return [t, +k]; });
  let i = 0;
  for (const [t, k] of mix) for (let j = 0; j < k && i < n * 3; j++, i++) {
    const vs = CREATURES[t].variants;
    const c = createCreature(t, { variant: vs[j % vs.length], seed: i + 1 });
    const it = add(c, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, Math.random() * 6.28);
    it.st = { speed: 0, turn: 0, fly: t === 'butterfly' };
    it.timer = Math.random() * 2;
  }
  lab.setView('iso', new THREE.Vector3(0, 0, 0));
  lab.onFrame((dt) => { for (const it of api.list) wander(it, dt, 6); });
}

// ------------------------------------------------------------------------------------------------ sea: a sea-bounty encounter around the ship
function buildSea() {
  clear();
  const ship = addShip(0, 0, 0);
  const serp = createCreature('sea_serpent', { variant: Q.get('variant') || undefined });
  const s = add(serp, -11, -3, -Math.PI / 2 + 0.3); s.script = ['attack', 'roar', 'attack2', 'attack_big', 'spit', 'hit'];
  const tents = [];
  for (let k = 0; k < 3; k++) {
    const tc = createCreature('kraken_tentacle', { variant: k === 2 ? 'violet' : undefined, seed: k + 3 });
    const it = add(tc, 5.5 + (k === 1 ? 1.5 : 0), -6 + k * 5, Math.PI / 2 + (k - 1) * 0.3); it.script = ['attack', 'grab', 'attack_big', 'hit', 'idle_alt'];
    tents.push(it);
  }
  for (let k = 0; k < 3; k++) { const g = createCreature('seagull', { seed: k + 9 }); const it = add(g, (k - 1) * 4, 4 + k, k); it.st = { speed: 4, turn: 0.7, fly: true }; it.gull = true; }
  for (let k = 0; k < 4; k++) { const f = createCreature('fish', { seed: k + 20 }); const it = add(f, -4 + k * 2.5, 9 + (k % 2), k * 1.3); it.st = { speed: 0.6, turn: 0.4 }; it.fish = true; }
  lab.setView('iso', new THREE.Vector3(-3, 0, -2));
  if (Q.get('view') === 'orbit') { lab.setView('orbit', new THREE.Vector3(-4, 2, -2)); lab.camera.position.set(-6, 16, 24); lab.controls.update(); }
  let T = 0;
  lab.onFrame((dt) => {
    T += dt;
    for (const it of api.list) {
      const c = it.c;
      if (it.gull || it.fish) { const r = c.root; r.rotation.y += it.st.turn * dt; r.position.x -= Math.sin(r.rotation.y) * it.st.speed * dt; r.position.z -= Math.cos(r.rotation.y) * it.st.speed * dt; if (it.gull) r.position.y = 5; c.update(dt, it.st); if (it.fish && Math.random() < dt * 0.15) c.play('jump'); continue; }
      it.timer = (it.timer ?? 1 + Math.random() * 2) - dt;
      if (it.timer <= 0 && it.script && !Q.has('act')) { const a = it.script[(it.k = ((it.k ?? -1) + 1) % it.script.length)]; const r = c.play(a); it.timer = (r.dur || 1) + 0.8 + Math.random() * 1.5; }
      c.update(dt, { combat: true });
    }
  });
  setInfo('sea encounter: serpent + 3 tentacles around the ship');
}

// ------------------------------------------------------------------------------------------------ gallery: every type in a row, sized by radius
function buildGallery() {
  clear();
  const types = (Q.get('types') || Object.keys(CREATURES).join(',')).split(',');
  let x = 0; const items = [];
  for (const t of types) { const c = createCreature(t, {}); const w = Math.max(c.radius * 2.4, 0.5); items.push([c, x + w / 2]); x += w + 0.3; }
  for (const [c, px] of items) add(c, px - x / 2, 0, Math.PI - 0.4);
  frameCam(Math.max(3, x * 0.3), new THREE.Vector3(0, 0, 0));
}

// ------------------------------------------------------------------------------------------------ panel
if (mode === 'single' || mode === 'strip' || mode === 'lineup') {
  P.select('type', Object.keys(CREATURES), type, v => { type = v; variant = null; rebuild(); refreshActs(); });
  const vsel = P.select('variant', CREATURES[type].variants, variant || CREATURES[type].variants[0], v => { variant = v; rebuild(); });
  P.label('actions');
  let actRow = null;
  const refreshActs = () => {
    actRow?.remove();
    actRow = P.buttons(['idle', ...CREATURES[type].actions], (a) => { for (const it of api.list) { const r = it.c.play(a); setInfo(`${a}: dur ${r.dur?.toFixed(2)}${r.hit !== undefined ? ' hit ' + r.hit.toFixed(2) : ''}${r.hits ? ' hits ' + r.hits.map(h => h.toFixed(2)).join(',') : ''}`); } });
    vsel.querySelector('select').innerHTML = CREATURES[type].variants.map(v => `<option>${v}</option>`).join('');
  };
  refreshActs();
  P.slider('speed', -2, 12, state.speed, v => { state.speed = v; });
  P.slider('turn', -2, 2, state.turn, v => { state.turn = v; });
  for (const k of ['combat', 'fly', 'stunned', 'down', 'dead']) P.check(k, state[k], v => { state[k] = v; });
  P.button('sea encounter', () => { location.search = '?mode=sea'; });
  P.button('meadow', () => { location.search = '?mode=meadow'; });
  P.button('horde (60 critters)', () => { location.search = '?mode=horde'; });
}
function rebuild() { if (mode === 'lineup') buildLineup(); else if (mode === 'strip') buildStrip(); else buildSingle(); }

({ single: buildSingle, lineup: buildLineup, strip: buildStrip, horde: buildHorde, gallery: buildGallery, sea: buildSea, meadow: buildMeadow })[mode]?.();

if (mode === 'single' || mode === 'lineup' || mode === 'gallery') {
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
  for (let s = 0; s < 30; s++) for (const it of api.list) it.c.update(dt, it.st || state);
  const act = Q.get('act');
  if (act) for (const it of api.list) it.c.play(act, { loop: Q.get('loop') === '1' });
  const steps = Math.round(num('t', 0) / dt);
  for (let s = 0; s < steps; s++) { G.uTime.value += dt; lab.time += dt; for (const it of api.list) it.c.update(dt, it.st || state); }
}
api.step = (sec, dt = 1 / 60) => { for (let s = 0; s < Math.round(sec / dt); s++) { G.uTime.value += dt; for (const it of api.list) it.c.update(dt, it.st || state); } };
api.state = state;
// per-frame allocation probe: api.allocProbe(type, frames) → bytes allocated per update (Chrome performance.memory)
api.perf = (n = 600) => { const t0 = performance.now(); for (let s = 0; s < n; s++) for (const it of api.list) it.c.update(1 / 60, it.st || state); return (performance.now() - t0) / n / Math.max(1, api.list.length); };
