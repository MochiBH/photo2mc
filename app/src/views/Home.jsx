import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { ArrowRight, Flame, RefreshCw, Swords } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerButton } from '../wm/shimmer-button';
import { ShimmerProgress } from '../wm/shimmer-progress';
import { cn } from '../wm/utils';
import { Callout, Eyebrow, Lead, Mark, Num, Rise, Screen } from '../ui';
import { useApp } from '../store';
import { useSession } from '../session';
import { RULES, checksFor, rec } from '../lib/roles';
import { insights } from '../lib/insights';
import { champName } from '../lib/champs';
import { queueWords } from '../lib/queues';
import { Ring } from '../fx/ring';
import { calm } from '../fx/fx';
import { GameRow, NoGames, NormalTag, shortDate } from './Games';

/* The last ten results as a row of bars that grow in one after another: tall lime for a win, short pink for a loss. */
function Form({ games }) {
  const ref = useRef(null);
  useEffect(() => {
    if (calm) return;
    const a = animate(ref.current.children, { scaleY: [0, 1], opacity: [0, 1], delay: stagger(55, { start: 500 }), duration: 700, ease: 'outBack' });
    return () => a.pause();
  }, [games.length]);
  return (
    <div ref={ref} className="flex h-12 items-end gap-1.5" role="img" aria-label={'Last ' + games.length + ' results, oldest first: ' + games.map((g) => (g.w ? 'win' : 'loss')).join(', ')}>
      {games.map((g) => (
        <i key={g.id} className={cn('block flex-1 origin-bottom rounded-md', g.w ? 'h-full bg-neon shadow-[0_0_14px_-2px_var(--primary)]' : 'h-[46%] bg-bad/85')} />
      ))}
    </div>
  );
}

export default function Home() {
  const { stats, role, sync, runSync, statsAt } = useSession();
  const { go, openReview } = useApp();
  if (!stats || !stats.games) return <NoGames role={role} />;
  const G = stats.list, n = G.length, all = stats.groups.all, wins = G.filter((g) => g.w).length, mixed = stats.queue === 'both';
  let streak = 1; while (streak < n && G[streak].w === G[0].w) streak++;
  const leak = insights(stats)[0], checks = checksFor(stats, role), rules = RULES[role];
  const tiles = [['KDA', all.kda.join('/')], ['Deaths a game', (all.deaths / n).toFixed(1)], role === 'support' ? ['Vision a min', all.vision.per_min] : ['Jungle CS a min', all.jcs_min]];
  let when = ''; try { when = new Date(statsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) {}

  return (
    <Screen>
      <Rise>
        <Card glow>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Ring value={wins / n} label={`Win rate ${Math.round((wins / n) * 100)}%`} />
              <div className="min-w-0">
                <Eyebrow>Last {n} {queueWords(stats).adj}{role} games</Eyebrow>
                <div className="font-display text-neon tnum mt-1 text-[44px] leading-none font-black tracking-tight">{rec(G)}</div>
                <span className={cn('mt-2 inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold', G[0].w ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
                  <Flame size={13} strokeWidth={2.6} />{streak} {G[0].w ? (streak === 1 ? 'win' : 'wins') : streak === 1 ? 'loss' : 'losses'}{streak > 1 ? ' in a row' : ' last game'}
                </span>
              </div>
            </div>
            <Form games={G.slice(0, 10).reverse()} />
            <div className="grid grid-cols-3 gap-2">
              {tiles.map(([label, val]) => (
                <div key={label} className="rounded-2xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/8">
                  <div className="font-display tnum text-[15px] leading-tight font-bold tracking-tight whitespace-nowrap">{val}</div>
                  <div className="mt-0.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</div>
                </div>
              ))}
            </div>
            <ShimmerButton onClick={() => go('live')}><Swords size={18} /> Start a live game</ShimmerButton>
          </CardContent>
        </Card>
      </Rise>

      {leak && (
        <Rise>
          <Card>
            <CardContent className="flex flex-col gap-2.5">
              <Eyebrow>Focus for your next game</Eyebrow>
              <h3 className="m-0 text-lg leading-tight font-bold tracking-tight">{leak.title}</h3>
              <p className="m-0 text-sm text-muted-foreground"><span className="font-display tnum mr-2 text-2xl leading-none font-black text-bad">{leak.big}</span>{leak.unit}</p>
              <Callout label="Do this">{leak.fix}</Callout>
              <Button variant="outline" onClick={() => go('map')} className="self-start">See all your leaks <ArrowRight /></Button>
            </CardContent>
          </Card>
        </Rise>
      )}

      <Rise className="flex flex-col gap-2">
        <Eyebrow className="mt-1">Your checkpoints</Eyebrow>
        <div className="grid grid-cols-3 gap-2">
          {checks.map((c) => {
            const hit = G.filter(c.ok);
            return (
              <button type="button" key={c.id} onClick={() => go('map')} className="flex flex-col items-center gap-2 rounded-3xl bg-card px-2 py-3.5 text-center ring-1 ring-white/10 transition-transform active:scale-[0.97]">
                <Ring value={hit.length / n} size={66} stroke={7} label={`${c.name}: hit in ${hit.length} of ${n} games`}>
                  <span className="font-display tnum text-[15px] font-black">{hit.length}<span className="text-[10px] font-bold text-muted-foreground">/{n}</span></span>
                </Ring>
                <span className="text-[12px] leading-tight font-semibold">{c.name}</span>
                <span className="tnum text-[11px] font-bold text-good">{hit.length ? rec(hit) : '–'} when hit</span>
              </button>
            );
          })}
        </div>
      </Rise>

      {rules.map((r, i) => {
        const kept = G.filter(r.ok), broke = G.filter((g) => !r.ok(g));
        return (
          <Rise key={r.name}>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div><Eyebrow>Rule {i + 1}</Eyebrow><h3 className="m-0 mt-0.5 text-lg leading-tight font-bold tracking-tight">{r.name}</h3></div>
                  <div className="text-right leading-none whitespace-nowrap"><Num value={kept.length} className="font-display text-3xl font-black tracking-tight" /><span className="text-sm text-muted-foreground"> / {n}</span></div>
                </div>
                <ShimmerProgress value={(kept.length / n) * 100} label={`Kept in ${kept.length} of ${n} games`} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-good-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-good uppercase">When you keep it</div><div className="font-display tnum text-lg font-bold">{kept.length ? rec(kept) : '–'}</div></div>
                  <div className="rounded-2xl bg-bad-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-bad uppercase">When you don't</div><div className="font-display tnum text-lg font-bold">{broke.length ? rec(broke) : '–'}</div></div>
                </div>
                <Lead className="text-sm">{r.how}</Lead>
              </CardContent>
            </Card>
          </Rise>
        );
      })}

      <Rise>
        <Card><CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Game by game</Eyebrow>
            <Button variant="ghost" size="sm" onClick={() => go('review')} className="-mr-2 text-muted-foreground">Every game <ArrowRight /></Button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {G.map((g) => (
              <GameRow key={g.id} win={!!g.w} champ={champName(g.c)} sub={`${g.k}/${g.d}/${g.a}`} date={shortDate(g.t)} onOpen={() => openReview(g.id)}>
                {mixed && g.q === 'n' && <NormalTag />}
                {rules.map((r) => <Mark key={r.name} ok={r.ok(g)}>{r.chip(g)}</Mark>)}
                <span className="tnum inline-flex h-6 items-center rounded-full bg-white/[0.06] px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-white/10">Dragons {g.od}–{g.ed}</span>
              </GameRow>
            ))}
          </ul>
        </CardContent></Card>
      </Rise>
      <Rise className="flex flex-col gap-2.5">
        <p className="m-0 text-xs text-muted-foreground">{queueWords(stats).source} from the Riot API, last updated {when}.</p>
        <Button variant="outline" size="lg" disabled={sync.busy} onClick={runSync}><RefreshCw className={sync.busy ? 'animate-spin' : ''} /> {sync.busy ? 'Updating…' : 'Update now'}</Button>
      </Rise>
    </Screen>
  );
}
