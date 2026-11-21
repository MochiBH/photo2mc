import { DECKS, TAGNAME } from './legacy';

/* The course for a role. The owner's jungle course also carries the questions and notes written from his own games. */
export function content(role, personal) {
  if (role === 'support') {
    const tags = { lane: 'Lane', vision: 'Vision', roam: 'Roaming', fights: 'Fights', macro: 'Macro', build: 'Builds', enchanter: 'Enchanters', engage: 'Engage' };
    return { lessons: window.SUPPORT_LESSONS || [], bank: window.SUPPORT_BANK || [], tagName: tags, first: 'all',
      decks: [['all', 'All'], ...Object.entries(tags), ['missed', 'Missed']] };
  }
  const lessons = (window.LESSONS || []).map((l) => (personal ? l : { ...l, you: undefined }));
  const bank = (personal ? window.LEAKS || [] : []).concat(window.BANK || []);
  return { lessons, bank, tagName: TAGNAME, first: personal ? 'leak' : 'all', decks: DECKS.filter(([id]) => personal || id !== 'leak') };
}
