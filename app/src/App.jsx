import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, House, Map as MapIcon, Swords, UserRound, Zap } from 'lucide-react';
import Backdrop from './fx/backdrop';
import { Scramble, SplitTitle } from './fx/text';
import { ripple } from './fx/fx';
import { FluidTabs } from './wm/fluid-tabs';
import { ContinuousTabs } from './wm/continuous-tabs';
import { AppCtx, useLocal } from './store';
import { SHARP } from './ui';
import { SessionProvider, useSession, useSynced } from './session';
import { content } from './lib/content';
import Learn from './views/Learn';
import Drills from './views/Drills';
import Home from './views/Home';
import MapView from './views/Map';
import Live from './views/Live';
import Me, { ConfigMissing, Setup, SignIn, SyncBanner } from './views/Account';

const TABS = [
  { id: 'home', label: 'Home', icon: <House size={20} /> },
  { id: 'learn', label: 'Learn', icon: <BookOpen size={20} /> },
  { id: 'drills', label: 'Drills', icon: <Zap size={20} /> },
  { id: 'map', label: 'Map', icon: <MapIcon size={20} /> },
  { id: 'live', label: 'Live', icon: <Swords size={20} /> },
  { id: 'me', label: 'Me', icon: <UserRound size={20} /> },
];
const VIEWS = { home: Home, learn: Learn, drills: Drills, map: MapView, live: Live, me: Me };
const EMPTY = { n: 0, streak: 0, right: 0, wrong: 0, q: {}, lessons: {} };

export default function App() {
  // overflow-x-clip: a card's glow reaches past the screen edge, and must not make the page wider than the screen
  return <SessionProvider><Backdrop /><div className="relative z-10 overflow-x-clip"><Gate /></div></SessionProvider>;
}

/* The mark: a tiny Rift, its three lanes drawn in. */
export function Logo({ size = 38 }) {
  return (
    <span className="bg-neon glow-lime grid shrink-0 place-items-center rounded-[28%]" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17V7a2 2 0 0 1 2-2h10" /><path d="M19 7v10a2 2 0 0 1-2 2H7" /><path d="M8 16l8-8" />
      </svg>
    </span>
  );
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
  const [tab, setTab] = useLocal('jungle-coach.tab.v3', 'home', (v) => TABS.some((t) => t.id === v));
  const [st, setSt] = useSynced('drills.' + role, EMPTY, (v) => v && typeof v === 'object' && v.q);
  const [quiz, setQuiz] = useState(null);
  const riotId = `${profile.riot_name}#${profile.riot_tag}`.toLowerCase();
  const course = useMemo(() => content(role, riotId), [role, riotId]);

  const go = useCallback((id) => { setTab(id); window.scrollTo(0, 0); }, [setTab]);
  const ctx = useMemo(() => ({
    st, setSt, go, quiz, setQuiz, role, course,
    startQuiz: (q) => { setQuiz(q); go('drills'); },
    resetProgress: () => setSt(EMPTY),
  }), [st, setSt, go, quiz, role, course]);

  const View = VIEWS[tab] || Home;
  return (
    <AppCtx.Provider value={ctx}>
      <div
        className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 pt-5 pb-28"
        style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo />
            <div className="min-w-0">
              <h1 className="font-display m-0 text-[16px] leading-none font-black tracking-tight whitespace-nowrap uppercase">
                <SplitTitle key={role} text={role === 'support' ? 'Support Coach' : 'Jungle Coach'} className="text-neon pb-[0.12em]" />
              </h1>
              <Scramble key={profile.riot_name + role} text={`${profile.riot_name} #${profile.riot_tag}`} className="mt-1 block truncate text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase" />
            </div>
          </div>
          <ContinuousTabs tabs={[{ id: 'jungle', label: 'JG', aria: 'Jungle' }, { id: 'support', label: 'SUP', aria: 'Support' }]} value={role} onChange={(r) => { ripple(innerWidth - 70, 40, 'lime'); setRole(r); }} label="Role" size="sm" className="shrink-0" />
        </header>
        <SyncBanner />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={tab + role}
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, ...SHARP }}
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
