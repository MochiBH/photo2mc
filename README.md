# Jungle coach

Positional report for a League of Legends jungler, built from the Riot API.

```
python riot_jungle_report.py "Name#TAG"              # fetch last 20 ranked solo games and analyse
python riot_jungle_report.py "Name#TAG" --offline    # re-run on the JSON already in data/
```

It keeps games played as JUNGLE that lasted over 5 minutes and reports, split by
win/loss and by champion: where and when you die and whether you were alone or
outnumbered, lane action before 15:00, the farm race against the enemy jungler,
where you were before every dragon / Voidgrub / Herald / Baron, and vision.

Outputs (in `out/`, git-ignored): `report.txt`, `deaths.csv`, `objectives.csv`,
`map_data.json` (compact `MAP_DATA` block for pasting) and `map_data_full.json`.
Raw match and timeline JSON is cached in `data/`.

The API key is never in code. Set `RIOT_API_KEY`, or run somewhere the
`X-Riot-Token` header is added for you. Python 3 standard library only.

## The app (`app/`)

The Jungle Coach artifact: a React 19 + Tailwind 4 + Motion app whose components are
adapted from [Watermelon UI](https://ui.watermelon.sh) (MIT, see `app/src/wm/NOTICE.md`).
Six screens: Learn, Coach, Drills, Games, Map (Riot positional data) and Live (in-game build and plan helper).

```
cd app && npm install
npm run build                 # dist/index.html (page), dist/app.js, dist/data/*.js
node scripts/shot.mjs live dark scripts/steps-live.mjs   # local screenshot + checks
```

Publish `dist/index.html` as the artifact page with `app.js` (and any changed `data/*.js`) as supporting files.
