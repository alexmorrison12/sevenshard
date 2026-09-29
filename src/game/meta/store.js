// Local persistence for the meta layer (per browser, shared by every roster in it): the leaderboard entries you and
// your friends posted, raid progress for full-clear times, honing streaks, the pending challenge, panel layout.
// localStorage 'ss.meta.v1'. Never throws (private mode, blocked storage, previews): falls back to memory.
const KEY = 'ss.meta.v1';
const fresh = () => ({ v: 1, entries: [], raids: {}, hone: {}, challenge: null, challenges: [], ui: {}, seen: {} });
let data = null, timer = 0;

/** The live store object (mutate it, then call saveDb()). */
export function db() {
  if (data) return data;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  data = { ...fresh(), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!Array.isArray(data.entries)) data.entries = [];
  if (!Array.isArray(data.challenges)) data.challenges = [];
  return data;
}
/** Persist (debounced; `now` writes immediately). */
export function saveDb(now = false) {
  clearTimeout(timer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(db())); } catch { /* storage unavailable */ } };
  if (now) write(); else timer = setTimeout(write, 250);
}
/** Forget everything (tests / "reset boards"). */
export function resetDb() { data = fresh(); saveDb(true); }

/** Short random id. */
export const rid = (p = 'e') => p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
