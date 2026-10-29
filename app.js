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
  const playerSave = document.querySelector("#save-active-game");
  const shareGame = document.querySelector("#share-game");
  const playerShare = document.querySelector("#player-share");
  const shareLink = document.querySelector("#game-share-link");
  const copyLink = document.querySelector("#copy-game-link");
  const shareFeedback = document.querySelector("#share-feedback");
  let shareGeneration = 0;
  const more = document.querySelector("#load-more");
  const sort = document.querySelector("#sort");
  const hideUnavailable = document.querySelector("#hide-unavailable");
  const libraryNote = document.querySelector("#library-note");
  const recovery = document.querySelector("#player-recovery");
  const loading = document.querySelector("#player-loading");
  const feedback = document.querySelector("#action-feedback");
  const pickButton = document.querySelector("#pick-game");
  const quickPick = document.querySelector("#quick-pick");
  const recentShelf = document.querySelector("#recent-shelf");
  const categoryNames = { popular: "Popular", all: "All titles", games: "Games", flash: "Flash", apps: "Apps", emulator: "Emulator", misc: "Misc", saved: "Saved", recent: "Recent" };
  const categoryTotals = items.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + 1;
    if (item.featured) totals.popular += 1;
    return totals;
  }, { all: items.length, popular: 0 });
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
  let pickedItem;
  const featuredGames = [
    { id: "orbit-breaker", image: "assets/brand/orbit-preview.webp", meta: "ARCADE / MOUSE OR TOUCH", description: "Steer the paddle. Break the orbiting stars.", accent: "#d6ff64" },
    { id: "little-match", meta: "PUZZLE / MATCH PAIRS", description: "Turn a few cards. Find the matching pairs.", accent: "#a9adff" },
    { id: "library-source/html5-games/cl2048.html", meta: "PUZZLE / ARROW KEYS", description: "Slide, combine, and build your way to 2048.", accent: "#ffb58c" }
  ].map(feature => ({ ...feature, item: byId.get(feature.id) })).filter(feature => feature.item && feature.item.sourceStatus !== "unavailable");
  let featuredIndex = 0;
  const featuredCards = [];
  const featuredDots = [];

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
  window.addEventListener("storage", event => {
    try { if (event.storageArea !== localStorage) return; }
    catch { return; }
    if (event.key === null || event.key === "turbogames:favorites") {
      favorites.clear();
      for (const id of readLibrary("favorites")) favorites.add(id);
      document.querySelectorAll("[data-save-id]").forEach(button => {
        const item = byId.get(button.dataset.saveId);
        if (item) updateSaveButton(button, item);
      });
    }
    if (event.key === null || event.key === "turbogames:recent") {
      recent = readLibrary("recent").slice(0, 24);
      renderRecentShelf();
    }
    if (event.key === null || event.key === "turbogames:favorites" || event.key === "turbogames:recent") {
      updateLibraryCounts();
      if (category === "saved" || category === "recent") render();
    }
  });
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
  function selectFeatured(index) {
    if (!featuredGames.length) return;
    featuredIndex = (index + featuredGames.length) % featuredGames.length;
    const selected = featuredGames[featuredIndex];
    featuredCards.forEach((card, cardIndex) => {
      const distance = (cardIndex - featuredIndex + featuredGames.length) % featuredGames.length;
      card.dataset.position = distance === 0 ? "current" : distance === 1 ? "next" : "previous";
      card.setAttribute("aria-label", `${distance === 0 ? "Play" : "Feature"} ${featuredGames[cardIndex].item.title}`);
      featuredDots[cardIndex].setAttribute("aria-pressed", String(distance === 0));
    });
    document.querySelector("#featured-title").textContent = selected.item.title;
    document.querySelector("#featured-meta").textContent = selected.meta;
    document.querySelector("#featured-description").textContent = selected.description;
    document.querySelector("#featured-status").textContent = `${featuredIndex + 1} of ${featuredGames.length} — ${selected.item.title}`;
    document.querySelector(".hero-showcase").style.setProperty("--stage-accent", selected.accent);
    const play = document.querySelector("#hero-play");
    play.firstChild.textContent = `Play ${selected.item.title} `;
    play.setAttribute("aria-label", `Play ${selected.item.title}`);
    updateSaveButton(document.querySelector("#hero-save"), selected.item);
    const browse = document.querySelector("#featured-browse");
    browse.firstChild.textContent = `Browse ${categoryNames[selected.item.category]} `;
  }
  function initializeShowcase() {
    const stage = document.querySelector("#featured-stage");
    const cards = document.querySelector("#featured-cards");
    const dots = document.querySelector("#featured-dots");
    featuredGames.forEach((feature, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "featured-card";
      card.dataset.featureId = feature.id;
      const art = document.createElement("span");
      art.className = "featured-art";
      const image = document.createElement("img");
      image.src = feature.image || feature.item.image;
      image.alt = index === 0 ? "Actual Orbit Breaker game canvas with colored targets, a ball, and a lime paddle" : `${feature.item.title} artwork from the existing TurboGames catalog`;
      image.width = 400;
      image.height = 400;
      image.decoding = "async";
      art.append(image);
      const caption = document.createElement("span");
      caption.className = "featured-card-caption";
      const number = document.createElement("span");
      number.className = "featured-card-number";
      number.textContent = `TURBO / 0${index + 1}`;
      const title = document.createElement("strong");
      title.textContent = feature.item.title;
      caption.append(number, title);
      card.append(art, caption);
      card.addEventListener("click", () => index === featuredIndex ? openItem(feature.item) : selectFeatured(index));
      cards.append(card);
      featuredCards.push(card);
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${feature.item.title}`);
      dot.setAttribute("aria-controls", "featured-cards");
      dot.textContent = `0${index + 1}`;
      dot.addEventListener("click", () => selectFeatured(index));
      dots.append(dot);
      featuredDots.push(dot);
    });
    document.querySelector("#featured-prev").addEventListener("click", () => selectFeatured(featuredIndex - 1));
    document.querySelector("#featured-next").addEventListener("click", () => selectFeatured(featuredIndex + 1));
    stage.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = featuredIndex + 1;
      else if (event.key === "ArrowLeft") next = featuredIndex - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = featuredGames.length - 1;
      else if (event.key === "Enter" && event.target === stage) { event.preventDefault(); openItem(featuredGames[featuredIndex].item); return; }
      if (next === undefined) return;
      event.preventDefault();
      selectFeatured(next);
      if (event.target !== stage) featuredCards[featuredIndex].focus({ preventScroll: true });
    });
    let touchOrigin;
    let suppressClickUntil = 0;
    stage.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch" || event.pointerType === "pen") touchOrigin = { x: event.clientX, y: event.clientY };
    });
    stage.addEventListener("pointercancel", () => { touchOrigin = undefined; });
    stage.addEventListener("pointerup", event => {
      if (!touchOrigin) return;
      const dx = event.clientX - touchOrigin.x;
      const dy = event.clientY - touchOrigin.y;
      touchOrigin = undefined;
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      suppressClickUntil = Date.now() + 400;
      selectFeatured(featuredIndex + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    selectFeatured(0);
  }
  function updateLibraryCounts() {
    document.querySelector("#saved-count").textContent = favorites.size;
    document.querySelector("#recent-count").textContent = recent.length;
    document.querySelectorAll("[data-library-count]").forEach(node => {
      const value = node.dataset.libraryCount === "saved" ? favorites.size : recent.length;
      node.textContent = value;
      node.hidden = value === 0;
    });
  }
  function rememberItem(item) {
    recent = [item.id, ...recent.filter(id => id !== item.id)].slice(0, 24);
    persistLibrary("recent", recent);
    updateLibraryCounts();
    renderRecentShelf();
  }
  function renderRecentShelf() {
    const shelf = document.querySelector("#recent-shelf-grid");
    shelf.replaceChildren();
    const recentItems = recent.map(id => byId.get(id)).filter(item => item && item.sourceStatus !== "unavailable").slice(0, 3);
    recentShelf.hidden = recentItems.length === 0;
    for (const item of recentItems) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-pick";
      button.dataset.recentId = item.id;
      button.setAttribute("aria-label", `Open ${item.title} again`);
      const image = document.createElement("img");
      image.src = item.image || "assets/fallback-cover.svg";
      image.alt = "";
      image.width = 80;
      image.height = 80;
      image.loading = "lazy";
      image.addEventListener("error", () => { image.src = "assets/fallback-cover.svg"; }, { once: true });
      const copy = document.createElement("span");
      copy.className = "recent-pick-copy";
      const meta = document.createElement("span");
      meta.textContent = categoryNames[item.category] || item.category;
      const title = document.createElement("strong");
      title.textContent = item.title;
      copy.append(meta, title);
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrow.setAttribute("class", "recent-pick-arrow");
      arrow.setAttribute("viewBox", "0 0 24 24");
      arrow.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M5 19 19 5M5 5h14v14");
      arrow.append(path);
      button.append(image, copy, arrow);
      button.addEventListener("click", () => openItem(item));
      shelf.append(button);
    }
  }
  function dismissPick(restoreFocus = false) {
    quickPick.hidden = true;
    pickButton.setAttribute("aria-expanded", "false");
    pickedItem = undefined;
    delete quickPick.dataset.pickId;
    if (restoreFocus) pickButton.focus();
  }
  function chooseQuickPick() {
    const candidates = visible.filter(item => item.sourceStatus !== "unavailable");
    if (!candidates.length) return;
    const alternatives = candidates.filter(item => item.id !== pickedItem?.id);
    const pool = alternatives.length ? alternatives : candidates;
    pickedItem = pool[Math.floor(Math.random() * pool.length)];
    quickPick.dataset.pickId = pickedItem.id;
    const image = document.querySelector("#pick-cover");
    image.src = pickedItem.image || "assets/fallback-cover.svg";
    image.alt = `${pickedItem.title} cover`;
    document.querySelector("#pick-title").textContent = pickedItem.title;
    document.querySelector("#pick-category").textContent = categoryNames[pickedItem.category] || pickedItem.category;
    document.querySelector("#pick-context").textContent = `Picked from ${candidates.length.toLocaleString()} matching ${candidates.length === 1 ? "title" : "titles"}. Known missing sources are left out.`;
    document.querySelector("#pick-again").disabled = candidates.length < 2;
    document.querySelector("#pick-play").setAttribute("aria-label", `Play ${pickedItem.title}`);
    updateSaveButton(document.querySelector("#pick-save"), pickedItem);
    quickPick.hidden = false;
    pickButton.setAttribute("aria-expanded", "true");
  }
  function updateDiscoveryTools() {
    const hasQuery = Boolean(search.value.trim());
    document.querySelector("#clear-query").hidden = !search.value;
    document.querySelector("#quick-searches").hidden = hasQuery || !["all", "popular"].includes(category);
    pickButton.disabled = !visible.some(item => item.sourceStatus !== "unavailable");
    pickButton.title = pickButton.disabled ? "No titles with sources in this view. Try another search or category." : "Preview a random title from this view";
    const activeFilters = document.querySelector("#active-filters");
    activeFilters.replaceChildren();
    const filters = [
      { key: "q", label: hasQuery ? `Search: ${search.value.trim()}` : "" },
      { key: "available", label: hideUnavailable.checked ? "Missing sources hidden" : "" },
      { key: "sort", label: sort.value !== "recommended" ? sort.selectedOptions[0].textContent : "" }
    ].filter(filter => filter.label);
    for (const filter of filters) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.filter = filter.key;
      button.setAttribute("aria-label", `Remove ${filter.label}`);
      const label = document.createElement("span");
      label.textContent = filter.label;
      const cross = document.createElement("span");
      cross.textContent = "×";
      cross.setAttribute("aria-hidden", "true");
      button.append(label, cross);
      button.addEventListener("click", () => {
        clearTimeout(searchTimer);
        const target = filter.key === "q" ? search : filter.key === "sort" ? sort : hideUnavailable;
        if (filter.key === "q") search.value = "";
        else if (filter.key === "sort") sort.value = "recommended";
        else hideUnavailable.checked = false;
        writeFilters();
        render();
        target.focus({ preventScroll: true });
      });
      activeFilters.append(button);
    }
    document.querySelector("#filter-summary").hidden = !filters.length;
    document.querySelector("#search-all-results").hidden = !hasQuery || ["all", "popular"].includes(category);
  }
  function updateTabs() {
    tabs.forEach(tab => {
      const active = tab.dataset.category === category;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-library-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.libraryView === category));
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
    const pickHadFocus = quickPick.contains(document.activeElement);
    dismissPick();
    visible = filteredItems();
    updateDiscoveryTools();
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
    if (pickHadFocus) (pickButton.disabled ? tabs.find(tab => tab.dataset.category === category) : pickButton)?.focus({ preventScroll: true });
  }

  function closeSharePanel(restoreFocus = false) {
    shareGeneration++;
    playerShare.hidden = true;
    shareGame.setAttribute("aria-expanded", "false");
    copyLink.disabled = false;
    copyLink.textContent = "Copy link";
    shareFeedback.textContent = "Select the link or use Copy link.";
    if (restoreFocus && dialog.open) shareGame.focus({ preventScroll: true });
  }
  function syncPlayerTools(item) {
    closeSharePanel();
    updateSaveButton(playerSave, item);
    document.querySelector("#player-save-feedback").textContent = "";
    document.querySelector("#player-category").textContent = `${categoryNames[item.category] || "Collection"} / TURBOGAMES`;
    const link = new URL(location.href);
    link.search = "";
    link.hash = "";
    link.searchParams.set("play", item.id);
    shareLink.value = link.href;
  }
  async function loadItem(item) {
    flushSave();
    loadController?.abort();
    loadController = new AbortController();
    activeItem = item;
    syncPlayerTools(item);
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
    document.querySelector("#clear-query").hidden = !search.value;
    dismissPick();
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
  document.querySelectorAll("[data-library-view]").forEach(button => button.addEventListener("click", () => {
    resetCollection(button.dataset.libraryView);
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
    tabs.find(tab => tab.dataset.category === category)?.focus({ preventScroll: true });
  }));
  document.querySelector("#clear-query").addEventListener("click", () => {
    clearTimeout(searchTimer);
    search.value = "";
    writeFilters();
    render();
    search.focus();
  });
  document.querySelector("#reset-filters").addEventListener("click", () => { resetCollection(); search.focus(); });
  document.querySelector("#search-all-results").addEventListener("click", () => {
    clearTimeout(searchTimer);
    category = "all";
    updateTabs();
    writeFilters();
    render();
    search.focus({ preventScroll: true });
  });
  document.querySelectorAll("#quick-searches [data-query]").forEach(button => button.addEventListener("click", () => {
    clearTimeout(searchTimer);
    category = "all";
    search.value = button.dataset.query;
    updateTabs();
    writeFilters();
    render();
    search.focus({ preventScroll: true });
  }));
  document.querySelector("#see-recent").addEventListener("click", () => {
    resetCollection("recent");
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
    tabs.find(tab => tab.dataset.category === "recent").focus({ preventScroll: true });
  });
  pickButton.addEventListener("click", () => {
    clearTimeout(searchTimer);
    // A click may arrive during the search debounce; pick from the current input.
    if (category === "popular" && search.value.trim()) category = "all";
    updateTabs();
    writeFilters();
    render();
    chooseQuickPick();
    if (pickedItem) {
      document.querySelector("#pick-title").focus({ preventScroll: true });
      quickPick.scrollIntoView({ block: "nearest" });
    }
  });
  document.querySelector("#pick-again").addEventListener("click", chooseQuickPick);
  document.querySelector("#pick-play").addEventListener("click", () => { if (pickedItem) openItem(pickedItem); });
  document.querySelector("#pick-save").addEventListener("click", () => { if (pickedItem) toggleFavorite(pickedItem); });
  document.querySelector("#dismiss-pick").addEventListener("click", () => dismissPick(true));
  quickPick.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); dismissPick(true); }
  });
  document.querySelector("#pick-cover").addEventListener("error", event => {
    if (!event.currentTarget.src.endsWith("/assets/fallback-cover.svg")) event.currentTarget.src = "assets/fallback-cover.svg";
  });
  initializeShowcase();
  if (featuredGames.length) {
    document.querySelector("#hero-save").addEventListener("click", () => toggleFavorite(featuredGames[featuredIndex].item));
    document.querySelector("#hero-play").addEventListener("click", () => openItem(featuredGames[featuredIndex].item));
    document.querySelector("#featured-browse").addEventListener("click", () => {
      const selectedCategory = featuredGames[featuredIndex].item.category;
      resetCollection(selectedCategory);
      document.querySelector("#catalog").scrollIntoView({ block: "start" });
      tabs.find(tab => tab.dataset.category === selectedCategory)?.focus({ preventScroll: true });
    });
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
  playerSave.addEventListener("click", () => {
    if (!activeItem) return;
    toggleFavorite(activeItem);
    document.querySelector("#player-save-feedback").textContent = feedback.textContent;
  });
  shareGame.addEventListener("click", () => {
    if (!activeItem) return;
    if (!playerShare.hidden) { closeSharePanel(true); return; }
    playerShare.hidden = false;
    shareGame.setAttribute("aria-expanded", "true");
    shareFeedback.textContent = "Select the link or use Copy link.";
    shareLink.focus({ preventScroll: true });
    shareLink.select();
  });
  document.querySelector("#close-share").addEventListener("click", () => closeSharePanel(true));
  playerShare.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSharePanel(true);
    }
  });
  shareLink.addEventListener("click", () => shareLink.select());
  copyLink.addEventListener("click", async () => {
    const generation = shareGeneration;
    const value = shareLink.value;
    if (!activeItem || !value) return;
    copyLink.disabled = true;
    copyLink.textContent = "Copying…";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (generation !== shareGeneration || playerShare.hidden) return;
      shareFeedback.textContent = "Link copied. Share it wherever you like.";
      copyLink.textContent = "Copied";
    } catch {
      if (generation !== shareGeneration || playerShare.hidden) return;
      copyLink.textContent = "Copy link";
      shareFeedback.textContent = "Automatic copying is unavailable. The link is selected; use your browser's Copy command.";
      shareLink.focus({ preventScroll: true });
      shareLink.select();
    } finally {
      if (generation === shareGeneration) copyLink.disabled = false;
    }
  });
  dialog.addEventListener("close", () => {
    // A queued close event can arrive after Forward has already reopened it.
    if (dialog.open) return;
    closeSharePanel();
    shareLink.value = "";
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
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (!playerShare.hidden) closeSharePanel(true);
    else closePlayer();
  });
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
  document.addEventListener("fullscreenchange", () => {
    const expanded = Boolean(document.fullscreenElement);
    const button = document.querySelector("#fullscreen-button");
    const label = expanded ? "Exit fullscreen" : "Go fullscreen";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.setAttribute("aria-pressed", String(expanded));
    button.querySelector("path").setAttribute("d", expanded
      ? "M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4"
      : "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5");
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement !== search && !dialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault(); search.focus();
    }
  });
  readFilters();
  document.querySelectorAll("[data-scope-count]").forEach(node => {
    node.textContent = (categoryTotals[node.dataset.scopeCount] || 0).toLocaleString();
  });
  updateLibraryCounts();
  renderRecentShelf();
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
