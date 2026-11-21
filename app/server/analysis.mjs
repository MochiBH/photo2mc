// Positional analysis of one ranked game from Riot match + timeline JSON, and the roll-up the app shows.
// Ported from riot_jungle_report.py; scripts/check-analysis.mjs compares the two on the same raw games.

const MAP = 14800, BASE_R = 4700, LANE_EDGE = 2300, MID_HALF = 1200, RIVER_HALF = 1400;
const LANES = ['top_lane', 'mid_lane', 'bot_lane'];
export const NEAR = 3000, OBJ_NEAR = 3500, GAP = 8;
const MARKS = [5, 10, 15, 20];
const OBJ_NAMES = { DRAGON: 'dragon', HORDE: 'voidgrub', RIFTHERALD: 'herald', BARON_NASHOR: 'baron', ATAKHAN: 'atakhan' };
export const ROLE_POSITION = { jungle: 'JUNGLE', support: 'UTILITY' };

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
  const frames = timeline.info.frames;
  const events = frames.flatMap((fr) => fr.events).sort((a, b) => a.timestamp - b.timestamp);
  const kills = events.filter((e) => e.type === 'CHAMPION_KILL' && e.position);
  const monsters = events.filter((e) => e.type === 'ELITE_MONSTER_KILL');
  const teamKills = parts.filter((p) => p.teamId === team).reduce((s, p) => s + p.kills, 0);
  const mine = (info.teams || []).find((t) => t.teamId === team), theirs = (info.teams || []).find((t) => t.teamId !== team);
  const drakes = (t) => (t && t.objectives && t.objectives.dragon && t.objectives.dragon.kills) || 0;

  const g = {
    id: match.metadata.matchId, role, champ: me.championName, win: !!me.win, minutes: r1(info.gameDuration / 60), seconds: info.gameDuration,
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
    deaths.push({ t, minute: r1(t / 60), x: p[0], y: p[1], zone: zoneFor(team, p[0], p[1]), allies: na, enemies: ne,
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
  const farm = {}, diffs = [], goldDiffs = [];
  if (foe) {
    frames.forEach((fr, minute) => {
      const a = fr.participantFrames[String(pid)], b = fr.participantFrames[String(foe.participantId)];
      diffs.push(a.jungleMinionsKilled - b.jungleMinionsKilled); goldDiffs.push(a.totalGold - b.totalGold);
      if (MARKS.includes(minute)) farm[minute] = { jcs: [a.jungleMinionsKilled, b.jungleMinionsKilled], gold: [a.totalGold, b.totalGold], level: [a.level, b.level] };
    });
  }
  g.farm = farm; g.diff = diffs.slice(0, 26); g.gold_diff = goldDiffs.slice(0, 26); g.gap_minute = null;
  for (let m = 2; m < diffs.length; m++) { const w = diffs.slice(m, m + 4); if (w.length >= 2 && w.every((d) => d <= -GAP)) { g.gap_minute = m; break; } }

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
  const curve = (key) => Array.from({ length: 21 }, (_, m) => { const v = avg(games.filter((g) => m < g[key].length).map((g) => g[key][m])); return v === null ? null : Math.round(v); });
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
    jcs_min: avg(games.map((g) => g.jcs / (g.seconds / 60))),
    early_free: deaths.filter((d) => d.minute < 15 && d.free).length, early_zones: tally(deaths.filter((d) => d.minute < 15).map((d) => d.zone)),
  };
}

/** Everything the app shows for one player: newest games first, at most `limit`. */
export function buildStats(all, role, limit = 20) {
  const games = all.filter((g) => g && g.role === role).sort((a, b) => b.created - a.created).slice(0, limit);
  const champs = Object.entries(tally(games.map((g) => g.champ))).filter(([, c]) => c >= 2).slice(0, 4).map(([c]) => c);
  const groups = { all: group(games), wins: group(games.filter((g) => g.win)), losses: group(games.filter((g) => !g.win)) };
  for (const c of champs) groups[c] = group(games.filter((g) => g.champ === c));
  return {
    role, games: games.length, champs, updated: new Date().toISOString(), groups,
    deaths: games.flatMap((g) => g.deaths.map((d) => [d.x, d.y, d.minute, d.zone, g.win ? 'W' : 'L', g.champ, d.allies, d.enemies, d.took[0] || '', d.free ? 1 : 0, d.quick ? 1 : 0])),
    list: games.map((g) => ({ id: g.id, t: g.created, date: g.date, c: g.champ, w: g.win ? 1 : 0, s: g.seconds, k: g.k, d: g.d, a: g.a, j: g.jcs, kp: g.kp, cw: g.vision.control_bought,
      vs: g.vision.per_min, od: g.dragons[0], ed: g.dragons[1], free: g.free_deaths, grubs: g.grubs_mine, fd: g.first_dragon, gap10: g.diff.length > 10 ? g.diff[10] : null, rival: g.rival,
      e15: g.deaths.filter((d) => d.minute < 15).length, vsc: g.vision.score, rvs: g.vision.rival_score })),
  };
}
