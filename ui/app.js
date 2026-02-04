const state = {
  ticker: "",
  features: [],
  alerts: [],
  lastRefresh: null,
};

const els = {
  healthDot: document.getElementById("health-dot"),
  healthText: document.getElementById("health-text"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshLimit: document.getElementById("refresh-limit"),
  tickerInput: document.getElementById("ticker-input"),
  loadFeatures: document.getElementById("load-features"),
  statMid: document.getElementById("stat-mid"),
  statSpread: document.getElementById("stat-spread"),
  statProb: document.getElementById("stat-prob"),
  statVolume: document.getElementById("stat-volume"),
  chart: document.getElementById("feature-chart"),
  alertList: document.getElementById("alert-list"),
  systemEndpoint: document.getElementById("system-endpoint"),
  systemRefresh: document.getElementById("system-refresh"),
  systemAlerts: document.getElementById("system-alerts"),
  systemFeatures: document.getElementById("system-features"),
};

const chartCtx = els.chart.getContext("2d");

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Number(value).toFixed(digits);
}

function setHealth(ok) {
  if (ok) {
    els.healthDot.style.background = "#2dd4bf";
    els.healthDot.style.boxShadow = "0 0 12px rgba(45, 212, 191, 0.8)";
    els.healthText.textContent = "API online";
  } else {
    els.healthDot.style.background = "#ff6b6b";
    els.healthDot.style.boxShadow = "0 0 12px rgba(255, 107, 107, 0.8)";
    els.healthText.textContent = "API offline";
  }
}

async function fetchHealth() {
  try {
    const res = await fetch("/health");
    setHealth(res.ok);
  } catch (err) {
    setHealth(false);
  }
}

async function refreshMarkets() {
  const limit = parseInt(els.refreshLimit.value || "100", 10);
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Refreshing…";
  try {
    await fetch(`/markets/refresh?limit=${limit}`, { method: "POST" });
    state.lastRefresh = new Date();
    updateSystem();
    await loadAlerts();
  } catch (err) {
    console.error(err);
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Refresh Markets";
  }
}

async function loadAlerts() {
  try {
    const res = await fetch("/alerts?limit=50");
    if (!res.ok) return;
    state.alerts = await res.json();
    renderAlerts();
    updateSystem();
  } catch (err) {
    console.error(err);
  }
}

async function loadFeatures() {
  const ticker = els.tickerInput.value.trim();
  if (!ticker) return;
  state.ticker = ticker;
  try {
    const res = await fetch(`/features/${encodeURIComponent(ticker)}?limit=80`);
    if (!res.ok) return;
    state.features = await res.json();
    renderFeatures();
  } catch (err) {
    console.error(err);
  }
}

function renderAlerts() {
  els.alertList.innerHTML = "";
  if (!state.alerts.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No alerts yet. Run a refresh to ingest markets.";
    els.alertList.appendChild(li);
    return;
  }

  state.alerts.forEach((alert) => {
    const li = document.createElement("li");
    const type = document.createElement("div");
    type.className = "type";
    type.textContent = alert.type || "alert";

    const detail = document.createElement("div");
    detail.textContent = alert.details || "";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span>${alert.ticker || "--"}</span><span>${formatNumber(alert.score, 2)}</span>`;

    li.appendChild(type);
    li.appendChild(detail);
    li.appendChild(meta);
    els.alertList.appendChild(li);
  });
}

function renderFeatures() {
  if (!state.features.length) {
    els.statMid.textContent = "--";
    els.statSpread.textContent = "--";
    els.statProb.textContent = "--";
    els.statVolume.textContent = "--";
    drawChart([]);
    return;
  }

  const latest = state.features[0];
  els.statMid.textContent = formatNumber(latest.mid, 2);
  els.statSpread.textContent = formatNumber(latest.spread, 2);
  els.statProb.textContent = formatNumber(latest.prob, 3);
  els.statVolume.textContent = formatNumber(latest.volume, 0);

  const series = state.features.slice().reverse().map((row) => row.mid);
  drawChart(series);
  updateSystem();
}

function drawChart(series) {
  const ctx = chartCtx;
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(13, 18, 28, 0.6)";
  ctx.fillRect(0, 0, width, height);

  if (!series.length) {
    ctx.fillStyle = "#a9b2c0";
    ctx.font = "12px IBM Plex Mono, monospace";
    ctx.fillText("No feature data yet", 20, height / 2);
    return;
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = 12;
  const xStep = (width - pad * 2) / (series.length - 1 || 1);

  ctx.strokeStyle = "rgba(45, 212, 191, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();

  ctx.strokeStyle = "#f5b942";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((value, idx) => {
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const x = pad + idx * xStep;
    const y = height - pad - ratio * (height - pad * 2);
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const last = series[series.length - 1];
  ctx.fillStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(width - pad, height - pad - ((last - min) / (max - min || 1)) * (height - pad * 2), 4, 0, Math.PI * 2);
  ctx.fill();
}

function updateSystem() {
  els.systemEndpoint.textContent = window.location.origin;
  els.systemAlerts.textContent = state.alerts.length;
  els.systemFeatures.textContent = state.features.length;
  els.systemRefresh.textContent = state.lastRefresh
    ? state.lastRefresh.toLocaleTimeString()
    : "--";
}

function init() {
  fetchHealth();
  loadAlerts();
  updateSystem();

  els.refreshBtn.addEventListener("click", refreshMarkets);
  els.loadFeatures.addEventListener("click", loadFeatures);
  els.tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadFeatures();
    }
  });

  setInterval(fetchHealth, 10000);
  setInterval(loadAlerts, 10000);
}

init();
