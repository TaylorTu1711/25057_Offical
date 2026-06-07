/** Màu tick trục & lưới — luôn giữ như light mode. */
import { Chart as ChartJS } from 'chart.js';

const CHART_AXIS_TICK_COLOR = '#495057';
const CHART_AXIS_GRID_LIGHT = 'rgba(0, 0, 0, 0.12)';

/** Đường năng suất (%) — xanh navy ban đầu (rgba(32, 64, 154)), không theo brand trắng dark mode. */
const PERFORMANCE_LINE_BLUE = 'rgba(32, 64, 154, 1)';

export function getPerformanceLineStyle() {
  return {
    borderColor: PERFORMANCE_LINE_BLUE,
    backgroundColor: 'rgba(32, 64, 154, 0.12)',
    borderWidth: 1.5,
    axisColor: PERFORMANCE_LINE_BLUE,
  };
}

/** Biểu đồ thời gian & năng suất: hồng — xanh brand (HIỆU SUẤT SỬ DỤNG) — xanh lá. */
export const TIME_CHART_COLORS = {
  timeRun: {
    background: 'rgba(255, 99, 132, 0.85)',
    border: 'rgba(236, 72, 153, 1)',
    hoverBackground: 'rgba(255, 99, 132, 0.65)',
    hoverBorder: 'rgba(236, 72, 153, 1)',
  },
  outputRate: {
    border: PERFORMANCE_LINE_BLUE,
    background: 'rgba(32, 64, 154, 0.12)',
    axis: PERFORMANCE_LINE_BLUE,
  },
  standard: {
    border: 'rgba(34, 197, 94, 1)',
    background: 'rgba(34, 197, 94, 0.1)',
    axis: 'rgba(34, 197, 94, 1)',
  },
  performancePct: {
    border: PERFORMANCE_LINE_BLUE,
    background: 'rgba(32, 64, 154, 0.12)',
    axis: PERFORMANCE_LINE_BLUE,
  },
};

/** Đường năng suất chuẩn (tấn/giờ) — tím. */
export function getStandardProductivityLineStyle() {
  const c = TIME_CHART_COLORS.standard;
  return {
    borderColor: c.border,
    backgroundColor: c.background,
    borderWidth: 2,
    axisColor: c.axis,
  };
}

/** Đường năng suất thực tế (tấn/giờ) — cam. */
export function getOutputRateLineStyle() {
  const c = TIME_CHART_COLORS.outputRate;
  return {
    borderColor: c.border,
    backgroundColor: c.background,
    borderWidth: 1.5,
    axisColor: c.axis,
  };
}

export function getTimeChartBarStyle() {
  const c = TIME_CHART_COLORS.timeRun;
  return c;
}

export function getChartThemeColors() {
  if (typeof document === 'undefined') {
    return {
      axis: CHART_AXIS_TICK_COLOR,
      grid: CHART_AXIS_GRID_LIGHT,
      brand: 'rgba(32, 64, 154, 1)',
    };
  }

  const root = getComputedStyle(document.documentElement);
  const read = (name, fallback) => root.getPropertyValue(name).trim() || fallback;

  return {
    axis: CHART_AXIS_TICK_COLOR,
    grid: CHART_AXIS_GRID_LIGHT,
    brand: read('--brand-color', 'rgba(32, 64, 154, 1)'),
  };
}

/** Gắn màu trục/lưới. scaleRole: 'category' = không vẽ lưới; 'linear' = lưới ngang (trục giá trị). */
export function themedScale(scaleConfig = {}, tickColor, scaleRole = 'linear') {
  const { axis, grid } = getChartThemeColors();
  const baseTicks = scaleConfig.ticks ?? {};
  const userGrid = scaleConfig.grid ?? {};
  const userBorder = scaleConfig.border ?? {};
  const hideGrid = scaleRole === 'category';

  return {
    ...scaleConfig,
    ticks: {
      ...baseTicks,
      color: tickColor ?? axis,
    },
    grid: {
      color: grid,
      display: hideGrid ? false : userGrid.display ?? true,
      drawOnChartArea: hideGrid ? false : userGrid.drawOnChartArea ?? true,
      ...userGrid,
    },
    border: {
      color: grid,
      display: userBorder.display ?? false,
      ...userBorder,
    },
  };
}

/**
 * Tick trục X dạng category — dùng chung cho biểu đồ theo ngày/tháng/năm.
 * tickMode: 'month' = theo ngày (nhiều cột); 'year' = theo tháng/năm (ít nhãn hơn).
 */
export function getCategoryXAxisTickOptions(labelCount, tickMode = 'month') {
  if (tickMode === 'year') {
    return {
      maxRotation: 0,
      minRotation: 0,
      autoSkip: labelCount > 12,
      maxTicksLimit: labelCount > 12 ? 12 : undefined,
      font: { size: 9 },
      padding: 2,
    };
  }

  const dense = labelCount > 20;
  return {
    maxRotation: dense ? 45 : 0,
    minRotation: 0,
    autoSkip: true,
    maxTicksLimit:
      labelCount > 60 ? 10 : labelCount > 45 ? 12 : labelCount > 31 ? 14 : labelCount > 20 ? 16 : undefined,
    font: { size: 9 },
    padding: 2,
  };
}

const CHART_EASING = 'easeOutQuart';

/** Animation mượt khi đổi chế độ xem / cập nhật dữ liệu (polling). */
export const chartSmoothAnimationOptions = {
  animation: {
    duration: 550,
    easing: CHART_EASING,
  },
  animations: {
    tension: {
      duration: 400,
      easing: CHART_EASING,
    },
  },
  transitions: {
    active: {
      animation: {
        duration: 180,
        easing: CHART_EASING,
      },
    },
    resize: {
      animation: { duration: 0 },
    },
    show: {
      animations: {
        colors: { duration: 280, easing: CHART_EASING },
      },
    },
    hide: {
      animations: {
        colors: { duration: 280, easing: CHART_EASING },
      },
    },
  },
};

/** Biểu đồ rất nhiều điểm (vd. trạng thái 24h) — animation ngắn hơn. */
export const chartDenseAnimationOptions = {
  animation: {
    duration: 280,
    easing: 'easeOutCubic',
  },
  transitions: {
    active: { animation: { duration: 120 } },
    resize: { animation: { duration: 0 } },
  },
};

/** @deprecated alias — dùng chartSmoothAnimationOptions */
export const chartStableRenderOptions = chartSmoothAnimationOptions;

/** Tiêu đề tooltip cột/trục category — vd. "Ngày: 15", "Tháng: T3". */
export function formatChartTooltipTitle(categoryPrefix, label) {
  const text = label == null ? '' : String(label);
  if (!text) return '';
  if (!categoryPrefix) return text;
  return `${categoryPrefix}: ${text}`;
}

export function getCategoryTooltipTitleCallback(labels, categoryPrefix) {
  return (items) => {
    const index = items[0]?.dataIndex;
    return formatChartTooltipTitle(categoryPrefix, labels?.[index]);
  };
}

/** Legend: ô vuông tô đặc màu (không viền + nền nhạt). */
export function getChartLegendOptions(overrides = {}) {
  const { labels: labelOverrides, ...restOverrides } = overrides;
  return {
    display: true,
    position: 'top',
    align: 'center',
    ...restOverrides,
    labels: {
      boxWidth: 12,
      padding: 8,
      font: { size: 11 },
      generateLabels(chart) {
        const items = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
        return items.map((item) => ({
          ...item,
          fillStyle: item.strokeStyle,
          lineWidth: 0,
        }));
      },
      ...labelOverrides,
    },
  };
}
