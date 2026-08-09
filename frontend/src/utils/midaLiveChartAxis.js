/** Trục thời gian linear dùng chung biểu đồ live MIDA (công suất, trạng thái). */

export const MIDA_LIVE_TIME_STEPS_MS = [
  1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200,
].map((s) => s * 1000);

/** Chọn bước sao cho số nhãn khoảng <= maxTicks. */
export function chooseMidaLiveTimeStep(spanMs, maxTicks = 7) {
  const span = Number(spanMs);
  const limit = Math.max(2, Number(maxTicks) || 7);
  if (!Number.isFinite(span) || span <= 0) {
    return MIDA_LIVE_TIME_STEPS_MS[MIDA_LIVE_TIME_STEPS_MS.length - 1];
  }
  for (const s of MIDA_LIVE_TIME_STEPS_MS) {
    if (span / s <= limit) return s;
  }
  return MIDA_LIVE_TIME_STEPS_MS[MIDA_LIVE_TIME_STEPS_MS.length - 1];
}

export function formatMidaLiveClock(ms, withSeconds) {
  return new Date(ms).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

/**
 * Cấu hình scales.x (linear) — giống nhau trên mọi biểu đồ live MIDA.
 * @param {{ maxTicks?: number }} [options]
 */
export function getMidaLiveTimeXScaleConfig(options = {}) {
  const maxTicks = Math.max(2, Number(options.maxTicks) || 7);

  return {
    type: 'linear',
    bounds: 'data',
    offset: false,
    afterBuildTicks: (scale) => {
      const { min, max } = scale;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
      const step = chooseMidaLiveTimeStep(max - min, maxTicks);
      const first = Math.ceil(min / step) * step;
      const out = [];
      for (let v = first; v <= max + 1; v += step) {
        out.push({ value: v });
        if (out.length > 24) break;
      }
      scale.ticks = out;
    },
    ticks: {
      maxRotation: 0,
      minRotation: 0,
      autoSkip: false,
      includeBounds: false,
      font: { size: 9 },
      padding: 2,
      callback: function tickLabel(value) {
        const span = this.max - this.min;
        return formatMidaLiveClock(value, chooseMidaLiveTimeStep(span, maxTicks) < 60000);
      },
    },
    grid: {
      display: true,
      drawOnChartArea: true,
    },
  };
}
