// How heavy is the site on a phone? Runs the demo build in a phone-sized Chromium with the CPU slowed down and reports,
// per scenario, how busy the page was and how many frames ran late.
// Usage: VITE_DEMO=1 npx vite build && node scripts/perf.mjs [cpu slowdown, default 4]
// It is a relative measure (Chromium, not Safari): run it before and after a change and compare.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const rate = Number(process.argv[2] || 4);
const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch();
const HEAVY = ['Paint', 'PaintImage', 'RasterTask', 'ImageDecodeTask', 'Layerize', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'FunctionCall', 'FireAnimationFrame', 'Commit', 'EvaluateScript', 'v8.compile', 'TimerFire', 'EventDispatch'];
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const t0 = Date.now();
  await p.goto('http://localhost:4319/');
  await p.waitForSelector('nav[aria-label="Sections"]', { timeout: 30000 });
  console.log(`cpu x${rate} slower | app shell after ${Date.now() - t0} ms`);
  const tab = (name) => p.click(`nav[aria-label="Sections"] button[aria-label="${name}"]`);
  await tab('Home'); await p.waitForTimeout(3500);

  async function measure(name, ms, act) {
    await p.evaluate(() => { const f = (window.__f = []); let last = performance.now(), on = (window.__on = true); const tick = (t) => { f.push(t - last); last = t; if (window.__on) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await b.startTracing(p, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'benchmark'] });
    const a = Date.now();
    if (act) await act();
    await p.waitForTimeout(Math.max(0, ms - (Date.now() - a)));
    const trace = JSON.parse((await b.stopTracing()).toString());
    const frames = await p.evaluate(() => { window.__on = false; return window.__f.slice(2); });
    const sum = {};
    for (const e of trace.traceEvents) if (e.ph === 'X' && HEAVY.includes(e.name)) sum[e.name] = (sum[e.name] || 0) + e.dur / 1000;
    const main = ['Paint', 'Layerize', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'FunctionCall', 'FireAnimationFrame', 'Commit', 'TimerFire', 'EventDispatch'].reduce((s, k) => s + (sum[k] || 0), 0);
    const sorted = [...frames].sort((x, y) => x - y), q = (f) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))] : 0);
    const secs = ms / 1000, r = (v) => Math.round(v || 0);
    console.log(`${name.padEnd(22)} main ${String(r(main / secs)).padStart(4)} ms/s | paint ${String(r(sum.Paint / secs)).padStart(4)} | raster ${String(r(sum.RasterTask / secs)).padStart(5)} | style ${String(r(sum.UpdateLayoutTree / secs)).padStart(4)} | script ${String(r(((sum.FunctionCall || 0) + (sum.FireAnimationFrame || 0) + (sum.TimerFire || 0)) / secs)).padStart(4)} | frames ${String(frames.length).padStart(3)} median ${q(0.5).toFixed(1)} p95 ${q(0.95).toFixed(1)} late(>34ms) ${frames.filter((f) => f > 34).length}`);
  }

  await measure('Home, sitting still', 4000);
  await measure('Home, scrolling', 3000, async () => { for (let i = 0; i < 24; i++) { await p.mouse.wheel(0, i < 12 ? 160 : -160); await p.waitForTimeout(100); } });
  await measure('Home to Map', 2000, () => tab('Map'));
  await measure('Map, sitting still', 3000);
  await measure('Map, opening Charts', 2500, () => p.click('nav[aria-label="Map sections"] button:has-text("Charts")'));
  await measure('Map to Live', 2000, () => tab('Live'));
  await measure('Live, opening Track', 2500, () => p.click('nav[aria-label="Live sections"] button:has-text("Track")'));
  await measure('Live to Home', 2500, () => tab('Home'));
} finally { await b.close(); try { process.kill(-server.pid); } catch (e) {} }
