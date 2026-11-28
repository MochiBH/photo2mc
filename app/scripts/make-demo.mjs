// Local testing only: writes public/demo-stats.json and public/demo-games.json (git-ignored) from real Riot data so the
// site can run without accounts.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/make-demo.mjs "Jungler#TAG" "Support#TAG" na "Top#TAG"
// A support or top laner left out is borrowed from the jungler's latest game.
import { writeFileSync } from 'node:fs';
import { runSync } from '../server/sync.mjs';
import { riotClient } from '../server/riot.mjs';
const [jg = 'The Gonzoogler#WEEEE', sup = '', region = 'na', top = ''] = process.argv.slice(2);
async function pull(riotId) {
  const [riot_name, riot_tag] = riotId.split('#');
  const games = new Map(); let stats = null; const profile = { id: 'u', riot_name, riot_tag, region, puuid: null };
  const db = { knownIds: async (_, ids) => ids.filter((i) => games.has(i)), putGame: async (r) => { games.set(r.match_id, r); }, listGames: async () => [...games.values()].filter((r) => r.role !== 'other').sort((a, b) => b.created.localeCompare(a.created)), saveStats: async (_, s) => { stats = s; }, savePuuid: async (_, p) => { profile.puuid = p; } };
  for (;;) {
    try { const r = await runSync(db, profile); if (r.done) break; }
    catch (e) { if (e.status !== 429) throw e; await new Promise((r) => setTimeout(r, ((e.retryAfter || 10) + 1) * 1000)); }   // Riot's rate limit: wait and carry on
  }
  return { stats, puuid: profile.puuid, rows: [...games.values()].sort((a, b) => b.created.localeCompare(a.created)) };
}
const a = await pull(jg);
async function borrow(position) {   // someone in that position from the jungler's latest game, just to have real numbers of that shape to look at
  const riot = riotClient(region), id = (await riot.matchIds(a.puuid, 1))[0], m = await riot.match(id);
  const p = m.info.participants.find((x) => x.teamPosition === position && x.puuid !== a.puuid);
  return `${p.riotIdGameName}#${p.riotIdTagline}`;
}
const b = await pull(sup || await borrow('UTILITY'));
const c = top && top === sup ? b : await pull(top || await borrow('TOP'));
// the jungler's jungle numbers, the support's support numbers and the top laner's top numbers, for ranked games, normal games and both
const mix = (of) => ({ jungle: of(a.stats).jungle, support: of(b.stats).support, top: of(c.stats).top });
const out = { ...mix((s) => s), normal: mix((s) => s.normal), both: mix((s) => s.both) };
writeFileSync(new URL('../public/demo-stats.json', import.meta.url), JSON.stringify(out));
// every game of the jungler's, in any role, for the Review tab
writeFileSync(new URL('../public/demo-games.json', import.meta.url), JSON.stringify(a.rows.map(({ match_id, role, created, analysis }) => ({ match_id, role, created, analysis }))));
for (const [kind, set] of [['ranked', out], ['normal', out.normal], ['both', out.both]]) console.log(kind.padEnd(7), ['jungle', 'support', 'top'].map((r) => `${r} ${set[r].games} ${set[r].groups.all.record} ${set[r].champs.join(',')}`).join(' | '));
