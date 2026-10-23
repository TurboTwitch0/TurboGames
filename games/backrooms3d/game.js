import * as THREE from '../../vendor/three/three.module.min.js';
import { buildWorld, CELL, SIZE } from './world.js';
import { RoomSession } from './multiplayer.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#view'), menu = $('#menu'), hud = $('#hud'), chatInput = $('#chat-input');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#847b54');
scene.fog = new THREE.FogExp2('#847b54', .026);
scene.add(new THREE.HemisphereLight('#fff4ce', '#71694b', 1.35));
scene.add(new THREE.AmbientLight('#e4d6a1', .2));
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, .05, 65);
camera.rotation.order = 'YXZ';
let world = buildWorld(scene, 1986), started = false, paused = false, busy = false, online = false, highQuality = true;
let previousTime = performance.now(), elapsed = 0, lastSend = 0, stepDistance = 0, bob = 0, caughtAt = -100;
let moving = false, sprinting = false, mouseDragging = false, lastMouseX = 0, lastMouseY = 0, soundEnabled = true;
let me = { ...world.spawn, pitch: 0, name: 'Wanderer', color: '#d9bd54', won: false };
let entityState = { ...world.entity, yaw: 0, state: 'wandering' }, entityTarget = null, path = [], nextPathAt = 0;
const keys = new Set(), remotePlayers = new Map(), avatars = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, highQuality ? 1.5 : .8));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
function mesh(geometry, material, position, parent) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position); parent.add(object); return object;
}
function makeWanderer(color) {
  const group = new THREE.Group(), suit = new THREE.MeshStandardMaterial({ color, roughness: .95 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#292b22', roughness: .8 });
  const visor = new THREE.MeshStandardMaterial({ color: '#1a2523', roughness: .25, metalness: .35 });
  mesh(new THREE.CapsuleGeometry(.22, .45, 4, 8), suit, [0, 1.08, 0], group);
  mesh(new THREE.SphereGeometry(.225, 12, 10), suit, [0, 1.65, 0], group);
  mesh(new THREE.BoxGeometry(.31, .16, .08), visor, [0, 1.65, -.2], group);
  mesh(new THREE.BoxGeometry(.3, .4, .16), rubber, [0, 1.1, .23], group);
  const legs = [-1, 1].map(side => mesh(new THREE.CapsuleGeometry(.085, .42, 3, 6), suit, [side * .13, .42, 0], group));
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(.18, .13, .29), rubber, [side * .13, .075, -.035], group);
    const arm = mesh(new THREE.CapsuleGeometry(.075, .45, 3, 6), suit, [side * .29, 1.05, 0], group); arm.rotation.z = side * .12;
  }
  scene.add(group); return { group, legs };
}
function makeEntity() {
  const group = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: '#050605', roughness: 1 });
  const eye = new THREE.MeshBasicMaterial({ color: '#fff4c1' });
  mesh(new THREE.CapsuleGeometry(.12, .85, 4, 8), dark, [0, 1.5, 0], group);
  mesh(new THREE.SphereGeometry(.15, 10, 8), dark, [0, 2.12, 0], group);
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(.035, .025, 1.3, 5), dark, [side * .23, 1.22, 0], group); arm.rotation.z = -side * .17;
    const leg = mesh(new THREE.CylinderGeometry(.05, .025, 1.05, 5), dark, [side * .12, .5, 0], group); leg.rotation.z = side * .05;
    mesh(new THREE.SphereGeometry(.022, 6, 5), eye, [side * .055, 2.13, -.14], group);
  }
  scene.add(group); return group;
}
const entityMesh = makeEntity();

// Quiet fluorescent ballast hum and soft carpet footsteps, generated on-device.
let audio;
function startAudio() {
  if (audio) { audio.ctx.resume().catch(() => {}); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), master = ctx.createGain();
    master.gain.value = soundEnabled ? .32 : 0; master.connect(ctx.destination);
    const hum = ctx.createGain(); hum.gain.value = .065; hum.connect(master);
    for (const frequency of [60, 120, 180]) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = frequency === 60 ? .6 : .16;
      oscillator.connect(gain).connect(hum); oscillator.start();
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * .16, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    audio = { ctx, master, hum, buffer };
  } catch { /* Muted browsers can still play the game. */ }
}
function footstep() {
  if (!audio || !soundEnabled) return;
  const source = audio.ctx.createBufferSource(), filter = audio.ctx.createBiquadFilter(), gain = audio.ctx.createGain();
  source.buffer = audio.buffer; source.playbackRate.value = .8 + Math.random() * .25;
  filter.type = 'lowpass'; filter.frequency.value = 380; gain.gain.value = sprinting ? .21 : .12;
  source.connect(filter).connect(gain).connect(audio.master); source.start();
}
function notify(text, duration = 3500) {
  $('#toast').textContent = text; $('#toast').classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => $('#toast').classList.remove('show'), duration);
}
function addMessage(name, text) {
  const div = document.createElement('div'); div.textContent = name + ': ' + text; $('#messages').append(div);
  while ($('#messages').children.length > 5) $('#messages').firstChild.remove();
  setTimeout(() => div.remove(), 18000);
}
function updateCount() {
  const count = remotePlayers.size + 1;
  $('#players-chip').textContent = String(count).padStart(2, '0') + (count === 1 ? ' WANDERER' : ' WANDERERS');
}
function clearPlayers() {
  for (const { group } of avatars.values()) {
    scene.remove(group); group.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
  }
  avatars.clear(); remotePlayers.clear(); updateCount();
}
const session = new RoomSession({
  getWorld: () => ({ seed: world.seed, entity: entityState }),
  onStatus: text => { $('#status').textContent = text; },
  onSession: data => {
    loadWorld(data.seed, data.entity);
    for (const p of data.players || []) if (p.id !== session.id) receivePlayer(p);
    enterGame(); online = true;
  },
  onPlayer: receivePlayer,
  onLeave: id => {
    remotePlayers.delete(id);
    const avatar = avatars.get(id);
    if (avatar) { scene.remove(avatar.group); avatar.group.traverse(c => { c.geometry?.dispose(); c.material?.dispose(); }); avatars.delete(id); }
    updateCount();
  },
  onChat: ({ name, text }) => addMessage(name, text),
  onEntity: entity => { if (!session.isHost) entityState = entity; },
  onError: error => {
    $('#status').textContent = error.message;
    if (online) {
      online = false; clearPlayers(); $('#copy').hidden = true;
      $('#room-chip').textContent = 'SOLO EXPLORATION'; notify(error.message + ' Continuing in solo mode.', 6000);
    }
  },
  onDisconnect: text => { online = false; clearPlayers(); $('#copy').hidden = true; $('#room-chip').textContent = 'SOLO EXPLORATION'; notify(text, 6000); },
});
function receivePlayer(player) {
  if (player.id === session.id) return;
  remotePlayers.set(player.id, player);
  if (!avatars.has(player.id)) {
    const avatar = makeWanderer(player.color); avatar.group.position.set(player.x, 0, player.z); avatars.set(player.id, avatar);
    addMessage('Radio', player.name + ' is here.');
  }
  updateCount();
}
function loadWorld(seed, entity) {
  world.dispose(); clearPlayers(); world = buildWorld(scene, seed);
  me = { ...world.spawn, pitch: 0, name: $('#name').value.trim().slice(0, 20) || 'Wanderer', color: '#d9bd54', won: false };
  entityState = entity || { ...world.entity, yaw: 0, state: 'wandering' };
  entityTarget = null; path = []; nextPathAt = 0; caughtAt = elapsed;
  $('#objective-text').textContent = 'Find a way out.'; $('#messages').replaceChildren();
}
function setBusy(value) {
  busy = value; for (const button of $('#setup').querySelectorAll('button')) button.disabled = value;
  $('#name').disabled = $('#room').disabled = value;
}
function enterGame() {
  started = true; paused = false; menu.hidden = true; hud.hidden = false; keys.clear(); canvas.focus();
  document.body.dataset.state = 'playing';
  $('#setup').hidden = true; $('#paused').hidden = false;
  $('#room-chip').textContent = session.joined ? 'ROOM ' + session.code + (session.isHost ? ' · HOST' : ' · CONNECTED') : 'SOLO EXPLORATION';
  $('#copy').hidden = !session.joined;
  $('#look-hint').hidden = document.pointerLockElement === canvas;
  startAudio();
}
function pauseGame() {
  if (!started || paused) return;
  paused = true; keys.clear(); document.exitPointerLock?.(); menu.hidden = false; hud.hidden = true;
  document.body.dataset.state = 'paused'; $('#status').textContent = online ? 'Room ' + session.code + ' · ' + (remotePlayers.size + 1) + ' connected' : 'You are still in Level 0.';
}
function requestLook() {
  if (!started || paused) return;
  try { const promise = canvas.requestPointerLock?.(); promise?.catch(() => {}); } catch { /* Drag and arrow keys still work. */ }
}
$('#solo').onclick = () => {
  session.close(); online = false;
  loadWorld(crypto.getRandomValues(new Uint32Array(1))[0]); enterGame(); requestLook();
};
$('#host').onclick = async () => {
  if (busy) return; startAudio(); setBusy(true);
  try {
    loadWorld(crypto.getRandomValues(new Uint32Array(1))[0]);
    session.setWorld({ seed: world.seed, entity: entityState });
    const room = await session.host($('#name').value); online = true;
    $('#room').value = room.code; enterGame(); session.sendState(me);
    notify('Room ' + room.code + '. Share this code with a friend.', 6500);
  } catch (error) { $('#status').textContent = error.message + ' Solo exploration is available.'; }
  finally { setBusy(false); }
};
$('#join').onclick = async () => {
  if (busy) return; startAudio(); setBusy(true);
  try { await session.join($('#room').value, $('#name').value); online = true; session.sendState(me); }
  catch (error) { $('#status').textContent = error.message + ' Some networks block direct multiplayer connections.'; }
  finally { setBusy(false); }
};
$('#resume').onclick = () => { enterGame(); requestLook(); };
$('#pause').onclick = pauseGame;
$('#leave').onclick = () => {
  session.close(); online = false; started = false; paused = false; clearPlayers(); document.exitPointerLock?.();
  $('#setup').hidden = false; $('#paused').hidden = true; menu.hidden = false; hud.hidden = true;
  document.body.dataset.state = 'menu'; $('#status').textContent = 'Explore together. Stay within earshot.';
  loadWorld(1986);
};
$('#copy').onclick = async () => {
  try { await navigator.clipboard.writeText(session.code); notify('Room code copied.'); }
  catch { notify('Room code: ' + session.code, 8000); }
};
$('#sound').onclick = () => {
  soundEnabled = !soundEnabled; startAudio();
  if (audio) audio.master.gain.setTargetAtTime(soundEnabled ? .32 : 0, audio.ctx.currentTime, .05);
  $('#sound').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF'; $('#sound').setAttribute('aria-pressed', String(soundEnabled));
};
$('#quality').onclick = () => { highQuality = !highQuality; $('#quality').textContent = highQuality ? 'QUALITY HIGH' : 'QUALITY LOW'; resize(); };
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { notify('Use the arcade’s ⛶ button to enter fullscreen.'); }
}
$('#fullscreen').onclick = fullscreen;

function look(dx, dy) { me.yaw -= dx * .0021; me.pitch = THREE.MathUtils.clamp(me.pitch - dy * .0018, -1.15, 1.15); }
canvas.addEventListener('click', requestLook);
canvas.addEventListener('pointerdown', e => { mouseDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; });
addEventListener('pointerup', () => { mouseDragging = false; });
addEventListener('mousemove', e => {
  if (!started || paused || !chatInput.hidden) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  else if (mouseDragging) { look(e.clientX - lastMouseX, e.clientY - lastMouseY); lastMouseX = e.clientX; lastMouseY = e.clientY; }
});
document.addEventListener('pointerlockchange', () => { $('#look-hint').hidden = document.pointerLockElement === canvas; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
addEventListener('blur', () => keys.clear());
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (started && !paused) pauseGame(); return; }
  if (e.target.tagName === 'INPUT') {
    if (e.target === chatInput && e.key === 'Enter') {
      const text = chatInput.value.trim(); if (text) { if (online) session.sendChat(text); else addMessage(me.name, text); }
      chatInput.value = ''; chatInput.hidden = true; canvas.focus(); e.preventDefault();
    }
    return;
  }
  if (!started || paused) return;
  if (e.key === 'Enter') { chatInput.hidden = false; document.exitPointerLock?.(); keys.clear(); chatInput.focus(); e.preventDefault(); return; }
  if (e.code === 'KeyF') { fullscreen(); e.preventDefault(); return; }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.code));
for (const button of document.querySelectorAll('[data-key]')) {
  const code = 'Key' + button.dataset.key.toUpperCase();
  button.onpointerdown = e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(code); };
  button.onpointerup = button.onpointercancel = () => keys.delete(code);
}
let touchLook;
$('#look-pad').onpointerdown = e => { touchLook = { x: e.clientX, y: e.clientY }; e.target.setPointerCapture(e.pointerId); };
$('#look-pad').onpointermove = e => { if (touchLook) { look((e.clientX - touchLook.x) * 2, (e.clientY - touchLook.y) * 2); touchLook = { x: e.clientX, y: e.clientY }; } };
$('#look-pad').onpointerup = $('#look-pad').onpointercancel = () => { touchLook = null; };

function movePlayer(dt) {
  if (keys.has('ArrowLeft')) me.yaw += dt * 1.8;
  if (keys.has('ArrowRight')) me.yaw -= dt * 1.8;
  let forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  let sideways = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  moving = !!(forward || sideways); sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (forward && sideways) { forward *= Math.SQRT1_2; sideways *= Math.SQRT1_2; }
  const speed = (sprinting ? 3.9 : 2.35) * dt;
  const dx = (-Math.sin(me.yaw) * forward + Math.cos(me.yaw) * sideways) * speed;
  const dz = (-Math.cos(me.yaw) * forward - Math.sin(me.yaw) * sideways) * speed;
  const beforeX = me.x, beforeZ = me.z;
  if (!world.blocked(me.x + dx, me.z)) me.x += dx;
  if (!world.blocked(me.x, me.z + dz)) me.z += dz;
  const distance = Math.hypot(me.x - beforeX, me.z - beforeZ);
  bob += distance * 7; stepDistance += distance;
  if (stepDistance > (sprinting ? 1.3 : 1.05)) { stepDistance = 0; footstep(); }
  if (!me.won && Math.hypot(me.x - world.exit.x, me.z - world.exit.z) < 1.05) {
    me.won = true; $('#objective-text').textContent = 'You found the exit. You made it.';
    notify('You found a way out. Stay with your friends, or leave through the menu.', 9000);
    if (online) session.sendChat('I found the exit!');
  }
}
function findPath(from, to) {
  const sx = Math.floor(from.x / CELL), sz = Math.floor(from.z / CELL), tx = Math.floor(to.x / CELL), tz = Math.floor(to.z / CELL);
  if (world.grid[tz]?.[tx] !== 0) return [];
  const queue = [[sx, sz]], parents = new Map([[sx + ',' + sz, null]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i]; if (x === tx && z === tz) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = nx + ',' + nz;
      if (world.grid[nz]?.[nx] === 0 && !parents.has(key)) { parents.set(key, [x, z]); queue.push([nx, nz]); }
    }
  }
  if (!parents.has(tx + ',' + tz)) return [];
  const result = []; let current = [tx, tz];
  while (current && (current[0] !== sx || current[1] !== sz)) {
    result.unshift({ x: (current[0] + .5) * CELL, z: (current[1] + .5) * CELL }); current = parents.get(current[0] + ',' + current[1]);
  }
  return result;
}
function moveEntity(dt) {
  if (online && !session.isHost) return;
  const candidates = [me, ...remotePlayers.values()].filter(p => !p.won);
  let target = candidates.sort((a, b) => Math.hypot(a.x - entityState.x, a.z - entityState.z) - Math.hypot(b.x - entityState.x, b.z - entityState.z))[0];
  const hunting = target && Math.hypot(target.x - entityState.x, target.z - entityState.z) < 28;
  if (!hunting) {
    if (!entityTarget || Math.hypot(entityTarget.x - entityState.x, entityTarget.z - entityState.z) < 1) {
      const open = [];
      for (let z = 2; z < SIZE - 2; z++) for (let x = 2; x < SIZE - 2; x++) if (!world.grid[z][x]) open.push({ x: (x + .5) * CELL, z: (z + .5) * CELL });
      entityTarget = open[Math.floor(Math.random() * open.length)];
    }
    target = entityTarget;
  }
  if (elapsed > nextPathAt) { path = findPath(entityState, target); nextPathAt = elapsed + 1.2; }
  const next = path[0];
  if (next) {
    const dx = next.x - entityState.x, dz = next.z - entityState.z, distance = Math.hypot(dx, dz);
    if (distance < .14) path.shift();
    else {
      const step = Math.min(distance, dt * (hunting ? 1.5 : .8));
      const nx = entityState.x + dx / distance * step, nz = entityState.z + dz / distance * step;
      if (!world.blocked(nx, entityState.z, .16)) entityState.x = nx;
      if (!world.blocked(entityState.x, nz, .16)) entityState.z = nz;
      entityState.yaw = Math.atan2(-dx, -dz);
    }
  }
  entityState.state = hunting ? 'hunting' : 'wandering';
}
function frame(now) {
  const dt = Math.min((now - previousTime) / 1000, .05); previousTime = now; elapsed += dt;
  if (started) {
    if (!paused && chatInput.hidden) movePlayer(dt);
    if (!paused || online) moveEntity(dt);
    camera.position.set(me.x, 1.66 + (moving && !paused && !reducedMotion ? Math.sin(bob) * .026 : 0), me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
    const danger = !me.won && Math.hypot(me.x - entityState.x, me.z - entityState.z) < 1.05;
    if (danger && elapsed - caughtAt > 8 && !paused) {
      me.x = world.spawn.x; me.z = world.spawn.z; caughtAt = elapsed; $('#damage').style.opacity = '1';
      setTimeout(() => $('#damage').style.opacity = '0', 650); notify('You blinked. You are back where you started.');
    }
    if (online && now - lastSend > 75) { session.sendState(me); if (session.isHost) session.sendEntity(entityState); lastSend = now; }
  } else {
    camera.position.set(world.spawn.x, 1.67, world.spawn.z);
    camera.rotation.set(-.035, -1.1 + Math.sin(elapsed * .06) * .12, 0);
  }
  for (const [id, p] of remotePlayers) {
    const avatar = avatars.get(id); if (!avatar) continue;
    const previous = avatar.group.position.clone(); avatar.group.position.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 14));
    avatar.group.rotation.y = p.yaw || 0;
    const walking = previous.distanceTo(avatar.group.position) > .003;
    avatar.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(elapsed * 9 + i * Math.PI) * .4 : 0; });
  }
  entityMesh.position.lerp(new THREE.Vector3(entityState.x, 0, entityState.z), 1 - Math.exp(-dt * 12));
  entityMesh.rotation.y = entityState.yaw || 0;
  world.updateLights(camera.position, elapsed); renderer.render(scene, camera); requestAnimationFrame(frame);
}
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pauseGame(); $('#status').textContent = '3D graphics paused. Reload the game to reconnect.'; });
addEventListener('pagehide', () => { session.close(); audio?.ctx.close().catch(() => {}); });
$('#loading').textContent = ''; document.body.dataset.state = 'menu'; requestAnimationFrame(frame);

export function snapshot() {
  return { started, paused, seed: world.seed, position: { x: me.x, z: me.z }, yaw: me.yaw, online, room: session.code, players: [...remotePlayers.values()], calls: renderer.info.render.calls };
}
