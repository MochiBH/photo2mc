// The site is private: only these usernames can have an account. Supabase Auth needs an email per account, so each
// username maps to a made-up address on a reserved domain that can never receive mail. Nobody types or sees it.
export const ALLOWED = (process.env.ALLOWED_USERNAMES || 'mochi,evlijah').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const LOGIN_DOMAIN = process.env.LOGIN_DOMAIN || 'players.jungle-coach.invalid';

/* Profiles filled in ahead of time, so a first sign-in lands straight in the app with the right Riot account. */
export const PRESETS = {
  mochi: { display_name: 'Mochi', riot_name: 'The Gonzoogler', riot_tag: 'WEEEE', region: 'na', role: 'jungle', mains: ['Nunu & Willump', "Kha'Zix"] },
  evlijah: { display_name: 'Evlijah', riot_name: 'Evlijah', riot_tag: '3958', region: 'na', role: 'support', mains: ['Rell'] },
};

export const cleanUsername = (u) => String(u || '').trim().toLowerCase();
export const validUsername = (u) => /^[a-z0-9_]{3,20}$/.test(u);
export const loginEmail = (u) => `${u}@${LOGIN_DOMAIN}`;
export const usernameOf = (email) => { const [name, domain] = String(email || '').toLowerCase().split('@'); return domain === LOGIN_DOMAIN ? name : null; };
export const isPlayer = (email) => { const u = usernameOf(email); return !!u && ALLOWED.includes(u); };
