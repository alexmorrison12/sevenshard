// All quests and cutscenes, compiled from the chapter files. See README.md in this folder for the format.
//   QUESTS[id] · QUEST_LIST (story order) · CUTSCENES[id] · KIND_ORDER (tracker sort)
import prologue from './prologue.js';
import solhaven from './solhaven.js';
import goldmeadow from './goldmeadow.js';
import pipsprout from './pipsprout.js';
import thornwood from './thornwood.js';
import ashen from './ashen_ridge.js';
import epilogue from './epilogue.js';
import guide from './guide.js';

export const KIND_ORDER = { msq: 0, guide: 1, event: 2, side: 3, daily: 4 };
const CHAPTERS = [prologue, solhaven, goldmeadow, pipsprout, thornwood, ashen, epilogue, guide];

export const QUESTS = {};
export const QUEST_LIST = [];
export const CUTSCENES = {};
for (const ch of CHAPTERS) {
  if (!ch) continue;
  for (const raw of ch.quests || []) {
    const q = { kind: 'side', chapter: ch.id, chapterName: ch.name, zone: ch.zone || null, levels: ch.levels || null, ...raw };
    if (q.kind === 'msq' || q.kind === 'guide') q.auto = q.auto ?? true;
    q.steps = (q.steps || []).map(s => ({ type: 'talk', ...s }));
    if (QUESTS[q.id]) console.warn('[quests] duplicate id', q.id);
    QUESTS[q.id] = q; QUEST_LIST.push(q);
  }
  Object.assign(CUTSCENES, ch.cutscenes || {});
}
// sanity: every prerequisite exists
for (const q of QUEST_LIST) for (const p of q.prereq || []) if (!QUESTS[p]) console.warn('[quests] unknown prereq', p, 'in', q.id);
