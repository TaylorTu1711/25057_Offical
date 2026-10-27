import React, { useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import MidaChartExpand from './MidaChartExpand';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
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
import useChartZoomPreserve from '../../hooks/useChartZoomPreserve';
import useSyncChartTheme from '../../hooks/useSyncChartTheme';
import {
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  getCategoryTooltipTitleCallback,
  getBarColumnDataLabelOptions,
  createNeonBarGradient,
  createNeonBarHoverGradient,
  NEON_BAR_GRADIENTS,
  TIME_CHART_COLORS,
} from '../../utils/chartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  ChartDataLabels,
);

const UNIT_PCT = 'pct';
const UNIT_HOURS = 'hours';

const cutPalette = NEON_BAR_GRADIENTS.neonGreen;
const setupPalette = NEON_BAR_GRADIENTS.neonAmber;
const stopPalette = NEON_BAR_GRADIENTS.neonRed;

function calcAverages(cutValues = [], setupValues = [], stopValues = [], { asPercent = false } = {}) {
  let cutSum = 0;
  let setupSum = 0;
  let stopSum = 0;
  let n = 0;
  const len = Math.max(cutValues.length, setupValues.length, stopValues.length);
  for (let i = 0; i < len; i += 1) {
    const cut = Number(cutValues[i]) || 0;
    const setup = Number(setupValues[i]) || 0;
    const stop = Number(stopValues[i]) || 0;
    if (cut + setup + stop <= 0) continue;
    cutSum += cut;
    setupSum += setup;
    stopSum += stop;
    n += 1;
  }
  if (n <= 0) return { cut: 0, setup: 0, stop: 0, hasData: false };

  if (asPercent) {
    const cut = Number((cutSum / n).toFixed(1));
    const setup = Number((setupSum / n).toFixed(1));
    return {
      cut,
      setup,
      stop: Number(Math.max(0, 100 - cut - setup).toFixed(1)),
      hasData: true,
    };
  }

  return {
    cut: Number((cutSum / n).toFixed(1)),
    setup: Number((setupSum / n).toFixed(1)),
    stop: Number((stopSum / n).toFixed(1)),
    hasData: true,
  };
}

function formatHourLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 100) return `${Math.round(n)}h`;
  return `${Number(n.toFixed(1))}h`;
}

/**
 * Cột xếp chồng: % hoặc giờ Cắt gọt (dưới) + Setup + Ngưng (trên).
 * Bên phải: ô TRUNG BÌNH trong cửa sổ đang chọn.
 */
export default function MidaRunStopStackedBar({
  labels = [],
  cutPctValues = [],
  setupPctValues = [],
  stopPctValues = [],
  cutHourValues = [],
  setupHourValues = [],
  stopHourValues = [],
  xTickMode = 'month',
  categoryPrefix = '',
}) {
  const { theme } = useTheme();
  const [unitMode, setUnitMode] = useState(UNIT_PCT);
  const isHours = unitMode === UNIT_HOURS;

  const cutValues = isHours ? cutHourValues : cutPctValues;
  const setupValues = isHours ? setupHourValues : setupPctValues;
  const stopValues = isHours ? stopHourValues : stopPctValues;

  const averages = useMemo(
    () => calcAverages(cutValues, setupValues, stopValues, { asPercent: !isHours }),
    [cutValues, setupValues, stopValues, isHours],
  );

  const yMaxHours = useMemo(() => {
    let max = 0;
    const len = Math.max(cutHourValues.length, setupHourValues.length, stopHourValues.length);
    for (let i = 0; i < len; i += 1) {
      const total = (Number(cutHourValues[i]) || 0)
        + (Number(setupHourValues[i]) || 0)
        + (Number(stopHourValues[i]) || 0);
      if (total > max) max = total;
    }
    if (max <= 0) return 1;
    if (max <= 1) return 1;
    if (max <= 2) return 2;
    if (max <= 5) return Math.ceil(max);
    return Math.ceil(max * 1.05);
  }, [cutHourValues, setupHourValues, stopHourValues]);

  const { chartRef, zoomPluginOptions, zoomedScaleProps } = useChartZoomPreserve(
    [labels, cutValues, setupValues, stopValues, unitMode],
    'x',
  );
  const xZoom = zoomedScaleProps?.x;

  const dataLabels = useMemo(() => {
    const base = {
      ...getBarColumnDataLabelOptions(TIME_CHART_COLORS.barDataLabel),
      rotation: -90,
      clamp: true,
    };
    if (isHours) {
      return {
        ...base,
        formatter: (value) => {
          const n = Number(value);
          if (!Number.isFinite(n) || n < yMaxHours * 0.08) return '';
          return formatHourLabel(n);
        },
      };
    }
    return {
      ...base,
      formatter: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 8) return '';
        return `${Math.round(n)}%`;
      },
    };
  }, [isHours, yMaxHours]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Cắt gọt',
          data: cutValues,
          backgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarGradient(chart.ctx, chart.chartArea, cutPalette);
          },
          borderColor: cutPalette.border,
          borderWidth: 1,
          borderSkipped: false,
          hoverBackgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarHoverGradient(chart.ctx, chart.chartArea, cutPalette);
          },
          hoverBorderColor: cutPalette.border,
          hoverBorderWidth: 2,
          stack: 'runStop',
          datalabels: dataLabels,
        },
        {
          type: 'bar',
          label: 'Setup',
          data: setupValues,
          backgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarGradient(chart.ctx, chart.chartArea, setupPalette);
          },
          borderColor: setupPalette.border,
          borderWidth: 1,
          borderSkipped: false,
          hoverBackgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarHoverGradient(chart.ctx, chart.chartArea, setupPalette);
          },
          hoverBorderColor: setupPalette.border,
          hoverBorderWidth: 2,
          stack: 'runStop',
          datalabels: dataLabels,
        },
        {
          type: 'bar',
          label: 'Ngưng',
          data: stopValues,
          backgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarGradient(chart.ctx, chart.chartArea, stopPalette);
          },
          borderColor: stopPalette.border,
          borderWidth: 1,
          borderRadius: { topLeft: 3, topRight: 3 },
          borderSkipped: false,
          hoverBackgroundColor: (context) => {
            const { chart } = context;
            return createNeonBarHoverGradient(chart.ctx, chart.chartArea, stopPalette);
          },
          hoverBorderColor: stopPalette.border,
          hoverBorderWidth: 2,
          stack: 'runStop',
          datalabels: dataLabels,
        },
      ],
    }),
    [labels, cutValues, setupValues, stopValues, dataLabels],
  );

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {
        padding: { top: 0, bottom: 0, left: 0, right: 4 },
      },
      datasets: {
        bar: {
          categoryPercentage: 0.82,
          barPercentage: 0.92,
          maxBarThickness: 72,
        },
      },
      plugins: {
        datalabels: {
          display: true,
        },
        legend: getChartLegendOptions(
          {
            labels: {
              padding: 2,
              boxWidth: 12,
              font: { size: 11 },
            },
          },
          theme,
        ),
        title: { display: false },
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (context) => {
              const raw = context.raw;
              if (raw == null || raw === '') return null;
              if (isHours) {
                return `${context.dataset.label}: ${Number(raw).toFixed(2)} giờ`;
              }
              return `${context.dataset.label}: ${Number(raw).toFixed(1)}%`;
            },
          },
        },
        zoom: zoomPluginOptions,
      },
      ...(xZoom ? { animation: false, animations: { x: false, y: false, numbers: false } } : {}),
      scales: {
        x: themedXScale(
          {
            stacked: true,
            grid: { display: false },
            ticks: getCategoryXAxisTickOptions(labels?.length ?? 0, xTickMode),
            ...(xZoom ? { min: xZoom.min, max: xZoom.max } : {}),
          },
          undefined,
          'category',
          theme,
        ),
        y: themedScale(
          {
            stacked: true,
            beginAtZero: true,
            min: 0,
            ...(isHours
              ? { max: yMaxHours, suggestedMax: yMaxHours }
              : { max: 100, suggestedMax: 100 }),
            title: {
              display: false,
            },
            ticks: {
              stepSize: isHours ? undefined : 20,
              padding: 4,
              callback: (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return value;
                return isHours ? `${n}` : `${Math.round(n)}%`;
              },
            },
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [
      theme,
      labels,
      categoryPrefix,
      xTickMode,
      zoomPluginOptions,
      xZoom,
      isHours,
      yMaxHours,
    ],
  );

  useSyncChartTheme(chartRef, theme, options);

  const totalAvg = averages.cut + averages.setup + averages.stop;
  const cutH = totalAvg > 0 ? Math.max(0, Math.min(100, (averages.cut / totalAvg) * 100)) : 0;
  const setupH = totalAvg > 0 ? Math.max(0, Math.min(100, (averages.setup / totalAvg) * 100)) : 0;
  const stopH = totalAvg > 0 ? Math.max(0, Math.min(100, (averages.stop / totalAvg) * 100)) : 0;

  const avgCutLabel = isHours
    ? formatHourLabel(averages.cut)
    : `${Math.round(averages.cut)}%`;
  const avgSetupLabel = isHours
    ? formatHourLabel(averages.setup)
    : `${Math.round(averages.setup)}%`;
  const avgStopLabel = isHours
    ? formatHourLabel(averages.stop)
    : `${Math.round(averages.stop)}%`;

  return (
    <div className="mida-run-stop-wrap mida-run-stop-wrap--split">
      <div className="mida-run-stop-wrap__main">
        <div className="chart-title-brand machine-chart-head mida-run-stop-head">
          <div className="mida-run-stop-head__main">HIỆU SUẤT KHAI THÁC</div>
          <div
            className="mida-run-stop-unit-toggle"
            role="tablist"
            aria-label="Đơn vị hiệu suất khai thác"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isHours}
              className={`mida-run-stop-unit-btn${!isHours ? ' is-active' : ''}`}
              onClick={() => setUnitMode(UNIT_PCT)}
            >
              %
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isHours}
              className={`mida-run-stop-unit-btn${isHours ? ' is-active' : ''}`}
              onClick={() => setUnitMode(UNIT_HOURS)}
            >
              giờ
            </button>
          </div>
          <MidaChartExpand
            title="HIỆU SUẤT KHAI THÁC"
            extraHead={(
              <div
                className="mida-run-stop-unit-toggle"
                role="tablist"
                aria-label="Đơn vị hiệu suất khai thác"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isHours}
                  className={`mida-run-stop-unit-btn${!isHours ? ' is-active' : ''}`}
                  onClick={() => setUnitMode(UNIT_PCT)}
                >
                  %
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isHours}
                  className={`mida-run-stop-unit-btn${isHours ? ' is-active' : ''}`}
                  onClick={() => setUnitMode(UNIT_HOURS)}
                >
                  giờ
                </button>
              </div>
            )}
          >
            <Chart
              key={`fs-${theme}-${unitMode}`}
              type="bar"
              data={data}
              options={options}
              className="mida-run-stop-stacked"
              style={{ position: 'relative' }}
            />
          </MidaChartExpand>
        </div>
        <div className="machine-chart-plot">
          <div className="machine-chart-plot-inner">
            <Chart
              ref={chartRef}
              key={`${theme}-${unitMode}`}
              type="bar"
              data={data}
              options={options}
              className="mida-run-stop-stacked"
              style={{ position: 'relative' }}
            />
          </div>
        </div>
      </div>

      <aside className="mida-run-stop-avg" aria-label="Trung bình cắt gọt, setup và ngưng">
        <div className="chart-title-brand machine-chart-head mida-run-stop-avg__title">
          TRUNG<br />BÌNH
        </div>
        <div
          className="mida-run-stop-avg__bars"
          role="img"
          aria-label={
            averages.hasData
              ? `Trung bình cắt gọt ${avgCutLabel}, setup ${avgSetupLabel}, ngưng ${avgStopLabel}`
              : 'Chưa có dữ liệu trung bình'
          }
        >
          <div className="mida-run-stop-avg__col">
            <div className="mida-run-stop-avg__track mida-run-stop-avg__track--stack">
              {averages.hasData ? (
                <>
                  <div
                    className="mida-run-stop-avg__bar mida-run-stop-avg__bar--stop"
                    style={{ height: `${stopH}%` }}
                  >
                    {stopH >= 8 ? (
                      <span className="mida-run-stop-avg__pct">{avgStopLabel}</span>
                    ) : null}
                  </div>
                  <div
                    className="mida-run-stop-avg__bar mida-run-stop-avg__bar--setup"
                    style={{ height: `${setupH}%` }}
                  >
                    {setupH >= 8 ? (
                      <span className="mida-run-stop-avg__pct">{avgSetupLabel}</span>
                    ) : null}
                  </div>
                  <div
                    className="mida-run-stop-avg__bar mida-run-stop-avg__bar--cut"
                    style={{ height: `${cutH}%` }}
                  >
                    {cutH >= 8 ? (
                      <span className="mida-run-stop-avg__pct">{avgCutLabel}</span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
