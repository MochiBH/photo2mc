"""Hand-written hero specs for the SMU site build (Dallas Hall, ...).

Dimensions come from the 2018 USGS lidar of each footprint (tools: photo2mc site data) and the details
from photos on Wikimedia Commons. Coordinates follow the spec convention: x east, z south (the front
faces south), origin at the centre of the footprint's bounding box, y = 0 at the building's floor.
Run:  python samples/smu/make_heroes.py   -> samples/smu/*.json
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

HERE = os.path.dirname(os.path.abspath(__file__))
BRICK, WHITE, BASE, SLATE, COPPER = "bricks", "smooth_quartz", "calcite", "deepslate_tiles", "waxed_oxidized_cut_copper"
GLASS, DOOR, ORN = "gray_stained_glass_pane", "dark_oak_planks", "chiseled_quartz_block"


def part(P, shape, at, material=None, label="", **kw):
    p = {"shape": shape, "at": [round(v, 3) for v in at], "label": label, **kw}
    if material:
        p["material"] = material
    P.append(p)


def windows(P, xs, face_z, sign, rows, w=1.3):
    """Framed windows on a wall facing +z (sign 1) or -z (sign -1) at z = face_z."""
    for y0, h in rows:
        for x in xs:
            part(P, "box", [x, y0 - 0.35, face_z], WHITE, "window frame", mode="paint", size=[w + 0.65, h + 0.7, 1.3])
            part(P, "box", [x, y0, face_z], GLASS, "window", mode="paint", size=[w, h, 1.3])


def dallas_hall():
    P = []
    # main E-W wing: limestone basement, three brick storeys, white cornice, slate hip roof
    zc, d = 2.75, 18.0                      # wing centre (z) and depth
    part(P, "box", [0, 0, zc], BASE, "wing basement", size=[72, 3.6, d])
    part(P, "box", [0, 3.6, zc], BRICK, "wing", size=[72, 10.6, d])
    part(P, "box", [0, 3.3, zc], WHITE, "basement string course", size=[72.4, 0.35, d + 0.4])
    part(P, "box", [0, 14.2, zc], WHITE, "wing cornice", size=[72.8, 0.8, d + 0.8])
    part(P, "hip_roof", [0, 15.0, zc], SLATE, "wing slate roof", size=[72.4, 3.3, d + 0.4])
    # rear (north) wing
    part(P, "box", [0, 0, -12.2], BASE, "rear wing basement", size=[17, 3.6, 12])
    part(P, "box", [0, 3.6, -12.2], BRICK, "rear wing", size=[17, 10.6, 12])
    part(P, "box", [0, 14.2, -12.2], WHITE, "rear wing cornice", size=[17.8, 0.8, 12.8])
    part(P, "hip_roof", [0, 15.0, -12.2], SLATE, "rear wing roof", size=[17.4, 3.0, 12.4])
    # central block under the rotunda: attic with a white parapet
    part(P, "box", [0, 0, 1.0], BASE, "central basement", size=[25, 3.6, 22])
    part(P, "box", [0, 3.6, 1.0], BRICK, "central block", size=[25, 14.9, 22])
    part(P, "box", [0, 14.2, 1.0], WHITE, "central cornice", size=[25.8, 0.8, 22.8])
    for (sx, sz, x, z) in ((25.4, 0.5, 0, 12.0), (25.4, 0.5, 0, -10.0), (0.5, 22.4, 12.5, 1.0), (0.5, 22.4, -12.5, 1.0)):
        part(P, "box", [x, 18.5, z], WHITE, "attic balustrade", size=[sx, 0.9, sz])
    # rotunda: brick drum, white cornice, stepped base, copper dome and lantern
    part(P, "cylinder", [0, 18.5, 1.0], BRICK, "drum", radius=11.5, height=4.0)
    part(P, "cylinder", [0, 21.9, 1.0], WHITE, "drum cornice", radius=12.0, height=0.7)
    part(P, "cylinder", [0, 22.6, 1.0], BRICK, "dome step", radius=10.9, height=0.5)
    part(P, "dome", [0, 23.1, 1.0], COPPER, "copper dome", radius=10.4, height=5.0)
    part(P, "cylinder", [0, 27.8, 1.0], WHITE, "lantern", radius=1.4, height=0.9)
    part(P, "cone", [0, 28.7, 1.0], COPPER, "lantern cap", radius=1.6, height=0.8)
    for ang_x, ang_z in ((-5.5, 10.5), (5.5, 10.5)):
        part(P, "box", [ang_x, 19.6, ang_z + 1.0], WHITE, "drum window frame", mode="paint", size=[1.4, 1.9, 2.0])
        part(P, "box", [ang_x, 19.9, ang_z + 1.0], GLASS, "drum window", mode="paint", size=[0.8, 1.3, 2.0])
    # south portico: podium, steps, six Corinthian columns, entablature, pediment
    part(P, "box", [0, 0, 13.6], WHITE, "portico podium", size=[20.4, 3.6, 3.8])
    for i in range(6):
        part(P, "box", [0, 0, 15.75 + i * 0.42], "smooth_stone", f"step {i + 1}",
             size=[14.0 + 0.6 * i, 3.6 - i * 0.6, 0.45])
    for x in (-8.5, -5.1, -1.7, 1.7, 5.1, 8.5):
        part(P, "box", [x, 3.6, 14.6], WHITE, "column base", size=[1.6, 0.45, 1.6])
        part(P, "cylinder", [x, 4.05, 14.6], WHITE, "column shaft", radius=0.68, radius_top=0.58, height=10.4)
        part(P, "box", [x, 14.45, 14.6], ORN, "Corinthian capital", size=[1.7, 1.15, 1.7])
    part(P, "box", [0, 15.6, 13.7], WHITE, "portico entablature", size=[21.0, 1.4, 4.2])
    part(P, "gable_roof", [0, 17.0, 13.7], WHITE, "pediment", size=[21.0, 3.0, 4.4], ridge="z")
    part(P, "box", [0, 3.6, 11.75], DOOR, "main door", mode="paint", size=[2.4, 4.6, 1.3])
    part(P, "box", [0, 8.2, 11.75], WHITE, "door surround", mode="paint", size=[3.4, 0.6, 1.3])
    # end porches (east and west): white podium, columns, balustraded roof
    part(P, "box", [38.8, 0, 2.75], WHITE, "end porch podium", size=[5.6, 3.6, 10], mirror="x")
    for z in (-1.4, 1.6, 4.6, 7.2):
        part(P, "cylinder", [40.9, 3.6, z], WHITE, "end porch column", radius=0.42, height=6.2, mirror="x")
    part(P, "box", [38.8, 9.8, 2.75], WHITE, "end porch entablature", size=[5.6, 1.0, 10], mirror="x")
    part(P, "box", [38.8, 10.8, 2.75], WHITE, "end porch balustrade", size=[5.6, 0.7, 10], mirror="x")
    # windows: main floor, second, third; basement lights
    rows = [(4.6, 2.8), (8.8, 2.2), (11.8, 1.7)]
    south_x = [13.9 + 3.25 * i for i in range(7)]
    windows(P, south_x + [-x for x in south_x], 11.75, 1, rows)
    windows(P, south_x + [-x for x in south_x], 11.75, 1, [(1.0, 1.4)], w=1.0)
    north_x = [10.4 + 3.25 * i for i in range(8)]
    windows(P, north_x + [-x for x in north_x], -6.25, -1, rows)
    windows(P, [-5.0, -1.7, 1.7, 5.0], -18.2, -1, rows)
    windows(P, [-9.4, -6.5, 6.5, 9.4], 11.75, 1, rows[1:])          # beside and behind the portico
    windows(P, [-3.2, 3.2], 11.75, 1, [(9.6, 2.4)])
    return {"name": "Dallas Hall", "height_m": 29.4, "is_known_landmark": True,
            "camera": {"azimuth_deg": 0, "elevation_deg": 4},
            "analysis": "Dallas Hall (1915), SMU. Footprint and heights from the 2018 USGS lidar: wings 72 x 18 m, "
                        "eave 15 m, ridge 18 m; rotunda drum ~23 m, copper dome to 29 m; south portico 20 m wide with "
                        "six Corinthian columns; end porches 11 m. Details from Wikimedia Commons photos.",
            "parts": P}


def perkins_chapel():
    """Faces east (the entrance and steeple are at the east end); origin = footprint bbox centre."""
    P = []
    zc = 0.75                                 # nave centre line
    part(P, "box", [-2.4, 0, zc], BASE, "nave base course", size=[34.8, 0.9, 16.4])
    part(P, "box", [-2.4, 0.9, zc], BRICK, "nave", size=[34.8, 8.7, 16])
    part(P, "box", [-2.4, 9.6, zc], WHITE, "nave cornice", size=[35.4, 0.6, 16.8])
    part(P, "gable_roof", [-2.4, 10.2, zc], SLATE, "nave slate roof", size=[35.4, 3.6, 16.8], ridge="x")
    # low wings at the west end
    for z, lab in ((-10.4, "north wing"), (11.0, "south wing")):
        part(P, "box", [-13.0, 0, z], BRICK, lab, size=[10.5, 5.6, 5.6])
        part(P, "box", [-13.0, 5.6, z], WHITE, lab + " cornice", size=[11.0, 0.4, 6.0])
        part(P, "hip_roof", [-13.0, 6.0, z], SLATE, lab + " roof", size=[10.8, 1.8, 5.8])
    # tall arched windows along the nave
    for x in (-16.5, -12.0, -7.5, -3.0, 1.5, 6.0):
        for face in (zc + 8.0, zc - 8.0):
            part(P, "box", [x, 2.2, face], WHITE, "window frame", mode="paint", size=[2.0, 5.6, 1.3])
            part(P, "box", [x, 2.5, face], GLASS, "arched window", mode="paint", size=[1.4, 4.8, 1.3])
    # east narthex and portico: four white columns, pediment
    part(P, "box", [13.6, 0, zc], BRICK, "narthex", size=[5.2, 11.0, 14.0])
    part(P, "box", [13.6, 10.6, zc], WHITE, "narthex cornice", size=[5.6, 0.5, 14.4])
    part(P, "box", [17.6, 0, zc], WHITE, "portico floor", size=[3.6, 0.6, 12.4])
    for z in (-4.2, -1.4, 1.4, 4.2):
        part(P, "cylinder", [18.6, 0.6, zc + z], WHITE, "portico column", radius=0.45, radius_top=0.38, height=7.8)
    part(P, "box", [17.4, 8.4, zc], WHITE, "portico entablature", size=[4.2, 1.1, 12.6])
    part(P, "gable_roof", [17.4, 9.5, zc], WHITE, "pediment", size=[4.2, 3.0, 12.6], ridge="x")
    part(P, "box", [16.2, 0.6, zc], DOOR, "front door", mode="paint", size=[1.3, 4.0, 2.4])
    # steeple: brick tower, white belfry, octagonal lantern, spire
    tx = 14.4
    part(P, "box", [tx, 0, zc], BRICK, "steeple tower", size=[4.2, 17.0, 4.2])
    part(P, "box", [tx, 16.6, zc], WHITE, "tower cornice", size=[4.8, 0.6, 4.8])
    part(P, "box", [tx, 17.2, zc], WHITE, "belfry", size=[3.6, 4.4, 3.6])
    part(P, "arch", [tx, 17.6, zc], label="belfry openings", mode="carve", width=1.4, height=3.2, depth=4.0)
    part(P, "arch", [tx, 17.6, zc], label="belfry openings", mode="carve", width=1.4, height=3.2, depth=4.0, axis="x")
    part(P, "box", [tx, 21.6, zc], WHITE, "belfry cornice", size=[4.0, 0.5, 4.0])
    part(P, "cylinder", [tx, 22.1, zc], WHITE, "octagonal lantern", radius=1.6, height=3.2, sides=8)
    part(P, "cylinder", [tx, 25.3, zc], WHITE, "lantern cornice", radius=1.8, height=0.4, sides=8)
    part(P, "cone", [tx, 25.7, zc], WHITE, "spire", radius=1.45, height=12.3, sides=8)
    part(P, "beam", [0, 0, 0], "iron_bars", "finial", **{"from": [tx, 37.8, zc], "to": [tx, 39.2, zc]}, width=0.2)
    return {"name": "Perkins Chapel", "height_m": 39.2, "is_known_landmark": True,
            "camera": {"azimuth_deg": 90, "elevation_deg": 8},
            "analysis": "Perkins Chapel (1951), SMU: Georgian brick chapel. From the 2018 USGS lidar: nave 35 x 16 m, "
                        "ridge ~14 m; steeple at the east end, tower ~4 m square to 17 m, belfry to ~26 m, spire to "
                        "39 m; low wings at the west end. Steeple stages follow Georgian (Wren-Gibbs) practice; "
                        "no photo was available for this one, so details are estimated.",
            "parts": P}


EZ_OUTLINE = [[-27.9, 26.2], [-45.7, 15.5], [-46.8, 16.8], [-62.2, 11.2], [-62.3, 13.0], [-65.7, 12.9], [-65.9, 5.6],
              [-67.0, 5.7], [-67.1, 3.0], [-68.0, 3.0], [-68.1, -7.7], [-63.1, -7.7], [-63.2, -18.0], [-17.5, -19.4],
              [-17.1, -23.3], [-12.5, -24.9], [-5.3, -26.0], [0.5, -26.2], [5.8, -26.0], [11.2, -25.0], [15.8, -23.8],
              [15.8, -19.8], [62.6, -21.1], [62.9, -11.7], [67.7, -11.5], [68.1, -0.7], [63.0, -0.6], [63.4, 7.9],
              [48.0, 14.3], [46.6, 13.1], [30.2, 24.4], [25.9, 20.3], [-24.7, 21.9]]   # OSM, metres, y = north


def endzone_complex():
    """Garry Weber End Zone Complex (2024), Ford Stadium's south end: blue seats stepping up from the field,
    a two-level glass club/suite front in white bands between brick pavilions, the video board on top.
    Footprint from OpenStreetMap; heights and facade from a 2024 photo. Origin = footprint bbox centre."""
    P = []
    fp = [[x, -y] for x, y in EZ_OUTLINE]               # spec z is south
    part(P, "extrude", [0, 0, 0], "polished_andesite", "seating structure", footprint=fp, height=7.5)
    z0, d, rise, rows = -26.0, 1.0, 0.62, 12             # seat rows from the field edge (north) southward
    for i in range(rows):
        z = z0 + i * d
        part(P, "box", [0, rise * i, z + d / 2], label=f"seat row {i + 1} cut", mode="carve", size=[140, 20, d])
        part(P, "box", [0, rise * i - 0.3, z + d / 2], "blue_concrete", f"seat row {i + 1}", mode="paint",
             size=[140, 0.7, d])
    part(P, "box", [0, 0, -14.0], "polished_andesite", "aisle", size=[1.4, 0.2, 24], mode="paint")
    # club and suites: glass front between brick pavilions
    zf = z0 + rows * d                                   # building front
    part(P, "box", [0, 0, zf + 11], "bricks", "club building", size=[80, 15.5, 22])
    for x in (-49, 49):
        part(P, "box", [x, 0, zf + 9], "bricks", "end pavilion", size=[18, 17, 18])
        part(P, "box", [x, 17, zf + 9], "smooth_quartz", "pavilion cornice", size=[18.6, 0.6, 18.6])
        for y in (9.0, 12.6):
            for wx in (-5, 0, 5):
                part(P, "box", [x + wx, y, zf], GLASS, "pavilion window", mode="paint", size=[1.6, 2.4, 1.3])
    part(P, "box", [0, 7.5, zf], GLASS, "club glazing", mode="paint", size=[78, 3.6, 1.3])
    part(P, "box", [0, 11.1, zf], WHITE, "name band", mode="paint", size=[80, 1.0, 1.3])
    part(P, "box", [0, 12.1, zf], GLASS, "suite glazing", mode="paint", size=[78, 3.0, 1.3])
    part(P, "box", [0, 15.1, zf + 11], WHITE, "roof cornice", size=[81, 0.6, 23])
    for x in range(-36, 37, 6):
        part(P, "box", [x, 7.5, zf], WHITE, "mullion", mode="paint", size=[0.4, 7.6, 1.3])
    # video board
    part(P, "box", [0, 15.7, zf + 2], "black_concrete", "video board frame", size=[26, 10.5, 2.0])
    part(P, "box", [0, 16.4, zf + 1], "blue_concrete", "video board screen", mode="paint", size=[24, 8.0, 1.3])
    part(P, "box", [0, 21.0, zf + 1], "red_concrete", "screen graphic", mode="paint", size=[10, 2.2, 1.3])
    part(P, "box", [0, 26.2, zf + 2], WHITE, "stadium name band", size=[26, 1.0, 2.0])
    part(P, "box", [0, 4.0, zf + 22], "black_concrete", "support legs", size=[6, 11.7, 1.0], mode="paint")
    # flag poles on the roof
    for x, cols in ((-30, ("blue_wool", "white_wool")), (30, ("red_wool", "white_wool"))):
        part(P, "beam", [0, 0, 0], "iron_bars", "flag pole", **{"from": [x, 15.6, zf + 1], "to": [x, 24.5, zf + 1]},
             width=0.2)
        part(P, "box", [x + 1.4, 22.6, zf + 1], cols[0], "flag", size=[2.6, 1.6, 0.34])
    return {"name": "Garry Weber End Zone Complex", "height_m": 27, "camera": {"azimuth_deg": 180, "elevation_deg": 10},
            "analysis": "Ford Stadium's south end zone building (2024). Footprint from OpenStreetMap, layout and "
                        "heights from a 2024 photo: seats facing north, glass club/suite levels, brick end "
                        "pavilions, video board on the roof.", "parts": P}


# ---------------------------------------------------------------- Ford Stadium press box
FIELD_C = (439.6, 172.5)                                   # pitch centre, local metres
FU = (0.121, 0.993)                                        # along the field (north), local east/north
FN = (0.993, -0.121)                                       # across the field (east)
FROT = -6.95                                               # spec rotate that turns spec -z onto FU


def fpt(a, b):
    """Field coordinates (a along, b across, metres) -> spec x, z."""
    e = a * FU[0] + b * FN[0]
    n = a * FU[1] + b * FN[1]
    return round(e, 3), round(-n, 3)


def fbox(P, a, b, y, la, lb, h, mat=None, label="", mode=None):
    x, z = fpt(a, b)
    kw = {"mode": mode} if mode else {}
    part(P, "box", [x, y, z], mat, label, size=[lb, h, la], rotate=FROT, **kw)


def press_box():
    """West-side press box and suites (from the lidar: 105 m long, 17 m deep, roof at 27.5 m, front face at
    b = -80.5 above the lower bowl's top row at 12.7 m) with the field face from photos: a white sign band
    with SMU MUSTANGS, two bands of glass suites and the press level, white floor slabs, a roof overhang,
    brick stair towers at the ends. Origin = pitch centre."""
    from mcbuild.pixfont import text as pixtext
    P = []
    a0, a1, bf, bb = -75.0, 30.0, -80.5, -97.5
    ac, L, D = (a0 + a1) / 2, a1 - a0, bb - bf
    fbox(P, ac, (bf + bb) / 2, 12.4, L, -D, 15.2, WHITE, "press box")
    fbox(P, ac, (bf + bb) / 2, 27.6, L + 1.0, -D + 1.6, 0.7, WHITE, "roof overhang")
    fbox(P, ac, (bf + bb) / 2, 28.3, L - 4, -D - 4, 1.2, "smooth_stone", "rooftop plant")
    for aa in (a0 + 3.0, a1 - 3.0):                        # brick stair towers at the ends
        fbox(P, aa, (bf + bb) / 2, 0, 6.0, -D + 0.6, 29.0, BRICK, "stair tower")
        fbox(P, aa, (bf + bb) / 2, 29.0, 6.6, -D + 1.2, 0.5, WHITE, "tower cap")
    face = bf + 0.05
    for y0, h, lab in ((16.8, 3.8, "suite glass"), (22.4, 4.0, "press level glass")):
        fbox(P, ac, face, y0, L - 13, 1.3, h, GLASS, lab, mode="paint")
        for k in range(int((L - 14) / 3.0) + 1):           # mullions every 3 m
            fbox(P, a0 + 7 + 3.0 * k, face, y0, 0.36, 1.3, h, WHITE, "mullion", mode="paint")
    fbox(P, ac, face, 12.4, L - 13, 1.3, 4.2, WHITE, "sign band", mode="paint")
    bm = pixtext("SMU MUSTANGS")
    px = 1 / 3
    for r, c in zip(*np.nonzero(bm)):
        aa = ac + (c - bm.shape[1] / 2 + 0.5) * px
        yy = 13.0 + (bm.shape[0] - 1 - r) * px
        fbox(P, aa, face, yy, 0.36, 1.3, 0.36, "red_concrete", "sign letter", mode="paint")
    # lower north section (lidar: a 30..68, roof 22.6 m)
    na0, na1 = a1, 68.0
    nac, nL = (na0 + na1) / 2, na1 - na0
    fbox(P, nac, (bf + bb) / 2, 12.4, nL, -D, 10.0, WHITE, "north press section")
    fbox(P, nac, (bf + bb) / 2, 22.4, nL + 1.0, -D + 1.6, 0.6, WHITE, "north roof overhang")
    fbox(P, nac, face, 16.8, nL - 6, 1.3, 4.0, GLASS, "north suite glass", mode="paint")
    for k in range(int((nL - 7) / 3.0) + 1):
        fbox(P, na0 + 3.5 + 3.0 * k, face, 16.8, 0.36, 1.3, 4.0, WHITE, "mullion", mode="paint")
    fbox(P, na1 - 3.0, (bf + bb) / 2, 0, 6.0, -D + 0.6, 23.5, BRICK, "north stair tower")
    for y0 in (13.4, 18.0, 23.0):                          # street side windows
        for k in range(int((L - 14) / 3.3)):
            fbox(P, a0 + 7.5 + 3.3 * k, bb - 0.05, y0, 1.3, 1.3, 2.2, GLASS, "back window", mode="paint")
    return {"name": "Ford Stadium press box", "height_m": 30, "camera": {"azimuth_deg": 97, "elevation_deg": 8},
            "analysis": "Press box and suites on the west side of Gerald J. Ford Stadium. Size from the 2018 lidar; "
                        "facade from Wikimedia Commons photos.", "parts": P}


def press_box_extras():
    """Remove the lidar massing of the press box above the bowl before the clean one goes in."""
    corners = [fpt(-80, -70.0), fpt(72, -70.0), fpt(72, -101.0), fpt(-80, -101.0)]
    return {"carve": [{"poly": [list(c) for c in corners], "y": 13.0}]}


# ---------------------------------------------------------------- Cox School of Business
# Floor-plan pixels (SMU's first-floor map, Fincher at the top = east, Maguire left = north) to spec metres,
# fitted to the 2018 lidar of Fincher's cupola and the Maguire/Crow wings. Origin = local (323, 665).
COX_ORIGIN = (323.0, 665.0)


def plan_rect(px0, px1, py0, py1):
    """-> (x centre, z centre, width x, depth z) in spec metres."""
    xc = 40 - ((py0 + py1) / 2 - 70) * 0.151
    zc = -46 + ((px0 + px1) / 2 - 65) * 0.164
    return xc, zc, (py1 - py0) * 0.151, (px1 - px0) * 0.164


def _windows_x(P, xs, face_z, rows, w=1.25):
    for y0, h in rows:
        for x in xs:
            part(P, "box", [x, y0 - 0.35, face_z], WHITE, "window frame", mode="paint", size=[w + 0.65, h + 0.7, 1.3])
            part(P, "box", [x, y0, face_z], GLASS, "sash window", mode="paint", size=[w, h, 1.3])
            part(P, "box", [x, y0 + h / 2 - 0.15, face_z], WHITE, "meeting rail", mode="paint", size=[w, 0.3, 1.3])


def _windows_z(P, zs, face_x, rows, w=1.25):
    for y0, h in rows:
        for z in zs:
            part(P, "box", [face_x, y0 - 0.35, z], WHITE, "window frame", mode="paint", size=[1.3, h + 0.7, w + 0.65])
            part(P, "box", [face_x, y0, z], GLASS, "sash window", mode="paint", size=[1.3, h, w])
            part(P, "box", [face_x, y0 + h / 2 - 0.15, z], WHITE, "meeting rail", mode="paint", size=[1.3, 0.3, w])


def _rotunda(P, x, z, facing, name):
    """Semicircular two-storey colonnade porch on a wing's courtyard face (facing +1 = south, -1 = north)."""
    part(P, "cylinder", [x, 0, z], WHITE, name + " podium", radius=6.4, height=0.8)
    for ang in range(0, 181, 30):
        a = math.radians(ang)
        part(P, "cylinder", [x + 5.5 * math.cos(a), 0.8, z + facing * 5.5 * math.sin(a)], WHITE, name + " column",
             radius=0.45, radius_top=0.38, height=9.0)
    part(P, "cylinder", [x, 9.8, z], WHITE, name + " entablature", radius=6.3, height=1.3)
    part(P, "cylinder", [x, 9.8, z], label=name + " entablature soffit", mode="carve", radius=4.9, height=0.9)
    part(P, "cylinder", [x, 11.1, z], WHITE, name + " canopy", radius=6.0, height=0.4)
    part(P, "box", [x, 3.0, z], "dark_oak_planks", name + " doors", mode="paint", size=[3.0, 3.4, 1.3])


def _georgian_wing(P, xc, zc, w, d, label, roof="hip", ridge="x"):
    part(P, "box", [xc, 0, zc], "stone_bricks", label + " base", size=[w + 0.3, 1.0, d + 0.3])
    part(P, "box", [xc, 0, zc], BRICK, label, size=[w, 13.6, d])
    part(P, "box", [xc, 4.6, zc], WHITE, label + " string course", size=[w + 0.3, 0.4, d + 0.3])
    part(P, "box", [xc, 13.4, zc], WHITE, label + " cornice", size=[w + 0.9, 0.7, d + 0.9])
    if roof == "hip":
        part(P, "hip_roof", [xc, 14.1, zc], SLATE, label + " slate roof", size=[w + 0.4, 4.6, d + 0.4])
    else:
        part(P, "gable_roof", [xc, 14.1, zc], SLATE, label + " slate roof", size=[w + 0.4, 4.6, d + 0.4], ridge=ridge)


ROWS3 = [(1.6, 2.5), (5.8, 2.6), (9.9, 2.4)]


def cox_school():
    P = []
    # Fincher: the 1952 building with the cupola
    fx, fz, fw, fd = plan_rect(215, 500, 70, 230)
    _georgian_wing(P, fx, fz, fw, fd, "Fincher")
    for zz in (fz - fd / 2 + 1.5, fz + fd / 2 - 1.5):
        part(P, "box", [fx, 12, zz], BRICK, "Fincher chimney", size=[2.2, 10.6, 1.6])
        part(P, "box", [fx, 22.6, zz], WHITE, "chimney cap", size=[2.5, 0.35, 1.9])
    for side in (-1, 1):                                     # seven dormers on each roof face
        for i in range(7):
            dz = fz - 15 + i * 5
            dx = fx + side * (fw / 2 - 2.6)
            part(P, "box", [dx, 15.0, dz], WHITE, "dormer", size=[1.9, 2.0, 1.7])
            part(P, "gable_roof", [dx, 17.0, dz], SLATE, "dormer roof", size=[2.0, 0.9, 1.9], ridge="x")
            part(P, "box", [dx + side * 1.0, 15.4, dz], GLASS, "dormer window", mode="paint", size=[1.2, 1.3, 0.9])
    _windows_z(P, [fz - 19 + 3.17 * i for i in range(13)], fx + fw / 2, ROWS3)
    # cupola: brick base through the roof, white belvedere, balustrade, gold dome and spire
    part(P, "box", [fx, 14.0, fz], BRICK, "tower base", size=[6.0, 8.6, 6.0])
    part(P, "box", [fx, 22.6, fz], WHITE, "tower cornice", size=[6.6, 0.6, 6.6])
    part(P, "cylinder", [fx, 23.2, fz], WHITE, "belvedere plinth", radius=2.7, height=0.8, sides=8)
    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        part(P, "cylinder", [fx + 2.15 * math.cos(a), 24.0, fz + 2.15 * math.sin(a)], WHITE, "belvedere column",
             radius=0.25, height=3.6)
    part(P, "cylinder", [fx, 27.6, fz], WHITE, "belvedere entablature", radius=2.7, height=0.7, sides=8)
    part(P, "cylinder", [fx, 28.3, fz], WHITE, "balustrade", radius=2.5, height=0.6, sides=8)
    part(P, "cylinder", [fx, 28.3, fz], label="balustrade well", mode="carve", radius=1.9, height=0.6, sides=8)
    part(P, "cylinder", [fx, 28.3, fz], WHITE, "lantern drum", radius=1.7, height=1.1, sides=8)
    part(P, "dome", [fx, 29.4, fz], "gold_block", "gold dome", radius=1.9, height=1.9)
    part(P, "beam", [0, 0, 0], "gold_block", "spire", **{"from": [fx, 31.2, fz], "to": [fx, 33.0, fz]}, width=0.34)
    # the new commons in front of Fincher: limestone frame, five full-height glass bays, arched end windows
    cx_, cz_, cw, cd = plan_rect(255, 480, 185, 290)
    part(P, "box", [cx_, 0, cz_], WHITE, "commons", size=[cw, 11.4, cd])
    part(P, "box", [cx_, 10.6, cz_], WHITE, "commons entablature", size=[cw + 0.6, 1.0, cd + 0.6])
    for sx, sz, x, z in ((cw, 0.5, cx_, cz_ - cd / 2), (cw, 0.5, cx_, cz_ + cd / 2), (0.5, cd, cx_ - cw / 2, cz_)):
        part(P, "box", [x, 11.6, z], WHITE, "commons balustrade", size=[sx, 0.8, sz])
    face = cx_ - cw / 2
    for i in range(5):
        z = cz_ - 8.8 + i * 4.4
        part(P, "box", [face, 0.6, z], GLASS, "commons glass bay", mode="paint", size=[1.3, 9.2, 3.4])
        for k in range(1, 3):
            part(P, "box", [face, 0.6, z - 1.7 + k * 1.13], WHITE, "mullion", mode="paint", size=[1.3, 9.2, 0.3])
        for k in range(1, 6):
            part(P, "box", [face, 0.6 + k * 1.55, z], WHITE, "transom", mode="paint", size=[1.3, 0.3, 3.4])
        part(P, "box", [face, 0.6, z], "dark_oak_planks", "commons door", mode="paint", size=[1.3, 2.6, 1.2])
    for z in (cz_ - 15.0, cz_ + 15.0):
        part(P, "arch", [face, 0.6, z], label="arched window", mode="carve", width=3.0, height=7.6, depth=1.4, axis="x")
        part(P, "box", [face + 0.5, 0.6, z], GLASS, "arched window glass", mode="paint", size=[1.3, 7.6, 3.0])
    # Maguire (north) and Crow (south) wings with their rotundas
    mx, mz, mw, md = plan_rect(65, 210, 220, 600)
    sx_, sz_, sw, sd = plan_rect(480, 625, 220, 600)
    for (wx, wz, ww, wd, nm, face_in, face_out) in ((mx, mz, mw, md, "Maguire", mz + md / 2, mz - md / 2),
                                                   (sx_, sz_, sw, sd, "Crow", sz_ - sd / 2, sz_ + sd / 2)):
        _georgian_wing(P, wx, wz, ww, wd, nm)
        xs = [wx - ww / 2 + 2.5 + 3.3 * i for i in range(int((ww - 4) / 3.3) + 1)]
        _windows_x(P, xs, face_in, ROWS3)
        _windows_x(P, xs, face_out, ROWS3)
        for ch in (wx - ww / 2 + 3, wx + ww / 2 - 8):
            part(P, "box", [ch, 13, wz], BRICK, nm + " chimney", size=[1.6, 8.0, 2.4])
        _rotunda(P, cx_ - cw / 2 - 2.5, face_in, 1 if nm == "Maguire" else -1, nm)
    # Bolin-Bridwell (north) and Sheffield (south): pediments to the plaza, arcades to Bishop Boulevard
    for rect, nm, ped in ((plan_rect(75, 265, 595, 665), "Bolin-Bridwell Hall", 1),
                          (plan_rect(432, 625, 600, 668), "Sheffield Hall", -1)):
        bx, bz, bw, bd = rect
        _georgian_wing(P, bx, bz, bw, bd, nm, roof="gable", ridge="z")
        pz = bz + ped * bd / 2
        part(P, "gable_roof", [bx, 14.0, pz - ped * 0.4], WHITE, nm + " pediment", size=[bw + 1.0, 5.0, 0.8], ridge="z")
        part(P, "box", [bx, 13.3, pz], WHITE, nm + " pediment base", size=[bw + 1.0, 0.8, 1.6])
        part(P, "cylinder", [bx, 15.3, pz + ped * 0.1], WHITE, nm + " oculus", radius=0.7, height=1.0, tilt=[90, 0])
        west = bx - bw / 2
        for i in range(6):                                   # deep arcade loggia on the boulevard side
            z = bz - bd / 2 + 2.8 + i * (bd - 5.6) / 5
            part(P, "arch", [west + 1.2, 0, z], label=nm + " arcade", mode="carve", width=2.8, height=4.0, depth=2.4, axis="x")
        for i in range(2):
            part(P, "arch", [bx - 2.4 + 4.8 * i, 0, pz], label=nm + " plaza arch", mode="carve", width=2.8, height=4.0, depth=2.4)
        _windows_z(P, [bz - bd / 2 + 2.8 + i * (bd - 5.6) / 5 for i in range(6)], west, ROWS3[1:])
        _windows_x(P, [bx - 2.4, bx + 2.4], pz, ROWS3[1:])
    # plaza sign wall facing the boulevard: "SMU COX" (lettering is added by the site as a sign object)
    px_, pz_, pw, pd = plan_rect(277, 415, 603, 728)
    part(P, "box", [px_ - pw / 2 + 1.0, 0, pz_], WHITE, "sign wall", size=[1.0, 3.2, 16.0])
    part(P, "box", [px_ - pw / 2 + 1.0, 3.2, pz_], WHITE, "sign wall coping", size=[1.4, 0.35, 16.6])
    for zz in (pz_ - 11.5, pz_ + 11.5):                      # low quadrangle walls either side
        part(P, "box", [px_ - pw / 2 + 4.0, 0, zz], WHITE, "quadrangle wall", size=[0.9, 1.2, 6.0])
    return {"name": "Cox School of Business", "height_m": 33, "is_known_landmark": True,
            "camera": {"azimuth_deg": -90, "elevation_deg": 12},
            "analysis": "Edwin L. Cox School of Business, SMU, after the David B. Miller Business Quadrangle "
                        "expansion. Layout from SMU's first-floor map fitted to the 2018 lidar; heights from the "
                        "lidar (Fincher roof 18-22 m, cupola 32 m; wings 12-20 m); details from Commons and "
                        "contractor photos: Fincher's slate roof, seven dormers a side, brick tower and white "
                        "belvedere with gold dome; limestone glass commons; Maguire and Crow rotundas; pedimented "
                        "Bolin-Bridwell and Sheffield halls with arcades.", "parts": P}


def cox_extras():
    """Courtyard, plaza, lamps, benches and young trees, in the Cox spec's coordinates."""
    cx, cz, cw, cd = plan_rect(210, 480, 290, 600)          # courtyard between the wings
    ox, oz, ow, od = plan_rect(275, 490, 300, 595)          # oval lawn
    px_, pz_, pw, pd = plan_rect(277, 415, 603, 728)        # entrance plaza
    lamps, benches, trees = [], [], []
    for i in range(12):
        a = 2 * math.pi * i / 12
        lamps.append([round(ox + (ow / 2 + 1.6) * math.cos(a), 2), round(oz + (od / 2 + 1.6) * math.sin(a), 2)])
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        facing = "south" if math.sin(a) < 0 else "north"
        benches.append([round(ox + (ow / 2 + 2.8) * math.cos(a), 2), round(oz + (od / 2 + 2.8) * math.sin(a), 2),
                        facing])
    for z in (pz_ - 9, pz_ + 9):
        lamps.append([round(px_ - 6, 2), z])
        lamps.append([round(px_ + 4, 2), z])
    for x in (cx - cw / 2 + 3, cx + cw / 2 - 3):
        for z in (cz - cd / 2 + 2.5, cz + cd / 2 - 2.5):
            trees.append([round(x, 2), round(z, 2), 6.5, 1.8, "elm"])
    return {"clear": [-62, -48, 42, 48],
            "ground": [{"shape": "rect", "x": cx, "z": cz, "w": cw, "d": cd, "surface": "bricks"},
                       {"shape": "ellipse", "x": ox, "z": oz, "w": ow, "d": od, "surface": "grass_block", "lawn": False},
                       {"shape": "rect", "x": px_, "z": pz_, "w": pw, "d": pd, "surface": "bricks"}],
            "lamps": lamps, "benches": benches, "trees": trees,
            "signs": [{"text": "SMU COX", "x": round(px_ - pw / 2 + 0.4, 2), "z": round(pz_, 2), "y": 1, "facing": "west"}]}


if __name__ == "__main__":
    for fn, spec in (("dallas_hall.json", dallas_hall()), ("perkins_chapel.json", perkins_chapel()),
                     ("endzone_complex.json", endzone_complex()), ("cox_school.json", cox_school()),
                     ("press_box.json", press_box())):
        json.dump(spec, open(os.path.join(HERE, fn), "w"), indent=1)
        print(fn, len(spec["parts"]), "parts")
    heroes = [
        {"building": "Dallas Hall", "spec": "dallas_hall.json"},
        {"building": "Perkins Chapel", "spec": "perkins_chapel.json"},
        {"building": "Garry Weber Endzone Complex", "spec": "endzone_complex.json"},
        {"building": ["Fincher Building", "Maguire Building", "Crow Building"], "spec": "cox_school.json",
         "at": list(COX_ORIGIN), "extras": cox_extras()},
        {"building": "Gerald J. Ford Stadium", "spec": "press_box.json", "at": list(FIELD_C), "extras": press_box_extras(),
         "keep": True},
    ]
    json.dump(heroes, open(os.path.join(HERE, "heroes.json"), "w"), indent=1)
    print("heroes.json", len(heroes), "heroes")
