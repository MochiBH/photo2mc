// POST /api/join { username, password }. See server/join.mjs.
import { createClient } from '@supabase/supabase-js';
import { runJoin } from '../server/join.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return res.status(500).json({ error: 'The server is missing its settings (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const out = await runJoin(admin, body || {});
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Sign-in failed' });
  }
}
