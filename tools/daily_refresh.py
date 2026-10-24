#!/usr/bin/env python3
"""Refresh the existing catalog and check source health without executing games."""
from __future__ import annotations
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from audit_library import Resources, audit

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ("googletagmanager", "google-analytics", "doubleclick", "cloudflareinsights")
CONFIG_URL = re.compile(r"""\b(dataUrl|codeUrl|frameworkUrl|wasmCodeUrl|wasmFrameworkUrl|EJS_gameUrl|SWF_URL)\s*[:=]\s*(["'])(https?://(?:\\.|(?!\2)[^\\])*)\2""")


def read_catalog(root):
    return json.loads((root / "catalog.js").read_text(encoding="utf8").split("=", 1)[1].strip().rstrip(";"))


def local_path(root, source):
    path = (root / source).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Reference leaves repository: " + source)
    return path


def validate_catalog(root, items):
    problems, seen = [], set()
    for item in items:
        name = item.get("id", "<missing id>")
        if name in seen:
            problems.append({"source": name, "kind": "duplicate-catalog-id"})
        seen.add(name)
        for field in ("source", "image"):
            value = item.get(field)
            if not isinstance(value, str) or not value:
                problems.append({"source": name, "kind": "missing-" + field})
                continue
            try:
                if not local_path(root, value).is_file():
                    problems.append({"source": name, "kind": "missing-" + field, "path": value})
            except ValueError as error:
                problems.append({"source": name, "kind": "invalid-" + field, "detail": str(error)})
    return problems


def public_url(value):
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        if parsed.scheme not in ("http", "https") or not host or parsed.username or parsed.password:
            return None
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            if "." not in host:
                return None
        if any(token in value.lower() for token in TRACKERS):
            return None
        if any(token in value for token in (chr(36) + "{", "{{", "<", ">", chr(96))):
            return None
        return urlunsplit((parsed.scheme, parsed.netloc, quote(parsed.path, safe="/:@+!$'()*,-._~=%"), parsed.query, ""))
    except ValueError:
        return None


def collect_remote_urls(root, items):
    urls = {}
    def add(value, source, kind):
        url = public_url(value)
        if url:
            refs = urls.setdefault(url, [])
            ref = {"source": source, "kind": kind}
            if ref not in refs:
                refs.append(ref)
    for item in items:
        path = local_path(root, item["source"])
        if path.stat().st_size > 1_000_000:
            continue  # Embedded bundles are covered by local and syntax scans.
        source = path.read_text(encoding="utf8", errors="replace")
        parser = Resources()
        try:
            parser.feed(source)
        except Exception:
            continue
        base = urljoin("https://turbogames.local/" + item["source"], parser.base or "")
        for resource in parser.resources:
            if resource["tag"] not in ("script", "iframe", "object", "embed"):
                continue
            url = urljoin(base, resource["url"])
            if urlsplit(url).hostname != "turbogames.local":
                add(url, item["source"], resource["tag"])
        for match in CONFIG_URL.finditer(source):
            url = match[3].replace("\\/", "/").replace("\\'", "'")
            if "part" in source and re.search(r"\.(?:data|wasm|z64|zip|nds|gba|unityweb)(?:\.br|\.gz)?$", url):
                continue
            add(url, item["source"], match[1])
    return urls


def check_remote(pair, timeout, deadline):
    url, references = pair
    if time.monotonic() >= deadline:
        return {"url": url, "references": references, "result": "skipped", "reason": "daily time budget"}
    headers = {"User-Agent": "TurboGames-daily-source-check/1.0", "Range": "bytes=0-255"}
    try:
        try:
            response = urlopen(Request(url, headers=headers), timeout=timeout)
        except HTTPError as error:
            if error.code != 416:
                raise
            headers.pop("Range")
            response = urlopen(Request(url, headers=headers), timeout=timeout)
        with response:
            response.read(256)
            content_type = response.headers.get("Content-Type", "")
            unexpected_html = ("text/html" in content_type.lower() and
                               any(r["kind"] not in ("iframe", "object", "embed") for r in references))
            return {"url": url, "references": references, "status": response.status,
                    "content_type": content_type, "cors": response.headers.get("Access-Control-Allow-Origin"),
                    "result": "unexpected-html" if unexpected_html else "reachable"}
    except HTTPError as error:
        return {"url": url, "references": references, "status": error.code, "result": "http-error"}
    except Exception as error:
        return {"url": url, "references": references, "result": "connection-error", "error": str(error)[:240]}


def audit_remote(urls, workers=16, timeout=8, budget=600, limit=0):
    pairs = sorted(urls.items())
    # Rotate the start daily so slow hosts cannot always starve the same tail.
    if pairs:
        offset = (datetime.now(timezone.utc).date().toordinal() * 997) % len(pairs)
        pairs = pairs[offset:] + pairs[:offset]
    selected = pairs[:limit] if limit else pairs
    deadline, results = time.monotonic() + budget, []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for count, result in enumerate(pool.map(lambda pair: check_remote(pair, timeout, deadline), selected), 1):
            results.append(result)
            if count % 250 == 0:
                print("Remote checks processed:", count, "/", len(selected), flush=True)
    counts = Counter(r["result"] for r in results)
    checked = len(results) - counts["skipped"]
    return {
        "method": "Fresh GET prefix requests for literal script/frame and complete asset URLs. No successful response cache is reused.",
        "limitations": "HTTP availability is not gameplay verification. Large embedded bundles and dynamically assembled URLs are excluded from remote extraction.",
        "discovered": len(pairs), "checked": checked, "skipped": len(pairs) - checked,
        "counts": dict(counts), "budget_seconds": budget, "results": results,
    }


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def write_summary(root, report):
    write_json(root / "reports/daily-status.json", report)
    local, remote = report["local"], report["remote"]
    rows = [
        ("Existing catalog entries", report["catalog_entries"]),
        ("Local catalog/source/image problems", local["catalog_problems"]),
        ("Required launcher resource problems", local["required_launcher_problems"]),
        ("Inline JavaScript syntax failures", local["syntax_failures"]),
        ("Fresh remote URL checks", str(remote["checked"]) + " / " + str(remote["discovered"])),
        ("Remote URLs requiring attention", remote["issues"]),
        ("Remote URLs deferred or skipped", remote["skipped"]),
    ]
    lines = ["# Daily TurboGames refresh", "", "Checked at: " + report["checked_at"],
             "", "Result: **" + report["result"] + "**.", "",
             "| Check | Result |", "| --- | --- |"]
    lines += ["| " + key + " | " + str(value) + " |" for key, value in rows]
    lines += ["", "The existing catalog and local artwork mappings are rebuilt. No new games are imported.",
              "Remote failures are reported for review and do not automatically remove a game or replace its code.",
              "", "Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.",
              "Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact."]
    if report["errors"]:
        lines += ["", "## Refresh errors", ""] + ["- " + value for value in report["errors"]]
    if report["remote_issue_examples"]:
        lines += ["", "## Remote issues (sample)", ""]
        for issue in report["remote_issue_examples"]:
            lines.append("- " + issue["source"].replace("<", "&lt;").replace(">", "&gt;") + ": " + issue["result"] +
                         ((" (HTTP " + str(issue["status"]) + ")") if issue.get("status") else ""))
    (root / "reports/daily-status.md").write_text("\n".join(lines) + "\n", encoding="utf8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--artifacts", type=Path, default=Path(".daily-refresh"))
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--remote-limit", type=int, default=0, help="Smoke-check sample size; 0 checks all within the daily budget")
    parser.add_argument("--remote-workers", type=int, default=16)
    parser.add_argument("--remote-timeout", type=float, default=8)
    parser.add_argument("--remote-budget", type=float, default=600)
    args = parser.parse_args()
    if args.remote_limit < 0 or not 1 <= args.remote_workers <= 32 or args.remote_timeout <= 0 or args.remote_budget <= 0:
        parser.error("Use a nonnegative limit, 1–32 workers, and positive timeout/budget")
    root, artifacts = args.root.resolve(), args.artifacts.resolve()
    artifacts.mkdir(parents=True, exist_ok=True)
    errors, items = [], read_catalog(root)
    problems = validate_catalog(root, items)
    if problems:
        write_json(artifacts / "catalog-problems.json", problems)
        raise SystemExit("Catalog references are invalid; see catalog-problems.json")
    subprocess.run([sys.executable, str(root / "tools/build_catalog.py")], cwd=root, check=True)
    items, local = read_catalog(root), audit(root)
    write_json(artifacts / "local-audit.json", local)
    fatal_kinds = {"empty", "placeholder", "drive-warning", "source-error-page", "parse-error", "missing-local-resource"}
    sources = {item["source"] for item in items}
    required = [r for r in local["launchers"] if r["path"] in sources and any(i["kind"] in fatal_kinds for i in r["issues"])]
    if required:
        errors.append(str(len(required)) + " catalog launchers have required source/resource problems.")
    syntax_path = artifacts / "script-syntax.json"
    syntax_process = subprocess.run(["node", "--experimental-vm-modules", str(root / "tools/check-scripts.cjs"), "--strict", "--output", str(syntax_path)], cwd=root)
    syntax = json.loads(syntax_path.read_text()) if syntax_path.exists() else {"failures": [{"error": "No syntax report produced"}]}
    if syntax_process.returncode:
        errors.append("The JavaScript syntax check failed.")
    urls = collect_remote_urls(root, items)
    remote = ({"method": "Offline run; no remote URLs requested.", "discovered": len(urls), "checked": 0, "skipped": len(urls), "counts": {}, "results": []}
              if args.offline else audit_remote(urls, args.remote_workers, args.remote_timeout, args.remote_budget, args.remote_limit))
    write_json(artifacts / "remote-audit.json", remote)
    issues = [r for r in remote["results"] if r["result"] not in ("reachable", "skipped")]
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "result": "failed" if errors else ("attention" if issues else ("local-checks-only" if args.offline else ("partial" if remote["skipped"] else "ok"))),
        "catalog_entries": len(items),
        "local": {"catalog_problems": len(problems), "required_launcher_problems": len(required), "syntax_failures": len(syntax["failures"]), "launcher_files_scanned": local["file_count"]},
        "remote": {key: remote[key] for key in ("discovered", "checked", "skipped", "counts")},
        "errors": errors,
        "remote_issue_examples": [{"source": r["references"][0]["source"], "result": r["result"], "status": r.get("status")} for r in issues[:30]],
    }
    report["remote"]["issues"] = len(issues)
    write_summary(root, report)
    write_json(artifacts / "daily-status.json", report)
    (artifacts / "daily-status.md").write_text((root / "reports/daily-status.md").read_text(encoding="utf8"), encoding="utf8")
    print(json.dumps({k: v for k, v in report.items() if k != "remote_issue_examples"}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
