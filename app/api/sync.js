// POST /api/sync with the signed-in user's Supabase token. Pulls a few new games per call; call again until { done: true }.
import { createClient } from '@supabase/supabase-js';
import { RiotError } from '../server/riot.mjs';
import { runSync } from '../server/sync.mjs';
import { isPlayer } from '../server/players.mjs';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || !process.env.RIOT_API_KEY) return res.status(500).json({ error: 'The server is missing its settings (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or RIOT_API_KEY).' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first.' });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: authError } = await admin.auth.getUser(token);
  if (authError || !who || !who.user) return res.status(401).json({ error: 'Your sign-in has expired. Sign in again.' });
  if (!isPlayer(who.user.email)) return res.status(403).json({ error: 'This account is not on the player list.' });
  const userId = who.user.id;

  const { data: profile, error: pErr } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!profile || !profile.riot_name || !profile.riot_tag) return res.status(400).json({ error: 'Add your Riot ID in your profile first.' });

  const must = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
  const db = {
    knownIds: async (id, ids) => (await must(admin.from('player_games').select('match_id').eq('user_id', id).in('match_id', ids))).map((r) => r.match_id),
    putGame: (row) => must(admin.from('player_games').upsert(row)),
    listGames: (id, limit) => must(admin.from('player_games').select('analysis').eq('user_id', id).neq('role', 'other').order('created', { ascending: false }).limit(limit)),
    saveStats: (id, stats) => must(admin.from('player_stats').upsert({ user_id: id, stats, updated_at: new Date().toISOString() })),
    savePuuid: (id, puuid) => must(admin.from('profiles').update({ puuid }).eq('id', id)),
  };
  try {
    return res.status(200).json(await runSync(db, profile));
  } catch (e) {
    if (e instanceof RiotError) return res.status(e.status === 429 ? 429 : 502).json({ error: e.message, retryAfter: e.retryAfter || null });
    return res.status(500).json({ error: e.message || 'Sync failed' });
  }
}
