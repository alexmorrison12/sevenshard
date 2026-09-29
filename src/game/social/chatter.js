// What the AI adventurers say: area chatter, party-finder shouts, trade, and replies. Affectionate parody of
// Lost Ark culture — honing grief, support shortages, Pip Seed hunts, counters and cursed stones.
export const CHAT = {
  area: [
    'anyone know where the last pip seed in Thornwood is', 'just tapped +17 on the first try, goodnight everyone', '+19 weapon failed 11 times. i am being tested',
    'artisan energy 97.3% and it FAILED', 'wts 97 stone, dm offers', 'wtb 97 stone', 'is Rimewing solo-able at 1250?', 'who else is here for the field boss',
    'chaos gate in 5, meet at the east bridge', 'LF support. any support. please.', 'supports are the real endgame', 'why does gorrath always pick me for the leap',
    'did anyone else miss the counter or was it just me', 'the pips are too cute to be this sneaky', 'rested bonus is my only friend', 'gold per week is looking good',
    'please someone buy my leapstones', 'my stronghold dispatch came back empty again', 'fishing is the true endgame', 'i have played 40 hours and my roster is level 9',
    'the market price of fusion mats is criminal', 'anyone doing guardian runs?', 'PSA: back attacks do more damage, stand behind the boss', 'the Horned Tyrant ghost phase is insane',
    'imagine reading tripods', 'sold 3 books and bought a mount, no regrets', 'why is my bard healing the boss', 'grats on the drop!', 'gz', 'ty for the carry',
    'if you see a shiny thing on the ground it is a pip seed', 'just rolled an ancient bracelet with move speed and nothing else lmao', 'the song teacher is a legend',
    'who wants to do inferno descent', 'floor 64 on inferno, new personal best', 'free rapport tip: the harbor captain loves music boxes', 'this city is beautiful at dusk',
  ],
  lf: [
    'LF2 Gorrath NM 1415+ know mechs, no stuck-up tryhards', 'LF1 support Gorrath HM 1445+, prog party', 'Rimewing x4, all welcome, carry mood', 'LF DPS for Sunken Oratory 1325+',
    'Kurai runs, need 2 more, bring counters', 'LF3 chaos IV, rested', 'Gorrath G1 learning party, patience included', 'LF1 counter-capable dps for Kurai', 'Inferno descent, floor 40+ push',
  ],
  trade: ['WTS Keen Edge book 20k', 'WTB Vendetta books', 'WTS relic necklace crit/swift', 'WTB leapstones bulk', 'WTS Lv.7 ruinstone', 'WTB fusion mats, paying well'],
  greet: ['hi', 'hello', 'hey', 'o/', 'yo', 'hiya'],
  reply: ['lol', 'true', 'same', 'real', 'gz', 'nice', 'ty', 'lmao', 'rip', 'hmm', 'based', 'cope', 'honestly yes', 'no way', 'o7'],
  cheer: ['GG!', 'nice clear', 'ez', 'ty all', 'gg wp', 'that ghost phase tho', 'great support', 'who did the counters, mvp'],
  wipe: ['rip', 'who pulled', 'dodge the orange', 'counter was right there', 'next one', 'my bad', 'lag', 'we go again'],
};

export function pickLine(pool, rng = Math.random) { const a = CHAT[pool] || CHAT.area; return a[Math.floor(rng() * a.length)]; }
