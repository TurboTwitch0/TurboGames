#!/usr/bin/env python3
"""Export TurboGames' original vector identity and local launch artwork.

Uses installed DejaVu fonts, fontTools, Pillow and local Chromium via Playwright.
No network services, font downloads or paid tooling are used. Pass --capture-url
only after the redesigned application is ready to capture.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import mimetypes
from pathlib import Path
import shutil
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import zipfile
from xml.etree import ElementTree

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
OUT = ROOT / "outputs" / "turbogames-brand-kit"
INK = "#0E1013"
SURFACE = "#191D24"
PAPER = "#F7F5EE"
LIME = "#D6FF64"
VIOLET = "#A9ADFF"
PEACH = "#FFB58C"
MUTED = "#ABB0BA"
FONTS = {
    "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
}
FONT_CACHE = {}


def text(x, y, size, value, fill=PAPER, weight="regular", tracking=0):
    """Outline the local font so SVG artwork has no external font dependency."""
    if weight not in FONT_CACHE:
        font = TTFont(FONTS[weight])
        FONT_CACHE[weight] = (font, font.getGlyphSet(), font.getBestCmap())
    font, glyphs, cmap = FONT_CACHE[weight]
    scale = size / font["head"].unitsPerEm
    cursor = 0
    paths = []
    for character in value:
        name = cmap.get(ord(character), ".notdef")
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            paths.append(f'<path d="{pen.getCommands()}" transform="translate({cursor:.3f} 0)"/>')
        cursor += font["hmtx"][name][0] + tracking / scale
    return f'<g role="img" aria-label="{html.escape(value, quote=True)}" fill="{fill}" transform="translate({x} {y}) scale({scale:.7f} {-scale:.7f})">{"".join(paths)}</g>'


def rect(x, y, w, h, fill, radius=0, stroke=None):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}"' + (f' stroke="{stroke}"' if stroke else "") + '/>'


def mark(x=0, y=0, size=96, bg=LIME, fg=INK):
    # Original two-part geometry: a forward leaning T and a small play wedge.
    return f'<g transform="translate({x} {y}) scale({size / 96})">' + rect(0, 0, 96, 96, bg, 25) + f'<path fill="{fg}" d="M25 25H78L72 41H58L47 74H30L41 41H19Z M65 50L81 60L57 74Z"/></g>'


def logo(x=0, y=0, size=48, fg=PAPER, bg=LIME):
    return mark(x, y, size, bg) + text(x + size + size * .25, y + size * .685, size * .56, "TurboGames", fg, "bold", -.5)


def svg(w, h, title, body, desc=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{html.escape(title)}</title><desc id="desc">{html.escape(desc)}</desc>{body}</svg>\n'


def write(name, data, folder=OUT):
    (folder / name).write_text(data, encoding="utf-8")


def image_data(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def photo(path, x, y, w, h, radius=20, ident="screen"):
    return f'<defs><clipPath id="{ident}">{rect(x,y,w,h,"#fff",radius)}</clipPath></defs><image href="{image_data(path)}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMin slice" clip-path="url(#{ident})"/>'


def build_identity():
    BRAND.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    write("turbogames-mark.svg", svg(96, 96, "TurboGames", mark(), "Original tilted T and play wedge in a Turbo Lime rounded square."), BRAND)
    write("turbogames-mark-dark.svg", svg(96, 96, "TurboGames dark mark", mark(bg=INK, fg=LIME)), BRAND)
    write("turbogames-mark-mono.svg", svg(96, 96, "TurboGames monochrome mark", mark(bg=PAPER, fg=INK)), BRAND)
    write("logo-light.svg", svg(382, 72, "TurboGames", logo(0, 0, 72), "Turbo Lime mark with Paper wordmark; for dark backgrounds."), BRAND)
    write("logo-dark.svg", svg(382, 72, "TurboGames", logo(0, 0, 72, INK), "Turbo Lime mark with Ink wordmark; for light backgrounds."), BRAND)
    for name in ("turbogames-mark.svg", "turbogames-mark-dark.svg", "turbogames-mark-mono.svg", "logo-light.svg", "logo-dark.svg"):
        shutil.copy2(BRAND / name, OUT / name)


def build_brand_sheet():
    body = rect(0, 0, 1600, 1800, INK)
    body += text(64, 69, 14, "TURBOGAMES / IDENTITY & LAUNCH SYSTEM", MUTED, "mono", 1.4)
    body += text(1390, 69, 14, "01 / 2026", MUTED, "mono")
    body += logo(64, 124, 96)
    body += text(64, 354, 91, "Find your next play.", PAPER, "bold", -3.5)
    body += text(68, 407, 22, "A familiar name. A clear way into the collection.", MUTED)
    body += '<path d="M64 463H1536" stroke="#343A43"/>'

    body += text(64, 521, 14, "01 / THE MARK", MUTED, "mono", 1.2)
    body += rect(64, 554, 660, 309, SURFACE, 28)
    body += mark(100, 596, 166)
    body += mark(310, 606, 72)
    body += mark(414, 606, 48)
    body += mark(494, 606, 32)
    body += text(310, 722, 21, "Lean forward. Press play.", PAPER, "bold", -.5)
    body += text(310, 758, 16, "Original T + directional play wedge.", MUTED)
    body += text(100, 822, 14, "Clear space: ¼ mark. Minimum digital size: 24px.", MUTED, "mono")
    body += rect(754, 554, 782, 144, SURFACE, 28)
    body += logo(790, 595, 62)
    body += rect(754, 719, 782, 144, PAPER, 28)
    body += logo(790, 760, 62, INK)
    body += text(1246, 641, 13, "ON SURFACE", MUTED, "mono")
    body += text(1246, 806, 13, "ON PAPER", "#626872", "mono")

    body += text(64, 932, 14, "02 / COLOR", MUTED, "mono", 1.2)
    colors = [("TURBO LIME", LIME, INK), ("INK", INK, PAPER), ("SURFACE", SURFACE, PAPER), ("PAPER", PAPER, INK), ("SOFT VIOLET", VIOLET, INK), ("PEACH", PEACH, INK)]
    for i, (name, value, fg) in enumerate(colors):
        x = 64 + i * 247
        body += rect(x, 963, 237, 151, value, 20, "#343A43" if name == "INK" else None)
        body += text(x + 18, 1062, 14, name, fg, "mono")
        body += text(x + 18, 1090, 16, value, fg, "mono")
    body += text(64, 1154, 18, "Lead with Ink and Paper. Lime signals action. Violet and Peach add a little warmth.", MUTED)

    body += text(64, 1220, 14, "03 / TYPE & SHAPE", MUTED, "mono", 1.2)
    body += text(64, 1297, 50, "Make room for play.", PAPER, "bold", -1.8)
    body += text(66, 1339, 18, "Strong system sans. Short headings. Useful, friendly details.", MUTED)
    body += text(66, 1381, 16, "SMALL LABELS / SYSTEM MONO / +0.08EM", LIME, "mono", .9)
    body += rect(1050, 1246, 214, 70, LIME, 22)
    body += text(1077, 1291, 20, "Explore titles", INK, "bold", -.6)
    body += rect(1284, 1246, 252, 70, SURFACE, 22, "#343A43")
    body += text(1320, 1291, 20, "Saved here", PAPER, "bold", -.6)
    body += text(1050, 1364, 17, "UI corners: 16–28px", MUTED, "mono")
    body += text(1050, 1398, 17, "Quiet borders. Clear focus.", MUTED, "mono")

    body += '<path d="M64 1452H1536" stroke="#343A43"/>'
    body += text(64, 1508, 14, "04 / VOICE", MUTED, "mono", 1.2)
    body += text(64, 1562, 26, "Curious. Direct. Welcoming.", PAPER, "bold", -.6)
    body += text(64, 1605, 19, "Browse 3,099 titles. Search a category. Save a find for later.", MUTED)
    body += text(64, 1642, 19, "Saved and Recent stay in this browser. Availability varies by title.", MUTED)
    body += text(64, 1738, 14, "ORIGINAL IDENTITY / EXISTING TURBOGAMES CATALOG / LOCAL EXPORT", LIME, "mono", .8)
    write("brand-sheet.svg", svg(1600, 1800, "TurboGames brand sheet", body, "Original logo, six brand colors, type, shape and voice guidance. The product promise is Find your next play."))


def build_campaign():
    desktop = OUT / "product-desktop.png"
    mobile = OUT / "product-mobile.png"
    if not desktop.exists() or not mobile.exists():
        return []
    # The screenshots below are unretouched captures of the actual local product.
    body = rect(0, 0, 1200, 630, INK)
    body += '<path d="M1115 -65L718 700M1195 -65L798 700M1275 -65L878 700" stroke="#303A27" stroke-width="36"/>'
    body += logo(48, 42, 46)
    body += text(48, 228, 77, "Find your", PAPER, "bold", -3.3)
    body += text(48, 317, 77, "next play.", LIME, "bold", -3.3)
    body += text(51, 379, 21, "3,099 titles to explore.", PAPER)
    body += text(51, 414, 21, "A good place to start.", MUTED)
    body += rect(48, 482, 395, 58, LIME, 18)
    body += text(74, 518, 17, "BROWSE / SEARCH / SAVE", INK, "mono", .3)
    body += text(51, 590, 12, "SAVED & RECENT STAY IN THIS BROWSER", MUTED, "mono", .5)
    body += '<g transform="rotate(-5 955 325)">'
    body += rect(584, 81, 766, 560, "#000000", 28)
    body += rect(577, 69, 766, 560, "#2C333B", 28)
    body += photo(desktop, 585, 77, 750, 544, 22, "social-desktop")
    body += '</g>'
    write("social-landscape.svg", svg(1200, 630, "TurboGames — Find your next play", body, "Landscape launch image with the actual redesigned TurboGames desktop interface. Browse 3,099 titles; Saved and Recent remain in this browser."))

    body = rect(0, 0, 1080, 1350, PAPER)
    body += logo(64, 57, 58, INK)
    body += text(64, 232, 105, "Find your", INK, "bold", -4)
    body += rect(53, 257, 658, 115, LIME, 24)
    body += text(64, 345, 105, "next play.", INK, "bold", -4)
    body += text(67, 422, 26, "3,099 titles. A whole lot to discover.", "#505762")
    body += text(67, 466, 19, "Browse the collection. Save what catches your eye.", "#505762")
    body += '<path d="M-160 1160L305 546M-62 1195L403 581M36 1230L501 616" stroke="#DDDCD6" stroke-width="44"/>'
    body += rect(47, 535, 908, 681, "#D6D6CD", 29)
    body += rect(39, 525, 908, 681, INK, 28)
    body += photo(desktop, 47, 533, 892, 665, 22, "portrait-desktop")
    body += rect(718, 670, 312, 641, "#00000022", 40)
    body += rect(704, 651, 312, 641, INK, 38)
    body += photo(mobile, 714, 661, 292, 621, 29, "portrait-mobile")
    body += rect(50, 1248, 600, 55, INK, 18)
    body += text(75, 1283, 16, "BROWSE / SEARCH / SAVE / PLAY", PAPER, "mono", .5)
    body += text(63, 1327, 11, "SAVED & RECENT STAY IN THIS BROWSER. TITLE AVAILABILITY VARIES.", "#505762", "mono", .4)
    write("promo-portrait.svg", svg(1080, 1350, "TurboGames launch portrait", body, "Portrait launch artwork showing actual desktop and mobile TurboGames screenshots. Find your next play. 3,099 catalog entries; availability varies by title."))
    return ["social-landscape", "promo-portrait"]


def write_docs():
    write("launch-copy.md", """# TurboGames launch copy

**Promise:** Find your next play.

**Short description:** Browse 3,099 games, apps, emulators and more. Search the collection, save a find, and return to your Recent titles in this browser.

**Launch caption:** A new look for TurboGames. Same curiosity. Browse 3,099 titles, search a category, and save something for later. Find your next play.

**Compact caption:** 3,099 titles to explore. Find your next play with TurboGames.

**Product intro:** A collection for a quick break or a new favorite. Search within a category, keep a few finds in Saved, and revisit Recent titles. Your library stays in this browser.

**Calls to action:** Explore the collection · Find a title · Save for later · Return to Recent

**Alt text — landscape:** TurboGames' original lime T mark and the words “Find your next play” beside a screenshot of its redesigned desktop game collection.

**Alt text — portrait:** TurboGames' new lime, ink and paper identity with real desktop and mobile screenshots of the existing searchable collection.

## Publication facts

- 3,099 is the current catalog entry count, including games, apps, emulators and miscellaneous titles. Update the number if the catalog changes.
- Search is scoped to the selected category; choose All to search the whole catalog.
- Saved and Recent use the current browser's storage. They do not sync between browsers or devices, and clearing browser data removes them.
- Titles open in an isolated, expandable player; a new-tab option is available. Sources and browser support vary, so the catalog count is not a guarantee that every title will load or play completely.
- The redesign does not add accounts, cloud sync, multiplayer infrastructure or AI recommendations.
- Exporting this kit creates local files. Social posts, ads and accounts require separate publishing actions.
""")
    write("README.md", """# TurboGames brand & launch kit

Original identity and local exports for the existing TurboGames product. Promise: **Find your next play.**

## Files

| File | Use / dimensions |
| --- | --- |
| `turbogames-mark.svg` | Primary lime icon; 96 × 96; transparent outside rounded badge |
| `turbogames-mark-dark.svg` | Ink badge with lime geometry |
| `turbogames-mark-mono.svg` | Paper badge with ink geometry |
| `turbogames-mark*.png` | Transparent icon exports; 512 × 512 |
| `logo-light.svg` | Horizontal Paper wordmark for dark backgrounds; 382 × 72 |
| `logo-dark.svg` | Horizontal Ink wordmark for light backgrounds; 382 × 72 |
| `logo-light.png` / `logo-dark.png` | Transparent horizontal wordmarks; 1528 × 288 |
| `brand-sheet.svg` / `.png` | Visual style guide; 1600 × 1800 |
| `social-landscape.svg` / `.png` | Landscape launch artwork; 1200 × 630 |
| `promo-portrait.svg` / `.png` | Portrait launch artwork; 1080 × 1350 |
| `product-desktop.png` | Actual redesigned product capture; 1440 × 1040 |
| `product-mobile.png` | Actual redesigned mobile collection capture (`?view=all`, scrolled to catalog); 390 × 844 |
| `launch-copy.md` | Draft copy, image alt text and product claim limits |
| `FONT-LICENSE.txt` | License for locally outlined DejaVu type glyphs |
| `SHA256SUMS.txt` | SHA-256 checksums for exported files, excluding the archive and manifest itself |
| `asset-manifest.json` | Export paths, public URLs, media types, dimensions and SHA-256 hashes; excludes archive and manifest self hashes |
| `TurboGames-brand-kit.zip` | Downloadable kit containing these exports and documentation |

Source identity SVGs also live in `assets/brand/`. SVG artwork is self-contained: lettering is outlined and actual product screenshots are embedded as PNG data URIs. Edit the source generator to change copy and export again. PNGs have the exact canvas sizes listed above.

## Identity

Ink `#0E1013` · Surface `#191D24` · Paper `#F7F5EE` · Turbo Lime `#D6FF64` · Soft Violet `#A9ADFF` · Peach `#FFB58C`.

Use a strong native system sans for display and body, system mono for short labels, and 16–28px UI corners. Keep ¼ icon width clear around the mark and use it at 24px or larger. The original forward leaning T and play wedge evolve the TurboGames name; the mark does not use a mascot or third party logo.

## Recreate locally

From the repository root with its local development server running:

```sh
python3 tools/export_brand_kit.py --capture-url http://127.0.0.1:8002/
```

To refresh vectors and PNGs using existing screenshots, omit `--capture-url`. `--brand-only` exports the identity and style guide without capturing or using product screenshots.

The generator uses local Python `fontTools`, Pillow, Playwright, installed DejaVu fonts, and `/usr/bin/chromium`. The capture waits for the local catalog and cover images, then records the desktop landing view and mobile All collection scrolled to the catalog, with no fictional controls or substituted game imagery. No paid service, hosted design vendor or external publishing is involved. The decorative frame and geometric stripes are artwork; the visible app interfaces are actual screenshots.

## Rights and claims

The logo geometry, palette arrangement, campaign layouts and launch copy were created for this TurboGames redesign. Existing title artwork visible in product screenshots belongs to its respective creators; these exports do not transfer game, artwork or trademark rights. Follow the repository's existing source and attribution records before external promotion of third party titles. Outlined lettering uses the installed open DejaVu Sans family; its license is included. No font file is bundled.

The product has 3,099 catalog entries at export time. Search follows the selected category. Saved and Recent stay in the current browser and do not sync. Player compatibility and source availability vary by title. These assets promise no accounts, AI features or guaranteed availability of every game. Copy is in `launch-copy.md`. The generator writes local files; publishing is handled separately.
""")
    source = Path("/usr/share/doc/fonts-dejavu-core/copyright").read_text()
    # Copy the upstream font license only, not Debian packaging copyright.
    license_text = source.split("Files: *\n", 1)[1].split("\nFiles: debian/*", 1)[0]
    write("FONT-LICENSE.txt", "DejaVu font glyph outlines\n\n" + license_text)


def capture(url):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for name, width, height, mobile in [("desktop", 1440, 1040, False), ("mobile", 390, 844, True)]:
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, reduced_motion="reduce")
            page = context.new_page()
            target_url = url
            if mobile:
                parts = urlsplit(url)
                query = dict(parse_qsl(parts.query))
                query["view"] = "all"
                target_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), "catalog"))
            page.goto(target_url, wait_until="domcontentloaded")
            page.wait_for_selector("#game-grid .game-card")
            if mobile:
                page.evaluate('document.querySelector("#catalog").scrollIntoView({block:"start", behavior:"instant"})')
                page.evaluate("() => new Promise(requestAnimationFrame)")
            page.evaluate("""async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => i.getBoundingClientRect().top < innerHeight).map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload=r; i.onerror=r; }))); }""")
            page.screenshot(path=str(OUT / f"product-{name}.png"), animations="disabled")
            context.close()
        browser.close()


def render(names):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    sizes = {"brand-sheet": (1600, 1800), "social-landscape": (1200, 630), "promo-portrait": (1080, 1350), "turbogames-mark": (512, 512), "turbogames-mark-dark": (512, 512), "turbogames-mark-mono": (512, 512), "logo-light": (1528, 288), "logo-dark": (1528, 288)}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for name in names:
            width, height = sizes[name]
            page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            artwork = (OUT / f"{name}.svg").read_text(encoding="utf-8")
            page.set_content(f'<html><head><style>svg{{width:100vw;height:100vh;display:block}}</style></head><body style="margin:0;overflow:hidden">{artwork}</body></html>', wait_until="load")
            page.screenshot(path=str(OUT / f"{name}.png"), omit_background=True)
            page.close()
            with Image.open(OUT / f"{name}.png") as image:
                assert image.size == (width, height), f"Unexpected export dimensions: {name}"
        browser.close()


def build_archive():
    from PIL import Image
    exports = sorted(path for path in OUT.iterdir() if path.is_file() and path.suffix in (".svg", ".png", ".md", ".txt") and path.name != "SHA256SUMS.txt")
    entries = []
    for path in exports:
        item = {
            "name": path.name,
            "path": f"/outputs/turbogames-brand-kit/{path.name}",
            "url": f"https://turbogames.vercel.app/outputs/turbogames-brand-kit/{path.name}",
            "type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        if path.suffix == ".png":
            with Image.open(path) as image:
                item["width"], item["height"] = image.size
        elif path.suffix == ".svg":
            element = ElementTree.parse(path).getroot()
            item["width"] = int(element.get("width"))
            item["height"] = int(element.get("height"))
        entries.append(item)
    write("asset-manifest.json", json.dumps({"version": 1, "base_url": "https://turbogames.vercel.app/outputs/turbogames-brand-kit/", "assets": entries}, indent=2) + "\n")
    files = exports + [OUT / "asset-manifest.json"]
    sums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in files)
    write("SHA256SUMS.txt", sums)
    with zipfile.ZipFile(OUT / "TurboGames-brand-kit.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files + [OUT / "SHA256SUMS.txt"]:
            archive.write(path, arcname=path.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture-url", help="Local redesigned app to capture before exporting campaign art")
    parser.add_argument("--brand-only", action="store_true", help="Export only original identity and visual guide")
    args = parser.parse_args()
    build_identity()
    build_brand_sheet()
    names = ["turbogames-mark", "turbogames-mark-dark", "turbogames-mark-mono", "logo-light", "logo-dark", "brand-sheet"]
    if not args.brand_only:
        if args.capture_url:
            capture(args.capture_url)
        names += build_campaign()
    write_docs()
    render(names)
    if not args.brand_only and len(names) == 8:
        build_archive()
    print(f"Exported {', '.join(names)} to {OUT}")


if __name__ == "__main__":
    main()
