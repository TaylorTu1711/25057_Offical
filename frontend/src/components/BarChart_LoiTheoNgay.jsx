import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useSyncChartTheme from '../hooks/useSyncChartTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  formatChartTooltipTitle,
  getBarColumnDataLabelOptions,
  PRODUCTION_CHART_COLORS,
  createProductionBarGradient,
  createProductionBarHoverGradient,
  themedScale,
  themedXScale,
} from '../utils/chartTheme';
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

const BarChart_LoiTheoNgay = ({ labels, dataValues, viewMode = 'month', categoryPrefix = '' }) => {
  const { theme } = useTheme();
  const labelCount = labels?.length ?? 0;

  const { chartRef, zoomPluginOptions } = useChartZoomPreserve([labels, dataValues, viewMode], 'x');

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Số lần lỗi',
          data: dataValues,
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
          datalabels: getBarColumnDataLabelOptions(PRODUCTION_CHART_COLORS.barDataLabel, 0),
        },
      ],
    }),
    [labels, dataValues],
  );

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
        datalabels: { clip: false },
        tooltip: {
          filter: (item) => Number(item.raw) > 0,
          callbacks: {
            title: (items) => {
              const hit = items?.find((i) => Number(i.raw) > 0);
              if (!hit) return '';
              return formatChartTooltipTitle(categoryPrefix, labels[hit.dataIndex]);
            },
            label: (context) => {
              const value = Number(context.parsed?.y ?? context.raw);
              return `Số lần lỗi: ${Number.isFinite(value) ? value : 0}`;
            },
          },
        },
        legend: getChartLegendOptions({}, theme),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: { padding: { top: 4, right: 0, bottom: 0, left: 0 } },
      scales: {
        x: themedXScale(
          {
            ticks: getCategoryXAxisTickOptions(labelCount, viewMode),
          },
          undefined,
          'category',
          theme,
        ),
        y: themedScale(
          {
            beginAtZero: true,
            position: 'left',
            ticks: { stepSize: 1, precision: 0, padding: 4 },
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [labelCount, labels, categoryPrefix, viewMode, zoomPluginOptions, theme],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
};

export default BarChart_LoiTheoNgay;
