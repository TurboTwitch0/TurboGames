(() => {
  "use strict";
  const items = window.TURBO_CATALOG || [];
  const byId = new Map(items.map(item => [item.id, item]));
  const search = document.querySelector("#search");
  const grid = document.querySelector("#game-grid");
  const empty = document.querySelector("#empty-state");
  const count = document.querySelector("#result-count");
  const tabs = [...document.querySelectorAll(".tab")];
  const dialog = document.querySelector("#game-dialog");
  const frame = document.querySelector("#game-frame");
  const dialogTitle = document.querySelector("#dialog-title");
  const playerStatus = document.querySelector("#player-status");
  const openTab = document.querySelector("#open-game-tab");
  const more = document.querySelector("#load-more");
  const parameters = new URLSearchParams(location.search);
  const embedded = parameters.get("embed") === "1" || window.self !== window.top;
  document.documentElement.classList.toggle("is-embedded", embedded);
  const sessionSaves = new Map();
  const memorySaves = new Map();
  let category = "popular";
  let displayed = 96;
  let visible = [];
  let activeItem;
  let activeNonce;
  let searchTimer;
  let saveTimer;
  let pendingSave;
  let loadController;
  let manualSaveHint = false;

  const coverHue = text => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 360, 17);
  const localSource = item => item.source.split("/").map(encodeURIComponent).join("/");
  const saveKey = item => `turbogames:save:${item.id}`;
  const cleanValues = input => {
    const result = Object.create(null);
    if (!input || typeof input !== "object" || Array.isArray(input)) return result;
    for (const [key, value] of Object.entries(input).slice(0, 10000)) {
      if (typeof value === "string") result[key] = value;
    }
    return result;
  };
  function readSave(item) {
    try { return cleanValues(JSON.parse(localStorage.getItem(saveKey(item)) || "{}")); }
    catch { return cleanValues(memorySaves.get(item.id)); }
  }
  function flushSave() {
    clearTimeout(saveTimer);
    if (!pendingSave) return;
    const { item, data } = pendingSave;
    pendingSave = undefined;
    memorySaves.set(item.id, data);
    try { localStorage.setItem(saveKey(item), JSON.stringify(data)); }
    catch { playerStatus.textContent = "Browser storage is unavailable. Saves will last for this tab."; }
  }
  window.addEventListener("message", event => {
    if (!activeItem || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.nonce !== activeNonce) return;
    if (message.type === "turbogames:status" && message.code === "manual-saves") {
      manualSaveHint = true;
      playerStatus.textContent = "Use the game's Save / Export controls to keep emulator progress.";
      const nonce = activeNonce;
      setTimeout(() => { if (activeNonce === nonce) playerStatus.textContent = ""; }, 12000);
      return;
    }
    if (message.type !== "turbogames:storage") return;
    const data = cleanValues(message.data);
    if (JSON.stringify(data).length > 8 * 1024 * 1024) return;
    if (message.kind === "session") sessionSaves.set(activeItem.id, data);
    else if (message.kind === "local") {
      pendingSave = { item: activeItem, data };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 200);
    }
  });
  window.addEventListener("pagehide", flushSave);

  function filteredItems() {
    const query = search.value.trim().toLocaleLowerCase();
    return items.filter(item => {
      const matchesCategory = query || (category === "popular" ? item.featured : item.category === category);
      const text = [item.title, item.category, ...(item.tags || [])].join(" ").toLocaleLowerCase();
      return matchesCategory && (!query || text.includes(query));
    });
  }

  function createCard(item, index) {
    const button = document.createElement("button");
    button.className = `game-card${item.sourceStatus === "unavailable" ? " source-unavailable" : ""}`;
    button.type = "button";
    button.style.setProperty("--card-index", Math.min(index, 9));
    button.style.setProperty("--cover-hue", coverHue(item.id));
    button.setAttribute("aria-label", `Open ${item.title}`);
    const art = document.createElement("span");
    art.className = "card-art";
    const image = document.createElement("img");
    image.className = "card-image";
    image.src = item.image || "assets/fallback-cover.svg";
    image.alt = `${item.title} cover`;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 400;
    image.height = 400;
    image.addEventListener("error", () => {
      if (!image.src.endsWith("/assets/fallback-cover.svg")) image.src = "assets/fallback-cover.svg";
    }, { once: true });
    const play = document.createElement("span");
    play.className = "card-play";
    play.setAttribute("aria-hidden", "true");
    play.textContent = "▶";
    const badge = document.createElement("span");
    badge.className = "card-category";
    badge.textContent = item.sourceStatus === "unavailable" ? "Needs source" : item.category;
    if (item.sourceStatus === "unavailable") button.title = "The original game asset host is unavailable; a matching replacement is still needed.";
    art.append(image, play, badge);
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = item.title;
    button.append(art, name);
    button.addEventListener("click", () => openItem(item));
    return button;
  }
  function appendCards(start) {
    const fragment = document.createDocumentFragment();
    visible.slice(start, displayed).forEach((item, index) => fragment.append(createCard(item, index)));
    grid.append(fragment);
    more.hidden = displayed >= visible.length;
    more.textContent = `Show more (${Math.max(0, visible.length - displayed)} remaining)`;
  }
  function render() {
    visible = filteredItems();
    displayed = 96;
    grid.replaceChildren();
    count.textContent = `${visible.length.toLocaleString()} ${visible.length === 1 ? "item" : "items"}${search.value.trim() ? " · all categories" : ""}`;
    empty.hidden = visible.length > 0;
    grid.hidden = visible.length === 0;
    appendCards(0);
  }

  async function loadItem(item) {
    flushSave();
    loadController?.abort();
    loadController = new AbortController();
    activeItem = item;
    activeNonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const nonce = activeNonce;
    manualSaveHint = false;
    const config = { turboGames: 1, nonce, parentOrigin: location.origin, local: readSave(item), session: sessionSaves.get(item.id) || {} };
    frame.title = item.title;
    playerStatus.textContent = `Loading ${item.title}…`;
    frame.removeAttribute("srcdoc");
    frame.src = "about:blank";
    try {
      const source = new URL(localSource(item), document.baseURI);
      const response = await fetch(source, { signal: loadController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let html = await response.text();
      if (activeNonce !== nonce) return;
      html = html.replace(/(<script\b[^>]*>\s*)window\.parent\.maeExportApis_\(\);(\s*<\/script>)/g, "$1try { window.parent.maeExportApis_?.(); } catch (e) {}$2");
      const ruffleRuntime = new URL("vendor/ruffle/ruffle.js", document.baseURI).href;
      html = html.replace(/(<script\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi, (tag, before, url, after) => /(?:@ruffle-rs\/ruffle|ruffle(?:\.min)?\.js(?:[?#]|$))/.test(url) ? before + ruffleRuntime + after : tag);
      const configuredBase = html.match(/<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      const base = configuredBase ? new URL(configuredBase, source).href : source.href;
      const escapeAttribute = value => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const serialized = JSON.stringify(config).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      const rufflePath = JSON.stringify(new URL("vendor/ruffle/", document.baseURI).href);
      const bootstrap = `<base href="${escapeAttribute(base)}"><script>window.__TURBOGAMES_CONFIG__=${serialized};window.RufflePlayer=window.RufflePlayer||{};window.RufflePlayer.config={...(window.RufflePlayer.config||{}),publicPath:${rufflePath}};<\/script><script src="${escapeAttribute(new URL("vendor/indexeddb/indexeddb.js", document.baseURI).href)}"><\/script><script src="${escapeAttribute(new URL("player-compat.js", document.baseURI).href)}"><\/script>`;
      const doctype = html.match(/^\uFEFF?\s*<!doctype[^>]*>/i);
      html = doctype ? html.slice(0, doctype[0].length) + bootstrap + html.slice(doctype[0].length) : bootstrap + html;
      frame.srcdoc = html;
    } catch (error) {
      if (error.name !== "AbortError" && activeNonce === nonce) playerStatus.textContent = "This game could not load. Try Restart game or Open game in new tab.";
    }
  }
  function openItem(item) {
    dialogTitle.textContent = item.title;
    const fullSite = new URL(location.href);
    fullSite.searchParams.delete("embed");
    fullSite.searchParams.set("play", item.id);
    fullSite.hash = "";
    openTab.href = fullSite.href;
    if (!dialog.open) dialog.showModal();
    loadItem(item);
  }
  frame.addEventListener("load", () => {
    if (activeItem && frame.hasAttribute("srcdoc")) playerStatus.textContent = activeItem.sourceStatus === "unavailable" ? "This game's original asset host is unavailable. A matching replacement is still needed." : manualSaveHint ? "Use the game's Save / Export controls to keep emulator progress." : "";
  });
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups allow-presentation allow-downloads");
  frame.setAttribute("referrerpolicy", "no-referrer");
  tabs.forEach(tab => {
    tab.setAttribute("aria-pressed", String(tab.dataset.category === category));
    tab.addEventListener("click", () => {
      category = tab.dataset.category;
      search.value = "";
      tabs.forEach(other => {
        const active = other === tab;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 120); });
  more.addEventListener("click", () => { const start = displayed; displayed += 96; appendCards(start); });
  document.querySelector("#clear-search").addEventListener("click", () => { search.value = ""; search.focus(); render(); });
  document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
  document.querySelector("#reload-game").addEventListener("click", () => { if (activeItem) loadItem(activeItem); });
  dialog.addEventListener("close", () => {
    flushSave();
    loadController?.abort();
    activeItem = undefined;
    activeNonce = undefined;
    frame.removeAttribute("srcdoc");
    frame.src = "about:blank";
    playerStatus.textContent = "";
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.querySelector("#fullscreen-button").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialog.requestFullscreen();
    } catch {
      playerStatus.textContent = "Fullscreen is blocked by this page. Use Open in new tab for the full arcade.";
      openTab.focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement !== search && !dialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault(); search.focus();
    }
  });
  render();
  const requested = byId.get(parameters.get("play"));
  if (requested) openItem(requested);
})();
