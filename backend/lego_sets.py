"""
LEGO Art set definitions.

Each set includes:
- name, description
- grid dimensions (width x height in studs)
- color palette with RGB values and piece counts from actual set inventory

RGB values use official LEGO color references where possible.
Piece counts are the 1x1 round plate/tile counts from set inventories
(excluding structural/frame pieces and spare parts).
"""

LEGO_SETS = {
    "31205": {
        "name": "Jim Lee Batman Collection",
        "description": "Build one of three iconic Jim Lee Batman artworks",
        "grid": (48, 48),
        "total_studs": 3967,
        "colors": [
            {"name": "Medium Lavender", "hex": "#AC78BA", "rgb": (172, 120, 186), "count": 95, "part_type": "Plate"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 257, "part_type": "Plate"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 380, "part_type": "Plate"},
            {"name": "Nougat", "hex": "#D09168", "rgb": (208, 145, 104), "count": 153, "part_type": "Plate"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 112, "part_type": "Plate"},
            {"name": "Blue", "hex": "#0055BF", "rgb": (0, 85, 191), "count": 293, "part_type": "Plate"},
            {"name": "Bright Green", "hex": "#4B9F4A", "rgb": (75, 159, 74), "count": 210, "part_type": "Plate"},
            {"name": "Dark Orange", "hex": "#A95500", "rgb": (169, 85, 0), "count": 55, "part_type": "Plate"},
            {"name": "Reddish Brown", "hex": "#582A12", "rgb": (88, 42, 18), "count": 165, "part_type": "Plate"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 277, "part_type": "Plate"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 566, "part_type": "Plate"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 216, "part_type": "Plate"},
            {"name": "Medium Azure", "hex": "#36AEBF", "rgb": (54, 174, 191), "count": 139, "part_type": "Plate"},
            {"name": "Light Aqua", "hex": "#ADC3C0", "rgb": (173, 195, 192), "count": 194, "part_type": "Plate"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 423, "part_type": "Plate"},
            {"name": "Pearl Titanium", "hex": "#3E3C39", "rgb": (62, 60, 57), "count": 432, "part_type": "Plate"},
        ],
    },
    "31204": {
        "name": "Elvis Presley \"The King\"",
        "description": "Build a portrait of Elvis Presley, The King of Rock 'n' Roll",
        "grid": (48, 48),
        "total_studs": 3245,
        "colors": [
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 52, "part_type": "Tile"},
            {"name": "Light Nougat", "hex": "#F6D7B3", "rgb": (246, 215, 179), "count": 360, "part_type": "Tile"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 80, "part_type": "Tile"},
            {"name": "Medium Nougat", "hex": "#AA7D55", "rgb": (170, 125, 85), "count": 182, "part_type": "Tile"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 71, "part_type": "Tile"},
            {"name": "Dark Brown", "hex": "#352100", "rgb": (53, 33, 0), "count": 206, "part_type": "Tile"},
            {"name": "Dark Orange", "hex": "#A95500", "rgb": (169, 85, 0), "count": 179, "part_type": "Tile"},
            {"name": "Medium Blue", "hex": "#5A93DB", "rgb": (90, 147, 219), "count": 230, "part_type": "Tile"},
            {"name": "Sand Blue", "hex": "#6074A1", "rgb": (96, 116, 161), "count": 175, "part_type": "Tile"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 152, "part_type": "Tile"},
            {"name": "Nougat", "hex": "#D09168", "rgb": (208, 145, 104), "count": 258, "part_type": "Tile"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 596, "part_type": "Tile"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 106, "part_type": "Tile"},
            {"name": "Dark Red", "hex": "#720E0F", "rgb": (114, 14, 15), "count": 339, "part_type": "Tile"},
            {"name": "Reddish Brown", "hex": "#582A12", "rgb": (88, 42, 18), "count": 233, "part_type": "Tile"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 26, "part_type": "Tile"},
        ],
    },
    "31197": {
        "name": "Andy Warhol's Marilyn Monroe",
        "description": "Recreate Andy Warhol's iconic pop art portrait",
        "grid": (48, 48),
        "total_studs": 3212,
        "colors": [
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 642, "part_type": "Tile"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 141, "part_type": "Tile"},
            {"name": "Dark Pink", "hex": "#C870A0", "rgb": (200, 112, 160), "count": 590, "part_type": "Tile"},
            {"name": "Magenta", "hex": "#923978", "rgb": (146, 57, 120), "count": 47, "part_type": "Tile"},
            {"name": "Medium Azure", "hex": "#36AEBF", "rgb": (54, 174, 191), "count": 608, "part_type": "Tile"},
            {"name": "Yellow", "hex": "#F2CD37", "rgb": (242, 205, 55), "count": 589, "part_type": "Tile"},
            {"name": "Bright Pink", "hex": "#E4ADC8", "rgb": (228, 173, 200), "count": 595, "part_type": "Tile"},
        ],
    },
    "31200": {
        "name": "Star Wars The Sith",
        "description": "Build Darth Vader, Darth Maul, or Kylo Ren",
        "grid": (48, 48),
        "total_studs": 3295,
        "colors": [
            {"name": "Orange", "hex": "#FE8A18", "rgb": (254, 138, 24), "count": 127, "part_type": "Plate"},
            {"name": "Dark Red", "hex": "#720E0F", "rgb": (114, 14, 15), "count": 334, "part_type": "Plate"},
            {"name": "Bright Light Yellow", "hex": "#FFF03A", "rgb": (255, 240, 58), "count": 94, "part_type": "Plate"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 112, "part_type": "Plate"},
            {"name": "Pearl Titanium", "hex": "#3E3C39", "rgb": (62, 60, 57), "count": 275, "part_type": "Plate"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 292, "part_type": "Plate"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 162, "part_type": "Plate"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 897, "part_type": "Plate"},
            {"name": "Sand Blue", "hex": "#6074A1", "rgb": (96, 116, 161), "count": 145, "part_type": "Plate"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 450, "part_type": "Plate"},
            {"name": "Dark Brown", "hex": "#352100", "rgb": (53, 33, 0), "count": 212, "part_type": "Plate"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 195, "part_type": "Plate"},
        ],
    },
    "31201": {
        "name": "Harry Potter Hogwarts Crests",
        "description": "Build a Hogwarts house crest – Gryffindor, Slytherin, Hufflepuff, or Ravenclaw",
        "grid": (48, 48),
        "total_studs": 4166,
        "colors": [
            {"name": "Medium Azure", "hex": "#36AEBF", "rgb": (54, 174, 191), "count": 12, "part_type": "Plate"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 382, "part_type": "Plate"},
            {"name": "Green", "hex": "#237841", "rgb": (35, 120, 65), "count": 512, "part_type": "Plate"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 244, "part_type": "Plate"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 605, "part_type": "Plate"},
            {"name": "Blue", "hex": "#0055BF", "rgb": (0, 85, 191), "count": 448, "part_type": "Plate"},
            {"name": "Dark Red", "hex": "#720E0F", "rgb": (114, 14, 15), "count": 513, "part_type": "Plate"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 17, "part_type": "Plate"},
            {"name": "Pearl Gold", "hex": "#AA7F2E", "rgb": (170, 127, 46), "count": 618, "part_type": "Plate"},
            {"name": "Flat Silver", "hex": "#898788", "rgb": (137, 135, 136), "count": 645, "part_type": "Plate"},
            {"name": "Pearl Titanium", "hex": "#3E3C39", "rgb": (62, 60, 57), "count": 164, "part_type": "Plate"},
            {"name": "Lime", "hex": "#BBE90B", "rgb": (187, 233, 11), "count": 6, "part_type": "Plate"},
        ],
    },
    "31203": {
        "name": "World Map",
        "description": "Build a stunning world map – the largest LEGO set by piece count",
        "grid": (128, 80),
        "total_studs": 11538,
        "colors": [
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 3189, "part_type": "Plate"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 750, "part_type": "Tile"},
            {"name": "Coral", "hex": "#FF698F", "rgb": (255, 105, 143), "count": 617, "part_type": "Tile"},
            {"name": "Bright Green", "hex": "#4B9F4A", "rgb": (75, 159, 74), "count": 623, "part_type": "Tile"},
            {"name": "Dark Turquoise", "hex": "#008F9B", "rgb": (0, 143, 155), "count": 1934, "part_type": "Tile"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 410, "part_type": "Tile"},
            {"name": "Lime", "hex": "#BBE90B", "rgb": (187, 233, 11), "count": 1110, "part_type": "Tile"},
            {"name": "Medium Azure", "hex": "#36AEBF", "rgb": (54, 174, 191), "count": 1660, "part_type": "Tile"},
            {"name": "Orange", "hex": "#FE8A18", "rgb": (254, 138, 24), "count": 626, "part_type": "Tile"},
            {"name": "Bright Light Orange", "hex": "#F8BB3D", "rgb": (248, 187, 61), "count": 619, "part_type": "Tile"},
        ],
    },
    "31198": {
        "name": "The Beatles",
        "description": "Build a portrait of each of The Fab Four — now with a striking soundtrack",
        "grid": (48, 48),
        "total_studs": 2812,
        "colors": [
            {"name": "Dark Orange", "hex": "#A95500", "rgb": (169, 85, 0), "count": 87, "part_type": "Tile"},
            {"name": "Bright Light Blue", "hex": "#9FC3E9", "rgb": (159, 195, 233), "count": 58, "part_type": "Tile"},
            {"name": "Bright Light Orange", "hex": "#F8BB3D", "rgb": (248, 187, 61), "count": 66, "part_type": "Tile"},
            {"name": "Dark Brown", "hex": "#352100", "rgb": (53, 33, 0), "count": 560, "part_type": "Tile"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 123, "part_type": "Tile"},
            {"name": "Reddish Brown", "hex": "#582A12", "rgb": (88, 42, 18), "count": 255, "part_type": "Tile"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 53, "part_type": "Tile"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 288, "part_type": "Tile"},
            {"name": "Dark Tan", "hex": "#958A73", "rgb": (149, 138, 115), "count": 144, "part_type": "Tile"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 152, "part_type": "Tile"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 157, "part_type": "Tile"},
            {"name": "Orange", "hex": "#FE8A18", "rgb": (254, 138, 24), "count": 76, "part_type": "Tile"},
            {"name": "Sand Blue", "hex": "#6074A1", "rgb": (96, 116, 161), "count": 53, "part_type": "Tile"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 710, "part_type": "Tile"},
            {"name": "Medium Nougat", "hex": "#AA7D55", "rgb": (170, 125, 85), "count": 30, "part_type": "Tile"},
        ],
    },
    "31199": {
        "name": "Marvel Studios Iron Man",
        "description": "Build one of three iconic Iron Man suits — Mark III, Hulkbuster, or Mark LXXXV",
        "grid": (48, 48),
        "total_studs": 3085,
        "colors": [
            {"name": "Pearl Gold", "hex": "#AA7F2E", "rgb": (170, 127, 46), "count": 242, "part_type": "Plate"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 487, "part_type": "Plate"},
            {"name": "Sand Blue", "hex": "#6074A1", "rgb": (96, 116, 161), "count": 24, "part_type": "Plate"},
            {"name": "Dark Orange", "hex": "#A95500", "rgb": (169, 85, 0), "count": 176, "part_type": "Plate"},
            {"name": "Dark Tan", "hex": "#958A73", "rgb": (149, 138, 115), "count": 99, "part_type": "Plate"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 546, "part_type": "Plate"},
            {"name": "Medium Nougat", "hex": "#AA7D55", "rgb": (170, 125, 85), "count": 216, "part_type": "Plate"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 93, "part_type": "Plate"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 168, "part_type": "Plate"},
            {"name": "Dark Brown", "hex": "#352100", "rgb": (53, 33, 0), "count": 205, "part_type": "Plate"},
            {"name": "Reddish Brown", "hex": "#582A12", "rgb": (88, 42, 18), "count": 198, "part_type": "Plate"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 62, "part_type": "Plate"},
            {"name": "Dark Red", "hex": "#720E0F", "rgb": (114, 14, 15), "count": 220, "part_type": "Plate"},
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 32, "part_type": "Plate"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 317, "part_type": "Plate"},
        ],
    },
    "31202": {
        "name": "Disney's Mickey Mouse",
        "description": "Build the world's most famous mouse in iconic black-and-white style",
        "grid": (48, 48),
        "total_studs": 2461,
        "colors": [
            {"name": "Light Bluish Gray", "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 59, "part_type": "Tile"},
            {"name": "Dark Bluish Gray", "hex": "#6C6E68", "rgb": (108, 110, 104), "count": 79, "part_type": "Tile"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 835, "part_type": "Tile"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 213, "part_type": "Tile"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 32, "part_type": "Tile"},
            {"name": "Dark Red", "hex": "#720E0F", "rgb": (114, 14, 15), "count": 96, "part_type": "Tile"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 409, "part_type": "Tile"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 662, "part_type": "Tile"},
            {"name": "Dark Brown", "hex": "#352100", "rgb": (53, 33, 0), "count": 76, "part_type": "Tile"},
        ],
    },
    "31207": {
        "name": "Floral Art",
        "description": "Build stunning floral artwork with a vibrant, colorful palette",
        "grid": (32, 48),
        "total_studs": 2711,
        "colors": [
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 281, "part_type": "Plate"},
            {"name": "Blue", "hex": "#0055BF", "rgb": (0, 85, 191), "count": 242, "part_type": "Plate"},
            {"name": "Bright Light Orange", "hex": "#F8BB3D", "rgb": (248, 187, 61), "count": 370, "part_type": "Tile"},
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 550, "part_type": "Tile"},
            {"name": "Dark Turquoise", "hex": "#008F9B", "rgb": (0, 143, 155), "count": 370, "part_type": "Tile"},
            {"name": "Dark Pink", "hex": "#C870A0", "rgb": (200, 112, 160), "count": 370, "part_type": "Tile"},
            {"name": "Light Nougat", "hex": "#F6D7B3", "rgb": (246, 215, 179), "count": 370, "part_type": "Tile"},
            {"name": "Bright Pink", "hex": "#E4ADC8", "rgb": (228, 173, 200), "count": 158, "part_type": "Tile"},
        ],
    },
    "21226": {
        "name": "Art Project — Create Together",
        "description": "Build collaborative mosaics — 36 designs across Food, Patterns, Icons & Interests themes",
        "grid": (48, 48),
        "total_studs": 3936,
        "colors": [
            {"name": "White", "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 474, "part_type": "Tile"},
            {"name": "Tan", "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 241, "part_type": "Tile"},
            {"name": "Bright Light Yellow", "hex": "#FFF03A", "rgb": (255, 240, 58), "count": 119, "part_type": "Tile"},
            {"name": "Yellow", "hex": "#F2CD37", "rgb": (242, 205, 55), "count": 299, "part_type": "Tile"},
            {"name": "Bright Light Orange", "hex": "#F8BB3D", "rgb": (248, 187, 61), "count": 163, "part_type": "Tile"},
            {"name": "Orange", "hex": "#FE8A18", "rgb": (254, 138, 24), "count": 133, "part_type": "Tile"},
            {"name": "Red", "hex": "#C91A09", "rgb": (201, 26, 9), "count": 190, "part_type": "Tile"},
            {"name": "Bright Pink", "hex": "#E4ADC8", "rgb": (228, 173, 200), "count": 58, "part_type": "Tile"},
            {"name": "Reddish Brown", "hex": "#582A12", "rgb": (88, 42, 18), "count": 307, "part_type": "Tile"},
            {"name": "Medium Nougat", "hex": "#AA7D55", "rgb": (170, 125, 85), "count": 281, "part_type": "Tile"},
            {"name": "Bright Green", "hex": "#4B9F4A", "rgb": (75, 159, 74), "count": 148, "part_type": "Tile"},
            {"name": "Lime", "hex": "#BBE90B", "rgb": (187, 233, 11), "count": 166, "part_type": "Tile"},
            {"name": "Dark Azure", "hex": "#078BC9", "rgb": (7, 139, 201), "count": 127, "part_type": "Tile"},
            {"name": "Light Aqua", "hex": "#ADC3C0", "rgb": (173, 195, 192), "count": 317, "part_type": "Tile"},
            {"name": "Dark Blue", "hex": "#0A3463", "rgb": (10, 52, 99), "count": 660, "part_type": "Tile"},
            {"name": "Black", "hex": "#05131D", "rgb": (5, 19, 29), "count": 254, "part_type": "Tile"},
        ],
    },
    "free": {
        "name": "Free Mode — All Colors",
        "description": "Unlimited bricks with all official LEGO 1×1 round plate colors. Best possible quality.",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "White",              "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 9999},
            {"name": "Light Nougat",       "hex": "#FCC39E", "rgb": (252, 195, 158), "count": 9999},
            {"name": "Nougat",             "hex": "#D09168", "rgb": (208, 145, 104), "count": 9999},
            {"name": "Medium Nougat",      "hex": "#AA7D55", "rgb": (170, 125, 85),  "count": 9999},
            {"name": "Tan",                "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 9999},
            {"name": "Brick Yellow",       "hex": "#D8BE8C", "rgb": (216, 190, 140), "count": 9999},
            {"name": "Cool Yellow",        "hex": "#FFF03C", "rgb": (255, 240, 60),  "count": 9999},
            {"name": "Bright Yellow",      "hex": "#F2CD37", "rgb": (242, 205, 55),  "count": 9999},
            {"name": "Warm Gold",          "hex": "#E4A933", "rgb": (228, 169, 51),  "count": 9999},
            {"name": "Flame Yellowish Or", "hex": "#F8BB3C", "rgb": (248, 187, 60),  "count": 9999},
            {"name": "Bright Orange",      "hex": "#F97B22", "rgb": (249, 123, 34),  "count": 9999},
            {"name": "Orange",             "hex": "#FE8A18", "rgb": (254, 138, 24),  "count": 9999},
            {"name": "Dark Orange",        "hex": "#A95500", "rgb": (169, 85, 0),    "count": 9999},
            {"name": "Bright Red",         "hex": "#C91A09", "rgb": (201, 26, 9),    "count": 9999},
            {"name": "Dark Red",           "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 9999},
            {"name": "Reddish Brown",      "hex": "#694028", "rgb": (105, 64, 40),   "count": 9999},
            {"name": "Dark Brown",         "hex": "#352100", "rgb": (53, 33, 0),     "count": 9999},
            {"name": "Sand Green",         "hex": "#A0BCAC", "rgb": (160, 188, 172), "count": 9999},
            {"name": "Bright Green",       "hex": "#4B9F4A", "rgb": (75, 159, 74),   "count": 9999},
            {"name": "Dark Green",         "hex": "#184632", "rgb": (24, 70, 50),    "count": 9999},
            {"name": "Olive Green",        "hex": "#9B9A5A", "rgb": (155, 154, 90),  "count": 9999},
            {"name": "Aqua",               "hex": "#B3D7D1", "rgb": (179, 215, 209), "count": 9999},
            {"name": "Medium Azure",       "hex": "#36AEBF", "rgb": (54, 174, 191),  "count": 9999},
            {"name": "Medium Blue",        "hex": "#5A93DB", "rgb": (90, 147, 219),  "count": 9999},
            {"name": "Bright Blue",        "hex": "#0055BF", "rgb": (0, 85, 191),    "count": 9999},
            {"name": "Dark Blue",          "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 9999},
            {"name": "Sand Blue",          "hex": "#6074A1", "rgb": (96, 116, 161),  "count": 9999},
            {"name": "Medium Lavender",    "hex": "#AC78BA", "rgb": (172, 120, 186), "count": 9999},
            {"name": "Lavender",           "hex": "#E0BBE4", "rgb": (224, 187, 228), "count": 9999},
            {"name": "Bright Reddish Vio", "hex": "#8B1C8B", "rgb": (139, 28, 139),  "count": 9999},
            {"name": "Light Grey",         "hex": "#C8C8C8", "rgb": (200, 200, 200), "count": 9999},
            {"name": "Medium Stone Grey",  "hex": "#A3A2A5", "rgb": (163, 162, 165), "count": 9999},
            {"name": "Dark Stone Grey",    "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 9999},
            {"name": "Pearl Dark Grey",    "hex": "#575857", "rgb": (87, 88, 87),    "count": 9999},
            {"name": "Flat Silver",        "hex": "#898788", "rgb": (137, 135, 136), "count": 9999},
            {"name": "Black",              "hex": "#05131D", "rgb": (5, 19, 29),     "count": 9999},
            {"name": "Bright Pink",        "hex": "#E4ADC8", "rgb": (228, 173, 200), "count": 9999},
            {"name": "Coral",              "hex": "#FF698F", "rgb": (255, 105, 143), "count": 9999},
        ],
    },
}


def get_set_ids():
    """Return list of available set IDs."""
    return list(LEGO_SETS.keys())


def get_set_info(set_id: str):
    """Return set info without detailed color data (for listing)."""
    s = LEGO_SETS.get(set_id)
    if not s:
        return None
    return {
        "id": set_id,
        "name": s["name"],
        "description": s["description"],
        "grid": s["grid"],
        "total_studs": s["total_studs"],
        "num_colors": len(s["colors"]),
    }


def get_set_detail(set_id: str):
    """Return full set info including colors."""
    s = LEGO_SETS.get(set_id)
    if not s:
        return None
    return {
        "id": set_id,
        **s,
    }


def merge_sets(selections: list[dict]) -> dict | None:
    """Merge multiple sets into a single virtual set.

    Args:
        selections: List of {"set_id": str, "qty": int}

    Returns:
        A merged set dict compatible with generate_mosaic, or None if invalid.
    """
    if not selections:
        return None

    # Use max grid from all selected sets
    max_gw, max_gh = 0, 0
    names = []
    color_map = {}  # hex -> {name, hex, rgb, count}

    for sel in selections:
        set_data = LEGO_SETS.get(sel["set_id"])
        if not set_data:
            return None
        qty = max(1, sel.get("qty", 1))

        gw, gh = set_data["grid"]
        if gw * gh > max_gw * max_gh:
            max_gw, max_gh = gw, gh

        names.append(f"{set_data['name']} ×{qty}" if qty > 1 else set_data["name"])

        for c in set_data["colors"]:
            key = c["hex"]
            if key in color_map:
                color_map[key]["count"] += c["count"] * qty
            else:
                color_map[key] = {
                    "name": c["name"],
                    "hex": c["hex"],
                    "rgb": c["rgb"],
                    "count": c["count"] * qty,
                }

    colors = list(color_map.values())
    total = sum(c["count"] for c in colors)

    return {
        "name": " + ".join(names),
        "description": "Merged sets",
        "grid": (max_gw, max_gh),
        "total_studs": max_gw * max_gh,
        "colors": colors,
    }
