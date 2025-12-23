<div align="center">
  <img width="1200" height="475" alt="Albin's Tic Tac Toe banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>Albin's Tic Tac Toe</h1>
  <p>Real-time, peer-to-peer Tic Tac Toe — create a room, share a 3-digit code, and play instantly.</p>

  <p>
    <a href="https://albins-tic-tac-toe.vercel.app/">🌐 Live Demo</a> • 
    <a href="https://github.com/ajnaduvil/albins-tic-tac-toe">📦 GitHub</a>
  </p>
</div>

## About

This is a **browser-based multiplayer Tic Tac Toe** game built with **React + TypeScript + Vite** and powered by **PeerJS (WebRTC)** for real-time, peer-to-peer gameplay.

No accounts, no backend: the host creates a room code, the other player joins, and the game state syncs directly between browsers.

## Features

- **P2P real-time multiplayer** via WebRTC (PeerJS)
- **Room codes** (3 digits) for quick sharing
- **Custom board sizes**: 3×3 up to 6×6
- **Custom win condition**: 3-in-a-row up to 6-in-a-row (bounded by grid size)
- **Rematch flow + score tracking**
- **In-game chat** (with saved quick-message presets)
- **Emoji reactions** and a **“nudge”** (shake) button
- **Confetti** when you win

## How it works (quick)

- The host creates a room and gets a **3-digit code**.
- Under the hood that code maps to a PeerJS peer id (see `hooks/usePeerGame.ts`).
- Players connect via WebRTC; moves/chat/emotes are sent over the data channel.

## Getting started (local dev)

### Prerequisites

- Node.js (recommended: **18+**)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Vite runs on `http://localhost:3000` by default.

### Build & preview

```bash
npm run build
npm run preview
```

## Scripts

- **`npm run dev`**: start dev server
- **`npm run build`**: production build
- **`npm run preview`**: preview the production build locally
- **`npm run deploy`**: deploy to Vercel (`vercel --prod`)

## Deploying

### Vercel (recommended)

- **Via Vercel UI**: import the repo and deploy as a Vite app (output: `dist`).
- **Via CLI**:

```bash
npx vercel --prod
```

## TURN Server Setup (Optional but Recommended)

For reliable connections across different networks (PC↔mobile, different locations), you can configure a TURN server. The app includes support for **Turnix.io** TURN servers.

### Setup Steps

1. **Get a Turnix.io API token**:
   - Sign up at [Turnix.io](https://turnix.io/)
   - Create a project and generate an API token (free tier: 10 GB/month)

2. **Add environment variable in Vercel**:
   - Go to your Vercel project → **Settings** → **Environment Variables**
   - Add:
     - **Name**: `TURNIX_API_TOKEN`
     - **Value**: Your Turnix.io API token
     - **Environment**: Production, Preview, Development (select all)

3. **Redeploy**:
   - The app will automatically fetch TURN credentials from your serverless function
   - If TURN is unavailable, the app gracefully falls back to STUN-only

### How it works

- The app includes a Vercel serverless function (`api/get-turn-credentials.ts`) that securely fetches TURN credentials from Turnix.io
- Your API token stays server-side (never exposed to clients)
- TURN servers are fetched once on app load and included in WebRTC configuration
- If TURN fetch fails, the app continues with STUN-only (graceful degradation)

## Notes / limitations

- **P2P connectivity varies by network**: some strict NAT/firewall setups may fail without a TURN server. **Adding TURN (see above) resolves this**.
- **Room codes are short**: treat them like "easy sharing", not security.
- **Privacy**: gameplay/chat data is sent peer-to-peer over WebRTC (encrypted transport), but signaling uses PeerJS infrastructure.

## Contributing

PRs and issues are welcome. If you’re proposing a bigger change, open an issue first so we can align on scope.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2024 Albin
