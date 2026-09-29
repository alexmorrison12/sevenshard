// Title screen screenshot after it settles: node tools/title.mjs <out.png> [w] [h]
import puppeteer from 'puppeteer-core';
const [out, w = 1600, h = 900] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: +w, height: +h } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));
await p.screenshot({ path: out });
await b.close();
