// Watch the Raid capture: node tools/watchshot.mjs <outdir> [frames] [intervalMs]
import puppeteer from 'puppeteer-core';
const [out, n = 8, iv = 3000] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--disable-background-timer-throttling'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(() => __session.route('title:watch', {}));
for (let i = 1; i <= +n; i++) { await new Promise(r => setTimeout(r, +iv)); await p.screenshot({ path: `${out}/w_${String(i).padStart(2, '0')}.jpg`, quality: 78 }); console.log(i, JSON.stringify(await p.evaluate(() => ({ watching: __session.watching, boss: __game.mode?.boss?.name, hp: +(__game.mode?.boss?.hp / __game.mode?.boss?.hpMax).toFixed(3), fps: Math.round(__game.renderer.fps) })))); }
console.log('errors', errs.slice(0, 5));
await b.close();
