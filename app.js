// =================== STATE ===================
const STORAGE_KEY = 'costtracker_entries';
const BUDGET_KEY = 'costtracker_budget';
const THEME_KEY = 'costtracker_theme';

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

let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let budget = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null');
let spendingChart = null;
let providerChart = null;
let currentRange = 7;

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('entryDate').valueAsDate = new Date();

  // Check if URL has #app hash
  if (window.location.hash === '#app') {
    showApp();
  }
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
  document.querySelector('.nav-links').classList.toggle('open');
}

// =================== THEME ===================
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  if (spendingChart) updateCharts();
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
  const today = now.toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const weekAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
  const twoWeeksAgo = new Date(now - 14 * 86400000).toISOString().split('T')[0];

  const total = entries.reduce((s, e) => s + e.cost, 0);
  const todayEntries = entries.filter(e => e.date === today);
  const todayTotal = todayEntries.reduce((s, e) => s + e.cost, 0);
  const monthTotal = entries.filter(e => e.date >= monthStart).reduce((s, e) => s + e.cost, 0);
  const weekTotal = entries.filter(e => e.date >= weekAgo).reduce((s, e) => s + e.cost, 0);
  const prevWeekTotal = entries.filter(e => e.date >= twoWeeksAgo && e.date < weekAgo).reduce((s, e) => s + e.cost, 0);

  const providers = new Set(entries.map(e => e.provider));

  document.getElementById('totalSpent').textContent = formatCurrency(total);
  document.getElementById('todaySpent').textContent = formatCurrency(todayTotal);
  document.getElementById('todayCalls').textContent = `${todayEntries.length} API call${todayEntries.length !== 1 ? 's' : ''}`;
  document.getElementById('monthSpent').textContent = formatCurrency(monthTotal);
  document.getElementById('providerCount').textContent = providers.size;

  const change = prevWeekTotal > 0 ? ((weekTotal - prevWeekTotal) / prevWeekTotal * 100).toFixed(0) : 0;
  const changeEl = document.getElementById('totalChange');
  changeEl.textContent = `${change >= 0 ? '+' : ''}${change}% from last week`;
  changeEl.className = `sc-change ${change >= 0 ? 'negative' : 'positive'}`;

  if (budget) {
    const pct = (monthTotal / budget * 100).toFixed(0);
    document.getElementById('monthBudget').textContent = `${pct}% of $${budget} budget`;

    if (pct >= 80) {
      const alert = document.getElementById('budgetAlert');
      alert.classList.remove('hidden');
      document.getElementById('budgetAlertText').textContent =
        pct >= 100
          ? `Budget exceeded! You've spent ${formatCurrency(monthTotal)} of your ${formatCurrency(budget)} monthly budget.`
          : `Warning: You've used ${pct}% of your ${formatCurrency(budget)} monthly budget.`;
    }
  } else {
    document.getElementById('monthBudget').textContent = 'No budget set';
  }
}

function updateProviders() {
  const providerMap = {};
  entries.forEach(e => {
    if (!providerMap[e.provider]) providerMap[e.provider] = { total: 0, count: 0 };
    providerMap[e.provider].total += e.cost;
    providerMap[e.provider].count++;
  });

  const list = document.getElementById('providerList');
  const total = entries.reduce((s, e) => s + e.cost, 0);

  if (Object.keys(providerMap).length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No data yet. Add your first entry below.</p></div>';
    document.getElementById('providerChart').classList.add('hidden');
    return;
  }

  document.getElementById('providerChart').classList.remove('hidden');

  const sorted = Object.entries(providerMap).sort((a, b) => b[1].total - a[1].total);
  list.innerHTML = sorted.map(([name, data]) => {
    const pct = total > 0 ? (data.total / total * 100).toFixed(1) : 0;
    const color = PROVIDER_COLORS[name] || PROVIDER_COLORS['Other'];
    return `
      <div class="provider-item">
        <div class="provider-color" style="background:${color}"></div>
        <div class="provider-info">
          <div class="provider-name">${name}</div>
          <div class="provider-calls">${data.count} call${data.count !== 1 ? 's' : ''}</div>
        </div>
        <div>
          <div class="provider-amount">${formatCurrency(data.total)}</div>
          <div class="provider-pct">${pct}%</div>
        </div>
      </div>`;
  }).join('');
}

// =================== CHARTS ===================
function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  // Spending chart
  const ctx1 = document.getElementById('spendingChart').getContext('2d');
  if (spendingChart) spendingChart.destroy();

  const { labels, data } = getSpendingData(currentRange);

  spendingChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map((_, i) => i === data.length - 1 ? '#6366f1' : 'rgba(99,102,241,0.3)'),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: v => '$' + v.toFixed(2)
          }
        }
      },
      plugins: {
        ...commonOptions.plugins,
        tooltip: {
          callbacks: { label: ctx => formatCurrency(ctx.raw) }
        }
      }
    }
  });

  // Provider donut
  const ctx2 = document.getElementById('providerChart').getContext('2d');
  if (providerChart) providerChart.destroy();

  const providerData = getProviderData();
  if (providerData.labels.length === 0) return;

  providerChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: providerData.labels,
      datasets: [{
        data: providerData.data,
        backgroundColor: providerData.colors,
        borderWidth: 0,
        spacing: 2,
      }]
    },
    options: {
      ...commonOptions,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: textColor, padding: 12, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` }
        }
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
    const dateStr = d.toISOString().split('T')[0];
    const dayTotal = entries.filter(e => e.date === dateStr).reduce((s, e) => s + e.cost, 0);

    if (days <= 7) {
      labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
    } else if (days <= 30) {
      labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
    } else {
      labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
    }
    data.push(dayTotal);
  }

  return { labels, data };
}

function getProviderData() {
  const providerMap = {};
  entries.forEach(e => {
    providerMap[e.provider] = (providerMap[e.provider] || 0) + e.cost;
  });

  const sorted = Object.entries(providerMap).sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([name]) => name),
    data: sorted.map(([, cost]) => cost),
    colors: sorted.map(([name]) => PROVIDER_COLORS[name] || PROVIDER_COLORS['Other'])
  };
}

function setRange(days, btn) {
  currentRange = days;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  updateCharts();
}

// =================== ENTRIES ===================
function addEntry(e) {
  e.preventDefault();

  const entry = {
    id: Date.now(),
    provider: document.getElementById('provider').value,
    model: document.getElementById('model').value,
    cost: parseFloat(document.getElementById('cost').value),
    tokens: parseInt(document.getElementById('tokens').value) || null,
    date: document.getElementById('entryDate').value,
    note: document.getElementById('note').value || ''
  };

  entries.unshift(entry);
  saveEntries();
  document.getElementById('addForm').reset();
  document.getElementById('entryDate').valueAsDate = new Date();
  initDashboard();
  showToast('Entry added successfully');
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveEntries();
  initDashboard();
  showToast('Entry deleted');
}

function renderEntries() {
  const filter = document.getElementById('filterProvider').value;
  const filtered = filter ? entries.filter(e => e.provider === filter) : entries;
  const tbody = document.getElementById('entriesBody');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No entries yet. Start tracking your AI costs above.</td></tr>';
    return;
  }

  // Show up to 50 most recent
  tbody.innerHTML = filtered.slice(0, 50).map(e => {
    const tagClass = 'pt-' + e.provider.toLowerCase().replace(/\s+/g, '').replace('openai', 'openai').replace('googleai', 'google').replace('awsbedrock', 'aws').replace('azureopenai', 'azure');
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td><span class="provider-tag ${tagClass}">${e.provider}</span></td>
        <td>${e.model}</td>
        <td><strong>${formatCurrency(e.cost)}</strong></td>
        <td>${e.tokens ? e.tokens.toLocaleString() : '-'}</td>
        <td style="color:var(--text-muted)">${e.note || '-'}</td>
        <td><button class="delete-btn" onclick="deleteEntry(${e.id})" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button></td>
      </tr>`;
  }).join('');
}

function updateFilterOptions() {
  const providers = [...new Set(entries.map(e => e.provider))].sort();
  const select = document.getElementById('filterProvider');
  const current = select.value;
  select.innerHTML = '<option value="">All Providers</option>' +
    providers.map(p => `<option value="${p}" ${p === current ? 'selected' : ''}>${p}</option>`).join('');
}

// =================== BUDGET ===================
function setBudget(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  if (amount > 0) {
    budget = amount;
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
    updateBudgetDisplay();
    updateSummary();
    showToast(`Monthly budget set to ${formatCurrency(amount)}`);
  }
}

function updateBudgetDisplay() {
  const display = document.getElementById('budgetDisplay');
  if (!budget) {
    display.innerHTML = '';
    return;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthTotal = entries.filter(e => e.date >= monthStart).reduce((s, e) => s + e.cost, 0);
  const pct = Math.min((monthTotal / budget * 100), 100);
  const barClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';

  display.innerHTML = `
    <div class="budget-bar-wrap">
      <div class="budget-bar ${barClass}" style="width: ${pct}%"></div>
    </div>
    <div class="budget-info">
      <span>${formatCurrency(monthTotal)} spent</span>
      <span>${formatCurrency(budget - monthTotal)} remaining</span>
    </div>`;
}

// =================== QUICK STATS ===================
function updateQuickStats() {
  const container = document.getElementById('quickStats');
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Add entries to see stats</p></div>';
    return;
  }

  const costs = entries.map(e => e.cost);
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  const maxEntry = entries.reduce((max, e) => e.cost > max.cost ? e : max, entries[0]);
  const totalTokens = entries.reduce((s, e) => s + (e.tokens || 0), 0);
  const avgDaily = getAvgDailyCost();

  container.innerHTML = `
    <div class="qs-item"><span class="qs-label">Avg per call</span><span class="qs-value">${formatCurrency(avgCost)}</span></div>
    <div class="qs-item"><span class="qs-label">Avg per day</span><span class="qs-value">${formatCurrency(avgDaily)}</span></div>
    <div class="qs-item"><span class="qs-label">Most expensive</span><span class="qs-value">${formatCurrency(maxEntry.cost)}</span></div>
    <div class="qs-item"><span class="qs-label">Total tokens</span><span class="qs-value">${totalTokens.toLocaleString()}</span></div>
    <div class="qs-item"><span class="qs-label">Total entries</span><span class="qs-value">${entries.length}</span></div>`;
}

function getAvgDailyCost() {
  if (entries.length === 0) return 0;
  const dates = [...new Set(entries.map(e => e.date))];
  const total = entries.reduce((s, e) => s + e.cost, 0);
  return total / dates.length;
}

// =================== EXPORT ===================
function exportCSV() {
  if (entries.length === 0) return showToast('No data to export');

  const headers = ['Date', 'Provider', 'Model', 'Cost', 'Tokens', 'Note'];
  const rows = entries.map(e => [
    e.date,
    e.provider,
    e.model,
    e.cost.toFixed(4),
    e.tokens || '',
    `"${e.note.replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `costtracker-ai-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully');
}

// =================== CLEAR DATA ===================
function clearAllData() {
  if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
    entries = [];
    budget = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BUDGET_KEY);
    initDashboard();
    showToast('All data cleared');
  }
}

// =================== HELPERS ===================
function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatCurrency(n) {
  return '$' + n.toFixed(2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// =================== DEMO DATA ===================
// Add sample data if empty for a better first experience
if (entries.length === 0) {
  const models = {
    'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    'Anthropic': ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    'Google AI': ['gemini-2.0-flash', 'gemini-2.0-pro'],
    'Mistral': ['mistral-large', 'codestral'],
  };

  const notes = ['Production chatbot', 'Code review agent', 'Data extraction', 'Testing', 'Customer support bot', 'RAG pipeline', ''];
  const now = new Date();

  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const numEntries = Math.floor(Math.random() * 4) + 1;

    for (let j = 0; j < numEntries; j++) {
      const providers = Object.keys(models);
      const provider = providers[Math.floor(Math.random() * providers.length)];
      const providerModels = models[provider];
      const model = providerModels[Math.floor(Math.random() * providerModels.length)];
      const cost = Math.random() * 3 + 0.01;
      const tokens = Math.floor(Math.random() * 50000) + 500;

      entries.push({
        id: Date.now() + i * 100 + j,
        provider,
        model,
        cost: parseFloat(cost.toFixed(4)),
        tokens,
        date,
        note: notes[Math.floor(Math.random() * notes.length)]
      });
    }
  }

  budget = 200;
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  saveEntries();
}
