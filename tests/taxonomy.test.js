// Keeps the extension's taxonomy.js in sync with the research results
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadBackground } = require('./helpers');

const bg = loadBackground();

function readCsv(file) {
  const [header, ...lines] = fs.readFileSync(path.join(ROOT, file), 'utf8').trim().split(/\r?\n/);
  const columns = header.split(',');
  // ranking.csv has no quoted commas
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [columns[i], v])));
}

const TIER_FROM_RESEARCH = {
  'Core': 'core',
  'Core (weight-sensitive)': 'core',
  'Extended': 'extended',
  'Out of scope (not observable on one page)': 'out_of_scope'
};

test('taxonomy.js has exactly the types ranked in research/taxonomy', () => {
  const ranked = readCsv('research/taxonomy/results/ranking.csv').map(r => r.type).sort();
  assert.deepEqual([...bg.DARK_PATTERN_TYPE_NAMES].sort(), ranked);
});

test('taxonomy.js tiers match the research tiers', () => {
  for (const row of readCsv('research/taxonomy/results/ranking.csv')) {
    const expected = TIER_FROM_RESEARCH[row.tier];
    assert.ok(expected, `unknown research tier "${row.tier}"`);
    assert.equal(bg.getPatternTypeInfo(row.type).tier, expected, `tier mismatch for ${row.type}`);
  }
});

test('docs/DARK_PATTERNS.md describes every type the extension detects', () => {
  const docs = fs.readFileSync(path.join(ROOT, 'docs/DARK_PATTERNS.md'), 'utf8');
  for (const name of bg.DARK_PATTERN_TYPE_NAMES) {
    assert.ok(docs.includes(`**${name}**`), `docs/DARK_PATTERNS.md is missing ${name}`);
  }
});

test('every type has a definition', () => {
  for (const type of bg.DARK_PATTERN_TYPES) {
    assert.ok(type.definition.length > 20, `${type.name} needs a definition`);
  }
});
