// Creatures lab — MOUNTS & PETS sub-area copy of creatures.js (registry swapped to mounts/index.js) with extras:
//   mode=mount   placeholder capsule rider on the `rider` socket, circling (radius=7) at `speed`; deterministic with t=…;
//                the camera follows (cam=close|full|head with camYaw relative to the mount's right side, or view=iso)
//   mode=pets    a capsule "player" walks / runs / stops along waypoints; every pet follows (steering → speed/turn),
//                auto-loot: sparkling loot drops appear, the nearest pet trots over and plays `pickup`
//   mode=ride    like mount but along a straight line (speed ramps walk → trot → canter → gallop with ramp=1)
// Everything else as creatures.js: mode=single|lineup|strip|gallery, type, variant, act, t, yaw, speed, cam, zoom…
import * as THREE from 'three';
import { createLab } from './kit.js';
import { G } from '../engine/materials.js';
// Registry: sub-area labs (creatures_<area>.js) copy this file and swap ONLY this import for their own mini-index
// that exports the same names (createCreature, CREATURES, creatureStats; createShip/SHIPS optional).
import * as REG from '../models/creatures/mounts/index.js';
const { createCreature, CREATURES, createShip, creatureStats } = REG;

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const mode = Q.get('mode') || 'single';
const lab = createLab({ title: 'Mounts & Pets', view: Q.get('view') || (mode === 'horde' ? 'iso' : 'orbit'), ground: mode === 'ship' ? 'none' : 'stone', light: Q.get('light') || 'day', size: mode === 'horde' || mode === 'ride' ? 120 : 60 });
G.uFogDensity.value = mode === 'ship' ? 0.002 : 0.0008;
const api = (window.__cr = { lab, list: [], stats: creatureStats, CREATURES });
const P = lab.panel;
let type = Q.get('type') || Object.keys(CREATURES).find(t => !CREATURES[t].placeholder) || Object.keys(CREATURES)[0];
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
  const ty = num('camY', how === 'head' ? h * 0.8 : h * 0.5);
  const a = THREE.MathUtils.degToRad(num('camYaw', 0)), p = THREE.MathUtils.degToRad(num('camPitch', 14));
  ctr.target.set(center.x, ty, center.z);
  cam.position.set(center.x + Math.sin(a) * Math.cos(p) * d * num('zoom', 1), ty + Math.sin(p) * d * num('zoom', 1), center.z + Math.cos(a) * Math.cos(p) * d * num('zoom', 1));
  cam.fov = 35; cam.updateProjectionMatrix(); ctr.update();
}
api.frame = frameCam;
/** follow camera for moving subjects: offset around the subject, yaw relative to its facing (camYaw 90 = its right side) */
function followCam(root, h, how = Q.get('cam') || 'full') {
  if (lab.view === 'iso') { lab.focus(root.position); return; }
  const cam = lab.camera, ctr = lab.controls;
  const d = (how === 'head' ? h * 1.0 + 0.6 : how === 'close' ? h * 1.9 + 1 : h * 2.6 + 1.6) * num('zoom', 1);
  const ty = how === 'head' ? h * 0.8 : h * 0.5;
  const a = root.rotation.y + THREE.MathUtils.degToRad(num('camYaw', 90)), p = THREE.MathUtils.degToRad(num('camPitch', 14));
  ctr.target.set(root.position.x, ty, root.position.z);
  cam.position.set(root.position.x + Math.sin(a) * Math.cos(p) * d, ty + Math.sin(p) * d, root.position.z + Math.cos(a) * Math.cos(p) * d);
  if (cam.fov !== 35) { cam.fov = 35; cam.updateProjectionMatrix(); }
  cam.lookAt(ctr.target);
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
  frameCam(c.height);
  if (Q.get('rider') === '1' && (c.sockets.rider)) c.sockets.rider.add(makeRider());
  return c;
}
function buildLineup() {
  clear();
  const types = (Q.get('types') || type).split(',');
  const specs = [];
  for (const t of types) { const [tt, v] = t.split(':'); if (v) specs.push([tt, v]); else for (const vv of CREATURES[tt].variants) specs.push([tt, vv]); }
  let x = 0; const items = [];
  for (const [t, v] of specs) { const c = createCreature(t, { variant: v }); const w = Math.max(c.radius * 2.6, 0.8) * num('gap', 1); items.push([c, x + w / 2]); x += w + 0.3; }
  let hmax = 0;
  for (const [c, px] of items) { add(c, px - x / 2, 0); hmax = Math.max(hmax, c.height); if (Q.get('rider') === '1' && c.sockets.rider) c.sockets.rider.add(makeRider()); }
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
    const r = act === 'idle' ? { dur: 1 } : it.c.play(act, { loop: Q.get('loop') === '1' });
    const T = (span || r.dur || 1) * i / Math.max(1, n - 1);
    const steps = Math.round(T / dt); for (let s = 0; s < steps; s++) it.c.update(dt, state);
    it.label = T;
    if (Q.get('rider') === '1' && it.c.sockets.rider) it.c.sockets.rider.add(makeRider());
  });
  frameCam(Math.max(items[0][0].height, x * 0.36));
  setInfo(`${type} ${act} strip: ${api.list.map(i => i.label.toFixed(2)).join(' ')}`);
}

// ------------------------------------------------------------------------------------------------ horde
function buildHorde() {
  clear();
  const count = num('count', 60);
  const mix = (Q.get('types') || Object.keys(CREATURES).map(t => t + ':10').join(',')).split(',').map(s => { const [t, n] = s.split(':'); return [t, +n]; });
  const T0 = performance.now();
  const kinds = [];
  for (const [t, n] of mix) for (let i = 0; i < n && kinds.length < count; i++) kinds.push(t);
  while (kinds.length < count) kinds.push(mix[0][0]);
  const rng = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  kinds.forEach((t, i) => {
    const vs = CREATURES[t].variants;
    const c = createCreature(t, { variant: vs[i % vs.length], seed: i + 1 });
    const it = add(c, (rng(i, 1) - 0.5) * 24, -14 - rng(i, 2) * 16, 0);
    it.speed = 3 + rng(i, 3) * 4;
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
      let speed = 0; const st = it.st || (it.st = { speed: 0, turn: 0, combat: false, dead: false });
      if (it.phase === 'run') {
        speed = it.speed; r.position.z += speed * dt; r.rotation.y = Math.PI;
        if (r.position.z > 8 + (it.x % 3)) { it.phase = 'idle'; it.timer = 1 + Math.random() * 2; }
      } else if (it.phase === 'idle') {
        if (it.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.3) { c.play('death'); it.phase = 'dead'; it.timer = 2.4; st.dead = true; }
          else { const acts = CREATURES[c.type].actions.filter(a => a !== 'death' && a !== 'sleep' && a !== 'sit'); c.play(acts[Math.floor(Math.random() * acts.length)]); it.timer = 1.5 + Math.random() * 1.5; }
        }
      } else if (it.phase === 'dead') {
        c.setDissolve(Math.min(1, Math.max(0, (2.4 - it.timer - 1.3) / 1)));
        if (it.timer <= 0) { r.position.set((Math.random() - 0.5) * 24, 0, -18 - Math.random() * 10); st.dead = false; c.setDissolve(0); c.play('spawn'); it.phase = 'rise'; it.timer = 1.6; }
      } else if (it.phase === 'rise') { if (it.timer <= 0) it.phase = 'run'; }
      st.speed = speed;
      c.update(dt, st);
    }
    upd += performance.now() - t0; frames++; acc += dt;
    if (acc > 1) {
      const i = lab.renderer.r.info;
      setInfo(`HORDE ${api.list.length} · ${lab.renderer.fps.toFixed(0)} fps\ncreature update ${(upd / frames).toFixed(2)} ms/frame\n${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tris\nbuild ${buildMs.toFixed(0)} ms`);
      api.horde = { fps: lab.renderer.fps, updMs: upd / frames, calls: i.render.calls, tris: i.render.triangles, buildMs };
      upd = 0; frames = 0; acc = 0;
    }
  });
}

// ------------------------------------------------------------------------------------------------ mount / ride
/** placeholder rider: capsule torso + head + legs straddling the saddle (same as the main creatures lab) */
function makeRider() {
  const rider = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x3a5a9a }), sk = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), m); torso.position.y = 0.5; rider.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), sk); head.position.y = 0.98; rider.add(head);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 4, 6), m); leg.position.set(s * 0.22, 0.05, -0.05); leg.rotation.z = s * 0.35; rider.add(leg); }
  rider.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return rider;
}
function buildMount(straight = false) {
  clear();
  const c = createCreature(CREATURES[type] ? type : 'horse', { variant: variant || undefined, seed: num('seed', 0) });
  add(c, 0, 0, 0);
  const sock = c.sockets.rider || c.sockets.back; if (Q.get('rider') !== '0') sock.add(makeRider());
  const R = num('radius', 7); let ang = 0, dist = 0, time = 0;
  const spd0 = num('speed', 3), ramp = Q.get('ramp') === '1';
  const st = { speed: spd0, turn: 0, combat: Q.get('combat') === '1' };
  api.setSpeed = (v) => { api.spd = v; };
  api.spd = spd0;
  const stepMount = (dt) => {
    time += dt;
    const spd = ramp ? Math.min(11, 0.5 + time * 0.9) : api.spd;
    st.speed = spd;
    if (straight) {
      dist += spd * dt;
      c.root.position.set(0, 0, 40 - dist % 80); c.root.rotation.y = 0; st.turn = 0;
    } else {
      ang += spd / R * dt;
      // CCW circle: velocity (−sin a, cos a) → facing π − a (the main lab uses −a, which runs the mount backwards)
      c.root.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      c.root.rotation.y = Math.PI - ang; st.turn = -spd / R;
    }
    c.update(dt, st);
  };
  api.stepMount = stepMount; api.mountState = st;
  lab.onFrame((dt) => { stepMount(dt); followCam(c.root, c.height * 1.3); });
  stepMount(0);
  followCam(c.root, c.height * 1.3);
  setInfo(`${c.type}/${c.variant} mount · rider socket ${c.sockets.rider ? 'yes' : 'no (back)'} · ${c.entry.stats.tris} tris`);
  api.mount = c;
  // deterministic capture
  if (Q.has('t')) {
    lab.paused = true;
    const dt = 1 / 60, steps = Math.round(num('t', 0) / dt);
    for (let s = 0; s < steps; s++) { G.uTime.value += dt; stepMount(dt); }
    if (Q.get('act')) { c.play(Q.get('act')); const s2 = Math.round(num('at', 0) / dt); for (let s = 0; s < s2; s++) { G.uTime.value += dt; stepMount(dt); } }
    followCam(c.root, c.height * 1.3);
    if (lab.view === 'iso') lab.iso.snap(new THREE.Vector3(c.root.position.x, 0, c.root.position.z));
  }
}

// ------------------------------------------------------------------------------------------------ pets follow a player
function buildPets() {
  clear();
  const types = (Q.get('types') || Object.keys(CREATURES).filter(t => CREATURES[t].pet).join(',')).split(',').filter(t => CREATURES[t]);
  // player capsule
  const player = new THREE.Group();
  const pm = new THREE.MeshLambertMaterial({ color: 0x3a5a9a }), sk = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 10), pm); body.position.y = 0.78; player.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), sk); head.position.y = 1.62; player.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), sk); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 1.6, -0.2); player.add(nose);
  player.traverse(o => { if (o.isMesh) o.castShadow = true; });
  lab.add(player);
  const pets = types.map((t, i) => {
    const vs = CREATURES[t].variants, v = Q.get('variant') || vs[(i + num('vi', 0)) % vs.length];
    const c = createCreature(t, { variant: v });
    const it = add(c, (i - 1) * 1.2, 2, Math.PI);
    it.slot = [(i - (types.length - 1) / 2) * 1.1, 1.3 + 0.35 * (i % 2)]; it.facing = Math.PI; it.speed = 0; it.st = { speed: 0, turn: 0, fly: false };
    return it;
  });
  // loot drops for auto-loot
  const lootGeo = new THREE.OctahedronGeometry(0.1, 0), lootMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.5) });
  const loots = [];
  // player path: waypoints with speeds (walk 2 / run 5.2 / stop)
  const way = [[0, 0, 0], [0, -8, 5.2], [6, -12, 5.2], [6, -12, 0], [10, -6, 2], [4, 2, 5.2], [4, 2, 0], [-6, 4, 2], [-8, -4, 5.2], [0, 0, 2]];
  let wi = 1, pause = 0, time = 0, nextLoot = 3;
  const pl = { x: 0, z: 0, f: Math.PI, v: 0 };
  const step = (dt) => {
    time += dt;
    // --- player
    const [tx, tz, ts] = way[wi];
    const dx = tx - pl.x, dz = tz - pl.z, d = Math.hypot(dx, dz);
    let vt = 0;
    if (pause > 0) { pause -= dt; }
    else if (d < 0.3) { if (ts === 0) pause = 2.5; wi = (wi + 1) % way.length; }
    else { vt = ts || 2; const want = Math.atan2(-dx, -dz); let df = want - pl.f; df = Math.atan2(Math.sin(df), Math.cos(df)); pl.f += Math.max(-8 * dt, Math.min(8 * dt, df)); }
    pl.v += (vt - pl.v) * (1 - Math.exp(-6 * dt));
    pl.x -= Math.sin(pl.f) * pl.v * dt; pl.z -= Math.cos(pl.f) * pl.v * dt;
    player.position.set(pl.x, 0, pl.z); player.rotation.y = pl.f;
    body.position.y = 0.78 + Math.abs(Math.sin(time * 9)) * 0.05 * Math.min(1, pl.v / 3);
    // --- loot
    nextLoot -= dt;
    if (nextLoot <= 0) { nextLoot = 5 + Math.random() * 3; const m = new THREE.Mesh(lootGeo, lootMat); m.position.set(pl.x + (Math.random() - 0.5) * 5, 0.2, pl.z + (Math.random() - 0.5) * 5); lab.scene.add(m); loots.push({ m, by: null, t: 0 }); }
    for (const L of loots) { L.m.rotation.y += dt * 2; L.m.position.y = 0.2 + Math.sin(time * 3 + L.m.position.x) * 0.05; }
    // --- pets
    for (const it of pets) {
      const c = it.c, r = c.root;
      let gx, gz, arrive = 0.25;
      if (it.loot) { gx = it.loot.m.position.x; gz = it.loot.m.position.z; arrive = 0.35; }
      else { const cs = Math.cos(pl.f), sn = Math.sin(pl.f); gx = pl.x + it.slot[0] * cs + it.slot[1] * sn; gz = pl.z - it.slot[0] * sn + it.slot[1] * cs; }
      const ex = gx - r.position.x, ez = gz - r.position.z, ed = Math.hypot(ex, ez);
      if (it.picking > 0) { it.picking -= dt; if (it.picking <= it.pickHit && it.loot) { lab.scene.remove(it.loot.m); loots.splice(loots.indexOf(it.loot), 1); it.loot = null; } }
      let want = 0;
      if (!(it.picking > 0)) {
        if (it.loot && ed < arrive) { const rr = c.play('pickup'); it.picking = rr.dur || 0.8; it.pickHit = (rr.dur || 0.8) - (rr.hit ?? 0.4); }
        else if (ed > arrive) want = Math.min(8, Math.max(0, (ed - arrive) * 2.2) + (it.loot ? 1.5 : 0));
      }
      if (!it.loot && !(it.picking > 0) && loots.length) { const L = loots.find(l => !l.by); if (L && Math.hypot(L.m.position.x - r.position.x, L.m.position.z - r.position.z) < 7) { L.by = it; it.loot = L; } }
      const wantF = ed > 0.05 ? Math.atan2(-ex, -ez) : it.facing;
      let df = wantF - it.facing; df = Math.atan2(Math.sin(df), Math.cos(df));
      const turn = want > 0.1 ? Math.max(-6, Math.min(6, df * 5)) : 0;
      it.facing += turn * dt;
      const spd = want * Math.max(0, Math.cos(df));
      it.speed += (spd - it.speed) * (1 - Math.exp(-5 * dt));
      r.position.x -= Math.sin(it.facing) * it.speed * dt; r.position.z -= Math.cos(it.facing) * it.speed * dt; r.rotation.y = it.facing;
      it.st.speed = it.speed; it.st.turn = turn; it.st.fly = Q.get('fly') === '1';
      c.update(dt, it.st);
    }
  };
  api.stepPets = step; api.player = pl;
  lab.onFrame((dt) => { step(dt); if (lab.view === 'iso') lab.focus(player.position); else { lab.controls.target.lerp(new THREE.Vector3(pl.x, 0.5, pl.z), 0.08); } });
  if (lab.view !== 'iso') { lab.camera.position.set(6, 5, 9); lab.controls.target.set(0, 0.5, 0); lab.controls.update(); }
  if (Q.has('t')) { lab.paused = true; const dt = 1 / 60; for (let s = 0; s < Math.round(num('t', 0) / dt); s++) { G.uTime.value += dt; step(dt); } if (lab.view === 'iso') lab.iso.snap(new THREE.Vector3(pl.x, 0, pl.z)); else { lab.controls.target.set(pl.x, 0.4, pl.z); lab.camera.position.set(pl.x + 3.5, 2.6, pl.z + 4.5); lab.controls.update(); } }
  setInfo(`pets: ${types.join(', ')} following the player (walk 2 / run 5.2 m/s), auto-loot`);
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
  P.button('mount (ride circle)', () => { location.search = '?mode=mount&type=' + (CREATURES[type].mount ? type : 'horse') + '&speed=4'; });
  P.button('pets follow', () => { location.search = '?mode=pets'; });
}
if (mode === 'mount' || mode === 'ride') {
  P.slider('speed', 0, 12, num('speed', 3), v => { api.spd = v; });
  P.buttons(CREATURES[type]?.actions || [], (a) => { const r = api.mount?.play(a); setInfo(`${a}: dur ${r?.dur?.toFixed(2)}`); });
}
function rebuild() { if (mode === 'lineup') buildLineup(); else if (mode === 'strip') buildStrip(); else buildSingle(); }

({ single: buildSingle, lineup: buildLineup, strip: buildStrip, horde: buildHorde, mount: () => buildMount(false), ride: () => buildMount(true), pets: buildPets, gallery: buildGallery })[mode]?.();

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
if (Q.has('t') && (mode === 'single' || mode === 'lineup' || mode === 'gallery')) {
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
