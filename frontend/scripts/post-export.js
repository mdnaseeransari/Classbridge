const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');
const targetDir = path.join(__dirname, '../dist/assets/fonts');

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  let copied = 0;
  files.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const targetFile = path.join(targetDir, file);
    fs.copyFileSync(srcFile, targetFile);
    copied++;
  });
  console.log(`[Post-Export] Successfully copied ${copied} font files to dist/assets/fonts/ (bypassing node_modules deploy restriction)`);
} else {
  console.warn('[Post-Export] Source font directory not found:', srcDir);
}
