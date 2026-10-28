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
  const playerSurface = document.querySelector("#player-surface");
  let frame = document.querySelector("#game-frame");
  const dialogTitle = document.querySelector("#dialog-title");
  const playerStatus = document.querySelector("#player-status");
  const openTab = document.querySelector("#open-game-tab");
  const more = document.querySelector("#load-more");
  const sort = document.querySelector("#sort");
  const hideUnavailable = document.querySelector("#hide-unavailable");
  const libraryNote = document.querySelector("#library-note");
  const recovery = document.querySelector("#player-recovery");
  const loading = document.querySelector("#player-loading");
  const feedback = document.querySelector("#action-feedback");
  const categoryNames = { popular: "Popular", all: "All titles", games: "Games", flash: "Flash", apps: "Apps", emulator: "Emulator", misc: "Misc", saved: "Saved", recent: "Recent" };
  const parameters = new URLSearchParams(location.search);
  const embedded = parameters.get("embed") === "1" || window.self !== window.top;
  document.documentElement.classList.toggle("is-embedded", embedded);
  const sessionSaves = new Map();
  const memorySaves = new Map();
  function readLibrary(key) {
    try {
      const data = JSON.parse(localStorage.getItem(`turbogames:${key}`) || "[]");
      return Array.isArray(data) ? [...new Set(data.filter(id => typeof id === "string" && byId.has(id)))] : [];
    } catch { return []; }
  }
  const favorites = new Set(readLibrary("favorites"));
  let recent = readLibrary("recent").slice(0, 24);
  const normalize = text => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const searchable = new Map(items.map(item => [item.id, normalize([item.title, item.category, ...(item.tags || [])].join(" "))]));
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
  let feedbackTimer;

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
    if (memorySaves.has(item.id)) return cleanValues(memorySaves.get(item.id));
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

  function persistLibrary(key, value) {
    try { localStorage.setItem(`turbogames:${key}`, JSON.stringify(value)); return true; }
    catch { libraryNote.textContent = "Browser storage is unavailable. Your library will last for this tab."; return false; }
  }
  function tellAction(message) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 2600);
  }
  function updateSaveButton(button, item) {
    const saved = favorites.has(item.id);
    button.dataset.saveId = item.id;
    button.textContent = saved ? "♥" : "♡";
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${saved ? "Unsave" : "Save"} ${item.title}`);
    button.title = saved ? "Remove from Saved" : "Save for later";
  }
  function toggleFavorite(item) {
    const saved = !favorites.has(item.id);
    saved ? favorites.add(item.id) : favorites.delete(item.id);
    const durable = persistLibrary("favorites", [...favorites]);
    updateLibraryCounts();
    if (category === "saved") render();
    document.querySelectorAll("[data-save-id]").forEach(button => {
      if (button.dataset.saveId === item.id) updateSaveButton(button, item);
    });
    tellAction(saved ? `${item.title} saved${durable ? " to your shortlist" : " for this tab"}.` : `${item.title} removed from Saved.`);
  }
  function updateLibraryCounts() {
    document.querySelector("#saved-count").textContent = favorites.size;
    document.querySelector("#recent-count").textContent = recent.length;
  }
  function rememberItem(item) {
    recent = [item.id, ...recent.filter(id => id !== item.id)].slice(0, 24);
    persistLibrary("recent", recent);
    updateLibraryCounts();
  }
  function updateTabs() {
    tabs.forEach(tab => {
      const active = tab.dataset.category === category;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    const selected = tabs.find(tab => tab.dataset.category === category);
    const bar = selected?.parentElement;
    if (bar) {
      const bounds = selected.getBoundingClientRect();
      const viewport = bar.getBoundingClientRect();
      if (bounds.left < viewport.left) bar.scrollLeft -= viewport.left - bounds.left;
      else if (bounds.right > viewport.right) bar.scrollLeft += bounds.right - viewport.right;
    }
    search.setAttribute("aria-label", category === "all" || category === "popular" ? "Search all games and apps" : `Search ${categoryNames[category].toLowerCase()}`);
  }
  function writeFilters() {
    const url = new URL(location.href);
    const values = { view: category === "popular" ? "" : category, q: search.value.trim(), sort: sort.value === "recommended" ? "" : sort.value, available: hideUnavailable.checked ? "1" : "" };
    for (const [key, value] of Object.entries(values)) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    history.replaceState(history.state, "", url);
  }
  function readFilters() {
    const params = new URLSearchParams(location.search);
    category = Object.hasOwn(categoryNames, params.get("view")) ? params.get("view") : "popular";
    search.value = params.get("q") || "";
    if (category === "popular" && search.value.trim()) category = "all";
    sort.value = ["title-asc", "title-desc"].includes(params.get("sort")) ? params.get("sort") : "recommended";
    hideUnavailable.checked = params.get("available") === "1";
    updateTabs();
  }

  function filteredItems() {
    const query = normalize(search.value);
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = items.filter(item => {
      const matchesCategory = category === "all" || (category === "popular" ? item.featured : category === "saved" ? favorites.has(item.id) : category === "recent" ? recent.includes(item.id) : item.category === category);
      const text = searchable.get(item.id);
      return matchesCategory && (!hideUnavailable.checked || item.sourceStatus !== "unavailable") && (!query || terms.every(term => text.includes(term)) || text.replaceAll(" ", "").includes(query.replaceAll(" ", "")));
    });
    if (sort.value !== "recommended") return matches.sort((a, b) => (sort.value === "title-asc" ? 1 : -1) * a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
    if (category === "recent") return matches.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    if (query) return matches.sort((a, b) => Number(normalize(b.title).startsWith(query)) - Number(normalize(a.title).startsWith(query)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return matches;
  }

  function createCard(item, index) {
    const card = document.createElement("article");
    card.className = `game-card${item.sourceStatus === "unavailable" ? " source-unavailable" : ""}`;
    card.style.setProperty("--card-index", Math.min(index, 9));
    card.style.setProperty("--cover-hue", coverHue(item.id));
    const button = document.createElement("button");
    button.className = "card-launch";
    button.type = "button";
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
    play.innerHTML = '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="m6 3 11 7L6 17Z"/></svg>';
    const badge = document.createElement("span");
    badge.className = "card-category";
    badge.textContent = item.sourceStatus === "unavailable" ? "Needs source" : item.category;
    if (item.sourceStatus === "unavailable") button.title = item.sourceIssue || "A matching playable source is still needed.";
    art.append(image, play, badge);
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = item.title;
    name.title = item.title;
    button.append(art, name);
    button.addEventListener("click", () => openItem(item));
    const save = document.createElement("button");
    save.type = "button";
    save.className = "save-game";
    updateSaveButton(save, item);
    save.addEventListener("click", () => toggleFavorite(item));
    card.append(button, save);
    return card;
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
    document.body.classList.toggle("is-browsing", category !== "popular" || Boolean(search.value.trim()));
    document.querySelector("#catalog-title").textContent = category === "saved" ? "Saved for later" : category === "recent" ? "Recently opened" : "The collection";
    displayed = 96;
    grid.replaceChildren();
    count.textContent = `${visible.length.toLocaleString()} ${visible.length === 1 ? "item" : "items"} · ${categoryNames[category]}`;
    const noLibrary = !search.value.trim() && (category === "saved" && favorites.size === 0 || category === "recent" && recent.length === 0);
    document.querySelector("#empty-icon").textContent = noLibrary ? category === "saved" ? "♡" : "↶" : "⌕";
    document.querySelector("#empty-title").textContent = noLibrary ? category === "saved" ? "Your favorites, all together" : "Pick up where you left off" : "No matches yet";
    document.querySelector("#empty-description").textContent = noLibrary ? category === "saved" ? "Tap the heart on any title to save it here in this browser." : "Open a game and it will appear here for a quick return." : "Try fewer words, another category, or reset your filters.";
    document.querySelector("#clear-search").textContent = noLibrary ? "Explore all titles" : "Reset filters";
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
    // Set srcdoc before insertion: a fresh iframe replaces its initial blank
    // document instead of adding child navigations to the browser Back stack.
    const nextFrame = frame.cloneNode(false);
    nextFrame.removeAttribute("srcdoc");
    nextFrame.removeAttribute("src");
    nextFrame.addEventListener("load", onFrameLoad);
    frame.remove();
    frame = nextFrame;
    frame.title = item.title;
    recovery.hidden = true;
    loading.hidden = false;
    loading.querySelector("h3").textContent = `Opening ${item.title}…`;
    if (item.sourceStatus === "unavailable") {
      playerStatus.textContent = item.sourceIssue || "This game needs a working source before it can be played.";
      showRecovery(item.sourceIssue || "The original game files are unavailable. Choose another title from the collection.", true);
      return;
    }
    playerStatus.textContent = "";
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
      playerSurface.append(frame);
      rememberItem(item);
    } catch (error) {
      if (error.name !== "AbortError" && activeNonce === nonce) showRecovery("The game page could not be downloaded. Check your connection and try again.");
    }
  }
  function showRecovery(message, missing = false) {
    loading.hidden = true;
    playerStatus.textContent = "";
    document.querySelector("#recovery-title").textContent = missing ? "This title needs a new source" : "This game couldn't load";
    document.querySelector("#recovery-description").textContent = message;
    document.querySelector("#retry-game").hidden = missing;
    recovery.hidden = false;
  }
  function openItem(item, navigate = true) {
    clearTimeout(searchTimer);
    writeFilters();
    if (navigate) {
      const url = new URL(location.href);
      url.searchParams.set("play", item.id);
      history.pushState({ ...history.state, turboPlayer: true }, "", url);
    }
    dialogTitle.textContent = item.title;
    const fullSite = new URL(location.href);
    fullSite.searchParams.delete("embed");
    fullSite.searchParams.set("play", item.id);
    fullSite.hash = "";
    openTab.href = fullSite.href;
    if (!dialog.open) dialog.showModal();
    loadItem(item);
  }
  function closePlayer() {
    if (history.state?.turboPlayer) history.back();
    else {
      const url = new URL(location.href);
      url.searchParams.delete("play");
      history.replaceState(history.state, "", url);
      dialog.close();
    }
  }
  function onFrameLoad(event) {
    if (event.currentTarget === frame && activeItem && frame.hasAttribute("srcdoc")) {
      loading.hidden = true;
      playerStatus.textContent = manualSaveHint ? "Use the game's Save / Export controls to keep emulator progress." : "";
    }
  }
  frame.addEventListener("load", onFrameLoad);
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups allow-presentation allow-downloads");
  frame.setAttribute("referrerpolicy", "no-referrer");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      clearTimeout(searchTimer);
      category = tab.dataset.category;
      updateTabs();
      writeFilters();
      render();
    });
  });
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (category === "popular" && search.value.trim()) category = "all";
      updateTabs();
      writeFilters();
      render();
    }, 120);
  });
  for (const input of [sort, hideUnavailable]) input.addEventListener("change", () => { writeFilters(); render(); });
  more.addEventListener("click", () => { const start = displayed; displayed += 96; appendCards(start); });
  function resetCollection(nextCategory = "all") {
    clearTimeout(searchTimer);
    search.value = "";
    category = nextCategory;
    sort.value = "recommended";
    hideUnavailable.checked = false;
    updateTabs();
    writeFilters();
    render();
  }
  document.querySelector("#clear-search").addEventListener("click", () => { resetCollection(); search.focus(); });
  document.querySelector("#hero-saved").addEventListener("click", () => {
    resetCollection("saved");
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
    tabs.find(tab => tab.dataset.category === "saved").focus({ preventScroll: true });
  });
  const heroItem = byId.get("orbit-breaker");
  if (heroItem) {
    const heroSave = document.querySelector("#hero-save");
    updateSaveButton(heroSave, heroItem);
    heroSave.addEventListener("click", () => toggleFavorite(heroItem));
    document.querySelector("#hero-play").addEventListener("click", () => openItem(heroItem));
  }
  document.querySelectorAll("a.brand").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    resetCollection("popular");
    const url = new URL(location.href);
    url.hash = "";
    history.replaceState(history.state, "", url);
    window.scrollTo(0, 0);
  }));
  document.querySelector("#close-dialog").addEventListener("click", closePlayer);
  document.querySelector("#return-to-collection").addEventListener("click", closePlayer);
  document.querySelector("#retry-game").addEventListener("click", () => { if (activeItem) loadItem(activeItem); });
  document.querySelector("#reload-game").addEventListener("click", () => { if (activeItem) loadItem(activeItem); });
  dialog.addEventListener("close", () => {
    // A queued close event can arrive after Forward has already reopened it.
    if (dialog.open) return;
    if (document.fullscreenElement === playerSurface) document.exitFullscreen().catch(() => {});
    flushSave();
    loadController?.abort();
    activeItem = undefined;
    activeNonce = undefined;
    frame.remove();
    frame.removeAttribute("srcdoc");
    frame.removeAttribute("src");
    playerStatus.textContent = "";
    recovery.hidden = true;
    loading.hidden = true;
    if (category === "recent") render();
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); closePlayer(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) closePlayer(); });
  window.addEventListener("popstate", () => {
    clearTimeout(searchTimer);
    readFilters();
    render();
    const item = byId.get(new URLSearchParams(location.search).get("play"));
    if (item) {
      if (!dialog.open || activeItem?.id !== item.id) openItem(item, false);
    } else if (dialog.open) dialog.close();
  });
  document.querySelector("#fullscreen-button").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerSurface.requestFullscreen();
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
  readFilters();
  updateLibraryCounts();
  document.querySelector("#total-titles").textContent = items.length.toLocaleString();
  render();
  const requested = byId.get(parameters.get("play"));
  if (requested) openItem(requested, false);
  else if (parameters.has("play")) {
    libraryNote.textContent = "That title isn't in this catalog. Search the collection to find another.";
    const url = new URL(location.href);
    url.searchParams.delete("play");
    history.replaceState(history.state, "", url);
  }
})();
