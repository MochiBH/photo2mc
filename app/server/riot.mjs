// Riot API access. The key comes from RIOT_API_KEY; it is never sent to the browser.
export const REGIONS = {
  na: { label: 'North America', route: 'americas' }, br: { label: 'Brazil', route: 'americas' }, lan: { label: 'Latin America North', route: 'americas' }, las: { label: 'Latin America South', route: 'americas' },
  euw: { label: 'Europe West', route: 'europe' }, eune: { label: 'Europe Nordic & East', route: 'europe' }, tr: { label: 'Turkey', route: 'europe' }, ru: { label: 'Russia', route: 'europe' },
  kr: { label: 'Korea', route: 'asia' }, jp: { label: 'Japan', route: 'asia' }, oce: { label: 'Oceania', route: 'sea' }, sea: { label: 'Southeast Asia', route: 'sea' },
};

export class RiotError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

export function riotClient(region, key = process.env.RIOT_API_KEY) {
  const r = REGIONS[region];
  if (!r) throw new RiotError(400, 'Unknown region: ' + region);
  const base = `https://${r.route}.api.riotgames.com`;
  async function get(path) {
    const headers = { 'User-Agent': 'jungle-coach/1.0', Accept: 'application/json' };
    if (key) headers['X-Riot-Token'] = key;
    const res = await fetch(base + path, { headers });
    if (res.status === 429) throw new RiotError(429, 'Riot rate limit reached', Number(res.headers.get('retry-after')) || 10);
    if (res.status === 401 || res.status === 403) throw new RiotError(res.status, 'Riot rejected the API key. It may have expired or be missing from the server settings.');
    if (res.status === 404) throw new RiotError(404, 'Riot could not find that. Check the Riot ID and region.');
    if (!res.ok) throw new RiotError(res.status, 'Riot API error ' + res.status);
    return res.json();
  }
  const q = encodeURIComponent;
  return {
    account: (name, tag) => get(`/riot/account/v1/accounts/by-riot-id/${q(name)}/${q(tag)}`),
    matchIds: (puuid, count = 20, queue = 420) => get(`/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&count=${count}`),
    match: (id) => get(`/lol/match/v5/matches/${id}`),
    timeline: (id) => get(`/lol/match/v5/matches/${id}/timeline`),
  };
}
