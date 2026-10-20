#!/usr/bin/env python3
"""Serve TurboGames with its deployed _headers rules, including asset CORS."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
from fnmatch import fnmatchcase
import argparse, os
ROOT = Path(__file__).resolve().parent.parent

def configured_headers(path):
    matched = False
    result = {}
    for line in (ROOT / '_headers').read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if not line[0].isspace():
            matched = fnmatchcase(path, line.strip())
        elif matched and ':' in line:
            key, value = line.strip().split(':', 1)
            result[key] = value.strip()
    return result

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        for key, value in configured_headers(urlsplit(self.path).path).items():
            self.send_header(key, value)
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    os.chdir(ROOT)
    print(f'TurboGames: http://{args.bind}:{args.port}', flush=True)
    ThreadingHTTPServer((args.bind, args.port), Handler).serve_forever()
