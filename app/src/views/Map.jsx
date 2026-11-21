import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Card, CardContent } from '../wm/card';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { ShimmerProgress } from '../wm/shimmer-progress';
import { Callout, Eyebrow, Lead, Mark, Num, Rise, SHARP, Screen } from '../ui';
import { OBJS, WHEN, ZONE, clock, sgn } from '../lib/legacy';
import { TABS_FOR_STATS, checksFor, rec } from '../lib/roles';
import { insights, strengths } from '../lib/insights';
import { champName } from '../lib/champs';
import { useSession } from '../session';
import { GameRow, NoGames, shortDate } from './Games';
import { RiftBase } from './Rift';

const SECTIONS = [{ id: 'checks', label: 'Checkpoints' }, { id: 'leaks', label: 'Leaks' }, { id: 'charts', label: 'Charts' }];
const toTabs = (list) => list.map(([id, label]) => ({ id, label }));
const OBJ_SEG = [['s1', 'Your team took it'], ['s2', 'Enemy took it, you were dead'], ['s3', 'Enemy, you were alive but far away'], ['s4', 'Enemy, you were nearby']];

export default function MapView() {
  const [who, setWho] = useState('all');
  const [when, setWhen] = useState('all');
  const [sec, setSec] = useState('checks');
  const { stats: POS, role, statsAt } = useSession();
  if (!POS || !POS.games) return <NoGames role={role} />;
  const WHO = TABS_FOR_STATS(POS).map(([id, label]) => [id, champName(label)]);
  const view = POS.groups[who] ? who : 'all';
  const grp = POS.groups[view];
  const G = POS.list, checks = checksFor(POS, role), LEAKS = insights(POS), GOOD = strengths(POS);

  return (
    <div className="flex flex-col gap-4">
      <ContinuousTabs tabs={SECTIONS} value={sec} onChange={(v) => { setSec(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} label="Map sections" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sec} initial={{ opacity: 0, x: 20, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, ...SHARP }} exit={{ opacity: 0, x: -20, filter: 'blur(6px)' }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
    {sec === 'checks' && <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Three checkpoints that decide your games</Eyebrow>
        <Lead>From the Riot API, your last {POS.games} ranked {role} games. These are the three things that split your own wins from your own losses most cleanly, and they are re-picked as you play. It is a small sample, so treat them as targets, not laws.</Lead>
      </Rise>
      {checks.map((c, i) => {
        const hit = G.filter((g) => c.ok(g)), miss = G.filter((g) => !c.ok(g));
        return (
          <Rise key={c.name}>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div><Eyebrow>Checkpoint {i + 1}</Eyebrow><h3 className="m-0 mt-0.5 text-lg leading-tight font-bold tracking-tight">{c.name}</h3></div>
                  <div className="text-right leading-none whitespace-nowrap"><Num value={hit.length} className="text-3xl font-extrabold tracking-tight" /><span className="text-sm text-muted-foreground"> / {G.length}</span></div>
                </div>
                <ShimmerProgress value={(hit.length / G.length) * 100} label={`Hit in ${hit.length} of ${G.length} games`} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-good-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-good uppercase">When you hit it</div><div className="tnum text-lg font-bold">{hit.length ? rec(hit) : '–'}</div></div>
                  <div className="rounded-xl bg-bad-soft px-3 py-2"><div className="text-[11px] font-bold tracking-wider text-bad uppercase">When you miss it</div><div className="tnum text-lg font-bold">{miss.length ? rec(miss) : '–'}</div></div>
                </div>
                <Callout label="How">{c.how}</Callout>
              </CardContent>
            </Card>
          </Rise>
        );
      })}
      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Eyebrow>Game by game</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {G.map((g) => (
                <GameRow key={g.id} win={!!g.w} champ={champName(g.c)} sub={`${g.d} deaths`} date={shortDate(g.t)}>
                  {checks.map((c) => <Mark key={c.name} ok={c.ok(g)}>{c.chip(g)}</Mark>)}
                  {role === 'jungle' && g.gap10 !== null && <span className="tnum inline-flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-foreground/10">Farm at 10:00 {sgn(g.gap10)}</span>}
                </GameRow>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Rise>

    </Screen>}
    {sec === 'leaks' && <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Why you miss the checkpoints</Eyebrow>
        <Lead>{LEAKS.length ? 'Your biggest leaks right now, worked out from your own games. Each has the numbers behind it and one thing to do about it next game.' : 'Nothing stands out yet. This fills in once you have a few more ranked games on record.'}</Lead>
      </Rise>
      {LEAKS.map((l, i) => (
        <Rise key={l.title}>
          <Card>
            <CardContent className="flex flex-col gap-2.5">
              <Eyebrow>Leak {i + 1}</Eyebrow>
              <h3 className="m-0 text-lg leading-tight font-bold tracking-tight">{l.title}</h3>
              <p className="m-0 text-sm text-muted-foreground"><span className="tnum mr-1.5 text-3xl leading-none font-extrabold tracking-tight text-foreground">{l.big}</span>{l.unit}</p>
              <Lead className="text-sm">{l.detail}</Lead>
              <Callout label="Next game">{l.fix}</Callout>
            </CardContent>
          </Card>
        </Rise>
      ))}

      {GOOD.length > 0 && (
        <Rise>
          <Card><CardContent className="flex flex-col gap-2.5">
            <Eyebrow>What you already do well</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">{GOOD.map((g) => <li key={g} className="rounded-xl bg-good-soft px-3.5 py-2.5 text-[15px] leading-snug">{g}</li>)}</ul>
          </CardContent></Card>
        </Rise>
      )}
    </Screen>}
    {sec === 'charts' && <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>The charts behind it</Eyebrow>
        <ContinuousTabs tabs={toTabs(WHO)} value={view} onChange={setWho} label="Which games" size="sm" />
      </Rise>
      <Rise><Rift POS={POS} who={view} when={when} setWhen={setWhen} /></Rise>
      {role === 'jungle' ? <Rise><Farm POS={POS} who={view} WHO={WHO} /></Rise> : <Rise><Vision grp={grp} /></Rise>}
      <Rise><Objectives grp={grp} /></Rise>
      <Rise>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="m-0 text-lg font-bold tracking-tight">{role === 'jungle' ? 'Lane visits before 15:00' : 'Where your early kills and deaths happen'}</h3>
            <div className="overflow-x-auto">
              <table className="tnum w-full border-collapse text-sm">
                <thead><tr className="text-[11px] tracking-wider text-muted-foreground uppercase">{['Lane', 'Kills', 'Assists', 'Deaths', 'Empty min'].map((h, i) => <th key={h} className={`px-1.5 py-1 font-bold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {[['top_lane', 'Top'], ['mid_lane', 'Mid'], ['bot_lane', 'Bot']].map(([k, n]) => { const v = grp.ganks[k]; return (
                    <tr key={k} className="border-t"><td className="px-1.5 py-2 font-semibold">{n}</td><td className="px-1.5 text-right"><Num value={v[0]} /></td><td className="px-1.5 text-right"><Num value={v[1]} /></td><td className="px-1.5 text-right"><Num value={v[2]} /></td><td className="px-1.5 text-right">{v[4]} of {v[3]}</td></tr>
                  ); })}
                </tbody>
              </table>
            </div>
            <Lead className="text-sm">Empty minutes are once-a-minute snapshots where you stood in the lane with no kill or assist within a minute. Some mid ones are just you crossing the lane.</Lead>
          </CardContent>
        </Card>
      </Rise>
      <Rise><p className="m-0 text-xs text-muted-foreground">Riot API match timelines, updated {shortDate(statsAt)}. Showing {grp.games} games ({grp.record}). Positions are recorded once a minute, so who was near you is approximate. </p></Rise>
    </Screen>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Rift({ POS, who, when, setWhen }) {
  const [sel, setSel] = useState(null);
  const [zone, setZone] = useState(null);
  const ds = useMemo(() => POS.deaths.map((d, i) => ({ d, i })).filter(({ d }) =>
    (who === 'all' || (who === 'wins' && d[4] === 'W') || (who === 'losses' && d[4] === 'L') || d[5] === who) &&
    (when === 'all' || (when === 'early' ? d[2] < 15 : when === 'late' ? d[2] >= 15 : when === 'free' ? d[9] === 1 : d[10] === 1))), [POS, who, when]);
  const zones = useMemo(() => { const z = {}; ds.forEach(({ d }) => { z[d[3]] = (z[d[3]] || 0) + 1; }); return Object.entries(z).sort((a, b) => b[1] - a[1]); }, [ds]);
  const max = zones.length ? zones[0][1] : 1;
  const alone = ds.filter(({ d }) => d[6] === 0).length, outn = ds.filter(({ d }) => d[6] > 0 && d[7] > d[6] + 1).length, took = ds.filter(({ d }) => d[8]).length;
  const cur = sel !== null && ds.some((x) => x.i === sel) ? POS.deaths[sel] : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">Every death, on the map</h3>
        <ContinuousTabs tabs={toTabs(WHEN)} value={when} onChange={setWhen} label="Which deaths" size="sm" />
        <RiftBase label={`Map of Summoner's Rift with ${ds.length} deaths marked`} under={<>
          {/* The heat glow is a blur, so it is drawn once and the whole layer fades in (.rift-under); only later changes fade spot by spot. */}
          <defs><filter id="rift-heat" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4.5" /></filter></defs>
          <g filter="url(#rift-heat)">
            <AnimatePresence initial={false}>
              {ds.map(({ d, i }) => (
                <motion.circle key={i} cx={d[0] / 100} cy={148 - d[1] / 100} r="6.5" fill="var(--bad)" initial={{ opacity: 0 }} animate={{ opacity: zone && d[3] !== zone ? 0 : 0.16 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
              ))}
            </AnimatePresence>
          </g>
        </>}>
          <AnimatePresence>
            {ds.slice().sort((a, b) => (a.d[8] ? 1 : 0) - (b.d[8] ? 1 : 0)).map(({ d, i }, n) => {
              const dim = zone && d[3] !== zone;
              return (
                <motion.circle
                  key={i}
                  cx={d[0] / 100} cy={148 - d[1] / 100}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: sel === i ? 3.4 : 2, opacity: dim ? 0.12 : 1 }}
                  exit={{ r: 0, opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18, delay: sel === i ? 0 : Math.min(n * 0.006, 0.6) }}
                  fill={sel === i ? 'var(--foreground)' : 'var(--bad)'} fillOpacity={sel === i ? 1 : d[8] ? 1 : 0.78}
                  stroke={d[8] ? 'var(--gold)' : 'var(--card)'} strokeWidth={d[8] ? 1.1 : 0.6}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSel(i)} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setSel(i); }}
                />
              );
            })}
          </AnimatePresence>
          {sel !== null && cur && (
            <motion.circle key={'ring' + sel} cx={cur[0] / 100} cy={148 - cur[1] / 100} fill="none" stroke="var(--foreground)" strokeWidth=".7" initial={{ r: 3, opacity: 0.9 }} animate={{ r: 9, opacity: 0 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }} />
          )}
        </RiftBase>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          <span><i className="mr-1.5 inline-block size-2.5 rounded-full bg-bad align-[-1px]" />Death</span>
          <span><i className="mr-1.5 inline-block size-2.5 rounded-full bg-bad align-[-1px] ring-2 ring-gold" />Enemy took an objective right after</span>
        </div>
        <div className="min-h-[44px] text-sm" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={cur ? sel : 'none'} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, ...SHARP }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className={`m-0 ${cur ? '' : 'text-muted-foreground'}`}>
              {cur ? <>
                <b>{champName(cur[5])}, {cur[4] === 'W' ? 'win' : 'loss'}, {clock(cur[2])}</b> · {ZONE[cur[3]] || cur[3]} · {cur[6] === 0 ? 'no teammate near' : `${cur[6]} ${cur[6] === 1 ? 'teammate' : 'teammates'} near`}, {cur[7]} {cur[7] === 1 ? 'enemy' : 'enemies'}
                {cur[8] ? ` · the enemy took ${cur[8] === 'voidgrub' ? 'Voidgrubs' : cur[8] === 'baron' ? 'Baron' : cur[8] === 'herald' ? 'the Herald' : 'a dragon'} right after` : ''}
                {cur[9] ? ' · free death' : ' · an enemy died too'}{cur[10] ? ' · within 90 seconds of respawning' : ''}
              </> : ds.length ? 'Tap a dot to see that death, or a zone below to light up just that area. A free death is one where no enemy died in the same fight.' : 'No deaths in this selection.'}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {zones.map(([k, v]) => (
              <motion.button type="button" key={k} layout initial={{ opacity: 0 }} animate={{ opacity: zone && zone !== k ? 0.45 : 1 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.98 }} onClick={() => setZone(zone === k ? null : k)} aria-pressed={zone === k}
                className={`grid min-h-9 grid-cols-[104px_1fr_28px] items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors ${zone === k ? 'bg-muted' : ''}`}>
                <span>{ZONE[k] || k}</span>
                <span className="h-3"><motion.i className="block h-full min-w-[3px] rounded-r-[4px] bg-bad" initial={{ width: 0 }} animate={{ width: (v / max) * 100 + '%' }} transition={{ type: 'spring', stiffness: 140, damping: 20 }} /></span>
                <b className="tnum text-right font-semibold"><Num value={v} /></b>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        {ds.length > 0 && <Lead className="text-sm">{ds.length} deaths. Alone: {alone}. Outnumbered: {outn}. In a fight with teammates near: {ds.length - alone - outn}. Followed by an enemy objective within 90 seconds: {took}.</Lead>}
      </CardContent>
    </Card>
  );
}

const FX = (m) => 30 + (m / 20) * 270, FY = (v) => 14 + ((5 - v) / 30) * 136;
function Farm({ POS, who, WHO }) {
  const [min, setMin] = useState(10);
  const g = POS.groups;
  const series = [['Wins', 'var(--good)', g.wins.gap], ['Losses', 'var(--bad)', g.losses.gap]];
  if (!['all', 'wins', 'losses'].includes(who)) series.push([champName(who), 'var(--gold)', g[who].gap]);
  const grp = g[who], name = WHO.find((w) => w[0] === who)[1];
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); setMin(Math.max(0, Math.min(20, Math.round((((e.clientX - r.left) / r.width) * 320 - 30) / 270 * 20)))); };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">The farm race against the enemy jungler</h3>
        <Lead className="text-sm">Your jungle CS minus theirs, minute by minute. Below the line means you are behind. One camp is about 4.</Lead>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {series.map((s) => <span key={s[0]}><i className="mr-1.5 inline-block size-2.5 rounded-full align-[-1px]" style={{ background: s[1] }} />{s[0]}</span>)}
        </div>
        <svg viewBox="0 0 320 172" role="img" aria-label="Jungle CS gap to the enemy jungler by minute" className="block h-auto w-full touch-pan-y" onPointerMove={move} onPointerDown={move}>
          {[0, -10, -20].map((v) => <g key={v}><line x1="30" x2="300" y1={FY(v)} y2={FY(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1.4 : 0.8} /><text x="25" y={FY(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{sgn(v)}</text></g>)}
          {[0, 5, 10, 15, 20].map((m) => <text key={m} x={FX(m)} y="166" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{m}:00</text>)}
          <text x="300" y={FY(0) - 5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">level with the enemy jungler</text>
          <motion.line y1="10" y2="152" stroke="var(--muted-foreground)" strokeWidth=".8" strokeDasharray="3 3" initial={false} animate={{ x1: FX(min), x2: FX(min) }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
          {series.map((s, i) => (
            <g key={s[0]}>
              <motion.path fill="none" stroke={s[1]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" d={'M' + s[2].map((v, m) => FX(m) + ' ' + FY(v).toFixed(1)).join(' L')}
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.1, delay: 0.15 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} />
              <motion.circle r="4" fill={s[1]} stroke="var(--card)" strokeWidth="2" initial={false} animate={{ cx: FX(min), cy: FY((s[2][min] ?? 0)) }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            </g>
          ))}
        </svg>
        <p className="m-0 min-h-[42px] text-sm" aria-live="polite">Minute {min}: {series.map((s) => `${s[0].toLowerCase()} ${sgn((s[2][min] ?? 0))}`).join(', ')} jungle CS against the enemy jungler.</p>
        <div className="overflow-x-auto">
          <table className="tnum w-full border-collapse text-sm">
            <caption className="pb-1 text-left text-muted-foreground">{name}: you / enemy jungler</caption>
            <thead><tr className="text-[11px] tracking-wider text-muted-foreground uppercase">{['At', 'Jungle CS', 'Gold', 'Level'].map((h, i) => <th key={h} className={`px-1.5 py-1 font-bold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody>{Object.keys(grp.farm).map((k) => { const r = grp.farm[k]; return (
              <tr key={k} className="border-t"><td className="px-1.5 py-2 font-semibold">{k}:00</td><td className="px-1.5 text-right">{Math.round(r.jcs[0])} / {Math.round(r.jcs[1])}</td><td className="px-1.5 text-right">{r.gold[0].toLocaleString()} / {r.gold[1].toLocaleString()}</td><td className="px-1.5 text-right">{r.level[0]} / {r.level[1]}</td></tr>
            ); })}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Objectives({ grp }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3.5">
        <h3 className="m-0 text-lg font-bold tracking-tight">Who took each objective, and where you were</h3>
        <Lead className="text-sm">Where you were in the minute before it fell. Voidgrubs are counted one by one.</Lead>
        <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {OBJ_SEG.map(([c, label]) => <span key={c}><i className="mr-1.5 inline-block size-2.5 rounded-[3px] align-[-1px]" style={{ background: `var(--${c})` }} />{label}</span>)}
        </div>
        {OBJS.map(([k, name]) => {
          const mine = (grp.obj[k + '_mine'] || [0])[0], e = grp.obj[k + '_enemy'] || [0, 0, 0, 0];
          const parts = [mine, e[0] - e[1], e[1] - e[2], e[2]], tot = mine + e[0];
          if (!tot) return null;
          return (
            <div key={k} className="flex flex-col gap-1.5">
              <div className="text-[15px] font-semibold">{name} <span className="tnum text-[13px] font-normal text-muted-foreground">· enemy took {e[0]} of {tot}</span></div>
              <div className="flex h-4 gap-0.5" role="img" aria-label={`${name}: your team ${mine}, enemy ${e[0]}`}>
                {parts.map((n, i) => <motion.i key={i} className="block h-full rounded-[3px]" style={{ background: `var(--${OBJ_SEG[i][0]})` }} initial={{ flexGrow: 0 }} animate={{ flexGrow: n, minWidth: n ? 3 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.06 }} />)}
              </div>
              <div className="tnum text-[13px] text-muted-foreground">Yours {parts[0]} · you were dead {parts[1]} · alive but far {parts[2]} · nearby {parts[3]}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Vision({ grp }) {
  const v = grp.vision, n = grp.games;
  const tiles = [['Vision score', v.score, v.rival_score ? `enemy support ${v.rival_score}` : 'a game'], ['Per minute', v.per_min, 'aim for 1.5 or more'], ['Control wards', (v.control / n).toFixed(1), 'bought a game'], ['Wards placed', v.placed, 'a game'], ['Wards cleared', v.killed, 'a game'], ['In kills', grp.kp + '%', "of your team's kills"]];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">Vision and presence</h3>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(([label, val, sub]) => (
            <div key={label} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
              <div className="tnum text-2xl font-extrabold tracking-tight">{val}</div>
              <div className="text-[13px] text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
