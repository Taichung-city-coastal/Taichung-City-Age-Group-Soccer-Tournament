"""Build the static team manifest so teams.html works when opened as a local file.

Run from the site folder: python scripts/build-team-data.py
Each subfolder of assets/球隊介紹 supplies 介紹.txt and its JPG/PNG/WebP photos.
"""

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "球隊介紹"
OUTPUT = ROOT / "js" / "team-data.js"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def photo_sort(path):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", path.name)]


teams = [
    {
        "name": "香港熱火體育會 On Fire Athletic Association",
        "description": "來自香港的熱血勁旅，即將登場！🇭🇰",
        "images": ["assets/announcements/on-fire-hong-kong-first.jpg"],
        "category": "國際參賽球隊",
        "postUrl": "https://www.facebook.com/permalink.php?story_fbid=pfbid02QUQnzXSurMYzh3hJy6b3wabCc9JjYzvCzD87GpmpGxpP9kBgdrikeJos6Rcuxc2rl&id=61555701383095",
    }
]

for folder in sorted(SOURCE.iterdir(), key=lambda path: path.name.casefold()):
    if not folder.is_dir():
        continue
    intro = folder / "介紹.txt"
    if not intro.is_file():
        raise FileNotFoundError(f"Missing team introduction: {intro}")
    photos = sorted((file for file in folder.rglob("*") if file.is_file() and file.suffix.lower() in EXTENSIONS), key=photo_sort)
    if not photos:
        raise ValueError(f"No photos found for {folder.name}")
    teams.append({
        "name": folder.name,
        "description": intro.read_text(encoding="utf-8-sig").strip(),
        "images": [photo.relative_to(ROOT).as_posix() for photo in photos],
        "category": "參賽球隊",
    })

output = "// Generated from assets/球隊介紹 by scripts/build-team-data.py.\n" + \
         "window.TEAM_INTRODUCTIONS = " + json.dumps(teams, ensure_ascii=False, indent=2) + ";\n"
OUTPUT.write_text(output, encoding="utf-8")
print(f"Wrote {OUTPUT.name}: {len(teams)} teams, {sum(len(team['images']) for team in teams)} images")
