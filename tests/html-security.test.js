'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { HTML, ROOT } = require('./helpers');

const doc = new JSDOM(HTML).window.document;

test('CSP meta tag is present and forbids unsafe-inline / unsafe-eval', () => {
  const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content');
  assert.ok(csp, 'CSP meta tag missing');
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /script-src 'self'(;|$)/, 'scripts must be limited to same-origin files');
  assert.match(csp, /object-src 'none'/);
});

test('no inline event handler attributes (blocked by the CSP)', () => {
  const offenders = [...doc.querySelectorAll('*')].flatMap(el =>
    el.getAttributeNames().filter(name => /^on/i.test(name)).map(name => `${el.tagName}[${name}]`));
  assert.deepEqual(offenders, []);
});

test('no inline style attributes (blocked by the CSP)', () => {
  assert.equal(doc.querySelectorAll('[style]').length, 0);
});

test('no inline <script> or <style> blocks', () => {
  assert.equal([...doc.querySelectorAll('script:not([src])')].length, 0);
  assert.equal(doc.querySelectorAll('style').length, 0);
});

test('every script is a same-origin file that exists in the repository', () => {
  const sources = [...doc.querySelectorAll('script[src]')].map(el => el.getAttribute('src'));
  assert.ok(sources.length >= 2);
  for (const src of sources) {
    assert.doesNotMatch(src, /^(https?:)?\/\//, `${src} must not be third-party`);
    assert.ok(fs.existsSync(path.join(ROOT, src)), `${src} is missing`);
  }
});

test('links opened in a new tab use noopener noreferrer', () => {
  for (const a of doc.querySelectorAll('a[target="_blank"]')) {
    const rel = (a.getAttribute('rel') || '').split(/\s+/);
    assert.ok(rel.includes('noopener') && rel.includes('noreferrer'), a.outerHTML);
  }
});

test('ids are unique', () => {
  const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every label is bound to an existing form control', () => {
  for (const label of doc.querySelectorAll('label')) {
    const target = label.getAttribute('for');
    assert.ok(target, `label "${label.textContent}" has no "for"`);
    assert.ok(doc.getElementById(target), `label "${label.textContent}" points to missing #${target}`);
  }
});

test('icon-only buttons have accessible names and every button has an explicit type', () => {
  for (const button of doc.querySelectorAll('button')) {
    assert.ok(button.getAttribute('type'), `button without type: ${button.outerHTML.slice(0, 80)}`);
    const name = button.textContent.trim() || button.getAttribute('aria-label');
    assert.ok(name, `button without accessible name: ${button.outerHTML.slice(0, 80)}`);
  }
});

test('page has language, title and description for SEO', () => {
  assert.ok(doc.documentElement.getAttribute('lang'));
  assert.ok(doc.title.length > 10);
  assert.ok(doc.querySelector('meta[name="description"]')?.getAttribute('content').length > 40);
});

test('.env files are ignored and the template holds no secrets', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^node_modules\/$/m);
  const template = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.doesNotMatch(template, /^[A-Z_]+=\S+/m, '.env.example must not contain assigned values');
});

test('every chart canvas sits in a fixed-height .chart-box (prevents endless Chart.js growth)', () => {
  const canvases = doc.querySelectorAll('canvas');
  assert.ok(canvases.length >= 2);
  for (const canvas of canvases) {
    assert.ok(canvas.parentElement.classList.contains('chart-box'), `#${canvas.id} is not wrapped in .chart-box`);
  }
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.match(css, /\.chart-box\s*\{[^}]*position:\s*relative;[^}]*height:\s*\d+px/);
});
