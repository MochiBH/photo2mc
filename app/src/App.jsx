import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ChartNoAxesColumn, Map as MapIcon, Swords, UserRound, Zap } from 'lucide-react';
import { FluidTabs } from './wm/fluid-tabs';
import { ContinuousTabs } from './wm/continuous-tabs';
import { AppCtx, useLocal } from './store';
import { SessionProvider, useSession, useSynced } from './session';
import { content } from './lib/content';
import Learn from './views/Learn';
import Drills from './views/Drills';
import Games from './views/Games';
import MapView from './views/Map';
import Live from './views/Live';
import Me, { ConfigMissing, Setup, SignIn, SyncBanner } from './views/Account';

const TABS = [
  { id: 'learn', label: 'Learn', icon: <BookOpen size={20} /> },
  { id: 'drills', label: 'Drills', icon: <Zap size={20} /> },
  { id: 'games', label: 'Games', icon: <ChartNoAxesColumn size={20} /> },
  { id: 'map', label: 'Map', icon: <MapIcon size={20} /> },
  { id: 'live', label: 'Live', icon: <Swords size={20} /> },
  { id: 'me', label: 'Me', icon: <UserRound size={20} /> },
];
const VIEWS = { learn: Learn, drills: Drills, games: Games, map: MapView, live: Live, me: Me };
const EMPTY = { n: 0, streak: 0, right: 0, wrong: 0, q: {}, lessons: {} };
const OWNER = 'the gonzoogler#weeee';   // the course notes written from this player's own games only show for him

export default function App() {
  return <SessionProvider><Gate /></SessionProvider>;
}

function Gate() {
  const { phase } = useSession();
  if (phase === 'loading') return <div className="grid min-h-dvh place-items-center"><motion.div className="size-10 rounded-full border-4 border-muted border-t-primary" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} aria-label="Loading" /></div>;
  if (phase === 'config') return <ConfigMissing />;
  if (phase === 'signedOut') return <SignIn />;
  if (phase === 'needsProfile') return <Setup />;
  return <Main />;
}

function Main() {
  const { profile, role, setRole } = useSession();
  const [tab, setTab] = useLocal('jungle-coach.tab.v2', 'learn', (v) => TABS.some((t) => t.id === v));
  const [st, setSt] = useSynced('drills.' + role, EMPTY, (v) => v && typeof v === 'object' && v.q);
  const [quiz, setQuiz] = useState(null);
  const personal = `${profile.riot_name}#${profile.riot_tag}`.toLowerCase() === OWNER;
  const course = useMemo(() => content(role, personal), [role, personal]);

  const go = useCallback((id) => { setTab(id); window.scrollTo(0, 0); }, [setTab]);
  const ctx = useMemo(() => ({
    st, setSt, go, quiz, setQuiz, role, course,
    startQuiz: (q) => { setQuiz(q); go('drills'); },
    resetProgress: () => setSt(EMPTY),
  }), [st, setSt, go, quiz, role, course]);

  const View = VIEWS[tab] || Learn;
  return (
    <AppCtx.Provider value={ctx}>
      <div
        className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 pt-5 pb-28"
        style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
      >
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{profile.riot_name} #{profile.riot_tag}</div>
            <h1 className="m-0 text-[26px] leading-none font-extrabold tracking-tight whitespace-nowrap">{role === 'support' ? 'Support Coach' : 'Jungle Coach'}</h1>
          </div>
          <ContinuousTabs tabs={[{ id: 'jungle', label: 'Jungle' }, { id: 'support', label: 'Support' }]} value={role} onChange={setRole} label="Role" size="sm" className="shrink-0" />
        </header>
        <SyncBanner />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={tab + role}
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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="pointer-events-auto"><FluidTabs tabs={TABS} active={tab} onChange={go} label="Sections" /></div>
      </div>
    </AppCtx.Provider>
  );
}
