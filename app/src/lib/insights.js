// Turns a player's rolled-up stats into their biggest leaks: a headline number, the detail behind it, and one fix.
// Each candidate scores how far the number is from where it should be; the top three are shown.
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const NAMES = { MonkeyKing: 'Wukong', Khazix: "Kha'Zix", Chogath: "Cho'Gath", KSante: "K'Sante", DrMundo: 'Dr. Mundo', TahmKench: 'Tahm Kench' };   // Riot's internal names, where they differ
const champ = (c) => NAMES[c] || c;
const ZONE = { river: 'the river', my_jungle: 'your own jungle', enemy_jungle: 'the enemy jungle', mid_lane: 'mid lane', top_lane: 'top lane', bot_lane: 'bot lane', my_base: 'your base', enemy_base: 'the enemy base' };

export function insights(stats) {
  if (!stats || stats.games < 3) return [];
  const all = stats.groups.all, L = stats.groups.losses, n = all.games, out = [], role = stats.role, top = role === 'top';
  const add = (score, o) => { if (score > 0) out.push({ score, ...o }); };
  const r = (l) => { const w = l.filter((g) => g.w).length; return w + '–' + (l.length - w); };
  const de = all.obj.dragon_enemy, ge = all.obj.voidgrub_enemy, gm = all.obj.voidgrub_mine;
  // the saved numbers come back from the database with their keys in its own order, so the biggest is found, not assumed first
  const most = (o) => (Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0] || [])[0];
  const topZone = most(all.zones), earlyZone = most(all.early_zones);

  if (all.deaths) {
    add((all.took / all.deaths - 0.15) * 10, {
      title: 'You die right before the enemy takes something', big: String(all.took), unit: `of ${all.deaths} deaths were followed by an enemy objective within 90 seconds`,
      detail: de && !top ? `The enemy took ${de[0]} dragons. You were dead for ${de[0] - de[1]} and close enough to contest only ${de[2]}.` : `Most of your deaths are in ${ZONE[topZone] || topZone}.`,
      fix: role === 'support' ? 'From one minute before an objective spawns, stop warding alone. Walk with your jungler or ADC, or stay back.' : top ? 'Check the clock before you fight in lane. In the minute before Voidgrubs, the Herald or a dragon, staying alive is worth more than the trade.' : 'From one minute before a dragon spawns, no river fights unless two teammates are already standing with you.' });
    add((all.free / all.deaths - 0.3) * 8, {
      fam: 'free', title: 'Too many of your deaths buy nothing', big: String(all.free), unit: `of ${all.deaths} deaths were free: no enemy died in the same fight`,
      detail: `That is ${(all.free / n).toFixed(1)} a game. They happen most in ${ZONE[topZone] || topZone}.`,
      fix: top ? 'Before you fight in lane, check two things: your wave is at least as big as theirs, and you know where their jungler is. If either is missing, farm instead.' : 'Before you walk into a fight, count heads. If they have more people there, leave.' });
    add((all.quick / all.deaths - 0.18) * 8, {
      title: 'You walk straight back into the fight that killed you', big: String(all.quick), unit: `of ${all.deaths} deaths came within 90 seconds of respawning`,
      detail: 'Coming back alone, without your team or your items, is how one death turns into two.',
      fix: role === 'support' ? 'After you respawn, walk back with a teammate or wait at the nearest tower for them.' : top ? 'After you respawn, take the wave at your tower first. You come back a level down, so the same fight goes worse the second time.' : 'After you respawn, clear one camp before you rejoin.' });
    if (role === 'support') add((all.alone / all.deaths - 0.1) * 9, {
      title: 'You get caught on your own', big: String(all.alone), unit: `of ${all.deaths} deaths had no teammate anywhere near`,
      detail: 'For a support that is almost always warding alone or walking back to lane through the river.',
      fix: 'Only ward past the river when you can see where their jungler is, or when a teammate walks with you.' });
  }
  if (role === 'jungle') {
    const f10 = L.games && L.farm[10] ? L.farm[10].jcs : null, f15 = L.games && L.farm[15] ? L.farm[15] : null;
    if (f10) add((f10[1] - f10[0] - 5) / 4, {
      title: 'Your farm falls behind in the games you lose', big: `${Math.round(f10[0])} vs ${Math.round(f10[1])}`, unit: 'jungle CS against the enemy jungler at 10:00 in losses',
      detail: `${L.farm[5] ? `At 5:00 it is ${Math.round(L.farm[5].jcs[0])} vs ${Math.round(L.farm[5].jcs[1])}. ` : ''}${f15 ? `By 15:00 you are ${Math.max(0, Math.round(f15.gold[1] - f15.gold[0])).toLocaleString()} gold behind.` : ''} One camp is about 4.`,
      fix: 'Between 5:00 and 15:00, clear every camp that is up before you walk to a lane.' });
    if (ge) { const tot = ge[0] + (gm ? gm[0] : 0); add((ge[0] / tot - 0.45) * 8, {
      title: 'You give away the early top-side objectives', big: String(ge[0]), unit: `of ${tot} Voidgrubs went to the enemy`,
      detail: `You were in your own jungle for ${ge[4]} of them and took part in ${ge[3]}.`,
      fix: 'Be on the top side by 7:30, gank top, then take the grubs with your top laner.' }); }
  }
  const G = stats.list;
  if (top && all.lane && all.lane.games) {
    const ln = all.lane, e15 = all.before15, f10 = L.games && L.farm[10] ? L.farm[10].cs : null, f15 = L.games && L.farm[15] ? L.farm[15] : null;
    if (e15) add((ln.solo_deaths / n - 0.9) * 2.2, {
      fam: 'lane', title: 'You keep taking a 1v1 you are losing', big: String(ln.solo_deaths), unit: `of your ${e15} deaths before 15:00 were to one enemy on their own`,
      detail: `That is ${(ln.solo_deaths / n).toFixed(1)} a game. ${ln.gank_deaths} more had their jungler in them. ${(() => { const a = G.filter((g) => g.sd != null && g.sd <= 1), b = G.filter((g) => g.sd > 1); return a.length >= 3 && b.length >= 3 ? `You are ${r(a)} when it happens once at most, and ${r(b)} when it happens more.` : ''; })()}`,
      fix: 'When your opponent kills you alone, the next fight at the same items goes the same way. Farm what reaches your tower until you have an item or a level on them, or your jungler is there.' });
    if (e15) add((ln.gank_deaths / n - 0.7) * 2.6, {
      title: 'Their jungler keeps getting you in lane', big: String(ln.gank_deaths), unit: `of your ${e15} deaths before 15:00 had the enemy jungler in them`,
      detail: `That is ${(ln.gank_deaths / n).toFixed(1)} a game. A top lane death to a gank also costs the wave under your tower.`,
      fix: 'Ward the river brush as you walk back to lane, and stand on the side of the lane the ward covers. If your wave is past the middle and you cannot see their jungler, back up.' });
    if (f10) add((f10[1] - f10[0] - 6) / 4, {
      title: 'You fall behind in farm in the games you lose', big: `${Math.round(f10[0])} vs ${Math.round(f10[1])}`, unit: 'CS against your lane opponent at 10:00 in losses',
      detail: `${f15 ? `By 15:00 it is ${Math.round(f15.cs[0])} vs ${Math.round(f15.cs[1])}, and you are ${Math.max(0, Math.round(f15.gold[1] - f15.gold[0])).toLocaleString()} gold behind. ` : ''}Fifteen minions is about a kill's worth of gold.`,
      fix: 'When you are losing the lane, let the wave come to your tower and last hit there. Missing a few is cheaper than dying for them.' });
    const few = G.filter((g) => g.cs != null && g.cs / (g.s / 60) < 6), six = G.filter((g) => g.cs != null && g.cs / (g.s / 60) >= 6);
    if (all.cs_min != null) add((5.7 - all.cs_min) * 2.4, {
      title: 'You leave too many minions', big: String(all.cs_min), unit: 'CS a minute. Six or more is the target',
      detail: six.length >= 3 && few.length >= 3 ? `You are ${r(six)} in games with six or more, and ${r(few)} under it.` : 'Every wave you miss is gold your opponent has and you do not.',
      fix: 'Catch the wave in front of you before you walk to a fight, and after your tower falls, farm the side lane that is pushing toward you.' });
    if (ln.games >= 6) add(((ln.tower[1] - ln.tower[0]) / ln.games - 0.1) * 5, {
      title: 'Your tower falls before theirs', big: String(ln.tower[1]), unit: `of ${ln.games} games your top tower fell first. Theirs fell first in ${ln.tower[0]}`,
      detail: `${(() => { const a = G.filter((g) => g.tw === 'mine'), b = G.filter((g) => g.tw === 'enemy'); return a.length >= 3 && b.length >= 3 ? `You are ${r(a)} when theirs goes first and ${r(b)} when yours does. ` : ''; })()}Dying in lane is what gives a tower away: the wave pushes in and nobody is there to stop it.`,
      fix: 'Push the wave into their tower before every recall, so yours is safe while you are gone.' });
    // a champion that plays much worse than the player's steadiest one
    const pool = stats.champs.map((c) => [c, stats.groups[c]]).filter(([, g]) => g && g.games >= 3).map(([c, g]) => ({ c, g, d: g.deaths / g.games }));
    const best = pool.slice().sort((a, b) => a.d - b.d)[0], worst = pool.slice().sort((a, b) => b.d - a.d)[0];
    if (best && worst && best.c !== worst.c) add((worst.d - best.d - 2.2) * 0.9, {
      title: `${champ(worst.c)} is costing you more than ${champ(best.c)}`, big: worst.d.toFixed(1), unit: `deaths a game on ${champ(worst.c)} (${worst.g.record.replace('-', '–')}), against ${best.d.toFixed(1)} on ${champ(best.c)} (${best.g.record.replace('-', '–')})`,
      detail: `${worst.g.games} games is a small sample, but the gap is wide. Every champion has its own trades and its own bad matchups, and they take games to learn.`,
      fix: `In ranked, stay on ${champ(best.c)}. Practise ${champ(worst.c)} in normal games until its lane feels safe.` });
    const ge2 = all.obj.voidgrub_enemy, he = all.obj.herald_enemy, lostTop = (ge2 ? ge2[0] : 0) + (he ? he[0] : 0), farTop = (ge2 ? ge2[1] - ge2[2] : 0) + (he ? he[1] - he[2] : 0);
    if (lostTop >= 6) add((farTop / lostTop - 0.4) * 6, {
      title: 'The enemy takes the top-side objectives while you stay in lane', big: String(farTop), unit: `of the ${lostTop} Voidgrubs and Heralds the enemy took, you were alive but too far away`,
      detail: 'These are on your side of the map. Your team usually needs you there more than your wave does.',
      fix: 'Push your wave before 8:00 and before 15:00, then walk to the pit. Arriving first is most of that fight.' });
  }
  // early deaths: does dying before 15:00 decide this player's games?
  const early = G.filter((g) => g.e15 !== undefined);
  if (early.length >= 8) {
    const cut = role === 'support' ? 1 : 2, ok = early.filter((g) => g.e15 <= cut), bad = early.filter((g) => g.e15 > cut), wr = (l) => l.filter((g) => g.w).length / l.length;
    if (ok.length >= 3 && bad.length >= 3) add((wr(ok) - wr(bad) - 0.25) * 7, {
      title: 'Early deaths decide your games', big: r(bad), unit: `is your record when you die more than ${cut === 1 ? 'once' : 'twice'} before 15:00. With ${cut === 1 ? 'one or none' : 'two or fewer'} you are ${r(ok)}`,
      detail: `${all.early_free} of your ${all.before15} early deaths were free${earlyZone ? `, and most happen in ${ZONE[earlyZone] || earlyZone}` : ''}.`,
      fix: role === 'support' ? 'After your first death in lane, no more all-ins unless your jungler is there. Hold the wave and wait for level 6 or a gank.' : top ? 'After your first death in lane, let the wave come to your tower and farm there. No more fights until you have an item or a level on them, or your jungler is there.' : 'Full clear before your first gank, and skip any gank where the enemy is standing under their own tower.' });
  }
  // an engage champion whose deaths mostly buy nothing is going in without follow-up
  if (role === 'support') for (const c of stats.champs) {
    const g = stats.groups[c];
    if (g && g.games >= 3 && g.deaths >= 10) add((g.free / g.deaths - 0.5) * 9 + (g.deaths / g.games - 4) * 0.4, {
      fam: 'free', title: `On ${c}, you go in and nobody follows`, big: String(g.free), unit: `of your ${g.deaths} deaths on ${c} were free: no enemy died in the same fight`,
      detail: `That is ${(g.deaths / g.games).toFixed(1)} deaths a game on ${c}, against ${(all.deaths / n).toFixed(1)} overall.`,
      fix: 'Before you start a fight, look at your ADC. If they are not close enough and healthy enough to follow, wait.' });
  }
  if (de && de[0] >= 6 && !top) add(((de[1] - de[2]) / de[0] - 0.3) * 7, {   // a top laner is not expected at every dragon
    title: 'You are alive but not at the dragon', big: String(de[1] - de[2]), unit: `of the ${de[0]} dragons the enemy took, you were alive but too far away to contest`,
    detail: `You were close for ${de[2]} and dead for ${de[0] - de[1]}. You are ${(() => { const a = G.filter((g) => g.od > g.ed), b = G.filter((g) => g.od <= g.ed); return `${r(a)} when your team finishes ahead on dragons and ${r(b)} when it doesn't`; })()}.`,
    fix: role === 'support' ? 'One minute before each dragon, leave lane with your ADC and put your wards around the pit.' : 'One minute before each dragon, finish the camp you are on and walk to the pit.' });
  const cwGame = all.vision.control / n, wantCw = role === 'support' ? 3 : top ? 1 : 2;
  add((wantCw - cwGame) * (role === 'support' ? 1.6 : top ? 2.2 : 0.9), {
    title: all.vision.control ? 'You barely buy control wards' : 'You never buy a control ward', big: String(all.vision.control), unit: `control ward${all.vision.control === 1 ? '' : 's'} bought in ${n} games`,
    detail: top ? `One in the river brush shows their jungler coming for as long as it lives.${all.lane && all.lane.gank_deaths ? ` ${all.lane.gank_deaths} of your early deaths had him in them.` : ''}` : `That is ${cwGame.toFixed(1)} a game. ${role === 'support' ? 'Three or more is normal for a support.' : 'Two a game is a good target for a jungler.'}`,
    fix: top ? 'Buy one on your first recall and put it in the river brush on the side their jungler comes from. Replace it when it dies.' : 'Buy one on every recall once you have your first item, and place it beside the next objective.' });
  if (role === 'support') {
    if (all.vision.rival_score) add(((all.vision.rival_score - all.vision.score) / all.vision.rival_score) * 10, {
      title: 'The enemy support out-wards you', big: `${Math.round(all.vision.score)} vs ${Math.round(all.vision.rival_score)}`, unit: 'average vision score, you against the enemy support',
      detail: `You place ${all.vision.placed} wards and clear ${all.vision.killed} a game.`,
      fix: 'Keep your trinket and support-item wards on cooldown, and swap to Oracle Lens once your support item is upgraded.' });
    add((48 - all.kp) / 6, {
      title: 'You miss too many of your team\'s fights', big: all.kp + '%', unit: 'of your team\'s kills had you involved',
      detail: 'Half or more is the target for a support.',
      fix: 'When your wave is pushed in, look at mid and the river before you go back to lane.' });
  }
  const seen = new Set();   // one leak per idea: the champion-specific version beats the general one when it scores as high
  return out.sort((a, b) => b.score - a.score || (b.title.startsWith('On ') ? 1 : -1)).filter((o) => { if (!o.fam) return true; if (seen.has(o.fam)) return false; seen.add(o.fam); return true; }).slice(0, 3);
}

/* Records the tracker quotes back during a game. */
export function facts(stats) {
  if (!stats || !stats.list.length) return null;
  const r = (list) => { const w = list.filter((g) => g.w).length; return w + '–' + (list.length - w); };
  const G = stats.list, all = stats.groups.all;
  return {
    freeOk: r(G.filter((g) => g.free <= 3)), freeBad: r(G.filter((g) => g.free > 3)), fewDeaths: r(G.filter((g) => g.d <= 5)), manyDeaths: r(G.filter((g) => g.d > 5)),
    drakeAhead: r(G.filter((g) => g.od > g.ed)), drakeBehind: r(G.filter((g) => g.od < g.ed)), quickShare: all.deaths ? pct(all.quick, all.deaths) : 0, control: all.vision.control, games: G.length,
  };
}

/* The other side of the ledger: habits the numbers say this player already has. */
export function strengths(stats) {
  if (!stats || stats.games < 5) return [];
  const all = stats.groups.all, n = all.games, out = [], role = stats.role;
  const cw = all.vision.control / n, wins = (g) => Number(g.record.split('-')[0]);
  // a champion that wins far more often than the player's games as a whole
  const star = stats.champs.map((c) => [c, stats.groups[c]]).filter(([, g]) => g && g.games >= 5 && wins(g) / g.games >= 0.65 && wins(g) / g.games - wins(all) / n >= 0.2).sort((a, b) => wins(b[1]) / b[1].games - wins(a[1]) / a[1].games)[0];
  if (star) out.push(`${champ(star[0])} is your best pick so far: ${star[1].record.replace('-', '–')}, against ${all.record.replace('-', '–')} across all these games. ${star[1].games} games is a small sample, but it is worth picking first.`);
  if (role === 'support' && all.vision.per_min >= 1.8) out.push(`Vision. You average ${all.vision.per_min} vision score a minute and buy ${cw.toFixed(1)} control wards a game${all.vision.rival_score ? `, against ${Math.round(all.vision.rival_score)} total for the enemy support to your ${Math.round(all.vision.score)}` : ''}. Keep it, and aim it at the next objective.`);
  if (role === 'jungle' && cw >= 2) out.push(`Control wards. You buy ${cw.toFixed(1)} a game, which most junglers at your rank don't.`);
  if (all.deaths && all.alone / all.deaths <= 0.08) out.push(`You rarely get caught alone: only ${all.alone} of ${all.deaths} deaths had no teammate near. Your deaths come from fights, so the fix is choosing which fights, not hiding.`);
  if (role === 'jungle' && all.farm[10] && all.farm[10].jcs[0] >= all.farm[10].jcs[1] - 3) out.push(`Your early clear keeps pace: ${Math.round(all.farm[10].jcs[0])} jungle CS at 10:00 against ${Math.round(all.farm[10].jcs[1])} for the enemy jungler.`);
  if (role === 'top' && all.lane && all.lane.games) {
    const ln = all.lane, gm = all.obj.voidgrub_mine;
    if (ln.solo_kills / n >= 0.8) out.push(`You win fights on your own: ${ln.solo_kills} solo kills before 15:00 in ${n} games. The lane is yours to win when you pick the moment.`);
    if (gm && gm[0] >= 6 && gm[2] / gm[0] >= 0.6) out.push(`You show up for Voidgrubs: you were at the pit for ${gm[2]} of the ${gm[0]} your team took.`);
    if (ln.tower[0] > ln.tower[1]) out.push(`You take towers: theirs fell first in ${ln.tower[0]} of ${ln.games} games, yours in ${ln.tower[1]}.`);
    if (all.cs_min >= 6.5) out.push(`Your farm is steady: ${all.cs_min} CS a minute.`);
    const lead = stats.champs.map((c) => [c, stats.groups[c]]).filter(([, g]) => g.games >= 4 && g.lane && g.lane.games).sort((a, b) => (b[1].lane.tower[0] - b[1].lane.tower[1]) / b[1].games - (a[1].lane.tower[0] - a[1].lane.tower[1]) / a[1].games)[0];
    if (lead && lead[1].lane.tower[0] >= lead[1].lane.tower[1] + 3) out.push(`${champ(lead[0])} wins you the lane: their tower fell first in ${lead[1].lane.tower[0]} of ${lead[1].games} games on it, and you average ${(lead[1].lane.solo_kills / lead[1].games).toFixed(1)} solo kills.`);
  }
  const best = stats.champs.map((c) => [c, stats.groups[c]]).filter(([, g]) => g.games >= 3).sort((a, b) => a[1].deaths / a[1].games - b[1].deaths / b[1].games)[0];
  if (best && best[1].deaths / best[1].games <= (all.deaths / n) * 0.7) out.push(`${best[0]} is your safest pick: ${(best[1].deaths / best[1].games).toFixed(1)} deaths a game (${best[1].record}), against ${(all.deaths / n).toFixed(1)} across all your games.`);
  return out.slice(0, 3);
}
