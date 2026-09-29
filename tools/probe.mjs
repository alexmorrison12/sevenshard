// Quick probe: load the game, report title readiness + console errors. node tools/probe.mjs [ms]
import puppeteer from 'puppeteer-core';
const ms = +(process.argv[2] || 20000);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const t0 = Date.now();
p.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 240)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
try { await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: ms }); console.log('title ready in', Date.now() - t0, 'ms'); }
catch { console.log('title NOT ready after', ms, 'ms; screen =', await p.evaluate(() => window.__session?.screen)); }
await b.close();
