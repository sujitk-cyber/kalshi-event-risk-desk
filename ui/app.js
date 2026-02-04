const state = {
  ticker: "",
  features: [],
  alerts: [],
  markets: [],
  lastRefresh: null,
  lastMarketLoad: null,
  autoRefresh: true,
  intervalId: null,
  heatmapTickers: [],
  error: null,
  featureRequestId: 0,
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
  orderbookRows: document.getElementById("orderbook-rows"),
  orderbookSpread: document.getElementById("orderbook-spread"),
  errorBanner: document.getElementById("error-banner"),
  errorText: document.getElementById("error-text"),
  errorDismiss: document.getElementById("error-dismiss"),
  alertList: document.getElementById("alert-list"),
  timelineList: document.getElementById("timeline-list"),
  marketSearch: document.getElementById("market-search"),
  marketSearchBtn: document.getElementById("market-search-btn"),
  marketList: document.getElementById("market-list"),
  marketCount: document.getElementById("market-count"),
  marketUpdated: document.getElementById("market-updated"),
  heatmapGrid: document.getElementById("heatmap-grid"),
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

function showError(source, message) {
  state.error = { source, message, time: new Date() };
  updateErrorBanner();
}

function clearError(source) {
  if (!state.error) return;
  if (!source || state.error.source === source) {
    state.error = null;
    updateErrorBanner();
  }
}

function updateErrorBanner() {
  if (!state.error) {
    els.errorBanner.hidden = true;
    return;
  }
  const time = state.error.time.toLocaleTimeString();
  els.errorText.textContent = `${state.error.source}: ${state.error.message} (${time})`;
  els.errorBanner.hidden = false;
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
    const res = await fetch(`/markets/refresh?limit=${limit}`, { method: "POST" });
    if (!res.ok) {
      showError("Refresh", `HTTP ${res.status}`);
      return;
    }
    clearError("Refresh");
    state.lastRefresh = new Date();
    updateSystem();
    await loadAlerts();
    await loadMarkets();
    if (state.ticker) {
      await loadFeatures();
    }
  } catch (err) {
    console.error(err);
    showError("Refresh", err.message || "Network error");
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Refresh Markets";
  }
}

async function loadAlerts() {
  try {
    const res = await fetch("/alerts?limit=100");
    if (!res.ok) {
      showError("Alerts", `HTTP ${res.status}`);
      return;
    }
    state.alerts = await res.json();
    renderAlerts();
    renderTimeline();
    updateSystem();
    clearError("Alerts");
  } catch (err) {
    console.error(err);
    showError("Alerts", err.message || "Network error");
  }
}

async function loadFeatures() {
  const ticker = els.tickerInput.value.trim();
  if (!ticker) return;
  const requestId = ++state.featureRequestId;
  try {
    const res = await fetch(`/features/${encodeURIComponent(ticker)}?limit=80`);
    if (!res.ok) {
      if (requestId === state.featureRequestId) {
        showError("Features", `HTTP ${res.status}`);
      }
      return;
    }
    const data = await res.json();
    if (requestId !== state.featureRequestId) {
      return;
    }
    state.ticker = ticker;
    state.features = data;
    renderFeatures();
    clearError("Features");
  } catch (err) {
    console.error(err);
    if (requestId === state.featureRequestId) {
      showError("Features", err.message || "Network error");
    }
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
    if (!res.ok) {
      showError("Markets", `HTTP ${res.status}`);
      return;
    }
    state.markets = await res.json();
    state.lastMarketLoad = new Date();
    renderMarkets();
    await loadHeatmap();
    clearError("Markets");
  } catch (err) {
    console.error(err);
    showError("Markets", err.message || "Network error");
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

function renderTimeline() {
  els.timelineList.innerHTML = "";
  if (!state.alerts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No alert history yet.";
    els.timelineList.appendChild(empty);
    return;
  }

  const buckets = new Map();
  state.alerts.forEach((alert) => {
    const ts = new Date(alert.ts);
    if (Number.isNaN(ts.getTime())) return;
    const bucket = new Date(ts);
    bucket.setMinutes(Math.floor(bucket.getMinutes() / 15) * 15, 0, 0);
    const key = bucket.toISOString();
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const entries = Array.from(buckets.entries())
    .map(([key, count]) => ({ ts: new Date(key), count }))
    .sort((a, b) => a.ts - b.ts)
    .slice(-10);

  const maxCount = Math.max(...entries.map((e) => e.count));
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "timeline-row";

    const label = document.createElement("span");
    label.textContent = entry.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const bar = document.createElement("div");
    bar.className = "timeline-bar";
    const fill = document.createElement("span");
    fill.style.width = `${(entry.count / maxCount) * 100}%`;
    bar.appendChild(fill);

    const count = document.createElement("span");
    count.className = "timeline-count";
    count.textContent = entry.count;

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(count);
    els.timelineList.appendChild(row);
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
    renderOrderBook(null);
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
  renderOrderBook(latest);
  updateSystem();
}

function renderOrderBook(latest) {
  els.orderbookRows.innerHTML = "";
  if (!latest) {
    els.orderbookSpread.textContent = "Spread --";
    return;
  }

  let baseBid = latest.mid - latest.spread / 2;
  let baseAsk = latest.mid + latest.spread / 2;
  const fallback = state.markets.find((m) => m.ticker === state.ticker);
  if (fallback) {
    if (fallback.yes_bid > 0) baseBid = fallback.yes_bid;
    if (fallback.yes_ask > 0) baseAsk = fallback.yes_ask;
  }

  const spread = baseAsk - baseBid;
  const step = Math.max(0.5, spread > 0 ? spread / 2 : 1);
  els.orderbookSpread.textContent = `Spread ${formatNumber(spread, 2)}`;

  for (let i = 4; i >= 0; i -= 1) {
    const bid = baseBid - i * step;
    const ask = baseAsk + i * step;
    const row = document.createElement("div");
    row.className = "orderbook-row";
    row.innerHTML = `
      <span class="bid">${formatNumber(bid, 2)}</span>
      <span class="ask">${formatNumber(ask, 2)}</span>
    `;
    els.orderbookRows.appendChild(row);
  }
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

async function loadHeatmap() {
  if (!state.markets.length) {
    renderHeatmap([], []);
    return;
  }

  const candidates = state.markets
    .slice()
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 6)
    .map((m) => m.ticker)
    .filter(Boolean);

  if (!candidates.length) {
    renderHeatmap([], []);
    return;
  }

  const seriesMap = new Map();
  await Promise.all(
    candidates.map(async (ticker) => {
      try {
        const res = await fetch(`/features/${encodeURIComponent(ticker)}?limit=50`);
        if (!res.ok) return;
        const rows = await res.json();
        const series = rows.slice().reverse().map((row) => row.mid).filter((v) => v > 0);
        if (series.length >= 5) {
          seriesMap.set(ticker, series);
        }
      } catch (err) {
        console.error(err);
      }
    })
  );

  const tickers = Array.from(seriesMap.keys());
  if (tickers.length < 2) {
    renderHeatmap([], []);
    return;
  }

  const minLen = Math.min(...Array.from(seriesMap.values()).map((s) => s.length));
  const aligned = tickers.map((t) => seriesMap.get(t).slice(-minLen));
  const matrix = tickers.map((_, i) =>
    tickers.map((__, j) => (i === j ? 1 : pearson(aligned[i], aligned[j])))
  );

  state.heatmapTickers = tickers;
  renderHeatmap(tickers, matrix);
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sumA = 0;
  let sumB = 0;
  let sumA2 = 0;
  let sumB2 = 0;
  let sumAB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i];
    sumB += b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
    sumAB += a[i] * b[i];
  }
  const numerator = n * sumAB - sumA * sumB;
  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (denom === 0) return 0;
  return numerator / denom;
}

function renderHeatmap(tickers, matrix) {
  els.heatmapGrid.innerHTML = "";
  if (!tickers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Not enough data to build heatmap.";
    els.heatmapGrid.appendChild(empty);
    return;
  }

  const size = tickers.length + 1;
  els.heatmapGrid.style.gridTemplateColumns = `repeat(${size}, 38px)`;

  els.heatmapGrid.appendChild(makeLabel(""));
  tickers.forEach((ticker) => els.heatmapGrid.appendChild(makeLabel(shortTicker(ticker))));

  tickers.forEach((rowTicker, i) => {
    els.heatmapGrid.appendChild(makeLabel(shortTicker(rowTicker)));
    tickers.forEach((colTicker, j) => {
      const value = matrix[i][j];
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.background = corrColor(value);
      cell.textContent = value.toFixed(2);
      cell.title = `${rowTicker} vs ${colTicker}: ${value.toFixed(2)}`;
      els.heatmapGrid.appendChild(cell);
    });
  });
}

function makeLabel(text) {
  const label = document.createElement("div");
  label.className = "heatmap-label";
  label.textContent = text;
  return label;
}

function shortTicker(ticker) {
  if (ticker.length <= 6) return ticker;
  return `${ticker.slice(0, 3)}…${ticker.slice(-2)}`;
}

function corrColor(value) {
  const normalized = (value + 1) / 2;
  const hue = 10 + normalized * 110;
  return `hsl(${hue}, 70%, 50%)`;
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

  let tick = 0;
  state.intervalId = setInterval(async () => {
    tick += 1;
    await fetchHealth();
    await loadAlerts();
    if (state.ticker) {
      await loadFeatures();
    }
    if (tick % 3 === 0) {
      await loadMarkets();
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
  updateErrorBanner();

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

  els.errorDismiss.addEventListener("click", () => clearError());

  state.autoRefresh = els.autoRefresh.checked;
  startAutoRefresh();
}

init();
