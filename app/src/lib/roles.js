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

export const CHECKS = {
  jungle: [
    { name: 'Take at least one Voidgrub', how: 'Top side by 7:30, gank top, then take them with your top laner.', ok: (g) => g.grubs > 0, chip: (g) => plural(g.grubs, 'Voidgrub', 'Voidgrubs') },
    { name: 'Take the first dragon', how: 'Clear toward bot side and be at the pit, with a teammate, a minute before it spawns at 5:00.', ok: (g) => g.fd === 'mine', chip: (g) => 'First dragon ' + (g.fd === 'mine' ? 'yours' : 'theirs') },
    { name: 'Three free deaths or fewer', how: 'Before you walk into a fight, count heads. If they have more people there, leave. After you respawn, clear one camp before you go back in.', ok: (g) => g.free <= 3, chip: (g) => plural(g.free, 'free death', 'free deaths') },
  ],
  support: [
    { name: 'Your team takes the first dragon', how: 'Recall around 4:00, come back with a control ward, and ward the pit with your jungler before 5:00.', ok: (g) => g.fd === 'mine', chip: (g) => 'First dragon ' + (g.fd === 'mine' ? 'yours' : 'theirs') },
    { name: 'Three free deaths or fewer', how: 'A free death is one where no enemy died with you. Most of them happen warding alone or standing in front of your carry.', ok: (g) => g.free <= 3, chip: (g) => plural(g.free, 'free death', 'free deaths') },
    { name: 'In half of your team\'s kills', how: 'Follow your jungler to fights near you, and roam mid when your wave is pushed in and your ADC is safe.', ok: (g) => g.kp >= 50, chip: (g) => g.kp + '% of kills' },
  ],
};

export const TABS_FOR_STATS = (stats) => [['all', 'All games'], ['wins', 'Wins'], ['losses', 'Losses'], ...((stats && stats.champs) || []).map((c) => [c, c])];
