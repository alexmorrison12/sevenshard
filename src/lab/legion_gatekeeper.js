// Solo lab for the in-progress 'gatekeeper' legion boss (isolated from index.js so work-in-progress can't break the main lab).
//   node tools/lab.mjs src/lab/legion_gatekeeper.js  →  http://localhost:5299/lab/legion_gatekeeper.html  (same URL params / __legion API as legion.html)
import { Boss, buildEntry, cacheStats } from '../models/bosses/legion/boss.js';
import { metaOf } from '../models/bosses/legion/meta.js';
import { gatekeeper } from '../models/bosses/legion/gatekeeper.js';
import { startLegionLab } from './legion_core.js';
const DEFS = { gatekeeper };
const BOSSES = { gatekeeper: metaOf('gatekeeper', gatekeeper) };
startLegionLab({ createBoss: (id, o) => new Boss(id, buildEntry(id, DEFS[id]), o), BOSSES, bossStats: cacheStats, title: 'gatekeeper (solo lab)' });
