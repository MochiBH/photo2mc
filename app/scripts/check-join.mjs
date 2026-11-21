// Exercises the username sign-in step against a stand-in for Supabase's admin client.
import { runJoin } from '../server/join.mjs';
import { isPlayer, loginEmail } from '../server/players.mjs';
const users = new Map(), profiles = new Map();
const admin = {
  auth: { admin: { createUser: async ({ email, password }) => (users.has(email) ? { data: null, error: { status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' } } : (users.set(email, { id: 'id-' + users.size, password }), { data: { user: { id: users.get(email).id, email } }, error: null })) } },
  from: () => ({ upsert: async (row) => { profiles.set(row.id, row); return { error: null }; } }),
};
const show = async (label, body) => { const r = await runJoin(admin, body); console.log(label.padEnd(34), r.status, JSON.stringify(r.body)); return r; };
await show('stranger', { username: 'someone', password: 'longenough1' });
await show('bad characters', { username: 'mo chi!', password: 'longenough1' });
await show('short password', { username: 'mochi', password: 'short' });
await show('first sign-in (creates)', { username: 'Mochi ', password: 'a-test-password' });
await show('second sign-in (exists)', { username: 'mochi', password: 'anything-else' });
await show('second player (creates)', { username: 'evlijah', password: 'a-test-password' });
console.log('profiles saved:', [...profiles.values()].map((p) => `${p.display_name}: ${p.riot_name}#${p.riot_tag} ${p.role} [${p.mains.join(', ')}]`).join(' | '));
console.log('isPlayer:', isPlayer(loginEmail('mochi')), isPlayer('mochi@gmail.com'), isPlayer(loginEmail('intruder')));
