// Screenshot one window for a fresh powerpass character: node tools/shotwin.mjs <windowId> <out.png> [cls]
import puppeteer from 'puppeteer-core';
const [id, out, cls = 'reaver'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async cls => { await __session.route('title:enter'); await __session.route('create:confirm', { cls, sex: 'f', look: {}, name: 'Portrait', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); }, cls);
await p.evaluate(async id => { __session.menu(id); await new Promise(r => setTimeout(r, 1500)); }, id);
await p.screenshot({ path: out });
console.log('errors', errs);
await b.close();
