// SEVENSHARD leitmotifs (original). Shared by the title theme, cutscenes, victory fanfare and stingers so the score
// hangs together. Written in D (minor for the main theme); transpose with `tr` in Track.line().
import { mel } from './theory.js';

// HERO: horn call (rising 5th + 4th) answered by a falling line; sequenced a third higher; climbs and cadences.
export const HERO = mel('D4:1.5! A4:.5 D5:2 | C5:.5 Bb4:.5 G4:1 F4:1 D4:1 | F4:1.5! C5:.5 F5:2 | E5:.5 D5:.5 C5:1 G4:1 E4:1 | G4:1 Bb4:1 D5:1.5 C5:.5 | Bb4:1 D5:1 F5:2! | E5:.5 D5:.5 C5:.5 Bb4:.5 A4:1 C#5:1 | D5:4');
export const HERO_CH = ['Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', ['Gm', 'A'], 'Dm'];
// the call alone (bar 1) in major, for fanfares
export const CALL_MAJ = mel('D4:1.5! A4:.5 D5:2');
// SHARD: seven glittering notes, Dm(add9) — and its major form for D-major endings
export const SHARD = mel('D6:.5 A5:.5 E6:.5 F6:.5 E6:.5 A5:.5 D6:1');
export const SHARD_MAJ = mel('D6:.5 A5:.5 E6:.5 F#6:.5 E6:.5 A5:.5 D6:1');
// B: lyrical strings + choir in the relative major
export const B_THEME = mel('D5:2 C5:1 Bb4:1 | A4:1.5 C5:.5 F5:2 | G5:1.5 F5:.5 D5:1 Bb4:1 | C5:3 E5:1 | F5:2 D5:1 Bb4:1 | C5:1.5 A4:.5 F4:2 | G4:1 Bb4:1 D5:1 C5:.5 Bb4:.5 | A4:4');
export const B_CH = ['Bb', 'F/A', 'Gm7', 'C', 'Bb', 'F/A', 'Gm', ['Asus4', 'A']];
