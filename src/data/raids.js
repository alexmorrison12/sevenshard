// Instanced boss content: guardian hunts, the abyssal dungeon and the legion raid (gates), with entry item levels.
export const GUARDIANS = [
  { id: 'rimewing', ilvl: 1100, arena: 'frostmere' },
  { id: 'cinderhorn', ilvl: 1250, arena: 'frostmere' },
  { id: 'sandmaw', ilvl: 1370, arena: 'frostmere' },
  { id: 'kurai', ilvl: 1460, arena: 'frostmere' },
];
export const RAIDS = {
  oratory: { id: 'oratory', name: 'The Sunken Oratory', kind: 'abyss', players: 4, ilvl: { normal: 1325 },
    gates: [
      { name: 'The Drowned Choir', zone: 'frostmere', bosses: [{ boss: 'nerissa', anchor: 'boss' }] },
      { name: 'Oracle of the Deep', zone: 'frostmere', bosses: [{ boss: 'deep_oracle', anchor: 'boss' }] },
    ] },
  gorrath: { id: 'gorrath', name: 'Gorrath, the Horned Tyrant', kind: 'legion', players: 8, ilvl: { normal: 1415, hard: 1445 },
    gates: [
      { name: 'Hounds of the Horn', zone: 'kennels', bosses: [{ boss: 'skarn', anchor: 'boss:skarn' }, { boss: 'vesk', anchor: 'boss:vesk' }] },
      { name: 'The Horned Tyrant', zone: 'throne_of_horns', bosses: [{ boss: 'gorrath', anchor: 'boss' }] },
    ] },
};
