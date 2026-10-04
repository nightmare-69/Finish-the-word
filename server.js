// Finish The Word - multiplayer server (Express + Socket.IO)
const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname));

// ---------- dictionary ----------
const DICT = new Set(fs.readFileSync(require('word-list'), 'utf8').split('\n').map(w => w.trim()).filter(Boolean));
console.log('Dictionary loaded:', DICT.size, 'words');

// ---------- settings ----------
const TURN_MS = 14000;          // time per turn
const START_LIVES = 2;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const RESTART_LOCK_MS = 5000;   // winner screen lock before restart
const LETTER_POOL = 'ABCDEFGHIJKLMNOPRSTUVW'; // skips Q X Y Z for the 4 start letters

const rooms = {};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms[c]);
  return c;
}

function endingLength(round) { return 1 + Math.floor(round / 10); } // 0-9:1, 10-19:2, 20-29:3 ...

// ---------- state sync ----------
function publicState(room, forId) {
  const cur = room.players[room.turnIdx];
  return {
    code: room.code,
    hostId: room.players[0] ? room.players[0].id : null,   // first in list = creator/host
    state: room.state,
    players: room.players.map(p => ({ id: p.id, name: p.name, lives: p.lives, alive: p.alive })),
    currentId: room.state === 'playing' && cur ? cur.id : null,
    phase: room.phase,
    options: cur && cur.id === forId ? room.options : null,
    required: room.required,
    typing: room.typing || '',
    round: room.round,
    lastWord: room.lastWord,
    deadline: room.deadline,
    winnerId: room.winnerId,
    restartUnlockAt: room.restartUnlockAt,
    serverNow: Date.now(),
    you: forId
  };
}
function sync(room) {
  room.players.forEach(p => io.to(p.id).emit('state', publicState(room, p.id)));
}
function toast(room, text) { io.to(room.code).emit('toast', text); }

// ---------- game flow ----------
function resetGame(room) {
  room.players.forEach(p => { p.lives = START_LIVES; p.alive = true; });
  room.round = 0; room.lastWord = null; room.winnerId = null; room.restartUnlockAt = null;
  room.turnIdx = 0; room.state = 'playing';
  startTurn(room);
}

function startTurn(room) {
  clearTimeout(room.timer);
  const p = room.players[room.turnIdx];
  room.deadline = Date.now() + TURN_MS;
  room.typing = '';
  if (!room.lastWord) {                                  // very first turn: choose from 4 letters
    room.phase = 'pick';
    room.required = null;
    room.options = [...LETTER_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
  } else {
    room.phase = 'type';
    room.options = null;
    const n = Math.min(endingLength(room.round), room.lastWord.length);
    room.required = room.lastWord.slice(-n).toUpperCase();
  }
  room.timer = setTimeout(() => onTimeout(room, p.id), TURN_MS + 150);
  sync(room);
}

function nextAliveIndex(room, from) {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (room.players[idx].alive) return { idx, wrapped: idx <= from };
  }
  return null;
}

function advance(room, noRound) {
  const next = nextAliveIndex(room, room.turnIdx);
  if (!next) return;
  if (next.wrapped && !noRound) room.round++;       // one full rotation = 1 round
  room.turnIdx = next.idx;
  startTurn(room);
}

function checkWin(room) {
  const alive = room.players.filter(p => p.alive);
  if (alive.length <= 1 && room.state === 'playing') {
    clearTimeout(room.timer);
    room.state = 'ended';
    room.phase = null; room.deadline = null;
    room.winnerId = alive[0] ? alive[0].id : null;
    room.restartUnlockAt = Date.now() + RESTART_LOCK_MS;
    sync(room);
    return true;
  }
  return false;
}

function onTimeout(room, playerId) {
  const p = room.players[room.turnIdx];
  if (room.state !== 'playing' || !p || p.id !== playerId) return;
  p.lives--;
  room.round = 0;                        // losing a life resets the round counter
  if (p.lives <= 0) p.alive = false;
  toast(room, `${p.name} ran out of time! ${p.alive ? '' : 'Eliminated 💀'}`);
  if (checkWin(room)) return;
  advance(room, true);                   // round stays at 0 after a life loss
}

// ---------- sockets ----------
io.on('connection', socket => {
  const getRoom = () => rooms[socket.data.room];

  socket.on('createRoom', (name, cb) => {
    name = String(name || '').trim().slice(0, 16);
    if (!name) return cb({ error: 'Enter your name first' });
    const code = makeCode();
    rooms[code] = { code, state: 'lobby', players: [], turnIdx: 0, round: 0, lastWord: null, phase: null,
      options: null, required: null, deadline: null, winnerId: null, restartUnlockAt: null, timer: null };
    joinRoom(socket, rooms[code], name);
    cb({ ok: true });
  });

  socket.on('joinRoom', ({ name, code }, cb) => {
    name = String(name || '').trim().slice(0, 16);
    code = String(code || '').trim().toUpperCase();
    if (!name) return cb({ error: 'Enter your name first' });
    const room = rooms[code];
    if (!room) return cb({ error: 'Room not found' });
    if (room.state !== 'lobby') return cb({ error: 'Game already started' });
    if (room.players.length >= MAX_PLAYERS) return cb({ error: 'Room is full' });
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return cb({ error: 'Name already taken in this room' });
    joinRoom(socket, room, name);
    cb({ ok: true });
  });

  socket.on('startGame', () => {
    const room = getRoom();
    if (!room || room.state !== 'lobby' || room.players[0].id !== socket.id) return;
    if (room.players.length < MIN_PLAYERS) return toast(room, `Need at least ${MIN_PLAYERS} players`);
    resetGame(room);
  });

  socket.on('pickLetter', letter => {
    const room = getRoom();
    if (!room || room.state !== 'playing' || room.phase !== 'pick') return;
    if (room.players[room.turnIdx].id !== socket.id) return;
    if (!room.options.includes(letter)) return;
    room.phase = 'type'; room.required = letter; room.options = null;   // same 14s timer keeps running
    sync(room);
  });

  // live typing: current player's text is shown to everyone else
  socket.on('typing', text => {
    const room = getRoom();
    if (!room || room.state !== 'playing' || room.phase !== 'type') return;
    if (room.players[room.turnIdx].id !== socket.id) return;
    room.typing = String(text || '').replace(/[^a-zA-Z]/g, '').slice(0, 30);
    socket.to(room.code).emit('typing', room.typing);
  });

  socket.on('submitWord', (word, cb) => {
    const room = getRoom();
    if (!room || room.state !== 'playing' || room.phase !== 'type') return cb && cb({ error: 'Not now' });
    if (room.players[room.turnIdx].id !== socket.id) return cb && cb({ error: 'Not your turn' });
    word = String(word || '').trim().toLowerCase();
    if (!/^[a-z]+$/.test(word)) return cb({ error: 'Letters only' });
    if (!word.startsWith(room.required.toLowerCase())) return cb({ error: `Must start with ${room.required}` });
    if (word.length < 2) return cb({ error: 'Too short' });
    if (!DICT.has(word)) return cb({ error: 'Not a valid word' });
    room.lastWord = word;                 // repeats are allowed
    cb({ ok: true });
    advance(room);
  });

  socket.on('restart', () => {
    const room = getRoom();
    if (!room || room.state !== 'ended' || room.players[0].id !== socket.id) return;
    if (Date.now() < room.restartUnlockAt) return;
    resetGame(room);
  });

  socket.on('leaveRoom', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

function joinRoom(socket, room, name) {
  socket.join(room.code);
  socket.data.room = room.code;
  room.players.push({ id: socket.id, name, lives: START_LIVES, alive: true });
  sync(room);
}

function leave(socket) {
  const room = rooms[socket.data.room];
  if (!room) return;
  socket.leave(room.code);
  socket.data.room = null;
  const idx = room.players.findIndex(p => p.id === socket.id);
  if (idx === -1) return;
  const wasTurn = room.state === 'playing' && idx === room.turnIdx;
  room.players.splice(idx, 1);
  if (!room.players.length) { clearTimeout(room.timer); delete rooms[room.code]; return; }
  // keep turnIdx pointing at the right player after the splice
  if (idx < room.turnIdx) room.turnIdx--;
  if (room.turnIdx >= room.players.length) room.turnIdx = 0;
  if (room.state === 'playing') {
    if (checkWin(room)) return;
    if (wasTurn) {
      // the player who left was on turn: move to the next alive player
      while (!room.players[room.turnIdx].alive) room.turnIdx = (room.turnIdx + 1) % room.players.length;
      startTurn(room);
      return;
    }
  }
  sync(room);   // host automatically becomes the next player in the list
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Finish The Word running on http://localhost:${PORT}`));
