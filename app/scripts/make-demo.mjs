// Local testing only: writes public/demo-stats.json (git-ignored) from real Riot data so the site can run without accounts.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/make-demo.mjs "Jungler#TAG" "Support#TAG" na
import { writeFileSync } from 'node:fs';
import { runSync } from '../server/sync.mjs';
import { riotClient } from '../server/riot.mjs';
const [jg = 'The Gonzoogler#WEEEE', sup = '', region = 'na'] = process.argv.slice(2);
async function pull(riotId) {
  const [riot_name, riot_tag] = riotId.split('#');
  const games = new Map(); let stats = null; const profile = { id: 'u', riot_name, riot_tag, region, puuid: null };
  const db = { knownIds: async (_, ids) => ids.filter((i) => games.has(i)), putGame: async (r) => { games.set(r.match_id, r); }, listGames: async () => [...games.values()].filter((r) => r.role !== 'other').sort((a, b) => b.created.localeCompare(a.created)), saveStats: async (_, s) => { stats = s; }, savePuuid: async (_, p) => { profile.puuid = p; } };
  for (;;) { const r = await runSync(db, profile); if (r.done) break; }
  return { stats, puuid: profile.puuid };
}
const a = await pull(jg);
let supId = sup;
if (!supId) {   // borrow a support from the jungler's latest game, just to have real support-shaped numbers to look at
  const riot = riotClient(region), id = (await riot.matchIds(a.puuid, 1))[0], m = await riot.match(id);
  const p = m.info.participants.find((x) => x.teamPosition === 'UTILITY' && x.puuid !== a.puuid);
  supId = `${p.riotIdGameName}#${p.riotIdTagline}`;
}
await new Promise((r) => setTimeout(r, 60000));   // stay under the rate limit between the two pulls
const b = await pull(supId);
writeFileSync(new URL('../public/demo-stats.json', import.meta.url), JSON.stringify({ jungle: a.stats.jungle, support: b.stats.support }));
console.log('jungle', a.stats.jungle.games, a.stats.jungle.groups.all.record, '| support', b.stats.support.games, b.stats.support.groups.all.record, b.stats.support.champs.join(','));
