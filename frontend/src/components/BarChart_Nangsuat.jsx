import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import { getChartThemeColors, themedScale, chartStableRenderOptions } from '../utils/chartTheme';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
);

const BarChart_Nangsuat = ({ labels, dataValues }) => {
  const { theme } = useTheme();
  const { brand } = getChartThemeColors();
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve([labels, dataValues], 'x');

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Hiệu suất (%)',
          data: dataValues,
          borderColor: 'rgba(32, 64, 154, 1)',
          backgroundColor: 'rgba(32, 64, 154, 0.15)',
          tension: 0,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          pointBackgroundColor: 'rgba(32, 64, 154, 1)',
          pointHoverBackgroundColor: 'rgba(32, 64, 154, 1)',
          pointBorderColor: 'rgba(32, 64, 154, 1)',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
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
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${Number(ctx.raw).toFixed(1)}%`,
          },
        },
        zoom: zoomPluginOptions,
      },
      scales: {
        x: themedScale(
          {
            ticks: { maxRotation: 45, minRotation: 0, font: { size: 9 } },
          },
          undefined,
          'category',
        ),
        y: themedScale({
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            color: brand,
            text: 'Hiệu suất (%)',
            font: { size: 11, weight: 'bold' },
          },
          ticks: {
            callback: (value) => `${value}%`,
          },
        }),
      },
    }),
    [brand, zoomPluginOptions],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Chart ref={chartRef} key={theme} type="line" data={data} options={options} />
    </div>
  );
};

export default BarChart_Nangsuat;
