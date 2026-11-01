(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TurboSourceRecovery = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function creatorHref(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function setCreatorLink(link, value) {
    const href = creatorHref(value);
    link.hidden = !href;
    if (href) link.href = href;
    else link.removeAttribute("href");
    return Boolean(href);
  }
  return Object.freeze({ creatorHref, setCreatorLink });
});
