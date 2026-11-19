import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { cn } from './wm/utils';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } } };
const item = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

/* A screen: its direct <Rise> children come in one after another. */
export function Screen({ className, children }) {
  return (
    <motion.div variants={list} initial="hidden" animate="show" className={cn('flex flex-col gap-4', className)}>
      {children}
    </motion.div>
  );
}
export function Rise({ className, children, as = 'div', ...props }) {
  const Tag = motion[as];
  return <Tag variants={item} className={className} {...props}>{children}</Tag>;
}

export function Eyebrow({ children, className }) {
  return <div className={cn('text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase', className)}>{children}</div>;
}
export function Lead({ children, className }) {
  return <p className={cn('m-0 text-[15px] leading-relaxed text-muted-foreground', className)}>{children}</p>;
}

/* A number that rolls to its value. */
export function Num({ value, className, ...props }) {
  return <NumberFlow value={value} className={cn('tnum', className)} {...props} />;
}

/* A highlighted "do this" block. */
export function Callout({ label, children, tone = 'primary', className }) {
  const tones = {
    primary: 'bg-primary/12 border-primary/40 dark:bg-primary/10',
    gold: 'bg-gold-soft border-gold/30',
    muted: 'bg-muted border-border',
    bad: 'bg-bad-soft border-bad/30',
  };
  return (
    <div className={cn('rounded-xl border px-3.5 py-3', tones[tone], className)}>
      {label && <div className="mb-1 text-[11px] font-bold tracking-[0.12em] uppercase opacity-70">{label}</div>}
      <div className="text-[15px] leading-snug font-medium">{children}</div>
    </div>
  );
}

/* A pill that carries a pass/fail state. */
export function Mark({ ok, children }) {
  return (
    <span className={cn('tnum inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold', ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
      {children}
    </span>
  );
}
