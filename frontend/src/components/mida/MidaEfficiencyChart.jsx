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
  zoomPlugin,
  ChartDataLabels,
);

/**
 * Biểu đồ hiệu suất theo ngày/tháng — 2 đường % (vận hành + sử dụng).
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
      backgroundColor: NEON_LINES.green.background,
      pointBackgroundColor: NEON_LINES.green.point,
      pointBorderColor: NEON_LINES.green.point,
      borderWidth: 1.5,
    }),
    [],
  );
  const labelCount = labels?.length ?? 0;

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, utilizationValues, usageValues],
    'x',
  );

  const data = useMemo(() => {
    const lineOpts = (style) => ({
      type: 'line',
      yAxisID: 'y',
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      borderWidth: style.borderWidth ?? 2,
      tension: 0.35,
      fill: false,
      clip: false,
      spanGaps: true,
      pointRadius: labelCount <= 48 ? 2.5 : 0,
      pointHoverRadius: 5,
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
          ...lineOpts(utilizationLine),
          label: 'Hiệu suất vận hành (%)',
          data: utilizationValues,
          order: 0,
        },
        {
          ...lineOpts(usageLine),
          label: 'Hiệu suất sử dụng (%)',
          data: usageValues,
          order: 1,
        },
      ],
    };
  }, [labels, utilizationValues, usageValues, labelCount, utilizationLine, usageLine]);

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: getChartLegendOptions({ labels: { padding: 6, font: { size: 10 } } }, theme),
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
