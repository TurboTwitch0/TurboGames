# TurboGames brand & launch kit

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
| `product-showcase-mobile.png` | Actual mobile featured game stage, scrolled into view; 390 × 844 |
| `product-discovery.png` | Actual collection quick-pick preview for Orbit Breaker; 1440 × 1040 |
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

To refresh vectors and PNGs using existing screenshots, omit `--capture-url`. `--brand-only` exports the identity and style guide without capturing or using product screenshots. `--showcase-only` refreshes screenshots and campaign exports while preserving the existing identity, style guide and launch copy; it also writes `showcase-update.json` with changed export paths, public URLs and hashes.

The generator uses local Python `fontTools`, Pillow, Playwright, installed DejaVu fonts, and `/usr/bin/chromium`. The capture waits for the local catalog and cover images, then records the desktop landing view, mobile All collection scrolled to the catalog, mobile featured game stage scrolled into view, and an Orbit Breaker quick-pick preview, with no fictional controls or substituted game imagery. Each capture uses a fresh browser profile. No paid service, hosted design vendor or external publishing is involved. The decorative frame and geometric stripes are artwork; the visible app interfaces are actual screenshots.

## Rights and claims

The logo geometry, palette arrangement, campaign layouts and launch copy were created for this TurboGames redesign. Existing title artwork visible in product screenshots belongs to its respective creators; these exports do not transfer game, artwork or trademark rights. Follow the repository's existing source and attribution records before external promotion of third party titles. Outlined lettering uses the installed open DejaVu Sans family; its license is included. No font file is bundled.

The product has 3,099 catalog entries at export time. Search follows the selected category. Saved and Recent stay in the current browser and do not sync. Player compatibility and source availability vary by title. These assets promise no accounts, AI features or guaranteed availability of every game. Copy is in `launch-copy.md`. The generator writes local files; publishing is handled separately.
