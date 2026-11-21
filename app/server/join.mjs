// Username sign-in, step one. If the username is on the list and has no account yet, this creates it with the password
// given (so a player's first sign-in sets their password) and fills in their profile. Either way it returns the
// address the browser then signs in with; a wrong password for an existing account fails there, at Supabase.
import { ALLOWED, PRESETS, cleanUsername, loginEmail, validUsername } from './players.mjs';

export async function runJoin(admin, body) {
  const username = cleanUsername(body && body.username), password = String((body && body.password) || '');
  if (!validUsername(username) || !ALLOWED.includes(username)) return { status: 403, body: { error: 'This site is private. Check your username.' } };
  if (password.length < 8) return { status: 400, body: { error: 'Passwords are at least 8 characters.' } };
  const email = loginEmail(username);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
  if (error) {
    const taken = error.code === 'email_exists' || error.status === 422 || /already|exists|registered/i.test(error.message || '');
    if (taken) return { status: 200, body: { email, created: false } };
    return { status: 500, body: { error: 'Could not create the account: ' + (error.message || 'unknown error') } };
  }
  const preset = PRESETS[username];
  if (preset && data && data.user) {
    const { error: pErr } = await admin.from('profiles').upsert({ id: data.user.id, ...preset });
    if (pErr) return { status: 200, body: { email, created: true, warning: 'Account created, but the profile could not be saved: ' + pErr.message } };
  }
  return { status: 200, body: { email, created: true } };
}
