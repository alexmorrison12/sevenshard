// First-minutes capture for a new "Play the Story" character: node tools/newplayer.mjs <outdir> [frames] [intervalMs]
import puppeteer from 'puppeteer-core';
const [out, n = 12, iv = 2500] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await new Promise(r => setTimeout(r, 1200)); });
await p.screenshot({ path: `${out}/np_00_create.jpg`, quality: 80 });
await p.evaluate(async () => { await __session.route('create:confirm', { cls: 'bladedancer', sex: 'f', look: { face: 3, hair: 5, hairColor: 0x202020, skin: 2, eyes: 0x8a3ab0, height: 1, build: 0.4, marks: 1 }, name: 'Newbie', path: 'story' }); });
for (let i = 1; i <= +n; i++) {
  await new Promise(r => setTimeout(r, +iv));
  await p.screenshot({ path: `${out}/np_${String(i).padStart(2, '0')}.jpg`, quality: 78 });
  const st = await p.evaluate(() => ({ zone: __game.zone?.id, mode: __game.mode?.kind, beat: __game.mode?.beat, cut: !!__game.mode?.cutscene, input: !__game.inputBlocked }));
  console.log(i, JSON.stringify(st));
}
console.log('errors', errs.slice(0, 6));
await b.close();
