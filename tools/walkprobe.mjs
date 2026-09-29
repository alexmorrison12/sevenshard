// Which candidate points are walkable in a zone? node tools/walkprobe.mjs <zone> "x,z;x,z;..."
import puppeteer from 'puppeteer-core';
const [zone, pts] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 800, height: 450 } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
console.log(await p.evaluate(async (zone, pts) => {
  await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Walker' + Math.floor(Math.random() * 999), path: 'powerpass' }); await new Promise(r => setTimeout(r, 1500));
  const z = await __session.loadZone(zone, { kind: 'island' });
  return pts.split(';').map(s => { const [x, zz] = s.split(',').map(Number); return `${s}: ${z.walkable(x, zz) ? 'walkable' : 'blocked'} h=${z.heightAt(x, zz).toFixed(2)}`; }).join('\n') + '\nanchors: ' + JSON.stringify(Object.fromEntries(Object.entries(z.anchors).slice(0, 14).map(([k, a]) => [k, [a.x, a.z]])));
}, zone, pts));
await b.close();
