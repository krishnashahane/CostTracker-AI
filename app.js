// =================== STATE ===================
const STORAGE_KEY = 'costtracker_entries';
const BUDGET_KEY = 'costtracker_budget';
const THEME_KEY = 'costtracker_theme';
const MAX_ENTRIES = 5000;
const MAX_PROVIDER_LENGTH = 64;
const MAX_MODEL_LENGTH = 128;
const MAX_NOTE_LENGTH = 500;
const MAX_COST = 1_000_000_000;
const MAX_TOKENS = 1_000_000_000_000;

const PROVIDER_COLORS = {
  'OpenAI': '#10a37f',
  'Anthropic': '#cc7832',
  'Google AI': '#4285f4',
  'Mistral': '#ff7a00',
  'Cohere': '#395bdb',
  'AWS Bedrock': '#ff9900',
  'Azure OpenAI': '#0078d4',
  'Other': '#6366f1'
};

let entries = loadEntries();
let budget = loadBudget();
let spendingChart = null;
let providerChart = null;
let currentRange = 7;

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = safeGetStorage(THEME_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  const dateInput = document.getElementById('entryDate');
  if (dateInput) dateInput.valueAsDate = new Date();

  if (window.location.hash === '#app') showApp();
});

// =================== NAVIGATION ===================
function showApp() {
  document.getElementById('hero').classList.add('hidden');
  document.querySelector('.features')?.classList.add('hidden');
  document.querySelector('.pricing')?.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  window.location.hash = 'app';
  initDashboard();
}

function showLanding() {
  document.getElementById('hero').classList.remove('hidden');
  document.querySelector('.features')?.classList.remove('hidden');
  document.querySelector('.pricing')?.classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  window.location.hash = '';
}

function toggleMobileMenu() {
  document.querySelector('.nav-links')?.classList.toggle('open');
}

// =================== THEME ===================
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  safeSetStorage(THEME_KEY, next);
  if (document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) {
    updateCharts();
  }
}

// =================== DASHBOARD ===================
function initDashboard() {
  updateSummary();
  updateProviders();
  renderEntries();
  updateBudgetDisplay();
  updateQuickStats();
  initCharts();
  updateFilterOptions();
}

function updateSummary() {
  const now = new Date();
  const today = localDateKey(now);
  const monthStart = localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const weekAgo = localDateKey(new Date(now.getTime() - 7 * 86400000));
  const twoWeeksAgo = localDateKey(new Date(now.getTime() - 14 * 86400000));

  const total = sum(entries, e => e.cost);
  const todayEntries = entries.filter(e => e.date === today);
  const todayTotal = sum(todayEntries, e => e.cost);
  const monthTotal = sum(entries.filter(e => e.date >= monthStart), e => e.cost);
  const weekTotal = sum(entries.filter(e => e.date >= weekAgo), e => e.cost);
  const prevWeekTotal = sum(entries.filter(e => e.date >= twoWeeksAgo && e.date < weekAgo), e => e.cost);
  const providers = new Set(entries.map(e => e.provider));

  setText('totalSpent', formatCurrency(total));
  setText('todaySpent', formatCurrency(todayTotal));
  setText('todayCalls', `${todayEntries.length} API call${todayEntries.length !== 1 ? 's' : ''}`);
  setText('monthSpent', formatCurrency(monthTotal));
  setText('providerCount', String(providers.size));

  const change = prevWeekTotal > 0 ? ((weekTotal - prevWeekTotal) / prevWeekTotal * 100) : 0;
  const changeEl = document.getElementById('totalChange');
  if (changeEl) {
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(0)}% from last week`;
    changeEl.className = `sc-change ${change >= 0 ? 'negative' : 'positive'}`;
  }

  const budgetLabel = document.getElementById('monthBudget');
  const alert = document.getElementById('budgetAlert');
  const alertText = document.getElementById('budgetAlertText');

  if (budget > 0) {
    const pct = monthTotal / budget * 100;
    if (budgetLabel) budgetLabel.textContent = `${Math.round(pct)}% of ${formatCurrency(budget)} budget`;
    if (pct >= 80) {
      alert?.classList.remove('hidden');
      if (alertText) {
        alertText.textContent = pct >= 100
          ? `Budget exceeded! You've spent ${formatCurrency(monthTotal)} of your ${formatCurrency(budget)} monthly budget.`
          : `Warning: You've used ${Math.round(pct)}% of your ${formatCurrency(budget)} monthly budget.`;
      }
    } else {
      alert?.classList.add('hidden');
    }
  } else {
    if (budgetLabel) budgetLabel.textContent = 'No budget set';
    alert?.classList.add('hidden');
  }
}

function updateProviders() {
  const list = document.getElementById('providerList');
  const chart = document.getElementById('providerChart');
  if (!list || !chart) return;

  const providerMap = new Map();
  for (const entry of entries) {
    const current = providerMap.get(entry.provider) || { total: 0, count: 0 };
    current.total += entry.cost;
    current.count += 1;
    providerMap.set(entry.provider, current);
  }

  if (providerMap.size === 0) {
    list.replaceChildren(createEmptyState('No data yet. Add your first entry below.'));
    chart.classList.add('hidden');
    return;
  }

  chart.classList.remove('hidden');
  const total = sum(entries, e => e.cost);
  const sorted = [...providerMap.entries()].sort((a, b) => b[1].total - a[1].total);
  list.replaceChildren();

  for (const [name, data] of sorted) {
    const color = PROVIDER_COLORS[name] || PROVIDER_COLORS.Other;
    const pct = total > 0 ? (data.total / total * 100).toFixed(1) : '0.0';

    const item = document.createElement('div');
    item.className = 'provider-item';

    const dot = document.createElement('div');
    dot.className = 'provider-color';
    dot.style.background = color;

    const info = document.createElement('div');
    info.className = 'provider-info';

    const providerName = document.createElement('div');
    providerName.className = 'provider-name';
    providerName.textContent = name;

    const calls = document.createElement('div');
    calls.className = 'provider-calls';
    calls.textContent = `${data.count} call${data.count !== 1 ? 's' : ''}`;

    const amounts = document.createElement('div');
    const amount = document.createElement('div');
    amount.className = 'provider-amount';
    amount.textContent = formatCurrency(data.total);

    const percentage = document.createElement('div');
    percentage.className = 'provider-pct';
    percentage.textContent = `${pct}%`;

    info.append(providerName, calls);
    amounts.append(amount, percentage);
    item.append(dot, info, amounts);
    list.appendChild(item);
  }
}

// =================== CHARTS ===================
function initCharts() {
  const canvas1 = document.getElementById('spendingChart');
  const canvas2 = document.getElementById('providerChart');
  if (!canvas1 || !canvas2) return;

  if (typeof window.Chart !== 'function') {
    const fallback = document.getElementById('spendingChartFallback');
    fallback?.classList.remove('hidden');
    return;
  }

  document.getElementById('spendingChartFallback')?.classList.add('hidden');

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  if (spendingChart) spendingChart.destroy();
  if (providerChart) providerChart.destroy();

  const { labels, data } = getSpendingData(currentRange);
  spendingChart = new Chart(canvas1.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map((_, i) => i === data.length - 1 ? '#6366f1' : 'rgba(99,102,241,0.3)'),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(Number(ctx.raw) || 0) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: value => '$' + Number(value).toFixed(2) }
        }
      }
    }
  });

  const providerData = getProviderData();
  if (providerData.labels.length === 0) return;

  providerChart = new Chart(canvas2.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: providerData.labels,
      datasets: [{
        data: providerData.data,
        backgroundColor: providerData.colors,
        borderWidth: 0,
        spacing: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: textColor, padding: 12, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(Number(ctx.raw) || 0)}` } }
      }
    }
  });
}

function updateCharts() {
  initCharts();
}

function getSpendingData(days) {
  const labels = [];
  const data = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = localDateKey(d);
    const dayTotal = sum(entries.filter(e => e.date === dateKey), e => e.cost);
    labels.push(days <= 7
      ? d.toLocaleDateString(undefined, { weekday: 'short' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    data.push(dayTotal);
  }

  return { labels, data };
}

function getProviderData() {
  const providerMap = new Map();
  for (const entry of entries) {
    providerMap.set(entry.provider, (providerMap.get(entry.provider) || 0) + entry.cost);
  }
  const sorted = [...providerMap.entries()].sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([name]) => name),
    data: sorted.map(([, cost]) => cost),
    colors: sorted.map(([name]) => PROVIDER_COLORS[name] || PROVIDER_COLORS.Other)
  };
}

function setRange(days, btn) {
  currentRange = [7, 30, 90].includes(days) ? days : 7;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateCharts();
}

// =================== ENTRIES ===================
function addEntry(event) {
  event.preventDefault();

  const provider = normalizeString(document.getElementById('provider')?.value, MAX_PROVIDER_LENGTH);
  const model = normalizeString(document.getElementById('model')?.value, MAX_MODEL_LENGTH);
  const cost = Number(document.getElementById('cost')?.value);
  const tokenValue = document.getElementById('tokens')?.value;
  const tokens = tokenValue === '' ? null : Number(tokenValue);
  const date = document.getElementById('entryDate')?.value;
  const note = normalizeString(document.getElementById('note')?.value, MAX_NOTE_LENGTH);

  if (!provider || !model || !Number.isFinite(cost) || cost < 0 || cost > MAX_COST) {
    showToast('Enter a valid provider, model, and non-negative cost.');
    return;
  }

  if (tokens !== null && (!Number.isInteger(tokens) || tokens < 0 || tokens > MAX_TOKENS)) {
    showToast('Enter a valid non-negative token count.');
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    showToast('Choose a valid date.');
    return;
  }

  entries.unshift({
    id: makeId(),
    provider,
    model,
    cost: roundMoney(cost),
    tokens,
    date,
    note
  });

  entries = entries.slice(0, MAX_ENTRIES);
  saveEntries();
  document.getElementById('addForm')?.reset();
  document.getElementById('entryDate').valueAsDate = new Date();
  initDashboard();
  showToast('Entry added successfully');
}

function deleteEntry(id) {
  entries = entries.filter(entry => entry.id !== id);
  saveEntries();
  initDashboard();
  showToast('Entry deleted');
}

function renderEntries() {
  const tbody = document.getElementById('entriesBody');
  const filter = document.getElementById('filterProvider')?.value || '';
  if (!tbody) return;

  const filtered = filter ? entries.filter(e => e.provider === filter) : entries;
  tbody.replaceChildren();

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    row.className = 'empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'No entries yet. Start tracking your AI costs above.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  for (const entry of filtered.slice(0, 50)) {
    const row = document.createElement('tr');
    row.append(
      textCell(formatDate(entry.date)),
      providerCell(entry.provider),
      textCell(entry.model),
      strongCell(formatCurrency(entry.cost)),
      textCell(entry.tokens === null ? '-' : entry.tokens.toLocaleString()),
      mutedCell(entry.note || '-')
    );

    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.type = 'button';
    deleteButton.title = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${entry.model} entry`);
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteEntry(entry.id));
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  }
}

function updateFilterOptions() {
  const select = document.getElementById('filterProvider');
  if (!select) return;

  const current = select.value;
  select.replaceChildren(new Option('All Providers', ''));
  for (const provider of [...new Set(entries.map(e => e.provider))].sort()) {
    select.add(new Option(provider, provider));
  }
  if ([...select.options].some(option => option.value === current)) {
    select.value = current;
  }
}

function filterEntries() {
  renderEntries();
}

// =================== BUDGET ===================
function setBudget(event) {
  event.preventDefault();
  const amount = Number(document.getElementById('budgetAmount')?.value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_COST) {
    showToast('Enter a valid monthly budget.');
    return;
  }

  budget = roundMoney(amount);
  if (!safeSetStorage(BUDGET_KEY, JSON.stringify(budget))) {
    showToast('Browser storage is unavailable; the budget may not persist.');
  }
  document.getElementById('budgetAmount').value = '';
  updateBudgetDisplay();
  updateSummary();
  showToast(`Monthly budget set to ${formatCurrency(budget)}`);
}

function updateBudgetDisplay() {
  const display = document.getElementById('budgetDisplay');
  if (!display) return;

  display.replaceChildren();
  if (!budget) return;

  const monthStart = localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthTotal = sum(entries.filter(e => e.date >= monthStart), e => e.cost);
  const pct = budget > 0 ? Math.min(monthTotal / budget * 100, 100) : 0;
  const barClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';

  const wrap = document.createElement('div');
  wrap.className = 'budget-bar-wrap';
  const bar = document.createElement('div');
  bar.className = `budget-bar ${barClass}`.trim();
  bar.style.width = `${pct}%`;
  wrap.appendChild(bar);

  const info = document.createElement('div');
  info.className = 'budget-info';
  const spent = document.createElement('span');
  spent.textContent = `${formatCurrency(monthTotal)} spent`;
  const remaining = document.createElement('span');
  remaining.textContent = `${formatCurrency(Math.max(budget - monthTotal, 0))} remaining`;
  info.append(spent, remaining);

  display.append(wrap, info);
}

// =================== QUICK STATS ===================
function updateQuickStats() {
  const container = document.getElementById('quickStats');
  if (!container) return;
  container.replaceChildren();

  if (entries.length === 0) {
    container.appendChild(createEmptyState('Add entries to see stats.'));
    return;
  }

  const total = sum(entries, e => e.cost);
  const avgCost = total / entries.length;
  const maxEntry = entries.reduce((max, e) => e.cost > max.cost ? e : max, entries[0]);
  const totalTokens = entries.reduce((totalTokens, e) => totalTokens + (e.tokens || 0), 0);
  const avgDaily = getAvgDailyCost();

  const rows = [
    ['Avg per call', formatCurrency(avgCost)],
    ['Avg per day', formatCurrency(avgDaily)],
    ['Most expensive', formatCurrency(maxEntry.cost)],
    ['Total tokens', totalTokens.toLocaleString()],
    ['Total entries', entries.length.toLocaleString()]
  ];

  for (const [label, value] of rows) {
    const item = document.createElement('div');
    item.className = 'qs-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'qs-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'qs-value';
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    container.appendChild(item);
  }
}

function getAvgDailyCost() {
  if (entries.length === 0) return 0;
  const dates = new Set(entries.map(e => e.date));
  return sum(entries, e => e.cost) / dates.size;
}

// =================== EXPORT ===================
function exportCSV() {
  if (entries.length === 0) {
    showToast('No data to export');
    return;
  }

  const headers = ['Date', 'Provider', 'Model', 'Cost', 'Tokens', 'Note'];
  const rows = entries.map(e => [
    csvCell(e.date),
    csvCell(e.provider),
    csvCell(e.model),
    csvCell(e.cost.toFixed(4)),
    csvCell(e.tokens === null ? '' : String(e.tokens)),
    csvCell(e.note)
  ]);

  const csv = [headers.map(csvCell).join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `costtracker-ai-${localDateKey(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('CSV exported successfully');
}

// =================== CLEAR DATA ===================
function clearAllData() {
  if (!window.confirm('Are you sure you want to delete all tracked data and the monthly budget? This cannot be undone.')) {
    return;
  }
  entries = [];
  budget = null;
  safeRemoveStorage(STORAGE_KEY);
  safeRemoveStorage(BUDGET_KEY);
  initDashboard();
  showToast('All data cleared');
}

// =================== STORAGE ===================
function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const valid = raw.map(normalizeStoredEntry).filter(Boolean);
    return valid.slice(0, MAX_ENTRIES);
  } catch {
    safeRemoveStorage(STORAGE_KEY);
    return [];
  }
}

function loadBudget() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null');
    return Number.isFinite(raw) && raw > 0 && raw <= MAX_COST ? roundMoney(raw) : null;
  } catch {
    safeRemoveStorage(BUDGET_KEY);
    return null;
  }
}

function normalizeStoredEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const provider = normalizeString(entry.provider, MAX_PROVIDER_LENGTH);
  const model = normalizeString(entry.model, MAX_MODEL_LENGTH);
  const note = normalizeString(entry.note, MAX_NOTE_LENGTH);
  const cost = Number(entry.cost);
  const tokens = entry.tokens === null || entry.tokens === '' || typeof entry.tokens === 'undefined'
    ? null
    : Number(entry.tokens);
  const date = typeof entry.date === 'string' ? entry.date : '';

  if (!provider || !model || !Number.isFinite(cost) || cost < 0 || cost > MAX_COST) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (tokens !== null && (!Number.isInteger(tokens) || tokens < 0 || tokens > MAX_TOKENS)) return null;

  return {
    id: typeof entry.id === 'string' || typeof entry.id === 'number' ? entry.id : makeId(),
    provider,
    model,
    cost: roundMoney(cost),
    tokens,
    date,
    note
  };
}

function saveEntries() {
  try {
    if (!safeSetStorage(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))) {
      showToast('Browser storage is unavailable. Export your data before leaving the page.');
    }
  } catch {
    showToast('Storage is full. Export your data and remove older entries.');
  }
}

// =================== HELPERS ===================
function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be disabled by browser policy.
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function createEmptyState(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  const p = document.createElement('p');
  p.textContent = message;
  wrapper.appendChild(p);
  return wrapper;
}

function textCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  return cell;
}

function strongCell(value) {
  const cell = document.createElement('td');
  const strong = document.createElement('strong');
  strong.textContent = value;
  cell.appendChild(strong);
  return cell;
}

function mutedCell(value) {
  const cell = textCell(value);
  cell.style.color = 'var(--text-muted)';
  return cell;
}

function providerCell(provider) {
  const cell = document.createElement('td');
  const tag = document.createElement('span');
  tag.className = `provider-tag ${providerClass(provider)}`;
  tag.textContent = provider;
  cell.appendChild(tag);
  return cell;
}

function providerClass(provider) {
  const normalized = provider.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'openai') return 'pt-openai';
  if (normalized === 'anthropic') return 'pt-anthropic';
  if (normalized === 'googleai') return 'pt-google';
  if (normalized === 'mistral') return 'pt-mistral';
  if (normalized === 'cohere') return 'pt-cohere';
  if (normalized === 'awsbedrock') return 'pt-aws';
  if (normalized === 'azureopenai') return 'pt-azure';
  return 'pt-other';
}

function csvCell(value) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function normalizeString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function roundMoney(value) {
  return Math.round(value * 10000) / 10000;
}

function sum(items, mapper) {
  return items.reduce((total, item) => total + mapper(item), 0);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}
