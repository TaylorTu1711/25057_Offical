import { useEffect, useRef } from 'react';

/**
 * Ép Chart.js áp dụng lại options (màu trục) khi đổi dark/light — không cần refresh trang.
 * Chỉ update khi theme thực sự đổi, tránh gọi chart.update thừa mỗi lần options đổi tham chiếu
 * (react-chartjs-2 đã tự xử lý cập nhật options/data).
 */
export default function useSyncChartTheme(chartRef, theme, options) {
  const lastThemeRef = useRef(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (lastThemeRef.current === theme) return;
    lastThemeRef.current = theme;

    chart.options = options;
    chart.update('none');
  }, [chartRef, theme, options]);
}
