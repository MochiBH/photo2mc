// What each role is measured on. Every rule and checkpoint is a test on one game row from the player's stats.
export const cspm = (g) => g.j / (g.s / 60);
export const rec = (list) => { const w = list.filter((g) => g.w).length; return w + '–' + (list.length - w); };
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

export const RULES = {
  jungle: [
    { name: 'Die five times or fewer', how: 'After your fourth death, only fight at an objective.', ok: (g) => g.d <= 5, chip: (g) => plural(g.d, 'death', 'deaths') },
    { name: '5.0 jungle CS a minute', how: 'Clear your side of the map before you cross it.', ok: (g) => cspm(g) >= 5, chip: (g) => cspm(g).toFixed(1) + ' CS/min' },
    { name: 'Buy two control wards', how: 'One on every recall after your first item, placed by the next objective.', ok: (g) => g.cw >= 2, chip: (g) => plural(g.cw, 'control ward', 'control wards') },
  ],
  support: [
    { name: 'Die five times or fewer', how: 'Stay behind your front line, and never walk past the river to ward on your own.', ok: (g) => g.d <= 5, chip: (g) => plural(g.d, 'death', 'deaths') },
    { name: 'Buy three control wards', how: 'One on every recall. Place it by the next objective a minute before it spawns.', ok: (g) => g.cw >= 3, chip: (g) => plural(g.cw, 'control ward', 'control wards') },
    { name: '1.5 vision score a minute', how: 'Ward before objectives, sweep the path your team will walk, and finish your support item on time.', ok: (g) => g.vs >= 1.5, chip: (g) => g.vs.toFixed(1) + ' vision/min' },
  ],
};

/* Checkpoints are personal: from a pool of candidates per role, each player gets the three that best separate
   their own wins from their own losses. With too few games to tell, the first three in the pool are used. */
const POOL = {
  jungle: [
    { id: 'grubs', name: 'Take at least one Voidgrub', how: 'Top side by 7:30, gank top, then take them with your top laner.', ok: (g) => g.grubs > 0, chip: (g) => plural(g.grubs, 'Voidgrub', 'Voidgrubs') },
    { id: 'drake', name: 'Take the first dragon', how: 'Clear toward bot side and be at the pit, with a teammate, a minute before it spawns at 5:00.', ok: (g) => g.fd === 'mine', chip: (g) => 'First dragon ' + (g.fd === 'mine' ? 'yours' : 'theirs') },
    { id: 'free', name: 'Three free deaths or fewer', how: 'Before you walk into a fight, count heads. If they have more people there, leave. After you respawn, clear one camp before you go back in.', ok: (g) => g.free <= 3, chip: (g) => plural(g.free, 'free death', 'free deaths') },
    { id: 'early', name: 'Two deaths or fewer before 15:00', how: 'Full clear before your first gank, and skip any gank where the enemy is under their own tower.', ok: (g) => g.e15 <= 2, chip: (g) => plural(g.e15, 'early death', 'early deaths') },
    { id: 'farm', name: 'Within two camps at 10:00', how: 'Between 5:00 and 10:00, clear every camp that is up before you walk to a lane.', ok: (g) => g.gap10 !== null && g.gap10 >= -8, chip: (g) => 'Farm at 10:00 ' + (g.gap10 > 0 ? '+' : '') + g.gap10 },
    { id: 'deaths', name: 'Die five times or fewer', how: 'After your fourth death, only fight at an objective.', ok: (g) => g.d <= 5, chip: (g) => plural(g.d, 'death', 'deaths') },
  ],
  support: [
    { id: 'drake', name: 'Your team takes the first dragon', how: 'Recall around 4:00, come back with a control ward, and ward the pit with your jungler before 5:00.', ok: (g) => g.fd === 'mine', chip: (g) => 'First dragon ' + (g.fd === 'mine' ? 'yours' : 'theirs') },
    { id: 'free', name: 'Three free deaths or fewer', how: 'A free death is one where no enemy died with you. Most of them come from going in when nobody can follow.', ok: (g) => g.free <= 3, chip: (g) => plural(g.free, 'free death', 'free deaths') },
    { id: 'kp', name: "In half of your team's kills", how: 'Follow your jungler to fights near you, and roam mid when your wave is pushed in and your ADC is safe.', ok: (g) => g.kp >= 50, chip: (g) => g.kp + '% of kills' },
    { id: 'free2', name: 'Two free deaths or fewer', how: 'Only start a fight when your ADC is close enough, and healthy enough, to follow you in.', ok: (g) => g.free <= 2, chip: (g) => plural(g.free, 'free death', 'free deaths') },
    { id: 'early', name: 'One death or none before 15:00', how: 'After your first death in lane, no more all-ins unless your jungler is there.', ok: (g) => g.e15 <= 1, chip: (g) => plural(g.e15, 'early death', 'early deaths') },
    { id: 'vision', name: 'Out-ward the enemy support', how: 'Keep your trinket and support-item wards on cooldown, and clear theirs with Oracle Lens before every objective.', ok: (g) => g.rvs != null && g.vsc > g.rvs, chip: (g) => `Vision ${g.vsc}–${g.rvs ?? '?'}` },
    { id: 'deaths', name: 'Die five times or fewer', how: 'Stay behind your front line, and never walk past the river to ward on your own.', ok: (g) => g.d <= 5, chip: (g) => plural(g.d, 'death', 'deaths') },
  ],
};
const FAMILY = { free: 'free', free2: 'free', early: 'deaths', deaths: 'deaths' };   // don't show two versions of the same idea

export function checksFor(stats, role) {
  const pool = POOL[role] || POOL.jungle, G = (stats && stats.list) || [];
  if (G.length < 8 || G.some((g) => g.e15 === undefined)) return pool.slice(0, 3);
  const rate = (l) => l.filter((g) => g.w).length / l.length;
  const scored = pool.map((c) => { const hit = G.filter(c.ok), miss = G.filter((g) => !c.ok(g)); return { c, score: hit.length >= 3 && miss.length >= 3 ? rate(hit) - rate(miss) : -1 }; }).sort((a, b) => b.score - a.score);
  const out = [], seen = new Set();
  for (const { c, score } of scored) { const fam = FAMILY[c.id] || c.id; if (score > 0.15 && !seen.has(fam)) { out.push(c); seen.add(fam); } if (out.length === 3) break; }
  for (const c of pool) { const fam = FAMILY[c.id] || c.id; if (out.length < 3 && !seen.has(fam)) { out.push(c); seen.add(fam); } }
  return out;
}

export const TABS_FOR_STATS = (stats) => [['all', 'All games'], ['wins', 'Wins'], ['losses', 'Losses'], ...((stats && stats.champs) || []).map((c) => [c, c])];
