// Biểu đồ cột thời gian chạy + đường năng suất (% hoặc tấn/giờ khi có năng suất chuẩn)
import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'bootstrap/dist/css/bootstrap.min.css';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import useSyncChartTheme from '../hooks/useSyncChartTheme';
import {
  getPerformanceLineStyle,
  getStandardProductivityLineStyle,
  getOutputRateLineStyle,
  createTimeBarGradient,
  createTimeBarHoverGradient,
  createNeonBarGradient,
  createNeonBarHoverGradient,
  NEON_BAR_GRADIENTS,
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  getCategoryTooltipTitleCallback,
  getBarColumnDataLabelOptions,
  TIME_CHART_COLORS,
} from '../utils/chartTheme';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  ChartDataLabels,
);

const LineChart_TimeOn = ({
  labels,
  line3,
  energyKwhValues,
  performanceValues,
  outputRateValues,
  standardProductivity,
  xTickMode = 'month',
  categoryPrefix = '',
  /** 'bar' (mặc định) | 'line' — MIDA dùng line */
  timeSeriesType = 'bar',
}) => {
  const { theme } = useTheme();
  const performanceLine = useMemo(() => getPerformanceLineStyle(), []);
  const timeBarPalette = NEON_BAR_GRADIENTS.neonPink;
  const energyBarPalette = NEON_BAR_GRADIENTS.cyanBlue;
  const outputRateLine = useMemo(() => getOutputRateLineStyle(), []);
  const standardLine = useMemo(() => getStandardProductivityLineStyle(), []);
  const labelCount = labels?.length ?? 0;

  const hasStandard =
    standardProductivity?.value > 0 && Number.isFinite(standardProductivity.value);
  const hasOutputRate =
    hasStandard &&
    Array.isArray(outputRateValues) &&
    outputRateValues.length === labels.length;
  const hasPerformance =
    !hasStandard &&
    Array.isArray(performanceValues) &&
    performanceValues.length === labels.length;
  const hasEnergy =
    !hasOutputRate &&
    !hasPerformance &&
    Array.isArray(energyKwhValues) &&
    energyKwhValues.length === labels.length;

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, line3, energyKwhValues, performanceValues, outputRateValues, standardProductivity?.value],
    'x',
  );

  const y1Max = useMemo(() => {
    if (hasEnergy) {
      const vals = energyKwhValues.filter((v) => v != null && Number.isFinite(Number(v)));
      const peak = Math.max(...vals.map(Number), 0);
      if (peak <= 0) return 1;
      return Math.ceil(peak * 1.15 * 10) / 10;
    }
    if (!hasStandard) return 100;
    const rates = outputRateValues.filter((v) => v != null && Number.isFinite(v));
    const peak = Math.max(...rates, standardProductivity.value, 0.5);
    return Math.ceil(peak * 1.2 * 10) / 10;
  }, [hasEnergy, hasStandard, energyKwhValues, outputRateValues, standardProductivity?.value]);

  const data = useMemo(() => {
    const useLine = timeSeriesType === 'line';
    const datasets = [];

    const timeDataset = useLine
      ? {
          type: 'line',
          label: 'Thời gian chạy (giờ)',
          data: line3,
          yAxisID: 'y',
          borderColor: timeBarPalette.border,
          backgroundColor: timeBarPalette.top,
          borderWidth: 2.5,
          tension: 0.35,
          fill: false,
          clip: false,
          spanGaps: true,
          pointRadius: labelCount <= 48 ? 2.5 : 0,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          pointBackgroundColor: timeBarPalette.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          pointHoverBackgroundColor: timeBarPalette.border,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 1.5,
          datalabels: { display: false },
          // Chart.js vẽ ngược order: số nhỏ hơn → vẽ sau → nằm trên cột
          order: 0,
        }
      : {
          type: 'bar',
          label: 'Thời gian chạy (giờ)',
          data: line3,
          yAxisID: 'y',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return createTimeBarGradient(ctx, chartArea);
          },
          borderColor: timeBarPalette.border,
          borderWidth: 1,
          borderRadius: { topLeft: 3, topRight: 3 },
          hoverBackgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return createTimeBarHoverGradient(ctx, chartArea);
          },
          hoverBorderColor: timeBarPalette.border,
          hoverBorderWidth: 2,
          datalabels: getBarColumnDataLabelOptions(TIME_CHART_COLORS.barDataLabel),
          order: 0,
        };

    // Thời gian trước trong legend; cột điện năng order cao hơn → vẽ trước (nằm dưới)
    datasets.push(timeDataset);

    if (hasEnergy) {
      datasets.push({
        type: 'bar',
        label: 'Điện năng tiêu thụ (kWh)',
        data: energyKwhValues,
        yAxisID: 'y1',
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          return createNeonBarGradient(ctx, chartArea, energyBarPalette);
        },
        borderColor: energyBarPalette.border,
        borderWidth: 1,
        borderRadius: { topLeft: 3, topRight: 3 },
        hoverBackgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          return createNeonBarHoverGradient(ctx, chartArea, energyBarPalette);
        },
        hoverBorderColor: energyBarPalette.border,
        hoverBorderWidth: 2,
        datalabels: { display: false },
        order: 1,
      });
    }

    if (hasOutputRate) {
      datasets.push({
        type: 'line',
        label: 'Năng suất thực tế (tấn/giờ)',
        data: outputRateValues,
        yAxisID: 'y1',
        borderColor: outputRateLine.borderColor,
        backgroundColor: outputRateLine.backgroundColor,
        borderWidth: outputRateLine.borderWidth,
        borderDash: [],
        tension: 0.35,
        fill: false,
        clip: false,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 12,
        pointBackgroundColor: outputRateLine.borderColor,
        pointHoverBackgroundColor: outputRateLine.borderColor,
        datalabels: { display: false },
        order: 1,
      });

      datasets.push({
        type: 'line',
        label: `Năng suất chuẩn (${standardProductivity.label})`,
        data: labels.map(() => standardProductivity.value),
        yAxisID: 'y1',
        borderColor: standardLine.borderColor,
        backgroundColor: standardLine.backgroundColor,
        borderWidth: standardLine.borderWidth,
        borderDash: [8, 5],
        tension: 0,
        fill: false,
        clip: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        datalabels: { display: false },
        order: 0,
      });
    } else if (hasPerformance) {
      datasets.push({
        type: 'line',
        label: 'Năng suất (%)',
        data: performanceValues,
        yAxisID: 'y1',
        borderColor: performanceLine.borderColor,
        backgroundColor: performanceLine.backgroundColor,
        borderWidth: performanceLine.borderWidth,
        tension: 0.35,
        fill: false,
        clip: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 12,
        pointBackgroundColor: performanceLine.borderColor,
        pointHoverBackgroundColor: performanceLine.borderColor,
        pointBorderColor: performanceLine.borderColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 1.5,
        datalabels: { display: false },
        order: 1,
      });
    }

    return { labels, datasets };
  }, [
    labels,
    line3,
    energyKwhValues,
    labelCount,
    performanceValues,
    outputRateValues,
    hasEnergy,
    hasPerformance,
    hasOutputRate,
    performanceLine,
    timeBarPalette,
    energyBarPalette,
    outputRateLine,
    standardLine,
    standardProductivity,
    timeSeriesType,
  ]);

  const rightAxisStyle = hasEnergy
    ? { axisColor: energyBarPalette.border }
    : hasStandard
      ? outputRateLine
      : performanceLine;

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      // Chart.js vẽ ngược order: line order thấp hơn bar → đường nằm trên cột
      datasets: {
        bar: { order: 1 },
        line: { order: 0 },
      },
      plugins: {
        datalabels: { clip: false },
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (context) => {
              const raw = context.raw;
              if (raw == null || raw === '') return null;
              const num = Number(raw);
              const dsLabel = context.dataset.label ?? '';
              if (dsLabel.includes('Điện năng')) {
                return `${dsLabel}: ${num.toLocaleString('en-US', { maximumFractionDigits: 3 })} kWh`;
              }
              if (dsLabel.includes('Năng suất thực tế')) {
                return `${dsLabel}: ${num.toFixed(2)} tấn/giờ`;
              }
              if (dsLabel === 'Năng suất (%)') {
                return `${dsLabel}: ${num.toFixed(1)}%`;
              }
              if (dsLabel.includes('Thời gian')) {
                return `${dsLabel}: ${num.toFixed(2)} giờ`;
              }
              return `${dsLabel}: ${num.toFixed(2)}`;
            },
          },
          filter: (item) => {
            const dsLabel = item.dataset.label ?? '';
            if (dsLabel.includes('Năng suất chuẩn')) return false;
            return (
              item.dataset.yAxisID === 'y' ||
              item.dataset.yAxisID === 'y1' ||
              dsLabel.includes('Năng suất thực tế') ||
              dsLabel === 'Năng suất (%)'
            );
          },
        },
        legend: getChartLegendOptions({}, theme),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: {
        padding: 0,
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
        y: themedScale(
          {
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'giờ',
              font: {
                size: 11,
                weight: '600',
              },
            },
            ticks: { padding: 4 },
          },
          undefined,
          'linear',
          theme,
        ),
        ...(hasPerformance || hasOutputRate || hasEnergy
          ? {
              y1: themedScale(
                {
                  beginAtZero: true,
                  max: y1Max,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  title: {
                    display: true,
                    text: hasEnergy
                      ? 'kWh'
                      : hasStandard
                        ? 'Năng suất (tấn/giờ)'
                        : 'Năng suất (%)',
                    color: rightAxisStyle.axisColor,
                    font: { size: 11, weight: '600' },
                  },
                  ticks: {
                    padding: 4,
                    callback: (value) =>
                      hasEnergy || hasStandard ? `${value}` : `${value}%`,
                  },
                },
                rightAxisStyle.axisColor,
                'linear',
                theme,
              ),
            }
          : {}),
      },
    }),
    [
      hasEnergy,
      hasPerformance,
      hasOutputRate,
      hasStandard,
      labelCount,
      labels,
      categoryPrefix,
      xTickMode,
      zoomPluginOptions,
      y1Max,
      rightAxisStyle.axisColor,
      theme,
    ],
  );

  useSyncChartTheme(chartRef, theme, options);

  const chartDefaultType = timeSeriesType === 'line' ? 'line' : 'bar';

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart
        ref={chartRef}
        key={`${theme}-${timeSeriesType}-${hasEnergy ? 'energy' : 'plain'}`}
        type={chartDefaultType}
        data={data}
        options={options}
        style={{ position: 'relative' }}
      />
    </div>
  );
};

export default LineChart_TimeOn;
