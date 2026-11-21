/* Which games a screen is looking at: ranked solo, normal draft, or both. The server works out all three sets
   (server/sync.mjs); the switch at the top of Home and Map picks one. */
export const QUEUE_TABS = [{ id: 'both', label: 'Both' }, { id: 'ranked', label: 'Ranked' }, { id: 'normal', label: 'Normals' }];
export const isQueue = (q) => QUEUE_TABS.some((t) => t.id === q);

/** One choice out of everything saved for a player. The ranked numbers sit at the top level; a copy saved before normals
    were added has nothing else, so any choice falls back to it until the next update fills the rest in. */
export const statsFor = (all, queue) => (!all ? null : queue === 'ranked' ? all : all[queue] || all);
export const hasQueues = (all) => !!(all && all.both && all.normal);

const WORDS = {
  ranked: { adj: 'ranked ', source: 'Ranked solo games', pool: 'ranked solo games' },
  normal: { adj: 'normal ', source: 'Normal draft games', pool: 'normal draft games' },
  both: { adj: '', source: 'Ranked solo and normal draft games', pool: 'ranked solo or normal draft games' },
};
/** Words for a set of games, taken from the set itself so a label can never disagree with the numbers under it. */
export const queueWords = (statsOrQueue) => WORDS[(statsOrQueue && statsOrQueue.queue) || (typeof statsOrQueue === 'string' ? statsOrQueue : 'ranked')] || WORDS.ranked;
