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

## The website (`app/`)

A React 19 + Tailwind 4 + Motion site for Vercel, with Supabase logins and each player's own stats pulled from
the Riot API. Components are adapted from [Watermelon UI](https://ui.watermelon.sh) (MIT, see `app/src/wm/NOTICE.md`).

Animation is split in two: Motion drives layout and presence inside the components, and anime.js drives the
showpiece effects in `app/src/fx/` (the rippling dot-grid backdrop, particle bursts, letter reveals, self-drawing
gauges and map lanes). The look is dark only.

Screens: Home (record, form, checkpoints, rules, game list), Learn and Drills (a jungle course and a support course), Map (checkpoints, leaks worked out from
your games, death map and charts), Live (teams, in-game tracker, build and plan for any jungle or support champion)
and Me (profile, refresh, sign out). A switch in the header flips between your jungle and support games.

### Deploy

1. **Supabase.** In your project open SQL editor, paste `app/supabase/schema.sql`, run it. Then copy from
   Project Settings > API: the project URL, the `anon` key and the `service_role` key.
2. **Vercel.** New Project > import this repository > set **Root Directory** to `app` (framework: Vite).
   Add these environment variables, then deploy:

   | Name | Value | Where it is used |
   |---|---|---|
   | `VITE_SUPABASE_URL` | Supabase project URL | browser and server |
   | `VITE_SUPABASE_ANON_KEY` | Supabase `anon` key | browser |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key | server only |
   | `RIOT_API_KEY` | your Riot API key | server only |

3. **Accounts.** Open the site, choose Create account for each player, and fill in their Riot ID, region and role.
   If Supabase asks for email confirmation, click the link in the email first (or turn confirmation off under
   Authentication > Sign In / Providers > Email). Once both accounts exist, turn off
   "Allow new users to sign up" in the same place so nobody else can use your Riot key.
4. In Supabase > Authentication > URL Configuration, set Site URL to your Vercel address so confirmation links
   point at the site.

Vercel builds from the repository's production branch (normally `main`); either merge this work into `main` or
change the production branch in the Vercel project's settings.

### How stats work

`POST /api/sync` (in `app/api/sync.js`) checks the signed-in user, pulls up to three new ranked games per call
from Riot, analyses each one (`app/server/analysis.mjs`) and stores the result in Supabase. The browser repeats
the call until it reports done, then reads the rolled-up stats. It runs automatically when stats are more than
30 minutes old, and from the Update button.

### Develop and check

```
cd app && npm install
npm run dev                                   # needs app/.env.local (see app/.env.example); /api needs `vercel dev`
node scripts/check-analysis.mjs               # JS analysis vs the Python report on the same raw games
node scripts/check-sync.mjs "Name#TAG" na     # real sync loop against Riot with an in-memory database
node scripts/make-demo.mjs && VITE_DEMO=1 npx vite build && node scripts/shot.mjs live dark scripts/steps-live.mjs support
```

`VITE_DEMO=1` builds a no-login version that reads `public/demo-stats.json` (git-ignored) for local checks only.
