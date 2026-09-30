// Co-op chaos checks: guest revives next to the host on a later stage; the guest's meter includes the host's damage.
// node tools/coopchaos.mjs
import puppeteer from 'puppeteer-core';
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], defaultViewport: { width: 1280, height: 720 } });
const [ba, bb] = [await launch(), await launch()];
const A = await ba.newPage(), B = await bb.newPage();
const errs = [];
for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(`${n} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(`${n} ${m.text().slice(0, 200)}`); }); }
const fresh = async p => { await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 }); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await fresh(A); await fresh(B);
await A.evaluate(async () => { await __session.route('title:enter'); __session.hostMode = true; await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Hosty', path: 'powerpass' }); });
let code = null; for (let i = 0; i < 40 && !code; i++) { await sleep(500); code = await A.evaluate(() => __game.net?.code || null); }
await B.evaluate(async code => { __session.joinCode = code; await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'songweaver', sex: 'f', look: {}, name: 'Guesty', path: 'powerpass' }); }, code);
await sleep(7000);
// the Nexus way in, with AI fill on
await A.evaluate(() => __session.nexusEnter({ id: 'chaos:1', aiFill: true }));
await sleep(9000);
const auto = p => p.evaluate(() => { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); });
await auto(A); await auto(B);
console.log('party (host)', JSON.stringify(await A.evaluate(() => ({ members: __game.party?.members.length, names: __session.hud()?.party?.map(x => x.name) }))));
console.log('party (guest)', JSON.stringify(await B.evaluate(() => __session.hud()?.party?.map(x => x.name))));
await sleep(8000);
// host moves the party to stage 2
await A.evaluate(async () => { const m = __game.mode; m.addPct(100); await new Promise(r => setTimeout(r, 400)); const u = __game.hero.u; u.pos.x = m.portal.x; u.pos.z = m.portal.z; await new Promise(r => setTimeout(r, 2500)); });
await sleep(3000);
const where = p => p.evaluate(() => ({ stage: __game.mode?.stage, me: [+__game.hero.u.pos.x.toFixed(1), +__game.hero.u.pos.z.toFixed(1)] }));
console.log('after portal  A', JSON.stringify(await where(A)), ' B', JSON.stringify(await where(B)));
// the guest dies on stage 2 and revives
await B.evaluate(() => { const u = __game.hero.u; u.hp = 0; u.dead = true; u.deadT = 0; __game.level.emit('death', { unit: u, killer: null }); });
await sleep(8500);
const a = await where(A), b = await B.evaluate(() => ({ me: [+__game.hero.u.pos.x.toFixed(1), +__game.hero.u.pos.z.toFixed(1)], dead: __game.hero.u.dead }));
console.log('after revive  host', JSON.stringify(a), ' guest', JSON.stringify(b), ' distance', Math.hypot(a.me[0] - b.me[0], a.me[1] - b.me[1]).toFixed(1));
const meter = p => p.evaluate(() => (window.__meta?.meter?.view?.(0)?.rows || []).map(r => [r.name, Math.round(r.dmg)]));
console.log('meter (host) ', JSON.stringify(await meter(A)));
console.log('meter (guest)', JSON.stringify(await meter(B)));
console.log(`${errs.length} errors`); for (const e of [...new Set(errs)].slice(0, 8)) console.log(' ', e);
await ba.close(); await bb.close();
