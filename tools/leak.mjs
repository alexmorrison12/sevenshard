// Memory across repeated zone transitions (leak check): node tools/leak.mjs [cycles]
import puppeteer from 'puppeteer-core';
const cycles = +(process.argv[2] || 4);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--js-flags=--expose-gc', '--enable-precise-memory-info'], defaultViewport: { width: 1280, height: 720 } });
const p = await b.newPage();
const cdp = await p.target().createCDPSession();
const mem = async label => { await p.evaluate(() => { window.gc?.(); window.gc?.(); }); const m = await cdp.send('Runtime.getHeapUsage'); const r = await p.evaluate(() => { const i = __game.renderer.r.info.memory; return { pm: Math.round(performance.memory.usedJSHeapSize / 1048576), geo: i.geometries, tex: i.textures, units: __game.level?.units.length, scene: __game.scene.children.length }; }); console.log(label.padEnd(12), 'heap', Math.round(m.usedSize / 1048576), 'MB · perf', r.pm, 'MB · geo', r.geo, '· tex', r.tex, '· units', r.units, '· scene kids', r.scene); };
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'pistoleer', sex: 'm', look: {}, name: 'Leaky', path: 'powerpass' }); await new Promise(r => setTimeout(r, 3500)); });
await mem('city 0');
for (let i = 1; i <= cycles; i++) {
  await p.evaluate(async () => { await __session.launch({ kind: 'chaos', tier: 1 }); await new Promise(r => setTimeout(r, 2500)); });
  await mem(`chaos ${i}`);
  await p.evaluate(async () => { await __session.returnToHub(); await new Promise(r => setTimeout(r, 2500)); });
  await mem(`city ${i}`);
}
await b.close();
