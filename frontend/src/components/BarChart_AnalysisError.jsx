import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import { getChartThemeColors, themedScale, chartStableRenderOptions } from '../utils/chartTheme';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

const BAR_FILL = 'rgba(255, 182, 193, 0.95)';
const BAR_BORDER = 'rgba(255, 140, 160, 1)';
const GRID_COLOR = 'rgba(0, 0, 0, 0.1)';
const LABEL_COLOR = '#1a1a1a';

function getXTickStep(maxVal) {
  const paddedMax = maxVal <= 0 ? 7 : Math.ceil(maxVal * 1.08);
  if (paddedMax > 42) return 7;
  if (paddedMax > 21) return 3;
  if (paddedMax > 10) return 2;
  return 1;
}

function truncateText(ctx, text, maxWidth) {
  if (!text || maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;

  let trimmed = text;
  const ellipsis = '…';
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${ellipsis}` : '';
}

function createTopYWindow(initialVisibleCount, labelCount) {
  if (!initialVisibleCount || labelCount <= 0) return null;
  const maxIndex = labelCount - 1;
  return { min: 0, max: Math.min(initialVisibleCount - 1, maxIndex) };
}

function clampYWindow(window, maxIndex) {
  if (!window || maxIndex < 0) return null;
  const min = Math.max(0, Math.min(window.min, maxIndex));
  const max = Math.max(min, Math.min(window.max, maxIndex));
  return { min, max };
}

const inBarCategoryLabelsPlugin = {
  id: 'inBarCategoryLabels',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const labels = pluginOptions?.labels;
    if (!labels?.length) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const { top, bottom, left } = chart.chartArea;
    const embedded = Boolean(pluginOptions?.embedded);
    const fontSize = embedded ? 9 : 11;
    const padX = embedded ? 6 : 8;
    const minBarWidth = embedded ? 22 : 28;

    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    meta.data.forEach((bar, index) => {
      const raw = chart.data.datasets[0]?.data?.[index];
      const value = Number(raw);
      const text = labels[index];
      if (!value || !text) return;

      const { x, y, base, height } = bar.getProps(['x', 'y', 'base', 'height'], true);
      if (y < top || y > bottom) return;

      const barLeft = Math.min(x, base);
      const barRight = Math.max(x, base);
      const barWidth = Math.abs(barRight - barLeft);
      if (barWidth < minBarWidth) return;

      const barTop = y - height / 2;
      const clipLeft = Math.max(barLeft, left);
      const clipWidth = Math.min(barRight, chart.chartArea.right) - clipLeft;
      if (clipWidth <= padX) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(clipLeft, barTop, clipWidth, height);
      ctx.clip();

      const maxTextWidth = barWidth - padX * 2;
      const displayText = truncateText(ctx, text, maxTextWidth);
      if (displayText) {
        ctx.fillText(displayText, barLeft + padX, y);
      }
      ctx.restore();
    });

    ctx.restore();
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  inBarCategoryLabelsPlugin,
);

function BarChart_ErrorCore({
  labels,
  dataValues,
  tooltipLabels,
  displayLabels,
  embedded = false,
  chartRef,
  zoomPluginOptions,
  yCategoryWindow = null,
}) {
  const { theme } = useTheme();
  const { brand } = getChartThemeColors();
  const categoryLabels = displayLabels?.length ? displayLabels : labels;
  const maxCategoryIndex = Math.max(0, categoryLabels.length - 1);
  const yWindow = useMemo(
    () => clampYWindow(yCategoryWindow, maxCategoryIndex),
    [yCategoryWindow, maxCategoryIndex],
  );

  const xTickStep = useMemo(() => {
    const maxVal = Math.max(0, ...(dataValues || []).map((v) => Number(v) || 0));
    return getXTickStep(maxVal);
  }, [dataValues]);

  const hiddenRowLabels = useMemo(
    () => categoryLabels.map(() => '\u00a0'),
    [categoryLabels],
  );

  const data = useMemo(
    () => ({
      labels: hiddenRowLabels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: BAR_FILL,
          borderColor: BAR_BORDER,
          borderWidth: 1,
          barThickness: 'flex',
          maxBarThickness: embedded ? 26 : 30,
          categoryPercentage: 0.88,
          barPercentage: 0.82,
          borderRadius: 0,
          borderSkipped: false,
        },
      ],
    }),
    [embedded, hiddenRowLabels, dataValues],
  );

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      clip: true,
      plugins: {
        legend: { display: false },
        title: embedded
          ? { display: false }
          : {
              display: true,
              align: 'center',
              text: 'Thống kê lỗi',
              color: brand,
              font: { size: 15, weight: '600' },
              padding: { bottom: 10 },
            },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items[0]?.dataIndex ?? 0;
              return categoryLabels[i] ?? tooltipLabels?.[i] ?? labels?.[i] ?? '';
            },
            label: (ctx) => `Số lần: ${ctx.raw}`,
          },
        },
        zoom: zoomPluginOptions,
        datalabels: { display: false },
        inBarCategoryLabels: {
          labels: categoryLabels,
          embedded,
        },
      },
      layout: {
        padding: { left: 0, right: 8, top: 0 },
      },
      scales: {
        x: themedScale({
          beginAtZero: true,
          title: embedded
            ? { display: false }
            : {
                display: true,
                color: brand,
                text: 'Số lần xuất hiện',
                font: { size: 13, weight: 'bold' },
              },
          ticks: {
            stepSize: xTickStep,
            maxRotation: embedded ? 0 : 45,
            minRotation: embedded ? 0 : 45,
            font: { size: embedded ? 9 : 10 },
            padding: embedded ? 2 : undefined,
          },
          grid: { display: true, color: GRID_COLOR },
        }),
        y: {
          ...themedScale(
            {
              offset: true,
              ...(yWindow ? { min: yWindow.min, max: yWindow.max } : {}),
              ticks: {
                display: false,
                callback: () => '',
              },
              afterFit(axis) {
                axis.width = 4;
              },
            },
            undefined,
            'category',
          ),
          grid: { display: true, color: GRID_COLOR },
        },
      },
    }),
    [brand, categoryLabels, embedded, labels, tooltipLabels, xTickStep, yWindow, zoomPluginOptions],
  );

  return (
    <div className={`bar-chart-analysis-error${embedded ? ' bar-chart-analysis-error--embedded' : ''}`}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
}

/** Thẻ máy: khóa cửa sổ trục Y bằng state — không tự zoom khi polling */
function BarChart_ErrorEmbedded(props) {
  const { initialVisibleCount, labels, dataValues, tooltipLabels, displayLabels } = props;
  const categoryLabels = displayLabels?.length ? displayLabels : labels;
  const labelCount = categoryLabels.length;
  const chartRef = useRef(null);
  const userAdjustedRef = useRef(false);
  const [yCategoryWindow, setYCategoryWindow] = useState(null);

  useEffect(() => {
    if (userAdjustedRef.current || labelCount <= 0) return;
    setYCategoryWindow((prev) => prev ?? createTopYWindow(initialVisibleCount, labelCount));
  }, [initialVisibleCount, labelCount]);

  const syncYWindowFromChart = useCallback((chart) => {
    const scale = chart.scales?.y;
    if (scale?.min == null || scale?.max == null) return;
    userAdjustedRef.current = true;
    setYCategoryWindow({ min: scale.min, max: scale.max });
  }, []);

  const zoomPluginOptions = useMemo(
    () => ({
      pan: {
        enabled: true,
        mode: 'y',
        onPanComplete: ({ chart }) => syncYWindowFromChart(chart),
      },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: 'y',
        onZoomComplete: ({ chart }) => syncYWindowFromChart(chart),
      },
    }),
    [syncYWindowFromChart],
  );

  return (
    <BarChart_ErrorCore
      {...props}
      chartRef={chartRef}
      zoomPluginOptions={zoomPluginOptions}
      yCategoryWindow={yCategoryWindow}
    />
  );
}

/** Modal: giữ zoom khi polling như biểu đồ sản lượng */
function BarChart_ErrorModal(props) {
  const zoomDeps = useMemo(
    () => [props.labels, props.dataValues, props.tooltipLabels, props.displayLabels],
    [props.labels, props.dataValues, props.tooltipLabels, props.displayLabels],
  );
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(zoomDeps, 'y');

  return (
    <BarChart_ErrorCore
      {...props}
      chartRef={chartRef}
      zoomPluginOptions={zoomPluginOptions}
      yCategoryWindow={null}
    />
  );
}

const BarChart_Error = (props) =>
  props.initialVisibleCount ? (
    <BarChart_ErrorEmbedded {...props} />
  ) : (
    <BarChart_ErrorModal {...props} />
  );

export default BarChart_Error;
