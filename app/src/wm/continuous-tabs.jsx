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
        className="relative inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-linear-to-b from-white/[0.07] to-white/[0.02] p-1 shadow-[inset_0_-2px_4px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.07)]"
      >
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button key={tab.id} type="button" onClick={() => onChange(tab.id)} aria-pressed={isActive} aria-label={tab.aria} title={tab.aria} className={cn('relative rounded-full outline-none', size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2')}>
              {isActive && <motion.div layoutId={pill} transition={pillSpring} className="absolute inset-0 rounded-full bg-white shadow-[0_0_18px_-4px_rgb(255_255_255/0.7)]" />}
              <span className={cn('relative z-10 flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200', isActive ? 'text-zinc-950' : 'text-white/60 hover:text-white')}>
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
