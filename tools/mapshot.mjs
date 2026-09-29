// World map screenshot: node tools/mapshot.mjs <out.png>
import puppeteer from 'puppeteer-core';
const out = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Mapper', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); __session.menu('map'); await new Promise(r => setTimeout(r, 500)); const w = __session.ui.get('map'); w.view = 'world'; w.render(w.d || __session.windowData('map')); await new Promise(r => setTimeout(r, 400)); });
await p.screenshot({ path: out });
console.log('errors', errs);
await b.close();
