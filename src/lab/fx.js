// FX lab: capsule hero + big horned dummy boss + optional mob crowd, the game camera and post chain.
// Buttons for every primitive and preset, a telegraph gallery, a damage-number storm, weather, and a stress mode
// (4 "players" spamming skills over 60 mobs) with fps / draw-call readout.
// Automation (screenshots): window.fxLab = { fx, lab, hero, boss, play(name, params), prim(name), at(fn, t), gallery(),
//   storm(), stress(on), weather(kind), reset(), shot(name) }. URL: ?fx=<preset>&t=<seconds> plays + freezes.
import * as THREE from 'three';
import { createLab } from './kit.js';
import { lambert } from '../engine/materials.js';
import { FX } from '../fx/index.js';

const Q = new URLSearchParams(location.search);
const lab = createLab({ title: 'FX · SEVENSHARD', view: 'iso', ground: 'stone', light: Q.get('light') || 'day', size: 90 });
const fx = new FX(lab.scene, { quality: Q.get('q') || 'high' });
window.fx = fx;

// ------------------------------------------------------------------ actors
function capsuleHero(color = 0x3a5ab0) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.05, 4, 12), lambert({ color }, { rim: 0.35 }));
  body.position.y = 0.95; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), lambert({ color: 0xd9b08c }));
  head.position.y = 1.72; root.add(head);
  const shoulder = new THREE.Group(); shoulder.position.set(0.42, 1.38, 0); root.add(shoulder);
  const arm = new THREE.Group(); shoulder.add(arm);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.03), lambert({ color: 0xc8ccd8 }, { spec: 0.6, shine: 40 }));
  blade.position.y = 0.95; arm.add(blade);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.08), lambert({ color: 0x8a6a2a })); hilt.position.y = 0.18; arm.add(hilt);
  arm.rotation.x = -0.3;
  const sock = n => { const o = new THREE.Object3D(); o.name = n; return o; };
  const sockets = { weapon: sock('weapon'), weaponTip: sock('weaponTip'), handR: sock('handR'), handL: sock('handL'), head: sock('head'), chest: sock('chest'), overhead: sock('overhead'), feet: sock('feet') };
  sockets.weapon.position.set(0, 0.25, 0); arm.add(sockets.weapon);
  sockets.weaponTip.position.set(0, 1.7, 0); arm.add(sockets.weaponTip);
  sockets.handR.position.set(0.5, 1.1, -0.25); root.add(sockets.handR);
  sockets.handL.position.set(-0.5, 1.1, -0.25); root.add(sockets.handL);
  sockets.head.position.set(0, 1.75, 0); root.add(sockets.head);
  sockets.chest.position.set(0, 1.25, 0); root.add(sockets.chest);
  sockets.overhead.position.set(0, 2.2, 0); root.add(sockets.overhead);
  root.add(sockets.feet);
  return { root, sockets, arm, height: 1.85 };
}
function dummyBoss() {
  const root = new THREE.Group();
  const mat = lambert({ color: 0x5a3a44 }, { rim: 0.3 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 3.2, 6, 16), mat); body.position.y = 2.85; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 14), mat); head.position.y = 5.3; root.add(head);
  const hornM = lambert({ color: 0xd8ccb0 });
  const horns = [];
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 10), hornM); h.position.set(s * 0.8, 6.0, 0); h.rotation.z = -s * 0.6; root.add(h); horns.push(h); }
  const sock = (n, x, y, z) => { const o = new THREE.Object3D(); o.name = n; o.position.set(x, y, z); root.add(o); return o; };
  const sockets = { head: sock('head', 0, 5.3, 0.6), chest: sock('chest', 0, 3.4, 0.9), mouth: sock('mouth', 0, 5.0, 0.95), hornL: sock('hornL', -1.1, 6.3, 0), hornR: sock('hornR', 1.1, 6.3, 0) };
  return { root, sockets, horns, height: 6.4, radius: 1.5 };
}
const hero = capsuleHero();
hero.root.position.set(0, 0, 4);
lab.add(hero.root);
const boss = dummyBoss();
boss.root.position.set(0, 0, -3.5);
lab.add(boss.root);
const party = [capsuleHero(0xa04a3a), capsuleHero(0x3a9a5a), capsuleHero(0x8a5ab0)];
party.forEach((h, i) => { h.root.position.set(-4 + i * 4, 0, 6.5); h.root.visible = false; lab.add(h.root); });
const mobs = [];
{
  const g = new THREE.CapsuleGeometry(0.3, 0.6, 3, 8), m = lambert({ color: 0x6a3a5a });
  for (let i = 0; i < 60; i++) { const mob = new THREE.Mesh(g, m); const a = i / 60 * Math.PI * 2 * 3, r = 5 + (i % 7) * 1.4; mob.position.set(Math.cos(a) * r, 0.62, Math.sin(a) * r * 0.7 - 1); mob.visible = false; lab.add(mob); mobs.push(mob); }
}
lab.setView('iso', new THREE.Vector3(0, 1, -1.2));
const HERO = () => hero.root.position;
const BOSS = () => boss.root.position;
const fwd = new THREE.Vector3(0, 0, -1);
const tmp = new THREE.Vector3();

// ------------------------------------------------------------------ swing animation (for weapon trails)
let swingT = -1;
function swing() { swingT = 0; }
lab.onFrame((dt, t) => {
  if (swingT >= 0) {
    swingT += dt;
    const u = Math.min(1, swingT / 0.35);
    hero.arm.rotation.set(-0.3 - Math.sin(u * Math.PI) * 0.6, 0, 1.6 - u * 3.4);
    if (swingT > 0.6) { swingT = -1; hero.arm.rotation.set(-0.3, 0, 0); }
  }
  fx.update(dt, t, lab.camera);
  fx.applyScreen(lab.renderer, lab.view === 'iso' ? lab.iso : null);
  if (stressOn) stressTick(dt);
});

// ------------------------------------------------------------------ demo params per preset (sensible defaults)
function demoParams(name) {
  const p = { pos: HERO().clone(), dir: fwd.clone(), target: BOSS().clone().add(new THREE.Vector3(0, 0, 2.5)), attach: hero.root, caster: hero.root, sockets: hero.sockets };
  return p;
}
function play(name, extra = {}) { return fx.play(name, { ...demoParams(name), ...extra }); }

// primitive demos
const PRIM = {
  slash_h: () => { swing(); fx.slash({ pos: HERO(), dir: fwd, radius: 3.2, style: 'h', color: 0xffb070 }); },
  slash_v: () => fx.slash({ pos: HERO(), dir: fwd, radius: 2.8, style: 'v', color: 0x9ad0ff }),
  slash_x: () => fx.slash({ pos: HERO(), dir: fwd, radius: 2.6, style: 'x', color: 0xff4050 }),
  slash_spin: () => fx.slash({ pos: HERO(), dir: fwd, radius: 3, style: 'spin', color: 0xffe0a0 }),
  slash_up: () => fx.slash({ pos: HERO(), dir: fwd, radius: 2.6, style: 'up', color: 0x80e0ff }),
  thrust: () => fx.slash({ pos: HERO(), dir: fwd, radius: 1.2, length: 5, style: 'thrust', color: 0xfff0c0 }),
  dark_slash: () => fx.slash({ pos: HERO(), dir: fwd, radius: 3, style: 'd', color: 0xff2050, dark: true }),
  wave: () => fx.slash({ pos: HERO(), dir: fwd, radius: 2, style: 'wave', color: 0xff3040, speed: 18, dur: 0.8 }),
  burst: () => fx.burst({ pos: tmp.copy(BOSS()).setY(3), kind: 'spark', count: 40, speed: 8 }),
  burst_fire: () => fx.burst({ pos: tmp.copy(BOSS()).setY(3), kind: 'fire', count: 30, speed: 7 }),
  burst_holy: () => fx.burst({ pos: tmp.copy(BOSS()).setY(3), kind: 'holy', count: 30, speed: 6 }),
  burst_note: () => fx.burst({ pos: tmp.copy(HERO()).setY(1.5), kind: 'note', count: 12, speed: 3 }),
  shockwave: () => fx.shockwave({ pos: BOSS(), radius: 8, color: [1.6, 1.2, 0.8] }),
  hit: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'physical' }),
  hit_crit: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'physical', crit: true }),
  hit_fire: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'fire', crit: true }),
  hit_frost: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'frost' }),
  hit_lightning: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'lightning' }),
  hit_dark: () => fx.hit({ pos: boss.sockets.chest, dir: fwd, element: 'dark', crit: true }),
  projectile: () => fx.projectile({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'bolt', color: 0x9ad0ff }),
  fireball: () => fx.projectile({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'fire' }),
  frost_lance: () => fx.projectile({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'lance' }),
  dark_bolt: () => fx.projectile({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'dark' }),
  bullet: () => { for (let i = 0; i < 5; i++) setTimeout(() => fx.projectile({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'bullet' }), i * 60); },
  glaive: () => fx.projectile({ from: hero.sockets.handR, dir: fwd, kind: 'glaive', range: 12 }),
  grenade: () => fx.projectile({ from: hero.sockets.handR, to: tmp.copy(BOSS()).add(new THREE.Vector3(2, 0, 3)), kind: 'grenade' }),
  wave_proj: () => fx.projectile({ from: HERO(), dir: fwd, kind: 'wave', color: 0xff2a3a, range: 12 }),
  beam: () => fx.beam({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'energy', color: [2.4, 0.5, 0.3], dur: 1.2, width: 0.6 }),
  holy_beam: () => fx.beam({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'holy', dur: 1.2 }),
  chain: () => fx.beam({ from: hero.sockets.handR, to: boss.sockets.chest, kind: 'chain', dur: 1.2 }),
  lightning: () => fx.lightning({ from: tmp.copy(BOSS()).add(new THREE.Vector3(0, 14, 0)), to: BOSS().clone().add(new THREE.Vector3(2.5, 0, 2.5)), dur: 0.5, width: 0.5 }),
  meteor: () => fx.meteor({ target: tmp.copy(BOSS()).add(new THREE.Vector3(3, 0, 3)), radius: 3.5 }),
  decal_crater: () => fx.decal({ pos: tmp.copy(HERO()).add(new THREE.Vector3(-4, 0, -2)), radius: 3, kind: 'crater' }),
  decal_holy: () => fx.decal({ pos: tmp.copy(HERO()).add(new THREE.Vector3(4, 0, -2)), radius: 3, kind: 'holy', dur: 4 }),
  decal_frost: () => fx.decal({ pos: tmp.copy(HERO()).add(new THREE.Vector3(0, 0, -3)), radius: 3, kind: 'frost' }),
  decal_blood: () => fx.decal({ pos: tmp.copy(HERO()).add(new THREE.Vector3(2, 0, -1)), radius: 1.5, kind: 'blood' }),
  decal_fissure: () => fx.decal({ pos: HERO(), dir: fwd, radius: 1.2, length: 12, kind: 'fissure' }),
  aura_burst: () => { const h = fx.aura({ attach: hero.root, kind: 'burst' }); setTimeout(() => h.stop(), 3000); },
  aura_holy: () => { const h = fx.aura({ attach: hero.root, kind: 'holy' }); setTimeout(() => h.stop(), 3000); },
  aura_shield: () => { const h = fx.aura({ attach: hero.root, kind: 'shield' }); setTimeout(() => h.stop(), 3000); },
  aura_demon: () => { const h = fx.aura({ attach: hero.root, kind: 'demon' }); setTimeout(() => h.stop(), 3000); },
  aura_stun: () => { const h = fx.aura({ attach: hero.root, kind: 'stun' }); setTimeout(() => h.stop(), 3000); },
  aura_freeze: () => { const h = fx.aura({ attach: hero.root, kind: 'freeze' }); setTimeout(() => h.stop(), 3000); },
  trail: () => { swing(); fx.trail({ attach: hero.sockets.weapon, tip: hero.sockets.weaponTip, color: 0xffd080, dur: 0.5, life: 0.18 }); },
  telegraph: () => fx.telegraph({ shape: 'circle', pos: tmp.copy(BOSS()).add(new THREE.Vector3(0, 0, 4)), radius: 5, color: 'red', dur: 2 }),
  number: () => { fx.number(boss.sockets.head, 12345, { style: 'normal' }); fx.number(boss.sockets.head, 98765, { style: 'crit' }); },
  death: () => fx.death({ pos: tmp.copy(HERO()).add(new THREE.Vector3(3, 0, -1)), kind: 'demon' }),
  portal: () => { const h = fx.portal({ pos: tmp.copy(HERO()).add(new THREE.Vector3(-4, 0, -1)), color: 0x9a5aff, dir: fwd }); setTimeout(() => h.stop(), 4000); },
  loot: () => { for (let g = 0; g < 8; g++) { const h = fx.lootBeam({ pos: new THREE.Vector3(-7 + g * 2, 0, 0), grade: g }); setTimeout(() => h.stop(), 6000); } },
  pickup: () => fx.pickup({ pos: tmp.copy(HERO()).add(new THREE.Vector3(1.5, 0.3, 0)), kind: 'gold', to: hero.sockets.chest }),
  counter: () => fx.counterWindow({ attach: boss.root, dur: 1, height: boss.height, scale: 1.6 }),
};

// ------------------------------------------------------------------ galleries
function telegraphGallery() {
  fx.reset();
  const cols = ['red', 'orange', 'blue', 'purple', 'yellow', 'white'];
  const shapes = [
    { shape: 'circle', radius: 1.6 }, { shape: 'cone', radius: 2.8, angle: 1.4 }, { shape: 'rect', length: 3.6, width: 1.8 },
    { shape: 'donut', radius: 1.8, inner: 0.9 }, { shape: 'line', length: 3.6, width: 0.8 }, { shape: 'wedges', radius: 1.8, count: 8 },
  ];
  shapes.forEach((s, j) => cols.forEach((c, i) => {
    const pos = new THREE.Vector3(-10 + i * 4, 0, -8 + j * 3.6);
    const dir = s.shape === 'cone' || s.shape === 'rect' || s.shape === 'line' ? new THREE.Vector3(0, 0, -1) : fwd;
    fx.telegraph({ ...s, pos: s.shape === 'cone' || s.shape === 'rect' || s.shape === 'line' ? pos.clone().add(new THREE.Vector3(0, 0, 1.6)) : pos, dir, color: c, dur: (c === 'yellow' || c === 'white') ? undefined : 3 + i * 0.4 + j * 0.2 });
  }));
}
function numberStorm(n = 300) {
  const styles = ['normal', 'normal', 'normal', 'crit', 'crit', 'back', 'head', 'counter', 'heal', 'shield', 'miss', 'immune', 'dot', 'hurt'];
  let k = 0;
  const id = setInterval(() => {
    for (let i = 0; i < 12; i++) {
      const st = styles[(Math.random() * styles.length) | 0];
      const tgt = Math.random() < 0.5 ? boss.sockets.head.getWorldPosition(new THREE.Vector3()) : mobs[(Math.random() * 20) | 0].position.clone().setY(1.6);
      const v = st === 'crit' ? 50000 + Math.random() * 900000 : st === 'dot' ? 200 + Math.random() * 800 : 1000 + Math.random() * 90000;
      fx.number(tgt.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0)), st === 'miss' || st === 'immune' ? null : v, { style: st });
      if (++k >= n) { clearInterval(id); return; }
    }
  }, 40);
}

// ------------------------------------------------------------------ stress: 4 players spamming skills over 60 mobs
let stressOn = false, stressAcc = 0;
const STRESS_SKILLS = ['greatsword_cleave', 'holy_nova', 'chi_palm', 'muzzle_flash', 'fire_nova', 'harp_note_wave', 'blade_storm', 'dark_slash', 'crimson_wave', 'lightning_pillar', 'meteor_rain', 'frost_lance', 'flurry_sparks', 'grenade', 'blood_pillars'];
function stress(on = !stressOn) {
  stressOn = on;
  party.forEach(h => { h.root.visible = on; });
  mobs.forEach(m => { m.visible = on; });
  if (!on) fx.reset();
}
function stressTick(dt) {
  stressAcc += dt;
  const players = [hero, ...party];
  while (stressAcc > 0.1) {       // ~10 skills / s total (≈2.5 per player per second)
    stressAcc -= 0.1;
    const pl = players[(Math.random() * 4) | 0];
    const mob = mobs[(Math.random() * mobs.length) | 0];
    const name = STRESS_SKILLS[(Math.random() * STRESS_SKILLS.length) | 0];
    const pos = pl.root.position.clone();
    const target = mob.position.clone().setY(0);
    const dir = target.clone().sub(pos).setY(0).normalize();
    if (fx.has(name)) fx.play(name, { pos, dir, target, attach: pl.root, sockets: pl.sockets, dur: name === 'meteor_rain' || name === 'blade_storm' ? 1.5 : undefined });
    for (let i = 0; i < 4; i++) {
      const m = mobs[(Math.random() * mobs.length) | 0];
      const hp = m.position.clone().setY(1.0);
      fx.hit({ pos: hp, dir, crit: Math.random() < 0.3, element: ['physical', 'fire', 'holy', 'lightning', 'dark'][(Math.random() * 5) | 0], scale: 0.7 });
      fx.number(hp.setY(1.6), Math.random() < 0.3 ? 20000 + Math.random() * 200000 : 800 + Math.random() * 20000, { style: Math.random() < 0.3 ? 'crit' : 'normal' });
    }
  }
}

// ------------------------------------------------------------------ deterministic stepping for screenshots
function at(fn, t, step = 1 / 60) {
  lab.paused = true;
  if (typeof fn === 'string') { if (PRIM[fn]) PRIM[fn](); else play(fn); }
  else fn();
  const n = Math.round(t / step);
  for (let i = 0; i < n; i++) lab.step(1, step);
  return fx.stats();
}
function resume() { lab.paused = false; }

// ------------------------------------------------------------------ panel
const P = lab.panel;
const info = P.text('');
setInterval(() => { const s = fx.stats(); info.set(`tasks ${s.tasks} · tele ${s.telegraphs} · decals ${s.decals}\nfx draws ${s.drawCalls} · init ${s.initMs} ms`); }, 500);
P.button('Reset', () => { fx.reset(); stress(false); });
P.button('Stress (4 players × 60 mobs)', () => stress());
P.button('Telegraph gallery', telegraphGallery);
P.button('Damage-number storm', () => numberStorm());
P.select('weather', ['none', 'snow', 'rain', 'ash', 'embers', 'fireflies', 'dust', 'leaves', 'petals'], 'none', v => setWeather(v));
P.label('Primitives');
P.buttons(Object.keys(PRIM), k => PRIM[k]());
const groups = {};
for (const k of Object.keys(fx.PRESETS)) { const g = fx.PRESETS[k].group || (k.startsWith('awk_') ? 'Awakenings' : 'Presets'); (groups[g] || (groups[g] = [])).push(k); }
for (const g in groups) { P.label(g); P.buttons(groups[g], k => play(k)); }

let wx = null;
function setWeather(kind) { wx?.stop(); wx = kind && kind !== 'none' ? fx.weather(kind) : null; }

window.fxLab = { fx, lab, hero, boss, party, mobs, play, prim: k => PRIM[k](), PRIM, at, resume, gallery: telegraphGallery, storm: numberStorm, stress, weather: setWeather, reset: () => fx.reset(), swing };
if (Q.get('fx')) { const t = +(Q.get('t') || 0); setTimeout(() => { if (t > 0) at(Q.get('fx'), t); else if (PRIM[Q.get('fx')]) PRIM[Q.get('fx')](); else play(Q.get('fx')); }, 300); }
console.log('[fx-lab] ready', fx.stats());
