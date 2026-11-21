import { motion } from 'motion/react';
import { cn } from './utils';

/* The bar from Watermelon UI's "Labeled Progress Indicator": fills on mount, with a slow sheen passing over it. */
export function ShimmerProgress({ value, className, tone = 'primary', label }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = tone === 'good' ? 'bg-good' : tone === 'bad' ? 'bg-bad' : tone === 'gold' ? 'bg-gold' : 'bg-neon shadow-[0_0_14px_var(--primary)]';
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('h-3 w-full overflow-hidden rounded-full border border-white/8 bg-black/40 shadow-inner', className)}
    >
      <motion.div
        initial={{ width: '0%' }}
        animate={{ width: pct + '%' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cn('relative h-full overflow-hidden rounded-full', fill)}
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
          className="absolute inset-y-0 w-full bg-linear-to-r from-transparent via-white/45 to-transparent"
        />
      </motion.div>
    </div>
  );
}
