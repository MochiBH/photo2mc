import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Camera, Check, Flame, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { Input } from '../wm/input';
import { ShimmerButton } from '../wm/shimmer-button';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn, spring } from '../wm/utils';
import { Eyebrow, Lead, Num, Rise, Screen, SHARP } from '../ui';
import { useSession, useSynced } from '../session';
import { CN, RUNES, champOf, norm } from '../lib/legacy';
import { BUILDS, champsFor, gold } from '../lib/champs';
import { ALLY_ROWS, ENEMY_ROWS, computeLive } from '../lib/live';
import { facts as factsOf } from '../lib/insights';
import { placeTeams, shrink } from '../lib/snap';
import { burst } from '../fx/fx';
import Track, { fmt, gameSeconds, nextUp, objectives } from './Track';

const BLANK = { me: '', role: 'auto', state: 'even', sec: 'teams', clock: null, deaths: [], allies: [0, 1, 2, 3].map(() => ({ c: '', f: 0 })), rows: [0, 1, 2, 3, 4].map(() => ({ c: '', r: '', f: 0 })), bought: [] };
const valid = (v) => v && Array.isArray(v.rows) && v.rows.length === 5 && Array.isArray(v.allies) && v.allies.length === 4 && Array.isArray(v.bought);
const SECS = [{ id: 'teams', label: 'Teams' }, { id: 'track', label: 'Track' }, { id: 'build', label: 'Build & plan' }];

function Fed({ on, onClick, tone, label }) {
  return (
    <motion.button type="button" onClick={onClick} aria-pressed={on} aria-label={label} whileTap={{ scale: 0.88 }} animate={{ scale: on ? [1, 1.15, 1] : 1 }} transition={{ duration: 0.3 }}
      className={cn('flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] font-bold tracking-wider uppercase transition-colors',
        on ? (tone === 'good' ? 'border-good bg-good text-background' : 'border-bad bg-bad text-background') : 'bg-card text-muted-foreground dark:bg-input/30')}>
      <Flame size={14} strokeWidth={2.5} />Fed
    </motion.button>
  );
}
function ChampInput({ id, value, onChange, placeholder, label, list = 'champ-list' }) {
  const bad = !!norm(value) && !champOf(value);
  return <Input id={id} list={list} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} aria-invalid={bad} autoComplete="off" autoCapitalize="words" spellCheck={false} />;
}
function MiniBar({ bst, onOpen }) {
  const [now, setNow] = useState(Date.now());
  const running = bst.clock.paused == null;
  useEffect(() => { if (!running) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [running]);
  const t = gameSeconds(bst.clock, now), nx = nextUp(objectives(t));
  const hot = nx && (nx.status === 'up' || nx.status === 'soon');
  return (
    <motion.button type="button" onClick={onOpen} layout whileTap={{ scale: 0.98 }}
      className={cn('tnum flex min-h-11 items-center justify-between gap-3 rounded-full px-4 text-sm font-semibold ring-1', nx && nx.status === 'up' ? 'bg-primary text-primary-foreground ring-primary' : hot ? 'bg-gold-soft ring-gold/40' : 'bg-card ring-foreground/10')}>
      <span>{fmt(t)}{running ? '' : ' · paused'}</span>
      <span>{nx ? (nx.status === 'up' ? `${nx.name} is up` : `${nx.name} in ${fmt(nx.wait)}`) : 'Respawn timers: hold Tab'}</span>
    </motion.button>
  );
}

/* Fill the team sheet from a picture: a screenshot of champion select or the loading screen, or a phone photo of the
   monitor. The picture is shrunk here, read by Claude on the server (api/teams.js), and each champion lands in its row. */
function Snap({ role, bst, patch }) {
  const { api } = useSession();
  const [state, setState] = useState({ busy: false, text: '', bad: false });
  const input = useRef(null), spot = useRef(null);
  const read = async (file) => {
    if (!file || state.busy) return;
    setState({ busy: true, text: '', bad: false });
    try {
      const res = await api('/api/teams', { ...(await shrink(file)), role });
      if (!res.ok) throw new Error(res.body.error || 'The picture could not be read. Try again.');
      const out = placeTeams(bst, role, res.body);
      if (out.patch) { patch(out.patch); burst(spot.current, 'lime', 22); }
      setState({ busy: false, text: out.message, bad: !out.patch });
    } catch (e) { setState({ busy: false, text: e.message || 'The picture could not be read. Try again.', bad: true }); }
  };
  useEffect(() => {   // on a computer, a screenshot on the clipboard can be pasted straight in
    const onPaste = (e) => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); read(f); } };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
  return (
    <Card><CardContent className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold tracking-tight">Fill the teams from a picture</h3>
      <Lead className="text-sm">Screenshot champion select or the loading screen, or point your phone at the monitor. Claude reads the champions and puts each one in its row.</Lead>
      <input ref={input} id="teams-photo" type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Picture of the teams" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; read(f); }} />
      <div ref={spot}><ShimmerButton disabled={state.busy} onClick={() => input.current.click()}><Camera size={18} /> {state.busy ? 'Reading the picture…' : 'Take or choose a picture'}</ShimmerButton></div>
      {state.text && <p role="status" className={cn('m-0 text-sm leading-snug', state.bad ? 'text-bad' : 'text-foreground')}>{state.text}</p>}
      <p className="m-0 text-xs text-muted-foreground">On a computer you can paste a screenshot instead. The picture is read once and not kept.</p>
    </CardContent></Card>
  );
}

export default function Live() {
  const { role, stats, profile } = useSession();
  const [bst, setB] = useSynced('live.' + role, BLANK, valid);
  const [armed, setArmed] = useState(false);
  const facts = factsOf(stats);
  const L = computeLive(bst, role, facts);
  const pool = champsFor(role), mains = (profile.mains || []).filter((m) => pool.includes(m));
  const quick = (mains.length ? mains : pool.slice(0, 4)).slice(0, 5);

  const patch = (p) => setB((b) => ({ ...b, ...p }));
  useEffect(() => { if (!bst.me && mains[0]) setB((b) => (b.me ? b : { ...b, me: mains[0] })); }, [bst.me, mains[0]]);   // start on the player's main

  const setRow = (kind, i, p) => setB((b) => ({ ...b, [kind]: b[kind].map((r, n) => (n === i ? { ...r, ...p } : r)) }));
  const goSec = (sec) => { patch({ sec }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleBought = (n) => setB((b) => ({ ...b, bought: b.bought.includes(n) ? b.bought.filter((x) => x !== n) : [...b.bought, n] }));
  const total = L.items.reduce((s, it) => s + gold(it.item), 0), left = L.items.reduce((s, it) => s + (it.got ? 0 : gold(it.item)), 0);
  const nextItem = L.items.find((it) => !it.got);
  function clear() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setB({ ...BLANK, me: bst.me }); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex flex-col gap-4">
      <datalist id="champ-list">{CN.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="my-champ-list">{pool.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="flex flex-col gap-2">
        <Eyebrow>Live game helper</Eyebrow>
        <ContinuousTabs tabs={SECS} value={bst.sec} onChange={goSec} label="Live sections" />
      </div>
      {bst.clock && bst.sec !== 'track' && <MiniBar bst={bst} onOpen={() => goSec('track')} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={bst.sec} initial={{ opacity: 0, x: 20, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, ...SHARP }} exit={{ opacity: 0, x: -20, filter: 'blur(6px)' }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
          {bst.sec === 'teams' && (
            <Screen>
              <Rise><Lead>Fill the teams from a picture, or pick your champion and type the other nine, each in its lane row. Tap Fed on anyone who gets ahead during the game.</Lead></Rise>
              <Rise><Snap role={role} bst={bst} patch={patch} /></Rise>
              <Rise>
                <Card><CardContent className="flex flex-col gap-3">
                  <h3 className="m-0 text-lg font-bold tracking-tight">You, as {role}</h3>
                  <ChampInput id="me-champ" list="my-champ-list" value={bst.me} onChange={(me) => patch({ me, bought: [] })} placeholder={`Your ${role} champion`} label="Your champion" />
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((c) => {
                      const on = champOf(bst.me) === c;
                      return <motion.button key={c} type="button" whileTap={{ scale: 0.94 }} onClick={() => patch({ me: c, bought: [] })} aria-pressed={on}
                        className={cn('h-9 rounded-full px-3.5 text-sm font-semibold transition-colors', on ? 'bg-[#252528] text-[#EDEDEC] dark:bg-zinc-100 dark:text-zinc-950' : 'bg-secondary text-secondary-foreground')}>{c.replace(' & Willump', '')}</motion.button>;
                    })}
                  </div>
                  {L.champ && L.missing && <Lead className="text-sm">No {role} build on record for {L.champ}, so the build list is empty. The plan and tracker still work.</Lead>}
                  <AnimatePresence initial={false}>
                    {L.nunu && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                        <div className="flex flex-col gap-2 pt-1">
                          <Lead className="text-sm">{L.roleWhy}</Lead>
                          <ContinuousTabs tabs={[{ id: 'auto', label: 'Decide for me' }, { id: 'tank', label: 'Tank' }, { id: 'ap', label: 'AP' }]} value={bst.role} onChange={(v) => patch({ role: v })} label="Nunu build style" size="sm" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent></Card>
              </Rise>
              <Rise>
                <Card><CardContent className="flex flex-col gap-3">
                  <h3 className="m-0 text-lg font-bold tracking-tight">Your team</h3>
                  {bst.allies.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <ChampInput id={'ally-' + i} value={r.c} onChange={(c) => setRow('allies', i, { c })} placeholder={'Teammate: ' + ALLY_ROWS[role][i]} label={'Teammate ' + (i + 1)} />
                      <Fed on={!!r.f} tone="good" onClick={() => setRow('allies', i, { f: r.f ? 0 : 1 })} label={`Teammate ${i + 1} is fed`} />
                    </div>
                  ))}
                </CardContent></Card>
              </Rise>
              <Rise>
                <Card><CardContent className="flex flex-col gap-3">
                  <h3 className="m-0 text-lg font-bold tracking-tight">Enemy team</h3>
                  {bst.rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <ChampInput id={'enemy-' + i} value={r.c} onChange={(c) => setRow('rows', i, { c })} placeholder={'Enemy: ' + ENEMY_ROWS[i]} label={'Enemy champion ' + (i + 1)} />
                      <select id={'rune-' + i} value={r.r} onChange={(e) => setRow('rows', i, { r: e.target.value })} aria-label={`Enemy ${i + 1} main rune`}
                        className={cn('h-11 w-full min-w-0 rounded-xl border border-input bg-card px-2 text-sm dark:bg-input/30', !r.r && 'text-muted-foreground')}>
                        <option value="">Rune (optional)</option>
                        {RUNES.map((x) => <option key={x}>{x}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      <Fed on={!!r.f} tone="bad" onClick={() => setRow('rows', i, { f: r.f ? 0 : 1 })} label={`Enemy ${i + 1} is fed`} />
                    </div>
                  ))}
                </CardContent></Card>
              </Rise>
              <Rise><ShimmerButton onClick={() => goSec('track')}>Go to the tracker <ArrowRight size={18} /></ShimmerButton></Rise>
            </Screen>
          )}
          {bst.sec === 'track' && <Track bst={bst} patch={patch} role={role} facts={facts} />}
          {bst.sec === 'build' && (
            <Screen>
              <Rise>
                <Card><CardContent className="flex flex-col gap-3.5" aria-live="polite">
                  <Eyebrow>{L.title}</Eyebrow>
                  {!L.champ ? <Lead className="text-sm">Pick your champion on the Teams tab and the build shows up here.</Lead> : L.F.n ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex h-3 gap-0.5" role="img" aria-label={`Their damage: ${L.pp}% physical, ${100 - L.pp}% magic`}>
                        <motion.i className="block h-full rounded-[3px] bg-s2" initial={false} animate={{ flexGrow: Math.max(L.pp, 1) }} transition={spring} />
                        <motion.i className="block h-full rounded-[3px] bg-s1" initial={false} animate={{ flexGrow: Math.max(100 - L.pp, 1) }} transition={spring} />
                      </div>
                      <Lead className="text-sm">Their damage: about <Num value={L.pp} />% physical, <Num value={100 - L.pp} />% magic{L.F.n < 5 ? ` (${L.F.n} of 5 entered)` : ''}.</Lead>
                    </div>
                  ) : <Lead className="text-sm">No enemies entered yet, so this is the standard build. Add champions to adjust it.</Lead>}
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    <AnimatePresence initial={false} mode="popLayout">
                      {L.items.map((it, i) => {
                        const isNext = it === nextItem;
                        return (
                          <motion.li key={it.item} layout initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, ...SHARP }} exit={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                            className={cn('grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl p-2.5 transition-colors', isNext ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-muted/60')}>
                            <span className={cn('grid size-7 place-items-center rounded-lg text-sm font-bold', it.got ? 'bg-good-soft text-good' : isNext ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-foreground/10')}>{it.got ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                            <span className="min-w-0">
                              {isNext && <span className="tnum block text-[11px] font-bold tracking-wider text-primary-foreground/80 uppercase dark:text-primary">Buy next · {gold(it.item).toLocaleString()} gold</span>}
                              <span className={cn('block text-base leading-tight font-semibold', it.got && 'text-muted-foreground line-through')}>{it.item}</span>
                              <span className={cn('mt-0.5 block text-sm leading-snug text-muted-foreground', it.got && 'opacity-60')}>{it.why}</span>
                            </span>
                            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={(e) => { if (!it.got) burst(e, 'lime', 16); toggleBought(it.item); }} aria-pressed={!!it.got} aria-label={(it.got ? 'Bought: ' : 'Mark as bought: ') + it.item}
                              className={cn('tnum h-9 min-w-14 rounded-lg border px-2 text-xs font-semibold transition-colors', it.got ? 'border-good bg-good-soft text-good' : 'bg-card text-muted-foreground dark:bg-input/30')}>{it.got ? 'Got' : gold(it.item).toLocaleString()}</motion.button>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ol>
                  {L.items.length > 0 && <Lead className="text-sm">{L.starter.length ? `Start with ${L.starter.join(' and ')}. ` : ''}Tap a price when you buy that item. Full build <Num value={total} /> gold{left < total ? <>, <Num value={left} /> still to buy</> : ''}. Items you haven't bought can change when someone gets fed.</Lead>}
                </CardContent></Card>
              </Rise>
              {L.plan.length > 0 && (
                <Rise>
                  <Card><CardContent className="flex flex-col gap-2.5">
                    <h3 className="m-0 text-lg font-bold tracking-tight">Game plan</h3>
                    <AnimatePresence initial={false} mode="popLayout">
                      {L.plan.map(([head, text]) => (
                        <motion.div key={head} layout initial={{ opacity: 0, x: -16, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, ...SHARP }} exit={{ opacity: 0, x: 16, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          className={cn('rounded-xl px-3.5 py-3', /is fed$|behind$/.test(head) ? 'bg-bad-soft' : /ahead$/.test(head) ? 'bg-good-soft' : 'bg-muted/60')}>
                          <div className="mb-1 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{head}</div>
                          {head === 'Gank first' && L.ganks.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {L.ganks.map((x, i) => {
                                const skip = x.sc < 0.6, why = skip ? x.bad.concat(x.good.length ? ['even though ' + x.good[0]] : []) : x.good.concat(x.bad.length ? ['but ' + x.bad[0]] : []);
                                const line = why.length ? why.join(', ') + '.' : 'Nothing stands out.';
                                return (
                                  <motion.div key={x.lane} layout transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="grid grid-cols-[28px_1fr] items-start gap-2.5">
                                    <span className={cn('grid size-7 place-items-center rounded-lg text-sm font-bold', skip ? 'bg-card text-muted-foreground ring-1 ring-foreground/10' : i === 0 ? 'bg-primary text-primary-foreground' : 'bg-card ring-1 ring-foreground/10')}>{skip ? '–' : i + 1}</span>
                                    <span className="text-[15px] leading-snug"><b className="font-semibold">{skip ? 'Skip ' + x.lane.toLowerCase() : x.lane}.</b> {line.charAt(0).toUpperCase() + line.slice(1)}</span>
                                  </motion.div>
                                );
                              })}
                              <p className="m-0 text-sm text-muted-foreground">Still check the wave first: only go when the enemy is pushed past the middle of the lane.</p>
                            </div>
                          ) : (
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.p key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="m-0 text-[15px] leading-snug">{text || 'Type each champion in its lane row on both teams and this ranks the lanes for you.'}</motion.p>
                            </AnimatePresence>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </CardContent></Card>
                </Rise>
              )}
              {L.notes.length > 0 && (
                <Rise>
                  <Card><CardContent className="flex flex-col gap-2.5">
                    <h3 className="m-0 text-lg font-bold tracking-tight">Also do this</h3>
                    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
                      <AnimatePresence initial={false}>{L.notes.map((n) => <motion.li key={n} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{n}</motion.li>)}</AnimatePresence>
                    </ul>
                  </CardContent></Card>
                </Rise>
              )}
            </Screen>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="flex flex-col gap-2.5">
        <Button variant={armed ? 'destructive' : 'ghost'} size="lg" onClick={clear}><RotateCcw /> {armed ? 'Tap again to clear everything' : 'New game: clear teams, clock and tracker'}</Button>
        <p className="m-0 text-xs text-muted-foreground">Standard builds and item prices are from OP.GG ({BUILDS.pulled}, ranked). The rules that adjust the build and the plan, and each champion's tags, were written by Claude, so treat this as a strong starting point. Objective timers use Season 2026 times: dragon 5:00 then every 5:00, Voidgrubs 8:00, Herald 15:00, Baron 20:00 then every 6:00.</p>
      </div>
    </div>
  );
}
