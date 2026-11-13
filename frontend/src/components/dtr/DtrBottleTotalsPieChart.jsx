import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import useTheme from '../../hooks/useTheme';
import { chartDoughnutAnimationOptions } from '../../utils/chartTheme';
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
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const slices = useMemo(() => {
    const list = keys.map((key, index) => {
      const total = sumArr(series[key] || []);
      return {
        key,
        label: String(key || '').toUpperCase(),
        total,
        color: colorForKey(key, index),
      };
    }).filter((it) => it.total > 0);
    const grandTotal = list.reduce((s, it) => s + it.total, 0);
    return { list, grandTotal };
  }, [keys, series]);

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

  return (
    <div className="dtr-pie-card card shadow d-flex flex-column min-h-0">
      <div className="chart-title-brand machine-chart-head dtr-pie-card__head">
        <div className="dtr-pie-card__title">{title}</div>
        {expandable && slices.grandTotal > 0 ? (
          <MidaChartExpand title={title} tone="plenma" variant="pie">
            <DtrBottleTotalsPieChart
              keys={keys}
              series={series}
              title={title}
              expandable={false}
            />
          </MidaChartExpand>
        ) : null}
      </div>
      <div className="dtr-pie-card__body flex-grow-1 min-h-0 d-flex align-items-center justify-content-center">
        {chartBody}
      </div>
    </div>
  );
}
