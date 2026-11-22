// For scripts/shot.mjs on the Review tab: opens a game (GAME=<index in the list>, default 0), types a note and marks it reviewed.
// LIST=1 stops on the list instead.
export default async (p) => {
  await p.waitForSelector('main ul > li button', { timeout: 8000 });
  const rows = await p.locator('main ul > li button').count();
  console.log('games listed:', rows, '| filters:', (await p.textContent('nav[aria-label="Which games to list"]')).trim());
  if (process.env.LIST) return;
  await p.locator('main ul > li button').nth(Number(process.env.GAME || 0)).click();
  await p.waitForSelector('#review-note', { timeout: 8000 }); await p.waitForTimeout(900);
  console.log('game:', (await p.textContent('main')).replace(/\s+/g, ' ').slice(0, 150));
  console.log('deaths listed:', await p.locator('main ol > li button[aria-pressed]').count(), '| sections:', (await p.locator('main h3').allTextContents()).join(' / '));
  await p.locator('main ol > li button[aria-pressed]').first().click().catch(() => {});
  await p.fill('#review-note', 'Died twice walking into river alone before dragon. Wait for bot lane next time.');
  await p.waitForTimeout(1600);
  await p.click('button:has-text("Mark as reviewed")').catch(() => {});
  await p.waitForTimeout(500);
};
