// POST /api/teams with the signed-in player's Supabase token and { image, mediaType, role }.
// Reads the champions off a picture of champion select (or the loading screen, or the scoreboard) and returns them by
// team and lane. The picture is passed to Claude and is not stored anywhere.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isPlayer } from '../server/players.mjs';
import { gateway, readTeams } from '../server/teams.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'The server is missing its settings.' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first.' });
  const supa = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: authError } = await supa.auth.getUser(token);
  if (authError || !who || !who.user) return res.status(401).json({ error: 'Your sign-in has expired. Sign in again.' });
  if (!isPlayer(who.user.email)) return res.status(403).json({ error: 'This account is not on the player list.' });

  // On Vercel every request carries a short-lived token for this project, which AI Gateway accepts; a gateway key works too.
  const pass = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  if (!pass) return res.status(500).json({ error: 'Reading pictures is not set up on this server.' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { data: profile } = await supa.from('profiles').select('riot_name').eq('id', who.user.id).maybeSingle();
  try {
    return res.status(200).json(await readTeams(gateway(pass), { image: body.image, mediaType: body.mediaType, role: body.role, riotName: (profile && profile.riot_name) || 'the player' }));
  } catch (e) {
    console.error('teams:', e.status || '', e.name, String(e.message || '').slice(0, 300));
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Too many pictures at once. Try again in a moment.' });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return res.status(502).json({ error: 'The picture reader was refused by Vercel AI Gateway. It may need credit or switching on.' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: e.status === 402 ? 'The picture reader has run out of credit.' : 'The picture could not be read right now. Try again.' });
    return res.status(e.status || 500).json({ error: e.message || 'The picture could not be read.' });
  }
}
