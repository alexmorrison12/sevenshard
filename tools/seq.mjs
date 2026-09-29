// Frame-sequence capture for visual QA: node tools/seq.mjs <chaos|guardian|raid|...> <arg> <outdir> [frames] [intervalMs]
import puppeteer from 'puppeteer-core';
const [kind, arg, out, n = 14, iv = 1500] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: { face: 1, hair: 2, hairColor: 0x3a2616, skin: 2, eyes: 0x3a6ab0, height: 1, build: 0.6, marks: 1 }, name: 'Qa', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); });
await p.evaluate(async (kind, arg) => {
  const c = kind === 'guardian' ? { kind, boss: arg } : kind === 'raid' ? { kind, raid: arg.split(':')[0], gate: +arg.split(':')[1], trial: true } : kind === 'chaos' ? { kind, tier: +arg } : { kind, ...JSON.parse(arg || '{}') };
  await __session.launch(c);
  const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9;
}, kind, arg);
for (let i = 0; i < +n; i++) {
  await new Promise(r => setTimeout(r, +iv));
  await p.screenshot({ path: `${out}/${kind}_${String(i).padStart(2, '0')}.jpg`, quality: 70 });
  const info = await p.evaluate(() => { const g = __game; const cam = g.cam; return { fps: Math.round(g.renderer.fps), scale: g.renderer.scale?.toFixed?.(2), zoom: cam.zoom?.toFixed?.(1), boss: g.mode?.boss ? [g.mode.boss.name, +(g.mode.boss.hp / g.mode.boss.hpMax).toFixed(3), g.mode.boss.pos.y.toFixed(1)] : null, state: g.mode?.state, fx: g.fx?.stats?.() || null }; });
  console.log(i, JSON.stringify(info));
}
console.log('errors', errs.slice(0, 10));
await b.close();
