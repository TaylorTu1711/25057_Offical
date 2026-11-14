import React, { useCallback, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import useTheme from '../../hooks/useTheme';
import { chartDoughnutAnimationOptions } from '../../utils/chartTheme';
import { resolveBottleGlossary } from '../../utils/dtrBottleGlossary';
import { DTR_BOTTLE_COUNT_COLORS } from './DtrBottleCountsHourlyChart';
import MidaChartExpand from '../mida/MidaChartExpand';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Tooltip giữa doughnut — đè lên vùng số Tổng. */
if (!Tooltip.positioners.dtrPieCenter) {
  Tooltip.positioners.dtrPieCenter = function dtrPieCenter() {
    const { chartArea } = this.chart;
    if (!chartArea) return false;
    return {
      x: (chartArea.left + chartArea.right) / 2,
      y: (chartArea.top + chartArea.bottom) / 2,
    };
  };
}

const FALLBACK_COLORS = [
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#e74c3c',
  '#f39c12',
  '#1abc9c',
  '#8e44ad',
  '#16a085',
  '#c0392b',
  '#27ae60',
];

function colorForKey(key, index) {
  const k = String(key || '').toLowerCase();
  if (DTR_BOTTLE_COUNT_COLORS[k]) return DTR_BOTTLE_COUNT_COLORS[k];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function sumArr(values = []) {
  return values.reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Biểu đồ quạt — tỉ lệ tổng số lượng từng loại chai
 * (cùng dữ liệu cột TỔNG của biểu đồ thống kê số chai).
 */
export default function DtrBottleTotalsPieChart({
  keys = [],
  series = {},
  title = 'TỈ LỆ LOẠI CHAI',
  expandable = true,
  /** Hiện chú thích màu (dùng khi phóng to). */
  showLegend = false,
  bottleGlossary = null,
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  /** Hover lát: ẩn số Tổng để tooltip đè lên giữa doughnut. */
  const [hovering, setHovering] = useState(false);

  const glossaryByKey = useMemo(() => {
    const map = {};
    for (const item of resolveBottleGlossary(bottleGlossary)) {
      map[String(item.key).toLowerCase()] = item;
    }
    return map;
  }, [bottleGlossary]);

  const slices = useMemo(() => {
    const list = keys.map((key, index) => {
      const total = sumArr(series[key] || []);
      const k = String(key || '').toLowerCase();
      const gloss = glossaryByKey[k];
      const code = gloss?.label || String(key || '').toUpperCase();
      const meaning = String(gloss?.meaning || '').trim();
      return {
        key,
        /** Tên chi tiết (glossary); fallback mã nếu chưa có mô tả. */
        displayName: meaning || code,
        total,
        color: colorForKey(key, index),
      };
    }).filter((it) => it.total > 0);
    const grandTotal = list.reduce((s, it) => s + it.total, 0);
    return { list, grandTotal };
  }, [keys, series, glossaryByKey]);

  const data = useMemo(
    () => ({
      labels: slices.list.map((it) => it.displayName),
      datasets: [
        {
          data: slices.list.map((it) => it.total),
          backgroundColor: slices.list.map((it) => it.color),
          borderColor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f3ffe9',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }),
    [slices.list, isDark],
  );

  const onHoverSlice = useCallback((_event, elements) => {
    setHovering(Boolean(elements?.length));
  }, []);

  const options = useMemo(
    () => ({
      ...chartDoughnutAnimationOptions,
      responsive: true,
      maintainAspectRatio: false,
      cutout: '48%',
      interaction: { mode: 'nearest', intersect: true },
      onHover: onHoverSlice,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          enabled: true,
          position: 'dtrPieCenter',
          xAlign: 'center',
          yAlign: 'center',
          displayColors: true,
          padding: 10,
          caretSize: 0,
          /* Nền đặc — đè kín chỗ Tổng phía dưới canvas */
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.97)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#e2e8f0' : '#334155',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.12)',
          borderWidth: 1,
          callbacks: {
            title: (items) => {
              const item = items?.[0];
              return item?.label || '';
            },
            label: (ctx) => {
              const v = Number(ctx.raw) || 0;
              const pct = slices.grandTotal > 0
                ? ((v / slices.grandTotal) * 100).toFixed(1)
                : '0';
              return ` ${v.toLocaleString('vi-VN')} chai (${pct}%)`;
            },
          },
        },
      },
    }),
    [onHoverSlice, slices.grandTotal, isDark],
  );

  const chartBody = slices.grandTotal > 0 ? (
    <div
      className="dtr-pie-card__chart"
      onMouseLeave={() => setHovering(false)}
    >
      <Doughnut
        key={`${theme}-${slices.grandTotal}-${slices.list.length}`}
        data={data}
        options={options}
      />
      <div
        className={`dtr-pie-card__center${hovering ? ' is-hidden' : ''}`}
        aria-hidden="true"
      >
        <div className="dtr-pie-card__center-label">Tổng</div>
        <div className="dtr-pie-card__center-value">
          <span className="dtr-pie-card__center-value-num">
            {slices.grandTotal.toLocaleString('vi-VN')}
          </span>
          <span className="dtr-pie-card__center-value-unit">chai</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="dtr-pie-card__ring">
      <div className="dtr-pie-card__empty">Chưa có dữ liệu</div>
    </div>
  );

  const legend = showLegend && slices.list.length > 0 ? (
    <ul className="dtr-pie-card__legend" aria-label="Chú thích loại chai">
      {slices.list.map((it) => {
        const pct = slices.grandTotal > 0
          ? ((it.total / slices.grandTotal) * 100).toFixed(1)
          : '0';
        return (
          <li key={it.key} className="dtr-pie-card__legend-item">
            <i style={{ background: it.color }} aria-hidden="true" />
            <span className="dtr-pie-card__legend-name" title={it.displayName}>
              {it.displayName}
            </span>
            <span className="dtr-pie-card__legend-meta">
              {it.total.toLocaleString('vi-VN')} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div
      className={`dtr-pie-card card shadow d-flex flex-column min-h-0${
        showLegend ? ' dtr-pie-card--with-legend' : ''
      }`}
    >
      <div className="chart-title-brand machine-chart-head dtr-pie-card__head">
        <div className="dtr-pie-card__title">{title}</div>
        {expandable && slices.grandTotal > 0 ? (
          <MidaChartExpand title={title} tone="plenma" variant="pie">
            <DtrBottleTotalsPieChart
              keys={keys}
              series={series}
              title={title}
              expandable={false}
              showLegend
              bottleGlossary={bottleGlossary}
            />
          </MidaChartExpand>
        ) : null}
      </div>
      <div
        className={`dtr-pie-card__body flex-grow-1 min-h-0 d-flex align-items-center justify-content-center${
          showLegend ? ' dtr-pie-card__body--with-legend' : ''
        }`}
      >
        {chartBody}
        {legend}
      </div>
    </div>
  );
}
