const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── State ────────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id: 'command',   name: 'COMMAND',   freq: '155.340', color: '#c0392b' },
  { id: 'dispatch',  name: 'DISPATCH',  freq: '155.490', color: '#e67e22' },
  { id: 'patrol1',   name: 'PATROL 1',  freq: '155.625', color: '#2980b9' },
  { id: 'patrol2',   name: 'PATROL 2',  freq: '155.745', color: '#2980b9' },
  { id: 'ftf',       name: 'FTF',       freq: '154.920', color: '#8e44ad' },
  { id: 'tactical',  name: 'TACTICAL',  freq: '155.085', color: '#c0392b' },
  { id: 'transport', name: 'TRANSPORT', freq: '155.175', color: '#16a085' },
  { id: 'training',  name: 'TRAINING',  freq: '151.880', color: '#27ae60' },
  { id: 'admin',     name: 'ADMIN',     freq: '154.650', color: '#7f8c8d' },
];

const ROLES = {
  director:        { label: 'Director',         level: 5, badge: 'DIR',  canMonitorAll: true,  canDispatch: true,  canPanic: true },
  deputy_director: { label: 'Deputy Director',  level: 4, badge: 'DDIR', canMonitorAll: true,  canDispatch: true,  canPanic: true },
  supervisor:      { label: 'Supervisor',        level: 3, badge: 'SUPV', canMonitorAll: true,  canDispatch: true,  canPanic: true },
  deputy:          { label: 'Deputy Marshal',    level: 2, badge: 'DPTY', canMonitorAll: false, canDispatch: false, canPanic: true },
  dispatch:        { label: 'Dispatch',          level: 3, badge: 'DISP', canMonitorAll: true,  canDispatch: true,  canPanic: true },
};

const STATUS_CODES = {
  '10-6':  'Busy',
  '10-7':  'Out of Service',
  '10-8':  'In Service',
  '10-10': 'Off Duty',
  '10-17': 'En Route',
  '10-19': 'Return to Office',
  '10-20': 'Location',
  '10-23': 'Arrived on Scene',
  '10-97': 'Arrived at Station',
  '10-99': 'Emergency',
};

const units = new Map();      // socketId → unit object
const panicUnits = new Set(); // socketIds with active panic
const transmissions = [];     // log

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Login
  socket.on('login', ({ callsign, role, username }) => {
    if (!ROLES[role]) { socket.emit('error', 'Invalid role'); return; }
    const unit = {
      id: socket.id,
      callsign: callsign.toUpperCase(),
      role,
      username,
      status: '10-8',
      channel: 'dispatch',
      monitorChannels: [],
      joinedAt: Date.now(),
    };
    units.set(socket.id, unit);
    socket.join(unit.channel);
    socket.emit('logged_in', { unit, channels: CHANNELS, roles: ROLES, statuses: STATUS_CODES });
    io.emit('units_update', [...units.values()]);
    io.emit('system_message', { text: `${unit.callsign} (${ROLES[role].label}) is online`, type: 'join', ts: Date.now() });
    console.log(`[+] ${unit.callsign} logged in as ${role}`);
  });

  // Channel switch
  socket.on('switch_channel', ({ channelId }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    socket.leave(unit.channel);
    unit.channel = channelId;
    socket.join(channelId);
    units.set(socket.id, unit);
    io.emit('units_update', [...units.values()]);
  });

  // PTT begin
  socket.on('ptt_start', ({ channelId }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    const ch = CHANNELS.find(c => c.id === channelId);
    io.to(channelId).emit('ptt_active', { unitId: socket.id, callsign: unit.callsign, role: unit.role, channelId, ts: Date.now() });
    // Also notify monitors
    for (const [sid, u] of units) {
      if (u.monitorChannels.includes(channelId) && u.channel !== channelId) {
        io.to(sid).emit('ptt_active', { unitId: socket.id, callsign: unit.callsign, role: unit.role, channelId, ts: Date.now(), monitored: true });
      }
    }
    console.log(`[PTT] ${unit.callsign} keyed ${channelId}`);
  });

  // PTT end
  socket.on('ptt_end', ({ channelId }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    io.to(channelId).emit('ptt_clear', { unitId: socket.id, callsign: unit.callsign, channelId, ts: Date.now() });
    for (const [sid, u] of units) {
      if (u.monitorChannels.includes(channelId) && u.channel !== channelId) {
        io.to(sid).emit('ptt_clear', { unitId: socket.id, callsign: unit.callsign, channelId, ts: Date.now() });
      }
    }
  });

  // WebRTC signaling
  socket.on('webrtc_offer', ({ to, offer, channelId }) => {
    io.to(to).emit('webrtc_offer', { from: socket.id, offer, channelId });
  });
  socket.on('webrtc_answer', ({ to, answer }) => {
    io.to(to).emit('webrtc_answer', { from: socket.id, answer });
  });
  socket.on('webrtc_ice', ({ to, candidate }) => {
    io.to(to).emit('webrtc_ice', { from: socket.id, candidate });
  });

  // Status update
  socket.on('status_update', ({ code }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    unit.status = code;
    units.set(socket.id, unit);
    io.emit('units_update', [...units.values()]);
    io.emit('status_log', { callsign: unit.callsign, code, label: STATUS_CODES[code], ts: Date.now() });
  });

  // Panic
  socket.on('panic', () => {
    const unit = units.get(socket.id);
    if (!unit) return;
    panicUnits.add(socket.id);
    unit.status = '10-99';
    units.set(socket.id, unit);
    io.emit('panic_alert', { unitId: socket.id, callsign: unit.callsign, role: unit.role, channel: unit.channel, ts: Date.now() });
    io.emit('units_update', [...units.values()]);
    console.log(`[!!!] PANIC from ${unit.callsign}`);
  });

  socket.on('panic_clear', () => {
    const unit = units.get(socket.id);
    if (!unit) return;
    panicUnits.delete(socket.id);
    unit.status = '10-8';
    units.set(socket.id, unit);
    io.emit('panic_cleared', { callsign: unit.callsign, ts: Date.now() });
    io.emit('units_update', [...units.values()]);
  });

  // Dispatch message
  socket.on('dispatch_msg', ({ channelId, text }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    const roleInfo = ROLES[unit.role];
    if (!roleInfo.canDispatch) { socket.emit('error', 'Insufficient permissions'); return; }
    const msg = { from: unit.callsign, role: unit.role, channelId, text, ts: Date.now() };
    transmissions.push(msg);
    io.to(channelId).emit('dispatch_msg', msg);
    for (const [sid, u] of units) {
      if (u.monitorChannels.includes(channelId) && u.channel !== channelId) {
        io.to(sid).emit('dispatch_msg', { ...msg, monitored: true });
      }
    }
  });

  // Monitor channel toggle
  socket.on('monitor_toggle', ({ channelId }) => {
    const unit = units.get(socket.id);
    if (!unit) return;
    const idx = unit.monitorChannels.indexOf(channelId);
    if (idx === -1) unit.monitorChannels.push(channelId);
    else unit.monitorChannels.splice(idx, 1);
    units.set(socket.id, unit);
    socket.emit('monitor_update', unit.monitorChannels);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const unit = units.get(socket.id);
    if (unit) {
      panicUnits.delete(socket.id);
      io.emit('system_message', { text: `${unit.callsign} went offline`, type: 'leave', ts: Date.now() });
      units.delete(socket.id);
      io.emit('units_update', [...units.values()]);
    }
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

// ─── API ─────────────────────────────────────────────────────────────────────
app.get('/api/channels', (_, res) => res.json(CHANNELS));
app.get('/api/units', (_, res) => res.json([...units.values()]));
app.get('/api/log', (_, res) => res.json(transmissions.slice(-200)));
app.get('/health', (_, res) => res.json({ ok: true, units: units.size }));

// ICE server config — set TURN_HOST, TURN_USER, TURN_PASS as environment variables on Render
app.get('/api/ice', (_, res) => {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_HOST && process.env.TURN_USER && process.env.TURN_PASS) {
    servers.push(
      { urls: `turn:${process.env.TURN_HOST}:80`,              username: process.env.TURN_USER, credential: process.env.TURN_PASS },
      { urls: `turn:${process.env.TURN_HOST}:443?transport=tcp`, username: process.env.TURN_USER, credential: process.env.TURN_PASS }
    );
  }
  res.json(servers);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`USMS Radio Server running on :${PORT}`));
