/* Drill questions written from one player's own games, shown only to that Riot ID. opts[0] is correct.
   Evlijah#3958: 12 ranked support games pulled Nov 21, 2026 (7-5; Poppy 4-2, Nautilus 3-2). `no` has one line per wrong option, in order (no[0] is for opts[1]), saying why it is wrong. */
window.PLAYER_LEAKS = {
"evlijah#3958": {
support: [
{id:"ev1",tags:["leak","engage"],q:"You're on Nautilus. Their ADC steps forward, in hook range. Your own ADC is at half health, farming behind you. Do you hook?",
 opts:["No. Wait until your ADC is healthy and close enough to follow","Yes, a landed hook is always worth it","Yes, then walk in and ult","Flash forward first to make sure it lands"],
 no:["A hook with nobody to follow up pulls you into two enemies.","You spend everything, and your ADC is too low and too far back to use it.","Now you have no Flash and still nobody behind you."],
 why:"On Nautilus, 22 of your 30 deaths were free: you went in and no enemy died. A hook only wins the trade if someone is there to do the damage."},
{id:"ev2",tags:["leak","lane"],q:"It's 9 minutes and you've already died once in lane. Their support walks up alone. What do you do?",
 opts:["Hold the wave and wait for your jungler or level 6 before fighting again","All-in now to get the kill back","Trade basic attacks to chip them down","Leave lane to roam mid"],
 no:["If it goes wrong, that is your second early death, the one your record says loses the game.","A support walking up alone is often bait, and trading keeps you in range of their ADC.","Your ADC is left alone against two, right after you fell behind."],
 why:"With one death or none before 15:00 you are 6-1. With two or more you are 1-4. The second early death is the one that loses the game."},
{id:"ev3",tags:["leak"],q:"Across your last 12 games, which number separates your wins from your losses most cleanly?",
 opts:["Free deaths: two or fewer and you are 5-0","Kills","Vision score","Control wards bought"],
 no:["Kills are your carries' job. The number that moves with your results is free deaths.","Your vision is good in wins and losses alike, so it cannot be what separates them.","You buy about three a game either way. It does not split your wins from your losses."],
 why:"Two or fewer free deaths: 5-0. Three or more: 2-5. Your vision is already good in wins and losses alike, so it isn't what decides them."},
{id:"ev4",tags:["leak","vision"],q:"Dragon spawns in 60 seconds. You're in bot lane with a control ward and full trinket charges. What now?",
 opts:["Push the wave with your ADC and walk to the pit together now","Stay in lane until the dragon actually spawns","Go ward it alone while your ADC farms","Recall for an item first"],
 no:["Then you arrive after the fight has started. That is how you were near enough for only 12 of 26.","Alone at the pit a minute early is where supports get caught.","You come back after it spawns, and your ADC is alone in lane."],
 why:"The enemy took 26 dragons in your games. You were alive for 23 of them but close enough to contest only 12. When your team finishes ahead on dragons you are 6-0."},
{id:"ev5",tags:["leak","fights"],q:"You just respawned after losing a fight at dragon. Two teammates are still there, low on health, and the enemy is finishing the dragon. What do you do?",
 opts:["Don't go back in. Catch the wave nearest you and regroup","Run straight back to help them","Flash in to try to steal it","Stand in the river and wait"],
 no:["You arrive alone into a team that just won. One death becomes three.","Supports have no Smite. You lose Flash and die.","In the river you are alone, in the path of five enemies leaving the pit."],
 why:"In your Thresh loss, 9 of your 12 deaths came within 90 seconds of respawning. Walking back into a lost fight alone turns one death into three."},
{id:"ev6",tags:["leak","engage"],q:"On Poppy you average 2.5 deaths a game. On Nautilus you average 6. What's the most likely reason?",
 opts:["Nautilus has to go in first, and you are going in when nobody can follow","Nautilus is a weaker champion","You get unlucky on Nautilus","Poppy builds more armor"],
 no:["He is not weak. He simply has to start the fights, which is the risky job.","Six deaths a game across several games is a habit, not luck.","Both build tank items. The difference is who goes in first."],
 why:"Poppy mostly reacts: she stops whoever dives your carry. Nautilus starts the fight, so the timing is on you. The same will be true on Rell."},
{id:"ev7",tags:["leak","rell"],q:"You're learning Rell. Based on your Nautilus games, what is the one habit to bring from day one?",
 opts:["Check where your ADC is before every engage","Engage as often as possible to learn the combo","Build damage so your engages kill on their own","Always save your ult for escaping"],
 no:["That repeats the Nautilus problem: going in when nobody can follow.","A support cannot kill alone, and without tank items you die sooner.","Rell's ult is how she starts and wins fights. Holding it wastes her."],
 why:"Rell and Nautilus have the same job. Two thirds of your deaths so far bought nothing, almost all from fights you started without follow-up."},
{id:"ev8",tags:["leak","vision"],q:"You already average 2.0 vision score a minute and buy about three control wards a game. What's the best use of that habit?",
 opts:["Aim it at the next objective a minute before it spawns","Ward deeper in the enemy jungle on your own","Buy even more control wards","Stop warding and fight more"],
 no:["Deep and alone is how free deaths happen, which is the thing to cut.","You already buy plenty. What matters is where and when they go down.","Your warding is a strength in your wins. Dropping it fixes nothing."],
 why:"Your warding is a real strength: you out-ward the enemy support in most wins. The gap is being at the dragon when it matters, with those wards already down."}
],
top: [
]
}
};
