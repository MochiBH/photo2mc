import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ChartNoAxesColumn, Map as MapIcon, MessageCircle, Swords, Zap } from 'lucide-react';
import { FluidTabs } from './wm/fluid-tabs';
import { AppCtx, useCapability, useLocal } from './store';
import { GSTORE, SNAP, mergeGames, setGames } from './lib/legacy';
import Learn from './views/Learn';
import Coach from './views/Coach';
import Drills from './views/Drills';
import Games from './views/Games';
import MapView from './views/Map';
import Live from './views/Live';

const TABS = [
  { id: 'learn', label: 'Learn', icon: <BookOpen size={20} /> },
  { id: 'coach', label: 'Coach', icon: <MessageCircle size={20} /> },
  { id: 'drills', label: 'Drills', icon: <Zap size={20} /> },
  { id: 'games', label: 'Games', icon: <ChartNoAxesColumn size={20} /> },
  { id: 'map', label: 'Map', icon: <MapIcon size={20} /> },
  { id: 'live', label: 'Live', icon: <Swords size={20} /> },
];
const VIEWS = { learn: Learn, coach: Coach, drills: Drills, games: Games, map: MapView, live: Live };
const EMPTY = { n: 0, streak: 0, right: 0, wrong: 0, q: {}, lessons: {} };

export default function App() {
  const [tab, setTab] = useLocal('jungle-coach.tab.v1', 'learn', (v) => TABS.some((t) => t.id === v));
  const [st, setSt] = useLocal('jungle-drills.v1', EMPTY, (v) => v && typeof v === 'object' && v.q);
  const [stored, setStored] = useLocal(GSTORE, [], Array.isArray);
  const [msgs, setMsgs] = useState([]);
  const sample = useCapability('sample');
  const [draft, setDraft] = useState('');
  const [quiz, setQuiz] = useState(null);

  const go = useCallback((id) => { setTab(id); window.scrollTo(0, 0); }, [setTab]);
  const allGames = useMemo(() => mergeGames(SNAP, stored), [stored]);
  const games = useMemo(() => allGames.slice(0, 20), [allGames]);
  setGames(games);
  const ctx = useMemo(() => ({
    st, setSt, go, draft, setDraft, quiz, setQuiz, sample, msgs, setMsgs, games, allGames,
    addGames: (fresh) => setStored((old) => mergeGames(SNAP, old, fresh)),
    askCoach: (text) => { setDraft(text); go('coach'); },
    startQuiz: (q) => { setQuiz(q); go('drills'); },
    resetProgress: () => setSt(EMPTY),
  }), [st, setSt, go, draft, quiz, sample, msgs, games, allGames, setStored]);

  const View = VIEWS[tab] || Learn;
  return (
    <AppCtx.Provider value={ctx}>
      <div
        className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 pt-5 pb-28"
        style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
      >
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">The Gonzoogler #WEEEE</div>
            <h1 className="m-0 text-[28px] leading-none font-extrabold tracking-tight">Jungle Coach</h1>
          </div>
          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-secondary px-3 text-xs font-semibold text-secondary-foreground">Bronze 2 · NA</span>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={tab}
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <View />
          </motion.main>
        </AnimatePresence>
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-auto">
          <FluidTabs tabs={TABS} active={tab} onChange={go} label="Sections" />
        </div>
      </div>
    </AppCtx.Provider>
  );
}
