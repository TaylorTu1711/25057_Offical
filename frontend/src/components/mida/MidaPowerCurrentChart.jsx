import React, { useEffect, useMemo, useRef } from 'react';
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

/** Headroom trên đỉnh: công suất ít hơn → đường cao hơn; dòng điện nhiều hơn → đường thấp hơn, tránh trùng. */
const Y_AXIS_HEADROOM = {
  yPower: 0.1,
  yCurrent: 0.42,
};

/** Các bước thời gian "đẹp" (ms) để canh mốc lưới theo giờ tròn. */
const TIME_STEPS_MS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600].map(
  (s) => s * 1000,
);

/** Chọn bước lưới sao cho có ~6–8 mốc trong khoảng đang nhìn. */
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
 * Tính min/max ổn định cho 1 trục — có hysteresis: giữ trần cũ nếu đỉnh còn trong [55%,100%] trần.
 * Trả null khi không có dữ liệu (để Chart.js tự scale).
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
 * Biểu đồ đường kép: Công suất (kW) + Dòng điện (A) — trục X thời gian tuyến tính (ms),
 * cửa sổ trượt trái liên tục theo thời gian thực.
 * @param {number[]} timestamps epoch-ms của từng mẫu
 * @param {number} windowMs độ rộng cửa sổ hiển thị (ms); dùng để cuộn liên tục
 * @param {boolean} live true = đang realtime (tự cuộn); false = đang tương tác (giữ nguyên vùng zoom)
 */
export default function MidaPowerCurrentChart({
  timestamps = [],
  powerValues = [],
  currentValues = [],
  windowMs = null,
  live = true,
}) {
  const { theme } = useTheme();
  const isDark = isDarkChartTheme(theme);
  const chartRef = useRef(null);

  const liveRef = useRef(live);
  liveRef.current = live;
  const windowMsRef = useRef(windowMs);
  windowMsRef.current = windowMs;

  // Thang Y ổn định (hysteresis) — tính trong React để không bị re-render mỗi giây ghi đè
  const yBoundsRef = useRef({ yPower: null, yCurrent: null });
  const yBounds = useMemo(() => {
    const yPower = computeStableBound(powerValues, Y_AXIS_HEADROOM.yPower, yBoundsRef.current.yPower);
    const yCurrent = computeStableBound(currentValues, Y_AXIS_HEADROOM.yCurrent, yBoundsRef.current.yCurrent);
    yBoundsRef.current = { yPower, yCurrent };
    return { yPower, yCurrent };
  }, [powerValues, currentValues]);

  const data = useMemo(() => {
    const toPoints = (values) =>
      timestamps.map((t, i) => {
        const y = values[i];
        return { x: t, y: Number.isFinite(Number(y)) ? Number(y) : null };
      });
    return {
      datasets: [
        {
          type: 'line',
          label: 'Công suất (kW)',
          data: toPoints(powerValues),
          yAxisID: 'yPower',
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.10)',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0,
          fill: timestamps.length <= 600,
          spanGaps: true,
          parsing: false,
          normalized: true,
          datalabels: { display: false },
        },
        {
          type: 'line',
          label: 'Dòng điện (A)',
          data: toPoints(currentValues),
          yAxisID: 'yCurrent',
          borderColor: '#ef5350',
          backgroundColor: 'rgba(239, 83, 80, 0.10)',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#ef5350',
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0,
          fill: timestamps.length <= 600,
          spanGaps: true,
          parsing: false,
          normalized: true,
          datalabels: { display: false },
        },
      ],
    };
  }, [timestamps, powerValues, currentValues]);

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      // Realtime: vẽ tức thì, không animation → cửa sổ trượt mượt do RAF điều khiển
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
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
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
    [theme, isDark, yBounds],
  );

  // Cuộn cửa sổ liên tục theo thời gian thực (chỉ khi live). Tự giảm nhịp cập nhật
  // khi bước dịch < 0.5px (cửa sổ rộng) để không tốn CPU vô ích.
  useEffect(() => {
    let raf;
    let lastApply = 0;
    const tick = () => {
      const chart = chartRef.current;
      const w = windowMsRef.current;
      if (chart && liveRef.current && Number.isFinite(w) && w > 0) {
        const now = Date.now();
        const area = chart.chartArea;
        const widthPx = area ? Math.max(1, area.right - area.left) : 300;
        const pxPerMs = widthPx / w;
        if (lastApply === 0 || (now - lastApply) * pxPerMs >= 0.5) {
          const x = chart.options?.scales?.x;
          if (x) {
            x.min = now - w;
            x.max = now;
            chart.update('none');
            lastApply = now;
          }
        }
      } else {
        lastApply = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
