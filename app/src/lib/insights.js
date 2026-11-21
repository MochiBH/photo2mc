// Turns a player's rolled-up stats into their biggest leaks: a headline number, the detail behind it, and one fix.
// Each candidate scores how far the number is from where it should be; the top three are shown.
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ZONE = { river: 'the river', my_jungle: 'your own jungle', enemy_jungle: 'the enemy jungle', mid_lane: 'mid lane', top_lane: 'top lane', bot_lane: 'bot lane', my_base: 'your base', enemy_base: 'the enemy base' };

export function insights(stats) {
  if (!stats || stats.games < 3) return [];
  const all = stats.groups.all, L = stats.groups.losses, n = all.games, out = [], role = stats.role;
  const add = (score, o) => { if (score > 0) out.push({ score, ...o }); };
  const de = all.obj.dragon_enemy, ge = all.obj.voidgrub_enemy, gm = all.obj.voidgrub_mine;
  const topZone = Object.keys(all.zones)[0];

  if (all.deaths) {
    add((all.took / all.deaths - 0.15) * 10, {
      title: 'You die right before the enemy takes something', big: String(all.took), unit: `of ${all.deaths} deaths were followed by an enemy objective within 90 seconds`,
      detail: de ? `The enemy took ${de[0]} dragons. You were dead for ${de[0] - de[1]} and close enough to contest only ${de[2]}.` : `Most of your deaths are in ${ZONE[topZone] || topZone}.`,
      fix: role === 'support' ? 'From one minute before an objective spawns, stop warding alone. Walk with your jungler or ADC, or stay back.' : 'From one minute before a dragon spawns, no river fights unless two teammates are already standing with you.' });
    add((all.free / all.deaths - 0.3) * 8, {
      fam: 'free', title: 'Too many of your deaths buy nothing', big: String(all.free), unit: `of ${all.deaths} deaths were free: no enemy died in the same fight`,
      detail: `That is ${(all.free / n).toFixed(1)} a game. They happen most in ${ZONE[topZone] || topZone}.`,
      fix: 'Before you walk into a fight, count heads. If they have more people there, leave.' });
    add((all.quick / all.deaths - 0.18) * 8, {
      title: 'You walk straight back into the fight that killed you', big: String(all.quick), unit: `of ${all.deaths} deaths came within 90 seconds of respawning`,
      detail: 'Coming back alone, without your team or your items, is how one death turns into two.',
      fix: role === 'support' ? 'After you respawn, walk back with a teammate or wait at the nearest tower for them.' : 'After you respawn, clear one camp before you rejoin.' });
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
  // early deaths: does dying before 15:00 decide this player's games?
  const G = stats.list, early = G.filter((g) => g.e15 !== undefined);
  if (early.length >= 8) {
    const cut = role === 'support' ? 1 : 2, ok = early.filter((g) => g.e15 <= cut), bad = early.filter((g) => g.e15 > cut), wr = (l) => l.filter((g) => g.w).length / l.length;
    const r = (l) => { const w = l.filter((g) => g.w).length; return w + '–' + (l.length - w); };
    if (ok.length >= 3 && bad.length >= 3) add((wr(ok) - wr(bad) - 0.25) * 7, {
      title: 'Early deaths decide your games', big: r(bad), unit: `is your record when you die more than ${cut === 1 ? 'once' : 'twice'} before 15:00. With ${cut === 1 ? 'one or none' : 'two or fewer'} you are ${r(ok)}`,
      detail: `${all.early_free} of your ${all.before15} early deaths were free${Object.keys(all.early_zones)[0] ? `, and most happen in ${ZONE[Object.keys(all.early_zones)[0]]}` : ''}.`,
      fix: role === 'support' ? 'After your first death in lane, no more all-ins unless your jungler is there. Hold the wave and wait for level 6 or a gank.' : 'Full clear before your first gank, and skip any gank where the enemy is standing under their own tower.' });
  }
  // an engage champion whose deaths mostly buy nothing is going in without follow-up
  if (role === 'support') for (const c of stats.champs) {
    const g = stats.groups[c];
    if (g && g.games >= 3 && g.deaths >= 10) add((g.free / g.deaths - 0.5) * 9 + (g.deaths / g.games - 4) * 0.4, {
      fam: 'free', title: `On ${c}, you go in and nobody follows`, big: String(g.free), unit: `of your ${g.deaths} deaths on ${c} were free: no enemy died in the same fight`,
      detail: `That is ${(g.deaths / g.games).toFixed(1)} deaths a game on ${c}, against ${(all.deaths / n).toFixed(1)} overall.`,
      fix: 'Before you start a fight, look at your ADC. If they are not close enough and healthy enough to follow, wait.' });
  }
  if (de && de[0] >= 6) add(((de[1] - de[2]) / de[0] - 0.3) * 7, {
    title: 'You are alive but not at the dragon', big: String(de[1] - de[2]), unit: `of the ${de[0]} dragons the enemy took, you were alive but too far away to contest`,
    detail: `You were close for ${de[2]} and dead for ${de[0] - de[1]}. You are ${(() => { const a = G.filter((g) => g.od > g.ed), b = G.filter((g) => g.od <= g.ed); const r = (l) => { const w = l.filter((g) => g.w).length; return w + '–' + (l.length - w); }; return `${r(a)} when your team finishes ahead on dragons and ${r(b)} when it doesn't`; })()}.`,
    fix: role === 'support' ? 'One minute before each dragon, leave lane with your ADC and put your wards around the pit.' : 'One minute before each dragon, finish the camp you are on and walk to the pit.' });
  const cwGame = all.vision.control / n, wantCw = role === 'support' ? 3 : 2;
  add((wantCw - cwGame) * (role === 'support' ? 1.6 : 0.9), {
    title: 'You barely buy control wards', big: String(all.vision.control), unit: `control wards bought in ${n} games`,
    detail: `That is ${cwGame.toFixed(1)} a game. ${role === 'support' ? 'Three or more is normal for a support.' : 'Two a game is a good target for a jungler.'}`,
    fix: 'Buy one on every recall once you have your first item, and place it beside the next objective.' });
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
  const cw = all.vision.control / n;
  if (role === 'support' && all.vision.per_min >= 1.8) out.push(`Vision. You average ${all.vision.per_min} vision score a minute and buy ${cw.toFixed(1)} control wards a game${all.vision.rival_score ? `, against ${Math.round(all.vision.rival_score)} total for the enemy support to your ${Math.round(all.vision.score)}` : ''}. Keep it, and aim it at the next objective.`);
  if (role === 'jungle' && cw >= 2) out.push(`Control wards. You buy ${cw.toFixed(1)} a game, which most junglers at your rank don't.`);
  if (all.deaths && all.alone / all.deaths <= 0.08) out.push(`You rarely get caught alone: only ${all.alone} of ${all.deaths} deaths had no teammate near. Your deaths come from fights, so the fix is choosing which fights, not hiding.`);
  if (role === 'jungle' && all.farm[10] && all.farm[10].jcs[0] >= all.farm[10].jcs[1] - 3) out.push(`Your early clear keeps pace: ${Math.round(all.farm[10].jcs[0])} jungle CS at 10:00 against ${Math.round(all.farm[10].jcs[1])} for the enemy jungler.`);
  const best = stats.champs.map((c) => [c, stats.groups[c]]).filter(([, g]) => g.games >= 3).sort((a, b) => a[1].deaths / a[1].games - b[1].deaths / b[1].games)[0];
  if (best && best[1].deaths / best[1].games <= (all.deaths / n) * 0.7) out.push(`${best[0]} is your safest pick: ${(best[1].deaths / best[1].games).toFixed(1)} deaths a game (${best[1].record}), against ${(all.deaths / n).toFixed(1)} across all your games.`);
  return out.slice(0, 3);
}
