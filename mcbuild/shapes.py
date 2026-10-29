"""What Minecraft will actually render for a blockstate, as 2x2x2 sub-cells.

Derived from vanilla stair models (stairs.json / inner_stairs / outer_stairs
and their blockstate rotations), independently of the voxelizer's lookup
table — so the two can be checked against each other.
"""
from __future__ import annotations

QUAD = {"north": {(0, 0), (1, 0)}, "south": {(0, 1), (1, 1)},
        "east": {(1, 0), (1, 1)}, "west": {(0, 0), (0, 1)}}
CW = {"north": "east", "east": "south", "south": "west", "west": "north"}
CCW = {v: k for k, v in CW.items()}


def _bit(dx, dy, dz):
    return 1 << (dy * 4 + dz * 2 + dx)


def stair_mask(facing: str, half: str, shape: str) -> int:
    F = QUAD[facing]
    R, L = QUAD[CW[facing]], QUAD[CCW[facing]]
    part = {"straight": F, "outer_right": F & R, "outer_left": F & L,
            "inner_right": F | R, "inner_left": F | L}[shape]
    base_dy, part_dy = (0, 1) if half == "bottom" else (1, 0)
    m = 0
    for dx in (0, 1):
        for dz in (0, 1):
            m |= _bit(dx, base_dy, dz)
            if (dx, dz) in part:
                m |= _bit(dx, part_dy, dz)
    return m


def state_mask(state: str) -> int:
    """8-bit sub-cell mask for a blockstate string."""
    props = {}
    if "[" in state:
        props = dict(p.split("=") for p in state[state.index("[") + 1:-1].split(","))
    if "facing" in props and "shape" in props:
        return stair_mask(props["facing"], props["half"], props["shape"])
    if props.get("type") == "bottom":
        return 0x0F
    if props.get("type") == "top":
        return 0xF0
    return 0xFF


def mask_boxes(mask: int):
    """Decompose a mask into a few axis-aligned boxes in block units
    (x0, y0, z0, x1, y1, z1)."""
    boxes = []
    for dy in (0, 1):
        cells = {(dx, dz) for dx in (0, 1) for dz in (0, 1) if mask & _bit(dx, dy, dz)}
        y0, y1 = dy * 0.5, dy * 0.5 + 0.5
        if len(cells) == 4:
            boxes.append((0, y0, 0, 1, y1, 1))
            continue
        used = set()
        for side, q in QUAD.items():
            if len(cells) >= 2 and q <= cells and not (q & used):
                xs = [c[0] for c in q]; zs = [c[1] for c in q]
                boxes.append((min(xs) * .5, y0, min(zs) * .5, max(xs) * .5 + .5, y1, max(zs) * .5 + .5))
                used |= q
        for dx, dz in cells - used:
            boxes.append((dx * .5, y0, dz * .5, dx * .5 + .5, y1, dz * .5 + .5))
    return boxes


def _props(state):
    if "[" not in state:
        return {}
    return dict(p.split("=") for p in state[state.index("[") + 1:-1].split(","))


_ARM = {"north": lambda a, b: (a, b, 0, 1 - a, 0, 0.5), "south": lambda a, b: (a, b, 0.5, 1 - a, 0, 1),
        "east": lambda a, b: (0.5, b, a, 1, 0, 1 - a), "west": lambda a, b: (0, b, a, 0.5, 0, 1 - a)}


def _arm(d, half_w, y0, y1):
    """Arm from the block centre toward side d, half_w wide, y0..y1 tall."""
    a = 0.5 - half_w
    x0, _, z0, x1, _, z1 = _ARM[d](a, 0)
    return (x0, y0, z0, x1, y1, z1)


def state_boxes(state: str):
    """Boxes (block units) Minecraft draws for a blockstate — full blocks,
    slabs, stairs, and the thin connecting blocks (panes, bars, fences, walls)."""
    bid = state.split("[")[0]
    p = _props(state)
    if bid.endswith("_pane") or bid.endswith("_bars"):
        boxes = [(7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16)]
        boxes += [_arm(d, 1 / 16, 0, 1) for d in ("north", "south", "east", "west") if p.get(d) == "true"]
        return boxes
    if bid.endswith("_fence"):
        boxes = [(6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16)]
        for d in ("north", "south", "east", "west"):
            if p.get(d) == "true":
                boxes += [_arm(d, 1 / 16, 6 / 16, 9 / 16), _arm(d, 1 / 16, 12 / 16, 15 / 16)]
        return boxes
    if bid.endswith("_wall"):
        boxes = [(4 / 16, 0, 4 / 16, 12 / 16, 1, 12 / 16)] if p.get("up", "true") == "true" else []
        for d in ("north", "south", "east", "west"):
            h = p.get(d, "none")
            if h != "none":
                boxes.append(_arm(d, 3 / 16, 0, 1 if h == "tall" else 14 / 16))
        return boxes or [(4 / 16, 0, 4 / 16, 12 / 16, 1, 12 / 16)]
    return mask_boxes(state_mask(state))
