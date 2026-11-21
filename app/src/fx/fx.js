// Shared effects, driven by anime.js. The backdrop registers its ripple here so any screen can set it off.
import { animate, utils } from 'animejs';

export const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const TONE = { lime: ['#b9ff3d', '#5cf2d6', '#ffffff'], melon: ['#ff4d73', '#ff9a5c', '#ffffff'], gold: ['#ffd24d', '#b9ff3d', '#ffffff'] };

let rippleImpl = null;
export const setRipple = (fn) => { rippleImpl = fn; };
/** A wave through the dot grid from a point on screen (client coordinates). */
export function ripple(x, y, tone = 'lime') { if (rippleImpl && !calm) rippleImpl(x, y, tone); }
const centre = (src) => {
  if (!src) return [innerWidth / 2, innerHeight / 2];
  if (typeof src.clientX === 'number' && (src.clientX || src.clientY)) return [src.clientX, src.clientY];
  const el = src.currentTarget || src.target || src;
  if (el && el.getBoundingClientRect) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  return [innerWidth / 2, innerHeight / 2];
};
export const rippleFrom = (src, tone) => ripple(...centre(src), tone);

/** Sparks flying out of a point: for a right answer, an objective taken, an item bought. */
export function burst(src, tone = 'lime', count = 18) {
  if (calm || typeof document === 'undefined') return;
  const [x, y] = centre(src), colors = TONE[tone] || TONE.lime;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:60;pointer-events:none`;
  const bits = Array.from({ length: count }, (_, i) => {
    const b = document.createElement('i'), streak = i % 3 === 0, size = utils.random(4, 9);
    b.style.cssText = `position:absolute;left:0;top:0;width:${streak ? size * 2.6 : size}px;height:${streak ? 3 : size}px;margin:${-size / 2}px;border-radius:99px;background:${colors[i % colors.length]};box-shadow:0 0 12px ${colors[0]}`;
    host.appendChild(b);
    return b;
  });
  document.body.appendChild(host);
  animate(bits, {
    x: () => { const a = Math.random() * Math.PI * 2; return Math.cos(a) * utils.random(46, 130); },
    y: () => { const a = Math.random() * Math.PI * 2; return Math.sin(a) * utils.random(46, 130) + 24; },
    rotate: () => utils.random(-220, 220),
    scale: [{ to: 1.25, duration: 120 }, { to: 0, duration: 620 }],
    opacity: [{ to: 1, duration: 80 }, { to: 0, duration: 660 }],
    ease: 'outExpo',
    duration: 760,
    onComplete: () => host.remove(),
  });
  // a ring that snaps outward
  const ring = document.createElement('i');
  ring.style.cssText = `position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid ${colors[0]}`;
  host.appendChild(ring);
  animate(ring, { scale: [0.4, 4.4], opacity: [0.9, 0], duration: 620, ease: 'outExpo' });
  ripple(x, y, tone);
}

/** A short hard shake, for when something went wrong. */
export function shake(el) {
  if (calm || !el) return;
  animate(el, { x: [0, -9, 9, -6, 6, -3, 0], duration: 420, ease: 'outQuad' });
}
