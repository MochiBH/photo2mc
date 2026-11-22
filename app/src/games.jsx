import { useCallback, useEffect, useState } from 'react';
import { DEMO, supa, useSession } from './session';

/* Every game on record for the signed-in player, for the Review tab. The stats screens only ever look at the latest 20
   or 40; this reads the saved games themselves (table player_games, the player's own rows), so nothing drops off the end.
   The list asks for a handful of fields per game; a game's full analysis is fetched when it is opened. */
const FIELDS = 'match_id, role, created, reviewed_at, note, champ:analysis->>champ, win:analysis->win, k:analysis->k, d:analysis->d, a:analysis->a, queue:analysis->>queue, seconds:analysis->seconds, free:analysis->free_deaths, rival:analysis->>rival';
const mem = { uid: null, list: null, full: new Map(), demo: null };   // kept while the page is open, so switching tabs does not refetch

/* The demo build has no accounts: games come from public/demo-games.json and reviews stay in this browser. */
const demoReviews = {
  get: () => { try { return JSON.parse(localStorage.getItem('jc.demo.reviews') || '{}'); } catch (e) { return {}; } },
  set: (v) => { try { localStorage.setItem('jc.demo.reviews', JSON.stringify(v)); } catch (e) {} },
};
async function demoRows() {
  if (!mem.demo) mem.demo = await (await fetch('/demo-games.json')).json();
  const mine = demoReviews.get();
  return mem.demo.filter((r) => r.analysis).map((r) => ({ ...r, note: null, reviewed_at: null, ...(mine[r.match_id] || {}) }));
}
const brief = (r) => { const g = r.analysis; return { match_id: r.match_id, role: r.role, created: r.created, reviewed_at: r.reviewed_at, note: r.note, champ: g.champ, win: g.win, k: g.k, d: g.d, a: g.a, queue: g.queue || null, seconds: g.seconds, free: g.free_deaths, rival: g.rival }; };

export function useGames() {
  const { user, statsAt } = useSession();
  const uid = user ? user.id : null;
  const [list, setList] = useState(mem.uid === uid ? mem.list : null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      let rows;
      if (DEMO) rows = (await demoRows()).map(brief);
      else {
        const { data, error: e } = await supa.from('player_games').select(FIELDS).eq('user_id', uid).not('analysis', 'is', null).order('created', { ascending: false }).limit(1000);
        if (e) throw new Error(e.message);
        rows = data;
      }
      mem.uid = uid; mem.list = rows; mem.full.clear();   // an update may have redone saved games, so opened ones are fetched again
      setList(rows); setError('');
    } catch (e) { setError(e.message || 'Could not load your games.'); }
  }, [uid]);
  useEffect(() => { load(); }, [load, statsAt]);   // again after every update, which may have added games

  /** One game with its full analysis: { match_id, role, created, reviewed_at, note, analysis }. */
  const getGame = useCallback(async (id) => {
    if (mem.full.has(id)) return mem.full.get(id);
    let row;
    if (DEMO) row = (await demoRows()).find((r) => r.match_id === id) || null;
    else {
      const { data, error: e } = await supa.from('player_games').select('match_id, role, created, reviewed_at, note, analysis').eq('user_id', uid).eq('match_id', id).maybeSingle();
      if (e) throw new Error(e.message);
      row = data;
    }
    if (!row || !row.analysis) throw new Error('That game is not on record.');
    mem.full.set(id, row);
    return row;
  }, [uid]);

  /** Save the player's own review of a game: { note } and/or { reviewed_at }. Returns an error message, or null. */
  const saveReview = useCallback(async (id, patch) => {
    setList((l) => { const next = l && l.map((r) => (r.match_id === id ? { ...r, ...patch } : r)); mem.list = next; return next; });
    if (mem.full.has(id)) mem.full.set(id, { ...mem.full.get(id), ...patch });
    if (DEMO) { const all = demoReviews.get(); all[id] = { ...(all[id] || {}), ...patch }; demoReviews.set(all); return null; }
    const { error: e } = await supa.from('player_games').update(patch).eq('user_id', uid).eq('match_id', id);
    return e ? e.message : null;
  }, [uid]);

  return { list, error, reload: load, getGame, saveReview };
}
