export default async (p) => {
  await p.fill('#me-champ', 'Rell').catch(() => {});
  await p.click('nav[aria-label="Live sections"] button:has-text("Track")'); await p.waitForTimeout(600);
  await p.click('button:has-text("Start when the game starts")');
  for (let i = 0; i < 4; i++) await p.click('[aria-label="Clock forward 1 minute"]');
  for (let i = 0; i < 2; i++) await p.click('[aria-label="Clock forward 10 seconds"]');
  await p.waitForTimeout(1100);
  await p.click('button:has-text("They took it") >> nth=0'); await p.click('button:has-text("Died for nothing")'); await p.click('button:has-text("Died, we got one too")');
  await p.waitForTimeout(700);
  await p.click('button:has-text("We took it") >> nth=0'); await p.waitForTimeout(160);   // catch the burst mid-flight
};
