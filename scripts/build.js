/**
 * Builds a loadable extension package: dist/dark-patterns-detector-v<version>.zip
 *
 * Instead of a hand-maintained file list (which went stale before), the files
 * are discovered from what the extension actually references:
 * - manifest.json: background service worker, popup, icons
 * - HTML files: <script src> and <link href>
 * - JS files: importScripts('...') and scripting `files: [...]` arrays
 * The build fails if a referenced file is missing.
 *
 * Usage:
 *   npm run build              # requires config.js with a real API key
 *   npm run build -- --ci      # CI: allows a missing/placeholder config.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const isCi = process.argv.includes('--ci');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Files named directly in the manifest
function manifestFiles(manifest) {
  const files = new Set(['manifest.json']);
  if (manifest.background?.service_worker) files.add(manifest.background.service_worker);
  if (manifest.action?.default_popup) files.add(manifest.action.default_popup);
  Object.values(manifest.icons || {}).forEach(f => files.add(f));
  Object.values(manifest.action?.default_icon || {}).forEach(f => files.add(f));
  (manifest.content_scripts || []).forEach(cs => [...(cs.js || []), ...(cs.css || [])].forEach(f => files.add(f)));
  return files;
}

// Files referenced from inside an HTML or JS file
function referencedFiles(file) {
  const text = read(file);
  const found = [];
  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) {
      if (!/^[a-z]+:/i.test(m[1])) found.push(m[1]);
    }
  } else if (file.endsWith('.js')) {
    for (const m of text.matchAll(/importScripts\(([^)]*)\)/g)) {
      for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) found.push(s[1]);
    }
    for (const m of text.matchAll(/files:\s*\[([^\]]*)\]/g)) {
      for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) found.push(s[1]);
    }
    // config.js is loaded at runtime via chrome.runtime.getURL
    for (const m of text.matchAll(/getURL\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1]);
  }
  return found.map(f => path.posix.normalize(f.replace(/^\.?\//, '')));
}

function collectFiles() {
  const manifest = JSON.parse(read('manifest.json'));
  const files = manifestFiles(manifest);
  const queue = [...files];
  while (queue.length) {
    const file = queue.shift();
    // Missing files (e.g. config.js in CI) are reported later, not scanned
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    for (const ref of referencedFiles(file).filter(f => /\.(html|js|css|png|svg|json)$/.test(f))) {
      if (!files.has(ref)) {
        files.add(ref);
        queue.push(ref);
      }
    }
  }
  return { manifest, files: [...files].sort() };
}

function checkConfig(files) {
  if (!files.includes('config.js')) return;
  const configPath = path.join(ROOT, 'config.js');
  const configured = fs.existsSync(configPath) &&
    /GEMINI_API_KEY:\s*['"](?!YOUR_GEMINI_API_KEY_HERE)[^'"]+['"]/.test(fs.readFileSync(configPath, 'utf8'));
  if (configured) {
    console.warn('⚠️  config.js (with the API key) is included. Anyone with this zip can read the key;');
    console.warn('   a backend proxy is needed before publishing to the Chrome Web Store.');
    return;
  }
  if (!isCi) {
    throw new Error('config.js is missing or still has the placeholder key. Copy config.template.js to config.js and add your key.');
  }
  // CI has no key: package the template so the zip is structurally complete
  console.warn('CI build: using config.template.js as config.js (no API key).');
  return 'config.template.js';
}

async function main() {
  const { manifest, files } = collectFiles();
  const configSource = checkConfig(files);

  const missing = files.filter(f => !(f === 'config.js' && configSource) && !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) {
    throw new Error(`Referenced files are missing: ${missing.join(', ')}`);
  }

  const archiver = require('archiver');
  fs.mkdirSync(DIST, { recursive: true });
  const zipName = `dark-patterns-detector-v${manifest.version}.zip`;
  const zipPath = path.join(DIST, zipName);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);
  for (const file of files) {
    const source = file === 'config.js' && configSource ? configSource : file;
    archive.file(path.join(ROOT, source), { name: file });
  }
  await archive.finalize();
  await done;

  console.log(`Packaged ${files.length} files:`);
  files.forEach(f => console.log(`  ${f}`));
  console.log(`\n✅ ${path.relative(ROOT, zipPath)} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
}

module.exports = { collectFiles };

if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Build failed: ${error.message}`);
    process.exit(1);
  });
}
