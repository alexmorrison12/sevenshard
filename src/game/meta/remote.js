// Optional global leaderboards through Supabase (see supabase/schema.sql and src/game/meta/README.md).
// Clients never touch the table: only the security-definer RPCs submit_entry / top_entries are reachable.
// While SUPABASE_URL / SUPABASE_KEY are empty, makeRemote() returns null and every board stays local.
// The publishable (anon) key is safe to ship in the page.
export const SUPABASE_URL = '';   // e.g. 'https://abcdefghijkl.supabase.co'
export const SUPABASE_KEY = '';   // the project's publishable / anon key
// Canonical public address of the game: share cards print it and challenge links point here when the page itself
// runs somewhere a friend can't open (file://, localhost, a sandboxed frame). Empty = always use this page's address.
export const PUBLIC_URL = 'https://alexmorrison12.github.io/sevenshard/';

const TIMEOUT = 6000;
async function rpc(fn, body) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctl?.abort(), TIMEOUT);
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctl?.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `leaderboard ${res.status}`);
    return data;
  } finally { clearTimeout(t); }
}

/** null (local only) or { submit(entry) → Promise<{ ok, rank, first }>, top(board, variant) → Promise<[row]> } */
export function makeRemote() {
  if (!SUPABASE_URL || !SUPABASE_KEY || typeof fetch !== 'function') return null;
  return {
    submit: e => rpc('submit_entry', {
      p_board: e.board, p_variant: e.variant || '', p_name: e.name, p_cls: e.cls, p_guild: e.guild || '',
      p_value: e.value, p_sub: (e.sub || '').slice(0, 80), p_party: (e.party || []).slice(0, 8),
      p_premade: !!e.premade, p_trial: !!e.trial, p_coop: !!e.coop, p_extra: e.extra || {},
    }),
    top: async (board, variant) => {
      const rows = await rpc('top_entries', { p_board: board, p_variant: variant || '' });
      return (Array.isArray(rows) ? rows : []).map(r => ({
        board, variant: variant || '', name: r.name, cls: r.cls, guild: r.guild || null, value: +r.value, sub: r.sub || '',
        party: r.party || [], premade: !!r.premade, trial: !!r.trial, coop: !!r.coop, t: r.at ? Date.parse(r.at) : 0, remote: true,
      }));
    },
  };
}
