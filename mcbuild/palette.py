"""Minecraft building-block palette with perceptual (CIELAB) color matching.

Each material is a *family*: the full block plus its stairs and slab variants
when they exist, so a roof sloping through a brick wall becomes brick stairs,
not a random gray stair. Colors are approximate texture averages (sRGB).
They are good enough for matching; `calibrate_from_textures()` can replace
them with exact averages computed from a resource pack.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np


@dataclass(frozen=True)
class Material:
    name: str                 # family name, e.g. "bricks"
    full: str                 # block id of the full block
    rgb: tuple[int, int, int]
    stairs: str | None = None
    slab: str | None = None
    tags: frozenset = field(default_factory=frozenset)  # e.g. {"stone","wood"}


def _m(name, rgb, stairs=None, slab=None, full=None, tags=()):
    return Material(name, full or name, rgb, stairs, slab, frozenset(tags))


# fmt: off
MATERIALS: list[Material] = [
    # --- stone family -----------------------------------------------------
    _m("stone",            (125,125,125), "stone_stairs", "stone_slab", tags=["stone"]),
    _m("cobblestone",      (127,127,127), "cobblestone_stairs", "cobblestone_slab", tags=["stone"]),
    _m("mossy_cobblestone",(110,118, 94), "mossy_cobblestone_stairs", "mossy_cobblestone_slab", tags=["stone"]),
    _m("stone_bricks",     (122,121,122), "stone_brick_stairs", "stone_brick_slab", tags=["stone"]),
    _m("mossy_stone_bricks",(115,121,105),"mossy_stone_brick_stairs", "mossy_stone_brick_slab", tags=["stone"]),
    _m("smooth_stone",     (158,158,158), None, "smooth_stone_slab", tags=["stone"]),
    _m("andesite",         (136,136,137), "andesite_stairs", "andesite_slab", tags=["stone"]),
    _m("polished_andesite",(132,135,134), "polished_andesite_stairs", "polished_andesite_slab", tags=["stone"]),
    _m("diorite",          (189,188,189), "diorite_stairs", "diorite_slab", tags=["stone"]),
    _m("polished_diorite", (193,193,195), "polished_diorite_stairs", "polished_diorite_slab", tags=["stone"]),
    _m("granite",          (149,103, 86), "granite_stairs", "granite_slab", tags=["stone"]),
    _m("polished_granite", (154,106, 89), "polished_granite_stairs", "polished_granite_slab", tags=["stone"]),
    _m("cobbled_deepslate",( 77, 77, 80), "cobbled_deepslate_stairs", "cobbled_deepslate_slab", tags=["stone"]),
    _m("polished_deepslate",(72, 72, 73), "polished_deepslate_stairs", "polished_deepslate_slab", tags=["stone"]),
    _m("deepslate_bricks", ( 70, 70, 71), "deepslate_brick_stairs", "deepslate_brick_slab", tags=["stone"]),
    _m("deepslate_tiles",  ( 54, 54, 55), "deepslate_tile_stairs", "deepslate_tile_slab", tags=["stone","roof"]),
    _m("tuff",             (108,109,102), "tuff_stairs", "tuff_slab", tags=["stone"]),
    _m("tuff_bricks",      ( 98,103, 95), "tuff_brick_stairs", "tuff_brick_slab", tags=["stone"]),
    _m("blackstone",       ( 42, 36, 41), "blackstone_stairs", "blackstone_slab", tags=["stone"]),
    _m("polished_blackstone_bricks",(48,42,49),"polished_blackstone_brick_stairs","polished_blackstone_brick_slab", tags=["stone"]),
    _m("mud_bricks",       (137,103, 79), "mud_brick_stairs", "mud_brick_slab", tags=["stone"]),
    _m("bricks",           (151, 98, 83), "brick_stairs", "brick_slab", tags=["stone"]),
    _m("sandstone",        (216,203,155), "sandstone_stairs", "sandstone_slab", tags=["stone"]),
    _m("smooth_sandstone", (223,214,170), "smooth_sandstone_stairs", "smooth_sandstone_slab", tags=["stone"]),
    _m("cut_sandstone",    (217,206,159), None, "cut_sandstone_slab", tags=["stone"]),
    _m("red_sandstone",    (186, 99, 29), "red_sandstone_stairs", "red_sandstone_slab", tags=["stone"]),
    _m("smooth_red_sandstone",(181,97,31),"smooth_red_sandstone_stairs","smooth_red_sandstone_slab", tags=["stone"]),
    _m("quartz_block",     (236,230,223), "quartz_stairs", "quartz_slab", tags=["stone"]),
    _m("smooth_quartz",    (235,229,222), "smooth_quartz_stairs", "smooth_quartz_slab", tags=["stone"]),
    _m("prismarine",       ( 99,156,151), "prismarine_stairs", "prismarine_slab", tags=["stone"]),
    _m("prismarine_bricks",( 99,172,158), "prismarine_brick_stairs", "prismarine_brick_slab", tags=["stone"]),
    _m("dark_prismarine",  ( 52, 92, 76), "dark_prismarine_stairs", "dark_prismarine_slab", tags=["stone","roof"]),
    _m("nether_bricks",    ( 44, 21, 26), "nether_brick_stairs", "nether_brick_slab", tags=["stone"]),
    _m("red_nether_bricks",( 69,  7,  9), "red_nether_brick_stairs", "red_nether_brick_slab", tags=["stone"]),
    _m("end_stone_bricks", (218,224,162), "end_stone_brick_stairs", "end_stone_brick_slab", tags=["stone"]),
    _m("purpur_block",     (169,125,169), "purpur_stairs", "purpur_slab", tags=["stone"]),
    # --- copper (waxed so it never oxidizes) ------------------------------
    _m("waxed_cut_copper",           (191,106, 80), "waxed_cut_copper_stairs", "waxed_cut_copper_slab", tags=["metal"]),
    _m("waxed_exposed_cut_copper",   (154,121,101), "waxed_exposed_cut_copper_stairs", "waxed_exposed_cut_copper_slab", tags=["metal"]),
    _m("waxed_weathered_cut_copper", (109,145,107), "waxed_weathered_cut_copper_stairs", "waxed_weathered_cut_copper_slab", tags=["metal","roof"]),
    _m("waxed_oxidized_cut_copper",  ( 79,153,126), "waxed_oxidized_cut_copper_stairs", "waxed_oxidized_cut_copper_slab", tags=["metal","roof"]),
    # --- wood -------------------------------------------------------------
    _m("oak_planks",     (162,131, 79), "oak_stairs", "oak_slab", tags=["wood"]),
    _m("spruce_planks",  (115, 85, 49), "spruce_stairs", "spruce_slab", tags=["wood"]),
    _m("birch_planks",   (192,175,121), "birch_stairs", "birch_slab", tags=["wood"]),
    _m("jungle_planks",  (160,115, 81), "jungle_stairs", "jungle_slab", tags=["wood"]),
    _m("acacia_planks",  (168, 90, 50), "acacia_stairs", "acacia_slab", tags=["wood"]),
    _m("dark_oak_planks",( 67, 43, 20), "dark_oak_stairs", "dark_oak_slab", tags=["wood"]),
    _m("mangrove_planks",(118, 54, 49), "mangrove_stairs", "mangrove_slab", tags=["wood"]),
    _m("cherry_planks",  (226,178,172), "cherry_stairs", "cherry_slab", tags=["wood"]),
    _m("bamboo_planks",  (194,173, 80), "bamboo_stairs", "bamboo_slab", tags=["wood"]),
    _m("crimson_planks", (101, 49, 71), "crimson_stairs", "crimson_slab", tags=["wood"]),
    _m("warped_planks",  ( 43,105, 99), "warped_stairs", "warped_slab", tags=["wood"]),
    # --- full-only color blocks (no stairs/slabs exist) --------------------
    _m("white_concrete",      (207,213,214), tags=["color"]),
    _m("light_gray_concrete", (125,125,115), tags=["color"]),
    _m("gray_concrete",       ( 55, 58, 62), tags=["color"]),
    _m("black_concrete",      (  8, 10, 15), tags=["color"]),
    _m("brown_concrete",      ( 96, 60, 32), tags=["color"]),
    _m("red_concrete",        (142, 33, 33), tags=["color"]),
    _m("orange_concrete",     (224, 97,  1), tags=["color"]),
    _m("yellow_concrete",     (241,175, 21), tags=["color"]),
    _m("lime_concrete",       ( 94,169, 25), tags=["color"]),
    _m("green_concrete",      ( 73, 91, 36), tags=["color"]),
    _m("cyan_concrete",       ( 21,119,136), tags=["color"]),
    _m("light_blue_concrete", ( 36,137,199), tags=["color"]),
    _m("blue_concrete",       ( 45, 47,143), tags=["color"]),
    _m("purple_concrete",     (100, 32,156), tags=["color"]),
    _m("magenta_concrete",    (169, 48,159), tags=["color"]),
    _m("pink_concrete",       (214,101,143), tags=["color"]),
    _m("terracotta",              (152, 94, 68), tags=["color","earth"]),
    _m("white_terracotta",        (210,178,161), tags=["color","earth"]),
    _m("light_gray_terracotta",   (135,107, 98), tags=["color","earth"]),
    _m("gray_terracotta",         ( 58, 42, 36), tags=["color","earth"]),
    _m("brown_terracotta",        ( 77, 51, 36), tags=["color","earth"]),
    _m("red_terracotta",          (143, 61, 47), tags=["color","earth"]),
    _m("orange_terracotta",       (162, 84, 38), tags=["color","earth"]),
    _m("yellow_terracotta",       (186,133, 35), tags=["color","earth"]),
    _m("cyan_terracotta",         ( 87, 91, 91), tags=["color","earth"]),
    _m("light_blue_terracotta",   (113,109,138), tags=["color","earth"]),
    _m("green_terracotta",        ( 76, 83, 42), tags=["color","earth"]),
    _m("iron_block",  (220,220,220), tags=["metal"]),
    _m("gold_block",  (246,208, 62), tags=["metal"]),
    # --- detail blocks: only placed on purpose (windows, trim), never chosen
    #     by colour matching unless asked for with --materials detail
    _m("glass",                    (176,214,219), tags=["detail"]),
    _m("white_stained_glass",      (255,255,255), tags=["detail"]),
    _m("light_gray_stained_glass", (153,153,153), tags=["detail"]),
    _m("gray_stained_glass",       ( 76, 76, 76), tags=["detail"]),
    _m("black_stained_glass",      ( 25, 25, 25), tags=["detail"]),
    _m("light_blue_stained_glass", (102,153,216), tags=["detail"]),
    _m("cyan_stained_glass",       ( 76,127,153), tags=["detail"]),
    _m("blue_stained_glass",       ( 51, 76,178), tags=["detail"]),
    _m("brown_stained_glass",      (102, 76, 51), tags=["detail"]),
    _m("chiseled_stone_bricks",    (119,118,119), tags=["detail"]),
    _m("chiseled_sandstone",       (216,202,155), tags=["detail"]),
    _m("chiseled_quartz_block",    (231,226,218), tags=["detail"]),
    _m("quartz_pillar",            (235,230,222), tags=["detail"]),
    _m("glowstone",                (171,131, 84), tags=["detail"]),
    _m("sea_lantern",              (172,199,190), tags=["detail"]),
    _m("snow_block",               (249,254,254), tags=["detail"]),
    _m("grass_block",              ( 95,159, 53), tags=["detail"]),
    _m("water",                    ( 63,118,228), tags=["detail"]),
]
# fmt: on

BY_NAME = {m.name: m for m in MATERIALS}


# --------------------------------------------------------------------------
# color science
# --------------------------------------------------------------------------
def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """(..., 3) sRGB 0-255 -> CIELAB (D65)."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


class Palette:
    """A (possibly restricted) set of materials with fast nearest-color lookup."""

    def __init__(self, materials: list[Material] | None = None,
                 include_tags: set[str] | None = None,
                 exclude: set[str] | None = None):
        mats = list(materials or MATERIALS)
        if include_tags:
            mats = [m for m in mats if m.tags & include_tags]
        elif materials is None:
            mats = [m for m in mats if "detail" not in m.tags]
        if exclude:
            mats = [m for m in mats if m.name not in exclude]
        if not mats:
            raise ValueError("palette is empty after filtering")
        self.materials = mats
        self.lab = srgb_to_lab(np.array([m.rgb for m in mats]))
        self.has_stairs = np.array([m.stairs is not None for m in mats])
        self.has_slab = np.array([m.slab is not None for m in mats])

    def distances(self, lab: np.ndarray) -> np.ndarray:
        """(N, M) perceptual distance. Lightness weighted a bit less than
        chroma: builds read better with the right hue and slightly-off
        brightness than the reverse."""
        w = np.array([0.8, 1.0, 1.0])
        return np.sqrt((((lab[:, None, :] - self.lab[None, :, :]) * w) ** 2).sum(-1))

    def nearest(self, lab: np.ndarray, mask: np.ndarray | None = None,
                shaped_bonus: float = 0.0) -> np.ndarray:
        """Index of the nearest material for each Lab color (N,3).

        shaped_bonus (in ΔE units) favours families that have stairs AND
        slabs, so walls and roofs can use the same material as their sloped
        and half-height parts.
        """
        d = self.distances(lab)
        if shaped_bonus:
            d = d + shaped_bonus * ~(self.has_stairs & self.has_slab)
        if mask is not None:
            d = np.where(mask[None, :], d, np.inf)
        return np.argmin(d, axis=1)

    def restrict_to(self, indices) -> "Palette":
        return Palette([self.materials[i] for i in sorted(set(indices))])


def calibrate_from_textures(texture_dir: str) -> None:
    """Replace palette colors with exact averages from a resource pack.

    Point it at assets/minecraft/textures/block from a Minecraft jar
    (unzip the client .jar). Uses the side texture when one exists.
    """
    import os
    from PIL import Image
    global MATERIALS, BY_NAME
    out = []
    for m in MATERIALS:
        tex = None
        for cand in (m.full, m.full.replace("waxed_", ""), m.full + "_side",
                     m.full.replace("_block", ""), m.full.replace("_planks", "_planks")):
            p = os.path.join(texture_dir, cand + ".png")
            if os.path.exists(p):
                tex = p
                break
        if tex is None:
            out.append(m)
            continue
        im = np.asarray(Image.open(tex).convert("RGBA"), dtype=np.float64)[:16, :16]
        a = im[..., 3:] / 255
        rgb = tuple(int(v) for v in (im[..., :3] * a).sum((0, 1)) / max(a.sum(), 1e-6))
        out.append(Material(m.name, m.full, rgb, m.stairs, m.slab, m.tags))
    MATERIALS[:] = out
    BY_NAME.clear()
    BY_NAME.update({m.name: m for m in MATERIALS})
