/* ============================================================
   FlowSense – AI Crowd Intelligence · script.js
   ============================================================ */

// ── Utility ──────────────────────────────────────────────────

/** Returns a random integer between 0 and 100 (inclusive). */
function randomCrowd() {
  return Math.floor(Math.random() * 101);
}

/**
 * Predicts crowd 10 minutes from now.
 * Logic: predicted = current + random(0–20), capped at 100.
 */
function predictCrowd(current) {
  return Math.min(current + Math.floor(Math.random() * 21), 100);
}

/**
 * Returns estimated food wait time in minutes based on crowd level.
 *  crowd > 70  → 20 min
 *  crowd 40-70 → 10 min
 *  crowd < 40  →  5 min
 */
function waitTime(crowd) {
  if (crowd > 70) return 20;
  if (crowd >= 40) return 10;
  return 5;
}

// ── Application State ────────────────────────────────────────
//
// AppState is the single source of truth for all venue data.
// Each item has:
//   id        – stable DOM identifier
//   name      – display label
//   crowd     – current crowd percentage (0–100)
//   predicted – predicted crowd in 10 minutes (0–100)
//

const AppState = {
  gates: [
    { id: 'gate-1', name: 'Gate 1', crowd: randomCrowd() },
    { id: 'gate-2', name: 'Gate 2', crowd: randomCrowd() },
    { id: 'gate-3', name: 'Gate 3', crowd: randomCrowd() },
  ],
  food: [
    { id: 'food-pizza',   name: 'Pizza',   crowd: randomCrowd() },
    { id: 'food-burgers', name: 'Burgers', crowd: randomCrowd() },
    { id: 'food-drinks',  name: 'Drinks',  crowd: randomCrowd() },
  ],
  wash: [
    { id: 'wash-a', name: 'Block A', crowd: randomCrowd() },
    { id: 'wash-b', name: 'Block B', crowd: randomCrowd() },
  ],
};

// Compute initial predicted values for all items
getAllItems_init();
function getAllItems_init() {
  const all = [...AppState.gates, ...AppState.food, ...AppState.wash];
  all.forEach(item => { item.predicted = predictCrowd(item.crowd); });
}

/**
 * Re-randomize crowd and recompute predicted values.
 * Called on every manual refresh and every 5-second auto-update.
 * NOTE: does NOT reset active food orders — they continue ticking.
 */
function resetState() {
  const allItems = getAllItems();
  allItems.forEach(item => {
    item.crowd     = randomCrowd();
    item.predicted = predictCrowd(item.crowd);
  });
}

/** Flat array of every venue item across all categories. */
function getAllItems() {
  return [...AppState.gates, ...AppState.food, ...AppState.wash];
}

// ── Orders State ─────────────────────────────────────────────
// Tracks active food orders.  Key = item.id, value = { timerId, secondsLeft }.
const Orders = {};

// ── Trend History ────────────────────────────────────────────
// Stores the last 5 crowd readings for each gate, with timestamps.
// Structure: { 'gate-1': [{ time: Date, crowd: Number }, …], … }

const TREND_MAX_POINTS = 5;
const TrendHistory = {};

// Gate line colours — harmonious palette
const GATE_COLORS = {
  'gate-1': { line: '#a78bfa', dot: '#c4b5fd', label: 'Gate 1' },   // purple-light
  'gate-2': { line: '#67e8f9', dot: '#a5f3fc', label: 'Gate 2' },   // cyan-light
  'gate-3': { line: '#6ee7b7', dot: '#a7f3d0', label: 'Gate 3' },   // green-light
};

/** Push current gate crowd values into TrendHistory. */
function pushTrendData() {
  const now = new Date();
  AppState.gates.forEach(gate => {
    if (!TrendHistory[gate.id]) TrendHistory[gate.id] = [];
    TrendHistory[gate.id].push({ time: now, crowd: gate.crowd });
    // Keep only last N points
    if (TrendHistory[gate.id].length > TREND_MAX_POINTS) {
      TrendHistory[gate.id].shift();
    }
  });
}

/** Draw the trend line chart on the canvas. Pure Canvas 2D — no libraries. */
function drawTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // High-DPI support
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;

  // Chart padding
  const pad = { top: 20, right: 20, bottom: 34, left: 42 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // ── Y-axis grid & labels (0, 25, 50, 75, 100) ──
  const yTicks = [0, 25, 50, 75, 100];
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '500 11px Inter, system-ui, sans-serif';

  yTicks.forEach(val => {
    const y = pad.top + chartH - (val / 100) * chartH;
    // Grid line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    // Label
    ctx.fillStyle = '#475569';
    ctx.fillText(val + '%', pad.left - 8, y);
  });

  // Determine the max number of points across all gates
  const gateIds = Object.keys(GATE_COLORS);
  let maxPts = 0;
  gateIds.forEach(id => {
    const pts = TrendHistory[id] || [];
    if (pts.length > maxPts) maxPts = pts.length;
  });

  // Update point counter in the section header
  const counter = document.getElementById('chartPointCount');
  if (counter) counter.textContent = `${maxPts} / ${TREND_MAX_POINTS} points`;

  if (maxPts < 1) {
    // No data yet — show placeholder text
    ctx.fillStyle = '#475569';
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for data…', W / 2, H / 2);
    return;
  }

  // ── X-axis labels (timestamps) ──
  // Use the longest gate history for time labels
  let longestHistory = [];
  gateIds.forEach(id => {
    const pts = TrendHistory[id] || [];
    if (pts.length > longestHistory.length) longestHistory = pts;
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '500 10px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#475569';

  longestHistory.forEach((pt, i) => {
    const x = maxPts === 1
      ? pad.left + chartW / 2
      : pad.left + (i / (maxPts - 1)) * chartW;
    const label = pt.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    ctx.fillText(label, x, pad.top + chartH + 10);
  });

  // ── Draw lines for each gate ──
  gateIds.forEach(gateId => {
    const pts = TrendHistory[gateId] || [];
    if (pts.length < 1) return;

    const color = GATE_COLORS[gateId];

    // Build coordinate array
    const coords = pts.map((pt, i) => ({
      x: maxPts === 1
        ? pad.left + chartW / 2
        : pad.left + (i / (maxPts - 1)) * chartW,
      y: pad.top + chartH - (pt.crowd / 100) * chartH,
    }));

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, color.line + '18');  // ~10% opacity at top
    gradient.addColorStop(1, color.line + '00');  // transparent at bottom

    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      // Smooth curve using quadratic bezier
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpx  = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cpx, (prev.y + curr.y) / 2);
    }
    // Finish the line to last point
    const last = coords[coords.length - 1];
    ctx.lineTo(last.x, last.y);

    // Stroke the line
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Fill area under the curve
    ctx.lineTo(last.x, pad.top + chartH);
    ctx.lineTo(coords[0].x, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw data-point dots
    coords.forEach((c, i) => {
      // Outer glow
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color.line + '30';
      ctx.fill();
      // Inner dot
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color.dot;
      ctx.fill();
      // White core on latest point
      if (i === coords.length - 1) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    });
  });

  // ── Legend ──
  const legendEl = document.getElementById('chartLegend');
  if (legendEl && !legendEl.dataset.built) {
    legendEl.innerHTML = '';
    gateIds.forEach(id => {
      const c = GATE_COLORS[id];
      const pill = document.createElement('span');
      pill.className = 'legend-pill';
      pill.innerHTML = `<span class="legend-dot" style="background:${c.line};box-shadow:0 0 6px ${c.line}"></span>${c.label}`;
      legendEl.appendChild(pill);
    });
    legendEl.dataset.built = '1';
  }
}

// ── Gamification State ───────────────────────────────────────
// Score persists across page reloads via localStorage.

const Gamification = {
  score: parseInt(localStorage.getItem('flowsense_score') || '0', 10),
  lastRewardTime: 0,   // Prevents reward spam (cooldown)
  COOLDOWN_MS: 2000,   // Min 2 seconds between rewards
};

/** Save score to localStorage and update the dashboard counter. */
function syncScore() {
  localStorage.setItem('flowsense_score', Gamification.score);
  animateNumber('scoreCount', Gamification.score);
}

/** Show a floating toast notification when points are awarded. */
function showRewardToast(message, points) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'reward-toast';
  toast.innerHTML = `
    <span class="toast-sparkle">✨</span>
    <div class="toast-body">
      <span class="toast-msg">${message}</span>
      <span class="toast-points">+${points} points</span>
    </div>
  `;
  container.appendChild(toast);

  // Auto-remove after animation
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

/**
 * Called when a user clicks "Select" on a recommendation card.
 * Awards +10 points if they chose the least-crowded (best) option
 * for that category. Also awards +5 for a non-optimal but still
 * reasonable choice (crowd ≤ 40).
 */
function selectRecommendation(category, itemId) {
  const now = Date.now();
  if (now - Gamification.lastRewardTime < Gamification.COOLDOWN_MS) return;
  Gamification.lastRewardTime = now;

  // Determine the best item in the category
  let best, items;
  if (category === 'gate')      { best = findBestGate();     items = AppState.gates; }
  else if (category === 'wash') { best = findBestWashroom();  items = AppState.wash;  }
  else if (category === 'food') { best = findBestFood();      items = AppState.food;  }
  else return;

  const selected = items.find(i => i.id === itemId);
  if (!selected) return;

  if (selected.id === best.id) {
    // Best choice! Full reward.
    Gamification.score += 10;
    syncScore();
    showRewardToast('You avoided congestion!', 10);
  } else if (selected.crowd <= 40) {
    // Still a good pick
    Gamification.score += 5;
    syncScore();
    showRewardToast('Good choice — low crowd area!', 5);
  } else {
    // Not optimal — no points but friendly nudge
    showRewardToast(`Tip: ${best.name} has lower crowd (${best.crowd}%)`, 0);
  }
}


// ── Status Helpers ───────────────────────────────────────────

// ── Crowd Level Classification ────────────────────────────────
//  Range       Level    Color
//  0  – 40  →  Low      Green  (#10b981)
//  41 – 70  →  Medium   Orange (#f59e0b)
//  71 – 100 →  High     Red    (#ef4444)

function getStatus(crowd) {
  if (crowd <= 40) return { key: 'low',  label: 'Low',    cls: 'low',  range: '0–40',   color: '#10b981' };
  if (crowd <= 70) return { key: 'med',  label: 'Medium', cls: 'med',  range: '41–70',  color: '#f59e0b' };
  return                  { key: 'high', label: 'High',   cls: 'high', range: '71–100', color: '#ef4444' };
}

// ── Card Builder ─────────────────────────────────────────────

function buildCard(item) {
  const status    = getStatus(item.crowd);
  const predicted = item.predicted ?? predictCrowd(item.crowd);
  const isHot     = predicted > 80;
  const isFood    = item.id.startsWith('food-');
  const wait      = isFood ? waitTime(item.crowd) : 0;

  const card = document.createElement('div');
  card.className = `crowd-card status-${status.key}`;
  card.id = item.id;
  card.innerHTML = `
    <div class="card-top">
      <div class="card-name-block">
        <div class="card-name">${item.name}</div>
        <div class="card-status-row">
          <span class="crowd-indicator ${status.cls}"></span>
          <span class="status-label ${status.cls}">${status.label}</span>
          <span class="status-range">${status.range}</span>
        </div>
        <div class="card-id-label">ID: ${item.id}</div>
      </div>
      <span class="status-chip ${status.cls}">${status.label}</span>
    </div>
    <div class="progress-wrap">
      <div class="progress-bar-bg">
        <div class="progress-bar-fill fill-${status.cls}" style="width: 0%"></div>
      </div>
    </div>
    <div class="card-footer">
      <span class="crowd-pct ${status.cls}">
        <span class="pct-num">${item.crowd}</span><span class="pct-unit">%</span>
      </span>
      <div class="capacity-label">Crowd Level<br><strong>${capacityText(item.crowd)}</strong></div>
    </div>
    <div class="card-predict ${isHot ? 'predict-danger' : ''}">
      <div class="predict-left">
        <svg class="predict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        <span class="predict-label">Predicted in 10 min</span>
      </div>
      <div class="predict-right">
        ${isHot ? `<svg class="predict-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` : ''}
        <span class="predict-value ${isHot ? 'hot' : ''}">${predicted}%</span>
      </div>
    </div>
    ${isFood ? `
    <div class="order-section" id="order-${item.id}">
      <div class="order-wait-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="order-clock-icon">
          <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
        </svg>
        <span class="order-wait-label">Est. wait: <strong class="order-wait-val" data-id="${item.id}">${wait} min</strong></span>
      </div>
      <button class="order-btn" id="order-btn-${item.id}" onclick="orderFood('${item.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        Order Now
      </button>
      <div class="order-confirm" id="order-confirm-${item.id}" style="display:none">
        <div class="order-confirm-top">
          <span class="order-confirm-icon">✅</span>
          <span class="order-confirm-msg">Order placed! Collect in <strong class="order-countdown" id="order-cd-${item.id}">${wait}:00</strong></span>
        </div>
        <div class="order-progress-bg"><div class="order-progress-fill" id="order-prog-${item.id}"></div></div>
        <button class="order-cancel-btn" onclick="cancelOrder('${item.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Cancel Order
        </button>
      </div>
    </div>
    ` : ''}
  `;
  // Animate progress bar after paint
  requestAnimationFrame(() => {
    card.querySelector('.progress-bar-fill').style.width = item.crowd + '%';
  });
  return card;
}

function capacityText(crowd) {
  if (crowd <= 40)  return 'Comfortable';
  if (crowd <= 70)  return 'Moderate';
  if (crowd <= 85)  return 'Crowded';
  return 'Overcrowded';
}

// ── Update Card (for refresh) ────────────────────────────────

function updateCard(item) {
  const card = document.getElementById(item.id);
  if (!card) return;
  const status    = getStatus(item.crowd);
  const predicted = item.predicted ?? predictCrowd(item.crowd);
  const isHot     = predicted > 80;

  // Update card-level status class (drives left-border color)
  card.className = `crowd-card status-${status.key}`;

  // Update color indicator badge
  const indicator = card.querySelector('.crowd-indicator');
  if (indicator) indicator.className = `crowd-indicator ${status.cls}`;

  // Update inline status label + range next to badge
  const statusLabel = card.querySelector('.status-label');
  if (statusLabel) { statusLabel.className = `status-label ${status.cls}`; statusLabel.textContent = status.label; }
  const statusRange = card.querySelector('.status-range');
  if (statusRange) statusRange.textContent = status.range;

  // Update text chip (top-right)
  card.querySelector('.status-chip').className = `status-chip ${status.cls}`;
  card.querySelector('.status-chip').textContent = status.label;

  // Update progress bar
  const fill = card.querySelector('.progress-bar-fill');
  fill.className = `progress-bar-fill fill-${status.cls}`;
  fill.style.width = item.crowd + '%';

  // Update percentage display
  const pct = card.querySelector('.crowd-pct');
  pct.className = `crowd-pct ${status.cls}`;
  pct.innerHTML = `<span class="pct-num">${item.crowd}</span><span class="pct-unit">%</span>`;

  // Update capacity label
  card.querySelector('.capacity-label strong').textContent = capacityText(item.crowd);

  // Update prediction row
  const predictRow = card.querySelector('.card-predict');
  if (predictRow) {
    predictRow.className = `card-predict ${isHot ? 'predict-danger' : ''}`;
    const pVal = predictRow.querySelector('.predict-value');
    if (pVal) { pVal.textContent = predicted + '%'; pVal.className = `predict-value ${isHot ? 'hot' : ''}`; }
    // Toggle warning icon
    const existingWarn = predictRow.querySelector('.predict-warn-icon');
    if (isHot && !existingWarn) {
      const warnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      warnSvg.setAttribute('class', 'predict-warn-icon');
      warnSvg.setAttribute('viewBox', '0 0 24 24');
      warnSvg.setAttribute('fill', 'none');
      warnSvg.setAttribute('stroke', 'currentColor');
      warnSvg.setAttribute('stroke-width', '2');
      warnSvg.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
      predictRow.querySelector('.predict-right').prepend(warnSvg);
    } else if (!isHot && existingWarn) {
      existingWarn.remove();
    }
  }

  // Update food wait time label (only if no active order is running)
  if (item.id.startsWith('food-') && !Orders[item.id]) {
    const waitVal = card.querySelector(`.order-wait-val[data-id="${item.id}"]`);
    if (waitVal) waitVal.textContent = waitTime(item.crowd) + ' min';
  }
}

// ── Food Ordering ─────────────────────────────────────────────

/**
 * Called when user clicks "Order Now" on a food card.
 * Shows the confirmation panel and starts a live countdown timer.
 */
function orderFood(id) {
  const item = AppState.food.find(f => f.id === id);
  if (!item) return;

  // If an order is already active, ignore
  if (Orders[id]) return;

  const totalSecs = waitTime(item.crowd) * 60;
  Orders[id] = { secondsLeft: totalSecs, totalSecs };

  // Swap UI: hide button section, show confirmation
  const btn     = document.getElementById(`order-btn-${id}`);
  const confirm = document.getElementById(`order-confirm-${id}`);
  if (btn)     btn.style.display     = 'none';
  if (confirm) confirm.style.display = 'flex';

  // Start countdown tick
  Orders[id].timerId = setInterval(() => {
    Orders[id].secondsLeft--;
    const s = Orders[id].secondsLeft;
    const pct = ((Orders[id].totalSecs - s) / Orders[id].totalSecs) * 100;

    // Update MM:SS display
    const cd = document.getElementById(`order-cd-${id}`);
    if (cd) cd.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Update progress bar
    const prog = document.getElementById(`order-prog-${id}`);
    if (prog) prog.style.width = pct + '%';

    // Done!
    if (s <= 0) {
      clearInterval(Orders[id].timerId);
      delete Orders[id];
      completeOrder(id);
    }
  }, 1000);
}

/** Shows a "Ready to collect!" state when countdown reaches 0. */
function completeOrder(id) {
  const confirm = document.getElementById(`order-confirm-${id}`);
  if (!confirm) return;
  confirm.classList.add('order-done');
  const msg = confirm.querySelector('.order-confirm-msg');
  if (msg) msg.innerHTML = '<strong>🎉 Ready! Head to the stall to collect.</strong>';
  const prog = document.getElementById(`order-prog-${id}`);
  if (prog) prog.style.width = '100%';
  // Auto-reset card after 5 seconds
  setTimeout(() => cancelOrder(id, true), 5000);
}

/** Cancels an active order and resets the card to its default state. */
function cancelOrder(id, silent = false) {
  if (Orders[id]) {
    clearInterval(Orders[id].timerId);
    delete Orders[id];
  }
  const btn     = document.getElementById(`order-btn-${id}`);
  const confirm = document.getElementById(`order-confirm-${id}`);
  const prog    = document.getElementById(`order-prog-${id}`);
  if (confirm) {
    confirm.style.display = 'none';
    confirm.classList.remove('order-done');
  }
  if (prog)    prog.style.width = '0%';
  if (btn)     btn.style.display = 'flex';
  // Refresh wait label to latest crowd value
  const item = AppState.food.find(f => f.id === id);
  if (item) {
    const waitVal = document.querySelector(`.order-wait-val[data-id="${id}"]`);
    if (waitVal) waitVal.textContent = waitTime(item.crowd) + ' min';
  }
}

// ── Rendering ────────────────────────────────────────────────

function renderAll() {
  renderGrid('gatesGrid',    AppState.gates);
  renderGrid('foodGrid',     AppState.food);
  renderGrid('washroomGrid', AppState.wash);
  updateStats();
  updateRecommendations();
  updateAlerts();

  // Push initial gate data into trend history & draw chart
  pushTrendData();
  drawTrendChart();
}

function renderGrid(gridId, items) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  items.forEach(item => grid.appendChild(buildCard(item)));
}

// ── Stats Bar ────────────────────────────────────────────────

function updateStats() {
  const all = getAllItems();
  let low = 0, med = 0, high = 0;
  all.forEach(item => {
    const s = getStatus(item.crowd).key;
    if (s === 'low')  low++;
    if (s === 'med')  med++;
    if (s === 'high') high++;
  });
  animateNumber('lowCount',  low);
  animateNumber('medCount',  med);
  animateNumber('highCount', high);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.round(start + (target - start) * t);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Recommendation Finders ───────────────────────────────────
// Each finder returns the single item with the lowest crowd value
// from its category — the definitive "best" option right now.

function findBestGate() {
  return AppState.gates.reduce((best, g) => g.crowd < best.crowd ? g : best);
}

function findBestWashroom() {
  return AppState.wash.reduce((best, w) => w.crowd < best.crowd ? w : best);
}

function findBestFood() {
  return AppState.food.reduce((best, f) => f.crowd < best.crowd ? f : best);
}

// ── AI Confidence Score ───────────────────────────────────────
// Score = 100 - crowd  (lower crowd → higher AI confidence).
// Range: 0 (fully packed) → 100 (completely empty / optimal).

/** Returns the AI confidence score for a given crowd value. */
function aiScore(crowd) {
  return 100 - crowd;
}

/** Returns a human-readable tier label for the score. */
function scoreLabel(score) {
  if (score >= 80) return 'Optimal';
  if (score >= 55) return 'Good';
  if (score >= 30) return 'Fair';
  return 'Poor';
}

/** CSS class name for the score value colour. */
function scoreClass(score) {
  if (score >= 80) return 'score-optimal';
  if (score >= 55) return 'score-good';
  if (score >= 30) return 'score-fair';
  return 'score-poor';
}

// ── Recommendations ──────────────────────────────────────────
// Renders three pinned PRIMARY cards (always shown) followed by
// contextual SECONDARY tips derived from the live AppState.

function updateRecommendations() {
  const bestGate = findBestGate();
  const bestWash = findBestWashroom();
  const bestFood = findBestFood();

  // ── Primary recommendations (always 3) ──
  const primary = [
    {
      icon:       '🚪',
      headline:   `Use ${bestGate.name}`,
      sub:        'Lowest crowd at entry',
      crowd:      bestGate.crowd,
      cls:        getStatus(bestGate.crowd).cls,
      tag:        'Gate Recommendation',
      score:      aiScore(bestGate.crowd),
      scoreCls:   scoreClass(aiScore(bestGate.crowd)),
      scoreTier:  scoreLabel(aiScore(bestGate.crowd)),
      category:   'gate',
      itemId:     bestGate.id,
    },
    {
      icon:       '🚻',
      headline:   `Best washroom: ${bestWash.name}`,
      sub:        'Least occupied right now',
      crowd:      bestWash.crowd,
      cls:        getStatus(bestWash.crowd).cls,
      tag:        'Washroom Recommendation',
      score:      aiScore(bestWash.crowd),
      scoreCls:   scoreClass(aiScore(bestWash.crowd)),
      scoreTier:  scoreLabel(aiScore(bestWash.crowd)),
      category:   'wash',
      itemId:     bestWash.id,
    },
    {
      icon:       '🍽️',
      headline:   `Fastest food: ${bestFood.name} stall`,
      sub:        'Shortest wait time',
      crowd:      bestFood.crowd,
      cls:        getStatus(bestFood.crowd).cls,
      tag:        'Food Recommendation',
      score:      aiScore(bestFood.crowd),
      scoreCls:   scoreClass(aiScore(bestFood.crowd)),
      scoreTier:  scoreLabel(aiScore(bestFood.crowd)),
      category:   'food',
      itemId:     bestFood.id,
    },
  ];

  // ── Secondary contextual tips ──
  const secondary = [];

  // Gate load-balancing tip
  const highGates = AppState.gates.filter(g => getStatus(g.crowd).key === 'high');
  if (highGates.length > 0) {
    secondary.push({
      type: 'warn',
      text: `🚦 ${highGates.map(g => g.name).join(', ')} ${highGates.length > 1 ? 'are' : 'is'} overcrowded — redirect to ${bestGate.name}.`,
    });
  }

  // Multiple low food stalls
  const lowFood = AppState.food.filter(f => getStatus(f.crowd).key === 'low');
  if (lowFood.length > 1) {
    secondary.push({
      type: 'ok',
      text: `✅ ${lowFood.map(f => f.name).join(' & ')} both have short queues — either is a good pick.`,
    });
  }

  // All washrooms clear
  const allWashClear = AppState.wash.every(w => getStatus(w.crowd).key === 'low');
  if (allWashClear) {
    secondary.push({ type: 'ok', text: '✅ All washroom blocks are clear — no wait expected.' });
  }

  // General all-clear
  const allItems = getAllItems();
  const anyHigh  = allItems.some(i => getStatus(i.crowd).key === 'high');
  if (!anyHigh && !secondary.length) {
    secondary.push({ type: 'ok', text: '✅ All areas operating smoothly. Enjoy the event!' });
  }

  // ── Render ──
  const list = document.getElementById('recoList');
  list.innerHTML = '';

  // Primary cards
  primary.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'reco-card';
    li.style.animationDelay = (i * 0.07) + 's';
    // Radial arc: stroke-dasharray drives the filled arc (circumference = 2π×16 ≈ 100.5)
    const circ  = 100.53;
    const filled = (r.score / 100) * circ;
    li.innerHTML = `
      <div class="reco-card-left">
        <span class="reco-icon-badge">${r.icon}</span>
      </div>
      <div class="reco-card-body">
        <span class="reco-tag">${r.tag}</span>
        <span class="reco-headline">${r.headline}</span>
        <span class="reco-sub">${r.sub}</span>
        <span class="reco-score-line">
          <span class="reco-score-dot ${r.scoreCls}"></span>
          <span class="reco-score-text">AI Confidence: <strong class="${r.scoreCls}">${r.score}% ${r.scoreTier}</strong></span>
        </span>
      </div>
      <div class="reco-card-right">
        <div class="score-arc-wrap">
          <svg class="score-arc" viewBox="0 0 40 40">
            <circle class="score-arc-bg"  cx="20" cy="20" r="16" fill="none" stroke-width="3.5"/>
            <circle class="score-arc-fill ${r.scoreCls}" cx="20" cy="20" r="16" fill="none"
              stroke-width="3.5"
              stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}"
              stroke-linecap="round"
              transform="rotate(-90 20 20)"/>
          </svg>
          <span class="score-arc-num ${r.scoreCls}">${r.score}</span>
        </div>
        <button class="reco-select-btn" onclick="selectRecommendation('${r.category}', '${r.itemId}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>
          Select
        </button>
      </div>
    `;
    list.appendChild(li);
  });

  // Divider
  if (secondary.length) {
    const divider = document.createElement('li');
    divider.className = 'reco-divider';
    divider.innerHTML = '<span>Additional Insights</span>';
    list.appendChild(divider);
  }

  // Secondary tips
  secondary.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'reco-item';
    li.style.animationDelay = ((primary.length + i) * 0.07) + 's';
    li.innerHTML = `<span class="reco-dot ${r.type}"></span><span>${r.text}</span>`;
    list.appendChild(li);
  });
}


// ── Alerts ───────────────────────────────────────────────────
//
// Alert engine:
//   CRITICAL  → crowd > 80
//   WARNING   → crowd 65–80
//   Contextual messages per venue type (gate / food / washroom)
//   Persistent history across refreshes; manually dismissable.

/** Stable alert history so dismissed alerts don't resurface this session. */
const AlertHistory = {
  dismissed: new Set(),   // Set of alert keys dismissed by user
  seen:      {},          // key → { firstSeen: Date, count: Number }
};

/**
 * Build a human-readable contextual alert message based on the
 * venue type and crowd level.
 */
function buildAlertMessage(item) {
  const crowd = item.crowd;
  const isCritical = crowd > 80;

  if (item.id.startsWith('gate-')) {
    if (isCritical) return `${item.name} is heavily crowded — redirect attendees immediately`;
    return `${item.name} crowd is building up — consider opening overflow lanes`;
  }
  if (item.id.startsWith('food-')) {
    const stallName = item.name;
    if (isCritical) return `${stallName} stall has a high wait time — queue exceeds safe capacity`;
    return `${stallName} stall is getting busy — wait times increasing`;
  }
  if (item.id.startsWith('wash-')) {
    const blockName = item.name;
    if (isCritical) return `${blockName} washroom is overcrowded — direct guests to alternate block`;
    return `${blockName} washroom getting busy — occupancy approaching limit`;
  }
  // Fallback
  return isCritical
    ? `${item.name} has exceeded safe crowd threshold (${crowd}%)`
    : `${item.name} is approaching crowd limit (${crowd}%)`;
}

/** Returns the icon SVG for the given alert level. */
function alertIcon(level) {
  if (level === 'critical') return `
    <svg class="alert-type-icon critical" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
  return `
    <svg class="alert-type-icon warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`;
}

/** Returns a venue-type emoji for the alert. */
function venueEmoji(id) {
  if (id.startsWith('gate-'))  return '🚪';
  if (id.startsWith('food-'))  return '🍔';
  if (id.startsWith('wash-'))  return '🚻';
  return '📍';
}

function updateAlerts() {
  const all = getAllItems();
  const activeAlerts = [];

  all.forEach(item => {
    const crowd = item.crowd;
    if (crowd <= 64) return;                    // Below warning threshold

    const level = crowd > 80 ? 'critical' : 'warn';
    const key   = `${item.id}::${level}`;

    // Track first-seen time
    if (!AlertHistory.seen[key]) {
      AlertHistory.seen[key] = { firstSeen: new Date(), count: 0 };
    }
    AlertHistory.seen[key].count++;

    if (!AlertHistory.dismissed.has(key)) {
      activeAlerts.push({ item, level, key, crowd });
    }
  });

  // Clean up stale dismissed entries whose item is now below threshold
  AlertHistory.dismissed.forEach(key => {
    const item = getAllItems().find(i => key.startsWith(i.id));
    if (!item || item.crowd <= 64) AlertHistory.dismissed.delete(key);
  });

  // ── Update badge ──
  const badge = document.getElementById('alertBadge');
  const critCount = activeAlerts.filter(a => a.level === 'critical').length;
  badge.textContent = activeAlerts.length;

  if (activeAlerts.length === 0) {
    badge.classList.remove('badge-pulse');
    badge.style.background = 'var(--text-muted)';
    badge.style.boxShadow  = 'none';
  } else if (critCount > 0) {
    badge.classList.add('badge-pulse');
    badge.style.background = 'var(--red)';
    badge.style.boxShadow  = '0 0 12px rgba(239,68,68,0.7)';
  } else {
    badge.classList.remove('badge-pulse');
    badge.style.background = 'var(--orange)';
    badge.style.boxShadow  = '0 0 10px rgba(245,158,11,0.5)';
  }

  // ── Render alert list ──
  const list = document.getElementById('alertList');

  // Remove alerts that are no longer active (smooth fade-out)
  list.querySelectorAll('.alert-item[data-key]').forEach(el => {
    const key = el.dataset.key;
    const still = activeAlerts.find(a => a.key === key);
    if (!still) {
      el.classList.add('alert-exit');
      setTimeout(() => el.remove(), 350);
    }
  });

  if (!activeAlerts.length) {
    setTimeout(() => {
      if (!list.querySelector('.alert-item[data-key]')) {
        list.innerHTML = `
          <div class="no-alerts" id="alertsClear">
            <div class="no-alerts-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            </div>
            <span>All clear — no active alerts</span>
          </div>`;
      }
    }, 380);
    return;
  }

  // Remove the all-clear message if present
  const clear = document.getElementById('alertsClear');
  if (clear) clear.remove();

  // Add new alerts not yet in the DOM
  activeAlerts.forEach((alert, i) => {
    if (list.querySelector(`[data-key="${alert.key}"]`)) return;  // already rendered

    const info    = AlertHistory.seen[alert.key];
    const isCritical = alert.level === 'critical';
    const msg        = buildAlertMessage(alert.item);
    const emoji      = venueEmoji(alert.item.id);

    const div = document.createElement('div');
    div.className    = `alert-item ${isCritical ? '' : 'warn'}`;
    div.dataset.key  = alert.key;
    div.style.animationDelay = (i * 0.06) + 's';

    div.innerHTML = `
      <div class="alert-item-left">
        ${alertIcon(alert.level)}
      </div>
      <div class="alert-item-body">
        <div class="alert-item-top">
          <span class="alert-venue-emoji">${emoji}</span>
          <span class="alert-msg">${msg}</span>
        </div>
        <div class="alert-item-meta">
          <span class="alert-crowd-pill ${isCritical ? 'crit' : 'wrn'}">${alert.crowd}% crowd</span>
          <span class="alert-time-stamp" id="age-${alert.key.replace('::', '-')}">Just now</span>
        </div>
      </div>
      <button class="alert-dismiss-btn" title="Dismiss alert"
        onclick="dismissAlert('${alert.key}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    list.appendChild(div);
  });
}

// ── Simulate Real-Time Crowd Update ─────────────────────────
//
// simulateCrowdUpdate() is the single function responsible for
// all data mutations + UI flushes. It:
//  1. Re-randomizes every item's crowd value (0–100)
//  2. Instantly updates all cards in-place (no re-render)
//  3. Refreshes stats bar, recommendations, and alerts
//  4. Stamps the "last updated" time in the header
// It is called both by the button (with spinner) and by the
// 5-second auto-update interval (silently).

function simulateCrowdUpdate() {
  // 1. Randomize all crowd values immediately
  resetState();

  // 2. Update every card in-place (instant DOM patch)
  getAllItems().forEach(item => updateCard(item));

  // 3. Refresh derived UI panels
  updateStats();
  updateRecommendations();
  updateAlerts();

  // 4. Push new gate data into trend & redraw chart
  pushTrendData();
  drawTrendChart();

  // 5. Stamp last-updated time
  const ts = document.getElementById('lastUpdated');
  if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString();

  // 6. Reset the 5-second countdown
  resetCountdown();
}

/** Dismiss an alert by key and remove it from the DOM. */
function dismissAlert(key) {
  AlertHistory.dismissed.add(key);
  const list = document.getElementById('alertList');
  const el = list ? list.querySelector(`[data-key="${key}"]`) : null;
  if (el) {
    el.classList.add('alert-exit');
    setTimeout(() => el.remove(), 350);
  }
  // Re-run alert UI to update badge count & possibly show all-clear
  setTimeout(() => updateAlerts(), 400);
}

// ── Refresh Button Handler ────────────────────────────────────

function refreshData() {
  const btn = document.getElementById('refreshBtn');

  // Spin icon for tactile feedback
  btn.classList.add('spinning');
  btn.disabled = true;

  // Data + UI update happens immediately — no artificial delay
  simulateCrowdUpdate();

  // Remove spinner after animation completes
  setTimeout(() => {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }, 600);
}

// ── Clock ────────────────────────────────────────────────────

function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// ── Particles ────────────────────────────────────────────────

function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['rgba(124,58,237,0.5)', 'rgba(6,182,212,0.4)', 'rgba(167,139,250,0.4)', 'rgba(103,232,249,0.35)'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1.5;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 18 + 12}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(p);
  }
}

// ── Auto-Update every 5 seconds ─────────────────────────────
// Uses simulateCrowdUpdate() directly so no button spinner fires.

const AUTO_INTERVAL_MS = 5000;
let autoTimer = null;
let countdownValue = AUTO_INTERVAL_MS / 1000;

function resetCountdown() {
  countdownValue = AUTO_INTERVAL_MS / 1000;
}

function tickCountdown() {
  const el = document.getElementById('autoCountdown');
  if (!el) return;
  countdownValue = Math.max(0, countdownValue - 1);
  el.textContent = `Auto-refresh in ${countdownValue}s`;
}

function startAutoUpdate() {
  // Tick the countdown every second
  setInterval(tickCountdown, 1000);
  // Fire the full update every 5 seconds
  autoTimer = setInterval(simulateCrowdUpdate, AUTO_INTERVAL_MS);
}

// ── Init ─────────────────────────────────────────────────────
spawnParticles();
renderAll();
startAutoUpdate();

// Hydrate the score counter from localStorage on first load
syncScore();

// Redraw chart on window resize for responsiveness
window.addEventListener('resize', drawTrendChart);
fetch("https://flowsense-backend-1086829896855.asia-south1.run.app/data")
  .then(res => res.json())
  .then(data => {
    console.log("Backend data:", data);

    // Example: show in UI
    document.body.innerHTML += `<h2>Crowd: ${data.crowd}</h2>`;
  })
  .catch(err => console.error(err));