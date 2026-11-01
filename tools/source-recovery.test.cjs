const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { creatorHref, setCreatorLink } = require("../source-recovery.js");

test("creator destinations must be absolute HTTPS URLs without credentials or control characters", () => {
  assert.equal(creatorHref("https://thirtydollar.website/"), "https://thirtydollar.website/");
  assert.equal(creatorHref("https://example.com/a path?q=a&b=c"), "https://example.com/a%20path?q=a&b=c");
  for (const value of [null, {}, "", "/relative", "//example.com", "javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:password@example.com", "https://example.com/\njavascript:alert(1)", "https://example.com/\u0000"]) {
    assert.equal(creatorHref(value), null, String(value));
  }
});

test("switching from a creator destination to another failed title removes the old link", () => {
  const link = { hidden: true, removeAttribute(name) { delete this[name]; } };
  assert.equal(setCreatorLink(link, "https://thirtydollar.website/"), true);
  assert.equal(link.hidden, false);
  assert.equal(link.href, "https://thirtydollar.website/");
  for (const value of [undefined, "javascript:alert(1)"]) {
    assert.equal(setCreatorLink(link, value), false);
    assert.equal(link.hidden, true);
    assert.equal(Object.hasOwn(link, "href"), false);
  }
});

test("browser and Node exports enforce the same recovery link rules", () => {
  const context = { window: {}, URL };
  vm.runInNewContext(fs.readFileSync(require.resolve("../source-recovery.js"), "utf8"), context);
  assert.equal(context.window.TurboSourceRecovery.creatorHref("https://thirtydollar.website/"), creatorHref("https://thirtydollar.website/"));
  assert.equal(context.window.TurboSourceRecovery.creatorHref("javascript:alert(1)"), null);
});
