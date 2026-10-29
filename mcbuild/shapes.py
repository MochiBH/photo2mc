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
