// End-to-end check against the real Supabase project and Riot, without Vercel: signs in as a player, runs the same
// sync the /api/sync function runs (as that player, under row-level security), and reads the stats back.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... RIOT_API_KEY=... PLAYER_PASSWORD=... node scripts/check-live.mjs <username>
import { createClient } from '@supabase/supabase-js';
import { dbFor, profileOf } from '../api/sync.js';
import { runSync } from '../server/sync.mjs';
import { loginEmail } from '../server/players.mjs';

const username = process.argv[2], { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, PLAYER_PASSWORD: password } = process.env;
const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supa.auth.signInWithPassword({ email: loginEmail(username), password });
if (error) { console.log('SIGN-IN FAILED:', error.status, error.message); process.exit(1); }
console.log('signed in as', username, '| user', data.user.id.slice(0, 8), '| token', data.session.access_token.length, 'chars');
const wrong = await supa.auth.signInWithPassword({ email: loginEmail(username), password: password + 'x' });
console.log('wrong password ->', wrong.error ? wrong.error.message : 'ACCEPTED (bad!)');

const asUser = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + data.session.access_token } }, auth: { persistSession: false, autoRefreshToken: false } });
const profile = await profileOf(asUser, data.user.id);
console.log('profile:', profile.display_name, `${profile.riot_name}#${profile.riot_tag}`, profile.role, profile.mains.join(', '));
const db = dbFor(asUser); let step = 0; const t0 = Date.now();
for (;;) { const r = await runSync(db, { ...profile, puuid: step ? (await profileOf(asUser, data.user.id)).puuid : profile.puuid }); step++; if (r.done) break; if (step > 20) throw new Error('sync did not finish'); }
console.log('sync finished in', step, 'steps,', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const { data: row, error: sErr } = await asUser.from('player_stats').select('stats,updated_at').eq('user_id', data.user.id).maybeSingle();
if (sErr || !row) { console.log('READ BACK FAILED:', sErr && sErr.message); process.exit(1); }
for (const role of ['jungle', 'support']) console.log(' ', role, row.stats[role].games, 'games', row.stats[role].groups.all.record, row.stats[role].champs.join(','));
const { count } = await asUser.from('player_games').select('*', { count: 'exact', head: true });
const others = await asUser.from('profiles').select('id');
console.log('rows this player can see: games', count, '| profiles', others.data.length, '(should be 1)');
const fresh = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = await fresh.from('profiles').select('id'), anonStats = await fresh.from('player_stats').select('user_id');
console.log('signed-out client sees: profiles', (anon.data || []).length, '| stats', (anonStats.data || []).length, '(both should be 0)');
