import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import useTheme from '../../hooks/useTheme';
import { chartDoughnutAnimationOptions } from '../../utils/chartTheme';
import MidaChartExpand from '../mida/MidaChartExpand';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Nhóm chai chính: B1_KN, B5_KN, B4_KN, HU_KN */
const PRIMARY_KEYS = new Set(['b1_kn', 'b5_kn', 'b4_kn', 'hu_kn']);

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
 * - Tổng B1_KN + B5_KN + B4_KN + HU_KN
 * - Tổng các loại chai còn lại
 */
export default function DtrBottleGroupPieChart({
  keys = [],
  series = {},
  title = 'TỈ LỆ CHAI KHÔNG NHÃN',
  expandable = true,
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
        label: 'B1+B5+B4+HU',
        total: primary,
        color: COLORS.primary,
      },
      {
        key: 'other',
        label: 'Còn lại',
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

  return (
    <div className="dtr-pie-card card shadow d-flex flex-column min-h-0">
      <div className="chart-title-brand machine-chart-head dtr-pie-card__head">
        <div className="dtr-pie-card__title">{title}</div>
        {expandable && slices.grandTotal > 0 ? (
          <MidaChartExpand title={title} tone="plenma" variant="pie">
            <DtrBottleGroupPieChart
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
