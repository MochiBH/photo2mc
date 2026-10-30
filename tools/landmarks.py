"""Generate the landmark library: samples/landmarks/<name>.json

Each spec uses documented real dimensions where available (sources in
"notes"); anything estimated is marked as such. Materials are chosen by
matching each surface's real-world reference colour against the measured
block palette, restricted to block families that suit the surface.

    python tools/landmarks.py
"""
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import numpy as np  # noqa: E402
from mcbuild.palette import Palette, srgb_to_lab, BY_NAME, MATERIALS  # noqa: E402

OUT = os.path.join(ROOT, "samples", "landmarks")
P = Palette(target="1.21")          # classic blocks: the library loads on any 1.21+ server
# classic blocks with the stairs/slabs the latest release adds (concrete stairs):
# on 1.21 servers those parts fall back to full blocks automatically
P_LATEST = Palette([m for m in MATERIALS if m.since[0] == "1.21" and not m.tags & {"wool", "detail"}])
PICKED = {}


def pick(label, rgb, tags=("stone",), stairs=True, prefer=None, latest=False):
    """Nearest measured block to a real-world reference colour."""
    if prefer:
        return prefer
    pal = P_LATEST if latest else P
    mask = np.array([bool(m.tags & set(tags)) and (m.stairs is not None or not stairs) for m in pal.materials])
    if not mask.any():
        mask = np.array([bool(m.tags & set(tags)) for m in pal.materials])
    i = int(pal.nearest(srgb_to_lab(np.array([rgb])), mask=mask)[0])
    PICKED[label] = (rgb, pal.materials[i].name)
    return pal.materials[i].name


def spec(name, height, parts, notes, block_size=1.0, camera=(30, 12), **extra):
    return {"name": name, "height_m": height, "recommended_block_size": block_size,
            "camera": {"azimuth_deg": camera[0], "elevation_deg": camera[1]},
            "notes": notes, **extra, "parts": parts}


# ---------------------------------------------------------------------------
def eiffel():
    bronze = pick("Eiffel bronze", (102, 82, 62), tags=("metal", "stone"))
    parts = []
    # tapering square body, half-widths at documented/visible levels
    prof = [(0, 62.5), (25, 48), (57, 35), (90, 25), (115, 19), (160, 13), (220, 8.5), (276, 5.5), (300, 3)]
    for (y0, r0), (y1, r1) in zip(prof, prof[1:]):
        parts.append({"shape": "cylinder", "sides": 4, "radius": r0, "radius_top": r1, "height": y1 - y0,
                      "at": [0, y0, 0], "material": bronze, "label": f"body {y0}-{y1} m"})
    # the great arches between the legs (legs 25 m wide at the ground)
    for ax in ("z", "x"):
        parts.append({"shape": "arch", "width": 75, "height": 52, "depth": 140, "axis": ax, "at": [0, 0, 0],
                      "mode": "carve", "label": "ground arch"})
    # open lattice between 1st and 2nd floors: leave four corner piers
    for y0, h, w in [(62, 14, 40), (76, 14, 32), (90, 12, 24), (102, 9, 18)]:   # tapers with the tower
        for ax in ("z", "x"):
            parts.append({"shape": "box", "size": [w, h, 90] if ax == "z" else [90, h, w], "at": [0, y0, 0],
                          "mode": "carve", "label": "open middle section"})
    # hollow core above the 2nd floor (four columns merging toward the top)
    parts.append({"shape": "cylinder", "sides": 4, "radius": 14, "radius_top": 5, "height": 105,
                  "at": [0, 120, 0], "mode": "carve", "label": "hollow upper core"})
    for y0, h, w in [(122, 50, 12), (172, 50, 8)]:
        for ax in ("z", "x"):
            parts.append({"shape": "box", "size": [w, h, 60] if ax == "z" else [60, h, w], "at": [0, y0, 0],
                          "mode": "carve", "label": "upper lattice gaps"})
    # floors (heights from toureiffel.paris: 57 m, 115 m, 276 m)
    parts += [
        {"shape": "box", "size": [72, 5, 72], "at": [0, 54, 0], "material": bronze, "label": "1st floor"},
        {"shape": "box", "size": [40, 4, 40], "at": [0, 113, 0], "material": bronze, "label": "2nd floor"},
        {"shape": "box", "size": [17, 4, 17], "at": [0, 274, 0], "material": bronze, "label": "top floor"},
        {"shape": "cylinder", "sides": 4, "radius": 2.5, "radius_top": 1, "height": 24, "at": [0, 300, 0],
         "material": bronze, "label": "lighthouse/top"},
        {"shape": "cylinder", "radius": 0.8, "height": 6, "at": [0, 324, 0], "material": "iron_block", "label": "antenna"},
        {"shape": "box", "size": [74, 1.2, 1.4], "at": [0, 52, 36], "material": "iron_bars", "mirror": "z", "label": "1st floor railing"},
        {"shape": "box", "size": [1.4, 1.2, 74], "at": [36, 52, 0], "material": "iron_bars", "mirror": "x", "label": "1st floor railing"},
    ]
    return spec("Eiffel Tower", 330, parts, block_size=1.3, camera=(35, 10),
                notes="Heights 330 m total, floors at 57/115/276 m, 125 m square base, 25 m legs "
                      "(toureiffel.paris key figures). Taper profile between floors estimated from photos. "
                      "Ironwork lattice is represented as open sections with solid piers.")


def big_ben():
    stone = pick("Anston limestone", (196, 172, 128))
    iron = pick("cast-iron spire", (52, 58, 56), tags=("stone", "metal"))
    parts = [
        {"shape": "box", "size": [12, 50, 12], "at": [0, 0, 0], "material": stone, "label": "shaft"},
        {"shape": "box", "size": [13, 1, 13], "at": [0, 49, 0], "material": stone, "label": "cornice"},
        {"shape": "box", "size": [12.6, 11, 12.6], "at": [0, 50, 0], "material": stone, "label": "clock stage"},
        {"shape": "box", "size": [13.4, 1, 13.4], "at": [0, 61, 0], "material": stone, "label": "clock-stage cornice"},
        {"shape": "box", "size": [11.6, 10, 11.6], "at": [0, 62, 0], "material": stone, "label": "belfry"},
        {"shape": "arch", "width": 2.2, "height": 7, "depth": 2, "at": [-2.8, 63, 5.8], "mode": "carve",
         "repeat": {"count": 3, "step": [2.8, 0, 0]}, "mirror": "z", "label": "belfry openings"},
        {"shape": "arch", "width": 2.2, "height": 7, "depth": 2, "axis": "x", "at": [5.8, 63, -2.8], "mode": "carve",
         "repeat": {"count": 3, "step": [0, 0, 2.8]}, "mirror": "x", "label": "belfry openings"},
        {"shape": "box", "size": [12.4, 1.2, 12.4], "at": [0, 72, 0], "material": stone, "label": "belfry parapet"},
        {"shape": "pyramid", "size": [11, 16, 11], "at": [0, 73, 0], "material": iron, "label": "spire roof"},
        {"shape": "cylinder", "sides": 8, "radius": 1.6, "height": 3, "at": [0, 84, 0], "material": "gold_block",
         "label": "Ayrton light lantern"},
        {"shape": "cone", "sides": 8, "radius": 1.4, "height": 8, "at": [0, 87, 0], "material": iron, "label": "finial"},
        {"shape": "cylinder", "radius": 0.5, "height": 2, "at": [0, 94, 0], "material": "gold_block", "label": "cross/finial tip"},
        # clock dials: 6.9 m across, centres 54.9 m above ground (UK Parliament)
        {"shape": "cylinder", "radius": 3.6, "height": 1.6, "tilt": [90, 0], "at": [0, 51.3, 5.5], "material": "gold_block",
         "mode": "paint", "mirror": "z", "label": "gilded dial surround"},
        {"shape": "cylinder", "radius": 3.0, "height": 1.6, "tilt": [90, 0], "at": [0, 51.9, 5.5],
         "material": "white_stained_glass", "mode": "paint", "mirror": "z", "label": "clock dial"},
        {"shape": "cylinder", "radius": 3.6, "height": 1.6, "tilt": [0, -90], "at": [5.5, 54.9, 0], "material": "gold_block",
         "mode": "paint", "mirror": "x", "label": "gilded dial surround"},
        {"shape": "cylinder", "radius": 3.0, "height": 1.6, "tilt": [0, -90], "at": [5.5, 54.9, 0],
         "material": "white_stained_glass", "mode": "paint", "mirror": "x", "label": "clock dial"},
        # tall windows up the shaft
        {"shape": "box", "size": [1.2, 3, 1.4], "at": [-2.5, 8, 6], "material": "gray_stained_glass_pane", "mode": "paint",
         "repeat": {"count": [3, 10], "step": [[2.5, 0, 0], [0, 4, 0]]}, "mirror": "z", "label": "shaft windows"},
        {"shape": "box", "size": [1.4, 3, 1.2], "at": [6, 8, -2.5], "material": "gray_stained_glass_pane", "mode": "paint",
         "repeat": {"count": [3, 10], "step": [[0, 0, 2.5], [0, 4, 0]]}, "mirror": "x", "label": "shaft windows"},
    ]
    return spec("Big Ben (Elizabeth Tower)", 96, parts, block_size=0.5, camera=(25, 8),
                notes="96 m tall, 12 m square, dials 6.9 m across centred 54.9 m up (Wikipedia / UK Parliament). "
                      "Stage heights above the clock estimated from photos.")


def colosseum():
    trav = pick("travertine", (196, 181, 152))
    brick = pick("Roman brick interior", (150, 100, 80))
    A, B = 94.5, 78.0                     # semi-axes: 189 x 156 m
    ring = [[A * math.cos(t), B * math.sin(t)] for t in np.linspace(0, 2 * math.pi, 96, endpoint=False)]
    parts = [{"shape": "extrude", "footprint": ring, "height": 48, "at": [0, 0, 0], "material": trav, "label": "outer wall"}]
    # stepped seating bowl (cavea), terraces rising outward
    for k, (y, f) in enumerate([(0, 0.0), (4, 0.18), (10, 0.36), (18, 0.52), (27, 0.66), (36, 0.8)]):
        a = 43.5 + (A - 6 - 43.5) * f
        b = 27.5 + (B - 6 - 27.5) * f
        parts.append({"shape": "extrude", "height": 60, "at": [0, y, 0], "mode": "carve", "label": f"cavea tier {k}",
                      "footprint": [[a * math.cos(t), b * math.sin(t)] for t in np.linspace(0, 2 * math.pi, 72, endpoint=False)]})
    parts.append({"shape": "extrude", "height": 4, "at": [0, 0, 0], "material": brick, "label": "arena floor substructure",
                  "footprint": [[43.5 * math.cos(t), 27.5 * math.sin(t)] for t in np.linspace(0, 2 * math.pi, 72, endpoint=False)]})
    # 80 arches on each of the three arcade storeys, facing outward
    for (y, h, w) in [(0, 9.5, 4.2), (11.5, 9, 4.0), (22.5, 9, 4.0)]:
        for t in np.linspace(0, 2 * math.pi, 80, endpoint=False):
            x, z = A * math.cos(t), B * math.sin(t)
            n = np.array([math.cos(t) / A, math.sin(t) / B]); n /= np.linalg.norm(n)
            yaw = math.degrees(math.atan2(n[0], n[1]))
            parts.append({"shape": "arch", "width": w, "height": h, "depth": 5, "at": [round(x, 2), y, round(z, 2)],
                          "rotate": round(yaw, 2), "mode": "carve", "label": "arcade arch"})
    # attic storey: small rectangular windows every other bay
    for t in np.linspace(0, 2 * math.pi, 40, endpoint=False):
        x, z = A * math.cos(t), B * math.sin(t)
        n = np.array([math.cos(t) / A, math.sin(t) / B]); n /= np.linalg.norm(n)
        parts.append({"shape": "box", "size": [1.8, 2.4, 3], "at": [round(x, 2), 38, round(z, 2)],
                      "rotate": round(math.degrees(math.atan2(n[0], n[1])), 2), "mode": "carve", "label": "attic window"})
    return spec("Colosseum", 48, parts, block_size=1.0, camera=(20, 25),
                notes="Ellipse 189 x 156 m, 48 m tall, arena 87 x 55 m, 80 arches per storey (standard figures). "
                      "Built complete, as designed; the real south side has lost its outer ring. Tier heights estimated.")


def st_basils():
    brick = pick("red brick", (150, 52, 40))
    white = pick("white stone trim", (225, 220, 205))
    green = pick("green dome", (40, 110, 70), tags=("color", "metal"), latest=True)
    red = pick("red dome", (165, 40, 38), tags=("color", "stone"), latest=True)
    gold = "gold_block"
    blue = pick("blue dome", (55, 90, 150), tags=("color",), latest=True)
    yellow = pick("yellow dome", (210, 170, 50), tags=("color",), latest=True)

    def onion(cx, cz, base_y, r, mat, h=None):
        h = h or r * 2.6
        prof = [[r * 0.9, base_y], [r * 1.18, base_y + h * 0.18], [r * 1.25, base_y + h * 0.33],
                [r * 1.1, base_y + h * 0.5], [r * 0.7, base_y + h * 0.68], [r * 0.3, base_y + h * 0.85], [0.15, base_y + h]]
        return [{"shape": "revolve", "profile": prof, "at": [cx, 0, cz], "material": mat, "label": "onion dome"},
                {"shape": "cylinder", "radius": 0.35, "height": 2.5, "at": [cx, base_y + h, cz], "material": gold,
                 "label": "cross"}]

    parts = [{"shape": "box", "size": [42, 5, 42], "at": [0, 0, 0], "material": white, "label": "white stone gallery base"},
             {"shape": "box", "size": [38, 3, 38], "at": [0, 5, 0], "material": brick, "label": "upper gallery"}]
    # central tent church: 47.5 m overall (Wikipedia); offset slightly west
    cx = -1.5
    parts += [{"shape": "cylinder", "sides": 8, "radius": 6.5, "height": 22, "at": [cx, 5, 0], "material": brick, "label": "central drum"},
              {"shape": "cylinder", "sides": 8, "radius": 7.2, "height": 1.5, "at": [cx, 27, 0], "material": white, "label": "kokoshnik band"},
              {"shape": "cone", "sides": 8, "radius": 6.0, "height": 13.5, "at": [cx, 28.5, 0], "material": brick, "label": "tent roof"},
              {"shape": "cylinder", "sides": 8, "radius": 1.6, "height": 1.5, "at": [cx, 40, 0], "material": white, "label": "lantern"}]
    parts += onion(cx, 0, 41.2, 1.3, gold, h=3.6)
    # four large octagonal churches on the compass points, four small ones on diagonals
    big = [(cx, -14, green), (cx, 14, red), (cx - 14, 0, yellow), (cx + 14, 0, blue)]
    for (x, z, mat) in big:
        parts += [{"shape": "cylinder", "sides": 8, "radius": 4.4, "height": 17, "at": [x, 5, z], "material": brick, "label": "axial church"},
                  {"shape": "cylinder", "sides": 8, "radius": 3.0, "height": 4, "at": [x, 22, z], "material": brick, "label": "drum"}]
        parts += onion(x, z, 26, 3.0, mat)
    for (x, z, mat) in [(cx - 10, -10, red), (cx + 10, -10, green), (cx - 10, 10, blue), (cx + 10, 10, yellow)]:
        parts += [{"shape": "box", "size": [6, 12, 6], "at": [x, 5, z], "material": brick, "label": "diagonal church"},
                  {"shape": "cylinder", "sides": 8, "radius": 2.0, "height": 3, "at": [x, 17, z], "material": brick, "label": "drum"}]
        parts += onion(x, z, 20, 2.0, mat)
    # bell tower on the south-east with its own tent roof
    parts += [{"shape": "box", "size": [6, 22, 6], "at": [cx + 19, 0, 17], "material": brick, "label": "bell tower"},
              {"shape": "cone", "sides": 8, "radius": 3.4, "height": 9, "at": [cx + 19, 22, 17], "material": green, "label": "bell tower tent"}]
    parts += onion(cx + 19, 17, 31, 0.9, gold, h=2.4)
    return spec("Saint Basil's Cathedral", 47.5, parts, block_size=0.5, camera=(20, 10),
                notes="47.5 m overall; central tent church with four octagonal churches on the compass points and four "
                      "smaller cuboid ones on the diagonals, red brick on a white stone base (Wikipedia). Dome colours vary "
                      "per dome in reality; heights of side churches estimated.")


def parthenon():
    marble = pick("Pentelic marble, weathered", (218, 208, 188))
    W, L = 30.9, 69.5                    # stylobate
    parts = [{"shape": "box", "size": [W + 4, 0.55, L + 4], "at": [0, 0, 0], "material": marble, "label": "step 1"},
             {"shape": "box", "size": [W + 2, 0.55, L + 2], "at": [0, 0.55, 0], "material": marble, "label": "step 2"},
             {"shape": "box", "size": [W, 0.55, L], "at": [0, 1.1, 0], "material": marble, "label": "stylobate"}]
    y0 = 1.65
    # 8 x 17 Doric columns, 10.43 m tall, ~1.9 m diameter
    xs = np.linspace(-W / 2 + 1.0, W / 2 - 1.0, 8)
    zs = np.linspace(-L / 2 + 1.0, L / 2 - 1.0, 17)
    cols = [(x, zs[0]) for x in xs] + [(x, zs[-1]) for x in xs] + \
           [(xs[0], z) for z in zs[1:-1]] + [(xs[-1], z) for z in zs[1:-1]]
    for x, z in cols:
        parts.append({"shape": "cylinder", "radius": 0.95, "radius_top": 0.75, "height": 10.43, "sides": 16,
                      "at": [round(float(x), 2), y0, round(float(z), 2)], "material": marble, "label": "Doric column"})
    yt = y0 + 10.43
    parts += [{"shape": "box", "size": [W, 3.29, L], "at": [0, yt, 0], "material": marble, "label": "entablature"},
              {"shape": "box", "size": [W - 5, 3.4, L - 5], "at": [0, yt - 0.1, 0], "mode": "carve", "label": "open roof (lost)"},
              {"shape": "gable_roof", "size": [W, 4.2, 2.2], "ridge": "z", "at": [0, yt + 3.29, L / 2 - 1.1],
               "material": marble, "mirror": "z", "label": "pediment"},
              {"shape": "box", "size": [19, 4, 49], "at": [0, y0, 0], "material": marble, "label": "ruined cella walls"},
              {"shape": "box", "size": [17, 5, 47], "at": [0, y0 + 0.6, 0], "mode": "carve", "label": "cella interior"}]
    return spec("Parthenon", 19.5, parts, block_size=0.5, camera=(30, 12),
                notes="Stylobate 69.5 x 30.9 m, 8 x 17 Doric columns 10.43 m tall, entablature 3.29 m (13.72 m above the "
                      "stylobate). Shown as it stands: roof gone, cella reduced to low walls.")


def empire_state():
    lime = pick("Indiana limestone", (204, 190, 160))
    dark = pick("aluminium spandrels / windows", (70, 72, 74), tags=("stone", "metal"))
    tiers = [  # (y0, y1, x_width, z_depth): podium documented; tiers above estimated from setbacks
        (0, 25, 129, 57), (25, 85, 105, 47), (85, 103, 85, 45), (103, 122, 70, 43),
        (122, 293, 60, 41), (293, 328, 48, 34), (328, 350, 38, 28), (350, 381, 30, 24)]
    parts = []
    for y0, y1, w, d in tiers:
        parts.append({"shape": "box", "size": [w, y1 - y0, d], "at": [0, y0, 0], "material": lime, "label": f"tier to {y1} m"})
    # vertical window/spandrel bands on the main shaft (the building's signature stripes)
    parts += [{"shape": "box", "size": [1.5, 166, 1.4], "at": [-24.75, 125, 20.5], "material": dark, "mode": "paint",
               "repeat": {"count": 12, "step": [4.5, 0, 0]}, "mirror": "z", "label": "window bands"},
              {"shape": "box", "size": [1.4, 166, 1.5], "at": [30, 125, -15.75], "material": dark, "mode": "paint",
               "repeat": {"count": 8, "step": [0, 0, 4.5]}, "mirror": "x", "label": "window bands"}]
    # mast: four rectangular tiers, cylinder, conical pinnacle (Wikipedia), then antenna to 443.2 m
    parts += [{"shape": "box", "size": [18, 10, 18], "at": [0, 381, 0], "material": lime, "label": "mast tier 1"},
              {"shape": "box", "size": [14, 10, 14], "at": [0, 391, 0], "material": lime, "label": "mast tier 2"},
              {"shape": "box", "size": [10, 8, 10], "at": [0, 401, 0], "material": "iron_block", "label": "mast tier 3"},
              {"shape": "cylinder", "radius": 3.5, "height": 8, "at": [0, 409, 0], "material": "iron_block", "label": "mast cylinder"},
              {"shape": "cone", "radius": 3, "height": 6, "at": [0, 417, 0], "material": "iron_block", "label": "pinnacle"},
              {"shape": "cylinder", "radius": 0.8, "height": 20, "at": [0, 423, 0], "material": "iron_block", "label": "antenna"}]
    return spec("Empire State Building", 443.2, parts, block_size=1.75, camera=(30, 8),
                notes="Roof 381 m, tip 443.2 m, 5-storey podium covering the 129 x 57 m lot, setbacks above the 5th, 21st, "
                      "25th, 30th, 72nd, 81st and 85th storeys, 4-tier mast (Wikipedia). Widths of the upper tiers "
                      "are estimates from photos.")


def arc_de_triomphe():
    stone = pick("Château-Landon limestone", (226, 216, 196))
    W, D, H = 45, 22, 50
    parts = [{"shape": "box", "size": [W, H - 6, D], "at": [0, 0, 0], "material": stone, "label": "main mass"},
             {"shape": "box", "size": [W + 1, 1.5, D + 1], "at": [0, 37, 0], "material": stone, "label": "frieze cornice"},
             {"shape": "box", "size": [W, 6, D], "at": [0, H - 6, 0], "material": stone, "label": "attic"},
             {"shape": "box", "size": [W + 1.2, 1, D + 1.2], "at": [0, H - 1, 0], "material": stone, "label": "top cornice"},
             # main arch 29.19 m high x 14.62 m wide; side arches 18.68 x 8.44 m
             {"shape": "arch", "width": 14.62, "height": 29.19, "depth": D + 2, "at": [0, 0, 0], "mode": "carve", "label": "great arch"},
             {"shape": "arch", "width": 8.44, "height": 18.68, "depth": W + 2, "axis": "x", "at": [0, 0, 0], "mode": "carve",
              "label": "side arch"},
             {"shape": "box", "size": [5, 9, 1.4], "at": [-15.5, 6, D / 2], "material": "chiseled_sandstone", "mode": "paint",
              "mirror": "xz", "label": "sculpture groups"}]
    return spec("Arc de Triomphe", 50, parts, block_size=0.5, camera=(30, 10),
                notes="50 m tall, 45 m wide, 22 m deep; main arch 29.19 x 14.62 m; transverse arches 18.68 x 8.44 m.")


def pisa():
    marble = pick("white marble", (232, 228, 216))
    R, core = 7.74, 6.2                  # 15.48 m base diameter
    parts = [{"shape": "cylinder", "radius": R, "height": 11.3, "sides": 48, "at": [0, 0, 0], "material": marble, "label": "ground storey"}]
    for k in range(15):                  # blind arcade on the ground storey
        t = 2 * math.pi * k / 15
        parts.append({"shape": "arch", "width": 2.4, "height": 8, "depth": 1.2,
                      "at": [round(R * math.sin(t), 2), 1.5, round(R * math.cos(t), 2)],
                      "rotate": round(math.degrees(t), 2), "mode": "carve", "label": "blind arch"})
    y = 11.3
    for s in range(6):                   # six open loggia storeys
        h = 6.6
        parts += [{"shape": "cylinder", "radius": R + 0.35, "height": 0.6, "sides": 48, "at": [0, y, 0], "material": marble, "label": "cornice"},
                  {"shape": "cylinder", "radius": core, "height": h, "sides": 48, "at": [0, y, 0], "material": marble, "label": "core wall"}]
        for k in range(30):              # 30 columns per gallery
            t = 2 * math.pi * k / 30
            parts.append({"shape": "cylinder", "radius": 0.32, "height": h - 1.0, "sides": 8,
                          "at": [round((R - 0.4) * math.sin(t), 2), y + 0.6, round((R - 0.4) * math.cos(t), 2)],
                          "material": marble, "label": "gallery column"})
        parts.append({"shape": "cylinder", "radius": R, "height": 0.8, "sides": 48, "at": [0, y + h - 0.8, 0],
                      "material": marble, "label": "arcade lintel"})
        y += h
    parts += [{"shape": "cylinder", "radius": R + 0.35, "height": 0.6, "sides": 48, "at": [0, y, 0], "material": marble, "label": "cornice"},
              {"shape": "box", "size": [16, 1.1, 0.12], "at": [0, y + 0.6, 0], "material": "iron_bars", "label": "_skip"}]
    parts = [p for p in parts if p.get("label") != "_skip"]
    parts += [{"shape": "cylinder", "radius": 4.8, "height": 6.8, "sides": 36, "at": [0, y + 0.6, 0], "material": marble, "label": "belfry"},
              {"shape": "cylinder", "radius": 5.0, "height": 0.5, "sides": 36, "at": [0, y + 7.4, 0], "material": marble, "label": "belfry cornice"}]
    for k in range(6):
        t = 2 * math.pi * k / 6
        parts.append({"shape": "arch", "width": 1.8, "height": 4.5, "depth": 1.4,
                      "at": [round(4.8 * math.sin(t), 2), y + 1.4, round(4.8 * math.cos(t), 2)],
                      "rotate": round(math.degrees(t), 2), "mode": "carve", "label": "bell opening"})
    return spec("Leaning Tower of Pisa", 56.67, parts, block_size=0.5, camera=(15, 10), tilt=[3.97, 0],
                notes="56.67 m on the high side, 15.48 m base diameter, leaning 3.97 degrees to the south; eight storeys: "
                      "ground storey, six open galleries, belfry. Storey heights estimated from the total.")


def space_needle():
    white = pick("Astronaut White legs", (236, 236, 232), tags=("stone", "color"), latest=True)
    olive = pick("Orbital Olive core", (120, 118, 88), tags=("stone", "color"))
    red = pick("Re-entry Red saucer", (180, 60, 40), tags=("stone", "color"), latest=True)
    gold = pick("Galaxy Gold roof", (214, 140, 50), tags=("stone", "color", "metal"), latest=True)
    parts = [{"shape": "cylinder", "radius": 3.2, "height": 158, "sides": 16, "at": [0, 0, 0], "material": olive, "label": "elevator core"}]
    waist_y, waist_r, base_r, top_r = 113, 3.6, 16, 12      # waist height/radius estimated
    for k in range(3):                    # three leg pairs
        for off in (-7, 7):
            t = math.radians(120 * k + off)
            b = [base_r * math.cos(t), 0, base_r * math.sin(t)]
            w = [waist_r * math.cos(t), waist_y, waist_r * math.sin(t)]
            tp = [top_r * math.cos(t), 148, top_r * math.sin(t)]
            parts += [{"shape": "beam", "from": [round(v, 2) for v in b], "to": [round(v, 2) for v in w], "radius": 0.9,
                       "material": white, "label": "lower leg"},
                      {"shape": "beam", "from": [round(v, 2) for v in w], "to": [round(v, 2) for v in tp], "radius": 0.8,
                       "material": white, "label": "upper leg"}]
    parts += [{"shape": "cylinder", "radius": 9, "height": 1.2, "at": [0, 30, 0], "material": white, "label": "SkyLine level (30 m)"},
              {"shape": "revolve", "at": [0, 0, 0], "material": red, "label": "saucer (top house)",
               "profile": [[12, 147], [17, 150], [21, 153.5], [21, 156], [17, 158]]},
              {"shape": "revolve", "at": [0, 0, 0], "material": gold, "label": "Galaxy Gold roof",
               "profile": [[17, 158], [13, 161], [7, 164], [3, 167]]},
              {"shape": "box", "size": [42.5, 1.3, 0.12], "at": [0, 156, 0], "material": "glass_pane", "label": "_skip"},
              {"shape": "cylinder", "radius": 1.2, "radius_top": 0.3, "height": 17.4, "at": [0, 167, 0], "material": "iron_block", "label": "spire"}]
    parts = [p for p in parts if p.get("label") != "_skip"]
    parts.append({"shape": "cylinder", "radius": 21.6, "height": 2.2, "at": [0, 153.6, 0], "material": "glass", "mode": "paint",
                  "label": "observation glass band"})
    return spec("Space Needle", 184.4, parts, block_size=1.0, camera=(25, 6),
                notes="184.4 m to the spire tip, top floor 158 m, observation deck ~160 m, restaurant ~150 m, SkyLine level 30 m, "
                      "42 m wide, 37 m concrete base, three leg pairs; colours Astronaut White / Orbital Olive / Re-entry Red "
                      "/ Galaxy Gold (Wikipedia). Waist height and radius estimated from photos.")


def great_pyramid():
    lime = pick("weathered limestone", (205, 185, 140))
    return spec("Great Pyramid of Giza", 138.5, [
        {"shape": "pyramid", "size": [230.3, 138.5, 230.3], "at": [0, 0, 0], "material": lime, "label": "pyramid (current height)"},
        {"shape": "box", "size": [3, 4, 3], "at": [0, 136.5, 0], "mode": "carve", "label": "missing capstone"},
        {"shape": "box", "size": [2.1, 1.1, 3], "at": [0, 16.8, 115.2], "mode": "carve", "rotate": 0, "label": "original entrance"}],
        block_size=1.0, camera=(35, 12),
        notes="230.3 m base, 138.5 m current height (146.6 m originally), faces at 51.84 degrees.")


def taj():
    return json.load(open(os.path.join(ROOT, "samples", "taj_mahal.json")))


BUILDERS = {"eiffel_tower": eiffel, "big_ben": big_ben, "colosseum": colosseum, "st_basils_cathedral": st_basils,
            "parthenon": parthenon, "empire_state_building": empire_state, "arc_de_triomphe": arc_de_triomphe,
            "leaning_tower_of_pisa": pisa, "space_needle": space_needle, "great_pyramid": great_pyramid, "taj_mahal": taj}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    for key, fn in BUILDERS.items():
        if only and key not in only:
            continue
        sp = fn()
        if key == "taj_mahal":
            sp.setdefault("recommended_block_size", 1.0)
            sp.setdefault("camera", {"azimuth_deg": 20, "elevation_deg": 12})
        with open(os.path.join(OUT, key + ".json"), "w") as f:
            json.dump(sp, f, indent=1)
        print(f"{key:24s} {len(sp['parts']):4d} parts")
    for label, (rgb, name) in PICKED.items():
        print(f"  {label:32s} {rgb} -> {name}")
