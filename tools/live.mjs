// Smoke test a deployed build: node tools/live.mjs [url] [shot.png]
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'https://alexmorrison12.github.io/sevenshard/', out = process.argv[3];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 90000 });
console.log('title ready', Date.now() - t0, 'ms');
const r = await p.evaluate(async () => {
  const S = __session, sleep = ms => new Promise(r => setTimeout(r, ms));
  await S.route('title:enter'); if (S.screen === 'charselect') await S.route('select:create');
  await S.route('create:confirm', { cls: 'bladedancer', sex: 'f', look: {}, name: 'Livecheck' + Math.floor(Math.random() * 999), path: 'powerpass' }); await sleep(3000);
  const city = { zone: __game.zone?.id, units: __game.level.units.length };
  await S.launch({ kind: 'chaos', tier: 1 }); const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); await sleep(6000);
  return { city, chaos: { zone: g.zone?.id, pct: Math.round(g.mode.pct), fps: Math.round(g.renderer.fps) } };
});
console.log(JSON.stringify(r));
if (out) await p.screenshot({ path: out });
console.log('errors', errs);
await b.close();
