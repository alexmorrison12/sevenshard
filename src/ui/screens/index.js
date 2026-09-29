// Screen registry: ui.screen(name, data) looks names up here.
import { Screen } from './screen.js';
import { TitleScreen } from './title.js';
import { CharSelectScreen } from './charselect.js';
import { CreateScreen } from './create.js';
import { LoadingScreen } from './loading.js';
import { ResultsScreen } from './results.js';
import { DeathScreen } from './death.js';

export { Screen };
export const SCREENS = {
  title: TitleScreen, charselect: CharSelectScreen, create: CreateScreen, loading: LoadingScreen, results: ResultsScreen, death: DeathScreen,
};
