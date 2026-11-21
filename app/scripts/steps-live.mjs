// Fills both teams and prints the build and plan for a few champions. Pass the champion list via LIVE_CHAMPS="A,B".
export default async (p) => {
  const sec = async (n) => { await p.click(`nav[aria-label="Live sections"] button:has-text("${n}")`); await p.waitForTimeout(500); };
  const dump = async (l) => { await sec('Build'); await p.waitForTimeout(500); console.log('\n== ' + l + ' | ' + (await p.textContent('main [aria-live="polite"] > div:first-child')));
    console.log(await p.$$eval('ol li', (e) => e.map((x) => x.querySelector('span.min-w-0 .text-base').textContent).join(' > ')));
    console.log(await p.$$eval('main .rounded-xl.px-3\\.5 > div:first-child', (e) => e.map((x) => '* ' + x.textContent + ': ' + x.nextSibling.textContent.slice(0, 230)).join('\n'))); await sec('Teams'); };
  const support = (await p.getAttribute('nav[aria-label="Role"] button[aria-label="Support"]', 'aria-pressed')) === 'true';
  const al = support ? ['Garen', 'Lee Sin', 'Ahri', 'Jinx'] : ['Lux', 'Yasuo', 'Jinx', 'Teemo'];
  const en = [['Darius', 'Conqueror'], ['yi', 'Lethal Tempo'], ['Syndra', 'Electrocute'], ['cait', 'Fleet Footwork'], ['Blitzcrank', 'Aftershock']];
  for (let i = 0; i < 4; i++) await p.fill('#ally-' + i, al[i]);
  for (let i = 0; i < 5; i++) { await p.fill('#enemy-' + i, en[i][0]); await p.selectOption('#rune-' + i, en[i][1]); }
  for (const c of (process.env.LIVE_CHAMPS || (support ? 'Lulu,Leona,Brand' : 'Nunu & Willump,Lee Sin,Amumu,Lillia')).split(',')) { await p.fill('#me-champ', c); await dump(c); }
  await p.click('[aria-label="Enemy 2 is fed"]'); await p.click('[aria-label="Teammate 4 is fed"]'); await dump('fed: enemy jungle + teammate 4');
};
