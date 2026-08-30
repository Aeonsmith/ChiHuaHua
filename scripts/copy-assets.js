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
