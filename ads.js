/* One display placement per page load; games never depend on an ad loading. */
(() => {
  "use strict";
  const config = window.TURBO_ADS_CONFIG;
  const placement = document.querySelector("#catalog-ad");
  // Google Sites is a separate publisher context. Only serve on the approved
  // top-level site, never inside its embed or an unapproved iframe.
  if (!placement || !config?.enabled || window.self !== window.top ||
      new URLSearchParams(location.search).get("embed") === "1") return;
  if (!/^ca-pub-\d{16}$/.test(config.publisherId) || !/^\d+$/.test(config.slotId)) return;

  const ad = document.createElement("ins");
  ad.className = "adsbygoogle";
  ad.style.display = "block";
  ad.dataset.adClient = config.publisherId;
  ad.dataset.adSlot = config.slotId;
  ad.dataset.adFormat = "auto";
  ad.dataset.fullWidthResponsive = "true";
  placement.append(ad);
  placement.hidden = false;
  const observer = new MutationObserver(() => {
    if (ad.dataset.adStatus === "unfilled") {
      placement.hidden = true;
      observer.disconnect();
    }
  });
  observer.observe(ad, {attributes:true, attributeFilter:["data-ad-status"]});
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(config.publisherId);
  script.onload = () => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch { placement.hidden = true; observer.disconnect(); }
  };
  script.onerror = () => { placement.hidden = true; observer.disconnect(); };
  document.head.append(script);
})();
