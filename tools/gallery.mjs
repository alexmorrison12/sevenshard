// One in-fight screenshot per content: node tools/gallery.mjs <outdir> [list]
import puppeteer from 'puppeteer-core';
const out = process.argv[2];
const list = (process.argv[3] || 'guardian:rimewing,guardian:cinderhorn,guardian:sandmaw,guardian:kurai,raid:oratory:0,raid:oratory:1,raid:gorrath:0,raid:gorrath:1').split(',');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--disable-background-timer-throttling'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'starcaller', sex: 'f', look: {}, name: 'Gallery', path: 'raid' }); await new Promise(r => setTimeout(r, 2500)); });
for (const what of list) {
  const [k, a, gt] = what.split(':');
  await p.evaluate(async (k, a, gt) => {
    await __session.launch(k === 'raid' ? { kind: 'raid', raid: a, gate: +gt } : { kind: 'guardian', boss: a });
    const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9;
    await new Promise(r => setTimeout(r, 7000));
  }, k, a, gt);
  await p.screenshot({ path: `${out}/g_${what.replace(/:/g, '_')}.jpg`, quality: 80 });
  console.log(what, JSON.stringify(await p.evaluate(() => ({ zone: __game.zone?.id, boss: __game.mode?.boss?.name, fps: Math.round(__game.renderer.fps) }))));
}
console.log('errors', errs.slice(0, 6));
await b.close();
