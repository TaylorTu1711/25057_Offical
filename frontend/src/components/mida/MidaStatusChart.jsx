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
} from '../../utils/chartTheme';
import {
  formatMidaLiveClock,
  getMidaLiveTimeXScaleConfig,
} from '../../utils/midaLiveChartAxis';
import { getStatusChartLabel } from '../../utils/machineStatus';

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

const STATUS_CHART_TICKS = { 1: 'Dừng', 2: 'Quay' };

/** Nén đỉnh bước để đường ngang/dọc gọn, không tô kín như sample 10s dày. */
function toStatusStepPoints(timestamps, values) {
  const pts = [];
  const n = timestamps?.length ?? 0;
  if (n === 0) return pts;

  let runStart = 0;
  for (let i = 1; i <= n; i += 1) {
    const ended = i === n || values[i] !== values[runStart];
    if (!ended) continue;

    const yRaw = values[runStart];
    const y = Number(yRaw);
    if (yRaw != null && Number.isFinite(y)) {
      pts.push({ x: timestamps[runStart], y });
      const runEnd = i - 1;
      if (runEnd !== runStart) {
        pts.push({ x: timestamps[runEnd], y });
      }
      if (i < n) {
        const nextY = Number(values[i]);
        if (values[i] != null && Number.isFinite(nextY) && nextY !== y) {
          pts.push({ x: timestamps[i], y });
        }
      }
    }
    runStart = i;
  }
  return pts;
}

/**
 * Biểu đồ trạng thái — cùng khung/trục/zoom/pause với biểu đồ công suất.
 * Chỉ khác dữ liệu (Stop/Auto) và nhãn trục Y.
 */
export default function MidaStatusChart({
  timestamps = [],
  statusValues = [],
}) {
  const { theme } = useTheme();
  const chartRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const latestPropsRef = useRef({ timestamps, statusValues });
  const frozenRef = useRef({
    timestamps,
    statusValues,
  });

  latestPropsRef.current = { timestamps, statusValues };
  pausedRef.current = paused;

  useEffect(() => {
    if (paused) return;
    frozenRef.current = { timestamps, statusValues };
  }, [paused, timestamps, statusValues]);

  const display = paused
    ? frozenRef.current
    : { timestamps, statusValues };

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

  const data = useMemo(() => {
    const points = toStatusStepPoints(display.timestamps, display.statusValues);
    return {
      datasets: [
        {
          type: 'line',
          label: 'Trạng thái',
          data: points,
          yAxisID: 'yStatus',
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.10)',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0,
          fill: false,
          spanGaps: true,
          parsing: false,
          normalized: true,
          datalabels: { display: false },
        },
      ],
    };
  }, [display.timestamps, display.statusValues]);

  const xMin = display.timestamps.length ? display.timestamps[0] : undefined;
  const xMax = display.timestamps.length
    ? display.timestamps[display.timestamps.length - 1]
    : undefined;

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
      elements: {
        line: { fill: false },
      },
      plugins: {
        filler: { propagate: false },
        legend: getChartLegendOptions({ labels: { padding: 6, font: { size: 10 } } }, theme),
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const x = items?.[0]?.parsed?.x ?? items?.[0]?.raw?.x;
              return Number.isFinite(x) ? formatMidaLiveClock(x, true) : '';
            },
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v == null || Number.isNaN(v)) return null;
              return `${ctx.dataset.label}: ${getStatusChartLabel(v)}`;
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
            ...getMidaLiveTimeXScaleConfig(),
            min: xMin,
            max: xMax,
          },
          undefined,
          'linear',
          theme,
        ),
        yStatus: themedScale(
          {
            beginAtZero: false,
            position: 'left',
            min: 1,
            max: 2,
            title: {
              display: false,
            },
            ticks: {
              stepSize: 1,
              padding: 4,
              font: { size: 9 },
              callback: (value) => STATUS_CHART_TICKS[value] ?? '',
            },
            grid: {
              display: true,
              drawOnChartArea: true,
            },
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [theme, pauseLive, xMin, xMax],
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
