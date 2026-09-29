// Window registry: every Win subclass listed here can be opened with ui.open(id, data).
import { CharacterWin } from './character.js';
import { InventoryWin } from './inventory.js';
import { SkillsWin } from './skills.js';
import { EngravingsWin } from './engravings.js';
import { SettingsWin } from './settings.js';
import { VendorWin } from './vendor.js';
import { GameMenuWin, MapWin } from './misc.js';

export const WINDOWS = [CharacterWin, InventoryWin, SkillsWin, EngravingsWin, SettingsWin, VendorWin, GameMenuWin, MapWin];
