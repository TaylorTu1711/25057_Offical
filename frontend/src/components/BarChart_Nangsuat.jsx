import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useSyncChartTheme from '../hooks/useSyncChartTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import { getChartThemeColors, getPerformanceLineStyle, themedScale, themedXScale, chartStableRenderOptions } from '../utils/chartTheme';
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
  const { brand } = getChartThemeColors(theme);
  const perfLine = useMemo(() => getPerformanceLineStyle(), []);
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve([labels, dataValues], 'x');

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Hiệu suất (%)',
          data: dataValues,
          borderColor: perfLine.borderColor,
          backgroundColor: perfLine.backgroundColor,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          pointBackgroundColor: perfLine.pointBackgroundColor,
          pointHoverBackgroundColor: perfLine.pointBackgroundColor,
          pointBorderColor: perfLine.pointBorderColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        },
      ],
    }),
    [labels, dataValues, perfLine],
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
        x: themedXScale(
          {
            ticks: { maxRotation: 45, minRotation: 0, font: { size: 9 } },
          },
          undefined,
          'category',
          theme,
        ),
        y: themedScale(
          {
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
          },
          undefined,
          'linear',
          theme,
        ),
      },
    }),
    [brand, zoomPluginOptions, theme],
  );

  useSyncChartTheme(chartRef, theme, options);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Chart ref={chartRef} key={theme} type="line" data={data} options={options} />
    </div>
  );
};

export default BarChart_Nangsuat;
