export default async (p) => {
  await p.click('main button:has-text("How games are really won")'); await p.waitForTimeout(700);
  await p.click('button:has-text("Check yourself")'); await p.waitForTimeout(900);
  for (let i = 0; i < 4; i++) { await p.locator('main button:has(kbd)').first().click(); await p.waitForTimeout(500); await p.click('button:has-text("Next question"), button:has-text("Finish")'); await p.waitForTimeout(600); }
  console.log('after quiz:', (await p.textContent('main')).slice(0, 220));
  await p.click('button:has-text("Back to lessons")'); await p.waitForTimeout(800);
  console.log('learn:', (await p.textContent('main')).slice(0, 120));
};
