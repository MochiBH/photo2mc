import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerButton } from '../wm/shimmer-button';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn } from '../wm/utils';
import { Callout, Eyebrow, Lead, Num, Rise, Screen } from '../ui';
import { useApp } from '../store';
import { KEYS } from '../lib/legacy';

let BANK = [];
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const locked = (st, q) => { const r = st.q[q.id]; return !!(r && r.ok > 0 && r.miss === 0); };
function pool(st, d) {
  if (d === 'all') return BANK;
  if (d === 'missed') return BANK.filter((q) => st.q[q.id] && st.q[q.id].miss > 0);
  return BANK.filter((q) => q.tags.includes(d));
}
function pick(st, deck, lastId) {
  const p = pool(st, deck);
  if (!p.length) return null;
  const notLast = p.length > 1 ? p.filter((q) => q.id !== lastId) : p;
  const due = notLast.filter((q) => { const r = st.q[q.id]; return r && r.miss > 0 && r.due <= st.n; });
  if (due.length) return rand(due);
  const unseen = notLast.filter((q) => !st.q[q.id]);
  if (unseen.length) return rand(unseen);
  const pending = notLast.filter((q) => st.q[q.id] && st.q[q.id].miss > 0);
  if (deck === 'missed' && pending.length) return rand(pending);
  const ranked = notLast.slice().sort((a, b) => { const ra = st.q[a.id] || { ok: 0, bad: 0 }, rb = st.q[b.id] || { ok: 0, bad: 0 }; return ra.ok - ra.bad * 2 - (rb.ok - rb.bad * 2); });
  return rand(ranked.slice(0, Math.min(6, ranked.length)));
}

export default function Drills() {
  const { st, setSt, quiz, setQuiz, go, course } = useApp();
  BANK = course.bank;
  const DECKS = course.decks, TAGNAME = course.tagName;
  const [deck, setDeck] = useState(course.first);
  const [run, setRun] = useState(null);      // a fixed set: lesson check or matchup lab {label, questions, i, right, ...}
  const [cur, setCur] = useState(null);
  const [order, setOrder] = useState([]);
  const [answered, setAnswered] = useState(null);
  const [finished, setFinished] = useState(null);

  const show = (q) => { setCur(q); setAnswered(null); setOrder(q ? shuffle(q.opts.map((_, i) => i)) : []); };
  useEffect(() => {
    if (quiz) { setRun({ ...quiz, i: 0, right: 0 }); setFinished(null); show(quiz.questions[0]); setQuiz(null); }
    else if (!cur && !run && !finished) show(pick(st, deck, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  function answer(oi) {
    if (!cur || answered !== null) return;
    setAnswered(oi);
    const ok = oi === (cur.a ?? 0);
    if (run && ok) setRun((r) => ({ ...r, right: r.right + 1 }));
    setSt((s) => {
      const n = s.n + 1, q = { ...s.q };
      if (!cur.lab) {
        const r = { ok: 0, bad: 0, miss: 0, due: 0, ...(q[cur.id] || {}) };
        if (ok) { r.ok++; if (r.miss > 0) { r.miss--; r.due = n + 5; } } else { r.bad++; r.miss = 2; r.due = n + 3; }
        q[cur.id] = r;
      }
      return { ...s, n, q, right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1), streak: ok ? s.streak + 1 : 0 };
    });
  }
  function next() {
    if (run) {
      const i = run.i + 1;
      if (i >= run.questions.length) {
        if (run.type === 'lesson') { setSt((s) => ({ ...s, lessons: { ...s.lessons, [run.lessonId]: true } })); setFinished(run); setCur(null); setRun(null); return; }
        setRun(null); show(pick(st, deck, cur && cur.id)); return;
      }
      setRun({ ...run, i }); show(run.questions[i]); return;
    }
    show(pick(st, deck, cur && cur.id));
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('select,input,textarea')) return;
      const i = KEYS.indexOf(e.key.toUpperCase());
      if (i > -1 && cur && answered === null && order[i] !== undefined) answer(order[i]);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const total = st.right + st.wrong;
  const decks = useMemo(() => DECKS.map(([id, name]) => { const p = pool(st, id); return { id, label: name, count: id === 'missed' ? p.length : p.filter((q) => locked(st, q)).length + '/' + p.length }; }), [st, DECKS]);
  const rec = cur ? st.q[cur.id] : null;
  const again = !run && rec && rec.miss > 0 && answered === null;
  const correct = cur ? cur.a ?? 0 : 0;

  return (
    <Screen>
      <Rise className="grid grid-cols-3 gap-2.5">
        {[['Streak', <Num key="s" value={st.streak} />], ['Accuracy', total ? <Num key="a" value={Math.round((st.right / total) * 100)} suffix="%" /> : '–'], ['Locked in', <span key="l"><Num value={BANK.filter((q) => locked(st, q)).length} /><span className="text-base text-muted-foreground">/{BANK.length}</span></span>]].map(([label, val]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-2xl bg-card px-3.5 py-3 ring-1 ring-foreground/10">
            <b className="text-2xl leading-tight font-extrabold tracking-tight">{val}</b>
            <span className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{label}</span>
          </div>
        ))}
      </Rise>
      <Rise>
        <ContinuousTabs tabs={decks} value={run ? null : deck} onChange={(d) => { setDeck(d); setRun(null); setFinished(null); show(pick(st, d, null)); }} label="Decks" size="sm" />
      </Rise>
      <Rise>
        <Card className="overflow-hidden">
          <CardContent>
            <AnimatePresence mode="wait" initial={false}>
              {finished ? (
                <motion.div key="fin" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3.5">
                  <Eyebrow>Lesson {finished.idx + 1} complete</Eyebrow>
                  <h2 className="m-0 text-xl leading-snug font-bold tracking-tight">{finished.right} of {finished.questions.length} right on “{finished.title}”.</h2>
                  <Callout label="Take this into your next game">{finished.rule}</Callout>
                  {finished.right < finished.questions.length && <Lead className="text-sm">The ones you missed will come back in the Missed deck.</Lead>}
                  <ShimmerButton onClick={() => { setFinished(null); go('learn'); }}>Back to lessons</ShimmerButton>
                  <Button variant="outline" size="lg" onClick={() => { setFinished(null); show(pick(st, deck, null)); }}>Keep drilling</Button>
                </motion.div>
              ) : !cur ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Lead>{deck === 'missed' ? 'Nothing to review. Miss a question and it shows up here until you get it right twice.' : 'No questions in this deck.'}</Lead>
                </motion.div>
              ) : (
                <motion.div
                  key={cur.id + ':' + (run ? run.i : st.n - (answered !== null ? 1 : 0))}
                  initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -28, filter: 'blur(6px)' }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow>{run ? `${run.label} · ${run.i + 1} of ${run.questions.length}` : cur.tags.map((t) => TAGNAME[t] || t).join(' · ')}</Eyebrow>
                    {again && <span className="text-[11px] font-bold tracking-wide text-gold uppercase">Back for another try</span>}
                  </div>
                  <h2 className="m-0 text-[19px] leading-snug font-semibold tracking-tight text-pretty">{cur.q}</h2>
                  <div className="flex flex-col gap-2">
                    {order.map((oi, i) => {
                      const isRight = answered !== null && oi === correct, isWrong = answered !== null && oi === answered && oi !== correct;
                      return (
                        <motion.button
                          key={oi}
                          type="button"
                          disabled={answered !== null}
                          onClick={() => answer(oi)}
                          initial={{ opacity: 0, y: 10 }}
                          animate={isWrong ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : isRight ? { opacity: 1, y: 0, scale: [1, 1.03, 1] } : { opacity: answered !== null ? 0.5 : 1, y: 0 }}
                          transition={{ delay: answered === null ? 0.06 + i * 0.05 : 0, duration: 0.35 }}
                          whileTap={answered === null ? { scale: 0.98 } : undefined}
                          className={cn(
                            'grid min-h-14 w-full grid-cols-[36px_1fr] items-start gap-3 rounded-xl border bg-muted/60 p-3 text-left transition-colors',
                            isRight && 'border-good bg-good-soft', isWrong && 'border-bad bg-bad-soft',
                          )}
                        >
                          <kbd className={cn('grid h-8 w-9 place-items-center rounded-lg border bg-card font-sans text-sm font-bold', isRight && 'border-good text-good', isWrong && 'border-bad text-bad')}>
                            {isRight ? <Check size={16} strokeWidth={3} /> : isWrong ? <X size={16} strokeWidth={3} /> : KEYS[i]}
                          </kbd>
                          <span className="pt-1 text-[15px] leading-snug">
                            {cur.opts[oi]}
                            {(isRight || isWrong) && <span className={cn('mt-1 block text-[11px] font-bold tracking-wider uppercase', isRight ? 'text-good' : 'text-bad')}>{isRight ? 'Best play' : 'Your pick'}</span>}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <AnimatePresence>
                    {answered !== null && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="overflow-hidden">
                        <div className="flex flex-col gap-3 pt-0.5">
                          <Callout label={answered === correct ? 'Correct' : 'Not this time'} tone={answered === correct ? 'primary' : 'bad'}><span className="font-normal">{cur.why}</span></Callout>
                          <ShimmerButton onClick={next}>{run && run.i + 1 >= run.questions.length ? 'Finish' : 'Next question'}</ShimmerButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </Rise>
    </Screen>
  );
}
