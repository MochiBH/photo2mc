export default async (p) => {
  const dump = async (l) => { await p.waitForTimeout(700); console.log('\n== ' + l); console.log(await p.$$eval('ol li', (e) => e.map((x) => x.querySelector('span.min-w-0 .text-base').textContent).join(' > '))); console.log(await p.$$eval('main .rounded-xl.px-3\\.5 > div:first-child', (e) => e.map((x) => '* ' + x.textContent + ': ' + x.nextSibling.textContent).join('\n'))); };
  const al = ['Lux', 'Yasuo', 'Jinx', 'Teemo'], en = [['Darius', 'Conqueror'], ['yi', 'Lethal Tempo'], ['Syndra', 'Electrocute'], ['cait', 'Fleet Footwork'], ['Leona', 'Aftershock']];
  for (let i = 0; i < 4; i++) await p.fill('#ally-' + i, al[i]);
  for (let i = 0; i < 5; i++) { await p.fill('#enemy-' + i, en[i][0]); await p.selectOption('#rune-' + i, en[i][1]); }
  await dump('tank, no frontline');
  await p.click('ol li button >> nth=0'); await p.click('ol li button >> nth=1');
  await p.click('[aria-label="Enemy 2 is fed"]'); await p.click('[aria-label="Teammate 3 is fed"]'); await p.click('nav[aria-label="How your game is going"] button:has-text("Behind")');
  await dump('2 bought, Yi fed, Jinx fed, behind');
  await p.fill('#ally-0', 'Malphite'); await dump('Malphite -> AP');
  await p.click('nav[aria-label="Your champion"] button:has-text("Kha")'); await dump('kha');
};
