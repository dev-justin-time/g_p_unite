/**
 * G P Unite — Canvas Chart Engine
 * Zero-dependency, pure Canvas 2D API
 * Supports line, area, and bar charts with tooltips and crosshair
 */

const histData = { reputation: [], tasks: [], rewards: [], system: [] };
const charts = {};
const MAX_HISTORY = 500;

function pushHistPoint(channel, values) {
  if (!histData[channel]) histData[channel] = [];
  histData[channel].push({ ts: Date.now(), values });
  if (histData[channel].length > MAX_HISTORY) histData[channel] = histData[channel].slice(-MAX_HISTORY);
}

function ingestAgentData(data) {
  if (!data.agents) return;
  const vals = {};
  const sorted = [...data.agents].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
  for (let i = 0; i < Math.min(8, sorted.length); i++) vals[sorted[i].id || ('a-' + i)] = sorted[i].reputation || 0;
  pushHistPoint('reputation', vals);
}

function ingestSystemData(data) {
  pushHistPoint('tasks', { total: data.taskCount || 0, agents: data.agentCount || 0 });
  pushHistPoint('system', {
    totalStaked: data.totalStaked ? parseFloat(String(data.totalStaked).replace(/,/g, '')) : 0,
    stakers: data.stakerCount || 0,
    supply: data.mintedRewards ? parseFloat(String(data.mintedRewards).replace(/,/g, '')) : 0
  });
}

function ingestRewardsData(data) {
  pushHistPoint('rewards', {
    epoch: data.currentEpoch || 0,
    distributed: data.totalDistributed ? parseFloat(String(data.totalDistributed).replace(/,/g, '')) : 0
  });
}

class FCMChart {
  constructor(canvasId, tooltipId, legendId, config) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.tooltip = document.getElementById(tooltipId);
    this.legendEl = document.getElementById(legendId);
    this.config = Object.assign({
      type: 'line',
      series: [],
      rangeMinutes: 1440,
      yFormat: v => Number(v).toLocaleString(),
      xFormat: ts => { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); },
      fillOpacity: 0.15,
      lineWidth: 2,
      dotRadius: 3,
      gridLines: 5,
      padding: { top: 10, right: 16, bottom: 30, left: 56 }
    }, config);
    this._hoveredPoint = null;
    this._bindEvents();
    this._buildLegend();
  }

  setRange(minutes) { this.config.rangeMinutes = minutes; this.render(); }

  render() {
    if (!this.ctx || !this.canvas) return;
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._draw(w, h);
  }

  _draw(w, h) {
    const ctx = this.ctx;
    const pad = this.config.padding;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);

    const cutoff = Date.now() - this.config.rangeMinutes * 60000;
    let raw = [];
    for (const k in histData) {
      if (histData[k].length > 0 && histData[k][0].values &&
        Object.keys(histData[k][0].values).some(sk => this.config.series.some(s => s.key === sk))) {
        raw = histData[k].filter(p => p.ts >= cutoff);
        break;
      }
    }

    if (raw.length < 2) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for data...', w / 2, h / 2);
      return;
    }

    let yMin = Infinity, yMax = -Infinity;
    for (const p of raw) {
      for (const s of this.config.series) {
        const v = p.values[s.key];
        if (v != null) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
      }
    }
    if (yMin === Infinity) { ctx.fillText('No data', w / 2, h / 2); return; }
    const yPad = (yMax - yMin) * 0.1 || 1;
    yMin = Math.max(0, yMin - yPad);
    yMax = yMax + yPad;
    if (yMax === yMin) yMax = yMin + 1;

    const xMin = raw[0].ts, xMax = raw[raw.length - 1].ts;
    const xRange = Math.max(xMax - xMin, 1);
    const mapX = ts => pad.left + ((ts - xMin) / xRange) * chartW;
    const mapY = v => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

    const bc = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#1f2937';
    const mc = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280';

    ctx.strokeStyle = bc; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    for (let i = 0; i <= this.config.gridLines; i++) {
      const y = pad.top + (chartH / this.config.gridLines) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      const val = yMax - (i / this.config.gridLines) * (yMax - yMin);
      ctx.fillStyle = mc; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(this.config.yFormat(val), pad.left - 8, y);
    }
    ctx.setLineDash([]);

    const xStep = Math.max(1, Math.floor(raw.length / 8));
    ctx.fillStyle = mc; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i < raw.length; i += xStep) ctx.fillText(this.config.xFormat(raw[i].ts), mapX(raw[i].ts), pad.top + chartH + 8);

    for (let si = 0; si < this.config.series.length; si++) {
      const s = this.config.series[si];
      const color = s.color || CHART_COLORS[si % CHART_COLORS.length];
      const values = raw.map(p => ({ ts: p.ts, v: p.values[s.key] })).filter(d => d.v != null);
      if (!values.length) continue;

      if (this.config.type === 'bar') {
        const barW = Math.max(4, Math.min(20, chartW / Math.max(raw.length, 1) * 0.6));
        ctx.fillStyle = color;
        values.forEach(d => {
          const x = mapX(d.ts) - barW / 2;
          const y = mapY(d.v);
          const baseY = pad.top + chartH;
          ctx.beginPath();
          ctx.roundRect(x, y, barW, baseY - y, [3, 3, 0, 0]);
          ctx.fill();
        });
      } else {
        ctx.strokeStyle = color; ctx.lineWidth = this.config.lineWidth; ctx.lineJoin = 'round';
        ctx.beginPath();
        values.forEach((d, i) => { const x = mapX(d.ts), y = mapY(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();

        if (this.config.type === 'area') {
          ctx.fillStyle = color; ctx.globalAlpha = this.config.fillOpacity;
          ctx.beginPath();
          values.forEach((d, i) => { i === 0 ? ctx.moveTo(mapX(d.ts), mapY(d.v)) : ctx.lineTo(mapX(d.ts), mapY(d.v)); });
          const lastX = mapX(values[values.length - 1].ts), firstX = mapX(values[0].ts);
          ctx.lineTo(lastX, h - pad.bottom); ctx.lineTo(firstX, h - pad.bottom); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (values.length <= 60) {
          ctx.fillStyle = color;
          values.forEach(d => { ctx.beginPath(); ctx.arc(mapX(d.ts), mapY(d.v), this.config.dotRadius, 0, Math.PI * 2); ctx.fill(); });
        }
      }
    }

    if (this._hoveredPoint != null) {
      let closest = null, minD = Infinity;
      for (const p of raw) { const px = mapX(p.ts); const dist = Math.abs(px - this._hoveredPoint); if (dist < minD) { minD = dist; closest = p; } }
      if (closest) {
        const cx = mapX(closest.ts);
        ctx.strokeStyle = mc; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cx, pad.top); ctx.lineTo(cx, pad.top + chartH); ctx.stroke();
        ctx.setLineDash([]);
        for (let si = 0; si < this.config.series.length; si++) {
          const s = this.config.series[si]; const v = closest.values[s.key]; if (v == null) continue;
          ctx.fillStyle = s.color || CHART_COLORS[si]; ctx.beginPath(); ctx.arc(cx, mapY(v), 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (this.tooltip) {
          let html = '<div class="tt-label">' + this.config.xFormat(closest.ts) + '</div>';
          for (const s of this.config.series) { const v = closest.values[s.key]; if (v == null) continue; html += '<div class="tt-row"><span class="tt-dot" style="background:' + (s.color || '#3b82f6') + '"></span><span>' + s.label + '</span><span class="tt-val">' + this.config.yFormat(v) + '</span></div>'; }
          this.tooltip.innerHTML = html; this.tooltip.classList.add('visible');
          let left = cx + 12; if (left + 160 > w) left = cx - 160;
          this.tooltip.style.left = Math.max(0, left) + 'px'; this.tooltip.style.top = '10px';
        }
      }
    }
  }

  _bindEvents() {
    if (!this.canvas) return;
    const self = this;
    this.canvas.addEventListener('mousemove', e => { self._hoveredPoint = e.clientX - self.canvas.getBoundingClientRect().left; self.render(); });
    this.canvas.addEventListener('mouseleave', () => { self._hoveredPoint = null; if (self.tooltip) self.tooltip.classList.remove('visible'); self.render(); });
  }

  _buildLegend() {
    if (!this.legendEl) return;
    this.legendEl.innerHTML = this.config.series.map((s, i) =>
      '<div class="chart-legend-item"><span class="chart-legend-dot" style="background:' + (s.color || CHART_COLORS[i % CHART_COLORS.length]) + '"></span>' + s.label + '</div>'
    ).join('');
  }
}

function initCharts() {
  const ids = ['inf', 'ren', 'fl', 'edge', 'zk', 'game', 'sci', 'priv'];
  const labels = ['Inference', 'Render', 'FL', 'Edge', 'ZK', 'Game', 'Science', 'Privacy'];
  charts.reputation = new FCMChart('chartReputation', 'tooltipReputation', 'legendReputation', {
    type: 'line',
    series: ids.map((id, i) => ({ key: id, label: labels[i], color: CHART_COLORS[i] }))
  });
  charts.rewards = new FCMChart('chartRewards', 'tooltipRewards', 'legendRewards', {
    type: 'bar',
    series: [{ key: 'distributed', label: 'FCM Distributed', color: '#f59e0b' }]
  });
  charts.focusedAgent = new FCMChart('chartFocusedAgent', 'tooltipFocusedAgent', 'legendFocusedAgent', {
    type: 'line',
    series: [
      { key: 'reputation', label: 'Reputation', color: '#3b82f6' },
      { key: 'stake', label: 'Stake', color: '#10b981' },
      { key: 'activeTasks', label: 'Tasks', color: '#f59e0b' }
    ]
  });

  document.querySelectorAll('.chart-range-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const chartKey = this.dataset.chart;
      const range = parseInt(this.dataset.range, 10);
      this.parentElement.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      if (charts[chartKey]) charts[chartKey].setRange(range);
    });
  });
}

function renderAllCharts() {
  for (const key in charts) if (charts[key]) charts[key].render();
}
