import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import useSyncChartTheme from '../../hooks/useSyncChartTheme';
import {
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getChartLegendOptions,
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

const Y_AXIS_HEADROOM = {
  yPower: 0.1,
  yCurrent: 0.42,
};

const TIME_STEPS_MS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600].map(
  (s) => s * 1000,
);

function chooseTimeStep(spanMs) {
  for (const s of TIME_STEPS_MS) {
    if (spanMs / s <= 8) return s;
  }
  return TIME_STEPS_MS[TIME_STEPS_MS.length - 1];
}

function formatClock(ms, withSeconds) {
  return new Date(ms).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

function roundSigUp(v, sig = 2) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const exp = Math.floor(Math.log10(v)) - (sig - 1);
  const step = Math.pow(10, exp);
  return Math.ceil(v / step) * step;
}

function roundSigDown(v, sig = 2) {
  if (!Number.isFinite(v) || v === 0) return 0;
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log10(abs)) - (sig - 1);
  const step = Math.pow(10, exp);
  return Math.sign(v) * Math.floor(abs / step) * step;
}

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
 * Biểu đồ công suất / dòng điện theo khoảng thời gian.
 * Zoom/pan → tự tạm dừng cập nhật live; bấm nút để chạy lại + reset zoom.
 */
export default function MidaPowerCurrentChart({
  timestamps = [],
  powerValues = [],
  currentValues = [],
}) {
  const { theme } = useTheme();
  const isDark = isDarkChartTheme(theme);
  const chartRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const latestPropsRef = useRef({ timestamps, powerValues, currentValues });
  const frozenRef = useRef({
    timestamps,
    powerValues,
    currentValues,
  });

  latestPropsRef.current = { timestamps, powerValues, currentValues };
  pausedRef.current = paused;

  // Khi đang chạy: luôn bám props mới. Khi tạm dừng: giữ snapshot.
  useEffect(() => {
    if (paused) return;
    frozenRef.current = { timestamps, powerValues, currentValues };
  }, [paused, timestamps, powerValues, currentValues]);

  const display = paused
    ? frozenRef.current
    : { timestamps, powerValues, currentValues };

  const pauseLive = useCallback(() => {
    if (pausedRef.current) return;
    frozenRef.current = { ...latestPropsRef.current };
    setPaused(true);
  }, []);

  const resumeLive = useCallback(() => {
    const chart = chartRef.current;
    if (chart?.resetZoom) {
      chart.resetZoom('none');
    }
    frozenRef.current = { ...latestPropsRef.current };
    setPaused(false);
  }, []);

  const yBoundsRef = useRef({ yPower: null, yCurrent: null });
  const yBounds = useMemo(() => {
    const yPower = computeStableBound(
      display.powerValues,
      Y_AXIS_HEADROOM.yPower,
      yBoundsRef.current.yPower,
    );
    const yCurrent = computeStableBound(
      display.currentValues,
      Y_AXIS_HEADROOM.yCurrent,
      yBoundsRef.current.yCurrent,
    );
    yBoundsRef.current = { yPower, yCurrent };
    return { yPower, yCurrent };
  }, [display.powerValues, display.currentValues]);

  const data = useMemo(() => {
    const toPoints = (values) =>
      display.timestamps.map((t, i) => {
        const y = values[i];
        return { x: t, y: Number.isFinite(Number(y)) ? Number(y) : null };
      });
    return {
      datasets: [
        {
          type: 'line',
          label: 'Công suất (kW)',
          data: toPoints(display.powerValues),
          yAxisID: 'yPower',
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.10)',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0,
          fill: display.timestamps.length <= 600,
          spanGaps: true,
          parsing: false,
          normalized: true,
          datalabels: { display: false },
        },
        {
          type: 'line',
          label: 'Dòng điện (A)',
          data: toPoints(display.currentValues),
          yAxisID: 'yCurrent',
          borderColor: '#ef5350',
          backgroundColor: 'rgba(239, 83, 80, 0.10)',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#ef5350',
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0,
          fill: display.timestamps.length <= 600,
          spanGaps: true,
          parsing: false,
          normalized: true,
          datalabels: { display: false },
        },
      ],
    };
  }, [display.timestamps, display.powerValues, display.currentValues]);

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
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
            title: (items) => {
              const x = items?.[0]?.parsed?.x ?? items?.[0]?.raw?.x;
              return Number.isFinite(x) ? formatClock(x, true) : '';
            },
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v == null || Number.isNaN(v)) return null;
              const unit = ctx.dataset.yAxisID === 'yCurrent' ? 'A' : 'kW';
              return `${ctx.dataset.label}: ${formatChartTooltipValue(v)} ${unit}`;
            },
          },
        },
        zoom: {
          limits: { x: { minRange: 10_000 } },
          pan: {
            enabled: true,
            mode: 'x',
            onPanStart: () => {
              pauseLive();
            },
            onPanComplete: () => {
              pauseLive();
            },
          },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: true },
            drag: {
              enabled: true,
              backgroundColor: 'rgba(220, 38, 38, 0.12)',
              borderColor: 'rgba(220, 38, 38, 0.45)',
              borderWidth: 1,
            },
            mode: 'x',
            onZoomStart: () => {
              pauseLive();
            },
            onZoomComplete: () => {
              pauseLive();
            },
          },
        },
      },
      scales: {
        x: themedXScale(
          {
            type: 'linear',
            bounds: 'data',
            offset: false,
            afterBuildTicks: (scale) => {
              const { min, max } = scale;
              if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
              const step = chooseTimeStep(max - min);
              const first = Math.ceil(min / step) * step;
              const out = [];
              for (let v = first; v <= max + 1; v += step) out.push({ value: v });
              scale.ticks = out;
            },
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,
              includeBounds: false,
              font: { size: 9 },
              padding: 2,
              callback: function tickLabel(value) {
                const span = this.max - this.min;
                return formatClock(value, chooseTimeStep(span) < 60000);
              },
            },
          },
          undefined,
          'linear',
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
    [theme, isDark, yBounds, pauseLive],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <div
      className="mida-power-chart"
      onMouseEnter={pauseLive}
      onMouseLeave={resumeLive}
      onTouchStart={pauseLive}
    >
      {paused ? (
        <button
          type="button"
          className="mida-power-chart__resume"
          onClick={(e) => {
            e.stopPropagation();
            resumeLive();
          }}
          title="Chạy lại cập nhật realtime và reset zoom"
        >
          Tạm dừng — bấm để chạy lại
        </button>
      ) : null}
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
