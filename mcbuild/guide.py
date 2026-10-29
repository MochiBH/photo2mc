"""Survival build guide: a self-contained page with a layer-by-layer plan,
the blocks to place and the raw resources to gather."""
from __future__ import annotations

import html
import json
import os

from .recipes import raw_materials

TEMPLATE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "viewer", "guide_template.html")


def _props(s):
    if "[" not in s:
        return {}
    return dict(p.split("=") for p in s[s.index("[") + 1:-1].split(","))


def guide_data(b, title):
    states, sindex = [], {}
    X, Y, Z = b.size
    layers = [[] for _ in range(Y)]
    for (x, y, z), s, rgb in zip(b.coords.tolist(), b.states, b.rgb.tolist()):
        bid = s.split("[")[0].replace("minecraft:", "")
        p = _props(s)
        hexc = "%02x%02x%02x" % tuple(rgb)
        if bid.endswith(("_pane", "_bars", "_fence")):
            con = "".join(d[0] for d in ("north", "south", "east", "west") if p.get(d) == "true")
            key = (bid, hexc, "p", con, "", "")
        elif bid.endswith("_wall"):
            con = "".join(d[0] for d in ("north", "south", "east", "west") if p.get(d, "none") != "none")
            key = (bid, hexc, "w", con, "", "")
        elif "facing" in p and "shape" in p:
            key = (bid, hexc, "st", p["facing"], p["half"], p["shape"])
        elif p.get("type") in ("bottom", "top"):
            key = (bid, hexc, "s", p["type"], "", "")
        else:
            key = (bid, hexc, "f", "", "", "")
        if key not in sindex:
            sindex[key] = len(states)
            states.append(list(key))
        layers[y].append([x, z, sindex[key]])

    counts = b.counts()
    hexes = {}
    for st in states:
        hexes.setdefault(st[0], st[1])
    place = [[k.replace("minecraft:", ""), hexes.get(k.replace("minecraft:", ""), ""), n] for k, n in counts.items()]
    raw, steps = raw_materials(counts)
    steps_out = [[item, made, station, ", ".join(f"{n} {i.replace('_', ' ')}" for i, n in ins.items()) + f" → {out}"]
                 for item, made, station, ins, out in steps]
    return {"name": title, "size": [X, Y, Z], "states": states, "layers": layers,
            "place": place, "raw": [[k, v] for k, v in raw.items()], "steps": steps_out}


def write_guide(b, path, title):
    tpl = open(TEMPLATE).read()
    data = guide_data(b, title)
    page = tpl.replace("/*TITLE*/", html.escape(f"{title} Build Guide")).replace(
        "/*DATA*/null", json.dumps(data, separators=(",", ":")))
    with open(path, "w") as f:
        f.write(page)
    return path
