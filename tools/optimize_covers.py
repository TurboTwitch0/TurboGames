#!/usr/bin/env python3
"""Encode small, content-addressed catalog previews; preserve original artwork."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/covers/thumbs'
MANIFEST = ROOT / 'cover-thumbnails.json'
EDGE = 384
QUALITY = 82


def main():
    artwork = json.loads((ROOT / 'artwork.json').read_text())
    previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    previews = {}
    OUT.mkdir(parents=True, exist_ok=True)
    for record in artwork.values():
        source = record['image']
        if source in previews or Path(source).suffix.lower() == '.svg':
            continue
        raw = (ROOT / source).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        old = previous.get(source, {})
        if old.get('source_sha256') == digest and old.get('edge') == EDGE and old.get('quality') == QUALITY and (ROOT / old.get('image', '')).is_file():
            previews[source] = old
            continue
        with Image.open(io.BytesIO(raw)) as original:
            image = ImageOps.exif_transpose(original).convert('RGBA' if 'A' in original.getbands() else 'RGB')
            image.thumbnail((EDGE, EDGE), Image.Resampling.LANCZOS)
            encoded = io.BytesIO()
            image.save(encoded, format='WEBP', quality=QUALITY, method=4)
            data = encoded.getvalue()
            if len(data) >= len(raw) * .95:
                continue
            key = hashlib.sha256(raw + f'webp:{EDGE}:{QUALITY}:v1'.encode()).hexdigest()[:24]
            path = OUT / f'{key}.webp'
            path.write_bytes(data)
            previews[source] = {'image': path.relative_to(ROOT).as_posix(), 'source_sha256': digest, 'edge': EDGE, 'quality': QUALITY, 'width': image.width, 'height': image.height, 'source_bytes': len(raw), 'bytes': len(data)}
    MANIFEST.write_text(json.dumps(previews, indent=2) + '\n')
    before = sum(item['source_bytes'] for item in previews.values())
    after = sum(item['bytes'] for item in previews.values())
    report = {'optimized_previews': len(previews), 'original_bytes': before, 'preview_bytes': after, 'reduction_percent': round((1 - after / before) * 100, 1) if before else 0, 'method': '384px maximum edge, WebP82, unchanged source images and provenance; no synthetic artwork'}
    (ROOT / 'reports/cover-performance.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
