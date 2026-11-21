// The live-game engine: what to build and how to play this game, for any jungle or support champion.
// Nunu and Kha'Zix in the jungle keep their hand-tuned rules (lib/legacy.js); everyone else starts from the
// champion's most-bought build on OP.GG and swaps in counter items for what the enemy team actually has.
import { BOOTS, STUCK, allyFeatures, andList, buildKha, buildNotes, buildNunu, champOf, gamePlan, gankOrder, nunuRole, setBst, teamFeatures } from './legacy';
import { buildFor, dmgOf, gold, tagsOf } from './champs';

const short = (n) => n.replace(' & Willump', '');
const LEGACY = { 'Nunu & Willump': 'Nunu', "Kha'Zix": "Kha'Zix" };
export const ALLY_ROWS = { jungle: ['Top', 'Mid', 'Bot', 'Support'], support: ['Top', 'Jungle', 'Mid', 'Bot'] };
export const ENEMY_ROWS = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

export function styleOf(role, champ) {
  const t = tagsOf(champ), dmg = dmgOf(champ), has = (k) => t.includes(k);
  if (role === 'support') {
    if (has('u') && (has('s') || has('h')) && !has('t')) return 'enchanter';
    if (has('t') || (has('c') && has('u'))) return 'tanksup';
    return dmg === 'ad' ? 'adsup' : 'magesup';
  }
  if (has('t')) return 'tank';
  if (has('b')) return dmg === 'ap' ? 'apburst' : 'assassin';
  return dmg === 'ap' ? 'ap' : 'ad';
}
const FAMILY = { tank: 'tank', tanksup: 'tank', enchanter: 'ench', magesup: 'ap', ap: 'ap', apburst: 'ap', assassin: 'ad', ad: 'ad', adsup: 'ad' };

/* Counter items by item family: [score, item, reason]. A score of 0 means the enemy team gives no reason to buy it. */
function counters(family, F, A) {
  const N = F.names, heal = andList(N.h), aps = F.apbN.length ? andList(F.apbN) : 'their mages';
  const all = {
    ap: [
      [F.adb >= 2 || (F.adb >= 1 && F.ps >= 0.6) ? 3 + F.adb * 0.4 : 0, "Zhonya's Hourglass", `${F.adbN.length ? andList(F.adbN) + ' will jump on you. ' : ''}Go gold to survive the first burst, and it gives armor.`],
      [F.ms >= 0.4 && F.app + F.apb >= 2 ? 2.6 + F.apb * 0.3 : 0, "Banshee's Veil", `A spell shield against ${andList((N.p.length ? N.p : F.apbN).slice(0, 3))}, plus magic resist.`],
      [F.h >= 2 ? 3.2 : 0, 'Morellonomicon', `${heal} heal a lot. This cuts their healing when your damage lands.`],
      [F.t >= 2 ? 2.4 + F.t * 0.2 : 0, 'Void Staff', `${andList(N.t)} will stack magic resist. This goes through it.`],
    ],
    ad: [
      [F.p >= 1 || F.c >= 3 ? 2.9 + F.p * 0.4 : 0, 'Edge of Night', `Its spell shield eats the one spell that stops you. Watch ${andList((N.p.length ? N.p : N.c).slice(0, 3))}.`],
      [F.s >= 2 ? 3 + F.s * 0.3 : 0, "Serpent's Fang", `Cuts the shields from ${andList(N.s)}.`],
      [F.h >= 2 ? 3.1 + F.h * 0.2 : 0, 'Chempunk Chainsword', `${heal} heal through your damage. This cuts their healing.`],
      [F.t >= 2 ? 2.6 + F.t * 0.3 : 0, "Serylda's Grudge", `Armor penetration for ${andList(N.t)}.`],
      [F.apb >= 2 && F.ms >= 0.5 ? 2.8 : 0, 'Maw of Malmortius', `${aps} can delete you with magic damage. The shield buys you the second you need.`],
      [F.ps >= 0.75 && F.adb >= 1 ? 2.3 : 0, "Death's Dance", 'Almost all their damage is physical. This spreads it out so you live through the burst.'],
    ],
    tank: [
      [F.h >= 1.5 && F.a >= 1 ? 3.1 + F.h * 0.3 : 0, 'Thornmail', `${heal} heal a lot. Anyone who basic-attacks you gets their healing cut.`],
      [F.k >= 2 ? 3 + F.k * 0.3 : 0, "Randuin's Omen", `${andList(N.k)} build crit. This takes a chunk out of every crit.`],
      [F.a >= 3 ? 2.8 : 0, 'Frozen Heart', `Slows the attack speed of ${andList(N.a.slice(0, 4))} when they stand near you.`],
      [F.ms >= 0.7 ? 2.9 : 0, 'Force of Nature', 'Nearly all their damage is magic. Big magic resist plus move speed.'],
      [F.apb >= 2 && F.ms >= 0.5 ? 2.7 + F.apb * 0.2 : 0, 'Kaenic Rookern', `A magic shield against the burst from ${aps}.`],
      [A.fed.length && A.carries.some((c) => A.fed.includes(c)) ? 2.5 : 0, "Knight's Vow", `Link it to ${andList(A.fed)}. You take part of the damage aimed at them.`],
    ],
    ench: [
      [F.p >= 1 || F.c >= 3 ? 3 + F.p * 0.3 : 0, "Mikael's Blessing", `Cleanses the stun or root off your carry. ${andList((N.p.length ? N.p : N.c).slice(0, 3))} only need to land one.`],
      [F.adb + F.apb >= 3 ? 2.9 : 0, 'Locket of the Iron Solari', `A team shield for the moment ${andList(F.adbN.concat(F.apbN).slice(0, 3))} go in.`],
      [F.h >= 2 ? 3.1 : 0, 'Morellonomicon', `${heal} heal a lot, and on most teams the support is the one who has to buy the healing cut.`],
      [A.carries.length >= 2 ? 2.4 : 0, 'Ardent Censer', `${andList(A.carries.slice(0, 3))} all fight with basic attacks. Your heals and shields speed them up.`],
      [A.fed.length ? 2.2 : 0, 'Redemption', `A big heal you can drop on ${andList(A.fed)} from range, even after you die.`],
    ],
  };
  return all[family].filter((c) => c[0] > 0 && gold(c[1]) > 0).sort((a, b) => b[0] - a[0]);
}

function genericBuild(role, champ, F, A, state) {
  const b = buildFor(role, champ), name = short(champ), family = FAMILY[styleOf(role, champ)];
  if (!b) return null;
  const core = b.core.filter((i) => !BOOTS.includes(i));
  let boots = { item: b.boots[0] || 'Boots of Swiftness', why: `The most-bought boots on ${name}.` };
  if (F.c >= 3 && F.ms >= 0.4 && gold("Mercury's Treads")) boots = { item: "Mercury's Treads", why: `Lots of stuns and roots from ${andList(F.names.c)}. These shorten them.` };
  else if (F.a >= 3 && F.ps >= 0.6 && family !== 'ench' && gold('Plated Steelcaps')) boots = { item: 'Plated Steelcaps', why: `${andList(F.names.a)} all hurt you with basic attacks. These cut that damage.` };
  const out = core.map((item, i) => ({ item, why: i === 0 ? `First item on ${name} in most games on OP.GG.` : `Part of ${name}'s standard core.` }));
  out.splice(1, 0, boots);
  for (const item of [...b.fourth, ...b.fifth, ...b.sixth]) {
    if (out.length >= 6) break;
    if (!out.some((o) => o.item === item) && !BOOTS.includes(item)) out.push({ item, why: `A common later item on ${name}.`, late: true });
  }
  // swap counter items into the late slots, strongest reason last so it lands earliest
  const picks = counters(family, F, A).filter((c) => !out.some((o) => o.item === c[1])).slice(0, state === 'behind' ? 3 : 2);
  const lateStart = Math.min(out.length, 1 + core.length);
  picks.reverse().forEach((c) => { if (out.length >= 6) out.pop(); out.splice(lateStart, 0, { item: c[1], why: c[2] }); });
  return out.slice(0, 6);
}

function withBought(rec, bought) {
  const out = bought.filter((n) => gold(n) > 0 || rec.some((r) => r.item === n)).slice(0, 6).map((n) => ({ item: n, why: (rec.find((r) => r.item === n) || { why: 'Already bought.' }).why, got: true }));
  const hasBoots = out.some((o) => BOOTS.includes(o.item));
  rec.forEach((r) => { if (out.length >= 6 || out.some((o) => o.item === r.item)) return; if (hasBoots && BOOTS.includes(r.item)) return; out.push(r); });
  return out;
}

function targetsOf(F) {
  const has = (r, k) => r.fl.includes(k), carry = (r) => (has(r, 'a') || has(r, 'k') ? 1 : 0);
  return F.rec.filter((r) => !has(r, 't')).sort((a, b) => b.fed - a.fed || (has(b, 'u') ? 0 : 1) - (has(a, 'u') ? 0 : 1) || carry(b) - carry(a)).slice(0, 2).map((r) => r.name);
}
const real = (F, k) => [...new Set(F.rec.filter((r) => r.fl.includes(k)).map((r) => r.name))];

function genericPlan(role, champ, bst, F, A) {
  const P = [], style = styleOf(role, champ), tgts = targetsOf(F), tgt = tgts.length ? andList(tgts) : 'whoever is alone';
  const tanks = real(F, 't'), stuns = real(F, 'c').slice(0, 3), threats = F.adbN.concat(F.apbN).slice(0, 2);
  const at = (rows, i) => { const n = champOf(rows[i] ? rows[i].c : ''); return n ? short(n) : null; };
  const adc = role === 'support' ? at(bst.allies, 3) : null, carry = adc || A.carries[0] || 'your carry';
  let job;
  if (style === 'enchanter') job = `Stand next to ${carry}. Your shields and heals go on them, and you never start the fight.${threats.length ? ` ${andList(threats)} will come for them, so save your strongest spell for that moment.` : ''}`;
  else if (style === 'tanksup') job = `You start the fights. Look for ${tgt}. If you can't reach them safely, stand in front of ${carry} and stop whoever comes in.`;
  else if (style === 'magesup' || style === 'adsup') job = `Stay behind your front line and hit whoever walks up. Don't be the first person they see${threats.length ? `, and keep an escape for ${andList(threats)}` : ''}.`;
  else if (style === 'tank') job = `You go first. Start on ${tgt} when you can reach them, then stay in the middle so your team can follow.${A.carries.length && threats.length ? ` Once the fight is going, drift back toward ${andList(A.carries.slice(0, 2))}: ${andList(threats)} will go for them.` : ''}`;
  else if (style === 'assassin' || style === 'apburst') job = `Stay out of sight until the fight has started${stuns.length ? ` and ${andList(stuns)} ${stuns.length > 1 ? 'have used their stuns' : 'has used their stun'}` : ''}. Then go for ${tgt}.${A.n && !A.front.length ? ' Your team has nobody to start a fight, so catch people alone before objectives instead of forcing 5v5s.' : ''}`;
  else job = `Go in second, after ${A.front.length ? andList(A.front) : 'someone else'} starts it. Hit whoever is closest and safe, then work toward ${tgt}.`;
  P.push(['Your job in fights', job]);

  if (role === 'support') {
    const foes = [3, 4].map((i) => champOf(bst.rows[i] ? bst.rows[i].c : '')).filter(Boolean);
    const hooks = foes.filter((n) => tagsOf(n).includes('p')).map(short), engage = foes.filter((n) => tagsOf(n).includes('c')).map(short), stuck = foes.filter((n) => STUCK.includes(n)).map(short);
    let lane = 'Add both bot lanes above and this reads the matchup for you.';
    if (foes.length) {
      if (hooks.length) lane = `Stand behind your minions. ${andList(hooks)} only ${hooks.length > 1 ? 'need' : 'needs'} to land one catch on you or ${carry} to win the lane.`;
      else if (style === 'enchanter' && engage.length) lane = `${andList(engage)} can start a fight on you and you lose it early. Keep the wave near your tower and trade only after their big spell misses.`;
      else if ((style === 'tanksup' || style === 'adsup') && stuck.length === foes.length) lane = `${andList(stuck)} have no dash. Look for a fight at level 2, and again every time your main spell is back up.`;
      else if (style === 'magesup') lane = `You win by poking. Hit them when they walk up for a minion, and stay behind your own wave so you can't be engaged on.`;
      else lane = 'An even lane. Trade when their support walks off to ward, and back away when your own key spell is down.';
    }
    P.push(['Your lane', lane]);
    const mid = at(bst.allies, 2), foeMid = champOf(bst.rows[2] ? bst.rows[2].c : '');
    const midSetup = mid && /[cp]/.test(tagsOf(champOf(mid) || ''));
    P.push(['Roaming', foeMid && STUCK.includes(foeMid)
      ? `Mid is the roam: ${short(foeMid)} has no dash${midSetup ? ` and ${mid} has a stun to follow up` : ''}. Go only when your wave is pushed into their tower and ${carry} can stay safe.`
      : `Roam with your jungler to river fights and objectives. Leaving ${carry} alone for a mid roam is rarely worth it this game.`]);
  } else {
    const g = ganks(champ, bst);
    P.push(['Gank first', g.length ? '' : 'Type each champion in its lane row on both teams and this ranks the lanes for you.']);
  }
  if (A.fed.length) P.push(['Who to play around', `${andList(A.fed)} ${A.fed.length > 1 ? 'are your strongest players' : 'is your strongest player'}. ${role === 'support' ? 'Stay near them in every fight; your job is to keep them alive.' : 'Put your next ganks and the next objective on their side of the map.'}`]);
  else if (role === 'support' && adc) P.push(['Who to play around', `${adc} until the lane phase ends. After that, follow whoever on your team is doing the most damage.`]);
  if (F.n) P.push(['Kill first', `${tgt}.${tanks.length ? ` Don't waste the fight hitting ${andList(tanks)}.` : ''}`]);
  F.rec.filter((r) => r.fed).slice(0, 2).forEach((r) => {
    const has = (k) => r.fl.includes(k);
    P.push([`${r.name} is fed`, has('t') ? `${r.name} is fed but tanky. Walk around them and kill the people behind them.`
      : has('b') ? `${r.name} is fed and kills in one combo. ${role === 'support' ? `Stay glued to ${carry} and keep vision on the flanks.` : "Don't walk through unwarded jungle alone, and stay with a teammate after 15 minutes."}`
      : has('a') || has('k') ? `${r.name} is fed and does damage the whole fight. They have to die first, or the fight is lost.`
      : `${r.name} is fed. Spread out so one spell doesn't hit all of you, and get on them fast.`]);
  });
  if (bst.state === 'behind') P.push(["You're behind", role === 'support' ? 'Ward your own jungle, not theirs. Stay with the team, and save your spells to stop their engage.' : 'No solo fights. Clear your camps, show up to objectives with the team, and buy the defensive item next.']);
  if (bst.state === 'ahead') P.push(["You're ahead", role === 'support' ? 'Push your vision into their jungle with a teammate, and be at the next objective a minute early.' : "Spend the lead. Take the enemy jungler's camps with a control ward down, and be at the next objective a minute early."]);
  return P;
}

/* Lanes ranked for a jungler, in plain rows. */
export function ganks(champ, bst) {
  const t = tagsOf(champ), own = t.includes('c') || t.includes('p');
  setBst({ ...bst, me: own ? 'Nunu' : "Kha'Zix" });
  const fix = (s) => (LEGACY[champ] ? s : s.replace(/your (snowball|jump)/g, 'your gank'));
  return gankOrder().map((x) => ({ ...x, good: x.good.map(fix), bad: x.bad.map(fix) }));
}

function notesFor(role, champ, F, items, facts) {
  const N = F.names, out = [], family = FAMILY[styleOf(role, champ)], has = (n) => items.some((i) => i.item === n);
  if (F.h >= 1.5) {
    const piece = family === 'ad' ? "Executioner's Calling" : family === 'tank' ? 'Bramble Vest' : 'Oblivion Orb';
    out.push(`Healing from ${andList(N.h)}: buy ${piece} (${gold(piece)} gold) early if they are healing through fights${has('Thornmail') || has('Morellonomicon') || has('Chempunk Chainsword') ? ', then finish the full item when it comes up' : ''}.`);
  }
  if (F.v >= 1) out.push(`${andList(N.v)} can go invisible. Swap your trinket to Oracle Lens and keep a control ward on you.`);
  out.push(`One control ward (${gold('Control Ward')} gold) on every recall.${facts ? ` You have bought ${facts.control} in your last ${facts.games} games.` : ''}`);
  const by = (list) => F.runes.filter((r) => list.includes(r[1])).map((r) => r[0]);
  const burst = by(['Electrocute', 'Dark Harvest', 'Hail of Blades', 'First Strike']), long = by(['Conqueror', 'Lethal Tempo', 'Press the Attack']), poke = by(['Arcane Comet', 'Summon Aery']);
  if (burst.length) out.push(`Runes: ${andList(burst)} took a burst rune. They want a short fight, so don't show up at half health.`);
  if (long.length) out.push(`Runes: ${andList(long)} took a rune that gets stronger the longer the fight lasts. Burst them or leave; don't stand and trade.`);
  if (poke.length) out.push(`Runes: ${andList(poke)} took a poke rune. Don't stand around before an objective fight; start it or back off.`);
  return out;
}

/* ---------- Rell (support): hand-tuned on top of the general rules ---------- */
const UNDO = ['Janna', 'Lulu', 'Milio', 'Poppy', 'Alistar', 'Morgana', 'Braum', 'Gragas'];   // supports and tanks that can cancel or shrug off an engage
function rellBuild(bst, F, A, rec) {
  const adc = champOf(bst.allies[3] ? bst.allies[3].c : ''), carry = adc ? short(adc) : A.carries[0] || 'your carry';
  const burst = F.adbN.concat(F.apbN).slice(0, 3);
  const why = {
    "Zeke's Convergence": `Pays off the moment you ult next to ${carry}: their hits land harder on whoever you pulled in.`,
    'Locket of the Iron Solari': `A shield for the whole team right as you pile in.${burst.length ? ` It matters most against ${andList(burst)}.` : ''}`,
    "Knight's Vow": `Link it to ${A.fed.length ? andList(A.fed) : carry}. You soak part of the damage aimed at them.`,
  };
  let out = rec.map((r) => (why[r.item] ? { ...r, why: why[r.item] } : r));
  const move = (item, to) => { const i = out.findIndex((o) => o.item === item); if (i > to) { const [x] = out.splice(i, 1); out.splice(to, 0, x); } };
  if (F.adb + F.apb >= 2) move('Locket of the Iron Solari', 0);          // burst teams: the shield comes first
  if (A.fed.length && A.carries.some((c) => A.fed.includes(c))) move("Knight's Vow", 2);
  const b = out.findIndex((o) => BOOTS.includes(o.item));
  if (b >= 0 && F.n && F.ms >= 0.55 && F.c < 3 && gold("Mercury's Treads")) out[b] = { item: "Mercury's Treads", why: 'More of their damage is magic, and these shorten the stuns that stop your engage.' };
  return out;
}
function rellPlan(bst, F, A, plan) {
  const adc = champOf(bst.allies[3] ? bst.allies[3].c : ''), carry = adc ? short(adc) : 'your ADC';
  const tgts = targetsOf(F), tgt = tgts.length ? andList(tgts) : 'whoever steps up';
  const foes = [3, 4].map((i) => champOf(bst.rows[i] ? bst.rows[i].c : '')).filter(Boolean);
  const undo = F.rec.filter((r) => UNDO.includes(r.name)).map((r) => r.name), shields = real(F, 's').slice(0, 3);
  const stuck = foes.filter((n) => STUCK.includes(n)).map(short), hooks = foes.filter((n) => tagsOf(n).includes('p')).map(short);
  const job = `You start the fight. Crash down on ${tgt} with W, stun with Q, then ult to hold them in the middle of your team. Only go when ${carry} is close enough to follow: an engage with nobody behind you is a free death.${undo.length ? ` ${andList(undo)} can undo an engage, so wait for their key spell or go on someone standing away from them.` : ''}`;
  let lane = 'Add both bot lanes above and this reads the matchup for you.';
  if (foes.length) {
    if (stuck.length === foes.length) lane = `${andList(stuck)} have no dash, which is the lane Rell wants. Look for the all-in at level 2 and again every time W is back up.`;
    else if (hooks.length) lane = `Stand behind your minions until you engage: ${andList(hooks)} ${hooks.length > 1 ? 'want' : 'wants'} to catch you first. You have no way to trade from range, so either go all the way in or stay back.`;
    else lane = `You can't trade from range, so don't walk up to take free hits. Hold the wave near your side, and go all the way in when one of them steps past their minions.`;
  }
  const out = plan.map(([h, t]) => (h === 'Your job in fights' ? [h, job] : h === 'Your lane' ? [h, lane] : [h, t]));
  const tips = [];
  if (shields.length) tips.push(`Your Q breaks shields. Hit ${andList(shields)} with it before your team's damage lands.`);
  tips.push('After the engage you are on foot and slow. Mount back up with W to get to your carry or to get out.');
  out.splice(Math.min(2, out.length), 0, ['Rell this game', tips.join(' ')]);
  return out;
}

export function computeLive(bst, role, facts) {
  const champ = champOf(bst.me) || null, legacyMe = role === 'jungle' && champ ? LEGACY[champ] : null;
  setBst({ ...bst, me: legacyMe || 'Other' });
  const F = teamFeatures(), A = allyFeatures();
  const base = { F, A, champ, pp: Math.round(F.ps * 100), roleWhy: null, nunu: legacyMe === 'Nunu', ganks: role === 'jungle' && champ ? ganks(champ, bst) : [] };
  if (!champ) return { ...base, items: [], plan: [], notes: [], title: 'Pick your champion', starter: [] };
  const b = buildFor(role, champ), starter = b ? [...new Set(role === 'support' ? ['World Atlas', ...b.starter] : b.starter)] : [];
  if (legacyMe) {
    setBst({ ...bst, me: legacyMe });
    const r = nunuRole(A), tank = legacyMe === 'Nunu' && r.tank;
    const rec = legacyMe === "Kha'Zix" ? buildKha(F, A) : buildNunu(F, A, tank);
    const items = withBought(rec, bst.bought);
    const plan = gamePlan(F, A, tank).map(([h, t]) => [h, h === 'Gank first' ? '' : t]);
    const notes = buildNotes(F, A, tank, items).filter((n) => !n.startsWith('One control ward')).concat(notesFor(role, champ, F, items, facts).filter((n) => n.startsWith('One control ward')));
    return { ...base, items, plan, notes, starter, roleWhy: legacyMe === 'Nunu' ? r.why : null, title: (legacyMe === 'Nunu' ? (tank ? 'Tank Nunu' : 'AP Nunu') : "Kha'Zix") + (F.n ? ' against ' + F.list.join(', ') : ' · standard build') };
  }
  const rell = role === 'support' && champ === 'Rell';
  let rec = genericBuild(role, champ, F, A, bst.state) || [], plan = genericPlan(role, champ, bst, F, A);
  if (rell) { rec = rellBuild(bst, F, A, rec); plan = rellPlan(bst, F, A, plan); }
  const items = withBought(rec, bst.bought);
  return { ...base, items, starter, plan, notes: notesFor(role, champ, F, items, facts), missing: !b,
    title: short(champ) + (F.n ? ' against ' + F.list.join(', ') : ' · standard build') };
}
