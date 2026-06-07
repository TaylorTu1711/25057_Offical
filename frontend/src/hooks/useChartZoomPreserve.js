import { useRef, useLayoutEffect, useCallback, useMemo } from 'react';

function serializeDeps(deps) {
  try {
    return JSON.stringify(deps);
  } catch {
    return String(Date.now());
  }
}

function getCategoryMaxIndex(chart) {
  return Math.max(0, (chart.data?.labels?.length ?? 0) - 1);
}

function readAxisRange(scale, maxIndex) {
  if (!scale) return null;
  if (scale.min == null || scale.max == null) {
    return null;
  }
  return {
    min: scale.min,
    max: scale.max,
    full: isFullCategoryRange(scale.min, scale.max, maxIndex),
  };
}

function isFullCategoryRange(min, max, maxIndex) {
  if (maxIndex <= 0) return true;
  return min <= 0 && max >= maxIndex - 0.01;
}

function clampCategoryRange(saved, maxIndex) {
  if (saved.full || isFullCategoryRange(saved.min, saved.max, maxIndex)) {
    return { min: 0, max: maxIndex, full: true };
  }
  const min = Math.max(0, Math.min(saved.min, maxIndex));
  const max = Math.max(min, Math.min(saved.max, maxIndex));
  return { min, max, full: false };
}

/**
 * Giữ zoom/pan khi dữ liệu đổi (polling) — giống biểu đồ sản lượng / thời gian.
 * @param {unknown[]} restoreDeps — dữ liệu chart (labels, values, …)
 * @param {'x'|'y'|'xy'} mode — trục zoom
 * @param {{ getDefaultRange?: (maxIndex: number) => { min: number, max: number, full?: boolean } | null }} [options]
 */
export default function useChartZoomPreserve(restoreDeps, mode = 'x', { getDefaultRange } = {}) {
  const chartRef = useRef(null);
  const zoomStateRef = useRef(null);
  const saveZoomRef = useRef(() => {});
  const dataSignatureRef = useRef(null);
  const userZoomedRef = useRef(false);
  const hasAppliedDefaultRef = useRef(false);

  const dataSignature = useMemo(() => serializeDeps(restoreDeps), [restoreDeps]);

  const persistZoom = useCallback(
    (chart) => {
      if (!chart?.scales) return;

      if (mode === 'xy') {
        const maxIndex = getCategoryMaxIndex(chart);
        const x = readAxisRange(chart.scales.x, maxIndex);
        const y = readAxisRange(chart.scales.y, maxIndex);
        if (!x || !y) return;
        zoomStateRef.current = { x, y };
        return;
      }

      const maxIndex = getCategoryMaxIndex(chart);
      const range = readAxisRange(chart.scales[mode], maxIndex);
      if (!range) return;
      zoomStateRef.current = range;
    },
    [mode],
  );

  saveZoomRef.current = persistZoom;

  const applyAxisZoom = useCallback((chart, axisId, saved) => {
    const maxIndex = getCategoryMaxIndex(chart);
    const range = clampCategoryRange(saved, maxIndex);
    zoomStateRef.current = range;
    chart.zoomScale(axisId, { min: range.min, max: range.max }, 'none');
  }, []);

  const restoreZoom = useCallback(
    (chart) => {
      const saved = zoomStateRef.current;
      if (!saved || !chart?.scales) return;

      if (mode === 'xy') {
        if (saved.x) applyAxisZoom(chart, 'x', saved.x);
        if (saved.y) applyAxisZoom(chart, 'y', saved.y);
        return;
      }

      if (!chart.scales[mode]) return;
      applyAxisZoom(chart, mode, saved);
    },
    [applyAxisZoom, mode],
  );

  const markUserZoom = useCallback(({ chart }) => {
    userZoomedRef.current = true;
    saveZoomRef.current(chart);
  }, []);

  /** Khôi phục zoom khi dữ liệu đổi — không ghi đè trạng thái user sau restore */
  useLayoutEffect(() => {
    const isDataChange = dataSignatureRef.current !== dataSignature;
    if (!isDataChange && zoomStateRef.current != null) return;

    if (isDataChange) {
      dataSignatureRef.current = dataSignature;
    }

    let cancelled = false;
    let attempts = 0;

    const apply = () => {
      if (cancelled) return;

      const chart = chartRef.current;
      const hasLabels = (chart?.data?.labels?.length ?? 0) > 0;

      if (!chart || !hasLabels) {
        if (attempts++ < 24) requestAnimationFrame(apply);
        return;
      }

      if (zoomStateRef.current) {
        restoreZoom(chart);
        return;
      }

      if (!getDefaultRange || userZoomedRef.current || hasAppliedDefaultRef.current) return;

      const maxIndex = getCategoryMaxIndex(chart);
      const range = getDefaultRange(maxIndex);
      if (!range) return;

      applyAxisZoom(chart, mode, range);
      hasAppliedDefaultRef.current = true;
    };

    requestAnimationFrame(apply);

    return () => {
      cancelled = true;
    };
  }, [applyAxisZoom, dataSignature, getDefaultRange, mode, restoreZoom]);

  const zoomPluginOptions = useMemo(
    () => ({
      pan: {
        enabled: true,
        mode,
        onPanComplete: markUserZoom,
      },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode,
        onZoom: markUserZoom,
        onZoomComplete: markUserZoom,
      },
    }),
    [markUserZoom, mode],
  );

  return { chartRef, zoomPluginOptions };
};
