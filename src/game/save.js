// Persistence: the whole account (roster-wide progress + up to 6 characters) in localStorage, debounced writes,
// versioned migrations, and portable save codes (gzip + base64) for moving between browsers.
const KEY = 'sevenshard.save.v1';
let memory = null;          // when storage is unavailable (private mode, sandboxed embeds)

export function loadRaw() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
  catch { return memory ? JSON.parse(memory) : null; }
}
let timer = 0, pending = null;
export function saveRaw(data, immediate = false) {
  pending = data;
  if (immediate) return flush();
  if (!timer) timer = setTimeout(flush, 800);
}
export function flush() {
  clearTimeout(timer); timer = 0;
  if (!pending) return;
  const s = JSON.stringify(pending, (k, v) => v instanceof Set ? [...v] : v);
  try { localStorage.setItem(KEY, s); } catch { memory = s; }
  pending = null;
}
addEventListener('beforeunload', flush);
addEventListener('pagehide', flush);
export function wipe() { try { localStorage.removeItem(KEY); } catch { /* */ } memory = null; }

async function gz(str, dir) {
  if (typeof CompressionStream === 'undefined') return null;
  const s = new Blob([str]).stream().pipeThrough(dir === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
/** portable save code */
export async function exportCode(data) {
  const json = JSON.stringify(data);
  const bytes = await gz(json, 'c');
  const b = bytes || new TextEncoder().encode(json);
  let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return (bytes ? 'SSZ1' : 'SSJ1') + btoa(bin);
}
export async function importCode(code) {
  code = code.trim();
  const tag = code.slice(0, 4), bin = atob(code.slice(4));
  const b = Uint8Array.from(bin, c => c.charCodeAt(0));
  if (tag === 'SSZ1') { const blob = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')); return JSON.parse(await new Response(blob).text()); }
  if (tag === 'SSJ1') return JSON.parse(new TextDecoder().decode(b));
  throw new Error('Not a SEVENSHARD save code');
}
