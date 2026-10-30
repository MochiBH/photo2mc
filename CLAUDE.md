# photo2mc

Turns real-world structures into Minecraft builds from photos, phone scans or 3D models. Python, no GPU needed. See README.md for user-facing docs.

## Commands

```
pip install -r requirements.txt
python tests/run_tests.py                                   # fast checks, ~30 s
python samples/make_samples.py                              # regenerate sample .glb files
python photo2mc.py spec samples/taj_mahal.json --out out/taj
python photo2mc.py scan samples/fake_scan.glb --block-size 0.5 --out out/scan
python photo2mc.py model samples/cottage.glb --block-size 0.5 --out out/cottage
python photo2mc.py landmark eiffel_tower                    # library build + survival guide
python photo2mc.py photo some_photo.jpg --out out/x         # needs ANTHROPIC_API_KEY
python photo2mc.py prompt                                   # same instructions, for writing a spec without a key
python photo2mc.py site --bbox 32.83631,-96.78741,32.84772,-96.77522 --name smu --campus w30894474 \
    --heroes samples/smu/heroes.json --spawn "Dallas Hall" --out out/smu   # SMU campus world, ~4 min
python tools/landmarks.py                                   # regenerate samples/landmarks/*.json
python -I tools/gen_palette.py <26.x assets> <1.21.1 assets>  # re-measure block colours (sparse checkout of
                                                            # github.com/InventivetalentDev/minecraft-assets)
python viewer/make_viewer.py out/viewer.html                # multi-build demo viewer
```

Outputs go in `out/` (git-ignored): `.schem`, `_datapack.zip`, `.html` viewer, `.png` render, and for `photo` the `.spec.json` versions.

## Layout

- `photo2mc.py` — CLI (photo / spec / scan / model).
- `mcbuild/voxelize.py` — core engine. Half-block occupancy (exact vertical-ray parity per closed component; normal-vote fallback for open meshes), `grid_origin` wall alignment, 2×2×2 pattern → shape LUT, `classify_blocks`, `make_states`, colour-matched `build()`.
- `mcbuild/shapes.py` — independent blockstate → sub-cell mask (vanilla stair model rules). Used by renderer, viewer and as a cross-check of the LUT.
- `mcbuild/palette.py` — materials as families (full + stairs + slab) loaded from `palette_data.json` (measured side/top colours, `since` versions). CIEDE2000 matching with colour dedup, builder prior (+4 ΔE for concrete/terracotta), tags `detail` and `wool` excluded by default, `target="latest"|"1.21"`.
- `mcbuild/connect.py` — Connectable (pane/bars/fence/wall) + neighbour connection states. Kind `CONNECT` = 4.
- `mcbuild/recipes.py` / `mcbuild/guide.py` — raw-material tracing and the survival guide page.
- `mcbuild/regions.py` — region split + Claude material assignment for colour-matched builds.
- `mcbuild/parts.py` — structure spec → watertight primitive meshes; `expand()` handles repeat/mirror (must not mutate its input — that was a real bug).
- `mcbuild/semantic.py` — spec → build with per-part materials; modes solid / carve / paint.
- `mcbuild/vision.py` — Claude prompt + tool schema, `SpecWriter`, `photos_to_build` with render-and-compare refinement rounds.
- `mcbuild/scan.py` — RANSAC ground plane, levelling, `align_yaw` (4-fold wall direction), footprint-based clutter removal.
- `mcbuild/export.py` — Sponge Schematic v2 (hand-written NBT), vanilla datapack, viewer JSON.
- `mcbuild/render.py` — matplotlib painter's-algorithm isometric PNG, any azimuth/elevation.
- `viewer/` — three.js r128 viewer template + `make_viewer.py`.
- `mcbuild/geo.py` — `Frame` (lat/lon ↔ local m, x east / y north), OSM API bbox download + parser (ways, multipolygons, nodes), USGS 3DEP EPT lidar fetch (EPSG:3857 tiles from AWS, cached npz).
- `mcbuild/site.py` — `Site`: rasters at 0.5 m and block res (ground, surface classes, building ids, roof heights from single-return lidar snapped to planes, lidar-only structures, tree tops/crowns), `region(rx, rz)` fills a 512×512 tile (terrain, facades by style, roofs via the voxel LUT, cornices, trees as ellipsoid blobs, fountains with fluid ticks), `build_world`, `add_hero` (spec replaces a footprint, bbox-centred, `rotate_state`).
- `mcbuild/world.py` — Anvil writer (1.21.1 DataVersion, isLightOn 0, no heightmaps → game recomputes), void `level.dat`, `read_chunk`/`read_area` readers. `mcbuild/sitepreview.py` — top-down/splat previews.
- `samples/smu/` — hero specs (`make_heroes.py` → `dallas_hall.json`, `perkins_chapel.json`) and `heroes.json`.

## Conventions

- Minecraft axes: +x east, +y up, +z south. Spec/photo convention: x = right in the photo, z = toward the camera, so the photographed facade faces +z (south).
- Spec units are meters; `at` = base center [x, y_bottom, z].
- Sub-cell bit index = dy*4 + dz*2 + dx. Stair `facing` is the side the tall half is on; `outer_right` = the quadrant at facing ∩ clockwise(facing).
- Every closed part is voxelized on its own and unioned, so overlapping parts and hidden faces are fine.

## Status / next steps

- Live Claude calls verified on `claude-opus-5-5` (env `PHOTO2MC_MODEL`): `photo` (Brandenburg Gate photo → 33-part spec, 1 refine round, ~2 min) and `model --semantic`. All calls go through `vision.ask_tool`: streaming (`call_claude`, falls back to `messages.create` for stub clients), `tool_choice` auto plus a prompt instruction and one nudge (current models reject forced tool choice), effort `high`.
- Detailing: SYSTEM has a DETAILING section (role-based materials within one colour family, depth layers, bases/capitals/cornices, 40-200 parts); the request states the build scale (`_scale_note`), and refine checks detail. Default scale `_auto_block` ≈ 80 blocks tall (`DETAIL_BLOCKS`), 0.25-1 m per block; photo specs record `recommended_block_size`. The PNG/viewer draw average colours, so related textures (sandstone vs smooth_sandstone) look alike there — a textured preview would help judge detail.
- No-API-key path: `photo2mc.py prompt` prints `vision.manual_prompt()` (SYSTEM + spec file format + LOOP); `spec` validates and writes `<out>_camera.png`; project skill `.claude/skills/build-from-photo` drives the loop in Claude Code.
- Site builds (SMU): 0.33 m blocks, ~3420×3810, ~51k chunks, ~4 min incl. hero builds. Lidar `TX_Pecos_Dallas_B3_2018` has only ground/unclassified classes, so buildings come from OSM footprints and trees from multi-return fraction. World not yet load-tested in the game (no server run; checked with nbtlib readback). Next: more heroes (McFarlin — photo in hand, front orientation unverified; Fondren; Bush Center), facade doors, interior floors.
- Colour-match builds: `_dither` mixes two same-class blocks when best single ΔE > 5 (hash pattern, max pair ΔE 14). `Build.color_error` reports CIEDE2000 stats.
- Ideas: image-to-3D provider clients (TRELLIS / Hunyuan3D / Tripo) feeding `model`, landmark fetch from Google Photorealistic 3D Tiles, verify 26.x stair recipes, more landmarks (Statue of Liberty, Sydney Opera House need freeform shapes).
