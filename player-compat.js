/* TurboGames: provide per-game storage inside isolated game frames. */
(() => {
  "use strict";
  let config;
  try { config = window.__TURBOGAMES_CONFIG__ || JSON.parse(window.name); } catch { return; }
  if (config?.turboGames !== 1 || typeof config.nonce !== "string" || !/^https?:\/\//.test(config.parentOrigin)) return;
  delete window.__TURBOGAMES_CONFIG__;
  // Legacy Unity loaders often treat merged blob assets as relative paths.
  // Preserve complete asset URLs without changing their relative-path resolver.
  const wrappedUnity = new WeakSet();
  function prepareUnity(loader) {
    if (!loader || typeof loader.instantiate !== "function" || wrappedUnity.has(loader.instantiate)) return loader;
    const original = loader.instantiate;
    function instantiate(...args) {
      const instance = original.apply(this, args);
      const module = instance?.Module;
      if (module && typeof module.resolveBuildUrl === "function") {
        const resolve = module.resolveBuildUrl;
        module.resolveBuildUrl = function (url) {
          return typeof url === "string" && /^(?:blob:|data:|https?:\/\/)/i.test(url)
            ? url : resolve.call(this, url);
        };
      }
      return instance;
    }
    wrappedUnity.add(instantiate);
    try { loader.instantiate = instantiate; } catch { /* Read-only loaders retain their own resolver. */ }
    return loader;
  }
  try {
    let unity = window.UnityLoader;
    Object.defineProperty(window, "UnityLoader", {
      configurable: true,
      get: () => prepareUnity(unity),
      set: value => { unity = prepareUnity(value); }
    });
  } catch { /* A game with a non-configurable global keeps its own loader. */ }
  function install(kind, initial) {
    const values = Object.create(null);
    for (const [key, value] of Object.entries(initial || {})) if (typeof value === "string") values[key] = value;
    const emit = () => window.parent.postMessage({ type: "turbogames:storage", kind, nonce: config.nonce, data: { ...values } }, config.parentOrigin);
    const methods = {
      getItem(key) { key = String(key); return Object.hasOwn(values, key) ? values[key] : null; },
      setItem(key, value) { key = String(key); value = String(value); const previous = values[key]; values[key] = value; if (JSON.stringify(values).length > 8 * 1024 * 1024) { if (previous === undefined) delete values[key]; else values[key] = previous; throw new DOMException("Game storage is full", "QuotaExceededError"); } emit(); },
      removeItem(key) { delete values[String(key)]; emit(); },
      clear() { for (const key of Object.keys(values)) delete values[key]; emit(); },
      key(index) { return Object.keys(values)[Number(index)] ?? null; }
    };
    const storage = new Proxy(methods, {
      get(target, key) { if (key === "length") return Object.keys(values).length; if (key === Symbol.toStringTag) return "Storage"; if (key in target) return target[key]; return values[key]; },
      set(target, key, value) { if (typeof key === "string") methods.setItem(key, value); return true; },
      deleteProperty(target, key) { methods.removeItem(key); return true; },
      ownKeys() { return Object.keys(values); },
      getOwnPropertyDescriptor(target, key) { if (Object.hasOwn(values, key)) return { configurable: true, enumerable: true, writable: true, value: values[key] }; return Object.getOwnPropertyDescriptor(target, key); }
    });
    return storage;
  }
  for (const [name, kind] of [["localStorage", "local"], ["sessionStorage", "session"]]) {
    try { window[name].getItem("turbo-storage-check"); }
    catch { try { Object.defineProperty(window, name, { configurable: true, value: install(kind, config[kind]) }); } catch {} }
  }
  try { void document.cookie; }
  catch {
    let jar;
    try { jar = JSON.parse(localStorage.getItem("__turbo_cookie_jar") || "{}"); } catch { jar = {}; }
    try { Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; "),
      set(value) {
        const parts = String(value).split(";");
        const split = parts[0].indexOf("=");
        if (split < 1) return;
        const key = parts[0].slice(0, split).trim();
        const expires = parts.find(part => /^\s*expires=/i.test(part));
        const expired = parts.some(part => /^\s*max-age\s*=\s*0\s*$/i.test(part)) || (expires && Date.parse(expires.slice(expires.indexOf("=") + 1)) < Date.now());
        if (expired) delete jar[key]; else jar[key] = parts[0].slice(split + 1);
        localStorage.setItem("__turbo_cookie_jar", JSON.stringify(jar));
      }
    }); } catch {}
  }
  try { document.domain = document.domain; }
  catch {
    let domain = new URL(document.baseURI).hostname;
    try { Object.defineProperty(document, "domain", { configurable: true, get: () => domain, set: value => { domain = String(value); } }); } catch {}
  }
  let databaseDenied = false;
  try {
    const probe = indexedDB.open("__turbo_storage_probe");
    probe.onsuccess = () => { probe.result.close(); indexedDB.deleteDatabase("__turbo_storage_probe"); };
  } catch { databaseDenied = true; }
  if (databaseDenied && window.TurboIDB) {
    let announced = false;
    const database = new Proxy(window.TurboIDB.indexedDB, {
      get(target, property) {
        if (property === "open") return (...args) => {
          if (!announced) {
            announced = true;
            parent.postMessage({ type: "turbogames:status", nonce: config.nonce, code: "manual-saves" }, config.parentOrigin);
          }
          return target.open(...args);
        };
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
    for (const [key, value] of Object.entries(window.TurboIDB)) if (/^IDB/.test(key)) {
      try { Object.defineProperty(window, key, { configurable: true, value }); } catch {}
    }
    try { Object.defineProperty(window, "indexedDB", { configurable: true, value: database }); } catch {}
    window.__turboMemoryIndexedDB = true;
  }
})();
