// ASCII dump of a zone's nav grid around a point: node tools/navdump.mjs <zone> <x> <z> [radius=4] [toX toZ]
import puppeteer from 'puppeteer-core';
const [zone, X, Z, R = 4, TX, TZ] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 800, height: 450 } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
console.log(await p.evaluate(async (zone, X, Z, R, TX, TZ) => {
  await __session.route('title:enter'); if (__session.screen === 'charselect') await __session.route('select:create');
  await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Navdump' + Math.floor(Math.random() * 999), path: 'powerpass' }); await new Promise(r => setTimeout(r, 1500));
  const z = await __session.loadZone(zone, { kind: 'field' }); __session.spawnMe(z.anchors.spawn);
  const nav = __game.level.nav, c = nav.cell, lines = [];
  for (let zz = Z - R; zz <= Z + R + 1e-6; zz += c) {
    let row = (zz >= 0 ? ' ' : '') + zz.toFixed(1).padStart(6) + ' ';
    for (let xx = X - R; xx <= X + R + 1e-6; xx += c) {
      const here = Math.abs(xx - X) < c / 2 && Math.abs(zz - Z) < c / 2;
      row += here ? '@' : nav.okR(xx, zz, 0.27) ? '.' : nav.ok(xx, zz) ? ':' : '#';
    }
    lines.push(row);
  }
  const info = { okR_027: nav.okR(X, Z, 0.27), ok: nav.ok(X, Z) };
  if (TX != null) { info.los03 = nav.los(X, Z, +TX, +TZ, 0.3); info.moveTowards = nav.move(X, Z, (+TX - X) / 50, (+TZ - Z) / 50, 0.27); }
  return lines.join('\n') + '\n# blocked  : centre ok but body (r .27) not  . walkable  @ point\n' + JSON.stringify(info);
}, zone, +X, +Z, +R, TX, TZ));
await b.close();
