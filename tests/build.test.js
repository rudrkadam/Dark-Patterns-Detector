const test = require('node:test');
const assert = require('node:assert/strict');
const { collectFiles } = require('../scripts/build');

test('the build packages every file the extension loads', () => {
  const { files } = collectFiles();
  for (const required of [
    'manifest.json', 'background.js', 'taxonomy.js', 'config.js',
    'popup.html', 'popup.js', 'popup.css', 'feedback-utils.js',
    'content.js', 'styles.css', 'icons/icon16.png', 'icons/icon32.png', 'icons/icon128.png'
  ]) {
    assert.ok(files.includes(required), `${required} is not packaged`);
  }
});

test('the build leaves out development files', () => {
  const { files } = collectFiles();
  for (const devFile of ['package.json', 'config.template.js', 'scripts/build.js', 'README.md']) {
    assert.ok(!files.includes(devFile), `${devFile} should not be packaged`);
  }
  assert.ok(!files.some(f => f.startsWith('research/') || f.startsWith('tests/')));
});
