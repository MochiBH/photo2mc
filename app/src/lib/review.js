// One game, read for the person who played it. Everything here works on the saved analysis of a single game
// (server/analysis.mjs), so a game can be reviewed long after it has dropped out of the "last 20" the other screens use.
import { ZONE, clock } from './legacy';
import { champName } from './champs';

export const ROLE_NAME = { jungle: 'Jungle', support: 'Support', top: 'Top', mid: 'Mid', adc: 'ADC' };
export const ROLE_PLAYER = { jungle: 'jungler', support: 'support', top: 'top laner', mid: 'mid laner', adc: 'ADC' };
export const OBJ_NAME = { dragon: 'Dragon', voidgrub: 'Voidgrub', herald: 'Rift Herald', baron: 'Baron', atakhan: 'Atakhan' };
export const zoneName = (z) => ZONE[z] || (z === 'dead' ? 'Dead' : z);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const gold = (v) => Math.abs(Math.round(v)).toLocaleString();
const IN_A_SENTENCE = { dragon: 'a dragon', voidgrub: 'Voidgrubs', herald: 'the Rift Herald', baron: 'Baron', atakhan: 'Atakhan' };
const names = (list) => { const u = [...new Set(list)].map((t) => IN_A_SENTENCE[t] || t); return u.length > 1 ? u.slice(0, -1).join(', ') + ' and ' + u.at(-1) : u[0]; };

/** What stood out in one game: up to three things to fix, worst first, and up to three that went well.
    Each item is { title, text }; a fix also carries `next`, the one thing to do about it next game. */
export function takeaways(g) {
  const fix = [], well = [];
  const D = g.deaths || [], n = D.length, free = D.filter((d) => d.free).length, quick = D.filter((d) => d.quick).length, alone = D.filter((d) => d.allies === 0).length;
  const paid = D.filter((d) => d.took && d.took.length), early = D.filter((d) => d.minute < 15).length;
  const lost = (g.objectives || []).filter((o) => o.taker === 'enemy'), away = lost.filter((o) => o.alive && !o.near);
  const rival = g.rival ? champName(g.rival) : 'your opponent', sup = g.role === 'support', jg = g.role === 'jungle';
  const add = (w, title, text, next) => fix.push({ w, title, text, next });
  // what to do after respawning, and after an early death, depends on the job
  const rejoin = sup ? 'After you respawn, walk back with a teammate, not alone.' : jg ? 'After you respawn, clear one camp before you rejoin.' : 'After you respawn, catch the wave in front of you before you rejoin.';
  const earlyFix = sup ? 'After your first death in lane, no more all-ins unless your jungler is there.' : jg ? 'Full clear before your first gank, and skip any gank where the enemy is under their own tower.' : 'After your first death in lane, farm near your tower and fight only when your jungler is there.';

  if (free >= 3) add(4 + free / 2, `${free} of your ${plural(n, 'death', 'deaths')} bought nothing`, 'No enemy died in those fights. You went in, or got caught, and they lost nobody for it.', sup ? 'Before you start a fight, look at your ADC. If they are not close and healthy enough to follow, wait.' : 'Before you walk into a fight, count heads. If they have more people there, leave.');
  else if (n >= 6) add(3 + n / 4, `${n} deaths`, 'That is past the point where a lead survives. Each one after the fourth gives the enemy more than it could win you.', 'After your fourth death, only fight at an objective, and only with teammates.');
  if (paid.length >= 2) add(3 + paid.length / 2, `${paid.length} deaths handed the enemy an objective`, `Within 90 seconds of you dying they took ${names(paid.flatMap((d) => d.took))}.`, 'In the minute before an objective, stay with your team and do not walk anywhere dark alone.');
  if (quick >= 2) add(3 + quick / 2, `${quick} deaths right after respawning`, 'You walked straight back into the fight that had just killed you.', rejoin);
  if (alone >= 3 && free < 3) add(2.5 + alone / 3, `Caught alone ${alone} times`, 'No teammate was anywhere near when you died.', 'Check the map before you cross the river. If you cannot see their jungler, stay on your side.');
  if (early >= 3 && n < 6) add(2.5, `${early} deaths before 15:00`, 'Early deaths cost the most: they put you behind for every fight that follows.', earlyFix);
  if (away.length >= 2) add(2.5 + away.length / 3, `${away.length} objectives lost while you were alive but far away`, `The enemy took ${names(away.map((o) => o.type))} and you were not close enough to contest.`, 'A minute before each objective, finish what you are doing and walk to the pit.');
  if (jg && g.diff && g.diff.length > 10 && g.diff[10] <= -8) add(3 + -g.diff[10] / 8, `${-g.diff[10]} jungle CS behind ${rival} at 10:00`, `That is about ${Math.round(-g.diff[10] / 4)} camps of gold and experience they had and you did not.`, 'Clear every camp on your side before you cross the map.');
  if (g.gold_diff && g.gold_diff.length > 15 && g.gold_diff[15] <= -1200 && !(jg && g.diff[10] <= -8)) add(2 + -g.gold_diff[15] / 1500, `${gold(g.gold_diff[15])} gold behind ${rival} at 15:00`, 'That is most of an item. Fights against them after that start from behind.', 'From behind, stop taking even fights. Farm what is safe and fight only with numbers.');
  if (g.vision && g.vision.control_bought === 0) add(sup ? 3 : 2, 'No control wards bought', 'It is the cheapest thing in the shop that changes an objective fight.', 'Buy one on every recall after your first item, and place it by the next objective.');
  if (sup && g.vision && g.vision.per_min < 1.2) add(2.2, `${g.vision.per_min} vision score a minute`, g.vision.rival_score != null ? `Their support finished on ${g.vision.rival_score} vision score to your ${g.vision.score}.` : 'A support wants 1.5 or more.', 'Keep your wards on cooldown and sweep before every objective.');
  if ((jg || sup) && g.kp < 40 && g.minutes >= 15) add(2, `In only ${g.kp}% of your team's kills`, 'Most fights happened without you.', 'Before each clear or recall, ask where the next fight will be and end up on that side.');

  if (n <= 3) well.push({ title: n === 0 ? 'No deaths' : `Only ${plural(n, 'death', 'deaths')}`, text: 'Staying alive is the single thing that tracks your wins most closely.' });
  else if (free <= 1 && n <= 5) well.push({ title: free === 0 ? 'No free deaths' : 'Only one free death', text: 'When you died, the enemy paid for it.' });
  if (g.first_dragon === 'mine') well.push({ title: 'Your team took the first dragon', text: 'Being set up before 5:00 is most of that fight.' });
  if (jg && g.grubs_mine > 0) well.push({ title: `${plural(g.grubs_mine, 'Voidgrub', 'Voidgrubs')} taken`, text: 'Top side at 8:00 with a pushing lane is close to a free objective.' });
  if (jg && g.diff && g.diff.length > 10 && g.diff[10] >= 8) well.push({ title: `${g.diff[10]} jungle CS ahead of ${rival} at 10:00`, text: 'You out-cleared them through the early game.' });
  else if (g.gold_diff && g.gold_diff.length > 15 && g.gold_diff[15] >= 1000) well.push({ title: `${gold(g.gold_diff[15])} gold ahead of ${rival} at 15:00`, text: 'You won your side of the early game.' });
  if (g.vision && g.vision.rival_score != null && sup && g.vision.score > g.vision.rival_score) well.push({ title: `Out-warded their support, ${g.vision.score} to ${g.vision.rival_score}`, text: 'Your team saw more of the map than theirs did.' });
  if ((jg || sup) && g.kp >= 65) well.push({ title: `In ${g.kp}% of your team's kills`, text: 'You were where the fights were.' });
  if (g.dragons && g.dragons[0] >= 3 && g.dragons[0] > g.dragons[1]) well.push({ title: `Dragons ${g.dragons[0]}–${g.dragons[1]}`, text: 'Your team controlled the bot-side objective all game.' });

  return { fix: fix.sort((a, b) => b.w - a.w).slice(0, 3), well: well.slice(0, 3) };
}

/** One death in words: when, where, who was around, and what it cost. */
export function deathLine(d) {
  const around = d.allies === 0 ? 'no teammate near' : plural(d.allies, 'teammate', 'teammates') + ' near';
  const tags = [];
  if (d.free) tags.push({ t: 'Free death', bad: true }); else tags.push({ t: 'An enemy died too', bad: false });
  if (d.quick) tags.push({ t: 'Right after respawning', bad: true });
  if (d.took && d.took.length) tags.push({ t: 'Then they took ' + names(d.took), bad: true });
  return { when: clock(d.minute), where: zoneName(d.zone), by: d.by ? 'Killed by ' + champName(d.by) : null, around: `${around}, ${plural(d.enemies, 'enemy', 'enemies')}`, tags };
}

/** One objective in words: who took it and where the player was. */
export function objectiveLine(o) {
  const mine = o.taker === 'mine';
  // an enemy kill the player "took part" in is one they were hitting too: they contested it and lost it
  const where = !o.alive ? 'you were dead' : o.took_part ? (mine ? 'you were part of it' : 'you were there, fighting for it') : o.near ? 'you were there' : `you were alive, in ${zoneName(o.my_zone).toLowerCase()}`;
  return { when: clock(o.minute), name: OBJ_NAME[o.type] || o.type, mine, where, miss: !mine && o.alive && !o.near };
}

/* The list row for a game, from the few fields the list asks the database for. */
export const duration = (seconds) => Math.round((seconds || 0) / 60) + ' min';
