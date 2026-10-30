"""Hand-written hero specs for the SMU site build (Dallas Hall, ...).

Dimensions come from the 2018 USGS lidar of each footprint (tools: photo2mc site data) and the details
from photos on Wikimedia Commons. Coordinates follow the spec convention: x east, z south (the front
faces south), origin at the centre of the footprint's bounding box, y = 0 at the building's floor.
Run:  python samples/smu/make_heroes.py   -> samples/smu/*.json
"""
import json
import os

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


if __name__ == "__main__":
    for fn, spec in (("dallas_hall.json", dallas_hall()), ("perkins_chapel.json", perkins_chapel())):
        json.dump(spec, open(os.path.join(HERE, fn), "w"), indent=1)
        print(fn, len(spec["parts"]), "parts")
