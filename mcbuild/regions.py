"""Semantic materials for colour-matched builds (scans and models).

Colour matching alone can't tell window glass from a light-blue wall, or a
copper roof from green paint. This splits a build into regions (same block,
connected), renders them with numbered colours, and asks Claude what each
region really is. Then it swaps in the right blocks — glass panes, roof
tiles, wood doors — keeping every stair and slab shape.

Needs ANTHROPIC_API_KEY (or pass a client).
"""
from __future__ import annotations

import colorsys
import json
import os
import tempfile

import numpy as np
from scipy import ndimage

from .voxelize import Build, FULL, STAIRS, SLAB, CONNECT
from .connect import Connectable, connection_states
from .semantic import resolve_material
from .palette import for_version, BY_NAME


def find_regions(b: Build, min_size=12, max_regions=30):
    """Region = connected blocks of one family. Small pieces of a family are
    pooled into one 'scattered' region. Returns (region id per block, info)."""
    X, Y, Z = b.size
    fam = np.array(b.materials)
    rid = np.full(len(b.coords), -1)
    info = []
    for name in sorted(set(fam), key=lambda n: -(fam == n).sum()):
        sel = np.flatnonzero(fam == name)
        g = np.zeros((X, Y, Z), bool)
        g[tuple(b.coords[sel].T)] = True
        lab, n = ndimage.label(g, structure=np.ones((3, 3, 3)))
        comp = lab[tuple(b.coords[sel].T)]
        sizes = np.bincount(comp, minlength=n + 1)
        big = [c for c in range(1, n + 1) if sizes[c] >= min_size]
        groups = [[c] for c in sorted(big, key=lambda c: -sizes[c])]
        rest = [c for c in range(1, n + 1) if sizes[c] < min_size]
        if rest:
            groups.append(rest)
        for gi, cs in enumerate(groups):
            members = sel[np.isin(comp, cs)]
            rid[members] = len(info)
            info.append({"block": name, "members": members, "scattered": gi == len(groups) - 1 and bool(rest)})
    order = sorted(range(len(info)), key=lambda i: -len(info[i]["members"]))
    keep = order[:max_regions]
    remap = {old: new for new, old in enumerate(keep)}
    out_rid = np.array([remap.get(r, -1) for r in rid])
    regions = []
    for new, old in enumerate(keep):
        m = info[old]["members"]
        c = b.coords[m]
        top_exposed = _top_share(b, m)
        regions.append({
            "id": new, "current_block": info[old]["block"], "blocks": int(len(m)),
            "share_pct": round(100 * len(m) / len(b.coords), 1),
            "x_range": [int(c[:, 0].min()), int(c[:, 0].max())], "y_range": [int(c[:, 1].min()), int(c[:, 1].max())],
            "z_range": [int(c[:, 2].min()), int(c[:, 2].max())],
            "facing_up_pct": round(100 * top_exposed, 0),
            "stairs_or_slabs_pct": round(100 * np.isin(b.kinds[m], [STAIRS, SLAB]).mean(), 0),
            "scattered_small_pieces": info[old]["scattered"],
        })
    return out_rid, regions


def _top_share(b, members):
    occ = {tuple(c) for c in b.coords.tolist()}
    up = sum((x, y + 1, z) not in occ for x, y, z in b.coords[members].tolist())
    return up / max(len(members), 1)


def _distinct(n):
    return [tuple(int(255 * v) for v in colorsys.hsv_to_rgb((i * 0.618034) % 1, 0.75, 0.95)) for i in range(n)]


def render_regions(b: Build, rid, path, azimuth=35, elevation=25):
    """Numbered false-colour render: one colour per region, legend beside it."""
    from PIL import Image, ImageDraw
    from .render import render_iso
    cols = _distinct(int(rid.max()) + 1)
    fake = Build(b.size, b.coords, b.kinds, b.states,
                 np.array([cols[r] if r >= 0 else (90, 90, 90) for r in rid]), b.materials)
    tmp = path + ".tmp.png"
    render_iso(fake, tmp, azimuth=azimuth, elevation=elevation, size=8)
    im = Image.open(tmp).convert("RGB")
    os.remove(tmp)
    leg = Image.new("RGB", (190, im.height), (255, 255, 255))
    d = ImageDraw.Draw(leg)
    for i, c in enumerate(cols):
        yy = 10 + i * 22
        if yy > im.height - 20:
            break
        d.rectangle([10, yy, 28, yy + 16], fill=c, outline=(0, 0, 0))
        d.text((36, yy + 2), f"region {i}", fill=(0, 0, 0))
    out = Image.new("RGB", (im.width + leg.width, im.height), (255, 255, 255))
    out.paste(im, (0, 0))
    out.paste(leg, (im.width, 0))
    out.save(path)
    return path


TOOL = {
    "name": "assign_materials",
    "description": "Assign the right Minecraft block to each region.",
    "input_schema": {
        "type": "object",
        "properties": {
            "analysis": {"type": "string", "description": "What the structure is and what each region is (wall, roof, windows, door, trim, ground...)."},
            "regions": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "integer"}, "material": {"type": "string"}, "what_it_is": {"type": "string"}},
                "required": ["id", "material"]}},
        },
        "required": ["analysis", "regions"],
    },
}

PROMPT = """This Minecraft build was made from a 3D scan/model by matching colours only. Colour matching can't tell what a surface IS, so it picks blocks that are the right colour but the wrong thing (light-blue terracotta for windows, green concrete for an oxidised copper roof, sandstone for a stucco wall).

Images: {images}. The false-colour render numbers each region; the table below gives each region's current block, size, position (block coordinates, y up) and how much of it faces up (roofs, floors, ground).

{table}

For EVERY region, choose the block it should be, using what the surface really is. Keep a region's current block if it is already right. Use exact names from this list:
{materials}

Rules: windows -> a glass pane material (glass_pane or a *_stained_glass_pane; dark windows: gray/black stained glass pane); doors -> dark wood planks; roofs -> roof materials (deepslate_tiles, bricks, a copper, dark_prismarine, ...) with stairs; railings -> fences or iron_bars; keep sloped regions (high stairs_or_slabs_pct) on materials that have stairs and slabs. Stay close to the real colour among the plausible materials."""


def ask_claude(b: Build, rid, regions, photos=(), model=None, client=None, workdir=None):
    from .vision import _image_block, DEFAULT_MODEL, _palette_text, ask_tool
    from .render import render_iso
    if client is None:
        import anthropic
        client = anthropic.Anthropic()
    workdir = workdir or tempfile.mkdtemp(prefix="photo2mc_regions_")
    reg_png = render_regions(b, rid, os.path.join(workdir, "regions.png"))
    real_png = os.path.join(workdir, "build.png")
    render_iso(b, real_png, azimuth=35, elevation=25, size=8)
    content = [_image_block(p) for p in photos] + [_image_block(real_png), _image_block(reg_png)]
    imgs = (f"{len(photos)} photo(s) of the real structure, then " if photos else "") + \
           "the build as it looks now, then the false-colour region map"
    from .connect import CONNECTABLES
    thin = ", ".join(sorted(c for c in CONNECTABLES if c.endswith(("_pane", "_fence", "iron_bars"))))
    content.append({"type": "text", "text": PROMPT.format(
        images=imgs, table=json.dumps(regions, indent=0), materials=_palette_text() + "\n- thin: " + thin)})
    return ask_tool(client, TOOL, content, model=model or DEFAULT_MODEL, max_tokens=16000)


def apply_assignment(b: Build, rid, assignment, target="latest") -> Build:
    """Swap region materials, keeping each block's shape."""
    by_region = {int(r["id"]): r["material"] for r in assignment.get("regions", [])}
    states = list(b.states)
    kinds = b.kinds.copy()
    rgb = b.rgb.copy()
    names = list(b.materials)
    for i, r in enumerate(rid):
        if r < 0 or r not in by_region:
            continue
        m = resolve_material(by_region[r])
        props = states[i][states[i].index("["):] if "[" in states[i] else ""
        if isinstance(m, Connectable):
            if kinds[i] != FULL:
                continue                      # panes/fences only replace whole blocks
            kinds[i] = CONNECT
            states[i] = f"minecraft:{m.id}"
            rgb[i] = m.rgb
            names[i] = m.id
            continue
        m = for_version(m, target) or for_version(BY_NAME["stone"], target)
        if kinds[i] == STAIRS:
            states[i] = f"minecraft:{m.stairs}{props}" if m.stairs else f"minecraft:{m.full}"
            if not m.stairs:
                kinds[i] = FULL
        elif kinds[i] == SLAB:
            states[i] = f"minecraft:{m.slab}{props}" if m.slab else f"minecraft:{m.full}"
            if not m.slab:
                kinds[i] = FULL
        elif kinds[i] == FULL:
            states[i] = f"minecraft:{m.full}"
        rgb[i] = m.rgb
        names[i] = m.name
    conn = kinds == CONNECT
    if conn.any():
        from .connect import CONNECTABLES
        ids = np.array([s.split("[")[0].replace("minecraft:", "") if conn[i] else "" for i, s in enumerate(states)], dtype=object)
        ck = np.array([CONNECTABLES[x].kind if conn[i] else "" for i, x in enumerate(ids)], dtype=object)
        for i, st in connection_states(b.coords, ids, ck, conn, kinds == FULL).items():
            states[i] = st
    return Build(b.size, b.coords, kinds, states, rgb, names, b.color_error)
