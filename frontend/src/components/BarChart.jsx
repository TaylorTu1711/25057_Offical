// BarLineChart_Diennang.js
import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'bootstrap/dist/css/bootstrap.min.css';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import useSyncChartTheme from '../hooks/useSyncChartTheme';
import {
  themedScale,
  themedXScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getCategoryTooltipTitleCallback,
  getChartLegendOptions,
  formatChartInteger,
  formatChartTooltipValue,
  getBarColumnDataLabelOptions,
  PRODUCTION_CHART_COLORS,
  createProductionBarGradient,
  createProductionBarHoverGradient,
  getProductionLineStyle,
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

const BarLineChart_Sanluong = ({
  labels,
  dataValues,
  lineValues,
  barLabel,
  lineLabel,
  showOutputBar = true,
  showInputLine = true,
  xTickMode = 'month',
  categoryPrefix = '',
}) => {
  const { theme } = useTheme();
  const labelCount = labels?.length ?? 0;
  const productionLine = useMemo(() => getProductionLineStyle(), []);
  const showLinePoints = labelCount <= 24;
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve(
    [labels, dataValues, lineValues, showOutputBar, showInputLine],
    'x',
  );

  const data = useMemo(() => {
    const datasets = [];

    if (showOutputBar) {
      datasets.push({
        type: 'bar',
        label: barLabel,
        data: dataValues,
        yAxisID: 'y',
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          return createProductionBarGradient(ctx, chartArea);
        },
        borderColor: PRODUCTION_CHART_COLORS.bar.border,
        borderWidth: 1,
        borderRadius: { topLeft: 3, topRight: 3 },
        hoverBackgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          return createProductionBarHoverGradient(ctx, chartArea);
        },
        hoverBorderColor: PRODUCTION_CHART_COLORS.bar.border,
        hoverBorderWidth: 2,
        datalabels: getBarColumnDataLabelOptions(PRODUCTION_CHART_COLORS.barDataLabel),
        order: 2,
      });
    }

    if (showInputLine) {
      datasets.push({
        type: 'line',
        label: lineLabel,
        data: lineValues,
        yAxisID: showOutputBar ? 'y1' : 'y',
        borderColor: productionLine.borderColor,
        backgroundColor: productionLine.backgroundColor,
        borderWidth: 2,
        tension: 0.35,
        fill: false,
        clip: false,
        pointRadius: showLinePoints ? 3 : 0,
        pointHoverRadius: 5,
        pointHitRadius: 12,
        pointBackgroundColor: productionLine.pointBackgroundColor,
        pointHoverBackgroundColor: productionLine.pointBackgroundColor,
        pointBorderColor: productionLine.pointBorderColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        datalabels: { display: false },
        order: 1,
      });
    }

    return { labels, datasets };
  }, [
    labels,
    dataValues,
    lineValues,
    barLabel,
    lineLabel,
    showOutputBar,
    showInputLine,
    productionLine,
    showLinePoints,
  ]);

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
        tooltip: {
          callbacks: {
            title: getCategoryTooltipTitleCallback(labels, categoryPrefix),
            label: (context) => {
              const raw = Number(context.raw);
              const value = formatChartTooltipValue(raw, 3);
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
        datalabels: { clip: false },
        legend: getChartLegendOptions(
          {
            labels: {
              padding: 4,
              boxWidth: 10,
              font: { size: 10 },
            },
          },
          theme,
        ),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: { padding: { top: 4, right: 0, bottom: 0, left: 0 } },
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
            ticks: {
              padding: 4,
              callback: (value) => formatChartInteger(value),
            },
          },
          undefined,
          'linear',
          theme,
        ),
        ...(showOutputBar && showInputLine
          ? {
              y1: themedScale(
                {
                  beginAtZero: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: {
                    callback: (value) => formatChartInteger(value),
                  },
                },
                productionLine.axisColor,
                'linear',
                theme,
              ),
            }
          : {}),
      },
    }),
    [
      labelCount,
      labels,
      categoryPrefix,
      xTickMode,
      zoomPluginOptions,
      showOutputBar,
      showInputLine,
      productionLine.axisColor,
      theme,
    ],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
};

export default BarLineChart_Sanluong;
