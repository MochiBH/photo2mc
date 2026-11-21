export default async (p) => {
  const right = async () => { const btns = p.locator('main button:has(kbd)'); const n = await btns.count(); for (let i = 0; i < n; i++) { await btns.nth(i).click(); const ok = await p.locator('text=Best play').count(); const mine = await p.locator('text=Your pick').count(); return { ok, mine }; } };
  let got = 0;
  for (let q = 0; q < 6 && !got; q++) {
    await p.locator('main button:has(kbd)').first().click();
    await p.waitForTimeout(60);
    const sparks = await p.evaluate(() => document.querySelectorAll('body > div[style*="z-index: 60"] i').length);
    const wrong = await p.locator('text=Your pick').count();
    if (!wrong) { got = sparks; console.log('correct answer -> sparks on screen:', sparks); await p.screenshot({ path: 'dist/a-burst.png' }); break; }
    await p.click('button:has-text("Next question")'); await p.waitForTimeout(500);
  }
  if (!got) console.log('no correct answer in 6 tries');
};
