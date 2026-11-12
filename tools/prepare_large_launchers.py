#!/usr/bin/env python3
"""Prepare large existing HTML games for sandboxed native iframe navigation.

The header carries no game code: the parent passes its normal nonce-scoped save
configuration in iframe.name, and the existing compatibility runtime reads it.
Native navigation avoids copying a multi-megabyte HTML string through the parent
and iframe.srcdoc. Original game bytes are retained, apart from the same narrowly
scoped standalone parent-export guard already used by the existing srcdoc path.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THRESHOLD = 2 * 1024 * 1024
DOCTYPE = re.compile(rb"\A(?:\xef\xbb\xbf)?\s*(?:<!--.*?-->\s*)*<!doctype\b[^>]*>", re.I | re.S)
RUFFLE = re.compile(rb"(?:@ruffle-rs/ruffle|ruffle(?:\.min)?\.js)", re.I)
PARENT_EXPORT = b"window.parent.maeExportApis_();"
STANDALONE_EXPORT = re.compile(rb"(<script\b[^>]*>\s*)window\.parent\.maeExportApis_\(\);(\s*</script>)", re.I)
MARKER = b"data-turbogames-direct"


def bootstrap(source):
    prefix = "../" * (len(source.parts) - 1)
    return (
        f'\n<script src="{prefix}vendor/indexeddb/indexeddb.js" data-turbogames-direct="1"></script>\n'
        f'<script src="{prefix}player-compat.js" data-turbogames-direct="1"></script>\n'
    ).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Inspect eligibility without changing game files or the committed report")
    parser.add_argument("--report", default="reports/large-launch-preparation.json")
    args = parser.parse_args()
    report_path = ROOT / args.report
    previous = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    previous_entries = {entry["source"]: entry for entry in previous.get("prepared", [])}
    raw = (ROOT / "catalog.js").read_text(encoding="utf-8")
    items = json.loads(raw.split("=", 1)[1].strip().rstrip(";"))
    report = {
        "version": 1,
        "threshold_bytes": THRESHOLD,
        "method": "Two parser-blocking local compatibility scripts. Game documents retain their original bytes except for an explicitly counted standalone legacy parent-export guard identical to the existing srcdoc path. The parent supplies a nonce-scoped configuration via iframe.name before insertion.",
        "prepared": [],
        "skipped": [],
    }
    changed = 0
    seen = set()
    for item in items:
        source = Path(item["source"])
        path = ROOT / source
        if source in seen or not str(source).startswith("library-source/") or path.stat().st_size <= THRESHOLD:
            continue
        seen.add(source)
        data = path.read_bytes()
        header = bootstrap(source)
        already = data.count(header) == 1
        saved = previous_entries.get(source.as_posix())
        if already and saved and saved.get("prepared_sha256") == digest(data):
            report["prepared"].append({**saved, "legacy_export_guards": saved.get("legacy_export_guards", 0)})
            continue
        original = data.replace(header, b"", 1) if already else data
        guarded, guards = STANDALONE_EXPORT.subn(rb"\1try { window.parent.maeExportApis_?.(); } catch (e) {}\2", original)
        entry = {"id": item["id"], "title": item["title"], "source": source.as_posix()}
        reason = None
        if MARKER in original:
            reason = "Unrecognized direct-launch header requires manual review."
        elif b"player-compat.js" in original[:65536]:
            reason = "Existing compatibility bootstrap requires manual review before native navigation."
        elif RUFFLE.search(original):
            reason = "Uses the parent's Ruffle URL rewriting; retain the existing srcdoc launch path."
        elif PARENT_EXPORT in guarded:
            reason = "Uses the parent's legacy parent-export guard; retain the existing srcdoc launch path."
        if reason:
            entry.update({"source_bytes": len(data), "reason": reason})
            report["skipped"].append(entry)
            continue
        doctype = DOCTYPE.match(guarded[:65536])
        point = doctype.end() if doctype else 0
        prepared = guarded[:point] + header + guarded[point:]
        assert prepared[:point] + prepared[point + len(header):] == guarded
        assert prepared.count(MARKER) == 2
        if prepared != data:
            changed += 1
            if not args.dry_run:
                path.write_bytes(prepared)
        entry.update({
            "source_bytes_before": len(original),
            "source_bytes": len(prepared),
            "header_bytes": len(header),
            "insert_offset": point,
            "original_sha256": digest(original),
            "prepared_sha256": digest(prepared),
            "original_body_preserved": guards == 0,
            "legacy_export_guards": guards,
        })
        report["prepared"].append(entry)
    report["summary"] = {
        "prepared_count": len(report["prepared"]),
        "skipped_count": len(report["skipped"]),
        "original_document_bytes": sum(entry["source_bytes_before"] for entry in report["prepared"]),
        "header_bytes": sum(entry["header_bytes"] for entry in report["prepared"]),
        "legacy_export_guards": sum(entry.get("legacy_export_guards", 0) for entry in report["prepared"]),
    }
    if not args.dry_run:
        (ROOT / args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**report["summary"], "files_changed": changed, "dry_run": args.dry_run}))


if __name__ == "__main__":
    main()
