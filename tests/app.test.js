'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, dateKeyOffset, fillAndSubmitEntry, storedEntries } = require('./helpers');

const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

function sampleEntry(window, overrides = {}) {
  return {
    id: 'e1', provider: 'OpenAI', model: 'gpt-4o', cost: 2, tokens: 100,
    date: dateKeyOffset(window, 0), note: '', ...overrides
  };
}

// ---------- navigation / event wiring (regression: CSP blocked inline handlers) ----------

test('Launch Dashboard button opens the dashboard without inline handlers', () => {
  const app = loadApp();
  const button = app.document.querySelector('.hero-actions [data-action="show-app"]');
  assert.ok(button);
  click(app.window, button);
  assert.equal(app.$('app').classList.contains('hidden'), false);
  assert.equal(app.$('hero').classList.contains('hidden'), true);
  assert.equal(app.window.location.hash, '#app');
});

test('brand link returns to the landing page, via mouse and keyboard', () => {
  const app = loadApp({ hash: '#app' });
  assert.equal(app.$('app').classList.contains('hidden'), false, 'deep link to #app should open the dashboard');
  const brand = app.document.querySelector('.app-brand');
  brand.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(app.$('app').classList.contains('hidden'), true);
  assert.equal(app.$('hero').classList.contains('hidden'), false);
});

test('mobile menu toggles open state and aria-expanded', () => {
  const app = loadApp();
  const button = app.document.querySelector('.mobile-menu-btn');
  click(app.window, button);
  assert.equal(app.$('navLinks').classList.contains('open'), true);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  click(app.window, button);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('theme toggle flips the theme and persists it', () => {
  const app = loadApp();
  click(app.window, app.document.querySelector('[data-action="toggle-theme"]'));
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(app.window.localStorage.getItem('costtracker_theme'), 'light');
});

test('budget alert can be dismissed', () => {
  const app = loadApp();
  app.$('budgetAlert').classList.remove('hidden');
  click(app.window, app.document.querySelector('[data-action="dismiss-alert"]'));
  assert.equal(app.$('budgetAlert').classList.contains('hidden'), true);
});

test('range chips update the range and aria-pressed', () => {
  const app = loadApp();
  click(app.window, app.document.querySelector('.hero-actions [data-action="show-app"]'));
  const chip30 = app.document.querySelector('.chip[data-range="30"]');
  click(app.window, chip30);
  assert.equal(app.run('currentRange'), 30);
  assert.equal(chip30.getAttribute('aria-pressed'), 'true');
  assert.equal(app.document.querySelector('.chip[data-range="7"]').getAttribute('aria-pressed'), 'false');
});

// ---------- adding / validating entries ----------

test('adds a valid entry, stores it and renders it', () => {
  const app = loadApp();
  fillAndSubmitEntry(app, { provider: 'Anthropic', model: 'claude-x', cost: '3.25', tokens: '1200', note: 'prod' });
  const stored = storedEntries(app.window);
  assert.equal(stored.length, 1);
  assert.deepEqual(
    { provider: stored[0].provider, model: stored[0].model, cost: stored[0].cost, tokens: stored[0].tokens, note: stored[0].note },
    { provider: 'Anthropic', model: 'claude-x', cost: 3.25, tokens: 1200, note: 'prod' });
  assert.equal(app.$('entriesBody').querySelectorAll('tr').length, 1);
  assert.match(app.$('totalSpent').textContent, /3\.25/);
});

test('rejects impossible calendar dates such as 2026-02-31', () => {
  const app = loadApp();
  fillAndSubmitEntry(app, { date: '2026-02-31' });
  assert.equal(storedEntries(app.window).length, 0);
  assert.match(app.document.querySelector('.toast').textContent, /valid date/i);
});

test('rejects negative cost, non-integer tokens and over-limit values', () => {
  const app = loadApp();
  fillAndSubmitEntry(app, { cost: '-1' });
  fillAndSubmitEntry(app, { tokens: '1.5' });
  fillAndSubmitEntry(app, { cost: '1000000001' });
  fillAndSubmitEntry(app, { model: '   ' });
  assert.equal(storedEntries(app.window).length, 0);
});

test('truncates over-long text fields to their limits', () => {
  const app = loadApp();
  fillAndSubmitEntry(app, { model: 'm'.repeat(500), note: 'n'.repeat(900) });
  const [entry] = storedEntries(app.window);
  assert.equal(entry.model.length, 128);
  assert.equal(entry.note.length, 500);
});

test('deleting an entry removes only that entry', () => {
  const app = loadApp({ storage: { costtracker_entries: [] } });
  fillAndSubmitEntry(app, { model: 'one' });
  fillAndSubmitEntry(app, { model: 'two' });
  const buttons = app.$('entriesBody').querySelectorAll('.delete-btn');
  assert.equal(buttons.length, 2);
  click(app.window, buttons[0]);
  const remaining = storedEntries(app.window);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].model, 'one');
});

// ---------- XSS ----------

test('user-controlled text is rendered as text, never as HTML', () => {
  const payload = '<img src=x onerror="window.__pwned=1">';
  const app = loadApp();
  fillAndSubmitEntry(app, { model: payload, note: payload });
  assert.equal(app.$('entriesBody').querySelector('img'), null);
  assert.equal(app.window.__pwned, undefined);
  assert.ok(app.$('entriesBody').textContent.includes(payload));
});

test('stored provider names cannot inject markup into the provider list or filter', () => {
  const app = loadApp({
    storage: { costtracker_entries: [{ id: 'x', provider: '<b id="owned">p</b>', model: 'm', cost: 1, tokens: null, date: '2026-01-02', note: '' }] }
  });
  click(app.window, app.document.querySelector('.hero-actions [data-action="show-app"]'));
  assert.equal(app.document.getElementById('owned'), null);
  assert.ok(app.$('providerList').textContent.includes('<b id="owned">p</b>'));
});

// ---------- CSV ----------

test('CSV neutralises spreadsheet formula injection and escapes quotes', () => {
  const app = loadApp();
  const csv = app.run(`buildCSV(${JSON.stringify([
    { date: '2026-01-02', provider: 'Other', model: '=HYPERLINK("http://evil","x")', cost: 1, tokens: null, note: '+cmd|calc' },
    { date: '2026-01-03', provider: 'Other', model: '@SUM(A1)', cost: 2.5, tokens: 5, note: 'say "hi", ok' }
  ])})`);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '"Date","Provider","Model","Cost","Tokens","Note"');
  assert.ok(lines[1].includes(`"'=HYPERLINK(""http://evil"",""x"")"`), lines[1]);
  assert.ok(lines[1].includes(`"'+cmd|calc"`));
  assert.ok(lines[2].includes(`"'@SUM(A1)"`));
  assert.ok(lines[2].includes('"say ""hi"", ok"'));
  assert.ok(lines[2].includes('"2.5000"'));
});

test('export with no data shows a message instead of downloading', () => {
  const app = loadApp();
  click(app.window, app.document.querySelector('[data-action="export-csv"]'));
  assert.match(app.document.querySelector('.toast').textContent, /No data/);
});

// ---------- storage safety ----------

test('corrupt JSON is backed up, not deleted', () => {
  const app = loadApp({ storage: { costtracker_entries: '{not json' } });
  assert.deepEqual(app.run('entries'), []);
  assert.equal(app.window.localStorage.getItem('costtracker_entries_backup'), '{not json');
});

test('invalid stored entries are dropped but a backup of the original is kept', () => {
  const good = { id: 'a', provider: 'OpenAI', model: 'm', cost: 1, tokens: null, date: '2026-01-02', note: '' };
  const bad = { id: 'b', provider: 'OpenAI', model: 'm', cost: -5, tokens: null, date: '2026-01-02', note: '' };
  const raw = JSON.stringify([good, bad, 'junk', null]);
  const app = loadApp({ storage: { costtracker_entries: raw } });
  assert.equal(app.run('entries.length'), 1);
  assert.equal(app.window.localStorage.getItem('costtracker_entries_backup'), raw);
});

test('duplicate stored ids are made unique', () => {
  const e = { provider: 'OpenAI', model: 'm', cost: 1, tokens: null, date: '2026-01-02', note: '' };
  const app = loadApp({ storage: { costtracker_entries: [{ ...e, id: 'dup' }, { ...e, id: 'dup' }] } });
  const ids = app.run('entries.map(e => e.id)');
  assert.equal(new Set(ids).size, 2);
});

test('valid stored data loads without creating a backup', () => {
  const app = loadApp({ storage: { costtracker_entries: [sampleEntry(loadApp().window)] } });
  assert.equal(app.run('entries.length'), 1);
  assert.equal(app.window.localStorage.getItem('costtracker_entries_backup'), null);
});

test('app keeps working when reading storage throws (privacy mode)', () => {
  const app = loadApp({
    beforeApp(window) {
      window.Storage.prototype.getItem = () => { throw new window.DOMException('denied', 'SecurityError'); };
    }
  });
  assert.deepEqual(app.run('entries'), []);
  fillAndSubmitEntry(app, { model: 'works-without-storage' });
  assert.equal(app.run('entries.length'), 1);
});

test('app warns when saving to storage fails (quota / privacy mode)', () => {
  const app = loadApp({
    beforeApp(window) {
      window.Storage.prototype.setItem = () => { throw new window.DOMException('full', 'QuotaExceededError'); };
    }
  });
  fillAndSubmitEntry(app, { model: 'kept-in-memory' });
  assert.equal(app.run('entries.length'), 1);
  assert.match(app.document.querySelector('.toast').textContent, /storage is unavailable or full/i);
});

test('Reset removes entries, budget and backup after confirmation', () => {
  const app = loadApp({
    storage: { costtracker_entries: '{bad', costtracker_budget: 50 },
    confirm: () => true
  });
  click(app.window, app.document.querySelector('[data-action="clear-data"]'));
  for (const key of ['costtracker_entries', 'costtracker_budget', 'costtracker_entries_backup']) {
    assert.equal(app.window.localStorage.getItem(key), null, key);
  }
});

test('Reset does nothing when the user cancels', () => {
  const app = loadApp({ confirm: () => false });
  fillAndSubmitEntry(app, {});
  click(app.window, app.document.querySelector('[data-action="clear-data"]'));
  assert.equal(storedEntries(app.window).length, 1);
});

// ---------- calculations ----------

test('isValidDateKey accepts real dates only', () => {
  const { run } = loadApp();
  const check = v => run(`isValidDateKey(${JSON.stringify(v)})`);
  assert.equal(check('2026-02-28'), true);
  assert.equal(check('2028-02-29'), true);
  assert.equal(check('2026-02-29'), false);
  assert.equal(check('2026-13-01'), false);
  assert.equal(check('2026-04-31'), false);
  assert.equal(check('26-01-01'), false);
  assert.equal(check(''), false);
  assert.equal(check(null), false);
});

test('month total counts only the current month (future months excluded)', () => {
  const app = loadApp();
  const now = app.run('new Date()');
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const key = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-05`;
  fillAndSubmitEntry(app, { cost: '10', date: dateKeyOffset(app.window, 0) });
  fillAndSubmitEntry(app, { cost: '99', date: key });
  assert.equal(app.run('getMonthTotal(new Date())'), 10);
});

test('weekly comparison uses two equal 7-day windows', () => {
  const app = loadApp();
  const day = n => dateKeyOffset(app.window, n);
  app.run(`entries = ${JSON.stringify([
    { id: '1', provider: 'OpenAI', model: 'm', cost: 10, tokens: null, date: day(0), note: '' },   // this week
    { id: '2', provider: 'OpenAI', model: 'm', cost: 10, tokens: null, date: day(6), note: '' },   // this week (edge)
    { id: '3', provider: 'OpenAI', model: 'm', cost: 5, tokens: null, date: day(7), note: '' },    // previous week (edge)
    { id: '4', provider: 'OpenAI', model: 'm', cost: 5, tokens: null, date: day(13), note: '' },   // previous week (edge)
    { id: '5', provider: 'OpenAI', model: 'm', cost: 100, tokens: null, date: day(14), note: '' }  // older, ignored
  ])}; updateSummary();`);
  assert.equal(app.$('totalChange').textContent, '+100% from last week');
});

test('budget alert appears at 80% and says exceeded at 100%', () => {
  const app = loadApp({ storage: { costtracker_budget: 100 } });
  fillAndSubmitEntry(app, { cost: '85' });
  assert.equal(app.$('budgetAlert').classList.contains('hidden'), false);
  assert.match(app.$('budgetAlertText').textContent, /85%/);
  fillAndSubmitEntry(app, { cost: '20' });
  assert.match(app.$('budgetAlertText').textContent, /Budget exceeded/);
});

test('budget form validates and saves the monthly limit', () => {
  const app = loadApp();
  app.$('budgetAmount').value = '0';
  app.$('budgetForm').dispatchEvent(new app.window.Event('submit', { cancelable: true, bubbles: true }));
  assert.equal(app.window.localStorage.getItem('costtracker_budget'), null);
  app.$('budgetAmount').value = '250';
  app.$('budgetForm').dispatchEvent(new app.window.Event('submit', { cancelable: true, bubbles: true }));
  assert.equal(app.window.localStorage.getItem('costtracker_budget'), '250');
});

test('provider filter limits the entries table', () => {
  const app = loadApp();
  fillAndSubmitEntry(app, { provider: 'OpenAI', model: 'a' });
  fillAndSubmitEntry(app, { provider: 'Mistral', model: 'b' });
  app.$('filterProvider').value = 'Mistral';
  app.$('filterProvider').dispatchEvent(new app.window.Event('change', { bubbles: true }));
  const rows = app.$('entriesBody').querySelectorAll('tr');
  assert.equal(rows.length, 1);
  assert.ok(rows[0].textContent.includes('Mistral'));
});

// ---------- charts ----------

test('shows a fallback message when the chart library is unavailable', () => {
  const app = loadApp();
  click(app.window, app.document.querySelector('.hero-actions [data-action="show-app"]'));
  assert.equal(app.$('spendingChartFallback').classList.contains('hidden'), false);
});

test('builds spending and provider charts when Chart is available', () => {
  const created = [];
  class FakeChart {
    constructor(ctx, config) { this.config = config; created.push(this); }
    destroy() { this.destroyed = true; }
  }
  const app = loadApp({ chart: FakeChart });
  // jsdom has no canvas implementation; provide a context stub.
  app.window.HTMLCanvasElement.prototype.getContext = () => ({});
  fillAndSubmitEntry(app, { provider: 'OpenAI', cost: '4' });
  click(app.window, app.document.querySelector('.hero-actions [data-action="show-app"]'));
  const spending = created.filter(c => c.config.type === 'bar').at(-1);
  const providers = created.filter(c => c.config.type === 'doughnut').at(-1);
  assert.ok(spending && providers);
  assert.equal(spending.config.data.labels.length, 7);
  assert.equal(Array.from(spending.config.data.datasets[0].data).at(-1), 4);
  assert.deepEqual(Array.from(providers.config.data.labels), ['OpenAI']);
  // Re-rendering destroys the previous chart instances.
  assert.ok(created.slice(0, -2).every(c => c.destroyed));
});
