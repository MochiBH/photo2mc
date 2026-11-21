import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerProgress } from '../wm/shimmer-progress';
import { cn } from '../wm/utils';
import { Eyebrow, Lead, Mark, Num, Rise, Screen } from '../ui';
import { useSession } from '../session';
import { RULES, rec } from '../lib/roles';
import { champName } from '../lib/champs';

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
export const shortDate = (t) => { try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };

export function NoGames({ role }) {
  const { sync, runSync, profile } = useSession();
  return (
    <Card><CardContent className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold tracking-tight">{sync.busy ? 'Pulling your games…' : `No ranked ${role} games yet`}</h3>
      <Lead className="text-sm">{sync.busy ? 'This takes about 15 seconds the first time.' : `Nothing found for ${profile.riot_name}#${profile.riot_tag} as ${role} in the last 20 ranked solo games. Play some, switch role at the top, or check the Riot ID on the Me tab.`}</Lead>
      {!sync.busy && <Button variant="outline" size="lg" onClick={runSync}><RefreshCw /> Check again</Button>}
    </CardContent></Card>
  );
}

export default function Games() {
  const { stats, role, sync, runSync, statsAt } = useSession();
  if (!stats || !stats.games) return <NoGames role={role} />;
  const games = stats.list, n = games.length, rules = RULES[role];
  const ahead = games.filter((g) => g.od > g.ed), behind = games.filter((g) => g.od < g.ed), even = games.filter((g) => g.od === g.ed);
  let when = ''; try { when = new Date(statsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) {}
  return (
    <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Your three rules, scored</Eyebrow>
        <Lead>Your last {n} ranked {role} games: <b className="text-foreground">{rec(games)}</b>.</Lead>
      </Rise>
      {rules.map((r, i) => {
        const kept = games.filter(r.ok), broke = games.filter((g) => !r.ok(g));
        return (
          <Rise key={r.name}>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div><Eyebrow>Rule {i + 1}</Eyebrow><h3 className="m-0 mt-0.5 text-lg leading-tight font-bold tracking-tight">{r.name}</h3></div>
                  <div className="text-right leading-none whitespace-nowrap"><Num value={kept.length} className="text-3xl font-extrabold tracking-tight" /><span className="text-sm text-muted-foreground"> / {n}</span></div>
                </div>
                <ShimmerProgress value={(kept.length / n) * 100} label={`Kept in ${kept.length} of ${n} games`} />
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
        <Card><CardContent className="flex flex-col gap-2.5">
          <Eyebrow>What it adds up to</Eyebrow>
          <h3 className="m-0 text-lg font-bold tracking-tight">Dragons</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[['Ahead', ahead, 'bg-good-soft'], ['Even', even, 'bg-muted'], ['Behind', behind, 'bg-bad-soft']].map(([label, list, bg]) => (
              <div key={label} className={cn('rounded-xl px-3 py-2', bg)}><div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div><div className="tnum text-lg font-bold">{list.length ? rec(list) : '–'}</div></div>
            ))}
          </div>
        </CardContent></Card>
      </Rise>
      <Rise>
        <Card><CardContent className="flex flex-col gap-3">
          <Eyebrow>Game by game</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {games.map((g) => (
              <GameRow key={g.id} win={!!g.w} champ={champName(g.c)} sub={`${g.k}/${g.d}/${g.a}`} date={shortDate(g.t)}>
                {rules.map((r) => <Mark key={r.name} ok={r.ok(g)}>{r.chip(g)}</Mark>)}
                <span className="tnum inline-flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-foreground/10">Dragons {g.od}–{g.ed}</span>
              </GameRow>
            ))}
          </ul>
        </CardContent></Card>
      </Rise>
      <Rise className="flex flex-col gap-2.5">
        <p className="m-0 text-xs text-muted-foreground">Ranked solo games from the Riot API, last updated {when}.</p>
        <Button variant="outline" size="lg" disabled={sync.busy} onClick={runSync}><RefreshCw className={sync.busy ? 'animate-spin' : ''} /> {sync.busy ? 'Updating…' : 'Update now'}</Button>
      </Rise>
    </Screen>
  );
}
