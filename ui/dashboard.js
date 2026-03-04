/**
 * Claude Architect Dashboard — Client-side JavaScript.
 * Fetches data from Worker API and renders the dashboard.
 */

const API_BASE = window.location.origin;
let trendChart = null;

/** Initialize dashboard on page load */
async function init() {
  await loadProjects();
}

/** Load project list into selector */
async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    const projects = await res.json();
    const select = document.getElementById('project-select');

    for (const project of projects) {
      const option = document.createElement('option');
      option.value = project.path;
      option.textContent = `${project.name} (${project.path})`;
      select.appendChild(option);
    }

    if (projects.length === 1) {
      select.value = projects[0].path;
      loadProject(projects[0].path);
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

/** Load dashboard data for a specific project */
async function loadProject(projectPath) {
  if (!projectPath) {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('no-project').classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/dashboard/data?project_path=${encodeURIComponent(projectPath)}`
    );
    const data = await res.json();

    if (!data.project) {
      document.getElementById('no-project').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      return;
    }

    document.getElementById('no-project').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    renderScore(data);
    renderViolationCards(data.violationCounts || {});
    renderTrendChart(data.scoreHistory || []);
    renderViolationsTable(data.violations || []);
    renderDecisions(data.recentDecisions || []);
    renderSuggestions(data.suggestions || []);
  } catch (err) {
    console.error('Failed to load project data:', err);
  }
}

/** Render the compliance score circle */
function renderScore(data) {
  const project = data.project;
  const latestScore = data.scoreHistory?.length > 0
    ? data.scoreHistory[data.scoreHistory.length - 1]?.overall_score
    : null;
  const score = latestScore ?? '--';
  const trend = data.trend || 'stable';

  document.getElementById('project-name').textContent = project.name;
  document.getElementById('project-path').textContent = project.path;
  document.getElementById('score-value').textContent = score;

  const circle = document.getElementById('score-circle');
  circle.className = 'score-circle';
  if (typeof score === 'number') {
    if (score >= 80) circle.classList.add('good');
    else if (score >= 50) circle.classList.add('medium');
    else circle.classList.add('bad');
  }

  const trendBadge = document.getElementById('trend-badge');
  trendBadge.textContent = trend;
  trendBadge.className = `trend ${trend}`;
}

/** Render violation count cards */
function renderViolationCards(counts) {
  document.getElementById('critical-count').textContent = counts.critical || 0;
  document.getElementById('warning-count').textContent = counts.warning || 0;
  document.getElementById('info-count').textContent = counts.info || 0;
}

/** Render compliance trend line chart */
function renderTrendChart(history) {
  const canvas = document.getElementById('trend-chart');
  const ctx = canvas.getContext('2d');

  if (trendChart) {
    trendChart.destroy();
  }

  const labels = history.map((_, i) => `S${i + 1}`);
  const scores = history.map(h => h.overall_score);

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Compliance Score',
        data: scores,
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88, 166, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#58a6ff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: '#30363d' },
          ticks: { color: '#8b949e' }
        },
        x: {
          grid: { color: '#30363d' },
          ticks: { color: '#8b949e' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/** Render violations table */
function renderViolationsTable(violations) {
  const tbody = document.getElementById('violations-body');
  tbody.innerHTML = '';

  if (violations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8b949e">No open violations</td></tr>';
    return;
  }

  for (const v of violations.slice(0, 20)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="severity-badge ${v.severity}">${v.severity}</span></td>
      <td>${v.rule_name || v.rule_id}</td>
      <td>${escapeHtml(v.description)}</td>
      <td style="font-family:monospace;font-size:12px">${v.file_path || '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

/** Render recent decisions */
function renderDecisions(decisions) {
  const container = document.getElementById('decisions-list');
  container.innerHTML = '';

  if (decisions.length === 0) {
    container.innerHTML = '<p style="color:#8b949e">No decisions recorded yet</p>';
    return;
  }

  for (const d of decisions) {
    const date = new Date(d.created_at).toLocaleDateString();
    const div = document.createElement('div');
    div.className = 'decision-item';
    div.innerHTML = `
      <span class="decision-status ${d.status}">${d.status}</span>
      <span class="decision-title">${escapeHtml(d.title)}</span>
      <span class="decision-date">${date}</span>
    `;
    container.appendChild(div);
  }
}

/** Render improvement suggestions */
function renderSuggestions(suggestions) {
  const section = document.getElementById('suggestions-section');
  const container = document.getElementById('suggestions-list');
  container.innerHTML = '';

  if (suggestions.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  for (const s of suggestions) {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <div class="suggestion-title">${escapeHtml(s.title)}</div>
      <div class="suggestion-reason">${escapeHtml(s.reasoning)}</div>
    `;
    container.appendChild(div);
  }
}

/** Escape HTML to prevent XSS */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
