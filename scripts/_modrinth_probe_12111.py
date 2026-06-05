import json
import urllib.request

SLUGS = [
    "fabric-api",
    "create-fly",
    "farmers-delight-refabricated",
    "more-delight",
    "floras-delight",
    "resourceful-lib",
    "friends-and-foes",
    "puzzles-lib",
    "visual-workbench",
    "lithium",
    "simple-voice-chat",
    "open-parties-and-claims",
    "essential-commands",
    "luckperms",
    "styled-chat",
    "grim-anticheat",
    "server-core",
    "fabric-language-kotlin",
    "cloth-config",
    "architectury-api",
    "forge-config-api-port",
    "placeholder-api",
    "spark",
    "easyauth",
    "trade",
    "falling-tree",
    "fastrtp",
    "chunky",
    "ledger",
    "krypton",
    "antixray",
    "double-doors",
    "fsit",
    "rightclickharvest",
    "item-fragments",
    "vanish",
    "worldedit",
    "xaeros-map-server-utils",
    "moonlight",
    "supplementaries",
    "sodium",
    "iris",
    "emi",
    "jade",
    "modmenu",
    "collective",
    "jamlib",
    "female-gender-mod",
]


def ver(slug: str):
    url = (
        "https://api.modrinth.com/v2/project/"
        + slug
        + "/version?game_versions=%5B%221.21.11%22%5D&loaders=%5B%22fabric%22%5D"
    )
    try:
        data = json.load(urllib.request.urlopen(url, timeout=30))
    except Exception as e:
        return slug, None, str(e)
    if not data:
        return slug, None, "NO_VERSION"
    v = data[0]
    f = [x for x in v["files"] if x.get("primary")][0]
    return slug, v["version_number"], f["filename"]


for slug in SLUGS:
    s, vernum, info = ver(slug)
    print(f"{s}: {vernum or ''} {info}")
