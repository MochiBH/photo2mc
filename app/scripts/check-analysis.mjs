// Compares the JS analysis with the Python report on the raw games cached in ../data (run the Python report first).
import { readFileSync, readdirSync } from 'node:fs';
import { analyseGame, buildStats } from '../server/analysis.mjs';
const data = new URL('../../data/', import.meta.url), out = new URL('../../out/', import.meta.url);
const puuid = JSON.parse(readFileSync(new URL(readdirSync(data).find((f) => f.startsWith('account_')), data))).puuid;
const ids = JSON.parse(readFileSync(new URL('match_ids.json', data)));
const games = ids.map((id) => analyseGame(JSON.parse(readFileSync(new URL(`matches/${id}.json`, data))), JSON.parse(readFileSync(new URL(`matches/${id}_timeline.json`, data))), puuid, 'jungle')).filter(Boolean);
const st = buildStats(games, 'jungle');
const py = JSON.parse(readFileSync(new URL('map_data_full.json', out))).groups;
let bad = 0;
const eq = (label, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { bad++; console.log('DIFF', label, JSON.stringify(a), 'vs', JSON.stringify(b)); } };
for (const [k, pk] of [['all', 'all'], ['wins', 'wins'], ['losses', 'losses'], ['Nunu', 'champ:Nunu'], ['Khazix', 'champ:Khazix']]) {
  const a = st.groups[k], b = py[pk];
  eq(k + ' games', a.games, b.games); eq(k + ' deaths', a.deaths, b.deaths.total); eq(k + ' free', a.free, b.deaths.free); eq(k + ' quick', a.quick, b.deaths.within_90s_of_respawning);
  eq(k + ' alone/out/team', [a.alone, a.out, a.team], [b.deaths.alone, b.deaths.outnumbered, b.deaths.with_team]); eq(k + ' took', a.took, b.deaths.enemy_took_objective_within_90s);
  eq(k + ' zones', a.zones, b.deaths.by_zone);
  for (const l of ['top_lane', 'mid_lane', 'bot_lane']) eq(k + ' ' + l, a.ganks[l], ['kills', 'assists', 'deaths', 'minutes', 'empty_minutes'].map((x) => b.ganks_pre15[l][x]));
  for (const key of Object.keys(b.objectives)) eq(k + ' ' + key, a.obj[key].slice(0, 4), [b.objectives[key].n, b.objectives[key].alive, b.objectives[key].near, b.objectives[key].took_part]);
  eq(k + ' cw', a.vision.control, b.vision.control_wards_bought);
  const gapPy = b.farm_race.avg_jcs_diff_by_minute.map((c) => (c === null ? null : Math.round(c)));
  const off = a.gap.filter((v, i) => Math.abs(v - gapPy[i]) > 1).length; if (off) { bad++; console.log('DIFF', k, 'gap', a.gap, gapPy); }
}
console.log(games.length, 'games,', st.deaths.length, 'death points,', bad ? bad + ' differences' : 'matches the Python report');
console.log(JSON.stringify(st.list[0]), JSON.stringify(st).length, 'bytes');
