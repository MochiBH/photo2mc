import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../wm/utils';
import { Eyebrow, Lead, Rise, Screen } from '../ui';
import { useApp } from '../store';
import { BRIEF, errText, statsLine } from '../lib/legacy';

const STARTERS = [
  ['Review my last game', 'I just finished a game and want to review it. Ask me what you need to know.'],
  ['Plan my next game', "I'm about to queue. Ask me my champion and the enemy jungler, then give me a simple plan."],
  ['Why do I die so much?', "Why do I die so much, and what's the simplest way to fix it?"],
  ['Explain wave states', "Explain wave states to me like I've never heard of them, and why they matter for ganks."],
  ['AP or tank Nunu?', 'Should I be building AP or tank on Nunu? Help me decide in champion select.'],
];
const HELLO = "Hey. I've been through your last 20 games. Short version: when you die five times or fewer, you haven't lost. Want to review a game, plan the next one, or ask me something?";

export default function Coach() {
  const { sample, msgs, setMsgs, draft, setDraft } = useApp();
  const [text, setText] = useState(draft || '');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState(null);
  const [waited, setWaited] = useState(false);
  const ta = useRef(null);
  const end = useRef(null);

  useEffect(() => { if (draft) { setText(draft); setDraft(''); ta.current && ta.current.focus(); } }, [draft, setDraft]);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 12000); return () => clearTimeout(t); }, []);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight + 2) + 'px'; } }, [text]);
  useEffect(() => { if (msgs.length || stream !== null) end.current && end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msgs.length, stream]);

  async function send(raw) {
    const say = (raw || '').trim();
    if (!say || busy || !sample) return;
    const history = [...msgs, { role: 'user', content: say }];
    setMsgs(history); setText(''); setBusy(true); setStream('');
    try {
      let hist = history.filter((m) => !m.err).slice(-14);
      while (hist.length && hist[0].role !== 'user') hist = hist.slice(1);
      const input = hist.map((m, i) => (i === 0 ? { role: 'user', content: BRIEF.replace('{STATS}', statsLine()) + '\n\nThe player says: ' + m.content } : { role: m.role, content: m.content }));
      let live = '';
      const r = await sample(input, { cache: false, onText: (t) => { if (t && t.text) { live = t.text; setStream(t.text); } } });
      const out = (r && r.text ? r.text.trim() : live) || '…';
      setMsgs([...history, { role: 'assistant', content: out }]);
    } catch (e) {
      setMsgs([...msgs, { role: 'user', content: say }, { role: 'assistant', content: errText(e), err: true }]);
    } finally { setBusy(false); setStream(null); }
  }

  const shown = [{ role: 'assistant', content: HELLO }, ...msgs];
  return (
    <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Talk it through</Eyebrow>
        <Lead>Your coach knows your stats, your champions and your checkpoints. Ask anything in plain words, or tell it what happened in your last game.</Lead>
      </Rise>
      <Rise className="flex flex-col gap-2.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.map((m, i) => <Bubble key={i} who={m.role} err={m.err}>{m.content}</Bubble>)}
          {stream !== null && <Bubble key="stream" who="assistant">{stream || <Typing />}</Bubble>}
        </AnimatePresence>
        <div ref={end} />
      </Rise>
      {msgs.length === 0 && (
        <Rise className="flex flex-wrap gap-2">
          {STARTERS.map(([label, say]) => (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => send(say)}
              disabled={!sample}
              className="min-h-10 rounded-full bg-card px-3.5 py-2 text-left text-sm font-medium ring-1 ring-foreground/10 transition-shadow hover:shadow-md disabled:opacity-50"
            >
              {label}
            </motion.button>
          ))}
        </Rise>
      )}
      <Rise>
        <form
          onSubmit={(e) => { e.preventDefault(); send(text); }}
          className="flex items-end gap-2 rounded-3xl bg-card p-2 pl-4 ring-1 ring-foreground/10 focus-within:ring-2 focus-within:ring-primary"
        >
          <textarea
            id="coach-say"
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(text); } }}
            placeholder="Ask your coach…"
            aria-label="Message your coach"
            disabled={!sample}
            className="max-h-40 min-h-10 w-full resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={!sample || busy || !text.trim()}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </motion.button>
        </form>
      </Rise>
      {!sample && (
        <Rise><Lead className="text-sm">{waited ? 'The coach chat only works when this page is open inside Claude. You can also ask Claude anything in your main chat.' : 'Connecting to your coach…'}</Lead></Rise>
      )}
    </Screen>
  );
}

function Bubble({ who, err, children }) {
  const me = who === 'user';
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.96, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ originX: me ? 1 : 0, originY: 1 }}
      className={cn(
        'max-w-[90%] rounded-3xl px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
        me ? 'self-end rounded-br-lg bg-[#252528] text-[#EDEDEC] dark:bg-zinc-100 dark:text-zinc-950' : 'self-start rounded-bl-lg bg-card ring-1 ring-foreground/10',
        err && 'text-bad ring-bad/40',
      )}
    >
      {children}
    </motion.div>
  );
}
function Typing() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}
