// Runs the real sync loop against the Riot API with an in-memory database. Usage: node scripts/check-sync.mjs "Name#TAG" na
import { runSync } from '../server/sync.mjs';
const [riotId = 'The Gonzoogler#WEEEE', region = 'na'] = process.argv.slice(2);
const [riot_name, riot_tag] = riotId.split('#');
const games = new Map(); let stats = null; const profile = { id: 'u1', riot_name, riot_tag, region, puuid: null };
const db = {
  knownIds: async (_, ids) => ids.filter((i) => games.has(i)), putGame: async (row) => { games.set(row.match_id, row); },
  listGames: async (_, limit) => [...games.values()].filter((r) => r.role !== 'other').sort((a, b) => b.created.localeCompare(a.created)).slice(0, limit),
  saveStats: async (_, s) => { stats = s; }, savePuuid: async (_, p) => { profile.puuid = p; },
};
const t0 = Date.now(); let step = 0;
for (;;) { const s0 = Date.now(); const r = await runSync(db, profile); console.log(`step ${++step}: ${Date.now() - s0} ms`, JSON.stringify({ done: r.done, remaining: r.remaining })); if (r.done) break; }
console.log('total', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'roles:', [...games.values()].reduce((c, r) => ((c[r.role] = (c[r.role] || 0) + 1), c), {}));
for (const role of ['jungle', 'support']) console.log(role, stats[role].games, 'games', stats[role].groups.all.record, 'deaths', stats[role].groups.all.deaths, 'champs', stats[role].champs.join(','));
