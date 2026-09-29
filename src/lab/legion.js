// Legion bosses lab — all bosses via the public entry (see legion_core.js for URL params and automation).
import { createBoss, BOSSES, bossStats } from '../models/bosses/legion/index.js';
import { startLegionLab } from './legion_core.js';
startLegionLab({ createBoss, BOSSES, bossStats });
