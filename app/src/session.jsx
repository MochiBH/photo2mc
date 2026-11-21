import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const DEMO = import.meta.env.VITE_DEMO === '1';   // local checks only: no accounts, stats from /demo-stats.json
export const supa = !DEMO && URL_ && KEY ? createClient(URL_, KEY) : null;

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);
const STALE_MS = 30 * 60 * 1000;
const local = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

export function SessionProvider({ children }) {
  const [phase, setPhase] = useState('loading');           // loading | config | signedOut | needsProfile | ready
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [statsAll, setStatsAll] = useState(null);
  const [statsAt, setStatsAt] = useState(null);
  const [cloud, setCloud] = useState({});
  const [sync, setSync] = useState({ busy: false, done: 0, total: 0, error: '' });
  const token = useRef(null), dirty = useRef(false), cloudRef = useRef({}), syncing = useRef(false);
  cloudRef.current = cloud;

  const load = useCallback(async (u) => {
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
    setCloud({ ...cached, ...((a.data && a.data.data) || {}) });
    setStatsAll(s.data ? s.data.stats : null); setStatsAt(s.data ? s.data.updated_at : null);
    setProfile(p.data || null);
    setPhase(p.data && p.data.riot_name ? 'ready' : 'needsProfile');
  }, []);

  useEffect(() => {
    if (DEMO) { load({ id: 'demo', email: 'demo@local' }); return; }
    if (!supa) { setPhase('config'); return; }
    let live = true;
    supa.auth.getSession().then(({ data }) => { if (!live) return; token.current = data.session ? data.session.access_token : null; if (data.session) load(data.session.user); else setPhase('signedOut'); });
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      token.current = session ? session.access_token : null;
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); setStatsAll(null); setCloud({}); setPhase('signedOut'); }
      else if (event === 'SIGNED_IN' && session) setUser((u) => { if (!u || u.id !== session.user.id) load(session.user); return u; });
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [load]);

  /* per-player app state: kept in this browser and saved to the account a moment after each change */
  const setKey = useCallback((name, next) => {
    setCloud((c) => { const value = typeof next === 'function' ? next(c[name]) : next; const out = { ...c, [name]: value }; dirty.current = true; return out; });
  }, []);
  useEffect(() => {
    if (!user || !dirty.current) return;
    local.set('jc.cloud.' + user.id, cloud);
    if (DEMO) { dirty.current = false; return; }
    const t = setTimeout(() => { dirty.current = false; supa.from('app_state').upsert({ user_id: user.id, data: cloudRef.current, updated_at: new Date().toISOString() }).then(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [cloud, user]);

  const runSync = useCallback(async () => {
    if (syncing.current || DEMO) return;
    syncing.current = true; setSync({ busy: true, done: 0, total: 0, error: '' });
    try {
      for (let guard = 0; guard < 40; guard++) {
        const res = await fetch('/api/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + token.current } });
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
    if (phase === 'ready' && !DEMO && (!statsAt || Date.now() - new Date(statsAt).getTime() > STALE_MS)) runSync();
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
  const value = useMemo(() => ({
    phase, user, profile, role, setRole: (r) => setKey('viewRole', r), stats: statsAll ? statsAll[role] : null, statsAt, sync, runSync, saveProfile, cloud, setKey,
    signIn: (email, password) => supa.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supa.auth.signUp({ email, password }),
    signOut: () => (DEMO ? null : supa.auth.signOut()),
  }), [phase, user, profile, role, statsAll, statsAt, sync, runSync, saveProfile, cloud, setKey]);
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
