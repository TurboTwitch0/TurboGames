#!/usr/bin/env python3
"""Import matching emulator cover artwork from libretro-thumbnails.

Only public thumbnail assets are downloaded. Game launchers are read as data;
game code and ROM assets are never executed or downloaded by this script.
"""
from __future__ import annotations

import concurrent.futures
import functools
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import struct
import time
import unicodedata
from urllib.parse import quote, unquote, urlsplit, urljoin
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/covers/emulator'
CACHE = Path('/tmp/turbogames-emulator-art-cache')
OUTPUT = ROOT / 'artwork-emulator.json'
AGENT = 'TurboGames artwork importer; https://github.com/libretro-thumbnails'
PREVIOUS: dict = {}

SYSTEMS = {
    'n64': 'Nintendo_-_Nintendo_64',
    'gba': 'Nintendo_-_Game_Boy_Advance',
    'gb': 'Nintendo_-_Game_Boy',
    'gbc': 'Nintendo_-_Game_Boy_Color',
    'nds': 'Nintendo_-_Nintendo_DS',
    'nes': 'Nintendo_-_Nintendo_Entertainment_System',
    'snes': 'Nintendo_-_Super_Nintendo_Entertainment_System',
    'segaMD': 'Sega_-_Mega_Drive_-_Genesis',
    'segaGG': 'Sega_-_Game_Gear',
    'segaMS': 'Sega_-_Master_System_-_Mark_III',
    'segasaturn': 'Sega_-_Saturn',
    'psx': 'Sony_-_PlayStation',
    'arcade': 'MAME',
    'atari2600': 'Atari_-_2600',
    'atarilynx': 'Atari_-_Lynx',
    'jaguar': 'Atari_-_Jaguar',
    'Neo Geo Pocket': 'SNK_-_Neo_Geo_Pocket_Color',
    'Wonderswan': 'Bandai_-_WonderSwan_Color',
    'Genesis Plus': 'Sega_-_Mega-CD_-_Sega_CD',
    'C64': 'Commodore_-_64',
    'colecovision': 'Coleco_-_ColecoVision',
    'virtualboy': 'Nintendo_-_Virtual_Boy',
    'dos': 'DOS',
}
CORE_SYSTEM = {
    'n64': 'n64', 'gba': 'gba', 'gb': 'gb', 'gbc': 'gbc', 'nds': 'nds',
    'nes': 'nes', 'fceumm': 'nes', 'snes': 'snes', 'snes9x': 'snes',
    'segaMD': 'segaMD', 'segaGG': 'segaGG', 'segaMS': 'segaMS',
    'segaSaturn': 'segasaturn', 'psx': 'psx', 'mame2003': 'arcade',
    'arcade': 'arcade', 'mame2003_plus': 'arcade', 'atari2600': 'atari2600',
    'lynx': 'atarilynx', 'atariLynx': 'atarilynx', 'jaguar': 'jaguar',
    'atariJaguar': 'jaguar', 'ngp': 'Neo Geo Pocket', 'ws': 'Wonderswan',
    'virtualboy': 'virtualboy', 'vb': 'virtualboy', 'segaCD': 'Genesis Plus',
}


def fetch(url: str, retries: int = 3) -> bytes:
    for attempt in range(retries):
        try:
            with urlopen(Request(url, headers={'User-Agent': AGENT}), timeout=50) as response:
                return response.read(24 * 1024 * 1024)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(url)


@functools.lru_cache(maxsize=100000)
def normalize(value: str) -> str:
    value = unicodedata.normalize('NFKD', unquote(value)).encode('ascii', 'ignore').decode()
    value = re.sub(r'\.[a-z0-9]{2,5}$', '', value, flags=re.I)
    value = re.sub(r'\([^)]*\)|\[[^]]*\]', ' ', value)
    value = value.lower().replace('&', ' and ')
    value = re.sub(r'\b([ivx]+)\b', lambda m: {'ii':'2', 'iii':'3', 'iv':'4', 'v':'5', 'vi':'6', 'vii':'7', 'viii':'8', 'ix':'9', 'x':'10'}.get(m[1],m[1]), value)
    value = re.sub(r'[^a-z0-9]+', ' ', value).strip()
    value = re.sub(r'^the\s+|^a\s+', '', value)
    value = re.sub(r'\s+the$', '', value)
    return value.replace(' ', '')


def load_index(system: str) -> list[str]:
    repo = SYSTEMS[system]
    cache = CACHE / (repo + '.json')
    if cache.exists():
        return json.loads(cache.read_text())
    url = f'https://api.github.com/repos/libretro-thumbnails/{repo}/git/trees/master?recursive=1'
    try:
        data = json.loads(fetch(url))
        paths = [entry['path'] for entry in data.get('tree', []) if entry['path'].startswith('Named_Boxarts/') and entry['path'].lower().endswith(('.png', '.jpg', '.webp'))]
        if not paths:
            paths = [entry['path'] for entry in data.get('tree', []) if entry['path'].startswith('Named_Titles/') and entry['path'].lower().endswith(('.png', '.jpg', '.webp'))]
        cache.write_text(json.dumps(paths))
        return paths
    except Exception as error:
        print(f'Index unavailable {system}: {error}', flush=True)
        return []


def candidates(item: dict) -> tuple[str | None, list[str]]:
    source = ROOT / item['source']
    text = source.read_text(errors='replace') if source.exists() else ''
    folder = item['source'].split('/')[2]
    core = re.search(r'(?:EJS_core\s*=|core\s*:)\s*[\"\']([^\"\']+)', text)
    system = folder if folder in SYSTEMS else CORE_SYSTEM.get(core[1]) if core else None
    names = [item['title']]
    # Exact upstream ROM names often preserve the complete subtitle and region.
    rom = re.search(r'(?:EJS_gameUrl\s*=|url\s*:)\s*[\"\']([^\"\']+)', text)
    rom_name = unquote(urlsplit(rom[1]).path.rsplit('/', 1)[-1]) if rom else ''
    for pattern in [r'EJS_gameName\s*=\s*[\"\']([^\"\']+)', r'\bname\s*:\s*[\"\']([^\"\']+)']:
        match = re.search(pattern, text)
        if match:
            names.append(match[1])
    if rom_name and not re.search(r'\bpatched\b', rom_name, re.I):
        names.append(rom_name)
    basename = source.stem
    if basename.lower().startswith('cl'):
        basename = basename[2:]
    names.append(basename)
    return system, list(dict.fromkeys(names))


def select(names: list[str], paths: list[str]) -> str | None:
    lookup: dict[str, list[str]] = {}
    for path in paths:
        key = normalize(Path(path).stem)
        lookup.setdefault(key, []).append(path)
    def priority(path: str) -> tuple[int, int, int, str]:
        return (any(s in path for s in ['(Beta', '(Proto', '(Demo', '(Sample', '(Bonus Disc', '(Aftermarket', '(Unl)']), '(USA)' not in path, '(World)' not in path, path)
    title = names[0]
    title_key = normalize(title)
    title_words = re.sub(r'\([^)]*\)|\[[^]]*\]', '', title).split()
    # Descriptive catalog titles take precedence over template metadata. Some
    # launchers contain copied names or a patched ROM's original base-game name.
    allowed = [name for i, name in enumerate(names) if i == 0 or len(title_words) < 2 or title_key in normalize(name)]
    for name in allowed:
        key = normalize(name)
        if key in lookup:
            return sorted(lookup[key], key=priority)[0]
    # A missing subtitle is accepted only if the exact prefix identifies one game.
    # Do not use approximate spelling or match a sequel with a different number.
    for name in allowed:
        key = normalize(name)
        if len(key) < 10:
            continue
        matches = [k for k in lookup if k.startswith(key) and not re.match(r'^\d', k[len(key):]) and len(k) > len(key)]
        if len(matches) == 1 and not re.search(r'\b(hack|version|random|kaizo|remix)\b', name, re.I):
            return sorted(lookup[matches[0]], key=priority)[0]
    return None


def render(item: dict, system: str, path: str) -> tuple[str, dict] | None:
    destination = DEST / (hashlib.sha256((item['id'] + system + path).encode()).hexdigest()[:20] + '.webp')
    url = 'https://raw.githubusercontent.com/libretro-thumbnails/' + SYSTEMS[system] + '/master/' + quote(path, safe='/')
    try:
        previous = PREVIOUS.get(item['id'], {})
        if destination.exists() and previous.get('image') == destination.relative_to(ROOT).as_posix():
            url = previous.get('source', url)
        if not destination.exists() and previous.get('source') == url:
            previous_file = ROOT / previous.get('image', '')
            if previous_file.is_file():
                shutil.copyfile(previous_file, destination)
        if not destination.exists():
            # GitHub's raw endpoint returns a symlink target as plain text.
            # Follow only thumbnail-relative image links, never arbitrary content.
            for _ in range(6):
                payload = fetch(url)
                if len(payload) < 1024:
                    try:
                        pointer = payload.decode('utf-8').strip()
                    except UnicodeDecodeError:
                        pointer = ''
                    if re.fullmatch(r'[^\r\n:]+\.(?:png|jpg|webp)', pointer, re.I):
                        url = urljoin(url, quote(pointer, safe='/'))
                        continue
                break
            if payload.startswith(b'\x89PNG\r\n\x1a\n'):
                # A few upstream PNGs have a corrupt optional iCCP checksum.
                # Keep pixel/alpha chunks and let Pillow validate those normally.
                cleaned = bytearray(payload[:8])
                position = 8
                while position + 12 <= len(payload):
                    length = struct.unpack('>I', payload[position:position+4])[0]
                    end = position + length + 12
                    if end > len(payload):
                        break
                    kind = payload[position+4:position+8]
                    if kind in (b'IHDR', b'PLTE', b'tRNS', b'IDAT', b'IEND'):
                        cleaned.extend(payload[position:end])
                    position = end
                payload = bytes(cleaned)
            original = Image.open(io.BytesIO(payload)).convert('RGB')
            backdrop = ImageOps.fit(original, (512, 512)).filter(ImageFilter.GaussianBlur(28))
            backdrop = Image.blend(backdrop, Image.new('RGB', (512, 512), '#10172b'), .7)
            cover = ImageOps.contain(original, (456, 456), Image.Resampling.LANCZOS)
            x, y = (512-cover.width)//2, (512-cover.height)//2
            shadow = Image.new('RGBA', (512,512))
            ImageDraw.Draw(shadow).rounded_rectangle((x-5,y-2,x+cover.width+5,y+cover.height+8),radius=8,fill=(0,0,0,160))
            backdrop = Image.alpha_composite(backdrop.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(10)))
            backdrop.paste(cover, (x,y))
            backdrop.convert('RGB').save(destination, 'WEBP', quality=85, method=5)
        return item['id'], {
            'image': destination.relative_to(ROOT).as_posix(),
            'type': 'source-artwork',
            'source': url,
            'attribution': 'Game artwork belongs to its respective rights holders. Thumbnail source: libretro-thumbnails.'
        }
    except Exception as error:
        print(f'Cover unavailable {item["title"]}: {error}', flush=True)
        return None


def main() -> None:
    global PREVIOUS
    DEST.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        PREVIOUS = json.loads(OUTPUT.read_text())
    content = (ROOT/'catalog.js').read_text()
    catalog = json.loads(content[content.index('['):content.rfind(']')+1])
    entries = [item for item in catalog if item.get('category') == 'emulator']
    prepared = [(item, *candidates(item)) for item in entries]
    systems = sorted({system for _, system, _ in prepared if system})
    indexes = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(load_index, system): system for system in systems}
        for future in concurrent.futures.as_completed(futures):
            system = futures[future]
            indexes[system] = future.result()
            print(f'Index {system}: {len(indexes[system])} images', flush=True)
    jobs = []
    for item, system, names in prepared:
        path = select(names, indexes.get(system, []))
        if path:
            jobs.append((item, system, path))
    print(f'Matched {len(jobs)}/{len(entries)} emulator entries', flush=True)
    artwork = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        for result in executor.map(lambda args: render(*args), jobs):
            if result:
                artwork[result[0]] = result[1]
            if len(artwork) and len(artwork) % 100 == 0:
                OUTPUT.write_text(json.dumps(artwork, ensure_ascii=False, indent=2)+'\n')
                print(f'Saved {len(artwork)} emulator covers', flush=True)
    OUTPUT.write_text(json.dumps(artwork, ensure_ascii=False, indent=2)+'\n')
    print(f'Completed {len(artwork)} real emulator covers; output {OUTPUT}', flush=True)


if __name__ == '__main__':
    main()
