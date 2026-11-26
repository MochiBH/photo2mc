// Filling the Live team sheet from a picture. The picture is shrunk in the browser, read by Claude on the server
// (api/teams.js), and what comes back is placed into the rows here.
import { champOf } from './legacy';
import { ALLY_ROWS, ENEMY_ROWS } from './live';

const SCREEN = { champion_select: 'champion select', loading_screen: 'the loading screen', scoreboard: 'the scoreboard' };
const LONG_EDGE = 1568;   // the largest size Claude reads at full detail; anything bigger only makes the upload slower

/** A picture file (or pasted image) as a JPEG no larger than Claude needs: { image: base64, mediaType }. */
export async function shrink(file) {
  const bitmap = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error('That file is not a picture.')); img.src = URL.createObjectURL(file); }));
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { image: url.slice(url.indexOf(',') + 1), mediaType: 'image/jpeg' };
}

/* Put each found champion in the row for its lane; anyone whose lane is unknown, or taken, goes in the first free row. */
function seat(found, lanes, before) {
  const rows = lanes.map(() => null), spare = [];
  for (const p of found) { const i = lanes.indexOf(p.lane); if (i > -1 && !rows[i]) rows[i] = p.c; else spare.push(p.c); }
  for (const c of spare) { const i = rows.indexOf(null); if (i > -1) rows[i] = c; }
  // a row keeps its Fed mark and rune only if the same champion is still in it
  return rows.map((c, i) => (c && before[i] && champOf(before[i].c) === c ? { ...before[i], c } : { ...before[i], c: c || '', f: 0, ...('r' in (before[i] || {}) ? { r: '' } : {}) }));
}

/** What a reading changes in the Live state, and a line to tell the player.
    `found` is the server's answer: { screen, allies: [{ champion, lane, is_player }], enemies: [{ champion, lane }], note }. */
export function placeTeams(bst, role, found) {
  const name = (c) => champOf(c) || String(c || '').trim();
  const allies = (found.allies || []).map((a) => ({ c: name(a.champion), lane: a.lane, me: !!a.is_player })).filter((a) => a.c);
  const enemies = (found.enemies || []).map((a) => ({ c: name(a.champion), lane: a.lane })).filter((a) => a.c);
  const count = allies.length + enemies.length;
  if (!count) return { patch: null, count: 0, message: found.note || 'No champions found in that picture. Use champion select, the loading screen or the scoreboard.' };

  const patch = {}, myLane = role === 'support' ? 'support' : 'jungle', current = champOf(bst.me);
  // the player's own pick: marked by the reader, else whoever is in the player's lane, else the champion already chosen
  const mine = allies.find((a) => a.me) || allies.find((a) => a.lane === myLane) || allies.find((a) => current && a.c === current) || null;
  if (mine && mine.c !== current) { patch.me = mine.c; patch.bought = []; }
  if (allies.length) patch.allies = seat(allies.filter((a) => a !== mine), ALLY_ROWS[role].map((l) => l.toLowerCase()), bst.allies);
  if (enemies.length) patch.rows = seat(enemies, ENEMY_ROWS.map((l) => l.toLowerCase()), bst.rows);

  const unknown = [...allies, ...enemies].filter((a) => !champOf(a.c)).map((a) => a.c);
  const parts = [`Filled ${count} of 10 from ${SCREEN[found.screen] || 'the picture'}.`];
  if (count < 10) parts.push('Snap again when more are locked in, or type the rest.');
  if (unknown.length) parts.push(`Not recognised: ${unknown.join(', ')}.`);
  if (found.note) parts.push(found.note);
  return { patch, count, message: parts.join(' ') };
}
