// Calls the deployed /api/sync as a signed-in player. Usage: SITE=https://... SUPABASE_URL=... SUPABASE_ANON_KEY=... PLAYER_PASSWORD=... node scripts/check-site.mjs <username>
import { createClient } from '@supabase/supabase-js';
import { loginEmail } from '../server/players.mjs';
const username = process.argv[2], { SITE, SUPABASE_URL, SUPABASE_ANON_KEY, PLAYER_PASSWORD } = process.env;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supa.auth.signInWithPassword({ email: loginEmail(username), password: PLAYER_PASSWORD });
if (error) { console.log('sign-in failed:', error.message); process.exit(1); }
for (let i = 0; i < 40; i++) {
  const t0 = Date.now(), res = await fetch(SITE + '/api/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token } }), body = await res.json().catch(() => ({}));
  console.log(username, 'step', i + 1, res.status, Date.now() - t0, 'ms', JSON.stringify({ done: body.done, remaining: body.remaining, error: body.error }));
  if (res.status === 429) { await new Promise((r) => setTimeout(r, ((body.retryAfter || 10) + 1) * 1000)); continue; }   // Riot's rate limit: wait as the site does
  if (!res.ok || body.done) {
    if (body.stats) for (const [kind, set] of [['ranked', body.stats], ['normal', body.stats.normal], ['both', body.stats.both]]) for (const r of ['jungle', 'support']) if (set && set[r].games) console.log('  ', kind.padEnd(6), r.padEnd(7), set[r].games, 'games', set[r].groups.all.record);
    break;
  }
}
