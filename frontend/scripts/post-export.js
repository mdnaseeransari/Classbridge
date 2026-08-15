const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const distAssetsDir = path.join(distDir, 'assets');
const distNodeModules = path.join(distAssetsDir, 'node_modules');

if (fs.existsSync(distNodeModules)) {
  // 1. Copy vector icon font files directly to dist/assets/fonts/
  const fontSrcDir = path.join(distNodeModules, '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');
  const fontTargetDir = path.join(distAssetsDir, 'fonts');
  if (fs.existsSync(fontSrcDir)) {
    fs.mkdirSync(fontTargetDir, { recursive: true });
    fs.readdirSync(fontSrcDir).forEach(file => {
      fs.copyFileSync(path.join(fontSrcDir, file), path.join(fontTargetDir, file));
    });
  }

  // 2. Copy entire dist/assets/node_modules/ to dist/assets/vendor/
  const vendorTargetDir = path.join(distAssetsDir, 'vendor');
  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  copyRecursiveSync(distNodeModules, vendorTargetDir);

  // 3. Rewrite all URLs in compiled bundles
  const oldFontPath = '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/';
  const newFontPath = '/assets/fonts/';
  const oldNodeModulesPath = '/assets/node_modules/';
  const newNodeModulesPath = '/assets/vendor/';

  function walkAndReplace(dir) {
    let replacedCount = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        replacedCount += walkAndReplace(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css') || entry.name.endsWith('.json'))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;
        if (content.includes(oldFontPath)) {
          content = content.replaceAll(oldFontPath, newFontPath);
          modified = true;
        }
        if (content.includes(oldNodeModulesPath)) {
          content = content.replaceAll(oldNodeModulesPath, newNodeModulesPath);
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          replacedCount++;
        }
      }
    }
    return replacedCount;
  }

  const totalFilesModified = walkAndReplace(distDir);
  console.log(`[Post-Export] Modified ${totalFilesModified} bundle file(s). All node_modules paths re-mapped to non-ignored directories.`);

  // 4. Remove dist/assets/node_modules to ensure Cloudflare Pages upload never sees node_modules
  fs.rmSync(distNodeModules, { recursive: true, force: true });
  console.log('[Post-Export] Successfully removed dist/assets/node_modules/ directory.');
} else {
  console.warn('[Post-Export] Source node_modules directory in dist not found.');
}
