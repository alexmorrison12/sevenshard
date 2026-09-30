// Co-op in the open world: A hosts, B joins, A travels (map:travel) or launches content; report what B sees.
// node tools/coopfield.mjs <place> [shotsDir]   place: goldmeadow|thornwood|ashen_ridge|pipsprout|sail|island:<id>|solhaven
import puppeteer from 'puppeteer-core';
const [place = 'ashen_ridge', shots, at] = process.argv.slice(2);
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], defaultViewport: { width: 1280, height: 720 } });
const [ba, bb] = [await launch(), await launch()];
const A = await ba.newPage(), B = await bb.newPage();
const errs = [];
for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(`${n} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(`${n} ${m.text().slice(0, 200)}`); }); }
const fresh = async p => { await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 }); };
await fresh(A); await fresh(B);
await A.evaluate(async () => { await __session.route('title:enter'); __session.hostMode = true; await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Hosty', path: 'powerpass' }); });
let code = null; for (let i = 0; i < 40 && !code; i++) { await new Promise(r => setTimeout(r, 500)); code = await A.evaluate(() => __game.net?.code || null); }
if (!code) { console.log('no room'); process.exit(1); }
await B.evaluate(async code => { __session.joinCode = code; await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'songweaver', sex: 'f', look: {}, name: 'Guesty', path: 'powerpass' }); }, code);
await new Promise(r => setTimeout(r, 7000));
await A.evaluate(async place => {
  if (place === 'solhaven') return;
  if (place === 'sail') return __session.launch({ kind: 'sail', to: 'coinflip' });
  if (place.startsWith('island:')) return __session.launch({ kind: 'island', island: place.split(':')[1] });
  return __session.route('map:travel', { id: place });
}, place);
await new Promise(r => setTimeout(r, 12000));
if (at) {
  const [x, z] = at.split(',').map(Number);
  for (const [p, dx] of [[A, 0], [B, 1.5]]) await p.evaluate((x, z) => { const u = __game.hero.u, q = __game.level.nav.nearest(x, z, 6, 0.3) || { x, z }; u.pos.x = q.x; u.pos.z = q.z; __game.cam.snap(u.pos); }, x + dx, z);
  await new Promise(r => setTimeout(r, 4000));
}
const see = p => p.evaluate(() => {
  const g = __game, me = g.hero?.u, L = g.level;
  const units = L.units.filter(u => u !== me);
  const ph = units.filter(u => u.model?.placeholder).map(u => `${u.kind}:${u.type || u.cls || u.name}`);
  const byKind = {}; for (const u of units) byKind[u.kind] = (byKind[u.kind] || 0) + 1;
  const partyHud = __session.hud()?.party;
  const ship = g.mode?.rig ? { x: +g.mode.sh.x.toFixed(1), z: +g.mode.sh.z.toFixed(1) } : null;
  return { zone: g.zone?.id, mode: (g.mode?.passenger ? 'passenger' : g.mode?.kind) || g.mode?.constructor?.name, ship, hover: me?.data.hover ? +me.data.hover.toFixed(2) : 0, me: me && { x: +me.pos.x.toFixed(1), z: +me.pos.z.toFixed(1), scale: +(me.model?.root.scale.x || 1).toFixed(2), visible: me.model?.root.visible },
    units: byKind, placeholders: ph.length, placeholderKinds: [...new Set(ph)].slice(0, 12), party: partyHud ? partyHud.map(x => x.name) : null,
    others: units.filter(u => u.kind === 'hero' && (u.remote || u.puppet) && !u.data.sim).map(u => ({ n: u.name, scale: +(u.model?.root.scale.x || 1).toFixed(2), x: +u.pos.x.toFixed(1), z: +u.pos.z.toFixed(1) })) };
});
if (process.env.BISECT) {
  for (const P of [A, B]) await P.evaluate(() => { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; });
  const r = await B.evaluate(async () => {
    const g = __game, cv = document.createElement('canvas'); cv.width = 64; cv.height = 36; const cx = cv.getContext('2d', { willReadFrequently: true });
    const bright = () => { g.renderer.render(0.016, g.time); cx.drawImage(g.renderer.r.domElement, 0, 0, 64, 36); const d = cx.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; };
    const out = { base: bright(), culprits: [] };
    for (let tries = 0; tries < 80 && out.base > 20; tries++) { await new Promise(r => setTimeout(r, 400)); out.base = bright(); }
    if (out.base <= 20) { __game.timeScale = 0; out.frozen = true; }
    if (out.base > 20) return out;
    const test = (list, depth) => {
      for (const o of list) {
        if (!o.visible) continue;
        o.visible = false; const b = bright(); o.visible = true;
        if (b > 20) { const label = `${o.type}:${o.name || ''}:${o.userData?.kind || ''}`; out.culprits.push({ depth, label, b: Math.round(b), kids: o.children.length, mat: o.material ? (o.material.type + ':' + (o.material.name || '')) : null });
          if (o.children.length && depth < 8) test(o.children, depth + 1); return true; }
      }
      return false;
    };
    test(g.scene.children, 0);
    // global state that every material reads
    const nf = v => v == null ? false : typeof v === 'number' ? !Number.isFinite(v) : (v.isColor ? ![v.r, v.g, v.b].every(Number.isFinite) : v.isVector2 || v.isVector3 || v.isVector4 ? v.toArray().some(x => !Number.isFinite(x)) : v.isMatrix4 ? v.elements.some(x => !Number.isFinite(x)) : false);
    const bad = [];
    const scan = (label, obj) => { for (const [k, u] of Object.entries(obj || {})) if (nf(u?.value ?? u)) bad.push(label + '.' + k); };
    const mats = await import('/src/engine/materials.js').catch(() => null);
    scan('fx.u', g.fx?.u); scan('renderer.F', g.renderer.F); scan('grade', g.renderer.grade); scan('rfx', g.renderer.fx);
    g.scene.traverse(o => { if (o.isLight) { if (nf(o.intensity) || nf(o.color) || nf(o.position) || o.matrixWorld.elements.some(x => !Number.isFinite(x))) bad.push('light:' + o.type); } });
    const cam = g.cam.cam; if (nf(cam.projectionMatrix) || nf(cam.matrixWorld) || nf(cam.position)) bad.push('camera');
    if (g.scene.fog && (nf(g.scene.fog.color) || nf(g.scene.fog.density))) bad.push('fog');
    // shader materials: any non-finite uniform anywhere
    const seen = new Set(); g.scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (seen.has(m)) continue; seen.add(m); for (const [k, u] of Object.entries(m.uniforms || {})) if (nf(u?.value)) bad.push(`mat:${m.type}:${m.name || o.name}:${k}`); if (m.emissive && nf(m.emissive)) bad.push(`emissive:${o.name}`); if (m.color && nf(m.color)) bad.push(`color:${o.name}`); if (nf(m.opacity)) bad.push(`opacity:${o.name}`); } });
    // skinned meshes: bone matrices
    g.scene.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { const bm = o.skeleton.boneMatrices; for (let i = 0; i < bm.length; i++) if (!Number.isFinite(bm[i])) { bad.push('bones:' + (o.name || o.parent?.name || '')); break; } } });
    out.globals = [...new Set(bad)].slice(0, 20);
    const R = g.renderer, gl = R.r.getContext();
    out.lost = gl.isContextLost();
    // straight to the screen, no post
    R.r.setRenderTarget(null); R.r.render(g.scene, g.cam.cam); cx.drawImage(R.r.domElement, 0, 0, 64, 36);
    { const d = cx.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; out.noPost = s / (d.length / 4) / 3; }
    // scene render target contents: NaN / Inf in the HDR buffer?
        out.bloomOff = (() => { const was = R.bloom.enabled; R.bloom.enabled = false; const b = bright(); R.bloom.enabled = was; return b; })();
    return out;
  });
  console.log('B bisect', JSON.stringify(r));
}
if (process.env.FXSPY) {
  await B.evaluate(() => {
    const bad = window.__fxBad = [];
    const nonFinite = (o, path = '', depth = 0) => { if (depth > 3 || o == null) return null; if (typeof o === 'number') return Number.isFinite(o) ? null : path; if (typeof o !== 'object' || o.isObject3D) return null; for (const [k, v] of Object.entries(o)) { const r = nonFinite(v, path + '.' + k, depth + 1); if (r) return r; } return null; };
    const pr = __game.presenter;
    for (const fn of ['onFx', 'onZone', 'onTelegraph', 'onProjectile', 'onDamage']) { const o = pr[fn].bind(pr); pr[fn] = ev => { const r = nonFinite({ ...ev, unit: undefined, src: undefined, tgt: undefined, follow: undefined, owner: undefined, homing: undefined, hitSet: undefined, ctx: undefined }); if (r && bad.length < 30) bad.push(fn + ':' + (ev.preset || ev.kind || ev.shape || '') + ':' + r); return o(ev); }; }
    const fx = __game.fx;
    for (const fn of ['play', 'slash', 'burst', 'shockwave', 'hit', 'number', 'telegraph', 'projectile', 'decal', 'death']) { if (!fx[fn]) continue; const o = fx[fn].bind(fx); fx[fn] = (...a) => { for (const x of a) { const r = nonFinite(x?.pos?.isVector3 ? { ...x, pos: { x: x.pos.x, y: x.pos.y, z: x.pos.z } } : x); if (r && bad.length < 30) bad.push('fx.' + fn + ':' + (typeof a[0] === 'string' ? a[0] : '') + ':' + r); } return o(...a); }; }
  });
  await A.evaluate(() => { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; });
  await B.evaluate(() => { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; });
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 4000)); if (shots) await B.screenshot({ path: `${shots}/spy_${i}.jpg`, quality: 50 });
    console.log('B frame', i, JSON.stringify(await B.evaluate(() => { const g = __game, u = g.hero.u, c = g.cam.cam.position; const R = g.renderer; return { me: [+u.pos.x.toFixed(1), +u.pos.y.toFixed(1), +u.pos.z.toFixed(1)], cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], scale: R.scale, calls: R.r.info.render.calls, fxd: { hurt: R.fx.hurt, flash: R.fx.flash, desat: R.fx.desat, letterbox: R.fx.letterbox }, exp: R.grade?.exposure, dead: u.dead }; })));
  }
  console.log('B fx non-finite', JSON.stringify(await B.evaluate(() => window.__fxBad)));
}
if (process.env.EXPERIMENTS && shots) {
  const ex = [
    ['base', () => {}],
    ['no-zone', () => { __game.zone.root.visible = false; }],
    ['zone-only', () => { __game.zone.root.visible = true; for (const u of __game.level.units) if (u.model) u.model.root.visible = false; }],
    ['no-bloom', () => { for (const u of __game.level.units) if (u.model) u.model.root.visible = true; __game.renderer.grade.bloom = 0; }],
  ];
  for (const [name, fn] of ex) { await B.evaluate(fn); await new Promise(r => setTimeout(r, 700)); await B.screenshot({ path: `${shots}/ex_${name}.jpg`, quality: 60 }); }
  console.log('B scene kids', await B.evaluate(() => __game.scene.children.map(o => `${o.type}:${o.name || ''}:${o.visible ? 1 : 0}`).join(' | ').slice(0, 1500)));
}
if (process.env.NANPROBE) console.log('B nan', JSON.stringify(await B.evaluate(() => {
  const bad = []; const g = __game;
  g.scene.traverse(o => { if (!o.visible) return; const e = o.matrixWorld.elements; if (e.some(v => !Number.isFinite(v))) bad.push(`matrix:${o.type}:${o.name || o.parent?.name || ''}`);
    const pa = o.geometry?.attributes?.position; if (pa && o.isMesh && pa.count < 200000) { for (let i = 0; i < pa.array.length; i += 3) if (!Number.isFinite(pa.array[i])) { bad.push(`geo:${o.name || o.type}:${o.parent?.name || ''}`); break; } }
    const im = o.instanceMatrix?.array; if (im) { for (let i = 0; i < im.length; i++) if (!Number.isFinite(im[i])) { bad.push(`inst:${o.name || o.type}`); break; } }
    const u = o.material?.uniforms; if (u) for (const [k, v] of Object.entries(u)) { const val = v?.value; if (typeof val === 'number' && !Number.isFinite(val)) bad.push(`uniform:${k}:${o.name || o.type}`); else if (val?.isVector3 && ![val.x, val.y, val.z].every(Number.isFinite)) bad.push(`uniformv:${k}:${o.name || o.type}`); } });
  for (const u of g.level.units) if (![u.pos.x, u.pos.y, u.pos.z, u.facing].every(Number.isFinite)) bad.push(`unit:${u.kind}:${u.name}:${u.pos.x},${u.pos.y},${u.pos.z},${u.facing}`);
  const G = g.renderer.grade; const gr = Object.entries(G || {}).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v)).map(([k]) => 'grade:' + k);
  const fxv = g.renderer.fx; const fr = Object.entries(fxv || {}).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v)).map(([k]) => 'rfx:' + k);
  return { bad: [...new Set(bad)].slice(0, 20), gr, fr, cam: g.cam.cam.position.toArray().map(v => +v.toFixed(2)) };
})));
console.log('A', JSON.stringify(await see(A)));
console.log('B', JSON.stringify(await see(B)));
if (shots) { await A.screenshot({ path: `${shots}/cf_${place.replace(':', '_')}_A.jpg`, quality: 75 }); await B.screenshot({ path: `${shots}/cf_${place.replace(':', '_')}_B.jpg`, quality: 75 }); }
console.log(`${errs.length} errors`); for (const e of [...new Set(errs)].slice(0, 10)) console.log(' ', e);
await ba.close(); await bb.close();
