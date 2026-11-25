'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/**
 * Loads index.html + app.js in jsdom. Inline scripts are not executed
 * (matching the page's CSP), app.js is evaluated explicitly.
 */
function loadApp({ storage = {}, chart, hash = '', confirm = () => true, beforeApp } = {}) {
  const dom = new JSDOM(HTML, {
    url: `http://localhost/${hash}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      window.confirm = confirm;
      if (chart) window.Chart = chart;
      if (beforeApp) beforeApp(window);
    }
  });
  const { window } = dom;
  // Run as a classic script so top-level let/const bindings stay reachable, like in a browser.
  const context = dom.getInternalVMContext();
  new vm.Script(APP_JS, { filename: 'app.js' }).runInContext(context);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const $ = id => window.document.getElementById(id);
  // Results are JSON round-tripped so values created inside the VM realm compare cleanly.
  const run = code => {
    const value = new vm.Script(code).runInContext(context);
    return value !== null && typeof value === 'object' && !(value instanceof window.Date)
      ? JSON.parse(JSON.stringify(value))
      : value;
  };
  return { dom, window, document: window.document, $, run };
}

function dateKeyOffset(window, days) {
  return window.dateKeyDaysAgo(new window.Date(), Number(days));
}

function fillAndSubmitEntry(app, values) {
  const { $, window } = app;
  $('provider').value = values.provider ?? 'OpenAI';
  $('model').value = values.model ?? 'gpt-4o';
  $('cost').value = values.cost ?? '1.5';
  $('tokens').value = values.tokens ?? '';
  $('entryDate').value = values.date ?? dateKeyOffset(window, 0);
  $('note').value = values.note ?? '';
  $('addForm').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
}

function storedEntries(window) {
  return JSON.parse(window.localStorage.getItem('costtracker_entries') || '[]');
}

module.exports = { ROOT, HTML, APP_JS, loadApp, dateKeyOffset, fillAndSubmitEntry, storedEntries };
