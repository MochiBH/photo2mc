/* The course. Written for The Gonzoogler from his own match data (OP.GG, pulled Nov 19, 2026).
   body: paragraphs. you: what his games show. rule: the one thing to take into the next game. quiz: question ids. */
window.LESSONS = [
{id:"win", part:"The big picture", title:"How games are really won",
 hook:"Kills don't win games. Here's what does.",
 body:[
  "League looks like a game about kills. It isn't. The only thing that ends a game is a Nexus dying, and the only road to a Nexus runs through towers.",
  "So think of the game as a chain. Gold buys items. Items win fights. Won fights give you objectives and towers. Towers open the map until the base falls. A kill only matters if it moves you one link down that chain.",
  "That changes what a good play is. A kill followed by a dragon is a great play. A kill followed by everyone walking back to lane is a small one. And a death that hands the enemy a dragon is much worse than it looks on the scoreboard.",
  "You're the one player with no lane to look after. That makes your job simple to say: be the extra person wherever the next link in the chain is about to be decided."
 ],
 you:"When your team is ahead on dragons you're 8–0. When it's behind, 1–4. The chain shows up in your own games.",
 rule:"After every kill, ask: what do we take with this?",
 quiz:["m6","m14","m13","m5"]},

{id:"tempo", part:"The big picture", title:"Tempo: what junglers actually trade in",
 hook:"Your jungle pays you on a schedule. Time is what you spend.",
 body:[
  "Every camp in your jungle comes back on a timer. Clear it and you get gold and experience. Leave it sitting there and that gold never exists. Your jungle is a machine that pays you on a schedule.",
  "Everything you do costs time: a gank, a walk across the map, waiting in a bush, a death. Tempo is just one question asked over and over: what did I get for the time I spent?",
  "Good junglers run a loop. Clear the camps near you. Look at the map. Make the best play that's available. Recall when you have gold. Start again. They are almost never standing still.",
  "This is why a failed gank isn't free. You paid two camps for it. Waiting 20 seconds in a bush costs about the same as losing a small fight. When no play is available, farming is the play. It isn't a failure to find one."
 ],
 you:"You average about 4.4 jungle CS a minute: 4.7 in wins, 4.0 in losses. Your best games are above 5.",
 rule:"Never stand still. If you don't know what to do, clear the nearest camp while you decide.",
 quiz:["m16","m9","m12","l9"]},

{id:"first5", part:"The early game", title:"The first five minutes",
 hook:"The most scripted part of your job, so the easiest to get right every game.",
 body:[
  "The early game is close to a script, which means you can get it right every single time.",
  "Start with a full clear: all six camps, from one side of your jungle to the other. You come out at level 4 with both buffs. On Nunu, Consume keeps you healthy the whole way. On Kha'Zix, those levels are what make you dangerous.",
  "Decide in the loading screen which side you'll finish on. End your clear where a play is likely: next to a teammate with a stun, next to an enemy who pushes too far, or on the side of the first dragon, which spawns at 5:00.",
  "You also get a free clue. Whichever enemy lane showed up late probably helped their jungler start, which tells you which side he began on and which way he's moving.",
  "Level 2 and level 3 ganks feel exciting, and at your rank they mostly lose games. You fall behind on camps for a coin flip. Clear first, then look."
 ],
 you:"This is already your strongest phase: about 56 jungle CS at ten minutes on Nunu. The problems come later.",
 rule:"Full clear, then look. Pick your finishing side in the loading screen.",
 quiz:["m1","m11","m10","n5"]},

{id:"gank", part:"The early game", title:"Reading a lane before you gank it",
 hook:"Three checks that tell you if a gank will work before you walk there.",
 body:[
  "Most failed ganks were never going to work. You can tell from your jungle, before you spend the time, with three checks.",
  "One: where is the wave? The enemy has to be far from his tower. If the minions are fighting on his side of the lane, he takes two steps and he's safe.",
  "Two: does he have an escape? An enemy with Flash down, or his dash on cooldown, is a completely different target. Your laners know. Watch for their pings.",
  "Three: can your laner help? A laner with a stun and decent health turns your gank into a kill. A laner at 20% health turns it into two kills for them.",
  "Then pick your angle. Arriving from behind or from the side takes away the direction they want to run. For Nunu this is everything: a big snowball out of the fog is a kill, and a snowball they watched roll down the lane is a sidestep.",
  "When it works, don't leave empty-handed. Push the wave with your laner, hit the tower, or take the dragon next door."
 ],
 you:"Your kill participation is about 50%. For a ganking champion like Nunu that's low, and better gank choices raise it without playing more aggressively.",
 rule:"Three checks before you leave your camps: wave, escape, follow-up. Two out of three is a no.",
 quiz:["m9","m10","n2","n3","n8"]},

{id:"track", part:"The early game", title:"Finding the enemy jungler",
 hook:"You can't see him, but he's on the same schedule you are.",
 body:[
  "The enemy jungler has the same six camps, the same first clear and the same timers as you. That makes him predictable even when you can't see him.",
  "You get three kinds of clue. Where he started, from the lane that arrived late. Where he just was, every time he shows on the map or his camps are missing. And where he can't be: for the next 20 to 30 seconds after he shows top, he is not bot.",
  "Use it. When he shows top side, you play bot side. Anything on the far side of the map is a play he can't answer: a gank, his camps, a dragon.",
  "Use it in reverse too. When you have no idea where he is and your laner is pushed up, assume he's there and ping your laner back. Stopping a death is worth as much as getting a kill.",
  "Different junglers want different things. Farmers like Master Yi, Evelynn and Shyvana want a quiet game, so take their camps and start fights early. Early fighters like Xin Zhao and Warwick want to catch you alone, so don't be alone."
 ],
 you:"In your four recent Nunu losses the enemy jungler finished with 677 jungle CS to your 407. He was left alone to farm.",
 rule:"Every time he shows on the map, say where he is and play the other side.",
 quiz:["m12","x2","x3","x5","n7"]},

{id:"death", part:"Staying alive", title:"What a death really costs",
 hook:"Your biggest lever. Five or fewer deaths and you haven't lost.",
 body:[
  "On the scoreboard a death is one number. In the game it's four things at once.",
  "The enemy gets gold. You lose the camps you would have cleared while you were dead and walking back. Your team is one player short, so whatever objective is up becomes theirs. And if you had a bounty, you just handed over the reward for all your earlier work.",
  "It also gets more expensive every minute. Early, a death costs you a few seconds. Late, it costs most of a minute, which is long enough to lose Baron and then the game.",
  "Nearly all deaths at your rank come from three situations: fighting when the other side has more people, walking alone into jungle you can't see, and staying for one more kill at low health. Notice that none of those need better mechanics. They need you to leave ten seconds earlier.",
  "So treat deaths as a budget. You get five a game. Spend them at objectives, where a trade might be worth it. Don't spend them in the river over a crab."
 ],
 you:"With five or fewer deaths you're 7–0. With six or more you're 3–6. On Nunu you average 7.3.",
 rule:"After your fourth death, you only fight at an objective.",
 quiz:["l1","l5","l6","l7","m18","m7"]},

{id:"vision", part:"Staying alive", title:"Vision: buying information",
 hook:"Almost every death starts with walking somewhere you couldn't see.",
 body:[
  "Look back at the three ways people die. Two of them are really the same thing: you didn't know who was there.",
  "Vision is information you can buy. A control ward costs about as much as a few minions, and it stays until someone kills it. It shows you who's waiting, it protects your team's way into a dragon fight, and it switches off enemy wards sitting next to it.",
  "Three habits cover most of it. Buy a control ward on every recall once you have your first item. Put it in the river brush beside the next objective. And sweep with Oracle Lens before the fight starts, on the path you're about to walk.",
  "When you're ahead, put wards in their jungle so you see them coming. When you're behind, put them in yours so you stop dying there."
 ],
 you:"Control wards bought across your last 20 games: zero.",
 rule:"Every recall: one control ward. It goes beside the next objective.",
 quiz:["l12","l13","l16","m17","x4","k7"]},

{id:"objectives", part:"Winning the map", title:"Objectives: setup beats Smite",
 hook:"Dragon fights are decided before anyone hits the dragon.",
 body:[
  "The team that arrives first, with vision and full health, gets to choose where to stand. The team that arrives second has to walk into them. That's most of the fight, and it happens before the dragon takes any damage.",
  "So work backwards from the clock. About a minute before the spawn: recall and spend your gold, walk back with a control ward, clear the brush around the pit, and be standing in the river before they are.",
  "This season's clock: dragon at 5:00, Voidgrubs at 8:00 and only once, Rift Herald at 15:00 and only once, Baron at 20:00.",
  "Your lanes matter more than you do. If the lanes near the objective are stuck under their towers, they can't come, and you can't fight three people alone. That's when you trade: give it up and take something on the other side of the map, so the enemy pays for it.",
  "The Smite is the last 5% of the job. Nunu has the best finish in the game with Consume and Smite together, but it only counts if your team was in position to fight."
 ],
 you:"Ahead on dragons: 8–0. Behind: 1–4. Six of your last ten wins came with four dragons.",
 rule:"One minute before every objective: recall, ward, arrive first.",
 quiz:["m2","m3","m8","m20","n1","l14","l15"]},

{id:"midgame", part:"Winning the map", title:"The mid-game: keep getting paid",
 hook:"Where your losses actually happen.",
 body:[
  "Around 14 minutes the lanes break up and the game turns into a scrum around mid. This is where most junglers at your rank stop farming, and it's where games slip away without anyone noticing.",
  "Your camps didn't stop spawning. Every minute you spend following teammates around with no plan, gold sits uncollected in your jungle. The enemy jungler who keeps clearing arrives at the next fight a level and an item ahead, and it just looks like he's better than you.",
  "The fix is a habit: clear on the way. Before you cross to the other side of the map, take the camps on this side. Between two objective fights there is almost always time for two or three camps.",
  "Take what your lanes leave behind as well. A minion wave crashing into your tower with nobody there is free gold. Catch it, then move.",
  "Every few minutes, press Tab and compare your CS with the enemy jungler's. If he's 30 ahead, you've been wandering."
 ],
 you:"Xin Zhao: 225 jungle CS to your 94. Briar: 203 to 135. Shyvana: 112 to 68 in under 15 minutes. Your first ten minutes are fine. The gap opens after.",
 rule:"Clear your side before you cross the map.",
 quiz:["l8","l9","l10","l11","m16"]},

{id:"fights", part:"Winning the map", title:"Team fights: know your job",
 hook:"Every champion has one job. Doing someone else's is how you die first.",
 body:[
  "In a fight, each kind of champion has one job. Front line goes first, soaks abilities and locks someone down. Burst waits, then deletes one target. Carries stay alive and deal damage the whole fight. Supports keep the carry alive.",
  "Nunu can be two different champions depending on what you buy. Built tank, you are the front line: snowball in first, root them, and channel your ult in the middle of their team. Built AP, you are burst. You can't go first, because you die before the ult finishes. You wait for your tank and arrive from the side.",
  "So choose the build in champion select by looking at your team. If nobody else can go first, build tank. If you already have a Malphite or a Leona, AP is fine.",
  "Kha'Zix is always burst. Stay out of sight until the fight has started and their big abilities are used, then jump on the carry at the back. If you're the first person they see, you've done a tank's job with an assassin's health bar.",
  "And before any fight, count heads. If they have more people there, there is no fight. Leave."
 ],
 you:"You've built full AP Nunu in every recent game and you average 7.3 deaths on him. Those two facts are probably connected.",
 rule:"In champion select, decide it: 'I go first' or 'I go second.'",
 quiz:["n9","n4","k4","l2","l3","l4","x1","x7"]},

{id:"close", part:"Winning the map", title:"Closing the game",
 hook:"Being ahead doesn't win. Converting does.",
 body:[
  "A lead is not a win. You have to turn it into a dead Nexus, and that takes a different plan from the one that got you ahead.",
  "After 20 minutes the pattern is: catch someone or win a fight, take Baron, then push as a group with the buff. Baron makes your minions strong enough that the enemy can't hold three lanes at once.",
  "Leads get thrown one way far more than any other. Someone, often the fed player, gets caught alone right before an objective. Now it's four against five and the lead is gone.",
  "So when you're ahead, the rules flip. Stop hunting for solo kills. Stay near at least one teammate. Keep vision around Baron and dragon. Make them walk into you.",
  "When you're behind, run the mirror image: farm safely, defend towers, ward your own jungle, and wait for them to make that exact mistake."
 ],
 you:"Your wins are built on stacked objectives, not kills. Play for the fourth dragon and Baron and the rest follows.",
 rule:"Ahead: never alone. Behind: never first.",
 quiz:["m14","m15","m4","k10","b8"]},

{id:"nunu", part:"Your champions", title:"Nunu, properly",
 hook:"He wins on speed and objectives, not duels.",
 body:[
  "Nunu's strengths are all about tempo. He clears fast and stays healthy. His snowball gets him to a lane faster than anyone expects. Consume plus Smite is the strongest objective finish in the game. And his crowd control chains: knock-up, slow, root, ult.",
  "His weaknesses are just as clear. He loses early one-on-ones to real duelists like Xin Zhao and Warwick. Any stun or knock-up cancels his ult. And built AP, he's fragile.",
  "The combo is always the same. Snowball from out of sight. E to slow and then root. Ult on the rooted target so they can't walk out.",
  "If someone invades you, fight beside a camp. Consume on a monster heals far more than Consume on a champion, and good opponents will try to drag you away from your camps for exactly that reason.",
  "So a Nunu game plan fits in one sentence: full clear, gank the lane that passes the three checks, be first to every dragon with Consume ready, and pick tank or AP by what your team is missing."
 ],
 you:"Nunu this season: 11–15 overall, and 5–4 in your last nine.",
 rule:"Snowball from where they can't see it, or don't throw it.",
 quiz:["n2","n3","n6","n4","b3","b4"]},

{id:"kha", part:"Your champions", title:"Kha'Zix, properly",
 hook:"The opposite kind of jungler: he wins by finding people alone.",
 body:[
  "Kha'Zix does extra damage to anyone who is isolated, meaning no allied champions, minions or towers near them. Jungle monsters don't count. So an enemy jungler at his own camp is isolated, and that's your best early fight.",
  "His game has three stages. Early, invade junglers who are weak or want to farm, and fight them at their camps. In the middle, catch solo laners in the side lanes. In team fights, come in late and from the side, onto whoever is standing alone at the back.",
  "Evolve Q first in almost every game. After that, E gives you a reset on kills so you can get out again, which matters most against teams that group.",
  "Being unseen is the whole champion. That's why Umbral Glaive comes first: it kills wards on your path so the target doesn't know you're coming.",
  "His weakness is time. Against five people standing together, with no lead, he has nobody to jump on. Use the first 15 minutes."
 ],
 you:"Kha'Zix this season: 5–0. It's a small sample, and it's a reason to play him more.",
 rule:"Before you jump: is this person alone? If not, find someone who is.",
 quiz:["k1","k2","k3","k5","k6","k9","x9"]},

{id:"climb", part:"Climbing", title:"How people actually climb",
 hook:"Rank is your average game, repeated.",
 body:[
  "Your rank is your average game played many times over. You don't need to beat your best game. You need your normal game to get slightly better and your bad games to get much less bad.",
  "Play one role and two champions. Every jungle game on Nunu or Kha'Zix teaches the same lessons again, and that repetition is where improvement comes from. Your two recent games as ADC were both losses.",
  "Play in blocks of three. If you lose two in a row, stop for the day. The games you play frustrated are the ones with ten deaths in them.",
  "Pick one focus for each session, not ten. Right now it's deaths. When five or fewer feels normal, move to control wards, then mid-game farm.",
  "After each game, before you queue again, look at one thing: your deaths. For each one, was it at an objective? If it wasn't, what did you walk into? That's a 30-second review and it's enough.",
  "If chat pulls your attention, mute it. Pings carry everything you need."
 ],
 you:"Your last 16 ranked jungle games: 10 wins, 6 losses. You're already winning more than you lose in your role.",
 rule:"Three-game blocks. One focus. Stop after two losses in a row.",
 quiz:[]}
];
