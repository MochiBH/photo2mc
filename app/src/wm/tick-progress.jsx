import { motion } from 'motion/react';

/* The tick-bar progress from Watermelon UI's "Onboarding Checklist" header. */
export function TickProgress({ value, total, ticks = 14, label }) {
  const filled = total ? Math.round((value / total) * ticks) : 0;
  return (
    <div className="flex shrink-0 items-center gap-2.5" role="img" aria-label={label || `${value} of ${total}`}>
      <div className="flex gap-[3px]">
        {Array.from({ length: ticks }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{ scaleY: i < filled ? 1 : 0.7 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: i * 0.02 }}
            className={`h-4 w-[3.5px] rounded-full transition-colors duration-500 ${i < filled ? 'bg-[#22C55E]' : 'bg-[#E5E5E7] dark:bg-[#2A2A2A]'}`}
          />
        ))}
      </div>
      <span className="tnum min-w-8 text-right text-[13px] font-bold text-[#71717A] dark:text-[#999]">
        {value}/{total}
      </span>
    </div>
  );
}
