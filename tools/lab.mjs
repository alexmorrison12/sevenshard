// Builds a standalone lab page from an entry file:  node tools/lab.mjs src/lab/foo.js  →  dist/lab/foo.html
// Lab pages are for building one module in isolation (a model, an effect, a zone, a window) and screenshotting it.
// Add --watch to rebuild on every change.
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path';

const entry = process.argv[2];
if (!entry) { console.error('usage: node tools/lab.mjs src/lab/<name>.js [--watch]'); process.exit(1); }
const name = path.basename(entry, '.js');
const WATCH = process.argv.includes('--watch');

function css() {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'lab') walk(p); } else if (f.endsWith('.css')) out.push(fs.readFileSync(p, 'utf8')); } };
  walk('src');
  return out.join('\n');
}
function write(js) {
  fs.mkdirSync('dist/lab', { recursive: true });
  fs.writeFileSync(`dist/lab/${name}.html`, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · lab</title><style>html,body{margin:0;height:100%;background:#0b0e16;color:#dde;font:12px system-ui,sans-serif;overflow:hidden}${css()}</style></head><body><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
}
const opts = { entryPoints: [entry], bundle: true, format: 'iife', write: false, target: 'es2022', sourcemap: 'inline', logLevel: 'warning', define: { __DEV__: 'true' } };
if (WATCH) {
  const ctx = await esbuild.context({ ...opts, plugins: [{ name: 'w', setup(b) { b.onEnd(r => { if (!r.errors.length) { write(r.outputFiles[0].text); console.log(`[${new Date().toLocaleTimeString()}] dist/lab/${name}.html`); } }); } }] });
  await ctx.watch(); console.log('watching', entry);
} else {
  const r = await esbuild.build(opts);
  write(r.outputFiles[0].text);
  console.log(`dist/lab/${name}.html`);
}
