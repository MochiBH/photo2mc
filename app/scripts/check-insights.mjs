// Prints the checkpoints, leaks and strengths the site would show a player. Usage: node scripts/check-insights.mjs "Name#TAG" na support
import { runSync } from '../server/sync.mjs';
import { checksFor } from '../src/lib/roles.js';
import { insights, strengths } from '../src/lib/insights.js';
const [riotId, region = 'na', role = 'jungle'] = process.argv.slice(2);
const [riot_name, riot_tag] = riotId.split('#');
const games = new Map(); let stats = null; const profile = { id: 'u', riot_name, riot_tag, region, puuid: null };
const db = { knownIds: async (_, ids) => ids.filter((i) => games.has(i)), putGame: async (r) => { games.set(r.match_id, r); }, listGames: async () => [...games.values()].filter((r) => r.role !== 'other').sort((a, b) => b.created.localeCompare(a.created)), saveStats: async (_, s) => { stats = s; }, savePuuid: async (_, p) => { profile.puuid = p; } };
for (;;) { const r = await runSync(db, profile); if (r.done) break; }
const st = stats[role], rec = (l) => { const w = l.filter((g) => g.w).length; return w + '-' + (l.length - w); };
console.log(riotId, role, st.games, 'games', st.groups.all.record);
for (const c of checksFor(st, role)) console.log('CHECK', c.name, '| hit', rec(st.list.filter(c.ok)), 'miss', rec(st.list.filter((g) => !c.ok(g))));
for (const l of insights(st)) console.log('LEAK', l.score.toFixed(1), l.title, '|', l.big, l.unit, '|', l.detail, '| FIX:', l.fix);
for (const s of strengths(st)) console.log('GOOD', s);
