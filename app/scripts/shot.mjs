// Local check: node scripts/shot.mjs <tab> [dark|light] [steps.js]; writes dist/shot-<tab>-<scheme>.png
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
const [tab = 'learn', scheme = 'light', steps] = process.argv.slice(2);
const dist = new URL('../dist/', import.meta.url);
writeFileSync(new URL('test.html', dist), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + readFileSync(new URL('index.html', dist), 'utf8') + '</body></html>');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, colorScheme: scheme });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errs.push(m.text()); });
await p.goto(new URL('test.html', dist).href);
await p.click(`nav[aria-label="Sections"] button[aria-label="${tab[0].toUpperCase() + tab.slice(1)}"]`);
await p.waitForTimeout(900);
if (steps) { const fn = (await import(new URL(steps, 'file://' + process.cwd() + '/').href)).default; await fn(p); await p.waitForTimeout(900); }
console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', JSON.stringify(errs));
await p.screenshot({ path: new URL(`shot-${tab}-${scheme}.png`, dist).pathname, fullPage: !process.env.VIEWPORT });
await b.close();
