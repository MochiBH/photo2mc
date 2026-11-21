// Local check against a demo build: VITE_DEMO=1 npx vite build && node scripts/shot.mjs <tab> [light|dark] [steps.mjs] [jungle|support]
// Serves dist with `vite preview`, opens the tab, runs optional steps, and writes dist/shot-<tab>-<scheme>.png.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const [tab = 'learn', scheme = 'light', steps = '', role = 'jungle'] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, colorScheme: scheme });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:4319/');
  await p.waitForSelector('nav[aria-label="Sections"]', { timeout: 15000 });
  if (role === 'support') { await p.click('nav[aria-label="Role"] button:has-text("Support")'); await p.waitForTimeout(500); }
  await p.click(`nav[aria-label="Sections"] button[aria-label="${tab[0].toUpperCase() + tab.slice(1)}"]`);
  await p.waitForTimeout(900);
  if (steps) { const fn = (await import(new URL(steps, 'file://' + process.cwd() + '/').href)).default; await fn(p); await p.waitForTimeout(900); }
  console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', JSON.stringify(errs));
  await p.screenshot({ path: `dist/shot-${tab}-${scheme}.png`, fullPage: !process.env.VIEWPORT });
} finally { await b.close(); try { process.kill(-server.pid); } catch (e) {} }
