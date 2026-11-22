import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ALLOWED, loginEmail, validUsername } from '../server/players.mjs';
import { QUEUE_TABS, hasQueues, isQueue, statsFor } from './lib/queues';

const URL_ = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const DEMO = import.meta.env.VITE_DEMO === '1';   // local checks only: no accounts, stats from /demo-stats.json
export const supa = !DEMO && URL_ && KEY ? createClient(URL_, KEY) : null;

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);
const STALE_MS = 30 * 60 * 1000;
const local = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) {} },
};
/* The signed-in player's profile and stats as last seen in this browser. Opening the site shows these at once and checks
   the account in the background, instead of sitting on a spinner while three requests come back. Removed on sign-out. */
const ME = 'jc.me';
const remembered = () => { const m = !DEMO && supa ? local.get(ME) : null; return m && m.id && m.profile && m.profile.riot_name ? m : null; };

export function SessionProvider({ children }) {
  const [seen] = useState(remembered);
  const [phase, setPhase] = useState(seen ? 'ready' : 'loading');           // loading | config | signedOut | needsProfile | ready
  const [user, setUser] = useState(seen ? { id: seen.id, email: seen.email } : null);
  const [profile, setProfile] = useState(seen ? seen.profile : null);
  const [statsAll, setStatsAll] = useState(seen ? seen.stats || null : null);
  const [statsAt, setStatsAt] = useState(seen ? seen.statsAt || null : null);
  const [cloud, setCloud] = useState(() => (seen ? local.get('jc.cloud.' + seen.id) || {} : {}));
  const [sync, setSync] = useState({ busy: false, done: 0, total: 0, error: '' });
  const token = useRef(null), dirty = useRef(false), cloudRef = useRef({}), syncing = useRef(false);
  const shown = useRef(null), loaded = useRef(false), touched = useRef(new Set()), wanted = useRef(seen ? seen.id : null), fetching = useRef(null);
  cloudRef.current = cloud;
  shown.current = { id: user ? user.id : null, ready: phase === 'ready', statsAt };

  const load = useCallback(async (u) => {
    const showing = shown.current.ready && shown.current.id === u.id;   // already on screen from what this browser remembers
    wanted.current = u.id; fetching.current = u.id;
    setUser(u);
    const cached = local.get('jc.cloud.' + u.id) || {};
    if (DEMO) {
      const p = local.get('jc.demo.profile') || { id: u.id, display_name: 'The Gonzoogler', riot_name: 'The Gonzoogler', riot_tag: 'WEEEE', region: 'na', role: 'jungle', mains: ['Nunu & Willump', "Kha'Zix"] };
      setCloud(cached); setProfile(p);
      try { setStatsAll(await (await fetch('/demo-stats.json')).json()); setStatsAt(new Date().toISOString()); } catch (e) {}
      setPhase(p.riot_name ? 'ready' : 'needsProfile');
      return;
    }
    const [p, s, a] = await Promise.all([
      supa.from('profiles').select('*').eq('id', u.id).maybeSingle(),
      supa.from('player_stats').select('stats,updated_at').eq('user_id', u.id).maybeSingle(),
      supa.from('app_state').select('data').eq('user_id', u.id).maybeSingle(),
    ]);
    if (fetching.current === u.id) fetching.current = null;
    if (wanted.current !== u.id) return;   // signed out, or someone else signed in, while this was in flight
    if (showing && (p.error || s.error || a.error)) return;   // the refresh failed: keep showing what this browser remembers
    loaded.current = true;
    // The account's saved state wins over this browser's copy, except for anything changed since the page opened.
    setCloud((c) => { const out = { ...cached, ...((a.data && a.data.data) || {}) }; if (showing) for (const k of touched.current) if (k in c) out[k] = c[k]; return out; });
    // If a sync finished while this was in flight, the numbers on screen are newer than the row just read: keep them.
    const mine = showing ? shown.current.statsAt : null;
    if (!(mine && s.data && new Date(s.data.updated_at) < new Date(mine))) { setStatsAll(s.data ? s.data.stats : null); setStatsAt(s.data ? s.data.updated_at : null); }
    setProfile(p.data || null);
    setPhase(p.data && p.data.riot_name ? 'ready' : 'needsProfile');
  }, []);

  useEffect(() => {
    if (DEMO) { load({ id: 'demo', email: 'demo@local' }); return; }
    if (!supa) { setPhase('config'); return; }
    let live = true;
    const forget = () => { local.del(ME); wanted.current = null; loaded.current = false; touched.current.clear(); setUser(null); setProfile(null); setStatsAll(null); setStatsAt(null); setCloud({}); setPhase('signedOut'); };
    supa.auth.getSession().then(({ data }) => {
      if (!live) return;
      token.current = data.session ? data.session.access_token : null;
      if (!data.session) return forget();
      if (shown.current.id && shown.current.id !== data.session.user.id) { setProfile(null); setStatsAll(null); setStatsAt(null); setCloud({}); setPhase('loading'); }
      if (fetching.current !== data.session.user.id) load(data.session.user);   // unless the sign-in event already started it
    });
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      token.current = session ? session.access_token : null;
      if (event === 'SIGNED_OUT') forget();
      else if (event === 'SIGNED_IN' && session && wanted.current !== session.user.id) load(session.user);   // a new sign-in, not a refresh of the one on screen
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [load]);

  /* per-player app state: kept in this browser and saved to the account a moment after each change */
  const setKey = useCallback((name, next) => {
    touched.current.add(name);
    setCloud((c) => { const value = typeof next === 'function' ? next(c[name]) : next; const out = { ...c, [name]: value }; dirty.current = true; return out; });
  }, []);
  useEffect(() => {
    if (!user || !dirty.current) return;
    local.set('jc.cloud.' + user.id, cloud);
    if (DEMO) { dirty.current = false; return; }
    if (!loaded.current) return;   // not until the account's copy has been read, or this browser's older copy would overwrite it
    const t = setTimeout(() => { dirty.current = false; supa.from('app_state').upsert({ user_id: user.id, data: cloudRef.current, updated_at: new Date().toISOString() }).then(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [cloud, user]);

  useEffect(() => {     // remember what is on screen for the next visit
    if (DEMO || !user || !profile || !profile.riot_name || phase !== 'ready') return;
    local.set(ME, { id: user.id, email: user.email, profile, stats: statsAll, statsAt });
  }, [user, profile, statsAll, statsAt, phase]);

  /* Pull new games and rebuild the stats. `depth` is how many of the latest games of each kind to look at; the Review tab
     raises it to reach further back, and the choice is remembered so later updates keep covering that span. */
  const runSync = useCallback(async (depth) => {
    if (syncing.current || DEMO) return;
    const reach = Number(typeof depth === 'number' ? depth : cloudRef.current.reviewDepth) || 0;
    syncing.current = true; setSync({ busy: true, done: 0, total: 0, error: '' });
    try {
      if (!token.current) { const { data } = await supa.auth.getSession(); token.current = data.session ? data.session.access_token : null; }
      if (!token.current) return;   // signed out in the meantime; the sign-in screen takes over
      for (let guard = 0; guard < 40; guard++) {
        const res = await fetch('/api/sync' + (reach > 20 ? '?depth=' + reach : ''), { method: 'POST', headers: { Authorization: 'Bearer ' + token.current } });
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) { await new Promise((r) => setTimeout(r, ((body.retryAfter || 10) + 1) * 1000)); continue; }
        if (!res.ok) throw new Error(body.error || 'Could not update your stats (error ' + res.status + ').');
        setSync({ busy: !body.done, done: body.total - body.remaining, total: body.total, error: '' });
        if (body.done) { setStatsAll(body.stats); setStatsAt(new Date().toISOString()); break; }
      }
    } catch (e) { setSync({ busy: false, done: 0, total: 0, error: e.message }); }
    finally { syncing.current = false; setSync((s) => ({ ...s, busy: false })); }
  }, []);

  useEffect(() => {     // first visit, or numbers older than half an hour: refresh quietly
    // ...or numbers saved before normal games were added, which have only the ranked set
    if (phase === 'ready' && !DEMO && (!statsAt || Date.now() - new Date(statsAt).getTime() > STALE_MS || (statsAll && !hasQueues(statsAll)))) runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const saveProfile = useCallback(async (patch) => {
    const next = { ...(profile || {}), ...patch, id: user.id };
    if (DEMO) { local.set('jc.demo.profile', next); setProfile(next); setPhase('ready'); return null; }
    const riotChanged = !profile || profile.riot_name !== next.riot_name || profile.riot_tag !== next.riot_tag || profile.region !== next.region;
    const { puuid, updated_at, ...row } = next;
    const { data, error } = await supa.from('profiles').upsert(row).select().maybeSingle();
    if (error) return error.message;
    setProfile(data || next); setPhase('ready');
    if (riotChanged) { setStatsAll(null); setStatsAt(null); setTimeout(runSync, 50); }
    return null;
  }, [profile, user, runSync]);

  const role = cloud.viewRole || (profile && profile.role) || 'jungle';
  const queue = isQueue(cloud.viewQueue) ? cloud.viewQueue : 'both';   // which games: ranked, normal or both
  const value = useMemo(() => ({
    phase, user, profile, role, setRole: (r) => setKey('viewRole', r), statsAt, sync, runSync, saveProfile, cloud, setKey,
    queue, setQueue: (q) => setKey('viewQueue', q),
    stats: statsAll ? statsFor(statsAll, queue)[role] || null : null,
    // how many games each choice holds for this role, for the switch; empty until the saved numbers include normals
    queueCounts: hasQueues(statsAll) ? Object.fromEntries(QUEUE_TABS.map((t) => [t.id, (statsFor(statsAll, t.id)[role] || {}).games || 0])) : {},
    signIn: async (username, password) => {
      if (!validUsername(username) || !ALLOWED.includes(username)) return { error: { message: 'This site is private. Check your username.' } };
      const out = await supa.auth.signInWithPassword({ email: loginEmail(username), password });
      if (out.error && /invalid login/i.test(out.error.message || '')) return { error: { message: 'Wrong password for that username.' } };
      return out;
    },
    changePassword: (password) => supa.auth.updateUser({ password }),
    username: user && user.email ? user.email.split('@')[0] : '',
    signOut: () => (DEMO ? null : supa.auth.signOut()),
  }), [phase, user, profile, role, queue, statsAll, statsAt, sync, runSync, saveProfile, cloud, setKey]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* A named piece of the signed-in player's saved state (drill progress, the live tracker). */
export function useSynced(name, initial, valid) {
  const { cloud, setKey } = useSession();
  const raw = cloud[name];
  const value = useMemo(() => {
    if (raw === undefined || raw === null || (valid && !valid(raw))) return initial;
    return typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...raw } : raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback((next) => setKey(name, (prev) => {
    const base = prev === undefined || prev === null || (valid && !valid(prev)) ? initial : typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...prev } : prev;
    return typeof next === 'function' ? next(base) : next;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [name, setKey]);
  return [value, set];
}
