(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TurboCoverArt = api;
})(typeof window === "object" ? window : null, function () {
  "use strict";
  const cache = new Map();
  const labels = { apps: "APPS & TOOLS", collection: "THE COLLECTION", racing: "RACING", puzzle: "PUZZLE & STRATEGY", arcade: "ARCADE", action: "ACTION", adventure: "ADVENTURE & RPG", sports: "SPORTS", horror: "HORROR", rhythm: "RHYTHM" };
  const art = {
    apps: '<rect x="155" y="142" width="330" height="235" rx="27" fill="#101721" stroke="ACCENT" stroke-width="6"/><path d="m255 213-49 45 49 45m130-90 49 45-49 45m-37-103-49 150" fill="none" stroke="ACCENT" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
    collection: '<rect x="178" y="153" width="230" height="230" rx="35" transform="rotate(-14 293 268)" fill="ACCENT" opacity=".25"/><rect x="235" y="128" width="230" height="230" rx="35" transform="rotate(12 350 243)" fill="none" stroke="ACCENT" stroke-width="8"/><circle cx="350" cy="243" r="55" fill="ACCENT"/>',
    racing: '<path d="M210 390 290 112h62l80 278" fill="none" stroke="ACCENT" stroke-width="6" opacity=".45"/><path d="M321 132v36m0 30v36m0 30v36m0 30v36" stroke="ACCENT" stroke-width="7"/><g transform="translate(245 225) rotate(-12 75 55)"><path d="m18 48 18-35h76l20 35 14 12v56H4V60Z" fill="ACCENT"/><path d="m47 25-9 28h74l-11-28Z" fill="#15212b"/><rect x="17" y="103" width="24" height="26" rx="7" fill="#090d14"/><rect x="110" y="103" width="24" height="26" rx="7" fill="#090d14"/><path d="M16 74h25m65 0h25" stroke="#fff" stroke-width="9"/></g><path d="m130 305 48-14m-39 45 35-10m286-100 39-12m-29 43 29-9" stroke="ACCENT" stroke-width="6"/>',
    puzzle: '<g transform="translate(203 138) rotate(-10 118 118)" stroke="#101721" stroke-width="12"><rect width="112" height="112" rx="24" fill="ACCENT"/><rect x="124" width="112" height="112" rx="24" fill="#f5f2e9"/><rect y="124" width="112" height="112" rx="24" fill="#a9adff"/><rect x="124" y="124" width="112" height="112" rx="24" fill="ACCENT"/></g><path d="m260 185 19 19-19 19m95 95h42m-21-21v42" stroke="#14202b" stroke-width="9" fill="none"/>',
    arcade: '<ellipse cx="320" cy="258" rx="188" ry="69" transform="rotate(-24 320 258)" fill="none" stroke="ACCENT" stroke-width="8"/><circle cx="320" cy="258" r="92" fill="ACCENT"/><path d="m278 219 80 39-80 39Z" fill="#101721"/><circle cx="160" cy="319" r="18" fill="#f5f2e9"/><path d="M438 135v34m-17-17h34M190 145v21m-11-11h21" stroke="ACCENT" stroke-width="5"/>',
    action: '<path d="m339 115-131 161h94l-16 120 150-194h-99l27-87Z" fill="ACCENT"/><path d="m150 206 54 12m228 104 55 16M213 130l26 35m162 203 22 31" stroke="ACCENT" stroke-width="7"/><circle cx="320" cy="259" r="151" fill="none" stroke="ACCENT" stroke-width="2" opacity=".25"/>',
    adventure: '<path d="m125 371 126-199 67 105 51-145 150 239Z" fill="ACCENT" opacity=".25"/><path d="m154 371 114-155 55 82 64-121 102 194" fill="none" stroke="ACCENT" stroke-width="7" stroke-linejoin="round"/><path d="m266 216-31 43 32-13 32 16Z" fill="#f5f2e9"/><circle cx="428" cy="132" r="29" fill="ACCENT"/><path d="m177 344 68-21 55 34 93-16 44 30" fill="none" stroke="#f5f2e9" stroke-width="4" stroke-dasharray="9 12"/>',
    sports: '<circle cx="320" cy="251" r="125" fill="ACCENT"/><g fill="none" stroke="#16212b" stroke-width="8"><circle cx="320" cy="251" r="125"/><path d="M195 251h250M320 126v250M231 163c132 48 132 128 0 176m178-176c-132 48-132 128 0 176"/></g><path d="M173 393h294m-257 18h220" stroke="ACCENT" stroke-width="5" opacity=".5"/>',
    horror: '<path d="M216 391V137h208v254" fill="#080b10" stroke="ACCENT" stroke-width="5"/><path d="m242 160 140-35v266H242Z" fill="ACCENT" opacity=".65"/><path d="m265 184 91-22v229h-91Z" fill="#101721"/><circle cx="339" cy="283" r="6" fill="ACCENT"/><path d="m216 391-58 28m266-28 58 28" stroke="ACCENT" stroke-width="4"/><path d="M315 82v23m-54-12 10 21m98-21-10 21" stroke="ACCENT" stroke-width="4"/>',
    rhythm: '<g fill="ACCENT"><rect x="150" y="217" width="31" height="83" rx="15"/><rect x="200" y="168" width="31" height="181" rx="15"/><rect x="250" y="127" width="31" height="263" rx="15"/><rect x="300" y="184" width="31" height="149" rx="15"/><rect x="350" y="148" width="31" height="221" rx="15"/><rect x="400" y="197" width="31" height="123" rx="15"/><rect x="450" y="225" width="31" height="67" rx="15"/></g><path d="M141 411h350" stroke="#f5f2e9" stroke-width="3" opacity=".35"/>'
  };
  const escape = text => text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
  const units = text => [...text].reduce((sum, c) => sum + (/[MW@#%]/.test(c) ? 1 : /[ilI1.,' ]/.test(c) ? .3 : /[A-Z]/.test(c) ? .72 : .56), 0);
  function linesFor(title) {
    const lines = [];
    let line = "";
    for (const word of title.split(/\s+/)) {
      if (line && units(line + " " + word) > 12.5) { lines.push(line); line = ""; }
      for (const letter of word) {
        if (units(line + letter) > 12.5) { lines.push(line); line = ""; }
        line += letter;
      }
      line += " ";
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length > 3) lines[2] = lines[2].trim().slice(0, -1) + "…";
    return lines.slice(0, 3).map(line => line.trim());
  }
  function coverFor(item, genre) {
    const title = (typeof item?.title === "string" ? item.title : "Your next game").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180) || "Your next game";
    const kind = item?.category === "apps" ? "apps" : item?.category === "misc" ? "collection" : Object.hasOwn(labels, genre) ? genre : "arcade";
    const key = kind + "\0" + title;
    if (cache.has(key)) return cache.get(key);
    const hash = [...title].reduce((value, character) => (Math.imul(value, 31) + character.codePointAt(0)) >>> 0, 7);
    const accent = ["#d6ff64", "#a9adff", "#ffb58c"][hash % 3];
    const lines = linesFor(title);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><title>${escape(title)} — ${escape(labels[kind])} cover</title><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#222c39"/><stop offset="1" stop-color="#0b1018"/></linearGradient><radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".2"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="640" height="640" fill="url(#bg)"/><circle cx="320" cy="250" r="295" fill="url(#glow)"/><path d="M40 100h560M40 432h560" stroke="#fff" stroke-opacity=".12"/><text x="44" y="69" fill="${accent}" font-family="Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="3">${escape(labels[kind])}</text>${art[kind].replaceAll("ACCENT", accent)}<g fill="#f7f5ee" font-family="Arial,sans-serif" font-size="40" font-weight="800">${lines.map((line, index) => `<text x="44" y="${489 + index * 47}">${escape(line)}</text>`).join("")}</g><path d="M44 610h36" stroke="${accent}" stroke-width="5"/><text x="95" y="615" fill="#a5adb9" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3">TURBOGAMES</text></svg>`;
    const result = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    if (cache.size >= 512) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  }
  return Object.freeze({ coverFor });
});
