import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getChartLegendOptions,
  formatChartTooltipTitle,
  themedScale,
} from '../utils/chartTheme';
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
          backgroundColor: 'rgba(32, 64, 154, 0.8)',
          borderColor: 'rgba(32, 64, 154, 1)',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(32, 64, 154, 0.55)',
          hoverBorderColor: 'rgba(32, 64, 154, 1)',
          hoverBorderWidth: 2,
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
        datalabels: {
          display: false,
        },
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
        legend: getChartLegendOptions(),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: { padding: 0 },
      scales: {
        x: themedScale(
          {
            ticks: getCategoryXAxisTickOptions(labelCount, viewMode),
          },
          undefined,
          'category',
        ),
        y: themedScale({
          beginAtZero: true,
          position: 'left',
          ticks: { stepSize: 1, precision: 0, padding: 4 },
        }),
      },
    }),
    [labelCount, labels, categoryPrefix, viewMode, zoomPluginOptions],
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>
  );
};

export default BarChart_LoiTheoNgay;
