import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from './utils';

const SPRING = { type: 'spring', stiffness: 200, damping: 22, mass: 1.2 };

/* Watermelon UI "Expand Details": a soft panel whose content blurs and slides in as it opens. */
export function Expand({ title, children, defaultOpen = false, className }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-1.5 px-3 py-2 text-left text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex items-center justify-center">
          <ChevronDown className="size-5 stroke-2" />
        </motion.div>
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={SPRING} className="overflow-hidden">
            <motion.div
              initial={{ opacity: 0, filter: 'blur(8px)', y: 24 }}
              animate={{ opacity: 1, filter: 'blur(0px)', y: 0, transition: { type: 'spring', duration: 0.45, bounce: 0, delay: 0.08 } }}
              exit={{ opacity: 0, filter: 'blur(8px)', y: 12, transition: { duration: 0.15 } }}
              className="px-4 pt-1 pb-4"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
