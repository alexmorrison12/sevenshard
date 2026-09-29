// Legion bosses lab core (shared by legion.js and the per-boss legion_*.js entries): pick a boss, play actions (with dur scaling), glow panel (counter / enrage / ghost), state
// toggles, locomotion preview, horn breaks, a 1.85 m capsule "hero" for scale, the game camera (iso) and a
// cinematic close/low view, plus a contact-sheet mode (one instance per keyframe time) for readability reviews.
//
// URL: ?boss=gorrath&act=axe_cleave&loop=1&t=1.2 (freeze at t) &view=iso|cine|close|front|side|top|orbit
//      &counter=1&enrage=1&ghost=1&speed=2.6&turn=0&hero=1&sheet=axe_cleave&n=6&light=dusk&face=180
// Automation: window.__legion = { boss, set(id), play(name, opts), pose(name, t) → Promise, loco(speed, turn),
//                                glow(kind, v), view(name), sheet(name, n), stats() }
import * as THREE from 'three';
import { createLab } from './kit.js';
import { lambert } from '../engine/materials.js';

export function startLegionLab({ createBoss, BOSSES, bossStats, title = 'Legion Bosses' }) {

const q = Object.fromEntries(new URLSearchParams(location.search));
const lab = createLab({ title, view: q.view === 'cine' ? 'orbit' : (q.view || 'iso'), ground: 'stone', light: q.light && q.light !== 'blood' ? q.light : 'dusk', size: 80 });
const { scene, camera, controls } = lab;
lab.renderer.grade.bloom = 0.6;
// 'blood' = the Legion colosseum preset used by both raid gates (src/world/env.js), replicated here for tuning
const BLOOD = { sun: 0xff8a6a, sunI: 2.3, dir: [-0.55, 0.62, 0.45], sky: 0xa04a5a, gnd: 0x2a0c0c, hemi: 0.95, fog: 0x5a1418, bg: 0x220608,
  grade: { exposure: 1.04, saturation: 1.14, contrast: 1.14, vignette: 0.46, warm: 0.08, cool: 0.04, lift: [0.035, 0.0, 0.01], gain: [1.05, 0.95, 0.92], bloom: 0.85, bloomRadius: 0.6, bloomThreshold: 0.8 } };
function applyBlood() {
  const L = BLOOD;
  lab.hemi.color.set(L.sky); lab.hemi.groundColor.set(L.gnd); lab.hemi.intensity = L.hemi;
  lab.sun.color.set(L.sun); lab.sun.intensity = L.sunI; lab.sun.position.set(...L.dir).normalize().multiplyScalar(50);
  scene.background = new THREE.Color(L.bg);
  Object.assign(lab.renderer.grade, L.grade);
  if (lab.ground) lab.ground.material.color.set(0x7a4a44);
}
if (q.light === 'blood') applyBlood();


// ---- hero capsule (1.85 m) for scale
const hero = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.85 - 0.64, 6, 14), lambert({ color: 0x4a7ac8 }, { rim: 0.4 }));
  body.position.y = 0.925; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lambert({ color: 0xf0c8a0 }, { rim: 0.3 }));
  head.position.set(0, 1.62, -0.18); head.castShadow = true;
  hero.add(body, head);
  scene.add(hero);
}

let boss = null, bossId = q.boss && BOSSES[q.boss] ? q.boss : Object.keys(BOSSES)[0];
let state = { speed: +(q.speed || 0), turn: +(q.turn || 0), dead: false, groggy: false, enraged: q.enrage === '1', ghost: q.ghost === '1' ? 1 : 0, combat: 1 };
let loopAct = q.act || null, loopOn = q.loop === '1', durScale = 1, frozen = false, patrol = false;
let face = (q.face !== undefined ? +q.face : 180) * Math.PI / 180;
const extra = []; // contact-sheet instances
const info = lab.panel.text('');
let move = null; // action root-motion preview

function setBoss(id) {
  if (boss) boss.dispose();
  for (const e of extra) e.dispose(); extra.length = 0;
  bossId = id;
  const t0 = performance.now();
  boss = createBoss(id);
  const ms = performance.now() - t0;
  boss.root.rotation.y = face;
  scene.add(boss.root);
  boss.root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  boss.onEvent = (name, pos, data) => { if (name === 'hit' || name === 'stomp' || name === 'land' || name === 'fall') lab.iso.shake(name === 'land' ? 0.6 : 0.35); };
  hero.position.set(boss.radius + 2.2, 0, 1.2);
  if (q.counter === '1') boss.setGlow('counter', 1);
  const st = bossStats().find(s => s.id === (boss.placeholder ? 'gorrath' : id)) || {};
  info.set(`${BOSSES[id].name} — ${BOSSES[id].title}\nbuild ${ms.toFixed(0)} ms (sculpt ${st.sculptMs} ms)\n${st.tris} tris · ${st.verts} verts · ${st.bones} bones`);
  buildActionButtons();
  window.__legion.boss = boss;
}

// ---- panel
lab.panel.select('boss', Object.keys(BOSSES), bossId, v => setBoss(v));
let actBox = null;
function buildActionButtons() {
  if (actBox) actBox.remove();
  actBox = lab.panel.buttons(Object.keys(BOSSES[bossId].actions), (name) => { loopAct = name; play(name); });
}
function play(name) {
  const m = BOSSES[bossId].actions[name];
  if (!m) return;
  frozen = false;
  const r = boss.play(name, { dur: m.dur * durScale });
  move = null;
  if (m.move) move = { t: 0, segs: m.move.map(s => ({ t0: s.t[0] * durScale, t1: s.t[1] * durScale, dist: s.dist === 'target' ? 10 : s.dist, h: s.height || 0 })), dur: r.dur };
  return r;
}
lab.panel.slider('dur ×', 0.5, 2, 1, v => { durScale = v; });
lab.panel.check('loop action', loopOn, v => { loopOn = v; });
lab.panel.button('stop / idle', () => { loopOn = false; boss.play('idle'); });
lab.panel.label('Glow');
lab.panel.slider('counter', 0, 1, q.counter === '1' ? 1 : 0, v => boss.setGlow('counter', v));
lab.panel.slider('enrage', 0, 1, 0, v => boss.setGlow('enrage', v));
lab.panel.slider('ghost', 0, 1, state.ghost, v => { state.ghost = v; });
lab.panel.label('State');
lab.panel.check('enraged', state.enraged, v => { state.enraged = v; });
lab.panel.check('groggy', false, v => { state.groggy = v; });
lab.panel.check('dead', false, v => { state.dead = v; });
// part breaks: Gorrath hornL/hornR, hounds mane/tail (buttons for parts the current boss lacks do nothing)
lab.panel.buttons(['hornL', 'hornR', 'mane', 'tail', 'repair', 'hit flash'], (n) => { if (n === 'repair') boss.repair?.(); else if (n === 'hit flash') { flash = 0.7; } else boss.breakPart(n); });
lab.panel.label('Locomotion');
lab.panel.slider('speed m/s', 0, 12, state.speed, v => { state.speed = v; });
lab.panel.slider('turn rad/s', -1.5, 1.5, state.turn, v => { state.turn = v; });
lab.panel.check('patrol circle', false, v => { patrol = v; if (!v) { boss.root.position.set(0, 0, 0); boss.root.rotation.y = face; } });
lab.panel.slider('facing°', 0, 360, face * 180 / Math.PI, v => { face = v * Math.PI / 180; boss.root.rotation.y = face; });
lab.panel.check('hero (1.85 m)', q.hero !== '0', v => { hero.visible = v; });
lab.panel.button('blood light (raid)', () => applyBlood());
lab.panel.label('Camera');
lab.panel.buttons(['iso', 'cine', 'gamecine', 'close', 'front', 'side', 'back', 'top', 'orbit'], v => view(v));
let flash = 0;

function view(name) {
  const b = boss;
  const H = b ? b.height : 7;
  if (name === 'cine') {
    // close & low, in front of the boss (boss faces the camera at face=180°), hero shot looking up
    lab.setView('orbit');
    const fwd = new THREE.Vector3(-Math.sin(face), 0, -Math.cos(face));
    const p = b.root.position.clone().addScaledVector(fwd, Math.max(H * 1.25, b.radius * 3.2) + 2);
    camera.position.set(p.x + fwd.z * H * 0.35, 1.1, p.z - fwd.x * H * 0.35);
    controls.target.set(b.root.position.x, H * 0.55, b.root.position.z);
    camera.fov = 42; camera.updateProjectionMatrix();
    controls.update();
  } else if (name === 'close') {
    // head close-up: in front of the head socket, slightly to the side and above
    lab.setView('orbit');
    const f = b.root.rotation.y, fwd = new THREE.Vector3(-Math.sin(f), 0, -Math.cos(f)), rt = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
    b.root.updateMatrixWorld(true);
    const hp = b.sockets.head.getWorldPosition(new THREE.Vector3());
    const d = Math.max(4, H * 0.85);
    camera.position.copy(hp).addScaledVector(fwd, d).addScaledVector(rt, d * 0.35); camera.position.y = hp.y - d * 0.05;
    controls.target.copy(hp).addScaledVector(fwd, H * 0.04); controls.target.y -= H * 0.05;
    camera.fov = 34; camera.updateProjectionMatrix(); controls.update();
  } else if (name === 'gamecine') {
    // the encounter intro camera (src/game/modes/encounter.js): pos (x+6, y+0.9h, z+11), look (x, y+0.55h, z), fov 30
    lab.setView('orbit');
    const p = b.root.position;
    camera.position.set(p.x + 6, p.y + H * 0.9, p.z + 11); controls.target.set(p.x, p.y + H * 0.55, p.z);
    camera.fov = 30; camera.updateProjectionMatrix(); controls.update();
  } else if (name === 'iso') {
    lab.setView('iso', new THREE.Vector3(b.root.position.x, 0, b.root.position.z));
    if (H > 9) { lab.iso.maxDist = 60; lab.iso.zoom = lab.iso.dist = 52; lab.iso.snap(new THREE.Vector3(b.root.position.x, 0, b.root.position.z)); }
  } else {
    // views relative to the boss's facing: front, side (its right), back, orbit, top
    lab.setView('orbit');
    const f = b.root.rotation.y, fw = new THREE.Vector3(-Math.sin(f), 0, -Math.cos(f)), rt = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
    const d = { front: [0, 0.1, 2.1], side: [2.1, 0.1, 0], back: [0, 0.1, -2.1], orbit: [1.2, 0.8, 1.7], top: [0, 3, 0.01] }[name] || [1.2, 0.8, 1.7];
    const p = b.root.position.clone().addScaledVector(rt, d[0] * H).addScaledVector(fw, d[2] * H);
    camera.position.set(p.x, H * 0.5 + d[1] * H, p.z); controls.target.set(b.root.position.x, H * 0.5, b.root.position.z);
    camera.fov = 38; camera.updateProjectionMatrix(); controls.update();
  }
  lab.view = name === 'iso' ? 'iso' : 'orbit';
}

// ---- contact sheet: n frozen instances across an action's timeline
function sheet(name, n = 6, o = {}) {
  for (const e of extra) e.dispose(); extra.length = 0;
  const m = BOSSES[bossId].actions[name]; if (!m) return;
  const gap = boss.radius * (o.gap ?? 3.0);
  boss.root.visible = false; hero.visible = false;
  for (let i = 0; i < n; i++) {
    const b = createBoss(bossId);
    b.root.rotation.y = o.face ?? Math.PI;
    b.root.position.set((i - (n - 1) / 2) * gap, 0, 0);
    scene.add(b.root);
    const D = o.dur ?? m.dur;                         // o.dur: review at a game-scaled duration
    b.play(name, { dur: D });
    const t = o.times ? o.times[i] : (i / (n - 1)) * D * 0.999;
    const steps = Math.ceil(t / (1 / 60));
    for (let k = 0; k < steps; k++) b.update(t / Math.max(1, steps), { combat: 1 });
    b.update(0, { combat: 1 });
    b._sheetT = t;
    extra.push(b);
  }
  lab.setView('orbit');
  const W = gap * n;
  const pitch = (o.pitch ?? 40) * Math.PI / 180, dist = W * 0.55 + boss.height * 1.2;
  camera.position.set(0, boss.height * 0.4 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  controls.target.set(0, boss.height * 0.4, 0);
  camera.fov = 36; camera.updateProjectionMatrix(); controls.update();
  lab.view = 'orbit';
  // label the times
  if (!sheetLabels) { sheetLabels = document.createElement('div'); sheetLabels.style.cssText = 'position:fixed;left:0;right:0;bottom:8px;display:flex;justify-content:space-around;font:bold 14px monospace;color:#fff;text-shadow:0 0 4px #000;pointer-events:none'; document.body.appendChild(sheetLabels); }
  sheetLabels.innerHTML = extra.map(b => `<span>${b._sheetT.toFixed(2)}s</span>`).join('');
}
let sheetLabels = null;

// ---- frame loop
lab.onFrame((dt) => {
  if (!boss) return;
  if (extra.length) { for (const b of extra) b.update(0, { combat: 1 }); return; }
  if (frozen) { boss.update(0, state); return; }
  // patrol / locomotion preview
  const s = { ...state };
  if (patrol && s.speed > 0.05) {
    const R = 10; s.turn = s.speed / R;
    boss.root.rotation.y += s.turn * dt;
    const f = boss.root.rotation.y;
    boss.root.position.x += -Math.sin(f) * s.speed * dt; boss.root.position.z += -Math.cos(f) * s.speed * dt;
  } else if (s.speed > 0.05) {
    // treadmill: move and wrap so the camera keeps it in view
    const f = boss.root.rotation.y;
    boss.root.position.x += -Math.sin(f) * s.speed * dt; boss.root.position.z += -Math.cos(f) * s.speed * dt;
    if (boss.root.position.length() > 14) boss.root.position.set(Math.sin(f) * 12, 0, Math.cos(f) * 12);
    boss.root.rotation.y += s.turn * dt;
  } else if (Math.abs(s.turn) > 0.01) boss.root.rotation.y += s.turn * dt;
  // action root motion (charges, leaps)
  if (move) {
    move.t += dt;
    let hov = 0;
    for (const g of move.segs) if (move.t > g.t0 && move.t <= g.t1) {
      const f = boss.root.rotation.y, v = g.dist / (g.t1 - g.t0);
      boss.root.position.x += -Math.sin(f) * v * dt; boss.root.position.z += -Math.cos(f) * v * dt;
      hov = Math.sin(Math.PI * (move.t - g.t0) / (g.t1 - g.t0)) * g.h;   // the encounter's B.leap arc (u.data.hover)
    }
    boss.root.position.y = hov;
    if (move.t > move.dur) { move = null; boss.root.position.y = 0; }
  }
  if (flash > 0) { flash = Math.max(0, flash - dt * 3); boss.setTint(0xffffff, flash); }
  boss.update(dt, s);
  if (loopOn && loopAct && !boss.playing()) { if (!move) boss.root.position.set(0, 0, 0); play(loopAct); }
  if (lab.view === 'iso') lab.focus(boss.root.position);
});

window.__legion = {
  boss: null, lab,
  set: (id) => setBoss(id),
  play: (name, o = {}) => { loopAct = name; loopOn = !!o.loop; return play(name); },
  /** play `name` and freeze the pose at time t (s). Resolves after the frame is rendered. */
  pose(name, t, o = {}) {
    const m = BOSSES[bossId].actions[name];
    frozen = false; boss.play(name, { dur: (m?.dur ?? 1) * (o.scale ?? 1) });
    const steps = Math.max(1, Math.ceil(t * 60));
    for (let k = 0; k < steps; k++) boss.update(t / steps, state);
    frozen = true;
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
  },
  loco(speed, turn = 0) { state.speed = speed; state.turn = turn; },
  glow(kind, v) { if (kind === 'ghost') state.ghost = v; else boss.setGlow(kind, v); },
  state(o) { Object.assign(state, o); },
  view, sheet,
  stats: () => ({ boss: bossStats(), render: lab.renderer.r.info.render, fps: lab.renderer.fps }),
};

setBoss(bossId);
view(q.view || 'iso');
if (q.sheet) sheet(q.sheet, +(q.n || 6));
else if (q.act) {
  if (q.t !== undefined) window.__legion.pose(q.act, +q.t);
  else play(q.act);
}
}
