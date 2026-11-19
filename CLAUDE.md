# Jungle coach

Single script, `riot_jungle_report.py` (Python 3, standard library only). See README.md.

- Run: `python riot_jungle_report.py "Name#TAG"`; add `--offline` to reuse `data/`.
- Never put a Riot key in code or commits. The script sends `RIOT_API_KEY` if set, otherwise relies on the environment's network secret for `X-Riot-Token`.
- Riot rejects the default Python User-Agent with 403; keep the custom one in `api_get`.
- Zones live in `raw_zone` (blue base bottom-left, river x + y = 14800, top side y > x). The report prints a zone check against real turret and epic-monster positions; keep it at 100% when changing thresholds.
- Timeline frames are one per minute, so "near me" counts are approximate (radius `NEAR`). Voidgrub kills are one event per grub.
- `data/` and `out/` are git-ignored (raw match data includes other players).
