// Loads extension scripts into an isolated context with a stubbed chrome API,
// the same way Chrome loads them (shared global scope, importScripts).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadBackground({ fetch: fetchStub } = {}) {
  const context = vm.createContext({
    chrome: {
      runtime: { getURL: p => 'ext://' + p, onMessage: { addListener() {} } },
      storage: { local: { get() {}, set() {} } }
    },
    // config.js isn't in the repo; serve a test key for it
    fetch: async (url, options) => {
      if (String(url).startsWith('ext://')) {
        return { text: async () => "const CONFIG = { GEMINI_API_KEY: 'test-key' };" };
      }
      if (!fetchStub) throw new Error('Unexpected network call in test');
      return fetchStub(url, options);
    },
    console: { log() {}, warn() {}, error() {} },
    AbortSignal,
    setTimeout
  });
  context.importScripts = (...files) => {
    files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context));
  };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), context, { filename: 'background.js' });
  // Top-level const/let (e.g. GEMINI_MODELS, CONFIG) aren't properties of the
  // context object, so look every name up inside the script's scope instead
  return new Proxy({}, { get: (_, name) => vm.runInContext(String(name), context) });
}

// JSON round-trip so objects created inside the vm compare cleanly with deepStrictEqual
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { ROOT, loadBackground, plain };
