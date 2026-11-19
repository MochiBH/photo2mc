import base from './steps-track.mjs';
export default async (p) => { await base(p); console.log(await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > 400.5).slice(0, 6).map((e) => e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 70) + ' r=' + e.getBoundingClientRect().right.toFixed(1)))); };
