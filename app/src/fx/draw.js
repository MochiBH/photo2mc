import { useEffect } from 'react';
import { animate, stagger, svg } from 'animejs';
import { calm } from './fx';

/* Draws in every stroke marked data-draw inside the referenced element, one after another, then pops anything marked data-pop. */
export function useDrawIn(ref, deps = []) {
  useEffect(() => {
    const root = ref.current; if (!root || calm) return;
    const lines = [...root.querySelectorAll('[data-draw]')], pops = [...root.querySelectorAll('[data-pop]')];
    const anims = [];
    if (lines.length) anims.push(animate(svg.createDrawable(lines), { draw: ['0 0', '0 1'], duration: 1300, delay: stagger(140), ease: 'inOutQuart' }));
    if (pops.length) anims.push(animate(pops, { scale: [0, 1], opacity: [0, 1], duration: 620, delay: stagger(22, { start: 500 }), ease: 'outBack' }));
    return () => anims.forEach((a) => a.pause());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
