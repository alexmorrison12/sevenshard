// Rapport with 8 NPCs: songs and emotes (6 each per NPC per day), gifts with preferences, stages Neutral → Amicable →
// Friendly → Trusted → Honored → Devoted with claimable rewards. State: roster.rapport[npcId] = { pts, day, songs, emotes, claimed }.
import { STAGES, SONGS, EMOTES, DAILY_SONGS, DAILY_EMOTES, BASE, PREF, RAPPORT_NPCS, RAPPORT_BY_ID, RAPPORT_UNLOCKS } from '../../data/rapport.js';
import { TITLES } from '../../data/titles.js';
import { COLLECTIBLES } from '../../data/collectibles.js';
import { CARDS } from '../../data/cards.js';
import { collect } from './collectibles.js';
import { ok, fail, grantBundle, bundleRows, emit } from './common.js';
import { dayId } from '../../core/util.js';

export { STAGES, SONGS, EMOTES, RAPPORT_NPCS };
const CATALOG = { cards: CARDS, titles: TITLES, ...RAPPORT_UNLOCKS };
function entry(account, id, now) {
  const r = account.roster; r.rapport ||= {};
  const e = r.rapport[id] ||= { pts: 0, day: dayId(now), songs: 0, emotes: 0, claimed: [] };
  e.claimed ||= [];
  const d = dayId(now); if (e.day !== d) { e.day = d; e.songs = 0; e.emotes = 0; }
  return e;
}
export const stageOf = pts => { let s = STAGES[0]; for (const x of STAGES) if (pts >= x.min) s = x; return s; };
function stageView(pts) { const s = stageOf(pts), nx = STAGES[s.idx + 1]; return { stage: { idx: s.idx, name: s.name, min: s.min, next: nx ? nx.min : null }, pct: nx ? (pts - s.min) / (nx.min - s.min) : 1 }; }
function rewardRows(R) {
  const rows = bundleRows(R.bundle, CATALOG).map(x => { const [list, key] = String(x.id).split(':'); const c = CATALOG[list]?.[key]; return c ? { ...x, name: c.name, grade: c.grade ?? x.grade } : x; });
  for (const [type, id] of R.collect || []) rows.push({ id, name: collectName(type, id), count: 1, grade: 4, icon: `item:${type === 'masterpieces' ? 'masterpiece' : type === 'hearts' ? 'giants_heart' : type === 'stars' ? 'omnium_star' : type === 'leaves' ? 'world_leaf' : 'island_soul'}`, kind: 'collectible' });
  return rows;
}
const collectName = (type, id) => COLLECTIBLES[type]?.items.find(x => x.id === id)?.name || id;

export function one(account, npcId, now = Date.now()) {
  const N = RAPPORT_BY_ID[npcId]; if (!N) return null;
  const e = entry(account, npcId, now), sv = stageView(e.pts);
  const pick = o => Object.entries(o).filter(([, v]) => v === 'love' || v === 'like').sort((a, b) => (a[1] === 'love' ? -1 : 1) - (b[1] === 'love' ? -1 : 1)).map(([k]) => k);
  return { id: N.id, name: N.name, title: N.title, zone: N.zone, personality: N.personality, icon: `npc:${N.id}`, pts: e.pts, ...sv,
    today: { songs: e.songs, songsMax: DAILY_SONGS, emotes: e.emotes, emotesMax: DAILY_EMOTES },
    likes: { songs: pick(N.songs), emotes: pick(N.emotes), gifts: { gift1: 'neutral', gift2: 'neutral', gift3: 'neutral', gift4: 'neutral', ...N.gifts } },
    rewards: N.rewards.map((R, i) => ({ stage: i + 1, name: STAGES[i + 1].name, rows: rewardRows(R), claimed: e.claimed.includes(i + 1), ready: sv.stage.idx >= i + 1 && !e.claimed.includes(i + 1) })),
    line: N.lines[sv.stage.idx] };
}
export function view(account, now = Date.now()) { return RAPPORT_NPCS.map(N => one(account, N.id, now)); }
function gain(account, char, npcId, amount, kind, data, now) {
  const e = entry(account, npcId, now), before = stageOf(e.pts).idx;
  e.pts += Math.round(amount);
  const after = stageOf(e.pts), stageUp = after.idx > before;
  account.save();
  const notes = emit(account, char, kind, { ...data, npc: npcId });
  if (stageUp) notes.push(...emit(account, char, 'rapport', { npc: npcId, stage: after.idx }), { kind: 'rapport', text: `${RAPPORT_BY_ID[npcId].name} now considers you ${after.name}.` });
  return ok({ gain: Math.round(amount), pts: e.pts, stage: after.idx, stageName: after.name, stageUp, line: RAPPORT_BY_ID[npcId].lines[after.idx], notes });
}
export function song(account, char, npcId, songId, now = Date.now()) {
  const N = RAPPORT_BY_ID[npcId]; if (!N) return fail('unknown', 'Unknown person.');
  if (!SONGS[songId]) return fail('song', 'Unknown song.');
  if (!(account.roster.songs || []).includes(songId)) return fail('song', `You have not learned ${SONGS[songId].name}.`);
  const e = entry(account, npcId, now);
  if (e.songs >= DAILY_SONGS) return fail('limit', `${N.name} has heard enough songs today.`);
  e.songs++;
  const res = gain(account, char, npcId, BASE.song * PREF[N.songs[songId] || 'neutral'], 'song', { song: songId }, now);
  return { ...res, left: DAILY_SONGS - e.songs };
}
export function emote(account, char, npcId, emoteId, now = Date.now()) {
  const N = RAPPORT_BY_ID[npcId]; if (!N) return fail('unknown', 'Unknown person.');
  if (!EMOTES.includes(emoteId) && !(account.roster.emotes || []).includes(emoteId)) return fail('emote', 'Unknown emote.');
  if (!(account.roster.emotes || []).includes(emoteId)) return fail('emote', 'You have not learned that emote.');
  const e = entry(account, npcId, now);
  if (e.emotes >= DAILY_EMOTES) return fail('limit', `${N.name} has seen enough of that today.`);
  e.emotes++;
  const res = gain(account, char, npcId, BASE.emote * PREF[N.emotes[emoteId] || 'neutral'], 'emote', { emote: emoteId }, now);
  return { ...res, left: DAILY_EMOTES - e.emotes };
}
export function gift(account, char, npcId, giftId, n = 1, now = Date.now()) {
  const N = RAPPORT_BY_ID[npcId]; if (!N) return fail('unknown', 'Unknown person.');
  if (!BASE.gift[giftId]) return fail('gift', 'That is not a gift.');
  n = Math.max(1, n | 0);
  if (!account.take(giftId, n)) return fail('none', 'You do not have enough of that gift.');
  const res = gain(account, char, npcId, BASE.gift[giftId] * PREF[N.gifts[giftId] || 'neutral'] * n, 'gift', { gift: giftId, n }, now);
  return { ...res, left: null };
}
export function claim(account, char, npcId, stage) {
  const N = RAPPORT_BY_ID[npcId]; if (!N) return fail('unknown', 'Unknown person.');
  const e = entry(account, npcId, Date.now()), R = N.rewards[stage - 1];
  if (!R) return fail('stage', 'No reward at that stage.');
  if (e.claimed.includes(stage)) return fail('claimed', 'Already claimed.');
  if (stageOf(e.pts).idx < stage) return fail('stage', `Reach ${STAGES[stage].name} first.`);
  e.claimed.push(stage);
  grantBundle(account, char, R.bundle);
  for (const [type, id] of R.collect || []) collect(account, char, type, id);
  account.save();
  return ok({ rows: rewardRows(R) });
}
