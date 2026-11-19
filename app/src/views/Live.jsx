import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Flame, MessageCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { Input } from '../wm/input';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn, spring } from '../wm/utils';
import { Eyebrow, Lead, Num, Rise, Screen } from '../ui';
import { useApp, useLocal } from '../store';
import {
  BD, BSTORE, CN, RUNES, allyFeatures, buildKha, buildNotes, buildNunu, champOf, gamePlan, gankOrder, norm, nunuRole, setBst, teamFeatures, withBought,
} from '../lib/legacy';

const BLANK = { me: 'Nunu', role: 'auto', state: 'even', allies: [0, 1, 2, 3].map(() => ({ c: '', f: 0 })), rows: [0, 1, 2, 3, 4].map(() => ({ c: '', r: '', f: 0 })), bought: [] };
const valid = (v) => v && Array.isArray(v.rows) && v.rows.length === 5 && Array.isArray(v.allies) && v.allies.length === 4 && Array.isArray(v.bought);
const ALLY_PH = ['Top', 'Mid', 'Bot', 'Support'], ENEMY_PH = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

function Fed({ on, onClick, tone, label }) {
  return (
    <motion.button
      type="button" onClick={onClick} aria-pressed={on} aria-label={label} whileTap={{ scale: 0.88 }}
      animate={{ scale: on ? [1, 1.15, 1] : 1 }} transition={{ duration: 0.3 }}
      className={cn('flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] font-bold tracking-wider uppercase transition-colors',
        on ? (tone === 'good' ? 'border-good bg-good text-background' : 'border-bad bg-bad text-background') : 'bg-card text-muted-foreground dark:bg-input/30')}
    >
      <Flame size={14} strokeWidth={2.5} />Fed
    </motion.button>
  );
}
function ChampInput({ id, value, onChange, placeholder, label }) {
  const bad = !!norm(value) && !champOf(value);
  return <Input id={id} list="champ-list" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} aria-invalid={bad} autoComplete="off" autoCapitalize="words" spellCheck={false} />;
}

export default function Live() {
  const { askCoach } = useApp();
  const [bst, setB] = useLocal(BSTORE, BLANK, valid);
  const [armed, setArmed] = useState(false);
  setBst(bst);

  const patch = (p) => setB((b) => ({ ...b, ...p }));
  const setRow = (kind, i, p) => setB((b) => ({ ...b, [kind]: b[kind].map((r, n) => (n === i ? { ...r, ...p } : r)) }));
  const F = teamFeatures(), A = allyFeatures(), role = nunuRole(A), tank = bst.me === 'Nunu' && role.tank;
  const items = withBought(bst.me === "Kha'Zix" ? buildKha(F, A) : buildNunu(F, A, tank));
  const ganks = gankOrder();
  const plan = gamePlan(F, A, tank), notes = buildNotes(F, A, tank, items);
  const pp = Math.round(F.ps * 100);
  const total = items.reduce((s, it) => s + (BD.gold[it.item] || 0), 0), left = items.reduce((s, it) => s + (it.got ? 0 : BD.gold[it.item] || 0), 0);
  const nextItem = items.find((it) => !it.got);
  const title = (bst.me === "Kha'Zix" ? "Kha'Zix" : tank ? 'Tank Nunu' : 'AP Nunu') + (F.n ? ' against ' + F.list.join(', ') : ' · standard build');

  function toggleBought(n) { setB((b) => ({ ...b, bought: b.bought.includes(n) ? b.bought.filter((x) => x !== n) : [...b.bought, n] })); }
  function ask() {
    const who = bst.me === "Kha'Zix" ? "Kha'Zix" : tank ? 'tank Nunu' : 'AP Nunu';
    const mates = bst.allies.map((r) => { const n = champOf(r.c); return n ? n + (r.f ? ' [fed]' : '') : null; }).filter(Boolean);
    const foes = bst.rows.map((r) => { const n = champOf(r.c); return n ? n + (r.r ? ` (${r.r})` : '') + (r.f ? ' [fed]' : '') : null; }).filter(Boolean);
    askCoach(`I'm playing ${who}${mates.length ? ' with ' + mates.join(', ') : ''} against ${foes.length ? foes.join(', ') : 'an unknown team'}. I'm ${bst.state}. ${bst.bought.length ? 'I have ' + bst.bought.join(', ') + '. ' : ''}My helper says to build: ${items.filter((i) => !i.got).map((i) => i.item).join(', ')}. Would you change anything, and what should I do next?`);
  }
  function clear() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setB({ ...BLANK, me: bst.me }); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Screen>
      <datalist id="champ-list">{CN.map((n) => <option key={n} value={n} />)}</datalist>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Live game helper</Eyebrow>
        <Lead>Fill in all ten champions in champion select, each in its lane row. During the game, tap Fed on anyone who gets ahead and tick items as you buy them.</Lead>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-lg font-bold tracking-tight">Your team</h3>
              <ContinuousTabs tabs={[{ id: 'Nunu', label: 'Nunu' }, { id: "Kha'Zix", label: "Kha'Zix" }]} value={bst.me} onChange={(me) => patch({ me, bought: [] })} label="Your champion" size="sm" />
            </div>
            {bst.allies.map((r, i) => (
              <div key={i} className="flex gap-2">
                <ChampInput id={'ally-' + i} value={r.c} onChange={(c) => setRow('allies', i, { c })} placeholder={'Teammate: ' + ALLY_PH[i]} label={'Teammate ' + (i + 1)} />
                <Fed on={!!r.f} tone="good" onClick={() => setRow('allies', i, { f: r.f ? 0 : 1 })} label={`Teammate ${i + 1} is fed`} />
              </div>
            ))}
            <AnimatePresence initial={false}>
              {bst.me === 'Nunu' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                  <div className="flex flex-col gap-2 pt-1">
                    <Lead className="text-sm">{role.why}</Lead>
                    <ContinuousTabs tabs={[{ id: 'auto', label: 'Decide for me' }, { id: 'tank', label: 'Tank' }, { id: 'ap', label: 'AP' }]} value={bst.role} onChange={(v) => patch({ role: v })} label="Nunu build style" size="sm" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="m-0 text-lg font-bold tracking-tight">Enemy team</h3>
            {bst.rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <ChampInput id={'enemy-' + i} value={r.c} onChange={(c) => setRow('rows', i, { c })} placeholder={'Enemy: ' + ENEMY_PH[i]} label={'Enemy champion ' + (i + 1)} />
                <select id={'rune-' + i} value={r.r} onChange={(e) => setRow('rows', i, { r: e.target.value })} aria-label={`Enemy ${i + 1} main rune`}
                  className={cn('h-11 w-full min-w-0 rounded-xl border border-input bg-card px-2 text-sm dark:bg-input/30', !r.r && 'text-muted-foreground')}>
                  <option value="">Rune (optional)</option>
                  {RUNES.map((x) => <option key={x}>{x}</option>)}
                  <option value="Other">Other</option>
                </select>
                <Fed on={!!r.f} tone="bad" onClick={() => setRow('rows', i, { f: r.f ? 0 : 1 })} label={`Enemy ${i + 1} is fed`} />
              </div>
            ))}
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-base font-bold tracking-tight">Your game</h3>
            <ContinuousTabs tabs={[{ id: 'behind', label: 'Behind' }, { id: 'even', label: 'Even' }, { id: 'ahead', label: 'Ahead' }]} value={bst.state} onChange={(v) => patch({ state: v })} label="How your game is going" size="sm" />
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3.5" aria-live="polite">
            <Eyebrow>{title}</Eyebrow>
            {F.n ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex h-3 gap-0.5" role="img" aria-label={`Their damage: ${pp}% physical, ${100 - pp}% magic`}>
                  <motion.i className="block h-full rounded-[3px] bg-s2" initial={false} animate={{ flexGrow: Math.max(pp, 1) }} transition={spring} />
                  <motion.i className="block h-full rounded-[3px] bg-s1" initial={false} animate={{ flexGrow: Math.max(100 - pp, 1) }} transition={spring} />
                </div>
                <Lead className="text-sm">Their damage: about <Num value={pp} />% physical, <Num value={100 - pp} />% magic{F.n < 5 ? ` (${F.n} of 5 entered)` : ''}.</Lead>
              </div>
            ) : <Lead className="text-sm">No enemies entered yet, so this is the standard build. Add champions to adjust it.</Lead>}
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((it, i) => {
                  const isNext = it === nextItem;
                  return (
                    <motion.li
                      key={it.item} layout
                      initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className={cn('grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl p-2.5 transition-colors', isNext ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-muted/60')}
                    >
                      <span className={cn('grid size-7 place-items-center rounded-lg text-sm font-bold', it.got ? 'bg-good-soft text-good' : isNext ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-foreground/10')}>
                        {it.got ? <Check size={16} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        {isNext && <span className="tnum block text-[11px] font-bold tracking-wider text-primary-foreground/80 uppercase dark:text-primary">Buy next · {(BD.gold[it.item] || 0).toLocaleString()} gold</span>}
                        <span className={cn('block text-base leading-tight font-semibold', it.got && 'text-muted-foreground line-through')}>{it.item}</span>
                        <span className={cn('mt-0.5 block text-sm leading-snug text-muted-foreground', it.got && 'opacity-60')}>{it.why}</span>
                      </span>
                      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => toggleBought(it.item)} aria-pressed={!!it.got} aria-label={(it.got ? 'Bought: ' : 'Mark as bought: ') + it.item}
                        className={cn('tnum h-9 min-w-14 rounded-lg border px-2 text-xs font-semibold transition-colors', it.got ? 'border-good bg-good-soft text-good' : 'bg-card text-muted-foreground dark:bg-input/30')}>
                        {it.got ? 'Got' : (BD.gold[it.item] || 0).toLocaleString()}
                      </motion.button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
            <Lead className="text-sm">Start with Gustwalker Hatchling{bst.me === "Kha'Zix" ? ' and a Health Potion' : ''}. Tap a price when you buy that item. Full build <Num value={total} /> gold{left < total ? <>, <Num value={left} /> still to buy</> : ''}. Items you haven't bought can change when someone gets fed.</Lead>
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-2.5">
            <h3 className="m-0 text-lg font-bold tracking-tight">Game plan</h3>
            <AnimatePresence initial={false} mode="popLayout">
              {plan.map(([head, text]) => (
                <motion.div key={head} layout initial={{ opacity: 0, x: -16, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: 16, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={cn('rounded-xl px-3.5 py-3', /is fed$|behind$/.test(head) ? 'bg-bad-soft' : /ahead$/.test(head) ? 'bg-good-soft' : 'bg-muted/60')}>
                  <div className="mb-1 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{head}</div>
                  {head === 'Gank first' && ganks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {ganks.map((x, i) => {
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
                    <motion.p key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="m-0 text-[15px] leading-snug">{text}</motion.p>
                  </AnimatePresence>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>
      </Rise>

      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-2.5">
            <h3 className="m-0 text-lg font-bold tracking-tight">Also do this</h3>
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
              <AnimatePresence initial={false}>
                {notes.map((n) => <motion.li key={n} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{n}</motion.li>)}
              </AnimatePresence>
            </ul>
          </CardContent>
        </Card>
      </Rise>

      <Rise className="flex flex-col gap-2.5">
        <Button variant="outline" size="lg" onClick={ask}><MessageCircle /> Ask your coach about this game</Button>
        <Button variant={armed ? 'destructive' : 'ghost'} size="lg" onClick={clear}><RotateCcw /> {armed ? 'Tap again to clear both teams' : 'New game: clear everything'}</Button>
        <p className="m-0 text-xs text-muted-foreground">Item prices and the standard builds are from OP.GG ({BD.pulled}, ranked). The rules that adjust the build and the plan, and each champion's tags, were written by Claude, so treat this as a strong starting point and tell Claude when something looks wrong.</p>
      </Rise>
    </Screen>
  );
}
