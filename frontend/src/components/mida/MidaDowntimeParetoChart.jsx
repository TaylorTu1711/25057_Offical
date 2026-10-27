import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import useTheme from '../../hooks/useTheme';
import useSyncChartTheme from '../../hooks/useSyncChartTheme';
import useChartZoomPreserve from '../../hooks/useChartZoomPreserve';
import {
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getChartLegendOptions,
  createNeonBarGradient,
  createNeonBarHoverGradient,
  getParetoLineStyle,
  NEON_BAR_GRADIENTS,
} from '../../utils/chartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  ChartDataLabels,
);

const stopPalette = NEON_BAR_GRADIENTS.neonRed;

function buildPareto(items = []) {
  const pairs = items
    .map((item) => ({
      label: item.reason_label || item.reason_code,
      hours: Number(item.hours) || Number(item.duration_seconds || 0) / 3600,
      count: Number(item.event_count) || 0,
    }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const total = pairs.reduce((sum, item) => sum + item.hours, 0);
  let running = 0;
  const cumulativePct = pairs.map((item) => {
    running += item.hours;
    return total > 0 ? Math.round((running / total) * 1000) / 10 : 0;
  });

  return {
    labels: pairs.map((item) => item.label),
    hours: pairs.map((item) => Number(item.hours.toFixed(2))),
    counts: pairs.map((item) => item.count),
    cumulativePct,
    total,
  };
}

export default function MidaDowntimeParetoChart({ items = [] }) {
  const { theme } = useTheme();
  const paretoLine = useMemo(() => getParetoLineStyle(), []);
  const pareto = useMemo(() => buildPareto(items), [items]);
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [pareto.labels, pareto.hours, pareto.cumulativePct],
    'x',
  );

  const data = useMemo(
    () => ({
      labels: pareto.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Thời gian dừng (giờ)',
          data: pareto.hours,
          yAxisID: 'y',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return createNeonBarGradient(ctx, chartArea, stopPalette);
          },
          hoverBackgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return createNeonBarHoverGradient(ctx, chartArea, stopPalette);
          },
          borderColor: stopPalette.border,
          borderWidth: 1,
          borderRadius: { topLeft: 3, topRight: 3 },
          order: 2,
          datalabels: {
            display: true,
            anchor: 'start',
            align: 'end',
            offset: 8,
            rotation: -90,
            clamp: true,
            clip: false,
            color: '#fff',
            textStrokeColor: 'rgba(0, 0, 0, 0.55)',
            textStrokeWidth: 3,
            textAlign: 'left',
            formatter: (_value, ctx) => pareto.labels[ctx.dataIndex] || '',
            font: (ctx) => {
              const bar = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex];
              const w = Math.max(8, bar?.width ?? 24);
              const size = Math.min(12, Math.max(8, Math.round(w * 0.42)));
              return { size, weight: '700' };
            },
          },
        },
        {
          type: 'line',
          label: 'Lũy kế (%)',
          data: pareto.cumulativePct,
          yAxisID: 'y1',
          borderColor: paretoLine.borderColor,
          backgroundColor: paretoLine.backgroundColor,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: paretoLine.pointBackgroundColor,
          pointBorderColor: paretoLine.pointBorderColor,
          tension: 0.3,
          fill: false,
          order: 1,
          datalabels: { display: false },
        },
      ],
    }),
    [pareto.labels, pareto.hours, pareto.cumulativePct, paretoLine],
  );

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {
        padding: { top: 4, bottom: 4, left: 0, right: 4 },
      },
      plugins: {
        datalabels: { clip: false },
        legend: getChartLegendOptions({ labels: { font: { size: 10 } } }, theme),
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === 'y1') {
                return `Lũy kế: ${ctx.parsed.y}%`;
              }
              const hours = ctx.parsed.y;
              const count = pareto.counts[ctx.dataIndex] || 0;
              return `Dừng: ${hours} giờ (${count} lần)`;
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: themedXScale(
          {
            ticks: {
              display: false,
              padding: 0,
            },
            afterFit(axis) {
              axis.height = 0;
            },
          },
          undefined,
          'category',
          theme,
        ),
        y: themedScale(
          {
            position: 'left',
            beginAtZero: true,
            title: {
              display: true,
              text: 'Giờ',
              font: { size: 10, weight: 'bold' },
            },
            ticks: { font: { size: 9 } },
          },
          undefined,
          'linear',
          theme,
        ),
        y1: themedScale(
          {
            position: 'right',
            beginAtZero: true,
            max: 100,
            grid: { drawOnChartArea: false },
            title: {
              display: true,
              color: paretoLine.axisColor,
              text: 'Lũy kế (%)',
              font: { size: 10, weight: 'bold' },
            },
            ticks: {
              font: { size: 9 },
              callback: (value) => `${value}%`,
            },
          },
          paretoLine.axisColor,
          'linear',
          theme,
        ),
      },
    }),
    [pareto.counts, paretoLine, zoomPluginOptions, theme],
  );

  useSyncChartTheme(chartRef, theme, options);

  if (pareto.hours.length === 0) {
    return (
      <div
        className="d-flex align-items-center justify-content-center h-100 w-100 text-muted"
        style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}
      >
        Chưa có dữ liệu dừng máy
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
}
