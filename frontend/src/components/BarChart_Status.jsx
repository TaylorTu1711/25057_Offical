// // BarChartStatus.js
// import React from 'react';
// import { Chart } from 'react-chartjs-2';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import zoomPlugin from 'chartjs-plugin-zoom';
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   LineElement,
//   PointElement,
//   Title,
//   Tooltip,
//   Legend,
// } from 'chart.js';

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   LineElement,
//   PointElement,
//   Title,
//   Tooltip,
//   Legend,
//   zoomPlugin,
// );

// const statusLabels = ['Maint', 'Stop', 'Run'];

// const BarChartStatus = ({ labels, line1}) => {
//   const data = {
//     labels,
//     datasets: [
//       {
//         label: 'Trạng thái',
//         data: line1,
//         borderColor: 'rgba(255, 99, 132, 1)',
//         backgroundColor: 'rgba(255, 99, 132, 0.2)',
//         tension: 0.4,
//         fill: false,
//         pointRadius: 1,
//         pointBackgroundColor: 'rgba(255, 99, 132, 1)',
//         stepped: true,
//         spanGaps: false,
//       },
//     ],
//   };

//   const options = {
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       datalabels: {
//         display: false, 
//       },
//       legend: { display: false, },
//       title: { display: false },
//       zoom: {
//         pan: {
//           enabled: true,
//           mode: 'x',
//         },
//         zoom: {
//           wheel: { enabled: true },
//           pinch: { enabled: true },
//           mode: 'x',
//         },
//       },
//     },
//     layout: {
//       padding: 0,
//     },
//     scales: {
//       x: {
//         ticks: { 
//           padding: 2,
//           maxRotation: 0,
//           minRotation: 0,
//         },
//       },
//       y: {
//       ticks: {
//         stepSize: 1,
//         callback: function (value) {
//           const labels = ['Maint', 'Stop', 'Run'];
//           return labels[value] ?? value;
//         }
//       },
//       min: 0,
//       max: 2,
//     }
//   }
//   };

//   return (
//     <div style={{ height: '100%', width: '100%' }}>
//       <Chart type="line" data={data} options={options} />
//     </div>
//   );
// };

// export default BarChartStatus;

// BarChartStatus.js
import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'bootstrap/dist/css/bootstrap.min.css';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  themedScale,
  chartDenseAnimationOptions,
  getCategoryXAxisTickOptions,
  getCategoryTooltipTitleCallback,
} from '../utils/chartTheme';
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

const statusLabels = ['Maint', 'Stop', 'Run'];

const BarChartStatus = ({ labels, line1, categoryPrefix = 'Thời gian' }) => {
  const { theme } = useTheme();
  const labelCount = labels?.length ?? 0;
  const { chartRef, zoomPluginOptions } = useChartZoomPreserve([labels, line1], 'x');

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Trạng thái',
          data: line1,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.4,
          fill: false,
          pointRadius: 1,
          pointBackgroundColor: 'rgba(255, 99, 132, 1)',
          stepped: true,
          spanGaps: false,
        },
      ],
    }),
    [labels, line1],
  );

  const options = useMemo(
    () => ({
      ...chartDenseAnimationOptions,
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
              const value = context.parsed?.y ?? context.raw;
              return `Trạng thái: ${statusLabels[value] ?? value ?? '—'}`;
            },
          },
        },
        legend: { display: false },
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: {
        padding: { top: 28, bottom: 0, left: 0, right: 0 },
      },
      scales: {
        x: themedScale(
          {
            ticks: getCategoryXAxisTickOptions(labelCount, 'year'),
          },
          undefined,
          'category',
        ),
        y: themedScale({
          ticks: {
            stepSize: 1,
            padding: 4,
            font: { size: 9 },
            callback: (value) => statusLabels[value] ?? value,
          },
          min: 1,
          max: 2,
        }),
      },
    }),
    [labelCount, labels, categoryPrefix, zoomPluginOptions],
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="line" data={data} options={options} />
    </div>
  );
};

export default BarChartStatus;

