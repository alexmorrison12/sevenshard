// Visual + error sweep of every window: node tools/windows.mjs [outdir]
import puppeteer from 'puppeteer-core';
const out = process.argv[2] || '';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('[error] ' + m.text().slice(0, 240)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'bladedancer', sex: 'f', look: {}, name: 'Windows', path: 'powerpass' }); await new Promise(r => setTimeout(r, 3000)); });
const ids = ['character', 'inventory', 'skills', 'engravings', 'sunheart', 'honing', 'stone', 'cards', 'gems', 'market', 'stronghold', 'compass', 'tome', 'collectibles', 'rapport', 'mail', 'guild', 'leaderboards', 'partyfinder', 'quests', 'map', 'meter', 'settings', 'social', 'nexus', 'wardrobe', 'vendor'];
for (const id of ids) {
  const e0 = errs.length;
  const r = await p.evaluate(async id => { try { __session.menu(id); } catch (e) { return 'menu threw: ' + e.message; } await new Promise(r => setTimeout(r, 500)); return __session.ui.isOpen?.(id) ? 'open' : 'not open'; }, id);
  if (out) await p.screenshot({ path: `${out}/win_${id}.jpg`, quality: 72 });
  await p.evaluate(id => { try { __session.ui.close(id); } catch { } }, id);
  console.log(`${id.padEnd(14)} ${r}${errs.length > e0 ? '  ✘ ' + errs.slice(e0).join(' | ').slice(0, 300) : ''}`);
}
console.log(`\n${errs.length} error(s)`);
await b.close();
