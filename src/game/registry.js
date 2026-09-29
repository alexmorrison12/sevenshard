// Extension points of the session, so features can plug in without editing session.js.
//
//   registerPlugin({ id, init(session), update?(dt), onEvent?(type, data), hud?(hudState), interactable?(), interact?(target) })
//   registerContent(kind, async (session, c) => { … build zone + mode …; later session.contentDone(c, result) })
//   registerService(action, (session, npcDef, npcUnit) => { … })     NPC 'action' → handler
//   registerWindow(id, session => data)                              window data provider (ui.open(id, data))
//   registerAction(prefix, (session, type, payload) => handled?)     UI actions by exact type or 'prefix:'
//   registerZoneMode(zoneKindOrId, (session, zone, o) => mode)       what mode runs when entering a zone
//
// Gameplay events published on session.bus (Emitter): kill {unit, killer, zone} · talk {npc} · zone {id, kind} ·
// clear {content, result} · collect {id, n} · gather {skill, node, items} · hone {success, item} · facet {success, stone} ·
// song {id, npc} · emote {id, npc} · levelup {level} · quest {id, state} · item {item} · sail {…} · pvp {…} · death {unit}
export const PLUGINS = [];
export const LAUNCHERS = {};
export const SERVICES = {};
export const WINDOWS = {};
export const ACTIONS = {};
export const ZONE_MODES = {};
export const registerPlugin = p => { if (!PLUGINS.some(x => x.id === p.id)) PLUGINS.push(p); return p; };
export const registerContent = (kind, fn) => { LAUNCHERS[kind] = fn; };
export const registerService = (action, fn) => { SERVICES[action] = fn; };
export const registerWindow = (id, fn) => { WINDOWS[id] = fn; };
export const registerAction = (prefix, fn) => { ACTIONS[prefix] = fn; };
export const registerZoneMode = (key, fn) => { ZONE_MODES[key] = fn; };
