# Blockbuster: Underground - Architecture & Technical Specification

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Electron Desktop Cockpit                  │
│       (HTML5 Canvas CRT Glitch Shader & Retro HUD)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC (ContextBridge)
┌──────────────────────────────▼──────────────────────────────┐
│                    GameEngine (Core Loop)                   │
│   ├── Monotonic Clock (350ms tick step & Anti-Skew)         │
│   ├── Reducer Pipeline (Immutable GameState mutations)      │
│   └── Middleware Stack (Distortion, Alerts, Persistence)    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│     Tor Network Client      ││      Storage & Save Engine   │
│ (SOCKS5 Proxy & Onion Route)││ (save_game.json / SQLite)    │
└─────────────────────────────┘└──────────────────────────────┘
```

## 2. Core Modules

### A. Engine & Reducer (`src/engine/`)
- **`GameEngine`:** Manages the monotonic 350ms tick cadence, action dispatching, subscriber notifications, and middleware composition.
- **`gameReducer`:** Pure function handling all state mutations:
  - Cash flow, node base yields, and operative payroll
  - Operative recruitment, stationing, durability decay, and burnout
  - Legal heat accumulation and Elias dissipation
  - CRT distortion index computation: `(1.0 - sanity) * 0.7 + (heat / 100.0) * 0.3`
  - VHS tape rental timers, forensics decryption, and clue unlocking
  - Wishlist item acquisitions and passive venture revenues
  - Community pharmacy sales, customer satisfaction scoring, and restock batches
  - Tier-II underground commodity trading with legal heat penalties
  - Emergency Scorched-Earth `NUKE_STATE` reset

### B. Tor Onion Network (`src/network/`)
- **`TorManager`:** Handles automated SOCKS5 protocol handshakes on `127.0.0.1:9050` / `9150`.
- **Validation:** Validates 56-character base32 Tor v3 `.onion` domains.
- **Diagnostics:** Monitors live proxy ping latency and circuit status for the cockpit HUD.

### C. Desktop UI & Shaders (`src/desktop/`)
- **Main Process (`main.ts`):** Secure Electron lifecycle manager with context isolation enabled.
- **Preload Bridge (`preload.ts`):** Safe, typed `window.api` bridge exposing game dispatch, state subscriptions, and Tor diagnostics.
- **Renderer (`renderer/`):** 3-column tactical cockpit featuring retro scanlines, CRT flicker, dynamic canvas glitch particles, and tactile controls.

### D. Persistence (`src/storage/`)
- **`SaveManager`:** Serializes full game states to `save_game.json` and loads active sessions.
- **`schema.sql`:** SQLCipher / SQLite relational schema for persistent node and operative tables.

---

## 3. Verification Summary
- **Test Suites:** 14 suites, 34 automated unit & integration tests passing (`npm test`).
- **Git State:** Synchronized with `origin/master` at `https://github.com/Aeonsmith/ChiHuaHua`.
- **Release Tag:** `v2.0.2000` pushed.
