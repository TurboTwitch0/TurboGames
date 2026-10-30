"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { categories, genresFor } = require("../game-categories.js");
const game = (title, extra = {}) => ({ title, category: "games", tags: [], ...extra });

test("familiar genres are available across source formats without changing the catalog", () => {
  const examples = [
    ["DOOM", "action"], ["Pokémon FireRed", "adventure"], ["Orbit Breaker", "arcade"],
    ["Little Match", "puzzle"], ["Mario Kart 64", "racing"], ["1 On 1 Soccer", "sports"],
    ["Five Nights at Freddy’s", "horror"], ["Friday Night Funkin: B-Sides", "rhythm"]
  ];
  for (const [title, expected] of examples) {
    for (const category of ["games", "flash", "emulator"]) {
      const item = game(title, { category });
      const before = JSON.stringify(item);
      assert.ok(genresFor(item).includes(expected), `${title}: ${category}`);
      assert.equal(JSON.stringify(item), before);
    }
  }
  assert.ok(Object.isFrozen(categories));
  assert.ok(categories.every(Object.isFrozen));
  assert.equal(new Set(categories.map(category => category.id)).size, categories.length);
});

test("word boundaries and deliberate franchise exclusions avoid misleading labels", () => {
  assert.deepEqual(genresFor(game("Opposumcountry")), []);
  assert.deepEqual(genresFor(game("Black Knight")), []);
  assert.equal(genresFor(game("Pokémon FireRed")).includes("horror"), false);
  assert.equal(genresFor(game("Kirby Nightmare in Dreamland")).includes("horror"), false);
  assert.equal(genresFor(game("Pokémon Pinball")).includes("adventure"), false);
  assert.ok(genresFor(game("Pokémon Pinball")).includes("arcade"));
  assert.equal(genresFor(game("Pokemon Tower Defense")).includes("adventure"), false);
  assert.ok(genresFor(game("Pokemon Tower Defense")).includes("puzzle"));
  assert.deepEqual(genresFor(game("Pokemon Volume 1 [Rom Show]")), []);
  assert.deepEqual(genresFor(game("Future Mystery Title")), []);
  assert.deepEqual(genresFor(game("Friday Night Funkin: Vs. Sonic.EXE")), ["rhythm"]);
  assert.deepEqual(genresFor(game("FNF - Crimson Madness")), ["rhythm"]);
  assert.deepEqual(genresFor(game("Sonic Drift 2")), ["racing"]);
  assert.deepEqual(genresFor(game("Sonic Spinball")), ["arcade"]);
  assert.deepEqual(genresFor(game("Sonic R")), ["racing"]);
});

test("explicit metadata is honored, validated, deduplicated and isolated from apps", () => {
  assert.deepEqual(genresFor(game("DOOM", { genres: ["puzzle", "puzzle", "unknown", null, "all", "__proto__"] })), ["puzzle"]);
  assert.deepEqual(genresFor(game("DOOM", { genres: [] })), []);
  assert.deepEqual(genresFor(game("Guitar Hero", { category: "apps", genres: ["rhythm"] })), []);
  assert.deepEqual(genresFor(game("Horror Proxy", { category: "misc" })), []);
  assert.deepEqual(genresFor(game("Custom game", { tags: ["platformer", "strategy", "racing", "__proto__", {}] })), ["adventure", "puzzle", "racing"]);
  for (const value of [null, undefined, 12, "DOOM", {}]) assert.deepEqual(genresFor(value), []);
});

test("browser and Node exports agree and all 3,099 catalog entries stay reachable", () => {
  const context = { window: {} };
  const root = path.resolve(__dirname, "..");
  vm.runInNewContext(fs.readFileSync(path.join(root, "catalog.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "game-categories.js"), "utf8"), context);
  const catalog = context.window.TURBO_CATALOG;
  const before = JSON.stringify(catalog);
  assert.equal(catalog.length, 3099);
  const ids = new Set(categories.slice(1).map(category => category.id));
  const coverage = new Map(categories.slice(1).map(category => [category.id, 0]));
  for (const item of catalog) {
    const browserGenres = Array.from(context.window.TurboGameCategories.genresFor(item));
    assert.deepEqual(browserGenres, genresFor(item));
    assert.equal(new Set(browserGenres).size, browserGenres.length);
    for (const genre of browserGenres) {
      assert.ok(ids.has(genre));
      coverage.set(genre, coverage.get(genre) + 1);
    }
  }
  assert.ok([...coverage.values()].every(count => count > 0), "every displayed genre has actual catalog matches");
  assert.equal(JSON.stringify(catalog), before);
});
