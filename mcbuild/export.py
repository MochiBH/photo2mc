"""Export a Build to Minecraft formats.

- .schem   Sponge Schematic v2 (WorldEdit //schem load, FAWE, Litematica, Amulet)
- datapack vanilla: /function photo2mc:build  places it at your feet
- .json    compact block list for the web preview
"""
from __future__ import annotations

import gzip
import io
import json
import struct
import zipfile
import numpy as np

from .voxelize import Build, FULL

DATA_VERSION = 3955  # 1.21.1; newer versions upgrade it automatically on load


# --------------------------------------------------------------------------
# minimal NBT writer (big-endian, no dependencies)
# --------------------------------------------------------------------------
class _Tag:
    def __init__(self, tid, val):
        self.tid, self.val = tid, val


def Int(v): return _Tag(3, v)
def Short(v): return _Tag(2, v)
def ByteArray(v): return _Tag(7, bytes(v))
def IntArray(v): return _Tag(11, list(v))
def Compound(d): return _Tag(10, d)
def String(v): return _Tag(8, v)
def ListOf(tid, items): return _Tag(9, (tid, items))


def _payload(t: _Tag, out: io.BytesIO):
    if t.tid == 2:
        out.write(struct.pack(">h", t.val))
    elif t.tid == 3:
        out.write(struct.pack(">i", t.val))
    elif t.tid == 7:
        out.write(struct.pack(">i", len(t.val))); out.write(t.val)
    elif t.tid == 8:
        b = t.val.encode("utf-8"); out.write(struct.pack(">H", len(b))); out.write(b)
    elif t.tid == 9:
        tid, items = t.val
        out.write(struct.pack(">bi", tid, len(items)))
        for it in items:
            _payload(it, out)
    elif t.tid == 10:
        for k, v in t.val.items():
            _named(k, v, out)
        out.write(b"\x00")
    elif t.tid == 11:
        out.write(struct.pack(">i", len(t.val)))
        out.write(struct.pack(f">{len(t.val)}i", *t.val))
    else:
        raise TypeError(t.tid)


def _named(name: str, t: _Tag, out: io.BytesIO):
    b = name.encode("utf-8")
    out.write(struct.pack(">bH", t.tid, len(b))); out.write(b)
    _payload(t, out)


def _varints(values) -> bytes:
    out = bytearray()
    for v in values:
        v = int(v)
        while v & ~0x7F:
            out.append((v & 0x7F) | 0x80)
            v >>= 7
        out.append(v)
    return bytes(out)


# --------------------------------------------------------------------------
def write_schem(b: Build, path: str):
    X, Y, Z = b.size
    palette = {"minecraft:air": 0}
    grid = np.zeros((Y, Z, X), dtype=np.int64)  # Sponge order: x + z*W + y*W*L
    for (x, y, z), s in zip(b.coords, b.states):
        grid[y, z, x] = palette.setdefault(s, len(palette))
    root = Compound({
        "Version": Int(2),
        "DataVersion": Int(DATA_VERSION),
        "Width": Short(X), "Height": Short(Y), "Length": Short(Z),
        "Offset": IntArray([0, 0, 0]),
        "PaletteMax": Int(len(palette)),
        "Palette": Compound({k: Int(v) for k, v in palette.items()}),
        "BlockData": ByteArray(_varints(grid.ravel())),
        "BlockEntities": ListOf(10, []),
        "Metadata": Compound({"Generator": String("photo2mc")}),
    })
    buf = io.BytesIO()
    _named("Schematic", root, buf)
    with gzip.open(path, "wb") as f:
        f.write(buf.getvalue())


def _commands(b: Build):
    """setblock/fill commands, merging runs of identical full blocks along X."""
    order = np.lexsort((b.coords[:, 0], b.coords[:, 2], b.coords[:, 1]))
    cmds = []
    i = 0
    n = len(order)
    while i < n:
        a = order[i]
        x, y, z = b.coords[a]
        s = b.states[a]
        j = i + 1
        if b.kinds[a] == FULL:
            while j < n:
                c = order[j]
                cx, cy, cz = b.coords[c]
                if cy == y and cz == z and cx == x + (j - i) and b.states[c] == s:
                    j += 1
                else:
                    break
        x2 = x + (j - i) - 1
        s_cmd = s.replace(",waterlogged=false", "")
        if x2 > x:
            cmds.append(f"fill ~{x} ~{y} ~{z} ~{x2} ~{y} ~{z} {s_cmd}")
        else:
            cmds.append(f"setblock ~{x} ~{y} ~{z} {s_cmd}")
        i = j
    return cmds


def write_datapack(b: Build, path: str, name: str = "build", chunk: int = 20000):
    """Vanilla datapack. In game: /function photo2mc:<name>
    (stand where you want the build's north-west-bottom corner)."""
    cmds = _commands(b)
    parts = [cmds[i:i + chunk] for i in range(0, len(cmds), chunk)] or [[]]
    mcmeta = {"pack": {
        "description": f"photo2mc build: {name}",
        "pack_format": 48,
        "supported_formats": {"min_inclusive": 48, "max_inclusive": 999},
        "min_format": 48, "max_format": 999,
    }}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("pack.mcmeta", json.dumps(mcmeta, indent=2))
        main = []
        for k, part in enumerate(parts):
            for folder in ("function", "functions"):  # 1.21+ and older names
                zf.writestr(f"data/photo2mc/{folder}/{name}_part{k}.mcfunction", "\n".join(part))
            main.append(f"function photo2mc:{name}_part{k}")
        for folder in ("function", "functions"):
            zf.writestr(f"data/photo2mc/{folder}/{name}.mcfunction", "\n".join(main))
    return len(cmds)


def write_preview_json(b: Build, path: str | None = None) -> dict:
    """Compact block list for the 3D viewer: kinds + stair orientation."""
    blocks = []
    for (x, y, z), k, s, c in zip(b.coords.tolist(), b.kinds.tolist(), b.states, b.rgb.tolist()):
        props = {}
        if "[" in s:
            props = dict(p.split("=") for p in s[s.index("[") + 1:-1].split(","))
        blocks.append([x, y, z, int(k),
                       "%02x%02x%02x" % tuple(c),
                       props.get("facing", props.get("type", "")),
                       props.get("half", ""), props.get("shape", ""),
                       s.split("[")[0].replace("minecraft:", "")])
    data = {"size": list(b.size), "blocks": blocks}
    if path:
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
    return data
