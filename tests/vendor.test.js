'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const EXPECTED_SHA256 = '48444a82d4edcb5bec0f1965faacdde18d9c17db3063d042abada2f705c9f54a';

test('vendored Chart.js 4.5.1 matches the pinned checksum (tamper check)', () => {
  const file = path.join(ROOT, 'vendor', 'chart.umd.min.js');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash, EXPECTED_SHA256, 'vendor/chart.umd.min.js changed; update vendor/README.md and this checksum deliberately');
});

test('vendored Chart.js ships with its license', () => {
  const license = fs.readFileSync(path.join(ROOT, 'vendor', 'chartjs-LICENSE.md'), 'utf8');
  assert.match(license, /MIT License/i);
});
