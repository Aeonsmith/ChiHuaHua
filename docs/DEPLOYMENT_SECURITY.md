# Production Deployment & Security Configuration

## 1. Overview
This document specifies the release build pipeline, runtime isolation parameters, and security configuration for deploying **Blockbuster: Underground** / **Project 35** and **Module EASY**.

---

## 2. Deployment Pipeline

### A. Pre-Flight Verification
Before building distribution artifacts, ensure all static analysis and test suites pass:

```powershell path=null start=null
# 1. Type check
npm run typecheck

# 2. Automated test suite (18 suites, 43 unit/integration tests)
npm test
```

### B. Production Build Sequence
The production build compiles TypeScript source code, copies static assets (assets, configs, icons), and prepares the Electron main and renderer bundles.

```powershell path=null start=null
# Compile TypeScript to dist/ and copy static assets
npm run build
```

### C. Desktop Artifact Packaging
Executable packaging via Electron Forge or PyInstaller / Electron Packager:
- Bundles `dist/desktop/main.js` and `dist/desktop/preload.js`.
- Embeds signed application icon (`assets/icon.ico`).
- Produces packaged binaries in `dist/`.

---

## 3. Security Configuration

### A. Electron Process Isolation & CSP
The desktop environment enforces strict isolation boundaries to prevent remote code execution and prototype pollution:

```typescript path=null start=null
// BrowserWindow Configuration (src/desktop/main.ts)
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  webPreferences: {
    contextIsolation: true,       // Enforces separate execution contexts
    nodeIntegration: false,        // Disables Node.js access in renderer
    sandbox: true,                 // Restricts renderer process capabilities
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

**Content Security Policy (CSP):**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

### B. Tor Network SOCKS5 Proxy Hardening
- **Local Proxy Binding:** Connects exclusively to `localhost` (`127.0.0.1:9050` or `127.0.0.1:9150`).
- **Domain Validation:** Strict regex matching against 56-character base32 Tor v3 addresses (`^[a-z2-7]{56}\.onion$`).
- **Timeout & Anti-Leak:** Enforces DNS resolution exclusively through the Tor circuit to prevent cleartext DNS leakage.

### C. Safeguarding & Two-Person Governance (Module EASY)
- **Zero Cleartext PII:** Anonymizes source identifiers and tokenizes case records upon intake.
- **Two-Person Integrity:** High and critical risk referrals require independent secondary supervisor signatures (`assessorId !== approverId`).
- **Tamper-Evident Audit Ledger:** Every state transition (ingest, extract, evaluate, authorize, close) is recorded with SHA-256 hash chaining.
- **Chain Verification:** `AuditLedger.verifyIntegrity()` runs automatically during health checks to detect tampering.

### D. Data Persistence & Storage Encryption
- **File Permissions:** `save_game.json` and SQLite database files have restricted ACLs limited to the active runtime process.
- **Relational Storage:** SQLite/SQLCipher databases enforce full-page encryption at rest.

---

## 4. Production Operational Checklist

| Check | Requirement | Verification Method |
| :--- | :--- | :--- |
| **Context Isolation** | `contextIsolation: true` | Main process unit tests |
| **Node Integration** | `nodeIntegration: false` | Desktop launch audit |
| **Audit Chain** | Valid SHA-256 chain | `ledger.verifyIntegrity() === true` |
| **Two-Person Sign-off** | Mandatory on high risk | Safeguarding test suite |
| **SOCKS5 Connectivity** | Isolated onion routing | `TorManager.checkHealth()` |
