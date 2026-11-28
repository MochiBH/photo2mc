// The compact row a game is listed and judged by. Shared by the server (stats) and the browser (a single game's review),
// so the rules and checkpoints in src/lib/roles.js read one game exactly as they read the list.
const at = (list, minute) => (list && list.length > minute ? list[minute] : null);
/** Whose outer tower fell first in the player's lane: 'mine' (theirs fell first), 'enemy', or null. */
export const firstTower = (g) => { const [took, lost] = (g.lane && g.lane.tower) || [null, null]; return took === null && lost === null ? null : lost === null || (took !== null && took < lost) ? 'mine' : 'enemy'; };

export const rowOf = (g) => ({
  id: g.id, t: g.created, date: g.date, q: (g.queue || 'ranked') === 'normal' ? 'n' : 'r', c: g.champ, w: g.win ? 1 : 0, s: g.seconds, k: g.k, d: g.d, a: g.a, j: g.jcs, kp: g.kp,
  cw: g.vision.control_bought, vs: g.vision.per_min, od: g.dragons[0], ed: g.dragons[1], free: g.free_deaths, grubs: g.grubs_mine, fd: g.first_dragon,
  gap10: g.diff.length > 10 ? g.diff[10] : null, rival: g.rival, e15: g.deaths.filter((d) => d.minute < 15).length, vsc: g.vision.score, rvs: g.vision.rival_score,
  // version 3 of the analysis: all CS, the race with the lane opponent, early deaths by kind, and the lane's plates and towers
  cs: g.cs, csd10: at(g.cs_diff, 10), gd15: at(g.gold_diff, 15), gk: g.deaths.filter((d) => d.minute < 15 && d.jg).length, sd: g.deaths.filter((d) => d.minute < 15 && d.n === 1 && !d.jg).length,
  sk: g.lane ? g.lane.solo_kills : 0, pl: g.lane ? g.lane.plates : null, tw: firstTower(g),
});
