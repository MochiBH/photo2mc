import { useId } from 'react';
import { motion } from 'motion/react';
import { cn, pillSpring } from './utils';

/* Watermelon UI "Continuous Tabs", controlled. Each instance gets its own sliding pill; long rows scroll sideways. */
export function ContinuousTabs({ tabs, value, onChange, label, size = 'md', className }) {
  const pill = useId();
  return (
    <div className={cn('no-scrollbar -mx-1 overflow-x-auto px-1 py-1', className)}>
      <nav
        aria-label={label}
        className="relative inline-flex items-center gap-0.5 rounded-full border border-[#E5E5E9] bg-linear-to-b from-[#ffffff] to-[#e9e9f2] p-1 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 dark:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={cn('relative rounded-full outline-none', size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2')}
            >
              {isActive && (
                <motion.div layoutId={pill} transition={pillSpring} className="absolute inset-0 rounded-full bg-[#252528] shadow-xs dark:bg-zinc-100" />
              )}
              <span
                className={cn(
                  'relative z-10 flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
                  isActive ? 'text-[#EDEDEC] dark:text-zinc-950' : 'text-[#343437] hover:text-[#62625D] dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {tab.label}
                {tab.count !== undefined && <span className="tnum text-xs font-medium opacity-70">{tab.count}</span>}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
