"""Write a playable Minecraft world: Anvil region files + level.dat (Java Edition, 1.21.1 format).

Newer versions upgrade the world when it is opened. Chunks are saved with isLightOn = 0 and without
heightmaps, so the game computes lighting and heightmaps itself on first load. Outside the
written area the world is void (the "The Void" superflat preset).
"""
from __future__ import annotations

import gzip
import io
import os
import struct
import time
import zlib

import numpy as np

from .export import (DATA_VERSION, Byte, Compound, Double, Float, Int, ListOf, Long, LongArray, String,
                     _named)

Y_MIN, Y_MAX = -64, 320
VERSION_NAME = "1.21.1"


def parse_state(s: str):
    """'minecraft:oak_stairs[facing=east,half=top]' -> NBT palette entry."""
    name, _, props = s.partition("[")
    d = {"Name": String(name if ":" in name else "minecraft:" + name)}
    if props:
        kv = dict(p.split("=", 1) for p in props.rstrip("]").split(","))
        d["Properties"] = Compound({k: String(v) for k, v in sorted(kv.items())})
    return Compound(d)


def _pack(idx: np.ndarray, bits: int) -> np.ndarray:
    per = 64 // bits
    n = -(-len(idx) // per)
    v = np.zeros(n * per, dtype=np.uint64)
    v[: len(idx)] = idx
    v = v.reshape(n, per)
    shifts = (np.arange(per, dtype=np.uint64) * np.uint64(bits))
    return np.bitwise_or.reduce(v << shifts, axis=1).view(np.int64)


class WorldWriter:
    """palette: global list of block state strings; index 0 must be air."""

    def __init__(self, path: str, palette: list[str], biome: str = "minecraft:plains"):
        assert palette[0] in ("minecraft:air", "air")
        self.path = path
        self.palette = palette
        self.entries = [parse_state(s) for s in palette]
        self.biome = biome
        os.makedirs(os.path.join(path, "region"), exist_ok=True)

    def _section(self, sub: np.ndarray, sy: int):
        """sub: (16 x, 16 y, 16 z) global palette indices -> section compound, or None if all air."""
        flat = sub.transpose(1, 2, 0).reshape(-1)          # index = y*256 + z*16 + x
        uniq, inv = np.unique(flat, return_inverse=True)
        if len(uniq) == 1 and uniq[0] == 0:
            return None
        bs = {"palette": ListOf(10, [self.entries[u] for u in uniq])}
        if len(uniq) > 1:
            bits = max(4, int(len(uniq) - 1).bit_length())
            bs["data"] = LongArray(_pack(inv.astype(np.uint64), bits))
        return Compound({"Y": Byte(sy), "block_states": Compound(bs),
                         "biomes": Compound({"palette": ListOf(8, [String(self.biome)])})})

    def chunk_nbt(self, cx: int, cz: int, col: np.ndarray, fluid_ticks=()):
        """col: (16, H, 16) global indices with layer 0 at Y_MIN."""
        secs = []
        for sy in range(col.shape[1] // 16):
            s = self._section(col[:, sy * 16:(sy + 1) * 16, :], Y_MIN // 16 + sy)
            if s is not None:
                secs.append(s)
        root = {
            "DataVersion": Int(DATA_VERSION), "xPos": Int(cx), "zPos": Int(cz), "yPos": Int(Y_MIN // 16),
            "Status": String("minecraft:full"), "LastUpdate": Long(0), "InhabitedTime": Long(0),
            "isLightOn": Byte(0), "sections": ListOf(10, secs), "block_entities": ListOf(10, []),
            "block_ticks": ListOf(10, []), "PostProcessing": ListOf(9, []),
            "fluid_ticks": ListOf(10, [Compound({"i": String("minecraft:water"), "x": Int(x), "y": Int(y),
                                                 "z": Int(z), "t": Int(1), "p": Int(0)})
                                       for x, y, z in fluid_ticks]),
            "structures": Compound({"References": Compound({}), "starts": Compound({})}),
        }
        out = io.BytesIO()
        _named("", Compound(root), out)
        return out.getvalue()

    def write_region(self, rx: int, rz: int, blocks: np.ndarray, fluid_ticks=()):
        """blocks: (512 x, H y, 512 z) uint16 global palette indices, layer 0 = Y_MIN. Chunks that are
        entirely air are left out."""
        H = blocks.shape[1]
        if H % 16:
            blocks = np.concatenate([blocks, np.zeros((512, 16 - H % 16, 512), blocks.dtype)], 1)
        ticks = {}
        for x, y, z in fluid_ticks:
            ticks.setdefault((x // 16, z // 16), []).append((x, y, z))
        header = bytearray(8192)
        body = bytearray()
        now = int(time.time())
        n = 0
        for lz in range(32):
            for lx in range(32):
                col = blocks[lx * 16:(lx + 1) * 16, :, lz * 16:(lz + 1) * 16]
                if not col.any():
                    continue
                cx, cz = rx * 32 + lx, rz * 32 + lz
                data = zlib.compress(self.chunk_nbt(cx, cz, col, ticks.get((cx, cz), ())), 6)
                rec = struct.pack(">IB", len(data) + 1, 2) + data
                rec += b"\0" * (-len(rec) % 4096)
                off = 2 + len(body) // 4096
                i = lx + lz * 32
                header[i * 4:i * 4 + 4] = struct.pack(">I", (off << 8) | (len(rec) // 4096))
                header[4096 + i * 4:4096 + i * 4 + 4] = struct.pack(">I", now)
                body += rec
                n += 1
        if n:
            with open(os.path.join(self.path, "region", f"r.{rx}.{rz}.mca"), "wb") as f:
                f.write(header + body)
        return n

    def write_level(self, name: str, spawn: tuple[int, int, int]):
        void = Compound({"type": String("minecraft:flat"), "settings": Compound({
            "biome": String("minecraft:the_void"), "features": Byte(0), "lakes": Byte(0),
            "layers": ListOf(10, [Compound({"block": String("minecraft:air"), "height": Int(1)})]),
            "structure_overrides": ListOf(8, [])})})
        dims = Compound({
            "minecraft:overworld": Compound({"type": String("minecraft:overworld"), "generator": void}),
            "minecraft:the_nether": Compound({"type": String("minecraft:the_nether"), "generator": Compound({
                "type": String("minecraft:noise"), "settings": String("minecraft:nether"),
                "biome_source": Compound({"type": String("minecraft:multi_noise"),
                                          "preset": String("minecraft:nether")})})}),
            "minecraft:the_end": Compound({"type": String("minecraft:the_end"), "generator": Compound({
                "type": String("minecraft:noise"), "settings": String("minecraft:end"),
                "biome_source": Compound({"type": String("minecraft:the_end")})})}),
        })
        data = Compound({
            "DataVersion": Int(DATA_VERSION), "version": Int(19133), "LevelName": String(name),
            "GameType": Int(1), "Difficulty": Byte(0), "DifficultyLocked": Byte(0), "hardcore": Byte(0),
            "allowCommands": Byte(1), "initialized": Byte(1), "WasModded": Byte(0),
            "SpawnX": Int(spawn[0]), "SpawnY": Int(spawn[1]), "SpawnZ": Int(spawn[2]), "SpawnAngle": Float(0.0),
            "Time": Long(6000), "DayTime": Long(6000), "LastPlayed": Long(int(time.time() * 1000)),
            "raining": Byte(0), "rainTime": Int(10 ** 6), "thundering": Byte(0), "thunderTime": Int(10 ** 6),
            "clearWeatherTime": Int(10 ** 6), "BorderCenterX": Double(0.0), "BorderCenterZ": Double(0.0),
            "BorderSize": Double(5.9999968e7),
            "GameRules": Compound({"doDaylightCycle": String("false"), "doWeatherCycle": String("false"),
                                   "doMobSpawning": String("false"), "doFireTick": String("false"),
                                   "randomTickSpeed": String("0")}),
            "WorldGenSettings": Compound({"seed": Long(0), "generate_features": Byte(0), "bonus_chest": Byte(0),
                                          "dimensions": dims}),
            "DataPacks": Compound({"Enabled": ListOf(8, [String("vanilla")]), "Disabled": ListOf(8, [])}),
            "Version": Compound({"Id": Int(DATA_VERSION), "Name": String(VERSION_NAME),
                                 "Series": String("main"), "Snapshot": Byte(0)}),
            "ServerBrands": ListOf(8, [String("vanilla")]),
        })
        out = io.BytesIO()
        _named("", Compound({"Data": data}), out)
        with gzip.open(os.path.join(self.path, "level.dat"), "wb") as f:
            f.write(out.getvalue())


def read_chunk(path: str, cx: int, cz: int):
    """Read one chunk back with nbtlib (independent parser) — for tests."""
    import nbtlib
    with open(path, "rb") as f:
        raw = f.read()
    i = (cx & 31) + (cz & 31) * 32
    loc = struct.unpack(">I", raw[i * 4:i * 4 + 4])[0]
    if not loc:
        return None
    off = (loc >> 8) * 4096
    ln, comp = struct.unpack(">IB", raw[off:off + 5])
    data = zlib.decompress(raw[off + 5:off + 4 + ln])
    return nbtlib.File.parse(io.BytesIO(data))


def unpack_section(sec) -> np.ndarray:
    """Section compound (nbtlib) -> (16 y, 16 z, 16 x) local palette indices."""
    bs = sec["block_states"]
    n = len(bs["palette"])
    if n == 1:
        return np.zeros((16, 16, 16), int)
    bits = max(4, (n - 1).bit_length())
    per = 64 // bits
    longs = np.array([int(v) for v in bs["data"]], dtype=np.int64).view(np.uint64)
    vals = ((longs[:, None] >> (np.arange(per, dtype=np.uint64) * np.uint64(bits))) & np.uint64((1 << bits) - 1))
    return vals.reshape(-1)[:4096].astype(int).reshape(16, 16, 16)


def read_area(world: str, x0: int, z0: int, x1: int, z1: int, y0: int = Y_MIN, y1: int = Y_MAX):
    """Read blocks back from saved region files (via nbtlib) -> (array (z, x, y) of indices, state list)."""
    states, index = ["minecraft:air"], {"minecraft:air": 0}
    out = np.zeros((z1 - z0, x1 - x0, y1 - y0), np.uint16)
    for cz in range(z0 // 16, (z1 - 1) // 16 + 1):
        for cx in range(x0 // 16, (x1 - 1) // 16 + 1):
            p = os.path.join(world, "region", f"r.{cx >> 5}.{cz >> 5}.mca")
            if not os.path.exists(p):
                continue
            c = read_chunk(p, cx, cz)
            if c is None:
                continue
            for sec in c["sections"]:
                sy = int(sec["Y"]) * 16
                if sy + 16 <= y0 or sy >= y1 or "block_states" not in sec:
                    continue
                pal = []
                for e in sec["block_states"]["palette"]:
                    s = str(e["Name"])
                    if "Properties" in e:
                        s += "[" + ",".join(f"{k}={v}" for k, v in sorted(e["Properties"].items())) + "]"
                    if s not in index:
                        index[s] = len(states)
                        states.append(s)
                    pal.append(index[s])
                loc = np.array(pal, np.uint16)[unpack_section(sec)]            # (y, z, x)
                gx0, gz0 = cx * 16, cz * 16
                xs, zs = max(x0, gx0), max(z0, gz0)
                xe, ze = min(x1, gx0 + 16), min(z1, gz0 + 16)
                ys, ye = max(y0, sy), min(y1, sy + 16)
                blk = loc[ys - sy:ye - sy, zs - gz0:ze - gz0, xs - gx0:xe - gx0].transpose(1, 2, 0)
                out[zs - z0:ze - z0, xs - x0:xe - x0, ys - y0:ye - y0] = blk
    return out, states
