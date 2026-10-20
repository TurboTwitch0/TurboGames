#!/usr/bin/env python3
"""Serve production headers and a temporary, TLS-verified mirror for Unity checks."""
import argparse, concurrent.futures, importlib.util, os, urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path('/tmp/turbogames-unity-assets')
BASE = 'https://cdn.jsdelivr.net/gh/bubblfan/web-port@master/yandere-simulator/Build/'
NAMES = ['UnityLoader.js', 'YandereSim.wasm.code.unityweb', 'YandereSim.wasm.framework.unityweb'] + [f'YandereSim.data.unityweb.part{i}' for i in range(1, 6)]
def download(name):
    dest = FIXTURES / 'Build' / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE + name, timeout=90) as response, dest.open('wb') as out:
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
    print(name, dest.stat().st_size, flush=True)
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    if args.download:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(download, NAMES))
    spec = importlib.util.spec_from_file_location('devserver', ROOT / 'tools/dev-server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    class Handler(module.Handler):
        def translate_path(self, path):
            if path.startswith('/__unity-test/'):
                target = (FIXTURES / path.split('?', 1)[0][len('/__unity-test/'):]).resolve()
                if not target.is_relative_to(FIXTURES.resolve()):
                    return str(FIXTURES / 'missing')
                return str(target)
            return super().translate_path(path)
        def end_headers(self):
            if self.path.startswith('/__unity-test/'):
                self.send_header('Access-Control-Allow-Origin', '*')
            super().end_headers()
    os.chdir(ROOT)
    ThreadingHTTPServer(('127.0.0.1', 8012), Handler).serve_forever()
