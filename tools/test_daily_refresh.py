"""Regression checks for the scheduled refresh's failure and freshness behavior."""
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

import daily_refresh as refresh


class SourceHandler(BaseHTTPRequestHandler):
    calls = Counter()

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.calls[self.path] += 1
        if self.path == "/missing.js":
            self.send_error(404)
            return
        if self.path == "/range.js" and self.headers.get("Range"):
            self.send_error(416)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html" if self.path == "/error-page.js" else "application/javascript")
        self.end_headers()
        self.wfile.write(b"<html>Error page</html>" if self.path == "/error-page.js" else b"window.fixtureLoaded = true;")


class DailyRefreshChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), SourceHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def check_url(self, path, deadline=None):
        return refresh.check_remote((self.base + path, [{"source": "fixture.html", "kind": "script"}]), 2, deadline or time.monotonic() + 5)

    def test_success_is_rechecked_instead_of_cached(self):
        before = SourceHandler.calls["/fresh.js"]
        self.assertEqual(self.check_url("/fresh.js")["result"], "reachable")
        self.assertEqual(self.check_url("/fresh.js")["result"], "reachable")
        self.assertEqual(SourceHandler.calls["/fresh.js"], before + 2)

    def test_http_error_remains_a_reported_issue(self):
        result = self.check_url("/missing.js")
        self.assertEqual((result["result"], result["status"]), ("http-error", 404))

    def test_html_error_document_is_not_a_valid_script(self):
        self.assertEqual(self.check_url("/error-page.js")["result"], "unexpected-html")

    def test_range_rejection_retries_without_range(self):
        before = SourceHandler.calls["/range.js"]
        self.assertEqual(self.check_url("/range.js")["result"], "reachable")
        self.assertEqual(SourceHandler.calls["/range.js"], before + 2)

    def test_expired_budget_does_not_fetch(self):
        before = SourceHandler.calls["/deferred.js"]
        result = self.check_url("/deferred.js", time.monotonic() - 1)
        self.assertEqual(result["result"], "skipped")
        self.assertEqual(SourceHandler.calls["/deferred.js"], before)

    def test_sample_and_skipped_counts_do_not_claim_full_coverage(self):
        urls = {"https://example.org/" + str(i): [] for i in range(4)}
        with patch.object(refresh, "check_remote", side_effect=lambda pair, *_: {"url": pair[0], "result": "reachable"}):
            report = refresh.audit_remote(urls, limit=2)
        self.assertEqual((report["discovered"], report["checked"], report["skipped"]), (4, 2, 2))

    def test_catalog_rejects_missing_files_duplicates_and_path_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "game.html").write_text("<title>Fixture</title>")
            (root / "cover.svg").write_text("<svg/>")
            valid = {"id": "fixture", "source": "game.html", "image": "cover.svg"}
            self.assertEqual(refresh.validate_catalog(root, [valid]), [])
            self.assertTrue(refresh.validate_catalog(root, [valid, valid]))
            self.assertTrue(refresh.validate_catalog(root, [{**valid, "image": "missing.png"}]))
            with self.assertRaises(ValueError):
                refresh.local_path(root, "../outside.html")

    def test_remote_extraction_avoids_tracking_and_private_literal_hosts(self):
        self.assertIsNone(refresh.public_url("http://127.0.0.1/game.js"))
        self.assertIsNone(refresh.public_url("http://169.254.169.254/game.js"))
        self.assertIsNone(refresh.public_url("https://www.googletagmanager.com/gtag/js"))
        self.assertEqual(refresh.public_url("https://example.org/my game.js"), "https://example.org/my%20game.js")


if __name__ == "__main__":
    unittest.main()
