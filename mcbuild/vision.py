"""Photos -> structure spec, using Claude's vision.

Claude looks at one or more photos, identifies the structure (using real
dimensions if it's a known landmark), and writes a spec of primitive parts
with real-world sizes and Minecraft materials (see parts.py). Then:

    refine loop: build the spec -> render it from the photo's camera angle ->
    show Claude the photo and the render side by side -> it returns a
    corrected spec. One or two rounds fix most proportion and placement errors.

Needs ANTHROPIC_API_KEY in the environment.
"""
from __future__ import annotations

import base64
import io
import json
import os
import tempfile

from PIL import Image

from .palette import MATERIALS
from .parts import SHAPES, expand, make_mesh

DEFAULT_MODEL = os.environ.get("PHOTO2MC_MODEL", "claude-opus-5-5")


def _palette_text():
    groups: dict[str, list[str]] = {}
    for m in MATERIALS:
        tag = sorted(m.tags)[0] if m.tags else "other"
        extra = []
        if m.stairs:
            extra.append("stairs")
        if m.slab:
            extra.append("slab")
        groups.setdefault(tag, []).append(m.name + (f" ({'+'.join(extra)})" if extra else ""))
    return "\n".join(f"- {k}: " + ", ".join(v) for k, v in groups.items())


def _thin_text():
    try:
        from .connect import CONNECTABLES
    except Exception:  # noqa: BLE001
        return ""
    by = {}
    for c in CONNECTABLES.values():
        by.setdefault(c.kind, []).append(c.id)
    names = {"pane": "glass panes", "bars": "bars", "fence": "fences", "wall": "walls"}
    return ("THIN BLOCKS (connect to their neighbours automatically; a solid part with one of these materials is drawn "
            "even when thinner than a block — railings 0.1 m thick, balustrades, lattices, window grilles):\n"
            + "\n".join(f"- {names[k]}: " + ", ".join(sorted(v)) for k, v in by.items()))


def _examples_text():
    import json as _json
    here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples", "landmarks")
    out = []
    for n in ("big_ben", "arc_de_triomphe"):
        p = os.path.join(here, n + ".json")
        if os.path.exists(p):
            sp = _json.load(open(p))
            sp = {k: sp[k] for k in ("name", "height_m", "notes", "tilt", "parts") if k in sp}
            out.append(_json.dumps(sp, separators=(",", ":")))
    return "\n".join(out)


SYSTEM = f"""You convert photos of real structures into precise 3D massing specs that a program turns into Minecraft builds. Accuracy of proportions matters most, then recognisable details, then materials.

COORDINATES (meters, real-world scale)
- y is up; y=0 is the ground the structure stands on.
- x points to the RIGHT as seen in the (first) photo; z points TOWARD THE CAMERA. The facade facing the camera faces +z.
- Center the main structure on x=0, z=0.
- Every part's "at" is its BASE CENTER: [x, y_bottom, z]. A 10 m tall box standing on the ground has at y=0; a roof on top of it has at y=10.

SHAPES (all sizes in meters)
- box: "size": [width_x, height_y, depth_z]
- cylinder: "radius", "height", optional "radius_top" (taper), "sides" (4 = square tower, 6/8 = polygonal, default round)
- cone: "radius", "height", optional "sides"
- pyramid: "size": [w, h, d]  (apex at the top center)
- gable_roof: "size": [w, h, d], "ridge": "x" (ridge runs left-right) or "z" (front-back)
- hip_roof: "size": [w, h, d]
- dome: "radius", optional "height" (default = radius, a hemisphere; smaller = flatter)
- sphere: "radius"  (sits on its "at" point)
- revolve: "profile": [[radius, y], ...] bottom to top, ABSOLUTE y values, with "at" [x, 0, z]. Use for onion domes, spires with bulges, minarets, finials, vases, lighthouses.
- extrude: "footprint": [[x, z], ...] polygon relative to "at", "height". Use for L-shapes, chamfered or irregular plans.
- arch: "width", "height" (to the top of the round), "depth", optional "axis": "z" (opening runs front-back, i.e. seen on the front face) or "x" (seen on the side faces).
- beam: "from": [x,y,z], "to": [x,y,z], "radius" (round) or "width" (square). A strut between two points: leaning legs, trusses, flying buttresses, cables. "at" is ignored.

MODES
- "solid" (default): adds material.
- "carve": removes material. Use for arched openings, recesses, colonnade gaps, courtyards, doorways you can see through. To recess a facade element by r meters, center the carve on the wall face with depth 2*r.
- "paint": changes the material of whatever solid surface it overlaps, without changing shape. Use for windows, doors, stripes, bands, clock faces, signs. Center paint parts ON the wall face with a depth of at least 1.2 m so they reliably hit the surface.
Parts are applied in order: later solids override earlier ones; carves remove everything before them; paints apply at the end.

EXTRAS (on any part)
- "rotate": degrees about the vertical axis.
- "repeat": {{"count": n, "step": [dx, dy, dz]}}, or a grid {{"count": [nx, ny], "step": [[dx,0,0],[0,dy,0]]}}. Use for rows of windows, columns, floors, battlements.
- "mirror": "x", "z" or "xz" — also places the mirror image(s). Use it for symmetric buildings; it is also how you fill in the sides you cannot see.
- "tilt": [degrees about x, degrees about z], applied first about the part's base center. [90, 0] lays a cylinder along +z (a clock face or rose window on the front wall); [0, -90] lays it along +x (on the right wall).
- Top-level "tilt": [deg_x, deg_z] on the whole spec leans the entire structure (e.g. Pisa: [3.97, 0] leans it toward +z).

MATERIALS — use these exact names. "(stairs+slab)" families are best for anything sloped or curved, because slopes are built from stairs and slabs of the part's own material.
{_palette_text()}
{_thin_text()}
Choose materials by what the surface IS (marble, brick, slate, copper, glass) more than its exact photographed color, since photos are tinted by light and weather. Windows: paint a glass pane material (e.g. glass_pane, gray_stained_glass_pane) onto the wall — this turns those wall blocks into inset panes. Doors: a dark wood. Oxidized copper roofs: waxed_oxidized_cut_copper. Prefer classic blocks; avoid exotic ones unless the surface really looks like them.

DETAILING (what makes a build look crafted instead of a single-texture lump)
- Give each architectural role its own block from one colour family, so the structure reads at a glance: walls, plinth/base courses, columns, bands and cornices, accents and reliefs. 3-5 related blocks for the main body. For example: pale stone → smooth_sandstone walls, cut_sandstone bands and copings, sandstone columns, chiseled_sandstone capitals and reliefs; white marble → smooth_quartz walls, quartz_bricks bands, quartz_pillar shafts, chiseled_quartz_block accents; brick → bricks walls with stone_bricks or polished_andesite trim; grey stone → stone_bricks, polished_andesite, smooth_stone, chiseled_stone_bricks.
- Depth beats paint. Give every facade at least two depth layers: pilasters and columns stand proud of the wall; windows, doors and panels are recessed (carve one block deep, then paint the glass or wood onto the new back face); cornices, string courses and sills project half a block to a block beyond the wall below; plinths step out at the base.
- Columns get a base and a capital wider than the shaft (short boxes or cylinders). A run of thin columns or balusters can use a wall material (e.g. sandstone_wall).
- Frame corners, openings and wall tops with a contrasting trim block; cap walls, parapets and attics with a half-block coping.
- Roofs get eaves that overhang the wall; ridges and hips can take a contrasting block.
- Don't leave a large flat area as one texture: relief panels in a chiseled block, a band of cut stone, or a recessed panel break it up.
- Stay faithful: detail follows the real building and stays in its colour family; never invent features it does not have.

METHOD
1. Identify the structure. If it is a known landmark, use its real documented dimensions (height, footprint, dome diameter, tower heights) — say which you used in "analysis". Otherwise estimate scale from cues: doors ~2.1 m tall, storeys ~3-3.5 m (commercial ~4 m), people ~1.7 m, cars ~4.5 m long, steps ~0.17 m.
2. Break it into massing: base/plinth, main volumes, roofs, towers, domes, then secondary volumes, then openings and paint details.
3. Assume symmetry and typical design for hidden sides; use "mirror".
4. Detail to the build scale given in the request: anything smaller than about one block vanishes, and anything 1-3 blocks across reads as detail. Spend parts on bases, capitals, cornices, string courses, window and door surrounds, recesses, relief panels and railings (see DETAILING). Typical: 40-200 parts; use repeat and mirror to keep the spec compact.
5. Double-check: every roof's "at" y equals the top of what it sits on; nothing floats; towers reach their real heights.

WORKED EXAMPLES (real specs from the library — match this level of care):
{_examples_text()}

Always deliver the spec by calling the submit_structure tool, with no other reply.

Report the camera: "camera": {{"azimuth_deg": angle of the camera from the +z axis toward +x (0 = straight-on front, 45 = front-right corner), "elevation_deg": above the horizon}}.
"""

TOOL = {
    "name": "submit_structure",
    "description": "Submit the structure spec.",
    "input_schema": {
        "type": "object",
        "properties": {
            "analysis": {"type": "string", "description": "What the structure is, key dimensions and where they come from, how it breaks into parts. Write this first."},
            "name": {"type": "string"},
            "is_known_landmark": {"type": "boolean"},
            "height_m": {"type": "number", "description": "overall height in meters"},
            "camera": {"type": "object", "properties": {"azimuth_deg": {"type": "number"}, "elevation_deg": {"type": "number"}}},
            "parts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "shape": {"type": "string", "enum": SHAPES},
                        "at": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3},
                        "material": {"type": "string"},
                        "mode": {"type": "string", "enum": ["solid", "carve", "paint"]},
                        "label": {"type": "string", "description": "what this part is, e.g. 'north tower'"},
                    },
                    "required": ["shape", "at"],
                },
            },
        },
        "required": ["analysis", "name", "height_m", "parts", "camera"],
    },
}


def _image_block(img: str | Image.Image, max_side=1568):
    im = Image.open(img) if isinstance(img, str) else img
    im = im.convert("RGB")
    s = max(im.size)
    if s > max_side:
        im = im.resize((round(im.width * max_side / s), round(im.height * max_side / s)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                         "data": base64.b64encode(buf.getvalue()).decode()}}


def call_claude(client, **kw):
    """messages.create via streaming (the SDK refuses long non-streaming requests); stub clients may only have create."""
    if hasattr(client.messages, "stream"):
        with client.messages.stream(**kw) as s:
            return s.get_final_message()
    return client.messages.create(**kw)


def ask_tool(client, tool: dict, content: list, effort: str = "high", **kw) -> dict:
    """Get one call of `tool` and return its input. Current models reject a forced tool_choice, so the
    tool is offered with tool_choice auto and the model is nudged once if it answers in text instead."""
    messages = [{"role": "user", "content": content}]
    for _ in range(2):
        r = call_claude(client, tools=[tool], tool_choice={"type": "auto"},
                        output_config={"effort": effort}, messages=messages, **kw)
        if getattr(r, "stop_reason", None) == "refusal":
            raise RuntimeError(f"model declined: {getattr(r, 'stop_details', None)}")
        for blk in r.content:
            if blk.type == "tool_use":
                return dict(blk.input)
        if getattr(r, "stop_reason", None) == "max_tokens":
            raise RuntimeError("model ran out of output tokens before calling " + tool["name"])
        messages += [{"role": "assistant", "content": r.content},
                     {"role": "user", "content": f"Now call the {tool['name']} tool with your complete answer."}]
    raise RuntimeError(f"model did not call {tool['name']}")


def validate(spec: dict) -> list[str]:
    """Problems that would stop a build, as messages Claude can act on."""
    errs = []
    try:
        parts = expand(spec.get("parts", []))
    except Exception as e:  # noqa: BLE001
        return [f"repeat/mirror could not be expanded: {e}"]
    for i, p in enumerate(parts):
        try:
            make_mesh(p)
        except Exception as e:  # noqa: BLE001
            errs.append(f"part {i} ({p.get('label', p.get('shape'))}): {e}")
    if not any(p.get("mode", "solid") == "solid" for p in parts):
        errs.append("no solid parts")
    return errs


class SpecWriter:
    def __init__(self, model: str = DEFAULT_MODEL, client=None):
        if client is None:
            import anthropic
            client = anthropic.Anthropic()
        self.client = client
        self.model = model

    def _ask(self, content):
        return ask_tool(self.client, TOOL, content, model=self.model, max_tokens=64000, system=SYSTEM)

    def _with_fixes(self, content, spec):
        errs = validate(spec)
        if errs:
            spec = self._ask(content + [{"type": "text", "text":
                "Your previous spec had errors. Fix them and resubmit the complete spec:\n- "
                + "\n- ".join(errs) + "\n\nPrevious spec:\n" + json.dumps(spec)}])
        return spec

    def from_photos(self, photos: list, hint: str = "", scale: str = "") -> dict:
        content = [_image_block(p) for p in photos]
        txt = "Write the structure spec for the structure in this photo." if len(photos) == 1 else \
              f"These {len(photos)} photos show the same structure from different angles; the FIRST photo defines the front (+z). Write its structure spec."
        txt += "\n" + scale
        if hint:
            txt += f"\nUser's note: {hint}"
        content.append({"type": "text", "text": txt})
        return self._with_fixes(content, self._ask(content))

    def refine(self, photos: list, spec: dict, render_path: str, hint: str = "", block_size: float = 1.0) -> dict:
        content = [_image_block(p) for p in photos]
        content.append(_image_block(render_path))
        txt = ("The first image(s) are the photo(s). The LAST image is the Minecraft build made from your spec, "
               "rendered from your reported camera angle. Compare them carefully: overall proportions, heights "
               "of each tier, widths, roof pitch and position, towers, domes, openings, window rows, materials. "
               f"Then check the detailing at this scale ({block_size:.2f} m per block): flat walls with no depth "
               "layers, missing bases, capitals, cornices or surrounds, large areas of a single block, and details "
               "too small to show. The render draws each block in its average colour, so related blocks such as "
               "sandstone and smooth_sandstone look alike there; judge material variety from the spec. "
               "List the differences in 'analysis', then submit the corrected COMPLETE spec. Keep what is right.\n\n"
               "Current spec:\n" + json.dumps(spec))
        if hint:
            txt += f"\nUser's note: {hint}"
        content.append({"type": "text", "text": txt})
        return self._with_fixes(content, self._ask(content))


def photos_to_build(photos: list, rounds: int = 1, block_size: float | None = None,
                    height_blocks: int | None = None, hint: str = "", model: str = DEFAULT_MODEL,
                    workdir: str | None = None, log=print, client=None, target: str = "latest"):
    """Full loop. Returns (build, final spec, list of spec versions)."""
    from .semantic import build_from_spec
    from .render import render_iso
    w = SpecWriter(model=model, client=client)
    workdir = workdir or tempfile.mkdtemp(prefix="photo2mc_")
    os.makedirs(workdir, exist_ok=True)
    log("reading photo(s)...")
    spec = w.from_photos(photos, hint, _scale_note(block_size, height_blocks))
    versions = [spec]

    def bsize(sp):
        if block_size:
            return block_size
        if height_blocks:
            return float(sp.get("height_m") or 30) / height_blocks
        return _auto_block(sp)

    def make(sp):
        sp["recommended_block_size"] = round(bsize(sp), 3)    # so `photo2mc.py spec` rebuilds the same
        kw = {"height_blocks": height_blocks} if height_blocks and not block_size else \
             {"block_size": sp["recommended_block_size"]}
        return build_from_spec(sp, target=target, **kw)

    b = make(spec)
    log(f"  v1: {spec.get('name')} — {len(spec['parts'])} parts, {b.size} blocks")
    for r in range(rounds):
        cam = spec.get("camera") or {}
        png = os.path.join(workdir, f"render_v{r + 1}.png")
        render_iso(b, png, azimuth=cam.get("azimuth_deg", 30), elevation=cam.get("elevation_deg", 15))
        log(f"comparing build to photo (round {r + 1})...")
        spec = w.refine(photos, spec, png, hint, bsize(spec))
        versions.append(spec)
        b = make(spec)
        log(f"  v{r + 2}: {len(spec['parts'])} parts, {b.size} blocks")
    return b, spec, versions


DETAIL_BLOCKS = 80     # default build height in blocks: enough for bases, cornices and recesses to show


def _auto_block(spec) -> float:
    """About DETAIL_BLOCKS tall, between 0.25 and 1 m per block; past 256 m, whatever fits in 256 blocks."""
    h = float(spec.get("height_m") or 30)
    return round(max(h / 256, min(1.0, max(h / DETAIL_BLOCKS, 0.25))), 3)


def _scale_note(block_size=None, height_blocks=None) -> str:
    if block_size:
        return f"Build scale: {block_size:g} m per block."
    if height_blocks:
        return f"Build scale: the whole structure will be {height_blocks} blocks tall."
    return (f"Build scale: about {DETAIL_BLOCKS} blocks tall (height / {DETAIL_BLOCKS} m per block, "
            "between 0.25 and 1 m), so a 26 m building gets about 0.33 m blocks.")
