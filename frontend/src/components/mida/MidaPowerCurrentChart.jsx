import React, { useCallback, useLayoutEffect, useMemo } from 'react';
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
  formatChartTooltipValue,
  isDarkChartTheme,
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

const Y_AXIS_IDS = ['yPower', 'yCurrent'];

/** Tự chỉnh min/max trục Y theo khoảng X đang nhìn. */
function fitYAxesToVisibleX(chart) {
  const xScale = chart?.scales?.x;
  if (!xScale) return;

  const n = chart.data?.labels?.length ?? 0;
  if (n <= 0) return;

  const i0 = Math.max(0, Math.floor(Math.min(xScale.min, xScale.max)));
  const i1 = Math.min(n - 1, Math.ceil(Math.max(xScale.min, xScale.max)));

  let changed = false;

  for (const axisId of Y_AXIS_IDS) {
    const scale = chart.scales[axisId];
    if (!scale) continue;

    let hi = -Infinity;
    let lo = Infinity;

    for (const ds of chart.data.datasets || []) {
      if ((ds.yAxisID || 'y') !== axisId) continue;
      const arr = ds.data || [];
      for (let i = i0; i <= i1; i += 1) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
    }

    // Không có số / toàn 0 → bỏ khóa min/max, để Chart.js tự scale
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || (hi <= 0 && lo >= 0)) {
      if (scale.options.min != null || scale.options.max != null) {
        scale.options.min = undefined;
        scale.options.max = undefined;
        changed = true;
      }
      continue;
    }

    const span = hi - lo;
    // Pad theo kW/A — không dùng sàn 1.0 (trước đây làm max luôn ~1 khi reload)
    const pad =
      span > 0
        ? Math.max(span * 0.12, Math.abs(hi) * 0.02)
        : Math.max(Math.abs(hi) * 0.15, 0.1);
    const nextMin = lo >= 0 ? 0 : lo - pad;
    const nextMax = hi + pad;

    if (scale.options.min !== nextMin || scale.options.max !== nextMax) {
      scale.options.min = nextMin;
      scale.options.max = nextMax;
      changed = true;
    }
  }

  if (changed) chart.update('none');
}

/** true nếu trục X đang xem gần như full data (chưa zoom). */
function isFullXRange(chart) {
  const x = chart?.scales?.x;
  const n = chart?.data?.labels?.length ?? 0;
  if (!x || n <= 1) return true;
  return x.min <= 0.01 && x.max >= n - 1.01;
}

/**
 * Biểu đồ đường kép: Công suất (kW) + Dòng điện (A).
 */
export default function MidaPowerCurrentChart({
  labels = [],
  powerValues = [],
  currentValues = [],
  xTickMode = 'month',
  categoryPrefix = '',
}) {
  const { theme } = useTheme();
  const isDark = isDarkChartTheme(theme);
  const labelCount = labels?.length ?? 0;

  const { chartRef, zoomPluginOptions: baseZoomOptions } = useChartZoomPreserve(
    [labels, powerValues, currentValues],
    'x',
  );

  const handleZoomOrPan = useCallback((ctx) => {
    const chart = ctx.chart;
    if (isFullXRange(chart)) {
      let changed = false;
      for (const axisId of Y_AXIS_IDS) {
        const scale = chart.scales?.[axisId];
        if (!scale) continue;
        if (scale.options.min != null || scale.options.max != null) {
          scale.options.min = undefined;
          scale.options.max = undefined;
          changed = true;
        }
      }
      if (changed) chart.update('none');
      return;
    }
    fitYAxesToVisibleX(chart);
  }, []);

  const zoomPluginOptions = useMemo(
    () => ({
      pan: {
        ...baseZoomOptions.pan,
        onPanComplete: (ctx) => {
          baseZoomOptions.pan?.onPanComplete?.(ctx);
          handleZoomOrPan(ctx);
        },
      },
      zoom: {
        ...baseZoomOptions.zoom,
        onZoomComplete: (ctx) => {
          baseZoomOptions.zoom?.onZoomComplete?.(ctx);
          handleZoomOrPan(ctx);
        },
      },
    }),
    [baseZoomOptions, handleZoomOrPan],
  );

  // Khi full range: bỏ khóa trục Y. Khi đang zoom: chỉnh lại theo vùng nhìn thấy.
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const id = requestAnimationFrame(() => {
      if (isFullXRange(chart)) {
        let changed = false;
        for (const axisId of Y_AXIS_IDS) {
          const scale = chart.scales?.[axisId];
          if (!scale) continue;
          if (scale.options.min != null || scale.options.max != null) {
            scale.options.min = undefined;
            scale.options.max = undefined;
            changed = true;
          }
        }
        if (changed) chart.update('none');
        return;
      }
      fitYAxesToVisibleX(chart);
    });
    return () => cancelAnimationFrame(id);
  }, [chartRef, labels, powerValues, currentValues]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Công suất (kW)',
          data: powerValues,
          yAxisID: 'yPower',
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.14)',
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#ffffff',
          pointRadius: labelCount > 40 ? 0 : 2.5,
          pointHoverRadius: 4,
          borderWidth: 2.2,
          tension: 0.35,
          fill: true,
          spanGaps: true,
          datalabels: { display: false },
        },
        {
          type: 'line',
          label: 'Dòng điện (A)',
          data: currentValues,
          yAxisID: 'yCurrent',
          borderColor: '#ef5350',
          backgroundColor: 'rgba(239, 83, 80, 0.14)',
          pointBackgroundColor: '#ef5350',
          pointBorderColor: '#ffffff',
          pointRadius: labelCount > 40 ? 0 : 2.5,
          pointHoverRadius: 4,
          borderWidth: 2.2,
          tension: 0.35,
          fill: true,
          spanGaps: true,
          datalabels: { display: false },
        },
      ],
    }),
    [labels, powerValues, currentValues, labelCount],
  );

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: getChartLegendOptions({ labels: { padding: 6, font: { size: 10 } } }, theme),
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v == null || Number.isNaN(v)) return null;
              const unit = ctx.dataset.yAxisID === 'yCurrent' ? 'A' : 'kW';
              return `${ctx.dataset.label}: ${formatChartTooltipValue(v)} ${unit}`;
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: themedXScale(
          {
            ticks: getCategoryXAxisTickOptions(labelCount, xTickMode),
          },
          undefined,
          'category',
          theme,
        ),
        yPower: themedScale(
          {
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'kW',
              color: isDark ? '#c4b5fd' : '#7c3aed',
              font: { size: 11, weight: '600' },
            },
            ticks: {
              padding: 4,
              precision: 0,
              callback: (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return value;
                if (Math.abs(n - Math.round(n)) > 1e-6) return '';
                return String(Math.round(n));
              },
            },
          },
          undefined,
          'linear',
          theme,
        ),
        yCurrent: themedScale(
          {
            beginAtZero: true,
            position: 'right',
            title: {
              display: true,
              text: 'A',
              color: isDark ? '#ffab91' : '#ef5350',
              font: { size: 11, weight: '600' },
            },
            grid: { drawOnChartArea: false },
            ticks: {
              padding: 4,
              precision: 0,
              callback: (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return value;
                if (Math.abs(n - Math.round(n)) > 1e-6) return '';
                return String(Math.round(n));
              },
            },
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [theme, isDark, xTickMode, labelCount, categoryPrefix, labels, zoomPluginOptions],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart
        ref={chartRef}
        key={theme}
        type="line"
        data={data}
        options={options}
        style={{ position: 'relative' }}
      />
    </div>
  );
}
