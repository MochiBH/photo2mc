import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerProgress } from '../wm/shimmer-progress';
import { cn } from '../wm/utils';
import { Eyebrow, Lead, Mark, Num, Rise, Screen } from '../ui';
import { useApp, useCapability } from '../store';
import { OPGG, OPGG_INPUT, OPGG_TOOL, RULES, gamesFromOpgg, gkey, rec } from '../lib/legacy';

const fmtWhen = (ms) => { try { return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return 'just now'; } };
const CACHE = { staleTime: 120000, gcTime: 86400000 };

export function GameRow({ win, champ, sub, date, children }) {
  return (
    <motion.li layout className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-muted/60 py-2.5 pr-3 pl-4">
      <span className={cn('absolute inset-y-0 left-0 w-1', win ? 'bg-good' : 'bg-bad')} />
      <div className="flex items-baseline gap-2.5 text-[15px]">
        <span className={cn('w-9 font-bold', win ? 'text-good' : 'text-bad')}>{win ? 'Win' : 'Loss'}</span>
        <span className="font-semibold">{champ}</span>
        <span className="tnum text-muted-foreground">{sub}</span>
        <span className="ml-auto text-xs text-muted-foreground">{date}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </motion.li>
  );
}

export default function Games() {
  const { games, allGames, addGames } = useApp();
  const mcp = useCapability('mcp');
  const [status, setStatus] = useState({ text: 'Match data from OP.GG, saved Nov 19, 2026.' });
  const [busy, setBusy] = useState(false);
  const known = useRef(allGames);
  known.current = allGames;

  function take(result) {
    const payload = result && result.payload !== undefined ? result.payload : ((result && result.content) || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
    const fresh = gamesFromOpgg(payload);
    const before = new Set(known.current.map(gkey));
    const added = fresh.filter((g) => !before.has(gkey(g))).length;
    addGames(fresh);
    const when = (result && result.cache && result.cache.storedAt) || Date.now();
    setStatus({ text: `Updated from OP.GG, ${fmtWhen(when)}.${added ? ` ${added} new ${added === 1 ? 'game' : 'games'} added.` : ''}`, fresh: true, button: 'Update now' });
  }
  function fail(e) {
    const c = e && e.code;
    if (['server_not_connected', 'needs_reauth', 'selection_required', 'server_not_found'].includes(c)) setStatus({ text: "OP.GG isn't connected to your Claude account right now. Reconnect it in your claude.ai connector settings and this will update itself again. Showing your saved games.", button: 'Update now' });
    else if (['not_in_manifest', 'approval_required', 'consent_required', 'blocked_by_policy'].includes(c)) setStatus({ text: "This page isn't allowed to read OP.GG yet. Tap the button and allow it. Showing your saved games.", button: 'Allow and update' });
    else if (['server_unavailable', 'rate_limited', 'upstream_error'].includes(c)) setStatus({ text: "OP.GG didn't answer just now. Showing your saved games.", button: 'Update now' });
    else if (c === 'tool_error') setStatus({ text: 'OP.GG returned an error for your match list. Showing your saved games.', button: 'Update now' });
    else if (['not_granted', 'capability_disabled', 'capability_removed'].includes(c)) setStatus({ text: "Auto-update isn't available in this view. Showing your saved games." });
    else setStatus({ text: 'Couldn\'t read OP.GG\'s reply. Showing your saved games. Say "review" to Claude in chat and it will update them.', button: 'Update now' });
  }
  useEffect(() => {
    if (!mcp) return;
    setStatus({ text: 'Checking OP.GG for new games…', button: 'Update now' });
    let stop;
    try {
      stop = mcp.watchTool(OPGG, OPGG_TOOL, OPGG_INPUT, (ev) => {
        if (ev && ev.type === 'data') { try { take(ev.result); } catch (e) { fail(e); } } else if (ev && ev.type === 'error') fail(ev.error);
      }, { cache: CACHE });
    } catch (e) { fail(e); }
    return () => { if (typeof stop === 'function') stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcp]);
  async function refresh() {
    if (!mcp || busy) return;
    setBusy(true); setStatus((s) => ({ ...s, text: 'Checking OP.GG for new games…' }));
    try { take(await mcp.callTool(OPGG, OPGG_TOOL, OPGG_INPUT, { cache: { refresh: true, ...CACHE } })); } catch (e) { fail(e); } finally { setBusy(false); }
  }

  const n = games.length;
  const ahead = games.filter((g) => g.od > g.ed), behind = games.filter((g) => g.od < g.ed), even = games.filter((g) => g.od === g.ed);
  return (
    <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Your three rules, scored</Eyebrow>
        <Lead>Your last {n} ranked jungle games: <b className="text-foreground">{rec(games)}</b>. Updates itself when you open this page.</Lead>
      </Rise>
      {RULES.map((r, i) => {
        const kept = games.filter(r.ok), broke = games.filter((g) => !r.ok(g));
        return (
          <Rise key={r.name}>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Eyebrow>Rule {i + 1}</Eyebrow>
                    <h3 className="m-0 mt-0.5 text-lg leading-tight font-bold tracking-tight">{r.name}</h3>
                  </div>
                  <div className="text-right leading-none"><Num value={kept.length} className="text-3xl font-extrabold tracking-tight" /><span className="text-sm text-muted-foreground"> / {n}</span></div>
                </div>
                <ShimmerProgress value={n ? (kept.length / n) * 100 : 0} label={`Kept in ${kept.length} of ${n} games`} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-good-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-good uppercase">When you keep it</div><div className="tnum text-lg font-bold">{kept.length ? rec(kept) : '–'}</div></div>
                  <div className="rounded-xl bg-bad-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-bad uppercase">When you don't</div><div className="tnum text-lg font-bold">{broke.length ? rec(broke) : '–'}</div></div>
                </div>
                <Lead className="text-sm">{r.how}</Lead>
              </CardContent>
            </Card>
          </Rise>
        );
      })}
      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-2.5">
            <Eyebrow>What it adds up to</Eyebrow>
            <h3 className="m-0 text-lg font-bold tracking-tight">Dragons</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {[['Ahead', ahead, 'bg-good-soft'], ['Even', even, 'bg-muted'], ['Behind', behind, 'bg-bad-soft']].map(([label, list, bg]) => (
                <div key={label} className={cn('rounded-xl px-3 py-2', bg)}><div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div><div className="tnum text-lg font-bold">{list.length ? rec(list) : '–'}</div></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Rise>
      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Eyebrow>Game by game</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {games.map((g) => {
                let d = ''; try { d = new Date(g.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) {}
                return (
                  <GameRow key={gkey(g)} win={!!g.w} champ={g.c} sub={`${g.k}/${g.d}/${g.a}`} date={d}>
                    {RULES.map((r) => <Mark key={r.name} ok={r.ok(g)}>{r.chip(g)}</Mark>)}
                    <span className="tnum inline-flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-foreground/10">Dragons {g.od}–{g.ed}</span>
                  </GameRow>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </Rise>
      <Rise className="flex flex-col gap-2.5">
        <p className={cn('m-0 text-xs', status.fresh ? 'text-good' : 'text-muted-foreground')}>{status.text}</p>
        {mcp && status.button && <Button variant="outline" size="lg" disabled={busy} onClick={refresh}><RefreshCw className={busy ? 'animate-spin' : ''} /> {status.button}</Button>}
      </Rise>
    </Screen>
  );
}
