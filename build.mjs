// Bundles src/ into one self-contained HTML page.
//   dist/index.html   the game: every script, style, mesh, texture, sound and song is generated or inlined
// usage: node build.mjs [--min] [--watch] [--out=dir]
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const MIN = process.argv.includes('--min');
const WATCH = process.argv.includes('--watch');
const OUT = (process.argv.find(a => a.startsWith('--out=')) || '--out=dist').slice(6);
const SITE = 'https://alexmorrison12.github.io/sevenshard/';
const DESC = 'A Lost Ark-style isometric action MMO in one browser tab: eight classes, chaos dungeons, guardian hunts, an eight-player legion raid, sailing, and co-op with friends by room code.';

// Every .css file under src/ is inlined, sorted by path so ui/a-*.css can set tokens for the rest.
function readCss() {
  const out = [];
  const walk = d => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (f !== 'lab') walk(p); }
      else if (f.endsWith('.css')) out.push(`/* ${p} */\n` + fs.readFileSync(p, 'utf8'));
    }
  };
  walk('src');
  return out.join('\n');
}

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8"/><stop offset=".55" stop-color="#f3b54a"/><stop offset="1" stop-color="#8a4a12"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#0b1020"/><path d="M32 6 L41 30 L32 58 L23 30 Z" fill="url(#g)"/><path d="M32 6 L41 30 L32 34 Z" fill="#fff" opacity=".45"/><circle cx="32" cy="30" r="3.2" fill="#fff"/></svg>`;

function writePage(js) {
  js = js.replace(/<\/script/gi, '<\\/script');
  const page = fs.readFileSync('src/index.html', 'utf8')
    .replace('/*__CSS__*/', () => readCss())
    .replace('/*__JS__*/', () => js);
  const meta = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">',
    `<meta name="description" content="${DESC}">`,
    '<meta name="theme-color" content="#070a14">',
    `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(ICON)}">`,
    '<meta property="og:title" content="SEVENSHARD">',
    `<meta property="og:description" content="${DESC}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${SITE}">`,
    `<meta property="og:image" content="${SITE}og.jpg">`,
    '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
  const split = page.indexOf('</style>') + '</style>'.length;
  const doc = `<!doctype html>\n<html lang="en">\n<head>\n${meta}\n${page.slice(0, split)}\n</head>\n<body>\n${page.slice(split)}\n</body>\n</html>\n`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/index.html`, doc);
  if (fs.existsSync('public')) for (const f of fs.readdirSync('public')) if (!f.startsWith('.')) fs.copyFileSync(path.join('public', f), path.join(OUT, f));
  return doc.length;
}

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: MIN,
  format: 'iife',
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
  sourcemap: MIN ? false : 'inline',
  define: { __DEV__: MIN ? 'false' : 'true' },
};

if (WATCH) {
  const ctx = await esbuild.context({
    ...opts,
    plugins: [{
      name: 'html', setup(b) {
        b.onEnd(r => {
          if (r.errors.length) return;
          const size = writePage(r.outputFiles[0].text);
          console.log(`[${new Date().toLocaleTimeString()}] built ${(size / 1024).toFixed(0)} KB`);
        });
      },
    }],
  });
  await ctx.watch();
  let last = '';
  setInterval(() => {
    const files = [];
    const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(css|html)$/.test(f)) files.push(p); } };
    walk('src');
    const sig = files.map(f => f + fs.statSync(f).mtimeMs).join('|');
    if (last && sig !== last) ctx.rebuild().catch(() => {});
    last = sig;
  }, 600);
  console.log('watching…');
} else {
  const t0 = Date.now();
  const r = await esbuild.build(opts);
  const size = writePage(r.outputFiles[0].text);
  console.log(`built in ${Date.now() - t0}ms, ${(size / 1024).toFixed(0)} KB`);
}
