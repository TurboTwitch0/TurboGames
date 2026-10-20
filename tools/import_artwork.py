#!/usr/bin/env python3
"""Build local square catalog artwork from credited upstream art and illustrations.

Run: python3 tools/import_artwork.py [--offline] [--workers 12]
The source HTML is parsed as data; game JavaScript is never executed.
"""
import argparse
import concurrent.futures
import hashlib
import html
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import textwrap
import unicodedata
import urllib.parse
import urllib.request

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/turbogames-artwork-cache')
CACHE.mkdir(exist_ok=True)
USER_AGENT = 'TurboGames-artwork-import/1.0 (source attribution in artwork.json)'
# Reviewed generic engine/publisher icons are deliberately replaced with illustrations.
GENERIC_IMAGE_HASHES = {
    '3586674bc25d2e5ec8edaa4f0f91b4b7c85f21bcfb2e7a93de53d86e249edfd2',  # Godot robot
    '4b5135c725b9e22afca55e232013cc516ad679f9acf6357e4135c49ec8a153af',  # Portal sponsor logo
    'bd49464fe8e4cc6355e7c00f26dd7a42652b99819c6325a8ba2c980c8fd09f75',  # Ren'Py engine logo
    '63d2424a1188897df6874be6050cf2b5e1b8ea7dc7f08557155149d57e631697',  # Web-port author icon
}


def fetch(url, limit=15_000_000, timeout=18):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Image/catalog exceeds import size limit')
    return data


def get_json(url):
    cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if cache.exists():
        return json.loads(cache.read_text())
    data = fetch(url, limit=25_000_000, timeout=45)
    parsed = json.loads(data)
    cache.write_bytes(data)
    return parsed


def normalized(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    value = value.replace('&', 'and').replace('’', '').replace("'", '')
    return re.sub('[^a-z0-9]', '', value)


def keys(item):
    name = Path(item['source']).stem
    if name.startswith('cl'):
        name = name[2:]
    return {normalized(item['title']), normalized(name)} - {''}


def github_raw(url):
    match = re.match(r'https://cdn\.jsdelivr\.net/gh/([^/]+)/([^/@]+)(?:@([^/]+))?/(.*)', url)
    if match:
        owner, repo, ref, tail = match.groups()
        return f'https://raw.githubusercontent.com/{owner}/{repo}/{ref or "main"}/{tail}'
    return url


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.base = ''
        self.images = []
        self.remote = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'base' and a.get('href', '').startswith(('http://', 'https://')):
            self.base = a['href']
        if tag == 'meta' and a.get('property', a.get('name', '')).lower() in ('og:image', 'twitter:image'):
            self.images.append((100, a.get('content', '')))
        if tag == 'link' and 'icon' in a.get('rel', '').lower():
            score = 65 if 'apple-touch' in a.get('rel', '') else 25
            self.images.append((score, a.get('href', '')))
        if tag == 'img':
            src = a.get('src', '')
            if re.search(r'(?:cover|splash|thumbnail|og_image|game[_-]?logo|title|logo)', src, re.I):
                self.images.append((55, src))
        for name in ('href', 'src'):
            if a.get(name, '').startswith(('https://', 'http://')):
                self.remote.append(a[name])


def load_upstream_indexes():
    mapping = {}
    try:
        for item in get_json('https://raw.githubusercontent.com/gn-math/assets/main/zones.json'):
            if item.get('id', -1) < 0 or not item.get('cover'):
                continue
            url = item['cover'].replace('{COVER_URL}', 'https://raw.githubusercontent.com/gn-math/covers/main')
            mapping.setdefault(normalized(item['name']), []).append((110, url, f"Game artwork from GN Math cover catalog; creator: {item.get('author', 'see source game')}", 'source-artwork'))
    except Exception as error:
        print('GN Math catalog unavailable:', error, flush=True)
    try:
        for item in get_json('https://raw.githubusercontent.com/3kh0/3kh0-lite/main/config/games.json'):
            url = 'https://raw.githubusercontent.com/3kh0/3kh0-lite/main/' + item['imgSrc']
            mapping.setdefault(normalized(item['title']), []).append((100, url, 'Game artwork from 3kh0-lite project catalog; rights remain with game creators', 'source-artwork'))
    except Exception as error:
        print('3kh0 catalog unavailable:', error, flush=True)
    # Only consider recognizable cover/icon/title images from the source asset tree.
    folder_images = {}
    try:
        tree = get_json('https://api.github.com/repos/bubbls/UGS-Assets/git/trees/main?recursive=1')['tree']
        for row in tree:
            path = row['path']
            if not path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                continue
            filename = Path(path).name.lower()
            if re.search(r'(?:unity|webgl|progress|discord|loadingbar|rotate|button|cursor|badge|arrow|publisher|poki|sponsor|avix)', filename):
                continue
            score = 0
            if re.search(r'(?:thumb|cover|og_image|splash|presplash)', filename):
                score = 85
            elif re.search(r'(?:icon[-_]?512|icon[-_]?256|appicon|apple-touch)', filename):
                score = 75
            elif re.match(r'(?:logo|game[_-]?logo|title|icon)\.(?:png|jpg|webp)$', filename):
                score = 65
            if score:
                top = path.split('/')[0]
                folder_images.setdefault(normalized(top.removesuffix('-main')), []).append((score, 'https://raw.githubusercontent.com/bubbls/UGS-Assets/main/' + urllib.parse.quote(path), 'Artwork from the UGS game asset repository; rights remain with respective game creators', 'source-artwork'))
    except Exception as error:
        print('UGS asset index unavailable:', error, flush=True)
    # Exact title variants used by the imported UGS catalog.
    for alias, canonical in {'run': 'run1', 'baldisbasicsremastered': 'baldisbasicsclassicremastered', 'fnfseekscooldeltarune': 'fridaynightfunkinvsseekscooldeltarune', 'animalcrossinggamecubeport': 'animalcrossinggamecube'}.items():
        if canonical in mapping:
            mapping.setdefault(alias, []).extend(mapping[canonical])
    mapping.setdefault('deltarune', []).insert(0, (120, 'https://deltarune.com/assets/images/social-logo.png', 'DELTARUNE official website social artwork; © Toby Fox', 'source-artwork'))
    for title, url, credit in [
        ('N', 'https://www.thewayoftheninja.org/images/PlayOnline.gif', 'N game screenshot from the official Metanet Software website: https://www.thewayoftheninja.org/n.html'),
        ('Burrito Bison', 'https://cdn2.kongcdn.com/game_icons/0020/6852/burrito_thumb_125-100.png', 'Burrito Bison game icon from its Kongregate page; © Juicy Beast'),
        ('Burrito Bison Revenge', 'https://cdn3.kongcdn.com/game_icons/0044/9272/bb2_250x200.png', 'Burrito Bison Revenge game icon from its Kongregate page; © Juicy Beast'),
        ('Doki Doki Literature Club', 'https://cdn.akamai.steamstatic.com/steam/apps/698780/header.jpg', 'Doki Doki Literature Club Steam store header artwork; © Team Salvato'),
    ]:
        mapping.setdefault(normalized(title), []).insert(0, (120, url, credit, 'source-artwork'))
    return mapping, folder_images


def discover_web_art(item):
    """Look up public game pages; use images only when the page title matches."""
    title = item['title']
    if item['category'] not in ('games', 'flash') or len(title) < 3:
        return []
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode().lower().replace("'", '').replace('’', '').replace('&', 'and')).strip('-')
    if not slug:
        return []
    found = []
    for domain, prefix, credit in [('crazygames.com', 'https://www.crazygames.com/game/', 'CrazyGames'), ('poki.com', 'https://poki.com/en/g/', 'Poki')]:
        page_url = prefix + slug
        cache = CACHE / ('page-' + hashlib.sha256(page_url.encode()).hexdigest() + '.json')
        if cache.exists():
            found.extend(json.loads(cache.read_text()))
            if found:
                break
            continue
        result = []
        try:
            page = fetch(page_url, limit=2_000_000, timeout=10).decode('utf-8', errors='replace')
            tags = re.findall(r'<meta\b[^>]*>', page, re.I)
            values = {}
            for tag in tags:
                attrs = dict((key.lower(), html.unescape(value)) for key, _, value in re.findall(r'([\w:-]+)\s*=\s*([\"\'])(.*?)\2', tag, re.S))
                key = attrs.get('property', attrs.get('name', ''))
                if key and 'content' in attrs:
                    values[key] = attrs['content']
            page_title = normalized(values.get('og:title', ''))
            target = normalized(title)
            # A 404 page or redirect to a related title must never become artwork.
            canonical = urllib.parse.urlparse(values.get('og:url', '')).path.rstrip('/')
            requested = urllib.parse.urlparse(page_url).path.rstrip('/')
            if page_title.startswith(target) and canonical == requested and values.get('og:image', '').startswith('https://'):
                result.append((90, values['og:image'], f'Artwork from the {credit} page for {title}: {page_url}; rights remain with the game creator', 'source-artwork'))
        except Exception:
            pass
        cache.write_text(json.dumps(result))
        found.extend(result)
        if found:
            break
    return found


def candidates(item, mapping, folder_images):
    found = []
    for key in keys(item):
        found.extend(mapping.get(key, []))
        found.extend(folder_images.get(key, []))
    if item['category'] != 'emulator':
        source = ROOT / item['source']
        if source.exists():
            # A few games contain inline binary payloads. Metadata is in the opening HTML.
            with source.open(encoding='utf-8', errors='replace') as stream:
                data = stream.read(350_000)
            parser = MetadataParser()
            try:
                parser.feed(data)
            except Exception:
                pass
            base = parser.base
            if not base:
                for url in parser.remote:
                    if 'cdn.jsdelivr.net/gh/' in url or 'raw.githubusercontent.com' in url:
                        base = url.rsplit('/', 1)[0] + '/'
                        break
            for score, image in parser.images:
                if re.search(r'(?:unity|webgl|progress|discord|favicon\.ico|loadingbar)', image, re.I):
                    continue
                if image.startswith('data:image/'):
                    continue
                if image.startswith(('https://', 'http://')):
                    url = image
                elif base:
                    url = urllib.parse.urljoin(base, image)
                else:
                    continue
                found.append((score, github_raw(url), 'Game icon or artwork referenced by the imported game HTML; rights remain with game creator', 'source-artwork'))
            for url in parser.remote + [base]:
                match = re.search(r'githubusercontent\.com/bubbls/UGS-Assets/[^/]+/([^/]+)|jsdelivr\.net/gh/bubbls/UGS-Assets@[^/]+/([^/]+)', url)
                if match:
                    folder = urllib.parse.unquote(next(value for value in match.groups() if value))
                    found.extend(folder_images.get(normalized(folder), []))
    seen = set()
    result = []
    for row in sorted(found, key=lambda row: row[0], reverse=True):
        if row[1] not in seen and row[1].startswith(('http://', 'https://')):
            seen.add(row[1])
            result.append(row)
    return result[:7]


def image_path(item, kind, extension):
    slug = re.sub('[^a-z0-9]+', '-', item['title'].lower()).strip('-')[:45] or 'game'
    key = hashlib.sha256(item['id'].encode()).hexdigest()[:12]
    return Path('assets/covers') / kind / f'{slug}-{key}.{extension}'


def square_image(data, path):
    image = Image.open(io.BytesIO(data))
    image.seek(0)
    if max(image.size) < 50 or min(image.size) < 32:
        raise ValueError('Icon too small for a game card')
    if image.width > 15000 or image.height > 15000:
        raise ValueError('Image dimensions too large')
    image = image.convert('RGBA')
    background = Image.new('RGB', image.size, '#10172b')
    background.paste(image, mask=image.getchannel('A'))
    backdrop = ImageOps.fit(background, (512, 512), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(18))
    backdrop = Image.blend(backdrop, Image.new('RGB', (512, 512), '#0c1227'), .35)
    fitted = ImageOps.contain(background, (512, 512), Image.Resampling.LANCZOS)
    backdrop.paste(fitted, ((512 - fitted.width) // 2, (512 - fitted.height) // 2))
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    backdrop.save(ROOT / path, 'WEBP', quality=86, method=4)
    if hashlib.sha256((ROOT / path).read_bytes()).hexdigest() in GENERIC_IMAGE_HASHES:
        (ROOT / path).unlink()
        raise ValueError('Generic engine/publisher logo is not game artwork')


def motif_for(item):
    name = item['title'].lower()
    for words, motif in [
        ('car|race|racing|drive|drift|road|rally|taxi|truck|kart|moto|wheel|traffic', 'race'),
        ('basket|soccer|football|tennis|golf|sport|baseball|volley|hockey|pool|billiard', 'sport'),
        ('space|orbit|star|galax|alien|asteroid|rocket|invader|astr', 'space'),
        ('puzzle|match|2048|sudoku|tetris|tile|slices|chess|checkers|connect|mahjong|word|number', 'puzzle'),
        ('cookie|burger|pizza|cooking|food|cafe|restaurant|pancake|taco|burrito|papas', 'food'),
        ('horror|scary|fnaf|freddy|granny|baldi|evil|zombie|dead|night|haunted|backroom|dark', 'horror'),
        ('sonic|speed|run|dash|jump|platform|mario|kirby|adventure|zelda|metroid|dungeon', 'platform'),
        ('pokemon|pokémon|monster|dragon|dino|animal|cat|dog|panda|cattle|sheep|fish', 'creature'),
        ('shoot|gun|war|battle|combat|strike|doom|quake|fight|tank|soldier|sniper|madness', 'battle'),
        ('music|rhythm|fnf|friday|piano|beat|song|dance|guitar', 'music'),
        ('paint|draw|art|photo|design', 'art'),
    ]:
        if re.search(words, name):
            return motif
    if item['category'] in ('apps', 'misc'):
        return 'app'
    return {'emulator': 'console', 'flash': 'arcade'}.get(item['category'], 'adventure')


def illustration(item):
    seed = int(hashlib.sha256(item['id'].encode()).hexdigest()[:8], 16)
    hue = seed % 360
    hue2 = (hue + 46) % 360
    colors = (f'hsl({hue},76%,58%)', f'hsl({hue2},86%,67%)')
    a, b = colors
    motif = motif_for(item)
    common = '<g stroke="#eef7ff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">'
    art = {
        'race': f'<path d="M145 396 218 157h76l78 239" fill="#172840"/><path d="M255 183v34m0 28v34m0 28v34" stroke="#fff" stroke-width="7"/><g transform="rotate(-13 256 280)"><rect x="184" y="236" width="143" height="98" rx="25" fill="{b}"/><path d="m211 238 22-39h63l23 42" fill="{a}"/><path d="M238 212h48l12 26h-72" fill="#bdf3ff"/><circle cx="214" cy="334" r="22" fill="#142037"/><circle cx="304" cy="334" r="22" fill="#142037"/><path d="M157 263h-55m47 38H84" stroke="{b}" stroke-width="10"/></g>',
        'sport': f'<path d="M87 335c94-86 244-86 338 0" fill="none" stroke="{a}" stroke-width="10"/><circle cx="255" cy="246" r="90" fill="{b}"/><path d="M255 156v180m-90-90h180M191 183c90 26 90 100 0 126m128-126c-90 26-90 100 0 126" fill="none" stroke="#172540" stroke-width="8"/><path d="m109 181 29-50m244 50-29-50" stroke="{b}" stroke-width="10"/>',
        'space': f'<circle cx="150" cy="200" r="60" fill="{a}"/><ellipse cx="150" cy="200" rx="103" ry="20" transform="rotate(-20 150 200)" fill="none" stroke="{b}" stroke-width="12"/><g transform="rotate(28 313 259)"><path d="M276 301c-21-73-7-132 38-164 46 32 60 91 38 164" fill="#e7f7ff"/><path d="m279 275-36 60 41-17m63-43 36 60-41-17" fill="{a}"/><circle cx="315" cy="227" r="21" fill="{a}"/><path d="m296 314 18 66 20-66" fill="{b}"/></g>',
        'puzzle': f'<rect x="128" y="150" width="115" height="115" rx="18" fill="{a}"/><rect x="260" y="150" width="115" height="115" rx="18" fill="{b}"/><rect x="128" y="283" width="115" height="115" rx="18" fill="{b}"/><path d="M276 296h91v87h-91z" transform="rotate(13 322 340)" fill="{a}"/><path d="m166 206 17 17 29-35m80 18h54m-27-27v54m-150 104h38" stroke="#162440" stroke-width="10"/>',
        'food': f'<path d="M139 244c6-72 226-72 233 0Z" fill="{b}"/><path d="M145 255h220v33H145z" fill="#6fd69b"/><path d="m142 289 40 25 49-18 39 20 49-18 48 16v28H142z" fill="{a}"/><rect x="146" y="334" width="220" height="44" rx="20" fill="{b}"/><path d="m189 213 4-5m65-5 4-5m55 18 4-5" stroke="#fff7d2" stroke-width="7"/><path d="M149 155q-24-25 0-47m107 34q-24-25 0-47m107 60q-24-25 0-47" fill="none" stroke="{a}" stroke-width="8"/>',
        'horror': f'<path d="M147 362V239c0-127 216-127 216 0v123l-45-27-43 35-43-35-44 27-41-22" fill="{a}"/><ellipse cx="212" cy="241" rx="22" ry="30" fill="#10192c"/><ellipse cx="304" cy="241" rx="22" ry="30" fill="#10192c"/><path d="m236 304 21-15 23 15" fill="none" stroke="#10192c" stroke-width="12"/><path d="m111 161-15-31m309 22 16-31" stroke="{b}" stroke-width="10"/>',
        'platform': f'<path d="M55 368h148v32H55m270-105h132v31H325m-92-96h81v29h-81" stroke="{a}" stroke-width="12"/><g transform="rotate(12 251 300)"><rect x="221" y="251" width="68" height="85" rx="22" fill="{b}"/><circle cx="252" cy="224" r="35" fill="{a}"/><path d="m235 336-25 34m64-34 26 26m-76-92-45 20m108-15 28-32" stroke="{b}" stroke-width="18"/><circle cx="265" cy="219" r="6" fill="#15203a"/></g><path d="m120 213 8-20 8 20 21 3-16 14 4 21-17-11-18 11 4-21-16-14Z" fill="{b}"/>',
        'creature': f'<path d="m151 215-13-77 79 48m79 0 77-48-14 77" fill="{b}"/><ellipse cx="255" cy="273" rx="119" ry="106" fill="{a}"/><ellipse cx="213" cy="261" rx="13" ry="20" fill="#13213a"/><ellipse cx="299" cy="261" rx="13" ry="20" fill="#13213a"/><path d="m242 297 14 10 15-10m-15 10v17m0 0q-24 21-40 0m40 0q24 21 40 0" fill="none" stroke="#13213a" stroke-width="8"/><circle cx="182" cy="295" r="16" fill="{b}"/><circle cx="330" cy="295" r="16" fill="{b}"/>',
        'battle': f'<path d="m256 147 101 37v91c0 59-55 99-101 116-46-17-101-57-101-116v-91Z" fill="{a}"/><path d="m256 178 70 26v69c0 41-36 73-70 87-34-14-70-46-70-87v-69Z" fill="#162744"/><path d="m207 323 106-119m-9 6 20-10-6 23M217 312l-18 20m88-8-80-115m5-1-18-9 5 23m80 91 16 22" fill="none" stroke="{b}" stroke-width="16"/>',
        'music': f'<path d="M216 309V164l149-34v144" fill="none" stroke="{a}" stroke-width="17"/><path d="m223 190 134-30" stroke="{b}" stroke-width="16"/><ellipse cx="185" cy="320" rx="43" ry="32" transform="rotate(-16 185 320)" fill="{b}"/><ellipse cx="335" cy="287" rx="43" ry="32" transform="rotate(-16 335 287)" fill="{b}"/><path d="M84 254v62m24-82v102m24-65v26m275-34v60m24-82v101" stroke="{a}" stroke-width="9"/>',
        'art': f'<ellipse cx="245" cy="273" rx="119" ry="105" fill="{b}"/><circle cx="186" cy="238" r="18" fill="#7c6bff"/><circle cx="244" cy="210" r="18" fill="#ff8f9e"/><circle cx="304" cy="239" r="18" fill="#62d5c6"/><circle cx="177" cy="298" r="18" fill="#17233b"/><path d="m286 329 74-155 25 13-76 153" fill="{a}"/><path d="m287 328-19 47 42-32" fill="#eef7ff"/>',
        'app': f'<rect x="123" y="170" width="267" height="190" rx="26" fill="#172742"/><path d="M123 211h267" stroke="{a}" stroke-width="9"/><circle cx="148" cy="191" r="6" fill="{b}"/><circle cx="168" cy="191" r="6" fill="{a}"/><path d="m202 252-28 24 28 24m104-48 28 24-28 24m-42-58-17 70" stroke="{b}" stroke-width="12" fill="none"/><path d="M215 362v27m80-27v27m-105 1h130" stroke="{a}" stroke-width="12"/>',
        'console': f'<path d="M166 213h180c28 0 48 22 55 50l20 80c8 35-30 50-51 22l-30-35H172l-30 35c-21 28-59 13-51-22l20-80c7-28 27-50 55-50" fill="{a}"/><path d="M175 248v58m-29-29h58" stroke="#17233b" stroke-width="16"/><circle cx="327" cy="261" r="13" fill="{b}"/><circle cx="356" cy="289" r="13" fill="{b}"/><path d="M229 278h54m-27-65v-45q0-26 28-26" stroke="{b}" stroke-width="10" fill="none"/>',
        'arcade': f'<path d="M162 128h189l19 217 19 51H125l20-51Z" fill="{a}"/><rect x="180" y="165" width="153" height="137" rx="12" fill="#101d36"/><path d="M205 277v-55l24 24 25-30 25 30 24-24v55" fill="{b}"/><path d="M153 330h205" stroke="{b}" stroke-width="12"/><circle cx="205" cy="352" r="12" fill="#14213a"/><circle cx="300" cy="353" r="9" fill="{b}"/><circle cx="326" cy="353" r="9" fill="{b}"/>',
        'adventure': f'<circle cx="336" cy="185" r="47" fill="{b}"/><path d="m66 373 128-190 84 128 49-61 120 123" fill="{a}"/><path d="m163 229 31-46 32 47-29-16Z" fill="#e9f6ff"/><path d="M257 384q-61-40-6-70t-6-59" stroke="{b}" stroke-width="16" fill="none"/><path d="M80 180h85m-49-18h78" stroke="{a}" stroke-width="9"/>',
    }[motif]
    # Each illustration carries the complete title, wrapping instead of truncating.
    title = item['title']
    lines = textwrap.wrap(title, width=24, break_long_words=True, break_on_hyphens=False) or [title]
    font = max(16, min(31, 112 // max(len(lines), 1)))
    y0 = 447 - max(0, len(lines) - 1) * font / 2
    labels = ''.join(f'<text x="256" y="{y0+i*(font+5):.1f}" text-anchor="middle" fill="#f4f8ff" font-family="system-ui,Arial,sans-serif" font-weight="800" font-size="{font}">{html.escape(line)}</text>' for i, line in enumerate(lines))
    stars = ''.join(f'<circle cx="{58+(seed//(i+1)*17)%397}" cy="{55+(seed//(i+2)*13)%300}" r="{2+i%3}" fill="#fff" opacity=".25"/>' for i in range(12))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Illustrated artwork for {html.escape(title, quote=True)}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="hsl({hue},48%,19%)"/><stop offset="1" stop-color="#0d1429"/></linearGradient><radialGradient id="glow"><stop stop-color="{a}" stop-opacity=".22"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#000" flood-opacity=".25"/></filter></defs><rect width="512" height="512" rx="32" fill="url(#bg)"/><circle cx="256" cy="239" r="218" fill="url(#glow)"/>{stars}<circle cx="256" cy="259" r="160" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="2"/><g filter="url(#shadow)">{art}</g><rect y="409" width="512" height="103" fill="#0b1125" fill-opacity=".86"/>{labels}<text x="256" y="47" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="4" fill="#fff" opacity=".5">TURBOGAMES</text></svg>'''
    path = image_path(item, 'illustrated', 'svg')
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_text(svg)
    return {'image': path.as_posix(), 'type': 'illustrated', 'source': 'tools/import_artwork.py', 'attribution': 'Original TurboGames category illustration; not official game cover artwork', 'motif': motif}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Keep existing source images and generate illustrations without remote requests')
    parser.add_argument('--workers', type=int, default=12)
    parser.add_argument('--discover-web', action='store_true', help='Also search exact CrazyGames/Poki game pages for remaining game artwork')
    args = parser.parse_args()
    text = (ROOT / 'catalog.js').read_text()
    catalog = json.loads(text[text.index('['):text.rindex(']') + 1])
    output = ROOT / 'artwork.json'
    previous = json.loads(output.read_text()) if output.exists() else {}
    extra_path = ROOT / 'artwork-emulator.json'
    if extra_path.exists():
        previous.update(json.loads(extra_path.read_text()))
    mapping, folder_images = ({}, {}) if args.offline else load_upstream_indexes()
    results = {}

    def process(item):
        existing = previous.get(item['id'])
        if existing and existing.get('type') == 'source-artwork' and (ROOT / existing['image']).exists() and hashlib.sha256((ROOT / existing['image']).read_bytes()).hexdigest() not in GENERIC_IMAGE_HASHES:
            return item['id'], existing
        if not args.offline:
            for _, url, attribution, kind in candidates(item, mapping, folder_images):
                try:
                    data = fetch(url)
                    path = image_path(item, 'downloaded', 'webp')
                    square_image(data, path)
                    return item['id'], {'image': path.as_posix(), 'type': kind, 'source': url, 'attribution': attribution}
                except Exception:
                    continue
            if args.discover_web:
                for _, url, attribution, kind in discover_web_art(item):
                    try:
                        data = fetch(url)
                        path = image_path(item, 'downloaded', 'webp')
                        square_image(data, path)
                        return item['id'], {'image': path.as_posix(), 'type': kind, 'source': url, 'attribution': attribution}
                    except Exception:
                        continue
        return item['id'], illustration(item)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process, item): item for item in catalog}
        for future in concurrent.futures.as_completed(futures):
            key, row = future.result()
            results[key] = row
            if len(results) % 100 == 0:
                print(f'Artwork {len(results)}/{len(catalog)}; source images {sum(x["type"] == "source-artwork" for x in results.values())}', flush=True)
    # Preserve stable catalog order for readable diffs and deterministic packaging.
    results = {item['id']: results[item['id']] for item in catalog}
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    counts = {}
    for row in results.values():
        counts[row['type']] = counts.get(row['type'], 0) + 1
    print(json.dumps({'entries': len(results), 'counts': counts}, indent=2), flush=True)


if __name__ == '__main__':
    main()
