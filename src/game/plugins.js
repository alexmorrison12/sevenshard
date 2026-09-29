// Feature modules that plug into the session through src/game/registry.js. Each import registers itself.
// (Modules that are still being written resolve to empty stubs in the build until they land.)
import './content/builtin.js';
import './features.js';
import './quests/index.js';
import './modes/field.js';
import './modes/prologue.js';
import './modes/sailing.js';
import './modes/island.js';
import './modes/stronghold.js';
import './modes/pvp.js';
import './modes/inferno.js';
import './modes/events.js';
import './meta/index.js';
import './systems/hooks.js';
