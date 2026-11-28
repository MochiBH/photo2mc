// What each role is measured on. Every rule and checkpoint is a test on one game row from the player's stats.
import { ROLES } from '../../server/roles.mjs';

export { ROLES };
/* How each coached role is named around the site. */
export const ROLE = {
  jungle: { short: 'JG', name: 'Jungle', title: 'Jungle Coach', player: 'jungler' },
  support: { short: 'SUP', name: 'Support', title: 'Support Coach', player: 'support' },
  top: { short: 'TOP', name: 'Top', title: 'Top Coach', player: 'top laner' },
};
export const isRole = (r) => ROLES.includes(r);
export const cspm = (g) => g.j / (g.s / 60);
/** All CS a minute, lane minions and camps together: what a laner is measured on. Rows saved before it was recorded have none. */
export const allCspm = (g) => (g.cs == null ? null : g.cs / (g.s / 60));
const gold = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString();
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
  top: [
    { name: 'Die five times or fewer', how: 'After your second death in lane, stop taking the same fight. Farm what reaches your tower until your next item or your jungler arrives.', ok: (g) => g.d <= 5, chip: (g) => plural(g.d, 'death', 'deaths') },
    { name: '6.0 CS a minute', how: 'Last hits are your income. Give up a trade before you give up a wave, and catch the side wave before you walk to a fight.', ok: (g) => allCspm(g) >= 6, chip: (g) => (allCspm(g) ?? 0).toFixed(1) + ' CS/min' },
    { name: 'Buy a control ward', how: 'On your first recall. Put it in the river brush on the side their jungler comes from, and replace it when it dies.', ok: (g) => g.cw >= 1, chip: (g) => plural(g.cw, 'control ward', 'control wards') },
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
  top: [
    { id: 'early', name: 'Two deaths or fewer before 15:00', how: 'A death in lane costs a wave and a level. After the first one, let the wave come to your tower and farm there.', ok: (g) => g.e15 <= 2, chip: (g) => plural(g.e15, 'early death', 'early deaths') },
    { id: 'cs10', name: 'Level in CS at 10:00', how: 'Within five minions of your opponent. Last hit under your tower when you are losing the lane, and never leave a wave to chase a kill.', ok: (g) => g.csd10 != null && g.csd10 >= -5, chip: (g) => 'CS at 10:00 ' + (g.csd10 == null ? '?' : (g.csd10 > 0 ? '+' : '') + g.csd10) },
    { id: 'tower', name: 'Their tower falls before yours', how: 'Push the wave in before every recall, and hit the tower whenever your opponent is dead or has gone back to base.', ok: (g) => g.tw === 'mine', chip: (g) => (g.tw === 'mine' ? 'Their tower first' : g.tw === 'enemy' ? 'Your tower first' : 'No tower fell') },
    { id: 'free', name: 'Three free deaths or fewer', how: 'A free death is one where no enemy died with you. Before you fight, check your wave is bigger and you know where their jungler is.', ok: (g) => g.free <= 3, chip: (g) => plural(g.free, 'free death', 'free deaths') },
    { id: 'solo', name: 'Lose the 1v1 once at most before 15:00', how: 'If your opponent kills you alone, the matchup or the moment was wrong. Do not take that fight again at the same strength: wait for an item, a level or your jungler.', ok: (g) => g.sd != null && g.sd <= 1, chip: (g) => plural(g.sd ?? 0, 'solo death', 'solo deaths') },
    { id: 'gold15', name: 'Within 500 gold at 15:00', how: 'You do not have to win the lane, only stay close. Farm safely when behind, and turn every kill into the wave, a plate or a recall for items.', ok: (g) => g.gd15 != null && g.gd15 >= -500, chip: (g) => 'Gold at 15:00 ' + (g.gd15 == null ? '?' : gold(g.gd15)) },
    { id: 'gank', name: 'Die to their jungler once at most before 15:00', how: 'When your wave is past the middle and you cannot see their jungler, play as if he is in the brush beside you.', ok: (g) => g.gk != null && g.gk <= 1, chip: (g) => plural(g.gk ?? 0, 'gank death', 'gank deaths') },
    { id: 'kp', name: "In 40% of your team's kills", how: 'After your tower or theirs falls, push the next wave and walk to your team. Use Teleport for fights at objectives, not only to get back to lane.', ok: (g) => g.kp >= 40, chip: (g) => g.kp + '% of kills' },
  ],
};
// don't show two versions of the same idea
const FAMILY = { free: 'free', free2: 'free', early: 'deaths', deaths: 'deaths', solo: 'deaths', gank: 'deaths', cs10: 'lane', gold15: 'lane' };

export function checksFor(stats, role) {
  const pool = POOL[role] || POOL.jungle, G = (stats && stats.list) || [];
  if (G.length < 8 || G.some((g) => g.e15 === undefined) || (role === 'top' && G.some((g) => g.cs === undefined))) return pool.slice(0, 3);
  const rate = (l) => l.filter((g) => g.w).length / l.length;
  const scored = pool.map((c) => { const hit = G.filter(c.ok), miss = G.filter((g) => !c.ok(g)); return { c, score: hit.length >= 3 && miss.length >= 3 ? rate(hit) - rate(miss) : -1 }; }).sort((a, b) => b.score - a.score);
  const out = [], seen = new Set();
  for (const { c, score } of scored) { const fam = FAMILY[c.id] || c.id; if (score > 0.15 && !seen.has(fam)) { out.push(c); seen.add(fam); } if (out.length === 3) break; }
  for (const c of pool) { const fam = FAMILY[c.id] || c.id; if (out.length < 3 && !seen.has(fam)) { out.push(c); seen.add(fam); } }
  return out;
}

export const TABS_FOR_STATS = (stats) => [['all', 'All games'], ['wins', 'Wins'], ['losses', 'Losses'], ...((stats && stats.champs) || []).map((c) => [c, c])];
