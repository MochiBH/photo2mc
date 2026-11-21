import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { cn } from '../wm/utils';
import { Lead } from '../ui';
import { useSession } from '../session';
import { queueWords } from '../lib/queues';

export function GameRow({ win, champ, sub, date, children }) {
  return (
    <li className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-white/[0.045] py-2.5 pr-3 pl-4 ring-1 ring-white/6">
      <span className={cn('absolute inset-y-0 left-0 w-1', win ? 'bg-good shadow-[0_0_12px_var(--good)]' : 'bg-bad shadow-[0_0_12px_var(--bad)]')} />
      <div className="flex items-baseline gap-2.5 text-[15px]">
        <span className={cn('w-9 font-bold', win ? 'text-good' : 'text-bad')}>{win ? 'Win' : 'Loss'}</span>
        <span className="font-semibold">{champ}</span>
        <span className="tnum text-muted-foreground">{sub}</span>
        <span className="ml-auto text-xs text-muted-foreground">{date}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </li>
  );
}
export const shortDate = (t) => { try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };

/* Marks a normal game in a list that mixes both kinds. */
export function NormalTag() {
  return <span className="inline-flex h-6 items-center rounded-full bg-white/[0.06] px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-white/10">Normal</span>;
}

export function NoGames({ role }) {
  const { sync, runSync, profile, queue } = useSession();
  const words = queueWords(queue);
  return (
    <Card><CardContent className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold tracking-tight">{sync.busy ? 'Pulling your games…' : `No ${words.adj}${role} games yet`}</h3>
      <Lead className="text-sm">{sync.busy ? 'This takes about 15 seconds the first time.' : `Nothing found for ${profile.riot_name}#${profile.riot_tag} as ${role} in the last 20 ${words.pool}. Play some, switch role or the kind of game at the top, or check the Riot ID on the Me tab.`}</Lead>
      {!sync.busy && <Button variant="outline" size="lg" onClick={runSync}><RefreshCw /> Check again</Button>}
    </CardContent></Card>
  );
}
