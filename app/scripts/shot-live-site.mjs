// Signs in through the real site in a headless browser and screenshots the result.
// Usage: SITE=https://... PLAYER_PASSWORD=... node scripts/shot-live-site.mjs <username> [tab]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [username, tab] = process.argv.slice(2), { SITE, PLAYER_PASSWORD, HTTPS_PROXY } = process.env;
const b = await chromium.launch(HTTPS_PROXY ? { proxy: { server: HTTPS_PROXY } } : {});
try {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(SITE, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#auth-username', { timeout: 20000 });
  await p.fill('#auth-username', username); await p.fill('#auth-password', PLAYER_PASSWORD);
  await p.click('button:has-text("Sign in")');
  await p.waitForSelector('nav[aria-label="Sections"]', { timeout: 30000 });
  await p.waitForTimeout(2500);
  if (tab) { await p.click(`nav[aria-label="Sections"] button[aria-label="${tab[0].toUpperCase() + tab.slice(1)}"]`); await p.waitForTimeout(1800); }
  const text = (await p.textContent('main')).replace(/\s+/g, ' ').slice(0, 260);
  console.log(username, '| header:', (await p.textContent('header')).replace(/\s+/g, ' ').slice(0, 60), '| scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), '| errors', JSON.stringify(errs));
  console.log('  ', text);
  await p.screenshot({ path: `${process.env.OUT || 'dist'}/live-${username}${tab ? '-' + tab : ''}.png` });
} finally { await b.close(); }
