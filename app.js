(() => {
  "use strict";
  const items = window.TURBO_CATALOG || [];
  const gameCategories = window.TurboGameCategories;
  const allowedGenres = new Set(gameCategories.categories.map(category => category.id));
  const genresById = new Map(items.map(item => [item.id, Array.isArray(item.genreHints) ? item.genreHints.filter(id => allowedGenres.has(id)) : gameCategories.genresFor(item)]));
  const fallbackCover = item => window.TurboCoverArt?.coverFor(item, genresById.get(item.id)?.[0] || "arcade") || "assets/fallback-cover.svg";
  const coverSource = item => item.imageType === "illustrated" || !item.image ? fallbackCover(item) : item.image;
  const boxedCovers = new Set(["library-source/flash/clpottyracers.html", "library-source/flash/clpottyracers2.html"]);
  function fitCover(image, item) {
    image.classList.toggle("is-contained", item?.imageFit === "contain");
    image.classList.toggle("is-letterboxed", boxedCovers.has(item?.id));
  }
  const genreNames = new Map(gameCategories.categories.map(genre => [genre.id, genre.label]));
  const genreButtons = [];
  let genre = "all";
  const byId = new Map(items.map(item => [item.id, item]));
  const starterIds = new Set(["library-source/html5-games/cl2048.html", "library-source/html5-games/clhextris.html", "library-source/html5-games/clblockblast.html", "library-source/flash/clrun.html", "library-source/flash/clbloons.html", "orbit-breaker", "little-match"]);
  const starterRank = new Map([...starterIds].map((id, index) => [id, index]));
  const popularRank = new Map([
    "library-source/flash/clrun.html",
    "library-source/html5-games/clbasketrandom.html",
    "library-source/html5-games/clescaperoad-2.html",
    "library-source/flash/clbloons.html",
    "library-source/html5-games/cldrivemady.html"
  ].map((id, index) => [id, index]));
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
  const libraryStorageWarning = "Browser storage is unavailable. Your library will last for this tab.";
  const failedLibraryWrites = new Set();
  const recovery = document.querySelector("#player-recovery");
  const creatorLink = document.querySelector("#creator-site-link");
  const loading = document.querySelector("#player-loading");
  const feedback = document.querySelector("#action-feedback");
  const pickButton = document.querySelector("#pick-game");
  const quickPick = document.querySelector("#quick-pick");
  const recentShelf = document.querySelector("#recent-shelf");
  const mobileFilterDialog = document.querySelector("#mobile-filter-dialog");
  const mobileFilterContent = document.querySelector("#mobile-filter-content");
  const mobileFilterToggle = document.querySelector("#open-mobile-filters");
  const narrowFilters = window.matchMedia("(max-width: 760px)");
  const categoryNames = { popular: "Popular", starters: "Start here", all: "All titles", games: "Games", flash: "Flash", apps: "Apps", emulator: "Emulator", misc: "Misc", saved: "Saved", recent: "Recent" };
  const categoryTotals = items.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + 1;
    if (item.featured) totals.popular += 1;
    return totals;
  }, { all: items.length, popular: 0, starters: items.filter(item => starterIds.has(item.id)).length });
  const parameters = new URLSearchParams(location.search);
  const embedded = parameters.get("embed") === "1" || window.self !== window.top;
  document.documentElement.classList.toggle("is-embedded", embedded);
  const sessionSaves = new Map();
  const memorySaves = new Map();
  function readLibrary(key, fallback = []) {
    try {
      const data = JSON.parse(localStorage.getItem(`turbogames:${key}`) || "[]");
      return Array.isArray(data) ? [...new Set(data.filter(id => typeof id === "string" && byId.has(id)))] : [];
    } catch { return fallback; }
  }
  const favorites = new Set(readLibrary("favorites"));
  const pendingFavorites = new Map();
  const favoriteIntents = new Map();
  let recent = readLibrary("recent").slice(0, 24);
  const normalize = text => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const searchIndex = new Map();
  const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  function searchEntry(item) {
    let entry = searchIndex.get(item.id);
    if (!entry) {
      const genres = genresById.get(item.id).flatMap(id => [id, genreNames.get(id)]);
      const text = normalize([item.title, item.category, ...(item.tags || []), ...genres].join(" "));
      entry = { text, compact: text.replaceAll(" ", "") };
      searchIndex.set(item.id, entry);
    }
    return entry;
  }
  let category = "popular";
  let displayed = 96;
  let visible = [];
  let activeItem;
  let activeNonce;
  let searchTimer;
  let saveTimer;
  let pendingSave;
  let loadController;
  let launchTimer;
  let nativeStartupTimer;
  const nativeStartupLimit = 120000;
  const nativeReadyGrace = 1500;
  let runtimeIssue = "";
  let manualSaveHint = false;
  const manualSaveMessage = () => activeItem?.category === "emulator" ? "Use the game's Save / Export controls to keep emulator progress." : "Some game data lasts only for this session. Use an in-game Save / Export option if available.";
  let feedbackTimer;
  let pickedItem;
  const featuredGames = [
    { id: "orbit-breaker", image: "assets/brand/orbit-preview.webp", type: "Arcade", controls: "Mouse or touch", description: "Move the paddle to break the orbiting stars.", accent: "#d6ff64" },
    { id: "little-match", type: "Puzzle", controls: "Click or tap", description: "Flip the cards and find all eight pairs.", accent: "#a9adff" },
    { id: "library-source/html5-games/cl2048.html", type: "Puzzle", controls: "Arrow keys or swipe", description: "Slide and combine tiles to reach 2048.", accent: "#ffb58c" }
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
    if (message.type === "turbogames:status" && message.code === "native-document-ready") {
      if (dialog.open && frame.dataset.nativeLaunch === "1" && !loading.hidden) {
        finishLoading();
        rememberItem(activeItem);
      }
      return;
    }
    if (message.type === "turbogames:status" && message.code === "runtime-error") {
      const host = typeof message.assetHost === "string" && /^[a-z0-9.-]{1,160}$/i.test(message.assetHost) ? ` from ${message.assetHost}` : "";
      runtimeIssue = `This game reported a loading error${host}. You can restart it or try Open in new tab.`;
      playerStatus.textContent = runtimeIssue;
      return;
    }
    if (message.type === "turbogames:status" && message.code === "manual-saves") {
      manualSaveHint = true;
      playerStatus.textContent = manualSaveMessage();
      const nonce = activeNonce;
      setTimeout(() => { if (activeNonce === nonce) playerStatus.textContent = runtimeIssue; }, 12000);
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
    try {
      localStorage.setItem(`turbogames:${key}`, JSON.stringify(value));
      failedLibraryWrites.delete(key);
      if (!failedLibraryWrites.size && libraryNote.textContent === libraryStorageWarning) libraryNote.textContent = "";
      return true;
    } catch { failedLibraryWrites.add(key); libraryNote.textContent = libraryStorageWarning; return false; }
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
  function favoriteSnapshot() {
    const latest = new Set(readLibrary("favorites", [...favorites]));
    for (const [id, saved] of pendingFavorites) saved ? latest.add(id) : latest.delete(id);
    return latest;
  }
  window.addEventListener("storage", event => {
    try { if (event.storageArea !== localStorage) return; }
    catch { return; }
    if (event.key === null || event.key === "turbogames:favorites") {
      if (event.key === null) pendingFavorites.clear();
      const latest = favoriteSnapshot();
      favorites.clear();
      for (const id of latest) favorites.add(id);
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
      if (category === "saved" || category === "recent") render({ preserveGrid: true });
    }
  });
  async function toggleFavorite(item) {
    // Preserve every click's intent while a different tab holds the shared lock.
    const saved = !(favoriteIntents.get(item.id)?.saved ?? favorites.has(item.id));
    const intent = { saved };
    favoriteIntents.set(item.id, intent);
    const apply = () => {
      const latest = favoriteSnapshot();
      saved ? latest.add(item.id) : latest.delete(item.id);
      const durable = persistLibrary("favorites", [...latest]);
      if (durable) pendingFavorites.clear();
      else pendingFavorites.set(item.id, saved);
      favorites.clear();
      for (const id of latest) favorites.add(id);
      if (favoriteIntents.get(item.id) === intent) favoriteIntents.delete(item.id);
      updateLibraryCounts();
      if (category === "saved") render({ preserveGrid: true });
      document.querySelectorAll("[data-save-id]").forEach(button => {
        const game = byId.get(button.dataset.saveId);
        if (game) updateSaveButton(button, game);
      });
      const message = saved ? `${item.title} saved${durable ? " to your shortlist" : " for this tab"}.` : `${item.title} removed from Saved${durable ? "" : " for this tab"}.`;
      tellAction(message);
      return message;
    };
    let started = false;
    try {
      if (navigator.locks?.request) {
        return await navigator.locks.request("turbogames:favorites", () => { started = true; return apply(); });
      }
    } catch (error) {
      if (started) throw error;
      // Storage and locks can be denied independently in embedded browsers.
    }
    return apply();
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
    document.querySelector("#featured-description").textContent = selected.description;
    document.querySelector("#featured-meta").textContent = `${selected.type} · ${selected.controls}`;
    document.querySelector("#featured-position").textContent = `${featuredIndex + 1} of ${featuredGames.length}`;
    document.querySelector("#featured-status-title").textContent = ` — ${selected.item.title}`;
    document.querySelector(".welcome").style.setProperty("--stage-accent", selected.accent);
    const play = document.querySelector("#hero-play");
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
      image.src = feature.image || coverSource(feature.item);
      if (!feature.image) fitCover(image, feature.item);
      image.addEventListener("error", () => {
        fitCover(image);
        image.alt = `${feature.item.title} cover illustration`;
        image.src = fallbackCover(feature.item);
      }, { once: true });
      image.alt = index === 0 ? "Actual Orbit Breaker game canvas with colored targets, a ball, and a lime paddle" : `${feature.item.title} artwork from the existing TurboGames catalog`;
      image.width = 400;
      image.height = 400;
      image.decoding = "async";
      art.append(image);
      const caption = document.createElement("span");
      caption.className = "featured-card-caption";
      caption.textContent = feature.item.title;
      card.append(art, caption);
      card.addEventListener("click", () => index === featuredIndex ? openItem(feature.item) : selectFeatured(index));
      cards.append(card);
      featuredCards.push(card);
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${feature.item.title}`);
      dot.setAttribute("aria-controls", "featured-cards");
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
    document.querySelector("#ribbon-saved-detail").textContent = favorites.size ? `${favorites.size} saved in this browser` : "Keep your favorites here";
    document.querySelector("#ribbon-recent-detail").textContent = recent.length ? `${recent.length} recently opened` : "Reopen a recent game";
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
      image.src = coverSource(item);
      fitCover(image, item);
      image.alt = "";
      image.width = 80;
      image.height = 80;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        fitCover(image);
        image.src = fallbackCover(item);
      }, { once: true });
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
    image.src = coverSource(pickedItem);
    fitCover(image, pickedItem);
    image.alt = `${pickedItem.title} cover`;
    document.querySelector("#pick-title").textContent = pickedItem.title;
    document.querySelector("#pick-category").textContent = categoryNames[pickedItem.category] || pickedItem.category;
    document.querySelector("#pick-context").textContent = `From ${candidates.length.toLocaleString()} ${candidates.length === 1 ? "matching title" : "matching titles"}. Picks skip known missing sources, but some games still need files from their original sites.`;
    document.querySelector("#pick-again").disabled = candidates.length < 2;
    document.querySelector("#pick-play").setAttribute("aria-label", `Play ${pickedItem.title}`);
    updateSaveButton(document.querySelector("#pick-save"), pickedItem);
    quickPick.hidden = false;
    pickButton.setAttribute("aria-expanded", "true");
  }
  function updateDiscoveryTools() {
    const hasQuery = Boolean(search.value.trim());
    document.querySelector("#clear-query").hidden = !search.value;
    document.querySelector("#quick-searches").hidden = hasQuery || genre !== "all" || !["all", "popular"].includes(category);
    pickButton.disabled = !visible.some(item => item.sourceStatus !== "unavailable");
    pickButton.title = pickButton.disabled ? "No titles with sources in this view. Try another search or category." : "Preview a random title from this view";
    const activeFilters = document.querySelector("#active-filters");
    activeFilters.replaceChildren();
    const filters = [
      { key: "genre", label: genre !== "all" ? `Category: ${genreNames.get(genre)}` : "" },
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
        const target = filter.key === "genre" ? genreButtons[0] : filter.key === "q" ? search : filter.key === "sort" ? sort : hideUnavailable;
        if (filter.key === "genre") genre = "all";
        else if (filter.key === "q") search.value = "";
        else if (filter.key === "sort") sort.value = "recommended";
        else hideUnavailable.checked = false;
        writeFilters();
        render();
        const visibleTarget = mobileFilterContent.contains(target) && !mobileFilterDialog.open ? mobileFilterToggle : target;
        visibleTarget.focus({ preventScroll: true });
      });
      activeFilters.append(button);
    }
    document.querySelector("#filter-summary").hidden = !filters.length;
    document.querySelector("#search-all-results").hidden = !hasQuery || (["all", "popular"].includes(category) && genre === "all");
  }
  function initializeGenres() {
    const container = document.querySelector("#genre-filters");
    for (const definition of gameCategories.categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.genre = definition.id;
      const label = document.createElement("span");
      label.textContent = definition.label;
      const total = document.createElement("span");
      total.className = "genre-count";
      total.setAttribute("aria-hidden", "true");
      button.append(label, total);
      button.addEventListener("click", () => {
        clearTimeout(searchTimer);
        genre = definition.id;
        if (category === "popular") category = "all";
        updateTabs();
        writeFilters();
        render();
      });
      container.append(button);
      genreButtons.push(button);
    }
  }
  function updateGenres(matches) {
    const totals = new Map(gameCategories.categories.map(definition => [definition.id, 0]));
    totals.set("all", matches.length);
    for (const item of matches) for (const id of genresById.get(item.id)) totals.set(id, totals.get(id) + 1);
    for (const button of genreButtons) {
      const id = button.dataset.genre;
      const total = totals.get(id);
      button.setAttribute("aria-pressed", String(id === genre));
      button.setAttribute("aria-label", `${genreNames.get(id)}: ${total.toLocaleString()} ${total === 1 ? "title" : "titles"}`);
      button.querySelector(".genre-count").textContent = total.toLocaleString();
    }
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
    const values = { view: category === "popular" && !search.value.trim() && genre === "all" ? "" : category, genre: genre === "all" ? "" : genre, q: search.value.trim(), sort: sort.value === "recommended" ? "" : sort.value, available: hideUnavailable.checked ? "1" : "" };
    for (const [key, value] of Object.entries(values)) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    history.replaceState(history.state, "", url);
  }
  function readFilters() {
    const params = new URLSearchParams(location.search);
    category = Object.hasOwn(categoryNames, params.get("view")) ? params.get("view") : "popular";
    genre = genreNames.has(params.get("genre")) ? params.get("genre") : "all";
    search.value = params.get("q") || "";
    if (category === "popular" && !params.has("view") && (search.value.trim() || genre !== "all")) category = "all";
    sort.value = ["title-asc", "title-desc"].includes(params.get("sort")) ? params.get("sort") : "recommended";
    hideUnavailable.checked = params.get("available") === "1";
    updateTabs();
  }

  function matchingItems(query, terms, compactQuery) {
    // Genre counts on Popular describe the collection the genre shortcuts open.
    const matchesCollection = {
      popular: () => true,
      all: () => true,
      starters: item => starterIds.has(item.id),
      saved: item => favorites.has(item.id),
      recent: item => recent.includes(item.id)
    }[category] || (item => item.category === category);
    const availableOnly = hideUnavailable.checked;
    return items.filter(item => {
      if (!matchesCollection(item) || (availableOnly && item.sourceStatus === "unavailable")) return false;
      if (!query) return true;
      const entry = searchEntry(item);
      return terms.every(term => entry.text.includes(term)) || entry.compact.includes(compactQuery);
    });
  }
  function sortMatches(matches, query, terms, compactQuery) {
    if (sort.value !== "recommended") {
      const direction = sort.value === "title-asc" ? 1 : -1;
      return matches.sort((a, b) => direction * titleCollator.compare(a.title, b.title));
    }
    if (category === "starters") return matches.sort((a, b) => starterRank.get(a.id) - starterRank.get(b.id));
    if (category === "recent") return matches.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    if (!query) {
      if (category === "popular") {
        const rank = item => popularRank.get(item.id) ?? popularRank.size;
        return matches.sort((a, b) => rank(a) - rank(b));
      }
      return matches;
    }
    const ranks = new Map(matches.map(item => {
      const entry = searchEntry(item);
      const title = entry.title ??= normalize(item.title);
      const compactTitle = entry.compactTitle ??= title.replaceAll(" ", "");
      if (title === query || compactTitle === compactQuery) return [item.id, 3];
      if (title.startsWith(query)) return [item.id, 2];
      if (terms.every(term => title.includes(term)) || compactTitle.includes(compactQuery)) return [item.id, 1];
      return [item.id, 0];
    }));
    return matches.sort((a, b) => ranks.get(b.id) - ranks.get(a.id)
      || Number(a.sourceStatus === "unavailable") - Number(b.sourceStatus === "unavailable")
      || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }

  function createCard(item, index) {
    const card = document.createElement("article");
    card.className = `game-card${item.sourceStatus === "unavailable" ? " source-unavailable" : ""}`;
    card.dataset.gameId = item.id;
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
    fitCover(image, item);
    image.src = coverSource(item);
    image.alt = `${item.title} cover`;
    image.loading = document.body.classList.contains("is-browsing") && index < 4 ? "eager" : "lazy";
    image.decoding = "async";
    image.width = 400;
    image.height = 400;
    image.addEventListener("error", () => {
      fitCover(image);
      image.src = fallbackCover(item);
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
    if (item.sourceBytes > 2 * 1024 * 1024) {
      const size = document.createElement("span");
      size.className = "card-size";
      size.textContent = "Large game";
      size.title = `Game page: ${(item.sourceBytes / 1048576).toFixed(1)} MB before compression, plus any additional game assets.`;
      art.append(size);
    }
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
  function render({ preserveGrid = false } = {}) {
    const pickHadFocus = quickPick.contains(document.activeElement);
    const focusedCard = preserveGrid ? document.activeElement?.closest(".game-card") : null;
    const focusedId = focusedCard?.dataset.gameId;
    const focusedIndex = focusedCard ? [...grid.children].indexOf(focusedCard) : -1;
    const focusedControl = document.activeElement?.classList.contains("save-game") ? ".save-game" : ".card-launch";
    const previousLimit = displayed;
    dismissPick();
    const query = normalize(search.value);
    const terms = query ? query.split(" ") : [];
    const compactQuery = query.replaceAll(" ", "");
    const matches = matchingItems(query, terms, compactQuery);
    const scoped = matches.filter(item => (category !== "popular" || item.featured)
      && (genre === "all" || genresById.get(item.id).includes(genre)));
    visible = sortMatches(scoped, query, terms, compactQuery);
    updateGenres(matches);
    updateDiscoveryTools();
    document.body.classList.toggle("is-browsing", category !== "popular" || genre !== "all" || Boolean(search.value.trim()));
    document.querySelector("#catalog-title").textContent = category === "saved" ? "Saved" : category === "recent" ? "Recently opened" : category === "starters" ? "Starter games" : "Browse";
    document.querySelector("#starter-note").hidden = category !== "starters";
    displayed = preserveGrid ? previousLimit : 96;
    const focusedResult = focusedId ? visible.findIndex(item => item.id === focusedId) : -1;
    if (focusedResult >= displayed) displayed = Math.ceil((focusedResult + 1) / 96) * 96;
    grid.replaceChildren();
    count.textContent = `${visible.length.toLocaleString()} ${visible.length === 1 ? "item" : "items"} · ${categoryNames[category]}${genre !== "all" ? ` · ${genreNames.get(genre)}` : ""}`;
    updateMobileFilterSummary();
    const noLibrary = !search.value.trim() && (category === "saved" && favorites.size === 0 || category === "recent" && recent.length === 0);
    document.querySelector("#empty-icon").textContent = noLibrary ? category === "saved" ? "♡" : "↶" : "⌕";
    document.querySelector("#empty-title").textContent = noLibrary ? category === "saved" ? "Nothing saved yet" : "No recent titles" : "No matches";
    document.querySelector("#empty-description").textContent = noLibrary ? category === "saved" ? "Tap a heart to save a title." : "Open a game to add it here." : "Try another search or reset the filters.";
    document.querySelector("#clear-search").textContent = noLibrary ? "Browse all" : "Reset filters";
    empty.hidden = visible.length > 0;
    grid.hidden = visible.length === 0;
    appendCards(0);
    if (focusedCard) {
      const cards = [...grid.children];
      const nextCard = cards.find(card => card.dataset.gameId === focusedId) || cards[Math.min(focusedIndex, cards.length - 1)];
      const nextControl = nextCard?.querySelector(focusedControl) || document.querySelector("#clear-search");
      nextControl.focus({ preventScroll: true });
      nextControl.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else if (pickHadFocus) (pickButton.disabled ? tabs.find(tab => tab.dataset.category === category) : pickButton)?.focus({ preventScroll: true });
  }

  function updateMobileFilterSummary() {
    const active = Number(genre !== "all") + Number(sort.value !== "recommended") + Number(hideUnavailable.checked);
    const badge = document.querySelector("#mobile-filter-count");
    badge.textContent = active;
    badge.hidden = active === 0;
    mobileFilterToggle.setAttribute("aria-label", active ? `Filters, ${active} active` : "Filters");
    document.querySelector("#mobile-filter-results").textContent = `${visible.length.toLocaleString()} ${visible.length === 1 ? "title" : "titles"} · ${categoryNames[category]}`;
    document.querySelector("#apply-mobile-filters").textContent = `Show ${visible.length.toLocaleString()} ${visible.length === 1 ? "title" : "titles"}`;
    document.querySelector("#reset-mobile-filters").disabled = active === 0;
  }
  function closeMobileFilters(restoreFocus = true, showResults = false) {
    if (mobileFilterDialog.open) mobileFilterDialog.close();
    mobileFilterToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus && narrowFilters.matches && !dialog.open) {
      if (showResults) document.querySelector("#catalog").scrollIntoView({ block: "start", behavior: "instant" });
      mobileFilterToggle.focus({ preventScroll: true });
      if (!showResults) mobileFilterToggle.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
  function initializeMobileFilters() {
    const genreSection = document.querySelector(".genre-section");
    const options = document.querySelector(".collection-filters");
    const genreHome = document.createComment("genre filters home");
    const optionsHome = document.createComment("collection options home");
    genreSection.before(genreHome);
    options.before(optionsHome);
    const syncLayout = () => {
      const focused = document.activeElement;
      if (narrowFilters.matches) {
        const movingFocus = genreSection.contains(focused) || options.contains(focused);
        mobileFilterContent.append(genreSection, options);
        if (movingFocus) mobileFilterToggle.focus();
      } else {
        const restore = mobileFilterDialog.contains(focused) || focused === mobileFilterToggle;
        closeMobileFilters(false);
        genreHome.after(genreSection);
        optionsHome.after(options);
        if (restore) {
          const target = genreSection.contains(focused) || options.contains(focused) ? focused : genreSection.querySelector('[aria-pressed="true"]') || genreButtons[0];
          target?.focus();
        }
      }
    };
    mobileFilterToggle.addEventListener("click", () => {
      if (!narrowFilters.matches || dialog.open) return;
      updateMobileFilterSummary();
      mobileFilterDialog.showModal();
      mobileFilterToggle.setAttribute("aria-expanded", "true");
      document.querySelector("#close-mobile-filters").focus();
    });
    document.querySelector("#close-mobile-filters").addEventListener("click", () => closeMobileFilters());
    document.querySelector("#apply-mobile-filters").addEventListener("click", () => closeMobileFilters(true, true));
    document.querySelector("#reset-mobile-filters").addEventListener("click", () => {
      clearTimeout(searchTimer);
      genre = "all";
      sort.value = "recommended";
      hideUnavailable.checked = false;
      writeFilters();
      render();
      genreButtons[0].focus({ preventScroll: true });
    });
    mobileFilterDialog.addEventListener("cancel", event => { event.preventDefault(); closeMobileFilters(); });
    mobileFilterDialog.addEventListener("keydown", event => {
      if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;
      const targets = [...mobileFilterDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0);
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) return;
      const active = document.activeElement;
      if (event.shiftKey ? active === first || !targets.includes(active) : active === last || !targets.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    mobileFilterDialog.addEventListener("click", event => { if (event.target === mobileFilterDialog) closeMobileFilters(); });
    mobileFilterDialog.addEventListener("close", () => {
      mobileFilterToggle.setAttribute("aria-expanded", "false");
      if (narrowFilters.matches && !dialog.open) mobileFilterToggle.focus({ preventScroll: true });
    });
    if (narrowFilters.addEventListener) narrowFilters.addEventListener("change", syncLayout);
    else narrowFilters.addListener(syncLayout);
    syncLayout();
  }

  function closeSharePanel(restoreFocus = false) {
    shareGeneration++;
    playerShare.hidden = true;
    shareGame.setAttribute("aria-expanded", "false");
    copyLink.disabled = false;
    copyLink.textContent = "Copy link";
    shareFeedback.textContent = "";
    if (restoreFocus && dialog.open) shareGame.focus({ preventScroll: true });
  }
  function syncPlayerTools(item) {
    closeSharePanel();
    updateSaveButton(playerSave, item);
    document.querySelector("#player-save-feedback").textContent = "";
    document.querySelector("#player-category").textContent = categoryNames[item.category] || "Game";
    const link = new URL(location.href);
    link.search = "";
    link.hash = "";
    link.searchParams.set("play", item.id);
    shareLink.value = link.href;
  }
  async function loadItem(item) {
    flushSave();
    clearTimeout(launchTimer);
    clearTimeout(nativeStartupTimer);
    loadController?.abort();
    loadController = new AbortController();
    activeItem = item;
    syncPlayerTools(item);
    activeNonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const nonce = activeNonce;
    manualSaveHint = false;
    runtimeIssue = "";
    const config = { turboGames: 1, nonce, parentOrigin: location.origin, local: readSave(item), session: sessionSaves.get(item.id) || {} };
    // Set srcdoc before insertion: a fresh iframe replaces its initial blank
    // document instead of adding child navigations to the browser Back stack.
    const nextFrame = frame.cloneNode(false);
    nextFrame.removeAttribute("srcdoc");
    nextFrame.removeAttribute("src");
    nextFrame.removeAttribute("name");
    delete nextFrame.dataset.nativeLaunch;
    nextFrame.addEventListener("load", onFrameLoad);
    frame.remove();
    frame = nextFrame;
    frame.title = item.title;
    recovery.hidden = true;
    window.TurboSourceRecovery.setCreatorLink(creatorLink, null);
    loading.hidden = false;
    loading.querySelector("h3").textContent = `Opening ${item.title}…`;
    document.querySelector("#slow-loading").hidden = true;
    document.querySelector("#loading-new-tab").href = openTab.href;
    const downloadStatus = document.querySelector("#download-status");
    const progress = document.querySelector("#launch-progress");
    progress.removeAttribute("value");
    downloadStatus.textContent = item.sourceBytes > 2 * 1024 * 1024 ? `Game page: ${(item.sourceBytes / 1048576).toFixed(1)} MB uncompressed. More files may load.` : "Loading the game page. Some games download more files after opening.";
    launchTimer = setTimeout(() => { if (activeNonce === nonce && !loading.hidden) document.querySelector("#slow-loading").hidden = false; }, 12000);
    if (item.sourceStatus === "unavailable") {
      playerStatus.textContent = item.sourceIssue || "This game needs a working source before it can be played.";
      showRecovery(item.sourceIssue || "The original game files are unavailable. Choose another title from the collection.", true);
      return;
    }
    playerStatus.textContent = "";
    let timedOut = false;
    const requestController = loadController;
    const requestTimeout = setTimeout(() => { timedOut = true; requestController.abort(); }, 60000);
    try {
      const source = new URL(localSource(item), document.baseURI);
      if (item.directLaunch) {
        const response = await fetch(source, { method: "HEAD", signal: loadController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (activeNonce !== nonce) return;
        // Prepared large pages install the same isolated storage bridge before
        // their game scripts. Native navigation avoids copying their embedded
        // tens of megabytes through fetch/text/replace/srcdoc in this page.
        frame.name = JSON.stringify(config);
        frame.dataset.nativeLaunch = "1";
        frame.src = source.href;
        nativeStartupTimer = setTimeout(() => {
          failNativeStartup(nonce, "The game page took too long to start. Try again or choose another game.");
        }, nativeStartupLimit);
        playerSurface.append(frame);
        return;
      }
      const response = await fetch(source, { signal: loadController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let html;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        let received = 0;
        let lastUpdate = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
          received += value.byteLength;
          if (activeNonce === nonce && performance.now() - lastUpdate > 200) {
            const amount = received < 1048576 ? `${Math.ceil(received / 1024)} KB` : `${(received / 1048576).toFixed(1)} MB`;
            downloadStatus.textContent = `Game page: ${amount} downloaded. More files may load.`;
            lastUpdate = performance.now();
          }
        }
        chunks.push(decoder.decode());
        html = chunks.join("");
      } else html = await response.text();
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
      if (activeNonce === nonce && (timedOut || error.name !== "AbortError")) showRecovery(timedOut ? "The game page took too long to download. Check your connection, then try again or choose a smaller game." : "The game page could not be downloaded. Check your connection and try again.");
    } finally { clearTimeout(requestTimeout); }
  }
  function showRecovery(message, missing = false) {
    clearTimeout(launchTimer);
    clearTimeout(nativeStartupTimer);
    loading.hidden = true;
    playerStatus.textContent = "";
    const hasCreatorLink = window.TurboSourceRecovery.setCreatorLink(creatorLink, missing ? activeItem?.externalUrl : null);
    document.querySelector("#recovery-title").textContent = hasCreatorLink ? "Play on the creator’s website" : missing ? "This title needs a new source" : "This game couldn't load";
    document.querySelector("#recovery-description").textContent = message;
    document.querySelector("#retry-game").hidden = missing;
    recovery.hidden = false;
  }
  function openItem(item, navigate = true) {
    closeMobileFilters(false);
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
  function finishLoading() {
    clearTimeout(launchTimer);
    clearTimeout(nativeStartupTimer);
    loading.hidden = true;
    playerStatus.textContent = runtimeIssue || (manualSaveHint ? manualSaveMessage() : "");
  }
  function failNativeStartup(nonce, message) {
    if (activeNonce !== nonce || !dialog.open || loading.hidden) return;
    frame.remove();
    showRecovery(message);
  }
  function onFrameLoad(event) {
    if (event.currentTarget !== frame || !activeItem || !dialog.open) return;
    if (frame.dataset.nativeLaunch === "1") {
      if (loading.hidden) return;
      // Failed native navigations fire load as well. Give a successful page's
      // queued bridge acknowledgement a chance to arrive before recovering.
      const nonce = activeNonce;
      clearTimeout(nativeStartupTimer);
      nativeStartupTimer = setTimeout(() => {
        failNativeStartup(nonce, "The game page didn't start. Check your connection and try again.");
      }, nativeReadyGrace);
    } else if (frame.hasAttribute("srcdoc")) finishLoading();
  }
  frame.addEventListener("load", onFrameLoad);
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups allow-presentation allow-downloads");
  frame.setAttribute("referrerpolicy", "no-referrer");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      clearTimeout(searchTimer);
      category = tab.dataset.category;
      if (category === "popular") genre = "all";
      updateTabs();
      writeFilters();
      render();
    });
  });
  function applySearch() {
    clearTimeout(searchTimer);
    if (category === "popular" && search.value.trim()) category = "all";
    updateTabs();
    writeFilters();
    render();
  }
  search.addEventListener("input", () => {
    document.querySelector("#clear-query").hidden = !search.value;
    dismissPick();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 120);
  });
  search.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing || event.repeat || !search.value.trim()) return;
    event.preventDefault();
    if (new URLSearchParams(location.search).get("q") !== search.value.trim()) applySearch();
    const target = grid.querySelector(".card-launch") || document.querySelector("#clear-search");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "instant" });
  });
  for (const input of [sort, hideUnavailable]) input.addEventListener("change", () => { writeFilters(); render(); });
  more.addEventListener("click", () => {
    const start = displayed;
    displayed += 96;
    appendCards(start);
    const nextCard = grid.children[start]?.querySelector(".card-launch");
    nextCard?.focus({ preventScroll: true });
    nextCard?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  function resetCollection(nextCategory = "all") {
    clearTimeout(searchTimer);
    search.value = "";
    category = nextCategory;
    genre = "all";
    sort.value = "recommended";
    hideUnavailable.checked = false;
    updateTabs();
    writeFilters();
    render();
  }
  document.querySelector("#clear-search").addEventListener("click", () => { resetCollection(); search.focus(); });
  document.querySelector("#ribbon-search").addEventListener("click", () => {
    resetCollection();
    window.scrollTo({ top: 0, behavior: "instant" });
    search.focus({ preventScroll: true });
  });
  document.querySelector("#hero-starters").addEventListener("click", event => {
    event.preventDefault();
    resetCollection("starters");
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
    tabs.find(tab => tab.dataset.category === "starters").focus({ preventScroll: true });
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
    genre = "all";
    updateTabs();
    writeFilters();
    render();
    search.focus({ preventScroll: true });
  });
  document.querySelectorAll("#quick-searches [data-query]").forEach(button => button.addEventListener("click", () => {
    clearTimeout(searchTimer);
    category = "all";
    const query = button.dataset.query;
    genre = query !== "all" && genreNames.has(query) ? query : "all";
    search.value = genre === "all" ? query : "";
    updateTabs();
    writeFilters();
    render();
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
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
    if (!pickedItem) return;
    const source = fallbackCover(pickedItem);
    if (event.currentTarget.getAttribute("src") !== source) {
      fitCover(event.currentTarget);
      event.currentTarget.src = source;
    }
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
  document.querySelector("#cancel-loading").addEventListener("click", closePlayer);
  document.querySelector("#return-to-collection").addEventListener("click", closePlayer);
  document.querySelector("#retry-game").addEventListener("click", () => { if (activeItem) loadItem(activeItem); });
  document.querySelector("#reload-game").addEventListener("click", () => { if (activeItem) loadItem(activeItem); });
  playerSave.addEventListener("click", async () => {
    const item = activeItem;
    if (!item) return;
    const message = await toggleFavorite(item);
    if (dialog.open && activeItem?.id === item.id) document.querySelector("#player-save-feedback").textContent = message;
  });
  shareGame.addEventListener("click", () => {
    if (!activeItem) return;
    if (!playerShare.hidden) { closeSharePanel(true); return; }
    playerShare.hidden = false;
    shareGame.setAttribute("aria-expanded", "true");
    shareFeedback.textContent = "";
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
      shareFeedback.textContent = "Link copied.";
      copyLink.textContent = "Copied";
    } catch {
      if (generation !== shareGeneration || playerShare.hidden) return;
      copyLink.textContent = "Copy link";
      shareFeedback.textContent = "Automatic copying is unavailable. Use your browser’s Copy command on the selected link.";
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
    clearTimeout(launchTimer);
    clearTimeout(nativeStartupTimer);
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
    if (event.key === "/" && document.activeElement !== search && !dialog.open && !mobileFilterDialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault(); search.focus();
    }
  });
  initializeGenres();
  initializeMobileFilters();
  readFilters();
  document.querySelectorAll("[data-scope-count]").forEach(node => {
    node.textContent = (categoryTotals[node.dataset.scopeCount] || 0).toLocaleString();
  });
  document.querySelector("#total-titles").textContent = items.length.toLocaleString();
  updateLibraryCounts();
  renderRecentShelf();
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
