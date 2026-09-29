// Window registry: every Win subclass listed here can be opened with ui.open(id, data).
import { CharacterWin } from './character.js';
import { InventoryWin } from './inventory.js';
import { SkillsWin } from './skills.js';
import { EngravingsWin } from './engravings.js';
import { SettingsWin } from './settings.js';
import { VendorWin } from './vendor.js';
import { GameMenuWin } from './misc.js';
import { MapWin } from './map.js';
import { CompassWin } from './compass.js';
import { PartyFinderWin, MailWin, GuildWin, LeaderboardsWin } from './social.js';
import { HoningWin } from './honing.js';
import { NexusWin } from './nexus.js';
import { MeterWin } from './meter.js';
import { SongsWin, EmotesWin } from './wheel.js';

export const WINDOWS = [CharacterWin, InventoryWin, SkillsWin, EngravingsWin, SettingsWin, VendorWin, GameMenuWin, MapWin, HoningWin, NexusWin, MeterWin, SongsWin, EmotesWin, CompassWin, PartyFinderWin, MailWin, GuildWin, LeaderboardsWin];
