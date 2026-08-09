import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import useTheme from '../../hooks/useTheme';
import useChartZoomPreserve from '../../hooks/useChartZoomPreserve';
import useSyncChartTheme from '../../hooks/useSyncChartTheme';
import {
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  getCategoryTooltipTitleCallback,
  getPerformanceLineStyle,
  NEON_LINES,
} from '../../utils/chartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
  ChartDataLabels,
);

/**
 * Biểu đồ hiệu suất theo ngày/tháng — 2 đường % + đổ bóng dưới đường.
 */
export default function MidaEfficiencyChart({
  labels = [],
  utilizationValues = [],
  usageValues = [],
  xTickMode = 'month',
  categoryPrefix = '',
}) {
  const { theme } = useTheme();
  const utilizationLine = useMemo(() => getPerformanceLineStyle(), []);
  const usageLine = useMemo(
    () => ({
      borderColor: NEON_LINES.green.border,
      pointBackgroundColor: NEON_LINES.green.point,
      pointBorderColor: NEON_LINES.green.point,
      borderWidth: 1.5,
    }),
    [],
  );

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, utilizationValues, usageValues],
    'x',
  );

  const data = useMemo(() => {
    const lineOpts = (style, fillColor) => ({
      type: 'line',
      yAxisID: 'y',
      borderColor: style.borderColor,
      backgroundColor: fillColor,
      borderWidth: style.borderWidth ?? 2,
      tension: 0.35,
      fill: 'origin',
      clip: true,
      spanGaps: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHitRadius: 12,
      pointBackgroundColor: style.pointBackgroundColor ?? style.borderColor,
      pointBorderColor: '#fff',
      pointBorderWidth: 1,
      pointHoverBackgroundColor: style.borderColor,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 1.5,
      datalabels: { display: false },
    });

    return {
      labels,
      datasets: [
        {
          ...lineOpts(utilizationLine, 'rgba(56, 189, 248, 0.20)'),
          label: 'Hiệu suất vận hành (%)',
          data: utilizationValues,
          order: 1,
        },
        {
          ...lineOpts(usageLine, 'rgba(74, 222, 128, 0.18)'),
          label: 'Hiệu suất sử dụng (%)',
          data: usageValues,
          order: 0,
        },
      ],
    };
  }, [labels, utilizationValues, usageValues, utilizationLine, usageLine]);

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {
        padding: 0,
      },
      plugins: {
        filler: {
          propagate: false,
        },
        datalabels: { display: false },
        legend: getChartLegendOptions({ labels: { padding: 6, font: { size: 10 } } }, theme),
        title: { display: false },
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (context) => {
              const raw = context.raw;
              if (raw == null || raw === '') return null;
              return `${context.dataset.label}: ${Number(raw).toFixed(1)}%`;
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: themedXScale(
          {
            ticks: getCategoryXAxisTickOptions(labels?.length ?? 0, xTickMode),
          },
          undefined,
          'category',
          theme,
        ),
        y: themedScale(
          {
            beginAtZero: true,
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'Phần trăm (%)',
              font: { size: 11, weight: '600' },
            },
            ticks: {
              padding: 4,
              callback: (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return value;
                return `${Math.round(n)}`;
              },
            },
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [theme, labels, categoryPrefix, xTickMode, zoomPluginOptions],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <Chart
      ref={chartRef}
      key={theme}
      type="line"
      data={data}
      options={options}
      style={{ position: 'relative' }}
    />
  );
}
