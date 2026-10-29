"""Survival materials: what to place, and what to gather to make it.

Each placed block is traced back through its crafting / smelting /
stonecutting recipe to raw resources (cobblestone, sand, logs, nether quartz,
ingots, dyes...). Stone-type stairs, slabs and walls use the stonecutter
(1 block -> 1 stair, 2 slabs, 1 wall), which is cheaper than the crafting
table (6 -> 4 stairs).
"""
from __future__ import annotations

import math
from collections import defaultdict

from .palette import MATERIALS
from .connect import CONNECTABLES

COLORS = ["white", "light_gray", "gray", "black", "brown", "red", "orange", "yellow", "lime", "green",
          "cyan", "light_blue", "blue", "purple", "magenta", "pink"]
WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"]

# block -> (inputs {item: qty}, output qty, station)
R: dict[str, tuple[dict, int, str]] = {
    "stone": ({"cobblestone": 1}, 1, "furnace"),
    "smooth_stone": ({"stone": 1}, 1, "furnace"),
    "stone_bricks": ({"stone": 1}, 1, "stonecutter"),
    "mossy_cobblestone": ({"cobblestone": 1, "vine": 1}, 1, "crafting"),
    "mossy_stone_bricks": ({"stone_bricks": 1, "vine": 1}, 1, "crafting"),
    "cracked_stone_bricks": ({"stone_bricks": 1}, 1, "furnace"),
    "chiseled_stone_bricks": ({"stone": 1}, 1, "stonecutter"),
    "polished_andesite": ({"andesite": 1}, 1, "stonecutter"),
    "polished_diorite": ({"diorite": 1}, 1, "stonecutter"),
    "polished_granite": ({"granite": 1}, 1, "stonecutter"),
    "polished_deepslate": ({"cobbled_deepslate": 1}, 1, "stonecutter"),
    "deepslate_bricks": ({"cobbled_deepslate": 1}, 1, "stonecutter"),
    "deepslate_tiles": ({"cobbled_deepslate": 1}, 1, "stonecutter"),
    "chiseled_deepslate": ({"cobbled_deepslate": 1}, 1, "stonecutter"),
    "cracked_deepslate_bricks": ({"deepslate_bricks": 1}, 1, "furnace"),
    "cracked_deepslate_tiles": ({"deepslate_tiles": 1}, 1, "furnace"),
    "polished_tuff": ({"tuff": 1}, 1, "stonecutter"),
    "tuff_bricks": ({"tuff": 1}, 1, "stonecutter"),
    "chiseled_tuff": ({"tuff": 1}, 1, "stonecutter"),
    "chiseled_tuff_bricks": ({"tuff": 1}, 1, "stonecutter"),
    "polished_blackstone": ({"blackstone": 1}, 1, "stonecutter"),
    "polished_blackstone_bricks": ({"blackstone": 1}, 1, "stonecutter"),
    "chiseled_polished_blackstone": ({"blackstone": 1}, 1, "stonecutter"),
    "polished_basalt": ({"basalt": 1}, 1, "stonecutter"),
    "smooth_basalt": ({"basalt": 1}, 1, "furnace"),
    "bricks": ({"brick": 4}, 1, "crafting"),
    "brick": ({"clay_ball": 1}, 1, "furnace"),
    "mud_bricks": ({"packed_mud": 1}, 1, "stonecutter"),
    "packed_mud": ({"mud": 1, "wheat": 1}, 1, "crafting"),
    "mud": ({"dirt": 1, "water_bottle": 1}, 1, "use"),
    "sandstone": ({"sand": 4}, 1, "crafting"),
    "smooth_sandstone": ({"sandstone": 1}, 1, "furnace"),
    "cut_sandstone": ({"sandstone": 1}, 1, "stonecutter"),
    "chiseled_sandstone": ({"sandstone": 1}, 1, "stonecutter"),
    "red_sandstone": ({"red_sand": 4}, 1, "crafting"),
    "smooth_red_sandstone": ({"red_sandstone": 1}, 1, "furnace"),
    "cut_red_sandstone": ({"red_sandstone": 1}, 1, "stonecutter"),
    "chiseled_red_sandstone": ({"red_sandstone": 1}, 1, "stonecutter"),
    "quartz_block": ({"nether_quartz": 4}, 1, "crafting"),
    "smooth_quartz": ({"quartz_block": 1}, 1, "furnace"),
    "quartz_bricks": ({"quartz_block": 1}, 1, "stonecutter"),
    "quartz_pillar": ({"quartz_block": 1}, 1, "stonecutter"),
    "chiseled_quartz_block": ({"quartz_block": 1}, 1, "stonecutter"),
    "prismarine": ({"prismarine_shard": 4}, 1, "crafting"),
    "prismarine_bricks": ({"prismarine_shard": 9}, 1, "crafting"),
    "dark_prismarine": ({"prismarine_shard": 8, "ink_sac": 1}, 1, "crafting"),
    "nether_bricks": ({"nether_brick": 4}, 1, "crafting"),
    "nether_brick": ({"netherrack": 1}, 1, "furnace"),
    "red_nether_bricks": ({"nether_brick": 2, "nether_wart": 2}, 1, "crafting"),
    "end_stone_bricks": ({"end_stone": 1}, 1, "stonecutter"),
    "purpur_block": ({"popped_chorus_fruit": 4}, 4, "crafting"),
    "purpur_pillar": ({"purpur_block": 1}, 1, "stonecutter"),
    "terracotta": ({"clay": 1}, 1, "furnace"),
    "clay": ({"clay_ball": 4}, 1, "crafting"),
    "glass": ({"sand": 1}, 1, "furnace"),
    "glass_pane": ({"glass": 6}, 16, "crafting"),
    "tinted_glass": ({"amethyst_shard": 4, "glass": 1}, 2, "crafting"),
    "iron_bars": ({"iron_ingot": 6}, 16, "crafting"),
    "iron_block": ({"iron_ingot": 9}, 1, "crafting"),
    "gold_block": ({"gold_ingot": 9}, 1, "crafting"),
    "diamond_block": ({"diamond": 9}, 1, "crafting"),
    "emerald_block": ({"emerald": 9}, 1, "crafting"),
    "lapis_block": ({"lapis_lazuli": 9}, 1, "crafting"),
    "copper_block": ({"copper_ingot": 9}, 1, "crafting"),
    "waxed_copper_block": ({"copper_block": 1, "honeycomb": 1}, 1, "crafting"),
    "waxed_cut_copper": ({"waxed_copper_block": 1}, 4, "stonecutter"),
    "bamboo_planks": ({"bamboo_block": 1}, 2, "crafting"),
    "bamboo_block": ({"bamboo": 9}, 1, "crafting"),
    "stick": ({"oak_planks": 2}, 4, "crafting"),
    "nether_brick_fence": ({"nether_bricks": 4, "nether_brick": 2}, 6, "crafting"),
    "sea_lantern": ({"prismarine_shard": 4, "prismarine_crystals": 5}, 1, "crafting"),
    "glowstone": ({"glowstone_dust": 4}, 1, "crafting"),
    "snow_block": ({"snowball": 4}, 1, "crafting"),
    "packed_ice": ({"ice": 9}, 1, "crafting"),
    "hay_block": ({"wheat": 9}, 1, "crafting"),
    "bookshelf": ({"oak_planks": 6, "book": 3}, 1, "crafting"),
}
# copper that has to weather naturally first, then be waxed
for stage in ("exposed", "weathered", "oxidized"):
    R[f"waxed_{stage}_copper"] = ({f"{stage}_copper": 1, "honeycomb": 1}, 1, "crafting")
    R[f"waxed_{stage}_cut_copper"] = ({f"waxed_{stage}_copper": 1}, 4, "stonecutter")
for c in COLORS:
    R[f"{c}_concrete"] = ({"sand": 4, "gravel": 4, f"{c}_dye": 1}, 8, "crafting + water")
    R[f"{c}_terracotta"] = ({"terracotta": 8, f"{c}_dye": 1}, 8, "crafting")
    R[f"{c}_stained_glass"] = ({"glass": 8, f"{c}_dye": 1}, 8, "crafting")
    R[f"{c}_stained_glass_pane"] = ({f"{c}_stained_glass": 6}, 16, "crafting")
    R[f"{c}_wool"] = ({"string": 4}, 1, "crafting") if c == "white" else ({"white_wool": 1, f"{c}_dye": 1}, 1, "crafting")
for w in WOODS + ["crimson", "warped"]:
    log = f"{w}_stem" if w in ("crimson", "warped") else f"{w}_log"
    R[f"{w}_planks"] = ({log: 1}, 4, "crafting")
    wood = f"{w}_hyphae" if w in ("crimson", "warped") else f"{w}_wood"
    R[wood] = ({log: 4}, 3, "crafting")
    R[f"stripped_{wood}"] = ({wood: 1}, 1, "axe")
    R[f"{w}_fence"] = ({f"{w}_planks": 4, "stick": 2}, 3, "crafting")
R["bamboo_fence"] = ({"bamboo_planks": 4, "stick": 2}, 3, "crafting")
R["bamboo_mosaic"] = ({"bamboo_slab": 2}, 1, "crafting")

WOODISH = ("planks", "bamboo")


def _shape_recipes():
    """Stairs, slabs and walls from their family's full block."""
    for m in MATERIALS:
        stone = not any(t in m.full for t in WOODISH) and "wood" not in m.tags
        # shapes new in 26.x (concrete, wool stairs): recipe not verified, so
        # assume the crafting table, which never under-counts
        new_st = m.since[1] == "26"
        new_sl = m.since[2] == "26"
        if m.stairs and m.stairs not in R:
            R[m.stairs] = ({m.full: 1}, 1, "stonecutter") if stone and not new_st else ({m.full: 6}, 4, "crafting")
        if m.slab and m.slab not in R:
            R[m.slab] = ({m.full: 1}, 2, "stonecutter") if stone and not new_sl else ({m.full: 3}, 6, "crafting")
    for c in CONNECTABLES.values():
        if c.kind == "wall" and c.base and c.id not in R:
            R[c.id] = ({c.base: 1}, 1, "stonecutter")


_shape_recipes()


def raw_materials(counts: dict[str, int], max_depth=8):
    """counts: placed block id -> number. Returns (raw {item: qty}, steps
    [(item, qty made, station, inputs)]) with fractional crafts rounded up."""
    need = defaultdict(float)
    for k, v in counts.items():
        need[k.replace("minecraft:", "").split("[")[0]] += v
    raw = defaultdict(int)
    made = defaultdict(int)
    stations = {}
    frontier = dict(need)
    for _ in range(max_depth):
        nxt = defaultdict(float)
        for item, q in frontier.items():
            r = R.get(item)
            if r is None:
                raw[item] += math.ceil(q - 1e-9)
                continue
            ins, out_n, station = r
            batches = math.ceil(q / out_n - 1e-9)
            made[item] += batches * out_n
            stations[item] = (station, ins, out_n)
            for i, n in ins.items():
                nxt[i] += batches * n
        frontier = nxt
        if not frontier:
            break
    for item, q in frontier.items():
        raw[item] += math.ceil(q)
    steps = [(item, made[item], *stations[item]) for item in made]
    return dict(sorted(raw.items(), key=lambda kv: -kv[1])), steps


def stacks(n: int, stack=64) -> str:
    """'3 shulkers + 4 stacks + 12' style counts."""
    sh, rem = divmod(n, stack * 27)
    st, r = divmod(rem, stack)
    parts = []
    if sh:
        parts.append(f"{sh} shulker{'s' if sh > 1 else ''}")
    if st:
        parts.append(f"{st} stack{'s' if st > 1 else ''}")
    if r or not parts:
        parts.append(str(r))
    return " + ".join(parts)


STACK_16 = {"snowball", "ender_pearl", "egg", "honey_bottle", "water_bottle"}
