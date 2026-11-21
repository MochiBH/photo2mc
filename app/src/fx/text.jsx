import { useEffect, useRef } from 'react';
import { animate, splitText, stagger } from 'animejs';
import { calm } from './fx';

/* A headline whose letters rise in one after another. The text node belongs to anime.js, not React, so it is set by hand. */
export function SplitTitle({ text, className, delay = 0, as: Tag = 'span' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; el.textContent = text;
    if (calm) return;
    // Gradient ink is clipped to the parent's own glyphs, which moving letters are not part of: the letters fly in
    // solid lime, then the split is undone so the gradient shows through the settled word.
    const split = splitText(el, { chars: true });
    split.chars.forEach((c) => { c.style.color = 'var(--primary)'; c.style.webkitTextFillColor = 'var(--primary)'; });
    let done = false;
    const settle = () => { if (done) return; done = true; try { split.revert(); } catch (e) {} el.textContent = text; };
    const a = animate(split.chars, { y: ['110%', '0%'], opacity: [0, 1], rotate: [8, 0], delay: stagger(34, { start: delay }), duration: 720, ease: 'outExpo', onComplete: settle });
    return () => { a.pause(); settle(); };
  }, [text, delay]);
  return <Tag ref={ref} aria-label={text} className={className} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }} />;
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%/<>';
/* Text that decodes into place, left to right. */
export function Scramble({ text, className, duration = 700, as: Tag = 'span' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (calm) { el.textContent = text; return; }
    const state = { p: 0 };
    const a = animate(state, {
      p: 1, duration, ease: 'outQuad',
      onUpdate: () => { const n = Math.floor(state.p * text.length); el.textContent = text.slice(0, n) + [...text.slice(n)].map((ch) => (ch === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''); },
      onComplete: () => { el.textContent = text; },
    });
    return () => a.pause();
  }, [text, duration]);
  return <Tag ref={ref} aria-label={text} className={className}>{text}</Tag>;
}
