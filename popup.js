/**
 * TAI XIU PRO - Popup Controller
 * Connects UI with core mathematical modules, manages storage,
 * renders interactive SVG charts, bead roads, and handles user actions.
 */

import { classifyRoll, getTheoreticalProbabilities } from './core/probability.js';
import { runMonteCarlo } from './core/simulation.js';
import { analyzeSessions } from './core/analyzer.js';

// ==========================================
// Application State
// ==========================================
const state = {
  sessions: [],
  selectedDice: [1, 2, 3],
  activeTab: 'tab-input',
  analyticsWindow: 'all',
  simIterations: 100000,
  isExpanded: false,
  theoretical: getTheoreticalProbabilities()
};

// ==========================================
// Storage Helpers (chrome.storage.local with localStorage fallback)
// ==========================================
async function getStoredData(keys) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }
  // Fallback to localStorage for direct browser inspection
  const result = {};
  for (const k of keys) {
    const item = localStorage.getItem(`taixiu_${k}`);
    if (item) {
      try {
        result[k] = JSON.parse(item);
      } catch (e) {
        result[k] = null;
      }
    }
  }
  return result;
}

async function setStoredData(data) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }
  // Fallback
  for (const [k, v] of Object.entries(data)) {
    localStorage.setItem(`taixiu_${k}`, JSON.stringify(v));
  }
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check URL query for expanded mode (e.g. popup.html?mode=expanded)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'expanded') {
    state.isExpanded = true;
    document.body.classList.add('expanded');
  }

  // Load stored state
  const stored = await getStoredData(['sessions', 'settings']);
  if (stored && Array.isArray(stored.sessions)) {
    state.sessions = stored.sessions;
  }
  if (stored && stored.settings && stored.settings.viewMode === 'expanded') {
    state.isExpanded = true;
    document.body.classList.add('expanded');
  }

  // Setup UI Listeners
  setupNavigation();
  setupDiceInputs();
  setupActionButtons();
  setupAnalyticsFilters();
  setupSimulation();
  setupHistoryActions();
  setupHeaderControls();

  // Initial renders
  updateLiveDiceView();
  refreshAllViews();

  // Run initial simulation preview
  executeMonteCarlo();
});

// ==========================================
// Navigation & Tabs
// ==========================================
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      state.activeTab = targetId;

      // Update active nav button
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update visible pane
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(targetId);
      if (activePane) activePane.classList.add('active');

      // Refresh content specific to tab
      if (targetId === 'tab-analytics') {
        renderAnalyticsTab();
      } else if (targetId === 'tab-history') {
        renderHistoryTable();
      }
    });
  });
}

function setupHeaderControls() {
  const toggleBtn = document.getElementById('toggleExpandBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.isExpanded = !state.isExpanded;
      if (state.isExpanded) {
        document.body.classList.add('expanded');
      } else {
        document.body.classList.remove('expanded');
      }
      setStoredData({ settings: { viewMode: state.isExpanded ? 'expanded' : 'compact' } });
      // Re-render charts to fit new container dimensions
      renderAnalyticsTab();
      renderSimulationChart();
    });
  }

  const openTabBtn = document.getElementById('openTabBtn');
  if (openTabBtn) {
    openTabBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=expanded') });
      } else {
        window.open('popup.html?mode=expanded', '_blank');
      }
    });
  }
}

// ==========================================
// Interactive Dice Input & Visualization
// ==========================================
function setupDiceInputs() {
  for (let dieIndex = 1; dieIndex <= 3; dieIndex++) {
    const card = document.getElementById(`dieCard${dieIndex}`);
    const minusBtn = card.querySelector('.die-btn.minus');
    const plusBtn = card.querySelector('.die-btn.plus');

    // Click on die face cycles value 1..6
    const visual = document.getElementById(`dieVisual${dieIndex}`);
    visual.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleDie(dieIndex, 1);
    });

    minusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleDie(dieIndex, -1);
    });

    plusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleDie(dieIndex, 1);
    });
  }
}

function cycleDie(dieIndex, step) {
  const current = state.selectedDice[dieIndex - 1];
  let next = current + step;
  if (next > 6) next = 1;
  if (next < 1) next = 6;
  state.selectedDice[dieIndex - 1] = next;
  updateLiveDiceView();
}

function updateLiveDiceView() {
  const [d1, d2, d3] = state.selectedDice;

  for (let i = 1; i <= 3; i++) {
    const val = state.selectedDice[i - 1];
    const numEl = document.getElementById(`dieVal${i}`);
    if (numEl) numEl.textContent = val;

    const visualEl = document.getElementById(`dieVisual${i}`);
    if (visualEl) {
      visualEl.className = `die-face die-val-${val}`;
      visualEl.innerHTML = getDieDotsHtml(val);
    }
  }

  // Classify current roll
  const roll = classifyRoll(d1, d2, d3);

  // Update sum and badges
  const sumValEl = document.getElementById('liveSumValue');
  if (sumValEl) sumValEl.textContent = roll.sum;

  const classTextEl = document.getElementById('liveClassText');
  const liveResultBadge = document.getElementById('liveResultBadge');
  const extraInfoEl = document.getElementById('liveExtraInfo');

  let badgeClass = 'badge-xiu';
  let badgeText = 'XỈU (4 - 10)';
  let shortText = 'XỈU';

  if (roll.isTriple) {
    badgeClass = 'badge-triple';
    badgeText = `BỘ BA (${roll.tripleValue}-${roll.tripleValue}-${roll.tripleValue})`;
    shortText = 'BỘ BA';
  } else if (roll.result === 'tai') {
    badgeClass = 'badge-tai';
    badgeText = 'TÀI (11 - 17)';
    shortText = 'TÀI';
  }

  if (classTextEl) {
    classTextEl.className = `class-badge ${badgeClass}`;
    classTextEl.textContent = badgeText;
  }
  if (liveResultBadge) {
    liveResultBadge.textContent = shortText;
  }

  // Extra info (even/odd, double)
  const evenOddText = roll.isEven ? 'Chẵn' : 'Lẻ';
  const doubleText = roll.isDouble ? `Có cặp đôi (${roll.doubleValue})` : 'Không bộ đôi';
  if (extraInfoEl) {
    extraInfoEl.textContent = `${evenOddText} • ${doubleText}`;
  }
}

function getDieDotsHtml(val) {
  switch (val) {
    case 1:
      return '<span class="dot dot-center"></span>';
    case 2:
      return '<span class="dot dot-tl"></span><span class="dot dot-br"></span>';
    case 3:
      return '<span class="dot dot-tl"></span><span class="dot dot-center"></span><span class="dot dot-br"></span>';
    case 4:
      return '<span class="dot dot-tl"></span><span class="dot dot-tr"></span><span class="dot dot-bl"></span><span class="dot dot-br"></span>';
    case 5:
      return '<span class="dot dot-tl"></span><span class="dot dot-tr"></span><span class="dot dot-center"></span><span class="dot dot-bl"></span><span class="dot dot-br"></span>';
    case 6:
      return '<span class="dot dot-tl"></span><span class="dot dot-tr"></span><span class="dot dot-ml"></span><span class="dot dot-mr"></span><span class="dot dot-bl"></span><span class="dot dot-br"></span>';
    default:
      return '';
  }
}

// ==========================================
// Action Buttons (Add, Random, Quick Add)
// ==========================================
function setupActionButtons() {
  // Add Session Button
  const addBtn = document.getElementById('addSessionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const [d1, d2, d3] = state.selectedDice;
      addSession(d1, d2, d3);
    });
  }

  // Random Roll Button
  const randomBtn = document.getElementById('randomRollBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      animateAndRollRandom();
    });
  }

  // Quick Add Buttons
  const quickTai = document.getElementById('quickTaiBtn');
  if (quickTai) {
    quickTai.addEventListener('click', () => {
      const dice = generateRandomTai();
      addSession(dice[0], dice[1], dice[2]);
    });
  }

  const quickXiu = document.getElementById('quickXiuBtn');
  if (quickXiu) {
    quickXiu.addEventListener('click', () => {
      const dice = generateRandomXiu();
      addSession(dice[0], dice[1], dice[2]);
    });
  }

  const quickTriple = document.getElementById('quickTripleBtn');
  if (quickTriple) {
    quickTriple.addEventListener('click', () => {
      const val = (Math.random() * 6 | 0) + 1;
      addSession(val, val, val);
    });
  }
}

function animateAndRollRandom() {
  const d1 = (Math.random() * 6 | 0) + 1;
  const d2 = (Math.random() * 6 | 0) + 1;
  const d3 = (Math.random() * 6 | 0) + 1;

  state.selectedDice = [d1, d2, d3];
  updateLiveDiceView();
}

function generateRandomTai() {
  while (true) {
    const d1 = (Math.random() * 6 | 0) + 1;
    const d2 = (Math.random() * 6 | 0) + 1;
    const d3 = (Math.random() * 6 | 0) + 1;
    const sum = d1 + d2 + d3;
    if (sum >= 11 && sum <= 17 && !(d1 === d2 && d2 === d3)) {
      return [d1, d2, d3];
    }
  }
}

function generateRandomXiu() {
  while (true) {
    const d1 = (Math.random() * 6 | 0) + 1;
    const d2 = (Math.random() * 6 | 0) + 1;
    const d3 = (Math.random() * 6 | 0) + 1;
    const sum = d1 + d2 + d3;
    if (sum >= 4 && sum <= 10 && !(d1 === d2 && d2 === d3)) {
      return [d1, d2, d3];
    }
  }
}

async function addSession(d1, d2, d3) {
  const roll = classifyRoll(d1, d2, d3);
  const newSession = {
    id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: Date.now(),
    dice: [d1, d2, d3],
    sum: roll.sum,
    result: roll.result,
    isTriple: roll.isTriple,
    isDouble: roll.isDouble
  };

  state.sessions.push(newSession);
  await setStoredData({ sessions: state.sessions });

  refreshAllViews();
}

// ==========================================
// View Refreshes & Top Metric Cards
// ==========================================
function refreshAllViews() {
  renderTopMetricCards();
  renderBeadRoad();
  if (state.activeTab === 'tab-analytics') renderAnalyticsTab();
  if (state.activeTab === 'tab-history') renderHistoryTable();
}

function renderTopMetricCards() {
  const analysis = analyzeSessions(state.sessions, 'all');
  const n = state.sessions.length;

  // Theoretical values dynamically from probability engine
  const theo = state.theoretical;

  const cardTaiTheo = document.getElementById('cardTaiTheo');
  const cardXiuTheo = document.getElementById('cardXiuTheo');
  const cardTripleTheo = document.getElementById('cardTripleTheo');
  const cardTotalCombos = document.getElementById('cardTotalCombos');
  const cardTotalSessions = document.getElementById('cardTotalSessions');

  if (cardTaiTheo) cardTaiTheo.textContent = theo.tai.displayPercent;
  if (cardXiuTheo) cardXiuTheo.textContent = theo.xiu.displayPercent;
  if (cardTripleTheo) cardTripleTheo.textContent = theo.triple.displayPercent;
  if (cardTotalCombos) cardTotalCombos.textContent = theo.totalOutcomes;
  if (cardTotalSessions) cardTotalSessions.textContent = n;

  // Empirical subs
  const cardTaiEmp = document.getElementById('cardTaiEmp');
  const cardXiuEmp = document.getElementById('cardXiuEmp');
  const cardTripleEmp = document.getElementById('cardTripleEmp');
  const streakBadge = document.getElementById('cardCurrentStreakBadge');

  if (n > 0) {
    const sTai = analysis.summary.tai;
    const sXiu = analysis.summary.xiu;
    const sTriple = analysis.summary.triple;

    if (cardTaiEmp) cardTaiEmp.textContent = `Thực tế: ${sTai.empiricalPercent} (${sTai.count})`;
    if (cardXiuEmp) cardXiuEmp.textContent = `Thực tế: ${sXiu.empiricalPercent} (${sXiu.count})`;
    if (cardTripleEmp) cardTripleEmp.textContent = `Thực tế: ${sTriple.empiricalPercent} (${sTriple.count})`;
    if (streakBadge) streakBadge.textContent = analysis.streaks.currentStreak.display || '0 phiên';
  } else {
    if (cardTaiEmp) cardTaiEmp.textContent = 'Thực tế: 0,00% (0)';
    if (cardXiuEmp) cardXiuEmp.textContent = 'Thực tế: 0,00% (0)';
    if (cardTripleEmp) cardTripleEmp.textContent = '6 / 216 tổ hợp';
    if (streakBadge) streakBadge.textContent = 'Chưa có chuỗi';
  }
}

// ==========================================
// Bead Road (Cầu Giọt Nước - Casino Style)
// ==========================================
function renderBeadRoad() {
  const container = document.getElementById('beadRoadContainer');
  const emptyNotice = document.getElementById('emptyBeadNotice');
  if (!container) return;

  if (state.sessions.length === 0) {
    container.innerHTML = '<div class="empty-state-text">Chưa có phiên nào. Hãy gieo xúc xắc hoặc thêm nhanh để xem bảng cầu.</div>';
    return;
  }

  // Display last 50 sessions
  const recent = state.sessions.slice(-50);
  container.innerHTML = '';

  recent.forEach((s, idx) => {
    const bead = document.createElement('div');
    bead.className = `bead-circle bead-${s.result}`;
    const label = s.result === 'tai' ? 'T' : (s.result === 'xiu' ? 'X' : 'B');
    bead.textContent = label;
    bead.title = `Phiên #${state.sessions.length - recent.length + idx + 1}: ${s.dice.join('-')} (Tổng ${s.sum}) -> ${label === 'T' ? 'Tài' : (label === 'X' ? 'Xỉu' : 'Bộ ba')}`;
    container.appendChild(bead);
  });

  // Auto-scroll to end of bead road
  container.scrollLeft = container.scrollWidth;
}

// ==========================================
// TAB 2: Phân Tích Cầu & Xu Hướng
// ==========================================
function setupAnalyticsFilters() {
  const filterBtns = document.querySelectorAll('#windowFilterGroup .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.analyticsWindow = btn.dataset.window;
      renderAnalyticsTab();
    });
  });
}

function renderAnalyticsTab() {
  const analysis = analyzeSessions(state.sessions, state.analyticsWindow);

  // 1. Active Pattern Card
  const patternBadge = document.getElementById('activePatternBadge');
  const patternDesc = document.getElementById('activePatternDesc');
  if (patternBadge && patternDesc) {
    patternBadge.textContent = analysis.patterns.activePattern.name;
    patternDesc.textContent = analysis.patterns.activePattern.description;
  }

  // 2. Statistical Comparison Table
  if (analysis.totalAnalyzed > 0 && analysis.summary) {
    const sTai = analysis.summary.tai;
    const sXiu = analysis.summary.xiu;
    const sTriple = analysis.summary.triple;

    setText('statTaiCount', sTai.count);
    setText('statTaiEmp', sTai.empiricalPercent);
    setText('statTaiDelta', (Number(sTai.empiricalProb) - 0.4861 >= 0 ? '+' : '') + sTai.deltaPercent);
    setText('statTaiCI', sTai.ci95 ? sTai.ci95.displayRange : 'N/A');

    setText('statXiuCount', sXiu.count);
    setText('statXiuEmp', sXiu.empiricalPercent);
    setText('statXiuDelta', (Number(sXiu.empiricalProb) - 0.4861 >= 0 ? '+' : '') + sXiu.deltaPercent);
    setText('statXiuCI', sXiu.ci95 ? sXiu.ci95.displayRange : 'N/A');

    setText('statTripleCount', sTriple.count);
    setText('statTripleEmp', sTriple.empiricalPercent);
    setText('statTripleDelta', (Number(sTriple.empiricalProb) - 0.0278 >= 0 ? '+' : '') + sTriple.deltaPercent);
    setText('statTripleCI', sTriple.ci95 ? sTriple.ci95.displayRange : 'N/A');
  } else {
    ['Tai', 'Xiu', 'Triple'].forEach(t => {
      setText(`stat${t}Count`, '0');
      setText(`stat${t}Emp`, '0.00%');
      setText(`stat${t}Delta`, '0.00%');
      setText(`stat${t}CI`, '0% - 0%');
    });
  }

  // 3. Streak & Transition Metrics
  setText('streakCurrentVal', analysis.streaks.currentStreak.display || 'Chưa có');
  setText('streakMaxTaiVal', `${analysis.streaks.maxTaiStreak} phiên`);
  setText('streakMaxXiuVal', `${analysis.streaks.maxXiuStreak} phiên`);

  const trans = analysis.transitions.probabilities;
  const flipRate = (trans.taiToXiu !== undefined && trans.xiuToTai !== undefined)
    ? (((trans.taiToXiu + trans.xiuToTai) / 2).toFixed(1) + '%')
    : '0.00%';
  setText('transitionFlipRate', flipRate);

  // 4. Sum Distribution Chart
  renderSumDistributionChart(analysis.sumDistribution);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ==========================================
// Responsive SVG Chart: Sums 3 to 18
// ==========================================
function renderSumDistributionChart(distribution) {
  const container = document.getElementById('sumChartContainer');
  if (!container || !Array.isArray(distribution) || distribution.length === 0) return;

  const width = Number(container.clientWidth) || 390;
  const height = 130;
  const padding = { top: 15, right: 10, bottom: 25, left: 28 };
  const rawW = width - padding.left - padding.right;
  const rawH = height - padding.top - padding.bottom;
  const chartW = (Number.isFinite(rawW) && rawW > 50) ? rawW : 352;
  const chartH = (Number.isFinite(rawH) && rawH > 30) ? rawH : 90;

  const THEO_COMBOS = { 3: 1, 4: 3, 5: 6, 6: 10, 7: 15, 8: 21, 9: 25, 10: 27, 11: 27, 12: 25, 13: 21, 14: 15, 15: 10, 16: 6, 17: 3, 18: 1 };

  // Max probability for scaling
  let maxP = 0.15;
  for (const item of distribution) {
    const emp = Number(item && item.empiricalProb);
    const theo = Number(item && (item.theoreticalProb !== undefined ? item.theoreticalProb : (item.probability !== undefined ? item.probability : (THEO_COMBOS[item.sum] / 216))));
    if (Number.isFinite(emp) && emp > maxP) maxP = emp;
    if (Number.isFinite(theo) && theo > maxP) maxP = theo;
  }
  if (!Number.isFinite(maxP) || maxP <= 0) maxP = 0.15;

  const numBars = distribution.length || 16;
  const step = chartW / numBars;
  const barWidth = Math.max(6, step - 4);

  let svgHtml = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Background Grid Lines
  const gridSteps = 3;
  for (let g = 1; g <= gridSteps; g++) {
    const val = (maxP / gridSteps) * g;
    const gridY = Number((padding.top + chartH - (val / maxP) * chartH).toFixed(1));
    if (Number.isFinite(gridY)) {
      svgHtml += `<line x1="${padding.left}" y1="${gridY}" x2="${width - padding.right}" y2="${gridY}" stroke="#1f2737" stroke-dasharray="3,3" />`;
      svgHtml += `<text x="${padding.left - 4}" y="${gridY + 3}" fill="#64748b" font-size="8.5" text-anchor="end">${(val * 100).toFixed(0)}%</text>`;
    }
  }

  // Draw Theoretical Line Points
  const linePoints = [];

  // Draw Bars (Empirical)
  distribution.forEach((item, i) => {
    const empP = Number(item && item.empiricalProb);
    const theoP = Number(item && (item.theoreticalProb !== undefined ? item.theoreticalProb : (item.probability !== undefined ? item.probability : ((THEO_COMBOS[item.sum] || 1) / 216))));

    const x = padding.left + i * step + (step - barWidth) / 2;
    let barH = 0;
    if (Number.isFinite(empP) && empP > 0) {
      barH = (empP / maxP) * chartH;
    }
    if (!Number.isFinite(barH) || barH < 0) barH = 0;
    if (barH > chartH) barH = chartH;

    let y = padding.top + chartH - barH;
    if (!Number.isFinite(y)) y = padding.top + chartH;

    let theoY = padding.top + chartH;
    if (Number.isFinite(theoP) && theoP > 0) {
      theoY = padding.top + chartH - (theoP / maxP) * chartH;
    }
    if (!Number.isFinite(theoY)) theoY = padding.top + chartH;

    // Color based on sum classification
    let barColor = '#10b981'; // Xiu
    if (item.sum === 3 || item.sum === 18) barColor = '#a855f7'; // Triple only
    else if (item.sum >= 11) barColor = '#ef4444'; // Tai

    svgHtml += `<rect x="${Number(x.toFixed(1))}" y="${Number(y.toFixed(1))}" width="${Number(barWidth.toFixed(1))}" height="${Number(barH.toFixed(1))}" fill="${barColor}" rx="2" opacity="0.85">
      <title>Tổng ${item.sum}: Thực tế ${item.empiricalPercent || '0.00%'} (${item.observedCount || 0} lần) | Lý thuyết ${item.theoreticalPercent || item.percentageFormatted || ''}</title>
    </rect>`;

    // X Axis Label
    svgHtml += `<text x="${Number((x + barWidth / 2).toFixed(1))}" y="${height - 8}" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle">${item.sum}</text>`;

    // Store theoretical point as clean {x, y} object
    const posX = x + barWidth / 2;
    if (Number.isFinite(theoY) && Number.isFinite(posX)) {
      linePoints.push({
        x: Number(posX.toFixed(1)),
        y: Number(theoY.toFixed(1))
      });
    }
  });

  // Theoretical overlay curve
  if (linePoints.length > 1) {
    const pointsAttr = linePoints.map(p => `${p.x},${p.y}`).join(' ');
    if (pointsAttr && !pointsAttr.includes('NaN')) {
      svgHtml += `<polyline points="${pointsAttr}" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" opacity="0.9" />`;
    }
    for (const p of linePoints) {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        svgHtml += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#f59e0b" stroke="#0b0e14" stroke-width="1" />`;
      }
    }
  }

  svgHtml += `</svg>`;
  container.innerHTML = svgHtml;
}

// ==========================================
// TAB 3: Mô Phỏng Monte Carlo
// ==========================================
function setupSimulation() {
  const iterBtns = document.querySelectorAll('#simIterationsGroup .sim-btn');
  iterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      iterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.simIterations = Number(btn.dataset.iter);
    });
  });

  const runBtn = document.getElementById('runSimBtn');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      executeMonteCarlo();
    });
  }
}

function executeMonteCarlo() {
  const runBtn = document.getElementById('runSimBtn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span>⏳ Đang chạy mô phỏng...</span>';
  }

  // Use requestAnimationFrame / setTimeout so UI shows loading
  setTimeout(() => {
    const report = runMonteCarlo(state.simIterations);

    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<span>🚀 Bắt Đầu Mô Phỏng Ngay</span>';
    }

    // Render results
    renderSimulationResults(report);
  }, 10);
}

function renderSimulationResults(report) {
  const statusRow = document.getElementById('simStatusRow');
  const timeNotice = document.getElementById('simTimeNotice');
  const chiNotice = document.getElementById('simChiSquareNotice');

  if (statusRow) statusRow.style.display = 'flex';
  if (timeNotice) timeNotice.textContent = `Thời gian: ${report.executionTimeMs} ms (${report.iterations.toLocaleString()} lượt)`;
  if (chiNotice) {
    chiNotice.textContent = `Chi-Square: ${report.chiSquare.statistic} (${report.chiSquare.fitsTheoreticalModel ? 'Phù hợp chuẩn p > 0.05' : 'Lệch'})`;
  }

  // Metric Boxes
  const res = report.results;
  setText('simResTaiPercent', `${res.tai.empiricalPercent}%`);
  setText('simResTaiDiff', `Lệch: ${res.tai.deltaPercent >= 0 ? '+' : ''}${res.tai.deltaPercent}%`);

  setText('simResXiuPercent', `${res.xiu.empiricalPercent}%`);
  setText('simResXiuDiff', `Lệch: ${res.xiu.deltaPercent >= 0 ? '+' : ''}${res.xiu.deltaPercent}%`);

  setText('simResTriplePercent', `${res.triple.empiricalPercent}%`);
  setText('simResTripleDiff', `Lệch: ${res.triple.deltaPercent >= 0 ? '+' : ''}${res.triple.deltaPercent}%`);

  // Render comparative chart
  renderSimulationChart(report);

  // Render Table
  const tbody = document.getElementById('simSumTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    report.sumDistribution.forEach(row => {
      const tr = document.createElement('tr');
      const diffSign = row.diffPercent >= 0 ? '+' : '';
      tr.innerHTML = `
        <td><strong>${row.sum}</strong></td>
        <td>${row.observedCount.toLocaleString()}</td>
        <td>${row.empiricalPercent}%</td>
        <td>${row.theoreticalPercent}%</td>
        <td class="${Math.abs(row.diffPercent) <= 0.1 ? 'text-green' : 'text-gold'}">${diffSign}${row.diffPercent}%</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function renderSimulationChart(report) {
  const container = document.getElementById('simChartContainer');
  if (!container || !report) return;

  const width = container.clientWidth || 390;
  const height = 110;
  const padding = { top: 12, right: 12, bottom: 20, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const categories = [
    { name: 'TÀI', empirical: report.results.tai.empiricalPercent, theo: 48.61, color: '#ef4444' },
    { name: 'XỈU', empirical: report.results.xiu.empiricalPercent, theo: 48.61, color: '#10b981' },
    { name: 'BỘ BA', empirical: report.results.triple.empiricalPercent, theo: 2.78, color: '#a855f7' }
  ];

  let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Draw comparisons as horizontal grouped bars
  const rowHeight = chartH / 3;

  categories.forEach((cat, idx) => {
    const y = padding.top + idx * rowHeight;
    const maxVal = 60; // scale up to 60%

    const wEmp = (cat.empirical / maxVal) * chartW;
    const wTheo = (cat.theo / maxVal) * chartW;

    // Label
    svg += `<text x="${padding.left - 4}" y="${y + rowHeight / 2 + 4}" fill="#f8fafc" font-size="9.5" font-weight="700" text-anchor="end">${cat.name}</text>`;

    // Background track
    svg += `<rect x="${padding.left}" y="${y + 2}" width="${chartW}" height="${rowHeight - 6}" fill="#131722" rx="3" />`;

    // Empirical Bar
    svg += `<rect x="${padding.left}" y="${y + 2}" width="${wEmp}" height="${rowHeight - 6}" fill="${cat.color}" opacity="0.8" rx="3" />`;

    // Theoretical Marker Line
    const markerX = padding.left + wTheo;
    svg += `<line x1="${markerX}" y1="${y}" x2="${markerX}" y2="${y + rowHeight - 2}" stroke="#d4af37" stroke-width="2.5" />`;

    // Value Text
    svg += `<text x="${padding.left + wEmp + 6}" y="${y + rowHeight / 2 + 3}" fill="#cbd5e1" font-size="9" font-weight="600">${cat.empirical}%</text>`;
  });

  svg += `</svg>`;
  container.innerHTML = svg;
}

// ==========================================
// TAB 4: Lịch Sử & CSV Export / Import
// ==========================================
function setupHistoryActions() {
  // Export CSV
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportSessionsToCsv();
    });
  }

  // Import CSV
  const importInput = document.getElementById('importCsvInput');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importSessionsFromCsv(file);
      }
    });
  }

  // Seed Sample Data (50 sessions)
  const seedBtn = document.getElementById('seedSampleDataBtn');
  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      seedSampleSessions(50);
    });
  }

  // Seed Room 3340096 Data from User Screenshots
  const seedRoomBtn = document.getElementById('seedRoomDataBtn');
  if (seedRoomBtn) {
    seedRoomBtn.addEventListener('click', () => {
      seedRoomSessions3340096();
    });
  }

  // Clear All History
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên gieo không?')) {
        state.sessions = [];
        setStoredData({ sessions: [] });
        refreshAllViews();
      }
    });
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  const emptyNotice = document.getElementById('emptyHistoryNotice');
  if (!tbody) return;

  if (state.sessions.length === 0) {
    tbody.innerHTML = '';
    if (emptyNotice) emptyNotice.style.display = 'block';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';
  tbody.innerHTML = '';

  // Render in reverse chronological order (newest first)
  const reversed = [...state.sessions].reverse();

  reversed.forEach((s, idx) => {
    const originalIndex = state.sessions.length - idx;
    const tr = document.createElement('tr');

    const dateStr = new Date(s.timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const diceStr = s.dice ? s.dice.join(' - ') : '-';
    let tagClass = 'tag-xiu';
    let label = 'XỈU';
    if (s.result === 'triple') {
      tagClass = 'tag-triple';
      label = 'BỘ BA';
    } else if (s.result === 'tai') {
      tagClass = 'tag-tai';
      label = 'TÀI';
    }

    tr.innerHTML = `
      <td>${originalIndex}</td>
      <td class="text-xs text-muted">${dateStr}</td>
      <td><strong>${diceStr}</strong></td>
      <td><strong>${s.sum}</strong></td>
      <td><span class="tag-pill ${tagClass}">${label}</span></td>
      <td>
        <button class="btn-del-row" data-id="${s.id}" title="Xóa phiên này">✕</button>
      </td>
    `;

    const delBtn = tr.querySelector('.btn-del-row');
    delBtn.addEventListener('click', () => {
      deleteSession(s.id);
    });

    tbody.appendChild(tr);
  });
}

async function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  await setStoredData({ sessions: state.sessions });
  refreshAllViews();
}

function exportSessionsToCsv() {
  if (state.sessions.length === 0) {
    alert('Chưa có dữ liệu để xuất file CSV.');
    return;
  }

  const headers = ['SessionID', 'Timestamp', 'DateTime', 'Die1', 'Die2', 'Die3', 'Sum', 'Result', 'IsTriple', 'IsDouble'];
  const rows = state.sessions.map((s, idx) => {
    const dt = new Date(s.timestamp).toISOString();
    return [
      idx + 1,
      s.timestamp,
      dt,
      s.dice[0],
      s.dice[1],
      s.dice[2],
      s.sum,
      s.result,
      s.isTriple ? 1 : 0,
      s.isDouble ? 1 : 0
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // add BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `tai_xiu_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importSessionsFromCsv(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        alert('File CSV không hợp lệ hoặc không có dữ liệu.');
        return;
      }

      // Check header or parse lines
      const imported = [];
      const startIndex = lines[0].toLowerCase().includes('die') || lines[0].toLowerCase().includes('sum') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 6) {
          // Look for 3 dice or sum
          let d1 = parseInt(parts[3], 10);
          let d2 = parseInt(parts[4], 10);
          let d3 = parseInt(parts[5], 10);

          if (![d1, d2, d3].every(d => Number.isInteger(d) && d >= 1 && d <= 6)) {
            // Try parts 0, 1, 2
            d1 = parseInt(parts[0], 10);
            d2 = parseInt(parts[1], 10);
            d3 = parseInt(parts[2], 10);
          }

          if ([d1, d2, d3].every(d => Number.isInteger(d) && d >= 1 && d <= 6)) {
            const roll = classifyRoll(d1, d2, d3);
            imported.push({
              id: 'imp_' + Date.now() + '_' + i,
              timestamp: Date.now() - (lines.length - i) * 60000,
              dice: [d1, d2, d3],
              sum: roll.sum,
              result: roll.result,
              isTriple: roll.isTriple,
              isDouble: roll.isDouble
            });
          }
        }
      }

      if (imported.length > 0) {
        state.sessions.push(...imported);
        await setStoredData({ sessions: state.sessions });
        refreshAllViews();
        alert(`Đã nhập thành công ${imported.length} phiên từ file CSV!`);
      } else {
        alert('Không tìm thấy bản ghi hợp lệ trong file CSV.');
      }
    } catch (err) {
      alert('Lỗi đọc file CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function seedSampleSessions(count = 50) {
  const newSessions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const d1 = (Math.random() * 6 | 0) + 1;
    const d2 = (Math.random() * 6 | 0) + 1;
    const d3 = (Math.random() * 6 | 0) + 1;
    const roll = classifyRoll(d1, d2, d3);

    newSessions.push({
      id: 'sample_' + now + '_' + i,
      timestamp: now - (count - i) * 120000, // spaced 2 mins apart
      dice: [d1, d2, d3],
      sum: roll.sum,
      result: roll.result,
      isTriple: roll.isTriple,
      isDouble: roll.isDouble
    });
  }

  state.sessions.push(...newSessions);
  await setStoredData({ sessions: state.sessions });
  refreshAllViews();
}

async function seedRoomSessions3340096() {
  const roomSums = [
    { sum: 8, dice: [1, 3, 4] },
    { sum: 17, dice: [5, 6, 6] },
    { sum: 13, dice: [3, 4, 6] },
    { sum: 16, dice: [4, 6, 6] },
    { sum: 11, dice: [2, 4, 5] },
    { sum: 11, dice: [1, 4, 6] },
    { sum: 11, dice: [3, 3, 5] },
    { sum: 8, dice: [2, 2, 4] },
    { sum: 10, dice: [2, 3, 5] },
    { sum: 14, dice: [3, 5, 6] },
    { sum: 10, dice: [1, 4, 5] },
    { sum: 8, dice: [1, 2, 5] },
    { sum: 9, dice: [2, 3, 4] },
    { sum: 14, dice: [4, 4, 6] },
    { sum: 13, dice: [2, 5, 6] },
    { sum: 8, dice: [1, 3, 4] },
    { sum: 11, dice: [1, 4, 6] },
    { sum: 15, dice: [4, 5, 6] },
    { sum: 8, dice: [2, 3, 3] },
    { sum: 9, dice: [1, 3, 5] },
    { sum: 13, dice: [6, 2, 5], sessionId: '#3340096' }
  ];

  const now = Date.now();
  const newSessions = roomSums.map((item, idx) => {
    const roll = classifyRoll(item.dice[0], item.dice[1], item.dice[2]);
    return {
      id: item.sessionId || ('s_room_' + (3340076 + idx)),
      sessionId: item.sessionId || (`#${3340076 + idx}`),
      timestamp: now - (roomSums.length - idx) * 60000,
      dice: item.dice,
      sum: roll.sum,
      result: roll.result,
      isTriple: roll.isTriple,
      isDouble: roll.isDouble
    };
  });

  state.sessions = newSessions;
  await setStoredData({ sessions: state.sessions });
  refreshAllViews();
}
