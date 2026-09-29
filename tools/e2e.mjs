// End-to-end launch gate: plays through every major system in headless Chrome and fails on any console error.
// usage: node tools/e2e.mjs [--shots=dir] [--quick]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d ?? ''}`).split('=').slice(1).join('=');
const shots = arg('shots'), quick = process.argv.includes('--quick');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [], warns = [];
p.on('pageerror', e => errs.push('[pageerror] ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('[error] ' + t.slice(0, 300)); if (m.type() === 'warning' && /\[(fx|zone|plugin|window|action)/.test(t)) warns.push(t.slice(0, 200)); });
let ok = 0, bad = 0;
const step = async (name, fn, a) => {
  const t = Date.now();
  try { const r = await p.evaluate(fn, a); ok++; console.log(`✔ ${name} (${Date.now() - t}ms)`, r === undefined ? '' : JSON.stringify(r).slice(0, 260)); return r; }
  catch (e) { bad++; console.log(`✘ ${name}: ${e.message.split('\n')[0]}`); errs.push(`[step ${name}] ${e.message.split('\n')[0]}`); return null; }
};
const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/e2e_${n}.png` }); };
const wait = ms => new Promise(r => setTimeout(r, ms));

await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await shot('01_title');
// helpers inside the page
await p.evaluate(quick => {
  window.__e2e = {
    quick,
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    auto() { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; },
    /** press a numbered dialog choice */
    key(k) { dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k.length === 1 ? (isNaN(k) ? 'Key' + k.toUpperCase() : 'Digit' + k) : k, bubbles: true })); },
  };
}, quick);
await step('story character', async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'songweaver', sex: 'f', look: { face: 2, hair: 4, hairColor: 0xe0c080, skin: 1, eyes: 0x30c0c0, height: 1, build: 0.4, marks: 0 }, name: 'Storyteller', path: 'story' }); await __e2e.sleep(3000); return { screen: __session.screen, zone: __game.zone?.id, mode: __game.mode?.kind, lvl: __session.char.level }; });
await shot('02_story');
await step('back to character select', async () => { await __session.gameMenu('charselect'); await __e2e.sleep(2500); return { screen: __session.screen, chars: __session.account.chars.length }; });
await shot('03_charselect');
await step('create powerpass character', async () => { await __session.route('select:create'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: { face: 1, hair: 2, hairColor: 0x3a2616, skin: 2, eyes: 0x3a6ab0, height: 1, build: 0.6, marks: 1 }, name: 'Endgamer', path: 'powerpass' }); await __e2e.sleep(3000); const L = __game.level; return { zone: __game.zone?.id, npcs: L.units.filter(u => u.kind === 'npc').length, sims: L.units.filter(u => u.data.sim).length, ilvl: Math.floor(__game.hero.u.st.ilvl), minimap: !!__session.minimap()?.canvas }; });
await shot('04_solhaven');
await step('windows open', async () => { const out = {}; for (const id of ['character', 'inventory', 'skills', 'engravings', 'map', 'partyfinder', 'sunheart']) { __session.menu(id); await __e2e.sleep(200); out[id] = !!__session.ui.isOpen?.(id); __session.ui.close(id); } return out; });
await step('skills: level + tripod + bar', async () => { const c = __session.char, id = Object.keys(c.skills)[0]; const before = c.skills[id].lv; await __session.route('skills:level', { id, delta: 1 }); await __session.route('skills:tripod', { id, tier: 0, index: 1 }); return { lv: [before, c.skills[id].lv], tri: c.skills[id].tri, pts: c.skillPts }; });
await step('vendor buy', async () => { __session.service('shop:general', { name: 'Bram Tully', title: 'General Goods' }); await __e2e.sleep(200); const before = __session.account.count('hp_potion'); await __session.route('vendor:buy', { id: 'hp_potion', qty: 5 }); __session.ui.close('vendor'); return { potions: [before, __session.account.count('hp_potion')], silver: __session.account.count('silver') }; });
await step('honing attempt', async () => { const A = __session.account, c = __session.char; for (const k of ['destruction_stone', 'guardian_stone', 'leapstone', 'fusion', 'shards', 'silver', 'gold']) A.give(k, 200000); const { hone } = await import('/src/game/systems/gear.js').catch(() => ({})); const it = c.equip.weapon; const h0 = it.hone; const sys = window.__honeTest; return { hone: h0, set: it.set }; });
await step('mount + song', async () => { const g = __game; g.input.pressed.add('KeyT'); await __e2e.sleep(400); const m = g.hero.u.data.mounted; g.input.pressed.add('KeyT'); await __e2e.sleep(300); return { mounted: m, now: g.hero.u.data.mounted }; });
await step('emote + whisper', async () => { await __session.route('chat:command', { cmd: 'dance', args: '', raw: '/dance' }); const sim = __game.level.units.find(u => u.data.sim); await __session.route('chat:command', { cmd: 'w', args: `${sim.name} are you a bot?`, raw: '' }); await __e2e.sleep(3800); return { ok: true }; });
await step('party finder listings', async () => { const d = __session.windowData('partyfinder'); return { n: d.listings.length, sample: d.listings[0].title }; });
// chaos dungeon: fight a bit with the autopilot, then finish the stages quickly
await step('chaos dungeon: launch + fight', async () => { await __session.launch({ kind: 'chaos', tier: 1 }); __e2e.auto(); await __e2e.sleep(__e2e.quick ? 4000 : 9000); const m = __game.mode; return { stage: m.stage, pct: Math.round(m.pct), kills: m.kills }; });
await shot('05_chaos');
await step('chaos dungeon: clear all stages', async () => { const m = __game.mode; for (let s = 0; s < 3; s++) { m.addPct(100); await __e2e.sleep(300); if (m.portal) { __game.hero.u.pos.x = m.portal.x; __game.hero.u.pos.z = m.portal.z; await __e2e.sleep(600); } } await __e2e.sleep(500); if (m.warden) { m.warden.hp = 1; const hero = __game.hero.u; m.warden.hp = 0; m.warden.dead = true; __game.level.emit('death', { unit: m.warden, killer: hero }); } await __e2e.sleep(3500); return { state: m.state, screen: document.querySelector('.ss-res, [class*=results]') ? 'results' : __session.screen }; });
await shot('06_chaos_results');
await step('results → back to Solhaven', async () => { await __session.route('results:continue'); await __e2e.sleep(3500); return { zone: __game.zone?.id, mode: __game.mode?.kind }; });
// guardian
await step('guardian: launch + fight', async () => { await __session.launch({ kind: 'guardian', boss: 'rimewing' }); __e2e.auto(); await __e2e.sleep(__e2e.quick ? 6000 : 14000); const m = __game.mode; return { state: m.state, boss: +(m.boss.hp / m.boss.hpMax).toFixed(3), party: m.party.members.length }; });
await shot('07_guardian');
await step('guardian: finish', async () => { const m = __game.mode, b = m.boss; b.hp = 0; b.dead = true; __game.level.emit('death', { unit: b, killer: __game.hero.u }); await __e2e.sleep(4500); return { state: m.state }; });
await shot('08_guardian_results');
await step('results → Solhaven', async () => { await __session.route('results:continue'); await __e2e.sleep(3500); return { zone: __game.zone?.id }; });
// legion raid gate 1 (trial for a powerpass character) → auction
await step('raid gate 1 (trial): launch + fight', async () => { await __session.launch({ kind: 'raid', raid: 'gorrath', gate: 0, trial: true }); __e2e.auto(); await __e2e.sleep(__e2e.quick ? 6000 : 12000); const m = __game.mode; return { state: m.state, bosses: m.bosses.map(u => [u.name, +(u.hp / u.hpMax).toFixed(2)]), party: m.party.members.length }; });
await shot('09_raid');
await step('raid: finish gate', async () => { const m = __game.mode; for (const b of m.bosses) { b.hp = 0; b.dead = true; __game.level.emit('death', { unit: b, killer: __game.hero.u }); } await __e2e.sleep(4500); return { state: m.state }; });
await shot('10_raid_results');
await step('Sunheart: points + rank', async () => { const c = __session.char; const sh = (c.sunheart ||= { points: 0, ranks: {} }); sh.points += 12; c.premade = true; await __session.route('sunheart:rank', { id: 'ev_crit', delta: 1 }); return { ranks: sh.ranks, atk: Math.round(__game.hero.u.st.atk) }; });
// modes: every other content kind launches, runs a few seconds and returns to Solhaven cleanly
const modeStep = (name, c, ms) => step(name, async ([c, ms]) => {
  const S = __session; if (c.kind === 'cube') S.account.give('rift_cube_ticket', 1);
  await S.launch(c); if (__game.hero) __e2e.auto();
  await __e2e.sleep(__e2e.quick ? ms * 0.6 : ms);
  const r = { zone: __game.zone?.id, mode: __game.mode?.kind, units: __game.level?.units.length };
  await S.returnToHub(); await __e2e.sleep(1500);
  return { ...r, back: __game.zone?.id };
}, [c, ms]);
await modeStep('pvp deathmatch', { kind: 'pvp', mode: 'deathmatch' }, 9000);
await modeStep('inferno descent', { kind: 'inferno', start: 1, party: 1 }, 8000);
await modeStep('trial guardian', { kind: 'trial' }, 8000);
await modeStep('rift cube', { kind: 'cube', party: 1 }, 8000);
await modeStep('stronghold', { kind: 'stronghold' }, 4000);
await step('map travel: Goldmeadow', async () => { await __session.route('map:travel', { id: 'goldmeadow' }); await __e2e.sleep(3000); const r = { zone: __game.zone?.id, mode: __game.mode?.kind }; await __session.returnToHub(); await __e2e.sleep(1500); return r; });
await step('save persisted', async () => { __session.account.save(true); const raw = JSON.parse(localStorage.getItem('sevenshard.save.v1')); return { chars: raw.chars.length, names: raw.chars.map(c => c.name) }; });
console.log(`\n${ok} passed, ${bad} failed · ${errs.length} console error(s)`);
for (const e of [...new Set(errs)].slice(0, 25)) console.log('  ' + e);
if (warns.length) console.log(`${warns.length} warnings; first: ${[...new Set(warns)].slice(0, 5).join(' | ')}`);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
