// Biểu đồ cột thời gian chạy + đường năng suất (% hoặc tấn/giờ khi có năng suất chuẩn)
import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'bootstrap/dist/css/bootstrap.min.css';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  getPerformanceLineStyle,
  getStandardProductivityLineStyle,
  getOutputRateLineStyle,
  getTimeChartBarStyle,
  themedScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  getCategoryTooltipTitleCallback,
} from '../utils/chartTheme';
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
);

const LineChart_TimeOn = ({
  labels,
  line3,
  performanceValues,
  outputRateValues,
  standardProductivity,
  xTickMode = 'month',
  categoryPrefix = '',
}) => {
  const { theme } = useTheme();
  const performanceLine = useMemo(() => getPerformanceLineStyle(), []);
  const timeBar = useMemo(() => getTimeChartBarStyle(), []);
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

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, line3, performanceValues, outputRateValues, standardProductivity?.value],
    'x',
  );

  const y1Max = useMemo(() => {
    if (!hasStandard) return 100;
    const rates = outputRateValues.filter((v) => v != null && Number.isFinite(v));
    const peak = Math.max(...rates, standardProductivity.value, 0.5);
    return Math.ceil(peak * 1.2 * 10) / 10;
  }, [hasStandard, outputRateValues, standardProductivity?.value]);

  const data = useMemo(() => {
    const datasets = [
      {
        type: 'bar',
        label: 'Thời gian chạy (giờ)',
        data: line3,
        yAxisID: 'y',
        backgroundColor: timeBar.background,
        borderColor: timeBar.border,
        borderWidth: 1,
        hoverBackgroundColor: timeBar.hoverBackground,
        hoverBorderColor: timeBar.hoverBorder,
        hoverBorderWidth: 2,
        order: 3,
      },
    ];

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
        tension: 0,
        fill: false,
        clip: false,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 12,
        pointBackgroundColor: outputRateLine.borderColor,
        pointHoverBackgroundColor: outputRateLine.borderColor,
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
        tension: 0,
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
        order: 1,
      });
    }

    return { labels, datasets };
  }, [
    labels,
    line3,
    performanceValues,
    outputRateValues,
    hasPerformance,
    hasOutputRate,
    performanceLine,
    timeBar,
    outputRateLine,
    standardLine,
    standardProductivity,
  ]);

  const rightAxisStyle = hasStandard ? outputRateLine : performanceLine;

  const options = useMemo(
    () => ({
      ...chartStableRenderOptions,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        datalabels: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (context) => {
              const raw = context.raw;
              if (raw == null || raw === '') return null;
              const num = Number(raw);
              const dsLabel = context.dataset.label ?? '';
              if (dsLabel.includes('Năng suất thực tế')) {
                return `${dsLabel}: ${num.toFixed(2)} tấn/giờ`;
              }
              if (dsLabel === 'Năng suất (%)') {
                return `${dsLabel}: ${num.toFixed(1)}%`;
              }
              return `${dsLabel}: ${num.toFixed(2)}`;
            },
          },
          filter: (item) => {
            const dsLabel = item.dataset.label ?? '';
            if (dsLabel.includes('Năng suất chuẩn')) return false;
            return (
              item.dataset.yAxisID === 'y' ||
              dsLabel.includes('Năng suất thực tế') ||
              dsLabel === 'Năng suất (%)'
            );
          },
        },
        legend: getChartLegendOptions(),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: {
        padding: 0,
      },
      scales: {
        x: themedScale(
          {
            ticks: getCategoryXAxisTickOptions(labelCount, xTickMode),
          },
          undefined,
          'category',
        ),
        y: themedScale({
          beginAtZero: true,
          position: 'left',
          title: {
            display: false,
            text: 'Thời gian (giờ)',
            font: {
              size: 14,
              weight: 'bold',
            },
          },
          ticks: { padding: 4 },
        }),
        ...(hasPerformance || hasOutputRate
          ? {
              y1: themedScale(
                {
                  beginAtZero: true,
                  max: y1Max,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  title: {
                    display: false,
                    text: hasStandard ? 'Năng suất (tấn/giờ)' : 'Năng suất (%)',
                    color: rightAxisStyle.axisColor,
                    font: { size: 11, weight: 'bold' },
                  },
                  ticks: {
                    padding: 4,
                    callback: (value) =>
                      hasStandard ? `${value}` : `${value}%`,
                  },
                },
                rightAxisStyle.axisColor,
              ),
            }
          : {}),
      },
    }),
    [
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
    ],
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} style={{ position: 'relative' }} />
    </div>
  );
};

export default LineChart_TimeOn;
