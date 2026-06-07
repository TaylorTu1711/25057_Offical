/** Màu tick trục & lưới — neon tint. */
import { Chart as ChartJS } from 'chart.js';

const CHART_AXIS_TICK_COLOR = 'rgba(108, 122, 184, 0.85)';
const CHART_AXIS_GRID_LIGHT = 'rgba(108, 122, 184, 0.12)';
const CHART_AXIS_TICK_DARK = 'rgba(125, 212, 252, 0.78)';
const CHART_AXIS_GRID_DARK = 'rgba(56, 189, 248, 0.14)';
const CHART_X_AXIS_TICK_DARK = '#ffffff';

/** Bảng màu neon thống nhất toàn bộ biểu đồ SCADA. */
export const NEON_PALETTE = {
  cyan: '#7dd4fc',
  cyanBright: '#38bdf8',
  blue: '#2563eb',
  materialBlue: '#2196F3',
  yellow: '#e8f55a',
  yellowAxis: '#b8c42e',
  magenta: '#f472b6',
  magentaDeep: '#ec4899',
  green: '#4ade80',
  greenDeep: '#22c55e',
  orange: '#fb923c',
  orangeDeep: '#c2410c',
  purple: '#a78bfa',
  slate: '#64748b',
  pointBorder: '#1e293b',
  remainder: '#94a3b8',
  remainderDark: '#4a5f78',
};

export const NEON_BAR_GRADIENTS = {
  cyanBlue: {
    top: 'rgba(125, 212, 252, 0.95)',
    bottom: 'rgba(37, 99, 235, 0.65)',
    border: 'rgba(37, 99, 235, 0.85)',
    hoverTop: 'rgba(125, 212, 252, 1)',
    hoverBottom: 'rgba(37, 99, 235, 0.8)',
  },
  magentaPink: {
    top: 'rgba(251, 113, 133, 0.95)',
    bottom: 'rgba(236, 72, 153, 0.72)',
    border: 'rgba(236, 72, 153, 0.9)',
    hoverTop: 'rgba(251, 113, 133, 1)',
    hoverBottom: 'rgba(236, 72, 153, 0.85)',
  },
  /** Hồng neon — biểu đồ thời gian & năng suất */
  neonPink: {
    top: 'rgba(255, 110, 199, 0.96)',
    bottom: 'rgba(255, 20, 147, 0.78)',
    border: 'rgba(255, 20, 147, 0.95)',
    hoverTop: 'rgba(255, 130, 210, 1)',
    hoverBottom: 'rgba(255, 20, 147, 0.9)',
  },
};

export const NEON_LINES = {
  yellow: {
    border: NEON_PALETTE.yellow,
    background: 'rgba(232, 245, 90, 0.15)',
    point: NEON_PALETTE.yellow,
    axis: NEON_PALETTE.yellowAxis,
  },
  cyan: {
    border: NEON_PALETTE.cyanBright,
    background: 'rgba(56, 189, 248, 0.12)',
    point: NEON_PALETTE.cyanBright,
    axis: NEON_PALETTE.cyanBright,
  },
  green: {
    border: NEON_PALETTE.green,
    background: 'rgba(74, 222, 128, 0.12)',
    point: NEON_PALETTE.green,
    axis: NEON_PALETTE.greenDeep,
  },
  magenta: {
    border: NEON_PALETTE.magenta,
    background: 'rgba(244, 114, 182, 0.15)',
    point: NEON_PALETTE.magenta,
    axis: NEON_PALETTE.magentaDeep,
  },
  orange: {
    border: NEON_PALETTE.orange,
    background: 'rgba(251, 146, 60, 0.15)',
    point: NEON_PALETTE.orange,
    axis: NEON_PALETTE.orange,
  },
  orangeDeep: {
    border: NEON_PALETTE.orangeDeep,
    background: 'rgba(194, 65, 12, 0.15)',
    point: NEON_PALETTE.orangeDeep,
    axis: NEON_PALETTE.orangeDeep,
  },
  materialBlue: {
    border: NEON_PALETTE.materialBlue,
    background: 'rgba(33, 150, 243, 0.15)',
    point: NEON_PALETTE.materialBlue,
    axis: NEON_PALETTE.materialBlue,
  },
};

/** Hồng neon — biểu đồ thống kê cảnh báo (tab Chi tiết) */
export const NEON_ERROR_BAR = {
  palette: NEON_BAR_GRADIENTS.neonPink,
  fill: NEON_BAR_GRADIENTS.neonPink.top,
  border: NEON_BAR_GRADIENTS.neonPink.border,
};

/** @deprecated alias — dùng NEON_BAR_GRADIENTS.cyanBlue */
export const PRODUCTION_CHART_COLORS = {
  bar: NEON_BAR_GRADIENTS.cyanBlue,
  line: NEON_LINES.yellow,
};

/** Biểu đồ thời gian & năng suất */
export const TIME_CHART_COLORS = {
  timeRun: NEON_BAR_GRADIENTS.neonPink,
  outputRate: NEON_LINES.materialBlue,
  standard: NEON_LINES.green,
  performancePct: NEON_LINES.cyan,
};

export function createNeonBarGradient(ctx, chartArea, palette = NEON_BAR_GRADIENTS.cyanBlue) {
  if (!chartArea) return palette.top;
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, palette.bottom);
  gradient.addColorStop(1, palette.top);
  return gradient;
}

export function createNeonBarHoverGradient(ctx, chartArea, palette = NEON_BAR_GRADIENTS.cyanBlue) {
  if (!chartArea) return palette.hoverTop;
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, palette.hoverBottom);
  gradient.addColorStop(1, palette.hoverTop);
  return gradient;
}

export const createProductionBarGradient = (ctx, chartArea) =>
  createNeonBarGradient(ctx, chartArea, NEON_BAR_GRADIENTS.cyanBlue);

export const createProductionBarHoverGradient = (ctx, chartArea) =>
  createNeonBarHoverGradient(ctx, chartArea, NEON_BAR_GRADIENTS.cyanBlue);

export const createTimeBarGradient = (ctx, chartArea) =>
  createNeonBarGradient(ctx, chartArea, NEON_BAR_GRADIENTS.neonPink);

export const createTimeBarHoverGradient = (ctx, chartArea) =>
  createNeonBarHoverGradient(ctx, chartArea, NEON_BAR_GRADIENTS.neonPink);

/** Gradient ngang — cột/bar chart `indexAxis: 'y'`. */
export function createHorizontalNeonBarGradient(
  ctx,
  chartArea,
  palette = NEON_BAR_GRADIENTS.neonPink,
) {
  if (!chartArea) return palette.top;
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  gradient.addColorStop(0, palette.bottom);
  gradient.addColorStop(1, palette.top);
  return gradient;
}

export function createHorizontalNeonBarHoverGradient(
  ctx,
  chartArea,
  palette = NEON_BAR_GRADIENTS.neonPink,
) {
  if (!chartArea) return palette.hoverTop;
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  gradient.addColorStop(0, palette.hoverBottom);
  gradient.addColorStop(1, palette.hoverTop);
  return gradient;
}

export const createErrorBarGradient = (ctx, chartArea) =>
  createHorizontalNeonBarGradient(ctx, chartArea, NEON_ERROR_BAR.palette);

export const createErrorBarHoverGradient = (ctx, chartArea) =>
  createHorizontalNeonBarHoverGradient(ctx, chartArea, NEON_ERROR_BAR.palette);

function lineStyle(line) {
  return {
    borderColor: line.border,
    backgroundColor: line.background,
    pointBackgroundColor: line.point,
    pointBorderColor: NEON_PALETTE.pointBorder,
    axisColor: line.axis,
    borderWidth: 2,
  };
}

export function getPerformanceLineStyle() {
  return { ...lineStyle(NEON_LINES.cyan), borderWidth: 1.5 };
}

export function getStandardProductivityLineStyle() {
  return lineStyle(NEON_LINES.green);
}

export function getOutputRateLineStyle() {
  return { ...lineStyle(NEON_LINES.materialBlue), borderWidth: 1.5 };
}

export function getProductionLineStyle() {
  return lineStyle(NEON_LINES.yellow);
}

export function getStatusLineStyle() {
  return { ...lineStyle(NEON_LINES.green), borderWidth: 1.5 };
}

export function getParetoLineStyle() {
  return lineStyle(NEON_LINES.yellow);
}

export function getTimeChartBarStyle() {
  return NEON_BAR_GRADIENTS.magentaPink;
}

export function isDarkChartTheme(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
  );
}

export function getChartThemeColors(theme) {
  const isDark = isDarkChartTheme(theme);

  if (typeof document === 'undefined') {
    return {
      axis: isDark ? CHART_AXIS_TICK_DARK : CHART_AXIS_TICK_COLOR,
      grid: isDark ? CHART_AXIS_GRID_DARK : CHART_AXIS_GRID_LIGHT,
      brand: isDark ? NEON_PALETTE.cyan : NEON_PALETTE.cyanBright,
    };
  }

  const root = getComputedStyle(document.documentElement);
  const read = (name, fallback) => root.getPropertyValue(name).trim() || fallback;

  return {
    axis: isDark ? CHART_AXIS_TICK_DARK : CHART_AXIS_TICK_COLOR,
    grid: isDark ? CHART_AXIS_GRID_DARK : CHART_AXIS_GRID_LIGHT,
    brand: read('--brand-color', isDark ? NEON_PALETTE.cyan : NEON_PALETTE.cyanBright),
  };
}

/** Màu nhãn trục hoành (X) — trắng ở dark mode. */
export function getHorizontalAxisTickColor(theme) {
  return isDarkChartTheme(theme) ? CHART_X_AXIS_TICK_DARK : null;
}

/** Trục hoành (X): nhãn + tiêu đề trắng khi dark mode. */
export function themedXScale(scaleConfig = {}, tickColor, scaleRole = 'category', theme) {
  const xColor = getHorizontalAxisTickColor(theme);
  const config = { ...scaleConfig };
  if (xColor && config.title) {
    config.title = { ...config.title, color: xColor };
  }
  return themedScale(config, tickColor ?? xColor ?? undefined, scaleRole, theme);
}

/** Gắn màu trục/lưới. scaleRole: 'category' = không vẽ lưới; 'linear' = lưới ngang (trục giá trị). */
export function themedScale(scaleConfig = {}, tickColor, scaleRole = 'linear', theme) {
  const { axis, grid } = getChartThemeColors(theme);
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

/** Màu chữ legend / tên series — trắng ở dark mode. */
export function getChartLegendTextColor(theme) {
  return isDarkChartTheme(theme) ? CHART_X_AXIS_TICK_DARK : CHART_AXIS_TICK_COLOR;
}

/** Legend: ô vuông tô đặc màu (không viền + nền nhạt). */
export function getChartLegendOptions(overrides = {}, theme) {
  const { labels: labelOverrides = {}, ...restOverrides } = overrides;
  const legendTextColor = getChartLegendTextColor(theme);

  return {
    display: true,
    position: 'top',
    align: 'center',
    ...restOverrides,
    labels: {
      boxWidth: 12,
      padding: 8,
      font: { size: 11 },
      color: legendTextColor,
      generateLabels(chart) {
        const items = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
        return items.map((item) => ({
          ...item,
          fillStyle: item.strokeStyle,
          lineWidth: 0,
          fontColor: legendTextColor,
        }));
      },
      ...labelOverrides,
      color: labelOverrides.color ?? legendTextColor,
    },
  };
}
