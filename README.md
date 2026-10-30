# photo2mc

Turn real-world structures into Minecraft builds, from photos, phone scans or 3D models. Builds use stairs and slabs wherever the real geometry slopes.

## Quick start

```
pip install trimesh pillow numpy scipy shapely mapbox-earcut anthropic
export ANTHROPIC_API_KEY=sk-ant-...            # only needed for photos

python photo2mc.py landmark                                   # list the library
python photo2mc.py landmark eiffel_tower                      # ready-made, real dimensions
python photo2mc.py photo eiffel.jpg --out out/eiffel
python photo2mc.py photo front.jpg side.jpg back.jpg --hint "church, about 40 m to the steeple tip" --rounds 2 --out out/church
python photo2mc.py spec out/eiffel.spec.json --block-size 0.5 --out out/eiffel_2x    # edit the spec, rebuild for free
python photo2mc.py scan polycam_export.glb --out out/house
python photo2mc.py scan polycam_export.glb --semantic --photo house.jpg --out out/house   # Claude fixes materials
python photo2mc.py model chapel.obj --up z --height 60 --out out/chapel
```

Every command writes `<out>.schem`, `<out>_datapack.zip`, `<out>.html` (3D viewer), `<out>_guide.html` (survival guide) and `<out>.png`.

Photo and spec builds default to about 80 blocks tall (0.25–1 m per block), fine enough for column bases, cornices, recessed panels and other block detailing; Claude is told the scale and details to it. Use `--block-size` or `--height` for a bigger or smaller build.

Options for every command: `--mc latest|1.21` (default latest: uses 26.x blocks such as concrete stairs; `1.21` keeps to blocks that exist in 1.21.1 so builds load on older servers), `--solid`, `--height` / `--block-size`. Scans and models also take `--no-mix`, `--semantic`, `--photo`, `--materials`.

## Without an API key

Only `photo` (and `--semantic`) call the Claude API. To turn photos into a build without a key, open the repo in Claude Code and ask for a build from your photo: the project skill `build-from-photo` (`.claude/skills/`) has Claude Code write the spec itself, then build, compare and correct it, using your Claude subscription. The pieces it uses work on their own too:

```
python photo2mc.py prompt                                    # the instructions the API model gets
python photo2mc.py spec out/x.spec.json --out out/x          # checks the spec, builds it, and writes out/x_camera.png
```

## Whole places: SMU campus

`site` turns a real area into a playable Minecraft world (US only, where USGS 3DEP lidar exists):

```
python photo2mc.py site --bbox 32.83631,-96.78741,32.84772,-96.77522 --name smu --campus w30894474 \
    --heroes samples/smu/heroes.json --spawn "Dallas Hall" --out out/smu
```

That is Southern Methodist University (Dallas) at 0.33 m per block: about 3,420 × 3,810 blocks. It downloads OpenStreetMap
data and the 2018 USGS lidar once (cached in `data/smu/`), takes about 5 minutes, and writes `out/smu/` (a world folder
with `level.dat`; drop it into `.minecraft/saves/`), `out/smu.zip` and a top-down `out/smu_map.png`.

- **Terrain** from lidar ground points. **Surfaces** from OpenStreetMap: roads (asphalt or concrete, centre lines),
  footpaths and brick pavers, lawns, parking, sports pitches, the track, pools and fountains (with a running jet).
- **Buildings**: every OpenStreetMap footprint, with its real roof shape from single-return lidar (canopy over a roof is
  multi-return and is ignored), snapped to its planes and built with half-block stairs and slabs. Lidar structures with
  no footprint (the stadium stands) are added too. Facades follow a style per building: on campus, Georgian red brick
  with a limestone base, white-framed windows per storey, corner quoins, a white cornice and slate roofs; houses,
  commercial buildings and garages have their own.
- **Trees** from the lidar canopy height model: each tree's position, height and crown spread come from the lidar,
  and it is grown, not stamped: a tapered trunk with a root flare and surface roots, limbs forking at species
  angles, side branches, and leaf clumps at the branch tips with ragged edges (`mcbuild/trees.py`). Species follow
  the shape and Dallas streets: broad live oaks, vase elms, round oaks, a few birches, pink crape myrtles for many
  small trees. Leaves are persistent, so they never decay; low canopy becomes shrubs.
- **Texture**, the way builders do it: walls, roofs, roads and paths scatter close variants through the main block
  (terracotta and granite in brick, cracked slate tiles, patched asphalt, andesite in concrete); parking lots get
  stall lines, crossings get zebra stripes, roads get a half-block curb; lawns have tufts of grass and a few flowers,
  flower beds bloom, and the ground under trees is bare earth.
- **Hero buildings** replace the lidar massing with a detailed spec: `samples/smu/` has Dallas Hall (from lidar
  dimensions and Commons photos) and Perkins Chapel (lidar + Georgian steeple conventions). Add more to
  `heroes.json`; `python samples/smu/make_heroes.py` regenerates the specs.

`python tools/site_view.py out/smu 540 690 870 1080 out/view.png` draws any part of the saved world with Minecraft's
own block textures (downloaded once into `data/textures/`).

The world is saved in the 1.21.1 format with only 1.21 blocks; newer versions upgrade it on open. Outside the map is
void. If a game version rejects the `level.dat`, create a new world with the "The Void" superflat preset and copy
the `region/` folder into it. Map data © OpenStreetMap contributors (ODbL); lidar: USGS 3DEP (public domain).

## Landmark library

`samples/landmarks/` has 11 structures at documented real dimensions (sources and any estimates are in each file's `notes`): Eiffel Tower, Big Ben, Saint Basil's Cathedral, Taj Mahal, Colosseum, Space Needle, Leaning Tower of Pisa (with its 3.97° lean), Parthenon, Arc de Triomphe, Empire State Building, Great Pyramid. They're generated by `tools/landmarks.py`, and two of them are worked examples inside the photo prompt.

## Accurate block matching

- **Measured colours.** `mcbuild/palette_data.json` holds the side and top colours of 223 building blocks and 64 panes/bars/fences/walls, measured in linear light from the game's own textures (`tools/gen_palette.py`, run against the 26.3 assets, with the 1.21.1 block list for compatibility). No hand-typed colours.
- **Face-aware.** Walls are matched against side textures, roofs and floors against top textures.
- **CIEDE2000** colour difference, the standard measure of how different two colours look, is used for matching and reported for every colour-matched build (median, 90th percentile, share under 5 = close match).
- **Builder's prior.** Stone, wood and metal are preferred; flat dyed blocks (concrete, terracotta) only win when clearly closer; wool is opt-in.
- **Texture mixing.** Where no single block is close (ΔE > 5), two similar blocks of the same class are mixed 1:3, 1:1 or 3:1 in an irregular pattern whose blended colour is closer. On the test temple this took the median error from 7.5 to 5.0. Turn off with `--no-mix`.

## Thin details

Glass panes, iron bars, fences and walls are real connecting blocks: their `north/east/south/west` (and wall `up`, `low`/`tall`) states are computed from neighbours like the game does. In a spec, a solid part with a thin material is drawn even when it's thinner than a block (a 0.1 m railing), and painting a pane material onto a wall makes inset windows.

## Survival guide

`<out>_guide.html`: a layer-by-layer plan (north up, stairs shown as arrows toward their tall side, slabs as top/bottom bars), tap a cell for the exact block and coordinates, tick layers off as you build. Below it: blocks to place in stacks and shulker boxes, and the raw resources to gather, traced through crafting, smelting and the stonecutter (`mcbuild/recipes.py`).

## Three ways in

| Command | Input | How it works | Best for |
|---|---|---|---|
| `photo` | 1+ photos | Claude identifies the structure, uses real documented dimensions for landmarks (or scale cues like doors and storeys otherwise), and writes a **structure spec**: primitive parts at real size with Minecraft materials. Then it builds, renders the build from the photo's camera angle, compares it to the photo and corrects the spec (`--rounds`). | Well-known landmarks, buildings, anything from one photo |
| `scan` | Phone scan / photogrammetry (Polycam, Scaniverse, RealityScan, COLMAP) | Finds the ground plane (RANSAC), levels the scan, squares walls to the grid, cuts away ground and clutter (cars, trees), then colour-matches blocks. With `--semantic`, Claude looks at a numbered region map (and your photo) and says what each region really is, so windows become glass panes and roofs become roof tiles, keeping every stair. | A real place you can walk around |
| `model` | Any clean 3D model | Straight to the block engine. Also works for output of image-to-3D tools (TRELLIS, Hunyuan3D, Tripo, Meshy). | Downloaded or generated models |

Photos give the cleanest Minecraft builds: materials are chosen for what surfaces *are* (glass windows, wood doors, copper roofs), and hidden sides come from symmetry and the model's knowledge of the landmark. Scans give the most faithful geometry for irregular, one-of-a-kind places.

### Structure specs

A spec is plain JSON you can read and edit (`samples/taj_mahal.json` is an example). Coordinates are meters, `y` up, `x` to the right in the photo, `z` toward the camera; `at` is each part's base center.

Shapes: `box`, `cylinder` (taper, polygon sides), `cone`, `pyramid`, `gable_roof`, `hip_roof`, `dome`, `sphere`, `revolve` (any lathe profile: onion domes, minarets, spires), `extrude` (any footprint), `arch`, `beam` (strut between two points: leaning legs, trusses).
Modes: `solid`, `carve` (openings, recesses), `paint` (windows, doors, bands).
Extras: `rotate`, `tilt` (e.g. a clock face on a wall), `repeat` (rows/grids of windows, columns), `mirror` (`x`, `z`, `xz`); a top-level `tilt` leans the whole structure.

## How it works

1. **Half-block voxelization.** Each closed part of the model is filled with exact ray parity (vertical rays through every half-block cell). Open meshes from scans fall back to a surface-normal vote.
2. **Grid alignment.** The grid is shifted so the model's main walls land on block boundaries, not through the middle of blocks.
3. **Shape detection.** Each block covers 2×2×2 half-cells. That 8-bit pattern maps directly to a full block, top/bottom slab, straight stairs, or inner/outer corner stairs (including upside-down) with the right `facing`/`shape`. The lookup table is cross-checked against vanilla stair-model rules (`shapes.py`).
4. **Materials.** Surface samples vote on the nearest block in CIELAB, so boundaries never blend into a fake in-between color. Families with matching stairs and slabs are preferred so a roof and its slope use the same material. The palette is limited to the most-used blocks, with small distinct details (doors, windows) kept. A 3×3×3 majority filter cleans texture noise.
5. **Export.** Sponge Schematic v2, a vanilla datapack with runs merged into `fill` commands, and a viewer.

## Files

- `photo2mc.py` — command line for everything.
- `mcbuild/vision.py` — photos → spec with Claude, plus the compare-and-correct loop.
- `mcbuild/parts.py` — spec shapes → meshes. `mcbuild/semantic.py` — spec → build.
- `mcbuild/scan.py` — ground detection, levelling, wall squaring, clutter removal.
- `mcbuild/palette.py` + `palette_data.json` — measured block families, CIEDE2000, version targets.
- `mcbuild/connect.py` — panes, bars, fences, walls and their connection states.
- `mcbuild/regions.py` — semantic materials for scans/models.
- `mcbuild/recipes.py`, `mcbuild/guide.py`, `viewer/guide_template.html` — survival guide.
- `tools/gen_palette.py` — measure colours from game assets. `tools/landmarks.py` — generate the landmark library.
- `mcbuild/voxelize.py` — occupancy, shape table, coloring.
- `mcbuild/shapes.py` — what Minecraft renders for a blockstate.
- `mcbuild/export.py` — `.schem`, datapack, viewer JSON.
- `mcbuild/geo.py` — OpenStreetMap and USGS lidar download/parse into local meters. `mcbuild/site.py` — whole-site
  generator (terrain, surfaces, buildings, trees, heroes). `mcbuild/world.py` — Anvil region files + `level.dat`.
  `mcbuild/sitepreview.py` — fast top-down/oblique previews of big block arrays.
- `mcbuild/render.py` — quick isometric PNG.
- `samples/make_samples.py` — procedural cottage, Great Pyramid, domed temple.
- `viewer/` — the 3D viewer page.

## Known limits

- In `scan`/`model` builds, details thinner than half a block are dropped or thickened (specs can use thin blocks; scans can't know a surface is a railing).
- Without `--semantic`, `scan` and `model` match by colour only, so windows aren't glass.
- Recipes for the shapes new in 26.x (concrete and wool stairs/slabs) aren't verified, so the guide assumes the crafting table, which may over-count.
- `photo` makes one Claude API call to write the spec plus one per `--rounds` (more if a spec needs fixing). Default model is `claude-opus-5-5`; set `--model` or `PHOTO2MC_MODEL` to change it.
- `site` buildings without a hero spec are lidar massing plus a facade style: roof shapes, dormers and chimneys are
  real, but porticos, columns and ornament are not. Buildings newer than the lidar (2018) get a height from OSM tags or
  a default. Interiors are hollow.
- The `site` world format was checked by reading it back with an independent NBT parser, not by loading it in the game.
- Very lattice-like structures (Eiffel Tower ironwork) come out as solid massing; openings have to be carved explicitly.
