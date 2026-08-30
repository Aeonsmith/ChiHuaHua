const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '..', 'src', 'desktop', 'renderer');
const destDir = path.join(__dirname, '..', 'dist', 'desktop', 'renderer');

fs.mkdirSync(destDir, { recursive: true });

['index.html', 'style.css'].forEach(file => {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(destDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`Copied ${file} -> dist/desktop/renderer/`);
  }
});

// Sanitize app.js in dist to remove CommonJS exports line for browser script tag
const appJsPath = path.join(destDir, 'app.js');
if (fs.existsSync(appJsPath)) {
  let content = fs.readFileSync(appJsPath, 'utf8');
  content = content.replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{\s*value:\s*true\s*\}\);?/g, '');
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log('Sanitized dist/desktop/renderer/app.js for browser runtime');
}
