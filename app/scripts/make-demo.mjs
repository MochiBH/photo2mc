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
  for (;;) {
    try { const r = await runSync(db, profile); if (r.done) break; }
    catch (e) { if (e.status !== 429) throw e; await new Promise((r) => setTimeout(r, ((e.retryAfter || 10) + 1) * 1000)); }   // Riot's rate limit: wait and carry on
  }
  return { stats, puuid: profile.puuid };
}
const a = await pull(jg);
let supId = sup;
if (!supId) {   // borrow a support from the jungler's latest game, just to have real support-shaped numbers to look at
  const riot = riotClient(region), id = (await riot.matchIds(a.puuid, 1))[0], m = await riot.match(id);
  const p = m.info.participants.find((x) => x.teamPosition === 'UTILITY' && x.puuid !== a.puuid);
  supId = `${p.riotIdGameName}#${p.riotIdTagline}`;
}
const b = await pull(supId);
// the jungler's jungle numbers and the support's support numbers, for ranked games, normal games and both
const mix = (of) => ({ jungle: of(a.stats).jungle, support: of(b.stats).support });
const out = { ...mix((s) => s), normal: mix((s) => s.normal), both: mix((s) => s.both) };
writeFileSync(new URL('../public/demo-stats.json', import.meta.url), JSON.stringify(out));
for (const [kind, set] of [['ranked', out], ['normal', out.normal], ['both', out.both]]) console.log(kind.padEnd(7), 'jungle', set.jungle.games, set.jungle.groups.all.record, '| support', set.support.games, set.support.groups.all.record, set.support.champs.join(','));
