// POST /api/sync with the signed-in user's Supabase token. Pulls a few new games per call; call again until { done: true }.
// Everything is read and written as that user, under row-level security: the server holds no database secret,
// only the Riot key.
import { createClient } from '@supabase/supabase-js';
import { RiotError } from '../server/riot.mjs';
import { runSync } from '../server/sync.mjs';
import { isPlayer } from '../server/players.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !process.env.RIOT_API_KEY) return res.status(500).json({ error: 'The server is missing its settings (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or RIOT_API_KEY).' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first.' });
  const supa = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: authError } = await supa.auth.getUser(token);
  if (authError || !who || !who.user) return res.status(401).json({ error: 'Your sign-in has expired. Sign in again.' });
  if (!isPlayer(who.user.email)) return res.status(403).json({ error: 'This account is not on the player list.' });
  try {
    return res.status(200).json(await runSync(dbFor(supa), await profileOf(supa, who.user.id)));
  } catch (e) {
    if (e instanceof RiotError) return res.status(e.status === 429 ? 429 : 502).json({ error: e.message, retryAfter: e.retryAfter || null });
    return res.status(e.status || 500).json({ error: e.message || 'Sync failed' });
  }
}

const must = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
export async function profileOf(supa, userId) {
  const profile = await must(supa.from('profiles').select('*').eq('id', userId).maybeSingle());
  if (!profile || !profile.riot_name || !profile.riot_tag) throw Object.assign(new Error('Add your Riot ID in your profile first.'), { status: 400 });
  return profile;
}
/* The storage the sync loop needs, backed by a Supabase client acting as the signed-in player. */
export function dbFor(supa) {
  return {
    knownIds: async (id, ids) => (await must(supa.from('player_games').select('match_id').eq('user_id', id).in('match_id', ids))).map((r) => r.match_id),
    putGame: (row) => must(supa.from('player_games').upsert(row)),
    listGames: (id, limit) => must(supa.from('player_games').select('analysis').eq('user_id', id).neq('role', 'other').order('created', { ascending: false }).limit(limit)),
    saveStats: (id, stats) => must(supa.from('player_stats').upsert({ user_id: id, stats, updated_at: new Date().toISOString() })),
    savePuuid: (id, puuid) => must(supa.from('profiles').update({ puuid }).eq('id', id)),
  };
}
