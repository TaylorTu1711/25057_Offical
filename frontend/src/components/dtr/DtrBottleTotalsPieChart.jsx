import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import useTheme from '../../hooks/useTheme';
import { chartDoughnutAnimationOptions } from '../../utils/chartTheme';
import { resolveBottleGlossary } from '../../utils/dtrBottleGlossary';
import { DTR_BOTTLE_COUNT_COLORS } from './DtrBottleCountsHourlyChart';
import MidaChartExpand from '../mida/MidaChartExpand';

ChartJS.register(ArcElement, Tooltip, Legend);

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
      return {
        key,
        label: gloss?.label || String(key || '').toUpperCase(),
        meaning: gloss?.meaning || '',
        total,
        color: colorForKey(key, index),
      };
    }).filter((it) => it.total > 0);
    const grandTotal = list.reduce((s, it) => s + it.total, 0);
    return { list, grandTotal };
  }, [keys, series, glossaryByKey]);

  const data = useMemo(
    () => ({
      labels: slices.list.map((it) => it.label),
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

  const options = useMemo(
    () => ({
      ...chartDoughnutAnimationOptions,
      responsive: true,
      maintainAspectRatio: false,
      cutout: '42%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.raw) || 0;
              const pct = slices.grandTotal > 0
                ? ((v / slices.grandTotal) * 100).toFixed(1)
                : '0';
              return ` ${ctx.label}: ${v.toLocaleString('vi-VN')} (${pct}%)`;
            },
          },
        },
      },
    }),
    [slices.grandTotal],
  );

  const chartBody = slices.grandTotal > 0 ? (
    <div className="dtr-pie-card__chart">
      <Doughnut
        key={`${theme}-${slices.grandTotal}-${slices.list.length}`}
        data={data}
        options={options}
      />
      <div className="dtr-pie-card__center" aria-hidden="true">
        <div className="dtr-pie-card__center-label">Tổng</div>
        <div className="dtr-pie-card__center-value">
          {slices.grandTotal.toLocaleString('vi-VN')} chai
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
            <div className="dtr-pie-card__legend-text">
              <span className="dtr-pie-card__legend-label">{it.label}</span>
              {it.meaning ? (
                <span className="dtr-pie-card__legend-meaning">{it.meaning}</span>
              ) : null}
            </div>
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
