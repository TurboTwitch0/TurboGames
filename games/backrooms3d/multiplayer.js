// PeerJS only handles signaling: game state travels over browser data channels.
const PREFIX = 'turbogames-backrooms-level0-v2-';
const MAX_PLAYERS = 8;
const PEER_OPTIONS = {
  config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ] },
};
const noop = () => {};
const safeName = value => String(value || 'Wanderer').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Wanderer';
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 100000;
const roomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
};

function cleanPlayer(value, id, name) {
  if (!value || typeof value !== 'object' || !finite(value.x) || !finite(value.z)) return null;
  const player = { id, name: safeName(name || value.name), x: value.x, z: value.z };
  for (const key of ['y', 'a', 'yaw', 'pitch']) if (finite(value[key])) player[key] = value[key];
  player.color = /^#[a-f0-9]{6}$/i.test(value.color) ? value.color : '#d9b94c';
  player.won = value.won === true;
  return player;
}

function cleanEntity(value) {
  if (!value || typeof value !== 'object' || !finite(value.x) || !finite(value.z)) return null;
  const entity = { x: value.x, z: value.z };
  for (const key of ['y', 'a', 'yaw']) if (finite(value[key])) entity[key] = value[key];
  if (typeof value.state === 'string') entity.state = value.state.slice(0, 24);
  return entity;
}

export class RoomSession {
  constructor(options = {}) {
    this.events = Object.fromEntries(['onStatus', 'onSession', 'onPlayer', 'onLeave', 'onChat', 'onError', 'onDisconnect', 'onEntity'].map(key => [key, options[key] || noop]));
    this.getWorld = options.getWorld || (() => this.world);
    this.world = { seed: 1 };
    this.players = new Map();
    this.connections = new Map();
    this.peer = null;
    this.hostConnection = null;
    this.isHost = false;
    this.id = '';
    this.code = '';
    this.name = 'Wanderer';
    this.entity = null;
    this.joined = false;
    this.epoch = 0;
    this.pending = null;
    this.signalTimer = null;
  }

  setWorld(world) {
    if (!world || !Number.isInteger(world.seed) || world.seed < 0 || world.seed > 0xffffffff) throw new Error('The room needs a valid world seed.');
    this.world = { ...world };
    this.entity = cleanEntity(world.entity);
  }

  async host(name) {
    this.close();
    this.isHost = true;
    this.name = safeName(name);
    this.code = roomCode();
    this.events.onStatus('Creating room…');
    const token = this.epoch;
    return new Promise((resolve, reject) => {
      this._wait(resolve, reject, 15000, 'Could not create the room. Try again.');
      this._open(PREFIX + this.code, token, () => {
        this.joined = true;
        this.events.onStatus(`Room ${this.code} · share the code with a friend`);
        this._resolve({ code: this.code, id: this.id });
      });
    });
  }

  async join(code, name) {
    this.close();
    this.name = safeName(name);
    this.code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(this.code)) throw new Error('Enter a six character room code.');
    this.events.onStatus(`Joining ${this.code}…`);
    const token = this.epoch;
    return new Promise((resolve, reject) => {
      this._wait(resolve, reject, 25000, 'The room did not answer. Check the code and that the host is still playing.');
      this._open(PREFIX + 'guest-' + roomCode() + roomCode(), token, () => {
        const conn = this.peer.connect(PREFIX + this.code, { reliable: true, metadata: { name: this.name } });
        this.hostConnection = conn;
        conn.on('data', data => { if (this.epoch === token && this.hostConnection === conn) this._receiveGuest(data); });
        conn.on('error', () => { if (this.epoch === token) this._fail('Unable to connect to this room.'); });
        conn.on('close', () => {
          if (this.epoch !== token) return;
          this.joined = false;
          if (this.pending) this._fail('The host closed the room before you could join.');
          else {
            this._dispose();
            this.events.onDisconnect('The host disconnected. You can continue in solo mode.');
          }
        });
      });
    });
  }

  sendState(value) {
    if (!this.joined) return;
    const player = cleanPlayer(value, this.id, this.name);
    if (!player) return;
    this.players.set(this.id, player);
    const packet = { type: 'player', player };
    if (this.isHost) this._broadcast(packet);
    else this._send(this.hostConnection, packet);
  }

  sendEntity(value) {
    if (!this.isHost || !this.joined) return;
    const entity = cleanEntity(value);
    if (!entity) return;
    this.entity = entity;
    this._broadcast({ type: 'entity', entity });
  }

  sendChat(value) {
    if (!this.joined) return;
    const text = String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 160);
    if (!text) return;
    const packet = { type: 'chat', id: this.id, name: this.name, text };
    this.events.onChat(packet);
    if (this.isHost) this._broadcast(packet);
    else this._send(this.hostConnection, packet);
  }

  close() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('Room connection canceled.'));
      this.pending = null;
    }
    this._dispose();
    this.isHost = false;
    this.id = '';
    this.code = '';
    this.players.clear();
  }

  _wait(resolve, reject, delay, message) {
    this.pending = { resolve, reject, timer: setTimeout(() => this._fail(message), delay) };
  }

  _resolve(value) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve(value);
  }

  _fail(message) {
    const pending = this.pending;
    this.pending = null;
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(message)); }
    this._dispose();
    this.events.onStatus(message);
    this.events.onError(new Error(message));
  }

  _dispose() {
    this.epoch++;
    this.joined = false;
    clearTimeout(this.signalTimer);
    const peer = this.peer;
    this.peer = null;
    for (const conn of this.connections.values()) {
      clearTimeout(conn._roomTimer);
      conn.close();
    }
    this.connections.clear();
    this.players.clear();
    this.hostConnection?.close();
    this.hostConnection = null;
    peer?.destroy();
  }

  _open(id, token, onOpen) {
    if (typeof globalThis.Peer !== 'function') return this._fail('The multiplayer service did not load. Solo mode is available.');
    try { this.peer = new globalThis.Peer(id, PEER_OPTIONS); }
    catch { return this._fail('This browser could not start a multiplayer connection.'); }
    const peer = this.peer;
    let opened = false;
    peer.on('open', assignedId => {
      if (this.epoch !== token) return;
      clearTimeout(this.signalTimer);
      if (opened) {
        this.events.onStatus(`Room ${this.code} · connected`);
        return;
      }
      opened = true;
      this.id = assignedId;
      onOpen();
    });
    peer.on('connection', conn => {
      if (this.epoch !== token) return conn.close();
      if (this.isHost) this._accept(conn, token);
      else conn.close();
    });
    peer.on('error', error => {
      if (this.epoch !== token) return;
      const messages = {
        'peer-unavailable': 'That room is not available. Check its code and ask the host to keep it open.',
        'unavailable-id': 'That room code was already taken. Create a new room.',
        'network': 'The multiplayer server is unavailable. Please try again.',
        'browser-incompatible': 'This browser does not support multiplayer. Solo mode is available.',
      };
      this._fail(messages[error.type] || 'The online connection failed. Solo mode is available.');
    });
    peer.on('disconnected', () => {
      if (this.epoch !== token) return;
      this.events.onStatus('Reconnecting to the room service…');
      try { peer.reconnect(); } catch { /* Existing player channels can stay open. */ }
      clearTimeout(this.signalTimer);
      this.signalTimer = setTimeout(() => {
        if (this.epoch === token) this.events.onStatus('Room service disconnected. Current players can keep playing.');
      }, 10000);
    });
  }

  _accept(conn, token) {
    if (this.connections.size >= MAX_PLAYERS - 1 || this.connections.has(conn.peer)) {
      conn.on('open', () => {
        if (this.epoch !== token) return conn.close();
        this._send(conn, { type: 'rejected', message: 'This room is full (8 players).' });
        setTimeout(() => conn.close(), 200);
      });
      return;
    }
    this.connections.set(conn.peer, conn);
    conn._roomName = safeName(conn.metadata?.name);
    conn._lastChat = 0;
    conn.on('open', () => {
      if (this.epoch !== token) return conn.close();
      clearTimeout(conn._roomTimer);
      const world = this.getWorld() || this.world;
      this._send(conn, { type: 'session', ...world, players: [...this.players.values()], entity: this.entity });
    });
    conn.on('data', data => {
      if (this.epoch === token && this.connections.get(conn.peer) === conn) this._receiveHost(data, conn);
    });
    const remove = () => {
      if (this.epoch !== token || this.connections.get(conn.peer) !== conn) return;
      clearTimeout(conn._roomTimer);
      this.connections.delete(conn.peer);
      this.players.delete(conn.peer);
      conn.close();
      this._broadcast({ type: 'leave', id: conn.peer });
      this.events.onLeave(conn.peer);
    };
    conn.on('close', remove);
    conn.on('error', remove);
    conn._roomTimer = setTimeout(() => { if (this.epoch === token && !conn.open) remove(); }, 20000);
  }

  _receiveHost(data, conn) {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'player') {
      const player = cleanPlayer(data.player, conn.peer, conn._roomName);
      if (!player) return;
      this.players.set(conn.peer, player);
      this.events.onPlayer(player);
      this._broadcast({ type: 'player', player }, conn);
    } else if (data.type === 'chat') {
      const now = Date.now();
      if (now - conn._lastChat < 500) return;
      conn._lastChat = now;
      const text = String(data.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 160);
      if (!text) return;
      const packet = { type: 'chat', id: conn.peer, name: conn._roomName, text };
      this.events.onChat(packet);
      this._broadcast(packet, conn);
    }
  }

  _receiveGuest(data) {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'rejected') return this._fail(String(data.message || 'This room is unavailable.').slice(0, 120));
    if (data.type === 'session') {
      if (this.joined || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) return;
      const players = [];
      for (const value of Array.isArray(data.players) ? data.players.slice(0, MAX_PLAYERS) : []) {
        if (typeof value?.id !== 'string') continue;
        const player = cleanPlayer(value, value.id);
        if (player) { players.push(player); this.players.set(player.id, player); }
      }
      this.joined = true;
      this.entity = cleanEntity(data.entity);
      this.events.onSession({ ...data, players, entity: this.entity });
      this.events.onStatus(`Room ${this.code} · connected`);
      this._resolve(this.id);
      return;
    }
    if (!this.joined) return;
    if (data.type === 'player' && typeof data.player?.id === 'string' && data.player.id !== this.id) {
      const player = cleanPlayer(data.player, data.player.id);
      if (player) { this.players.set(player.id, player); this.events.onPlayer(player); }
    } else if (data.type === 'entity') {
      const entity = cleanEntity(data.entity);
      if (entity) { this.entity = entity; this.events.onEntity(entity); }
    } else if (data.type === 'leave' && typeof data.id === 'string') {
      this.players.delete(data.id);
      this.events.onLeave(data.id);
    } else if (data.type === 'chat') {
      this.events.onChat({ id: String(data.id || ''), name: safeName(data.name), text: String(data.text || '').slice(0, 160) });
    }
  }

  _send(conn, data) { if (conn?.open) { try { conn.send(data); } catch { /* The close event removes this channel. */ } } }
  _broadcast(data, except) { for (const conn of this.connections.values()) if (conn !== except) this._send(conn, data); }
}
