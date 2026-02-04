const state = {
  ticker: "",
  features: [],
  alerts: [],
  markets: [],
  lastRefresh: null,
  lastMarketLoad: null,
  autoRefresh: true,
  intervalId: null,
};

const els = {
  healthDot: document.getElementById("health-dot"),
  healthText: document.getElementById("health-text"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshLimit: document.getElementById("refresh-limit"),
  autoRefresh: document.getElementById("auto-refresh"),
  liveText: document.getElementById("live-text"),
  tickerInput: document.getElementById("ticker-input"),
  loadFeatures: document.getElementById("load-features"),
  statMid: document.getElementById("stat-mid"),
  statSpread: document.getElementById("stat-spread"),
  statProb: document.getElementById("stat-prob"),
  statVolume: document.getElementById("stat-volume"),
  chart: document.getElementById("feature-chart"),
  depthChart: document.getElementById("depth-chart"),
  alertList: document.getElementById("alert-list"),
  marketSearch: document.getElementById("market-search"),
  marketSearchBtn: document.getElementById("market-search-btn"),
  marketList: document.getElementById("market-list"),
  marketCount: document.getElementById("market-count"),
  marketUpdated: document.getElementById("market-updated"),
  systemEndpoint: document.getElementById("system-endpoint"),
  systemRefresh: document.getElementById("system-refresh"),
  systemAlerts: document.getElementById("system-alerts"),
  systemFeatures: document.getElementById("system-features"),
  systemNote: document.getElementById("system-note"),
};

const chartCtx = els.chart.getContext("2d");
const depthCtx = els.depthChart.getContext("2d");

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
    await loadMarkets();
    if (state.ticker) {
      await loadFeatures();
    }
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

async function loadMarkets() {
  const search = els.marketSearch.value.trim();
  const url = new URL("/markets", window.location.origin);
  url.searchParams.set("limit", "200");
  if (search) {
    url.searchParams.set("search", search);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return;
    state.markets = await res.json();
    state.lastMarketLoad = new Date();
    renderMarkets();
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

function renderMarkets() {
  els.marketList.innerHTML = "";
  if (!state.markets.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No markets yet. Run a refresh to ingest markets.";
    els.marketList.appendChild(li);
    return;
  }

  state.markets.forEach((market) => {
    const li = document.createElement("li");
    li.className = "market-item";
    li.innerHTML = `
      <div class="title">${market.ticker || "--"}</div>
      <div class="sub">${market.event_ticker || market.category || ""}</div>
      <div class="meta">
        <span>${market.status || "--"}</span>
        <span>${formatNumber(market.last_price, 2)}</span>
      </div>
    `;
    li.addEventListener("click", () => {
      els.tickerInput.value = market.ticker || "";
      loadFeatures();
    });
    els.marketList.appendChild(li);
  });

  els.marketCount.textContent = `${state.markets.length} markets`;
  els.marketUpdated.textContent = state.lastMarketLoad
    ? `Updated ${state.lastMarketLoad.toLocaleTimeString()}`
    : "--";
}

function renderFeatures() {
  if (!state.features.length) {
    els.statMid.textContent = "--";
    els.statSpread.textContent = "--";
    els.statProb.textContent = "--";
    els.statVolume.textContent = "--";
    drawChart([]);
    drawDepthChart([], []);
    return;
  }

  const latest = state.features[0];
  els.statMid.textContent = formatNumber(latest.mid, 2);
  els.statSpread.textContent = formatNumber(latest.spread, 2);
  els.statProb.textContent = formatNumber(latest.prob, 3);
  els.statVolume.textContent = formatNumber(latest.volume, 0);

  const rows = state.features.slice().reverse();
  const midSeries = rows.map((row) => row.mid);
  const spreadSeries = rows.map((row) => row.spread);
  const volumeSeries = rows.map((row) => row.volume);

  drawChart(midSeries);
  drawDepthChart(spreadSeries, volumeSeries);
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
  const ratio = max === min ? 0.5 : (last - min) / (max - min);
  ctx.fillStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(width - pad, height - pad - ratio * (height - pad * 2), 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDepthChart(spreadSeries, volumeSeries) {
  const ctx = depthCtx;
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(13, 18, 28, 0.6)";
  ctx.fillRect(0, 0, width, height);

  if (!spreadSeries.length) {
    ctx.fillStyle = "#a9b2c0";
    ctx.font = "12px IBM Plex Mono, monospace";
    ctx.fillText("No spread/volume data yet", 20, height / 2);
    return;
  }

  const pad = 12;
  const xStep = (width - pad * 2) / (spreadSeries.length - 1 || 1);

  const spreadMin = Math.min(...spreadSeries);
  const spreadMax = Math.max(...spreadSeries);
  const volumeMin = Math.min(...volumeSeries);
  const volumeMax = Math.max(...volumeSeries);

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
  spreadSeries.forEach((value, idx) => {
    const ratio = spreadMax === spreadMin ? 0.5 : (value - spreadMin) / (spreadMax - spreadMin);
    const x = pad + idx * xStep;
    const y = height - pad - ratio * (height - pad * 2);
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.strokeStyle = "#2dd4bf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  volumeSeries.forEach((value, idx) => {
    const ratio = volumeMax === volumeMin ? 0.5 : (value - volumeMin) / (volumeMax - volumeMin);
    const x = pad + idx * xStep;
    const y = height - pad - ratio * (height - pad * 2);
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function updateSystem() {
  els.systemEndpoint.textContent = window.location.origin;
  els.systemAlerts.textContent = state.alerts.length;
  els.systemFeatures.textContent = state.features.length;
  els.systemRefresh.textContent = state.lastRefresh
    ? state.lastRefresh.toLocaleTimeString()
    : "--";
  els.systemNote.textContent = state.autoRefresh
    ? "Auto refresh is enabled. Alerts and features update every 10 seconds."
    : "Auto refresh is paused. Use manual refresh or load features.";
}

function startAutoRefresh() {
  clearInterval(state.intervalId);
  if (!state.autoRefresh) {
    updateLiveIndicator();
    return;
  }
  state.intervalId = setInterval(async () => {
    await fetchHealth();
    await loadAlerts();
    if (state.ticker) {
      await loadFeatures();
    }
  }, 10000);
  updateLiveIndicator();
}

function updateLiveIndicator() {
  if (state.autoRefresh) {
    els.liveText.textContent = "Live updates enabled";
    els.liveText.style.color = "#a9b2c0";
  } else {
    els.liveText.textContent = "Live updates paused";
    els.liveText.style.color = "#ff6b6b";
  }
}

function init() {
  fetchHealth();
  loadAlerts();
  loadMarkets();
  updateSystem();

  els.refreshBtn.addEventListener("click", refreshMarkets);
  els.loadFeatures.addEventListener("click", loadFeatures);
  els.tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadFeatures();
    }
  });

  els.marketSearchBtn.addEventListener("click", loadMarkets);
  els.marketSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadMarkets();
    }
  });

  els.autoRefresh.addEventListener("change", (event) => {
    state.autoRefresh = event.target.checked;
    startAutoRefresh();
    updateSystem();
  });

  state.autoRefresh = els.autoRefresh.checked;
  startAutoRefresh();
}

init();
