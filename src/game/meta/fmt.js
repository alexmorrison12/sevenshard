// Number / time formatting shared by boards, the meter, share cards and challenges.
const NF = new Intl.NumberFormat('en-US');
export const int = n => NF.format(Math.round(n || 0));
/** 950 → "950", 12_345 → "12.3K", 5_309_311 → "5.31M" */
export function short(n) {
  n = Math.round(n || 0); const a = Math.abs(n);
  if (a < 1000) return '' + n;
  if (a < 1e4) return (n / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
  if (a < 1e6) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  if (a < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}
/** seconds → "1:05" / "1:02:03" */
export function clockS(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
/** clear time with tenths: "3:42.7" */
export function clock(sec) { sec = Math.max(0, sec || 0); return clockS(sec) + '.' + Math.floor((sec % 1) * 10); }
/** milliseconds → "3h 12m", "2d 4h", "45m", "30s" */
export function dur(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
export const pct = (v, d = 0) => (Math.round((v || 0) * 100 * 10 ** d) / 10 ** d).toFixed(d) + '%';
/** ability stone score → "97" | "10/7" */
export const stoneLabel = (a, b) => (a >= 10 || b >= 10 ? `${a}/${b}` : `${a}${b}`);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pretty = id => String(id ?? '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const PVP_TIERS = [[2800, 'Grandmaster'], [2500, 'Master'], [2200, 'Diamond'], [1900, 'Platinum'], [1600, 'Gold'], [1300, 'Silver'], [0, 'Bronze']];
export const pvpTier = r => PVP_TIERS.find(([n]) => r >= n)[1];
