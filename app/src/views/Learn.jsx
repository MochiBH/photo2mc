import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, ChevronRight, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { ShimmerButton } from '../wm/shimmer-button';
import { TickProgress } from '../wm/tick-progress';
import { cn } from '../wm/utils';
import { Callout, Eyebrow, Lead, Rise, Screen } from '../ui';
import { useApp } from '../store';
import { RULES } from '../lib/legacy';

const LESSONS = window.LESSONS || [];
const BANK = (window.LEAKS || []).concat(window.BANK || []);
const QBY = Object.fromEntries(BANK.map((q) => [q.id, q]));

export default function Learn() {
  const { st, setSt, askCoach, startQuiz } = useApp();
  const [open, setOpen] = useState(null);
  const done = LESSONS.filter((l) => st.lessons[l.id]).length;
  const next = LESSONS.findIndex((l) => !st.lessons[l.id]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open === null ? (
        <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
          <Screen>
            <Rise>
              <Card>
                <CardContent className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <Eyebrow>Your three rules</Eyebrow>
                    <TickProgress value={done} total={LESSONS.length} label={`${done} of ${LESSONS.length} lessons done`} />
                  </div>
                  <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {RULES.map((r, i) => (
                      <li key={r.name} className="grid grid-cols-[28px_1fr] items-start gap-3 text-[15px] leading-snug">
                        <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                        <span><strong className="font-semibold">{r.name}.</strong> <span className="text-muted-foreground">{r.how}</span></span>
                      </li>
                    ))}
                  </ol>
                  <Lead className="text-sm">
                    {next >= 0 ? <>Next up: <span className="font-medium text-foreground">{LESSONS[next].title}</span>.</> : 'Course complete. Keep the drills warm.'}
                  </Lead>
                </CardContent>
              </Card>
            </Rise>
            {LESSONS.map((l, i) => {
              const isDone = !!st.lessons[l.id];
              const head = i === 0 || LESSONS[i - 1].part !== l.part;
              return (
                <Rise key={l.id} className="flex flex-col gap-2">
                  {head && <Eyebrow className="mt-2">{l.part}</Eyebrow>}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setOpen(i); window.scrollTo(0, 0); }}
                    className={cn(
                      'grid min-h-16 w-full grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-md',
                      i === next && 'ring-2 ring-primary',
                    )}
                  >
                    <span className={cn('grid size-9 place-items-center rounded-xl text-sm font-bold', isDone ? 'bg-good-soft text-good' : i === next ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {isDone ? <Check size={18} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base leading-tight font-semibold tracking-tight">{l.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{l.hook}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </motion.button>
                </Rise>
              );
            })}
            <Rise><Reset /></Rise>
          </Screen>
        </motion.div>
      ) : (
        <motion.div key={'lesson' + open} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
          <Lesson
            index={open}
            lesson={LESSONS[open]}
            done={!!st.lessons[LESSONS[open].id]}
            onBack={() => { setOpen(null); window.scrollTo(0, 0); }}
            onDone={() => { setSt((s) => ({ ...s, lessons: { ...s.lessons, [LESSONS[open].id]: true } })); setOpen(null); window.scrollTo(0, 0); }}
            onQuiz={(qs) => startQuiz({ type: 'lesson', idx: open, lessonId: LESSONS[open].id, title: LESSONS[open].title, rule: LESSONS[open].rule, questions: qs, label: `Lesson ${open + 1} check` })}
            onAsk={() => askCoach(`I just read the lesson '${LESSONS[open].title}'. Can you explain the main idea another way and give me an example from a real game?`)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Reset() {
  const { resetProgress } = useApp();
  const [armed, setArmed] = useState(false);
  return (
    <p className="m-0 mt-2 text-xs text-muted-foreground">
      Timers and item names checked against Season 2026, patch 26.23. Builds shift every patch; the ideas hold. Progress is saved in this browser only.{' '}
      <button type="button" className="underline underline-offset-2" onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); } else { resetProgress(); setArmed(false); } }}>
        {armed ? 'Tap again to erase progress' : 'Reset progress'}
      </button>
    </p>
  );
}

function Lesson({ index, lesson, done, onBack, onDone, onQuiz, onAsk }) {
  const qs = lesson.quiz.map((id) => QBY[id]).filter(Boolean);
  return (
    <Screen>
      <Rise>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground"><ArrowLeft /> All lessons</Button>
      </Rise>
      <Rise className="flex flex-col gap-2">
        <Eyebrow>Lesson {index + 1} of {LESSONS.length} · {lesson.part}</Eyebrow>
        <h2 className="m-0 text-[26px] leading-[1.1] font-extrabold tracking-tight">{lesson.title}</h2>
        <Lead className="text-base">{lesson.hook}</Lead>
      </Rise>
      {lesson.body.map((p, i) => (
        <Rise as="p" key={i} className="m-0 max-w-[62ch] text-[17px] leading-[1.6]">{p}</Rise>
      ))}
      {lesson.you && <Rise><Callout label="In your games" tone="muted">{lesson.you}</Callout></Rise>}
      <Rise><Callout label="Take this into your next game" className="[&>div:last-child]:text-[17px] [&>div:last-child]:font-semibold">{lesson.rule}</Callout></Rise>
      <Rise className="flex flex-col gap-2.5">
        {qs.length ? (
          <ShimmerButton onClick={() => onQuiz(qs)}>Check yourself · {qs.length} questions</ShimmerButton>
        ) : (
          <ShimmerButton onClick={onDone}>{done ? <><Check size={18} /> Done</> : 'Got it, mark as done'}</ShimmerButton>
        )}
        <Button variant="outline" size="lg" onClick={onAsk} className="w-full"><MessageCircle /> Ask your coach about this</Button>
      </Rise>
    </Screen>
  );
}
