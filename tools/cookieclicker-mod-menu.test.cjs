const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function launcher() {
  const html = fs.readFileSync(path.join(__dirname, '../library-source/html5-games/clcookieclickermodmenu.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .find(match => match[1].includes('window.TatarMenu'))[1];
  const timers = [];
  const listeners = [];
  const elements = { menu: { innerHTML: '' }, cookieSetInput: { value: '25' } };
  const element = tag => ({
    tagName: tag.toUpperCase(), children: [], listeners: {},
    appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; },
    prepend(child) { this.children.unshift(child); },
    addEventListener(type, listener) { this.listeners[type] = listener; },
  });
  elements.topBar = element('div');
  const context = {
    Game: { ready: 0 },
    document: {
      createElement: element,
      head: { appendChild() {} },
      addEventListener: (type, listener) => listeners.push({ type, listener }),
      getElementById: id => elements[id],
    },
    setTimeout: callback => timers.push(callback),
    alert: () => assert.fail('The initialized game menu should be available'),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, timers, listeners, elements };
}

test('the mod menu survives delayed game/language initialization and binds only once', () => {
  const { context, timers, listeners, elements } = launcher();
  // The original 500 ms timer expires while the language chooser is still open.
  timers.shift()();
  timers.shift()();
  assert.equal(listeners.length, 0);
  assert.equal(timers.length, 1);
  assert.equal(context.Game.Notes, undefined);

  let updated = 0;
  let opened = 0;
  Object.assign(context.Game, {
    ready: 1,
    Notes: [],
    UpdateNotes: () => updated++,
    ShowMenu: () => opened++,
  });
  timers.shift()();
  assert.equal(context.Game.Notes.length, 1);
  assert.equal(updated, 1);
  assert.equal(timers.length, 0);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].type, 'keydown');
  context.initializeTatarMenu();
  assert.equal(listeners.length, 1);
  assert.equal(context.Game.Notes.length, 1);
  assert.equal(elements.topBar.children.length, 1);
  const button = elements['tatar-mod-menu-button'];
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.type, 'button');
  assert.equal(button.textContent, 'Mod menu');

  listeners[0].listener({ ctrlKey: false, key: 'x' });
  assert.equal(opened, 0);
  listeners[0].listener({ ctrlKey: true, key: 'X' });
  assert.equal(opened, 1);
  assert.match(elements.menu.innerHTML, /Tatar Mod Menu/);
  elements.menu.innerHTML = '';
  button.listeners.click();
  assert.equal(opened, 2);
  assert.match(elements.menu.innerHTML, /Tatar Mod Menu/);
  context.TatarMenu.setCookies();
  assert.equal(context.Game.cookies, 25);
});

test('a ready flag without the game note API does not abort menu initialization', () => {
  const { context, timers, listeners } = launcher();
  context.Game.ready = 1;
  context.Game.Notes = [];
  timers.shift()();
  assert.equal(listeners.length, 0);
  assert.equal(timers.length, 1);
  context.Game.UpdateNotes = () => {};
  timers.shift()();
  assert.equal(context.Game.Notes.length, 1);
  assert.equal(listeners.length, 1);
  assert.equal(timers.length, 0);
});
