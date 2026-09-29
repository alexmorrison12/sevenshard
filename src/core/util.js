// Small shared helpers: number formatting, ids, time (daily/weekly resets), clamping, angles.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrapAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
/** facing angle whose forward vector (−sin f, 0, −cos f) points along (dx, dz) */
export const facingOf = (dx, dz) => Math.atan2(-dx, -dz);
export const fwdX = f => -Math.sin(f);
export const fwdZ = f => -Math.cos(f);

const NF = new Intl.NumberFormat('en-US');
export const fmt = n => NF.format(Math.round(n));
/** 1234 → 1.2K, 12_345_678 → 12.3M */
export function short(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
  return fmt(n);
}
export function mmss(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

let _uid = 1;
export const uid = (p = 'u') => `${p}${Date.now().toString(36)}${(_uid++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

// ---- resets (Lost Ark style: daily 10:00 UTC, weekly Wednesday 10:00 UTC) ----
const H = 3600e3, D = 24 * H;
/** id of the current "game day" (changes at 10:00 UTC) */
export function dayId(t = Date.now()) { return Math.floor((t - 10 * H) / D); }
/** id of the current "game week" (changes Wednesday 10:00 UTC). Epoch day 0 (1970-01-01) was a Thursday. */
export function weekId(t = Date.now()) { return Math.floor((t - 10 * H - 6 * D) / (7 * D)); }
export function nextDaily(t = Date.now()) { return (dayId(t) + 1) * D + 10 * H; }
export function nextWeekly(t = Date.now()) { return (weekId(t) + 1) * 7 * D + 6 * D + 10 * H; }
export function dateKey(t = Date.now()) { return new Date(t - 10 * H).toISOString().slice(0, 10); }
