import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import useTheme from '../../hooks/useTheme';
import { chartDoughnutAnimationOptions } from '../../utils/chartTheme';
import MidaChartExpand from '../mida/MidaChartExpand';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Nhóm chai không nhãn: B1_KN, B4_KN, B5_KN (không gồm HU_KN) */
const PRIMARY_KEYS = new Set(['b1_kn', 'b4_kn', 'b5_kn']);

const COLORS = {
  primary: '#3498db',
  other: '#94a3b8',
};

function sumArr(values = []) {
  return values.reduce((sum, v) => {
    const n = Number(v);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function normKey(key) {
  return String(key || '').trim().toLowerCase();
}

/**
 * Biểu đồ quạt 2 phần:
 * - Chai không nhãn: B1_KN + B4_KN + B5_KN
 * - Các chai còn lại (gồm HU_KN và loại khác)
 */
export default function DtrBottleGroupPieChart({
  keys = [],
  series = {},
  title = 'TỈ LỆ CHAI KHÔNG NHÃN',
  expandable = true,
  /** Hiện chú thích màu (dùng khi phóng to). */
  showLegend = false,
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const slices = useMemo(() => {
    let primary = 0;
    let other = 0;

    keys.forEach((key) => {
      const total = sumArr(series[key] || []);
      if (!(total > 0)) return;
      if (PRIMARY_KEYS.has(normKey(key))) primary += total;
      else other += total;
    });

    const list = [
      {
        key: 'primary',
        label: 'Chai không nhãn',
        total: primary,
        color: COLORS.primary,
      },
      {
        key: 'other',
        label: 'Các chai còn lại',
        total: other,
        color: isDark ? '#64748b' : COLORS.other,
      },
    ].filter((it) => it.total > 0);

    const grandTotal = primary + other;
    return { list, grandTotal, primary, other };
  }, [keys, series, isDark]);

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
        key={`${theme}-${slices.grandTotal}-${slices.primary}-${slices.other}`}
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
    <ul className="dtr-pie-card__legend dtr-pie-card__legend--group" aria-label="Chú thích nhóm chai">
      {slices.list.map((it) => {
        const pct = slices.grandTotal > 0
          ? ((it.total / slices.grandTotal) * 100).toFixed(1)
          : '0';
        return (
          <li key={it.key} className="dtr-pie-card__legend-item">
            <i style={{ background: it.color }} aria-hidden="true" />
            <span className="dtr-pie-card__legend-name">{it.label}</span>
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
          <MidaChartExpand
            title="TỈ LỆ CHAI KHÔNG NHÃN VÀ CÁC CHAI CÒN LẠI"
            tone="plenma"
            variant="pie"
          >
            <DtrBottleGroupPieChart
              keys={keys}
              series={series}
              title="TỈ LỆ CHAI KHÔNG NHÃN VÀ CÁC CHAI CÒN LẠI"
              expandable={false}
              showLegend
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
