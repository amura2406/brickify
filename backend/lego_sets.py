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
        "total_studs": 2304,
        "colors": [
            {"name": "Black",           "hex": "#05131D", "rgb": (5, 19, 29),     "count": 566},
            {"name": "Dark Blue",       "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 423},
            {"name": "Brick Yellow",    "hex": "#D8BE8C", "rgb": (216, 190, 140),  "count": 380},
            {"name": "Bright Blue",     "hex": "#0055BF", "rgb": (0, 85, 191),    "count": 293},
            {"name": "Dark Stone Grey", "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 216},
            {"name": "Bright Green",    "hex": "#4B9F4A", "rgb": (75, 159, 74),   "count": 210},
            {"name": "White",           "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 100},
            {"name": "Aqua",            "hex": "#B3D7D1", "rgb": (179, 215, 209), "count": 194},
            {"name": "Medium Lavender", "hex": "#AC78BA", "rgb": (172, 120, 186), "count": 80},
            {"name": "Dark Orange",     "hex": "#A95500", "rgb": (169, 85, 0),    "count": 55},
            {"name": "Nougat",          "hex": "#D09168", "rgb": (208, 145, 104), "count": 100},
            {"name": "Medium Azure",    "hex": "#36AEBF", "rgb": (54, 174, 191),  "count": 90},
            {"name": "Bright Red",      "hex": "#C91A09", "rgb": (201, 26, 9),    "count": 50},
        ],
    },
    "31204": {
        "name": "Elvis Presley \"The King\"",
        "description": "Build a portrait of Elvis Presley, The King of Rock 'n' Roll",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Dark Red",        "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 339},
            {"name": "Black",           "hex": "#05131D", "rgb": (5, 19, 29),     "count": 331},
            {"name": "Light Nougat",    "hex": "#FCC39E", "rgb": (252, 195, 158), "count": 258},
            {"name": "Reddish Brown",   "hex": "#694028", "rgb": (105, 64, 40),   "count": 233},
            {"name": "Medium Blue",     "hex": "#5A93DB", "rgb": (90, 147, 219),  "count": 230},
            {"name": "Dark Brown",      "hex": "#352100", "rgb": (53, 33, 0),     "count": 206},
            {"name": "Medium Nougat",   "hex": "#AA7D55", "rgb": (170, 125, 85),  "count": 182},
            {"name": "Dark Orange",     "hex": "#A95500", "rgb": (169, 85, 0),    "count": 179},
            {"name": "Sand Blue",       "hex": "#6074A1", "rgb": (96, 116, 161),  "count": 175},
            {"name": "Dark Blue",       "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 152},
            {"name": "Tan",             "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 106},
            {"name": "Red",             "hex": "#C91A09", "rgb": (201, 26, 9),    "count": 80},
            {"name": "White",           "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 71},
            {"name": "Dark Stone Grey", "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 52},
            {"name": "Medium Stone Grey","hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 26},
            {"name": "Nougat",          "hex": "#D09168", "rgb": (208, 145, 104), "count": 120},
        ],
    },
    "31197": {
        "name": "Andy Warhol's Marilyn Monroe",
        "description": "Recreate Andy Warhol's iconic pop art portrait",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Black",           "hex": "#05131D", "rgb": (5, 19, 29),     "count": 700},
            {"name": "Magenta",         "hex": "#B6006B", "rgb": (182, 0, 107),   "count": 587},
            {"name": "Medium Azure",    "hex": "#36AEBF", "rgb": (54, 174, 191),  "count": 587},
            {"name": "Bright Yellow",   "hex": "#F2CD37", "rgb": (242, 205, 55),  "count": 350},
            {"name": "White",           "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 280},
        ],
    },
    "31200": {
        "name": "Star Wars The Sith",
        "description": "Build Darth Vader, Darth Maul, or Kylo Ren",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Black",           "hex": "#05131D", "rgb": (5, 19, 29),     "count": 877},
            {"name": "Dark Red",        "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 328},
            {"name": "Red",             "hex": "#C91A09", "rgb": (201, 26, 9),    "count": 285},
            {"name": "Dark Blue",       "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 279},
            {"name": "Dark Brown",      "hex": "#352100", "rgb": (53, 33, 0),     "count": 195},
            {"name": "Orange",          "hex": "#FE8A18", "rgb": (254, 138, 24),  "count": 125},
            {"name": "White",           "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 82},
            {"name": "Bright Light Yellow","hex": "#F3CF9B","rgb": (243, 207, 155),"count": 77},
            {"name": "Dark Stone Grey", "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 50},
            {"name": "Sand Blue",       "hex": "#6074A1", "rgb": (96, 116, 161),  "count": 31},
            {"name": "Pearl Dark Grey", "hex": "#575857", "rgb": (87, 88, 87),    "count": 23},
        ],
    },
    "31201": {
        "name": "Harry Potter Hogwarts Crests",
        "description": "Build a Hogwarts house crest – Gryffindor, Slytherin, Hufflepuff, or Ravenclaw",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Flat Silver",     "hex": "#898788", "rgb": (137, 135, 136), "count": 630},
            {"name": "Black",           "hex": "#05131D", "rgb": (5, 19, 29),     "count": 593},
            {"name": "Dark Red",        "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 503},
            {"name": "Green",           "hex": "#237841", "rgb": (35, 120, 65),   "count": 499},
            {"name": "Blue",            "hex": "#0055BF", "rgb": (0, 85, 191),    "count": 431},
            {"name": "Medium Stone Grey","hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 236},
            {"name": "Pearl Dark Grey", "hex": "#575857", "rgb": (87, 88, 87),    "count": 153},
        ],
    },
    "31203": {
        "name": "World Map",
        "description": "Build a stunning world map – the largest LEGO set by piece count",
        "grid": (128, 80),
        "total_studs": 10240,
        "colors": [
            {"name": "White",           "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 3064},
            {"name": "Teal",            "hex": "#008F9B", "rgb": (0, 143, 155),   "count": 1879},
            {"name": "Medium Azure",    "hex": "#36AEBF", "rgb": (54, 174, 191),  "count": 1607},
            {"name": "Lime",            "hex": "#BBE90B", "rgb": (187, 233, 11),  "count": 1060},
            {"name": "Tan",             "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 725},
            {"name": "Coral",           "hex": "#FF698F", "rgb": (255, 105, 143), "count": 601},
            {"name": "Bright Green",    "hex": "#4B9F4A", "rgb": (75, 159, 74),   "count": 601},
            {"name": "Orange",          "hex": "#FE8A18", "rgb": (254, 138, 24),  "count": 601},
            {"name": "Bright Orange",   "hex": "#F97B22", "rgb": (249, 123, 34),  "count": 599},
            {"name": "Dark Blue",       "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 393},
        ],
    },
    "31198": {
        "name": "The Beatles",
        "description": "Build a portrait of each of The Fab Four — now with a striking soundtrack",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Black",              "hex": "#05131D", "rgb": (5, 19, 29),     "count": 698},
            {"name": "Dark Brown",         "hex": "#352100", "rgb": (53, 33, 0),     "count": 554},
            {"name": "Tan",                "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 283},
            {"name": "Reddish Brown",      "hex": "#694028", "rgb": (105, 64, 40),   "count": 250},
            {"name": "White",              "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 149},
            {"name": "Dark Stone Grey",    "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 141},
            {"name": "Dark Tan",           "hex": "#958A73", "rgb": (149, 138, 115), "count": 137},
            {"name": "Dark Blue",          "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 121},
            {"name": "Dark Orange",        "hex": "#A95500", "rgb": (169, 85, 0),    "count": 85},
            {"name": "Orange",             "hex": "#FE8A18", "rgb": (254, 138, 24),  "count": 74},
            {"name": "Flame Yellowish Or", "hex": "#F8BB3C", "rgb": (248, 187, 60),  "count": 65},
            {"name": "Bright Light Blue",  "hex": "#9FC3E9", "rgb": (159, 195, 233), "count": 57},
            {"name": "Sand Blue",          "hex": "#6074A1", "rgb": (96, 116, 161),  "count": 52},
            {"name": "Medium Stone Grey",  "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 51},
            {"name": "Medium Nougat",      "hex": "#AA7D55", "rgb": (170, 125, 85),  "count": 29},
        ],
    },
    "31199": {
        "name": "Marvel Studios Iron Man",
        "description": "Build one of three iconic Iron Man suits — Mark III, Hulkbuster, or Mark LXXXV",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "Dark Blue",          "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 529},
            {"name": "Black",              "hex": "#05131D", "rgb": (5, 19, 29),     "count": 476},
            {"name": "Bright Red",         "hex": "#C91A09", "rgb": (201, 26, 9),    "count": 308},
            {"name": "Warm Gold",          "hex": "#DCBE61", "rgb": (220, 190, 97),  "count": 232},
            {"name": "Dark Red",           "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 214},
            {"name": "Medium Nougat",      "hex": "#AA7D55", "rgb": (170, 125, 85),  "count": 208},
            {"name": "Dark Brown",         "hex": "#352100", "rgb": (53, 33, 0),     "count": 196},
            {"name": "Reddish Brown",      "hex": "#694028", "rgb": (105, 64, 40),   "count": 191},
            {"name": "Dark Orange",        "hex": "#A95500", "rgb": (169, 85, 0),    "count": 162},
            {"name": "Tan",                "hex": "#E4CD9E", "rgb": (228, 205, 158), "count": 155},
            {"name": "Dark Tan",           "hex": "#958A73", "rgb": (149, 138, 115), "count": 97},
            {"name": "Dark Stone Grey",    "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 91},
            {"name": "White",              "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 61},
            {"name": "Medium Stone Grey",  "hex": "#A0A5A9", "rgb": (160, 165, 169), "count": 31},
            {"name": "Sand Blue",          "hex": "#6074A1", "rgb": (96, 116, 161),  "count": 23},
        ],
    },
    "31202": {
        "name": "Disney's Mickey Mouse",
        "description": "Build the world's most famous mouse in iconic black-and-white style",
        "grid": (48, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "White",              "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 835},
            {"name": "Black",              "hex": "#05131D", "rgb": (5, 19, 29),     "count": 662},
            {"name": "Dark Blue",          "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 409},
            {"name": "Dark Red",           "hex": "#720E0F", "rgb": (114, 14, 15),   "count": 96},
            {"name": "Dark Stone Grey",    "hex": "#6D6E5C", "rgb": (109, 110, 92),  "count": 79},
            {"name": "Dark Brown",         "hex": "#352100", "rgb": (53, 33, 0),     "count": 76},
        ],
    },
    "31207": {
        "name": "Floral Art",
        "description": "Build stunning floral artwork with a vibrant, colorful palette",
        "grid": (32, 48),
        "total_studs": 2304,
        "colors": [
            {"name": "White",              "hex": "#FFFFFF", "rgb": (255, 255, 255), "count": 550},
            {"name": "Teal",               "hex": "#008F9B", "rgb": (0, 143, 155),   "count": 370},
            {"name": "Coral",              "hex": "#FF698F", "rgb": (255, 105, 143), "count": 370},
            {"name": "Flame Yellowish Or", "hex": "#F8BB3C", "rgb": (248, 187, 60),  "count": 370},
            {"name": "Dark Blue",          "hex": "#0A3463", "rgb": (10, 52, 99),    "count": 281},
            {"name": "Lavender",           "hex": "#E0BBE4", "rgb": (224, 187, 228), "count": 158},
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
