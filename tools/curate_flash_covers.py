#!/usr/bin/env python3
"""Exact-title source cover replacement; writes a partial manifest for review."""
import concurrent.futures
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

from PIL import Image
import import_artwork as legacy

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/covers/curated/flash"
CACHE = Path("/tmp/flash-cover-source-cache")
DEST.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(exist_ok=True)
ALIASES = {
    "BTD1": ["Bloons Tower Defense"],
    "BTD5": ["Bloons Tower Defense 5"],
    "Abandoned3": ["Abandoned 3"],
    "Ambulencearush": ["Ambulance Rush"],
    "Bejeweledtwistflash": ["Bejeweled Twist"],
    "Achilles 2": ["Achilles 2: Origin of a Legend"],
    "Coverorangeplayerspack3 (1)": ["Cover Orange Players Pack 3"],
    "Car Eats Car 2 Deluxe": ["Car Eats Car 2: Deluxe"],
    "Dadgame": ["Dad Game"],
    "Pico’s School": ["Pico's School"],
    "Papa Louie When Burgers Attack": ["Papa Louie 2: When Burgers Attack"],
    "Papa Louie When Sundaes Attack": ["Papa Louie 3: When Sundaes Attack"],
    "Potty Racers 1": ["Potty Racers"],
    "Pre Civilization Bronze Age": ["Pre-Civilization Bronze Age"],
    "Henry Stickmin Stealing The Diamond": ["Stealing the Diamond"],
    "Henry Stickmin Infiltrating The Airship": ["Infiltrating the Airship"],
    "Henry Stickmin Breaking The Bank": ["Breaking the Bank"],
    "Henry Stickmin Escaping The Prison": ["Escaping the Prison"],
    "Henry Stickmin Fleeing The Complex": ["Fleeing the Complex"],
    "Binding of Isaac Demo": ["The Binding of Isaac"],
    "Binding of Isaac Wrath of The Lamb": ["The Binding of Isaac: Wrath of the Lamb"],
    "Binding of Isaac - Wrath of the Lamb Eternal Edition": ["The Binding of Isaac: Wrath of the Lamb"],
    "World’s Hardest Game 3": ["The World's Hardest Game 3", "World's Hardest Game 3"],
    "World’s Hardest Game 4": ["The World's Hardest Game 4", "World's Hardest Game 4"],
    "Riddleuneversityfix": ["Riddle University"],
    "Snail Bob 5 Love Story": ["Snail Bob 5: Love Story"],
    "Spongebob PowerKart Grand Prix": ["SpongeBob: PowerKart Grand Prix"],
    "The Deepest Sleep": ["Deepest Sleep"],
    "The Sun For The Vampire": ["The Sun for the Vampire"],
    "This is the Only Level Too": ["This Is the Only Level TOO"],
    "Super Fighters": ["Superfighters"],
    "Learn to Fly 2 Hacked": ["Learn to Fly 2"],
    "Learn to Fly 3 (debug)": ["Learn to Fly 3"],
    "Learn to Fly Idle hacked": ["Learn to Fly Idle"],
    "Animator Vs Animation Game (Special Edition)": ["Animator vs Animation"],
    "Troll Face Quest 1": ["Trollface Quest", "Trollface Quest 1"],
}
for num in range(2, 14):
    ALIASES["Troll Face Quest " + str(num)] = ["Trollface Quest " + str(num)]


def normalize(value):
    return legacy.normalized(value)


def fetch(url, limit=4_000_000):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=12) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("File exceeds image/page limit")
    return data


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = {}
    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        attrs = dict(attrs)
        key = attrs.get("property") or attrs.get("name")
        if key:
            self.values[key] = attrs.get("content", "")


def metadata(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".json")
    if path.exists():
        return json.loads(path.read_text())
    parser = Metadata()
    parser.feed(fetch(url).decode("utf8", "replace"))
    path.write_text(json.dumps(parser.values))
    return parser.values


def candidates(item, mapping, existing):
    names = [item["title"], *ALIASES.get(item["title"], [])]
    target = {normalize(name) for name in names}
    # An exact source artwork match already in this catalog is useful for duplicate ports.
    for name in target:
        for record in existing.get(name, []):
            yield record
    for name in names:
        for score, url, credit, kind in mapping.get(normalize(name), []):
            if score >= 100:
                yield {"source": url, "attribution": credit, "matchedTitle": name}
    for name in names:
        slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower().replace("'", "").replace("’", "").replace("&", "and")).strip("-")
        variants = [slug, re.sub(r"(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])", "-", slug)]
        if "flash" in slug:
            variants.append(slug.replace("flash", "").strip("-"))
        for slug in dict.fromkeys(variants):
            page = "https://www.miniplay.com/game/" + slug
            try:
                values = metadata(page)
                if normalize(values.get("og:title", "")) not in target or values.get("og:type") != "game":
                    continue
                if not values.get("og:image", "").startswith("https://"):
                    continue
                yield {"source": values["og:image"], "sourcePage": values.get("og:url", page),
                       "attribution": "Original cover artwork from the exact game page on Miniplay; rights remain with its creators.",
                       "matchedTitle": values["og:title"]}
            except Exception:
                continue


def save(item, record):
    data = fetch(record["source"])
    image = Image.open(io.BytesIO(data))
    image.load()
    if min(image.size) < 64:
        raise ValueError("Thumbnail too small")
    if image.format not in {"JPEG", "PNG", "WEBP", "GIF"}:
        raise ValueError("Not a supported image")
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    image.thumbnail((768, 768))
    slug = re.sub("[^a-z0-9]+", "-", item["title"].lower()).strip("-")
    path = DEST / (slug[:62] + "-" + hashlib.sha256(data).hexdigest()[:12] + ".webp")
    image.save(path, "WEBP", quality=90, method=6)
    return {**record, "image": path.relative_to(ROOT).as_posix(), "type": "source-artwork",
            "quality": "verified-cover", "review": "Exact title metadata and visual contact-sheet review"}


def main():
    items = json.loads((ROOT / "catalog.js").read_text().split("=", 1)[1].strip().rstrip(";"))
    art = json.loads((ROOT / "artwork.json").read_text())
    pending = [item for item in items if item["category"] == "flash" and
               (art[item["id"]].get("captureType") or art[item["id"]]["type"] == "illustrated")]
    existing = {}
    for item in items:
        record = art[item["id"]]
        if record.get("type") == "source-artwork" and not record.get("captureType") and record.get("source", "").startswith("http"):
            existing.setdefault(normalize(item["title"]), []).append(record)
    mapping, _ = legacy.load_upstream_indexes()
    added, unresolved = {}, []

    def process(item):
        seen = set()
        for record in candidates(item, mapping, existing):
            if record["source"] in seen:
                continue
            seen.add(record["source"])
            try:
                return item, save(item, record)
            except Exception:
                continue
        return item, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(process, item) for item in pending]
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            item, record = future.result()
            if record:
                added[item["id"]] = record
            else:
                unresolved.append({"id": item["id"], "title": item["title"]})
            if n % 20 == 0:
                print("Reviewed", n, "/", len(pending), "matched", len(added), flush=True)
                (ROOT / "reports/cover-replacements-flash.json").write_text(json.dumps(added, indent=2) + "\n")
    (ROOT / "reports/cover-replacements-flash.json").write_text(json.dumps(added, indent=2) + "\n")
    (ROOT / "reports/cover-unresolved-flash.json").write_text(json.dumps(unresolved, indent=2) + "\n")
    print("Exact-source replacements", len(added), "unresolved", len(unresolved), flush=True)


if __name__ == "__main__":
    main()
