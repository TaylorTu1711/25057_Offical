import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
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

/** Headroom trên đỉnh: công suất ít hơn → đường cao hơn; dòng điện nhiều hơn → đường thấp hơn, tránh trùng. */
const Y_AXIS_HEADROOM = {
  yPower: 0.1,
  yCurrent: 0.42,
};

/** Làm tròn lên theo 2 chữ số có nghĩa → thang đo "đẹp", ít đổi vặt. */
function roundSigUp(v, sig = 2) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const exp = Math.floor(Math.log10(v)) - (sig - 1);
  const step = Math.pow(10, exp);
  return Math.ceil(v / step) * step;
}

/** Làm tròn xuống theo 2 chữ số có nghĩa (cho min âm). */
function roundSigDown(v, sig = 2) {
  if (!Number.isFinite(v) || v === 0) return 0;
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log10(abs)) - (sig - 1);
  const step = Math.pow(10, exp);
  return Math.sign(v) * Math.floor(abs / step) * step;
}

/**
 * Tính min/max ổn định cho 1 trục từ mảng giá trị — có hysteresis:
 * giữ nguyên trần cũ nếu đỉnh còn trong [55%, 100%] trần; ngược lại tính lại.
 * Trả về null nếu không có dữ liệu (để Chart.js tự scale).
 */
function computeStableBound(values, headroom, prev) {
  let hi = -Infinity;
  let lo = Infinity;
  for (const raw of values || []) {
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (v > hi) hi = v;
    if (v < lo) lo = v;
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || (hi <= 0 && lo >= 0)) {
    return null;
  }

  let max;
  if (prev && hi <= prev.max && hi >= prev.max * 0.55) {
    max = prev.max;
  } else {
    max = roundSigUp(hi * (1 + headroom), 2);
  }

  let min;
  if (lo >= 0) {
    min = 0;
  } else if (prev && prev.min < 0 && lo >= prev.min && lo <= prev.min * 0.55) {
    min = prev.min;
  } else {
    const pad = Math.max(Math.abs(hi - lo) * headroom, Math.abs(lo) * 0.05, 0.1);
    min = roundSigDown(lo - pad, 2);
  }

  return { min, max };
}

/**
 * Tự chỉnh min/max trục Y theo khoảng X đang nhìn — có "hysteresis":
 * chỉ đổi thang khi dữ liệu vượt trần hiện tại hoặc tụt sâu (<55%),
 * tránh trục nhảy mỗi giây gây giật dọc.
 */
function fitYAxesToVisibleX(chart) {
  const xScale = chart?.scales?.x;
  if (!xScale) return;

  const n = chart.data?.labels?.length ?? 0;
  if (n <= 0) return;

  const i0 = Math.max(0, Math.floor(Math.min(xScale.min, xScale.max)));
  const i1 = Math.min(n - 1, Math.ceil(Math.max(xScale.min, xScale.max)));

  if (!chart.$yBounds) chart.$yBounds = {};
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
      chart.$yBounds[axisId] = null;
      if (scale.options.min != null || scale.options.max != null) {
        scale.options.min = undefined;
        scale.options.max = undefined;
        changed = true;
      }
      continue;
    }

    const headroom = Y_AXIS_HEADROOM[axisId] ?? 0.15;
    const prev = chart.$yBounds[axisId];

    // Trần: giữ nguyên nếu hi còn trong dải [55% trần, trần]; ngược lại tính lại
    let nextMax;
    if (prev && hi <= prev.max && hi >= prev.max * 0.55) {
      nextMax = prev.max;
    } else {
      nextMax = roundSigUp(hi * (1 + headroom), 2);
    }

    // Sàn: dữ liệu dương → 0; có giá trị âm → làm tròn xuống, giữ hysteresis
    let nextMin;
    if (lo >= 0) {
      nextMin = 0;
    } else if (prev && prev.min < 0 && lo >= prev.min && lo <= prev.min * 0.55) {
      nextMin = prev.min;
    } else {
      const pad = Math.max(Math.abs(hi - lo) * headroom, Math.abs(lo) * 0.05, 0.1);
      nextMin = roundSigDown(lo - pad, 2);
    }

    chart.$yBounds[axisId] = { min: nextMin, max: nextMax };

    if (scale.options.min !== nextMin || scale.options.max !== nextMax) {
      scale.options.min = nextMin;
      scale.options.max = nextMax;
      changed = true;
    }
  }

  if (changed) chart.update('none');
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

  // Thang Y ổn định (hysteresis) — tính trong React để không bị re-render mỗi giây ghi đè
  const yBoundsRef = useRef({ yPower: null, yCurrent: null });
  const yBounds = useMemo(() => {
    const yPower = computeStableBound(powerValues, Y_AXIS_HEADROOM.yPower, yBoundsRef.current.yPower);
    const yCurrent = computeStableBound(currentValues, Y_AXIS_HEADROOM.yCurrent, yBoundsRef.current.yCurrent);
    yBoundsRef.current = { yPower, yCurrent };
    return { yPower, yCurrent };
  }, [powerValues, currentValues]);

  const handleZoomOrPan = useCallback((ctx) => {
    fitYAxesToVisibleX(ctx.chart);
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

  // Chỉ tự-fit theo vùng nhìn khi người dùng đã zoom (x không còn full range)
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return undefined;
    const x = chart.scales?.x;
    const n = chart.data?.labels?.length ?? 0;
    const isFull = !x || n <= 1 || (x.min <= 0.01 && x.max >= n - 1.01);
    if (isFull) return undefined;
    const id = requestAnimationFrame(() => fitYAxesToVisibleX(chart));
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
      // Realtime 1s: vẽ tức thì, không morph toàn đường (tránh giật); cửa sổ dịch trái từng giây
      animation: false,
      animations: {},
      transitions: {
        active: { animation: { duration: 150 } },
        resize: { animation: { duration: 0 } },
      },
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
            min: yBounds.yPower?.min,
            max: yBounds.yPower?.max,
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
            // Headroom đã tính sẵn trong yBounds → đường dòng điện thấp hơn, tách khỏi công suất
            min: yBounds.yCurrent?.min,
            max: yBounds.yCurrent?.max,
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
    [theme, isDark, xTickMode, labelCount, categoryPrefix, labels, zoomPluginOptions, yBounds],
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
