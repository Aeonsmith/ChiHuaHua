# Blockbuster: Underground (ChiHuaHua 2.0)

> **Retro Analog Financial Simulation, Psychological State Engine & Tor Onion Network Integration**

---

## 📼 Overview

**Blockbuster: Underground** is an alternate reality business simulation and psychological state engine. Operating through a 1990s retro CRT terminal and desktop cockpit, players manage capital liquidity against legal heat and mental clarity, deploying operative crews, leasing analog VHS tape dossiers for decryption, managing commercial safehouses, and routing communications through the Tor Onion network.

---

## ⚡ Core Features

- **Monotonic Tick Engine (`src/engine/`):**
  - High-precision 350ms simulation loop using `performance.now()`.
  - Built-in anti-clock-skew detection to prevent calculation runaway when the system sleeps.
  - Pure, immutable reducer pattern managing cash flow, operative payroll, and shader distortion uniforms.

- **Operative Crew Management (`Benjamins` & `Eliases`):**
  - **Benjamins:** Capital operatives providing revenue multipliers to assigned hubs (`+150%` to `+400%` yield).
  - **Eliases:** Identity mask operatives who actively scrub legal heat (`-4.0` to `-20.0` heat/min).
  - **Dynamic Relocation:** Station operatives across controlled properties or keep them in the reserve pool.
  - **Promotions & Durability:** Upgrade operative tiers or terminate contracts under high surveillance scrutiny.

- **Controlled Safehouse Network:**
  - **Abandoned VHF Station:** Early-stage pirate broadcast relay.
  - **Molly Pop Confectionery:** High-traffic storefront business generating retail revenue and comfort.
  - **NAV Kontor (Norwegian Welfare Hub):** Public safety net providing state benefits and passive mental clarity recovery.

- **Analog VHS Tape Vault & Forensics Scrubbing:**
  - Lease magnetic tape cassettes with real-time expiration countdown windows.
  - Scrub forensics frames to decode encrypted narrative fragments and earn capital rewards.

- **Community Pharmacy & Satisfaction Model:**
  - Stock over-the-counter and wellness remedies (Ibuprofen, Amoxicillin, Multivitamins, Trauma Kits).
  - Dynamic customer satisfaction tracking (`BRONZE` → `SILVER` → `GOLD` → `PLATINUM` loyalty tiers).

- **Tier-II High-Risk Underground Commodities:**
  - Trade restricted research compounds (Class-IV Stimulants, Concentrated Herbal Resins, Clinical Tranquilizers).
  - High profit margins offset by elevated **Legal Heat** and police raid risks.

- **Wishlist & Venture Investments:**
  - Acquire personal wishlist items (Designer Baby Luxe Suite, Vintage 1990s Supercar, Diamond Cuban Link Chain).
  - Launch enterprise ventures (Underground Record Label, Subterranean VIP Nightclub, Orbital Satellite Relay).

- **Emergency Protocol (Scorched Earth "NUKE"):**
  - Big Red Nuke button instantly incinerates all surveillance logs, wipes legal heat down to 0%, and resets seed capital.

- **Tor Onion Network Client (`src/network/`):**
  - Automated SOCKS5 proxy handshake (`127.0.0.1:9050` / `9150`).
  - Tor v3 `.onion` (56-character base32) domain validation.
  - Live circuit latency diagnostics displayed on the cockpit HUD.

---

## 📁 Project Structure

```
blockbuster-underground/
├── src/
│   ├── desktop/               # Electron desktop GUI
│   │   ├── main.ts            # Main process lifecycle & IPC bridges
│   │   ├── preload.ts         # Context-isolated API bridge
│   │   └── renderer/          # HTML5 Canvas CRT shader, audio & cockpit view
│   ├── engine/                # State reducer, monotonic tick loop, middlewares
│   ├── network/               # Tor SOCKS5 client & onion router manager
│   ├── storage/               # JSON & SQLite persistence managers
│   ├── types/                 # TypeScript interfaces, state models & actions
│   ├── ui/                    # Terminal ANSI renderer & CLI controller
│   └── cli.ts                 # Terminal entrypoint
├── config/
│   ├── network.json           # Proxy endpoints, target onion addresses, timeouts
│   └── torrc.example          # Sample Tor daemon configuration
├── tests/                     # 34 unit and integration test suites
├── launch.bat                 # Windows desktop launcher batch file
├── package.json
└── tsconfig.json
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **npm:** v9.0.0 or higher
- **Tor Daemon (Optional):** Local Tor service or Tor Browser for live onion circuit health checks.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Aeonsmith/ChiHuaHua.git
cd ChiHuaHua
npm install
```

### 2. Build Project
```bash
npm run build
```

---

## 🎮 Usage & Launch Options

### Option A: Launch Desktop Application (GUI)
Run via terminal or double-click the **`Blockbuster Underground`** shortcut on your Desktop:
```bash
npm run desktop
```

### Option B: Launch Terminal Console (TUI)
For a pure retro command-line experience inside your terminal:
```bash
npm run ui
```

---

## 🧪 Testing

Run the full automated test suite covering state transitions, economic yields, heat accumulation, Tor network tunneling, and UI rendering:

```bash
npm test
```

- **Test Framework:** Node.js native test runner (`node:test` + `tsx`)
- **Coverage:** 34 tests across 14 test suites (100% passing).

---

## 📄 License
ISC License.
