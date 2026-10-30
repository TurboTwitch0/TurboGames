const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { coverFor } = require('../cover-art.js');
const svg = uri => decodeURIComponent(uri.slice(uri.indexOf(',') + 1));

test('covers are deterministic, cached, resolution independent and genre specific', () => {
  const item = { title: 'Potty Racers 3' };
  const racing = coverFor(item, 'racing');
  assert.equal(coverFor({ ...item }, 'racing'), racing);
  assert.match(svg(racing), /viewBox="0 0 640 640"/);
  assert.match(svg(racing), />Potty Racers 3<\/text>/);
  assert.notEqual(racing, coverFor(item, 'puzzle'));
  for (const genre of ['racing', 'puzzle', 'arcade', 'action', 'adventure', 'sports', 'horror', 'rhythm']) {
    const content = svg(coverFor(item, genre));
    assert.ok(content.endsWith('</svg>'));
    assert.doesNotMatch(content, /ACCENT|undefined|NaN|<script|<foreignObject|(?:href|src)=["']https?:/);
  }
});

test('hostile text stays inert and unknown genres use a safe illustration', () => {
  const content = svg(coverFor({ title: '<script>" & \u0000 \' emoji 🎮' }, '__proto__'));
  assert.match(content, /&lt;script&gt;&quot; &amp;/);
  assert.doesNotMatch(content, /<script>|\u0000|<foreignObject/);
  assert.match(content, /ARCADE/);
  assert.match(svg(coverFor(null)), /Your next game/);
});

test('long titles and unbroken words wrap within three readable title lines', () => {
  for (const title of ['Super Long Adventure With Several Chapters And Many More Words '.repeat(10), 'W'.repeat(200), 'A'.repeat(200)]) {
    const content = svg(coverFor({ title }, 'adventure'));
    const titleLines = [...content.matchAll(/<text x="44" y="(?:489|536|583)">([^<]*)<\/text>/g)];
    assert.ok(titleLines.length > 0 && titleLines.length <= 3);
    assert.ok(titleLines.at(-1)[1].endsWith('…'));
    assert.ok(titleLines.every(line => line[1].length < 30));
  }
});

test('browser global and Node API generate the same safe cover', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../cover-art.js'), 'utf8'), context);
  assert.equal(context.window.TurboCoverArt.coverFor({ title: 'Little Match' }, 'puzzle'), coverFor({ title: 'Little Match' }, 'puzzle'));
});

test('utilities and miscellaneous entries never inherit a game genre label', () => {
  const utility = svg(coverFor({ title: 'Focus Room', category: 'apps' }, 'arcade'));
  const miscellaneous = svg(coverFor({ title: 'A collection entry', category: 'misc' }, 'racing'));
  assert.match(utility, /APPS &amp; TOOLS/);
  assert.doesNotMatch(utility, />ARCADE</);
  assert.match(miscellaneous, /THE COLLECTION/);
  assert.doesNotMatch(miscellaneous, />RACING</);
});
