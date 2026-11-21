import { AnimatePresence, motion } from 'motion/react';
import { rippleFrom } from '../fx/fx';

/* Watermelon UI "Fluid Tabs" as a floating dock. The active tab is a glowing lime pill that slides between icons;
   its label shows on the active tab only so six tabs fit a phone. Changing tab sends a wave through the backdrop. */
export function FluidTabs({ tabs, active, onChange, label }) {
  return (
    <nav
      aria-label={label}
      className="relative flex items-center gap-0.5 rounded-full border border-white/12 bg-black/55 px-1.5 py-1.5 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-2xl"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={(e) => { rippleFrom(e); onChange(tab.id); }}
            aria-pressed={isActive}
            aria-label={tab.label}
            className="group relative rounded-full px-3 py-2.5 outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="fluid-active-pill"
                transition={{ type: 'spring', stiffness: 280, damping: 25, mass: 0.8 }}
                className="bg-neon absolute inset-0 rounded-full shadow-[0_0_26px_-2px_var(--primary),inset_0_1px_0_rgb(255_255_255/0.5)]"
              />
            )}
            <motion.div
              transition={{ duration: 0.3, ease: 'easeOut' }}
              animate={{ filter: isActive ? ['blur(0px)', 'blur(4px)', 'blur(0px)'] : 'blur(0px)', transitionEnd: { filter: 'none' } }}
              className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${isActive ? 'font-bold text-primary-foreground' : 'font-semibold text-white/55 group-hover:text-white'}`}
            >
              <motion.div animate={{ scale: isActive ? 1.08 : 1, rotate: isActive ? [0, -10, 0] : 0 }} transition={{ scale: { type: 'spring', stiffness: 300, damping: 15 }, rotate: { duration: 0.4 } }} className="flex shrink-0 items-center justify-center">
                {tab.icon}
              </motion.div>
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.span key="label" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="overflow-hidden text-sm tracking-tight whitespace-nowrap">
                    {tab.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </button>
        );
      })}
    </nav>
  );
}
