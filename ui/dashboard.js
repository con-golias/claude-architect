/**
 * Claude Architect Dashboard v3
 * Tab-based layout: Overview | Structure | Activity
 */

const API_BASE = window.location.origin;
let currentProjectPath = null;
let currentProject = null;
let cachedStructure = null;
let cachedActivity = null;
let cachedReport = null;
let activeTab = 'overview';
let activityFilter = 'all';

/* ════════════════════════════════════════════
   Initialization
   ════════════════════════════════════════════ */

async function init() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => filterActivity(btn.dataset.filter));
  });
  await loadProjects();
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tabId)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `tab-${tabId}`)
  );
  if (tabId === 'structure' && !cachedStructure && currentProjectPath) loadStructure();
  if (tabId === 'activity' && !cachedActivity && currentProject) loadActivity();
}

/* ════════════════════════════════════════════
   Project Loading
   ════════════════════════════════════════════ */

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    const projects = await res.json();
    const select = document.getElementById('project-select');
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.name;
      select.appendChild(opt);
    }
    if (projects.length === 1) {
      select.value = projects[0].path;
      loadProject(projects[0].path);
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

async function loadProject(projectPath) {
  if (!projectPath) {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('no-project').classList.remove('hidden');
    document.getElementById('run-check-btn').disabled = true;
    document.getElementById('tab-nav').classList.add('hidden');
    currentProjectPath = null;
    currentProject = null;
    return;
  }

  currentProjectPath = projectPath;
  cachedStructure = null;
  cachedActivity = null;
  cachedReport = null;
  document.getElementById('run-check-btn').disabled = false;
  document.getElementById('tab-nav').classList.remove('hidden');
  document.getElementById('loading').classList.remove('hidden');

  try {
    const [checkRes, dataRes] = await Promise.all([
      fetch(`${API_BASE}/api/check?project_path=${encodeURIComponent(projectPath)}`),
      fetch(`${API_BASE}/dashboard/data?project_path=${encodeURIComponent(projectPath)}`)
    ]);

    const report = await checkRes.json();
    const data = await dataRes.json();
    cachedReport = report;

    if (!data.project) {
      document.getElementById('no-project').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      return;
    }

    currentProject = data.project;
    document.getElementById('no-project').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Overview
    animateScore(report.overallScore);
    renderCategoryTable(report.scoresByCategory || {});
    renderViolationCards(report.violations || []);
    renderFeatureMap(report.featureMap || []);
    renderCriticalIssues(report.violations || []);
    renderWarningTable(report.violations || []);
    renderInfoTable(report.violations || []);
    renderDecisions(data.recentDecisions || []);
    renderSuggestions(data.suggestions || []);

    const trendBadge = document.getElementById('trend-badge');
    trendBadge.textContent = report.trend || data.trend || 'stable';
    trendBadge.className = `trend-badge ${report.trend || data.trend || 'stable'}`;
    document.getElementById('project-name').textContent = data.project.name;
    document.getElementById('last-checked').textContent = 'Last check: Just now';

    // Lazy-load active tab
    if (activeTab === 'structure') loadStructure();
    if (activeTab === 'activity') loadActivity();
  } catch (err) {
    console.error('Failed to load project:', err);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

async function runCheck() {
  if (!currentProjectPath) return;
  const btn = document.getElementById('run-check-btn');
  const prev = btn.textContent;
  btn.textContent = 'Checking...';
  btn.classList.add('loading');
  await loadProject(currentProjectPath);
  btn.textContent = prev;
  btn.classList.remove('loading');
}

/* ════════════════════════════════════════════
   Overview Renderers
   ════════════════════════════════════════════ */

function animateScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return;
  const ring = document.getElementById('ring-fill');
  const c = 2 * Math.PI * 52;
  ring.style.strokeDasharray = c;
  ring.style.strokeDashoffset = c - (score / 100) * c;
  ring.style.stroke = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  document.getElementById('score-value').textContent = score;
}

function renderCategoryTable(scores) {
  const tbody = document.getElementById('category-body');
  tbody.innerHTML = '';
  const cats = [
    { key: 'dependency', label: 'Dependency' },
    { key: 'structure', label: 'Structure' },
    { key: 'security', label: 'Security' },
    { key: 'quality', label: 'Quality' },
    { key: 'docs', label: 'Documentation' },
  ];
  for (const cat of cats) {
    const val = scores[cat.key] ?? 0;
    const cls = val >= 80 ? 'good' : val >= 50 ? 'medium' : 'bad';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cat.label}</td>
      <td><span class="cat-score-val">${val}</span>/100</td>
      <td class="cat-bar-cell">
        <div class="cat-bar-track"><div class="cat-bar-fill ${cls}" style="width:${val}%"></div></div>
      </td>`;
    tbody.appendChild(tr);
  }
}

function renderViolationCards(violations) {
  const c = { critical: 0, warning: 0, info: 0 };
  for (const v of violations) { if (c[v.severity] !== undefined) c[v.severity]++; }
  document.getElementById('critical-count').textContent = c.critical;
  document.getElementById('warning-count').textContent = c.warning;
  document.getElementById('info-count').textContent = c.info;
}

function renderFeatureMap(features) {
  const tbody = document.getElementById('feature-body');
  const section = document.getElementById('feature-section');
  tbody.innerHTML = '';
  if (!features || features.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  for (const f of features) {
    const layers = [f.hasDomain, f.hasApplication, f.hasInfrastructure, f.hasTests, f.hasReadme];
    const n = layers.filter(Boolean).length;
    let label, cls;
    if (n >= 4) { label = 'Compliant'; cls = 'compliant'; }
    else if (n >= 2) { label = 'Partial'; cls = 'partial'; }
    else { label = 'Non-compliant'; cls = 'non-compliant'; }
    const tr = document.createElement('tr');
    const chk = v => v ? '<span class="check-yes">&#10003;</span>' : '<span class="check-no">&#10007;</span>';
    tr.innerHTML = `
      <td><strong>${esc(f.name)}</strong></td>
      <td class="center">${chk(f.hasDomain)}</td>
      <td class="center">${chk(f.hasApplication)}</td>
      <td class="center">${chk(f.hasInfrastructure)}</td>
      <td class="center">${chk(f.hasTests)}</td>
      <td class="center">${chk(f.hasReadme)}</td>
      <td><span class="compliance-badge ${cls}">${label}</span></td>`;
    tbody.appendChild(tr);
  }
}

function renderCriticalIssues(violations) {
  const section = document.getElementById('critical-section');
  const list = document.getElementById('critical-list');
  const items = violations.filter(v => v.severity === 'critical');
  list.innerHTML = '';
  if (items.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  items.forEach((v, i) => {
    const file = v.filePath || v.file_path || '';
    const line = v.lineNumber || v.line_number || '';
    const loc = line ? `${file}:${line}` : file;
    const rule = v.ruleName || v.rule_name || '';
    const cat = v.category || '';
    const fix = v.suggestion || '';
    const div = document.createElement('div');
    div.className = 'violation-detail';
    div.innerHTML = `
      <div class="violation-detail-header">
        <span class="violation-num">${i + 1}.</span>
        <span class="violation-rule ${cat}">${esc(cat)}</span>
        <span class="violation-title">${esc(rule)}</span>
        <span class="violation-file">${esc(loc)}</span>
      </div>
      <div class="violation-desc">${esc(v.description)}</div>
      ${fix ? `<div class="violation-fix">${esc(fix)}</div>` : ''}`;
    list.appendChild(div);
  });
}

function renderWarningTable(violations) {
  const section = document.getElementById('warning-section');
  const tbody = document.getElementById('warning-body');
  const items = violations.filter(v => v.severity === 'warning');
  tbody.innerHTML = '';
  if (items.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  items.forEach((v, i) => {
    const file = v.filePath || v.file_path || '';
    const line = v.lineNumber || v.line_number || '';
    const loc = line ? `${file}:${line}` : file;
    const rid = v.ruleId || v.rule_id || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="severity-badge warning">${esc(rid)}</span></td>
      <td class="file-path">${esc(loc)}</td>
      <td>${esc(v.description)}</td>
      <td>${esc(v.suggestion || '')}</td>`;
    tbody.appendChild(tr);
  });
}

function renderInfoTable(violations) {
  const section = document.getElementById('info-section');
  const tbody = document.getElementById('info-body');
  const items = violations.filter(v => v.severity === 'info');
  tbody.innerHTML = '';
  if (items.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  items.forEach((v, i) => {
    const file = v.filePath || v.file_path || '';
    const line = v.lineNumber || v.line_number || '';
    const loc = line ? `${file}:${line}` : file;
    const rid = v.ruleId || v.rule_id || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="severity-badge info">${esc(rid)}</span></td>
      <td class="file-path">${esc(loc)}</td>
      <td>${esc(v.description)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderDecisions(decisions) {
  const section = document.getElementById('decisions-section');
  const list = document.getElementById('decisions-list');
  list.innerHTML = '';
  if (!decisions || decisions.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  for (const d of decisions) {
    const div = document.createElement('div');
    div.className = 'decision-item';
    div.innerHTML = `
      <span class="decision-status ${d.status || ''}">${esc(d.status || 'unknown')}</span>
      <div class="decision-content">
        <div class="decision-title">${esc(d.title)}</div>
        <div class="decision-date">${fmtDate(new Date(d.created_at))}</div>
      </div>`;
    list.appendChild(div);
  }
}

function renderSuggestions(suggestions) {
  const section = document.getElementById('suggestions-section');
  const list = document.getElementById('suggestions-list');
  list.innerHTML = '';
  if (!suggestions || suggestions.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  for (const s of suggestions) {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <div class="suggestion-title">${esc(s.title)}</div>
      <div class="suggestion-reason">${esc(s.reasoning)}</div>`;
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════
   Structure Tab
   ════════════════════════════════════════════ */

async function loadStructure() {
  if (!currentProjectPath) return;
  const tree = document.getElementById('structure-tree');
  const stats = document.getElementById('structure-stats');
  tree.innerHTML = '<div class="loading-inline"><div class="spinner-sm"></div> Scanning project...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/structure?project_path=${encodeURIComponent(currentProjectPath)}`);
    cachedStructure = await res.json();

    // Stats
    const extMap = {};
    countExts(cachedStructure, extMap);
    const topExts = Object.entries(extMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    stats.innerHTML = `
      <div class="stat-pill"><span class="stat-val">${cachedStructure.fileCount}</span> files</div>
      <div class="stat-pill"><span class="stat-val">${fmtSize(cachedStructure.size)}</span> total</div>
      <div class="stat-pill"><span class="stat-val">${countDirs(cachedStructure)}</span> dirs</div>
      <div class="stat-pill ext-pills">${topExts.map(([e, c]) =>
        `<span class="ext-chip ext-${e}">.${e}<small>${c}</small></span>`).join('')}</div>`;

    // Tree
    tree.innerHTML = '';
    renderNode(cachedStructure, tree, 0, true);
  } catch (err) {
    tree.innerHTML = `<div class="empty-state">Failed to load: ${esc(err.message)}</div>`;
  }
}

function renderNode(node, container, depth, isRoot) {
  if (node.type === 'dir') {
    const row = document.createElement('div');
    row.className = 'tree-row tree-dir';
    row.style.paddingLeft = `${depth * 20 + 12}px`;
    const open = isRoot || depth < 1;

    row.innerHTML = `
      <span class="tree-chevron">${open ? '&#9660;' : '&#9654;'}</span>
      <span class="tree-icon">&#128193;</span>
      <span class="tree-name dir-name">${esc(node.name)}</span>
      <span class="tree-badge">${node.fileCount}</span>
      <span class="tree-size">${fmtSize(node.size)}</span>`;

    const kids = document.createElement('div');
    kids.className = `tree-children${open ? '' : ' collapsed'}`;

    row.addEventListener('click', () => {
      const nowOpen = !kids.classList.contains('collapsed');
      kids.classList.toggle('collapsed');
      row.querySelector('.tree-chevron').innerHTML = nowOpen ? '&#9654;' : '&#9660;';
    });

    container.appendChild(row);
    container.appendChild(kids);

    if (node.children) {
      for (const child of node.children) renderNode(child, kids, depth + 1, false);
    }
  } else {
    const row = document.createElement('div');
    row.className = 'tree-row tree-file';
    row.style.paddingLeft = `${depth * 20 + 32}px`;
    const ext = node.ext || '';
    row.innerHTML = `
      <span class="tree-icon file-dot ext-${ext}">&#9679;</span>
      <span class="tree-name">${esc(node.name)}</span>
      <span class="tree-size">${fmtSize(node.size)}</span>`;
    container.appendChild(row);
  }
}

function countExts(node, map) {
  if (node.type === 'file' && node.ext) map[node.ext] = (map[node.ext] || 0) + 1;
  if (node.children) for (const c of node.children) countExts(c, map);
}

function countDirs(node) {
  let n = 0;
  if (node.type === 'dir' && node.children) {
    n = 1;
    for (const c of node.children) n += countDirs(c);
  }
  return n;
}

/* ════════════════════════════════════════════
   Activity Tab
   ════════════════════════════════════════════ */

async function loadActivity() {
  if (!currentProject) return;
  const tl = document.getElementById('activity-timeline');
  tl.innerHTML = '<div class="loading-inline"><div class="spinner-sm"></div> Loading activity...</div>';

  try {
    const [sessRes, decRes, gitRes] = await Promise.all([
      fetch(`${API_BASE}/api/sessions?project_id=${encodeURIComponent(currentProject.id)}`),
      fetch(`${API_BASE}/api/decisions?project_path=${encodeURIComponent(currentProjectPath)}&limit=50`),
      fetch(`${API_BASE}/api/git-activity?project_path=${encodeURIComponent(currentProjectPath)}`)
    ]);

    const sessions = await sessRes.json();
    const decisions = await decRes.json();
    const commits = await gitRes.json();

    // Use LIVE violations from cachedReport (same as Overview tab) instead of stale DB
    const liveViolations = cachedReport ? (cachedReport.violations || []) : [];

    const events = [];

    // Sort sessions by start time descending, mark only the most recent as active
    const sorted = [...sessions].sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const isLatest = i === 0;
      const isActive = isLatest && !s.completed_at;
      // Infer end time: use completed_at, or next session's start, or now if active
      const inferredEnd = s.completed_at || (i > 0 ? sorted[i - 1]?.started_at : null) || (isActive ? null : s.started_at);
      const title = s.summary || (isActive ? 'Active session' : 'Session');
      events.push({
        type: 'session',
        ts: s.started_at || s.created_at,
        title,
        data: { ...s, _isActive: isActive, _inferredEnd: inferredEnd }
      });
    }
    for (const d of decisions) {
      events.push({ type: 'decision', ts: d.created_at, title: d.title, data: d });
    }
    for (const v of liveViolations) {
      events.push({ type: 'violation', ts: Date.now(), title: v.description, data: { ...v, _live: true } });
    }
    for (const c of commits) {
      events.push({ type: 'commit', ts: c.timestamp, title: c.subject, data: c });
    }

    events.sort((a, b) => b.ts - a.ts);
    cachedActivity = events;
    renderTimeline(events);
  } catch (err) {
    tl.innerHTML = `<div class="empty-state">Failed to load activity: ${esc(err.message)}</div>`;
  }
}

function renderTimeline(events) {
  const tl = document.getElementById('activity-timeline');
  tl.innerHTML = '';

  const filtered = activityFilter === 'all'
    ? events
    : events.filter(e => e.type === activityFilter);

  if (filtered.length === 0) {
    const msgs = {
      all: 'No activity recorded yet. Use the plugin to start tracking.',
      commit: 'No git commits found. This project may not be a git repository.',
      session: 'No sessions recorded. Sessions are tracked automatically when using Claude Code.',
      decision: 'No decisions recorded. Use <code>/architect-log-decision</code> to record architectural decisions.',
      violation: 'No current violations detected — your project is clean!',
    };
    tl.innerHTML = `<div class="empty-state">${msgs[activityFilter] || msgs.all}</div>`;
    return;
  }

  // Group by date
  const groups = {};
  for (const ev of filtered) {
    const d = new Date(ev.ts);
    const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }

  for (const [dateLabel, items] of Object.entries(groups)) {
    const dh = document.createElement('div');
    dh.className = 'tl-date';
    dh.textContent = dateLabel;
    tl.appendChild(dh);

    for (const ev of items) {
      const time = new Date(ev.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const item = document.createElement('div');
      item.className = `tl-item tl-${ev.type}`;

      let icon, details = '';

      if (ev.type === 'session') {
        icon = '&#9654;';
        details = renderSessionDetails(ev.data);
      } else if (ev.type === 'decision') {
        icon = '&#9733;';
        details = renderDecisionDetails(ev.data);
      } else if (ev.type === 'commit') {
        icon = ev.data.hash === 'working' ? '&#9998;' : '&#9679;';
        details = renderCommitDetails(ev.data);
      } else if (ev.type === 'violation') {
        const sev = ev.data.severity || 'info';
        icon = sev === 'critical' ? '!' : sev === 'warning' ? '&#9888;' : 'i';
        details = renderViolationDetails(ev.data);
      }

      item.innerHTML = `
        <div class="tl-marker tl-marker-${ev.type}"><span>${icon}</span></div>
        <div class="tl-body">
          <div class="tl-head">
            <span class="tl-type">${ev.type}</span>
            ${ev.data._live ? '<span class="live-badge">LIVE</span>' : ''}
            <span class="tl-time">${time}</span>
          </div>
          <div class="tl-title">${esc(ev.title)}</div>
          ${details}
        </div>`;

      // Make sessions clickable to toggle details panel
      if (ev.type === 'session') {
        item.classList.add('tl-clickable');
        item.addEventListener('click', () => {
          const panel = item.querySelector('.sess-panel');
          if (panel) {
            panel.classList.toggle('collapsed');
            item.classList.toggle('tl-expanded');
          }
        });
      }

      tl.appendChild(item);
    }
  }
}

function renderSessionDetails(s) {
  const isActive = s._isActive;

  // Status badge + score pills for the summary line
  const statusBadge = isActive
    ? '<span class="tl-stat active-badge">Active</span>'
    : '<span class="tl-stat ended-badge">Ended</span>';

  let scorePill = '';
  if (s.compliance_score_before != null) {
    if (s.compliance_score_after != null) {
      const delta = s.compliance_score_after - s.compliance_score_before;
      const cls = delta > 0 ? 'score-up' : delta < 0 ? 'score-down' : 'score-same';
      scorePill = `<span class="tl-stat ${cls}">Score: ${s.compliance_score_before} &rarr; ${s.compliance_score_after}</span>`;
    } else {
      scorePill = `<span class="tl-stat">Score: ${s.compliance_score_before}</span>`;
    }
  }

  const summaryLine = `<div class="tl-details tl-stats-row">${statusBadge}${scorePill}</div>`;

  // Expandable card — claude-mem style: paragraph text + metadata at bottom
  const dateFmt = new Date(s.started_at).toLocaleDateString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const timeFmt = new Date(s.started_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const shortId = s.id.substring(0, 8);

  let cardContent = '';
  if (s.summary) {
    cardContent = `<div class="sess-text">${esc(s.summary)}</div>`;
  } else if (isActive) {
    cardContent = `<div class="sess-text sess-hint">Session is currently active. A summary will be generated automatically when the terminal closes.</div>`;
  } else {
    cardContent = `<div class="sess-text sess-hint">This session was recorded before summary generation was enabled. Future sessions will include a description of what was done.</div>`;
  }

  const meta = `<div class="sess-meta">#${shortId} &bull; ${dateFmt}, ${timeFmt}</div>`;

  const panel = `<div class="sess-panel collapsed">${cardContent}${meta}</div>`;

  return summaryLine + panel;
}

function renderDecisionDetails(d) {
  let html = '<div class="tl-details">';
  if (d.status) {
    html += `<span class="decision-status ${d.status}">${esc(d.status)}</span>`;
  }
  if (d.context) {
    html += `<span class="tl-decision-context">${esc(d.context.substring(0, 100))}</span>`;
  }
  if (d.tags) {
    const tags = typeof d.tags === 'string' ? d.tags.split(',') : (Array.isArray(d.tags) ? d.tags : []);
    if (tags.length > 0) {
      html += tags.map(t => `<span class="tl-tag">${esc(t.trim())}</span>`).join('');
    }
  }
  html += '</div>';

  if (d.decision) {
    html += `<div class="tl-decision-text">${esc(d.decision.substring(0, 300))}${d.decision.length > 300 ? '...' : ''}</div>`;
  }

  return html;
}

function renderCommitDetails(c) {
  const isWorking = c.hash === 'working';
  let html = `<div class="tl-details">
    ${isWorking ? '<span class="working-badge">Uncommitted</span>' : `<span class="tl-hash">${c.hash}</span>`}
    <span class="tl-stat">${(c.files || []).length} file${(c.files || []).length !== 1 ? 's' : ''}</span>
  </div>`;

  const files = (c.files || []).slice(0, 10);
  if (files.length > 0) {
    const fileHtml = files.map(f =>
      `<div class="tl-file-entry"><span class="tl-file-status ${f.status}">${f.status}</span><span>${esc(f.path)}</span></div>`
    ).join('');
    const moreCount = (c.files || []).length - 10;
    html += `<div class="tl-files">${fileHtml}${moreCount > 0 ? `<div class="tl-file-entry" style="color:var(--text-faint)">...and ${moreCount} more</div>` : ''}</div>`;
  }

  return html;
}

function renderViolationDetails(v) {
  const sev = v.severity || 'info';
  const file = v.filePath || v.file_path || '';
  const line = v.lineNumber || v.line_number || '';
  const loc = line ? `${file}:${line}` : file;
  const rule = v.ruleName || v.rule_name || '';
  const ruleId = v.ruleId || v.rule_id || '';
  const cat = v.category || '';
  const fix = v.suggestion || '';

  let html = `<div class="tl-details">
    <span class="severity-badge ${sev}">${sev}</span>`;

  if (cat) html += `<span class="tl-violation-cat ${cat}">${esc(cat)}</span>`;
  if (ruleId || rule) html += `<span class="tl-violation-rule">${esc(ruleId || rule)}</span>`;
  if (loc) html += `<span class="tl-file">${esc(loc)}</span>`;
  html += '</div>';

  if (fix) {
    html += `<div class="tl-violation-fix">${esc(fix)}</div>`;
  }

  return html;
}

function formatDuration(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function filterActivity(type) {
  activityFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === type)
  );
  if (cachedActivity) renderTimeline(cachedActivity);
}

/* ════════════════════════════════════════════
   Collapsible Sections
   ════════════════════════════════════════════ */

function toggleSection(contentId, headerEl) {
  const content = document.getElementById(contentId);
  content.classList.toggle('collapsed');
  headerEl.classList.toggle('collapsed');
}

/* ════════════════════════════════════════════
   Utilities
   ════════════════════════════════════════════ */

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const diff = Date.now() - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text || '';
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
