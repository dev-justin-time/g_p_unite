/**
 * G P Unite — Canvas Chart Engine (TypeScript)
 * Zero-dependency, pure Canvas 2D API
 */

import type { ChartConfig, ChartSeries, HistPoint, ChartType } from './types';
import { CHART_COLORS } from './agents-data';

// ── Global State ──────────────────────────────
export const histData: Record<string, HistPoint[]> = { reputation: [], tasks: [], rewards: [], system: [] };
export const charts: Record<string, FCMChart> = {};
const MAX_HISTORY = 500;

export function pushHistPoint(channel: string, values: Record<string, number>): void {
  if (!histData[channel]) histData[channel] = [];
  histData[channel].push({ ts: Date.now(), values });
  if (histData[channel].length > MAX_HISTORY) histData[channel] = histData[channel].slice(-MAX_HISTORY);
}

interface AgentDataPoint {
  id?: string;
  reputation?: number;
}

interface AgentData {
  agents?: AgentDataPoint[];
}

interface SystemData {
  taskCount?: number;
  agentCount?: number;
  totalStaked?: number | string;
  stakerCount?: number;
  mintedRewards?: number | string;
}

interface RewardsData {
  currentEpoch?: number;
  totalDistributed?: number | string;
}

export function ingestAgentData(data: AgentData): void {
  if (!data.agents) return;
  const vals: Record<string, number> = {};
  const sorted = [...data.agents].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
  for (let i = 0; i < Math.min(8, sorted.length); i++) vals[sorted[i].id || ('a-' + i)] = sorted[i].reputation || 0;
  pushHistPoint('reputation', vals);
}

export function ingestSystemData(data: SystemData): void {
  pushHistPoint('tasks', { total: data.taskCount || 0, agents: data.agentCount || 0 });
  pushHistPoint('system', {
    totalStaked: data.totalStaked ? parseFloat(String(data.totalStaked).replace(/,/g, '')) : 0,
    stakers: data.stakerCount || 0,
    supply: data.mintedRewards ? parseFloat(String(data.mintedRewards).replace(/,/g, '')) : 0
  });
}

export function ingestRewardsData(data: RewardsData): void {
  pushHistPoint('rewards', {
    epoch: data.currentEpoch || 0,
    distributed: data.totalDistributed ? parseFloat(String(data.totalDistributed).replace(/,/g, '')) : 0
  });
}

// ── FCMChart Class ────────────────────────────
export class FCMChart {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private tooltip: HTMLElement | null;
  private legendEl: HTMLElement | null;
  private config: ChartConfig;
  private _hoveredPoint: number | null = null;

  constructor(canvasId: string, tooltipId: string, legendId: string, config: Partial<ChartConfig> & { type: ChartType; series: ChartSeries[] }) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.tooltip = document.getElementById(tooltipId);
    this.legendEl = document.getElementById(legendId);
    this.config = {
      type: config.type,
      series: config.series,
      rangeMinutes: config.rangeMinutes ?? 1440,
      yFormat: config.yFormat ?? ((v: number) => Number(v).toLocaleString()),
      xFormat: config.xFormat ?? ((ts: number) => { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }),
      fillOpacity: config.fillOpacity ?? 0.15,
      lineWidth: config.lineWidth ?? 2,
      dotRadius: config.dotRadius ?? 3,
      gridLines: config.gridLines ?? 5,
      padding: config.padding ?? { top: 10, right: 16, bottom: 30, left: 56 }
    };
    this._bindEvents();
    this._buildLegend();
  }

  setRange(minutes: number): void { this.config.rangeMinutes = minutes; this.render(); }

  render(): void {
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

  private _draw(w: number, h: number): void {
    const ctx = this.ctx!;
    const pad = this.config.padding;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);

    const cutoff = Date.now() - this.config.rangeMinutes * 60000;
    let raw: HistPoint[] = [];
    for (const k in histData) {
      if (histData[k].length > 0 && histData[k][0].values &&
        Object.keys(histData[k][0].values).some(sk => this.config.series.some(s => s.key === sk))) {
        raw = histData[k].filter(p => p.ts >= cutoff);
        break;
      }
    }

    if (raw.length < 2) {
      const mc = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280';
      ctx.fillStyle = mc;
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
    const mapX = (ts: number): number => pad.left + ((ts - xMin) / xRange) * chartW;
    const mapY = (v: number): number => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

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
          ctx.beginPath(); ctx.roundRect(mapX(d.ts) - barW / 2, mapY(d.v), barW, pad.top + chartH - mapY(d.v), [3, 3, 0, 0]); ctx.fill();
        });
      } else {
        ctx.strokeStyle = color; ctx.lineWidth = this.config.lineWidth; ctx.lineJoin = 'round';
        ctx.beginPath(); values.forEach((d, i) => { const x = mapX(d.ts), y = mapY(d.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();

        if (this.config.type === 'area') {
          ctx.fillStyle = color; ctx.globalAlpha = this.config.fillOpacity;
          ctx.beginPath(); values.forEach((d, i) => { i === 0 ? ctx.moveTo(mapX(d.ts), mapY(d.v)) : ctx.lineTo(mapX(d.ts), mapY(d.v)); });
          ctx.lineTo(mapX(values[values.length - 1].ts), h - pad.bottom); ctx.lineTo(mapX(values[0].ts), h - pad.bottom); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (values.length <= 60) {
          ctx.fillStyle = color;
          values.forEach(d => { ctx.beginPath(); ctx.arc(mapX(d.ts), mapY(d.v), this.config.dotRadius, 0, Math.PI * 2); ctx.fill(); });
        }
      }
    }

    // Crosshair
    if (this._hoveredPoint != null) {
      let closest: HistPoint | null = null, minD = Infinity;
      for (const p of raw) { const px = mapX(p.ts); const dist = Math.abs(px - this._hoveredPoint); if (dist < minD) { minD = dist; closest = p; } }
      if (closest) {
        const cx = mapX(closest.ts);
        ctx.strokeStyle = mc; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cx, pad.top); ctx.lineTo(cx, pad.top + chartH); ctx.stroke(); ctx.setLineDash([]);
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

  private _bindEvents(): void {
    if (!this.canvas) return;
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => { this._hoveredPoint = e.clientX - this.canvas!.getBoundingClientRect().left; this.render(); });
    this.canvas.addEventListener('mouseleave', () => { this._hoveredPoint = null; this.tooltip?.classList.remove('visible'); this.render(); });
  }

  private _buildLegend(): void {
    if (!this.legendEl) return;
    this.legendEl.innerHTML = this.config.series.map((s, i) =>
      '<div class="chart-legend-item"><span class="chart-legend-dot" style="background:' + (s.color || CHART_COLORS[i % CHART_COLORS.length]) + '"></span>' + s.label + '</div>'
    ).join('');
  }
}

// ── Init ──────────────────────────────────────
export function initCharts(): void {
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
    btn.addEventListener('click', function(this: HTMLElement) {
      const chartKey = this.dataset.chart;
      const range = parseInt(this.dataset.range!, 10);
      this.parentElement!.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      if (chartKey && charts[chartKey]) charts[chartKey].setRange(range);
    });
  });
}

export function renderAllCharts(): void {
  for (const key in charts) if (charts[key]) charts[key].render();
}
