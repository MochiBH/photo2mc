// One step of pulling a player's ranked and normal games from Riot and analysing them. The browser calls this repeatedly
// until done, so each call stays short: at most BATCH new games (two Riot requests each).
import { ANALYSIS_VERSION, QUEUES, analyseGame, buildStats, roleIn } from './analysis.mjs';
import { riotClient } from './riot.mjs';
import { ROLES } from './roles.mjs';

export { ROLES };
export const BATCH = 3;
const PER_QUEUE = 20;

/** What is saved for a player: ranked numbers per role at the top (where older copies of the site look for them), then
    the same for normal games and for both kinds together. */
export function allStats(games) {
  const set = (queue, limit) => Object.fromEntries(ROLES.map((role) => [role, buildStats(games, role, limit, queue)]));
  return { ...set('ranked', PER_QUEUE), normal: set('normal', PER_QUEUE), both: set('both', PER_QUEUE * 2) };
}

/** db: { knownIds(userId, ids), putGame(row), listGames(userId, limit), saveStats(userId, stats), savePuuid(userId, puuid),
         staleIds?(userId, version, limit), keepGame?(userId, matchId, patch) }
    depth: how many of the latest games of each kind to look at (20 to 100). The review list raises it to reach further back. */
export async function runSync(db, profile, { riot = riotClient(profile.region), batch = BATCH, depth = PER_QUEUE } = {}) {
  let puuid = profile.puuid;
  if (!puuid) {
    puuid = (await riot.account(profile.riot_name, profile.riot_tag)).puuid;
    await db.savePuuid(profile.id, puuid);
  }
  depth = Math.max(PER_QUEUE, Math.min(100, Math.round(Number(depth)) || PER_QUEUE));
  const lists = await Promise.all(Object.values(QUEUES).map((queue) => riot.matchIds(puuid, depth, queue)));
  const ids = [...new Set(lists.flat())];
  const known = new Set(await db.knownIds(profile.id, ids));
  const fresh = ids.filter((id) => !known.has(id));
  // Games saved by an older version of the analysis, or never analysed because they were in another role, are redone
  // once the new ones are in.
  const stale = db.staleIds ? (await db.staleIds(profile.id, ANALYSIS_VERSION, 300)).filter((id) => !fresh.includes(id)) : [];
  const todo = [...fresh, ...stale];
  for (const id of todo.slice(0, batch)) {
    let match, timeline;
    try { [match, timeline] = await Promise.all([riot.match(id), riot.timeline(id)]); }
    catch (e) {
      if (e.status !== 404 || !db.keepGame || fresh.includes(id)) throw e;
      await db.keepGame(profile.id, id, { v: ANALYSIS_VERSION });   // Riot no longer has this old game: keep what is saved and stop asking
      continue;
    }
    const role = roleIn(match, puuid), g = role ? analyseGame(match, timeline, puuid, role) : null;
    // 'skip' is a game with nothing to review (a remake, or no position recorded); it is kept so it is not fetched again
    await db.putGame({ user_id: profile.id, match_id: id, role: g ? g.role : 'skip', created: new Date(match.info.gameCreation || Date.now()).toISOString(), analysis: g, v: ANALYSIS_VERSION });
  }
  const remaining = Math.max(0, todo.length - batch);
  if (remaining) return { done: false, remaining, total: ids.length + stale.length };
  const games = (await db.listGames(profile.id, 160)).map((r) => r.analysis).filter(Boolean);
  const stats = allStats(games);
  await db.saveStats(profile.id, stats);
  return { done: true, remaining: 0, total: ids.length + stale.length, stats };
}
