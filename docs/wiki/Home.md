# Blockbuster: Underground (ChiHuaHua 2.0) - Wiki & Project Summary

Welcome to the **Blockbuster: Underground** official project wiki.

---

## 📖 Executive Summary

**Blockbuster: Underground** is a retro analog simulation game, psychological state engine, and tactical operations cockpit. The player operates from a 1990s CRT terminal interface to manage capital liquidity, psychological clarity, and legal heat while deploying operative crews, leasing analog magnetic tape dossiers for decryption, managing commercial safehouses, and monitoring Tor Onion network routing telemetry.

---

## 🧭 System Overview & Completed Milestones

### 1. State Engine & Monotonic Cadence (`src/engine/`)
- **Cadence:** 350ms high-precision simulation tick loop using `performance.now()`.
- **Anti-Clock-Skew:** Detects wall-clock shifts and clamps step updates to prevent runaway computations.
- **Pure Reducer Architecture:** Manages cash mutations, operative salaries, heat generation/dissipation, and real-time CRT distortion uniforms.

### 2. Operative Crew Management (`Benjamins` & `Eliases`)
- **`THOMAS` (Benjamin):** High-yield revenue multiplier specialist (`+150%` to `+400%`).
- **`JONAS` (Elias):** Identity mask operative dedicated to scrubbing legal heat (`-4.0` to `-20.0` heat/min).
- **Roster Controls:** Dynamic stationing selector across safehouses, promotion tiers, contract termination, and filtering toolbars.

### 3. Safehouse & Enterprise Network
- **Abandoned VHF Station:** Early-stage pirate broadcast relay.
- **Molly Pop Confectionery:** Storefront enterprise generating passive retail revenue and comfort.
- **NAV Kontor (Norwegian Welfare Hub):** Public safety net providing state benefits (`+$85.00/min`) and sanity clarity recovery (`+1.0%/min`).

### 4. Analog VHS Tape Vault & Forensics Deck
- Lease magnetic cassettes with ticking countdown windows.
- Frame-by-frame forensics scrubbing deck to decode classified clues and claim cash rewards.

### 5. Community Pharmacy & Black Market Dispensary
- **OTC & Wellness Products:** Ibuprofen 400mg, Amoxicillin 500mg, Multivitamin complex, First Aid kits.
- **Customer Satisfaction Model:** Real-time customer volume and loyalty tracking (`BRONZE` → `PLATINUM`).
- **Tier-II High-Risk Commodities:** Cognitive stimulants, concentrated herbal resins, and clinical sedatives with heat multipliers.

### 6. Wishlist & Venture Investments
- **Personal Luxury:** Designer Nursery & Baby Luxe Suite, 1990s Testarossa Supercar, Custom Iced-Out Cuban Link Chain.
- **Enterprise Ventures:** Underground Record Label, Subterranean VIP Nightclub, Orbital Satellite Relay.

### 7. Emergency Protocol (Scorched Earth "NUKE") & Persistence
- **Big Red Nuke Button:** Instantly incinerates all surveillance logs, wipes legal heat to 0%, and resets capital.
- **Save / Load Engine:** Serializes full game state to `save_game.json` and restores active sessions instantly.

### 8. Tor Onion Network Client (`src/network/`)
- Automated SOCKS5 proxy handshake (`127.0.0.1:9050` / `9150`).
- Validates 56-character base32 Tor v3 `.onion` addresses.
- Displays live latency diagnostics and circuit status on the cockpit HUD.

---

## 🛠️ Installation & Verification
- **Build:** `npm run build`
- **Desktop App:** `npm run desktop` (or desktop shortcut)
- **Terminal Console:** `npm run ui`
- **Test Suite:** `npm test` (**34 tests passing across 14 test suites**).
