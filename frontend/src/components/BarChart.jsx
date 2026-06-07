// BarLineChart_Diennang.js
import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'bootstrap/dist/css/bootstrap.min.css';
import zoomPlugin from 'chartjs-plugin-zoom';
import useTheme from '../hooks/useTheme';
import useChartZoomPreserve from '../hooks/useChartZoomPreserve';
import {
  themedScale,
  chartStableRenderOptions,
  getCategoryXAxisTickOptions,
  getCategoryTooltipTitleCallback,
  getChartLegendOptions,
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
        backgroundColor: 'rgba(54, 162, 235, 1)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(54, 162, 235, 0.75)',
        hoverBorderColor: 'rgba(54, 162, 235, 1)',
        hoverBorderWidth: 2,
        order: 2,
      });
    }

    if (showInputLine) {
      datasets.push({
        type: 'line',
        label: lineLabel,
        data: lineValues,
        yAxisID: showOutputBar ? 'y1' : 'y',
        borderColor: 'rgba(255, 193, 7, 1)',
        backgroundColor: 'rgba(255, 193, 7, 0.12)',
        borderWidth: 2,
        tension: 0,
        fill: false,
        clip: false,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 12,
        pointBackgroundColor: 'rgba(255, 193, 7, 1)',
        pointHoverBackgroundColor: 'rgba(255, 193, 7, 1)',
        pointBorderColor: 'rgba(255, 193, 7, 1)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        order: 1,
      });
    }

    return { labels, datasets };
  }, [labels, dataValues, lineValues, barLabel, lineLabel, showOutputBar, showInputLine]);

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
              const value = Number.isFinite(raw)
                ? raw.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
                : '0';
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
        datalabels: {
          display: false,
        },
        legend: getChartLegendOptions(),
        title: { display: false },
        zoom: zoomPluginOptions,
      },
      layout: { padding: 0 },
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
          ticks: { padding: 4 },
        }),
        ...(showOutputBar && showInputLine
          ? {
              y1: themedScale(
                {
                  beginAtZero: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                },
                'rgba(255, 193, 7, 1)',
              ),
            }
          : {}),
      },
    }),
    [labelCount, labels, categoryPrefix, xTickMode, zoomPluginOptions, showOutputBar, showInputLine],
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chart ref={chartRef} key={theme} type="bar" data={data} options={options} />
    </div>

    
  );
};

export default BarLineChart_Sanluong;
