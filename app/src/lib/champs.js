import builds from '../../public/data/champ-builds.json';
import { BD, champOf } from './legacy';

export const BUILDS = builds;
export const REGION_LIST = [['na', 'North America'], ['euw', 'Europe West'], ['eune', 'Europe Nordic & East'], ['kr', 'Korea'], ['br', 'Brazil'], ['lan', 'Latin America North'], ['las', 'Latin America South'], ['oce', 'Oceania'], ['tr', 'Turkey'], ['ru', 'Russia'], ['jp', 'Japan'], ['sea', 'Southeast Asia']];

/* Champions with a current build on record for a role, most played first. */
export function champsFor(role) {
  const r = builds.roles[role] || {};
  return Object.keys(r).sort((a, b) => (r[b].games || 0) - (r[a].games || 0));
}
export const buildFor = (role, champ) => (builds.roles[role] || {})[champ] || null;
export const gold = (item) => builds.gold[item] ?? BD.gold[item] ?? 0;
/* Riot's internal names ("MonkeyKing", "Khazix") to the names people use. */
export const champName = (raw) => { const c = champOf(raw); return c ? c.replace(' & Willump', '') : raw; };
export const tagsOf = (champ) => (BD.champs[champ] || ['ad', ''])[1];
export const dmgOf = (champ) => (BD.champs[champ] || ['ad', ''])[0];
