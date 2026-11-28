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
import { rippleFrom, shake } from '../fx/fx';

/* Season 2026: when each objective first appears, in seconds of game time. The tracker runs off the clock alone. Marking
   who took what used to live here too, but it changed nothing in the build or the plan, and the game shows its own
   respawn timers, so it was taps for nothing. */
const FIRST = [
  { k: 'dragon', name: 'Dragon', spawn: 300, pit: 'dragon', then: 'The next one comes 5:00 after each dragon dies. The scoreboard (hold Tab) shows the timer.' },
  { k: 'grubs', name: 'Voidgrubs', spawn: 480, pit: 'baron', then: 'They only come once.' },
  { k: 'herald', name: 'Rift Herald', spawn: 900, pit: 'baron', then: 'It only comes once.' },
  { k: 'baron', name: 'Baron', spawn: 1200, pit: 'baron', then: 'It comes back 6:00 after it dies. The scoreboard (hold Tab) shows the timer.' },
];
const FRESH = 60;   // how long after it appears an objective still counts as "up now"
export const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function gameSeconds(clock, now) {
  if (!clock) return null;
  return clock.paused != null ? clock.paused : Math.max(0, (now - clock.t0) / 1000);
}

/* Where each first spawn stands on the clock: idle (clock not started), wait, soon (90 seconds out), up (just appeared), past. */
export function objectives(t) {
  return FIRST.map((o) => {
    const wait = t == null ? null : o.spawn - t;
    return { ...o, wait, status: t == null ? 'idle' : wait > 90 ? 'wait' : wait > 0 ? 'soon' : wait > -FRESH ? 'up' : 'past' };
  });
}
export const nextUp = (list) => list.find((o) => o.status !== 'past') || null;

function cue(o, role) {
  const sup = role === 'support', top = role === 'top', mine = o && o.pit === 'baron';   // the Baron pit is on the top side
  if (!o) return null;
  const pit = o.pit === 'dragon' ? 'the dragon pit' : 'the Baron pit';
  if (o.status === 'up') return { tone: 'up', head: `${o.name} is up`, text: `Only fight here, and only with teammates. If they aren't coming, give it up and take camps on the other side.` };
  if (top && o.status === 'soon') return { tone: 'soon', head: `${o.name} in ${fmt(o.wait)}`, text: mine
    ? (o.wait > 45 ? 'This one is on your side of the map. Push your wave into their tower now, then walk over.' : `Be at ${pit} now, with your jungler. Arriving first is most of the fight.`)
    : (o.wait > 45 ? 'Push your wave so their top laner cannot leave. Go down only if your team is going to fight for it.' : 'Stay top and keep pushing, or Teleport in if your team starts the fight. Do not walk down late.') };
  if (top && o.status === 'wait') return { tone: 'wait', head: `${o.name} in ${fmt(o.wait)}`, text: o.wait > 150 ? 'Farm your lane. Keep the wave on your half unless you know where their jungler is.' : mine ? 'Start pushing your wave now, so you can leave lane for this.' : 'Keep farming, and look at the map after every wave.' };
  if (o.status === 'soon' && o.wait > 45) return { tone: 'soon', head: `${o.name} in ${fmt(o.wait)}`, text: sup ? 'Recall now if you can. Come back with a control ward, and walk to the pit with your jungler or ADC, not alone.' : 'Recall now if you have gold. Buy a control ward. No river fights until teammates are with you.' };
  if (o.status === 'soon') return { tone: 'soon', head: `${o.name} in ${fmt(o.wait)}`, text: sup ? `Control ward down at ${pit}, sweep the brush around it, then stand behind your front line.` : `Be at ${pit} now, with a teammate, control ward down. Arriving first is most of the fight.` };
  if (o.status === 'idle') return { tone: 'wait', head: `${o.name} first, at ${fmt(o.spawn)}`, text: 'Start the clock when the game starts and this counts down for you.' };
  return { tone: 'wait', head: `${o.name} in ${fmt(o.wait)}`, text: sup ? (o.wait > 150 ? 'Plenty of time. Help your lane, and keep a ward on the river entrance nearest you.' : 'Push the wave with your ADC so you can both leave lane for this.') : o.wait > 150 ? 'Time to clear your camps. Finish on the side this spawns on.' : 'Finish the camp you are on and start moving toward it.' };
}
function useNow(running) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!running) return; setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [running]);
  return now;
}

export default function Track({ bst, patch, role = 'jungle', facts = null }) {
  const clock = bst.clock, running = !!clock && clock.paused == null;
  const now = useNow(running);
  const t = gameSeconds(clock, now);
  const list = objectives(t), next = nextUp(list), c = cue(next, role);
  const deaths = bst.deaths, free = deaths.filter((d) => d.free).length;
  const lastDeath = deaths.at(-1), justDied = lastDeath && t != null && lastDeath.t != null && t - lastDeath.t < 75;

  const start = () => patch({ clock: { t0: Date.now(), paused: null } });
  const toggle = () => patch({ clock: running ? { ...clock, paused: t } : { t0: Date.now() - clock.paused * 1000, paused: null } });
  const nudge = (d) => patch({ clock: clock.paused != null ? { ...clock, paused: Math.max(0, clock.paused + d) } : { ...clock, t0: clock.t0 - d * 1000 } });
  const die = (isFree, e) => { rippleFrom(e, 'melon'); if (isFree) shake(document.getElementById('death-card')); patch({ deaths: [...deaths, { t: t == null ? null : Math.round(t), free: isFree }] }); };

  return (
    <div className="flex flex-col gap-4">
      {/* clock */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Eyebrow>Game clock</Eyebrow>
              <div className="font-display text-neon tnum text-[46px] leading-none font-black tracking-tight">{t == null ? '0:00' : fmt(t)}</div>
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
          <div className="font-display tnum mt-1 text-[21px] leading-tight font-black tracking-tight">{c.head}</div>
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
              const here = list.find((o) => o.pit === pit && o.status !== 'past');
              const [x, y] = PITS[pit];
              const hot = here && (here.status === 'up' || here.status === 'soon');
              return (
                <g key={pit}>
                  {hot && <motion.circle cx={x} cy={y} fill="none" stroke={here.status === 'up' ? 'var(--primary)' : 'var(--gold)'} strokeWidth="1.4" initial={{ r: 8, opacity: 0.9 }} animate={{ r: 19, opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />}
                  <circle cx={x} cy={y} r="8" fill={hot ? (here.status === 'up' ? 'var(--primary)' : 'var(--gold)') : 'var(--card)'} stroke="var(--foreground)" strokeOpacity=".2" strokeWidth=".6" />
                  <rect x={x - 21} y={y + (pit === 'dragon' ? 10.5 : -24.5)} width="42" height="14" rx="7" fill="var(--card)" stroke="var(--foreground)" strokeOpacity=".14" strokeWidth=".5" />
                  <text x={x} y={y + (pit === 'dragon' ? 16 : -19)} textAnchor="middle" fontSize="4.2" fontWeight="700" fill="var(--muted-foreground)" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{here ? here.name : pit === 'dragon' ? 'Dragon' : 'Baron pit'}</text>
                  <text x={x} y={y + (pit === 'dragon' ? 22 : -13)} textAnchor="middle" fontSize="5.4" fontWeight="800" fill="var(--foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {!here ? 'check Tab' : here.status === 'up' ? 'UP NOW' : here.status === 'idle' ? 'at ' + fmt(here.spawn) : 'in ' + fmt(here.wait)}
                  </text>
                </g>
              );
            })}
          </RiftBase>
          <div className="flex flex-col gap-2">
            {list.map((o) => (
              <motion.div key={o.k} layout transition={spring} className={cn('flex flex-col gap-0.5 rounded-xl px-3 py-2.5', o.status === 'up' ? 'bg-primary/12 ring-1 ring-primary/50' : o.status === 'soon' ? 'bg-gold-soft' : 'bg-muted/60')}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base leading-tight font-bold tracking-tight">{o.name}</span>
                  <span className={cn('tnum text-sm font-semibold whitespace-nowrap', o.status === 'up' ? 'text-primary' : o.status === 'soon' ? 'text-gold' : 'text-muted-foreground')}>
                    {o.status === 'idle' ? `at ${fmt(o.spawn)}` : o.status === 'past' ? `came at ${fmt(o.spawn)}` : o.status === 'up' ? 'Up now' : `in ${fmt(o.wait)}`}
                  </span>
                </div>
                {o.status === 'past' && <p className="m-0 text-[13px] leading-snug text-muted-foreground">{o.then}</p>}
              </motion.div>
            ))}
          </div>
          <Lead className="text-sm">Nothing to tap here. These count down from the clock to the first time each one appears.</Lead>
        </CardContent>
      </Card>

      {/* deaths */}
      <Card id="death-card">
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
            <TapButton onClick={(e) => die(false, e)}><Skull size={15} /> Died, we got one too</TapButton>
            <TapButton tone="bad" onClick={(e) => die(true, e)}><Skull size={15} /> Died for nothing</TapButton>
          </div>
          <AnimatePresence initial={false}>
            {(justDied || deaths.length >= 4 || free >= 3) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                <div className="flex flex-col gap-1.5 rounded-xl bg-bad-soft px-3.5 py-3 text-[15px] leading-snug">
                  {justDied && <p className="m-0"><b>Just respawned:</b> {role === 'support' ? 'walk back with a teammate, not alone.' : role === 'top' ? 'take the wave at your tower before anything else.' : 'clear one camp before you rejoin.'}{facts && facts.quickShare >= 15 ? ` ${facts.quickShare}% of your deaths come within 90 seconds of respawning.` : ''}</p>}
                  {free >= 3 && <p className="m-0"><b>That is your free-death limit.</b>{facts ? ` You are ${facts.freeOk} with three or fewer and ${facts.freeBad} with more.` : ''} Count heads before every fight from here.</p>}
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
            <Check3 label="Five deaths or fewer" state={deaths.length > 5 ? false : true} note={deaths.length > 5 ? null : `${deaths.length} so far`} />
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
