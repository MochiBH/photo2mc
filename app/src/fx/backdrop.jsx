import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';
import { calm, setRipple, TONE } from './fx';

/* The living backdrop: three drifting lights, and a grid of dots that a wave runs through whenever you act.
   The dots are drawn on a canvas; anime.js tweens each dot's energy, staggered by its distance from the tap. */
export default function Backdrop() {
  const canvas = useRef(null), lights = useRef(null);

  useEffect(() => {
    const cv = canvas.current, ctx = cv.getContext('2d');
    let dots = [], w = 0, h = 0, dpr = 1, gap = 28, running = 0, raf = 0;
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      gap = Math.max(26, Math.sqrt((w * h) / 620));
      dots = [];
      for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) dots.push({ x, y, e: 0, c: null });
      draw();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.075)';
      ctx.beginPath();
      for (const d of dots) if (d.e < 0.02) { ctx.moveTo(d.x + 1.1, d.y); ctx.arc(d.x, d.y, 1.1, 0, 6.3); }
      ctx.fill();
      for (const d of dots) if (d.e >= 0.02) {
        const [r, g, b] = d.c || [185, 255, 61];
        ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + d.e * 0.85})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.1 + d.e * 2.6, 0, 6.3); ctx.fill();
      }
    }
    const loop = () => { draw(); raf = running > 0 ? requestAnimationFrame(loop) : 0; };
    function wave(x, y, tone = 'lime', strength = 1) {
      const c = rgb((TONE[tone] || TONE.lime)[0]), reach = Math.hypot(w, h) * 0.75;
      const near = dots.filter((d) => Math.hypot(d.x - x, d.y - y) < reach);
      near.forEach((d) => { d.c = c; });
      running++; if (!raf) raf = requestAnimationFrame(loop);
      animate(near, {
        e: [{ to: strength, duration: 200, ease: 'outQuad' }, { to: 0, duration: 760, ease: 'outExpo' }],
        delay: (d) => Math.hypot(d.x - x, d.y - y) * 0.95,
        onComplete: () => { running = Math.max(0, running - 1); },
      });
    }
    layout();
    setRipple(wave);
    addEventListener('resize', layout);
    // a first wave from the middle, then the grid breathes on its own now and then
    const hello = setTimeout(() => !calm && wave(w / 2, h * 0.3, 'lime', 1), 350);
    const idle = setInterval(() => { if (!calm && !document.hidden) wave(utils.random(0, w), utils.random(0, h), 'lime', 0.35); }, 7000);

    const blobs = calm ? [] : [...lights.current.children].map((el, i) => animate(el, {
      x: [() => utils.random(-60, 60), () => utils.random(-90, 90)], y: [() => utils.random(-40, 40), () => utils.random(-110, 110)],
      scale: [1, 1.25 + i * 0.1], duration: 9000 + i * 3500, ease: 'inOutSine', loop: true, alternate: true,
    }));
    return () => { removeEventListener('resize', layout); clearTimeout(hello); clearInterval(idle); cancelAnimationFrame(raf); setRipple(null); blobs.forEach((b) => b.pause()); };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div ref={lights} className="absolute inset-0">
        <i className="absolute -top-24 -left-20 size-[420px] rounded-full opacity-45 blur-[90px]" style={{ background: 'radial-gradient(closest-side, var(--primary), transparent)' }} />
        <i className="absolute top-[38%] -right-32 size-[460px] rounded-full opacity-35 blur-[100px]" style={{ background: 'radial-gradient(closest-side, var(--cyan), transparent)' }} />
        <i className="absolute -bottom-40 left-[10%] size-[520px] rounded-full opacity-40 blur-[110px]" style={{ background: 'radial-gradient(closest-side, var(--violet), transparent)' }} />
      </div>
      <canvas ref={canvas} className="absolute inset-0" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 40%, rgb(0 0 0 / 0.55) 100%)' }} />
    </div>
  );
}
