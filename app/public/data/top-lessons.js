/* The top lane course. Same shape as support-lessons.js, without the personal "you" field.
   body: paragraphs. rule: the one thing to take into the next game. quiz: question ids from top-bank.js. */
window.TOP_LESSONS = [
{id:"t-job", part:"The big picture", title:"What a top laner is for",
 hook:"Win or survive one lane, then spend the lead somewhere else.",
 body:[
  "Top lane is a long lane at the edge of the map, far from everyone else. For about the first ten minutes it is an island. Your jungler visits now and then, and the rest of the time it is you against one opponent.",
  "That is a big change from support. Nobody stands beside you to rescue a bad fight, and nobody else's mistake decides your lane. Your own gold and levels matter now, because the team expects you to be one of its strong players.",
  "The first half of the job is to beat that one opponent, or at least survive him. Beating him means having more gold and more levels than he has. Surviving means you gave up a few minions and did not die, which is a good result when his champion beats yours early.",
  "The second half is to carry your lead out of the lane. A lead that stays in top lane wins nothing. Early in the game the outer towers have plates, pieces of armor that pay gold when you break them, so a free minute at his tower is money. The Voidgrubs and the Rift Herald both spawn in the pit next to your lane, and the stronger top laner gets there first.",
  "You can also spend a lead far away. Teleport, the spell that carries you across the map to one of your team's towers, lets a top laner turn up at a fight next to bot lane. Later in the game you spend the lead in a side lane, meaning top or bot, by pushing alone so hard that the enemy has to send someone to stop you.",
  "Top laners come in two rough kinds. Bruisers like Renekton, Kled, Darius and Fiora deal real damage and can take some too. They want to win the lane, then push a side lane or jump on the enemy carries, the fragile damage dealers at the back of a fight.",
  "Tanks like Malphite, Ornn and Shen deal less and take far more. They want to get through the lane in one piece, then start team fights and stand in front. Know which kind you picked. A bruiser who plays the lane like a tank throws away his strongest minutes, and a tank who fights like a bruiser dies."
 ],
 rule:"In the loading screen, decide whether you can beat this opponent or should survive him, and where a lead would go.",
 quiz:["tp1","tp2","tp3"]},

{id:"t-wave", part:"Lane", title:"The wave decides the lane",
 hook:"Where the minions meet decides who is safe and who can fight.",
 body:[
  "A wave is the group of minions each side keeps sending down the lane. The two waves meet and fight, and the place where they meet moves up and down the lane. In top lane that place matters more than anything else, because it decides how far you are from your tower.",
  "Last hitting means landing the killing blow on a minion, and only the killing blow pays gold. If both of you only last hit, the wave stays roughly where it is. Pushing means killing his minions faster than he kills yours. Your wave grows and walks toward his tower.",
  "Being pushed up feels strong, and it is the dangerous place to stand. Your tower is far behind you, and their jungler can walk out of the river between you and safety. Near your own tower it is the other way round. You are safe and he is the one exposed.",
  "A slow push is a patient push. Kill a few of his minions, then go back to last hitting, so your wave is a little bigger than his. Each new wave that arrives joins it. After two or three waves you have a large group of minions walking at his tower.",
  "Crashing means getting your wave all the way into his tower. The tower kills your minions, and he has to stay and last hit under it or lose them. That buys you free time to recall, place a ward or walk to an objective. Afterward the wave bounces. The next waves meet on his side, his reinforcements arrive first, and the wave walks back toward you.",
  "A freeze is holding the wave still just outside the range of your own tower. Leave a few more enemy minions alive than you have, and only last hit. He now has to walk a long way up the lane to touch a minion, while you farm next to your tower.",
  "So pick one on purpose. Slow push and crash when you want to recall, ward or leave the lane. Freeze when you are ahead and want to starve him, or behind and need to be safe. Only last hit when you do not know where their jungler is. Hitting every wave as hard as you can with no plan is the habit that gets top laners killed."
 ],
 rule:"Before you touch the wave, decide what you want it to do: stay, slow push, crash or freeze.",
 quiz:["tp5","tp6","tp7","tp8","tp10"]},

{id:"t-trade", part:"Lane", title:"Trading: winning the small fights",
 hook:"Hit him when he cannot hit back as hard, then leave.",
 body:[
  "A trade is a short exchange of damage. You step in, deal more than you take, and step back out. An all-in is the opposite, where both of you commit until someone dies or runs. Most of a lane is trades. The all-in comes at the end, once trades have left him low.",
  "The best time to trade is right after he uses his main ability. Every ability has a cooldown, a wait before it can be used again. If Jax has just used the E that blocks your basic attacks, he is much weaker for the next few seconds. Step in then, not before.",
  "Minions fight too. When you attack his champion, the enemy minions near you turn and hit you. Early in the game a full wave of them hurts more than one of his abilities. Trade when your wave of minions is the bigger one, and stay back when his is.",
  "Another good moment is when he walks up for a last hit, the killing blow on a minion. He has to choose between the gold and avoiding you. Hit him as he reaches for it.",
  "Levels change who is stronger. Top is a solo lane, so you do not share experience and you level faster than you did in bot lane. Level 2 comes about one minion into the second wave, and whoever gets there first has two abilities against one for a moment. Level 3 gives most champions all three basic abilities. Level 6 brings the ultimate. Reach one of these first and you can fight. If he gets there first, back off until you catch up.",
  "Some champions want short trades and some want long fights. Darius gets stronger the longer a fight lasts, so against him you hit and leave. Fiora also wants a long one against one. Learn which kind your champion wants, and do not get pulled into the other kind.",
  "Once you have won a trade, walk away. Staying for one more hit is how a won trade becomes an even one, because his abilities come back while yours are still on cooldown. Keep the health lead, go back to last hitting, and trade again when you are ready."
 ],
 rule:"Trade when his main ability is down or your wave is bigger, and walk away as soon as you are ahead.",
 quiz:["tp12","tp13","tp14","tp15","tp17"]},

{id:"t-gank", part:"Lane", title:"Not dying to the jungler",
 hook:"Most top lane deaths are a second enemy you never saw.",
 body:[
  "A gank is the enemy jungler walking into your lane to make it two against one. Top lane is long. When your minions have pushed up near his tower, your own tower is a long run behind you, and a jungler arriving from the river is standing between you and safety. That is where top laners die.",
  "You know wards from support. Here you have far fewer of them, only your yellow trinket and any control wards you buy. Each one has to cover the path that would kill you.",
  "There are two paths. The first is the river brush, the bush where the river opens into the lane. Most ganks come through it. The second only matters when you are far up the lane. It is the path out of their jungle that comes out behind you, close to his tower.",
  "Ward just before you need it. The first gank usually comes once their jungler has killed his first jungle monsters, a few minutes into the game, so have a ward down by then. After that, ward right before you push, because a trinket ward only lasts a short while.",
  "One ward covers one path, so play on the side it covers. If your ward watches the river, do not push so far that the path behind you opens up. If you have no ward at all, stand on the side of the lane away from the river, so a jungler has further to run to reach you.",
  "Count the jungler. Each time he shows on the map, note where he was and how long ago. If he just appeared in bot lane, you have a short window to push and trade. If nobody has seen him for a while, assume he is on your side.",
  "That gives you one rule. If you cannot see him and your wave of minions is past the middle of the lane, act as if he is in the brush. Stop trading, step back to your half, and let the wave come with you. You will be wrong sometimes, and it costs you a few minions. Being wrong the other way costs a death."
 ],
 rule:"If you cannot see their jungler and your wave is past the middle, play as if he is in the river brush.",
 quiz:["tp19","tp20","tp21","tp22","tp24"]},

{id:"t-death", part:"Lane", title:"What a death costs in top lane",
 hook:"The kill gold is the smallest part of the bill.",
 body:[
  "When you die in top lane, the gold he gets for the kill is the small part of the cost. The rest arrives over the next minute, while you are dead and then walking back up a long lane.",
  "First you lose the wave, the group of minions that was in the lane with you. With nobody there, he pushes his minions into your tower and the tower kills them. Every minion the tower kills is gold and experience you do not get.",
  "Then he chooses what to do with an empty lane. He can hit your tower for plates, the pieces of armor that pay gold when broken. Or he can freeze, which means holding the next wave near his own tower so you have to walk far up the lane to reach a minion, toward someone who has just killed you.",
  "You also come back a level down. Most of your experience comes from being near minions when they die, and you were not there. A level behind in a one against one means less health, less damage and sometimes one ability fewer. The fight you lost at even levels is worse now.",
  "This is why two early deaths usually lose the lane for good. After the second one he can walk at you whenever he likes, and you cannot stop him alone.",
  "So change how you play the moment you are behind. Give up minions you cannot reach safely. Let the wave come to your tower, where he cannot follow without the tower shooting him. Do not take the fight that got you killed a second time, because it goes worse than the first.",
  "Then ask for help. When he has pushed up to your tower he is far from his own, so ping your jungler. And remember that the lane ends. A top laner who is a little behind and alive is still useful in fights. One who has died four times is not."
 ],
 rule:"After your first death, change the plan: farm near your tower, skip the fight that killed you, and ping your jungler.",
 quiz:["tp25","tp26","tp27","tp28"]},

{id:"t-recall", part:"Lane", title:"Recalls and Teleport",
 hook:"A good recall costs nothing. A bad one costs a wave.",
 body:[
  "Recalling means going back to base to heal and buy. In bot lane your ADC could stay with the minions while you were gone. In top lane nobody does, so the moment you choose to recall matters much more.",
  "The good recall goes like this. Push your wave of minions all the way into his tower, then recall. His tower has to kill your minions, the next waves meet on his side, and the wave walks slowly back toward you. You return to a wave arriving on your side of the lane and miss almost nothing.",
  "The bad recall is leaving while the wave is in the middle, or already walking toward you. It reaches your tower while you are in base and the tower takes the minions. One bad recall can cost a whole wave of gold and experience, and he gets ahead without doing anything.",
  "Sometimes you cannot set it up. You are low, he is healthy, and staying to push would get you killed. Recall anyway. A lost wave is cheaper than a death, which loses the same wave and more.",
  "Teleport is the spell that carries you to one of your team's towers after a short wait. Whether you picked it before the game or got it during the game, it has two jobs. The first is to fix a recall you could not set up. You had to leave, or you died, and a big wave is about to hit your tower. Teleport puts you back in time to catch it.",
  "The second job is to join a fight on the far side of the map, like a dragon fight next to bot lane. Teleport has a long cooldown, the wait before you can use it again, so you rarely get both. If an objective fight is coming in the next minute or two, walk to lane and keep it.",
  "Do not press it out of habit. When the wave is slow, or sitting safely near your tower, walking costs very little and Teleport stays ready. And in the games where you start with Ignite for more kill threat, you have no Teleport in the early lane at all. Then nothing rescues a bad recall, and every one has to be clean."
 ],
 rule:"Push the wave into his tower before you recall, and only Teleport back when walking would lose you a wave.",
 quiz:["tp29","tp30","tp31","tp32","tp9"]},

{id:"t-obj", part:"After lane", title:"Your side of the map: grubs, Herald and getting to fights",
 hook:"Two objectives spawn next to your lane. Be there first.",
 body:[
  "You know the timers from support, and they have not changed. The first dragon spawns at 5:00, and the next one comes 5:00 after each dragon dies. Voidgrubs spawn at 8:00 and only once. Rift Herald spawns at 15:00 and only once. Baron spawns at 20:00.",
  "What changes is which ones are yours. The grubs, the Herald and later Baron all appear in the pit on the top side of the river, a short walk from your lane. You are the closest laner to every one of them.",
  "That means your wave of minions decides these fights before they start. If your wave is pushed into his tower just before 8:00, you can walk to the pit and your opponent has to choose between following you and losing minions. If you are stuck under your own tower, he gets there first and your jungler is alone.",
  "So plan backward from the clock. Around 7:00, start building a big wave. Get it into his tower a little before 8:00 and walk to the pit with your jungler. Do the same before 15:00 for the Herald. If you need to recall, do it early enough to be back. Sitting in base while the Herald spawns wastes a won lane.",
  "Dragons are on the far side of the map, next to bot lane. The walk from top is long, and a top laner who starts walking when the fight begins arrives after it is over.",
  "For a dragon fight you have two honest choices. One is Teleport, the spell that carries you to one of your team's towers. If it is ready, push your wave first, then Teleport to the tower nearest the fight when it starts. If it is not, stay top and take something while most of their team is busy. Plates, the pieces of tower armor that pay gold when broken, are a fair price for a dragon you could not reach.",
  "The thing not to do is the slow walk. You leave your lane, lose two waves on the way, arrive late, and the tower you left is under attack. Decide early. Teleport, or push."
 ],
 rule:"Have your wave pushed and be at the pit before 8:00 and before 15:00. For a far dragon, Teleport or push top, and never walk down late.",
 quiz:["tp33","tp34","tp35","tp36"]},

{id:"t-side", part:"After lane", title:"After lane: the side lane",
 hook:"Push where the fight is not, and make them come to you.",
 body:[
  "The lane phase ends when the first towers fall and players start moving around the map. For a bruiser, a top laner who deals damage and can take some, the game now moves to a side lane. That means top or bot lane, the two long lanes on either side of mid.",
  "Split pushing means pushing a side lane on your own while your team stays together somewhere else. It works because the enemy cannot ignore it. If nobody comes, you take the tower. If one comes, you get the one against one your champion is built for. If two come, your team is four against three.",
  "Pick the side away from the next objective. If a dragon is about to spawn, push top. If Baron is next, push bot. The enemy then has to split in two directions, and whoever they send to you is missing from the objective.",
  "A side lane is the worst place on the map to be blind. Before you walk past the river, put a ward in the jungle on the path the enemy would take to reach you. Then push only as far as you can still see them coming.",
  "Count the enemies on the map, all the time. If you can see most of them far away, keep pushing. If three or more are missing, some of them may be walking at you. Leave when they go missing. Do not wait until you see them.",
  "Split pushing is not the answer in every game. Group with your team when an objective is about to spawn and you cannot get there in time. That means your Teleport, the spell that carries you to one of your team's towers, is not ready. Group when you are behind and lose to whoever they send. Group when your team cannot hold four against four without you.",
  "The worst result is dying in the side lane. Your team is a player down, the enemy turns straight to the objective, and all that pushing bought nothing."
 ],
 rule:"Push the side lane away from the next objective, ward before you pass the river, and leave when three or more enemies go missing.",
 quiz:["tp37","tp38","tp39","tp40","tp41"]},

{id:"t-fights", part:"After lane", title:"Your job in a fight",
 hook:"Second in, from the side, onto the right target.",
 body:[
  "From support you know two fight jobs. Engaging means starting the fight, and peeling means protecting a teammate from whoever jumps on them. A bruiser, a top laner who deals damage and can take some, adds a third job called diving. Diving means getting past the enemy front line to their carries, the fragile damage dealers standing at the back.",
  "A bruiser is tough, but he is not a tank. If you walk in first with nobody behind you, all five enemies use everything on you, and you are dead before your team arrives. Let your tank or your engage support go first if you have one.",
  "Come from the side. A bruiser who walks straight through the middle is stunned and slowed by their front line before he reaches anyone. From the side, which is called a flank, you arrive next to their carries and they have to turn around to deal with you.",
  "Timing is most of the skill. Go for their carries once your team has started the fight and the enemy's big abilities have landed on someone else. Aim to arrive a moment after the fight starts, not a moment before.",
  "Sometimes your job is to stay back. If the enemy has divers who are stronger than you, and your own carry is the reason your team is winning, stand near that carry and hit whoever jumps on them. It is less exciting and it wins more fights.",
  "Before any of this, be alive and be there. A top laner who gets caught alone a minute before the dragon has already lost it. The enemy sees the kill, walks to the objective five against four, and your team cannot contest it."
 ],
 rule:"Before the fight, decide whether you dive their carry after your team starts or guard your own. Never go in first alone.",
 quiz:["tp42","tp43","tp44","tp45"]},

{id:"t-climb", part:"Climbing", title:"How top laners climb",
 hook:"A small pool, fewer deaths, and a lead you actually spend.",
 body:[
  "Top lane rewards knowing your matchups more than any other role, because you spend ten minutes alone with one opponent. A matchup is your champion against theirs: who is stronger early, which ability you have to respect, and when you are allowed to fight.",
  "So play two or three champions and no more. On Kled and Renekton you will meet the same opponents again and again. After each game, write down one thing you learned about that matchup. After thirty games you have notes that win lanes for you.",
  "Dying less beats flashy kills. At this rank, far more lanes are lost by dying than are won by clever plays. Going even in a lane you were supposed to lose is a good game.",
  "Creep score, or CS, is the count of minions you have last hit, meaning you landed the killing blow. It is your steadiest income, and it does not depend on anyone making a mistake. A few full waves of minions are worth about as much gold as a kill, and waves keep coming all game. Aim for about six minions a minute first, and raise the target when that gets easy.",
  "Review your deaths after a loss. For each one, ask three questions. Where were the minions, near your tower or near his? Did you know where their jungler was? Was it a fight you had already lost once? Most of your deaths will share an answer, and that answer is the habit to fix.",
  "A won lane only counts if you turn it into something. When you are two kills up, your next thought should be what to take with it. Break the plates on his tower, the pieces of armor that pay gold. Walk to the Voidgrubs. Join a fight somewhere else. A top laner who wins his lane and keeps farming alone gets to watch his team lose four against five.",
  "Change one habit at a time. Play a week of pushing your minions into his tower before every recall, then add the next thing. Small habits that stick are what move your rank."
 ],
 rule:"Stick to two or three champions, die less, and after every won lane ask what you can take with it.",
 quiz:["tp11","tp46","tp47","tp48"]}
];
