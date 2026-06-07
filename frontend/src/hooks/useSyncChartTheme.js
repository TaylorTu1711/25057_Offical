import { useEffect } from 'react';

/** Ép Chart.js áp dụng lại options (màu trục) khi đổi dark/light — không cần refresh trang. */
export default function useSyncChartTheme(chartRef, theme, options) {
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.options = options;
    chart.update('none');
  }, [chartRef, theme, options]);
}
