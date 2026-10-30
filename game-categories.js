(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TurboGameCategories = api;
})(typeof window === "object" ? window : null, function () {
  "use strict";

  const categories = Object.freeze([
    { id: "all", label: "All genres" },
    { id: "action", label: "Action" },
    { id: "adventure", label: "Adventure & RPG" },
    { id: "arcade", label: "Arcade" },
    { id: "puzzle", label: "Puzzle & Strategy" },
    { id: "racing", label: "Racing" },
    { id: "sports", label: "Sports" },
    { id: "horror", label: "Horror" },
    { id: "rhythm", label: "Rhythm" }
  ].map(Object.freeze));
  const genreIds = new Set(categories.slice(1).map(category => category.id));
  const normalize = value => typeof value === "string"
    ? value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";

  // Use explicit genre metadata when available. For legacy entries, only familiar
  // franchises and descriptive title/tag words are classified. Unknown titles stay
  // in All genres; the source-format tabs and complete catalog remain untouched.
  const rules = {
    action: /\b(?:action|shooter|shooting|fighter|fighting|combat|gun(?:s|fight|star)?|bullet(?:s)?|doom|quake|contra|cuphead|mega ?man|metal slug|mortal kombat|street fighter|super smash|madness(?: combat)?|alien hominid|castle crashers|ninja gaiden|double dragon)\b/,
    adventure: /\b(?:adventure|rpg|role playing|zelda|final fantasy|dragon quest|chrono trigger|chrono cross|earthbound|undertale|deltarune|golden sun|kingdom hearts|secret of mana|castlevania|cave story|super mario(?: bros| world| land| 64| sunshine)|mario (?:63|64)|sonic|kirby|donkey kong country|crash bandicoot|banjo kazooie|banjo tooie|metroid|hollow knight)\b/,
    arcade: /\b(?:arcade|orbit breaker|pac ?man|ms pac ?man|pinball|spinball|breakout|arkanoid|asteroids|space invaders|galaga|galaxian|frogger|flappy(?: bird)?|doodle jump|geometry dash|subway surfers|crossy road|fruit ninja|jetpack joyride|slope|agar io|snake(?: game)?|pong)\b/,
    puzzle: /\b(?:puzzle|strategy|memory|little match|2048|tetris(?:gba|gb|ds|64|attack)?|chess|checkers|sudoku|solitaire|mahjong|minesweeper|wordle|nonogram|picross|bloons|btd\d*|tower defense|plants vs zombies|cut the rope|baba is you|portal|fireboy(?: and watergirl)?|watergirl|bubble shooter|puzzle bobble|snail bob|3 pandas|3 slices|bloxorz|unblock|hanoi)\b/,
    racing: /\b(?:racing|racer(?:s)?|kart(?:s)?|motocross|moto(?:x3m\d*| x3m\d*)?|drift(?:ing|er|ers)?|rally|hill climb|hillclimb|drivemad|drive mad|drift hunters|drift boss|f zero|outrun|out run|gran turismo|need for speed|burnout|crazy taxi|road rash|cruis n|pole position|mario kart|diddy kong racing|sonic r)\b/,
    sports: /\b(?:sports?|soccer|football|basketball|baseball|tennis|golf|hockey|volleyball|bowling|billiards|boxing|wrestling|skate(?:board|boarding)?|snowboard(?:ing)?|surfing|fishing|cricket|rugby|badminton|nba|nfl|nhl|fifa|madden|tony hawk|punch out|retro bowl|retro goal)\b/,
    horror: /\b(?:horror|backrooms|granny|slender(?:man)?|five nights|fnaf|baldi(?: s)? basics|poppy playtime|amnesia|resident evil|silent hill|outlast|dead space|scary maze|sonic exe|mario exe|doki doki|siren head|garten of banban|99 nights in the forest|arthur s nightmare)\b/,
    rhythm: /\b(?:rhythm|friday night funkin|friday night crunchin|friday night dustin|fnf|osu|guitar hero|dance dance revolution|a dance of fire and ice|taiko|beatmania|parappa|scratchin melodii)\b/
  };
  const tagAliases = {
    action: "action", shooter: "action", shooting: "action", fighting: "action",
    adventure: "adventure", rpg: "adventure", platformer: "adventure", platforming: "adventure",
    arcade: "arcade", puzzle: "puzzle", strategy: "puzzle", memory: "puzzle",
    racing: "racing", driving: "racing", sports: "sports", sport: "sports",
    horror: "horror", rhythm: "rhythm", music: "rhythm"
  };

  function genresFor(item) {
    if (!item || typeof item !== "object" || ["apps", "misc"].includes(item.category)) return [];
    if (Array.isArray(item.genres)) {
      return [...new Set(item.genres.filter(id => typeof id === "string" && genreIds.has(id)))];
    }
    const title = normalize(item.title);
    if (/\brom show\b/.test(title)) return [];
    const found = new Set();
    if (Array.isArray(item.tags)) {
      for (const tag of item.tags) {
        const normalized = normalize(tag);
        if (Object.hasOwn(tagAliases, normalized)) found.add(tagAliases[normalized]);
      }
    }
    // Character names in a rhythm crossover do not turn its music gameplay into
    // an RPG, fighter, or platformer. Explicit tags can still supply extra genres.
    if (rules.rhythm.test(title)) {
      found.add("rhythm");
      return categories.filter(category => found.has(category.id)).map(category => category.id);
    }
    for (const [genre, pattern] of Object.entries(rules)) {
      const franchiseSpinoff = genre === "adventure"
        && /\b(?:sonic|kirby)\b/.test(title)
        && /\b(?:pinball|spinball|drift|racing|golf|tennis|dream course|fighters|sonic r)\b/.test(title);
      if (!franchiseSpinoff && pattern.test(title)) found.add(genre);
    }
    // Most Pokémon entries are RPGs, but named spin-offs and ROM-show videos
    // should not inherit an RPG label just because they share the franchise.
    if (/\bpokemon\b/.test(title) && !/\b(?:pinball|stadium|puzzle|trozei|snap|dash|typing|rumble|tower defense|pokken)\b/.test(title)) found.add("adventure");
    return categories.filter(category => found.has(category.id)).map(category => category.id);
  }

  return Object.freeze({ categories, genresFor });
});
