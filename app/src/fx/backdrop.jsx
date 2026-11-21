import { useEffect, useMemo, useRef } from 'react';
import { eases, utils } from 'animejs';
import { calm, setRipple, startSheen, TONE } from './fx';

/* The living backdrop: three drifting lights, and a grid of dots that a wave runs through whenever you act.

   Built to be cheap on a phone. The lights used to be circles under a 90–110px CSS blur, moved by script every frame, which
   made the browser re-blur a huge area sixty times a second. Each light is now a small sprite that already holds the blurred
   shape (the same soft falloff, worked out once), scaled up and moved by a CSS animation, so nothing is repainted while it
   drifts. The dots are one canvas: a wave is a formula of distance and time, drawn only while a wave is passing. */

/* A circle that fades evenly to its edge at radius R, after a Gaussian blur of `sigma`, as radial-gradient stops out to `reach`. */
function blurred(R, sigma, reach, colour, steps = 26) {
  const i0e = (x) => {   // exp(-x) · I0(x), stable for large x
    if (x < 3.75) { const t = (x / 3.75) ** 2; return Math.exp(-x) * (1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))))); }
    const t = 3.75 / x;
    return (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))))) / Math.sqrt(x);
  };
  const at = (p) => { let s = 0; const n = 240, dr = R / n; for (let k = 0; k < n; k++) { const r = (k + 0.5) * dr; s += (1 - r / R) * Math.exp(-((r - p) ** 2) / (2 * sigma * sigma)) * i0e((r * p) / (sigma * sigma)) * r * dr; } return s / (sigma * sigma); };
  const edge = at(reach);
  return Array.from({ length: steps + 1 }, (_, k) => {
    const a = Math.max(0, (at((k / steps) * reach) - edge) / (1 - edge));
    return `color-mix(in oklab, ${colour} ${(a * 100).toFixed(2)}%, transparent) ${((k / steps) * 100).toFixed(1)}%`;
  }).join(', ');
}

const SHRINK = 4;   // sprites are drawn at a quarter size and scaled up: they are all soft gradient, so nothing is lost
const LIGHTS = [
  { box: '-top-24 -left-20 size-[420px]', R: 210, sigma: 90, opacity: 0.45, colour: 'var(--primary)' },
  { box: 'top-[38%] -right-32 size-[460px]', R: 230, sigma: 100, opacity: 0.35, colour: 'var(--cyan)' },
  { box: '-bottom-40 left-[10%] size-[520px]', R: 260, sigma: 110, opacity: 0.4, colour: 'var(--violet)' },
];

export default function Backdrop() {
  const canvas = useRef(null);
  const lights = useMemo(() => LIGHTS.map((l, i) => {
    const reach = l.R + 3 * l.sigma, size = (2 * reach) / SHRINK;
    const drift = calm ? {} : {
      '--x0': utils.random(-60, 60) + 'px', '--x1': utils.random(-90, 90) + 'px', '--y0': utils.random(-40, 40) + 'px', '--y1': utils.random(-110, 110) + 'px',
      '--s0': SHRINK, '--s1': SHRINK * (1.25 + i * 0.1), animation: `light-drift ${9000 + i * 3500}ms cubic-bezier(0.37, 0, 0.63, 1) infinite alternate`,
    };
    return { box: l.box, style: { width: size, height: size, margin: -size / 2, opacity: l.opacity, transform: `scale(${SHRINK})`, background: `radial-gradient(closest-side, ${blurred(l.R, l.sigma, reach, l.colour)})`, ...drift } };
  }), []);

  useEffect(() => {
    const cv = canvas.current, ctx = cv.getContext('2d');
    const BANDS = 12, WINDOW = 960;   // a dot is lit for 200ms up and 760ms down after the wavefront reaches it
    let w = 0, h = 0, dpr = 1, n = 0, X, Y, E, C, lit, waves = [], raf = 0;

    function layout() {
      // The canvas is as tall as the screen ever gets (the tallest viewport), so a phone's address bar sliding away does not rebuild it.
      const nw = cv.clientWidth || innerWidth, nh = cv.clientHeight || innerHeight;
      if (nw === w && nh === h) return;
      w = nw; h = nh; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const gap = Math.max(26, Math.sqrt((w * h) / 620)), xs = [], ys = [];
      for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) { xs.push(x); ys.push(y); }
      n = xs.length; X = Float32Array.from(xs); Y = Float32Array.from(ys);
      E = new Float32Array(n); C = new Uint8Array(n); lit = new Uint16Array(n); waves = [];
      draw(performance.now());
    }

    function draw(now) {
      E.fill(0);
      waves = waves.filter((v) => now - v.t0 < v.life);
      for (let k = 0; k < waves.length; k++) {
        const v = waves[k], age = now - v.t0, D = v.D;
        for (let i = 0; i < n; i++) {
          const tau = age - D[i];
          if (tau <= 0 || tau >= WINDOW) continue;
          const e = v.strength * (tau < 200 ? eases.outQuad(tau / 200) : 1 - eases.outExpo((tau - 200) / 760));
          if (e > E[i]) { E[i] = e; C[i] = k; }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      let m = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.075)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) { if (E[i] < 0.02) { ctx.moveTo(X[i] + 1.1, Y[i]); ctx.arc(X[i], Y[i], 1.1, 0, 6.3); } else lit[m++] = i; }
      ctx.fill();
      // lit dots, grouped by wave and by brightness so each group is one fill
      for (let k = 0; k < waves.length && m; k++) {
        const [r, g, b] = waves[k].rgb;
        for (let band = 0; band < BANDS; band++) {
          let any = false;
          for (let j = 0; j < m; j++) {
            const i = lit[j], e = E[i];
            if (C[i] !== k || Math.min(BANDS - 1, Math.floor(e * BANDS)) !== band) continue;
            if (!any) { ctx.beginPath(); any = true; }
            const rad = 1.1 + e * 2.6;
            ctx.moveTo(X[i] + rad, Y[i]); ctx.arc(X[i], Y[i], rad, 0, 6.3);
          }
          if (any) { ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + ((band + 0.5) / BANDS) * 0.85})`; ctx.fill(); }
        }
      }
    }
    const loop = (now) => { draw(now); raf = waves.length ? requestAnimationFrame(loop) : 0; };

    function wave(x, y, tone = 'lime', strength = 1) {
      if (!n) return;
      const hex = (TONE[tone] || TONE.lime)[0], rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const reach = Math.hypot(w, h) * 0.75, D = new Float32Array(n);
      let far = 0;
      for (let i = 0; i < n; i++) { const d = Math.hypot(X[i] - x, Y[i] - y); if (d < reach) { D[i] = d * 0.95; if (D[i] > far) far = D[i]; } else D[i] = Infinity; }
      waves.push({ t0: performance.now(), D, rgb, strength, life: far + WINDOW });
      if (waves.length > 6) waves.shift();
      if (!raf) raf = requestAnimationFrame(loop);
    }

    layout();
    setRipple(wave);
    addEventListener('resize', layout);
    // a first wave from the middle, then the grid breathes on its own now and then
    const hello = setTimeout(() => !calm && wave(w / 2, h * 0.3, 'lime', 1), 350);
    const idle = setInterval(() => { if (!calm && !document.hidden) wave(utils.random(0, w), utils.random(0, h), 'lime', 0.35); }, 7000);
    const stopSheen = startSheen();
    return () => { removeEventListener('resize', layout); clearTimeout(hello); clearInterval(idle); cancelAnimationFrame(raf); setRipple(null); stopSheen(); };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0">
        {lights.map((l, i) => <div key={i} className={`absolute ${l.box}`}><i className="absolute top-1/2 left-1/2 block rounded-full" style={l.style} /></div>)}
      </div>
      <canvas ref={canvas} className="absolute top-0 left-0 h-lvh w-full" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 40%, rgb(0 0 0 / 0.55) 100%)' }} />
    </div>
  );
}
