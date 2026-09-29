// Render-cost probe: draw calls / triangles / fps in city, chaos and raid. node tools/perf.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--disable-background-timer-throttling'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
const sample = () => p.evaluate(async () => {
  const g = __game, R = g.renderer.r; const t0 = performance.now(); let frames = 0, calls = 0, tris = 0, worst = 0, last = performance.now();
  await new Promise(res => { const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++; calls += R.info.render.calls; tris += R.info.render.triangles; if (now - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  return { fps: Math.round(frames / 4), calls: Math.round(calls / frames), ktris: Math.round(tris / frames / 1000), worstMs: Math.round(worst), scale: g.renderer.scale?.toFixed?.(2), heapMB: heap, geos: R.info.memory.geometries, tex: R.info.memory.textures };
});
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'oathkeeper', sex: 'm', look: {}, name: 'Perf', path: 'powerpass' }); await new Promise(r => setTimeout(r, 4000)); });
console.log('city ', JSON.stringify(await sample()));
await p.evaluate(async () => { await __session.launch({ kind: 'chaos', tier: 2 }); const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; await new Promise(r => setTimeout(r, 5000)); });
console.log('chaos', JSON.stringify(await sample()));
await p.evaluate(async () => { await __session.launch({ kind: 'raid', raid: 'gorrath', gate: 1, trial: true }); const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; await new Promise(r => setTimeout(r, 7000)); });
console.log('raid ', JSON.stringify(await sample()));
await b.close();
