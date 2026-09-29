-- SEVENSHARD global leaderboards (client: src/game/meta/remote.js, docs: src/game/meta/README.md).
-- Clients never touch the table: RLS is on with no policies, and only the two security-definer functions
-- submit_entry / top_entries are executable with the publishable (anon) key.
--
-- Periods match src/core/util.js exactly: the day changes at 10:00 UTC (dayId), the week on Wednesday 10:00 UTC
-- (weekId). The server derives the period itself, so a client can only ever post to the current one.
--
-- Run this whole file once in the Supabase SQL editor (it is idempotent: safe to run again after edits).

create table if not exists public.ss_entries (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  board       text not null check (board in ('legion_first', 'legion_nm', 'legion_hm', 'legion_dps', 'legion_support', 'legion_deathless',
                                             'guardian', 'inferno', 'pvp', 'stone', 'honing', 'seeds')),
  variant     text not null default '' check (char_length(variant) <= 16),
  period      text not null check (period = 'all' or period ~ '^[dw][0-9]{1,7}$'),
  name        text not null check (name ~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{1,15}$'),
  cls         text not null check (cls in ('reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound')),
  guild       text check (guild is null or char_length(guild) <= 24),
  value       double precision not null,
  sub         text not null default '' check (char_length(sub) <= 80),
  party       text[] not null default '{}' check (cardinality(party) <= 8),
  premade     boolean not null default false,
  trial       boolean not null default false,
  coop        boolean not null default false,
  extra       jsonb not null default '{}'::jsonb check (pg_column_size(extra) <= 2048),
  ip_hash     text
);
alter table public.ss_entries enable row level security;
create index if not exists ss_entries_board_idx on public.ss_entries (board, variant, period, value);
create index if not exists ss_entries_rate_idx on public.ss_entries (ip_hash, created_at);

-- the current period of a board: 'd<dayId>' (daily guardian), 'w<weekId>' (weekly boards) or 'all'
create or replace function public.ss_period(p_board text) returns text language sql stable set search_path = public as $$
  select case
    when p_board in ('pvp', 'seeds') then 'all'
    when p_board = 'guardian' then 'd' || floor((extract(epoch from now()) * 1000 - 36000000) / 86400000)::bigint
    else 'w' || floor((extract(epoch from now()) * 1000 - 36000000 - 518400000) / 604800000)::bigint
  end;
$$;

-- lower values rank first on these boards / variants (times, odds); higher values everywhere else
create or replace function public.ss_lower_is_better(p_board text, p_variant text) returns boolean language sql immutable as $$
  select p_board in ('legion_first', 'legion_nm', 'legion_hm', 'legion_deathless', 'guardian', 'honing')
      or (p_board = 'inferno' and p_variant = 'fastest100');
$$;

-- is (board, variant, value) plausible? (keeps junk off the boards; the client mirrors these units)
create or replace function public.ss_valid(p_board text, p_variant text, p_value double precision) returns boolean language sql immutable as $$
  select p_value = p_value and case p_board   -- (p_value = p_value is false for NaN)
    when 'legion_first'     then p_variant = '' and p_value between 60000 and 604800000          -- ms after the weekly reset
    when 'legion_nm'        then p_variant in ('full', 'g1', 'g2') and p_value between 30 and 14400 -- seconds
    when 'legion_hm'        then p_variant in ('full', 'g1', 'g2') and p_value between 30 and 14400
    when 'legion_dps'       then p_variant in ('reaver', 'stormfist', 'pistoleer', 'starcaller', 'bladedancer', 'demonbound') and p_value between 1 and 500000000
    when 'legion_support'   then p_variant = '' and p_value between 0 and 100                     -- support score
    when 'legion_deathless' then p_variant = '' and p_value between 30 and 7200
    when 'guardian'         then p_variant = '' and p_value between 5 and 3600
    when 'inferno'          then (p_variant = 'deepest' and p_value between 1 and 100) or (p_variant = 'fastest100' and p_value between 300 and 86400)
    when 'pvp'              then p_variant = '' and p_value between 0 and 5000                    -- rating
    when 'stone'            then p_variant = '' and p_value between 0 and 1011                    -- a*100 + b + (10 - negative)/100
    when 'honing'           then p_variant = '' and p_value > 0 and p_value <= 1                  -- odds of that success (lower = luckier)
    when 'seeds'            then p_variant = '' and p_value between 1 and 1000
    else false end;
$$;

-- best row per player (case-insensitive name) for a board / variant / period
create or replace function public.ss_best(p_board text, p_variant text, p_period text)
returns table (name text, cls text, guild text, value double precision, sub text, party text[], premade boolean, trial boolean, coop boolean, at timestamptz)
language sql stable set search_path = public as $$
  select distinct on (lower(e.name)) e.name, e.cls, e.guild, e.value, e.sub, e.party, e.premade, e.trial, e.coop, e.created_at
  from ss_entries e
  where e.board = p_board and e.variant = p_variant and e.period = p_period
  order by lower(e.name),
    case when ss_lower_is_better(p_board, p_variant) then e.value end asc,
    case when not ss_lower_is_better(p_board, p_variant) then e.value end desc,
    e.created_at asc;
$$;

-- post an entry for the current period → { ok, rank, period }
create or replace function public.submit_entry(
  p_board text, p_variant text, p_name text, p_cls text, p_guild text, p_value double precision, p_sub text,
  p_party text[], p_premade boolean, p_trial boolean, p_coop boolean, p_extra jsonb
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_ip      text := coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), 'unknown');
  v_hash    text := md5(v_ip || 'sevenshard-meta');
  v_variant text := coalesce(p_variant, '');
  v_period  text := ss_period(p_board);
  v_low     boolean := ss_lower_is_better(p_board, coalesce(p_variant, ''));
  v_n       int;
  v_rank    int;
begin
  if not ss_valid(p_board, v_variant, p_value) then raise exception 'invalid entry'; end if;
  if p_party is not null and not (p_party <@ array['reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound']) then
    raise exception 'invalid party';
  end if;
  -- one clear posts a handful of boards at once (gate, full raid, world first, dps, deathless): allow short bursts only
  select count(*) into v_n from ss_entries where ip_hash = v_hash and created_at > now() - interval '10 seconds';
  if v_n >= 8 then raise exception 'slow down'; end if;
  select count(*) into v_n from ss_entries where ip_hash = v_hash and created_at > now() - interval '1 hour';
  if v_n >= 150 then raise exception 'rate limited'; end if;
  insert into ss_entries (board, variant, period, name, cls, guild, value, sub, party, premade, trial, coop, extra, ip_hash)
  values (p_board, v_variant, v_period, p_name, p_cls, nullif(btrim(coalesce(p_guild, '')), ''), p_value, left(coalesce(p_sub, ''), 80),
          coalesce(p_party, '{}'), coalesce(p_premade, false), coalesce(p_trial, false), coalesce(p_coop, false), coalesce(p_extra, '{}'::jsonb), v_hash);
  select count(*) + 1 into v_rank from ss_best(p_board, v_variant, v_period) b
  where lower(b.name) <> lower(p_name) and ((v_low and b.value < p_value) or (not v_low and b.value > p_value));
  return json_build_object('ok', true, 'rank', v_rank, 'period', v_period);
end $$;

-- the current period's top rows (best per player) → [{ name, cls, guild, value, sub, party, premade, trial, coop, at }]
create or replace function public.top_entries(p_board text, p_variant text default '', p_limit int default 50)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select b.* from ss_best(p_board, coalesce(p_variant, ''), ss_period(p_board)) b
    order by
      case when ss_lower_is_better(p_board, coalesce(p_variant, '')) then b.value end asc,
      case when not ss_lower_is_better(p_board, coalesce(p_variant, '')) then b.value end desc,
      b.at asc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) r;
$$;

-- permissions: nothing on the table; only the two RPCs for the anon (publishable) key
revoke all on public.ss_entries from anon, authenticated;
revoke execute on function public.ss_period(text) from public, anon, authenticated;
revoke execute on function public.ss_lower_is_better(text, text) from public, anon, authenticated;
revoke execute on function public.ss_valid(text, text, double precision) from public, anon, authenticated;
revoke execute on function public.ss_best(text, text, text) from public, anon, authenticated;
revoke execute on function public.submit_entry(text, text, text, text, text, double precision, text, text[], boolean, boolean, boolean, jsonb) from public;
revoke execute on function public.top_entries(text, text, int) from public;
grant execute on function public.submit_entry(text, text, text, text, text, double precision, text, text[], boolean, boolean, boolean, jsonb) to anon, authenticated;
grant execute on function public.top_entries(text, text, int) to anon, authenticated;

-- optional housekeeping (schedule with pg_cron or run by hand): weekly/daily rows older than two months
-- delete from public.ss_entries where period <> 'all' and created_at < now() - interval '60 days';
