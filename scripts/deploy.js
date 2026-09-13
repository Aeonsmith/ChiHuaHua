#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');

console.log('====================================================');
console.log(' [DEPLOY] Starting Production Build & Config Setup  ');
console.log('====================================================');

function step(label, fn) {
  console.log(`\n>> [STEP] ${label}...`);
  try {
    fn();
    console.log(`✓ [SUCCESS] ${label}`);
  } catch (err) {
    console.error(`✗ [FAILED] ${label}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

// 1. Typecheck
step('Running TypeScript Typecheck', () => {
  execSync('npm run typecheck', { cwd: ROOT_DIR, stdio: 'inherit' });
});

// 2. Unit & Integration Tests
step('Running Test Suite', () => {
  execSync('npm test', { cwd: ROOT_DIR, stdio: 'inherit' });
});

// 3. Clean and Build
step('Building Production Bundles', () => {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
});

// 4. Production Environment Configuration
step('Generating Production Configuration', () => {
  const prodConfig = {
    environment: 'production',
    deployedAt: new Date().toISOString(),
    version: require('../package.json').version,
    security: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      socks5Proxy: 'localhost:9050',
      strictOnionValidation: true,
      twoPersonIntegrity: true,
    },
    paths: {
      auditLedger: 'data/audit_ledger.json',
      saveState: 'save_game.json',
      sqliteDb: 'data/state.sqlite',
    },
  };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const configPath = path.join(CONFIG_DIR, 'production.json');
  fs.writeFileSync(configPath, JSON.stringify(prodConfig, null, 2), 'utf-8');

  // Copy into dist/config
  const distConfigDir = path.join(DIST_DIR, 'config');
  if (!fs.existsSync(distConfigDir)) {
    fs.mkdirSync(distConfigDir, { recursive: true });
  }
  fs.writeFileSync(path.join(distConfigDir, 'production.json'), JSON.stringify(prodConfig, null, 2), 'utf-8');
});

// 5. Verification of Output Manifest & Hashes
step('Generating Release Manifest & Checksums', () => {
  const manifest = {
    buildDate: new Date().toISOString(),
    files: {},
  };

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(fullPath);
      } else {
        const relative = path.relative(DIST_DIR, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        manifest.files[relative] = {
          sizeBytes: content.length,
          sha256: hash,
        };
      }
    }
  }

  walk(DIST_DIR);
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
});

console.log('\n====================================================');
console.log(' [DEPLOY] Production Build Successfully Completed!  ');
console.log('====================================================');
