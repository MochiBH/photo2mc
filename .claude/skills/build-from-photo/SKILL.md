---
name: build-from-photo
description: Turn photos of a real structure into a Minecraft build without an API key — you look at the photos and write the structure spec yourself, then build, compare and correct. Use when the user gives a photo (or names a building they have a photo of) and wants a build, or asks for photo2mc's photo mode without ANTHROPIC_API_KEY.
---

# Build from photo (no API key)

`photo2mc.py photo` sends the photos to the Claude API. This skill does the same job in the
session instead: you are the model that writes the spec, and the repo's tools build and render it.

1. **Instructions.** Run `python photo2mc.py prompt` (pass `--block-size X` or `--height N` if the
   user asked for a size) and follow its output exactly: it is the same prompt the API model gets,
   including coordinates, shapes, materials, DETAILING and the build scale.
2. **Look.** Read every photo the user gave. The first one defines the front (+z). If it is a known
   landmark, use its documented dimensions; otherwise scale from doors, storeys and people.
3. **Write** the spec to `out/<name>.spec.json`. For anything repetitive (rows of columns,
   windows, triglyphs) prefer `repeat` / `mirror` over listing parts; a short Python script in the
   scratchpad that prints the JSON is fine for large specs.
4. **Build:** `python photo2mc.py spec out/<name>.spec.json --out out/<name>`. If it prints spec
   errors, fix them and rerun.
5. **Compare.** Read `out/<name>_camera.png` (the build from the spec's camera angle) and the photo
   side by side, and go through the checklist in the prompt's LOOP section: proportions and tier
   heights first, then detailing. The render shows average colours, so check material variety in
   the block counts the build prints, not in the picture.
6. **Correct** the spec and rebuild. Do 1–2 rounds; stop when the remaining differences are below
   one block.
7. **Report** the outputs (`.schem`, `_datapack.zip`, `.html` viewer, `_guide.html`, `.png`), the
   size in blocks and the main materials, and send the user the `.png` and `.html`. Mention any
   parts you had to guess (hidden sides, interior).

Keep `analysis` in the spec honest: say which dimensions are documented and which are estimated.
