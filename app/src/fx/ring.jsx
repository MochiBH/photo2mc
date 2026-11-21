import { useEffect, useId, useRef } from 'react';
import { animate, svg } from 'animejs';
import { calm } from './fx';

/* A gauge that draws itself: the arc sweeps to its value with anime.js while the number counts up. */
export function Ring({ value, size = 132, stroke = 12, tone = 'neon', children, label }) {
  const arc = useRef(null), num = useRef(null), id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2, pct = Math.max(0, Math.min(1, value));
  useEffect(() => {
    const [d] = svg.createDrawable(arc.current);
    if (calm) { d.setAttribute('draw', '0 ' + pct); if (num.current) num.current.textContent = Math.round(pct * 100); return; }
    const a = animate(d, { draw: ['0 0', '0 ' + pct], duration: 1500, ease: 'outExpo', delay: 150 });
    const n = { v: 0 };
    const b = num.current ? animate(n, { v: pct * 100, duration: 1500, ease: 'outExpo', delay: 150, onUpdate: () => { num.current.textContent = Math.round(n.v); } }) : null;
    return () => { a.pause(); if (b) b.pause(); };
  }, [pct]);
  const paint = tone === 'neon' ? `url(#${id})` : `var(--${tone})`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--cyan)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <circle ref={arc} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={paint} strokeWidth={stroke} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 70%, transparent))' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children || <span className="font-display tnum text-3xl leading-none font-black"><span ref={num}>0</span><span className="text-base font-bold text-muted-foreground">%</span></span>}
      </div>
    </div>
  );
}
