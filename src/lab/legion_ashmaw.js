// Solo lab for the in-progress 'ashmaw' legion boss (isolated from index.js so work-in-progress can't break the main lab).
//   node tools/lab.mjs src/lab/legion_ashmaw.js  →  http://localhost:5299/lab/legion_ashmaw.html  (same URL params / __legion API as legion.html)
import { Boss, buildEntry, cacheStats } from '../models/bosses/legion/boss.js';
import { metaOf } from '../models/bosses/legion/meta.js';
import { ashmaw } from '../models/bosses/legion/ashmaw.js';
import { startLegionLab } from './legion_core.js';
const DEFS = { ashmaw };
const BOSSES = { ashmaw: metaOf('ashmaw', ashmaw) };
startLegionLab({ createBoss: (id, o) => new Boss(id, buildEntry(id, DEFS[id]), o), BOSSES, bossStats: cacheStats, title: 'ashmaw (solo lab)' });
