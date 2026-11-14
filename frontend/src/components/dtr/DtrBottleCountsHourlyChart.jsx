import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import useTheme from '../../hooks/useTheme';
import useSyncChartTheme from '../../hooks/useSyncChartTheme';
import useChartZoomPreserve from '../../hooks/useChartZoomPreserve';
import {
  chartStackedBarAnimationOptions,
  themedScale,
  themedXScale,
} from '../../utils/chartTheme';
import { resolveBottleGlossary } from '../../utils/dtrBottleGlossary';

function ensureBottleTooltipEl() {
  let el = document.getElementById('dtr-bottle-tooltip');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'dtr-bottle-tooltip';
  el.className = 'dtr-bottle-tooltip';
  el.style.opacity = '0';
  document.body.appendChild(el);
  return el;
}

/** Tooltip HTML 2 cột — tránh list dài tràn màn hình. */
function renderBottleTooltip({ chart, tooltip }, theme) {
  const el = ensureBottleTooltipEl();
  if (tooltip.opacity === 0) {
    el.style.opacity = '0';
    return;
  }

  const title = tooltip.title?.[0] || '';
  const allItems = tooltip.dataPoints || [];
  // Chỉ lấy loại có số lượng > 0; cột trống thì không hiện tooltip
  const items = allItems.filter((it) => (Number(it.raw) || 0) > 0);
  const total = items.reduce((sum, it) => sum + (Number(it.raw) || 0), 0);
  if (!items.length || total <= 0) {
    el.style.opacity = '0';
    return;
  }

  const isDark = theme === 'dark';
  const rowsHtml = items
    .map((it) => {
      const color = it.dataset?.backgroundColor || '#94a3b8';
      const label = it.dataset?.label || '';
      const value = (Number(it.raw) || 0).toLocaleString('vi-VN');
      return `<div class="dtr-bottle-tooltip__item">
        <span class="dtr-bottle-tooltip__swatch" style="background:${color}"></span>
        <span class="dtr-bottle-tooltip__label">${label}</span>
        <span class="dtr-bottle-tooltip__value">${value}</span>
      </div>`;
    })
    .join('');

  el.className = `dtr-bottle-tooltip${isDark ? ' dtr-bottle-tooltip--dark' : ''}`;
  el.innerHTML = `
    <div class="dtr-bottle-tooltip__title">${title}</div>
    <div class="dtr-bottle-tooltip__grid">${rowsHtml}</div>
    <div class="dtr-bottle-tooltip__footer">Tổng: ${total.toLocaleString('vi-VN')}</div>
  `;

  const canvasRect = chart.canvas.getBoundingClientRect();
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  el.style.opacity = '1';
  el.style.left = `${canvasRect.left + scrollX + tooltip.caretX + 12}px`;
  el.style.top = `${canvasRect.top + scrollY + tooltip.caretY + 12}px`;

  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    let left = canvasRect.left + scrollX + tooltip.caretX + 12;
    let top = canvasRect.top + scrollY + tooltip.caretY + 12;
    if (rect.right > window.innerWidth - 8) {
      left = scrollX + window.innerWidth - rect.width - 8;
    }
    if (rect.bottom > window.innerHeight - 8) {
      top = scrollY + window.innerHeight - rect.height - 8;
    }
    if (left < scrollX + 8) left = scrollX + 8;
    if (top < scrollY + 8) top = scrollY + 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
);

/** Màu legend khớp biểu đồ loại chai (Grafana). */
export const DTR_BOTTLE_COUNT_COLORS = {
  b1_kn: '#34b4eb',
  zz_nap: '#2ecc71',
  b1_nl: '#9b59b6',
  b5_nl: '#e84393',
  b5_kn: '#f1c40f',
  no_classify: '#eb4d4b',
  b1_nn: '#1abc9c',
  ptp: '#6c5ce7',
  b4_kn: '#a29bfe',
  b4_nl: '#74b9ff',
  b1_oh: '#e67e22',
  b5_nn: '#d63031',
  hu_nl: '#0984e3',
  hu_kn: '#55efc4',
  zz_cochai: '#fab1a0',
  b4_nn: '#00cec9',
  b4_oh: '#00b894',
};

const FALLBACK_COLORS = [
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#e74c3c',
  '#f39c12',
  '#1abc9c',
  '#8e44ad',
  '#16a085',
  '#c0392b',
  '#27ae60',
];

function displayKey(key) {
  return String(key || '').toUpperCase();
}

function colorForKey(key, index) {
  const k = String(key || '').toLowerCase();
  if (DTR_BOTTLE_COUNT_COLORS[k]) return DTR_BOTTLE_COUNT_COLORS[k];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function buildGlossaryLabelMap(bottleGlossary) {
  const map = {};
  for (const item of resolveBottleGlossary(bottleGlossary)) {
    map[String(item.key).toLowerCase()] = item.meaning || item.label || displayKey(item.key);
  }
  return map;
}

/** Legend / tooltip: ưu tiên tên chi tiết (vd. B1 Không nhãn). */
function displayBottleLabel(key, glossaryByKey) {
  const k = String(key || '').toLowerCase();
  const meaning = glossaryByKey?.[k];
  if (meaning) return meaning;
  return displayKey(key);
}

/** Tiêu đề tooltip theo mode xem (tránh luôn hiện «Giờ …»). */
export function formatBottleBucketTooltipTitle(label, mode = 'hour') {
  const raw = String(label || '').trim();
  if (!raw) return '';
  switch (String(mode || '').toLowerCase()) {
    case 'day':
      return `Ngày ${raw}`;
    case 'week':
      return raw.toUpperCase().startsWith('T')
        ? `Tuần ${raw.replace(/^t/i, '')}`
        : `Tuần ${raw}`;
    case 'month':
      return `Tháng ${raw}`;
    case 'quarter':
      return raw.toUpperCase().startsWith('Q')
        ? `Quý ${raw.replace(/^q/i, '')}`
        : `Quý ${raw}`;
    case 'year':
      return `Năm ${raw}`;
    case 'hour':
    default:
      return raw.toLowerCase().endsWith('h') ? `Giờ ${raw}` : `Giờ ${raw}`;
  }
}

/**
 * Stacked bar: số lượng từng loại chai theo giờ / ngày / …
 * @param {{ labels: string[], keys: string[], series: Record<string, number[]>, mode?: string }} props
 */
function normBottleKey(key) {
  return String(key || '').toLowerCase();
}

export default function DtrBottleCountsHourlyChart({
  labels = [],
  keys = [],
  series = {},
  mode = 'hour',
  hideLegend = false,
  hiddenKeys = null,
  onToggleKey = null,
  bottleGlossary = null,
}) {
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const glossaryByKey = useMemo(
    () => buildGlossaryLabelMap(bottleGlossary),
    [bottleGlossary],
  );
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, keys, series],
    'x',
  );

  const externalTooltip = useCallback((context) => {
    renderBottleTooltip(context, themeRef.current);
  }, []);

  useEffect(() => () => {
    const el = document.getElementById('dtr-bottle-tooltip');
    if (el) el.style.opacity = '0';
  }, []);

  const isKeyHidden = useCallback(
    (key) => {
      if (!hiddenKeys || typeof hiddenKeys.has !== 'function') return false;
      return hiddenKeys.has(normBottleKey(key));
    },
    [hiddenKeys],
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: keys.map((key, index) => ({
        label: displayBottleLabel(key, glossaryByKey),
        data: series[key] || labels.map(() => 0),
        backgroundColor: colorForKey(key, index),
        borderColor: colorForKey(key, index),
        borderWidth: 0,
        stack: 'counts',
        hidden: isKeyHidden(key),
        barPercentage: 0.85,
        categoryPercentage: 0.9,
      })),
    }),
    [labels, keys, series, isKeyHidden, glossaryByKey],
  );

  const options = useMemo(
    () => ({
      ...chartStackedBarAnimationOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: externalTooltip,
          callbacks: {
            title: (items) => formatBottleBucketTooltipTitle(items?.[0]?.label, mode),
          },
        },
        datalabels: { display: false },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: {
          ...themedXScale(theme),
          stacked: true,
          grid: { display: false },
          ticks: {
            ...themedXScale(theme).ticks,
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: 4,
            font: { size: 10 },
          },
        },
        y: {
          ...themedScale(theme),
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Số lượng',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',            font: { size: 11 },
          },
          ticks: {
            ...themedScale(theme).ticks,
            callback: (value) => Number(value).toLocaleString('vi-VN'),
          },
        },
      },
    }),
    [theme, zoomPluginOptions, externalTooltip, mode],
  );

  useSyncChartTheme(chartRef, theme, options);

  const legendCols = Math.max(1, Math.ceil(keys.length / 2));
  const labelColor = theme === 'dark' ? '#e2e8f0' : '#334155';

  return (
    <div className="dtr-bottle-chart">
      {!hideLegend && keys.length > 0 ? (
        <div
          className="dtr-bottle-chart__legend"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${legendCols}, max-content)`,
            gridTemplateRows: 'auto auto',
            columnGap: 14,
            rowGap: 4,
            justifyContent: 'center',
            marginBottom: 6,
            padding: '0 2px',
          }}
          role="list"
          aria-label="Chú thích loại chai"
        >
          {keys.map((key, index) => {
            const hidden = isKeyHidden(key);
            const label = displayBottleLabel(key, glossaryByKey);
            return (
              <button
                key={key}
                type="button"
                className={`dtr-bottle-chart__legend-item${hidden ? ' is-hidden' : ''}`}
                role="listitem"
                aria-pressed={!hidden}
                title={hidden ? `Hiện ${label}` : `Ẩn ${label}`}
                onClick={() => onToggleKey?.(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 9,
                  lineHeight: 1.15,
                  color: labelColor,
                  whiteSpace: 'nowrap',
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: onToggleKey ? 'pointer' : 'default',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: colorForKey(key, index),
                    flexShrink: 0,
                  }}
                />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="dtr-bottle-chart__plot">
        <Chart ref={chartRef} type="bar" data={data} options={options} />
      </div>
    </div>
  );
}

/**
 * Legend kèm cột TỔNG: ưu tiên 2 hàng; hẹp / nhiều item → 3 hoặc 4 hàng.
 * Luôn nằm trong vùng plot, không tràn sang cột TỔNG.
 */
export function DtrBottleCountsLegend({
  keys = [],
  theme = 'light',
  hiddenKeys = null,
  onToggleKey = null,
  bottleGlossary = null,
}) {
  const legendRef = useRef(null);
  const [rows, setRows] = useState(2);
  const COL_GAP = 10;
  const MAX_ROWS = 4;
  const glossaryByKey = useMemo(
    () => buildGlossaryLabelMap(bottleGlossary),
    [bottleGlossary],
  );

  const isKeyHidden = (key) => {
    if (!hiddenKeys || typeof hiddenKeys.has !== 'function') return false;
    return hiddenKeys.has(normBottleKey(key));
  };

  useLayoutEffect(() => {
    const el = legendRef.current;
    if (!el || !keys.length) return undefined;

    /** Độ rộng grid khi flow cột với `rowCount` hàng. */
    const widthForRows = (widths, rowCount) => {
      const cols = Math.max(1, Math.ceil(widths.length / rowCount));
      let total = 0;
      for (let c = 0; c < cols; c += 1) {
        let colW = 0;
        for (let r = 0; r < rowCount; r += 1) {
          colW = Math.max(colW, widths[c * rowCount + r] || 0);
        }
        total += colW + (c > 0 ? COL_GAP : 0);
      }
      return total;
    };

    const measure = () => {
      const available = el.clientWidth;
      if (!(available > 0)) return;

      const items = [...el.querySelectorAll('.dtr-bottle-chart__legend-item')];
      if (!items.length) return;

      const widths = items.map((node) => Math.ceil(node.getBoundingClientRect().width));
      let next = MAX_ROWS;
      for (let r = 2; r <= MAX_ROWS; r += 1) {
        if (widthForRows(widths, r) <= available) {
          next = r;
          break;
        }
      }
      setRows(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [keys, glossaryByKey]);

  if (!keys.length) return null;
  const legendCols = Math.max(1, Math.ceil(keys.length / rows));
  const labelColor = theme === 'dark' ? '#e2e8f0' : '#334155';
  return (
    <div
      ref={legendRef}
      className="dtr-bottle-chart__legend dtr-bottle-chart__legend--with-total"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${legendCols}, max-content)`,
        gridTemplateRows: `repeat(${rows}, auto)`,
        gridAutoFlow: 'column',
        columnGap: COL_GAP,
        rowGap: 3,
        justifyContent: 'center',
        marginBottom: 6,
        padding: '0 2px',
      }}
      role="list"
      aria-label="Chú thích loại chai"
    >
      {keys.map((key, index) => {
        const hidden = isKeyHidden(key);
        const label = displayBottleLabel(key, glossaryByKey);
        return (
          <button
            key={key}
            type="button"
            className={`dtr-bottle-chart__legend-item${hidden ? ' is-hidden' : ''}`}
            role="listitem"
            aria-pressed={!hidden}
            title={hidden ? `Hiện ${label}` : `Ẩn ${label}`}
            onClick={() => onToggleKey?.(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              lineHeight: 1.15,
              color: labelColor,
              whiteSpace: 'nowrap',
              appearance: 'none',
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: onToggleKey ? 'pointer' : 'default',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: colorForKey(key, index),
                flexShrink: 0,
              }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
