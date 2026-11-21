import { useLayoutEffect, useRef } from 'react';
import NumberFlow from '@number-flow/react';
import { cn } from './wm/utils';

/* Motion's blur-in, finished cleanly. Spread it into an `animate` target: the element sharpens to blur(0) and then the
   filter is taken off altogether. An element left holding even a zero blur is drawn through an extra off-screen pass for
   as long as it is on the page, which is what made long screens slow to scroll on a phone. */
export const SHARP = { filter: 'blur(0px)', transitionEnd: { filter: 'none' } };

/* A screen: its direct <Rise> children come in one after another (rise up, fade in, sharpen). The motion is the CSS
   animation `rise-in` in index.css, timed to match the spring it replaced, so the browser can run it without script and
   leaves nothing on the element afterwards. Anything that starts below the bottom of the screen is simply there: nobody
   would see it arrive, and animating it costs as much as animating what you can see. */
export function Screen({ className, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const fold = window.innerHeight;
    for (const el of ref.current.children) if (el.classList.contains('rise') && el.getBoundingClientRect().top > fold) el.dataset.still = '';
  }, []);
  return <div ref={ref} className={cn('screen flex flex-col gap-4', className)}>{children}</div>;
}
export function Rise({ className, children, as: Tag = 'div', ...props }) {
  return <Tag className={cn('rise', className)} {...props}>{children}</Tag>;
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
