import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch();
try { const p = await b.newPage({ viewport: { width: 400, height: 760 }, colorScheme: 'light' }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4319/'); await p.waitForSelector('#auth-email', { timeout: 15000 }); await p.click('button:has-text("Create account")'); await p.waitForTimeout(700);
  console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), JSON.stringify(errs)); await p.screenshot({ path: 'dist/shot-signin.png' });
} finally { await b.close(); try { process.kill(-server.pid); } catch (e) {} }
