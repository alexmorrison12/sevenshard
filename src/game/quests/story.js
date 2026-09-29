// "Ask about the Shards" (the 'story' NPC service on Brannoc and Seraphine): lore that follows your progress through
// the main story, plus a nudge toward whatever the main story wants from you next.
const SERAPHINE = [
  { until: 'c1_council', lines: ['The Sunheart was a prism the Seven Lights made to keep the Abyss sealed. When the Abyss broke through — the Sundering — it shattered.', 'Seven Shards fell across Solmara. One of them fell into you. Don’t ask me how. I only hear them sing.'] },
  { until: 'g8_hollow', lines: ['The Shards sing in chords, not notes. Yours is… patient. Like it has been waiting a very long time for someone to listen.', 'There is another one nearby. Faint. West. It sounds like it’s wrapped in something green.'] },
  { until: 't7_road', lines: ['The Pips kept the Sunseed for centuries. They never knew what it was. They just knew it was warm, and they loved it.', 'Things that are loved long enough start to love back. I think that’s why the Sunseed points at the Shards.'] },
  { until: 'a6_shard', lines: ['Varkhul is holding the Shard of Dawn in the fortress on Ashen Ridge. I can hear it screaming.', 'Six Legion Commanders serve the Emperor Vorrathis. Varkhul isn’t even one of them. That should frighten us more than it does.'] },
  { until: null, lines: ['Two Shards sing now instead of one. They harmonise. It’s the most beautiful thing I have ever heard, and it gives me nightmares.', 'Gorrath, the Horned Tyrant, has woken. The first of the six. The rifts all lead to him now.'] },
];
const BRANNOC = [
  { until: 'c1_council', lines: ['Brighthold stood four hundred years. Varkhul took it in a night. Remember that when anyone tells you walls are enough.'] },
  { until: 'g8_hollow', lines: ['My brother Gideon never wanted a sword. Wanted wheat. Got both, in the end — bandits don’t care what you want.'] },
  { until: 't7_road', lines: ['Thornwood was a pilgrim road once. Now it’s a cult road. The trees remember both.'] },
  { until: 'a6_shard', lines: ['The Vanguard is camped under Ashen Ridge. Every soldier who can hold a pike. Every one of them is counting on you.'] },
  { until: null, lines: ['You beat the Ravager. I watched it and I still don’t believe it.', 'The Horned Tyrant won’t be one duel in a courtyard. Find seven good blades. Then find a support who remembers to shield.'] },
];

export async function storyTalk(Q, n, unit) {
  if (!Q) return;
  const table = n.id === 'brannoc' ? BRANNOC : SERAPHINE;
  const cur = table.find(r => !r.until || !Q.isDone(r.until)) || table[table.length - 1];
  const lines = [...cur.lines];
  const msq = Q.st?.active.find(e => Q.def(e.id)?.kind === 'msq');
  if (msq) lines.push(`As for right now: ${Q.stepText(msq).replace(/^\w/, c => c.toLowerCase())}.`);
  await Q.say({ id: n.id, name: n.name, title: n.title }, lines.map(t => ({ s: n.id, t })));
  void unit;
}
