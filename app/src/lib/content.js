import { DECKS, TAGNAME } from './legacy';

/* The course for a role: lessons, drill questions and the decks they sort into. The owner's jungle course also carries
   the questions and notes written from his own games; other players' own questions come from player-leaks.js. */
export function content(role, riotId) {
  const personal = riotId === 'the gonzoogler#weeee';
  // questions written from one player's own games, kept per role
  const mine = ((window.PLAYER_LEAKS || {})[riotId] || {})[role] || [];
  const course = (lessons, bank, tags) => {
    if (mine.length) tags = { ...tags, leak: 'Your leaks' };
    return { lessons, bank: mine.concat(bank), tagName: tags, first: mine.length ? 'leak' : 'all',
      decks: [...(mine.length ? [['leak', 'Your leaks']] : []), ['all', 'All'], ...Object.entries(tags).filter(([k]) => k !== 'leak'), ['missed', 'Missed']] };
  };
  if (role === 'top') {
    return course(window.TOP_LESSONS || [], (window.TOP_BANK || []).concat(window.KLED_BANK || [], window.RENEKTON_BANK || []),
      { kled: 'Kled', renekton: 'Renekton', lane: 'Trading', wave: 'Waves', gank: 'Ganks', tp: 'Recalls', side: 'Side lane', fights: 'Fights', macro: 'Objectives', build: 'Matchups' });
  }
  if (role === 'support') {
    return course(window.SUPPORT_LESSONS || [], (window.SUPPORT_BANK || []).concat(window.RELL_BANK || []),
      { rell: 'Rell', lane: 'Lane', vision: 'Vision', roam: 'Roaming', fights: 'Fights', macro: 'Macro', build: 'Builds', enchanter: 'Enchanters', engage: 'Engage' });
  }
  const lessons = (window.LESSONS || []).map((l) => (personal ? l : { ...l, you: undefined }));
  const bank = (personal ? window.LEAKS || [] : []).concat(window.BANK || []);
  return { lessons, bank, tagName: TAGNAME, first: personal ? 'leak' : 'all', decks: DECKS.filter(([id]) => personal || id !== 'leak') };
}
