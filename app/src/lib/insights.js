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
      title: 'Too many of your deaths buy nothing', big: String(all.free), unit: `of ${all.deaths} deaths were free: no enemy died in the same fight`,
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
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
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
