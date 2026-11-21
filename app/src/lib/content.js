import { DECKS, TAGNAME } from './legacy';

/* The course for a role. The owner's jungle course also carries the questions and notes written from his own games. */
export function content(role, riotId) {
  const personal = riotId === 'the gonzoogler#weeee', mine = (window.PLAYER_LEAKS || {})[riotId] || [];
  if (role === 'support') {
    const tags = { rell: 'Rell', lane: 'Lane', vision: 'Vision', roam: 'Roaming', fights: 'Fights', macro: 'Macro', build: 'Builds', enchanter: 'Enchanters', engage: 'Engage' };
    if (mine.length) tags.leak = 'Your leaks';
    return { lessons: window.SUPPORT_LESSONS || [], bank: mine.concat(window.SUPPORT_BANK || [], window.RELL_BANK || []), tagName: tags, first: mine.length ? 'leak' : 'all',
      decks: [...(mine.length ? [['leak', 'Your leaks']] : []), ['all', 'All'], ...Object.entries(tags).filter(([k]) => k !== 'leak'), ['missed', 'Missed']] };
  }
  const lessons = (window.LESSONS || []).map((l) => (personal ? l : { ...l, you: undefined }));
  const bank = (personal ? window.LEAKS || [] : []).concat(window.BANK || []);
  return { lessons, bank, tagName: TAGNAME, first: personal ? 'leak' : 'all', decks: DECKS.filter(([id]) => personal || id !== 'leak') };
}
