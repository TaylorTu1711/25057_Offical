import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useSyncChartTheme from '../hooks/useSyncChartTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  getChartThemeColors,
  getChartLegendOptions,
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  PRODUCTION_CHART_COLORS,
  createProductionBarGradient,
  getParetoLineStyle,
} from '../utils/chartTheme';
import { formatErrorLabel } from '../utils/errorStats';
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
);

const MAX_ITEMS = 10;

function buildParetoData(labels, dataValues, maxItems, tooltipLabels) {
  const pairs = (labels || [])
    .map((label, index) => ({
      label,
      tooltip: tooltipLabels?.[index] ?? label,
      count: Number(dataValues?.[index]) || 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);

  const total = pairs.reduce((sum, item) => sum + item.count, 0);
  let running = 0;
  const cumulativePct = pairs.map((item) => {
    running += item.count;
    return total > 0 ? Math.round((running / total) * 1000) / 10 : 0;
  });

  return {
    fullLabels: pairs.map((item) => formatErrorLabel(item.label, item.tooltip)),
    axisLabels: pairs.map((item) => formatErrorLabel(item.label, item.tooltip)),
    shortLabels: pairs.map((item) => String(item.label)),
    counts: pairs.map((item) => item.count),
    cumulativePct,
    total,
  };
}

const BarChart_Pareto = ({ labels, dataValues, tooltipLabels, maxItems = MAX_ITEMS }) => {
  const { theme } = useTheme();
  const { brand } = getChartThemeColors(theme);
  const paretoLine = useMemo(() => getParetoLineStyle(), []);

  const pareto = useMemo(
    () => buildParetoData(labels, dataValues, maxItems, tooltipLabels),
    [labels, dataValues, maxItems, tooltipLabels],
  );

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [pareto.axisLabels, pareto.counts, pareto.cumulativePct],
    'x',
  );

  const data = useMemo(
    () => ({
      labels: pareto.axisLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Số lần lỗi',
          data: pareto.counts,
          yAxisID: 'y',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return createProductionBarGradient(ctx, chartArea);
          },
          borderColor: PRODUCTION_CHART_COLORS.bar.border,
          borderWidth: 1,
          borderRadius: { topLeft: 3, topRight: 3 },
          order: 2,
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
          tension: 0.35,
          fill: false,
          order: 1,
        },
      ],
    }),
    [pareto.axisLabels, pareto.counts, pareto.cumulativePct, paretoLine],
  );

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: getChartLegendOptions({ labels: { font: { size: 10 } } }, theme),
        title: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const index = items[0]?.dataIndex ?? 0;
              return pareto.fullLabels[index] || items[0]?.label || '';
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: themedXScale(
          {
            ticks: {
              maxRotation: 55,
              minRotation: 25,
              autoSkip: false,
              font: { size: 8 },
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
              color: brand,
              text: 'Số lần',
              font: { size: 11, weight: 'bold' },
            },
            ticks: { stepSize: 1, precision: 0 },
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
              font: { size: 11, weight: 'bold' },
            },
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
          paretoLine.axisColor,
          'linear',
          theme,
        ),
      },
    }),
    [brand, pareto.fullLabels, paretoLine, zoomPluginOptions, theme],
  );

  useSyncChartTheme(chartRef, theme, options);

  if (pareto.counts.length === 0) {
    return (
      <div
        className="d-flex align-items-center justify-content-center h-100 w-100 text-muted"
        style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}
      >
        Chưa có dữ liệu lỗi
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
};

export default BarChart_Pareto;
