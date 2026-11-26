// Posts a picture to the deployed /api/teams as a signed-in player and prints what was read off it.
// Usage: SITE=https://... SUPABASE_URL=... SUPABASE_ANON_KEY=... PLAYER_PASSWORD=... node scripts/check-teams.mjs <username> <picture.jpg|png> [jungle|support]
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loginEmail } from '../server/players.mjs';
const [username, pic, role = 'jungle'] = process.argv.slice(2), { SITE, SUPABASE_URL, SUPABASE_ANON_KEY, PLAYER_PASSWORD } = process.env;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supa.auth.signInWithPassword({ email: loginEmail(username), password: PLAYER_PASSWORD });
if (error) { console.log('sign-in failed:', error.message); process.exit(1); }
const image = readFileSync(pic).toString('base64'), mediaType = /\.png$/i.test(pic) ? 'image/png' : /\.webp$/i.test(pic) ? 'image/webp' : 'image/jpeg';
const t0 = Date.now(), res = await fetch(SITE + '/api/teams', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ image, mediaType, role }) });
const body = await res.json().catch(() => ({}));
console.log(username, res.status, Date.now() - t0, 'ms,', Math.round(image.length / 1024), 'kB sent');
if (!res.ok) { console.log('  error:', body.error); process.exit(1); }
console.log('  read by:', body.model, '| screen:', body.screen, body.fallback ? '(answered by the fallback model)' : '', body.note ? '| note: ' + body.note : '');
for (const [side, list] of [['allies', body.allies], ['enemies', body.enemies]]) console.log('  ' + side.padEnd(8), list.map((p) => `${p.champion} (${p.lane}${p.is_player ? ', you' : ''})`).join(', ') || 'none');
