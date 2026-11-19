#!/usr/bin/env python3
"""Positional report for a League of Legends jungler, from the Riot API.

    python riot_jungle_report.py "The Gonzoogler#WEEEE"
    python riot_jungle_report.py "The Gonzoogler#WEEEE" --count 30 --offline

Fetches recent ranked solo games (queue 420), keeps the ones played as JUNGLE
that lasted over 5 minutes, saves the raw JSON under data/ and writes
out/report.txt, out/deaths.csv, out/objectives.csv, out/map_data.json
(compact, for pasting) and out/map_data_full.json (every group plus death points).

The API key is never stored in code. If RIOT_API_KEY is set it is sent as
X-Riot-Token; otherwise no key header is sent and the network layer is
expected to add it (as a cloud environment's network secret does).
Standard library only.
"""
import argparse
import collections
import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# ----------------------------------------------------------------- fetching

_calls = collections.deque()


def api_get(host, path):
    """GET with a sliding-window limiter: at most 90 requests per 120 s."""
    while True:
        now = time.time()
        while _calls and now - _calls[0] > 120:
            _calls.popleft()
        if len(_calls) < 90:
            break
        time.sleep(120 - (now - _calls[0]) + 0.5)
    headers = {"User-Agent": "riot-jungle-report/1.0", "Accept": "application/json"}
    if os.environ.get("RIOT_API_KEY"):
        headers["X-Riot-Token"] = os.environ["RIOT_API_KEY"]
    url = "https://%s%s" % (host, path)
    for attempt in range(5):
        _calls.append(time.time())
        time.sleep(0.15)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(float(e.headers.get("Retry-After", 10)) + 1)
                continue
            if e.code >= 500 and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit("Riot API error %s for %s\n%s" % (e.code, url, e.read().decode("utf8", "replace")[:500]))
    raise SystemExit("Riot API kept rate-limiting %s" % url)


def cached(path, fetch, offline):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    if offline:
        return None
    data = fetch()
    with open(path, "w") as f:
        json.dump(data, f)
    return data


def load_games(riot_id, count, host, data_dir, offline):
    name, _, tag = riot_id.partition("#")
    os.makedirs(os.path.join(data_dir, "matches"), exist_ok=True)
    q = urllib.parse.quote
    acct_path = os.path.join(data_dir, "account_%s_%s.json" % (name.replace(" ", "_"), tag))
    acct = cached(acct_path, lambda: api_get(host, "/riot/account/v1/accounts/by-riot-id/%s/%s" % (q(name), q(tag))), offline)
    if not acct:
        raise SystemExit("No cached account for %s; run without --offline first." % riot_id)
    puuid = acct["puuid"]
    ids_path = os.path.join(data_dir, "match_ids.json")
    if offline:
        ids = json.load(open(ids_path))[:count]
    else:
        ids = api_get(host, "/lol/match/v5/matches/by-puuid/%s/ids?queue=420&count=%d" % (puuid, count))
        with open(ids_path, "w") as f:
            json.dump(ids, f)
    games = []
    for mid in ids:
        m = cached(os.path.join(data_dir, "matches", mid + ".json"),
                   lambda: api_get(host, "/lol/match/v5/matches/" + mid), offline)
        t = cached(os.path.join(data_dir, "matches", mid + "_timeline.json"),
                   lambda: api_get(host, "/lol/match/v5/matches/%s/timeline" % mid), offline)
        if m and t:
            games.append((m, t))
    return puuid, games


# -------------------------------------------------------------------- zones
# Summoner's Rift: blue base bottom-left (0,0), red base top-right.
# The river runs along x + y = 14800. Top side is y > x.

MAP = 14800
BASE_R = 4700      # distance from the base corner
LANE_EDGE = 2300   # top lane hugs x<2300 / y>12500, bot lane y<2300 / x>12500
MID_HALF = 1200    # |x - y| below this is the mid lane
RIVER_HALF = 1400  # |x + y - 14800| below this is the river
LANES = ("top_lane", "mid_lane", "bot_lane")


def raw_zone(x, y):
    if math.hypot(x, y) < BASE_R:
        return "blue_base"
    if math.hypot(MAP - x, MAP - y) < BASE_R:
        return "red_base"
    if x < LANE_EDGE or y > MAP - LANE_EDGE:
        return "top_lane"
    if y < LANE_EDGE or x > MAP - LANE_EDGE:
        return "bot_lane"
    if abs(x - y) < MID_HALF:
        return "mid_lane"
    if abs(x + y - MAP) < RIVER_HALF:
        return "river"
    return "blue_jungle" if x + y < MAP else "red_jungle"


def zone_for(team, x, y):
    """Zone from one team's point of view (team 100 = blue, 200 = red)."""
    z = raw_zone(x, y)
    mine, theirs = ("blue", "red") if team == 100 else ("red", "blue")
    return z.replace(mine + "_", "my_").replace(theirs + "_", "enemy_")


def side_of(x, y):
    return "top" if y > x else "bot"


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


# -------------------------------------------------------------- game helpers

BRW = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5]


def death_timer(level, t_s):
    """Approximate respawn time in seconds (base by level, scaled by game time)."""
    m = t_s / 60.0
    if m < 15:
        f = 0
    elif m < 30:
        f = math.ceil(2 * (m - 15)) * 0.425
    elif m < 45:
        f = 12.75 + math.ceil(2 * (m - 30)) * 0.30
    else:
        f = 21.75 + math.ceil(2 * (m - 45)) * 1.45
    return BRW[max(1, min(18, level)) - 1] * (1 + min(f, 50) / 100.0)


def pos_of(frame, pid):
    p = frame["participantFrames"][str(pid)].get("position") or {}
    return (p.get("x", 0), p.get("y", 0))


def frame_at_or_before(frames, t_ms):
    best = frames[0]
    for fr in frames:
        if fr["timestamp"] <= t_ms + 500:
            best = fr
        else:
            break
    return best


def nearest_frame(frames, t_ms):
    return min(frames, key=lambda fr: abs(fr["timestamp"] - t_ms))


def frame_minute(frames, minute):
    return frames[minute] if minute < len(frames) else None


OBJ_NAMES = {"DRAGON": "dragon", "HORDE": "voidgrub", "RIFTHERALD": "herald",
             "BARON_NASHOR": "baron", "ATAKHAN": "atakhan"}
NEAR = 3000        # "near me" radius around a death, in map units
OBJ_NEAR = 3500    # "at the objective" radius
CHECKPOINTS = (5, 10, 15, 20)
GAP = 8            # jungle CS behind that counts as a real gap (two camps)


def analyse_game(match, timeline, puuid):
    info = match["info"]
    parts = info["participants"]
    me = next((p for p in parts if p["puuid"] == puuid), None)
    if not me or me.get("teamPosition") != "JUNGLE" or info["gameDuration"] <= 300:
        return None
    pid, team = me["participantId"], me["teamId"]
    team_of = {p["participantId"]: p["teamId"] for p in parts}
    allies = [p for p in team_of if team_of[p] == team and p != pid]
    enemies = [p for p in team_of if team_of[p] != team]
    foe = next((p for p in parts if p["teamId"] != team and p.get("teamPosition") == "JUNGLE"), None)
    frames = timeline["info"]["frames"]
    events = sorted((e for fr in frames for e in fr["events"]), key=lambda e: e["timestamp"])
    kills = [e for e in events if e["type"] == "CHAMPION_KILL" and "position" in e]
    monsters = [e for e in events if e["type"] == "ELITE_MONSTER_KILL"]

    g = {"id": match["metadata"]["matchId"], "champ": me["championName"], "win": bool(me["win"]),
         "minutes": round(info["gameDuration"] / 60.0, 1), "side": "blue" if team == 100 else "red",
         "k": me["kills"], "d": me["deaths"], "a": me["assists"],
         "enemy_jungler": foe["championName"] if foe else None,
         "patch": ".".join(info.get("gameVersion", "").split(".")[:2])}

    # Dragon is the one objective with a fixed, well-known timer: build its "alive" windows.
    drag_windows, spawn = [], 300.0
    for e in monsters:
        if e.get("monsterType") == "DRAGON":
            t = e["timestamp"] / 1000.0
            drag_windows.append((spawn, t))
            spawn = t + (360 if e.get("monsterSubType") == "ELDER_DRAGON" else 300)
    drag_windows.append((spawn, 1e9))

    # ---- deaths
    my_deaths = []
    for e in kills:
        if e["victimId"] != pid:
            continue
        t = e["timestamp"] / 1000.0
        p = (e["position"]["x"], e["position"]["y"])
        fr = nearest_frame(frames, e["timestamp"])
        near_allies = {a for a in allies if dist(pos_of(fr, a), p) < NEAR}
        near_enemies = {x for x in enemies if dist(pos_of(fr, x), p) < NEAR}
        involved = {e.get("killerId", 0)} | set(e.get("assistingParticipantIds", []))
        near_enemies |= {x for x in involved if x in enemies}
        for o in kills:  # anyone who fought or died right here, right now, was present
            if abs(o["timestamp"] - e["timestamp"]) <= 12000 and dist((o["position"]["x"], o["position"]["y"]), p) < NEAR:
                for x in [o["victimId"], o.get("killerId", 0)] + list(o.get("assistingParticipantIds", [])):
                    if x in allies:
                        near_allies.add(x)
                    elif x in enemies:
                        near_enemies.add(x)
        na, ne = len(near_allies), len(near_enemies)
        situation = "alone" if na == 0 else ("outnumbered" if ne > na + 1 else "with_team")
        dragon_up = any(s - 60 <= t <= k for s, k in drag_windows)
        lost = [OBJ_NAMES.get(m.get("monsterType"), m.get("monsterType", "?").lower()) for m in monsters
                if 0 < m["timestamp"] / 1000.0 - t <= 90 and m.get("killerTeamId") != team]
        level = frame_at_or_before(frames, e["timestamp"])["participantFrames"][str(pid)]["level"]
        my_deaths.append({"t": t, "minute": round(t / 60.0, 1), "x": p[0], "y": p[1],
                          "zone": zone_for(team, *p), "map_side": side_of(*p),
                          "allies": na, "enemies": ne, "situation": situation,
                          "dragon_up": dragon_up, "enemy_took_after": lost,
                          "respawn": t + death_timer(level, t)})
    prev = None
    for d in my_deaths:
        # "free": no enemy died in the same fight, so the death bought nothing
        d["free"] = not any(o["victimId"] in enemies and abs(o["timestamp"] / 1000.0 - d["t"]) <= 15
                            and dist((o["position"]["x"], o["position"]["y"]), (d["x"], d["y"])) < NEAR for o in kills)
        d["soon_after_respawn"] = prev is not None and d["t"] - prev["respawn"] < 90
        prev = d
    g["deaths"] = my_deaths
    g["free_deaths"] = sum(d["free"] for d in my_deaths)
    g["date"] = time.strftime("%Y-%m-%d", time.gmtime(info.get("gameCreation", 0) / 1000.0))

    def alive_at(t):
        return not any(d["t"] <= t < d["respawn"] for d in my_deaths)

    # ---- ganks: lane action before 15:00
    gank = {ln: {"kills": 0, "assists": 0, "deaths": 0, "minutes": 0, "empty_minutes": 0} for ln in LANES}
    payoff = []  # (timestamp, lane) of my lane kills/assists
    for e in kills:
        if e["timestamp"] >= 900000:
            break
        z = raw_zone(e["position"]["x"], e["position"]["y"])
        if z not in gank:
            continue
        if e.get("killerId") == pid:
            gank[z]["kills"] += 1
            payoff.append((e["timestamp"], z))
        elif pid in e.get("assistingParticipantIds", []):
            gank[z]["assists"] += 1
            payoff.append((e["timestamp"], z))
        elif e["victimId"] == pid:
            gank[z]["deaths"] += 1
    for minute in range(2, min(15, len(frames))):
        fr = frames[minute]
        z = raw_zone(*pos_of(fr, pid))
        if z in gank and alive_at(fr["timestamp"] / 1000.0):
            gank[z]["minutes"] += 1
            if not any(ln == z and abs(ts - fr["timestamp"]) <= 60000 for ts, ln in payoff):
                gank[z]["empty_minutes"] += 1
    g["gank"] = gank

    # ---- farm race
    farm, diffs = {}, []
    if foe:
        fid = foe["participantId"]
        for minute, fr in enumerate(frames):
            a, b = fr["participantFrames"][str(pid)], fr["participantFrames"][str(fid)]
            diffs.append(a["jungleMinionsKilled"] - b["jungleMinionsKilled"])
            if minute in CHECKPOINTS:
                farm[minute] = {"jcs": a["jungleMinionsKilled"], "enemy_jcs": b["jungleMinionsKilled"],
                                "gold": a["totalGold"], "enemy_gold": b["totalGold"],
                                "level": a["level"], "enemy_level": b["level"]}
    g["farm"], g["jcs_diff_by_minute"] = farm, diffs[:26]
    g["gap_minute"] = None
    for m in range(2, len(diffs)):
        if all(d <= -GAP for d in diffs[m:m + 4]) and len(diffs[m:m + 4]) >= 2:
            g["gap_minute"] = m
            break

    # ---- objectives
    objs = []
    for e in monsters:
        t = e["timestamp"] / 1000.0
        fr = frame_at_or_before(frames, e["timestamp"] - 1000)
        mp = pos_of(fr, pid)
        op = (e["position"]["x"], e["position"]["y"])
        alive = alive_at(t)
        objs.append({"type": OBJ_NAMES.get(e.get("monsterType"), e.get("monsterType", "?").lower()),
                     "minute": round(t / 60.0, 1), "taker": "mine" if e.get("killerTeamId") == team else "enemy",
                     "alive": alive, "my_zone": zone_for(team, *mp) if alive else "dead",
                     "distance": int(dist(mp, op)), "near": alive and dist(mp, op) < OBJ_NEAR,
                     "same_side": alive and side_of(*mp) == side_of(*op),
                     "took_part": e.get("killerId") == pid or pid in e.get("assistingParticipantIds", []),
                     "obj_zone": raw_zone(*op)})
    g["objectives"] = objs
    g["first_dragon"] = next((o["taker"] for o in objs if o["type"] == "dragon"), None)
    g["grubs_mine"] = sum(o["type"] == "voidgrub" and o["taker"] == "mine" for o in objs)
    for minute in (5, 8):
        fr = frame_minute(frames, minute)
        if fr:
            p = pos_of(fr, pid)
            g["pos%d" % minute] = {"zone": zone_for(team, *p) if alive_at(fr["timestamp"] / 1000.0) else "dead",
                                   "map_side": side_of(*p), "x": p[0], "y": p[1]}

    # ---- vision
    bought = sum((e["type"] == "ITEM_PURCHASED") - (e["type"] == "ITEM_UNDO" and e.get("beforeId") == 2055)
                 for e in events if e.get("participantId") == pid
                 and (e.get("itemId") == 2055 or e.get("beforeId") == 2055))
    ward_events = collections.Counter(e.get("wardType", "?") for e in events
                                      if e["type"] == "WARD_PLACED" and e.get("creatorId") == pid)
    g["vision"] = {"control_wards_bought": max(bought, 0), "wards_placed": me.get("wardsPlaced", 0),
                   "wards_killed": me.get("wardsKilled", 0), "vision_score": me.get("visionScore", 0),
                   "control_wards_placed": me.get("detectorWardsPlaced", 0),
                   "ward_types": dict(ward_events)}

    # ---- material for checking the zone logic
    g["_zone_check"] = []
    for e in events:
        if e["type"] == "BUILDING_KILL" and e.get("towerType") in ("OUTER_TURRET", "INNER_TURRET"):
            want = {"TOP_LANE": "top_lane", "MID_LANE": "mid_lane", "BOT_LANE": "bot_lane"}.get(e.get("laneType"))
            g["_zone_check"].append((want, raw_zone(e["position"]["x"], e["position"]["y"])))
        elif e["type"] == "ELITE_MONSTER_KILL" and e.get("monsterType") in ("DRAGON", "BARON_NASHOR", "RIFTHERALD", "HORDE"):
            g["_zone_check"].append(("river", raw_zone(e["position"]["x"], e["position"]["y"])))
    return g


# -------------------------------------------------------------- aggregation

def pct(n, d):
    return round(100.0 * n / d) if d else None


def avg(xs, nd=1):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), nd) if xs else None


def minute_bucket(m):
    return "25+" if m >= 25 else "%d-%d" % (5 * int(m // 5), 5 * int(m // 5) + 5)


def aggregate(games):
    n = len(games)
    if not n:
        return {"games": 0}
    out = {"games": n, "wins": sum(g["win"] for g in games), "losses": sum(not g["win"] for g in games),
           "avg_kda": [avg([g[k] for g in games]) for k in ("k", "d", "a")]}
    deaths = [d for g in games for d in g["deaths"]]
    nd = len(deaths)
    out["deaths"] = {
        "total": nd, "per_game": round(nd / n, 1),
        "by_zone": dict(collections.Counter(d["zone"] for d in deaths).most_common()),
        "by_minute": {b: c for b, c in sorted(collections.Counter(minute_bucket(d["minute"]) for d in deaths).items(),
                                               key=lambda kv: int(kv[0].split("-")[0].rstrip("+")))},
        "alone": sum(d["situation"] == "alone" for d in deaths),
        "outnumbered": sum(d["situation"] == "outnumbered" for d in deaths),
        "with_team": sum(d["situation"] == "with_team" for d in deaths),
        "alone_or_outnumbered_pct": pct(sum(d["situation"] != "with_team" for d in deaths), nd),
        "dragon_up_pct": pct(sum(d["dragon_up"] for d in deaths), nd),
        "enemy_took_objective_within_90s": sum(bool(d["enemy_took_after"]) for d in deaths),
        "before_15": sum(d["minute"] < 15 for d in deaths),
        "free": sum(d["free"] for d in deaths),
        "within_90s_of_respawning": sum(d["soon_after_respawn"] for d in deaths),
        "alone_by_zone": dict(collections.Counter(d["zone"] for d in deaths if d["situation"] == "alone").most_common()),
    }
    out["ganks_pre15"] = {}
    for ln in LANES:
        tot = {k: sum(g["gank"][ln][k] for g in games) for k in ("kills", "assists", "deaths", "minutes", "empty_minutes")}
        out["ganks_pre15"][ln] = tot
    farm = {}
    for cp in CHECKPOINTS:
        rows = [g["farm"][cp] for g in games if cp in g["farm"]]
        if rows:
            farm[str(cp)] = {"n": len(rows), "jcs": avg([r["jcs"] for r in rows]), "enemy_jcs": avg([r["enemy_jcs"] for r in rows]),
                             "gold": avg([r["gold"] for r in rows], 0), "enemy_gold": avg([r["enemy_gold"] for r in rows], 0),
                             "level": avg([r["level"] for r in rows]), "enemy_level": avg([r["enemy_level"] for r in rows])}
    curve = []
    for m in range(0, 21):
        vals = [g["jcs_diff_by_minute"][m] for g in games if m < len(g["jcs_diff_by_minute"])]
        curve.append(avg(vals))
    gap_avg = next((m for m in range(2, 21) if curve[m] is not None and curve[m] <= -GAP
                    and all(c is None or c <= -GAP for c in curve[m:m + 4])), None)
    gaps = [g["gap_minute"] for g in games if g["gap_minute"] is not None]
    out["farm_race"] = {"at": farm, "avg_jcs_diff_by_minute": curve, "gap_opens_minute_on_average_curve": gap_avg,
                        "games_where_i_fall_behind": len(gaps), "median_gap_minute_in_those": sorted(gaps)[len(gaps) // 2] if gaps else None}
    objs = [o for g in games for o in g["objectives"]]
    oo = {}
    for typ in sorted({o["type"] for o in objs}):
        for taker in ("mine", "enemy"):
            rows = [o for o in objs if o["type"] == typ and o["taker"] == taker]
            if rows:
                oo["%s_%s" % (typ, taker)] = {
                    "n": len(rows), "alive": sum(o["alive"] for o in rows), "near": sum(o["near"] for o in rows),
                    "same_side": sum(o["same_side"] for o in rows), "took_part": sum(o["took_part"] for o in rows),
                    "my_zone": dict(collections.Counter(o["my_zone"] for o in rows).most_common())}
    out["objectives"] = oo
    for minute in (5, 8):
        rows = [g["pos%d" % minute] for g in games if "pos%d" % minute in g]
        out["at_%d00" % minute] = {"zone": dict(collections.Counter(r["zone"] for r in rows).most_common()),
                                   "map_side": dict(collections.Counter(r["map_side"] for r in rows).most_common())}
    out["vision"] = {"control_wards_bought": sum(g["vision"]["control_wards_bought"] for g in games),
                     "wards_placed_per_game": avg([g["vision"]["wards_placed"] for g in games]),
                     "wards_killed_per_game": avg([g["vision"]["wards_killed"] for g in games]),
                     "vision_score_per_game": avg([g["vision"]["vision_score"] for g in games])}
    return out


CHECKPOINTS = [("took at least one Voidgrub", lambda g: g["grubs_mine"] > 0),
               ("took the first dragon", lambda g: g["first_dragon"] == "mine"),
               ("3 or fewer free deaths", lambda g: g["free_deaths"] <= 3),
               ("5 or fewer deaths", lambda g: g["d"] <= 5)]


def checkpoints(games):
    def rec(rs):
        return "%d-%d" % (sum(g["win"] for g in rs), sum(not g["win"] for g in rs))
    return {name: {"hit": rec([g for g in games if ok(g)]), "missed": rec([g for g in games if not ok(g)])}
            for name, ok in CHECKPOINTS}


def death_band(games):
    lo = [g for g in games if g["d"] <= 5]
    hi = [g for g in games if g["d"] > 5]
    return {"5_or_fewer_deaths": "%d-%d" % (sum(g["win"] for g in lo), sum(not g["win"] for g in lo)),
            "6_plus_deaths": "%d-%d" % (sum(g["win"] for g in hi), sum(not g["win"] for g in hi))}


def compact(a):
    """The headline numbers of one group, small enough to paste into a chat."""
    d, f = a["deaths"], a["farm_race"]
    return {"games": a["games"], "record": "%d-%d" % (a["wins"], a["losses"]), "avg_kda": a["avg_kda"],
            "deaths": {k: d[k] for k in ("total", "per_game", "before_15", "free", "within_90s_of_respawning", "by_zone", "by_minute", "alone", "outnumbered",
                                         "with_team", "enemy_took_objective_within_90s")},
            "ganks_pre15": {ln: [v["kills"], v["assists"], v["deaths"], v["minutes"], v["empty_minutes"]]
                            for ln, v in a["ganks_pre15"].items()},
            "farm_me_vs_enemy": {cp: {"jcs": [r["jcs"], r["enemy_jcs"]], "gold": [int(r["gold"]), int(r["enemy_gold"])],
                                      "level": [r["level"], r["enemy_level"]]} for cp, r in f["at"].items()},
            "jcs_gap_by_minute_0_20": [None if c is None else int(round(c)) for c in f["avg_jcs_diff_by_minute"]],
            "gap_opens_minute": f["gap_opens_minute_on_average_curve"],
            "objectives": {k: [o["n"], o["alive"], o["near"], o["took_part"]] for k, o in a["objectives"].items()},
            "at_500": a["at_500"], "at_800": a["at_800"], "vision": a["vision"]}


# ------------------------------------------------------------------- output

def fmt_group(name, a):
    if not a.get("games"):
        return ["== %s: no games ==" % name]
    L = ["", "=" * 70, "%s: %d games, %d-%d, average K/D/A %s/%s/%s" % ((name, a["games"], a["wins"], a["losses"]) + tuple(a["avg_kda"])), "=" * 70]
    d = a["deaths"]
    L += ["DEATHS  %d total, %.1f per game, %d before 15:00" % (d["total"], d["per_game"], d["before_15"]),
          "  free (no enemy died with me): %d; died again within 90 s of respawning: %d" % (d["free"], d["within_90s_of_respawn" + "ing"]),
          "  where:  " + ", ".join("%s %d" % kv for kv in d["by_zone"].items()),
          "  when:   " + ", ".join("%s min: %d" % kv for kv in d["by_minute"].items()),
          "  alone %d, outnumbered %d, with team %d  (alone or outnumbered: %s%%)" % (d["alone"], d["outnumbered"], d["with_team"], d["alone_or_outnumbered_pct"]),
          "  alone deaths by zone: " + ", ".join("%s %d" % kv for kv in d["alone_by_zone"].items()),
          "  dragon alive or about to spawn: %s%% of deaths; enemy took an objective within 90 s of %d deaths" % (d["dragon_up_pct"], d["enemy_took_objective_within_90s"]),
          "GANKS before 15:00 (kills / assists / deaths; lane minutes, of which empty)"]
    for ln in LANES:
        k = a["ganks_pre15"][ln]
        L.append("  %-8s %d / %d / %d   %d min in lane, %d with nothing to show" % (ln, k["kills"], k["assists"], k["deaths"], k["minutes"], k["empty_minutes"]))
    f = a["farm_race"]
    L.append("FARM RACE vs enemy jungler (me / them)")
    for cp, r in f["at"].items():
        L.append("  %2s:00  jungle CS %5s / %-5s  gold %6s / %-6s  level %4s / %-4s (n=%d)" % (
            cp, r["jcs"], r["enemy_jcs"], int(r["gold"]), int(r["enemy_gold"]), r["level"], r["enemy_level"], r["n"]))
    L.append("  jungle CS gap by minute (0-20): " + " ".join("%+.0f" % c if c is not None else "." for c in f["avg_jcs_diff_by_minute"]))
    L.append("  gap of %d+ opens on the average curve at minute: %s; fell behind for good in %d games (median minute %s)" % (
        GAP, f["gap_opens_minute_on_average_curve"], f["games_where_i_fall_behind"], f["median_gap_minute_in_those"]))
    L.append("OBJECTIVES (where I was in the minute before each one fell)")
    for key, o in a["objectives"].items():
        L.append("  %-16s n=%-3d alive %d, within reach %d, same half of map %d, took part %d | %s" % (
            key, o["n"], o["alive"], o["near"], o["same_side"], o["took_part"], ", ".join("%s %d" % kv for kv in o["my_zone"].items())))
    for minute in (5, 8):
        p = a["at_%d00" % minute]
        L.append("  at %d:00  %s | map half: %s" % (minute, ", ".join("%s %d" % kv for kv in p["zone"].items()),
                                                    ", ".join("%s %d" % kv for kv in p["map_side"].items())))
    v = a["vision"]
    L.append("VISION  control wards bought: %d total; wards placed %.1f/game, wards killed %.1f/game, vision score %.1f/game" % (
        v["control_wards_bought"], v["wards_placed_per_game"], v["wards_killed_per_game"], v["vision_score_per_game"]))
    return L


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("riot_id", help='Riot ID, e.g. "The Gonzoogler#WEEEE"')
    ap.add_argument("--count", type=int, default=20, help="recent ranked solo games to pull (default 20)")
    ap.add_argument("--host", default="americas.api.riotgames.com", help="regional routing host")
    ap.add_argument("--data", default="data", help="folder for raw JSON")
    ap.add_argument("--out", default="out", help="folder for the report files")
    ap.add_argument("--offline", action="store_true", help="use only the JSON already on disk")
    args = ap.parse_args()

    puuid, raw = load_games(args.riot_id, args.count, args.host, args.data, args.offline)
    games = [g for g in (analyse_game(m, t, puuid) for m, t in raw) if g]
    if not games:
        raise SystemExit("No jungle games over 5 minutes in the last %d ranked games." % len(raw))
    os.makedirs(args.out, exist_ok=True)

    checks = [c for g in games for c in g.pop("_zone_check")]
    by_kind = collections.defaultdict(lambda: [0, 0])
    for want, got in checks:
        by_kind[want][0] += want == got
        by_kind[want][1] += 1

    L = ["Jungle positional report for %s" % args.riot_id,
         "%d ranked solo games pulled, %d kept (jungle, over 5 minutes)" % (len(raw), len(games)),
         "", "ZONE CHECK against real event positions (outer/inner turrets by lane, epic monsters in river):"]
    L += ["  %-9s %d of %d classified correctly" % (k, v[0], v[1]) for k, v in sorted(by_kind.items(), key=lambda kv: str(kv[0]))]
    L += ["", "GAMES"]
    for g in games:
        L.append("  %s  %-9s %-4s %4.1f min  %2d/%2d/%2d  %-4s vs %-10s jungle CS gap at 10/15: %s/%s  fell behind at: %s" % (
            g["id"], g["champ"], "WIN" if g["win"] else "LOSS", g["minutes"], g["k"], g["d"], g["a"], g["side"], g["enemy_jungler"],
            g["jcs_diff_by_minute"][10] if len(g["jcs_diff_by_minute"]) > 10 else "-",
            g["jcs_diff_by_minute"][15] if len(g["jcs_diff_by_minute"]) > 15 else "-", g["gap_minute"]))

    groups = collections.OrderedDict()
    groups["all"] = games
    groups["wins"] = [g for g in games if g["win"]]
    groups["losses"] = [g for g in games if not g["win"]]
    for champ in sorted({g["champ"] for g in games}, key=lambda c: -sum(g["champ"] == c for g in games)):
        groups["champ:" + champ] = [g for g in games if g["champ"] == champ]
        groups["champ:%s:wins" % champ] = [g for g in games if g["champ"] == champ and g["win"]]
        groups["champ:%s:losses" % champ] = [g for g in games if g["champ"] == champ and not g["win"]]
    agg = collections.OrderedDict((k, aggregate(v)) for k, v in groups.items() if v)
    L.append("")
    L.append("RECORD BY DEATHS  5 or fewer: %(5_or_fewer_deaths)s   6 or more: %(6_plus_deaths)s" % death_band(games))
    L.append("CHECKPOINTS (record when hit / when missed; a free death is one where no enemy died with me)")
    for name, r in checkpoints(games).items():
        L.append("  %-28s hit %-5s missed %s" % (name, r["hit"], r["missed"]))
    for k, a in agg.items():
        if k.count(":") < 2:
            L += fmt_group(k.upper(), a)
    report = "\n".join(L)
    with open(os.path.join(args.out, "report.txt"), "w") as f:
        f.write(report + "\n")

    with open(os.path.join(args.out, "deaths.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["match", "champ", "result", "minute", "zone", "map_half", "x", "y", "allies_near", "enemies_near",
                    "situation", "dragon_up", "enemy_took_within_90s", "free", "soon_after_respawn"])
        for g in games:
            for d in g["deaths"]:
                w.writerow([g["id"], g["champ"], "W" if g["win"] else "L", d["minute"], d["zone"], d["map_side"], d["x"], d["y"],
                            d["allies"], d["enemies"], d["situation"], int(d["dragon_up"]), "+".join(d["enemy_took_after"]),
                            int(d["free"]), int(d["soon_after_respawn"])])
    with open(os.path.join(args.out, "objectives.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["match", "champ", "result", "objective", "minute", "taker", "alive", "my_zone", "distance", "near", "same_half", "took_part"])
        for g in games:
            for o in g["objectives"]:
                w.writerow([g["id"], g["champ"], "W" if g["win"] else "L", o["type"], o["minute"], o["taker"], int(o["alive"]),
                            o["my_zone"], o["distance"], int(o["near"]), int(o["same_side"]), int(o["took_part"])])

    map_data = {"player": args.riot_id, "queue": "ranked solo", "games_kept": len(games),
                "record_by_deaths": death_band(games),
                "notes": {"coords": "raw map units, blue base at (0,0), red base at (14800,14800)",
                          "zones": "my_/enemy_ are from my team's side that game",
                          "near_radius": NEAR, "objective_reach_radius": OBJ_NEAR, "gap_threshold_jungle_cs": GAP,
                          "death_points": "[x, y, minute, zone, W/L, my side, situation]"},
                "groups": agg,
                "death_points": [[d["x"], d["y"], d["minute"], d["zone"], "W" if g["win"] else "L", g["side"], d["situation"]]
                                 for g in games for d in g["deaths"]],
                "games": [{"id": g["id"], "champ": g["champ"], "win": g["win"], "min": g["minutes"], "kda": [g["k"], g["d"], g["a"]],
                           "side": g["side"], "vs": g["enemy_jungler"], "gap_minute": g["gap_minute"],
                           "control_wards": g["vision"]["control_wards_bought"]} for g in games]}
    with open(os.path.join(args.out, "map_data_full.json"), "w") as f:
        json.dump(map_data, f, separators=(",", ":"))
    small = {"player": args.riot_id, "games": len(games), "record_by_deaths": death_band(games),
             "checkpoints_hit_vs_missed": checkpoints(games),
             "game_list": [[g["date"], g["champ"], "W" if g["win"] else "L", g["d"], g["free_deaths"], g["grubs_mine"],
                            g["first_dragon"], g["jcs_diff_by_minute"][10] if len(g["jcs_diff_by_minute"]) > 10 else None] for g in games],
             "key": {"ganks_pre15": "[kills, assists, deaths, minutes in lane, minutes with nothing to show]",
                     "objectives": "[count, I was alive, I was within reach the minute before, I took part]; voidgrubs counted one by one",
                     "farm_me_vs_enemy": "[me, enemy jungler] at each minute mark; jcs = jungle CS",
                     "game_list": "[date, champion, result, deaths, free deaths, Voidgrubs my team took, first dragon taker, jungle CS gap at 10:00]",
                     "deaths": "free = no enemy died in the same fight; alone = no ally within %d units; outnumbered = enemies > allies + 1" % NEAR},
             "groups": {k: compact(a) for k, a in agg.items()
                        if k.count(":") == 0 or (k.count(":") == 1 and a["games"] >= 3)}}
    with open(os.path.join(args.out, "map_data.json"), "w") as f:
        f.write("MAP_DATA = " + json.dumps(small, separators=(",", ":")) + "\n")
    print(report)
    print("\nWrote %s/report.txt, deaths.csv, objectives.csv, map_data.json, map_data_full.json" % args.out)


if __name__ == "__main__":
    sys.exit(main())
