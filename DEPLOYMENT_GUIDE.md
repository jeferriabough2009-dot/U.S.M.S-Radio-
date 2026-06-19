# 🏛 USMS Radio System — U.S. Marshals Service
## Law Enforcement Radio Communication Platform

A full-featured, real-time radio system built with Node.js, Socket.IO, and WebRTC.

---

## 📋 Features

- **9 Radio Channels**: Command, Dispatch, Patrol 1 & 2, FTF, Tactical, Transport, Training, Admin
- **Push-to-Talk (PTT)**: Hold SPACE or press the PTT button — real mic audio via WebRTC
- **Authentic Radio Sounds**: Web Audio API squelch noise, beep tones, panic alert
- **Panic Button**: Immediate broadcast + visual overlay alerts for all units
- **Unit Status Codes**: 10-codes (10-6 through 10-99)
- **Role-Based Permissions**: Director, Deputy Director, Supervisor, Deputy Marshal, Dispatch
- **Dispatch Console**: Text dispatch + BOLO/APB presets + quick dispatch buttons
- **Channel Monitor**: Monitor multiple channels simultaneously (supervisor+)
- **Live VU Meter**: Real microphone level indicator
- **Dark Tactical Theme**: Green/gold/blue palette, military typography
- **Mobile Responsive**: Touch PTT, swipe panel, adaptive layout

---

## 🚀 Local Development

```bash
npm install
npm start
# Open http://localhost:3000
```

For auto-reload during dev:
```bash
npm run dev
```

---

## 🌐 Free Hosting — Render.com (Recommended)

Render offers a free tier that supports Node.js with WebSockets.

### Steps:
1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Free tier**: ✅
5. Deploy — Render gives you a URL like `https://usms-radio-xxxx.onrender.com`

> ⚠️ Free Render instances sleep after 15 min of inactivity. Use UptimeRobot to ping every 5 minutes to keep alive.

---

## 🌐 Alternative Free Hosts

### Railway.app
```bash
# Install Railway CLI
npm i -g @railway/cli
railway login
railway init
railway up
```

### Glitch.com
- Import from GitHub at glitch.com/new → Import from GitHub
- Glitch keeps Node.js apps alive for free

### Fly.io (Free tier)
```bash
fly launch
fly deploy
```

---

## 🔒 Role Permissions

| Role            | PTT | Dispatch Text | Monitor All | Panic |
|-----------------|-----|---------------|-------------|-------|
| Director        | ✅  | ✅            | ✅          | ✅    |
| Deputy Director | ✅  | ✅            | ✅          | ✅    |
| Supervisor      | ✅  | ✅            | ✅          | ✅    |
| Deputy Marshal  | ✅  | ❌            | ❌          | ✅    |
| Dispatch        | ✅  | ✅            | ✅          | ✅    |

---

## 📡 Channels

| Channel  | Frequency  | Purpose                    |
|----------|------------|----------------------------|
| COMMAND  | 155.340    | Command staff communications |
| DISPATCH | 155.490    | Primary dispatch channel   |
| PATROL 1 | 155.625    | Patrol units team 1        |
| PATROL 2 | 155.745    | Patrol units team 2        |
| FTF      | 154.920    | Fugitive Task Force        |
| TACTICAL | 155.085    | Tactical operations        |
| TRANSPORT| 155.175    | Prisoner transport         |
| TRAINING | 151.880    | Training exercises         |
| ADMIN    | 154.650    | Administrative             |

---

## ⌨️ Keyboard Shortcuts

- **SPACE** — Hold to transmit (PTT)
- **Enter** (in dispatch input) — Send dispatch message

---

## 🎙 WebRTC Voice Notes

Voice requires HTTPS in production (browsers block mic on HTTP).
- Render/Railway/Fly all provide HTTPS automatically ✅
- Local dev: use `localhost` (exempt from HTTPS requirement) ✅

For production, the STUN server (Google) is used for NAT traversal.
For large groups, add a TURN server (Twilio/coturn) for reliability.

---

## 🏗 Architecture

```
Browser (Client)
  ├── Socket.IO (signaling, PTT events, dispatch, status)
  ├── WebRTC (peer audio streams)
  └── Web Audio API (local sounds: squelch, beeps, panic)

Node.js Server
  ├── Express (static files)
  ├── Socket.IO (real-time events)
  └── State (units, channels, panic tracking)
```

---

*AUTHORIZED PERSONNEL ONLY — USMS Roblox Group*
