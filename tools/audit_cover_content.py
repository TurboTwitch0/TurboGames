#!/usr/bin/env python3
"""Audit local covers for visible loader/error/blank imagery without changing art."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUT = Path("/tmp/turbo-cover-audit")
BAD = [
    (r"\b(?:loading|downloading|initializing|preparing)\b", "visible-loading-text"),
    (r"\b(?:ruffle|emulatorjs|unity webgl|webgl player)\b", "visible-engine-interface"),
    (r"(?:failed to|could not|unable to)\s*(?:load|fetch|download|start)", "visible-load-error"),
    (r"\b(?:network error|404 not found|access denied|something went wrong|script error|panic)\b", "visible-error-screen"),
    (r"(?:click|press|tap)\s+(?:here|anywhere)?\s*to\s*(?:play|start|load)", "visible-launcher-prompt"),
    (r"\bplease wait\b", "visible-wait-prompt"),
]


def analyze(path):
    info = {"path": path, "reasons": []}
    p = ROOT / path
    if p.suffix.lower() == ".svg":
        info["kind"] = "illustration"
        return info
    try:
        image = Image.open(p).convert("RGB")
        info["size"] = list(image.size)
        small = ImageOps.fit(image, (64, 64))
        info["hash"] = hashlib.sha256(image.tobytes()).hexdigest()
        gray = small.convert("L")
        data = list(gray.tobytes())
        info["entropy"] = round(gray.entropy(), 2)
        info["dark_fraction"] = round(sum(v < 20 for v in data) / len(data), 3)
        info["light_fraction"] = round(sum(v > 242 for v in data) / len(data), 3)
        if info["entropy"] < 1.7 and max(info["dark_fraction"], info["light_fraction"]) > .88:
            info["reasons"].append("nearly-blank-image")
        if min(image.size) < 64:
            info["reasons"].append("tiny-source-image")
        # OCR sees large loader/interface text, regardless of DOM/canvas implementation.
        probe = ImageOps.contain(image, (480, 480))
        buffer = io.BytesIO(); probe.save(buffer, "PNG")
        proc = subprocess.run(
            ["tesseract", "stdin", "stdout", "--psm", "11"],
            input=buffer.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=18, env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        )
        text = re.sub(r"\s+", " ", proc.stdout.decode(errors="replace")).strip()
        info["ocr"] = text[:280]
        for pattern, reason in BAD:
            if re.search(pattern, text, re.I):
                info["reasons"].append(reason)
        words = re.sub("[^a-z0-9]", "", text.lower())
        if words in {"nintendo", "gameboy", "gameboyadvance", "nintendogameboyadvance", "unity", "godot", "renpy"}:
            info["reasons"].append("engine-or-console-boot-logo")
    except Exception as error:
        info["reasons"].append("image-analysis-failed")
        info["error"] = str(error)[:180]
    return info


def contact_sheet(rows, output, columns=8, width=170):
    height = width + 40
    sheet = Image.new("RGB", (columns * width, math.ceil(len(rows) / columns) * height), "#222229")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        x, y = i % columns * width, i // columns * height
        try:
            art = Image.open(ROOT / row["image"]).convert("RGB")
            thumb = ImageOps.contain(art, (width - 8, width - 8))
            sheet.paste(thumb, (x + (width - thumb.width) // 2, y + (width - thumb.height) // 2))
        except Exception:
            draw.text((x + 5, y + 50), "SVG / unavailable", fill="#dddddd")
        draw.text((x + 5, y + width), str(row["index"]) + " " + row["title"][:21], fill="white")
        draw.text((x + 5, y + width + 15), ",".join(row.get("reasons", []))[:25], fill="#f1be72")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=88)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--output", type=Path, default=ROOT / "reports/cover-loading-audit-before.json")
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    items = json.loads((ROOT / "catalog.js").read_text().split("=", 1)[1].strip().rstrip(";"))
    artwork = json.loads((ROOT / "artwork.json").read_text())
    images = sorted({artwork[i["id"]]["image"] for i in items})
    info = {}
    with ThreadPoolExecutor(args.workers) as pool:
        for n, result in enumerate(pool.map(analyze, images), 1):
            info[result["path"]] = result
            if n % 200 == 0:
                print("Analyzed", n, "/", len(images), flush=True)
    duplicates = defaultdict(list)
    for path, row in info.items():
        if row.get("hash"):
            duplicates[row["hash"]].append(path)
    for paths in duplicates.values():
        if len(paths) >= 5:
            for path in paths:
                info[path]["reasons"].append("repeated-identical-cover")
    rows = []
    for index, item in enumerate(items):
        art = artwork[item["id"]]
        image = info[art["image"]]
        row = {
            "index": index, "id": item["id"], "title": item["title"], "category": item["category"],
            "image": art["image"], "capture_type": art.get("captureType"),
            "reasons": image["reasons"], "ocr": image.get("ocr", ""),
            "entropy": image.get("entropy"), "dark_fraction": image.get("dark_fraction"),
            "priority": "replace" if image["reasons"] else ("review-capture" if art.get("captureType") else "no-loader-detected"),
        }
        if art.get("type") == "illustrated":
            row["priority"] = "illustration-not-official-art"
        rows.append(row)
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "method": "OCR and image-statistics audit of all current local artwork, with contact sheets for visual review. Flags require human interpretation; no images changed.",
        "catalog_entries": len(items), "unique_images": len(images),
        "flagged": sum(bool(r["reasons"]) for r in rows),
        "capture_entries": sum(bool(r["capture_type"]) for r in rows),
        "reasons": dict(Counter(reason for row in rows for reason in row["reasons"])),
        "entries": rows,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    flagged = [r for r in rows if r["reasons"]]
    for label, selected in [
        ("flagged", flagged),
        ("capture-games", [r for r in rows if r["category"] == "games" and r["capture_type"]]),
        ("capture-flash", [r for r in rows if r["category"] == "flash" and r["capture_type"]]),
        ("capture-emulator", [r for r in rows if r["category"] == "emulator" and r["capture_type"]]),
        ("apps", [r for r in rows if r["category"] in {"apps", "misc"}]),
    ]:
        for i in range(0, len(selected), 64):
            contact_sheet(selected[i:i + 64], OUT / (label + "-" + str(i // 64) + ".jpg"))
    (OUT / "rows.json").write_text(json.dumps(rows))
    print(json.dumps({k: v for k, v in report.items() if k != "entries"}, indent=2))


if __name__ == "__main__":
    main()
