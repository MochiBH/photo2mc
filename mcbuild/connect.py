"""Thin connecting blocks: glass panes, iron bars, fences, walls.

They are thinner than a block, so the half-block shape table can't produce
them; specs ask for them by material (e.g. "glass_pane", "oak_fence",
"iron_bars", "stone_brick_wall"). Their blockstate depends on the
neighbours, computed here the way the game does when you place them:

  panes, bars  connect to panes, bars, walls and solid full blocks
  fences       connect to fences and solid full blocks
  walls        connect to walls, panes, bars and solid full blocks; the
               centre post shows unless the wall runs straight through;
               a side is "tall" when a block sits above it
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

import numpy as np

_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "palette_data.json")


@dataclass(frozen=True)
class Connectable:
    id: str
    kind: str                 # pane | bars | fence | wall
    rgb: tuple
    base: str | None
    since: str = "1.21"

    # duck-type the bits of Material that make_states / viewers use
    @property
    def name(self):
        return self.id

    @property
    def full(self):
        return self.id

    stairs = None
    slab = None
    tags = frozenset({"thin"})


def _load():
    d = json.load(open(_DATA))
    return {c["id"]: Connectable(c["id"], c["kind"], tuple(c["rgb"]), c.get("base"), c.get("since", "1.21"))
            for c in d.get("connectables", [])}


CONNECTABLES: dict[str, Connectable] = _load()

DIRS = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0)}
LINKS = {"pane": {"pane", "bars", "wall"}, "bars": {"pane", "bars", "wall"},
         "fence": {"fence"}, "wall": {"wall", "pane", "bars"}}


def connection_states(coords, ids, kinds, conn_mask, full_mask):
    """Blockstate strings for every connectable block.

    coords (N,3); ids (N,) block id strings; kinds (N,) connectable kind or
    '' for other blocks; conn_mask (N,) bool; full_mask (N,) bool = solid
    full blocks they may attach to."""
    pos = {tuple(c): i for i, c in enumerate(coords.tolist())}
    out = {}
    for i in np.flatnonzero(conn_mask):
        x, y, z = coords[i]
        k = kinds[i]
        con = {}
        for d, (dx, dy, dz) in DIRS.items():
            j = pos.get((x + dx, y + dy, z + dz))
            con[d] = j is not None and (full_mask[j] or kinds[j] in LINKS[k])
        if k in ("pane", "bars", "fence"):
            props = ",".join(f"{d}={'true' if con[d] else 'false'}" for d in ("east", "north", "south", "west"))
            out[i] = f"minecraft:{ids[i]}[{props},waterlogged=false]"
        else:
            above = pos.get((x, y + 1, z))
            tall = above is not None and (full_mask[above] or kinds[above] == "wall")
            h = "tall" if tall else "low"
            straight = (con["north"] and con["south"] and not con["east"] and not con["west"]) or \
                       (con["east"] and con["west"] and not con["north"] and not con["south"])
            up = "false" if straight else "true"
            sides = {d: (h if con[d] else "none") for d in DIRS}
            out[i] = (f"minecraft:{ids[i]}[east={sides['east']},north={sides['north']},south={sides['south']},"
                      f"up={up},waterlogged=false,west={sides['west']}]")
    return out
