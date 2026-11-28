// Positional analysis of one ranked game from Riot match + timeline JSON, and the roll-up the app shows.
// Ported from riot_jungle_report.py; scripts/check-analysis.mjs compares the two on the same raw games.
import { firstTower, rowOf } from './row.mjs';

const MAP = 14800, BASE_R = 4700, LANE_EDGE = 2300, MID_HALF = 1200, RIVER_HALF = 1400;
const LANES = ['top_lane', 'mid_lane', 'bot_lane'];
export const NEAR = 3000, OBJ_NEAR = 3500, GAP = 8;
const OUTER_FROM_BASE = 7800;   // outer towers stand 8,500 to 10,500 from their own base corner; inner ones under 7,100
const MARKS = [5, 10, 15, 20];
const OBJ_NAMES = { DRAGON: 'dragon', HORDE: 'voidgrub', RIFTHERALD: 'herald', BARON_NASHOR: 'baron', ATAKHAN: 'atakhan' };
/* Every position is analysed, so the review list holds every game. Jungle, support and top have rules, stats and a course
   (ROLES in server/roles.mjs). */
export const ROLE_POSITION = { jungle: 'JUNGLE', support: 'UTILITY', top: 'TOP', mid: 'MIDDLE', adc: 'BOTTOM' };
const LANE_OF = { top: 'TOP_LANE', mid: 'MID_LANE', adc: 'BOT_LANE', support: 'BOT_LANE' };   // the lane a role's towers stand in, as the timeline names it
const POSITION_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
/** Which role the player had in a match, or null (no position recorded: a remake or an odd game mode). */
export function roleIn(match, puuid) {
  const me = match.info.participants.find((p) => p.puuid === puuid);
  return (me && Object.keys(ROLE_POSITION).find((r) => ROLE_POSITION[r] === me.teamPosition)) || null;
}
/* Bump this when a game's saved analysis gains something; the sync then redoes older saved games a few at a time.
   2: both teams' champions, and who killed you in each death.
   3: the lane race for laners (all CS against the opponent, plates and the first tower in your lane, solo kills), and for
      each death how many enemies got credit and whether their jungler was one of them. */
export const ANALYSIS_VERSION = 3;
/* The two kinds of game the site reads: ranked solo (queue 420) and normal draft (queue 400). Swiftplay is left out on
   purpose: it runs on faster timers, so its farm and objective numbers would not compare. */
export const QUEUES = { ranked: 420, normal: 400 };
const kindOf = (g) => g.queue || 'ranked';   // games analysed before normals were added carry no kind; they were all ranked

export function rawZone(x, y) {
  if (Math.hypot(x, y) < BASE_R) return 'blue_base';
  if (Math.hypot(MAP - x, MAP - y) < BASE_R) return 'red_base';
  if (x < LANE_EDGE || y > MAP - LANE_EDGE) return 'top_lane';
  if (y < LANE_EDGE || x > MAP - LANE_EDGE) return 'bot_lane';
  if (Math.abs(x - y) < MID_HALF) return 'mid_lane';
  if (Math.abs(x + y - MAP) < RIVER_HALF) return 'river';
  return x + y < MAP ? 'blue_jungle' : 'red_jungle';
}
const zoneFor = (team, x, y) => { const [mine, theirs] = team === 100 ? ['blue', 'red'] : ['red', 'blue']; return rawZone(x, y).replace(mine + '_', 'my_').replace(theirs + '_', 'enemy_'); };
const sideOf = (x, y) => (y > x ? 'top' : 'bot');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const BRW = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];
function deathTimer(level, t) {
  const m = t / 60;
  const f = m < 15 ? 0 : m < 30 ? Math.ceil(2 * (m - 15)) * 0.425 : m < 45 ? 12.75 + Math.ceil(2 * (m - 30)) * 0.3 : 21.75 + Math.ceil(2 * (m - 45)) * 1.45;
  return BRW[Math.max(1, Math.min(18, level)) - 1] * (1 + Math.min(f, 50) / 100);
}
const posOf = (frame, pid) => { const p = frame.participantFrames[String(pid)].position || {}; return [p.x || 0, p.y || 0]; };
function frameAtOrBefore(frames, t) { let best = frames[0]; for (const fr of frames) { if (fr.timestamp <= t + 500) best = fr; else break; } return best; }
const nearestFrame = (frames, t) => frames.reduce((a, b) => (Math.abs(b.timestamp - t) < Math.abs(a.timestamp - t) ? b : a));
const r1 = (v) => Math.round(v * 10) / 10;

/** One game, from one player's point of view. Returns null when it is not a game in that role or was a remake. */
export function analyseGame(match, timeline, puuid, role = 'jungle') {
  const info = match.info, parts = info.participants, position = ROLE_POSITION[role];
  const me = parts.find((p) => p.puuid === puuid);
  if (!me || me.teamPosition !== position || info.gameDuration <= 300) return null;
  const pid = me.participantId, team = me.teamId;
  const teamOf = Object.fromEntries(parts.map((p) => [p.participantId, p.teamId]));
  const ids = parts.map((p) => p.participantId);
  const allies = ids.filter((p) => teamOf[p] === team && p !== pid), enemies = ids.filter((p) => teamOf[p] !== team);
  const isAlly = new Set(allies), isEnemy = new Set(enemies);
  const foe = parts.find((p) => p.teamId !== team && p.teamPosition === position) || null;
  const foeJungler = (parts.find((p) => p.teamId !== team && p.teamPosition === 'JUNGLE') || {}).participantId || 0;
  const frames = timeline.info.frames;
  const events = frames.flatMap((fr) => fr.events).sort((a, b) => a.timestamp - b.timestamp);
  const kills = events.filter((e) => e.type === 'CHAMPION_KILL' && e.position);
  const monsters = events.filter((e) => e.type === 'ELITE_MONSTER_KILL');
  const teamKills = parts.filter((p) => p.teamId === team).reduce((s, p) => s + p.kills, 0);
  const mine = (info.teams || []).find((t) => t.teamId === team), theirs = (info.teams || []).find((t) => t.teamId !== team);
  const drakes = (t) => (t && t.objectives && t.objectives.dragon && t.objectives.dragon.kills) || 0;

  const champOf = Object.fromEntries(parts.map((p) => [p.participantId, p.championName]));
  const lineup = (teamId) => parts.filter((p) => p.teamId === teamId).sort((a, b) => POSITION_ORDER.indexOf(a.teamPosition) - POSITION_ORDER.indexOf(b.teamPosition)).map((p) => p.championName);

  const g = {
    v: ANALYSIS_VERSION, teams: { mine: lineup(team), theirs: lineup(team === 100 ? 200 : 100) },
    id: match.metadata.matchId, role, queue: info.queueId === QUEUES.normal ? 'normal' : 'ranked', champ: me.championName, win: !!me.win, minutes: r1(info.gameDuration / 60), seconds: info.gameDuration,
    side: team === 100 ? 'blue' : 'red', k: me.kills, d: me.deaths, a: me.assists, rival: foe ? foe.championName : null,
    created: info.gameCreation || 0, date: new Date(info.gameCreation || 0).toISOString().slice(0, 10),
    jcs: me.neutralMinionsKilled || 0, cs: (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0),
    kp: teamKills ? Math.round(((me.kills + me.assists) / teamKills) * 100) : 0, dragons: [drakes(mine), drakes(theirs)],
  };

  const dragWindows = []; let spawn = 300;
  for (const e of monsters) if (e.monsterType === 'DRAGON') { const t = e.timestamp / 1000; dragWindows.push([spawn, t]); spawn = t + (e.monsterSubType === 'ELDER_DRAGON' ? 360 : 300); }
  dragWindows.push([spawn, 1e9]);

  // deaths
  const deaths = [];
  for (const e of kills) {
    if (e.victimId !== pid) continue;
    const t = e.timestamp / 1000, p = [e.position.x, e.position.y], fr = nearestFrame(frames, e.timestamp);
    const nearA = new Set(allies.filter((a) => dist(posOf(fr, a), p) < NEAR)), nearE = new Set(enemies.filter((x) => dist(posOf(fr, x), p) < NEAR));
    for (const x of [e.killerId || 0, ...(e.assistingParticipantIds || [])]) if (isEnemy.has(x)) nearE.add(x);
    for (const o of kills) {
      if (Math.abs(o.timestamp - e.timestamp) <= 12000 && dist([o.position.x, o.position.y], p) < NEAR) {
        for (const x of [o.victimId, o.killerId || 0, ...(o.assistingParticipantIds || [])]) { if (isAlly.has(x)) nearA.add(x); else if (isEnemy.has(x)) nearE.add(x); }
      }
    }
    const na = nearA.size, ne = nearE.size;
    const lost = monsters.filter((m) => m.timestamp / 1000 - t > 0 && m.timestamp / 1000 - t <= 90 && m.killerTeamId !== team).map((m) => OBJ_NAMES[m.monsterType] || String(m.monsterType || '?').toLowerCase());
    const level = frameAtOrBefore(frames, e.timestamp).participantFrames[String(pid)].level;
    const credit = [e.killerId || 0, ...(e.assistingParticipantIds || [])].filter((x) => isEnemy.has(x));   // exact, unlike the once-a-minute positions
    deaths.push({ t, minute: r1(t / 60), x: p[0], y: p[1], zone: zoneFor(team, p[0], p[1]), allies: na, enemies: ne, by: champOf[e.killerId] || null, n: credit.length, jg: credit.includes(foeJungler),
      situation: na === 0 ? 'alone' : ne > na + 1 ? 'outnumbered' : 'with_team', dragon_up: dragWindows.some(([s, k]) => s - 60 <= t && t <= k), took: lost, respawn: t + deathTimer(level, t) });
  }
  let prev = null;
  for (const d of deaths) {
    d.free = !kills.some((o) => isEnemy.has(o.victimId) && Math.abs(o.timestamp / 1000 - d.t) <= 15 && dist([o.position.x, o.position.y], [d.x, d.y]) < NEAR);
    d.quick = prev !== null && d.t - prev.respawn < 90;
    prev = d;
  }
  g.deaths = deaths; g.free_deaths = deaths.filter((d) => d.free).length;
  const aliveAt = (t) => !deaths.some((d) => d.t <= t && t < d.respawn);

  // lane action before 15:00 (ganks for a jungler, lane and roams for a support)
  const gank = Object.fromEntries(LANES.map((l) => [l, { kills: 0, assists: 0, deaths: 0, minutes: 0, empty: 0 }]));
  const payoff = [];
  for (const e of kills) {
    if (e.timestamp >= 900000) break;
    const z = rawZone(e.position.x, e.position.y);
    if (!gank[z]) continue;
    if (e.killerId === pid) { gank[z].kills++; payoff.push([e.timestamp, z]); }
    else if ((e.assistingParticipantIds || []).includes(pid)) { gank[z].assists++; payoff.push([e.timestamp, z]); }
    else if (e.victimId === pid) gank[z].deaths++;
  }
  for (let minute = 2; minute < Math.min(15, frames.length); minute++) {
    const fr = frames[minute], z = rawZone(...posOf(fr, pid));
    if (gank[z] && aliveAt(fr.timestamp / 1000)) { gank[z].minutes++; if (!payoff.some(([ts, ln]) => ln === z && Math.abs(ts - fr.timestamp) <= 60000)) gank[z].empty++; }
  }
  g.gank = gank;

  // the race against the enemy in the same role
  const farm = {}, diffs = [], goldDiffs = [], csDiffs = [];
  if (foe) {
    const all = (f) => (f.minionsKilled || 0) + (f.jungleMinionsKilled || 0);   // lane minions and camps together: what the scoreboard calls CS
    frames.forEach((fr, minute) => {
      const a = fr.participantFrames[String(pid)], b = fr.participantFrames[String(foe.participantId)];
      diffs.push(a.jungleMinionsKilled - b.jungleMinionsKilled); goldDiffs.push(a.totalGold - b.totalGold); csDiffs.push(all(a) - all(b));
      if (MARKS.includes(minute)) farm[minute] = { jcs: [a.jungleMinionsKilled, b.jungleMinionsKilled], gold: [a.totalGold, b.totalGold], level: [a.level, b.level], cs: [all(a), all(b)] };
    });
  }
  g.farm = farm; g.diff = diffs.slice(0, 26); g.gold_diff = goldDiffs.slice(0, 26); g.cs_diff = csDiffs.slice(0, 26); g.gap_minute = null;
  for (let m = 2; m < diffs.length; m++) { const w = diffs.slice(m, m + 4); if (w.length >= 2 && w.every((d) => d <= -GAP)) { g.gap_minute = m; break; } }

  // the player's own lane: plates and the outer tower on each side, and kills won alone before 15:00
  const laneType = LANE_OF[role];
  if (laneType) {
    // An event's teamId is the team that owned the plate or the tower. Every tower in a lane has plates this season; only
    // the outer one's count, and it is the one standing furthest from its own base.
    const baseOf = (teamId) => (teamId === 100 ? [0, 0] : [MAP, MAP]);
    const inLane = events.filter((e) => e.laneType === laneType);
    const plates = inLane.filter((e) => e.type === 'TURRET_PLATE_DESTROYED' && e.position && dist([e.position.x, e.position.y], baseOf(e.teamId)) > OUTER_FROM_BASE);
    const outer = (ours) => { const e = inLane.find((x) => x.type === 'BUILDING_KILL' && x.towerType === 'OUTER_TURRET' && (x.teamId === team) === ours); return e ? r1(e.timestamp / 60000) : null; };
    g.lane = { plates: [plates.filter((e) => e.teamId !== team).length, plates.filter((e) => e.teamId === team).length], tower: [outer(false), outer(true)],
      solo_kills: kills.filter((e) => e.timestamp < 900000 && e.killerId === pid && !(e.assistingParticipantIds || []).length).length };
  } else g.lane = null;

  // objectives
  g.objectives = monsters.map((e) => {
    const t = e.timestamp / 1000, mp = posOf(frameAtOrBefore(frames, e.timestamp - 1000), pid), op = [e.position.x, e.position.y], alive = aliveAt(t);
    return { type: OBJ_NAMES[e.monsterType] || String(e.monsterType || '?').toLowerCase(), minute: r1(t / 60), taker: e.killerTeamId === team ? 'mine' : 'enemy', alive,
      my_zone: alive ? zoneFor(team, mp[0], mp[1]) : 'dead', near: alive && dist(mp, op) < OBJ_NEAR, took_part: e.killerId === pid || (e.assistingParticipantIds || []).includes(pid) };
  });
  const firstDragon = g.objectives.find((o) => o.type === 'dragon');
  g.first_dragon = firstDragon ? firstDragon.taker : null;
  g.grubs_mine = g.objectives.filter((o) => o.type === 'voidgrub' && o.taker === 'mine').length;

  // vision
  let bought = 0;
  for (const e of events) {
    if (e.participantId !== pid) continue;
    if (e.type === 'ITEM_PURCHASED' && e.itemId === 2055) bought++;
    else if (e.type === 'ITEM_UNDO' && e.beforeId === 2055) bought--;
  }
  g.vision = { control_bought: Math.max(bought, 0), placed: me.wardsPlaced || 0, killed: me.wardsKilled || 0, score: me.visionScore || 0,
    rival_score: foe ? foe.visionScore || 0 : null, per_min: r1((me.visionScore || 0) / (info.gameDuration / 60)) };
  return g;
}

/* ---------- roll-up ---------- */
const avg = (xs, nd = 1) => { xs = xs.filter((x) => x !== null && x !== undefined); if (!xs.length) return null; const f = 10 ** nd; return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * f) / f; };
const tally = (list) => { const c = {}; for (const k of list) c[k] = (c[k] || 0) + 1; return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1])); };
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

export function group(games) {
  const n = games.length, wins = games.filter((g) => g.win).length;
  const deaths = games.flatMap((g) => g.deaths), objs = games.flatMap((g) => g.objectives);
  const farm = {};
  for (const cp of MARKS) {
    const rows = games.map((g) => g.farm[cp]).filter(Boolean);
    if (rows.length) farm[cp] = { jcs: [avg(rows.map((r) => r.jcs[0])), avg(rows.map((r) => r.jcs[1]))], gold: [avg(rows.map((r) => r.gold[0]), 0), avg(rows.map((r) => r.gold[1]), 0)], level: [avg(rows.map((r) => r.level[0])), avg(rows.map((r) => r.level[1]))] };
  }
  for (const cp of MARKS) {   // all CS at each mark; games saved before version 3 do not have it
    const rows = games.map((g) => g.farm[cp]).filter((r) => r && r.cs);
    if (rows.length && farm[cp]) farm[cp].cs = [avg(rows.map((r) => r.cs[0])), avg(rows.map((r) => r.cs[1]))];
  }
  const curve = (key) => Array.from({ length: 21 }, (_, m) => { const v = avg(games.filter((g) => m < (g[key] || []).length).map((g) => g[key][m])); return v === null ? null : Math.round(v); });
  const laned = games.filter((g) => g.lane), early = deaths.filter((d) => d.minute < 15);
  const obj = {};
  for (const typ of [...new Set(objs.map((o) => o.type))].sort()) for (const taker of ['mine', 'enemy']) {
    const rows = objs.filter((o) => o.type === typ && o.taker === taker);
    if (rows.length) obj[typ + '_' + taker] = [rows.length, rows.filter((o) => o.alive).length, rows.filter((o) => o.near).length, rows.filter((o) => o.took_part).length, rows.filter((o) => o.my_zone === 'my_jungle').length];
  }
  return {
    games: n, record: wins + '-' + (n - wins), kda: [avg(games.map((g) => g.k)), avg(games.map((g) => g.d)), avg(games.map((g) => g.a))], kp: avg(games.map((g) => g.kp), 0),
    deaths: deaths.length, before15: deaths.filter((d) => d.minute < 15).length, free: deaths.filter((d) => d.free).length, quick: deaths.filter((d) => d.quick).length,
    alone: deaths.filter((d) => d.situation === 'alone').length, out: deaths.filter((d) => d.situation === 'outnumbered').length, team: deaths.filter((d) => d.situation === 'with_team').length,
    took: deaths.filter((d) => d.took.length).length, zones: tally(deaths.map((d) => d.zone)),
    gap: curve('diff'), gold_gap: curve('gold_diff'), farm,
    ganks: Object.fromEntries(LANES.map((l) => [l, ['kills', 'assists', 'deaths', 'minutes', 'empty'].map((k) => sum(games, (g) => g.gank[l][k]))])),
    obj,
    vision: { control: sum(games, (g) => g.vision.control_bought), placed: avg(games.map((g) => g.vision.placed)), killed: avg(games.map((g) => g.vision.killed)), score: avg(games.map((g) => g.vision.score)),
      per_min: avg(games.map((g) => g.vision.per_min)), rival_score: avg(games.map((g) => g.vision.rival_score)) },
    jcs_min: avg(games.map((g) => g.jcs / (g.seconds / 60))), cs_min: avg(games.map((g) => g.cs / (g.seconds / 60))), cs_gap: curve('cs_diff'),
    // the lane: plates [taken, lost], who lost their outer tower first [theirs fell first, yours fell first], kills won alone
    // before 15:00, and early deaths their jungler had a hand in, or that one enemy managed alone
    lane: { games: laned.length, plates: [sum(laned, (g) => g.lane.plates[0]), sum(laned, (g) => g.lane.plates[1])], tower: [laned.filter((g) => firstTower(g) === 'mine').length, laned.filter((g) => firstTower(g) === 'enemy').length],
      solo_kills: sum(laned, (g) => g.lane.solo_kills), gank_deaths: early.filter((d) => d.jg).length, solo_deaths: early.filter((d) => d.n === 1 && !d.jg).length },
    early_free: deaths.filter((d) => d.minute < 15 && d.free).length, early_zones: tally(deaths.filter((d) => d.minute < 15).map((d) => d.zone)),
  };
}

/** Everything the app shows for one player: newest games first, at most `limit`. */
/** The numbers one screen shows: the latest `limit` games in a role, of one kind (`queue` 'ranked' or 'normal') or of both. */
export function buildStats(all, role, limit = 20, queue = 'both') {
  const games = all.filter((g) => g && g.role === role && (queue === 'both' || kindOf(g) === queue)).sort((a, b) => b.created - a.created).slice(0, limit);
  const champs = Object.entries(tally(games.map((g) => g.champ))).filter(([, c]) => c >= 2).slice(0, 4).map(([c]) => c);
  const groups = { all: group(games), wins: group(games.filter((g) => g.win)), losses: group(games.filter((g) => !g.win)) };
  for (const c of champs) groups[c] = group(games.filter((g) => g.champ === c));
  return {
    role, queue, games: games.length, champs, updated: new Date().toISOString(), groups,
    deaths: games.flatMap((g) => g.deaths.map((d) => [d.x, d.y, d.minute, d.zone, g.win ? 'W' : 'L', g.champ, d.allies, d.enemies, d.took[0] || '', d.free ? 1 : 0, d.quick ? 1 : 0, d.jg ? 1 : 0, d.n ?? null])),
    list: games.map(rowOf),
  };
}
