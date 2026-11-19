import { AnimatePresence, motion } from 'motion/react';

/* Watermelon UI "Fluid Tabs", controlled. The label is shown on the active tab only so six tabs fit a phone. */
export function FluidTabs({ tabs, active, onChange, label }) {
  return (
    <nav
      aria-label={label}
      className="relative flex items-center gap-0.5 rounded-full border-[1.6px] border-[#f5f1ebf4] bg-[#F5F1EB]/90 px-1 py-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-colors dark:border-neutral-800 dark:bg-neutral-900/90"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            aria-label={tab.label}
            className="group relative rounded-full px-3 py-2.5 outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="fluid-active-pill"
                transition={{ type: 'spring', stiffness: 280, damping: 25, mass: 0.8 }}
                className="absolute inset-0 rounded-full border border-[#fefefe]/90 bg-gradient-to-b from-[#fefefe] to-gray-50/80 shadow-xs dark:border-neutral-600/50 dark:from-neutral-700 dark:to-neutral-800/90"
              />
            )}
            <motion.div
              transition={{ duration: 0.3, ease: 'easeOut' }}
              animate={{ filter: isActive ? ['blur(0px)', 'blur(4px)', 'blur(0px)'] : 'blur(0px)' }}
              className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
                isActive ? 'font-bold text-[#292926] dark:text-white' : 'font-semibold text-[#585652] dark:text-neutral-400 group-hover:dark:text-neutral-200'
              }`}
            >
              <motion.div
                animate={{ scale: isActive ? 1.06 : 1 }}
                transition={{ scale: { type: 'spring', stiffness: 300, damping: 15 } }}
                className="flex shrink-0 items-center justify-center"
              >
                {tab.icon}
              </motion.div>
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.span
                    key="label"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="overflow-hidden text-sm tracking-tight whitespace-nowrap"
                  >
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
