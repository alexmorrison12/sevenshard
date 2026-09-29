// UI lab: every screen, the HUD (animated fake HudState) and every window, over a painted game-like backdrop.
//   node tools/lab.mjs src/lab/ui.js  →  http://localhost:5299/lab/ui.html
// Query params:
//   ?screen=hud|title|charselect|create|loading|results|death   (default hud)
//   ?win=<id>[,<id>]   open windows (inventory, character, skills, engravings, settings, vendor, honing, stone, …)
//   ?cls=reaver|…      class for skills/identity      ?raid=1  8-man raid frames     ?noboss=1  elite target instead
//   ?chaos=1           chaos dungeon progress/timer   ?solo=1  no party              ?touch=1   touch layout
//   ?banner=zone|boss|warn|counter|stagger|levelup|quest|clear   ?tip=item|skill|buff   ?freeze=1  stop the sim
//   ?bg=field|dungeon|city|dark   backdrop           ?perf=1  benchmark hud.update()   ?dialog=1  NPC dialogue
//   ?hide=1            photo mode (HUD hidden)        ?cast=charge|cast|channel   ?interact=1   ?modal=confirm|delete|prompt
import { createUI } from '../ui/index.js';
import { createMockHud, CHAT, mockScreens, mockWindows } from './ui-mock.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
const BG = q.bg || (q.chaos ? 'dungeon' : q.screen === 'title' || q.screen === 'charselect' || q.screen === 'create' ? 'scene' : q.screen && q.screen !== 'hud' ? 'dark' : 'field');
paintBackdrop(BG);
addEventListener('resize', () => paintBackdrop(BG));

const log = [];
const ui = createUI(document.body, {
  onAction(type, payload) { log.push([type, payload]); console.log('[action]', type, JSON.stringify(payload).slice(0, 200)); },
  touch: q.touch === '1' ? true : false,
});
window.__ui = ui; window.__log = log;
if (q.touch === 'skills') ui.setTouch(true, { skills: true });

const mock = createMockHud({ cls: q.cls, raid: q.raid === '1', noboss: q.noboss === '1', chaos: q.chaos === '1', solo: q.solo === '1' });
window.__mock = mock;
if (q.cast) mock.state.cast = { label: { charge: 'Hell Blade', cast: 'Punishing Bolt', channel: 'Lightning Vortex', hold: 'Whirlwind Edge' }[q.cast] || 'Casting', kind: q.cast, t: 0.35, perfect: q.cast === 'charge' ? [0.72, 0.9] : null, icon: 'skill:reaver:r' };
if (q.ship) { mock.state.boss = null; mock.state.zone = { name: 'The Glass Sea', sub: 'Southern Reach' }; mock.state.ship = { name: 'Dawnrunner', crew: 12, hp: 8420, hpMax: 10000, speed: 14.2, speedMax: 22, sails: 2, heading: -0.9, wind: 0.6, windSpeed: 18, dest: { name: 'Lantern Isle', dist: 1240 },
  skills: [{ id: 'full_sail', name: 'Full Sail', icon: 'skill:any:dash', key: 'Q', cd: 30, cdLeft: 12, desc: 'Burst of speed.' }, { id: 'repair', name: 'Repair', icon: 'item:hp_potion', key: 'W', cd: 60, cdLeft: 0, desc: 'Mend the hull.' }, { id: 'volley', name: 'Cannon Volley', icon: 'item:destruction_bomb', key: 'E', cd: 8, cdLeft: 3, desc: 'Broadside!' }, { id: 'brace', name: 'Brace', icon: 'status:shield', key: 'R', cd: 45, cdLeft: 0, desc: 'Reduce storm and cannon damage.' }] }; }
if (q.interact) mock.state.interact = { key: 'G', label: 'Talk', name: 'Commander Brannoc' };

const screen = q.screen || 'hud';
if (screen === 'hud' || screen === 'death') {
  ui.screen('game');
  for (const m of CHAT) ui.chat.add(m);
  ui.hud.update(mock.state);
  if (q.hide === '1') ui.setHudVisible(false);
  let acc = 0, last = performance.now();
  const loop = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
    if (acc >= 1 / 15 && q.freeze !== '1') {
      const s = mock.step(acc); acc = 0;
      if (s.cast) { s.cast.t = (s.cast.t + 0.02) % 1; }
      ui.hud.update(s);
      if (s.__pressed) { ui.hud.press(s.__pressed); s.__pressed = null; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  let lootN = 0;
  if (q.freeze !== '1') setInterval(() => { const L = mockWindows.lootDrops(); ui.hud.loot(L[lootN++ % L.length]); }, 2600);
  else for (const it of mockWindows.lootDrops().slice(0, 3)) ui.hud.loot(it);
  if (screen === 'death') { mock.state.hp = 0; mock.state.__dead = true; ui.screen('death', mockScreens.death()); }
} else {
  ui.screen(screen, mockScreens[screen] ? mockScreens[screen]() : {});
}

// banners
const BN = {
  zone: () => ui.banner('Goldmeadow', { kind: 'zone', sub: 'Valemont' }),
  boss: () => ui.banner('Gorrath', { kind: 'boss', title: 'the Horned Tyrant' }),
  warn: () => ui.banner('The Horned Tyrant is enraged!', { kind: 'warn' }),
  counter: () => ui.banner('COUNTER!', { kind: 'counter' }),
  stagger: () => ui.banner('STAGGER BREAK', { kind: 'stagger' }),
  levelup: () => ui.banner('New skill points available', { kind: 'levelup', level: 53 }),
  quest: () => ui.banner("The Tyrant's Shadow", { kind: 'quest' }),
  clear: () => ui.banner('Dungeon Cleared', { kind: 'clear', sub: 'Demon Rift' }),
  defeat: () => ui.banner('Party Wiped', { kind: 'defeat', sub: 'Gate 2' }),
};
if (q.banner) for (const b of q.banner.split(',')) BN[b]?.();
if (q.toast) { ui.toast('Your party has entered the Legion Raid.', 'party'); ui.toast('+15 honing succeeded!', 'success'); ui.toast('Inventory is almost full.', 'warn'); }

// windows
if (q.win) for (const w of q.win.split(',')) ui.open(w, mockWindows[w] ? mockWindows[w]() : {});
if (q.hone) setTimeout(() => ui.get('honing')?.play(q.hone, { hone: 17, energy: 0.4186 }), 600);
if (q.dialog) ui.dialog(mockWindows.npc(), mockWindows.script()).then(r => console.log('[dialog] →', r));
if (q.modal === 'confirm') ui.confirm({ title: 'Leave the Raid?', text: 'You will lose your progress in Gate 2 and cannot re-enter this week.', ok: 'Leave', danger: true });
if (q.modal === 'delete') ui.confirm({ title: 'Delete Character', text: 'This cannot be undone. Every item on Ashveil will be destroyed.', ok: 'Delete', danger: true, match: 'Ashveil' });
if (q.modal === 'prompt') ui.prompt({ title: 'Rename Pet', text: 'Give your foxling a new name.', value: 'Ember', ok: 'Rename' });

// tooltips (programmatic hover for screenshots)
if (q.tip) setTimeout(() => {
  const sel = { item: '.ss-inv-grid .ss-slot:not(.ss-slot--empty)', skill: '.ss-sc-skills .ss-sk', buff: '.ss-buff', gear: '.ss-cp-slot[data-slot="weapon"] .ss-slot', stone: '.ss-cp-slot[data-slot="stone"] .ss-slot', awaken: '.ss-sk--awaken' }[q.tip] || q.tip;
  const i = +(q.tipi || 0);
  const el = document.querySelectorAll(sel)[i];
  if (el) el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  else console.log('[lab] no element for tip', sel);
}, 400);

// perf: 8 skills + 30 buffs + 8 raid frames, full HudState pushes (also runnable from shot.mjs --evalAfter)
window.__benchHud = (N = 200) => {
  const s = mock.state;
  s.party = ['reaver', 'oathkeeper', 'pistoleer', 'starcaller', 'stormfist', 'songweaver', 'demonbound', 'bladedancer'].map((c, i) => ({ name: 'P' + i, cls: c, hp: 30000, hpMax: 45000, shield: i % 3 ? 0 : 4000, you: i === 0, support: i === 1 || i === 5 }));
  while (s.buffs.length < 30) s.buffs.push({ ...s.buffs[s.buffs.length % 8], id: 'b' + s.buffs.length, left: 5 + s.buffs.length, dur: 40 });
  for (let i = 0; i < 10; i++) { mock.step(1 / 15); ui.hud.update(s); }
  let t0 = performance.now(); for (let i = 0; i < N; i++) mock.step(1 / 15); const step = (performance.now() - t0) / N;
  t0 = performance.now(); for (let i = 0; i < N; i++) { mock.step(1 / 15); ui.hud.update(s); } const upd = (performance.now() - t0) / N - step;
  t0 = performance.now(); for (let i = 0; i < 50; i++) { mock.step(1 / 15); ui.hud.update(s); void document.body.offsetHeight; } const lay = (performance.now() - t0) / 50 - step;
  const r = { hudUpdateMs: +upd.toFixed(3), withStyleLayoutMs: +lay.toFixed(3), skills: s.skills.length, buffs: s.buffs.length, party: s.party.length };
  console.log('[perf] ' + JSON.stringify(r));
  return r;
};
if (q.perf) setTimeout(() => { window.__perf = window.__benchHud(); }, 500);

// ------------------------------------------------------------------------------------------------ backdrop
function paintBackdrop(kind) {
  let cv = document.getElementById('lab-bg');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'lab-bg'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0'; document.body.prepend(cv); }
  const W = cv.width = innerWidth || 1600, H = cv.height = innerHeight || 900;
  const x = cv.getContext('2d');
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === 'scene') { // stand-in for the lead's 3D key scene: dusk sky, sea of glass, distant citadel
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070b1c'); sky.addColorStop(0.42, '#1c2a52'); sky.addColorStop(0.62, '#b0603a'); sky.addColorStop(0.66, '#3a2438'); sky.addColorStop(1, '#070812');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(220,230,255,${r() * 0.7})`; x.fillRect(r() * W, r() * H * 0.45, 1.3, 1.3); }
    const sun = x.createRadialGradient(W * 0.5, H * 0.63, 4, W * 0.5, H * 0.63, W * 0.35);
    sun.addColorStop(0, 'rgba(255,220,160,.9)'); sun.addColorStop(0.15, 'rgba(255,150,80,.45)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
    x.fillStyle = sun; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0b0a16';
    x.beginPath(); x.moveTo(0, H * 0.66);
    for (let i = 0; i <= 40; i++) { const px = i / 40 * W; x.lineTo(px, H * (0.62 + 0.04 * Math.sin(i * 1.7) + 0.02 * r())); }
    x.lineTo(W, H); x.lineTo(0, H); x.fill();
    // citadel silhouette
    x.fillStyle = '#090812';
    const cx = W * 0.72, by = H * 0.63;
    for (const [dx, w, hh] of [[-60, 30, 90], [-25, 22, 140], [0, 34, 200], [30, 20, 120], [55, 40, 80], [-100, 50, 50]]) { x.fillRect(cx + dx, by - hh, w, hh); x.beginPath(); x.moveTo(cx + dx - 4, by - hh); x.lineTo(cx + dx + w / 2, by - hh - 30); x.lineTo(cx + dx + w + 4, by - hh); x.fill(); }
    // reflection shimmer
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,180,120,${r() * 0.25})`; x.fillRect(W * 0.5 + (r() - 0.5) * W * 0.4, H * (0.68 + r() * 0.3), 20 + r() * 60, 1.5); }
    return;
  }
  if (kind === 'dark') {
    const g = x.createRadialGradient(W * 0.5, H * 0.42, 50, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#1c2440'); g.addColorStop(0.55, '#0c1122'); g.addColorStop(1, '#04060c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(160,190,255,${r() * 0.5})`; x.fillRect(r() * W, r() * H * 0.7, 1.2, 1.2); }
    return;
  }
  const P = {
    field: { a: '#6f8a48', b: '#56703a', road: '#a8926a', dot: [70, 100, 40], tree: '#2f4a24', light: 'rgba(255,230,170,.25)' },
    dungeon: { a: '#2c2640', b: '#1a1628', road: '#3a3452', dot: [60, 50, 90], tree: '#141020', light: 'rgba(140,110,255,.18)' },
    city: { a: '#9a8a6e', b: '#7a6a52', road: '#b8a888', dot: [120, 100, 80], tree: '#4a5a34', light: 'rgba(255,220,160,.25)' },
  }[kind] || {};
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.b); g.addColorStop(1, P.a);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ground texture (perspective-ish: smaller dots at the top)
  for (let i = 0; i < 5000; i++) {
    const yy = r() * H, s = 1 + (yy / H) * 5 * r();
    const [cr, cg, cb] = P.dot;
    x.fillStyle = `rgba(${cr + r() * 40 | 0},${cg + r() * 40 | 0},${cb + r() * 30 | 0},${0.15 + r() * 0.3})`;
    x.beginPath(); x.ellipse(r() * W, yy, s * 1.6, s, 0, 0, 7); x.fill();
  }
  // road / cobbles
  x.save(); x.fillStyle = P.road; x.globalAlpha = 0.85;
  x.beginPath(); x.moveTo(W * 0.38, H); x.lineTo(W * 0.47, 0); x.lineTo(W * 0.56, 0); x.lineTo(W * 0.66, H); x.closePath(); x.fill();
  x.globalAlpha = 0.25; x.strokeStyle = '#000';
  for (let yy = 0; yy < H; yy += 18) { const k = yy / H; x.beginPath(); x.moveTo(W * (0.47 - 0.09 * k), yy); x.lineTo(W * (0.56 + 0.1 * k), yy); x.stroke(); }
  x.restore();
  // props: rocks & trees with shadows
  for (let i = 0; i < 26; i++) {
    const px = r() < 0.5 ? r() * W * 0.36 : W * 0.68 + r() * W * 0.32, py = r() * H, s = 18 + (py / H) * 40;
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(px + s * 0.5, py + s * 0.4, s * 1.1, s * 0.45, 0, 0, 7); x.fill();
    const tg = x.createRadialGradient(px - s * 0.3, py - s * 0.5, 2, px, py - s * 0.2, s * 1.1);
    tg.addColorStop(0, '#6f9a4a'); tg.addColorStop(1, P.tree);
    x.fillStyle = kind === 'dungeon' ? '#2a2440' : tg; x.beginPath(); x.arc(px, py - s * 0.3, s, 0, 7); x.fill();
  }
  // hero + telegraph
  const hx = W * 0.5, hy = H * 0.56;
  x.strokeStyle = 'rgba(255,60,40,.85)'; x.lineWidth = 3; x.fillStyle = 'rgba(255,40,20,.18)';
  x.beginPath(); x.ellipse(W * 0.58, H * 0.4, 150, 64, 0, 0, 7); x.fill(); x.stroke();
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(hx, hy + 32, 22, 9, 0, 0, 7); x.fill();
  x.fillStyle = '#2a2230'; x.fillRect(hx - 9, hy - 40, 18, 70); x.fillStyle = '#c9a45a'; x.fillRect(hx - 11, hy - 26, 22, 6);
  // warm light / vignette
  const lg = x.createRadialGradient(W * 0.3, H * 0.1, 10, W * 0.3, H * 0.1, W * 0.7); lg.addColorStop(0, P.light); lg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = lg; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
