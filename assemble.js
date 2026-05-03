const fs   = require('fs');
const path = require('path');

const browser = process.argv[2]; // "chrome" or "firefox"
if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node assemble.js chrome|firefox');
  process.exit(1);
}

const OUT = path.join('dist', browser); // dist/chrome or dist/firefox

// 1. Clean and recreate the output folder
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 2. Copy compiled JS from dist/ (tsc output)
const COMPILED = [
  'background.js',
  'content.js',
  'sandbox.js',
  'viewer.js',
  'popup.js',
  'options.js',
  'config.js',
  'mvs-builder.js',
];

for (const file of COMPILED) {
  fs.copyFileSync(path.join('dist', file), path.join(OUT, file));
}

// 3. Copy the right manifest
fs.copyFileSync(path.join(`manifests/`, `${browser}.json`), path.join(OUT, 'manifest.json'));

// 4. Copy static assets
const STATIC = [
  'viewer.html', 'sandbox.html', 'popup.html', 'popup.css',
  'options.html', 'options.css'
];
for (const file of STATIC) {
  fs.copyFileSync(path.join('public/', file), path.join(OUT, file));
}

// 5. Copy folders (icons, lib)
fs.cpSync(path.join('public', 'icons'), path.join(OUT, 'icons'), { recursive: true });

fs.mkdirSync(path.join(OUT, 'lib'), { recursive: true });
fs.copyFileSync(
  path.join('node_modules', 'molstar', 'build', 'viewer', 'molstar.js'),
  path.join(OUT, 'lib', 'molstar.js')
);
fs.copyFileSync(
  path.join('node_modules', 'molstar', 'build', 'viewer', 'molstar.css'),
  path.join(OUT, 'lib', 'molstar.css')
);

console.log(`✅  Built for ${browser} → ${OUT}/`);
