import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { NEON_PALETTE, isDarkChartTheme } from '../utils/chartTheme';
import useTheme from '../hooks/useTheme';

ChartJS.register(ArcElement, Tooltip, Legend);

const PerformanceChart = ({ performance }) => {
  const { theme } = useTheme();
  const isDark = isDarkChartTheme(theme);
  const remainderColor = isDark ? NEON_PALETTE.remainderDark : NEON_PALETTE.remainder;

  const data = useMemo(
    () => ({
      labels: ['Hiệu suất', 'Phần còn lại'],
      datasets: [
        {
          data: [performance, 100 - performance],
          backgroundColor: (context) => {
            if (context.dataIndex !== 0) return remainderColor;
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return NEON_PALETTE.cyanBright;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            const r = Math.min(chartArea.width, chartArea.height) / 2;
            const gradient = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
            gradient.addColorStop(0, NEON_PALETTE.cyan);
            gradient.addColorStop(1, NEON_PALETTE.blue);
            return gradient;
          },
          borderWidth: 0,
        },
      ],
    }),
    [performance, remainderColor],
  );

  const options = {
    cutout: '70%',
    plugins: {
      datalabels: {
        display: false, 
      },
      legend: { display: false },
      tooltip: { enabled: false },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div
      className="notranslate"
      translate="no"
      style={{
        width: '60px',
        height: '60px',
        position: 'relative',
      }}
    >
      <Doughnut key={theme} data={data} options={options} />
      <div
        className="notranslate machine-top-panel__stat-value machine-top-panel__stat-value--perf"
        translate="no"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
        }}
      >
        {performance}%
      </div>
    </div>
  );
};

export default React.memo(PerformanceChart);
