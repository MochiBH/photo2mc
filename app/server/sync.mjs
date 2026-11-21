// One step of pulling a player's ranked games from Riot and analysing them. The browser calls this repeatedly until done,
// so each call stays short: at most BATCH new games (two Riot requests each).
import { analyseGame, buildStats } from './analysis.mjs';
import { riotClient } from './riot.mjs';

export const BATCH = 3;
export const ROLES = ['jungle', 'support'];

/** db: { knownIds(userId, ids), putGame(row), listGames(userId, limit), saveStats(userId, stats), savePuuid(userId, puuid) } */
export async function runSync(db, profile, { riot = riotClient(profile.region), batch = BATCH } = {}) {
  let puuid = profile.puuid;
  if (!puuid) {
    puuid = (await riot.account(profile.riot_name, profile.riot_tag)).puuid;
    await db.savePuuid(profile.id, puuid);
  }
  const ids = await riot.matchIds(puuid, 20);
  const known = new Set(await db.knownIds(profile.id, ids));
  const todo = ids.filter((id) => !known.has(id));
  for (const id of todo.slice(0, batch)) {
    const [match, timeline] = await Promise.all([riot.match(id), riot.timeline(id)]);
    let g = null;
    for (const role of ROLES) { g = analyseGame(match, timeline, puuid, role); if (g) break; }
    await db.putGame({ user_id: profile.id, match_id: id, role: g ? g.role : 'other', created: new Date(match.info.gameCreation || Date.now()).toISOString(), analysis: g });
  }
  const remaining = Math.max(0, todo.length - batch);
  if (remaining) return { done: false, remaining, total: ids.length };
  const games = (await db.listGames(profile.id, 60)).map((r) => r.analysis).filter(Boolean);
  const stats = Object.fromEntries(ROLES.map((role) => [role, buildStats(games, role)]));
  await db.saveStats(profile.id, stats);
  return { done: true, remaining: 0, total: ids.length, stats };
}
