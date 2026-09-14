import os
import sys
import json
import time
import socket
import sqlite3
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import webbrowser

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, "data.db")
PORT = 7890

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            tags TEXT,
            content TEXT NOT NULL,
            cleaned_content TEXT,
            is_onion_synced INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tor_settings (
            id INTEGER PRIMARY KEY,
            socks_host TEXT DEFAULT '127.0.0.1',
            socks_port INTEGER DEFAULT 9150,
            auto_onion_route INTEGER DEFAULT 1,
            onion_address TEXT DEFAULT 'chihuahua7x3underground.onion'
        )
    """)
    cursor.execute("SELECT COUNT(*) FROM tor_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO tor_settings (id, socks_host, socks_port, auto_onion_route, onion_address) VALUES (1, '127.0.0.1', 9150, 1, 'chihuahua7x3underground.onion')")

    cursor.execute("SELECT COUNT(*) FROM notes")
    if cursor.fetchone()[0] == 0:
        seed_notes = [
            (
                "Bi-Polar Bear Concept & Market Regime Dynamics",
                "Financial Mechanics",
                "bipolar-bear,volatility,regime-shift,liquidation,squeeze",
                """# Bi-Polar Bear Concept

The **Bi-Polar Bear** regime is characterized by rapid, violent oscillations between extreme liquidation cascades and parabolic counter-squeezes, breaking standard Gaussian bell-curve models.

## Core Characteristics:
- **Depressive Phase:** Cascading leverage liquidation, collateral compression, bid evaporation.
- **Manic Phase:** Gamma-induced short squeezes and sharp mean-reversion spikes driven by thin order books.
- **Bimodal Return Distribution:** Acute kurtosis with fat tails on both wings.

## Positioning Strategy:
1. Long-gamma & volatility dispersion overlays.
2. Delta-neutral straddle/strangle scalping during regime transitions.
3. Strict limit-order execution; avoidance of taker liquidity during the strike bell."""
            ),
            (
                "The Three Bells Protocol (Signal & Trigger Architecture)",
                "Signal Systems",
                "three-bells,signals,dom,iv-skew,exhaustion",
                """# The Three Bells Protocol

A deterministic framework for identifying and navigating bi-polar market shifts:

### 🔔 Bell 1: The Skew Warning (Variance Anomaly)
- **Signal:** IV skew divergence between deep OTM puts and calls.
- **Microstructure:** Correlation failure across primary index hedges and divergence in funding rates.

### 🔔 Bell 2: The Strike Trigger (Liquidity Rupture)
- **Signal:** Depth of Market (DOM) replenishment velocity plunges below threshold.
- **Microstructure:** Stop clusters breached; cascade liquidations commence.

### 🔔 Bell 3: The Exhaustion Bell (Regime Pivot)
- **Signal:** Climax taker volume fails to produce new lows/highs; Open Interest resets.
- **Microstructure:** Delta absorption completed; rotate risk back to mean-reversion baseline."""
            ),
            (
                "ChiHuaHua Micro-Cap Velocity & Asymmetric Convexity",
                "Business Concepts",
                "chihuahua,micro-cap,convexity,leverage,underground-flow",
                """# ChiHuaHua Asymmetric Capital Model

Underground financial notes on capital velocity in high-agility micro-cap entities:

- **Agility Factor:** Rapid capital reallocation without market impact footprints.
- **Convex Payoff Profiles:** Capped downside via structural stop-outs paired with unconstrained upside exposure.
- **Decentralized Flow:** Liquidity routing across peer-to-peer dark pools and Tor-routed settlement layers."""
            ),
            (
                "Tor Onion Network Architecture & Zero-Leak Routing",
                "Tor & Onion Network",
                "tor,onion,socks5,privacy,zero-leak,financial-ops",
                """# Tor Network Integration & Confidentiality

Secure data layer architecture for underground financial intelligence:

- **SOCKS5 Bridge:** Directs data exchange through Tor daemon ports (9050 system / 9150 Tor Browser).
- **Zero-Telemetry Protocol:** Strips EXIF, IP headers, tracking parameters, and system fingerprinting prior to local persistence.
- **Onion Relay Sync:** Decentralized note synchronization across `.onion` hidden services."""
            ),
            (
                "Ford Bronco: Heritage IP, Margin Expansion & Secondary Arbitrage",
                "Business Concepts",
                "ford-bronco,heritage-ip,margin-expansion,arbitrage,tangible-assets,supply-chain",
                """# Ford Bronco: Financial & Market Dynamics Case Study

Analysis of the Ford Bronco franchise revitalization as a model for heritage brand capital efficiency, supply-demand asymmetry, and physical asset hedging:

## 1. Heritage IP Monetization & Margin Architecture
- **Capital Leverage on Legacy Brands:** Reviving vintage IP (60s-70s iconic SUV brand equity) with near-zero initial consumer acquisition friction.
- **High-Margin Trim Escalation:** Base MSRP vs. transaction price spread driven by options, Sasquatch packages, and Raptor editions exceeding 40%+ gross margins.
- **Pre-Order Derivative Market:** Reservation vouchers trading as synthetic call options on delivery allocations.

## 2. Supply Squeeze & Secondary Market Arbitrage
- **Artificial & Supply-Driven Scarcity:** Production bottlenecks (microchips, roof molding constraints) creating prolonged inverted depreciation curves (used units trading above MSRP).
- **Dealer Markups & Velocity Premiums:** Capturing consumer surplus through immediate-delivery premiums.

## 3. Physical Asset Resilience & Tangible Utility
- **Macro Hedging Characteristics:** Utilitarian, off-road capable vehicle assets serving as durable stores of value during high-inflation regimes.
- **Decentralized Readiness:** Off-grid capability aligned with resilient underground infrastructure.

## 4. Sixth Generation (2021+ Model Year) Structural Dynamics
- **25-Year Hiatus Disruption:** Following discontinuation in 1996, the 6th generation returned for the 2021 model year on the mid-size T6 body-on-frame platform.
- **Modular Architecture:** Removable frameless doors, modular roof panels, and factory accessory mounting points capturing high-velocity aftermarket ecosystem margins.
- **Targeting Monopoly Pricing:** Directly challenged the incumbent market share of the Jeep Wrangler, decomposing single-supplier pricing power in the enthusiast 4x4 sector."""
            )
        ]
        for note in seed_notes:
            cursor.execute(
                "INSERT INTO notes (title, category, tags, content, cleaned_content, is_onion_synced) VALUES (?, ?, ?, ?, ?, 1)",
                (note[0], note[1], note[2], note[3], note[3])
            )
    conn.commit()
    conn.close()

def check_tor_port(host, port):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.5)
        res = s.connect_ex((host, port))
        s.close()
        return res == 0
    except Exception:
        return False

def clean_text(raw_text):
    if not raw_text:
        return ""
    import re
    # Remove tracking URLs, UTM parameters, invisible control chars
    cleaned = re.sub(r'(\?|&)(utm_[a-zA-Z0-9_]+|fbclid|gclid|ref)=[a-zA-Z0-9_%+-]*', '', raw_text)
    # Strip excess blank trailing lines and non-printable control characters (except newline, tab)
    cleaned = "".join(ch for ch in cleaned if ch == '\n' or ch == '\t' or ord(ch) >= 32)
    # Standardize line breaks
    cleaned = re.sub(r'\r\n', '\n', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()

class AppHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Quiet terminal

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            html_path = os.path.join(APP_DIR, "index.html")
            if os.path.exists(html_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                with open(html_path, "rb") as f:
                    self.wfile.write(f.read())
                return

        elif path == "/api/notes":
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query_params = urllib.parse.parse_qs(parsed.query)
            q = query_params.get("q", [""])[0].strip()
            cat = query_params.get("category", [""])[0].strip()
            tag = query_params.get("tag", [""])[0].strip()
            scope = query_params.get("scope", ["all"])[0].strip().lower()

            query = "SELECT * FROM notes WHERE 1=1"
            params = []
            
            if tag:
                query += " AND tags LIKE ?"
                params.append(f"%{tag}%")

            if q:
                if q.startswith("#"):
                    # Tag shortcut search
                    tag_term = q[1:].strip()
                    query += " AND tags LIKE ?"
                    params.append(f"%{tag_term}%")
                elif scope == "tags":
                    tokens = [t.strip() for t in q.split() if t.strip()]
                    for tok in tokens:
                        query += " AND tags LIKE ?"
                        params.append(f"%{tok}%")
                elif scope == "content":
                    tokens = [t.strip() for t in q.split() if t.strip()]
                    for tok in tokens:
                        query += " AND (content LIKE ? OR cleaned_content LIKE ?)"
                        params.extend([f"%{tok}%", f"%{tok}%"])
                else: # all
                    tokens = [t.strip() for t in q.split() if t.strip()]
                    for tok in tokens:
                        query += " AND (title LIKE ? OR content LIKE ? OR cleaned_content LIKE ? OR tags LIKE ?)"
                        params.extend([f"%{tok}%", f"%{tok}%", f"%{tok}%", f"%{tok}%"])

            if cat:
                query += " AND category = ?"
                params.append(cat)
            
            query += " ORDER BY updated_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            notes = [dict(row) for row in rows]
            conn.close()

            self.send_json(200, {"status": "ok", "count": len(notes), "notes": notes})
            return

        elif path == "/api/tor/status":
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT socks_host, socks_port, auto_onion_route, onion_address FROM tor_settings WHERE id = 1")
            row = cursor.fetchone()
            conn.close()

            host = row[0] if row else "127.0.0.1"
            port = row[1] if row else 9150
            auto_route = bool(row[2]) if row else True
            onion_addr = row[3] if row else "chihuahua7x3underground.onion"

            # Check both 9150 (Tor Browser) and 9050 (Tor System Daemon)
            is_active = check_tor_port(host, port)
            alt_port = 9050 if port == 9150 else 9150
            is_alt_active = check_tor_port(host, alt_port)

            detected_port = port if is_active else (alt_port if is_alt_active else None)

            self.send_json(200, {
                "status": "ok",
                "tor_connected": is_active or is_alt_active,
                "active_port": detected_port or port,
                "configured_port": port,
                "host": host,
                "onion_address": onion_addr,
                "auto_onion_route": auto_route,
                "ports_checked": {str(port): is_active, str(alt_port): is_alt_active}
            })
            return

        elif path == "/api/three-bells/metrics":
            import random
            # Dynamic market simulation data for Bi-Polar Bear regime indicator
            iv_skew = round(random.uniform(1.15, 3.85), 2)
            dom_depth = round(random.uniform(12.4, 94.8), 1)
            oi_delta_pct = round(random.uniform(-18.5, 34.2), 1)

            # Determine active bell status
            if iv_skew > 3.0 or dom_depth < 25.0:
                active_bell = 2
                bell_name = "2nd Bell: Liquidity Breakdown & Strike"
                regime = "Bi-Polar Bear (Manic / Liquidation Cascade)"
            elif iv_skew > 2.0:
                active_bell = 1
                bell_name = "1st Bell: Variance Anomaly & Skew Alert"
                regime = "Skew Dispersion Phase"
            else:
                active_bell = 3 if abs(oi_delta_pct) < 5.0 else 0
                bell_name = "3rd Bell: Exhaustion & Pivot" if active_bell == 3 else "Baseline Surveillance"
                regime = "Equilibrium / Baseline"

            self.send_json(200, {
                "status": "ok",
                "iv_skew": iv_skew,
                "dom_depth_score": dom_depth,
                "oi_delta_pct": oi_delta_pct,
                "active_bell": active_bell,
                "bell_name": bell_name,
                "regime": regime,
                "timestamp": time.strftime("%H:%M:%S")
            })
            return

        elif path == "/api/categories":
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT category FROM notes ORDER BY category")
            cats = [r[0] for r in cursor.fetchall() if r[0]]
            conn.close()
            self.send_json(200, {"status": "ok", "categories": cats})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if parsed.path == "/api/notes":
            title = data.get("title", "Untitled Cleaned Note")
            category = data.get("category", "General Finance")
            tags = data.get("tags", "")
            content = data.get("content", "")
            cleaned = clean_text(content)

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO notes (title, category, tags, content, cleaned_content, is_onion_synced, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)",
                (title, category, tags, content, cleaned)
            )
            note_id = cursor.lastrowid
            conn.commit()
            conn.close()

            self.send_json(201, {"status": "ok", "id": note_id, "message": "Note recorded & cleaned"})
            return

        elif parsed.path == "/api/clean":
            raw = data.get("text", "")
            cleaned = clean_text(raw)
            self.send_json(200, {"status": "ok", "cleaned_text": cleaned})
            return

        elif parsed.path == "/api/tor/save-settings":
            host = data.get("socks_host", "127.0.0.1")
            port = int(data.get("socks_port", 9150))
            auto_route = 1 if data.get("auto_onion_route", True) else 0
            onion_addr = data.get("onion_address", "chihuahua7x3underground.onion")

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE tor_settings SET socks_host = ?, socks_port = ?, auto_onion_route = ?, onion_address = ? WHERE id = 1",
                (host, port, auto_route, onion_addr)
            )
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "ok", "message": "Tor settings updated"})
            return

        self.send_json(404, {"error": "Not Found"})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/notes/"):
            note_id = parsed.path.split("/")[-1]
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            title = data.get("title")
            category = data.get("category")
            tags = data.get("tags")
            content = data.get("content")
            cleaned = clean_text(content) if content is not None else None

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                """UPDATE notes 
                   SET title = COALESCE(?, title),
                       category = COALESCE(?, category),
                       tags = COALESCE(?, tags),
                       content = COALESCE(?, content),
                       cleaned_content = COALESCE(?, cleaned_content),
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                (title, category, tags, content, cleaned, note_id)
            )
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "ok", "message": "Note updated"})
            return
        self.send_json(404, {"error": "Not Found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/notes/"):
            note_id = parsed.path.split("/")[-1]
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "ok", "message": "Note deleted"})
            return
        self.send_json(404, {"error": "Not Found"})

    def send_json(self, code, obj):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode("utf-8"))

def run_server():
    init_db()
    server_address = ('127.0.0.1', PORT)
    httpd = HTTPServer(server_address, AppHandler)
    print(f"[*] Blockbuster Underground Cleaned Notes (ChiHuaHua) running at http://127.0.0.1:{PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(0.5)
    url = f"http://127.0.0.1:{PORT}"
    try:
        webbrowser.open(url)
    except Exception:
        pass
    print(f"App interface ready at {url}. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping application.")
