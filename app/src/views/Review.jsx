import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, History, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerButton } from '../wm/shimmer-button';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn } from '../wm/utils';
import { Callout, Eyebrow, Lead, Mark, Rise, Screen } from '../ui';
import { useApp } from '../store';
import { DEMO, useSession } from '../session';
import { useGames } from '../games';
import { rowOf } from '../../server/row.mjs';
import { RULES, checksFor } from '../lib/roles';
import { champName } from '../lib/champs';
import { sgn } from '../lib/legacy';
import { ROLE_NAME, ROLE_PLAYER, deathLine, duration, objectiveLine, takeaways } from '../lib/review';
import { burst } from '../fx/fx';
import { RiftBase, toMap } from './Rift';
import { shortDate } from './Games';

/* The Review tab: every game on record, and one screen per game to go through it and write down what to change.
   Nothing here is limited to the latest 20; the list is the saved games themselves (see games.jsx). */
const FILTERS = [{ id: 'all', label: 'All' }, { id: 'todo', label: 'To review' }, { id: 'done', label: 'Reviewed' }];
const MAX_DEPTH = 100;
const longDate = (t) => { try { return new Date(t).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };

export default function Review() {
  const { reviewId, setReviewId } = useApp();
  const { queue } = useSession();
  const games = useGames();
  const [show, setShow] = useState('all');
  const backTo = useRef(0);   // where the list was scrolled to when a game was opened

  const shown = useMemo(() => (games.list || []).filter((g) => (queue === 'both' || (g.queue || 'ranked') === queue) && (show === 'all' || (show === 'done') === !!g.reviewed_at)), [games.list, queue, show]);
  const open = (id) => { backTo.current = window.scrollY; setReviewId(id); window.scrollTo(0, 0); };
  const step = (id) => { setReviewId(id); window.scrollTo(0, 0); };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {reviewId ? (
        <motion.div key={'game' + reviewId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
          <GameReview id={reviewId} order={shown.map((g) => g.match_id)} games={games} onBack={() => setReviewId(null)} onStep={step} />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
          <GameList games={games} shown={shown} show={show} setShow={setShow} onOpen={open} restoreY={backTo.current} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Tag({ tone, children }) {
  return <span className={cn('tnum inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1', tone === 'bad' ? 'bg-bad-soft text-bad ring-bad/20' : 'bg-white/[0.06] text-muted-foreground ring-white/10')}>{children}</span>;
}

function GameList({ games, shown, show, setShow, onOpen, restoreY }) {
  const { sync, runSync, cloud, setKey, queue } = useSession();
  const all = games.list;
  useLayoutEffect(() => { if (restoreY) window.scrollTo(0, restoreY); }, []);   // back from a game: land where you left the list
  const inQueue = (all || []).filter((g) => queue === 'both' || (g.queue || 'ranked') === queue);
  const done = inQueue.filter((g) => g.reviewed_at).length;
  const depth = Math.min(MAX_DEPTH, Math.max(20, Number(cloud.reviewDepth) || 20));
  const older = () => { const next = Math.min(MAX_DEPTH, depth + 20); setKey('reviewDepth', next); runSync(next); };
  const tabs = FILTERS.map((f) => ({ ...f, count: f.id === 'all' ? inQueue.length : f.id === 'done' ? done : inQueue.length - done }));

  return (
    <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Game review</Eyebrow>
        <Lead>Every game on record, newest first. Open one to see what happened in it, death by death, and write down what you would change.</Lead>
      </Rise>
      <Rise><ContinuousTabs tabs={tabs} value={show} onChange={setShow} label="Which games to list" size="sm" /></Rise>
      <Rise>
        {games.error ? (
          <Card><CardContent className="flex flex-col gap-3"><Lead className="text-sm">{games.error}</Lead><Button variant="outline" onClick={games.reload} className="self-start"><RefreshCw /> Try again</Button></CardContent></Card>
        ) : !all ? (
          <Card><CardContent><Lead className="text-sm">Loading your games…</Lead></CardContent></Card>
        ) : !shown.length ? (
          <Card><CardContent><Lead className="text-sm">{!inQueue.length ? (sync.busy ? 'Pulling your games…' : 'No games on record yet. They appear here as soon as they are pulled.') : show === 'todo' ? 'Nothing left to review. Every game here has been gone through.' : 'You have not reviewed a game yet. Open one, read it through, and mark it reviewed.'}</Lead></CardContent></Card>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {shown.map((g) => (
              <li key={g.match_id}>
                <button type="button" onClick={() => onOpen(g.match_id)} aria-label={`Review ${champName(g.champ)}, ${g.win ? 'win' : 'loss'}, ${shortDate(g.created)}`}
                  className="relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-card py-2.5 pr-3 pl-4 text-left ring-1 ring-white/10 transition-transform active:scale-[0.985]">
                  <span className={cn('absolute inset-y-0 left-0 w-1', g.win ? 'bg-good shadow-[0_0_12px_var(--good)]' : 'bg-bad shadow-[0_0_12px_var(--bad)]')} />
                  <span className="flex items-baseline gap-2.5 text-[15px]">
                    <span className={cn('w-9 font-bold', g.win ? 'text-good' : 'text-bad')}>{g.win ? 'Win' : 'Loss'}</span>
                    <span className="font-semibold">{champName(g.champ)}</span>
                    <span className="tnum text-muted-foreground">{g.k}/{g.d}/{g.a}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{shortDate(g.created)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Tag>{ROLE_NAME[g.role] || g.role}</Tag>
                    {g.queue === 'normal' && <Tag>Normal</Tag>}
                    <Tag>{duration(g.seconds)}</Tag>
                    {g.free > 0 && <Tag tone="bad">{g.free} free {g.free === 1 ? 'death' : 'deaths'}</Tag>}
                    {g.reviewed_at
                      ? <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-good"><Check size={14} strokeWidth={3} />Reviewed</span>
                      : <ChevronRight size={18} className="ml-auto text-muted-foreground" />}
                  </span>
                  {g.note && <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">“{g.note}”</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Rise>
      {all && all.length > 0 && (
        <Rise className="flex flex-col gap-2.5">
          <p className="m-0 text-xs text-muted-foreground">{all.length} games on record, back to {shortDate(all.at(-1).created)}. New games are added every time your stats update, and none are ever removed.</p>
          {!DEMO && depth < MAX_DEPTH && <Button variant="outline" size="lg" disabled={sync.busy} onClick={older}><History /> {sync.busy ? 'Pulling games…' : 'Pull 20 older games of each kind'}</Button>}
          {!DEMO && depth >= MAX_DEPTH && <p className="m-0 text-xs text-muted-foreground">That is as far back as the site reaches: the last {MAX_DEPTH} ranked and {MAX_DEPTH} normal games.</p>}
        </Rise>
      )}
    </Screen>
  );
}

/* ---------- one game ---------- */
function GameReview({ id, order, games, onBack, onStep }) {
  const { stats } = useSession();
  const [row, setRow] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setRow(null); setErr('');
    games.getGame(id).then((r) => live && setRow(r)).catch((e) => live && setErr(e.message || 'Could not load that game.'));
    return () => { live = false; };
  }, [id, games.getGame]);
  const save = async (patch) => { setRow((r) => (r ? { ...r, ...patch } : r)); return games.saveReview(id, patch); };
  const at = order.indexOf(id), newer = at > 0 ? order[at - 1] : null, olderId = at > -1 && at < order.length - 1 ? order[at + 1] : null;

  const back = <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 self-start text-muted-foreground"><ArrowLeft /> All games</Button>;
  if (err) return <div className="flex flex-col gap-4">{back}<Card><CardContent><Lead className="text-sm">{err}</Lead></CardContent></Card></div>;
  if (!row) return <div className="flex flex-col gap-4">{back}<Card><CardContent><Lead className="text-sm">Loading the game…</Lead></CardContent></Card></div>;

  const g = row.analysis, r = rowOf(g), T = takeaways(g), coached = !!RULES[g.role];
  const rival = g.rival ? champName(g.rival) : null;
  const checks = coached ? [...RULES[g.role], ...(stats && stats.role === g.role ? checksFor(stats, g.role).filter((c) => !RULES[g.role].some((x) => x.name === c.name)) : [])] : [];
  const tiles = [['KDA', `${g.k}/${g.d}/${g.a}`], ["Team's kills", g.kp + '%'], g.role === 'support' ? ['Vision a min', g.vision.per_min] : g.role === 'jungle' ? ['Jungle CS a min', (g.jcs / g.minutes).toFixed(1)] : ['CS a min', (g.cs / g.minutes).toFixed(1)]];

  return (
    <Screen>
      <Rise className="flex items-center justify-between gap-2">
        {back}
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" disabled={!newer} onClick={() => onStep(newer)} aria-label="Newer game" className="size-9"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" disabled={!olderId} onClick={() => onStep(olderId)} aria-label="Older game" className="size-9"><ChevronRight /></Button>
        </div>
      </Rise>

      <Rise>
        <Card glow>
          <CardContent className="flex flex-col gap-3.5">
            <div>
              <Eyebrow>{longDate(row.created)} · {duration(g.seconds)} · {g.queue === 'normal' ? 'Normal' : 'Ranked'} · {ROLE_NAME[g.role] || g.role}</Eyebrow>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className={cn('font-display text-[34px] leading-none font-black tracking-tight', g.win ? 'text-neon' : 'text-bad')}>{g.win ? 'Win' : 'Loss'}</span>
                <span className="text-lg leading-tight font-bold tracking-tight">{champName(g.champ)}{rival && <span className="font-medium text-muted-foreground"> against {rival}</span>}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {tiles.map(([label, val]) => (
                <div key={label} className="rounded-2xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/8">
                  <div className="font-display tnum text-[15px] leading-tight font-bold tracking-tight whitespace-nowrap">{val}</div>
                  <div className="mt-0.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</div>
                </div>
              ))}
            </div>
            {g.teams && (
              <div className="flex flex-col gap-1 text-[13px] leading-snug text-muted-foreground">
                <span><b className="font-semibold text-good">Your team</b> {g.teams.mine.map(champName).join(' · ')}</span>
                <span><b className="font-semibold text-bad">Their team</b> {g.teams.theirs.map(champName).join(' · ')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card><CardContent className="flex flex-col gap-3">
          <Eyebrow>What stands out</Eyebrow>
          {T.fix.length === 0 && T.well.length === 0 && <Lead className="text-sm">Nothing unusual in the numbers for this one. Go through the deaths below.</Lead>}
          {T.fix.map((t, i) => (
            <div key={t.title} className="flex flex-col gap-2">
              <div><h3 className="m-0 text-lg leading-tight font-bold tracking-tight">{t.title}</h3><p className="m-0 mt-1 text-sm text-muted-foreground">{t.text}</p></div>
              <Callout label={i === 0 ? 'Next game' : 'Also'} tone={i === 0 ? 'primary' : 'muted'}>{t.next}</Callout>
            </div>
          ))}
          {T.well.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {T.well.map((t) => <li key={t.title} className="rounded-xl bg-good-soft px-3.5 py-2.5 text-[15px] leading-snug"><b className="font-semibold">{t.title}.</b> <span className="text-muted-foreground">{t.text}</span></li>)}
            </ul>
          )}
        </CardContent></Card>
      </Rise>

      {checks.length > 0 && (
        <Rise>
          <Card><CardContent className="flex flex-col gap-2.5">
            <Eyebrow>Your rules and checkpoints, this game</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {checks.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
                  <span className="text-[15px] leading-tight font-medium">{c.name}</span>
                  <Mark ok={c.ok(r)}>{c.chip(r)}</Mark>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </Rise>
      )}

      <Rise><Deaths g={g} /></Rise>
      <Rise><Race g={g} rival={rival} /></Rise>
      <Rise><Objectives g={g} /></Rise>
      <Rise><Notes key={id} row={row} save={save} /></Rise>

      <Rise className="flex gap-2">
        <Button variant="outline" size="lg" disabled={!newer} onClick={() => onStep(newer)} className="flex-1"><ChevronLeft /> Newer</Button>
        <Button variant="outline" size="lg" disabled={!olderId} onClick={() => onStep(olderId)} className="flex-1">Older <ChevronRight /></Button>
      </Rise>
    </Screen>
  );
}

function Deaths({ g }) {
  const [sel, setSel] = useState(null);
  const D = g.deaths || [];
  if (!D.length) return <Card><CardContent className="flex flex-col gap-2"><h3 className="m-0 text-lg font-bold tracking-tight">Every death</h3><Lead className="text-sm">You did not die in this game.</Lead></CardContent></Card>;
  const free = D.filter((d) => d.free).length;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">Every death, in order</h3>
        <Lead className="text-sm">{D.length} {D.length === 1 ? 'death' : 'deaths'}, {free} free. A free death is one where no enemy died in the same fight. Tap one to find it on the map.</Lead>
        <RiftBase label={`Map of this game's ${D.length} deaths`} className="mx-auto w-full max-w-[340px]">
          {D.map((d, i) => {
            const [x, y] = toMap(d.x, d.y), on = sel === i;
            return (
              <g key={i} onClick={() => setSel(on ? null : i)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={on ? 5.4 : 4.2} fill={on ? 'var(--foreground)' : d.free ? 'var(--bad)' : 'var(--card)'} stroke={on ? 'var(--foreground)' : 'var(--bad)'} strokeWidth="1" style={{ transition: 'r 0.2s' }} />
                <text x={x} y={y + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="800" fill={on ? 'var(--background)' : d.free ? 'var(--background)' : 'var(--bad)'} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</text>
              </g>
            );
          })}
        </RiftBase>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          <span><i className="mr-1.5 inline-block size-2.5 rounded-full bg-bad align-[-1px]" />Free death</span>
          <span><i className="mr-1.5 inline-block size-2.5 rounded-full bg-card align-[-1px] ring-1 ring-bad" />An enemy died too</span>
        </div>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {D.map((d, i) => {
            const L = deathLine(d), on = sel === i;
            return (
              <li key={i}>
                <button type="button" onClick={() => setSel(on ? null : i)} aria-pressed={on} className={cn('grid w-full grid-cols-[30px_1fr] items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors', on ? 'bg-accent ring-1 ring-white/25' : 'bg-muted/60')}>
                  <span className={cn('tnum grid size-7 place-items-center rounded-full text-[13px] font-extrabold', d.free ? 'bg-bad text-background' : 'text-bad ring-1 ring-bad')}>{i + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[15px] leading-snug"><b className="tnum font-bold">{L.when}</b> · {L.where}{L.by ? ` · ${L.by}` : ''}</span>
                    <span className="text-[13px] leading-snug text-muted-foreground">{L.around}</span>
                    <span className="flex flex-wrap gap-1.5">{L.tags.map((t) => <span key={t.t} className={cn('inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', t.bad ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good')}>{t.t}</span>)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="m-0 text-xs text-muted-foreground">Who was near is read from once-a-minute snapshots, so it is approximate.</p>
      </CardContent>
    </Card>
  );
}

/* Gold against the enemy in the same role, minute by minute: lime while ahead, pink while behind. */
function Race({ g, rival }) {
  const gd = g.gold_diff || [];
  if (gd.length < 4 || !rival) return null;
  const n = gd.length, top = Math.max(500, ...gd.map((v) => Math.abs(v))), X = (m) => 34 + (m / (n - 1)) * 276, Y = (v) => 12 + ((top - v) / (2 * top)) * 120;
  const k = (v) => (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : String(Math.abs(Math.round(v))));
  const marks = Object.keys(g.farm || {}).map(Number).sort((a, b) => a - b), jg = g.role === 'jungle';
  const end = gd.at(-1);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">The race against {rival}</h3>
        <Lead className="text-sm">Your gold minus theirs, minute by minute. Above the line you are ahead.</Lead>
        <svg viewBox="0 0 320 160" role="img" aria-label={`Gold difference against ${rival} by minute, ending ${end >= 0 ? 'ahead' : 'behind'} by ${k(end)}`} className="block h-auto w-full">
          <defs>
            <linearGradient id="race-ink" gradientUnits="userSpaceOnUse" x1="0" y1={Y(top)} x2="0" y2={Y(-top)}>
              <stop offset="0" stopColor="var(--good)" /><stop offset="0.5" stopColor="var(--good)" /><stop offset="0.5" stopColor="var(--bad)" /><stop offset="1" stopColor="var(--bad)" />
            </linearGradient>
          </defs>
          {[top, 0, -top].map((v) => <g key={v}><line x1="34" x2="310" y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1.4 : 0.8} /><text x="29" y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{v === 0 ? '0' : (v > 0 ? '+' : '−') + k(v)}</text></g>)}
          {Array.from({ length: Math.floor((n - 1) / 5) + 1 }, (_, i) => i * 5).map((m) => <text key={m} x={Math.min(X(m), 310)} y="152" textAnchor={X(m) > 292 ? 'end' : 'middle'} fontSize="10" fill="var(--muted-foreground)">{m}:00</text>)}
          <motion.path fill="none" stroke="url(#race-ink)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" d={'M' + gd.map((v, m) => X(m).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' L')}
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        {marks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tnum w-full border-collapse text-[13px] whitespace-nowrap">
              <caption className="pb-1 text-left text-sm text-muted-foreground">You / {rival}</caption>
              <thead><tr className="text-[11px] tracking-wider text-muted-foreground uppercase">{['At', 'Gold', 'Level', ...(jg ? ['Jungle CS'] : [])].map((h, i) => <th key={h} className={`px-1.5 py-1 font-bold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
              <tbody>{marks.map((m) => { const f = g.farm[m]; return (
                <tr key={m} className="border-t"><td className="px-1.5 py-2 font-semibold">{m}:00</td><td className="px-1.5 text-right">{k(f.gold[0])} / {k(f.gold[1])}</td><td className="px-1.5 text-right">{f.level[0]} / {f.level[1]}</td>{jg && <td className="px-1.5 text-right">{Math.round(f.jcs[0])} / {Math.round(f.jcs[1])} <span className="text-muted-foreground">({sgn(Math.round(f.jcs[0] - f.jcs[1]))})</span></td>}</tr>
              ); })}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Objectives({ g }) {
  const O = g.objectives || [], v = g.vision || {};
  const vision = [['Vision score', v.rival_score != null ? `${v.score} / ${v.rival_score}` : v.score, v.rival_score != null ? 'you / their ' + (ROLE_PLAYER[g.role] || 'opponent') : 'this game'], ['Control wards', v.control_bought, 'bought'], ['Wards', `${v.placed} / ${v.killed}`, 'placed / cleared']];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">Objectives and vision</h3>
        {O.length === 0 ? <Lead className="text-sm">No dragons, Voidgrubs, Herald or Baron were taken in this game.</Lead> : (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {O.map((o, i) => { const L = objectiveLine(o); return (
              <li key={i} className={cn('grid grid-cols-[44px_1fr] items-baseline gap-2 rounded-xl px-3 py-2 text-sm', L.mine ? 'bg-good-soft' : L.miss ? 'bg-bad-soft' : 'bg-muted/60')}>
                <b className="tnum font-bold">{L.when}</b>
                <span><b className="font-semibold">{L.name}</b> <span className={L.mine ? 'text-good' : 'text-bad'}>{L.mine ? 'yours' : 'theirs'}</span><span className="text-muted-foreground"> · {L.where}</span></span>
              </li>
            ); })}
          </ol>
        )}
        <div className="grid grid-cols-3 gap-2">
          {vision.map(([label, val, sub]) => (
            <div key={label} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
              <div className="tnum text-xl leading-tight font-extrabold tracking-tight">{val}</div>
              <div className="text-[12px] leading-tight text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* The player's own words on the game, saved to their account as they type, and a mark that it has been gone through. */
function Notes({ row, save }) {
  const [text, setText] = useState(row.note || ''), [state, setState] = useState('');
  const latest = useRef(row.note || ''), dirty = useRef(false), timer = useRef(null), reviewed = useRef(!!row.reviewed_at);
  reviewed.current = !!row.reviewed_at;
  const flush = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false; setState('Saving…');
    const note = latest.current.trim();
    // writing something about a game counts as having reviewed it
    const err = await save({ note: note || null, ...(note && !reviewed.current ? { reviewed_at: new Date().toISOString() } : {}) });
    setState(err ? 'Could not save: ' + err : 'Saved');
  };
  useEffect(() => () => { flush(); }, []);   // leaving the game saves what was typed
  const type = (e) => { const v = e.target.value.slice(0, 4000); setText(v); latest.current = v; dirty.current = true; setState(''); clearTimeout(timer.current); timer.current = setTimeout(flush, 1200); };
  const toggle = (e) => { if (!row.reviewed_at) burst(e, 'lime', 20); save({ reviewed_at: row.reviewed_at ? null : new Date().toISOString() }); };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-lg font-bold tracking-tight">Your review</h3>
          <span className="text-xs text-muted-foreground" aria-live="polite">{state}</span>
        </div>
        <textarea id="review-note" value={text} onChange={type} onBlur={flush} rows={4} maxLength={4000} aria-label="Your notes on this game"
          placeholder="What would you do differently? Which death was the one that mattered?"
          className="w-full min-w-0 resize-y rounded-2xl border border-white/12 bg-black/30 px-3.5 py-3 text-base leading-snug text-foreground transition-[border-color,box-shadow] placeholder:text-white/35 focus:border-primary/70 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)] focus-visible:outline-none" />
        {row.reviewed_at
          ? <Button variant="outline" size="lg" onClick={toggle} className="border-good/50 text-good"><Check /> Reviewed {shortDate(row.reviewed_at)} · tap to undo</Button>
          : <ShimmerButton onClick={toggle}><Check size={18} /> Mark as reviewed</ShimmerButton>}
      </CardContent>
    </Card>
  );
}
