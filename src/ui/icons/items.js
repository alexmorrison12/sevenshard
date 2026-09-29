// Item icon registry (`item:*`): gear renders + everything else.
import { GEAR_PAINT } from './items_gear.js';
import { MISC_ITEM_PAINT } from './items_misc.js';

export const ITEM_PAINT = { ...GEAR_PAINT, ...MISC_ITEM_PAINT };
