const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const manifestsDir = path.join(__dirname, 'manifests');

// 1. CLEAN: Delete the dist folder if it exists to start fresh
if (fs.existsSync(distDir)) {
    console.log("🧹 Cleaning old dist folder...");
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// 2. COPY ASSETS: Copy icons, lib, and HTML files
console.log("📦 Copying static assets...");
if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, distDir, { recursive: true });
}

// 3. APPLY MANIFEST: Use the chrome manifest
console.log("📑 Applying Chrome manifest...");
fs.copyFileSync(path.join(manifestsDir, 'chrome.json'), path.join(distDir, 'manifest.json'));

console.log("✅ Assembly complete!");
