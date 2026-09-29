// Build every registered zone through Session.loadZone; report build time, draw calls, triangles and errors.
// node tools/zones.mjs [id,...]
import puppeteer from 'puppeteer-core';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--disable-background-timer-throttling'], defaultViewport: { width: 1280, height: 720 } });
const p = await b.newPage();
let errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if (m.type() === 'error' || (m.type() === 'warning' && /\[(zone|world|precompile)/.test(t))) errs.push(t.slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Zoner', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); });
const ids = (await p.evaluate(() => Object.keys(window.__ZONES))).filter(id => !only || only.includes(id));
for (const id of ids) {
  errs = [];
  const r = await p.evaluate(async id => {
    const t0 = performance.now();
    const z = await __session.loadZone(id, { kind: window.__ZONES[id].kind });
    const ms = Math.round(performance.now() - t0);
    __session.spawnMe(z.anchors.spawn || z.anchors['stage1:spawn'] || { x: 0, z: 0 });
    await new Promise(r => setTimeout(r, 1200));
    const R = __game.renderer.r.info.render;
    return { ms, fallback: !!z.dev || z.id !== id, calls: R.calls, ktris: Math.round(R.triangles / 1000), anchors: Object.keys(z.anchors || {}).length, spawn: !!(z.anchors.spawn || z.anchors['stage1:spawn']) };
  }, id).catch(e => ({ error: e.message.split('\n')[0] }));
  console.log(`${id.padEnd(20)} ${JSON.stringify(r)}${errs.length ? '  ✘ ' + errs.slice(0, 2).join(' | ') : ''}`);
}
await b.close();
