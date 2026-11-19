import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Pause, Play, Plus, Skull, Undo2 } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerButton } from '../wm/shimmer-button';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn, spring } from '../wm/utils';
import { Eyebrow, Lead, Mark, Num } from '../ui';
import { PITS, RiftBase } from './Rift';

/* Season 2026 timers, in seconds of game time. */
const SPAWN = { dragon: 300, grubs: 480, herald: 900, baron: 1200 };
const RESPAWN = { dragon: 300, elder: 360, baron: 360 };
const NAMES = { dragon: 'Dragon', grubs: 'Voidgrubs', herald: 'Rift Herald', baron: 'Baron' };
export const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function gameSeconds(clock, now) {
  if (!clock) return null;
  return clock.paused != null ? clock.paused : Math.max(0, (now - clock.t0) / 1000);
}

/* Where every objective stands right now, from the list of taps. */
export function objectives(events, t) {
  const of = (k) => events.filter((e) => e.k === k);
  const count = (k, by) => of(k).filter((e) => e.by === by).length;
  const out = [];
  const add = (k, o) => {
    const up = o.spawn != null && t != null && t >= o.spawn, wait = o.spawn != null && t != null ? o.spawn - t : null;
    const status = o.done ? 'done' : o.gone ? 'gone' : t == null ? 'idle' : up ? 'up' : wait <= 90 ? 'soon' : 'wait';
    out.push({ k, name: NAMES[k], us: count(k, 'us'), them: count(k, 'them'), last: of(k).at(-1), status, wait, ...o });
  };
  const d = of('dragon'), us = count('dragon', 'us'), them = count('dragon', 'them'), soul = us >= 4 ? 'us' : them >= 4 ? 'them' : null, lastD = d.at(-1);
  add('dragon', { name: soul ? 'Elder dragon' : 'Dragon', soul, spawn: lastD ? (lastD.t != null ? lastD.t + (soul ? RESPAWN.elder : RESPAWN.dragon) : null) : SPAWN.dragon, pit: 'dragon' });
  add('grubs', { spawn: SPAWN.grubs, done: of('grubs').length > 0, pit: 'baron' });
  add('herald', { spawn: SPAWN.herald, done: of('herald').length > 0, gone: !of('herald').length && t != null && t >= SPAWN.baron - 15, pit: 'baron' });
  const lastB = of('baron').at(-1);
  add('baron', { spawn: lastB ? (lastB.t != null ? lastB.t + RESPAWN.baron : null) : SPAWN.baron, pit: 'baron' });
  return out;
}
const live = (o) => o.status !== 'done' && o.status !== 'gone' && o.spawn != null;
export const nextUp = (list) => list.filter(live).sort((a, b) => a.spawn - b.spawn)[0] || null;

function cue(o) {
  if (!o) return null;
  const pit = o.pit === 'dragon' ? 'the dragon pit' : 'the Baron pit';
  if (o.status === 'up') return { tone: 'up', head: `${o.name} is up`, text: `Only fight here, and only with teammates. If they aren't coming, give it up and take camps on the other side.` };
  if (o.status === 'soon' && o.wait > 45) return { tone: 'soon', head: `${o.name} in ${fmt(o.wait)}`, text: 'Recall now if you have gold. Buy a control ward. No river fights until teammates are with you.' };
  if (o.status === 'soon') return { tone: 'soon', head: `${o.name} in ${fmt(o.wait)}`, text: `Be at ${pit} now, with a teammate, control ward down. Arriving first is most of the fight.` };
  if (o.status === 'idle') return { tone: 'wait', head: `${o.name} first, at ${fmt(o.spawn)}`, text: 'Start the clock when the game starts and this counts down for you.' };
  return { tone: 'wait', head: `${o.name} in ${fmt(o.wait)}`, text: o.wait > 150 ? 'Time to clear your camps. Finish on the side this spawns on.' : 'Finish the camp you are on and start moving toward it.' };
}
function dragonRead(o) {
  if (o.soul === 'us') return 'You have the Soul. Group, take Elder and Baron, and end it.';
  if (o.soul === 'them') return 'They have the Soul. Do not fight them head on: catch someone alone first.';
  if (o.them === 3) return 'They are one dragon from Soul. Everything goes into stopping the next one.';
  if (o.us === 3) return 'You are one dragon from Soul. Be at the pit a minute early and fight nowhere else.';
  if (o.them === 2 && o.us < 2) return 'They have two. A third puts them one from Soul, so this next dragon is the one to contest.';
  if (o.us > o.them) return 'You are ahead on dragons. In your recent games you were 8–0 when you finished ahead.';
  if (o.them > o.us) return 'You are behind on dragons (1–4 when you finish behind). The next one matters more than any kill.';
  return null;
}

function useNow(running) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!running) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [running]);
  return now;
}

export default function Track({ bst, patch }) {
  const clock = bst.clock, running = !!clock && clock.paused == null;
  const now = useNow(running);
  const t = gameSeconds(clock, now);
  const list = objectives(bst.events, t), next = nextUp(list), c = cue(next);
  const dragon = list[0], grubs = list[1];
  const deaths = bst.deaths, free = deaths.filter((d) => d.free).length;
  const lastDeath = deaths.at(-1), justDied = lastDeath && t != null && lastDeath.t != null && t - lastDeath.t < 75;
  const firstDragon = bst.events.find((e) => e.k === 'dragon');

  const start = () => patch({ clock: { t0: Date.now(), paused: null } });
  const toggle = () => patch({ clock: running ? { ...clock, paused: t } : { t0: Date.now() - clock.paused * 1000, paused: null } });
  const nudge = (d) => patch({ clock: clock.paused != null ? { ...clock, paused: Math.max(0, clock.paused + d) } : { ...clock, t0: clock.t0 - d * 1000 } });
  const take = (k, by) => patch({ events: [...bst.events, { k, by, t: t == null ? null : Math.round(t) }] });
  const undo = (k) => { const i = bst.events.map((e) => e.k).lastIndexOf(k); if (i >= 0) patch({ events: bst.events.filter((_, n) => n !== i) }); };
  const die = (isFree) => patch({ deaths: [...deaths, { t: t == null ? null : Math.round(t), free: isFree }] });

  return (
    <div className="flex flex-col gap-4">
      {/* clock */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Eyebrow>Game clock</Eyebrow>
              <div className="tnum text-[44px] leading-none font-extrabold tracking-tight">{t == null ? '0:00' : fmt(t)}</div>
            </div>
            {clock && <Button variant="secondary" size="icon" onClick={toggle} aria-label={running ? 'Pause the clock' : 'Resume the clock'}>{running ? <Pause /> : <Play />}</Button>}
          </div>
          {clock && (
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => nudge(-60)} aria-label="Clock back 1 minute"><Minus />1m</Button>
              <Button variant="outline" size="sm" onClick={() => nudge(-10)} aria-label="Clock back 10 seconds"><Minus />10s</Button>
              <Button variant="outline" size="sm" onClick={() => nudge(10)} aria-label="Clock forward 10 seconds"><Plus />10s</Button>
              <Button variant="outline" size="sm" onClick={() => nudge(60)} aria-label="Clock forward 1 minute"><Plus />1m</Button>
            </div>
          )}
          {!clock && <ShimmerButton onClick={start}><Play size={18} /> Start when the game starts</ShimmerButton>}
          {clock && <Lead className="text-sm">Match it to the in-game clock with the buttons. Timers below follow it.</Lead>}
        </CardContent>
      </Card>

      {/* next objective */}
      {c && (
        <motion.div layout transition={spring}
          className={cn('relative overflow-hidden rounded-2xl px-4 py-3.5 ring-1', c.tone === 'up' ? 'bg-primary text-primary-foreground ring-primary' : c.tone === 'soon' ? 'bg-gold-soft ring-gold/40' : 'bg-card ring-foreground/10')}>
          {c.tone !== 'wait' && <motion.span aria-hidden="true" className={cn('absolute top-3.5 right-4 size-3 rounded-full', c.tone === 'up' ? 'bg-primary-foreground' : 'bg-gold')} animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />}
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-70">Next objective</div>
          <div className="tnum mt-0.5 text-2xl leading-tight font-extrabold tracking-tight">{c.head}</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={c.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="m-0 mt-1 text-[15px] leading-snug">{c.text}</motion.p>
          </AnimatePresence>
        </motion.div>
      )}

      {/* objectives */}
      <Card>
        <CardContent className="flex flex-col gap-3.5">
          <h3 className="m-0 text-lg font-bold tracking-tight">Objectives</h3>
          <RiftBase label="Objective map with timers" labels={false} className="mx-auto max-w-[300px]">
            {['dragon', 'baron'].map((pit) => {
              const here = list.filter((o) => o.pit === pit && live(o)).sort((a, b) => a.spawn - b.spawn)[0];
              const [x, y] = PITS[pit];
              const hot = here && (here.status === 'up' || here.status === 'soon');
              return (
                <g key={pit}>
                  {hot && <motion.circle cx={x} cy={y} fill="none" stroke={here.status === 'up' ? 'var(--primary)' : 'var(--gold)'} strokeWidth="1.4" initial={{ r: 8, opacity: 0.9 }} animate={{ r: 19, opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />}
                  <circle cx={x} cy={y} r="8" fill={hot ? (here.status === 'up' ? 'var(--primary)' : 'var(--gold)') : 'var(--card)'} stroke="var(--foreground)" strokeOpacity=".2" strokeWidth=".6" />
                  <rect x={x - 21} y={y + (pit === 'dragon' ? 10.5 : -24.5)} width="42" height="14" rx="7" fill="var(--card)" stroke="var(--foreground)" strokeOpacity=".14" strokeWidth=".5" />
                  <text x={x} y={y + (pit === 'dragon' ? 16 : -19)} textAnchor="middle" fontSize="4.2" fontWeight="700" fill="var(--muted-foreground)" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{here ? here.name : pit === 'dragon' ? 'Dragon' : 'Baron pit'}</text>
                  <text x={x} y={y + (pit === 'dragon' ? 22 : -13)} textAnchor="middle" fontSize="5.4" fontWeight="800" fill="var(--foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {!here ? 'nothing left' : here.status === 'up' ? 'UP NOW' : here.status === 'idle' ? 'at ' + fmt(here.spawn) : 'in ' + fmt(here.wait)}
                  </text>
                </g>
              );
            })}
          </RiftBase>
          {list.map((o) => {
            const state = o.status === 'done' ? (o.last.by === 'us' ? 'Your team took them' : o.last.by === 'split' ? 'Split between both teams' : 'Enemy took them')
              : o.status === 'gone' ? 'Gone: Baron replaced it'
              : o.status === 'up' ? 'Up now' : o.status === 'idle' ? (o.spawn != null ? `Spawns at ${fmt(o.spawn)}` : 'Start the clock for the next timer') : `Spawns in ${fmt(o.wait)}`;
            const closed = o.status === 'done' || o.status === 'gone';
            return (
              <motion.div key={o.k} layout transition={spring} className={cn('flex flex-col gap-2.5 rounded-xl p-3', o.status === 'up' ? 'bg-primary/12 ring-1 ring-primary/50' : o.status === 'soon' ? 'bg-gold-soft' : 'bg-muted/60')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base leading-tight font-bold tracking-tight">{o.name}</div>
                    <div className="tnum text-[13px] text-muted-foreground">{state}</div>
                  </div>
                  {(o.k === 'dragon' || o.k === 'baron') && (
                    <div className="tnum flex items-baseline gap-1 text-2xl font-extrabold tracking-tight" aria-label={`You ${o.us}, enemy ${o.them}`}>
                      <Num value={o.us} className="text-good" /><span className="text-base text-muted-foreground">–</span><Num value={o.them} className="text-bad" />
                    </div>
                  )}
                  {o.last && <Button variant="ghost" size="icon" onClick={() => undo(o.k)} aria-label={`Undo last ${o.name} tap`} className="size-9 text-muted-foreground"><Undo2 /></Button>}
                </div>
                {!closed && (
                  <div className={cn('grid gap-2', o.k === 'grubs' ? 'grid-cols-3' : 'grid-cols-2')}>
                    <TapButton tone="good" onClick={() => take(o.k, 'us')}>We took {o.k === 'grubs' ? 'them' : 'it'}</TapButton>
                    {o.k === 'grubs' && <TapButton onClick={() => take(o.k, 'split')}>Split</TapButton>}
                    <TapButton tone="bad" onClick={() => take(o.k, 'them')}>They took {o.k === 'grubs' ? 'them' : 'it'}</TapButton>
                  </div>
                )}
                {o.k === 'dragon' && dragonRead(o) && <p className="m-0 text-sm leading-snug">{dragonRead(o)}</p>}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* deaths */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-lg font-bold tracking-tight">Deaths</h3>
            {deaths.length > 0 && <Button variant="ghost" size="icon" onClick={() => patch({ deaths: deaths.slice(0, -1) })} aria-label="Undo last death" className="size-9 text-muted-foreground"><Undo2 /></Button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Budget label="Deaths" value={deaths.length} max={5} />
            <Budget label="Free deaths" value={free} max={3} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TapButton onClick={() => die(false)}><Skull size={15} /> Died, we got one too</TapButton>
            <TapButton tone="bad" onClick={() => die(true)}><Skull size={15} /> Died for nothing</TapButton>
          </div>
          <AnimatePresence initial={false}>
            {(justDied || deaths.length >= 4 || free >= 3) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                <div className="flex flex-col gap-1.5 rounded-xl bg-bad-soft px-3.5 py-3 text-[15px] leading-snug">
                  {justDied && <p className="m-0"><b>Just respawned:</b> clear one camp before you rejoin. A third of your deaths come within 90 seconds of respawning.</p>}
                  {free >= 3 && <p className="m-0"><b>That is your free-death limit.</b> You are 8–0 with three or fewer and 2–7 with more. Count heads before every fight from here.</p>}
                  {deaths.length >= 4 && <p className="m-0"><b>{deaths.length >= 5 ? 'Budget spent.' : 'Fourth death.'}</b> From now on you only fight at an objective.</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* checkpoints */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-bold tracking-tight">This game's checkpoints</h3>
          <div className="flex flex-col gap-2">
            <Check3 label="Take the first dragon" state={!firstDragon ? null : firstDragon.by === 'us'} />
            <Check3 label="Take at least one Voidgrub" state={!grubs.last ? (grubs.status === 'gone' ? false : null) : grubs.last.by !== 'them'} />
            <Check3 label="Three free deaths or fewer" state={free > 3 ? false : true} note={free > 3 ? null : `${free} so far`} />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-sm font-semibold">How is it going?</span>
            <ContinuousTabs tabs={[{ id: 'behind', label: 'Behind' }, { id: 'even', label: 'Even' }, { id: 'ahead', label: 'Ahead' }]} value={bst.state} onChange={(v) => patch({ state: v })} label="How your game is going" size="sm" />
          </div>
          <Lead className="text-sm">Behind or ahead changes the items and the plan on the Build tab.</Lead>
        </CardContent>
      </Card>
    </div>
  );
}

function TapButton({ tone, className, children, ...props }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={cn('flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-sm leading-tight font-semibold',
        tone === 'good' ? 'border-good/40 bg-good-soft text-good' : tone === 'bad' ? 'border-bad/40 bg-bad-soft text-bad' : 'bg-card dark:bg-input/30', className)} {...props}>
      {children}
    </motion.button>
  );
}
function Budget({ label, value, max }) {
  const over = value > max;
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-xl px-3 py-2.5', over ? 'bg-bad-soft' : 'bg-muted/60')}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className="tnum text-sm text-muted-foreground"><Num value={value} className={cn('text-xl font-extrabold', over ? 'text-bad' : 'text-foreground')} /> / {max}</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${value} of ${max}`}>
        {Array.from({ length: max }).map((_, i) => (
          <motion.span key={i} className="h-2 flex-1 rounded-full" initial={false} animate={{ backgroundColor: i < value ? (value >= max ? 'var(--bad)' : 'var(--gold)') : 'var(--border)', scaleY: i < value ? 1 : 0.7 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} />
        ))}
      </div>
    </div>
  );
}
function Check3({ label, state, note }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
      <span className="text-[15px] font-medium">{label}</span>
      {state === null ? <span className="inline-flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-foreground/10">Not yet</span> : <Mark ok={state}>{note || (state ? 'Hit' : 'Missed')}</Mark>}
    </div>
  );
}
