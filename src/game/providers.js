// Wires the art/audio/UI modules into the game. Each provider is optional: missing pieces fall back to placeholders.
import { PROVIDERS } from './visuals.js';
import { createHero } from '../models/hero/index.js';
import { createCreature, CREATURES } from '../models/creatures/index.js';
import { createBoss as createLegionBoss, BOSSES as LEGION } from '../models/bosses/legion/index.js';
import { createBoss as createGuardianBoss, BOSSES as GUARDIANS } from '../models/bosses/guardians/index.js';
import { buildZone as worldBuildZone, ZONES } from '../world/index.js';
import { FX } from '../fx/index.js';
import { createAudio } from '../audio/index.js';
import { createUI } from '../ui/index.js';
import { devZone } from './devzone.js';

PROVIDERS.hero = o => createHero(o);
PROVIDERS.creature = (type, o) => CREATURES[type] ? createCreature(type, o) : null;
PROVIDERS.boss = (id, o) => {
  if (LEGION[id]) return createLegionBoss(id, o);
  if (GUARDIANS[id]) return createGuardianBoss(id, o);
  return null;
};
export const BOSS_MODELS = { ...LEGION, ...GUARDIANS };

export async function buildZone(id, opts = {}) {
  try { if (ZONES[id]) return await worldBuildZone(id, opts); }
  catch (e) { console.error('[zone]', id, e); }
  return devZone({ theme: /rift|inferno|throne|kennel/.test(id) ? 'void' : 'stone' });
}
/** attach FX, audio and (optionally) the UI to a game */
export function equip(game, { ui = true, onAction } = {}) {
  try { game.fx = new FX(game.scene, { quality: game.renderer.quality, camera: game.cam.cam }); } catch (e) { console.error('[fx]', e); }
  try { game.audio = createAudio(); } catch (e) { console.error('[audio]', e); }
  if (ui) { try { game.ui = createUI(document.body, { onAction: (t, p) => onAction?.(t, p) }); } catch (e) { console.error('[ui]', e); } }
  return game;
}
export { ZONES, createUI };
