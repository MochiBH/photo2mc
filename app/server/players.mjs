// The site is private: only these usernames have accounts. Supabase Auth needs an email per account, so each
// username maps to a made-up address on a reserved domain that can never receive mail. Nobody types or sees it.
// Shared by the browser (sign-in) and the server (who may pull stats). Accounts themselves are created by hand,
// in SQL, by whoever runs the project: see the README.
const env = typeof process !== 'undefined' && process.env ? process.env : {};
export const ALLOWED = (env.ALLOWED_USERNAMES || 'mochi,evlijah').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const LOGIN_DOMAIN = 'players.jungle-coach.invalid';

export const cleanUsername = (u) => String(u || '').trim().toLowerCase();
export const validUsername = (u) => /^[a-z0-9_]{3,20}$/.test(u);
export const loginEmail = (u) => `${u}@${LOGIN_DOMAIN}`;
export const usernameOf = (email) => { const [name, domain] = String(email || '').toLowerCase().split('@'); return domain === LOGIN_DOMAIN ? name : null; };
export const isPlayer = (email) => { const u = usernameOf(email); return !!u && ALLOWED.includes(u); };
