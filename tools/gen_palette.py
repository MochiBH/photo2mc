"""Generate mcbuild/palette_data.json from real Minecraft assets.

For every building family (full block + stairs + slab, discovered from the
game's own blockstates), resolve the block model to its textures and measure
the average color of the SIDE and TOP faces in linear light (what the eye
sees from a distance), plus texture contrast. Only colors are stored, not
textures.

    python tools/gen_palette.py <assets-dir for new version> <assets-dir for 1.21.1>

where each assets dir contains assets/minecraft/{blockstates,models,textures}
(e.g. a sparse checkout of github.com/InventivetalentDev/minecraft-assets).
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

NEW, OLD = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcbuild", "palette_data.json")


def ids(root):
    d = os.path.join(root, "assets/minecraft/blockstates")
    return {f[:-5] for f in os.listdir(d) if f.endswith(".json")}


new_ids, old_ids = ids(NEW), ids(OLD)
BS = os.path.join(NEW, "assets/minecraft/blockstates")
MD = os.path.join(NEW, "assets/minecraft/models")
TX = os.path.join(NEW, "assets/minecraft/textures")


def _strip(n):
    if isinstance(n, dict):                      # newer format: {"sprite": "..."}
        n = n.get("sprite") or n.get("texture") or ""
    return n.split(":")[-1]


def model_textures(model):
    """Walk the parent chain, merge textures, resolve #refs."""
    tex = {}
    m = _strip(model)
    seen = 0
    while m and seen < 12:
        p = os.path.join(MD, m + ".json")
        if not os.path.exists(p):
            break
        j = json.load(open(p))
        for k, v in j.get("textures", {}).items():
            tex.setdefault(k, v)
        m = _strip(j["parent"]) if "parent" in j else None
        seen += 1
    for _ in range(5):
        for k, v in list(tex.items()):
            if isinstance(v, dict):
                v = tex[k] = _strip(v)
            if isinstance(v, str) and v.startswith("#"):
                tex[k] = tex.get(v[1:], v)
    return tex


def block_model(bid):
    j = json.load(open(os.path.join(BS, bid + ".json")))
    if "variants" not in j:
        return None
    v = j["variants"]
    key = "" if "" in v else next((k for k in v if "axis=y" in k), next(iter(v)))
    e = v[key]
    if isinstance(e, list):
        e = e[0]
    return e["model"]


def tex_color(name):
    p = os.path.join(TX, _strip(name) + ".png")
    if not os.path.exists(p):
        return None
    im = np.asarray(Image.open(p).convert("RGBA"), dtype=np.float64) / 255
    w = im.shape[1]
    im = im[:w]                                   # first frame of animated textures
    a = im[..., 3]
    if a.sum() < 1e-6:
        return None
    c = im[..., :3]
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    mean = (lin * a[..., None]).sum((0, 1)) / a.sum()
    srgb = np.where(mean <= 0.0031308, 12.92 * mean, 1.055 * mean ** (1 / 2.4) - 0.055)
    luma = (c * [0.2126, 0.7152, 0.0722]).sum(-1)
    contrast = float(np.sqrt(np.average((luma - np.average(luma, weights=a)) ** 2, weights=a)))
    return [int(round(x * 255)) for x in srgb], contrast, float(a.mean())


def faces(bid):
    m = block_model(bid)
    if not m:
        return None
    t = model_textures(m)
    side = t.get("side") or t.get("all") or t.get("north") or t.get("texture") or t.get("particle")
    top = t.get("top") or t.get("end") or t.get("up") or t.get("all") or side
    if not side:
        return None
    s, tp = tex_color(side), tex_color(top)
    if not s:
        return None
    tp = tp or s
    return {"side": s[0], "top": tp[0], "contrast": round((s[1] + tp[1]) / 2, 3), "opacity": round(s[2], 3)}


# ---------------------------------------------------------------- families
SKIP = re.compile(r"(^|_)(ore|glazed|command|structure|jigsaw|spawner|sculk|shulker|infested|powder|"
                  r"leaves|petrified|suspicious|budding|reinforced|trial|vault|heavy_core|chest|"
                  r"waxed_waxed)(_|$)")


def is_ok(b):
    if SKIP.search(b):
        return False
    # copper that oxidizes on its own: keep only waxed versions
    if "copper" in b and not b.startswith("waxed_") and b not in ("copper_ore",):
        return False
    return True


def base_of(shape_id, suffix):
    b = shape_id[: -len(suffix)]
    for cand in (b, b + "s", b + "_block", b + "_planks"):
        if cand in new_ids and not cand.endswith(("_stairs", "_slab", "_wall")):
            return cand
    return None


fam = {}
for b in sorted(new_ids):
    for suf, key in (("_stairs", "stairs"), ("_slab", "slab")):
        if b.endswith(suf) and is_ok(b):
            base = base_of(b, suf)
            if base and is_ok(base):
                fam.setdefault(base, {})[key] = b

FULL_PATTERNS = [
    r".+_concrete", r".+_terracotta", r"terracotta", r".+_wool", r"glass", r"tinted_glass", r".+_stained_glass",
    r"waxed_(exposed_|weathered_|oxidized_)?copper(_block)?", r"waxed_(exposed_|weathered_|oxidized_)?chiseled_copper",
    r"(iron|gold|diamond|emerald|lapis|netherite|redstone|coal|amethyst|quartz|honeycomb|raw_iron|raw_gold|raw_copper)_block",
    r"calcite", r"dripstone_block", r"smooth_basalt", r"packed_mud", r"clay", r"obsidian", r"moss_block",
    r"snow_block", r"packed_ice", r"blue_ice", r"quartz_bricks", r"quartz_pillar", r"purpur_pillar",
    r"chiseled_.+", r"cracked_.+", r"(stripped_)?(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak)_wood",
    r"(stripped_)?(crimson|warped)_hyphae", r"bamboo_block", r"netherrack", r"nether_wart_block", r"warped_wart_block",
    r"end_stone", r"glowstone", r"sea_lantern", r"shroomlight", r".+_froglight", r"bookshelf", r"hay_block",
    r"magma_block", r"mud", r"dirt", r"coarse_dirt", r"rooted_dirt", r"podzol", r"mycelium", r"soul_soil",
    r"cobweb_never",
]
FULL_RE = re.compile("^(" + "|".join(FULL_PATTERNS) + ")$")
for b in sorted(new_ids):
    if FULL_RE.match(b) and is_ok(b) and b not in fam:
        fam[b] = {}


def tags_for(b):
    t = []
    if re.search(r"glass", b):
        t.append("detail")
    elif re.search(r"chiseled|pillar|lantern|glowstone|froglight|shroomlight|bookshelf|hay|magma|"
                   r"redstone|coal|raw_|honeycomb|emerald|diamond|lapis|netherite|amethyst|nether_wart|warped_wart|"
                   r"^mud$|dirt|podzol|mycelium|soil|snow|ice|moss|clay|bamboo_mosaic", b):
        t.append("detail")
    elif re.search(r"plank|_wood$|hyphae|bamboo", b):
        t.append("wood")
    elif "copper" in b or b in ("iron_block", "gold_block"):
        t.append("metal")
    elif b.endswith("_wool"):
        t.append("wool")                  # flammable, fabric look: opt-in only
    elif "concrete" in b:
        t.append("color")
    elif "terracotta" in b:
        t += ["color", "earth"]
    else:
        t.append("stone")
    if re.search(r"deepslate_tile|dark_prismarine|oxidized|weathered|bricks$|tiles$", b):
        t.append("roof")
    return t


out = []
for base, f in sorted(fam.items()):
    fc = faces(base)
    if not fc or fc["opacity"] < 0.15 and "glass" not in base:
        continue
    entry = {"name": base, "full": base, "stairs": f.get("stairs"), "slab": f.get("slab"),
             "tags": tags_for(base), **fc,
             "since": {"full": "26" if base not in old_ids else "1.21",
                       "stairs": ("26" if f.get("stairs") not in old_ids else "1.21") if f.get("stairs") else None,
                       "slab": ("26" if f.get("slab") not in old_ids else "1.21") if f.get("slab") else None}}
    out.append(entry)

# ---------------------------------------------------------------- thin, connecting blocks
by_name = {e["name"]: e for e in out}
conn = []
for b in sorted(new_ids):
    kind = None
    if b.endswith("_pane"):
        kind, base = "pane", base_of(b, "_pane")
    elif b.endswith("_bars"):
        kind, base = "bars", None
    elif b.endswith("_fence"):
        kind, base = "fence", base_of(b, "_fence")
    elif b.endswith("_wall") and not re.search(r"(sign|banner|torch|head|skull|fan)", b):
        kind, base = "wall", base_of(b, "_wall")
    if not kind or not is_ok(b):
        continue
    if kind == "fence" and b == "nether_brick_fence":
        base = "nether_bricks"
    col = by_name[base]["side"] if base in by_name else None
    if col is None:                       # bars: measure their own texture
        fc = faces(b) if os.path.exists(os.path.join(BS, b + ".json")) else None
        t = tex_color("block/" + b) if fc is None else None
        col = fc["side"] if fc else (t[0] if t else None)
    if col is None:
        continue
    conn.append({"id": b, "kind": kind, "base": base, "rgb": col,
                 "since": "26" if b not in old_ids else "1.21"})

with open(OUT, "w") as fh:
    json.dump({"source": "Minecraft block textures, measured by tools/gen_palette.py",
               "versions": {"latest": os.path.basename(os.path.normpath(NEW)), "compat": "1.21.1"},
               "materials": out, "connectables": conn}, fh, indent=0)
print("connectables:", len(conn), {k: sum(1 for c in conn if c["kind"] == k) for k in ("pane", "bars", "fence", "wall")})
print(len(out), "materials ->", OUT)
print("with stairs:", sum(1 for e in out if e["stairs"]), " slab-only:", sum(1 for e in out if e["slab"] and not e["stairs"]),
      " new in 26.x (full):", sum(1 for e in out if e["since"]["full"] == "26"),
      " new stairs:", sum(1 for e in out if e["since"]["stairs"] == "26"))
