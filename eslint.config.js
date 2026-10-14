const js = require('@eslint/js');
const globals = require('globals');

// Globals shared between extension scripts that are loaded side by side
// (taxonomy.js via importScripts, feedback-utils.js via a popup <script> tag)
const taxonomyGlobals = {
  DARK_PATTERN_TYPES: 'readonly',
  DARK_PATTERN_TYPE_NAMES: 'readonly',
  TIER_ORDER: 'readonly',
  getPatternTypeInfo: 'readonly'
};
const feedbackGlobals = {
  storeFeedbackForPattern: 'readonly',
  storeHelpfulnessFeedback: 'readonly',
  exportFeedbackToJson: 'readonly',
  exportFeedbackToCsv: 'readonly'
};

module.exports = [
  { ignores: ['node_modules/', 'dist/', 'config.js'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script' }
  },
  {
    files: ['background.js'],
    languageOptions: { globals: { ...globals.serviceworker, AbortSignal: 'readonly', chrome: 'readonly', ...taxonomyGlobals } }
  },
  {
    files: ['taxonomy.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
    // Defined here, used by background.js
    rules: { 'no-unused-vars': 'off' }
  },
  {
    files: ['popup.js'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly', ...feedbackGlobals } }
  },
  {
    files: ['feedback-utils.js'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } },
    // Defined here, used by popup.js
    rules: { 'no-unused-vars': 'off' }
  },
  {
    files: ['content.js'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } }
  },
  {
    files: ['config.template.js'],
    languageOptions: { globals: { ...globals.browser, module: 'writable' } },
    rules: { 'no-unused-vars': 'off' }
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'version-bump.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } }
  }
];
