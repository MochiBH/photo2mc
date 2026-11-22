// The compact row a game is listed and judged by. Shared by the server (stats) and the browser (a single game's review),
// so the rules and checkpoints in src/lib/roles.js read one game exactly as they read the list.
export const rowOf = (g) => ({
  id: g.id, t: g.created, date: g.date, q: (g.queue || 'ranked') === 'normal' ? 'n' : 'r', c: g.champ, w: g.win ? 1 : 0, s: g.seconds, k: g.k, d: g.d, a: g.a, j: g.jcs, kp: g.kp,
  cw: g.vision.control_bought, vs: g.vision.per_min, od: g.dragons[0], ed: g.dragons[1], free: g.free_deaths, grubs: g.grubs_mine, fd: g.first_dragon,
  gap10: g.diff.length > 10 ? g.diff[10] : null, rival: g.rival, e15: g.deaths.filter((d) => d.minute < 15).length, vsc: g.vision.score, rvs: g.vision.rival_score,
});
